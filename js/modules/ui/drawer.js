/**
 * Module de gestion du menu mobile (drawer)
 * @fileoverview Gère l'ouverture/fermeture du menu mobile plein écran
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { uiLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class DrawerManager {
  constructor() {
    this.drawer = null;
    this.menuToggle = null;
    this.closeButton = null;
    this.isOpen = false;
    this.initialized = false;
    this.focusableElements = [];
    this.lastFocusedElement = null;
    
    uiLogger.debug('DrawerManager created');
  }

  /**
   * Initialise le gestionnaire de drawer
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      uiLogger.debug('DrawerManager already initialized');
      return;
    }

    try {
      uiLogger.time('DrawerManager initialization');
      
      // Trouve les éléments DOM
      this.drawer = DOMUtils.select(CONFIG.SELECTORS.DRAWER);
      this.menuToggle = DOMUtils.select(CONFIG.SELECTORS.MENU_TOGGLE);
      this.closeButton = DOMUtils.select('.close-menu-btn', this.drawer);
      
      if (!this.drawer || !this.menuToggle) {
        uiLogger.warn('Drawer elements not found');
        return;
      }
      
      // Configure les contrôles
      this.setupControls();
      
      // Configure l'accessibilité
      this.setupAccessibility();
      
      // Configure la gestion du focus
      this.setupFocusManagement();
      
      // Configure les interactions clavier
      this.setupKeyboardInteractions();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      // Configure la fermeture automatique sur resize
      this.setupResponsiveHandling();
      
      this.initialized = true;
      uiLogger.timeEnd('DrawerManager initialization');
      uiLogger.success('DrawerManager initialized');
      
    } catch (error) {
      uiLogger.error('Failed to initialize DrawerManager', error);
      throw error;
    }
  }

  /**
   * Configure les contrôles de base
   */
  setupControls() {
    // Bouton d'ouverture
    DOMUtils.addEventListenerWithCleanup(this.menuToggle, 'click', (e) => {
      e.preventDefault();
      this.toggle();
    });

    // Bouton de fermeture
    if (this.closeButton) {
      DOMUtils.addEventListenerWithCleanup(this.closeButton, 'click', (e) => {
        e.preventDefault();
        this.close();
      });
    }

    // Fermeture en cliquant sur l'overlay
    DOMUtils.addEventListenerWithCleanup(this.drawer, 'click', (e) => {
      if (e.target === this.drawer) {
        this.close();
      }
    });

    // Fermeture par clic sur les liens de navigation
    const navLinks = DOMUtils.selectAll('.drawer-nav a', this.drawer);
    navLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
        // Ferme après un petit délai pour permettre l'animation
        setTimeout(() => this.close(), 150);
      });
    });

    uiLogger.debug('Drawer controls configured');
  }

  /**
   * Configure l'accessibilité
   */
  setupAccessibility() {
    // ARIA attributes pour le menu toggle
    this.menuToggle.setAttribute('aria-controls', 'menu');
    this.menuToggle.setAttribute('aria-expanded', 'false');
    this.menuToggle.setAttribute('aria-haspopup', 'true');

    // ARIA attributes pour le drawer
    this.drawer.setAttribute('role', 'dialog');
    this.drawer.setAttribute('aria-modal', 'true');
    this.drawer.setAttribute('aria-labelledby', 'menu-title');

    // Titre pour l'accessibilité
    const title = DOMUtils.select('.drawer-header .brand', this.drawer);
    if (title) {
      title.id = 'menu-title';
    }

    // Met à jour les éléments focusables
    this.updateFocusableElements();

    uiLogger.debug('Drawer accessibility configured');
  }

  /**
   * Configure la gestion du focus
   */
  setupFocusManagement() {
    // Piège le focus dans le drawer quand il est ouvert
    DOMUtils.addEventListenerWithCleanup(document, 'focusin', (e) => {
      if (this.isOpen && !this.drawer.contains(e.target)) {
        e.preventDefault();
        this.focusFirstElement();
      }
    });

    uiLogger.debug('Focus management configured');
  }

  /**
   * Configure les interactions clavier
   */
  setupKeyboardInteractions() {
    // Gestion des touches globales
    DOMUtils.addEventListenerWithCleanup(document, 'keydown', (e) => {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'Tab':
          this.handleTabNavigation(e);
          break;
      }
    });

    // Navigation par touches sur le menu toggle
    DOMUtils.addEventListenerWithCleanup(this.menuToggle, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    uiLogger.debug('Keyboard interactions configured');
  }

  /**
   * Gère la navigation par Tab dans le drawer
   * @param {KeyboardEvent} e Événement clavier
   */
  handleTabNavigation(e) {
    if (!this.isOpen || this.focusableElements.length === 0) return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      // Tab + Shift (navigation arrière)
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab seul (navigation avant)
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Met à jour la liste des éléments focusables
   */
  updateFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    this.focusableElements = DOMUtils.selectAll(focusableSelectors, this.drawer)
      .filter(el => DOMUtils.isVisible(el));

    uiLogger.debug(`Found ${this.focusableElements.length} focusable elements in drawer`);
  }

  /**
   * Focus sur le premier élément
   */
  focusFirstElement() {
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }
  }

  /**
   * Focus sur le dernier élément
   */
  focusLastElement() {
    if (this.focusableElements.length > 0) {
      this.focusableElements[this.focusableElements.length - 1].focus();
    }
  }

  /**
   * Configure la gestion responsive
   */
  setupResponsiveHandling() {
    // Ferme automatiquement le drawer sur grand écran
    const handleResize = () => {
      if (this.isOpen && window.innerWidth > CONFIG.BREAKPOINTS.MOBILE) {
        this.close();
      }
    };

    window.addEventListener('resize', handleResize);

    uiLogger.debug('Responsive handling configured');
  }

  /**
   * Ouvre le drawer
   * @returns {Promise<void>}
   */
  async open() {
    if (this.isOpen) {
      uiLogger.debug('Drawer already open');
      return;
    }

    try {
      uiLogger.info('Opening drawer');
      
      // Sauvegarde l'élément actuellement focusé
      this.lastFocusedElement = document.activeElement;
      
      // Met à jour l'état
      this.isOpen = true;
      stateManager.setState('drawerOpen', true);
      
      // Applique les effets visuels
      this.applyOpenEffects();
      
      // Gère l'accessibilité
      this.updateAccessibilityForOpen();
      
      // Focus sur le premier élément
      setTimeout(() => {
        this.updateFocusableElements();
        this.focusFirstElement();
      }, 100);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('drawer-opened'));
      
      uiLogger.success('Drawer opened');
      
    } catch (error) {
      uiLogger.error('Failed to open drawer', error);
    }
  }

  /**
   * Ferme le drawer
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.isOpen) {
      uiLogger.debug('Drawer already closed');
      return;
    }

    try {
      uiLogger.info('Closing drawer');
      
      // Met à jour l'état
      this.isOpen = false;
      stateManager.setState('drawerOpen', false);
      
      // Applique les effets visuels
      this.applyCloseEffects();
      
      // Gère l'accessibilité
      this.updateAccessibilityForClose();
      
      // Restaure le focus
      if (this.lastFocusedElement) {
        this.lastFocusedElement.focus();
        this.lastFocusedElement = null;
      }
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('drawer-closed'));
      
      uiLogger.success('Drawer closed');
      
    } catch (error) {
      uiLogger.error('Failed to close drawer', error);
    }
  }

  /**
   * Bascule l'état du drawer
   * @returns {Promise<void>}
   */
  async toggle() {
    if (this.isOpen) {
      await this.close();
    } else {
      await this.open();
    }
  }

  /**
   * Applique les effets visuels d'ouverture
   */
  applyOpenEffects() {
    // Retire l'attribut hidden
    this.drawer.hidden = false;
    
    // Ajoute les classes CSS
    this.drawer.classList.add('is-open');
    document.body.classList.add('drawer-open');
    
    // Applique l'effet de flou sur le contenu principal
    const mainContent = DOMUtils.selectAll('main, .footer, .topbar');
    mainContent.forEach(element => {
      element.classList.add('is-blurred');
    });
    
    // Désactive le scroll du body
    document.body.style.overflow = 'hidden';
    
    uiLogger.debug('Open effects applied');
  }

  /**
   * Applique les effets visuels de fermeture
   */
  applyCloseEffects() {
    // Retire les classes CSS
    this.drawer.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    
    // Retire l'effet de flou
    const mainContent = DOMUtils.selectAll('main, .footer, .topbar');
    mainContent.forEach(element => {
      element.classList.remove('is-blurred');
    });
    
    // Réactive le scroll du body
    document.body.style.overflow = '';
    
    // Ajoute l'attribut hidden après l'animation
    setTimeout(() => {
      if (!this.isOpen) {
        this.drawer.hidden = true;
      }
    }, 350); // Durée de l'animation CSS
    
    uiLogger.debug('Close effects applied');
  }

  /**
   * Met à jour l'accessibilité pour l'ouverture
   */
  updateAccessibilityForOpen() {
    this.menuToggle.setAttribute('aria-expanded', 'true');
    this.drawer.removeAttribute('aria-hidden');
    
    // Masque le contenu principal aux lecteurs d'écran
    const mainContent = DOMUtils.selectAll('main, .footer, .topbar');
    mainContent.forEach(element => {
      element.setAttribute('aria-hidden', 'true');
    });
  }

  /**
   * Met à jour l'accessibilité pour la fermeture
   */
  updateAccessibilityForClose() {
    this.menuToggle.setAttribute('aria-expanded', 'false');
    this.drawer.setAttribute('aria-hidden', 'true');
    
    // Restaure l'accessibilité du contenu principal
    const mainContent = DOMUtils.selectAll('main, .footer, .topbar');
    mainContent.forEach(element => {
      element.removeAttribute('aria-hidden');
    });
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements d'état du drawer
    stateManager.subscribe('drawerOpen', (isOpen) => {
      if (isOpen && !this.isOpen) {
        this.open();
      } else if (!isOpen && this.isOpen) {
        this.close();
      }
    });

    // Ferme automatiquement si on passe en desktop
    stateManager.subscribe('isMobile', (isMobile) => {
      if (!isMobile && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Vérifie si le drawer est ouvert
   * @returns {boolean}
   */
  getIsOpen() {
    return this.isOpen;
  }

  /**
   * Force la fermeture sans animation
   */
  forceClose() {
    this.isOpen = false;
    stateManager.setState('drawerOpen', false);
    
    // Applique immédiatement les styles de fermeture
    this.drawer.classList.remove('is-open');
    this.drawer.hidden = true;
    document.body.classList.remove('drawer-open');
    document.body.style.overflow = '';
    
    // Nettoie les effets
    const mainContent = DOMUtils.selectAll('main, .footer, .topbar');
    mainContent.forEach(element => {
      element.classList.remove('is-blurred');
      element.removeAttribute('aria-hidden');
    });
    
    this.updateAccessibilityForClose();
    
    uiLogger.debug('Drawer force closed');
  }

  /**
   * Met à jour le contenu du drawer
   * @param {string} content Nouveau contenu HTML
   */
  updateContent(content) {
    const navContainer = DOMUtils.select('.drawer-nav', this.drawer);
    if (navContainer) {
      navContainer.innerHTML = content;
      this.updateFocusableElements();
      uiLogger.debug('Drawer content updated');
    }
  }

  /**
   * Ajoute un élément au drawer
   * @param {string} selector Sélecteur de la zone cible
   * @param {Element|string} element Élément ou HTML à ajouter
   */
  addElement(selector, element) {
    const container = DOMUtils.select(selector, this.drawer);
    if (container) {
      if (typeof element === 'string') {
        container.insertAdjacentHTML('beforeend', element);
      } else {
        container.appendChild(element);
      }
      this.updateFocusableElements();
      uiLogger.debug('Element added to drawer');
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Force la fermeture
    this.forceClose();
    
    // Nettoie les event listeners
    if (this.menuToggle) {
      DOMUtils.cleanupEventListeners(this.menuToggle);
    }
    
    if (this.closeButton) {
      DOMUtils.cleanupEventListeners(this.closeButton);
    }
    
    if (this.drawer) {
      DOMUtils.cleanupEventListeners(this.drawer);
    }
    
    // Reset les propriétés
    this.focusableElements = [];
    this.lastFocusedElement = null;
    this.initialized = false;
    
    uiLogger.debug('DrawerManager destroyed');
  }

  /**
   * Obtient les statistiques du drawer
   * @returns {Object}
   */
  getStats() {
    return {
      isOpen: this.isOpen,
      focusableElements: this.focusableElements.length,
      hasCloseButton: Boolean(this.closeButton),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let drawerManager = null;

/**
 * Obtient l'instance du gestionnaire de drawer
 * @returns {DrawerManager}
 */
export function getDrawerManager() {
  if (!drawerManager) {
    drawerManager = new DrawerManager();
  }
  return drawerManager;
}

/**
 * Initialise le gestionnaire de drawer
 * @returns {Promise<DrawerManager>}
 */
export async function initDrawerManager() {
  const manager = getDrawerManager();
  await manager.init();
  return manager;
}

export default { DrawerManager, getDrawerManager, initDrawerManager };