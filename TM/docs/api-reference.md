# Task Master API Reference

This document provides a reference for developers who want to use Task Master programmatically or extend its functionality.

## State Store API

The state store is the central repository for all task data. It provides methods for accessing and mutating the state.

### Importing the State Store

```javascript
import stateStore, { STATE_EVENTS, TASK_STATUSES } from './scripts/modules/state-store.js';
```

### State Events

The state store emits events when the state changes:

- `STATE_EVENTS.INITIALIZED`: Emitted when the state store is initialized
- `STATE_EVENTS.STATE_CHANGED`: Emitted when the state changes
- `STATE_EVENTS.STATE_LOADED`: Emitted when the state is loaded from disk
- `STATE_EVENTS.STATE_PERSISTED`: Emitted when the state is persisted to disk
- `STATE_EVENTS.ERROR`: Emitted when an error occurs

### Task Statuses

The state store defines the following task statuses:

- `TASK_STATUSES.PENDING`: Task is not yet started
- `TASK_STATUSES.IN_PROGRESS`: Task is actively being worked on
- `TASK_STATUSES.REVIEW`: Task is completed but needs review
- `TASK_STATUSES.DONE`: Task is completed and verified
- `TASK_STATUSES.DEFERRED`: Task is postponed or on hold

### State Store Methods

#### `initialize(options)`

Initialize the state store.

```javascript
await stateStore.initialize({
  filePath: 'path/to/tasks.json', // Optional: custom file path
  forceReset: false               // Optional: reset state to defaults
});
```

#### `getState()`

Get a copy of the current state.

```javascript
const state = stateStore.getState();
console.log(`Project has ${state.tasks.length} tasks`);
```

#### `setState(partialState, options)`

Update the state with a partial state object.

```javascript
stateStore.setState({
  tasks: [...state.tasks, newTask]
}, {
  silent: false,  // Optional: don't emit change events
  persist: true   // Optional: persist state to disk
});
```

#### `loadState(filePath)`

Load state from disk.

```javascript
const state = await stateStore.loadState('path/to/tasks.json');
```

#### `persistState(filePath)`

Save state to disk.

```javascript
await stateStore.persistState('path/to/tasks.json');
```

#### `getTaskById(id)`

Get a task by ID.

```javascript
const task = stateStore.getTaskById(1);
if (task) {
  console.log(`Found task: ${task.title}`);
}
```

#### `getTasksByStatus(status)`

Get tasks filtered by status.

```javascript
const pendingTasks = stateStore.getTasksByStatus(TASK_STATUSES.PENDING);
console.log(`Found ${pendingTasks.length} pending tasks`);
```

#### `getReadyTasks()`

Get tasks that have no dependencies or all dependencies are done.

```javascript
const readyTasks = stateStore.getReadyTasks();
console.log(`Found ${readyTasks.length} tasks ready to work on`);
```

#### `updateTask(id, updates, options)`

Update a task by ID.

```javascript
const updatedTask = stateStore.updateTask(1, {
  title: 'Updated Title',
  description: 'Updated description'
});
```

#### `addTask(taskData, options)`

Add a new task.

```javascript
const newTask = stateStore.addTask({
  title: 'New Task',
  description: 'Task description',
  status: TASK_STATUSES.PENDING,
  dependencies: [1, 2]
});
```

#### `removeTask(id, options)`

Remove a task by ID.

```javascript
const removed = stateStore.removeTask(1);
if (removed) {
  console.log('Task removed successfully');
}
```

## Task State Machine API

The task state machine defines valid statuses and transitions for tasks.

### Importing the Task State Machine

```javascript
import taskStateMachine, {
  TASK_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  transition
} from './scripts/modules/task-state-machine.js';
```

### Task State Machine Methods

#### `canTransition(fromStatus, toStatus)`

Check if a status transition is valid.

```javascript
const isValid = taskStateMachine.canTransition(
  TASK_STATUSES.PENDING,
  TASK_STATUSES.IN_PROGRESS
);
```

#### `transition(task, newStatus)`

Perform a status transition on a task.

```javascript
try {
  const updatedTask = taskStateMachine.transition(task, TASK_STATUSES.IN_PROGRESS);
  console.log(`Task status updated to ${updatedTask.status}`);
} catch (error) {
  console.error(`Invalid transition: ${error.message}`);
}
```

#### `getValidNextStatuses(currentStatus)`

Get valid next statuses for a given status.

```javascript
const nextStatuses = taskStateMachine.getValidNextStatuses(TASK_STATUSES.PENDING);
console.log(`Valid next statuses: ${nextStatuses.join(', ')}`);
```

#### `isValidStatus(status)`

Check if a status is valid.

```javascript
if (taskStateMachine.isValidStatus(status)) {
  console.log(`${status} is a valid status`);
}
```

## Action Creators API

Action creators are functions that encapsulate state mutations.

### Importing Action Creators

```javascript
import * as actions from './scripts/modules/actions.js';
```

### Task Management Actions

#### `loadTasks(filePath)`

Load tasks from file.

```javascript
const state = await actions.loadTasks('path/to/tasks.json');
```

#### `saveTasks(filePath)`

Save tasks to file.

```javascript
await actions.saveTasks('path/to/tasks.json');
```

#### `addTask(taskData)`

Add a new task.

```javascript
const newTask = await actions.addTask({
  title: 'New Task',
  description: 'Task description'
});
```

#### `updateTask(id, updates)`

Update a task.

```javascript
const updatedTask = await actions.updateTask(1, {
  title: 'Updated Title',
  description: 'Updated description'
});
```

#### `removeTask(id)`

Remove a task.

```javascript
await actions.removeTask(1);
```

#### `setTaskStatus(id, status)`

Set a task's status.

```javascript
await actions.setTaskStatus(1, TASK_STATUSES.IN_PROGRESS);
```

### Dependency Management Actions

#### `addDependency(taskId, dependencyId)`

Add a dependency to a task.

```javascript
await actions.addDependency(2, 1); // Task 2 depends on Task 1
```

#### `removeDependency(taskId, dependencyId)`

Remove a dependency from a task.

```javascript
await actions.removeDependency(2, 1);
```

#### `validateDependencies()`

Validate all task dependencies.

```javascript
const result = await actions.validateDependencies();
if (!result.valid) {
  console.error('Dependency validation failed:', result.errors);
}
```

### AI-Related Actions

#### `parsePRD(filePath, options)`

Parse a PRD file and generate tasks.

```javascript
const tasks = await actions.parsePRD('path/to/prd.txt', {
  numTasks: 10,
  useResearch: true
});
```

#### `expandTask(taskId, options)`

Generate subtasks for a task.

```javascript
const subtasks = await actions.expandTask(1, {
  numSubtasks: 5,
  useResearch: true,
  context: 'Additional context for subtask generation'
});
```

#### `analyzeTaskComplexity(taskId, options)`

Analyze the complexity of a task.

```javascript
const complexity = await actions.analyzeTaskComplexity(1, {
  useResearch: true
});
```

## Observer API

Observers react to state changes by subscribing to events emitted by the state store.

### Importing Observers

```javascript
import {
  initializePersistenceObserver,
  initializeLoggingObserver,
  initializeDependencyObserver,
  initializeStatusTransitionObserver,
  initializeCustomObserver
} from './scripts/modules/observers.js';
```

### Observer Initialization

#### `initializePersistenceObserver(options)`

Initialize the persistence observer.

```javascript
initializePersistenceObserver({
  debounceTime: 500, // Debounce time in ms
  enabled: true      // Whether observer is enabled
});
```

#### `initializeLoggingObserver(options)`

Initialize the logging observer.

```javascript
initializeLoggingObserver({
  logLevel: 'info',  // Log level
  enabled: true      // Whether observer is enabled
});
```

#### `initializeDependencyObserver(options)`

Initialize the dependency observer.

```javascript
initializeDependencyObserver({
  validateOnChange: true, // Validate dependencies on task status change
  enabled: true           // Whether observer is enabled
});
```

#### `initializeStatusTransitionObserver(options)`

Initialize the status transition observer.

```javascript
initializeStatusTransitionObserver({
  enabled: true // Whether observer is enabled
});
```

#### `initializeCustomObserver(name, handlers, options)`

Initialize a custom observer.

```javascript
initializeCustomObserver('my-observer', {
  [STATE_EVENTS.STATE_CHANGED]: (state) => {
    console.log('State changed:', state);
  }
}, {
  enabled: true // Whether observer is enabled
});
```

## Extending Task Master

### Adding a New Command

1. Create a new command handler in `commands.js`:

```javascript
program
  .command('my-command')
  .description('Description of my command')
  .option('--option <value>', 'Description of option')
  .action(async (options) => {
    try {
      // Initialize state store if needed
      await stateStore.initialize();
      
      // Call action creators to perform operations
      const result = await actions.myCustomAction(options);
      
      // Display results to the user
      console.log('Command completed successfully:', result);
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
      process.exit(1);
    }
  });
```

2. Implement the necessary actions in `actions.js`:

```javascript
export async function myCustomAction(options) {
  // Get current state
  const state = stateStore.getState();
  
  // Perform operations
  const result = doSomethingWithState(state, options);
  
  // Update state if needed
  stateStore.setState({
    // State updates
  });
  
  return result;
}
```

### Adding a New Observer

1. Define the observer function in `observers.js`:

```javascript
export function initializeMyCustomObserver(options = {}) {
  const {
    enabled = true // Whether observer is enabled
  } = options;
  
  if (!enabled) {
    log('My custom observer disabled', 'info');
    return;
  }
  
  // Subscribe to state events
  stateStore.on(STATE_EVENTS.STATE_CHANGED, (state) => {
    // React to state changes
    handleStateChange(state);
  });
  
  log('My custom observer initialized', 'debug');
}
```

2. Register the observer in `initializeAllObservers()`:

```javascript
export function initializeAllObservers() {
  // Initialize existing observers
  initializePersistenceObserver();
  initializeLoggingObserver();
  initializeDependencyObserver();
  initializeStatusTransitionObserver();
  
  // Initialize your custom observer
  initializeMyCustomObserver();
  
  log('All observers initialized', 'info');
}
```

### Adding a New Task Status

1. Update the `TASK_STATUSES` object in `task-state-machine.js`:

```javascript
export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  REVIEW: 'review',
  DONE: 'done',
  DEFERRED: 'deferred',
  MY_NEW_STATUS: 'my-new-status' // Add your new status
};
```

2. Update the `STATUS_TRANSITIONS` object to define valid transitions:

```javascript
export const STATUS_TRANSITIONS = {
  // Existing transitions...
  
  // Define transitions for your new status
  [TASK_STATUSES.MY_NEW_STATUS]: [
    TASK_STATUSES.PENDING,
    TASK_STATUSES.IN_PROGRESS
  ],
  
  // Update existing transitions to include your new status
  [TASK_STATUSES.PENDING]: [
    TASK_STATUSES.IN_PROGRESS,
    TASK_STATUSES.DONE,
    TASK_STATUSES.DEFERRED,
    TASK_STATUSES.MY_NEW_STATUS // Allow transition to your new status
  ]
};
```
