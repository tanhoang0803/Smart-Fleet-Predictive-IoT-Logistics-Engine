#!/bin/bash
# Smart-Fleet IoT — First-time setup
# TanQHoang © 2026

set -e

echo "🏍️  Smart-Fleet IoT Setup"
echo "========================="

# Check .env exists
if [ ! -f ".env" ]; then
  echo "⚠️  .env not found. Copying from .env.example..."
  cp .env.example .env
  echo "✅ .env created — fill in your API keys before running."
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm ci && cd ..
echo "✅ Backend dependencies installed."

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend && npm ci && cd ..
echo "✅ Frontend dependencies installed."

# Pull Docker images
echo ""
echo "🐳 Pulling Docker images..."
docker pull node:18-alpine
docker pull nginx:1.25-alpine
docker pull redis:7-alpine
echo "✅ Docker images pulled."

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in your API keys in .env"
echo "  2. Run: bash scripts/migrate.sh  (to set up the database)"
echo "  3. Run: bash scripts/dev.sh      (to start local development)"
