# Production Cluster Profiles

This directory contains cluster configuration profiles optimized for production environments with high availability, performance, and reliability.

## Available Profiles

### High-Memory Analysis Cluster
- **Profile**: `high-memory.yaml`
- **Use Case**: Large-scale data analysis, memory-intensive workloads
- **Resources**: High memory allocation, optimized for analytics
- **Features**: Enhanced monitoring, backup, and recovery

### High-Performance Computing Cluster
- **Profile**: `high-performance.yaml`
- **Use Case**: CPU-intensive processing, real-time analytics
- **Resources**: High-performance CPUs, optimized networking
- **Features**: Low-latency configuration, performance monitoring

### Enterprise Analytics Cluster
- **Profile**: `enterprise-analytics.yaml`
- **Use Case**: Business-critical data analytics and reporting
- **Resources**: Balanced compute and memory for enterprise workloads
- **Features**: High availability, automated backup, SLA monitoring

## Usage

```bash
# Create a high-memory production cluster
dataproc-mcp create_cluster_from_profile \
  --profile production/high-memory \
  --cluster-name prod-analytics-cluster

# Create an enterprise analytics cluster
dataproc-mcp create_cluster_from_profile \
  --profile production/enterprise-analytics \
  --cluster-name analytics-prod-cluster
```

## Production Features

- **High Availability**: Multi-zone deployment for fault tolerance
- **Security**: Enhanced security configurations and encryption
- **Monitoring**: Comprehensive logging and alerting
- **Backup**: Automated data backup and recovery
- **Performance**: Optimized for production workloads
- **Compliance**: Meets enterprise security and compliance requirements

## Best Practices

1. **Use dedicated instances** for consistent performance
2. **Enable monitoring and alerting** for all clusters
3. **Configure automated backups** for critical data
4. **Implement proper security controls** and access management
5. **Monitor costs and usage** for optimization opportunities
6. **Plan for disaster recovery** and business continuity

## Security Considerations

- **Network isolation**: Private subnets and VPC configuration
- **Access controls**: IAM roles and service account management
- **Encryption**: Data encryption at rest and in transit
- **Audit logging**: Comprehensive audit trail for compliance
- **Vulnerability management**: Regular security updates and patches

For development and testing, see the [development profiles](../development/).