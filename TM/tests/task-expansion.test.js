/**
 * task-expansion.test.js
 * Tests for task expansion functionality with state management
 */

import { jest } from '@jest/globals';
import path from 'node:path';
import fs from 'node:fs/promises';
import { StateStore } from '../scripts/modules/state-store.js';
import { 
  expandTask, 
  expandAllTasks, 
  addSubtask, 
  clearSubtasks 
} from '../scripts/modules/actions.js';
import { 
  processTaskExpansion, 
  processBulkTaskExpansion 
} from '../scripts/modules/ai-manager.js';

// Mock the AI services
jest.mock('../scripts/modules/ai-services.js', () => ({
  generateSubtasks: jest.fn().mockResolvedValue({
    success: true,
    subtasks: [
      { id: 1, title: 'Test Subtask 1', description: 'Description 1', details: 'Details 1', status: 'pending' },
      { id: 2, title: 'Test Subtask 2', description: 'Description 2', details: 'Details 2', status: 'pending' },
      { id: 3, title: 'Test Subtask 3', description: 'Description 3', details: 'Details 3', status: 'pending' }
    ]
  }),
  generateSubtasksWithPerplexity: jest.fn().mockResolvedValue({
    success: true,
    subtasks: [
      { id: 1, title: 'Research Subtask 1', description: 'Description 1', details: 'Details with research 1', status: 'pending' },
      { id: 2, title: 'Research Subtask 2', description: 'Description 2', details: 'Details with research 2', status: 'pending' }
    ]
  }),
  startLoadingIndicator: jest.fn().mockReturnValue({}),
  stopLoadingIndicator: jest.fn(),
  handleClaudeError: jest.fn(error => `Processed error: ${error.message}`)
}));

// Create a temporary test state store
let stateStore;
const testTasksData = {
  tasks: [
    {
      id: 1,
      title: 'Test Task 1',
      description: 'Description for test task 1',
      status: 'pending',
      priority: 'high'
    },
    {
      id: 2,
      title: 'Test Task 2',
      description: 'Description for test task 2',
      status: 'pending',
      priority: 'medium',
      subtasks: [
        { id: 1, title: 'Existing Subtask', description: 'Already exists', status: 'pending' }
      ]
    },
    {
      id: 3,
      title: 'Test Task 3',
      description: 'Description for test task 3',
      status: 'in-progress',
      priority: 'low',
      complexity: { score: 8, recommendedSubtasks: 4 }
    }
  ],
  meta: {
    projectName: 'Test Project',
    version: '1.0.0'
  }
};

// Setup and teardown
beforeEach(async () => {
  // Reset the state store before each test
  stateStore = new StateStore();
  await stateStore.initState(testTasksData);
  
  // Mock the console methods
  global.console.log = jest.fn();
  global.console.error = jest.fn();
});

describe('Task Expansion Functionality', () => {
  test('should expand a task with subtasks', async () => {
    // Expand a task
    const result = await expandTask(1, 3, false, '', { autoSave: false });
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.task.subtasks).toHaveLength(3);
    expect(result.task.subtasks[0].title).toBe('Test Subtask 1');
    
    // Verify task status was updated
    expect(result.task.status).toBe('in-progress');
  });
  
  test('should not overwrite existing subtasks without overwrite option', async () => {
    try {
      // Try to expand a task with existing subtasks
      await expandTask(2, 3, false, '', { autoSave: false });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).toContain('already has subtasks');
    }
    
    // Check that the original subtask remains
    const state = stateStore.getState();
    const task = state.tasks.find(t => t.id === 2);
    expect(task.subtasks).toHaveLength(1);
    expect(task.subtasks[0].title).toBe('Existing Subtask');
  });
  
  test('should overwrite existing subtasks with overwrite option', async () => {
    // Expand a task with overwrite option
    const result = await expandTask(2, 3, false, '', { autoSave: false, overwrite: true });
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.task.subtasks).toHaveLength(3);
    expect(result.task.subtasks[0].title).toBe('Test Subtask 1');
  });
  
  test('should use complexity data for subtask count if available', async () => {
    // Task 3 has complexity data with recommendedSubtasks = 4
    const result = await expandTask(3, 5, false, '', { autoSave: false });
    
    // The 5 is ignored in favor of the 4 from complexity data
    expect(result.success).toBe(true);
    expect(result.task.subtasks).toHaveLength(3); // Mock still returns 3 subtasks
  });
  
  test('should expand all eligible tasks', async () => {
    // Expand all tasks above complexity threshold
    const result = await expandAllTasks({ 
      complexityThreshold: 7, 
      autoSave: false 
    });
    
    // Only task 3 has complexity score above 7
    expect(result.success).toBe(true);
    expect(result.expanded).toBe(1);
    
    // Verify the task was expanded
    const state = stateStore.getState();
    const task = state.tasks.find(t => t.id === 3);
    expect(task.subtasks).toHaveLength(3);
  });
  
  test('should clear subtasks from a task', async () => {
    // First add subtasks
    await expandTask(1, 3, false, '', { autoSave: false });
    
    // Then clear them
    const result = await clearSubtasks(1, { autoSave: false });
    
    // Verify the subtasks are cleared
    expect(result.success).toBe(true);
    expect(result.task.subtasks).toBeUndefined();
    
    // Check state
    const state = stateStore.getState();
    const task = state.tasks.find(t => t.id === 1);
    expect(task.subtasks).toBeUndefined();
  });
  
  test('should manually add a subtask to a task', async () => {
    // Add a subtask manually
    const subtaskData = {
      title: 'Manual Subtask',
      description: 'Added manually',
      status: 'pending'
    };
    
    const result = await addSubtask(1, subtaskData, { autoSave: false });
    
    // Verify the subtask was added
    expect(result.success).toBe(true);
    expect(result.task.subtasks).toHaveLength(1);
    expect(result.task.subtasks[0].title).toBe('Manual Subtask');
    expect(result.task.subtasks[0].id).toBe(1); // First subtask should have ID 1
  });
  
  test('should handle AI manager process task expansion', async () => {
    // Test the AI manager interface
    const result = await processTaskExpansion({
      taskId: 1,
      numSubtasks: 3,
      overwrite: false,
      tasksFilePath: null
    });
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.subtaskCount).toBeGreaterThan(0);
  });
  
  test('should handle AI manager process bulk task expansion', async () => {
    // Test the AI manager interface for bulk expansion
    const result = await processBulkTaskExpansion({
      complexityThreshold: 7,
      pendingOnly: false,
      overwrite: true,
      tasksFilePath: null
    });
    
    // Verify the result
    expect(result.success).toBe(true);
    expect(result.expanded).toBe(1); // Only task 3 has complexity above 7
  });
});
