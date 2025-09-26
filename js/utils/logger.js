/**
 * Système de logging avancé pour OUDAR Avocats
 * @fileoverview Gère les logs avec niveaux et contextes pour debug et monitoring
 */

import CONFIG from '../config/settings.js';

export class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.logLevel = this.getLogLevel();
    this.startTime = performance.now();
  }

  /**
   * Détermine le niveau de log selon l'environnement
   * @returns {string} Niveau de log
   */
  getLogLevel() {
    // Development
    if (location.hostname === 'localhost' || 
        location.hostname === '127.0.0.1' || 
        location.hostname.includes('dev')) {
      return CONFIG.LOG_LEVELS.DEBUG;
    }
    // Production
    return CONFIG.LOG_LEVELS.ERROR;
  }

  /**
   * Vérifie si un niveau de log doit être affiché
   * @param {string} level Niveau du message
   * @returns {boolean}
   */
  shouldLog(level) {
    const levels = [
      CONFIG.LOG_LEVELS.DEBUG,
      CONFIG.LOG_LEVELS.INFO,
      CONFIG.LOG_LEVELS.WARN,
      CONFIG.LOG_LEVELS.ERROR
    ];
    
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    
    return messageIndex >= currentIndex;
  }

  /**
   * Formate le timestamp
   * @returns {string}
   */
  getTimestamp() {
    const elapsed = (performance.now() - this.startTime).toFixed(2);
    return `+${elapsed}ms`;
  }

  /**
   * Log de debug (development seulement)
   * @param {string} message Message à logger
   * @param {...any} args Arguments supplémentaires
   */
  debug(message, ...args) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      console.log(
        `🔍 [${this.context}] ${this.getTimestamp()} ${message}`,
        ...args
      );
    }
  }

  /**
   * Log d'information
   * @param {string} message Message à logger
   * @param {...any} args Arguments supplémentaires
   */
  info(message, ...args) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.INFO)) {
      console.info(
        `ℹ️ [${this.context}] ${this.getTimestamp()} ${message}`,
        ...args
      );
    }
  }

  /**
   * Log d'avertissement
   * @param {string} message Message à logger
   * @param {...any} args Arguments supplémentaires
   */
  warn(message, ...args) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.WARN)) {
      console.warn(
        `⚠️ [${this.context}] ${this.getTimestamp()} ${message}`,
        ...args
      );
    }
  }

  /**
   * Log d'erreur (toujours affiché)
   * @param {string} message Message à logger
   * @param {Error} error Objet erreur
   * @param {...any} args Arguments supplémentaires
   */
  error(message, error = null, ...args) {
    console.error(
      `❌ [${this.context}] ${this.getTimestamp()} ${message}`,
      error,
      ...args
    );
    
    // En production, pourrait envoyer à un service de monitoring
    if (this.logLevel !== CONFIG.LOG_LEVELS.DEBUG) {
      this.reportError(message, error, args);
    }
  }

  /**
   * Performance timing
   * @param {string} label Label du timer
   */
  time(label) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      console.time(`⏱️ [${this.context}] ${label}`);
    }
  }

  /**
   * Fin du timing
   * @param {string} label Label du timer
   */
  timeEnd(label) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      console.timeEnd(`⏱️ [${this.context}] ${label}`);
    }
  }

  /**
   * Groupe de logs
   * @param {string} title Titre du groupe
   * @param {boolean} collapsed Si le groupe est réduit
   */
  group(title, collapsed = false) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      const method = collapsed ? 'groupCollapsed' : 'group';
      console[method](`📂 [${this.context}] ${title}`);
    }
  }

  /**
   * Fin du groupe
   */
  groupEnd() {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      console.groupEnd();
    }
  }

  /**
   * Log de succès
   * @param {string} message Message de succès
   * @param {...any} args Arguments supplémentaires
   */
  success(message, ...args) {
    if (this.shouldLog(CONFIG.LOG_LEVELS.INFO)) {
      console.log(
        `✅ [${this.context}] ${this.getTimestamp()} ${message}`,
        ...args
      );
    }
  }

  /**
   * Rapport d'erreur pour monitoring externe
   * @param {string} message Message d'erreur
   * @param {Error} error Objet erreur
   * @param {Array} args Arguments supplémentaires
   */
  reportError(message, error, args) {
    // Ici on pourrait envoyer à Sentry, LogRocket, etc.
    // Pour le moment, stockage local pour debug
    try {
      const errorReport = {
        timestamp: new Date().toISOString(),
        context: this.context,
        message,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        args
      };
      
      // Stockage local temporaire
      const reports = JSON.parse(localStorage.getItem('error-reports') || '[]');
      reports.push(errorReport);
      
      // Garde seulement les 10 dernières erreurs
      if (reports.length > 10) {
        reports.splice(0, reports.length - 10);
      }
      
      localStorage.setItem('error-reports', JSON.stringify(reports));
    } catch (e) {
      // Évite les boucles d'erreur
      console.error('Failed to report error:', e);
    }
  }

  /**
   * Affiche les statistiques de performance
   */
  showStats() {
    if (this.shouldLog(CONFIG.LOG_LEVELS.DEBUG)) {
      const stats = {
        'Page Load Time': `${performance.now().toFixed(2)}ms`,
        'Memory Usage': navigator.memory ? 
          `${(navigator.memory.usedJSHeapSize / 1048576).toFixed(2)}MB` : 
          'N/A',
        'Connection': navigator.connection ? 
          navigator.connection.effectiveType : 
          'N/A'
      };
      
      console.table(stats);
    }
  }
}

// Instances de loggers par contexte
export const mainLogger = new Logger('Main');
export const uiLogger = new Logger('UI');
export const featureLogger = new Logger('Features');
export const performanceLogger = new Logger('Performance');

export default Logger;