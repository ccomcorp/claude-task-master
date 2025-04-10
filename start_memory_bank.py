#!/usr/bin/env python3
from memory_bank.core import MemoryBankManager
from memory_bank.sections import update_section, log_change
from memory_bank.workflows import enter_plan_mode
from memory_bank.exporters import export_markdown

# Initialize memory bank
memory = MemoryBankManager(".")

# Check if project brief exists
plan_status = enter_plan_mode(memory)
if "projectInfo" in plan_status["ready_sections"]:
    print("Project needs a brief! Let's create one.")
    
    # Update project brief
    update_section(memory, "projectInfo", '''
# Project Brief: New Project

## Objective
This project aims to...

## Key Requirements
- Requirement 1
- Requirement 2
- Requirement 3
''', {"name": "New Project", "description": "A brief description"})
    
    # Log the change
    log_change(memory, "Created initial project brief")
    
    print("Created project brief")
else:
    print("Project brief already exists")

# Export to markdown
export_path = export_markdown(memory)
print(f"Exported markdown files to {export_path}")
