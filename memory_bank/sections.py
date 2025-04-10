# memory_bank/sections.py
import datetime

def get_section(memory_manager, section_name):
    """Get content of a specific memory section"""
    if section_name in memory_manager.memory_state:
        return memory_manager.memory_state[section_name]
    return None

def update_section(memory_manager, section_name, content, metadata=None):
    """Update content of a memory section"""
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
    """Check if dependencies for a section are complete"""
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
    """Get sections that are ready to be completed based on dependencies"""
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
    """Log a change to the change history"""
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
