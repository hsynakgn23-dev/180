import { createCorsHeaders } from './lib/cors.js';
import { consumeWalletInventoryItem } from './lib/progressionWallet.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = { runtime: 'nodejs' };

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | undefined> | Headers;
  on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiResponse = {
  setHeader?: (key: string, value: string) => void;
  status?: (statusCode: number) => { json: (payload: Record<string, unknown>) => unknown };
};

type JokerSource = 'wallet' | 'bonus';
type RushJokerType = 'fifty_fifty' | 'freeze' | 'pass';

const sendJson = (
  res: ApiResponse,
  status: number,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
) => {
  if (res && typeof res.setHeader === 'function') {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  }
  if (res && typeof res.status === 'function') return res.status(status).json(payload);
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
};

const getHeader = (req: ApiRequest, key: string): string => {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') return ((headers as Headers).get(key) || '').trim();
  const obj = headers as Record<string, string | undefined>;
  return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
  const authHeader = getHeader(req, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
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
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[nextIndex]] = [result[nextIndex], result[index]];
  }
  return result;
};

const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const isValidSource = (value: string): value is JokerSource => value === 'wallet' || value === 'bonus';
const isValidJokerType = (value: string): value is RushJokerType =>
  value === 'fifty_fifty' || value === 'freeze' || value === 'pass';

const resolveInventoryItemKey = (type: RushJokerType): string =>
  type === 'fifty_fifty' ? 'joker_fifty_fifty' : type === 'freeze' ? 'joker_freeze' : 'joker_pass';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const cors = createCorsHeaders(req, {
    headers: 'authorization, content-type, apikey, x-client-info',
    methods: 'POST, OPTIONS',
  });

  if (req.method === 'OPTIONS') return sendJson(res, 204, {}, cors);
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, cors);

  const accessToken = getBearerToken(req);
  if (!accessToken) return sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, cors);

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return sendJson(res, 500, { ok: false, error: 'Server config error.' }, cors);
  }

  const supabase = createSupabaseServiceClient(supabaseUrl, supabaseServiceKey);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return sendJson(res, 401, { ok: false, error: 'Invalid token.' }, cors);

  const body = await parseBody(req);
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

  const sessionId = String(payload.session_id || payload.sessionId || '').trim();
  const questionId = String(payload.question_id || payload.attempt_id || payload.questionId || '').trim();
  const type = String(payload.type || '').trim();
  const rawSource = String(payload.source || '').trim().toLowerCase();
  const source = (rawSource || 'wallet') as JokerSource;
  const requestedSeconds = Number(payload.seconds);
  const seconds = Number.isFinite(requestedSeconds) && requestedSeconds > 0
    ? Math.min(Math.max(Math.round(requestedSeconds), 1), 15)
    : 7;

  if (!sessionId || !isValidJokerType(type)) {
    return sendJson(res, 400, { ok: false, error: 'Missing session_id or invalid joker type.' }, cors);
  }

  if (!isValidSource(source)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid joker source.' }, cors);
  }

  const { data: session, error: sessionError } = await supabase
    .from('quiz_rush_sessions')
    .select('id, user_id, status, expires_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return sendJson(res, 404, { ok: false, error: 'Session not found.' }, cors);
  }

  if (session.status !== 'in_progress') {
    return sendJson(res, 409, { ok: false, error: 'Session is no longer active.' }, cors);
  }

  if (type === 'freeze') {
    if (!session.expires_at) {
      return sendJson(res, 400, { ok: false, error: 'Freeze is not available for this mode.' }, cors);
    }

    if (source === 'wallet') {
      const consumeResult = await consumeWalletInventoryItem({
        supabase,
        supabaseUrl,
        supabaseServiceRoleKey: supabaseServiceKey,
        userId: user.id,
        fallbackEmail: user.email || null,
        fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
        itemKey: resolveInventoryItemKey(type),
      });

      if (!consumeResult.ok) {
        return sendJson(res, consumeResult.reason === 'inventory_empty' ? 409 : 400, {
          ok: false,
          error:
            consumeResult.reason === 'inventory_empty'
              ? 'Joker inventory is empty.'
              : 'Invalid wallet item.',
          reason: consumeResult.reason,
        }, cors);
      }
    }

    const nextExpiresAt = new Date(new Date(session.expires_at).getTime() + seconds * 1000).toISOString();
    const { error: updateError } = await supabase
      .from('quiz_rush_sessions')
      .update({ expires_at: nextExpiresAt })
      .eq('id', sessionId);

    if (updateError) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update session timer.' }, cors);
    }

    return sendJson(res, 200, {
      ok: true,
      type: 'freeze',
      source,
      session_id: sessionId,
      expires_at: nextExpiresAt,
      seconds,
    }, cors);
  }

  if (!questionId) {
    return sendJson(res, 400, { ok: false, error: 'Missing question_id.' }, cors);
  }

  const { data: existingAttempt } = await supabase
    .from('quiz_rush_attempts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
    .single();

  if (existingAttempt) {
    return sendJson(res, 409, { ok: false, error: 'Question already answered.' }, cors);
  }

  if (type === 'pass') {
    const { data: question, error: questionError } = await supabase
      .from('question_pool_questions')
      .select('id')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return sendJson(res, 404, { ok: false, error: 'Question not found.' }, cors);
    }

    if (source === 'wallet') {
      const consumeResult = await consumeWalletInventoryItem({
        supabase,
        supabaseUrl,
        supabaseServiceRoleKey: supabaseServiceKey,
        userId: user.id,
        fallbackEmail: user.email || null,
        fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
        itemKey: resolveInventoryItemKey(type),
      });

      if (!consumeResult.ok) {
        return sendJson(res, consumeResult.reason === 'inventory_empty' ? 409 : 400, {
          ok: false,
          error:
            consumeResult.reason === 'inventory_empty'
              ? 'Joker inventory is empty.'
              : 'Invalid wallet item.',
          reason: consumeResult.reason,
        }, cors);
      }
    }

    return sendJson(res, 200, {
      ok: true,
      type: 'pass',
      source,
      session_id: sessionId,
      question_id: questionId,
    }, cors);
  }

  const { data: question, error: questionError } = await supabase
    .from('question_pool_questions')
    .select('id, correct_option')
    .eq('id', questionId)
    .single();

  if (questionError || !question) {
    return sendJson(res, 404, { ok: false, error: 'Question not found.' }, cors);
  }

  if (source === 'wallet') {
    const consumeResult = await consumeWalletInventoryItem({
      supabase,
      supabaseUrl,
      supabaseServiceRoleKey: supabaseServiceKey,
      userId: user.id,
      fallbackEmail: user.email || null,
      fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
      itemKey: resolveInventoryItemKey(type),
    });

    if (!consumeResult.ok) {
      return sendJson(res, consumeResult.reason === 'inventory_empty' ? 409 : 400, {
        ok: false,
        error:
          consumeResult.reason === 'inventory_empty'
            ? 'Joker inventory is empty.'
            : 'Invalid wallet item.',
        reason: consumeResult.reason,
      }, cors);
    }
  }

  const removedOptions = shuffle(['a', 'b', 'c', 'd'].filter((key) => key !== question.correct_option)).slice(0, 2);

  return sendJson(res, 200, {
    ok: true,
    type: 'fifty_fifty',
    source,
    session_id: sessionId,
    question_id: questionId,
    removed_options: removedOptions,
  }, cors);
}
