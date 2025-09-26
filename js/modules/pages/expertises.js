/**
 * Module spécifique à la page des expertises
 * @fileoverview Gère les fonctionnalités spécifiques de expertises.html
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class ExpertisesPageManager {
  constructor() {
    this.expertisesGrid = null;
    this.filterButtons = null;
    this.searchInput = null;
    this.expertiseCards = [];
    this.activeFilter = 'all';
    this.initialized = false;
    
    featureLogger.debug('ExpertisesPageManager created');
  }

  /**
   * Initialise le gestionnaire de la page des expertises
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('ExpertisesPageManager already initialized');
      return;
    }

    try {
      featureLogger.time('ExpertisesPageManager initialization');
      
      // Trouve les éléments de la page
      this.expertisesGrid = DOMUtils.select('.competences-grid');
      this.filterButtons = DOMUtils.selectAll('.poles .pole');
      this.searchInput = DOMUtils.select('.expertise-search input');
      
      if (!this.expertisesGrid && this.filterButtons.length === 0) {
        featureLogger.debug('No expertise elements found');
        return;
      }
      
      // Collecte les cartes d'expertise
      this.collectExpertiseCards();
      
      // Configure les filtres par pôles
      if (this.filterButtons.length > 0) {
        this.setupPoleFiltering();
      }
      
      // Configure la recherche si présente
      if (this.searchInput) {
        this.setupExpertiseSearch();
      }
      
      // Configure les interactions avec les cartes
      this.setupCardInteractions();
      
      // Configure l'état initial
      this.applyInitialState();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('ExpertisesPageManager initialization');
      featureLogger.success('ExpertisesPageManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize ExpertisesPageManager', error);
      throw error;
    }
  }

  /**
   * Collecte toutes les cartes d'expertise
   */
  collectExpertiseCards() {
    const cardElements = DOMUtils.selectAll('.competence-card, .competence-card--large');
    
    this.expertiseCards = cardElements.map(element => {
      const title = this.extractText(element, 'h3');
      const description = this.extractText(element, 'p');
      const href = element.href || element.querySelector('a')?.href;
      
      // Détermine le pôle depuis le href
      const pole = this.determinePoleFromUrl(href);
      
      return {
        element,
        title: title.toLowerCase(),
        description: description.toLowerCase(),
        href,
        pole,
        searchableText: `${title} ${description}`.toLowerCase(),
        visible: true
      };
    });

    featureLogger.debug(`Collected ${this.expertiseCards.length} expertise cards`);
  }

  /**
   * Extrait le texte d'un élément
   * @param {Element} container Conteneur parent
   * @param {string} selector Sélecteur
   * @returns {string}
   */
  extractText(container, selector) {
    const element = DOMUtils.select(selector, container);
    return element ? element.textContent.trim() : '';
  }

  /**
   * Détermine le pôle depuis l'URL
   * @param {string} url URL de l'expertise
   * @returns {string}
   */
  determinePoleFromUrl(url) {
    if (!url) return 'all';

    const poleAPages = [
      'expertise-droit-immobilier.html',
      'expertise-droit-de-la-construction.html',
      'expertise-droit-de-la-copropriete.html'
    ];

    const poleBPages = [
      'expertise-contentieux-civil-commercial.html',
      'expertise-droit-famille.html',
      'expertise-vente-forcee.html'
    ];

    const filename = url.split('/').pop();
    
    if (poleAPages.includes(filename)) {
      return 'poleA';
    } else if (poleBPages.includes(filename)) {
      return 'poleB';
    }
    
    return 'all';
  }

  /**
   * Configure le filtrage par pôles
   */
  setupPoleFiltering() {
    // Délégation d'événements pour les boutons de pôles
    const polesContainer = DOMUtils.select('.poles');
    
    if (polesContainer) {
      PerformanceUtils.delegateEvent(
        polesContainer,
        '.pole',
        'click',
        (e) => {
          e.preventDefault();
          const target = e.target.dataset.target;
          this.switchToPole(target);
        }
      );
    }

    // Support clavier
    this.filterButtons.forEach(button => {
      DOMUtils.addEventListenerWithCleanup(button, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
        // Navigation par flèches entre les pôles
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.navigateBetweenPoles(e.key === 'ArrowRight');
        }
      });
    });

    featureLogger.debug('Pole filtering configured');
  }

  /**
   * Bascule vers un pôle d'expertise
   * @param {string} poleTarget Cible du pôle (#poleA ou #poleB)
   */
  switchToPole(poleTarget) {
    if (!poleTarget) return;

    const poleId = poleTarget.replace('#', '');
    this.activeFilter = poleId;

    // Met à jour les boutons
    this.updatePoleButtons(poleTarget);
    
    // Met à jour les carrousels associés
    this.updatePoleCarousels(poleTarget);
    
    // Filtre les cartes si on est sur une grille
    if (this.expertisesGrid) {
      this.filterCardsByPole(poleId);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('expertise-pole-switched', {
      detail: { pole: poleId, target: poleTarget }
    }));

    featureLogger.info('Switched to expertise pole', { pole: poleId });
  }

  /**
   * Met à jour les boutons de pôles
   * @param {string} activeTarget Pôle actif
   */
  updatePoleButtons(activeTarget) {
    this.filterButtons.forEach(button => {
      const isActive = button.dataset.target === activeTarget;
      
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive.toString());
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  /**
   * Met à jour les carrousels de pôles
   * @param {string} activeTarget Pôle actif
   */
  updatePoleCarousels(activeTarget) {
    const allCarousels = DOMUtils.selectAll('.carousel-shell');
    
    allCarousels.forEach(carousel => {
      const isTarget = carousel.id === activeTarget.replace('#', '');
      
      carousel.hidden = !isTarget;
      carousel.setAttribute('aria-hidden', (!isTarget).toString());
      
      if (isTarget) {
        // Active le carrousel
        this.activateCarousel(carousel);
      }
    });
  }

  /**
   * Filtre les cartes par pôle
   * @param {string} pole Pôle sélectionné
   */
  filterCardsByPole(pole) {
    this.expertiseCards.forEach(card => {
      const shouldShow = pole === 'all' || card.pole === pole;
      card.visible = shouldShow;
      
      if (shouldShow) {
        this.showExpertiseCard(card.element);
      } else {
        this.hideExpertiseCard(card.element);
      }
    });

    const visibleCount = this.expertiseCards.filter(card => card.visible).length;
    featureLogger.debug('Cards filtered by pole', { pole, visibleCount });
  }

  /**
   * Active un carrousel
   * @param {Element} carousel Carrousel à activer
   */
  activateCarousel(carousel) {
    if (this.activeCarousels.has(carousel)) return;

    // Marque comme actif
    this.activeCarousels.add(carousel);
    
    // Peut déclencher l'initialisation du carrousel si lazy loading
    window.dispatchEvent(new CustomEvent('carousel-activate-requested', {
      detail: { carousel }
    }));

    featureLogger.debug('Carousel activated', carousel);
  }

  /**
   * Configure la recherche d'expertise
   */
  setupExpertiseSearch() {
    const debouncedSearch = PerformanceUtils.debounce((term) => {
      this.performExpertiseSearch(term);
    }, 300);

    DOMUtils.addEventListenerWithCleanup(this.searchInput, 'input', (e) => {
      const searchTerm = e.target.value.trim();
      debouncedSearch(searchTerm);
    });

    // Support pour la touche Échap
    DOMUtils.addEventListenerWithCleanup(this.searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this.performExpertiseSearch('');
      }
    });

    featureLogger.debug('Expertise search configured');
  }

  /**
   * Effectue une recherche d'expertise
   * @param {string} term Terme de recherche
   */
  performExpertiseSearch(term) {
    const searchTerm = term.toLowerCase();
    
    this.expertiseCards.forEach(card => {
      const matchesSearch = !searchTerm || card.searchableText.includes(searchTerm);
      const matchesFilter = this.activeFilter === 'all' || card.pole === this.activeFilter;
      
      const shouldShow = matchesSearch && matchesFilter;
      card.visible = shouldShow;
      
      if (shouldShow) {
        this.showExpertiseCard(card.element);
      } else {
        this.hideExpertiseCard(card.element);
      }
    });

    const visibleCount = this.expertiseCards.filter(card => card.visible).length;
    
    // Met à jour le compteur de résultats
    this.updateSearchResults(visibleCount, term);

    featureLogger.info('Expertise search performed', { term, visibleCount });
  }

  /**
   * Affiche une carte d'expertise
   * @param {Element} card Carte à afficher
   */
  showExpertiseCard(card) {
    card.style.display = '';
    card.classList.remove('hidden');
    
    // Animation d'apparition
    PerformanceUtils.raf(() => {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    });
  }

  /**
   * Masque une carte d'expertise
   * @param {Element} card Carte à masquer
   */
  hideExpertiseCard(card) {
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      card.style.display = 'none';
      card.classList.add('hidden');
    }, 300);
  }

  /**
   * Met à jour les résultats de recherche
   * @param {number} count Nombre de résultats
   * @param {string} term Terme recherché
   */
  updateSearchResults(count, term) {
    let resultsElement = DOMUtils.select('.search-results-count');
    
    if (!resultsElement) {
      resultsElement = DOMUtils.createElement('div', {
        className: 'search-results-count',
        style: 'text-align: center; margin: 20px 0; color: var(--muted);'
      });
      
      if (this.expertisesGrid) {
        this.expertisesGrid.insertAdjacentElement('beforebegin', resultsElement);
      }
    }

    if (term) {
      if (count === 0) {
        resultsElement.textContent = `Aucun résultat pour "${term}"`;
      } else {
        resultsElement.textContent = `${count} expertise${count > 1 ? 's' : ''} trouvée${count > 1 ? 's' : ''} pour "${term}"`;
      }
    } else {
      resultsElement.textContent = '';
    }
  }

  /**
   * Configure les interactions avec les cartes
   */
  setupCardInteractions() {
    this.expertiseCards.forEach(card => {
      // Analytics pour les clics sur les expertises
      DOMUtils.addEventListenerWithCleanup(card.element, 'click', (e) => {
        const expertiseTitle = this.extractText(card.element, 'h3');
        
        window.dispatchEvent(new CustomEvent('expertise-card-clicked', {
          detail: { 
            title: expertiseTitle,
            pole: card.pole,
            url: card.href
          }
        }));

        featureLogger.info('Expertise card clicked', { 
          title: expertiseTitle,
          pole: card.pole 
        });
      });

      // Effets visuels améliorés
      DOMUtils.addEventListenerWithCleanup(card.element, 'mouseenter', () => {
        card.element.classList.add('card-hover');
        this.previewExpertise(card);
      });

      DOMUtils.addEventListenerWithCleanup(card.element, 'mouseleave', () => {
        card.element.classList.remove('card-hover');
        this.hideExpertisePreview();
      });

      // Support du focus pour l'accessibilité
      DOMUtils.addEventListenerWithCleanup(card.element, 'focus', () => {
        this.previewExpertise(card);
      });

      DOMUtils.addEventListenerWithCleanup(card.element, 'blur', () => {
        this.hideExpertisePreview();
      });
    });

    featureLogger.debug('Card interactions configured');
  }

  /**
   * Prévisualise une expertise au survol
   * @param {Object} cardData Données de la carte
   */
  previewExpertise(cardData) {
    // Peut afficher une prévisualisation, des statistiques, etc.
    const preview = this.createExpertisePreview(cardData);
    
    if (preview) {
      this.showPreview(preview);
    }
  }

  /**
   * Crée une prévisualisation d'expertise
   * @param {Object} cardData Données de la carte
   * @returns {Element|null}
   */
  createExpertisePreview(cardData) {
    // Exemple de prévisualisation simple
    const preview = DOMUtils.createElement('div', {
      className: 'expertise-preview',
      style: `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 16px;
        box-shadow: var(--shadow);
        max-width: 300px;
        z-index: 1000;
      `
    }, `
      <h4 style="margin: 0 0 8px; color: var(--brand);">${cardData.title}</h4>
      <p style="margin: 0; color: var(--muted); font-size: 0.9rem;">Cliquez pour en savoir plus</p>
    `);

    return preview;
  }

  /**
   * Affiche une prévisualisation
   * @param {Element} preview Élément de prévisualisation
   */
  showPreview(preview) {
    // Retire l'ancienne prévisualisation
    this.hideExpertisePreview();
    
    document.body.appendChild(preview);
    
    // Animation d'apparition
    PerformanceUtils.raf(() => {
      preview.style.opacity = '1';
      preview.style.transform = 'translateY(0)';
    });

    // Stocke pour nettoyage
    this.currentPreview = preview;
  }

  /**
   * Masque la prévisualisation
   */
  hideExpertisePreview() {
    if (this.currentPreview) {
      this.currentPreview.remove();
      this.currentPreview = null;
    }
  }

  /**
   * Navigue entre les pôles par clavier
   * @param {boolean} forward Direction
   */
  navigateBetweenPoles(forward) {
    const activeButton = DOMUtils.select('.pole.active');
    const allButtons = DOMUtils.selectAll('.pole');
    
    if (!activeButton || allButtons.length === 0) return;

    const currentIndex = allButtons.indexOf(activeButton);
    let newIndex;

    if (forward) {
      newIndex = (currentIndex + 1) % allButtons.length;
    } else {
      newIndex = (currentIndex - 1 + allButtons.length) % allButtons.length;
    }

    const newButton = allButtons[newIndex];
    newButton.click();
    newButton.focus();

    featureLogger.debug('Navigated between poles', { forward, newIndex });
  }

  /**
   * Applique l'état initial de la page
   */
  applyInitialState() {
    // Vérifie les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const poleParam = urlParams.get('pole');
    const searchParam = urlParams.get('search');

    if (poleParam) {
      this.switchToPole(`#${poleParam}`);
    }

    if (searchParam && this.searchInput) {
      this.searchInput.value = searchParam;
      this.performExpertiseSearch(searchParam);
    }

    // Active le premier pôle par défaut si aucun paramètre
    if (!poleParam && this.filterButtons.length > 0) {
      const firstButton = this.filterButtons[0];
      if (firstButton.dataset.target) {
        this.switchToPole(firstButton.dataset.target);
      }
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', () => {
      // Recollecte les cartes après changement de langue
      setTimeout(() => {
        this.collectExpertiseCards();
        this.applyCurrentFilters();
      }, 100);
    });

    // Écoute les changements de viewport
    stateManager.subscribe('isMobile', (isMobile) => {
      this.updateForMobile(isMobile);
    });
  }

  /**
   * Réapplique les filtres actuels
   */
  applyCurrentFilters() {
    if (this.activeFilter !== 'all') {
      this.filterCardsByPole(this.activeFilter);
    }

    if (this.searchInput && this.searchInput.value) {
      this.performExpertiseSearch(this.searchInput.value);
    }
  }

  /**
   * Met à jour pour la vue mobile
   * @param {boolean} isMobile Vue mobile active
   */
  updateForMobile(isMobile) {
    if (isMobile) {
      // Ajustements spécifiques pour mobile
      this.optimizeForMobile();
    } else {
      // Ajustements pour desktop
      this.optimizeForDesktop();
    }

    featureLogger.debug('Updated for mobile', { isMobile });
  }

  /**
   * Optimise pour la vue mobile
   */
  optimizeForMobile() {
    // Masque les prévisualisations sur mobile
    this.hideExpertisePreview();
    
    // Simplifie les interactions
    document.body.classList.add('mobile-expertise-view');
  }

  /**
   * Optimise pour la vue desktop
   */
  optimizeForDesktop() {
    document.body.classList.remove('mobile-expertise-view');
  }

  /**
   * Obtient les statistiques de navigation des expertises
   * @returns {Object}
   */
  getNavigationStats() {
    return {
      totalExpertises: this.expertiseCards.length,
      visibleExpertises: this.expertiseCards.filter(c => c.visible).length,
      activePole: this.activeFilter,
      mostViewedPole: this.getMostViewedPole()
    };
  }

  /**
   * Obtient le pôle le plus consulté
   * @returns {string}
   */
  getMostViewedPole() {
    // Simplifié - dans un vrai projet, on trackrait ces données
    return 'poleA';
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Masque les prévisualisations
    this.hideExpertisePreview();
    
    // Nettoie les cartes actives
    this.activeCarousels.clear();
    
    // Reset les filtres
    this.activeFilter = 'all';
    
    // Nettoie les classes CSS
    document.body.classList.remove('mobile-expertise-view');

    this.initialized = false;
    featureLogger.debug('ExpertisesPageManager destroyed');
  }

  /**
   * Obtient les statistiques de la page expertises
   * @returns {Object}
   */
  getStats() {
    return {
      expertiseCards: this.expertiseCards.length,
      activeFilter: this.activeFilter,
      activeCarousels: this.activeCarousels.size,
      hasSearch: Boolean(this.searchInput),
      hasGrid: Boolean(this.expertisesGrid),
      navigationStats: this.getNavigationStats(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let expertisesPageManager = null;

/**
 * Obtient l'instance du gestionnaire de page expertises
 * @returns {ExpertisesPageManager}
 */
export function getExpertisesPageManager() {
  if (!expertisesPageManager) {
    expertisesPageManager = new ExpertisesPageManager();
  }
  return expertisesPageManager;
}

/**
 * Initialise le gestionnaire de page expertises
 * @returns {Promise<ExpertisesPageManager>}
 */
export async function initExpertisesPageManager() {
  const manager = getExpertisesPageManager();
  await manager.init();
  return manager;
}

export default { ExpertisesPageManager, getExpertisesPageManager, initExpertisesPageManager };