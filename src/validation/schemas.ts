/**
 * Comprehensive Zod schemas for input validation
 * Phase 2: Security Hardening - Enhanced Input Validation
 */

import { z } from 'zod';

// Quick job status check schema
export const CheckActiveJobsSchema = z.object({
  projectId: z.string().optional(),
  region: z.string().optional(),
  includeCompleted: z.boolean().optional().default(false),
});

// Common validation patterns
const GCP_PROJECT_ID_REGEX = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const GCP_REGION_REGEX = /^[a-z]+-[a-z]+\d+$/;
const GCP_ZONE_REGEX = /^[a-z]+-[a-z]+\d+-[a-z]$/;
const CLUSTER_NAME_REGEX = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;
const SERVICE_ACCOUNT_EMAIL_REGEX = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;

// Base schemas for common parameters
export const ProjectIdSchema = z
  .string()
  .min(6, 'Project ID must be at least 6 characters')
  .max(30, 'Project ID must be at most 30 characters')
  .regex(GCP_PROJECT_ID_REGEX, 'Invalid GCP project ID format')
  .describe('Google Cloud Project ID');

export const RegionSchema = z
  .string()
  .regex(GCP_REGION_REGEX, 'Invalid GCP region format (e.g., us-central1)')
  .describe('Google Cloud region');

export const ZoneSchema = z
  .string()
  .regex(GCP_ZONE_REGEX, 'Invalid GCP zone format (e.g., us-central1-a)')
  .describe('Google Cloud zone');

export const ClusterNameSchema = z
  .string()
  .min(2, 'Cluster name must be at least 2 characters')
  .max(54, 'Cluster name must be at most 54 characters')
  .regex(
    CLUSTER_NAME_REGEX,
    'Cluster name must start with lowercase letter, contain only lowercase letters, numbers, and hyphens'
  )
  .describe('Dataproc cluster name');

export const JobIdSchema = z
  .string()
  .min(1, 'Job ID is required')
  .max(100, 'Job ID too long')
  .describe('Dataproc job ID');

export const ServiceAccountEmailSchema = z
  .string()
  .email('Invalid email format')
  .regex(SERVICE_ACCOUNT_EMAIL_REGEX, 'Must be a valid service account email')
  .describe('Service account email');

// Pagination schemas
export const PaginationSchema = z.object({
  pageSize: z
    .number()
    .int('Page size must be an integer')
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size must be at most 100')
    .optional()
    .describe('Number of results per page'),
  pageToken: z
    .string()
    .max(1000, 'Page token too long')
    .optional()
    .describe('Token for pagination'),
});

// Tool input schemas
export const StartDataprocClusterSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  clusterName: ClusterNameSchema,
  clusterConfig: z.record(z.any()).optional().describe('Cluster configuration object'),
});

export const CreateClusterFromYamlSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  yamlPath: z
    .string()
    .min(1, 'YAML path is required')
    .max(500, 'YAML path too long')
    .describe('Path to YAML configuration file'),
  overrides: z.record(z.any()).optional().describe('Configuration overrides'),
});

export const CreateClusterFromProfileSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  profileName: z
    .string()
    .min(1, 'Profile name is required')
    .max(100, 'Profile name too long')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Profile name can only contain letters, numbers, underscores, and hyphens'
    )
    .describe('Name of the profile to use'),
  clusterName: ClusterNameSchema,
  overrides: z.record(z.any()).optional().describe('Configuration overrides'),
});

export const ListClustersSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  filter: z.string().max(500, 'Filter string too long').optional().describe('Filter expression'),
  verbose: z.boolean().optional().default(false).describe('Return full response without filtering'),
  ...PaginationSchema.shape,
});

export const GetClusterSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  clusterName: ClusterNameSchema,
  verbose: z.boolean().optional().default(false).describe('Return full response without filtering'),
  semanticQuery: z
    .string()
    .optional()
    .describe('Optional: Semantic query to extract specific information'),
});

export const DeleteClusterSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  clusterName: ClusterNameSchema,
});

export const SubmitHiveQuerySchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  clusterName: ClusterNameSchema,
  query: z
    .string()
    .min(1, 'Query is required')
    .max(10000, 'Query too long (max 10,000 characters)')
    .describe('Hive query to execute'),
  async: z.boolean().optional().describe('Whether to run asynchronously'),
  verbose: z.boolean().optional().default(false).describe('Return full response without filtering'),
  queryOptions: z
    .object({
      timeoutMs: z
        .number()
        .int('Timeout must be an integer')
        .min(1000, 'Timeout must be at least 1 second')
        .max(3600000, 'Timeout must be at most 1 hour')
        .optional()
        .describe('Query timeout in milliseconds'),
      parameters: z.record(z.string()).optional().describe('Query parameters'),
      properties: z.record(z.string()).optional().describe('Query properties'),
    })
    .optional()
    .describe('Query configuration options'),
});

export const GetJobStatusSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  jobId: JobIdSchema,
  verbose: z.boolean().optional().default(false).describe('Return full response without filtering'),
});

export const GetQueryResultsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  jobId: JobIdSchema,
  maxResults: z
    .number()
    .int('Max results must be an integer')
    .min(1, 'Max results must be at least 1')
    .max(10000, 'Max results must be at most 10,000')
    .optional()
    .describe('Maximum number of results to return'),
  pageToken: z.string().max(1000, 'Page token too long').optional().describe('Pagination token'),
});

export const SubmitDataprocJobSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  clusterName: ClusterNameSchema,
  jobType: z
    .enum(['hive', 'spark', 'pyspark', 'presto', 'pig', 'hadoop'], {
      errorMap: () => ({
        message: 'Job type must be one of: hive, spark, pyspark, presto, pig, hadoop',
      }),
    })
    .describe('Type of Dataproc job'),
  jobConfig: z.record(z.any()).describe('Job configuration object'),
  async: z.boolean().optional().describe('Whether to submit asynchronously'),
});

export const GetJobResultsSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  jobId: JobIdSchema,
  maxResults: z
    .number()
    .int('Max results must be an integer')
    .min(1, 'Max results must be at least 1')
    .max(1000, 'Max results must be at most 1,000')
    .default(10)
    .describe('Maximum number of rows to display'),
});

export const GetZeppelinUrlSchema = z.object({
  projectId: ProjectIdSchema,
  region: RegionSchema,
  clusterName: ClusterNameSchema,
});

export const ListTrackedClustersSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  profileId: z.string().max(100, 'Profile ID too long').optional().describe('Filter by profile ID'),
});

export const QueryClusterDataSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  query: z
    .string()
    .min(1, 'Query is required')
    .max(1000, 'Query too long')
    .describe('Natural language query'),
  clusterName: ClusterNameSchema.optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(5)
    .describe('Maximum number of results'),
});

export const GetClusterInsightsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
});

export const GetJobAnalyticsSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
});

export const QueryKnowledgeSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  query: z
    .string()
    .min(1, 'Query is required')
    .max(1000, 'Query too long')
    .describe('Natural language query'),
  type: z
    .enum(['clusters', 'cluster', 'jobs', 'job', 'errors', 'error', 'all'])
    .optional()
    .describe('Type of knowledge to search'),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(10)
    .describe('Maximum number of results'),
  includeRawDocument: z.boolean().optional().default(false).describe('Include raw Qdrant document'),
});

export const ListProfilesSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  category: z.string().max(50, 'Category name too long').optional().describe('Filter by category'),
});

export const GetProfileSchema = z.object({
  projectId: ProjectIdSchema.optional(),
  region: RegionSchema.optional(),
  profileId: z
    .string()
    .min(1, 'Profile ID is required')
    .max(100, 'Profile ID too long')
    .describe('ID of the profile'),
});

// Security validation helpers
export function sanitizeString(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>'"&]/g, '') // Remove HTML/XML special characters
    .replace(/[;|&$`]/g, '') // Remove shell injection characters
    .trim();
}

export function validateGCPResourceName(
  name: string,
  type: 'project' | 'cluster' | 'job'
): boolean {
  switch (type) {
    case 'project':
      return GCP_PROJECT_ID_REGEX.test(name);
    case 'cluster':
      return CLUSTER_NAME_REGEX.test(name);
    case 'job':
      return name.length > 0 && name.length <= 100;
    default:
      return false;
  }
}

export function validateRegionZone(region: string, zone?: string): boolean {
  if (!GCP_REGION_REGEX.test(region)) {
    return false;
  }

  if (zone && !zone.startsWith(region)) {
    return false; // Zone must be in the specified region
  }

  return true;
}

// Rate limiting configuration
export const RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Max requests per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
};

// Security headers configuration
export const SecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Input sanitization configuration
export const SanitizationConfig = {
  removeHtmlTags: true,
  removeScriptTags: true,
  maxStringLength: 10000,
  allowedCharacters: /^[a-zA-Z0-9\s\-_.,!?@#$%^&*()+={}[\]:;"'<>/\\|`~]*$/,
};
