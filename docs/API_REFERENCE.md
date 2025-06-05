---
layout: default
title: API Reference
description: Complete reference for all Dataproc MCP Server tools with practical examples and usage patterns
permalink: /API_REFERENCE/
---

# 📚 API Reference

Complete reference for all 16 Dataproc MCP Server tools with practical examples and usage patterns.

## Overview

The Dataproc MCP Server provides 16 comprehensive tools organized into four categories:
- **Cluster Management** (6 tools)
- **Job Execution** (5 tools)
- **Profile Management** (3 tools)
- **Monitoring & Utilities** (2 tools)

## Authentication

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

Submits a generic Dataproc job (Hive, Spark, PySpark, etc.).

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster
- `jobType` (string, required): Type of job (hive, spark, pyspark, presto, pig, hadoop)
- `jobConfig` (object, required): Job configuration object
- `async` (boolean, optional): Whether to submit asynchronously

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
      "jarFileUris": ["gs://my-bucket/spark-app.jar"],
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

**Example - PySpark Job:**
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

## Profile Management Tools

### 12. list_profiles

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

### 13. get_profile

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

### 14. list_tracked_clusters

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

### 15. get_zeppelin_url

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

### 16. check_active_jobs

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

## Common Usage Patterns

### 1. Complete Data Pipeline

```json
// 1. Create cluster
{
  "tool": "create_cluster_from_profile",
  "arguments": {
    "profileName": "production/high-memory/analysis",
    "clusterName": "pipeline-cluster-001"
  }
}

// 2. Submit data processing job
{
  "tool": "submit_hive_query",
  "arguments": {
    "clusterName": "pipeline-cluster-001",
    "query": "CREATE TABLE processed_data AS SELECT * FROM raw_data WHERE date >= '2024-01-01'"
  }
}

// 3. Check job status
{
  "tool": "get_job_status",
  "arguments": {
    "jobId": "returned-job-id"
  }
}

// 4. Get results
{
  "tool": "get_job_results",
  "arguments": {
    "jobId": "returned-job-id"
  }
}

// 5. Clean up
{
  "tool": "delete_cluster",
  "arguments": {
    "clusterName": "pipeline-cluster-001"
  }
}
```

### 2. Interactive Analysis

```json
// 1. Create development cluster
{
  "tool": "create_cluster_from_profile",
  "arguments": {
    "profileName": "development/small",
    "clusterName": "analysis-session"
  }
}

// 2. Get Zeppelin URL for notebooks
{
  "tool": "get_zeppelin_url",
  "arguments": {
    "clusterName": "analysis-session"
  }
}

// 3. Run exploratory queries
{
  "tool": "submit_hive_query",
  "arguments": {
    "clusterName": "analysis-session",
    "query": "SELECT COUNT(*) FROM my_table",
    "async": false
  }
}
```

### 3. Batch Processing

```json
// 1. List existing clusters
{
  "tool": "list_clusters",
  "arguments": {
    "filter": "status.state=RUNNING"
  }
}

// 2. Submit batch job to existing cluster
{
  "tool": "submit_dataproc_job",
  "arguments": {
    "clusterName": "existing-cluster",
    "jobType": "spark",
    "jobConfig": {
      "mainClass": "com.example.BatchProcessor",
      "jarFileUris": ["gs://my-bucket/batch-processor.jar"]
    },
    "async": true
  }
}

// 3. Monitor progress
{
  "tool": "get_job_status",
  "arguments": {
    "jobId": "batch-job-id"
  }
}
```
## 🚀 Response Optimization

The Dataproc MCP Server features intelligent response optimization that dramatically reduces token usage while maintaining full data accessibility through Qdrant storage.

### Performance Metrics

| Tool | Token Reduction | Before | After | Processing Time |
|------|----------------|--------|-------|----------------|
| `list_clusters` | **96.2%** | 7,651 | 292 | ~8ms |
| `get_cluster` | **64.0%** | 553 | 199 | ~12ms |
| `check_active_jobs` | **80.6%** | 1,626 | 316 | ~10ms |
| `get_job_status` | **75.3%** | 445 | 110 | ~9ms |

**Average Performance:**
- **Token Reduction**: 79.0% across all tools
- **Processing Time**: 9.95ms average
- **Memory Usage**: <1MB per operation
- **Storage Efficiency**: 99.9% compression ratio

### How It Works

1. **Intelligent Filtering**: Responses are automatically optimized to show only essential information
2. **Qdrant Storage**: Complete data is stored in vector database for later access
3. **Resource URIs**: Each response includes a `dataproc://` URI for full data retrieval
4. **Graceful Fallback**: If Qdrant is unavailable, full responses are returned
5. **Configurable Limits**: Token limits and optimization rules are customizable

### Verbose Parameter

All optimized tools support a `verbose` parameter:

```json
{
  "tool": "list_clusters",
  "arguments": {
    "verbose": false  // Default: optimized response
  }
}
```

```json
{
  "tool": "list_clusters", 
  "arguments": {
    "verbose": true   // Full response, no optimization
  }
}
```

### Accessing Stored Data

Full data is accessible via Qdrant resource URIs:

**Resource URI Format:**
```
dataproc://responses/{tool}/{operation}/{id}
```

**Examples:**
- `dataproc://responses/clusters/list/abc123` - Full cluster list data
- `dataproc://responses/clusters/get/def456` - Complete cluster configuration
- `dataproc://responses/jobs/active/ghi789` - Full job status details

**Accessing via MCP Resource:**
```json
{
  "method": "resources/read",
  "params": {
    "uri": "dataproc://responses/clusters/list/abc123"
  }
}
```

### Configuration

Response optimization can be configured via environment variables:

```bash
# Enable/disable optimization (default: true)
RESPONSE_OPTIMIZATION_ENABLED=true

# Token limits for optimization triggers
RESPONSE_TOKEN_LIMIT=500

# Qdrant connection settings
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=dataproc_responses

# Auto-startup Qdrant (default: true)
QDRANT_AUTO_START=true
```

### Benefits

1. **Reduced Token Costs**: 60-96% reduction in token usage
2. **Faster Responses**: Optimized responses are processed faster
3. **Better UX**: Concise, actionable information in responses
4. **Full Data Access**: Complete data always available via URIs
5. **Automatic Storage**: No manual data management required
6. **Semantic Search**: Stored data is searchable via vector similarity

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