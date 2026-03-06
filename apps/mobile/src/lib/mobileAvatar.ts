export const MAX_MOBILE_AVATAR_BYTES = 768 * 1024;
export const MAX_MOBILE_AVATAR_URL_LENGTH =
  Math.ceil((MAX_MOBILE_AVATAR_BYTES * 4) / 3) + 512;

const normalizeAvatarText = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > MAX_MOBILE_AVATAR_URL_LENGTH ? '' : text;
};

export const normalizeMobileAvatarUrl = (value: unknown): string => {
  const normalized = normalizeAvatarText(value);
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^data:image\//i.test(normalized)) return normalized;
  return '';
};

export const resolveMobileAvatarFromXpState = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const xpState = value as Record<string, unknown>;
  return normalizeMobileAvatarUrl(xpState.avatarUrl ?? xpState.avatar_url ?? '');
};
