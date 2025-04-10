# memory_bank/core.py
import os
import json
import datetime
from pathlib import Path

class MemoryBankManager:
    """Core Memory Bank State Manager"""
    
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
        """Initialize memory bank structure if it doesn't exist"""
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
        """Load memory state from JSON file"""
        state_file = self.memory_path / "memory_state.json"
        try:
            with open(state_file, 'r') as f:
                self.memory_state = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # Handle corrupted or missing file
            self.init_memory_bank()
            
    def save_memory_state(self):
        """Save memory state to JSON file"""
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
