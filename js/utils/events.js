/**
 * Gestionnaire d'événements personnalisés
 * @fileoverview Système d'événements pour communication entre modules
 */

import { mainLogger } from './logger.js';

export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 100;
    
    mainLogger.debug('EventManager created');
  }

  /**
   * Émet un événement personnalisé
   * @param {string} eventName Nom de l'événement
   * @param {any} data Données de l'événement
   * @param {Element} target Élément cible (optionnel)
   */
  emit(eventName, data = null, target = window) {
    try {
      const event = new CustomEvent(eventName, {
        detail: data,
        bubbles: true,
        cancelable: true
      });

      // Ajoute à l'historique
      this.addToHistory(eventName, data);

      // Émet l'événement
      target.dispatchEvent(event);

      mainLogger.debug(`Event emitted: ${eventName}`, data);
      
      return event;
    } catch (error) {
      mainLogger.error(`Failed to emit event: ${eventName}`, error);
      return null;
    }
  }

  /**
   * Écoute un événement
   * @param {string} eventName Nom de l'événement
   * @param {Function} handler Gestionnaire
   * @param {Element} target Élément cible (optionnel)
   * @returns {Function} Fonction de désabonnement
   */
  on(eventName, handler, target = window) {
    // Stocke le listener pour nettoyage
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    const listenerData = { handler, target };
    this.listeners.get(eventName).add(listenerData);

    // Ajoute l'event listener
    target.addEventListener(eventName, handler);

    mainLogger.debug(`Event listener added: ${eventName}`);

    // Retourne fonction de désabonnement
    return () => {
      target.removeEventListener(eventName, handler);
      this.listeners.get(eventName)?.delete(listenerData);
      mainLogger.debug(`Event listener removed: ${eventName}`);
    };
  }

  /**
   * Écoute un événement une seule fois
   * @param {string} eventName Nom de l'événement
   * @param {Function} handler Gestionnaire
   * @param {Element} target Élément cible (optionnel)
   * @returns {Function} Fonction de désabonnement
   */
  once(eventName, handler, target = window) {
    const wrappedHandler = (event) => {
      handler(event);
      // Auto-suppression après exécution
      target.removeEventListener(eventName, wrappedHandler);
    };

    return this.on(eventName, wrappedHandler, target);
  }

  /**
   * Retire tous les listeners d'un événement
   * @param {string} eventName Nom de l'événement
   */
  off(eventName) {
    const eventListeners = this.listeners.get(eventName);
    
    if (eventListeners) {
      eventListeners.forEach(({ handler, target }) => {
        target.removeEventListener(eventName, handler);
      });
      
      this.listeners.delete(eventName);
      mainLogger.debug(`All listeners removed for: ${eventName}`);
    }
  }

  /**
   * Ajoute un événement à l'historique
   * @param {string} eventName Nom de l'événement
   * @param {any} data Données
   */
  addToHistory(eventName, data) {
    const entry = {
      name: eventName,
      data,
      timestamp: Date.now(),
      time: new Date().toISOString()
    };

    this.eventHistory.unshift(entry);

    // Limite la taille de l'historique
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Obtient l'historique des événements
   * @param {number} limit Nombre d'événements à retourner
   * @returns {Array}
   */
  getHistory(limit = 10) {
    return this.eventHistory.slice(0, limit);
  }

  /**
   * Filtre l'historique par nom d'événement
   * @param {string} eventName Nom de l'événement
   * @param {number} limit Limite de résultats
   * @returns {Array}
   */
  getHistoryFor(eventName, limit = 10) {
    return this.eventHistory
      .filter(entry => entry.name === eventName)
      .slice(0, limit);
  }

  /**
   * Vide l'historique
   */
  clearHistory() {
    this.eventHistory = [];
    mainLogger.debug('Event history cleared');
  }

  /**
   * Crée un canal d'événements (namespace)
   * @param {string} namespace Nom du namespace
   * @returns {Object}
   */
  createChannel(namespace) {
    return {
      emit: (eventName, data, target) => {
        return this.emit(`${namespace}:${eventName}`, data, target);
      },
      
      on: (eventName, handler, target) => {
        return this.on(`${namespace}:${eventName}`, handler, target);
      },
      
      once: (eventName, handler, target) => {
        return this.once(`${namespace}:${eventName}`, handler, target);
      },
      
      off: (eventName) => {
        return this.off(`${namespace}:${eventName}`);
      }
    };
  }

  /**
   * Nettoie tous les listeners
   */
  destroy() {
    this.listeners.forEach((eventListeners, eventName) => {
      this.off(eventName);
    });
    
    this.listeners.clear();
    this.clearHistory();
    
    mainLogger.debug('EventManager destroyed');
  }

  /**
   * Obtient les statistiques des événements
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalListeners: 0,
      eventTypes: Array.from(this.listeners.keys()),
      historySize: this.eventHistory.length,
      recentEvents: this.getHistory(5)
    };

    this.listeners.forEach(listeners => {
      stats.totalListeners += listeners.size;
    });

    return stats;
  }
}

// Instance singleton
export const eventManager = new EventManager();

// Canaux prédéfinis pour l'organisation
export const uiEvents = eventManager.createChannel('ui');
export const featureEvents = eventManager.createChannel('features');
export const pageEvents = eventManager.createChannel('page');
export const analyticsEvents = eventManager.createChannel('analytics');

export default eventManager;