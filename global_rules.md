---
# ✅ Global Rules (`global_rules.md`) - v1.0

## 🎯 Core Objective
To assist in developing complex programming applications by maintaining continuous, accurate awareness of the project state, programming according to best practices without unnecessary simplification, and adaptively managing project documentation and rules using a structured, programmatic approach via the integrated Memory Bank system.

---

## 🔑 Key Operational Guidelines
1. **Primacy of Memory Bank:** The project state is authoritatively managed via the structured memory bank system. ALWAYS read `memory_bank_rules.md` at project start.
2. **MANDATORY Programmatic State Management:** All interactions with the memory bank must go through the `MemoryBankManager` API.
   - DO: `memory.get_section()`, `memory.update_section()`, `memory.log_change()`, etc.
   - DO NOT: use direct file I/O or manipulation of state files.
3. **Internal State First:** Changes happen first in memory, then are persisted with `memory.save_memory_state()`.
4. **Load on Start:** Memory must be loaded at init via `memory.load_memory_state()`.
5. **Save Strategically:** Save memory after a logical unit of work is complete.
6. **Schema Adherence:** All saved state must validate against defined schemas.
7. **Rule Consistency:** This file defines canonical rules; the memory bank reflects the dynamic project state.

---

## ✅ Behavior Policy (Execution Safety)
- Always look for existing code to iterate on before creating new code.
- Do not drastically change patterns before trying to iterate.
- Always kill old test/dev servers before starting a new one.
- Prefer simple solutions.
- Avoid duplicating logic—check for similar code.
- Respect different environments (dev, test, prod).
- Only make changes that are requested or clearly related.
- Don't introduce new technologies without exhausting the current implementation.
  - If you do, remove the old implementation.
- Keep the codebase clean and organized.
- Avoid one-off scripts in source files.
- Refactor files over 300 lines.
- Mock data only in tests—not in dev or prod.
- Never stub or fake data in live environments.
- Don't overwrite `.env` without confirmation.
- Focus only on relevant code.
- Do not touch unrelated parts of the codebase.
- Write thorough tests for all major functionality.
- Avoid major changes to working architecture unless explicitly instructed.
- Always consider other areas affected by your code changes.

---

## 🤖 Memory Bank API 
The full API details are in memory_bank_rules.md, but core functions include:
- `memory.init_memory_bank()`
- `memory.load_memory_state()`
- `memory.save_memory_state()`
- `memory.get_section(name)`
- `memory.update_section(name, content, metadata)`
- `memory.log_change(description, details)`
- `memory.check_dependencies_complete(name)`
- `memory.get_ready_sections()`
- `memory.enter_plan_mode()`
- `memory.enter_act_mode()`

For complete API reference, refer to memory_bank_rules.md.

---

## 🚦 Workflow Triggers & Sequences

### [Initiate]
- Load MemoryBankManager
- Run full project scan
- Populate memory sections using API
- Save memory state

### [Task Execution]
- Load memory state
- Enter plan or act mode
- Log task as current
- Update active context
- Perform task
- Document progress
- Update relevant sections of memory
- Save memory state

### [Update]
- Re-scan project
- Diff changes
- Apply updates via API
- Save new memory state

### [Plan Mode]
- Read entire Memory Bank
- Check for incomplete sections
- If sections incomplete: Create plan to complete them
- If all sections complete: Verify context, develop strategy

### [Act Mode]
- Check Memory Bank
- Update documentation
- Execute task
- Document changes
- Update Progress

---

## 🔐 File Safety
- Use Safe Save Protocol: validate → temp file → backup → atomic replace
- Avoid corrupting memory state by using only MemoryBankManager API
- Backups stored in memory-bank directory

---

## 📊 Standards and Enforcement
- Adhere to structure defined in memory_bank_rules.md
- Do not exceed 6000 characters in `global_rules.md` (AI memory limit)
- Memory history should be summarized regularly for recall

---

## 🧠 Memory Section Hierarchy
The memory bank consists of hierarchical sections that build on each other:

1. **Project Brief** → Foundation of all other sections
2. **Product Context** → Depends on Project Brief
3. **System Patterns** → Depends on Project Brief
4. **Tech Context** → Depends on Project Brief
5. **Active Context** → Depends on Product Context, System Patterns, Tech Context
6. **Progress** → Depends on Active Context

For complete details on each section, refer to memory_bank_rules.md.

---

## ✅ Final Note
This `global_rules.md` defines the behavioral framework the AI must follow at all times. The Memory Bank is the structured state system that maintains project context. ALWAYS refer to `memory_bank_rules.md` for complete memory bank specifications.
---
