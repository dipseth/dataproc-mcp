#!/bin/bash

# Set environment variables for testing
export TEST_PROJECT_ID="prj-grp-data-sci-prod-b425"
export TEST_REGION="us-central1"
export TEST_CLUSTER="cool-idea-api-v202504002"

# Run the verification script
echo "Running verification script..."
node verify-fix.js