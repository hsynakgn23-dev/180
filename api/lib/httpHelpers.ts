import { createSupabaseServiceClient } from './supabaseServiceClient.js';

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  headers?: Record<string, string | undefined> | Headers;
  on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiJsonResponder = {
  json: (payload: Record<string, unknown>) => unknown;
};

export type ApiResponse = {
  setHeader?: (key: string, value: string) => void;
  status?: (statusCode: number) => ApiJsonResponder;
};

export const sendJson = (
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
      ...headers,
    },
  });
};

export const getHeader = (req: ApiRequest, key: string): string => {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') {
    return ((headers as Headers).get(key) || '').trim();
  }
  const obj = headers as Record<string, string | undefined>;
  return (obj[key.toLowerCase()] || obj[key] || '').trim();
};

export const getBearerToken = (req: ApiRequest): string | null => {
  const authHeader = getHeader(req, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
};

export const parseBody = async (req: ApiRequest): Promise<unknown> => {
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

export const toObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const getQueryParam = (req: ApiRequest, key: string): string | null => {
  const rawQueryValue = req.query?.[key];
  if (typeof rawQueryValue === 'string') return rawQueryValue;
  if (Array.isArray(rawQueryValue) && typeof rawQueryValue[0] === 'string') return rawQueryValue[0];

  const rawUrl = typeof req.url === 'string' ? req.url : '';
  if (!rawUrl) return null;

  try {
    const host = getHeader(req, 'host') || 'localhost';
    const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : `https://${host}`);
    return url.searchParams.get(key);
  } catch {
    return null;
  }
};

export const getSupabaseUrl = (): string =>
  String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();

export const getSupabaseServiceRoleKey = (): string =>
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const createSupabaseClient = (): {
  supabaseUrl: string;
  supabaseServiceKey: string;
  supabase: SupabaseServiceClient;
} | null => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return {
    supabaseUrl,
    supabaseServiceKey,
    supabase: createSupabaseServiceClient(supabaseUrl, supabaseServiceKey),
  };
};

export const requireAuth = async (
  req: ApiRequest,
  res: ApiResponse,
  headers: Record<string, string> = {}
) => {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return {
      ok: false as const,
      response: sendJson(res, 401, { ok: false, error: 'Missing authorization.' }, headers),
    };
  }

  const client = createSupabaseClient();
  if (!client) {
    return {
      ok: false as const,
      response: sendJson(res, 500, { ok: false, error: 'Server config error.' }, headers),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await client.supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return {
      ok: false as const,
      response: sendJson(res, 401, { ok: false, error: 'Invalid token.' }, headers),
    };
  }

  return {
    ok: true as const,
    accessToken,
    user,
    ...client,
  };
};
