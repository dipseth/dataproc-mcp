#!/bin/bash

# Test script to analyze current MCP server authentication configuration
# This helps understand what authentication method the MCP server is currently using

set -e

echo "=== MCP Server Authentication Configuration Analysis ==="
echo ""

# Check current gcloud configuration
echo "=== Current gcloud Configuration ==="
echo "Active account:"
gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || echo "No active account"

echo ""
echo "Current project:"
gcloud config get-value project 2>/dev/null || echo "No project set"

echo ""
echo "Current region (if set):"
gcloud config get-value compute/region 2>/dev/null || echo "No region set"

echo ""
echo "Impersonation setting:"
gcloud config get-value auth/impersonate_service_account 2>/dev/null || echo "No impersonation configured"

# Check environment variables
echo ""
echo "=== Environment Variables ==="
echo "GOOGLE_APPLICATION_CREDENTIALS:"
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "  Set to: $GOOGLE_APPLICATION_CREDENTIALS"
    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo "  ✅ File exists"
        # Try to extract service account email from key file
        if command -v jq >/dev/null 2>&1; then
            SA_EMAIL=$(jq -r '.client_email' "$GOOGLE_APPLICATION_CREDENTIALS" 2>/dev/null || echo "Could not parse")
            echo "  Service Account: $SA_EMAIL"
        fi
    else
        echo "  ❌ File does not exist"
    fi
else
    echo "  Not set"
fi

echo ""
echo "USE_APPLICATION_DEFAULT:"
echo "  ${USE_APPLICATION_DEFAULT:-Not set}"

# Check if the specific service account key file exists
echo ""
echo "=== Service Account Key File Check ==="
KEY_FILE="/Users/srivers/Repositories/pricing-composer/orchestrator/classpath/gcp_prod_keyfile.json"
echo "Checking: $KEY_FILE"
if [ -f "$KEY_FILE" ]; then
    echo "✅ Service account key file exists"
    if command -v jq >/dev/null 2>&1; then
        SA_EMAIL=$(jq -r '.client_email' "$KEY_FILE" 2>/dev/null || echo "Could not parse")
        PROJECT_ID=$(jq -r '.project_id' "$KEY_FILE" 2>/dev/null || echo "Could not parse")
        echo "  Service Account: $SA_EMAIL"
        echo "  Project ID: $PROJECT_ID"
    fi
else
    echo "❌ Service account key file not found"
fi

# Test token acquisition with different methods
echo ""
echo "=== Token Acquisition Test ==="

# Test current configuration
echo "Current configuration token:"
if TOKEN_CURRENT=$(gcloud auth print-access-token 2>/dev/null); then
    echo "✅ Successfully obtained token with current configuration"
    echo "  Token preview: ${TOKEN_CURRENT:0:50}..."
else
    echo "❌ Failed to get token with current configuration"
fi

# Test with service account key
echo ""
echo "Service account key token:"
if [ -f "$KEY_FILE" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE"
    if TOKEN_SA=$(gcloud auth print-access-token 2>/dev/null); then
        echo "✅ Successfully obtained token with service account key"
        echo "  Token preview: ${TOKEN_SA:0:50}..."
    else
        echo "❌ Failed to get token with service account key"
    fi
    unset GOOGLE_APPLICATION_CREDENTIALS
else
    echo "⚠️  Service account key file not available for testing"
fi

# Test with impersonation
echo ""
echo "Impersonation token:"
SERVICE_ACCOUNT="grpn-sa-ds-mwaa-dataproc@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com"
if TOKEN_IMP=$(gcloud auth print-access-token --impersonate-service-account=$SERVICE_ACCOUNT 2>/dev/null); then
    echo "✅ Successfully obtained token with impersonation"
    echo "  Token preview: ${TOKEN_IMP:0:50}..."
else
    echo "❌ Failed to get token with impersonation"
    echo "  This might be due to missing permissions or incorrect service account"
fi

# Check MCP server configuration files
echo ""
echo "=== MCP Server Configuration Files ==="

# Check if server config exists
if [ -f "src/config/server.ts" ]; then
    echo "✅ Server config file exists: src/config/server.ts"
    echo "Authentication configuration:"
    grep -n -A 5 -B 5 "authentication\|impersonate\|serviceAccount" src/config/server.ts 2>/dev/null | head -20 || echo "  No authentication config found in server.ts"
else
    echo "❌ Server config file not found"
fi

echo ""
# Check credentials config
if [ -f "src/config/credentials.ts" ]; then
    echo "✅ Credentials config file exists: src/config/credentials.ts"
    echo "Key authentication functions:"
    grep -n "export.*function\|getGcloudAccessToken\|createDataprocClient\|createJobClient" src/config/credentials.ts | head -10
else
    echo "❌ Credentials config file not found"
fi

# Check for any environment-specific config files
echo ""
echo "=== Environment Configuration Files ==="
for config_file in .env .env.local config.json mcp_settings.json; do
    if [ -f "$config_file" ]; then
        echo "✅ Found: $config_file"
        if [[ "$config_file" == *.json ]]; then
            echo "  Content preview:"
            head -10 "$config_file" | sed 's/^/    /'
        fi
    fi
done

# Summary and recommendations
echo ""
echo "=== Summary and Recommendations ==="
echo ""
echo "Current authentication status:"

if [ -n "$TOKEN_CURRENT" ]; then
    echo "✅ Current configuration can obtain access tokens"
else
    echo "❌ Current configuration cannot obtain access tokens"
fi

if [ -f "$KEY_FILE" ] && [ -n "$TOKEN_SA" ]; then
    echo "✅ Service account key file is available and working"
else
    echo "❌ Service account key file is not available or not working"
fi

if [ -n "$TOKEN_IMP" ]; then
    echo "✅ Service account impersonation is working"
else
    echo "❌ Service account impersonation is not working"
fi

echo ""
echo "Next steps:"
echo "1. Run the gcloud command tests: ./tests/auth/test-gcloud-commands.sh"
echo "2. Run the REST API tests: ./tests/auth/test-rest-api.sh"
echo "3. Update the MCP server to use the working authentication method"
echo "4. Test the MCP server tools after authentication fixes"