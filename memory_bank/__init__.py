# memory_bank/__init__.py
"""
Memory Bank State Management System

A programmatic approach to maintaining project state with hierarchical memory sections,
inspired by Cursor's Memory Bank concept but implemented through a structured state 
management system.
"""

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
