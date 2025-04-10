#!/usr/bin/env python3
"""
Update the memory bank with current task information.
"""
from memory_bank.core import MemoryBankManager
from memory_bank.sections import update_section, log_change

def main():
    """Update the memory bank with current task"""
    memory = MemoryBankManager()
    
    # Update tasks with current focus
    update_section(memory, "tasks", "", {
        "activeContext": """
Currently analyzing the original Task Master codebase to identify all places where direct file operations 
on tasks.json occur. This will help create a comprehensive map of state operations that need to be 
refactored to use the centralized state store.

The analysis is focusing on:
- scripts/modules/task-manager.js (Core task management)
- scripts/modules/commands.js (CLI commands)
- scripts/modules/ui.js (User interface helpers)
- scripts/modules/dependency-manager.js (Task dependency management)

Next steps will be to implement the state-store.js module based on the findings.
"""
    })
    
    # Log the change
    log_change(memory, "Started Task Master state management analysis", {
        "phase": "Analysis",
        "target_files": [
            "task-manager.js",
            "commands.js",
            "ui.js",
            "dependency-manager.js"
        ]
    })
    
    print("Memory bank updated with current task information.")

if __name__ == "__main__":
    main()
