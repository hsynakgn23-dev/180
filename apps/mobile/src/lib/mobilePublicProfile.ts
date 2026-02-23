import { normalizeBaseUrl } from './mobileEnv';

const PROFILE_HASH_PREFIX = '#/u/';
const PROFILE_ID_PREFIX = 'id:';
const PROFILE_NAME_PREFIX = 'name:';

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizePath = (value: string): string => value.replace(/\/+$/, '') || '/';

const normalizeUserId = (value: unknown): string => normalizeText(value, 120);
const normalizeUsername = (value: unknown): string =>
  normalizeText(value, 80)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

const parseHttpUrl = (value: unknown): URL | null => {
  const text = normalizeText(value, 1200);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const buildMobilePublicProfileUrl = ({
  webBaseUrl,
  userId,
  username,
  allowNameFallback = false,
}: {
  webBaseUrl: string;
  userId?: string | null;
  username?: string | null;
  allowNameFallback?: boolean;
}): string => {
  const normalizedBase = normalizeBaseUrl(webBaseUrl);
  if (!normalizedBase) return '';

  const normalizedUserId = normalizeUserId(userId);
  const normalizedUsername = normalizeUsername(username);

  let profileKey = '';
  if (normalizedUserId) {
    profileKey = `${PROFILE_ID_PREFIX}${normalizedUserId}`;
  } else if (allowNameFallback && normalizedUsername) {
    profileKey = `${PROFILE_NAME_PREFIX}${normalizedUsername}`;
  } else {
    return '';
  }

  const encodedKey = encodeURIComponent(profileKey);
  const hashQuery = normalizedUsername ? `?name=${encodeURIComponent(normalizedUsername)}` : '';
  return `${normalizedBase}/#/u/${encodedKey}${hashQuery}`;
};

const parseProfileHashKey = (value: string): string => {
  if (!value.startsWith(PROFILE_HASH_PREFIX)) return '';
  const rawKey = value.slice(PROFILE_HASH_PREFIX.length).split('?')[0] || '';
  if (!rawKey) return '';
  try {
    return decodeURIComponent(rawKey).trim();
  } catch {
    return '';
  }
};

export const isAllowedMobilePublicProfileUrl = ({
  webBaseUrl,
  candidateUrl,
  allowNameFallback = false,
}: {
  webBaseUrl: string;
  candidateUrl: string;
  allowNameFallback?: boolean;
}): boolean => {
  const normalizedBase = normalizeBaseUrl(webBaseUrl);
  if (!normalizedBase) return false;

  const base = parseHttpUrl(normalizedBase);
  const candidate = parseHttpUrl(candidateUrl);
  if (!base || !candidate) return false;

  if (candidate.origin !== base.origin) return false;
  if (normalizePath(candidate.pathname) !== normalizePath(base.pathname)) return false;

  const key = parseProfileHashKey(String(candidate.hash || ''));
  if (!key) return false;

  if (key.startsWith(PROFILE_ID_PREFIX)) {
    return Boolean(normalizeUserId(key.slice(PROFILE_ID_PREFIX.length)));
  }

  if (!allowNameFallback) return false;
  if (!key.startsWith(PROFILE_NAME_PREFIX)) return false;
  return Boolean(normalizeUsername(key.slice(PROFILE_NAME_PREFIX.length)));
};

