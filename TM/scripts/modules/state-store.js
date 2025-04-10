/**
 * State Store Module
 *
 * Central state management for Task Master application.
 * Implements the EventEmitter pattern for state change notifications.
 * Provides methods for state access and mutation, and handles state persistence.
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log, CONFIG } from './utils.js';
import taskStateMachine, { TASK_STATUSES, STATUS_TRANSITIONS } from './task-state-machine.js';

// Get directory name in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// State events
export const STATE_EVENTS = {
  INITIALIZED: 'initialized',
  STATE_CHANGED: 'stateChanged',
  STATE_LOADED: 'stateLoaded',
  STATE_PERSISTED: 'statePersisted',
  ERROR: 'error'
};

/**
 * Default state structure
 */
const DEFAULT_STATE = {
  meta: {
    projectName: '',
    version: '1.0.0',
    description: 'Task Master state',
    totalTasksGenerated: 0,
    tasksIncluded: 0
  },
  tasks: [],
  currentTask: null,
  loading: false,
  error: null,
  lastUpdated: null
};

/**
 * Centralized state store for Task Master
 * Implements EventEmitter for state change notifications
 */
class StateStore extends EventEmitter {
  constructor() {
    super();
    this.state = { ...DEFAULT_STATE };
    this.fileOperationPromise = Promise.resolve(); // Track ongoing file operations
    this.pendingWrites = new Map(); // Track files with pending writes
    this.fileLocks = new Set(); // Track locked files
    this.saveDebounceTimers = new Map(); // Track debounce timers for saves
  }

  /**
   * Get the complete current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get the current tasks array
   * @returns {Array} Tasks array
   */
  getTasks() {
    return [...this.state.tasks];
  }

  /**
   * Get task by ID
   * @param {number|string} id Task ID
   * @returns {Object|null} Task object or null if not found
   */
  getTaskById(id) {
    const taskId = Number(id);
    return this.state.tasks.find(task => task.id === taskId) || null;
  }

  /**
   * Get tasks filtered by status
   * @param {string} status Task status to filter by
   * @returns {Array} Filtered tasks
   */
  getTasksByStatus(status) {
    return this.state.tasks.filter(task => task.status === status);
  }

  /**
   * Get tasks that have no dependencies or all dependencies are done
   * @returns {Array} Ready tasks
   */
  getReadyTasks() {
    return this.state.tasks.filter(task => {
      if (task.status !== TASK_STATUSES.PENDING) return false;

      if (!task.dependencies || task.dependencies.length === 0) return true;

      return task.dependencies.every(depId => {
        const depTask = this.getTaskById(depId);
        return depTask && depTask.status === TASK_STATUSES.DONE;
      });
    });
  }

  /**
   * Get the current metadata
   * @returns {Object} Metadata object
   */
  getMeta() {
    return { ...this.state.meta };
  }

  /**
   * Set the state with partial update
   * @param {Object} partialState Partial state update
   * @param {Object} options Options for state update
   * @param {boolean} options.silent If true, don't emit change events
   * @param {boolean} options.persist If true, persist state to disk
   * @returns {Object} Updated state
   */
  setState(partialState, options = {}) {
    const { silent = false, persist = true } = options;

    this.state = {
      ...this.state,
      ...partialState,
      lastUpdated: new Date().toISOString()
    };

    if (!silent) {
      this.emit('stateChanged', this.state);
    }

    if (persist) {
      this.persistState();
    }

    return this.state;
  }

  /**
   * Update task by ID
   * @param {number|string} id Task ID
   * @param {Object} updates Updates to apply to the task
   * @param {Object} options Options for state update
   * @returns {Object|null} Updated task or null if not found
   */
  updateTask(id, updates, options = {}) {
    const taskId = Number(id);
    const taskIndex = this.state.tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
      return null;
    }

    // Status transition validation
    if (updates.status && this.state.tasks[taskIndex].status !== updates.status) {
      try {
        // Use the task state machine to validate and perform the transition
        const transitionResult = taskStateMachine.transition(
          this.state.tasks[taskIndex],
          updates.status
        );

        // Update the status and statusUpdatedAt fields
        updates.status = transitionResult.status;
        updates.statusUpdatedAt = transitionResult.statusUpdatedAt;
      } catch (error) {
        log(error.message, 'error');
        return null;
      }
    }

    const updatedTask = {
      ...this.state.tasks[taskIndex],
      ...updates
    };

    const updatedTasks = [...this.state.tasks];
    updatedTasks[taskIndex] = updatedTask;

    this.setState({ tasks: updatedTasks }, options);

    return updatedTask;
  }

  /**
   * Add a new task
   * @param {Object} taskData Task data
   * @param {Object} options Options for state update
   * @returns {Object} Added task
   */
  addTask(taskData, options = {}) {
    // Generate new task ID (max ID + 1)
    const maxId = this.state.tasks.reduce((max, task) => Math.max(max, task.id), 0);
    const newTask = {
      id: maxId + 1,
      status: TASK_STATUSES.PENDING,
      dependencies: [],
      subtasks: [],
      ...taskData
    };

    const updatedTasks = [...this.state.tasks, newTask];

    // Update metadata
    const meta = { ...this.state.meta };
    meta.totalTasksGenerated = (meta.totalTasksGenerated || 0) + 1;
    meta.tasksIncluded = updatedTasks.length;

    this.setState({
      tasks: updatedTasks,
      meta
    }, options);

    return newTask;
  }

  /**
   * Remove task by ID
   * @param {number|string} id Task ID
   * @param {Object} options Options for state update
   * @returns {boolean} True if task was removed, false otherwise
   */
  removeTask(id, options = {}) {
    const taskId = Number(id);
    const taskIndex = this.state.tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
      return false;
    }

    const updatedTasks = this.state.tasks.filter(task => task.id !== taskId);

    // Update metadata
    const meta = { ...this.state.meta };
    meta.tasksIncluded = updatedTasks.length;

    this.setState({
      tasks: updatedTasks,
      meta
    }, options);

    return true;
  }

  /**
   * Change task status
   * @param {number|string} id Task ID
   * @param {string} status New status
   * @param {Object} options Options for state update
   * @returns {Object|null} Updated task or null if not found/invalid
   */
  setTaskStatus(id, status, options = {}) {
    return this.updateTask(id, { status }, options);
  }

  /**
   * Check if a status transition is valid
   * @param {string} fromStatus Current status
   * @param {string} toStatus Target status
   * @returns {boolean} True if transition is valid
   */
  isValidStatusTransition(fromStatus, toStatus) {
    return taskStateMachine.canTransition(fromStatus, toStatus);
  }

  /**
   * Load state from a tasks file
   * @param {string} filePath Path to tasks file
   * @returns {Promise<Object>} Loaded state
   */
  async loadState(filePath = null) {
    const tasksPath = filePath || (CONFIG && CONFIG.tasksPath) || path.join(process.cwd(), 'tasks/tasks.json');

    try {
      this.setState({ loading: true, error: null }, { silent: true, persist: false });

      await this.acquireFileLock(tasksPath);

      const exists = fs.existsSync(tasksPath);

      if (!exists) {
        log(`Tasks file not found: ${tasksPath}`, 'warn');
        this.releaseFileLock(tasksPath);
        return this.initializeState(tasksPath);
      }

      const data = await fs.promises.readFile(tasksPath, 'utf8');
      let parsedData;

      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        log(`Error parsing tasks file: ${e.message}`, 'error');
        this.releaseFileLock(tasksPath);

        // Create backup of corrupted file
        const backupPath = `${tasksPath}.backup.${Date.now()}`;
        await fs.promises.copyFile(tasksPath, backupPath);
        log(`Created backup of corrupted file: ${backupPath}`, 'info');

        return this.initializeState(tasksPath);
      }

      this.releaseFileLock(tasksPath);

      // Convert legacy format if needed
      if (!parsedData.meta && Array.isArray(parsedData)) {
        parsedData = {
          meta: {
            projectName: 'Converted Project',
            version: '1.0.0',
            description: 'Converted from legacy format',
            totalTasksGenerated: parsedData.length,
            tasksIncluded: parsedData.length
          },
          tasks: parsedData
        };
      }

      // Merge with default state structure to ensure all fields exist
      const newState = {
        ...DEFAULT_STATE,
        meta: { ...DEFAULT_STATE.meta, ...(parsedData.meta || {}) },
        tasks: parsedData.tasks || [],
        lastUpdated: new Date().toISOString(),
        loading: false
      };

      this.setState(newState, { silent: true, persist: false });

      this.emit('stateLoaded', this.state);

      return this.state;
    } catch (error) {
      log(`Error loading state: ${error.message}`, 'error');
      this.setState({
        loading: false,
        error: `Failed to load state: ${error.message}`
      }, { silent: true, persist: false });

      this.emit('error', error);

      return this.state;
    }
  }

  /**
   * Persist state to disk
   * @param {string} filePath Path to tasks file
   * @returns {Promise<boolean>} True if state was persisted successfully
   */
  async persistState(filePath = null) {
    const tasksPath = filePath || (CONFIG && CONFIG.tasksPath) || path.join(process.cwd(), 'tasks/tasks.json');

    // Debounce writes to the same file
    if (this.saveDebounceTimers.has(tasksPath)) {
      clearTimeout(this.saveDebounceTimers.get(tasksPath));
    }

    // Create a promise for this write operation
    return new Promise((resolve, reject) => {
      this.saveDebounceTimers.set(tasksPath, setTimeout(async () => {
        this.saveDebounceTimers.delete(tasksPath);

        try {
          await this.acquireFileLock(tasksPath);

          // Ensure directory exists
          const dir = path.dirname(tasksPath);
          await fs.promises.mkdir(dir, { recursive: true });

          // Prepare data for persistence (extract only tasks and meta)
          const dataToSave = {
            meta: this.state.meta,
            tasks: this.state.tasks
          };

          // Create a temp file first
          const tempPath = `${tasksPath}.temp`;
          await fs.promises.writeFile(tempPath, JSON.stringify(dataToSave, null, 2));

          // Create backup of existing file if it exists
          if (fs.existsSync(tasksPath)) {
            const backupPath = `${tasksPath}.backup`;
            await fs.promises.copyFile(tasksPath, backupPath);
          }

          // Rename temp file to target file (atomic operation)
          await fs.promises.rename(tempPath, tasksPath);

          this.releaseFileLock(tasksPath);

          this.emit('statePersisted', tasksPath);

          resolve(true);
        } catch (error) {
          this.releaseFileLock(tasksPath);
          log(`Error persisting state: ${error.message}`, 'error');
          this.emit('error', error);
          reject(error);
        }
      }, 100)); // 100ms debounce
    });
  }

  /**
   * Initialize state with default values and save to disk
   * @param {string} filePath Path to tasks file
   * @returns {Object} Initialized state
   */
  async initializeState(filePath) {
    const initialState = { ...DEFAULT_STATE };

    initialState.meta = {
      ...initialState.meta,
      projectName: 'New Project',
      description: 'Task Master project',
      created: new Date().toISOString()
    };

    initialState.lastUpdated = new Date().toISOString();
    initialState.loading = false;

    this.setState(initialState, { silent: true, persist: false });

    try {
      await this.persistState(filePath);
    } catch (error) {
      log(`Error initializing state: ${error.message}`, 'error');
    }

    return initialState;
  }

  /**
   * Initialize the state store
   * @param {Object} options Initialization options
   * @returns {Promise<Object>} Initialized state
   */
  async initialize(options = {}) {
    const {
      filePath = this.tasksFilePath,
      forceReset = false
    } = options;

    log('Initializing state store...', 'info');

    try {
      // Load state from file if it exists
      if (!forceReset) {
        await this.loadState(filePath);
      }

      // Emit initialized event
      this.emit(STATE_EVENTS.INITIALIZED, this.getState());

      log('State store initialized successfully', 'success');
      return this.getState();
    } catch (error) {
      log(`Failed to initialize state store: ${error.message}`, 'error');
      this.emit(STATE_EVENTS.ERROR, error);
      throw error;
    }
  }

  /**
   * Acquire a lock on a file to prevent concurrent access
   * @param {string} filePath Path to file
   * @returns {Promise<void>}
   */
  async acquireFileLock(filePath) {
    // Wait for any pending operations on this file to complete
    if (this.pendingWrites.has(filePath)) {
      await this.pendingWrites.get(filePath);
    }

    // Create a new promise for this operation
    let resolvePromise;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    // Track this operation
    this.pendingWrites.set(filePath, promise);

    // Wait until file is not locked
    while (this.fileLocks.has(filePath)) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Acquire lock
    this.fileLocks.add(filePath);

    // Return the resolve function to be called when operation is complete
    return resolvePromise;
  }

  /**
   * Release a lock on a file
   * @param {string} filePath Path to file
   */
  releaseFileLock(filePath) {
    // Release lock
    this.fileLocks.delete(filePath);

    // Resolve promise for this operation
    if (this.pendingWrites.has(filePath)) {
      const resolvePromise = this.pendingWrites.get(filePath);
      this.pendingWrites.delete(filePath);
      resolvePromise();
    }
  }
}

// Create singleton instance
const stateStore = new StateStore();

export default stateStore;
export { TASK_STATUSES, STATUS_TRANSITIONS };
