export type MobileMarkCategory =
  | 'Presence'
  | 'Writing'
  | 'Rhythm'
  | 'Discovery'
  | 'Ritual'
  | 'Social'
  | 'Legacy'
  | 'Unknown';

export type MobileMarkMeta = {
  id: string;
  title: string;
  category: MobileMarkCategory;
};

const MOBILE_MARK_CATALOG: MobileMarkMeta[] = [
  { id: 'first_mark', title: 'First Mark', category: 'Presence' },
  { id: 'daybreaker', title: 'Daybreaker', category: 'Presence' },
  { id: '180_exact', title: 'The Architect', category: 'Writing' },
  { id: 'precision_loop', title: 'Precision Loop', category: 'Writing' },
  { id: 'minimalist', title: 'Minimalist', category: 'Writing' },
  { id: 'deep_diver', title: 'Deep Diver', category: 'Writing' },
  { id: 'no_rush', title: 'No Rush', category: 'Rhythm' },
  { id: 'daily_regular', title: 'Regular', category: 'Rhythm' },
  { id: 'seven_quiet_days', title: 'Silence Keeper', category: 'Rhythm' },
  { id: 'ritual_marathon', title: 'Marathon', category: 'Rhythm' },
  { id: 'wide_lens', title: 'Wide Lens', category: 'Discovery' },
  { id: 'hidden_gem', title: 'Hidden Gem', category: 'Discovery' },
  { id: 'genre_discovery', title: 'Spectrum', category: 'Discovery' },
  { id: 'one_genre_devotion', title: 'Devotee', category: 'Discovery' },
  { id: 'classic_soul', title: 'Classic Soul', category: 'Discovery' },
  { id: 'genre_nomad', title: 'Genre Nomad', category: 'Discovery' },
  { id: 'watched_on_time', title: 'Dawn Watcher', category: 'Ritual' },
  { id: 'held_for_five', title: 'The Keeper', category: 'Ritual' },
  { id: 'mystery_solver', title: 'Mystery Solver', category: 'Ritual' },
  { id: 'midnight_ritual', title: 'Midnight', category: 'Ritual' },
  { id: 'first_echo', title: 'First Echo', category: 'Social' },
  { id: 'echo_receiver', title: 'Echo Receiver', category: 'Social' },
  { id: 'echo_initiate', title: 'Echo Initiate', category: 'Social' },
  { id: 'influencer', title: 'Influencer', category: 'Social' },
  { id: 'resonator', title: 'Resonator', category: 'Social' },
  { id: 'quiet_following', title: 'Quiet Following', category: 'Social' },
  { id: 'echo_chamber', title: 'Echo Chamber', category: 'Social' },
  { id: 'eternal_mark', title: 'Eternal', category: 'Legacy' },
  { id: 'legacy', title: 'The Pillar', category: 'Legacy' },
  { id: 'archive_keeper', title: 'Archive Keeper', category: 'Legacy' },
];

const MARK_META_BY_ID = new Map<string, MobileMarkMeta>(
  MOBILE_MARK_CATALOG.map((mark) => [mark.id, mark] as const)
);

const formatMarkIdFallback = (markId: string): string => {
  const normalized = String(markId || '').trim();
  if (!normalized) return 'Unknown Mark';
  return normalized
    .split('_')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
};

export const resolveMobileMarkMeta = (markId: string): MobileMarkMeta => {
  const existing = MARK_META_BY_ID.get(markId);
  if (existing) return existing;
  return {
    id: markId,
    title: formatMarkIdFallback(markId),
    category: 'Unknown',
  };
};

export const resolveMobileMarkTitle = (markId: string): string => resolveMobileMarkMeta(markId).title;

export const groupMobileMarksByCategory = (
  markIds: string[]
): Array<{ category: MobileMarkCategory; marks: MobileMarkMeta[] }> => {
  const deduped = Array.from(new Set(markIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const grouped = new Map<MobileMarkCategory, MobileMarkMeta[]>();

  for (const id of deduped) {
    const meta = resolveMobileMarkMeta(id);
    const list = grouped.get(meta.category) || [];
    list.push(meta);
    grouped.set(meta.category, list);
  }

  const categoryOrder: MobileMarkCategory[] = [
    'Presence',
    'Writing',
    'Rhythm',
    'Discovery',
    'Ritual',
    'Social',
    'Legacy',
    'Unknown',
  ];

  return categoryOrder
    .map((category) => ({
      category,
      marks: (grouped.get(category) || []).sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((entry) => entry.marks.length > 0);
};
