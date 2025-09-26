/**
 * Gestionnaire d'erreurs global
 * @fileoverview Gère les erreurs et exceptions de l'application
 */

import { mainLogger } from './logger.js';
import { stateManager } from './stateManager.js';
import { eventManager } from './events.js';

export class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.errorHistory = [];
    this.maxHistorySize = 50;
    this.initialized = false;
    
    mainLogger.debug('ErrorHandler created');
  }

  /**
   * Initialise le gestionnaire d'erreurs
   */
  init() {
    if (this.initialized) return;

    // Capture les erreurs JavaScript globales
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });

    // Capture les promesses rejetées
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: 'Unhandled Promise Rejection',
        reason: event.reason,
        stack: event.reason?.stack
      });
    });

    // Capture les erreurs de ressources
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleResourceError(event);
      }
    }, true);

    this.initialized = true;
    mainLogger.debug('ErrorHandler initialized');
  }

  /**
   * Gère une erreur générique
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleError(errorInfo) {
    this.errorCount++;
    
    // Ajoute des métadonnées
    const enrichedError = {
      ...errorInfo,
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      time: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      state: {
        currentLanguage: stateManager.getState('currentLanguage'),
        darkMode: stateManager.getState('darkMode'),
        isMobile: stateManager.getState('isMobile')
      }
    };

    // Ajoute à l'historique
    this.addToHistory(enrichedError);

    // Log l'erreur
    mainLogger.error('Application error caught', enrichedError);

    // Met à jour l'état global
    stateManager.setState('errorCount', this.errorCount);

    // Émit un événement pour les autres modules
    eventManager.emit('app-error', enrichedError);

    // Gère selon la sévérité
    this.handleErrorBySeverity(enrichedError);
  }

  /**
   * Gère une erreur de ressource
   * @param {Event} event Événement d'erreur
   */
  handleResourceError(event) {
    const target = event.target;
    const errorInfo = {
      type: 'resource',
      resourceType: target.tagName.toLowerCase(),
      source: target.src || target.href,
      message: `Failed to load ${target.tagName.toLowerCase()}: ${target.src || target.href}`
    };

    this.handleError(errorInfo);

    // Tente une récupération pour certains types de ressources
    this.attemptResourceRecovery(target);
  }

  /**
   * Tente de récupérer une ressource échouée
   * @param {Element} target Élément en erreur
   */
  attemptResourceRecovery(target) {
    switch (target.tagName.toLowerCase()) {
      case 'img':
        this.recoverImage(target);
        break;
      case 'script':
        this.recoverScript(target);
        break;
      case 'link':
        this.recoverStylesheet(target);
        break;
    }
  }

  /**
   * Récupère une image échouée
   * @param {HTMLImageElement} img Image en erreur
   */
  recoverImage(img) {
    // Tente avec une image de fallback
    if (!img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'true';
      
      // Image placeholder générique
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vbiBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
      img.alt = 'Image non disponible';
      
      mainLogger.debug('Image recovery attempted', img);
    }
  }

  /**
   * Récupère un script échoué
   * @param {HTMLScriptElement} script Script en erreur
   */
  recoverScript(script) {
    // Pour les scripts critiques, on peut tenter un reload
    if (script.dataset.critical === 'true' && !script.dataset.retryAttempted) {
      script.dataset.retryAttempted = 'true';
      
      setTimeout(() => {
        const newScript = script.cloneNode(true);
        script.parentNode.replaceChild(newScript, script);
        mainLogger.debug('Script recovery attempted', script.src);
      }, 1000);
    }
  }

  /**
   * Récupère une feuille de style échouée
   * @param {HTMLLinkElement} link Lien en erreur
   */
  recoverStylesheet(link) {
    // Tente de recharger les CSS critiques
    if (link.rel === 'stylesheet' && !link.dataset.retryAttempted) {
      link.dataset.retryAttempted = 'true';
      
      setTimeout(() => {
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        mainLogger.debug('Stylesheet recovery attempted', link.href);
      }, 1000);
    }
  }

  /**
   * Gère les erreurs selon leur sévérité
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleErrorBySeverity(errorInfo) {
    const severity = this.determineSeverity(errorInfo);

    switch (severity) {
      case 'critical':
        this.handleCriticalError(errorInfo);
        break;
      case 'high':
        this.handleHighSeverityError(errorInfo);
        break;
      case 'medium':
        this.handleMediumSeverityError(errorInfo);
        break;
      case 'low':
        this.handleLowSeverityError(errorInfo);
        break;
    }
  }

  /**
   * Détermine la sévérité d'une erreur
   * @param {Object} errorInfo Informations sur l'erreur
   * @returns {string}
   */
  determineSeverity(errorInfo) {
    // Erreurs critiques
    if (errorInfo.message?.includes('main.js') ||
        errorInfo.message?.includes('Cannot read property') ||
        errorInfo.type === 'promise') {
      return 'critical';
    }

    // Erreurs haute sévérité
    if (errorInfo.message?.includes('TypeError') ||
        errorInfo.message?.includes('ReferenceError')) {
      return 'high';
    }

    // Erreurs de ressources
    if (errorInfo.type === 'resource') {
      return 'medium';
    }

    // Autres erreurs
    return 'low';
  }

  /**
   * Gère les erreurs critiques
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleCriticalError(errorInfo) {
    mainLogger.error('🚨 CRITICAL ERROR DETECTED', errorInfo);
    
    // Affiche un message à l'utilisateur
    this.showUserErrorMessage('critical');
    
    // Tente une récupération
    this.attemptCriticalRecovery();
  }

  /**
   * Gère les erreurs de haute sévérité
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleHighSeverityError(errorInfo) {
    mainLogger.error('⚠️ HIGH SEVERITY ERROR', errorInfo);
    
    // Peut désactiver certaines fonctionnalités non critiques
    this.disableNonCriticalFeatures();
  }

  /**
   * Gère les erreurs de sévérité moyenne
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleMediumSeverityError(errorInfo) {
    mainLogger.warn('⚠️ MEDIUM SEVERITY ERROR', errorInfo);
    
    // Log pour monitoring mais n'affecte pas l'UX
  }

  /**
   * Gère les erreurs de faible sévérité
   * @param {Object} errorInfo Informations sur l'erreur
   */
  handleLowSeverityError(errorInfo) {
    mainLogger.debug('ℹ️ LOW SEVERITY ERROR', errorInfo);
    
    // Simple logging
  }

  /**
   * Affiche un message d'erreur à l'utilisateur
   * @param {string} severity Sévérité de l'erreur
   */
  showUserErrorMessage(severity) {
    // Évite les messages multiples
    if (document.querySelector('.error-notification')) return;

    const messages = {
      critical: {
        title: 'Erreur de chargement',
        text: 'Une erreur technique est survenue. La page va se recharger automatiquement.',
        action: 'Recharger maintenant'
      },
      high: {
        title: 'Fonctionnalité indisponible',
        text: 'Certaines fonctionnalités peuvent être temporairement indisponibles.',
        action: 'Continuer'
      }
    };

    const message = messages[severity];
    if (!message) return;

    const notification = DOMUtils.createElement('div', {
      className: 'error-notification',
      style: `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 8px;
        padding: 16px 20px;
        max-width: 350px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      `
    }, `
      <div style="font-weight: 700; margin-bottom: 8px;">${message.title}</div>
      <div style="margin-bottom: 12px;">${message.text}</div>
      <button onclick="this.parentElement.remove(); ${severity === 'critical' ? 'window.location.reload();' : ''}" 
              style="background: #721c24; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        ${message.action}
      </button>
    `);

    document.body.appendChild(notification);

    // Auto-reload pour erreurs critiques
    if (severity === 'critical') {
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }
  }

  /**
   * Tente une récupération d'erreur critique
   */
  attemptCriticalRecovery() {
    try {
      // Nettoie l'état global
      stateManager.reset();
      
      // Recharge les modules critiques
      if (window.OudarApp) {
        window.OudarApp.destroy();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
      mainLogger.info('Critical recovery attempted');
    } catch (recoveryError) {
      mainLogger.error('Critical recovery failed', recoveryError);
      // Force reload en dernier recours
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  /**
   * Désactive les fonctionnalités non critiques
   */
  disableNonCriticalFeatures() {
    // Désactive les animations
    document.body.classList.add('safe-mode', 'no-animations');
    
    // Désactive l'auto-rotation des carrousels
    eventManager.emit('disable-auto-features');
    
    mainLogger.info('Non-critical features disabled for safety');
  }

  /**
   * Ajoute une erreur à l'historique
   * @param {Object} errorInfo Informations sur l'erreur
   */
  addToHistory(errorInfo) {
    this.errorHistory.unshift(errorInfo);
    
    // Limite la taille
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Vérifie la santé de l'application
   * @returns {Object}
   */
  healthCheck() {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(
      error => now - error.timestamp < 60000 // 1 minute
    );

    const health = {
      status: 'healthy',
      errorCount: this.errorCount,
      recentErrorCount: recentErrors.length,
      criticalErrors: recentErrors.filter(e => this.determineSeverity(e) === 'critical').length,
      lastError: this.errorHistory[0] || null
    };

    // Détermine le statut de santé
    if (health.criticalErrors > 0) {
      health.status = 'critical';
    } else if (health.recentErrorCount > 5) {
      health.status = 'degraded';
    } else if (health.recentErrorCount > 2) {
      health.status = 'warning';
    }

    return health;
  }

  /**
   * Exporte les erreurs pour debugging
   * @returns {Object}
   */
  exportErrors() {
    return {
      timestamp: new Date().toISOString(),
      totalErrors: this.errorCount,
      errors: this.errorHistory,
      health: this.healthCheck(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  /**
   * Importe des erreurs depuis un export
   * @param {Object} exportData Données d'export
   */
  importErrors(exportData) {
    if (exportData.errors && Array.isArray(exportData.errors)) {
      this.errorHistory = [...exportData.errors, ...this.errorHistory];
      this.errorCount += exportData.totalErrors || 0;
      
      mainLogger.info('Errors imported', { count: exportData.errors.length });
    }
  }

  /**
   * Vide l'historique des erreurs
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCount = 0;
    stateManager.setState('errorCount', 0);
    
    mainLogger.info('Error history cleared');
  }

  /**
   * Obtient les statistiques d'erreurs
   * @returns {Object}
   */
  getStats() {
    const now = Date.now();
    
    return {
      totalErrors: this.errorCount,
      recentErrors: this.errorHistory.filter(e => now - e.timestamp < 300000).length, // 5 min
      errorTypes: this.getErrorTypeStats(),
      health: this.healthCheck(),
      initialized: this.initialized
    };
  }

  /**
   * Obtient les statistiques par type d'erreur
   * @returns {Object}
   */
  getErrorTypeStats() {
    const stats = {};
    
    this.errorHistory.forEach(error => {
      const type = error.type || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Crée un rapport d'erreur détaillé
   * @param {Object} errorInfo Informations sur l'erreur
   * @returns {string}
   */
  createErrorReport(errorInfo) {
    return `
=== RAPPORT D'ERREUR OUDAR AVOCATS ===
ID: ${errorInfo.id}
Time: ${errorInfo.time}
Type: ${errorInfo.type}
Message: ${errorInfo.message}
URL: ${errorInfo.url}
User Agent: ${errorInfo.userAgent}
Viewport: ${errorInfo.viewport.width}x${errorInfo.viewport.height}
State: ${JSON.stringify(errorInfo.state, null, 2)}
Stack: ${errorInfo.stack || 'N/A'}
=====================================
    `.trim();
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.clearHistory();
    this.initialized = false;
    
    mainLogger.debug('ErrorHandler destroyed');
  }
}

// Instance singleton
export const errorHandler = new ErrorHandler();

// Auto-initialisation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => errorHandler.init());
} else {
  errorHandler.init();
}

export default errorHandler;