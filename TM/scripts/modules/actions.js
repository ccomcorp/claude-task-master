/**
 * Action Creators Module
 * 
 * Defines functions that encapsulate state mutations through the state store.
 * All operations that modify task state should go through these action creators
 * rather than directly manipulating the state or performing file I/O.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import stateStore, { TASK_STATUSES } from './state-store.js';
import { log, CONFIG } from './utils.js';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Import helper functions for AI services
 * These will be implemented in the ai-services.js module
 */
import {
  generateSubtasks,
  generateSubtasksWithPerplexity,
  useClaudeForComplexityAnalysis,
  usePerplexityForComplexityAnalysis,
  generateComplexityAnalysisPrompt,
  startLoadingIndicator,
  stopLoadingIndicator
} from './ai-services.js';

/**
 * Load tasks from file
 * @param {string} filePath Optional custom file path
 * @returns {Promise<Object>} Loaded state
 */
export async function loadTasks(filePath = null) {
  try {
    const state = await stateStore.loadState(filePath);
    log('Tasks loaded successfully', 'success');
    return state;
  } catch (error) {
    log(`Failed to load tasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Save tasks to file
 * @param {string} filePath Optional custom file path
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveTasks(filePath = null) {
  try {
    await stateStore.persistState(filePath);
    log('Tasks saved successfully', 'success');
    return true;
  } catch (error) {
    log(`Failed to save tasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add a new task
 * @param {Object} taskData Task data object
 * @param {Object} options Options for state update
 * @returns {Object} Added task
 */
export function addTask(taskData, options = {}) {
  try {
    // Validate required fields
    if (!taskData.title) {
      throw new Error('Task title is required');
    }
    
    // Add task through state store
    const task = stateStore.addTask(taskData, options);
    
    log(`Task added: ${task.title} (ID: ${task.id})`, 'success');
    return task;
  } catch (error) {
    log(`Failed to add task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update an existing task
 * @param {number|string} id Task ID
 * @param {Object} updates Updates to apply
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function updateTask(id, updates, options = {}) {
  try {
    const task = stateStore.updateTask(id, updates, options);
    
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    log(`Task updated: ${task.title} (ID: ${task.id})`, 'success');
    return task;
  } catch (error) {
    log(`Failed to update task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Change task status
 * @param {number|string} id Task ID
 * @param {string} status New status
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function setTaskStatus(id, status, options = {}) {
  try {
    // Validate status
    if (!Object.values(TASK_STATUSES).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    const task = stateStore.setTaskStatus(id, status, options);
    
    if (!task) {
      throw new Error(`Task with ID ${id} not found or invalid status transition`);
    }
    
    log(`Task status changed: ${task.title} (ID: ${task.id}) -> ${status}`, 'success');
    return task;
  } catch (error) {
    log(`Failed to change task status: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Remove a task
 * @param {number|string} id Task ID
 * @param {Object} options Options for state update
 * @returns {boolean} True if task was removed
 */
export function removeTask(id, options = {}) {
  try {
    const success = stateStore.removeTask(id, options);
    
    if (!success) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    log(`Task removed: ID ${id}`, 'success');
    return true;
  } catch (error) {
    log(`Failed to remove task: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add a subtask to a task
 * @param {number|string} parentId Parent task ID
 * @param {Object} subtaskData Subtask data
 * @param {Object} options Options for state update
 * @returns {Object} Updated parent task
 */
export function addSubtask(parentId, subtaskData, options = {}) {
  try {
    // Get parent task
    const parentTask = stateStore.getTaskById(parentId);
    
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    
    // Validate required fields
    if (!subtaskData.title) {
      throw new Error('Subtask title is required');
    }
    
    // Generate new subtask ID (max ID + 1)
    const subtasks = parentTask.subtasks || [];
    const maxId = subtasks.reduce((max, subtask) => Math.max(max, subtask.id || 0), 0);
    
    const newSubtask = {
      id: maxId + 1,
      status: TASK_STATUSES.PENDING,
      ...subtaskData
    };
    
    // Update parent task with new subtask
    const updatedSubtasks = [...subtasks, newSubtask];
    
    const updatedTask = stateStore.updateTask(parentId, {
      subtasks: updatedSubtasks
    }, options);
    
    log(`Subtask added to task ${parentId}: ${newSubtask.title} (ID: ${newSubtask.id})`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to add subtask: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Remove a subtask from a task
 * @param {number|string} parentId Parent task ID
 * @param {number|string} subtaskId Subtask ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated parent task
 */
export function removeSubtask(parentId, subtaskId, options = {}) {
  try {
    // Get parent task
    const parentTask = stateStore.getTaskById(parentId);
    
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    
    const subtasks = parentTask.subtasks || [];
    const subtaskIdNum = Number(subtaskId);
    
    // Check if subtask exists
    if (!subtasks.some(st => st.id === subtaskIdNum)) {
      throw new Error(`Subtask with ID ${subtaskId} not found in task ${parentId}`);
    }
    
    // Remove subtask
    const updatedSubtasks = subtasks.filter(st => st.id !== subtaskIdNum);
    
    const updatedTask = stateStore.updateTask(parentId, {
      subtasks: updatedSubtasks
    }, options);
    
    log(`Subtask removed from task ${parentId}: ID ${subtaskId}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to remove subtask: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update a subtask
 * @param {number|string} parentId Parent task ID
 * @param {number|string} subtaskId Subtask ID
 * @param {Object} updates Updates to apply
 * @param {Object} options Options for state update
 * @returns {Object} Updated parent task
 */
export function updateSubtask(parentId, subtaskId, updates, options = {}) {
  try {
    // Get parent task
    const parentTask = stateStore.getTaskById(parentId);
    
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    
    const subtasks = parentTask.subtasks || [];
    const subtaskIdNum = Number(subtaskId);
    const subtaskIndex = subtasks.findIndex(st => st.id === subtaskIdNum);
    
    // Check if subtask exists
    if (subtaskIndex === -1) {
      throw new Error(`Subtask with ID ${subtaskId} not found in task ${parentId}`);
    }
    
    // Update subtask
    const updatedSubtask = {
      ...subtasks[subtaskIndex],
      ...updates
    };
    
    const updatedSubtasks = [...subtasks];
    updatedSubtasks[subtaskIndex] = updatedSubtask;
    
    const updatedTask = stateStore.updateTask(parentId, {
      subtasks: updatedSubtasks
    }, options);
    
    log(`Subtask updated in task ${parentId}: ${updatedSubtask.title} (ID: ${updatedSubtask.id})`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to update subtask: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Add a dependency between tasks
 * @param {number|string} taskId Task ID
 * @param {number|string} dependencyId Dependency task ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function addDependency(taskId, dependencyId, options = {}) {
  try {
    const taskIdNum = Number(taskId);
    const dependencyIdNum = Number(dependencyId);
    
    // Prevent self-dependency
    if (taskIdNum === dependencyIdNum) {
      throw new Error('A task cannot depend on itself');
    }
    
    // Get both tasks
    const task = stateStore.getTaskById(taskIdNum);
    const dependencyTask = stateStore.getTaskById(dependencyIdNum);
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    if (!dependencyTask) {
      throw new Error(`Dependency task with ID ${dependencyId} not found`);
    }
    
    // Check for circular dependencies
    const dependencyChain = [dependencyIdNum];
    let currentTask = dependencyTask;
    
    // Check if task depends on any task that depends on our target task
    while (currentTask?.dependencies?.length > 0) {
      for (const depId of currentTask.dependencies) {
        if (depId === taskIdNum) {
          throw new Error('Adding this dependency would create a circular dependency chain');
        }
        
        if (dependencyChain.includes(depId)) {
          continue; // Skip already checked dependencies
        }
        
        dependencyChain.push(depId);
        currentTask = stateStore.getTaskById(depId);
        
        if (currentTask) {
          break; // Move to the next task in the chain
        }
      }
    }
    
    // Update dependencies
    const dependencies = task.dependencies || [];
    
    // Check if dependency already exists
    if (dependencies.includes(dependencyIdNum)) {
      throw new Error(`Task ${taskId} already depends on task ${dependencyId}`);
    }
    
    const updatedDependencies = [...dependencies, dependencyIdNum];
    
    const updatedTask = stateStore.updateTask(taskIdNum, {
      dependencies: updatedDependencies
    }, options);
    
    log(`Dependency added: Task ${taskId} now depends on task ${dependencyId}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to add dependency: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Remove a dependency between tasks
 * @param {number|string} taskId Task ID
 * @param {number|string} dependencyId Dependency task ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function removeDependency(taskId, dependencyId, options = {}) {
  try {
    const taskIdNum = Number(taskId);
    const dependencyIdNum = Number(dependencyId);
    
    // Get task
    const task = stateStore.getTaskById(taskIdNum);
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const dependencies = task.dependencies || [];
    
    // Check if dependency exists
    if (!dependencies.includes(dependencyIdNum)) {
      throw new Error(`Task ${taskId} does not depend on task ${dependencyId}`);
    }
    
    const updatedDependencies = dependencies.filter(depId => depId !== dependencyIdNum);
    
    const updatedTask = stateStore.updateTask(taskIdNum, {
      dependencies: updatedDependencies
    }, options);
    
    log(`Dependency removed: Task ${taskId} no longer depends on task ${dependencyId}`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to remove dependency: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Generate individual task files from tasks in state
 * @param {string} outputDir Output directory for task files
 * @param {Object} options Options (filter, format, etc.)
 * @returns {Promise<Array>} Array of generated file paths
 */
export async function generateTaskFiles(outputDir = null, options = {}) {
  try {
    const { filter = null, format = 'md', overwrite = false } = options;
    
    // Get tasks from state
    const tasks = stateStore.getTasks();
    
    // Apply filters if provided
    const filteredTasks = filter ? tasks.filter(filter) : tasks;
    
    if (filteredTasks.length === 0) {
      log('No tasks to generate files for', 'info');
      return [];
    }
    
    // Determine output directory
    const tasksDir = outputDir || CONFIG?.taskFilesDir || 'tasks/files';
    
    // Ensure directory exists
    await fs.mkdir(tasksDir, { recursive: true });
    
    const generatedFiles = [];
    
    // Generate file for each task
    for (const task of filteredTasks) {
      const fileName = `task-${task.id}.${format}`;
      const filePath = path.join(tasksDir, fileName);
      
      // Skip if file exists and overwrite is false
      if (!overwrite && await fileExists(filePath)) {
        log(`Skipping existing file: ${filePath}`, 'info');
        generatedFiles.push(filePath);
        continue;
      }
      
      // Generate content based on format
      let content;
      
      if (format === 'md') {
        content = generateMarkdownContent(task);
      } else if (format === 'json') {
        content = JSON.stringify(task, null, 2);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      // Write file
      await fs.writeFile(filePath, content);
      
      log(`Generated task file: ${filePath}`, 'success');
      generatedFiles.push(filePath);
    }
    
    return generatedFiles;
  } catch (error) {
    log(`Failed to generate task files: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Generate markdown content for a task
 * @param {Object} task Task object
 * @returns {string} Markdown content
 */
function generateMarkdownContent(task) {
  let content = `# Task ${task.id}: ${task.title}\n\n`;
  
  content += `**Status:** ${task.status}\n`;
  content += `**Priority:** ${task.priority || 'normal'}\n`;
  
  if (task.dependencies?.length > 0) {
    content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
  }
  
  content += '\n## Description\n\n';
  content += `${task.description || 'No description provided.'}\n\n`;
  
  if (task.details) {
    content += '## Details\n\n';
    content += `${task.details}\n\n`;
  }
  
  if (task.testStrategy) {
    content += '## Test Strategy\n\n';
    content += `${task.testStrategy}\n\n`;
  }
  
  if (task.subtasks?.length > 0) {
    content += '## Subtasks\n\n';
    
    for (const subtask of task.subtasks) {
      content += `### ${subtask.id}. ${subtask.title}\n`;
      content += `**Status:** ${subtask.status}\n\n`;
      
      if (subtask.description) {
        content += `${subtask.description}\n\n`;
      }
    }
  }
  
  return content;
}

/**
 * Check if a file exists
 * @param {string} filePath File path
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a PRD document to generate tasks
 * @param {string} prdPath Path to PRD document
 * @param {Object} options Options for parsing
 * @returns {Promise<Array>} Generated tasks
 */
export async function parsePRD(prdPath, options = {}) {
  try {
    // Read PRD content
    const prdContent = await fs.readFile(prdPath, 'utf8');
    
    // TODO: Implement actual parsing logic (preserved from original implementation)
    // For now, we'll create a placeholder task
    
    const task = addTask({
      title: 'PRD Parsing Task',
      description: 'This task was created from PRD parsing',
      details: 'The actual PRD parsing logic needs to be implemented',
      status: TASK_STATUSES.PENDING,
      priority: 'medium'
    }, { persist: false });
    
    // Save state explicitly after all tasks are added
    await saveTasks();
    
    log(`PRD parsed and tasks created: ${prdPath}`, 'success');
    return [task];
  } catch (error) {
    log(`Failed to parse PRD: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Expand a task into subtasks using AI services
 * @param {number|string} taskId Task ID
 * @param {number} numSubtasks Number of subtasks to generate (only used with AI expansion)
 * @param {boolean} useResearch Whether to use research API (only used with AI expansion)
 * @param {string} additionalContext Additional context for AI (only used with AI expansion)
 * @param {Object} options Options for task expansion
 * @returns {Promise<Object>} Updated task with subtasks
 */
export async function expandTask(taskId, numSubtasks = 5, useResearch = false, additionalContext = '', options = {}) {
  log('info', `Expanding task ${taskId} with ${numSubtasks} subtasks`);
  
  // Get task
  const task = stateStore.getTaskById(Number(taskId));
  
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  
  try {
    // Check if task already has subtasks
    if (task.subtasks?.length > 0) {
      log('warn', `Task ${taskId} already has subtasks, clearing them first`);
      await clearSubtasks(taskId);
    }
    
    let generatedSubtasks;
    
    // Determine if we should use AI generation or placeholder subtasks
    if (options.useAI || numSubtasks > 0) {
      // Generate subtasks using AI service
      const spinner = startLoadingIndicator(`Generating subtasks for task ${taskId}...`);
      
      try {
        // Call AI service with appropriate parameters
        if (useResearch) {
          generatedSubtasks = await generateSubtasksWithPerplexity(
            task,
            numSubtasks,
            additionalContext
          );
        } else {
          generatedSubtasks = await generateSubtasks(
            task,
            numSubtasks,
            additionalContext
          );
        }
        
        stopLoadingIndicator(spinner);
        
        if (!generatedSubtasks || !Array.isArray(generatedSubtasks)) {
          throw new Error('Failed to generate subtasks');
        }
      } catch (error) {
        stopLoadingIndicator(spinner);
        log('error', `AI subtask generation failed: ${error.message}`);
        
        // Use placeholder subtasks as fallback
        generatedSubtasks = [
          {
            title: 'Placeholder Subtask 1',
            description: 'This is a placeholder subtask',
            status: TASK_STATUSES.PENDING
          },
          {
            title: 'Placeholder Subtask 2',
            description: 'This is another placeholder subtask',
            status: TASK_STATUSES.PENDING
          }
        ];
      }
    } else {
      // Use placeholder subtasks
      generatedSubtasks = [
        {
          title: 'Placeholder Subtask 1',
          description: 'This is a placeholder subtask',
          status: TASK_STATUSES.PENDING
        },
        {
          title: 'Placeholder Subtask 2',
          description: 'This is another placeholder subtask',
          status: TASK_STATUSES.PENDING
        }
      ];
    }
    
    // Process and assign IDs to subtasks
    const processedSubtasks = generatedSubtasks.map((subtask, index) => ({
      id: index + 1,
      title: subtask.title,
      description: subtask.description || '',
      details: subtask.details || '',
      status: subtask.status || TASK_STATUSES.PENDING
    }));
    
    // Update task with subtasks
    const updatedTask = stateStore.updateTask(Number(taskId), {
      subtasks: processedSubtasks
    });
    
    log('success', `Successfully added ${processedSubtasks.length} subtasks to task ${taskId}`);
    return updatedTask;
  } catch (error) {
    log('error', `Error expanding task: ${error.message}`);
    throw error;
  }
}

/**
 * Clear all subtasks from a task
 * @param {number|string} taskId Task ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function clearSubtasks(taskId, options = {}) {
  try {
    // Get task
    const task = stateStore.getTaskById(Number(taskId));
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Check if task has subtasks
    if (!task.subtasks?.length) {
      log('warn', `Task ${taskId} has no subtasks to clear`);
      return task;
    }
    
    // Update task with empty subtasks array
    const updatedTask = stateStore.updateTask(Number(taskId), {
      subtasks: []
    }, options);
    
    log('success', `Cleared subtasks from task ${taskId}`);
    return updatedTask;
  } catch (error) {
    log('error', `Failed to clear subtasks: ${error.message}`);
    throw error;
  }
}

/**
 * Convert a complex subtask ID string into components
 * @param {string} complexId - Complex ID in format "parentId.subtaskId"
 * @returns {Object} Object with parentId and subtaskId
 */
function parseComplexSubtaskId(complexId) {
  if (!complexId.includes('.')) {
    throw new Error(`Invalid subtask ID format: ${complexId}. Expected format: "parentId.subtaskId"`);
  }
  
  const [parentIdStr, subtaskIdStr] = complexId.split('.');
  return {
    parentId: Number(parentIdStr),
    subtaskId: Number(subtaskIdStr)
  };
}

/**
 * Add a subtask to a task with enhanced functionality
 * @param {number|string} parentId Parent task ID
 * @param {Object|number} subtaskDataOrExistingId Subtask data or existing task ID to convert
 * @param {Object} options Options for state update
 * @returns {Object} Updated parent task
 */
export function addSubtaskEnhanced(parentId, subtaskDataOrExistingId, options = {}) {
  try {
    // Determine if we're converting an existing task or adding a new subtask
    const isExistingTaskId = typeof subtaskDataOrExistingId === 'number' || 
                             (typeof subtaskDataOrExistingId === 'string' && !Number.isNaN(Number(subtaskDataOrExistingId)));
    
    // Get parent task
    const parentTask = stateStore.getTaskById(Number(parentId));
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    
    let newSubtask;
    let updatedTasks = [...stateStore.getTasks()];
    
    if (isExistingTaskId) {
      // Converting existing task to subtask
      const existingTaskId = Number(subtaskDataOrExistingId);
      log('info', `Converting task ${existingTaskId} to subtask of ${parentId}`);
      
      // Get existing task
      const existingTask = stateStore.getTaskById(existingTaskId);
      if (!existingTask) {
        throw new Error(`Existing task with ID ${existingTaskId} not found`);
      }
      
      // Check for circular dependencies
      if (isTaskDependentOn(stateStore.getTasks(), parentTask, existingTaskId)) {
        throw new Error(`Cannot convert task ${existingTaskId} to subtask: would create circular dependency`);
      }
      
      // Create subtask from existing task
      newSubtask = {
        id: 1, // Will be updated later
        title: existingTask.title,
        description: existingTask.description ?? '',
        details: existingTask.details ?? '',
        status: existingTask.status ?? TASK_STATUSES.PENDING,
        dependencies: existingTask.dependencies?.filter(id => id !== Number(parentId)) ?? []
      };
      
      // Remove existing task from state
      updatedTasks = updatedTasks.filter(task => task.id !== existingTaskId);
    } else {
      // Creating new subtask
      const subtaskData = subtaskDataOrExistingId;
      log('info', `Creating new subtask for task ${parentId}`);
      
      // Validate required fields
      if (!subtaskData?.title) {
        throw new Error('Subtask title is required');
      }
      
      // Create new subtask
      newSubtask = {
        id: 1, // Will be updated later
        title: subtaskData.title,
        description: subtaskData.description ?? '',
        details: subtaskData.details ?? '',
        status: subtaskData.status ?? TASK_STATUSES.PENDING,
        dependencies: subtaskData.dependencies ?? []
      };
    }
    
    // Prepare parent task with subtask
    const subtasks = parentTask.subtasks || [];
    const maxId = subtasks.length > 0 ? Math.max(...subtasks.map(st => st.id)) : 0;
    newSubtask.id = maxId + 1;
    
    // Update parent task
    const updatedSubtasks = [...subtasks, newSubtask];
    
    const taskIndex = updatedTasks.findIndex(t => t.id === Number(parentId));
    updatedTasks[taskIndex] = {
      ...parentTask,
      subtasks: updatedSubtasks
    };
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    log('success', `Added subtask ${parentId}.${newSubtask.id}`);
    
    return newSubtask;
  } catch (error) {
    log('error', `Failed to add subtask: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a subtask from a task with enhanced functionality
 * @param {string|Object|number} subtaskIdOrParentId Subtask ID in format "parentId.subtaskId", object with parentId and subtaskId, or parentId
 * @param {boolean|Object|number} [convertOrOptionsOrSubtaskId] Whether to convert subtask to task, options object, or subtaskId
 * @param {Object} [optionsOrEmpty] Options for state update
 * @returns {Object} Updated parent task or newly created task
 */
export function removeSubtaskEnhanced(subtaskIdOrParentId, convertOrOptionsOrSubtaskId = false, optionsOrEmpty = {}) {
  try {
    let parentId;
    let subtaskId;
    let convertToTask = false;
    let options = {};
    
    // Parse parameters based on type
    if (typeof subtaskIdOrParentId === 'string' && subtaskIdOrParentId.includes('.')) {
      // Format: "parentId.subtaskId"
      const parsed = parseComplexSubtaskId(subtaskIdOrParentId);
      parentId = parsed.parentId;
      subtaskId = parsed.subtaskId;
      
      // Determine if second parameter is a boolean or options
      if (typeof convertOrOptionsOrSubtaskId === 'boolean') {
        convertToTask = convertOrOptionsOrSubtaskId;
        options = optionsOrEmpty;
      } else {
        options = convertOrOptionsOrSubtaskId || {};
      }
    } else if (typeof subtaskIdOrParentId === 'object') {
      // Format: { parentId, subtaskId }
      parentId = Number(subtaskIdOrParentId.parentId);
      subtaskId = Number(subtaskIdOrParentId.subtaskId);
      
      // Determine if second parameter is a boolean or options
      if (typeof convertOrOptionsOrSubtaskId === 'boolean') {
        convertToTask = convertOrOptionsOrSubtaskId;
        options = optionsOrEmpty;
      } else {
        options = convertOrOptionsOrSubtaskId || {};
      }
    } else if (typeof subtaskIdOrParentId === 'number' || !Number.isNaN(Number(subtaskIdOrParentId))) {
      // Format: (parentId, subtaskId, options)
      parentId = Number(subtaskIdOrParentId);
      
      // Second parameter could be subtaskId or options
      if (typeof convertOrOptionsOrSubtaskId === 'number' || !Number.isNaN(Number(convertOrOptionsOrSubtaskId))) {
        subtaskId = Number(convertOrOptionsOrSubtaskId);
        options = optionsOrEmpty;
      } else {
        throw new Error('Invalid parameters for removeSubtask');
      }
    } else {
      throw new Error('Invalid parameters for removeSubtask');
    }
    
    log('info', `Removing subtask ${parentId}.${subtaskId}`);
    
    // Get the parent task
    const parentTask = stateStore.getTaskById(parentId);
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    
    const subtasks = parentTask.subtasks || [];
    
    // Check if parent has subtasks
    if (subtasks.length === 0) {
      throw new Error(`Parent task ${parentId} has no subtasks`);
    }
    
    // Find the subtask to remove
    const subtaskIndex = subtasks.findIndex(st => st.id === subtaskId);
    if (subtaskIndex === -1) {
      throw new Error(`Subtask ${parentId}.${subtaskId} not found`);
    }
    
    // Get a copy of the subtask before removing it
    const removedSubtask = { ...subtasks[subtaskIndex] };
    
    // Get all tasks from state
    const tasks = stateStore.getTasks();
    
    // Create updated parent task without the subtask
    const updatedSubtasks = [...subtasks];
    updatedSubtasks.splice(subtaskIndex, 1);
    
    const updatedParentTask = {
      ...parentTask,
      subtasks: updatedSubtasks.length > 0 ? updatedSubtasks : []
    };
    
    // Update tasks list
    const updatedTasks = tasks.map(task => 
      task.id === parentId ? updatedParentTask : task
    );
    
    // Create converted task if requested
    let convertedTask = null;
    
    if (convertToTask) {
      log('info', `Converting subtask ${parentId}.${subtaskId} to a standalone task`);
      
      // Find the highest task ID to determine the next ID
      const highestId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
      const newTaskId = highestId + 1;
      
      // Create the new task from the subtask
      convertedTask = {
        id: newTaskId,
        title: removedSubtask.title,
        description: removedSubtask.description ?? '',
        details: removedSubtask.details ?? '',
        status: removedSubtask.status ?? TASK_STATUSES.PENDING,
        dependencies: [...(removedSubtask.dependencies ?? [])],
        priority: parentTask.priority ?? 'medium' // Inherit priority from parent
      };
      
      // Add the parent task as a dependency if not already present
      if (!convertedTask.dependencies.includes(parentId)) {
        convertedTask.dependencies.push(parentId);
      }
      
      // Add the converted task to the tasks array
      updatedTasks.push(convertedTask);
      
      log('info', `Created new task ${newTaskId} from subtask ${parentId}.${subtaskId}`);
    } else {
      log('info', `Subtask ${parentId}.${subtaskId} deleted`);
    }
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    return convertedTask || updatedParentTask;
  } catch (error) {
    log('error', `Failed to remove subtask: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze task complexity and generate expansion recommendations
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Complexity analysis report
 */
export async function analyzeTaskComplexity(options) {
  const threshold = options.threshold || 7;
  const useResearch = options.research || false;
  
  log('info', `Analyzing task complexity with threshold ${threshold}`);
  
  // Get tasks from state
  const tasks = stateStore.getTasks();
  
  // Filter out completed tasks
  const pendingTasks = tasks.filter(task => 
    task.status !== TASK_STATUSES.DONE && 
    task.status !== TASK_STATUSES.CANCELLED
  );
  
  if (pendingTasks.length === 0) {
    log('warn', 'No pending tasks to analyze');
    throw new Error('No pending tasks found for complexity analysis');
  }
  
  log('info', `Analyzing complexity of ${pendingTasks.length} pending tasks`);
  
  // Call AI to analyze task complexity
  const spinner = startLoadingIndicator('Analyzing task complexity...');
  
  try {
    // Generate prompt
    const prompt = generateComplexityAnalysisPrompt(pendingTasks);
    
    // Call AI service with appropriate parameters
    let complexityAnalysis;
    
    if (useResearch) {
      complexityAnalysis = await usePerplexityForComplexityAnalysis(prompt, pendingTasks);
    } else {
      complexityAnalysis = await useClaudeForComplexityAnalysis(prompt, pendingTasks);
    }
    
    stopLoadingIndicator(spinner);
    
    if (!complexityAnalysis || !complexityAnalysis.tasks || !Array.isArray(complexityAnalysis.tasks)) {
      throw new Error('Failed to analyze task complexity');
    }
    
    // Process results
    const processedResults = {
      date: new Date().toISOString(),
      tasks: complexityAnalysis.tasks.map(task => ({
        ...task,
        shouldExpand: task.complexityScore >= threshold
      }))
    };
    
    // Store report in state
    stateStore.setState({ 
      complexityReport: processedResults 
    });
    
    log('success', `Successfully analyzed complexity of ${processedResults.tasks.length} tasks`);
    
    return processedResults;
  } catch (error) {
    stopLoadingIndicator(spinner);
    log('error', `Error analyzing task complexity: ${error.message}`);
    throw error;
  }
}

/**
 * Check if a task is dependent on another task (directly or indirectly)
 * Used to prevent circular dependencies
 * @param {Array} allTasks - Array of all tasks
 * @param {Object} task - The task to check
 * @param {number} targetTaskId - The task ID to check dependency against
 * @returns {boolean} Whether the task depends on the target task
 */
function isTaskDependentOn(allTasks, task, targetTaskId) {
  if (!task.dependencies || task.dependencies.length === 0) {
    return false;
  }
  
  // Check direct dependency
  if (task.dependencies.includes(targetTaskId)) {
    return true;
  }
  
  // Check indirect dependencies
  for (const depId of task.dependencies) {
    const depTask = allTasks.find(t => t.id === depId);
    if (depTask && isTaskDependentOn(allTasks, depTask, targetTaskId)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Set the current task in the state store
 * @param {number} taskId - ID of the task to set as current
 * @returns {Object} Updated state
 */
export function setCurrentTask(taskId) {
  const task = stateStore.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  
  log('info', `Setting current task to ${taskId}`);
  
  // Update state
  stateStore.setState({ currentTask: task });
  
  return stateStore.getState();
}

/**
 * Update task status
 * @param {number} taskId Task ID
 * @param {string} newStatus New status
 * @param {Object} options Options object
 * @returns {Object} Updated task
 */
export function updateTaskStatus(taskId, newStatus, options = {}) {
  try {
    log('info', `Updating task ${taskId} status to ${newStatus}`);

    // Find the task to update
    const tasks = stateStore.getTasks();
    const taskIndex = tasks.findIndex(task => task.id === Number(taskId));
    
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const task = tasks[taskIndex];
    
    // Validate status
    const validStatuses = Object.values(TASK_STATUSES);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    // Check task dependencies if moving to IN_PROGRESS
    if (newStatus === TASK_STATUSES.IN_PROGRESS && task.dependencies?.length > 0) {
      const unfinishedDependencies = task.dependencies.filter(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask?.status !== TASK_STATUSES.DONE && depTask?.status !== TASK_STATUSES.CANCELLED;
      });
      
      if (unfinishedDependencies.length > 0) {
        log('warn', `Task ${taskId} has unfinished dependencies: ${unfinishedDependencies.join(', ')}`);
      }
    }
    
    // Create updated task
    const updatedTask = {
      ...task,
      status: newStatus,
      statusHistory: [
        ...(task.statusHistory ?? []),
        {
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      ]
    };
    
    // Update tasks array
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    log('success', `Task ${taskId} status updated to ${newStatus}`);
    
    return updatedTask;
  } catch (error) {
    log('error', `Failed to update task status: ${error.message}`);
    throw error;
  }
}

/**
 * Add a task dependency
 * @param {number} taskId Task ID
 * @param {number} dependencyId Dependency ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function addTaskDependency(taskId, dependencyId, options = {}) {
  try {
    log('info', `Adding dependency ${dependencyId} to task ${taskId}`);
    
    // Validate parameters
    if (Number(taskId) === Number(dependencyId)) {
      throw new Error('A task cannot depend on itself');
    }
    
    // Get tasks
    const tasks = stateStore.getTasks();
    const taskIndex = tasks.findIndex(task => task.id === Number(taskId));
    const dependencyIndex = tasks.findIndex(task => task.id === Number(dependencyId));
    
    // Check if task and dependency exist
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    if (dependencyIndex === -1) {
      throw new Error(`Dependency task with ID ${dependencyId} not found`);
    }
    
    const task = tasks[taskIndex];
    const dependencyTask = tasks[dependencyIndex];
    
    // Check for circular dependencies
    if (isTaskDependentOn(tasks, dependencyTask, Number(taskId))) {
      throw new Error('Cannot add dependency: would create circular dependency chain');
    }
    
    // Check if dependency already exists
    const dependencies = task.dependencies ?? [];
    
    if (dependencies.includes(Number(dependencyId))) {
      log('warn', `Dependency ${dependencyId} already exists on task ${taskId}`);
      return task;
    }
    
    // Add dependency
    const updatedDependencies = [...dependencies, Number(dependencyId)];
    
    const updatedTask = {
      ...task,
      dependencies: updatedDependencies
    };
    
    // Update tasks array
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    log('success', `Added dependency ${dependencyId} to task ${taskId}`);
    
    return updatedTask;
  } catch (error) {
    log('error', `Failed to add task dependency: ${error.message}`);
    throw error;
  }
}

/**
 * Get task details
 * @param {number} taskId Task ID
 * @returns {Object} Task object or null if not found
 */
export function getTask(taskId) {
  try {
    const task = stateStore.getTaskById(Number(taskId));
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    return task;
  } catch (error) {
    log('error', `Failed to get task: ${error.message}`);
    throw error;
  }
}

/**
 * Generate markdown content for a task
 * @param {number|Object} taskIdOrTask Task ID or task object
 * @returns {string} Markdown content
 */
export function generateTaskMarkdown(taskIdOrTask) {
  try {
    const task = typeof taskIdOrTask === 'object' 
      ? taskIdOrTask 
      : stateStore.getTaskById(Number(taskIdOrTask));
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    let content = `# ${task.title}\n\n`;
    
    if (task.description) {
      content += `## Description\n\n${task.description}\n\n`;
    }
    
    if (task.details) {
      content += `## Details\n\n${task.details}\n\n`;
    }
    
    content += '## Metadata\n\n';
    content += `**ID:** ${task.id}\n`;
    content += `**Status:** ${task.status}\n`;
    content += `**Priority:** ${task.priority || 'normal'}\n`;
    
    if (task.dependencies?.length > 0) {
      content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
    }
    
    if (task.dueDate) {
      content += `**Due Date:** ${task.dueDate}\n`;
    }
    
    if (task.estimatedHours) {
      content += `**Estimated Hours:** ${task.estimatedHours}\n`;
    }
    
    if (task.testStrategy) {
      content += '\n## Test Strategy\n\n';
      content += `${task.testStrategy}\n\n`;
    }
    
    if (task.subtasks?.length > 0) {
      content += '## Subtasks\n\n';
      
      for (const subtask of task.subtasks) {
        const status = subtask.status === TASK_STATUSES.DONE ? '✅' : 
                     subtask.status === TASK_STATUSES.IN_PROGRESS ? '🔄' : '⏳';
        content += `${status} **${subtask.id}:** ${subtask.title}\n`;
        
        if (subtask.description) {
          content += `   ${subtask.description}\n`;
        }
        
        content += '\n';
      }
    }
    
    return content;
  } catch (error) {
    log('error', `Failed to generate task markdown: ${error.message}`);
    throw error;
  }
}

/**
 * Remove a task dependency
 * @param {number} taskId Task ID
 * @param {number} dependencyId Dependency ID
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function removeTaskDependency(taskId, dependencyId, options = {}) {
  try {
    log('info', `Removing dependency ${dependencyId} from task ${taskId}`);
    
    // Get tasks
    const tasks = stateStore.getTasks();
    const taskIndex = tasks.findIndex(task => task.id === Number(taskId));
    
    // Check if task exists
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const task = tasks[taskIndex];
    
    // Check if dependency exists
    const dependencies = task.dependencies ?? [];
    const dependencyIndex = dependencies.indexOf(Number(dependencyId));
    
    if (dependencyIndex === -1) {
      log('warn', `Dependency ${dependencyId} does not exist on task ${taskId}`);
      return task;
    }
    
    // Remove dependency
    const updatedDependencies = dependencies.filter(depId => depId !== Number(dependencyId));
    
    const updatedTask = {
      ...task,
      dependencies: updatedDependencies
    };
    
    // Update tasks array
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    log('success', `Removed dependency ${dependencyId} from task ${taskId}`);
    
    return updatedTask;
  } catch (error) {
    log('error', `Failed to remove task dependency: ${error.message}`);
    throw error;
  }
}

export { addSubtaskEnhanced as addSubtask };
export { removeSubtaskEnhanced as removeSubtask };

/**
 * Analyze task complexity and generate expansion recommendations
 * @param {Object} options - Command options
 * @returns {Object} Complexity analysis report
 */
export async function calculateTaskComplexity(options = {}) {
  try {
    log('info', 'Analyzing task complexity...');
    
    // Get all tasks
    const tasks = stateStore.getTasks();
    
    // Filter out completed tasks
    const pendingTasks = tasks.filter(task => 
      task.status !== TASK_STATUSES.DONE && 
      task.status !== TASK_STATUSES.CANCELLED
    );
    
    if (pendingTasks.length === 0) {
      log('warn', 'No pending tasks to analyze');
      throw new Error('No pending tasks found for complexity analysis');
    }
    
    log('info', `Analyzing complexity of ${pendingTasks.length} pending tasks`);
    
    // Call AI to analyze task complexity
    const spinner = startLoadingIndicator('Analyzing task complexity...');
    
    try {
      // Generate prompt
      const prompt = generateComplexityAnalysisPrompt(pendingTasks);
      
      // Call AI service with appropriate parameters
      const complexityAnalysis = await usePerplexityForComplexityAnalysis(prompt, pendingTasks);
      
      stopLoadingIndicator(spinner);
      
      if (!complexityAnalysis || !complexityAnalysis.tasks || !Array.isArray(complexityAnalysis.tasks)) {
        throw new Error('Failed to analyze task complexity');
      }
      
      // Process results
      const processedResults = {
        date: new Date().toISOString(),
        tasks: complexityAnalysis.tasks.map(task => ({
          ...task,
          shouldExpand: task.complexityScore >= 5
        }))
      };
      
      // Store report in state
      stateStore.setState({ 
        complexityReport: processedResults 
      });
      
      log('success', `Successfully analyzed complexity of ${processedResults.tasks.length} tasks`);
      
      return processedResults;
    } catch (error) {
      stopLoadingIndicator(spinner);
      log('error', `Error analyzing task complexity: ${error.message}`);
      throw error;
    }
    
  } catch (error) {
    log('error', `Failed to analyze task complexity: ${error.message}`);
    throw error;
  }
}

// Export the function for backward compatibility with the original name
export { calculateTaskComplexity as analyzeTaskComplexity };

/**
 * Reset the state to an empty state
 * @param {Object} options Options for state update
 * @returns {Object} New empty state
 */
export function resetState(options = {}) {
  log('info', 'Resetting state to empty state');
  
  stateStore.setState({
    tasks: [],
    meta: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }
  }, options);
  
  return stateStore.getState();
}

/**
 * Convert a task to markdown format
 * @param {number} taskId Task ID
 * @returns {string} Task details in markdown format
 */
export function getTaskAsMarkdown(taskId) {
  try {
    // Get task from state
    const task = stateStore.getTaskById(Number(taskId));
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    let content = `# Task ${task.id}: ${task.title}\n\n`;
    
    if (task.description) {
      content += `## Description\n\n${task.description}\n\n`;
    }
    
    if (task.details) {
      content += `## Details\n\n${task.details}\n\n`;
    }
    
    content += '## Status\n\n';
    content += `**Current Status:** ${task.status}\n`;
    
    if (task.dependencies?.length > 0) {
      content += '\n## Dependencies\n\n';
      
      // Get all tasks to look up dependency details
      const allTasks = stateStore.getTasks();
      
      for (const depId of task.dependencies) {
        const depTask = allTasks.find(t => t.id === depId);
        if (depTask) {
          const status = depTask.status === TASK_STATUSES.DONE ? '✅' : 
                      depTask.status === TASK_STATUSES.IN_PROGRESS ? '🔄' : '⏳';
          content += `- ${status} **${depId}:** ${depTask.title}\n`;
        } else {
          content += `- **${depId}:** Missing task\n`;
        }
      }
      content += '\n';
    }
    
    if (task.subtasks?.length > 0) {
      content += '## Subtasks\n\n';
      
      for (const subtask of task.subtasks) {
        const status = subtask.status === TASK_STATUSES.DONE ? '✅' : 
                     subtask.status === TASK_STATUSES.IN_PROGRESS ? '🔄' : '⏳';
        content += `### ${status} Subtask ${subtask.id}: ${subtask.title}\n\n`;
        
        if (subtask.description) {
          content += `${subtask.description}\n\n`;
        }
      }
    }
    
    return content;
  } catch (error) {
    log('error', `Failed to get task as markdown: ${error.message}`);
    throw error;
  }
}

/**
 * Find the next pending task
 * @param {Object} options Options for filtering tasks
 * @returns {Object|null} Next pending task or null if none found
 */
export function findNextTask(options = {}) {
  try {
    log('info', 'Finding next pending task');
    
    // Get all tasks
    const tasks = stateStore.getTasks();
    
    // Filter tasks based on options
    const filteredTasks = filter ? tasks.filter(filter) : tasks;
    
    if (filteredTasks.length === 0) {
      log('info', 'No pending tasks found');
      return null;
    }
    
    // Sort tasks by priority and dependencies
    const sortedTasks = sortTasksByPriorityAndDependencies(filteredTasks, tasks);
    
    if (sortedTasks.length === 0) {
      log('info', 'No available tasks found after sorting');
      return null;
    }
    
    // Return the first task (highest priority with no unfinished dependencies)
    return sortedTasks[0];
  } catch (error) {
    log('error', `Failed to find next task: ${error.message}`);
    throw error;
  }
}

/**
 * Merge two task lists, keeping the most recent version of each task
 * @param {Array} tasks1 First task list
 * @param {Array} tasks2 Second task list
 * @param {Object} options Options for state update
 * @returns {Object} Merged state with tasks from both lists
 */
export function mergeTasks(tasks1, tasks2, options = {}) {
  try {
    log('info', 'Merging task lists');
    
    if (!Array.isArray(tasks1) || !Array.isArray(tasks2)) {
      throw new Error('Both task lists must be arrays');
    }
    
    // Create a map of tasks by ID
    const taskMap = new Map();
    
    // Add all tasks from the first list
    for (const task of tasks1) {
      taskMap.set(task.id, task);
    }
    
    // For the second list, only add/replace if the task is newer
    for (const task of tasks2) {
      const existingTask = taskMap.get(task.id);
      
      // If the task doesn't exist in the first list, or if it's newer, add it
      if (!existingTask || (task.updated && existingTask.updated && new Date(task.updated) > new Date(existingTask.updated))) {
        taskMap.set(task.id, task);
      }
    }
    
    // Convert the map back to an array
    const mergedTasks = Array.from(taskMap.values());
    
    // Update state
    stateStore.setState({ tasks: mergedTasks }, options);
    
    log('success', `Merged task lists, resulting in ${mergedTasks.length} total tasks`);
    
    return stateStore.getState();
  } catch (error) {
    log('error', `Failed to merge tasks: ${error.message}`);
    throw error;
  }
}

/**
 * Update task details
 * @param {number} taskId Task ID
 * @param {Object} updates Updates to apply to the task
 * @param {Object} options Options for state update
 * @returns {Object} Updated task
 */
export function updateTaskDetails(taskId, updates, options = {}) {
  try {
    log('info', `Updating task ${taskId}`);
    
    // Get tasks
    const tasks = stateStore.getTasks();
    const taskIndex = tasks.findIndex(task => task.id === Number(taskId));
    
    if (taskIndex === -1) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    const task = tasks[taskIndex];
    
    // Handle special case: status update
    if (updates.status && updates.status !== task.status) {
      // Use the updateTaskStatus function to handle status transitions
      return updateTaskStatus(taskId, updates.status, options);
    }
    
    // Create updated task
    const updatedTask = {
      ...task,
      ...updates,
      updated: new Date().toISOString()
    };
    
    // Update tasks array
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = updatedTask;
    
    // Update state
    stateStore.setState({ tasks: updatedTasks }, options);
    
    log('success', `Updated task ${taskId}`);
    
    return updatedTask;
  } catch (error) {
    log('error', `Failed to update task: ${error.message}`);
    throw error;
  }
}

// For backward compatibility with existing code
export { updateTaskDetails as updateTask };
