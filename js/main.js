/**
 * Point d'entrée principal de l'application OUDAR Avocats
 * @fileoverview Initialise et coordonne tous les modules de l'application
 */

import CONFIG from './config/settings.js';
import { stateManager } from './utils/stateManager.js';
import LazyLoader from './utils/lazyLoader.js';
import PerformanceUtils from './utils/performance.js';
import { mainLogger, performanceLogger } from './utils/logger.js';

/**
 * Application principale OUDAR Avocats
 */
class OudarAvocatsApp {
  constructor() {
    this.lazyLoader = new LazyLoader();
    this.modules = new Map();
    this.isInitialized = false;
    this.initStartTime = performance.now();
    
    mainLogger.info('🏛️ OUDAR Avocats App starting...');
  }

  /**
   * Initialise l'application
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) {
      mainLogger.debug('App already initialized');
      return;
    }

    try {
      mainLogger.time('App Initialization');
      
      // === PHASE 1: MODULES CRITIQUES ===
      await this.loadCoreModules();
      
      // === PHASE 2: CONFIGURATION GLOBALE ===
      await this.setupGlobalEventListeners();
      
      // === PHASE 3: FONCTIONNALITÉS DE BASE ===
      await this.initializeBaseFeatures();
      
      // === PHASE 4: FONCTIONNALITÉS SPÉCIFIQUES ===
      await this.initializePageSpecificFeatures();
      
      // === PHASE 5: OPTIMISATIONS ===
      await this.setupOptimizations();
      
      // === FINALISATION ===
      await this.finalizeBoot();
      
      this.isInitialized = true;
      
      const initTime = performance.now() - this.initStartTime;
      mainLogger.timeEnd('App Initialization');
      mainLogger.success(`✅ OUDAR Avocats App initialized successfully in ${initTime.toFixed(2)}ms`);
      
      // Affiche les statistiques de performance en développement
      if (mainLogger.logLevel === 'debug') {
        this.showPerformanceStats();
      }
      
    } catch (error) {
      mainLogger.error('❌ Critical error during app initialization', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Charge les modules essentiels
   * @returns {Promise<void>}
   */
  async loadCoreModules() {
    mainLogger.info('📦 Loading core modules...');
    
    try {
      // Modules critiques - doivent être chargés en premier
      const coreModules = [
        { name: 'loader', module: await import('./modules/ui/loader.js') },
        { name: 'darkMode', module: await import('./modules/ui/darkMode.js') },
        { name: 'language', module: await import('./modules/features/language.js') }
      ];
      
      // Initialise les modules critiques
      for (const { name, module } of coreModules) {
        try {
          if (module.default && typeof module.default.init === 'function') {
            await module.default.init();
          } else if (module[`init${name.charAt(0).toUpperCase() + name.slice(1)}Manager`]) {
            const initFunction = module[`init${name.charAt(0).toUpperCase() + name.slice(1)}Manager`];
            await initFunction();
          }
          
          this.modules.set(name, module);
          mainLogger.debug(`✓ Core module loaded: ${name}`);
        } catch (error) {
          mainLogger.error(`✗ Failed to load core module: ${name}`, error);
        }
      }
      
      mainLogger.success('✅ Core modules loaded');
      
    } catch (error) {
      mainLogger.error('Failed to load core modules', error);
      throw error;
    }
  }

  /**
   * Configure les event listeners globaux
   * @returns {Promise<void>}
   */
  async setupGlobalEventListeners() {
    mainLogger.info('🔗 Setting up global event listeners...');
    
    try {
      // === GESTION DU REDIMENSIONNEMENT ===
      const debouncedResize = PerformanceUtils.debounce(() => {
        this.handleResize();
      }, CONFIG.RESIZE_DEBOUNCE);
      
      window.addEventListener('resize', debouncedResize, { passive: true });
      
      // === GESTION DU SCROLL ===
      const throttledScroll = PerformanceUtils.throttle(() => {
        this.handleScroll();
      }, CONFIG.SCROLL_THROTTLE);
      
      PerformanceUtils.addPassiveScrollListener(window, throttledScroll);
      
      // === GESTION DE LA NAVIGATION ===
      window.addEventListener('beforeunload', (e) => {
        this.handleBeforeUnload(e);
      });
      
      window.addEventListener('pageshow', (e) => {
        this.handlePageShow(e);
      });
      
      window.addEventListener('pagehide', (e) => {
        this.handlePageHide(e);
      });
      
      // === GESTION DES ERREURS ===
      window.addEventListener('error', (e) => {
        this.handleGlobalError(e);
      });
      
      window.addEventListener('unhandledrejection', (e) => {
        this.handleUnhandledRejection(e);
      });
      
      // === GESTION DE LA VISIBILITÉ ===
      document.addEventListener('visibilitychange', () => {
        this.handleVisibilityChange();
      });
      
      mainLogger.success('✅ Global event listeners configured');
      
    } catch (error) {
      mainLogger.error('Failed to setup global event listeners', error);
      throw error;
    }
  }

  /**
   * Initialise les fonctionnalités de base
   * @returns {Promise<void>}
   */
  async initializeBaseFeatures() {
    mainLogger.info('⚙️ Initializing base features...');
    
    const baseFeatures = [
      'setupHeaderEffects',
      'setupPageFadeEffects', 
      'setupFormValidation',
      'setupAccessibilityFeatures'
    ];

    for (const feature of baseFeatures) {
      try {
        await this.initializeFeature(feature);
      } catch (error) {
        mainLogger.warn(`Warning: Could not initialize ${feature}`, error);
      }
    }
    
    mainLogger.success('✅ Base features initialized');
  }

  /**
   * Initialise les fonctionnalités spécifiques à la page
   * @returns {Promise<void>}
   */
  async initializePageSpecificFeatures() {
    mainLogger.info('📄 Initializing page-specific features...');
    
    try {
      // Charge les modules spécifiques à la page courante
      await this.lazyLoader.loadPageSpecificModules();
      
      // Charge les modules selon le viewport
      await this.lazyLoader.loadViewportSpecificModules();
      
      // Initialise les fonctionnalités selon la page
      const currentPage = stateManager.getState('currentPage');
      await this.initializeForPage(currentPage);
      
      mainLogger.success('✅ Page-specific features initialized');
      
    } catch (error) {
      mainLogger.error('Failed to initialize page-specific features', error);
    }
  }

  /**
   * Configure les optimisations
   * @returns {Promise<void>}
   */
  async setupOptimizations() {
    mainLogger.info('🚀 Setting up optimizations...');
    
    try {
      // === LAZY LOADING DES IMAGES ===
      this.setupImageLazyLoading();
      
      // === PREFETCHING INTELLIGENT ===
      this.setupIntelligentPrefetching();
      
      // === MISE EN CACHE STRATÉGIQUE ===
      this.setupStrategicCaching();
      
      // === GESTION DE LA MÉMOIRE ===
      this.setupMemoryManagement();
      
      mainLogger.success('✅ Optimizations configured');
      
    } catch (error) {
      mainLogger.error('Failed to setup optimizations', error);
    }
  }

  /**
   * Finalise le démarrage
   * @returns {Promise<void>}
   */
  async finalizeBoot() {
    try {
      // Masque le loader après initialisation complète
      const loaderModule = this.modules.get('loader');
      if (loaderModule && loaderModule.hideLoader) {
        await loaderModule.hideLoader();
      }
      
      // Met à jour l'état global
      stateManager.setState('appInitialized', true);
      
      // Dispatch event global
      window.dispatchEvent(new CustomEvent('app-initialized', {
        detail: {
          initTime: performance.now() - this.initStartTime,
          modules: Array.from(this.modules.keys())
        }
      }));
      
      // Lance les mesures de performance
      PerformanceUtils.measureWebVitals();
      
    } catch (error) {
      mainLogger.error('Failed to finalize boot', error);
    }
  }

  /**
   * Gère le redimensionnement de la fenêtre
   */
  handleResize() {
    const { innerWidth, innerHeight } = window;
    
    stateManager.setMultipleStates({
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      isMobile: innerWidth <= CONFIG.BREAKPOINTS.MOBILE
    });
    
    // Optimisation spéciale pour la section hero sur mobile
    if (innerWidth <= CONFIG.BREAKPOINTS.MOBILE) {
      this.optimizeHeroHeightForMobile();
    }
  }

  /**
   * Gère le scroll de la page
   */
  handleScroll() {
    const scrollY = window.scrollY;
    stateManager.setState('scrollY', scrollY);
    
    // Optimise les animations selon la position de scroll
    this.optimizeAnimationsForScroll(scrollY);
  }

  /**
   * Optimise la hauteur du hero sur mobile
   */
  optimizeHeroHeightForMobile() {
    const hero = document.getElementById('hero');
    const header = document.querySelector('header.site');
    const topbar = document.querySelector('.topbar');

    if (hero && header && topbar && window.innerWidth <= CONFIG.BREAKPOINTS.MOBILE) {
      const headerHeight = header.offsetHeight;
      const topbarHeight = topbar.offsetHeight;
      const totalHeaderHeight = headerHeight + topbarHeight;

      hero.style.minHeight = `calc(${window.innerHeight}px - ${totalHeaderHeight}px)`;
    }
  }

  /**
   * Optimise les animations selon le scroll
   * @param {number} scrollY Position de scroll
   */
  optimizeAnimationsForScroll(scrollY) {
    // Peut être implémenté pour optimiser les performances
    // selon la position de scroll
  }

  /**
   * Gère les erreurs globales
   * @param {ErrorEvent} event Événement d'erreur
   */
  handleGlobalError(event) {
    mainLogger.error('Global error caught', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
    
    // Incrémente le compteur d'erreurs
    const currentCount = stateManager.getState('errorCount') || 0;
    stateManager.setState('errorCount', currentCount + 1);
  }

  /**
   * Gère les promesses rejetées non capturées
   * @param {PromiseRejectionEvent} event Événement de rejet
   */
  handleUnhandledRejection(event) {
    mainLogger.error('Unhandled promise rejection', event.reason);
    
    // Incrémente le compteur d'erreurs
    const currentCount = stateManager.getState('errorCount') || 0;
    stateManager.setState('errorCount', currentCount + 1);
  }

  /**
   * Gère les changements de visibilité de la page
   */
  handleVisibilityChange() {
    const isVisible = !document.hidden;
    
    if (isVisible) {
      mainLogger.debug('Page became visible');
      // Reprend les animations et timers si nécessaire
    } else {
      mainLogger.debug('Page became hidden');
      // Pause les animations et timers pour économiser les ressources
    }
  }

  /**
   * Gère l'événement avant déchargement
   * @param {BeforeUnloadEvent} event Événement avant déchargement
   */
  handleBeforeUnload(event) {
    // Sauvegarde l'état si nécessaire
    this.saveAppState();
    
    // Ajoute l'effet de fade out
    document.body.classList.add('page-fade-out');
  }

  /**
   * Gère l'affichage de la page (back/forward)
   * @param {PageTransitionEvent} event Événement pageshow
   */
  async handlePageShow(event) {
    if (event.persisted) {
      mainLogger.info('🔄 Page restored from BFCache - Re-initializing...');
      
      // Retire l'effet de fade
      document.body.classList.remove('page-fade-out');
      
      // Ré-initialise l'application
      await this.init();
    }
  }

  /**
   * Gère le masquage de la page
   * @param {PageTransitionEvent} event Événement pagehide
   */
  handlePageHide(event) {
    if (event.persisted) {
      // Sauvegarde l'état pour la restauration BFCache
      this.saveAppState();
    }
  }

  /**
   * Initialise une fonctionnalité spécifique
   * @param {string} featureName Nom de la fonctionnalité
   */
  async initializeFeature(featureName) {
    try {
      const method = this[featureName];
      if (typeof method === 'function') {
        await method.call(this);
        mainLogger.debug(`✓ Feature initialized: ${featureName}`);
      } else {
        mainLogger.warn(`Feature method not found: ${featureName}`);
      }
    } catch (error) {
      mainLogger.error(`Failed to initialize feature: ${featureName}`, error);
      throw error;
    }
  }

  /**
   * Initialise les fonctionnalités pour une page spécifique
   * @param {string} pageName Nom de la page
   */
  async initializeForPage(pageName) {
    const pageInitializers = {
      'index.html': () => this.initializeHomePage(),
      'blog.html': () => this.initializeBlogPage(),
      'contact.html': () => this.initializeContactPage(),
      'expertises.html': () => this.initializeExpertisesPage()
    };

    const initializer = pageInitializers[pageName];
    if (initializer) {
      try {
        await initializer();
        mainLogger.debug(`✓ Page initialized: ${pageName}`);
      } catch (error) {
        mainLogger.warn(`Failed to initialize page: ${pageName}`, error);
      }
    }
  }

  /**
   * Configure le lazy loading des images
   */
  setupImageLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      mainLogger.debug('IntersectionObserver not supported, skipping image lazy loading');
      return;
    }

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    // Observe toutes les images avec data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  /**
   * Configure le prefetching intelligent
   */
  setupIntelligentPrefetching() {
    // Prefetch les pages probablement visitées
    const links = document.querySelectorAll('a[href^="./"], a[href^="/"]');
    
    links.forEach(link => {
      link.addEventListener('mouseenter', () => {
        this.lazyLoader.prefetchForPage(link.href);
      }, { once: true, passive: true });
    });
  }

  /**
   * Configure la mise en cache stratégique
   */
  setupStrategicCaching() {
    // Implémentation de la stratégie de cache
    // Pour le moment, on utilise le système de cache existant
  }

  /**
   * Configure la gestion de la mémoire
   */
  setupMemoryManagement() {
    // Nettoie périodiquement les ressources non utilisées
    setInterval(() => {
      this.cleanupUnusedResources();
    }, 300000); // Toutes les 5 minutes
  }

  /**
   * Nettoie les ressources non utilisées
   */
  cleanupUnusedResources() {
    // Nettoie le cache du lazy loader
    this.lazyLoader.cleanup();
    
    // Autres nettoyages si nécessaire
    mainLogger.debug('🧹 Cleaned up unused resources');
  }

  /**
   * Sauvegarde l'état de l'application
   */
  saveAppState() {
    try {
      stateManager.saveStateToStorage();
      mainLogger.debug('💾 App state saved');
    } catch (error) {
      mainLogger.warn('Failed to save app state', error);
    }
  }

  /**
   * Gère les erreurs d'initialisation
   * @param {Error} error Erreur d'initialisation
   */
  handleInitializationError(error) {
    // Affiche un message d'erreur à l'utilisateur
    const errorMessage = document.createElement('div');
    errorMessage.className = 'init-error';
    errorMessage.innerHTML = `
      <h3>Erreur de chargement</h3>
      <p>Une erreur s'est produite lors du chargement de la page. Veuillez rafraîchir votre navigateur.</p>
      <button onclick="window.location.reload()">Rafraîchir</button>
    `;
    
    // Style d'urgence
    errorMessage.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #fff; border: 2px solid #e74c3c; border-radius: 8px;
      padding: 20px; text-align: center; z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(errorMessage);
  }

  /**
   * Affiche les statistiques de performance
   */
  showPerformanceStats() {
    PerformanceUtils.whenIdle(() => {
      const stats = PerformanceUtils.getPerformanceStats();
      performanceLogger.info('📊 Performance Statistics:', stats);
      
      const lazyLoaderStats = this.lazyLoader.getStats();
      performanceLogger.info('📦 Lazy Loader Statistics:', lazyLoaderStats);
    });
  }

  /**
   * Méthodes d'initialisation spécifiques aux pages
   */
  async initializeHomePage() {
    // Charge les modules spécifiques à l'accueil
    await this.lazyLoader.loadModule('carousel');
    await this.lazyLoader.loadModule('animations');
  }

  async initializeBlogPage() {
    await this.lazyLoader.loadModule('blog');
  }

  async initializeContactPage() {
    await this.lazyLoader.loadModule('forms');
  }

  async initializeExpertisesPage() {
    await this.lazyLoader.loadModule('expertises');
  }

  /**
   * Méthodes d'initialisation des fonctionnalités de base
   */
  async setupHeaderEffects() {
    await this.lazyLoader.loadModule('header');
  }

  async setupPageFadeEffects() {
    await this.lazyLoader.loadModule('navigation');
  }

  async setupFormValidation() {
    await this.lazyLoader.loadModule('forms');
  }

  async setupAccessibilityFeatures() {
    // Configuration des fonctionnalités d'accessibilité
    // Déjà gérées dans les modules individuels
  }

  /**
   * Nettoie toutes les ressources
   */
  destroy() {
    mainLogger.info('🧹 Destroying OUDAR Avocats App...');
    
    // Nettoie tous les modules
    this.modules.forEach((module, name) => {
      try {
        if (module.destroy && typeof module.destroy === 'function') {
          module.destroy();
        }
        mainLogger.debug(`✓ Module destroyed: ${name}`);
      } catch (error) {
        mainLogger.warn(`Failed to destroy module: ${name}`, error);
      }
    });
    
    this.modules.clear();
    this.lazyLoader.cleanup();
    this.isInitialized = false;
    
    mainLogger.success('✅ OUDAR Avocats App destroyed');
  }

  /**
   * Obtient les statistiques de l'application
   * @returns {Object}
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      initTime: this.isInitialized ? performance.now() - this.initStartTime : null,
      loadedModules: Array.from(this.modules.keys()),
      lazyLoaderStats: this.lazyLoader.getStats(),
      stateStats: stateManager.getAllState()
    };
  }
}

// === INITIALISATION DE L'APPLICATION ===

// Instance singleton
const app = new OudarAvocatsApp();

// Points d'entrée multiples pour compatibilité maximale
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  // DOM déjà chargé
  app.init();
}

// Fallback pour navigateurs plus anciens
window.addEventListener('load', () => app.init());

// Export pour usage externe et debugging
window.OudarApp = app;

// Export ES6 pour modules
export default app;