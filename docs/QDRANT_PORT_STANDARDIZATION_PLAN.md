# Qdrant Port Standardization Plan

## Problem Statement

**Root Cause Identified**: Port configuration mismatch causing Qdrant storage failures
- KnowledgeIndexer stores data successfully on port 6333
- SemanticQueryService tries to retrieve data from port 6334 (no service running)
- Result: Data stored but inaccessible, causing "No results found" errors

## Current State Analysis

### Port Usage Discovered:
- **Port 6333**: ✅ Active Qdrant service with `dataproc_knowledge` collection
- **Port 6334**: ❌ No service running (config example shows this port)
- **Port 6335**: ✅ Active Qdrant service with `dataproc_knowledge` collection

### Services Using Different Ports:
1. **KnowledgeIndexer**: `http://localhost:6333` (working)
2. **SemanticQueryService**: `http://localhost:6334` (failing)
3. **QdrantStorageService**: Various hardcoded defaults
4. **ResponseFilter**: Uses QdrantManager with port 6333

## Solution Design

### 1. Centralized Qdrant Configuration Service

Create a `QdrantConnectionManager` that:
- Attempts connection to multiple ports in priority order
- Records which port successfully connects
- Provides a single source of truth for Qdrant URL
- Handles connection failures gracefully

### 2. Port Discovery Strategy

**Priority Order for Port Discovery:**
1. Environment variable: `QDRANT_URL` or `QDRANT_PORT`
2. Configuration file setting
3. Auto-discovery: Try ports [6333, 6335, 6334] in order
4. Fallback to QdrantManager auto-start on preferred port

### 3. Implementation Plan

#### Phase 1: Create Centralized Manager
```typescript
class QdrantConnectionManager {
  private static instance: QdrantConnectionManager;
  private discoveredUrl: string | null = null;
  private connectionTested = false;

  async discoverQdrantUrl(): Promise<string | null> {
    // Try environment variable first
    // Try configuration file
    // Auto-discover working port
    // Cache result for reuse
  }

  getQdrantUrl(): string | null {
    return this.discoveredUrl;
  }
}
```

#### Phase 2: Update All Services
- **KnowledgeIndexer**: Use centralized manager
- **SemanticQueryService**: Use centralized manager  
- **QdrantStorageService**: Accept URL from manager
- **ResponseFilter**: Integrate with manager

#### Phase 3: Configuration Updates
- Update config examples to use environment variables
- Add Qdrant connection settings to server configuration
- Document port discovery process

## Implementation Steps

### Step 1: Create QdrantConnectionManager
- [ ] Create `src/services/qdrant-connection-manager.ts`
- [ ] Implement port discovery logic
- [ ] Add connection testing and caching
- [ ] Add proper error handling and logging

### Step 2: Update Service Constructors
- [ ] Modify KnowledgeIndexer to use manager
- [ ] Modify SemanticQueryService to use manager
- [ ] Update QdrantStorageService constructor
- [ ] Update ResponseFilter initialization

### Step 3: Configuration Integration
- [ ] Add Qdrant settings to server configuration schema
- [ ] Update config examples with environment variables
- [ ] Add validation for Qdrant configuration

### Step 4: Error Handling Improvements
- [ ] Fix empty object `{}` error serialization
- [ ] Add detailed connection error messages
- [ ] Implement graceful degradation when Qdrant unavailable

## Configuration Schema

```json
{
  "qdrant": {
    "url": "${QDRANT_URL:-auto-discover}",
    "ports": [6333, 6335, 6334],
    "collectionName": "dataproc_knowledge",
    "vectorSize": 384,
    "distance": "Cosine",
    "connectionTimeout": 5000,
    "retryAttempts": 3
  }
}
```

## Environment Variables

```bash
# Primary configuration
QDRANT_URL=http://localhost:6333

# Alternative port-only configuration  
QDRANT_PORT=6333

# Collection configuration
QDRANT_COLLECTION=dataproc_knowledge
```

## Testing Strategy

### Validation Tests:
1. **Port Discovery Test**: Verify manager finds working port
2. **Service Integration Test**: All services use same URL
3. **Fallback Test**: Graceful handling when no Qdrant available
4. **Configuration Test**: Environment variables override defaults

### Success Criteria:
- [ ] All services connect to same Qdrant instance
- [ ] Port discovery works across different environments
- [ ] Clear error messages when Qdrant unavailable
- [ ] Configuration is centralized and consistent

## Rollback Plan

If issues arise:
1. Revert to hardcoded port 6333 for all services
2. Keep centralized manager but disable auto-discovery
3. Use environment variable override as safety net

## Documentation Updates

- [ ] Update QUICK_START.md with Qdrant setup
- [ ] Update CONFIGURATION_GUIDE.md with new settings
- [ ] Add troubleshooting section for Qdrant connectivity
- [ ] Update API documentation for configuration options

---

**Next Action**: Implement QdrantConnectionManager and update SemanticQueryService as immediate fix.