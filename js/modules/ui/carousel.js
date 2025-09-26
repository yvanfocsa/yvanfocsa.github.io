/**
 * Module de gestion des carrousels
 * @fileoverview Gère tous les carrousels du site avec navigation tactile et clavier
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class CarouselManager {
  constructor() {
    this.carousels = new Map();
    this.observer = null;
    this.initialized = false;
    
    uiLogger.debug('CarouselManager created');
  }

  /**
   * Initialise le gestionnaire de carrousels
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('CarouselManager already initialized');
      return;
    }

    try {
      uiLogger.time('CarouselManager initialization');
      
      // Configure l'observateur d'intersection pour lazy loading
      this.setupIntersectionObserver();
      
      // Observe tous les carrousels de la page
      this.observeCarousels();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      uiLogger.timeEnd('CarouselManager initialization');
      uiLogger.success('CarouselManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize CarouselManager', error);
      throw error;
    }
  }

  /**
   * Configure l'observateur d'intersection pour lazy loading
   */
  setupIntersectionObserver() {
    if (!window.IntersectionObserver) {
      uiLogger.warn('IntersectionObserver not supported, initializing all carousels immediately');
      this.initializeAllCarousels();
      return;
    }

    this.observer = PerformanceUtils.createIntersectionObserver(
      (entry, observer) => {
        if (entry.isIntersecting && !this.carousels.has(entry.target)) {
          this.initializeCarousel(entry.target);
        }
      },
      {
        threshold: CONFIG.PERFORMANCE.INTERSECTION_THRESHOLD,
        rootMargin: CONFIG.PERFORMANCE.LAZY_LOAD_MARGIN
      }
    );

    uiLogger.debug('Intersection observer configured for carousels');
  }

  /**
   * Observe tous les carrousels de la page
   */
  observeCarousels() {
    const carouselElements = DOMUtils.selectAll(CONFIG.SELECTORS.CAROUSEL);
    
    if (carouselElements.length === 0) {
      uiLogger.debug('No carousel elements found');
      return;
    }

    carouselElements.forEach(carousel => {
      if (this.observer) {
        this.observer.observe(carousel);
      } else {
        // Fallback si pas d'IntersectionObserver
        this.initializeCarousel(carousel);
      }
    });

    uiLogger.debug(`Found ${carouselElements.length} carousel elements`);
  }

  /**
   * Initialise tous les carrousels immédiatement (fallback)
   */
  initializeAllCarousels() {
    const carouselElements = DOMUtils.selectAll(CONFIG.SELECTORS.CAROUSEL);
    carouselElements.forEach(carousel => {
      this.initializeCarousel(carousel);
    });
  }

  /**
   * Initialise un carrousel spécifique
   * @param {Element} carouselElement Élément carrousel
   */
  initializeCarousel(carouselElement) {
    if (this.carousels.has(carouselElement)) {
      uiLogger.debug('Carousel already initialized', carouselElement);
      return;
    }

    const track = DOMUtils.select('.carousel-track', carouselElement);
    if (!track) {
      uiLogger.warn('Carousel track not found', carouselElement);
      return;
    }

    const leftArrow = DOMUtils.select('.carousel-arrow.left', carouselElement);
    const rightArrow = DOMUtils.select('.carousel-arrow.right', carouselElement);
    const cards = DOMUtils.selectAll('.card, .blog-card, .review-card, .competence-card', track);

    if (cards.length === 0) {
      uiLogger.warn('No cards found in carousel', carouselElement);
      return;
    }

    const carouselData = {
      element: carouselElement,
      track,
      leftArrow,
      rightArrow,
      cards,
      cardWidth: CONFIG.CAROUSEL.CARD_WIDTH,
      gap: CONFIG.CAROUSEL.GAP,
      currentIndex: 0,
      maxIndex: Math.max(0, cards.length - this.getVisibleCards(carouselElement)),
      isScrolling: false
    };

    // Configure la navigation
    this.setupCarouselNavigation(carouselData);
    
    // Configure le support tactile
    this.setupTouchNavigation(carouselData);
    
    // Configure le support clavier
    this.setupKeyboardNavigation(carouselData);
    
    // Configure le scroll snapping
    this.setupScrollSnapping(carouselData);
    
    // Configure le responsive
    this.setupResponsiveHandling(carouselData);

    this.carousels.set(carouselElement, carouselData);
    
    // Met à jour l'état global
    const activeCarousels = stateManager.getState('activeCarousels');
    activeCarousels.add(carouselElement);
    stateManager.setState('activeCarousels', activeCarousels);

    uiLogger.debug('Carousel initialized', {
      cards: cards.length,
      maxIndex: carouselData.maxIndex
    });
  }

  /**
   * Configure la navigation par flèches
   * @param {Object} carouselData Données du carrousel
   */
  setupCarouselNavigation({ element, leftArrow, rightArrow, track, cardWidth, gap }) {
    const scrollDistance = cardWidth + gap;

    if (leftArrow) {
      DOMUtils.addEventListenerWithCleanup(leftArrow, 'click', (e) => {
        e.preventDefault();
        this.scrollCarousel(element, -scrollDistance);
      });

      // Accessibilité
      leftArrow.setAttribute('role', 'button');
      leftArrow.setAttribute('tabindex', '0');
    }

    if (rightArrow) {
      DOMUtils.addEventListenerWithCleanup(rightArrow, 'click', (e) => {
        e.preventDefault();
        this.scrollCarousel(element, scrollDistance);
      });

      // Accessibilité
      rightArrow.setAttribute('role', 'button');
      rightArrow.setAttribute('tabindex', '0');
    }

    uiLogger.debug('Carousel navigation configured');
  }

  /**
   * Configure la navigation tactile
   * @param {Object} carouselData Données du carrousel
   */
  setupTouchNavigation({ track, element }) {
    let startX = 0;
    let scrollLeft = 0;
    let isDown = false;

    // Souris
    DOMUtils.addEventListenerWithCleanup(track, 'mousedown', (e) => {
      isDown = true;
      track.classList.add('dragging');
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      e.preventDefault();
    });

    DOMUtils.addEventListenerWithCleanup(track, 'mouseleave', () => {
      isDown = false;
      track.classList.remove('dragging');
    });

    DOMUtils.addEventListenerWithCleanup(track, 'mouseup', () => {
      isDown = false;
      track.classList.remove('dragging');
    });

    DOMUtils.addEventListenerWithCleanup(track, 'mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 2;
      track.scrollLeft = scrollLeft - walk;
    });

    // Touch
    DOMUtils.addEventListenerWithCleanup(track, 'touchstart', (e) => {
      startX = e.touches[0].pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    }, { passive: true });

    DOMUtils.addEventListenerWithCleanup(track, 'touchmove', (e) => {
      const x = e.touches[0].pageX - track.offsetLeft;
      const walk = (x - startX) * 2;
      track.scrollLeft = scrollLeft - walk;
    }, { passive: true });

    // Gestion du scroll avec throttle
    const throttledScroll = PerformanceUtils.throttle(() => {
      this.updateCarouselState(element);
    }, 16);

    DOMUtils.addEventListenerWithCleanup(track, 'scroll', throttledScroll, { passive: true });

    uiLogger.debug('Touch navigation configured');
  }

  /**
   * Configure la navigation clavier
   * @param {Object} carouselData Données du carrousel
   */
  setupKeyboardNavigation({ element, leftArrow, rightArrow, cardWidth, gap }) {
    const scrollDistance = cardWidth + gap;

    // Navigation sur les flèches
    [leftArrow, rightArrow].forEach(arrow => {
      if (!arrow) return;

      DOMUtils.addEventListenerWithCleanup(arrow, 'keydown', (e) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            arrow.click();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.scrollCarousel(element, -scrollDistance);
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.scrollCarousel(element, scrollDistance);
            break;
        }
      });
    });

    // Navigation sur le conteneur
    DOMUtils.addEventListenerWithCleanup(element, 'keydown', (e) => {
      if (e.target === element || element.contains(e.target)) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.scrollCarousel(element, -scrollDistance);
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.scrollCarousel(element, scrollDistance);
            break;
          case 'Home':
            e.preventDefault();
            this.scrollToStart(element);
            break;
          case 'End':
            e.preventDefault();
            this.scrollToEnd(element);
            break;
        }
      }
    });

    uiLogger.debug('Keyboard navigation configured');
  }

  /**
   * Configure le scroll snapping
   * @param {Object} carouselData Données du carrousel
   */
  setupScrollSnapping({ track }) {
    // Le CSS gère déjà le scroll-snap, on s'assure juste que c'est appliqué
    track.style.scrollSnapType = CONFIG.CAROUSEL.SNAP_TYPE;
    track.style.scrollBehavior = CONFIG.CAROUSEL.SCROLL_BEHAVIOR;

    uiLogger.debug('Scroll snapping configured');
  }

  /**
   * Configure la gestion responsive
   * @param {Object} carouselData Données du carrousel
   */
  setupResponsiveHandling(carouselData) {
    const updateResponsive = PerformanceUtils.debounce(() => {
      this.updateCarouselDimensions(carouselData);
    }, 250);

    window.addEventListener('resize', updateResponsive);

    // Stocke la fonction pour nettoyage
    carouselData.resizeHandler = updateResponsive;

    uiLogger.debug('Responsive handling configured');
  }

  /**
   * Met à jour les dimensions du carrousel
   * @param {Object} carouselData Données du carrousel
   */
  updateCarouselDimensions(carouselData) {
    const { element } = carouselData;
    const visibleCards = this.getVisibleCards(element);
    carouselData.maxIndex = Math.max(0, carouselData.cards.length - visibleCards);
    
    this.updateNavigationState(carouselData);
    
    uiLogger.debug('Carousel dimensions updated', {
      visibleCards,
      maxIndex: carouselData.maxIndex
    });
  }

  /**
   * Calcule le nombre de cartes visibles
   * @param {Element} carouselElement Élément carrousel
   * @returns {number}
   */
  getVisibleCards(carouselElement) {
    const track = DOMUtils.select('.carousel-track', carouselElement);
    if (!track) return 1;

    const trackWidth = track.offsetWidth;
    const cardWidth = CONFIG.CAROUSEL.CARD_WIDTH;
    const gap = CONFIG.CAROUSEL.GAP;

    return Math.floor((trackWidth + gap) / (cardWidth + gap));
  }

  /**
   * Fait défiler le carrousel
   * @param {Element} carouselElement Élément carrousel
   * @param {number} distance Distance de défilement
   */
  scrollCarousel(carouselElement, distance) {
    const carouselData = this.carousels.get(carouselElement);
    if (!carouselData) return;

    const { track } = carouselData;
    
    track.scrollBy({
      left: distance,
      behavior: CONFIG.CAROUSEL.SCROLL_BEHAVIOR
    });

    // Met à jour l'état après un délai pour laisser l'animation se terminer
    setTimeout(() => {
      this.updateCarouselState(carouselElement);
    }, 300);

    uiLogger.debug('Carousel scrolled', { distance });
  }

  /**
   * Va au début du carrousel
   * @param {Element} carouselElement Élément carrousel
   */
  scrollToStart(carouselElement) {
    const carouselData = this.carousels.get(carouselElement);
    if (!carouselData) return;

    const { track } = carouselData;
    
    track.scrollTo({
      left: 0,
      behavior: CONFIG.CAROUSEL.SCROLL_BEHAVIOR
    });

    carouselData.currentIndex = 0;
    this.updateNavigationState(carouselData);

    uiLogger.debug('Carousel scrolled to start');
  }

  /**
   * Va à la fin du carrousel
   * @param {Element} carouselElement Élément carrousel
   */
  scrollToEnd(carouselElement) {
    const carouselData = this.carousels.get(carouselElement);
    if (!carouselData) return;

    const { track } = carouselData;
    
    track.scrollTo({
      left: track.scrollWidth - track.offsetWidth,
      behavior: CONFIG.CAROUSEL.SCROLL_BEHAVIOR
    });

    carouselData.currentIndex = carouselData.maxIndex;
    this.updateNavigationState(carouselData);

    uiLogger.debug('Carousel scrolled to end');
  }

  /**
   * Met à jour l'état du carrousel
   * @param {Element} carouselElement Élément carrousel
   */
  updateCarouselState(carouselElement) {
    const carouselData = this.carousels.get(carouselElement);
    if (!carouselData) return;

    const { track, cardWidth, gap } = carouselData;
    const scrollLeft = track.scrollLeft;
    const currentIndex = Math.round(scrollLeft / (cardWidth + gap));

    carouselData.currentIndex = Math.max(0, Math.min(currentIndex, carouselData.maxIndex));
    
    this.updateNavigationState(carouselData);
    
    // Dispatch event pour autres modules
    window.dispatchEvent(new CustomEvent('carousel-updated', {
      detail: {
        element: carouselElement,
        currentIndex: carouselData.currentIndex,
        maxIndex: carouselData.maxIndex
      }
    }));
  }

  /**
   * Met à jour l'état des boutons de navigation
   * @param {Object} carouselData Données du carrousel
   */
  updateNavigationState({ leftArrow, rightArrow, currentIndex, maxIndex }) {
    if (leftArrow) {
      const isAtStart = currentIndex <= 0;
      leftArrow.disabled = isAtStart;
      leftArrow.setAttribute('aria-disabled', isAtStart.toString());
      leftArrow.style.opacity = isAtStart ? '0.5' : '1';
    }

    if (rightArrow) {
      const isAtEnd = currentIndex >= maxIndex;
      rightArrow.disabled = isAtEnd;
      rightArrow.setAttribute('aria-disabled', isAtEnd.toString());
      rightArrow.style.opacity = isAtEnd ? '0.5' : '1';
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de viewport pour recalculer les dimensions
    stateManager.subscribe('viewportWidth', () => {
      this.carousels.forEach(carouselData => {
        this.updateCarouselDimensions(carouselData);
      });
    });

    // Écoute les changements de langue pour recalculer si nécessaire
    stateManager.subscribe('currentLanguage', () => {
      // Certain carrousels peuvent avoir besoin de recalcul après changement de langue
      setTimeout(() => {
        this.carousels.forEach(carouselData => {
          this.updateCarouselDimensions(carouselData);
        });
      }, 100);
    });
  }

  /**
   * Ajoute un nouveau carrousel dynamiquement
   * @param {Element} carouselElement Nouvel élément carrousel
   */
  addCarousel(carouselElement) {
    if (this.carousels.has(carouselElement)) {
      uiLogger.debug('Carousel already exists');
      return;
    }

    if (this.observer) {
      this.observer.observe(carouselElement);
    } else {
      this.initializeCarousel(carouselElement);
    }

    uiLogger.debug('New carousel added');
  }

  /**
   * Supprime un carrousel
   * @param {Element} carouselElement Élément carrousel à supprimer
   */
  removeCarousel(carouselElement) {
    const carouselData = this.carousels.get(carouselElement);
    if (!carouselData) return;

    // Nettoie les event listeners
    if (carouselData.resizeHandler) {
      window.removeEventListener('resize', carouselData.resizeHandler);
    }

    // Retire de l'observer
    if (this.observer) {
      this.observer.unobserve(carouselElement);
    }

    // Supprime du Map
    this.carousels.delete(carouselElement);

    // Met à jour l'état global
    const activeCarousels = stateManager.getState('activeCarousels');
    activeCarousels.delete(carouselElement);
    stateManager.setState('activeCarousels', activeCarousels);

    uiLogger.debug('Carousel removed');
  }

  /**
   * Rafraîchit tous les carrousels
   */
  refreshAll() {
    this.carousels.forEach(carouselData => {
      this.updateCarouselDimensions(carouselData);
    });

    uiLogger.debug('All carousels refreshed');
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie l'observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Nettoie tous les carrousels
    this.carousels.forEach((carouselData, element) => {
      this.removeCarousel(element);
    });

    this.carousels.clear();
    this.initialized = false;

    uiLogger.debug('CarouselManager destroyed');
  }

  /**
   * Obtient les statistiques des carrousels
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalCarousels: this.carousels.size,
      initialized: this.initialized,
      carousels: []
    };

    this.carousels.forEach((carouselData, element) => {
      stats.carousels.push({
        element: element.id || 'unnamed',
        cards: carouselData.cards.length,
        currentIndex: carouselData.currentIndex,
        maxIndex: carouselData.maxIndex
      });
    });

    return stats;
  }
}

// Instance singleton
let carouselManager = null;

/**
 * Obtient l'instance du gestionnaire de carrousels
 * @returns {CarouselManager}
 */
export function getCarouselManager() {
  if (!carouselManager) {
    carouselManager = new CarouselManager();
  }
  return carouselManager;
}

/**
 * Initialise le gestionnaire de carrousels
 * @returns {Promise<CarouselManager>}
 */
export async function initCarouselManager() {
  const manager = getCarouselManager();
  await manager.init();
  return manager;
}

export default { CarouselManager, getCarouselManager, initCarouselManager };