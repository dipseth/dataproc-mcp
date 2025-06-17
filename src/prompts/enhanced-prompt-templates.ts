/**
 * Enhanced Prompt Templates
 * Defines the four sophisticated prompt templates that replace static prompts
 * with dynamic, context-aware generation capabilities
 */

import { PromptTemplate } from '../types/enhanced-prompts.js';

/**
 * Template 1: analyze-dataproc-query (Knowledge-Driven)
 * Analyzes queries with knowledge base examples and optimization insights
 */
export const analyzeDataprocQueryTemplate: PromptTemplate = {
  id: 'analyze-dataproc-query',
  category: 'knowledge-driven',
  description: 'Analyze Hive/Spark queries with knowledge base examples and optimization insights',

  template: `Analyze this {{queryType || 'SQL'}} query for optimization and best practices:

**Query to Analyze:**
\`\`\`sql
{{query}}
\`\`\`

**Context:**
- Target Cluster: {{clusterName || 'any'}}
- Optimization Level: {{optimizationLevel || 'basic'}}
- Query Type: {{queryType || 'auto-detect'}}
- Project: {{projectId || 'not specified'}}
- Region: {{region || 'not specified'}}

**Similar Query Examples from Knowledge Base:**
{{qdrant_query("similar queries " + queryType, "limit:3 type:job")}}

**Performance Insights from Cluster Data:**
{{qdrant_query("query optimization " + queryType + " performance", "limit:2 type:cluster")}}

**Historical Query Patterns:**
{{qdrant_query("successful " + queryType + " patterns", "limit:2 type:job")}}

**Analysis Requirements:**
Please provide a comprehensive analysis including:

1. **Query Performance Analysis**
   - Identify potential bottlenecks and performance issues
   - Analyze query complexity and resource requirements
   - Evaluate join strategies and data access patterns

2. **Optimization Suggestions**
   - Specific recommendations based on similar successful queries
   - Indexing and partitioning strategies
   - Query rewriting opportunities for better performance

3. **Best Practices Recommendations**
   - Industry best practices for {{queryType}} queries
   - Dataproc-specific optimizations
   - Resource allocation recommendations

4. **Potential Issues and Warnings**
   - Common pitfalls and anti-patterns detected
   - Resource consumption warnings
   - Compatibility considerations

5. **Alternative Query Approaches**
   - Different strategies to achieve the same result
   - Trade-offs between approaches
   - Performance vs. complexity considerations`,

  parameters: [
    {
      name: 'query',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'SQL/HiveQL query to analyze',
    },
    {
      name: 'queryType',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Type of query (hive, spark, presto, auto)',
      validation: {
        enum: ['hive', 'spark', 'presto', 'auto'],
      },
    },
    {
      name: 'clusterName',
      type: 'string',
      required: false,
      source: 'profile',
      description: 'Target cluster name for optimization context',
    },
    {
      name: 'optimizationLevel',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Level of optimization analysis',
      validation: {
        enum: ['basic', 'advanced', 'expert'],
      },
      defaultValue: 'basic',
    },
    {
      name: 'projectId',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP project ID for context',
    },
    {
      name: 'region',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP region for context',
    },
  ],

  knowledgeQueries: [
    {
      type: 'semantic',
      query: 'similar queries {{queryType}}',
      filters: { type: 'job' },
      limit: 3,
      minConfidence: 0.7,
    },
    {
      type: 'semantic',
      query: 'query optimization {{queryType}} performance',
      filters: { type: 'cluster' },
      limit: 2,
      minConfidence: 0.6,
    },
    {
      type: 'semantic',
      query: 'successful {{queryType}} patterns',
      filters: { type: 'job' },
      limit: 2,
      minConfidence: 0.7,
    },
  ],

  dynamicFunctions: [
    {
      name: 'qdrant_query',
      args: ['similar queries {{queryType}}', 'limit:3 type:job'],
      cacheKey: 'similar_queries_{{queryType}}',
      ttl: 1800000, // 30 minutes
    },
    {
      name: 'qdrant_query',
      args: ['query optimization {{queryType}} performance', 'limit:2 type:cluster'],
      cacheKey: 'optimization_{{queryType}}',
      ttl: 3600000, // 1 hour
    },
    {
      name: 'qdrant_query',
      args: ['successful {{queryType}} patterns', 'limit:2 type:job'],
      cacheKey: 'patterns_{{queryType}}',
      ttl: 1800000, // 30 minutes
    },
  ],
};

/**
 * Template 2: design-dataproc-cluster (Resource-Integrated)
 * Generates cluster configurations with profile integration and regional best practices
 */
export const designDataprocClusterTemplate: PromptTemplate = {
  id: 'design-dataproc-cluster',
  category: 'resource-integrated',
  description: 'Generate cluster configuration recommendations with profile integration',

  template: `Design an optimal Dataproc cluster configuration for the following requirements:

**Workload Requirements:**
- **Type**: {{workloadType}}
- **Data Size**: {{dataSize}}
- **Budget**: {{budget}}
- **Region**: {{region || 'flexible'}}
- **Additional Requirements**: {{requirements || 'none specified'}}

**Profile-Based Configuration Templates:**
{{profile_config(profileId, "cluster-templates")}}

**Similar Cluster Configurations from Knowledge Base:**
{{qdrant_query("workload " + workloadType + " " + dataSize + " cluster", "limit:3 type:cluster")}}

**Regional Best Practices and Optimizations:**
{{qdrant_query("region " + region + " cluster configuration best practices", "limit:2")}}

**Cost Optimization Patterns:**
{{qdrant_query(budget + " budget cluster optimization", "limit:2 type:cluster")}}

**Design Requirements:**
Please provide a comprehensive cluster design including:

1. **Recommended Cluster Configuration**
   - Master node specifications (machine type, disk size, count)
   - Worker node specifications (machine type, disk size, count)
   - Preemptible worker configuration if applicable
   - Network and security group settings

2. **Software Components and Versions**
   - Recommended Dataproc image version for {{workloadType}}
   - Optional components based on workload requirements
   - Initialization scripts and custom configurations

3. **Networking and Security Recommendations**
   - VPC and subnet configuration for {{region}}
   - Firewall rules and security best practices
   - Service account and IAM permissions
   - Encryption settings (at-rest and in-transit)

4. **Cost Optimization Strategies**
   - Strategies specific to {{budget}} budget constraints
   - Preemptible instance recommendations
   - Auto-scaling policies for cost efficiency
   - Resource scheduling and lifecycle management

5. **Performance Tuning Suggestions**
   - Configuration optimizations for {{dataSize}} data volumes
   - Memory and CPU allocation strategies
   - Storage optimization (SSD vs HDD, local vs persistent)
   - Network performance considerations

6. **Complete YAML Configuration File**
   - Ready-to-use cluster configuration
   - Environment-specific parameter substitution
   - Validation and deployment instructions

7. **Scaling and Monitoring Recommendations**
   - Auto-scaling policies and thresholds
   - Monitoring and alerting setup
   - Performance metrics to track
   - Maintenance and upgrade strategies`,

  parameters: [
    {
      name: 'workloadType',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Type of workload the cluster will handle',
      validation: {
        enum: ['analytics', 'ml', 'streaming', 'batch', 'mixed'],
      },
    },
    {
      name: 'dataSize',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Expected data size to process',
      validation: {
        enum: ['small', 'medium', 'large', 'xlarge'],
      },
    },
    {
      name: 'budget',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Budget constraints for the cluster',
      validation: {
        enum: ['low', 'medium', 'high', 'unlimited'],
      },
    },
    {
      name: 'region',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'Target GCP region for deployment',
    },
    {
      name: 'requirements',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Additional specific requirements or constraints',
    },
    {
      name: 'profileId',
      type: 'string',
      required: false,
      source: 'profile',
      description: 'Profile ID for configuration templates',
    },
  ],

  resourceAccess: [
    {
      uri: 'dataproc://profile/{{category}}/{{profileId}}/config',
      purpose: 'cluster-templates',
      cacheKey: 'profile_{{profileId}}_templates',
      ttl: 3600000, // 1 hour
    },
  ],

  knowledgeQueries: [
    {
      type: 'semantic',
      query: 'workload {{workloadType}} {{dataSize}} cluster',
      filters: { type: 'cluster' },
      limit: 3,
      minConfidence: 0.7,
    },
    {
      type: 'semantic',
      query: 'region {{region}} cluster configuration best practices',
      limit: 2,
      minConfidence: 0.6,
    },
    {
      type: 'semantic',
      query: '{{budget}} budget cluster optimization',
      filters: { type: 'cluster' },
      limit: 2,
      minConfidence: 0.6,
    },
  ],

  dynamicFunctions: [
    {
      name: 'profile_config',
      args: ['{{profileId}}', 'cluster-templates'],
      cacheKey: 'profile_config_{{profileId}}',
      ttl: 3600000, // 1 hour
    },
    {
      name: 'qdrant_query',
      args: ['workload {{workloadType}} {{dataSize}} cluster', 'limit:3 type:cluster'],
      cacheKey: 'workload_{{workloadType}}_{{dataSize}}',
      ttl: 1800000, // 30 minutes
    },
  ],
};

/**
 * Template 3: troubleshoot-dataproc-issue (Fully-Integrated)
 * Comprehensive troubleshooting with all system integrations
 */
export const troubleshootDataprocIssueTemplate: PromptTemplate = {
  id: 'troubleshoot-dataproc-issue',
  category: 'fully-integrated',
  description: 'Comprehensive troubleshooting with semantic error matching and job analysis',

  template: `Troubleshoot this Dataproc issue with comprehensive analysis:

**Issue Details:**
- **Type**: {{issueType}}
- **Error Message**: {{errorMessage || 'not provided'}}
- **Job ID**: {{jobId || 'not applicable'}}
- **Cluster**: {{clusterName || 'not specified'}}
- **Timeline**: {{timeline || 'not specified'}}
- **Context**: {{context || 'not provided'}}
- **Project**: {{projectId || 'not specified'}}
- **Region**: {{region || 'not specified'}}

**Job Output and Error Analysis:**
{{job_output(jobId, "error-analysis")}}

**Similar Error Patterns from Knowledge Base:**
{{qdrant_query("error " + issueType + " " + errorMessage, "limit:5 type:error")}}

**Cluster Configuration Analysis:**
{{qdrant_query("cluster " + clusterName + " configuration issues", "limit:3 type:cluster")}}

**Historical Resolution Patterns:**
{{qdrant_query("resolved " + issueType + " troubleshooting solutions", "limit:3")}}

**Related Job Failures:**
{{qdrant_query("job failure " + issueType + " " + clusterName, "limit:2 type:job")}}

**Troubleshooting Analysis:**
Please provide a systematic troubleshooting approach:

1. **Root Cause Analysis**
   - Primary cause identification based on error patterns
   - Secondary contributing factors
   - System state analysis at time of failure
   - Resource utilization assessment

2. **Step-by-Step Troubleshooting Guide**
   - Immediate diagnostic steps to take
   - Data collection and log analysis procedures
   - Progressive isolation techniques
   - Verification checkpoints

3. **Diagnostic Commands and Tools**
   - Specific gcloud commands for investigation
   - Log queries and monitoring dashboards
   - Performance analysis tools
   - Network and connectivity tests

4. **Resolution Strategies**
   - Primary resolution approach based on similar cases
   - Alternative solutions if primary approach fails
   - Rollback procedures if needed
   - Testing and validation steps

5. **Prevention Recommendations**
   - Configuration changes to prevent recurrence
   - Monitoring and alerting improvements
   - Best practices implementation
   - Proactive maintenance procedures

6. **Escalation Path**
   - When to involve Google Cloud Support
   - Information to gather before escalation
   - Internal team escalation procedures
   - Emergency response protocols`,

  parameters: [
    {
      name: 'issueType',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Type of issue being experienced',
      validation: {
        enum: ['job-failure', 'cluster-startup', 'performance', 'connectivity', 'other'],
      },
    },
    {
      name: 'errorMessage',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Specific error message or symptoms',
    },
    {
      name: 'jobId',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Job ID if the issue is related to a specific job',
    },
    {
      name: 'clusterName',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Name of the affected cluster',
    },
    {
      name: 'timeline',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'When the issue started or was first noticed',
    },
    {
      name: 'context',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Additional context about what was being attempted',
    },
    {
      name: 'projectId',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP project ID for context',
    },
    {
      name: 'region',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP region for context',
    },
  ],

  dynamicFunctions: [
    {
      name: 'job_output',
      args: ['{{jobId}}', 'error-analysis'],
      cacheKey: 'job_output_{{jobId}}',
      ttl: 600000, // 10 minutes
    },
    {
      name: 'qdrant_query',
      args: ['error {{issueType}} {{errorMessage}}', 'limit:5 type:error'],
      cacheKey: 'error_{{issueType}}_patterns',
      ttl: 1800000, // 30 minutes
    },
    {
      name: 'qdrant_query',
      args: ['cluster {{clusterName}} configuration issues', 'limit:3 type:cluster'],
      cacheKey: 'cluster_{{clusterName}}_issues',
      ttl: 900000, // 15 minutes
    },
    {
      name: 'qdrant_query',
      args: ['resolved {{issueType}} troubleshooting solutions', 'limit:3'],
      cacheKey: 'resolved_{{issueType}}',
      ttl: 3600000, // 1 hour
    },
  ],

  knowledgeQueries: [
    {
      type: 'semantic',
      query: 'error {{issueType}} {{errorMessage}}',
      filters: { type: 'error' },
      limit: 5,
      minConfidence: 0.6,
    },
    {
      type: 'semantic',
      query: 'cluster {{clusterName}} configuration issues',
      filters: { type: 'cluster' },
      limit: 3,
      minConfidence: 0.7,
    },
    {
      type: 'semantic',
      query: 'resolved {{issueType}} troubleshooting solutions',
      limit: 3,
      minConfidence: 0.7,
    },
  ],
};

/**
 * Template 4: generate-dataproc-query (Template-Enhanced)
 * Generates optimized queries with template-driven optimization
 */
export const generateDataprocQueryTemplate: PromptTemplate = {
  id: 'generate-dataproc-query',
  category: 'template-enhanced',
  description: 'Generate optimized queries with template-driven optimization and examples',

  template: `Generate an optimized {{dialect}} query for the following requirements:

**Requirements:**
- **Purpose**: {{queryPurpose}}
- **Tables**: {{tableNames || 'to be determined'}}
- **Query Type**: {{queryType}}
- **Dialect**: {{dialect}}
- **Performance Level**: {{performanceLevel}}
- **Target Cluster**: {{clusterName || 'any'}}
- **Project**: {{projectId || 'not specified'}}
- **Region**: {{region || 'not specified'}}

**Cluster-Specific Optimization Hints:**
{{cluster_status(clusterName, "optimization-hints")}}

**Query Pattern Examples from Knowledge Base:**
{{qdrant_query("successful " + queryType + " " + dialect + " queries", "limit:3 type:job")}}

**Performance Best Practices:**
{{qdrant_query(dialect + " " + performanceLevel + " optimization patterns", "limit:2")}}

**Similar Query Implementations:**
{{qdrant_query("query " + queryPurpose + " " + dialect, "limit:2 type:job")}}

**Generation Requirements:**
Please provide a complete query solution including:

1. **Complete, Runnable Query**
   - Fully functional {{dialect}} query that addresses the requirements
   - Proper syntax and formatting for {{dialect}}
   - Comments explaining key sections and logic
   - Parameter placeholders where appropriate

2. **Query Logic and Approach Explanation**
   - Step-by-step breakdown of the query logic
   - Reasoning behind chosen approach
   - Data flow and transformation explanation
   - Join strategies and filtering logic

3. **Performance Optimizations**
   - Specific optimizations for {{performanceLevel}} performance level
   - Indexing recommendations for better performance
   - Partitioning strategies if applicable
   - Memory and resource optimization techniques

4. **Alternative Approaches**
   - Different strategies to achieve the same result
   - Trade-offs between different approaches
   - When to use each alternative approach
   - Performance implications of each option

5. **Execution Considerations**
   - Memory requirements and allocation strategies
   - Parallelism and concurrency considerations
   - Resource usage patterns and optimization
   - Estimated execution time and resource consumption

6. **Monitoring and Validation Recommendations**
   - Key metrics to monitor during execution
   - Performance benchmarks and thresholds
   - Data quality validation checks
   - Error handling and recovery strategies`,

  parameters: [
    {
      name: 'queryPurpose',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'What the query is intended to accomplish',
    },
    {
      name: 'tableNames',
      type: 'string',
      required: false,
      source: 'tool',
      description: 'Comma-separated list of table names to work with',
    },
    {
      name: 'queryType',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Type of query operation',
      validation: {
        enum: ['select', 'insert', 'update', 'create', 'analyze'],
      },
    },
    {
      name: 'dialect',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'SQL dialect to use',
      validation: {
        enum: ['hive', 'spark-sql', 'presto'],
      },
    },
    {
      name: 'performanceLevel',
      type: 'string',
      required: true,
      source: 'tool',
      description: 'Target performance level',
      validation: {
        enum: ['standard', 'optimized', 'high-performance'],
      },
    },
    {
      name: 'clusterName',
      type: 'string',
      required: false,
      source: 'profile',
      description: 'Target cluster for optimization context',
    },
    {
      name: 'projectId',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP project ID for context',
    },
    {
      name: 'region',
      type: 'string',
      required: false,
      source: 'gcp',
      description: 'GCP region for context',
    },
  ],

  templateResolution: {
    enableParameterInjection: true,
    enableDynamicFunctions: true,
    cacheResults: true,
    timeoutMs: 15000,
  },

  dynamicFunctions: [
    {
      name: 'cluster_status',
      args: ['{{clusterName}}', 'optimization-hints'],
      cacheKey: 'cluster_status_{{clusterName}}',
      ttl: 900000, // 15 minutes
    },
    {
      name: 'qdrant_query',
      args: ['successful {{queryType}} {{dialect}} queries', 'limit:3 type:job'],
      cacheKey: 'successful_{{queryType}}_{{dialect}}',
      ttl: 1800000, // 30 minutes
    },
    {
      name: 'qdrant_query',
      args: ['{{dialect}} {{performanceLevel}} optimization patterns', 'limit:2'],
      cacheKey: 'optimization_{{dialect}}_{{performanceLevel}}',
      ttl: 3600000, // 1 hour
    },
  ],

  knowledgeQueries: [
    {
      type: 'semantic',
      query: 'successful {{queryType}} {{dialect}} queries',
      filters: { type: 'job' },
      limit: 3,
      minConfidence: 0.7,
    },
    {
      type: 'semantic',
      query: '{{dialect}} {{performanceLevel}} optimization patterns',
      limit: 2,
      minConfidence: 0.6,
    },
    {
      type: 'semantic',
      query: 'query {{queryPurpose}} {{dialect}}',
      filters: { type: 'job' },
      limit: 2,
      minConfidence: 0.6,
    },
  ],
};

/**
 * All enhanced prompt templates
 */
export const ENHANCED_PROMPT_TEMPLATES: PromptTemplate[] = [
  analyzeDataprocQueryTemplate,
  designDataprocClusterTemplate,
  troubleshootDataprocIssueTemplate,
  generateDataprocQueryTemplate,
];

/**
 * Template registry for easy access
 */
export const TEMPLATE_REGISTRY = new Map<string, PromptTemplate>(
  ENHANCED_PROMPT_TEMPLATES.map((template) => [template.id, template])
);
