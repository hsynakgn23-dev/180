import {
  MARK_CATALOG,
  type MarkCategory,
  type MarkMotion,
} from '../../../../src/domain/marksCatalog';
import {
  getMarkCategoryLabel,
  getMarkCopy,
  type LanguageCode,
} from '../../../../src/i18n/localization';

export type MobileMarkCategory = MarkCategory | 'Unknown';
export type MobileMarkMotion = MarkMotion | 'none';

export type MobileMarkMeta = {
  id: string;
  title: string;
  description: string;
  whisper: string;
  category: MobileMarkCategory;
  categoryLabel: string;
  motion: MobileMarkMotion;
};

type MobileMarkCatalogBase = {
  id: string;
  category: MobileMarkCategory;
  motion: MobileMarkMotion;
};

const UNKNOWN_CATEGORY_LABEL: Record<LanguageCode, string> = {
  tr: 'Diger',
  en: 'Other',
  es: 'Otros',
  fr: 'Autres',
};

export const MOBILE_MARK_CATALOG: MobileMarkCatalogBase[] = MARK_CATALOG.map((mark) => ({
  id: mark.id,
  category: mark.category,
  motion: mark.motion,
}));

const MARK_META_BY_ID = new Map<string, MobileMarkCatalogBase>(
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

const getUnknownCategoryLabel = (language: LanguageCode): string =>
  UNKNOWN_CATEGORY_LABEL[language] || UNKNOWN_CATEGORY_LABEL.en;

export const resolveMobileMarkMeta = (
  markId: string,
  language: LanguageCode = 'en'
): MobileMarkMeta => {
  const existing = MARK_META_BY_ID.get(markId);
  const markCopy = getMarkCopy(language, markId);

  if (existing) {
    return {
      id: existing.id,
      title: markCopy.title || formatMarkIdFallback(markId),
      description: markCopy.description || '',
      whisper: markCopy.whisper || '',
      category: existing.category,
      categoryLabel: getMarkCategoryLabel(language, existing.category),
      motion: existing.motion,
    };
  }

  return {
    id: markId,
    title: markCopy.title || formatMarkIdFallback(markId),
    description: markCopy.description || '',
    whisper: markCopy.whisper || '',
    category: 'Unknown',
    categoryLabel: getUnknownCategoryLabel(language),
    motion: 'none',
  };
};

export const resolveMobileMarkTitle = (
  markId: string,
  language: LanguageCode = 'en'
): string => resolveMobileMarkMeta(markId, language).title;

export const groupMobileMarksByCategory = (
  markIds: string[],
  language: LanguageCode = 'en'
): Array<{ category: MobileMarkCategory; label: string; marks: MobileMarkMeta[] }> => {
  const deduped = Array.from(new Set(markIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const grouped = new Map<MobileMarkCategory, MobileMarkMeta[]>();

  for (const id of deduped) {
    const meta = resolveMobileMarkMeta(id, language);
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
    'Knowledge',
    'Unknown',
  ];

  return categoryOrder
    .map((category) => ({
      category,
      label:
        category === 'Unknown'
          ? getUnknownCategoryLabel(language)
          : getMarkCategoryLabel(language, category),
      marks: (grouped.get(category) || []).sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((entry) => entry.marks.length > 0);
};
