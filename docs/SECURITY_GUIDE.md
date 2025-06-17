# 🔒 Security Guide: Dataproc MCP Server

This guide covers security best practices, configuration, and hardening for the Dataproc MCP Server.

## Overview

The Dataproc MCP Server implements comprehensive security measures including:
- Input validation and sanitization
- Rate limiting and abuse prevention
- Credential management and protection
- Audit logging and monitoring
- Secure defaults and configurations

## Security Features

### 🛡️ Input Validation

All tool inputs are validated using comprehensive Zod schemas that enforce:

- **GCP Resource Constraints**: Project IDs, regions, zones, and cluster names must follow GCP naming conventions
- **Data Type Validation**: Ensures correct data types and formats
- **Length Limits**: Prevents oversized inputs that could cause issues
- **Pattern Matching**: Uses regex patterns to validate GCP-specific formats
- **Injection Prevention**: Detects and blocks common injection patterns

#### Example Validation Rules

```typescript
// Project ID validation
const projectId = "my-project-123"; // ✅ Valid
const projectId = "My-Project";     // ❌ Invalid (uppercase)
const projectId = "a";              // ❌ Invalid (too short)

// Cluster name validation
const clusterName = "my-cluster";   // ✅ Valid
const clusterName = "My_Cluster";   // ❌ Invalid (underscore)
const clusterName = "cluster-";     // ❌ Invalid (ends with hyphen)
```

### 🚦 Rate Limiting

Built-in rate limiting prevents abuse and ensures fair resource usage:

- **Default Limits**: 100 requests per minute per client
- **Configurable Windows**: Adjustable time windows and limits
- **Per-Tool Limiting**: Different limits can be set per tool
- **Automatic Cleanup**: Expired rate limit entries are automatically cleaned up

#### Configuration

```json
{
  "rateLimiting": {
    "windowMs": 60000,     // 1 minute window
    "maxRequests": 100,    // Max requests per window
    "enabled": true
  }
}
```

### 🔐 Credential Management

For detailed information on credential management, including service account impersonation, key validation, and best practices, refer to the [Authentication Implementation Guide](AUTHENTICATION_IMPLEMENTATION_GUIDE.md).

### 📊 Audit Logging

All security-relevant events are logged for monitoring and compliance:

#### Logged Events

- **Authentication Events**: Login attempts, key validation, impersonation
- **Input Validation Failures**: Invalid inputs, injection attempts
- **Rate Limit Violations**: Exceeded request limits
- **Tool Executions**: All tool calls with sanitized parameters
- **Error Conditions**: Security-related errors and warnings

#### Log Format

```json
{
  "timestamp": "2025-05-29T22:30:00.000Z",
  "event": "Input validation failed",
  "details": {
    "tool": "start_dataproc_cluster",
    "error": "Invalid project ID format",
    "clientId": "[REDACTED]"
  },
  "severity": "warn"
}
```

### 🔍 Threat Detection

Automatic detection of suspicious patterns:

- **SQL Injection**: Detects SQL keywords and patterns
- **XSS Attempts**: Identifies script injection attempts
- **Path Traversal**: Catches directory traversal attempts
- **Template Injection**: Detects template expression patterns
- **Code Injection**: Identifies code execution attempts
- **System Commands**: Flags dangerous system commands

## Security Configuration

### Environment Variables

```bash
# Security settings
SECURITY_RATE_LIMIT_ENABLED=true
SECURITY_RATE_LIMIT_WINDOW=60000
SECURITY_RATE_LIMIT_MAX=100
SECURITY_AUDIT_LOG_LEVEL=info
SECURITY_CREDENTIAL_VALIDATION=strict
```

### Configuration File

```json
{
  "security": {
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 100,
    "enableInputValidation": true,
    "sanitizeCredentials": true,
    "auditLogLevel": "info",
    "enableThreatDetection": true,
    "secureHeaders": {
      "enabled": true,
      "customHeaders": {}
    }
  }
}
```

## Hardening Checklist

### ✅ Basic Security

- [ ] Service account keys have restrictive permissions (600)
- [ ] Using service account impersonation instead of direct keys
- [ ] Rate limiting is enabled and configured appropriately
- [ ] Input validation is enabled for all tools
- [ ] Audit logging is configured and monitored

### ✅ Advanced Security

- [ ] Service account keys are rotated regularly (≤90 days)
- [ ] Monitoring and alerting for security events
- [ ] Network access is restricted (firewall rules)
- [ ] TLS/SSL is used for all communications
- [ ] Regular security audits and penetration testing

### ✅ Production Security

- [ ] Dedicated service accounts per environment
- [ ] Centralized credential management (Secret Manager)
- [ ] Automated security scanning in CI/CD
- [ ] Incident response procedures documented
- [ ] Security training for operators

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Authentication Failures**
   - Failed service account validations
   - Invalid credential attempts
   - Permission denied errors

2. **Rate Limiting Events**
   - Clients hitting rate limits
   - Unusual traffic patterns
   - Potential abuse attempts

3. **Input Validation Failures**
   - Malformed requests
   - Injection attempt patterns
   - Suspicious input patterns

4. **System Health**
   - Error rates by tool
   - Response times
   - Resource utilization

### Sample Alerts

```yaml
# Example Prometheus alerts
groups:
  - name: dataproc-mcp-security
    rules:
      - alert: HighAuthenticationFailures
        expr: rate(dataproc_auth_failures_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"
          
      - alert: RateLimitViolations
        expr: rate(dataproc_rate_limit_violations_total[5m]) > 0.05
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Rate limit violations detected"
```

## Incident Response

### Security Incident Types

1. **Credential Compromise**
   - Immediately rotate affected keys
   - Review audit logs for unauthorized access
   - Update access controls

2. **Injection Attacks**
   - Block suspicious clients
   - Review and strengthen input validation
   - Analyze attack patterns

3. **Rate Limit Abuse**
   - Identify and block abusive clients
   - Adjust rate limits if necessary
   - Investigate traffic patterns

### Response Procedures

1. **Immediate Response**
   - Isolate affected systems
   - Preserve evidence (logs, configurations)
   - Notify security team

2. **Investigation**
   - Analyze audit logs
   - Identify attack vectors
   - Assess impact and scope

3. **Recovery**
   - Apply security patches
   - Update configurations
   - Restore normal operations

4. **Post-Incident**
   - Document lessons learned
   - Update security procedures
   - Implement additional controls

## Compliance Considerations

### Data Protection

- **PII Handling**: Ensure no personally identifiable information is logged
- **Data Encryption**: Use encryption for data at rest and in transit
- **Access Controls**: Implement least privilege access principles

### Regulatory Requirements

- **SOC 2**: Implement appropriate security controls
- **GDPR**: Ensure data protection and privacy compliance
- **HIPAA**: Additional controls for healthcare data (if applicable)

### Audit Requirements

- **Log Retention**: Maintain audit logs for required periods
- **Access Reviews**: Regular review of service account permissions
- **Security Assessments**: Periodic security evaluations

## Security Updates

### Keeping Secure

1. **Regular Updates**
   - Update dependencies regularly
   - Apply security patches promptly
   - Monitor security advisories

2. **Vulnerability Scanning**
   - Automated dependency scanning
   - Container image scanning
   - Infrastructure scanning

3. **Security Testing**
   - Regular penetration testing
   - Code security reviews
   - Configuration audits

## Support and Resources

### Getting Help

- **Security Issues**: Report to security team immediately
- **Configuration Questions**: Consult this guide and documentation
- **Best Practices**: Follow industry security standards

### Additional Resources

- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [OWASP Security Guidelines](https://owasp.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security configurations as threats evolve.