/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE: Using the beta header output-128k-2025-02-19 in API requests to increase maximum output token length to 128k tokens for Claude 3.7 Sonnet.

import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CONFIG, log, sanitizePrompt } from './utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from './ui.js';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Configure Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Add beta header for 128k token output
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

// Lazy-loaded Perplexity client
let perplexity = null;

/**
 * Get or initialize the Perplexity client
 * @returns {OpenAI} Perplexity client
 */
function getPerplexityClient() {
  if (!perplexity) {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY environment variable is missing. Set it to use research-backed features.");
    }
    perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });
  }
  return perplexity;
}

/**
 * Handle Claude API errors with user-friendly messages
 * @param {Error} error - The error from Claude API
 * @returns {string} User-friendly error message
 */
function handleClaudeError(error) {
  // Check if it's a structured error response
  if (error.type === 'error' && error.error) {
    switch (error.error.type) {
      case 'overloaded_error':
        return 'Claude is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
      case 'rate_limit_error':
        return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
      case 'invalid_request_error':
        return 'There was an issue with the request format. If this persists, please report it as a bug.';
      default:
        return `Claude API error: ${error.error.message}`;
    }
  }
  
  // Check for network/timeout errors
  if (error.message?.toLowerCase().includes('timeout')) {
    return 'The request to Claude timed out. Please try again.';
  }
  if (error.message?.toLowerCase().includes('network')) {
    return 'There was a network error connecting to Claude. Please check your internet connection and try again.';
  }
  
  // Default error message
  return `Error communicating with Claude: ${error.message}`;
}

/**
 * Call Claude to generate tasks from a PRD
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} retryCount - Retry count
 * @returns {Object} Claude's response
 */
async function callClaude(prdContent, prdPath, numTasks, retryCount = 0) {
  try {
    log('info', 'Calling Claude...');
    
    // Build the system prompt
    const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Ensure dependencies form a valid directed acyclic graph (no cycles)

Return a valid JSON array containing ${numTasks} task objects, with no additional text.`;

    // Setup loading indicator
    startLoadingIndicator('Generating tasks with Claude');

    // Use streaming request to get response more quickly
    const response = await handleStreamingRequest(prdContent, prdPath, numTasks, CONFIG.maxTokens, systemPrompt);
    
    // Process the response
    const processedResponse = await processClaudeResponse(response.textContent, numTasks, retryCount, prdContent, prdPath);
    
    // Stop loading indicator
    stopLoadingIndicator();
    
    return processedResponse;
  } catch (error) {
    // Stop loading indicator
    stopLoadingIndicator();
    
    log('error', handleClaudeError(error));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    // If retries left, try again
    if (retryCount < 2) {
      log('info', `Retrying (${retryCount + 1}/2)...`);
      // Wait 2 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return callClaude(prdContent, prdPath, numTasks, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Handle streaming request to Claude
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} maxTokens - Maximum tokens
 * @param {string} systemPrompt - System prompt
 * @returns {Object} Claude's response
 */
async function handleStreamingRequest(prdContent, prdPath, numTasks, maxTokens, systemPrompt) {
  // Initialize a string to store the complete text response
  let fullResponse = "";
  
  // Create the message object
  const userMessage = `Please analyze this Product Requirements Document and create ${numTasks} sequential development tasks that would implement all the requirements:

${prdContent}

If the document is the path to a PRD file (${prdPath}) rather than the content, please apologize and explain that you need the actual PRD content.`;

  // Make the streaming request
  const response = await anthropic.messages.create({
    model: CONFIG.model,
    max_tokens: maxTokens,
    temperature: CONFIG.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ],
    stream: true
  });

  // Process the stream
  for await (const chunk of response) {
    // Get content delta from the chunk if it exists
    const contentDelta = chunk.delta?.text;
    if (contentDelta) {
      fullResponse += contentDelta;
      
      // Update loading indicator
      // Note: we could update the indicator with more specific progress info here
    }
  }
  
  return {
    textContent: fullResponse,
    responseType: 'text'
  };
}

/**
 * Process Claude's response
 * @param {string} textContent - Text content from Claude
 * @param {number} numTasks - Number of tasks
 * @param {number} retryCount - Retry count
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @returns {Object} Processed response
 */
async function processClaudeResponse(textContent, numTasks, retryCount, prdContent, prdPath) {
  try {
    log('debug', 'Processing Claude response...');
    
    // Try to parse the JSON response from Claude
    // First, look for array markers
    const jsonStartIndex = textContent.indexOf('[');
    const jsonEndIndex = textContent.lastIndexOf(']');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
      throw new Error("Could not locate valid JSON array in the response");
    }
    
    // Extract and parse the JSON
    const jsonText = textContent.substring(jsonStartIndex, jsonEndIndex + 1);
    const tasks = JSON.parse(jsonText);
    
    // Verify that we have the expected number of tasks
    if (tasks.length !== numTasks) {
      log('warn', `Expected ${numTasks} tasks, but got ${tasks.length}`);
    }
    
    return {
      success: true,
      tasks
    };
  } catch (error) {
    log('error', `Error processing Claude response: ${error.message}`);
    
    if (CONFIG.debug) {
      console.error(error);
      console.log('Response:', textContent);
    }
    
    // If retries left, try again
    if (retryCount < 2) {
      return {
        success: false,
        error: error.message,
        retryNeeded: true
      };
    }
    
    return {
      success: false,
      error: error.message,
      rawResponse: textContent
    };
  }
}

/**
 * Generate subtasks for a task
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @returns {Array} Generated subtasks
 */
async function generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext = '') {
  try {
    log('info', `Generating ${numSubtasks} subtasks for task #${task.id}...`);
    
    // Build system prompt for subtask generation
    const systemPrompt = `You are an AI assistant helping to break down a development task into subtasks.
Your goal is to create ${numSubtasks} well-structured, actionable subtasks for the given development task.

Each subtask should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "dependencies": number[] (IDs of other subtasks this depends on),
  "details": string (implementation details)
}

Guidelines:
1. Create exactly ${numSubtasks} subtasks, numbered from ${nextSubtaskId} to ${nextSubtaskId + numSubtasks - 1}
2. Each subtask should be atomic and focused on a single responsibility
3. Order subtasks logically - consider dependencies and implementation sequence
4. Set appropriate dependency IDs (a subtask can only depend on subtasks with lower IDs)
5. Make subtasks concrete and actionable
6. Ensure dependencies form a valid directed acyclic graph (no cycles)

Return a valid JSON array containing ${numSubtasks} subtask objects, with no additional text.`;

    // Setup loading indicator
    startLoadingIndicator('Generating subtasks with Claude');
    
    // Build user message
    const userMessage = `Please break down this development task into ${numSubtasks} sequential subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'N/A'}
Test Strategy: ${task.testStrategy || 'N/A'}
${additionalContext ? `\nAdditional Context: ${additionalContext}` : ''}

Break this task down into ${numSubtasks} concrete, actionable subtasks that a developer can implement one by one.`;

    // Make the API call
    const response = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });
    
    // Stop loading indicator
    stopLoadingIndicator();
    
    // Parse subtasks from the response
    const subtasks = parseSubtasksFromText(
      response.content[0].text,
      nextSubtaskId,
      numSubtasks,
      task.id
    );
    
    return subtasks;
  } catch (error) {
    // Stop loading indicator
    stopLoadingIndicator();
    
    log('error', handleClaudeError(error));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    throw error;
  }
}

/**
 * Generate subtasks with research from Perplexity
 * @param {Object} task - Task to generate subtasks for
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {number} nextSubtaskId - Next subtask ID
 * @param {string} additionalContext - Additional context
 * @returns {Array} Generated subtasks
 */
async function generateSubtasksWithPerplexity(task, numSubtasks = 3, nextSubtaskId = 1, additionalContext = '') {
  try {
    log('info', `Generating ${numSubtasks} subtasks for task #${task.id} with research...`);
    
    // Setup loading indicator
    startLoadingIndicator('Researching best practices with Perplexity');
    
    // Get Perplexity client
    const client = getPerplexityClient();
    
    // Create research query
    const researchQuery = `What are the best practices, guidelines, and common approaches for implementing "${task.title}"? 
Focus on practical implementation steps, common pitfalls to avoid, and how to properly test this functionality.
Consider technical constraints and industry standards that might apply.
If there are multiple implementation options, compare their pros and cons briefly.`;

    // Get research from Perplexity
    const researchResponse = await client.chat.completions.create({
      model: 'mixtral-8x7b-instruct',
      messages: [
        { role: 'system', content: 'You are a helpful AI focused on providing accurate technical information about software development practices and implementation strategies.' },
        { role: 'user', content: researchQuery }
      ],
      max_tokens: 2048
    });
    
    const researchResults = researchResponse.choices[0].message.content;
    
    log('debug', 'Research completed, generating subtasks with insights...');
    
    // Update loading indicator
    stopLoadingIndicator();
    startLoadingIndicator('Generating subtasks with research insights');
    
    // Now use Claude to generate subtasks with the research insights
    const systemPrompt = `You are an AI assistant helping to break down a development task into subtasks, using research insights to make them more accurate and effective.
Your goal is to create ${numSubtasks} well-structured, actionable subtasks for the given development task.

Each subtask should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "dependencies": number[] (IDs of other subtasks this depends on),
  "details": string (implementation details incorporating research best practices)
}

Guidelines:
1. Create exactly ${numSubtasks} subtasks, numbered from ${nextSubtaskId} to ${nextSubtaskId + numSubtasks - 1}
2. Each subtask should be atomic and focused on a single responsibility
3. Order subtasks logically - consider dependencies and implementation sequence
4. Set appropriate dependency IDs (a subtask can only depend on subtasks with lower IDs)
5. Incorporate the research insights to make subtasks follow best practices
6. Ensure dependencies form a valid directed acyclic graph (no cycles)

Return a valid JSON array containing ${numSubtasks} subtask objects, with no additional text.`;

    // Build user message
    const userMessage = `Please break down this development task into ${numSubtasks} sequential subtasks, incorporating the research insights provided:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'N/A'}
Test Strategy: ${task.testStrategy || 'N/A'}
${additionalContext ? `\nAdditional Context: ${additionalContext}` : ''}

Research Insights:
${researchResults}

Break this task down into ${numSubtasks} concrete, actionable subtasks that follow best practices from the research.`;

    // Make the API call
    const response = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });
    
    // Stop loading indicator
    stopLoadingIndicator();
    
    // Parse subtasks from the response
    const subtasks = parseSubtasksFromText(
      response.content[0].text,
      nextSubtaskId,
      numSubtasks,
      task.id
    );
    
    return subtasks;
  } catch (error) {
    // Stop loading indicator
    stopLoadingIndicator();
    
    log('error', `Error generating subtasks with research: ${error.message}`);
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    // Fall back to regular subtask generation
    log('info', 'Falling back to regular subtask generation without research...');
    return generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext);
  }
}

/**
 * Parse subtasks from Claude's response text
 * @param {string} text - Response text
 * @param {number} startId - Starting subtask ID
 * @param {number} expectedCount - Expected number of subtasks
 * @param {number} parentTaskId - Parent task ID
 * @returns {Array} Parsed subtasks
 */
function parseSubtasksFromText(text, startId, expectedCount, parentTaskId) {
  try {
    // Locate JSON array in the text
    const jsonStartIndex = text.indexOf('[');
    const jsonEndIndex = text.lastIndexOf(']');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
      throw new Error("Could not locate valid JSON array in the response");
    }
    
    // Extract and parse the JSON
    const jsonText = text.substring(jsonStartIndex, jsonEndIndex + 1);
    let subtasks = JSON.parse(jsonText);
    
    // Validate
    if (!Array.isArray(subtasks)) {
      throw new Error("Parsed content is not an array");
    }
    
    // Log warning if count doesn't match expected
    if (subtasks.length !== expectedCount) {
      log('warn', `Expected ${expectedCount} subtasks, but parsed ${subtasks.length}`);
    }
    
    // Normalize subtask IDs if they don't match
    subtasks = subtasks.map((subtask, index) => {
      // Assign the correct ID if it doesn't match
      if (subtask.id !== startId + index) {
        log('warn', `Correcting subtask ID from ${subtask.id} to ${startId + index}`);
        subtask.id = startId + index;
      }
      
      // Convert dependencies to numbers if they are strings
      if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
        subtask.dependencies = subtask.dependencies.map(dep => {
          return typeof dep === 'string' ? parseInt(dep, 10) : dep;
        });
      } else {
        subtask.dependencies = [];
      }
      
      // Ensure status is 'pending'
      subtask.status = 'pending';
      
      // Add parentTaskId
      subtask.parentTaskId = parentTaskId;
      
      return subtask;
    });
    
    return subtasks;
  } catch (error) {
    log('error', `Error parsing subtasks: ${error.message}`);
    
    // Create a fallback array of empty subtasks if parsing fails
    log('warn', 'Creating fallback subtasks');
    
    const fallbackSubtasks = [];
    
    for (let i = 0; i < expectedCount; i++) {
      fallbackSubtasks.push({
        id: startId + i,
        title: `Subtask ${startId + i}`,
        description: "Auto-generated fallback subtask",
        dependencies: [],
        details: "This is a fallback subtask created because parsing failed. Please update with real details.",
        status: 'pending',
        parentTaskId: parentTaskId
      });
    }
    
    return fallbackSubtasks;
  }
}

/**
 * Generate a prompt for complexity analysis
 * @param {Object} tasksData - Tasks data object containing tasks array
 * @returns {string} Generated prompt
 */
function generateComplexityAnalysisPrompt(tasksData) {
  return `Analyze the complexity of the following tasks and provide recommendations for subtask breakdown:

${tasksData.tasks.map(task => `
Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'N/A'}
Dependencies: ${JSON.stringify(task.dependencies || [])}
Priority: ${task.priority || 'medium'}
`).join('\n---\n')}

Analyze each task and return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": string,
    "complexityScore": number (1-10),
    "recommendedSubtasks": number (${Math.max(3, CONFIG.defaultSubtasks - 1)}-${Math.min(8, CONFIG.defaultSubtasks + 2)}),
    "expansionPrompt": string (a specific prompt for generating good subtasks),
    "reasoning": string (brief explanation of your assessment)
  },
  ...
]

IMPORTANT: Make sure to include an analysis for EVERY task listed above, with the correct taskId matching each task's ID.
`;
}

// Export AI service functions
export {
  getPerplexityClient,
  callClaude,
  handleStreamingRequest,
  processClaudeResponse,
  generateSubtasks,
  generateSubtasksWithPerplexity,
  parseSubtasksFromText,
  generateComplexityAnalysisPrompt,
  handleClaudeError
};
