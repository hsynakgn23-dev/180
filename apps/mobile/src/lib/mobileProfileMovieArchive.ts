import type { MobileCommentReply } from './mobileCommentInteractions';
import { isSupabaseLive, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualArchiveRow = {
  id?: string | null;
  movie_title?: string | null;
  poster_path?: string | null;
  year?: number | string | null;
  genre?: string | null;
  text?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

type ReplyRow = {
  id?: string | null;
  ritual_id?: string | null;
  author?: string | null;
  text?: string | null;
  created_at?: string | null;
};

export type MobileProfileMovieArchiveEntry = {
  id: string;
  date: string;
  text: string;
  genre: string | null;
  movieTitle: string;
  posterPath: string | null;
  replies: MobileCommentReply[];
};

export type MobileProfileMovieArchiveResult =
  | {
      ok: true;
      message: string;
      entries: MobileProfileMovieArchiveEntry[];
    }
  | {
      ok: false;
      message: string;
      entries: MobileProfileMovieArchiveEntry[];
    };

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeYear = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const year = Math.floor(parsed);
  if (year < 1850 || year > 2200) return null;
  return year;
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

const toRelativeTimestamp = (value: unknown): string => {
  const parsed = Date.parse(normalizeText(value, 80));
  if (!Number.isFinite(parsed)) return 'simdi';

  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return 'simdi';

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'simdi';
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}dk once`;
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}s once`;
  return `${Math.floor(diffMs / dayMs)}g once`;
};

const toDateKey = (value: unknown): string => {
  const raw = normalizeText(value, 80);
  if (!raw) return '-';
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  const date = new Date(parsed);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mapReplyRow = (row: ReplyRow): MobileCommentReply | null => {
  const id = normalizeText(row.id, 120);
  const text = normalizeText(row.text, 180);
  if (!id || !text) return null;
  const createdAt = normalizeText(row.created_at, 80);
  return {
    id,
    author: normalizeText(row.author, 80) || 'gozlemci',
    text,
    timestampLabel: createdAt ? toRelativeTimestamp(createdAt) : 'simdi',
    createdAtMs: createdAt ? Date.parse(createdAt) : null,
  };
};

export const fetchMobileProfileMovieArchive = async (input: {
  movieTitle: string;
  year?: number | null;
}): Promise<MobileProfileMovieArchiveResult> => {
  const movieTitle = normalizeText(input.movieTitle, 180);
  if (!movieTitle) {
    return {
      ok: false,
      message: 'Film arsivi icin gecerli bir film secilmedi.',
      entries: [],
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
      entries: [],
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = normalizeText(sessionData.session?.user?.id, 120);
  if (!userId) {
    return {
      ok: false,
      message: 'Film arsivi icin once giris yap.',
      entries: [],
    };
  }

  const variants: Array<{ select: string; orderBy: 'timestamp' | 'created_at' }> = [
    { select: 'id,movie_title,poster_path,year,genre,text,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,poster_path,year,genre,text,created_at', orderBy: 'created_at' },
    { select: 'id,movie_title,poster_path,genre,text,timestamp', orderBy: 'timestamp' },
    { select: 'id,movie_title,poster_path,genre,text,created_at', orderBy: 'created_at' },
  ];

  let rows: RitualArchiveRow[] = [];
  let lastError: SupabaseErrorLike | null = null;

  for (const variant of variants) {
    const { data, error } = await supabase
      .from('rituals')
      .select(variant.select)
      .eq('user_id', userId)
      .eq('movie_title', movieTitle)
      .order(variant.orderBy, { ascending: false })
      .limit(120);

    if (error) {
      lastError = error;
      if (isSupabaseCapabilityError(error)) continue;
      return {
        ok: false,
        message: normalizeText(error.message, 220) || 'Film arsivi okunamadi.',
        entries: [],
      };
    }

    rows = Array.isArray(data) ? (data as RitualArchiveRow[]) : [];
    break;
  }

  if (rows.length === 0) {
    return {
      ok: false,
      message:
        lastError && isSupabaseCapabilityError(lastError)
          ? 'Film arsivi icin ritual verisine erisim yok.'
          : 'Bu film icin yorum kaydi bulunamadi.',
      entries: [],
    };
  }

  const targetYear = typeof input.year === 'number' ? input.year : null;
  const filteredRows =
    targetYear === null
      ? rows
      : rows.filter((row) => {
          const rowYear = toSafeYear(row.year);
          return rowYear === null || rowYear === targetYear;
        });

  const ritualIds = filteredRows
    .map((row) => normalizeText(row.id, 120))
    .filter(Boolean);

  let repliesByRitualId = new Map<string, MobileCommentReply[]>();
  if (ritualIds.length > 0) {
    const { data: repliesData, error: repliesError } = await supabase
      .from('ritual_replies')
      .select('id,ritual_id,author,text,created_at')
      .in('ritual_id', ritualIds)
      .order('created_at', { ascending: true });

    if (!repliesError && Array.isArray(repliesData)) {
      repliesByRitualId = new Map<string, MobileCommentReply[]>();
      for (const row of repliesData as ReplyRow[]) {
        const ritualId = normalizeText(row.ritual_id, 120);
        const reply = mapReplyRow(row);
        if (!ritualId || !reply) continue;
        const current = repliesByRitualId.get(ritualId) || [];
        current.push(reply);
        repliesByRitualId.set(ritualId, current);
      }
    }
  }

  const entries = filteredRows
    .map((row, index) => {
      const id = normalizeText(row.id, 120) || `${movieTitle}-${index}`;
      const text = normalizeText(row.text, 280);
      if (!text) return null;
      return {
        id,
        date: toDateKey(row.timestamp || row.created_at),
        text,
        genre: normalizeText(row.genre, 80) || null,
        movieTitle: normalizeText(row.movie_title, 180) || movieTitle,
        posterPath: normalizeText(row.poster_path, 500) || null,
        replies: repliesByRitualId.get(id) || [],
      } satisfies MobileProfileMovieArchiveEntry;
    })
    .filter((entry): entry is MobileProfileMovieArchiveEntry => Boolean(entry))
    .sort((left, right) => right.date.localeCompare(left.date));

  return {
    ok: true,
    message:
      entries.length > 0
        ? `${entries.length} yorum kaydi listelendi.`
        : 'Bu film icin yorum kaydi bulunamadi.',
    entries,
  };
};
