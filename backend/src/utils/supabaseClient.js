// Smart-Fleet IoT — Supabase Client (singleton)
// TanQHoang © 2026
// Uses ANON key for all user-facing queries. RLS enforces data access.
// NEVER use SERVICE_ROLE_KEY in user-facing endpoints (see CLAUDE.md ADR-004).

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin client — only for server-side operations that bypass RLS (migrations, cron jobs)
// Do NOT export this for use in controllers or services
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabase, supabaseAdmin };
