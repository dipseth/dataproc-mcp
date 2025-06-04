# Manual Testing Guide: get_query_results in Dataproc Mode

This guide provides step-by-step instructions for manually testing the restored `get_query_results` functionality using the Dataproc mode in the MCP server.

## Prerequisites

### 1. Environment Setup
- Ensure you have a running MCP server with Dataproc mode enabled
- Valid GCP credentials configured
- Access to a GCP project with Dataproc clusters
- At least one completed Hive job with results

### 2. Required Information
- **Project ID**: Your GCP project ID
- **Region**: Dataproc region (e.g., `us-central1`)
- **Job ID**: A completed Hive job ID (e.g., `a15cc60e-da05-42d3-93f3-3252a11aa4c6`)

### 3. MCP Client Setup
- Claude Desktop, Cline, or another MCP-compatible client
- Dataproc MCP server configured and running

## Test Scenarios

### Test 1: Basic Functionality Verification

**Objective**: Verify that `get_query_results` no longer throws "not implemented" error.

**Steps**:
1. Switch to Dataproc mode in your MCP client
2. Use the `get_query_results` tool with these parameters:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1", 
     "jobId": "your-completed-job-id",
     "maxResults": 5
   }
   ```

**Expected Results**:
- ✅ Tool executes without "not implemented" error
- ✅ Returns structured data with schema and rows
- ✅ Response includes `totalRows` count
- ✅ Number of returned rows ≤ `maxResults`

**Troubleshooting**:
- If you get authentication errors, verify your GCP credentials
- If job not found, ensure the job ID is correct and the job is complete
- If permission denied, check that your service account has Dataproc access

---

### Test 2: Format Options Testing

**Objective**: Test different output format options.

#### Test 2a: Text Format (Default)
**Steps**:
1. Call `get_query_results` with default parameters
2. Examine the response structure

**Expected Results**:
- ✅ Returns text-based parsing of Hive output
- ✅ Schema fields are properly identified
- ✅ Rows contain string values

#### Test 2b: JSON Format
**Steps**:
1. Use the enhanced `get_query_results` with format specification:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id", 
     "maxResults": 5,
     "format": "json"
   }
   ```

**Expected Results**:
- ✅ Processes JSON-formatted output if available
- ✅ Maintains structured data format

#### Test 2c: CSV Format
**Steps**:
1. Use CSV format option:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 5,
     "format": "csv"
   }
   ```

**Expected Results**:
- ✅ Parses CSV-formatted output correctly
- ✅ Column headers become schema field names

---

### Test 3: GCS Authentication and File Access

**Objective**: Verify that GCS file downloading works with proper authentication.

**Steps**:
1. First, check the job status to see the driver output URI:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id"
   }
   ```
   Use `get_job_status` tool first.

2. Note the `driverOutputResourceUri` in the response

3. Call `get_query_results` and monitor for GCS-related log messages

**Expected Results**:
- ✅ Job status shows a valid `driverOutputResourceUri` (GCS path)
- ✅ `get_query_results` successfully downloads from GCS
- ✅ No authentication or permission errors
- ✅ File content is properly parsed

**Troubleshooting**:
- If GCS access fails, check service account permissions for the output bucket
- Verify that impersonation is configured correctly if using service account impersonation

---

### Test 4: Semantic Search Integration

**Objective**: Verify that results are indexed for semantic search (if Qdrant is available).

**Steps**:
1. Call `get_query_results` with semantic indexing enabled (default):
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 10
   }
   ```

2. After successful execution, try using the `query_knowledge` tool:
   ```json
   {
     "query": "recent query results",
     "type": "jobs"
   }
   ```

**Expected Results**:
- ✅ `get_query_results` completes successfully
- ✅ No errors related to semantic indexing (warnings are acceptable)
- ✅ `query_knowledge` may return information about the indexed job

**Note**: Semantic indexing failures are non-fatal and should not prevent the main operation from succeeding.

---

### Test 5: Error Handling

**Objective**: Verify proper error handling for various failure scenarios.

#### Test 5a: Invalid Job ID
**Steps**:
1. Use a non-existent job ID:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "invalid-job-id-12345",
     "maxResults": 5
   }
   ```

**Expected Results**:
- ✅ Returns clear error message about job not found
- ✅ Does not crash or hang

#### Test 5b: Incomplete Job
**Steps**:
1. If you have a running or pending job, use its ID:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1", 
     "jobId": "running-job-id",
     "maxResults": 5
   }
   ```

**Expected Results**:
- ✅ Returns error indicating job is not complete
- ✅ Shows current job state (e.g., "RUNNING", "PENDING")

#### Test 5c: Permission Errors
**Steps**:
1. Use a job ID from a project you don't have access to:
   ```json
   {
     "projectId": "non-accessible-project",
     "region": "us-central1",
     "jobId": "some-job-id",
     "maxResults": 5
   }
   ```

**Expected Results**:
- ✅ Returns permission-related error message
- ✅ Error is descriptive and actionable

---

### Test 6: Performance and Large Results

**Objective**: Test performance with different result set sizes.

#### Test 6a: Small Result Set
**Steps**:
1. Request a small number of results:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 1
   }
   ```

**Expected Results**:
- ✅ Fast response time (< 5 seconds)
- ✅ Exactly 1 row returned (or 0 if no results)

#### Test 6b: Large Result Set
**Steps**:
1. Request a larger number of results:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 100
   }
   ```

**Expected Results**:
- ✅ Reasonable response time (< 30 seconds)
- ✅ Number of returned rows ≤ 100
- ✅ `totalRows` indicates actual total available

#### Test 6c: Zero Results
**Steps**:
1. Request zero results:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 0
   }
   ```

**Expected Results**:
- ✅ Returns empty rows array
- ✅ Still provides schema information
- ✅ `totalRows` shows actual count

---

### Test 7: Comparison with get_job_results

**Objective**: Compare output with the existing `get_job_results` tool.

**Steps**:
1. First, get results using `get_job_results`:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 10
   }
   ```

2. Then get results using `get_query_results`:
   ```json
   {
     "projectId": "your-project-id",
     "region": "us-central1",
     "jobId": "your-completed-job-id",
     "maxResults": 10
   }
   ```

3. Compare the outputs

**Expected Results**:
- ✅ Both tools return data successfully
- ✅ `get_query_results` provides more structured output
- ✅ Schema information is clearer in `get_query_results`
- ✅ Row data is consistently formatted

---

### Test 8: Edge Cases

**Objective**: Test unusual but valid scenarios.

#### Test 8a: Job with No Output
**Steps**:
1. Use a job that completed successfully but produced no output (e.g., a DDL statement)

**Expected Results**:
- ✅ Returns successfully with empty rows
- ✅ Provides appropriate schema or indicates no schema
- ✅ `totalRows` is 0

#### Test 8b: Job with Large Output Files
**Steps**:
1. Use a job that produced very large output files
2. Request a reasonable number of results

**Expected Results**:
- ✅ Downloads and processes efficiently
- ✅ Respects `maxResults` limit
- ✅ Doesn't consume excessive memory

#### Test 8c: Job with Multiple Output Files
**Steps**:
1. Use a job that produced multiple output files (if available)

**Expected Results**:
- ✅ Handles multiple files correctly
- ✅ Concatenates or processes all files appropriately
- ✅ Returns unified result set

---

## Validation Checklist

After completing all tests, verify:

### ✅ Core Functionality
- [ ] `get_query_results` no longer throws "not implemented"
- [ ] Returns structured `QueryResultResponse` format
- [ ] Handles different output formats (text, JSON, CSV)
- [ ] Respects `maxResults` parameter

### ✅ GCS Integration
- [ ] Successfully authenticates with GCS
- [ ] Downloads job output files
- [ ] Handles single and multiple files
- [ ] Proper error handling for GCS issues

### ✅ Error Handling
- [ ] Invalid job IDs return clear errors
- [ ] Incomplete jobs are handled gracefully
- [ ] Permission errors are descriptive
- [ ] Network timeouts are handled

### ✅ Performance
- [ ] Reasonable response times for small requests (< 5s)
- [ ] Acceptable performance for large requests (< 30s)
- [ ] Memory usage is controlled
- [ ] Caching improves repeated requests

### ✅ Integration
- [ ] Works with existing authentication setup
- [ ] Compatible with current MCP tool interface
- [ ] Semantic search integration (if available)
- [ ] Consistent with other Dataproc tools

## Troubleshooting Guide

### Common Issues and Solutions

#### "Job not found" errors
- Verify the job ID is correct
- Ensure the job exists in the specified project and region
- Check that you have permission to access the job

#### GCS permission errors
- Verify service account has Storage Object Viewer role
- Check bucket-level permissions
- Ensure impersonation is configured correctly

#### Timeout errors
- Try with smaller `maxResults` values
- Check network connectivity
- Verify GCS bucket location and access

#### Authentication failures
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is set
- Check service account key file permissions
- Ensure gcloud CLI is authenticated if using application default credentials

#### Parsing errors
- Try different format options (text, json, csv)
- Check if the job actually produced output
- Verify the output format matches expectations

### Getting Help

If you encounter issues not covered in this guide:

1. Check the server logs for detailed error messages
2. Enable debug logging: `export LOG_LEVEL=debug`
3. Verify your configuration matches the examples
4. Test with the provided sample job ID first
5. Consult the main documentation in `docs/QUERY_RESULTS_ENHANCEMENT.md`

## Success Criteria

The testing is considered successful when:

1. **All core functionality tests pass** - Basic operations work without errors
2. **Error handling is robust** - Invalid inputs produce clear, actionable error messages
3. **Performance is acceptable** - Response times are reasonable for typical use cases
4. **Integration works smoothly** - Tool fits well with existing Dataproc workflow
5. **Documentation is accurate** - This guide accurately reflects the tool's behavior

## Next Steps

After successful manual testing:

1. Run the automated test suite: `npm run test:manual -- test-query-results-comprehensive.ts`
2. Test with your own job IDs and use cases
3. Integrate into your regular Dataproc workflows
4. Provide feedback on any issues or improvements needed