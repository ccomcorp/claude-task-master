/**
 * ai-manager.js
 * Central module for coordinating AI services with state management
 * Integrates PRD parsing, complexity analysis, and task expansion functionality
 */

import { log } from './utils.js';
import { parsePRD, parsePRDString } from './prd-parser.js';
import { analyzeTaskComplexity, viewComplexityReport } from './complexity-analyzer.js';
import { expandTask, expandAllTasks } from './task-expander.js';
import { StateStore } from './state-store.js';

// Initialize state store
const stateStore = new StateStore();

/**
 * Parse a PRD and generate tasks
 * @param {Object} options Options for PRD parsing
 * @returns {Promise<Object>} Result of operation
 */
async function processPRD({ prdPath, prdContent, numTasks = 10, tasksFilePath = null }) {
  try {
    // Ensure state is loaded
    await ensureStateLoaded(tasksFilePath);
    
    let result;
    if (prdPath) {
      // Parse from file
      result = await parsePRD(prdPath, numTasks, tasksFilePath);
    } else if (prdContent) {
      // Parse from string
      result = await parsePRDString(prdContent, numTasks);
    } else {
      throw new Error('Either prdPath or prdContent must be provided');
    }
    
    if (!result.success) {
      return result;
    }
    
    log('info', `Generated ${result.taskCount} tasks from PRD`);
    return result;
  } catch (error) {
    log('error', `Error processing PRD: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze task complexity and generate recommendations
 * @param {Object} options Options for complexity analysis
 * @returns {Promise<Object>} Analysis results
 */
async function processComplexityAnalysis({ tasksFilePath = null, threshold = 5, research = false }) {
  try {
    // Ensure state is loaded
    await ensureStateLoaded(tasksFilePath);
    
    // Run the analysis
    const result = await analyzeTaskComplexity({ tasksFilePath, threshold, research });
    
    if (!result.success) {
      return result;
    }
    
    log('info', `Complexity analysis complete. Analyzed ${result.report.complexityAnalysis.length} tasks.`);
    return result;
  } catch (error) {
    log('error', `Error processing complexity analysis: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Expand a single task into subtasks
 * @param {Object} options Options for task expansion
 * @returns {Promise<Object>} Result of expansion
 */
async function processTaskExpansion({ taskId, numSubtasks = 5, customPrompt = null, overwrite = false, tasksFilePath = null }) {
  try {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    // Ensure state is loaded
    await ensureStateLoaded(tasksFilePath);
    
    // Expand the task
    const result = await expandTask(taskId, { numSubtasks, customPrompt, overwrite, tasksFilePath });
    
    if (!result.success) {
      return result;
    }
    
    log('info', `Successfully expanded task ${taskId} into ${result.subtaskCount} subtasks`);
    return result;
  } catch (error) {
    log('error', `Error expanding task: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Expand all eligible tasks into subtasks
 * @param {Object} options Options for bulk task expansion
 * @returns {Promise<Object>} Result of bulk expansion
 */
async function processBulkTaskExpansion({ complexityThreshold = 5, pendingOnly = true, overwrite = false, tasksFilePath = null }) {
  try {
    // Ensure state is loaded
    await ensureStateLoaded(tasksFilePath);
    
    // Expand all eligible tasks
    const result = await expandAllTasks({ complexityThreshold, pendingOnly, overwrite, tasksFilePath });
    
    if (!result.success) {
      return result;
    }
    
    log('info', `Successfully expanded ${result.expanded} tasks`);
    return result;
  } catch (error) {
    log('error', `Error in bulk task expansion: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * View the complexity analysis report
 * @param {Object} options Options for viewing complexity report
 * @returns {Promise<Object>} Complexity report
 */
async function getComplexityReport({ reportPath = null, tasksFilePath = null }) {
  try {
    // Ensure state is loaded
    await ensureStateLoaded(tasksFilePath);
    
    // Get the report
    const result = await viewComplexityReport(reportPath);
    
    if (!result.success) {
      return result;
    }
    
    return result;
  } catch (error) {
    log('error', `Error viewing complexity report: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ensure state is loaded before performing operations
 * @param {string} tasksFilePath Optional custom path to tasks file
 * @returns {Promise<void>}
 */
async function ensureStateLoaded(tasksFilePath = null) {
  // Check if state is already loaded
  const state = stateStore.getState();
  
  // If state is empty, load it
  if (!state.tasks || !Array.isArray(state.tasks) || state.tasks.length === 0) {
    await stateStore.loadState(tasksFilePath);
  }
}

export {
  processPRD,
  processComplexityAnalysis,
  processTaskExpansion,
  processBulkTaskExpansion,
  getComplexityReport
};
