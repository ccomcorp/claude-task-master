#!/usr/bin/env python3
"""
Script to update the project brief in the memory bank with Task Master state management PRD details.
"""

from memory_bank.core import MemoryBankManager
from memory_bank.sections import update_section, log_change

def main():
    """Update the project brief with comprehensive PRD information"""
    print("Updating project brief with Task Master State Management PRD details...")
    
    # Initialize memory bank manager
    memory = MemoryBankManager()
    
    # Project brief content
    project_brief = """
# Task Master State Management Conversion

## Overview
Task Master's current implementation manages tasks by directly reading from and writing to a JSON file (`tasks.json`) for every operation. Core modules like `task-manager.js` handle task CRUD by accessing this file system state, and CLI commands (defined in `commands.js`) invoke those file-based functions. Even user interface helpers in `ui.js` read the tasks file on the fly to display information. This file-centric approach simplifies persistence but scatters state logic across the codebase, making it harder to maintain, test, and extend.

This project aims to refactor Task Master's state handling into a **centralized state management architecture**. The goal is to introduce a single source of truth in memory for all task data (mirroring the contents of `tasks.json`), with formal APIs for state access and mutation. We will migrate the CLI tool to use this state store instead of performing raw file I/O in each command. The existing CLI usage and task file format will remain **backward compatible** – users will notice no changes in commands or outputs.

By isolating state management, we aim to improve reliability (fewer file race conditions or corruption risks), make the code more modular and testable, and lay groundwork for future enhancements.

## Goals

- **Centralize Task State** – Implement a robust in-memory state store for all tasks, replacing ad-hoc file reads/writes. All modules will source and update task data through this single state object.
- **Maintain Backward Compatibility** – Preserve the existing CLI interface (command names, options, and behavior) and the `tasks.json` file format. Users' current commands (e.g. `task-master list`, `add-task`, etc.) and workflows will continue to work exactly as before. For example, the `-f/--file` option to specify an alternate tasks file will still be supported.
- **Improve Maintainability & Testability** – Refactor code to separate state logic from presentation and I/O. This modular design will make it easier to unit test state transitions in isolation (no need to stub the file system on every test) and to reason about the app's behavior.
- **Enhance Reliability of State Transitions** – Introduce structured state transition management (e.g. a state machine for task statuses) to prevent invalid state changes and ensure data integrity. By controlling how tasks move between statuses (pending, in-progress, done, etc.), the system can avoid logical errors.
- **State Persistence and Recovery** – Continue to persist all task data to disk (still using `tasks.json` under the hood) but in a controlled manner. Implement safeguards like debounced writes and file locking to avoid race conditions or corruption, and consider automatic backups for recovery.
- **Foundation for Future Features** – Although no new CLI features are added in this refactor, the new architecture will be designed to be extensible so that additional features (undo/redo, real-time collaboration, etc.) can be added without major changes.

## Scope

**In-Scope:** The project focuses exclusively on the internal re-architecture of state management without altering external behavior. It includes: 

- **State Store Module:** Creating a centralized state store (e.g. `state-store.js`) for holding all task data in memory and exposing methods for state access and mutation.
- **Action Creators:** Implementing a set of functions in a new module (e.g. `actions.js`) that encapsulate all allowed state mutations (adding tasks, updating status, etc.) instead of scattered file operations.
- **CLI Refactoring:** Updating all CLI commands to use the centralized state store via the new actions rather than performing file I/O. The external interface remains identical.
- **State Observers & Persistence:** Implementing observers that react to state changes in order to persist state to disk (writing to `tasks.json`) and enforce consistency.
- **Task State Machine:** Defining a formal state machine for task statuses and transitions to enforce valid moves (e.g. pending → in-progress → done) and prevent invalid state transitions.
- **Testing:** Writing unit tests for the state store, actions, and state machine, as well as integration tests for CLI commands to ensure full backward compatibility.
- **Documentation Updates:** Revising internal documentation (developer docs, README updates) to reflect the new state management approach while leaving user-facing behavior unchanged.

**Out of Scope:** No new user features are added. The current command-line interface, file formats, and workflows remain unchanged. Only internal refactoring is performed.

## Implementation Strategy

### Phase 1: Create State Management Infrastructure
- Create a centralized state store `state-store.js` using Node's EventEmitter pattern
- Implement state structure for tasks, metadata, loading, error handling, and history
- Add methods for state access, modification, and querying
- Implement state persistence with debouncing and file locking mechanisms

### Phase 2: Define Actions & State Transitions
- Create an actions module encapsulating all state mutations
- Implement a state machine for task status transitions
- Define observer pattern for state change reactions

### Phase 3: Refactor CLI Commands
- Update all commands to use the state store and actions
- Retain identical CLI interface and behavior
- Test for backwards compatibility

### Phase 4: Testing & Documentation
- Write unit tests for state management
- Add integration tests for CLI commands
- Update internal documentation
"""
    
    # Update the project brief in memory
    update_section(memory, "projectInfo", project_brief, {
        "name": "Task Master State Management Conversion",
        "description": "Refactoring Task Master to use centralized state management instead of direct file operations"
    })
    
    # Update product context
    product_context = """
# Product Context

Task Master is a CLI-based task management system for AI-driven development with Claude. It allows developers to create, track, and manage tasks through a command-line interface. Key features include:

- Parsing PRDs to automatically generate tasks
- Breaking down tasks into subtasks
- Setting task status (todo, in-progress, review, done)
- Managing task dependencies
- Generating task files
- Analyzing task complexity

The current implementation relies heavily on direct file operations for state management, with each command reading from and writing to a JSON file (`tasks.json`). This approach works but has limitations in terms of maintainability, testability, and reliability.

The goal of this project is to refactor the state management approach without changing the external behavior of the application. Users should notice no difference in how they interact with the CLI, but the internal architecture will be significantly improved.

## Current Limitations

- State logic is scattered across the codebase
- Direct file I/O in multiple places creates risk of race conditions
- Testing requires stubbing the file system
- No formal state transition rules
- Limited error handling for file operations
- No built-in support for features like undo/redo

## User Experience

The refactoring should maintain the exact same user experience and command behaviors. All existing CLI commands, options, and outputs should remain unchanged. The tasks.json file format will also remain compatible, ensuring users can continue using existing task files.
"""
    update_section(memory, "productContext", product_context)
    
    # Update system patterns
    system_patterns = """
# System Patterns

## State Management Architecture

The refactored Task Master will implement a centralized state management architecture with the following components:

### 1. State Store

A singleton state store based on the EventEmitter pattern will serve as the single source of truth for the application state. It will:

- Hold the complete application state in memory
- Provide methods for state access and mutation
- Emit events when state changes
- Handle state persistence (loading from and saving to disk)

### 2. Action Creators

Action creators are functions that encapsulate specific state mutations. They will:

- Accept parameters needed for the action
- Validate inputs
- Update the state through the state store
- Return relevant results or updated data

### 3. State Machine

A state machine will formally define valid task statuses and allowed transitions between them. It will:

- Enforce valid status values (e.g., "pending", "in-progress", "done")
- Ensure only valid transitions occur (e.g., cannot go from "done" to "pending")
- Provide a clear API for status changes

### 4. Observers

Observers will react to state changes by subscribing to events emitted by the state store. They will:

- Persist state to disk when relevant changes occur
- Update UI elements based on state changes
- Log events for debugging or monitoring

### 5. Command Handlers

CLI command handlers will connect user input to the state management system by:

- Parsing command arguments and options
- Calling appropriate action creators
- Formatting and displaying results to the user

## Data Flow

1. User invokes a CLI command
2. Command handler parses arguments and calls appropriate action creator
3. Action creator validates inputs and calls state store methods
4. State store updates internal state and emits events
5. Observers react to events (e.g., saving to disk)
6. Command handler formats and displays results to user

## Error Handling

The refactored system will implement consistent error handling with:

- Validation at action creator level
- Clear error messages for invalid operations
- Recovery mechanisms for file I/O failures
"""
    update_section(memory, "systemPatterns", system_patterns)
    
    # Update tech context
    tech_context = """
# Technical Context

## Key Technologies

- **Node.js**: Runtime environment for the application
- **JavaScript (ES Modules)**: Primary programming language with ES module system
- **EventEmitter**: Node.js built-in event system for state change notifications
- **Commander.js**: Library for CLI command parsing and execution
- **fs/promises**: Node.js file system module for asynchronous file operations
- **JSON**: Data format for task storage

## File Structure

Key files in the original implementation:

- **scripts/dev.js**: Main entry point for CLI commands
- **scripts/modules/commands.js**: CLI command definitions and handlers
- **scripts/modules/task-manager.js**: Core task management functions 
- **scripts/modules/ui.js**: User interface helpers
- **scripts/modules/dependency-manager.js**: Task dependency management
- **scripts/modules/ai-services.js**: AI integration services

New files to be created:

- **scripts/modules/state-store.js**: Centralized state management store
- **scripts/modules/actions.js**: Action creators for state mutations
- **scripts/modules/state-machine.js**: Task state transition rules
- **scripts/modules/observers.js**: State change observers

## Current Implementation

The current implementation reads from and writes to the task.json file directly from various functions. Each operation typically:

1. Reads the entire tasks.json file
2. Performs the required modification
3. Writes the entire file back to disk

This approach is simple but has several limitations:

- Multiple file reads/writes for related operations
- No central state representation
- Potential for race conditions or file corruption
- Difficult to test without mocking the file system
- Scattered state logic across modules

## Refactored Implementation

The refactored implementation will:

1. Load tasks.json into memory on startup
2. Provide a centralized API for state access and mutation
3. Use action creators to encapsulate state logic
4. Persist state changes to disk in a controlled manner
5. Implement proper error handling and recovery

## Compatibility Considerations

- Maintain backward compatibility with existing tasks.json format
- Support the -f/--file option for specifying custom task file paths
- Preserve all current CLI command behaviors and outputs
- Ensure integration with existing AI features works seamlessly
"""
    update_section(memory, "technologies", tech_context)
    
    # Update standards
    standards = """
# Standards

## Coding Standards

1. **Modularity**: Maintain clear separation of concerns between state management, CLI commands, and UI.
2. **Single Responsibility**: Each module should have a well-defined responsibility.
3. **Immutability**: State updates should create new state objects rather than mutating existing state.
4. **Event-Driven**: Use events for communication between components when appropriate.
5. **Error Handling**: Implement comprehensive error handling at all levels.

## State Management Standards

1. **Single Source of Truth**: All state should be managed through the state store.
2. **Controlled Mutations**: State changes should only occur through defined actions.
3. **Validation**: Validate inputs before state changes occur.
4. **Persistence**: State should be persisted to disk in a controlled manner.
5. **Recovery**: Implement backup and recovery mechanisms for critical state changes.

## State Transition Rules

1. Task status transitions should follow the defined state machine.
2. Dependencies must be validated when changing task status.
3. Tasks with unmet dependencies cannot be marked as "in-progress" or "done".
4. When a dependency's status changes, dependent tasks must be re-evaluated.

## Testing Standards

1. Unit tests should cover all state management components.
2. Integration tests should verify CLI commands work correctly with the new state management.
3. Tests should run without requiring the file system (use in-memory state).
4. Mock AI services for testing AI-dependent functions.

## Documentation Standards

1. All new modules should have clear JSDoc documentation.
2. The README should be updated to reflect the architectural changes.
3. Code examples should be provided for key components.
4. Internal architecture documentation should be comprehensive.
"""
    update_section(memory, "standards", standards)
    
    # Set active context
    update_section(memory, "tasks", "", {
        "activeContext": """
This project involves refactoring Task Master's state management from direct file operations to a centralized state store. We will start by:

1. Analyzing the current code structure to understand how state is managed
2. Creating a centralized state store using EventEmitter
3. Implementing action creators for state mutations
4. Refactoring CLI commands to use the new state management
5. Adding observers for state persistence
6. Implementing a state machine for task transitions
7. Writing tests for the new architecture
8. Updating documentation

The first focus is on understanding the current implementation and creating the core state store infrastructure.
"""
    })
    
    # Log the change
    log_change(memory, "Updated project brief with Task Master state management PRD details", {
        "sections_updated": ["projectInfo", "productContext", "systemPatterns", "technologies", "standards", "tasks"]
    })
    
    print("Project brief and related sections have been updated in the memory bank.")
    print("Check memory-bank/projectbrief.md and other files to verify the changes.")

if __name__ == "__main__":
    main()
