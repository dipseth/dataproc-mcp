#!/bin/bash

# Test script for validating REST API authentication methods
# This script tests the REST API calls that the MCP server uses

set -e

# Configuration - UPDATED VALUES
PROJECT_ID="prj-grp-data-sci-prod-b425"
REGION="us-central1"
CLUSTER_NAME="test-pricing-cluster-fixed"
JOB_ID="your-job-id"              # UPDATE WITH ACTUAL JOB ID WHEN AVAILABLE
SERVICE_ACCOUNT="grpn-sa-terraform-ds-pnp@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com"
KEY_FILE="/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json"

echo "=== Dataproc REST API Authentication Testing ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Cluster: $CLUSTER_NAME"
echo "Job ID: $JOB_ID"
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

# Function to test REST API call
test_api_call() {
    local description="$1"
    local url="$2"
    local token="$3"
    
    echo "Testing: $description"
    echo "URL: $url"
    echo "Token preview: ${token:0:20}..."
    
    local response_code=$(curl -s -o /tmp/api_response -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        "$url")
    
    if [ "$response_code" = "200" ]; then
        echo "✅ SUCCESS (HTTP $response_code)"
        echo "Response preview:"
        head -10 /tmp/api_response | jq -r '.' 2>/dev/null | head -5 | sed 's/^/  /' || head -5 /tmp/api_response | sed 's/^/  /'
    else
        echo "❌ FAILED (HTTP $response_code)"
        echo "Error response:"
        cat /tmp/api_response | jq -r '.' 2>/dev/null | sed 's/^/  /' || cat /tmp/api_response | sed 's/^/  /'
    fi
    echo ""
}

# Test Method 1: Service Account Key File
echo "=== METHOD 1: Service Account Key File ==="
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"

echo "Getting access token with service account key..."
TOKEN1=$(gcloud auth print-access-token 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Token obtained successfully"
    
    # Test API endpoints that correspond to failing MCP tools
    test_api_call "Job Status API (get_job_status)" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/jobs/$JOB_ID" \
        "$TOKEN1"
    
    test_api_call "Cluster Details API (get_cluster)" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters/$CLUSTER_NAME" \
        "$TOKEN1"
    
    test_api_call "List Clusters API (working tool)" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters" \
        "$TOKEN1"
else
    echo "❌ Failed to get token with service account key"
fi

# Test Method 2: Service Account Impersonation
echo "=== METHOD 2: Service Account Impersonation ==="
unset GOOGLE_APPLICATION_CREDENTIALS

echo "Getting access token with impersonation..."
TOKEN2=$(gcloud auth print-access-token --impersonate-service-account=$SERVICE_ACCOUNT 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Token obtained successfully with impersonation"
    
    test_api_call "Job Status API with Impersonation" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/jobs/$JOB_ID" \
        "$TOKEN2"
    
    test_api_call "Cluster Details API with Impersonation" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters/$CLUSTER_NAME" \
        "$TOKEN2"
    
    test_api_call "List Clusters API with Impersonation" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters" \
        "$TOKEN2"
else
    echo "❌ Failed to get token with impersonation"
fi

# Test Method 3: Application Default Credentials
echo "=== METHOD 3: Application Default Credentials ==="
unset GOOGLE_APPLICATION_CREDENTIALS

echo "Getting access token with ADC..."
TOKEN3=$(gcloud auth print-access-token 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Token obtained successfully with ADC"
    
    test_api_call "Job Status API with ADC" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/jobs/$JOB_ID" \
        "$TOKEN3"
    
    test_api_call "Cluster Details API with ADC" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters/$CLUSTER_NAME" \
        "$TOKEN3"
    
    test_api_call "List Clusters API with ADC" \
        "https://$REGION-dataproc.googleapis.com/v1/projects/$PROJECT_ID/regions/$REGION/clusters" \
        "$TOKEN3"
else
    echo "❌ Failed to get token with ADC"
fi

# Test token comparison
echo "=== TOKEN COMPARISON ==="
if [ ! -z "$TOKEN1" ] && [ ! -z "$TOKEN2" ] && [ ! -z "$TOKEN3" ]; then
    echo "Service Account Key token: ${TOKEN1:0:50}..."
    echo "Impersonation token: ${TOKEN2:0:50}..."
    echo "ADC token: ${TOKEN3:0:50}..."
    
    if [ "$TOKEN1" = "$TOKEN2" ]; then
        echo "✅ Service Account Key and Impersonation tokens are identical"
    else
        echo "⚠️  Service Account Key and Impersonation tokens are different"
    fi
    
    if [ "$TOKEN1" = "$TOKEN3" ]; then
        echo "✅ Service Account Key and ADC tokens are identical"
    else
        echo "⚠️  Service Account Key and ADC tokens are different"
    fi
fi

echo ""
echo "=== REST API Testing Complete ==="
echo "Review the results above to determine which authentication method works for REST API calls."
echo ""
echo "Key findings to look for:"
echo "1. Which authentication method successfully gets tokens"
echo "2. Which REST API endpoints return HTTP 200 vs errors"
echo "3. Whether the failing MCP tools correspond to failing REST API calls"
echo "4. Any differences in token format or content between methods"