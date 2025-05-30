# Development Cluster Profiles

This directory contains cluster configuration profiles optimized for development and testing environments.

## Available Profiles

### Small Development Cluster
- **Profile**: `small-cluster.yaml`
- **Use Case**: Local development, testing, small datasets
- **Resources**: Minimal compute and memory allocation
- **Cost**: Low cost for development work

### Medium Development Cluster  
- **Profile**: `medium-cluster.yaml`
- **Use Case**: Integration testing, medium datasets
- **Resources**: Moderate compute and memory allocation
- **Cost**: Balanced cost for testing workflows

## Usage

```bash
# Create a small development cluster
dataproc-mcp create_cluster_from_profile \
  --profile development/small-cluster \
  --cluster-name my-dev-cluster

# Create a medium development cluster
dataproc-mcp create_cluster_from_profile \
  --profile development/medium-cluster \
  --cluster-name my-test-cluster
```

## Configuration Features

- **Auto-scaling**: Enabled for cost optimization
- **Preemptible instances**: Used to reduce costs
- **Development tools**: Pre-installed debugging and monitoring tools
- **Quick startup**: Optimized for fast cluster creation
- **Auto-deletion**: Configured for automatic cleanup

## Best Practices

1. **Use preemptible instances** for cost savings
2. **Enable auto-scaling** to handle variable workloads
3. **Set auto-deletion timers** to prevent forgotten clusters
4. **Use smaller machine types** for development work
5. **Monitor costs** regularly during development

For production workloads, see the [production profiles](../production/).