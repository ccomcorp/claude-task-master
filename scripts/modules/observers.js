/**
 * Observers Module
 * 
 * Defines observers that react to state changes by subscribing to events
 * emitted by the state store. Observers handle side effects like persisting
 * state to disk, updating UI elements, and logging events.
 */

import stateStore from './state-store.js';
import { log, CONFIG } from './utils.js';

/**
 * Initialize all observers
 */
export function initializeObservers() {
  // Initialize observers with default handlers
  initializePersistenceObserver();
  initializeLoggingObserver();
  
  log('State observers initialized', 'info');
}

/**
 * Initialize observer for state persistence
 * @param {Object} options Observer options
 */
export function initializePersistenceObserver(options = {}) {
  const { 
    debounceTime = 500,  // Debounce time in ms
    enabled = true       // Whether observer is enabled
  } = options;
  
  if (!enabled) {
    log('Persistence observer disabled', 'info');
    return;
  }
  
  let debounceTimer = null;
  
  // Subscribe to state changes
  stateStore.on('stateChanged', (state) => {
    // Clear any pending timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer for debounced persistence
    debounceTimer = setTimeout(async () => {
      try {
        await stateStore.persistState();
        log('State persisted automatically', 'debug');
      } catch (error) {
        log(`Error in persistence observer: ${error.message}`, 'error');
      }
    }, debounceTime);
  });
  
  log('Persistence observer initialized', 'debug');
}

/**
 * Initialize observer for logging events
 * @param {Object} options Observer options
 */
export function initializeLoggingObserver(options = {}) {
  const { 
    logLevel = 'info',   // Minimum level to log
    enabled = true       // Whether observer is enabled
  } = options;
  
  if (!enabled) {
    log('Logging observer disabled', 'info');
    return;
  }
  
  // Subscribe to state loaded event
  stateStore.on('stateLoaded', (state) => {
    log(`State loaded with ${state.tasks.length} tasks`, logLevel);
  });
  
  // Subscribe to state persisted event
  stateStore.on('statePersisted', (filePath) => {
    log(`State persisted to ${filePath}`, logLevel);
  });
  
  // Subscribe to error event
  stateStore.on('error', (error) => {
    log(`State store error: ${error.message}`, 'error');
  });
  
  log('Logging observer initialized', 'debug');
}

/**
 * Initialize observer for task dependency validation
 * @param {Object} options Observer options
 */
export function initializeDependencyObserver(options = {}) {
  const { 
    validateOnChange = true,  // Validate dependencies on task status change
    enabled = true            // Whether observer is enabled
  } = options;
  
  if (!enabled) {
    log('Dependency observer disabled', 'info');
    return;
  }
  
  // Subscribe to state changes
  stateStore.on('stateChanged', (state) => {
    if (!validateOnChange) return;
    
    // This could be enhanced to perform dependency validation
    // and warn about inconsistencies in the dependency graph
    
    // For now, we'll just log a message
    log('Task dependencies should be validated here', 'debug');
  });
  
  log('Dependency observer initialized', 'debug');
}

/**
 * Initialize observer for task status transitions
 * @param {Object} options Observer options
 */
export function initializeStatusTransitionObserver(options = {}) {
  const {
    enforceRules = true,  // Enforce status transition rules
    enabled = true        // Whether observer is enabled
  } = options;
  
  if (!enabled) {
    log('Status transition observer disabled', 'info');
    return;
  }
  
  // Task status transition rules are enforced at the state store level
  // This observer could be used for additional logic or notifications
  
  log('Status transition observer initialized', 'debug');
}

/**
 * Initialize custom observer with user-defined handlers
 * @param {string} name Observer name
 * @param {Object} handlers Event handlers
 * @param {Object} options Observer options
 */
export function initializeCustomObserver(name, handlers, options = {}) {
  const { enabled = true } = options;
  
  if (!enabled) {
    log(`Custom observer ${name} disabled`, 'info');
    return;
  }
  
  // Register each handler
  Object.entries(handlers).forEach(([event, handler]) => {
    stateStore.on(event, handler);
  });
  
  log(`Custom observer ${name} initialized`, 'debug');
  
  // Return a cleanup function
  return () => {
    Object.entries(handlers).forEach(([event, handler]) => {
      stateStore.off(event, handler);
    });
    log(`Custom observer ${name} removed`, 'debug');
  };
}

/**
 * Create a state snapshot for undo/redo functionality
 * Not fully implemented yet, but framework is in place
 */
export function createStateSnapshot() {
  const state = stateStore.getState();
  const snapshot = {
    tasks: JSON.parse(JSON.stringify(state.tasks)),
    meta: JSON.parse(JSON.stringify(state.meta)),
    timestamp: new Date().toISOString()
  };
  
  log('State snapshot created', 'debug');
  return snapshot;
}

// Export default function to initialize all observers
export default function initializeAllObservers(options = {}) {
  initializeObservers();
  
  if (options.dependencies !== false) {
    initializeDependencyObserver(options.dependencyOptions || {});
  }
  
  if (options.statusTransitions !== false) {
    initializeStatusTransitionObserver(options.statusTransitionOptions || {});
  }
  
  log('All observers initialized', 'info');
}
