# 📚 Auto-Generated API Documentation

This documentation is automatically generated from the Zod validation schemas.

## Available Tools

The Dataproc MCP Server provides 15 tools across 4 categories:

### Cluster Management

#### start_dataproc_cluster

Start a Google Cloud Dataproc cluster

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

#### create_cluster_from_yaml

Create a Dataproc cluster using a YAML configuration file

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

#### create_cluster_from_profile

Create a Dataproc cluster using a predefined profile

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

#### list_clusters

List Dataproc clusters in a project and region

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

#### get_cluster

Get details for a specific Dataproc cluster

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

#### delete_cluster

Delete a Dataproc cluster

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

### Job Execution

#### submit_hive_query

Submit a Hive query to a Dataproc cluster

**Example:**
```json
{
  "tool": "submit_hive_query",
  "arguments": {
    "projectId": "my-project-123",
    "region": "us-central1",
    "clusterName": "analytics-cluster",
    "query": "SELECT COUNT(*) FROM my_table WHERE date >= \"2024-01-01\"",
    "async": false
  }
}
```

#### submit_dataproc_job

Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.)

**Example:**
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
      "jarFileUris": [
        "gs://my-bucket/spark-app.jar"
      ]
    }
  }
}
```

#### get_job_status

Get the status of a Dataproc job by job ID

**Example:**
```json
{
  "tool": "get_job_status",
  "arguments": {
    "jobId": "job-12345-abcdef"
  }
}
```

#### get_query_results

Get the results of a completed Hive query

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

#### get_job_results

Get the results of a completed Dataproc job

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

### Profile Management

#### list_profiles

List available cluster configuration profiles

**Example:**
```json
{
  "tool": "list_profiles",
  "arguments": {
    "category": "production"
  }
}
```

#### get_profile

Get details for a specific cluster configuration profile

**Example:**
```json
{
  "tool": "get_profile",
  "arguments": {
    "profileId": "development/small"
  }
}
```

#### list_tracked_clusters

List clusters that were created and tracked by this MCP server

**Example:**
```json
{
  "tool": "list_tracked_clusters",
  "arguments": {
    "profileId": "production/high-memory/analysis"
  }
}
```

### Monitoring & Utilities

#### get_zeppelin_url

Get the Zeppelin notebook URL for a Dataproc cluster

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

