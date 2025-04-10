#!/usr/bin/env node

/**
 * generate-task-files.js
 * Script to generate task files from original tasks.json using our new state management architecture
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './modules/utils.js';
import { StateStore } from './modules/state-store.js';
import { displayBanner } from './modules/ui.js';

// Paths
const originalTasksPath = path.resolve('../OR/tasks.json');
const tasksDir = path.resolve('./tasks');

// Initialize state store
const stateStore = new StateStore();

/**
 * Generate individual task files from tasks data
 * @param {string} outputDir Directory to write task files to
 * @returns {Promise<number>} Number of files generated
 */
async function generateTaskFiles(outputDir) {
  try {
    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Get tasks from state
    const { tasks } = stateStore.getState();
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No tasks found in state');
    }
    
    log('info', `Generating task files for ${tasks.length} tasks...`);
    
    // Generate a task file for each task
    const filePromises = tasks.map(async (task) => {
      // Format task ID with leading zeros
      const taskId = String(task.id).padStart(3, '0');
      const taskFilePath = path.join(outputDir, `task_${taskId}.txt`);
      
      // Build task file content
      let content = `# Task ID: ${task.id}\n`;
      content += `# Title: ${task.title}\n`;
      content += `# Status: ${task.status || 'pending'}\n`;
      
      // Add dependencies if they exist
      if (task.dependencies && task.dependencies.length > 0) {
        content += `# Dependencies: ${task.dependencies.join(', ')}\n`;
      } else {
        content += '# Dependencies: None\n';
      }
      
      // Add priority
      content += `# Priority: ${task.priority || 'medium'}\n`;
      
      // Add description
      content += `# Description: ${task.description}\n`;
      
      // Add details if they exist
      if (task.details) {
        content += '# Details:\n';
        content += task.details + '\n';
      }
      
      // Add test strategy if it exists
      if (task.testStrategy) {
        content += '\n# Test Strategy:\n';
        content += task.testStrategy + '\n';
      }
      
      // Add subtasks if they exist
      if (task.subtasks && task.subtasks.length > 0) {
        content += '\n# Subtasks:\n';
        
        // Sort subtasks by ID
        const sortedSubtasks = [...task.subtasks].sort((a, b) => a.id - b.id);
        
        // Add each subtask
        for (const subtask of sortedSubtasks) {
          content += `## ${subtask.id}. ${subtask.title} [${subtask.status || 'pending'}]\n`;
          
          // Add dependencies
          if (subtask.dependencies && subtask.dependencies.length > 0) {
            content += `### Dependencies: ${subtask.dependencies.join(', ')}\n`;
          } else {
            content += '### Dependencies: None\n';
          }
          
          // Add description
          content += `### Description: ${subtask.description}\n`;
          
          // Add details if they exist
          if (subtask.details) {
            content += '### Details:\n';
            content += subtask.details + '\n';
          }
          
          content += '\n';
        }
      }
      
      // Write the task file
      await fs.writeFile(taskFilePath, content, 'utf-8');
      return taskFilePath;
    });
    
    // Wait for all files to be written
    const generatedFiles = await Promise.all(filePromises);
    
    log('success', `Generated ${generatedFiles.length} task files in ${outputDir}`);
    return generatedFiles.length;
  } catch (error) {
    log('error', `Error generating task files: ${error.message}`);
    if (process.env.DEBUG === 'true') {
      console.error(error);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  displayBanner();
  log('info', 'Generating task files from original tasks.json using state management architecture...');
  
  try {
    // Load the original tasks.json
    const tasksData = JSON.parse(await fs.readFile(originalTasksPath, 'utf-8'));
    
    // Initialize state with the tasks data
    await stateStore.initState(tasksData);
    
    // Generate task files
    const numFiles = await generateTaskFiles(tasksDir);
    
    log('success', `Successfully generated ${numFiles} task files from original tasks.json`);
  } catch (error) {
    log('error', `Failed to generate task files: ${error.message}`);
    if (process.env.DEBUG === 'true') {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the main function
main();
