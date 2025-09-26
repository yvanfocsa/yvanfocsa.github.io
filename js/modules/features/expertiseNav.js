/**
 * Module de navigation entre les expertises
 * @fileoverview Gère la navigation cyclique entre les pages d'expertise
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class ExpertiseNavigationManager {
  constructor() {
    this.currentPageUrl = '';
    this.currentIndex = -1;
    this.navigationContainer = null;
    this.initialized = false;
    
    featureLogger.debug('ExpertiseNavigationManager created');
  }

  /**
   * Initialise le gestionnaire de navigation expertise
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('ExpertiseNavigationManager already initialized');
      return;
    }

    try {
      featureLogger.time('ExpertiseNavigationManager initialization');
      
      // Détermine si on est sur une page d'expertise
      this.currentPageUrl = this.getCurrentPageUrl();
      this.currentIndex = this.findCurrentExpertiseIndex();
      
      if (this.currentIndex === -1) {
        featureLogger.debug('Not on an expertise page');
        return;
      }
      
      // Trouve le titre principal de la page
      const pageTitle = this.findPageTitle();
      
      if (!pageTitle) {
        featureLogger.warn('Page title not found for expertise navigation');
        return;
      }
      
      // Crée la navigation
      this.createNavigationControls(pageTitle);
      
      // Configure les interactions
      this.setupNavigationInteractions();
      
      // Configure l'accessibilité
      this.setupAccessibility();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('ExpertiseNavigationManager initialization');
      featureLogger.success('ExpertiseNavigationManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize ExpertiseNavigationManager', error);
      throw error;
    }
  }

  /**
   * Obtient l'URL de la page actuelle
   * @returns {string}
   */
  getCurrentPageUrl() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /**
   * Trouve l'index de l'expertise actuelle
   * @returns {number}
   */
  findCurrentExpertiseIndex() {
    return CONFIG.EXPERTISE_PAGES.findIndex(
      expertise => expertise.url === this.currentPageUrl
    );
  }

  /**
   * Trouve le titre principal de la page
   * @returns {Element|null}
   */
  findPageTitle() {
    // Cherche le h1 dans la première section du main
    const mainElement = DOMUtils.select('main#contenu');
    if (!mainElement) return null;

    const firstSection = DOMUtils.select('.section', mainElement);
    if (!firstSection) return null;

    return DOMUtils.select('h1', firstSection);
  }

  /**
   * Crée les contrôles de navigation
   * @param {Element} pageTitle Titre de la page
   */
  createNavigationControls(pageTitle) {
    // Calcule les indices précédent et suivant (navigation cyclique)
    const prevIndex = (this.currentIndex - 1 + CONFIG.EXPERTISE_PAGES.length) % CONFIG.EXPERTISE_PAGES.length;
    const nextIndex = (this.currentIndex + 1) % CONFIG.EXPERTISE_PAGES.length;
    
    const prevExpertise = CONFIG.EXPERTISE_PAGES[prevIndex];
    const nextExpertise = CONFIG.EXPERTISE_PAGES[nextIndex];

    // Crée le conteneur de navigation
    this.navigationContainer = DOMUtils.createElement('div', {
      className: 'title-with-nav',
      role: 'navigation',
      'aria-label': 'Navigation entre expertises'
    });

    // Bouton précédent
    const prevButton = this.createNavigationButton(prevExpertise, 'prev');
    
    // Clone le titre
    const clonedTitle = pageTitle.cloneNode(true);
    
    // Bouton suivant
    const nextButton = this.createNavigationButton(nextExpertise, 'next');

    // Assemble la navigation
    this.navigationContainer.appendChild(prevButton);
    this.navigationContainer.appendChild(clonedTitle);
    this.navigationContainer.appendChild(nextButton);

    // Remplace le titre original
    pageTitle.replaceWith(this.navigationContainer);

    featureLogger.debug('Navigation controls created', {
      prev: prevExpertise.title,
      current: CONFIG.EXPERTISE_PAGES[this.currentIndex].title,
      next: nextExpertise.title
    });
  }

  /**
   * Crée un bouton de navigation
   * @param {Object} expertise Données de l'expertise
   * @param {string} direction Direction (prev/next)
   * @returns {Element}
   */
  createNavigationButton(expertise, direction) {
    const button = DOMUtils.createElement('a', {
      href: expertise.url,
      className: `nav-arrow ${direction}-arrow`,
      'aria-label': `${direction === 'prev' ? 'Expertise précédente' : 'Expertise suivante'}: ${expertise.title}`,
      title: expertise.title
    });

    // Ajoute l'icône de flèche
    const arrow = DOMUtils.createElement('span', {
      className: 'arrow',
      'aria-hidden': 'true'
    });

    button.appendChild(arrow);

    return button;
  }

  /**
   * Configure les interactions de navigation
   */
  setupNavigationInteractions() {
    if (!this.navigationContainer) return;

    const navButtons = DOMUtils.selectAll('.nav-arrow', this.navigationContainer);

    navButtons.forEach(button => {
      // Ajoute l'effet de hover
      DOMUtils.addEventListenerWithCleanup(button, 'mouseenter', () => {
        button.classList.add('hover');
      });

      DOMUtils.addEventListenerWithCleanup(button, 'mouseleave', () => {
        button.classList.remove('hover');
      });

      // Support clavier
      DOMUtils.addEventListenerWithCleanup(button, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
      });

      // Analytics et tracking
      DOMUtils.addEventListenerWithCleanup(button, 'click', (e) => {
        const direction = button.classList.contains('prev-arrow') ? 'previous' : 'next';
        const targetUrl = button.href;
        
        // Dispatch event pour analytics
        window.dispatchEvent(new CustomEvent('expertise-navigation', {
          detail: {
            direction,
            from: this.currentPageUrl,
            to: targetUrl,
            fromIndex: this.currentIndex,
            toIndex: direction === 'previous' ? 
              (this.currentIndex - 1 + CONFIG.EXPERTISE_PAGES.length) % CONFIG.EXPERTISE_PAGES.length :
              (this.currentIndex + 1) % CONFIG.EXPERTISE_PAGES.length
          }
        }));

        featureLogger.info('Expertise navigation clicked', { direction, targetUrl });
      });
    });

    featureLogger.debug('Navigation interactions configured');
  }

  /**
   * Configure l'accessibilité
   */
  setupAccessibility() {
    if (!this.navigationContainer) return;

    // Ajoute un titre masqué pour les lecteurs d'écran
    const srTitle = DOMUtils.createElement('h2', {
      className: 'sr-only'
    }, 'Navigation entre les expertises');

    this.navigationContainer.insertBefore(srTitle, this.navigationContainer.firstChild);

    // Configure les relations ARIA
    const prevButton = DOMUtils.select('.prev-arrow', this.navigationContainer);
    const nextButton = DOMUtils.select('.next-arrow', this.navigationContainer);

    if (prevButton && nextButton) {
      // Groupe les boutons pour l'accessibilité
      prevButton.setAttribute('role', 'button');
      nextButton.setAttribute('role', 'button');
      
      // Relations avec le titre
      const title = DOMUtils.select('h1', this.navigationContainer);
      if (title) {
        const titleId = title.id || 'expertise-title';
        title.id = titleId;
        
        prevButton.setAttribute('aria-describedby', titleId);
        nextButton.setAttribute('aria-describedby', titleId);
      }
    }

    featureLogger.debug('Expertise navigation accessibility configured');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de page
    stateManager.subscribe('currentPage', (newPage) => {
      // Vérifie si on est toujours sur une page d'expertise
      const newIndex = CONFIG.EXPERTISE_PAGES.findIndex(exp => exp.url === newPage);
      
      if (newIndex !== -1 && newIndex !== this.currentIndex) {
        // Page d'expertise changée, met à jour la navigation
        this.currentPageUrl = newPage;
        this.currentIndex = newIndex;
        this.updateNavigationControls();
      }
    });
  }

  /**
   * Met à jour les contrôles de navigation
   */
  updateNavigationControls() {
    if (!this.navigationContainer) return;

    // Recalcule les indices
    const prevIndex = (this.currentIndex - 1 + CONFIG.EXPERTISE_PAGES.length) % CONFIG.EXPERTISE_PAGES.length;
    const nextIndex = (this.currentIndex + 1) % CONFIG.EXPERTISE_PAGES.length;
    
    const prevExpertise = CONFIG.EXPERTISE_PAGES[prevIndex];
    const nextExpertise = CONFIG.EXPERTISE_PAGES[nextIndex];

    // Met à jour les boutons
    const prevButton = DOMUtils.select('.prev-arrow', this.navigationContainer);
    const nextButton = DOMUtils.select('.next-arrow', this.navigationContainer);

    if (prevButton) {
      prevButton.href = prevExpertise.url;
      prevButton.setAttribute('aria-label', `Expertise précédente: ${prevExpertise.title}`);
      prevButton.title = prevExpertise.title;
    }

    if (nextButton) {
      nextButton.href = nextExpertise.url;
      nextButton.setAttribute('aria-label', `Expertise suivante: ${nextExpertise.title}`);
      nextButton.title = nextExpertise.title;
    }

    featureLogger.debug('Navigation controls updated');
  }

  /**
   * Navigue vers l'expertise précédente
   */
  gotoPrevious() {
    const prevIndex = (this.currentIndex - 1 + CONFIG.EXPERTISE_PAGES.length) % CONFIG.EXPERTISE_PAGES.length;
    const prevExpertise = CONFIG.EXPERTISE_PAGES[prevIndex];
    
    window.location.href = prevExpertise.url;
  }

  /**
   * Navigue vers l'expertise suivante
   */
  gotoNext() {
    const nextIndex = (this.currentIndex + 1) % CONFIG.EXPERTISE_PAGES.length;
    const nextExpertise = CONFIG.EXPERTISE_PAGES[nextIndex];
    
    window.location.href = nextExpertise.url;
  }

  /**
   * Obtient l'expertise actuelle
   * @returns {Object|null}
   */
  getCurrentExpertise() {
    return this.currentIndex >= 0 ? CONFIG.EXPERTISE_PAGES[this.currentIndex] : null;
  }

  /**
   * Obtient l'expertise précédente
   * @returns {Object}
   */
  getPreviousExpertise() {
    const prevIndex = (this.currentIndex - 1 + CONFIG.EXPERTISE_PAGES.length) % CONFIG.EXPERTISE_PAGES.length;
    return CONFIG.EXPERTISE_PAGES[prevIndex];
  }

  /**
   * Obtient l'expertise suivante
   * @returns {Object}
   */
  getNextExpertise() {
    const nextIndex = (this.currentIndex + 1) % CONFIG.EXPERTISE_PAGES.length;
    return CONFIG.EXPERTISE_PAGES[nextIndex];
  }

  /**
   * Ajoute une nouvelle expertise à la navigation
   * @param {Object} expertise Nouvelle expertise
   * @param {number} index Position d'insertion
   */
  addExpertise(expertise, index = -1) {
    if (index === -1) {
      CONFIG.EXPERTISE_PAGES.push(expertise);
    } else {
      CONFIG.EXPERTISE_PAGES.splice(index, 0, expertise);
    }

    // Recalcule les indices si nécessaire
    if (index <= this.currentIndex) {
      this.currentIndex++;
    }

    this.updateNavigationControls();

    featureLogger.debug('Expertise added to navigation', expertise);
  }

  /**
   * Supprime une expertise de la navigation
   * @param {string} url URL de l'expertise à supprimer
   */
  removeExpertise(url) {
    const index = CONFIG.EXPERTISE_PAGES.findIndex(exp => exp.url === url);
    
    if (index === -1) {
      featureLogger.warn('Expertise not found for removal', url);
      return;
    }

    CONFIG.EXPERTISE_PAGES.splice(index, 1);

    // Recalcule les indices
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      // Page actuelle supprimée, redirige vers l'accueil
      window.location.href = './';
      return;
    }

    this.updateNavigationControls();

    featureLogger.debug('Expertise removed from navigation', url);
  }

  /**
   * Précharge les expertises adjacentes
   */
  preloadAdjacentExpertises() {
    const prevExpertise = this.getPreviousExpertise();
    const nextExpertise = this.getNextExpertise();

    // Crée les liens de préchargement
    [prevExpertise, nextExpertise].forEach(expertise => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = expertise.url;
      document.head.appendChild(link);
    });

    featureLogger.debug('Adjacent expertises preloaded');
  }

  /**
   * Configure la navigation par touches fléchées
   */
  setupKeyboardShortcuts() {
    DOMUtils.addEventListenerWithCleanup(document, 'keydown', (e) => {
      // Ignore si dans un champ de saisie
      if (e.target.matches('input, textarea, select')) {
        return;
      }

      // Ignore si drawer ouvert
      if (stateManager.getState('drawerOpen')) {
        return;
      }

      // Navigation par flèches
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.gotoPrevious();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.gotoNext();
            break;
        }
      }
    });

    featureLogger.debug('Keyboard shortcuts configured');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', () => {
      // Met à jour les labels de navigation
      this.updateNavigationLabels();
    });
  }

  /**
   * Met à jour les labels de navigation selon la langue
   */
  updateNavigationLabels() {
    if (!this.navigationContainer) return;

    const prevButton = DOMUtils.select('.prev-arrow', this.navigationContainer);
    const nextButton = DOMUtils.select('.next-arrow', this.navigationContainer);
    
    if (prevButton) {
      const prevExpertise = this.getPreviousExpertise();
      prevButton.setAttribute('aria-label', `Expertise précédente: ${prevExpertise.title}`);
    }

    if (nextButton) {
      const nextExpertise = this.getNextExpertise();
      nextButton.setAttribute('aria-label', `Expertise suivante: ${nextExpertise.title}`);
    }

    featureLogger.debug('Navigation labels updated for language');
  }

  /**
   * Obtient le breadcrumb de l'expertise actuelle
   * @returns {Array}
   */
  getBreadcrumb() {
    if (this.currentIndex === -1) return [];

    const currentExpertise = CONFIG.EXPERTISE_PAGES[this.currentIndex];
    
    return [
      { name: 'Accueil', url: './' },
      { name: 'Expertises', url: 'expertises.html' },
      { name: currentExpertise.title, url: currentExpertise.url, current: true }
    ];
  }

  /**
   * Crée un breadcrumb visuel
   * @returns {Element}
   */
  createBreadcrumb() {
    const breadcrumb = this.getBreadcrumb();
    
    const nav = DOMUtils.createElement('nav', {
      className: 'breadcrumb',
      'aria-label': 'Fil d\'ariane'
    });

    const ol = DOMUtils.createElement('ol', {
      className: 'breadcrumb-list'
    });

    breadcrumb.forEach((item, index) => {
      const li = DOMUtils.createElement('li', {
        className: 'breadcrumb-item'
      });

      if (item.current) {
        li.setAttribute('aria-current', 'page');
        li.textContent = item.name;
      } else {
        const link = DOMUtils.createElement('a', {
          href: item.url
        }, item.name);
        li.appendChild(link);
      }

      ol.appendChild(li);

      // Ajoute un séparateur sauf pour le dernier
      if (index < breadcrumb.length - 1) {
        const separator = DOMUtils.createElement('span', {
          className: 'breadcrumb-separator',
          'aria-hidden': 'true'
        }, ' / ');
        ol.appendChild(separator);
      }
    });

    nav.appendChild(ol);
    return nav;
  }

  /**
   * Obtient la progression dans les expertises
   * @returns {Object}
   */
  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: CONFIG.EXPERTISE_PAGES.length,
      percentage: Math.round(((this.currentIndex + 1) / CONFIG.EXPERTISE_PAGES.length) * 100)
    };
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie les event listeners
    if (this.navigationContainer) {
      DOMUtils.cleanupEventListeners(this.navigationContainer);
    }

    // Reset les propriétés
    this.currentPageUrl = '';
    this.currentIndex = -1;
    this.navigationContainer = null;
    this.initialized = false;

    featureLogger.debug('ExpertiseNavigationManager destroyed');
  }

  /**
   * Obtient les statistiques de navigation
   * @returns {Object}
   */
  getStats() {
    return {
      currentPage: this.currentPageUrl,
      currentIndex: this.currentIndex,
      totalExpertises: CONFIG.EXPERTISE_PAGES.length,
      progress: this.getProgress(),
      hasNavigation: Boolean(this.navigationContainer),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let expertiseNavigationManager = null;

/**
 * Obtient l'instance du gestionnaire de navigation expertise
 * @returns {ExpertiseNavigationManager}
 */
export function getExpertiseNavigationManager() {
  if (!expertiseNavigationManager) {
    expertiseNavigationManager = new ExpertiseNavigationManager();
  }
  return expertiseNavigationManager;
}

/**
 * Initialise le gestionnaire de navigation expertise
 * @returns {Promise<ExpertiseNavigationManager>}
 */
export async function initExpertiseNavigationManager() {
  const manager = getExpertiseNavigationManager();
  await manager.init();
  return manager;
}

export default { 
  ExpertiseNavigationManager, 
  getExpertiseNavigationManager, 
  initExpertiseNavigationManager 
};