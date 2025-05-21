#!/bin/bash

# This script runs the integration test for the getDataprocJobResults function fix

# Set environment variables for testing
export TEST_PROJECT_ID="prj-grp-data-sci-prod-b425"
export TEST_REGION="us-central1"
export TEST_CLUSTER="pricing-api-v202504002"

# Create a temporary tsconfig for testing
echo "Creating temporary tsconfig for testing..."
cat > tsconfig.test.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "types": [
      "node",
      "mocha",
      "chai"
    ]
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "build"
  ],
  "ts-node": {
    "esm": true,
    "experimentalSpecifierResolution": "node"
  }
}
EOF

echo "Running the integration test..."
npx mocha --require ts-node/register --project tsconfig.test.json tests/integration/test-job-results.ts --timeout 60000

# Clean up
echo "Cleaning up..."
rm tsconfig.test.json

echo "Test completed!"