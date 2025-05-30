# Pull Request

## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Test improvements
- [ ] CI/CD improvements

## Related Issues
Fixes #(issue number)
Closes #(issue number)
Related to #(issue number)

## Changes Made
### Added
- List new features or functionality

### Changed
- List modifications to existing functionality

### Removed
- List removed features or functionality

### Fixed
- List bug fixes

## Testing
### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] End-to-end tests added/updated
- [ ] Performance tests added/updated
- [ ] All existing tests pass

### Manual Testing
Describe the manual testing performed:
- [ ] Tested locally
- [ ] Tested with different MCP clients
- [ ] Tested with different authentication methods
- [ ] Tested with different cluster configurations

### Test Results
```
# Paste test output here
npm test
```

## Configuration Changes
### Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes (describe below)

**Breaking Change Description:**
If this introduces breaking changes, describe:
1. What breaks
2. How to migrate
3. Why the change was necessary

### New Configuration Options
```json
{
  // New configuration options added
}
```

### Migration Guide
If configuration changes are required:
1. Step 1
2. Step 2
3. Step 3

## Documentation
- [ ] README updated
- [ ] API documentation updated
- [ ] Configuration examples updated
- [ ] Migration guide created (if breaking changes)
- [ ] Changelog updated

## Security Considerations
- [ ] No security implications
- [ ] Security review required
- [ ] New permissions required
- [ ] Credential handling changes

**Security Impact:**
Describe any security implications of this change.

## Performance Impact
- [ ] No performance impact
- [ ] Performance improvement
- [ ] Potential performance regression (explain below)

**Performance Notes:**
Describe any performance implications.

## Deployment Considerations
- [ ] No special deployment requirements
- [ ] Database migration required
- [ ] Configuration update required
- [ ] Service restart required

## Checklist
### Code Quality
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Code is properly commented
- [ ] No debugging code left in
- [ ] Error handling is appropriate

### Testing
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Test coverage maintained or improved
- [ ] Edge cases considered and tested

### Documentation
- [ ] Documentation updated for changes
- [ ] Examples updated if needed
- [ ] API documentation reflects changes
- [ ] Breaking changes documented

### Dependencies
- [ ] No new dependencies added
- [ ] New dependencies justified and documented
- [ ] Dependencies are up to date
- [ ] Security vulnerabilities checked

## Screenshots/Examples
If applicable, add screenshots or examples of the changes:

### Before
```
# Code or output before changes
```

### After
```
# Code or output after changes
```

## Additional Notes
Any additional information that reviewers should know:

## Reviewer Guidelines
### Focus Areas
Please pay special attention to:
- [ ] Security implications
- [ ] Performance impact
- [ ] Breaking changes
- [ ] Test coverage
- [ ] Documentation accuracy

### Testing Instructions
1. Checkout this branch
2. Run `npm install`
3. Run `npm test`
4. Test specific scenarios: [describe]

## Post-Merge Tasks
- [ ] Update version number
- [ ] Create release notes
- [ ] Update documentation site
- [ ] Notify community of changes