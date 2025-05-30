# 🚀 Quick Start Guide

Get your Dataproc MCP Server up and running in under 5 minutes!

## Prerequisites

- Node.js 18.0.0 or higher
- Google Cloud Project with Dataproc API enabled
- Service account with appropriate permissions

## Installation

### Option 1: NPM Install (Recommended)

```bash
npm install -g @dataproc/mcp-server
```

### Option 2: Clone and Build

```bash
git clone https://github.com/your-org/dataproc-mcp-server.git
cd dataproc-mcp-server
npm install
npm run build
```

## Setup

### 1. Run Interactive Setup

```bash
npm run setup
```

This will guide you through:
- Creating necessary directories
- Configuring default parameters (project ID, region)
- Setting up authentication
- Creating MCP client configuration

### 2. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# Create directories
mkdir -p config profiles state output

# Copy and edit configuration templates
cp templates/default-params.json.template config/default-params.json
cp templates/server.json.template config/server.json

# Edit the files with your project details
```

## Configuration

### Default Parameters (`config/default-params.json`)

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

### Authentication (`config/server.json`)

```json
{
  "authentication": {
    "impersonateServiceAccount": "your-sa@your-project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/path/to/your/service-account-key.json",
    "preferImpersonation": true,
    "useApplicationDefaultFallback": false
  }
}
```

## Add to MCP Client

Add this configuration to your MCP client settings:

```json
{
  "dataproc-server": {
    "command": "node",
    "args": ["/path/to/dataproc-mcp-server/build/index.js"],
    "disabled": false,
    "timeout": 60,
    "alwaysAllow": ["*"],
    "env": {
      "LOG_LEVEL": "error"
    }
  }
}
```

## Validation

Verify your setup:

```bash
npm run validate
```

## Test with MCP Inspector

```bash
npm run inspector
```

## First Cluster

Once configured, you can create your first cluster:

```bash
# Using the MCP client or inspector
{
  "tool": "start_dataproc_cluster",
  "arguments": {
    "clusterName": "my-first-cluster"
  }
}
```

The server will automatically use your configured project ID and region!

## Available Tools

The server provides 16 comprehensive tools:

### Cluster Management
- `start_dataproc_cluster` - Create a new cluster
- `list_clusters` - List all clusters
- `get_cluster` - Get cluster details
- `delete_cluster` - Delete a cluster

### Job Execution
- `submit_hive_query` - Run Hive queries
- `submit_dataproc_job` - Submit any Dataproc job
- `get_job_status` - Check job status
- `get_job_results` - Get job results

### Profile Management
- `create_cluster_from_profile` - Use predefined profiles
- `list_profiles` - See available profiles
- `get_profile` - Get profile details

### And more!

## Troubleshooting

### Common Issues

1. **"Profile not found"**
   ```bash
   npm run validate  # Check configuration
   ```

2. **Authentication errors**
   - Verify service account permissions
   - Check key file paths
   - Ensure Dataproc API is enabled

3. **Build issues**
   ```bash
   npm run build  # Rebuild the project
   ```

### Get Help

- 📖 [Full Documentation](README.md)
- 🔧 [Configuration Guide](docs/CONFIGURATION_GUIDE.md)
- 🐛 [Report Issues](https://github.com/your-org/dataproc-mcp-server/issues)

## Next Steps

- Explore the [example profiles](profiles/)
- Read the [Configuration Guide](docs/CONFIGURATION_GUIDE.md)
- Check out the [Production Readiness Plan](PRODUCTION_READINESS_PLAN.md)

Happy clustering! 🎉