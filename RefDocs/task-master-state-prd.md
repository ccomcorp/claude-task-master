# Product Requirements Document
# Task Master State Management Conversion

## 1. Overview

This document outlines the requirements for converting the Task Master CLI tool from its current file-based state management approach to a formal state management architecture. Task Master is a task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI. The current implementation primarily uses direct file operations on a `tasks.json` file to manage task state.

## 2. Goals

- Implement a robust, centralized state management system
- Improve code maintainability and testability 
- Enhance reliability of state transitions
- Support additional features like undo/redo functionality
- Maintain backward compatibility with the existing CLI interface
- Preserve all current functionality while improving the architecture
- Enable potential future extensions for collaboration features

## 3. Scope

This conversion will touch the core functionality of the Task Master system without changing the external API or user-facing commands. The scope includes:

- Creating a state management store
- Implementing action creators for all operations
- Refactoring CLI commands to use the state store
- Adding state observers and persistence logic
- Implementing a state machine for task status transitions
- Adding tests for the new state management system
- Updating documentation to reflect the architectural changes

## 4. Detailed Implementation Strategy

### 4.1. Phase 1: Create State Management Infrastructure

#### 4.1.1. State Store Implementation

Create a centralized state store using the EventEmitter pattern to manage application state.

**Technical Requirements:**
- Create a `state-store.js` module
- Implement a `TaskState` class that extends `EventEmitter`
- State structure should include:
  - `tasks`: Array of task objects
  - `currentTask`: Currently selected task (if any)
  - `loading`: Boolean flag for async operations
  - `error`: Error state information
  - `lastUpdated`: Timestamp of the last state update
  - `history`: Optional array for state history (undo/redo)
- Implement state access methods:
  - `getState()`: Returns the current state
  - `setState(partialState)`: Updates state and emits change events
  - `getTaskById(id)`: Retrieves a specific task
  - `getSubtaskById(taskId, subtaskId)`: Retrieves a specific subtask
- Add helper methods for common state queries:
  - `getPendingTasks()`: Get all tasks with "pending" status
  - `getTasksByStatus(status)`: Get all tasks with a given status
  - `getTasksWithCompletedDependencies()`: Get tasks ready to work on
  - `getNextTask()`: Get the highest priority available task

**State Persistence:**
- Implement state persistence to disk:
  - `loadState()`: Loads state from `tasks.json`
  - `saveState()`: Saves state to `tasks.json`
  - Add debouncing/throttling to prevent excessive writes
- Add a lock mechanism to prevent concurrent writes
- Implement backup creation before significant state changes

**Example Implementation:**
```javascript
// state-store.js
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { fileExists, debounce, acquireLock, releaseLock } from './utils.js';

export const STATE_EVENTS = {
  CHANGE: 'state:change',
  TASK_ADDED: 'state:task-added',
  TASK_UPDATED: 'state:task-updated',
  TASK_REMOVED: 'state:task-removed',
  LOADING_STARTED: 'state:loading-started',
  LOADING_FINISHED: 'state:loading-finished',
  ERROR: 'state:error',
};

class TaskState extends EventEmitter {
  constructor() {
    super();
    this.state = {
      tasks: [],
      currentTask: null,
      loading: false,
      error: null,
      lastUpdated: null,
      history: [],
    };
    this.historyIndex = -1;
    this.maxHistory = 50; // Maximum number of history states to keep
  }
  
  // State getter methods
  getState() {
    return { ...this.state };
  }
  
  getTaskById(id) {
    return this.state.tasks.find(task => task.id === id);
  }
  
  getSubtaskById(taskId, subtaskId) {
    const task = this.getTaskById(taskId);
    return task?.subtasks?.find(subtask => subtask.id === subtaskId);
  }
  
  // State update methods
  setState(partialState, options = {}) {
    const { recordHistory = true } = options;
    
    // Create new state object by merging current state with updates
    const newState = {
      ...this.state,
      ...partialState,
      lastUpdated: new Date().toISOString(),
    };
    
    // Record in history if needed
    if (recordHistory) {
      this._addToHistory(this.state);
    }
    
    // Update state and emit change event
    this.state = newState;
    this.emit(STATE_EVENTS.CHANGE, this.state);
    
    // Persist state to file (debounced)
    this._debouncedSaveState();
  }
  
  // History methods
  _addToHistory(state) {
    // Remove any future history if we're in the middle of the history stack
    if (this.historyIndex < this.state.history.length - 1) {
      this.state.history = this.state.history.slice(0, this.historyIndex + 1);
    }
    
    // Add current state to history
    const historyCopy = [...this.state.history, JSON.parse(JSON.stringify(state))];
    
    // Limit history size
    if (historyCopy.length > this.maxHistory) {
      historyCopy.shift();
    }
    
    this.state.history = historyCopy;
    this.historyIndex = this.state.history.length - 1;
  }
  
  canUndo() {
    return this.historyIndex > 0;
  }
  
  canRedo() {
    return this.historyIndex < this.state.history.length - 1;
  }
  
  undo() {
    if (!this.canUndo()) return false;
    
    this.historyIndex--;
    const previousState = this.state.history[this.historyIndex];
    this.setState({ ...previousState, history: this.state.history }, { recordHistory: false });
    return true;
  }
  
  redo() {
    if (!this.canRedo()) return false;
    
    this.historyIndex++;
    const nextState = this.state.history[this.historyIndex];
    this.setState({ ...nextState, history: this.state.history }, { recordHistory: false });
    return true;
  }
  
  // File persistence methods
  async loadState() {
    this.setState({ loading: true });
    
    try {
      if (await fileExists('tasks.json')) {
        const data = await fs.readFile('tasks.json', 'utf8');
        const tasksData = JSON.parse(data);
        
        this.setState({ 
          tasks: tasksData,
          loading: false,
          error: null
        });
        
        return true;
      } else {
        this.setState({ 
          tasks: [],
          loading: false 
        });
        
        return false;
      }
    } catch (error) {
      this.setState({ 
        error: `Failed to load state: ${error.message}`,
        loading: false
      });
      
      throw error;
    }
  }
  
  async saveState() {
    try {
      await acquireLock('tasks.json.lock');
      
      // Create backup
      if (await fileExists('tasks.json')) {
        await fs.copyFile('tasks.json', 'tasks.json.backup');
      }
      
      // Save current tasks
      await fs.writeFile(
        'tasks.json',
        JSON.stringify(this.state.tasks, null, 2),
        'utf8'
      );
      
      await releaseLock('tasks.json.lock');
      return true;
    } catch (error) {
      this.setState({ 
        error: `Failed to save state: ${error.message}` 
      });
      
      await releaseLock('tasks.json.lock');
      throw error;
    }
  }
  
  // Create debounced version of saveState
  _debouncedSaveState = debounce(async () => {
    await this.saveState();
  }, 300);
  
  // Task query methods
  getPendingTasks() {
    return this.state.tasks.filter(task => task.status === 'pending');
  }
  
  getTasksByStatus(status) {
    return this.state.tasks.filter(task => task.status === status);
  }
  
  getTasksWithCompletedDependencies() {
    return this.state.tasks.filter(task => {
      // If task is already done or deferred, skip it
      if (task.status === 'done' || task.status === 'deferred') {
        return false;
      }
      
      // If no dependencies, task is available
      if (!task.dependencies || task.dependencies.length === 0) {
        return true;
      }
      
      // Check if all dependencies are satisfied
      return task.dependencies.every(depId => {
        const depTask = this.getTaskById(depId);
        return depTask && depTask.status === 'done';
      });
    });
  }
  
  getNextTask() {
    const availableTasks = this.getTasksWithCompletedDependencies();
    
    // Sort by priority (high, medium, low)
    const priorityValues = { high: 0, medium: 1, low: 2 };
    
    return availableTasks.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityValues[a.priority] - priorityValues[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by ID (assuming numeric or comparable IDs)
      return a.id - b.id;
    })[0];
  }
}

// Export singleton instance
export const taskStore = new TaskState();
```

#### 4.1.2. Action Creators

Implement a set of action creators that encapsulate all state mutations.

**Technical Requirements:**
- Create an `actions.js` module
- Implement core task actions:
  - `loadTasks()`: Load tasks from storage
  - `addTask(taskData)`: Add a new task
  - `updateTask(id, taskData)`: Update an existing task
  - `removeTask(id)`: Remove a task
  - `setTaskStatus(id, status)`: Update task status
  - `addSubtask(taskId, subtaskData)`: Add a subtask
  - `updateSubtask(taskId, subtaskId, subtaskData)`: Update a subtask
  - `removeSubtask(taskId, subtaskId)`: Remove a subtask
  - `setSubtaskStatus(taskId, subtaskId, status)`: Update subtask status
  - `addDependency(taskId, dependsOnId)`: Add a task dependency
  - `removeDependency(taskId, dependsOnId)`: Remove a task dependency
  - `expandTask(taskId, options)`: Generate subtasks for a task
  - `clearSubtasks(taskId)`: Remove all subtasks from a task
- Implement history-related actions:
  - `undoLastAction()`: Restore previous state
  - `redoAction()`: Restore next state
- Add validation to all actions
- Ensure all actions are asynchronous and return Promises

**Example Implementation:**
```javascript
// actions.js
import { taskStore } from './state-store.js';
import { taskStateMachine } from './task-state-machine.js';
import { v4 as uuidv4 } from 'uuid';
import { validateTask, validateSubtask } from './validators.js';

export const actions = {
  async loadTasks() {
    return await taskStore.loadState();
  },
  
  async addTask(taskData) {
    const { tasks } = taskStore.getState();
    
    // Validate task data
    const validatedTask = validateTask(taskData);
    
    // Generate ID if not provided
    if (!validatedTask.id) {
      validatedTask.id = tasks.length > 0 
        ? Math.max(...tasks.map(t => parseInt(t.id))) + 1 
        : 1;
    }
    
    // Set defaults
    const newTask = {
      status: 'pending',
      priority: 'medium',
      dependencies: [],
      subtasks: [],
      ...validatedTask,
    };
    
    // Update state
    taskStore.setState({
      tasks: [...tasks, newTask]
    });
    
    return newTask;
  },
  
  async updateTask(id, taskData) {
    const { tasks } = taskStore.getState();
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    // Validate update data
    const validatedUpdate = validateTask(taskData, { partial: true });
    
    // Create updated task
    const updatedTask = {
      ...tasks[taskIndex],
      ...validatedUpdate,
    };
    
    // Update state
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    taskStore.setState({ tasks: updatedTasks });
    
    return updatedTask;
  },
  
  async removeTask(id) {
    const { tasks } = taskStore.getState();
    
    // Check for dependencies on this task
    const dependentTasks = tasks.filter(task => 
      task.dependencies && task.dependencies.includes(id)
    );
    
    if (dependentTasks.length > 0) {
      const depIds = dependentTasks.map(t => t.id).join(', ');
      throw new Error(`Cannot remove task ${id} because tasks ${depIds} depend on it`);
    }
    
    // Filter out the task
    const updatedTasks = tasks.filter(task => task.id !== id);
    
    // Update state
    taskStore.setState({ tasks: updatedTasks });
    
    return true;
  },
  
  async setTaskStatus(id, status) {
    const { tasks } = taskStore.getState();
    const task = tasks.find(t => t.id === id);
    
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    // Validate transition
    const updatedTask = taskStateMachine.transition(task, status);
    
    // Update subtasks if task is being marked as done
    if (status === 'done' && task.subtasks && task.subtasks.length > 0) {
      updatedTask.subtasks = task.subtasks.map(subtask => ({
        ...subtask,
        status: 'done'
      }));
    }
    
    // Apply update
    return await this.updateTask(id, updatedTask);
  },
  
  // Subtask actions
  async addSubtask(taskId, subtaskData) {
    const task = taskStore.getTaskById(taskId);
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Validate subtask data
    const validatedSubtask = validateSubtask(subtaskData);
    
    // Generate ID if not provided
    if (!validatedSubtask.id) {
      const currentSubtasks = task.subtasks || [];
      validatedSubtask.id = currentSubtasks.length > 0 
        ? Math.max(...currentSubtasks.map(s => parseInt(s.id))) + 1 
        : 1;
    }
    
    // Set defaults
    const newSubtask = {
      status: 'pending',
      priority: task.priority,
      ...validatedSubtask
    };
    
    // Add to task
    const updatedSubtasks = [...(task.subtasks || []), newSubtask];
    
    // Update task
    await this.updateTask(taskId, { subtasks: updatedSubtasks });
    
    return newSubtask;
  },
  
  // ... Additional action implementations
  
  async undoLastAction() {
    return taskStore.undo();
  },
  
  async redoAction() {
    return taskStore.redo();
  }
};
```

#### 4.1.3. State Observers

Implement a system of observers to react to state changes.

**Technical Requirements:**
- Create an `observers.js` module
- Implement observers for:
  - State persistence (saving to disk)
  - Logging (when debug mode is enabled)
  - Dependency validation
  - Automated task status updates
- Add a registration system for plugins to add their own observers
- Implement debouncing for performance-critical observers

**Example Implementation:**
```javascript
// observers.js
import { taskStore, STATE_EVENTS } from './state-store.js';
import { logger } from './logger.js';
import fs from 'fs/promises';
import { validateDependencies } from './validators.js';

// Observer for logging state changes
export function setupLogging() {
  if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
    taskStore.on(STATE_EVENTS.CHANGE, (state) => {
      logger.debug('State updated:', {
        tasksCount: state.tasks.length,
        timestamp: state.lastUpdated
      });
    });
    
    taskStore.on(STATE_EVENTS.ERROR, (error) => {
      logger.error('State error:', error);
    });
  }
}

// Observer for validating dependencies
export function setupDependencyValidation() {
  taskStore.on(STATE_EVENTS.TASK_UPDATED, async (task) => {
    try {
      // Validate dependencies to ensure no circular references
      const { tasks } = taskStore.getState();
      const { valid, errors } = validateDependencies(tasks);
      
      if (!valid) {
        logger.warn('Dependency validation errors:', errors);
      }
    } catch (error) {
      logger.error('Error validating dependencies:', error);
    }
  });
}

// Observer for automatic status updates
export function setupAutoStatusUpdates() {
  taskStore.on(STATE_EVENTS.TASK_UPDATED, async (task) => {
    // If all subtasks are done, mark parent as done
    if (task.subtasks && 
        task.subtasks.length > 0 && 
        task.subtasks.every(s => s.status === 'done') &&
        task.status !== 'done') {
      
      try {
        // Import actions here to avoid circular dependency
        const { actions } = await import('./actions.js');
        await actions.setTaskStatus(task.id, 'done');
        logger.info(`Task ${task.id} automatically marked as done because all subtasks are complete`);
      } catch (error) {
        logger.error(`Error auto-updating task ${task.id} status:`, error);
      }
    }
  });
}

// Setup all observers
export function setupAllObservers() {
  setupLogging();
  setupDependencyValidation();
  setupAutoStatusUpdates();
}
```

#### 4.1.4. Task State Machine

Implement a state machine to manage valid task state transitions.

**Technical Requirements:**
- Create a `task-state-machine.js` module
- Define valid task states: 'pending', 'in-progress', 'done', 'deferred'
- Implement valid state transitions between these states
- Add validation for state transitions
- Include hooks for pre/post transition actions
- Support custom state transitions for advanced workflows

**Example Implementation:**
```javascript
// task-state-machine.js
export const TASK_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  DEFERRED: 'deferred'
};

// Define valid transitions between states
const VALID_TRANSITIONS = {
  [TASK_STATES.PENDING]: [TASK_STATES.IN_PROGRESS, TASK_STATES.DEFERRED],
  [TASK_STATES.IN_PROGRESS]: [TASK_STATES.DONE, TASK_STATES.PENDING, TASK_STATES.DEFERRED],
  [TASK_STATES.DEFERRED]: [TASK_STATES.PENDING, TASK_STATES.IN_PROGRESS],
  [TASK_STATES.DONE]: [TASK_STATES.PENDING] // Allow reopening tasks
};

// Hooks that run before and after transition
const transitionHooks = {
  before: {},
  after: {}
};

export const taskStateMachine = {
  // Check if a transition is valid
  canTransition(fromState, toState) {
    return VALID_TRANSITIONS[fromState]?.includes(toState) || false;
  },
  
  // Perform the transition
  transition(task, newStatus) {
    const oldStatus = task.status;
    
    // Check if the transition is valid
    if (!this.canTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid transition from ${oldStatus} to ${newStatus}`);
    }
    
    // Run 'before' hooks
    if (transitionHooks.before[oldStatus]?.has?.[newStatus]) {
      transitionHooks.before[oldStatus][newStatus](task);
    }
    
    // Create the updated task with new status
    const updatedTask = { ...task, status: newStatus };
    
    // Run 'after' hooks
    if (transitionHooks.after[oldStatus]?.has?.[newStatus]) {
      transitionHooks.after[oldStatus][newStatus](updatedTask, task);
    }
    
    return updatedTask;
  },
  
  // Register hooks for transitions
  registerBeforeHook(fromState, toState, hookFn) {
    if (!transitionHooks.before[fromState]) {
      transitionHooks.before[fromState] = {};
    }
    transitionHooks.before[fromState][toState] = hookFn;
  },
  
  registerAfterHook(fromState, toState, hookFn) {
    if (!transitionHooks.after[fromState]) {
      transitionHooks.after[fromState] = {};
    }
    transitionHooks.after[fromState][toState] = hookFn;
  },
  
  // Get all valid next states
  getValidNextStates(currentState) {
    return VALID_TRANSITIONS[currentState] || [];
  },
  
  // Register custom transition
  registerCustomTransition(fromState, toState) {
    if (!VALID_TRANSITIONS[fromState]) {
      VALID_TRANSITIONS[fromState] = [];
    }
    
    if (!VALID_TRANSITIONS[fromState].includes(toState)) {
      VALID_TRANSITIONS[fromState].push(toState);
    }
  }
};
```

### 4.2. Phase 2: Refactor CLI Commands

#### 4.2.1. CLI Command Infrastructure

Create a new architecture for CLI commands that uses the state store.

**Technical Requirements:**
- Refactor `cli.js` to use the new state management
- Create a `commands/` directory with a file for each command
- Implement a command registry system
- Ensure backward compatibility with existing command names and options
- Add command validation using Yargs or similar library
- Include help text for all commands

**Example Implementation:**
```javascript
// cli.js
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { taskStore } from './state-store.js';
import { setupAllObservers } from './observers.js';
import { loadCommands } from './commands/index.js';
import { logger } from './logger.js';

// Setup observers
setupAllObservers();

// Main CLI function
async function main() {
  try {
    // Initial state load
    await taskStore.loadState();
    
    // Load all commands
    const commands = await loadCommands();
    
    // Setup CLI parser
    const parser = yargs(hideBin(process.argv))
      .scriptName('task-master')
      .usage('$0 <cmd> [args]')
      .version()
      .help();
    
    // Register each command with the parser
    Object.entries(commands).forEach(([name, command]) => {
      parser.command(
        command.command,
        command.description,
        command.builder,
        command.handler
      );
    });
    
    // Add global options
    parser.option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Run with verbose logging'
    });
    
    // Parse and execute
    await parser.parse();
  } catch (error) {
    logger.error('Error executing command:', error);
    process.exit(1);
  }
}

main();
```

```javascript
// commands/index.js
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands() {
  const commandFiles = readdirSync(__dirname)
    .filter(file => file !== 'index.js' && file.endsWith('.js'));
  
  const commands = {};
  
  for (const file of commandFiles) {
    const commandName = path.basename(file, '.js');
    const { default: command } = await import(`./${file}`);
    commands[commandName] = command;
  }
  
  return commands;
}
```

#### 4.2.2. Refactor Individual Commands

Refactor each CLI command to use the new state management system.

**Technical Requirements:**
- Refactor the following commands (one-by-one):
  - `list`: List all tasks
  - `show`: Show task details
  - `next`: Show next available task
  - `set-status`: Update task status
  - `add-task`: Add a new task
  - `expand`: Generate subtasks for a task
  - `clear-subtasks`: Remove subtasks from a task
  - `add-dependency`: Add a task dependency
  - `remove-dependency`: Remove a task dependency
  - `parse-prd`: Parse a PRD file and generate tasks
  - `generate`: Generate task files from state
  - `update`: Update tasks with new context
  - `analyze-complexity`: Analyze task complexity
  - `complexity-report`: Show complexity analysis report
  - `validate-dependencies`: Validate task dependencies
  - `fix-dependencies`: Fix invalid dependencies

**Example Implementation (list command):**
```javascript
// commands/list.js
import { actions } from '../actions.js';
import { taskStore } from '../state-store.js';
import chalk from 'chalk';
import Table from 'cli-table3';

export default {
  command: 'list [options]',
  description: 'List all tasks',
  builder: (yargs) => {
    return yargs
      .option('status', {
        describe: 'Filter tasks by status',
        type: 'string',
        choices: ['pending', 'in-progress', 'done', 'deferred']
      })
      .option('with-subtasks', {
        describe: 'Include subtasks in the listing',
        type: 'boolean',
        default: false
      });
  },
  handler: async (argv) => {
    try {
      // Ensure state is loaded
      await actions.loadTasks();
      
      const { tasks } = taskStore.getState();
      
      // Filter tasks by status if specified
      const filteredTasks = argv.status 
        ? tasks.filter(task => task.status === argv.status)
        : tasks;
      
      if (filteredTasks.length === 0) {
        console.log('No tasks found matching the criteria.');
        return;
      }
      
      // Create and configure the table
      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Priority'),
          chalk.bold('Dependencies')
        ],
        colWidths: [10, 40, 15, 15, 30]
      });
      
      // Add task rows
      for (const task of filteredTasks) {
        // Format dependencies with status indicators
        const dependencies = task.dependencies && task.dependencies.length > 0
          ? task.dependencies.map(depId => {
              const depTask = tasks.find(t => t.id === depId);
              const status = depTask?.status === 'done' 
                ? chalk.green('✅') 
                : chalk.yellow('⏱️');
              return `${status} ${depId}`;
            }).join(', ')
          : 'None';
        
        // Style status based on value
        let statusDisplay;
        switch (task.status) {
          case 'done':
            statusDisplay = chalk.green(task.status);
            break;
          case 'in-progress':
            statusDisplay = chalk.blue(task.status);
            break;
          case 'deferred':
            statusDisplay = chalk.gray(task.status);
            break;
          default:
            statusDisplay = chalk.yellow(task.status);
        }
        
        // Style priority based on value
        let priorityDisplay;
        switch (task.priority) {
          case 'high':
            priorityDisplay = chalk.red(task.priority);
            break;
          case 'medium':
            priorityDisplay = chalk.yellow(task.priority);
            break;
          case 'low':
            priorityDisplay = chalk.green(task.priority);
            break;
          default:
            priorityDisplay = task.priority;
        }
        
        // Add task row
        table.push([
          task.id,
          task.title,
          statusDisplay,
          priorityDisplay,
          dependencies
        ]);
        
        // Include subtasks if requested
        if (argv.withSubtasks && task.subtasks && task.subtasks.length > 0) {
          for (const subtask of task.subtasks) {
            table.push([
              `${task.id}.${subtask.id}`,
              `  ↪ ${subtask.title}`,
              subtask.status === 'done' 
                ? chalk.green(subtask.status) 
                : chalk.yellow(subtask.status),
              subtask.priority 
                ? (subtask.priority === 'high' 
                    ? chalk.red(subtask.priority) 
                    : subtask.priority === 'medium' 
                      ? chalk.yellow(subtask.priority) 
                      : chalk.green(subtask.priority))
                : '',
              ''
            ]);
          }
        }
      }
      
      // Print the table
      console.log(table.toString());
      
      // Print summary
      console.log(`\nTotal: ${filteredTasks.length} task(s)`);
      
    } catch (error) {
      console.error('Error listing tasks:', error.message);
      process.exit(1);
    }
  }
};
```

**Example Implementation (set-status command):**
```javascript
// commands/set-status.js
import { actions } from '../actions.js';
import { taskStateMachine, TASK_STATES } from '../task-state-machine.js';

export default {
  command: 'set-status',
  description: 'Set the status of a task or subtask',
  builder: (yargs) => {
    return yargs
      .option('id', {
        describe: 'Task ID or comma-separated list of IDs',
        type: 'string',
        demandOption: true
      })
      .option('status', {
        describe: 'New status for the task(s)',
        type: 'string',
        choices: Object.values(TASK_STATES),
        demandOption: true
      });
  },
  handler: async (argv) => {
    try {
      // Ensure state is loaded
      await actions.loadTasks();
      
      // Parse IDs
      const ids = argv.id.split(',');
      let successCount = 0;
      const errors = [];
      
      for (const idString of ids) {
        try {
          // Check if this is a subtask ID (format: taskId.subtaskId)
          if (idString.includes('.')) {
            const [taskId, subtaskId] = idString.split('.').map(id => parseInt(id));
            
            await actions.setSubtaskStatus(taskId, subtaskId, argv.status);
            console.log(`Subtask ${taskId}.${subtaskId} status set to ${argv.status}.`);
          } else {
            // Regular task
            const id = parseInt(idString);
            
            await actions.setTaskStatus(id, argv.status);
            console.log(`Task ${id} status set to ${argv.status}.`);
          }
          
          successCount++;
        } catch (error) {
          errors.push(`Error updating task ${idString}: ${error.message}`);
        }
      }
      
      // Report results
      if (successCount > 0) {
        console.log(`\nSuccessfully updated ${successCount} task(s).`);
      }
      
      if (errors.length > 0) {
        console.error('\nErrors:');
        errors.forEach(err => console.error(`- ${err}`));
        
        if (errors.length === ids.length) {
          // All updates failed
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error setting task status:', error.message);
      process.exit(1);
    }
  }
};
```

### 4.3. Phase 3: Testing Infrastructure

#### 4.3.1. Test Setup

Implement a testing framework for the new state management system.

**Technical Requirements:**
- Use Jest or Mocha for testing
- Create test helpers for state store
- Implement mock file system for tests
- Add fixtures for common test scenarios
- Setup CI test pipeline

**Example Implementation:**
```javascript
// tests/setup.js
import fs from 'fs';
import { jest } from '@jest/globals';
import { taskStore } from '../src/state-store.js';

// Mock the file system
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  copyFile: jest.fn(),
  access: jest.fn()
}));

// Reset mocks and state before each test
beforeEach(() => {
  jest.clearAllMocks();
  taskStore.state = {
    tasks: [],
    currentTask: null,
    loading: false,
    error: null,
    lastUpdated: null,
    history: []
  };
});

// Helper to create test tasks
export function createTestTask(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    title: 'Test Task',
    description: 'This is a test task',
    status: 'pending',
    priority: 'medium',
    dependencies: [],
    subtasks: [],
    ...overrides
  };
}

// Helper to setup test state
export function setupTestState(tasks = []) {
  taskStore.state = {
    ...taskStore.state,
    tasks
  };
}
```

#### 4.3.2. Unit Tests

Write unit tests for the state store and action creators.

**Technical Requirements:**
- Test all state store methods
- Test all action creators
- Test state transitions
- Test observer system
- Test validation logic
- Implement snapshot testing where appropriate

**Example Implementation:**
```javascript
// tests/state-store.test.js
import { taskStore, STATE_EVENTS } from '../src/state-store.js';
import { createTestTask, setupTestState } from './setup.js';
import fs from 'fs/promises';

describe('TaskState Store', () => {
  test('getState returns a copy of the state', () => {
    // Arrange
    const testTask = createTestTask();
    setupTestState([testTask]);
    
    // Act
    const state = taskStore.getState();
    
    // Assert
    expect(state).toEqual({
      tasks: [testTask],
      currentTask: null,
      loading: false,
      error: null,
      lastUpdated: null,
      history: []
    });
    
    // Modify the returned state (should not affect internal state)
    state.tasks = [];
    
    // Verify internal state is unchanged
    expect(taskStore.getState().tasks).toEqual([testTask]);
  });
  
  test('setState updates state and emits change event', () => {
    // Arrange
    const listener = jest.fn();
    taskStore.on(STATE_EVENTS.CHANGE, listener);
    
    // Act
    taskStore.setState({ loading: true });
    
    // Assert
    expect(taskStore.getState().loading).toBe(true);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      loading: true
    }));
  });
  
  test('getTaskById returns the correct task', () => {
    // Arrange
    const task1 = createTestTask({ id: 1 });
    const task2 = createTestTask({ id: 2 });
    setupTestState([task1, task2]);
    
    // Act
    const result = taskStore.getTaskById(2);
    
    // Assert
    expect(result).toEqual(task2);
  });
  
  test('saveState writes tasks to disk', async () => {
    // Arrange
    const tasks = [createTestTask({ id: 1 })];
    setupTestState(tasks);
    fs.writeFile.mockResolvedValue(undefined);
    
    // Act
    await taskStore.saveState();
    
    // Assert
    expect(fs.writeFile).toHaveBeenCalledWith(
      'tasks.json',
      JSON.stringify(tasks, null, 2),
      'utf8'
    );
  });
  
  // Additional tests...
});
```

```javascript
// tests/actions.test.js
import { actions } from '../src/actions.js';
import { taskStore } from '../src/state-store.js';
import { createTestTask, setupTestState } from './setup.js';

describe('Task Actions', () => {
  test('addTask adds a task with defaults', async () => {
    // Arrange
    const taskData = {
      title: 'New Task',
      description: 'Task description'
    };
    
    // Act
    const result = await actions.addTask(taskData);
    
    // Assert
    expect(result).toMatchObject({
      id: expect.any(Number),
      title: 'New Task',
      description: 'Task description',
      status: 'pending',
      priority: 'medium',
      dependencies: [],
      subtasks: []
    });
    
    // Verify state was updated
    expect(taskStore.getState().tasks).toContainEqual(result);
  });
  
  test('setTaskStatus updates task status', async () => {
    // Arrange
    const task = createTestTask({ id: 1 });
    setupTestState([task]);
    
    // Act
    await actions.setTaskStatus(1, 'in-progress');
    
    // Assert
    const updatedTask = taskStore.getTaskById(1);
    expect(updatedTask.status).toBe('in-progress');
  });
  
  test('setTaskStatus marks subtasks as done when task is done', async () => {
    // Arrange
    const subtasks = [
      { id: 1, title: 'Subtask 1', status: 'pending' },
      { id: 2, title: 'Subtask 2', status: 'pending' }
    ];
    const task = createTestTask({ id: 1, subtasks });
    setupTestState([task]);
    
    // Act
    await actions.setTaskStatus(1, 'done');
    
    // Assert
    const updatedTask = taskStore.getTaskById(1);
    expect(updatedTask.status).toBe('done');
    expect(updatedTask.subtasks).toEqual([
      { id: 1, title: 'Subtask 1', status: 'done' },
      { id: 2, title: 'Subtask 2', status: 'done' }
    ]);
  });
  
  // Additional tests...
});
```

#### 4.3.3. Integration Tests

Write integration tests for the CLI commands.

**Technical Requirements:**
- Test CLI command execution
- Test command option handling
- Test error handling
- Test file operations (mocked)
- Test user interactions (mocked)

**Example Implementation:**
```javascript
// tests/integration/list-command.test.js
import { jest } from '@jest/globals';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createTestTask, setupTestState } from '../setup.js';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});

describe('list command', () => {
  beforeEach(() => {
    // Setup mock file system
    fs.readFile.mockResolvedValue(JSON.stringify([
      createTestTask({ 
        id: 1, 
        title: 'Task 1', 
        status: 'pending',
        priority: 'high'
      }),
      createTestTask({ 
        id: 2, 
        title: 'Task 2', 
        status: 'done',
        priority: 'medium'
      }),
      createTestTask({ 
        id: 3, 
        title: 'Task 3', 
        status: 'pending',
        priority: 'low',
        dependencies: [2]
      })
    ]));
  });
  
  test('list command shows all tasks', async () => {
    // Act
    const { stdout } = await execFileAsync('node', ['src/cli.js', 'list']);
    
    // Assert
    expect(stdout).toContain('Task 1');
    expect(stdout).toContain('Task 2');
    expect(stdout).toContain('Task 3');
    expect(stdout).toContain('Total: 3 task(s)');
  });
  
  test('list command filters by status', async () => {
    // Act
    const { stdout } = await execFileAsync('node', ['src/cli.js', 'list', '--status=pending']);
    
    // Assert
    expect(stdout).toContain('Task 1');
    expect(stdout).not.toContain('Task 2');
    expect(stdout).toContain('Task 3');
    expect(stdout).toContain('Total: 2 task(s)');
  });
  
  // Additional tests...
});
```

### 4.4. Phase 4: State Machine Refinement

#### 4.4.1. Advanced State Transitions

Implement advanced state transition features.

**Technical Requirements:**
- Add support for custom states
- Implement state history for tasks
- Add transition hooks for complex workflows
- Implement state validation rules
- Add support for bulk state updates
- Implement state change events for plugins

**Example Implementation:**
```javascript
// task-state-machine.js (extended)
import { EventEmitter } from 'events';

export const TASK_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  DEFERRED: 'deferred',
  // Allow custom states
  custom: (name) => `custom:${name}`
};

// State history tracking
class TaskStateHistory {
  constructor(maxHistory = 10) {
    this.history = new Map(); // taskId -> state history array
    this.maxHistory = maxHistory;
  }
  
  recordTransition(taskId, fromState, toState, timestamp = new Date()) {
    if (!this.history.has(taskId)) {
      this.history.set(taskId, []);
    }
    
    const taskHistory = this.history.get(taskId);
    
    // Add new entry
    taskHistory.push({
      from: fromState,
      to: toState,
      timestamp
    });
    
    // Limit history size
    if (taskHistory.length > this.maxHistory) {
      taskHistory.shift();
    }
  }
  
  getHistory(taskId) {
    return this.history.get(taskId) || [];
  }
  
  clear(taskId) {
    this.history.delete(taskId);
  }
}

// Enhanced state machine with events
export class TaskStateMachine extends EventEmitter {
  constructor() {
    super();
    
    // Standard transitions
    this.validTransitions = {
      [TASK_STATES.PENDING]: [TASK_STATES.IN_PROGRESS, TASK_STATES.DEFERRED],
      [TASK_STATES.IN_PROGRESS]: [TASK_STATES.DONE, TASK_STATES.PENDING, TASK_STATES.DEFERRED],
      [TASK_STATES.DEFERRED]: [TASK_STATES.PENDING, TASK_STATES.IN_PROGRESS],
      [TASK_STATES.DONE]: [TASK_STATES.PENDING]
    };
    
    // Transition hooks
    this.hooks = {
      before: {},
      after: {}
    };
    
    // State history
    this.history = new TaskStateHistory();
  }
  
  // Check if a transition is valid
  canTransition(fromState, toState) {
    // Handle custom states
    if (fromState.startsWith('custom:') || toState.startsWith('custom:')) {
      // Custom states can transition to any standard state and vice-versa
      return true;
    }
    
    return this.validTransitions[fromState]?.includes(toState) || false;
  }
  
  // Perform the transition
  transition(task, newStatus, options = {}) {
    const { recordHistory = true, force = false } = options;
    const oldStatus = task.status;
    
    // Check if the transition is valid unless forced
    if (!force && !this.canTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid transition from ${oldStatus} to ${newStatus}`);
    }
    
    // Run 'before' hooks if they exist
    this._runHooks('before', oldStatus, newStatus, task);
    
    // Create the updated task with new status
    const updatedTask = { 
      ...task, 
      status: newStatus,
      lastStatusChange: new Date().toISOString()
    };
    
    // Record in history if enabled
    if (recordHistory) {
      this.history.recordTransition(task.id, oldStatus, newStatus);
    }
    
    // Run 'after' hooks if they exist
    this._runHooks('after', oldStatus, newStatus, updatedTask, task);
    
    // Emit events
    this.emit('transition', {
      task: updatedTask,
      prevTask: task,
      fromState: oldStatus,
      toState: newStatus
    });
    
    return updatedTask;
  }
  
  // Run transition hooks
  _runHooks(stage, fromState, toState, ...args) {
    // State-specific hooks
    if (this.hooks[stage][fromState]?.[toState]) {
      this.hooks[stage][fromState][toState](...args);
    }
    
    // From-state hooks (all destinations)
    if (this.hooks[stage][fromState]?.['*']) {
      this.hooks[stage][fromState]['*'](...args);
    }
    
    // To-state hooks (all sources)
    if (this.hooks[stage]['*']?.[toState]) {
      this.hooks[stage]['*'][toState](...args);
    }
    
    // Global hooks
    if (this.hooks[stage]['*']?.['*']) {
      this.hooks[stage]['*']['*'](...args);
    }
  }
  
  // Register hooks for transitions
  registerHook(stage, fromState, toState, hookFn) {
    if (!this.hooks[stage][fromState]) {
      this.hooks[stage][fromState] = {};
    }
    this.hooks[stage][fromState][toState] = hookFn;
    return this; // For chaining
  }
  
  // Register before hook
  before(fromState, toState, hookFn) {
    return this.registerHook('before', fromState, toState, hookFn);
  }
  
  // Register after hook
  after(fromState, toState, hookFn) {
    return this.registerHook('after', fromState, toState, hookFn);
  }
  
  // Get task's state history
  getStateHistory(taskId) {
    return this.history.getHistory(taskId);
  }
  
  // Clear task's state history
  clearStateHistory(taskId) {
    this.history.clear(taskId);
  }
  
  // Get all valid next states
  getValidNextStates(currentState) {
    return this.validTransitions[currentState] || [];
  }
  
  // Register custom transition
  registerTransition(fromState, toState) {
    if (!this.validTransitions[fromState]) {
      this.validTransitions[fromState] = [];
    }
    
    if (!this.validTransitions[fromState].includes(toState)) {
      this.validTransitions[fromState].push(toState);
    }
    
    return this; // For chaining
  }
  
  // Get visualization of state machine (for documentation)
  getVisualization() {
    const nodes = Object.keys(this.validTransitions);
    const edges = [];
    
    nodes.forEach(fromState => {
      (this.validTransitions[fromState] || []).forEach(toState => {
        edges.push({ from: fromState, to: toState });
      });
    });
    
    return { nodes, edges };
  }
}

// Export singleton instance
export const taskStateMachine = new TaskStateMachine();
```

#### 4.4.2. Bulk State Operations

Implement functions for bulk state operations.

**Technical Requirements:**
- Add support for batch task updates
- Implement optimized state diffing
- Add transaction-like state updates
- Implement rollback capability for failed batches
- Add retry logic for persistence failures

**Example Implementation:**
```javascript
// bulk-operations.js
import { taskStore } from './state-store.js';
import { taskStateMachine } from './task-state-machine.js';
import { logger } from './logger.js';

export const bulkOperations = {
  /**
   * Update multiple tasks in a single operation
   */
  async updateTasks(updates) {
    const { tasks } = taskStore.getState();
    const updatedTasks = [...tasks];
    const snapshot = JSON.parse(JSON.stringify(tasks));
    
    try {
      // Start transaction
      taskStore.setState({ loading: true });
      
      // Apply updates
      for (const update of updates) {
        const { id, changes } = update;
        const taskIndex = updatedTasks.findIndex(t => t.id === id);
        
        if (taskIndex === -1) {
          logger.warn(`Task with ID ${id} not found for bulk update`);
          continue;
        }
        
        // Apply changes
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          ...changes
        };
      }
      
      // Update state
      taskStore.setState({ 
        tasks: updatedTasks,
        loading: false
      });
      
      return true;
    } catch (error) {
      // Rollback on error
      logger.error('Bulk update failed, rolling back:', error);
      taskStore.setState({ 
        tasks: snapshot,
        loading: false,
        error: error.message
      });
      
      return false;
    }
  },
  
  /**
   * Transition multiple tasks to a new status
   */
  async transitionTasks(taskIds, newStatus) {
    const { tasks } = taskStore.getState();
    const updates = [];
    const errors = [];
    
    // Prepare updates
    for (const id of taskIds) {
      const task = tasks.find(t => t.id === id);
      
      if (!task) {
        errors.push(`Task with ID ${id} not found`);
        continue;
      }
      
      try {
        // Validate transition
        if (!taskStateMachine.canTransition(task.status, newStatus)) {
          errors.push(`Cannot transition task ${id} from ${task.status} to ${newStatus}`);
          continue;
        }
        
        updates.push({
          id,
          changes: {
            status: newStatus,
            lastStatusChange: new Date().toISOString()
          }
        });
      } catch (error) {
        errors.push(`Error preparing update for task ${id}: ${error.message}`);
      }
    }
    
    // If all tasks failed, abort
    if (updates.length === 0) {
      return {
        success: false,
        updated: 0,
        errors
      };
    }
    
    // Apply updates
    const success = await this.updateTasks(updates);
    
    return {
      success,
      updated: success ? updates.length : 0,
      errors
    };
  },
  
  /**
   * Apply the same update to multiple tasks
   */
  async applyToAll(taskIds, updateFn) {
    const { tasks } = taskStore.getState();
    const updates = [];
    const errors = [];
    
    // Prepare updates
    for (const id of taskIds) {
      const task = tasks.find(t => t.id === id);
      
      if (!task) {
        errors.push(`Task with ID ${id} not found`);
        continue;
      }
      
      try {
        // Apply the update function to get changes
        const changes = updateFn(task);
        updates.push({ id, changes });
      } catch (error) {
        errors.push(`Error preparing update for task ${id}: ${error.message}`);
      }
    }
    
    // Apply updates
    const success = await this.updateTasks(updates);
    
    return {
      success,
      updated: success ? updates.length : 0,
      errors
    };
  },
  
  /**
   * Filter and update tasks in bulk
   */
  async updateWhere(filterFn, updateFn) {
    const { tasks } = taskStore.getState();
    const taskIds = tasks.filter(filterFn).map(task => task.id);
    
    return await this.applyToAll(taskIds, updateFn);
  }
};
```

### 4.5. Phase 5: Extensions and Plugins

#### 4.5.1. Plugin System

Implement a plugin system for extending the task management functionality.

**Technical Requirements:**
- Create a plugin registration system
- Define plugin hook points
- Support for custom CLI commands
- Support for custom state transformations
- Integration with external tools
- Plugin configuration management

**Example Implementation:**
```javascript
// plugin-system.js
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin registry
const plugins = new Map();

// Hook registry
const hooks = {
  'state:change': [],
  'task:create': [],
  'task:update': [],
  'task:delete': [],
  'task:status-change': [],
  'cli:before-command': [],
  'cli:after-command': [],
  'file:before-save': [],
  'file:after-save': [],
  'api:request': []
};

// Register a plugin
export async function registerPlugin(pluginId, pluginModule) {
  if (plugins.has(pluginId)) {
    throw new Error(`Plugin "${pluginId}" is already registered`);
  }
  
  logger.debug(`Registering plugin: ${pluginId}`);
  
  // Register plugin
  plugins.set(pluginId, {
    id: pluginId,
    module: pluginModule,
    hooks: new Set(),
    commands: new Map(),
    enabled: true
  });
  
  // Initialize plugin
  if (typeof pluginModule.initialize === 'function') {
    await pluginModule.initialize();
  }
  
  // Register hooks
  if (pluginModule.hooks) {
    Object.entries(pluginModule.hooks).forEach(([hookName, handler]) => {
      registerHook(hookName, handler, pluginId);
    });
  }
  
  // Register commands
  if (pluginModule.commands) {
    Object.entries(pluginModule.commands).forEach(([commandName, command]) => {
      registerCommand(commandName, command, pluginId);
    });
  }
  
  return true;
}

// Unregister a plugin
export function unregisterPlugin(pluginId) {
  if (!plugins.has(pluginId)) {
    return false;
  }
  
  const plugin = plugins.get(pluginId);
  
  // Remove all registered hooks
  for (const hookName of plugin.hooks) {
    hooks[hookName] = hooks[hookName].filter(h => h.pluginId !== pluginId);
  }
  
  // Remove registered commands
  plugin.commands.forEach((cmd, cmdName) => {
    // Implement command cleanup
  });
  
  // Cleanup plugin
  if (typeof plugin.module.cleanup === 'function') {
    plugin.module.cleanup();
  }
  
  // Remove from registry
  plugins.delete(pluginId);
  
  logger.debug(`Unregistered plugin: ${pluginId}`);
  
  return true;
}

// Register a hook
export function registerHook(hookName, handler, pluginId = null) {
  if (!hooks[hookName]) {
    hooks[hookName] = [];
  }
  
  hooks[hookName].push({
    handler,
    pluginId
  });
  
  // Track the hook in the plugin
  if (pluginId && plugins.has(pluginId)) {
    plugins.get(pluginId).hooks.add(hookName);
  }
}

// Execute a hook
export async function executeHook(hookName, context) {
  if (!hooks[hookName]) {
    return context;
  }
  
  let currentContext = context;
  
  for (const { handler } of hooks[hookName]) {
    try {
      // Allow hooks to modify the context
      currentContext = await handler(currentContext) || currentContext;
    } catch (error) {
      logger.error(`Error in hook ${hookName}:`, error);
    }
  }
  
  return currentContext;
}

// Register a command
export function registerCommand(commandName, command, pluginId = null) {
  if (pluginId && plugins.has(pluginId)) {
    plugins.get(pluginId).commands.set(commandName, command);
  }
  
  // Command registration will be handled by the command loader
  return true;
}

// Load all plugins from directory
export async function loadPlugins() {
  const pluginsDir = path.join(__dirname, '../plugins');
  
  try {
    // Check if plugins directory exists
    try {
      await fs.access(pluginsDir);
    } catch {
      // Create plugins directory if it doesn't exist
      await fs.mkdir(pluginsDir, { recursive: true });
      return [];
    }
    
    // Read plugin directories
    const pluginDirs = await fs.readdir(pluginsDir, { withFileTypes: true });
    
    // Load each plugin
    const loadedPlugins = [];
    
    for (const dirent of pluginDirs) {
      if (!dirent.isDirectory()) continue;
      
      const pluginId = dirent.name;
      const pluginPath = path.join(pluginsDir, pluginId, 'index.js');
      
      try {
        // Check if plugin entry point exists
        await fs.access(pluginPath);
        
        // Import plugin
        const pluginModule = await import(pluginPath);
        
        // Register plugin
        await registerPlugin(pluginId, pluginModule);
        
        loadedPlugins.push(pluginId);
      } catch (error) {
        logger.error(`Failed to load plugin ${pluginId}:`, error);
      }
    }
    
    return loadedPlugins;
  } catch (error) {
    logger.error('Error loading plugins:', error);
    return [];
  }
}

// Plugin API for plugin developers
export const pluginApi = {
  registerHook,
  executeHook,
  registerCommand,
  logger
};
```

### 4.6. Documentation

#### 4.6.1. Code Documentation

Update code documentation to reflect the new architecture.

**Technical Requirements:**
- Add JSDoc comments to all modules
- Generate API documentation
- Update code examples
- Document state transitions
- Add architecture diagrams

**Example Implementation:**
```javascript
/**
 * @file state-store.js
 * @description Centralized state management store for Task Master.
 * 
 * The state store is responsible for managing the application state,
 * including tasks, loading state, and error state. It uses the EventEmitter
 * pattern to notify subscribers of state changes.
 * 
 * @module state-store
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { fileExists, debounce, acquireLock, releaseLock } from './utils.js';

/**
 * Events emitted by the state store
 * @enum {string}
 */
export const STATE_EVENTS = {
  /** Emitted when the state changes */
  CHANGE: 'state:change',
  /** Emitted when a task is added */
  TASK_ADDED: 'state:task-added',
  /** Emitted when a task is updated */
  TASK_UPDATED: 'state:task-updated',
  /** Emitted when a task is removed */
  TASK_REMOVED: 'state:task-removed',
  /** Emitted when loading starts */
  LOADING_STARTED: 'state:loading-started',
  /** Emitted when loading finishes */
  LOADING_FINISHED: 'state:loading-finished',
  /** Emitted when an error occurs */
  ERROR: 'state:error',
};

/**
 * Task state management class
 * @extends EventEmitter
 */
class TaskState extends EventEmitter {
  /**
   * Create a new TaskState instance
   */
  constructor() {
    super();
    
    /**
     * The current state
     * @type {Object}
     * @property {Array<Object>} tasks - List of tasks
     * @property {Object|null} currentTask - Currently selected task
     * @property {boolean} loading - Loading state
     * @property {string|null} error - Error message
     * @property {string|null} lastUpdated - Timestamp of last update
     * @property {Array<Object>} history - State history for undo/redo
     */
    this.state = {
      tasks: [],
      currentTask: null,
      loading: false,
      error: null,
      lastUpdated: null,
      history: [],
    };
    
    /** @private */
    this.historyIndex = -1;
    
    /** @private */
    this.maxHistory = 50;
  }
  
  /**
   * Get a copy of the current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }
  
  // ... Additional JSDoc for other methods
}

// Export singleton instance
export const taskStore = new TaskState();
```

#### 4.6.2. User Documentation

Update user documentation to reflect the new architecture.

**Technical Requirements:**
- Update README.md
- Create architecture documentation
- Update command documentation
- Add state transition diagrams
- Document plugin system
- Add migration guide

**Example Implementation:**
```markdown
# Task Master

A task management system for AI-driven development with Claude.

## State Management Architecture

Task Master uses a centralized state management system built on the following principles:

1. **Single Source of Truth**: All application state is stored in a central store.
2. **Unidirectional Data Flow**: State updates flow in one direction.
3. **Immutable Updates**: State is never directly mutated.
4. **Event-Based**: State changes emit events that observers can listen for.

### State Store

The state store manages the application state and provides methods for accessing and updating it:

- `getState()`: Get the current state
- `setState(partialState)`: Update the state
- `getTaskById(id)`: Get a task by ID
- Query methods: `getPendingTasks()`, `getTasksWithCompletedDependencies()`, etc.

### Actions

Actions encapsulate state mutations and business logic:

- `loadTasks()`: Load tasks from storage
- `addTask(taskData)`: Add a new task
- `updateTask(id, taskData)`: Update a task
- `setTaskStatus(id, status)`: Update task status
- And many more...

### State Machine

Task status transitions are managed by a state machine:

- Defined states: `pending`, `in-progress`, `done`, `deferred`
- Valid transitions between states
- Hooks for pre/post transition actions
- State history tracking

#### State Transition Diagram

```
[pending] ---------> [in-progress] ---------> [done]
    ^                     |                     |
    |                     |                     |
    |                     v                     |
    +----------------- [deferred] <-------------+
```

### Observers

Observers react to state changes:

- Persistence: Save state to disk
- Logging: Log state changes
- Validation: Validate dependencies
- Auto-updates: Automatically update task status based on subtasks

### Plugin System

Extend Task Master with plugins:

- Register hooks for state changes
- Add custom CLI commands
- Transform state
- Integrate with external tools
```

## 5. Technical Considerations

### 5.1. Performance Optimization

- Implement state immutability with efficient object copying
- Use debouncing for disk writes
- Add memoization for expensive computations
- Implement lazy loading for large task sets
- Use incremental state updates

### 5.2. Backward Compatibility

- Maintain the same CLI interface
- Support the existing tasks.json format
- Provide migration utilities for customizations
- Ensure all current functionality works with the new architecture

### 5.3. Error Handling

- Implement comprehensive error reporting
- Add rollback capability for failed state updates
- Handle file system errors gracefully
- Validate state before updates
- Add retry logic for transient errors

### 5.4. Security

- Add validation for all user inputs
- Implement proper file locking for concurrent access
- Create backups before significant state changes
- Sanitize task data from external sources
- Add checksums for data integrity

## 6. Success Criteria

The conversion will be considered successful when:

1. All existing CLI commands work with the new state management system
2. All tests pass with the new architecture
3. Performance is maintained or improved
4. No regressions in functionality
5. Documentation is updated to reflect the new architecture
6. The plugin system is validated with at least one example plugin

## 7. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes | High | Medium | Thorough testing, backward compatibility layer |
| Performance regression | Medium | Low | Benchmarking, optimization |
| File corruption | High | Low | Backup system, checksums, atomic writes |
| Complex implementation | Medium | Medium | Incremental implementation, thorough documentation |
| Plugin compatibility | Medium | Medium | Plugin API versioning, backward compatibility |

## 8. Technical Debt Considerations

This conversion offers an opportunity to address existing technical debt:

- Inconsistent error handling
- Lack of validation
- File locking issues
- Dependency cycle detection
- Incomplete test coverage

## 9. Timeline Considerations

The conversion should be implemented incrementally:

1. Create the core state management infrastructure
2. Refactor one command at a time
3. Add tests for each refactored component
4. Roll out state machine refinements
5. Implement the plugin system
6. Update documentation

## 10. Maintenance Considerations

The new architecture will be more maintainable due to:

- Centralized state management
- Clear separation of concerns
- Comprehensive testing
- Well-documented codebase
- Extensible plugin system

## Appendix A: State Structure

```javascript
{
  // Array of task objects
  tasks: [
    {
      id: 1,
      title: "Task Title",
      description: "Task description",
      status: "pending", // One of: pending, in-progress, done, deferred
      priority: "medium", // One of: high, medium, low
      dependencies: [2, 3], // Array of task IDs
      subtasks: [
        {
          id: 1,
          title: "Subtask Title",
          description: "Subtask description",
          status: "pending"
        }
      ],
      details: "Implementation details",
      testStrategy: "Test approach"
    }
  ],
  
  // Currently selected task (if any)
  currentTask: null,
  
  // Loading state
  loading: false,
  
  // Error state
  error: null,
  
  // Timestamp of last update
  lastUpdated: "2025-04-09T12:34:56.789Z",
  
  // State history for undo/redo
  history: [/* previous states */]
}
```

## Appendix B: Directory Structure

```
task-master/
├── src/
│   ├── actions.js           # Action creators
│   ├── bulk-operations.js   # Bulk state operations
│   ├── cli.js               # CLI entry point
│   ├── commands/            # CLI commands
│   │   ├── index.js         # Command loader
│   │   ├── list.js          # List command
│   │   ├── set-status.js    # Set status command
│   │   └── ...              # Other commands
│   ├── observers.js         # State observers
│   ├── plugin-system.js     # Plugin system
│   ├── state-store.js       # State store
│   ├── task-state-machine.js # State machine
│   ├── utils.js             # Utility functions
│   └── validators.js        # Validation functions
├── tests/                   # Tests
│   ├── setup.js             # Test setup
│   ├── state-store.test.js  # State store tests
│   ├── actions.test.js      # Action tests
│   └── integration/         # Integration tests
├── plugins/                 # Plugins directory
├── docs/                    # Documentation
├── tasks/                   # Generated task files
├── tasks.json               # Task data
└── package.json             # Package metadata
```
