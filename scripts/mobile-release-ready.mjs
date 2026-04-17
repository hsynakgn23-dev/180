import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const MOBILE_ENV_PATH = path.join(ROOT_DIR, 'apps', 'mobile', '.env');
const APP_JSON_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'app.json');
const EAS_JSON_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'eas.json');
const GOOGLE_SERVICES_PATH = path.join(ROOT_DIR, 'apps', 'mobile', 'google-services.json');

const strict = process.argv.includes('--strict');
const envFileArg = process.argv.find((arg) => arg.startsWith('--env-file='));
const requestedEnvFile = envFileArg ? envFileArg.slice('--env-file='.length) : '';
const effectiveMobileEnvPath = requestedEnvFile
  ? path.resolve(ROOT_DIR, requestedEnvFile)
  : MOBILE_ENV_PATH;
const reportFileArg = process.argv.find((arg) => arg.startsWith('--report-file='));
const requestedReportFile = reportFileArg ? reportFileArg.slice('--report-file='.length) : '';
const effectiveReportPath = requestedReportFile ? path.resolve(ROOT_DIR, requestedReportFile) : '';
const checklistFileArg = process.argv.find((arg) => arg.startsWith('--checklist-file='));
const requestedChecklistFile = checklistFileArg
  ? checklistFileArg.slice('--checklist-file='.length)
  : '';
const effectiveChecklistPath = requestedChecklistFile
  ? path.resolve(ROOT_DIR, requestedChecklistFile)
  : '';
const platformArg = process.argv.find((arg) => arg.startsWith('--platform='));
const requestedPlatform = normalizePlatform(platformArg ? platformArg.slice('--platform='.length) : '');

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

function normalizePlatform(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ios' || normalized === 'android') return normalized;
  return 'all';
}

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalizeText(value)
  );

const isEnabled = (value, defaultValue = false) => {
  const text = normalizeText(value).toLowerCase();
  if (!text) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(text);
};

const looksLikeLocalHost = (host) => {
  const text = normalizeText(host).toLowerCase();
  if (!text) return false;
  return (
    text.includes('localhost') ||
    text.includes('127.0.0.1') ||
    text.includes('10.0.2.2') ||
    text.includes('192.168.')
  );
};

const parseUrlSafe = (value) => {
  try {
    return new URL(String(value || '').trim());
  } catch {
    return null;
  }
};

const allowNoPushFallback = isEnabled(process.env.MOBILE_RELEASE_ALLOW_NO_PUSH, false);
const shouldCheckIos = requestedPlatform === 'all' || requestedPlatform === 'ios';
const shouldCheckAndroid = requestedPlatform === 'all' || requestedPlatform === 'android';

let failed = false;
let warningCount = 0;
const checks = [];
const warnings = [];

const showItem = (label, ok, detail = '') => {
  const mark = ok ? 'OK' : 'FAIL';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[mobile-release-ready] ${mark} ${label}${suffix}`);
  checks.push({
    label,
    ok,
    detail: detail || null,
  });
  if (!ok) failed = true;
};

const showWarn = (detail) => {
  warningCount += 1;
  warnings.push(detail);
  console.warn(`[mobile-release-ready] WARN ${detail}`);
};

const evaluateEndpoint = (label, value) => {
  const text = normalizeText(value);
  if (!text) {
    showWarn(`${label} missing.`);
    return;
  }
  const parsed = parseUrlSafe(text);
  if (!parsed) {
    showWarn(`${label} invalid url: ${text}`);
    return;
  }
  if (parsed.protocol !== 'https:') {
    showWarn(`${label} should use https in production: ${text}`);
  }
  if (looksLikeLocalHost(parsed.host)) {
    showWarn(`${label} points to local/private host: ${parsed.host}`);
  }
};

const rootEnv = parseEnv(readFileSafe(ROOT_ENV_PATH));
const mobileEnv = parseEnv(readFileSafe(effectiveMobileEnvPath));

const appJsonRaw = readFileSafe(APP_JSON_PATH);
const easJsonRaw = readFileSafe(EAS_JSON_PATH);

const appJson = appJsonRaw ? JSON.parse(appJsonRaw) : {};
const easJson = easJsonRaw ? JSON.parse(easJsonRaw) : {};

// ── Build gate checks (run actual compiler/linter to catch real blockers) ────

const skipBuildChecks = process.argv.includes('--skip-build-checks');

const runBuildCheck = (label, command) => {
  if (skipBuildChecks) {
    showWarn(`${label} skipped (--skip-build-checks)`);
    return;
  }
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: 'pipe' });
    showItem(label, true);
  } catch (err) {
    const output = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
    const firstError = output.split('\n').find((l) => l.includes('error')) || 'build failed';
    showItem(label, false, firstError.trim().slice(0, 120));
  }
};

runBuildCheck('web build (tsc + vite)', 'npm run build:ci');
runBuildCheck('lint (0 errors)', 'npm run lint');
runBuildCheck('cloudrun tsc', 'npx tsc --noEmit -p tsconfig.cloudrun.json');
runBuildCheck('mobile tsc', 'npm --prefix apps/mobile exec -- tsc --noEmit');

// ── Config/env checks ─────────────────────────────────────────────────────────

showItem('root .env exists', fs.existsSync(ROOT_ENV_PATH));
showItem(
  `mobile env file exists (${path.relative(ROOT_DIR, effectiveMobileEnvPath)})`,
  fs.existsSync(effectiveMobileEnvPath)
);
showItem('apps/mobile/app.json exists', fs.existsSync(APP_JSON_PATH));
showItem('apps/mobile/eas.json exists', fs.existsSync(EAS_JSON_PATH));

const expo = appJson?.expo || {};
showItem('app.json expo.scheme', Boolean(normalizeText(expo.scheme)), normalizeText(expo.scheme) || 'missing');
showItem(
  'app.json android.package',
  Boolean(normalizeText(expo?.android?.package)),
  normalizeText(expo?.android?.package) || 'missing'
);
showItem(
  'app.json ios.bundleIdentifier',
  Boolean(normalizeText(expo?.ios?.bundleIdentifier)),
  normalizeText(expo?.ios?.bundleIdentifier) || 'missing'
);
if (shouldCheckIos) {
  showItem(
    'app.json ios.buildNumber',
    /^\d+$/.test(normalizeText(expo?.ios?.buildNumber)),
    normalizeText(expo?.ios?.buildNumber) || 'missing'
  );
  showItem(
    'app.json ios.usesAppleSignIn',
    expo?.ios?.usesAppleSignIn === true,
    String(expo?.ios?.usesAppleSignIn ?? 'missing')
  );
}
if (shouldCheckAndroid) {
  const androidVersionCode = expo?.android?.versionCode;
  showItem(
    'app.json android.versionCode',
    Number.isInteger(androidVersionCode) && androidVersionCode > 0,
    String(androidVersionCode ?? 'missing')
  );
}

const easProduction = easJson?.build?.production;
showItem(
  'eas.json build.production profile',
  Boolean(easProduction && typeof easProduction === 'object'),
  easProduction ? 'configured' : 'missing'
);
if (shouldCheckIos) {
  const easSubmitIos = easJson?.submit?.production?.ios;
  showItem(
    'eas.json submit.production.ios profile',
    Boolean(easSubmitIos && typeof easSubmitIos === 'object'),
    easSubmitIos ? 'configured' : 'missing'
  );
}

const envProjectId = normalizeText(mobileEnv.EXPO_PUBLIC_EXPO_PROJECT_ID);
const appProjectId = normalizeText(expo?.extra?.eas?.projectId);
showItem(
  'EXPO_PUBLIC_EXPO_PROJECT_ID',
  isUuid(envProjectId),
  isUuid(envProjectId) ? envProjectId : 'missing or invalid uuid'
);
showItem(
  'app.json extra.eas.projectId',
  isUuid(appProjectId),
  isUuid(appProjectId) ? appProjectId : 'missing or invalid uuid'
);
if (isUuid(envProjectId) && isUuid(appProjectId) && envProjectId !== appProjectId) {
  showItem('projectId parity (env vs app.json)', false, `${envProjectId} != ${appProjectId}`);
} else if (isUuid(envProjectId) && isUuid(appProjectId)) {
  showItem('projectId parity (env vs app.json)', true);
}

evaluateEndpoint('EXPO_PUBLIC_ANALYTICS_ENDPOINT', mobileEnv.EXPO_PUBLIC_ANALYTICS_ENDPOINT);
evaluateEndpoint('EXPO_PUBLIC_DAILY_API_URL', mobileEnv.EXPO_PUBLIC_DAILY_API_URL);
evaluateEndpoint('EXPO_PUBLIC_REFERRAL_API_BASE', mobileEnv.EXPO_PUBLIC_REFERRAL_API_BASE);
evaluateEndpoint('EXPO_PUBLIC_PUSH_API_BASE', mobileEnv.EXPO_PUBLIC_PUSH_API_BASE);

if (!isEnabled(mobileEnv.EXPO_PUBLIC_ANALYTICS_ENABLED, true)) {
  showWarn('EXPO_PUBLIC_ANALYTICS_ENABLED is disabled. Release build usually expects analytics enabled.');
}

const pushEnabled = isEnabled(mobileEnv.EXPO_PUBLIC_PUSH_ENABLED, false);
if (!pushEnabled) {
  if (allowNoPushFallback) {
    showItem('release push gate mode', true, 'fallback active; EXPO_PUBLIC_PUSH_ENABLED=0');
  } else {
    showWarn('EXPO_PUBLIC_PUSH_ENABLED is disabled. Remote push flow will remain off.');
  }
} else {
  showItem('release push gate mode', true, 'push enabled');
  const pluginEntries = Array.isArray(expo?.plugins) ? expo.plugins : [];
  const hasExpoNotificationsPlugin = pluginEntries.some((entry) => {
    if (typeof entry === 'string') return normalizeText(entry) === 'expo-notifications';
    if (Array.isArray(entry)) return normalizeText(entry[0]) === 'expo-notifications';
    return false;
  });
  showItem(
    'app.json expo-notifications plugin',
    hasExpoNotificationsPlugin,
    hasExpoNotificationsPlugin ? 'configured' : 'missing'
  );

  if (shouldCheckAndroid) {
    const googleServicesFilePath = normalizeText(expo?.android?.googleServicesFile);
    showItem(
      'app.json android.googleServicesFile',
      googleServicesFilePath === './google-services.json',
      googleServicesFilePath || 'missing'
    );
    showItem(
      'apps/mobile/google-services.json exists',
      fs.existsSync(GOOGLE_SERVICES_PATH)
    );
  }
}

if (requestedPlatform === 'ios') {
  const webAppUrl = normalizeText(mobileEnv.EXPO_PUBLIC_WEB_APP_URL);
  showItem('EXPO_PUBLIC_WEB_APP_URL', Boolean(webAppUrl), webAppUrl || 'missing');
  evaluateEndpoint('EXPO_PUBLIC_WEB_APP_URL', webAppUrl);
}

if (!normalizeText(rootEnv.SUPABASE_SERVICE_ROLE_KEY)) {
  showWarn('SUPABASE_SERVICE_ROLE_KEY missing in root .env.');
}

if (strict && warningCount > 0) {
  failed = true;
  console.error(
    `[mobile-release-ready] STRICT mode: ${warningCount} warning(s) treated as failure.`
  );
}

const resolveStatus = () => {
  if (failed) return 'FAILED';
  if (warningCount > 0) return 'READY_WITH_WARNINGS';
  return 'READY';
};

const writeReportFile = (reportPath, payload) => {
  const directory = path.dirname(reportPath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[mobile-release-ready] REPORT ${path.relative(ROOT_DIR, reportPath)}`);
};

const buildChecklistMarkdown = (payload) => {
  const lines = [
    '# Mobile Release Checklist',
    '',
    `- Generated at: ${payload.generatedAt}`,
    `- Status: ${payload.status}`,
    `- Strict mode: ${payload.strict ? 'on' : 'off'}`,
    `- Env file: ${payload.envFile}`,
    `- Total checks: ${payload.checks.length}`,
    `- Warning count: ${payload.warningCount}`,
    '',
    '## Checks',
  ];

  for (const check of payload.checks) {
    const checked = check.ok ? 'x' : ' ';
    const detailSuffix = check.detail ? ` - ${check.detail}` : '';
    lines.push(`- [${checked}] ${check.label}${detailSuffix}`);
  }

  lines.push('');
  lines.push('## Warnings');
  if (payload.warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of payload.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');

  return `${lines.join('\n')}`;
};

const writeChecklistFile = (checklistPath, payload) => {
  const directory = path.dirname(checklistPath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(checklistPath, buildChecklistMarkdown(payload), 'utf8');
  console.log(`[mobile-release-ready] CHECKLIST ${path.relative(ROOT_DIR, checklistPath)}`);
};

const status = resolveStatus();
const reportPayload = {
  generatedAt: new Date().toISOString(),
  status,
  strict,
  platform: requestedPlatform,
  envFile: path.relative(ROOT_DIR, effectiveMobileEnvPath),
  warningCount,
  checks,
  warnings,
};

if (effectiveReportPath) {
  writeReportFile(effectiveReportPath, reportPayload);
}

if (effectiveChecklistPath) {
  writeChecklistFile(effectiveChecklistPath, reportPayload);
}

if (failed) {
  console.error('[mobile-release-ready] FAILED');
  process.exit(1);
}

if (warningCount > 0) {
  console.warn(`[mobile-release-ready] READY_WITH_WARNINGS (${warningCount})`);
  process.exit(0);
}

console.log('[mobile-release-ready] READY');
