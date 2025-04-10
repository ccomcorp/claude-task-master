/**
 * ui-integration.test.js
 * Test integration of UI functions with state management
 */

import { jest } from '@jest/globals';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi'; // For testing colored console output
import { StateStore } from '../scripts/modules/state-store.js';
import { 
  displayNextTask, 
  displayTaskById, 
  displayComplexityReport,
  getStatusWithColor,
  formatDependenciesWithStatus,
  truncate
} from '../scripts/modules/ui.js';
import * as actions from '../scripts/modules/actions.js';

// Mock dependencies
jest.mock('chalk', () => {
  const original = jest.requireActual('chalk');
  return {
    ...original,
    // Mock the chalk color functions to simplify testing
    green: jest.fn(text => `green:${text}`),
    red: jest.fn(text => `red:${text}`),
    yellow: jest.fn(text => `yellow:${text}`),
    blue: jest.fn(text => `blue:${text}`),
    cyan: jest.fn(text => `cyan:${text}`),
    magenta: jest.fn(text => `magenta:${text}`),
    white: jest.fn(text => text),
    keyword: jest.fn(() => jest.fn(text => `keyword:${text}`)),
    // Add chalk's chainable API
    bold: { 
      green: jest.fn(text => `bold.green:${text}`),
      red: jest.fn(text => `bold.red:${text}`),
      yellow: jest.fn(text => `bold.yellow:${text}`),
      blue: jest.fn(text => `bold.blue:${text}`),
      cyan: jest.fn(text => `bold.cyan:${text}`),
      magenta: jest.fn(text => `bold.magenta:${text}`),
      white: jest.fn(text => `bold.white:${text}`)
    }
  };
});

jest.mock('boxen', () => 
  jest.fn(text => `[BOXEN START]\n${text}\n[BOXEN END]`)
);

jest.mock('figlet', () => ({
  textSync: jest.fn(() => 'TASK MASTER')
}));

jest.mock('gradient-string', () => 
  jest.fn(() => jest.fn(text => `GRADIENT:${text}`))
);

jest.mock('cli-table3', () => 
  jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    toString: jest.fn(() => '[TABLE CONTENT]')
  }))
);

// Mock the console methods
const originalConsoleLog = console.log;
beforeEach(() => {
  console.log = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
});

// Mock the StateStore singleton
jest.mock('../scripts/modules/state-store.js', () => {
  // Create a mock implementation of StateStore
  const mockStateStore = {
    state: {},
    getState: jest.fn(() => mockStateStore.state),
    setState: jest.fn((newState) => {
      mockStateStore.state = { ...mockStateStore.state, ...newState };
      return mockStateStore.state;
    }),
    initState: jest.fn((initialState) => {
      mockStateStore.state = { ...initialState };
      return mockStateStore.state;
    }),
    loadState: jest.fn(),
    persistState: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };
  
  return {
    StateStore: jest.fn(() => mockStateStore),
    __esModule: true,
    default: mockStateStore
  };
});

// Mock actions module
jest.mock('../scripts/modules/actions.js', () => ({
  setCurrentTask: jest.fn(),
  loadTasks: jest.fn(),
  expandTask: jest.fn(),
  clearSubtasks: jest.fn()
}));

describe('UI Integration with State Management', () => {
  let stateStore;
  
  beforeEach(() => {
    // Get the StateStore instance
    stateStore = require('../scripts/modules/state-store.js').default;
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('displayNextTask', () => {
    it('should display a message when no tasks are found', () => {
      // Set up empty state
      stateStore.getState.mockReturnValue({ tasks: [] });
      
      // Call the function
      displayNextTask();
      
      // Check that correct message was displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('No tasks found');
    });
    
    it('should display the next task from state', () => {
      // Set up state with tasks
      stateStore.getState.mockReturnValue({
        tasks: [
          {
            id: 1,
            title: 'Test Task',
            description: 'Task description',
            status: 'pending',
            priority: 'high'
          }
        ]
      });
      
      // Call the function
      displayNextTask();
      
      // Check that task details were displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('Next Task To Work On');
      expect(calls).toContain('Test Task');
      
      // Check that setCurrentTask was called with the task ID
      expect(actions.setCurrentTask).toHaveBeenCalledWith(1);
    });
    
    it('should respect task priorities when finding the next task', () => {
      // Set up state with multiple tasks with different priorities
      stateStore.getState.mockReturnValue({
        tasks: [
          {
            id: 1,
            title: 'Low Priority Task',
            description: 'Low priority',
            status: 'pending',
            priority: 'low'
          },
          {
            id: 2,
            title: 'High Priority Task',
            description: 'High priority',
            status: 'pending',
            priority: 'high'
          },
          {
            id: 3,
            title: 'Medium Priority Task',
            description: 'Medium priority',
            status: 'pending',
            priority: 'medium'
          }
        ]
      });
      
      // Call the function
      displayNextTask();
      
      // Check that the high priority task was chosen
      expect(actions.setCurrentTask).toHaveBeenCalledWith(2);
    });
  });
  
  describe('displayTaskById', () => {
    it('should display a message when no tasks are found', () => {
      // Set up empty state
      stateStore.getState.mockReturnValue({ tasks: [] });
      
      // Call the function
      displayTaskById(1);
      
      // Check that correct message was displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('No tasks found');
    });
    
    it('should display a task by ID from state', () => {
      // Set up state with tasks
      stateStore.getState.mockReturnValue({
        tasks: [
          {
            id: 1,
            title: 'Test Task',
            description: 'Task description',
            status: 'pending',
            priority: 'medium'
          },
          {
            id: 2,
            title: 'Another Task',
            description: 'Another description',
            status: 'in-progress',
            priority: 'high'
          }
        ]
      });
      
      // Call the function
      displayTaskById(2);
      
      // Check that task details were displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('Task 2');
      expect(calls).toContain('Another Task');
    });
    
    it('should display subtask information when subtask ID is provided', () => {
      // Set up state with a task that has subtasks
      stateStore.getState.mockReturnValue({
        tasks: [
          {
            id: 1,
            title: 'Parent Task',
            status: 'in-progress',
            subtasks: [
              {
                id: 1,
                title: 'Subtask 1',
                description: 'Subtask description',
                status: 'pending'
              }
            ]
          }
        ]
      });
      
      // Call the function with subtask ID
      displayTaskById('1.1');
      
      // Check that subtask details were displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('Subtask 1.1');
      expect(calls).toContain('Parent Task');
      expect(calls).toContain('Subtask 1');
    });
  });
  
  describe('getStatusWithColor', () => {
    it('should render status with proper color and icon', () => {
      // Test for various statuses
      const statuses = ['done', 'pending', 'in-progress', 'blocked', 'review'];
      
      for (const status of statuses) {
        const result = getStatusWithColor(status);
        const stripped = stripAnsi(result);
        expect(stripped).toContain(status);
      }
    });
    
    it('should use simplified icons for table display', () => {
      const tableResult = getStatusWithColor('done', true);
      const regularResult = getStatusWithColor('done', false);
      
      // Table result should be different from regular result
      expect(tableResult).not.toEqual(regularResult);
      
      // Table result should contain simplified icon
      const stripped = stripAnsi(tableResult);
      expect(stripped).toContain('✓');
    });
    
    it('should handle unknown status', () => {
      const result = getStatusWithColor();
      const stripped = stripAnsi(result);
      expect(stripped).toContain('unknown');
    });
    
    it('should handle custom status', () => {
      const result = getStatusWithColor('some-custom-status');
      const stripped = stripAnsi(result);
      expect(stripped).toContain('some-custom-status');
    });
  });
  
  describe('formatDependenciesWithStatus', () => {
    it('should return "None" when dependencies are empty or not provided', () => {
      const result1 = formatDependenciesWithStatus(null, []);
      const result2 = formatDependenciesWithStatus([], []);
      const result3 = formatDependenciesWithStatus(undefined, []);
      
      expect(result1).toBe('None');
      expect(result2).toBe('None');
      expect(result3).toBe('None');
    });
    
    it('should format regular task dependencies', () => {
      const dependencies = [1, 2, 3];
      const allTasks = [
        { id: 1, title: 'Task 1', status: 'done' },
        { id: 2, title: 'Task 2', status: 'in-progress' },
        { id: 3, title: 'Task 3', status: 'pending' }
      ];
      
      const result = formatDependenciesWithStatus(dependencies, allTasks);
      
      // For regular output (not console) it should just return the IDs
      expect(result).toBe('1, 2, 3');
    });
    
    it('should format dependencies with color for console output', () => {
      const dependencies = [1, 2, 3];
      const allTasks = [
        { id: 1, title: 'Task 1', status: 'done' },
        { id: 2, title: 'Task 2', status: 'in-progress' },
        { id: 3, title: 'Task 3', status: 'pending' }
      ];
      
      const result = formatDependenciesWithStatus(dependencies, allTasks, true);
      
      // Should have color formatting
      expect(result).not.toBe('1, 2, 3');
      
      // Strip ANSI codes and check content
      const stripped = stripAnsi(result);
      expect(stripped).toContain('1');
      expect(stripped).toContain('2');
      expect(stripped).toContain('3');
    });
    
    it('should handle subtask dependencies', () => {
      const dependencies = ['1.1', '2.3'];
      const allTasks = [
        { 
          id: 1, 
          title: 'Parent Task 1', 
          subtasks: [
            { id: 1, title: 'Subtask 1', status: 'done' }
          ] 
        },
        { 
          id: 2, 
          title: 'Parent Task 2', 
          subtasks: [
            { id: 3, title: 'Subtask 3', status: 'pending' }
          ] 
        }
      ];
      
      const result = formatDependenciesWithStatus(dependencies, allTasks);
      
      // For non-console output, should just be the IDs
      expect(result).toBe('1.1, 2.3');
    });
    
    it('should handle not found dependencies', () => {
      const dependencies = [99, '5.1'];
      const allTasks = [
        { id: 1, title: 'Task 1', status: 'done' }
      ];
      
      const result = formatDependenciesWithStatus(dependencies, allTasks, true);
      const stripped = stripAnsi(result);
      
      expect(stripped).toContain('99 (Not found)');
      expect(stripped).toContain('5.1 (Not found)');
    });
  });
  
  describe('truncate', () => {
    it('should truncate strings longer than maxLength', () => {
      const longString = 'This is a very long string that needs to be truncated';
      const result = truncate(longString, 20);
      
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toBe('This is a very lo...');
    });
    
    it('should not truncate strings shorter than maxLength', () => {
      const shortString = 'Short string';
      const result = truncate(shortString, 20);
      
      expect(result).toBe(shortString);
    });
    
    it('should handle empty strings', () => {
      const result = truncate('', 10);
      expect(result).toBe('');
    });
    
    it('should handle null or undefined', () => {
      const result1 = truncate(null, 10);
      const result2 = truncate(undefined, 10);
      
      expect(result1).toBe('');
      expect(result2).toBe('');
    });
  });
  
  describe('displayComplexityReport', () => {
    it('should display a message when no report data is available', () => {
      // Call the function with no data
      displayComplexityReport(null);
      
      // Check that correct message was displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('No complexity analysis data found');
    });
    
    it('should display complexity report data', () => {
      // Create a mock complexity report
      const mockReport = {
        threshold: 5,
        researchBacked: true,
        generatedAt: '2023-07-15T10:00:00Z',
        complexityAnalysis: [
          {
            taskId: 1,
            taskTitle: 'Task 1',
            complexityScore: 8,
            recommendedSubtasks: 5,
            rationale: 'Complex task requiring multiple steps'
          },
          {
            taskId: 2,
            taskTitle: 'Task 2',
            complexityScore: 3,
            recommendedSubtasks: 0,
            rationale: 'Simple task'
          }
        ]
      };
      
      // Call the function
      displayComplexityReport(mockReport);
      
      // Check that report was displayed
      expect(console.log).toHaveBeenCalled();
      const calls = console.log.mock.calls.flat().join('\n');
      expect(calls).toContain('Task Complexity Analysis Report');
      expect(calls).toContain('Tasks Needing Expansion: 1');
      expect(calls).toContain('Simple Tasks: 1');
    });
  });
});
