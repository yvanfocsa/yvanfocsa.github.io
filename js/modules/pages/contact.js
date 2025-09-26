/**
 * Module spécifique à la page de contact
 * @fileoverview Gère les fonctionnalités spécifiques de contact.html
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class ContactPageManager {
  constructor() {
    this.contactForm = null;
    this.mapContainer = null;
    this.officeCards = [];
    this.initialized = false;
    
    featureLogger.debug('ContactPageManager created');
  }

  /**
   * Initialise le gestionnaire de la page de contact
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('ContactPageManager already initialized');
      return;
    }

    try {
      featureLogger.time('ContactPageManager initialization');
      
      // Trouve les éléments de la page
      this.contactForm = DOMUtils.select('.contact-form-grid');
      this.mapContainer = DOMUtils.select('.map-container');
      this.officeCards = DOMUtils.selectAll('.office-card');
      
      // Configure le formulaire de contact
      if (this.contactForm) {
        this.setupContactForm();
      }
      
      // Configure les cartes de bureau
      if (this.officeCards.length > 0) {
        this.setupOfficeCards();
      }
      
      // Configure la carte interactive (si présente)
      if (this.mapContainer) {
        this.setupInteractiveMap();
      }
      
      // Configure les liens de contact directs
      this.setupContactLinks();
      
      // Configure l'accessibilité spécifique
      this.setupContactAccessibility();
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('ContactPageManager initialization');
      featureLogger.success('ContactPageManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize ContactPageManager', error);
      throw error;
    }
  }

  /**
   * Configure le formulaire de contact spécifique
   */
  setupContactForm() {
    // Validation spéciale pour le formulaire de contact
    const subjectField = DOMUtils.select('select[name="subject"]', this.contactForm);
    const urgencyField = DOMUtils.select('select[name="urgency"]', this.contactForm);
    
    if (subjectField) {
      DOMUtils.addEventListenerWithCleanup(subjectField, 'change', (e) => {
        this.handleSubjectChange(e.target.value);
      });
    }

    if (urgencyField) {
      DOMUtils.addEventListenerWithCleanup(urgencyField, 'change', (e) => {
        this.handleUrgencyChange(e.target.value);
      });
    }

    // Auto-remplissage intelligent
    this.setupAutoFill();

    // Sauvegarde automatique du brouillon
    this.setupDraftSaving();

    featureLogger.debug('Contact form configured');
  }

  /**
   * Gère le changement de sujet
   * @param {string} subject Sujet sélectionné
   */
  handleSubjectChange(subject) {
    // Met à jour les suggestions de message selon le sujet
    const messageField = DOMUtils.select('textarea[name="message"]', this.contactForm);
    
    if (messageField && !messageField.value.trim()) {
      const suggestions = {
        'immobilier': 'Bonjour,\n\nJe souhaiterais obtenir des conseils concernant...',
        'construction': 'Bonjour,\n\nJe rencontre des difficultés avec mon projet de construction...',
        'copropriete': 'Bonjour,\n\nJ\'ai une question relative à ma copropriété...',
        'societes': 'Bonjour,\n\nJe souhaiterais être accompagné pour...',
        'famille': 'Bonjour,\n\nJe recherche un conseil en droit de la famille...',
        'autres': 'Bonjour,\n\nJe vous contacte pour...'
      };

      const suggestion = suggestions[subject];
      if (suggestion) {
        messageField.placeholder = suggestion;
      }
    }

    // Dispatch event pour analytics
    window.dispatchEvent(new CustomEvent('contact-subject-selected', {
      detail: { subject }
    }));

    featureLogger.debug('Contact subject changed', { subject });
  }

  /**
   * Gère le changement d'urgence
   * @param {string} urgency Niveau d'urgence
   */
  handleUrgencyChange(urgency) {
    // Met à jour le style visuel selon l'urgence
    const formContainer = this.contactForm.closest('.contact-section');
    
    if (formContainer) {
      formContainer.classList.remove('urgency-low', 'urgency-medium', 'urgency-high');
      formContainer.classList.add(`urgency-${urgency}`);
    }

    // Dispatch event pour analytics
    window.dispatchEvent(new CustomEvent('contact-urgency-selected', {
      detail: { urgency }
    }));

    featureLogger.debug('Contact urgency changed', { urgency });
  }

  /**
   * Configure l'auto-remplissage intelligent
   */
  setupAutoFill() {
    // Récupère les données stockées
    const savedData = StorageUtils.get('contact-draft');
    
    if (savedData && savedData.timestamp > Date.now() - 86400000) { // 24h
      this.fillFormWithData(savedData.data);
      this.showDraftRestoredMessage();
    }

    featureLogger.debug('Auto-fill configured');
  }

  /**
   * Remplit le formulaire avec des données
   * @param {Object} data Données à remplir
   */
  fillFormWithData(data) {
    Object.entries(data).forEach(([fieldName, value]) => {
      const field = DOMUtils.select(`[name="${fieldName}"]`, this.contactForm);
      if (field && !field.value.trim()) {
        field.value = value;
      }
    });

    featureLogger.debug('Form filled with data');
  }

  /**
   * Affiche un message de brouillon restauré
   */
  showDraftRestoredMessage() {
    const message = DOMUtils.createElement('div', {
      className: 'draft-restored-message',
      style: `
        background: #e3f2fd;
        border: 1px solid #2196f3;
        color: #1976d2;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 0.9rem;
      `
    }, '📝 Brouillon restauré automatiquement');

    this.contactForm.insertBefore(message, this.contactForm.firstChild);

    // Auto-suppression après 5 secondes
    setTimeout(() => {
      message.remove();
    }, 5000);
  }

  /**
   * Configure la sauvegarde automatique du brouillon
   */
  setupDraftSaving() {
    const fields = DOMUtils.selectAll('input, textarea, select', this.contactForm);
    
    const saveDraft = PerformanceUtils.debounce(() => {
      const formData = {};
      let hasData = false;

      fields.forEach(field => {
        if (field.name && field.value.trim()) {
          formData[field.name] = field.value.trim();
          hasData = true;
        }
      });

      if (hasData) {
        StorageUtils.set('contact-draft', {
          data: formData,
          timestamp: Date.now()
        }, 86400000); // 24h TTL

        featureLogger.debug('Contact draft saved');
      }
    }, 2000);

    // Sauvegarde à chaque changement
    fields.forEach(field => {
      DOMUtils.addEventListenerWithCleanup(field, 'input', saveDraft);
      DOMUtils.addEventListenerWithCleanup(field, 'change', saveDraft);
    });

    featureLogger.debug('Draft saving configured');
  }

  /**
   * Configure les cartes de bureau
   */
  setupOfficeCards() {
    this.officeCards.forEach(card => {
      // Analytics pour les interactions avec les bureaux
      const phoneLinks = DOMUtils.selectAll('a[href^="tel:"]', card);
      const emailLinks = DOMUtils.selectAll('a[href^="mailto:"]', card);
      const addressLinks = DOMUtils.selectAll('a[href*="maps"]', card);

      phoneLinks.forEach(link => {
        DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
          const office = this.getOfficeFromCard(card);
          
          window.dispatchEvent(new CustomEvent('office-phone-clicked', {
            detail: { office, phone: link.href }
          }));

          featureLogger.info('Office phone clicked', { office });
        });
      });

      emailLinks.forEach(link => {
        DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
          const office = this.getOfficeFromCard(card);
          
          window.dispatchEvent(new CustomEvent('office-email-clicked', {
            detail: { office, email: link.href }
          }));

          featureLogger.info('Office email clicked', { office });
        });
      });

      addressLinks.forEach(link => {
        DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
          const office = this.getOfficeFromCard(card);
          
          window.dispatchEvent(new CustomEvent('office-directions-clicked', {
            detail: { office, url: link.href }
          }));

          featureLogger.info('Office directions clicked', { office });
        });
      });
    });

    featureLogger.debug('Office cards configured');
  }

  /**
   * Détermine le bureau depuis une carte
   * @param {Element} card Carte de bureau
   * @returns {string}
   */
  getOfficeFromCard(card) {
    const title = card.querySelector('h3')?.textContent || '';
    
    if (title.toLowerCase().includes('paris')) {
      return 'Paris';
    } else if (title.toLowerCase().includes('nice')) {
      return 'Nice';
    }
    
    return 'Unknown';
  }

  /**
   * Configure la carte interactive
   */
  setupInteractiveMap() {
    // Ici on pourrait intégrer Google Maps, OpenStreetMap, etc.
    // Pour le moment, configuration de base
    
    const mapButtons = DOMUtils.selectAll('.map-office-button', this.mapContainer);
    
    mapButtons.forEach(button => {
      DOMUtils.addEventListenerWithCleanup(button, 'click', (e) => {
        e.preventDefault();
        const office = button.dataset.office;
        this.focusMapOnOffice(office);
      });
    });

    featureLogger.debug('Interactive map configured');
  }

  /**
   * Focus la carte sur un bureau
   * @param {string} office Bureau à cibler
   */
  focusMapOnOffice(office) {
    // Simulation de focus sur carte
    const coordinates = {
      'paris': { lat: 48.8747, lng: 2.3431 }, // 4 rue de Trévise
      'nice': { lat: 43.7034, lng: 7.2663 }   // 40 bd Victor Hugo
    };

    const coords = coordinates[office.toLowerCase()];
    
    if (coords) {
      // Ici on mettrait à jour la vraie carte
      featureLogger.info('Map focused on office', { office, coords });
    }
  }

  /**
   * Configure les liens de contact directs
   */
  setupContactLinks() {
    // Liens téléphone
    const phoneLinks = DOMUtils.selectAll('a[href^="tel:"]');
    phoneLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
        const phoneNumber = link.href.replace('tel:', '');
        
        window.dispatchEvent(new CustomEvent('phone-link-clicked', {
          detail: { phone: phoneNumber }
        }));

        featureLogger.info('Phone link clicked', { phone: phoneNumber });
      });
    });

    // Liens email
    const emailLinks = DOMUtils.selectAll('a[href^="mailto:"]');
    emailLinks.forEach(link => {
      DOMUtils.addEventListenerWithCleanup(link, 'click', () => {
        const email = link.href.replace('mailto:', '');
        
        window.dispatchEvent(new CustomEvent('email-link-clicked', {
          detail: { email }
        }));

        featureLogger.info('Email link clicked', { email });
      });
    });

    featureLogger.debug('Contact links configured');
  }

  /**
   * Configure l'accessibilité spécifique à la page contact
   */
  setupContactAccessibility() {
    // Ajoute des landmarks ARIA
    if (this.contactForm) {
      this.contactForm.setAttribute('role', 'form');
      this.contactForm.setAttribute('aria-label', 'Formulaire de contact');
    }

    // Améliore les cartes de bureau
    this.officeCards.forEach(card => {
      card.setAttribute('role', 'article');
      card.setAttribute('aria-label', 'Informations de bureau');
    });

    // Ajoute des descriptions contextuelles
    const urgentNotice = DOMUtils.select('.urgent-notice');
    if (urgentNotice) {
      urgentNotice.setAttribute('role', 'alert');
      urgentNotice.setAttribute('aria-live', 'polite');
    }

    featureLogger.debug('Contact accessibility configured');
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les soumissions de formulaire réussies
    window.addEventListener('form-submitted-success', (e) => {
      if (e.detail.formId === 'contact-form') {
        this.handleContactFormSuccess();
      }
    });

    // Écoute les changements de langue
    stateManager.subscribe('currentLanguage', (lang) => {
      this.updateContactInfoForLanguage(lang);
    });
  }

  /**
   * Gère le succès de soumission du formulaire de contact
   */
  handleContactFormSuccess() {
    // Supprime le brouillon sauvegardé
    StorageUtils.remove('contact-draft');
    
    // Affiche un message de confirmation personnalisé
    this.showContactSuccessMessage();
    
    // Analytics
    window.dispatchEvent(new CustomEvent('contact-form-submitted', {
      detail: { timestamp: new Date().toISOString() }
    }));

    featureLogger.success('Contact form submitted successfully');
  }

  /**
   * Affiche un message de succès personnalisé
   */
  showContactSuccessMessage() {
    const successMessage = DOMUtils.createElement('div', {
      className: 'contact-success-message',
      style: `
        background: linear-gradient(135deg, #4caf50, #45a049);
        color: white;
        padding: 24px;
        border-radius: 12px;
        text-align: center;
        margin: 24px 0;
        box-shadow: 0 4px 20px rgba(76, 175, 80, 0.3);
      `
    }, `
      <h3 style="margin: 0 0 12px; font-size: 1.3rem;">✓ Message envoyé avec succès !</h3>
      <p style="margin: 0; opacity: 0.9;">Nous vous répondrons dans les plus brefs délais.</p>
    `);

    // Insère après le formulaire
    this.contactForm.parentElement.insertBefore(
      successMessage, 
      this.contactForm.nextSibling
    );

    // Auto-suppression après 8 secondes
    setTimeout(() => {
      if (successMessage.parentElement) {
        DOMUtils.fadeOut(successMessage).then(() => {
          successMessage.remove();
        });
      }
    }, 8000);
  }

  /**
   * Met à jour les informations de contact selon la langue
   * @param {string} lang Code de langue
   */
  updateContactInfoForLanguage(lang) {
    // Met à jour les horaires d'ouverture
    const scheduleElements = DOMUtils.selectAll('.office-schedule');
    
    const schedules = {
      fr: '10h–19h sur rendez-vous',
      en: '10am–7pm by appointment',
      ru: '10:00–19:00 по записи'
    };

    const schedule = schedules[lang] || schedules.fr;
    
    scheduleElements.forEach(element => {
      element.textContent = schedule;
    });

    featureLogger.debug('Contact info updated for language', { lang });
  }

  /**
   * Valide les informations de contact
   * @param {Object} contactData Données de contact
   * @returns {Object}
   */
  validateContactInfo(contactData) {
    const errors = {};

    // Validation spécifique du sujet
    if (!contactData.subject || contactData.subject === '') {
      errors.subject = 'Veuillez sélectionner un sujet';
    }

    // Validation du message plus stricte
    if (!contactData.message || contactData.message.length < 20) {
      errors.message = 'Veuillez détailler votre demande (minimum 20 caractères)';
    }

    // Validation du téléphone si fourni
    if (contactData.telephone && contactData.telephone.trim()) {
      const phonePattern = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
      if (!phonePattern.test(contactData.telephone)) {
        errors.telephone = 'Format de téléphone invalide';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Obtient les statistiques de contact
   * @returns {Object}
   */
  getContactStats() {
    return {
      formInteractions: this.getFormInteractionStats(),
      mostClickedOffice: this.getMostClickedOffice(),
      popularSubjects: this.getPopularSubjects()
    };
  }

  /**
   * Obtient les statistiques d'interaction du formulaire
   * @returns {Object}
   */
  getFormInteractionStats() {
    // Simplifié - dans un vrai projet, on trackrait ces métriques
    return {
      formViews: 1,
      fieldInteractions: 0,
      completionRate: 0
    };
  }

  /**
   * Obtient le bureau le plus cliqué
   * @returns {string}
   */
  getMostClickedOffice() {
    // Simplifié - dans un vrai projet, on trackrait ces données
    return 'Paris';
  }

  /**
   * Obtient les sujets les plus populaires
   * @returns {Array}
   */
  getPopularSubjects() {
    // Simplifié - dans un vrai projet, on trackrait ces données
    return ['immobilier', 'construction', 'societes'];
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Sauvegarde le brouillon une dernière fois
    if (this.contactForm) {
      const saveDraftEvent = new Event('input');
      this.contactForm.dispatchEvent(saveDraftEvent);
    }

    // Nettoie les timers et observers
    // (géré automatiquement par les autres gestionnaires)

    this.initialized = false;
    featureLogger.debug('ContactPageManager destroyed');
  }

  /**
   * Obtient les statistiques de la page de contact
   * @returns {Object}
   */
  getStats() {
    return {
      hasForm: Boolean(this.contactForm),
      officeCardsCount: this.officeCards.length,
      hasMap: Boolean(this.mapContainer),
      contactStats: this.getContactStats(),
      initialized: this.initialized
    };
  }
}

// Instance singleton
let contactPageManager = null;

/**
 * Obtient l'instance du gestionnaire de page de contact
 * @returns {ContactPageManager}
 */
export function getContactPageManager() {
  if (!contactPageManager) {
    contactPageManager = new ContactPageManager();
  }
  return contactPageManager;
}

/**
 * Initialise le gestionnaire de page de contact
 * @returns {Promise<ContactPageManager>}
 */
export async function initContactPageManager() {
  const manager = getContactPageManager();
  await manager.init();
  return manager;
}

export default { ContactPageManager, getContactPageManager, initContactPageManager };