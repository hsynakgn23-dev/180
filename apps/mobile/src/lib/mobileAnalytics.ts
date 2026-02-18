import type { AnalyticsEventName } from '../../../../packages/shared/src/mobile/analyticsEvents';

type AnalyticsPrimitive = string | number | boolean | null;
type JsonValue = AnalyticsPrimitive | JsonValue[] | { [key: string]: JsonValue };
type AnalyticsProperties = Record<string, JsonValue | undefined>;

type MobileTrackOptions = {
  userId?: string | null;
  sessionId?: string | null;
};

const DEFAULT_PAGE_PATH = 'mobile://app';
const ENDPOINT_ENV_KEY = 'EXPO_PUBLIC_ANALYTICS_ENDPOINT';
const ENABLED_ENV_KEY = 'EXPO_PUBLIC_ANALYTICS_ENABLED';
const ANALYTICS_PAUSE_MS = 10 * 60 * 1000;
const PERMANENT_HTTP_STATUSES = new Set([400, 401, 403, 404, 405, 410, 422]);
let warnedMissingEndpoint = false;
let warnedNetworkError = false;
let warnedDisabled = false;
const warnedHttpErrorKeys = new Set<string>();
let pausedUntilMs = 0;
let warnedPaused = false;

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const sanitizeJsonValue = (value: unknown, depth = 0): JsonValue | undefined => {
  if (depth > 3) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return normalizeText(value, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const next: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(source)) {
      const sanitized = sanitizeJsonValue(nested, depth + 1);
      if (sanitized === undefined) continue;
      next[key] = sanitized;
    }
    return next;
  }
  return undefined;
};

const sanitizeProperties = (properties?: AnalyticsProperties): AnalyticsProperties => {
  if (!properties) return {};
  const next: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    const sanitized = sanitizeJsonValue(value);
    if (sanitized === undefined) continue;
    next[key] = sanitized;
  }
  return next;
};

const generateId = (): string => {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const sessionId = generateId();

const getAnalyticsEndpoint = (): string => {
  const endpoint = normalizeText(process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT, 500);
  return endpoint;
};

const isAnalyticsEnabled = (): boolean => {
  const raw = normalizeText(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED, 10).toLowerCase();
  if (!raw) return true;
  return !(raw === '0' || raw === 'false' || raw === 'off');
};

export const trackMobileEvent = async (
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties,
  options?: MobileTrackOptions
): Promise<void> => {
  if (!isAnalyticsEnabled()) {
    if (__DEV__ && !warnedDisabled) {
      warnedDisabled = true;
      console.info('[mobile analytics skipped]', eventName, 'disabled by', ENABLED_ENV_KEY);
    }
    return;
  }

  if (pausedUntilMs > Date.now()) {
    if (__DEV__ && !warnedPaused) {
      warnedPaused = true;
      console.warn(
        '[mobile analytics paused]',
        `retry after ${new Date(pausedUntilMs).toISOString()}`
      );
    }
    return;
  }
  warnedPaused = false;

  const endpoint = getAnalyticsEndpoint();
  if (!endpoint) {
    if (__DEV__ && !warnedMissingEndpoint) {
      warnedMissingEndpoint = true;
      console.info('[mobile analytics skipped]', eventName, 'missing', ENDPOINT_ENV_KEY);
    }
    return;
  }

  const payload = {
    events: [
      {
        eventId: generateId(),
        eventName,
        eventTime: new Date().toISOString(),
        sessionId: options?.sessionId || sessionId,
        userId: options?.userId || null,
        pagePath: DEFAULT_PAGE_PATH,
        pageQuery: '',
        pageHash: '',
        referrer: null,
        properties: sanitizeProperties(properties),
      },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok && __DEV__) {
      const key = `${response.status}:${endpoint}`;
      if (!warnedHttpErrorKeys.has(key)) {
        warnedHttpErrorKeys.add(key);
        const text = await response.text();
        console.warn('[mobile analytics error]', response.status, endpoint, text.slice(0, 240));
      }
      if (PERMANENT_HTTP_STATUSES.has(response.status)) {
        pausedUntilMs = Date.now() + ANALYTICS_PAUSE_MS;
      }
    }
  } catch (error) {
    if (__DEV__ && !warnedNetworkError) {
      warnedNetworkError = true;
      console.warn('[mobile analytics network error]', error);
    }
  }
};
