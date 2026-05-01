import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT_ENV_PATH = path.join(process.cwd(), '.env');
const MOBILE_ENV_PATH = path.join(process.cwd(), 'apps', 'mobile', '.env');
const MOBILE_GOOGLE_SERVICES_PATH = path.join(
  process.cwd(),
  'apps',
  'mobile',
  'google-services.json'
);
const MOBILE_APP_CONFIG_PATH = path.join(process.cwd(), 'apps', 'mobile', 'app.config.js');
const _require = createRequire(import.meta.url);

const REQUIRED_MOBILE_KEYS = [
  'EXPO_PUBLIC_ANALYTICS_ENDPOINT',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const FORBIDDEN_MOBILE_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_DB_PASSWORD',
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

const extractHost = (urlText) => {
  const text = String(urlText || '').trim();
  if (!text) return '';
  try {
    return new URL(text).host;
  } catch {
    return '';
  }
};

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const mobileEnv = parseEnv(readFileSafe(MOBILE_ENV_PATH));
const appJson = (() => { try { return _require(MOBILE_APP_CONFIG_PATH); } catch { return {}; } })();

const errors = [];
const warnings = [];

for (const key of REQUIRED_MOBILE_KEYS) {
  if (!String(mobileEnv[key] || '').trim()) {
    errors.push(`missing required key in apps/mobile/.env: ${key}`);
  }
}

for (const key of Object.keys(mobileEnv)) {
  if (FORBIDDEN_MOBILE_KEYS.includes(key)) {
    errors.push(`forbidden secret key found in apps/mobile/.env: ${key}`);
  }
  if (!key.startsWith('EXPO_PUBLIC_')) {
    warnings.push(`non-public key found in apps/mobile/.env: ${key}`);
  }
}

if (
  rootEnv.VITE_SUPABASE_URL &&
  mobileEnv.EXPO_PUBLIC_SUPABASE_URL &&
  rootEnv.VITE_SUPABASE_URL !== mobileEnv.EXPO_PUBLIC_SUPABASE_URL
) {
  warnings.push('Supabase URL mismatch between .env and apps/mobile/.env');
}

if (
  rootEnv.VITE_SUPABASE_ANON_KEY &&
  mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
  rootEnv.VITE_SUPABASE_ANON_KEY !== mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY
) {
  warnings.push('Supabase anon key mismatch between .env and apps/mobile/.env');
}

const analyticsHost = extractHost(mobileEnv.EXPO_PUBLIC_ANALYTICS_ENDPOINT);
if (analyticsHost === 'localhost:5173' || analyticsHost === '127.0.0.1:5173') {
  warnings.push('Android emulator icin localhost yerine 10.0.2.2 kullanilmali.');
}

if (!String(mobileEnv.EXPO_PUBLIC_EXPO_PROJECT_ID || '').trim()) {
  warnings.push('EXPO_PUBLIC_EXPO_PROJECT_ID bos. Remote push token dev-client akisi calismayabilir.');
}

const googleServicesConfigured =
  String(appJson?.expo?.android?.googleServicesFile || '').trim() === './google-services.json';
if (!googleServicesConfigured) {
  warnings.push('apps/mobile/app.json android.googleServicesFile ayarlanamamis. FCM push token calismaz.');
}

if (!fs.existsSync(MOBILE_GOOGLE_SERVICES_PATH)) {
  warnings.push(
    'apps/mobile/google-services.json bulunamadi. Firebase/FCM native init olmadan remote push token alinmaz.'
  );
}

if (errors.length > 0) {
  console.error('[mobile-env-doctor] FAILED');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  if (warnings.length > 0) {
    console.warn('[mobile-env-doctor] WARNINGS');
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }
  process.exit(1);
}

console.info('[mobile-env-doctor] OK');
if (warnings.length > 0) {
  console.warn('[mobile-env-doctor] WARNINGS');
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}
