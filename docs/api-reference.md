---
layout: default
title: API Reference
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

Lists all Dataproc clusters in a project and region.

**Parameters:**
- `projectId` (string, optional): GCP project ID
- `region` (string, optional): Dataproc region
- `filter` (string, optional): Filter expression
- `pageSize` (number, optional): Number of results per page (1-100)
- `pageToken` (string, optional): Token for pagination

**Example:**
```json
{
  "tool": "list_clusters",
  "arguments": {
    "filter": "status.state=RUNNING",
    "pageSize": 10
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Clusters in project my-project-123, region us-central1:\n{\n  \"clusters\": [\n    {\n      \"clusterName\": \"my-cluster-1\",\n      \"status\": {\n        \"state\": \"RUNNING\"\n      }\n    }\n  ]\n}"
    }
  ]
}
```

### 5. get_cluster

Gets detailed information about a specific cluster.

**Parameters:**
- `projectId` (string, required): GCP project ID
- `region` (string, required): Dataproc region
- `clusterName` (string, required): Name of the cluster

**Example:**
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