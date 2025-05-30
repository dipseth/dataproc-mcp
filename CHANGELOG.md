# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-29

### Added
- **Production-ready npm package configuration**
  - Removed private flag for public distribution
  - Added comprehensive package metadata and keywords
  - Enhanced npm scripts for development and production use
  - Added engines requirement for Node.js >=18.0.0

- **Automated setup and installation**
  - Interactive setup script (`npm run setup`)
  - Post-install script for automatic directory creation
  - Configuration validation script (`npm run validate`)
  - Template configuration files for easy setup

- **Enhanced development tooling**
  - ESLint and Prettier configuration
  - Test coverage reporting with nyc
  - Security audit scripts
  - Automated formatting and linting

- **Template configurations**
  - `templates/default-params.json.template` - Default parameter configuration
  - `templates/server.json.template` - Server configuration with authentication
  - `templates/mcp-settings.json.template` - MCP client settings template

- **Open source preparation**
  - MIT License
  - Comprehensive CHANGELOG.md
  - Production readiness plan documentation

### Changed
- **Package name**: Changed from `dataproc-server` to `@dataproc/mcp-server`
- **Version**: Bumped to 1.0.0 for production release
- **Files included**: Expanded to include templates, scripts, and documentation

### Enhanced
- **Smart default parameter management** (existing feature)
  - Intelligent parameter injection for common parameters
  - Multi-environment support
  - Backward compatibility with explicit parameters

- **Comprehensive toolset** (existing feature)
  - 16 tools covering cluster management and job execution
  - MCP resource exposure for configuration access
  - Environment-independent authentication

### Security
- **Enhanced input validation** preparation
- **Credential sanitization** framework
- **Security audit integration**

## [0.3.0] - 2025-05-29

### Added
- Default parameter management system
- Resource exposure via MCP protocol
- Service account impersonation support

### Enhanced
- Authentication strategy with fallback mechanisms
- Performance improvements (53-58% faster operations)
- Comprehensive testing infrastructure

## [0.1.0] - Initial Release

### Added
- Basic MCP server for Google Cloud Dataproc
- Cluster creation and management tools
- Hive query execution
- Profile-based cluster configuration
- Basic authentication support

---

## Upcoming Features

### [1.1.0] - Planned
- Enhanced security features
- Rate limiting implementation
- Advanced monitoring and logging
- Performance optimizations

### [1.2.0] - Planned
- CI/CD pipeline integration
- Automated testing enhancements
- Community contribution guidelines
- Documentation website

### [2.0.0] - Future
- Breaking changes for improved API design
- Advanced cluster management features
- Multi-cloud support exploration
- Enterprise features
