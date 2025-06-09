# 🚀 Feature Request: Integrate HTTP-Stream MCP Transport

## 📝 **Summary**
Integrate HTTP-streaming transport from `feature/hybrid-mcp-transport` branch into `main` to enable dual-mode MCP server (STDIO + HTTP) for better VS Code integration and real-time progress updates.

## 🎯 **Motivation**
- **VS Code Integration**: HTTP transport works better with VS Code MCP extensions
- **Real-time Updates**: Enable chunked responses and Server-Sent Events
- **Development Experience**: HTTP allows easier debugging and testing
- **Backward Compatibility**: Maintain existing STDIO functionality

## ✅ **Current Status**
- HTTP server successfully runs on port 8080
- 15 tools auto-discovered and loaded via `mcp-framework@0.2.13`
- Basic tools (`list_profiles`, `get_cluster`) working
- All core services (Qdrant, auth, etc.) initialize correctly

## ⚠️ **Issues to Resolve**
- `list_clusters` and `delete_cluster` fail with "defaultParamManager undefined"
- Some tool validation schemas not receiving default parameters
- Tool file conflicts (`.bak` files from reorganization)

## 🏗️ **Architecture Overview**

### **Current (Main Branch)**
```typescript
// Single STDIO server
node build/index.js
```

### **Proposed (After Integration)**
```typescript
// Option 1: STDIO (existing)
node build/index.js

// Option 2: HTTP (new)  
node build/mcp-framework-server.js --http --port 8080
```

## 🔧 **Key Changes Required**

### **1. Dependencies**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1", // upgrade from 0.6.1
    "mcp-framework": "^0.2.13",             // new
    "express": "^4.18.2",                   // new
    "cors": "^2.8.5",                       // new
    "helmet": "^7.1.0"                      // new
  }
}
```

### **2. New Files to Add**
- `src/mcp-framework-server.ts` - HTTP server entry point
- `src/transport/` - Transport abstraction layer
- `src/http/` - HTTP server implementation
- `src/tools/*Tool.ts` - Framework-compatible tool classes

### **3. Fix Parameter Management**
```typescript
// Ensure all tools receive defaultParamManager
if (!deps.defaultParamManager) {
  throw new Error('Default parameter manager is required');
}
```

## 🛠️ **Implementation Strategy**

### **Phase 1: Foundation (2-3 days)**
- [ ] Merge new dependencies
- [ ] Add transport and HTTP directories
- [ ] Add framework server file
- [ ] Update build process

### **Phase 2: Tool Compatibility (3-4 days)**
- [ ] Maintain legacy tool structure for STDIO
- [ ] Add framework tool classes for HTTP
- [ ] Create compatibility bridge
- [ ] Fix parameter injection

### **Phase 3: Configuration (1-2 days)**
- [ ] Unified config for both modes
- [ ] Fix default parameter propagation
- [ ] Environment variable support

### **Phase 4: Testing (2-3 days)**
- [ ] Test STDIO mode (no regressions)
- [ ] Test HTTP mode (all tools work)
- [ ] Integration tests
- [ ] Update documentation

## ✅ **Success Criteria**
- [ ] STDIO mode works unchanged (backward compatibility)
- [ ] HTTP mode serves all 15 tools correctly
- [ ] `list_clusters` and `delete_cluster` work in HTTP mode
- [ ] Single configuration supports both modes
- [ ] Documentation updated with dual-mode usage

## 🧪 **Testing Plan**
```bash
# Test STDIO mode
node build/index.js
# (Test with existing MCP clients)

# Test HTTP mode  
node build/mcp-framework-server.js --http
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 📋 **Validation Checklist**
- [ ] All existing functionality preserved
- [ ] HTTP server starts successfully  
- [ ] Tool auto-discovery works
- [ ] Parameter validation fixed
- [ ] Qdrant integration works
- [ ] Authentication works for both modes
- [ ] Performance acceptable

## 🔗 **Related Files**
- Main implementation: `feature/hybrid-mcp-transport` branch
- Detailed plan: `INTEGRATION_PLAN.md`
- Architecture docs: `HYBRID_MCP_TRANSPORT_PLAN.md`

## 🏷️ **Labels**
`enhancement` `http-transport` `mcp` `integration` `high-priority`

## 📅 **Timeline**
**Target**: ~8-12 days for complete integration
**Priority**: High (enables better VS Code integration)

---

**Note**: This maintains 100% backward compatibility while adding powerful new HTTP capabilities for modern MCP workflows.
