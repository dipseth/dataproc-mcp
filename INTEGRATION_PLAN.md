# Integration Plan: HTTP-Stream MCP Transport into Main Branch

## 🎯 **Objective**
Integrate the HTTP-streaming MCP transport functionality from the `feature/hybrid-mcp-transport` branch into the `main` branch to enable both STDIO and HTTP transport modes for the Dataproc MCP server.

## 📊 **Current Status Assessment**

### ✅ **What's Working**
- **HTTP MCP Server**: Successfully starts and runs on port 8080
- **Tool Discovery**: Auto-discovers and loads 15 tools correctly
- **Basic Tools**: `list_profiles`, `get_cluster` work with default parameters
- **MCP Framework Integration**: Using `mcp-framework@0.2.13` for tool auto-discovery
- **Qdrant Integration**: Successfully connects to Qdrant on port 6333
- **Service Initialization**: All core services initialize properly

### ⚠️ **Issues Identified**
- **Parameter Validation**: Some tools (`list_clusters`, `delete_cluster`) fail with "defaultParamManager" undefined
- **Tool Files**: Original tool files moved to `.bak` but may cause loading conflicts
- **Configuration**: Default parameters not properly propagated to all tool validation schemas

## 🏗️ **Architecture Analysis**

### **Main Branch (Current)**
- **Transport**: STDIO only (`@modelcontextprotocol/sdk/server/stdio`)
- **Tool Structure**: Organized tool files (`cluster-tools.ts`, `job-tools.ts`, etc.)
- **Server Entry**: `src/index.ts` - Single MCP server with STDIO
- **MCP SDK**: Version `^0.6.1`

### **Feature Branch (New)**
- **Transport**: Dual mode (STDIO + HTTP via `mcp-framework`)
- **Tool Structure**: Individual tool classes (`StartDataprocClusterTool.ts`, etc.)
- **Server Entry**: 
  - `src/index.ts` - Original STDIO server (maintained)
  - `src/mcp-framework-server.ts` - New HTTP server
- **MCP SDK**: Version `^1.12.1`
- **New Dependencies**: `mcp-framework@0.2.13`, `express`, `cors`, `helmet`

## 🔧 **Key Differences**

### **1. Tool Architecture**
```typescript
// Main Branch: Organized tool collections
export const clusterTools = [...];
export const jobTools = [...];

// Feature Branch: Individual tool classes
export class StartDataprocClusterTool extends Tool {
  // MCP Framework-compatible tool
}
```

### **2. Server Architecture**
```typescript
// Main Branch: Single server
const server = new Server(...);
server.connect(new StdioServerTransport());

// Feature Branch: Dual servers
// Option 1: node build/index.js (STDIO)
// Option 2: node build/mcp-framework-server.js --http (HTTP)
```

### **3. Dependencies**
```json
// Main Branch
"@modelcontextprotocol/sdk": "^0.6.1"

// Feature Branch (Additional)
"@modelcontextprotocol/sdk": "^1.12.1",
"mcp-framework": "^0.2.13",
"express": "^4.18.2",
"cors": "^2.8.5",
"helmet": "^7.1.0"
```

## 🚀 **Integration Strategy**

### **Phase 1: Foundation** 
1. **Merge Dependencies**: Update `package.json` with new dependencies
2. **Add Transport Layer**: Integrate `src/transport/` directory
3. **Add HTTP Server**: Integrate `src/http/` directory
4. **Update Build**: Ensure both servers build correctly

### **Phase 2: Tool Compatibility**
1. **Maintain Legacy Tools**: Keep existing tool structure for STDIO
2. **Add Framework Tools**: Add new tool classes for HTTP mode
3. **Shared Services**: Ensure services work with both architectures
4. **Parameter Management**: Fix default parameter propagation

### **Phase 3: Configuration**
1. **Unified Config**: Make configuration work for both modes
2. **Default Parameters**: Fix parameter injection for HTTP tools
3. **Environment Variables**: Support env-based configuration

### **Phase 4: Testing & Documentation**
1. **Test Both Modes**: Ensure STDIO and HTTP both work
2. **Update Documentation**: Document dual-mode usage
3. **Integration Tests**: Verify tool compatibility

## 🛠️ **Implementation Plan**

### **Step 1: Prepare Main Branch**
```bash
# Switch to main and create integration branch
git checkout main
git checkout -b feature/integrate-http-transport
```

### **Step 2: Selective Merge**
```bash
# Add new files without conflicts
git checkout feature/hybrid-mcp-transport -- src/transport/
git checkout feature/hybrid-mcp-transport -- src/http/
git checkout feature/hybrid-mcp-transport -- src/mcp-framework-server.ts
```

### **Step 3: Tool Architecture Bridge**
Create compatibility layer:
```typescript
// src/tools/framework-adapter.ts
export function adaptLegacyTools(legacyTools: LegacyTool[]): McpFrameworkTool[] {
  // Convert legacy tools to framework-compatible tools
}
```

### **Step 4: Configuration Fix**
Update default parameter management:
```typescript
// Ensure defaultParamManager is available to all tools
export class ToolBase {
  constructor(protected deps: AllHandlerDependencies) {
    if (!deps.defaultParamManager) {
      throw new Error('Default parameter manager is required');
    }
  }
}
```

### **Step 5: Update Scripts**
```json
{
  "scripts": {
    "start": "node build/index.js",
    "start:http": "node build/mcp-framework-server.js --http",
    "start:stdio": "node build/index.js"
  }
}
```

## 🔍 **Validation Checklist**

### **STDIO Mode (Existing)**
- [ ] All existing tools work unchanged
- [ ] Default parameters work correctly  
- [ ] Cluster operations complete successfully
- [ ] Integration tests pass

### **HTTP Mode (New)**
- [ ] Server starts on port 8080
- [ ] All 15 tools load correctly
- [ ] `list_profiles` works
- [ ] `get_cluster` works with defaults
- [ ] `list_clusters` works (fix defaultParamManager)
- [ ] `delete_cluster` works (fix validation)

### **Configuration**
- [ ] `config/server.json` works for both modes
- [ ] Default parameters propagate correctly
- [ ] Environment variables work
- [ ] Authentication works for both modes

## 🐛 **Known Issues to Fix**

### **Critical**
1. **defaultParamManager undefined**: Fix parameter injection in HTTP tools
   ```typescript
   // In tool constructors, ensure deps.defaultParamManager exists
   if (!deps.defaultParamManager) {
     throw new Error('Default parameter manager is required');
   }
   ```

2. **Tool File Conflicts**: Remove `.bak` files or handle them properly
   ```bash
   # Either restore or remove .bak files
   rm src/tools/*.ts.bak
   ```

### **Minor**
1. **Version Alignment**: Ensure MCP SDK versions are compatible
2. **Type Compatibility**: Verify TypeScript types align between modes

## 📋 **Testing Strategy**

### **Unit Tests**
- Test individual tools in both modes
- Test parameter validation
- Test service initialization

### **Integration Tests**  
- Test complete workflows (STDIO)
- Test complete workflows (HTTP)
- Test configuration loading

### **End-to-End Tests**
- Start cluster → Query → Delete (STDIO)
- Start cluster → Query → Delete (HTTP)
- Profile management workflows

## 📚 **Documentation Updates**

### **README.md**
- Add HTTP transport documentation
- Update usage examples
- Add troubleshooting section

### **API Documentation**
- Document HTTP endpoints
- Document STDIO protocol
- Update tool documentation

## 🎉 **Success Criteria**

1. **Backward Compatibility**: Existing STDIO users see no changes
2. **HTTP Functionality**: New HTTP mode works for all tools
3. **Configuration**: Single config works for both modes
4. **Performance**: No performance regression in STDIO mode
5. **Documentation**: Clear guidance for both modes

## 📅 **Timeline Estimate**

- **Phase 1 (Foundation)**: 2-3 days
- **Phase 2 (Tool Compatibility)**: 3-4 days  
- **Phase 3 (Configuration)**: 1-2 days
- **Phase 4 (Testing & Docs)**: 2-3 days

**Total**: ~8-12 days

## 🤝 **Next Steps**

1. **Create GitHub Issue**: Use this plan as the issue template
2. **Team Review**: Get stakeholder approval for approach
3. **Implementation**: Execute phase-by-phase
4. **Code Review**: Thorough review before merging
5. **Release**: Tag as minor version bump (4.2.0 → 4.3.0)

---

*This integration plan maintains backward compatibility while adding powerful new HTTP transport capabilities to the Dataproc MCP server.*
