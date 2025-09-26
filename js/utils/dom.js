/**
 * Utilitaires pour la manipulation DOM
 * @fileoverview Helpers pour sélection, événements et animations DOM
 */

import { uiLogger } from './logger.js';

export class DOMUtils {
  /**
   * Sélectionne un élément avec gestion d'erreur
   * @param {string} selector Sélecteur CSS
   * @param {Element|Document} context Contexte de recherche
   * @returns {Element|null}
   */
  static select(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (e) {
      uiLogger.warn(`Sélecteur invalide: ${selector}`, e);
      return null;
    }
  }

  /**
   * Sélectionne plusieurs éléments
   * @param {string} selector Sélecteur CSS
   * @param {Element|Document} context Contexte de recherche
   * @returns {Array<Element>}
   */
  static selectAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (e) {
      uiLogger.warn(`Sélecteur invalide: ${selector}`, e);
      return [];
    }
  }

  /**
   * Ajoute un event listener avec nettoyage automatique
   * @param {Element} element Élément cible
   * @param {string} event Type d'événement
   * @param {Function} handler Fonction de gestion
   * @param {Object|boolean} options Options d'événement
   */
  static addEventListenerWithCleanup(element, event, handler, options = {}) {
    if (!element || typeof handler !== 'function') {
      uiLogger.warn('Élément ou handler invalide pour addEventListener');
      return;
    }

    // Nettoie l'ancien listener s'il existe
    const handlerKey = `_${event}Handler`;
    if (element[handlerKey]) {
      element.removeEventListener(event, element[handlerKey], options);
    }
    
    // Ajoute le nouveau
    element[handlerKey] = handler;
    element.addEventListener(event, handler, options);
    
    uiLogger.debug(`Event listener ajouté: ${event}`, element);
  }

  /**
   * Délégation d'événements pour les listes
   * @param {Element} container Conteneur parent
   * @param {string} selector Sélecteur des éléments cibles
   * @param {string} event Type d'événement
   * @param {Function} handler Fonction de gestion
   */
  static delegateEvent(container, selector, event, handler) {
    if (!container) {
      uiLogger.warn('Conteneur manquant pour la délégation d\'événement');
      return;
    }

    this.addEventListenerWithCleanup(container, event, (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    });
  }

  /**
   * Vérifie si un élément est visible
   * @param {Element} element Élément à vérifier
   * @returns {boolean}
   */
  static isVisible(element) {
    if (!element) return false;
    
    return !!(
      element.offsetWidth || 
      element.offsetHeight || 
      element.getClientRects().length
    ) && !element.hidden;
  }

  /**
   * Vérifie si un élément est dans le viewport
   * @param {Element} element Élément à vérifier
   * @param {number} threshold Seuil de visibilité (0-1)
   * @returns {boolean}
   */
  static isInViewport(element, threshold = 0) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    const verticalThreshold = windowHeight * threshold;
    const horizontalThreshold = windowWidth * threshold;
    
    return (
      rect.top >= -verticalThreshold &&
      rect.left >= -horizontalThreshold &&
      rect.bottom <= windowHeight + verticalThreshold &&
      rect.right <= windowWidth + horizontalThreshold
    );
  }

  /**
   * Anime l'apparition d'un élément
   * @param {Element} element Élément à animer
   * @param {number} duration Durée en ms
   * @returns {Promise}
   */
  static fadeIn(element, duration = 300) {
    if (!element) return Promise.resolve();
    
    return new Promise((resolve) => {
      element.style.opacity = '0';
      element.style.display = 'block';
      
      const animation = element.animate([
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration,
        easing: 'ease-out',
        fill: 'forwards'
      });
      
      animation.onfinish = () => {
        element.style.opacity = '';
        element.style.transform = '';
        resolve();
      };
    });
  }

  /**
   * Anime la disparition d'un élément
   * @param {Element} element Élément à animer
   * @param {number} duration Durée en ms
   * @returns {Promise}
   */
  static fadeOut(element, duration = 300) {
    if (!element) return Promise.resolve();
    
    return new Promise((resolve) => {
      const animation = element.animate([
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-10px)' }
      ], {
        duration,
        easing: 'ease-in',
        fill: 'forwards'
      });
      
      animation.onfinish = () => {
        element.style.display = 'none';
        element.style.opacity = '';
        element.style.transform = '';
        resolve();
      };
    });
  }

  /**
   * Ajoute une classe avec animation
   * @param {Element} element Élément cible
   * @param {string} className Classe à ajouter
   * @param {number} delay Délai avant ajout
   */
  static addClassWithDelay(element, className, delay = 0) {
    if (!element) return;
    
    setTimeout(() => {
      element.classList.add(className);
      uiLogger.debug(`Classe ajoutée: ${className}`, element);
    }, delay);
  }

  /**
   * Toggle une classe avec callback
   * @param {Element} element Élément cible
   * @param {string} className Classe à toggler
   * @param {Function} callback Callback appelé après toggle
   * @returns {boolean} Nouvel état de la classe
   */
  static toggleClass(element, className, callback = null) {
    if (!element) return false;
    
    const hasClass = element.classList.toggle(className);
    
    if (typeof callback === 'function') {
      callback(hasClass, element);
    }
    
    uiLogger.debug(`Classe ${hasClass ? 'ajoutée' : 'supprimée'}: ${className}`, element);
    return hasClass;
  }

  /**
   * Scroll fluide vers un élément
   * @param {Element|string} target Élément ou sélecteur cible
   * @param {Object} options Options de scroll
   */
  static scrollTo(target, options = {}) {
    const element = typeof target === 'string' ? 
      this.select(target) : target;
    
    if (!element) {
      uiLogger.warn('Élément cible introuvable pour scrollTo', target);
      return;
    }
    
    const defaultOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    };
    
    element.scrollIntoView({ ...defaultOptions, ...options });
    uiLogger.debug('Scroll vers élément', element);
  }

  /**
   * Crée un élément avec attributs et contenu
   * @param {string} tag Tag de l'élément
   * @param {Object} attributes Attributs à définir
   * @param {string|Element} content Contenu de l'élément
   * @returns {Element}
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Ajoute les attributs
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Ajoute le contenu
    if (typeof content === 'string') {
      element.innerHTML = content;
    } else if (content instanceof Element) {
      element.appendChild(content);
    }
    
    return element;
  }

  /**
   * Nettoie les event listeners d'un élément
   * @param {Element} element Élément à nettoyer
   */
  static cleanupEventListeners(element) {
    if (!element) return;
    
    // Nettoie les handlers stockés
    Object.keys(element).forEach(key => {
      if (key.endsWith('Handler')) {
        delete element[key];
      }
    });
    
    uiLogger.debug('Event listeners nettoyés', element);
  }

  /**
   * Observe les changements de taille d'un élément
   * @param {Element} element Élément à observer
   * @param {Function} callback Fonction appelée lors du changement
   * @returns {ResizeObserver}
   */
  static observeResize(element, callback) {
    if (!element || !window.ResizeObserver) {
      uiLogger.warn('ResizeObserver non supporté ou élément manquant');
      return null;
    }
    
    const observer = new ResizeObserver((entries) => {
      entries.forEach(entry => {
        callback(entry.contentRect, entry.target);
      });
    });
    
    observer.observe(element);
    return observer;
  }
}

export default DOMUtils;