/**
 * Module spécifique à la page d'accueil
 * @fileoverview Gère les fonctionnalités spécifiques de index.html
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class HomePageManager {
  constructor() {
    this.heroSection = null;
    this.polesContainer = null;
    this.activeCarousels = new Set();
    this.initialized = false;
    
    featureLogger.debug('HomePageManager created');
  }

  /**
   * Initialise le gestionnaire de la page d'accueil
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('HomePageManager already initialized');
      return;
    }

    try {
      featureLogger.time('HomePageManager initialization');
      
      // Trouve les éléments clés de la page
      this.heroSection = DOMUtils.select(CONFIG.SELECTORS.HERO);
      this.polesContainer = DOMUtils.select('.poles');
      
      // Configure la section hero
      if (this.heroSection) {
        this.setupHeroSection();
      }
      
      // Configure les onglets des pôles d'expertise
      if (this.polesContainer) {
        this.setupPolesNavigation();
      }
      
      // Configure les carrousels spécifiques à l'accueil
      this.setupHomeCarousels();
      
      // Configure l'année dans le footer
      this.setupFooterYear();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('HomePageManager initialization');
      featureLogger.success('HomePageManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize HomePageManager', error);
      throw error;
    }
  }

  /**
   * Configure la section hero
   */
  setupHeroSection() {
    if (!this.heroSection) return;

    // Optimise la hauteur sur mobile
    this.optimizeHeroHeight();
    
    // Configure les boutons CTA
    this.setupHeroCTA();
    
    // Configure les effets de parallaxe (optionnel)
    this.setupHeroParallax();

    featureLogger.debug('Hero section configured');
  }

  /**
   * Optimise la hauteur du hero sur mobile
   */
  optimizeHeroHeight() {
    const updateHeroHeight = () => {
      if (window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE) {
        const header = DOMUtils.select(CONFIG.SELECTORS.HEADER);
        const topbar = DOMUtils.select(CONFIG.SELECTORS.TOPBAR);
        
        if (header && topbar) {
          const headerHeight = header.offsetHeight;
          const topbarHeight = topbar.offsetHeight;
          const totalHeaderHeight = headerHeight + topbarHeight;
          
          this.heroSection.style.minHeight = `calc(${window.innerHeight}px - ${totalHeaderHeight}px)`;
        }
      } else {
        // Reset sur desktop
        this.heroSection.style.minHeight = '';
      }
    };

    // Applique immédiatement
    updateHeroHeight();

    // Écoute les changements de taille
    const debouncedUpdate = PerformanceUtils.debounce(updateHeroHeight, 250);
    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('orientationchange', debouncedUpdate);

    featureLogger.debug('Hero height optimization configured');
  }

  /**
   * Configure les boutons CTA du hero
   */
  setupHeroCTA() {
    const ctaButtons = DOMUtils.selectAll('.cta-row .btn', this.heroSection);
    
    ctaButtons.forEach(button => {
      // Analytics pour les CTA
      DOMUtils.addEventListenerWithCleanup(button, 'click', (e) => {
        const action = button.textContent.trim();
        const href = button.href;
        
        // Dispatch event pour analytics
        window.dispatchEvent(new CustomEvent('hero-cta-clicked', {
          detail: { action, href }
        }));

        featureLogger.info('Hero CTA clicked', { action, href });
      });

      // Effets de hover améliorés
      DOMUtils.addEventListenerWithCleanup(button, 'mouseenter', () => {
        button.classList.add('cta-hover');
      });

      DOMUtils.addEventListenerWithCleanup(button, 'mouseleave', () => {
        button.classList.remove('cta-hover');
      });
    });

    featureLogger.debug('Hero CTA configured');
  }

  /**
   * Configure les effets de parallaxe (optionnel)
   */
  setupHeroParallax() {
    // Vérifie les préférences de mouvement
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      featureLogger.debug('Parallax disabled due to reduced motion preference');
      return;
    }

    // Parallaxe subtil sur l'arrière-plan
    const throttledParallax = PerformanceUtils.throttle(() => {
      const scrollY = window.scrollY;
      const rate = scrollY * 0.5;
      
      this.heroSection.style.transform = `translate3d(0, ${rate}px, 0)`;
    }, 16);

    PerformanceUtils.addPassiveScrollListener(window, throttledParallax);

    featureLogger.debug('Hero parallax configured');
  }

  /**
   * Configure la navigation des pôles d'expertise
   */
  setupPolesNavigation() {
    const poleButtons = DOMUtils.selectAll('.pole', this.polesContainer);
    const carouselShells = DOMUtils.selectAll('.carousel-shell');

    if (poleButtons.length === 0 || carouselShells.length === 0) {
      featureLogger.warn('Poles navigation elements not found');
      return;
    }

    // Délégation d'événements pour les boutons de pôles
    PerformanceUtils.delegateEvent(
      this.polesContainer,
      '.pole',
      'click',
      (e) => {
        e.preventDefault();
        const targetSelector = e.target.dataset.target;
        this.switchPole(targetSelector);
      }
    );

    // Support clavier
    poleButtons.forEach(button => {
      DOMUtils.addEventListenerWithCleanup(button, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
        // Navigation par flèches
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.navigatePoles(e.key === 'ArrowRight');
        }
      });
    });

    featureLogger.debug('Poles navigation configured');
  }

  /**
   * Bascule vers un pôle d'expertise
   * @param {string} targetSelector Sélecteur du pôle cible
   */
  switchPole(targetSelector) {
    if (!targetSelector) return;

    const targetCarousel = DOMUtils.select(targetSelector);
    const allCarousels = DOMUtils.selectAll('.carousel-shell');
    const allButtons = DOMUtils.selectAll('.pole', this.polesContainer);

    if (!targetCarousel) {
      featureLogger.warn('Target carousel not found', targetSelector);
      return;
    }

    // Met à jour les boutons
    allButtons.forEach(button => {
      const isActive = button.dataset.target === targetSelector;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive.toString());
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Met à jour les carrousels
    allCarousels.forEach(carousel => {
      const isTarget = carousel === targetCarousel;
      carousel.hidden = !isTarget;
      carousel.setAttribute('aria-hidden', (!isTarget).toString());
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent('pole-switched', {
      detail: { target: targetSelector }
    }));

    featureLogger.info('Pole switched', { target: targetSelector });
  }

  /**
   * Navigue entre les pôles par clavier
   * @param {boolean} forward Direction de navigation
   */
  navigatePoles(forward) {
    const activeButton = DOMUtils.select('.pole.active', this.polesContainer);
    const allButtons = DOMUtils.selectAll('.pole', this.polesContainer);
    
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

    featureLogger.debug('Poles navigation by keyboard', { forward, newIndex });
  }

  /**
   * Configure les carrousels spécifiques à l'accueil
   */
  setupHomeCarousels() {
    // Carrousel d'avis clients
    this.setupReviewsCarousel();
    
    // Carrousel d'articles
    this.setupArticlesCarousel();
    
    featureLogger.debug('Home carousels configured');
  }

  /**
   * Configure le carrousel d'avis
   */
  setupReviewsCarousel() {
    const reviewsCarousel = DOMUtils.select('#avis [data-carousel]');
    
    if (!reviewsCarousel) {
      featureLogger.debug('Reviews carousel not found');
      return;
    }

    // Auto-rotation des avis (optionnel)
    this.setupAutoRotation(reviewsCarousel, 8000); // 8 secondes

    featureLogger.debug('Reviews carousel configured');
  }

  /**
   * Configure le carrousel d'articles
   */
  setupArticlesCarousel() {
    const articlesSection = DOMUtils.select('.section:has(.blog-card)');
    
    if (!articlesSection) {
      featureLogger.debug('Articles section not found');
      return;
    }

    // Configuration spécifique si nécessaire
    featureLogger.debug('Articles carousel configured');
  }

  /**
   * Configure la rotation automatique d'un carrousel
   * @param {Element} carousel Élément carrousel
   * @param {number} interval Intervalle en ms
   */
  setupAutoRotation(carousel, interval) {
    let rotationTimer = null;
    let isPaused = false;

    const startRotation = () => {
      if (isPaused) return;
      
      rotationTimer = setInterval(() => {
        if (document.hidden || isPaused) return;
        
        const rightArrow = DOMUtils.select('.carousel-arrow.right', carousel);
        if (rightArrow && !rightArrow.disabled) {
          rightArrow.click();
        }
      }, interval);
    };

    const stopRotation = () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
        rotationTimer = null;
      }
    };

    const pauseRotation = () => {
      isPaused = true;
      stopRotation();
    };

    const resumeRotation = () => {
      isPaused = false;
      startRotation();
    };

    // Pause au hover
    DOMUtils.addEventListenerWithCleanup(carousel, 'mouseenter', pauseRotation);
    DOMUtils.addEventListenerWithCleanup(carousel, 'mouseleave', resumeRotation);

    // Pause au focus
    DOMUtils.addEventListenerWithCleanup(carousel, 'focusin', pauseRotation);
    DOMUtils.addEventListenerWithCleanup(carousel, 'focusout', resumeRotation);

    // Pause quand la page n'est pas visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pauseRotation();
      } else {
        resumeRotation();
      }
    });

    // Démarre la rotation
    startRotation();

    // Stocke les contrôles pour nettoyage
    carousel._autoRotation = {
      start: startRotation,
      stop: stopRotation,
      pause: pauseRotation,
      resume: resumeRotation
    };

    featureLogger.debug('Auto-rotation configured', { interval });
  }

  /**
   * Configure l'année dans le footer
   */
  setupFooterYear() {
    const yearElement = DOMUtils.select('#year');
    
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear().toString();
      featureLogger.debug('Footer year updated');
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de viewport pour le hero
    stateManager.subscribe('viewportHeight', () => {
      this.optimizeHeroHeight();
    });

    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', () => {
      // Reconfigure les éléments dépendants de la langue
      setTimeout(() => {
        this.updateLanguageDependentElements();
      }, 100);
    });
  }

  /**
   * Met à jour les éléments dépendants de la langue
   */
  updateLanguageDependentElements() {
    // Met à jour les aria-labels selon la langue
    const ctaButtons = DOMUtils.selectAll('.cta-row .btn', this.heroSection);
    ctaButtons.forEach(button => {
      const href = button.getAttribute('href');
      if (href && href.startsWith('tel:')) {
        button.setAttribute('aria-label', 'Appeler le cabinet');
      }
    });

    featureLogger.debug('Language-dependent elements updated');
  }

  /**
   * Contrôle la rotation automatique des carrousels
   * @param {boolean} enable Activer/désactiver
   */
  toggleAutoRotation(enable) {
    const carouselsWithRotation = DOMUtils.selectAll('[data-carousel]');
    
    carouselsWithRotation.forEach(carousel => {
      if (carousel._autoRotation) {
        if (enable) {
          carousel._autoRotation.resume();
        } else {
          carousel._autoRotation.pause();
        }
      }
    });

    featureLogger.debug('Auto-rotation toggled', { enable });
  }

  /**
   * Met à jour la section de consultation
   */
  updateConsultationSection() {
    const consultationCards = DOMUtils.selectAll('.consultation-card');
    
    consultationCards.forEach(card => {
      // Ajoute des analytics sur les liens de consultation
      const ctaLink = DOMUtils.select('.btn', card);
      
      if (ctaLink) {
        DOMUtils.addEventListenerWithCleanup(ctaLink, 'click', (e) => {
          const consultationType = card.querySelector('h3')?.textContent || 'Unknown';
          
          // Dispatch event pour analytics
          window.dispatchEvent(new CustomEvent('consultation-cta-clicked', {
            detail: { 
              type: consultationType,
              url: ctaLink.href
            }
          }));

          featureLogger.info('Consultation CTA clicked', { type: consultationType });
        });
      }
    });

    featureLogger.debug('Consultation section updated');
  }

  /**
   * Configure les animations spéciales de la page d'accueil
   */
  setupSpecialAnimations() {
    // Animation séquentielle des highlights
    const highlights = DOMUtils.selectAll('.highlight[data-animate]');
    
    highlights.forEach((highlight, index) => {
      // Ajoute un délai progressif
      highlight.dataset.delay = (index * 200).toString();
    });

    // Animation de la citation Svetlana
    const quoteBlock = DOMUtils.select('.svetlana-quote-block[data-animate]');
    if (quoteBlock) {
      quoteBlock.dataset.animate = 'slideUp';
      quoteBlock.dataset.delay = '400';
    }

    featureLogger.debug('Special animations configured');
  }

  /**
   * Gère les interactions avec les cartes d'équipe
   */
  setupTeamCards() {
    const teamCards = DOMUtils.selectAll('.person');
    
    teamCards.forEach(card => {
      // Analytics pour les clics sur l'équipe
      DOMUtils.addEventListenerWithCleanup(card, 'click', (e) => {
        const memberName = card.querySelector('strong')?.textContent || 'Unknown';
        
        // Dispatch event pour analytics
        window.dispatchEvent(new CustomEvent('team-member-clicked', {
          detail: { member: memberName, url: card.href }
        }));

        featureLogger.info('Team member clicked', { member: memberName });
      });

      // Effets visuels améliorés
      DOMUtils.addEventListenerWithCleanup(card, 'mouseenter', () => {
        card.classList.add('team-hover');
      });

      DOMUtils.addEventListenerWithCleanup(card, 'mouseleave', () => {
        card.classList.remove('team-hover');
      });
    });

    featureLogger.debug('Team cards configured');
  }

  /**
   * Optimise les performances pour la page d'accueil
   */
  optimizePerformance() {
    // Lazy load des images non critiques
    const images = DOMUtils.selectAll('img[loading="lazy"]');
    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', () => {
          img.classList.add('loaded');
        }, { once: true });
      }
    });

    // Précharge les pages probablement visitées depuis l'accueil
    const importantLinks = [
      'cabinet.html',
      'expertises.html', 
      'contact.html'
    ];

    // Précharge après un délai pour ne pas ralentir la page actuelle
    setTimeout(() => {
      importantLinks.forEach(page => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = page;
        document.head.appendChild(link);
      });
    }, 3000);

    featureLogger.debug('Performance optimizations applied');
  }

  /**
   * Obtient les métriques de la page d'accueil
   * @returns {Object}
   */
  getPageMetrics() {
    return {
      heroHeight: this.heroSection ? this.heroSection.offsetHeight : 0,
      activeCarousels: this.activeCarousels.size,
      totalSections: DOMUtils.selectAll('.section').length,
      totalCTAs: DOMUtils.selectAll('.btn').length,
      reviewsCount: DOMUtils.selectAll('.review-card').length,
      teamMembersCount: DOMUtils.selectAll('.person').length
    };
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Arrête toutes les rotations automatiques
    const carouselsWithRotation = DOMUtils.selectAll('[data-carousel]');
    carouselsWithRotation.forEach(carousel => {
      if (carousel._autoRotation) {
        carousel._autoRotation.stop();
        delete carousel._autoRotation;
      }
    });

    // Reset les styles du hero
    if (this.heroSection) {
      this.heroSection.style.minHeight = '';
      this.heroSection.style.transform = '';
    }

    // Nettoie les classes ajoutées
    document.body.classList.remove('fast-scrolling');

    this.activeCarousels.clear();
    this.initialized = false;

    featureLogger.debug('HomePageManager destroyed');
  }

  /**
   * Obtient les statistiques de la page d'accueil
   * @returns {Object}
   */
  getStats() {
    return {
      heroConfigured: Boolean(this.heroSection),
      polesConfigured: Boolean(this.polesContainer),
      activeCarousels: this.activeCarousels.size,
      pageMetrics: this.getPageMetrics(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let homePageManager = null;

/**
 * Obtient l'instance du gestionnaire de page d'accueil
 * @returns {HomePageManager}
 */
export function getHomePageManager() {
  if (!homePageManager) {
    homePageManager = new HomePageManager();
  }
  return homePageManager;
}

/**
 * Initialise le gestionnaire de page d'accueil
 * @returns {Promise<HomePageManager>}
 */
export async function initHomePageManager() {
  const manager = getHomePageManager();
  await manager.init();
  return manager;
}

export default { HomePageManager, getHomePageManager, initHomePageManager };