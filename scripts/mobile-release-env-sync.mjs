import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const MOBILE_ENV_PATH = path.join(ROOT_DIR, 'apps', 'mobile', '.env');
const MOBILE_RELEASE_ENV_PATH = path.join(ROOT_DIR, 'apps', 'mobile', '.env.release');
const MOBILE_APP_JSON_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'app.json');

const ORDERED_KEYS = [
  'EXPO_PUBLIC_ANALYTICS_ENDPOINT',
  'EXPO_PUBLIC_ANALYTICS_ENABLED',
  'EXPO_PUBLIC_DAILY_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_REFERRAL_API_BASE',
  'EXPO_PUBLIC_PUSH_ENABLED',
  'EXPO_PUBLIC_PUSH_API_BASE',
  'EXPO_PUBLIC_EXPO_PROJECT_ID',
  'EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES',
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

const normalizeText = (value) => String(value || '').trim();

const stripTrailingSlash = (value) => normalizeText(value).replace(/\/+$/, '');

const parseAbsoluteUrl = (value) => {
  const text = normalizeText(value);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const resolveProjectIdFromAppJson = () => {
  try {
    const raw = fs.readFileSync(MOBILE_APP_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeText(parsed?.expo?.extra?.eas?.projectId);
  } catch {
    return '';
  }
};

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const mobileEnv = parseEnv(readFileSafe(MOBILE_ENV_PATH));

const releaseBaseUrl =
  parseAbsoluteUrl(rootEnv.MOBILE_RELEASE_BASE_URL) ||
  parseAbsoluteUrl(rootEnv.VITE_PUBLIC_APP_URL) ||
  parseAbsoluteUrl(rootEnv.PUBLIC_APP_URL) ||
  'https://www.180absolutecinema.com';

const releaseAnalyticsEndpoint =
  parseAbsoluteUrl(rootEnv.MOBILE_RELEASE_ANALYTICS_ENDPOINT) || `${releaseBaseUrl}/api/analytics`;
const releaseDailyEndpoint =
  parseAbsoluteUrl(rootEnv.MOBILE_RELEASE_DAILY_API_URL) || `${releaseBaseUrl}/api/daily`;
const releaseReferralBase =
  parseAbsoluteUrl(rootEnv.MOBILE_RELEASE_REFERRAL_API_BASE) || releaseBaseUrl;
const releasePushApiBase =
  parseAbsoluteUrl(rootEnv.MOBILE_RELEASE_PUSH_API_BASE) || releaseReferralBase;

const releaseProjectId =
  normalizeText(rootEnv.MOBILE_RELEASE_EXPO_PROJECT_ID) ||
  normalizeText(mobileEnv.EXPO_PUBLIC_EXPO_PROJECT_ID) ||
  resolveProjectIdFromAppJson();

const nextReleaseEnv = {
  EXPO_PUBLIC_ANALYTICS_ENDPOINT: releaseAnalyticsEndpoint,
  EXPO_PUBLIC_ANALYTICS_ENABLED: normalizeText(rootEnv.MOBILE_RELEASE_ANALYTICS_ENABLED) || '1',
  EXPO_PUBLIC_DAILY_API_URL: releaseDailyEndpoint,
  EXPO_PUBLIC_SUPABASE_URL:
    normalizeText(rootEnv.MOBILE_RELEASE_SUPABASE_URL) ||
    normalizeText(rootEnv.VITE_SUPABASE_URL) ||
    normalizeText(mobileEnv.EXPO_PUBLIC_SUPABASE_URL),
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    normalizeText(rootEnv.MOBILE_RELEASE_SUPABASE_ANON_KEY) ||
    normalizeText(rootEnv.VITE_SUPABASE_ANON_KEY) ||
    normalizeText(mobileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  EXPO_PUBLIC_REFERRAL_API_BASE: stripTrailingSlash(releaseReferralBase),
  EXPO_PUBLIC_PUSH_ENABLED: normalizeText(rootEnv.MOBILE_RELEASE_PUSH_ENABLED) || '1',
  EXPO_PUBLIC_PUSH_API_BASE: stripTrailingSlash(releasePushApiBase),
  EXPO_PUBLIC_EXPO_PROJECT_ID: releaseProjectId,
  EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES: '0',
};

const lines = ORDERED_KEYS.map((key) => `${key}=${normalizeText(nextReleaseEnv[key])}`);
fs.writeFileSync(MOBILE_RELEASE_ENV_PATH, `${lines.join('\n')}\n`, 'utf8');

console.info('[mobile-release-env-sync] updated apps/mobile/.env.release');
console.info(`[mobile-release-env-sync] base=${releaseBaseUrl}`);
