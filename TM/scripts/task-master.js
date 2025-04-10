#!/usr/bin/env node

/**
 * Task Master CLI
 * Main entry point for the Task Master application
 * Refactored to use centralized state management
 */

import { program } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import chalk from 'chalk';

import { CONFIG, log } from './modules/utils.js';
import stateStore from './modules/state-store.js';
import initializeAllObservers from './modules/observers.js';
import { registerCommands, setupCLI, runCLI } from './modules/commands.js';
import { displayBanner } from './modules/ui.js';

// Load environment variables
dotenv.config();

// Get directory name in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize the application
 * Sets up state store, observers, and CLI
 */
async function initialize() {
  try {
    // Initialize state store and observers
    await stateStore.initialize();
    initializeAllObservers();
    
    // Run the CLI
    await runCLI();
  } catch (error) {
    console.error(chalk.red(`Error initializing Task Master: ${error.message}`));
    if (CONFIG.debug) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Start the application
initialize();
