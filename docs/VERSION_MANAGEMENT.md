# Version Management Guide 📋

This document outlines the versioning strategy, migration guidelines, and backward compatibility approach for the Dataproc MCP Server.

## Semantic Versioning Strategy

The Dataproc MCP Server follows [Semantic Versioning 2.0.0](https://semver.org/) with the format `MAJOR.MINOR.PATCH`:

### Version Format: `X.Y.Z`

- **MAJOR (X)**: Breaking changes that require user action
- **MINOR (Y)**: New features that are backward compatible
- **PATCH (Z)**: Bug fixes and security updates

### Version Examples

```
1.0.0 - Initial stable release
1.1.0 - Added new MCP tools (backward compatible)
1.1.1 - Bug fixes and performance improvements
2.0.0 - Breaking changes to tool interfaces
```

## Version Categories

### 🔴 Major Version (Breaking Changes)
Increment when making incompatible API changes:

- **Tool Interface Changes**: Modifying required parameters or response formats
- **Configuration Breaking Changes**: Changing config file structure
- **Authentication Changes**: Modifying authentication methods
- **Dependency Updates**: Major dependency updates that affect compatibility

**Example Breaking Changes:**
```typescript
// v1.x.x - Old interface
{
  name: "start_dataproc_cluster",
  arguments: {
    clusterName: "my-cluster",
    projectId: "my-project"
  }
}

// v2.0.0 - New interface (breaking)
{
  name: "start_dataproc_cluster", 
  arguments: {
    cluster: {
      name: "my-cluster",
      projectId: "my-project",
      region: "us-central1" // Now required
    }
  }
}
```

### 🟡 Minor Version (New Features)
Increment when adding functionality in a backward compatible manner:

- **New MCP Tools**: Adding new tools without changing existing ones
- **Optional Parameters**: Adding optional parameters to existing tools
- **Enhanced Features**: Improving existing functionality without breaking changes
- **New Configuration Options**: Adding optional configuration settings

**Example New Features:**
```typescript
// v1.1.0 - Added optional parameter
{
  name: "start_dataproc_cluster",
  arguments: {
    clusterName: "my-cluster",
    projectId: "my-project",
    enableAutoScaling: true // New optional parameter
  }
}
```

### 🟢 Patch Version (Bug Fixes)
Increment when making backward compatible bug fixes:

- **Bug Fixes**: Fixing incorrect behavior
- **Security Patches**: Addressing security vulnerabilities
- **Performance Improvements**: Optimizing existing functionality
- **Documentation Updates**: Improving documentation without code changes

## Migration Guides

### Migration Documentation Structure

Each major version includes a comprehensive migration guide:

```
docs/migrations/
├── v1-to-v2.md
├── v2-to-v3.md
└── migration-template.md
```

### Migration Guide Template

```markdown
# Migration Guide: v1.x.x to v2.0.0

## Overview
Brief description of major changes and why they were made.

## Breaking Changes

### 1. Tool Interface Changes
- **Affected Tools**: List of modified tools
- **Change Description**: What changed and why
- **Migration Steps**: Step-by-step migration instructions
- **Code Examples**: Before and after code samples

### 2. Configuration Changes
- **Affected Files**: Configuration files that need updates
- **Required Actions**: What users need to do
- **Migration Script**: Automated migration tools if available

## New Features
List of new features available in this version.

## Deprecated Features
Features marked for removal in future versions.

## Timeline
- **Release Date**: When the new version was released
- **Support Timeline**: How long the old version will be supported
```

### Example Migration Guide

**File: `docs/migrations/v1-to-v2.md`**
```markdown
# Migration Guide: v1.x.x to v2.0.0

## Overview
Version 2.0.0 introduces a unified cluster configuration interface and enhanced parameter validation.

## Breaking Changes

### 1. Cluster Creation Interface
**Affected Tools**: `start_dataproc_cluster`, `create_dataproc_cluster`

**Before (v1.x.x):**
```typescript
{
  name: "start_dataproc_cluster",
  arguments: {
    clusterName: "my-cluster",
    projectId: "my-project",
    region: "us-central1",
    zone: "us-central1-a"
  }
}
```

**After (v2.0.0):**
```typescript
{
  name: "start_dataproc_cluster",
  arguments: {
    cluster: {
      name: "my-cluster",
      projectId: "my-project",
      location: {
        region: "us-central1",
        zone: "us-central1-a"
      }
    }
  }
}
```

**Migration Steps:**
1. Update all cluster creation calls to use the new `cluster` object structure
2. Move `region` and `zone` parameters into the `location` object
3. Test cluster creation with the new interface

### 2. Configuration File Changes
**Affected Files**: `config/server.json`, `config/default-params.json`

**Required Actions:**
1. Update authentication configuration structure
2. Migrate profile manager settings
3. Run the migration script: `npm run migrate-config`

## Migration Script
```bash
# Automated migration tool
npm run migrate-v1-to-v2

# Manual verification
npm run validate-config
```
```

## Deprecation Warnings

### Deprecation Strategy

1. **Advance Notice**: Announce deprecations at least one minor version before removal
2. **Warning Messages**: Log deprecation warnings when deprecated features are used
3. **Documentation**: Clearly mark deprecated features in documentation
4. **Migration Path**: Provide clear migration instructions

### Deprecation Implementation

```typescript
// Example deprecation warning
function deprecatedFunction(param: string) {
  console.warn(
    'DEPRECATION WARNING: This function is deprecated and will be removed in v3.0.0. ' +
    'Please use newFunction() instead. See migration guide: https://docs.example.com/migrate'
  );
  
  // Continue with existing functionality
  return legacyImplementation(param);
}
```

### Deprecation Timeline

```
Version 1.5.0: Feature marked as deprecated
Version 2.0.0: Feature still available with warnings
Version 3.0.0: Feature removed (breaking change)
```

## Backward Compatibility

### Compatibility Matrix

| Version | Node.js | MCP SDK | Google Cloud SDK |
|---------|---------|---------|------------------|
| 1.0.x   | 18+     | 0.4.x   | Latest           |
| 1.1.x   | 18+     | 0.5.x   | Latest           |
| 2.0.x   | 18+     | 1.0.x   | Latest           |

### Compatibility Guidelines

#### 🟢 **Maintain Compatibility**
- **Optional Parameters**: Always make new parameters optional
- **Response Extensions**: Add new fields to responses without removing existing ones
- **Configuration**: Support both old and new configuration formats during transition
- **Error Handling**: Maintain existing error codes and messages

#### 🟡 **Graceful Degradation**
- **Feature Detection**: Check for feature availability before using
- **Fallback Mechanisms**: Provide fallbacks for new features
- **Progressive Enhancement**: Enhance functionality without breaking existing usage

#### 🔴 **Breaking Changes (Major Version Only)**
- **Interface Changes**: Modify tool interfaces only in major versions
- **Dependency Updates**: Major dependency updates that affect compatibility
- **Architecture Changes**: Fundamental changes to server architecture

### Compatibility Testing

```typescript
// Example compatibility test
describe('Backward Compatibility', () => {
  it('should support v1.x.x cluster creation format', async () => {
    const legacyRequest = {
      name: "start_dataproc_cluster",
      arguments: {
        clusterName: "test-cluster",
        projectId: "test-project"
      }
    };
    
    const result = await mcpServer.callTool(legacyRequest);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

## Version Release Process

### 1. Pre-Release Checklist
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new features and breaking changes
- [ ] Create migration guide if breaking changes exist
- [ ] Update documentation with new features
- [ ] Run full test suite including compatibility tests
- [ ] Update version compatibility matrix

### 2. Release Types

#### Alpha Releases (`1.0.0-alpha.1`)
- **Purpose**: Early testing of major changes
- **Audience**: Maintainers and early adopters
- **Stability**: Unstable, breaking changes expected

#### Beta Releases (`1.0.0-beta.1`)
- **Purpose**: Feature-complete testing
- **Audience**: Beta testers and integration partners
- **Stability**: Feature-complete but may have bugs

#### Release Candidates (`1.0.0-rc.1`)
- **Purpose**: Final testing before stable release
- **Audience**: Production users for final validation
- **Stability**: Production-ready, minimal changes expected

#### Stable Releases (`1.0.0`)
- **Purpose**: Production use
- **Audience**: All users
- **Stability**: Stable and supported

### 3. Release Automation

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build package
        run: npm run build
      - name: Create release
        uses: semantic-release/semantic-release@v22
```

## Support Timeline

### Long Term Support (LTS)

| Version | Release Date | End of Life | Support Type |
|---------|-------------|-------------|--------------|
| 1.0.x   | 2025-01-01  | 2026-01-01  | Security only |
| 2.0.x   | 2025-06-01  | 2026-06-01  | Full support |
| 3.0.x   | 2025-12-01  | 2026-12-01  | Full support |

### Support Levels

#### 🟢 **Full Support**
- New features and enhancements
- Bug fixes and performance improvements
- Security updates
- Documentation updates

#### 🟡 **Maintenance Support**
- Critical bug fixes only
- Security updates
- No new features

#### 🔴 **Security Support**
- Security updates only
- No bug fixes or new features

## Version Documentation

### Changelog Format

```markdown
# Changelog

## [2.0.0] - 2025-06-01

### Added
- New cluster autoscaling configuration
- Enhanced error handling and validation
- Support for custom machine types

### Changed
- **BREAKING**: Unified cluster configuration interface
- Improved performance for large clusters
- Updated dependencies to latest versions

### Deprecated
- Legacy cluster creation interface (use new unified interface)

### Removed
- **BREAKING**: Removed deprecated authentication methods

### Fixed
- Fixed cluster deletion timeout issues
- Resolved memory leaks in long-running operations

### Security
- Updated authentication token validation
- Enhanced input sanitization
```

### Version Badge Integration

```markdown
[![npm version](https://badge.fury.io/js/%40dataproc%2Fmcp-server.svg)](https://badge.fury.io/js/%40dataproc%2Fmcp-server)
[![Downloads](https://img.shields.io/npm/dm/@dataproc/mcp-server.svg)](https://npmjs.org/package/@dataproc/mcp-server)
[![Build Status](https://github.com/dipseth/dataproc-mcp/workflows/CI/badge.svg)](https://github.com/dipseth/dataproc-mcp/actions)
```

This comprehensive version management strategy ensures smooth upgrades, clear communication of changes, and maintains backward compatibility while allowing for necessary evolution of the Dataproc MCP Server.