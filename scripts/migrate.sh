#!/bin/bash
# Smart-Fleet IoT — Database migrations via Supabase CLI
# TanQHoang © 2026

set -e

echo "🗄️  Running Smart-Fleet database migrations..."

# Verify .env exists
if [ ! -f ".env" ]; then
  echo "❌ .env not found. Run: bash scripts/setup.sh"
  exit 1
fi

# Check supabase CLI is available
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found."
  echo "   Install: npm install -g supabase"
  echo "   Or via brew: brew install supabase/tap/supabase"
  exit 1
fi

export $(grep -v '^#' .env | grep -v '^$' | xargs)

echo "  Target: $SUPABASE_URL"
echo ""

# Apply SQL migration files from docs/database.md manually if using Supabase dashboard,
# OR use supabase db push for local development.
supabase db push --db-url "$SUPABASE_URL" 2>/dev/null || {
  echo ""
  echo "ℹ️  Supabase CLI push failed or not linked."
  echo "   Manual option: Copy SQL from docs/database.md into Supabase SQL Editor."
  echo "   Dashboard: https://supabase.com/dashboard/project/_/sql/new"
  exit 0
}

echo ""
echo "✅ Migrations applied successfully."
