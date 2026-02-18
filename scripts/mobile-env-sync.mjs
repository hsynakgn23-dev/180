import fs from 'node:fs';
import path from 'node:path';

const ROOT_ENV_PATH = path.join(process.cwd(), '.env');
const MOBILE_ENV_PATH = path.join(process.cwd(), 'apps', 'mobile', '.env');

const ORDERED_KEYS = [
  'EXPO_PUBLIC_ANALYTICS_ENDPOINT',
  'EXPO_PUBLIC_ANALYTICS_ENABLED',
  'EXPO_PUBLIC_DAILY_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_REFERRAL_API_BASE',
  'EXPO_PUBLIC_PUSH_API_BASE',
  'EXPO_PUBLIC_EXPO_PROJECT_ID',
];

const readFileSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const parseEnv = (text) => {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
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

const deriveBase = (endpoint) => {
  const text = String(endpoint || '').trim();
  if (!text) return '';
  const marker = '/api/';
  const idx = text.indexOf(marker);
  if (idx > 0) return text.slice(0, idx);
  return '';
};

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const mobileEnv = parseEnv(readFileSafe(MOBILE_ENV_PATH));

const analyticsEndpoint =
  mobileEnv.EXPO_PUBLIC_ANALYTICS_ENDPOINT || 'http://10.0.2.2:5173/api/analytics';
const fallbackBase = deriveBase(analyticsEndpoint) || 'http://10.0.2.2:5173';
const referralBase =
  mobileEnv.EXPO_PUBLIC_REFERRAL_API_BASE ||
  rootEnv.VITE_REFERRAL_API_BASE ||
  rootEnv.REFERRAL_API_BASE ||
  fallbackBase;

const nextMobileEnv = {
  EXPO_PUBLIC_ANALYTICS_ENDPOINT: analyticsEndpoint,
  EXPO_PUBLIC_ANALYTICS_ENABLED: mobileEnv.EXPO_PUBLIC_ANALYTICS_ENABLED || '0',
  EXPO_PUBLIC_DAILY_API_URL:
    mobileEnv.EXPO_PUBLIC_DAILY_API_URL || `${fallbackBase}/api/daily`,
  EXPO_PUBLIC_SUPABASE_URL:
    rootEnv.VITE_SUPABASE_URL || mobileEnv.EXPO_PUBLIC_SUPABASE_URL || '',
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    rootEnv.VITE_SUPABASE_ANON_KEY || mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  EXPO_PUBLIC_REFERRAL_API_BASE: referralBase,
  EXPO_PUBLIC_PUSH_API_BASE:
    mobileEnv.EXPO_PUBLIC_PUSH_API_BASE || referralBase || fallbackBase,
  EXPO_PUBLIC_EXPO_PROJECT_ID: mobileEnv.EXPO_PUBLIC_EXPO_PROJECT_ID || '',
};

const removedKeys = Object.keys(mobileEnv).filter((key) => !ORDERED_KEYS.includes(key));
const lines = ORDERED_KEYS.map((key) => `${key}=${String(nextMobileEnv[key] || '').trim()}`);
fs.writeFileSync(MOBILE_ENV_PATH, `${lines.join('\n')}\n`, 'utf8');

console.info('[mobile-env-sync] updated apps/mobile/.env');
if (removedKeys.length > 0) {
  console.info('[mobile-env-sync] removed non-public or unsupported keys:', removedKeys.join(', '));
}

