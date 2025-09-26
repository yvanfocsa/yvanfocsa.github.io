/**
 * Gestionnaire d'état global pour OUDAR Avocats
 * @fileoverview Gère l'état de l'application avec système de souscription
 */

import { mainLogger } from './logger.js';
import CONFIG from '../config/settings.js';

class StateManager {
  constructor() {
    this.state = {
      // === INTERFACE UTILISATEUR ===
      currentLanguage: CONFIG.LANGUAGES.DEFAULT,
      darkMode: this.getStoredDarkMode(),
      drawerOpen: false,
      loaderVisible: true,
      
      // === NAVIGATION ===
      currentPage: this.getCurrentPage(),
      activeSection: null,
      scrollY: 0,
      
      // === VIEWPORT ===
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      isMobile: window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE,
      
      // === COMPOSANTS ===
      activeCarousels: new Set(),
      visibleAnimations: new Set(),
      loadedModules: new Set(),
      
      // === COOKIES ET PREFERENCES ===
      cookiePreferences: this.getStoredCookiePreferences(),
      cookieBannerVisible: false,
      
      // === PERFORMANCE ===
      performanceMetrics: {},
      errorCount: 0,
      
      // === FORMULAIRES ===
      formStates: new Map(),
      validationErrors: new Map()
    };
    
    this.subscribers = new Map();
    this.middleware = [];
    
    this.init();
    mainLogger.debug('StateManager initialized', this.state);
  }

  /**
   * Initialise le gestionnaire d'état
   */
  init() {
    // Écoute les changements de viewport
    this.setupViewportListeners();
    
    // Sauvegarde périodique de l'état critique
    this.setupPeriodicSave();
  }

  /**
   * Met à jour une propriété de l'état
   * @param {string} key Clé à mettre à jour
   * @param {any} value Nouvelle valeur
   * @param {boolean} notify Si les abonnés doivent être notifiés
   */
  setState(key, value, notify = true) {
    const oldValue = this.state[key];
    
    // Applique les middlewares
    const processedValue = this.applyMiddleware(key, value, oldValue);
    
    // Met à jour l'état
    this.state[key] = processedValue;
    
    // Log du changement
    mainLogger.debug(`State updated: ${key}`, {
      oldValue,
      newValue: processedValue
    });
    
    // Notifie les abonnés si nécessaire
    if (notify && oldValue !== processedValue) {
      this.notifySubscribers(key, processedValue, oldValue);
    }
    
    // Sauvegarde automatique pour certaines clés critiques
    this.autoSave(key, processedValue);
  }

  /**
   * Met à jour plusieurs propriétés en une fois
   * @param {Object} updates Objet des mises à jour
   * @param {boolean} notify Si les abonnés doivent être notifiés
   */
  setMultipleStates(updates, notify = true) {
    const changes = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = this.state[key];
      const processedValue = this.applyMiddleware(key, value, oldValue);
      
      this.state[key] = processedValue;
      
      if (oldValue !== processedValue) {
        changes.push({ key, oldValue, newValue: processedValue });
      }
    });
    
    mainLogger.debug('Multiple state updates', changes);
    
    // Notifie tous les changements
    if (notify) {
      changes.forEach(({ key, newValue, oldValue }) => {
        this.notifySubscribers(key, newValue, oldValue);
      });
    }
  }

  /**
   * Récupère une propriété de l'état
   * @param {string} key Clé à récupérer
   * @returns {any}
   */
  getState(key) {
    return this.state[key];
  }

  /**
   * Récupère tout l'état
   * @returns {Object}
   */
  getAllState() {
    return { ...this.state };
  }

  /**
   * S'abonne aux changements d'une propriété
   * @param {string} key Clé à surveiller
   * @param {Function} callback Fonction appelée lors du changement
   * @returns {Function} Fonction de désabonnement
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key).add(callback);
    
    mainLogger.debug(`Subscription added for: ${key}`);
    
    // Retourne une fonction de désabonnement
    return () => {
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
      mainLogger.debug(`Subscription removed for: ${key}`);
    };
  }

  /**
   * S'abonne à plusieurs propriétés
   * @param {Array<string>} keys Clés à surveiller
   * @param {Function} callback Fonction appelée lors des changements
   * @returns {Function} Fonction de désabonnement
   */
  subscribeToMultiple(keys, callback) {
    const unsubscribeFunctions = keys.map(key => 
      this.subscribe(key, callback)
    );
    
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Notifie les abonnés d'un changement
   * @param {string} key Clé modifiée
   * @param {any} newValue Nouvelle valeur
   * @param {any} oldValue Ancienne valeur
   */
  notifySubscribers(key, newValue, oldValue) {
    const keySubscribers = this.subscribers.get(key);
    
    if (keySubscribers && keySubscribers.size > 0) {
      keySubscribers.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          mainLogger.error(`Error in state subscriber for ${key}`, error);
        }
      });
    }
  }

  /**
   * Ajoute un middleware pour traiter les changements d'état
   * @param {Function} middleware Fonction middleware
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
    mainLogger.debug('Middleware added', middleware);
  }

  /**
   * Applique les middlewares à une valeur
   * @param {string} key Clé de l'état
   * @param {any} value Valeur à traiter
   * @param {any} oldValue Ancienne valeur
   * @returns {any} Valeur traitée
   */
  applyMiddleware(key, value, oldValue) {
    return this.middleware.reduce((processedValue, middleware) => {
      return middleware(key, processedValue, oldValue);
    }, value);
  }

  /**
   * Configure les listeners de viewport
   */
  setupViewportListeners() {
    const updateViewport = () => {
      this.setMultipleStates({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        isMobile: window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE
      }, false); // Pas de notification pour éviter le spam
    };
    
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
  }

  /**
   * Configure la sauvegarde périodique
   */
  setupPeriodicSave() {
    setInterval(() => {
      this.saveStateToStorage();
    }, 60000); // Toutes les minutes
  }

  /**
   * Sauvegarde automatique pour certaines clés
   * @param {string} key Clé modifiée
   * @param {any} value Nouvelle valeur
   */
  autoSave(key, value) {
    const autoSaveKeys = [
      'currentLanguage',
      'darkMode', 
      'cookiePreferences'
    ];
    
    if (autoSaveKeys.includes(key)) {
      try {
        localStorage.setItem(`oudar-${key}`, JSON.stringify(value));
      } catch (e) {
        mainLogger.warn(`Failed to auto-save ${key}`, e);
      }
    }
  }

  /**
   * Sauvegarde l'état complet
   */
  saveStateToStorage() {
    try {
      const stateToSave = {
        currentLanguage: this.state.currentLanguage,
        darkMode: this.state.darkMode,
        cookiePreferences: this.state.cookiePreferences
      };
      
      localStorage.setItem('oudar-app-state', JSON.stringify(stateToSave));
      mainLogger.debug('State saved to storage');
    } catch (e) {
      mainLogger.warn('Failed to save state to storage', e);
    }
  }

  /**
   * Restaure l'état depuis le stockage
   */
  restoreStateFromStorage() {
    try {
      const savedState = localStorage.getItem('oudar-app-state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.setMultipleStates(parsed);
        mainLogger.debug('State restored from storage', parsed);
      }
    } catch (e) {
      mainLogger.warn('Failed to restore state from storage', e);
    }
  }

  /**
   * Récupère le mode sombre stocké
   * @returns {boolean}
   */
  getStoredDarkMode() {
    try {
      const stored = localStorage.getItem('oudar-darkMode');
      return stored ? JSON.parse(stored) : false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Récupère les préférences de cookies stockées
   * @returns {Object}
   */
  getStoredCookiePreferences() {
    try {
      const stored = localStorage.getItem(CONFIG.COOKIES.PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : {
        necessary: true,
        analytics: false,
        marketing: false
      };
    } catch (e) {
      return {
        necessary: true,
        analytics: false,
        marketing: false
      };
    }
  }

  /**
   * Détermine la page actuelle
   * @returns {string}
   */
  getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /**
   * Remet à zéro l'état (pour les tests)
   */
  reset() {
    const initialState = {
      currentLanguage: CONFIG.LANGUAGES.DEFAULT,
      darkMode: false,
      drawerOpen: false,
      loaderVisible: true,
      currentPage: this.getCurrentPage(),
      activeSection: null,
      scrollY: 0,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      isMobile: window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE,
      activeCarousels: new Set(),
      visibleAnimations: new Set(),
      loadedModules: new Set(),
      cookiePreferences: {
        necessary: true,
        analytics: false,
        marketing: false
      },
      cookieBannerVisible: false,
      performanceMetrics: {},
      errorCount: 0,
      formStates: new Map(),
      validationErrors: new Map()
    };
    
    this.state = initialState;
    this.subscribers.clear();
    mainLogger.debug('State reset to initial values');
  }

  /**
   * Debug - affiche l'état actuel
   */
  debug() {
    mainLogger.debug('Current state:', this.state);
    mainLogger.debug('Active subscribers:', 
      Array.from(this.subscribers.keys())
    );
  }
}

// Instance singleton
export const stateManager = new StateManager();

// Export pour usage externe
export default stateManager;