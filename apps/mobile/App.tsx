import { StatusBar } from 'expo-status-bar';
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
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
  Animated,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
  markPushInboxItemsOpened,
  readPushInbox,
  removePushInboxItems,
  type PushInboxItem,
} from './src/lib/mobilePushInbox';
import { sendPushTestNotification } from './src/lib/mobilePushApi';
import { syncPushTokenToProfileState } from './src/lib/mobilePushProfileSync';
import { claimInviteCodeViaApi } from './src/lib/mobileReferralApi';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { UiButton } from './src/ui/primitives';
import { styles } from './src/ui/appStyles';
import {
  type AuthState,
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
  DailyHomeScreen,
  DiscoverRoutesCard,
  InviteClaimScreen,
  PlatformRulesCard,
  PublicProfileBridgeCard,
  ProfileSnapshotCard,
  PushInboxCard,
  PushStatusCard,
  RitualDraftCard,
  ShareHubScreen,
} from './src/ui/appScreens';

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

const normalizeBaseUrl = (value: string | undefined): string => String(value || '').trim().replace(/\/+$/, '');

const deriveOriginFromEndpoint = (value: string | undefined, marker: string): string => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return '';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) return '';
  return normalized.slice(0, markerIndex).replace(/\/+$/, '');
};

const resolveMobileWebBaseUrl = (): string => {
  const explicitWebBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_WEB_APP_URL);
  if (explicitWebBase) return explicitWebBase;

  const referralBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_REFERRAL_API_BASE);
  if (referralBase) return referralBase;

  const analyticsBase = deriveOriginFromEndpoint(
    process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT,
    '/api/analytics'
  );
  if (analyticsBase) return analyticsBase;

  const dailyBase = deriveOriginFromEndpoint(process.env.EXPO_PUBLIC_DAILY_API_URL, '/api/daily');
  if (dailyBase) return dailyBase;

  return '';
};

const MOBILE_WEB_BASE_URL = resolveMobileWebBaseUrl();

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
  Profile: undefined;
  Account: undefined;
};
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MAIN_TAB_BY_KEY = {
  daily: 'Daily',
  explore: 'Explore',
  inbox: 'Inbox',
  profile: 'Profile',
  account: 'Account',
} as const satisfies Record<'daily' | 'explore' | 'inbox' | 'profile' | 'account', keyof MainTabParamList>;

const MAIN_KEY_BY_TAB = {
  Daily: 'daily',
  Explore: 'explore',
  Inbox: 'inbox',
  Profile: 'profile',
  Account: 'account',
} as const satisfies Record<
  keyof MainTabParamList,
  'daily' | 'explore' | 'inbox' | 'profile' | 'account'
>;

const MAIN_TAB_BY_SCREEN = {
  daily_home: 'Daily',
  invite_claim: 'Account',
  share_hub: 'Account',
} as const satisfies Record<'daily_home' | 'invite_claim' | 'share_hub', keyof MainTabParamList>;
const TAB_ICON_BY_ROUTE = {
  Daily: { active: 'today', inactive: 'today-outline' },
  Explore: { active: 'compass', inactive: 'compass-outline' },
  Inbox: { active: 'mail', inactive: 'mail-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
  Account: { active: 'settings', inactive: 'settings-outline' },
} as const satisfies Record<keyof MainTabParamList, { active: IoniconName; inactive: IoniconName }>;
const TAB_LABEL_BY_ROUTE = {
  Daily: 'Gunluk',
  Explore: 'Kesif',
  Inbox: 'Kutu',
  Profile: 'Profil',
  Account: 'Hesap',
} as const satisfies Record<keyof MainTabParamList, string>;

const TAB_THEME: NavigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: '#121212',
    card: '#171717',
    text: '#E5E4E2',
    border: 'rgba(255, 255, 255, 0.12)',
    primary: '#8A9A5B',
    notification: '#A57164',
  },
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
  type MainTabKey = 'daily' | 'explore' | 'inbox' | 'profile' | 'account';
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
    });
  }, []);

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

  const handleMarkPushInboxScopeOpened = useCallback(async (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    setPushInboxState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Secili inbox kayitlari opened yapiliyor...',
    }));
    const result = await markPushInboxItemsOpened(ids);
    setPushInboxState({
      status: 'ready',
      message:
        result.updatedCount > 0
          ? `${result.updatedCount} inbox kaydi opened olarak isaretlendi.`
          : 'Secili kayitlarda guncellenecek bir durum yok.',
      items: result.items,
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_inbox_bulk_opened',
      updatedCount: result.updatedCount,
      targetCount: ids.length,
    });
  }, []);

  const handleRemovePushInboxScope = useCallback(async (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    setPushInboxState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Secili inbox kayitlari temizleniyor...',
    }));
    const result = await removePushInboxItems(ids);
    setPushInboxState({
      status: 'ready',
      message:
        result.removedCount > 0
          ? `${result.removedCount} inbox kaydi temizlendi.`
          : 'Secili filtrede silinecek kayit bulunamadi.',
      items: result.items,
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_inbox_bulk_removed',
      removedCount: result.removedCount,
      targetCount: ids.length,
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

  useEffect(() => {
    void trackMobileEvent('session_start', {
      platform: Platform.OS,
      appSurface: 'mobile_native',
    });
  }, []);

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
  const accountRouteLabel = isInviteRouteActive
    ? 'Davet'
    : isShareRouteActive
      ? 'Paylas'
      : 'Oturum';
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
  const profileSourceLabel =
    profileState.status === 'success'
      ? profileState.source === 'xp_state'
        ? 'Canli'
        : 'Yedek'
      : 'Hazir degil';
  const canOpenManualProfile = Boolean(String(publicProfileInput || '').trim() && MOBILE_WEB_BASE_URL);
  const inboxTabBadge =
    unreadDeepLinkCount > 0 ? (unreadDeepLinkCount > 9 ? '9+' : unreadDeepLinkCount) : undefined;

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

  const handleOpenArenaProfile = useCallback(async (entry: ArenaEntryView) => {
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
  }, []);

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
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.backdropLayer}>
          <View style={styles.backdropBandTop} />
          <View style={styles.backdropBandBottom} />
          <View style={styles.backdropRuleVerticalA} />
          <View style={styles.backdropRuleVerticalB} />
          <View style={styles.backdropRuleHorizontalA} />
          <View style={styles.backdropRuleHorizontalB} />
        </View>
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
            theme={TAB_THEME}
            onReady={handleTabNavigationReady}
            onStateChange={handleTabNavigationStateChange}
          >
            <Tab.Navigator
              initialRouteName={MAIN_TAB_BY_KEY.daily}
              screenOptions={({ route }) => ({
                headerShown: false,
                sceneStyle: styles.navScene,
                tabBarStyle: styles.navTabBar,
                tabBarItemStyle: styles.navTabItem,
                tabBarLabelStyle: styles.navTabLabel,
                tabBarLabel: TAB_LABEL_BY_ROUTE[route.name],
                tabBarActiveTintColor: '#8A9A5B',
                tabBarInactiveTintColor: '#8e8b84',
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
                      primaryMovie={primaryDailyMovie}
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
                    {renderSurfaceIntro({
                      title: 'Kesif ve Arena',
                      body: 'Webdeki kesif, arena leaderboard ve public profile gecisleri mobile tasindi.',
                      badges: [
                        { label: `${DISCOVER_ROUTES.length} kesif rotasi` },
                        { label: 'Arena + Profile + Kurallar', muted: true },
                      ],
                    })}
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
                    {renderSurfaceIntro({
                      title: 'Bildirim Kutusu',
                      body: 'Yeni bildirimleri izle, filtrele ve tek tikla ilgili akisa gec.',
                      badges: [
                        { label: `${unreadDeepLinkCount} yeni link` },
                        { label: `${pushInboxState.items.length} toplam`, muted: true },
                      ],
                    })}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Kutu</Text>
                        <Text style={styles.sectionHeaderMeta}>{unreadDeepLinkCount} yeni link</Text>
                      </View>
                    </View>
                    <PushInboxCard
                      state={pushInboxState}
                      showOpsMeta={isDevSurfaceEnabled}
                      onReload={() => {
                        void refreshPushInbox();
                      }}
                      onClear={() => {
                        void handleClearPushInbox();
                      }}
                      onOpenDeepLink={(item) => {
                        void handleOpenInboxDeepLink(item);
                      }}
                      onMarkScopeOpened={(ids) => {
                        void handleMarkPushInboxScopeOpened(ids);
                      }}
                      onRemoveScope={(ids) => {
                        void handleRemovePushInboxScope(ids);
                      }}
                    />
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
                    {renderSurfaceIntro({
                      title: 'Profil Ozeti',
                      body: 'Seri, XP ve sosyal metrikleri tek bakista takip et.',
                      badges: [
                        { label: `Seri ${streakSummary}` },
                        { label: `Kaynak ${profileSourceLabel}`, muted: true },
                      ],
                    })}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Profil</Text>
                        <Text style={styles.sectionHeaderMeta}>Seri {streakSummary}</Text>
                      </View>
                    </View>
                    <ProfileSnapshotCard
                      state={profileState}
                      isSignedIn={isSignedIn}
                      onRefresh={() => {
                        void refreshProfileStats();
                      }}
                    />
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.account}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    {renderSurfaceIntro({
                      title: 'Hesap ve Oturum',
                      body: 'Oturumu yonet ve gelen davet/paylasim akislarini bu sekmeden tamamla.',
                      tone: 'clay',
                      badges: [
                        { label: isSignedIn ? 'Oturum hazir' : 'Oturum gerekli' },
                        { label: `Akis ${accountRouteLabel}`, muted: true },
                      ],
                    })}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Hesap</Text>
                        <Text style={styles.sectionHeaderMeta}>{accountRouteLabel}</Text>
                      </View>
                    </View>
                    <AuthCard
                      authState={authState}
                      email={authEmail}
                      password={authPassword}
                      onEmailChange={setAuthEmail}
                      onPasswordChange={setAuthPassword}
                      onSignIn={handleSignIn}
                      onSignOut={handleSignOut}
                    />
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
        </Animated.View>
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

