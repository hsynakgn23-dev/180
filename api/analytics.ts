export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined>;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

type IncomingEvent = {
    eventId?: unknown;
    eventName?: unknown;
    eventTime?: unknown;
    sessionId?: unknown;
    userId?: unknown;
    pagePath?: unknown;
    pageQuery?: unknown;
    pageHash?: unknown;
    referrer?: unknown;
    properties?: unknown;
    firstTouch?: unknown;
    lastTouch?: unknown;
};

type InsertRow = {
    event_id: string;
    event_name: string;
    event_time: string;
    session_id: string | null;
    user_id: string | null;
    page_path: string | null;
    page_query: string | null;
    page_hash: string | null;
    referrer: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    click_id: string | null;
    properties: Record<string, unknown>;
    first_touch: Record<string, unknown> | null;
    last_touch: Record<string, unknown> | null;
};

const MAX_EVENTS_PER_REQUEST = 50;
const EVENT_NAME_REGEX = /^[a-z0-9_:-]{2,80}$/i;
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
        }
    }

    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            ...headers
        }
    });
};

const toTrimmed = (value: unknown, maxLength: number): string | null => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toIso = (value: unknown): string => {
    const raw = toTrimmed(value, 64);
    if (!raw) return new Date().toISOString();
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const parseBody = async (req: ApiRequest): Promise<unknown> => {
    if (req.body !== undefined) return req.body;
    if (typeof req.on !== 'function') return null;

    const chunks: string[] = [];
    await new Promise<void>((resolve) => {
        req.on?.('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
        });
        req.on?.('end', () => resolve());
    });

    const raw = chunks.join('').trim();
    if (!raw) return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
};

const normalizeEventName = (value: unknown): string | null => {
    const eventName = toTrimmed(value, 80);
    if (!eventName || !EVENT_NAME_REGEX.test(eventName)) return null;
    return eventName.toLowerCase();
};

const normalizeUserId = (value: unknown): string | null => {
    const userId = toTrimmed(value, 40);
    if (!userId) return null;
    return UUID_REGEX.test(userId) ? userId : null;
};

const normalizeProperties = (value: unknown): Record<string, unknown> => {
    const objectValue = toObject(value);
    if (!objectValue) return {};
    return objectValue;
};

const normalizeTouch = (value: unknown): Record<string, unknown> | null => {
    const touch = toObject(value);
    if (!touch) return null;
    return touch;
};

const toInsertRow = (rawEvent: IncomingEvent): InsertRow | null => {
    const eventName = normalizeEventName(rawEvent.eventName);
    if (!eventName) return null;

    const eventId = toTrimmed(rawEvent.eventId, 80) || crypto.randomUUID();
    const firstTouch = normalizeTouch(rawEvent.firstTouch);
    const lastTouch = normalizeTouch(rawEvent.lastTouch);
    const touch = lastTouch || firstTouch;

    const utmSource = toTrimmed(touch?.source, 120);
    const utmMedium = toTrimmed(touch?.medium, 120);
    const utmCampaign = toTrimmed(touch?.campaign, 180);
    const utmTerm = toTrimmed(touch?.term, 180);
    const utmContent = toTrimmed(touch?.content, 180);
    const clickId = toTrimmed(touch?.clickId, 180);

    return {
        event_id: eventId,
        event_name: eventName,
        event_time: toIso(rawEvent.eventTime),
        session_id: toTrimmed(rawEvent.sessionId, 120),
        user_id: normalizeUserId(rawEvent.userId),
        page_path: toTrimmed(rawEvent.pagePath, 300),
        page_query: toTrimmed(rawEvent.pageQuery, 600),
        page_hash: toTrimmed(rawEvent.pageHash, 300),
        referrer: toTrimmed(rawEvent.referrer || touch?.referrer, 600),
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
        click_id: clickId,
        properties: normalizeProperties(rawEvent.properties),
        first_touch: firstTouch,
        last_touch: lastTouch
    };
};

const getSupabaseConfig = (): { url: string; serviceRoleKey: string } | null => {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !serviceRoleKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey
    };
};

const insertEvents = async (rows: InsertRow[]): Promise<{ ok: boolean; error?: string }> => {
    const config = getSupabaseConfig();
    if (!config) {
        return { ok: true };
    }

    const endpoint = `${config.url}/rest/v1/analytics_events?on_conflict=event_id`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            'content-type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
    });

    if (response.ok) {
        return { ok: true };
    }

    const errorText = (await response.text()) || `HTTP ${response.status}`;
    return { ok: false, error: errorText.slice(0, 500) };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type'
    };

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, error: 'Method not allowed' }, corsHeaders);
    }

    const body = await parseBody(req);
    const objectBody = toObject(body);
    const rawEvents = Array.isArray(objectBody?.events)
        ? objectBody?.events
        : Array.isArray(body)
            ? body
            : [body];

    const rows = rawEvents
        .slice(0, MAX_EVENTS_PER_REQUEST)
        .map((raw) => toInsertRow((raw || {}) as IncomingEvent))
        .filter((item): item is InsertRow => Boolean(item));

    if (rows.length === 0) {
        return sendJson(
            res,
            400,
            { ok: false, error: 'No valid analytics events found.' },
            corsHeaders
        );
    }

    const result = await insertEvents(rows);
    if (!result.ok) {
        return sendJson(
            res,
            500,
            { ok: false, error: result.error || 'Insert failed.' },
            corsHeaders
        );
    }

    return sendJson(res, 202, { ok: true, accepted: rows.length }, corsHeaders);
}
