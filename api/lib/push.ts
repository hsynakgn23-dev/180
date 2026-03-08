type SupabasePushConfig = {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
};

type AuthUser = {
    id: string;
    email: string;
};

type PushAudience = {
    userId: string;
    tokens: string[];
};

type PushTicket = {
    id?: unknown;
    status?: unknown;
};

type ExpoPushMessageInput = {
    to: string;
    title: string;
    body: string;
    sound?: 'default' | null;
    data?: Record<string, unknown>;
};

type NotificationEventKind = 'comment' | 'like' | 'follow' | 'daily_drop' | 'streak' | 'generic';

type NotificationEventInsertInput = {
    recipientUserId: string;
    actorUserId?: string | null;
    ritualId?: string | null;
    kind: NotificationEventKind;
    title: string;
    body: string;
    deepLink?: string | null;
    metadata?: Record<string, unknown>;
};

const EXPO_PUSH_TOKEN_REGEX = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const MAX_TOKENS_PER_USER = 25;
const EXPO_CHUNK_SIZE = 100;

const normalizeText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const normalizeEmail = (email: string | null | undefined, userId: string): string => {
    const value = String(email || '').trim().toLowerCase();
    if (value) return value;
    return `${userId}@users.local`;
};

const extractPushTokens = (mobilePushState: unknown): string[] => {
    const state = toObject(mobilePushState);
    if (!state) return [];

    const rawDevices = state.devices;
    if (!rawDevices || typeof rawDevices !== 'object' || Array.isArray(rawDevices)) return [];

    const tokens = Object.values(rawDevices as Record<string, unknown>)
        .map((device) => {
            const parsedDevice = toObject(device);
            return normalizeText(parsedDevice?.expoPushToken, 320);
        })
        .filter((token) => EXPO_PUSH_TOKEN_REGEX.test(token));

    return Array.from(new Set(tokens)).slice(0, MAX_TOKENS_PER_USER);
};

const normalizeNotificationEventKind = (value: unknown): NotificationEventKind => {
    const normalized = normalizeText(value, 24).toLowerCase();
    if (
        normalized === 'comment' ||
        normalized === 'like' ||
        normalized === 'follow' ||
        normalized === 'daily_drop' ||
        normalized === 'streak'
    ) {
        return normalized;
    }
    return 'generic';
};

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
};

export const getSupabasePushConfig = (): SupabasePushConfig | null => {
    const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = String(
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    ).trim();

    if (!url || !serviceRoleKey || !anonKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey,
        anonKey
    };
};

export const readAuthUserFromAccessToken = async (
    config: SupabasePushConfig,
    accessToken: string
): Promise<AuthUser | null> => {
    try {
        const response = await fetch(`${config.url}/auth/v1/user`, {
            headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) return null;

        const raw = (await response.json()) as { id?: unknown; email?: unknown };
        const id = normalizeText(raw.id, 120);
        if (!id) return null;

        return {
            id,
            email: normalizeEmail(normalizeText(raw.email, 240), id)
        };
    } catch {
        return null;
    }
};

export const readUserPushTokens = async (
    config: SupabasePushConfig,
    userId: string
): Promise<{ ok: true; tokens: string[] } | { ok: false; error: string }> => {
    const normalizedUserId = normalizeText(userId, 120);
    if (!normalizedUserId) {
        return { ok: false, error: 'Missing recipient user id.' };
    }

    const endpoint = `${config.url}/rest/v1/profiles?select=mobile_push_state&user_id=eq.${encodeURIComponent(normalizedUserId)}&limit=1`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                apikey: config.serviceRoleKey,
                Authorization: `Bearer ${config.serviceRoleKey}`
            }
        });
        if (!response.ok) {
            return {
                ok: false,
                error: normalizeText(await response.text(), 320) || `HTTP ${response.status}`
            };
        }

        const payload = (await response.json()) as unknown;
        const firstRow =
            Array.isArray(payload) && payload.length > 0 ? toObject(payload[0]) : null;
        return {
            ok: true,
            tokens: extractPushTokens(firstRow?.mobile_push_state)
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Push token read failed.', 320)
        };
    }
};

export const readAllPushAudiences = async (
    config: SupabasePushConfig
): Promise<{ ok: true; audiences: PushAudience[] } | { ok: false; error: string }> => {
    const endpoint = `${config.url}/rest/v1/profiles?select=user_id,mobile_push_state&mobile_push_state=not.is.null`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                apikey: config.serviceRoleKey,
                Authorization: `Bearer ${config.serviceRoleKey}`
            }
        });
        if (!response.ok) {
            return {
                ok: false,
                error: normalizeText(await response.text(), 320) || `HTTP ${response.status}`
            };
        }

        const payload = (await response.json()) as unknown;
        const audiences = Array.isArray(payload)
            ? payload
                  .map((entry) => {
                      const row = toObject(entry);
                      const userId = normalizeText(row?.user_id, 120);
                      const tokens = extractPushTokens(row?.mobile_push_state);
                      if (!userId || tokens.length === 0) return null;
                      return { userId, tokens };
                  })
                  .filter((entry): entry is PushAudience => Boolean(entry))
            : [];

        return {
            ok: true,
            audiences
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(error instanceof Error ? error.message : 'Push audience read failed.', 320)
        };
    }
};

export const createNotificationEvent = async (
    config: SupabasePushConfig,
    input: NotificationEventInsertInput
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> => {
    const recipientUserId = normalizeText(input.recipientUserId, 120);
    if (!recipientUserId) {
        return { ok: false, error: 'Missing recipient user id.' };
    }

    const endpoint = `${config.url}/rest/v1/notification_events`;
    const payload = {
        recipient_user_id: recipientUserId,
        actor_user_id: normalizeText(input.actorUserId, 120) || null,
        ritual_id: normalizeText(input.ritualId, 120) || null,
        kind: normalizeNotificationEventKind(input.kind),
        title: normalizeText(input.title, 140) || 'Bildirim',
        body: normalizeText(input.body, 320),
        deep_link: normalizeText(input.deepLink, 500) || null,
        metadata:
            input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
                ? input.metadata
                : {}
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                apikey: config.serviceRoleKey,
                Authorization: `Bearer ${config.serviceRoleKey}`,
                'content-type': 'application/json',
                Prefer: 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        const rawPayload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
            const payloadObject = toObject(rawPayload);
            const errorText = Array.isArray(rawPayload)
                ? normalizeText(JSON.stringify(rawPayload[0] || {}), 320)
                : normalizeText(
                      payloadObject?.message || payloadObject?.error || `HTTP ${response.status}`,
                      320
                  );
            return {
                ok: false,
                error: errorText || 'Notification event insert failed.'
            };
        }

        const row = Array.isArray(rawPayload) ? toObject(rawPayload[0]) : toObject(rawPayload);
        const eventId = normalizeText(row?.id, 120);
        if (!eventId) {
            return {
                ok: false,
                error: 'Notification event id missing.'
            };
        }

        return {
            ok: true,
            eventId
        };
    } catch (error) {
        return {
            ok: false,
            error: normalizeText(
                error instanceof Error ? error.message : 'Notification event request failed.',
                320
            )
        };
    }
};

export const sendExpoPushMessages = async (
    messages: ExpoPushMessageInput[]
): Promise<
    | { ok: true; ticketCount: number; errorCount: number }
    | { ok: false; error: string; ticketCount: number; errorCount: number }
> => {
    if (messages.length === 0) {
        return {
            ok: true,
            ticketCount: 0,
            errorCount: 0
        };
    }

    let ticketCount = 0;
    let errorCount = 0;

    for (const chunk of chunkArray(messages, EXPO_CHUNK_SIZE)) {
        try {
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(chunk)
            });

            const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
            const tickets = Array.isArray(payload.data) ? (payload.data as PushTicket[]) : [];
            ticketCount += tickets.length;
            errorCount += tickets.reduce((count, ticket) => {
                return normalizeText(ticket.status, 24).toLowerCase() === 'error' ? count + 1 : count;
            }, 0);

            if (!response.ok) {
                return {
                    ok: false,
                    error:
                        normalizeText(payload.error || payload.errors || `HTTP ${response.status}`, 320) ||
                        'Expo push send failed.',
                    ticketCount,
                    errorCount
                };
            }
        } catch (error) {
            return {
                ok: false,
                error: normalizeText(error instanceof Error ? error.message : 'Expo push request failed.', 320),
                ticketCount,
                errorCount
            };
        }
    }

    return {
        ok: true,
        ticketCount,
        errorCount
    };
};
