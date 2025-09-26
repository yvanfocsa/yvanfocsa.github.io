/**
 * Système de lazy loading intelligent pour modules
 * @fileoverview Charge les modules JavaScript de façon différée selon les besoins
 */

import { performanceLogger } from './logger.js';
import CONFIG from '../config/settings.js';

export class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
    this.pendingLoads = new Map();
    this.failedLoads = new Set();
    this.retryCount = new Map();
  }

  /**
   * Charge un module de façon asynchrone
   * @param {string} moduleName Nom du module
   * @param {Function} condition Condition de chargement
   * @returns {Promise<any>} Module chargé
   */
  async loadModule(moduleName, condition = () => true) {
    // Évite les chargements multiples
    if (this.loadedModules.has(moduleName)) {
      performanceLogger.debug(`Module already loaded: ${moduleName}`);
      return this.loadedModules.get(moduleName);
    }

    // Retourne la promesse en cours si elle existe
    if (this.pendingLoads.has(moduleName)) {
      performanceLogger.debug(`Module loading in progress: ${moduleName}`);
      return this.pendingLoads.get(moduleName);
    }

    // Vérifie la condition de chargement
    if (!condition()) {
      performanceLogger.debug(`Condition not met for module: ${moduleName}`);
      return null;
    }

    // Vérifie si le module a déjà échoué trop de fois
    if (this.failedLoads.has(moduleName)) {
      const retries = this.retryCount.get(moduleName) || 0;
      if (retries >= CONFIG.PERFORMANCE.MAX_RETRIES) {
        performanceLogger.warn(`Module ${moduleName} failed too many times, skipping`);
        return null;
      }
    }

    // Charge le module
    const modulePromise = this.dynamicImport(moduleName);
    this.pendingLoads.set(moduleName, modulePromise);

    try {
      performanceLogger.time(`Module load: ${moduleName}`);
      const module = await modulePromise;
      
      this.loadedModules.set(moduleName, module);
      this.pendingLoads.delete(moduleName);
      this.failedLoads.delete(moduleName);
      this.retryCount.delete(moduleName);
      
      performanceLogger.timeEnd(`Module load: ${moduleName}`);
      performanceLogger.debug(`Module loaded successfully: ${moduleName}`);
      
      return module;
    } catch (error) {
      this.pendingLoads.delete(moduleName);
      this.failedLoads.add(moduleName);
      
      const retries = this.retryCount.get(moduleName) || 0;
      this.retryCount.set(moduleName, retries + 1);
      
      performanceLogger.error(`Failed to load module ${moduleName}`, error);
      return null;
    }
  }

  /**
   * Import dynamique avec mapping des modules
   * @param {string} moduleName Nom du module
   * @returns {Promise<any>} Module importé
   */
  async dynamicImport(moduleName) {
    const moduleMap = {
      // === MODULES UI ===
      'carousel': () => import('../modules/ui/carousel.js'),
      'darkMode': () => import('../modules/ui/darkMode.js'),
      'drawer': () => import('../modules/ui/drawer.js'),
      'header': () => import('../modules/ui/header.js'),
      'loader': () => import('../modules/ui/loader.js'),
      'animations': () => import('../modules/ui/animations.js'),
      
      // === MODULES FEATURES ===
      'language': () => import('../modules/features/language.js'),
      'blog': () => import('../modules/features/blog.js'),
      'cookies': () => import('../modules/features/cookies.js'),
      'forms': () => import('../modules/features/forms.js'),
      'navigation': () => import('../modules/features/navigation.js'),
      'expertiseNav': () => import('../modules/features/expertiseNav.js'),
      
      // === MODULES PAGES ===
      'home': () => import('../modules/pages/home.js'),
      'contact': () => import('../modules/pages/contact.js'),
      'expertises': () => import('../modules/pages/expertises.js'),
      'team': () => import('../modules/pages/team.js')
    };

    const importer = moduleMap[moduleName];
    if (!importer) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    return await importer();
  }

  /**
   * Précharge les modules critiques
   * @returns {Promise<void>}
   */
  async preloadCriticalModules() {
    const criticalModules = [
      'darkMode',
      'language', 
      'header',
      'loader'
    ];
    
    performanceLogger.info('Preloading critical modules...');
    
    const loadPromises = criticalModules.map(module => 
      this.loadModule(module).catch(error => {
        performanceLogger.warn(`Failed to preload critical module: ${module}`, error);
        return null;
      })
    );
    
    await Promise.all(loadPromises);
    performanceLogger.info('Critical modules preloaded');
  }

  /**
   * Charge les modules selon la page actuelle
   * @returns {Promise<void>}
   */
  async loadPageSpecificModules() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    const pageModules = {
      'index.html': ['carousel', 'animations', 'home'],
      'blog.html': ['blog'],
      'contact.html': ['forms', 'contact'],
      'expertises.html': ['expertises'],
      'cabinet.html': ['animations'],
      'consultation.html': ['forms'],
      'honoraires.html': ['forms'],
      'team-svetlana.html': ['team'],
      'team-sharon.html': ['team'],
      'team-leonie.html': ['team'],
      'expertise-droit-immobilier.html': ['expertiseNav'],
      'expertise-droit-de-la-construction.html': ['expertiseNav'],
      'expertise-droit-de-la-copropriete.html': ['expertiseNav'],
      'expertise-contentieux-civil-commercial.html': ['expertiseNav'],
      'expertise-vente-forcee.html': ['expertiseNav'],
      'expertise-droit-famille.html': ['expertiseNav'],
      'mentions-legales.html': [],
      'plan-du-site.html': [],
      'gestion-cookies.html': ['cookies']
    };

    const modules = pageModules[currentPage] || [];
    
    if (modules.length > 0) {
      performanceLogger.info(`Loading page-specific modules for ${currentPage}:`, modules);
      
      const loadPromises = modules.map(module => 
        this.loadModule(module).catch(error => {
          performanceLogger.warn(`Failed to load page module: ${module}`, error);
          return null;
        })
      );
      
      await Promise.all(loadPromises);
    }
  }

  /**
   * Charge les modules selon les conditions de viewport
   * @returns {Promise<void>}
   */
  async loadViewportSpecificModules() {
    const isMobile = window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE;
    
    if (isMobile) {
      await this.loadModule('drawer');
    }
  }

  /**
   * Charge les modules selon les interactions utilisateur
   * @param {string} interaction Type d'interaction
   * @returns {Promise<void>}
   */
  async loadOnInteraction(interaction) {
    const interactionModules = {
      'scroll': ['animations'],
      'drawer-open': ['drawer'],
      'carousel-init': ['carousel'],
      'form-focus': ['forms'],
      'cookie-banner': ['cookies'],
      'dark-mode-toggle': ['darkMode'],
      'language-switch': ['language']
    };

    const modules = interactionModules[interaction] || [];
    
    const loadPromises = modules.map(module => this.loadModule(module));
    await Promise.all(loadPromises);
  }

  /**
   * Charge les modules avec intersection observer
   * @param {Element} element Élément à observer
   * @param {string[]} modules Modules à charger
   * @returns {IntersectionObserver}
   */
  loadOnIntersection(element, modules) {
    if (!window.IntersectionObserver) {
      // Fallback pour navigateurs non supportés
      modules.forEach(module => this.loadModule(module));
      return null;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          modules.forEach(module => this.loadModule(module));
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.PERFORMANCE.INTERSECTION_THRESHOLD,
      rootMargin: CONFIG.PERFORMANCE.LAZY_LOAD_MARGIN
    });

    observer.observe(element);
    return observer;
  }

  /**
   * Précharge les modules pour la navigation suivante
   * @param {string} nextPage URL de la page suivante
   */
  async prefetchForPage(nextPage) {
    try {
      const pageName = nextPage.split('/').pop() || 'index.html';
      
      // Attend un moment pour ne pas interférer avec la page actuelle
      setTimeout(async () => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === pageName) {
          // L'utilisateur est déjà sur cette page
          return;
        }
        
        await this.loadPageSpecificModules();
        performanceLogger.debug(`Prefetched modules for: ${pageName}`);
      }, 1000);
    } catch (error) {
      performanceLogger.warn(`Failed to prefetch for ${nextPage}`, error);
    }
  }

  /**
   * Retente le chargement d'un module échoué
   * @param {string} moduleName Nom du module
   * @returns {Promise<any>}
   */
  async retryModule(moduleName) {
    if (!this.failedLoads.has(moduleName)) {
      return this.loadModule(moduleName);
    }

    const retries = this.retryCount.get(moduleName) || 0;
    if (retries >= CONFIG.PERFORMANCE.MAX_RETRIES) {
      performanceLogger.warn(`Module ${moduleName} exceeded max retries`);
      return null;
    }

    // Reset le status d'échec pour permettre le retry
    this.failedLoads.delete(moduleName);
    
    return this.loadModule(moduleName);
  }

  /**
   * Nettoie les modules non utilisés
   */
  cleanup() {
    // Pour le moment, on garde tous les modules chargés en mémoire
    // Dans une version avancée, on pourrait décharger les modules non critiques
    this.pendingLoads.clear();
    
    performanceLogger.debug('LazyLoader cleanup completed');
  }

  /**
   * Obtient les statistiques de chargement
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      loadedModules: Array.from(this.loadedModules.keys()),
      pendingLoads: Array.from(this.pendingLoads.keys()),
      failedLoads: Array.from(this.failedLoads),
      retryCount: Object.fromEntries(this.retryCount)
    };
  }

  /**
   * Affiche les statistiques dans la console
   */
  showStats() {
    const stats = this.getStats();
    performanceLogger.info('LazyLoader Statistics:', stats);
  }
}

export default LazyLoader;