# Async Query Tracking Implementation

## Overview

This document describes the implementation of async query tracking functionality for the Dataproc MCP Server. The feature enables automatic monitoring and status updates for long-running Dataproc queries without requiring manual polling.

## Architecture

### Core Components

1. **AsyncQueryPoller** (`src/services/async-query-poller.ts`)
   - Manages automatic polling of query status
   - Integrates with JobTracker for persistent storage
   - Provides event-driven updates
   - Handles graceful shutdown and error recovery

2. **Enhanced JobTracker** (`src/services/job-tracker.ts`)
   - Extended with auto-update capabilities
   - Maintains job state and metrics
   - Supports cleanup and lifecycle management

3. **MCP Resource Integration** (`src/index.ts`)
   - New `dataproc://query/` resource URIs
   - Enhanced resource listing and reading
   - Automatic registration for async queries

## Key Features

### 1. Automatic Query Registration
When users submit queries with `async=true`:
```typescript
// Hive queries
asyncQueryPoller.registerQuery({
  jobId: response.jobUuid,
  projectId: String(projectId),
  region: String(region),
  toolName: 'submit_hive_query',
  submissionTime: new Date().toISOString()
});

// Dataproc jobs
asyncQueryPoller.registerQuery({
  jobId: response.jobUuid,
  projectId: String(projectId),
  region: String(region),
  toolName: 'submit_dataproc_job',
  submissionTime: new Date().toISOString()
});
```

### 2. Enhanced Resource URIs
New resource pattern for trackable queries:
```
dataproc://query/{projectId}/{region}/{jobId}
```

Example:
```
dataproc://query/my-project/us-central1/job-12345
```

### 3. Real-time Status Updates
The AsyncQueryPoller automatically:
- Polls job status at configurable intervals (default: 30 seconds)
- Updates JobTracker with latest status
- Handles concurrent polling with limits
- Provides comprehensive error handling and retries

### 4. Resource Content Enhancement
Query resources provide enriched information:
```json
{
  "jobId": "job-12345",
  "projectId": "my-project",
  "region": "us-central1",
  "status": {
    "state": "RUNNING",
    "details": "..."
  },
  "queryInfo": {
    "toolName": "submit_hive_query",
    "submissionTime": "2025-01-01T12:00:00Z",
    "status": "RUNNING"
  },
  "isAutoUpdating": true,
  "pollerStats": {
    "isPolling": true,
    "activeQueries": 3,
    "totalPolls": 156,
    "uptime": 3600000
  },
  "lastUpdated": "2025-01-01T12:30:00Z"
}
```

## Configuration

### AsyncQueryPoller Configuration
```typescript
interface AsyncQueryPollerConfig {
  intervalMs?: number;           // Polling interval (default: 30000)
  maxRetries?: number;          // Max retries per query (default: 3)
  retryDelayMs?: number;        // Delay between retries (default: 5000)
  enableCleanup?: boolean;      // Auto-cleanup completed queries (default: true)
  cleanupIntervalMs?: number;   // Cleanup interval (default: 300000)
  maxConcurrentPolls?: number;  // Max concurrent polls (default: 10)
}
```

### JobTracker Configuration
```typescript
interface EnhancedJobTrackerConfig {
  maxTrackedJobs?: number;      // Max jobs to track (default: 1000)
  autoCleanupInterval?: number; // Cleanup interval (default: 300000)
  enableMetrics?: boolean;      // Enable metrics collection (default: true)
}
```

## Usage Examples

### 1. Submit Async Hive Query
```bash
# Submit query with async tracking
curl -X POST http://localhost:3000/submit_hive_query \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "region": "us-central1", 
    "clusterName": "my-cluster",
    "query": "SELECT * FROM my_table LIMIT 1000",
    "async": true
  }'
```

### 2. Monitor Query Progress
```bash
# Access query resource for real-time updates
curl http://localhost:3000/resources/dataproc://query/my-project/us-central1/job-12345
```

### 3. List All Tracked Queries
```bash
# List all resources to see tracked queries
curl http://localhost:3000/resources
```

## Implementation Details

### Startup Sequence
1. JobTracker initialized with enhanced configuration
2. AsyncQueryPoller created with JobTracker dependency
3. Server connects to transport
4. AsyncQueryPoller starts polling automatically
5. Graceful shutdown handlers registered

### Query Lifecycle
1. User submits async query
2. Query submitted to Dataproc
3. Job ID returned and registered with AsyncQueryPoller
4. Auto-update enabled in JobTracker
5. Periodic status polling begins
6. Resource URI becomes available for monitoring
7. Query completes and auto-cleanup occurs

### Error Handling
- Retry logic with exponential backoff
- Graceful degradation on API failures
- Comprehensive logging and metrics
- Automatic cleanup of failed queries

## Testing

### Manual Testing
```bash
# Run comprehensive test suite
cd tests/manual
node --loader ts-node/esm test-async-query-tracking.ts
```

### Integration Testing
```bash
# Test with real Dataproc cluster
npm run test:integration
```

## Performance Considerations

### Polling Optimization
- Configurable polling intervals
- Concurrent polling limits
- Batch status updates
- Intelligent cleanup scheduling

### Memory Management
- Automatic cleanup of completed queries
- Configurable job retention limits
- Efficient data structures
- Graceful shutdown procedures

## Monitoring and Observability

### Metrics Available
- Active query count
- Polling statistics
- Error rates and retry counts
- Uptime and performance metrics

### Logging
- Structured logging with context
- Debug mode for detailed tracing
- Error tracking and alerting
- Performance monitoring

## Future Enhancements

### Planned Features
1. **WebSocket Support**: Real-time push notifications
2. **Query Prioritization**: Priority-based polling
3. **Advanced Filtering**: Query filtering and search
4. **Batch Operations**: Bulk query management
5. **Custom Webhooks**: External notification support

### Scalability Improvements
1. **Distributed Polling**: Multi-instance coordination
2. **Database Backend**: Persistent storage options
3. **Caching Layer**: Redis integration
4. **Load Balancing**: Query distribution

## Security Considerations

### Access Control
- Resource-level permissions
- Project-based isolation
- Audit logging
- Rate limiting

### Data Protection
- Secure credential handling
- Encrypted communications
- PII data filtering
- Compliance monitoring

## Troubleshooting

### Common Issues
1. **Polling Not Starting**: Check AsyncQueryPoller initialization
2. **Resource Not Found**: Verify job registration
3. **Status Not Updating**: Check polling configuration
4. **Memory Leaks**: Monitor cleanup intervals

### Debug Commands
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check poller status
curl http://localhost:3000/resources/dataproc://status

# Monitor job tracker
curl http://localhost:3000/resources/dataproc://jobs
```

## Conclusion

The async query tracking implementation provides a robust, scalable solution for monitoring long-running Dataproc queries. It integrates seamlessly with the existing MCP server architecture while providing enhanced user experience through automatic status updates and comprehensive monitoring capabilities.