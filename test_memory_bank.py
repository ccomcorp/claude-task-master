#!/usr/bin/env python3
"""
Test script to verify the ability to retrieve and modify memory bank state.
"""

import os
import sys
from memory_bank.core import MemoryBankManager
from memory_bank.sections import get_section, update_section, log_change

def main():
    """Main test function"""
    print("Testing Memory Bank State access and modification...")
    
    # Initialize memory bank manager
    memory = MemoryBankManager()
    
    # Test retrieving sections
    print("\n--- Retrieving Sections ---")
    sections = ["projectInfo", "productContext", "systemPatterns", "technologies", "tasks", "standards"]
    
    for section in sections:
        data = get_section(memory, section)
        print(f"{section}: {data and 'Retrieved successfully' or 'Failed'}")
    
    # Test modifying sections
    print("\n--- Modifying Sections ---")
    
    # Update projectInfo
    projectInfo = get_section(memory, "projectInfo")
    print(f"Original project name: {projectInfo.get('name', 'Not set')}")
    
    update_section(memory, "projectInfo", 
                 "# Task Master State Management\n\nReplacing direct file operations with centralized state management.", 
                 {"name": "Task Master State", "description": "State management refactoring"})
    
    projectInfo = get_section(memory, "projectInfo")
    print(f"Updated project name: {projectInfo.get('name', 'Not set')}")
    
    # Update productContext
    print("\nUpdating productContext section...")
    update_section(memory, "productContext", 
                 "# Product Context\n\nTask Master needs to centralize state management instead of reading/writing to files directly.")
    
    # Update systemPatterns
    print("Updating systemPatterns section...")
    update_section(memory, "systemPatterns", 
                 "# System Patterns\n\nWill implement a state store pattern with centralized access/mutation via actions.")
    
    # Update technologies
    print("Updating technologies section...")
    update_section(memory, "technologies", 
                 "# Technologies\n\n- Node.js\n- JavaScript (ES Modules)")
    
    # Update tasks
    print("Updating tasks current context...")
    update_section(memory, "tasks", "", {"activeContext": "Evaluating the current code structure"})
    
    # Update standards
    print("Updating standards section...")
    update_section(memory, "standards", 
                 "# Standards\n\n- State transitions should be controlled\n- Backward compatibility is essential")
    
    # Log a change
    log_change(memory, "Tested memory bank modifications", {"test": "successful"})
    
    print("\nTest completed. Memory bank sections have been modified.")
    print("Check memory-bank/memory_state.json to verify changes.")

if __name__ == "__main__":
    main()
