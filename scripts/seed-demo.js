#!/usr/bin/env node
// Smart-Fleet IoT — Demo User Seed Script
// TanQHoang © 2026
//
// Creates the demo account used on the login page:
//   Email:    demo@smartfleet.io
//   Password: demo1234
//
// Run from the project root:
//   node scripts/seed-demo.js
//
// Safe to re-run: skips creation if the user already exists.

'use strict';

const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('../backend/node_modules/@supabase/supabase-js');

const DEMO_EMAIL    = 'demo@smartfleet.io';
const DEMO_PASSWORD = 'demo1234';
const DEMO_NAME     = 'Demo User';

const DEMO_VEHICLE = {
  model:           'Honda Wave RSX',
  plate_number:    '51B-888.88',
  mileage_current: 4200,
  fuel_type:       'E10',
  lat:             10.7769,
  lon:             106.7009,
};

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: missing env var ${key}`);
    process.exit(1);
  }
}

// Admin client — bypasses RLS, required for user creation
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Smart-Fleet IoT — Demo Seed');
  console.log('============================');

  // ── 1. Create Supabase Auth user ──────────────────────────────────────────
  console.log(`\n[1/3] Creating Supabase Auth user (${DEMO_EMAIL})…`);
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email:         DEMO_EMAIL,
      password:      DEMO_PASSWORD,
      email_confirm: true,
    });

  let supabaseUid;

  if (authError) {
    if (authError.message?.toLowerCase().includes('already')) {
      console.log('      Auth user already exists — fetching uid…');
      const { data: list, error: listErr } =
        await admin.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = list.users.find((u) => u.email === DEMO_EMAIL);
      if (!existing) throw new Error('Could not locate existing auth user.');
      supabaseUid = existing.id;
      console.log(`      uid: ${supabaseUid}`);
    } else {
      throw authError;
    }
  } else {
    supabaseUid = authData.user.id;
    console.log(`      Created. uid: ${supabaseUid}`);
  }

  // ── 2. Ensure users table row exists ─────────────────────────────────────
  console.log('\n[2/3] Upserting users table row…');
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('supabase_uid', supabaseUid)
    .single();

  let userId;
  if (existingUser) {
    userId = existingUser.id;
    console.log(`      Already exists. users.id: ${userId}`);
  } else {
    const { data: newUser, error: userErr } = await admin
      .from('users')
      .insert({ supabase_uid: supabaseUid, email: DEMO_EMAIL, name: DEMO_NAME })
      .select('id')
      .single();
    if (userErr) throw userErr;
    userId = newUser.id;
    console.log(`      Created. users.id: ${userId}`);
  }

  // ── 3. Ensure demo vehicle exists ─────────────────────────────────────────
  console.log('\n[3/3] Upserting demo vehicle…');
  const { data: existingVehicle } = await admin
    .from('vehicles')
    .select('id, mileage_current')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingVehicle) {
    console.log(
      `      Demo vehicle already exists (id: ${existingVehicle.id}, mileage: ${existingVehicle.mileage_current} km) — skipping.`
    );
  } else {
    const { data: vehicle, error: vehicleErr } = await admin
      .from('vehicles')
      .insert({ ...DEMO_VEHICLE, owner_id: userId })
      .select('id')
      .single();
    if (vehicleErr) throw vehicleErr;
    console.log(`      Created. vehicles.id: ${vehicle.id}`);
  }

  console.log('\n============================');
  console.log('Demo account ready.');
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log('============================\n');
}

run().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});
