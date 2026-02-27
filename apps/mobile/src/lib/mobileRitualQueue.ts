import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type QueuedRitualDraft = {
  draftId: string;
  userId: string;
  author: string;
  movieTitle: string;
  text: string;
  posterPath: string | null;
  league: string;
  year: string | null;
  createdAt: string;
  syncAttempts: number;
  lastSyncError: string | null;
};

type SessionIdentity = {
  userId: string;
  author: string;
};

export type MobileRitualDraftInput = {
  movieTitle: string;
  text: string;
  posterPath?: string | null;
  league?: string | null;
  year?: string | null;
};

export type MobileRitualSubmitResult =
  | {
      ok: true;
      synced: true;
      queued: false;
      pendingCount: number;
      message: string;
    }
  | {
      ok: true;
      synced: false;
      queued: true;
      pendingCount: number;
      message: string;
    }
  | {
      ok: false;
      reason: 'invalid_input' | 'auth_required' | 'supabase_unavailable';
      pendingCount: number;
      message: string;
    };

export type MobileRitualFlushResult =
  | {
      ok: true;
      processed: number;
      synced: number;
      failed: number;
      pendingCount: number;
      message: string;
    }
  | {
      ok: false;
      processed: number;
      synced: number;
      failed: number;
      pendingCount: number;
      message: string;
    };

const RITUAL_QUEUE_KEY = '180_mobile_ritual_draft_queue_v1';
const MAX_QUEUE_ITEMS = 40;
const MAX_TEXT_LENGTH = 180;

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeNullableText = (value: unknown, maxLength: number): string | null => {
  const text = normalizeText(value, maxLength);
  return text || null;
};

const normalizeErrorMessage = (error: SupabaseErrorLike | null | undefined): string =>
  normalizeText(error?.message || error?.code || 'Unknown queue sync error', 220);

const generateDraftId = (): string => {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
  return (
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('jwt') ||
    message.includes('forbidden')
  );
};

const sanitizeQueuedDraft = (value: unknown): QueuedRitualDraft | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const draftId = normalizeText(record.draftId, 80);
  const userId = normalizeText(record.userId, 80);
  const author = normalizeText(record.author, 80) || 'Observer';
  const movieTitle = normalizeText(record.movieTitle, 180);
  const text = normalizeText(record.text, MAX_TEXT_LENGTH);
  const posterPath = normalizeNullableText(record.posterPath, 500);
  const league = normalizeText(record.league, 32) || 'Bronze';
  const year = normalizeNullableText(record.year, 12);
  const createdAt = normalizeText(record.createdAt, 80);
  const parsedAttempts = Number(record.syncAttempts);
  const syncAttempts = Number.isFinite(parsedAttempts)
    ? Math.max(0, Math.min(50, Math.floor(parsedAttempts)))
    : 0;
  const lastSyncError = normalizeNullableText(record.lastSyncError, 220);

  if (!draftId || !userId || !movieTitle || !text || !createdAt) return null;

  return {
    draftId,
    userId,
    author,
    movieTitle,
    text,
    posterPath,
    league,
    year,
    createdAt,
    syncAttempts,
    lastSyncError,
  };
};

const readQueue = async (): Promise<QueuedRitualDraft[]> => {
  try {
    const raw = await AsyncStorage.getItem(RITUAL_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeQueuedDraft(item))
      .filter((item): item is QueuedRitualDraft => Boolean(item))
      .slice(-MAX_QUEUE_ITEMS);
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedRitualDraft[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(RITUAL_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)));
  } catch {
    // best-effort persistence
  }
};

const getSessionIdentity = async (): Promise<SessionIdentity | null> => {
  if (!isSupabaseLive() || !supabase) return null;
  try {
    const sessionResult = await readSupabaseSessionSafe();
    const userId = normalizeText(sessionResult.session?.user?.id, 80);
    if (!userId) return null;
    const emailPrefix = normalizeText(String(sessionResult.session?.user?.email || '').split('@')[0], 80);
    return {
      userId,
      author: emailPrefix || 'Observer',
    };
  } catch {
    return null;
  }
};

const buildPayloadVariants = (draft: QueuedRitualDraft): Array<Record<string, string | null>> => {
  const base = {
    user_id: draft.userId,
    author: draft.author,
    movie_title: draft.movieTitle,
    text: draft.text,
  };
  const withPoster = {
    ...base,
    poster_path: draft.posterPath,
  };
  const withYear = {
    ...withPoster,
    year: draft.year,
  };
  const league = draft.league || 'Bronze';
  const createdAt = draft.createdAt;

  return [
    { ...withYear, timestamp: createdAt, league },
    { ...withPoster, timestamp: createdAt, league },
    { ...base, timestamp: createdAt, league },
    { ...base, timestamp: createdAt },
    { ...withYear, created_at: createdAt, league },
    { ...withPoster, created_at: createdAt, league },
    { ...base, created_at: createdAt, league },
    { ...base, created_at: createdAt },
    { ...withYear, league },
    { ...withPoster, league },
    { ...base, league },
    { ...base },
  ];
};

const insertDraftToCloud = async (
  draft: QueuedRitualDraft
): Promise<{ ok: boolean; error?: SupabaseErrorLike }> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      error: {
        code: 'SUPABASE_OFFLINE',
        message: 'Supabase client is not available.',
      },
    };
  }

  let lastError: SupabaseErrorLike | undefined;
  for (const payload of buildPayloadVariants(draft)) {
    const { error } = await supabase.from('rituals').insert([payload]);
    if (!error) {
      return { ok: true };
    }

    lastError = {
      code: error.code,
      message: error.message,
    };

    if (!isSupabaseCapabilityError(lastError)) {
      break;
    }
  }

  return {
    ok: false,
    error: lastError || { code: 'UNKNOWN', message: 'Ritual insert failed.' },
  };
};

const countForUser = (queue: QueuedRitualDraft[], userId: string | null): number => {
  if (!userId) return 0;
  return queue.filter((draft) => draft.userId === userId).length;
};

export const getQueuedRitualDraftCounts = async (): Promise<{
  totalCount: number;
  currentUserCount: number;
}> => {
  const [queue, identity] = await Promise.all([readQueue(), getSessionIdentity()]);
  return {
    totalCount: queue.length,
    currentUserCount: countForUser(queue, identity?.userId || null),
  };
};

export const submitRitualDraftWithQueue = async (
  input: MobileRitualDraftInput
): Promise<MobileRitualSubmitResult> => {
  const movieTitle = normalizeText(input.movieTitle, 180);
  const rawText = String(input.text || '').trim();
  if (!movieTitle || !rawText) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: false,
      reason: 'invalid_input',
      pendingCount: counts.currentUserCount,
      message: 'Film basligi ve yorum zorunlu.',
    };
  }
  if (rawText.length > MAX_TEXT_LENGTH) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: false,
      reason: 'invalid_input',
      pendingCount: counts.currentUserCount,
      message: `Yorum en fazla ${MAX_TEXT_LENGTH} karakter olabilir.`,
    };
  }
  if (!isSupabaseLive() || !supabase) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: false,
      reason: 'supabase_unavailable',
      pendingCount: counts.currentUserCount,
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const identity = await getSessionIdentity();
  if (!identity) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: false,
      reason: 'auth_required',
      pendingCount: counts.currentUserCount,
      message: 'Ritual gondermek icin once mobil oturum ac.',
    };
  }

  const draft: QueuedRitualDraft = {
    draftId: generateDraftId(),
    userId: identity.userId,
    author: identity.author,
    movieTitle,
    text: rawText,
    posterPath: normalizeNullableText(input.posterPath, 500),
    league: normalizeText(input.league, 32) || 'Bronze',
    year: normalizeNullableText(input.year, 12),
    createdAt: new Date().toISOString(),
    syncAttempts: 0,
    lastSyncError: null,
  };

  const liveInsert = await insertDraftToCloud(draft);
  if (liveInsert.ok) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: true,
      synced: true,
      queued: false,
      pendingCount: counts.currentUserCount,
      message: 'Ritual clouda kaydedildi.',
    };
  }

  const queue = await readQueue();
  const nextQueue = [
    ...queue,
    {
      ...draft,
      syncAttempts: 1,
      lastSyncError: normalizeErrorMessage(liveInsert.error),
    },
  ].slice(-MAX_QUEUE_ITEMS);
  await writeQueue(nextQueue);

  return {
    ok: true,
    synced: false,
    queued: true,
    pendingCount: countForUser(nextQueue, identity.userId),
    message: 'Ritual taslagi kuyruga alindi. Baglanti geldikten sonra tekrar denenebilir.',
  };
};

export const flushQueuedRitualDrafts = async (maxToProcess = 12): Promise<MobileRitualFlushResult> => {
  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      processed: 0,
      synced: 0,
      failed: 0,
      pendingCount: 0,
      message: 'Supabase baglantisi hazir degil.',
    };
  }

  const identity = await getSessionIdentity();
  if (!identity) {
    const counts = await getQueuedRitualDraftCounts();
    return {
      ok: false,
      processed: 0,
      synced: 0,
      failed: 0,
      pendingCount: counts.currentUserCount,
      message: 'Kuyrugu gondermek icin once mobil oturum ac.',
    };
  }

  const queue = await readQueue();
  if (queue.length === 0) {
    return {
      ok: true,
      processed: 0,
      synced: 0,
      failed: 0,
      pendingCount: 0,
      message: 'Bekleyen ritual taslagi yok.',
    };
  }

  const limit = Math.max(1, Math.min(40, Math.floor(maxToProcess)));
  const nextQueue: QueuedRitualDraft[] = [];
  let processed = 0;
  let synced = 0;
  let failed = 0;

  for (const draft of queue) {
    if (draft.userId !== identity.userId) {
      nextQueue.push(draft);
      continue;
    }

    if (processed >= limit) {
      nextQueue.push(draft);
      continue;
    }

    processed += 1;
    const result = await insertDraftToCloud(draft);
    if (result.ok) {
      synced += 1;
      continue;
    }

    failed += 1;
    nextQueue.push({
      ...draft,
      syncAttempts: Math.min(50, draft.syncAttempts + 1),
      lastSyncError: normalizeErrorMessage(result.error),
    });
  }

  await writeQueue(nextQueue);
  const pendingCount = countForUser(nextQueue, identity.userId);
  if (failed > 0) {
    return {
      ok: false,
      processed,
      synced,
      failed,
      pendingCount,
      message: 'Bazi ritual taslaklari clouda gonderilemedi.',
    };
  }

  return {
    ok: true,
    processed,
    synced,
    failed,
    pendingCount,
    message: synced > 0 ? `${synced} ritual taslagi clouda gonderildi.` : 'Bekleyen taslak yok.',
  };
};
