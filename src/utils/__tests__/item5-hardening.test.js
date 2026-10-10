/**
 * item5-hardening.test.js — Verification tests for 015_hardening.sql (Round 4 Item 5)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('ITEM-5: 015_hardening.sql contains required security statements and rollout sequence', () => {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/015_hardening.sql');
  assert.ok(fs.existsSync(migrationPath), '015_hardening.sql must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');

  // Verify rollout sequence documentation
  assert.match(content, /000.*012.*013.*014.*deploy.*011.*010.*015/is, 'Rollout order must be documented (000, 012, 013, 014 -> deploy -> 011, 010, 015)');

  // Verify function execution revokes
  assert.match(content, /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;/i, 'Must revoke function execute from public/anon/auth');

  // Verify next_quotation_seq search_path pinning
  assert.match(content, /CREATE OR REPLACE FUNCTION public\.next_quotation_seq/i, 'Must recreate next_quotation_seq');
  assert.match(content, /SET search_path = public/i, 'next_quotation_seq must set search_path = public');

  // Verify service_role grant
  assert.match(content, /GRANT EXECUTE ON FUNCTION public\.next_quotation_seq.*TO service_role/i, 'Must grant execute to service_role');

  // Verify default privilege revokes
  assert.match(content, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i, 'Must revoke default execute privileges');
  assert.match(content, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon/i, 'Must revoke default table grants from anon');

  // Verify dropping default on max_margin_cap_per_kw
  assert.match(content, /ALTER TABLE public\.dealer_accounts ALTER COLUMN max_margin_cap_per_kw DROP DEFAULT/i, 'Must drop default on max_margin_cap_per_kw');
});
