#!/usr/bin/env node

/**
 * Task Master
 * A task management system for AI-driven development
 */

// This file serves as the main entry point for the package
// The primary functionality is provided through the CLI commands

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Get package information
const packageJson = require('./package.json');

// Export the path to the task-master.js script for programmatic usage
export const taskMasterScriptPath = resolve(__dirname, './scripts/task-master.js');

// Export version information
export const version = packageJson.version;

// CLI implementation
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = new Command();
  
  program
    .name('task-master')
    .description('Task Master CLI')
    .version(version);
  
  // Add shortcuts for common task-master.js commands
  program
    .command('list')
    .description('List all tasks')
    .action(() => {
      const child = spawn('node', [taskMasterScriptPath, 'list'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  program
    .command('next')
    .description('Show the next task to work on')
    .action(() => {
      const child = spawn('node', [taskMasterScriptPath, 'next'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  program
    .command('add')
    .description('Add a new task')
    .action(() => {
      const child = spawn('node', [taskMasterScriptPath, 'add'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });

  program
    .command('dependencies')
    .description('Manage task dependencies')
    .action(() => {
      const child = spawn('node', [taskMasterScriptPath, 'dependencies'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });

  program.parse(process.argv);
}
