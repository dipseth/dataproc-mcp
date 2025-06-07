/**
 * MCP Framework tool for querying knowledge base
 * Wraps existing handler from src/handlers/knowledge-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleQueryKnowledge } from '../handlers/knowledge-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import DependencyRegistry from './DependencyRegistry.js';

interface QueryKnowledgeInput {
  query: string;
  projectId?: string;
  region?: string;
  type?: 'clusters' | 'cluster' | 'jobs' | 'job' | 'errors' | 'error' | 'all';
  limit?: number;
  includeRawDocument?: boolean;
}

export class QueryKnowledgeTool extends MCPTool<QueryKnowledgeInput> {
  name = 'query_knowledge';
  description = '🧠 Query the comprehensive knowledge base using natural language (clusters, jobs, errors, all)\n\n' +
    '**Enhanced Features:**\n' +
    '• Structured data retrieval with schema/rows separation for query results\n' +
    '• Raw Qdrant document access with compression status\n' +
    '• Proper clusterName display (no more "unknown" values)\n' +
    '• Decompression support for compressed data\n' +
    '• Detailed metadata including compression ratios and token counts\n' +
    '• Tag-based search for exact field matching (solves UUID search problem)\n\n' +
    '**Search Types:**\n' +
    '• **Semantic Search**: `"hive query results"` - Natural language queries\n' +
    '• **Tag-based Search**: `"jobId:20d1092f-9aa8-4f4d-b4e3-bfbdbdd8d431"` - Exact field matching\n' +
    '• **Hybrid Search**: `"jobId:12345 SHOW DATABASES"` - Tags + semantic content\n\n' +
    '**Supported Tags:**\n' +
    '• `jobId:value` - Search by job ID\n' +
    '• `clusterName:value` - Search by cluster name\n' +
    '• `projectId:value` - Search by project ID\n' +
    '• `region:value` - Search by region\n' +
    '• `toolName:value` - Search by tool name\n' +
    '• `type:value` - Search by data type\n\n' +
    '**Examples:**\n' +
    '• `query: "jobId:20d1092f-9aa8-4f4d-b4e3-bfbdbdd8d431", includeRawDocument: true` - Find specific job\n' +
    '• `query: "clusterName:my-cluster hive"` - Jobs on specific cluster with hive\n' +
    '• `query: "projectId:my-project type:query_result"` - Query results from project\n' +
    '• `query: "machine learning clusters", type: "clusters"` - Semantic cluster search\n' +
    '• `query: "toolName:submit_hive_query SHOW"` - Hive queries containing "SHOW"';

  protected schema = {
    query: {
      type: z.string(),
      description: 'Natural language query about clusters, jobs, or errors',
    },
    projectId: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud Project ID',
    },
    region: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud region',
    },
    type: {
      type: z.enum(['clusters', 'cluster', 'jobs', 'job', 'errors', 'error', 'all']).optional(),
      description: 'Type of knowledge to search (default: all). Supports both singular and plural forms.',
    },
    limit: {
      type: z.number().optional(),
      description: 'Maximum number of results (default: 10)',
    },
    includeRawDocument: {
      type: z.boolean().optional(),
      description: 'Include raw Qdrant document with full payload, compression status, and metadata (default: false)',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps?: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps || DependencyRegistry.getInstance().getDependencies();
  }

  protected async execute(input: QueryKnowledgeInput): Promise<unknown> {
    try {
      return await handleQueryKnowledge(input, this.handlerDeps);
    } catch (error) {
      // Convert McpError to proper response format
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
      
      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  }
}

export default QueryKnowledgeTool;