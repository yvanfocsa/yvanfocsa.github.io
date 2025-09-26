/**
 * Module de gestion du multilinguisme
 * @fileoverview Gère la traduction dynamique et la persistance de la langue
 */

import { translations } from '../../config/translations.js';
import CONFIG from '../../config/settings.js';
import StorageUtils from '../../utils/storage.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class LanguageManager {
  constructor() {
    this.translations = translations;
    this.currentLang = this.getInitialLanguage();
    this.initialized = false;
    
    featureLogger.debug('LanguageManager created', { currentLang: this.currentLang });
  }

  /**
   * Initialise le gestionnaire de langue
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('LanguageManager already initialized');
      return;
    }

    try {
      featureLogger.time('LanguageManager initialization');
      
      // Met à jour l'état global
      stateManager.setState('currentLanguage', this.currentLang);
      
      // Configure les boutons de langue
      await this.setupLanguageSwitcher();
      
      // Met à jour tous les textes
      await this.updateTexts();
      
      // Met à jour les meta tags
      this.updateMetaTags();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('LanguageManager initialization');
      featureLogger.success('LanguageManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize LanguageManager', error);
      throw error;
    }
  }

  /**
   * Détermine la langue initiale
   * @returns {string}
   */
  getInitialLanguage() {
    // 1. Langue stockée en localStorage
    const storedLang = StorageUtils.get('language');
    if (storedLang && CONFIG.LANGUAGES.SUPPORTED.includes(storedLang)) {
      featureLogger.debug('Using stored language:', storedLang);
      return storedLang;
    }
    
    // 2. Langue du navigateur
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && CONFIG.LANGUAGES.SUPPORTED.includes(browserLang)) {
      featureLogger.debug('Using browser language:', browserLang);
      return browserLang;
    }
    
    // 3. Langue par défaut
    featureLogger.debug('Using default language:', CONFIG.LANGUAGES.DEFAULT);
    return CONFIG.LANGUAGES.DEFAULT;
  }

  /**
   * Met à jour tous les textes de la page
   * @returns {Promise<void>}
   */
  async updateTexts() {
    const elements = DOMUtils.selectAll('[data-key]');
    let updatedCount = 0;
    
    featureLogger.debug(`Updating ${elements.length} text elements`);
    
    elements.forEach(element => {
      const key = element.dataset.key;
      const translation = this.getTranslation(key);
      
      if (translation) {
        this.setElementText(element, translation);
        updatedCount++;
      } else {
        featureLogger.warn(`Missing translation for key: ${key} (${this.currentLang})`);
      }
    });
    
    featureLogger.debug(`Updated ${updatedCount} text elements`);
    
    // Dispatch event pour notifier les autres modules
    window.dispatchEvent(new CustomEvent('language-updated', {
      detail: { 
        language: this.currentLang,
        elementsUpdated: updatedCount
      }
    }));
  }

  /**
   * Définit le texte d'un élément selon son type
   * @param {Element} element Élément DOM
   * @param {string} translation Traduction
   */
  setElementText(element, translation) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'input':
      case 'textarea':
        if (element.type === 'submit' || element.type === 'button') {
          element.value = translation;
        } else {
          element.placeholder = translation;
        }
        break;
        
      case 'img':
        element.alt = translation;
        break;
        
      case 'meta':
        if (element.name === 'description') {
          element.content = translation;
        }
        break;
        
      case 'title':
        element.textContent = translation;
        break;
        
      default:
        element.innerHTML = translation;
        break;
    }
  }

  /**
   * Récupère une traduction pour une clé donnée
   * @param {string} key Clé de traduction
   * @param {string} lang Langue (optionnel)
   * @returns {string|null}
   */
  getTranslation(key, lang = this.currentLang) {
    return this.translations[lang]?.[key] || null;
  }

  /**
   * Change la langue active
   * @param {string} lang Code de langue
   * @returns {Promise<boolean>} Succès de l'opération
   */
  async setLanguage(lang) {
    if (!CONFIG.LANGUAGES.SUPPORTED.includes(lang)) {
      featureLogger.warn(`Unsupported language: ${lang}`);
      return false;
    }

    if (lang === this.currentLang) {
      featureLogger.debug(`Language already set to: ${lang}`);
      return true;
    }

    try {
      featureLogger.info(`Changing language from ${this.currentLang} to ${lang}`);
      
      const oldLang = this.currentLang;
      this.currentLang = lang;
      
      // Met à jour l'état global
      stateManager.setState('currentLanguage', lang);
      
      // Sauvegarde la préférence
      StorageUtils.set('language', lang);
      
      // Met à jour l'interface
      await this.updateTexts();
      this.updateMetaTags();
      this.updateLanguageButtons();
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('language-changed', {
        detail: { 
          oldLanguage: oldLang,
          newLanguage: lang
        }
      }));
      
      featureLogger.success(`Language changed to: ${lang}`);
      return true;
      
    } catch (error) {
      featureLogger.error(`Failed to change language to ${lang}`, error);
      // Restore previous language
      this.currentLang = oldLang;
      stateManager.setState('currentLanguage', oldLang);
      return false;
    }
  }

  /**
   * Configure les boutons de changement de langue
   * @returns {Promise<void>}
   */
  async setupLanguageSwitcher() {
    const langButtons = DOMUtils.selectAll(CONFIG.SELECTORS.LANG_BUTTONS);
    
    if (langButtons.length === 0) {
      featureLogger.warn('No language buttons found');
      return;
    }
    
    langButtons.forEach(button => {
      const lang = button.dataset.lang;
      
      if (!CONFIG.LANGUAGES.SUPPORTED.includes(lang)) {
        featureLogger.warn(`Invalid language button: ${lang}`);
        return;
      }
      
      // Nettoie les anciens listeners
      DOMUtils.cleanupEventListeners(button);
      
      // Ajoute le nouveau listener
      DOMUtils.addEventListenerWithCleanup(button, 'click', async (e) => {
        e.preventDefault();
        await this.setLanguage(lang);
      });
      
      featureLogger.debug(`Language button setup: ${lang}`, button);
    });
    
    // Met à jour l'état initial des boutons
    this.updateLanguageButtons();
  }

  /**
   * Met à jour l'état visuel des boutons de langue
   */
  updateLanguageButtons() {
    const langButtons = DOMUtils.selectAll(CONFIG.SELECTORS.LANG_BUTTONS);
    
    langButtons.forEach(button => {
      const isActive = button.dataset.lang === this.currentLang;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
    
    featureLogger.debug('Language buttons updated', { currentLang: this.currentLang });
  }

  /**
   * Met à jour les meta tags selon la langue
   */
  updateMetaTags() {
    // Title
    const titleElement = DOMUtils.select('title[data-key]');
    if (titleElement) {
      const titleKey = titleElement.dataset.key;
      const title = this.getTranslation(titleKey);
      if (title) {
        titleElement.textContent = title;
        featureLogger.debug('Page title updated:', title);
      }
    }
    
    // Meta description
    const descElement = DOMUtils.select('meta[name="description"][data-key]');
    if (descElement) {
      const descKey = descElement.dataset.key;
      const desc = this.getTranslation(descKey);
      if (desc) {
        descElement.setAttribute('content', desc);
        featureLogger.debug('Meta description updated:', desc);
      }
    }
    
    // HTML lang attribute
    document.documentElement.lang = this.currentLang;
    
    // Hreflang links (if they exist)
    const hreflangLinks = DOMUtils.selectAll('link[hreflang]');
    hreflangLinks.forEach(link => {
      const hreflang = link.getAttribute('hreflang');
      if (hreflang === this.currentLang || hreflang === 'x-default') {
        link.setAttribute('href', window.location.href);
      }
    });
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue depuis l'état global
    stateManager.subscribe('currentLanguage', async (newLang) => {
      if (newLang !== this.currentLang) {
        await this.setLanguage(newLang);
      }
    });
  }

  /**
   * Ajoute une traduction dynamiquement
   * @param {string} lang Code de langue
   * @param {string} key Clé de traduction
   * @param {string} value Valeur de traduction
   */
  addTranslation(lang, key, value) {
    if (!this.translations[lang]) {
      this.translations[lang] = {};
    }
    
    this.translations[lang][key] = value;
    featureLogger.debug(`Translation added: ${lang}.${key} = ${value}`);
    
    // Met à jour immédiatement si c'est la langue active
    if (lang === this.currentLang) {
      const elements = DOMUtils.selectAll(`[data-key="${key}"]`);
      elements.forEach(element => {
        this.setElementText(element, value);
      });
    }
  }

  /**
   * Formate une date selon la langue
   * @param {Date} date Date à formater
   * @param {Object} options Options de formatage
   * @returns {string}
   */
  formatDate(date, options = {}) {
    const locales = {
      fr: 'fr-FR',
      en: 'en-US',
      ru: 'ru-RU'
    };
    
    const locale = locales[this.currentLang] || locales.fr;
    
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    }).format(date);
  }

  /**
   * Formate un nombre selon la langue
   * @param {number} number Nombre à formater
   * @param {Object} options Options de formatage
   * @returns {string}
   */
  formatNumber(number, options = {}) {
    const locales = {
      fr: 'fr-FR',
      en: 'en-US', 
      ru: 'ru-RU'
    };
    
    const locale = locales[this.currentLang] || locales.fr;
    
    return new Intl.NumberFormat(locale, options).format(number);
  }

  /**
   * Formate une devise selon la langue
   * @param {number} amount Montant
   * @param {string} currency Code devise (EUR, USD, etc.)
   * @returns {string}
   */
  formatCurrency(amount, currency = 'EUR') {
    return this.formatNumber(amount, {
      style: 'currency',
      currency
    });
  }

  /**
   * Obtient la direction du texte pour la langue
   * @returns {string} 'ltr' ou 'rtl'
   */
  getTextDirection() {
    // Toutes nos langues supportées sont LTR
    return 'ltr';
  }

  /**
   * Vérifie si une traduction existe
   * @param {string} key Clé de traduction
   * @param {string} lang Langue (optionnel)
   * @returns {boolean}
   */
  hasTranslation(key, lang = this.currentLang) {
    return Boolean(this.getTranslation(key, lang));
  }

  /**
   * Obtient toutes les clés manquantes pour une langue
   * @param {string} lang Code de langue
   * @returns {string[]}
   */
  getMissingKeys(lang) {
    const baseLang = CONFIG.LANGUAGES.DEFAULT;
    const baseKeys = Object.keys(this.translations[baseLang] || {});
    const langKeys = Object.keys(this.translations[lang] || {});
    
    return baseKeys.filter(key => !langKeys.includes(key));
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie les event listeners des boutons
    const langButtons = DOMUtils.selectAll(CONFIG.SELECTORS.LANG_BUTTONS);
    langButtons.forEach(button => {
      DOMUtils.cleanupEventListeners(button);
    });
    
    this.initialized = false;
    featureLogger.debug('LanguageManager destroyed');
  }

  /**
   * Obtient les statistiques de traduction
   * @returns {Object}
   */
  getStats() {
    const stats = {};
    
    CONFIG.LANGUAGES.SUPPORTED.forEach(lang => {
      const translations = this.translations[lang] || {};
      stats[lang] = {
        totalKeys: Object.keys(translations).length,
        missingKeys: this.getMissingKeys(lang),
        completeness: Object.keys(translations).length / Object.keys(this.translations[CONFIG.LANGUAGES.DEFAULT] || {}).length * 100
      };
    });
    
    return {
      currentLanguage: this.currentLang,
      supportedLanguages: CONFIG.LANGUAGES.SUPPORTED,
      languages: stats
    };
  }
}

// Instance singleton
let languageManager = null;

/**
 * Obtient l'instance du gestionnaire de langue
 * @returns {LanguageManager}
 */
export function getLanguageManager() {
  if (!languageManager) {
    languageManager = new LanguageManager();
  }
  return languageManager;
}

/**
 * Initialise le gestionnaire de langue
 * @returns {Promise<LanguageManager>}
 */
export async function initLanguageManager() {
  const manager = getLanguageManager();
  await manager.init();
  return manager;
}

export default { LanguageManager, getLanguageManager, initLanguageManager };