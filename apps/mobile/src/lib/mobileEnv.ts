export type MobileEnvRecord = Record<string, string | undefined>;
export const MOBILE_API_BASE_URL_ERROR = 'Mobil quiz API base URL bulunamadi.';

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

const readBrowserLocation = (): URL | null => {
  const maybeLocation = (globalThis as { location?: { href?: string } }).location;
  const href = normalizeText(maybeLocation?.href, 1200);
  if (!href) return null;
  try {
    return new URL(href);
  } catch {
    return null;
  }
};

const isLoopbackHostname = (value: string): boolean => {
  const normalized = normalizeText(value, 120).toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
};

const isEmulatorHostname = (value: string): boolean => {
  const normalized = normalizeText(value, 120).toLowerCase();
  return normalized === '10.0.2.2' || normalized === '10.0.3.2';
};

const isEnvFlagEnabled = (value: string | undefined, defaultValue = true): boolean => {
  const normalized = normalizeText(value, 60).toLowerCase();
  if (!normalized) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(normalized);
};

const adaptBaseUrlForBrowser = (value: unknown): string => {
  const parsed = parseAbsoluteHttpUrl(value);
  if (!parsed) return '';

  const browserLocation = readBrowserLocation();
  if (!browserLocation) return normalizeUrl(parsed);

  const browserHostname = normalizeText(browserLocation.hostname, 120).toLowerCase();
  const targetHostname = normalizeText(parsed.hostname, 120).toLowerCase();
  if (!isLoopbackHostname(browserHostname)) return normalizeUrl(parsed);
  if (!isLoopbackHostname(targetHostname) && !isEmulatorHostname(targetHostname)) {
    return normalizeUrl(parsed);
  }

  const portSegment = parsed.port ? `:${parsed.port}` : '';
  const normalizedPath = stripTrailingSlashes(parsed.pathname || '/');
  const pathSegment = normalizedPath === '/' ? '' : normalizedPath;
  return `${browserLocation.protocol}//${browserLocation.hostname}${portSegment}${pathSegment}`;
};

const resolveBrowserDevApiBase = (env: MobileEnvRecord): string => {
  const browserLocation = readBrowserLocation();
  if (!browserLocation || !isLoopbackHostname(browserLocation.hostname)) return '';

  if (browserLocation.port && browserLocation.port !== '8080') {
    return `${browserLocation.protocol}//${browserLocation.hostname}:8080`;
  }

  const candidates = [
    readEnv(env, 'EXPO_PUBLIC_WEB_BASE_URL'),
    readEnv(env, 'EXPO_PUBLIC_WEB_APP_URL'),
    readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'),
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics'),
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily'),
  ];

  for (const candidate of candidates) {
    const adapted = adaptBaseUrlForBrowser(candidate);
    if (!adapted) continue;
    try {
      const parsed = new URL(adapted);
      if (parsed.hostname === browserLocation.hostname) {
        return adapted;
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return '';
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

const readStaticExpoPublicEnv = (key: string): string => {
  switch (key) {
    case 'EXPO_PUBLIC_WEB_BASE_URL':
      return normalizeText(process.env.EXPO_PUBLIC_WEB_BASE_URL, 1000);
    case 'EXPO_PUBLIC_WEB_APP_URL':
      return normalizeText(process.env.EXPO_PUBLIC_WEB_APP_URL, 1000);
    case 'EXPO_PUBLIC_REFERRAL_API_BASE':
      return normalizeText(process.env.EXPO_PUBLIC_REFERRAL_API_BASE, 1000);
    case 'EXPO_PUBLIC_ANALYTICS_ENDPOINT':
      return normalizeText(process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT, 1000);
    case 'EXPO_PUBLIC_DAILY_API_URL':
      return normalizeText(process.env.EXPO_PUBLIC_DAILY_API_URL, 1000);
    case 'EXPO_PUBLIC_PUSH_API_BASE':
      return normalizeText(process.env.EXPO_PUBLIC_PUSH_API_BASE, 1000);
    default:
      return '';
  }
};

const readEnv = (env: MobileEnvRecord, key: string): string => {
  const explicitValue = normalizeText(env[key], 1000);
  if (explicitValue) return explicitValue;
  if (env !== process.env) return '';
  return readStaticExpoPublicEnv(key);
};

export const resolveMobileApiBaseUrl = (env: MobileEnvRecord = process.env): string => {
  const browserDevBase = resolveBrowserDevApiBase(env);
  if (browserDevBase) return browserDevBase;

  const explicitReferralBase = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'));
  if (explicitReferralBase) return explicitReferralBase;

  const analyticsBase = adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics')
  );
  if (analyticsBase) return analyticsBase;

  const dailyBase = adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily')
  );
  if (dailyBase) return dailyBase;

  return '';
};

export const resolveMobileApiUrl = (path: string, env: MobileEnvRecord = process.env): string => {
  const apiBase = resolveMobileApiBaseUrl(env);
  if (!apiBase) return '';
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
};

export const resolveMobileWebBaseUrl = (env: MobileEnvRecord = process.env): string => {
  const explicitWebBaseAlias = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_WEB_BASE_URL'));
  if (explicitWebBaseAlias) return explicitWebBaseAlias;

  const explicitWebBase = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_WEB_APP_URL'));
  if (explicitWebBase) return explicitWebBase;

  const referralBase = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'));
  if (referralBase) return referralBase;

  const analyticsBase = adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics')
  );
  if (analyticsBase) return analyticsBase;

  const browserDevBase = resolveBrowserDevApiBase(env);
  if (browserDevBase) return browserDevBase;

  return adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily')
  );
};

export const resolveMobileDailyApiUrl = (env: MobileEnvRecord = process.env): string => {
  const browserDevBase = resolveBrowserDevApiBase(env);
  if (browserDevBase) return `${browserDevBase}/api/daily`;

  const explicitDailyUrl = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'));
  if (explicitDailyUrl) return explicitDailyUrl;

  const analyticsBase = adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics')
  );
  if (analyticsBase) return `${analyticsBase}/api/daily`;

  const apiBase = resolveMobileApiBaseUrl(env);
  if (apiBase) return `${apiBase}/api/daily`;

  const webBase = resolveMobileWebBaseUrl(env);
  if (webBase) return `${webBase}/api/daily`;

  return '';
};

export const resolveMobileReferralApiBase = (env: MobileEnvRecord = process.env): string => {
  const browserDevBase = resolveBrowserDevApiBase(env);
  if (browserDevBase) return browserDevBase;

  const explicitReferralBase = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_REFERRAL_API_BASE'));
  if (explicitReferralBase) return explicitReferralBase;

  const analyticsBase = adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_ANALYTICS_ENDPOINT'), '/api/analytics')
  );
  if (analyticsBase) return analyticsBase;

  return adaptBaseUrlForBrowser(
    deriveOriginFromEndpoint(readEnv(env, 'EXPO_PUBLIC_DAILY_API_URL'), '/api/daily')
  );
};

export const resolveMobilePushApiBase = (env: MobileEnvRecord = process.env): string => {
  const browserDevBase = resolveBrowserDevApiBase(env);
  if (browserDevBase) return browserDevBase;

  const explicitPushBase = adaptBaseUrlForBrowser(readEnv(env, 'EXPO_PUBLIC_PUSH_API_BASE'));
  if (explicitPushBase) return explicitPushBase;

  const referralBase = resolveMobileReferralApiBase(env);
  if (referralBase) return referralBase;

  return resolveMobileWebBaseUrl(env);
};
