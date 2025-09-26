/**
 * Module de gestion des animations
 * @fileoverview Gère les animations au scroll et les effets visuels
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class AnimationsManager {
  constructor() {
    this.observer = null;
    this.animatedElements = new Set();
    this.initialized = false;
    this.isReducedMotion = false;
    
    uiLogger.debug('AnimationsManager created');
  }

  /**
   * Initialise le gestionnaire d'animations
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('AnimationsManager already initialized');
      return;
    }

    try {
      uiLogger.time('AnimationsManager initialization');
      
      // Vérifie les préférences de mouvement
      this.checkMotionPreferences();
      
      // Configure l'observateur d'intersection
      this.setupIntersectionObserver();
      
      // Observe tous les éléments animables
      this.observeAnimatableElements();
      
      // Configure les animations de page
      this.setupPageAnimations();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      uiLogger.timeEnd('AnimationsManager initialization');
      uiLogger.success('AnimationsManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize AnimationsManager', error);
      throw error;
    }
  }

  /**
   * Vérifie les préférences de mouvement de l'utilisateur
   */
  checkMotionPreferences() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isReducedMotion = mediaQuery.matches;
      
      // Écoute les changements de préférence
      const handleMotionChange = (e) => {
        this.isReducedMotion = e.matches;
        this.updateMotionPreferences();
        uiLogger.debug('Motion preferences changed', { reducedMotion: this.isReducedMotion });
      };
      
      if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMotionChange);
      } else {
        mediaQuery.addEventListener('change', handleMotionChange);
      }
    }

    uiLogger.debug('Motion preferences checked', { reducedMotion: this.isReducedMotion });
  }

  /**
   * Met à jour les préférences de mouvement
   */
  updateMotionPreferences() {
    if (this.isReducedMotion) {
      document.body.classList.add('reduced-motion');
      // Désactive immédiatement toutes les animations en cours
      this.disableAllAnimations();
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }

  /**
   * Configure l'observateur d'intersection
   */
  setupIntersectionObserver() {
    if (!window.IntersectionObserver || this.isReducedMotion) {
      uiLogger.debug('IntersectionObserver not available or reduced motion enabled');
      this.fallbackToImmediateAnimations();
      return;
    }

    this.observer = PerformanceUtils.createIntersectionObserver(
      (entry) => {
        if (entry.isIntersecting) {
          this.animateElement(entry.target);
        }
      },
      {
        threshold: CONFIG.ANIMATION_THRESHOLD,
        rootMargin: '50px 0px -50px 0px'
      }
    );

    uiLogger.debug('Intersection observer configured for animations');
  }

  /**
   * Observe tous les éléments animables
   */
  observeAnimatableElements() {
    const animatableElements = DOMUtils.selectAll('[data-animate]');
    
    if (animatableElements.length === 0) {
      uiLogger.debug('No animatable elements found');
      return;
    }

    animatableElements.forEach(element => {
      if (this.observer) {
        this.observer.observe(element);
      } else {
        // Fallback si pas d'IntersectionObserver
        this.animateElement(element);
      }
    });

    uiLogger.debug(`Found ${animatableElements.length} animatable elements`);
  }

  /**
   * Anime un élément
   * @param {Element} element Élément à animer
   */
  animateElement(element) {
    if (this.animatedElements.has(element)) {
      uiLogger.debug('Element already animated', element);
      return;
    }

    if (this.isReducedMotion) {
      // Animation réduite : apparition immédiate
      element.classList.add('in');
      this.animatedElements.add(element);
      return;
    }

    // Détermine le type d'animation
    const animationType = element.dataset.animate || 'fadeIn';
    const delay = parseInt(element.dataset.delay || '0');
    
    // Applique le délai si spécifié
    if (delay > 0) {
      setTimeout(() => {
        this.executeAnimation(element, animationType);
      }, delay);
    } else {
      this.executeAnimation(element, animationType);
    }

    this.animatedElements.add(element);
    
    // Met à jour l'état global
    const visibleAnimations = stateManager.getState('visibleAnimations');
    visibleAnimations.add(element);
    stateManager.setState('visibleAnimations', visibleAnimations);

    uiLogger.debug('Element animated', { element, type: animationType, delay });
  }

  /**
   * Exécute l'animation sur un élément
   * @param {Element} element Élément à animer
   * @param {string} type Type d'animation
   */
  executeAnimation(element, type) {
    // Retire l'observer pour cet élément
    if (this.observer) {
      this.observer.unobserve(element);
    }

    // Applique l'animation selon le type
    switch (type) {
      case 'fadeIn':
        this.fadeInAnimation(element);
        break;
      case 'slideUp':
        this.slideUpAnimation(element);
        break;
      case 'slideDown':
        this.slideDownAnimation(element);
        break;
      case 'slideLeft':
        this.slideLeftAnimation(element);
        break;
      case 'slideRight':
        this.slideRightAnimation(element);
        break;
      case 'scaleUp':
        this.scaleUpAnimation(element);
        break;
      case 'rotateIn':
        this.rotateInAnimation(element);
        break;
      default:
        this.fadeInAnimation(element);
        break;
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('element-animated', {
      detail: { element, type }
    }));
  }

  /**
   * Animation fade in
   * @param {Element} element
   */
  fadeInAnimation(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.opacity = '';
        element.style.transform = '';
      }, 600);
    });
  }

  /**
   * Animation slide up
   * @param {Element} element
   */
  slideUpAnimation(element) {
    element.style.transform = 'translateY(50px)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Animation slide down
   * @param {Element} element
   */
  slideDownAnimation(element) {
    element.style.transform = 'translateY(-50px)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Animation slide left
   * @param {Element} element
   */
  slideLeftAnimation(element) {
    element.style.transform = 'translateX(50px)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'translateX(0)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Animation slide right
   * @param {Element} element
   */
  slideRightAnimation(element) {
    element.style.transform = 'translateX(-50px)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'translateX(0)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Animation scale up
   * @param {Element} element
   */
  scaleUpAnimation(element) {
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'scale(1)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Animation rotate in
   * @param {Element} element
   */
  rotateInAnimation(element) {
    element.style.transform = 'rotate(-10deg) scale(0.8)';
    element.style.opacity = '0';
    element.classList.add('in');
    
    PerformanceUtils.raf(() => {
      element.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      element.style.transform = 'rotate(0deg) scale(1)';
      element.style.opacity = '1';
      
      setTimeout(() => {
        element.style.transition = '';
        element.style.transform = '';
        element.style.opacity = '';
      }, 600);
    });
  }

  /**
   * Configure les animations de page
   */
  setupPageAnimations() {
    // Animation d'entrée de page
    this.setupPageEnterAnimation();
    
    // Animation de sortie de page
    this.setupPageExitAnimation();
    
    uiLogger.debug('Page animations configured');
  }

  /**
   * Configure l'animation d'entrée de page
   */
  setupPageEnterAnimation() {
    if (this.isReducedMotion) return;

    // Anime les éléments visibles immédiatement
    const immediateElements = DOMUtils.selectAll('[data-animate-immediate]');
    immediateElements.forEach((element, index) => {
      setTimeout(() => {
        this.animateElement(element);
      }, index * 100);
    });
  }

  /**
   * Configure l'animation de sortie de page
   */
  setupPageExitAnimation() {
    if (this.isReducedMotion) return;

    // Gère les transitions de page
    const links = DOMUtils.selectAll('a[href]:not([target="_blank"]):not([href^="mailto:"]):not([href^="tel:"])');
    
    links.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', (e) => {
        const href = link.getAttribute('href');
        
        // Ignore les liens externes et les ancres
        if (href.startsWith('http') || href.startsWith('#')) {
          return;
        }
        
        e.preventDefault();
        this.animatePageExit(() => {
          window.location.href = href;
        });
      });
    });
  }

  /**
   * Anime la sortie de page
   * @param {Function} callback Fonction appelée après l'animation
   */
  animatePageExit(callback) {
    if (this.isReducedMotion) {
      callback();
      return;
    }

    document.body.classList.add('page-fade-out');
    
    setTimeout(() => {
      callback();
    }, CONFIG.PAGE_FADE_DURATION);
  }

  /**
   * Fallback pour affichage immédiat sans animations
   */
  fallbackToImmediateAnimations() {
    const animatableElements = DOMUtils.selectAll('[data-animate]');
    animatableElements.forEach(element => {
      element.classList.add('in');
      this.animatedElements.add(element);
    });

    uiLogger.debug('Fallback to immediate animations applied');
  }

  /**
   * Désactive toutes les animations
   */
  disableAllAnimations() {
    // Ajoute une classe CSS pour désactiver les animations
    document.body.classList.add('no-animations');
    
    // Applique immédiatement l'état final à tous les éléments
    const animatableElements = DOMUtils.selectAll('[data-animate]');
    animatableElements.forEach(element => {
      element.classList.add('in');
      element.style.transition = 'none !important';
      element.style.animation = 'none !important';
    });

    uiLogger.debug('All animations disabled');
  }

  /**
   * Réactive les animations
   */
  enableAllAnimations() {
    document.body.classList.remove('no-animations', 'reduced-motion');
    
    const animatableElements = DOMUtils.selectAll('[data-animate]');
    animatableElements.forEach(element => {
      element.style.transition = '';
      element.style.animation = '';
    });

    uiLogger.debug('All animations enabled');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAnimations();
      } else {
        this.resumeAnimations();
      }
    });
  }

  /**
   * Met en pause les animations
   */
  pauseAnimations() {
    document.body.classList.add('animations-paused');
    uiLogger.debug('Animations paused');
  }

  /**
   * Reprend les animations
   */
  resumeAnimations() {
    document.body.classList.remove('animations-paused');
    uiLogger.debug('Animations resumed');
  }

  /**
   * Ajoute un nouvel élément à animer
   * @param {Element} element Élément à observer
   */
  addElement(element) {
    if (this.animatedElements.has(element)) {
      return;
    }

    if (this.observer) {
      this.observer.observe(element);
    } else {
      this.animateElement(element);
    }

    uiLogger.debug('New element added for animation', element);
  }

  /**
   * Supprime un élément de l'observation
   * @param {Element} element Élément à ne plus observer
   */
  removeElement(element) {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    
    this.animatedElements.delete(element);
    
    const visibleAnimations = stateManager.getState('visibleAnimations');
    visibleAnimations.delete(element);
    stateManager.setState('visibleAnimations', visibleAnimations);

    uiLogger.debug('Element removed from animation', element);
  }

  /**
   * Réinitialise un élément pour réanimation
   * @param {Element} element Élément à réinitialiser
   */
  resetElement(element) {
    element.classList.remove('in');
    element.style.opacity = '';
    element.style.transform = '';
    element.style.transition = '';
    
    this.animatedElements.delete(element);
    
    if (this.observer) {
      this.observer.observe(element);
    }

    uiLogger.debug('Element reset for re-animation', element);
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

    // Nettoie les animations en cours
    this.animatedElements.clear();
    
    // Retire les classes CSS
    document.body.classList.remove(
      'reduced-motion',
      'no-animations',
      'animations-paused',
      'page-fade-out'
    );

    this.initialized = false;
    uiLogger.debug('AnimationsManager destroyed');
  }

  /**
   * Obtient les statistiques des animations
   * @returns {Object}
   */
  getStats() {
    return {
      animatedElements: this.animatedElements.size,
      isReducedMotion: this.isReducedMotion,
      hasObserver: Boolean(this.observer),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let animationsManager = null;

/**
 * Obtient l'instance du gestionnaire d'animations
 * @returns {AnimationsManager}
 */
export function getAnimationsManager() {
  if (!animationsManager) {
    animationsManager = new AnimationsManager();
  }
  return animationsManager;
}

/**
 * Initialise le gestionnaire d'animations
 * @returns {Promise<AnimationsManager>}
 */
export async function initAnimationsManager() {
  const manager = getAnimationsManager();
  await manager.init();
  return manager;
}

export default { AnimationsManager, getAnimationsManager, initAnimationsManager };