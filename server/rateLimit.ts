import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

type RateLimitScope = 'ip' | 'auth';

type RateLimitRule = {
  scope: RateLimitScope;
  bucket: string;
  limit: number;
  windowMs: number;
};

type RateLimitPolicy = {
  rules: RateLimitRule[];
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

type RateLimitResult = {
  limited: boolean;
  headers: Record<string, string>;
  retryAfterSeconds: number;
};

type GlobalRateLimitState = {
  buckets: Map<string, RateLimitBucket>;
  lastCleanupAt: number;
};

const STATE_KEY = Symbol.for('absolute-cinema.server.rate-limit.state');
const CLEANUP_INTERVAL_MS = 60_000;
const STALE_BUCKET_TTL_MS = 15 * 60_000;

const getState = (): GlobalRateLimitState => {
  const globalState = globalThis as typeof globalThis & {
    [STATE_KEY]?: GlobalRateLimitState;
  };

  if (!globalState[STATE_KEY]) {
    globalState[STATE_KEY] = {
      buckets: new Map<string, RateLimitBucket>(),
      lastCleanupAt: 0,
    };
  }

  return globalState[STATE_KEY]!;
};

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isReadOnlyMethod = (method: string): boolean =>
  method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

const getHeader = (req: IncomingMessage, key: string): string => {
  const raw = req.headers?.[key.toLowerCase()];
  if (Array.isArray(raw)) return normalizeText(raw[0], 512);
  return normalizeText(raw, 512);
};

const getFirstForwardedIp = (value: string): string =>
  normalizeText(value.split(',')[0] || '', 120);

const normalizeIp = (value: string): string => {
  const ip = normalizeText(value, 120)
    .replace(/^\[|\]$/g, '')
    .replace(/^::ffff:/i, '');
  return ip || 'unknown';
};

const getClientIp = (req: IncomingMessage): string => {
  const forwarded = getFirstForwardedIp(getHeader(req, 'cf-connecting-ip') || getHeader(req, 'x-forwarded-for'));
  const realIp = normalizeText(getHeader(req, 'x-real-ip'), 120);
  const remoteAddress = normalizeText(req.socket?.remoteAddress, 120);
  return normalizeIp(forwarded || realIp || remoteAddress || 'unknown');
};

const getBearerToken = (req: IncomingMessage): string => {
  const authHeader = getHeader(req, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return normalizeText(match?.[1], 8_000);
};

const hashSubject = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 24);

const cleanupBuckets = (state: GlobalRateLimitState, now: number): void => {
  if (now - state.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  state.lastCleanupAt = now;

  for (const [key, bucket] of state.buckets.entries()) {
    if (bucket.resetAt + STALE_BUCKET_TTL_MS <= now || bucket.lastSeenAt + STALE_BUCKET_TTL_MS <= now) {
      state.buckets.delete(key);
    }
  }
};

const consumeBucket = (
  state: GlobalRateLimitState,
  key: string,
  limit: number,
  windowMs: number,
  now: number
) => {
  const current = state.buckets.get(key);
  let next: RateLimitBucket;

  if (!current || current.resetAt <= now) {
    next = {
      count: 1,
      resetAt: now + windowMs,
      lastSeenAt: now,
    };
  } else {
    next = {
      count: current.count + 1,
      resetAt: current.resetAt,
      lastSeenAt: now,
    };
  }

  state.buckets.set(key, next);

  return {
    allowed: next.count <= limit,
    remaining: Math.max(0, limit - next.count),
    resetAt: next.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((next.resetAt - now) / 1000)),
    limit,
  };
};

const buildPolicy = (input: {
  bucket: string;
  ipLimit: number;
  authLimit?: number;
  windowMs: number;
  readOnly?: boolean;
  globalIpLimit?: number;
  globalAuthLimit?: number;
}): RateLimitPolicy => {
  const rules: RateLimitRule[] = [];
  const globalIpLimit = input.globalIpLimit ?? 240;
  const globalAuthLimit = input.globalAuthLimit ?? Math.max(input.authLimit ?? 0, 120);
  const globalBucket = input.readOnly ? 'global:read' : 'global:write';
  const globalAuthBucket = input.readOnly ? 'global-auth:read' : 'global-auth:write';

  rules.push({
    scope: 'ip',
    bucket: globalBucket,
    limit: globalIpLimit,
    windowMs: 60_000,
  });
  rules.push({
    scope: 'ip',
    bucket: input.bucket,
    limit: input.ipLimit,
    windowMs: input.windowMs,
  });

  if (input.authLimit && input.authLimit > 0) {
    rules.push({
      scope: 'auth',
      bucket: globalAuthBucket,
      limit: globalAuthLimit,
      windowMs: 60_000,
    });
    rules.push({
      scope: 'auth',
      bucket: input.bucket,
      limit: input.authLimit,
      windowMs: input.windowMs,
    });
  }

  return { rules };
};

const resolvePolicy = (pathname: string, method: string): RateLimitPolicy => {
  const normalizedMethod = normalizeText(method, 16).toUpperCase() || 'GET';
  const readOnly = isReadOnlyMethod(normalizedMethod);

  if (pathname.startsWith('/api/internal/')) {
    return buildPolicy({
      bucket: 'internal',
      ipLimit: 600,
      authLimit: 300,
      windowMs: 60_000,
      readOnly,
      globalIpLimit: 1200,
      globalAuthLimit: 600,
    });
  }

  if (pathname.startsWith('/api/cron/')) {
    return buildPolicy({
      bucket: 'cron',
      ipLimit: 120,
      authLimit: 60,
      windowMs: 60_000,
      readOnly,
      globalIpLimit: 240,
      globalAuthLimit: 120,
    });
  }

  if (pathname.startsWith('/api/og/')) {
    return buildPolicy({
      bucket: 'og',
      ipLimit: 300,
      windowMs: 60_000,
      readOnly: true,
      globalIpLimit: 600,
    });
  }

  if (pathname.startsWith('/api/admin/')) {
    return buildPolicy({
      bucket: readOnly ? 'admin-read' : 'admin-write',
      ipLimit: readOnly ? 90 : 30,
      authLimit: readOnly ? 60 : 20,
      windowMs: 60_000,
      readOnly,
      globalIpLimit: 180,
      globalAuthLimit: 90,
    });
  }

  if (
    pathname === '/api/wallet-rewarded' ||
    pathname === '/api/wallet-spend' ||
    pathname === '/api/wallet-consume' ||
    pathname === '/api/wallet-topup-verify' ||
    pathname === '/api/subscription-verify' ||
    pathname === '/api/account-delete'
  ) {
    return buildPolicy({
      bucket: 'wallet-write',
      ipLimit: 20,
      authLimit: 10,
      windowMs: 60_000,
      readOnly: false,
      globalIpLimit: 80,
      globalAuthLimit: 40,
    });
  }

  if (
    pathname === '/api/daily-quiz-answer' ||
    pathname === '/api/pool-answer' ||
    pathname === '/api/rush-answer' ||
    pathname === '/api/pool-joker' ||
    pathname === '/api/rush-joker' ||
    pathname === '/api/pool-swipe' ||
    pathname === '/api/blur-quiz'
  ) {
    return buildPolicy({
      bucket: 'quiz-play',
      ipLimit: 45,
      authLimit: 24,
      windowMs: 60_000,
      readOnly: false,
      globalIpLimit: 120,
      globalAuthLimit: 60,
    });
  }

  if (
    pathname === '/api/rush-start' ||
    pathname === '/api/rush-complete' ||
    pathname === '/api/pool-quiz' ||
    pathname === '/api/daily-bundle'
  ) {
    return buildPolicy({
      bucket: 'quiz-session',
      ipLimit: 60,
      authLimit: 30,
      windowMs: 60_000,
      readOnly: false,
      globalIpLimit: 180,
      globalAuthLimit: 90,
    });
  }

  if (pathname === '/api/referral' || pathname === '/api/referral/create' || pathname === '/api/referral/claim') {
    return buildPolicy({
      bucket: 'referral',
      ipLimit: 12,
      authLimit: 6,
      windowMs: 10 * 60_000,
      readOnly: false,
      globalIpLimit: 40,
      globalAuthLimit: 20,
    });
  }

  if (pathname === '/api/push/test' || pathname === '/api/push/engagement') {
    return buildPolicy({
      bucket: 'push',
      ipLimit: 30,
      authLimit: 15,
      windowMs: 60_000,
      readOnly: false,
      globalIpLimit: 90,
      globalAuthLimit: 45,
    });
  }

  if (pathname === '/api/analytics' || pathname === '/api/ad-impression') {
    return buildPolicy({
      bucket: 'analytics',
      ipLimit: 90,
      authLimit: 45,
      windowMs: 60_000,
      readOnly: false,
      globalIpLimit: 180,
      globalAuthLimit: 90,
    });
  }

  if (pathname === '/api/subscription-status' || pathname === '/api/wallet-status') {
    return buildPolicy({
      bucket: 'status',
      ipLimit: 90,
      authLimit: 45,
      windowMs: 60_000,
      readOnly: true,
      globalIpLimit: 180,
      globalAuthLimit: 90,
    });
  }

  return buildPolicy({
    bucket: readOnly ? 'read-default' : 'write-default',
    ipLimit: readOnly ? 180 : 60,
    authLimit: readOnly ? 90 : 30,
    windowMs: 60_000,
    readOnly,
    globalIpLimit: readOnly ? 300 : 120,
    globalAuthLimit: readOnly ? 150 : 60,
  });
};

export const evaluateRateLimit = (req: IncomingMessage, pathname: string): RateLimitResult => {
  const method = normalizeText(req.method, 16).toUpperCase() || 'GET';
  if (method === 'OPTIONS') {
    return {
      limited: false,
      retryAfterSeconds: 0,
      headers: {},
    };
  }
  const policy = resolvePolicy(pathname, method);
  const clientIp = getClientIp(req);
  const bearerToken = getBearerToken(req);
  const authSubject = bearerToken ? hashSubject(bearerToken) : '';
  const state = getState();
  const now = Date.now();

  cleanupBuckets(state, now);

  let mostRestrictive: {
    remaining: number;
    resetAt: number;
    limit: number;
    retryAfterSeconds: number;
  } | null = null;

  for (const rule of policy.rules) {
    const subject =
      rule.scope === 'auth'
        ? authSubject
        : clientIp;

    if (!subject) continue;

    const key = `${rule.scope}:${rule.bucket}:${subject}`;
    const result = consumeBucket(state, key, rule.limit, rule.windowMs, now);
    if (
      !mostRestrictive ||
      result.remaining < mostRestrictive.remaining ||
      (result.remaining === mostRestrictive.remaining && result.resetAt < mostRestrictive.resetAt)
    ) {
      mostRestrictive = result;
    }

    if (!result.allowed) {
      return {
        limited: true,
        retryAfterSeconds: result.retryAfterSeconds,
        headers: {
          'retry-after': String(result.retryAfterSeconds),
          'x-ratelimit-limit': String(result.limit),
          'x-ratelimit-remaining': String(result.remaining),
          'x-ratelimit-reset': new Date(result.resetAt).toISOString(),
        },
      };
    }
  }

  if (!mostRestrictive) {
    return {
      limited: false,
      retryAfterSeconds: 0,
      headers: {},
    };
  }

  return {
    limited: false,
    retryAfterSeconds: mostRestrictive.retryAfterSeconds,
    headers: {
      'x-ratelimit-limit': String(mostRestrictive.limit),
      'x-ratelimit-remaining': String(mostRestrictive.remaining),
      'x-ratelimit-reset': new Date(mostRestrictive.resetAt).toISOString(),
    },
  };
};
