#!/bin/bash

# Master test runner for authentication validation
# This script runs all authentication tests in the correct order

set -e

echo "=== Dataproc MCP Server Authentication Test Suite ==="
echo "This script will test all authentication methods to identify the root cause"
echo "of the MCP server tool failures."
echo ""

# Check if required tools are available
echo "=== Prerequisites Check ==="
MISSING_TOOLS=()

if ! command -v gcloud >/dev/null 2>&1; then
    MISSING_TOOLS+=("gcloud")
fi

if ! command -v curl >/dev/null 2>&1; then
    MISSING_TOOLS+=("curl")
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "⚠️  jq not found - JSON output will be less readable"
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo "❌ Missing required tools: ${MISSING_TOOLS[*]}"
    echo "Please install the missing tools and try again."
    exit 1
fi

echo "✅ All required tools are available"
echo ""

# Configuration check
echo "=== Configuration Check ==="
echo "Before running the tests, please ensure you have:"
echo "1. Updated the configuration variables in the test scripts"
echo "2. Access to a GCP project with Dataproc clusters"
echo "3. Appropriate permissions for the service account"
echo ""

read -p "Have you updated the configuration variables? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please update the following variables in the test scripts:"
    echo "- PROJECT_ID: Your GCP project ID"
    echo "- REGION: Your Dataproc region (e.g., us-central1)"
    echo "- CLUSTER_NAME: Name of an existing cluster for testing"
    echo "- JOB_ID: ID of an existing job for testing"
    echo ""
    echo "Files to update:"
    echo "- tests/auth/test-gcloud-commands.sh"
    echo "- tests/auth/test-rest-api.sh"
    echo ""
    exit 1
fi

# Run tests in order
echo "=== Running Authentication Tests ==="
echo ""

# Test 1: Current MCP configuration
echo "Step 1: Analyzing current MCP server authentication configuration..."
if ./tests/auth/test-mcp-auth-config.sh > /tmp/mcp-auth-test.log 2>&1; then
    echo "✅ MCP authentication analysis completed"
    echo "Key findings:"
    grep -E "✅|❌|⚠️" /tmp/mcp-auth-test.log | head -5
else
    echo "❌ MCP authentication analysis failed"
    echo "Error details:"
    tail -10 /tmp/mcp-auth-test.log
fi
echo ""

# Test 2: gcloud commands
echo "Step 2: Testing gcloud commands that correspond to MCP tools..."
if ./tests/auth/test-gcloud-commands.sh > /tmp/gcloud-test.log 2>&1; then
    echo "✅ gcloud command testing completed"
    echo "Success/failure summary:"
    grep -E "✅ SUCCESS|❌ FAILED" /tmp/gcloud-test.log | head -10
else
    echo "❌ gcloud command testing failed"
    echo "Error details:"
    tail -10 /tmp/gcloud-test.log
fi
echo ""

# Test 3: REST API calls
echo "Step 3: Testing REST API calls that MCP server uses..."
if ./tests/auth/test-rest-api.sh > /tmp/rest-api-test.log 2>&1; then
    echo "✅ REST API testing completed"
    echo "HTTP response summary:"
    grep -E "✅ SUCCESS|❌ FAILED" /tmp/rest-api-test.log | head -10
else
    echo "❌ REST API testing failed"
    echo "Error details:"
    tail -10 /tmp/rest-api-test.log
fi
echo ""

# Generate summary report
echo "=== Test Results Summary ==="
echo ""

echo "MCP Configuration Analysis:"
grep -E "Current authentication status|✅|❌" /tmp/mcp-auth-test.log | head -5

echo ""
echo "gcloud Command Results:"
grep -E "Testing:|✅ SUCCESS|❌ FAILED" /tmp/gcloud-test.log | grep -A1 "Testing:" | head -10

echo ""
echo "REST API Results:"
grep -E "Testing:|✅ SUCCESS|❌ FAILED" /tmp/rest-api-test.log | grep -A1 "Testing:" | head -10

echo ""
echo "=== Analysis and Next Steps ==="

# Analyze patterns
GCLOUD_SUCCESSES=$(grep -c "✅ SUCCESS" /tmp/gcloud-test.log 2>/dev/null || echo "0")
GCLOUD_FAILURES=$(grep -c "❌ FAILED" /tmp/gcloud-test.log 2>/dev/null || echo "0")
API_SUCCESSES=$(grep -c "✅ SUCCESS" /tmp/rest-api-test.log 2>/dev/null || echo "0")
API_FAILURES=$(grep -c "❌ FAILED" /tmp/rest-api-test.log 2>/dev/null || echo "0")

echo "gcloud commands: $GCLOUD_SUCCESSES successes, $GCLOUD_FAILURES failures"
echo "REST API calls: $API_SUCCESSES successes, $API_FAILURES failures"
echo ""

if [ "$GCLOUD_SUCCESSES" -gt 0 ] && [ "$API_SUCCESSES" -gt 0 ]; then
    echo "✅ Both gcloud and REST API calls are working with some authentication methods"
    echo "Next steps:"
    echo "1. Review detailed logs to identify which authentication method works best"
    echo "2. Update MCP server code to use the working authentication method"
    echo "3. Test the updated MCP server tools"
elif [ "$GCLOUD_SUCCESSES" -gt 0 ]; then
    echo "⚠️  gcloud commands work but REST API calls are failing"
    echo "This suggests an issue with token format or API endpoint configuration"
    echo "Next steps:"
    echo "1. Check token format differences between working and failing methods"
    echo "2. Verify API endpoint URLs and request format"
elif [ "$API_SUCCESSES" -gt 0 ]; then
    echo "⚠️  REST API calls work but gcloud commands are failing"
    echo "This suggests a gcloud configuration issue"
    echo "Next steps:"
    echo "1. Check gcloud authentication and project configuration"
    echo "2. Verify service account permissions"
else
    echo "❌ Both gcloud and REST API calls are failing"
    echo "This suggests a fundamental authentication or permission issue"
    echo "Next steps:"
    echo "1. Verify service account exists and has correct permissions"
    echo "2. Check if the service account key file is valid"
    echo "3. Verify project ID and region settings"
fi

echo ""
echo "Detailed logs saved to:"
echo "- MCP config: /tmp/mcp-auth-test.log"
echo "- gcloud tests: /tmp/gcloud-test.log"
echo "- REST API tests: /tmp/rest-api-test.log"
echo ""
echo "Review these logs for detailed error messages and authentication patterns."