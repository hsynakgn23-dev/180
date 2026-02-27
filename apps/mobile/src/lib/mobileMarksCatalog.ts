import {
  MARK_CATALOG,
  type MarkCategory,
  type MarkMotion,
} from '../../../../src/domain/marksCatalog';

export type MobileMarkCategory = MarkCategory | 'Unknown';
export type MobileMarkMotion = MarkMotion | 'none';

export type MobileMarkMeta = {
  id: string;
  title: string;
  category: MobileMarkCategory;
  motion: MobileMarkMotion;
};

export const MOBILE_MARK_CATALOG: MobileMarkMeta[] = MARK_CATALOG.map((mark) => ({
  id: mark.id,
  title: mark.title,
  category: mark.category,
  motion: mark.motion,
}));

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
    motion: 'none',
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
