import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const MOBILE_ENV_PATH = path.join(ROOT_DIR, 'apps', 'mobile', '.env');
const MOBILE_APP_CONFIG_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'app.config.js');
const _require = createRequire(import.meta.url);
const MOBILE_GOOGLE_SERVICES_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'google-services.json');
const PUSH_API_PATH = path.join(ROOT_DIR, 'api', 'push', 'test.ts');
const MIGRATION_PATH = path.join(
  ROOT_DIR,
  'sql',
  'migrations',
  '20260221_mobile_push_profile_state.sql'
);

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

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );

const showItem = (label, ok, detail = '') => {
  const mark = ok ? 'OK' : 'FAIL';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[mobile-ready] ${mark} ${label}${suffix}`);
};

const showWarn = (detail) => {
  console.warn(`[mobile-ready] WARN ${detail}`);
};

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const mobileEnv = parseEnv(readFileSafe(MOBILE_ENV_PATH));
const appJson = (() => { try { return _require(MOBILE_APP_CONFIG_PATH); } catch { return {}; } })();

let failed = false;

const requireKey = (label, value, mask = false) => {
  const ok = Boolean(String(value || '').trim());
  const detail = ok
    ? mask
      ? 'set'
      : String(value).trim()
    : 'missing';
  showItem(label, ok, detail);
  if (!ok) failed = true;
};

requireKey('apps/mobile/.env exists', fs.existsSync(MOBILE_ENV_PATH) ? 'yes' : '');
requireKey('root .env exists', fs.existsSync(ROOT_ENV_PATH) ? 'yes' : '');

requireKey('EXPO_PUBLIC_SUPABASE_URL', mobileEnv.EXPO_PUBLIC_SUPABASE_URL);
requireKey('EXPO_PUBLIC_SUPABASE_ANON_KEY', mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY, true);
requireKey('EXPO_PUBLIC_ANALYTICS_ENDPOINT', mobileEnv.EXPO_PUBLIC_ANALYTICS_ENDPOINT);
requireKey('EXPO_PUBLIC_PUSH_API_BASE', mobileEnv.EXPO_PUBLIC_PUSH_API_BASE);

const mobileProjectId = mobileEnv.EXPO_PUBLIC_EXPO_PROJECT_ID;
const appJsonProjectId = appJson?.expo?.extra?.eas?.projectId;
const projectIdOk = isUuid(mobileProjectId);
showItem(
  'EXPO_PUBLIC_EXPO_PROJECT_ID',
  projectIdOk,
  projectIdOk ? String(mobileProjectId).trim() : 'missing or invalid uuid'
);
if (!projectIdOk) failed = true;

const appJsonProjectOk = isUuid(appJsonProjectId);
showItem(
  'apps/mobile/app.config.js extra.eas.projectId',
  appJsonProjectOk,
  appJsonProjectOk ? String(appJsonProjectId).trim() : 'missing or invalid uuid'
);
if (!appJsonProjectOk) failed = true;

if (projectIdOk && appJsonProjectOk && String(mobileProjectId).trim() !== String(appJsonProjectId).trim()) {
  failed = true;
  showItem(
    'projectId parity (env vs app.config.js)',
    false,
    `${String(mobileProjectId).trim()} != ${String(appJsonProjectId).trim()}`
  );
} else if (projectIdOk && appJsonProjectOk) {
  showItem('projectId parity (env vs app.config.js)', true);
}

const forbiddenMobileKeys = Object.keys(mobileEnv).filter((key) => !key.startsWith('EXPO_PUBLIC_'));
if (forbiddenMobileKeys.length > 0) {
  failed = true;
  showItem('mobile env secret guard', false, `non-public keys: ${forbiddenMobileKeys.join(', ')}`);
} else {
  showItem('mobile env secret guard', true);
}

const hasServiceRole = Boolean(String(rootEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim());
showItem('root SUPABASE_SERVICE_ROLE_KEY', hasServiceRole, hasServiceRole ? 'set' : 'missing');
if (!hasServiceRole) failed = true;

const hasPushApi = fs.existsSync(PUSH_API_PATH);
showItem('api/push/test.ts exists', hasPushApi);
if (!hasPushApi) failed = true;

const hasMigration = fs.existsSync(MIGRATION_PATH);
showItem('mobile_push_state migration exists', hasMigration);
if (!hasMigration) failed = true;

const analyticsEndpoint = String(mobileEnv.EXPO_PUBLIC_ANALYTICS_ENDPOINT || '').trim();
if (analyticsEndpoint.includes('localhost') || analyticsEndpoint.includes('127.0.0.1')) {
  showWarn('Android emulator icin localhost yerine 10.0.2.2 kullan.');
}
if (String(mobileEnv.EXPO_PUBLIC_ANALYTICS_ENABLED || '').trim() === '0') {
  showWarn('EXPO_PUBLIC_ANALYTICS_ENABLED=0 (dev mode icin normal).');
}

const hasGoogleServicesJson = fs.existsSync(MOBILE_GOOGLE_SERVICES_PATH);
if (!hasGoogleServicesJson) {
  showWarn(
    'apps/mobile/google-services.json yok. Firebase/FCM init eksik olursa remote push token alinmaz.'
  );
}
const googleServicesFilePath = String(appJson?.expo?.android?.googleServicesFile || '').trim();
if (googleServicesFilePath !== './google-services.json') {
  showWarn('apps/mobile/app.json android.googleServicesFile ayari eksik/yanlis.');
}

if (failed) {
  console.error('[mobile-ready] FAILED');
  process.exit(1);
}

console.log('[mobile-ready] READY');
