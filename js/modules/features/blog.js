/**
 * Module de gestion du blog
 * @fileoverview Gère les filtres, la recherche et l'affichage des articles du blog
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import PerformanceUtils from '../../utils/performance.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class BlogManager {
  constructor() {
    this.filtersContainer = null;
    this.searchInput = null;
    this.blogGrid = null;
    this.articles = [];
    this.activeFilter = 'all';
    this.searchTerm = '';
    this.initialized = false;
    this.cache = PerformanceUtils.createCache();
    
    featureLogger.debug('BlogManager created');
  }

  /**
   * Initialise le gestionnaire de blog
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('BlogManager already initialized');
      return;
    }

    try {
      featureLogger.time('BlogManager initialization');
      
      // Trouve les éléments DOM
      this.filtersContainer = DOMUtils.select(CONFIG.SELECTORS.BLOG_FILTERS);
      this.searchInput = DOMUtils.select('.blog-search input');
      this.blogGrid = DOMUtils.select('.blog-grid');
      
      if (!this.filtersContainer && !this.searchInput && !this.blogGrid) {
        featureLogger.warn('No blog elements found');
        return;
      }
      
      // Collecte les articles
      this.collectArticles();
      
      // Configure les filtres
      if (this.filtersContainer) {
        this.setupFilters();
      }
      
      // Configure la recherche
      if (this.searchInput) {
        this.setupSearch();
      }
      
      // Configure l'état initial
      this.applyInitialState();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('BlogManager initialization');
      featureLogger.success('BlogManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize BlogManager', error);
      throw error;
    }
  }

  /**
   * Collecte tous les articles du blog
   */
  collectArticles() {
    if (!this.blogGrid) return;

    const articleElements = DOMUtils.selectAll('.blog-card', this.blogGrid);
    
    this.articles = articleElements.map(element => {
      const title = this.extractText(element, 'h3');
      const description = this.extractText(element, 'p');
      const category = element.dataset.category || 'all';
      const categoryText = this.extractText(element, '.blog-card-category');
      
      return {
        element,
        title: title.toLowerCase(),
        description: description.toLowerCase(),
        category,
        categoryText,
        searchableText: `${title} ${description} ${categoryText}`.toLowerCase(),
        visible: true
      };
    });

    featureLogger.debug(`Collected ${this.articles.length} articles`);
  }

  /**
   * Extrait le texte d'un élément
   * @param {Element} container Conteneur parent
   * @param {string} selector Sélecteur de l'élément
   * @returns {string}
   */
  extractText(container, selector) {
    const element = DOMUtils.select(selector, container);
    return element ? element.textContent.trim() : '';
  }

  /**
   * Configure les filtres
   */
  setupFilters() {
    const filterButtons = DOMUtils.selectAll('.btn', this.filtersContainer);
    
    if (filterButtons.length === 0) {
      featureLogger.warn('No filter buttons found');
      return;
    }

    // Délégation d'événements pour les performances
    PerformanceUtils.delegateEvent(
      this.filtersContainer,
      '.btn',
      'click',
      (e) => {
        e.preventDefault();
        const filter = e.target.dataset.filter || 'all';
        this.setFilter(filter);
      }
    );

    // Support clavier pour l'accessibilité
    filterButtons.forEach(button => {
      DOMUtils.addEventListenerWithCleanup(button, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          button.click();
        }
      });
    });

    featureLogger.debug('Blog filters configured');
  }

  /**
   * Configure la recherche
   */
  setupSearch() {
    // Debounce la recherche pour les performances
    const debouncedSearch = PerformanceUtils.debounce((term) => {
      this.performSearch(term);
    }, 300);

    DOMUtils.addEventListenerWithCleanup(this.searchInput, 'input', (e) => {
      const searchTerm = e.target.value.trim();
      debouncedSearch(searchTerm);
    });

    // Support pour la touche Échap pour vider la recherche
    DOMUtils.addEventListenerWithCleanup(this.searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this.performSearch('');
      }
    });

    featureLogger.debug('Blog search configured');
  }

  /**
   * Définit le filtre actif
   * @param {string} filter Nouveau filtre
   */
  setFilter(filter) {
    if (filter === this.activeFilter) {
      featureLogger.debug(`Filter already set to: ${filter}`);
      return;
    }

    const oldFilter = this.activeFilter;
    this.activeFilter = filter;

    // Met à jour l'interface
    this.updateFilterButtons();
    
    // Applique le filtrage
    this.applyFiltering();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('blog-filter-changed', {
      detail: { 
        oldFilter,
        newFilter: filter,
        visibleCount: this.getVisibleArticlesCount()
      }
    }));

    featureLogger.info(`Blog filter changed: ${oldFilter} → ${filter}`);
  }

  /**
   * Effectue une recherche
   * @param {string} term Terme de recherche
   */
  performSearch(term) {
    const oldTerm = this.searchTerm;
    this.searchTerm = term.toLowerCase();

    // Applique le filtrage
    this.applyFiltering();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('blog-search-changed', {
      detail: { 
        oldTerm,
        newTerm: term,
        visibleCount: this.getVisibleArticlesCount()
      }
    }));

    featureLogger.info(`Blog search changed: "${oldTerm}" → "${term}"`);
  }

  /**
   * Met à jour les boutons de filtre
   */
  updateFilterButtons() {
    const filterButtons = DOMUtils.selectAll('.btn', this.filtersContainer);
    
    filterButtons.forEach(button => {
      const buttonFilter = button.dataset.filter || 'all';
      const isActive = buttonFilter === this.activeFilter;
      
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive.toString());
    });

    featureLogger.debug('Filter buttons updated', { activeFilter: this.activeFilter });
  }

  /**
   * Applique le filtrage et la recherche
   */
  applyFiltering() {
    if (this.articles.length === 0) return;

    // Génère une clé de cache
    const cacheKey = `filter-${this.activeFilter}-search-${this.searchTerm}`;
    
    // Vérifie le cache
    let filteredArticles = this.cache.get(cacheKey);
    
    if (!filteredArticles) {
      // Applique les filtres et la recherche
      filteredArticles = this.articles.filter(article => {
        const matchesFilter = this.activeFilter === 'all' || article.category === this.activeFilter;
        const matchesSearch = !this.searchTerm || article.searchableText.includes(this.searchTerm);
        
        return matchesFilter && matchesSearch;
      });
      
      // Met en cache le résultat
      this.cache.set(cacheKey, filteredArticles);
    }

    // Met à jour la visibilité
    this.updateArticlesVisibility(filteredArticles);
    
    // Met à jour le compteur
    this.updateResultsCount(filteredArticles.length);

    featureLogger.debug('Filtering applied', {
      total: this.articles.length,
      visible: filteredArticles.length,
      filter: this.activeFilter,
      search: this.searchTerm
    });
  }

  /**
   * Met à jour la visibilité des articles
   * @param {Array} visibleArticles Articles à afficher
   */
  updateArticlesVisibility(visibleArticles) {
    const visibleElements = new Set(visibleArticles.map(article => article.element));
    
    this.articles.forEach(article => {
      const shouldShow = visibleElements.has(article.element);
      article.visible = shouldShow;
      
      if (shouldShow) {
        this.showArticle(article.element);
      } else {
        this.hideArticle(article.element);
      }
    });
  }

  /**
   * Affiche un article avec animation
   * @param {Element} element Article à afficher
   */
  showArticle(element) {
    element.style.display = 'flex';
    element.classList.remove('hidden');
    
    // Animation d'apparition
    PerformanceUtils.raf(() => {
      element.style.opacity = '1';
      element.style.transform = 'scale(1)';
    });
  }

  /**
   * Masque un article avec animation
   * @param {Element} element Article à masquer
   */
  hideArticle(element) {
    element.style.opacity = '0';
    element.style.transform = 'scale(0.95)';
    
    // Masque complètement après l'animation
    setTimeout(() => {
      element.style.display = 'none';
      element.classList.add('hidden');
    }, 300);
  }

  /**
   * Met à jour le compteur de résultats
   * @param {number} count Nombre d'articles visibles
   */
  updateResultsCount(count) {
    const countElement = DOMUtils.select('.blog-results-count');
    
    if (countElement) {
      if (count === this.articles.length) {
        countElement.textContent = '';
      } else {
        countElement.textContent = `${count} article${count > 1 ? 's' : ''} trouvé${count > 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Applique l'état initial
   */
  applyInitialState() {
    // Vérifie s'il y a des paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    const searchParam = urlParams.get('search');

    if (filterParam) {
      this.setFilter(filterParam);
    }

    if (searchParam && this.searchInput) {
      this.searchInput.value = searchParam;
      this.performSearch(searchParam);
    }

    // Sinon applique l'état par défaut
    if (!filterParam && !searchParam) {
      this.updateFilterButtons();
      this.applyFiltering();
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', () => {
      // Recollecte les articles après changement de langue
      setTimeout(() => {
        this.collectArticles();
        this.applyFiltering();
      }, 100);
    });
  }

  /**
   * Obtient le nombre d'articles visibles
   * @returns {number}
   */
  getVisibleArticlesCount() {
    return this.articles.filter(article => article.visible).length;
  }

  /**
   * Obtient tous les filtres disponibles
   * @returns {Array<string>}
   */
  getAvailableFilters() {
    const filters = new Set(['all']);
    this.articles.forEach(article => {
      if (article.category) {
        filters.add(article.category);
      }
    });
    return Array.from(filters);
  }

  /**
   * Réinitialise tous les filtres
   */
  resetFilters() {
    this.setFilter('all');
    
    if (this.searchInput) {
      this.searchInput.value = '';
      this.performSearch('');
    }

    featureLogger.info('Blog filters reset');
  }

  /**
   * Exporte les résultats actuels
   * @returns {Array}
   */
  exportResults() {
    return this.articles
      .filter(article => article.visible)
      .map(article => ({
        title: this.extractText(article.element, 'h3'),
        description: this.extractText(article.element, 'p'),
        category: article.category,
        url: article.element.href || article.element.querySelector('a')?.href
      }));
  }

  /**
   * Ajoute un nouvel article dynamiquement
   * @param {Element} articleElement Nouvel article
   */
  addArticle(articleElement) {
    const title = this.extractText(articleElement, 'h3');
    const description = this.extractText(articleElement, 'p');
    const category = articleElement.dataset.category || 'all';
    const categoryText = this.extractText(articleElement, '.blog-card-category');
    
    const article = {
      element: articleElement,
      title: title.toLowerCase(),
      description: description.toLowerCase(),
      category,
      categoryText,
      searchableText: `${title} ${description} ${categoryText}`.toLowerCase(),
      visible: true
    };

    this.articles.push(article);
    
    // Vide le cache
    this.cache.clear();
    
    // Réapplique le filtrage
    this.applyFiltering();

    featureLogger.debug('Article added to blog', article);
  }

  /**
   * Supprime un article
   * @param {Element} articleElement Article à supprimer
   */
  removeArticle(articleElement) {
    const index = this.articles.findIndex(article => article.element === articleElement);
    
    if (index !== -1) {
      this.articles.splice(index, 1);
      articleElement.remove();
      
      // Vide le cache
      this.cache.clear();
      
      // Réapplique le filtrage
      this.applyFiltering();

      featureLogger.debug('Article removed from blog');
    }
  }

  /**
   * Met à jour l'URL avec les paramètres actuels
   */
  updateURL() {
    const url = new URL(window.location);
    
    if (this.activeFilter !== 'all') {
      url.searchParams.set('filter', this.activeFilter);
    } else {
      url.searchParams.delete('filter');
    }
    
    if (this.searchTerm) {
      url.searchParams.set('search', this.searchTerm);
    } else {
      url.searchParams.delete('search');
    }
    
    window.history.replaceState({}, '', url);
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie le cache
    this.cache.clear();
    
    // Reset les propriétés
    this.articles = [];
    this.activeFilter = 'all';
    this.searchTerm = '';
    
    this.initialized = false;
    featureLogger.debug('BlogManager destroyed');
  }

  /**
   * Obtient les statistiques du blog
   * @returns {Object}
   */
  getStats() {
    return {
      totalArticles: this.articles.length,
      visibleArticles: this.getVisibleArticlesCount(),
      activeFilter: this.activeFilter,
      searchTerm: this.searchTerm,
      availableFilters: this.getAvailableFilters(),
      cacheStats: this.cache.stats(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let blogManager = null;

/**
 * Obtient l'instance du gestionnaire de blog
 * @returns {BlogManager}
 */
export function getBlogManager() {
  if (!blogManager) {
    blogManager = new BlogManager();
  }
  return blogManager;
}

/**
 * Initialise le gestionnaire de blog
 * @returns {Promise<BlogManager>}
 */
export async function initBlogManager() {
  const manager = getBlogManager();
  await manager.init();
  return manager;
}

export default { BlogManager, getBlogManager, initBlogManager };