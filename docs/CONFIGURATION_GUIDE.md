# Dataproc MCP Server Configuration Guide

This guide explains how to configure the Dataproc MCP server for different use cases, including the new **intelligent default parameter management** system.

## ✨ New: Default Parameter Management

The MCP server now supports **intelligent default parameters** that dramatically improve user experience by automatically injecting common parameters (like `projectId` and `region`) when they're not explicitly provided.

### Quick Setup: Default Parameters

Create `config/default-params.json` in your MCP server directory:

```json
{
  "defaultEnvironment": "production",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"}
  ],
  "environments": [
    {
      "environment": "production",
      "parameters": {
        "projectId": "your-project-id",
        "region": "us-central1"
      }
    },
    {
      "environment": "development",
      "parameters": {
        "projectId": "your-dev-project-id",
        "region": "us-west1"
      }
    }
  ]
}
```

### Benefits of Default Parameters

- **🎯 Simplified Tool Usage**: Call `get_job_status` with just `jobId` instead of `projectId`, `region`, and `jobId`
- **🔄 Backward Compatibility**: Still accepts explicit parameters when provided
- **🌍 Multi-Environment Support**: Different defaults per environment
- **📊 Resource Integration**: Default configuration accessible via `dataproc://config/defaults` resource

## Configuration Hierarchy (Priority Order)

1. **Explicit Tool Parameters** (highest priority)
2. **Default Parameter Configuration** (`config/default-params.json`)
3. **MCP Environment Variables** (from global MCP settings)
4. **Built-in Defaults** (lowest priority)

## Global MCP Configuration (Recommended)

For most users, configure the MCP server globally in your MCP settings. This is the cleanest approach.

### Global MCP Settings Example

```json
{
  "dataproc-server1": {
    "command": "node",
    "args": [
      "@dipseth/dataproc-mcp-server"
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
      "get_query_results",
      "delete_cluster",
      "submit_dataproc_job",
      "get_job_status",
      "get_job_results",
      "get_zeppelin_url"
    ],
    "env": {
      "LOG_LEVEL": "error"
    }
  }
}
```

### Optional: Custom Profile Directory

If you want to use a different profile directory, add this to the `env` section:

```json
"env": {
  "LOG_LEVEL": "error",
  "MCP_CONFIG": "{\"profileManager\":{\"rootConfigPath\":\"/path/to/your/profiles\"}}"
}
```

## Default Configuration

The MCP server uses these defaults:

- **Profile Directory**: `./profiles` (relative to MCP server directory)
- **State File**: `./state/dataproc-state.json`
- **Profile Scan Interval**: 5 minutes
- **State Save Interval**: 1 minute
- **Authentication**: Environment-independent service account impersonation
- **Default Parameters**: Loaded from `config/default-params.json` (if exists)
- **Default Environment**: `production` (configurable)

## Project-Specific Configuration (Optional)

Only create project-specific configurations when you need to override defaults for a specific project.

### When to Use Project-Specific Config

- Different service account per project
- Custom profile directories per project
- Different state file locations

### Creating Project-Specific Config

1. **Create config directory manually** (only when needed):
   ```bash
   mkdir -p /path/to/your/project/config
   ```

2. **Create server.json** with your overrides:
   ```json
   {
     "authentication": {
       "impersonateServiceAccount": "project-specific-sa@your-project.iam.gserviceaccount.com",
       "fallbackKeyPath": "/absolute/path/to/source-service-account-key.json",
       "preferImpersonation": true,
       "useApplicationDefaultFallback": false
     },
     "profileManager": {
       "rootConfigPath": "./custom-profiles"
     }
   }
   ```

3. **Update your MCP settings** to point to the project:
   ```json
   "env": {
     "MCP_CONFIG": "{\"profileManager\":{\"rootConfigPath\":\"/path/to/your/project/custom-profiles\"}}"
   }
   ```

## Profile Management

### Default Profiles

The MCP server includes default profiles in `./profiles/`:

```
profiles/
├── development/
│   └── small.yaml
└── production/
    ├── cool-idea-promotions.yaml
    └── high-memory/
        └── analysis.yaml
```

### Using Profiles Across Projects

**Option 1: Use Default Profiles (Recommended)**
- Keep your common profiles in the MCP server's `./profiles/` directory
- All projects can access these profiles
- No need to copy profiles to each project

**Option 2: Project-Specific Profiles**
- Create profiles in your project directory
- Configure MCP to point to that directory
- Useful when profiles contain project-specific configurations

## Environment-Independent Authentication

For detailed information on environment-independent authentication and service account impersonation, refer to the [Authentication Implementation Guide](AUTHENTICATION_IMPLEMENTATION_GUIDE.md).

## Best Practices

### ✅ Recommended Approach

1. **Configure default parameters** in `config/default-params.json` for improved user experience
2. **Use environment-independent authentication** with service account impersonation
3. **Use global MCP configuration** for most settings
4. **Keep common profiles** in the MCP server's `./profiles/` directory
5. **Only create project-specific configs** when you need different service accounts or custom settings
6. **Don't auto-create directories** - create them manually when needed
7. **Always specify `fallbackKeyPath`** for impersonation to ensure environment independence

### ✅ Authentication Best Practices

For detailed authentication best practices, refer to the [Authentication Implementation Guide](AUTHENTICATION_IMPLEMENTATION_GUIDE.md).

### ❌ Avoid

1. **Don't rely on environment variables** like `GOOGLE_APPLICATION_CREDENTIALS`
2. **Don't copy profiles to every project** - use the centralized profiles
3. **Don't create unnecessary config directories** - use defaults when possible
4. **Don't use complex configuration hierarchies** - keep it simple
5. **Don't enable `useApplicationDefaultFallback`** unless you specifically need environment variable fallbacks

## Troubleshooting

### Profile Not Found

If you get "Profile not found" errors:

1. Check the profile exists in the configured directory
2. Verify the MCP_CONFIG environment variable (if used)
3. Use `list_profiles` tool to see available profiles

### Configuration Issues

1. **Check log level**: Set `LOG_LEVEL=debug` to see configuration loading
2. **Verify paths**: Ensure profile paths are correct
3. **Test with defaults**: Remove custom configs to test with defaults

## Migration from Old System

If you were using the old auto-creating system:

1. **Remove auto-created directories**: Delete empty `configs/` directories
2. **Consolidate profiles**: Move profiles to the central `./profiles/` directory
3. **Simplify MCP settings**: Remove unnecessary MCP_CONFIG overrides
4. **Test with defaults**: Verify everything works with the simplified setup

## Examples

### Simple Global Setup

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

### Multi-Project Setup

```json
{
  "dataproc-server-project-a": {
    "command": "node",
    "args": ["/path/to/dataproc-server/build/index.js"],
    "env": {
      "MCP_CONFIG": "{\"authentication\":{\"impersonateServiceAccount\":\"project-a-sa@project-a.iam.gserviceaccount.com\"}}"
    }
  },
  "dataproc-server-project-b": {
    "command": "node",
    "args": ["/path/to/dataproc-server/build/index.js"],
    "env": {
      "MCP_CONFIG": "{\"authentication\":{\"impersonateServiceAccount\":\"project-b-sa@project-b.iam.gserviceaccount.com\"}}"
    }
  }
}
```

## Default Parameter Examples

### Basic Default Parameters Setup
```json
{
  "defaultEnvironment": "production",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"}
  ],
  "environments": [
    {
      "environment": "production",
      "parameters": {
        "projectId": "your-project-id",
        "region": "us-central1"
      }
    }
  ]
}
```

### Multi-Environment Setup
```json
{
  "defaultEnvironment": "production",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"},
    {"name": "zone", "type": "string", "required": false, "defaultValue": "us-central1-a"}
  ],
  "environments": [
    {
      "environment": "development",
      "parameters": {
        "projectId": "dev-project-123",
        "region": "us-west1",
        "zone": "us-west1-a"
      }
    },
    {
      "environment": "staging",
      "parameters": {
        "projectId": "staging-project-456",
        "region": "us-central1",
        "zone": "us-central1-b"
      }
    },
    {
      "environment": "production",
      "parameters": {
        "projectId": "your-project-id",
        "region": "us-central1",
        "zone": "us-central1-a"
      }
    }
  ]
}
```

### Usage Examples

**Before (required explicit parameters):**
```json
{
  "projectId": "your-project-id",
  "region": "us-central1",
  "jobId": "my-job-id"
}
```

**After (with defaults configured):**
```json
{
  "jobId": "my-job-id"
}
```

**Override defaults when needed:**
```json
{
  "projectId": "different-project",
  "region": "us-west1",
  "jobId": "my-job-id"
}
```

## Knowledge Base and Semantic Search Configuration

### Qdrant Vector Database Setup (Optional)

The MCP server supports optional semantic search capabilities through Qdrant integration:

```bash
# Start Qdrant vector database
docker run -p 6334:6333 qdrant/qdrant

# Verify connection
curl http://localhost:6334/health
```

### Response Filter Configuration

Configure semantic search in `config/response-filter.json`:

```json
{
  "qdrant": {
    "url": "http://localhost:6334",
    "collectionName": "dataproc_knowledge",
    "vectorSize": 384,
    "distance": "Cosine"
  },
  "tokenLimits": {
    "list_clusters": 500,
    "get_cluster": 300,
    "default": 400
  },
  "extractionRules": {
    "list_clusters": {
      "maxClusters": 10,
      "essentialFields": ["clusterName", "status", "machineType"],
      "summaryFormat": "table"
    }
  }
}
```

### Semantic Search Benefits

**With Qdrant Enabled:**
- Natural language queries: "clusters with pip packages"
- Intelligent data extraction and indexing
- Vector similarity search with confidence scores
- Enhanced filtering and discovery capabilities

**Without Qdrant (Graceful Degradation):**
- All core functionality remains available
- Standard data retrieval and management
- Helpful setup guidance when semantic features are requested
- No breaking changes or dependencies

### Troubleshooting Qdrant Setup

```bash
# Check if Qdrant is running
docker ps | grep qdrant

# Test connection
curl http://localhost:6334/health

# Check collections
curl http://localhost:6334/collections

# View logs
docker logs $(docker ps -q --filter ancestor=qdrant/qdrant)
```

This approach keeps configuration simple while providing flexibility and dramatically improved user experience.
