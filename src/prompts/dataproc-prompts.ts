/**
 * Dataproc prompts using current MCP SDK prompt() method
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Register all Dataproc prompts on the given MCP server
 */
export function registerDataprocPrompts(server: McpServer): void {
  // 1. Analyze Dataproc Query Prompt
  server.prompt(
    'analyze-dataproc-query',
    'Analyze Hive/Spark queries for optimization and best practices',
    {
      query: z.string().describe('SQL/HiveQL query to analyze'),
      queryType: z.enum(['hive', 'spark', 'presto', 'auto']).optional(),
      clusterName: z.string().optional().describe('Target cluster name'),
      optimizationLevel: z.enum(['basic', 'advanced', 'expert']).optional(),
    },
    ({ query, queryType, clusterName, optimizationLevel }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please analyze this ${queryType || 'auto-detected'} query for optimization and best practices:

Query:
\`\`\`sql
${query}
\`\`\`

Target Cluster: ${clusterName || 'any'}
Optimization Level: ${optimizationLevel || 'basic'}

Please provide:
1. Query analysis and potential issues
2. Performance optimization suggestions
3. Best practices recommendations
4. Alternative query approaches if applicable`,
          },
        },
      ],
    })
  );

  // 2. Design Dataproc Cluster Prompt
  server.prompt(
    'design-dataproc-cluster',
    'Generate cluster configuration recommendations based on workload requirements',
    {
      workloadType: z.enum(['analytics', 'ml', 'streaming', 'batch', 'mixed']),
      dataSize: z.enum(['small', 'medium', 'large', 'xlarge']),
      budget: z.enum(['low', 'medium', 'high', 'unlimited']),
      region: z.string().optional().describe('Target GCP region'),
      requirements: z.string().optional().describe('Specific requirements or constraints'),
    },
    ({ workloadType, dataSize, budget, region, requirements }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please design a Google Cloud Dataproc cluster configuration with the following requirements:

**Workload Type:** ${workloadType}
**Data Size:** ${dataSize}
**Budget:** ${budget}
**Region:** ${region || 'us-central1'}
**Additional Requirements:** ${requirements || 'None specified'}

Please provide:
1. Recommended cluster configuration (machine types, disk sizes, node counts)
2. Appropriate software components and versions
3. Networking and security recommendations
4. Cost optimization strategies
5. Performance tuning suggestions
6. Example YAML configuration file`,
          },
        },
      ],
    })
  );

  // 3. Troubleshoot Dataproc Issue Prompt
  server.prompt(
    'troubleshoot-dataproc-issue',
    'Get help diagnosing and resolving Dataproc cluster or job issues',
    {
      issueType: z.enum(['job-failure', 'cluster-startup', 'performance', 'connectivity', 'other']),
      errorMessage: z.string().optional().describe('Error message or symptoms'),
      jobId: z.string().optional().describe('Job ID if applicable'),
      clusterName: z.string().optional().describe('Cluster name'),
      timeline: z.string().optional().describe('When did the issue start?'),
      context: z.string().optional().describe('What were you trying to do?'),
    },
    ({ issueType, errorMessage, jobId, clusterName, timeline, context }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Help me troubleshoot a Dataproc issue:

**Issue Type:** ${issueType}
**Cluster:** ${clusterName || 'Not specified'}
**Job ID:** ${jobId || 'Not applicable'}
**Timeline:** ${timeline || 'Recently'}

**Error Message:**
${errorMessage || 'No specific error message provided'}

**Context:**
${context || 'No additional context provided'}

Please provide:
1. Likely causes of this issue
2. Step-by-step troubleshooting guide
3. Commands to gather more diagnostic information
4. Resolution strategies
5. Prevention recommendations for the future`,
          },
        },
      ],
    })
  );

  // 4. Generate Dataproc Query Prompt
  server.prompt(
    'generate-dataproc-query',
    'Generate optimized Hive/Spark queries based on requirements',
    {
      queryPurpose: z.string().describe('What you want to accomplish with the query'),
      queryType: z.enum(['select', 'insert', 'update', 'create', 'analyze']),
      engine: z.enum(['hive', 'spark', 'presto']).optional(),
      performanceLevel: z.enum(['fast', 'balanced', 'memory-optimized']).optional(),
      dataSize: z.enum(['small', 'medium', 'large']).optional(),
      tables: z.string().optional().describe('Table names and schema information'),
      constraints: z.string().optional().describe('Any constraints or special requirements'),
    },
    ({ queryPurpose, queryType, engine, performanceLevel, dataSize, tables, constraints }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate an optimized ${engine || 'Hive'} query with the following specifications:

**Purpose:** ${queryPurpose}
**Query Type:** ${queryType}
**Engine:** ${engine || 'hive'}
**Performance Level:** ${performanceLevel || 'balanced'}
**Data Size:** ${dataSize || 'medium'}

**Tables/Schema:**
${tables || 'Please assume standard table structures'}

**Constraints:**
${constraints || 'No special constraints'}

Please provide:
1. The optimized query with comments
2. Explanation of optimization techniques used
3. Alternative approaches if applicable
4. Performance considerations
5. Example execution plan or hints`,
          },
        },
      ],
    })
  );
}
