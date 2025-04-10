#!/usr/bin/env node

/**
 * parse-command.js
 * Command to parse a PRD document and generate tasks using the state management architecture
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import path from 'node:path';
import fs from 'node:fs/promises';
import { displayBanner, startLoadingIndicator, stopLoadingIndicator } from '../modules/ui.js';
import { CONFIG, log } from '../modules/utils.js';
import { loadTasks, saveTasks } from '../modules/actions.js';
import { processPRD } from '../modules/ai-manager.js';

// Configure the command
const program = new Command();

program
  .name('parse')
  .description('Parse a PRD document to generate tasks')
  .argument('<prdPath>', 'Path to the PRD file')
  .option('-n, --num <number>', 'Number of tasks to generate (default: 10)', '10')
  .option('-o, --overwrite', 'Overwrite any existing tasks')
  .option('-f, --file <path>', 'Path to tasks.json file')
  .option('--debug', 'Enable debug output')
  .action(handleParsePRD);

/**
 * Handle the parse command
 * @param {string} prdPath Path to the PRD file
 * @param {Object} options Command options
 */
async function handleParsePRD(prdPath, options) {
  try {
    // Display banner
    displayBanner();
    
    // Set debug mode if specified
    if (options.debug) {
      process.env.DEBUG = 'true';
    }
    
    // Extract options
    const numTasks = parseInt(options.num, 10);
    const overwrite = options.overwrite;
    const tasksFilePath = options.file;
    
    // Validate options
    if (isNaN(numTasks) || numTasks < 1) {
      console.log(boxen(
        chalk.yellow('Error: Number of tasks must be a positive integer.'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    // Check if PRD file exists
    try {
      await fs.access(prdPath);
    } catch (error) {
      console.log(boxen(
        chalk.yellow(`Error: PRD file not found at path: ${prdPath}`),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
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
    
    // Load tasks first if not overwriting
    if (!overwrite) {
      const spinner = startLoadingIndicator('Loading existing tasks...');
      try {
        await loadTasks(tasksFilePath);
        stopLoadingIndicator(spinner);
      } catch (error) {
        stopLoadingIndicator(spinner);
        log('warn', 'No existing tasks found. Creating new tasks file.');
      }
    }
    
    // Parse PRD and generate tasks
    const spinner = startLoadingIndicator(`Parsing PRD at ${prdPath}...`);
    
    const result = await processPRD({
      prdPath,
      numTasks,
      tasksFilePath
    });
    
    stopLoadingIndicator(spinner);
    
    if (result.success) {
      console.log(boxen(
        chalk.green.bold('✅ Successfully parsed PRD') + '\n\n' +
        chalk.white(`Generated ${result.taskCount} tasks from PRD`),
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      ));
      
      // Generate task files
      const spinner2 = startLoadingIndicator('Generating task files...');
      
      try {
        // Ensure tasks directory exists
        const tasksDir = path.join(process.cwd(), 'tasks');
        await fs.mkdir(tasksDir, { recursive: true });
        
        // Generate individual task files
        const tasksGenerated = await import('../modules/actions.js').then(m => 
          m.generateTaskFiles(tasksDir, { overwrite: true })
        );
        
        stopLoadingIndicator(spinner2);
        
        console.log(boxen(
          chalk.green.bold('✅ Successfully generated task files') + '\n\n' +
          chalk.white(`Generated ${tasksGenerated.length} task files in the tasks directory`),
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));
      } catch (error) {
        stopLoadingIndicator(spinner2);
        log('error', `Failed to generate task files: ${error.message}`);
        
        console.log(boxen(
          chalk.yellow('Warning: Failed to generate task files') + '\n\n' +
          chalk.white(`Tasks were generated but could not be written to files: ${error.message}`),
          { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
        ));
      }
      
      // Suggest next steps
      console.log(boxen(
        chalk.white.bold('Next Steps:') + '\n\n' +
        `${chalk.cyan('1.')} List all tasks: ${chalk.yellow('task-master list')}` + '\n' +
        `${chalk.cyan('2.')} Analyze task complexity: ${chalk.yellow('task-master analyze-complexity')}` + '\n' +
        `${chalk.cyan('3.')} Start working on the next task: ${chalk.yellow('task-master next')}`,
        { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
      ));
    } else {
      console.log(boxen(
        chalk.red.bold('❌ Failed to parse PRD') + '\n\n' +
        chalk.white(result.error || 'An unknown error occurred'),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
    }
  } catch (error) {
    log('error', `Error executing parse command: ${error.message}`);
    if (process.env.DEBUG === 'true') {
      console.error(error);
    }
    
    console.log(boxen(
      chalk.red.bold('❌ Error parsing PRD') + '\n\n' +
      chalk.white(error.message),
      { padding: 1, borderColor: 'red', borderStyle: 'round' }
    ));
    
    process.exit(1);
  }
}

// Export the command for use in the CLI
export default program;
