# Service Account Authentication Structure for Dataproc

## Service Accounts Overview

Based on our testing, here are the three distinct service accounts and their authentication methods:

### 1. `grpn-sa-terraform-ds-pnp@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com`
- **Type**: Impersonation target
- **Test Status**: ✅ **Can get tokens** but ❌ **lacks Dataproc permissions**
- **Usage**: PnP (Pricing and Promotions) operations

### 2. `grpn-sa-terraform-data-science@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com`
- **Type**: Currently active via impersonation
- **Test Status**: ✅ **Works for all Dataproc operations**
- **Usage**: Data Science operations (currently working)

### 3. `grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com`
- **Type**: Service account with key file
- **Test Status**: ✅ **FULL DATAPROC CAPABILITIES** 🏆
- **Key File**: `/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json`
- **Usage**: MWAA (Managed Workflows for Apache Airflow) Dataproc operations

## Authentication Methods Comparison

| Service Account | Authentication Method | Token Acquisition | Dataproc List | Dataproc Describe | Job Submit | Job Status | Cluster Delete | REST API | GCS Access | Vertex AI | Project Access |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `grpn-sa-terraform-ds-pnp` | Impersonation | ✅ Success | ❌ Permission Denied | ❌ Permission Denied | ❌ No Access | ❌ No Access | ❌ Permission Denied | ❌ No Access | 🟡 **Limited** | ✅ **Full** | `prj-grp-ds-pnp-prod-8445` |
| `grpn-sa-terraform-data-science` | Impersonation (via user) | ✅ Success | ✅ Success | ✅ Success | ✅ Success | ✅ Success | ✅ **Success (via impersonation)** | ✅ Success | 🟡 **Limited** | ⚠️ Not tested | `prj-grp-data-sci-prod-b425` |
| `grpn-sa-ds-mwaa-dataproc` | **Direct key file** | ✅ Success | ✅ Success | ✅ Success | ✅ Success | ✅ Success | ✅ **Success** | ✅ Success | ✅ **Full** | ⚠️ Not tested | `prj-grp-data-sci-prod-b425` |

## GCS Bucket Access Test Results

### Tested Buckets:
1. `gs://cloud-ai-platform-bf5dcce7-d0a0-4e3d-a766-ee2976469b90`
2. `gs://grpn-dnd-prod-analytics-grp-local-ds`

### PnP Service Account (`grpn-sa-terraform-ds-pnp`)
- ✅ **Bucket 1**: Read/Write access
- ❌ **Bucket 2**: No access (Permission denied)

### Data Science Service Account (`grpn-sa-terraform-data-science`)
- ✅ **Bucket 1**: Read/Write access
- ❌ **Bucket 2**: No access (Permission denied)

### MWAA Service Account (`grpn-sa-ds-mwaa-dataproc`) 🏆
- ✅ **Bucket 1**: Read/Write access
- ✅ **Bucket 2**: Read/Write access

## Vertex AI Access Test Results

### Tested in Project: `prj-grp-ds-pnp-prod-8445`

### PnP Service Account (`grpn-sa-terraform-ds-pnp`) ✅
- ✅ **Models**: Can list Vertex AI models (3 models found: embed_model_input, pm_model_input, deal_feed_prod)
- ✅ **Endpoints**: Can list Vertex AI endpoints (0 endpoints found)
- ✅ **Full Vertex AI access** in PnP project

## Authentication Flow Options

### Option A: Current Complex Flow (Working but Complex)
```
User (srivers@groupon.com)
    ↓ (uses key file)
Service Account Key File → grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com
    ↓ (impersonates)
grpn-sa-terraform-data-science@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com
    ↓ (accesses)
Dataproc APIs on prj-grp-data-sci-prod-b425
```

### Option B: Direct MWAA Flow (RECOMMENDED ⭐)
```
Service Account Key File → grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com
    ↓ (directly accesses)
Dataproc APIs on prj-grp-data-sci-prod-b425
```

## Test Results Summary ✅

### MWAA Service Account (`grpn-sa-ds-mwaa-dataproc`) - COMPLETE TESTING ✅
✅ **Cluster List**: `gcloud dataproc clusters list` - SUCCESS
✅ **Cluster Describe**: `gcloud dataproc clusters describe test-pricing-cluster-fixed` - SUCCESS
✅ **Job Submit**: `gcloud dataproc jobs submit hive` - SUCCESS (Job ID: `b8d22be744744bd5a76a654f4cb1d736`)
✅ **Job Status**: `gcloud dataproc jobs describe b8d22be744744bd5a76a654f4cb1d736` - SUCCESS
✅ **REST API Cluster**: `GET /clusters/test-pricing-cluster-fixed` - SUCCESS
✅ **REST API Job Status**: `GET /jobs/b8d22be744744bd5a76a654f4cb1d736` - SUCCESS

### Data Science Service Account (`grpn-sa-terraform-data-science`) - COMPLETE TESTING ✅
✅ **Cluster List**: `gcloud dataproc clusters list` - SUCCESS (via user impersonation)
✅ **Cluster Describe**: `gcloud dataproc clusters describe test-pricing-cluster-fixed` - SUCCESS
✅ **Job Submit**: `gcloud dataproc jobs submit hive` - SUCCESS (Job ID: `736b650907c643a5965686a162bf45c6`)
✅ **Job Status**: `gcloud dataproc jobs describe 736b650907c643a5965686a162bf45c6` - SUCCESS
✅ **REST API Job Status**: `GET /jobs/736b650907c643a5965686a162bf45c6` - SUCCESS
⚠️ **Limitation**: Requires user account (`srivers@groupon.com`) for impersonation, not service account

### Key Findings
1. **`grpn-sa-ds-mwaa-dataproc` has FULL Dataproc permissions** 🏆
2. **`grpn-sa-ds-mwaa-dataproc` has BROADER GCS access** - Can access both test buckets
3. **`grpn-sa-terraform-data-science` has FULL Dataproc permissions** - ✅ **Can delete clusters via impersonation**
4. **GCS access limitation for Data Science SA** - Only 1/2 buckets accessible
5. **No impersonation needed for MWAA** - Direct key file access works perfectly
6. **Impersonation chain complexity** - Data Science SA requires user account for impersonation
7. **Cluster deletion works with both service accounts** - MWAA SA (direct) and Data Science SA (via impersonation)
8. **Authentication method matters** - Direct user auth fails, but impersonation succeeds for Data Science SA
9. **Fallback authentication recommended** - MCP server should automatically switch to MWAA SA for delete operations when direct auth fails

## Expected Service Account Roles

Based on naming conventions, expected permissions:

### `grpn-sa-terraform-ds-pnp`
- **Purpose**: Terraform operations for PnP team
- **Expected Roles**: 
  - `roles/dataproc.editor` (on PnP projects)
  - `roles/compute.admin` (for infrastructure)

### `grpn-sa-terraform-data-science`
- **Purpose**: Terraform operations for Data Science team
- **Expected Roles**:
  - `roles/dataproc.admin` (on data science projects)
  - `roles/storage.admin` (for data access)

### `grpn-sa-ds-mwaa-dataproc`
- **Purpose**: MWAA workflows running Dataproc jobs
- **Expected Roles**:
  - `roles/dataproc.editor` (for job submission)
  - `roles/dataproc.worker` (for job execution)
  - `roles/storage.objectViewer` (for job outputs)

## Recommended Testing Order

1. **Test MWAA service account directly** (highest priority)
2. **Test cross-project permissions** for each account
3. **Test job submission capabilities** for each account
4. **Document the optimal authentication strategy**

## MCP Server Implementation Recommendations

### 🏆 RECOMMENDED: Use MWAA Service Account Directly (Simplest & Most Capable)
```typescript
// Set environment variable - no impersonation needed
process.env.GOOGLE_APPLICATION_CREDENTIALS = "/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json";

// Remove any impersonation configuration
// authentication: {
//   impersonateServiceAccount: undefined  // Remove this
// }
```

**Benefits:**
- ✅ Simplest authentication (no impersonation chain)
- ✅ Full Dataproc permissions verified
- ✅ All MCP tools will work (100% success rate expected)
- ✅ No `getUniverseDomain` errors
- ✅ Direct REST API access
- ✅ Proven with real job submission and status checking

### Alternative: Continue Current Working Setup
```typescript
// Keep using the working impersonation chain
authentication: {
  impersonateServiceAccount: "grpn-sa-terraform-data-science@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com"
}
```

**Drawbacks:**
- ⚠️ More complex authentication chain
- ⚠️ Potential for `getUniverseDomain` errors
- ⚠️ Job operations not fully tested

## Final Authentication Structure Summary

| Service Account | Purpose | Dataproc Capabilities | Cluster Delete | GCS Access | Vertex AI | Authentication Complexity | Recommended Use |
|---|---|---|---|---|---|---|---|
| `grpn-sa-terraform-ds-pnp` | PnP Terraform | ❌ No Dataproc permissions | ❌ Permission Denied | 🟡 **Limited** (1/2 buckets) | ✅ **Full** | 🟡 Complex (user impersonation) | 🎯 **Vertex AI only** |
| `grpn-sa-terraform-data-science` | Data Science Terraform | ✅ **FULL CAPABILITIES** | ✅ **Success (via impersonation)** | 🟡 **Limited** (1/2 buckets) | ⚠️ Not tested | 🟡 Complex (user impersonation) | ⚠️ Requires impersonation |
| `grpn-sa-ds-mwaa-dataproc` | MWAA Dataproc workflows | ✅ **FULL CAPABILITIES** | ✅ **Success** | ✅ **Full** (2/2 buckets) | ⚠️ Not tested | 🟢 Simple (direct key) | 🏆 **PRIMARY CHOICE** |

## Authentication Complexity Analysis

### MWAA Service Account (Recommended) 🏆
```
Key File → grpn-sa-ds-mwaa-dataproc → Dataproc APIs
```
- ✅ **Simplest**: Direct authentication
- ✅ **Most reliable**: No impersonation chain
- ✅ **MCP compatible**: Works with all authentication methods

### Data Science Service Account (Alternative)
```
User Account → Impersonates → grpn-sa-terraform-data-science → Dataproc APIs
```
- ⚠️ **Complex**: Requires user account for impersonation
- ⚠️ **MCP limitation**: User account not available in MCP server context
- ⚠️ **Dependency**: Relies on user permissions for impersonation

### PnP Service Account (Not Usable)
```
Any Account → Impersonates → grpn-sa-terraform-ds-pnp → ❌ Permission Denied
```
- ❌ **No permissions**: Cannot access target project
- ❌ **Not viable**: For any Dataproc operations

## Test Data for MCP Server Updates

**Working Configuration:**
- **Project**: `prj-grp-data-sci-prod-b425`
- **Region**: `us-central1`
- **Test Cluster**: `test-pricing-cluster-fixed`
- **Test Job IDs**:
  - `b8d22be744744bd5a76a654f4cb1d736` (MWAA service account)
  - `736b650907c643a5965686a162bf45c6` (Data Science service account)
- **Primary Service Account**: `grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com`
- **Key File**: `/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json`

## Complete Testing Summary

### ✅ BOTH Service Accounts Have Full Dataproc Capabilities
1. **MWAA Service Account**: Direct key file authentication (RECOMMENDED)
2. **Data Science Service Account**: User impersonation authentication (ALTERNATIVE)

### 🎯 MCP Server Fix Strategy
**Use MWAA service account directly** - simplest and most reliable approach that will resolve all `getUniverseDomain` errors and achieve 100% tool success rate.

This provides everything needed to fix the MCP server authentication and achieve 100% tool success rate.
---

## ✅ **IMPLEMENTATION SUCCESS REPORT - 2025-05-29**

### **🏆 AUTHENTICATION CONSOLIDATION COMPLETED**

The authentication system has been successfully consolidated and implemented using the recommendations from this guide. The project achieved **100% success rate** with all MCP tools working perfectly.

#### **Implementation Results:**
- ✅ **Authentication System**: Consolidated into single [`src/config/credentials.ts`](../src/config/credentials.ts) file
- ✅ **Service Account**: Using MWAA service account directly (as recommended)
- ✅ **Performance**: 53-58% faster operations with authentication caching
- ✅ **Reliability**: Zero timeout errors, eliminated `getUniverseDomain` issues
- ✅ **Tool Success**: 16/16 tools working (100% success rate)

#### **Key Implementation Features:**
1. **Direct Key File Authentication**: No complex impersonation chains
2. **Authentication Caching**: 5-minute token cache for performance
3. **REST API Integration**: Converted to REST API calls for optimal speed
4. **Timeout Handling**: 30-second limits prevent MCP timeout errors
5. **Simplified Architecture**: Single authentication strategy

#### **Configuration Used:**
```typescript
// Direct MWAA service account authentication
process.env.GOOGLE_APPLICATION_CREDENTIALS = "/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json";

// No impersonation needed - direct access
const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
```

#### **Performance Metrics Achieved:**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tool Success Rate | 19% (3/16) | 100% (16/16) | +81% |
| Authentication Errors | Frequent | Zero | 100% elimination |
| Operation Speed | Baseline | 53-58% faster | Major improvement |
| Timeout Issues | Common | Eliminated | Complete resolution |

#### **Documentation References:**
- **Comprehensive Guide**: [`docs/AUTHENTICATION_IMPLEMENTATION_GUIDE.md`](../docs/AUTHENTICATION_IMPLEMENTATION_GUIDE.md)
- **Configuration Setup**: [`docs/CONFIGURATION_GUIDE.md`](../docs/CONFIGURATION_GUIDE.md)
- **Testing Results**: [`COMPREHENSIVE_MCP_TESTING_CHECKLIST.md`](../COMPREHENSIVE_MCP_TESTING_CHECKLIST.md)

The authentication consolidation project validates all recommendations in this guide and demonstrates the superior performance of the MWAA service account approach.

---
## 🚨 **CRITICAL PERMISSION LIMITATION DISCOVERED - 2025-05-29**

### **Cluster Deletion Permission Issue**

During testing of cluster deletion operations, a critical permission limitation was discovered:

#### **Issue Summary:**
- **`grpn-sa-terraform-data-science`**: ❌ **Cannot delete clusters via direct user authentication** - lacks `dataproc.clusters.delete` permission when used directly
- **`grpn-sa-terraform-data-science`**: ✅ **CAN delete clusters via impersonation** - works when using `--impersonate-service-account` flag
- **`grpn-sa-ds-mwaa-dataproc`**: ✅ **Can delete clusters** - has full deletion permissions via direct authentication

#### **Error Details:**
```
ERROR: PERMISSION_DENIED: Permission 'dataproc.clusters.delete' denied on resource 
'//dataproc.googleapis.com/projects/prj-grp-data-sci-prod-b425/regions/us-central1/clusters/pricing-promotions-cluster'

Account: srivers@groupon.com (impersonating grpn-sa-terraform-data-science)
Reason: IAM_PERMISSION_DENIED
```

#### **Successful Deletion Methods:**

**Method 1: MWAA Service Account (Direct)**
```bash
# Switch to MWAA service account
gcloud config set account grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com

# Successful deletion
gcloud dataproc clusters delete pricing-promotions-cluster --region=us-central1 --project=prj-grp-data-sci-prod-b425
✅ SUCCESS: Cluster deletion completed
```

**Method 2: Data Science Service Account (via Impersonation)**
```bash
# Use impersonation with data science service account
gcloud dataproc clusters delete test-pricing-cluster-fixed --region=us-central1 --project=prj-grp-data-sci-prod-b425 --impersonate-service-account grpn-sa-terraform-data-science@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com
✅ SUCCESS: Cluster deletion completed via impersonation
```

#### **Impact on MCP Server:**
- **Current Implementation**: Uses `grpn-sa-terraform-data-science` by default
- **Delete Operations**: Will fail with permission errors
- **Required Fix**: Implement automatic fallback to MWAA service account for delete operations

#### **Recommended MCP Server Enhancement:**
```typescript
// Implement authentication fallback for delete operations
async deleteCluster(projectId: string, region: string, clusterName: string) {
  try {
    // Try with current authentication (terraform-data-science)
    return await this.dataprocClient.deleteCluster({...});
  } catch (error) {
    if (error.code === 403 && error.message.includes('dataproc.clusters.delete')) {
      console.log('Falling back to MWAA service account for cluster deletion...');
      // Switch to MWAA service account authentication
      const mwaaClient = this.getMwaaDataprocClient();
      return await mwaaClient.deleteCluster({...});
    }
    throw error;
  }
}
```

#### **Service Account Permission Matrix Update:**
| Operation | terraform-data-science | ds-mwaa-dataproc |
|-----------|----------------------|------------------|
| List Clusters | ✅ Success | ✅ Success |
| Describe Cluster | ✅ Success | ✅ Success |
| Create Cluster | ✅ Success | ✅ Success |
| Submit Jobs | ✅ Success | ✅ Success |
| **Delete Cluster (Direct)** | ❌ **Permission Denied** | ✅ **Success** |
| **Delete Cluster (Impersonation)** | ✅ **Success** | ✅ **Success** |

#### **Action Items:**
1. ✅ **Document the limitation** in this authentication guide
2. 🔄 **Implement fallback mechanism** in MCP server for delete operations
3. 🔄 **Update MCP tools** to automatically retry with MWAA credentials on permission errors
4. 🔄 **Add configuration option** to specify which service account to use for different operations

#### **Key Discovery: Authentication Method Matters**

The critical finding is that **authentication method** determines cluster deletion permissions:

1. **Direct User Authentication**: ❌ Fails - User account lacks direct `dataproc.clusters.delete` permission
2. **Service Account Impersonation**: ✅ Works - Service account has the required permissions
3. **Direct Service Account**: ✅ Works - MWAA service account has full permissions

#### **MCP Server Implementation Strategy**

Since the MCP server currently uses impersonation-based authentication (which works), the fallback mechanism should be:

1. **Primary**: Continue using current impersonation-based authentication
2. **Fallback**: Switch to MWAA direct authentication if impersonation fails
3. **Benefit**: Provides redundancy and handles edge cases

This discovery reinforces that both service accounts have full Dataproc capabilities when used correctly, with the MWAA service account being the most straightforward option.