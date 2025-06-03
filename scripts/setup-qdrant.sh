#!/bin/bash

# Qdrant Setup Script for Dataproc MCP Server
# This script sets up Qdrant vector database for semantic search

set -e

echo "🐳 Setting up Qdrant for Dataproc MCP Server..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop existing Qdrant containers
echo "🛑 Stopping existing Qdrant containers..."
docker stop dataproc-qdrant 2>/dev/null || true
docker rm dataproc-qdrant 2>/dev/null || true

# Start Qdrant using Docker Compose
echo "🚀 Starting Qdrant with Docker Compose..."
docker-compose -f docker-compose.qdrant.yml up -d

# Wait for Qdrant to be ready
echo "⏳ Waiting for Qdrant to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:6334/health > /dev/null 2>&1; then
        echo "✅ Qdrant is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Qdrant failed to start after 30 seconds"
        docker-compose -f docker-compose.qdrant.yml logs
        exit 1
    fi
    sleep 1
done

# Verify Qdrant health
echo "🔍 Verifying Qdrant health..."
HEALTH_RESPONSE=$(curl -s http://localhost:6334/health)
echo "Health check response: $HEALTH_RESPONSE"

# Check collections
echo "📊 Checking existing collections..."
curl -s http://localhost:6334/collections | jq '.' || echo "No collections yet (this is normal)"

echo ""
echo "🎉 Qdrant setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "  • Qdrant URL: http://localhost:6334"
echo "  • Container: dataproc-qdrant"
echo "  • Storage: Persistent volume (qdrant_storage)"
echo "  • Health endpoint: http://localhost:6334/health"
echo ""
echo "🔧 Next Steps:"
echo "  1. Restart your MCP server to enable semantic search"
echo "  2. Test with: query_cluster_data or list_clusters with semanticQuery"
echo "  3. Check logs: docker-compose -f docker-compose.qdrant.yml logs"
echo ""
echo "🛑 To stop: docker-compose -f docker-compose.qdrant.yml down"
echo "🗑️  To reset: docker-compose -f docker-compose.qdrant.yml down -v"