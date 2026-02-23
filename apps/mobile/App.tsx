import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  createNavigationContainerRef,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildMobileDeepLinkFromRouteIntent } from '../../packages/shared/src/mobile';
import { fetchDailyMovies } from './src/lib/dailyApi';
import { useMobileRouteIntent } from './src/hooks/useMobileRouteIntent';
import { usePageEntranceAnimation } from './src/hooks/usePageEntranceAnimation';
import { trackMobileEvent } from './src/lib/mobileAnalytics';
import { fetchMobileArenaSnapshot, type MobileArenaEntry } from './src/lib/mobileArenaSnapshot';
import {
  flushQueuedRitualDrafts,
  getQueuedRitualDraftCounts,
  submitRitualDraftWithQueue,
} from './src/lib/mobileRitualQueue';
import { fetchMobileProfileStats } from './src/lib/mobileProfileStats';
import {
  fetchMobileCommentFeed,
  type CommentFeedScope,
  type CommentFeedSort,
} from './src/lib/mobileCommentsFeed';
import {
  configureDefaultNotificationHandler,
  readStoredPushToken,
  registerForPushNotifications,
  sendLocalPushSimulation,
  subscribeToPushNotifications,
  type PushNotificationSnapshot,
} from './src/lib/mobilePush';
import {
  appendPushInboxItem,
  clearPushInbox,
  markPushInboxItemOpened,
  readPushInbox,
  type PushInboxItem,
} from './src/lib/mobilePushInbox';
import { sendPushTestNotification } from './src/lib/mobilePushApi';
import { syncPushTokenToProfileState } from './src/lib/mobilePushProfileSync';
import { claimInviteCodeViaApi, ensureInviteCodeViaApi } from './src/lib/mobileReferralApi';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { UiButton } from './src/ui/primitives';
import { styles } from './src/ui/appStyles';
import {
  type AuthState,
  type CommentFeedState,
  type DailyState,
  type InviteClaimState,
  type LocalPushSimState,
  type ProfileState,
  type PushInboxState,
  type PushState,
  type PushTestState,
  type RitualQueueState,
  type RitualSubmitState,
} from './src/ui/appTypes';
import {
  ArenaChallengeCard,
  ArenaLeaderboardCard,
  AuthCard,
  CommentFeedCard,
  DailyHomeScreen,
  DiscoverRoutesCard,
  InviteClaimScreen,
  MobileSettingsModal,
  PlatformRulesCard,
  ProfileMarksCard,
  PushInboxCard,
  PushStatusCard,
  PublicProfileBridgeCard,
  RitualDraftCard,
  ShareHubScreen,
  setAppScreensThemeMode,
  type MobileSettingsIdentityDraft,
  type MobileSettingsLanguage,
  type MobileSettingsSaveState,
} from './src/ui/appScreens';
import { normalizeBaseUrl, resolveMobileWebBaseUrl } from './src/lib/mobileEnv';
import {
  readStoredMobileThemeMode,
  writeStoredMobileThemeMode,
  type MobileThemeMode,
} from './src/lib/mobileThemeMode';

const isEnvFlagEnabled = (value: string | undefined, defaultValue = true): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(normalized);
};

const PUSH_FEATURE_ENABLED = isEnvFlagEnabled(process.env.EXPO_PUBLIC_PUSH_ENABLED, true);
const INTERNAL_OPS_VISIBLE =
  __DEV__ && isEnvFlagEnabled(process.env.EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES, false);
const MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';
const MOBILE_UI_PACKAGE_LABEL = 'UI Package 6.26';
const MOBILE_PROFILE_IDENTITY_STORAGE_KEY = 'ac_mobile_profile_identity_v1';
const MOBILE_PROFILE_LANGUAGE_STORAGE_KEY = 'ac_mobile_profile_language_v1';

const MOBILE_WEB_BASE_URL = resolveMobileWebBaseUrl();

const DEFAULT_SETTINGS_IDENTITY: MobileSettingsIdentityDraft = {
  fullName: '',
  username: '',
  gender: '',
  birthDate: '',
  bio: '',
  avatarUrl: '',
  profileLink: '',
};

const buildPublicProfileUrl = ({
  userId,
  username,
}: {
  userId?: string | null;
  username?: string | null;
}): string => {
  const normalizedBase = normalizeBaseUrl(MOBILE_WEB_BASE_URL);
  if (!normalizedBase) return '';

  const normalizedUserId = String(userId || '').trim();
  const normalizedUsername = String(username || '').trim();
  const profileKey = normalizedUserId
    ? `id:${normalizedUserId}`
    : normalizedUsername
      ? `name:${normalizedUsername}`
      : '';
  if (!profileKey) return '';

  const encodedKey = encodeURIComponent(profileKey);
  const query = normalizedUsername ? `?name=${encodeURIComponent(normalizedUsername)}` : '';
  return `${normalizedBase}/#/u/${encodedKey}${query}`;
};

const normalizeExternalUrl = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const normalizeDateLabel = (value: string): string => {
  const normalized = String(value || '').trim();
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

const parseStoredIdentityDraft = (raw: string | null): MobileSettingsIdentityDraft => {
  if (!raw) return DEFAULT_SETTINGS_IDENTITY;
  try {
    const parsed = JSON.parse(raw) as Partial<MobileSettingsIdentityDraft> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS_IDENTITY;
    return {
      fullName: String(parsed.fullName || '').slice(0, 120),
      username: String(parsed.username || '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .slice(0, 80),
      gender: (['female', 'male', 'non_binary', 'prefer_not_to_say'].includes(
        String(parsed.gender || '')
      )
        ? String(parsed.gender || '')
        : '') as MobileSettingsIdentityDraft['gender'],
      birthDate: normalizeDateLabel(String(parsed.birthDate || '').slice(0, 30)),
      bio: String(parsed.bio || '').slice(0, 180),
      avatarUrl: String(parsed.avatarUrl || '').slice(0, 1200),
      profileLink: String(parsed.profileLink || '').slice(0, 280),
    };
  } catch {
    return DEFAULT_SETTINGS_IDENTITY;
  }
};

const parseStoredLanguage = (raw: string | null): MobileSettingsLanguage =>
  String(raw || '').trim().toLowerCase() === 'en' ? 'en' : 'tr';

const DISCOVER_ROUTE_CONFIG = [
  {
    id: 'mood_films',
    title: 'Mood Films',
    description: 'Moda gore hizli secimler ve tematik listeler.',
    path: '/discover/mood-films/',
  },
  {
    id: 'director_deep_dives',
    title: 'Director Deep Dives',
    description: 'Yonetmen odakli arsiv ve derin okuma rotalari.',
    path: '/discover/director-deep-dives/',
  },
  {
    id: 'daily_curated_picks',
    title: 'Daily Curated Picks',
    description: 'Gunun secimi etrafinda kurulan editoryal akis.',
    path: '/discover/daily-curated-picks/',
  },
] as const;

const DISCOVER_ROUTES = DISCOVER_ROUTE_CONFIG.map((route) => ({
  ...route,
  href: MOBILE_WEB_BASE_URL ? `${MOBILE_WEB_BASE_URL}${route.path}` : '',
}));

type ArenaEntryView = MobileArenaEntry & { profileHref: string };

type MainTabParamList = {
  Daily: undefined;
  Explore: undefined;
  Inbox: undefined;
  Marks: undefined;
  Profile: undefined;
};
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MAIN_TAB_BY_KEY = {
  daily: 'Daily',
  explore: 'Explore',
  inbox: 'Inbox',
  marks: 'Marks',
  profile: 'Profile',
} as const satisfies Record<'daily' | 'explore' | 'inbox' | 'marks' | 'profile', keyof MainTabParamList>;

const MAIN_KEY_BY_TAB = {
  Daily: 'daily',
  Explore: 'explore',
  Inbox: 'inbox',
  Marks: 'marks',
  Profile: 'profile',
} as const satisfies Record<
  keyof MainTabParamList,
  'daily' | 'explore' | 'inbox' | 'marks' | 'profile'
>;

const MAIN_TAB_BY_SCREEN = {
  daily_home: 'Daily',
  invite_claim: 'Profile',
  share_hub: 'Profile',
} as const satisfies Record<'daily_home' | 'invite_claim' | 'share_hub', keyof MainTabParamList>;
const TAB_ICON_BY_ROUTE = {
  Daily: { active: 'today', inactive: 'today-outline' },
  Explore: { active: 'compass', inactive: 'compass-outline' },
  Inbox: { active: 'notifications', inactive: 'notifications-outline' },
  Marks: { active: 'ribbon', inactive: 'ribbon-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
} as const satisfies Record<keyof MainTabParamList, { active: IoniconName; inactive: IoniconName }>;

const createTabTheme = (mode: MobileThemeMode): NavigationTheme => {
  const isDawn = mode === 'dawn';
  return {
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      background: isDawn ? '#F4F1EA' : '#121212',
      card: isDawn ? '#F1ECE1' : '#171717',
      text: isDawn ? '#1F1D1A' : '#E5E4E2',
      border: isDawn ? 'rgba(44, 44, 44, 0.16)' : 'rgba(255, 255, 255, 0.12)',
      primary: isDawn ? '#A57164' : '#8A9A5B',
      notification: isDawn ? '#8A9A5B' : '#A57164',
    },
  };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const tabNavigationRef = createNavigationContainerRef<MainTabParamList>();


const inviteFailureReasonByCode: Record<string, string> = {
  UNAUTHORIZED: 'api_unauthorized',
  INVALID_CODE: 'invalid_code_format',
  INVITE_NOT_FOUND: 'code_not_found',
  SELF_INVITE: 'self_invite_blocked',
  ALREADY_CLAIMED: 'already_claimed_on_account',
  DEVICE_DAILY_LIMIT: 'device_daily_limit_reached',
  DEVICE_CODE_REUSE: 'code_already_used_on_device',
  SERVER_ERROR: 'api_unavailable',
};

const inviteMessageByCode: Record<string, string> = {
  UNAUTHORIZED: 'Oturum bulunamadi. Once mobilde giris yapman gerekiyor.',
  INVALID_CODE: 'Davet kodu gecersiz.',
  INVITE_NOT_FOUND: 'Davet kodu bulunamadi.',
  SELF_INVITE: 'Kendi davet kodunu kullanamazsin.',
  ALREADY_CLAIMED: 'Bu hesap zaten bir davet kodu kullandi.',
  DEVICE_DAILY_LIMIT: 'Gunluk cihaz limiti doldu. Daha sonra tekrar dene.',
  DEVICE_CODE_REUSE: 'Bu cihazda bu kod daha once kullanilmis.',
  SERVER_ERROR: 'Sunucuya ulasilamadi. Birazdan tekrar dene.',
};


export default function App() {
  type MainTabKey = 'daily' | 'explore' | 'inbox' | 'marks' | 'profile';
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dailyState, setDailyState] = useState<DailyState>({ status: 'idle' });
  const [inviteClaimState, setInviteClaimState] = useState<InviteClaimState>({ status: 'idle' });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authState, setAuthState] = useState<AuthState>({
    status: 'idle',
    message: 'Session kontrol ediliyor...',
  });
  const [ritualDraftText, setRitualDraftText] = useState('');
  const [ritualSubmitState, setRitualSubmitState] = useState<RitualSubmitState>({
    status: 'idle',
    message: '',
  });
  const [ritualQueueState, setRitualQueueState] = useState<RitualQueueState>({
    status: 'idle',
    message: '',
    pendingCount: 0,
  });
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'idle',
    message: 'Profil metrikleri hazir degil.',
  });
  const [pushState, setPushState] = useState<PushState>({
    status: PUSH_FEATURE_ENABLED ? 'idle' : 'unsupported',
    message: PUSH_FEATURE_ENABLED
      ? 'Push kaydi bekleniyor.'
      : 'Push modulu gecici olarak devre disi.',
    permissionStatus: 'unknown',
    token: '',
    projectId: null,
    lastNotification: 'none',
    cloudStatus: 'idle',
    cloudMessage: 'Push cloud sync icin token bekleniyor.',
    deviceKey: '',
    lastSyncedToken: '',
  });
  const [pushTestState, setPushTestState] = useState<PushTestState>({
    status: 'idle',
    message: 'Test push hazir.',
    sentCount: 0,
    ticketCount: 0,
    errorCount: 0,
    ticketIdCount: 0,
    receiptStatus: 'idle',
    receiptCheckedCount: 0,
    receiptOkCount: 0,
    receiptErrorCount: 0,
    receiptPendingCount: 0,
    receiptMessage: '',
    receiptErrorPreview: '',
  });
  const [localPushSimState, setLocalPushSimState] = useState<LocalPushSimState>({
    status: 'idle',
    message: 'Emulator local push simulasyonu hazir.',
  });
  const [pushInboxState, setPushInboxState] = useState<PushInboxState>({
    status: 'idle',
    message: 'Notification inbox yuklenmedi.',
    items: [],
  });
  const [themeMode, setThemeMode] = useState<MobileThemeMode>('midnight');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsLanguage, setSettingsLanguage] = useState<MobileSettingsLanguage>('tr');
  const [settingsIdentityDraft, setSettingsIdentityDraft] = useState<MobileSettingsIdentityDraft>(
    DEFAULT_SETTINGS_IDENTITY
  );
  const [settingsSaveState, setSettingsSaveState] = useState<MobileSettingsSaveState>({
    status: 'idle',
    message: '',
  });
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [inviteCodeDraft, setInviteCodeDraft] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const [isInviteActionBusy, setIsInviteActionBusy] = useState(false);
  const [inviteProgram, setInviteProgram] = useState<{
    code: string;
    inviteLink: string;
    claimCount: number;
  }>({
    code: '',
    inviteLink: '',
    claimCount: 0,
  });
  const [profileGenreDistribution, setProfileGenreDistribution] = useState<
    Array<{ genre: string; count: number }>
  >([]);
  const [commentFeedScope, setCommentFeedScope] = useState<CommentFeedScope>('all');
  const [commentFeedSort, setCommentFeedSort] = useState<CommentFeedSort>('latest');
  const [commentFeedQuery, setCommentFeedQuery] = useState('');
  const [debouncedCommentFeedQuery, setDebouncedCommentFeedQuery] = useState('');
  const [commentFeedState, setCommentFeedState] = useState<CommentFeedState>({
    status: 'idle',
    message: 'Genel yorum akisi hazir degil.',
    source: 'fallback',
    scope: 'all',
    sort: 'latest',
    query: '',
    page: 1,
    pageSize: 24,
    hasMore: false,
    isAppending: false,
    items: [],
  });
  const [arenaState, setArenaState] = useState<{
    status: 'loading' | 'ready' | 'error';
    source: 'live' | 'fallback';
    message: string;
    entries: ArenaEntryView[];
  }>({
    status: 'loading',
    source: 'fallback',
    message: 'Arena leaderboard yukleniyor...',
    entries: [],
  });
  const [publicProfileInput, setPublicProfileInput] = useState('');
  const [, setActiveTab] = useState<MainTabKey>('daily');
  const [debugExpanded, setDebugExpanded] = useState(false);
  const {
    activeIntent,
    deepLink,
    handleIncomingUrl,
    lastIncomingIntent,
    lastIncomingUrl,
    screenPlan,
    setManualIntent,
  } = useMobileRouteIntent();
  const { pageEntrance, pageEnterTranslateY } = usePageEntranceAnimation();

  const primaryDailyMovie =
    dailyState.status === 'success' && dailyState.movies.length > 0 ? dailyState.movies[0] : null;

  const isSignedIn = authState.status === 'signed_in';

  const refreshAuthState = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase ayarlari eksik.',
      });
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const userEmail = String(data.session?.user?.email || '').trim();
      if (data.session?.access_token && userEmail) {
        setAuthState({
          status: 'signed_in',
          message: 'Mobil oturum hazir.',
          email: userEmail,
        });
        return;
      }

      setAuthState({
        status: 'signed_out',
        message: 'Giris yapilmadi.',
      });
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Session okunamadi.',
      });
    }
  }, []);

  const refreshRitualQueue = useCallback(async () => {
    const counts = await getQueuedRitualDraftCounts();
    setRitualQueueState((prev) => ({
      ...prev,
      pendingCount: counts.currentUserCount,
    }));
  }, []);

  const refreshProfileStats = useCallback(async () => {
    setProfileState({
      status: 'loading',
      message: 'Profil metrikleri yukleniyor...',
    });

    const result = await fetchMobileProfileStats();
    if (!result.ok) {
      setProfileState({
        status: 'error',
        message: result.message,
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_profile_snapshot_failed',
        message: result.message,
      });
      return;
    }

    setProfileState({
      status: 'success',
      message: 'Profil metrikleri guncellendi.',
      ...result.stats,
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_profile_snapshot_loaded',
      source: result.stats.source,
      totalXp: result.stats.totalXp,
      streak: result.stats.streak,
      ritualsCount: result.stats.ritualsCount,
      daysPresent: result.stats.daysPresent,
      followingCount: result.stats.followingCount,
      followersCount: result.stats.followersCount,
      marksCount: result.stats.marks.length,
      featuredMarksCount: result.stats.featuredMarks.length,
    });
  }, []);

  const refreshProfileGenreDistribution = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || authState.status !== 'signed_in') {
      setProfileGenreDistribution([]);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = String(sessionData.session?.user?.id || '').trim();
      if (!userId) {
        setProfileGenreDistribution([]);
        return;
      }

      const variants = ['genre', 'movie_genre', 'primary_genre'] as const;
      let rows: Array<Record<string, unknown>> = [];
      let selectedColumn: (typeof variants)[number] | null = null;

      for (const column of variants) {
        const { data, error } = await supabase
          .from('rituals')
          .select(column)
          .eq('user_id', userId)
          .not(column, 'is', null)
          .limit(640);

        if (error) continue;
        if (!Array.isArray(data) || data.length === 0) continue;

        rows = data as Array<Record<string, unknown>>;
        selectedColumn = column;
        break;
      }

      if (!selectedColumn || rows.length === 0) {
        setProfileGenreDistribution([]);
        return;
      }

      const counts = new Map<string, number>();
      for (const row of rows) {
        const rawGenre = String(row[selectedColumn] || '')
          .trim()
          .split(/[|/>,]/)[0]
          .trim()
          .slice(0, 32);
        if (!rawGenre) continue;
        counts.set(rawGenre, (counts.get(rawGenre) || 0) + 1);
      }

      const sorted = Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));
      setProfileGenreDistribution(sorted);
    } catch {
      setProfileGenreDistribution([]);
    }
  }, [authState.status]);

  const refreshArenaLeaderboard = useCallback(async () => {
    setArenaState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Arena leaderboard yukleniyor...',
    }));

    const result = await fetchMobileArenaSnapshot();
    const entriesWithProfile = result.entries.map((entry) => ({
      ...entry,
      profileHref: buildPublicProfileUrl({
        userId: entry.userId,
        username: entry.displayName,
      }),
    }));

    setArenaState({
      status: result.ok ? 'ready' : 'error',
      source: result.source,
      message: result.message,
      entries: entriesWithProfile,
    });

    void trackMobileEvent('page_view', {
      reason: result.ok ? 'mobile_arena_loaded' : 'mobile_arena_failed',
      source: result.source,
      entries: entriesWithProfile.length,
    });
  }, []);

  const refreshCommentFeed = useCallback(
    async (scope: CommentFeedScope, query: string, sort: CommentFeedSort) => {
      const normalizedQuery = String(query || '').trim();
      setCommentFeedState((prev) => ({
        ...prev,
        status: 'loading',
        message: 'Genel yorum akisi yukleniyor...',
        scope,
        sort,
        query: normalizedQuery,
        page: 1,
        hasMore: false,
        isAppending: false,
      }));

      const result = await fetchMobileCommentFeed({
        scope,
        sort,
        query: normalizedQuery,
        page: 1,
        pageSize: 24,
      });

      setCommentFeedState({
        status: result.ok ? 'ready' : 'error',
        message: result.message,
        source: result.source,
        scope,
        sort,
        query: normalizedQuery,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        isAppending: false,
        items: result.items,
      });

      void trackMobileEvent('page_view', {
        reason: result.ok ? 'mobile_comment_feed_loaded' : 'mobile_comment_feed_failed',
        source: result.source,
        scope,
        sort,
        queryLength: normalizedQuery.length,
        items: result.items.length,
      });
    },
    []
  );

  const describePushNotification = useCallback((snapshot: PushNotificationSnapshot): string => {
    const title = snapshot.title || '(no-title)';
    const deepLinkMark = snapshot.deepLink ? 'with-link' : 'no-link';
    const idPreview = snapshot.notificationId ? snapshot.notificationId.slice(-8) : 'no-id';
    return `${snapshot.receivedAt} | ${snapshot.kind} | ${title} | ${deepLinkMark} | id:${idPreview}`;
  }, []);

  const refreshPushInbox = useCallback(async () => {
    setPushInboxState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Notification inbox yukleniyor...',
    }));
    const items = await readPushInbox();
    setPushInboxState({
      status: 'ready',
      message: items.length > 0 ? 'Notification inbox guncellendi.' : 'Inbox bos.',
      items,
    });
  }, []);

  const appendPushInbox = useCallback(
    async (snapshot: PushNotificationSnapshot, source: 'received' | 'opened') => {
      const result = await appendPushInboxItem({
        notificationId: snapshot.notificationId,
        title: snapshot.title,
        body: snapshot.body,
        deepLink: snapshot.deepLink,
        kind: snapshot.kind,
        receivedAt: snapshot.receivedAt,
        source,
      });
      setPushInboxState({
        status: 'ready',
        message: `Inbox kaydi eklendi (${source}).`,
        items: result.items,
      });
    },
    []
  );

  const handleClearPushInbox = useCallback(async () => {
    setPushInboxState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Inbox temizleniyor...',
    }));
    await clearPushInbox();
    setPushInboxState({
      status: 'ready',
      message: 'Inbox temizlendi.',
      items: [],
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_inbox_cleared',
    });
  }, []);

  const handleOpenInboxDeepLink = useCallback(
    async (item: PushInboxItem) => {
      if (!item.deepLink) return;
      handleIncomingUrl(item.deepLink);
      const marked = await markPushInboxItemOpened(item.id);
      setPushInboxState((prev) => ({
        ...prev,
        status: 'ready',
        message: 'Inbox deep-link acildi.',
        items: marked.items,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_inbox_deeplink_opened',
        hasDeepLink: true,
      });
    },
    [handleIncomingUrl]
  );

  const handlePressPushInboxItem = useCallback(async (item: PushInboxItem) => {
    const marked = await markPushInboxItemOpened(item.id);
    setPushInboxState((prev) => ({
      ...prev,
      status: 'ready',
      message: marked.updated ? 'Bildirim okundu olarak isaretlendi.' : 'Bildirim zaten okunmustu.',
      items: marked.items,
    }));
  }, []);

  const syncPushTokenCloud = useCallback(
    async (token: string, permissionStatus: string, projectId: string | null) => {
      const normalizedToken = String(token || '').trim();
      if (!normalizedToken) return;

      setPushState((prev) => ({
        ...prev,
        cloudStatus: 'syncing',
        cloudMessage: 'Push token profile state ile senkronlaniyor...',
      }));

      const result = await syncPushTokenToProfileState({
        expoPushToken: normalizedToken,
        permissionStatus,
        projectId,
      });

      if (!result.ok) {
        setPushState((prev) => ({
          ...prev,
          cloudStatus: 'error',
          cloudMessage: result.message,
        }));
        void trackMobileEvent('page_view', {
          reason: 'mobile_push_cloud_sync_failed',
          failureReason: result.reason,
        });
        return;
      }

      setPushState((prev) => ({
        ...prev,
        cloudStatus: 'synced',
        cloudMessage: `Push token cloud sync ok (${result.deviceCount} device).`,
        deviceKey: result.deviceKey,
        lastSyncedToken: normalizedToken,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_cloud_synced',
        deviceCount: result.deviceCount,
        deviceKey: result.deviceKey,
      });
    },
    []
  );

  const refreshPushRegistration = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setPushState((prev) => ({
        ...prev,
        status: 'unsupported',
        message: 'Push modulu gecici olarak devre disi.',
      }));
      return;
    }

    setPushState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Push izin/token kaydi yapiliyor...',
    }));

    const result = await registerForPushNotifications();
    if (!result.ok) {
      const storedToken = await readStoredPushToken();
      const nextStatus =
        result.reason === 'not_device' || result.reason === 'config_missing'
          ? 'unsupported'
          : 'error';
      setPushState((prev) => ({
        ...prev,
        status: nextStatus,
        message: result.message,
        permissionStatus: result.permissionStatus,
        token: storedToken,
        projectId: result.projectId,
        cloudStatus: storedToken ? prev.cloudStatus : 'idle',
        cloudMessage: storedToken
          ? prev.cloudMessage
          : 'Push cloud sync icin gecerli token yok.',
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_registration_failed',
        failureReason: result.reason,
        permissionStatus: result.permissionStatus,
        hasStoredToken: Boolean(storedToken),
      });
      return;
    }

    setPushState((prev) => ({
      ...prev,
      status: 'ready',
      message: 'Push token hazir.',
      permissionStatus: result.permissionStatus,
      token: result.token,
      projectId: result.projectId,
    }));
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_registration_success',
      permissionStatus: result.permissionStatus,
      hasProjectId: Boolean(result.projectId),
      tokenPrefix: result.token.slice(0, 16),
    });
    if (authState.status === 'signed_in') {
      void syncPushTokenCloud(result.token, result.permissionStatus, result.projectId);
    }
  }, [authState.status, syncPushTokenCloud]);

  const handleSendPushTest = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setPushTestState((prev) => ({
        ...prev,
        status: 'idle',
        message: 'Push modulu gecici olarak devre disi.',
      }));
      return;
    }

    if (authState.status !== 'signed_in') {
      setPushTestState({
        status: 'error',
        message: 'Test push icin once giris yap.',
        sentCount: 0,
        ticketCount: 0,
        errorCount: 0,
        ticketIdCount: 0,
        receiptStatus: 'idle',
        receiptCheckedCount: 0,
        receiptOkCount: 0,
        receiptErrorCount: 0,
        receiptPendingCount: 0,
        receiptMessage: '',
        receiptErrorPreview: '',
      });
      return;
    }

    if (pushState.cloudStatus !== 'synced') {
      setPushTestState({
        status: 'error',
        message: 'Test push icin cloud sync "synced" olmali.',
        sentCount: 0,
        ticketCount: 0,
        errorCount: 0,
        ticketIdCount: 0,
        receiptStatus: 'idle',
        receiptCheckedCount: 0,
        receiptOkCount: 0,
        receiptErrorCount: 0,
        receiptPendingCount: 0,
        receiptMessage: '',
        receiptErrorPreview: '',
      });
      return;
    }

    if (!String(pushState.token || '').trim()) {
      setPushTestState({
        status: 'error',
        message: 'Test push icin gecerli token bulunamadi.',
        sentCount: 0,
        ticketCount: 0,
        errorCount: 0,
        ticketIdCount: 0,
        receiptStatus: 'idle',
        receiptCheckedCount: 0,
        receiptOkCount: 0,
        receiptErrorCount: 0,
        receiptPendingCount: 0,
        receiptMessage: '',
        receiptErrorPreview: '',
      });
      return;
    }

    setPushTestState({
      status: 'loading',
      message: 'Test push gonderiliyor...',
      sentCount: 0,
      ticketCount: 0,
      errorCount: 0,
      ticketIdCount: 0,
      receiptStatus: 'idle',
      receiptCheckedCount: 0,
      receiptOkCount: 0,
      receiptErrorCount: 0,
      receiptPendingCount: 0,
      receiptMessage: '',
      receiptErrorPreview: '',
    });

    const testDeepLink = buildMobileDeepLinkFromRouteIntent(
      { target: 'daily' },
      { base: MOBILE_DEEP_LINK_BASE }
    );

    const result = await sendPushTestNotification({
      title: '180 Absolute Cinema',
      body: 'Bu test bildirimi push kanalini dogrulamak icin gonderildi.',
      deepLink: testDeepLink,
    });

    if (!result.ok || !result.data) {
      const message = result.message || 'Test push gonderilemedi.';
      setPushTestState({
        status: 'error',
        message,
        sentCount: 0,
        ticketCount: 0,
        errorCount: 0,
        ticketIdCount: 0,
        receiptStatus: 'idle',
        receiptCheckedCount: 0,
        receiptOkCount: 0,
        receiptErrorCount: 0,
        receiptPendingCount: 0,
        receiptMessage: '',
        receiptErrorPreview: '',
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_test_failed',
        errorCode: result.errorCode || 'SERVER_ERROR',
        apiMessage: message,
      });
      return;
    }

    const sentCount = Math.max(0, Number(result.data.sentCount || 0));
    const ticketCount = Math.max(0, Number(result.data.ticketCount || 0));
    const errorCount = Math.max(0, Number(result.data.errorCount || 0));
    const ticketIdCount = Math.max(0, Number(result.data.ticketIdCount || 0));
    const receiptStatus = result.data.receiptStatus === 'ok' ? 'ok' : 'unavailable';
    const receiptCheckedCount = Math.max(0, Number(result.data.receiptCheckedCount || 0));
    const receiptOkCount = Math.max(0, Number(result.data.receiptOkCount || 0));
    const receiptErrorCount = Math.max(0, Number(result.data.receiptErrorCount || 0));
    const receiptPendingCount = Math.max(0, Number(result.data.receiptPendingCount || 0));
    const receiptMessage = String(result.data.receiptMessage || '').trim();
    const firstReceiptError = Array.isArray(result.data.receiptErrors)
      ? result.data.receiptErrors[0]
      : null;
    const receiptErrorPreview = firstReceiptError
      ? `${String(firstReceiptError.id || 'unknown')}: ${String(firstReceiptError.message || 'unknown error')}${String(firstReceiptError.details || '').trim() ? ` (${String(firstReceiptError.details).trim()})` : ''}`.slice(0, 320)
      : '';
    const successMessage =
      receiptStatus === 'ok'
        ? 'Test push gonderildi, receipt kontrolu tamamlandi.'
        : 'Test push gonderildi; receipt sonucu sinirli alindi.';

    setPushTestState({
      status: 'success',
      message: successMessage,
      sentCount,
      ticketCount,
      errorCount,
      ticketIdCount,
      receiptStatus,
      receiptCheckedCount,
      receiptOkCount,
      receiptErrorCount,
      receiptPendingCount,
      receiptMessage,
      receiptErrorPreview,
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_test_sent',
      sentCount,
      ticketCount,
      errorCount,
      ticketIdCount,
      receiptStatus,
      receiptCheckedCount,
      receiptOkCount,
      receiptErrorCount,
      receiptPendingCount,
      hasReceiptError: Boolean(receiptErrorPreview),
    });
  }, [authState.status, pushState.cloudStatus, pushState.token]);

  const handleSimulateLocalPush = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setLocalPushSimState({
        status: 'idle',
        message: 'Push modulu gecici olarak devre disi.',
      });
      return;
    }

    setLocalPushSimState({
      status: 'loading',
      message: 'Local test bildirimi hazirlaniyor...',
    });

    const deepLink = buildMobileDeepLinkFromRouteIntent(
      { target: 'daily' },
      { base: MOBILE_DEEP_LINK_BASE }
    );
    const result = await sendLocalPushSimulation({
      title: '180 Absolute Cinema (Local Sim)',
      body: 'Emulator local bildirim testi.',
      deepLink,
    });

    if (!result.ok) {
      setLocalPushSimState({
        status: 'error',
        message: result.message,
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_local_sim_failed',
        apiMessage: result.message,
      });
      return;
    }

    setLocalPushSimState({
      status: 'success',
      message: 'Local bildirim gonderildi. Bildirime tiklayarak deep-link akisina bak.',
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_local_sim_sent',
      deepLink: result.deepLink,
    });
  }, []);

  const handleSignIn = useCallback(async () => {
    const email = authEmail.trim().toLowerCase();
    const password = authPassword;

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase ayarlari eksik.',
      });
      return;
    }

    if (!email || !password) {
      setAuthState({
        status: 'error',
        message: 'Email ve password zorunlu.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Giris yapiliyor...',
    });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session?.access_token) {
        const message = error?.message || 'Giris basarisiz.';
        setAuthState({
          status: 'error',
          message,
        });
        void trackMobileEvent('auth_failure', {
          method: 'password',
          reason: message,
        });
        return;
      }

      setAuthState({
        status: 'signed_in',
        message: 'Giris basarili.',
        email: data.user?.email || email,
      });
      setAuthPassword('');
      void trackMobileEvent('login_success', {
        method: 'password',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Giris basarisiz.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password',
        reason: message,
      });
    }
  }, [authEmail, authPassword]);

  const handleSignOut = useCallback(async () => {
    if (!supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase hazir degil.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Cikis yapiliyor...',
    });

    try {
      await supabase.auth.signOut();
      setAuthState({
        status: 'signed_out',
        message: 'Cikis yapildi.',
      });
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Cikis basarisiz.',
      });
    }
  }, []);

  const isDawnTheme = themeMode === 'dawn';
  const tabTheme = useMemo(() => createTabTheme(themeMode), [themeMode]);

  const handleSetThemeMode = useCallback(
    (nextMode: MobileThemeMode) => {
      setThemeMode(nextMode);
      void writeStoredMobileThemeMode(nextMode);
      void trackMobileEvent('page_view', {
        reason: 'mobile_theme_mode_changed',
        mode: nextMode,
      });
    },
    []
  );

  useEffect(() => {
    void trackMobileEvent('session_start', {
      platform: Platform.OS,
      appSurface: 'mobile_native',
    });
  }, []);

  useEffect(() => {
    let active = true;
    void readStoredMobileThemeMode().then((storedMode) => {
      if (!active) return;
      setThemeMode(storedMode);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setAppScreensThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [rawIdentity, rawLanguage] = await Promise.all([
        AsyncStorage.getItem(MOBILE_PROFILE_IDENTITY_STORAGE_KEY),
        AsyncStorage.getItem(MOBILE_PROFILE_LANGUAGE_STORAGE_KEY),
      ]);
      if (!active) return;
      setSettingsIdentityDraft(parseStoredIdentityDraft(rawIdentity));
      setSettingsLanguage(parseStoredLanguage(rawLanguage));
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(MOBILE_PROFILE_LANGUAGE_STORAGE_KEY, settingsLanguage).catch(
      () => undefined
    );
  }, [settingsLanguage]);

  useEffect(() => {
    if (profileState.status !== 'success') return;
    setSettingsIdentityDraft((prev) => {
      if (String(prev.fullName || '').trim()) return prev;
      return {
        ...prev,
        fullName: profileState.displayName,
      };
    });
  }, [profileState]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      setProfileGenreDistribution([]);
      return;
    }
    void refreshProfileGenreDistribution();
  }, [authState.status, refreshProfileGenreDistribution]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCommentFeedQuery(commentFeedQuery);
    }, 260);
    return () => clearTimeout(timer);
  }, [commentFeedQuery]);

  useEffect(() => {
    void refreshCommentFeed(commentFeedScope, debouncedCommentFeedQuery, commentFeedSort);
  }, [
    authState.status,
    commentFeedScope,
    debouncedCommentFeedQuery,
    commentFeedSort,
    refreshCommentFeed,
  ]);

  useEffect(() => {
    void refreshAuthState();
    void refreshRitualQueue();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshAuthState();
      void refreshRitualQueue();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuthState, refreshRitualQueue]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      void refreshProfileStats();
      return;
    }

    setProfileState({
      status: 'idle',
      message: 'Profil metrikleri icin giris bekleniyor.',
    });
  }, [authState.status, refreshProfileStats]);

  useEffect(() => {
    void refreshArenaLeaderboard();
  }, [authState.status, refreshArenaLeaderboard]);

  useEffect(() => {
    void refreshPushInbox();
  }, [refreshPushInbox]);

  useEffect(() => {
    if (!PUSH_FEATURE_ENABLED) {
      setPushTestState((prev) => ({
        ...prev,
        status: 'idle',
        message: 'Push modulu gecici olarak devre disi.',
      }));
      return;
    }

    if (authState.status === 'signed_in') {
      setPushTestState((prev) => {
        if (prev.status !== 'idle') return prev;
        if (prev.message === 'Test push hazir.') return prev;
        return {
          ...prev,
          message: 'Test push hazir.',
        };
      });
      return;
    }
    setPushTestState({
      status: 'idle',
      message: 'Test push icin giris bekleniyor.',
      sentCount: 0,
      ticketCount: 0,
      errorCount: 0,
      ticketIdCount: 0,
      receiptStatus: 'idle',
      receiptCheckedCount: 0,
      receiptOkCount: 0,
      receiptErrorCount: 0,
      receiptPendingCount: 0,
      receiptMessage: '',
      receiptErrorPreview: '',
    });
  }, [authState.status]);

  useEffect(() => {
    if (!PUSH_FEATURE_ENABLED) {
      return () => undefined;
    }

    configureDefaultNotificationHandler();
    let active = true;

    void readStoredPushToken().then((storedToken) => {
      if (!active) return;
      if (!storedToken) return;
      setPushState((prev) => ({
        ...prev,
        status: prev.status === 'idle' ? 'ready' : prev.status,
        message: prev.status === 'idle' ? 'Kayitli push token bulundu.' : prev.message,
        token: storedToken,
      }));
    });

    const unsubscribe = subscribeToPushNotifications({
      onNotificationReceived: (snapshot) => {
        setPushState((prev) => ({
          ...prev,
          lastNotification: describePushNotification(snapshot),
        }));
        void appendPushInbox(snapshot, 'received');
        void trackMobileEvent('page_view', {
          reason: 'mobile_push_received',
          hasDeepLink: Boolean(snapshot.deepLink),
          notificationType: snapshot.kind,
          title: snapshot.title || null,
        });
      },
      onNotificationResponse: (snapshot) => {
        setPushState((prev) => ({
          ...prev,
          lastNotification: describePushNotification(snapshot),
        }));
        void appendPushInbox(snapshot, 'opened');
        void trackMobileEvent('page_view', {
          reason: 'mobile_push_opened',
          hasDeepLink: Boolean(snapshot.deepLink),
          notificationType: snapshot.kind,
          title: snapshot.title || null,
        });
        if (snapshot.deepLink) {
          handleIncomingUrl(snapshot.deepLink);
        }
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appendPushInbox, describePushNotification, handleIncomingUrl]);

  useEffect(() => {
    if (!PUSH_FEATURE_ENABLED) return;

    if (authState.status !== 'signed_in') {
      setPushState((prev) => {
        if (
          prev.cloudStatus === 'idle' &&
          prev.cloudMessage === 'Push cloud sync icin giris bekleniyor.'
        ) {
          return prev;
        }
        return {
          ...prev,
          cloudStatus: 'idle',
          cloudMessage: 'Push cloud sync icin giris bekleniyor.',
        };
      });
      return;
    }

    const token = String(pushState.token || '').trim();
    if (!token) return;
    if (pushState.cloudStatus === 'syncing') return;
    if (pushState.cloudStatus === 'synced' && pushState.lastSyncedToken === token) return;

    void syncPushTokenCloud(token, pushState.permissionStatus, pushState.projectId);
  }, [
    authState.status,
    pushState.cloudStatus,
    pushState.lastSyncedToken,
    pushState.permissionStatus,
    pushState.projectId,
    pushState.token,
    syncPushTokenCloud,
  ]);

  const loadDailyMovies = async () => {
    setDailyState({ status: 'loading' });
    const result = await fetchDailyMovies();
    if (!result.ok) {
      setDailyState({
        status: 'error',
        message: result.error || 'Unknown error',
        endpoint: result.endpoint,
      });
      return;
    }

    setDailyState({
      status: 'success',
      endpoint: result.endpoint,
      date: result.date,
      source: result.source,
      dataSource: result.dataSource,
      cacheAgeSeconds: result.cacheAgeSeconds,
      stale: result.stale,
      warning: result.warning,
      movies: result.movies,
    });
  };

  const handleSubmitRitualDraft = useCallback(async () => {
    if (!primaryDailyMovie) {
      setRitualSubmitState({
        status: 'error',
        message: 'Ritual icin once daily listesi yuklenmeli.',
      });
      return;
    }

    const text = ritualDraftText.trim();
    if (!text) {
      setRitualSubmitState({
        status: 'error',
        message: 'Ritual metni bos olamaz.',
      });
      return;
    }

    setRitualSubmitState({
      status: 'submitting',
      message: 'Ritual gonderiliyor...',
    });

    const result = await submitRitualDraftWithQueue({
      movieTitle: primaryDailyMovie.title,
      text,
    });

    if (!result.ok) {
      setRitualSubmitState({
        status: 'error',
        message: result.message,
      });
      void trackMobileEvent('ritual_submit_failed', {
        reason: result.reason,
        movieTitle: primaryDailyMovie.title,
        textLength: text.length,
      });
      setRitualQueueState((prev) => ({
        ...prev,
        pendingCount: result.pendingCount,
      }));
      return;
    }

    setRitualDraftText('');
    setRitualQueueState((prev) => ({
      ...prev,
      pendingCount: result.pendingCount,
    }));

    if (result.synced) {
      setRitualSubmitState({
        status: 'synced',
        message: result.message,
      });
      void trackMobileEvent('ritual_submitted', {
        movieTitle: primaryDailyMovie.title,
        textLength: text.length,
        syncMode: 'live',
      });
      void refreshProfileStats();
      return;
    }

    setRitualSubmitState({
      status: 'queued',
      message: result.message,
    });
    void trackMobileEvent('ritual_submit_failed', {
      reason: 'queued_for_retry',
      movieTitle: primaryDailyMovie.title,
      textLength: text.length,
    });
  }, [primaryDailyMovie, refreshProfileStats, ritualDraftText]);

  const handleFlushRitualQueue = useCallback(async () => {
    setRitualQueueState((prev) => ({
      ...prev,
      status: 'syncing',
      message: 'Kuyruk clouda gonderiliyor...',
    }));

    const result = await flushQueuedRitualDrafts(12);
    setRitualQueueState((prev) => ({
      ...prev,
      status: result.ok ? 'done' : 'error',
      message: result.message,
      pendingCount: result.pendingCount,
    }));

    if (!result.ok) {
      void trackMobileEvent('ritual_submit_failed', {
        reason: 'queue_flush_failed',
        queuedFailed: result.failed,
        queuedRemaining: result.pendingCount,
      });
    }

    if (result.synced > 0) {
      void refreshProfileStats();
    }

    await refreshRitualQueue();
  }, [refreshProfileStats, refreshRitualQueue]);

  useEffect(() => {
    if (screenPlan.screen !== 'daily_home') return;
    if (dailyState.status === 'idle') {
      void loadDailyMovies();
    }
  }, [screenPlan.screen, dailyState.status]);

  useEffect(() => {
    const targetTabRoute = MAIN_TAB_BY_SCREEN[screenPlan.screen];
    const targetTabKey = MAIN_KEY_BY_TAB[targetTabRoute];
    setActiveTab((prev) => (prev === targetTabKey ? prev : targetTabKey));
    if (!tabNavigationRef.isReady()) return;
    const currentRouteName = tabNavigationRef.getCurrentRoute()?.name;
    if (currentRouteName !== targetTabRoute) {
      tabNavigationRef.navigate(targetTabRoute);
    }
  }, [screenPlan.screen]);

  useEffect(() => {
    if (!PUSH_FEATURE_ENABLED) return;
    if (authState.status !== 'signed_in') return;
    if (pushState.status === 'ready' && pushState.token) return;
    if (pushState.status === 'loading') return;
    void refreshPushRegistration();
  }, [authState.status, pushState.status, pushState.token, refreshPushRegistration]);

  const inviteCode =
    activeIntent.target === 'invite' || activeIntent.target === 'share'
      ? activeIntent.invite
      : undefined;
  const sharePlatform = activeIntent.target === 'share' ? activeIntent.platform : undefined;
  const shareGoal = activeIntent.target === 'share' ? activeIntent.goal : undefined;
  const canSubmitRitualDraft = Boolean(
    isSignedIn && primaryDailyMovie && ritualDraftText.trim().length > 0
  );
  const isInviteRouteActive = screenPlan.screen === 'invite_claim';
  const isShareRouteActive = screenPlan.screen === 'share_hub';
  const activeRouteLabel = isInviteRouteActive
    ? 'Davet'
    : isShareRouteActive
      ? 'Paylas'
      : 'Gunluk';
  const isDevSurfaceEnabled = INTERNAL_OPS_VISIBLE;
  const handleTabNavigationStateChange = useCallback(() => {
    const currentRouteName = tabNavigationRef.getCurrentRoute()?.name;
    if (!currentRouteName) return;
    const nextTabKey = MAIN_KEY_BY_TAB[currentRouteName];
    setActiveTab((prev) => (prev === nextTabKey ? prev : nextTabKey));
  }, []);
  const handleTabNavigationReady = useCallback(() => {
    const targetTabRoute = MAIN_TAB_BY_SCREEN[screenPlan.screen];
    const currentRouteName = tabNavigationRef.getCurrentRoute()?.name;
    if (currentRouteName !== targetTabRoute) {
      tabNavigationRef.navigate(targetTabRoute);
    }
    handleTabNavigationStateChange();
  }, [handleTabNavigationStateChange, screenPlan.screen]);
  const authSummary = isSignedIn ? 'ready' : 'required';
  const pushSummary =
    pushState.cloudStatus === 'synced'
      ? 'synced'
      : pushState.cloudStatus === 'syncing'
        ? 'syncing'
        : pushState.cloudStatus === 'error'
          ? 'error'
          : 'idle';
  const dailySummary =
    dailyState.status === 'success'
      ? `${dailyState.movies.length} picks`
      : dailyState.status === 'error'
        ? 'error'
        : dailyState.status === 'loading'
          ? 'loading'
          : 'idle';
  const inboxSummary = `${pushInboxState.items.length} items`;
  const unreadDeepLinkCount = pushInboxState.items.filter(
    (item) => !item.opened && Boolean(item.deepLink)
  ).length;
  const pendingQueueCount = ritualQueueState.pendingCount;
  const streakSummary = profileState.status === 'success' ? String(profileState.streak) : '--';
  const ritualsCountSummary =
    profileState.status === 'success' ? String(profileState.ritualsCount) : '--';
  const canOpenManualProfile = Boolean(String(publicProfileInput || '').trim() && MOBILE_WEB_BASE_URL);
  const commentFeedSummary =
    commentFeedState.status === 'ready'
      ? `${commentFeedState.items.length} yorum`
      : commentFeedState.status === 'error'
        ? 'hata'
        : commentFeedState.status === 'loading'
          ? 'yukleniyor'
          : 'hazir degil';
  const inboxTabBadge =
    unreadDeepLinkCount > 0 ? (unreadDeepLinkCount > 9 ? '9+' : unreadDeepLinkCount) : undefined;
  const themeModeLabel = isDawnTheme ? 'Gunduz' : 'Gece';
  const profileDisplayName = String(
    settingsIdentityDraft.fullName ||
      (profileState.status === 'success' ? profileState.displayName : '') ||
      (authState.status === 'signed_in' ? authState.email.split('@')[0] : 'Observer')
  ).trim();
  const profileUsername = String(settingsIdentityDraft.username || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  const profileBio = String(settingsIdentityDraft.bio || '').trim();
  const profileLink = String(settingsIdentityDraft.profileLink || '').trim();
  const profileAvatarUrl = String(settingsIdentityDraft.avatarUrl || '').trim();
  const profileBirthDateLabel = normalizeDateLabel(settingsIdentityDraft.birthDate);
  const profileStats = profileState.status === 'success'
    ? {
        streak: profileState.streak,
        rituals: profileState.ritualsCount,
        marks: profileState.marks.length,
        followers: profileState.followersCount,
        following: profileState.followingCount,
        days: profileState.daysPresent,
      }
    : {
        streak: 0,
        rituals: 0,
        marks: 0,
        followers: 0,
        following: 0,
        days: 0,
      };
  const inviteStatsLabel = inviteProgram.code
    ? `Kod kullanim: ${inviteProgram.claimCount}`
    : 'Davet kodu olusturulunca burada gorunur.';
  const inviteRewardLabel = 'Invitee +180 XP | Inviter +120 XP';
  const activeAccountLabel = profileDisplayName || 'Observer';
  const activeEmailLabel = authState.status === 'signed_in' ? authState.email : '-';

  const handleCommentFeedScopeChange = useCallback((scope: CommentFeedScope) => {
    setCommentFeedScope(scope);
    setCommentFeedState((prev) => ({
      ...prev,
      scope,
    }));
  }, []);

  const handleCommentFeedQueryChange = useCallback((query: string) => {
    setCommentFeedQuery(query);
    setCommentFeedState((prev) => ({
      ...prev,
      query,
    }));
  }, []);

  const handleCommentFeedSortChange = useCallback((sort: CommentFeedSort) => {
    setCommentFeedSort(sort);
    setCommentFeedState((prev) => ({
      ...prev,
      sort,
    }));
  }, []);

  useEffect(() => {
    setInviteClaimState({ status: 'idle' });
  }, [screenPlan.screen, inviteCode]);

  const handleOpenDiscoverRoute = useCallback(
    async (route: { id: string; href: string }) => {
      if (!route.href) {
        void trackMobileEvent('page_view', {
          reason: 'mobile_discover_route_missing_base',
          route: route.id,
        });
        return;
      }

      try {
        const canOpen = await Linking.canOpenURL(route.href);
        if (!canOpen) {
          void trackMobileEvent('page_view', {
            reason: 'mobile_discover_route_unsupported',
            route: route.id,
          });
          return;
        }
        await Linking.openURL(route.href);
        void trackMobileEvent('page_view', {
          reason: 'mobile_discover_route_opened',
          route: route.id,
        });
      } catch (error) {
        void trackMobileEvent('page_view', {
          reason: 'mobile_discover_route_open_failed',
          route: route.id,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    },
    []
  );

  const handleOpenArenaProfile = useCallback(
    async (entry: { profileHref?: string; rank: number; displayName: string }) => {
    if (!entry.profileHref) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_arena_profile_missing_url',
        rank: entry.rank,
      });
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(entry.profileHref);
      if (!canOpen) {
        void trackMobileEvent('page_view', {
          reason: 'mobile_arena_profile_unsupported',
          rank: entry.rank,
        });
        return;
      }
      await Linking.openURL(entry.profileHref);
      void trackMobileEvent('page_view', {
        reason: 'mobile_arena_profile_opened',
        rank: entry.rank,
        displayName: entry.displayName,
      });
    } catch (error) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_arena_profile_open_failed',
        rank: entry.rank,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    },
    []
  );

  const handleChangeSettingsIdentity = useCallback(
    (patch: Partial<MobileSettingsIdentityDraft>) => {
      setSettingsIdentityDraft((prev) => ({
        ...prev,
        ...patch,
      }));
      setSettingsSaveState((prev) =>
        prev.status === 'idle' && !prev.message ? prev : { status: 'idle', message: '' }
      );
    },
    []
  );

  const handleSaveSettingsIdentity = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setSettingsSaveState({
        status: 'error',
        message: 'Profil ayarlari icin once giris yap.',
      });
      return;
    }

    const normalizedDraft: MobileSettingsIdentityDraft = {
      ...settingsIdentityDraft,
      fullName: String(settingsIdentityDraft.fullName || '').trim().slice(0, 120),
      username: String(settingsIdentityDraft.username || '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .slice(0, 80),
      birthDate: normalizeDateLabel(settingsIdentityDraft.birthDate),
      bio: String(settingsIdentityDraft.bio || '').trim().slice(0, 180),
      avatarUrl: String(settingsIdentityDraft.avatarUrl || '').trim().slice(0, 1200),
      profileLink: String(settingsIdentityDraft.profileLink || '').trim().slice(0, 280),
    };

    setSettingsSaveState({
      status: 'saving',
      message: 'Profil ayarlari kaydediliyor...',
    });

    try {
      await AsyncStorage.setItem(
        MOBILE_PROFILE_IDENTITY_STORAGE_KEY,
        JSON.stringify(normalizedDraft)
      );
      setSettingsIdentityDraft(normalizedDraft);
      setSettingsSaveState({
        status: 'success',
        message: 'Profil ayarlari kaydedildi.',
      });
      void refreshProfileStats();
    } catch (error) {
      setSettingsSaveState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Profil ayarlari kaydedilemedi.',
      });
    }
  }, [authState.status, refreshProfileStats, settingsIdentityDraft]);

  const handlePickAvatar = useCallback(() => {
    setIsPickingAvatar(true);
    setTimeout(() => {
      setIsPickingAvatar(false);
      setSettingsSaveState({
        status: 'error',
        message: 'Avatar secici bu buildde aktif degil. Sonraki surumde cihaz secimi eklenecek.',
      });
    }, 260);
  }, []);

  const handleClearAvatar = useCallback(() => {
    setSettingsIdentityDraft((prev) => ({
      ...prev,
      avatarUrl: '',
    }));
    setSettingsSaveState((prev) =>
      prev.status === 'idle' && !prev.message ? prev : { status: 'idle', message: '' }
    );
  }, []);

  const handleCopyInviteLink = useCallback(async () => {
    const inviteLink = String(inviteProgram.inviteLink || '').trim();
    if (!inviteLink) {
      setInviteStatus('Kopyalanacak davet linki bulunamadi.');
      return;
    }
    try {
      await Clipboard.setStringAsync(inviteLink);
      setInviteStatus('Davet linki panoya kopyalandi.');
    } catch {
      setInviteStatus('Davet linki kopyalanamadi.');
    }
  }, [inviteProgram.inviteLink]);

  const handleOpenCommentAuthorProfile = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      const profileUrl = buildPublicProfileUrl({
        userId: item.userId,
        username: item.author,
      });
      if (!profileUrl) return;

      try {
        const canOpen = await Linking.canOpenURL(profileUrl);
        if (!canOpen) return;
        await Linking.openURL(profileUrl);
      } catch {
        // ignore link open failures in feed card action
      }
    },
    []
  );

  const handleOpenManualPublicProfile = useCallback(async () => {
    const normalizedUsername = String(publicProfileInput || '').trim();
    const publicProfileUrl = buildPublicProfileUrl({ username: normalizedUsername });
    if (!publicProfileUrl) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_manual_profile_missing_url',
      });
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(publicProfileUrl);
      if (!canOpen) {
        void trackMobileEvent('page_view', {
          reason: 'mobile_manual_profile_unsupported',
          username: normalizedUsername,
        });
        return;
      }
      await Linking.openURL(publicProfileUrl);
      void trackMobileEvent('page_view', {
        reason: 'mobile_manual_profile_opened',
        username: normalizedUsername,
      });
    } catch (error) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_manual_profile_open_failed',
        username: normalizedUsername,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }, [publicProfileInput]);

  const handleOpenProfileLink = useCallback(async () => {
    const targetUrl = normalizeExternalUrl(settingsIdentityDraft.profileLink);
    if (!targetUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (!canOpen) return;
      await Linking.openURL(targetUrl);
    } catch {
      // ignore link open failures in profile link action
    }
  }, [settingsIdentityDraft.profileLink]);

  const handleOpenDailyFromExplore = useCallback(() => {
    setManualIntent({ target: 'daily' });
    if (tabNavigationRef.isReady()) {
      tabNavigationRef.navigate(MAIN_TAB_BY_KEY.daily);
    }
    void trackMobileEvent('page_view', {
      reason: 'mobile_explore_jump_to_daily',
    });
  }, [setManualIntent]);

  const handleClaimInvite = useCallback(async (rawInviteCode: string) => {
    const inviteCodeText = String(rawInviteCode || '').trim().toUpperCase();
    if (!inviteCodeText) {
      setInviteClaimState({
        status: 'error',
        inviteCode: '',
        errorCode: 'INVALID_CODE',
        message: inviteMessageByCode.INVALID_CODE,
      });
      return;
    }

    setInviteClaimState({
      status: 'loading',
      inviteCode: inviteCodeText,
    });

    try {
      const result = await claimInviteCodeViaApi(inviteCodeText);
      if (result.ok && result.data) {
        const inviteeRewardXp = Math.max(0, Number(result.data.inviteeRewardXp || 0));
        const inviterRewardXp = Math.max(0, Number(result.data.inviterRewardXp || 0));
        const claimCount = Math.max(0, Number(result.data.claimCount || 0));

        setInviteClaimState({
          status: 'success',
          inviteCode: inviteCodeText,
          message: `Davet kodu uygulandi. +${inviteeRewardXp} XP kazandin.`,
          inviteeRewardXp,
          inviterRewardXp,
          claimCount,
        });

        void trackMobileEvent('invite_accepted', {
          inviteCode: inviteCodeText,
          inviteeRewardXp,
          inviterRewardGranted: inviterRewardXp > 0,
          inviterRewardXp,
        });

        void trackMobileEvent('invite_reward_granted', {
          role: 'invitee',
          inviteCode: inviteCodeText,
          rewardXp: inviteeRewardXp,
        });

        if (inviterRewardXp > 0) {
          void trackMobileEvent('invite_reward_granted', {
            role: 'inviter',
            inviteCode: inviteCodeText,
            rewardXp: inviterRewardXp,
            inviterUserId: result.data.inviterUserId || null,
          });
        }

        return;
      }

      const errorCode = result.errorCode || 'SERVER_ERROR';
      const failureReason = inviteFailureReasonByCode[errorCode] || 'api_claim_rejected';
      const message =
        inviteMessageByCode[errorCode] || result.message || inviteMessageByCode.SERVER_ERROR;

      setInviteClaimState({
        status: 'error',
        inviteCode: inviteCodeText,
        errorCode,
        message,
      });

      void trackMobileEvent('invite_claim_failed', {
        reason: failureReason,
        inviteCode: inviteCodeText,
        errorCode,
        apiMessage: result.message || null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invite claim exception';
      setInviteClaimState({
        status: 'error',
        inviteCode: inviteCodeText,
        errorCode: 'SERVER_ERROR',
        message: `${inviteMessageByCode.SERVER_ERROR} (${errorMessage})`,
      });
      void trackMobileEvent('invite_claim_failed', {
        reason: 'client_exception',
        inviteCode: inviteCodeText,
        errorCode: 'SERVER_ERROR',
        apiMessage: errorMessage,
      });
    }
  }, []);

  const handleApplyInviteCodeFromSettings = useCallback(async () => {
    const inviteCodeText = String(inviteCodeDraft || '').trim().toUpperCase();
    if (!inviteCodeText) {
      setInviteStatus('Davet kodu gir.');
      return;
    }

    setIsInviteActionBusy(true);
    setInviteStatus('Kod uygulaniyor...');

    try {
      const result = await claimInviteCodeViaApi(inviteCodeText);
      if (result.ok && result.data) {
        const inviteeRewardXp = Math.max(0, Number(result.data.inviteeRewardXp || 0));
        const inviterRewardXp = Math.max(0, Number(result.data.inviterRewardXp || 0));
        const claimCount = Math.max(0, Number(result.data.claimCount || 0));
        setInviteClaimState({
          status: 'success',
          inviteCode: inviteCodeText,
          message: `Davet kodu uygulandi. +${inviteeRewardXp} XP kazandin.`,
          inviteeRewardXp,
          inviterRewardXp,
          claimCount,
        });
        setInviteStatus(`Kod uygulandi. +${inviteeRewardXp} XP`);
        setInviteCodeDraft('');
        void refreshProfileStats();
      } else {
        const message = result.message || 'Davet kodu uygulanamadi.';
        setInviteClaimState({
          status: 'error',
          inviteCode: inviteCodeText,
          errorCode: result.errorCode || 'SERVER_ERROR',
          message,
        });
        setInviteStatus(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Davet kodu uygulanamadi.';
      setInviteClaimState({
        status: 'error',
        inviteCode: inviteCodeText,
        errorCode: 'SERVER_ERROR',
        message,
      });
      setInviteStatus(message);
    } finally {
      setIsInviteActionBusy(false);
    }
  }, [inviteCodeDraft, refreshProfileStats]);

  const refreshInviteProgram = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setInviteProgram({
        code: '',
        inviteLink: '',
        claimCount: 0,
      });
      return;
    }

    setIsInviteActionBusy(true);
    try {
      const signedInEmail = authState.status === 'signed_in' ? authState.email : '';
      const seed = signedInEmail || `mobile-${Date.now().toString(36)}`;
      const result = await ensureInviteCodeViaApi(seed);
      if (result.ok && result.data) {
        setInviteProgram({
          code: String(result.data.code || '').trim(),
          inviteLink: String(result.data.inviteLink || '').trim(),
          claimCount: Math.max(0, Number(result.data.claimCount || 0)),
        });
        return;
      }

      setInviteProgram({
        code: '',
        inviteLink: '',
        claimCount: 0,
      });
      setInviteStatus(result.message || 'Davet kodu hazirlanamadi.');
    } catch {
      setInviteProgram({
        code: '',
        inviteLink: '',
        claimCount: 0,
      });
      setInviteStatus('Davet kodu hazirlanamadi.');
    } finally {
      setIsInviteActionBusy(false);
    }
  }, [authState]);

  useEffect(() => {
    if (!settingsVisible) return;
    if (authState.status !== 'signed_in') return;
    if (inviteProgram.code) return;
    void refreshInviteProgram();
  }, [authState.status, inviteProgram.code, refreshInviteProgram, settingsVisible]);

  const renderHeroCard = (tabLabel: string) => (
    <View style={styles.heroCard}>
      <View style={styles.heroAccent} />
      <View style={styles.heroTicketRow}>
        <View style={styles.heroTicketDotSage} />
        <View style={styles.heroTicketDotClay} />
        <View style={styles.heroTicketDash} />
      </View>
      <Text style={styles.heroEyebrow}>Absolute Cinema</Text>
      <Text style={styles.title}>180 Absolute Cinema</Text>
      <Text style={styles.subtitle}>Gunluk secim, ritual notu ve sosyal akis tek yerde.</Text>
      <View style={styles.heroMetaRow}>
        <Text style={styles.heroBadgeMuted}>
          {isSignedIn ? 'Oturum: hazir' : 'Oturum: gerekli'}
        </Text>
        {isDevSurfaceEnabled ? (
          <>
            <Text style={styles.heroBadge}>Screen: {screenPlan.screen}</Text>
            <Text style={styles.heroBadge}>Tab: {tabLabel}</Text>
            <Text style={styles.heroBadgeNeutral}>{MOBILE_UI_PACKAGE_LABEL}</Text>
          </>
        ) : null}
      </View>
      {isDevSurfaceEnabled ? (
        <>
          <View style={styles.statusRail}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillKey}>Auth</Text>
              <Text
                style={[
                  styles.statusPillValue,
                  isSignedIn ? styles.statusPillValueSage : styles.statusPillValueClay,
                ]}
              >
                {authSummary}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillKey}>Push</Text>
              <Text
                style={[
                  styles.statusPillValue,
                  pushState.cloudStatus === 'synced'
                    ? styles.statusPillValueSage
                    : pushState.cloudStatus === 'error'
                      ? styles.statusPillValueClay
                      : styles.statusPillValue,
                ]}
              >
                {pushSummary}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillKey}>Daily</Text>
              <Text
                style={[
                  styles.statusPillValue,
                  dailyState.status === 'success'
                    ? styles.statusPillValueSage
                    : dailyState.status === 'error'
                      ? styles.statusPillValueClay
                      : styles.statusPillValue,
                ]}
              >
                {dailySummary}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillKey}>Inbox</Text>
              <Text style={styles.statusPillValue}>{inboxSummary}</Text>
            </View>
          </View>
          <View style={styles.opsSummaryRow}>
            <View style={styles.opsSummaryCard}>
              <Text style={styles.opsSummaryKey}>Unread Links</Text>
              <Text
                style={[
                  styles.opsSummaryValue,
                  unreadDeepLinkCount > 0
                    ? styles.statusPillValueClay
                    : styles.statusPillValueSage,
                ]}
              >
                {unreadDeepLinkCount}
              </Text>
            </View>
            <View style={styles.opsSummaryCard}>
              <Text style={styles.opsSummaryKey}>Queue Pending</Text>
              <Text
                style={[
                  styles.opsSummaryValue,
                  pendingQueueCount > 0
                    ? styles.statusPillValueClay
                    : styles.statusPillValueSage,
                ]}
              >
                {pendingQueueCount}
              </Text>
            </View>
            <View style={styles.opsSummaryCard}>
              <Text style={styles.opsSummaryKey}>Streak</Text>
              <Text style={styles.opsSummaryValue}>{streakSummary}</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
  const renderSurfaceIntro = ({
    title,
    body,
    tone = 'sage',
    badges,
  }: {
    title: string;
    body: string;
    tone?: 'sage' | 'clay';
    badges: Array<{ label: string; muted?: boolean }>;
  }) => (
    <View style={styles.surfaceIntroCard}>
      <View
        style={[
          styles.surfaceIntroAccent,
          tone === 'clay' ? styles.surfaceIntroAccentClay : styles.surfaceIntroAccentSage,
        ]}
      />
      <Text style={styles.surfaceIntroTitle}>{title}</Text>
      <Text style={styles.surfaceIntroBody}>{body}</Text>
      <View style={styles.surfaceIntroMetaRow}>
        {badges.map((badge, index) => (
          <Text
            key={`${title}-${index}`}
            style={badge.muted ? styles.surfaceIntroBadgeMuted : styles.surfaceIntroBadge}
          >
            {badge.label}
          </Text>
        ))}
      </View>
    </View>
  );

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, isDawnTheme ? styles.safeAreaDawn : null]}>
          <StatusBar style={isDawnTheme ? 'dark' : 'light'} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, isDawnTheme ? styles.safeAreaDawn : null]}>
        <View
          pointerEvents="none"
          style={[styles.backdropLayer, isDawnTheme ? styles.backdropLayerDawn : null]}
        />
        <Animated.View
          style={[
            styles.pageMotion,
            {
              opacity: pageEntrance,
              transform: [{ translateY: pageEnterTranslateY }],
            },
          ]}
        >
          <NavigationContainer
            ref={tabNavigationRef}
            theme={tabTheme}
            onReady={handleTabNavigationReady}
            onStateChange={handleTabNavigationStateChange}
          >
            <Tab.Navigator
              initialRouteName={MAIN_TAB_BY_KEY.daily}
              screenOptions={({ route }) => ({
                headerShown: false,
                sceneStyle: [styles.navScene, isDawnTheme ? styles.navSceneDawn : null],
                tabBarStyle: [styles.navTabBar, isDawnTheme ? styles.navTabBarDawn : null],
                tabBarItemStyle: styles.navTabItem,
                tabBarShowLabel: false,
                tabBarActiveTintColor: isDawnTheme ? '#A57164' : '#8A9A5B',
                tabBarInactiveTintColor: isDawnTheme ? '#6f665c' : '#8e8b84',
                tabBarBadgeStyle: styles.navTabBadge,
                tabBarBadge: route.name === MAIN_TAB_BY_KEY.inbox ? inboxTabBadge : undefined,
                tabBarIcon: ({ color, focused, size }) => (
                  <Ionicons
                    name={
                      focused
                        ? TAB_ICON_BY_ROUTE[route.name].active
                        : TAB_ICON_BY_ROUTE[route.name].inactive
                    }
                    size={size}
                    color={color}
                  />
                ),
              })}
            >
              <Tab.Screen name={MAIN_TAB_BY_KEY.daily}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {renderHeroCard('Daily')}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Gunluk Akis</Text>
                        <Text style={styles.sectionHeaderMeta}>Gunluk</Text>
                      </View>
                    </View>

                    <DailyHomeScreen
                      state={dailyState}
                      showOpsMeta={isDevSurfaceEnabled}
                      onRetry={() => {
                        void loadDailyMovies();
                      }}
                    />
                    <RitualDraftCard
                      targetMovie={primaryDailyMovie}
                      draftText={ritualDraftText}
                      onDraftTextChange={(value) => {
                        setRitualDraftText(value);
                        if (ritualSubmitState.status !== 'idle') {
                          setRitualSubmitState({
                            status: 'idle',
                            message: '',
                          });
                        }
                        if (ritualQueueState.status === 'done') {
                          setRitualQueueState((prev) => ({
                            ...prev,
                            status: 'idle',
                            message: '',
                          }));
                        }
                      }}
                      submitState={ritualSubmitState}
                      queueState={ritualQueueState}
                      canSubmit={canSubmitRitualDraft}
                      isSignedIn={isSignedIn}
                      onSubmit={handleSubmitRitualDraft}
                      onFlushQueue={handleFlushRitualQueue}
                    />

                    {isDevSurfaceEnabled ? (
                      <>
                        <View style={styles.actionsRow}>
                          <UiButton
                            label="Daily"
                            tone={screenPlan.screen === 'daily_home' ? 'brand' : 'neutral'}
                            stretch
                            onPress={() => setManualIntent({ target: 'daily' })}
                          />
                          <UiButton
                            label="Invite"
                            tone={screenPlan.screen === 'invite_claim' ? 'teal' : 'neutral'}
                            stretch
                            onPress={() => setManualIntent({ target: 'invite', invite: 'ABC12345' })}
                          />
                          <UiButton
                            label="Share"
                            tone={screenPlan.screen === 'share_hub' ? 'teal' : 'neutral'}
                            stretch
                            onPress={() =>
                              setManualIntent({
                                target: 'share',
                                invite: 'ABC12345',
                                platform: 'x',
                                goal: 'streak',
                              })
                            }
                          />
                        </View>
                        <Text style={styles.actionsHint}>Aktif route: {activeRouteLabel}</Text>
                      </>
                    ) : null}
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.explore}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {isDevSurfaceEnabled
                      ? renderSurfaceIntro({
                          title: 'Kesif ve Arena',
                          body: 'Webdeki kesif, arena leaderboard ve public profile gecisleri mobile tasindi.',
                          badges: [
                            { label: `${DISCOVER_ROUTES.length} kesif rotasi` },
                            { label: `${commentFeedSummary}` },
                            { label: 'Arena + Profile + Kurallar', muted: true },
                          ],
                        })
                      : null}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Kesif</Text>
                        <Text style={styles.sectionHeaderMeta}>Web parity</Text>
                      </View>
                    </View>
                    <DiscoverRoutesCard
                      routes={DISCOVER_ROUTES}
                      onOpenRoute={(route) => {
                        void handleOpenDiscoverRoute(route);
                      }}
                    />
                    <ArenaChallengeCard
                      streakLabel={streakSummary}
                      ritualsLabel={ritualsCountSummary}
                      onOpenDaily={handleOpenDailyFromExplore}
                    />
                    <ArenaLeaderboardCard
                      state={arenaState}
                      onRefresh={() => {
                        void refreshArenaLeaderboard();
                      }}
                      onOpenProfile={(item) => {
                        void handleOpenArenaProfile(item);
                      }}
                    />
                    <CommentFeedCard
                      state={commentFeedState}
                      showFilters
                      showOpsMeta={isDevSurfaceEnabled}
                      onScopeChange={handleCommentFeedScopeChange}
                      onSortChange={handleCommentFeedSortChange}
                      onQueryChange={handleCommentFeedQueryChange}
                      onOpenAuthorProfile={handleOpenCommentAuthorProfile}
                      onRefresh={() => {
                        void refreshCommentFeed(
                          commentFeedScope,
                          debouncedCommentFeedQuery,
                          commentFeedSort
                        );
                      }}
                    />
                    {isDevSurfaceEnabled ? (
                      <>
                        <PublicProfileBridgeCard
                          profileInput={publicProfileInput}
                          onProfileInputChange={setPublicProfileInput}
                          onOpenProfile={() => {
                            void handleOpenManualPublicProfile();
                          }}
                          canOpenProfile={canOpenManualProfile}
                          hasWebBase={Boolean(MOBILE_WEB_BASE_URL)}
                        />
                        <PlatformRulesCard />
                      </>
                    ) : null}
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.inbox}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {isDevSurfaceEnabled
                      ? renderSurfaceIntro({
                          title: 'Bildirim Kutusu',
                          body: 'Yeni bildirimleri izle, filtrele ve tek tikla ilgili akisa gec.',
                          badges: [
                            { label: `${unreadDeepLinkCount} yeni link` },
                            { label: `${pushInboxState.items.length} toplam`, muted: true },
                          ],
                        })
                      : null}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Kutu</Text>
                        <Text style={styles.sectionHeaderMeta}>{unreadDeepLinkCount} yeni link</Text>
                      </View>
                    </View>
                    <PushInboxCard
                      state={pushInboxState}
                      showOpsMeta={isDevSurfaceEnabled}
                      onClear={() => {
                        void handleClearPushInbox();
                      }}
                      onPressItem={(item) => {
                        void handlePressPushInboxItem(item);
                      }}
                      onOpenDeepLink={(item) => {
                        void handleOpenInboxDeepLink(item);
                      }}
                    />
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.marks}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {isDevSurfaceEnabled
                      ? renderSurfaceIntro({
                          title: 'Marklar ve Arena',
                          body: 'Rozet arsivi ve arena siralamasina tek sekmeden ulas.',
                          badges: [
                            { label: `Seri ${streakSummary}` },
                            { label: `Ritual ${ritualsCountSummary}` },
                          ],
                        })
                      : null}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Marklar</Text>
                        <Text style={styles.sectionHeaderMeta}>Arena + Koleksiyon</Text>
                      </View>
                    </View>
                    <ArenaLeaderboardCard
                      state={arenaState}
                      onRefresh={() => {
                        void refreshArenaLeaderboard();
                      }}
                      onOpenProfile={(item) => {
                        void handleOpenArenaProfile(item);
                      }}
                    />
                    <ProfileMarksCard state={profileState} isSignedIn={isSignedIn} />
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.profile}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {isDevSurfaceEnabled
                      ? renderSurfaceIntro({
                          title: 'Profil ve Hesap',
                          body: 'Seri, XP metrikleri ile hesap yonetimini tek noktadan yap.',
                          badges: [
                            { label: `Seri ${streakSummary}` },
                            { label: `Tema ${themeModeLabel}` },
                            {
                              label: isSignedIn ? 'Oturum hazir' : 'Oturum gerekli',
                              muted: !isSignedIn,
                            },
                          ],
                        })
                      : null}
                    <View style={styles.card}>
                      <View style={styles.profileHeroRow}>
                        <View style={styles.profileHeroAvatarWrap}>
                          {profileAvatarUrl ? (
                            <Image
                              source={{ uri: profileAvatarUrl }}
                              style={styles.profileHeroAvatarImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.profileHeroAvatarFallback}>
                              {(profileDisplayName.slice(0, 1) || 'O').toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.profileHeroContent}>
                          <Text style={[styles.cardTitle, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileDisplayName || 'Observer'}
                          </Text>
                          {profileUsername ? (
                            <Text style={[styles.screenMeta, isDawnTheme ? styles.dawnTextMuted : null]}>
                              @{profileUsername}
                            </Text>
                          ) : null}
                          {profileBirthDateLabel ? (
                            <Text style={[styles.screenMeta, isDawnTheme ? styles.dawnTextMuted : null]}>
                              Dogum: {profileBirthDateLabel}
                            </Text>
                          ) : null}
                        </View>
                        <Pressable
                          style={styles.profileSettingsButton}
                          onPress={() => setSettingsVisible(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Ayarlar ekranini ac"
                        >
                          <Ionicons
                            name="settings-outline"
                            size={20}
                            color={isDawnTheme ? '#A45E4A' : '#E5E4E2'}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.profileGrid}>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.rituals}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Izlenen
                          </Text>
                        </View>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.streak}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Streak
                          </Text>
                        </View>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.marks}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Mark
                          </Text>
                        </View>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.followers}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Takipci
                          </Text>
                        </View>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.following}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Takip
                          </Text>
                        </View>
                        <View style={styles.profileMetricCard}>
                          <Text style={[styles.profileMetricValue, isDawnTheme ? styles.dawnTextColor : null]}>
                            {profileStats.days}
                          </Text>
                          <Text style={[styles.profileMetricLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                            Gun
                          </Text>
                        </View>
                      </View>

                      <View style={styles.profileAboutBox}>
                        <Text style={[styles.subSectionLabel, isDawnTheme ? styles.dawnTextMuted : null]}>
                          Hakkinda
                        </Text>
                        <Text style={[styles.screenBody, isDawnTheme ? styles.dawnTextColor : null]}>
                          {profileBio || 'Profilini ayarlardan duzenleyebilirsin.'}
                        </Text>
                        <Text style={[styles.screenMeta, isDawnTheme ? styles.dawnTextMuted : null]}>
                          Takip: {profileStats.following} | Takipci: {profileStats.followers}
                        </Text>
                        {profileLink ? (
                          <Pressable onPress={() => void handleOpenProfileLink()} hitSlop={8}>
                            <Text style={[styles.profileLinkText, isDawnTheme ? styles.dawnLinkText : null]}>
                              {profileLink}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.card}>
                      <Text style={[styles.cardTitle, isDawnTheme ? styles.dawnTextColor : null]}>
                        Tur Dagilimi
                      </Text>
                      {profileGenreDistribution.length > 0 ? (
                        <View style={styles.profileGenreList}>
                          {profileGenreDistribution.map((item) => (
                            <View key={`${item.genre}-${item.count}`} style={styles.profileGenreRow}>
                              <Text
                                style={[styles.profileGenreLabel, isDawnTheme ? styles.dawnTextColor : null]}
                              >
                                {item.genre}
                              </Text>
                              <Text
                                style={[styles.profileGenreValue, isDawnTheme ? styles.dawnTextMuted : null]}
                              >
                                x{item.count}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.screenMeta, isDawnTheme ? styles.dawnTextMuted : null]}>
                          Tur dagilimi verisi ritual kayitlari geldikce olusur.
                        </Text>
                      )}
                      <Pressable
                        style={styles.retryButton}
                        onPress={() => {
                          void refreshProfileGenreDistribution();
                        }}
                        disabled={!isSignedIn}
                        hitSlop={8}
                      >
                        <Text style={styles.retryText}>Tur Dagilimini Yenile</Text>
                      </Pressable>
                    </View>

                    <ProfileMarksCard state={profileState} isSignedIn={isSignedIn} />
                    {!isSignedIn ? (
                      <AuthCard
                        authState={authState}
                        email={authEmail}
                        password={authPassword}
                        onEmailChange={setAuthEmail}
                        onPasswordChange={setAuthPassword}
                        onSignIn={handleSignIn}
                        onSignOut={handleSignOut}
                      />
                    ) : null}
                    {screenPlan.screen === 'invite_claim' ? (
                      <InviteClaimScreen
                        inviteCode={inviteCode}
                        claimState={inviteClaimState}
                        onClaim={handleClaimInvite}
                      />
                    ) : null}
                    {screenPlan.screen === 'share_hub' ? (
                      <ShareHubScreen
                        inviteCode={inviteCode}
                        platform={sharePlatform}
                        goal={shareGoal}
                      />
                    ) : null}

                    {isDevSurfaceEnabled ? (
                      <>
                        <View style={styles.card}>
                          <Text style={styles.cardTitle}>Release Snapshot</Text>
                          <Text style={styles.screenMeta}>Push permission: {pushState.permissionStatus}</Text>
                          <Text style={styles.screenMeta}>Push cloud: {pushState.cloudStatus}</Text>
                          <Text style={styles.screenMeta}>Pending queue: {pendingQueueCount}</Text>
                        </View>
                        <PushStatusCard
                          pushEnabled={PUSH_FEATURE_ENABLED}
                          state={pushState}
                          testState={pushTestState}
                          localSimState={localPushSimState}
                          isSignedIn={isSignedIn}
                          onRegister={() => {
                            void refreshPushRegistration();
                          }}
                          onSendTest={() => {
                            void handleSendPushTest();
                          }}
                          onSimulateLocal={() => {
                            void handleSimulateLocalPush();
                          }}
                        />
                        <View style={styles.singleActionRow}>
                          <UiButton
                            label={debugExpanded ? 'Debug Detaylarini Gizle' : 'Debug Detaylarini Goster'}
                            tone="neutral"
                            stretch
                            onPress={() => setDebugExpanded((prev) => !prev)}
                          />
                        </View>
                        {debugExpanded ? (
                          <>
                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>Active Screen Plan</Text>
                              <Text style={styles.code}>{JSON.stringify(screenPlan, null, 2)}</Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>Generated Deep Link</Text>
                              <Text selectable style={styles.code}>
                                {deepLink}
                              </Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>Last Incoming URL</Text>
                              <Text selectable style={styles.code}>
                                {lastIncomingUrl || '(none yet)'}
                              </Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>Last Incoming Intent</Text>
                              <Text style={styles.code}>
                                {lastIncomingIntent
                                  ? JSON.stringify(lastIncomingIntent, null, 2)
                                  : '(none yet)'}
                              </Text>
                            </View>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </ScrollView>
                )}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>

          <MobileSettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            identityDraft={settingsIdentityDraft}
            onChangeIdentity={handleChangeSettingsIdentity}
            onSaveIdentity={handleSaveSettingsIdentity}
            saveState={settingsSaveState}
            themeMode={themeMode}
            onSetThemeMode={handleSetThemeMode}
            language={settingsLanguage}
            onSetLanguage={setSettingsLanguage}
            onPickAvatar={handlePickAvatar}
            onClearAvatar={handleClearAvatar}
            isPickingAvatar={isPickingAvatar}
            activeAccountLabel={activeAccountLabel}
            activeEmailLabel={activeEmailLabel}
            inviteCode={inviteProgram.code}
            inviteLink={inviteProgram.inviteLink}
            inviteStatsLabel={inviteStatsLabel}
            inviteRewardLabel={inviteRewardLabel}
            invitedByCode={inviteClaimState.status === 'success' ? inviteClaimState.inviteCode : null}
            inviteCodeDraft={inviteCodeDraft}
            onInviteCodeDraftChange={setInviteCodeDraft}
            onApplyInviteCode={() => {
              void handleApplyInviteCodeFromSettings();
            }}
            onCopyInviteLink={() => {
              void handleCopyInviteLink();
            }}
            inviteStatus={inviteStatus}
            isInviteActionBusy={isInviteActionBusy}
            canCopyInviteLink={Boolean(inviteProgram.inviteLink)}
            isSignedIn={isSignedIn}
            onSignOut={() => {
              void handleSignOut();
            }}
          />
        </Animated.View>
        <StatusBar style={isDawnTheme ? 'dark' : 'light'} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

