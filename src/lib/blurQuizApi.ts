import { buildApiUrl } from './apiBase';
import { supabase } from './supabase';

export type BlurQuizHints = {
    director: string;
    release_year: number | null;
    cast: string[];
    genre: string;
};

export type BlurQuizMovie = {
    movie_id: string;
    session_id: string;
    poster_path: string;
    hints: BlurQuizHints;
};

export type BlurQuizJokerKey = 'director' | 'year' | 'cast' | 'genre';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

export const fetchBlurMovie = async (options?: {
    excludeIds?: string[];
}): Promise<{ ok: true } & BlurQuizMovie | { ok: false; error: string }> => {
    try {
        const params = new URLSearchParams();
        if (options?.excludeIds?.length) {
            params.set('exclude', options.excludeIds.join(','));
        }
        const qs = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(buildApiUrl(`/api/blur-quiz${qs}`), {
            headers: { Accept: 'application/json', ...(await getAuthHeaders()) },
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return {
            ok: true,
            movie_id: json.movie_id,
            session_id: json.session_id,
            poster_path: json.poster_path,
            hints: json.hints,
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const verifyBlurGuess = async (input: {
    session_id: string;
    guess: string;
    confirm_guess?: boolean;
}): Promise<{
    ok: true;
    correct: boolean;
    xp_earned: number;
    needs_retry?: boolean;
    retry_reason?: string;
    needs_confirmation?: boolean;
    suggested_title?: string;
    match_score?: number;
    matched_title?: string | null;
} | { ok: false; error: string }> => {
    try {
        const res = await fetch(buildApiUrl('/api/blur-quiz'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify(input),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return {
            ok: true,
            correct: Boolean(json.correct),
            xp_earned: Number(json.xp_earned ?? 0),
            needs_retry: json.needs_retry === true,
            retry_reason: String(json.retry_reason || '') || undefined,
            needs_confirmation: json.needs_confirmation === true,
            suggested_title: String(json.suggested_title || '') || undefined,
            match_score: Number.isFinite(Number(json.match_score)) ? Number(json.match_score) : undefined,
            matched_title: json.matched_title == null ? null : String(json.matched_title || ''),
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};

export const requestBlurQuizJoker = async (input: {
    session_id: string;
    joker_key: BlurQuizJokerKey;
}): Promise<
    | { ok: true; jokers_used: number; used_jokers: BlurQuizJokerKey[] }
    | { ok: false; error: string }
> => {
    try {
        const res = await fetch(buildApiUrl('/api/blur-quiz'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                action: 'joker_use',
                session_id: input.session_id,
                joker_key: input.joker_key,
            }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `HTTP ${res.status}` };
        return {
            ok: true,
            jokers_used: Number(json.jokers_used) || 0,
            used_jokers: Array.isArray(json.used_jokers)
                ? json.used_jokers
                    .map((value: unknown) => String(value || '').trim())
                    .filter((value: string) => ['director', 'year', 'cast', 'genre'].includes(value)) as BlurQuizJokerKey[]
                : [],
        };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
    }
};
