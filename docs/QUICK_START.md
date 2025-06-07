---
layout: default
title: Quick Start Guide
description: Get up and running with the Dataproc MCP Server in just 5 minutes
permalink: /QUICK_START/
---

# Quick Start Guide 🚀

Get up and running with the Dataproc MCP Server in just 5 minutes!

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Google Cloud Project** with Dataproc API enabled
- **Authentication** - Service account key or gcloud CLI

## 🎯 5-Minute Setup

### Step 1: Install the Package

```bash
# Install globally for easy access
npm install -g @dataproc/mcp-server

# Or install locally in your project
npm install @dataproc/mcp-server
```

### Step 2: Quick Setup

```bash
# Run the interactive setup
dataproc-mcp --setup

# This will create:
# - config/server.json (server configuration)
# - config/default-params.json (default parameters)
# - profiles/ (cluster profile directory)
```

### Step 3: Configure Authentication

Choose one of these authentication methods:

#### Option A: Service Account Key (Simplest)
```bash
# Download your service account key from Google Cloud Console
# Place it in a secure location
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

#### Option B: Service Account Impersonation (Recommended)
```json
// config/server.json
{
  "authentication": {
    "impersonateServiceAccount": "dataproc-worker@your-project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/path/to/source-key.json",
    "preferImpersonation": true
  }
}
```

#### Option C: Application Default Credentials
```bash
# If running on Google Cloud or using gcloud CLI
gcloud auth application-default login
```

### Step 4: Configure Your Project

Edit `config/default-params.json`:

```json
{
  "defaultEnvironment": "development",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"}
  ],
  "environments": [
    {
      "environment": "development",
      "parameters": {
        "projectId": "your-project-id",
        "region": "us-central1"
      }
    }
  ]
}
```

### Step 5: Optional - Enable Semantic Search

For enhanced natural language queries (optional):

```bash
# Install and start Qdrant vector database
docker run -p 6334:6333 qdrant/qdrant

# Verify Qdrant is running
curl http://localhost:6334/health
```

**Benefits of Semantic Search:**
- Natural language cluster queries: "show me clusters with pip packages"
- Intelligent data extraction and filtering
- Enhanced search capabilities with confidence scoring

**Note:** This is completely optional - all core functionality works without Qdrant.

### Step 6: Start the Server

```bash
# Start the MCP server
dataproc-mcp

# Or run directly with Node.js
node /path/to/dataproc-mcp/build/index.js
```

## 🔧 MCP Client Integration

### Claude Desktop

Add to your Claude Desktop configuration:

**File: `~/Library/Application Support/Claude/claude_desktop_config.json`**
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": [
        "@dipseth/dataproc-mcp-server@latest"
      ],
      "env": {
        "LOG_LEVEL": "info",
        "DATAPROC_CONFIG_PATH": "/path/to/your/config/server.json"
      }
    }
  }
}
```

### Roo (VS Code)

Add to your Roo MCP settings:

**File: `.roo/mcp.json`**
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": [
        "@dipseth/dataproc-mcp-server@latest"
      ],
      "env": {
        "LOG_LEVEL": "info",
        "DATAPROC_CONFIG_PATH": "/path/to/your/config/server.json"
      },
      "alwaysAllow": []
    }
  }
}
```

## 🎮 First Commands

Once connected, try these commands in your MCP client:

### List Available Tools
```
What Dataproc tools are available?
```

### Create a Simple Cluster
```
Create a small Dataproc cluster named "test-cluster" in my project
```

### List Clusters
```
Show me all my Dataproc clusters
```

### Submit a Spark Job
```
Submit a Spark job to process data from gs://my-bucket/data.csv
```

### Try Semantic Search (if Qdrant enabled)
```
Show me clusters with machine learning packages installed
```

```
Find clusters using high-memory configurations
```

## 📋 Example Cluster Profile

Create a custom cluster profile in `profiles/my-cluster.yaml`:

```yaml
my-project-dev-cluster:
  region: us-central1
  tags:
    - development
    - testing
  labels:
    environment: dev
    team: data-engineering
  cluster_config:
    master_config:
      num_instances: 1
      machine_type_uri: n1-standard-4
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 100
    worker_config:
      num_instances: 2
      machine_type_uri: n1-standard-4
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 100
      is_preemptible: true  # Cost savings for dev
    software_config:
      image_version: 2.1.1-debian10
      optional_components:
        - JUPYTER
      properties:
        dataproc:dataproc.allow.zero.workers: "true"
    lifecycle_config:
      idle_delete_ttl:
        seconds: 1800  # 30 minutes
```

## 🔍 Verification

### Test Your Setup

```bash
# Check if the server starts correctly
dataproc-mcp --test

# Verify authentication
dataproc-mcp --verify-auth

# List available profiles
dataproc-mcp --list-profiles
```

### Health Check

```bash
# Run comprehensive health check
npm run pre-flight  # If installed from source

# Or basic connectivity test
curl -X POST http://localhost:3000/health  # If running as HTTP server
```

## 🚨 Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check your credentials
gcloud auth list
gcloud config list project

# Verify service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

#### Permission Errors
```bash
# Enable required APIs
gcloud services enable dataproc.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable storage.googleapis.com
```

#### Connection Issues
```bash
# Check network connectivity
ping google.com

# Verify firewall rules
gcloud compute firewall-rules list
```

### Getting Help

1. **Check the logs**: Look for error messages in the console output
2. **Verify configuration**: Ensure all required fields are filled
3. **Test authentication**: Use `gcloud auth application-default print-access-token`
4. **Check permissions**: Verify your service account has Dataproc Admin role

## 📚 Next Steps

### Learn More
- **[API Reference](API_REFERENCE.md)** - Complete tool documentation
- **[Configuration Examples](CONFIGURATION_EXAMPLES.md)** - Real-world setups
- **[Security Guide](SECURITY_GUIDE.md)** - Best practices
- **[Testing Guide](TESTING_GUIDE.md)** - Testing and debugging information

### Advanced Features
- **Multi-environment setup** for dev/staging/production
- **Custom cluster profiles** for different workloads
- **Automated job scheduling** with cron-like syntax
- **Performance monitoring** and alerting
- **Cost optimization** with preemptible instances

### Community
- **[GitHub Issues](https://github.com/dipseth/dataproc-mcp/issues)** - Bug reports and feature requests
- **[Community Support](./COMMUNITY_SUPPORT.md)** - Community Q&A
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute

## 🎉 You're Ready!

Your Dataproc MCP Server is now configured and ready to use. Start by creating your first cluster and exploring the available tools through your MCP client.

**Happy data processing! 🚀**

---

**Need help?** Check our [testing guide](TESTING_GUIDE.md) or [open an issue](https://github.com/dipseth/dataproc-mcp/issues).