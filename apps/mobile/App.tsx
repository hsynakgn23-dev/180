import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as AppleAuthentication from 'expo-apple-authentication';
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
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  Share,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendMobileDeepLinkParams, buildMobileDeepLinkFromRouteIntent } from '../../packages/shared/src/mobile';
import { fetchDailyMovies } from './src/lib/dailyApi';
import { useMobileRouteIntent } from './src/hooks/useMobileRouteIntent';
import { usePageEntranceAnimation } from './src/hooks/usePageEntranceAnimation';
import { trackMobileEvent } from './src/lib/mobileAnalytics';
import { fetchMobileArenaSnapshot, type MobileArenaEntry } from './src/lib/mobileArenaSnapshot';
import { resolveUserIdsByAuthorNames, toAuthorIdentityKey } from './src/lib/mobileAuthorUserMap';
import {
  flushQueuedRitualDrafts,
  getQueuedRitualDraftCounts,
  submitRitualDraftWithQueue,
} from './src/lib/mobileRitualQueue';
import {
  MOBILE_LEAGUE_NAMES,
  getLeagueIndexFromXp,
  resolveMobileLeagueInfoFromXp,
  resolveMobileLeagueKeyFromXp,
} from './src/lib/mobileLeagueSystem';
import { resolveMobileFollowState, toggleMobileFollowState } from './src/lib/mobileFollowState';
import { fetchMobileProfileStats } from './src/lib/mobileProfileStats';
import {
  fetchMobilePublicProfileSnapshot,
  type MobilePublicProfileSnapshot,
} from './src/lib/mobilePublicProfileSnapshot';
import {
  fetchMobilePublicProfileActivity,
  type MobilePublicProfileActivityItem,
} from './src/lib/mobilePublicProfileActivity';
import {
  fetchMobileProfileWatchedMovies,
  type MobileWatchedMovie,
} from './src/lib/mobileProfileWatchedMovies';
import {
  fetchMobileProfileMovieArchive,
  type MobileProfileMovieArchiveEntry,
} from './src/lib/mobileProfileMovieArchive';
import {
  mergeMobileProfileIdentityDrafts,
  normalizeMobileProfileIdentityDraft,
  readMobileProfileIdentityFromCloud,
  syncMobileProfileIdentityToCloud,
} from './src/lib/mobileProfileIdentitySync';
import { applyMobileAuthCallbackFromUrl } from './src/lib/mobileAuthCallback';
import {
  fetchMobileCommentFeed,
  type CommentFeedScope,
  type CommentFeedSort,
} from './src/lib/mobileCommentsFeed';
import {
  echoMobileCommentRitual,
  fetchMobileCommentReplies,
  submitMobileCommentReply,
  type MobileCommentReply,
} from './src/lib/mobileCommentInteractions';
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
import {
  claimMobileShareReward,
  MOBILE_SHARE_REWARD_XP,
} from './src/lib/mobileShareRewardSync';
import { isSupabaseConfigured, readSupabaseSessionSafe, supabase } from './src/lib/supabase';
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
  AuthModal,
  CollapsibleSectionCard,
  CommentFeedCard,
  DailyHomeScreen,
  DiscoverRoutesCard,
  InviteClaimScreen,
  LeaguePromotionModal,
  MobileSettingsModal,
  MovieDetailsModal,
  PlatformRulesCard,
  ProfileGenreDistributionCard,
  ProfileIdentityCard,
  ProfileXpCard,
  ProfileMovieArchiveModal,
  ProfileMarksCard,
  PushInboxCard,
  PushStatusCard,
  PublicProfileMovieArchiveModal,
  RitualComposerModal,
  SectionLeadCard,
  ShareHubScreen,
  StatePanel,
  WatchedMoviesCard,
  setAppScreensThemeMode,
  type MobileSettingsIdentityDraft,
  type MobileSettingsLanguage,
  type MobileLeaguePromotionEvent,
  type MobileSettingsSaveState,
} from './src/ui/appScreens';
import { resolveMobileWebBaseUrl } from './src/lib/mobileEnv';
import {
  readStoredMobileThemeMode,
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
const MOBILE_AUTH_REDIRECT_TO =
  String(process.env.EXPO_PUBLIC_AUTH_REDIRECT_TO || '').trim() || MOBILE_DEEP_LINK_BASE;
const MOBILE_UI_PACKAGE_LABEL = 'UI Package 6.46';
const MOBILE_PROFILE_IDENTITY_STORAGE_KEY = 'ac_mobile_profile_identity_v1';
const MOBILE_PROFILE_LANGUAGE_STORAGE_KEY = 'ac_mobile_profile_language_v1';
const MOBILE_AUTH_REMEMBER_ME_STORAGE_KEY = 'ac_mobile_auth_remember_me_v1';
const MOBILE_AUTH_REMEMBER_ME_ENABLED = '1';
const MOBILE_AUTH_REMEMBER_ME_DISABLED = '0';

const MOBILE_WEB_BASE_URL = resolveMobileWebBaseUrl();
const MOBILE_ACCOUNT_DELETION_URL = MOBILE_WEB_BASE_URL
  ? `${MOBILE_WEB_BASE_URL}/account-deletion/`
  : 'https://180absolutecinema.com/account-deletion/';

const DEFAULT_SETTINGS_IDENTITY: MobileSettingsIdentityDraft = {
  fullName: '',
  username: '',
  gender: '',
  birthDate: '',
  bio: '',
  avatarUrl: '',
  profileLink: '',
};

const normalizeExternalUrl = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const readStoredAuthRememberMe = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_AUTH_REMEMBER_ME_STORAGE_KEY);
    return raw !== MOBILE_AUTH_REMEMBER_ME_DISABLED;
  } catch {
    return true;
  }
};

const writeStoredAuthRememberMe = async (rememberMe: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      MOBILE_AUTH_REMEMBER_ME_STORAGE_KEY,
      rememberMe ? MOBILE_AUTH_REMEMBER_ME_ENABLED : MOBILE_AUTH_REMEMBER_ME_DISABLED
    );
  } catch {
    // best-effort persistence only
  }
};

const normalizeAuthErrorMessage = (value: unknown, fallback: string): string => {
  if (value instanceof Error) {
    const normalized = value.message.trim();
    return normalized || fallback;
  }
  if (value && typeof value === 'object') {
    const normalized = String((value as { message?: unknown }).message || '').trim();
    if (normalized) return normalized;
  }
  return fallback;
};

const isAppleAuthCanceled = (value: unknown): boolean => {
  const code = String((value as { code?: unknown } | null)?.code || '').trim();
  return code === 'ERR_REQUEST_CANCELED';
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

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseStoredIdentityDraft = (raw: string | null): MobileSettingsIdentityDraft => {
  if (!raw) return DEFAULT_SETTINGS_IDENTITY;
  try {
    const parsed = JSON.parse(raw) as Partial<MobileSettingsIdentityDraft> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS_IDENTITY;
    return normalizeMobileProfileIdentityDraft(parsed);
  } catch {
    return DEFAULT_SETTINGS_IDENTITY;
  }
};

const parseStoredLanguage = (raw: string | null): MobileSettingsLanguage => {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'tr') return 'tr';
  if (normalized === 'es') return 'es';
  if (normalized === 'fr') return 'fr';
  return 'en';
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

type ArenaEntryView = MobileArenaEntry;
type SharePlatform = 'instagram' | 'tiktok' | 'x';
type ShareGoal = 'comment' | 'streak';
type PublicProfileOpenOrigin = 'arena' | 'comment' | 'manual' | 'deeplink';
type PublicProfileOpenTarget = {
  userId?: string | null;
  username?: string | null;
  displayNameHint?: string | null;
  origin: PublicProfileOpenOrigin;
};
type PublicProfileModalState = {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  displayNameHint: string;
  profile: MobilePublicProfileSnapshot | null;
  followStatus: 'idle' | 'loading' | 'ready' | 'error';
  followMessage: string;
  isFollowing: boolean;
  followsYou: boolean;
  isSelfProfile: boolean;
  source: PublicProfileOpenOrigin | null;
};
type PublicWatchedMovieSummary = {
  id: string;
  movieTitle: string;
  posterPath: string | null;
  year: number | null;
  watchedDayKey: string;
  watchCount: number;
};
type ProfileMovieArchiveModalState = {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  movie: MobileWatchedMovie | null;
  entries: MobileProfileMovieArchiveEntry[];
};
type PublicProfileMovieArchiveModalState = {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  displayName: string;
  movie: PublicWatchedMovieSummary | null;
  items: MobilePublicProfileActivityItem[];
};

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
  public_profile: 'Profile',
  discover_home: 'Explore',
} as const satisfies Record<
  'daily_home' | 'invite_claim' | 'share_hub' | 'public_profile' | 'discover_home',
  keyof MainTabParamList
>;
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
  SELF_INVITE: 'Kendi davet kodunu kullanamazsın.',
  ALREADY_CLAIMED: 'Bu hesap zaten bir davet kodu kullandı.',
  DEVICE_DAILY_LIMIT: 'Gunluk cihaz limiti doldu. Daha sonra tekrar dene.',
  DEVICE_CODE_REUSE: 'Bu cihazda bu kod daha once kullanilmis.',
  SERVER_ERROR: 'Sunucuya ulasilamadi. Birazdan tekrar dene.',
};


export default function App() {
  type MainTabKey = 'daily' | 'explore' | 'inbox' | 'marks' | 'profile';
  type AuthFlowMode = 'login' | 'register' | 'forgot' | 'recovery';
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dailyState, setDailyState] = useState<DailyState>({ status: 'idle' });
  const [inviteClaimState, setInviteClaimState] = useState<InviteClaimState>({ status: 'idle' });
  const [authEmail, setAuthEmail] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authBirthDate, setAuthBirthDate] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authRememberMe, setAuthRememberMe] = useState(true);
  const [authFlowMode, setAuthFlowMode] = useState<AuthFlowMode>('login');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    status: 'idle',
    message: 'Session kontrol ediliyor...',
  });
  const [ritualDraftText, setRitualDraftText] = useState('');
  const [ritualSubmitState, setRitualSubmitState] = useState<RitualSubmitState>({
    status: 'idle',
    message: '',
  });
  const [selectedDailyMovieId, setSelectedDailyMovieId] = useState<number | null>(null);
  const [dailyMovieDetailsVisible, setDailyMovieDetailsVisible] = useState(false);
  const [ritualComposerVisible, setRitualComposerVisible] = useState(false);
  const [ritualQueueState, setRitualQueueState] = useState<RitualQueueState>({
    status: 'idle',
    message: '',
    pendingCount: 0,
  });
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'idle',
    message: 'Profil metrikleri hazir degil.',
  });
  const [leaguePromotionEvent, setLeaguePromotionEvent] = useState<MobileLeaguePromotionEvent | null>(
    null
  );
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
  const [settingsLanguage, setSettingsLanguage] = useState<MobileSettingsLanguage>('en');
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
  const [selectedShareGoal, setSelectedShareGoal] = useState<ShareGoal>('comment');
  const [shareHubState, setShareHubState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: 'Paylasim hedefini sec.',
  });
  const [profileGenreDistribution, setProfileGenreDistribution] = useState<
    Array<{ genre: string; count: number }>
  >([]);
  const [commentFeedScope, setCommentFeedScope] = useState<CommentFeedScope>('today');
  const [commentFeedSort, setCommentFeedSort] = useState<CommentFeedSort>('latest');
  const [commentFeedQuery, setCommentFeedQuery] = useState('');
  const [debouncedCommentFeedQuery, setDebouncedCommentFeedQuery] = useState('');
  const [commentFeedState, setCommentFeedState] = useState<CommentFeedState>({
    status: 'idle',
    message: 'Genel yorum akisi hazir degil.',
    source: 'fallback',
    scope: 'today',
    sort: 'latest',
    query: '',
    page: 1,
    pageSize: 24,
    hasMore: false,
    isAppending: false,
    items: [],
  });
  const [dailyCommentFeedState, setDailyCommentFeedState] = useState<CommentFeedState>({
    status: 'idle',
    message: 'Gunluk yorum akisi hazir degil.',
    source: 'fallback',
    scope: 'today',
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
  const [watchedMoviesState, setWatchedMoviesState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: MobileWatchedMovie[];
  }>({
    status: 'idle',
    message: 'Izlenen filmler yuklenmedi.',
    items: [],
  });
  const [profileMovieArchiveModalState, setProfileMovieArchiveModalState] =
    useState<ProfileMovieArchiveModalState>({
      visible: false,
      status: 'idle',
      message: 'Film arsivi hazir degil.',
      movie: null,
      entries: [],
    });
  const [publicProfileMovieArchiveModalState, setPublicProfileMovieArchiveModalState] =
    useState<PublicProfileMovieArchiveModalState>({
      visible: false,
      status: 'idle',
      message: 'Public film arsivi hazir degil.',
      displayName: '',
      movie: null,
      items: [],
    });
  const [publicProfileModalState, setPublicProfileModalState] = useState<PublicProfileModalState>({
    visible: false,
    status: 'idle',
    message: 'Profil secimi bekleniyor.',
    displayNameHint: '',
    profile: null,
    followStatus: 'idle',
    followMessage: '',
    isFollowing: false,
    followsYou: false,
    isSelfProfile: false,
    source: null,
  });
  const [publicProfileFullState, setPublicProfileFullState] = useState<{
    visible: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    displayName: string;
    items: MobilePublicProfileActivityItem[];
  }>({
    visible: false,
    status: 'idle',
    message: 'Detayli profil hazir degil.',
    displayName: '',
    items: [],
  });
  const [publicProfileTarget, setPublicProfileTarget] = useState<{
    userId: string;
    displayNameHint: string;
    source: PublicProfileOpenOrigin;
  } | null>(null);
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
  const hasCloudIdentityHydratedRef = useRef(false);
  const hasHandledInitialAuthPromptRef = useRef(false);
  const lastObservedLeagueIndexRef = useRef<number | null>(null);
  const lastHandledAuthCallbackUrlRef = useRef<string | null>(null);
  const lastHandledPublicProfileIntentRef = useRef<string | null>(null);
  const lastAutoOpenedAuthRouteRef = useRef<string | null>(null);

  const primaryDailyMovie =
    dailyState.status === 'success' && dailyState.movies.length > 0 ? dailyState.movies[0] : null;
  const selectedDailyMovie =
    dailyState.status === 'success'
      ? dailyState.movies.find((movie) => movie.id === selectedDailyMovieId) || primaryDailyMovie
      : null;

  const isSignedIn = authState.status === 'signed_in';

  const refreshAuthState = useCallback(
    async ({ applyRememberMePolicy = false }: { applyRememberMePolicy?: boolean } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase ayarlari eksik.',
      });
      return;
    }

    try {
      const sessionResult = await readSupabaseSessionSafe();
      const userEmail = String(sessionResult.session?.user?.email || '').trim();
      if (sessionResult.session?.access_token && userEmail) {
        if (applyRememberMePolicy) {
          const rememberMe = await readStoredAuthRememberMe();
          if (!rememberMe) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            setAuthState({
              status: 'signed_out',
              message: 'Beni hatirla kapali oldugu icin onceki oturum temizlendi.',
            });
            return;
          }
        }

        setAuthState({
          status: 'signed_in',
          message: 'Mobil oturum hazir.',
          email: userEmail,
        });
        return;
      }

      if (sessionResult.error) {
        setAuthState({
          status: 'error',
          message: sessionResult.error.message,
        });
        return;
      }

      setAuthState({
        status: 'signed_out',
        message: sessionResult.clearedInvalidSession
          ? 'Eski Supabase oturumu temizlendi. Tekrar giris yapabilirsin.'
          : 'Giris yapilmadi.',
      });
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Session okunamadi.',
      });
    }
    },
    []
  );

  const handleSetAuthRememberMe = useCallback((nextValue: boolean) => {
    setAuthRememberMe(nextValue);
    void writeStoredAuthRememberMe(nextValue);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) setAppleAuthAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setAppleAuthAvailable(false);
      });

    return () => {
      cancelled = true;
    };
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

  const refreshSettingsIdentityFromCloud = useCallback(async () => {
    const result = await readMobileProfileIdentityFromCloud();
    if (!result.ok) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_profile_identity_cloud_read_failed',
        message: result.message,
      });
      return;
    }

    setSettingsIdentityDraft((prev) => {
      const merged = mergeMobileProfileIdentityDrafts(prev, result.identity);
      void AsyncStorage.setItem(MOBILE_PROFILE_IDENTITY_STORAGE_KEY, JSON.stringify(merged)).catch(
        () => undefined
      );
      return merged;
    });

    void trackMobileEvent('page_view', {
      reason: 'mobile_profile_identity_cloud_loaded',
      source: result.source,
    });
  }, []);

  const refreshProfileGenreDistribution = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || authState.status !== 'signed_in') {
      setProfileGenreDistribution([]);
      return;
    }

    try {
      const sessionResult = await readSupabaseSessionSafe();
      const userId = String(sessionResult.session?.user?.id || '').trim();
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

  const refreshWatchedMovies = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setWatchedMoviesState({
        status: 'idle',
        message: 'Izlenen filmler icin giris bekleniyor.',
        items: [],
      });
      return;
    }

    setWatchedMoviesState({
      status: 'loading',
      message: 'Izlenen filmler yukleniyor...',
      items: [],
    });

    const result = await fetchMobileProfileWatchedMovies({ limit: 24 });
    if (!result.ok) {
      setWatchedMoviesState({
        status: 'error',
        message: result.message,
        items: [],
      });
      return;
    }

    setWatchedMoviesState({
      status: 'ready',
      message: result.message,
      items: result.items,
    });
  }, [authState.status]);

  const handleCloseProfileMovieArchive = useCallback(() => {
    setProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const handleOpenProfileMovieArchive = useCallback(async (movie: MobileWatchedMovie) => {
    const movieTitle = String(movie.movieTitle || '').trim();
    if (!movieTitle) return;

    setProfileMovieArchiveModalState({
      visible: true,
      status: 'loading',
      message: 'Film arsivi yukleniyor...',
      movie,
      entries: [],
    });
    void trackMobileEvent('movie_archive_opened', {
      movieTitle,
      movieYear: movie.year ?? null,
      watchCount: movie.watchCount,
    });

    const result = await fetchMobileProfileMovieArchive({
      movieTitle,
      year: movie.year,
    });

    setProfileMovieArchiveModalState({
      visible: true,
      status: result.ok ? 'ready' : 'error',
      message: result.message,
      movie,
      entries: result.entries,
    });

    if (!result.ok) {
      void trackMobileEvent('movie_archive_failed', {
        movieTitle,
        movieYear: movie.year ?? null,
        reason: result.message,
      });
    }
  }, []);

  const handleRefreshProfileMovieArchive = useCallback(() => {
    const movie = profileMovieArchiveModalState.movie;
    if (!movie) return;
    void handleOpenProfileMovieArchive(movie);
  }, [handleOpenProfileMovieArchive, profileMovieArchiveModalState.movie]);

  const resolvePublicMovieArchiveItems = useCallback(
    (movie: PublicWatchedMovieSummary, sourceItems: MobilePublicProfileActivityItem[]) => {
      const movieTitle = String(movie.movieTitle || '').trim().toLowerCase();
      return sourceItems.filter((item) => {
        const itemTitle = String(item.movieTitle || '').trim().toLowerCase();
        if (!itemTitle || itemTitle !== movieTitle) return false;
        if (typeof movie.year !== 'number') return true;
        return item.year === null || item.year === movie.year;
      });
    },
    []
  );

  const handleClosePublicProfileMovieArchive = useCallback(() => {
    setPublicProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const handleOpenPublicProfileMovieArchive = useCallback(
    (movie: PublicWatchedMovieSummary) => {
      const displayName =
        String(publicProfileModalState.profile?.displayName || '').trim() ||
        publicProfileFullState.displayName ||
        publicProfileModalState.displayNameHint ||
        '@bilinmeyen';
      const items = resolvePublicMovieArchiveItems(movie, publicProfileFullState.items);
      const hasEntries = items.length > 0;
      setPublicProfileMovieArchiveModalState({
        visible: true,
        status: hasEntries ? 'ready' : 'error',
        message: hasEntries
          ? `${displayName} icin ${items.length} yorum kaydi bulundu.`
          : 'Bu film icin public yorum kaydi bulunamadi.',
        displayName,
        movie,
        items,
      });
      void trackMobileEvent(hasEntries ? 'public_movie_archive_opened' : 'public_movie_archive_failed', {
        profileUserId: publicProfileTarget?.userId || publicProfileModalState.profile?.userId || null,
        movieTitle: movie.movieTitle,
        movieYear: movie.year ?? null,
        itemCount: items.length,
      });
    },
    [
      publicProfileFullState.displayName,
      publicProfileFullState.items,
      publicProfileModalState.displayNameHint,
      publicProfileModalState.profile?.displayName,
      publicProfileModalState.profile?.userId,
      publicProfileTarget?.userId,
      resolvePublicMovieArchiveItems,
    ]
  );

  const handleRefreshPublicProfileMovieArchive = useCallback(async () => {
    const movie = publicProfileMovieArchiveModalState.movie;
    const userId =
      String(publicProfileTarget?.userId || '').trim() ||
      String(publicProfileModalState.profile?.userId || '').trim();
    const displayName =
      String(publicProfileMovieArchiveModalState.displayName || '').trim() ||
      String(publicProfileModalState.profile?.displayName || '').trim() ||
      publicProfileFullState.displayName ||
      publicProfileModalState.displayNameHint;

    if (!movie || !userId) return;

    setPublicProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: true,
      status: 'loading',
      message: 'Public film arsivi yenileniyor...',
      items: [],
    }));

    const result = await fetchMobilePublicProfileActivity({
      userId,
      limit: 100,
    });

    setPublicProfileFullState((prev) => ({
      ...prev,
      visible: true,
      status: result.ok ? 'ready' : 'error',
      message: result.message,
      displayName: displayName || prev.displayName,
      items: result.items,
    }));

    const items = result.ok ? resolvePublicMovieArchiveItems(movie, result.items) : [];
    setPublicProfileMovieArchiveModalState({
      visible: true,
      status: result.ok && items.length > 0 ? 'ready' : 'error',
      message: result.ok
        ? items.length > 0
          ? `${displayName || '@bilinmeyen'} icin ${items.length} yorum kaydi bulundu.`
          : 'Bu film icin public yorum kaydi bulunamadi.'
        : result.message,
      displayName: displayName || '@bilinmeyen',
      movie,
      items,
    });
  }, [
    publicProfileFullState.displayName,
    publicProfileModalState.displayNameHint,
    publicProfileModalState.profile?.displayName,
    publicProfileModalState.profile?.userId,
    publicProfileMovieArchiveModalState.displayName,
    publicProfileMovieArchiveModalState.movie,
    publicProfileTarget?.userId,
    resolvePublicMovieArchiveItems,
  ]);

  const resolvePublicProfileUserId = useCallback(
    async ({ userId, username }: { userId?: string | null; username?: string | null }) => {
      const normalizedUserId = String(userId || '').trim();
      if (normalizedUserId) return normalizedUserId;

      const normalizedUsername = String(username || '').trim();
      if (!normalizedUsername) return '';

      const authorUserIds = await resolveUserIdsByAuthorNames([normalizedUsername]);
      return authorUserIds.get(toAuthorIdentityKey(normalizedUsername)) || '';
    },
    []
  );

  const loadPublicProfileFull = useCallback(
    async ({ userId, displayName }: { userId: string; displayName: string }) => {
      setPublicProfileFullState({
        visible: true,
        status: 'loading',
        message: 'Detayli profil yukleniyor...',
        displayName,
        items: [],
      });

      const result = await fetchMobilePublicProfileActivity({
        userId,
        limit: 100,
      });

      if (!result.ok) {
        setPublicProfileFullState((prev) => ({
          ...prev,
          visible: true,
          status: 'error',
          message: result.message,
          items: [],
        }));
        return;
      }

      setPublicProfileFullState((prev) => ({
        ...prev,
        visible: true,
        status: 'ready',
        message: result.message,
        items: result.items,
      }));
    },
    []
  );

  const loadPublicProfileModal = useCallback(
    async ({
      userId,
      displayNameHint,
      source,
    }: {
      userId: string;
      displayNameHint: string;
      source: PublicProfileOpenOrigin;
    }) => {
      setPublicProfileMovieArchiveModalState({
        visible: false,
        status: 'idle',
        message: 'Public film arsivi hazir degil.',
        displayName: displayNameHint,
        movie: null,
        items: [],
      });
      setPublicProfileTarget({ userId, displayNameHint, source });
      setPublicProfileModalState((prev) => ({
        ...prev,
        visible: false,
        status: 'loading',
        message: 'Profil yukleniyor...',
        displayNameHint,
        profile: null,
        followStatus: 'idle',
        followMessage: '',
        isFollowing: false,
        followsYou: false,
        isSelfProfile: false,
        source,
      }));

      const profileResult = await fetchMobilePublicProfileSnapshot({
        userId,
        displayNameHint,
      });

      if (!profileResult.ok) {
        setPublicProfileModalState((prev) => ({
          ...prev,
          status: 'error',
          message: profileResult.message,
          profile: null,
          followStatus: 'error',
          followMessage: '',
          isFollowing: false,
          followsYou: false,
          isSelfProfile: false,
        }));
        return {
          ok: false,
          displayName: displayNameHint,
          message: profileResult.message,
        } as const;
      }

      setPublicProfileModalState((prev) => ({
        ...prev,
        status: 'ready',
        message: profileResult.message,
        displayNameHint: profileResult.profile.displayName || displayNameHint,
        profile: profileResult.profile,
      }));

      const followResult = await resolveMobileFollowState(userId);
      setPublicProfileModalState((prev) => ({
        ...prev,
        followStatus: followResult.ok ? 'ready' : 'error',
        followMessage: followResult.message,
        isFollowing: followResult.isFollowing,
        followsYou: followResult.followsYou,
        isSelfProfile: followResult.isSelf,
      }));

      return {
        ok: true,
        displayName: profileResult.profile.displayName || displayNameHint,
        message: profileResult.message,
      } as const;
    },
    []
  );

  const openPublicProfileInApp = useCallback(
    async (target: PublicProfileOpenTarget) => {
      const displayNameHint =
        String(target.displayNameHint || '').trim() || String(target.username || '').trim();
      const resolvedUserId = await resolvePublicProfileUserId({
        userId: target.userId,
        username: target.username,
      });

      if (!resolvedUserId) {
        setPublicProfileTarget(null);
        setPublicProfileModalState({
          visible: false,
          status: 'error',
          message: 'Profil bulunamadi.',
          displayNameHint,
          profile: null,
          followStatus: 'error',
          followMessage: 'Kullanici kimligi cozulmedi.',
          isFollowing: false,
          followsYou: false,
          isSelfProfile: false,
          source: target.origin,
        });
        setPublicProfileFullState({
          visible: true,
          status: 'error',
          message: 'Profil bulunamadi.',
          displayName: displayNameHint || '@bilinmeyen',
          items: [],
        });
        if (tabNavigationRef.isReady()) {
          tabNavigationRef.navigate(MAIN_TAB_BY_KEY.profile);
        }
        return;
      }

      const loadResult = await loadPublicProfileModal({
        userId: resolvedUserId,
        displayNameHint,
        source: target.origin,
      });

      if (tabNavigationRef.isReady()) {
        tabNavigationRef.navigate(MAIN_TAB_BY_KEY.profile);
      }

      if (!loadResult.ok) {
        setPublicProfileFullState({
          visible: true,
          status: 'error',
          message: loadResult.message,
          displayName: loadResult.displayName || displayNameHint || '@bilinmeyen',
          items: [],
        });
        return;
      }

      await loadPublicProfileFull({
        userId: resolvedUserId,
        displayName: loadResult.displayName || displayNameHint || '@bilinmeyen',
      });
    },
    [loadPublicProfileFull, loadPublicProfileModal, resolvePublicProfileUserId]
  );

  const refreshArenaLeaderboard = useCallback(async () => {
    setArenaState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Arena leaderboard yukleniyor...',
    }));

    const result = await fetchMobileArenaSnapshot();

    setArenaState({
      status: result.ok ? 'ready' : 'error',
      source: result.source,
      message: result.message,
      entries: result.entries,
    });

    void trackMobileEvent('page_view', {
      reason: result.ok ? 'mobile_arena_loaded' : 'mobile_arena_failed',
      source: result.source,
      entries: result.entries.length,
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

  const refreshDailyCommentFeed = useCallback(async () => {
    setDailyCommentFeedState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Gunluk yorum akisi yukleniyor...',
      scope: 'today',
      sort: 'latest',
      query: '',
      page: 1,
      hasMore: false,
      isAppending: false,
    }));

    const result = await fetchMobileCommentFeed({
      scope: 'today',
      sort: 'latest',
      query: '',
      page: 1,
      pageSize: 24,
    });

    setDailyCommentFeedState({
      status: result.ok ? 'ready' : 'error',
      message: result.message,
      source: result.source,
      scope: 'today',
      sort: 'latest',
      query: '',
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      isAppending: false,
      items: result.items,
    });

    void trackMobileEvent('page_view', {
      reason: result.ok ? 'mobile_daily_comment_feed_loaded' : 'mobile_daily_comment_feed_failed',
      source: result.source,
      items: result.items.length,
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
      setAuthModalVisible(false);
      setAuthFullName('');
      setAuthUsername('');
      setAuthBirthDate('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
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

  const handleRegister = useCallback(async () => {
    const email = authEmail.trim().toLowerCase();
    const fullName = authFullName.trim();
    const username = authUsername.trim().replace(/\s+/g, '').toLowerCase();
    const birthDate = authBirthDate.trim();
    const password = authPassword;
    const confirmPassword = authConfirmPassword;

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase ayarlari eksik.',
      });
      return;
    }

    if (!fullName || !username || !birthDate || !email || !password || !confirmPassword) {
      setAuthState({
        status: 'error',
        message: 'Ad soyad, kullanici adi, dogum tarihi, email ve sifre alanlari zorunlu.',
      });
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setAuthState({
        status: 'error',
        message: 'Kullanici adi 3-20 karakter olmali; harf, rakam ve alt cizgi kullan.',
      });
      return;
    }

    if (password.length < 6) {
      setAuthState({
        status: 'error',
        message: 'Sifre en az 6 karakter olmali.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setAuthState({
        status: 'error',
        message: 'Sifre alanlari ayni olmali.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Hesap olusturuluyor...',
    });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
            username,
            birth_date: birthDate,
          },
        },
      });

      if (error) {
        const message = error.message || 'Kayit basarisiz.';
        setAuthState({
          status: 'error',
          message,
        });
        void trackMobileEvent('auth_failure', {
          method: 'password_register',
          reason: message,
        });
        return;
      }

      const resolvedEmail = String(data.user?.email || email).trim().toLowerCase() || email;
      const hasLiveSession = Boolean(data.session?.access_token && resolvedEmail);

      setSettingsIdentityDraft((prev) => ({
        ...prev,
        fullName,
        username,
        birthDate,
      }));
      setAuthFullName('');
      setAuthUsername('');
      setAuthBirthDate('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');

      setAuthState(
        hasLiveSession
          ? {
              status: 'signed_in',
              message: authRememberMe
                ? 'Kayit tamamlandi. Oturum acildi.'
                : 'Kayit tamamlandi. Oturum bu acilis icin aktif; sonraki acilista tekrar giris istenebilir.',
              email: resolvedEmail,
            }
          : {
              status: 'signed_out',
              message: 'Kayit tamamlandi. E-posta onayi sonrasi giris yap.',
            }
      );

      void trackMobileEvent(hasLiveSession ? 'signup_success' : 'signup_pending_confirmation', {
        method: 'password',
        rememberMe: authRememberMe ? 'enabled' : 'disabled',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kayit basarisiz.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password_register',
        reason: message,
      });
    }
  }, [
    authBirthDate,
    authConfirmPassword,
    authEmail,
    authFullName,
    authPassword,
    authRememberMe,
    authUsername,
  ]);

  const handleRequestPasswordReset = useCallback(async () => {
    const email = authEmail.trim().toLowerCase();

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase ayarlari eksik.',
      });
      return;
    }

    if (!email) {
      setAuthState({
        status: 'error',
        message: 'Sifre yenileme icin e-posta gerekli.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Sifre yenileme baglantisi gonderiliyor...',
    });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: MOBILE_AUTH_REDIRECT_TO,
      });
      if (error) {
        setAuthState({
          status: 'error',
          message: error.message || 'Sifre yenileme baglantisi gonderilemedi.',
        });
        void trackMobileEvent('auth_failure', {
          method: 'password_reset',
          reason: error.message || 'reset_password_request_failed',
        });
        return;
      }

      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('forgot');
      setAuthState({
        status: 'signed_out',
        message: 'Sifre yenileme baglantisi e-posta adresine gonderildi.',
      });
      void trackMobileEvent('password_reset_requested', {
        method: 'email',
        redirectTo: MOBILE_AUTH_REDIRECT_TO,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sifre yenileme baglantisi gonderilemedi.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password_reset',
        reason: message,
      });
    }
  }, [authEmail]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Google girisi icin Supabase ayarlari eksik.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Google girisi icin yonlendiriliyor...',
    });
    void trackMobileEvent('oauth_start', {
      provider: 'google',
      surface: 'mobile_native',
    });

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: MOBILE_AUTH_REDIRECT_TO,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setAuthState({
          status: 'error',
          message: error.message || 'Google girisi baslatilamadi.',
        });
        void trackMobileEvent('oauth_failure', {
          provider: 'google',
          reason: error.message || 'oauth_start_failed',
        });
        return;
      }

      const redirectUrl = String(data?.url || '').trim();
      if (!redirectUrl) {
        setAuthState({
          status: 'error',
          message: 'Google girisi icin yonlendirme URL olusmadi.',
        });
        void trackMobileEvent('oauth_failure', {
          provider: 'google',
          reason: 'missing_oauth_url',
        });
        return;
      }

      const canOpen = await Linking.canOpenURL(redirectUrl);
      if (!canOpen) {
        setAuthState({
          status: 'error',
          message: 'Google girisi icin tarayici acilamadi.',
        });
        void trackMobileEvent('oauth_failure', {
          provider: 'google',
          reason: 'oauth_url_not_openable',
        });
        return;
      }

      void trackMobileEvent('oauth_redirect_started', {
        provider: 'google',
        redirectTo: MOBILE_AUTH_REDIRECT_TO,
      });
      setAuthModalVisible(false);
      await Linking.openURL(redirectUrl);
      setAuthFlowMode('login');
      setAuthState({
        status: 'signed_out',
        message: 'Google girisini tarayicida tamamla; uygulama callback ile geri donecek.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google girisi baslatilamadi.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('oauth_failure', {
        provider: 'google',
        reason: message,
      });
    }
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setAuthState({
        status: 'error',
        message: 'Apple girisi yalnizca iOS cihazlarda acilabilir.',
      });
      return;
    }

    if (!appleAuthAvailable) {
      setAuthState({
        status: 'error',
        message: 'Bu cihazda Apple girisi hazir degil.',
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: 'Apple girisi icin Supabase ayarlari eksik.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Apple girisi baslatiliyor...',
    });
    void trackMobileEvent('oauth_start', {
      provider: 'apple',
      surface: 'mobile_native',
    });

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = String(credential.identityToken || '').trim();
      if (!identityToken) {
        setAuthState({
          status: 'error',
          message: 'Apple kimlik tokeni alinamadi.',
        });
        void trackMobileEvent('oauth_failure', {
          provider: 'apple',
          reason: 'missing_identity_token',
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (error || !data.session?.access_token) {
        const message = error?.message || 'Apple girisi tamamlanamadi.';
        setAuthState({
          status: 'error',
          message,
        });
        void trackMobileEvent('oauth_failure', {
          provider: 'apple',
          reason: message,
        });
        return;
      }

      const resolvedEmail =
        String(data.user?.email || credential.email || '').trim() || 'Apple hesabi';
      setAuthState({
        status: 'signed_in',
        message: 'Apple girisi basarili.',
        email: resolvedEmail,
      });
      setAuthModalVisible(false);
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
      void trackMobileEvent('login_success', {
        method: 'apple',
      });
    } catch (error) {
      if (isAppleAuthCanceled(error)) {
        setAuthState({
          status: 'signed_out',
          message: 'Apple girisi iptal edildi.',
        });
        return;
      }

      const message = normalizeAuthErrorMessage(error, 'Apple girisi baslatilamadi.');
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('oauth_failure', {
        provider: 'apple',
        reason: message,
      });
    }
  }, [appleAuthAvailable]);

  const handleCompletePasswordReset = useCallback(async () => {
    const password = authPassword.trim();
    const confirmPassword = authConfirmPassword.trim();

    if (!supabase) {
      setAuthState({
        status: 'error',
        message: 'Supabase hazir degil.',
      });
      return;
    }

    if (password.length < 6) {
      setAuthState({
        status: 'error',
        message: 'Sifre en az 6 karakter olmali.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setAuthState({
        status: 'error',
        message: 'Sifre tekrar alanlari ayni olmali.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: 'Sifre guncelleniyor...',
    });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthState({
          status: 'error',
          message: error.message || 'Sifre guncellenemedi.',
        });
        void trackMobileEvent('auth_failure', {
          method: 'password_recovery',
          reason: error.message || 'password_reset_complete_failed',
        });
        return;
      }

      const sessionResult = await readSupabaseSessionSafe();
      const email = String(sessionResult.session?.user?.email || authEmail).trim().toLowerCase();
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
      setAuthState(
        email
          ? {
              status: 'signed_in',
              message: 'Sifre guncellendi. Yeni sifren artik aktif.',
              email,
            }
          : {
              status: 'signed_out',
              message: 'Sifre guncellendi. Yeni sifrenle tekrar giris yapabilirsin.',
            }
      );
      void trackMobileEvent('password_reset_completed', {
        method: 'recovery',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sifre guncellenemedi.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password_recovery',
        reason: message,
      });
    }
  }, [authConfirmPassword, authEmail, authPassword]);

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
      setAuthFullName('');
      setAuthUsername('');
      setAuthBirthDate('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
      setAuthModalVisible(true);
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Cikis basarisiz.',
      });
    }
  }, []);

  const isDawnTheme = themeMode === 'dawn';
  const tabTheme = useMemo(() => createTabTheme(themeMode), [themeMode]);

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
    let active = true;
    void readStoredAuthRememberMe().then((rememberMe) => {
      if (!active) return;
      setAuthRememberMe(rememberMe);
    });
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
    if (profileState.status !== 'success') return;

    const currentIndex = getLeagueIndexFromXp(profileState.totalXp);
    const previousIndex = lastObservedLeagueIndexRef.current;

    if (previousIndex !== null && currentIndex > previousIndex) {
      const previousLeagueKey = MOBILE_LEAGUE_NAMES[previousIndex] || null;
      setLeaguePromotionEvent({
        leagueKey: profileState.leagueKey,
        leagueName: profileState.leagueName,
        leagueColor: profileState.leagueColor,
        previousLeagueKey,
      });
    }

    lastObservedLeagueIndexRef.current = currentIndex;
  }, [profileState]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      setProfileGenreDistribution([]);
      return;
    }
    void refreshProfileGenreDistribution();
  }, [authState.status, refreshProfileGenreDistribution]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      setWatchedMoviesState({
        status: 'idle',
        message: 'Izlenen filmler icin giris bekleniyor.',
        items: [],
      });
      setProfileMovieArchiveModalState({
        visible: false,
        status: 'idle',
        message: 'Film arsivi icin giris bekleniyor.',
        movie: null,
        entries: [],
      });
      return;
    }
    void refreshWatchedMovies();
  }, [authState.status, refreshWatchedMovies]);

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
    void refreshDailyCommentFeed();
  }, [authState.status, refreshDailyCommentFeed]);

  useEffect(() => {
    void refreshAuthState({ applyRememberMePolicy: true });
    void refreshRitualQueue();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshAuthState();
      void refreshRitualQueue();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuthState, refreshRitualQueue]);

  useEffect(() => {
    const incomingUrl = String(lastIncomingUrl || '').trim();
    if (!incomingUrl) return;
    if (lastHandledAuthCallbackUrlRef.current === incomingUrl) return;
    lastHandledAuthCallbackUrlRef.current = incomingUrl;

    let active = true;

    void (async () => {
      const callbackResult = await applyMobileAuthCallbackFromUrl(incomingUrl);
      if (!active || !callbackResult.matched) return;

      if (!callbackResult.ok) {
        setAuthModalVisible(true);
        setAuthFlowMode(callbackResult.recoveryMode ? 'recovery' : 'login');
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthState({
          status: 'error',
          message: callbackResult.message,
        });
        void trackMobileEvent(
          callbackResult.recoveryMode ? 'auth_failure' : 'oauth_failure',
          callbackResult.recoveryMode
            ? {
                method: 'password_recovery',
                reason: callbackResult.message,
              }
            : {
                reason: callbackResult.message,
                method: callbackResult.method,
              }
        );
        return;
      }

      const email = supabase
        ? String((await readSupabaseSessionSafe()).session?.user?.email || '').trim().toLowerCase()
        : '';

      if (callbackResult.recoveryMode) {
        setAuthModalVisible(true);
        setAuthFlowMode('recovery');
        setAuthPassword('');
        setAuthConfirmPassword('');
      } else {
        setAuthModalVisible(false);
        setAuthFlowMode('login');
        if (email) {
          void trackMobileEvent('login_success', {
            method: callbackResult.method,
          });
        }
      }

      setAuthState(
        email
          ? {
              status: 'signed_in',
              message: callbackResult.message,
              email,
            }
          : {
              status: 'signed_out',
              message: callbackResult.message,
            }
      );
    })();

    return () => {
      active = false;
    };
  }, [lastIncomingUrl]);

  useEffect(() => {
    if (authFlowMode === 'recovery') {
      setAuthModalVisible(true);
    }
  }, [authFlowMode]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      hasHandledInitialAuthPromptRef.current = true;
      return;
    }
    if (authState.status !== 'signed_out' && authState.status !== 'error') return;
    if (hasHandledInitialAuthPromptRef.current) return;

    hasHandledInitialAuthPromptRef.current = true;
    setAuthFlowMode('login');
    setAuthModalVisible(true);
  }, [authState.status]);

  useEffect(() => {
    if (authState.status === 'signed_in' && authFlowMode !== 'recovery') {
      setAuthModalVisible(false);
    }
  }, [authFlowMode, authState.status]);

  useEffect(() => {
    const requiresAuth = activeIntent.target === 'invite' || activeIntent.target === 'share';
    if (!requiresAuth) {
      lastAutoOpenedAuthRouteRef.current = null;
      return;
    }
    if (authState.status === 'signed_in') {
      lastAutoOpenedAuthRouteRef.current = null;
      return;
    }

    const routeKey = JSON.stringify(activeIntent);
    if (lastAutoOpenedAuthRouteRef.current === routeKey) return;

    lastAutoOpenedAuthRouteRef.current = routeKey;
    setAuthFlowMode('login');
    setAuthModalVisible(true);
  }, [activeIntent, authState.status]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      void refreshProfileStats();
      return;
    }

    lastObservedLeagueIndexRef.current = null;
    setLeaguePromotionEvent(null);

    setProfileState({
      status: 'idle',
      message: 'Profil metrikleri icin giris bekleniyor.',
    });
  }, [authState.status, refreshProfileStats]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      hasCloudIdentityHydratedRef.current = false;
      return;
    }
    if (hasCloudIdentityHydratedRef.current) return;
    hasCloudIdentityHydratedRef.current = true;
    void refreshSettingsIdentityFromCloud();
  }, [authState.status, refreshSettingsIdentityFromCloud]);

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
      const normalizedError = String(result.error || '').trim().toLowerCase();
      const friendlyMessage =
        normalizedError.includes('failed to fetch') || normalizedError.includes('network')
          ? 'Gunluk filmler su an yuklenemedi. Baglanti kontrolu sonrasi tekrar dene.'
          : result.error || 'Unknown error';
      setDailyState({
        status: 'error',
        message: friendlyMessage,
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
    if (!selectedDailyMovie) {
      setRitualSubmitState({
        status: 'error',
        message: 'Ritual icin once film secimi yapilmali.',
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

    const draftLeagueKey =
      profileState.status === 'success'
        ? profileState.leagueKey
        : resolveMobileLeagueKeyFromXp(0);

    const result = await submitRitualDraftWithQueue({
      movieTitle: selectedDailyMovie.title,
      text,
      posterPath: selectedDailyMovie.posterPath,
      league: draftLeagueKey,
      year:
        typeof selectedDailyMovie.year === 'number' && Number.isFinite(selectedDailyMovie.year)
          ? String(selectedDailyMovie.year)
          : null,
    });

    if (!result.ok) {
      setRitualSubmitState({
        status: 'error',
        message: result.message,
      });
      void trackMobileEvent('ritual_submit_failed', {
        reason: result.reason,
        movieTitle: selectedDailyMovie.title,
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
        movieTitle: selectedDailyMovie.title,
        textLength: text.length,
        syncMode: 'live',
      });
      setRitualComposerVisible(false);
      void refreshProfileStats();
      void refreshWatchedMovies();
      void refreshDailyCommentFeed();
      return;
    }

    setRitualSubmitState({
      status: 'queued',
      message: result.message,
    });
    void trackMobileEvent('ritual_submit_failed', {
      reason: 'queued_for_retry',
      movieTitle: selectedDailyMovie.title,
      textLength: text.length,
    });
    setRitualComposerVisible(false);
  }, [
    profileState,
    refreshDailyCommentFeed,
    refreshProfileStats,
    refreshWatchedMovies,
    ritualDraftText,
    selectedDailyMovie,
  ]);

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
      void refreshWatchedMovies();
      void refreshDailyCommentFeed();
    }

    await refreshRitualQueue();
  }, [refreshDailyCommentFeed, refreshProfileStats, refreshRitualQueue, refreshWatchedMovies]);

  useEffect(() => {
    if (dailyState.status === 'idle') {
      void loadDailyMovies();
    }
  }, [dailyState.status]);

  useEffect(() => {
    if (activeIntent.target !== 'public_profile') {
      lastHandledPublicProfileIntentRef.current = null;
      return;
    }

    const normalizedUserId = String(activeIntent.userId || '').trim();
    const normalizedUsername = String(activeIntent.username || '').trim();
    const intentKey = `${normalizedUserId}::${normalizedUsername}`;
    if (!intentKey || lastHandledPublicProfileIntentRef.current === intentKey) return;

    lastHandledPublicProfileIntentRef.current = intentKey;
    void openPublicProfileInApp({
      userId: normalizedUserId || undefined,
      username: normalizedUsername || undefined,
      displayNameHint: normalizedUsername || normalizedUserId,
      origin: 'deeplink',
    });
  }, [activeIntent, openPublicProfileInApp]);

  useEffect(() => {
    if (dailyState.status !== 'success') {
      setSelectedDailyMovieId(null);
      setDailyMovieDetailsVisible(false);
      setRitualComposerVisible(false);
      return;
    }
    const movieIds = new Set(dailyState.movies.map((movie) => movie.id));
    setSelectedDailyMovieId((prev) => {
      if (prev !== null && movieIds.has(prev)) return prev;
      return dailyState.movies[0]?.id ?? null;
    });
  }, [dailyState]);

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
    isSignedIn && selectedDailyMovie && ritualDraftText.trim().length > 0
  );
  const isShareRouteActive = screenPlan.screen === 'share_hub';
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
  const themeModeLabel = isDawnTheme ? 'Gündüz' : 'Gece';
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
  const profileBirthDateLabel = normalizeDateLabel(settingsIdentityDraft.birthDate);
  const profileShellTitle = isSignedIn ? profileDisplayName || 'Observer' : 'Profil';
  const profileShellBody = isSignedIn
    ? profileBio || 'Profilini ve arsivini buradan yonet.'
    : 'Profil sekmesi okunur modda acik. Bulut verileri yalnizca oturumla gorunur.';
  const fallbackLeague = resolveMobileLeagueInfoFromXp(0);
  const profileStats = profileState.status === 'success'
    ? {
        league: profileState.leagueName,
        streak: profileState.streak,
        rituals: profileState.ritualsCount,
        marks: profileState.marks.length,
        followers: profileState.followersCount,
        following: profileState.followingCount,
        days: profileState.daysPresent,
      }
    : {
        league: fallbackLeague.leagueInfo.name,
        streak: 0,
        rituals: 0,
        marks: 0,
        followers: 0,
        following: 0,
        days: 0,
      };
  const publicSnapshot = publicProfileModalState.profile;
  const publicProfileStats = publicSnapshot
    ? {
        streak: publicSnapshot.streak,
        rituals: publicSnapshot.ritualsCount,
        marks: publicSnapshot.marks.length,
        followers: publicSnapshot.followersCount,
        following: publicSnapshot.followingCount,
        days: publicSnapshot.daysPresent,
      }
    : {
        streak: 0,
        rituals: 0,
        marks: 0,
        followers: 0,
        following: 0,
        days: 0,
      };
  const publicProfileLeague = publicSnapshot
    ? resolveMobileLeagueInfoFromXp(publicSnapshot.totalXp)
    : null;
  const publicProfileMarksState: ProfileState = publicSnapshot
    ? {
        status: 'success',
        message: 'Public profil marklari yuklendi.',
        displayName: publicSnapshot.displayName,
        totalXp: publicSnapshot.totalXp,
        leagueKey: publicProfileLeague?.leagueKey || fallbackLeague.leagueKey,
        leagueName: publicProfileLeague?.leagueInfo.name || fallbackLeague.leagueInfo.name,
        leagueColor: publicProfileLeague?.leagueInfo.color || fallbackLeague.leagueInfo.color,
        nextLeagueKey: null,
        nextLeagueName: null,
        streak: publicSnapshot.streak,
        ritualsCount: publicSnapshot.ritualsCount,
        daysPresent: publicSnapshot.daysPresent,
        followersCount: publicSnapshot.followersCount,
        followingCount: publicSnapshot.followingCount,
        marks: publicSnapshot.marks,
        featuredMarks: publicSnapshot.featuredMarks,
        lastRitualDate: publicSnapshot.lastRitualDate,
        source: publicSnapshot.source,
      }
    : {
        status: 'idle',
        message: 'Public profil verisi hazir degil.',
      };
  const publicWatchedMovies = useMemo<PublicWatchedMovieSummary[]>(() => {
    const deduped = new Map<
      string,
      {
        id: string;
        movieTitle: string;
        posterPath: string | null;
        year: number | null;
        watchedDayKey: string;
        watchCount: number;
        latestMs: number;
      }
    >();

    for (let index = 0; index < publicProfileFullState.items.length; index += 1) {
      const item = publicProfileFullState.items[index];
      const movieTitle = String(item.movieTitle || '').trim();
      if (!movieTitle) continue;

      const year =
        typeof item.year === 'number' && Number.isFinite(item.year)
          ? Math.floor(item.year)
          : null;
      const parsedMs = Date.parse(String(item.rawTimestamp || '').trim());
      const latestMs = Number.isFinite(parsedMs) ? parsedMs : 0;
      const watchedDayKey = latestMs > 0 ? getLocalDateKey(new Date(latestMs)) : '-';
      const key = `${movieTitle.toLowerCase()}::${year ?? ''}`;
      const existing = deduped.get(key);

      if (existing) {
        existing.watchCount += 1;
        if (latestMs > existing.latestMs) {
          existing.latestMs = latestMs;
          existing.watchedDayKey = watchedDayKey;
          existing.posterPath = String(item.posterPath || '').trim() || existing.posterPath;
        }
        continue;
      }

      deduped.set(key, {
        id: `${key}-${index}`,
        movieTitle,
        posterPath: String(item.posterPath || '').trim() || null,
        year,
        watchedDayKey,
        watchCount: 1,
        latestMs,
      });
    }

    return Array.from(deduped.values())
      .sort((left, right) => right.latestMs - left.latestMs)
      .slice(0, 20)
      .map((entry) => ({
        id: entry.id,
        movieTitle: entry.movieTitle,
        posterPath: entry.posterPath,
        year: entry.year,
        watchedDayKey: entry.watchedDayKey,
        watchCount: entry.watchCount,
      }));
  }, [publicProfileFullState.items]);
  const inviteStatsLabel = inviteProgram.code
    ? `Kod kullanim: ${inviteProgram.claimCount}`
    : 'Davet kodu olusturulunca burada gorunur.';
  const inviteRewardLabel = 'Invitee +180 XP | Inviter +120 XP';
  const activeAccountLabel = profileDisplayName || 'Observer';
  const activeEmailLabel = authState.status === 'signed_in' ? authState.email : '-';
  const shareHandle = String(
    profileUsername || (authState.status === 'signed_in' ? authState.email.split('@')[0] : 'observer')
  )
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  const todayKey = getLocalDateKey();
  const latestOwnComment = useMemo(
    () =>
      commentFeedState.items.find((item) => item.isMine && item.dayKey === todayKey && item.text.trim()) ||
      commentFeedState.items.find((item) => item.isMine && item.text.trim()) ||
      null,
    [commentFeedState.items, todayKey]
  );
  const shareCommentPreview = useMemo(() => {
    const raw = String(latestOwnComment?.text || '').trim();
    if (!raw) return 'Bugunun yorumu henuz hazir degil.';
    return raw.length > 120 ? `${raw.slice(0, 120).trimEnd()}...` : raw;
  }, [latestOwnComment?.text]);
  const effectiveShareInviteCode = String(inviteProgram.code || inviteCode || '').trim();
  const effectiveShareInviteLink = String(inviteProgram.inviteLink || '').trim();
  const canShareComment = Boolean(String(latestOwnComment?.text || '').trim());
  const canShareStreak = canShareComment && profileStats.streak > 0;
  const shareLeagueLabel =
    profileState.status === 'success' ? profileState.leagueName : fallbackLeague.leagueInfo.name;
  const shareTotalXp = profileState.status === 'success' ? profileState.totalXp : 0;

  const handleOpenShareHubFromProfile = useCallback(() => {
    setManualIntent({
      target: 'share',
      invite: effectiveShareInviteCode || undefined,
      platform: 'x',
      goal: canShareStreak ? 'streak' : 'comment',
    });
    if (tabNavigationRef.isReady()) {
      tabNavigationRef.navigate(MAIN_TAB_BY_KEY.profile);
    }
    void trackMobileEvent('page_view', {
      reason: 'mobile_profile_open_share_hub',
      hasInviteCode: Boolean(effectiveShareInviteCode),
      preferredGoal: canShareStreak ? 'streak' : 'comment',
    });
  }, [canShareStreak, effectiveShareInviteCode, setManualIntent]);

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

  const handleEchoComment = useCallback(async (item: CommentFeedState['items'][number]) => {
    if (item.isEchoedByMe) {
      return {
        ok: false,
        message: 'Bu yoruma zaten echo verdin.',
      };
    }

    setCommentFeedState((prev) => ({
      ...prev,
      message: 'Echo senkronize ediliyor...',
      items: prev.items.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              echoCount: entry.echoCount + 1,
              isEchoedByMe: true,
            }
          : entry
      ),
    }));
    setDailyCommentFeedState((prev) => ({
      ...prev,
      message: 'Echo senkronize ediliyor...',
      items: prev.items.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              echoCount: entry.echoCount + 1,
              isEchoedByMe: true,
            }
          : entry
      ),
    }));

    const result = await echoMobileCommentRitual(item.id);
    if (!result.ok) {
      setCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
        items: prev.items.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                echoCount: Math.max(0, entry.echoCount - 1),
                isEchoedByMe: false,
              }
            : entry
        ),
      }));
      setDailyCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
        items: prev.items.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                echoCount: Math.max(0, entry.echoCount - 1),
                isEchoedByMe: false,
              }
            : entry
        ),
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_comment_echo_failed',
        ritualId: item.id,
      });
      return result;
    }

    setCommentFeedState((prev) => ({
      ...prev,
      message: result.message,
    }));
    setDailyCommentFeedState((prev) => ({
      ...prev,
      message: result.message,
    }));
    void trackMobileEvent('page_view', {
      reason: 'mobile_comment_echoed',
      ritualId: item.id,
    });
    return result;
  }, []);

  const handleLoadCommentReplies = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      const result = await fetchMobileCommentReplies(item.id);
      void trackMobileEvent('page_view', {
        reason: result.ok ? 'mobile_comment_replies_loaded' : 'mobile_comment_replies_failed',
        ritualId: item.id,
        replyCount: result.replies.length,
      });
      return result;
    },
    []
  );

  const handleSubmitCommentReply = useCallback(
    async (item: CommentFeedState['items'][number], text: string) => {
      const result = await submitMobileCommentReply({
        ritualId: item.id,
        text,
        fallbackAuthor: profileDisplayName,
      });

      if (result.ok) {
        setCommentFeedState((prev) => ({
          ...prev,
          message: result.message,
          items: prev.items.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  replyCount: entry.replyCount + 1,
                }
              : entry
          ),
        }));
        setDailyCommentFeedState((prev) => ({
          ...prev,
          message: result.message,
          items: prev.items.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  replyCount: entry.replyCount + 1,
                }
              : entry
          ),
        }));
        void trackMobileEvent('page_view', {
          reason: 'mobile_comment_reply_submitted',
          ritualId: item.id,
        });
        return result as { ok: true; reply: MobileCommentReply; message: string };
      }

      setCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
      }));
      setDailyCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_comment_reply_failed',
        ritualId: item.id,
      });
      return result;
    },
    [profileDisplayName]
  );

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
    async (entry: { userId?: string | null; rank: number; displayName: string }) => {
      await openPublicProfileInApp({
        userId: entry.userId,
        username: entry.displayName,
        displayNameHint: entry.displayName,
        origin: 'arena',
      });
    },
    [openPublicProfileInApp]
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

    const normalizedDraft = normalizeMobileProfileIdentityDraft({
      ...settingsIdentityDraft,
      birthDate: normalizeDateLabel(settingsIdentityDraft.birthDate),
    });

    setSettingsSaveState({
      status: 'saving',
      message: 'Profil ayarlari kaydediliyor...',
    });

    try {
      await AsyncStorage.setItem(
        MOBILE_PROFILE_IDENTITY_STORAGE_KEY,
        JSON.stringify(normalizedDraft)
      );
      const syncResult = await syncMobileProfileIdentityToCloud(normalizedDraft);
      if (syncResult.ok) {
        setSettingsIdentityDraft(syncResult.identity);
        setSettingsSaveState({
          status: 'success',
          message: 'Profil ayarlari kaydedildi. Cloud senkronu tamamlandi.',
        });
        void trackMobileEvent('page_view', {
          reason: 'mobile_profile_identity_saved',
          cloudStatus: 'synced',
        });
      } else {
        setSettingsIdentityDraft(normalizedDraft);
        setSettingsSaveState({
          status: 'success',
          message: `Profil ayarlari yerelde kaydedildi. Cloud sync beklemede: ${syncResult.message}`,
        });
        void trackMobileEvent('page_view', {
          reason: 'mobile_profile_identity_saved',
          cloudStatus: 'pending',
          message: syncResult.message,
        });
      }
      void refreshProfileStats();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Profil ayarlari kaydedilemedi.';
      setSettingsSaveState({
        status: 'error',
        message,
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_profile_identity_save_failed',
        message,
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
      setInviteStatus('Kopyalanacak davet linki bulunamadı.');
      return;
    }
    try {
      await Clipboard.setStringAsync(inviteLink);
      setInviteStatus('Davet linki panoya kopyalandı.');
    } catch {
      setInviteStatus('Davet linki kopyalanamadı.');
    }
  }, [inviteProgram.inviteLink]);

  const handleOpenCommentAuthorProfile = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      await openPublicProfileInApp({
        userId: item.userId,
        username: item.author,
        displayNameHint: item.author,
        origin: 'comment',
      });
    },
    [openPublicProfileInApp]
  );

  const handleTogglePublicProfileFollow = useCallback(async () => {
    const targetUserId =
      String(publicProfileTarget?.userId || '').trim() ||
      String(publicProfileModalState.profile?.userId || '').trim();
    if (!targetUserId) return;

    setPublicProfileModalState((prev) => ({
      ...prev,
      followStatus: 'loading',
      followMessage: 'Takip durumu guncelleniyor...',
    }));

    const result = await toggleMobileFollowState(targetUserId);
    if (!result.ok) {
      setPublicProfileModalState((prev) => ({
        ...prev,
        followStatus: 'error',
        followMessage: result.message,
        isFollowing: result.isFollowing,
        isSelfProfile: result.isSelf,
      }));
      return;
    }

    setPublicProfileModalState((prev) => {
      const nextFollowersCount = prev.profile
        ? Math.max(0, prev.profile.followersCount + result.deltaFollowers)
        : 0;
      return {
        ...prev,
        followStatus: 'ready',
        followMessage: result.message,
        isFollowing: result.isFollowing,
        isSelfProfile: result.isSelf,
        profile: prev.profile
          ? {
              ...prev.profile,
              followersCount: nextFollowersCount,
            }
          : prev.profile,
      };
    });
    void refreshProfileStats();
  }, [publicProfileModalState.profile?.userId, publicProfileTarget, refreshProfileStats]);

  const handleRefreshPublicProfileFull = useCallback(async () => {
    const targetUserId =
      String(publicProfileTarget?.userId || '').trim() ||
      String(publicProfileModalState.profile?.userId || '').trim();
    if (!targetUserId) return;

    const displayName =
      String(publicProfileModalState.profile?.displayName || '').trim() ||
      publicProfileModalState.displayNameHint;
    const [profileResult, followResult] = await Promise.all([
      fetchMobilePublicProfileSnapshot({
        userId: targetUserId,
        displayNameHint: displayName,
      }),
      resolveMobileFollowState(targetUserId),
    ]);

    if (profileResult.ok) {
      setPublicProfileModalState((prev) => ({
        ...prev,
        profile: profileResult.profile,
        displayNameHint: profileResult.profile.displayName || displayName,
        status: 'ready',
        message: profileResult.message,
      }));
    }

    setPublicProfileModalState((prev) => ({
      ...prev,
      followStatus: followResult.ok ? 'ready' : 'error',
      followMessage: followResult.message,
      isFollowing: followResult.isFollowing,
      followsYou: followResult.followsYou,
      isSelfProfile: followResult.isSelf,
    }));

    await loadPublicProfileFull({
      userId: targetUserId,
      displayName:
        profileResult.ok && profileResult.profile.displayName
          ? profileResult.profile.displayName
          : displayName,
    });
  }, [
    loadPublicProfileFull,
    publicProfileModalState.displayNameHint,
    publicProfileModalState.profile?.displayName,
    publicProfileModalState.profile?.userId,
    publicProfileTarget,
  ]);

  const handleClosePublicProfileFull = useCallback(() => {
    setPublicProfileFullState((prev) => ({
      ...prev,
      visible: false,
    }));
    setPublicProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: false,
    }));
    setPublicProfileTarget(null);
  }, []);

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

  const handleOpenAccountDeletion = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(MOBILE_ACCOUNT_DELETION_URL);
      if (!canOpen) return;
      await Linking.openURL(MOBILE_ACCOUNT_DELETION_URL);
      void trackMobileEvent('page_view', {
        reason: 'mobile_account_deletion_open',
      });
    } catch {
      // ignore link open failures in account deletion action
    }
  }, []);

  const handleRefreshExploreSurface = useCallback(() => {
    void refreshArenaLeaderboard();
    void refreshCommentFeed(commentFeedScope, debouncedCommentFeedQuery, commentFeedSort);
  }, [commentFeedScope, commentFeedSort, debouncedCommentFeedQuery, refreshArenaLeaderboard, refreshCommentFeed]);

  const handleRefreshProfileSurface = useCallback(() => {
    void refreshProfileStats();
    void refreshWatchedMovies();
    void refreshProfileGenreDistribution();
  }, [refreshProfileGenreDistribution, refreshProfileStats, refreshWatchedMovies]);

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
          message: `Davet kodu uygulandı. +${inviteeRewardXp} XP kazandın.`,
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
          message: `Davet kodu uygulandı. +${inviteeRewardXp} XP kazandın.`,
          inviteeRewardXp,
          inviterRewardXp,
          claimCount,
        });
        setInviteStatus(`Kod uygulandı. +${inviteeRewardXp} XP`);
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

  useEffect(() => {
    if (!isShareRouteActive) return;
    setSelectedShareGoal(shareGoal === 'streak' ? 'streak' : 'comment');
    setShareHubState({
      status: 'idle',
      message:
        shareGoal === 'streak'
          ? 'Streak paylasimi hazir. Platform secip devam et.'
          : 'Yorum paylasimi hazir. Platform secip devam et.',
    });
  }, [isShareRouteActive, shareGoal]);

  useEffect(() => {
    if (!isShareRouteActive) return;
    if (authState.status !== 'signed_in') return;
    if (inviteProgram.code) return;
    if (isInviteActionBusy) return;
    void refreshInviteProgram();
  }, [
    authState.status,
    inviteProgram.code,
    isInviteActionBusy,
    isShareRouteActive,
    refreshInviteProgram,
  ]);

  const handleShareHubShare = useCallback(
    async (platform: SharePlatform) => {
      const goal: ShareGoal = selectedShareGoal;
      const isReady = goal === 'comment' ? canShareComment : canShareStreak;

      void trackMobileEvent('share_click', {
        platform,
        goal,
        isReady,
        hasInviteLink: Boolean(effectiveShareInviteLink),
        hasInviteCode: Boolean(effectiveShareInviteCode),
        hasCommentToday: canShareComment,
        streakValue: profileStats.streak,
      });

      if (!isReady) {
        const message =
          goal === 'comment'
            ? 'Paylasim icin bugun bir yorumun olmali.'
            : 'Streak paylasimi icin bugunku yorum ve aktif streak gerekiyor.';
        setShareHubState({
          status: 'error',
          message,
        });
        void trackMobileEvent('share_failed', {
          platform,
          goal,
          reason: 'goal_not_ready',
        });
        void trackMobileEvent('share_reward_denied', {
          platform,
          goal,
          reason: 'goal_not_ready',
        });
        return;
      }

      const platformTag =
        platform === 'x' ? '#X' : platform === 'tiktok' ? '#TikTok' : '#Instagram';
      const payload =
        goal === 'streak'
          ? [
              '180 Absolute Cinema',
              `${profileDisplayName} (@${shareHandle || 'observer'})`,
              `Bugunku streak tamamlandi: ${profileStats.streak} gun`,
              `${shareLeagueLabel} - ${Math.floor(shareTotalXp)} XP`,
              `${platformTag} #180AbsoluteCinema`,
            ].join('\n')
          : [
              '180 Absolute Cinema',
              `${profileDisplayName} (@${shareHandle || 'observer'})`,
              `${shareLeagueLabel} - ${Math.floor(shareTotalXp)} XP`,
              `"${shareCommentPreview}"`,
              `${platformTag} #180AbsoluteCinema`,
            ].join('\n');

      const shareBaseUrl = normalizeExternalUrl(
        effectiveShareInviteLink || MOBILE_WEB_BASE_URL || 'https://www.180absolutecinema.com'
      );

      let destinationUrl = shareBaseUrl;
      try {
        const shareUrl = new URL(shareBaseUrl);
        shareUrl.searchParams.set('utm_source', 'invite_share');
        shareUrl.searchParams.set('utm_medium', platform);
        shareUrl.searchParams.set('utm_campaign', 'mobile_share_hub');
        shareUrl.searchParams.set('utm_content', `${platform}_${goal}`);
        if (effectiveShareInviteCode) {
          shareUrl.searchParams.set('invite', effectiveShareInviteCode);
        }
        appendMobileDeepLinkParams(shareUrl, {
          type: 'share',
          platform,
          goal,
          inviteCode: effectiveShareInviteCode || undefined,
        });
        destinationUrl = shareUrl.toString();
      } catch {
        setShareHubState({
          status: 'error',
          message: 'Paylasim linki hazirlanamadi.',
        });
        void trackMobileEvent('share_failed', {
          platform,
          goal,
          reason: 'invalid_share_url',
        });
        return;
      }

      const shareMessage = `${payload}\n${destinationUrl}`;
      let copiedToClipboard = false;

      setShareHubState({
        status: 'loading',
        message: 'Paylasim paneli hazirlaniyor...',
      });

      if (platform !== 'x') {
        try {
          await Clipboard.setStringAsync(shareMessage);
          copiedToClipboard = true;
        } catch {
          copiedToClipboard = false;
        }
      }

      try {
        const result = await Share.share({
          title: goal === 'streak' ? 'Streak Paylasimi' : 'Yorum Paylasimi',
          message: shareMessage,
          url: destinationUrl,
        });
        const dismissed = result.action === Share.dismissedAction;
        if (dismissed) {
          setShareHubState({
            status: 'idle',
            message: copiedToClipboard
              ? 'Paylasim iptal edildi. Metin panoda hazir.'
              : 'Paylasim iptal edildi.',
          });
          void trackMobileEvent('share_failed', {
            platform,
            goal,
            reason: 'native_share_dismissed',
            clipboardPrepared: copiedToClipboard,
          });
          return;
        }

        setShareHubState({
          status: 'ready',
          message: copiedToClipboard
            ? 'Paylasim paneli acildi. Metin panoya da kopyalandi.'
            : 'Paylasim paneli acildi.',
        });
        void trackMobileEvent('share_opened', {
          platform,
          goal,
          destinationUrl,
          clipboardPrepared: copiedToClipboard,
          hasInviteCode: Boolean(effectiveShareInviteCode),
          hasAppLink: destinationUrl.includes('app_link='),
        });

        const rewardResult = await claimMobileShareReward({
          platform,
          goal,
          fallbackTotalXp: shareTotalXp,
          fallbackStreak: profileStats.streak,
          fallbackDisplayName: profileDisplayName,
          fallbackLastRitualDate:
            profileState.status === 'success' ? profileState.lastRitualDate : latestOwnComment?.dayKey || null,
          fallbackMarks: profileState.status === 'success' ? profileState.marks : [],
          fallbackFeaturedMarks:
            profileState.status === 'success' ? profileState.featuredMarks : [],
          fallbackReferralCode: effectiveShareInviteCode || undefined,
          fallbackFollowersCount:
            profileState.status === 'success' ? profileState.followersCount : 0,
          fallbackIdentity: {
            fullName: settingsIdentityDraft.fullName || profileDisplayName,
            username: settingsIdentityDraft.username || shareHandle,
            gender: settingsIdentityDraft.gender,
            birthDate: settingsIdentityDraft.birthDate,
            bio: settingsIdentityDraft.bio,
            avatarUrl: settingsIdentityDraft.avatarUrl,
            profileLink: settingsIdentityDraft.profileLink,
          },
          fallbackComment: latestOwnComment
            ? {
                id: latestOwnComment.id,
                text: latestOwnComment.text,
                movieTitle: latestOwnComment.movieTitle,
                dayKey: latestOwnComment.dayKey,
              }
            : null,
        });

        if (rewardResult.ok) {
          setShareHubState({
            status: 'ready',
            message: copiedToClipboard
              ? `Paylasim paneli acildi. Metin panoya kopyalandi. +${MOBILE_SHARE_REWARD_XP} XP eklendi.`
              : `Paylasim paneli acildi. +${MOBILE_SHARE_REWARD_XP} XP eklendi.`,
          });
          void trackMobileEvent('share_reward_claimed', {
            platform,
            goal,
            awardedXp: rewardResult.awardedXp,
            totalXp: rewardResult.totalXp,
            rewardDate: rewardResult.rewardDate,
          });
          void refreshProfileStats();
          return;
        }

        setShareHubState({
          status: rewardResult.reason === 'already_claimed' ? 'ready' : 'error',
          message:
            rewardResult.reason === 'already_claimed'
              ? copiedToClipboard
                ? 'Paylasim paneli acildi. Metin panoda hazir. Bugunki bonus zaten alinmis.'
                : 'Paylasim paneli acildi. Bugunki bonus zaten alinmis.'
              : copiedToClipboard
                ? 'Paylasim acildi ama XP bonusu kaydedilemedi. Metin panoda hazir.'
                : 'Paylasim acildi ama XP bonusu kaydedilemedi.',
        });
        void trackMobileEvent('share_reward_denied', {
          platform,
          goal,
          reason: rewardResult.reason,
          rewardDate: rewardResult.rewardDate || null,
          totalXp: rewardResult.totalXp ?? null,
          message: rewardResult.message,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'native_share_failed';
        setShareHubState({
          status: 'error',
          message: copiedToClipboard
            ? 'Paylasim acilamadi. Metin panoda hazir.'
            : 'Paylasim acilamadi. Tekrar dene.',
        });
        void trackMobileEvent('share_failed', {
          platform,
          goal,
          reason: 'native_share_exception',
          clipboardPrepared: copiedToClipboard,
          errorMessage,
        });
      }
    },
    [
      canShareComment,
      canShareStreak,
      effectiveShareInviteCode,
      effectiveShareInviteLink,
      profileDisplayName,
      profileState,
      profileStats.streak,
      refreshProfileStats,
      selectedShareGoal,
      settingsIdentityDraft,
      shareCommentPreview,
      shareHandle,
      shareLeagueLabel,
      shareTotalXp,
      latestOwnComment,
    ]
  );

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
          style={[
            styles.backdropLayer,
            { pointerEvents: 'none' },
            isDawnTheme ? styles.backdropLayerDawn : null,
          ]}
        />
        <LeaguePromotionModal
          event={leaguePromotionEvent}
          onClose={() => setLeaguePromotionEvent(null)}
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
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.navTabLabel,
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
                      selectedMovieId={selectedDailyMovieId}
                      onSelectMovie={(movieId) => {
                        setSelectedDailyMovieId(movieId);
                        setDailyMovieDetailsVisible(true);
                      }}
                      onRetry={() => {
                        void loadDailyMovies();
                      }}
                    />
                    <CommentFeedCard
                      state={dailyCommentFeedState}
                      showFilters={false}
                      showOpsMeta={isDevSurfaceEnabled}
                      onScopeChange={() => undefined}
                      onSortChange={() => undefined}
                      onQueryChange={() => undefined}
                      onEcho={handleEchoComment}
                      onLoadReplies={handleLoadCommentReplies}
                      onSubmitReply={handleSubmitCommentReply}
                      onOpenAuthorProfile={handleOpenCommentAuthorProfile}
                      onRefresh={() => {
                        void refreshDailyCommentFeed();
                      }}
                    />

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
                    <SectionLeadCard
                      accent="sage"
                      eyebrow="Kesif Merkezi"
                      title="Nereye bakacagini once buradan sec"
                      body="Rota ac, arena siralamasina bak ve yorum akisindan kullanici profillerine gec."
                      badges={[
                        { label: `${DISCOVER_ROUTES.length} rota`, tone: 'sage' },
                        {
                          label: commentFeedScope === 'today' ? 'Bugun filtresi' : 'Tum akis',
                          tone: 'muted',
                        },
                        {
                          label: arenaState.source === 'live' ? 'Arena canli' : 'Arena fallback',
                          tone: arenaState.source === 'live' ? 'sage' : 'clay',
                        },
                      ]}
                      metrics={[
                        { label: 'Seri', value: streakSummary },
                        { label: 'Ritual', value: ritualsCountSummary },
                        { label: 'Arena', value: String(arenaState.entries.length || 0) },
                        {
                          label: 'Yorum',
                          value:
                            commentFeedState.status === 'ready'
                              ? String(commentFeedState.items.length)
                              : commentFeedState.status === 'loading'
                                ? '...'
                                : '--',
                        },
                      ]}
                      actions={[
                        {
                          label: 'Arena Yenile',
                          tone: 'neutral',
                          onPress: handleRefreshExploreSurface,
                        },
                      ]}
                    />
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Kesif</Text>
                        <Text style={styles.sectionHeaderMeta}>Rotalar</Text>
                      </View>
                    </View>
                    <DiscoverRoutesCard
                      routes={DISCOVER_ROUTES}
                      onOpenRoute={(route) => {
                        void handleOpenDiscoverRoute(route);
                      }}
                    />
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Arena</Text>
                        <Text style={styles.sectionHeaderMeta}>Haftalik siralama</Text>
                      </View>
                    </View>
                    <ArenaChallengeCard
                      streakLabel={streakSummary}
                      ritualsLabel={ritualsCountSummary}
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
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Sosyal Akis</Text>
                        <Text style={styles.sectionHeaderMeta}>{commentFeedSummary}</Text>
                      </View>
                    </View>
                    <CommentFeedCard
                      state={commentFeedState}
                      showFilters
                      showOpsMeta={isDevSurfaceEnabled}
                      onScopeChange={handleCommentFeedScopeChange}
                      onSortChange={handleCommentFeedSortChange}
                      onQueryChange={handleCommentFeedQueryChange}
                      onEcho={handleEchoComment}
                      onLoadReplies={handleLoadCommentReplies}
                      onSubmitReply={handleSubmitCommentReply}
                      onOpenAuthorProfile={handleOpenCommentAuthorProfile}
                      onRefresh={() => {
                        void refreshCommentFeed(
                          commentFeedScope,
                          debouncedCommentFeedQuery,
                          commentFeedSort
                        );
                      }}
                    />
                    {isDevSurfaceEnabled ? <PlatformRulesCard /> : null}
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
                          title: 'Marklar',
                          body: 'Rozet arsivini tek sekmeden takip et.',
                          badges: [
                            { label: `Seri ${streakSummary}` },
                            { label: `Ritual ${ritualsCountSummary}` },
                          ],
                        })
                      : null}
                    <View style={styles.sectionAnchor}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Marklar</Text>
                        <Text style={styles.sectionHeaderMeta}>Koleksiyon</Text>
                      </View>
                    </View>
                    <ProfileMarksCard state={profileState} isSignedIn={isSignedIn} mode="all" />
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
                    {publicProfileFullState.visible ? (
                      <>
                        <SectionLeadCard
                          accent="clay"
                          eyebrow="Public Profil"
                          title={
                            publicSnapshot?.displayName || publicProfileFullState.displayName || '@bilinmeyen'
                          }
                          body={
                            publicProfileModalState.followMessage ||
                            publicProfileFullState.message ||
                            'Bu kullanicinin film izi ve yorum akisina bak.'
                          }
                          badges={[
                            {
                              label: publicProfileModalState.isSelfProfile ? 'Kendi Profilin' : 'Public Yuzey',
                              tone: 'muted',
                            },
                            ...(publicSnapshot?.lastRitualDate
                              ? [{ label: `Son ritual ${publicSnapshot.lastRitualDate}`, tone: 'sage' as const }]
                              : []),
                            ...(publicProfileModalState.followsYou
                              ? [{ label: 'Seni takip ediyor', tone: 'clay' as const }]
                              : []),
                          ]}
                          metrics={[
                            { label: 'Ritual', value: String(publicProfileStats.rituals) },
                            { label: 'Streak', value: String(publicProfileStats.streak) },
                            { label: 'Takipci', value: String(publicProfileStats.followers) },
                            { label: 'Takip', value: String(publicProfileStats.following) },
                          ]}
                          actions={[
                            ...(!publicProfileModalState.isSelfProfile && isSignedIn
                              ? [
                                  {
                                    label: publicProfileModalState.isFollowing ? 'Takipten Cik' : 'Takip Et',
                                    tone: 'brand' as const,
                                    onPress: () => {
                                      void handleTogglePublicProfileFollow();
                                    },
                                    disabled: publicProfileModalState.followStatus === 'loading',
                                  },
                                ]
                              : []),
                            {
                              label: 'Yenile',
                              tone: 'neutral' as const,
                              onPress: () => {
                                void handleRefreshPublicProfileFull();
                              },
                            },
                            {
                              label: 'Kendi Profilim',
                              tone: 'teal' as const,
                              onPress: handleClosePublicProfileFull,
                            },
                          ]}
                        />

                        <CollapsibleSectionCard
                          accent="sage"
                          title="Film Arsivi"
                          meta={`${publicWatchedMovies.length} film`}
                          defaultExpanded
                        >
                          {publicWatchedMovies.length > 0 ? (
                            <View style={styles.movieList}>
                              {publicWatchedMovies.map((movie) => (
                                <Pressable
                                  key={movie.id}
                                  style={({ pressed }) => [
                                    styles.movieRow,
                                    pressed ? styles.movieRowPressed : null,
                                  ]}
                                  onPress={() => {
                                    handleOpenPublicProfileMovieArchive(movie);
                                  }}
                                  hitSlop={8}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${movie.movieTitle} public film arsivini ac`}
                                >
                                  <Text style={styles.movieTitle}>{movie.movieTitle}</Text>
                                  <Text style={styles.movieMeta}>
                                    {movie.year ? `${movie.year} | ` : ''}
                                    Son izleme: {movie.watchedDayKey || '-'}
                                    {movie.watchCount > 1 ? ` | Tekrar: ${movie.watchCount}` : ''}
                                  </Text>
                                  <Text style={styles.movieRowActionHint}>Public Arsivi Ac</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : (
                            <StatePanel
                              tone="sage"
                              variant={
                                publicProfileFullState.status === 'loading'
                                  ? 'loading'
                                  : publicProfileFullState.status === 'error'
                                    ? 'error'
                                    : 'empty'
                              }
                              eyebrow="Public Film Arsivi"
                              title={
                                publicProfileFullState.status === 'loading'
                                  ? 'Film izi taraniyor'
                                  : publicProfileFullState.status === 'error'
                                    ? 'Film arsivi okunamadi'
                                    : 'Bu profilde henuz film izi yok'
                              }
                              body={
                                publicProfileFullState.status === 'error'
                                  ? publicProfileFullState.message ||
                                    'Public film arsivi okunurken gecici bir sorun olustu.'
                                  : 'Izlenen filmler ve tekrar sayilari burada gruplanir.'
                              }
                              meta="Film satirina dokununca o filme ait public yorum arsivi acilir."
                              actionLabel={
                                publicProfileFullState.status === 'loading'
                                  ? undefined
                                  : 'Public Profili Yenile'
                              }
                              onAction={() => {
                                void handleRefreshPublicProfileFull();
                              }}
                            />
                          )}
                        </CollapsibleSectionCard>

                        <View style={styles.sectionAnchor}>
                          <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionHeader}>Marklar</Text>
                            <Text style={styles.sectionHeaderMeta}>{publicProfileStats.marks} acik mark</Text>
                          </View>
                        </View>
                        <ProfileMarksCard
                          state={publicProfileMarksState}
                          isSignedIn={isSignedIn || Boolean(publicSnapshot)}
                          mode="unlocked"
                        />

                        <CollapsibleSectionCard
                          accent="clay"
                          title="Yorum Akisi"
                          meta={`${publicProfileFullState.items.length} kayit`}
                          defaultExpanded={false}
                        >
                          {publicProfileFullState.status === 'loading' ? (
                            <StatePanel
                              tone="clay"
                              variant="loading"
                              eyebrow="Public Yorum Akisi"
                              title="Aktivite akisi yukleniyor"
                              body="Bu kullanicinin acik ritual yorumlari ve film izleri cekiliyor."
                              meta="Yorum akisi tarih sirasiyla siralanir."
                            />
                          ) : publicProfileFullState.items.length > 0 ? (
                            <View style={styles.commentFeedList}>
                              {publicProfileFullState.items.map((item) => (
                                <View key={item.id} style={styles.commentFeedRow}>
                                  <Text style={styles.commentFeedMovieTitle}>
                                    {item.movieTitle}
                                    {item.year ? ` (${item.year})` : ''}
                                  </Text>
                                  <Text style={styles.commentFeedMeta}>{item.timestampLabel}</Text>
                                  <Text style={styles.commentFeedBody}>{item.text}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <StatePanel
                              tone="clay"
                              variant={publicProfileFullState.status === 'error' ? 'error' : 'empty'}
                              eyebrow="Public Yorum Akisi"
                              title={
                                publicProfileFullState.status === 'error'
                                  ? 'Yorum akisi okunamadi'
                                  : 'Bu profilde henuz yorum yok'
                              }
                              body={
                                publicProfileFullState.status === 'error'
                                  ? publicProfileFullState.message ||
                                    'Public yorum akisi okunurken gecici bir sorun olustu.'
                                  : 'Kullanici yeni ritual yazdikca yorum akisi burada gorunur.'
                              }
                              meta="Yorumlara dokunmadan once ustteki film arsivinden baglam alabilirsin."
                              actionLabel="Public Profili Yenile"
                              onAction={() => {
                                void handleRefreshPublicProfileFull();
                              }}
                            />
                          )}
                        </CollapsibleSectionCard>
                      </>
                    ) : null}
                    {!publicProfileFullState.visible ? (
                      <>
                    {isSignedIn ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Pressable
                          style={styles.profileSettingsButton}
                          onPress={() => setSettingsVisible(true)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Ayarlar"
                        >
                          <Ionicons name="settings-sharp" size={18} color="#E5E4E2" />
                        </Pressable>
                      </View>
                    ) : null}
                    <SectionLeadCard
                      accent="sage"
                      eyebrow="Profil Merkezi"
                      title={profileShellTitle}
                      body={profileShellBody}
                      badges={[
                        { label: profileStats.league, tone: 'sage' },
                        { label: themeModeLabel, tone: 'muted' },
                        ...(profileUsername ? [{ label: `@${profileUsername}`, tone: 'muted' as const }] : []),
                      ]}
                      metrics={[
                        { label: 'Ritual', value: String(profileStats.rituals) },
                        { label: 'Streak', value: String(profileStats.streak) },
                        { label: 'Mark', value: String(profileStats.marks) },
                        { label: 'Takipci', value: String(profileStats.followers) },
                      ]}
                      actions={[
                        ...(isSignedIn
                          ? [
                              {
                                label: profileLink ? 'Linki Ac' : 'Paylasim Alani',
                                tone: 'teal' as const,
                                onPress: () => {
                                  if (profileLink) {
                                    void handleOpenProfileLink();
                                    return;
                                  }
                                  handleOpenShareHubFromProfile();
                                },
                              },
                            ]
                          : []),
                        {
                          label: 'Yenile',
                          tone: 'neutral',
                          onPress: handleRefreshProfileSurface,
                        },
                      ]}
                    />
                    {isSignedIn ? (
                      <>
                        <ProfileXpCard
                          state={profileState}
                          onRefresh={handleRefreshProfileSurface}
                        />

                        <ProfileIdentityCard
                          displayName={profileDisplayName || 'Izleyici'}
                          username={profileUsername}
                          bio={profileBio}
                          birthDateLabel={profileBirthDateLabel}
                          followingCount={profileStats.following}
                          followersCount={profileStats.followers}
                          profileLink={profileLink}
                          onOpenProfileLink={() => {
                            void handleOpenProfileLink();
                          }}
                        />

                        <ProfileGenreDistributionCard
                          items={profileGenreDistribution}
                          isSignedIn={isSignedIn}
                          onRefresh={() => {
                            void refreshProfileGenreDistribution();
                          }}
                        />

                        <WatchedMoviesCard
                          state={watchedMoviesState}
                          isSignedIn={isSignedIn}
                          onRefresh={() => {
                            void refreshWatchedMovies();
                          }}
                          onOpenMovieArchive={(movie) => {
                            void handleOpenProfileMovieArchive(movie);
                          }}
                        />

                        <View style={styles.sectionAnchor}>
                          <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionHeader}>Marklar</Text>
                            <Text style={styles.sectionHeaderMeta}>{profileStats.marks} acik mark</Text>
                          </View>
                        </View>
                        <ProfileMarksCard state={profileState} isSignedIn={isSignedIn} mode="unlocked" />

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
                            inviteLink={effectiveShareInviteLink}
                            platform={sharePlatform}
                            goal={selectedShareGoal}
                            streakValue={profileState.status === 'success' ? profileState.streak : 0}
                            commentPreview={shareCommentPreview}
                            canShareComment={canShareComment}
                            canShareStreak={canShareStreak}
                            shareStatus={shareHubState.message}
                            shareStatusTone={shareHubState.status}
                            onSetGoal={setSelectedShareGoal}
                            onShare={handleShareHubShare}
                          />
                        ) : null}
                      </>
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
                    {isSignedIn ? (
                      <View style={[styles.singleActionRow, { marginTop: 12 }]}>
                        <UiButton
                          label="Cikis Yap"
                          tone="danger"
                          stretch
                          onPress={() => {
                            void handleSignOut();
                          }}
                        />
                      </View>
                    ) : null}
                      </>
                    ) : null}
                  </ScrollView>
                )}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>

          <AuthModal
            visible={authModalVisible}
            onClose={() => {
              if (authState.status === 'loading') return;
              setAuthModalVisible(false);
            }}
            authState={authState}
            email={authEmail}
            fullName={authFullName}
            username={authUsername}
            birthDate={authBirthDate}
            password={authPassword}
            confirmPassword={authConfirmPassword}
            mode={authFlowMode}
            onEmailChange={setAuthEmail}
            onFullNameChange={setAuthFullName}
            onUsernameChange={setAuthUsername}
            onBirthDateChange={setAuthBirthDate}
            onPasswordChange={setAuthPassword}
            onConfirmPasswordChange={setAuthConfirmPassword}
            onModeChange={setAuthFlowMode}
            onSignIn={handleSignIn}
            onRegister={handleRegister}
            rememberMe={authRememberMe}
            onRememberMeChange={handleSetAuthRememberMe}
            showAppleSignIn={Platform.OS === 'ios' && appleAuthAvailable}
            onAppleSignIn={handleAppleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            onRequestPasswordReset={handleRequestPasswordReset}
            onCompletePasswordReset={handleCompletePasswordReset}
          />

          <MovieDetailsModal
            movie={
              dailyMovieDetailsVisible && selectedDailyMovie
                ? {
                    title: selectedDailyMovie.title,
                    overview: selectedDailyMovie.overview,
                    voteAverage: selectedDailyMovie.voteAverage,
                    genre: selectedDailyMovie.genre,
                    year: selectedDailyMovie.year,
                    director: selectedDailyMovie.director,
                    cast: selectedDailyMovie.cast,
                    posterPath: selectedDailyMovie.posterPath,
                    originalLanguage: selectedDailyMovie.originalLanguage,
                  }
                : null
            }
            onClose={() => setDailyMovieDetailsVisible(false)}
            onOpenCommentComposer={() => {
              setDailyMovieDetailsVisible(false);
              setRitualComposerVisible(true);
            }}
          />

          <RitualComposerModal
            visible={ritualComposerVisible}
            targetMovie={
              selectedDailyMovie
                ? {
                    title: selectedDailyMovie.title,
                    genre: selectedDailyMovie.genre,
                    year: selectedDailyMovie.year,
                    director: selectedDailyMovie.director,
                  }
                : null
            }
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
            onClose={() => setRitualComposerVisible(false)}
          />

          <ProfileMovieArchiveModal
            visible={profileMovieArchiveModalState.visible}
            status={profileMovieArchiveModalState.status}
            message={profileMovieArchiveModalState.message}
            movie={profileMovieArchiveModalState.movie}
            entries={profileMovieArchiveModalState.entries}
            onRefresh={handleRefreshProfileMovieArchive}
            onClose={handleCloseProfileMovieArchive}
          />

          <PublicProfileMovieArchiveModal
            visible={publicProfileMovieArchiveModalState.visible}
            status={publicProfileMovieArchiveModalState.status}
            message={publicProfileMovieArchiveModalState.message}
            displayName={publicProfileMovieArchiveModalState.displayName}
            movie={publicProfileMovieArchiveModalState.movie}
            items={publicProfileMovieArchiveModalState.items}
            onRefresh={() => {
              void handleRefreshPublicProfileMovieArchive();
            }}
            onClose={handleClosePublicProfileMovieArchive}
          />

          <MobileSettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            identityDraft={settingsIdentityDraft}
            onChangeIdentity={handleChangeSettingsIdentity}
            onSaveIdentity={handleSaveSettingsIdentity}
            saveState={settingsSaveState}
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
            onOpenAccountDeletion={() => {
              void handleOpenAccountDeletion();
            }}
          />
        </Animated.View>
        <StatusBar style={isDawnTheme ? 'dark' : 'light'} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

