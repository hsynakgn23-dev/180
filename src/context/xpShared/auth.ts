import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { RegistrationGender, SessionUser } from './types';
import { REGISTRATION_GENDERS } from './state';

export const POST_AUTH_HASH_STORAGE_KEY = '180_post_auth_hash';

export const getLegacyStoredUser = (): SessionUser | null => {
    const stored = localStorage.getItem('180_user_session');
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as Partial<SessionUser>;
        if (!parsed.email || typeof parsed.email !== 'string') return null;
        const fallbackName = parsed.email.split('@')[0] || 'observer';
        const rawGender = typeof parsed.gender === 'string' ? parsed.gender : '';
        const normalizedGender = REGISTRATION_GENDERS.includes(rawGender as RegistrationGender)
            ? (rawGender as RegistrationGender)
            : '';
        return {
            id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : undefined,
            email: parsed.email,
            name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallbackName,
            fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
            username: typeof parsed.username === 'string' ? parsed.username : '',
            gender: normalizedGender,
            birthDate: typeof parsed.birthDate === 'string' ? parsed.birthDate : ''
        };
    } catch {
        return null;
    }
};

export const isLocalAuthOrigin = (origin: string): boolean => {
    try {
        const url = new URL(origin);
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
        return false;
    }
};

export const rememberPostAuthHash = () => {
    if (typeof window === 'undefined') return;
    const currentHash = String(window.location.hash || '').trim();
    if (!currentHash || currentHash === '#') {
        window.sessionStorage.removeItem(POST_AUTH_HASH_STORAGE_KEY);
        return;
    }
    window.sessionStorage.setItem(POST_AUTH_HASH_STORAGE_KEY, currentHash);
};

export const consumePostAuthHash = (): string => {
    if (typeof window === 'undefined') return '';
    const value = String(window.sessionStorage.getItem(POST_AUTH_HASH_STORAGE_KEY) || '').trim();
    if (value) {
        window.sessionStorage.removeItem(POST_AUTH_HASH_STORAGE_KEY);
    }
    return value;
};

export const isPasswordRecoveryUrl = (): boolean => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return hash.includes('type=recovery') || search.includes('type=recovery');
};

export const buildAuthRedirectTo = (): string => {
    if (typeof window !== 'undefined') {
        const currentOrigin = String(window.location.origin || '').trim();
        if (currentOrigin && isLocalAuthOrigin(currentOrigin)) {
            return `${currentOrigin}/`;
        }
    }
    const envRedirect = import.meta.env.VITE_AUTH_REDIRECT_TO;
    if (typeof envRedirect === 'string' && envRedirect.trim()) {
        return envRedirect.trim();
    }
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/`;
    }
    return '/';
};

export const clearRecoveryUrlState = () => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    currentUrl.searchParams.delete('type');
    currentUrl.searchParams.delete('access_token');
    currentUrl.searchParams.delete('refresh_token');
    currentUrl.searchParams.delete('expires_in');
    currentUrl.searchParams.delete('token_type');
    currentUrl.searchParams.delete('provider_token');
    currentUrl.searchParams.delete('provider_refresh_token');
    window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}`);
};

export const normalizeAuthError = (message: string): string => {
    const lowered = message.toLowerCase();
    if (lowered.includes('invalid login credentials')) return 'Email veya sifre hatali.';
    if (lowered.includes('email not confirmed')) return 'E-posta onayi gerekli.';
    if (lowered.includes('user already registered')) return 'Bu e-posta zaten kayitli.';
    if (lowered.includes('unsupported provider') || lowered.includes('provider is not enabled')) {
        return 'Sosyal giris aktif degil. Supabase Dashboard > Authentication > Providers bolumunden Google veya Apple girisini etkinlestir.';
    }
    if (lowered.includes('redirect_to is not allowed') || lowered.includes('redirect url')) {
        return 'OAuth yonlendirme adresi hatali. Supabase ve saglayici ayarlarina mevcut site adresini ekle.';
    }
    if (lowered.includes('email rate limit exceeded') || lowered.includes('rate limit')) {
        return 'Cok fazla deneme yapildi. Biraz bekleyip tekrar dene.';
    }
    if (lowered.includes('same password')) {
        return 'Yeni sifre mevcut sifreden farkli olmali.';
    }
    if (lowered.includes('auth session missing')) {
        return 'Sifre yenileme oturumu bulunamadi. E-postadaki baglantiyi yeniden ac.';
    }
    return message;
};

export const toSessionUser = (authUser: SupabaseUser | null): SessionUser | null => {
    if (!authUser?.email) return null;
    const metadataName = typeof authUser.user_metadata?.full_name === 'string'
        ? authUser.user_metadata.full_name
        : typeof authUser.user_metadata?.name === 'string'
            ? authUser.user_metadata.name
            : '';
    const metadataUsername = typeof authUser.user_metadata?.username === 'string'
        ? authUser.user_metadata.username
        : '';
    const metadataGenderRaw = typeof authUser.user_metadata?.gender === 'string'
        ? authUser.user_metadata.gender
        : '';
    const metadataGender = REGISTRATION_GENDERS.includes(metadataGenderRaw as RegistrationGender)
        ? (metadataGenderRaw as RegistrationGender)
        : '';
    const metadataBirthDate = typeof authUser.user_metadata?.birth_date === 'string'
        ? authUser.user_metadata.birth_date
        : '';
    const fallbackName = authUser.email.split('@')[0] || 'observer';
    const resolvedName = metadataName.trim() || metadataUsername.trim() || fallbackName;
    return {
        id: authUser.id,
        email: authUser.email,
        name: resolvedName,
        fullName: metadataName.trim(),
        username: metadataUsername.trim(),
        gender: metadataGender,
        birthDate: metadataBirthDate
    };
};
