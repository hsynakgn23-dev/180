import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const TARGET_FILES = [
  path.join(ROOT_DIR, 'apps', 'mobile', 'App.tsx'),
  path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'appStyles.ts'),
  path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'appScreens.tsx'),
  path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'theme.ts'),
  path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'primitives.tsx'),
];

const ALLOWED_HEX_COLORS = new Set([
  '#121212',
  '#141414',
  '#171717',
  '#1f1f1f',
  '#e5e4e2',
  '#8e8b84',
  '#8a9a5b',
  '#a57164',
  '#7f1d1d',
  '#fca5a5',
  '#fecaca',
  '#c9c6bf',
  '#d9e2bf',
]);

const REQUIRED_HEX_COLORS = ['#121212', '#171717', '#e5e4e2', '#8e8b84', '#8a9a5b', '#a57164'];
const REQUIRED_TEXT_SNIPPETS = [
  {
    path: path.join(ROOT_DIR, 'apps', 'mobile', 'App.tsx'),
    values: ['useFonts({', 'Inter_400Regular'],
  },
  {
    path: path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'appStyles.ts'),
    values: ["fontFamily: 'Inter_700Bold'"],
  },
  {
    path: path.join(ROOT_DIR, 'apps', 'mobile', 'src', 'ui', 'primitives.tsx'),
    values: ["fontFamily: 'Inter_600SemiBold'"],
  },
];

const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;

let failed = false;
const foundColors = new Set();

for (const filePath of TARGET_FILES) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  if (!fs.existsSync(filePath)) {
    console.error(`[mobile-design-parity] FAIL missing file: ${relativePath}`);
    failed = true;
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const matches = raw.match(HEX_REGEX) || [];
  const unique = [...new Set(matches.map((value) => value.toLowerCase()))];

  for (const color of unique) {
    foundColors.add(color);
    if (!ALLOWED_HEX_COLORS.has(color)) {
      console.error(
        `[mobile-design-parity] FAIL disallowed color in ${relativePath}: ${color}`
      );
      failed = true;
    }
  }
}

for (const required of REQUIRED_HEX_COLORS) {
  if (!foundColors.has(required)) {
    console.error(`[mobile-design-parity] FAIL required web token missing: ${required}`);
    failed = true;
  }
}

for (const target of REQUIRED_TEXT_SNIPPETS) {
  const relativePath = path.relative(ROOT_DIR, target.path);
  if (!fs.existsSync(target.path)) {
    console.error(`[mobile-design-parity] FAIL missing file: ${relativePath}`);
    failed = true;
    continue;
  }
  const raw = fs.readFileSync(target.path, 'utf8');
  for (const snippet of target.values) {
    if (!raw.includes(snippet)) {
      console.error(
        `[mobile-design-parity] FAIL required typography token missing in ${relativePath}: ${snippet}`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('[mobile-design-parity] FAILED');
  process.exit(1);
}

console.log('[mobile-design-parity] OK');
