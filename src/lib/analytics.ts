type AnalyticsPrimitive = string | number | boolean | null;

type JsonValue = AnalyticsPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AnalyticsProperties = Record<string, JsonValue | undefined>;

export type AnalyticsEventName =
    | 'session_start'
    | 'page_view'
    | 'auth_view'
    | 'auth_submit'
    | 'auth_failure'
    | 'signup_success'
    | 'signup_pending_confirmation'
    | 'login_success'
    | 'oauth_start'
    | 'oauth_redirect_started'
    | 'oauth_failure'
    | 'password_reset_requested'
    | 'password_reset_completed'
    | 'ritual_submit_failed'
    | 'ritual_submitted'
    | 'share_click'
    | 'share_opened'
    | 'share_failed'
    | 'share_reward_claimed'
    | 'share_reward_denied';

export interface AttributionTouch {
    source: string;
    medium: string;
    campaign: string | null;
    term: string | null;
    content: string | null;
    clickId: string | null;
    landingPath: string;
    referrer: string | null;
    capturedAt: string;
}

export interface AnalyticsEvent {
    eventId: string;
    eventName: AnalyticsEventName;
    eventTime: string;
    sessionId: string;
    userId: string | null;
    pagePath: string;
    pageQuery: string;
    pageHash: string;
    referrer: string | null;
    properties: AnalyticsProperties;
    firstTouch: AttributionTouch | null;
    lastTouch: AttributionTouch | null;
}

const FIRST_TOUCH_KEY = '180_analytics_first_touch_v1';
const LAST_TOUCH_KEY = '180_analytics_last_touch_v1';
const SESSION_ID_KEY = '180_analytics_session_id_v1';
const SESSION_STARTED_KEY = '180_analytics_session_started_v1';
const PENDING_EVENTS_KEY = '180_analytics_pending_events_v1';
const EVENT_LOG_KEY = '180_analytics_event_log_v1';

const MAX_PENDING_EVENTS = 300;
const MAX_EVENT_LOG = 1000;
const BATCH_SIZE = 25;
const FLUSH_DELAY_MS = 1200;
const FLUSH_INTERVAL_MS = 15000;

const CLICK_ID_PARAMS = ['gclid', 'fbclid', 'ttclid', 'msclkid'] as const;

const isBrowser = (): boolean => typeof window !== 'undefined';

const isAnalyticsEnabled = (): boolean =>
    import.meta.env.VITE_ANALYTICS_ENABLED !== '0';

const getEndpoint = (): string => {
    const configured = String(import.meta.env.VITE_ANALYTICS_ENDPOINT || '').trim();
    return configured || '/api/analytics';
};

const safeGetStorageItem = (storage: Storage, key: string): string | null => {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
};

const safeSetStorageItem = (storage: Storage, key: string, value: string): void => {
    try {
        storage.setItem(key, value);
    } catch {
        // no-op
    }
};

const safeParseObject = <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const toQuery = (search: string): URLSearchParams => {
    try {
        return new URLSearchParams(search || '');
    } catch {
        return new URLSearchParams();
    }
};

const normalizeHost = (rawUrl: string): string | null => {
    if (!rawUrl) return null;
    try {
        return new URL(rawUrl).hostname || null;
    } catch {
        return null;
    }
};

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
        const next = value
            .slice(0, 30)
            .map((item) => sanitizeJsonValue(item, depth + 1))
            .filter((item): item is JsonValue => item !== undefined);
        return next;
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
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getSessionId = (): string => {
    if (!isBrowser()) return 'server';
    const existing = safeGetStorageItem(window.sessionStorage, SESSION_ID_KEY);
    if (existing) return existing;
    const next = generateId();
    safeSetStorageItem(window.sessionStorage, SESSION_ID_KEY, next);
    return next;
};

const readTouch = (key: string): AttributionTouch | null => {
    if (!isBrowser()) return null;
    return safeParseObject<AttributionTouch>(safeGetStorageItem(window.localStorage, key));
};

const writeTouch = (key: string, touch: AttributionTouch): void => {
    if (!isBrowser()) return;
    safeSetStorageItem(window.localStorage, key, JSON.stringify(touch));
};

const resolveClickId = (params: URLSearchParams): string | null => {
    for (const param of CLICK_ID_PARAMS) {
        const value = normalizeText(params.get(param), 200);
        if (value) return value;
    }
    return null;
};

const resolveTouchFromLocation = (): AttributionTouch => {
    const search = toQuery(window.location.search);
    const referrerRaw = normalizeText(document.referrer, 500);
    const referrerHost = normalizeHost(referrerRaw);
    const ownHost = window.location.hostname;
    const isExternalReferrer = Boolean(referrerHost && referrerHost !== ownHost);

    const source = normalizeText(search.get('utm_source'), 120);
    const medium = normalizeText(search.get('utm_medium'), 120);
    const campaign = normalizeText(search.get('utm_campaign'), 160) || null;
    const term = normalizeText(search.get('utm_term'), 160) || null;
    const content = normalizeText(search.get('utm_content'), 160) || null;
    const clickId = resolveClickId(search);
    const hasUtm = Boolean(source || medium || campaign || term || content || clickId);

    if (hasUtm) {
        return {
            source: source || (isExternalReferrer ? referrerHost || 'referral' : 'direct'),
            medium: medium || (isExternalReferrer ? 'referral' : 'none'),
            campaign,
            term,
            content,
            clickId,
            landingPath: window.location.pathname,
            referrer: referrerRaw || null,
            capturedAt: new Date().toISOString()
        };
    }

    if (isExternalReferrer) {
        return {
            source: referrerHost || 'referral',
            medium: 'referral',
            campaign: null,
            term: null,
            content: null,
            clickId: null,
            landingPath: window.location.pathname,
            referrer: referrerRaw || null,
            capturedAt: new Date().toISOString()
        };
    }

    return {
        source: 'direct',
        medium: 'none',
        campaign: null,
        term: null,
        content: null,
        clickId: null,
        landingPath: window.location.pathname,
        referrer: referrerRaw || null,
        capturedAt: new Date().toISOString()
    };
};

const shouldUpdateLastTouch = (current: AttributionTouch | null, next: AttributionTouch): boolean => {
    if (!current) return true;
    const isCurrentDirect = current.source === 'direct' && current.medium === 'none';
    const isNextDirect = next.source === 'direct' && next.medium === 'none';
    if (isCurrentDirect && !isNextDirect) return true;
    if (!isCurrentDirect && isNextDirect) return false;

    return (
        current.source !== next.source ||
        current.medium !== next.medium ||
        current.campaign !== next.campaign ||
        current.term !== next.term ||
        current.content !== next.content ||
        current.clickId !== next.clickId
    );
};

const captureAttributionTouch = (): { firstTouch: AttributionTouch; lastTouch: AttributionTouch } => {
    const first = readTouch(FIRST_TOUCH_KEY);
    const last = readTouch(LAST_TOUCH_KEY);
    const current = resolveTouchFromLocation();

    const firstTouch = first || current;
    const lastTouch = shouldUpdateLastTouch(last, current) ? current : (last || current);

    writeTouch(FIRST_TOUCH_KEY, firstTouch);
    writeTouch(LAST_TOUCH_KEY, lastTouch);

    return { firstTouch, lastTouch };
};

export const getAttributionContext = (): {
    firstTouch: AttributionTouch | null;
    lastTouch: AttributionTouch | null;
    sessionId: string | null;
} => {
    if (!isBrowser()) {
        return { firstTouch: null, lastTouch: null, sessionId: null };
    }
    return {
        firstTouch: readTouch(FIRST_TOUCH_KEY),
        lastTouch: readTouch(LAST_TOUCH_KEY),
        sessionId: getSessionId()
    };
};

const readPendingQueue = (): AnalyticsEvent[] => {
    if (!isBrowser()) return [];
    const parsed = safeParseObject<AnalyticsEvent[]>(
        safeGetStorageItem(window.localStorage, PENDING_EVENTS_KEY)
    );
    return Array.isArray(parsed) ? parsed : [];
};

const persistPendingQueue = (queue: AnalyticsEvent[]): void => {
    if (!isBrowser()) return;
    safeSetStorageItem(
        window.localStorage,
        PENDING_EVENTS_KEY,
        JSON.stringify(queue.slice(-MAX_PENDING_EVENTS))
    );
};

const appendToEventLog = (event: AnalyticsEvent): void => {
    if (!isBrowser()) return;
    const current = safeParseObject<AnalyticsEvent[]>(
        safeGetStorageItem(window.localStorage, EVENT_LOG_KEY)
    );
    const next = Array.isArray(current) ? [...current, event] : [event];
    safeSetStorageItem(
        window.localStorage,
        EVENT_LOG_KEY,
        JSON.stringify(next.slice(-MAX_EVENT_LOG))
    );
};

let initialized = false;
let flushing = false;
let flushTimer: number | null = null;
let flushInterval: number | null = null;
let pendingQueue: AnalyticsEvent[] = [];

const flushWithBeacon = (): void => {
    if (!isBrowser()) return;
    if (!isAnalyticsEnabled()) return;
    if (!pendingQueue.length) return;
    if (typeof navigator.sendBeacon !== 'function') return;

    const endpoint = getEndpoint();
    const payload = JSON.stringify({ events: pendingQueue.slice(0, BATCH_SIZE) });
    const sent = navigator.sendBeacon(
        endpoint,
        new Blob([payload], { type: 'application/json' })
    );

    if (sent) {
        pendingQueue = pendingQueue.slice(BATCH_SIZE);
        persistPendingQueue(pendingQueue);
    }
};

const flushPendingEvents = async (): Promise<void> => {
    if (!isBrowser()) return;
    if (!isAnalyticsEnabled()) return;
    if (flushing) return;
    if (!pendingQueue.length) return;

    flushing = true;
    try {
        const batch = pendingQueue.slice(0, BATCH_SIZE);
        const response = await fetch(getEndpoint(), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ events: batch }),
            keepalive: true
        });

        if (!response.ok) return;

        pendingQueue = pendingQueue.slice(batch.length);
        persistPendingQueue(pendingQueue);
    } catch {
        // no-op
    } finally {
        flushing = false;
    }
};

const scheduleFlush = (): void => {
    if (!isBrowser()) return;
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushPendingEvents();
    }, FLUSH_DELAY_MS);
};

const trackPageView = (reason: string): void => {
    trackEvent('page_view', { reason });
};

export const trackEvent = (
    eventName: AnalyticsEventName,
    properties?: AnalyticsProperties,
    options?: { userId?: string | null }
): void => {
    if (!isBrowser()) return;
    if (!initialized) {
        initAnalytics();
    }

    const { firstTouch, lastTouch } = captureAttributionTouch();
    const sessionId = getSessionId();
    const event: AnalyticsEvent = {
        eventId: generateId(),
        eventName,
        eventTime: new Date().toISOString(),
        sessionId,
        userId: options?.userId || null,
        pagePath: window.location.pathname,
        pageQuery: window.location.search,
        pageHash: window.location.hash,
        referrer: normalizeText(document.referrer, 500) || null,
        properties: sanitizeProperties(properties),
        firstTouch,
        lastTouch
    };

    appendToEventLog(event);
    pendingQueue.push(event);
    if (pendingQueue.length > MAX_PENDING_EVENTS) {
        pendingQueue = pendingQueue.slice(-MAX_PENDING_EVENTS);
    }
    persistPendingQueue(pendingQueue);

    if (import.meta.env.DEV) {
        // Useful for local verification while wiring events.
        console.info('[analytics]', event.eventName, event.properties);
    }

    scheduleFlush();
};

export const initAnalytics = (): void => {
    if (!isBrowser()) return;
    if (initialized) return;
    initialized = true;

    pendingQueue = readPendingQueue();
    captureAttributionTouch();
    const sessionId = getSessionId();
    const hasSessionStarted = safeGetStorageItem(window.sessionStorage, SESSION_STARTED_KEY) === '1';

    const onRouteChange = (reason: string) => {
        captureAttributionTouch();
        trackPageView(reason);
    };

    window.addEventListener('hashchange', () => onRouteChange('hashchange'));
    window.addEventListener('popstate', () => onRouteChange('popstate'));
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushWithBeacon();
        }
    });
    window.addEventListener('beforeunload', flushWithBeacon);

    if (!hasSessionStarted) {
        safeSetStorageItem(window.sessionStorage, SESSION_STARTED_KEY, '1');
        trackEvent('session_start', { entryPoint: window.location.pathname, sessionId });
    }
    trackPageView('init');

    if (flushInterval === null) {
        flushInterval = window.setInterval(() => {
            void flushPendingEvents();
        }, FLUSH_INTERVAL_MS);
    }
    if (pendingQueue.length) {
        scheduleFlush();
    }
};
