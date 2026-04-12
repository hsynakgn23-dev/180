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
  '#000',
  '#0a0a0a',
  '#111',
  '#121212',
  '#131210',
  '#141414',
  '#171717',
  '#1a1a1a',
  '#1d1d1d',
  '#1f1d1a',
  '#1f1f1f',
  '#242424',
  '#2f271e',
  '#2f2f2f',
  '#4c3c2b',
  '#555',
  '#655b4e',
  '#666',
  '#6b6560',
  '#6b6b6b',
  '#6f665c',
  '#8a9a5b',
  '#8b6a5e',
  '#8e8b84',
  '#94a3b8',
  '#9f9689',
  '#a09890',
  '#a45e4a',
  '#a57164',
  '#a78bfa',
  '#a8a39a',
  '#a8b97a',
  '#b5b0a6',
  '#b68b4c',
  '#bcb7af',
  '#c084fc',
  '#c4b29d',
  '#c6d0a4',
  '#c7bcb2',
  '#c98b6b',
  '#c9a84c',
  '#c9c6bf',
  '#cd7f32',
  '#cfcac2',
  '#cfc7bb',
  '#d7d2ca',
  '#d9e2bf',
  '#dce5bf',
  '#dce6b8',
  '#dde6be',
  '#e07842',
  '#e5e4e2',
  '#ec4899',
  '#ef4444',
  '#f1ddd6',
  '#f1ece1',
  '#f2e6c8',
  '#f2ede7',
  '#f472b6',
  '#f4f1ea',
  '#f59e0b',
  '#f5f2eb',
  '#f7efe4',
  '#f87171',
  '#f97316',
  '#f9fafb',
  '#facc15',
  '#fb7185',
  '#fb923c',
  '#fca5a5',
  '#fecaca',
  '#ff9500',
  '#ffb457',
  '#ffd700',
  '#fff9f1',
  '#0096ff',
  '#0f52ba',
  '#10b981',
  '#22c55e',
  '#38bdf8',
  '#4ade80',
  '#50c878',
  '#60a5fa',
  '#84cc16',
  '#9400d3',
  '#a3e635',
  '#7f1d1d',
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
