/**
 * Action Creators Module
 * 
 * Defines functions that encapsulate state mutations through the state store.
 * All operations that modify task state should go through these action creators
 * rather than directly manipulating the state or performing file I/O.
 */

import path from 'path';
import fs from 'fs/promises';
import stateStore, { TASK_STATUSES } from './state-store.js';
import { log, CONFIG } from './utils.js';

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
    while (currentTask && currentTask.dependencies && currentTask.dependencies.length > 0) {
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
    const tasksDir = outputDir || (CONFIG && CONFIG.taskFilesDir) || 'tasks/files';
    
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
  
  if (task.dependencies && task.dependencies.length > 0) {
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
  
  if (task.subtasks && task.subtasks.length > 0) {
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
 * @param {Object} options Options for task expansion
 * @returns {Promise<Object>} Updated task with subtasks
 */
export async function expandTask(taskId, options = {}) {
  try {
    // Get task
    const task = stateStore.getTaskById(Number(taskId));
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // TODO: Implement actual expansion logic (preserved from original implementation)
    // For now, we'll create placeholder subtasks
    
    const placeholderSubtasks = [
      {
        id: 1,
        title: 'Placeholder Subtask 1',
        description: 'This is a placeholder subtask',
        status: TASK_STATUSES.PENDING
      },
      {
        id: 2,
        title: 'Placeholder Subtask 2',
        description: 'This is another placeholder subtask',
        status: TASK_STATUSES.PENDING
      }
    ];
    
    // Update task with subtasks
    const updatedTask = stateStore.updateTask(Number(taskId), {
      subtasks: placeholderSubtasks
    });
    
    log(`Task expanded: ${task.title} (ID: ${task.id})`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to expand task: ${error.message}`, 'error');
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
    
    // Update task with empty subtasks array
    const updatedTask = stateStore.updateTask(Number(taskId), {
      subtasks: []
    }, options);
    
    log(`Subtasks cleared from task: ${task.title} (ID: ${task.id})`, 'success');
    return updatedTask;
  } catch (error) {
    log(`Failed to clear subtasks: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Analyze task complexity and generate a report
 * @param {Object} options Options for analysis
 * @returns {Promise<Object>} Complexity report
 */
export async function analyzeTaskComplexity(options = {}) {
  try {
    const { 
      outputPath = null,
      factors = {
        dependencyCount: true,
        subtaskCount: true,
        detailsLength: true,
        statusPenalty: true
      }
    } = options;
    
    // Get tasks
    const tasks = stateStore.getTasks();
    
    if (tasks.length === 0) {
      throw new Error('No tasks found to analyze');
    }
    
    // Calculate complexity scores
    const taskScores = tasks.map(task => {
      let score = 0;
      const details = [];
      
      // Factor: Number of dependencies
      if (factors.dependencyCount && task.dependencies && task.dependencies.length > 0) {
        const depScore = task.dependencies.length * 10;
        score += depScore;
        details.push({
          factor: 'Dependencies',
          score: depScore,
          description: `${task.dependencies.length} dependencies`
        });
      }
      
      // Factor: Number of subtasks
      if (factors.subtaskCount && task.subtasks && task.subtasks.length > 0) {
        const subtaskScore = task.subtasks.length * 5;
        score += subtaskScore;
        details.push({
          factor: 'Subtasks',
          score: subtaskScore,
          description: `${task.subtasks.length} subtasks`
        });
      }
      
      // Factor: Length of details
      if (factors.detailsLength && task.details) {
        const detailsLength = task.details.length;
        const detailsScore = Math.floor(detailsLength / 100) * 5;
        score += detailsScore;
        details.push({
          factor: 'Details complexity',
          score: detailsScore,
          description: `${detailsLength} characters in details`
        });
      }
      
      // Factor: Status penalty (done tasks have lower complexity)
      if (factors.statusPenalty && task.status === TASK_STATUSES.DONE) {
        const statusPenalty = -20;
        score += statusPenalty;
        details.push({
          factor: 'Status modifier',
          score: statusPenalty,
          description: 'Task is already done'
        });
      }
      
      // Ensure minimum score is 1
      score = Math.max(1, score);
      
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        score,
        details
      };
    });
    
    // Sort by complexity score (descending)
    taskScores.sort((a, b) => b.score - a.score);
    
    // Calculate statistics
    const totalScore = taskScores.reduce((sum, task) => sum + task.score, 0);
    const averageScore = Math.round(totalScore / taskScores.length);
    const maxScore = Math.max(...taskScores.map(task => task.score));
    const minScore = Math.min(...taskScores.map(task => task.score));
    
    // Create complexity bands
    const highComplexity = taskScores.filter(task => task.score >= averageScore * 1.5);
    const mediumComplexity = taskScores.filter(task => task.score >= averageScore * 0.75 && task.score < averageScore * 1.5);
    const lowComplexity = taskScores.filter(task => task.score < averageScore * 0.75);
    
    // Build report
    const report = {
      timestamp: new Date().toISOString(),
      taskCount: tasks.length,
      statistics: {
        totalScore,
        averageScore,
        maxScore,
        minScore
      },
      complexityBands: {
        high: {
          count: highComplexity.length,
          percentage: Math.round((highComplexity.length / tasks.length) * 100)
        },
        medium: {
          count: mediumComplexity.length,
          percentage: Math.round((mediumComplexity.length / tasks.length) * 100)
        },
        low: {
          count: lowComplexity.length,
          percentage: Math.round((lowComplexity.length / tasks.length) * 100)
        }
      },
      taskScores
    };
    
    // Save report if output path is provided
    if (outputPath) {
      const reportDir = path.dirname(outputPath);
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
      log(`Complexity report saved to: ${outputPath}`, 'success');
    }
    
    return report;
  } catch (error) {
    log(`Failed to analyze task complexity: ${error.message}`, 'error');
    throw error;
  }
}
