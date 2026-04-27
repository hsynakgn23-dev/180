import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useXP } from '../../context/XPContext';
import { resolveAvatarDisplay } from '../../data/avatarData';
import { resolveLeagueInfo } from '../../domain/leagueSystem';
import { fetchArenaSnapshot, type ArenaSnapshotEntry, type ArenaSnapshotResult } from '../../lib/arenaSnapshot';

type WidgetLanguage = 'tr' | 'en' | 'es' | 'fr';

type ArenaWidgetCopy = {
    title: string;
    meta: string;
    body: string;
    loading: string;
    emptyTitle: string;
    emptyBody: string;
    errorTitle: string;
    errorBody: string;
    players: string;
    points: string;
    activity: string;
    league: string;
    week: string;
    live: string;
    fallback: string;
    refresh: string;
    you: string;
};

const COPY: Record<WidgetLanguage, ArenaWidgetCopy> = {
    tr: {
        title: 'Arena',
        meta: 'Haftalik siralama',
        body: 'Gunluk kapanislar, odul acan notlar ve quiz turlari Arena skorunu belirler.',
        loading: 'Arena tablosu yukleniyor',
        emptyTitle: 'Bu hafta henuz arena izi yok',
        emptyBody: 'Skor birikmeye basladiginda haftalik siralama burada gorunecek.',
        errorTitle: 'Arena tablosu acilamadi',
        errorBody: 'Siralama okunurken gecici bir sorun olustu.',
        players: 'oyuncu',
        points: 'puan',
        activity: 'aktivite',
        league: 'Lig',
        week: 'Hafta',
        live: 'Canli',
        fallback: 'Beklemede',
        refresh: 'Yenile',
        you: 'Sen'
    },
    en: {
        title: 'Arena',
        meta: 'Weekly ranking',
        body: 'Daily completions, rewardable notes, and quiz runs shape your arena score.',
        loading: 'Loading arena board',
        emptyTitle: 'No arena activity yet this week',
        emptyBody: 'The weekly ranking will appear here once score starts collecting.',
        errorTitle: 'Arena board could not be opened',
        errorBody: 'There was a temporary problem while loading the ranking.',
        players: 'players',
        points: 'points',
        activity: 'activity',
        league: 'League',
        week: 'Week',
        live: 'Live',
        fallback: 'Pending',
        refresh: 'Refresh',
        you: 'You'
    },
    es: {
        title: 'Arena',
        meta: 'Ranking semanal',
        body: 'Cierres diarios, notas con recompensa y rondas de quiz forman tu puntuacion.',
        loading: 'Cargando arena',
        emptyTitle: 'Todavia no hay actividad',
        emptyBody: 'El ranking semanal aparecera cuando se acumule puntuacion.',
        errorTitle: 'No se pudo abrir la arena',
        errorBody: 'Hubo un problema temporal al cargar el ranking.',
        players: 'jugadores',
        points: 'puntos',
        activity: 'actividad',
        league: 'Liga',
        week: 'Semana',
        live: 'En vivo',
        fallback: 'Pendiente',
        refresh: 'Actualizar',
        you: 'Tu'
    },
    fr: {
        title: 'Arena',
        meta: 'Classement hebdo',
        body: 'Les boucles quotidiennes, notes recompensees et quiz forment ton score.',
        loading: 'Chargement de l arena',
        emptyTitle: 'Aucune activite cette semaine',
        emptyBody: 'Le classement hebdo apparaitra quand les scores arriveront.',
        errorTitle: 'Impossible d ouvrir l arena',
        errorBody: 'Un probleme temporaire est survenu lors du chargement.',
        players: 'joueurs',
        points: 'points',
        activity: 'activite',
        league: 'Ligue',
        week: 'Semaine',
        live: 'Live',
        fallback: 'En attente',
        refresh: 'Actualiser',
        you: 'Toi'
    }
};

type ArenaWidgetState =
    | { status: 'loading'; snapshot: ArenaSnapshotResult | null; error: string | null }
    | { status: 'ready'; snapshot: ArenaSnapshotResult; error: string | null }
    | { status: 'error'; snapshot: ArenaSnapshotResult | null; error: string };

type ArenaLeaderboardWidgetProps = {
    onOpenProfile?: (target: { userId?: string | null; username: string }) => void;
};

const isWidgetLanguage = (value: unknown): value is WidgetLanguage =>
    value === 'tr' || value === 'en' || value === 'es' || value === 'fr';

const formatCompactNumber = (value: number): string =>
    new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value));

function TrophyIcon({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
            <path d="M8 4h8v5.8c0 3-1.6 5.2-4 5.2S8 12.8 8 9.8V4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M8 6H5.5v2.2c0 2.1 1.2 3.4 3 3.7M16 6h2.5v2.2c0 2.1-1.2 3.4-3 3.7M12 15v3.2M8.5 20h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

function ArenaAvatar({ entry }: { entry: ArenaSnapshotEntry }) {
    const avatar = entry.avatarUrl || '';
    const isImage = /^https?:\/\//i.test(avatar) || /^data:image\//i.test(avatar);
    const display = resolveAvatarDisplay(avatar || 'cinema_reel');

    return (
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border bg-[#0a0a0a]" style={{ borderColor: `${resolveLeagueInfo(entry.leagueKey).color}66` }}>
            {isImage ? (
                <img src={avatar} alt={entry.displayName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
                <div className={`flex h-full w-full items-center justify-center ${display.bg}`}>
                    <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        style={{ color: display.color }}
                        dangerouslySetInnerHTML={{ __html: display.svgPaths }}
                    />
                </div>
            )}
        </div>
    );
}

function MetricPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-[0.16em] text-[#E5E4E2]/35">{label}</p>
            <p className="mt-1 font-mono text-xs font-black tabular-nums text-[#E5E4E2]/85">{value}</p>
        </div>
    );
}

export function ArenaLeaderboardWidget({ onOpenProfile }: ArenaLeaderboardWidgetProps) {
    const { language: rawLanguage, leagueCopy } = useLanguage();
    const { user, username } = useXP();
    const language = isWidgetLanguage(rawLanguage) ? rawLanguage : 'en';
    const copy = COPY[language] || COPY.en;
    const [state, setState] = useState<ArenaWidgetState>({ status: 'loading', snapshot: null, error: null });

    const currentDisplayName = (username || user?.name || '').trim().toLowerCase();

    const loadArena = useCallback(async () => {
        setState((prev) => ({ status: 'loading', snapshot: prev.snapshot, error: null }));
        try {
            const snapshot = await fetchArenaSnapshot();
            setState({ status: 'ready', snapshot, error: null });
        } catch (error) {
            setState({
                status: 'error',
                snapshot: null,
                error: error instanceof Error ? error.message : copy.errorBody
            });
        }
    }, [copy.errorBody]);

    useEffect(() => {
        void loadArena();
        const id = window.setInterval(() => void loadArena(), 60000);
        return () => window.clearInterval(id);
    }, [loadArena]);

    const snapshot = state.snapshot;
    const entries = snapshot?.entries ?? [];
    const topEntries = entries.slice(0, 5);
    const currentEntry = useMemo(() => {
        if (!user?.id && !currentDisplayName) return null;
        return entries.find((entry) => (
            (user?.id && entry.userId === user.id) ||
            (currentDisplayName && entry.displayName.trim().toLowerCase() === currentDisplayName)
        )) || null;
    }, [currentDisplayName, entries, user?.id]);
    const activeLeagueKey = snapshot?.cohortLeagueKey || currentEntry?.leagueKey || null;
    const activeLeague = activeLeagueKey ? leagueCopy(activeLeagueKey)?.name || resolveLeagueInfo(activeLeagueKey).name : '-';
    const statusLabel = snapshot?.source === 'live' ? copy.live : copy.fallback;

    const handleOpenProfile = (entry: ArenaSnapshotEntry) => {
        if (!entry.userId && !entry.displayName.trim()) return;
        onOpenProfile?.({ userId: entry.userId, username: entry.displayName });
    };

    return (
        <aside className="w-[min(92vw,380px)] sm:min-w-[340px] sm:max-w-[380px] rounded-2xl border border-white/[0.07] bg-[var(--color-bg)]/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-sage">{copy.meta}</p>
                    <h2 className="mt-1 font-serif text-2xl leading-tight text-[#E5E4E2]">{copy.title}</h2>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sage/25 bg-sage/10 text-sage">
                    <TrophyIcon />
                </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[#E5E4E2]/42">{copy.body}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
                <MetricPill label={copy.week} value={snapshot?.weekKey || '-'} />
                <MetricPill label={copy.league} value={activeLeague} />
                <MetricPill label={copy.players} value={String(entries.length)} />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="text-[9px] uppercase tracking-[0.18em] text-[#E5E4E2]/30">{statusLabel}</span>
                <button
                    type="button"
                    onClick={() => void loadArena()}
                    className="text-[9px] font-bold uppercase tracking-[0.16em] text-sage/70 transition-colors hover:text-sage"
                >
                    {copy.refresh}
                </button>
            </div>

            {state.status === 'loading' && entries.length === 0 ? (
                <div className="mt-4 space-y-2">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="h-[58px] rounded-xl border border-white/[0.05] bg-white/[0.035] animate-pulse" />
                    ))}
                    <p className="text-[10px] text-[#E5E4E2]/35">{copy.loading}</p>
                </div>
            ) : null}

            {state.status === 'error' ? (
                <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/80">{copy.errorTitle}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-red-100/55">{state.error || copy.errorBody}</p>
                </div>
            ) : null}

            {topEntries.length === 0 && state.status !== 'loading' && state.status !== 'error' ? (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#E5E4E2]/65">{copy.emptyTitle}</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#E5E4E2]/38">{copy.emptyBody}</p>
                </div>
            ) : null}

            {topEntries.length ? (
                <div className="mt-4 space-y-2">
                    {topEntries.map((entry) => {
                        const leagueInfo = resolveLeagueInfo(entry.leagueKey);
                        const isCurrentUser = Boolean(
                            (user?.id && entry.userId === user.id) ||
                            (currentDisplayName && entry.displayName.trim().toLowerCase() === currentDisplayName)
                        );
                        return (
                            <button
                                key={`${entry.rank}-${entry.userId || entry.displayName}`}
                                type="button"
                                onClick={() => handleOpenProfile(entry)}
                                className={`flex min-h-[58px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all hover:bg-white/[0.065] ${
                                    isCurrentUser
                                        ? 'border-sage/30 bg-sage/10'
                                        : 'border-white/[0.06] bg-white/[0.035]'
                                }`}
                                style={{ borderLeftColor: leagueInfo.color, borderLeftWidth: 3 }}
                            >
                                <span className={`w-6 shrink-0 text-center font-mono text-sm font-black ${entry.rank <= 3 ? 'text-clay' : 'text-[#E5E4E2]/45'}`}>
                                    {entry.rank}
                                </span>
                                <ArenaAvatar entry={entry} />
                                <span className="min-w-0 flex-1">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-xs font-bold text-[#E5E4E2]/90">{entry.displayName}</span>
                                        {isCurrentUser ? (
                                            <span className="rounded-full border border-sage/25 bg-sage/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-sage">
                                                {copy.you}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.14em] text-[#E5E4E2]/30">
                                        {leagueCopy(entry.leagueKey)?.name || leagueInfo.name}
                                    </span>
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block font-mono text-sm font-black tabular-nums text-[#E5E4E2]">
                                        {formatCompactNumber(entry.weeklyArenaScore)}
                                    </span>
                                    <span className="text-[8px] uppercase tracking-[0.14em] text-[#E5E4E2]/32">{copy.points}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : null}

            {currentEntry && !topEntries.some((entry) => entry.userId === currentEntry.userId) ? (
                <div className="mt-3 rounded-xl border border-sage/25 bg-sage/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-sage">{copy.you}</span>
                        <span className="font-mono text-xs font-black text-[#E5E4E2]">
                            #{currentEntry.rank} / {formatCompactNumber(currentEntry.weeklyArenaScore)} {copy.points}
                        </span>
                    </div>
                </div>
            ) : null}
        </aside>
    );
}
