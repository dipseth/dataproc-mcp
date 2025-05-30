# Contributing to Dataproc MCP Server 🤝

Thank you for your interest in contributing to the Dataproc MCP Server! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow:

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or discriminatory comments
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Git** for version control
- **Google Cloud SDK** (optional, for testing)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dataproc-mcp.git
   cd dataproc-mcp
   ```

3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/dipseth/dataproc-mcp.git
   ```

## Development Setup

### Initial Setup

```bash
# Install dependencies
npm install

# Run setup script
npm run setup

# Build the project
npm run build

# Validate configuration
npm run validate
```

### Development Environment

```bash
# Start development mode with watch
npm run dev

# Run in development mode
npm run start

# Run with inspector for debugging
npm run inspector
```

### Environment Configuration

Create a `.env` file for local development:

```bash
# .env (not committed to git)
DATAPROC_PROJECT_ID=your-dev-project
DATAPROC_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account.json
NODE_ENV=development
```

## Contributing Guidelines

### Types of Contributions

We welcome several types of contributions:

1. **Bug Reports** - Help us identify and fix issues
2. **Feature Requests** - Suggest new functionality
3. **Code Contributions** - Implement features or fix bugs
4. **Documentation** - Improve guides, examples, and API docs
5. **Testing** - Add test cases or improve test coverage
6. **Performance** - Optimize existing functionality

### Contribution Areas

**High Priority:**
- Authentication method improvements
- Performance optimizations
- Additional cluster configuration options
- Enhanced error handling and recovery
- Cross-platform compatibility

**Medium Priority:**
- Additional MCP tools for Dataproc operations
- Integration with other Google Cloud services
- Enhanced monitoring and logging
- UI/UX improvements for documentation

**Low Priority:**
- Code style improvements
- Refactoring for maintainability
- Additional examples and tutorials

## Pull Request Process

### Before Submitting

1. **Check existing issues** - Ensure your contribution isn't already being worked on
2. **Create an issue** - For significant changes, create an issue first to discuss
3. **Follow conventions** - Use conventional commit messages
4. **Test thoroughly** - Ensure all tests pass and add new tests as needed

### PR Requirements

**Code Quality:**
- [ ] All tests pass (`npm run test:all-enhanced`)
- [ ] Code follows TypeScript best practices
- [ ] No linting errors (`npm run lint:check`)
- [ ] Proper formatting (`npm run format:check`)
- [ ] Type checking passes (`npm run type-check`)

**Documentation:**
- [ ] Code is properly documented with JSDoc comments
- [ ] README updated if needed
- [ ] API documentation updated for new features
- [ ] Examples provided for new functionality

**Testing:**
- [ ] Unit tests for new functionality
- [ ] Integration tests for complex features
- [ ] Performance tests for optimization changes
- [ ] Manual testing completed

### Commit Message Format

Use [Conventional Commits](https://conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(auth): add support for workload identity federation
fix(cluster): resolve timeout issue in cluster creation
docs(api): update authentication examples
perf(validation): optimize schema validation performance
test(integration): add multi-environment validation tests
```

### PR Template

When creating a PR, use this template:

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Test improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or properly documented)

## Screenshots/Examples
If applicable, add screenshots or code examples.

## Related Issues
Closes #(issue number)
```

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug.

**To Reproduce**
Steps to reproduce the behavior:
1. Configure with '...'
2. Run command '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment**
- OS: [e.g., macOS 12.0]
- Node.js version: [e.g., 18.17.0]
- Package version: [e.g., 1.2.3]
- Google Cloud SDK version: [if applicable]

**Additional Context**
Any other context about the problem.

**Logs**
```
Paste relevant logs here
```
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the feature you'd like to see.

**Use Case**
Describe the use case and why this feature would be valuable.

**Proposed Solution**
Describe how you envision this feature working.

**Alternatives Considered**
Any alternative solutions or features you've considered.

**Additional Context**
Any other context or screenshots about the feature request.
```

## Development Workflow

### Branch Strategy

- **main** - Production-ready code
- **develop** - Integration branch for features
- **feature/*** - Feature development branches
- **fix/*** - Bug fix branches
- **release/*** - Release preparation branches

### Workflow Steps

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Develop and Test**
   ```bash
   # Make changes
   npm run build
   npm run test:all-enhanced
   npm run validate
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scope): add new feature"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

5. **Address Review Feedback**
   ```bash
   # Make requested changes
   git add .
   git commit -m "fix(scope): address review feedback"
   git push origin feature/your-feature-name
   ```

## Testing Requirements

### Test Categories

**Unit Tests** (Required for all code changes)
```bash
npm run test:unit
```

**Integration Tests** (Required for API changes)
```bash
npm run test:integration
npm run test:auth
```

**End-to-End Tests** (Required for workflow changes)
```bash
npm run test:e2e
```

**Performance Tests** (Required for performance changes)
```bash
npm run test:performance
```

### Coverage Requirements

- **Minimum coverage**: 90% for new code
- **Critical paths**: 100% coverage required
- **Performance**: No regression in benchmarks

### Writing Tests

**Unit Test Example:**
```typescript
describe('Schema Validation', () => {
  it('should validate cluster configuration', () => {
    const config = {
      clusterName: 'test-cluster',
      projectId: 'test-project',
      region: 'us-central1'
    };
    
    const result = StartDataprocClusterSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
```

**Integration Test Example:**
```typescript
await runner.runTest('Authentication Test', async () => {
  const result = await validateServiceAccount(mockCredentials);
  assert(result.isValid, 'Service account should be valid');
});
```

## Documentation Standards

### Code Documentation

**JSDoc Comments:**
```typescript
/**
 * Creates a new Dataproc cluster with the specified configuration.
 * 
 * @param config - Cluster configuration object
 * @param options - Additional options for cluster creation
 * @returns Promise that resolves to cluster creation result
 * @throws {ValidationError} When configuration is invalid
 * @throws {AuthenticationError} When credentials are invalid
 * 
 * @example
 * ```typescript
 * const result = await createCluster({
 *   clusterName: 'my-cluster',
 *   projectId: 'my-project',
 *   region: 'us-central1'
 * });
 * ```
 */
async function createCluster(config: ClusterConfig, options?: CreateOptions): Promise<ClusterResult> {
  // Implementation
}
```

### API Documentation

- Update `docs/API_REFERENCE.md` for new tools
- Include practical examples
- Document error conditions
- Provide troubleshooting guidance

### README Updates

- Keep installation instructions current
- Update feature lists
- Maintain example accuracy
- Include breaking changes

## Release Process

### Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features (backward compatible)
- **PATCH** (0.0.1): Bug fixes (backward compatible)

### Release Workflow

1. **Prepare Release**
   ```bash
   npm run prepare-release
   ```

2. **Create Release PR**
   ```bash
   git checkout -b release/v1.2.3
   # Update version and changelog
   git commit -m "chore(release): prepare v1.2.3"
   ```

3. **Automated Release** (via semantic-release)
   ```bash
   npm run release
   ```

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] Release notes prepared
- [ ] Breaking changes documented

## Getting Help

### Community Resources

- **GitHub Discussions** - General questions and discussions
- **GitHub Issues** - Bug reports and feature requests
- **Documentation** - Comprehensive guides and API reference

### Maintainer Contact

For urgent issues or security concerns:
- Create a GitHub issue with appropriate labels
- For security issues, use private vulnerability reporting

### Response Times

- **Bug reports**: 2-3 business days
- **Feature requests**: 1 week
- **Pull requests**: 3-5 business days
- **Security issues**: 24-48 hours

## Recognition

Contributors will be recognized in:
- **CHANGELOG.md** - For significant contributions
- **README.md** - Contributors section
- **GitHub releases** - Release notes acknowledgments

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the Dataproc MCP Server! Your contributions help make this project better for everyone. 🚀