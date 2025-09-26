/**
 * Module de gestion des cookies RGPD
 * @fileoverview Gère le consentement cookies conforme RGPD avec bandeau et préférences
 */

import CONFIG from '../../config/settings.js';
import StorageUtils from '../../utils/storage.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class CookiesManager {
  constructor() {
    this.banner = null;
    this.settingsPage = null;
    this.preferences = this.getStoredPreferences();
    this.initialized = false;
    this.bannerTimeout = null;
    
    featureLogger.debug('CookiesManager created', { preferences: this.preferences });
  }

  /**
   * Initialise le gestionnaire de cookies
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('CookiesManager already initialized');
      return;
    }

    try {
      featureLogger.time('CookiesManager initialization');
      
      // Trouve les éléments DOM
      this.banner = DOMUtils.select(CONFIG.SELECTORS.COOKIE_BANNER);
      this.settingsPage = DOMUtils.select('.cookie-settings-panel');
      
      // Applique les préférences existantes
      this.applyPreferences();
      
      // Configure le bandeau si présent
      if (this.banner) {
        this.setupBanner();
      }
      
      // Configure la page de paramètres si présente
      if (this.settingsPage) {
        this.setupSettingsPage();
      }
      
      // Affiche le bandeau si nécessaire
      this.showBannerIfNeeded();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('CookiesManager initialization');
      featureLogger.success('CookiesManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize CookiesManager', error);
      throw error;
    }
  }

  /**
   * Récupère les préférences stockées
   * @returns {Object}
   */
  getStoredPreferences() {
    return StorageUtils.get(CONFIG.COOKIES.PREFERENCES_KEY, {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    });
  }

  /**
   * Sauvegarde les préférences
   * @param {Object} preferences Nouvelles préférences
   */
  savePreferences(preferences) {
    this.preferences = { ...this.preferences, ...preferences };
    StorageUtils.set(CONFIG.COOKIES.PREFERENCES_KEY, this.preferences);
    stateManager.setState('cookiePreferences', this.preferences);
    
    featureLogger.info('Cookie preferences saved', this.preferences);
  }

  /**
   * Configure le bandeau de cookies
   */
  setupBanner() {
    const acceptButton = DOMUtils.select('#accept-cookies', this.banner);
    const rejectButton = DOMUtils.select('#reject-cookies', this.banner);
    const customizeLink = DOMUtils.select('.cookie-customize', this.banner);

    // Bouton "Tout accepter"
    if (acceptButton) {
      DOMUtils.addEventListenerWithCleanup(acceptButton, 'click', (e) => {
        e.preventDefault();
        this.acceptAllCookies();
      });
    }

    // Bouton "Tout refuser"
    if (rejectButton) {
      DOMUtils.addEventListenerWithCleanup(rejectButton, 'click', (e) => {
        e.preventDefault();
        this.rejectAllCookies();
      });
    }

    // Lien "Personnaliser"
    if (customizeLink) {
      DOMUtils.addEventListenerWithCleanup(customizeLink, 'click', (e) => {
        // Laisse le comportement par défaut pour naviguer vers la page
        this.hideBanner();
      });
    }

    // Fermeture par Échap
    DOMUtils.addEventListenerWithCleanup(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this.isBannerVisible()) {
        this.rejectAllCookies();
      }
    });

    featureLogger.debug('Cookie banner configured');
  }

  /**
   * Configure la page de paramètres
   */
  setupSettingsPage() {
    const toggles = DOMUtils.selectAll('.switch input[type="checkbox"]', this.settingsPage);
    
    toggles.forEach(toggle => {
      const cookieType = toggle.dataset.cookie;
      
      if (!cookieType) return;

      // Définit l'état initial
      toggle.checked = this.preferences[cookieType] || false;
      
      // Désactive le toggle des cookies nécessaires
      if (cookieType === 'necessary') {
        toggle.disabled = true;
        toggle.checked = true;
      }

      // Écoute les changements
      DOMUtils.addEventListenerWithCleanup(toggle, 'change', (e) => {
        this.updatePreference(cookieType, e.target.checked);
      });
    });

    // Bouton de sauvegarde global
    const saveButton = DOMUtils.select('.save-preferences', this.settingsPage);
    if (saveButton) {
      DOMUtils.addEventListenerWithCleanup(saveButton, 'click', (e) => {
        e.preventDefault();
        this.saveAndApplyPreferences();
      });
    }

    featureLogger.debug('Cookie settings page configured');
  }

  /**
   * Affiche le bandeau si nécessaire
   */
  showBannerIfNeeded() {
    if (!this.banner) return;

    // Vérifie si l'utilisateur a déjà fait un choix
    const hasConsent = StorageUtils.has(CONFIG.COOKIES.PREFERENCES_KEY);
    
    if (!hasConsent) {
      // Affiche le bandeau après un délai
      this.bannerTimeout = setTimeout(() => {
        this.showBanner();
      }, CONFIG.COOKIES.BANNER_DELAY);
    }
  }

  /**
   * Affiche le bandeau
   */
  showBanner() {
    if (!this.banner) return;

    this.banner.hidden = false;
    this.banner.classList.add('visible');
    
    stateManager.setState('cookieBannerVisible', true);
    
    // Focus sur le bandeau pour l'accessibilité
    const firstButton = DOMUtils.select('button', this.banner);
    if (firstButton) {
      setTimeout(() => firstButton.focus(), 100);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('cookie-banner-shown'));

    featureLogger.info('Cookie banner shown');
  }

  /**
   * Masque le bandeau
   */
  hideBanner() {
    if (!this.banner) return;

    this.banner.classList.remove('visible');
    
    setTimeout(() => {
      this.banner.hidden = true;
    }, CONFIG.COOKIES.BANNER_DURATION);
    
    stateManager.setState('cookieBannerVisible', false);
    
    // Annule le timeout d'affichage si il existe
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('cookie-banner-hidden'));

    featureLogger.info('Cookie banner hidden');
  }

  /**
   * Accepte tous les cookies
   */
  acceptAllCookies() {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true
    };

    this.savePreferences(allAccepted);
    this.applyPreferences();
    this.hideBanner();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('cookies-all-accepted', {
      detail: { preferences: allAccepted }
    }));

    featureLogger.info('All cookies accepted');
  }

  /**
   * Refuse tous les cookies non nécessaires
   */
  rejectAllCookies() {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };

    this.savePreferences(onlyNecessary);
    this.applyPreferences();
    this.hideBanner();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('cookies-all-rejected', {
      detail: { preferences: onlyNecessary }
    }));

    featureLogger.info('All non-necessary cookies rejected');
  }

  /**
   * Met à jour une préférence spécifique
   * @param {string} cookieType Type de cookie
   * @param {boolean} enabled État d'activation
   */
  updatePreference(cookieType, enabled) {
    this.preferences[cookieType] = enabled;
    
    // Applique immédiatement la préférence
    this.applySinglePreference(cookieType, enabled);

    featureLogger.debug(`Cookie preference updated: ${cookieType} = ${enabled}`);
  }

  /**
   * Sauvegarde et applique toutes les préférences
   */
  saveAndApplyPreferences() {
    this.savePreferences(this.preferences);
    this.applyPreferences();

    // Affiche une confirmation
    this.showSaveConfirmation();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('cookies-preferences-saved', {
      detail: { preferences: this.preferences }
    }));

    featureLogger.info('Cookie preferences saved and applied');
  }

  /**
   * Applique toutes les préférences
   */
  applyPreferences() {
    Object.entries(this.preferences).forEach(([type, enabled]) => {
      this.applySinglePreference(type, enabled);
    });

    featureLogger.debug('All cookie preferences applied', this.preferences);
  }

  /**
   * Applique une préférence spécifique
   * @param {string} cookieType Type de cookie
   * @param {boolean} enabled État d'activation
   */
  applySinglePreference(cookieType, enabled) {
    switch (cookieType) {
      case 'analytics':
        this.handleAnalyticsCookies(enabled);
        break;
      case 'marketing':
        this.handleMarketingCookies(enabled);
        break;
      case 'functional':
        this.handleFunctionalCookies(enabled);
        break;
      case 'necessary':
        // Les cookies nécessaires sont toujours activés
        break;
    }
  }

  /**
   * Gère les cookies d'analyse
   * @param {boolean} enabled Activé
   */
  handleAnalyticsCookies(enabled) {
    if (enabled) {
      // Active Google Analytics ou autre service d'analyse
      this.enableAnalytics();
    } else {
      // Désactive et supprime les cookies d'analyse
      this.disableAnalytics();
    }

    featureLogger.debug('Analytics cookies handled', { enabled });
  }

  /**
   * Gère les cookies marketing
   * @param {boolean} enabled Activé
   */
  handleMarketingCookies(enabled) {
    if (enabled) {
      // Active les pixels de tracking, Facebook, etc.
      this.enableMarketing();
    } else {
      // Désactive et supprime les cookies marketing
      this.disableMarketing();
    }

    featureLogger.debug('Marketing cookies handled', { enabled });
  }

  /**
   * Gère les cookies fonctionnels
   * @param {boolean} enabled Activé
   */
  handleFunctionalCookies(enabled) {
    if (enabled) {
      // Active les fonctionnalités nécessitant des cookies
      this.enableFunctional();
    } else {
      // Désactive les fonctionnalités optionnelles
      this.disableFunctional();
    }

    featureLogger.debug('Functional cookies handled', { enabled });
  }

  /**
   * Active Google Analytics
   */
  enableAnalytics() {
    // Exemple d'implémentation Google Analytics
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    
    // Ou charge le script GA4
    this.loadGoogleAnalytics();
  }

  /**
   * Désactive Google Analytics
   */
  disableAnalytics() {
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
    
    // Supprime les cookies GA
    this.deleteCookiesByPattern(/^_ga/);
  }

  /**
   * Active les services marketing
   */
  enableMarketing() {
    // Exemple pour Facebook Pixel, Google Ads, etc.
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    }
  }

  /**
   * Désactive les services marketing
   */
  disableMarketing() {
    if (typeof gtag !== 'undefined') {
      gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    
    // Supprime les cookies marketing
    this.deleteCookiesByPattern(/^_fbp|^_fbc/);
  }

  /**
   * Active les fonctionnalités optionnelles
   */
  enableFunctional() {
    // Exemple: chat widgets, embeddings, etc.
    document.body.classList.add('functional-cookies-enabled');
  }

  /**
   * Désactive les fonctionnalités optionnelles
   */
  disableFunctional() {
    document.body.classList.remove('functional-cookies-enabled');
  }

  /**
   * Charge Google Analytics
   */
  loadGoogleAnalytics() {
    // Ne charge que si pas déjà présent
    if (document.querySelector('script[src*="googletagmanager"]')) {
      return;
    }

    // Remplacez 'GA_MEASUREMENT_ID' par votre vrai ID
    const GA_ID = 'GA_MEASUREMENT_ID';
    
    // Charge le script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    // Configure gtag
    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      
      gtag('js', new Date());
      gtag('config', GA_ID, {
        anonymize_ip: true,
        cookie_flags: 'SameSite=None;Secure'
      });
      
      featureLogger.debug('Google Analytics loaded');
    };
  }

  /**
   * Supprime les cookies par pattern
   * @param {RegExp} pattern Pattern des cookies à supprimer
   */
  deleteCookiesByPattern(pattern) {
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      
      if (pattern.test(cookieName)) {
        // Supprime le cookie
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        
        featureLogger.debug(`Cookie deleted: ${cookieName}`);
      }
    });
  }

  /**
   * Vérifie si le bandeau doit être affiché
   * @returns {boolean}
   */
  shouldShowBanner() {
    return !StorageUtils.has(CONFIG.COOKIES.PREFERENCES_KEY);
  }

  /**
   * Vérifie si le bandeau est visible
   * @returns {boolean}
   */
  isBannerVisible() {
    return this.banner && !this.banner.hidden && this.banner.classList.contains('visible');
  }

  /**
   * Affiche une confirmation de sauvegarde
   */
  showSaveConfirmation() {
    const confirmation = DOMUtils.createElement('div', {
      className: 'cookie-save-confirmation',
      style: `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--brand);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1001;
        font-weight: 700;
      `
    }, '✓ Préférences sauvegardées');

    document.body.appendChild(confirmation);

    setTimeout(() => {
      confirmation.remove();
    }, 3000);

    featureLogger.debug('Save confirmation shown');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de préférences depuis l'état global
    stateManager.subscribe('cookiePreferences', (newPreferences) => {
      if (JSON.stringify(newPreferences) !== JSON.stringify(this.preferences)) {
        this.preferences = newPreferences;
        this.applyPreferences();
      }
    });
  }

  /**
   * Remet les préférences par défaut
   */
  resetToDefaults() {
    const defaults = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false
    };

    this.savePreferences(defaults);
    this.applyPreferences();
    
    // Met à jour l'interface de la page de paramètres
    if (this.settingsPage) {
      this.updateSettingsInterface();
    }

    featureLogger.info('Cookie preferences reset to defaults');
  }

  /**
   * Met à jour l'interface de la page de paramètres
   */
  updateSettingsInterface() {
    const toggles = DOMUtils.selectAll('.switch input[type="checkbox"]', this.settingsPage);
    
    toggles.forEach(toggle => {
      const cookieType = toggle.dataset.cookie;
      if (cookieType && this.preferences.hasOwnProperty(cookieType)) {
        toggle.checked = this.preferences[cookieType];
      }
    });
  }

  /**
   * Obtient le statut de consentement pour un type de cookie
   * @param {string} cookieType Type de cookie
   * @returns {boolean}
   */
  hasConsent(cookieType) {
    return Boolean(this.preferences[cookieType]);
  }

  /**
   * Obtient toutes les préférences actuelles
   * @returns {Object}
   */
  getPreferences() {
    return { ...this.preferences };
  }

  /**
   * Exporte les préférences pour transfert
   * @returns {Object}
   */
  exportPreferences() {
    return {
      timestamp: new Date().toISOString(),
      preferences: this.getPreferences(),
      version: '1.0.0'
    };
  }

  /**
   * Importe des préférences
   * @param {Object} importData Données d'import
   * @returns {boolean} Succès de l'import
   */
  importPreferences(importData) {
    try {
      if (!importData.preferences) {
        throw new Error('Invalid import data');
      }

      this.savePreferences(importData.preferences);
      this.applyPreferences();

      featureLogger.info('Cookie preferences imported successfully');
      return true;
    } catch (error) {
      featureLogger.error('Failed to import cookie preferences', error);
      return false;
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Annule les timeouts
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }

    // Masque le bandeau
    this.hideBanner();

    this.initialized = false;
    featureLogger.debug('CookiesManager destroyed');
  }

  /**
   * Obtient les statistiques des cookies
   * @returns {Object}
   */
  getStats() {
    return {
      preferences: this.getPreferences(),
      bannerVisible: this.isBannerVisible(),
      hasConsent: StorageUtils.has(CONFIG.COOKIES.PREFERENCES_KEY),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let cookiesManager = null;

/**
 * Obtient l'instance du gestionnaire de cookies
 * @returns {CookiesManager}
 */
export function getCookiesManager() {
  if (!cookiesManager) {
    cookiesManager = new CookiesManager();
  }
  return cookiesManager;
}

/**
 * Initialise le gestionnaire de cookies
 * @returns {Promise<CookiesManager>}
 */
export async function initCookiesManager() {
  const manager = getCookiesManager();
  await manager.init();
  return manager;
}

export default { CookiesManager, getCookiesManager, initCookiesManager };