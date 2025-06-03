# 🚀 Response Optimization Guide

This guide explains how the Dataproc MCP Server's response optimization system works, providing dramatic token reductions while maintaining full data accessibility.

## Overview

The response optimization system automatically reduces token usage by 60-96% while storing complete data in Qdrant for later access. This provides faster responses, lower costs, and better user experience without losing any information.

## How It Works

### 1. Intelligent Response Filtering

The system analyzes API responses and extracts only the most essential information:

```typescript
// Original response (7,651 tokens)
{
  "clusters": [
    {
      "clusterName": "analytics-cluster-prod",
      "status": { "state": "RUNNING", "stateStartTime": "2024-01-01T10:00:00Z" },
      "config": {
        "masterConfig": { "numInstances": 1, "machineTypeUri": "n1-standard-4" },
        "workerConfig": { "numInstances": 4, "machineTypeUri": "n1-standard-4" },
        // ... hundreds more lines of configuration
      }
    }
  ]
}

// Optimized response (292 tokens - 96.2% reduction)
"Found 3 clusters in my-project-123/us-central1:

• analytics-cluster-prod (RUNNING) - n1-standard-4, 5 nodes
• data-pipeline-dev (RUNNING) - n1-standard-2, 3 nodes  
• ml-training-cluster (CREATING) - n1-highmem-8, 10 nodes

💾 Full details stored: dataproc://responses/clusters/list/abc123
📊 Token reduction: 96.2% (7,651 → 292 tokens)"
```

### 2. Automatic Qdrant Storage

Complete data is automatically stored in Qdrant vector database:

```typescript
// Storage process
1. Response received from Google Cloud API
2. Full data stored in Qdrant with unique ID
3. Optimized summary generated
4. Resource URI provided for full data access
```

### 3. Resource URI Access

Access complete data anytime via resource URIs:

```bash
# Resource URI format
dataproc://responses/{tool}/{operation}/{unique-id}

# Examples
dataproc://responses/clusters/list/abc123
dataproc://responses/clusters/get/def456
dataproc://responses/jobs/active/ghi789
```

## Performance Results

### Token Reduction by Tool

| Tool | Before | After | Reduction | Example Use Case |
|------|--------|-------|-----------|------------------|
| `list_clusters` | 7,651 | 292 | **96.2%** | Quick cluster overview |
| `get_cluster` | 553 | 199 | **64.0%** | Cluster status check |
| `check_active_jobs` | 1,626 | 316 | **80.6%** | Job monitoring |
| `get_job_status` | 445 | 110 | **75.3%** | Job progress tracking |

### Processing Performance

- **Average Processing Time**: 9.95ms
- **Memory Usage**: <1MB per operation
- **Storage Efficiency**: 99.9% compression ratio
- **Qdrant Startup Time**: ~2 seconds (auto-managed)

## Configuration

### Environment Variables

```bash
# Core optimization settings
RESPONSE_OPTIMIZATION_ENABLED=true
RESPONSE_TOKEN_LIMIT=500

# Qdrant configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=dataproc_responses
QDRANT_AUTO_START=true

# Performance tuning
QDRANT_VECTOR_SIZE=384
QDRANT_DISTANCE_METRIC=Cosine
```

### Configuration File

Create `config/response-filter.json`:

```json
{
  "enabled": true,
  "tokenLimit": 500,
  "tools": {
    "list_clusters": {
      "enabled": true,
      "maxClusters": 10,
      "includeFields": ["name", "status", "machineType", "nodeCount"]
    },
    "get_cluster": {
      "enabled": true,
      "includeFields": ["name", "status", "config.masterConfig", "config.workerConfig"]
    },
    "check_active_jobs": {
      "enabled": true,
      "maxJobs": 20,
      "includeFields": ["jobId", "status", "clusterName", "startTime"]
    }
  },
  "qdrant": {
    "url": "http://localhost:6333",
    "collection": "dataproc_responses",
    "autoStart": true
  }
}
```

## Usage Examples

### Basic Usage (Optimized Responses)

```typescript
// Default behavior - optimized responses
const response = await mcpClient.callTool("list_clusters", {
  filter: "status.state=RUNNING"
});

// Response includes:
// - Concise cluster summary
// - Resource URI for full data
// - Token reduction metrics
```

### Verbose Mode (Full Responses)

```typescript
// Get full response when needed
const response = await mcpClient.callTool("list_clusters", {
  filter: "status.state=RUNNING",
  verbose: true  // Disable optimization
});

// Response includes:
// - Complete cluster configurations
// - All metadata and properties
// - No token reduction
```

### Accessing Stored Data

```typescript
// Access full data via resource URI
const fullData = await mcpClient.readResource(
  "dataproc://responses/clusters/list/abc123"
);

// Returns complete original response
console.log(fullData.clusters[0].config.masterConfig);
```

## Qdrant Setup and Management

### Automatic Setup (Recommended)

The server automatically manages Qdrant:

```bash
# Qdrant starts automatically when needed
npm start

# Check Qdrant status
curl http://localhost:6333/health
```

### Manual Setup

```bash
# Option 1: Docker (Recommended)
docker run -p 6333:6333 qdrant/qdrant

# Option 2: Binary installation
wget https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
./qdrant

# Option 3: Cloud deployment
# Use Qdrant Cloud or deploy to your cloud provider
```

### Collection Management

```bash
# Create collection manually (auto-created by default)
curl -X PUT http://localhost:6333/collections/dataproc_responses \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 384,
      "distance": "Cosine"
    }
  }'

# Check collection info
curl http://localhost:6333/collections/dataproc_responses
```

## Troubleshooting

### Common Issues

#### 1. Qdrant Connection Failed

**Symptoms:**
- Responses fall back to verbose mode
- Warning: "Qdrant storage unavailable"

**Solutions:**
```bash
# Check Qdrant status
curl http://localhost:6333/health

# Restart Qdrant
docker restart qdrant

# Check configuration
echo $QDRANT_URL
```

#### 2. High Memory Usage

**Symptoms:**
- Server memory usage increases over time
- Slow response times

**Solutions:**
```bash
# Reduce vector size
export QDRANT_VECTOR_SIZE=256

# Enable collection cleanup
export QDRANT_CLEANUP_ENABLED=true
export QDRANT_MAX_POINTS=10000
```

#### 3. Token Reduction Not Working

**Symptoms:**
- Responses are still verbose
- No resource URIs provided

**Solutions:**
```bash
# Check optimization is enabled
export RESPONSE_OPTIMIZATION_ENABLED=true

# Verify token limit
export RESPONSE_TOKEN_LIMIT=500

# Check tool-specific settings
cat config/response-filter.json
```

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=debug
export RESPONSE_OPTIMIZATION_DEBUG=true

# Start server with debug output
npm start
```

### Performance Monitoring

```bash
# Check optimization metrics
curl http://localhost:3000/metrics

# Monitor Qdrant performance
curl http://localhost:6333/metrics
```

## Best Practices

### 1. Token Limit Configuration

```typescript
// Conservative (high quality summaries)
RESPONSE_TOKEN_LIMIT=300

// Balanced (recommended)
RESPONSE_TOKEN_LIMIT=500

// Aggressive (maximum reduction)
RESPONSE_TOKEN_LIMIT=200
```

### 2. Qdrant Maintenance

```bash
# Regular cleanup (weekly)
curl -X POST http://localhost:6333/collections/dataproc_responses/points/delete \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "must": [
        {
          "range": {
            "timestamp": {
              "lt": "2024-01-01T00:00:00Z"
            }
          }
        }
      ]
    }
  }'

# Backup collection
curl http://localhost:6333/collections/dataproc_responses/snapshots
```

### 3. Production Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  dataproc-mcp:
    image: dataproc-mcp-server:latest
    environment:
      - RESPONSE_OPTIMIZATION_ENABLED=true
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - qdrant

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

## Advanced Features

### 1. Semantic Search

Search stored responses by content:

```typescript
// Search for clusters with specific configurations
const results = await qdrantClient.search("dataproc_responses", {
  vector: await embedText("high memory clusters"),
  limit: 10,
  filter: {
    must: [
      { key: "tool", match: { value: "list_clusters" } }
    ]
  }
});
```

### 2. Custom Optimization Rules

```json
{
  "customRules": {
    "list_clusters": {
      "priority": ["name", "status", "nodeCount"],
      "exclude": ["labels", "metadata"],
      "maxItems": 15
    },
    "get_cluster": {
      "priority": ["status", "config.masterConfig", "config.workerConfig"],
      "exclude": ["config.softwareConfig.properties"],
      "includeMetrics": true
    }
  }
}
```

### 3. Response Caching

```typescript
// Enable response caching
export RESPONSE_CACHE_ENABLED=true
export RESPONSE_CACHE_TTL=300  // 5 minutes

// Cache hit example
const response = await mcpClient.callTool("list_clusters", {});
// Subsequent calls return cached optimized response
```

## Migration Guide

### From Verbose to Optimized

1. **Enable optimization gradually:**
```bash
# Start with high token limit
export RESPONSE_TOKEN_LIMIT=1000

# Gradually reduce
export RESPONSE_TOKEN_LIMIT=500
export RESPONSE_TOKEN_LIMIT=300
```

2. **Test critical workflows:**
```bash
# Test with verbose mode first
npm run test:optimization:verbose

# Then test optimized mode
npm run test:optimization:default
```

3. **Monitor performance:**
```bash
# Track token usage
npm run benchmark:tokens

# Monitor response times
npm run benchmark:performance
```

## Support

### Getting Help

- **GitHub Issues**: [Report optimization issues](https://github.com/dipseth/dataproc-mcp/issues)
- **Documentation**: [Complete optimization docs](https://dipseth.github.io/dataproc-mcp/optimization/)
- **Performance**: [Benchmark results](https://dipseth.github.io/dataproc-mcp/benchmarks/)

### Contributing

Help improve response optimization:

1. **Performance Testing**: Run benchmarks and report results
2. **Optimization Rules**: Suggest better filtering strategies
3. **Qdrant Integration**: Improve storage and retrieval
4. **Documentation**: Enhance guides and examples

---

**🚀 Achieve 60-96% token reduction while maintaining full data access!**