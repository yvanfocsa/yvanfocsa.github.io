/**
 * Module de gestion du header
 * @fileoverview Gère les effets du header (ombre au scroll, sticky, etc.)
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class HeaderManager {
  constructor() {
    this.header = null;
    this.topbar = null;
    this.lastScrollY = 0;
    this.scrollThreshold = 10;
    this.initialized = false;
    this.isScrollingDown = false;
    this.isHeaderVisible = true;
    
    uiLogger.debug('HeaderManager created');
  }

  /**
   * Initialise le gestionnaire de header
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('HeaderManager already initialized');
      return;
    }

    try {
      uiLogger.time('HeaderManager initialization');
      
      // Trouve les éléments DOM
      this.header = DOMUtils.select(CONFIG.SELECTORS.HEADER);
      this.topbar = DOMUtils.select(CONFIG.SELECTORS.TOPBAR);
      
      if (!this.header) {
        uiLogger.warn('Header element not found');
        return;
      }
      
      // Configure les effets de scroll
      this.setupScrollEffects();
      
      // Configure les interactions
      this.setupInteractions();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      // Applique l'état initial
      this.updateHeaderState();
      
      this.initialized = true;
      uiLogger.timeEnd('HeaderManager initialization');
      uiLogger.success('HeaderManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize HeaderManager', error);
      throw error;
    }
  }

  /**
   * Configure les effets de scroll
   */
  setupScrollEffects() {
    // Throttle le scroll pour les performances
    const throttledScroll = PerformanceUtils.throttle(() => {
      this.handleScroll();
    }, CONFIG.SCROLL_THROTTLE);

    // Utilise passive scroll listener pour les performances
    PerformanceUtils.addPassiveScrollListener(window, throttledScroll);

    uiLogger.debug('Header scroll effects configured');
  }

  /**
   * Configure les interactions
   */
  setupInteractions() {
    // Gestion du hover sur les éléments de navigation
    const navLinks = DOMUtils.selectAll('nav.primary a', this.header);
    
    navLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'mouseenter', () => {
        this.handleNavHover(link, true);
      });
      
      DOMUtils.addEventListenerWithCleanup(link, 'mouseleave', () => {
        this.handleNavHover(link, false);
      });
    });

    // Gestion du focus pour l'accessibilité
    navLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'focus', () => {
        this.handleNavFocus(link, true);
      });
      
      DOMUtils.addEventListenerWithCleanup(link, 'blur', () => {
        this.handleNavFocus(link, false);
      });
    });

    uiLogger.debug('Header interactions configured');
  }

  /**
   * Gère le scroll de la page
   */
  handleScroll() {
    const currentScrollY = window.scrollY;
    const scrollDirection = currentScrollY > this.lastScrollY ? 'down' : 'up';
    const scrollDelta = Math.abs(currentScrollY - this.lastScrollY);

    // Met à jour l'état du scroll
    stateManager.setState('scrollY', currentScrollY);

    // Applique l'ombre selon la position de scroll
    this.updateScrollShadow(currentScrollY);

    // Gère l'affichage/masquage du header (optionnel)
    if (scrollDelta > this.scrollThreshold) {
      this.updateHeaderVisibility(scrollDirection, currentScrollY);
    }

    // Optimise les animations selon le scroll
    this.optimizeForScroll(currentScrollY);

    this.lastScrollY = currentScrollY;
  }

  /**
   * Met à jour l'ombre de scroll
   * @param {number} scrollY Position de scroll
   */
  updateScrollShadow(scrollY) {
    const hasScrolled = scrollY > 0;
    
    if (hasScrolled) {
      this.header.classList.add('scrolled');
      
      // Calcule l'intensité de l'ombre selon la position
      const shadowIntensity = Math.min(scrollY / 100, 1);
      this.header.style.setProperty('--scroll-shadow-opacity', shadowIntensity);
    } else {
      this.header.classList.remove('scrolled');
      this.header.style.removeProperty('--scroll-shadow-opacity');
    }

    uiLogger.debug('Header shadow updated', { scrollY, hasScrolled });
  }

  /**
   * Met à jour la visibilité du header selon le scroll
   * @param {string} direction Direction du scroll
   * @param {number} scrollY Position de scroll
   */
  updateHeaderVisibility(direction, scrollY) {
    const shouldHide = direction === 'down' && scrollY > 200;
    const shouldShow = direction === 'up' || scrollY <= 100;

    if (shouldHide && this.isHeaderVisible) {
      this.hideHeader();
    } else if (shouldShow && !this.isHeaderVisible) {
      this.showHeader();
    }
  }

  /**
   * Masque le header avec animation
   */
  hideHeader() {
    this.header.classList.add('header-hidden');
    this.isHeaderVisible = false;
    
    uiLogger.debug('Header hidden');
  }

  /**
   * Affiche le header avec animation
   */
  showHeader() {
    this.header.classList.remove('header-hidden');
    this.isHeaderVisible = true;
    
    uiLogger.debug('Header shown');
  }

  /**
   * Optimise les performances selon le scroll
   * @param {number} scrollY Position de scroll
   */
  optimizeForScroll(scrollY) {
    // Réduit les animations coûteuses pendant le scroll rapide
    if (Math.abs(scrollY - this.lastScrollY) > 50) {
      document.body.classList.add('fast-scrolling');
      
      // Retire la classe après un délai
      clearTimeout(this.fastScrollTimeout);
      this.fastScrollTimeout = setTimeout(() => {
        document.body.classList.remove('fast-scrolling');
      }, 150);
    }
  }

  /**
   * Gère le hover sur les liens de navigation
   * @param {Element} link Lien de navigation
   * @param {boolean} isHover État de hover
   */
  handleNavHover(link, isHover) {
    if (isHover) {
      link.classList.add('nav-hover');
    } else {
      link.classList.remove('nav-hover');
    }
  }

  /**
   * Gère le focus sur les liens de navigation
   * @param {Element} link Lien de navigation
   * @param {boolean} hasFocus État de focus
   */
  handleNavFocus(link, hasFocus) {
    if (hasFocus) {
      link.classList.add('nav-focus');
      // S'assure que le header est visible lors du focus
      this.showHeader();
    } else {
      link.classList.remove('nav-focus');
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de viewport
    stateManager.subscribe('isMobile', (isMobile) => {
      this.updateForViewport(isMobile);
    });

    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', () => {
      // Recalcule les dimensions après changement de langue
      setTimeout(() => {
        this.updateHeaderState();
      }, 100);
    });

    // Écoute l'ouverture du drawer
    stateManager.subscribe('drawerOpen', (isOpen) => {
      this.updateForDrawer(isOpen);
    });
  }

  /**
   * Met à jour pour le viewport mobile/desktop
   * @param {boolean} isMobile Vue mobile active
   */
  updateForViewport(isMobile) {
    if (isMobile) {
      this.header.classList.add('mobile-view');
      // Force l'affichage du header sur mobile
      this.showHeader();
    } else {
      this.header.classList.remove('mobile-view');
    }

    uiLogger.debug('Header updated for viewport', { isMobile });
  }

  /**
   * Met à jour pour l'ouverture/fermeture du drawer
   * @param {boolean} isDrawerOpen Drawer ouvert
   */
  updateForDrawer(isDrawerOpen) {
    if (isDrawerOpen) {
      this.header.classList.add('drawer-open');
    } else {
      this.header.classList.remove('drawer-open');
    }

    uiLogger.debug('Header updated for drawer', { isDrawerOpen });
  }

  /**
   * Met à jour l'état général du header
   */
  updateHeaderState() {
    // Recalcule les dimensions
    const headerHeight = this.header.offsetHeight;
    const topbarHeight = this.topbar ? this.topbar.offsetHeight : 0;
    const totalHeight = headerHeight + topbarHeight;

    // Met à jour les propriétés CSS custom
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
    document.documentElement.style.setProperty('--topbar-height', `${topbarHeight}px`);
    document.documentElement.style.setProperty('--total-header-height', `${totalHeight}px`);

    uiLogger.debug('Header state updated', {
      headerHeight,
      topbarHeight,
      totalHeight
    });
  }

  /**
   * Ajoute un élément au header
   * @param {string} selector Sélecteur de la zone cible
   * @param {Element|string} element Élément ou HTML à ajouter
   */
  addElement(selector, element) {
    const container = DOMUtils.select(selector, this.header);
    if (container) {
      if (typeof element === 'string') {
        container.insertAdjacentHTML('beforeend', element);
      } else {
        container.appendChild(element);
      }
      this.updateHeaderState();
      uiLogger.debug('Element added to header');
    }
  }

  /**
   * Supprime un élément du header
   * @param {string} selector Sélecteur de l'élément à supprimer
   */
  removeElement(selector) {
    const element = DOMUtils.select(selector, this.header);
    if (element) {
      element.remove();
      this.updateHeaderState();
      uiLogger.debug('Element removed from header');
    }
  }

  /**
   * Anime l'apparition du header
   * @returns {Promise<void>}
   */
  async animateIn() {
    this.header.style.transform = 'translateY(-100%)';
    this.header.style.opacity = '0';
    
    return new Promise((resolve) => {
      PerformanceUtils.raf(() => {
        this.header.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        this.header.style.transform = 'translateY(0)';
        this.header.style.opacity = '1';
        
        setTimeout(() => {
          this.header.style.transition = '';
          resolve();
        }, 300);
      });
    });
  }

  /**
   * Anime la disparition du header
   * @returns {Promise<void>}
   */
  async animateOut() {
    return new Promise((resolve) => {
      this.header.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      this.header.style.transform = 'translateY(-100%)';
      this.header.style.opacity = '0';
      
      setTimeout(() => {
        this.header.style.transition = '';
        resolve();
      }, 300);
    });
  }

  /**
   * Réinitialise les animations du header
   */
  resetAnimations() {
    this.header.style.transform = '';
    this.header.style.opacity = '';
    this.header.style.transition = '';
    
    uiLogger.debug('Header animations reset');
  }

  /**
   * Active/désactive le mode sticky
   * @param {boolean} sticky Mode sticky actif
   */
  setSticky(sticky) {
    if (sticky) {
      this.header.classList.add('sticky');
    } else {
      this.header.classList.remove('sticky');
    }

    uiLogger.debug('Header sticky mode set', { sticky });
  }

  /**
   * Obtient la hauteur totale du header
   * @returns {number}
   */
  getTotalHeight() {
    const headerHeight = this.header.offsetHeight;
    const topbarHeight = this.topbar ? this.topbar.offsetHeight : 0;
    return headerHeight + topbarHeight;
  }

  /**
   * Obtient la position de scroll pour dépasser le header
   * @returns {number}
   */
  getScrollThreshold() {
    return this.getTotalHeight();
  }

  /**
   * Vérifie si le header est visible
   * @returns {boolean}
   */
  isVisible() {
    return this.isHeaderVisible;
  }

  /**
   * Force l'affichage du header
   */
  forceShow() {
    this.showHeader();
    this.header.classList.add('force-visible');
    
    setTimeout(() => {
      this.header.classList.remove('force-visible');
    }, 1000);
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie les timeouts
    if (this.fastScrollTimeout) {
      clearTimeout(this.fastScrollTimeout);
    }

    // Reset les styles
    this.resetAnimations();
    
    // Nettoie les classes
    this.header.classList.remove('scrolled', 'header-hidden', 'mobile-view', 'drawer-open');
    document.body.classList.remove('fast-scrolling');
    
    // Reset les propriétés CSS
    document.documentElement.style.removeProperty('--header-height');
    document.documentElement.style.removeProperty('--topbar-height');
    document.documentElement.style.removeProperty('--total-header-height');
    
    this.initialized = false;
    uiLogger.debug('HeaderManager destroyed');
  }

  /**
   * Obtient les statistiques du header
   * @returns {Object}
   */
  getStats() {
    return {
      isVisible: this.isHeaderVisible,
      isScrolled: this.header.classList.contains('scrolled'),
      isMobile: this.header.classList.contains('mobile-view'),
      totalHeight: this.getTotalHeight(),
      lastScrollY: this.lastScrollY,
      initialized: this.initialized
    };
  }
}

// Instance singleton
let headerManager = null;

/**
 * Obtient l'instance du gestionnaire de header
 * @returns {HeaderManager}
 */
export function getHeaderManager() {
  if (!headerManager) {
    headerManager = new HeaderManager();
  }
  return headerManager;
}

/**
 * Initialise le gestionnaire de header
 * @returns {Promise<HeaderManager>}
 */
export async function initHeaderManager() {
  const manager = getHeaderManager();
  await manager.init();
  return manager;
}

export default { HeaderManager, getHeaderManager, initHeaderManager };