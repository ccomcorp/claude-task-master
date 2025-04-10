# Current State Management Analysis

## Overview
This document identifies all places in the Task Master codebase where task state is managed through direct file operations on tasks.json.

## Files to Examine
- scripts/modules/task-manager.js (Core task management functions)
- scripts/modules/commands.js (CLI command definitions)
- scripts/modules/ui.js (UI helpers)
- scripts/modules/dependency-manager.js (Task dependency management)

## Direct File Access Patterns to Replace

### Common File Operations
Most file operations are done through utility functions in utils.js:
- `readJSON(filepath)`: Reads and parses a JSON file
- `writeJSON(filepath, data)`: Serializes and writes data to a JSON file

### State Operations by Module

#### task-manager.js
Multiple functions directly read from and write to tasks.json:
- `parsePRD`: Writes parsed tasks to tasks.json
- `updateTasks`: Reads tasks.json, updates task data, writes back to tasks.json
- `generateTaskFiles`: Reads tasks.json to generate individual task files
- `setTaskStatus`: Reads tasks.json, updates task status, writes back to tasks.json
- `listTasks`: Reads tasks.json to display task information
- `expandTask`: Reads tasks.json, expands a task, writes back to tasks.json
- `expandAllTasks`: Reads tasks.json, expands all tasks, writes back to tasks.json
- `clearSubtasks`: Reads tasks.json, clears subtasks, writes back to tasks.json
- `addTask`: Reads tasks.json, adds a new task, writes back to tasks.json
- `analyzeTaskComplexity`: Reads tasks.json for task analysis
- `addSubtask`: Reads tasks.json, adds a subtask, writes back to tasks.json
- `removeSubtask`: Reads tasks.json, removes a subtask, writes back to tasks.json

#### dependency-manager.js
Functions handling task dependencies:
- `addDependency`: Reads tasks.json, adds dependency, writes back to tasks.json
- `removeDependency`: Reads tasks.json, removes dependency, writes back to tasks.json
- `validateDependenciesCommand`: Reads tasks.json to validate dependencies
- `fixDependenciesCommand`: Reads tasks.json, fixes dependencies, writes back to tasks.json
- `validateAndFixDependencies`: Writes updated dependency data back to tasks.json

#### ui.js
UI helper functions that read task data:
- `displayNextTask`: Reads tasks.json to display the next task
- `displayTaskById`: Reads tasks.json to display a specific task
- `displayComplexityReport`: Reads complexity report JSON file

#### commands.js
Command handlers:
- `registerCommands`: Reads tasks.json in some command implementations

## Task Data Structure
The tasks.json file contains:
- `meta`: Project metadata including name, version, source, description, and task counts
- `tasks`: Array of task objects with properties:
  - `id`: Unique task identifier
  - `title`: Task title
  - `description`: Brief task description
  - `status`: Task status (e.g., "pending", "in-progress", "done")
  - `dependencies`: Array of task IDs that this task depends on
  - `priority`: Task priority level
  - `details`: Detailed task description
  - `testStrategy`: Testing approach for the task
  - `subtasks`: Array of subtask objects with similar structure to tasks

## State Management Refactoring Approach
1. Implement a central state store that maintains task data in memory
2. Create action creators for all task operations that currently involve file I/O
3. Implement a task state machine to enforce valid status transitions
4. Add state observers to persist changes to disk and handle UI updates
5. Refactor all modules to use the new state store and actions instead of direct file operations
6. Ensure backward compatibility by maintaining the same file format and command behavior
