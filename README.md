# Dataproc MCP Server

A Model Context Protocol (MCP) server for Google Cloud Dataproc operations with cluster profile management and tracking capabilities.

## Features

- Create Dataproc clusters using JSON or YAML configurations
- Create clusters from predefined profiles
- List and manage cluster configuration profiles
- Track clusters created via the MCP server
- Submit Hive queries to Dataproc clusters
- Get query status and results

## Repository Organization

The repository is organized into three main areas:

### 1. Server Settings
Server configuration files in the `config/` directory control how the MCP server operates, including:
- Profile scanning intervals
- State persistence settings
- Server startup parameters

### 2. User Profiles
Cluster configuration profiles in the `profiles/` directory define different types of Dataproc clusters:
- Development clusters (smaller, cost-effective)
- Production clusters (optimized for specific workloads)
- Testing clusters (for integration and validation)

### 3. Documentation
Documentation in the `docs/` directory provides:
- System design information
- API documentation
- Example configurations and queries
- Usage guides

For a detailed plan on repository organization and cleanup, see [REPO_CLEANUP_PLAN.md](./REPO_CLEANUP_PLAN.md).

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dataproc-server.git
cd dataproc-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Server Configuration

The server configuration is stored in `./config/server.json` and includes settings for the profile manager and cluster tracker:

```json
{
  "profileManager": {
    "rootConfigPath": "./profiles",
    "profileScanInterval": 300000
  },
  "clusterTracker": {
    "stateFilePath": "./state/dataproc-state.json",
    "stateSaveInterval": 60000
  }
}
```

- `profileManager.rootConfigPath`: Directory where cluster configuration profiles (YAML files) are stored
- `profileManager.profileScanInterval`: How often to scan for profile changes (milliseconds)
- `clusterTracker.stateFilePath`: Location of the state persistence file
- `clusterTracker.stateSaveInterval`: How often to save state to disk (milliseconds)

> **Note:** During the transition period, the server also supports the legacy configuration path `./config/dataproc-server.json`. See [REPO_CLEANUP_PLAN.md](./REPO_CLEANUP_PLAN.md) for details on the transition plan.

### Repository Structure

The repository is organized with a clear separation between server settings, user profiles, and documentation:

```
/dataproc-server/
├── config/                     # Server configuration
│   ├── server.json             # Main server configuration
│   └── credentials/            # Credentials and secrets (gitignored)
│
├── profiles/                   # Cluster configuration profiles
│   ├── development/            # Development environment profiles
│   │   ├── small.yaml          # Small development cluster
│   │   └── standard.yaml       # Standard development cluster
│   ├── production/             # Production environment profiles
│   │   ├── high-memory/        # Specialized production profiles
│   │   │   └── analysis.yaml   # High-memory analysis cluster
│   │   └── high-cpu/
│   │       └── processing.yaml # High-CPU processing cluster
│   └── testing/                # Testing environment profiles
│       └── integration.yaml    # Integration testing cluster
│
├── docs/                       # Documentation
│   ├── design.md               # System design documentation
│   └── examples/               # Example documentation
│       ├── queries/            # Example queries
│       └── configs/            # Example configurations
│
├── src/                        # Source code
├── state/                      # State storage (gitignored)
└── tests/                      # Test files
```

For a detailed plan on repository organization and cleanup, see [REPO_CLEANUP_PLAN.md](./REPO_CLEANUP_PLAN.md).

### Cluster Profiles

Cluster profiles are YAML files that define Dataproc cluster configurations. They are organized in the `profiles/` directory by environment type:

Each profile YAML file should follow this format:

```yaml
cluster:
  name: my-cluster-name
  region: us-central1  # Optional, can be overridden at runtime
  config:
    masterConfig:
      numInstances: 1
      machineTypeUri: n1-standard-2
    workerConfig:
      numInstances: 2
      machineTypeUri: n1-standard-2
    # Other Dataproc cluster configuration options
```

## Running the Server

```bash
# Run the server
node build/index.js
```

## Best Practices for Loading and Starting the MCP Server

### Using the MCP Inspector

The MCP Inspector provides a dashboard for visualizing and debugging your MCP server. To use the Inspector with your Dataproc MCP server:

1. **Stop any running MCP server or Inspector process** (to avoid port conflicts):
   ```bash
   pkill -f "node build/index.js"
   pkill -f "@modelcontextprotocol/inspector"
   ```

2. **Start the Inspector and MCP server together** (Inspector will launch and connect to the server automatically):
   ```bash
   npx @modelcontextprotocol/inspector build/index.js
   ```
   - If you see a port conflict (e.g., "Proxy Server PORT IS IN USE at port 6277"), either stop the existing process or start the Inspector on a different port:
     ```bash
     npx @modelcontextprotocol/inspector build/index.js --port 6280
     ```
   - Then open the Inspector dashboard at [http://127.0.0.1:6274](http://127.0.0.1:6274) (or the new port).

3. **Inspector Features**
   - View connected MCP servers, available tools, and recent requests/responses.
   - Send tool calls (like `list_profiles`) and see live responses.
   - Debug and track the server's state visually.


The MCP Dataproc server supports flexible configuration and startup options. You can control how the server loads its configuration and profiles using environment variables, command-line arguments, or config files.

### Recommended Startup Approaches

1. **Environment Variables**
   Set environment variables to control config and credentials:
   ```bash
   export DATAPROC_CONFIG_PATH=./config/server.json
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account.json
   node build/index.js
   ```

2. **Command-Line Arguments**
   Pass config file or profile directory as arguments:
   ```bash
   node build/index.js --config=./config/server.json --profiles=./profiles
   ```

3. **MCP Tool/VS Code Integration**
   In your MCP settings or VS Code task, you can specify args and env:
   ```json
   {
     "dataproc-server1": {
       "command": "node",
       "args": [
         "${workspaceFolder}/build/index.js",
         "--config=${workspaceFolder}/config/server.json",
         "--profiles=${workspaceFolder}/profiles"
       ],
       "env": {
         "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your-service-account.json"
       },
       "disabled": false,
       "timeout": 60,
       "alwaysAllow": [
         "start_dataproc_cluster",
         "create_cluster_from_yaml",
         "list_clusters",
         "get_cluster",
         "submit_hive_query",
         "get_query_status",
         "get_query_results",
         "delete_cluster"
       ]
     }
   }
   ```

4. **VS Code Task Automation**
   Use `.vscode/tasks.json` to auto-start the server on folder open (see below).

### Configuration Layering

The server loads configuration in the following order of precedence (highest to lowest):
1. Command-line arguments
2. Environment variables
3. Config file (`config/server.json`)
4. Defaults

### Best Practices

- Use environment variables for sensitive information (credentials).
- Store cluster profiles in version-controlled YAML files, but mask or exclude sensitive production data before publishing.
- Use separate config directories for different environments.
- Enable only required tools in `alwaysAllow`.
- Set appropriate timeout values based on operation types.
- Use service account impersonation for additional security if needed.
- Maintain separate configuration files for development and production.

## Using with VS Code / Roo

To use this MCP server with VS Code and Roo, add the following configuration to your MCP settings file:

```json
{
  "dataproc-server": {
    "command": "node",
    "args": [
      "/path/to/dataproc-server/build/index.js"
    ],
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
      "get_query_results"
    ]
  }
}
```

### Auto-starting the Server

To have the server start automatically when VS Code launches, you can create a VS Code task:

1. Create a `.vscode/tasks.json` file in your project:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Start Dataproc MCP Server",
      "type": "shell",
      "command": "node",
      "args": [
        "${workspaceFolder}/build/index.js"
      ],
      "isBackground": true,
      "problemMatcher": [],
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

2. Configure VS Code to run this task automatically when the folder is opened.

## Available MCP Tools

### Cluster Management

#### `start_dataproc_cluster`

Start a Google Cloud Dataproc cluster.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "clusterName": "my-cluster",
  "clusterConfig": {
    "masterConfig": {
      "numInstances": 1,
      "machineTypeUri": "n1-standard-2"
    },
    "workerConfig": {
      "numInstances": 2,
      "machineTypeUri": "n1-standard-2"
    }
  }
}
```

#### `create_cluster_from_yaml`

Create a Dataproc cluster using a YAML configuration file.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "yamlPath": "./profiles/development/small.yaml",
  "overrides": {
    "masterConfig": {
      "machineTypeUri": "n1-standard-4"
    }
  }
}
```

#### `create_cluster_from_profile`

Create a Dataproc cluster using a predefined profile.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "profileId": "development/small",
  "clusterName": "my-custom-name",
  "overrides": {
    "masterConfig": {
      "machineTypeUri": "n1-standard-4"
    }
  }
}
```

#### `list_clusters`

List Dataproc clusters in a project and region.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "filter": "status.state = RUNNING",
  "pageSize": 10
}
```

#### `get_cluster`

Get details for a specific Dataproc cluster.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "clusterName": "my-cluster"
}
```

### Profile Management

#### `list_profiles`

List available cluster configuration profiles.

```json
{
  "category": "development"
}
```

#### `get_profile`

Get details for a specific cluster configuration profile.

```json
{
  "profileId": "development/small"
}
```

#### `list_tracked_clusters`

List clusters that were created and tracked by this MCP server.

```json
{
  "profileId": "development/small"
}
```

### Query Management

#### `submit_hive_query`

Submit a Hive query to a Dataproc cluster.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "clusterName": "my-cluster",
  "query": "SELECT * FROM my_table LIMIT 10",
  "async": false,
  "queryOptions": {
    "timeoutMs": 60000
  }
}
```

#### `get_query_status`

Get the status of a Hive query job.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "jobId": "job-123456"
}
```

#### `get_query_results`

Get the results of a completed Hive query.

```json
{
  "projectId": "your-gcp-project-id",
  "region": "us-central1",
  "jobId": "job-123456",
  "maxResults": 100
}
```

## License

MIT
