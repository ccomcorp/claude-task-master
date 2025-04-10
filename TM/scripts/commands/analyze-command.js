#!/usr/bin/env node

/**
 * analyze-command.js
 * Command to analyze task complexity and provide recommendations for task expansion
 * Uses state-based architecture
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import path from 'node:path';
import { displayBanner, startLoadingIndicator, stopLoadingIndicator, displayComplexityReport } from '../modules/ui.js';
import { CONFIG, log } from '../modules/utils.js';
import { loadTasks } from '../modules/actions.js';
import { processComplexityAnalysis, getComplexityReport } from '../modules/ai-manager.js';

// Configure the command
const program = new Command();

program
  .name('analyze-complexity')
  .description('Analyze task complexity and recommend expansions')
  .option('-t, --threshold <number>', 'Complexity threshold for expansion (default: 5)', '5')
  .option('-r, --research', 'Use Perplexity to do research for better analysis')
  .option('-v, --view-only', 'Only view existing complexity report without generating a new one')
  .option('-f, --file <path>', 'Path to tasks.json file')
  .option('--debug', 'Enable debug output')
  .action(handleAnalyzeComplexity);

/**
 * Handle the analyze-complexity command
 * @param {Object} options Command options
 */
async function handleAnalyzeComplexity(options) {
  try {
    // Display banner
    displayBanner();
    
    // Set debug mode if specified
    if (options.debug) {
      process.env.DEBUG = 'true';
    }
    
    // Extract options
    const threshold = parseInt(options.threshold, 10);
    const research = options.research;
    const viewOnly = options.viewOnly;
    const tasksFilePath = options.file;
    
    // Validate options
    if (isNaN(threshold) || threshold < 1 || threshold > 10) {
      console.log(boxen(
        chalk.yellow('Error: Complexity threshold must be a number between 1 and 10.'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    // Load tasks
    const spinner = startLoadingIndicator('Loading tasks...');
    await loadTasks(tasksFilePath);
    stopLoadingIndicator(spinner);
    
    if (viewOnly) {
      // Just view existing complexity report
      const result = await getComplexityReport({ tasksFilePath });
      
      if (result.success) {
        displayComplexityReport(result.report);
      } else {
        console.log(boxen(
          chalk.yellow('No existing complexity analysis found.') + '\n\n' +
          chalk.white('Run the analyze-complexity command without --view-only to generate a new analysis.'),
          { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
        ));
      }
      return;
    }
    
    // Check if Claude API key is set
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
    if (research && !process.env.PERPLEXITY_API_KEY) {
      console.log(boxen(
        chalk.yellow('Error: Research option requires PERPLEXITY_API_KEY to be set.') + '\n\n' +
        chalk.white('Set it in your .env file or as an environment variable:') + '\n' +
        chalk.cyan('PERPLEXITY_API_KEY=your_api_key'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      process.exit(1);
    }
    
    // Analyze task complexity
    const spinner2 = startLoadingIndicator(
      research 
        ? 'Analyzing task complexity with research (this may take a while)...' 
        : 'Analyzing task complexity...'
    );
    
    const result = await processComplexityAnalysis({ 
      tasksFilePath, 
      threshold, 
      research 
    });
    
    stopLoadingIndicator(spinner2);
    
    if (result.success) {
      // Display the complexity report
      displayComplexityReport(result.report);
      
      // Suggest next steps
      console.log(boxen(
        chalk.white.bold('Suggested Next Steps:') + '\n\n' +
        `${chalk.cyan('1.')} Expand tasks with high complexity: ${chalk.yellow('task-master expand --all')}` + '\n' +
        `${chalk.cyan('2.')} Expand a specific task: ${chalk.yellow('task-master expand --id <task-id>')}` + '\n' +
        `${chalk.cyan('3.')} View this report again later: ${chalk.yellow('task-master analyze-complexity --view-only')}`,
        { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
      ));
    } else {
      console.log(boxen(
        chalk.red.bold('❌ Failed to analyze complexity') + '\n\n' +
        chalk.white(result.error || 'An unknown error occurred'),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
    }
  } catch (error) {
    log('error', `Error executing analyze-complexity command: ${error.message}`);
    if (process.env.DEBUG === 'true') {
      console.error(error);
    }
    
    console.log(boxen(
      chalk.red.bold('❌ Error analyzing task complexity') + '\n\n' +
      chalk.white(error.message),
      { padding: 1, borderColor: 'red', borderStyle: 'round' }
    ));
    
    process.exit(1);
  }
}

// Export the command for use in the CLI
export default program;
