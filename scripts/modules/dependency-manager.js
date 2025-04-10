/**
 * dependency-manager.js
 * Manages task dependencies and relationships
 * Refactored to use centralized state management
 */

import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';
import { Anthropic } from '@anthropic-ai/sdk';

import { 
  log,
  formatTaskId,
  findCycles
} from './utils.js';

import { displayBanner } from './ui.js';
import stateStore from './state-store.js';
import * as actions from './actions.js';

// Initialize Anthropic client if API key is available
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

/**
 * Check if a task exists in the state
 * @param {number|string} taskId Task or subtask ID
 * @returns {boolean} True if task exists
 */
function taskExistsInState(taskId) {
  const tasks = stateStore.getTasks();
  
  // Format the ID
  const formattedId = formatTaskId(taskId);
  
  // Check if it's a subtask ID (contains a dot)
  if (typeof formattedId === 'string' && formattedId.includes('.')) {
    const [parentId, subtaskId] = formattedId.split('.').map(id => Number.parseInt(id, 10));
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (!parentTask || !parentTask.subtasks) {
      return false;
    }
    
    return parentTask.subtasks.some(s => s.id === subtaskId);
  }
  
  // Regular task ID
  return tasks.some(t => t.id === formattedId);
}

/**
 * Find a task or subtask by ID in the state
 * @param {number|string} taskId Task or subtask ID
 * @returns {Object|null} Task object or null if not found
 */
function findTaskInState(taskId) {
  const tasks = stateStore.getTasks();
  
  // Format the ID
  const formattedId = formatTaskId(taskId);
  
  // Check if it's a subtask ID (contains a dot)
  if (typeof formattedId === 'string' && formattedId.includes('.')) {
    const [parentId, subtaskId] = formattedId.split('.').map(id => Number.parseInt(id, 10));
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (!parentTask || !parentTask.subtasks) {
      return null;
    }
    
    const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
    if (!subtask) {
      return null;
    }
    
    return {
      ...subtask,
      parentTaskId: parentId,
      isSubtask: true
    };
  }
  
  // Regular task ID
  return tasks.find(t => t.id === formattedId) || null;
}

/**
 * Add a dependency to a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - ID of the task to add dependency to
 * @param {number|string} dependencyId - ID of the task to add as dependency
 */
async function addDependency(tasksPath, taskId, dependencyId) {
  log('info', `Adding dependency ${dependencyId} to task ${taskId}...`);
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Format the task and dependency IDs correctly
    const formattedTaskId = formatTaskId(taskId);
    const formattedDependencyId = formatTaskId(dependencyId);
    
    // Check if the dependency task or subtask actually exists
    if (!taskExistsInState(formattedDependencyId)) {
      throw new Error(`Dependency target ${formattedDependencyId} does not exist`);
    }
    
    // Check if the task is trying to depend on itself
    if (String(formattedTaskId) === String(formattedDependencyId)) {
      throw new Error(`Task ${formattedTaskId} cannot depend on itself`);
    }
    
    // Find the task to update
    const isSubtask = typeof formattedTaskId === 'string' && formattedTaskId.includes('.');
    
    if (isSubtask) {
      // Handle dot notation for subtasks (e.g., "1.2")
      const [parentId, subtaskId] = formattedTaskId.split('.').map(id => Number.parseInt(id, 10));
      const parentTask = stateStore.getTaskById(parentId);
      
      if (!parentTask) {
        throw new Error(`Parent task ${parentId} not found`);
      }
      
      if (!parentTask.subtasks) {
        throw new Error(`Parent task ${parentId} has no subtasks`);
      }
      
      const targetSubtask = parentTask.subtasks.find(s => s.id === subtaskId);
      
      if (!targetSubtask) {
        throw new Error(`Subtask ${formattedTaskId} not found`);
      }
      
      // Check for circular dependencies
      const dependencyChain = [formattedTaskId];
      if (isCircularDependency(stateStore.getTasks(), formattedDependencyId, dependencyChain)) {
        throw new Error('Adding this dependency would create a circular dependency chain');
      }
      
      // Initialize dependencies array if it doesn't exist
      const dependencies = targetSubtask.dependencies || [];
      
      // Check if dependency already exists
      if (dependencies.some(d => String(d) === String(formattedDependencyId))) {
        log('warn', `Dependency ${formattedDependencyId} already exists in subtask ${formattedTaskId}`);
        return;
      }
      
      // Add dependency to subtask
      const updatedDependencies = [...dependencies, formattedDependencyId];
      
      // Sort dependencies
      updatedDependencies.sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return a - b;
        }
        if (typeof a === 'string' && typeof b === 'string') {
          const [aParent, aChild] = a.split('.').map(Number);
          const [bParent, bChild] = b.split('.').map(Number);
          return aParent !== bParent ? aParent - bParent : aChild - bChild;
        }
        return String(a).localeCompare(String(b));
      });
      
      // Update subtask in parent task
      const updatedSubtasks = [...parentTask.subtasks];
      const subtaskIndex = updatedSubtasks.findIndex(s => s.id === subtaskId);
      updatedSubtasks[subtaskIndex] = {
        ...targetSubtask,
        dependencies: updatedDependencies
      };
      
      // Update parent task
      await actions.updateTask(parentId, { subtasks: updatedSubtasks });
      
      log('success', `Dependency ${formattedDependencyId} added to subtask ${formattedTaskId}`);
    } else {
      // Use the addDependency action for regular tasks
      await actions.addDependency(formattedTaskId, formattedDependencyId);
    }
    
    // Validate and fix dependencies after adding
    await validateAndFixDependencies(null, tasksPath);
    
  } catch (error) {
    log('error', `Failed to add dependency: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a dependency from a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} taskId - ID of the task to remove dependency from
 * @param {number|string} dependencyId - ID of the task to remove as dependency
 */
async function removeDependency(tasksPath, taskId, dependencyId) {
  log('info', `Removing dependency ${dependencyId} from task ${taskId}...`);
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Format the task and dependency IDs correctly
    const formattedTaskId = formatTaskId(taskId);
    const formattedDependencyId = formatTaskId(dependencyId);
    
    // Find the task to update
    const isSubtask = typeof formattedTaskId === 'string' && formattedTaskId.includes('.');
    
    if (isSubtask) {
      // Handle dot notation for subtasks (e.g., "1.2")
      const [parentId, subtaskId] = formattedTaskId.split('.').map(id => Number.parseInt(id, 10));
      const parentTask = stateStore.getTaskById(parentId);
      
      if (!parentTask) {
        throw new Error(`Parent task ${parentId} not found`);
      }
      
      if (!parentTask.subtasks) {
        throw new Error(`Parent task ${parentId} has no subtasks`);
      }
      
      const targetSubtask = parentTask.subtasks.find(s => s.id === subtaskId);
      
      if (!targetSubtask) {
        throw new Error(`Subtask ${formattedTaskId} not found`);
      }
      
      // Check if subtask has dependencies
      if (!targetSubtask.dependencies || !targetSubtask.dependencies.length) {
        log('warn', `Subtask ${formattedTaskId} has no dependencies`);
        return;
      }
      
      // Check if dependency exists
      if (!targetSubtask.dependencies.some(d => String(d) === String(formattedDependencyId))) {
        log('warn', `Dependency ${formattedDependencyId} not found in subtask ${formattedTaskId}`);
        return;
      }
      
      // Remove dependency from subtask
      const updatedDependencies = targetSubtask.dependencies.filter(
        d => String(d) !== String(formattedDependencyId)
      );
      
      // Update subtask in parent task
      const updatedSubtasks = [...parentTask.subtasks];
      const subtaskIndex = updatedSubtasks.findIndex(s => s.id === subtaskId);
      updatedSubtasks[subtaskIndex] = {
        ...targetSubtask,
        dependencies: updatedDependencies
      };
      
      // Update parent task
      await actions.updateTask(parentId, { subtasks: updatedSubtasks });
      
      log('success', `Dependency ${formattedDependencyId} removed from subtask ${formattedTaskId}`);
    } else {
      // Use the removeDependency action for regular tasks
      await actions.removeDependency(formattedTaskId, formattedDependencyId);
    }
    
  } catch (error) {
    log('error', `Failed to remove dependency: ${error.message}`);
    throw error;
  }
}

/**
 * Check if adding a dependency would create a circular dependency
 * @param {Array} tasks - Array of all tasks
 * @param {number|string} taskId - ID of task to check
 * @param {Array} chain - Chain of dependencies to check
 * @returns {boolean} True if circular dependency would be created
 */
function isCircularDependency(tasks, taskId, chain = []) {
  // Format the task ID
  const formattedTaskId = formatTaskId(taskId);
  
  // If the task ID is already in the chain, we have a circular dependency
  if (chain.some(id => String(id) === String(formattedTaskId))) {
    return true;
  }
  
  // Find the task
  const task = findTaskInState(formattedTaskId);
  
  if (!task) {
    return false;
  }
  
  // If the task has no dependencies, there's no circular dependency
  if (!task.dependencies || !task.dependencies.length) {
    return false;
  }
  
  // Check each dependency
  for (const depId of task.dependencies) {
    // Create a new chain with the current task ID
    const newChain = [...chain, formattedTaskId];
    
    // Recursively check for circular dependencies
    if (isCircularDependency(tasks, depId, newChain)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate task dependencies
 * @param {Array} tasks - Array of all tasks
 * @returns {Object} Validation result with valid flag and issues array
 */
function validateTaskDependencies(tasks) {
  const issues = [];
  
  // Create a map of task IDs for quick reference
  const taskMap = new Map();
  for (const task of tasks) {
    taskMap.set(task.id, task);
    
    // Also map subtasks if they exist
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        taskMap.set(`${task.id}.${subtask.id}`, subtask);
      }
    }
  }
  
  // Check each task's dependencies
  for (const task of tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        // Check if dependency exists
        if (!taskExistsInState(depId)) {
          issues.push({
            taskId: task.id,
            type: 'missing_dependency',
            message: `Task ${task.id} depends on non-existent task ${depId}`
          });
        }
        
        // Check for self-dependency
        if (String(depId) === String(task.id)) {
          issues.push({
            taskId: task.id,
            type: 'self_dependency',
            message: `Task ${task.id} depends on itself`
          });
        }
      }
    }
    
    // Check each subtask's dependencies
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        if (subtask.dependencies && subtask.dependencies.length > 0) {
          for (const depId of subtask.dependencies) {
            // Check if dependency exists
            if (!taskExistsInState(depId)) {
              issues.push({
                taskId: `${task.id}.${subtask.id}`,
                type: 'missing_dependency',
                message: `Subtask ${task.id}.${subtask.id} depends on non-existent task/subtask ${depId}`
              });
            }
            
            // Check for self-dependency
            if (String(depId) === String(`${task.id}.${subtask.id}`)) {
              issues.push({
                taskId: `${task.id}.${subtask.id}`,
                type: 'self_dependency',
                message: `Subtask ${task.id}.${subtask.id} depends on itself`
              });
            }
          }
        }
      }
    }
  }
  
  // Check for circular dependencies
  const cycles = findCycles(tasks);
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      issues.push({
        taskId: cycle[0],
        type: 'circular_dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`
      });
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Remove duplicate dependencies from tasks
 * @param {Object} tasksData - Tasks data object with tasks array
 * @returns {Object} Updated tasks data with duplicates removed
 */
function removeDuplicateDependencies(tasksData) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    return tasksData;
  }
  
  const updatedTasks = tasksData.tasks.map(task => {
    // Handle task dependencies
    if (task.dependencies) {
      task.dependencies = [...new Set(task.dependencies)];
    }
    
    // Handle subtask dependencies
    if (task.subtasks) {
      task.subtasks = task.subtasks.map(subtask => {
        if (subtask.dependencies) {
          subtask.dependencies = [...new Set(subtask.dependencies)];
        }
        return subtask;
      });
    }
    
    return task;
  });
  
  return {
    ...tasksData,
    tasks: updatedTasks
  };
}

/**
 * Clean up invalid subtask dependencies
 * @param {Object} tasksData - Tasks data object with tasks array
 * @returns {Object} Updated tasks data with invalid subtask dependencies removed
 */
function cleanupSubtaskDependencies(tasksData) {
  if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks)) {
    return tasksData;
  }
  
  const updatedTasks = tasksData.tasks.map(task => {
    // Skip tasks without subtasks
    if (!task.subtasks || !Array.isArray(task.subtasks)) {
      return task;
    }
    
    // Update each subtask
    const updatedSubtasks = task.subtasks.map(subtask => {
      // Skip subtasks without dependencies
      if (!subtask.dependencies || !Array.isArray(subtask.dependencies)) {
        return subtask;
      }
      
      // Filter valid dependencies
      const validDependencies = subtask.dependencies.filter(depId => {
        // Handle numeric subtask references
        if (typeof depId === 'number' && depId < 100) {
          const fullSubtaskId = `${task.id}.${depId}`;
          return taskExistsInState(fullSubtaskId);
        }
        
        // Handle full task/subtask references
        return taskExistsInState(depId);
      });
      
      return {
        ...subtask,
        dependencies: validDependencies
      };
    });
    
    return {
      ...task,
      subtasks: updatedSubtasks
    };
  });
  
  return {
    ...tasksData,
    tasks: updatedTasks
  };
}

/**
 * Validate dependencies in task files
 * @param {string} tasksPath - Path to tasks.json
 */
async function validateDependenciesCommand(tasksPath) {
  try {
    log('info', 'Validating task dependencies...');
    
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Get tasks from state
    const tasks = stateStore.getTasks();
    
    // Create a custom logger for the validation output
    const logs = [];
    
    // Validation function with custom logging
    const validation = validateDependenciesCommand.patchedValidateTaskDependencies(tasks, tasksPath);
    
    // Display banner with results
    const color = validation.valid ? 'green' : 'red';
    const title = validation.valid ? 'Dependencies Valid' : 'Dependency Issues Found';
    
    displayBanner({
      title,
      color,
      content: logs.join('\n')
    });
    
    return validation;
  } catch (error) {
    log('error', `Failed to validate dependencies: ${error.message}`);
    throw error;
  }
}

// Custom logger for dependency validation
validateDependenciesCommand.customLogger = (level, ...args) => {
  const content = args.join(' ');
  
  // Log to console
  if (level === 'error') {
    console.log(chalk.red(content));
  } else if (level === 'warn') {
    console.log(chalk.yellow(content));
  } else if (level === 'success') {
    console.log(chalk.green(content));
  } else {
    console.log(content);
  }
  
  // Return the log message
  return content;
};

// Create patched version that uses customLogger
validateDependenciesCommand.patchedValidateTaskDependencies = (tasks, tasksPath) => {
  // Use local wrapper function instead of trying to reassign the imported log
  const originalLog = log;
  const logProxy = (...args) => {
    return validateDependenciesCommand.customLogger(...args);
  };
  
  // Store original log implementation
  const originalValidateFunc = validateTaskDependencies;
  
  try {
    // Temporarily override validateTaskDependencies to use our logger
    global.log = logProxy;
    
    // Perform validation with custom logger
    const validation = validateTaskDependencies(tasks);
    
    if (validation.valid) {
      logProxy('success', `✓ All dependencies are valid (${tasks.length} tasks checked)`);
    } else {
      logProxy('error', `✗ Found ${validation.issues.length} dependency issues:`);
      
      for (const issue of validation.issues) {
        logProxy('warn', `  ${validation.issues.indexOf(issue) + 1}. ${issue.message}`);
      }
    }
    
    return validation;
  } finally {
    // Restore original logging context
    global.log = originalLog;
  }
};

/**
 * Helper function to count all dependencies across tasks and subtasks
 * @param {Array} tasks - All tasks
 * @returns {number} - Total number of dependencies
 */
function countAllDependencies(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return 0;
  }
  
  let count = 0;
  
  for (const task of tasks) {
    // Count task dependencies
    if (task.dependencies && Array.isArray(task.dependencies)) {
      count += task.dependencies.length;
    }
    
    // Count subtask dependencies
    if (task.subtasks && Array.isArray(task.subtasks)) {
      for (const subtask of task.subtasks) {
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          count += subtask.dependencies.length;
        }
      }
    }
  }
  
  return count;
}
