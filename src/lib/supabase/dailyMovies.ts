import { isSupabaseLive, supabase } from '../supabase.js';

export type DailyShowcaseRow = {
    date?: string | null;
    movies?: unknown[] | null;
};

export type SupabaseQueryError = {
    code?: string | null;
    message?: string | null;
};

export type LoadDailyShowcaseResult = {
    data: DailyShowcaseRow | null;
    error: SupabaseQueryError | null;
};

export type LoadRecentDailyShowcasesResult = {
    data: DailyShowcaseRow[];
    error: SupabaseQueryError | null;
};

export type MutateDailyShowcaseResult = {
    ok: boolean;
    error: SupabaseQueryError | null;
};

export type MutateDailyShowcaseInput = {
    date: string;
    movies: unknown[];
    ignoreDuplicates?: boolean;
};

export const loadDailyShowcase = async (
    dateKey: string,
): Promise<LoadDailyShowcaseResult> => {
    if (!dateKey || !isSupabaseLive() || !supabase) {
        return { data: null, error: null };
    }

    const { data, error } = await supabase
        .from('daily_showcase')
        .select('*')
        .eq('date', dateKey)
        .maybeSingle();

    return {
        data: data ? (data as DailyShowcaseRow) : null,
        error,
    };
};

export const loadRecentDailyShowcases = async (
    fromDateKey: string,
    toDateKeyExclusive: string,
    limit = 120,
): Promise<LoadRecentDailyShowcasesResult> => {
    if (!fromDateKey || !toDateKeyExclusive || !isSupabaseLive() || !supabase) {
        return { data: [], error: null };
    }

    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const { data, error } = await supabase
        .from('daily_showcase')
        .select('date,movies')
        .gte('date', fromDateKey)
        .lt('date', toDateKeyExclusive)
        .limit(safeLimit);

    return {
        data: Array.isArray(data) ? (data as DailyShowcaseRow[]) : [],
        error,
    };
};

export const mutateDailyShowcase = async (
    input: MutateDailyShowcaseInput,
): Promise<MutateDailyShowcaseResult> => {
    if (!input.date || !isSupabaseLive() || !supabase) {
        return { ok: false, error: null };
    }

    const { error } = await supabase.from('daily_showcase').upsert(
        [{ date: input.date, movies: input.movies }],
        {
            onConflict: 'date',
            ignoreDuplicates: input.ignoreDuplicates ?? true,
        },
    );

    return {
        ok: !error,
        error,
    };
};
