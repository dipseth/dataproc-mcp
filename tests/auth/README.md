# Authentication Testing Suite

This directory contains scripts to test and validate authentication methods for the Dataproc MCP server. These tests help identify the root cause of authentication issues and determine the correct authentication configuration.

## Problem Context

The Dataproc MCP server has authentication issues where some tools work while others fail with the error:
```
this.auth.getUniverseDomain is not a function
```

**Working Tools (2/7):**
- `list_clusters` ✅
- `get_job_results` ✅

**Failing Tools (5/7):**
- `get_job_status` ❌
- `get_query_status` ❌
- `get_cluster` ❌
- `get_zeppelin_url` ❌
- `submit_dataproc_job` ❌

## Test Scripts

### 1. `run-all-auth-tests.sh` (Master Test Runner)
Runs all authentication tests in the correct order and provides a comprehensive summary.

**Usage:**
```bash
./tests/auth/run-all-auth-tests.sh
```

### 2. `test-mcp-auth-config.sh`
Analyzes the current MCP server authentication configuration.

**What it tests:**
- Current gcloud configuration
- Environment variables
- Service account key file availability
- Token acquisition with different methods

**Usage:**
```bash
./tests/auth/test-mcp-auth-config.sh
```

### 3. `test-gcloud-commands.sh`
Tests gcloud CLI commands that correspond to the failing MCP tools.

**What it tests:**
- `gcloud dataproc jobs describe` (corresponds to `get_job_status`)
- `gcloud dataproc clusters describe` (corresponds to `get_cluster`)
- `gcloud dataproc clusters list` (corresponds to `list_clusters`)

**Authentication methods tested:**
- Service account key file
- Service account impersonation
- Application Default Credentials (ADC)

**Usage:**
```bash
./tests/auth/test-gcloud-commands.sh
```

### 4. `test-rest-api.sh`
Tests REST API calls that the MCP server uses directly.

**What it tests:**
- Direct HTTP calls to Dataproc REST API endpoints
- Token acquisition and usage
- API response validation

**Usage:**
```bash
./tests/auth/test-rest-api.sh
```

## Configuration Required

Before running the tests, update these variables in the test scripts:

```bash
# In test-gcloud-commands.sh and test-rest-api.sh
PROJECT_ID="your-project-id"
REGION="us-central1"
CLUSTER_NAME="your-cluster-name"
JOB_ID="your-job-id"
SERVICE_ACCOUNT="grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com"
KEY_FILE="/Users/user123/Repositories/path/to/prod/keyfile.json"
```

## Prerequisites

### Required Tools
- `gcloud` CLI
- `curl`
- `jq` (optional, for better JSON formatting)

### Required Access
- GCP project with Dataproc enabled
- Service account with Dataproc permissions
- Existing cluster and job for testing

### Service Account Permissions
The service account should have these roles:
- `roles/dataproc.editor` or `roles/dataproc.admin`
- `roles/compute.viewer` (for cluster details)
- `roles/storage.objectViewer` (for job output)

## Expected Workflow

1. **Run the master test script:**
   ```bash
   ./tests/auth/run-all-auth-tests.sh
   ```

2. **Analyze the results:**
   - Check which authentication methods work
   - Identify patterns between working and failing tools
   - Review detailed logs for error messages

3. **Update MCP server code:**
   - Use the working authentication method in the MCP server
   - Fix the failing tools based on test results

4. **Validate fixes:**
   - Test the updated MCP server tools
   - Ensure all tools work consistently

## Common Issues and Solutions

### Issue: "No active account"
**Solution:** Run `gcloud auth login` to authenticate

### Issue: "Permission denied"
**Solution:** Verify service account has required permissions

### Issue: "Service account key file not found"
**Solution:** Check the path to the key file and ensure it exists

### Issue: "Impersonation failed"
**Solution:** Verify you have `roles/iam.serviceAccountTokenCreator` permission

## Test Results Interpretation

### All tests pass ✅
- Authentication is working correctly
- Issue may be in MCP server code implementation

### gcloud works, REST API fails ❌
- Token format or API endpoint issue
- Check token acquisition method in MCP server

### REST API works, gcloud fails ❌
- gcloud configuration issue
- Check project and authentication settings

### All tests fail ❌
- Fundamental authentication or permission issue
- Verify service account and permissions

## Files Generated

The test scripts generate log files in `/tmp/`:
- `/tmp/mcp-auth-test.log` - MCP configuration analysis
- `/tmp/gcloud-test.log` - gcloud command results
- `/tmp/rest-api-test.log` - REST API call results

Review these files for detailed error messages and debugging information.

## Next Steps After Testing

1. **Identify working authentication method**
2. **Update MCP server authentication code**
3. **Test MCP server tools**
4. **Document the final authentication configuration**

## Related Files

- `../../AUTHENTICATION_FIX_PLAN.md` - Comprehensive fix plan
- `../../AUTHENTICATION_TESTING_PLAN.md` - Detailed testing strategy
- `../../src/config/credentials.ts` - MCP server authentication code
- `../../src/services/job.ts` - Job-related tools implementation
- `../../src/services/cluster.ts` - Cluster-related tools implementation