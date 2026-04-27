import { getCurrentWeekKey, normalizeWeeklyArenaState } from '../domain/progressionRewards';
import { readProfileTotalXp } from '../domain/profileXpState';
import { resolveLeagueKeyFromXp } from '../domain/leagueSystem';
import { isSupabaseLive, supabase } from './supabase';

type SupabaseErrorLike = {
    code?: string | null;
    message?: string | null;
};

type ProfileArenaRow = {
    user_id?: unknown;
    display_name?: unknown;
    xp_state?: unknown;
    total_xp?: unknown;
};

type ParsedWeeklyArena = {
    cohortLeagueKey: string | null;
    score: number;
    activityCount: number;
    commentRewards: number;
    quizRewards: number;
    updatedAt: string | null;
};

export type ArenaSnapshotEntry = {
    rank: number;
    userId: string | null;
    displayName: string;
    avatarUrl: string | null;
    totalXp: number;
    leagueKey: string;
    weeklyArenaScore: number;
    weeklyArenaActivity: number;
    commentRewards: number;
    quizRewards: number;
    updatedAt: string | null;
};

export type ArenaSnapshotResult = {
    ok: boolean;
    source: 'live' | 'fallback';
    message: string;
    scope: 'league' | 'global';
    weekKey: string;
    cohortLeagueKey: string | null;
    entries: ArenaSnapshotEntry[];
};

const normalizeText = (value: unknown, maxLength = 160): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.floor(num));
};

const parseIsoMs = (value: unknown): number => {
    const raw = normalizeText(value, 80);
    if (!raw) return 0;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
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

const getFallbackResult = (
    weekKey: string,
    message: string,
    entries: ArenaSnapshotEntry[] = [],
    scope: 'league' | 'global' = 'global',
    cohortLeagueKey: string | null = null
): ArenaSnapshotResult => ({
    ok: true,
    source: 'fallback',
    message,
    scope,
    weekKey,
    cohortLeagueKey,
    entries,
});

const resolveXpStateRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const resolveDisplayName = (row: ProfileArenaRow): string => {
    const xpState = resolveXpStateRecord(row.xp_state);
    return (
        normalizeText(row.display_name, 80) ||
        normalizeText(xpState.username, 80) ||
        normalizeText(xpState.fullName, 80) ||
        'Observer'
    );
};

const resolveTotalXp = (row: ProfileArenaRow): number => {
    const xpState = resolveXpStateRecord(row.xp_state);
    return Math.max(toSafeInt(row.total_xp), readProfileTotalXp(xpState));
};

const normalizeAvatarUrl = (value: unknown): string => {
    const normalized = normalizeText(value, 1024 * 1024);
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (/^data:image\//i.test(normalized)) return normalized;
    if (/^[a-z0-9_:-]+$/i.test(normalized)) return normalized;
    return '';
};

const resolveAvatarFromXpState = (value: unknown): string | null => {
    const xpState = resolveXpStateRecord(value);
    return normalizeAvatarUrl(xpState.avatarUrl ?? xpState.avatar_url ?? '') || null;
};

const resolveWeeklyArena = (row: ProfileArenaRow, weekKey: string): ParsedWeeklyArena => {
    const xpState = resolveXpStateRecord(row.xp_state);
    const weeklyArena = normalizeWeeklyArenaState(xpState.weeklyArena, weekKey);
    return {
        cohortLeagueKey: normalizeText(weeklyArena.cohortLeagueKey, 40) || null,
        score: toSafeInt(weeklyArena.score),
        activityCount: toSafeInt(weeklyArena.activityCount),
        commentRewards: toSafeInt(weeklyArena.commentRewards),
        quizRewards: toSafeInt(weeklyArena.quizRewards),
        updatedAt: normalizeText(weeklyArena.updatedAt, 80) || null,
    };
};

const readProfileRows = async (): Promise<{
    rows: ProfileArenaRow[];
    error: SupabaseErrorLike | null;
}> => {
    if (!supabase) {
        return { rows: [], error: { message: 'Supabase unavailable.' } };
    }

    const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id,display_name,xp_state,total_xp')
        .limit(240);

    if (error) return { rows: [], error };
    return {
        rows: Array.isArray(data) ? (data as ProfileArenaRow[]) : [],
        error: null,
    };
};

const buildEntries = (rows: ProfileArenaRow[], weekKey: string): ArenaSnapshotEntry[] =>
    rows
        .map((row) => {
            const userId = normalizeText(row.user_id, 120) || null;
            const displayName = resolveDisplayName(row);
            const totalXp = resolveTotalXp(row);
            const weeklyArena = resolveWeeklyArena(row, weekKey);
            return {
                rank: 0,
                userId,
                displayName,
                avatarUrl: resolveAvatarFromXpState(row.xp_state),
                totalXp,
                leagueKey: weeklyArena.cohortLeagueKey || resolveLeagueKeyFromXp(totalXp),
                weeklyArenaScore: weeklyArena.score,
                weeklyArenaActivity: weeklyArena.activityCount,
                commentRewards: weeklyArena.commentRewards,
                quizRewards: weeklyArena.quizRewards,
                updatedAt: weeklyArena.updatedAt,
            };
        })
        .filter((entry) => Boolean(entry.displayName));

const sortArenaEntries = (entries: ArenaSnapshotEntry[]): ArenaSnapshotEntry[] =>
    [...entries].sort((a, b) => {
        if (b.weeklyArenaScore !== a.weeklyArenaScore) return b.weeklyArenaScore - a.weeklyArenaScore;
        if (b.weeklyArenaActivity !== a.weeklyArenaActivity) return b.weeklyArenaActivity - a.weeklyArenaActivity;
        if (b.commentRewards !== a.commentRewards) return b.commentRewards - a.commentRewards;
        if (b.quizRewards !== a.quizRewards) return b.quizRewards - a.quizRewards;
        if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
        const updatedDiff = parseIsoMs(b.updatedAt) - parseIsoMs(a.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;
        return a.displayName.localeCompare(b.displayName);
    });

const selectScopedEntries = (input: {
    entries: ArenaSnapshotEntry[];
    currentUserId: string | null;
    currentLeagueKey: string | null;
}): {
    scope: 'league' | 'global';
    cohortLeagueKey: string | null;
    entries: ArenaSnapshotEntry[];
} => {
    const activeEntries = input.entries.filter(
        (entry) =>
            entry.weeklyArenaScore > 0 ||
            entry.weeklyArenaActivity > 0 ||
            (input.currentUserId && entry.userId === input.currentUserId)
    );

    if (activeEntries.length === 0) {
        return { scope: 'global', cohortLeagueKey: null, entries: [] };
    }

    const sameLeagueEntries = input.currentLeagueKey
        ? activeEntries.filter(
              (entry) =>
                  entry.leagueKey === input.currentLeagueKey ||
                  (input.currentUserId && entry.userId === input.currentUserId)
          )
        : [];

    if (sameLeagueEntries.length >= 3) {
        const sortedLeagueEntries = sortArenaEntries(sameLeagueEntries);
        const topLeagueEntries = sortedLeagueEntries.slice(0, 10);
        const currentUserEntry = input.currentUserId
            ? sortedLeagueEntries.find((entry) => entry.userId === input.currentUserId) || null
            : null;
        const scopedEntries =
            currentUserEntry &&
            topLeagueEntries.length >= 10 &&
            !topLeagueEntries.some((entry) => entry.userId === currentUserEntry.userId)
                ? [...topLeagueEntries.slice(0, 9), currentUserEntry]
                : topLeagueEntries;
        return {
            scope: 'league',
            cohortLeagueKey: input.currentLeagueKey,
            entries: scopedEntries,
        };
    }

    const sortedActiveEntries = sortArenaEntries(activeEntries);
    const topActiveEntries = sortedActiveEntries.slice(0, 10);
    const currentUserEntry = input.currentUserId
        ? sortedActiveEntries.find((entry) => entry.userId === input.currentUserId) || null
        : null;
    const scopedEntries =
        currentUserEntry &&
        topActiveEntries.length >= 10 &&
        !topActiveEntries.some((entry) => entry.userId === currentUserEntry.userId)
            ? [...topActiveEntries.slice(0, 9), currentUserEntry]
            : topActiveEntries;
    return {
        scope: 'global',
        cohortLeagueKey: null,
        entries: scopedEntries,
    };
};

export const fetchArenaSnapshot = async (): Promise<ArenaSnapshotResult> => {
    const weekKey = getCurrentWeekKey(new Date());

    if (!isSupabaseLive() || !supabase) {
        return getFallbackResult(weekKey, 'Arena season is waiting for a live connection.');
    }

    const sessionResult = await supabase.auth.getSession().catch(() => null);
    const currentUserId = normalizeText(sessionResult?.data.session?.user?.id, 120) || null;
    const { rows, error } = await readProfileRows();

    if (error) {
        if (isSupabaseCapabilityError(error)) {
            return getFallbackResult(weekKey, 'Arena profile data could not be read.');
        }
        return getFallbackResult(weekKey, normalizeText(error.message, 220) || 'Arena table could not be updated.');
    }

    if (rows.length === 0) {
        return {
            ok: true,
            source: 'live',
            message: 'No arena score has accumulated this week yet.',
            scope: 'global',
            weekKey,
            cohortLeagueKey: null,
            entries: [],
        };
    }

    const builtEntries = buildEntries(rows, weekKey);
    const currentEntry = currentUserId
        ? builtEntries.find((entry) => entry.userId === currentUserId) || null
        : null;
    const scoped = selectScopedEntries({
        entries: builtEntries,
        currentUserId,
        currentLeagueKey: currentEntry?.leagueKey || null,
    });

    const rankedEntries = scoped.entries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
    }));

    return {
        ok: true,
        source: 'live',
        message:
            rankedEntries.length > 0
                ? scoped.scope === 'league' && scoped.cohortLeagueKey
                    ? `${scoped.cohortLeagueKey} arena board updated.`
                    : 'Arena season board updated.'
                : 'No arena score has accumulated this week yet.',
        scope: scoped.scope,
        weekKey,
        cohortLeagueKey: scoped.cohortLeagueKey,
        entries: rankedEntries,
    };
};
