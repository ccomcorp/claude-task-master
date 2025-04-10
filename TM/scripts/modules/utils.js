/**
 * utils.js
 * Utility functions for the Task Master CLI
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

// Configuration and constants
const CONFIG = {
  model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
  maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  debug: process.env.DEBUG === "true",
  logLevel: process.env.LOG_LEVEL || "info",
  defaultSubtasks: parseInt(process.env.DEFAULT_SUBTASKS || "3"),
  defaultPriority: process.env.DEFAULT_PRIORITY || "medium",
  projectName: process.env.PROJECT_NAME || "Task Master",
  projectVersion: "1.5.0" // Hardcoded version - ALWAYS use this value, ignore environment variable
};

// Set up logging based on log level
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Logs a message at the specified level
 * @param {string} level - The log level (debug, info, warn, error)
 * @param  {...any} args - Arguments to log
 */
function log(level, ...args) {
  const icons = {
    debug: chalk.gray('🔍'),
    info: chalk.blue('ℹ️'),
    warn: chalk.yellow('⚠️'),
    error: chalk.red('❌'),
    success: chalk.green('✅')
  };
  
  if (LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.logLevel]) {
    const icon = icons[level] || '';
    console.log(`${icon} ${args.join(' ')}`);
  }
}

/**
 * Sanitizes a prompt string for use in a shell command
 * @param {string} prompt The prompt to sanitize
 * @returns {string} Sanitized prompt
 */
function sanitizePrompt(prompt) {
  // Replace double quotes with escaped double quotes
  return prompt.replace(/"/g, '\\"');
}

/**
 * Reads and parses the complexity report if it exists
 * @param {string} customPath - Optional custom path to the report
 * @returns {Object|null} The parsed complexity report or null if not found
 */
function readComplexityReport(customPath = null) {
  try {
    const reportPath = customPath || path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
    if (!fs.existsSync(reportPath)) {
      return null;
    }
    
    const reportData = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(reportData);
  } catch (error) {
    log('warn', `Could not read complexity report: ${error.message}`);
    return null;
  }
}

/**
 * Finds a task analysis in the complexity report
 * @param {Object} report - The complexity report
 * @param {number} taskId - The task ID to find
 * @returns {Object|null} The task analysis or null if not found
 */
function findTaskInComplexityReport(report, taskId) {
  if (!report || !report.complexityAnalysis || !Array.isArray(report.complexityAnalysis)) {
    return null;
  }
  
  return report.complexityAnalysis.find(task => task.taskId === taskId);
}

/**
 * Truncates text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - The maximum length
 * @returns {string} The truncated text
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Find cycles in a dependency graph using DFS
 * @param {string} subtaskId - Current subtask ID
 * @param {Map} dependencyMap - Map of subtask IDs to their dependencies
 * @param {Set} visited - Set of visited nodes
 * @param {Set} recursionStack - Set of nodes in current recursion stack
 * @returns {Array} - List of dependency edges that need to be removed to break cycles
 */
function findCycles(subtaskId, dependencyMap, visited = new Set(), recursionStack = new Set(), path = []) {
  // Mark the current node as visited and part of recursion stack
  visited.add(subtaskId);
  recursionStack.add(subtaskId);
  path.push(subtaskId);
  
  const cyclesToBreak = [];
  
  // Get all dependencies of the current subtask
  const dependencies = dependencyMap.get(subtaskId) || [];
  
  // For each dependency
  for (const depId of dependencies) {
    // If not visited, recursively check for cycles
    if (!visited.has(depId)) {
      const cycles = findCycles(depId, dependencyMap, visited, recursionStack, [...path]);
      cyclesToBreak.push(...cycles);
    } 
    // If the dependency is in the recursion stack, we found a cycle
    else if (recursionStack.has(depId)) {
      // Find the position of the dependency in the path
      const cycleStartIndex = path.indexOf(depId);
      // The last edge in the cycle is what we want to remove
      const cycleEdges = path.slice(cycleStartIndex);
      // We'll remove the last edge in the cycle (the one that points back)
      cyclesToBreak.push(depId);
    }
  }
  
  // Remove the node from recursion stack before returning
  recursionStack.delete(subtaskId);
  
  return cyclesToBreak;
}

/**
 * Convert a string from camelCase to kebab-case
 * @param {string} str - The string to convert
 * @returns {string} The kebab-case version of the string
 */
const toKebabCase = (str) => {
  // Special handling for common acronyms
  const withReplacedAcronyms = str
    .replace(/ID/g, 'Id')
    .replace(/API/g, 'Api')
    .replace(/UI/g, 'Ui')
    .replace(/URL/g, 'Url')
    .replace(/URI/g, 'Uri')
    .replace(/JSON/g, 'Json')
    .replace(/XML/g, 'Xml')
    .replace(/HTML/g, 'Html')
    .replace(/CSS/g, 'Css');
  
  // Insert hyphens before capital letters and convert to lowercase
  return withReplacedAcronyms
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, ''); // Remove leading hyphen if present
};

/**
 * Detect camelCase flags in command arguments
 * @param {string[]} args - Command line arguments to check
 * @returns {Array<{original: string, kebabCase: string}>} - List of flags that should be converted
 */
function detectCamelCaseFlags(args) {
  const camelCaseFlags = [];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const flagName = arg.split('=')[0].slice(2); // Remove -- and anything after =
      
      // Skip single-word flags - they can't be camelCase
      if (!flagName.includes('-') && !/[A-Z]/.test(flagName)) {
        continue;
      }
      
      // Check for camelCase pattern (lowercase followed by uppercase)
      if (/[a-z][A-Z]/.test(flagName)) {
        const kebabVersion = toKebabCase(flagName);
        if (kebabVersion !== flagName) {
          camelCaseFlags.push({ 
            original: flagName, 
            kebabCase: kebabVersion 
          });
        }
      }
    }
  }
  return camelCaseFlags;
}

/**
 * Check if a file exists
 * @param {string} filepath Path to the file
 * @returns {boolean} True if the file exists
 */
function fileExists(filepath) {
  try {
    return fs.existsSync(filepath);
  } catch (error) {
    return false;
  }
}

// Export all utility functions and configuration
export {
  CONFIG,
  LOG_LEVELS,
  log,
  sanitizePrompt,
  readComplexityReport,
  findTaskInComplexityReport,
  truncate,
  findCycles,
  toKebabCase,
  detectCamelCaseFlags,
  fileExists
};
