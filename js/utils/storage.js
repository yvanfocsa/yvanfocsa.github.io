/**
 * Utilitaires pour la gestion du stockage local
 * @fileoverview Helpers pour localStorage avec gestion d'erreurs et cache
 */

import { mainLogger } from './logger.js';

export class StorageUtils {
  /**
   * Préfixe pour toutes les clés du site
   */
  static PREFIX = 'oudar-avocats-';

  /**
   * Stocke une valeur dans le localStorage
   * @param {string} key Clé de stockage
   * @param {any} value Valeur à stocker
   * @param {number} ttl Durée de vie en ms (optionnel)
   * @returns {boolean} Succès de l'opération
   */
  static set(key, value, ttl = null) {
    try {
      const prefixedKey = this.PREFIX + key;
      const dataToStore = {
        value,
        timestamp: Date.now(),
        ttl: ttl ? Date.now() + ttl : null
      };
      
      localStorage.setItem(prefixedKey, JSON.stringify(dataToStore));
      mainLogger.debug(`Storage set: ${key}`, value);
      return true;
    } catch (error) {
      mainLogger.warn(`Failed to store ${key}`, error);
      
      // Tente de libérer de l'espace
      if (error.name === 'QuotaExceededError') {
        this.cleanup();
        // Retry une fois
        try {
          const prefixedKey = this.PREFIX + key;
          const dataToStore = {
            value,
            timestamp: Date.now(),
            ttl: ttl ? Date.now() + ttl : null
          };
          
          localStorage.setItem(prefixedKey, JSON.stringify(dataToStore));
          return true;
        } catch (retryError) {
          mainLogger.error(`Failed to store ${key} after cleanup`, retryError);
        }
      }
      
      return false;
    }
  }

  /**
   * Récupère une valeur du localStorage
   * @param {string} key Clé de stockage
   * @param {any} defaultValue Valeur par défaut
   * @returns {any} Valeur stockée ou valeur par défaut
   */
  static get(key, defaultValue = null) {
    try {
      const prefixedKey = this.PREFIX + key;
      const storedData = localStorage.getItem(prefixedKey);
      
      if (!storedData) {
        return defaultValue;
      }
      
      const parsed = JSON.parse(storedData);
      
      // Vérifie l'expiration
      if (parsed.ttl && Date.now() > parsed.ttl) {
        this.remove(key);
        mainLogger.debug(`Expired storage item removed: ${key}`);
        return defaultValue;
      }
      
      mainLogger.debug(`Storage get: ${key}`, parsed.value);
      return parsed.value;
    } catch (error) {
      mainLogger.warn(`Failed to retrieve ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Supprime une valeur du localStorage
   * @param {string} key Clé à supprimer
   * @returns {boolean} Succès de l'opération
   */
  static remove(key) {
    try {
      const prefixedKey = this.PREFIX + key;
      localStorage.removeItem(prefixedKey);
      mainLogger.debug(`Storage removed: ${key}`);
      return true;
    } catch (error) {
      mainLogger.warn(`Failed to remove ${key}`, error);
      return false;
    }
  }

  /**
   * Vérifie si une clé existe
   * @param {string} key Clé à vérifier
   * @returns {boolean}
   */
  static has(key) {
    const prefixedKey = this.PREFIX + key;
    return localStorage.getItem(prefixedKey) !== null;
  }

  /**
   * Nettoie les entrées expirées
   * @returns {number} Nombre d'entrées supprimées
   */
  static cleanup() {
    let removedCount = 0;
    
    try {
      const keys = Object.keys(localStorage);
      const ourKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      ourKeys.forEach(prefixedKey => {
        try {
          const storedData = localStorage.getItem(prefixedKey);
          const parsed = JSON.parse(storedData);
          
          // Supprime si expiré
          if (parsed.ttl && Date.now() > parsed.ttl) {
            localStorage.removeItem(prefixedKey);
            removedCount++;
          }
        } catch (e) {
          // Supprime les données corrompues
          localStorage.removeItem(prefixedKey);
          removedCount++;
        }
      });
      
      mainLogger.debug(`Storage cleanup: ${removedCount} items removed`);
    } catch (error) {
      mainLogger.warn('Storage cleanup failed', error);
    }
    
    return removedCount;
  }

  /**
   * Vide tout le stockage du site
   * @returns {boolean} Succès de l'opération
   */
  static clear() {
    try {
      const keys = Object.keys(localStorage);
      const ourKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      ourKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      mainLogger.debug(`Storage cleared: ${ourKeys.length} items removed`);
      return true;
    } catch (error) {
      mainLogger.warn('Storage clear failed', error);
      return false;
    }
  }

  /**
   * Récupère la taille utilisée par notre application
   * @returns {Object} Informations sur l'utilisation
   */
  static getUsage() {
    try {
      const keys = Object.keys(localStorage);
      const ourKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      let totalSize = 0;
      const items = [];
      
      ourKeys.forEach(key => {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        totalSize += size;
        
        items.push({
          key: key.replace(this.PREFIX, ''),
          size,
          sizeKB: (size / 1024).toFixed(2)
        });
      });
      
      return {
        totalItems: ourKeys.length,
        totalSize,
        totalSizeKB: (totalSize / 1024).toFixed(2),
        items: items.sort((a, b) => b.size - a.size)
      };
    } catch (error) {
      mainLogger.warn('Failed to calculate storage usage', error);
      return {
        totalItems: 0,
        totalSize: 0,
        totalSizeKB: '0',
        items: []
      };
    }
  }

  /**
   * Stocke un objet avec versioning
   * @param {string} key Clé de stockage
   * @param {any} value Valeur à stocker
   * @param {string} version Version des données
   * @returns {boolean} Succès de l'opération
   */
  static setVersioned(key, value, version = '1.0.0') {
    const versionedData = {
      version,
      data: value,
      timestamp: Date.now()
    };
    
    return this.set(key, versionedData);
  }

  /**
   * Récupère un objet avec vérification de version
   * @param {string} key Clé de stockage
   * @param {string} expectedVersion Version attendue
   * @param {any} defaultValue Valeur par défaut
   * @returns {any} Données si version correcte, sinon valeur par défaut
   */
  static getVersioned(key, expectedVersion = '1.0.0', defaultValue = null) {
    const storedData = this.get(key);
    
    if (!storedData || !storedData.version) {
      return defaultValue;
    }
    
    if (storedData.version !== expectedVersion) {
      mainLogger.warn(`Version mismatch for ${key}. Expected: ${expectedVersion}, Got: ${storedData.version}`);
      this.remove(key); // Supprime les données obsolètes
      return defaultValue;
    }
    
    return storedData.data;
  }

  /**
   * Migre les données d'une ancienne version
   * @param {string} key Clé de stockage
   * @param {Function} migrationFunction Fonction de migration
   * @param {string} newVersion Nouvelle version
   * @returns {boolean} Succès de la migration
   */
  static migrate(key, migrationFunction, newVersion) {
    try {
      const oldData = this.get(key);
      
      if (!oldData) {
        return false;
      }
      
      const migratedData = migrationFunction(oldData);
      const success = this.setVersioned(key, migratedData, newVersion);
      
      if (success) {
        mainLogger.info(`Successfully migrated ${key} to version ${newVersion}`);
      }
      
      return success;
    } catch (error) {
      mainLogger.error(`Migration failed for ${key}`, error);
      return false;
    }
  }

  /**
   * Cache intelligent avec invalidation automatique
   * @param {string} key Clé du cache
   * @param {Function} dataFetcher Fonction pour récupérer les données
   * @param {number} ttl Durée de vie en ms
   * @returns {Promise<any>} Données en cache ou fraîches
   */
  static async getOrCache(key, dataFetcher, ttl = 300000) {
    // Tente de récupérer depuis le cache
    const cachedData = this.get(key);
    
    if (cachedData !== null) {
      mainLogger.debug(`Cache hit: ${key}`);
      return cachedData;
    }
    
    // Récupère les données fraîches
    try {
      mainLogger.debug(`Cache miss: ${key}, fetching fresh data`);
      const freshData = await dataFetcher();
      
      // Met en cache
      this.set(key, freshData, ttl);
      
      return freshData;
    } catch (error) {
      mainLogger.error(`Failed to fetch data for cache key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Teste la disponibilité du localStorage
   * @returns {boolean} localStorage disponible
   */
  static isAvailable() {
    try {
      const testKey = this.PREFIX + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      mainLogger.warn('localStorage not available', error);
      return false;
    }
  }

  /**
   * Export des données pour sauvegarde
   * @returns {Object} Toutes les données de l'application
   */
  static exportData() {
    try {
      const keys = Object.keys(localStorage);
      const ourKeys = keys.filter(key => key.startsWith(this.PREFIX));
      
      const exportData = {};
      
      ourKeys.forEach(prefixedKey => {
        const key = prefixedKey.replace(this.PREFIX, '');
        exportData[key] = this.get(key);
      });
      
      return {
        timestamp: new Date().toISOString(),
        data: exportData
      };
    } catch (error) {
      mainLogger.error('Failed to export data', error);
      return null;
    }
  }

  /**
   * Import des données depuis une sauvegarde
   * @param {Object} importData Données à importer
   * @returns {boolean} Succès de l'import
   */
  static importData(importData) {
    try {
      if (!importData.data) {
        throw new Error('Invalid import data format');
      }
      
      Object.entries(importData.data).forEach(([key, value]) => {
        this.set(key, value);
      });
      
      mainLogger.info('Data import successful');
      return true;
    } catch (error) {
      mainLogger.error('Failed to import data', error);
      return false;
    }
  }
}

export default StorageUtils;