# Task Master State Management System

## Overview

The Task Master CLI has been refactored to use a centralized state management system. This document describes the architecture, components, and how they interact with each other.

## Architecture

The state management system follows a unidirectional data flow architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Actions   │────▶│  State Store │────▶│  Observers  │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                   │                   │
       │                   │                   │
       └───────────────────┴───────────────────┘
```

1. **State Store**: Central repository for all application state (tasks, metadata)
2. **Actions**: Functions that modify the state in a controlled way
3. **Observers**: React to state changes and perform side effects (persistence, logging)
4. **Commands**: CLI commands that use actions to modify state

## Components

### State Store (`state-store.js`)

The state store is responsible for:

- Holding the current application state in memory
- Providing methods to access and modify state
- Emitting events when state changes
- Loading and persisting state to disk
- Enforcing validation rules (e.g., task status transitions)

The state store is implemented as a singleton that extends Node.js `EventEmitter` to allow subscribing to state changes.

#### State Structure

```javascript
{
  meta: {
    projectName: string,
    version: string,
    description: string,
    totalTasksGenerated: number,
    tasksIncluded: number
  },
  tasks: [
    {
      id: number,
      title: string,
      description: string,
      status: string,
      priority: string,
      dependencies: number[],
      subtasks: object[],
      ...
    }
  ],
  currentTask: object | null,
  loading: boolean,
  error: string | null,
  lastUpdated: string
}
```

#### Key Methods

- `getState()`: Get the complete current state
- `getTasks()`: Get all tasks
- `getTaskById(id)`: Get a specific task by ID
- `setState(partialState, options)`: Update state
- `updateTask(id, updates, options)`: Update a task
- `setTaskStatus(id, status, options)`: Change a task's status
- `loadState(filePath)`: Load state from disk
- `persistState(filePath)`: Save state to disk

### Actions (`actions.js`)

Actions encapsulate all operations that modify the state. They:

- Provide a public API for all state mutations
- Validate input data before modifying state
- Handle errors and provide meaningful error messages
- Manage side effects like file I/O outside the state store

#### Key Actions

- `loadTasks(filePath)`: Load tasks from a file
- `saveTasks(filePath)`: Save tasks to a file
- `addTask(taskData, options)`: Add a new task
- `updateTask(id, updates, options)`: Update an existing task
- `setTaskStatus(id, status, options)`: Change a task's status
- `addDependency(taskId, dependencyId, options)`: Add a dependency between tasks
- `expandTask(taskId, options)`: Expand a task into subtasks

### Observers (`observers.js`)

Observers subscribe to state changes and react to them. They:

- Listen for events emitted by the state store
- Perform side effects like persisting state to disk
- Log important state changes
- Validate state integrity (e.g., dependency cycle detection)

#### Types of Observers

- `persistenceObserver`: Saves state to disk when it changes
- `loggingObserver`: Logs important state changes
- `dependencyObserver`: Validates task dependencies
- `statusTransitionObserver`: Enforces valid status transitions

### Task Status State Machine

Task statuses follow a formal state machine that defines valid transitions:

```
┌────────────┐     ┌──────────────┐     ┌─────────┐     ┌──────┐
│   PENDING  │────▶│  IN_PROGRESS │────▶│  REVIEW │────▶│ DONE │
└────────────┘     └──────────────┘     └─────────┘     └──────┘
       ▲  │               ▲ │                ▲ │            │
       │  │               │ │                │ │            │
       │  ▼               │ ▼                │ ▼            ▼
       │         ┌───────────────┐           │
       └─────────│    DEFERRED   │◀──────────┘◀────────────┘
                 └───────────────┘
```

Valid transitions are defined in the `STATUS_TRANSITIONS` constant in `state-store.js`.

## Usage Examples

### Loading and Accessing State

```javascript
import stateStore from './state-store.js';
import * as actions from './actions.js';

// Load tasks
await actions.loadTasks('tasks/tasks.json');

// Get all tasks
const tasks = stateStore.getTasks();

// Get a specific task
const task = stateStore.getTaskById(123);
```

### Modifying State

```javascript
import * as actions from './actions.js';

// Add a new task
const task = actions.addTask({
  title: 'New Task',
  description: 'Task description',
  priority: 'medium'
});

// Update a task
const updatedTask = actions.updateTask(task.id, {
  title: 'Updated Title',
  priority: 'high'
});

// Change task status
const completedTask = actions.setTaskStatus(task.id, 'done');
```

### Creating Custom Observers

```javascript
import stateStore from './state-store.js';
import { initializeCustomObserver } from './observers.js';

// Create a custom observer
const cleanup = initializeCustomObserver('myObserver', {
  // Called when state changes
  stateChanged: (state) => {
    console.log('State changed:', state.lastUpdated);
  },
  
  // Called when a task status changes
  taskStatusChanged: (task, oldStatus, newStatus) => {
    console.log(`Task ${task.id} status changed from ${oldStatus} to ${newStatus}`);
  }
});

// Remove the observer when no longer needed
cleanup();
```

## Error Handling and Recovery

The state management system includes several safety features:

1. **File Locking**: Prevents concurrent access to state files
2. **Atomic Writes**: Uses temporary files and renaming to prevent corruption
3. **Automatic Backups**: Creates backups before writing changes
4. **Debounced Persistence**: Throttles disk writes to prevent excessive I/O
5. **Validation**: Enforces data integrity through validation

## Best Practices

1. **Always use actions** to modify state, not direct state store methods
2. **Handle errors** from actions appropriately
3. **Use observers** for side effects, not in command handlers
4. **Validate transitions** before changing task status
5. **Persist state** after significant changes
6. **Use the task state machine** to ensure valid status changes

## Future Enhancements

The state management system is designed to support future features:

1. **Undo/Redo**: State snapshots could enable time-travel
2. **Real-time Collaboration**: Event-based architecture facilitates synchronization
3. **Advanced Filtering**: Centralized state enables complex querying
4. **Performance Optimization**: Batch updates and selective persistence
