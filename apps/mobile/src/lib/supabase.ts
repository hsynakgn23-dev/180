import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const normalizeText = (value: unknown, maxLength = 220): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const isInvalidRefreshTokenError = (value: unknown): boolean => {
  const message = normalizeText(
    value instanceof Error ? value.message : (value as { message?: unknown } | null)?.message,
    220
  ).toLowerCase();
  return (
    message.includes('refresh token') &&
    (message.includes('invalid') || message.includes('not found'))
  );
};

const toSessionError = (value: unknown, fallback: string): Error => {
  if (value instanceof Error) return value;
  const message = normalizeText((value as { message?: unknown } | null)?.message, 220) || fallback;
  return new Error(message);
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isSupabaseLive = (): boolean => Boolean(supabase);

export const readSupabaseSessionSafe = async (): Promise<{
  session: Session | null;
  clearedInvalidSession: boolean;
  error: Error | null;
}> => {
  if (!supabase) {
    return {
      session: null,
      clearedInvalidSession: false,
      error: null,
    };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return {
        session: null,
        clearedInvalidSession: true,
        error: null,
      };
    }

    return {
      session: data.session ?? null,
      clearedInvalidSession: false,
      error: error ? toSessionError(error, 'Supabase session okunamadi.') : null,
    };
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return {
        session: null,
        clearedInvalidSession: true,
        error: null,
      };
    }

    return {
      session: null,
      clearedInvalidSession: false,
      error: toSessionError(error, 'Supabase session okunamadi.'),
    };
  }
};
