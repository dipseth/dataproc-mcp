# Authentication Timeout Debug Analysis

## Problem Summary
- ✅ `list_clusters`: Works (basic authentication functional)
- ❌ `submit_hive_query`: Times out with "MCP error -32001: Request timed out"
- ❌ `get_job_status`: Times out with "MCP error -32001: Request timed out"
- ❌ `get_query_status`: Times out with "MCP error -32001: Request timed out"

## Hypothesis Analysis

### 7 Possible Sources Identified:
1. **Authentication Token Acquisition Delays**: Token acquisition taking too long for job operations
2. **Client Library vs REST API Inconsistency**: Cluster ops use REST, job ops use Google Cloud client libraries
3. **Regional API Endpoint Configuration**: Different endpoints causing delays
4. **OAuth Scope Issues**: Job operations requiring different scopes
5. **Google Cloud Client Library Initialization**: JobControllerClient initialization overhead
6. **Network/DNS Resolution**: Job API endpoints having network issues
7. **MCP Server Event Loop Blocking**: Long auth calls blocking MCP server

### 2 Most Likely Sources:
1. **Client Library Authentication Overhead**: Job operations use `createJobClient()` with Google Cloud client libraries, while cluster operations use direct REST API calls
2. **Authentication Strategy Timing**: The `createAuth()` function's token testing might be slow for job operations

## Debug Enhancements Added

### 1. Enhanced Authentication Logging (`src/config/credentials.ts`)
- **`createAuth()`**: Added comprehensive timing logs for each authentication strategy
- **`createJobClient()`**: Added detailed timing breakdown (options, auth, client creation)
- **`getGcloudAccessToken()`**: Added timing logs for gcloud CLI execution
- **Environment logging**: Added configuration state logging

### 2. Enhanced Query Service Logging (`src/services/query.ts`)
- **`submitHiveQuery()`**: Added timing logs for API calls and error details
- **Error handling**: Enhanced error logging with timing and stack traces

### 3. Debug Test Scripts Created
- **`debug-auth-test.js`**: Standalone authentication test outside MCP context
- **`debug-mcp-comparison.js`**: Direct execution vs MCP comparison test

## Expected Log Output

When running the problematic operations, you should now see detailed timing logs like:

```
[TIMING] createAuth: Starting authentication process
[DEBUG] createAuth: Environment configuration: {...}
[TIMING] createAuth: Attempting key file authentication: /path/to/key.json
[TIMING] createAuth: GoogleAuth instance created in 15ms
[TIMING] createAuth: Testing token acquisition...
[TIMING] createAuth: Key file auth SUCCESS - token test: 1250ms, total: 1265ms
[TIMING] createJobClient: Starting job client creation
[TIMING] createJobClient: Client options configured in 2ms
[TIMING] createJobClient: Starting authentication...
[TIMING] createJobClient: Authentication completed in 1265ms
[TIMING] createJobClient: Creating JobControllerClient instance...
[TIMING] createJobClient: SUCCESS - auth: 1265ms, client creation: 45ms, total: 1312ms
[TIMING] submitHiveQuery: Starting MCP tool execution
[TIMING] submitHiveQuery: Config loaded in 5ms
[TIMING] submitHiveQuery: Job client created in 1312ms
[TIMING] submitHiveQuery: Starting submitJob API call...
```

## Test Execution Plan

### Phase 1: Standalone Testing
1. Run `node debug-auth-test.js` to test authentication outside MCP
2. Run `node debug-mcp-comparison.js` to test operations outside MCP
3. Compare timing results

### Phase 2: MCP Testing
1. Restart MCP server with debug logging enabled
2. Test `submit_hive_query` in MCP Inspector
3. Test `get_job_status` in MCP Inspector
4. Analyze timing logs to identify bottleneck

### Phase 3: Analysis
Based on the logs, we should be able to identify:
- **Where the timeout occurs**: Authentication, client creation, or API call
- **Timing differences**: Between cluster operations (working) vs job operations (failing)
- **Root cause**: Whether it's authentication overhead, client library issues, or network problems

## Next Steps After Testing

Once we identify the bottleneck from the logs, the likely solutions are:
1. **If authentication is slow**: Implement authentication caching or use REST API for job operations
2. **If client creation is slow**: Cache job clients or switch to REST API
3. **If API calls are slow**: Investigate network/endpoint issues or implement timeouts
4. **If MCP-specific**: Investigate MCP server timeout configuration

## Files Modified
- `src/config/credentials.ts`: Enhanced authentication logging
- `src/services/query.ts`: Enhanced query operation logging
- `debug-auth-test.js`: Standalone authentication test
- `debug-mcp-comparison.js`: MCP vs direct comparison test