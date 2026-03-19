import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveSupabaseUserEmail } from './supabaseUser';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  xp_state?: unknown;
};

type ReplyRow = {
  id?: string | null;
  user_id?: string | null;
  author?: string | null;
  text?: string | null;
  created_at?: string | null;
};

type ReplyEchoRow = {
  reply_id?: string | null;
};

export type MobileCommentReply = {
  id: string;
  userId: string | null;
  author: string;
  text: string;
  timestampLabel: string;
  createdAtMs: number | null;
  echoCount: number;
  isEchoedByMe: boolean;
};

export type MobileCommentRepliesResult =
  | { ok: true; replies: MobileCommentReply[]; message: string }
  | { ok: false; replies: MobileCommentReply[]; message: string };

export type MobileCommentReplySubmitResult =
  | { ok: true; reply: MobileCommentReply; message: string }
  | { ok: false; message: string };

export type MobileCommentEchoResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'auth_required' | 'supabase_unavailable' | 'unknown'; message: string };

export type MobileCommentDeleteResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'auth_required' | 'supabase_unavailable' | 'unknown'; message: string };

const MAX_REPLY_CHARS = 180;

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = normalizeText(error.code, 40).toUpperCase();
  const message = normalizeText(error.message, 220).toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') return true;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('forbidden')
  );
};

const parseTimestampToMs = (value: unknown): number | null => {
  const parsed = Date.parse(normalizeText(value, 80));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toRelativeTimestamp = (value: unknown): string => {
  const parsedMs = parseTimestampToMs(value);
  if (parsedMs === null) return 'simdi';

  const diffMs = Date.now() - parsedMs;
  if (diffMs < 0) return 'simdi';

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'simdi';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}dk once`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}s once`;
  return `${Math.floor(diffMs / dayMs)}g once`;
};

const mapReplyRow = (row: ReplyRow, fallbackText = '', fallbackAuthor = 'Sen'): MobileCommentReply => ({
  id: normalizeText(row.id, 120) || `reply-${Date.now().toString(36)}`,
  userId: normalizeText(row.user_id, 120) || null,
  author: normalizeText(row.author, 80) || fallbackAuthor,
  text: normalizeText(row.text, MAX_REPLY_CHARS) || fallbackText,
  timestampLabel: row.created_at ? toRelativeTimestamp(row.created_at) : 'simdi',
  createdAtMs: parseTimestampToMs(row.created_at),
  echoCount: 0,
  isEchoedByMe: false,
});

const readSessionIdentity = async (): Promise<
  | { ok: true; userId: string; userEmail: string }
  | { ok: false; message: string; reason: 'auth_required' | 'supabase_unavailable' }
> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      reason: 'supabase_unavailable',
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 120);
  const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
  if (!userId) {
    return {
      ok: false,
      reason: 'auth_required',
      message: 'Bu aksiyon icin once mobilde giris yap.',
    };
  }

  return {
    ok: true,
    userId,
    userEmail,
  };
};

const resolveAuthorName = async (userId: string, fallbackEmail: string, fallbackAuthor: string): Promise<string> => {
  if (!supabase) return fallbackAuthor || fallbackEmail.split('@')[0] || 'Sen';

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name,xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && !isSupabaseCapabilityError(error)) {
    return fallbackAuthor || fallbackEmail.split('@')[0] || 'Sen';
  }

  const row = (data || null) as ProfileRow | null;
  const xpState =
    row?.xp_state && typeof row.xp_state === 'object' && !Array.isArray(row.xp_state)
      ? (row.xp_state as Record<string, unknown>)
      : null;
  return (
    normalizeText(row?.display_name, 120) ||
    normalizeText(xpState?.fullName, 120) ||
    normalizeText(xpState?.username, 80) ||
    normalizeText(fallbackAuthor, 120) ||
    normalizeText(fallbackEmail.split('@')[0], 120) ||
    'Sen'
  );
};

export const echoMobileCommentRitual = async (ritualId: string): Promise<MobileCommentEchoResult> => {
  const normalizedRitualId = normalizeText(ritualId, 120);
  if (!normalizedRitualId) {
    return { ok: false, reason: 'unknown', message: 'Yorum aksiyonu icin ritual kaydi bulunamadi.' };
  }

  const identity = await readSessionIdentity();
  if (!identity.ok) {
    return {
      ok: false,
      reason: identity.reason,
      message: identity.message,
    };
  }

  const { error } = await supabase!.from('ritual_echoes').upsert(
    [{ ritual_id: normalizedRitualId, user_id: identity.userId }],
    {
      onConflict: 'ritual_id,user_id',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    return {
      ok: false,
      reason: 'unknown',
      message: normalizeText(error.message, 220) || 'Echo senkronize edilemedi.',
    };
  }

  return {
    ok: true,
    message: 'Echo kaydedildi.',
  };
};

export const fetchMobileCommentReplies = async (
  ritualId: string
): Promise<MobileCommentRepliesResult> => {
  const normalizedRitualId = normalizeText(ritualId, 120);
  if (!normalizedRitualId) {
    return {
      ok: false,
      replies: [],
      message: 'Yanitlari acmak icin ritual kaydi bulunamadi.',
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      replies: [],
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const { data, error } = await supabase
    .from('ritual_replies')
    .select('id,user_id,author,text,created_at')
    .eq('ritual_id', normalizedRitualId)
    .order('created_at', { ascending: true })
    .limit(40);

  if (error) {
    return {
      ok: false,
      replies: [],
      message: normalizeText(error.message, 220) || 'Yanitlar okunamadi.',
    };
  }

  const replies = Array.isArray(data)
    ? (data as ReplyRow[]).map((row) => mapReplyRow(row)).filter((row) => Boolean(row.text))
    : [];

  if (replies.length === 0) {
    return { ok: true, replies, message: 'Bu yorum icin henuz yanit yok.' };
  }

  // Hydrate echo counts and current-user echo state
  const replyIds = replies.map((r) => r.id);
  const sessionResult = await readSupabaseSessionSafe();
  const currentUserId = normalizeText(sessionResult.session?.user?.id, 120);

  const [allEchoesResult, userEchoesResult] = await Promise.all([
    supabase.from('ritual_reply_echoes').select('reply_id').in('reply_id', replyIds),
    currentUserId
      ? supabase
          .from('ritual_reply_echoes')
          .select('reply_id')
          .eq('user_id', currentUserId)
          .in('reply_id', replyIds)
      : Promise.resolve({ data: [] as ReplyEchoRow[], error: null }),
  ]);

  const echoCountMap = new Map<string, number>();
  if (Array.isArray(allEchoesResult.data)) {
    for (const row of allEchoesResult.data as ReplyEchoRow[]) {
      const id = normalizeText(row.reply_id, 120);
      if (id) echoCountMap.set(id, (echoCountMap.get(id) ?? 0) + 1);
    }
  }
  const userEchoedSet = new Set<string>();
  const userEchoData = 'data' in userEchoesResult ? userEchoesResult.data : [];
  if (Array.isArray(userEchoData)) {
    for (const row of userEchoData as ReplyEchoRow[]) {
      const id = normalizeText(row.reply_id, 120);
      if (id) userEchoedSet.add(id);
    }
  }

  const hydratedReplies = replies.map((reply) => ({
    ...reply,
    echoCount: echoCountMap.get(reply.id) ?? 0,
    isEchoedByMe: userEchoedSet.has(reply.id),
  }));

  return {
    ok: true,
    replies: hydratedReplies,
    message: 'Yanitlar guncellendi.',
  };
};

export const deleteMobileCommentRitual = async (
  ritualId: string
): Promise<MobileCommentDeleteResult> => {
  const normalizedRitualId = normalizeText(ritualId, 120);
  if (!normalizedRitualId) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Silinecek yorum kaydi bulunamadi.',
    };
  }

  const identity = await readSessionIdentity();
  if (!identity.ok) {
    return {
      ok: false,
      reason: identity.reason,
      message: identity.message,
    };
  }

  const { error } = await supabase!
    .from('rituals')
    .delete()
    .eq('id', normalizedRitualId)
    .eq('user_id', identity.userId);

  if (error) {
    return {
      ok: false,
      reason: 'unknown',
      message: normalizeText(error.message, 220) || 'Yorum silinemedi.',
    };
  }

  return {
    ok: true,
    message: 'Yorum silindi.',
  };
};

export const echoMobileCommentReply = async (replyId: string): Promise<MobileCommentEchoResult> => {
  const normalizedReplyId = normalizeText(replyId, 120);
  if (!normalizedReplyId) {
    return { ok: false, reason: 'unknown', message: 'Yanit aksiyon icin kayit bulunamadi.' };
  }

  const identity = await readSessionIdentity();
  if (!identity.ok) {
    return { ok: false, reason: identity.reason, message: identity.message };
  }

  const { error } = await supabase!.from('ritual_reply_echoes').upsert(
    [{ reply_id: normalizedReplyId, user_id: identity.userId }],
    { onConflict: 'reply_id,user_id', ignoreDuplicates: true }
  );

  if (error) {
    return {
      ok: false,
      reason: 'unknown',
      message: normalizeText(error.message, 220) || 'Echo senkronize edilemedi.',
    };
  }

  return { ok: true, message: 'Echo kaydedildi.' };
};

export const submitMobileCommentReply = async (input: {
  ritualId: string;
  text: string;
  fallbackAuthor?: string;
}): Promise<MobileCommentReplySubmitResult> => {
  const normalizedRitualId = normalizeText(input.ritualId, 120);
  const text = normalizeText(input.text, MAX_REPLY_CHARS);
  if (!normalizedRitualId) {
    return { ok: false, message: 'Yanit icin ritual kaydi bulunamadi.' };
  }
  if (!text) {
    return { ok: false, message: 'Yanit bos olamaz.' };
  }

  const identity = await readSessionIdentity();
  if (!identity.ok) {
    return { ok: false, message: identity.message };
  }

  const author = await resolveAuthorName(identity.userId, identity.userEmail, input.fallbackAuthor || '');

  const { data, error } = await supabase!
    .from('ritual_replies')
    .insert([
      {
        ritual_id: normalizedRitualId,
        user_id: identity.userId,
        author,
        text,
      },
    ])
    .select('id,author,text,created_at')
    .single();

  if (error) {
    return {
      ok: false,
      message: normalizeText(error.message, 220) || 'Yanit senkronize edilemedi.',
    };
  }

  const reply = mapReplyRow((data || null) as ReplyRow, text, author);
  return {
    ok: true,
    reply,
    message: 'Yanit gonderildi.',
  };
};
