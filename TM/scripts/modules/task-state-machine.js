/**
 * Task State Machine Module
 * 
 * Defines the state machine for task status transitions.
 * Formalizes what statuses a task can be in and how they can change,
 * preventing invalid or illogical state transitions.
 */

import { log } from './utils.js';

/**
 * Valid task statuses
 */
export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  REVIEW: 'review',
  DONE: 'done',
  DEFERRED: 'deferred'
};

/**
 * State transition definition for task statuses
 * Each status can only transition to specific other statuses
 */
export const STATUS_TRANSITIONS = {
  [TASK_STATUSES.PENDING]: [
    TASK_STATUSES.IN_PROGRESS, 
    TASK_STATUSES.DONE, 
    TASK_STATUSES.DEFERRED
  ],
  [TASK_STATUSES.IN_PROGRESS]: [
    TASK_STATUSES.REVIEW, 
    TASK_STATUSES.DONE, 
    TASK_STATUSES.PENDING, 
    TASK_STATUSES.DEFERRED
  ],
  [TASK_STATUSES.REVIEW]: [
    TASK_STATUSES.DONE, 
    TASK_STATUSES.IN_PROGRESS, 
    TASK_STATUSES.PENDING
  ],
  [TASK_STATUSES.DONE]: [
    TASK_STATUSES.PENDING, 
    TASK_STATUSES.REVIEW
  ],
  [TASK_STATUSES.DEFERRED]: [
    TASK_STATUSES.PENDING, 
    TASK_STATUSES.IN_PROGRESS
  ]
};

/**
 * Check if a status transition is valid
 * @param {string} fromStatus Current status
 * @param {string} toStatus Target status
 * @returns {boolean} True if transition is valid
 */
export function canTransition(fromStatus, toStatus) {
  // Allow same status (no change)
  if (fromStatus === toStatus) return true;

  // Check if target status exists in allowed transitions
  if (!STATUS_TRANSITIONS[fromStatus]) return false;

  return STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

/**
 * Perform a status transition on a task
 * @param {Object} task Task object
 * @param {string} newStatus New status
 * @returns {Object} Updated task with new status
 * @throws {Error} If transition is invalid
 */
export function transition(task, newStatus) {
  const currentStatus = task.status;
  
  if (!canTransition(currentStatus, newStatus)) {
    const errorMessage = `Invalid status transition: ${currentStatus} -> ${newStatus}`;
    log(errorMessage, 'error');
    throw new Error(errorMessage);
  }
  
  // Return a new task object with updated status
  return {
    ...task,
    status: newStatus,
    statusUpdatedAt: new Date().toISOString()
  };
}

/**
 * Get valid next statuses for a given status
 * @param {string} currentStatus Current status
 * @returns {Array<string>} Array of valid next statuses
 */
export function getValidNextStatuses(currentStatus) {
  if (!STATUS_TRANSITIONS[currentStatus]) {
    return [];
  }
  
  return [...STATUS_TRANSITIONS[currentStatus]];
}

/**
 * Check if a status is valid
 * @param {string} status Status to check
 * @returns {boolean} True if status is valid
 */
export function isValidStatus(status) {
  return Object.values(TASK_STATUSES).includes(status);
}

/**
 * Get all valid statuses
 * @returns {Array<string>} Array of all valid statuses
 */
export function getAllStatuses() {
  return Object.values(TASK_STATUSES);
}

// Export a default object with all functions
export default {
  TASK_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  transition,
  getValidNextStatuses,
  isValidStatus,
  getAllStatuses
};
