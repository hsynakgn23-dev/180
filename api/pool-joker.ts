import { createCorsHeaders } from './lib/cors.js';
import { getBearerToken, parseBody, sendJson } from './lib/httpHelpers.js';
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

  const questionId = String(payload.question_id || payload.questionId || '').trim();
  const type = String(payload.type || '').trim();
  const rawSource = String(payload.source || '').trim().toLowerCase();
  const source = (rawSource || 'wallet') as JokerSource;

  if (!questionId || type !== 'fifty_fifty') {
    return sendJson(res, 400, { ok: false, error: 'Missing question_id or invalid joker type.' }, cors);
  }

  if (!isValidSource(source)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid joker source.' }, cors);
  }

  const { data: question, error: questionError } = await supabase
    .from('question_pool_questions')
    .select('id, movie_id, correct_option')
    .eq('id', questionId)
    .single();

  if (questionError || !question) {
    return sendJson(res, 404, { ok: false, error: 'Question not found.' }, cors);
  }

  const { data: movie } = await supabase
    .from('question_pool_movies')
    .select('id')
    .eq('id', question.movie_id)
    .single();

  if (!movie) {
    return sendJson(res, 404, { ok: false, error: 'Movie not found.' }, cors);
  }

  if (source === 'wallet') {
    const consumeResult = await consumeWalletInventoryItem({
      supabase,
      supabaseUrl,
      supabaseServiceRoleKey: supabaseServiceKey,
      userId: user.id,
      fallbackEmail: user.email || null,
      fallbackDisplayName: user.email ? String(user.email).split('@')[0] : null,
      itemKey: 'joker_fifty_fifty',
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

  const wrongOptions = shuffle(['a', 'b', 'c', 'd'].filter((key) => key !== question.correct_option)).slice(0, 2);

  return sendJson(res, 200, {
    ok: true,
    user_id: user.id,
    question_id: questionId,
    removed_options: wrongOptions,
    source,
  }, cors);
}
