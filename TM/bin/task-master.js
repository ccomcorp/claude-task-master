#!/usr/bin/env node

/**
 * Claude Task Master CLI
 * Main entry point for globally installed package
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { displayHelp, displayBanner } from '../scripts/modules/ui.js';
import { registerCommands } from '../scripts/modules/commands.js';
import { detectCamelCaseFlags } from '../scripts/modules/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Get package information
const packageJson = require('../package.json');
const version = packageJson.version;

// Get paths to script files
const taskMasterScriptPath = resolve(__dirname, '../scripts/task-master.js');
const initScriptPath = resolve(__dirname, '../scripts/init.js');

// Helper function to run task-master.js with arguments
function runDevScript(args) {
  // Debug: Show the transformed arguments when DEBUG=1 is set
  if (process.env.DEBUG === '1') {
    console.error('\nDEBUG - CLI Wrapper Analysis:');
    console.error(`- Original command: ${process.argv.join(' ')}`);
    console.error(`- Transformed args: ${args.join(' ')}`);
    console.error(`- task-master.js will receive: node ${taskMasterScriptPath} ${args.join(' ')}\n`);
  }

  // For testing: If TEST_MODE is set, just print args and exit
  if (process.env.TEST_MODE === '1') {
    console.log('Would execute:');
    console.log(`node ${taskMasterScriptPath} ${args.join(' ')}`);
    process.exit(0);
    return;
  }

  const child = spawn('node', [taskMasterScriptPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('close', (code) => {
    process.exit(code);
  });
}

// Helper function to detect camelCase and convert to kebab-case
const toKebabCase = (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase();

/**
 * Create a wrapper action that passes the command to dev.js
 * @param {string} commandName - The name of the command
 * @returns {Function} Wrapper action function
 */
function createDevScriptAction(commandName) {
  return (options, cmd) => {
    // Check for camelCase flags and error out with helpful message
    const camelCaseFlags = detectCamelCaseFlags(process.argv);

    // If camelCase flags were found, show error and exit
    if (camelCaseFlags.length > 0) {
      console.error('\nError: Please use kebab-case for CLI flags:');

      for (const flag of camelCaseFlags) {
        console.error(`  Instead of: --${flag.original}`);
        console.error(`  Use:        --${flag.kebabCase}`);
      }

      console.error('\nExample: task-master parse-prd --num-tasks=5 instead of --numTasks=5\n');
      process.exit(1);
    }

    // Since we've ensured no camelCase flags, we can now just:
    // 1. Start with the command name
    const args = [commandName];

    // 3. Get positional arguments and explicit flags from the command line
    const commandArgs = [];
    const positionals = new Set(); // Track positional args we've seen

    // Find the command in raw process.argv to extract args
    const commandIndex = process.argv.indexOf(commandName);
    if (commandIndex !== -1) {
      // Process all args after the command name
      for (let i = commandIndex + 1; i < process.argv.length; i++) {
        const arg = process.argv[i];

        if (arg.startsWith('--')) {
          // It's a flag - pass through as is
          commandArgs.push(arg);
          // Skip the next arg if this is a flag with a value (not --flag=value format)
          if (!arg.includes('=') &&
              i + 1 < process.argv.length &&
              !process.argv[i+1].startsWith('--')) {
            commandArgs.push(process.argv[++i]);
          }
        } else if (!positionals.has(arg)) {
          // It's a positional argument we haven't seen
          commandArgs.push(arg);
          positionals.add(arg);
        }
      }
    }

    // Add all command line args we collected
    args.push(...commandArgs);

    // 4. Process options that came from commander (transform to kebab-case)
    // Track which options were explicitly passed by the user
    const userOptions = new Set(
      process.argv
        .filter(arg => arg.startsWith('--'))
        .map(arg => arg.split('=')[0].slice(2)) // Get just the option name
    );

    // Get all options from commander, skipping special ones
    for (const [key, value] of Object.entries(options)) {
      // Skip special commander props and positional values we've already handled
      if (!['commands', 'options', 'parent', '_name', '_description', '_usage', '_aliases', '_helpShortFlag', '_helpLongFlag'].includes(key) &&
          typeof value !== 'function' &&
          !positionals.has(value)) {

        // Convert camelCase to kebab-case
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();

        // Only add if it wasn't already explicitly handled above
        if (!userOptions.has(key) && !userOptions.has(kebabKey)) {
          // Special handling for boolean flags
          if (typeof value === 'boolean') {
            if (value === true) {
              args.push(`--${kebabKey}`);
            } else if (key === 'generate' && value === false) {
              // Special case for --no-generate
              args.push('--no-generate');
            }
          } else {
            // Always use kebab-case for option names
            args.push(`--${kebabKey}=${value}`);
          }
        }
      }
    }

    // Special handling for parent parameter (uses -p)
    if (options.parent && !args.includes('-p') && !userOptions.has('parent')) {
      args.push('-p', options.parent);
    }

    // Debug output for troubleshooting
    if (process.env.DEBUG === '1') {
      console.error('DEBUG - Command args:', commandArgs);
      console.error('DEBUG - User options:', Array.from(userOptions));
      console.error('DEBUG - Commander options:', options);
      console.error('DEBUG - Final args:', args);
    }

    // Run the script with our processed args
    runDevScript(args);
  };
}

// Special case for the 'init' command which uses a different script
function registerInitCommand(program) {
  program
    .command('init')
    .description('Initialize a new project')
    .option('-y, --yes', 'Skip prompts and use default values')
    .option('-n, --name <n>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('-v, --version <version>', 'Project version')
    .option('-a, --author <author>', 'Author name')
    .option('--skip-install', 'Skip installing dependencies')
    .option('--dry-run', 'Show what would be done without making changes')
    .action((options) => {
      // Pass through any options to the init script
      const args = ['--yes', 'name', 'description', 'version', 'author', 'skip-install', 'dry-run']
        .filter(opt => options[opt])
        .map(opt => {
          if (opt === 'yes' || opt === 'skip-install' || opt === 'dry-run') {
            return `--${opt}`;
          }
          return `--${opt}=${options[opt]}`;
        });

      const child = spawn('node', [initScriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        process.exit(code);
      });
    });
}

// Set up the command-line interface
const program = new Command();

program
  .name('task-master')
  .description('Claude Task Master CLI')
  .version(version)
  .addHelpText('afterAll', () => {
    // Use the same help display function as dev.js for consistency
    displayHelp();
    return ''; // Return empty string to prevent commander's default help
  });

// Add custom help option to directly call our help display
program.helpOption('-h, --help', 'Display help information');
program.on('--help', () => {
  displayHelp();
});

// Add special case commands
registerInitCommand(program);

program
  .command('dev')
  .description('Run the dev.js script')
  .allowUnknownOption(true)
  .action(() => {
    const args = process.argv.slice(process.argv.indexOf('dev') + 1);
    runDevScript(args);
  });

// Use a temporary Command instance to get all command definitions
const tempProgram = new Command();
registerCommands(tempProgram);

// For each command in the temp instance, add a modified version to our actual program
for (const cmd of tempProgram.commands) {
  if (['init', 'dev'].includes(cmd.name())) {
    // Skip commands we've already defined specially
    continue;
  }

  // Create a new command with the same name and description
  const newCmd = program
    .command(cmd.name())
    .description(cmd.description())
    .allowUnknownOption(); // Allow any options, including camelCase ones

  // Copy all options
  for (const opt of cmd.options) {
    newCmd.option(
      opt.flags,
      opt.description,
      opt.defaultValue
    );
  }

  // Set the action to proxy to dev.js
  newCmd.action(createDevScriptAction(cmd.name()));
}

// Parse the command line arguments
program.parse(process.argv);

// Show help if no command was provided (just 'task-master' with no args)
if (process.argv.length <= 2) {
  displayBanner();
  displayHelp();
  process.exit(0);
}

// Export as ES module
export { detectCamelCaseFlags };
