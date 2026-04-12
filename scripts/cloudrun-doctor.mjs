import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');
const DOCKERFILE_PATH = path.join(ROOT_DIR, 'Dockerfile');
const SERVER_PATH = path.join(ROOT_DIR, 'server', 'index.ts');
const DOC_PATH = path.join(ROOT_DIR, 'docs', 'CLOUD_RUN_SETUP.md');

const REQUIRED_SERVER_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBLIC_APP_URL',
  'TMDB_API_KEY',
  'SUPABASE_STORAGE_BUCKET',
  'DAILY_ROLLOVER_TIMEZONE',
  'CRON_SECRET',
];

// These are not required for the server to start, but wallet topup purchases
// will fail at runtime if they are missing.
const MOBILE_IAP_KEYS = [
  'MOBILE_IAP_APPLE_ISSUER_ID',
  'MOBILE_IAP_APPLE_KEY_ID',
  'MOBILE_IAP_APPLE_PRIVATE_KEY',
  'MOBILE_IAP_GOOGLE_SERVICE_ACCOUNT_JSON',
];

const PRE_DEPLOY_WEB_KEYS = ['VITE_PUBLIC_APP_URL'];
const POST_DEPLOY_KEYS = ['VITE_API_BASE_URL'];

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

const normalizeText = (value) => String(value || '').trim();

const parseUrlSafe = (value) => {
  try {
    return new URL(String(value || '').trim());
  } catch {
    return null;
  }
};

const looksLikeSecret = (value) => normalizeText(value).length >= 30;

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const envExample = parseEnv(readFileSafe(ENV_EXAMPLE_PATH));

let failed = false;
let warningCount = 0;

const showCheck = (label, ok, detail = '') => {
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[cloudrun-doctor] ${ok ? 'OK' : 'FAIL'} ${label}${suffix}`);
  if (!ok) failed = true;
};

const showWarn = (detail) => {
  warningCount += 1;
  console.warn(`[cloudrun-doctor] WARN ${detail}`);
};

showCheck('root .env exists', fs.existsSync(ROOT_ENV_PATH));
showCheck('.env.example exists', fs.existsSync(ENV_EXAMPLE_PATH));
showCheck('Dockerfile exists', fs.existsSync(DOCKERFILE_PATH));
showCheck('server/index.ts exists', fs.existsSync(SERVER_PATH));
showCheck('docs/CLOUD_RUN_SETUP.md exists', fs.existsSync(DOC_PATH));

for (const key of REQUIRED_SERVER_KEYS) {
  const value = normalizeText(rootEnv[key]);
  showCheck(`.env ${key}`, Boolean(value), value ? 'configured' : 'missing');
}

for (const key of PRE_DEPLOY_WEB_KEYS) {
  const value = normalizeText(rootEnv[key]);
  if (!value) {
    showWarn(`${key} missing in .env. Web tarafi absolute URL uretirken domain fallback'i zayif kalir.`);
  } else {
    showCheck(`.env ${key}`, true, value);
  }
}

for (const key of POST_DEPLOY_KEYS) {
  const value = normalizeText(rootEnv[key]);
  if (!value) {
    showWarn(`${key} henuz bos. Bu beklenen durum; Cloud Run URL olusunca doldurulacak.`);
  } else {
    showCheck(`.env ${key}`, true, value);
  }
}

const publicAppUrl = parseUrlSafe(rootEnv.PUBLIC_APP_URL);
if (!publicAppUrl) {
  showWarn('PUBLIC_APP_URL gecerli bir URL degil.');
} else if (publicAppUrl.protocol !== 'https:') {
  showWarn('PUBLIC_APP_URL production icin https olmali.');
}

const apiBaseUrl = normalizeText(rootEnv.VITE_API_BASE_URL);
if (apiBaseUrl) {
  const parsedApiBase = parseUrlSafe(apiBaseUrl);
  if (!parsedApiBase) {
    showWarn('VITE_API_BASE_URL gecerli bir URL degil.');
  }
}

const serviceRole = normalizeText(rootEnv.SUPABASE_SERVICE_ROLE_KEY);
if (serviceRole && !looksLikeSecret(serviceRole)) {
  showWarn('SUPABASE_SERVICE_ROLE_KEY cok kisa gorunuyor. Dogru anahtar olmayabilir.');
}

for (const key of REQUIRED_SERVER_KEYS.concat(PRE_DEPLOY_WEB_KEYS, POST_DEPLOY_KEYS)) {
  if (!(key in envExample)) {
    showWarn(`${key} .env.example icinde tanimli degil.`);
  }
}

for (const key of MOBILE_IAP_KEYS) {
  const value = normalizeText(rootEnv[key]);
  if (!value) {
    showWarn(`${key} eksik. Wallet ticket satin alma dogrulamasi (Apple/Google) bu olmadan calismiyor.`);
  }
}

if (failed) {
  console.error('[cloudrun-doctor] FAILED');
  process.exit(1);
}

if (warningCount > 0) {
  console.warn(`[cloudrun-doctor] READY_WITH_WARNINGS (${warningCount})`);
  process.exit(0);
}

console.log('[cloudrun-doctor] READY');
