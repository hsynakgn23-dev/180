import {
  LEAGUES_DATA,
  LEAGUE_NAMES,
  LEVEL_THRESHOLD,
  getLeagueIndexFromXp,
  resolveLeagueInfo,
  resolveLeagueKeyFromXp,
  type LeagueKey,
  type LeagueInfo,
} from '../../../../src/domain/leagueSystem';

export { LEAGUES_DATA as MOBILE_LEAGUES_DATA, LEAGUE_NAMES as MOBILE_LEAGUE_NAMES, LEVEL_THRESHOLD };
export type { LeagueInfo as MobileLeagueInfo };
export { getLeagueIndexFromXp };

const FALLBACK_LEAGUE_KEY: LeagueKey = 'Bronze';

export const normalizeMobileLeagueKey = (value: unknown): LeagueKey => {
  const normalized = String(value || '').trim();
  if (!normalized) return FALLBACK_LEAGUE_KEY;
  const exact = LEAGUE_NAMES.find((key) => key === normalized);
  if (exact) return exact;

  const lowered = normalized.toLowerCase();
  const match = LEAGUE_NAMES.find((key) => key.toLowerCase() === lowered);
  return match || FALLBACK_LEAGUE_KEY;
};

export const resolveMobileLeagueKeyFromXp = (xp: number): LeagueKey => resolveLeagueKeyFromXp(xp);

export const resolveMobileLeagueInfo = (leagueKey: string | null | undefined): LeagueInfo =>
  resolveLeagueInfo(normalizeMobileLeagueKey(leagueKey));

export const resolveMobileLeagueInfoFromXp = (xp: number): { leagueKey: LeagueKey; leagueInfo: LeagueInfo } => {
  const leagueKey = resolveMobileLeagueKeyFromXp(xp);
  return { leagueKey, leagueInfo: resolveMobileLeagueInfo(leagueKey) };
};

export const resolveMobileNextLeagueKey = (leagueKey: string): LeagueKey | null => {
  const index = LEAGUE_NAMES.indexOf(normalizeMobileLeagueKey(leagueKey));
  if (index < 0) return LEAGUE_NAMES[0] || FALLBACK_LEAGUE_KEY;
  return index + 1 < LEAGUE_NAMES.length ? LEAGUE_NAMES[index + 1] : null;
};

export const resolveMobileLeagueProgress = (xp: number): {
  leagueIndex: number;
  currentLevelStart: number;
  nextLevelXp: number;
  progressPercentage: number;
} => {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const leagueIndex = getLeagueIndexFromXp(safeXp);
  const currentLevelStart = leagueIndex * LEVEL_THRESHOLD;
  const nextLevelXp = currentLevelStart + LEVEL_THRESHOLD;
  const progressPercentage = Math.min(
    100,
    Math.max(0, ((safeXp - currentLevelStart) / LEVEL_THRESHOLD) * 100)
  );
  return {
    leagueIndex,
    currentLevelStart,
    nextLevelXp,
    progressPercentage,
  };
};
