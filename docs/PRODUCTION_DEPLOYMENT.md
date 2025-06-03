# 🏭 Production Deployment Guide

Complete guide for deploying the Dataproc MCP Server with response optimization in production environments.

## Overview

This guide covers production deployment options, Qdrant setup, performance tuning, monitoring, and scaling considerations for the Dataproc MCP Server with response optimization.

## Deployment Options

### 1. Docker Deployment (Recommended)

#### Single Container Setup

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY build/ ./build/
COPY config/ ./config/
COPY profiles/ ./profiles/

EXPOSE 3000
CMD ["node", "build/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  dataproc-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - RESPONSE_OPTIMIZATION_ENABLED=true
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_AUTO_START=false
    volumes:
      - ./config:/app/config:ro
      - ./state:/app/state
    depends_on:
      - qdrant
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:v1.7.4
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
    restart: unless-stopped

volumes:
  qdrant_data:
    driver: local
```

#### Multi-Container Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  dataproc-mcp:
    image: dataproc-mcp-server:${VERSION:-latest}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
      - RESPONSE_OPTIMIZATION_ENABLED=true
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_COLLECTION=dataproc_responses_prod
    volumes:
      - ./config/production.json:/app/config/server.json:ro
    networks:
      - dataproc-network
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:v1.7.4
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    volumes:
      - qdrant_data:/qdrant/storage
      - ./qdrant/config.yaml:/qdrant/config/production.yaml:ro
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4
    networks:
      - dataproc-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - dataproc-mcp
    networks:
      - dataproc-network
    restart: unless-stopped

networks:
  dataproc-network:
    driver: bridge

volumes:
  qdrant_data:
    driver: local
```

### 2. Kubernetes Deployment

#### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dataproc-mcp
  labels:
    name: dataproc-mcp

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dataproc-mcp-config
  namespace: dataproc-mcp
data:
  server.json: |
    {
      "projectId": "my-production-project",
      "region": "us-central1",
      "responseOptimization": {
        "enabled": true,
        "tokenLimit": 500
      },
      "qdrant": {
        "url": "http://qdrant-service:6333",
        "collection": "dataproc_responses_prod"
      }
    }
```

#### Qdrant Deployment

```yaml
# k8s/qdrant.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qdrant
  namespace: dataproc-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: qdrant
  template:
    metadata:
      labels:
        app: qdrant
    spec:
      containers:
      - name: qdrant
        image: qdrant/qdrant:v1.7.4
        ports:
        - containerPort: 6333
        - containerPort: 6334
        env:
        - name: QDRANT__SERVICE__HTTP_PORT
          value: "6333"
        - name: QDRANT__SERVICE__GRPC_PORT
          value: "6334"
        - name: QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS
          value: "4"
        volumeMounts:
        - name: qdrant-storage
          mountPath: /qdrant/storage
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: qdrant-storage
        persistentVolumeClaim:
          claimName: qdrant-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: qdrant-service
  namespace: dataproc-mcp
spec:
  selector:
    app: qdrant
  ports:
  - name: http
    port: 6333
    targetPort: 6333
  - name: grpc
    port: 6334
    targetPort: 6334

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: qdrant-pvc
  namespace: dataproc-mcp
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
```

#### MCP Server Deployment

```yaml
# k8s/dataproc-mcp.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dataproc-mcp
  namespace: dataproc-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dataproc-mcp
  template:
    metadata:
      labels:
        app: dataproc-mcp
    spec:
      containers:
      - name: dataproc-mcp
        image: dataproc-mcp-server:v2.0.2
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: RESPONSE_OPTIMIZATION_ENABLED
          value: "true"
        - name: QDRANT_URL
          value: "http://qdrant-service:6333"
        - name: QDRANT_AUTO_START
          value: "false"
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: state
          mountPath: /app/state
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: dataproc-mcp-config
      - name: state
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: dataproc-mcp-service
  namespace: dataproc-mcp
spec:
  selector:
    app: dataproc-mcp
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

### 3. Cloud Provider Deployments

#### Google Cloud Run

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: dataproc-mcp
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containers:
      - image: gcr.io/my-project/dataproc-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: QDRANT_URL
          value: "https://my-qdrant-instance.qdrant.cloud"
        - name: RESPONSE_OPTIMIZATION_ENABLED
          value: "true"
        resources:
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

#### AWS ECS

```json
{
  "family": "dataproc-mcp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "dataproc-mcp",
      "image": "dataproc-mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "QDRANT_URL",
          "value": "http://qdrant-cluster.internal:6333"
        },
        {
          "name": "RESPONSE_OPTIMIZATION_ENABLED",
          "value": "true"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dataproc-mcp",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Qdrant Production Setup

### 1. Qdrant Cloud (Recommended)

```bash
# Sign up at https://cloud.qdrant.io
# Create cluster and get connection details

export QDRANT_URL="https://xyz-abc123.eu-central.aws.cloud.qdrant.io:6333"
export QDRANT_API_KEY="your-api-key"
```

### 2. Self-Hosted Qdrant

#### High Availability Setup

```yaml
# qdrant-cluster.yml
version: '3.8'
services:
  qdrant-node-1:
    image: qdrant/qdrant:v1.7.4
    environment:
      - QDRANT__CLUSTER__ENABLED=true
      - QDRANT__CLUSTER__P2P__PORT=6335
      - QDRANT__CLUSTER__CONSENSUS__TICK_PERIOD_MS=100
    volumes:
      - qdrant_node_1:/qdrant/storage
    ports:
      - "6333:6333"
      - "6335:6335"

  qdrant-node-2:
    image: qdrant/qdrant:v1.7.4
    environment:
      - QDRANT__CLUSTER__ENABLED=true
      - QDRANT__CLUSTER__P2P__PORT=6335
      - QDRANT__CLUSTER__BOOTSTRAP__PEER_ADDRS=qdrant-node-1:6335
    volumes:
      - qdrant_node_2:/qdrant/storage
    ports:
      - "6334:6333"
      - "6336:6335"
    depends_on:
      - qdrant-node-1

  qdrant-node-3:
    image: qdrant/qdrant:v1.7.4
    environment:
      - QDRANT__CLUSTER__ENABLED=true
      - QDRANT__CLUSTER__P2P__PORT=6335
      - QDRANT__CLUSTER__BOOTSTRAP__PEER_ADDRS=qdrant-node-1:6335
    volumes:
      - qdrant_node_3:/qdrant/storage
    ports:
      - "6337:6333"
      - "6338:6335"
    depends_on:
      - qdrant-node-1

volumes:
  qdrant_node_1:
  qdrant_node_2:
  qdrant_node_3:
```

#### Performance Configuration

```yaml
# qdrant/config.yaml
service:
  http_port: 6333
  grpc_port: 6334
  enable_cors: true

storage:
  # Storage performance settings
  performance:
    max_search_threads: 4
    max_optimization_threads: 2
  
  # Memory settings
  memory:
    # Use 70% of available memory for vectors
    vectors_memory_threshold: 0.7
    # Use 30% for payload
    payload_memory_threshold: 0.3

  # Disk settings
  disk:
    # Enable memory mapping for better performance
    mmap_threshold: 1000000
    # Optimize for SSD
    optimize_for_ssd: true

cluster:
  enabled: true
  p2p:
    port: 6335
  consensus:
    # Faster consensus for production
    tick_period_ms: 100
    bootstrap_timeout_sec: 30
```

## Environment Configuration

### Production Environment Variables

```bash
# Core settings
NODE_ENV=production
LOG_LEVEL=warn
PORT=3000

# Response optimization
RESPONSE_OPTIMIZATION_ENABLED=true
RESPONSE_TOKEN_LIMIT=500
RESPONSE_CACHE_ENABLED=true
RESPONSE_CACHE_TTL=300

# Qdrant settings
QDRANT_URL=http://qdrant-cluster:6333
QDRANT_API_KEY=your-production-api-key
QDRANT_COLLECTION=dataproc_responses_prod
QDRANT_AUTO_START=false
QDRANT_VECTOR_SIZE=384
QDRANT_DISTANCE_METRIC=Cosine

# Performance tuning
QDRANT_MAX_POINTS=100000
QDRANT_CLEANUP_ENABLED=true
QDRANT_CLEANUP_INTERVAL=3600000  # 1 hour

# Security
GOOGLE_APPLICATION_CREDENTIALS=/app/config/service-account.json
DATAPROC_CONFIG_PATH=/app/config/production.json

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

### Configuration Files

#### Production Server Config

```json
{
  "projectId": "my-production-project",
  "region": "us-central1",
  "authentication": {
    "type": "service_account",
    "keyFile": "/app/config/service-account.json"
  },
  "responseOptimization": {
    "enabled": true,
    "tokenLimit": 500,
    "cacheEnabled": true,
    "cacheTtl": 300
  },
  "qdrant": {
    "url": "http://qdrant-cluster:6333",
    "collection": "dataproc_responses_prod",
    "vectorSize": 384,
    "distanceMetric": "Cosine",
    "maxPoints": 100000,
    "cleanupEnabled": true,
    "cleanupInterval": 3600000
  },
  "performance": {
    "maxConcurrentRequests": 100,
    "requestTimeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "monitoring": {
    "metricsEnabled": true,
    "healthCheckEnabled": true,
    "logLevel": "warn"
  }
}
```

## Performance Tuning

### 1. Memory Optimization

```bash
# Node.js memory settings
NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"

# Qdrant memory settings
QDRANT__STORAGE__MEMORY__VECTORS_MEMORY_THRESHOLD=0.7
QDRANT__STORAGE__MEMORY__PAYLOAD_MEMORY_THRESHOLD=0.3
```

### 2. CPU Optimization

```yaml
# Docker resource limits
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 3. Network Optimization

```nginx
# nginx.conf
upstream dataproc_mcp {
    least_conn;
    server dataproc-mcp-1:3000 max_fails=3 fail_timeout=30s;
    server dataproc-mcp-2:3000 max_fails=3 fail_timeout=30s;
    server dataproc-mcp-3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name dataproc-mcp.example.com;

    # Connection pooling
    keepalive_timeout 65;
    keepalive_requests 100;

    # Compression
    gzip on;
    gzip_types application/json text/plain;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://dataproc_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
```

## Monitoring and Alerting

### 1. Health Checks

```typescript
// Health check endpoints
GET /health      // Basic health check
GET /ready       // Readiness check
GET /metrics     // Prometheus metrics
```

### 2. Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'dataproc-mcp'
    static_configs:
      - targets: ['dataproc-mcp:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'qdrant'
    static_configs:
      - targets: ['qdrant:6333']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 3. Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Dataproc MCP Server",
    "panels": [
      {
        "title": "Response Optimization Metrics",
        "targets": [
          {
            "expr": "rate(response_optimization_tokens_saved_total[5m])",
            "legendFormat": "Tokens Saved/sec"
          },
          {
            "expr": "response_optimization_reduction_percentage",
            "legendFormat": "Reduction %"
          }
        ]
      },
      {
        "title": "Qdrant Performance",
        "targets": [
          {
            "expr": "rate(qdrant_collections_points_total[5m])",
            "legendFormat": "Points/sec"
          },
          {
            "expr": "qdrant_collections_vectors_count",
            "legendFormat": "Total Vectors"
          }
        ]
      }
    ]
  }
}
```

### 4. Alerting Rules

```yaml
# alerts.yml
groups:
  - name: dataproc-mcp
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: QdrantDown
        expr: up{job="qdrant"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Qdrant is down"

      - alert: OptimizationDisabled
        expr: response_optimization_enabled == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Response optimization is disabled"
```

## Security

### 1. Network Security

```yaml
# Network policies for Kubernetes
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dataproc-mcp-policy
  namespace: dataproc-mcp
spec:
  podSelector:
    matchLabels:
      app: dataproc-mcp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: qdrant
    ports:
    - protocol: TCP
      port: 6333
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS to Google Cloud APIs
```

### 2. Secret Management

```yaml
# Kubernetes secrets
apiVersion: v1
kind: Secret
metadata:
  name: dataproc-mcp-secrets
  namespace: dataproc-mcp
type: Opaque
data:
  service-account.json: <base64-encoded-service-account>
  qdrant-api-key: <base64-encoded-api-key>

---
# Mount secrets in deployment
spec:
  template:
    spec:
      containers:
      - name: dataproc-mcp
        volumeMounts:
        - name: secrets
          mountPath: /app/secrets
          readOnly: true
      volumes:
      - name: secrets
        secret:
          secretName: dataproc-mcp-secrets
```

## Scaling

### 1. Horizontal Scaling

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dataproc-mcp-hpa
  namespace: dataproc-mcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dataproc-mcp
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 2. Vertical Scaling

```yaml
# Vertical Pod Autoscaler
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: dataproc-mcp-vpa
  namespace: dataproc-mcp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dataproc-mcp
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: dataproc-mcp
      maxAllowed:
        cpu: 2
        memory: 2Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

## Backup and Recovery

### 1. Qdrant Backup

```bash
#!/bin/bash
# backup-qdrant.sh

BACKUP_DIR="/backups/qdrant/$(date +%Y%m%d_%H%M%S)"
QDRANT_URL="http://qdrant:6333"
COLLECTION="dataproc_responses_prod"

# Create snapshot
curl -X POST "${QDRANT_URL}/collections/${COLLECTION}/snapshots"

# Download snapshot
SNAPSHOT_NAME=$(curl -s "${QDRANT_URL}/collections/${COLLECTION}/snapshots" | jq -r '.result[-1].name')
curl -o "${BACKUP_DIR}/${SNAPSHOT_NAME}" "${QDRANT_URL}/collections/${COLLECTION}/snapshots/${SNAPSHOT_NAME}"

# Cleanup old snapshots (keep last 7 days)
find /backups/qdrant -type d -mtime +7 -exec rm -rf {} \;
```

### 2. Configuration Backup

```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/backups/config/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

# Backup configurations
cp -r /app/config "${BACKUP_DIR}/"
cp -r /app/profiles "${BACKUP_DIR}/"

# Backup Kubernetes manifests
kubectl get all -n dataproc-mcp -o yaml > "${BACKUP_DIR}/k8s-manifests.yaml"
```

## Troubleshooting

### Common Production Issues

1. **High Memory Usage**
   - Check Qdrant vector count
   - Enable cleanup policies
   - Reduce vector size

2. **Slow Response Times**
   - Monitor Qdrant performance
   - Check network latency
   - Scale horizontally

3. **Optimization Not Working**
   - Verify Qdrant connectivity
   - Check configuration
   - Review logs

### Debug Commands

```bash
# Check service health
kubectl get pods -n dataproc-mcp
kubectl logs -f deployment/dataproc-mcp -n dataproc-mcp

# Check Qdrant status
curl http://qdrant:6333/health
curl http://qdrant:6333/collections/dataproc_responses_prod

# Performance metrics
curl http://dataproc-mcp:3000/metrics
```

---

**🏭 Deploy with confidence using production-ready configurations and monitoring!**