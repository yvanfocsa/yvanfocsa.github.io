/**
 * Tests unitaires pour les utilitaires
 * @fileoverview Tests simples sans framework pour valider les utilitaires
 */

import DOMUtils from '../utils/dom.js';
import PerformanceUtils from '../utils/performance.js';
import StorageUtils from '../utils/storage.js';
import { stateManager } from '../utils/stateManager.js';
import { Logger } from '../utils/logger.js';

/**
 * Framework de test minimal
 */
class SimpleTest {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.logger = new Logger('Tests');
  }

  /**
   * Ajoute un test
   * @param {string} name Nom du test
   * @param {Function} testFn Fonction de test
   */
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Lance tous les tests
   * @returns {Promise<Object>}
   */
  async run() {
    this.logger.group('🧪 Running Unit Tests');
    const startTime = performance.now();
    
    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        this.logger.success(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        this.logger.error(`❌ ${name}`, error);
        this.failed++;
      }
    }
    
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    this.logger.groupEnd();
    this.logger.info(`📊 Tests completed in ${duration}ms: ${this.passed} passed, ${this.failed} failed`);
    
    return {
      passed: this.passed,
      failed: this.failed,
      total: this.tests.length,
      duration,
      success: this.failed === 0
    };
  }

  /**
   * Assertions simples
   * @param {any} actual Valeur actuelle
   * @returns {Object}
   */
  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected truthy value, got ${actual}`);
        }
      },
      
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value, got ${actual}`);
        }
      },
      
      toBeInstanceOf: (constructor) => {
        if (!(actual instanceof constructor)) {
          throw new Error(`Expected instance of ${constructor.name}, got ${typeof actual}`);
        }
      },
      
      toEqual: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      },
      
      toContain: (item) => {
        if (!actual.includes(item)) {
          throw new Error(`Expected ${actual} to contain ${item}`);
        }
      },
      
      toHaveLength: (length) => {
        if (actual.length !== length) {
          throw new Error(`Expected length ${length}, got ${actual.length}`);
        }
      }
    };
  }
}

// === Tests DOMUtils ===
const test = new SimpleTest();

test.test('DOMUtils.select should return element when exists', () => {
  // Setup
  document.body.innerHTML = '<div id="test-element">Test Content</div>';
  
  // Test
  const element = DOMUtils.select('#test-element');
  
  // Assertions
  test.expect(element).toBeTruthy();
  test.expect(element.textContent).toBe('Test Content');
  test.expect(element.id).toBe('test-element');
  
  // Cleanup
  document.body.innerHTML = '';
});

test.test('DOMUtils.select should return null when not exists', () => {
  const element = DOMUtils.select('#non-existent');
  test.expect(element).toBe(null);
});

test.test('DOMUtils.selectAll should return array', () => {
  // Setup
  document.body.innerHTML = `
    <div class="test">Item 1</div>
    <div class="test">Item 2</div>
    <div class="test">Item 3</div>
  `;
  
  // Test
  const elements = DOMUtils.selectAll('.test');
  
  // Assertions
  test.expect(elements).toBeInstanceOf(Array);
  test.expect(elements).toHaveLength(3);
  test.expect(elements[0].textContent).toBe('Item 1');
  
  // Cleanup
  document.body.innerHTML = '';
});

test.test('DOMUtils.isVisible should work correctly', () => {
  // Setup
  document.body.innerHTML = `
    <div id="visible">Visible</div>
    <div id="hidden" style="display: none;">Hidden</div>
  `;
  
  const visible = DOMUtils.select('#visible');
  const hidden = DOMUtils.select('#hidden');
  
  // Assertions
  test.expect(DOMUtils.isVisible(visible)).toBeTruthy();
  test.expect(DOMUtils.isVisible(hidden)).toBeFalsy();
  test.expect(DOMUtils.isVisible(null)).toBeFalsy();
  
  // Cleanup
  document.body.innerHTML = '';
});

// === Tests PerformanceUtils ===

test.test('PerformanceUtils.debounce should work correctly', (done) => {
  let callCount = 0;
  const debounced = PerformanceUtils.debounce(() => {
    callCount++;
  }, 100);
  
  // Appelle plusieurs fois rapidement
  debounced();
  debounced();
  debounced();
  
  // Vérifie qu'elle n'a pas encore été appelée
  test.expect(callCount).toBe(0);
  
  // Attend et vérifie qu'elle a été appelée une seule fois
  setTimeout(() => {
    test.expect(callCount).toBe(1);
    if (done) done();
  }, 150);
});

test.test('PerformanceUtils.throttle should work correctly', (done) => {
  let callCount = 0;
  const throttled = PerformanceUtils.throttle(() => {
    callCount++;
  }, 100);
  
  // Premier appel immédiat
  throttled();
  test.expect(callCount).toBe(1);
  
  // Appels suivants ignorés
  throttled();
  throttled();
  test.expect(callCount).toBe(1);
  
  // Vérifie après le délai
  setTimeout(() => {
    throttled();
    test.expect(callCount).toBe(2);
    if (done) done();
  }, 150);
});

test.test('PerformanceUtils.createCache should manage cache correctly', () => {
  const cache = PerformanceUtils.createCache(1000); // 1 seconde TTL
  
  // Test set/get
  cache.set('test-key', 'test-value');
  test.expect(cache.get('test-key')).toBe('test-value');
  
  // Test avec valeur par défaut
  test.expect(cache.get('non-existent', 'default')).toBe('default');
  
  // Test des stats
  const stats = cache.stats();
  test.expect(stats.size).toBe(1);
  test.expect(stats.entries).toContain('test-key');
  
  // Test clear
  cache.clear();
  test.expect(cache.get('test-key')).toBe(null);
});

// === Tests StorageUtils ===

test.test('StorageUtils should handle localStorage operations', () => {
  // Test disponibilité
  const isAvailable = StorageUtils.isAvailable();
  test.expect(typeof isAvailable).toBe('boolean');
  
  if (isAvailable) {
    // Test set/get
    const success = StorageUtils.set('test', { data: 'test' });
    test.expect(success).toBeTruthy();
    
    const retrieved = StorageUtils.get('test');
    test.expect(retrieved).toEqual({ data: 'test' });
    
    // Test has
    test.expect(StorageUtils.has('test')).toBeTruthy();
    test.expect(StorageUtils.has('non-existent')).toBeFalsy();
    
    // Test remove
    const removed = StorageUtils.remove('test');
    test.expect(removed).toBeTruthy();
    test.expect(StorageUtils.get('test')).toBe(null);
  }
});

test.test('StorageUtils should handle versioned data', () => {
  if (StorageUtils.isAvailable()) {
    // Test versioned set/get
    const success = StorageUtils.setVersioned('versioned-test', { data: 'test' }, '1.0.0');
    test.expect(success).toBeTruthy();
    
    const retrieved = StorageUtils.getVersioned('versioned-test', '1.0.0');
    test.expect(retrieved).toEqual({ data: 'test' });
    
    // Test version mismatch
    const wrongVersion = StorageUtils.getVersioned('versioned-test', '2.0.0', 'default');
    test.expect(wrongVersion).toBe('default');
    
    // Cleanup
    StorageUtils.remove('versioned-test');
  }
});

// === Tests StateManager ===

test.test('StateManager should manage state correctly', () => {
  // Reset pour des tests propres
  stateManager.reset();
  
  // Test initial state
  test.expect(stateManager.getState('currentLanguage')).toBe('fr');
  
  // Test setState
  stateManager.setState('testKey', 'testValue');
  test.expect(stateManager.getState('testKey')).toBe('testValue');
  
  // Test subscription
  let notificationReceived = false;
  const unsubscribe = stateManager.subscribe('testKey', (newValue) => {
    notificationReceived = true;
    test.expect(newValue).toBe('newValue');
  });
  
  stateManager.setState('testKey', 'newValue');
  test.expect(notificationReceived).toBeTruthy();
  
  // Test unsubscribe
  unsubscribe();
});

test.test('StateManager should handle multiple states', () => {
  stateManager.reset();
  
  const updates = {
    key1: 'value1',
    key2: 'value2',
    key3: 'value3'
  };
  
  stateManager.setMultipleStates(updates);
  
  test.expect(stateManager.getState('key1')).toBe('value1');
  test.expect(stateManager.getState('key2')).toBe('value2');
  test.expect(stateManager.getState('key3')).toBe('value3');
});

// === Tests Logger ===

test.test('Logger should handle different log levels', () => {
  const testLogger = new Logger('Test');
  
  // Ces tests vérifient que les méthodes existent et ne lancent pas d'erreur
  test.expect(() => testLogger.debug('Debug message')).not.toThrow();
  test.expect(() => testLogger.info('Info message')).not.toThrow();
  test.expect(() => testLogger.warn('Warning message')).not.toThrow();
  test.expect(() => testLogger.error('Error message')).not.toThrow();
  
  // Test timing
  test.expect(() => {
    testLogger.time('Test Timer');
    testLogger.timeEnd('Test Timer');
  }).not.toThrow();
  
  // Test grouping
  test.expect(() => {
    testLogger.group('Test Group');
    testLogger.groupEnd();
  }).not.toThrow();
});

// === Utilitaire pour les tests asynchrones ===
function createAsyncTest(testFn) {
  return () => {
    return new Promise((resolve, reject) => {
      try {
        const result = testFn((error) => {
          if (error) reject(error);
          else resolve();
        });
        
        // Si la fonction retourne une promesse
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        }
        // Si pas de callback done et pas de promesse, résout immédiatement
        else if (testFn.length === 0) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  };
}

// Ajoute une extension pour les tests async
SimpleTest.prototype.asyncTest = function(name, testFn) {
  this.test(name, createAsyncTest(testFn));
};

// === Tests d'intégration simples ===

test.test('All utility modules should be importable', async () => {
  // Vérifie que tous les modules peuvent être importés
  const modules = [
    '../utils/dom.js',
    '../utils/performance.js', 
    '../utils/storage.js',
    '../utils/logger.js'
  ];
  
  for (const modulePath of modules) {
    try {
      const module = await import(modulePath);
      test.expect(module).toBeTruthy();
      test.expect(module.default).toBeTruthy();
    } catch (error) {
      throw new Error(`Failed to import ${modulePath}: ${error.message}`);
    }
  }
});

// === Auto-exécution des tests en développement ===

/**
 * Lance les tests automatiquement en développement
 */
function autoRunTests() {
  // Vérifie si on est en développement
  const isDevelopment = location.hostname === 'localhost' || 
                       location.hostname === '127.0.0.1' ||
                       location.search.includes('test=true');
  
  if (isDevelopment) {
    // Lance les tests après un délai pour laisser la page se charger
    setTimeout(async () => {
      try {
        const results = await test.run();
        
        // Affiche un résumé visuel
        showTestResults(results);
        
      } catch (error) {
        console.error('Test execution failed:', error);
      }
    }, 2000);
  }
}

/**
 * Affiche les résultats de test dans l'interface
 * @param {Object} results Résultats des tests
 */
function showTestResults(results) {
  const resultsElement = DOMUtils.createElement('div', {
    id: 'test-results',
    style: `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${results.success ? '#d4edda' : '#f8d7da'};
      color: ${results.success ? '#155724' : '#721c24'};
      border: 1px solid ${results.success ? '#c3e6cb' : '#f5c6cb'};
      border-radius: 8px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
    `
  }, `
    🧪 Tests: ${results.passed}/${results.total}
    <br>⏱️ ${results.duration}ms
    ${results.success ? '<br>✅ All tests passed!' : '<br>❌ Some tests failed'}
  `);

  document.body.appendChild(resultsElement);

  // Auto-suppression après 10 secondes ou clic
  const remove = () => resultsElement.remove();
  
  resultsElement.addEventListener('click', remove);
  setTimeout(remove, 10000);
}

// === Lancement automatique ===

// Lance les tests quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoRunTests);
} else {
  autoRunTests();
}

// Export pour usage manuel
export { test as unitTests, SimpleTest };
export default test;