/**
 * Module spécifique aux pages d'équipe
 * @fileoverview Gère les fonctionnalités spécifiques des pages team-*.html
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class TeamPageManager {
  constructor() {
    this.profileLayout = null;
    this.contactSection = null;
    this.memberData = null;
    this.initialized = false;
    
    featureLogger.debug('TeamPageManager created');
  }

  /**
   * Initialise le gestionnaire des pages d'équipe
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('TeamPageManager already initialized');
      return;
    }

    try {
      featureLogger.time('TeamPageManager initialization');
      
      // Trouve les éléments de la page
      this.profileLayout = DOMUtils.select('.team-profile-layout');
      this.contactSection = DOMUtils.select('.team-contact-row');
      
      if (!this.profileLayout && !this.contactSection) {
        featureLogger.debug('No team page elements found');
        return;
      }
      
      // Extrait les informations du membre
      this.extractMemberData();
      
      // Configure la section profil
      if (this.profileLayout) {
        this.setupProfileSection();
      }
      
      // Configure la section contact
      if (this.contactSection) {
        this.setupContactSection();
      }
      
      // Configure la navigation entre membres
      this.setupTeamNavigation();
      
      // Configure l'accessibilité spécifique
      this.setupTeamAccessibility();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('TeamPageManager initialization');
      featureLogger.success('TeamPageManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize TeamPageManager', error);
      throw error;
    }
  }

  /**
   * Extrait les données du membre de la page
   */
  extractMemberData() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Mapping des pages vers les données membres
    const memberMapping = {
      'team-svetlana.html': {
        name: 'Svetlana OUDAR',
        role: 'Avocate Fondatrice',
        email: 'svetlana.oudar@oudar-avocats.com',
        specialties: ['Droit Immobilier', 'Droit de la Construction', 'Droit des Sociétés'],
        languages: ['Français', 'Anglais', 'Russe'],
        barNumber: 'Barreau de Paris',
        experience: '15+ années'
      },
      'team-sharon.html': {
        name: 'Sharon ATTIA-ZEITOUN',
        role: 'Avocate Collaboratrice', 
        email: 'sharon.attia@oudar-avocats.com',
        specialties: ['Droit de la Famille', 'Droit des Étrangers', 'Médiation'],
        languages: ['Français', 'Anglais', 'Hébreu'],
        barNumber: 'Barreau de Paris',
        experience: '8+ années'
      },
      'team-leonie.html': {
        name: 'Léonie SARR SOW',
        role: 'Clerc d\'Avocat',
        email: 'leonie.sarr@oudar-avocats.com',
        specialties: ['Assistance juridique', 'Gestion des dossiers'],
        languages: ['Français', 'Anglais'],
        experience: '5+ années'
      }
    };

    this.memberData = memberMapping[currentPage] || null;

    if (this.memberData) {
      featureLogger.debug('Member data extracted', this.memberData);
    } else {
      featureLogger.warn('Unknown team member page', currentPage);
    }
  }

  /**
   * Configure la section profil
   */
  setupProfileSection() {
    const profileImage = DOMUtils.select('.team-profile-img img', this.profileLayout);
    const profileContent = DOMUtils.select('.team-profile-content', this.profileLayout);
    
    if (profileImage) {
      this.setupProfileImage(profileImage);
    }
    
    if (profileContent) {
      this.setupProfileContent(profileContent);
    }

    featureLogger.debug('Profile section configured');
  }

  /**
   * Configure l'image de profil
   * @param {Element} image Image de profil
   */
  setupProfileImage(image) {
    // Améliore le chargement de l'image
    if (!image.complete) {
      image.addEventListener('load', () => {
        image.classList.add('loaded');
        this.animateImageIn(image);
      }, { once: true });
      
      image.addEventListener('error', () => {
        this.handleImageError(image);
      }, { once: true });
    } else {
      image.classList.add('loaded');
    }

    // Ajoute des effets d'interaction
    DOMUtils.addEventListenerWithCleanup(image, 'click', () => {
      this.showImageModal(image);
    });

    featureLogger.debug('Profile image configured');
  }

  /**
   * Anime l'apparition de l'image
   * @param {Element} image Image
   */
  animateImageIn(image) {
    image.style.opacity = '0';
    image.style.transform = 'scale(0.95)';
    
    PerformanceUtils.raf(() => {
      image.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      image.style.opacity = '1';
      image.style.transform = 'scale(1)';
      
      setTimeout(() => {
        image.style.transition = '';
      }, 600);
    });
  }

  /**
   * Gère l'erreur de chargement d'image
   * @param {Element} image Image en erreur
   */
  handleImageError(image) {
    // Remplace par une image par défaut ou une icône
    image.src = 'assets/default-avatar.png';
    image.alt = 'Photo non disponible';
    
    featureLogger.warn('Profile image failed to load', image.src);
  }

  /**
   * Affiche l'image en modal
   * @param {Element} image Image à afficher
   */
  showImageModal(image) {
    const modal = DOMUtils.createElement('div', {
      className: 'image-modal',
      style: `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        cursor: pointer;
      `
    });

    const modalImage = DOMUtils.createElement('img', {
      src: image.src,
      alt: image.alt,
      style: `
        max-width: 90vw;
        max-height: 90vh;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      `
    });

    modal.appendChild(modalImage);
    document.body.appendChild(modal);

    // Fermeture par clic
    DOMUtils.addEventListenerWithCleanup(modal, 'click', () => {
      modal.remove();
    });

    // Fermeture par Échap
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeOnEscape);
      }
    };
    
    document.addEventListener('keydown', closeOnEscape);

    featureLogger.debug('Image modal shown');
  }

  /**
   * Configure le contenu du profil
   * @param {Element} content Contenu du profil
   */
  setupProfileContent(content) {
    // Ajoute des liens dynamiques dans la bio
    this.enhanceBioLinks(content);
    
    // Configure les animations de texte
    this.setupTextAnimations(content);

    featureLogger.debug('Profile content configured');
  }

  /**
   * Améliore les liens dans la biographie
   * @param {Element} content Contenu du profil
   */
  enhanceBioLinks(content) {
    const paragraphs = DOMUtils.selectAll('p', content);
    
    paragraphs.forEach(p => {
      let text = p.innerHTML;
      
      // Transforme les mentions d'expertise en liens
      CONFIG.EXPERTISE_PAGES.forEach(expertise => {
        const expertiseTitle = expertise.title;
        const regex = new RegExp(`\\b${expertiseTitle}\\b`, 'gi');
        
        text = text.replace(regex, (match) => {
          return `<a href="${expertise.url}" class="bio-link">${match}</a>`;
        });
      });
      
      p.innerHTML = text;
    });

    // Configure les nouveaux liens
    const bioLinks = DOMUtils.selectAll('.bio-link', content);
    bioLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', (e) => {
        const expertise = e.target.textContent;
        
        window.dispatchEvent(new CustomEvent('bio-expertise-clicked', {
          detail: { 
            member: this.memberData?.name,
            expertise
          }
        }));

        featureLogger.info('Bio expertise link clicked', { expertise });
      });
    });

    featureLogger.debug('Bio links enhanced');
  }

  /**
   * Configure les animations de texte
   * @param {Element} content Contenu
   */
  setupTextAnimations(content) {
    const textElements = DOMUtils.selectAll('h1, p', content);
    
    textElements.forEach((element, index) => {
      element.dataset.animate = 'fadeIn';
      element.dataset.delay = (index * 150).toString();
    });

    featureLogger.debug('Text animations configured');
  }

  /**
   * Configure la section contact
   */
  setupContactSection() {
    const contactButton = DOMUtils.select('.btn', this.contactSection);
    const languagesSection = DOMUtils.select('.team-languages', this.contactSection);
    
    if (contactButton) {
      this.setupContactButton(contactButton);
    }
    
    if (languagesSection) {
      this.setupLanguagesSection(languagesSection);
    }

    featureLogger.debug('Contact section configured');
  }

  /**
   * Configure le bouton de contact
   * @param {Element} button Bouton de contact
   */
  setupContactButton(button) {
    DOMUtils.addEventListenerWithCleanup(button, 'click', (e) => {
      // Analytics pour le contact depuis une page équipe
      window.dispatchEvent(new CustomEvent('team-contact-clicked', {
        detail: { 
          member: this.memberData?.name,
          contactMethod: button.href.startsWith('mailto:') ? 'email' : 'form'
        }
      }));

      featureLogger.info('Team contact button clicked', { 
        member: this.memberData?.name 
      });
    });

    // Effets visuels améliorés
    DOMUtils.addEventListenerWithCleanup(button, 'mouseenter', () => {
      button.classList.add('contact-hover');
    });

    DOMUtils.addEventListenerWithCleanup(button, 'mouseleave', () => {
      button.classList.remove('contact-hover');
    });
  }

  /**
   * Configure la section des langues
   * @param {Element} section Section des langues
   */
  setupLanguagesSection(section) {
    if (!this.memberData?.languages) return;

    // Ajoute des indicateurs visuels pour les langues
    const languagesList = DOMUtils.select('p', section);
    
    if (languagesList) {
      // Améliore l'affichage des langues
      const languages = this.memberData.languages;
      const languagesHTML = languages.map(lang => {
        const flag = this.getLanguageFlag(lang);
        return `<span class="language-item">${flag} ${lang}</span>`;
      }).join(', ');
      
      languagesList.innerHTML = languagesHTML;
    }

    featureLogger.debug('Languages section configured');
  }

  /**
   * Obtient le drapeau pour une langue
   * @param {string} language Nom de la langue
   * @returns {string}
   */
  getLanguageFlag(language) {
    const flags = {
      'Français': '🇫🇷',
      'Anglais': '🇬🇧', 
      'Russe': '🇷🇺',
      'Hébreu': '🇮🇱',
      'Espagnol': '🇪🇸',
      'Italien': '🇮🇹',
      'Allemand': '🇩🇪'
    };
    
    return flags[language] || '🌐';
  }

  /**
   * Configure la navigation entre membres de l'équipe
   */
  setupTeamNavigation() {
    const teamPages = [
      { url: 'team-svetlana.html', name: 'Svetlana OUDAR' },
      { url: 'team-sharon.html', name: 'Sharon ATTIA-ZEITOUN' },
      { url: 'team-leonie.html', name: 'Léonie SARR SOW' }
    ];

    const currentPage = window.location.pathname.split('/').pop();
    const currentIndex = teamPages.findIndex(page => page.url === currentPage);
    
    if (currentIndex === -1) return;

    // Crée la navigation entre membres
    this.createTeamNavigation(teamPages, currentIndex);

    featureLogger.debug('Team navigation configured');
  }

  /**
   * Crée la navigation entre membres
   * @param {Array} teamPages Pages de l'équipe
   * @param {number} currentIndex Index actuel
   */
  createTeamNavigation(teamPages, currentIndex) {
    const navigation = DOMUtils.createElement('nav', {
      className: 'team-navigation',
      'aria-label': 'Navigation entre les membres de l\'équipe',
      style: `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 40px 0 20px;
        padding: 20px;
        background: var(--surface);
        border-radius: 12px;
        border: 1px solid var(--line);
      `
    });

    // Membre précédent
    const prevIndex = (currentIndex - 1 + teamPages.length) % teamPages.length;
    const prevMember = teamPages[prevIndex];
    
    const prevLink = DOMUtils.createElement('a', {
      href: prevMember.url,
      className: 'team-nav-prev',
      'aria-label': `Membre précédent: ${prevMember.name}`,
      style: 'text-decoration: none; color: var(--muted); font-weight: 600;'
    }, `← ${prevMember.name}`);

    // Membre suivant
    const nextIndex = (currentIndex + 1) % teamPages.length;
    const nextMember = teamPages[nextIndex];
    
    const nextLink = DOMUtils.createElement('a', {
      href: nextMember.url,
      className: 'team-nav-next',
      'aria-label': `Membre suivant: ${nextMember.name}`,
      style: 'text-decoration: none; color: var(--muted); font-weight: 600;'
    }, `${nextMember.name} →`);

    // Indicateur de position
    const position = DOMUtils.createElement('span', {
      className: 'team-nav-position',
      style: 'color: var(--brand); font-weight: 700;'
    }, `${currentIndex + 1} / ${teamPages.length}`);

    navigation.appendChild(prevLink);
    navigation.appendChild(position);
    navigation.appendChild(nextLink);

    // Insère la navigation
    const mainSection = DOMUtils.select('main .section');
    if (mainSection) {
      mainSection.appendChild(navigation);
    }

    // Analytics pour la navigation
    [prevLink, nextLink].forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', (e) => {
        const direction = link.classList.contains('team-nav-prev') ? 'previous' : 'next';
        const targetMember = link.textContent.replace(/[←→]/g, '').trim();
        
        window.dispatchEvent(new CustomEvent('team-navigation', {
          detail: { 
            direction,
            from: this.memberData?.name,
            to: targetMember
          }
        }));

        featureLogger.info('Team navigation clicked', { direction, targetMember });
      });
    });
  }

  /**
   * Configure l'accessibilité spécifique aux pages équipe
   */
  setupTeamAccessibility() {
    // Ajoute des rôles ARIA appropriés
    if (this.profileLayout) {
      this.profileLayout.setAttribute('role', 'article');
      this.profileLayout.setAttribute('aria-label', `Profil de ${this.memberData?.name || 'membre de l\'équipe'}`);
    }

    // Améliore la section contact
    if (this.contactSection) {
      this.contactSection.setAttribute('role', 'complementary');
      this.contactSection.setAttribute('aria-label', 'Informations de contact');
    }

    // Ajoute des descriptions pour les spécialisations
    const specialtiesList = DOMUtils.select('.team-list');
    if (specialtiesList && this.memberData?.specialties) {
      specialtiesList.setAttribute('aria-label', 
        `Spécialisations de ${this.memberData.name}: ${this.memberData.specialties.join(', ')}`
      );
    }

    featureLogger.debug('Team accessibility configured');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', (lang) => {
      this.updateContentForLanguage(lang);
    });

    // Écoute les changements de viewport
    stateManager.subscribe('isMobile', (isMobile) => {
      this.updateLayoutForViewport(isMobile);
    });
  }

  /**
   * Met à jour le contenu selon la langue
   * @param {string} lang Code de langue
   */
  updateContentForLanguage(lang) {
    // Met à jour les labels d'accessibilité
    if (this.profileLayout) {
      const memberName = this.memberData?.name || 'membre de l\'équipe';
      const label = lang === 'en' ? `Profile of ${memberName}` :
                   lang === 'ru' ? `Профиль ${memberName}` :
                   `Profil de ${memberName}`;
      
      this.profileLayout.setAttribute('aria-label', label);
    }

    featureLogger.debug('Content updated for language', { lang });
  }

  /**
   * Met à jour la mise en page selon le viewport
   * @param {boolean} isMobile Vue mobile
   */
  updateLayoutForViewport(isMobile) {
    if (this.profileLayout) {
      if (isMobile) {
        this.profileLayout.classList.add('mobile-layout');
      } else {
        this.profileLayout.classList.remove('mobile-layout');
      }
    }

    featureLogger.debug('Layout updated for viewport', { isMobile });
  }

  /**
   * Ajoute des métadonnées structurées pour le membre
   */
  addStructuredData() {
    if (!this.memberData) return;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": this.memberData.name,
      "jobTitle": this.memberData.role,
      "worksFor": {
        "@type": "LegalService",
        "name": "OUDAR Avocats"
      },
      "email": this.memberData.email,
      "knowsLanguage": this.memberData.languages,
      "hasOccupation": {
        "@type": "Occupation",
        "name": "Avocat",
        "occupationLocation": {
          "@type": "City",
          "name": "Paris"
        }
      }
    };

    const script = DOMUtils.createElement('script', {
      type: 'application/ld+json'
    }, JSON.stringify(structuredData, null, 2));

    document.head.appendChild(script);

    featureLogger.debug('Structured data added for team member');
  }

  /**
   * Obtient les statistiques de la page équipe
   * @returns {Object}
   */
  getPageStats() {
    return {
      memberName: this.memberData?.name,
      memberRole: this.memberData?.role,
      specialtiesCount: this.memberData?.specialties?.length || 0,
      languagesCount: this.memberData?.languages?.length || 0,
      hasContactSection: Boolean(this.contactSection),
      hasProfileLayout: Boolean(this.profileLayout)
    };
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Retire les modales ouvertes
    const modal = DOMUtils.select('.image-modal');
    if (modal) {
      modal.remove();
    }

    // Nettoie les animations en cours
    const animatedElements = DOMUtils.selectAll('[style*="transition"]', this.profileLayout);
    animatedElements.forEach(element => {
      element.style.transition = '';
      element.style.opacity = '';
      element.style.transform = '';
    });

    this.initialized = false;
    featureLogger.debug('TeamPageManager destroyed');
  }

  /**
   * Obtient les statistiques complètes
   * @returns {Object}
   */
  getStats() {
    return {
      memberData: this.memberData,
      pageStats: this.getPageStats(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let teamPageManager = null;

/**
 * Obtient l'instance du gestionnaire de page équipe
 * @returns {TeamPageManager}
 */
export function getTeamPageManager() {
  if (!teamPageManager) {
    teamPageManager = new TeamPageManager();
  }
  return teamPageManager;
}

/**
 * Initialise le gestionnaire de page équipe
 * @returns {Promise<TeamPageManager>}
 */
export async function initTeamPageManager() {
  const manager = getTeamPageManager();
  await manager.init();
  return manager;
}

export default { TeamPageManager, getTeamPageManager, initTeamPageManager };