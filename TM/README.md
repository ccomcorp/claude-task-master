# Task Master (Refactored)

### by [@eyaltoledano](https://x.com/eyaltoledano)

A task management system for AI-driven development with Claude, designed to work seamlessly with Cursor AI.

This version has been refactored to use a centralized state management architecture while maintaining complete backward compatibility with the original CLI interface.

## Architecture Improvements

- **Centralized State Store**: All task data is now managed through a single source of truth
- **Action Creators**: State mutations are handled through encapsulated functions
- **Observer Pattern**: State changes trigger appropriate side effects like persistence
- **Enhanced Reliability**: Improved file handling with locking mechanisms to prevent corruption
- **Improved Testability**: Separation of concerns makes unit testing more effective

## Requirements

- Node.js 14.0.0 or higher
- Anthropic API key (Claude API)
- Anthropic SDK version 0.39.0 or higher
- OpenAI SDK (for Perplexity API integration, optional)

## Configuration

The script can be configured through environment variables in a `.env` file at the root of the project:

### Required Configuration

- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

### Optional Configuration

- `MODEL`: Specify which Claude model to use (default: "claude-3-7-sonnet-20250219")
- `MAX_TOKENS`: Maximum tokens for model responses (default: 4000)
- `TEMPERATURE`: Temperature for model responses (default: 0.7)
- `PERPLEXITY_API_KEY`: Your Perplexity API key for research-backed subtask generation
- `PERPLEXITY_MODEL`: Specify which Perplexity model to use (default: "sonar-medium-online")
- `DEBUG`: Enable debug logging (default: false)
- `LOG_LEVEL`: Log level - debug, info, warn, error (default: info)
- `DEFAULT_SUBTASKS`: Default number of subtasks when expanding (default: 3)
- `DEFAULT_PRIORITY`: Default priority for generated tasks (default: medium)
- `PROJECT_NAME`: Override default project name in tasks.json
- `PROJECT_VERSION`: Override default version in tasks.json

## Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master-init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

### Important Notes

1. This package uses ES modules. Your package.json should include `"type": "module"`.
2. The Anthropic SDK version should be 0.39.0 or higher.

## Quick Start with Global Commands

After installing the package globally, you can use these CLI commands from any directory:

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Generate task files
task-master generate
```

## Task Structure

Tasks in tasks.json have the following structure:

- `id`: Unique identifier for the task (Example: `1`)
- `title`: Brief, descriptive title of the task (Example: `"Initialize Repo"`)
- `description`: Concise description of what the task involves (Example: `"Create a new repository, set up initial structure."`)
- `status`: Current state of the task (Example: `"pending"`, `"done"`, `"deferred"`)
- `dependencies`: IDs of tasks that must be completed before this task (Example: `[1, 2]`)
  - Dependencies are displayed with status indicators (✅ for completed, ⏱️ for pending)
  - This helps quickly identify which prerequisite tasks are blocking work
- `priority`: Importance level of the task (Example: `"high"`, `"medium"`, `"low"`)
- `details`: In-depth implementation instructions (Example: `"Use GitHub client ID/secret, handle callback, set session token."`)
- `testStrategy`: Verification approach (Example: `"Deploy and call endpoint to confirm 'Hello World' response."`)
- `subtasks`: List of smaller, more specific tasks that make up the main task (Example: `[{"id": 1, "title": "Configure OAuth", ...}]`)

## Integrating with Cursor AI

Claude Task Master is designed to work seamlessly with [Cursor AI](https://www.cursor.so/), providing a structured workflow for AI-driven development.

## State Management Architecture

The refactored Task Master uses a centralized state management approach:

- **State Store**: `state-store.js` manages the in-memory state and provides methods for state access
- **Action Creators**: `actions.js` contains functions that encapsulate all allowed state mutations
- **Observers**: `observers.js` registers listeners that react to state changes (e.g., for persistence)
- **Task State Machine**: Formal state transitions for task statuses, preventing invalid state changes

### Benefits of the New Architecture

1. **Reliability**: Fewer file race conditions and corruption risks
2. **Testability**: Easier to unit test state transitions in isolation
3. **Maintainability**: Clearer separation of concerns
4. **Performance**: Optimized file I/O with debouncing and batching
5. **Extensibility**: Foundation for future features like undo/redo and real-time collaboration

## Command Reference

All commands remain unchanged from the original Task Master, ensuring backward compatibility for existing users.

### Parse PRD

```bash
# Parse a PRD file and generate tasks
task-master parse-prd <prd-file.txt>

# Limit the number of tasks generated
task-master parse-prd <prd-file.txt> --num=<number>

# Use a custom output file
task-master parse-prd <prd-file.txt> --file=<tasks-file.json>
```

### List Tasks

```bash
# List all tasks
task-master list

# List tasks with a specific status
task-master list --status=<status>

# List tasks from a specific file
task-master list --file=<tasks-file.json>

# List in compact format (one line per task)
task-master list --compact

# Show all details including implementation notes
task-master list --verbose
```

### Show Next Task

```bash
# Show the next task to work on
task-master next

# Use a specific file
task-master next --file=<tasks-file.json>
```

### Show Task Details

```bash
# Show details for a specific task
task-master show --id=<id>

# Show details for a subtask
task-master show --id=<taskId.subtaskId>

# Use a specific file
task-master show --id=<id> --file=<tasks-file.json>
```

### Update Task

```bash
# Update task details
task-master update --id=<id> --title="New Title" --description="New description"

# Update multiple fields
task-master update --id=<id> --priority=high --details="New implementation details"

# Update a subtask
task-master update --id=<taskId.subtaskId> --title="New Subtask Title"
```

### Set Task Status

```bash
# Set status of a single task
task-master set-status --id=<id> --status=<status>

# Set status for multiple tasks
task-master set-status --id=1,2,3 --status=<status>

# Set status for subtasks
task-master set-status --id=1.1,1.2 --status=<status>
```

### Expand Tasks

```bash
# Expand a specific task with subtasks
task-master expand --id=<id> --num=<number>

# Expand with additional context
task-master expand --id=<id> --context="Additional implementation context"

# Expand all tasks
task-master expand --all

# Use research-backed subtask generation (requires Perplexity API key)
task-master expand --id=<id> --research
```

### Generate Task Files

```bash
# Generate individual task files from tasks.json
task-master generate

# Use a custom tasks file
task-master generate --file=<tasks-file.json>

# Generate files in a custom directory
task-master generate --output=<directory>
```

### Analyze Task Complexity

```bash
# Analyze task complexity
task-master analyze-complexity

# Only expand tasks with complexity above a threshold
task-master analyze-complexity --threshold=6

# Use an alternative tasks file
task-master analyze-complexity --file=custom-tasks.json

# Use Perplexity AI for research-backed complexity analysis
task-master analyze-complexity --research
```

### Managing Task Dependencies

```bash
# Validate that all dependencies form a valid graph
task-master validate-dependencies

# Add a dependency
task-master add-dependency --id=<id> --depends-on=<dependencyId>

# Remove a dependency
task-master remove-dependency --id=<id> --depends-on=<dependencyId>

# Find tasks blocked by a specific task
task-master find-dependents --id=<id>

# Visualize the dependency graph
task-master visualize-dependencies
```

## Best Practices for AI-Driven Development

1. **Start with a detailed PRD**: The more detailed your PRD, the better the generated tasks will be.
2. **Review generated tasks**: After parsing the PRD, review the tasks to ensure they make sense and have appropriate dependencies.
3. **Analyze task complexity**: Use the complexity analysis feature to identify which tasks should be broken down further.
4. **Follow the dependency chain**: Always respect task dependencies - the Cursor agent will help with this.
5. **Update as you go**: If your implementation diverges from the plan, use the update command to keep future tasks aligned with your current approach.
6. **Break down complex tasks**: Use the expand command to break down complex tasks into manageable subtasks.
7. **Regenerate task files**: After any updates to tasks.json, regenerate the task files to keep them in sync.

## For Developers

If you're interested in extending Task Master or understanding its internal architecture, please refer to the [developer documentation](./docs/state-management.md) for details on the state management system and extension points.
