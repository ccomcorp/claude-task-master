/**
 * Unit tests for the observers module
 */

import { jest } from '@jest/globals';
import EventEmitter from 'events';
import { STATE_EVENTS } from '../../scripts/modules/state-store.js';
import {
  initializePersistenceObserver,
  initializeLoggingObserver,
  initializeDependencyObserver,
  initializeStatusTransitionObserver,
  initializeCustomObserver
} from '../../scripts/modules/observers.js';

// Mock the state store
jest.mock('../../scripts/modules/state-store.js', () => {
  const mockStateStore = new EventEmitter();
  mockStateStore.persistState = jest.fn().mockResolvedValue(true);
  mockStateStore.TASK_STATUSES = {
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    REVIEW: 'review',
    DONE: 'done',
    DEFERRED: 'deferred'
  };
  mockStateStore.setState = jest.fn();
  
  return {
    __esModule: true,
    default: mockStateStore,
    STATE_EVENTS: {
      INITIALIZED: 'initialized',
      STATE_CHANGED: 'stateChanged',
      STATE_LOADED: 'stateLoaded',
      STATE_PERSISTED: 'statePersisted',
      ERROR: 'error'
    }
  };
});

// Mock the utils module
jest.mock('../../scripts/modules/utils.js', () => ({
  log: jest.fn()
}));

// Import the mocked modules
import stateStore from '../../scripts/modules/state-store.js';
import { log } from '../../scripts/modules/utils.js';

describe('Observers', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Remove all listeners
    stateStore.removeAllListeners();
  });
  
  describe('Persistence Observer', () => {
    test('should initialize with default options', () => {
      initializePersistenceObserver();
      
      // Should have registered a listener for state changes
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(1);
      
      // Log should have been called
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Persistence observer'), expect.any(String));
    });
    
    test('should not initialize when disabled', () => {
      initializePersistenceObserver({ enabled: false });
      
      // Should not have registered any listeners
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(0);
      
      // Log should have been called with disabled message
      expect(log).toHaveBeenCalledWith('Persistence observer disabled', 'info');
    });
    
    test('should debounce persistence calls', async () => {
      // Mock setTimeout and clearTimeout
      jest.useFakeTimers();
      
      initializePersistenceObserver({ debounceTime: 100 });
      
      // Emit multiple state changes
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, { tasks: [] });
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, { tasks: [{ id: 1 }] });
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, { tasks: [{ id: 1 }, { id: 2 }] });
      
      // persistState should not have been called yet
      expect(stateStore.persistState).not.toHaveBeenCalled();
      
      // Fast-forward time
      jest.advanceTimersByTime(150);
      
      // Allow any pending promises to resolve
      await Promise.resolve();
      
      // persistState should have been called once
      expect(stateStore.persistState).toHaveBeenCalledTimes(1);
      
      // Restore timers
      jest.useRealTimers();
    });
  });
  
  describe('Logging Observer', () => {
    test('should initialize with default options', () => {
      initializeLoggingObserver();
      
      // Should have registered listeners for events
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_LOADED)).toBe(1);
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_PERSISTED)).toBe(1);
      expect(stateStore.listenerCount(STATE_EVENTS.ERROR)).toBe(1);
      
      // Log should have been called
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Logging observer'), expect.any(String));
    });
    
    test('should not initialize when disabled', () => {
      initializeLoggingObserver({ enabled: false });
      
      // Should not have registered any listeners
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_LOADED)).toBe(0);
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_PERSISTED)).toBe(0);
      expect(stateStore.listenerCount(STATE_EVENTS.ERROR)).toBe(0);
      
      // Log should have been called with disabled message
      expect(log).toHaveBeenCalledWith('Logging observer disabled', 'info');
    });
    
    test('should log events', () => {
      initializeLoggingObserver();
      
      // Emit events
      stateStore.emit(STATE_EVENTS.STATE_LOADED, { tasks: [{ id: 1 }] });
      stateStore.emit(STATE_EVENTS.STATE_PERSISTED, 'tasks.json');
      stateStore.emit(STATE_EVENTS.ERROR, new Error('Test error'));
      
      // Log should have been called for each event
      expect(log).toHaveBeenCalledWith(expect.stringContaining('State loaded'), expect.any(String));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('State persisted'), expect.any(String));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('State store error'), 'error');
    });
  });
  
  describe('Dependency Observer', () => {
    test('should initialize with default options', () => {
      initializeDependencyObserver();
      
      // Should have registered a listener for state changes
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(1);
      
      // Log should have been called
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Dependency observer'), expect.any(String));
    });
    
    test('should not initialize when disabled', () => {
      initializeDependencyObserver({ enabled: false });
      
      // Should not have registered any listeners
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(0);
      
      // Log should have been called with disabled message
      expect(log).toHaveBeenCalledWith('Dependency observer disabled', 'info');
    });
    
    test('should detect dependency cycles', () => {
      initializeDependencyObserver();
      
      // Create a state with a dependency cycle
      const state = {
        tasks: [
          { id: 1, title: 'Task 1', dependencies: [2] },
          { id: 2, title: 'Task 2', dependencies: [3] },
          { id: 3, title: 'Task 3', dependencies: [1] }
        ]
      };
      
      // Emit state change
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, state);
      
      // Log should have been called with cycle warning
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Dependency cycle detected'), 'warn');
    });
    
    test('should detect missing dependencies', () => {
      initializeDependencyObserver();
      
      // Create a state with a missing dependency
      const state = {
        tasks: [
          { id: 1, title: 'Task 1', dependencies: [999] }
        ]
      };
      
      // Emit state change
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, state);
      
      // Log should have been called with missing dependency warning
      expect(log).toHaveBeenCalledWith(expect.stringContaining('depends on non-existent task'), 'warn');
    });
  });
  
  describe('Status Transition Observer', () => {
    test('should initialize with default options', () => {
      initializeStatusTransitionObserver();
      
      // Should have registered a listener for state changes
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(1);
      
      // Log should have been called
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Status transition observer'), expect.any(String));
    });
    
    test('should not initialize when disabled', () => {
      initializeStatusTransitionObserver({ enabled: false });
      
      // Should not have registered any listeners
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(0);
      
      // Log should have been called with disabled message
      expect(log).toHaveBeenCalledWith('Status transition observer disabled', 'info');
    });
    
    test('should update subtask statuses when parent is done', () => {
      initializeStatusTransitionObserver();
      
      // Create a state with a done parent and pending subtasks
      const state = {
        tasks: [
          { 
            id: 1, 
            title: 'Parent Task', 
            status: 'done',
            subtasks: [
              { id: 101, title: 'Subtask 1', status: 'pending' },
              { id: 102, title: 'Subtask 2', status: 'in-progress' }
            ]
          }
        ]
      };
      
      // Emit state change
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, state);
      
      // Log should have been called with auto-update message
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Auto-updating'), 'info');
      
      // setState should have been called to update the subtasks
      expect(stateStore.setState).toHaveBeenCalled();
    });
    
    test('should update parent status when all subtasks are done', () => {
      initializeStatusTransitionObserver();
      
      // Create a state with a pending parent and all done subtasks
      const state = {
        tasks: [
          { 
            id: 1, 
            title: 'Parent Task', 
            status: 'pending',
            subtasks: [
              { id: 101, title: 'Subtask 1', status: 'done' },
              { id: 102, title: 'Subtask 2', status: 'done' }
            ]
          }
        ]
      };
      
      // Emit state change
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, state);
      
      // Log should have been called with auto-update message
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Auto-updating task'), 'info');
      
      // setState should have been called to update the parent
      expect(stateStore.setState).toHaveBeenCalled();
    });
  });
  
  describe('Custom Observer', () => {
    test('should initialize with custom handlers', () => {
      const customHandler = jest.fn();
      
      initializeCustomObserver('test-observer', {
        [STATE_EVENTS.STATE_CHANGED]: customHandler
      });
      
      // Should have registered a listener for state changes
      expect(stateStore.listenerCount(STATE_EVENTS.STATE_CHANGED)).toBe(1);
      
      // Log should have been called
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Custom observer'), expect.any(String));
      
      // Emit state change
      stateStore.emit(STATE_EVENTS.STATE_CHANGED, { tasks: [] });
      
      // Custom handler should have been called
      expect(customHandler).toHaveBeenCalled();
    });
  });
});
