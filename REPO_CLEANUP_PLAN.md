# Dataproc MCP Server Repository Cleanup Plan

This document outlines a comprehensive plan for cleaning up and reorganizing the Dataproc MCP Server repository to improve maintainability, clarity, and developer experience.

## Current Structure Issues

The current repository structure has several issues that need to be addressed:

1. **Mixed Configuration Files**: Server settings and cluster profiles are spread across different directories (`config/` and `configs/`).
2. **Unclear Separation of Concerns**: There's no clear distinction between server settings, user profiles, and documentation.
3. **Inconsistent Directory Naming**: Using both singular (`config/`) and plural (`configs/`) for configuration directories.
4. **Scattered Examples**: Example files are not well-organized and could be better categorized.
5. **Build Output in Version Control**: The `build/` directory with compiled JavaScript is tracked in version control.

## Proposed Directory Structure

```
/dataproc-server/
├── config/                     # Server configuration
│   ├── server.json             # Main server configuration
│   └── credentials/            # Credentials and secrets (gitignored)
│       └── .gitkeep
│
├── profiles/                   # Cluster configuration profiles
│   ├── development/            # Development environment profiles
│   │   ├── small.yaml          # Small development cluster
│   │   └── standard.yaml       # Standard development cluster
│   ├── production/             # Production environment profiles
│   │   ├── high-memory/        # Specialized production profiles
│   │   │   └── analysis.yaml   # High-memory analysis cluster
│   │   └── high-cpu/
│   │       └── processing.yaml # High-CPU processing cluster
│   └── testing/                # Testing environment profiles
│       └── integration.yaml    # Integration testing cluster
│
├── docs/                       # Documentation
│   ├── design.md               # System design documentation
│   ├── api.md                  # API documentation
│   ├── profiles.md             # Profile configuration guide
│   └── examples/               # Example documentation
│       ├── queries/            # Example queries
│       │   ├── hive-examples.md
│       │   └── spark-examples.md
│       └── configs/            # Example configurations
│           ├── cluster-config-template.yaml
│           └── specialized-configs/
│               └── spark-config.yaml
│
├── src/                        # Source code
│   ├── config/                 # Configuration handling
│   ├── services/               # Core services
│   └── types/                  # TypeScript type definitions
│
├── state/                      # State storage (gitignored)
│   └── .gitkeep
│
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
│
├── .vscode/                    # VS Code configuration
│   └── tasks.json              # VS Code tasks
│
├── .gitignore                  # Git ignore file
├── mcp_settings.json           # MCP server settings
├── package.json                # NPM package file
├── package-lock.json           # NPM lock file
├── README.md                   # Project README
├── REPO_CLEANUP_PLAN.md        # This cleanup plan
└── tsconfig.json               # TypeScript configuration
```

## Cleanup Tasks

### 1. Configuration Reorganization

- [x] Rename `configs/` to `profiles/` to better reflect its purpose
- [ ] Move server configuration from `config/dataproc-server.json` to `config/server.json`
- [ ] Create a `config/credentials/` directory for sensitive information (with proper gitignore)
- [ ] Update all code references to configuration paths

### 2. Documentation Improvements

- [ ] Move example files from `examples/` to `docs/examples/`
- [ ] Categorize examples into `docs/examples/queries/` and `docs/examples/configs/`
- [ ] Create additional documentation files:
  - [ ] `docs/api.md` for API documentation
  - [ ] `docs/profiles.md` for profile configuration guide

### 3. Code Organization

- [ ] Create a `tests/` directory with `unit/` and `integration/` subdirectories
- [ ] Move test scripts from the root directory to appropriate test directories
- [ ] Ensure build output (`build/`) is properly gitignored

### 4. State Management

- [ ] Ensure `state/` directory is properly gitignored but tracked with a `.gitkeep` file
- [ ] Update state file path references in code

### 5. Configuration Updates

- [ ] Update `mcp_settings.json` to reflect new directory structure
- [ ] Update `package.json` scripts to work with new directory structure
- [ ] Update `.vscode/tasks.json` if needed

## Implementation Strategy

The implementation of this cleanup plan should be done in phases to minimize disruption:

1. **Phase 1: Documentation and Planning**
   - Create this cleanup plan document
   - Update README.md to reflect the proposed structure
   - Create any new documentation files

2. **Phase 2: Directory Structure**
   - Create new directories
   - Move files to their new locations
   - Update gitignore rules

3. **Phase 3: Configuration Updates**
   - Update configuration files to reflect new paths
   - Update code references to configuration paths

4. **Phase 4: Testing**
   - Ensure all functionality works with the new structure
   - Run tests to verify everything works as expected

5. **Phase 5: Cleanup**
   - Remove old directories and files
   - Final verification of functionality

## Benefits

This reorganization will provide several benefits:

1. **Improved Clarity**: Clear separation between server settings, user profiles, and documentation
2. **Better Organization**: Logical grouping of related files
3. **Enhanced Maintainability**: Easier to find and update files
4. **Improved Developer Experience**: More intuitive directory structure
5. **Better Security**: Proper handling of sensitive information

## Backward Compatibility

To maintain backward compatibility during the transition:

1. Support both old and new paths for a deprecation period
2. Add clear warnings when old paths are used
3. Provide documentation on how to migrate to the new structure