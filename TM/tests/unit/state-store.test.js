/**
 * Unit tests for the state store module
 */

import { jest } from '@jest/globals';
import stateStore, { TASK_STATUSES, STATUS_TRANSITIONS, STATE_EVENTS } from '../../scripts/modules/state-store.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  access: jest.fn(),
  stat: jest.fn(),
  copyFile: jest.fn(() => Promise.resolve()),
  rename: jest.fn(() => Promise.resolve())
}));

// Mock fs non-promise module used for exists checks
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false)
}));

describe('State Store', () => {
  beforeEach(() => {
    // Reset state before each test
    stateStore.setState({
      meta: {
        projectName: 'Test Project',
        version: '1.0.0'
      },
      tasks: []
    }, { silent: true, persist: false });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize the state store', async () => {
      // Mock the loadState method
      const loadStateSpy = jest.spyOn(stateStore, 'loadState').mockResolvedValue({
        meta: { projectName: 'Initialized Project' },
        tasks: [{ id: 1, title: 'Task 1' }]
      });

      // Mock event listener
      const initializedListener = jest.fn();
      stateStore.on(STATE_EVENTS.INITIALIZED, initializedListener);

      // Call initialize
      const result = await stateStore.initialize();

      // Verify loadState was called
      expect(loadStateSpy).toHaveBeenCalled();

      // Verify initialized event was emitted
      expect(initializedListener).toHaveBeenCalled();

      // Verify result contains the loaded state
      expect(result.meta.projectName).toBe('Initialized Project');
      expect(result.tasks).toHaveLength(1);

      // Clean up
      stateStore.off(STATE_EVENTS.INITIALIZED, initializedListener);
      loadStateSpy.mockRestore();
    });

    test('should handle initialization errors', async () => {
      // Mock loadState to throw an error
      const loadStateSpy = jest.spyOn(stateStore, 'loadState')
        .mockRejectedValue(new Error('Test error'));

      // Mock event listeners
      const errorListener = jest.fn();
      stateStore.on(STATE_EVENTS.ERROR, errorListener);

      // Call initialize and expect it to throw
      await expect(stateStore.initialize()).rejects.toThrow('Test error');

      // Verify error event was emitted
      expect(errorListener).toHaveBeenCalled();

      // Clean up
      stateStore.off(STATE_EVENTS.ERROR, errorListener);
      loadStateSpy.mockRestore();
    });
  });

  describe('Task management', () => {
    test('should add a task', () => {
      const taskData = {
        title: 'Test Task',
        description: 'This is a test task',
        status: TASK_STATUSES.PENDING
      };

      const task = stateStore.addTask(taskData, { persist: false });

      expect(task).toHaveProperty('id');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TASK_STATUSES.PENDING);

      const tasks = stateStore.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(task);
    });

    test('should get a task by ID', () => {
      const task1 = stateStore.addTask({ title: 'Task 1' }, { persist: false });
      const task2 = stateStore.addTask({ title: 'Task 2' }, { persist: false });

      const retrievedTask = stateStore.getTaskById(task1.id);

      expect(retrievedTask).toEqual(task1);
      expect(retrievedTask).not.toEqual(task2);
    });

    test('should update a task', () => {
      const task = stateStore.addTask({ title: 'Original Title' }, { persist: false });

      const updatedTask = stateStore.updateTask(task.id, {
        title: 'Updated Title',
        priority: 'high'
      }, { persist: false });

      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.priority).toBe('high');
      expect(updatedTask.id).toBe(task.id);

      const retrievedTask = stateStore.getTaskById(task.id);
      expect(retrievedTask).toEqual(updatedTask);
    });

    test('should remove a task', () => {
      const task = stateStore.addTask({ title: 'Task to Remove' }, { persist: false });

      const tasksBeforeRemoval = stateStore.getTasks();
      expect(tasksBeforeRemoval).toHaveLength(1);

      const result = stateStore.removeTask(task.id, { persist: false });
      expect(result).toBe(true);

      const tasksAfterRemoval = stateStore.getTasks();
      expect(tasksAfterRemoval).toHaveLength(0);

      const retrievedTask = stateStore.getTaskById(task.id);
      expect(retrievedTask).toBeNull();
    });
  });

  describe('Task status management', () => {
    test('should change task status with valid transition', () => {
      const task = stateStore.addTask({
        title: 'Status Test',
        status: TASK_STATUSES.PENDING
      }, { persist: false });

      const updatedTask = stateStore.setTaskStatus(
        task.id,
        TASK_STATUSES.IN_PROGRESS,
        { persist: false }
      );

      expect(updatedTask.status).toBe(TASK_STATUSES.IN_PROGRESS);

      const retrievedTask = stateStore.getTaskById(task.id);
      expect(retrievedTask.status).toBe(TASK_STATUSES.IN_PROGRESS);
    });

    test('should reject invalid status transitions', () => {
      const task = stateStore.addTask({
        title: 'Invalid Status Test',
        status: TASK_STATUSES.PENDING
      }, { persist: false });

      // PENDING -> DONE should not be valid according to STATUS_TRANSITIONS
      const result = stateStore.isValidStatusTransition(
        TASK_STATUSES.PENDING,
        TASK_STATUSES.DONE
      );

      expect(result).toBe(false);

      // The actual status change should fail
      const updatedTask = stateStore.setTaskStatus(
        task.id,
        TASK_STATUSES.DONE,
        { persist: false }
      );

      // Should return null for invalid status change
      expect(updatedTask).toBeNull();

      // The task status should not have changed
      const retrievedTask = stateStore.getTaskById(task.id);
      expect(retrievedTask.status).toBe(TASK_STATUSES.PENDING);
    });
  });

  describe('State persistence', () => {
    test('should load state from file', async () => {
      // Mock fs.readFile to return sample state
      const mockState = {
        meta: { projectName: 'Loaded Project' },
        tasks: [
          { id: 1, title: 'Loaded Task 1', status: TASK_STATUSES.PENDING },
          { id: 2, title: 'Loaded Task 2', status: TASK_STATUSES.DONE }
        ]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockState));

      await stateStore.loadState('mock/path/tasks.json');

      expect(fs.readFile).toHaveBeenCalledWith('mock/path/tasks.json', 'utf8');

      const loadedTasks = stateStore.getTasks();
      expect(loadedTasks).toHaveLength(2);
      expect(loadedTasks[0].title).toBe('Loaded Task 1');

      const meta = stateStore.getMeta();
      expect(meta.projectName).toBe('Loaded Project');
    });

    test('should persist state to file', async () => {
      // Set up state to persist
      stateStore.setState({
        meta: { projectName: 'Project to Save' },
        tasks: [{ id: 1, title: 'Task to Save' }]
      }, { persist: false });

      await stateStore.persistState('mock/path/tasks.json');

      // Should attempt to create directory
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname('mock/path/tasks.json'), { recursive: true });

      // Should write to a temp file
      expect(fs.writeFile).toHaveBeenCalledWith(
        'mock/path/tasks.json.temp',
        expect.any(String)
      );

      // Should rename temp file to actual file
      expect(fs.rename).toHaveBeenCalledWith(
        'mock/path/tasks.json.temp',
        'mock/path/tasks.json'
      );
    });
  });
});
