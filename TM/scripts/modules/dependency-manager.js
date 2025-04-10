/**
 * dependency-manager.js
 * Manages task dependencies and relationships
 * Refactored to use centralized state management
 */

import path from 'node:path';
import fs from 'node:fs/promises';
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
      
      const subtaskIndex = parentTask.subtasks.findIndex(s => s.id === subtaskId);
      if (subtaskIndex === -1) {
        throw new Error(`Subtask ${subtaskId} not found in parent task ${parentId}`);
      }
      
      // Check for circular dependency between this subtask and the dependency
      const tasks = stateStore.getTasks();
      if (isCircularDependency(tasks, formattedDependencyId, [formattedTaskId])) {
        throw new Error('Adding this dependency would create a circular reference');
      }
      
      // Clone the parent task to avoid direct state mutation
      const updatedParentTask = { ...parentTask };
      
      // Clone the subtask to modify it
      const subtask = { ...updatedParentTask.subtasks[subtaskIndex] };
      
      // Initialize dependencies array if it doesn't exist
      if (!subtask.dependencies) {
        subtask.dependencies = [];
      }
      
      // Check if dependency already exists
      if (subtask.dependencies.includes(formattedDependencyId)) {
        log('warn', `Dependency ${formattedDependencyId} already exists for subtask ${formattedTaskId}`);
        return;
      }
      
      // Add dependency
      subtask.dependencies.push(formattedDependencyId);
      
      // Update subtask in parent task
      updatedParentTask.subtasks[subtaskIndex] = subtask;
      
      // Update parent task in state
      stateStore.updateTask(parentId, updatedParentTask, { source: 'dependency-manager' });
      
      // Save state
      await stateStore.persistState(tasksPath);
      
      log('success', `Added dependency ${formattedDependencyId} to subtask ${formattedTaskId}`);
    } else {
      // Regular task dependency
      const task = stateStore.getTaskById(formattedTaskId);
      if (!task) {
        throw new Error(`Task ${formattedTaskId} not found`);
      }
      
      // Check for circular dependency between this task and the dependency
      const tasks = stateStore.getTasks();
      if (isCircularDependency(tasks, formattedDependencyId, [formattedTaskId])) {
        throw new Error('Adding this dependency would create a circular reference');
      }
      
      // Clone the task to avoid direct state mutation
      const updatedTask = { ...task };
      
      // Initialize dependencies array if it doesn't exist
      if (!updatedTask.dependencies) {
        updatedTask.dependencies = [];
      }
      
      // Check if dependency already exists
      if (updatedTask.dependencies.includes(formattedDependencyId)) {
        log('warn', `Dependency ${formattedDependencyId} already exists for task ${formattedTaskId}`);
        return;
      }
      
      // Add dependency
      updatedTask.dependencies.push(formattedDependencyId);
      
      // Update task in state
      stateStore.updateTask(formattedTaskId, updatedTask, { source: 'dependency-manager' });
      
      // Save state
      await stateStore.persistState(tasksPath);
      
      log('success', `Added dependency ${formattedDependencyId} to task ${formattedTaskId}`);
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
  const cycles = detectDependencyCycles(tasks);
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
    const validation = processValidation(tasks);
    
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
const customLogger = (level, ...args) => {
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
const processValidation = (tasks) => {
  // Perform validation
  const validation = validateTaskDependencies(tasks);
  
  if (validation.valid) {
    customLogger('success', `✓ All dependencies are valid (${tasks.length} tasks checked)`);
  } else {
    customLogger('error', `✗ Found ${validation.issues.length} dependency issues:`);
    
    for (const [index, issue] of validation.issues.entries()) {
      customLogger('warn', `  ${index + 1}. ${issue.message}`);
    }
  }
  
  return validation;
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

/**
 * Find cycles in task dependencies
 * @param {Array} tasks - Array of all tasks
 * @returns {Array} Array of cycles found, each cycle is an array of task IDs
 */
function detectDependencyCycles(tasks) {
  const cycles = [];
  const graph = buildDependencyGraph(tasks);
  
  // For each node, start a DFS to find cycles
  for (const startNode of Object.keys(graph)) {
    const visited = new Set();
    const path = [];
    
    findCyclesFromNode(startNode, graph, visited, path, cycles);
  }
  
  // Return unique cycles
  return cycles.filter((cycle, index) => {
    // Convert each cycle to a canonical form for comparison
    const canonicalCycle = [...cycle].sort().join(',');
    
    // Check if this canonical form appears earlier in the array
    return cycles.findIndex(c => [...c].sort().join(',') === canonicalCycle) === index;
  });
}

/**
 * Recursive helper function to find cycles from a specific node
 * @param {string} node - Current node (task ID)
 * @param {Object} graph - Dependency graph
 * @param {Set} visited - Set of visited nodes in the entire DFS
 * @param {Array} path - Current path in this DFS branch
 * @param {Array} cycles - Array to collect cycles
 */
function findCyclesFromNode(node, graph, visited, path, cycles) {
  // If we already visited this node in another branch, return
  if (visited.has(node)) {
    return;
  }
  
  // Check if we found a cycle
  const pathIndex = path.indexOf(node);
  if (pathIndex !== -1) {
    // Extract the cycle from the path
    const cycle = path.slice(pathIndex);
    cycles.push(cycle);
    return;
  }
  
  // Mark as visited and add to path
  visited.add(node);
  path.push(node);
  
  // Visit all dependencies
  if (graph[node]) {
    for (const dependent of graph[node]) {
      findCyclesFromNode(dependent, graph, visited, [...path], cycles);
    }
  }
}

/**
 * Build a dependency graph from tasks
 * @param {Array} tasks - Array of all tasks
 * @returns {Object} Graph as adjacency list
 */
function buildDependencyGraph(tasks) {
  const graph = {};
  
  // Initialize all task IDs as nodes
  for (const task of tasks) {
    graph[task.id] = [];
    
    // Add subtask IDs as nodes
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        const subtaskId = `${task.id}.${subtask.id}`;
        graph[subtaskId] = [];
      }
    }
  }
  
  // Add edges (dependencies)
  for (const task of tasks) {
    // Add task dependencies
    if (task.dependencies && Array.isArray(task.dependencies)) {
      for (const depId of task.dependencies) {
        if (graph[depId]) {
          graph[depId].push(task.id);
        }
      }
    }
    
    // Add subtask dependencies
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        const subtaskId = `${task.id}.${subtask.id}`;
        
        if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
          for (const depId of subtask.dependencies) {
            // Handle numeric shorthand references
            let fullDepId = depId;
            if (typeof depId === 'number' && depId < 100) {
              fullDepId = `${task.id}.${depId}`;
            }
            
            if (graph[fullDepId]) {
              graph[fullDepId].push(subtaskId);
            }
          }
        }
      }
    }
  }
  
  return graph;
}

/**
 * Fix dependency issues in task files
 * @param {string} tasksPath - Path to tasks.json
 */
async function fixDependenciesCommand(tasksPath) {
  try {
    log('info', 'Fixing task dependencies...');
    
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Get current state
    const currentState = stateStore.getState();
    
    // Make a copy of the state for processing
    const updatedState = { ...currentState };
    
    // Apply fixes in sequence
    log('info', '1. Removing duplicate dependencies...');
    const stateAfterDuplicates = removeDuplicateDependencies(updatedState);
    
    log('info', '2. Cleaning up invalid subtask dependencies...');
    const stateAfterCleanup = cleanupSubtaskDependencies(stateAfterDuplicates);
    
    // Update the state with fixed data
    stateStore.setState(stateAfterCleanup, { source: 'dependency-manager:fix' });
    
    // Save the changes
    await stateStore.persistState(tasksPath);
    
    // Run validation to check if all issues are fixed
    const validation = validateTaskDependencies(stateAfterCleanup.tasks);
    
    // Display results
    const countFixed = countAllDependencies(currentState.tasks) - countAllDependencies(stateAfterCleanup.tasks);
    
    displayBanner({
      title: 'Dependency Fixes Applied',
      color: 'green',
      content: `
Fixed ${countFixed} dependency issues.
Removed duplicate dependencies and invalid references.
${validation.valid ? 'All dependency issues resolved!' : `${validation.issues.length} issues remain.`}
      `.trim()
    });
    
    // If there are still issues, show them
    if (!validation.valid) {
      log('warn', '\nRemaining issues:');
      for (const [index, issue] of validation.issues.entries()) {
        log('warn', `  ${index + 1}. ${issue.message}`);
      }
      
      // For circular dependencies, suggest manual resolution
      const circularIssues = validation.issues.filter(i => i.type === 'circular_dependency');
      if (circularIssues.length > 0) {
        log('warn', '\nCircular dependencies must be resolved manually:');
        for (const issue of circularIssues) {
          log('warn', `  - ${issue.message}`);
        }
      }
    }
    
    return {
      fixed: countFixed,
      remaining: validation.issues.length
    };
  } catch (error) {
    log('error', `Failed to fix dependencies: ${error.message}`);
    throw error;
  }
}

// Export public functions
export {
  addDependency,
  removeDependency,
  validateTaskDependencies,
  validateDependenciesCommand,
  fixDependenciesCommand,
  taskHasDependency,
  taskHasBlockingDependencies,
  getTaskDependents,
  detectDependencyCycles,
  getSubtaskDependenciesFull
};
