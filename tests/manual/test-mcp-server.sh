#!/bin/bash

# Build the project
echo "Building the project..."
npm run build

# Set environment variables
export LOG_LEVEL=debug

# Start the MCP server with the inspector
echo "Starting the MCP server with inspector..."
echo "Press Ctrl+C to stop the server when done testing"

# Run the server with the MCP inspector
npx @modelcontextprotocol/inspector build/index.js