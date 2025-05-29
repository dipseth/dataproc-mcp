# MCP Server Restart Instructions

## Current Status
✅ **Code fixes are working correctly** - Our test confirms:
- Service Account: `loc-sa-pricing-promo-dataproc@prj-grp-data-sci-prod-b425.iam.gserviceaccount.com`
- Labels are properly extracted from profile
- Configuration transformation is working

❌ **MCP Server needs restart** - The running MCP server process is still using old code

## How to Restart MCP Server

### Option 1: Restart from VS Code
1. Open VS Code Command Palette (`Cmd+Shift+P`)
2. Search for "MCP: Restart Server"
3. Select the `dataproc-server1` server
4. Wait for restart to complete

### Option 2: Manual Restart
1. Stop the current MCP server process
2. Restart VS Code or reload the MCP extension
3. The server will automatically restart with new code

## Verification Steps After Restart

1. **Test Profile Loading:**
```bash
# This should show the production profile
```

2. **Test Cluster Creation:**
```bash
# Try creating a cluster - should now use correct service account
```

## Expected Results After Restart

- ✅ Service account should be: `loc-sa-pricing-promo-dataproc@prj-grp-data-sci-prod-b425.iam.gserviceaccount.com`
- ✅ Subnetwork should be: `projects/prj-grp-shared-vpc-prod-2511/regions/us-central1/subnetworks/sub-vpc-prod-sharedvpc01-us-central1-private`
- ✅ Labels should be included in API request
- ✅ Debug logging should show detailed configuration processing

## Debug Logging
With `LOG_LEVEL=debug` enabled, you should see:
- `[DEBUG] ClusterManager: Loaded config:` - showing full configuration
- `[DEBUG] ClusterManager: Loaded labels:` - showing extracted labels
- `[DEBUG] createClusterWithRest: Request body:` - showing API request structure

The fix is complete and tested - just needs the server restart to take effect!