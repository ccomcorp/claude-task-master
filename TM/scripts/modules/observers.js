/**
 * Observers Module
 *
 * Defines observers that react to state changes by subscribing to events
 * emitted by the state store. Observers handle side effects like persisting
 * state to disk, updating UI elements, and logging events.
 */

import stateStore, { STATE_EVENTS } from './state-store.js';
import { log } from './utils.js';

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
  stateStore.on(STATE_EVENTS.STATE_CHANGED, () => {
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
  stateStore.on(STATE_EVENTS.STATE_LOADED, (state) => {
    log(`State loaded with ${state.tasks.length} tasks`, logLevel);
  });

  // Subscribe to state persisted event
  stateStore.on(STATE_EVENTS.STATE_PERSISTED, (filePath) => {
    log(`State persisted to ${filePath}`, logLevel);
  });

  // Subscribe to error event
  stateStore.on(STATE_EVENTS.ERROR, (error) => {
    log(`State store error: ${error.message}`, 'error');
  });

  // Subscribe to initialized event
  stateStore.on(STATE_EVENTS.INITIALIZED, (state) => {
    log(`State store initialized with ${state.tasks.length} tasks`, logLevel);
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
  stateStore.on(STATE_EVENTS.STATE_CHANGED, (state) => {
    if (!validateOnChange) return;

    // Validate dependencies and detect cycles
    validateDependencies(state.tasks);
  });

  /**
   * Validate dependencies between tasks
   * @param {Array} tasks List of tasks
   * @returns {Object} Validation results
   */
  function validateDependencies(tasks) {
    const result = {
      valid: true,
      cycles: [],
      missingDependencies: [],
      completedWithPendingDependencies: []
    };

    // Check for cycles in the dependency graph
    const cycles = detectDependencyCycles(tasks);
    if (cycles.length > 0) {
      result.valid = false;
      result.cycles = cycles;

      // Log warning for each cycle
      cycles.forEach(cycle => {
        const cycleStr = cycle.map(id => `Task ${id}`).join(' → ');
        log(`Dependency cycle detected: ${cycleStr}`, 'warn');
      });
    }

    // Check for missing dependencies
    const missingDeps = findMissingDependencies(tasks);
    if (missingDeps.length > 0) {
      result.valid = false;
      result.missingDependencies = missingDeps;

      // Log warning for each missing dependency
      missingDeps.forEach(({ taskId, dependencyId }) => {
        log(`Task ${taskId} depends on non-existent task ${dependencyId}`, 'warn');
      });
    }

    // Check for completed tasks with pending dependencies
    const completedWithPending = findCompletedTasksWithPendingDependencies(tasks);
    if (completedWithPending.length > 0) {
      result.valid = false;
      result.completedWithPendingDependencies = completedWithPending;

      // Log warning for each inconsistency
      completedWithPending.forEach(({ taskId, dependencyIds }) => {
        const depsStr = dependencyIds.join(', ');
        log(`Task ${taskId} is marked as done but has pending dependencies: ${depsStr}`, 'warn');
      });
    }

    return result;
  }

  /**
   * Detect cycles in the dependency graph
   * @param {Array} tasks List of tasks
   * @returns {Array} List of cycles (each cycle is an array of task IDs)
   */
  function detectDependencyCycles(tasks) {
    const cycles = [];
    const visited = new Set();
    const path = new Set();

    // Build adjacency list for the dependency graph
    const graph = {};
    tasks.forEach(task => {
      graph[task.id] = task.dependencies || [];
    });

    // DFS to detect cycles
    function dfs(taskId, pathSoFar = []) {
      if (path.has(taskId)) {
        // Found a cycle
        const cycleStart = pathSoFar.indexOf(taskId);
        const cycle = pathSoFar.slice(cycleStart).concat(taskId);
        cycles.push(cycle);
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      path.add(taskId);
      pathSoFar.push(taskId);

      const dependencies = graph[taskId] || [];
      for (const depId of dependencies) {
        if (dfs(depId, [...pathSoFar])) {
          return true;
        }
      }

      path.delete(taskId);
      return false;
    }

    // Check each task for cycles
    tasks.forEach(task => {
      if (!visited.has(task.id)) {
        dfs(task.id);
      }
    });

    return cycles;
  }

  /**
   * Find missing dependencies (references to non-existent tasks)
   * @param {Array} tasks List of tasks
   * @returns {Array} List of missing dependencies
   */
  function findMissingDependencies(tasks) {
    const missingDeps = [];
    const taskIds = new Set(tasks.map(task => task.id));

    tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach(depId => {
          if (!taskIds.has(depId)) {
            missingDeps.push({
              taskId: task.id,
              dependencyId: depId
            });
          }
        });
      }
    });

    return missingDeps;
  }

  /**
   * Find completed tasks that have pending dependencies
   * @param {Array} tasks List of tasks
   * @returns {Array} List of inconsistencies
   */
  function findCompletedTasksWithPendingDependencies(tasks) {
    const inconsistencies = [];
    const { DONE } = stateStore.TASK_STATUSES;

    tasks.forEach(task => {
      if (task.status === DONE && task.dependencies && task.dependencies.length > 0) {
        const pendingDeps = task.dependencies.filter(depId => {
          const depTask = tasks.find(t => t.id === depId);
          return depTask && depTask.status !== DONE;
        });

        if (pendingDeps.length > 0) {
          inconsistencies.push({
            taskId: task.id,
            dependencyIds: pendingDeps
          });
        }
      }
    });

    return inconsistencies;
  }

  log('Dependency observer initialized', 'debug');
}

/**
 * Initialize observer for task status transitions
 * @param {Object} options Observer options
 */
export function initializeStatusTransitionObserver(options = {}) {
  const {
    enabled = true        // Whether observer is enabled
  } = options;

  if (!enabled) {
    log('Status transition observer disabled', 'info');
    return;
  }

  // Subscribe to state changes to handle automatic status updates
  stateStore.on(STATE_EVENTS.STATE_CHANGED, (state) => {
    // Check for tasks that need automatic status updates
    updateSubtaskStatusesBasedOnParent(state.tasks);
    updateParentStatusesBasedOnSubtasks(state.tasks);
  });

  /**
   * Update subtask statuses when parent task status changes
   * @param {Array} tasks List of tasks
   */
  function updateSubtaskStatusesBasedOnParent(tasks) {
    // Find tasks that have subtasks
    const tasksWithSubtasks = tasks.filter(task =>
      task.subtasks && task.subtasks.length > 0
    );

    // Check if any parent task is marked as done
    for (const parentTask of tasksWithSubtasks) {
      if (parentTask.status === 'done') {
        // Check if any subtasks are not done
        const pendingSubtasks = parentTask.subtasks.filter(subtask =>
          subtask.status !== 'done'
        );

        if (pendingSubtasks.length > 0) {
          log(`Auto-updating ${pendingSubtasks.length} subtasks of task ${parentTask.id} to 'done'`, 'info');

          // Update the subtasks silently (without triggering another state change event)
          const updatedSubtasks = parentTask.subtasks.map(subtask => {
            if (subtask.status !== 'done') {
              return { ...subtask, status: 'done', statusUpdatedAt: new Date().toISOString() };
            }
            return subtask;
          });

          // Update the parent task with the updated subtasks
          const taskIndex = tasks.findIndex(t => t.id === parentTask.id);
          if (taskIndex !== -1) {
            const updatedTask = { ...tasks[taskIndex], subtasks: updatedSubtasks };
            stateStore.setState({
              tasks: [
                ...tasks.slice(0, taskIndex),
                updatedTask,
                ...tasks.slice(taskIndex + 1)
              ]
            }, { silent: true }); // Silent update to avoid infinite loop
          }
        }
      }
    }
  }

  /**
   * Update parent task status when all subtasks are done
   * @param {Array} tasks List of tasks
   */
  function updateParentStatusesBasedOnSubtasks(tasks) {
    // Find tasks that have subtasks
    const tasksWithSubtasks = tasks.filter(task =>
      task.subtasks && task.subtasks.length > 0
    );

    // Check if all subtasks are done but parent is not
    for (const parentTask of tasksWithSubtasks) {
      if (parentTask.status !== 'done') {
        const allSubtasksDone = parentTask.subtasks.every(subtask =>
          subtask.status === 'done'
        );

        if (allSubtasksDone && parentTask.subtasks.length > 0) {
          log(`Auto-updating task ${parentTask.id} to 'done' as all subtasks are complete`, 'info');

          // Update the parent task status silently
          const taskIndex = tasks.findIndex(t => t.id === parentTask.id);
          if (taskIndex !== -1) {
            const updatedTask = {
              ...tasks[taskIndex],
              status: 'done',
              statusUpdatedAt: new Date().toISOString()
            };

            stateStore.setState({
              tasks: [
                ...tasks.slice(0, taskIndex),
                updatedTask,
                ...tasks.slice(taskIndex + 1)
              ]
            }, { silent: true }); // Silent update to avoid infinite loop
          }
        }
      }
    }
  }

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
