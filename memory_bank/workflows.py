# memory_bank/workflows.py
from .sections import get_ready_sections

def enter_plan_mode(memory_manager):
    """Prepare for planning mode workflow"""
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
    """Prepare for action mode workflow"""
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
    """Review and update all memory bank files"""
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
