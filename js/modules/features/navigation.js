/**
 * Module de gestion de la navigation
 * @fileoverview Gère la navigation active, les transitions de page et les liens
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class NavigationManager {
  constructor() {
    this.currentPage = '';
    this.navigationLinks = [];
    this.initialized = false;
    this.transitionInProgress = false;
    
    featureLogger.debug('NavigationManager created');
  }

  /**
   * Initialise le gestionnaire de navigation
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('NavigationManager already initialized');
      return;
    }

    try {
      featureLogger.time('NavigationManager initialization');
      
      // Détermine la page actuelle
      this.currentPage = this.getCurrentPage();
      stateManager.setState('currentPage', this.currentPage);
      
      // Collecte les liens de navigation
      this.collectNavigationLinks();
      
      // Configure les liens actifs
      this.setupActiveLinks();
      
      // Configure les transitions de page
      this.setupPageTransitions();
      
      // Configure la navigation au clavier
      this.setupKeyboardNavigation();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('NavigationManager initialization');
      featureLogger.success('NavigationManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize NavigationManager', error);
      throw error;
    }
  }

  /**
   * Détermine la page actuelle
   * @returns {string}
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    // Normalise les noms de pages
    const normalizedPage = page === '' ? 'index.html' : page;
    
    featureLogger.debug('Current page determined', { path, page: normalizedPage });
    return normalizedPage;
  }

  /**
   * Collecte tous les liens de navigation
   */
  collectNavigationLinks() {
    // Liens de navigation principale
    const primaryNavLinks = DOMUtils.selectAll('nav.primary a');
    
    // Liens du footer
    const footerLinks = DOMUtils.selectAll('.footer a[href]');
    
    // Liens du drawer mobile
    const drawerLinks = DOMUtils.selectAll('.drawer-nav a');
    
    this.navigationLinks = [
      ...primaryNavLinks.map(link => ({ element: link, type: 'primary' })),
      ...footerLinks.map(link => ({ element: link, type: 'footer' })),
      ...drawerLinks.map(link => ({ element: link, type: 'drawer' }))
    ];

    featureLogger.debug(`Collected ${this.navigationLinks.length} navigation links`);
  }

  /**
   * Configure les liens actifs
   */
  setupActiveLinks() {
    this.navigationLinks.forEach(({ element, type }) => {
      const href = element.getAttribute('href');
      if (!href) return;

      // Détermine la page cible
      const targetPage = this.extractPageFromHref(href);
      
      // Vérifie si c'est la page actuelle
      const isActive = this.isCurrentPage(targetPage);
      
      // Applique l'état actif
      this.setLinkActive(element, isActive);
      
      featureLogger.debug('Link configured', { 
        href, 
        targetPage, 
        isActive, 
        type 
      });
    });
  }

  /**
   * Extrait la page d'un href
   * @param {string} href Lien href
   * @returns {string}
   */
  extractPageFromHref(href) {
    // Gère les différents formats de liens
    if (href.startsWith('#')) return this.currentPage;
    if (href.startsWith('http')) return null; // Lien externe
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return null;
    
    // Extrait le nom de fichier
    const parts = href.split('/');
    const filename = parts[parts.length - 1];
    
    // Gère les cas spéciaux
    if (filename === '' || filename === './' || filename === './') {
      return 'index.html';
    }
    
    return filename.split('#')[0] || 'index.html';
  }

  /**
   * Vérifie si une page est la page actuelle
   * @param {string} targetPage Page cible
   * @returns {boolean}
   */
  isCurrentPage(targetPage) {
    if (!targetPage) return false;
    
    // Normalise les comparaisons
    const current = this.currentPage.toLowerCase();
    const target = targetPage.toLowerCase();
    
    return current === target || 
           (current === 'index.html' && target === '') ||
           (current === '' && target === 'index.html');
  }

  /**
   * Définit l'état actif d'un lien
   * @param {Element} link Élément lien
   * @param {boolean} isActive État actif
   */
  setLinkActive(link, isActive) {
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
    
    // Ajoute attributs d'accessibilité
    if (isActive) {
      link.setAttribute('aria-label', `${link.textContent} (page actuelle)`);
    } else {
      link.removeAttribute('aria-label');
    }
  }

  /**
   * Configure les transitions de page
   */
  setupPageTransitions() {
    // Retire l'état de fade-out au chargement
    document.body.classList.remove('page-fade-out');

    // Délégation d'événements pour tous les liens internes
    PerformanceUtils.delegateEvent(
      document.body,
      'a[href]:not([target="_blank"]):not([href^="mailto:"]):not([href^="tel:"]):not([href^="http"])',
      'click',
      (e) => {
        this.handleLinkClick(e);
      }
    );

    // Gestion du bouton retour/avant du navigateur
    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });

    featureLogger.debug('Page transitions configured');
  }

  /**
   * Gère le clic sur un lien
   * @param {Event} e Événement de clic
   */
  handleLinkClick(e) {
    const link = e.target.closest('a');
    const href = link.getAttribute('href');
    
    // Ignore certains liens
    if (!href || 
        href.startsWith('#') || 
        href.startsWith('mailto:') || 
        href.startsWith('tel:') ||
        href.startsWith('http') ||
        link.hasAttribute('download')) {
      return;
    }

    // Ignore si transition en cours
    if (this.transitionInProgress) {
      e.preventDefault();
      return;
    }

    // Lance la transition
    e.preventDefault();
    this.navigateWithTransition(href);
  }

  /**
   * Navigue avec transition
   * @param {string} href URL de destination
   */
  async navigateWithTransition(href) {
    if (this.transitionInProgress) {
      featureLogger.debug('Transition already in progress');
      return;
    }

    try {
      this.transitionInProgress = true;
      
      featureLogger.info('Starting page transition', { href });
      
      // Ajoute l'effet de fade out
      document.body.classList.add('page-fade-out');
      
      // Attend la durée de la transition
      await new Promise(resolve => {
        setTimeout(resolve, CONFIG.PAGE_FADE_DURATION);
      });
      
      // Navigue vers la nouvelle page
      window.location.href = href;
      
    } catch (error) {
      featureLogger.error('Page transition failed', error);
      
      // Reset en cas d'erreur
      document.body.classList.remove('page-fade-out');
      this.transitionInProgress = false;
    }
  }

  /**
   * Gère la navigation par historique
   * @param {PopStateEvent} e Événement popstate
   */
  handlePopState(e) {
    // Met à jour la page actuelle
    const newPage = this.getCurrentPage();
    
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      stateManager.setState('currentPage', newPage);
      
      // Met à jour les liens actifs
      this.setupActiveLinks();
      
      featureLogger.info('Page changed via history', { newPage });
    }
  }

  /**
   * Configure la navigation au clavier
   */
  setupKeyboardNavigation() {
    // Navigation rapide par touches
    DOMUtils.addEventListenerWithCleanup(document, 'keydown', (e) => {
      // Ignore si dans un champ de saisie
      if (e.target.matches('input, textarea, select')) {
        return;
      }

      // Ignore si drawer ouvert
      if (stateManager.getState('drawerOpen')) {
        return;
      }

      // Raccourcis clavier
      if (e.altKey) {
        switch (e.key) {
          case 'h':
            e.preventDefault();
            this.navigateWithTransition('./');
            break;
          case 'c':
            e.preventDefault();
            this.navigateWithTransition('contact.html');
            break;
          case 'e':
            e.preventDefault();
            this.navigateWithTransition('expertises.html');
            break;
          case 'b':
            e.preventDefault();
            this.navigateWithTransition('blog.html');
            break;
        }
      }
    });

    featureLogger.debug('Keyboard navigation configured');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de page
    stateManager.subscribe('currentPage', (newPage) => {
      if (newPage !== this.currentPage) {
        this.currentPage = newPage;
        this.setupActiveLinks();
      }
    });

    // Écoute les changements de langue pour les aria-labels
    stateManager.subscribe('currentLanguage', () => {
      this.updateAriaLabels();
    });
  }

  /**
   * Met à jour les aria-labels selon la langue
   */
  updateAriaLabels() {
    // Ici on pourrait mettre à jour les aria-labels selon la langue
    // Pour le moment, on garde les labels en français
  }

  /**
   * Navigue vers une page spécifique
   * @param {string} page Nom de la page
   */
  navigateTo(page) {
    const href = page === 'index.html' ? './' : page;
    this.navigateWithTransition(href);
  }

  /**
   * Retourne à la page précédente
   */
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigateTo('index.html');
    }
  }

  /**
   * Recharge la page actuelle
   */
  reload() {
    window.location.reload();
  }

  /**
   * Obtient l'historique de navigation
   * @returns {Array}
   */
  getNavigationHistory() {
    // Simplifié car l'API History est limitée
    return {
      canGoBack: window.history.length > 1,
      currentPage: this.currentPage
    };
  }

  /**
   * Précharge une page
   * @param {string} href URL à précharger
   */
  preloadPage(href) {
    // Crée un lien de préchargement
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);

    featureLogger.debug('Page preloaded', { href });
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Reset l'état de transition
    this.transitionInProgress = false;
    document.body.classList.remove('page-fade-out');
    
    // Reset les liens actifs
    this.navigationLinks.forEach(({ element }) => {
      element.classList.remove('active');
      element.removeAttribute('aria-current');
      element.removeAttribute('aria-label');
    });

    this.navigationLinks = [];
    this.initialized = false;

    featureLogger.debug('NavigationManager destroyed');
  }

  /**
   * Obtient les statistiques de navigation
   * @returns {Object}
   */
  getStats() {
    return {
      currentPage: this.currentPage,
      navigationLinks: this.navigationLinks.length,
      transitionInProgress: this.transitionInProgress,
      canGoBack: window.history.length > 1,
      initialized: this.initialized
    };
  }
}

// Instance singleton
let navigationManager = null;

/**
 * Obtient l'instance du gestionnaire de navigation
 * @returns {NavigationManager}
 */
export function getNavigationManager() {
  if (!navigationManager) {
    navigationManager = new NavigationManager();
  }
  return navigationManager;
}

/**
 * Initialise le gestionnaire de navigation
 * @returns {Promise<NavigationManager>}
 */
export async function initNavigationManager() {
  const manager = getNavigationManager();
  await manager.init();
  return manager;
}

export default { NavigationManager, getNavigationManager, initNavigationManager };