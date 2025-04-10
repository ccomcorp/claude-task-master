# memory_bank/exporters.py
import os
from pathlib import Path

def export_markdown(memory_manager, section_name=None):
    """Export memory section(s) to markdown files"""
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
                    progress_content = "# Project Progress\n\n"
                    if "history" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["history"], list):
                        for task in memory_manager.memory_state["tasks"]["history"]:
                            if isinstance(task, dict) and "progress" in task:
                                task_desc = task.get("description", "Task")
                                progress_content += f"## {task_desc}\n{task['progress']}\n\n"
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
                            f.write(f"# {section_name}\n\n*No content yet*")
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
                        progress_content = "# Project Progress\n\n"
                        if "history" in memory_manager.memory_state["tasks"] and isinstance(memory_manager.memory_state["tasks"]["history"], list):
                            for task in memory_manager.memory_state["tasks"]["history"]:
                                if isinstance(task, dict) and "progress" in task:
                                    task_desc = task.get("description", "Task")
                                    progress_content += f"## {task_desc}\n{task['progress']}\n\n"
                        f.write(progress_content)
                else:
                    # Export regular section - only if it's a dictionary with content
                    if isinstance(memory_manager.memory_state[name], dict):
                        md_file = memory_manager.memory_path / filename
                        with open(md_file, 'w') as f:
                            if "content" in memory_manager.memory_state[name]:
                                f.write(memory_manager.memory_state[name]["content"])
                            else:
                                f.write(f"# {name}\n\n*No content yet*")
        return memory_manager.memory_path

def import_markdown(memory_manager, section_name, file_path=None):
    """Import markdown content into a memory section"""
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
