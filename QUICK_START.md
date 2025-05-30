# 🚀 Quick Start Guide

Get your Dataproc MCP Server up and running in under 5 minutes!

## Prerequisites

- **Node.js 18.0.0 or higher** ([Download](https://nodejs.org/))
- **Google Cloud Project** with Dataproc API enabled
- **Service account** with appropriate permissions
- **MCP Client** (Claude Desktop, Cline, or other MCP-compatible client)

### 📋 Required GCP APIs

Enable these APIs in your Google Cloud Project:
```bash
gcloud services enable dataproc.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable iam.googleapis.com
```

### 🔑 Service Account Permissions

Your service account needs these roles:
- `roles/dataproc.editor` - For cluster management
- `roles/storage.objectViewer` - For accessing job outputs
- `roles/iam.serviceAccountUser` - For impersonation (if used)

## Installation

### Option 1: Clone and Build (Current)

```bash
git clone https://github.com/dipseth/dataproc-mcp.git
cd dataproc-mcp
npm install
npm run build
```

### Option 2: NPM Install (Future)

```bash
# When published to npm
npm install -g @dataproc/mcp-server
```

## 🛠️ Setup

### 1. Interactive Setup (Recommended)

```bash
npm run setup
```

**What this does:**
- ✅ Creates necessary directories (`config/`, `state/`, `output/`)
- ✅ Guides you through project configuration
- ✅ Sets up authentication with your service account
- ✅ Creates MCP client configuration template
- ✅ Validates your setup

**Example interaction:**
```
🚀 Dataproc MCP Server Setup
=============================

📁 Creating necessary directories...
  ✅ Created config/
  ✅ Created state/
  ✅ Created output/

🔧 Setting up default parameters...
Enter your GCP Project ID: my-dataproc-project
Enter your preferred region (default: us-central1): us-central1
Enter your environment name (default: production): production

🔐 Setting up authentication...
Do you want to use service account impersonation? (y/n): y
Enter the service account email to impersonate: dataproc-sa@my-project.iam.gserviceaccount.com
Enter the path to your source service account key file: /path/to/source-key.json
```

### 2. Manual Setup (Alternative)

```bash
# Create directories
mkdir -p config profiles state output

# Copy configuration templates
cp templates/default-params.json.template config/default-params.json
cp templates/server.json.template config/server.json
cp templates/mcp-settings.json.template mcp-settings.json

# Edit configurations with your details
nano config/default-params.json
nano config/server.json
```

### 3. Validate Setup

```bash
npm run validate
```

This checks:
- ✅ Directory structure
- ✅ Configuration files
- ✅ Service account credentials
- ✅ Build status
- ✅ Profile availability

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

## 🎯 Common Use Cases

### 1. Quick Data Analysis Cluster

Create a small cluster for data exploration:

```json
{
  "tool": "create_cluster_from_profile",
  "arguments": {
    "profileName": "development/small",
    "clusterName": "analysis-cluster-001"
  }
}
```

**What this creates:**
- 1 master node (n1-standard-2)
- 2 worker nodes (n1-standard-2)
- Preemptible instances for cost savings
- Standard Spark/Hadoop configuration

### 2. Production ETL Pipeline

For production workloads with high memory requirements:

```json
{
  "tool": "create_cluster_from_profile",
  "arguments": {
    "profileName": "production/high-memory/analysis",
    "clusterName": "etl-production-cluster"
  }
}
```

**Features:**
- High-memory instances
- Persistent disks
- Auto-scaling enabled
- Production-grade networking

### 3. Run Hive Query

Execute SQL queries on your data:

```json
{
  "tool": "submit_hive_query",
  "arguments": {
    "clusterName": "analysis-cluster-001",
    "query": "SELECT COUNT(*) FROM my_table WHERE date >= '2024-01-01'"
  }
}
```

### 4. Monitor Job Progress

Check the status of running jobs:

```json
{
  "tool": "get_job_status",
  "arguments": {
    "jobId": "your-job-id-here"
  }
}
```

### 5. Get Query Results

Retrieve results from completed queries:

```json
{
  "tool": "get_job_results",
  "arguments": {
    "jobId": "your-job-id-here",
    "maxResults": 100
  }
}
```

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

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 1. Authentication Problems

**Error:** `Authentication failed` or `Permission denied`

**Solutions:**
```bash
# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID

# Verify API is enabled
gcloud services list --enabled | grep dataproc

# Test authentication
gcloud auth application-default login
```

**Required permissions:**
- `dataproc.clusters.create`
- `dataproc.clusters.delete`
- `dataproc.jobs.create`
- `compute.instances.create`

#### 2. Profile Not Found

**Error:** `Profile 'development/small' not found`

**Solutions:**
```bash
# List available profiles
npm run validate

# Check profile directory
ls -la profiles/

# Verify profile syntax
cat profiles/development/small.yaml
```

#### 3. Cluster Creation Fails

**Error:** `Cluster creation failed` or `Quota exceeded`

**Solutions:**
```bash
# Check quotas
gcloud compute project-info describe --project=YOUR_PROJECT

# Verify region availability
gcloud compute zones list --filter="region:us-central1"

# Check firewall rules
gcloud compute firewall-rules list
```

#### 4. Build Issues

**Error:** TypeScript compilation errors

**Solutions:**
```bash
# Clean and rebuild
rm -rf build/ node_modules/
npm install
npm run build

# Check Node.js version
node --version  # Should be >= 18.0.0

# Update dependencies
npm update
```

#### 5. Rate Limiting

**Error:** `Rate limit exceeded`

**Solutions:**
```bash
# Wait for rate limit reset (1 minute)
# Or adjust rate limits in configuration

# Check current limits
grep -r "rate" config/
```

#### 6. Network Connectivity

**Error:** `Connection timeout` or `Network unreachable`

**Solutions:**
```bash
# Test connectivity
curl -I https://dataproc.googleapis.com/

# Check proxy settings
echo $HTTP_PROXY $HTTPS_PROXY

# Verify DNS resolution
nslookup dataproc.googleapis.com
```

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Set debug log level
export LOG_LEVEL=debug

# Run with verbose output
npm start 2>&1 | tee debug.log
```

### Configuration Validation

Run comprehensive validation:

```bash
npm run validate
```

**What it checks:**
- ✅ Node.js version compatibility
- ✅ Required dependencies
- ✅ Directory structure
- ✅ Configuration file syntax
- ✅ Service account credentials
- ✅ Profile availability
- ✅ Build status

### Emergency Procedures

#### Stop All Clusters

```bash
# List all clusters
{
  "tool": "list_clusters",
  "arguments": {}
}

# Stop specific cluster
{
  "tool": "delete_cluster",
  "arguments": {
    "clusterName": "your-cluster-name"
  }
}

# Emergency stop all server instances
npm run stop
```

#### Reset Configuration

```bash
# Backup current config
cp -r config/ config.backup/

# Reset to defaults
rm -rf config/
npm run setup
```

### Get Help

- 📖 [Full Documentation](README.md)
- 🔧 [Configuration Guide](docs/CONFIGURATION_GUIDE.md)
- 🔒 [Security Guide](docs/SECURITY_GUIDE.md)
- 🐛 [Report Issues](https://github.com/dipseth/dataproc-mcp/issues)
- 💬 [Discussions](https://github.com/dipseth/dataproc-mcp/discussions)

## Next Steps

- Explore the [example profiles](profiles/)
- Read the [Configuration Guide](docs/CONFIGURATION_GUIDE.md)
- Check out the [Production Readiness Plan](./PRODUCTION_READINESS_PLAN.md)

Happy clustering! 🎉