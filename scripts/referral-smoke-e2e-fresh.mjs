import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const parseEnvText = (text) => {
  const out = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
};

const loadDotEnv = (path = '.env') => {
  try {
    if (!fs.existsSync(path)) return {};
    return parseEnvText(fs.readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
};

const mergedEnv = {
  ...loadDotEnv('.env'),
  ...process.env,
};

const supabaseUrl = String(mergedEnv.SUPABASE_URL || mergedEnv.VITE_SUPABASE_URL || '').trim();
const serviceRoleKey = String(mergedEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anonKey = String(mergedEnv.SUPABASE_ANON_KEY || mergedEnv.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('[referral-smoke-e2e-fresh] Missing Supabase env config.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const unique = Date.now().toString(36);
const inviteeEmail = `ref-invitee-${unique}@example.test`;
const inviteePassword = `RefTest!${unique.slice(-6)}A1`;

const created = await admin.auth.admin.createUser({
  email: inviteeEmail,
  password: inviteePassword,
  email_confirm: true,
  user_metadata: { source: 'referral_smoke_e2e_fresh' },
});

if (created.error) {
  console.error('[referral-smoke-e2e-fresh] createUser failed:', created.error.message);
  process.exit(1);
}

console.info(`[referral-smoke-e2e-fresh] invitee=${inviteeEmail}`);

const run = spawnSync(process.execPath, ['test-referral-smoke.js', 'e2e'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    REFERRAL_TEST_INVITEE_EMAIL: inviteeEmail,
    REFERRAL_TEST_INVITEE_PASSWORD: inviteePassword,
  },
});

process.exit(run.status ?? 1);
