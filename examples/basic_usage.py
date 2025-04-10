# examples/basic_usage.py
from memory_bank.core import MemoryBankManager
from memory_bank.sections import update_section, get_section, log_change
from memory_bank.workflows import enter_plan_mode, enter_act_mode
from memory_bank.exporters import export_markdown

# Initialize memory bank
memory = MemoryBankManager("./test_project")

# Update project brief
update_section(memory, "projectInfo", """
# Project Brief: Example Project

## Objective
This is an example project to demonstrate the Memory Bank system.

## Key Requirements
- Show basic functionality
- Demonstrate workflow
- Provide a clear example
""", {"name": "Example Project", "description": "A demonstration project"})

# Check plan mode status
plan_status = enter_plan_mode(memory)
print(f"Plan mode status: {plan_status}")

# Update product context
update_section(memory, "productContext", """
# Product Context

## Purpose
This product helps demonstrate the Memory Bank system.

## Target Users
- Developers
- AI Assistants
- Project Managers
""")

# Log a change
log_change(memory, "Added initial project documentation")

# Check plan mode again
plan_status = enter_plan_mode(memory)
print(f"Updated plan mode status: {plan_status}")

# Enter act mode
act_status = enter_act_mode(memory)
print(f"Act mode status: {act_status}")

# Export to markdown
export_path = export_markdown(memory)
print(f"Exported markdown files to {export_path}")
