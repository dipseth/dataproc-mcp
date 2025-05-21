# Dataproc Server API Documentation

## Overview

This document provides comprehensive documentation for the Dataproc MCP server API, with a focus on the job results handling and the new formatted output feature.

## Core Services

### Job Service

The Job Service provides functions for submitting and managing Dataproc jobs.

#### `submitDataprocJob(options)`

Submits a job to a Dataproc cluster.

**Parameters:**
- `options` (SubmitDataprocJobOptions): Configuration options for the job submission
  - `projectId` (string): GCP project ID
  - `region` (string): Dataproc region (e.g., us-central1)
  - `clusterName` (string): Name of the cluster to run the job on
  - `jobType` (DataprocJobType): Type of job (hive, spark, pyspark, presto, etc.)
  - `jobConfig` (object): Job configuration object (type-specific)
  - `async` (boolean, optional): Whether to submit asynchronously (default: false)

**Returns:**
- If async is true: `{ jobReference: { jobId: string }, operation: object }`
- If async is false: `{ jobId: string, status: string, details: object }`

**Example:**
```javascript
const result = await submitDataprocJob({
  projectId: 'your-project',
  region: 'us-central1',
  clusterName: 'your-cluster',
  jobType: 'hive',
  jobConfig: {
    queryList: {
      queries: ['SELECT * FROM your_table LIMIT 10;']
    }
  }
});
```

#### `getDataprocJobStatus(options)`

Gets the status of a Dataproc job.

**Parameters:**
- `options` (object): Options for getting job status
  - `projectId` (string): GCP project ID
  - `region` (string): Dataproc region
  - `jobId` (string): ID of the job to check

**Returns:**
- Job status object with details about the job's current state

**Example:**
```javascript
const status = await getDataprocJobStatus({
  projectId: 'your-project',
  region: 'us-central1',
  jobId: 'job-id'
});
```

#### `getDataprocJobResults(options)`

Gets the results of a Dataproc job, including formatted output.

**Parameters:**
- `options` (object): Options for getting job results
  - `projectId` (string): GCP project ID
  - `region` (string): Dataproc region
  - `jobId` (string): ID of the job to get results for
  - `format` (OutputFormat, optional): Expected output format (text, json, csv)
  - `wait` (boolean, optional): Whether to wait for job completion
  - `waitTimeout` (number, optional): Custom timeout for waiting (ms)
  - `useCache` (boolean, optional): Whether to use cache
  - `validateHash` (boolean, optional): Whether to validate file hashes
  - `trim` (boolean, optional): Whether to trim whitespace from values
  - `delimiter` (string, optional): Custom delimiter for CSV parsing
  - `parseNumbers` (boolean, optional): Whether to parse numbers in JSON/CSV
  - `skipEmpty` (boolean, optional): Whether to skip empty lines
  - `cacheConfig` (object, optional): Custom cache config overrides

**Returns:**
- Job results object containing:
  - Job details (status, reference, etc.)
  - `parsedOutput` (object): The parsed output data
    - `tables` (array): Array of table objects with columns and rows
    - `formattedOutput` (string): Formatted ASCII table representation of the data

**Example:**
```javascript
const results = await getDataprocJobResults({
  projectId: 'your-project',
  region: 'us-central1',
  jobId: 'job-id',
  format: 'text',
  wait: true
});

// Access the formatted output
if (results.parsedOutput && results.parsedOutput.formattedOutput) {
  console.log(results.parsedOutput.formattedOutput);
}
```

### Job Output Handler

The Job Output Handler manages the retrieval and parsing of job output files.

#### `getJobOutput(uri, format, options)`

Gets and parses job output from a GCS URI.

**Parameters:**
- `uri` (string): GCS URI of the output file
- `format` (OutputFormat, optional): Format of the output (text, json, csv)
- `options` (JobOutputOptions, optional): Options for output handling

**Returns:**
- Parsed output data, potentially including formatted output

#### `getJobOutputs(uris, format, options)`

Gets and combines multiple job outputs.

**Parameters:**
- `uris` (string[]): Array of GCS URIs
- `format` (OutputFormat, optional): Format of the outputs
- `options` (JobOutputOptions, optional): Options for output handling

**Returns:**
- Combined parsed output data, potentially including formatted output

### Output Parser

The Output Parser handles parsing of different output formats and formatting of table data.

#### `parse(content, format, options)`

Parses output content based on format.

**Parameters:**
- `content` (Buffer | string): Content to parse
- `format` (OutputFormat): Format of the content (text, json, csv)
- `options` (ParseOptions, optional): Options for parsing

**Returns:**
- Parsed data, potentially including formatted output for table data

#### `formatTablesOutput(tables)`

Formats tables data into a clean, readable ASCII table.

**Parameters:**
- `tables` (array): Array of table objects with columns and rows

**Returns:**
- Formatted string representation of the tables

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

For more detailed implementation information, see [Formatted Output Implementation](./formatted-output-implementation.md).

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