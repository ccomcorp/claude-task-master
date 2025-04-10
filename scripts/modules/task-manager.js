/**
 * Task Manager Module
 * 
 * Core task management functionality for Task Master.
 * Refactored to use centralized state management instead of direct file operations.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  log, 
  CONFIG, 
  findTaskById, 
  truncate,
  formatTableRow,
  chalk
} from './utils.js';

import stateStore, { TASK_STATUSES } from './state-store.js';
import * as actions from './actions.js';

// Get directory name in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse a PRD file and generate tasks
 * @param {Object} options Options for parsing
 * @returns {Promise<Array>} Generated tasks
 */
async function parsePRD(options = {}) {
  const prdPath = options.prdPath || (CONFIG && CONFIG.prdPath) || path.join(process.cwd(), 'scripts/prd.txt');
  
  log(`Parsing PRD from ${prdPath}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(options.tasksPath);
    
    // Parse PRD and generate tasks
    const tasks = await actions.parsePRD(prdPath, options);
    
    log(`Successfully parsed PRD and generated ${tasks.length} tasks`, 'success');
    return tasks;
  } catch (error) {
    log(`Failed to parse PRD: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update tasks with new data
 * @param {Object} options Options for updating tasks
 * @returns {Promise<Array>} Updated tasks
 */
async function updateTasks(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  log('Updating tasks...', 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    const tasks = stateStore.getTasks();
    let updatedCount = 0;
    
    // Process each task based on options
    if (options.filter) {
      const condition = options.filter;
      
      for (const task of tasks) {
        let shouldUpdate = false;
        
        if (typeof condition === 'function') {
          shouldUpdate = condition(task);
        } else if (condition.id && task.id === Number(condition.id)) {
          shouldUpdate = true;
        } else if (condition.status && task.status === condition.status) {
          shouldUpdate = true;
        }
        
        if (shouldUpdate && options.updates) {
          actions.updateTask(task.id, options.updates, { persist: false });
          updatedCount++;
        }
      }
      
      // Persist changes after all updates
      if (updatedCount > 0) {
        await actions.saveTasks(tasksPath);
      }
      
      log(`Updated ${updatedCount} tasks`, 'success');
    } else if (options.updates) {
      // Update all tasks with the same changes
      const updatedTasks = tasks.map(task => {
        return actions.updateTask(task.id, options.updates, { persist: false });
      }).filter(Boolean);
      
      updatedCount = updatedTasks.length;
      
      // Persist changes after all updates
      if (updatedCount > 0) {
        await actions.saveTasks(tasksPath);
      }
      
      log(`Updated ${updatedCount} tasks`, 'success');
    }
    
    return stateStore.getTasks();
  } catch (error) {
    log(`Failed to update tasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Generate individual task files from tasks
 * @param {Object} options Options for generating files
 * @returns {Promise<Array>} Generated file paths
 */
async function generateTaskFiles(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  const outputDir = options.outputDir || (CONFIG && CONFIG.taskFilesDir) || path.join(process.cwd(), 'tasks/files');
  
  log(`Generating task files in ${outputDir}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Create filter function if needed
    let filter = null;
    
    if (options.filter) {
      if (typeof options.filter === 'function') {
        filter = options.filter;
      } else if (options.filter.id) {
        filter = task => task.id === Number(options.filter.id);
      } else if (options.filter.status) {
        filter = task => task.status === options.filter.status;
      }
    }
    
    // Generate task files
    const files = await actions.generateTaskFiles(outputDir, {
      filter,
      format: options.format || 'md',
      overwrite: options.overwrite || false
    });
    
    log(`Generated ${files.length} task files`, 'success');
    return files;
  } catch (error) {
    log(`Failed to generate task files: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Set a task's status
 * @param {Object} options Options for setting task status
 * @returns {Promise<Object>} Updated task
 */
async function setTaskStatus(options = {}) {
  const { id, status } = options;
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!id) {
    throw new Error('Task ID is required');
  }
  
  if (!status || !Object.values(TASK_STATUSES).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  
  log(`Setting task ${id} status to ${status}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Update task status
    const updatedTask = actions.setTaskStatus(id, status);
    
    log(`Task ${id} status updated to ${status}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to set task status: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update a single task's status (compatibility with old interface)
 * @param {number|string} id Task ID
 * @param {string} status New status
 * @param {string} tasksPath Path to tasks file
 * @returns {Promise<Object>} Updated task
 */
async function updateSingleTaskStatus(id, status, tasksPath) {
  return setTaskStatus({ id, status, tasksPath });
}

/**
 * List tasks with optional filtering
 * @param {Object} options Options for listing tasks
 * @returns {Promise<Object>} List result object
 */
async function listTasks(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    let tasks = stateStore.getTasks();
    
    // Apply filters
    if (options.filters) {
      if (options.filters.status) {
        tasks = tasks.filter(task => task.status === options.filters.status);
      }
      
      if (options.filters.priority) {
        tasks = tasks.filter(task => task.priority === options.filters.priority);
      }
      
      if (options.filters.id) {
        tasks = tasks.filter(task => task.id === Number(options.filters.id));
      }
    }
    
    // Apply sorting
    if (options.sort) {
      const { field = 'id', direction = 'asc' } = options.sort;
      
      tasks.sort((a, b) => {
        let valueA = a[field];
        let valueB = b[field];
        
        // Handle special cases for sorting
        if (field === 'dependencies') {
          valueA = (a.dependencies || []).length;
          valueB = (b.dependencies || []).length;
        } else if (field === 'subtasks') {
          valueA = (a.subtasks || []).length;
          valueB = (b.subtasks || []).length;
        }
        
        // Compare values
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    // Apply pagination
    let paginatedTasks = tasks;
    
    if (options.pagination) {
      const { page = 1, limit = 10 } = options.pagination;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      paginatedTasks = tasks.slice(startIndex, endIndex);
    }
    
    // Create result object
    const result = {
      total: tasks.length,
      filtered: paginatedTasks.length,
      tasks: paginatedTasks,
      meta: stateStore.getMeta()
    };
    
    return result;
  } catch (error) {
    log(`Failed to list tasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Expand a task into subtasks
 * @param {Object} options Options for expanding task
 * @returns {Promise<Object>} Updated task with subtasks
 */
async function expandTask(options = {}) {
  const { id } = options;
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!id) {
    throw new Error('Task ID is required');
  }
  
  log(`Expanding task ${id} into subtasks...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Expand task
    const updatedTask = await actions.expandTask(id, options);
    
    log(`Task ${id} expanded with ${updatedTask.subtasks.length} subtasks`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to expand task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Expand all tasks into subtasks
 * @param {Object} options Options for expanding tasks
 * @returns {Promise<Array>} Updated tasks with subtasks
 */
async function expandAllTasks(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  log('Expanding all tasks into subtasks...', 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    const tasks = stateStore.getTasks();
    const expandedTasks = [];
    
    // Expand each task
    for (const task of tasks) {
      // Skip tasks with existing subtasks unless forced
      if (task.subtasks && task.subtasks.length > 0 && !options.force) {
        log(`Skipping task ${task.id} as it already has subtasks`, 'info');
        expandedTasks.push(task);
        continue;
      }
      
      try {
        const updatedTask = await actions.expandTask(task.id, { ...options, persist: false });
        expandedTasks.push(updatedTask);
        log(`Task ${task.id} expanded with ${updatedTask.subtasks.length} subtasks`, 'success');
      } catch (error) {
        log(`Failed to expand task ${task.id}: ${error.message}`, 'warn');
        expandedTasks.push(task);
      }
    }
    
    // Save changes after all expansions
    await actions.saveTasks(tasksPath);
    
    log(`Expanded ${expandedTasks.length} tasks`, 'success');
    return expandedTasks;
  } catch (error) {
    log(`Failed to expand all tasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Clear subtasks from a task
 * @param {Object} options Options for clearing subtasks
 * @returns {Promise<Object>} Updated task without subtasks
 */
async function clearSubtasks(options = {}) {
  const { id } = options;
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!id) {
    throw new Error('Task ID is required');
  }
  
  log(`Clearing subtasks from task ${id}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Clear subtasks
    const updatedTask = actions.clearSubtasks(id);
    
    log(`Subtasks cleared from task ${id}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to clear subtasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add a new task
 * @param {Object} options Options for adding task
 * @returns {Promise<Object>} Added task
 */
async function addTask(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!options.title) {
    throw new Error('Task title is required');
  }
  
  log(`Adding new task: ${options.title}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Prepare task data
    const taskData = {
      title: options.title,
      description: options.description || '',
      status: options.status || TASK_STATUSES.PENDING,
      priority: options.priority || 'medium',
      details: options.details || '',
      testStrategy: options.testStrategy || '',
      dependencies: options.dependencies || []
    };
    
    // Add task
    const task = actions.addTask(taskData);
    
    log(`Task added: ${task.title} (ID: ${task.id})`, 'success');
    return task;
  } catch (error) {
    log(`Failed to add task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add a subtask to a task
 * @param {Object} options Options for adding subtask
 * @returns {Promise<Object>} Updated parent task
 */
async function addSubtask(options = {}) {
  const { parentId, title } = options;
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!parentId) {
    throw new Error('Parent task ID is required');
  }
  
  if (!title) {
    throw new Error('Subtask title is required');
  }
  
  log(`Adding subtask to task ${parentId}: ${title}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Prepare subtask data
    const subtaskData = {
      title,
      description: options.description || '',
      status: options.status || TASK_STATUSES.PENDING
    };
    
    // Add subtask
    const updatedTask = actions.addSubtask(parentId, subtaskData);
    
    log(`Subtask added to task ${parentId}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to add subtask: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Remove a subtask from a task
 * @param {Object} options Options for removing subtask
 * @returns {Promise<Object>} Updated parent task
 */
async function removeSubtask(options = {}) {
  const { parentId, subtaskId } = options;
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  if (!parentId) {
    throw new Error('Parent task ID is required');
  }
  
  if (!subtaskId) {
    throw new Error('Subtask ID is required');
  }
  
  log(`Removing subtask ${subtaskId} from task ${parentId}...`, 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Remove subtask
    const updatedTask = actions.removeSubtask(parentId, subtaskId);
    
    log(`Subtask ${subtaskId} removed from task ${parentId}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to remove subtask: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Find the next task to work on
 * @param {Object} options Options for finding next task
 * @returns {Promise<Object|null>} Next task or null if none found
 */
async function findNextTask(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  
  log('Finding next task to work on...', 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Get ready tasks (pending with no dependencies or all dependencies done)
    const readyTasks = stateStore.getReadyTasks();
    
    if (readyTasks.length === 0) {
      log('No ready tasks found', 'info');
      return null;
    }
    
    // Sort by priority and dependencies
    const sortedTasks = [...readyTasks].sort((a, b) => {
      // Priority order: high > medium > low
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityA = priorityOrder[a.priority] || 1;
      const priorityB = priorityOrder[b.priority] || 1;
      
      // Compare priority first
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then compare by dependency count (fewer dependencies first)
      const depCountA = (a.dependencies || []).length;
      const depCountB = (b.dependencies || []).length;
      
      return depCountA - depCountB;
    });
    
    const nextTask = sortedTasks[0];
    
    log(`Found next task: ${nextTask.title} (ID: ${nextTask.id})`, 'success');
    return nextTask;
  } catch (error) {
    log(`Failed to find next task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Analyze task complexity and generate a report
 * @param {Object} options Options for analysis
 * @returns {Promise<Object>} Complexity report
 */
async function analyzeTaskComplexity(options = {}) {
  const tasksPath = options.tasksPath || (CONFIG && CONFIG.tasksPath);
  const outputPath = options.outputPath || (CONFIG && CONFIG.complexityReportPath) || path.join(process.cwd(), 'tasks/complexity-report.json');
  
  log('Analyzing task complexity...', 'info');
  
  try {
    // Ensure state is loaded
    await actions.loadTasks(tasksPath);
    
    // Analyze complexity
    const report = await actions.analyzeTaskComplexity({
      outputPath,
      factors: options.factors
    });
    
    log(`Task complexity analysis complete. Average complexity: ${report.statistics.averageScore}`, 'success');
    return report;
  } catch (error) {
    log(`Failed to analyze task complexity: ${error.message}`, 'error');
    throw error;
  }
}

// Export task manager functions
export {
  parsePRD,
  updateTasks,
  generateTaskFiles,
  setTaskStatus,
  updateSingleTaskStatus,
  listTasks,
  expandTask,
  expandAllTasks,
  clearSubtasks,
  addTask,
  addSubtask,
  removeSubtask,
  findNextTask,
  analyzeTaskComplexity,
};
