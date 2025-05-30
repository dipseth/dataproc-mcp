# Cluster Configuration Profiles

This directory contains predefined cluster configuration profiles for different use cases.

## Available Profiles

### Development Profiles
- **[development/](development/)** - Lightweight configurations for development and testing

### Production Profiles  
- **[production/](production/)** - Production-ready configurations with optimized settings

## Usage

Profiles can be used with the `create_cluster_from_profile` tool:

```bash
# Use a development profile
dataproc-mcp create_cluster_from_profile --profile development/small-cluster --cluster-name my-dev-cluster

# Use a production profile
dataproc-mcp create_cluster_from_profile --profile production/high-memory --cluster-name my-prod-cluster
```

## Profile Structure

Each profile contains:
- **Configuration YAML** - Cluster specifications
- **Documentation** - Usage guidelines and examples
- **Validation Rules** - Parameter constraints and defaults

For detailed information about each profile, see the README files in the respective subdirectories.