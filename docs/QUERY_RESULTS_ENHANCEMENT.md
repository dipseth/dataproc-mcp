# Query Results Enhancement Documentation

## Overview

The `get_query_results` functionality has been restored and significantly enhanced with async support and semantic search integration. This document outlines the improvements, new features, and usage patterns.

## Key Enhancements

### 1. Async GCS Log File Downloading
- **Restored Functionality**: The previously broken log file downloading has been fully restored
- **GCS Integration**: Uses the robust `GCSService` for reliable file operations
- **Error Handling**: Comprehensive error handling with retry logic and timeout support
- **Caching**: Intelligent caching to improve performance for repeated queries

### 2. Enhanced Parsing Capabilities
- **Multiple Formats**: Supports text, JSON, and CSV output formats
- **Hive Table Parsing**: Specialized parsing for Hive CLI output with table structures
- **Auto-Detection**: Automatic format detection based on content analysis
- **Structured Output**: Converts raw log files into structured `QueryResultResponse` format

### 3. Semantic Search Integration
- **Knowledge Indexing**: Automatically indexes query results for semantic search
- **Metadata Extraction**: Extracts meaningful information from query outputs
- **Searchable Content**: Enables natural language queries against historical results
- **Confidence Scoring**: Provides relevance scoring for search results

### 4. Improved API Interface
- **Enhanced Options**: New configuration options for display limits and format preferences
- **Backward Compatibility**: Maintains compatibility with existing MCP tool interface
- **Better Error Messages**: More descriptive error messages for troubleshooting

## API Reference

### `getQueryResultsWithRest()`

Enhanced function with full async support and semantic search integration.

```typescript
async function getQueryResultsWithRest(
  projectId: string,
  region: string,
  jobId: string,
  options?: {
    maxDisplayRows?: number;        // Default: 10
    format?: 'text' | 'json' | 'csv'; // Default: 'text'
    enableSemanticIndexing?: boolean;  // Default: true
  }
): Promise<QueryResultResponse>
```

**Parameters:**
- `projectId`: GCP project ID
- `region`: Dataproc region (e.g., 'us-central1')
- `jobId`: Job ID of completed Hive query
- `options.maxDisplayRows`: Maximum number of rows to return (default: 10)
- `options.format`: Output format preference (default: 'text')
- `options.enableSemanticIndexing`: Whether to index results for semantic search (default: true)

**Returns:**
```typescript
interface QueryResultResponse {
  schema?: {
    fields: { name: string; type: string; }[];
  };
  rows: unknown[][];
  totalRows: number;
  nextPageToken?: string;
}
```

### `getQueryResults()`

Wrapper function that maintains backward compatibility with the existing MCP interface.

```typescript
async function getQueryResults(
  projectId: string,
  region: string,
  jobId: string,
  maxResults?: number,
  pageToken?: string
): Promise<QueryResult>
```

## Usage Examples

### Basic Usage

```typescript
import { getQueryResultsWithRest } from './services/query.js';

// Get results with default settings
const results = await getQueryResultsWithRest(
  'my-project',
  'us-central1',
  'job-12345'
);

console.log(`Found ${results.totalRows} total rows`);
console.log(`Schema: ${results.schema?.fields?.map(f => f.name).join(', ')}`);
```

### Advanced Usage with Options

```typescript
// Get more rows with CSV format and semantic indexing
const results = await getQueryResultsWithRest(
  'my-project',
  'us-central1',
  'job-12345',
  {
    maxDisplayRows: 50,
    format: 'csv',
    enableSemanticIndexing: true
  }
);
```

### MCP Tool Usage

```bash
# Using the MCP tool
{
  "tool": "get_query_results",
  "arguments": {
    "projectId": "my-project",
    "region": "us-central1",
    "jobId": "job-12345",
    "maxResults": 20
  }
}
```

## Implementation Details

### GCS Integration Pattern

The implementation follows the same proven pattern used by `get_job_results`:

1. **Job Status Verification**: Ensures the job is complete before attempting to download results
2. **Driver Output URI Extraction**: Gets the GCS URI from the job status
3. **GCS Download**: Uses `GCSService` with retry logic and timeout handling
4. **Content Parsing**: Uses `OutputParser` for format-specific parsing
5. **Result Transformation**: Converts to standardized `QueryResultResponse` format

### Semantic Search Integration

When `enableSemanticIndexing` is true (default):

1. **Knowledge Indexing**: Results are indexed using `KnowledgeIndexer`
2. **Metadata Extraction**: Key information is extracted for searchability
3. **Vector Embeddings**: Content is converted to vector embeddings for similarity search
4. **Graceful Degradation**: Indexing failures don't affect the main operation

### Error Handling

Comprehensive error handling covers:

- **Job Status Errors**: Invalid job IDs, incomplete jobs
- **GCS Access Errors**: Permission issues, missing files
- **Parsing Errors**: Malformed output, unsupported formats
- **Network Errors**: Timeouts, connection failures

## Testing

### Manual Testing

A comprehensive test suite is available at `tests/manual/test-query-results.ts`:

```bash
# Set environment variables
export TEST_PROJECT_ID="your-project"
export TEST_REGION="us-central1"
export TEST_JOB_ID="your-completed-job-id"

# Run the test
npm run test:manual -- test-query-results.ts
```

### Test Coverage

The test suite verifies:
- ✅ Async GCS log file downloading
- ✅ Proper error handling
- ✅ Log file parsing capabilities
- ✅ Semantic search integration
- ✅ Integration with existing authentication

## Migration Guide

### From Previous Implementation

If you were using the previous (broken) implementation:

1. **No Code Changes Required**: The API remains the same
2. **Enhanced Functionality**: You now get working results plus semantic search
3. **Better Performance**: Caching and optimized parsing improve response times
4. **More Reliable**: Robust error handling and retry logic

### Configuration

No additional configuration is required. The enhancement uses existing:
- GCP authentication settings
- Dataproc cluster configurations
- Qdrant settings (for semantic search, optional)

## Performance Considerations

### Caching Strategy

- **File-Level Caching**: GCS downloads are cached based on file metadata
- **Size Limits**: Large files are not cached to preserve memory
- **TTL**: Cache entries have appropriate time-to-live settings

### Memory Usage

- **Streaming**: Large files are processed in chunks where possible
- **Limits**: `maxDisplayRows` parameter controls memory usage
- **Cleanup**: Resources are properly cleaned up after processing

### Network Optimization

- **Retry Logic**: Exponential backoff for failed downloads
- **Timeouts**: Configurable timeouts prevent hanging operations
- **Compression**: Supports compressed GCS files

## Troubleshooting

### Common Issues

1. **"Job is not complete"**
   - Ensure the job has finished running
   - Check job status using `get_job_status`

2. **"No driver output URI found"**
   - Some jobs may not produce driver output
   - Verify the job type supports output generation

3. **GCS Permission Errors**
   - Check service account permissions
   - Ensure access to the job's output bucket

4. **Parsing Failures**
   - Try different format options
   - Check the raw output for unexpected content

### Debug Mode

Enable debug logging for detailed operation traces:

```bash
export LOG_LEVEL=debug
```

## Future Enhancements

Planned improvements include:

1. **Pagination Support**: True pagination for large result sets
2. **Format Auto-Detection**: Improved automatic format detection
3. **Streaming Results**: Support for streaming large datasets
4. **Advanced Filtering**: Query-time filtering and aggregation
5. **Export Options**: Direct export to various formats (CSV, JSON, Parquet)

## Related Documentation

- [Semantic Search Guide](./KNOWLEDGE_BASE_SEMANTIC_SEARCH.md)
- [Authentication Guide](./AUTHENTICATION_IMPLEMENTATION_GUIDE.md)
- [Configuration Guide](./CONFIGURATION_GUIDE.md)
- [Authentication Guide](./AUTHENTICATION_IMPLEMENTATION_GUIDE.md)