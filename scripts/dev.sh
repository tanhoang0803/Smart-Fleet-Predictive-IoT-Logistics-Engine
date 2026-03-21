#!/bin/bash
# Smart-Fleet IoT — Local development
# TanQHoang © 2026
# Starts frontend (port 5173) + backend (port 3001) concurrently

set -e

echo "🏍️  Starting Smart-Fleet IoT in development mode..."
echo ""

# Verify .env exists
if [ ! -f ".env" ]; then
  echo "❌ .env not found. Run: bash scripts/setup.sh"
  exit 1
fi

# Load env for port display
export $(grep -v '^#' .env | grep -v '^$' | xargs)

echo "  Frontend → http://localhost:5173"
echo "  Backend  → http://localhost:${PORT:-3001}"
echo "  API      → http://localhost:${PORT:-3001}/api/v1"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Start both servers concurrently
npx concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "blue,green" \
  --kill-others-on-fail \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev"
