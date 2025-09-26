/**
 * Module de gestion du loader
 * @fileoverview Gère l'affichage et la disparition du loader initial
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class LoaderManager {
  constructor() {
    this.loader = null;
    this.isVisible = true;
    this.hideTimeout = null;
    this.initialized = false;
    
    uiLogger.debug('LoaderManager created');
  }

  /**
   * Initialise le gestionnaire de loader
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('LoaderManager already initialized');
      return;
    }

    try {
      // Trouve l'élément loader
      this.loader = DOMUtils.select(CONFIG.SELECTORS.LOADER);
      
      if (!this.loader) {
        uiLogger.warn('Loader element not found');
        return;
      }
      
      // Met à jour l'état initial
      stateManager.setState('loaderVisible', this.isVisible);
      
      // Configure le masquage automatique
      this.setupAutoHide();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      uiLogger.success('LoaderManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize LoaderManager', error);
      throw error;
    }
  }

  /**
   * Configure le masquage automatique
   */
  setupAutoHide() {
    // Masque après le timeout configuré
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, CONFIG.LOADER_TIMEOUT);
    
    // Masque aussi quand la page est complètement chargée
    if (document.readyState === 'complete') {
      // Page déjà chargée
      setTimeout(() => this.hide(), 100);
    } else {
      // Attend le chargement complet
      window.addEventListener('load', () => {
        setTimeout(() => this.hide(), 500);
      });
    }
    
    uiLogger.debug(`Auto-hide configured with timeout: ${CONFIG.LOADER_TIMEOUT}ms`);
  }

  /**
   * Masque le loader
   * @param {boolean} force Forcer le masquage même si déjà caché
   * @returns {Promise<void>}
   */
  async hide(force = false) {
    if (!this.isVisible && !force) {
      uiLogger.debug('Loader already hidden');
      return;
    }

    if (!this.loader) {
      uiLogger.warn('No loader element to hide');
      return;
    }

    try {
      uiLogger.info('Hiding loader');
      
      // Annule le timeout si il existe
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      
      // Ajoute la classe hidden avec animation
      this.loader.classList.add('hidden');
      
      // Met à jour l'état
      this.isVisible = false;
      stateManager.setState('loaderVisible', false);
      
      // Attend la fin de l'animation avant de masquer complètement
      await this.waitForTransition();
      
      // Masque complètement et retire du DOM flow
      this.loader.style.display = 'none';
      this.loader.setAttribute('aria-hidden', 'true');
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('loader-hidden'));
      
      uiLogger.success('Loader hidden successfully');
      
    } catch (error) {
      uiLogger.error('Failed to hide loader', error);
    }
  }

  /**
   * Affiche le loader
   * @returns {Promise<void>}
   */
  async show() {
    if (this.isVisible) {
      uiLogger.debug('Loader already visible');
      return;
    }

    if (!this.loader) {
      uiLogger.warn('No loader element to show');
      return;
    }

    try {
      uiLogger.info('Showing loader');
      
      // Remet dans le DOM flow
      this.loader.style.display = '';
      this.loader.setAttribute('aria-hidden', 'false');
      
      // Retire la classe hidden
      this.loader.classList.remove('hidden');
      
      // Met à jour l'état
      this.isVisible = true;
      stateManager.setState('loaderVisible', true);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('loader-shown'));
      
      uiLogger.success('Loader shown successfully');
      
    } catch (error) {
      uiLogger.error('Failed to show loader', error);
    }
  }

  /**
   * Attend la fin de la transition CSS
   * @returns {Promise<void>}
   */
  waitForTransition() {
    return new Promise((resolve) => {
      if (!this.loader) {
        resolve();
        return;
      }

      const transitionEndHandler = (e) => {
        if (e.target === this.loader && e.propertyName === 'opacity') {
          this.loader.removeEventListener('transitionend', transitionEndHandler);
          resolve();
        }
      };

      this.loader.addEventListener('transitionend', transitionEndHandler);
      
      // Fallback si la transition ne se déclenche pas
      setTimeout(resolve, 500);
    });
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de visibilité depuis l'état global
    stateManager.subscribe('loaderVisible', (isVisible) => {
      if (isVisible && !this.isVisible) {
        this.show();
      } else if (!isVisible && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Bascule la visibilité
   * @returns {Promise<void>}
   */
  async toggle() {
    if (this.isVisible) {
      await this.hide();
    } else {
      await this.show();
    }
  }

  /**
   * Définit un nouveau message de chargement
   * @param {string} message Nouveau message
   */
  setMessage(message) {
    if (!this.loader) return;
    
    const messageElement = this.loader.querySelector('.loader-message');
    if (messageElement) {
      messageElement.textContent = message;
      uiLogger.debug('Loader message updated:', message);
    }
  }

  /**
   * Met à jour le pourcentage de progression
   * @param {number} percent Pourcentage (0-100)
   */
  setProgress(percent) {
    if (!this.loader) return;
    
    const progressBar = this.loader.querySelector('.loader-progress');
    if (progressBar) {
      const clampedPercent = Math.max(0, Math.min(100, percent));
      progressBar.style.width = `${clampedPercent}%`;
      progressBar.setAttribute('aria-valuenow', clampedPercent);
      
      uiLogger.debug('Loader progress updated:', clampedPercent);
    }
  }

  /**
   * Réinitialise le loader à son état initial
   */
  reset() {
    if (!this.loader) return;
    
    // Annule les timeouts
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Remet l'état initial
    this.loader.style.display = '';
    this.loader.classList.remove('hidden');
    this.loader.setAttribute('aria-hidden', 'false');
    
    // Reset le message et la progression
    this.setMessage('');
    this.setProgress(0);
    
    // Met à jour l'état
    this.isVisible = true;
    stateManager.setState('loaderVisible', true);
    
    uiLogger.debug('Loader reset to initial state');
  }

  /**
   * Force la disparition immédiate sans animation
   */
  forceHide() {
    if (!this.loader) return;
    
    // Annule les timeouts
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Masque immédiatement
    this.loader.style.display = 'none';
    this.loader.style.opacity = '0';
    this.loader.style.visibility = 'hidden';
    this.loader.setAttribute('aria-hidden', 'true');
    
    // Met à jour l'état
    this.isVisible = false;
    stateManager.setState('loaderVisible', false);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('loader-force-hidden'));
    
    uiLogger.info('Loader force hidden');
  }

  /**
   * Vérifie si le loader est visible
   * @returns {boolean}
   */
  getVisibility() {
    return this.isVisible;
  }

  /**
   * Obtient l'élément loader
   * @returns {Element|null}
   */
  getElement() {
    return this.loader;
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Annule les timeouts
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Force le masquage
    this.forceHide();
    
    this.initialized = false;
    uiLogger.debug('LoaderManager destroyed');
  }

  /**
   * Obtient les statistiques du loader
   * @returns {Object}
   */
  getStats() {
    return {
      isVisible: this.isVisible,
      hasTimeout: Boolean(this.hideTimeout),
      element: Boolean(this.loader),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let loaderManager = null;

/**
 * Obtient l'instance du gestionnaire de loader
 * @returns {LoaderManager}
 */
export function getLoaderManager() {
  if (!loaderManager) {
    loaderManager = new LoaderManager();
  }
  return loaderManager;
}

/**
 * Initialise le gestionnaire de loader
 * @returns {Promise<LoaderManager>}
 */
export async function initLoaderManager() {
  const manager = getLoaderManager();
  await manager.init();
  return manager;
}

/**
 * Raccourci pour masquer le loader
 * @returns {Promise<void>}
 */
export async function hideLoader() {
  const manager = getLoaderManager();
  await manager.hide();
}

/**
 * Raccourci pour afficher le loader
 * @returns {Promise<void>}
 */
export async function showLoader() {
  const manager = getLoaderManager();
  await manager.show();
}

export default { 
  LoaderManager, 
  getLoaderManager, 
  initLoaderManager,
  hideLoader,
  showLoader
};