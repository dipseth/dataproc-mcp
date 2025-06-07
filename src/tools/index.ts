/**
 * Main tool registry
 * Combines all tool definitions from organized files
 */

import { clusterTools } from './cluster-tools.js';
import { jobTools } from './job-tools.js';
import { profileTools } from './profile-tools.js';
import { knowledgeTools } from './knowledge-tools.js';

/**
 * All available tools organized by category
 */
export const allTools = [...clusterTools, ...jobTools, ...profileTools, ...knowledgeTools];

/**
 * Tool categories for easy reference
 */
export const toolCategories = {
  cluster: clusterTools,
  job: jobTools,
  profile: profileTools,
  knowledge: knowledgeTools,
};

/**
 * Get tools by category
 */
export function getToolsByCategory(category: keyof typeof toolCategories) {
  return toolCategories[category];
}

/**
 * Get tool by name
 */
export function getToolByName(name: string) {
  return allTools.find((tool) => tool.name === name);
}

/**
 * Get all tool names
 */
export function getAllToolNames(): string[] {
  return allTools.map((tool) => tool.name);
}

/**
 * Tool count summary
 */
export const toolSummary = {
  total: allTools.length,
  cluster: clusterTools.length,
  job: jobTools.length,
  profile: profileTools.length,
  knowledge: knowledgeTools.length,
};
