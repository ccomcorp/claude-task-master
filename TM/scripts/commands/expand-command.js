#!/usr/bin/env node

/**
 * expand-command.js
 * Command to expand tasks into subtasks using the state management architecture
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import path from 'node:path';
import { displayBanner, startLoadingIndicator, stopLoadingIndicator } from '../modules/ui.js';
import { CONFIG, log } from '../modules/utils.js';
import { loadTasks, expandTask, expandAllTasks } from '../modules/actions.js';
import { getComplexityReport, processTaskExpansion, processBulkTaskExpansion } from '../modules/ai-manager.js';

// Configure the command
const program = new Command();

program
  .name('expand')
  .description('Expand a task into subtasks using AI')
  .option('-i, --id <taskId>', 'ID of the task to expand')
  .option('-a, --all', 'Expand all eligible tasks')
  .option('-n, --num <number>', 'Number of subtasks to generate', '5')
  .option('-r, --research', 'Use Perplexity for research-backed expansion')
  .option('-c, --complexity <threshold>', 'Only expand tasks with complexity above threshold', '5')
  .option('-o, --overwrite', 'Overwrite existing subtasks')
  .option('-p, --prompt <text>', 'Custom prompt for AI expansion')
  .option('-f, --file <path>', 'Path to tasks.json file')
  .option('--debug', 'Enable debug output')
  .action(handleExpand);

/**
 * Handle the expand command
 * @param {Object} options Command options
 */
async function handleExpand(options) {
  try {
    // Display banner
    displayBanner();
    
    // Set debug mode if specified
    if (options.debug) {
      process.env.DEBUG = 'true';
    }
    
    // Extract options
    const taskId = options.id;
    const expandAll = options.all;
    const numSubtasks = parseInt(options.num, 10);
    const useResearch = options.research;
    const complexityThreshold = parseInt(options.complexity, 10);
    const overwrite = options.overwrite;
    const customPrompt = options.prompt;
    const tasksFilePath = options.file;
    
    // Validate options
    if (!taskId && !expandAll) {
      console.log(boxen(
        chalk.yellow('Error: You must specify either a task ID to expand or use --all to expand all eligible tasks.'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    if (isNaN(numSubtasks) || numSubtasks < 1) {
      console.log(boxen(
        chalk.yellow('Error: Number of subtasks must be a positive integer.'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    // Load tasks
    const spinner = startLoadingIndicator('Loading tasks...');
    await loadTasks(tasksFilePath);
    stopLoadingIndicator(spinner);
    
    // Check if API key is set
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(boxen(
        chalk.yellow('Error: ANTHROPIC_API_KEY is not set in environment variables.') + '\n\n' +
        chalk.white('Set it in your .env file or as an environment variable:') + '\n' +
        chalk.cyan('ANTHROPIC_API_KEY=your_api_key'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    // If research is requested, make sure Perplexity API key is set
    if (useResearch && !process.env.PERPLEXITY_API_KEY) {
      console.log(boxen(
        chalk.yellow('Error: Research option requires PERPLEXITY_API_KEY to be set.') + '\n\n' +
        chalk.white('Set it in your .env file or as an environment variable:') + '\n' +
        chalk.cyan('PERPLEXITY_API_KEY=your_api_key'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    if (expandAll) {
      // Load complexity report if available
      let complexityReport = null;
      try {
        const reportResult = await getComplexityReport({ tasksFilePath });
        if (reportResult.success) {
          complexityReport = reportResult.report;
          log('info', 'Found existing complexity report to guide expansion');
        }
      } catch (error) {
        log('warn', 'No existing complexity report found. Proceeding without complexity guidance.');
      }
      
      const spinner = startLoadingIndicator('Expanding tasks...');
      
      // Expand all eligible tasks
      const result = await processBulkTaskExpansion({
        complexityThreshold,
        pendingOnly: true,
        overwrite,
        tasksFilePath,
        useResearch
      });
      
      stopLoadingIndicator(spinner);
      
      if (result.success) {
        console.log(boxen(
          chalk.green.bold(`✅ Successfully expanded ${result.expanded} tasks`) + '\n\n' +
          chalk.white(`${result.expanded} out of ${result.results.length} eligible tasks were expanded.`),
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));
        
        // Show details of expansion results
        if (result.results && result.results.length > 0) {
          const expandedTasks = result.results.filter(r => r.success);
          const failedTasks = result.results.filter(r => !r.success);
          
          if (expandedTasks.length > 0) {
            console.log(chalk.green.bold('\nSuccessfully expanded tasks:'));
            expandedTasks.forEach(r => {
              console.log(`  ${chalk.cyan('•')} Task ${r.taskId}: ${r.subtaskCount} subtasks created`);
            });
          }
          
          if (failedTasks.length > 0) {
            console.log(chalk.yellow.bold('\nFailed to expand tasks:'));
            failedTasks.forEach(r => {
              console.log(`  ${chalk.red('•')} Task ${r.taskId}: ${r.message}`);
            });
          }
        }
      } else {
        console.log(boxen(
          chalk.red.bold('❌ Failed to expand tasks') + '\n\n' +
          chalk.white(result.error || 'An unknown error occurred'),
          { padding: 1, borderColor: 'red', borderStyle: 'round' }
        ));
      }
    } else {
      // Expand a single task
      const spinner = startLoadingIndicator(`Expanding task ${taskId}...`);
      
      const result = await processTaskExpansion({
        taskId,
        numSubtasks,
        customPrompt,
        overwrite,
        tasksFilePath,
        useResearch
      });
      
      stopLoadingIndicator(spinner);
      
      if (result.success) {
        console.log(boxen(
          chalk.green.bold(`✅ Successfully expanded task ${taskId}`) + '\n\n' +
          chalk.white(`Added ${result.subtaskCount} subtasks to task ${taskId}`),
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));
        
        console.log(boxen(
          chalk.white.bold('Next Steps:') + '\n\n' +
          `${chalk.cyan('1.')} View task details: ${chalk.yellow(`task-master view ${taskId}`)}` + '\n' +
          `${chalk.cyan('2.')} List all tasks: ${chalk.yellow('task-master list')}` + '\n' +
          `${chalk.cyan('3.')} Mark task as in-progress: ${chalk.yellow(`task-master status ${taskId} in-progress`)}`,
          { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
        ));
      } else {
        console.log(boxen(
          chalk.red.bold(`❌ Failed to expand task ${taskId}`) + '\n\n' +
          chalk.white(result.error || 'An unknown error occurred'),
          { padding: 1, borderColor: 'red', borderStyle: 'round' }
        ));
      }
    }
  } catch (error) {
    log('error', `Error executing expand command: ${error.message}`);
    if (process.env.DEBUG === 'true') {
      console.error(error);
    }
    
    console.log(boxen(
      chalk.red.bold('❌ Error expanding task') + '\n\n' +
      chalk.white(error.message),
      { padding: 1, borderColor: 'red', borderStyle: 'round' }
    ));
    
    process.exit(1);
  }
}

// Export the command for use in the CLI
export default program;
