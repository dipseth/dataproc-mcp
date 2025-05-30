# CI/CD Guide 🚀

This guide covers the comprehensive CI/CD pipeline implemented for the Dataproc MCP Server, including automated testing, quality gates, release management, and deployment processes.

## Overview

The CI/CD pipeline is built using GitHub Actions and provides:

- **Automated Testing** - Unit, integration, and end-to-end tests
- **Quality Gates** - Code quality, security scanning, and coverage checks
- **Release Automation** - Semantic versioning and automated publishing
- **Documentation** - Auto-generated docs and GitHub Pages deployment
- **Dependency Management** - Automated updates and security monitoring

## Workflow Structure

### 1. Main CI/CD Pipeline (`.github/workflows/ci.yml`)

Triggered on: `push` to `main`/`develop`, `pull_request`, `release`

**Jobs:**
- **Quality Check** - ESLint, Prettier, TypeScript, security audit
- **Test Matrix** - Tests across Node.js 18, 20, 22
- **Documentation** - Generate and validate documentation
- **Publish** - NPM publishing (release only)
- **Notify** - Deployment notifications

**Quality Gates:**
- ✅ Code passes ESLint and Prettier checks
- ✅ TypeScript compilation successful
- ✅ Security audit passes (moderate level)
- ✅ Test coverage ≥ 90%
- ✅ All tests pass across Node.js versions

### 2. Release Automation (`.github/workflows/release.yml`)

Triggered on: `push` to `main` (excluding docs-only changes)

**Features:**
- **Semantic Release** - Automated versioning based on conventional commits
- **Changelog Generation** - Auto-generated CHANGELOG.md
- **NPM Publishing** - Automated package publishing
- **GitHub Releases** - Release notes and assets
- **Documentation Updates** - Auto-update docs after release

**Commit Convention:**
```
feat: add new cluster management feature
fix: resolve authentication timeout issue
docs: update API documentation
chore: update dependencies
BREAKING CHANGE: remove deprecated methods
```

### 3. Dependency Management (`.github/workflows/dependencies.yml`)

Triggered on: Weekly schedule (Mondays 9 AM UTC), manual dispatch

**Features:**
- **Automated Updates** - Patch and minor version updates
- **Security Scanning** - Vulnerability detection and reporting
- **Pull Request Creation** - Automated PRs for dependency updates
- **Issue Creation** - Security vulnerability alerts

### 4. Documentation Pipeline (`.github/workflows/docs.yml`)

Triggered on: Changes to docs, source code, or README

**Features:**
- **Auto-generation** - Generate docs from source code
- **Link Validation** - Check for broken links
- **Example Validation** - Verify configuration examples
- **GitHub Pages** - Deploy documentation website
- **Quality Checks** - Ensure documentation completeness

## Setup Instructions

### 1. Repository Secrets

Configure the following secrets in your GitHub repository:

```bash
# NPM Publishing
NPM_TOKEN=your_npm_token

# Code Coverage (optional)
CODECOV_TOKEN=your_codecov_token

# GitHub Token (automatically provided)
GITHUB_TOKEN=automatically_provided
```

### 2. Branch Protection Rules

Set up branch protection for `main`:

```yaml
Required status checks:
  - Code Quality & Security
  - Test (Node 18)
  - Test (Node 20) 
  - Test (Node 22)
  - Documentation & Examples

Require branches to be up to date: ✅
Require pull request reviews: ✅ (1 reviewer)
Dismiss stale reviews: ✅
Restrict pushes to matching branches: ✅
```

### 3. GitHub Pages Setup

1. Go to repository Settings → Pages
2. Source: GitHub Actions
3. Custom domain (optional): your-domain.com

## Local Development Workflow

### 1. Pre-commit Checks

Run quality checks locally before committing:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Testing
npm test

# Full validation
npm run validate
```

### 2. Commit Message Format

Use conventional commits for automated versioning:

```bash
# Feature additions
git commit -m "feat: add cluster auto-scaling support"

# Bug fixes  
git commit -m "fix: resolve memory leak in job monitoring"

# Documentation
git commit -m "docs: add troubleshooting guide"

# Breaking changes
git commit -m "feat!: redesign authentication API"
```

### 3. Testing Strategy

**Unit Tests** (`tests/unit/`)
- Schema validation
- Utility functions
- Individual components

**Integration Tests** (`tests/integration/`)
- MCP tool interactions
- Google Cloud API integration
- End-to-end workflows

**Coverage Requirements:**
- Lines: ≥ 90%
- Functions: ≥ 90%
- Branches: ≥ 90%
- Statements: ≥ 90%

## Release Process

### Automatic Releases

1. **Commit with conventional format** to `main` branch
2. **Semantic Release analyzes** commit messages
3. **Version bump** based on commit types:
   - `fix:` → patch (1.0.1)
   - `feat:` → minor (1.1.0)
   - `BREAKING CHANGE:` → major (2.0.0)
4. **Generate changelog** from commit messages
5. **Create GitHub release** with notes
6. **Publish to NPM** with new version
7. **Update documentation** automatically

### Manual Releases

For emergency releases or special cases:

```bash
# Create release branch
git checkout -b release/v1.2.3

# Update version manually
npm version 1.2.3 --no-git-tag-version

# Commit and push
git commit -am "chore(release): 1.2.3"
git push origin release/v1.2.3

# Create pull request to main
# After merge, create GitHub release manually
```

## Monitoring and Alerts

### 1. Build Status

Monitor build status via:
- GitHub Actions dashboard
- Repository badges
- Email notifications (configurable)

### 2. Security Monitoring

Automated security checks:
- **Dependency vulnerabilities** - Weekly scans
- **Code security** - SAST scanning
- **Secret scanning** - Prevent credential leaks
- **Supply chain** - Package integrity checks

### 3. Performance Monitoring

Track key metrics:
- **Build times** - Optimize slow workflows
- **Test execution** - Identify performance regressions
- **Bundle size** - Monitor package size growth
- **Coverage trends** - Maintain quality standards

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Check logs in GitHub Actions
# Run locally to reproduce
npm run build
npm test

# Clear cache if needed
npm ci --cache .npm
```

**Test Failures:**
```bash
# Run specific test suite
npm run test:unit
npm run test:integration

# Debug with verbose output
npm test -- --verbose
```

**Release Issues:**
```bash
# Check semantic-release logs
# Verify commit message format
# Ensure NPM_TOKEN is valid
```

**Documentation Issues:**
```bash
# Regenerate documentation
npm run docs:generate

# Test links locally
npm run docs:test-links

# Validate examples
npm run validate:examples
```

### Getting Help

1. **Check GitHub Actions logs** for detailed error messages
2. **Review this guide** for common solutions
3. **Open an issue** with workflow logs and error details
4. **Contact maintainers** for urgent production issues

## Best Practices

### 1. Commit Hygiene

- Use conventional commit format
- Keep commits atomic and focused
- Write descriptive commit messages
- Reference issues when applicable

### 2. Pull Request Guidelines

- Create feature branches from `main`
- Keep PRs small and focused
- Include tests for new features
- Update documentation as needed
- Ensure all checks pass before requesting review

### 3. Testing Best Practices

- Write tests before implementing features (TDD)
- Maintain high test coverage (≥90%)
- Use descriptive test names
- Mock external dependencies
- Test both success and error scenarios

### 4. Security Considerations

- Never commit secrets or credentials
- Use environment variables for configuration
- Keep dependencies updated
- Review security scan results
- Follow principle of least privilege

## Advanced Configuration

### Custom Workflows

Create custom workflows for specific needs:

```yaml
# .github/workflows/custom.yml
name: Custom Workflow
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ${{ github.event.inputs.environment }}
        run: echo "Deploying to ${{ github.event.inputs.environment }}"
```

### Matrix Testing

Extend test matrix for additional configurations:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, windows-latest, macos-latest]
    include:
      - node-version: 20
        os: ubuntu-latest
        coverage: true
```

### Conditional Workflows

Use path filters for efficient CI:

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package*.json'
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '*.md'
```

This comprehensive CI/CD pipeline ensures code quality, security, and reliable releases while maintaining developer productivity and project maintainability.