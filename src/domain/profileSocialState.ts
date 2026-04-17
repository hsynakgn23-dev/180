type ProfileSocialState = Record<string, unknown> | null | undefined;

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const hasOwn = (value: ProfileSocialState, key: string): boolean =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key));

const sanitizeStringList = (value: unknown, maxItems = 420): string[] => {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((entry) => normalizeText(entry, 80))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const sortDateKeysDesc = (dateKeys: string[]): string[] =>
  Array.from(new Set(dateKeys))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort((left, right) => right.localeCompare(left));

const readFirstPresentInt = (value: ProfileSocialState, keys: string[]): number | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const key of keys) {
    if (!hasOwn(value, key)) continue;
    return toSafeInt((value as Record<string, unknown>)[key]);
  }
  return null;
};

const readDailyRitualDateKeys = (value: ProfileSocialState): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const dailyRituals = Array.isArray(value.dailyRituals) ? value.dailyRituals : [];
  return sortDateKeysDesc(
    dailyRituals
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        return normalizeText((entry as Record<string, unknown>).date, 40) || null;
      })
      .filter((entry): entry is string => Boolean(entry))
  );
};

export const readProfileFollowersCount = (value: ProfileSocialState): number =>
  readFirstPresentInt(value, ['followersCount', 'followerCount', 'followers']) ?? 0;

export const readProfileFollowingCount = (value: ProfileSocialState): number => {
  const explicitCount = readFirstPresentInt(value, ['followingCount', 'following_count']);
  if (explicitCount !== null) return explicitCount;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return sanitizeStringList(value.following, 420).length;
};

export const readProfileRitualCount = (value: ProfileSocialState): number => {
  const explicitCount = readFirstPresentInt(value, ['ritualCount', 'ritualsCount']);
  if (explicitCount !== null) return explicitCount;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Array.isArray(value.dailyRituals) ? value.dailyRituals.length : 0;
};

export const readProfileDaysPresentCount = (value: ProfileSocialState): number => {
  const explicitCount = readFirstPresentInt(value, ['daysPresentCount', 'activeDaysCount']);
  if (explicitCount !== null) return explicitCount;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const activeDays = sortDateKeysDesc(sanitizeStringList(value.activeDays, 420));
  return activeDays.length > 0 ? activeDays.length : readDailyRitualDateKeys(value).length;
};

export const readProfileLastRitualDate = (value: ProfileSocialState): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const explicitDate =
    normalizeText(value.lastRitualDate ?? value.last_ritual_date, 40) ||
    normalizeText(value.lastStreakProtectionDate, 40);
  if (explicitDate) return explicitDate;

  const activeDays = sortDateKeysDesc(sanitizeStringList(value.activeDays, 420));
  const dailyRitualDates = readDailyRitualDateKeys(value);
  return sortDateKeysDesc([activeDays[0] || '', dailyRitualDates[0] || ''].filter(Boolean))[0] || null;
};
