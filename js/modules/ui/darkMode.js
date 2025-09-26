/**
 * Module de gestion du mode sombre
 * @fileoverview Gère le basculement entre mode clair et sombre avec persistance
 */

import CONFIG from '../../config/settings.js';
import StorageUtils from '../../utils/storage.js';
import DOMUtils from '../../utils/dom.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class DarkModeManager {
  constructor() {
    this.initialized = false;
    this.toggle = null;
    this.isDarkMode = this.getInitialMode();
    
    uiLogger.debug('DarkModeManager created', { isDarkMode: this.isDarkMode });
  }

  /**
   * Initialise le gestionnaire de mode sombre
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('DarkModeManager already initialized');
      return;
    }

    try {
      uiLogger.time('DarkModeManager initialization');
      
      // Met à jour l'état global
      stateManager.setState('darkMode', this.isDarkMode);
      
      // Trouve le bouton toggle
      this.toggle = DOMUtils.select(CONFIG.SELECTORS.DARK_MODE_TOGGLE);
      
      if (!this.toggle) {
        uiLogger.warn('Dark mode toggle button not found');
        return;
      }
      
      // Configure le bouton
      this.setupToggleButton();
      
      // Applique le mode initial
      this.applyMode(this.isDarkMode, false);
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      // Écoute les changements système
      this.setupSystemPreferenceListener();
      
      this.initialized = true;
      uiLogger.timeEnd('DarkModeManager initialization');
      uiLogger.success('DarkModeManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize DarkModeManager', error);
      throw error;
    }
  }

  /**
   * Détermine le mode initial
   * @returns {boolean}
   */
  getInitialMode() {
    // 1. Mode stocké en localStorage
    const storedMode = StorageUtils.get('darkMode');
    if (storedMode !== null) {
      uiLogger.debug('Using stored dark mode:', storedMode);
      return storedMode;
    }
    
    // 2. Préférence système
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      uiLogger.debug('Using system dark mode preference');
      return true;
    }
    
    // 3. Mode clair par défaut
    uiLogger.debug('Using default light mode');
    return false;
  }

  /**
   * Configure le bouton de basculement
   */
  setupToggleButton() {
    if (!this.toggle) return;
    
    // Nettoie les anciens listeners
    DOMUtils.cleanupEventListeners(this.toggle);
    
    // Ajoute le nouveau listener
    DOMUtils.addEventListenerWithCleanup(this.toggle, 'click', (e) => {
      e.preventDefault();
      this.toggleMode();
    });
    
    // Ajoute support clavier
    DOMUtils.addEventListenerWithCleanup(this.toggle, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleMode();
      }
    });
    
    // Met à jour l'état initial du bouton
    this.updateToggleButton();
    
    uiLogger.debug('Dark mode toggle button configured');
  }

  /**
   * Bascule entre les modes
   */
  toggleMode() {
    const newMode = !this.isDarkMode;
    this.setMode(newMode);
    
    uiLogger.info(`Dark mode toggled: ${this.isDarkMode ? 'ON' : 'OFF'}`);
  }

  /**
   * Définit le mode sombre
   * @param {boolean} isDark Mode sombre activé
   * @param {boolean} animate Animer la transition
   */
  setMode(isDark, animate = true) {
    if (isDark === this.isDarkMode) {
      uiLogger.debug(`Dark mode already set to: ${isDark}`);
      return;
    }

    const oldMode = this.isDarkMode;
    this.isDarkMode = isDark;
    
    // Met à jour l'état global
    stateManager.setState('darkMode', isDark);
    
    // Sauvegarde la préférence
    StorageUtils.set('darkMode', isDark);
    
    // Applique le mode
    this.applyMode(isDark, animate);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('dark-mode-changed', {
      detail: { 
        darkMode: isDark,
        oldMode
      }
    }));
    
    uiLogger.info(`Dark mode set to: ${isDark ? 'ON' : 'OFF'}`);
  }

  /**
   * Applique le mode à l'interface
   * @param {boolean} isDark Mode sombre
   * @param {boolean} animate Animer la transition
   */
  applyMode(isDark, animate = true) {
    const body = document.body;
    
    if (animate) {
      // Ajoute une transition temporaire
      body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
      
      // Retire la transition après l'animation
      setTimeout(() => {
        body.style.transition = '';
      }, 300);
    }
    
    // Applique/retire la classe dark-mode
    body.classList.toggle('dark-mode', isDark);
    
    // Met à jour l'attribut data pour CSS
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    // Met à jour le bouton
    this.updateToggleButton();
    
    // Met à jour meta theme-color
    this.updateThemeColor(isDark);
    
    uiLogger.debug(`Dark mode applied: ${isDark ? 'dark' : 'light'}`);
  }

  /**
   * Met à jour l'apparence du bouton toggle
   */
  updateToggleButton() {
    if (!this.toggle) return;
    
    // Met à jour aria-label
    const label = this.isDarkMode ? 
      'Passer au mode clair' : 
      'Passer au mode sombre';
    this.toggle.setAttribute('aria-label', label);
    
    // Met à jour aria-pressed pour accessibilité
    this.toggle.setAttribute('aria-pressed', this.isDarkMode.toString());
    
    // Met à jour les icônes (si utilisation de CSS pour show/hide)
    const sunIcon = this.toggle.querySelector('.sun-icon');
    const moonIcon = this.toggle.querySelector('.moon-icon');
    
    if (sunIcon && moonIcon) {
      if (this.isDarkMode) {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
    
    uiLogger.debug('Toggle button updated', { isDarkMode: this.isDarkMode });
  }

  /**
   * Met à jour la couleur de thème meta
   * @param {boolean} isDark Mode sombre
   */
  updateThemeColor(isDark) {
    const themeColorMeta = DOMUtils.select('meta[name="theme-color"]');
    
    if (themeColorMeta) {
      const color = isDark ? '#101828' : '#c41f3a';
      themeColorMeta.setAttribute('content', color);
      uiLogger.debug('Theme color updated:', color);
    }
  }

  /**
   * Configure l'écoute des préférences système
   */
  setupSystemPreferenceListener() {
    if (!window.matchMedia) {
      uiLogger.debug('matchMedia not supported');
      return;
    }
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemChange = (e) => {
      // Ne change que si aucune préférence utilisateur n'est stockée
      const hasUserPreference = StorageUtils.has('darkMode');
      
      if (!hasUserPreference) {
        this.setMode(e.matches, true);
        uiLogger.info('Dark mode updated from system preference:', e.matches);
      }
    };
    
    // Écoute les changements
    if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemChange);
    } else {
      mediaQuery.addEventListener('change', handleSystemChange);
    }
    
    uiLogger.debug('System preference listener setup');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de mode depuis l'état global
    stateManager.subscribe('darkMode', (newMode) => {
      if (newMode !== this.isDarkMode) {
        this.setMode(newMode);
      }
    });
  }

  /**
   * Obtient l'état actuel
   * @returns {boolean}
   */
  isDark() {
    return this.isDarkMode;
  }

  /**
   * Force le mode clair
   */
  setLight() {
    this.setMode(false);
  }

  /**
   * Force le mode sombre
   */
  setDark() {
    this.setMode(true);
  }

  /**
   * Remet le mode selon la préférence système
   */
  resetToSystem() {
    // Supprime la préférence stockée
    StorageUtils.remove('darkMode');
    
    // Applique la préférence système
    const systemPrefersDark = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    this.setMode(systemPrefersDark);
    uiLogger.info('Dark mode reset to system preference');
  }

  /**
   * Obtient la préférence système actuelle
   * @returns {boolean|null}
   */
  getSystemPreference() {
    if (!window.matchMedia) return null;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    return mediaQuery.matches;
  }

  /**
   * Vérifie si l'utilisateur a une préférence stockée
   * @returns {boolean}
   */
  hasUserPreference() {
    return StorageUtils.has('darkMode');
  }

  /**
   * Applique un mode temporaire (sans sauvegarde)
   * @param {boolean} isDark Mode sombre
   */
  previewMode(isDark) {
    this.applyMode(isDark, true);
    // Ne met pas à jour this.isDarkMode ni ne sauvegarde
    uiLogger.debug('Preview mode applied:', isDark);
  }

  /**
   * Annule le mode de prévisualisation
   */
  cancelPreview() {
    this.applyMode(this.isDarkMode, true);
    uiLogger.debug('Preview cancelled, restored to:', this.isDarkMode);
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    if (this.toggle) {
      DOMUtils.cleanupEventListeners(this.toggle);
    }
    
    this.initialized = false;
    uiLogger.debug('DarkModeManager destroyed');
  }

  /**
   * Obtient les statistiques d'utilisation
   * @returns {Object}
   */
  getStats() {
    return {
      currentMode: this.isDarkMode ? 'dark' : 'light',
      hasUserPreference: this.hasUserPreference(),
      systemPreference: this.getSystemPreference(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let darkModeManager = null;

/**
 * Obtient l'instance du gestionnaire de mode sombre
 * @returns {DarkModeManager}
 */
export function getDarkModeManager() {
  if (!darkModeManager) {
    darkModeManager = new DarkModeManager();
  }
  return darkModeManager;
}

/**
 * Initialise le gestionnaire de mode sombre
 * @returns {Promise<DarkModeManager>}
 */
export async function initDarkModeManager() {
  const manager = getDarkModeManager();
  await manager.init();
  return manager;
}

export default { DarkModeManager, getDarkModeManager, initDarkModeManager };