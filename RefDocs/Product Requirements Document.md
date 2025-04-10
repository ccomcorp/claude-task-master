Product Requirements Document
Task Master State Management Conversion
1. Overview
Task Master’s current implementation manages tasks by directly reading from and writing to a JSON file (tasks.json) for every operation​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Core modules like task-manager.js handle task CRUD by accessing this file system state, and CLI commands (defined in commands.js) invoke those file-based functions​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Even user interface helpers in ui.js read the tasks file on the fly to display information​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. This file-centric approach simplifies persistence but scatters state logic across the codebase, making it harder to maintain, test, and extend. This document outlines the requirements to refactor Task Master’s state handling into a centralized state management architecture. The goal is to introduce a single source of truth in memory for all task data (mirroring the contents of tasks.json), with formal APIs for state access and mutation. We will migrate the CLI tool to use this state store instead of performing raw file I/O in each command. The existing CLI usage and task file format will remain backward compatible – users will notice no changes in commands or outputs. By isolating state management, we aim to improve reliability (fewer file race conditions or corruption risks), make the code more modular and testable, and lay groundwork for future enhancements.
2. Goals
Centralize Task State – Implement a robust in-memory state store for all tasks, replacing ad-hoc file reads/writes​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. All modules will source and update task data through this single state object.
Maintain Backward Compatibility – Preserve the existing CLI interface (command names, options, and behavior) and the tasks.json file format. Users’ current commands (e.g. task-master list, add-task, etc.) and workflows will continue to work exactly as before, with results and outputs unchanged. For example, the -f/--file option to specify an alternate tasks file will still be supported​
FILE-MOXEXMU8MCHWXMTXQLDWSE
.
Improve Maintainability & Testability – Refactor code to separate state logic from presentation and I/O. This modular design will make it easier to unit test state transitions in isolation (no need to stub the file system on every test​
FILE-MOXEXMU8MCHWXMTXQLDWSE
) and to reason about the app’s behavior.
Enhance Reliability of State Transitions – Introduce structured state transition management (e.g. a state machine for task statuses) to prevent invalid state changes and ensure data integrity. By controlling how tasks move between statuses (pending, in-progress, done, etc.), the system can avoid logical errors (e.g. marking a task “done” when prerequisites aren’t met).
State Persistence and Recovery – Continue to persist all task data to disk (still using tasks.json under the hood) but in a controlled manner. Implement safeguards like debounced writes and file locking to avoid race conditions or corruption, and consider automatic backups for recovery.
Foundation for Future Features – While no new user features are added in this migration, the new architecture should be extensible. For instance, it should be straightforward to add capabilities like undo/redo of task changes or real-time collaboration features in the future, without major refactoring. These are not in scope now but inform the design (e.g. keeping a history of state changes).
3. Scope
In-Scope: This project focuses exclusively on the internal re-architecture of state management without altering external behavior. The following tasks are included:
State Store Module: Creating a centralized state store (e.g. state-store.js) responsible for holding all task data and exposing methods to get/update state.
Action Creators: Implementing a set of functions (in a new module, e.g. actions.js) that define all allowed state mutations (adding tasks, updating status, etc.), instead of scattered file operations.
CLI Refactoring: Updating all CLI commands (defined in scripts/modules/commands.js and related) to use the state store via these actions. The commands will no longer manually read or write tasks.json; they will invoke state APIs and then format output for the user.
State Observers & Persistence: Introducing an event-driven mechanism to respond to state changes – chiefly to save the state to disk. The state store will handle loading from tasks.json on startup and saving back on changes, invisibly to the CLI commands.
Task State Machine: Defining a formal state machine for task statuses and transitions (as an internal utility module). This will codify valid status values (e.g. "pending", "in-progress", "done", "deferred") and enforce rules on transitions between them.
Testing: Writing new tests for the state management system. This includes unit tests for the state store and actions (ensuring functions correctly modify the state in memory), and integration tests to verify CLI commands produce the same results as before using the new architecture.
Documentation Updates: Updating internal documentation (e.g. the README or developer docs) to describe the new architecture. The user-facing README commands and usage remain the same (since functionality is unchanged), but any references to how state is managed or where to look for task data in the code should be revised.
Out of Scope: No new CLI commands or user features will be introduced in this refactor. The focus is not on adding functionality but improving internals. Features like collaborative multi-user support, GUI integration, or advanced undo/redo interfaces are not part of this effort (though the refactor will make them easier to add later). The current tasks.json format and directory structure (including generation of individual task files) will remain as-is, except for potential minor metadata additions (e.g. last updated timestamp) needed for state management. Any performance optimizations or unrelated code cleanup will be deferred unless directly tied to state management.
4. Detailed Implementation Strategy
4.1. Phase 1: Create State Management Infrastructure
4.1.1. State Store Implementation
Create a centralized state store to hold all task data in memory, with an API to access and modify this state. This will be implemented as a new module, e.g. scripts/modules/state-store.js. We will use Node’s EventEmitter pattern to allow other parts of the app to subscribe to state changes. Technical Requirements:
Define a TaskState class (exported as a singleton instance, e.g. taskStore) that extends EventEmitter. On initialization, it should load the initial state from disk (from tasks.json by default).
Represent the state as a single JavaScript object. Include at minimum:
tasks: an array of task objects (each task contains fields like id, title, description, status, dependencies, priority, subtasks, etc., similar to the structure in the JSON file​
FILE-MOXEXMU8MCHWXMTXQLDWSE
). This should encompass everything currently stored in tasks.json (including any nested subtasks​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 and the meta info).
meta: an object for any metadata from the file (project name, version, source, etc. as in tasks.json​
FILE-MOXEXMU8MCHWXMTXQLDWSE
).
currentTask: a placeholder to track a “selected” task if needed (this can be null initially – future use for interactive mode or certain UI operations).
loading: a boolean flag indicating if an async operation is in progress (e.g. awaiting an AI response). This can help the UI layer show spinners, etc., and is updated by certain actions.
error: to store any error information if a state operation fails (could be used to communicate issues to the UI).
lastUpdated: timestamp of the last modification to state (to aid in debugging or synchronization).
(Optional) history: an array or stack of previous state snapshots for potential undo functionality. This will not be actively used now but can be recorded (with a cap on length) to enable future undo/redo features.
Provide methods on the state store for state access and updates:
getState(): Return a deep copy or safe reference to the current state object. This allows read-only access to the full state.
setState(partialState, options): Merge an object of updated fields into the current state and emit a change event. This should update lastUpdated on each call. If options.recordHistory is true (default), push the old state to history before applying changes (for undo support).
Convenience getters like getTaskById(id) and getSubtaskById(taskId, subtaskId), to quickly retrieve a specific task or subtask from the state. These help avoid manual array searches scattered in the code. For example, taskStore.getTaskById(5) returns the task object with id=5 (or undefined if not found). If subtasks have their own id fields, getSubtaskById should find a subtask by parent and subtask id.
Include helper query methods for common filtered views of state (these can be added as needed by the CLI commands):
getTasksByStatus(status): returns an array of all tasks whose status matches a given value (e.g. all “pending” tasks) – useful for implementing the list --status filter.
getPendingTasks(): returns all tasks marked "pending".
getNextTask(): returns the highest-priority task that is ready to work on (e.g. first pending task with no unfinished dependencies). This can use existing logic or new criteria, and will be useful for a next command.
getTasksWithCompletedDependencies(): returns tasks whose dependencies are all done – indicating they are unblocked. (This mirrors functionality currently spread across commands or utils.)
State Persistence: The state store must handle loading from and saving to the JSON file on disk, but abstract this from the rest of the app:
loadState(filePath?): Read the JSON file (defaulting to tasks/tasks.json or another configured path) and populate the state object. This should be called once at application start (or when the tasks file path changes). On success, emit an event (e.g. STATE_EVENTS.CHANGE or a specific STATE_EVENTS.LOADED). If the file does not exist or is empty, initialize with an empty tasks array (and possibly call saveState to create it).
saveState(filePath?): Write the current state back to the JSON file. This will typically be triggered automatically whenever state changes. Use a throttling or debouncing mechanism so that if many state changes occur in quick succession, we batch the file writes (to avoid unnecessary I/O). For example, if multiple actions run, delay writing for a few milliseconds and then write once after the last change.
Both load and save should be asynchronous (return Promises), since file I/O can be non-blocking. Use Node’s fs/promises API for simplicity.
Implement a rudimentary file-lock or mutex for saveState to prevent concurrent writes if somehow two operations try to save at the same time (in a single process CLI this is unlikely, but if events fire in quick succession it’s a safety net).
Before overwriting the file, consider writing a backup copy (e.g. tasks_backup.json) if the previous state was significantly large or if critical operations occur (so users can recover if something goes wrong). This could be done periodically or just keep one backup of the last state in case of corruption.
If the user specifies a different tasks file via command-line (-f option), the state store should load from that path instead and subsequently save to that path. The path could be stored in a config within the state store or passed to load/save functions. For instance, taskStore.loadState("myTasks.json") would set that as the active file for this session.
Define event constants (e.g. STATE_EVENTS) for events like CHANGE, TASK_ADDED, TASK_UPDATED, TASK_REMOVED, etc., and have the state store emit these on relevant setState calls. Other parts of the app (observers, UI) will subscribe to these events to react to changes (logging, auto-saving, etc.).
Example Implementation:
javascript
Copy
// state-store.js
import { EventEmitter } from 'events';
import fs from 'fs/promises';

export const STATE_EVENTS = {
  CHANGE: 'state:change',
  TASK_ADDED: 'state:task-added',
  TASK_UPDATED: 'state:task-updated',
  TASK_REMOVED: 'state:task-removed',
  ERROR: 'state:error'
};

class TaskState extends EventEmitter {
  constructor() {
    super();
    // Initial in-memory state
    this.state = {
      tasks: [],
      meta: {},
      currentTask: null,
      loading: false,
      error: null,
      lastUpdated: null
      // history can be added if needed
    };
    this.history = [];
    this.maxHistory = 50;
    this.tasksFilePath = 'tasks/tasks.json';  // default path
  }

  getState() {
    // Return a copy to avoid external mutation
    return JSON.parse(JSON.stringify(this.state));
  }

  getTaskById(id) {
    return this.state.tasks.find(task => task.id === id);
  }

  setState(partialState, options = {}) {
    const { recordHistory = true } = options;
    const prevState = JSON.parse(JSON.stringify(this.state));
    // Merge partial updates into state
    this.state = { 
      ...this.state, 
      ...partialState, 
      lastUpdated: new Date().toISOString() 
    };
    if (recordHistory) {
      this.history.push(prevState);
      if (this.history.length > this.maxHistory) {
        this.history.shift();  // maintain history size
      }
    }
    // Emit change events (and more specific events if appropriate)
    this.emit(STATE_EVENTS.CHANGE, this.state);
    if (partialState.tasks) {
      // If tasks array was updated, we can emit more granular events by comparing prev vs new state (not shown for brevity)
    }
  }

  async loadState(filePath) {
    const path = filePath || this.tasksFilePath;
    try {
      const data = await fs.readFile(path, 'utf8');
      const json = JSON.parse(data);
      this.state.tasks = json.tasks || [];
      this.state.meta = json.meta || {};
      this.emit(STATE_EVENTS.CHANGE, this.state);
      return this.getState();
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File not found, start with empty state
        this.state.tasks = [];
        this.state.meta = {};
        return this.getState();
      } else {
        this.emit(STATE_EVENTS.ERROR, err);
        throw err;
      }
    }
  }

  async saveState(filePath) {
    const path = filePath || this.tasksFilePath;
    try {
      const toSave = {
        meta: this.state.meta,
        tasks: this.state.tasks
      };
      await fs.writeFile(path, JSON.stringify(toSave, null, 2));
    } catch (err) {
      this.emit(STATE_EVENTS.ERROR, err);
      throw err;
    }
  }
}

// Export a singleton instance
export const taskStore = new TaskState();
4.1.2. Action Creators
Implement a set of action creator functions that encapsulate every type of state mutation in the system. These will serve as the only way to alter the Task Master state (instead of functions in task-manager.js doing file I/O). We will create a new module (e.g. scripts/modules/actions.js) to house these functions. Each action will use the state store’s API to read or update the state, and will perform any necessary business logic (validation, invoking AI services, etc.) previously in task-manager.js or related modules. Technical Requirements:
Create pure functions for each core operation on tasks and subtasks. The major actions include:
loadTasks(filePath): Initialize state from a given file path. This wraps taskStore.loadState and could also handle any post-load processing (like validating data or computing any derived fields).
addTask(promptData): Add a new task to the state. This might involve AI generation if we allow AI to create tasks from a description. For now, it can take either a fully formed task object or some input (like a prompt or title) and create a task entry. It should assign a new unique ID (e.g. one greater than the max existing ID) if not provided. The new task gets default fields (status “pending”, empty dependencies, etc.) and is appended to taskStore.state.tasks via taskStore.setState.
updateTask(id, updates): Update properties of an existing task. This finds the task by id and merges the provided updates (e.g. change title or description). It should validate that the task exists (throw an error if not) and that updates don’t violate any constraints (for example, if updating dependencies, ensure those dependency IDs exist in state).
removeTask(id): Remove a task entirely. This will delete the task from the tasks array (and potentially also remove any subtasks belonging to it, or handle reassigning if needed). Also, for consistency, it should remove references to this task in any other task’s dependencies (to avoid dangling IDs).
setTaskStatus(id, status): Change the status of a task. This is a critical action that should use the Task State Machine (see 4.1.4) to verify that the transition from the old status to the new status is allowed. It will find the task, use the state machine to get an updated task object with the new status (or throw an error if invalid transition), then update the tasks array in state with this modified task object. Example: if a task is “pending” and status is set to “done”, ensure this is permitted and perhaps ensure all subtasks or dependencies are done if required by business rules.
addSubtask(parentId, subtaskData): Add a new subtask under an existing task. This should find the parent task, generate a unique subtask ID (probably numeric starting at 1 for each task, or could use UUID), and push a new subtask object into the parent’s subtasks array. The subtask fields might mirror tasks (id, title, status, etc.). If subtaskData is minimal (like just a description or prompt), this function can also fill defaults similar to addTask. It should also mark the parent task as having subtasks (set a flag if needed). If the operation is meant to convert an existing task into a subtask (the current CLI has an option for add-subtask to convert an existing task), then this action should remove that task from the main list and insert it as a subtask under the new parent, adjusting IDs or references as needed.
updateSubtask(parentId, subtaskId, updates): Update fields of a specific subtask (similar to updateTask). Find the parent and then the subtask by id, apply changes. Possibly reuse some logic from updateTask.
removeSubtask(parentId, subtaskId): Remove a subtask from its parent task. If the CLI has an option to convert a subtask back into a standalone task (on removal with a --convert flag), this action should handle that: e.g., remove from parent’s list and push it into main tasks list with a new task ID. Otherwise, just drop it. Ensure that removing a subtask doesn’t leave inconsistent state (if any tasks depended on that subtask via a composite ID scheme, handle that, though likely dependencies only reference top-level tasks).
setSubtaskStatus(parentId, subtaskId, status): Similar to setTaskStatus, but for a subtask. It should also possibly trigger changes in the parent if all subtasks are done (e.g. a rule could be to auto-mark parent as done when all its subtasks are done – this could be done via an observer or here).
Dependency management actions:
addDependency(taskId, dependsOnId): Add a dependency relationship between two tasks. This means finding the task with id=taskId and adding dependsOnId to its dependencies array. It should validate that both the task and the dependency task exist, that dependsOnId is not already present, and that this addition would not introduce a circular dependency (if so, throw an error or call a fix routine). After updating state, it may be wise to run a dependency validation (similar to what the validateDependenciesCommand did) to ensure consistency​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
.
removeDependency(taskId, dependsOnId): Remove a dependency from a task. Essentially the inverse of addDependency – find the task and remove the given ID from its dependencies list. Again, ensure the task exists and that it actually had that dependency.
fixDependencies(): This could encapsulate the logic of the existing fix-dependencies command, scanning all tasks to remove or correct any invalid dependencies (e.g., references to tasks that don’t exist or self-dependencies). After running, it updates the state (and this would trigger a save).
validateDependencies(): A read-only check that goes through tasks and flags any issues (could return a report or throw if something egregious like a cycle is detected). This might be integrated into observers instead of a direct action, but we list it for completeness.
AI-related actions:
parsePRD(filePath, numTasks): Parse a PRD text file and generate tasks from it using AI (Claude). This wraps the existing flow in task-manager.parsePRD()​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Instead of writing directly to file, this action will call the AI (via callClaude or similar) to get the tasks data, then directly set taskStore.state.tasks to that new array (replacing any existing tasks or merging, depending on desired behavior – the current command overwrites the file with new tasks​
FILE-MOXEXMU8MCHWXMTXQLDWSE
, so we will do the same in state). After updating state, it should also preserve any meta info (e.g. origin file, total tasks) in state.meta. We must also continue to support the creation of individual task files for each task as the original parse-prd did. After state is set, this action can call the existing generateTaskFiles utility with the new state data. In the new architecture, generateTaskFiles can be refactored to accept the tasks array from state instead of reading the file from disk (or we can simply point it at the tasks file path, since we will have saved state by then). Ensuring this post-step maintains backward compatibility (creating the tasks/ directory with files) is important​
FILE-MOXEXMU8MCHWXMTXQLDWSE
.
expandTask(taskId, numSubtasks, useResearch, context): Generate subtasks for a specific task using AI. This corresponds to the expand command for a single task. The action will find the task, call the AI (via generateSubtasks or generateSubtasksWithPerplexity from ai-services.js) to get a list of subtasks, then insert those into the task’s subtasks list in state (or replace them if --force was specified). Mark the task’s status or other fields as needed (perhaps a task with subtasks might remain “pending” unless we introduce an “in-progress” status).
expandAllTasks(numSubtasks, useResearch, context, force): Expand subtasks for every top-level task that doesn’t have subtasks yet (or all tasks if force). Iteratively or in parallel, call expandTask for each applicable task. This can be done within the action, or simply the expand command handler can call actions.expandTask for each task in a loop. Given the CLI structure, implementing it in the action helps keep logic out of the CLI code.
updateTasks(fromId, prompt, useResearch): Update tasks based on new context (the update CLI command). This will likely call an AI to adjust tasks’ descriptions or add new tasks starting at a certain ID. For example, if task 5 was in progress and we got new requirements, this might regenerate tasks 5+ based on a prompt. The action should load current tasks, slice from fromId, send relevant info to AI (via an existing function perhaps callClaude with a different prompt), then merge the returned tasks into state from that ID onward (or replace them). It should be careful to maintain IDs and dependencies as appropriate (the current implementation likely overwrites tasks beyond a certain ID with new ones, adjusting count and IDs accordingly). After performing the update, save state.
Each action that modifies state will call taskStore.setState with the appropriate changes. By funneling all writes through setState, we ensure events are emitted and persistence happens consistently. For example, addTask() will do something like: taskStore.setState({ tasks: [...oldTasks, newTask] }) which triggers the save observer (to write tasks.json). We will remove direct calls to writeJSON from these flows – e.g., the original setTaskStatus function did readJSON and writeJSON​
FILE-MOXEXMU8MCHWXMTXQLDWSE
, but the new actions.setTaskStatus will simply update the in-memory object and rely on the state store to persist.
Validation and Error Handling: Actions should validate inputs and state before making changes. For instance, addTask should ensure required fields (like a title or description) are present (or at least not undefined), possibly by calling a validation helper (we could implement simple schema checks or use existing utility functions). setTaskStatus should use the state machine to validate the status transition. If any check fails, the action should throw an Error with a clear message. The CLI command handler can catch this and display it to the user as an error (without crashing). This central validation logic reduces the risk of invalid data making it into the tasks state.
Return Values: Each action can return a value (often the newly created or updated task, or some result) or a Promise thereof if asynchronous. For example, addTask returns the new task object (so the CLI can, for instance, log the new task’s ID), setTaskStatus returns the updated task, expandTask could return the list of subtasks generated, etc. This isn’t strictly necessary but can be useful for the CLI layer and for testing (to assert that the correct data was produced).
Make all actions async (returning Promises). Even those that are purely synchronous (like a quick status change) should be async for consistency, since some actions (parsePRD, expandTask) involve asynchronous operations. Marking all as async means the CLI handlers can await them uniformly. It also allows any future addition of asynchronous steps (like validations that require I/O) without changing the function signature.
The action creators will largely migrate code from task-manager.js and dependency-manager.js into this new structured form, but without the file handling. For example, the core logic in task-manager.listTasks() that filters and calculates statistics​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 can be reused either in an action or in the CLI, but the file reading part (readJSON) is dropped in favor of using taskStore.getState().
4.1.3. State Observers
Set up observers to handle side-effects of state changes. With an event-driven state store, we can decouple things like saving to disk and updating the UI from the core logic. We will create an observers.js module that registers callbacks to the state store’s events. Technical Requirements:
Auto-Persist on Change: The most important observer is one that listens for any state change and triggers a save to tasks.json. For example, taskStore.on(STATE_EVENTS.CHANGE, () => taskStore.saveState()); could be used. In practice, we might want to debounce this to avoid multiple rapid writes. We can maintain a short delay (e.g. 100ms) and if a new change comes in, reset the timer, so that during a burst of actions the file is written once at the end. This ensures that after any command completes, the state is safely stored on disk.
Logging and Debugging: We can attach listeners for specific events to provide logging. For instance, on TASK_ADDED or TASK_UPDATED, use our logging utility to print a success message (though the CLI command might already do this, so this is optional). On STATE_EVENTS.ERROR, log the error details. If verbose logging is enabled, an observer on STATE_EVENTS.CHANGE can dump some debug info (like number of tasks, or the lastUpdated timestamp)​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
. These observers replace scattered log() calls after file writes in the old code.
Enforce Constraints: We can use observers to enforce certain business rules automatically. For example:
Listen for a task status update event (TASK_UPDATED) and if a task was marked “done”, automatically mark all its subtasks as “done” as well, or vice versa (if all subtasks of a task become done, mark the parent as done). The example system hints at such logic​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
. We have to be careful implementing such rules to avoid infinite loops (e.g. an observer that changes state will trigger another change event). One approach is to perform such related updates within the action itself (like an action setTaskStatus could optionally update subtasks), but an observer is a cleaner separation. We can mitigate loops by having the observer not re-emit events (or by temporarily disabling events during the programmatic update, or by marking tasks accordingly).
Listen for dependency changes and run validation. For instance, after any TASK_UPDATED (which could include dependency edits) or after DEPENDENCY_ADDED/REMOVED, trigger a check for dependency cycles. If a cycle is found, we could log a warning or even automatically remove the problematic link (like the current validateAndFixDependencies does). This ensures the state doesn’t stay in an invalid condition.
Modular Observers: Structure the observers module to have distinct setup functions for each concern (logging, persistence, auto-updates). For example, setupPersistenceObserver(taskStore), setupLoggingObserver(taskStore), setupDependencyObserver(taskStore). Then a main function setupAllObservers() can call all of them. This way, it’s easy to enable/disable certain observers if needed.
Register the observers at application startup (after creating and loading the state store). For example, in the CLI initialization, call setupAllObservers(taskStore) so that any subsequent state changes will trigger the desired side effects.
In summary, observers will primarily handle persistence and data integrity checks. The persistence observer ensures that the in-memory state is always synced to tasks.json on disk (the single source of truth for persistence), maintaining continuity with the current file-based approach but now in a controlled fashion. Other observers maintain integrity so that commands no longer need to explicitly call things like fixDependencies unless the user requests – the system itself will guard against obvious inconsistencies.
4.1.4. Task State Machine
Implement a state machine to govern task status transitions. This will formalize what statuses a task can be in and how they can change, preventing invalid or illogical state transitions. This can be a small module, e.g. scripts/modules/task-state-machine.js, which exports functions to validate and execute state changes for task status. Technical Requirements:
Define the set of valid task states. Based on Task Master’s usage and future needs, we include:
pending – Task is not yet started but ready to be worked on (no blocking dependencies).
in-progress – Task is actively being worked on (this state might not have been explicitly used in the old version, but we introduce it for completeness).
done – Task is completed.
deferred – Task is postponed or on hold (the system already recognizes "deferred" as a status​
FILE-MOXEXMU8MCHWXMTXQLDWSE
).
(Additionally, the old code mentions 'completed' as a synonym for 'done'​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 and 'blocked' as a possible status counted in list output​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We can treat 'completed' as an alias to 'done' and 'blocked' not as a distinct status but as a derived state if a pending task has unmet dependencies. For this state machine, we focus on primary statuses that a user sets.)
Define which transitions are allowed between these statuses:
From pending: can go to in-progress (start working on it), or directly to done (mark as completed without intermediate), or to deferred (decide not to do it now).
From in-progress: can go to done (finish the task), back to pending (if work is paused or undone), or to deferred (pause it for later).
From deferred: can go to pending (resume it), or to in-progress (start directly from deferred). Probably should not go directly to done without first resuming (but we might allow it if a deferred task gets done outside of plan). We will allow deferred -> done as a two-step: deferred -> in-progress -> done ideally, but for simplicity, a user could also mark deferred directly as done. This can be decided by whether we enforce strict sequential transitions or allow shortcuts.
From done: usually final, but perhaps allow reopening a completed task (done -> pending) if needed. This could be useful if a user marks something done by mistake or requirements change.
We will explicitly disallow any transition not listed (e.g., you shouldn’t directly move from done back to in-progress without going through pending, if we consider done to pending as the “reopen” action).
Implement a mapping of VALID_TRANSITIONS as an object where keys are current state and values are arrays of allowed next states. For example:
js
Copy
const VALID_TRANSITIONS = {
  pending: ['in-progress', 'done', 'deferred'],
  'in-progress': ['done', 'pending', 'deferred'],
  deferred: ['pending', 'in-progress'],
  done: ['pending']  // allow reopening
};
This map will be used to check transitions. We will include both lowercase and perhaps normalized versions if needed (the system might treat 'completed' as done internally).
Provide a function canTransition(fromStatus, toStatus) that returns true if the transition is allowed according to the map (and false otherwise). This can simply check if toStatus is in VALID_TRANSITIONS[fromStatus]. If a status is not in our known map (e.g. a custom status string), we could decide to allow it by default or treat it as not allowed. Given the system currently allows “any string” for status but highlights common ones​
FILE-MOXEXMU8MCHWXMTXQLDWSE
, we might allow unknown statuses to transition anywhere (or better, define them under a catch-all rule if needed).
Provide a function transition(task, newStatus) that attempts to perform the state transition on a given task object:
It checks the current status (task.status) and uses canTransition to verify the move is permitted.
If not, it throws an Error: e.g. “Invalid transition from deferred to done” (if we decided deferred->done is not direct, for instance). This prevents the action from proceeding.
If yes, it returns a new task object (clone of the original with status set to newStatus). We return a new object rather than mutate in place, to avoid side effects on the original state if needed. (Though we could also mutate since we control when this is called.)
Optionally, integrate hooks around transitions: For instance, if there is any logic that must happen before or after certain transitions, allow registration of hook functions. Example: before transitioning from pending to in-progress, we might want to start a timer or log; after transitioning to done, we might want to trigger something (like marking dependencies as unblocked). The state machine module can have registerBeforeHook(from, to, fn) and registerAfterHook(from, to, fn) to attach these. Initially, we may not use hooks, but we will design with this extensibility in mind.
The state machine should be used by the setTaskStatus action. Instead of blindly setting the new status, the action will do:
js
Copy
if (!taskStateMachine.canTransition(oldStatus, newStatus)) {
    throw new Error(`Cannot change status from ${oldStatus} to ${newStatus}`);
}
const updatedTask = taskStateMachine.transition(task, newStatus);
// then update state with updatedTask
This ensures any invalid request is caught. Note that this adds a bit of strictness that previously didn’t exist (the old system would let you set any status string​
FILE-MOXEXMU8MCHWXMTXQLDWSE
). We will enforce only logical transitions for the standard statuses. If the user tries to set a completely unknown status (say "archived"), canTransition might return false unless we treat unknown as always allowed. For now, we assume users stick to the known statuses; if they use a custom status, we could consider all transitions from or to it as allowed by default (or simply not restrict custom statuses). The implementation can choose to be permissive for unrecognized statuses to maintain flexibility.
Include the defined statuses and transitions in documentation (so developers know the rules). Possibly expose a method getValidNextStates(currentStatus) that returns the list of allowed next statuses for a given current status, which could be used if we ever implement a prompt or UI hint for what you can do next.
Example Implementation:
javascript
Copy
// task-state-machine.js
export const TASK_STATES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  DEFERRED: 'deferred'
};

const VALID_TRANSITIONS = {
  [TASK_STATES.PENDING]: [TASK_STATES.IN_PROGRESS, TASK_STATES.DONE, TASK_STATES.DEFERRED],
  [TASK_STATES.IN_PROGRESS]: [TASK_STATES.DONE, TASK_STATES.PENDING, TASK_STATES.DEFERRED],
  [TASK_STATES.DEFERRED]: [TASK_STATES.PENDING, TASK_STATES.IN_PROGRESS],
  [TASK_STATES.DONE]: [TASK_STATES.PENDING]  // allow reopening a done task
};

export function canTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export function transition(task, newStatus) {
  const fromStatus = task.status || TASK_STATES.PENDING;
  if (!canTransition(fromStatus, newStatus)) {
    throw new Error(`Invalid transition from "${fromStatus}" to "${newStatus}"`);
  }
  // Perform any before-transition hooks or checks here (not implemented for now)
  const updatedTask = { ...task, status: newStatus };
  // Perform any after-transition hooks here (e.g., logging)
  return updatedTask;
}

// (Optional) hook registration system for before/after transitions could be added here
The above defines a simple state machine. We will integrate it in actions: e.g. actions.setTaskStatus(id, status) will use transition() to get the updated task and then commit it to state. In the future, if more status values are added or if we need to enforce dependency-based blocking (like auto-setting a task to "blocked" if dependencies not done), we can expand this system.
4.2. Phase 2: Refactor CLI Commands
With the state management core in place, we will refactor the CLI commands to utilize it. The CLI (scripts/modules/commands.js and related UI functions) will be modified so that each command retrieves data from or updates data in the centralized state instead of directly manipulating tasks.json. The aim is to keep the CLI interface identical for users, but internally route through the new state APIs.
4.2.1. CLI Command Infrastructure
We will reorganize the CLI command handling for clarity and to accommodate the stateful approach. Rather than one large commands.js file with all commands, we can split commands into separate modules and load them dynamically (this makes maintenance easier, but the existing structure can also be adapted if we prefer minimal changes). We will also initialize the state store at CLI startup so it’s available to all commands. Technical Requirements:
Initialize State at Startup: In the CLI entry point (perhaps a new cli.js or within the existing commands.js), load the tasks state once when the program starts. For example: call await taskStore.loadState() on startup (before parsing commands). This will populate the in-memory state from disk​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
. If the user provided a --file option for an alternate tasks file, use that path in loadState (e.g. await taskStore.loadState(customPath)). We can handle this by parsing the CLI arguments for a global file option. Since Commander doesn’t natively support global options easily per subcommand, we might consider switching to a library like Yargs which allows defining global options and async command handlers more cleanly. Using Yargs is optional, but the example approach uses it for simplicity of async/await and modular commands.
Modularize Commands: Create a directory scripts/modules/commands/ and move each command’s implementation into its own file (e.g. list.js, show.js, add-task.js, etc.). Each command module will export an object or definition that can be registered with the CLI parser. For example, a command module might export: command (the name and usage string), description, an builder(yargs) function to define its options, and a handler(argv) function that executes the command. This structure is compatible with Yargs command modules. If sticking with Commander, we can still modularize by exporting functions to register each command. The key is to isolate the logic for each command.
Use State Store in Handlers: Rewrite each command’s action (handler) to use the state management functions:
Instead of reading tasks.json within the command, fetch the needed data from taskStore. For example, the list command handler will do something like: const { tasks } = taskStore.getState(); then apply any filtering for status (or call a helper like taskStore.getTasksByStatus(statusFilter) if we implemented that). Similarly, the show command (to display a specific task) will use taskStore.getTaskById(id) to retrieve the task​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 instead of reading the file.
For commands that modify tasks, call the appropriate action. For instance, the set-status command will call await actions.setTaskStatus(id, newStatus) rather than manually editing the file. The add-task command will call await actions.addTask(prompt) which in turn handles AI calls and state updates, etc. Because our actions return updated objects, the CLI can then output confirmation (e.g. “Task 7 added successfully”).
The expand command, if using actions expandTask/expandAllTasks, will call them and then perhaps output the newly generated subtasks or a success message.
The parse-prd command will call await actions.parsePRD(filePath, numTasks) and then, on success, simply inform the user that tasks were generated (the action itself will have updated state and triggered file save + generated individual task files). The CLI might print how many tasks were created, which it can get from the returned data or from taskStore.getState().tasks.length.
The update command will similarly call await actions.updateTasks(startId, prompt, useResearch) and then output any summary (maybe number of tasks updated).
Dependency commands (add-dependency, remove-dependency, etc.) will call their corresponding actions and print results (e.g. “Dependency added” or error messages if thrown).
Preserve Command Syntax and Options: All command names, flags, and arguments remain exactly as before. Each command module’s definition should include the same options and defaults. For instance, the list command still supports -f/--file, -s/--status, --with-subtasks​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. The only difference is how -f is handled: in the new system, if -f is provided, we should trigger taskStore.loadState for that file before executing the command. One approach is to treat -f as a global option: we can configure the CLI such that if a file option is present, we load that file. In Yargs, for example, one could use middleware or check argv.file in each handler’s start. In Commander, each command’s action is already receiving the file path and currently reading the file itself; now instead, we will call await taskStore.loadState(filePath) at the top of the handler to (re)load the state from that alternate file (or if the state was initially loaded from default and filePath differs, we may need to reload). Since our program is short-lived per command, an easier method is: when using Yargs, define --file as a global option and do an initial loadState using that if present, otherwise default. Alternatively, in each command handler, if options.file is not the default, call await taskStore.loadState(options.file) at the start. This ensures the state reflects the correct file contents. After the command completes, the state will be saved back to that file by our observer.
Note: Because we load state at startup by default, if a command is given a different file, we might end up loading twice (once default, then again the custom). This overhead is minor (file read twice) and acceptable for simplicity. Or we skip initial load if we detect a file option present in args (depending on how we parse). The implementation can decide this detail as long as correct data is loaded.
Update UI Functions: Some functions in ui.js that display information might no longer need to read the file. For example, displayTaskById(tasksPath, id)​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 currently reads the file; we can change its signature to displayTask(task) and just take a task object (already retrieved from state). The command handler can call displayTask(taskStore.getTaskById(id)). Similarly, displayNextTask can retrieve the next task from state and then format it. We should refactor ui.js accordingly: remove any readJSON calls inside it (since state is loaded) and instead rely on data passed in or global state. This simplifies UI functions to pure formatting.
We might not need to pass the entire state to UI; since UI functions are small, it’s fine to have the command handler assemble the data (with help of state getters) and call a display function. For example, for list, we might not even need a displayList function – the command handler can iterate over tasks and print in a table as task-manager.listTasks did. Alternatively, we port some of that printing logic into a new displayTasksList(tasks, options) in ui.js that takes an array of task objects and handles printing (using cli-table3 etc., as in task-manager.js list implementation).
Command Registration: If using Yargs, implement a loader that imports all command modules and registers them. For example, a commands/index.js that reads all .js files in the commands directory (except index) and imports them, returning an object mapping command names to command definitions​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
. Then in the main CLI setup, after loading state and observers, we do something like:
js
Copy
const allCommands = await loadCommands();
for (const cmd of Object.values(allCommands)) {
  yargs.command(cmd.command, cmd.description, cmd.builder, cmd.handler);
}
Ensure also to include the help, version, and any global options (like --verbose). This dynamic approach makes adding commands in the future easier and the code cleaner.
Maintain Help Texts and Usage: The new CLI should still provide the same help output. Ensure each command module has the same description and options help as before. If using Yargs, .help() and .usage() should be configured to match current behavior (the example sets scriptName to 'task-master' and usage and enables .version() automatically​
FILE-UOFBP1ALUJ4CEWWP9UTXGM
). If sticking with Commander, we continue to use program.description() and the built-in help.
Logging: The existing code uses a log(level, message) utility and prints colored output via chalk. In the new setup, we should still utilize those for consistency. For instance, after an action, we might call log('success', 'Task added'). Our observers might also log automatically on state events, but to avoid duplicate messages, possibly we disable success logging in observers and keep it in command handlers for user feedback that is more contextual. For example, in add-task handler, after adding, we can log('success', \Added task ${newTask.id}`)`. The exact distribution of logging can be decided, but from a PRD perspective: ensure the user gets similar feedback messages as before.
Example: After refactoring, a command like task-master list will internally do: load state (already loaded at startup), filter tasks if --status provided, then display them. No file path is opened during the listing; it's all coming from memory. The output (table of tasks, counts, progress bars, etc.) should look the same as in the original implementation. Another example: task-master set-status 3 done will call actions.setTaskStatus(3, 'done'). The state machine will verify the transition (e.g. allow pending->done), update the task in state, emit events, the persistence observer will save the file, and then the command prints a confirmation. This should yield the same end result (tasks.json updated with task 3 marked done, and console confirms) but with a cleaner internal workflow.
Backward Compatibility: It’s crucial to double-check that each command accepts the same inputs and produces the same outputs as before. The refactoring should be invisible to users. For instance, any scripts or tools users have that parse the output of task-master list should still work (the format of the table and summary should not change). We will not rename any commands or remove any options during this refactor. If any output does change (even minor wording), it should be noted, but aim to avoid changes. The use of the --file option across commands (to point to alternate JSON files) is preserved – the new system will handle it by loading the given file into state and then proceeding, so from the user perspective it’s the same behavior (list, add, etc., will operate on that file)​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. All default values remain (for example, -f default is tasks/tasks.json, which we’ve built into the state store; parse-prd default input scripts/prd.txt stays the same; etc.).
4.2.2. Refactor Individual Commands
Refactor each CLI command one by one to ensure complete coverage. Key commands to address and their considerations:
list – Lists all tasks (with optional filtering by status and ability to show subtasks). In new system, implement by reading from taskStore.state.tasks. Leverage the logic from the old listTasks for formatting: it calculated counts of tasks done, pending, etc., and used cli-table3 to display tasks in a table with colored status icons​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We can reuse this logic in the new list command handler. It may call a helper function to generate the progress bars (the createProgressBar utility from ui.js can remain as is). Essentially, the new list will do what task-manager.listTasks() did, but without reading the file (since state is already loaded). After computing the output, print to console. Ensure that the output format (columns like ID, Title, Status, etc.) and the summary (total tasks, completion % bar, etc.) match exactly the current behavior for consistency.
show <id> – Shows detailed information for a specific task (and possibly its subtasks). This corresponds to the functionality in ui.displayTaskById​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Refactor to fetch the task from state (taskStore.getTaskById(id)) and then print its details. The printing logic can be similar: show a box with the task title, and a table of fields (ID, status, description, etc.). If the task has subtasks, display them appropriately (the old code had special handling if the task is a subtask vs parent​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 – the new code should do the same). We maintain all the coloring and formatting (using chalk, boxen, etc.) as before.
next – Shows the next task to work on (likely the highest priority pending task with no incomplete dependencies). In the old system, this might have been implemented by a combination of dependency checks and status filtering (the code base suggests something like findNextTask utility was present​
FILE-MOXEXMU8MCHWXMTXQLDWSE
). For the new implementation, we can utilize taskStore.getNextTask() if we implemented it, or replicate the logic: e.g., filter tasks for those status pending, whose dependencies array is all done tasks, then pick the one with highest priority (assuming priority ordering is defined, e.g. "high", "medium", "low"). The specifics depend on how "next" was defined originally. Likely, the old next command simply displayed the first available pending task (maybe sorted by ID or so). We should ensure we interpret it correctly. In any case, use the state data to determine the result, and output similarly (maybe just like show for that task).
set-status <id> <status> – Updates the status of a task. The old version used setTaskStatus which read and wrote the file​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. In our refactor, the command handler will call await actions.setTaskStatus(id, status). That action uses the state machine to validate the change. If it throws (invalid transition), catch it and print an error (e.g. “Error: Cannot mark task 5 as done from deferred state”). If it succeeds, we can print a success message. The current CLI likely prints something like “Setting status of task(s) X to Y...” then maybe nothing on success or just relies on the log inside task-manager.setTaskStatus. We will replicate any user-facing messaging. Possibly, we output the updated task or at least confirm. The persistence is automatic. Also, if multiple IDs can be set in one command (some systems allow specifying a list, not sure if Task Master does), ensure we handle those – perhaps the set-status command in Commander accepted comma-separated IDs? If so, the handler should iterate over each and call the action.
add-task – Adds a new top-level task. The old command is described as "Add a new task using AI"​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. It likely takes a prompt (-p/--prompt) describing the task to add. Implementation wise, it probably calls the AI (Claude) to generate a task or uses some simpler approach. For our refactor, the addTask action will handle the heavy lifting (including calling AI if needed via ai-services.js). The command handler will pass along the prompt or parameters to actions.addTask. If that returns a new task, output something like “Task [ID] added: [Title]”. Ensure that any flags such as --dependencies (to add with initial dependencies) are handled – possibly the original allowed specifying dependencies on creation. The action should take those into account (the taskData passed in could contain a dependencies field parsed from CLI).
add-subtask – Adds a subtask or converts a task to a subtask. The CLI options show it requires a parent id and either a prompt or an --existing task id to convert​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. The handler will interpret those options and call actions.addSubtask(parentId, subtaskData) or perhaps if --existing is given, call a different action or the same with a flag indicating conversion. We will implement conversion logic inside actions.addSubtask as discussed. After performing the addition, print success. If a new subtask was created via AI, likely the action will generate an id and content – we can display that. If an existing task was converted, maybe mention it.
remove-subtask – Removes a subtask (with option to convert it to a full task via --convert flag as per original syntax​
FILE-MOXEXMU8MCHWXMTXQLDWSE
). The handler will call actions.removeSubtask(parentId, subtaskId, { convert: true/false }). The action will handle either deletion or conversion to top-level. After, print confirmation.
add-dependency / remove-dependency – These call actions.addDependency(taskId, depId) or actions.removeDependency(taskId, depId) respectively. After addDependency, the CLI could log “Added dependency X to task Y” which the old code did​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We will maintain such messages (the action might already log success via observer, but to be safe do it in CLI as well or ensure one path logs it). Similarly for remove.
validate-dependencies – Possibly a command that just checks and reports issues. In new architecture, this could simply call actions.validateDependencies() which returns a list of problems, then print them out. Because this doesn’t change state, it might not emit events; we handle output directly.
fix-dependencies – A command to automatically remove bad dependencies. The new version will call actions.fixDependencies(), which will modify state (removing invalid deps). That will trigger a save and possibly events. The CLI then prints “Fixed dependency issues in tasks.json” as the old one did​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Also, in the old code, after fixing, they regenerated task files (noticed by the log "Regenerate task files" comment)​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We must ensure to do the same if needed: likely, if tasks were removed or dependencies changed, it might not require regenerating all files, but the original did so just in case. For consistency, we could call generateTaskFiles after fix if the original did. This can be triggered via an observer or simply call within the action fixDependencies.
parse-prd – Already discussed in actions: the handler will call await actions.parsePRD(inputFilePath, numTasks). That action returns when tasks are generated and state updated (including file saved and individual files generated). We then output a success message, which the original did in a boxen with "Next Steps"​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We should output the same "Successfully generated X tasks from PRD" and the next steps suggestions, replicating the format​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Since our action took over writing the file, we must ensure those messages still show (they can be moved into the CLI now, or the action could return the count so CLI prints it).
update – The handler calls await actions.updateTasks(filePath, fromId, prompt, useResearch). Once done, maybe output "Tasks updated from ID X". Possibly the original provided detailed output of what changed or just a confirmation. We'll mirror what original did (need to check original behavior from user perspective; if not documented, a simple confirmation suffices).
expand – The handler logic is partially shown in the existing code​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. It checks --all vs --id. We will simplify by calling actions.expandAllTasks(...) or actions.expandTask(id, ...). The loop printing "Using Perplexity AI..." etc. can be retained but perhaps that belongs in action (the action could itself log, but since we want immediate feedback to user, doing some prints in CLI is fine – as the current code does). We can keep those console.log lines in the CLI for continuity (they are not state changes, just informing the user). After expansion, maybe the CLI could display the newly added subtasks or just confirm completion. The example code didn't explicitly show printing the results, just the process. Possibly they rely on the list command after to see them. We'll assume just a success notice.
analyze-complexity – This command likely triggers an AI analysis and writes a report to a JSON. It’s less about tasks state, more of a side functionality. It does read tasks (it has a -f option)​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. We can refactor it to use state: load state from tasks (or ensure tasks are loaded), call whatever analysis function (perhaps in ai-services.js or task-manager.analyzeTaskComplexity which was imported), then save the report. This doesn’t change tasks state, so it could be left mostly as is, just not reading tasks from file manually (but since it needs all tasks, it can use state after ensuring state is loaded from the provided file). This is a peripheral feature but should be updated similarly to use state.
In summary, each command will be updated to call into the new state management layer. This will remove a lot of duplicate file handling code. We need to test each command thoroughly to ensure the behavior remains consistent.
4.3. Phase 3: Testing Strategy
With the implementation complete, we will create a comprehensive test suite to validate the new state management and refactored CLI. Our testing approach will include unit tests for the state store and actions, as well as integration tests for end-to-end CLI command behavior. We aim for no regressions – all features should work as before – and to cover new edge cases introduced by the stateful design (like ensuring multiple sequential operations maintain consistency).
4.3.1. Test Setup
Testing Environment: We will use Node.js and Jest (as currently used in the project) for writing and running tests. The new architecture allows us to test much of the logic without touching the file system or requiring actual CLI execution for every case, improving testability. We will organize tests similarly to the current project (likely in a tests/ directory, mirroring modules structure). Key setup considerations:
Isolated State: Each test should start with a fresh state store (or a clean state within it). We should export or allow resetting the taskStore singleton for tests, or create a new instance for testing purposes if needed. Alternatively, the TaskState class could have a method to reset state (clear tasks, etc.), which we can call in beforeEach. We will ensure that no state persists between tests (for example, if taskStore is a singleton, we might re-import or clear its data each time). This prevents cross-test interference.
Avoid Real File I/O in Unit Tests: Unit tests for actions and state store should not write to the real tasks.json. We will not run them against the production data file. Instead, we can redirect the state store to use a temp file or mock the file read/write methods. For instance, in tests we can monkey-patch taskStore.tasksFilePath to point to a temporary path (like in a tmp directory) and ensure that path is cleaned up after tests. Or we can stub fs.promises.writeFile and readFile using Jest mocks to intercept actual disk writes (the repomix guidelines already emphasize not using real file ops in tests​
FILE-MOXEXMU8MCHWXMTXQLDWSE
). A simple approach: in a Jest setup file, do jest.spyOn(fs.promises, 'writeFile').mockImplementation(/* write to memory or noop */) and similarly for readFile, then provide test data manually.
Test Data: Prepare sample task data objects to use in tests. For example, an array of tasks including various statuses and dependencies to simulate a realistic scenario. We may use the existing tasks.json (or parts of it) as a basis for constructing test cases. Also include edge cases, like tasks with subtasks, circular dependencies, etc., depending on what we want to validate.
Testing Helpers: If needed, write some helper functions in tests or use fixtures (like a JSON file with sample tasks) that can be loaded into the state store for testing state transitions and actions.
4.3.2. Unit Tests
Focus on unit testing the core state management modules (state-store.js, actions.js, and task-state-machine.js):
State Store Tests: Verify that the state store correctly loads and saves data, and that its get/set methods work as expected. For example:
Test that after calling loadState with a known JSON input (maybe we create a temp file with known content), taskStore.getState() returns the matching object (tasks and meta as in file). We can simulate the file content by writing a small JSON to a temp location or by mocking fs.readFile to return a predetermined JSON string.
Test that setState properly merges partial updates. For instance, initialize state with certain tasks, call taskStore.setState({ loading: true }), then check that taskStore.getState() reflects loading: true and unchanged tasks.
Test that events are emitted. We can attach a listener to taskStore.on(CHANGE, ...) in the test, perform a setState, and ensure our listener was called with the new state. Similarly for error events: we might simulate an error (perhaps by forcing saveState to fail via mocks) and verify the STATE_EVENTS.ERROR triggers.
If history is enabled, test that providing recordHistory: true pushes previous state to history. For example, change something, then undo by swapping state with last history entry (if we implement undoLastAction).
Action Creators Tests: For each action, write tests covering both typical and edge cases:
addTask: ensure that after adding, the tasks list grows by one and the new task has the expected fields (id assigned, defaults set). Test adding with a provided ID (if allowed) vs without. Also test adding with dependency flags, etc. If addTask calls AI, we need to simulate that. Likely, the action will call some function like callClaude internally. We should mock the AI calls in tests to return predetermined results so the action can proceed without actually contacting the API. For instance, jest.mock ai-services.js and have generateSubtasks return a static subtask list for testing the expandTask action.
updateTask: set up a state with a known task, call update to change its title or status (if allowed), and verify the state was updated accordingly (and no other tasks affected).
removeTask: populate multiple tasks, remove one by ID, verify it’s gone and dependencies in others are updated (if the removed task was a dependency of another, ensure that dependency is removed or handled as per logic).
setTaskStatus: test valid transitions (pending -> done, etc.) result in the task’s status changing, and invalid ones throw errors (e.g., try to set an in-progress task to an unknown status and expect an error). We’ll likely need to mock or import the task-state-machine in the actions module tests to ensure it’s being used.
addSubtask: test adding a subtask to a task – after calling, the parent task’s subtasks array length increases and the new subtask has expected fields. Test converting an existing task to subtask: prepare two tasks, call addSubtask with one as parent and the other’s ID as existing; then check that the second task is removed from top-level and appears under the first task’s subtasks.
removeSubtask: similar to above, test both removal and conversion. If conversion, ensure the subtask is now a top-level task in state and removed from parent’s subtasks.
addDependency / removeDependency: start with tasks with no dependencies, call addDependency, verify the task’s dependencies array contains the new ID​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Also test adding an already existing dependency (should it ignore or throw? Possibly just ignore duplicate – we can decide expected behavior and test accordingly). For removeDependency, ensure the ID is removed from the array.
fixDependencies: create a scenario with an invalid dependency (e.g., task 5 depends on task 99 that doesn’t exist, or a self-dependency). After fixDependencies(), verify the state no longer has those invalid references (task5’s dependencies array no longer contains 99). Also test a circular dependency scenario if we expect fix to remove one end of it.
parsePRD: This one is complex to unit test fully because it involves reading a PRD file and calling AI. We can simulate by creating a fake PRD text and then mocking callClaude to return a structured tasks object (with tasks array). Then test that parsePRD action properly sets state.tasks to that array and state.meta (source, totalTasks, etc.) from the PRD​
FILE-MOXEXMU8MCHWXMTXQLDWSE
​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Also verify it triggers save (maybe by checking the file output, or simply that taskStore.state.tasks matches expected). Because it also calls generateTaskFiles, we might want to mock that out so as not to actually create files in unit tests. The action could import task-manager.js’s generateTaskFiles, which we can jest.mock to just return quickly. Our interest is mainly that state is updated and it indicates success.
expandTask / expandAllTasks: Provide a dummy implementation for AI subtask generation (mock generateSubtasks to return a list of subtasks like [ {id:1,...}, {id:2,...} ]). Then test that after expandTask, the specified task in state now has those subtasks appended. If force option, test that calling expand again with force replaces them (if that’s intended behavior). expandAllTasks can be tested by setting multiple tasks pending and seeing that all got subtasks.
setTaskStatus with state machine integration: specifically test some transitions require conditions. For example, you might design that a task cannot go to done if it has pending subtasks – if we implement that via observer or within action, we should test that scenario (create a task with a pending subtask, call setTaskStatus to done, expect maybe it still allows or not depending on design). If we implement auto-marking of subtasks done when parent done or vice versa, those should be tested too (observer behavior can be tested via state changes).
These tests ensure that our actions correctly manipulate the in-memory state. We will use a lot of direct state inspection in these tests (checking taskStore.getState() or internal taskStore.state). Since the state store saves to disk on changes via observer, we might in unit tests disable the actual saveState to avoid writing, or redirect it to a temp file. Alternatively, since the unit tests will focus on memory state, we can simply ignore the file outputs (by mocking fs as noted). The important part is to check state integrity after each action, and that errors are thrown when expected (using Jest’s .rejects.toThrow() for async actions).
4.3.3. Integration Tests
Integration tests will run the actual CLI commands end-to-end to ensure the system behaves as expected in real usage scenarios. We will simulate the CLI calls and verify outcomes, which involves either invoking the command functions directly or spawning the CLI process with arguments. A mix of both approaches can be used:
Direct Invocation: Since our commands are modular, we can import the command handler functions in tests and call them with fake options objects, then inspect the state or outputs. However, verifying console output requires capturing stdout. We might prefer spawning a subprocess for a realistic test of output formatting.
CLI Process Tests: Use Node’s child_process.spawn or a testing library to run node task-master <command> <args> in a sandbox directory. This will execute our refactored CLI just like a user would. We can feed it a separate tasks file for testing to avoid clobbering real data (for example, copy a fixture tasks_test.json to a temp location, then run commands with -f temp_tasks.json). After execution, read back the temp file to verify changes, and capture the console output to verify it matches expected text.
Key integration tests to include:
Round-trip Basic Commands: Start with a known tasks file (maybe initially empty or with a couple tasks). Run task-master add-task --prompt "Test task" and then task-master list on that file, verify that the list output includes the newly added task with correct fields. Then run task-master set-status <newId> done, then task-master show <newId>, verify status is "done" in output and in file.
Subtask Workflow: Use task-master add-subtask -p "Subtask prompt" -p <parentId> and then task-master show <parentId> to see the subtask appears. Try task-master remove-subtask --id <parentId>.<subtaskId> and verify it’s gone (or converted if --convert specified). This ensures subtask addition/removal via CLI works end-to-end.
Dependency Workflow: task-master add-dependency --id <taskId> --depends-on <depId> then run task-master show <taskId> to see dependency listed. Then task-master remove-dependency --id <taskId> --depends-on <depId> and check it’s removed. Also possibly test validate-dependencies: introduce an invalid dependency manually (edit the file or via state in test), run task-master validate-dependencies -f <file> and capture output expecting it to list the invalid one, then run task-master fix-dependencies and ensure it reports fixing and indeed removes it in file.
AI-related Commands: For parse-prd and expand, full integration might be tricky since they call external APIs. However, if our code is structured to call functions in ai-services.js, we can run integration tests by mocking those calls at runtime. One approach: set environment variable or a flag in test to use a dummy AI module. Or we detect if running in test mode and skip actual API calls. For integration, maybe it’s acceptable to not test the AI output itself, just that the command runs and results in some tasks created. We could supply a small PRD file and maybe set a shorter model or dummy to avoid actual calls (or intercept network via environment). Alternatively, one could use an environment like NODE_ENV=test and in actions.parsePRD, if test, instead of calling actual API, read from a fixture. This might be overly complex; perhaps skip heavy AI integration tests, or only do them if we can inject a mock easily. We could design our callClaude in a way that if a CLAUDE_API_KEY isn’t present (which it wouldn’t be in CI), it returns dummy tasks for test. But that might mask errors. For safety, we might exclude parse-prd/expand integration from automated tests or ensure they can run with minimal logic. We'll rely on unit tests for those more.
Ensure Output Consistency: We should assert that the output of commands matches expected patterns. For example, after task-master list, the output should contain lines like "ID | Title | Status ..." table, and perhaps a summary with "Done: X Pending: Y Deferred: Z". If we have expected outputs (maybe from running the old version on sample data), we can compare those strings. Given formatting with colors and icons, we might strip ANSI codes before comparison. We could use snapshots in Jest for the CLI output of certain commands: e.g., run list on a known data set and snapshot the string (with colors removed) to catch any changes. This helps ensure we didn't inadvertently change spacing or wording.
Backward Compatibility Checks: If possible, run the old version’s command on the same input and the new version’s and compare results. This is hard to automate within one test environment because the old version is being replaced. But we can rely on manual verification or trust that if we matched code logic and tests pass, we achieved compatibility.
Error Cases: Test how the CLI handles misuse:
Ask to show a non-existent task ID -> should output "Task not found" message as before​
FILE-MOXEXMU8MCHWXMTXQLDWSE
.
Try to set-status on invalid ID -> error message.
Try to add-dependency with invalid dep ID -> likely an error or a log from validateDependencies. Our action might throw, so ensure the CLI prints something reasonable (and test for that).
Try to use commands in wrong combination (like expand without --id or --all) -> the code currently prints an error instructing to provide one​
FILE-MOXEXMU8MCHWXMTXQLDWSE
. Verify our refactor still does (should, since we’ll keep that logic).
If state machine disallows a transition (like done -> done, which might just be no-op or allowed? Or something else unusual), ensure the error is shown to user. Possibly test a scenario like marking a deferred task done if we disallowed it, expecting an error.
By covering the above, we ensure the new centralized state management performs correctly and that the CLI behaves identically to users. We will also monitor performance (the overhead of in-memory state and event emitting in a CLI should be negligible given the dataset is small typically, but tests on a larger fake tasks list could ensure it’s still fast).
4.3.4. Backwards Compatibility Validation
(Additional validation outside automated tests.) Before release, perform manual testing or a dry-run with an existing Task Master tasks file. Load a real tasks.json in the new CLI and try common operations to confirm nothing is lost or broken. Specifically: verify that reading an existing tasks.json with complex content yields the same outputs in list and show. Also ensure that writing back the file doesn’t alter the format (e.g., key ordering or spacing) in any problematic way. The fs.writeFile with JSON stringify will likely reformat the JSON (e.g., maybe keys order might change or whitespace might differ slightly). If preserving exact file formatting is important, we might need to handle that (the old code wrote JSON with 2-space indentation​
FILE-MOXEXMU8MCHWXMTXQLDWSE
 which we replicated). The content (tasks and meta) should remain identical aside from maybe ordering of keys which is not usually an issue. Also, check that the individual task files generation still produces the same files under tasks/ directory (the contents of those files should be unchanged as they were directly derived from tasks data – since we didn't alter tasks content structure, they should match). Finally, verify that no old functionality was dropped unintentionally: e.g., the init or dev commands (if any) still function if they were meant to. The snippet in repomix about init/dev suggests some bootstrap, but that might be outside normal usage. Assuming primary commands are covered, we conclude the system is ready. By following this PRD, a senior developer should be able to implement the new state management architecture step by step, confidently knowing that existing Task Master behavior will be preserved while the internal design becomes cleaner and more robust.

Sources




You said:
can you create a md document and zip the files?
ChatGPT said:
Reasoned about task state migration documentation for 32 seconds
Below is the Project Requirements Document in Markdown format. I’ve saved it as
TaskMaster_State_Management_Migration_PRD.md
and I’ve packaged it into a ZIP file named TaskMaster_State_Management_Migration_PRD.zip.

You can download the ZIP archive below.

Project Requirements Document (TaskMaster_State_Management_Migration_PRD.md)
markdown
Copy
# Product Requirements Document  
# Task Master State Management Conversion

## 1. Overview

Task Master’s current implementation manages tasks by directly reading from and writing to a JSON file (`tasks.json`) for every operation. Core modules like `task-manager.js` handle task CRUD by accessing this file system state, and CLI commands (defined in `commands.js`) invoke those file-based functions. Even user interface helpers in `ui.js` read the tasks file on the fly to display information. This file-centric approach simplifies persistence but scatters state logic across the codebase, making it harder to maintain, test, and extend.

This document outlines the requirements to refactor Task Master’s state handling into a **centralized state management architecture**. The goal is to introduce a single source of truth in memory for all task data (mirroring the contents of `tasks.json`), with formal APIs for state access and mutation. We will migrate the CLI tool to use this state store instead of performing raw file I/O in each command. The existing CLI usage and task file format will remain **backward compatible** – users will notice no changes in commands or outputs. By isolating state management, we aim to improve reliability (fewer file race conditions or corruption risks), make the code more modular and testable, and lay groundwork for future enhancements.

## 2. Goals

- **Centralize Task State** – Implement a robust in-memory state store for all tasks, replacing ad-hoc file reads/writes. All modules will source and update task data through this single state object.
- **Maintain Backward Compatibility** – Preserve the existing CLI interface (command names, options, and behavior) and the `tasks.json` file format. Users’ current commands (e.g. `task-master list`, `add-task`, etc.) and workflows will continue to work exactly as before. For example, the `-f/--file` option to specify an alternate tasks file will still be supported.
- **Improve Maintainability & Testability** – Refactor code to separate state logic from presentation and I/O. This modular design will make it easier to unit test state transitions in isolation (no need to stub the file system on every test) and to reason about the app’s behavior.
- **Enhance Reliability of State Transitions** – Introduce structured state transition management (e.g. a state machine for task statuses) to prevent invalid state changes and ensure data integrity. By controlling how tasks move between statuses (pending, in-progress, done, etc.), the system can avoid logical errors.
- **State Persistence and Recovery** – Continue to persist all task data to disk (still using `tasks.json` under the hood) but in a controlled manner. Implement safeguards like debounced writes and file locking to avoid race conditions or corruption, and consider automatic backups for recovery.
- **Foundation for Future Features** – Although no new CLI features are added in this refactor, the new architecture will be designed to be extensible so that additional features (undo/redo, real-time collaboration, etc.) can be added without major changes.

## 3. Scope

**In-Scope:** The project focuses exclusively on the internal re-architecture of state management without altering external behavior. It includes: 

- **State Store Module:** Creating a centralized state store (e.g. `state-store.js`) for holding all task data in memory and exposing methods for state access and mutation.
- **Action Creators:** Implementing a set of functions in a new module (e.g. `actions.js`) that encapsulate all allowed state mutations (adding tasks, updating status, etc.) instead of scattered file operations.
- **CLI Refactoring:** Updating all CLI commands to use the centralized state store via the new actions rather than performing file I/O. The external interface remains identical.
- **State Observers & Persistence:** Implementing observers that react to state changes in order to persist state to disk (writing to `tasks.json`) and enforce consistency.
- **Task State Machine:** Defining a formal state machine for task statuses and transitions to enforce valid moves (e.g. pending → in-progress → done) and prevent invalid state transitions.
- **Testing:** Writing unit tests for the state store, actions, and state machine, as well as integration tests for CLI commands to ensure full backward compatibility.
- **Documentation Updates:** Revising internal documentation (developer docs, README updates) to reflect the new state management approach while leaving user-facing behavior unchanged.

**Out of Scope:** No new user features are added. The current command-line interface, file formats, and workflows remain unchanged. Only internal refactoring is performed.

## 4. Detailed Implementation Strategy

### 4.1. Phase 1: Create State Management Infrastructure

#### 4.1.1. State Store Implementation

Create a centralized state store (e.g. in `state-store.js`) that:

- Uses Node’s `EventEmitter` to allow registration of change listeners.
- Maintains state as a single object (including `tasks`, `meta`, `currentTask`, `loading`, `error`, and `lastUpdated`).
- Provides getter methods (`getState()`, `getTaskById()`, etc.) and a controlled `setState(partialState, options)` method that updates state, updates `lastUpdated`, optionally records history (for potential undo/redo), and emits change events.
- Handles file persistence via `loadState(filePath?)` and `saveState(filePath?)`, including debouncing writes and using file locks as needed.
- Supports dynamic file paths if specified via CLI options.

#### 4.1.2. Action Creators

Implement a new module (e.g. `actions.js`) that defines all state mutations via functions such as:

- `loadTasks(filePath)`, `addTask(taskData)`, `updateTask(id, taskData)`, `removeTask(id)`, and `setTaskStatus(id, status)` – each reading from and writing to the in-memory state.
- `addSubtask(parentId, subtaskData)`, `updateSubtask(parentId, subtaskId, subtaskData)`, and `removeSubtask(parentId, subtaskId)`.
- `addDependency(taskId, dependsOnId)` and `removeDependency(taskId, dependsOnId)`.
- AI-related actions like `parsePRD(filePath, numTasks)` and `expandTask(taskId, numSubtasks, useResearch, context)` that update state with data generated by AI while preserving existing behavior.
- Validation within each action (using helper functions or schema checks) and error handling (throwing errors for invalid operations).

Each action should:
- Use asynchronous functions (async/await).
- Call `taskStore.setState()` to update and persist state.
- Return useful values (such as the new task) for the CLI layer.

#### 4.1.3. State Observers

Implement observers (e.g. in an `observers.js` module) that:

- Listen for state changes and trigger automatic persistence (saving the current state to `tasks.json`).
- Optionally log state changes and run consistency checks (e.g. dependency validation).
- Are registered at application startup to ensure that every change is reflected on disk and that business rules (auto-updating of task statuses, etc.) are enforced.

#### 4.1.4. Task State Machine

Create a module (e.g. `task-state-machine.js`) that:

- Defines valid statuses (e.g. `pending`, `in-progress`, `done`, `deferred`) and allowed transitions.
- Exposes functions such as `canTransition(from, to)` and `transition(task, newStatus)` to validate and perform transitions.
- Is integrated into actions (e.g. `setTaskStatus`) to prevent invalid status changes.
- Optionally supports hooks for pre- and post-transition actions.

### 4.2. Phase 2: Refactor CLI Commands

Update the CLI command infrastructure so that:

- On startup, the CLI loads tasks from the specified file (defaulting to `tasks/tasks.json`) via the state store.
- Each CLI command (list, show, add-task, set-status, add-subtask, etc.) retrieves or updates state exclusively through the new action creators.
- The overall output and user experience remain unchanged (same formatting, help text, and command names).
- File-related options (like `--file`) continue to work by redirecting the state store to load and save from the designated path.
- UI helper functions (in `ui.js`) are updated to format data passed from the state rather than doing file I/O themselves.

### 4.3. Phase 3: Testing Strategy

Develop a comprehensive testing suite that includes:

- **Unit Tests:** For the state store (testing `getState`, `setState`, event emission), action creators (ensuring correct state modifications and error handling), and the state machine (validating allowed transitions and rejecting invalid ones).
- **Integration Tests:** For CLI commands executed end-to-end (spawning the CLI process, checking output, and verifying that the underlying `tasks.json` file is updated correctly). Use controlled test fixtures and temporary file paths to avoid impacting production data.
- **Backward Compatibility Checks:** Ensure that existing command outputs (e.g. `list`, `show`) match expected formats, and that generated task files remain unchanged.
- **Error Handling:** Test cases where invalid input is provided and verify that meaningful error messages are displayed without breaking the process.

### 4.4. Phase 4: Documentation and Release

- **Update Developer Documentation:** Include a new section (or update the existing architecture document) explaining the centralized state management system, listing the new modules (`state-store.js`, `actions.js`, `task-state-machine.js`, `observers.js`), and detailing how to add new features using the state store.
- **Update the README:** Ensure that any instructions for command-line usage remain unchanged, but note internally that state is now managed centrally.
- **Verify Backward Compatibility:** Before merging, perform both automated and manual testing with existing workflows.
- **Release Plan:** Once testing is complete, merge the changes and notify users (via changeset or release notes) that Task Master now uses a centralized state management system with improved reliability and maintainability, with no change to the CLI interface.

---

This document should provide a clear guide for a senior developer to migrate Task Master’s state management from scattered file-based operations to a centralized, event-driven state store with structured actions and validations.

---

*References: Portions of this document reference content from the original repository’s files (such as `task-master-state-prd.md` and `repomix-output-claude-task-master.md`) as indicated by citation markers (e.g. “”).*
