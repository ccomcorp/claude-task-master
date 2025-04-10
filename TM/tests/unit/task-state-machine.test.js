/**
 * Unit tests for the task state machine module
 */

import { jest } from '@jest/globals';
import taskStateMachine, {
  TASK_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  transition,
  getValidNextStatuses,
  isValidStatus
} from '../../scripts/modules/task-state-machine.js';

describe('Task State Machine', () => {
  describe('Task statuses', () => {
    test('should define all required task statuses', () => {
      expect(TASK_STATUSES).toHaveProperty('PENDING', 'pending');
      expect(TASK_STATUSES).toHaveProperty('IN_PROGRESS', 'in-progress');
      expect(TASK_STATUSES).toHaveProperty('REVIEW', 'review');
      expect(TASK_STATUSES).toHaveProperty('DONE', 'done');
      expect(TASK_STATUSES).toHaveProperty('DEFERRED', 'deferred');
    });
  });

  describe('Status transitions', () => {
    test('should define valid transitions for each status', () => {
      // Check that each status has defined transitions
      Object.values(TASK_STATUSES).forEach(status => {
        expect(STATUS_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(STATUS_TRANSITIONS[status])).toBe(true);
      });

      // Check specific transitions
      expect(STATUS_TRANSITIONS[TASK_STATUSES.PENDING]).toContain(TASK_STATUSES.IN_PROGRESS);
      expect(STATUS_TRANSITIONS[TASK_STATUSES.IN_PROGRESS]).toContain(TASK_STATUSES.REVIEW);
      expect(STATUS_TRANSITIONS[TASK_STATUSES.REVIEW]).toContain(TASK_STATUSES.DONE);
      expect(STATUS_TRANSITIONS[TASK_STATUSES.DONE]).toContain(TASK_STATUSES.PENDING);
      expect(STATUS_TRANSITIONS[TASK_STATUSES.DEFERRED]).toContain(TASK_STATUSES.PENDING);
    });
  });

  describe('canTransition', () => {
    test('should allow valid transitions', () => {
      expect(canTransition(TASK_STATUSES.PENDING, TASK_STATUSES.IN_PROGRESS)).toBe(true);
      expect(canTransition(TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.REVIEW)).toBe(true);
      expect(canTransition(TASK_STATUSES.REVIEW, TASK_STATUSES.DONE)).toBe(true);
      expect(canTransition(TASK_STATUSES.DONE, TASK_STATUSES.PENDING)).toBe(true);
      expect(canTransition(TASK_STATUSES.DEFERRED, TASK_STATUSES.PENDING)).toBe(true);
    });

    test('should disallow invalid transitions', () => {
      expect(canTransition(TASK_STATUSES.PENDING, 'invalid-status')).toBe(false);
      expect(canTransition(TASK_STATUSES.DONE, TASK_STATUSES.DEFERRED)).toBe(false);
      expect(canTransition('invalid-status', TASK_STATUSES.PENDING)).toBe(false);
    });

    test('should allow transition to same status', () => {
      Object.values(TASK_STATUSES).forEach(status => {
        expect(canTransition(status, status)).toBe(true);
      });
    });
  });

  describe('transition', () => {
    test('should update task status for valid transitions', () => {
      const task = { id: 1, title: 'Test Task', status: TASK_STATUSES.PENDING };
      const updatedTask = transition(task, TASK_STATUSES.IN_PROGRESS);

      expect(updatedTask).not.toBe(task); // Should return a new object
      expect(updatedTask.status).toBe(TASK_STATUSES.IN_PROGRESS);
      expect(updatedTask.statusUpdatedAt).toBeDefined();
    });

    test('should throw error for invalid transitions', () => {
      const task = { id: 1, title: 'Test Task', status: TASK_STATUSES.PENDING };
      
      expect(() => {
        transition(task, 'invalid-status');
      }).toThrow();
    });

    test('should preserve other task properties', () => {
      const task = {
        id: 1,
        title: 'Test Task',
        description: 'Task description',
        status: TASK_STATUSES.PENDING,
        dependencies: [2, 3],
        priority: 'high'
      };
      
      const updatedTask = transition(task, TASK_STATUSES.IN_PROGRESS);
      
      expect(updatedTask.id).toBe(task.id);
      expect(updatedTask.title).toBe(task.title);
      expect(updatedTask.description).toBe(task.description);
      expect(updatedTask.dependencies).toEqual(task.dependencies);
      expect(updatedTask.priority).toBe(task.priority);
    });
  });

  describe('getValidNextStatuses', () => {
    test('should return valid next statuses for a given status', () => {
      const pendingNextStatuses = getValidNextStatuses(TASK_STATUSES.PENDING);
      expect(pendingNextStatuses).toContain(TASK_STATUSES.IN_PROGRESS);
      expect(pendingNextStatuses).toContain(TASK_STATUSES.DEFERRED);
      
      const inProgressNextStatuses = getValidNextStatuses(TASK_STATUSES.IN_PROGRESS);
      expect(inProgressNextStatuses).toContain(TASK_STATUSES.REVIEW);
      expect(inProgressNextStatuses).toContain(TASK_STATUSES.PENDING);
    });

    test('should return empty array for invalid status', () => {
      expect(getValidNextStatuses('invalid-status')).toEqual([]);
    });
  });

  describe('isValidStatus', () => {
    test('should return true for valid statuses', () => {
      Object.values(TASK_STATUSES).forEach(status => {
        expect(isValidStatus(status)).toBe(true);
      });
    });

    test('should return false for invalid statuses', () => {
      expect(isValidStatus('invalid-status')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus(null)).toBe(false);
      expect(isValidStatus(undefined)).toBe(false);
    });
  });
});
