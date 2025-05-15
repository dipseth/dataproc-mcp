# DataprocOps Mode

A specialized mode for managing Google Cloud Dataproc operations with memory-enhanced capabilities.

## Overview

The DataprocOps mode is designed to streamline Dataproc cluster management and job execution by leveraging memory tools to store and retrieve common parameters, track performance metrics, and apply learned optimizations.

## Key Features

- **Memory-Enhanced Operations**: Store and retrieve cluster configurations, query templates, and job parameters
- **Performance Tracking**: Monitor and analyze job execution metrics
- **Configuration Management**: Maintain and optimize cluster and job configurations
- **Workflow Automation**: Streamline common Dataproc operations with memory-backed workflows

## Setup

The DataprocOps mode is configured in the `.roomodes` file in the workspace root directory:

```json
{
  "customModes": [
    {
      "slug": "dataproc-ops",
      "name": "🔧 DataprocOps",
      "roleDefinition": "You are Roo, a Dataproc operations specialist with memory-enhanced capabilities...",
      "whenToUse": "Use this mode when working with Google Cloud Dataproc operations...",
      "groups": [
        "read",
        ["edit", { "fileRegex": "\\.(yaml|json)$", "description": "YAML and JSON configuration files" }],
        "mcp",
        "command"
      ],
      "customInstructions": "WORKFLOW:..."
    }
  ]
}
```

## Usage

To use the DataprocOps mode:

1. Switch to the mode using the mode selector in Roo
2. Use memory tools to store and retrieve configurations
3. Execute Dataproc operations using the dataproc-server1 MCP tools
4. Track performance and optimize configurations

## Memory Integration

The DataprocOps mode uses memory tools to enhance Dataproc operations:

### Storing Configurations

```typescript
// Store cluster configuration
memory.create_entities([
  {
    type: "cluster_config",
    name: "analytics-cluster-config",
    properties: {
      projectId: "my-gcp-project",
      region: "us-central1",
      clusterName: "analytics-cluster",
      profile: "high-memory"
    }
  }
]);
```

### Retrieving Configurations

```typescript
// Retrieve stored configuration
const config = memory.search_nodes({
  type: "cluster_config",
  name: "analytics-cluster-config"
});

// Use in operations
const result = await use_mcp_tool({
  server_name: "dataproc-server1",
  tool_name: "create_cluster_from_profile",
  arguments: {
    projectId: config.properties.projectId,
    region: config.properties.region,
    profileId: config.properties.profile,
    clusterName: config.properties.clusterName
  }
});
```

## Dataproc Operations

The mode provides streamlined access to Dataproc operations:

### Cluster Management

- Create clusters using stored configurations
- Monitor cluster status
- Delete clusters when no longer needed

### Job Execution

- Submit Hive/Spark jobs with optimized configurations
- Monitor job status
- Retrieve and analyze job results

## Performance Optimization

The mode tracks job performance and applies learned optimizations:

```typescript
// Store job performance metrics
memory.create_entities([
  {
    type: "job_performance",
    name: `job-${result.jobId}`,
    properties: {
      jobId: result.jobId,
      queryType: "hive",
      executionTime: 45.2, // seconds
      dataProcessed: 1.2, // GB
      clusterName: "analytics-cluster",
      timestamp: new Date().toISOString()
    }
  }
]);

// Apply optimizations based on historical performance
const bestConfig = memory.search_nodes({
  type: "successful_config",
  sort: {
    field: "properties.performance.executionTime",
    order: "asc"
  },
  limit: 1
});
```

## Examples

See [dataproc-ops-example.md](../examples/dataproc-ops-example.md) for detailed usage examples.

## Related Issues

- [#1 Project Status Overview](https://github.com/dipseth/dataproc-mcp/issues/1)
- [#3 Nested Default Configuration](https://github.com/dipseth/dataproc-mcp/issues/3)
- [#5 New Mode: DataprocOps](https://github.com/dipseth/dataproc-mcp/issues/5)