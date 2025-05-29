# Dataproc MCP Server Configuration Guide

This guide explains how to configure the Dataproc MCP server for different use cases.

## Simplified Configuration Approach

The MCP server now uses a simplified configuration approach that avoids auto-creating unnecessary directories and provides sensible defaults.

## Configuration Hierarchy (Priority Order)

1. **Default Configuration** (built-in)
2. **MCP Environment Variables** (from global MCP settings)
3. **Project-specific Config File** (optional, only if explicitly created)

## Global MCP Configuration (Recommended)

For most users, configure the MCP server globally in your MCP settings. This is the cleanest approach.

### Global MCP Settings Example

```json
{
  "dataproc-server1": {
    "command": "node",
    "args": [
      "/Users/srivers/Documents/Cline/MCP/dataproc-server/build/index.js"
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
    ├── pricing-promotions.yaml
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

### Service Account Impersonation Configuration

The MCP server now supports **environment-independent authentication** through service account impersonation, eliminating dependencies on environment variables like `GOOGLE_APPLICATION_CREDENTIALS`.

#### Required Configuration
```json
{
  "authentication": {
    "impersonateServiceAccount": "target-service-account@project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/absolute/path/to/source-service-account-key.json",
    "preferImpersonation": true,
    "useApplicationDefaultFallback": false
  }
}
```

#### Configuration Parameters
- **`impersonateServiceAccount`**: Target service account to impersonate for all operations
- **`fallbackKeyPath`**: **REQUIRED** - Absolute path to source service account key file
- **`preferImpersonation`**: Whether to prefer impersonation over direct key file usage
- **`useApplicationDefaultFallback`**: Whether to allow Application Default Credentials as final fallback

#### Environment Independence Benefits
- ✅ **No Environment Variable Dependencies**: System ignores `GOOGLE_APPLICATION_CREDENTIALS`
- ✅ **Predictable Behavior**: Authentication determined by configuration file only
- ✅ **Fail-Fast Configuration**: Missing configuration results in clear error messages
- ✅ **Production Ready**: Works consistently across different environments

#### Authentication Strategy Priority
1. **Service Account Impersonation** (if configured and preferred)
2. **Configured Key File** (explicit configuration only)
3. **Application Default Credentials** (only if explicitly enabled)

### Example: Multi-Environment Setup
```json
{
  "dataproc-server-dev": {
    "env": {
      "MCP_CONFIG": "{\"authentication\":{\"impersonateServiceAccount\":\"dev-sa@dev-project.iam.gserviceaccount.com\",\"fallbackKeyPath\":\"/path/to/dev-key.json\",\"preferImpersonation\":true,\"useApplicationDefaultFallback\":false}}"
    }
  },
  "dataproc-server-prod": {
    "env": {
      "MCP_CONFIG": "{\"authentication\":{\"impersonateServiceAccount\":\"prod-sa@prod-project.iam.gserviceaccount.com\",\"fallbackKeyPath\":\"/path/to/prod-key.json\",\"preferImpersonation\":true,\"useApplicationDefaultFallback\":false}}"
    }
  }
}
```

## Best Practices

### ✅ Recommended Approach

1. **Use environment-independent authentication** with service account impersonation
2. **Use global MCP configuration** for most settings
3. **Keep common profiles** in the MCP server's `./profiles/` directory
4. **Only create project-specific configs** when you need different service accounts or custom settings
5. **Don't auto-create directories** - create them manually when needed
6. **Always specify `fallbackKeyPath`** for impersonation to ensure environment independence

### ✅ Authentication Best Practices

1. **Use service account impersonation** instead of direct key file authentication
2. **Set `useApplicationDefaultFallback: false`** to ensure environment independence
3. **Use absolute paths** for `fallbackKeyPath` to avoid path resolution issues
4. **Test configuration** in different environments to ensure consistency

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

This approach keeps configuration simple while providing flexibility when needed.
