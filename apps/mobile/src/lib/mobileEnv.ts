export type MobileEnvRecord = Record<string, string | undefined>;

const normalizeText = (value: unknown, maxLength = 600): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

const parseAbsoluteHttpUrl = (value: unknown): URL | null => {
  const text = normalizeText(value, 1000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.search = '';
    parsed.hash = '';
    return parsed;
  } catch {
    return null;
  }
};

const normalizeUrl = (url: URL): string => {
  const normalizedPath = stripTrailingSlashes(url.pathname || '/');
  const path = normalizedPath === '/' ? '' : normalizedPath;
  return `${url.origin}${path}`;
};

export const normalizeBaseUrl = (value: unknown): string => {
  const parsed = parseAbsoluteHttpUrl(value);
  if (!parsed) return '';
  return normalizeUrl(parsed);
};

export const deriveOriginFromEndpoint = (value: unknown, marker: string): string => {
  const parsed = parseAbsoluteHttpUrl(value);
  if (!parsed) return '';

  const normalizedMarker = normalizeText(marker, 120);
  if (!normalizedMarker || !normalizedMarker.startsWith('/')) return '';

  const markerIndex = parsed.pathname.indexOf(normalizedMarker);
  if (markerIndex < 0) return '';

  const basePath = stripTrailingSlashes(parsed.pathname.slice(0, markerIndex) || '/');
  return `${parsed.origin}${basePath === '/' ? '' : basePath}`;
};

const readEnv = (env: MobileEnvRecord, key: string): string => normalizeText(env[key], 1000);

export const resolveMobileWebBaseUrl = (env: MobileEnvRecord = process.env): string => {
  const explicitWebBase = normalizeBaseUrl(readEnv(env, 'EXPO_PUBLIC_WEB_APP_URL'));
  if (explicitWebBase) return explicitWebBase;

  const referralBase = normalizeBaseUrl(readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'));
  if (referralBase) return referralBase;

  const analyticsBase = deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics');
  if (analyticsBase) return analyticsBase;

  return deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily');
};

export const resolveMobileDailyApiUrl = (env: MobileEnvRecord = process.env): string => {
  const explicitDailyUrl = normalizeBaseUrl(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'));
  if (explicitDailyUrl) return explicitDailyUrl;

  const analyticsBase = deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics');
  if (!analyticsBase) return '';

  return `${analyticsBase}/api/daily`;
};

export const resolveMobileReferralApiBase = (env: MobileEnvRecord = process.env): string => {
  const explicitReferralBase = normalizeBaseUrl(readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'));
  if (explicitReferralBase) return explicitReferralBase;

  const analyticsBase = deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics');
  if (analyticsBase) return analyticsBase;

  return deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily');
};

export const resolveMobilePushApiBase = (env: MobileEnvRecord = process.env): string => {
  const explicitPushBase = normalizeBaseUrl(readEnv(env, 'EXPO_PUBLIC_PUSH_API_BASE'));
  if (explicitPushBase) return explicitPushBase;

  const referralBase = resolveMobileReferralApiBase(env);
  if (referralBase) return referralBase;

  return resolveMobileWebBaseUrl(env);
};
