/**
 * Integration tests for backward compatibility
 * Tests that the refactored code works with existing tasks.json files
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import stateStore from '../../scripts/modules/state-store.js';
import { execSync } from 'child_process';

// Test configuration
const TEST_DIR = path.join(process.cwd(), 'test-compatibility');
const LEGACY_TASKS_FILE = path.join(TEST_DIR, 'legacy-tasks.json');
const MODERN_TASKS_FILE = path.join(TEST_DIR, 'modern-tasks.json');

describe('Backward Compatibility', () => {
  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Create a legacy format tasks file (array of tasks)
    const legacyTasks = [
      {
        id: 1,
        title: 'Legacy Task 1',
        description: 'This is a task in the legacy format',
        status: 'pending',
        dependencies: []
      },
      {
        id: 2,
        title: 'Legacy Task 2',
        description: 'This is another task in the legacy format',
        status: 'done',
        dependencies: [1]
      }
    ];
    
    await fs.writeFile(LEGACY_TASKS_FILE, JSON.stringify(legacyTasks, null, 2));
    
    // Create a modern format tasks file (with meta object)
    const modernTasks = {
      meta: {
        projectName: 'Modern Project',
        version: '1.0.0',
        description: 'Project with modern format',
        totalTasksGenerated: 2,
        tasksIncluded: 2
      },
      tasks: [
        {
          id: 1,
          title: 'Modern Task 1',
          description: 'This is a task in the modern format',
          status: 'pending',
          dependencies: [],
          subtasks: [
            {
              id: 101,
              title: 'Subtask 1',
              status: 'pending'
            }
          ]
        },
        {
          id: 2,
          title: 'Modern Task 2',
          description: 'This is another task in the modern format',
          status: 'in-progress',
          dependencies: [1]
        }
      ]
    };
    
    await fs.writeFile(MODERN_TASKS_FILE, JSON.stringify(modernTasks, null, 2));
  });
  
  afterAll(async () => {
    // Clean up test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });
  
  test('should load legacy format tasks file', async () => {
    // Load the legacy tasks file
    const state = await stateStore.loadState(LEGACY_TASKS_FILE);
    
    // Verify the state was loaded correctly
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].title).toBe('Legacy Task 1');
    expect(state.tasks[1].title).toBe('Legacy Task 2');
    
    // Verify meta was created
    expect(state.meta).toBeDefined();
    expect(state.meta.totalTasksGenerated).toBe(2);
    expect(state.meta.tasksIncluded).toBe(2);
  });
  
  test('should load modern format tasks file', async () => {
    // Load the modern tasks file
    const state = await stateStore.loadState(MODERN_TASKS_FILE);
    
    // Verify the state was loaded correctly
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].title).toBe('Modern Task 1');
    expect(state.tasks[1].title).toBe('Modern Task 2');
    
    // Verify meta was preserved
    expect(state.meta).toBeDefined();
    expect(state.meta.projectName).toBe('Modern Project');
    expect(state.meta.totalTasksGenerated).toBe(2);
    
    // Verify subtasks were preserved
    expect(state.tasks[0].subtasks).toHaveLength(1);
    expect(state.tasks[0].subtasks[0].title).toBe('Subtask 1');
  });
  
  test('should persist state in compatible format', async () => {
    // Load the modern tasks file
    await stateStore.loadState(MODERN_TASKS_FILE);
    
    // Add a new task
    stateStore.addTask({
      title: 'New Task',
      description: 'This is a new task added through the state store'
    });
    
    // Persist the state to a new file
    const newTasksFile = path.join(TEST_DIR, 'new-tasks.json');
    await stateStore.persistState(newTasksFile);
    
    // Read the file directly
    const fileContent = await fs.readFile(newTasksFile, 'utf8');
    const parsedContent = JSON.parse(fileContent);
    
    // Verify the format is correct
    expect(parsedContent).toHaveProperty('meta');
    expect(parsedContent).toHaveProperty('tasks');
    expect(parsedContent.tasks).toHaveLength(3);
    expect(parsedContent.tasks[2].title).toBe('New Task');
    
    // Verify the file can be loaded again
    const reloadedState = await stateStore.loadState(newTasksFile);
    expect(reloadedState.tasks).toHaveLength(3);
  });
  
  test('CLI should work with legacy format', () => {
    // Run the list command with the legacy file
    const output = execSync(`node scripts/task-master.js list --file=${LEGACY_TASKS_FILE}`, {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    // Verify the output contains the legacy tasks
    expect(output).toContain('Legacy Task 1');
    expect(output).toContain('Legacy Task 2');
  });
  
  test('CLI should work with modern format', () => {
    // Run the list command with the modern file
    const output = execSync(`node scripts/task-master.js list --file=${MODERN_TASKS_FILE}`, {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    // Verify the output contains the modern tasks
    expect(output).toContain('Modern Task 1');
    expect(output).toContain('Modern Task 2');
  });
});
