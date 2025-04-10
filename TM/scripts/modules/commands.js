/**
 * commands.js
 * Command-line interface for the Task Master CLI
 * Refactored to use centralized state management
 */

import { program } from 'commander';
import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';

import { CONFIG, log } from './utils.js';
import stateStore from './state-store.js';
import * as actions from './actions.js';
import * as ui from './ui.js';
import { 
  addDependency,
  removeDependency,
  validateDependenciesCommand,
  fixDependenciesCommand,
  taskHasDependency,
  taskHasBlockingDependencies 
} from './dependency-manager.js';

const {
  displayBanner,
  displayHelp,
  displayNextTask,
  displayTaskById,
  displayComplexityReport,
  getStatusWithColor
} = ui;

/**
 * Configure and register CLI commands
 * @param {Object} programInstance - Commander program instance
 */
function registerCommands(programInstance) {
  // Default help
  programInstance.on('--help', () => {
    displayHelp();
  });
  
  // parse-prd command
  programInstance
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file (alternative to positional argument)')
    .option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .action(async (file, options) => {
      try {
        // Use input option if file argument not provided
        const inputFile = file || options.input;
        const defaultPrdPath = 'scripts/prd.txt';
        
        // If no input file specified, check for default PRD location
        if (!inputFile) {
          try {
            await fs.access(defaultPrdPath, constants.R_OK);
            console.log(chalk.blue(`Using default PRD file: ${defaultPrdPath}`));
            const numTasks = Number.parseInt(options.numTasks, 10);
            const outputPath = options.output;
            
            console.log(chalk.blue(`Generating ${numTasks} tasks...`));
            await actions.parsePRD(defaultPrdPath, outputPath, numTasks);
            return;
          } catch (err) {
            console.log(chalk.yellow('No PRD file specified and default PRD file not found at scripts/prd.txt.'));
            console.log(boxen(
              `${chalk.white.bold('Parse PRD Help')}\n\n
${chalk.cyan('Usage:')}
  task-master parse-prd <prd-file.txt> [options]\n
${chalk.cyan('Options:')}
  -i, --input <file>       Path to the PRD file (alternative to positional argument)
  -o, --output <file>      Output file path (default: "tasks/tasks.json")
  -n, --num-tasks <number> Number of tasks to generate (default: 10)\n
${chalk.cyan('Example:')}
  task-master parse-prd requirements.txt --num-tasks 15
  task-master parse-prd --input=requirements.txt\n
${chalk.yellow('Note: This command will:')}
  1. Look for a PRD file at scripts/prd.txt by default
  2. Use the file specified by --input or positional argument if provided
  3. Generate tasks from the PRD and overwrite any existing tasks.json file`,
              { padding: 1, borderColor: 'blue', borderStyle: 'round' }
            ));
            return;
          }
        }
        
        const numTasks = Number.parseInt(options.numTasks, 10);
        const outputPath = options.output;
        
        console.log(chalk.blue(`Parsing PRD file: ${inputFile}`));
        console.log(chalk.blue(`Generating ${numTasks} tasks...`));
        
        await actions.parsePRD(inputFile, outputPath, numTasks);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // update command
  programInstance
    .command('update')
    .description('Update tasks based on new information or implementation changes')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('--from <id>', 'Task ID to start updating from (tasks with ID >= this value will be updated)', '1')
    .option('-p, --prompt <text>', 'Prompt explaining the changes or new context (required)')
    .action(async (options) => {
      try {
        if (!options.prompt) {
          console.error(chalk.red('Error: Prompt is required for the update command'));
          console.log(chalk.yellow('Usage: task-master update -p "Description of changes or new context"'));
          process.exit(1);
        }
        
        const tasksPath = options.file;
        const fromId = Number.parseInt(options.from, 10);
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Update tasks using the action creator
        console.log(chalk.blue(`Updating tasks from ID ${fromId} based on new information...`));
        const result = await actions.updateTasks(fromId, options.prompt);
        
        console.log(chalk.green(`✓ Successfully updated ${result.updated} tasks`));
        console.log(boxen(
          `${chalk.white.bold('Tasks Updated')}\n\n` +
          `${chalk.white(`${result.updated} tasks have been updated with new information`)}\n` +
          `${chalk.cyan(`Run ${chalk.yellow('task-master list')} to see the updated tasks`)}`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // generate command
  programInstance
    .command('generate')
    .description('Generate task files based on tasks.json')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('-o, --output <dir>', 'Output directory', 'tasks')
    .option('-t, --template <file>', 'Template file path', 'scripts/template.md')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const outputDir = options.output;
        const templatePath = options.template;
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Generate files using the action creator
        console.log(chalk.blue(`Generating task files in ${outputDir}...`));
        const result = await actions.generateTaskFiles(outputDir, templatePath);
        
        console.log(chalk.green(`✓ Successfully generated ${result.generated} task files`));
        console.log(boxen(
          `${chalk.white.bold('Task Files Generated')}\n\n${chalk.white(`${result.generated} task files have been created in ${outputDir}/`)}\n${chalk.cyan('Each file contains the task description, subtasks, and dependencies.')}`,
          { padding: 1, borderColor: 'green', borderStyle: 'round' }
        ));
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  // status command
  programInstance
    .command('status')
    .description('Set the status of a task')
    .requiredOption('-i, --id <id>', 'Task ID')
    .requiredOption('-s, --status <status>', 'New status (pending, in-progress, done, blocked)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const taskId = Number.parseInt(options.id, 10);
        const newStatus = options.status.toLowerCase();
        
        // Validate status value
        const validStatuses = ['pending', 'in-progress', 'done', 'blocked'];
        if (!validStatuses.includes(newStatus)) {
          console.error(chalk.red(`Error: Invalid status "${newStatus}"`));
          console.log(chalk.yellow(`Valid statuses: ${validStatuses.join(', ')}`));
          process.exit(1);
        }
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Check for blocking dependencies if setting to in-progress
        if (newStatus === 'in-progress') {
          const tasks = stateStore.getState().tasks;
          const task = tasks.find(t => t.id === taskId);
          
          if (task && await taskHasBlockingDependencies(task)) {
            console.log(chalk.yellow.bold('⚠️ Warning: This task has blocking dependencies that are not completed.'));
            console.log(chalk.yellow('You should complete those tasks first before starting this one.'));
            console.log(chalk.cyan('Run the following command to see dependencies:'));
            console.log(chalk.white(`  task-master task -i ${taskId}`));
            
            // Continue anyway, just a warning
            console.log(chalk.yellow('Continuing with status change anyway...'));
          }
        }
        
        // Update the task status using the action creator
        console.log(chalk.blue(`Setting task ${taskId} status to "${newStatus}"...`));
        const result = await actions.setTaskStatus(taskId, newStatus);
        
        if (result) {
          const statusColor = getStatusWithColor(newStatus);
          console.log(chalk.green(`✓ Task ${taskId} status updated to ${statusColor}`));
          
          // Show next steps based on new status
          if (newStatus === 'done') {
            console.log(boxen(
              `${chalk.white.bold(`Task ${taskId} Completed 🎉`)}\n\n` +
              `${chalk.white('The task has been marked as completed.')}\n` +
              `${chalk.cyan(`Run ${chalk.yellow('task-master next')} to see what to work on next`)}`,
              { padding: 1, borderColor: 'green', borderStyle: 'round' }
            ));
          } else if (newStatus === 'in-progress') {
            console.log(boxen(
              `${chalk.white.bold(`Task ${taskId} In Progress 🚀`)}\n\n` +
              `${chalk.white('You are now working on this task.')}\n` +
              `${chalk.cyan(`Run ${chalk.yellow(`task-master task -i ${taskId}`)} to see details`)}`,
              { padding: 1, borderColor: 'blue', borderStyle: 'round' }
            ));
          } else {
            console.log(boxen(
              `${chalk.white.bold(`Task ${taskId} Status Updated`)}\n\n` +
              `${chalk.white(`The task status has been updated to ${statusColor}.`)}`,
              { padding: 1, borderColor: 'blue', borderStyle: 'round' }
            ));
          }
        } else {
          console.error(chalk.red(`Error: Task ${taskId} not found`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
  
  // list command
  programInstance
    .command('list')
    .description('List all tasks')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .option('--status <status>', 'Filter by status (pending, in-progress, done, blocked)')
    .option('--debug', 'Show additional debugging info')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const statusFilter = options.status;
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // List tasks using the action creator with optional status filter
        console.log(chalk.blue('Listing tasks...'));
        let result;
        
        if (statusFilter) {
          const validStatuses = ['pending', 'in-progress', 'done', 'blocked'];
          if (!validStatuses.includes(statusFilter.toLowerCase())) {
            console.error(chalk.red(`Error: Invalid status "${statusFilter}"`));
            console.log(chalk.yellow(`Valid statuses: ${validStatuses.join(', ')}`));
            process.exit(1);
          }
          
          result = await actions.listTasks({ 
            status: statusFilter.toLowerCase(),
            debug: options.debug 
          });
        } else {
          result = await actions.listTasks({ debug: options.debug });
        }
        
        // Result is already logged by the action, nothing more to do here
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  // next command
  programInstance
    .command('next')
    .description('Display the next task to work on')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Get next task (UI module uses state store internally)
        displayNextTask();
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  // task command
  programInstance
    .command('task')
    .description('Display a specific task')
    .requiredOption('-i, --id <id>', 'Task ID')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const taskId = Number.parseInt(options.id, 10);
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Display the task details (UI module uses state store internally)
        displayTaskById(taskId);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  // add-task command
  programInstance
    .command('add-task')
    .description('Add a new task')
    .requiredOption('-t, --title <title>', 'Task title')
    .option('-d, --description <description>', 'Task description')
    .option('-s, --status <status>', 'Task status (pending, in-progress, done, blocked)', 'pending')
    .option('-p, --priority <priority>', 'Task priority (1-5, where 5 is highest)', '3')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const title = options.title;
        const description = options.description || '';
        const status = options.status.toLowerCase();
        const priority = Number.parseInt(options.priority, 10);
        
        // Validate status
        const validStatuses = ['pending', 'in-progress', 'done', 'blocked'];
        if (!validStatuses.includes(status)) {
          console.error(chalk.red(`Error: Invalid status "${status}"`));
          console.log(chalk.yellow(`Valid statuses: ${validStatuses.join(', ')}`));
          process.exit(1);
        }
        
        // Validate priority
        if (Number.isNaN(priority) || priority < 1 || priority > 5) {
          console.error(chalk.red('Error: Priority must be a number between 1 and 5'));
          process.exit(1);
        }
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Add the task using the action creator
        console.log(chalk.blue('Adding new task...'));
        const newTask = await actions.addTask({
          title,
          description,
          status,
          priority
        });
        
        const statusColor = getStatusWithColor(status);
        console.log(chalk.green(`✓ Task ${newTask.id} added successfully`));
        console.log(boxen(
          `${chalk.white.bold(`Task ${newTask.id} Added`)}\n\n` +
          `${chalk.white(`Title: ${newTask.title}`)}\n` +
          `${chalk.white(`Status: ${statusColor}`)}\n` +
          `${chalk.white(`Priority: ${newTask.priority}`)}\n\n` +
          `${chalk.cyan(`Run ${chalk.yellow(`task-master task -i ${newTask.id}`)} to see details`)}\n` +
          `${chalk.cyan(`Run ${chalk.yellow(`task-master status -i ${newTask.id} -s in-progress`)} to start working on it`)}`,
          { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
        ));
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  // add-subtask command
  programInstance
    .command('add-subtask')
    .description('Add a subtask to an existing task')
    .requiredOption('-i, --id <id>', 'Parent task ID')
    .requiredOption('-t, --title <title>', 'Subtask title')
    .option('-d, --description <description>', 'Subtask description')
    .option('-s, --status <status>', 'Subtask status (pending, in-progress, done, blocked)', 'pending')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const parentId = Number.parseInt(options.id, 10);
        const title = options.title;
        const description = options.description || '';
        const status = options.status.toLowerCase();
        
        // Validate status
        const validStatuses = ['pending', 'in-progress', 'done', 'blocked'];
        if (!validStatuses.includes(status)) {
          console.error(chalk.red(`Error: Invalid status "${status}"`));
          console.log(chalk.yellow(`Valid statuses: ${validStatuses.join(', ')}`));
          process.exit(1);
        }
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Add the subtask using the action creator
        console.log(chalk.blue(`Adding subtask to task ${parentId}...`));
        const result = await actions.addSubtask(parentId, {
          title,
          description,
          status
        });
        
        if (result) {
          const statusColor = getStatusWithColor(status);
          console.log(chalk.green(`✓ Subtask added to task ${parentId}`));
          console.log(boxen(
            `${chalk.white.bold('Subtask Added')}\n\n` +
            `${chalk.white(`Parent Task: ${parentId}`)}\n` +
            `${chalk.white(`Title: ${title}`)}\n` +
            `${chalk.white(`Status: ${statusColor}`)}\n\n` +
            `${chalk.cyan(`Run ${chalk.yellow(`task-master task -i ${parentId}`)} to see details`)}`,
            { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
          ));
        } else {
          console.error(chalk.red(`Error: Parent task ${parentId} not found`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
  
  // add-dependency command
  programInstance
    .command('add-dependency')
    .description('Add a dependency between tasks')
    .requiredOption('-i, --id <id>', 'Task ID')
    .requiredOption('-d, --dependency <id>', 'Dependency task ID (task that must be completed first)')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const taskId = Number.parseInt(options.id, 10);
        const dependencyId = Number.parseInt(options.dependency, 10);
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Add the dependency
        console.log(chalk.blue(`Adding dependency: Task ${taskId} depends on task ${dependencyId}...`));
        const result = await addDependency(taskId, dependencyId);
        
        if (result.success) {
          console.log(chalk.green('✓ Dependency added successfully'));
          console.log(boxen(
            `${chalk.white.bold('Dependency Added')}\n\n` +
            `${chalk.white(`Task ${taskId} now depends on task ${dependencyId}`)}\n` +
            `${chalk.white(`This means task ${taskId} should only be started after task ${dependencyId} is completed.`)}\n\n` +
            `${chalk.cyan(`Run ${chalk.yellow(`task-master task -i ${taskId}`)} to see all dependencies`)}`,
            { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
          ));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
  
  // remove-dependency command
  programInstance
    .command('remove-dependency')
    .description('Remove a dependency between tasks')
    .requiredOption('-i, --id <id>', 'Task ID')
    .requiredOption('-d, --dependency <id>', 'Dependency task ID to remove')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        const taskId = Number.parseInt(options.id, 10);
        const dependencyId = Number.parseInt(options.dependency, 10);
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Remove the dependency
        console.log(chalk.blue(`Removing dependency: Task ${taskId} no longer depends on task ${dependencyId}...`));
        const result = await removeDependency(taskId, dependencyId);
        
        if (result.success) {
          console.log(chalk.green('✓ Dependency removed successfully'));
          console.log(boxen(
            `${chalk.white.bold('Dependency Removed')}\n\n` +
            `${chalk.white(`Task ${taskId} no longer depends on task ${dependencyId}`)}\n\n` +
            `${chalk.cyan(`Run ${chalk.yellow(`task-master task -i ${taskId}`)} to see remaining dependencies`)}`,
            { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
          ));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
  
  // validate-dependencies command
  programInstance
    .command('validate-dependencies')
    .description('Validate all task dependencies and check for issues')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Validate dependencies
        console.log(chalk.blue('Validating task dependencies...'));
        await validateDependenciesCommand();
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
  
  // fix-dependencies command
  programInstance
    .command('fix-dependencies')
    .description('Fix common dependency issues automatically')
    .option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
    .action(async (options) => {
      try {
        const tasksPath = options.file;
        
        // Load tasks using the state store
        await actions.loadTasks(tasksPath);
        
        // Fix dependencies
        console.log(chalk.blue('Fixing task dependencies...'));
        await fixDependenciesCommand();
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        if (CONFIG.debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
    
  return programInstance;
}

/**
 * Setup the CLI application
 * @returns {Object} Configured Commander program
 */
function setupCLI() {
  // Create a new program instance
  const programInstance = program
    .name('task-master')
    .description('AI-driven development task management')
    .version(() => {
      // Read version directly from package.json
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = require(packageJsonPath);
        return packageJson.version;
      } catch (error) {
        // Silently fall back to default version
      }
      return CONFIG.projectVersion; // Default fallback
    })
    .helpOption('-h, --help', 'Display help')
    .addHelpCommand(false) // Disable default help command
    .on('--help', () => {
      displayHelp(); // Use custom help display
    })
    .on('-h', () => {
      displayHelp();
      process.exit(0);
    });
  
  // Modify the help option to use custom display
  programInstance.helpInformation = () => {
    displayHelp();
    return '';
  };
  
  // Register commands
  registerCommands(programInstance);
  
  return programInstance;
}

/**
 * Parse arguments and run the CLI
 * @param {Array} argv - Command-line arguments
 */
async function runCLI(argv = process.argv) {
  try {
    // Display banner if not in a pipe
    if (process.stdout.isTTY) {
      displayBanner();
    }
    
    // If no arguments provided, show help
    if (argv.length <= 2) {
      displayHelp();
      process.exit(0);
    }
    
    // Setup and parse
    const programInstance = setupCLI();
    await programInstance.parseAsync(argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

export {
  registerCommands,
  setupCLI,
  runCLI
};
