/**
 * Unit tests for the actions module
 */

import { jest } from '@jest/globals';
import * as actions from '../../scripts/modules/actions.js';
import stateStore, { TASK_STATUSES } from '../../scripts/modules/state-store.js';

// Mock stateStore
jest.mock('../../scripts/modules/state-store.js', () => {
  const mockStore = {
    loadState: jest.fn(() => Promise.resolve({ tasks: [], meta: {} })),
    persistState: jest.fn(() => Promise.resolve(true)),
    addTask: jest.fn((taskData) => ({ id: 999, ...taskData })),
    updateTask: jest.fn((id, updates) => ({ id, ...updates })),
    removeTask: jest.fn(() => true),
    setTaskStatus: jest.fn((id, status) => ({ id, status })),
    getTaskById: jest.fn((id) => ({ id, title: 'Mock Task' })),
    getTasks: jest.fn(() => []),
    TASK_STATUSES: {
      PENDING: 'pending',
      IN_PROGRESS: 'in-progress',
      REVIEW: 'review',
      DONE: 'done',
      DEFERRED: 'deferred'
    }
  };
  
  mockStore.default = mockStore;
  return mockStore;
});

// Mock fs module for file operations in actions
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Promise.resolve('Mock PRD content')),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  access: jest.fn(() => Promise.resolve())
}));

describe('Actions Module', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('Task Management Actions', () => {
    test('loadTasks should call state store loadState', async () => {
      await actions.loadTasks('test/path.json');
      
      expect(stateStore.loadState).toHaveBeenCalledWith('test/path.json');
    });
    
    test('saveTasks should call state store persistState', async () => {
      await actions.saveTasks('test/path.json');
      
      expect(stateStore.persistState).toHaveBeenCalledWith('test/path.json');
    });
    
    test('addTask should validate and call state store', () => {
      const taskData = {
        title: 'Test Action Task',
        description: 'Task from action test'
      };
      
      const task = actions.addTask(taskData);
      
      expect(stateStore.addTask).toHaveBeenCalledWith(taskData, {});
      expect(task).toHaveProperty('id', 999);
    });
    
    test('addTask should throw error if title is missing', () => {
      expect(() => {
        actions.addTask({ description: 'Missing title' });
      }).toThrow('Task title is required');
    });
    
    test('updateTask should call state store', () => {
      const updates = {
        title: 'Updated Title',
        priority: 'high'
      };
      
      const task = actions.updateTask(123, updates);
      
      expect(stateStore.updateTask).toHaveBeenCalledWith(123, updates, {});
      expect(task).toHaveProperty('id', 123);
      expect(task).toHaveProperty('title', 'Updated Title');
    });
    
    test('setTaskStatus should validate status and call state store', () => {
      const task = actions.setTaskStatus(123, TASK_STATUSES.IN_PROGRESS);
      
      expect(stateStore.setTaskStatus).toHaveBeenCalledWith(
        123, 
        TASK_STATUSES.IN_PROGRESS,
        {}
      );
      expect(task).toHaveProperty('status', TASK_STATUSES.IN_PROGRESS);
    });
    
    test('setTaskStatus should throw error for invalid status', () => {
      expect(() => {
        actions.setTaskStatus(123, 'invalid-status');
      }).toThrow('Invalid status: invalid-status');
    });
    
    test('removeTask should call state store', () => {
      const result = actions.removeTask(123);
      
      expect(stateStore.removeTask).toHaveBeenCalledWith(123, {});
      expect(result).toBe(true);
    });
  });
  
  describe('Subtask Actions', () => {
    test('addSubtask should call state store updateTask', () => {
      stateStore.getTaskById.mockReturnValueOnce({
        id: 123,
        title: 'Parent Task',
        subtasks: []
      });
      
      const subtaskData = {
        title: 'Subtask Title',
        status: TASK_STATUSES.PENDING
      };
      
      actions.addSubtask(123, subtaskData);
      
      expect(stateStore.getTaskById).toHaveBeenCalledWith(123);
      expect(stateStore.updateTask).toHaveBeenCalled();
    });
    
    test('removeSubtask should call state store updateTask', () => {
      stateStore.getTaskById.mockReturnValueOnce({
        id: 123,
        title: 'Parent Task',
        subtasks: [
          { id: 'sub-1', title: 'Subtask 1' },
          { id: 'sub-2', title: 'Subtask 2' }
        ]
      });
      
      actions.removeSubtask(123, 'sub-1');
      
      expect(stateStore.getTaskById).toHaveBeenCalledWith(123);
      expect(stateStore.updateTask).toHaveBeenCalled();
    });
  });
  
  describe('Dependency Actions', () => {
    test('addDependency should call state store getTaskById and updateTask', () => {
      stateStore.getTaskById
        .mockReturnValueOnce({ id: 123, dependencies: [] })  // Task
        .mockReturnValueOnce({ id: 456 });                  // Dependency task
      
      actions.addDependency(123, 456);
      
      expect(stateStore.getTaskById).toHaveBeenCalledWith(123);
      expect(stateStore.getTaskById).toHaveBeenCalledWith(456);
      expect(stateStore.updateTask).toHaveBeenCalled();
    });
    
    test('removeDependency should call state store getTaskById and updateTask', () => {
      stateStore.getTaskById.mockReturnValueOnce({
        id: 123,
        dependencies: [456, 789]
      });
      
      actions.removeDependency(123, 456);
      
      expect(stateStore.getTaskById).toHaveBeenCalledWith(123);
      expect(stateStore.updateTask).toHaveBeenCalled();
    });
  });
  
  describe('Task Utility Actions', () => {
    test('fileExists should resolve true when file exists', async () => {
      // Mock fs.access to resolve (file exists)
      const fs = require('fs/promises');
      fs.access.mockResolvedValue(undefined);
      
      const exists = await actions.fileExists('existing-file.txt');
      
      expect(exists).toBe(true);
    });
    
    test('fileExists should resolve false when file does not exist', async () => {
      // Mock fs.access to reject (file doesn't exist)
      const fs = require('fs/promises');
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      const exists = await actions.fileExists('non-existing-file.txt');
      
      expect(exists).toBe(false);
    });
  });
});
