# 📦 NPM Publishing Setup Guide

This guide explains how to set up automated npm publishing for the Dataproc MCP Server.

## 🔑 Required Secrets

### NPM_TOKEN
The GitHub repository requires an `NPM_TOKEN` secret to publish packages to the npm registry.

#### Steps to Create NPM Token:

1. **Login to NPM**:
   ```bash
   npm login
   ```

2. **Create Access Token**:
   - Go to [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens
   - Click "Generate New Token"
   - Select "Automation" token type
   - Copy the generated token

3. **Add to GitHub Secrets**:
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm token
   - Click "Add secret"

## 🚀 Release Process

### Automated Release (Recommended)

The release process is fully automated using semantic-release:

1. **Commit with Conventional Commits**:
   ```bash
   # For patch release (bug fixes)
   git commit -m "fix: resolve authentication issue"
   
   # For minor release (new features)
   git commit -m "feat: add new cluster management feature"
   
   # For major release (breaking changes)
   git commit -m "feat!: redesign API structure
   
   BREAKING CHANGE: API endpoints have been restructured"
   ```

2. **Push to Main Branch**:
   ```bash
   git push origin main
   ```

3. **Automatic Release**:
   - CI/CD pipeline runs automatically
   - Semantic-release analyzes commits
   - Version is bumped automatically
   - Package is published to npm
   - GitHub release is created
   - Changelog is updated

### Manual Release (Emergency)

For emergency releases or manual control:

1. **Trigger Manual Release**:
   - Go to GitHub Actions → "🚀 Release & Publish"
   - Click "Run workflow"
   - Select release type or use "auto"
   - Optionally enable "dry run" for testing

2. **Local Release (Not Recommended)**:
   ```bash
   # Only use in emergencies
   npm run release:dry    # Test first
   npm run release        # Actual release
   ```

## 📊 Version Management

### Semantic Versioning

The project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features (backward compatible)
- **PATCH** (0.0.X): Bug fixes (backward compatible)

### Commit Types and Version Impact

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | PATCH | `fix: resolve memory leak` |
| `feat:` | MINOR | `feat: add cluster scaling` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | `feat!: redesign API` |
| `perf:` | PATCH | `perf: optimize query parsing` |
| `revert:` | PATCH | `revert: undo previous change` |
| `docs:`, `style:`, `test:`, `ci:` | No release | Documentation/maintenance |

## 🔍 Release Validation

### Automated Checks

Every release goes through:

1. **Quality Gates**:
   - Multi-version Node.js testing (18, 20, 22)
   - TypeScript compilation
   - ESLint and Prettier validation
   - Unit test execution

2. **Security Scanning**:
   - Dependency vulnerability audit
   - Security policy compliance

3. **Build Validation**:
   - Production build creation
   - Package validation
   - Documentation generation

4. **Post-Release Verification**:
   - NPM package availability check
   - Installation testing
   - GitHub release validation

### Manual Verification

After release, verify:

```bash
# Check npm package
npm view @dataproc/mcp-server

# Test installation
npm install @dataproc/mcp-server@latest

# Verify GitHub release
gh release view v<version>
```

## 🏷️ Package Information

### NPM Package Details

- **Package Name**: `@dataproc/mcp-server`
- **Registry**: https://registry.npmjs.org/
- **Scope**: `@dataproc`
- **Access**: Public
- **License**: MIT

### Installation

```bash
# Latest stable version
npm install @dataproc/mcp-server

# Specific version
npm install @dataproc/mcp-server@2.0.0

# Beta version (from develop branch)
npm install @dataproc/mcp-server@beta
```

### Usage

```bash
# Run the server
npx @dataproc/mcp-server

# Or use the alias
npx dataproc-mcp
```

## 🔧 Configuration

### Package.json Configuration

Key configuration in [`package.json`](../package.json):

```json
{
  "name": "@dataproc/mcp-server",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "files": [
    "build",
    "profiles",
    "config",
    "docs",
    "templates",
    "scripts"
  ]
}
```

### Semantic Release Configuration

Configuration in [`.releaserc.json`](../.releaserc.json):

- **Branches**: `main` (stable), `develop` (beta)
- **Plugins**: npm, GitHub, changelog, git
- **Assets**: Distribution packages, documentation

## 🚨 Troubleshooting

### Common Issues

1. **NPM_TOKEN Invalid**:
   ```
   Error: 401 Unauthorized
   ```
   - Regenerate npm token
   - Update GitHub secret

2. **Package Already Exists**:
   ```
   Error: 403 Forbidden - cannot modify pre-existing version
   ```
   - Version already published
   - Check semantic-release logs

3. **Build Failures**:
   ```
   Error: TypeScript compilation failed
   ```
   - Fix TypeScript errors
   - Run `npm run build` locally

4. **Test Failures**:
   ```
   Error: Tests failed
   ```
   - Fix failing tests
   - Run `npm test` locally

### Debug Commands

```bash
# Test release process locally
npm run release:dry

# Validate package before publish
npm run validate-package

# Check semantic-release configuration
npx semantic-release --dry-run

# Verify npm authentication
npm whoami
```

## 📈 Monitoring

### Release Metrics

Monitor release health:

- **NPM Downloads**: https://npmjs.com/package/@dataproc/mcp-server
- **GitHub Releases**: Repository releases page
- **CI/CD Status**: GitHub Actions workflows
- **Security Alerts**: GitHub security advisories

### Automated Monitoring

The repository includes:

- **Weekly dependency updates**
- **Security vulnerability scanning**
- **Automated dependency PRs**
- **Release success notifications**

## 🎯 Best Practices

### For Contributors

1. **Use Conventional Commits**:
   - Follow the commit message format
   - Be descriptive in commit messages
   - Use appropriate commit types

2. **Test Before Committing**:
   ```bash
   npm run pre-flight
   npm test
   npm run lint:check
   ```

3. **Review Changes**:
   - Check generated changelog
   - Verify version bump is appropriate
   - Test package installation

### For Maintainers

1. **Monitor Releases**:
   - Watch for failed releases
   - Verify npm package availability
   - Check community feedback

2. **Security Updates**:
   - Review dependency update PRs
   - Address security vulnerabilities promptly
   - Keep dependencies current

3. **Documentation**:
   - Update documentation for breaking changes
   - Maintain migration guides
   - Keep examples current

## 🔗 Related Documentation

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://conventionalcommits.org/)
- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Release Documentation](https://semantic-release.gitbook.io/)