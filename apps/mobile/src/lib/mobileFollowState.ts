import { isSupabaseLive, supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type MobileFollowResolveResult =
  | {
      ok: true;
      message: string;
      isFollowing: boolean;
      followsYou: boolean;
      isSelf: boolean;
    }
  | {
      ok: false;
      message: string;
      isFollowing: false;
      followsYou: false;
      isSelf: boolean;
    };

type MobileFollowToggleResult =
  | {
      ok: true;
      message: string;
      isFollowing: boolean;
      isSelf: false;
      deltaFollowers: -1 | 1;
    }
  | {
      ok: false;
      message: string;
      isFollowing: false;
      isSelf: boolean;
      deltaFollowers: 0;
    };

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeErrorMessage = (error: SupabaseErrorLike | null | undefined): string =>
  normalizeText(error?.message || error?.code, 220) || 'Takip islemi tamamlanamadi.';

const readViewerUserId = async (): Promise<string | null> => {
  if (!isSupabaseLive() || !supabase) return null;
  const { data } = await supabase.auth.getSession();
  return normalizeText(data.session?.user?.id, 120) || null;
};

const readFollowExists = async (
  viewerUserId: string,
  targetUserId: string
): Promise<{ ok: true; exists: boolean } | { ok: false; error: SupabaseErrorLike }> => {
  if (!supabase) {
    return {
      ok: false,
      error: { code: 'SUPABASE_UNAVAILABLE', message: 'Supabase client is not available.' },
    };
  }

  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_user_id')
    .eq('follower_user_id', viewerUserId)
    .eq('followed_user_id', targetUserId)
    .limit(1);

  if (error) return { ok: false, error };
  return { ok: true, exists: Array.isArray(data) && data.length > 0 };
};

export const resolveMobileFollowState = async (
  targetUserIdRaw: string
): Promise<MobileFollowResolveResult> => {
  const targetUserId = normalizeText(targetUserIdRaw, 120);
  if (!targetUserId) {
    return {
      ok: false,
      message: 'Gecersiz kullanici kimligi.',
      isFollowing: false,
      followsYou: false,
      isSelf: false,
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
      isFollowing: false,
      followsYou: false,
      isSelf: false,
    };
  }

  const viewerUserId = await readViewerUserId();
  if (!viewerUserId) {
    return {
      ok: false,
      message: 'Takip icin uye girisi gerekli.',
      isFollowing: false,
      followsYou: false,
      isSelf: false,
    };
  }

  if (viewerUserId === targetUserId) {
    return {
      ok: true,
      message: 'Kendi profilin.',
      isFollowing: false,
      followsYou: false,
      isSelf: true,
    };
  }

  const [viewerToTarget, targetToViewer] = await Promise.all([
    readFollowExists(viewerUserId, targetUserId),
    readFollowExists(targetUserId, viewerUserId),
  ]);

  if (!viewerToTarget.ok) {
    return {
      ok: false,
      message: normalizeErrorMessage(viewerToTarget.error),
      isFollowing: false,
      followsYou: false,
      isSelf: false,
    };
  }

  if (!targetToViewer.ok) {
    return {
      ok: false,
      message: normalizeErrorMessage(targetToViewer.error),
      isFollowing: false,
      followsYou: false,
      isSelf: false,
    };
  }

  const isFollowing = viewerToTarget.exists;
  const followsYou = targetToViewer.exists;
  return {
    ok: true,
    message: isFollowing
      ? 'Bu kullaniciyi takip ediyorsun.'
      : 'Bu kullaniciyi henuz takip etmiyorsun.',
    isFollowing,
    followsYou,
    isSelf: false,
  };
};

export const toggleMobileFollowState = async (
  targetUserIdRaw: string
): Promise<MobileFollowToggleResult> => {
  const targetUserId = normalizeText(targetUserIdRaw, 120);
  if (!targetUserId) {
    return {
      ok: false,
      message: 'Gecersiz kullanici kimligi.',
      isFollowing: false,
      isSelf: false,
      deltaFollowers: 0,
    };
  }

  if (!isSupabaseLive() || !supabase) {
    return {
      ok: false,
      message: 'Supabase baglantisi hazir degil.',
      isFollowing: false,
      isSelf: false,
      deltaFollowers: 0,
    };
  }

  const viewerUserId = await readViewerUserId();
  if (!viewerUserId) {
    return {
      ok: false,
      message: 'Takip icin uye girisi gerekli.',
      isFollowing: false,
      isSelf: false,
      deltaFollowers: 0,
    };
  }

  if (viewerUserId === targetUserId) {
    return {
      ok: false,
      message: 'Kendi profilini takip edemezsin.',
      isFollowing: false,
      isSelf: true,
      deltaFollowers: 0,
    };
  }

  const relation = await readFollowExists(viewerUserId, targetUserId);
  if (!relation.ok) {
    return {
      ok: false,
      message: normalizeErrorMessage(relation.error),
      isFollowing: false,
      isSelf: false,
      deltaFollowers: 0,
    };
  }

  if (relation.exists) {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_user_id', viewerUserId)
      .eq('followed_user_id', targetUserId);

    if (error) {
      return {
        ok: false,
        message: normalizeErrorMessage(error),
        isFollowing: false,
        isSelf: false,
        deltaFollowers: 0,
      };
    }

    return {
      ok: true,
      message: 'Takipten cikarildi.',
      isFollowing: false,
      isSelf: false,
      deltaFollowers: -1,
    };
  }

  const { error } = await supabase.from('user_follows').insert([
    {
      follower_user_id: viewerUserId,
      followed_user_id: targetUserId,
    },
  ]);

  if (error) {
    return {
      ok: false,
      message: normalizeErrorMessage(error),
      isFollowing: false,
      isSelf: false,
      deltaFollowers: 0,
    };
  }

  return {
    ok: true,
    message: 'Kullanici takip edildi.',
    isFollowing: true,
    isSelf: false,
    deltaFollowers: 1,
  };
};

export type { MobileFollowResolveResult, MobileFollowToggleResult };
