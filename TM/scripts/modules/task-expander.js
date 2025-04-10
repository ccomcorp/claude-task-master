/**
 * task-expander.js
 * Expand tasks into subtasks using AI
 * Uses state-based architecture
 */

import { log, readFile } from './utils.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { CONFIG, generateSubtaskPrompt, handleClaudeError } from './ai-services.js';
import { addSubtasks, updateTaskStatus } from './actions.js';
import { StateStore } from './state-store.js';

// Initialize state store
const stateStore = new StateStore();

// Configure Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

/**
 * Expand a task into subtasks using AI
 * @param {number|string} taskId Task ID to expand
 * @param {Object} options Options for task expansion
 * @param {number} options.numSubtasks Number of subtasks to generate
 * @param {string} options.customPrompt Custom prompt for subtask generation
 * @param {boolean} options.overwrite Whether to overwrite existing subtasks
 * @param {string} options.tasksFilePath Custom path to tasks file
 * @returns {Promise<Object>} Result of expansion
 */
async function expandTask(taskId, { numSubtasks = 5, customPrompt = null, overwrite = false, tasksFilePath = null } = {}) {
  try {
    // Initialize state if not already loaded
    if (Object.keys(stateStore.getState()).length === 0) {
      await stateStore.loadState(tasksFilePath);
    }
    
    // Get current state
    const { tasks } = stateStore.getState();
    
    if (!tasks || !Array.isArray(tasks)) {
      throw new Error('No tasks found in state');
    }
    
    // Find the task to expand
    const task = tasks.find(t => t.id === Number(taskId) || t.id === taskId);
    
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    log('info', `Expanding task: ${task.title} (ID: ${task.id})`);
    
    // Check if task already has subtasks and overwrite is false
    if (task.subtasks && task.subtasks.length > 0 && !overwrite) {
      return {
        success: false,
        error: `Task already has ${task.subtasks.length} subtasks. Use --overwrite to replace them.`,
        subtaskCount: task.subtasks.length
      };
    }
    
    // Get a prompt for subtask generation
    let prompt;
    
    if (customPrompt) {
      prompt = customPrompt;
    } else if (task.complexity && task.complexity.expansionPrompt) {
      // Use the AI-generated expansion prompt from complexity analysis
      prompt = task.complexity.expansionPrompt;
    } else {
      // Generate a default prompt
      prompt = generateSubtaskPrompt(task, numSubtasks);
    }
    
    // Call Claude to generate subtasks
    log('debug', 'Calling Claude to generate subtasks...');
    
    const response = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
      system: `You are an AI assistant helping to break down software development tasks into specific, actionable subtasks.
Each subtask should be clear, concrete, and small enough to be completed in a reasonable amount of time.
Your response must be formatted as a JSON array of subtask objects.`,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    // Extract the response content
    const content = response.content[0].text;
    
    // Parse subtasks from the response
    const subtasks = parseSubtasksFromText(content);
    
    if (!subtasks || !Array.isArray(subtasks)) {
      throw new Error('Failed to parse subtasks from Claude response');
    }
    
    // Prepare subtasks for the task
    const preparedSubtasks = subtasks.map((subtask, index) => ({
      id: index + 1,
      title: subtask.title,
      description: subtask.description,
      details: subtask.details || '',
      status: 'pending',
      dependencies: subtask.dependencies || []
    }));
    
    // Add subtasks to the task using the action creator
    const result = await addSubtasks(taskId, preparedSubtasks, { overwrite });
    
    if (!result.success) {
      throw new Error(`Failed to add subtasks: ${result.error}`);
    }
    
    // Update task status if it's not already in-progress or complete
    if (task.status === 'pending') {
      await updateTaskStatus(taskId, 'in-progress');
    }
    
    return {
      success: true,
      message: `Added ${preparedSubtasks.length} subtasks to task ${taskId}`,
      subtaskCount: preparedSubtasks.length
    };
  } catch (error) {
    log('error', `Error expanding task: ${error.message}`);
    
    if (error.response) {
      log('debug', handleClaudeError(error));
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Expand all tasks that meet certain criteria
 * @param {Object} options Options for expanding all tasks
 * @param {number} options.complexityThreshold Only expand tasks with complexity above this threshold
 * @param {boolean} options.pendingOnly Only expand pending tasks
 * @param {boolean} options.overwrite Whether to overwrite existing subtasks
 * @param {string} options.tasksFilePath Custom path to tasks file
 * @returns {Promise<Object>} Results of bulk expansion
 */
async function expandAllTasks({ complexityThreshold = 5, pendingOnly = true, overwrite = false, tasksFilePath = null } = {}) {
  try {
    // Initialize state if not already loaded
    if (Object.keys(stateStore.getState()).length === 0) {
      await stateStore.loadState(tasksFilePath);
    }
    
    // Get current state
    const { tasks } = stateStore.getState();
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No tasks found in state');
    }
    
    // Filter tasks to expand
    const tasksToExpand = tasks.filter(task => {
      // Skip tasks that already have subtasks if not overwriting
      if (task.subtasks && task.subtasks.length > 0 && !overwrite) {
        return false;
      }
      
      // Apply pending filter if enabled
      if (pendingOnly && task.status !== 'pending') {
        return false;
      }
      
      // Apply complexity threshold if available
      if (task.complexity && task.complexity.score !== undefined) {
        return task.complexity.score >= complexityThreshold;
      }
      
      // Include all remaining tasks
      return true;
    });
    
    log('info', `Found ${tasksToExpand.length} tasks to expand`);
    
    if (tasksToExpand.length === 0) {
      return {
        success: true,
        message: 'No tasks eligible for expansion',
        expanded: 0
      };
    }
    
    // Expand each task sequentially (to avoid API rate limits)
    const results = [];
    for (const task of tasksToExpand) {
      log('info', `Expanding task ${task.id}: ${task.title}`);
      
      // Calculate subtask count based on complexity if available
      let numSubtasks = 5; // Default
      
      if (task.complexity && task.complexity.recommendedSubtasks) {
        numSubtasks = task.complexity.recommendedSubtasks;
      }
      
      // Expand the task
      const result = await expandTask(task.id, {
        numSubtasks,
        overwrite,
        tasksFilePath: null // Already loaded state
      });
      
      results.push({
        taskId: task.id,
        success: result.success,
        message: result.message || result.error,
        subtaskCount: result.subtaskCount || 0
      });
      
      // Brief pause to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Count successful expansions
    const successfulExpansions = results.filter(r => r.success).length;
    
    return {
      success: true,
      message: `Expanded ${successfulExpansions} out of ${tasksToExpand.length} tasks`,
      results,
      expanded: successfulExpansions
    };
  } catch (error) {
    log('error', `Error expanding all tasks: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse subtasks from Claude's response
 * @param {string} text Response text from Claude
 * @returns {Array|null} Parsed subtasks or null if parsing failed
 */
function parseSubtasksFromText(text) {
  try {
    // Try to find JSON in the text
    const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    
    if (match) {
      return JSON.parse(match[0]);
    }
    
    // If no direct match, try to find array bounds
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return JSON.parse(text.substring(startIndex, endIndex + 1));
    }
    
    // If all else fails, attempt to parse the entire text
    return JSON.parse(text);
  } catch (error) {
    log('error', `Error parsing subtasks from text: ${error.message}`);
    return null;
  }
}

export {
  expandTask,
  expandAllTasks
};
