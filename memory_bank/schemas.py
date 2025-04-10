# memory_bank/schemas.py
"""
JSON schema definitions for the Memory Bank State Management System.
"""

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
