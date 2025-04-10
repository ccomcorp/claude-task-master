# Memory Bank Rules - v1.0

## 🎯 Core Objective
To maintain continuous, accurate awareness of project state through a programmatic memory system that preserves hierarchical information structure, enabling AI assistants to maintain context between sessions.

## 🔑 Key Principles
1. **State First:** The project's memory state is authoritatively managed via the structured JSON content within the memory state system.
2. **MANDATORY Programmatic Access:** All interactions with memory must go through the `MemoryBankManager` API.
   - DO: `memory.get_section()`, `memory.update_section()`, `memory.log_change()`, etc.
   - DO NOT: use direct file I/O or manipulation of state files.
3. **Hierarchical Structure:** Memory sections build upon each other in a defined order.
4. **Complete Context:** All memory sections must be read at project start.
5. **Schema Validation:** All state must conform to defined schemas.

## 🧠 Memory Section Structure and Dependencies

### Core Sections (Required)
1. **Project Brief** → `projectInfo`
   - Foundation document that shapes all other sections
   - Core requirements and goals
   - Source of truth for project scope
   - *Dependencies:* None

2. **Product Context** → `productContext`
   - Why this project exists
   - Problems it solves
   - How it should work
   - User experience goals
   - *Dependencies:* Project Brief

3. **System Patterns** → `systemPatterns`
   - System architecture
   - Key technical decisions
   - Design patterns in use
   - Component relationships
   - *Dependencies:* Project Brief

4. **Tech Context** → `technologies`
   - Technologies used
   - Development setup
   - Technical constraints
   - Dependencies
   - *Dependencies:* Project Brief

5. **Active Context** → `tasks.current.activeContext`
   - Current work focus
   - Recent changes
   - Next steps
   - Active decisions
   - *Dependencies:* Product Context, System Patterns, Tech Context

6. **Progress** → `tasks.history`
   - What works
   - What's left to build
   - Current status
   - Known issues
   - *Dependencies:* Active Context

## 🔧 State Management API
- `memory.init_memory_bank()`: Create initial memory structure
- `memory.get_section(name)`: Retrieve content of a section
- `memory.update_section(name, content, metadata)`: Update section content
- `memory.check_dependencies_complete(name)`: Check section dependency completion
- `memory.get_ready_sections()`: Get sections ready to be worked on
- `memory.log_change(description, details)`: Log a state change
- `memory.load_memory_state()`: Load memory from storage
- `memory.save_memory_state()`: Save memory to storage
- `memory.enter_plan_mode()`: Prepare system for planning workflow
- `memory.enter_act_mode()`: Prepare system for action workflow
- `memory.update_all_memory_bank()`: Review all sections
- `memory.export_markdown()`: Export memory to markdown files
- `memory.import_markdown()`: Import markdown into memory

## 🚦 Core Workflows

### Plan Mode
```
1. Read entire Memory Bank
2. Check for incomplete sections
3. If sections incomplete:
   - Create plan to complete them
   - Document plan in chat
4. If all sections complete:
   - Verify context is current
   - Develop implementation strategy
   - Present approach
```

### Act Mode
```
1. Check Memory Bank
2. Update documentation as needed
3. Execute task
4. Document changes
5. Update Progress
```

## 📝 Memory Bank Update Triggers
Memory Bank updates must occur when:
1. Discovering new project patterns
2. After implementing significant changes
3. When user explicitly requests with "update memory bank"
4. When current context needs clarification

## 📊 Usage Guidelines
1. Always start by initializing or loading the memory state
2. Check for incomplete sections before planning work
3. Update active context before beginning work
4. Document progress after completing work
5. Export to markdown when human-readable format is needed

## 🔄 Integration Process
The Memory Bank system should initialize on project load:
```python
# Initialize on startup
memory = MemoryBankManager(".")
memory.load_memory_state()

# Check for missing sections
plan_status = memory.enter_plan_mode()
if not plan_status["all_complete"]:
    # Alert user to incomplete sections
    pass
```

## 🛠 Implementation Notes
1. All memory is stored in a structured JSON format internally
2. State is maintained at `./memory-bank/memory_state.json`
3. Backups are created automatically before saving
4. When importing/exporting markdown, the system uses:
   - `./memory-bank/projectbrief.md` for Project Brief
   - `./memory-bank/productContext.md` for Product Context
   - etc.

## 📋 Expected Workflow Example
```
User: Let's start a new project for a weather app

AI: [Enters Plan Mode]
    - Identifies missing Project Brief
    - Creates Project Brief
    - Updates projectInfo section
    - Explains next steps

User: Now let's implement the forecast feature

AI: [Enters Act Mode]
    - Updates Active Context
    - Implements the feature
    - Documents progress
    - Updates memory state
```

## ✅ Final Note
This file defines the behavior the AI must follow at all times. The memory state is the authoritative source of project context, and it must be maintained with precision and completeness.
