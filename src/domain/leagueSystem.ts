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

export const LEVEL_THRESHOLD = 500;

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
