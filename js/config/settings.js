/**
 * Configuration globale de l'application OUDAR Avocats
 * @fileoverview Centralise toutes les constantes et paramètres de configuration
 */

export const CONFIG = {
  // === TIMING ET ANIMATIONS ===
  LOADER_TIMEOUT: 2500,
  PAGE_FADE_DURATION: 300,
  ANIMATION_THRESHOLD: 0.1,
  SCROLL_THROTTLE: 16, // 60fps
  RESIZE_DEBOUNCE: 250,
  
  // === CARROUSELS ===
  CAROUSEL: {
    CARD_WIDTH: 320,
    GAP: 16,
    SCROLL_BEHAVIOR: 'smooth',
    SNAP_TYPE: 'x mandatory'
  },
  
  // === LANGUES ===
  LANGUAGES: {
    SUPPORTED: ['fr', 'en', 'ru'],
    DEFAULT: 'fr',
    STORAGE_KEY: 'preferred-language'
  },
  
  // === NAVIGATION EXPERTISE ===
  EXPERTISE_PAGES: [
    { url: "expertise-droit-immobilier.html", title: "Droit Immobilier" },
    { url: "expertise-droit-de-la-construction.html", title: "Droit de la Construction" },
    { url: "expertise-droit-de-la-copropriete.html", title: "Droit de la Copropriété" },
    { url: "expertise-vente-forcee.html", title: "Expertise en Vente Forcée" },
    { url: "expertise-contentieux-civil-commercial.html", title: "Contentieux Civil et Commercial" },
    { url: "expertise-droit-famille.html", title: "Droit de la Famille" }
  ],
  
  // === COOKIES RGPD ===
  COOKIES: {
    BANNER_DURATION: 500,
    PREFERENCES_KEY: 'cookie-preferences',
    BANNER_DELAY: 1000
  },
  
  // === SÉLECTEURS DOM FRÉQUENTS ===
  SELECTORS: {
    LOADER: '.loader',
    HEADER: 'header.site',
    TOPBAR: '.topbar',
    DRAWER: '.drawer',
    CAROUSEL: '[data-carousel]',
    LANG_BUTTONS: '.lang button[data-lang]',
    DARK_MODE_TOGGLE: '#theme-toggle',
    MENU_TOGGLE: '.menu-toggle',
    HERO: '#hero',
    COOKIE_BANNER: '#cookie-banner',
    BLOG_FILTERS: '.blog-filters',
    FORM_VALIDATION: 'form[data-form]'
  },
  
  // === BREAKPOINTS RESPONSIVE ===
  BREAKPOINTS: {
    MOBILE: 880,
    TABLET: 960,
    DESKTOP: 1200
  },
  
  // === PERFORMANCE ===
  PERFORMANCE: {
    INTERSECTION_THRESHOLD: 0.1,
    LAZY_LOAD_MARGIN: '50px',
    CACHE_TTL: 300000, // 5 minutes
    MAX_RETRIES: 3
  },
  
  // === LOGGING ===
  LOG_LEVELS: {
    DEBUG: 'debug',
    INFO: 'info', 
    WARN: 'warn',
    ERROR: 'error'
  },
  
  // === URLS ET LIENS ===
  URLS: {
    CONSULTATION_CABINET: 'https://consultation.avocat.fr/consultation-cabinet/forms.php?source=profile&targetid=40863',
    CONSULTATION_VIDEO: 'https://consultation.avocat.fr/consultation-video/forms.php?source=profile&targetid=40863',
    CONSULTATION_ECRITE: 'https://consultation.avocat.fr/consultation-juridique/forms.php?source=profile&targetid=40863'
  },
  
  // === CONTACT ===
  CONTACT: {
    PHONE_PARIS: '+33186908435',
    PHONE_MOBILE: '+33699020888',
    EMAIL: 'contact@oudar-avocats.com'
  }
};

export default CONFIG;