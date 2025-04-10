/**
 * ui.js
 * User interface functions for the Task Master CLI
 */

import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import stateStore from './state-store.js';
import { log } from './utils.js';

/**
 * Get a colored status string based on the status value
 * @param {string} status - Task status (e.g., "done", "pending", "in-progress")
 * @param {boolean} forTable - Whether the status is being displayed in a table
 * @returns {string} Colored status string
 */
function getStatusWithColor(status, forTable = false) {
  if (!status) {
    return chalk.gray('❓ unknown');
  }
  
  const statusConfig = {
    'done': { color: chalk.green, icon: '✅', tableIcon: '✓' },
    'completed': { color: chalk.green, icon: '✅', tableIcon: '✓' },
    'pending': { color: chalk.yellow, icon: '⏱️', tableIcon: '⏱' },
    'in-progress': { color: chalk.hex('#FFA500'), icon: '🔄', tableIcon: '►' },
    'deferred': { color: chalk.gray, icon: '⏱️', tableIcon: '⏱' },
    'blocked': { color: chalk.red, icon: '❌', tableIcon: '✗' },
    'review': { color: chalk.magenta, icon: '👀', tableIcon: '👁' }
  };
  
  const config = statusConfig[status.toLowerCase()] || { color: chalk.red, icon: '❌', tableIcon: '✗' };
  
  // Use simpler icons for table display to prevent border issues
  if (forTable) {
    // Use ASCII characters instead of Unicode for completely stable display
    const simpleIcons = {
      'done': '✓',
      'completed': '✓', 
      'pending': '○',
      'in-progress': '►',
      'deferred': 'x',
      'blocked': '!', 
      'review': '?'
    };
    const simpleIcon = simpleIcons[status.toLowerCase()] || 'x';
    return `${config.color(`${simpleIcon} ${status}`)}`;
  }
  
  return `${config.color(`${config.icon} ${status}`)}`;
}

/**
 * Format dependencies list with status indicators
 * @param {Array} dependencies - Array of dependency IDs
 * @param {Array} allTasks - Array of all tasks
 * @param {boolean} forConsole - Whether the output is for console display
 * @returns {string} Formatted dependencies string
 */
function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
    return forConsole ? chalk.gray('None') : 'None';
  }
  
  const formattedDeps = dependencies.map(depId => {
    const depIdStr = depId.toString(); // Ensure string format for display
    
    // Check if it's already a fully qualified subtask ID (like "22.1")
    if (depIdStr.includes('.')) {
      const [parentId, subtaskId] = depIdStr.split('.').map(id => Number.parseInt(id, 10));
      
      // Find the parent task
      const parentTask = allTasks.find(t => t.id === parentId);
      if (!parentTask || !parentTask.subtasks) {
        return forConsole ? 
          chalk.red(`${depIdStr} (Not found)`) : 
          `${depIdStr} (Not found)`;
      }
      
      // Find the subtask
      const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
      if (!subtask) {
        return forConsole ? 
          chalk.red(`${depIdStr} (Not found)`) : 
          `${depIdStr} (Not found)`;
      }
      
      // Format with status
      const status = subtask.status || 'pending';
      const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
      const isInProgress = status.toLowerCase() === 'in-progress';
      
      if (forConsole) {
        if (isDone) {
          return chalk.green.bold(depIdStr);
        }
        
        if (isInProgress) {
          return chalk.hex('#FFA500').bold(depIdStr);
        }
        
        return chalk.red.bold(depIdStr);
      }
      
      // For plain text output (task files), return just the ID without any formatting or emoji
      return depIdStr;
    }
    
    // For regular task dependencies (not subtasks)
    // Convert string depId to number if needed
    const numericDepId = typeof depId === 'string' ? Number.parseInt(depId, 10) : depId;
    
    // Look up the task using the numeric ID
    const depTask = allTasks.find(task => task.id === numericDepId);
    
    if (!depTask) {
      return forConsole ? 
        chalk.red(`${depIdStr} (Not found)`) : 
        `${depIdStr} (Not found)`;
    }
    
    // Format with status
    const status = depTask.status || 'pending';
    const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
    const isInProgress = status.toLowerCase() === 'in-progress';
    
    if (forConsole) {
      if (isDone) {
        return chalk.green.bold(depIdStr);
      }
      
      if (isInProgress) {
        return chalk.yellow.bold(depIdStr);
      }
      
      return chalk.red.bold(depIdStr);
    }
    
    // For plain text output (task files), return just the ID without any formatting or emoji
    return depIdStr;
  });
  
  return formattedDeps.join(', ');
}

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength - 3)}...`;
}

/**
 * Display the next task to work on
 */
function displayNextTask() {
  log('info', 'Displaying next task');
  
  // Get state from state store instead of reading from file
  const state = stateStore.getState();
  const tasks = state.tasks || [];
  
  if (!tasks || tasks.length === 0) {
    console.log(boxen(
      chalk.yellow('No tasks found.'),
      { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
    ));
    return;
  }
  
  // Find the next task (task with no dependencies or with all dependencies complete)
  let nextTask = null;
  
  for (const task of tasks) {
    // Skip completed tasks
    if (task.status === 'done' || task.status === 'completed') {
      continue;
    }
    
    // Check if the task has dependencies
    if (!task.dependencies || task.dependencies.length === 0) {
      nextTask = task;
      break;
    }
    
    // Check if all dependencies are complete
    let allDependenciesMet = true;
    for (const depId of task.dependencies) {
      const dependency = tasks.find(t => t.id === depId);
      if (!dependency || dependency.status !== 'done') {
        allDependenciesMet = false;
        break;
      }
    }
    
    if (allDependenciesMet) {
      nextTask = task;
      break;
    }
  }
  
  if (!nextTask) {
    console.log(boxen(
      `${chalk.yellow('No eligible tasks found!\n\n')}All pending tasks have unsatisfied dependencies, or all tasks are completed.`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    return;
  }
  
  // Display the task in a nice format
  console.log(boxen(
    chalk.white.bold(`Next Task: #${nextTask.id} - ${nextTask.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, Math.min(75, (process.stdout.columns - 20) || 60)],
    wordWrap: true
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[nextTask.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), nextTask.id.toString()],
    [chalk.cyan.bold('Title:'), nextTask.title],
    [chalk.cyan.bold('Priority:'), priorityColor(nextTask.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(nextTask.dependencies, tasks, true)],
    [chalk.cyan.bold('Description:'), nextTask.description || 'No description provided.']
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (nextTask.details && nextTask.details.trim().length > 0) {
    console.log(boxen(
      `${chalk.white.bold('Implementation Details:')}\n\n${nextTask.details}`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Calculate available width for the subtask table
    const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect
    
    // Define percentage-based column widths
    const idWidthPct = 8;
    const statusWidthPct = 15;
    const depsWidthPct = 25;
    const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;
    
    // Calculate actual column widths
    const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
    const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
    const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
    const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));
    
    // Define the subtask table
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Dependencies'), 
        chalk.magenta.bold('Title')
      ],
      colWidths: [idWidth, statusWidth, depsWidth, titleWidth],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      wordWrap: true
    });
    
    // Add subtasks to table
    for (const st of nextTask.subtasks) {
      subtaskTable.push([
        `${nextTask.id}.${st.id}`,
        getStatusWithColor(st.status || 'pending', true),
        formatDependenciesWithStatus(st.dependencies, nextTask.subtasks, true),
        truncate(st.title, titleWidth - 5)
      ]);
    }
    
    console.log(subtaskTable.toString());
  }
  
  // Show action suggestions
  console.log(boxen(
    `${chalk.white.bold('Suggested Actions:')}\n` +
    `${chalk.cyan('1.')} Start working on this task: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
    `${chalk.cyan('2.')} Mark as completed: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=done`)}\n` +
    `${chalk.cyan('3.')} ${
      nextTask.subtasks?.length > 0 ?
      `View/manage subtasks: ${chalk.yellow(`task-master list --parent=${nextTask.id}`)}` :
      `Add subtasks: ${chalk.yellow(`task-master add-subtask --parent=${nextTask.id}`)}`
    }`,
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Display a specific task by ID
 * @param {string|number} taskId - The ID of the task to display
 */
function displayTaskById(taskId) {
  log('info', `Displaying task #${taskId}`);

  // Get state from state store instead of reading from file
  const state = stateStore.getState();
  const tasks = state.tasks || [];
  
  // Parse complex task ID (potentially in the format 'parentId.subtaskId')
  let parsedTask = null;
  
  if (String(taskId).includes('.')) {
    // This is a subtask reference
    const [parentId, subtaskId] = String(taskId).split('.').map(id => Number.parseInt(id, 10));
    
    // Find the parent task
    const parentTask = tasks.find(t => t.id === parentId);
    if (!parentTask || !parentTask.subtasks) {
      console.log(boxen(
        chalk.red(`Task with ID ${taskId} not found.`),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
      return;
    }
    
    // Find the subtask
    const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      console.log(boxen(
        chalk.red(`Subtask with ID ${taskId} not found.`),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
      return;
    }
    
    // Create a synthetic task object combining parent and subtask info
    parsedTask = {
      ...subtask,
      id: taskId,
      parentTaskId: parentId,
      isSubtask: true,
      // Add any missing properties that might be needed for display
      originalParentTask: parentTask
    };
  } else {
    // This is a regular task ID
    const numericId = Number.parseInt(taskId, 10);
    parsedTask = tasks.find(t => t.id === numericId);
    
    if (!parsedTask) {
      console.log(boxen(
        chalk.red(`Task with ID ${taskId} not found.`),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
      return;
    }
  }
  
  // Display the task in a nice format
  console.log(boxen(
    chalk.white.bold(`Task: #${parsedTask.id} - ${parsedTask.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, Math.min(75, (process.stdout.columns - 20) || 60)],
    wordWrap: true
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[parsedTask.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), parsedTask.id.toString()],
    [chalk.cyan.bold('Title:'), parsedTask.title],
    [chalk.cyan.bold('Status:'), getStatusWithColor(parsedTask.status || 'pending', true)],
    [chalk.cyan.bold('Priority:'), priorityColor(parsedTask.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(parsedTask.dependencies, tasks, true)],
    [chalk.cyan.bold('Description:'), parsedTask.description || 'No description provided.']
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (parsedTask.details && parsedTask.details.trim().length > 0) {
    console.log(boxen(
      `${chalk.white.bold('Implementation Details:')}\n\n${parsedTask.details}`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show test strategy if available
  if (parsedTask.testStrategy && parsedTask.testStrategy.trim().length > 0) {
    console.log(boxen(
      `${chalk.white.bold('Test Strategy:')}\n\n${parsedTask.testStrategy}`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Calculate available width for the subtask table
    const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect
    
    // Define column widths
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Title')
      ],
      colWidths: [8, 15, availableWidth - 28],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      wordWrap: true
    });
    
    // Add subtasks to table
    for (const st of parsedTask.subtasks) {
      subtaskTable.push([
        `${parsedTask.id}.${st.id}`,
        getStatusWithColor(st.status || 'pending', true),
        truncate(st.title, availableWidth - 33)
      ]);
    }
    
    console.log(subtaskTable.toString());
  }
  
  // Show action suggestions
  const statusOptions = {
    'pending': ['in-progress', 'done'],
    'in-progress': ['pending', 'done'],
    'done': ['pending', 'in-progress'],
    'completed': ['pending', 'in-progress']
  };
  
  const currentStatus = parsedTask.status || 'pending';
  const nextStatuses = statusOptions[currentStatus] || ['in-progress', 'done'];
  
  console.log(boxen(
    `${chalk.white.bold('Suggested Actions:')}\n${
      nextStatuses.map((status, i) => 
        `${chalk.cyan(`${i+1}.`)} Mark as ${status}: ${chalk.yellow(`task-master set-status --id=${parsedTask.id} --status=${status}`)}`
      ).join('\n')}\n${
      chalk.cyan(`${nextStatuses.length+1}.`)} ${
        parsedTask.subtasks?.length > 0 ?
        `View/manage subtasks: ${chalk.yellow(`task-master list --parent=${parsedTask.id}`)}` :
        `Add subtasks: ${chalk.yellow(`task-master add-subtask --parent=${parsedTask.id}`)}`
      }`,
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

export {
  getStatusWithColor,
  formatDependenciesWithStatus,
  truncate,
  displayNextTask,
  displayTaskById
};
