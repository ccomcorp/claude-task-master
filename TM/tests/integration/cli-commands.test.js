/**
 * Integration tests for CLI commands
 * Tests interaction between CLI commands and state management
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

// Mock configuration
const TEST_DIR = path.join(process.cwd(), 'test-tasks');
const TASKS_FILE = path.join(TEST_DIR, 'tasks.json');

describe('CLI Commands Integration', () => {
  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory (uncomment when ready to clean up)
    // await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create a fresh tasks.json for each test
    const initialState = {
      meta: {
        projectName: 'Test Project',
        version: '1.0.0',
        tasksIncluded: 0
      },
      tasks: []
    };

    await fs.writeFile(TASKS_FILE, JSON.stringify(initialState, null, 2));
  });

  afterEach(async () => {
    // Remove tasks.json after each test
    try {
      await fs.unlink(TASKS_FILE);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  test('CLI should initialize state store correctly', async () => {
    // Create a tasks file with some initial data
    const initialState = {
      meta: {
        projectName: 'Initialization Test',
        version: '1.0.0'
      },
      tasks: [
        {
          id: 1,
          title: 'Existing Task',
          description: 'This task should be loaded during initialization',
          status: 'pending',
          dependencies: [],
          priority: 'medium'
        }
      ]
    };

    await fs.writeFile(TASKS_FILE, JSON.stringify(initialState, null, 2));

    // Run the list command which will initialize the state store
    const output = execSync(`node scripts/task-master.js list --file=${TASKS_FILE}`, {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    // Verify the output contains the existing task
    expect(output).toContain('Existing Task');
    expect(output).toContain('pending');

    // Verify the tasks file wasn't modified (state was loaded correctly)
    const fileContent = await fs.readFile(TASKS_FILE, 'utf8');
    const parsedContent = JSON.parse(fileContent);
    expect(parsedContent.tasks).toHaveLength(1);
    expect(parsedContent.tasks[0].title).toBe('Existing Task');
  });

  test('add-task command should create a new task', async () => {
    // Run the command to add a task
    execSync(`node scripts/task-master.js add-task --title "Test Task" --description "Task description" --file ${TASKS_FILE}`);

    // Read the tasks file
    const tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks } = JSON.parse(tasksData);

    // Verify the task was added
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Test Task');
    expect(tasks[0].description).toBe('Task description');
    expect(tasks[0].status).toBe('pending');
  });

  test('update-status command should change task status', async () => {
    // First add a task
    execSync(`node scripts/task-master.js add-task --title "Status Test" --file ${TASKS_FILE}`);

    // Read the tasks file to get the ID
    let tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: initialTasks } = JSON.parse(tasksData);
    const taskId = initialTasks[0].id;

    // Update the task status
    execSync(`node scripts/task-master.js update-status --id ${taskId} --status "in-progress" --file ${TASKS_FILE}`);

    // Read the tasks file again
    tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: updatedTasks } = JSON.parse(tasksData);

    // Verify the status was updated
    expect(updatedTasks[0].status).toBe('in-progress');
  });

  test('complete-task command should mark task as done', async () => {
    // First add a task
    execSync(`node scripts/task-master.js add-task --title "Completion Test" --file ${TASKS_FILE}`);

    // Read the tasks file to get the ID
    let tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: initialTasks } = JSON.parse(tasksData);
    const taskId = initialTasks[0].id;

    // Complete the task
    execSync(`node scripts/task-master.js complete-task --id ${taskId} --file ${TASKS_FILE}`);

    // Read the tasks file again
    tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: updatedTasks } = JSON.parse(tasksData);

    // Verify the task is marked as done
    expect(updatedTasks[0].status).toBe('done');
  });

  test('add-dependency command should add dependency between tasks', async () => {
    // Add two tasks
    execSync(`node scripts/task-master.js add-task --title "Task 1" --file ${TASKS_FILE}`);
    execSync(`node scripts/task-master.js add-task --title "Task 2" --file ${TASKS_FILE}`);

    // Read the tasks file to get the IDs
    let tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: initialTasks } = JSON.parse(tasksData);
    const task1Id = initialTasks[0].id;
    const task2Id = initialTasks[1].id;

    // Add dependency from Task 2 to Task 1
    execSync(`node scripts/task-master.js add-dependency --id ${task2Id} --dependency ${task1Id} --file ${TASKS_FILE}`);

    // Read the tasks file again
    tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: updatedTasks } = JSON.parse(tasksData);

    // Find Task 2
    const task2 = updatedTasks.find(task => task.id === task2Id);

    // Verify Task 2 depends on Task 1
    expect(task2.dependencies).toContain(task1Id);
  });

  test('list command should filter tasks by status', async () => {
    // Add tasks with different statuses
    execSync(`node scripts/task-master.js add-task --title "Pending Task" --file ${TASKS_FILE}`);
    execSync(`node scripts/task-master.js add-task --title "In Progress Task" --file ${TASKS_FILE}`);

    // Read the tasks file to get the ID of the second task
    let tasksData = await fs.readFile(TASKS_FILE, 'utf8');
    const { tasks: initialTasks } = JSON.parse(tasksData);
    const task2Id = initialTasks[1].id;

    // Update the second task's status to in-progress
    execSync(`node scripts/task-master.js update-status --id ${task2Id} --status "in-progress" --file ${TASKS_FILE}`);

    // Run the list command with status filter
    const output = execSync(`node scripts/task-master.js list --status "in-progress" --file ${TASKS_FILE}`).toString();

    // Verify that the output contains the in-progress task but not the pending task
    expect(output).toContain('In Progress Task');
    expect(output).not.toContain('Pending Task');
  });
});
