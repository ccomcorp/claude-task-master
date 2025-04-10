/**
 * prd-parser.js
 * Parse PRD documents and generate task lists using Claude
 * Uses the state-based architecture
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, log } from './utils.js';
import { callClaude, handleStreamingRequest, processClaudeResponse } from './ai-services.js';
import { addTasks, updateTaskDetails } from './actions.js';
import { StateStore } from './state-store.js';

// Initialize state store
const stateStore = new StateStore();

/**
 * Parse a PRD and generate tasks using Claude
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate 
 * @param {string} tasksFilePath - Optional custom path for tasks file
 * @returns {Promise<Object>} Result of the operation
 */
async function parsePRD(prdPath, numTasks = 10, tasksFilePath = null) {
  try {
    log('info', `Parsing PRD at ${prdPath}`);
    
    // Validate PRD path
    try {
      await fs.access(prdPath);
    } catch (error) {
      throw new Error(`PRD file not found at path: ${prdPath}`);
    }
    
    // Read PRD content
    const prdContent = await fs.readFile(prdPath, 'utf8');
    
    // Initialize state if not already loaded
    if (Object.keys(stateStore.getState()).length === 0) {
      await stateStore.loadState(tasksFilePath);
    }
    
    // Call Claude to generate tasks
    const claudeResponse = await callClaude(prdContent, prdPath, numTasks);
    
    if (!claudeResponse.success) {
      throw new Error(`Failed to generate tasks: ${claudeResponse.error}`);
    }
    
    const { tasks } = claudeResponse;
    
    // Get current state
    const currentState = stateStore.getState();
    
    // Add project metadata if it's a new file
    let meta = currentState.meta || {};
    
    if (!meta.projectName) {
      // Extract project name from PRD
      const projectName = extractProjectNameFromPRD(prdContent) || CONFIG.projectName || 'Task Master Project';
      meta = {
        ...meta,
        projectName,
        createdAt: new Date().toISOString(),
        version: CONFIG.projectVersion || '1.0.0',
        prdFile: prdPath
      };
    }
    
    // Use addTasks action to add the tasks to state
    const result = await addTasks(tasks, { overwrite: true });
    
    // Update metadata
    if (result.success) {
      stateStore.setState({
        meta: {
          ...meta,
          updatedAt: new Date().toISOString(),
          taskCount: tasks.length
        }
      });
    }
    
    return {
      success: result.success,
      message: `Generated ${tasks.length} tasks from PRD`,
      taskCount: tasks.length
    };
  } catch (error) {
    log('error', `Error parsing PRD: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse a PRD string directly
 * @param {string} prdContent - PRD content string
 * @param {number} numTasks - Number of tasks to generate
 * @returns {Promise<Object>} Result of the operation
 */
async function parsePRDString(prdContent, numTasks = 10) {
  try {
    if (!prdContent) {
      throw new Error('No PRD content provided');
    }
    
    // Initialize state if not already loaded
    if (Object.keys(stateStore.getState()).length === 0) {
      await stateStore.loadState();
    }
    
    // Call Claude to generate tasks
    const claudeResponse = await callClaude(prdContent, 'string-input', numTasks);
    
    if (!claudeResponse.success) {
      throw new Error(`Failed to generate tasks: ${claudeResponse.error}`);
    }
    
    const { tasks } = claudeResponse;
    
    // Use addTasks action to add the tasks to state
    const result = await addTasks(tasks, { overwrite: true });
    
    // Update metadata
    if (result.success) {
      const currentState = stateStore.getState();
      const meta = currentState.meta || {};
      
      stateStore.setState({
        meta: {
          ...meta,
          updatedAt: new Date().toISOString(),
          taskCount: tasks.length
        }
      });
    }
    
    return {
      success: result.success,
      message: `Generated ${tasks.length} tasks from PRD content`,
      taskCount: tasks.length
    };
  } catch (error) {
    log('error', `Error parsing PRD string: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract project name from PRD content
 * @param {string} prdContent - The PRD content
 * @returns {string|null} Project name or null if not found
 */
function extractProjectNameFromPRD(prdContent) {
  try {
    // Look for a title in the PRD
    const titleMatch = prdContent.match(/^#\s+(.*?)(?:\n|$)/m) || 
                     prdContent.match(/^Title:\s+(.*?)(?:\n|$)/mi) ||
                     prdContent.match(/^Project:\s+(.*?)(?:\n|$)/mi) ||
                     prdContent.match(/^Product:\s+(.*?)(?:\n|$)/mi);
    
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    log('warn', `Error extracting project name from PRD: ${error.message}`);
    return null;
  }
}

export {
  parsePRD,
  parsePRDString,
  extractProjectNameFromPRD
};
