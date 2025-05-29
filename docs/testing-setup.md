# Simultaneous Testing Setup Guide

## Current Setup: Stdio Mode

Since HTTP mode implementation requires more complex SSE transport setup, we're using stdio mode with a practical workaround for simultaneous testing.

## Testing Approach

### Option 1: Sequential Testing (Recommended)
Test one client at a time to avoid conflicts:

1. **Test with MCP Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector build/index.js
   ```

2. **Test with VS Code/Roo:**
   - Ensure `.roo/mcp.json` is configured (already done)
   - Restart VS Code/Roo to pick up the configuration
   - Test tools through the interface

### Option 2: Multiple Server Instances
Run separate server instances for each client:

1. **For MCP Inspector:**
   ```bash
   # Terminal 1
   npx @modelcontextprotocol/inspector build/index.js
   ```

2. **For VS Code/Roo:**
   ```bash
   # Terminal 2 - VS Code will spawn its own instance via .roo/mcp.json
   # No manual command needed, just restart VS Code
   ```

## Current Configuration

### VS Code/Roo Configuration (`.roo/mcp.json`)
```json
{
  "dataproc-server": {
    "command": "node",
    "args": ["build/index.js"],
    "disabled": false,
    "timeout": 60,
    "alwaysAllow": [
      "start_dataproc_cluster",
      "create_cluster_from_yaml", 
      "create_cluster_from_profile",
      "list_clusters",
      "list_tracked_clusters",
      "list_profiles",
      "get_profile",
      "get_cluster",
      "submit_hive_query",
      "get_query_status",
      "get_query_results",
      "submit_dataproc_job",
      "get_job_status",
      "get_job_results",
      "get_zeppelin_url",
      "delete_cluster"
    ]
  }
}
```

## Testing Workflow

1. **Build the server:**
   ```bash
   npm run build
   ```

2. **Test with MCP Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector build/index.js
   ```
   - Verify all tools are available
   - Test basic functionality
   - Check authentication works

3. **Test with VS Code/Roo:**
   - Restart VS Code to pick up the new configuration
   - Try using dataproc tools through the interface
   - Verify the same functionality works

## Future HTTP Mode Implementation

When HTTP mode is needed, the implementation would require:

1. **Express server setup** with proper SSE transport
2. **Separate endpoints** for `/sse` and `/messages`
3. **Session management** for multiple concurrent connections
4. **CORS configuration** for browser clients

For now, the stdio approach provides reliable testing capability with the comprehensive API fixes already implemented.

## Verification Steps

1. **Server builds successfully** ✅
2. **MCP Inspector can connect** (test this)
3. **VS Code/Roo can connect** (test this)
4. **All tools are available** (verify in both clients)
5. **Authentication works** (test with actual GCP calls)

## Notes

- The server includes command-line argument parsing for future HTTP mode
- All API fixes and improvements are preserved
- Both clients will use the same server code with identical functionality
- No functionality is lost by using stdio mode instead of HTTP mode