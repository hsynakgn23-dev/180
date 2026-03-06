type SupabaseIdentityLike = {
  identity_data?: Record<string, unknown> | null;
} | null;

type SupabaseUserLike = {
  id?: unknown;
  email?: unknown;
  user_metadata?: Record<string, unknown> | null;
  identities?: SupabaseIdentityLike[] | null;
} | null | undefined;

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const readRecordText = (
  record: Record<string, unknown> | null | undefined,
  keys: string[],
  maxLength = 240
): string => {
  if (!record) return '';
  for (const key of keys) {
    const value = normalizeText(record[key], maxLength);
    if (value) return value;
  }
  return '';
};

export const resolveSupabaseUserEmail = (user: SupabaseUserLike): string => {
  const directEmail = normalizeText(user?.email, 200).toLowerCase();
  if (directEmail) return directEmail;

  const metadataEmail = readRecordText(user?.user_metadata, ['email', 'preferred_email'], 200).toLowerCase();
  if (metadataEmail) return metadataEmail;

  if (Array.isArray(user?.identities)) {
    for (const identity of user.identities) {
      const identityEmail = readRecordText(identity?.identity_data, ['email'], 200).toLowerCase();
      if (identityEmail) return identityEmail;
    }
  }

  return '';
};

export const resolveSupabaseUserAuthLabel = (user: SupabaseUserLike): string => {
  const email = resolveSupabaseUserEmail(user);
  if (email) return email;

  const userId = normalizeText(user?.id, 80).toLowerCase();
  if (!userId) return 'signed-in@local.user';
  return `${userId.slice(0, 12)}@private.local`;
};

export const resolveSupabaseUserDisplayName = (user: SupabaseUserLike): string => {
  const metadataName = readRecordText(user?.user_metadata, ['full_name', 'name', 'user_name'], 120);
  if (metadataName) return metadataName;

  const email = resolveSupabaseUserEmail(user);
  if (email) return normalizeText(email.split('@')[0], 120);

  const userId = normalizeText(user?.id, 80);
  return userId ? `user-${userId.slice(0, 8)}` : 'Observer';
};

