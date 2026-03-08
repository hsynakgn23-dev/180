import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { normalizeMobileAvatarUrl } from './mobileAvatar';
import { resolveSupabaseUserEmail } from './supabaseUser';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  xp_state?: unknown;
};

type ProfileIdentityGender = '' | 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

type MobileProfileIdentityDraft = {
  fullName: string;
  username: string;
  gender: ProfileIdentityGender;
  birthDate: string;
  bio: string;
  avatarUrl: string;
  profileLink: string;
};

type MobileProfileIdentityReadResult =
  | { ok: true; identity: MobileProfileIdentityDraft; source: 'xp_state' | 'profile_display_name' }
  | { ok: false; message: string };

type MobileProfileIdentitySyncResult =
  | { ok: true; identity: MobileProfileIdentityDraft; message: string }
  | { ok: false; message: string };

const VALID_GENDERS = new Set<ProfileIdentityGender>([
  '',
  'female',
  'male',
  'non_binary',
  'prefer_not_to_say',
]);

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeDateLabel = (value: unknown): string => {
  const normalized = normalizeText(value, 30);
  if (!normalized) return '';

  const slashMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${day}/${month}/${year}`;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const day = isoMatch[3].padStart(2, '0');
    const month = isoMatch[2].padStart(2, '0');
    const year = isoMatch[1];
    return `${day}/${month}/${year}`;
  }

  return normalized;
};

const normalizeProfileGender = (value: unknown): ProfileIdentityGender => {
  const normalized = normalizeText(value, 32) as ProfileIdentityGender;
  if (!VALID_GENDERS.has(normalized)) return '';
  return normalized;
};

const normalizeUsername = (value: unknown): string =>
  normalizeText(value, 80)
    .replace(/\s+/g, '')
    .toLowerCase();

const normalizeProfileLink = (value: unknown): string => normalizeText(value, 280);

const normalizeProfileIdentityDraft = (
  input: Partial<MobileProfileIdentityDraft> | null | undefined
): MobileProfileIdentityDraft => ({
  fullName: normalizeText(input?.fullName, 120),
  username: normalizeUsername(input?.username),
  gender: normalizeProfileGender(input?.gender),
  birthDate: normalizeDateLabel(input?.birthDate),
  bio: normalizeText(input?.bio, 180),
  avatarUrl: normalizeMobileAvatarUrl(input?.avatarUrl),
  profileLink: normalizeProfileLink(input?.profileLink),
});

const sanitizeXpState = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
  return (
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('jwt') ||
    message.includes('forbidden')
  );
};

const buildIdentityFromProfile = (profile: ProfileRow | null): MobileProfileIdentityDraft => {
  const xpState = sanitizeXpState(profile?.xp_state);
  const normalized = normalizeProfileIdentityDraft({
    fullName: normalizeText(xpState.fullName ?? xpState.full_name ?? profile?.display_name ?? '', 120),
    username: normalizeUsername(xpState.username ?? ''),
    gender: normalizeProfileGender(xpState.gender ?? ''),
    birthDate: normalizeDateLabel(xpState.birthDate ?? xpState.birth_date ?? ''),
    bio: normalizeText(xpState.bio ?? '', 180),
    avatarUrl: normalizeMobileAvatarUrl(xpState.avatarUrl ?? xpState.avatar_url ?? ''),
    profileLink: normalizeProfileLink(xpState.profileLink ?? xpState.profile_link ?? ''),
  });

  if (!normalized.fullName && profile?.display_name) {
    return {
      ...normalized,
      fullName: normalizeText(profile.display_name, 120),
    };
  }
  return normalized;
};

const readCurrentProfileRow = async (
  userId: string
): Promise<{ row: ProfileRow | null; error: SupabaseErrorLike | null }> => {
  if (!supabase) {
    return {
      row: null,
      error: { code: 'SUPABASE_OFFLINE', message: 'Supabase baglantisi hazir degil.' },
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name,xp_state')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    row: (data || null) as ProfileRow | null,
    error: error
      ? {
          code: error.code,
          message: error.message,
        }
      : null,
  };
};

const resolveDisplayName = (identity: MobileProfileIdentityDraft, fallbackEmail: string): string => {
  const candidate =
    identity.fullName || identity.username || normalizeText(fallbackEmail.split('@')[0], 80) || 'Observer';
  return normalizeText(candidate, 120) || 'Observer';
};

const buildNextXpState = (
  currentXpState: Record<string, unknown>,
  identity: MobileProfileIdentityDraft
): Record<string, unknown> => ({
  ...currentXpState,
  fullName: identity.fullName,
  full_name: identity.fullName,
  username: identity.username,
  gender: identity.gender,
  birthDate: identity.birthDate,
  birth_date: identity.birthDate,
  bio: identity.bio,
  avatarUrl: identity.avatarUrl,
  avatar_url: identity.avatarUrl,
  profileLink: identity.profileLink,
  profile_link: identity.profileLink,
});

const readSignedInIdentity = async (): Promise<
  | {
      ok: true;
      userId: string;
      userEmail: string;
    }
  | { ok: false; message: string }
> => {
  if (!isSupabaseLive() || !supabase) {
    return { ok: false, message: 'Supabase baglantisi hazir degil.' };
  }

  const sessionResult = await readSupabaseSessionSafe();
  const userId = normalizeText(sessionResult.session?.user?.id, 120);
  const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
  if (!userId) {
    return { ok: false, message: 'Profil senkronu icin once mobilde giris yap.' };
  }

  return {
    ok: true,
    userId,
    userEmail,
  };
};

const mergeProfileIdentityDrafts = (
  localDraft: MobileProfileIdentityDraft,
  cloudDraft: MobileProfileIdentityDraft
): MobileProfileIdentityDraft =>
  normalizeProfileIdentityDraft({
    fullName: cloudDraft.fullName || localDraft.fullName,
    username: cloudDraft.username || localDraft.username,
    gender: cloudDraft.gender || localDraft.gender,
    birthDate: cloudDraft.birthDate || localDraft.birthDate,
    bio: cloudDraft.bio || localDraft.bio,
    avatarUrl: cloudDraft.avatarUrl || localDraft.avatarUrl,
    profileLink: cloudDraft.profileLink || localDraft.profileLink,
  });

const readProfileIdentityFromCloud = async (): Promise<MobileProfileIdentityReadResult> => {
  const identity = await readSignedInIdentity();
  if (!identity.ok) {
    return { ok: false, message: identity.message };
  }

  const profile = await readCurrentProfileRow(identity.userId);
  if (profile.error && !isSupabaseCapabilityError(profile.error)) {
    return {
      ok: false,
      message: normalizeText(profile.error.message, 220) || 'Cloud profil okunamadi.',
    };
  }

  const parsedIdentity = buildIdentityFromProfile(profile.row);
  const source = profile.row?.xp_state ? 'xp_state' : 'profile_display_name';
  return {
    ok: true,
    identity: parsedIdentity,
    source,
  };
};

const syncProfileIdentityToCloud = async (
  draft: MobileProfileIdentityDraft
): Promise<MobileProfileIdentitySyncResult> => {
  const identity = await readSignedInIdentity();
  if (!identity.ok) {
    return { ok: false, message: identity.message };
  }
  if (!supabase) {
    return { ok: false, message: 'Supabase baglantisi hazir degil.' };
  }

  const normalizedDraft = normalizeProfileIdentityDraft(draft);
  const profile = await readCurrentProfileRow(identity.userId);
  if (profile.error && !isSupabaseCapabilityError(profile.error)) {
    return {
      ok: false,
      message: normalizeText(profile.error.message, 220) || 'Cloud profil okunamadi.',
    };
  }

  const currentXpState = sanitizeXpState(profile.row?.xp_state);
  const nextXpState = buildNextXpState(currentXpState, normalizedDraft);
  const displayName = resolveDisplayName(normalizedDraft, identity.userEmail);
  const nowIso = new Date().toISOString();
  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      full_name: normalizedDraft.fullName,
      name: normalizedDraft.fullName || displayName,
      username: normalizedDraft.username,
      gender: normalizedDraft.gender,
      birth_date: normalizedDraft.birthDate,
    },
  });

  const { error: writeError } = await supabase.from('profiles').upsert(
    {
      user_id: identity.userId,
      email: identity.userEmail || null,
      display_name: displayName,
      xp_state: nextXpState,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  if (writeError) {
    const capabilityMessage = isSupabaseCapabilityError(writeError)
      ? 'Cloud profil tablosu yetkisi veya kolonu eksik. SQL migration/policy kontrol edilmeli.'
      : '';
    const errorMessage = normalizeText(writeError.message, 220) || 'Cloud profil yazilamadi.';
    return {
      ok: false,
      message: capabilityMessage || errorMessage,
    };
  }

  return {
    ok: true,
    identity: normalizedDraft,
    message: metadataError
      ? `Profil ayarlari cloud tablosuna yazildi fakat auth metadata senkronu basarisiz: ${
          normalizeText(metadataError.message, 220) || 'Supabase auth update hatasi.'
        }`
      : 'Profil ayarlari cloud senkronu tamamlandi.',
  };
};

export type {
  ProfileIdentityGender,
  MobileProfileIdentityDraft,
  MobileProfileIdentityReadResult,
  MobileProfileIdentitySyncResult,
};

export {
  normalizeProfileIdentityDraft as normalizeMobileProfileIdentityDraft,
  mergeProfileIdentityDrafts as mergeMobileProfileIdentityDrafts,
  readProfileIdentityFromCloud as readMobileProfileIdentityFromCloud,
  syncProfileIdentityToCloud as syncMobileProfileIdentityToCloud,
};
