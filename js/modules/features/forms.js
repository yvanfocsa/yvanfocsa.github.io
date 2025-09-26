/**
 * Module de gestion des formulaires
 * @fileoverview Gère la validation, soumission et UX des formulaires
 */

import CONFIG from '../../config/settings.js';
import DOMUtils from '../../utils/dom.js';
import { featureLogger } from '../../utils/logger.js';
import { stateManager } from '../../utils/stateManager.js';

export class FormsManager {
  constructor() {
    this.forms = new Map();
    this.initialized = false;
    this.validationRules = new Map();
    
    featureLogger.debug('FormsManager created');
  }

  /**
   * Initialise le gestionnaire de formulaires
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      featureLogger.debug('FormsManager already initialized');
      return;
    }

    try {
      featureLogger.time('FormsManager initialization');
      
      // Trouve tous les formulaires
      const formElements = DOMUtils.selectAll(CONFIG.SELECTORS.FORM_VALIDATION);
      
      if (formElements.length === 0) {
        featureLogger.debug('No forms found');
        return;
      }
      
      // Configure les règles de validation par défaut
      this.setupDefaultValidationRules();
      
      // Initialise chaque formulaire
      formElements.forEach(form => {
        this.setupForm(form);
      });
      
      // Écoute les changements d'état
      this.setupStateSubscriptions();
      
      this.initialized = true;
      featureLogger.timeEnd('FormsManager initialization');
      featureLogger.success('FormsManager initialized');
      
    } catch (error) {
      featureLogger.error('Failed to initialize FormsManager', error);
      throw error;
    }
  }

  /**
   * Configure les règles de validation par défaut
   */
  setupDefaultValidationRules() {
    // Email
    this.validationRules.set('email', {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Veuillez entrer une adresse email valide'
    });

    // Téléphone français
    this.validationRules.set('tel', {
      pattern: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
      message: 'Veuillez entrer un numéro de téléphone valide'
    });

    // Nom (au moins 2 caractères)
    this.validationRules.set('name', {
      pattern: /^.{2,}$/,
      message: 'Le nom doit contenir au moins 2 caractères'
    });

    // Message (au moins 10 caractères)
    this.validationRules.set('message', {
      pattern: /^.{10,}$/,
      message: 'Le message doit contenir au moins 10 caractères'
    });

    featureLogger.debug('Default validation rules configured');
  }

  /**
   * Configure un formulaire
   * @param {Element} form Élément formulaire
   */
  setupForm(form) {
    const formId = form.id || `form-${Date.now()}`;
    
    if (this.forms.has(form)) {
      featureLogger.debug('Form already configured', form);
      return;
    }

    const formData = {
      element: form,
      id: formId,
      fields: new Map(),
      isValid: false,
      isSubmitting: false,
      errors: new Map()
    };

    // Configure les champs
    this.setupFormFields(formData);
    
    // Configure la soumission
    this.setupFormSubmission(formData);
    
    // Configure la validation en temps réel
    this.setupRealTimeValidation(formData);
    
    // Ajoute à la collection
    this.forms.set(form, formData);
    
    // Met à jour l'état global
    const formStates = stateManager.getState('formStates');
    formStates.set(formId, {
      isValid: formData.isValid,
      isSubmitting: formData.isSubmitting
    });
    stateManager.setState('formStates', formStates);

    featureLogger.debug('Form configured', { id: formId, fields: formData.fields.size });
  }

  /**
   * Configure les champs d'un formulaire
   * @param {Object} formData Données du formulaire
   */
  setupFormFields(formData) {
    const fields = DOMUtils.selectAll('input, textarea, select', formData.element);
    
    fields.forEach(field => {
      const fieldName = field.name || field.id;
      if (!fieldName) return;

      const fieldData = {
        element: field,
        name: fieldName,
        type: field.type,
        required: field.required,
        valid: true,
        error: null
      };

      // Ajoute les attributs d'accessibilité
      this.setupFieldAccessibility(fieldData);
      
      // Configure la validation du champ
      this.setupFieldValidation(fieldData);
      
      formData.fields.set(fieldName, fieldData);
    });

    featureLogger.debug(`Configured ${formData.fields.size} form fields`);
  }

  /**
   * Configure l'accessibilité d'un champ
   * @param {Object} fieldData Données du champ
   */
  setupFieldAccessibility(fieldData) {
    const { element, name } = fieldData;
    
    // Associe le label
    const label = DOMUtils.select(`label[for="${element.id}"]`) || 
                  DOMUtils.select(`label`, element.parentElement);
    
    if (label && !element.getAttribute('aria-labelledby')) {
      const labelId = label.id || `label-${name}`;
      label.id = labelId;
      element.setAttribute('aria-labelledby', labelId);
    }

    // Ajoute un conteneur pour les messages d'erreur
    if (!DOMUtils.select('.field-error', element.parentElement)) {
      const errorContainer = DOMUtils.createElement('div', {
        className: 'field-error',
        id: `error-${name}`,
        'aria-live': 'polite'
      });
      
      element.parentElement.appendChild(errorContainer);
      element.setAttribute('aria-describedby', `error-${name}`);
    }
  }

  /**
   * Configure la validation d'un champ
   * @param {Object} fieldData Données du champ
   */
  setupFieldValidation(fieldData) {
    const { element } = fieldData;

    // Validation à la perte de focus
    DOMUtils.addEventListenerWithCleanup(element, 'blur', () => {
      this.validateField(fieldData);
    });

    // Validation en temps réel pour certains types
    if (element.type === 'email' || element.type === 'tel') {
      const debouncedValidation = PerformanceUtils.debounce(() => {
        this.validateField(fieldData);
      }, 500);

      DOMUtils.addEventListenerWithCleanup(element, 'input', debouncedValidation);
    }

    // Nettoyage de l'erreur lors de la saisie
    DOMUtils.addEventListenerWithCleanup(element, 'input', () => {
      this.clearFieldError(fieldData);
    });
  }

  /**
   * Valide un champ
   * @param {Object} fieldData Données du champ
   * @returns {boolean}
   */
  validateField(fieldData) {
    const { element, name, required } = fieldData;
    const value = element.value.trim();

    // Reset l'état d'erreur
    this.clearFieldError(fieldData);

    // Validation required
    if (required && !value) {
      this.setFieldError(fieldData, 'Ce champ est obligatoire');
      return false;
    }

    // Validation par type
    if (value && element.type) {
      const rule = this.validationRules.get(element.type) || 
                   this.validationRules.get(name);
      
      if (rule && !rule.pattern.test(value)) {
        this.setFieldError(fieldData, rule.message);
        return false;
      }
    }

    // Validation HTML5 native
    if (!element.checkValidity()) {
      this.setFieldError(fieldData, element.validationMessage);
      return false;
    }

    // Validation réussie
    fieldData.valid = true;
    fieldData.error = null;
    element.classList.remove('field-error');
    element.classList.add('field-valid');
    element.removeAttribute('aria-invalid');

    return true;
  }

  /**
   * Définit une erreur sur un champ
   * @param {Object} fieldData Données du champ
   * @param {string} errorMessage Message d'erreur
   */
  setFieldError(fieldData, errorMessage) {
    const { element, name } = fieldData;
    
    fieldData.valid = false;
    fieldData.error = errorMessage;
    
    // Met à jour l'interface
    element.classList.add('field-error');
    element.classList.remove('field-valid');
    element.setAttribute('aria-invalid', 'true');
    
    // Affiche le message d'erreur
    const errorContainer = DOMUtils.select(`#error-${name}`);
    if (errorContainer) {
      errorContainer.textContent = errorMessage;
      errorContainer.style.display = 'block';
    }

    featureLogger.debug(`Field error set: ${name} - ${errorMessage}`);
  }

  /**
   * Efface l'erreur d'un champ
   * @param {Object} fieldData Données du champ
   */
  clearFieldError(fieldData) {
    const { element, name } = fieldData;
    
    element.classList.remove('field-error');
    element.removeAttribute('aria-invalid');
    
    const errorContainer = DOMUtils.select(`#error-${name}`);
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.style.display = 'none';
    }
  }

  /**
   * Configure la soumission du formulaire
   * @param {Object} formData Données du formulaire
   */
  setupFormSubmission(formData) {
    DOMUtils.addEventListenerWithCleanup(formData.element, 'submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmission(formData);
    });
  }

  /**
   * Gère la soumission du formulaire
   * @param {Object} formData Données du formulaire
   */
  async handleFormSubmission(formData) {
    if (formData.isSubmitting) {
      featureLogger.debug('Form already submitting');
      return;
    }

    try {
      featureLogger.info('Form submission started');
      
      // Valide tous les champs
      const isValid = this.validateForm(formData);
      
      if (!isValid) {
        this.focusFirstError(formData);
        featureLogger.warn('Form validation failed');
        return;
      }

      // Met à jour l'état de soumission
      formData.isSubmitting = true;
      this.updateSubmitButton(formData, true);
      
      // Collecte les données
      const formValues = this.collectFormData(formData);
      
      // Simule l'envoi (remplacer par vraie logique)
      await this.submitFormData(formValues);
      
      // Succès
      this.handleSubmissionSuccess(formData);
      
    } catch (error) {
      featureLogger.error('Form submission failed', error);
      this.handleSubmissionError(formData, error);
    } finally {
      // Reset l'état de soumission
      formData.isSubmitting = false;
      this.updateSubmitButton(formData, false);
    }
  }

  /**
   * Valide tout le formulaire
   * @param {Object} formData Données du formulaire
   * @returns {boolean}
   */
  validateForm(formData) {
    let isValid = true;

    formData.fields.forEach(fieldData => {
      if (!this.validateField(fieldData)) {
        isValid = false;
      }
    });

    formData.isValid = isValid;
    return isValid;
  }

  /**
   * Focus sur le premier champ en erreur
   * @param {Object} formData Données du formulaire
   */
  focusFirstError(formData) {
    const firstErrorField = Array.from(formData.fields.values())
      .find(fieldData => !fieldData.valid);
    
    if (firstErrorField) {
      firstErrorField.element.focus();
      
      // Scroll vers le champ si nécessaire
      DOMUtils.scrollTo(firstErrorField.element, {
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  /**
   * Met à jour le bouton de soumission
   * @param {Object} formData Données du formulaire
   * @param {boolean} isSubmitting État de soumission
   */
  updateSubmitButton(formData, isSubmitting) {
    const submitButton = DOMUtils.select('button[type="submit"]', formData.element);
    
    if (!submitButton) return;

    if (isSubmitting) {
      submitButton.disabled = true;
      submitButton.classList.add('submitting');
      
      // Sauvegarde le texte original
      if (!submitButton.dataset.originalText) {
        submitButton.dataset.originalText = submitButton.textContent;
      }
      
      submitButton.textContent = 'Envoi en cours...';
      
      // Ajoute un spinner si désiré
      this.addSpinnerToButton(submitButton);
      
    } else {
      submitButton.disabled = false;
      submitButton.classList.remove('submitting');
      
      // Restaure le texte original
      if (submitButton.dataset.originalText) {
        submitButton.textContent = submitButton.dataset.originalText;
      }
      
      this.removeSpinnerFromButton(submitButton);
    }
  }

  /**
   * Ajoute un spinner au bouton
   * @param {Element} button Bouton
   */
  addSpinnerToButton(button) {
    if (DOMUtils.select('.spinner', button)) return;

    const spinner = DOMUtils.createElement('span', {
      className: 'spinner',
      style: `
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-left: 8px;
      `
    });

    button.appendChild(spinner);

    // Ajoute l'animation CSS si elle n'existe pas
    if (!document.querySelector('#spinner-animation')) {
      const style = document.createElement('style');
      style.id = 'spinner-animation';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Retire le spinner du bouton
   * @param {Element} button Bouton
   */
  removeSpinnerFromButton(button) {
    const spinner = DOMUtils.select('.spinner', button);
    if (spinner) {
      spinner.remove();
    }
  }

  /**
   * Collecte les données du formulaire
   * @param {Object} formData Données du formulaire
   * @returns {Object}
   */
  collectFormData(formData) {
    const data = {};
    
    formData.fields.forEach((fieldData, fieldName) => {
      data[fieldName] = fieldData.element.value.trim();
    });

    // Ajoute des métadonnées
    data._meta = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      language: stateManager.getState('currentLanguage')
    };

    return data;
  }

  /**
   * Soumet les données du formulaire
   * @param {Object} formValues Valeurs du formulaire
   * @returns {Promise<Object>}
   */
  async submitFormData(formValues) {
    // Simule un appel API
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simule 90% de succès
        if (Math.random() > 0.1) {
          resolve({
            success: true,
            id: 'submission-' + Date.now(),
            message: 'Message envoyé avec succès'
          });
        } else {
          reject(new Error('Erreur serveur simulée'));
        }
      }, 1500); // Simule une latence réseau
    });
  }

  /**
   * Gère le succès de soumission
   * @param {Object} formData Données du formulaire
   */
  handleSubmissionSuccess(formData) {
    // Affiche un message de succès
    this.showSuccessMessage(formData);
    
    // Reset le formulaire
    this.resetForm(formData);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('form-submitted-success', {
      detail: { formId: formData.id }
    }));

    featureLogger.success('Form submitted successfully');
  }

  /**
   * Gère l'erreur de soumission
   * @param {Object} formData Données du formulaire
   * @param {Error} error Erreur
   */
  handleSubmissionError(formData, error) {
    // Affiche un message d'erreur
    this.showErrorMessage(formData, error.message);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('form-submitted-error', {
      detail: { 
        formId: formData.id,
        error: error.message
      }
    }));

    featureLogger.error('Form submission failed', error);
  }

  /**
   * Affiche un message de succès
   * @param {Object} formData Données du formulaire
   */
  showSuccessMessage(formData) {
    this.showMessage(formData, 'Votre message a été envoyé avec succès !', 'success');
  }

  /**
   * Affiche un message d'erreur
   * @param {Object} formData Données du formulaire
   * @param {string} errorMessage Message d'erreur
   */
  showErrorMessage(formData, errorMessage) {
    this.showMessage(formData, `Erreur lors de l'envoi : ${errorMessage}`, 'error');
  }

  /**
   * Affiche un message générique
   * @param {Object} formData Données du formulaire
   * @param {string} message Message à afficher
   * @param {string} type Type de message (success, error, info)
   */
  showMessage(formData, message, type = 'info') {
    // Retire l'ancien message s'il existe
    const oldMessage = DOMUtils.select('.form-message', formData.element.parentElement);
    if (oldMessage) {
      oldMessage.remove();
    }

    // Crée le nouveau message
    const messageElement = DOMUtils.createElement('div', {
      className: `form-message form-message--${type}`,
      style: `
        padding: 16px;
        margin: 16px 0;
        border-radius: 8px;
        font-weight: 600;
        text-align: center;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
      `
    }, message);

    // Insère après le formulaire
    formData.element.parentElement.insertBefore(messageElement, formData.element.nextSibling);

    // Auto-suppression après 5 secondes
    setTimeout(() => {
      if (messageElement.parentElement) {
        messageElement.remove();
      }
    }, 5000);
  }

  /**
   * Remet le formulaire à zéro
   * @param {Object} formData Données du formulaire
   */
  resetForm(formData) {
    // Reset les champs
    formData.element.reset();
    
    // Nettoie les erreurs
    formData.fields.forEach(fieldData => {
      this.clearFieldError(fieldData);
      fieldData.valid = true;
      fieldData.error = null;
      fieldData.element.classList.remove('field-error', 'field-valid');
    });

    // Met à jour l'état
    formData.isValid = false;
    formData.errors.clear();

    featureLogger.debug('Form reset');
  }

  /**
   * Configure la validation en temps réel
   * @param {Object} formData Données du formulaire
   */
  setupRealTimeValidation(formData) {
    // Valide le formulaire quand un champ change
    formData.fields.forEach(fieldData => {
      DOMUtils.addEventListenerWithCleanup(fieldData.element, 'blur', () => {
        setTimeout(() => {
          this.updateFormValidState(formData);
        }, 100);
      });
    });
  }

  /**
   * Met à jour l'état de validité du formulaire
   * @param {Object} formData Données du formulaire
   */
  updateFormValidState(formData) {
    const isValid = Array.from(formData.fields.values()).every(field => field.valid);
    formData.isValid = isValid;

    // Met à jour l'état global
    const formStates = stateManager.getState('formStates');
    formStates.set(formData.id, {
      isValid: formData.isValid,
      isSubmitting: formData.isSubmitting
    });
    stateManager.setState('formStates', formStates);

    // Met à jour le bouton de soumission
    const submitButton = DOMUtils.select('button[type="submit"]', formData.element);
    if (submitButton) {
      submitButton.classList.toggle('form-valid', isValid);
    }
  }

  /**
   * Configure les souscriptions aux changements d'état
   */
  setupStateSubscriptions() {
    // Écoute les changements de langue pour mettre à jour les messages
    stateManager.subscribe('currentLanguage', () => {
      this.updateValidationMessages();
    });
  }

  /**
   * Met à jour les messages de validation selon la langue
   */
  updateValidationMessages() {
    // Ici on pourrait charger les messages de validation dans la langue appropriée
    // Pour le moment, on garde les messages en français
  }

  /**
   * Ajoute une règle de validation personnalisée
   * @param {string} fieldType Type de champ
   * @param {RegExp} pattern Pattern de validation
   * @param {string} message Message d'erreur
   */
  addValidationRule(fieldType, pattern, message) {
    this.validationRules.set(fieldType, { pattern, message });
    featureLogger.debug(`Validation rule added: ${fieldType}`);
  }

  /**
   * Supprime un formulaire
   * @param {Element} form Formulaire à supprimer
   */
  removeForm(form) {
    const formData = this.forms.get(form);
    if (formData) {
      // Nettoie les event listeners
      formData.fields.forEach(fieldData => {
        DOMUtils.cleanupEventListeners(fieldData.element);
      });
      
      DOMUtils.cleanupEventListeners(form);
      
      this.forms.delete(form);
      
      // Met à jour l'état global
      const formStates = stateManager.getState('formStates');
      formStates.delete(formData.id);
      stateManager.setState('formStates', formStates);

      featureLogger.debug('Form removed');
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    // Nettoie tous les formulaires
    this.forms.forEach((formData, form) => {
      this.removeForm(form);
    });
    
    this.forms.clear();
    this.validationRules.clear();
    this.initialized = false;

    featureLogger.debug('FormsManager destroyed');
  }

  /**
   * Obtient les statistiques des formulaires
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalForms: this.forms.size,
      validForms: 0,
      submittingForms: 0,
      totalFields: 0,
      validFields: 0,
      initialized: this.initialized
    };

    this.forms.forEach(formData => {
      if (formData.isValid) stats.validForms++;
      if (formData.isSubmitting) stats.submittingForms++;
      
      stats.totalFields += formData.fields.size;
      
      formData.fields.forEach(fieldData => {
        if (fieldData.valid) stats.validFields++;
      });
    });

    return stats;
  }
}

// Instance singleton
let formsManager = null;

/**
 * Obtient l'instance du gestionnaire de formulaires
 * @returns {FormsManager}
 */
export function getFormsManager() {
  if (!formsManager) {
    formsManager = new FormsManager();
  }
  return formsManager;
}

/**
 * Initialise le gestionnaire de formulaires
 * @returns {Promise<FormsManager>}
 */
export async function initFormsManager() {
  const manager = getFormsManager();
  await manager.init();
  return manager;
}

export default { FormsManager, getFormsManager, initFormsManager };