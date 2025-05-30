# CI/CD Guide 🚀

This comprehensive guide covers the CI/CD pipeline for the Dataproc MCP Server, including automated testing, quality gates, release management, troubleshooting, and best practices.

## 🎯 Golden Command Workflow

**ALWAYS run this before any git operations:**

```bash
npm run pre-push
```

This command runs ALL CI checks locally:
- Build compilation
- ESLint validation  
- Prettier formatting check
- TypeScript type checking
- Unit tests
- Security audit
- Package validation
- Documentation link testing

**Benefits:**
- ✅ Prevents CI failures by catching issues locally
- ✅ Builds developer confidence
- ✅ Maintains quality gates
- ✅ Saves time and resources

## 📋 Overview

The CI/CD pipeline provides:

- **🔍 Pre-flight Checks** - Intelligent change detection and dependency sync
- **🛡️ Quality Gates** - Code quality, security scanning, and coverage checks
- **🧪 Automated Testing** - Unit, integration, and end-to-end tests across Node.js versions
- **📚 Documentation** - Auto-generated docs and validation
- **📦 Build Artifacts** - Production-ready distributions
- **🚀 Release Automation** - Semantic versioning and automated publishing
- **🔒 Security Scanning** - Dependency vulnerabilities and code analysis

## 🏗️ Workflow Structure

### Main CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `develop`, `feat/**` branches
- Pull requests to `main`, `develop`
- Manual workflow dispatch

**Jobs Overview:**

#### 1. 🚀 Pre-flight Checks
- **Purpose**: Intelligent change detection and optimization
- **Features**:
  - Detects code vs documentation changes
  - Skips unnecessary jobs for docs-only changes
  - Handles new branches and force pushes gracefully
  - Determines security scan requirements

#### 2. 🔄 Dependency Sync Check
- **Purpose**: Ensures package.json and package-lock.json are synchronized
- **Features**:
  - Validates `npm ci` compatibility
  - Auto-fixes sync issues when possible
  - Provides clear error messages for manual fixes
  - Prevents build failures due to dependency mismatches

#### 3. 🔍 Quality Gates (Matrix: Node.js 18, 20, 22)
- **ESLint** - Code quality and style enforcement
- **Prettier** - Code formatting validation
- **TypeScript** - Type checking and compilation
- **Unit Tests** - Fast test execution
- **Package Validation** - NPM package integrity

#### 4. 🔒 Security Scanning
- **NPM Audit** - Dependency vulnerability scanning
- **Audit CI** - Advanced vulnerability analysis
- **Conditional Execution** - Runs on main/develop or dependency changes

#### 5. 🔗 Integration Validation
- **Full Test Suite** - Comprehensive testing
- **Coverage Reports** - Code coverage analysis with Codecov
- **Coverage Thresholds** - Enforces 90% minimum coverage

#### 6. 📚 Documentation & Examples
- **API Documentation** - TypeDoc generation
- **Interactive Docs** - HTML documentation
- **Link Validation** - Broken link detection
- **Example Validation** - Configuration example testing

#### 7. 📦 Build Artifacts (Main branch only)
- **Production Builds** - Clean, standalone, and template builds
- **Distribution Packages** - NPM package creation
- **Build Reports** - Comprehensive artifact documentation
- **Artifact Upload** - GitHub Actions artifacts with retention

#### 8. ✅ CI Status Summary
- **Results Dashboard** - Comprehensive status overview
- **Troubleshooting Info** - Debug information and next steps
- **Golden Command Recommendations** - Local validation guidance

## 🛠️ Local Development Workflow

### 1. Pre-commit Validation

**Golden Command (Recommended):**
```bash
npm run pre-push
```

**Individual Commands:**
```bash
# Build and compile
npm run build

# Code quality
npm run lint:check
npm run format:check
npm run type-check

# Testing
npm run test:unit:fast
npm test

# Security
npm run security:check

# Package validation
npm run validate-package

# Documentation
npm run docs:test-links
```

### 2. Pre-flight System Check

For intelligent change detection:
```bash
npm run pre-flight
```

### 3. Release Readiness

Before creating releases:
```bash
npm run ci-cd:validate
```

## 🔧 Troubleshooting

### Recent Fixes Applied

#### ✅ Unicode/Emoji Corruption Issue
- **Problem**: Corrupted Unicode character causing JSON parsing errors
- **Solution**: Fixed corrupted emoji in CI workflow
- **Prevention**: Use proper UTF-8 encoding in all workflow files

#### ✅ Package Lock Sync Issue  
- **Problem**: `npm ci` failing due to package.json/package-lock.json mismatch
- **Solution**: 
  - Added dependency sync check job
  - Implemented fallback to `npm install` when `npm ci` fails
  - Updated package-lock.json with `npm install --package-lock-only`
- **Prevention**: Always run `npm install` after dependency changes

#### ✅ TypeScript Version Compatibility
- **Problem**: TypeScript 5.8.3 vs ESLint TypeScript support (5.4.0 max)
- **Solution**: Updated dependencies and added compatibility warnings
- **Note**: ESLint warnings are non-blocking but should be addressed

#### ✅ TypeScript Configuration Issue (FINAL FIX)
- **Problem**: `tsconfig.json` included explicit types that weren't available in fresh CI installs
- **Root Cause**: CI environment differences - local had cached types, CI had fresh install
- **Solution**: Removed explicit `types` array entirely, letting TypeScript use default behavior
- **Why Local Missed It**: Local `node_modules` had cached type definitions that CI didn't have
- **Prevention**: Test with fresh installs: `rm -rf node_modules package-lock.json && npm install && npm run build`
- **Status**: ✅ RESOLVED - CI now matches local environment exactly

### Environment Parity Testing

**Critical for preventing CI failures that local testing misses:**

```bash
# Clean install (matches CI behavior exactly)
rm -rf node_modules package-lock.json
npm install

# Or use npm ci (requires existing lock file)
npm ci

# Test in clean environment
npm run pre-push
```

**Why Environment Differences Occur:**
- Local `node_modules` may have cached/different versions
- CI always starts with fresh installs
- TypeScript type definitions can vary between installs
- Development vs production dependency differences

### Common Issues & Solutions

#### Build Failures
```bash
# 1. Check dependency sync
npm install --package-lock-only

# 2. Clear cache and reinstall (matches CI environment)
rm -rf node_modules package-lock.json
npm install

# 3. Run golden command locally
npm run pre-push

# 4. Check specific issues
npm run build
npm run lint:check
npm run type-check
```

#### Test Failures
```bash
# Run specific test suites
npm run test:unit
npm run test:unit:fast
npm run test:integration

# Debug with verbose output
npm test -- --verbose

# Check coverage
npm run test:coverage
npm run test:coverage:check
```

#### Security Issues
```bash
# Run security audit
npm run security:check
npm audit

# Fix vulnerabilities
npm audit fix

# Check specific audit level
npm audit --audit-level moderate
```

#### Documentation Issues
```bash
# Regenerate documentation
npm run docs:generate
npm run docs:api

# Test links
npm run docs:test-links

# Validate examples
npm run validate:examples
```

#### Package Validation Issues
```bash
# Validate package
npm run validate-package

# Test package creation
npm pack --dry-run

# Check package contents
npm pack
tar -tzf *.tgz
```

## 🚀 Release Process

### Automatic Releases (Recommended)

1. **Use Conventional Commits:**
```bash
# Feature additions (minor version bump)
git commit -m "feat: add cluster auto-scaling support"

# Bug fixes (patch version bump)
git commit -m "fix: resolve memory leak in job monitoring"

# Breaking changes (major version bump)
git commit -m "feat!: redesign authentication API"

# Documentation (no version bump)
git commit -m "docs: add troubleshooting guide"
```

2. **Push to main branch:**
```bash
# Always run golden command first
npm run pre-push

# Then commit and push
git add .
git commit -m "feat: your feature description"
git push origin main
```

3. **Automated Process:**
- Semantic Release analyzes commits
- Version bump based on commit types
- Changelog generation
- GitHub release creation
- NPM publishing
- Documentation updates

### Manual Release (Emergency)

```bash
# Create release branch
git checkout -b release/v1.2.3

# Update version
npm version 1.2.3 --no-git-tag-version

# Validate before commit
npm run pre-push

# Commit and push
git commit -am "chore(release): 1.2.3"
git push origin release/v1.2.3

# Create PR to main
```

## 🔒 Security & Best Practices

### Security Monitoring
- **Weekly dependency scans** - Automated vulnerability detection
- **Code security analysis** - SAST scanning integration
- **Secret scanning** - Prevents credential leaks
- **Supply chain security** - Package integrity verification

### Development Best Practices

#### 1. Commit Hygiene
- ✅ Use conventional commit format
- ✅ Keep commits atomic and focused
- ✅ Write descriptive commit messages
- ✅ Reference issues when applicable
- ✅ Always run `npm run pre-push` before committing

#### 2. Pull Request Guidelines
- ✅ Create feature branches from `main`
- ✅ Keep PRs small and focused
- ✅ Include tests for new features
- ✅ Update documentation as needed
- ✅ Ensure all CI checks pass
- ✅ Run `npm run pre-push` locally first

#### 3. Testing Standards
- ✅ Maintain ≥90% test coverage
- ✅ Write tests before implementing features (TDD)
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Test both success and error scenarios

#### 4. Security Guidelines
- ✅ Never commit secrets or credentials
- ✅ Use environment variables for configuration
- ✅ Keep dependencies updated
- ✅ Review security scan results
- ✅ Follow principle of least privilege

## ⚙️ Configuration

### Repository Secrets

Required secrets in GitHub repository settings:

```bash
# NPM Publishing
NPM_TOKEN=your_npm_token

# Code Coverage (optional)
CODECOV_TOKEN=your_codecov_token

# GitHub Token (automatically provided)
GITHUB_TOKEN=automatically_provided
```

### Branch Protection Rules

Configure for `main` branch:

```yaml
Required status checks:
  - 🚀 Pre-flight Checks
  - 🔄 Dependency Sync Check  
  - 🔍 Quality Gates (Node 18)
  - 🔍 Quality Gates (Node 20)
  - 🔍 Quality Gates (Node 22)
  - 🔒 Security Scanning
  - 🔗 Integration Validation

Require branches to be up to date: ✅
Require pull request reviews: ✅ (1 reviewer)
Dismiss stale reviews: ✅
Restrict pushes to matching branches: ✅
```

## 📊 Monitoring & Metrics

### Build Status Monitoring
- GitHub Actions dashboard
- Repository status badges
- Email notifications (configurable)
- Slack/Discord integration (optional)

### Key Metrics Tracked
- **Build Success Rate** - Pipeline reliability
- **Build Duration** - Performance optimization
- **Test Coverage** - Quality maintenance
- **Security Vulnerabilities** - Risk assessment
- **Package Size** - Bundle optimization

## 🆘 Getting Help

### Escalation Path
1. **Run `npm run pre-push`** - Catch issues locally
2. **Check GitHub Actions logs** - Detailed error analysis
3. **Review this guide** - Common solutions and troubleshooting
4. **Search existing issues** - Community solutions
5. **Open new issue** - Include logs and error details
6. **Contact maintainers** - For urgent production issues

### Debug Information Collection

When reporting issues, include:

```bash
# System information
node --version
npm --version
git --version

# Project status
npm run pre-push
npm run pre-flight
npm run ci-cd:validate

# Dependency status
npm ls
npm audit

# Build logs
npm run build 2>&1 | tee build.log
```

## 🎯 Quick Reference

### Essential Commands
```bash
# Golden command (run before every push)
npm run pre-push

# Pre-flight check (intelligent change detection)
npm run pre-flight

# Release readiness validation
npm run ci-cd:validate

# Individual quality checks
npm run build
npm run lint:check
npm run format:check
npm run type-check
npm run test:unit:fast
npm run security:check
npm run validate-package
npm run docs:test-links
```

### Workflow Files
- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/release.yml` - Release automation (if exists)
- `.github/workflows/docs.yml` - Documentation pipeline (if exists)

### Configuration Files
- `package.json` - Scripts and dependencies
- `.eslintrc.json` - Code quality rules
- `.prettierrc` - Code formatting rules
- `tsconfig.json` - TypeScript configuration
- `.audit-ci.json` - Security audit configuration

This comprehensive CI/CD pipeline ensures code quality, security, and reliable releases while maintaining developer productivity through the golden command workflow.