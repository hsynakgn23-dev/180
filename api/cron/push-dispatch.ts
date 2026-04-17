// POST /api/cron/push-dispatch
//
// Reads pending notification_events rows (push_sent_at IS NULL, created
// within the last MAX_EVENT_AGE_HOURS hours) and dispatches Expo push
// notifications to each recipient's registered devices.
//
// Behaviour:
// - Fetches up to MAX_EVENTS_PER_RUN rows ordered by created_at asc
//   (oldest first, so nothing ages out forever).
// - Bulk-reads push tokens for all affected recipient users in one query.
// - Builds one Expo message per token per event.
// - Sends all messages via sendExpoPushMessages (auto-chunked to 100).
// - Sets push_sent_at = now() on every processed row, regardless of
//   per-token delivery errors (prevents user spam on retry).
// - Idempotent: push_sent_at guard prevents double-dispatch.
//
// Auth: Authorization: Bearer $CRON_SECRET
//
// Suggested schedule: every 5 minutes.

 

import { createSupabaseServiceClient } from '../lib/supabaseServiceClient.js';
import { sendExpoPushMessages } from '../lib/push.js';

export const config = { runtime: 'nodejs' };

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS_PER_RUN = 200;
const MAX_EVENT_AGE_HOURS = 48;
const EXPO_PUSH_TOKEN_REGEX = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const MAX_TOKENS_PER_USER = 25;

// ── Types ────────────────────────────────────────────────────────────────────

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | undefined> | Headers;
};

type ApiResponse = {
  status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

type PendingEvent = {
  id: string;
  recipient_user_id: string;
  kind: string;
  title: string;
  body: string;
  deep_link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileTokenRow = {
  user_id: string;
  mobile_push_state: Record<string, unknown> | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const sendJson = (res: ApiResponse, status: number, payload: Record<string, unknown>) => {
  if (res && typeof res.status === 'function') return res.status(status).json(payload);
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

const getHeader = (req: ApiRequest, key: string): string => {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') return ((headers as Headers).get(key) || '').trim();
  const obj = headers as Record<string, string | undefined>;
  return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getCronSecret = (): string | null =>
  process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || null;

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/** Extract valid Expo push tokens from a profiles.mobile_push_state object. */
const extractTokens = (mobilePushState: Record<string, unknown> | null): string[] => {
  if (!mobilePushState || typeof mobilePushState !== 'object') return [];
  const devices = mobilePushState.devices;
  if (!devices || typeof devices !== 'object' || Array.isArray(devices)) return [];
  const tokens = Object.values(devices as Record<string, unknown>)
    .map((d) => {
      if (!d || typeof d !== 'object') return '';
      return String((d as Record<string, unknown>).expoPushToken || '').trim();
    })
    .filter((t) => EXPO_PUSH_TOKEN_REGEX.test(t));
  return Array.from(new Set(tokens)).slice(0, MAX_TOKENS_PER_USER);
};

/** Build a deep-link data object for the Expo message payload. */
const buildMessageData = (event: PendingEvent): Record<string, unknown> => ({
  notificationEventId: event.id,
  kind: event.kind,
  deepLink: event.deep_link || null,
  ...event.metadata,
});

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  // Auth — CRON_SECRET must always be set; missing env = server misconfiguration
  const secret = getCronSecret();
  if (!secret) {
    return sendJson(res, 500, { ok: false, error: 'CRON_SECRET not configured.' });
  }
  const auth = getHeader(req, 'authorization');
  if (auth !== `Bearer ${secret}`) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' });
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
  const nowIso = new Date().toISOString();

  // 1. Fetch pending events (oldest first, capped at MAX_EVENTS_PER_RUN)
  const ageThreshold = new Date(
    Date.now() - MAX_EVENT_AGE_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: eventsRaw, error: fetchError } = await supabase
    .from('notification_events')
    .select('id, recipient_user_id, kind, title, body, deep_link, metadata, created_at')
    .is('push_sent_at', null)
    .gte('created_at', ageThreshold)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS_PER_RUN);

  if (fetchError) {
    console.error('[push-dispatch] fetch events failed', fetchError);
    return sendJson(res, 500, { ok: false, error: 'Failed to read pending events.' });
  }

  const events: PendingEvent[] = Array.isArray(eventsRaw) ? (eventsRaw as PendingEvent[]) : [];

  if (events.length === 0) {
    return sendJson(res, 200, {
      ok: true,
      message: 'No pending events.',
      processedEvents: 0,
      recipientsWithTokens: 0,
      tokenCount: 0,
      ticketCount: 0,
      errorCount: 0,
      markError: null,
    });
  }

  // 2. Bulk-fetch push tokens for all affected recipients
  const recipientIds = Array.from(new Set(events.map((e) => e.recipient_user_id)));

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('user_id, mobile_push_state')
    .in('user_id', recipientIds);

  const tokensByUserId = new Map<string, string[]>();
  const profiles: ProfileTokenRow[] = Array.isArray(profilesRaw)
    ? (profilesRaw as ProfileTokenRow[])
    : [];
  for (const row of profiles) {
    const tokens = extractTokens(row.mobile_push_state);
    if (tokens.length > 0) {
      tokensByUserId.set(row.user_id, tokens);
    }
  }

  // 3. Build Expo messages
  type ExpoMessage = { to: string; title: string; body: string; sound: 'default'; data: Record<string, unknown> };
  const messages: ExpoMessage[] = [];
  for (const event of events) {
    const tokens = tokensByUserId.get(event.recipient_user_id) || [];
    for (const token of tokens) {
      messages.push({
        to: token,
        title: event.title,
        body: event.body,
        sound: 'default',
        data: buildMessageData(event),
      });
    }
  }

  // 4. Send (chunked internally by sendExpoPushMessages)
  let ticketCount = 0;
  let errorCount = 0;
  if (messages.length > 0) {
    const pushResult = await sendExpoPushMessages(messages);
    ticketCount = pushResult.ticketCount;
    errorCount = pushResult.errorCount;
    if (!pushResult.ok) {
      console.error('[push-dispatch] Expo send error', pushResult.error);
      // Continue — still mark events as sent to prevent retry spam.
    }
  }

  // 5. Mark all processed events as sent (bulk update by id list)
  const eventIds = events.map((e) => e.id);
  const { error: updateError } = await supabase
    .from('notification_events')
    .update({ push_sent_at: nowIso })
    .in('id', eventIds);

  if (updateError) {
    // Non-fatal: events will be retried next run but that is safer than crashing.
    console.error('[push-dispatch] push_sent_at update failed', updateError);
  }

  return sendJson(res, 200, {
    ok: true,
    processedEvents: events.length,
    recipientsWithTokens: tokensByUserId.size,
    tokenCount: messages.length,
    ticketCount,
    errorCount,
    markError: updateError ? updateError.message : null,
  });
}
