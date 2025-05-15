# DataprocOps Mode Usage Examples

This document provides examples of how to use the DataprocOps mode with memory integration for managing Dataproc clusters and jobs.

## Memory-Enhanced Cluster Management

### Storing Cluster Parameters

```typescript
// Example of storing cluster parameters in memory
const clusterParams = {
  projectId: "my-gcp-project",
  region: "us-central1",
  clusterName: "analytics-cluster",
  profile: "high-memory"
};

// Store in memory for future use
memory.create_entities([
  {
    type: "cluster_config",
    name: "analytics-cluster-config",
    properties: clusterParams
  }
]);
```

### Retrieving Stored Parameters

```typescript
// Retrieve stored cluster parameters
const storedConfig = memory.search_nodes({
  type: "cluster_config",
  name: "analytics-cluster-config"
});

// Use in cluster creation
const result = await use_mcp_tool({
  server_name: "dataproc-server1",
  tool_name: "create_cluster_from_profile",
  arguments: {
    projectId: storedConfig.properties.projectId,
    region: storedConfig.properties.region,
    profileId: storedConfig.properties.profile,
    clusterName: storedConfig.properties.clusterName
  }
});
```

## Memory-Enhanced Job Execution

### Storing Query Templates

```typescript
// Store query templates with parameters
memory.create_entities([
  {
    type: "query_template",
    name: "daily_analytics",
    properties: {
      queryType: "hive",
      baseQuery: "SELECT * FROM analytics.daily_metrics WHERE date = '{date}'",
      defaultParams: {
        date: "CURRENT_DATE"
      },
      description: "Daily analytics report query"
    }
  }
]);
```

### Using Query Templates

```typescript
// Retrieve query template
const queryTemplate = memory.search_nodes({
  type: "query_template",
  name: "daily_analytics"
});

// Apply parameters
const date = "2025-05-15";
const query = queryTemplate.properties.baseQuery.replace('{date}', date);

// Execute query
const result = await use_mcp_tool({
  server_name: "dataproc-server1",
  tool_name: "submit_hive_query",
  arguments: {
    projectId: "my-gcp-project",
    region: "us-central1",
    clusterName: "analytics-cluster",
    query: query
  }
});

// Store execution results
memory.add_observations({
  entity: "daily_analytics",
  observations: [
    {
      type: "execution_result",
      date: date,
      jobId: result.jobId,
      status: result.status,
      duration: result.duration
    }
  ]
});
```

## Performance Tracking

### Tracking Job Performance

```typescript
// After job completion, store performance metrics
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

// Create relationship between query and performance
memory.create_relations([
  {
    from: "daily_analytics",
    to: `job-${result.jobId}`,
    type: "executed_as"
  }
]);
```

### Analyzing Performance Patterns

```typescript
// Retrieve performance history for a query
const performanceHistory = memory.search_nodes({
  type: "job_performance",
  relations: [
    {
      from: "daily_analytics",
      type: "executed_as"
    }
  ]
});

// Calculate average execution time
const avgExecutionTime = performanceHistory.reduce((sum, perf) => 
  sum + perf.properties.executionTime, 0) / performanceHistory.length;

console.log(`Average execution time: ${avgExecutionTime} seconds`);
```

## Configuration Management

### Storing Successful Configurations

```typescript
// After successful job execution, store the configuration
memory.create_entities([
  {
    type: "successful_config",
    name: `config-${new Date().toISOString()}`,
    properties: {
      clusterConfig: {
        clusterName: "analytics-cluster",
        profile: "high-memory"
      },
      jobConfig: {
        queryType: "hive",
        parameters: {
          "hive.execution.engine": "tez",
          "hive.tez.container.size": "4096"
        }
      },
      performance: {
        executionTime: 45.2,
        dataProcessed: 1.2
      }
    }
  }
]);
```

### Applying Learned Optimizations

```typescript
// Retrieve best performing configurations
const bestConfigs = memory.search_nodes({
  type: "successful_config",
  sort: {
    field: "properties.performance.executionTime",
    order: "asc"
  },
  limit: 1
});

// Apply best configuration to new job
const optimizedJobConfig = {
  queryType: "hive",
  parameters: bestConfigs[0].properties.jobConfig.parameters
};

// Execute with optimized configuration
const result = await use_mcp_tool({
  server_name: "dataproc-server1",
  tool_name: "submit_hive_query",
  arguments: {
    projectId: "my-gcp-project",
    region: "us-central1",
    clusterName: "analytics-cluster",
    query: query,
    queryOptions: {
      properties: optimizedJobConfig.parameters
    }
  }
});
```

## Workflow Integration Example

```typescript
// Complete workflow example
async function runOptimizedAnalytics(date) {
  // 1. Get stored cluster configuration
  const clusterConfig = memory.search_nodes({
    type: "cluster_config",
    name: "analytics-cluster-config"
  });
  
  // 2. Check if cluster exists or create it
  let clusterStatus = await use_mcp_tool({
    server_name: "dataproc-server1",
    tool_name: "get_cluster",
    arguments: {
      projectId: clusterConfig.properties.projectId,
      region: clusterConfig.properties.region,
      clusterName: clusterConfig.properties.clusterName
    }
  });
  
  if (!clusterStatus || clusterStatus.status === "NOT_FOUND") {
    // Create cluster using stored profile
    await use_mcp_tool({
      server_name: "dataproc-server1",
      tool_name: "create_cluster_from_profile",
      arguments: {
        projectId: clusterConfig.properties.projectId,
        region: clusterConfig.properties.region,
        profileId: clusterConfig.properties.profile,
        clusterName: clusterConfig.properties.clusterName
      }
    });
  }
  
  // 3. Get query template and optimize
  const queryTemplate = memory.search_nodes({
    type: "query_template",
    name: "daily_analytics"
  });
  
  // 4. Get best configuration
  const bestConfig = memory.search_nodes({
    type: "successful_config",
    sort: {
      field: "properties.performance.executionTime",
      order: "asc"
    },
    limit: 1
  });
  
  // 5. Execute optimized query
  const query = queryTemplate.properties.baseQuery.replace('{date}', date);
  const result = await use_mcp_tool({
    server_name: "dataproc-server1",
    tool_name: "submit_hive_query",
    arguments: {
      projectId: clusterConfig.properties.projectId,
      region: clusterConfig.properties.region,
      clusterName: clusterConfig.properties.clusterName,
      query: query,
      queryOptions: {
        properties: bestConfig[0].properties.jobConfig.parameters
      }
    }
  });
  
  // 6. Store execution results
  memory.add_observations({
    entity: "daily_analytics",
    observations: [
      {
        type: "execution_result",
        date: date,
        jobId: result.jobId,
        status: result.status,
        duration: result.duration
      }
    ]
  });
  
  return result;
}