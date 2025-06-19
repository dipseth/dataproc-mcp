---
layout: default
title: API Reference
description: Complete reference for all Dataproc MCP Server tools with practical examples and usage patterns
permalink: /API_REFERENCE/
---

# 📚 API Reference

Complete reference for all 17 Dataproc MCP Server tools with practical examples and usage patterns.

## Overview

The Dataproc MCP Server provides 17 comprehensive tools organized into four categories:
- **Cluster Management** (6 tools)
- **Job Execution** (6 tools)
- **Profile Management** (3 tools)
- **Monitoring & Utilities** (2 tools)

## Authentication

For detailed authentication setup and best practices, refer to the [Authentication Implementation Guide](AUTHENTICATION_IMPLEMENTATION_GUIDE.md).

All tools support intelligent default parameters. When `projectId` and `region` are not provided, the server automatically uses configured defaults from `config/default-params.json`.

## Cluster Management Tools

### 1. start_dataproc_cluster

Creates a new Dataproc cluster with basic configuration.

**Parameters:**
- `projectId` (string, optional): GCP project ID
- `region` (string, optional): Dataproc region
- `clusterName` (string, required): Name for the new cluster
- `clusterConfig` (object, optional): Custom cluster configuration

**Example:**
```json
{
  "tool": "start_dataproc_cluster",
  "arguments": {
    "clusterName": "my-analysis-cluster",
    "clusterConfig": {
      "masterConfig": {
        "numInstances": 1,
        "machineTypeUri": "n1-standard-4"
      },
      "workerConfig": {
        "numInstances": 3,
        "machineTypeUri": "n1-standard-2"
      }
    }
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Cluster my-analysis-cluster started successfully in region us-central1.\nCluster details:\n{\n  \"clusterName\": \"my-analysis-cluster\",\n  \"status\": {\n    \"state\": \"RUNNING\"\n  }\n}"
    }
  ]
}
```

### 2. create_cluster_from_yaml

Creates a cluster using a YAML configuration file.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `yamlPath` (string, required): Path to YAML configuration file
- `overrides` (object, optional): Runtime configuration overrides

**Example:**
```json
{
  "tool": "create_cluster_from_yaml",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "yamlPath": "./configs/production-cluster.yaml",
    "overrides": {
      "clusterName": "prod-cluster-001"
    }
  }
}
```

### 3. create_cluster_from_profile

Creates a cluster using a predefined profile.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `profileName` (string, required): Name of the profile to use
- `clusterName` (string, required): Name for the new cluster
- `overrides` (object, optional): Configuration overrides

**Example:**
```json
{
  "tool": "create_cluster_from_profile",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "profileName": "production/high-memory/analysis",
    "clusterName": "analytics-cluster-prod"
  }
}
```

### 4. list_clusters

Lists all Dataproc clusters in a project and region with intelligent response optimization.

**Parameters:**
- `projectId` (string, optional): GCP project ID
- `region` (string, optional): Dataproc region
- `filter` (string, optional): Filter expression
- `pageSize` (number, optional): Number of results per page (1-100)
- `pageToken` (string, optional): Token for pagination
- `verbose` (boolean, optional): Return full response without filtering (default: false)

**Response Optimization:**
- **Default (optimized)**: 96.2% token reduction (7,651 → 292 tokens)
- **Verbose mode**: Full response with complete cluster details
- **Storage**: Full data automatically stored in Qdrant for later access

**Example (Optimized Response):**
```json
{
  "tool": "list_clusters",
  "arguments": {
    "filter": "status.state=RUNNING",
    "pageSize": 10
  }
}
```

**Optimized Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 clusters in my-project-123/us-central1:\n\n• analytics-cluster-prod (RUNNING) - n1-standard-4, 5 nodes\n• data-pipeline-dev (RUNNING) - n1-standard-2, 3 nodes  \n• ml-training-cluster (CREATING) - n1-highmem-8, 10 nodes\n\n💾 Full details stored: dataproc://responses/clusters/list/abc123\n📊 Token reduction: 96.2% (7,651 → 292 tokens)"
    }
  ]
}
```

**Verbose Response:**
```json
{
  "tool": "list_clusters",
  "arguments": {
    "filter": "status.state=RUNNING",
    "pageSize": 10,
    "verbose": true
  }
}
```

**Full Response (verbose=true):**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Clusters in project my-project-123, region us-central1:\n{\n  \"clusters\": [\n    {\n      \"clusterName\": \"analytics-cluster-prod\",\n      \"status\": {\n        \"state\": \"RUNNING\",\n        \"stateStartTime\": \"2024-01-01T10:00:00Z\"\n      },\n      \"config\": {\n        \"masterConfig\": {\n          \"numInstances\": 1,\n          \"machineTypeUri\": \"n1-standard-4\"\n        },\n        \"workerConfig\": {\n          \"numInstances\": 4,\n          \"machineTypeUri\": \"n1-standard-4\"\n        }\n      }\n    }\n  ]\n}"
    }
  ]
}
```

### 5. get_cluster

Gets detailed information about a specific cluster with intelligent response optimization.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster
- `verbose` (boolean, optional): Return full response without filtering (default: false)

**Response Optimization:**
- **Default (optimized)**: 64.0% token reduction (553 → 199 tokens)
- **Verbose mode**: Full cluster configuration and metadata
- **Storage**: Complete cluster details stored in Qdrant

**Example (Optimized Response):**
```json
{
  "tool": "get_cluster",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "my-analysis-cluster"
  }
}
```

**Optimized Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Cluster: my-analysis-cluster (RUNNING)\n🖥️  Master: 1x n1-standard-4\n👥 Workers: 4x n1-standard-2\n🌐 Zone: us-central1-b\n⏰ Created: 2024-01-01 10:00 UTC\n\n💾 Full config: dataproc://responses/clusters/get/def456\n📊 Token reduction: 64.0% (553 → 199 tokens)"
    }
  ]
}
```

**Verbose Response:**
```json
{
  "tool": "get_cluster",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "my-analysis-cluster",
    "verbose": true
  }
}
```

### 6. delete_cluster

Deletes a Dataproc cluster.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster to delete

**Example:**
```json
{
  "tool": "delete_cluster",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "temporary-cluster"
  }
}
```

## Job Execution Tools

### 7. submit_hive_query

Submits a Hive query to a Dataproc cluster.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster
- `query` (string, required): Hive query to execute (max 10,000 characters)
- `async` (boolean, optional): Whether to run asynchronously
- `queryOptions` (object, optional): Query configuration options

**Example:**
```json
{
  "tool": "submit_hive_query",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "analytics-cluster",
    "query": "SELECT customer_id, COUNT(*) as order_count FROM orders WHERE order_date >= '2024-01-01' GROUP BY customer_id ORDER BY order_count DESC LIMIT 100",
    "async": false,
    "queryOptions": {
      "timeoutMs": 300000,
      "properties": {
        "hive.exec.dynamic.partition": "true",
        "hive.exec.dynamic.partition.mode": "nonstrict"
      }
    }
  }
}
```

### 8. submit_dataproc_job

Submits a generic Dataproc job (Hive, Spark, PySpark, etc.) with enhanced local file staging support.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster
- `jobType` (string, required): Type of job (hive, spark, pyspark, presto, pig, hadoop)
- `jobConfig` (object, required): Job configuration object
- `async` (boolean, optional): Whether to submit asynchronously

**🔧 LOCAL FILE STAGING:**

The `baseDirectory` parameter in the local file staging system controls how relative file paths are resolved when using the template syntax `{@./relative/path}` or direct relative paths in job configurations.

**Configuration:**
The `baseDirectory` parameter is configured in `config/default-params.json` with a default value of `"."`, which refers to the **current working directory** where the MCP server process is running (typically the project root directory).

**Path Resolution Logic:**

1. **Absolute Paths**: If a file path is already absolute (starts with `/`), it's used as-is
2. **Relative Path Resolution**: For relative paths, the system:
   - Gets the baseDirectory value from configuration (default: `"."`)
   - Resolves the baseDirectory if it's relative:
     - First tries to use `DATAPROC_CONFIG_PATH` environment variable's directory
     - Falls back to `process.cwd()` (current working directory)
   - Combines baseDirectory with the relative file path

**Template Syntax Support:**
```typescript
// Template syntax - recommended approach
{@./relative/path/to/file.py}
{@../parent/directory/file.jar}
{@subdirectory/file.sql}

// Direct relative paths (also supported)
"./relative/path/to/file.py"
"../parent/directory/file.jar"
"subdirectory/file.sql"
```

**Practical Examples:**

*Example 1: Default Configuration (`baseDirectory: "."`)*
- **Template**: `{@./test-spark-job.py}`
- **Resolution**: `/Users/srivers/Documents/Cline/MCP/dataproc-server/test-spark-job.py`

*Example 2: Config Directory Base*
- **Configuration**: `baseDirectory: "config"`
- **Template**: `{@./my-script.py}`
- **Resolution**: `/Users/srivers/Documents/Cline/MCP/dataproc-server/config/my-script.py`

*Example 3: Absolute Base Directory*
- **Configuration**: `baseDirectory: "/absolute/path/to/files"`
- **Template**: `{@./script.py}`
- **Resolution**: `/absolute/path/to/files/script.py`

**Environment Variable Influence:**
The `DATAPROC_CONFIG_PATH` environment variable affects path resolution:
- **If set**: The directory containing the config file becomes the reference point for relative `baseDirectory` values
- **If not set**: The current working directory (`process.cwd()`) is used as the reference point

**Best Practices:**
1. **Use Template Syntax**: Prefer `{@./file.py}` over direct relative paths for clarity
2. **Organize Files Relative to Project Root**: With the default `baseDirectory: "."`, organize your files relative to the project root
3. **Consider Absolute Paths for External Files**: For files outside the project structure, use absolute paths

**Supported File Extensions:**
- `.py` - Python files for PySpark jobs
- `.jar` - Java/Scala JAR files for Spark jobs
- `.sql` - SQL files for various job types
- `.R` - R script files for SparkR jobs

**Troubleshooting:**
- **File Not Found**: Check that the resolved absolute path exists
- **Permission Denied**: Ensure the MCP server has read access to the file
- **Unexpected Path Resolution**: Verify your `baseDirectory` setting and current working directory

**Debug Path Resolution:**
Enable debug logging to see the actual path resolution:
```bash
DEBUG=dataproc-mcp:* node build/index.js
```

**Configuration Override:**
You can override the `baseDirectory` in your environment-specific configuration:
```json
{
  "environment": "development",
  "parameters": {
    "baseDirectory": "./dev-scripts"
  }
}
```

Files are automatically staged to GCS and cleaned up after job completion.

**Example - Spark Job:**
```json
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "spark-cluster",
    "jobType": "spark",
    "jobConfig": {
      "mainClass": "com.example.SparkApp",
      "jarFileUris": ["{@./spark-app.jar}"],
      "args": ["--input", "gs://my-bucket/input/", "--output", "gs://my-bucket/output/"],
      "properties": {
        "spark.executor.memory": "4g",
        "spark.executor.cores": "2"
      }
    },
    "async": true
  }
}
```

**Example - PySpark Job with Local File Staging:**
```json
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "pyspark-cluster",
    "jobType": "pyspark",
    "jobConfig": {
      "mainPythonFileUri": "{@./test-spark-job.py}",
      "pythonFileUris": ["{@./utils/helper.py}", "{@/absolute/path/library.py}"],
      "args": ["--date", "2024-01-01"],
      "properties": {
        "spark.sql.adaptive.enabled": "true",
        "spark.sql.adaptive.coalescePartitions.enabled": "true"
      }
    }
  }
}
```

**Example - Traditional PySpark Job (GCS URIs):**
```json
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "pyspark-cluster",
    "jobType": "pyspark",
    "jobConfig": {
      "mainPythonFileUri": "gs://my-bucket/scripts/data_processing.py",
      "pythonFileUris": ["gs://my-bucket/scripts/utils.py"],
      "args": ["--date", "2024-01-01"],
      "properties": {
        "spark.sql.adaptive.enabled": "true",
        "spark.sql.adaptive.coalescePartitions.enabled": "true"
      }
    }
  }
}
```

**Local File Staging Process:**
1. **Detection**: Local file paths are automatically detected using template syntax
2. **Staging**: Files are uploaded to the cluster's staging bucket with unique names
3. **Transformation**: Job config is updated with GCS URIs
4. **Execution**: Job runs with staged files
5. **Cleanup**: Staged files are automatically cleaned up after job completion

**Supported File Extensions:**
- `.py` - Python files for PySpark jobs
- `.jar` - Java/Scala JAR files for Spark jobs
- `.sql` - SQL files for various job types
- `.R` - R script files for SparkR jobs

### 9. get_job_status

Gets the status of a Dataproc job.

**Parameters:**
- `projectId` (string, optional): GCP project ID
- `region` (string, optional): Dataproc region
- `jobId` (string, required): Job ID to check

**Example:**
```json
{
  "tool": "get_job_status",
  "arguments": {
    "jobId": "job-12345-abcdef"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Job status for job-12345-abcdef:\n{\n  \"status\": {\n    \"state\": \"DONE\",\n    \"stateStartTime\": \"2024-01-01T12:00:00Z\"\n  },\n  \"driverOutputResourceUri\": \"gs://bucket/output/\"\n}"
    }
  ]
}
```

### 10. get_query_results

Gets the results of a completed Hive query.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `jobId` (string, required): Job ID to get results for
- `maxResults` (number, optional): Maximum number of results (1-10,000)
- `pageToken` (string, optional): Pagination token

**Example:**
```json
{
  "tool": "get_query_results",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "jobId": "hive-job-12345",
    "maxResults": 50
  }
}
```

### 11. get_job_results

Gets the results of a completed Dataproc job.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `jobId` (string, required): Job ID to get results for
- `maxResults` (number, optional): Maximum rows to display (default: 10, max: 1,000)

**Example:**
```json
{
  "tool": "get_job_results",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "jobId": "spark-job-67890",
    "maxResults": 100
  }
}
```

### 12. cancel_dataproc_job

Cancels a running or pending Dataproc job with intelligent status handling and job tracking integration.

**Parameters:**
- `jobId` (string, required): The ID of the Dataproc job to cancel
- `projectId` (string, optional): GCP project ID (uses defaults if not provided)
- `region` (string, optional): Dataproc region (uses defaults if not provided)
- `verbose` (boolean, optional): Return full response without filtering (default: false)

**🛑 CANCELLATION WORKFLOW:**
- Attempts to cancel jobs in PENDING or RUNNING states
- Provides informative messages for jobs already in terminal states
- Updates internal job tracking when cancellation succeeds

**📊 STATUS HANDLING:**
- **PENDING/RUNNING** → Cancellation attempted
- **DONE/ERROR/CANCELLED** → Informative message returned
- **Job not found** → Clear error message

**💡 MONITORING:**
After cancellation, use `get_job_status("jobId")` to confirm the job reaches CANCELLED state.

**Example:**
```json
{
  "tool": "cancel_dataproc_job",
  "arguments": {
    "jobId": "Clean_Places_sub_group_base_1_cleaned_places_13b6ec3f"
  }
}
```

**Successful Cancellation Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "🛑 Job Cancellation Status\n\nJob ID: Clean_Places_sub_group_base_1_cleaned_places_13b6ec3f\nStatus: 3\nMessage: Cancellation request sent for job Clean_Places_sub_group_base_1_cleaned_places_13b6ec3f."
    }
  ]
}
```

**Job Already Completed Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Cannot cancel job Clean_Places_sub_group_base_1_cleaned_places_13b6ec3f in state: 'DONE'; cancellable states: '[PENDING, RUNNING]'"
    }
  ]
}
```

**Use Cases:**
- **Emergency Cancellation**: Stop runaway jobs consuming excessive resources
- **Pipeline Management**: Cancel dependent jobs when upstream processes fail
- **Cost Control**: Terminate expensive long-running jobs
- **Development Workflow**: Cancel test jobs during development iterations

**Best Practices:**
1. **Monitor job status** before and after cancellation attempts
2. **Use with get_job_status** to verify cancellation completion
3. **Handle gracefully** when jobs are already in terminal states
4. **Consider dependencies** before cancelling pipeline jobs

## Profile Management Tools

### 13. list_profiles

Lists available cluster configuration profiles.

**Parameters:**
- `category` (string, optional): Filter by category (e.g., "development", "production")

**Example:**
```json
{
  "tool": "list_profiles",
  "arguments": {
    "category": "production"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Available profiles:\n[\n  {\n    \"id\": \"production/high-memory/analysis\",\n    \"name\": \"High Memory Analysis\",\n    \"category\": \"production\"\n  }\n]"
    }
  ]
}
```

### 14. get_profile

Gets details for a specific cluster configuration profile.

**Parameters:**
- `profileId` (string, required): ID of the profile (e.g., "development/small")

**Example:**
```json
{
  "tool": "get_profile",
  "arguments": {
    "profileId": "development/small"
  }
}
```

### 15. list_tracked_clusters

Lists clusters that were created and tracked by this MCP server.

**Parameters:**
- `profileId` (string, optional): Filter by profile ID

**Example:**
```json
{
  "tool": "list_tracked_clusters",
  "arguments": {
    "profileId": "production/high-memory/analysis"
  }
}
```

## Monitoring & Utilities

### 16. get_zeppelin_url

Gets the Zeppelin notebook URL for a cluster (if enabled).

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster

**Example:**
```json
{
  "tool": "get_zeppelin_url",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "jupyter-cluster"
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Zeppelin URL for cluster jupyter-cluster:\nhttps://jupyter-cluster-m.us-central1-a.c.my-project-123.internal:8080"
    }
  ]
}
```

### 17. check_active_jobs

🚀 Quick status check for all active and recent jobs with intelligent response optimization.

**Parameters:**
- `projectId` (string, optional): GCP project ID (shows all if not specified)
- `region` (string, optional): Dataproc region (shows all if not specified)
- `includeCompleted` (boolean, optional): Include recently completed jobs (default: false)
- `verbose` (boolean, optional): Return full response without filtering (default: false)

**Response Optimization:**
- **Default (optimized)**: 80.6% token reduction (1,626 → 316 tokens)
- **Verbose mode**: Complete job details and metadata
- **Storage**: Full job data stored in Qdrant for analysis

**Example (Optimized Response):**
```json
{
  "tool": "check_active_jobs",
  "arguments": {
    "includeCompleted": true
  }
}
```

**Optimized Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "🚀 Active Jobs Summary:\n\n▶️  RUNNING (2):\n• hive-analytics-job (5m ago) - analytics-cluster\n• spark-etl-pipeline (12m ago) - data-pipeline-cluster\n\n✅ COMPLETED (3):\n• daily-report-job (1h ago) - SUCCESS\n• data-validation (2h ago) - SUCCESS  \n• backup-process (3h ago) - SUCCESS\n\n💾 Full details: dataproc://responses/jobs/active/ghi789\n📊 Token reduction: 80.6% (1,626 → 316 tokens)"
    }
  ]
}
```

## Data Structures

### Output Formats

```typescript
type OutputFormat = 'text' | 'json' | 'csv' | 'unknown';
```

### Job Output Options

```typescript
interface JobOutputOptions extends ParseOptions {
  /**
   * Whether to use cache
   */
  useCache?: boolean;

  /**
   * Whether to validate file hashes
   */
  validateHash?: boolean;

  /**
   * Custom cache config overrides
   */
  cacheConfig?: Partial<CacheConfig>;
}
```

### Parse Options

```typescript
interface ParseOptions {
  /**
   * Whether to trim whitespace from values
   */
  trim?: boolean;

  /**
   * Custom delimiter for CSV parsing
   */
  delimiter?: string;

  /**
   * Whether to parse numbers in JSON/CSV
   */
  parseNumbers?: boolean;

  /**
   * Whether to skip empty lines
   */
  skipEmpty?: boolean;
}
```

### Table Structure

The table structure used in the formatted output feature:

```typescript
interface Table {
  /**
   * Array of column names
   */
  columns: string[];
  
  /**
   * Array of row objects, where each object has properties matching column names
   */
  rows: Record<string, any>[];
}
```

## Formatted Output Feature

### Overview

The formatted output feature enhances job results by providing a clean, readable ASCII table representation of the data alongside the structured data.

### Output Structure

When a job produces tabular output, the result will include:

```javascript
{
  // Job details...
  parsedOutput: {
    tables: [
      {
        columns: ["column1", "column2", ...],
        rows: [
          { "column1": "value1", "column2": "value2", ... },
          // More rows...
        ]
      },
      // More tables...
    ],
    formattedOutput: "┌─────────┬─────────┐\n│ column1 │ column2 │\n├─────────┼─────────┤\n│ value1  │ value2  │\n└─────────┴─────────┘"
  }
}
```

### Usage

To access and display the formatted output:

```javascript
const results = await getDataprocJobResults({
  projectId: 'your-project',
  region: 'us-central1',
  jobId: 'job-id',
  format: 'text',
  wait: true
});

if (results.parsedOutput && results.parsedOutput.formattedOutput) {
  console.log('Formatted Table Output:');
  console.log(results.parsedOutput.formattedOutput);
}
```

### Multiple Tables

If the job produces multiple tables, they will be formatted separately with table numbers:

```
Table 1:
┌─────────┬─────────┐
│ column1 │ column2 │
├─────────┼─────────┤
│ value1  │ value2  │
└─────────┴─────────┘

Table 2:
┌─────────┬─────────┐
│ column3 │ column4 │
├─────────┼─────────┤
│ value3  │ value4  │
└─────────┴─────────┘
```

### Implementation Details

The formatted output is generated using the `table` library with specific configuration options for clean formatting:

- Border style: Uses the 'norc' border character set for a clean, minimal look
- Column padding: Adds 1 space of padding on both sides of column content
- Horizontal lines: Draws horizontal lines only at the top, after the header, and at the bottom

For more detailed implementation information, see the source code in `src/services/output-parser.ts`.

## Error Handling

The API includes comprehensive error handling for various scenarios:

- **GCS Access Errors**: When files cannot be accessed or downloaded
- **Parse Errors**: When content cannot be parsed in the expected format
- **Job Execution Errors**: When jobs fail or are cancelled
- **Timeout Errors**: When operations exceed specified timeouts

Each error type includes detailed information to help diagnose and resolve issues.

## Best Practices

### Working with Formatted Output

1. **Check for existence**: Always check if `formattedOutput` exists before using it
2. **Display as-is**: The formatted output is already optimized for console display
3. **Preserve original data**: Use the structured data in `tables` for programmatic processing
4. **Handle large outputs**: For very large tables, consider implementing pagination in your UI

### Performance Optimization

1. **Use caching**: Enable the cache for frequently accessed job results
2. **Specify format**: Explicitly specify the expected format when known
3. **Limit wait time**: Set appropriate timeouts for waiting operations
4. **Use async mode**: For long-running jobs, submit in async mode and check status separately
## Error Handling

### Common Error Responses

**Invalid Parameters:**
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Input validation failed: clusterName: Cluster name must start with lowercase letter"
  }
}
```

**Rate Limit Exceeded:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again after 2024-01-01T12:01:00.000Z"
  }
}
```

**Authentication Error:**
```json
{
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Service account authentication failed: Permission denied"
  }
}
```

### Best Practices

1. **Always check job status** for long-running operations
2. **Use async mode** for jobs that take more than a few minutes
3. **Implement retry logic** for transient failures
4. **Clean up resources** by deleting clusters when done
5. **Use appropriate cluster sizes** for your workload
6. **Monitor costs** by tracking cluster usage

## Rate Limits

- **Default**: 100 requests per minute
- **Configurable**: Adjust in server configuration
- **Per-tool**: Some tools may have specific limits
- **Burst**: Short bursts above limit may be allowed

## Security Considerations

- All inputs are validated and sanitized
- Credentials are never logged or exposed
- Audit logs track all operations
- Rate limiting prevents abuse
- GCP IAM controls actual permissions

This API reference provides comprehensive documentation for all tools with practical examples and usage patterns.