/**
 * complexity-analyzer.js
 * Analyze task complexity and recommend subtask generation
 * Uses state-based architecture
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, log } from './utils.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { getPerplexityClient, generateComplexityAnalysisPrompt, handleClaudeError } from './ai-services.js';
import { updateTaskDetails } from './actions.js';
import { StateStore } from './state-store.js';

// Initialize state store
const stateStore = new StateStore();

// Configure Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

/**
 * Analyze task complexity and generate recommendations for subtask generation
 * @param {Object} options Options for complexity analysis
 * @param {string} options.tasksFilePath Custom path to tasks file
 * @param {number} options.threshold Complexity threshold for recommending subtask expansion
 * @param {boolean} options.research Use research-backed analysis with Perplexity
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeTaskComplexity({ tasksFilePath = null, threshold = 5, research = false }) {
  try {
    log('info', `Analyzing task complexity${research ? ' with research' : ''}...`);
    
    // Initialize state if not already loaded
    if (Object.keys(stateStore.getState()).length === 0) {
      await stateStore.loadState(tasksFilePath);
    }
    
    // Get current state
    const { tasks } = stateStore.getState();
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No tasks found in state');
    }
    
    // Generate analysis prompt
    const analysisPrompt = generateComplexityAnalysisPrompt({ tasks });
    
    // Call Claude to analyze complexity
    const response = await anthropic.messages.create({
      model: CONFIG.model,
      max_tokens: CONFIG.maxTokens,
      temperature: CONFIG.temperature,
      system: `You are an AI assistant helping to analyze the complexity of development tasks and recommend how to break them down into subtasks. 
Analyze each task based on its description, details, dependencies, and priority.
Provide a JSON response with complexity scores (1-10), recommended number of subtasks, and reasoning.`,
      messages: [
        { role: 'user', content: analysisPrompt }
      ]
    });
    
    // Process the response
    const analysisText = response.content[0].text;
    
    // Parse the analysis
    const analysisResults = parseAnalysisFromText(analysisText);
    
    if (!analysisResults || !Array.isArray(analysisResults)) {
      throw new Error('Failed to parse complexity analysis results');
    }
    
    // Add additional details if research is enabled
    let enhancedResults = analysisResults;
    
    if (research) {
      enhancedResults = await enhanceAnalysisWithResearch(analysisResults, threshold);
    }
    
    // Prepare complexity report
    const report = {
      generatedAt: new Date().toISOString(),
      complexityAnalysis: enhancedResults,
      threshold,
      researchBacked: research
    };
    
    // Save the report to state
    stateStore.setState({
      complexityReport: report
    });
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    
    // Update each task with its complexity data
    for (const analysis of enhancedResults) {
      if (analysis.taskId) {
        await updateTaskDetails(analysis.taskId, {
          complexity: {
            score: analysis.complexityScore,
            recommendedSubtasks: analysis.recommendedSubtasks,
            reasoning: analysis.reasoning,
            expansionPrompt: analysis.expansionPrompt || ''
          }
        });
      }
    }
    
    // Return the report
    return {
      success: true,
      reportPath,
      report,
      message: `Complexity analysis complete. ${enhancedResults.length} tasks analyzed.`
    };
  } catch (error) {
    log('error', `Error analyzing task complexity: ${error.message}`);
    if (error.response) {
      log('debug', handleClaudeError(error));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse complexity analysis from Claude's response text
 * @param {string} text Response text from Claude
 * @returns {Array|null} Parsed analysis or null if parsing failed
 */
function parseAnalysisFromText(text) {
  try {
    // Locate JSON array in the text
    const jsonStartIndex = text.indexOf('[');
    const jsonEndIndex = text.lastIndexOf(']');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex < jsonStartIndex) {
      throw new Error('Could not locate valid JSON array in the response');
    }
    
    // Extract and parse the JSON
    const jsonText = text.substring(jsonStartIndex, jsonEndIndex + 1);
    const analysis = JSON.parse(jsonText);
    
    // Validate
    if (!Array.isArray(analysis)) {
      throw new Error('Parsed content is not an array');
    }
    
    return analysis;
  } catch (error) {
    log('error', `Error parsing complexity analysis: ${error.message}`);
    return null;
  }
}

/**
 * Enhance analysis with research from Perplexity
 * @param {Array} analysisResults Original analysis results
 * @param {number} threshold Complexity threshold 
 * @returns {Promise<Array>} Enhanced analysis results
 */
async function enhanceAnalysisWithResearch(analysisResults, threshold) {
  try {
    log('info', 'Enhancing complexity analysis with research...');
    
    // Get Perplexity client
    const client = getPerplexityClient();
    
    // Only research complex tasks above the threshold
    const complexTasks = analysisResults.filter(task => task.complexityScore >= threshold);
    
    log('info', `Researching ${complexTasks.length} complex tasks...`);
    
    // Enhanced results start with the original analysis
    const enhancedResults = [...analysisResults];
    
    // For each complex task, get additional research
    for (const task of complexTasks) {
      try {
        const taskIndex = enhancedResults.findIndex(t => t.taskId === task.taskId);
        
        if (taskIndex === -1) continue;
        
        // Create research query
        const researchQuery = `I'm building a software application and need to implement this task: "${task.taskTitle}".
The initial complexity assessment is ${task.complexityScore}/10 (where 10 is most complex).
Based on best practices and industry standards, how should this task be broken down into subtasks?
What specific implementation challenges should I anticipate?
Provide targeted recommendations for implementation strategies.`;

        // Get research from Perplexity
        const researchResponse = await client.chat.completions.create({
          model: 'mixtral-8x7b-instruct',
          messages: [
            { role: 'system', content: 'You are a helpful AI focused on providing technical advice about software development best practices.' },
            { role: 'user', content: researchQuery }
          ],
          max_tokens: 2048
        });
        
        const researchResults = researchResponse.choices[0].message.content;
        
        // Use Claude to generate an improved expansion prompt based on the research
        const promptResponse = await anthropic.messages.create({
          model: CONFIG.model,
          max_tokens: 1000,
          temperature: 0.7,
          system: 'You are an AI assistant helping to create optimal prompts for breaking down software development tasks into subtasks.',
          messages: [
            { role: 'user', content: `
Based on this research about "${task.taskTitle}":

${researchResults}

Create a specific, targeted prompt to generate ${task.recommendedSubtasks} high-quality subtasks for this development task.
The prompt should incorporate the key insights from the research, focus on industry best practices, anticipate common pitfalls, and ensure complete coverage of the implementation requirements.
Make the prompt direct and actionable for generating subtasks.
Reply with ONLY the prompt text, nothing else.`}
          ]
        });
        
        const improvedPrompt = promptResponse.content[0].text.trim();
        
        // Update the task in our enhanced results array
        enhancedResults[taskIndex] = {
          ...enhancedResults[taskIndex],
          expansionPrompt: improvedPrompt,
          researchBacked: true,
          researchSummary: researchResults
        };
        
        log('debug', `Enhanced analysis for task ${task.taskId}`);
      } catch (error) {
        log('warn', `Error enhancing task ${task.taskId}: ${error.message}`);
        // Continue with other tasks even if one fails
      }
    }
    
    return enhancedResults;
  } catch (error) {
    log('error', `Error enhancing analysis with research: ${error.message}`);
    // Return original analysis if research enhancement fails
    return analysisResults;
  }
}

/**
 * View the complexity report from state
 * @param {string} reportPath Optional custom path to report file
 * @returns {Promise<Object>} Complexity report
 */
async function viewComplexityReport(reportPath = null) {
  try {
    // Try to get report from state first
    const state = stateStore.getState();
    let report = state.complexityReport;
    
    // If not in state, try to load from file
    if (!report) {
      const defaultPath = path.join(process.cwd(), 'scripts', 'task-complexity-report.json');
      const filePath = reportPath || defaultPath;
      
      try {
        const reportData = await fs.readFile(filePath, 'utf-8');
        report = JSON.parse(reportData);
      } catch (error) {
        throw new Error(`No complexity report found. Run analyze-complexity first.`);
      }
    }
    
    return {
      success: true,
      report
    };
  } catch (error) {
    log('error', `Error viewing complexity report: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  analyzeTaskComplexity,
  viewComplexityReport
};
