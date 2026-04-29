import { LEVEL_THRESHOLD } from '../context/xpShared/state';

export interface LeagueInfo {
  name: string;
  color: string;
  description: string;
}

export const LEAGUE_NAMES = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Emerald',
  'Sapphire',
  'Ruby',
  'Diamond',
  'Master',
  'Grandmaster',
  'Absolute',
  'Eternal',
] as const;

export type LeagueKey = (typeof LEAGUE_NAMES)[number];

export const LEAGUES_DATA: Record<LeagueKey, LeagueInfo> = {
  Bronze: { name: 'Figuran', color: '#CD7F32', description: 'Sahneye ilk adim.' },
  Silver: { name: 'Izleyici', color: '#C0C0C0', description: 'Gozlemlemeye basladin.' },
  Gold: { name: 'Yorumcu', color: '#FFD700', description: 'Sesin duyuluyor.' },
  Platinum: { name: 'Elestirmen', color: '#E5E4E2', description: 'Analizlerin derinlesiyor.' },
  Emerald: { name: 'Sinema Gurmesi', color: '#50C878', description: 'Zevklerin inceliyor.' },
  Sapphire: { name: 'Sinefil', color: '#0F52BA', description: 'Tutkun bir yasam bicimi.' },
  Ruby: { name: 'Vizyoner', color: '#E0115F', description: 'Gelecegi goruyorsun.' },
  Diamond: { name: 'Yonetmen', color: '#B9F2FF', description: 'Kendi sahnelerini kur.' },
  Master: { name: 'Auteur', color: '#9400D3', description: 'Imzani at.' },
  Grandmaster: { name: 'Efsane', color: '#FF0000', description: 'Tarihe gectin.' },
  Absolute: { name: 'Absolute', color: '#000000', description: 'The Void' },
  Eternal: { name: 'Eternal', color: '#FFFFFF', description: 'The Light' },
};

export const getLeagueIndexFromXp = (xp: number): number =>
  Math.min(Math.floor(Math.max(0, Number(xp) || 0) / LEVEL_THRESHOLD), LEAGUE_NAMES.length - 1);

export const getLeagueKeyByIndex = (leagueIndex: number): LeagueKey => {
  const normalizedIndex = Math.min(Math.max(0, Math.floor(Number(leagueIndex) || 0)), LEAGUE_NAMES.length - 1);
  return LEAGUE_NAMES[normalizedIndex];
};

export const isLeagueKey = (value: string | null | undefined): value is LeagueKey =>
  LEAGUE_NAMES.includes(String(value || '').trim() as LeagueKey);

export const resolveLeagueKey = (leagueKey: string | null | undefined): LeagueKey => {
  const normalized = String(leagueKey || '').trim();
  return isLeagueKey(normalized) ? normalized : LEAGUE_NAMES[0];
};

export const resolveLeagueKeyFromXp = (xp: number): LeagueKey => getLeagueKeyByIndex(getLeagueIndexFromXp(xp));

export const resolveLeagueInfo = (leagueKey: string | null | undefined): LeagueInfo =>
  LEAGUES_DATA[resolveLeagueKey(leagueKey)];

export type LeagueTier = 1 | 2 | 3;

export interface LeagueTierInfo {
  leagueKey: LeagueKey;
  tier: LeagueTier;
  tierLabel: string;
  tierXpStart: number;
  tierXpEnd: number;
  tierProgress: number;
  xpToNextTier: number;
  nextLeagueKey: LeagueKey | null;
  isTopTier: boolean;
  isMaxLeague: boolean;
}

const TIER_ROMAN: Record<LeagueTier, string> = { 1: 'I', 2: 'II', 3: 'III' };

export const getLeagueTierInfo = (xp: number): LeagueTierInfo => {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const leagueIndex = getLeagueIndexFromXp(safeXp);
  const leagueKey = LEAGUE_NAMES[leagueIndex];
  const leagueXpStart = leagueIndex * LEVEL_THRESHOLD;
  const nextLeagueKey = leagueIndex + 1 < LEAGUE_NAMES.length ? LEAGUE_NAMES[leagueIndex + 1] : null;
  const leagueXpEnd = leagueXpStart + LEVEL_THRESHOLD;

  const span = LEVEL_THRESHOLD;
  const xpInLeague = safeXp - leagueXpStart;

  const t1End = leagueXpStart + Math.floor(span / 3);
  const t2End = leagueXpStart + Math.floor((2 * span) / 3);

  let tier: LeagueTier;
  let tierXpStart: number;
  let tierXpEnd: number;

  if (xpInLeague < Math.floor(span / 3)) {
    tier = 1; tierXpStart = leagueXpStart; tierXpEnd = t1End;
  } else if (xpInLeague < Math.floor((2 * span) / 3)) {
    tier = 2; tierXpStart = t1End; tierXpEnd = t2End;
  } else {
    tier = 3; tierXpStart = t2End; tierXpEnd = leagueXpEnd;
  }

  const tierSpan = Math.max(1, tierXpEnd - tierXpStart);
  const tierProgress = Math.min(1, Math.max(0, (safeXp - tierXpStart) / tierSpan));
  const xpToNextTier = Math.max(0, tierXpEnd - safeXp);
  const isTopTier = tier === 3;
  const isMaxLeague = nextLeagueKey === null && isTopTier;

  return {
    leagueKey, tier,
    tierLabel: `${leagueKey} ${TIER_ROMAN[tier]}`,
    tierXpStart, tierXpEnd, tierProgress, xpToNextTier,
    nextLeagueKey, isTopTier, isMaxLeague,
  };
};
