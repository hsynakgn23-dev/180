import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT_DIR = process.cwd();
const MOBILE_DIR = path.join(ROOT_DIR, 'apps', 'mobile');
const MOBILE_ENV_PATH = path.join(MOBILE_DIR, '.env');
const MOBILE_APP_CONFIG_PATH = path.join(MOBILE_DIR, 'app.config.js');
const _require = createRequire(import.meta.url);
const ENV_KEY = 'EXPO_PUBLIC_EXPO_PROJECT_ID';

const UUID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

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

const writeEnvKey = (filePath, key, value) => {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = current.split(/\r?\n/).filter((line) => line.length > 0);
  const nextLines = [];
  let replaced = false;
  for (const line of lines) {
    if (line.startsWith(`${key}=`)) {
      nextLines.push(`${key}=${value}`);
      replaced = true;
      continue;
    }
    nextLines.push(line);
  }
  if (!replaced) nextLines.push(`${key}=${value}`);
  fs.writeFileSync(filePath, `${nextLines.join('\n')}\n`, 'utf8');
};

const parseJsonObjectFromMixedOutput = (text) => {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const findUuidDeep = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(UUID_REGEX);
    return match ? match[0] : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUuidDeep(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    const objectValue = value;
    for (const [key, nested] of Object.entries(objectValue)) {
      if (/project.?id|^id$/i.test(key) && typeof nested === 'string') {
        const direct = nested.match(UUID_REGEX);
        if (direct) return direct[0];
      }
    }
    for (const nested of Object.values(objectValue)) {
      const found = findUuidDeep(nested);
      if (found) return found;
    }
  }
  return null;
};

const readProjectIdFromAppJson = () => {
  try {
    const config = _require(MOBILE_APP_CONFIG_PATH);
    const projectId = String(config?.expo?.extra?.eas?.projectId || '').trim();
    return UUID_REGEX.test(projectId) ? projectId : null;
  } catch {
    return null;
  }
};

const readProjectInfoJson = () => {
  try {
    const stdout = execSync('npx eas-cli project:info --json', {
      cwd: MOBILE_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseJsonObjectFromMixedOutput(stdout);
  } catch (error) {
    const stderr = String(error?.stderr || '').trim();
    const stdout = String(error?.stdout || '').trim();
    const details = stderr || stdout || String(error?.message || 'unknown error');
    throw new Error(details);
  }
};

// projectId artık app.config.js içinde sabit — write-back gerekmez
const writeProjectIdToAppJson = (_projectId) => {};

const main = () => {
  const mobileEnvText = fs.existsSync(MOBILE_ENV_PATH)
    ? fs.readFileSync(MOBILE_ENV_PATH, 'utf8')
    : '';
  const mobileEnv = parseEnv(mobileEnvText);
  const existingProjectId = String(mobileEnv[ENV_KEY] || '').trim();

  if (UUID_REGEX.test(existingProjectId)) {
    writeProjectIdToAppJson(existingProjectId);
    console.info(`[mobile-eas-projectid-sync] ${ENV_KEY} already set.`);
    return;
  }

  const fromAppJson = readProjectIdFromAppJson();
  if (fromAppJson) {
    writeEnvKey(MOBILE_ENV_PATH, ENV_KEY, fromAppJson);
    console.info(`[mobile-eas-projectid-sync] ${ENV_KEY} updated from app.config.js: ${fromAppJson}`);
    return;
  }

  const infoJson = readProjectInfoJson();
  const projectId = findUuidDeep(infoJson);
  if (!projectId) {
    throw new Error('EAS project info icinden projectId bulunamadi.');
  }

  writeEnvKey(MOBILE_ENV_PATH, ENV_KEY, projectId);
  console.info(`[mobile-eas-projectid-sync] ${ENV_KEY} updated: ${projectId}`);
};

try {
  main();
} catch (error) {
  console.error('[mobile-eas-projectid-sync] FAILED');
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  console.error('  Once su adimlari calistir:');
  console.error('  1) cd apps/mobile');
  console.error('  2) npx eas-cli login');
  console.error('  3) npx eas-cli project:init');
  process.exit(1);
}
