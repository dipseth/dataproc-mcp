# Dataproc MCP Server

This MCP server provides tools for interacting with Google Cloud Dataproc clusters and jobs.

## Quick Start

1. **Add to your global MCP settings** (recommended approach):
   ```json
   {
     "dataproc-server1": {
       "command": "node",
       "args": ["/path/to/dataproc-server/build/index.js"],
       "disabled": false,
       "timeout": 60,
       "alwaysAllow": ["*"]
     }
   }
   ```

2. **Test with MCP Inspector** (optional):
   ```bash
   npx @modelcontextprotocol/inspector build/index.js
   ```

For detailed configuration options, see the [Configuration Guide](docs/CONFIGURATION_GUIDE.md).

## Available Tools

The server provides the following tools:

- `start_dataproc_cluster`: Start a Google Cloud Dataproc cluster
- `create_cluster_from_yaml`: Create a Dataproc cluster using a YAML configuration file
- `create_cluster_from_profile`: Create a Dataproc cluster using a predefined profile
- `list_clusters`: List Dataproc clusters in a project and region
- `list_tracked_clusters`: List clusters that were created and tracked by this MCP server
- `list_profiles`: List available cluster configuration profiles
- `get_profile`: Get details for a specific cluster configuration profile
- `get_cluster`: Get details for a specific Dataproc cluster
- `submit_hive_query`: Submit a Hive query to a Dataproc cluster
- `get_query_status`: Get the status of a Hive query job
- `get_query_results`: Get the results of a completed Hive query
- `delete_cluster`: Delete a Dataproc cluster
- `submit_dataproc_job`: Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.)
- `get_job_status`: Get the status of a Dataproc job
- `get_job_results`: Get the results of a completed Dataproc job
- `get_zeppelin_url`: Get the Zeppelin notebook URL for a Dataproc cluster

## Testing

The project includes comprehensive testing infrastructure organized in the `tests/` directory:

- **`tests/unit/`** - Unit tests using Mocha and Chai
- **`tests/integration/`** - Integration tests with real MCP server instances
- **`tests/manual/`** - Manual test scripts and utilities
- **`tests/debug/`** - Debug scripts used during development
- **`tests/data/`** - Test data files (CSV outputs, etc.)

To run tests:

```bash
# Run all tests
node tests/run-tests.js all

# Run specific test types
node tests/run-tests.js unit
node tests/run-tests.js integration
node tests/run-tests.js manual
```

See [`tests/README-mcp-resources.md`](tests/README-mcp-resources.md) for detailed testing documentation.

## Authentication

The server uses Google Cloud authentication. You can configure the authentication method in the `config/server.json` file:

```json
{
  "authentication": {
    "impersonateServiceAccount": "your-service-account@your-project.iam.gserviceaccount.com"
  }
}
```

### Service Account Configuration

When using cluster profiles, ensure that the service account is properly specified in your profile YAML files:

```yaml
cluster_config:
  gce_cluster_config:
    service_account: your-service-account@your-project.iam.gserviceaccount.com
```

The server will use this service account for cluster creation instead of the default compute service account.

## Recent Fixes

### Service Account Configuration (2025-05-29)

Fixed an issue where custom service accounts specified in cluster profiles were not being passed to the Dataproc API. The problem was in the `createCluster` function which was only copying specific configuration sections (`masterConfig`, `workerConfig`, etc.) but missing the `gceClusterConfig` section that contains the service account configuration.

**Fix**: Added `gceClusterConfig` to the list of configuration sections copied from profiles to the API request, ensuring custom service accounts are properly used during cluster creation.

## Troubleshooting: Excessive Logs and JSON Parse Errors

If you see errors like:

```
Error from MCP server: SyntaxError: Unexpected token 'D', "[DEBUG] ..." is not valid JSON
```

**Cause:**
The MCP server or SDK is writing debug/info logs to stdout, which is reserved for JSON protocol messages. This causes the SDK to attempt to parse log lines as JSON, resulting in parse errors and noisy output.

**How to Fix:**

1. **Redirect logs to stderr or a file:**
   - Update your logging configuration so that all debug/info logs are sent to `stderr` or a log file, not `stdout`.
   - In Node.js, use `console.error()` for logs, or configure your logger (e.g., `winston`, `pino`) to use `stderr` for non-protocol output.

2. **Set log level to error/warn for tests:**
   - Temporarily set the log level to "error" or "warn" in your test/dev environment to reduce noise.
   - Example (if using an environment variable):
     ```
     export LOG_LEVEL=error
     npm run test:integration
     ```

3. **Check MCP server entrypoint:**
   - Ensure that only protocol JSON messages are written to `stdout` if using stdio for MCP communication.
   - All other logs should go to `stderr`.

4. **Optional: Patch SDK for local dev:**
   - If you cannot change the server, patch the SDK or test runner to ignore non-JSON lines or filter out debug logs.

**Summary:**
- Only protocol messages should go to stdout.
- All logs should go to stderr or a file.
- Lower log level for tests to reduce output.

This will resolve the JSON parse errors and make your test output much cleaner.
