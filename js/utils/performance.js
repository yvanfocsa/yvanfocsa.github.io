/**
 * Utilitaires de performance et optimisation
 * @fileoverview Helpers pour debounce, throttle, cache et mesures de performance
 */

import { performanceLogger } from './logger.js';
import CONFIG from '../config/settings.js';

export class PerformanceUtils {
  /**
   * Debounce une fonction
   * @param {Function} func Fonction à debouncer
   * @param {number} wait Délai d'attente
   * @param {boolean} immediate Exécution immédiate
   * @returns {Function}
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(this, args);
    };
  }

  /**
   * Throttle une fonction
   * @param {Function} func Fonction à throttler
   * @param {number} limit Limite en ms
   * @returns {Function}
   */
  static throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * RequestAnimationFrame avec fallback
   * @param {Function} callback Fonction à exécuter
   * @returns {number} ID de la requête
   */
  static raf(callback) {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16); // ~60fps
  }

  /**
   * Annule une requête d'animation
   * @param {number} id ID de la requête
   */
  static cancelRaf(id) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  }

  /**
   * Mesure le temps d'exécution d'une fonction
   * @param {Function} func Fonction à mesurer
   * @param {string} label Label pour le log
   * @returns {Promise<any>} Résultat de la fonction
   */
  static async measureTime(func, label = 'Operation') {
    const start = performance.now();
    
    try {
      const result = await func();
      const end = performance.now();
      const duration = end - start;
      
      performanceLogger.info(`${label} completed in ${duration.toFixed(2)}ms`);
      
      // Avertissement si l'opération est lente
      if (duration > 100) {
        performanceLogger.warn(`Slow operation detected: ${label} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
    } catch (error) {
      const end = performance.now();
      performanceLogger.error(`${label} failed after ${(end - start).toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Cache simple avec expiration
   * @param {number} ttl Durée de vie en ms
   * @returns {Object} Interface du cache
   */
  static createCache(ttl = CONFIG.PERFORMANCE.CACHE_TTL) {
    const cache = new Map();
    
    return {
      /**
       * Récupère une valeur du cache
       * @param {string} key Clé
       * @returns {any|null}
       */
      get(key) {
        const item = cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expires) {
          cache.delete(key);
          performanceLogger.debug(`Cache entry expired: ${key}`);
          return null;
        }
        
        performanceLogger.debug(`Cache hit: ${key}`);
        return item.value;
      },
      
      /**
       * Stocke une valeur dans le cache
       * @param {string} key Clé
       * @param {any} value Valeur
       */
      set(key, value) {
        cache.set(key, {
          value,
          expires: Date.now() + ttl,
          created: Date.now()
        });
        performanceLogger.debug(`Cache set: ${key}`);
      },
      
      /**
       * Supprime une entrée du cache
       * @param {string} key Clé
       */
      delete(key) {
        const deleted = cache.delete(key);
        if (deleted) {
          performanceLogger.debug(`Cache entry deleted: ${key}`);
        }
        return deleted;
      },
      
      /**
       * Vide le cache
       */
      clear() {
        const size = cache.size;
        cache.clear();
        performanceLogger.debug(`Cache cleared: ${size} entries removed`);
      },
      
      /**
       * Statistiques du cache
       * @returns {Object}
       */
      stats() {
        return {
          size: cache.size,
          entries: Array.from(cache.keys())
        };
      }
    };
  }

  /**
   * Optimise les event listeners pour les listes
   * @param {Element} container Conteneur parent
   * @param {string} selector Sélecteur des éléments cibles
   * @param {string} event Type d'événement
   * @param {Function} handler Fonction de gestion
   */
  static delegateEvent(container, selector, event, handler) {
    if (!container) {
      performanceLogger.warn('Container missing for event delegation');
      return;
    }

    container.addEventListener(event, (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    });
    
    performanceLogger.debug(`Event delegation setup: ${event} on ${selector}`);
  }

  /**
   * Intersection Observer optimisé
   * @param {Function} callback Fonction de callback
   * @param {Object} options Options de l'observer
   * @returns {IntersectionObserver}
   */
  static createIntersectionObserver(callback, options = {}) {
    const defaultOptions = {
      threshold: CONFIG.PERFORMANCE.INTERSECTION_THRESHOLD,
      rootMargin: CONFIG.PERFORMANCE.LAZY_LOAD_MARGIN
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    if (!window.IntersectionObserver) {
      performanceLogger.warn('IntersectionObserver not supported');
      return null;
    }
    
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        callback(entry, obs);
      });
    }, finalOptions);
    
    performanceLogger.debug('IntersectionObserver created', finalOptions);
    return observer;
  }

  /**
   * Précharge une image
   * @param {string} src URL de l'image
   * @returns {Promise<HTMLImageElement>}
   */
  static preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        performanceLogger.debug(`Image preloaded: ${src}`);
        resolve(img);
      };
      
      img.onerror = () => {
        performanceLogger.warn(`Failed to preload image: ${src}`);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });
  }

  /**
   * Batch d'opérations DOM pour éviter les reflows
   * @param {Function} operations Fonction contenant les opérations DOM
   */
  static batchDOMOperations(operations) {
    this.raf(() => {
      const start = performance.now();
      operations();
      const end = performance.now();
      
      performanceLogger.debug(`DOM batch operations completed in ${(end - start).toFixed(2)}ms`);
    });
  }

  /**
   * Mesure les métriques de performance Web Vitals
   * @returns {Object} Métriques collectées
   */
  static measureWebVitals() {
    const metrics = {};
    
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.lcp = lastEntry.startTime;
          performanceLogger.info(`LCP: ${metrics.lcp.toFixed(2)}ms`);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        performanceLogger.debug('LCP measurement not available');
      }
    }
    
    // First Input Delay
    if ('PerformanceObserver' in window) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            metrics.fid = entry.processingStart - entry.startTime;
            performanceLogger.info(`FID: ${metrics.fid.toFixed(2)}ms`);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        performanceLogger.debug('FID measurement not available');
      }
    }
    
    // Time to First Byte
    if (performance.timing) {
      metrics.ttfb = performance.timing.responseStart - performance.timing.requestStart;
      performanceLogger.info(`TTFB: ${metrics.ttfb}ms`);
    }
    
    return metrics;
  }

  /**
   * Optimise le scroll avec Passive Event Listeners
   * @param {Element} element Élément à écouter
   * @param {Function} handler Fonction de gestion
   * @param {Object} options Options d'événement
   */
  static addPassiveScrollListener(element, handler, options = {}) {
    const defaultOptions = {
      passive: true,
      capture: false
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    element.addEventListener('scroll', handler, finalOptions);
    performanceLogger.debug('Passive scroll listener added', element);
  }

  /**
   * Retarde l'exécution jusqu'à ce que le navigateur soit idle
   * @param {Function} callback Fonction à exécuter
   * @param {Object} options Options de timeout
   * @returns {number} ID de la requête
   */
  static whenIdle(callback, options = {}) {
    if ('requestIdleCallback' in window) {
      return requestIdleCallback(callback, options);
    }
    
    // Fallback pour les navigateurs non supportés
    return setTimeout(callback, 0);
  }

  /**
   * Collecte les statistiques de performance globales
   * @returns {Object} Statistiques complètes
   */
  static getPerformanceStats() {
    const stats = {
      timing: {},
      memory: {},
      connection: {},
      webVitals: this.measureWebVitals()
    };
    
    // Navigation Timing
    if (performance.timing) {
      const timing = performance.timing;
      stats.timing = {
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnect: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        domProcessing: timing.domComplete - timing.domLoading,
        loadComplete: timing.loadEventEnd - timing.navigationStart
      };
    }
    
    // Memory Usage
    if (performance.memory) {
      stats.memory = {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + 'MB',
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + 'MB',
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + 'MB'
      };
    }
    
    // Network Information
    if (navigator.connection) {
      stats.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      };
    }
    
    performanceLogger.info('Performance stats collected', stats);
    return stats;
  }
}

export default PerformanceUtils;