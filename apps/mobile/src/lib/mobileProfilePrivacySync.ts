import { isSupabaseLive, readSupabaseSessionSafe, supabase } from './supabase';
import { resolveSupabaseUserEmail } from './supabaseUser';
import {
  getDefaultMobileProfileVisibility,
  normalizeMobileProfileVisibility,
  readMobileProfileVisibilityFromXpState,
  type MobileProfileVisibility,
  writeMobileProfileVisibilityToXpState,
} from './mobileProfileVisibility';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type ProfileRow = {
  xp_state?: unknown;
};

type MobileProfilePrivacyReadResult =
  | { ok: true; visibility: MobileProfileVisibility }
  | { ok: false; message: string };

type MobileProfilePrivacySyncResult =
  | { ok: true; visibility: MobileProfileVisibility; message: string }
  | { ok: false; message: string };

const normalizeText = (value: unknown, maxLength: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const sanitizeXpState = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = normalizeText(error.code, 40).toUpperCase();
  const message = normalizeText(error.message, 220).toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501' || code === '42703') return true;
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('forbidden')
  );
};

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
    return { ok: false, message: 'Gizlilik ayarlari icin once giris yap.' };
  }

  return {
    ok: true,
    userId,
    userEmail,
  };
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
    .select('xp_state')
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

export const readMobileProfilePrivacyFromCloud = async (): Promise<MobileProfilePrivacyReadResult> => {
  const identity = await readSignedInIdentity();
  if (!identity.ok) {
    return { ok: false, message: identity.message };
  }

  const profile = await readCurrentProfileRow(identity.userId);
  if (profile.error && !isSupabaseCapabilityError(profile.error)) {
    return {
      ok: false,
      message: normalizeText(profile.error.message, 220) || 'Cloud gizlilik ayarlari okunamadi.',
    };
  }

  return {
    ok: true,
    visibility: readMobileProfileVisibilityFromXpState(profile.row?.xp_state),
  };
};

export const syncMobileProfilePrivacyToCloud = async (
  visibility: MobileProfileVisibility
): Promise<MobileProfilePrivacySyncResult> => {
  const identity = await readSignedInIdentity();
  if (!identity.ok) {
    return { ok: false, message: identity.message };
  }
  if (!supabase) {
    return { ok: false, message: 'Supabase baglantisi hazir degil.' };
  }

  const normalizedVisibility = normalizeMobileProfileVisibility(visibility);
  const profile = await readCurrentProfileRow(identity.userId);
  if (profile.error && !isSupabaseCapabilityError(profile.error)) {
    return {
      ok: false,
      message:
        normalizeText(profile.error.message, 220) || 'Cloud gizlilik ayarlari okunamadi.',
    };
  }

  const currentXpState = sanitizeXpState(profile.row?.xp_state);
  const nextXpState = writeMobileProfileVisibilityToXpState(currentXpState, normalizedVisibility);
  const nowIso = new Date().toISOString();

  const { error: writeError } = await supabase.from('profiles').upsert(
    {
      user_id: identity.userId,
      email: identity.userEmail || null,
      xp_state: nextXpState,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  if (writeError) {
    const capabilityMessage = isSupabaseCapabilityError(writeError)
      ? 'Cloud profil tablosu yetkisi veya kolonu eksik. SQL migration/policy kontrol edilmeli.'
      : '';
    const errorMessage =
      normalizeText(writeError.message, 220) || 'Cloud gizlilik ayarlari yazilamadi.';
    return {
      ok: false,
      message: capabilityMessage || errorMessage,
    };
  }

  return {
    ok: true,
    visibility: normalizedVisibility,
    message: 'Gizlilik ayarlari cloud senkronu tamamlandi.',
  };
};

export {
  getDefaultMobileProfileVisibility,
  normalizeMobileProfileVisibility,
};

export type { MobileProfileVisibility };
