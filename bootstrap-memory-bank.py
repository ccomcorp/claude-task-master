#!/usr/bin/env python3
"""
Bootstrap script for the Memory Bank system.

This script initializes the Memory Bank state system in a project directory,
creating the necessary files and directory structure.
"""

import os
import sys
import shutil
import json
from pathlib import Path
import datetime

def create_directory(path):
    """Create directory if it doesn't exist"""
    os.makedirs(path, exist_ok=True)
    print(f"Created directory: {path}")

def copy_file(source, destination):
    """Copy a file from source to destination"""
    shutil.copy2(source, destination)
    print(f"Copied {source} to {destination}")

def create_file(path, content):
    """Create a file with the given content"""
    with open(path, 'w') as f:
        f.write(content)
    print(f"Created file: {path}")

def bootstrap_memory_bank(project_path):
    """Bootstrap the Memory Bank system in the given project directory"""
    project_path = Path(project_path).resolve()
    source_dir = Path(__file__).parent
    
    print(f"\nBootstrapping Memory Bank State System in: {project_path}\n")
    
    # Create the memory-bank directory
    memory_bank_dir = project_path / "memory-bank"
    create_directory(memory_bank_dir)
    
    # Create initial memory state
    memory_state = {
        "metadata": {
            "created": datetime.datetime.now().isoformat(),
            "lastUpdated": datetime.datetime.now().isoformat(),
            "version": "1.0.0"
        },
        "projectInfo": {
            "name": os.path.basename(project_path),
            "description": "",
            "content": "",
            "status": "Not Started"
        },
        "productContext": {
            "content": "",
            "status": "Pending"
        },
        "systemPatterns": {
            "content": "",
            "status": "Pending"
        },
        "technologies": {
            "content": "",
            "items": [],
            "status": "Pending"
        },
        "tasks": {
            "current": {
                "description": "",
                "status": "Pending",
                "steps": [],
                "activeContext": ""
            },
            "history": []
        },
        "standards": {
            "content": "",
            "items": [],
            "status": "Pending"
        },
        "changeHistory": []
    }
    
    # Save initial memory state
    state_file = memory_bank_dir / "memory_state.json"
    with open(state_file, 'w') as f:
        json.dump(memory_state, f, indent=2)
    print(f"Created initial memory state: {state_file}")
    
    # Copy rules files
    files_to_copy = {
        "global-rules.md": "global_rules.md",
        "memory-bank-rules.md": "memory_bank_rules.md",
    }
    
    for src_name, dest_name in files_to_copy.items():
        src_file = source_dir / src_name
        dest_file = project_path / dest_name
        if src_file.exists():
            copy_file(src_file, dest_file)
        else:
            # Create the files with default content if source doesn't exist
            if src_name == "global-rules.md":
                create_file(dest_file, """---
# Global Rules (global_rules.md) - v1.0

## Core Objective
To assist in developing complex programming applications by maintaining continuous, accurate awareness of the project state, programming according to best practices without unnecessary simplification, and adaptively managing project documentation and rules using a structured, programmatic approach via the integrated Memory Bank system.

## Key Operational Guidelines
1. **Primacy of Memory Bank:** The project state is authoritatively managed via the structured memory bank system. ALWAYS read `memory_bank_rules.md` at project start.
2. **MANDATORY Programmatic State Management:** All interactions with the memory bank must go through the `MemoryBankManager` API.
3. **Internal State First:** Changes happen first in memory, then are persisted with `memory.save_memory_state()`.
4. **Load on Start:** Memory must be loaded at init via `memory.load_memory_state()`.
5. **Save Strategically:** Save memory after a logical unit of work is complete.

## Final Note
This `global_rules.md` defines the behavioral framework the AI must follow at all times. The Memory Bank is the structured state system that maintains project context. ALWAYS refer to `memory_bank_rules.md` for complete memory bank specifications.
---""")
            elif src_name == "memory-bank-rules.md":
                create_file(dest_file, """# Memory Bank Rules - v1.0

## Core Objective
To maintain continuous, accurate awareness of project state through a programmatic memory system that preserves hierarchical information structure, enabling AI assistants to maintain context between sessions.

## Key Principles
1. **State First:** The project's memory state is authoritatively managed via the structured JSON content within the memory state system.
2. **MANDATORY Programmatic Access:** All interactions with memory must go through the `MemoryBankManager` API.
3. **Hierarchical Structure:** Memory sections build upon each other in a defined order.
4. **Complete Context:** All memory sections must be read at project start.
5. **Schema Validation:** All state must conform to defined schemas.

## Memory Section Structure and Dependencies

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

## Final Note
The memory state is the authoritative source of project context, and it must be maintained with precision and completeness.""")
    
    # Create memory_bank package directory
    memory_bank_pkg_dir = project_path / "memory_bank"
    create_directory(memory_bank_pkg_dir)
    
    # Create Python implementation files
    create_sections_py(memory_bank_pkg_dir)
    create_workflows_py(memory_bank_pkg_dir)
    create_core_py(memory_bank_pkg_dir)
    create_exporters_py(memory_bank_pkg_dir)
    create_schemas_py(memory_bank_pkg_dir)
    create_init_py(memory_bank_pkg_dir)
    
    # Create examples directory
    examples_dir = project_path / "examples"
    create_directory(examples_dir)
    
    # Create example script
    create_example_py(examples_dir)
    
    # Create a starter script
    starter_script = project_path / "start_memory_bank.py"
    starter_content = """#!/usr/bin/env python3
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
"""
    create_file(starter_script, starter_content)
    
    print("\nMemory Bank system successfully bootstrapped!")
    print("\nNext Steps:")
    print("1. Update the project brief by running: python start_memory_bank.py")
    print("2. View the created markdown files in the memory-bank directory")
    print("3. See the example script in examples/basic_usage.py")
    print("\nThe Memory Bank state is stored in memory-bank/memory_state.json")

def create_core_py(dir_path):
    """Create core.py file"""
    content = """# memory_bank/core.py
import os
import json
import datetime
from pathlib import Path

class MemoryBankManager:
    \"\"\"Core Memory Bank State Manager\"\"\"
    
    def __init__(self, project_root="."):
        self.project_root = Path(project_root)
        self.memory_path = self.project_root / "memory-bank"
        self.memory_state = {}
        
        # Define section dependencies (which sections depend on which)
        self.section_dependencies = {
            "projectInfo": [],
            "productContext": ["projectInfo"],
            "systemPatterns": ["projectInfo"],
            "standards": ["systemPatterns"],
            "technologies": ["projectInfo"],
            "tasks": ["productContext", "systemPatterns", "technologies"],
            "changeHistory": []
        }
        
        self.init_memory_bank()
    
    def init_memory_bank(self):
        \"\"\"Initialize memory bank structure if it doesn't exist\"\"\"
        self.memory_path.mkdir(exist_ok=True)
        
        # Initialize the state file
        state_file = self.memory_path / "memory_state.json"
        if not state_file.exists():
            initial_state = {
                "metadata": {
                    "created": datetime.datetime.now().isoformat(),
                    "lastUpdated": datetime.datetime.now().isoformat(),
                    "version": "1.0.0"
                },
                "projectInfo": {
                    "name": os.path.basename(self.project_root),
                    "description": "",
                    "content": "",
                    "status": "Not Started"
                },
                "productContext": {
                    "content": "",
                    "status": "Pending"
                },
                "systemPatterns": {
                    "content": "",
                    "status": "Pending"
                },
                "technologies": {
                    "content": "",
                    "items": [],
                    "status": "Pending"
                },
                "tasks": {
                    "current": {
                        "description": "",
                        "status": "Pending",
                        "steps": [],
                        "activeContext": ""
                    },
                    "history": []
                },
                "standards": {
                    "content": "",
                    "items": [],
                    "status": "Pending"
                },
                "changeHistory": []
            }
            
            with open(state_file, 'w') as f:
                json.dump(initial_state, f, indent=2)
                
        self.load_memory_state()
    
    def load_memory_state(self):
        \"\"\"Load memory state from JSON file\"\"\"
        state_file = self.memory_path / "memory_state.json"
        try:
            with open(state_file, 'r') as f:
                self.memory_state = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # Handle corrupted or missing file
            self.init_memory_bank()
            
    def save_memory_state(self):
        \"\"\"Save memory state to JSON file\"\"\"
        self.memory_state["metadata"]["lastUpdated"] = datetime.datetime.now().isoformat()
        state_file = self.memory_path / "memory_state.json"
        
        # Save with backup
        if state_file.exists():
            backup_file = self.memory_path / "memory_state.backup.json"
            with open(state_file, 'r') as src:
                with open(backup_file, 'w') as dst:
                    dst.write(src.read())
        
        with open(state_file, 'w') as f:
            json.dump(self.memory_state, f, indent=2)
"""
    create_file(dir_path / "core.py", content)

def create_sections_py(dir_path):
    """Create sections.py file"""
    content = """# memory_bank/sections.py
import datetime

def get_section(memory_manager, section_name):
    \"\"\"Get content of a specific memory section\"\"\"
    if section_name in memory_manager.memory_state:
        return memory_manager.memory_state[section_name]
    return None

def update_section(memory_manager, section_name, content, metadata=None):
    \"\"\"Update content of a memory section\"\"\"
    if section_name in memory_manager.memory_state:
        if section_name == "projectInfo":
            # Handle projectInfo special case (maps to projectbrief.md)
            memory_manager.memory_state[section_name]["content"] = content
            if metadata:
                for key, value in metadata.items():
                    memory_manager.memory_state[section_name][key] = value
        elif section_name == "technologies":
            # Handle technologies special case (maps to techContext.md)
            memory_manager.memory_state[section_name]["content"] = content
        elif section_name == "tasks":
            # Handle tasks special case (active context)
            if metadata and "activeContext" in metadata:
                memory_manager.memory_state[section_name]["current"]["activeContext"] = metadata["activeContext"]
                
            if metadata and "progress" in metadata:
                # Log progress as a completed task
                task = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "description": metadata.get("description", "Task completed"),
                    "progress": metadata["progress"],
                    "status": "Completed"
                }
                memory_manager.memory_state[section_name]["history"].append(task)
        else:
            # Handle generic section - only if it's a dictionary
            if isinstance(memory_manager.memory_state[section_name], dict):
                memory_manager.memory_state[section_name]["content"] = content
            
        # Update status to complete - only if it's a dictionary with a status field
        if isinstance(memory_manager.memory_state[section_name], dict) and "status" in memory_manager.memory_state[section_name]:
            memory_manager.memory_state[section_name]["status"] = "Complete"
        
        memory_manager.save_memory_state()
        return True
    return False

def check_dependencies_complete(memory_manager, section_name):
    \"\"\"Check if dependencies for a section are complete\"\"\"
    if section_name in memory_manager.section_dependencies:
        dependencies = memory_manager.section_dependencies[section_name]
        for dep in dependencies:
            # Check if dependency exists in memory state
            if dep not in memory_manager.memory_state:
                return False
                
            # Skip dependencies that aren't dictionaries or don't have a status field
            if not isinstance(memory_manager.memory_state[dep], dict):
                continue
                
            if "status" not in memory_manager.memory_state[dep]:
                continue
                
            if memory_manager.memory_state[dep]["status"] != "Complete":
                return False
        return True
    return False

def get_ready_sections(memory_manager):
    \"\"\"Get sections that are ready to be completed based on dependencies\"\"\"
    ready_sections = []
    for section_name in memory_manager.section_dependencies:
        # Check if section exists in memory state
        if section_name not in memory_manager.memory_state:
            continue
            
        # Skip sections that aren't dictionaries
        if not isinstance(memory_manager.memory_state[section_name], dict):
            continue
            
        # Skip sections without a status field
        if "status" not in memory_manager.memory_state[section_name]:
            continue
            
        if memory_manager.memory_state[section_name]["status"] != "Complete":
            if check_dependencies_complete(memory_manager, section_name):
                ready_sections.append(section_name)
    return ready_sections

def log_change(memory_manager, description, details=None):
    \"\"\"Log a change to the change history\"\"\"
    change = {
        "timestamp": datetime.datetime.now().isoformat(),
        "description": description,
        "details": details or {}
    }
    
    # Ensure changeHistory exists and is a list
    if "changeHistory" not in memory_manager.memory_state:
        memory_manager.memory_state["changeHistory"] = []
    elif not isinstance(memory_manager.memory_state["changeHistory"], list):
        memory_manager.memory_state["changeHistory"] = []
    
    memory_manager.memory_state["changeHistory"].append(change)
    memory_manager.save_memory_state()
"""
    create_file(dir_path / "sections.py", content)

def create_workflows_py(dir_path):
    """Create workflows.py file"""
    content = """# memory_bank/workflows.py
from .sections import get_ready_sections

def enter_plan_mode(memory_manager):
    \"\"\"Prepare for planning mode workflow\"\"\"
    # Check incomplete sections
    incomplete_sections = []
    required_sections = ["projectInfo", "productContext", "systemPatterns", "technologies"]
    
    for name in required_sections:
        # Skip if section doesn't exist
        if name not in memory_manager.memory_state:
            incomplete_sections.append(name)
            continue
            
        # Skip sections that aren't dictionaries
        if not isinstance(memory_manager.memory_state[name], dict):
            incomplete_sections.append(name)
            continue
            
        # Skip sections without a status field
        if "status" not in memory_manager.memory_state[name]:
            incomplete_sections.append(name)
            continue
            
        if memory_manager.memory_state[name]["status"] != "Complete":
            incomplete_sections.append(name)
    
    # Get sections that are ready to work on based on dependencies
    ready_sections = get_ready_sections(memory_manager)
    
    return {
        "mode": "Plan",
        "incomplete_sections": incomplete_sections,
        "ready_sections": ready_sections,
        "all_complete": len(incomplete_sections) == 0
    }

def enter_act_mode(memory_manager):
    \"\"\"Prepare for action mode workflow\"\"\"
    # First check that all required sections exist
    all_sections_ready = True
    required_sections = ["projectInfo", "productContext", "technologies"]
    
    for name in required_sections:
        # Check if section exists
        if name not in memory_manager.memory_state:
            all_sections_ready = False
            continue
            
        # Check if section is a dictionary
        if not isinstance(memory_manager.memory_state[name], dict):
            all_sections_ready = False
            continue
            
        # Check if section has a status field
        if "status" not in memory_manager.memory_state[name]:
            all_sections_ready = False
            continue
            
        if memory_manager.memory_state[name]["status"] != "Complete":
            all_sections_ready = False
            
    # Get active context
    active_context = ""
    if "tasks" in memory_manager.memory_state and isinstance(memory_manager.memory_state["tasks"], dict):
        if "current" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["current"], dict):
            active_context = memory_manager.memory_state["tasks"]["current"].get("activeContext", "")
    
    # Get progress from history
    progress_items = []
    if "tasks" in memory_manager.memory_state and isinstance(memory_manager.memory_state["tasks"], dict):
        if "history" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["history"], list):
            for task in memory_manager.memory_state["tasks"]["history"]:
                if isinstance(task, dict) and "progress" in task:
                    progress_items.append(task["progress"])
    
    return {
        "mode": "Act",
        "all_ready": all_sections_ready,
        "active_context": active_context,
        "progress": progress_items
    }

def update_all_memory_bank(memory_manager):
    \"\"\"Review and update all memory bank files\"\"\"
    # Get current state of each section safely
    current_state = {}
    sections_to_check = [
        "projectInfo",   # projectbrief.md
        "productContext", # productContext.md
        "systemPatterns", # systemPatterns.md
        "technologies",   # techContext.md
        "standards"       # additional standards
    ]
    
    for name in sections_to_check:
        if name in memory_manager.memory_state and isinstance(memory_manager.memory_state[name], dict) and "status" in memory_manager.memory_state[name]:
            current_state[name] = memory_manager.memory_state[name]["status"]
        else:
            current_state[name] = "Unknown"
    
    # Check tasks section safely
    if "tasks" in memory_manager.memory_state and isinstance(memory_manager.memory_state["tasks"], dict):
        if "current" in memory_manager.memory_state["tasks"] and memory_manager.memory_state["tasks"]["current"]:
            current_state["tasks"] = "Active"
        else:
            current_state["tasks"] = "None"
    else:
        current_state["tasks"] = "Unknown"
    
    return {
        "action": "review_all",
        "sections": [
            "projectInfo",   # projectbrief.md
            "productContext", # productContext.md
            "systemPatterns", # systemPatterns.md
            "technologies",   # techContext.md
            "tasks",          # activeContext.md and progress.md
            "standards"       # additional standards
        ],
        "current_state": current_state
    }
"""
    create_file(dir_path / "workflows.py", content)

def create_exporters_py(dir_path):
    """Create exporters.py file"""
    content = """# memory_bank/exporters.py
import os
from pathlib import Path

def export_markdown(memory_manager, section_name=None):
    \"\"\"Export memory section(s) to markdown files\"\"\"
    mapping = {
        "projectInfo": "projectbrief.md",
        "productContext": "productContext.md",
        "systemPatterns": "systemPatterns.md",
        "technologies": "techContext.md",
        "tasks": "activeContext.md"  # We'll handle progress.md separately
    }
    
    if section_name:
        # Export a single section
        if section_name in memory_manager.memory_state:
            if section_name == "tasks" and isinstance(memory_manager.memory_state[section_name], dict):
                # Export activeContext
                md_file = memory_manager.memory_path / "activeContext.md"
                with open(md_file, 'w') as f:
                    if "current" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["current"], dict):
                        active_context = memory_manager.memory_state["tasks"]["current"].get("activeContext", "")
                        f.write(active_context)
                
                # Export progress
                md_file = memory_manager.memory_path / "progress.md"
                with open(md_file, 'w') as f:
                    progress_content = "# Project Progress\\n\\n"
                    if "history" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["history"], list):
                        for task in memory_manager.memory_state["tasks"]["history"]:
                            if isinstance(task, dict) and "progress" in task:
                                task_desc = task.get("description", "Task")
                                progress_content += f"## {task_desc}\\n{task['progress']}\\n\\n"
                    f.write(progress_content)
            else:
                # Export regular section - only if it's a dictionary with content
                if section_name in mapping and isinstance(memory_manager.memory_state[section_name], dict):
                    md_file = memory_manager.memory_path / mapping[section_name]
                    with open(md_file, 'w') as f:
                        section = memory_manager.memory_state[section_name]
                        if "content" in section:
                            f.write(section["content"])
                        else:
                            f.write(f"# {section_name}\\n\\n*No content yet*")
                return md_file
    else:
        # Export all sections
        for name, filename in mapping.items():
            if name in memory_manager.memory_state:
                if name == "tasks" and isinstance(memory_manager.memory_state[name], dict):
                    # Export activeContext
                    md_file = memory_manager.memory_path / "activeContext.md"
                    with open(md_file, 'w') as f:
                        if "current" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["current"], dict):
                            active_context = memory_manager.memory_state["tasks"]["current"].get("activeContext", "")
                            f.write(active_context)
                    
                    # Export progress
                    md_file = memory_manager.memory_path / "progress.md"
                    with open(md_file, 'w') as f:
                        progress_content = "# Project Progress\\n\\n"
                        if "history" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["history"], list):
                            for task in memory_manager.memory_state["tasks"]["history"]:
                                if isinstance(task, dict) and "progress" in task:
                                    task_desc = task.get("description", "Task")
                                    progress_content += f"## {task_desc}\\n{task['progress']}\\n\\n"
                        f.write(progress_content)
                else:
                    # Export regular section - only if it's a dictionary with content
                    if isinstance(memory_manager.memory_state[name], dict):
                        md_file = memory_manager.memory_path / filename
                        with open(md_file, 'w') as f:
                            if "content" in memory_manager.memory_state[name]:
                                f.write(memory_manager.memory_state[name]["content"])
                            else:
                                f.write(f"# {name}\\n\\n*No content yet*")
        return memory_manager.memory_path

def import_markdown(memory_manager, section_name, file_path=None):
    \"\"\"Import markdown content into a memory section\"\"\"
    mapping = {
        "projectbrief.md": "projectInfo",
        "productContext.md": "productContext",
        "systemPatterns.md": "systemPatterns",
        "techContext.md": "technologies",
        "activeContext.md": "tasks",
        "progress.md": "tasks"
    }
    
    if not file_path:
        # Try to derive file path from section name
        for md_file, section in mapping.items():
            if section == section_name:
                file_path = memory_manager.memory_path / md_file
                break
    
    if not file_path or not os.path.exists(file_path):
        return False
        
    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except:
        return False
    
    # Handle special case for activeContext.md and progress.md
    file_name = Path(file_path).name
    if file_name == "activeContext.md":
        if "tasks" in memory_manager.memory_state and isinstance(memory_manager.memory_state["tasks"], dict):
            if "current" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["current"], dict):
                memory_manager.memory_state["tasks"]["current"]["activeContext"] = content
                memory_manager.save_memory_state()
                return True
        return False
    elif file_name == "progress.md":
        # This is simplified - in real life you'd want more robust parsing
        if "tasks" in memory_manager.memory_state and isinstance(memory_manager.memory_state["tasks"], dict):
            if "current" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["current"], dict):
                memory_manager.memory_state["tasks"]["current"]["progress"] = content
                memory_manager.save_memory_state()
                return True
        return False
    
    # Handle regular sections
    if file_name in mapping:
        section_name = mapping[file_name]
        if section_name in memory_manager.memory_state and isinstance(memory_manager.memory_state[section_name], dict):
            memory_manager.memory_state[section_name]["content"] = content
            memory_manager.memory_state[section_name]["status"] = "Complete"
            memory_manager.save_memory_state()
            return True
    
    return False
"""
    create_file(dir_path / "exporters.py", content)

def create_schemas_py(dir_path):
    """Create schemas.py file"""
    content = """# memory_bank/schemas.py
\"\"\"
JSON schema definitions for the Memory Bank State Management System.
\"\"\"

# Base schema for the memory bank state
MEMORY_BANK_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Memory Bank State Schema",
    "type": "object",
    "required": ["metadata", "projectInfo", "productContext", "systemPatterns", "technologies", "tasks", "standards", "changeHistory"],
    "properties": {
        "metadata": {
            "type": "object",
            "required": ["created", "lastUpdated", "version"],
            "properties": {
                "created": {
                    "type": "string",
                    "format": "date-time",
                    "description": "When the memory bank was created"
                },
                "lastUpdated": {
                    "type": "string",
                    "format": "date-time",
                    "description": "When the memory bank was last updated"
                },
                "version": {
                    "type": "string",
                    "description": "Schema version"
                }
            }
        },
        "projectInfo": {
            "type": "object",
            "required": ["name", "description", "content", "status"],
            "properties": {
                "name": {"type": "string"},
                "description": {"type": "string"},
                "content": {"type": "string"},
                "status": {
                    "type": "string", 
                    "enum": ["Not Started", "Pending", "In Progress", "Complete"]
                }
            }
        },
        "productContext": {
            "type": "object",
            "required": ["content", "status"],
            "properties": {
                "content": {"type": "string"},
                "status": {
                    "type": "string", 
                    "enum": ["Not Started", "Pending", "In Progress", "Complete"]
                }
            }
        },
        "systemPatterns": {
            "type": "object",
            "required": ["content", "status"],
            "properties": {
                "content": {"type": "string"},
                "status": {
                    "type": "string", 
                    "enum": ["Not Started", "Pending", "In Progress", "Complete"]
                }
            }
        },
        "technologies": {
            "type": "object",
            "required": ["content", "items", "status"],
            "properties": {
                "content": {"type": "string"},
                "items": {"type": "array", "items": {"type": "object"}},
                "status": {
                    "type": "string", 
                    "enum": ["Not Started", "Pending", "In Progress", "Complete"]
                }
            }
        },
        "tasks": {
            "type": "object",
            "required": ["current", "history"],
            "properties": {
                "current": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "status": {"type": "string"},
                        "steps": {"type": "array", "items": {"type": "string"}},
                        "activeContext": {"type": "string"}
                    }
                },
                "history": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "timestamp": {"type": "string", "format": "date-time"},
                            "description": {"type": "string"},
                            "progress": {"type": "string"},
                            "status": {"type": "string"}
                        }
                    }
                }
            }
        },
        "standards": {
            "type": "object",
            "required": ["content", "items", "status"],
            "properties": {
                "content": {"type": "string"},
                "items": {"type": "array", "items": {"type": "object"}},
                "status": {
                    "type": "string", 
                    "enum": ["Not Started", "Pending", "In Progress", "Complete"]
                }
            }
        },
        "changeHistory": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["timestamp", "description"],
                "properties": {
                    "timestamp": {"type": "string", "format": "date-time"},
                    "description": {"type": "string"},
                    "details": {"type": "object"}
                }
            }
        }
    }
}
"""
    create_file(dir_path / "schemas.py", content)

def create_init_py(dir_path):
    """Create __init__.py file"""
    content = """# memory_bank/__init__.py
\"\"\"
Memory Bank State Management System

A programmatic approach to maintaining project state with hierarchical memory sections,
inspired by Cursor's Memory Bank concept but implemented through a structured state 
management system.
\"\"\"

from memory_bank.core import MemoryBankManager
from memory_bank.sections import (
    get_section, 
    update_section, 
    check_dependencies_complete, 
    get_ready_sections,
    log_change
)
from memory_bank.workflows import (
    enter_plan_mode,
    enter_act_mode,
    update_all_memory_bank
)
from memory_bank.exporters import (
    export_markdown,
    import_markdown
)

__version__ = '0.1.0'
"""
    create_file(dir_path / "__init__.py", content)

def create_example_py(dir_path):
    """Create example.py file"""
    content = """# examples/basic_usage.py
from memory_bank.core import MemoryBankManager
from memory_bank.sections import update_section, get_section, log_change
from memory_bank.workflows import enter_plan_mode, enter_act_mode
from memory_bank.exporters import export_markdown

# Initialize memory bank
memory = MemoryBankManager("./test_project")

# Update project brief
update_section(memory, "projectInfo", \"\"\"
# Project Brief: Example Project

## Objective
This is an example project to demonstrate the Memory Bank system.

## Key Requirements
- Show basic functionality
- Demonstrate workflow
- Provide a clear example
\"\"\", {"name": "Example Project", "description": "A demonstration project"})

# Check plan mode status
plan_status = enter_plan_mode(memory)
print(f"Plan mode status: {plan_status}")

# Update product context
update_section(memory, "productContext", \"\"\"
# Product Context

## Purpose
This product helps demonstrate the Memory Bank system.

## Target Users
- Developers
- AI Assistants
- Project Managers
\"\"\")

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
"""
    create_file(dir_path / "basic_usage.py", content)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        project_path = sys.argv[1]
    else:
        project_path = "."
    
    bootstrap_memory_bank(project_path)
