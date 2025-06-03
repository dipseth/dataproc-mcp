#!/bin/bash

# Real-world agent usage test script
# This script builds the MCP server and runs real-world agent interaction tests

set -e

echo "🚀 Real-World Agent Usage Test for MCP Response Optimization"
echo "============================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the project root directory"
    exit 1
fi

# Build the project
echo "🔨 Building MCP server..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix compilation errors first."
    exit 1
fi

echo "✅ Build successful"

# Check if Qdrant is running (optional - the server will auto-start it)
echo "🔍 Checking Qdrant status..."
if curl -s http://localhost:6333/health > /dev/null 2>&1; then
    echo "✅ Qdrant is already running on port 6333"
else
    echo "ℹ️ Qdrant not running - MCP server will auto-start it"
fi

# Run the real-world test
echo ""
echo "🧪 Running real-world agent usage tests..."
echo "This will:"
echo "  1. Start the MCP server with response optimization"
echo "  2. Simulate real LLM agent interactions"
echo "  3. Measure token reduction and performance"
echo "  4. Test verbose mode and resource retrieval"
echo "  5. Generate a comprehensive report"
echo ""

# Make the test file executable and run it
chmod +x tests/manual/test-real-agent-usage.ts

# Run with Node.js and TypeScript support
npx tsx tests/manual/test-real-agent-usage.ts

echo ""
echo "🎉 Real-world agent usage test complete!"
echo ""
echo "Next steps:"
echo "  - Review the test results above"
echo "  - If tests pass, the response optimization is working correctly"
echo "  - If tests fail, check the error messages and fix any issues"
echo "  - Run 'npm test' for additional unit and integration tests"