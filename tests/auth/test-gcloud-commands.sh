#!/bin/bash

# Test script for validating gcloud authentication methods
# This script tests the gcloud commands that correspond to failing MCP tools

set -e

# Configuration - UPDATED VALUES
PROJECT_ID="test-project-1234"
REGION="us-central1"
CLUSTER_NAME="test-cool-idea-cluster-fixed"
JOB_ID="your-job-id"              # UPDATE WITH ACTUAL JOB ID WHEN AVAILABLE
SERVICE_ACCOUNT="grpn-sa-terraform-ds-pnp@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com"
KEY_FILE="/Users/user123/Repositories/path/to/prod/keyfile.json"

echo "=== Dataproc Authentication Testing ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Cluster: $CLUSTER_NAME"
echo "Job ID: $JOB_ID"
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

# Function to test a command with error handling
test_command() {
    local description="$1"
    local command="$2"
    
    echo "Testing: $description"
    echo "Command: $command"
    
    if eval "$command" > /tmp/test_output 2>&1; then
        echo "✅ SUCCESS"
        echo "Output preview:"
        head -5 /tmp/test_output | sed 's/^/  /'
    else
        echo "❌ FAILED"
        echo "Error output:"
        cat /tmp/test_output | sed 's/^/  /'
    fi
    echo ""
}

# Test Method 1: Service Account Key File
echo "=== METHOD 1: Service Account Key File ==="
export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"

echo "Current authentication:"
gcloud auth list --filter=status:ACTIVE --format="value(account)"
echo ""

# Test commands that correspond to failing MCP tools
test_command "Job Status (get_job_status)" \
    "gcloud dataproc jobs describe $JOB_ID --region=$REGION --project=$PROJECT_ID --format=json"

test_command "Cluster Details (get_cluster)" \
    "gcloud dataproc clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID --format=json"

test_command "List Clusters (working tool for comparison)" \
    "gcloud dataproc clusters list --region=$REGION --project=$PROJECT_ID --format=json"

# Test Method 2: Service Account Impersonation
echo "=== METHOD 2: Service Account Impersonation ==="
unset GOOGLE_APPLICATION_CREDENTIALS

echo "Current authentication:"
gcloud auth list --filter=status:ACTIVE --format="value(account)"
echo ""

test_command "Job Status with Impersonation" \
    "gcloud dataproc jobs describe $JOB_ID --region=$REGION --project=$PROJECT_ID --impersonate-service-account=$SERVICE_ACCOUNT --format=json"

test_command "Cluster Details with Impersonation" \
    "gcloud dataproc clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID --impersonate-service-account=$SERVICE_ACCOUNT --format=json"

test_command "List Clusters with Impersonation" \
    "gcloud dataproc clusters list --region=$REGION --project=$PROJECT_ID --impersonate-service-account=$SERVICE_ACCOUNT --format=json"

# Test Method 3: Application Default Credentials
echo "=== METHOD 3: Application Default Credentials ==="
unset GOOGLE_APPLICATION_CREDENTIALS

echo "Current authentication:"
gcloud auth list --filter=status:ACTIVE --format="value(account)"
echo ""

test_command "Job Status with ADC" \
    "gcloud dataproc jobs describe $JOB_ID --region=$REGION --project=$PROJECT_ID --format=json"

test_command "Cluster Details with ADC" \
    "gcloud dataproc clusters describe $CLUSTER_NAME --region=$REGION --project=$PROJECT_ID --format=json"

test_command "List Clusters with ADC" \
    "gcloud dataproc clusters list --region=$REGION --project=$PROJECT_ID --format=json"

echo "=== Authentication Testing Complete ==="
echo "Review the results above to determine which authentication method works for each operation."
echo ""
echo "Next steps:"
echo "1. Update the PROJECT_ID, REGION, CLUSTER_NAME, and JOB_ID variables in this script"
echo "2. Run this script to test authentication methods"
echo "3. Use the working authentication method in the MCP server code"