import type { DocumentPickerAsset } from 'expo-document-picker';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  createNavigationContainerRef,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendMobileDeepLinkParams,
  buildMobileDeepLinkFromRouteIntent,
  type MobileScreenId,
} from '../../packages/shared/src/mobile';
import { buildLeagueNotificationCopy, buildStreakNotificationCopy, isStreakMilestone } from '../../src/domain/celebrations';
import { fetchDailyMovies } from './src/lib/dailyApi';
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
  LEVEL_THRESHOLD,
  MOBILE_LEAGUE_NAMES,
  getLeagueIndexFromXp,
  getMobileLeagueTierInfo,
  resolveMobileLeagueInfo,
  resolveMobileLeagueInfoFromXp,
  resolveMobileLeagueKeyFromXp,
  resolveMobileNextLeagueKey,
} from './src/lib/mobileLeagueSystem';
import { resolveMobileFollowState, toggleMobileFollowState } from './src/lib/mobileFollowState';
import { fetchMobileProfileStats } from './src/lib/mobileProfileStats';
import {
  fetchMobilePublicProfileSnapshot,
  type MobilePublicProfileSnapshot,
} from './src/lib/mobilePublicProfileSnapshot';
import { normalizeMobileAvatarUrl, resolveMobileAvatarFromXpState } from './src/lib/mobileAvatar';
import {
  fetchMobilePublicProfileActivity,
  type MobilePublicProfileActivityItem,
} from './src/lib/mobilePublicProfileActivity';
import { resolveStoredProfileMarks } from '../../src/domain/profileMarks';
import { readProfileTotalXp } from '../../src/domain/profileXpState';
import {
  fetchMobileProfileActivity,
  type MobileProfileActivityItem,
} from './src/lib/mobileProfileActivity';
import { type MobileWatchedMovie } from './src/lib/mobileProfileWatchedMovies';
import { QuizHomeScreen } from './src/ui/quizScreens';
import { PaywallModal } from './src/ui/paywallScreen';
import { useSubscription } from './src/lib/useSubscription';
import { useWallet } from './src/lib/useWallet';
import { WalletModal } from './src/ui/walletScreen';
import {
  formatMobileLetterboxdSummary,
  importMobileLetterboxdCsv,
  readStoredMobileLetterboxdImport,
  type StoredMobileLetterboxdImport,
} from './src/lib/mobileLetterboxdImport';
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
import {
  getDefaultMobileProfileVisibility,
  normalizeMobileProfileVisibility,
  readMobileProfilePrivacyFromCloud,
  syncMobileProfilePrivacyToCloud,
  type MobileProfileVisibility,
} from './src/lib/mobileProfilePrivacySync';
import { applyMobileAuthCallbackFromUrl } from './src/lib/mobileAuthCallback';
import {
  readMobileUserSettingsFromCloud,
  syncMobileUserSettingsToCloud,
} from './src/lib/mobileUserSettingsCloud';
import {
  resolveMobileAuthCallbackUrl,
  resolveMobileAuthReturnUrl,
} from './src/lib/mobileAuthRedirect';
import {
  fetchMobileCommentFeed,
  type CommentFeedScope,
  type CommentFeedSort,
} from './src/lib/mobileCommentsFeed';
import {
  deleteMobileCommentRitual,
  echoMobileCommentRitual,
  echoMobileCommentReply,
  fetchMobileCommentReplies,
  submitMobileCommentReply,
  type MobileCommentReply,
} from './src/lib/mobileCommentInteractions';
import type { PushNotificationSnapshot } from './src/lib/mobilePush';
import {
  fetchRecentMobileNotificationEvents,
  markMobileNotificationEventsRead,
  subscribeToMobileNotificationEvents,
} from './src/lib/mobileNotificationEvents';
import {
  appendPushInboxItem,
  clearPushInbox,
  readPushInbox,
  removePushInboxItems,
  type PushInboxItem,
} from './src/lib/mobilePushInbox';
import {
  sendEngagementPushNotification,
  sendPushTestNotification,
} from './src/lib/mobilePushApi';
import { claimInviteCodeViaApi, persistClaimedInviteCode, readPersistedClaimedInviteCode } from './src/lib/mobileReferralApi';
import {
  claimMobileShareReward,
  MOBILE_SHARE_REWARD_XP,
} from './src/lib/mobileShareRewardSync';
import { deleteMobileAccount } from './src/lib/mobileAccountDeletion';
import { isSupabaseConfigured, readSupabaseSessionSafe, supabase } from './src/lib/supabase';
import {
  resolveSupabaseUserAuthLabel,
  resolveSupabaseUserAvatarUrl,
  resolveSupabaseUserDisplayName,
  resolveSupabaseUserEmailConfirmedAt,
  resolveSupabaseUserEmail,
  isSupabaseUserEmailVerified,
} from './src/lib/supabaseUser';
import { UiButton } from './src/ui/primitives';
import { styles } from './src/ui/appStyles';
import { type WalletStoreItemKey } from '../../src/domain/progressionEconomy';
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
import type {
  MobileAuthEntryStage,
  MobileLeaguePromotionEvent,
  MobileMarkUnlockEvent,
  MobileSettingsIdentityDraft,
  MobileSettingsLanguage,
  MobileSettingsPrivacyDraft,
  MobileSettingsSaveState,
  MobileStreakCelebrationEvent,
  TierAdvancementEvent,
} from './src/ui/appScreens';
import { resolveMobileWebBaseUrl } from './src/lib/mobileEnv';
import {
  readStoredMobileThemeMode,
  writeStoredMobileThemeMode,
  type MobileThemeMode,
} from './src/lib/mobileThemeMode';
import { useBackHandler } from './src/hooks/useBackHandler';
import { getDeviceLanguage, mobileTranslations } from './src/i18n';
import { SearchModal } from './src/ui/searchScreen';
import { MoviePageModal } from './src/ui/moviePageScreen';

const debugRequireAppDependency = <T,>(label: string, loader: () => T): T => {
  console.log('APP_IMPORT_STAGE', label);
  return loader();
};

const toImportErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error ?? 'unknown_error');

const isMissingExpoFontLoaderError = (error: unknown): boolean =>
  toImportErrorMessage(error).includes("Cannot find native module 'ExpoFontLoader'");

const debugRequireAppDependencyWithFallback = <T,>(
  label: string,
  loader: () => T,
  fallback: (error: unknown) => T
): T => {
  console.log('APP_IMPORT_STAGE', label);
  try {
    return loader();
  } catch (error) {
    if (!isMissingExpoFontLoaderError(error)) {
      throw error;
    }
    console.warn('APP_IMPORT_FALLBACK', label, toImportErrorMessage(error));
    return fallback(error);
  }
};

const FALLBACK_APP_FONT_FAMILY =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }) ?? 'sans-serif';

const { StatusBar } = debugRequireAppDependency(
  'expo-status-bar',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-status-bar') as typeof import('expo-status-bar')
);
const { Ionicons } = debugRequireAppDependencyWithFallback(
  '@expo/vector-icons',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@expo/vector-icons') as typeof import('@expo/vector-icons'),
  () =>
    ({
    Ionicons: ({
      size = 18,
      color = '#e5e4e2',
      style,
    }: {
      size?: number;
      color?: string;
      style?: ComponentProps<typeof Text>['style'];
    }) => (
      <Text
        style={[
          {
            color,
            fontFamily: FALLBACK_APP_FONT_FAMILY,
            fontSize: size,
            lineHeight: size * 1.1,
            textAlign: 'center',
          },
          style,
        ]}
      >
        *
      </Text>
    ),
    }) as unknown as typeof import('@expo/vector-icons')
);
const DocumentPicker = debugRequireAppDependency(
  'expo-document-picker',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-document-picker') as typeof import('expo-document-picker')
);
const { File: ExpoFile } = debugRequireAppDependency(
  'expo-file-system',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-file-system') as typeof import('expo-file-system')
);
const WebBrowser = debugRequireAppDependency(
  'expo-web-browser',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-web-browser') as typeof import('expo-web-browser')
);
const {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} = debugRequireAppDependencyWithFallback(
  '@expo-google-fonts/inter',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@expo-google-fonts/inter') as typeof import('@expo-google-fonts/inter'),
  () =>
    ({
      Inter_400Regular: FALLBACK_APP_FONT_FAMILY,
      Inter_500Medium: FALLBACK_APP_FONT_FAMILY,
      Inter_600SemiBold: FALLBACK_APP_FONT_FAMILY,
      Inter_700Bold: FALLBACK_APP_FONT_FAMILY,
      useFonts: () => [true, null] as const,
    }) as unknown as typeof import('@expo-google-fonts/inter')
);
const { useMobileRouteIntent } = debugRequireAppDependency(
  './src/hooks/useMobileRouteIntent',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./src/hooks/useMobileRouteIntent') as typeof import('./src/hooks/useMobileRouteIntent')
);
const {
  configureDefaultNotificationHandler,
  readStoredPushToken,
  registerForPushNotifications,
  sendLocalPushSimulation,
  subscribeToPushNotifications,
} = debugRequireAppDependency(
  './src/lib/mobilePush',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('./src/lib/mobilePush') as typeof import('./src/lib/mobilePush')
);
const { syncPushTokenToProfileState } = debugRequireAppDependency(
  './src/lib/mobilePushProfileSync',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./src/lib/mobilePushProfileSync') as typeof import('./src/lib/mobilePushProfileSync')
);
const {
  AvatarView,
  ArenaLeaderboardCard,
  AuthGateScreen,
  AuthModal,
  buildDailyGreetingCard,
  CollapsibleSectionCard,
  CommentFeedCard,
  DailyHomeScreen,
  InviteClaimScreen,
  LeaguePromotionModal,
  MarkUnlockModal,
  MobileSettingsModal,
  MovieDetailsModal,
  ProfileCommentsModal,
  ProfileCinematicCard,
  ProfileFollowListModal,
  ProfileMarksCard,
  ProfileMarksModal,
  ProfileMovieArchiveModal,
  ProfileUnifiedCard,
  PublicProfileMovieArchiveModal,
  PushInboxCard,
  PushStatusCard,
  RitualComposerModal,
  ScreenErrorBoundary,
  setAppScreensThemeMode,
  StatePanel,
  StreakCelebrationModal,
  TierAdvancementModal,
  XpGainToast,
} = debugRequireAppDependency(
  './src/ui/appScreens',
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('./src/ui/appScreens') as typeof import('./src/ui/appScreens')
);

const isEnvFlagEnabled = (value: string | undefined, defaultValue = true): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(normalized);
};

const PUSH_FEATURE_ENABLED = isEnvFlagEnabled(process.env.EXPO_PUBLIC_PUSH_ENABLED, true);
const INTERNAL_OPS_VISIBLE =
  __DEV__ && isEnvFlagEnabled(process.env.EXPO_PUBLIC_MOBILE_INTERNAL_SURFACES, false);
const MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';
const MOBILE_AUTH_RETURN_TO = resolveMobileAuthReturnUrl();
const MOBILE_AUTH_CALLBACK_URL = resolveMobileAuthCallbackUrl();
const MOBILE_UI_PACKAGE_LABEL = 'UI Package 6.46';
const MOBILE_PROFILE_IDENTITY_STORAGE_KEY = 'ac_mobile_profile_identity_v1';
const MOBILE_PROFILE_LANGUAGE_STORAGE_KEY = 'ac_mobile_profile_language_v1';
const MOBILE_PROFILE_PRIVACY_STORAGE_KEY = 'ac_mobile_profile_privacy_v1';
const MOBILE_AUTH_REMEMBER_ME_STORAGE_KEY = 'ac_mobile_auth_remember_me_v1';
const MOBILE_AUTH_REMEMBER_ME_ENABLED = '1';
const MOBILE_AUTH_REMEMBER_ME_DISABLED = '0';

const MOBILE_WEB_BASE_URL = resolveMobileWebBaseUrl();
const MOBILE_ACCOUNT_DELETION_URL = MOBILE_WEB_BASE_URL
  ? `${MOBILE_WEB_BASE_URL}/account-deletion/`
  : 'https://180absolutecinema.com/account-deletion/';

const writeClipboardString = async (value: string): Promise<boolean> => {
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
};

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_SETTINGS_IDENTITY: MobileSettingsIdentityDraft = {
  fullName: '',
  username: '',
  gender: '',
  birthDate: '',
  bio: '',
  avatarUrl: '',
  profileLink: '',
};
const DEFAULT_SETTINGS_PRIVACY: MobileProfileVisibility = getDefaultMobileProfileVisibility();

const buildSignedInAuthState = (
  user: Parameters<typeof resolveSupabaseUserAuthLabel>[0],
  message: string
): AuthState => ({
  status: 'signed_in',
  message,
  email: resolveSupabaseUserAuthLabel(user),
  emailVerified: isSupabaseUserEmailVerified(user),
  emailConfirmedAt: resolveSupabaseUserEmailConfirmedAt(user),
});

const normalizeExternalUrl = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const decodeBase64Utf8 = (base64: string): string => {
  const normalized = String(base64 || '').trim();
  if (!normalized || typeof globalThis.atob !== 'function') return '';
  try {
    const binary = globalThis.atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    return binary;
  } catch {
    return '';
  }
};

const readPickedAssetAsText = async (asset: DocumentPickerAsset): Promise<string> => {
  if (Platform.OS === 'web') {
    if (asset.file && typeof asset.file.text === 'function') {
      return await asset.file.text();
    }

    const base64 = String(asset.base64 || '').trim();
    if (base64) {
      const decoded = decodeBase64Utf8(base64);
      if (decoded) return decoded;
    }

    const uri = String(asset.uri || '').trim();
    if (uri.startsWith('data:')) {
      const commaIndex = uri.indexOf(',');
      if (commaIndex >= 0) {
        const header = uri.slice(0, commaIndex);
        const payload = uri.slice(commaIndex + 1);
        if (header.includes(';base64')) {
          const decoded = decodeBase64Utf8(payload);
          if (decoded) return decoded;
        }
        return decodeURIComponent(payload);
      }
    }

    if (uri.startsWith('blob:') || uri.startsWith('http://') || uri.startsWith('https://')) {
      const response = await fetch(uri);
      return await response.text();
    }

    throw new Error('Secilen dosya web uzerinde okunamadi.');
  }

  return await new ExpoFile(asset.uri).text();
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

const parseStoredPrivacyDraft = (raw: string | null): MobileProfileVisibility => {
  if (!raw) return DEFAULT_SETTINGS_PRIVACY;
  try {
    const parsed = JSON.parse(raw) as Partial<MobileProfileVisibility> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS_PRIVACY;
    return normalizeMobileProfileVisibility(parsed);
  } catch {
    return DEFAULT_SETTINGS_PRIVACY;
  }
};

const parseStoredLanguage = (raw: string | null): MobileSettingsLanguage => {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'tr') return 'tr';
  if (normalized === 'es') return 'es';
  if (normalized === 'fr') return 'fr';
  return 'en';
};

// Discovery routes removed — replaced by Quiz tab
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
type ProfileStatsSheetSection = 'comments' | 'following' | 'followers' | 'marks';
type ProfileStatsSheetState = {
  visible: boolean;
  section: ProfileStatsSheetSection | null;
};
type ProfileFollowListItem = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  secondary: string;
};
type ProfileFollowListState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  items: ProfileFollowListItem[];
};
type DiscoverRouteSurfaceState = {
  visible: boolean;
  title: string;
  url: string;
  loading: boolean;
  error: string;
};

type MainTabParamList = {
  Daily: undefined;
  Quiz: undefined;
  Inbox: undefined;
  Arena: undefined;
  Profile: undefined;
};
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MAIN_TAB_BY_KEY = {
  daily: 'Daily',
  quiz: 'Quiz',
  inbox: 'Inbox',
  arena: 'Arena',
  profile: 'Profile',
} as const satisfies Record<'daily' | 'quiz' | 'inbox' | 'arena' | 'profile', keyof MainTabParamList>;

const MAIN_KEY_BY_TAB = {
  Daily: 'daily',
  Quiz: 'quiz',
  Inbox: 'inbox',
  Arena: 'arena',
  Profile: 'profile',
} as const satisfies Record<
  keyof MainTabParamList,
  'daily' | 'quiz' | 'inbox' | 'arena' | 'profile'
>;

const normalizeProfileSheetText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const MOBILE_TAB_LABELS: Record<
  MobileSettingsLanguage,
  Record<'daily' | 'quiz' | 'inbox' | 'arena' | 'profile', string>
> = {
  tr: mobileTranslations.tr.app.nav,
  en: mobileTranslations.en.app.nav,
  es: mobileTranslations.es.app.nav,
  fr: mobileTranslations.fr.app.nav,
};

const MAIN_TAB_BY_SCREEN = {
  daily_home: 'Daily',
  profile_home: 'Profile',
  invite_claim: 'Profile',
  share_hub: 'Profile',
  public_profile: 'Profile',
  discover_home: 'Quiz',
  quiz_home: 'Quiz',
} as const satisfies Record<MobileScreenId | 'quiz_home', keyof MainTabParamList>;
const TAB_ICON_BY_ROUTE = {
  Daily: { active: 'today', inactive: 'today-outline' },
  Quiz: { active: 'flash', inactive: 'flash-outline' },
  Inbox: { active: 'notifications', inactive: 'notifications-outline' },
  Arena: { active: 'trophy', inactive: 'trophy-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
} as const satisfies Record<keyof MainTabParamList, { active: IoniconName; inactive: IoniconName }>;

const createTabTheme = (mode: MobileThemeMode): NavigationTheme => {
  const isDawn = mode === 'dawn';
  return {
    ...NavigationDefaultTheme,
    colors: {
      ...NavigationDefaultTheme.colors,
      background: isDawn ? '#1f1d1a' : '#121212',
      card: isDawn ? '#1f1f1f' : '#171717',
      text: isDawn ? '#f4f1ea' : '#e5e4e2',
      border: isDawn ? 'rgba(244, 239, 231, 0.12)' : 'rgba(255, 255, 255, 0.12)',
      primary: isDawn ? '#a57164' : '#8a9a5b',
      notification: isDawn ? '#8A9A5B' : '#A57164',
    },
  };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const tabNavigationRef = createNavigationContainerRef<MainTabParamList>();

const AnimatedTabBar = ({
  state,
  navigation,
  tabLabels,
  inboxBadge,
  isDawnTheme,
}: BottomTabBarProps & {
  tabLabels: Record<string, string>;
  inboxBadge?: number | string | null;
  isDawnTheme: boolean;
}) => {
  const accentColor = isDawnTheme ? '#A57164' : '#8A9A5B';
  const inactiveColor = isDawnTheme ? '#6f665c' : '#8e8b84';
  const pillBg = isDawnTheme ? 'rgba(165,113,100,0.14)' : 'rgba(138,154,91,0.14)';
  const tabCount = state.routes.length;
  const { width: screenWidth } = useWindowDimensions();
  // 32 = left:16 + right:16 margins of navTabBar
  const tabWidth = (screenWidth - 32) / tabCount;
   
  const pillLeft = useRef(new Animated.Value(state.index * tabWidth)).current;
  const pressAnims = useRef(state.routes.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.spring(pillLeft, {
      toValue: state.index * tabWidth,
      useNativeDriver: false,
      tension: 280,
      friction: 26,
    }).start();
  }, [state.index, pillLeft, tabWidth]);

  return (
    <View style={[styles.navTabBar, isDawnTheme ? styles.navTabBarDawn : null, { flexDirection: 'row' }]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          width: tabWidth,
          left: pillLeft,
          backgroundColor: pillBg,
          borderRadius: 22,
        }}
      />
      { 
      state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tabKey = MAIN_KEY_BY_TAB[route.name as keyof typeof MAIN_KEY_BY_TAB];
        const label = tabLabels[tabKey] || tabKey;
        const iconName = isFocused
          ? TAB_ICON_BY_ROUTE[route.name as keyof typeof TAB_ICON_BY_ROUTE].active
          : TAB_ICON_BY_ROUTE[route.name as keyof typeof TAB_ICON_BY_ROUTE].inactive;
        const pressAnim = pressAnims[index];
        const hasInboxBadge = route.name === MAIN_TAB_BY_KEY.inbox && inboxBadge != null;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true } as Parameters<typeof navigation.emit>[0]);
          if (!isFocused && !(event as { defaultPrevented?: boolean }).defaultPrevented) {
            navigation.navigate(route.name, undefined);
          }
        };

        return (
          <Pressable
            key={route.key}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}
            onPress={onPress}
            onPressIn={() => {
              Animated.spring(pressAnim, { toValue: 0.88, useNativeDriver: true, tension: 400, friction: 18 }).start();
            }}
            onPressOut={() => {
              Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start();
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={label}
          >
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: pressAnim }] }}>
              <View style={{ position: 'relative' }}>
                <Ionicons name={iconName} size={22} color={isFocused ? accentColor : inactiveColor} />
                {hasInboxBadge ? (
                  <View
                    style={[
                      styles.navTabBadge,
                      { position: 'absolute', top: -4, right: -8, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
                    ]}
                  >
                    <Text style={{ color: '#E5E4E2', fontSize: 10, fontWeight: '700' }}>{inboxBadge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.navTabLabel, { color: isFocused ? accentColor : inactiveColor, marginTop: 2 }]} numberOfLines={1}>
                {label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
};


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
  INVALID_CODE: 'Hediye kodu gecersiz.',
  CODE_NOT_FOUND: 'Hediye kodu bulunamadi.',
  CODE_REVOKED: 'Bu hediye kodu iptal edilmis.',
  CODE_EXPIRED: 'Bu hediye kodunun suresi dolmus.',
  CODE_EXHAUSTED: 'Bu hediye kodunun kullanim hakki bitmis.',
  ALREADY_REDEEMED: 'Bu hediye kodu bu hesapta zaten kullanilmis.',
  WALLET_UPDATE_FAILED: 'Bilet hediyesi hesaba eklenemedi.',
  SUBSCRIPTION_UPDATE_FAILED: 'Premium hediyesi hesaba eklenemedi.',
  REFERRAL_PROGRAM_DISABLED: 'Arkadas daveti artik kullanilmiyor.',
  SERVER_ERROR: 'Sunucuya ulasilamadi. Birazdan tekrar dene.',
};


export default function App() {
  type MainTabKey = keyof typeof MAIN_TAB_BY_KEY;
  type AuthFlowMode = 'login' | 'register' | 'forgot' | 'recovery';
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dailyState, setDailyState] = useState<DailyState>({ status: 'idle' });
  const [inviteClaimState, setInviteClaimState] = useState<InviteClaimState>({ status: 'idle' });

  // Load persisted redeemed gift code on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      const persistedCode = await readPersistedClaimedInviteCode();
      if (active && persistedCode) {
        setInviteClaimState({
          status: 'success',
          inviteCode: persistedCode,
          message: '',
          inviteeRewardXp: 0,
          inviterRewardXp: 0,
          claimCount: 0,
        });
      }
    })();
    return () => { active = false; };
  }, []);
  const [authEmail, setAuthEmail] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authBirthDate, setAuthBirthDate] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authRememberMe, setAuthRememberMe] = useState(true);
  const [authFlowMode, setAuthFlowMode] = useState<AuthFlowMode>('login');
  const [authEntryStage, setAuthEntryStage] = useState<MobileAuthEntryStage>('form');
  const [authState, setAuthState] = useState<AuthState>({
    status: 'idle',
    message: 'Session kontrol ediliyor...',
  });
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [ritualDraftText, setRitualDraftText] = useState('');
  const [ritualDraftRating, setRitualDraftRating] = useState(0);
  const [ritualSubmitState, setRitualSubmitState] = useState<RitualSubmitState>({
    status: 'idle',
    message: '',
  });
  const [selectedDailyMovieId, setSelectedDailyMovieId] = useState<number | null>(null);
  const [dailyMovieDetailsVisible, setDailyMovieDetailsVisible] = useState(false);
  const [discoverRouteSurfaceState, setDiscoverRouteSurfaceState] =
    useState<DiscoverRouteSurfaceState>({
      visible: false,
      title: '',
      url: '',
      loading: false,
      error: '',
    });
  const [ritualComposerVisible, setRitualComposerVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [moviePageVisible, setMoviePageVisible] = useState(false);
  const [moviePageId, setMoviePageId] = useState<string | null>(null);
  const [moviePageTitle, setMoviePageTitle] = useState('');
  const [ritualQueueState, setRitualQueueState] = useState<RitualQueueState>({
    status: 'idle',
    message: '',
    pendingCount: 0,
  });
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'idle',
    message: 'Profil metrikleri hazir degil.',
  });
  const [profileStatsSheetState, setProfileStatsSheetState] = useState<ProfileStatsSheetState>({
    visible: false,
    section: null,
  });
  const [profileFollowListState, setProfileFollowListState] = useState<ProfileFollowListState>({
    status: 'idle',
    message: '',
    items: [],
  });
  const [leaguePromotionEvent, setLeaguePromotionEvent] = useState<MobileLeaguePromotionEvent | null>(
    null
  );
  const [streakCelebrationEvent, setStreakCelebrationEvent] = useState<MobileStreakCelebrationEvent | null>(
    null
  );
  const [tierAdvancementEvent, setTierAdvancementEvent] = useState<TierAdvancementEvent | null>(null);
  const [xpGainDelta, setXpGainDelta] = useState<number | null>(null);
  const [markUnlockQueue, setMarkUnlockQueue] = useState<string[]>([]);
  const activeMarkUnlockEvent: MobileMarkUnlockEvent | null =
    markUnlockQueue.length > 0 ? { markId: markUnlockQueue[0] } : null;
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
  const [settingsLanguage, setSettingsLanguage] = useState<MobileSettingsLanguage>(() => getDeviceLanguage());
  const isTurkishUi = settingsLanguage === 'tr';
  const localizedUiCopy = useMemo(
    () => ({
      observerLabel: isTurkishUi ? 'Gozlemci' : 'Observer',
      observerHandle: isTurkishUi ? 'gozlemci' : 'observer',
      unknownProfileLabel: isTurkishUi ? '@bilinmeyen' : '@unknown',
      inboxItemsLabel: isTurkishUi ? 'oge' : 'items',
      inviteStatsPrefix: isTurkishUi ? 'Kod kullanim' : 'Code uses',
      inviteStatsEmpty: isTurkishUi
        ? 'Admin hediye kodunu buradan kullanabilirsin.'
        : 'Redeem an admin gift code here.',
      inviteRewardLabel: isTurkishUi
        ? 'Premium veya bilet kodlari admin panelinden verilir.'
        : 'Premium and ticket codes are issued from the admin panel.',
      themeMode: {
        dawn: isTurkishUi ? 'Gunduz' : 'Dawn',
        midnight: isTurkishUi ? 'Gece' : 'Night',
      },
      profile: {
        screenTitle: isTurkishUi ? 'Profil' : 'Profile',
        bioFallback: isTurkishUi
          ? 'Profilini ve lig durumunu buradan yonet.'
          : 'Manage your profile and league status here.',
        readOnlyBody: isTurkishUi
          ? 'Profil sekmesi okunur modda acik. Bulut verileri yalnizca oturumla gorunur.'
          : 'The profile tab is in read-only mode. Cloud data is visible only when signed in.',
      },
      explore: {
        commentReady: (count: number) => (isTurkishUi ? `${count} yorum` : `${count} comments`),
        commentError: isTurkishUi ? 'hata' : 'error',
        commentLoading: isTurkishUi ? 'yukleniyor' : 'loading',
        commentIdle: isTurkishUi ? 'hazir degil' : 'not ready',
      },
      publicProfile: {
        hidden: isTurkishUi ? 'Gizli' : 'Hidden',
        metrics: {
          comments: isTurkishUi ? 'Yorum' : 'Comments',
          streak: isTurkishUi ? 'Seri' : 'Streak',
          stats: isTurkishUi ? 'Istatistik' : 'Stats',
          followers: isTurkishUi ? 'Takipci' : 'Followers',
          following: isTurkishUi ? 'Takip' : 'Following',
          follow: isTurkishUi ? 'Takip' : 'Follow',
        },
      },
    }),
    [isTurkishUi]
  );
  const resolveInviteMessage = useCallback(
    (errorCode?: string | null, fallbackMessage?: string) => {
      const englishInviteMessages: Record<string, string> = {
        UNAUTHORIZED: 'No active session was found. Please sign in on mobile first.',
        INVALID_CODE: 'Gift code is invalid.',
        CODE_NOT_FOUND: 'Gift code could not be found.',
        CODE_REVOKED: 'This gift code was revoked.',
        CODE_EXPIRED: 'This gift code expired.',
        CODE_EXHAUSTED: 'This gift code has no remaining uses.',
        ALREADY_REDEEMED: 'This account already used this gift code.',
        WALLET_UPDATE_FAILED: 'Ticket gift could not be added.',
        SUBSCRIPTION_UPDATE_FAILED: 'Premium gift could not be added.',
        REFERRAL_PROGRAM_DISABLED: 'Friend invites are no longer available.',
        SERVER_ERROR: 'The server could not be reached. Try again shortly.',
      };
      const normalizedCode = String(errorCode || '').trim();
      if (isTurkishUi) {
        const fallback = String(fallbackMessage || '').trim();
        return inviteMessageByCode[normalizedCode] || fallback || inviteMessageByCode.SERVER_ERROR;
      }
      return englishInviteMessages[normalizedCode] || englishInviteMessages.SERVER_ERROR;
    },
    [isTurkishUi]
  );
  const formatFollowMessage = useCallback(
    (result: {
      ok: boolean;
      message: string;
      isFollowing: boolean;
      isSelf: boolean;
      followsYou?: boolean;
    }) => {
      if (isTurkishUi) return result.message;
      switch (result.message) {
        case 'Gecersiz kullanici kimligi.':
          return 'Invalid user ID.';
        case 'Supabase baglantisi hazir degil.':
          return 'Supabase connection is not ready.';
        case 'Takip icin uye girisi gerekli.':
          return 'You need to sign in to follow users.';
        case 'Kendi profilin.':
          return 'This is your profile.';
        case 'Kendi profilini takip edemezsin.':
          return 'You cannot follow your own profile.';
        case 'Bu kullaniciyi takip ediyorsun.':
          return 'You are following this user.';
        case 'Bu kullaniciyi henuz takip etmiyorsun.':
          return 'You are not following this user yet.';
        case 'Takipten cikarildi.':
          return 'Unfollowed.';
        case 'Kullanici takip edildi.':
          return 'User followed.';
        case 'Takip islemi tamamlanamadi.':
          return 'Follow action could not be completed.';
        default:
          return result.ok
            ? result.isFollowing
              ? 'You are following this user.'
              : 'You are not following this user yet.'
            : 'Follow action could not be completed.';
      }
    },
    [isTurkishUi]
  );
  // Discovery routes removed — replaced by Quiz tab
  const [dailyPullRefreshing, setDailyPullRefreshing] = useState(false);
  const [explorePullRefreshing, setExplorePullRefreshing] = useState(false);
  const [inboxPullRefreshing, setInboxPullRefreshing] = useState(false);
  const [profilePullRefreshing, setProfilePullRefreshing] = useState(false);
  const [settingsIdentityDraft, setSettingsIdentityDraft] = useState<MobileSettingsIdentityDraft>(
    DEFAULT_SETTINGS_IDENTITY
  );
  const [settingsPrivacyDraft, setSettingsPrivacyDraft] = useState<MobileSettingsPrivacyDraft>(
    DEFAULT_SETTINGS_PRIVACY
  );
  const [settingsSaveState, setSettingsSaveState] = useState<MobileSettingsSaveState>({
    status: 'idle',
    message: '',
  });
  const [accountDeletionState, setAccountDeletionState] = useState<MobileSettingsSaveState>({
    status: 'idle',
    message: '',
  });
  const [emailVerificationState, setEmailVerificationState] = useState<MobileSettingsSaveState>({
    status: 'idle',
    message: '',
  });
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
   
  const [_shareHubState, setShareHubState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: 'Paylasim hedefini sec.',
  });
  const [profileActivityState, setProfileActivityState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: MobileProfileActivityItem[];
  }>({
    status: 'idle',
    message: 'Profil aktivitesi hazir degil.',
    items: [],
  });
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
  const [dailyCommentFeedScope, setDailyCommentFeedScope] = useState<CommentFeedScope>('today');
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
    scope: 'league' | 'global';
    cohortLeagueKey: string | null;
    weekKey: string | null;
    entries: ArenaEntryView[];
  }>({
    status: 'loading',
    source: 'fallback',
    message: 'Arena siralamasi yukleniyor...',
    scope: 'global',
    cohortLeagueKey: null,
    weekKey: null,
    entries: [],
  });
  const [letterboxdImportState, setLetterboxdImportState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    snapshot: StoredMobileLetterboxdImport | null;
  }>({
    status: 'idle',
    message: '',
    snapshot: null,
  });
  const [profileMovieArchiveModalState, setProfileMovieArchiveModalState] =
    useState<ProfileMovieArchiveModalState>({
      visible: false,
      status: 'idle',
      message: settingsLanguage === 'tr' ? 'Film arsivi hazir degil.' : 'Movie archive is not ready.',
      movie: null,
      entries: [],
    });
  const [publicProfileMovieArchiveModalState, setPublicProfileMovieArchiveModalState] =
    useState<PublicProfileMovieArchiveModalState>({
      visible: false,
      status: 'idle',
      message: settingsLanguage === 'tr' ? 'Film arsivi hazir degil.' : 'Movie archive is not ready.',
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
  const profileScrollRef = useRef<ScrollView | null>(null);
   
  const [_profileShareHubOffsetY, _setProfileShareHubOffsetY] = useState(0);
  const [activeTab, setActiveTab] = useState<MainTabKey>('daily');
  useBackHandler(activeTab === 'daily');
  const [debugExpanded, setDebugExpanded] = useState(false);
  const {
    activeIntent,
    clearIncomingIntent,
    deepLink,
    handleIncomingUrl,
    lastIncomingIntent,
    lastIncomingUrl,
    screenPlan,
    setManualIntent,
  } = useMobileRouteIntent();
  const { pageEntrance, pageEnterTranslateY } = usePageEntranceAnimation();
  const hasCloudIdentityHydratedRef = useRef(false);
  const hasCloudPrivacyHydratedRef = useRef(false);
  const hasCloudUserSettingsHydratedRef = useRef(false);
  const publicProfileReturnTabRef = useRef<keyof MainTabParamList | null>(null);
  const lastObservedLeagueIndexRef = useRef<number | null>(null);
  const lastObservedStreakRef = useRef<number | null>(null);
  const lastObservedStreakDateRef = useRef<string | null>(null);
  const streakObservedInitRef = useRef(false);
  const lastObservedTierRef = useRef<{ leagueIndex: number; tier: number } | null>(null);
  const lastObservedTotalXpRef = useRef<number | null>(null);
  const lastObservedMarksRef = useRef<string[] | null>(null);
  const lastHandledAuthCallbackUrlRef = useRef<string | null>(null);
  const lastHandledPublicProfileIntentRef = useRef<string | null>(null);
  const lastNotificationEventIdRef = useRef('');
  const lastAutoOpenedAuthRouteRef = useRef<string | null>(null);
  const hasAutoOpenedLaunchAuthRef = useRef(false);
  const hasAttemptedSignedInPushRegistrationRef = useRef(false);
  const dailyCommentFeedRequestIdRef = useRef(0);

  const primaryDailyMovie =
    dailyState.status === 'success' && dailyState.movies.length > 0 ? dailyState.movies[0] : null;
  const selectedDailyMovie =
    dailyState.status === 'success'
      ? dailyState.movies.find((movie) => movie.id === selectedDailyMovieId) || primaryDailyMovie
      : null;

  const isSignedIn = authState.status === 'signed_in';

  useEffect(() => {
    setRitualDraftRating(0);
  }, [selectedDailyMovie?.id]);

  // ── Subscription ────────────────────────────────────────
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  useEffect(() => {
    if (!isSignedIn) { setAccessToken(null); return; }
    readSupabaseSessionSafe().then((r) => setAccessToken(r.session?.access_token || null));
  }, [isSignedIn]);
  const subscription = useSubscription(accessToken);
  const wallet = useWallet(accessToken, settingsLanguage);
  const walletReadyTaskRewardTickets = wallet.snapshot.dailyTasks.reduce(
    (sum, task) => sum + (task.status === 'ready' ? Math.max(0, Number(task.ticketReward) || 0) : 0),
    0
  );
  const [walletVisible, setWalletVisible] = useState(false);
  const [walletFocusItem, setWalletFocusItem] = useState<WalletStoreItemKey | null>(null);

  const resolveNotificationActorLabel = useCallback(() => {
    const profileName =
      profileState.status === 'success' ? String(profileState.displayName || '').trim() : '';
    const fullName = String(settingsIdentityDraft.fullName || '').trim();
    const username = String(settingsIdentityDraft.username || '')
      .trim()
      .replace(/^@+/, '');
    const emailPrefix = String(authState.status === 'signed_in' ? authState.email : '')
      .trim()
      .toLowerCase()
      .split('@')[0];

    return fullName || profileName || username || emailPrefix || 'Bir izleyici';
  }, [authState, profileState, settingsIdentityDraft.fullName, settingsIdentityDraft.username]);

  const refreshAuthState = useCallback(
    async ({ applyRememberMePolicy = false }: { applyRememberMePolicy?: boolean } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Supabase ayarlari eksik.' : 'Supabase settings are missing.',
      });
      return;
    }

    try {
      const sessionResult = await readSupabaseSessionSafe();
      const sessionUser = sessionResult.session?.user;
      const userId = String(sessionUser?.id || '').trim();
      if (sessionResult.session?.access_token && userId) {
        if (applyRememberMePolicy) {
          const rememberMe = await readStoredAuthRememberMe();
          if (!rememberMe) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            setAuthState({
              status: 'signed_out',
              message: isTurkishUi
                ? 'Beni hatirla kapali oldugu icin onceki oturum temizlendi.'
                : 'The previous session was cleared because Remember Me is off.',
            });
            return;
          }
        }

        setAuthState(
          buildSignedInAuthState(
            sessionUser,
            isTurkishUi ? 'Mobil oturum hazir.' : 'Mobile session is ready.'
          )
        );
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
          ? (isTurkishUi
              ? 'Eski Supabase oturumu temizlendi. Tekrar giris yapabilirsin.'
              : 'The previous Supabase session was cleared. You can sign in again.')
          : (isTurkishUi ? 'Giris yapilmadi.' : 'Not signed in.'),
      });
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : isTurkishUi ? 'Session okunamadi.' : 'The session could not be read.',
      });
    }
    },
    [isTurkishUi]
  );

  const handleSetAuthRememberMe = useCallback((nextValue: boolean) => {
    setAuthRememberMe(nextValue);
    void writeStoredAuthRememberMe(nextValue);
  }, []);

  const openAuthModal = useCallback(
    (mode: AuthFlowMode = 'login') => {
      setAuthEntryStage('form');
      setAuthFlowMode(mode);
      setAuthModalVisible(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    if (authState.status === 'loading') return;
    setAuthModalVisible(false);
  }, [authState.status]);

  const openWallet = useCallback((itemKey: WalletStoreItemKey | null = null) => {
    if (!isSignedIn) {
      openAuthModal('login');
      return;
    }
    wallet.reconcileTopupPurchaseState();
    setWalletFocusItem(itemKey);
    setWalletVisible(true);
  }, [isSignedIn, openAuthModal, wallet]);

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
      message: isTurkishUi ? 'Profil metrikleri yukleniyor...' : 'Loading profile metrics...',
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
      message: isTurkishUi ? 'Profil metrikleri guncellendi.' : 'Profile metrics updated.',
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
  }, [isTurkishUi]);
  const applyQuizProgressToProfile = useCallback(
    (input: {
      totalXp: number | null;
      streak: number | null;
      dateKey: string;
      streakProtectedNow: boolean;
    }) => {
      if (profileState.status !== 'success') {
        void refreshProfileStats();
        return;
      }

      const normalizedDateKey = String(input.dateKey || '').trim() || getLocalDateKey();
      const nextTotalXp =
        input.totalXp !== null && Number.isFinite(input.totalXp)
          ? Math.max(profileState.totalXp, Math.floor(input.totalXp))
          : profileState.totalXp;
      const nextStreak =
        input.streak !== null && Number.isFinite(input.streak)
          ? Math.max(profileState.streak, Math.floor(input.streak))
          : profileState.streak;
      const nextLeague = resolveMobileLeagueInfoFromXp(nextTotalXp);
      const nextLeagueKey = nextLeague.leagueKey;
      const nextLeagueName = nextLeague.leagueInfo.name;
      const nextLeagueColor = nextLeague.leagueInfo.color;
      const nextLeagueTargetKey = resolveMobileNextLeagueKey(nextLeagueKey);
      const nextLeagueTargetName = nextLeagueTargetKey
        ? resolveMobileLeagueInfo(nextLeagueTargetKey).name
        : null;
      const shouldProtectToday = Boolean(input.streakProtectedNow && normalizedDateKey);
      const isNewActiveDay = shouldProtectToday && profileState.lastRitualDate !== normalizedDateKey;

      setProfileState((prev) =>
        prev.status !== 'success'
          ? prev
          : {
              ...prev,
              totalXp: nextTotalXp,
              leagueKey: nextLeagueKey,
              leagueName: nextLeagueName,
              leagueColor: nextLeagueColor,
              nextLeagueKey: nextLeagueTargetKey,
              nextLeagueName: nextLeagueTargetName,
              streak: nextStreak,
              daysPresent: isNewActiveDay ? prev.daysPresent + 1 : prev.daysPresent,
              lastRitualDate: shouldProtectToday ? normalizedDateKey : prev.lastRitualDate,
              source: 'xp_state',
            }
      );
    },
    [profileState, refreshProfileStats]
  );

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

  const refreshSettingsPrivacyFromCloud = useCallback(async () => {
    const result = await readMobileProfilePrivacyFromCloud();
    if (!result.ok) {
      void trackMobileEvent('page_view', {
        reason: 'mobile_profile_privacy_cloud_read_failed',
        message: result.message,
      });
      return;
    }

    setSettingsPrivacyDraft((prev) => {
      const merged = normalizeMobileProfileVisibility({
        ...prev,
        ...result.visibility,
      });
      void AsyncStorage.setItem(MOBILE_PROFILE_PRIVACY_STORAGE_KEY, JSON.stringify(merged)).catch(
        () => undefined
      );
      return merged;
    });

    void trackMobileEvent('page_view', {
      reason: 'mobile_profile_privacy_cloud_loaded',
    });
  }, []);

  const refreshUserSettingsFromCloud = useCallback(async () => {
    const result = await readMobileUserSettingsFromCloud();
    if (!result.ok || !result.settings) return;
    setSettingsLanguage(result.settings.language as MobileSettingsLanguage);
    setThemeMode(result.settings.themeMode as MobileThemeMode);
    void writeStoredMobileThemeMode(result.settings.themeMode as MobileThemeMode);
  }, []);

  const hydrateSettingsIdentityFromSession = useCallback(async () => {
    if (!supabase || authState.status !== 'signed_in') return;

    const sessionResult = await readSupabaseSessionSafe();
    const sessionUser = sessionResult.session?.user || null;
    if (!sessionUser) return;

    const providerDisplayName = resolveSupabaseUserDisplayName(sessionUser);
    const providerAvatarUrl = resolveSupabaseUserAvatarUrl(sessionUser);
    if (!providerDisplayName && !providerAvatarUrl) return;

    setSettingsIdentityDraft((prev) => {
      const next = {
        ...prev,
        fullName: prev.fullName || providerDisplayName,
        avatarUrl: prev.avatarUrl || providerAvatarUrl,
      };
      if (next.fullName === prev.fullName && next.avatarUrl === prev.avatarUrl) {
        return prev;
      }

      void AsyncStorage.setItem(MOBILE_PROFILE_IDENTITY_STORAGE_KEY, JSON.stringify(next)).catch(
        () => undefined
      );
      return next;
    });
  }, [authState.status]);

  const readLetterboxdImportIdentity = useCallback(async (): Promise<string> => {
    if (authState.status !== 'signed_in') return '';
    const sessionResult = await readSupabaseSessionSafe();
    const userId = String(sessionResult.session?.user?.id || '').trim();
    const userEmail = resolveSupabaseUserEmail(sessionResult.session?.user);
    return userId || userEmail;
  }, [authState.status]);

  const readLetterboxdSnapshot = useCallback(async (): Promise<StoredMobileLetterboxdImport | null> => {
    const identity = await readLetterboxdImportIdentity();
    if (!identity) return null;
    return readStoredMobileLetterboxdImport(identity);
  }, [readLetterboxdImportIdentity]);

  const syncLetterboxdImportState = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setLetterboxdImportState({
        status: 'idle',
        message: '',
        snapshot: null,
      });
      return null;
    }

    const snapshot = await readLetterboxdSnapshot();
    setLetterboxdImportState({
      status: snapshot ? 'ready' : 'idle',
      message: snapshot ? (isTurkishUi ? 'Letterboxd import hazir.' : 'Letterboxd import is ready.') : '',
      snapshot,
    });
    return snapshot;
  }, [authState.status, isTurkishUi, readLetterboxdSnapshot]);

  const refreshProfileActivity = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setProfileActivityState({
        status: 'idle',
        message: isTurkishUi ? 'Profil aktivitesi icin giris bekleniyor.' : 'Sign in to view profile activity.',
        items: [],
      });
      return;
    }

    setProfileActivityState({
      status: 'loading',
      message: isTurkishUi ? 'Profil aktivitesi yukleniyor...' : 'Loading profile activity...',
      items: [],
    });

    const result = await fetchMobileProfileActivity({ limit: 120 });
    if (!result.ok && result.items.length === 0) {
      setProfileActivityState({
        status: 'error',
        message: result.message,
        items: [],
      });
      return;
    }

    setProfileActivityState({
      status: result.ok ? 'ready' : 'error',
      message: result.message,
      items: result.items,
    });
  }, [authState.status, isTurkishUi]);
  const handleCloseProfileMovieArchive = useCallback(() => {
    setProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

   
  const _handleOpenProfileMovieArchive = useCallback(async (movie: MobileWatchedMovie) => {
    const movieTitle = String(movie.movieTitle || '').trim();
    if (!movieTitle) return;

    setProfileMovieArchiveModalState({
      visible: true,
      status: 'loading',
      message: isTurkishUi ? 'Film arsivi yukleniyor...' : 'Loading movie archive...',
      movie,
      entries: [],
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_movie_archive_opened',
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
      void trackMobileEvent('page_view', {
        reason: 'mobile_movie_archive_failed',
        movieTitle,
        movieYear: movie.year ?? null,
        failureReason: result.message,
      });
    }
  }, [isTurkishUi]);

  const resolvePublicMovieArchiveItems = useCallback(
    (movie: PublicWatchedMovieSummary, sourceItems: MobilePublicProfileActivityItem[]) => {
      const movieTitle = String(movie.movieTitle || '').trim().toLowerCase();
      return sourceItems.filter((item) => {
        const itemText = String(item.text || '').trim();
        const itemTitle = String(item.movieTitle || '').trim().toLowerCase();
        if (!itemTitle || itemTitle !== movieTitle) return false;
        if (!itemText) return false;
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
        localizedUiCopy.unknownProfileLabel;
      const items = resolvePublicMovieArchiveItems(movie, publicProfileFullState.items);
      const hasEntries = items.length > 0;
      setPublicProfileMovieArchiveModalState({
        visible: true,
        status: hasEntries ? 'ready' : 'error',
        message: hasEntries
          ? isTurkishUi
            ? `${displayName} icin ${items.length} yorum kaydi bulundu.`
            : `${items.length} archive entries found for ${displayName}.`
          : isTurkishUi
            ? 'Bu film icin yorum kaydi bulunamadi.'
            : 'No archive entries were found for this movie.',
        displayName,
        movie,
        items,
      });
      void trackMobileEvent('page_view', {
        reason: hasEntries ? 'mobile_public_movie_archive_opened' : 'mobile_public_movie_archive_failed',
        profileUserId: publicProfileTarget?.userId || publicProfileModalState.profile?.userId || null,
        movieTitle: movie.movieTitle,
        movieYear: movie.year ?? null,
        itemCount: items.length,
      });
    },
    [
      isTurkishUi,
      localizedUiCopy,
      publicProfileFullState.displayName,
      publicProfileFullState.items,
      publicProfileModalState.displayNameHint,
      publicProfileModalState.profile?.displayName,
      publicProfileModalState.profile?.userId,
      publicProfileTarget?.userId,
      resolvePublicMovieArchiveItems,
    ]
  );

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
        message: isTurkishUi ? 'Detayli profil yukleniyor...' : 'Loading detailed profile...',
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
    [isTurkishUi]
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
        message: isTurkishUi ? 'Film arsivi hazir degil.' : 'Movie archive is not ready.',
        displayName: displayNameHint,
        movie: null,
        items: [],
      });
      setPublicProfileTarget({ userId, displayNameHint, source });
      setPublicProfileModalState((prev) => ({
        ...prev,
        visible: false,
        status: 'loading',
        message: isTurkishUi ? 'Profil yukleniyor...' : 'Loading profile...',
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
        followMessage: formatFollowMessage(followResult),
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
    [formatFollowMessage, isTurkishUi]
  );

  const openPublicProfileInApp = useCallback(
    async (target: PublicProfileOpenTarget) => {
      const currentTabRoute = tabNavigationRef.isReady() ? tabNavigationRef.getCurrentRoute()?.name ?? null : null;
      publicProfileReturnTabRef.current =
        currentTabRoute && currentTabRoute !== MAIN_TAB_BY_KEY.profile ? currentTabRoute : null;

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
          message: isTurkishUi ? 'Profil bulunamadi.' : 'Profile not found.',
          displayNameHint,
          profile: null,
          followStatus: 'error',
          followMessage: isTurkishUi ? 'Kullanici kimligi cozulmedi.' : 'User identity could not be resolved.',
          isFollowing: false,
          followsYou: false,
          isSelfProfile: false,
          source: target.origin,
        });
        setPublicProfileFullState({
          visible: true,
          status: 'error',
          message: isTurkishUi ? 'Profil bulunamadi.' : 'Profile not found.',
          displayName: displayNameHint || localizedUiCopy.unknownProfileLabel,
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
          displayName: loadResult.displayName || displayNameHint || localizedUiCopy.unknownProfileLabel,
          items: [],
        });
        return;
      }

      await loadPublicProfileFull({
        userId: resolvedUserId,
        displayName: loadResult.displayName || displayNameHint || localizedUiCopy.unknownProfileLabel,
      });
    },
    [isTurkishUi, localizedUiCopy, loadPublicProfileFull, loadPublicProfileModal, resolvePublicProfileUserId]
  );

  const loadProfileFollowList = useCallback(
    async (mode: 'following' | 'followers'): Promise<ProfileFollowListState> => {
      if (authState.status !== 'signed_in') {
        return {
          status: 'error',
          message: isTurkishUi ? 'Liste icin once giris yap.' : 'Sign in to view this list.',
          items: [],
        };
      }

      if (!supabase) {
        return {
          status: 'error',
          message: isTurkishUi ? 'Supabase baglantisi hazir degil.' : 'Supabase connection is not ready.',
          items: [],
        };
      }

      const sessionResult = await readSupabaseSessionSafe();
      const viewerUserId = normalizeProfileSheetText(sessionResult.session?.user?.id, 120);
      if (!viewerUserId) {
        return {
          status: 'error',
          message: isTurkishUi ? 'Kullanici kimligi bulunamadi.' : 'User identity could not be resolved.',
          items: [],
        };
      }

      const targetColumn = mode === 'following' ? 'followed_user_id' : 'follower_user_id';
      const filterColumn = mode === 'following' ? 'follower_user_id' : 'followed_user_id';
      const relationResponse = await supabase
        .from('user_follows')
        .select(targetColumn)
        .eq(filterColumn, viewerUserId);

      if (relationResponse.error) {
        return {
          status: 'error',
          message:
            normalizeProfileSheetText(relationResponse.error.message, 220) ||
            (isTurkishUi ? 'Takip listesi okunamadi.' : 'The follow list could not be read.'),
          items: [],
        };
      }

      const targetIds = Array.from(
        new Set(
          ((relationResponse.data || []) as Array<Record<string, unknown>>)
            .map((row) => normalizeProfileSheetText(row[targetColumn], 120))
            .filter(Boolean)
        )
      );

      if (targetIds.length === 0) {
        return {
          status: 'ready',
          message: '',
          items: [],
        };
      }

      const profileResponse = await supabase
        .from('profiles_public')
        .select('user_id, display_name, xp_state')
        .in('user_id', targetIds);

      if (profileResponse.error) {
        return {
          status: 'error',
          message:
            normalizeProfileSheetText(profileResponse.error.message, 220) ||
            (isTurkishUi ? 'Profil listesi okunamadi.' : 'Profiles could not be read.'),
          items: [],
        };
      }

      const profileMap = new Map<
        string,
        {
          display_name?: string | null;
          xp_state?: Record<string, unknown> | null;
        }
      >();

      ((profileResponse.data || []) as Array<{
        user_id?: string | null;
        display_name?: string | null;
        xp_state?: Record<string, unknown> | null;
      }>).forEach((row) => {
        const userId = normalizeProfileSheetText(row.user_id, 120);
        if (!userId) return;
        profileMap.set(userId, row);
      });

      const items = targetIds.map((targetUserId) => {
        const profileRow = profileMap.get(targetUserId);
        const xpState =
          profileRow?.xp_state && typeof profileRow.xp_state === 'object' && !Array.isArray(profileRow.xp_state)
            ? profileRow.xp_state
            : null;
        const displayName =
          normalizeProfileSheetText(profileRow?.display_name, 80) ||
          normalizeProfileSheetText(xpState?.fullName, 80) ||
          normalizeProfileSheetText(xpState?.username, 80).replace(/^@+/, '') ||
          (isTurkishUi ? 'Bilinmeyen kullanici' : 'Unknown user');
        const username = normalizeProfileSheetText(xpState?.username, 80).replace(/^@+/, '');
        const totalXp = readProfileTotalXp(xpState);
        const leagueName = totalXp > 0 ? resolveMobileLeagueInfoFromXp(totalXp).leagueInfo.name : '';
        const secondary = [username ? `@${username}` : '', leagueName].filter(Boolean).join(' | ');
        return {
          userId: targetUserId,
          displayName,
          avatarUrl: resolveMobileAvatarFromXpState(xpState),
          secondary,
        };
      });

      return {
        status: 'ready',
        message: '',
        items,
      };
    },
    [authState.status, isTurkishUi]
  );

  const handleCloseProfileStatsSheet = useCallback(() => {
    setProfileStatsSheetState({
      visible: false,
      section: null,
    });
  }, []);

  const handleOpenProfileCommentsSheet = useCallback(() => {
    setProfileStatsSheetState({
      visible: true,
      section: 'comments',
    });
  }, []);

  const handleOpenProfileMarksSheet = useCallback(() => {
    setProfileStatsSheetState({
      visible: true,
      section: 'marks',
    });
  }, []);

  const handleOpenProfileFollowSheet = useCallback(
    async (mode: 'following' | 'followers') => {
      setProfileStatsSheetState({
        visible: true,
        section: mode,
      });
      setProfileFollowListState({
        status: 'loading',
        message: isTurkishUi ? 'Liste yukleniyor...' : 'Loading list...',
        items: [],
      });
      const result = await loadProfileFollowList(mode);
      setProfileFollowListState(result);
    },
    [isTurkishUi, loadProfileFollowList]
  );

  const handleOpenProfileFollowUser = useCallback(
    async (userId: string, displayName: string) => {
      handleCloseProfileStatsSheet();
      await openPublicProfileInApp({
        userId,
        displayNameHint: displayName,
        origin: 'manual',
      });
    },
    [handleCloseProfileStatsSheet, openPublicProfileInApp]
  );

  const refreshArenaLeaderboard = useCallback(async () => {
    setArenaState((prev) => ({
      ...prev,
      status: 'loading',
      message: isTurkishUi ? 'Arena siralamasi yukleniyor...' : 'Loading arena leaderboard...',
    }));

    const result = await fetchMobileArenaSnapshot();

    setArenaState({
      status: result.ok ? 'ready' : 'error',
      source: result.source,
      message: result.message,
      scope: result.scope,
      cohortLeagueKey: result.cohortLeagueKey,
      weekKey: result.weekKey,
      entries: result.entries,
    });

    void trackMobileEvent('page_view', {
      reason: result.ok ? 'mobile_arena_loaded' : 'mobile_arena_failed',
      source: result.source,
      entries: result.entries.length,
    });
  }, [isTurkishUi]);

  const refreshCommentFeed = useCallback(
    async (scope: CommentFeedScope, query: string, sort: CommentFeedSort) => {
      const normalizedQuery = String(query || '').trim();
      setCommentFeedState((prev) => ({
        ...prev,
        status: 'loading',
        message: isTurkishUi ? 'Genel yorum akisi yukleniyor...' : 'Loading comment feed...',
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
    [isTurkishUi]
  );

  const refreshDailyCommentFeed = useCallback(async (scope: CommentFeedScope) => {
    const requestId = dailyCommentFeedRequestIdRef.current + 1;
    dailyCommentFeedRequestIdRef.current = requestId;
    const isTodayScope = scope === 'today';

    setDailyCommentFeedState((prev) => ({
      ...prev,
      status: 'loading',
      message: isTurkishUi
        ? isTodayScope
          ? 'Gunluk yorum akisi yukleniyor...'
          : 'Tum yorum akisi yukleniyor...'
        : isTodayScope
          ? 'Loading daily comment feed...'
          : 'Loading full comment feed...',
      scope,
      sort: 'latest',
      query: '',
      page: 1,
      hasMore: false,
      isAppending: false,
    }));

    const result = await fetchMobileCommentFeed({
      scope,
      sort: 'latest',
      query: '',
      page: 1,
      pageSize: 24,
    });

    if (dailyCommentFeedRequestIdRef.current !== requestId) {
      return;
    }

    setDailyCommentFeedState({
      status: result.ok ? 'ready' : 'error',
      message: result.message,
      source: result.source,
      scope,
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
      scope,
      items: result.items.length,
    });
  }, [isTurkishUi]);

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
      message: isTurkishUi ? 'Notification inbox yukleniyor...' : 'Loading notification inbox...',
    }));
    const items = await readPushInbox();
    setPushInboxState({
      status: 'ready',
      message: items.length > 0
        ? (isTurkishUi ? 'Notification inbox guncellendi.' : 'Notification inbox updated.')
        : (isTurkishUi ? 'Inbox bos.' : 'Inbox is empty.'),
      items,
    });
  }, [isTurkishUi]);

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
        message: isTurkishUi
          ? `Inbox kaydi eklendi (${source}).`
          : `Inbox entry added (${source}).`,
        items: result.items,
      });
    },
    [isTurkishUi]
  );

  const notifyLeagueProgress = useCallback(
    async (input: {
      leagueKey: string;
      leagueName: string;
      leagueColor: string;
      totalXp: number;
    }) => {
      const copy = buildLeagueNotificationCopy(settingsLanguage, input.leagueName || input.leagueKey);
      const deepLink = buildMobileDeepLinkFromRouteIntent(
        { target: 'profile' },
        { base: MOBILE_DEEP_LINK_BASE }
      );
      const snapshot: PushNotificationSnapshot = {
        notificationId: `local-league-${getLocalDateKey()}-${input.leagueKey}-${input.totalXp}`,
        title: copy.title,
        body: copy.body,
        deepLink,
        kind: 'generic',
        receivedAt: new Date().toISOString(),
      };

      setPushState((prev) => ({
        ...prev,
        lastNotification: describePushNotification(snapshot),
      }));
      await appendPushInbox(snapshot, 'received');

      if (PUSH_FEATURE_ENABLED && pushState.permissionStatus === 'granted') {
        await sendLocalPushSimulation({
          title: copy.title,
          body: copy.body,
          deepLink,
          kind: 'generic',
        });
      }
    },
    [appendPushInbox, describePushNotification, pushState.permissionStatus, settingsLanguage]
  );

  const notifyStreakProgress = useCallback(
    async (day: number, ritualDateKey: string | null) => {
      const copy = buildStreakNotificationCopy(settingsLanguage, day);
      const deepLink = buildMobileDeepLinkFromRouteIntent(
        { target: 'share', goal: 'streak' },
        { base: MOBILE_DEEP_LINK_BASE }
      );
      const snapshot: PushNotificationSnapshot = {
        notificationId: `local-streak-${ritualDateKey || getLocalDateKey()}-${day}`,
        title: copy.title,
        body: copy.body,
        deepLink,
        kind: 'streak',
        receivedAt: new Date().toISOString(),
      };

      setPushState((prev) => ({
        ...prev,
        lastNotification: describePushNotification(snapshot),
      }));
      await appendPushInbox(snapshot, 'received');

      if (PUSH_FEATURE_ENABLED && pushState.permissionStatus === 'granted') {
        await sendLocalPushSimulation({
          title: copy.title,
          body: copy.body,
          deepLink,
          kind: 'streak',
        });
      }
    },
    [appendPushInbox, describePushNotification, pushState.permissionStatus, settingsLanguage]
  );

  const syncNotificationEventInbox = useCallback(
    async (reason: 'initial' | 'poll') => {
      const snapshots = await fetchRecentMobileNotificationEvents({
        limit: 24,
      });
      if (snapshots.length === 0) return 0;

      const lastSeenNotificationId = lastNotificationEventIdRef.current;
      const lastSeenIndex = lastSeenNotificationId
        ? snapshots.findIndex((snapshot) => snapshot.notificationId === lastSeenNotificationId)
        : -1;
      const pendingSnapshots =
        lastSeenIndex >= 0 ? snapshots.slice(lastSeenIndex + 1) : snapshots;

      let items: PushInboxItem[] = [];
      for (const snapshot of snapshots) {
        const result = await appendPushInboxItem({
          notificationId: snapshot.notificationId,
          title: snapshot.title,
          body: snapshot.body,
          deepLink: snapshot.deepLink,
          kind: snapshot.kind,
          receivedAt: snapshot.receivedAt,
          source: snapshot.readAt ? 'opened' : 'received',
        });
        items = result.items;
      }

      if (pendingSnapshots.length === 0) {
        if (items.length > 0) {
          setPushInboxState({
            status: 'ready',
            message:
              reason === 'initial'
                ? (isTurkishUi ? 'Cloud bildirimleri inbox ile senkronlandi.' : 'Cloud notifications synced with the inbox.')
                : (isTurkishUi ? 'Cloud bildirimleri guncellendi.' : 'Cloud notifications updated.'),
            items,
          });
        }
        return 0;
      }

      const latestSnapshot = pendingSnapshots[pendingSnapshots.length - 1];
      if (latestSnapshot) {
        lastNotificationEventIdRef.current = latestSnapshot.notificationId;
        setPushState((prev) => ({
          ...prev,
          lastNotification: describePushNotification(latestSnapshot),
        }));
      }

      setPushInboxState({
        status: 'ready',
        message:
          reason === 'initial'
            ? (isTurkishUi ? 'Cloud bildirimleri inbox ile senkronlandi.' : 'Cloud notifications synced with the inbox.')
            : (isTurkishUi ? 'Cloud bildirimleri guncellendi.' : 'Cloud notifications updated.'),
        items,
      });

      return pendingSnapshots.length;
    },
    [describePushNotification, isTurkishUi]
  );

  const handleClearPushInbox = useCallback(async () => {
    setPushInboxState((prev) => ({
      ...prev,
      status: 'loading',
      message: isTurkishUi ? 'Inbox temizleniyor...' : 'Clearing inbox...',
    }));
    const notificationIds = pushInboxState.items
      .map((item) => String(item.notificationId || '').trim())
      .filter(Boolean);
    if (notificationIds.length > 0) {
      await markMobileNotificationEventsRead({ notificationIds });
    }
    await clearPushInbox();
    setPushInboxState({
      status: 'ready',
      message: isTurkishUi ? 'Inbox temizlendi.' : 'Inbox cleared.',
      items: [],
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_inbox_cleared',
    });
  }, [isTurkishUi]);

  const handleOpenInboxDeepLink = useCallback(
    async (item: PushInboxItem) => {
      if (!item.deepLink) return;
      handleIncomingUrl(item.deepLink);
      const notificationId = String(item.notificationId || '').trim();
      if (notificationId) {
        await markMobileNotificationEventsRead({ notificationIds: [notificationId] });
      }
      const removed = await removePushInboxItems([item.id]);
      setPushInboxState((prev) => ({
        ...prev,
        status: 'ready',
        message: isTurkishUi
          ? 'Bildirim acildi ve listeden kaldirildi.'
          : 'Notification opened and removed from the list.',
        items: removed.items,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_inbox_deeplink_opened',
        hasDeepLink: true,
      });
    },
    [handleIncomingUrl, isTurkishUi]
  );

  const handlePressPushInboxItem = useCallback(async (item: PushInboxItem) => {
    const notificationId = String(item.notificationId || '').trim();
    if (notificationId) {
      await markMobileNotificationEventsRead({ notificationIds: [notificationId] });
    }
    const removed = await removePushInboxItems([item.id]);
    setPushInboxState((prev) => ({
      ...prev,
      status: 'ready',
      message: removed.removedCount > 0
        ? (isTurkishUi ? 'Bildirim goruldu ve listeden kaldirildi.' : 'Notification viewed and removed from the list.')
        : (isTurkishUi ? 'Bildirim zaten kapatilmisti.' : 'Notification was already dismissed.'),
      items: removed.items,
    }));
  }, [isTurkishUi, pushInboxState.items]);

  const syncPushTokenCloud = useCallback(
    async (token: string, permissionStatus: string, projectId: string | null) => {
      const normalizedToken = String(token || '').trim();
      if (!normalizedToken) return;

      setPushState((prev) => ({
        ...prev,
        cloudStatus: 'syncing',
        cloudMessage: isTurkishUi ? 'Push token profile state ile senkronlaniyor...' : 'Syncing push token with profile state...',
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
        cloudMessage: isTurkishUi
          ? `Push token cloud sync ok (${result.deviceCount} device).`
          : `Push token cloud sync ok (${result.deviceCount} devices).`,
        deviceKey: result.deviceKey,
        lastSyncedToken: normalizedToken,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_push_cloud_synced',
        deviceCount: result.deviceCount,
        deviceKey: result.deviceKey,
      });
    },
    [isTurkishUi]
  );

  const refreshPushRegistration = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setPushState((prev) => ({
        ...prev,
        status: 'unsupported',
        message: isTurkishUi ? 'Push modulu gecici olarak devre disi.' : 'The push module is temporarily disabled.',
      }));
      return;
    }

    setPushState((prev) => ({
      ...prev,
      status: 'loading',
      message: isTurkishUi ? 'Push izin/token kaydi yapiliyor...' : 'Registering push permission and token...',
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
          : (isTurkishUi ? 'Push cloud sync icin gecerli token yok.' : 'No valid token is available for push cloud sync.'),
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
      message: isTurkishUi ? 'Push token hazir.' : 'Push token is ready.',
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
  }, [authState.status, isTurkishUi, syncPushTokenCloud]);

  const handleSendPushTest = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setPushTestState((prev) => ({
        ...prev,
        status: 'idle',
        message: isTurkishUi ? 'Push modulu gecici olarak devre disi.' : 'The push module is temporarily disabled.',
      }));
      return;
    }

    if (authState.status !== 'signed_in') {
      setPushTestState({
        status: 'error',
        message: isTurkishUi ? 'Test push icin once giris yap.' : 'Sign in first to send a test push.',
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
        message: isTurkishUi ? 'Test push icin cloud sync "synced" olmali.' : 'Cloud sync must be "synced" before sending a test push.',
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
        message: isTurkishUi ? 'Test push icin gecerli token bulunamadi.' : 'No valid token was found for the test push.',
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
      message: isTurkishUi ? 'Test push gonderiliyor...' : 'Sending test push...',
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
      body: isTurkishUi
        ? 'Bu test bildirimi push kanalini dogrulamak icin gonderildi.'
        : 'This test notification was sent to verify the push channel.',
      deepLink: testDeepLink,
    });

    if (!result.ok || !result.data) {
      const message = result.message || (isTurkishUi ? 'Test push gonderilemedi.' : 'Test push could not be sent.');
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
        ? (isTurkishUi ? 'Test push gonderildi, receipt kontrolu tamamlandi.' : 'Test push sent and receipt check completed.')
        : (isTurkishUi ? 'Test push gonderildi; receipt sonucu sinirli alindi.' : 'Test push sent; receipt details were limited.');

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
  }, [authState.status, isTurkishUi, pushState.cloudStatus, pushState.token]);

  const handleSimulateLocalPush = useCallback(async () => {
    if (!PUSH_FEATURE_ENABLED) {
      setLocalPushSimState({
        status: 'idle',
        message: isTurkishUi ? 'Push modulu gecici olarak devre disi.' : 'The push module is temporarily disabled.',
      });
      return;
    }

    setLocalPushSimState({
      status: 'loading',
      message: isTurkishUi ? 'Local test bildirimi hazirlaniyor...' : 'Preparing local test notification...',
    });

    const deepLink = buildMobileDeepLinkFromRouteIntent(
      { target: 'daily' },
      { base: MOBILE_DEEP_LINK_BASE }
    );
    const result = await sendLocalPushSimulation({
      title: isTurkishUi ? '180 Absolute Cinema (Local Sim)' : '180 Absolute Cinema (Local Sim)',
      body: isTurkishUi ? 'Emulator local bildirim testi.' : 'Emulator local notification test.',
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
      message: isTurkishUi
        ? 'Local bildirim gonderildi. Bildirime tiklayarak deep-link akisina bak.'
        : 'Local notification sent. Tap it to inspect the deep-link flow.',
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_push_local_sim_sent',
      deepLink: result.deepLink,
    });
  }, [isTurkishUi]);

  const handleSignIn = useCallback(async () => {
    const email = authEmail.trim().toLowerCase();
    const password = authPassword;

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Supabase ayarlari eksik.' : 'Supabase settings are missing.',
      });
      return;
    }

    if (!email || !password) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'E-posta ve sifre zorunlu.' : 'Email and password are required.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: isTurkishUi ? 'Giris yapiliyor...' : 'Signing in...',
    });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session?.access_token) {
        const message = error?.message || (isTurkishUi ? 'Giris basarisiz.' : 'Sign-in failed.');
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

      setAuthState(
        buildSignedInAuthState(
          data.user || data.session?.user || null,
          isTurkishUi ? 'Giris basarili.' : 'Sign-in successful.'
        )
      );
      setAuthEntryStage('form');
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
      const message = error instanceof Error ? error.message : isTurkishUi ? 'Giris basarisiz.' : 'Sign-in failed.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password',
        reason: message,
      });
    }
  }, [authEmail, authPassword, isTurkishUi]);

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
        message: isTurkishUi ? 'Supabase ayarlari eksik.' : 'Supabase settings are missing.',
      });
      return;
    }

    if (!fullName || !username || !birthDate || !email || !password || !confirmPassword) {
      setAuthState({
        status: 'error',
        message: isTurkishUi
          ? 'Ad soyad, kullanici adi, dogum tarihi, email ve sifre alanlari zorunlu.'
          : 'Full name, username, birth date, email, and password are required.',
      });
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setAuthState({
        status: 'error',
        message: isTurkishUi
          ? 'Kullanici adi 3-20 karakter olmali; harf, rakam ve alt cizgi kullan.'
          : 'Username must be 3-20 characters and use letters, numbers, or underscores.',
      });
      return;
    }

    if (password.length < 6) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Sifre en az 6 karakter olmali.' : 'Password must be at least 6 characters.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Sifre alanlari ayni olmali.' : 'Password fields must match.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: isTurkishUi ? 'Hesap olusturuluyor...' : 'Creating account...',
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
        const message = error.message || (isTurkishUi ? 'Kayit basarisiz.' : 'Registration failed.');
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

      const hasLiveSession = Boolean(data.session?.access_token);

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
          ? buildSignedInAuthState(
              data.user || data.session?.user || null,
              authRememberMe
                ? (isTurkishUi ? 'Kayit tamamlandi. Oturum acildi.' : 'Registration complete. Session opened.')
                : (isTurkishUi
                    ? 'Kayit tamamlandi. Oturum bu acilis icin aktif; sonraki acilista tekrar giris istenebilir.'
                    : 'Registration complete. This session is active for now; you may need to sign in again next time.')
            )
          : {
              status: 'signed_out',
              message: isTurkishUi
                ? 'Kayit tamamlandi. Oturum acilmadi; proje ayarinda e-posta onayi acik olabilir.'
                : 'Registration complete. The session did not open; email confirmation may still be enabled for this project.',
            }
      );
      setAuthEntryStage('form');

      void trackMobileEvent(hasLiveSession ? 'signup_success' : 'signup_pending_confirmation', {
        method: 'password',
        rememberMe: authRememberMe ? 'enabled' : 'disabled',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : isTurkishUi ? 'Kayit basarisiz.' : 'Registration failed.';
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
    isTurkishUi,
  ]);

  const handleRequestPasswordReset = useCallback(async () => {
    const email = authEmail.trim().toLowerCase();

    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Supabase ayarlari eksik.' : 'Supabase settings are missing.',
      });
      return;
    }

    if (!email) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Sifre yenileme icin e-posta gerekli.' : 'Email is required to reset the password.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: isTurkishUi ? 'Sifre yenileme baglantisi gonderiliyor...' : 'Sending password reset link...',
    });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: MOBILE_AUTH_CALLBACK_URL,
      });
      if (error) {
        setAuthState({
          status: 'error',
          message: error.message || (isTurkishUi ? 'Sifre yenileme baglantisi gonderilemedi.' : 'Password reset link could not be sent.'),
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
      setAuthEntryStage('form');
      setAuthState({
        status: 'signed_out',
        message: isTurkishUi
          ? 'Sifre yenileme baglantisi e-posta adresine gonderildi.'
          : 'Password reset link sent to the email address.',
      });
      void trackMobileEvent('password_reset_requested', {
        method: 'email',
        redirectTo: MOBILE_AUTH_CALLBACK_URL,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : isTurkishUi ? 'Sifre yenileme baglantisi gonderilemedi.' : 'Password reset link could not be sent.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password_reset',
        reason: message,
      });
    }
  }, [authEmail, isTurkishUi]);

  const handleOAuthSignIn = useCallback(
    async (provider: 'google' | 'apple') => {
      const providerLabel = provider === 'apple' ? 'Apple' : 'Google';

      if (!isSupabaseConfigured || !supabase) {
        setAuthState({
          status: 'error',
          message: isTurkishUi
            ? `${providerLabel} girisi icin Supabase ayarlari eksik.`
            : `Supabase settings are missing for ${providerLabel} sign-in.`,
        });
        return;
      }

      setAuthState({
        status: 'loading',
        message: isTurkishUi
          ? `${providerLabel} girisi icin yonlendiriliyor...`
          : `Redirecting to ${providerLabel} sign-in...`,
      });
      setAuthEntryStage('form');
      void trackMobileEvent('oauth_start', {
        provider,
        surface: 'mobile_native',
      });

      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: MOBILE_AUTH_CALLBACK_URL,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          setAuthState({
            status: 'error',
            message: error.message || (isTurkishUi ? `${providerLabel} girisi baslatilamadi.` : `${providerLabel} sign-in could not be started.`),
          });
          void trackMobileEvent('oauth_failure', {
            provider,
            reason: error.message || 'oauth_start_failed',
          });
          return;
        }

        const redirectUrl = String(data?.url || '').trim();
        if (!redirectUrl) {
          setAuthState({
            status: 'error',
            message: isTurkishUi
              ? `${providerLabel} girisi icin yonlendirme URL olusmadi.`
              : `No redirect URL was created for ${providerLabel} sign-in.`,
          });
          void trackMobileEvent('oauth_failure', {
            provider,
            reason: 'missing_oauth_url',
          });
          return;
        }

        void trackMobileEvent('oauth_redirect_started', {
          provider,
          redirectTo: MOBILE_AUTH_CALLBACK_URL,
          returnTo: MOBILE_AUTH_RETURN_TO,
        });

        const authSessionResult =
          Platform.OS === 'web'
            ? await WebBrowser.openBrowserAsync(redirectUrl).then(() => ({
                type: 'opened' as const,
                url: null as string | null,
              }))
            : await WebBrowser.openAuthSessionAsync(redirectUrl, MOBILE_AUTH_RETURN_TO);

        if (Platform.OS === 'web') {
          setAuthFlowMode('login');
          setAuthState({
            status: 'signed_out',
            message: isTurkishUi
              ? `${providerLabel} girisini tarayicida tamamla; uygulama callback ile geri donecek.`
              : `Complete ${providerLabel} sign-in in the browser; the app will return through the callback.`,
          });
          return;
        }

        if (authSessionResult.type === 'success' && authSessionResult.url) {
          handleIncomingUrl(authSessionResult.url);
          return;
        }

        if (authSessionResult.type === 'cancel' || authSessionResult.type === 'dismiss') {
          setAuthState({
            status: 'signed_out',
            message: isTurkishUi ? `${providerLabel} girisi iptal edildi.` : `${providerLabel} sign-in was cancelled.`,
          });
          return;
        }

        setAuthState({
          status: 'error',
          message: isTurkishUi
            ? `${providerLabel} callback uygulamaya donmedi.`
            : `${providerLabel} callback did not return to the app.`,
        });
        void trackMobileEvent('oauth_failure', {
          provider,
          reason: `oauth_session_${authSessionResult.type}`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : isTurkishUi ? `${providerLabel} girisi baslatilamadi.` : `${providerLabel} sign-in could not be started.`;
        setAuthState({
          status: 'error',
          message,
        });
        void trackMobileEvent('oauth_failure', {
          provider,
          reason: message,
        });
      }
    },
    [handleIncomingUrl, isTurkishUi]
  );

  const handleGoogleSignIn = useCallback(async () => {
    await handleOAuthSignIn('google');
  }, [handleOAuthSignIn]);

  const handleAppleSignIn = useCallback(async () => {
    await handleOAuthSignIn('apple');
  }, [handleOAuthSignIn]);

  const handleCompletePasswordReset = useCallback(async () => {
    const password = authPassword.trim();
    const confirmPassword = authConfirmPassword.trim();

    if (!supabase) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Supabase hazir degil.' : 'Supabase is not ready.',
      });
      return;
    }

    if (password.length < 6) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Sifre en az 6 karakter olmali.' : 'Password must be at least 6 characters.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Sifre tekrar alanlari ayni olmali.' : 'Password confirmation fields must match.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: isTurkishUi ? 'Sifre guncelleniyor...' : 'Updating password...',
    });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setAuthState({
          status: 'error',
          message: error.message || (isTurkishUi ? 'Sifre guncellenemedi.' : 'Password could not be updated.'),
        });
        void trackMobileEvent('auth_failure', {
          method: 'password_recovery',
          reason: error.message || 'password_reset_complete_failed',
        });
        return;
      }

      const sessionResult = await readSupabaseSessionSafe();
      const sessionUser = sessionResult.session?.user || null;
      const hasLiveSession = Boolean(sessionResult.session?.access_token);
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
      setAuthEntryStage('form');
      setAuthState(
        hasLiveSession
          ? buildSignedInAuthState(
              sessionUser,
              isTurkishUi ? 'Sifre guncellendi. Yeni sifren artik aktif.' : 'Password updated. Your new password is now active.'
            )
          : {
              status: 'signed_out',
              message: isTurkishUi ? 'Sifre guncellendi. Yeni sifrenle tekrar giris yapabilirsin.' : 'Password updated. You can sign in again with your new password.',
            }
      );
      void trackMobileEvent('password_reset_completed', {
        method: 'recovery',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : isTurkishUi ? 'Sifre guncellenemedi.' : 'Password could not be updated.';
      setAuthState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'password_recovery',
        reason: message,
      });
    }
  }, [authConfirmPassword, authEmail, authPassword, isTurkishUi]);

  const handleSignOut = useCallback(async () => {
    if (!supabase) {
      setAuthState({
        status: 'error',
        message: isTurkishUi ? 'Supabase hazir degil.' : 'Supabase is not ready.',
      });
      return;
    }

    setAuthState({
      status: 'loading',
      message: isTurkishUi ? 'Cikis yapiliyor...' : 'Signing out...',
    });

    try {
      await supabase.auth.signOut();
      setAuthState({
        status: 'signed_out',
        message: isTurkishUi ? 'Cikis yapildi.' : 'Signed out.',
      });
      setAuthFullName('');
      setAuthUsername('');
      setAuthBirthDate('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthFlowMode('login');
      setAuthEntryStage('intro');
    } catch (error) {
      setAuthState({
        status: 'error',
        message: error instanceof Error ? error.message : isTurkishUi ? 'Cikis basarisiz.' : 'Sign-out failed.',
      });
    }
  }, [isTurkishUi]);

  const isDawnTheme = themeMode === 'dawn';
  const tabTheme = useMemo(() => createTabTheme(themeMode), [themeMode]);

  useEffect(() => {
    if (settingsVisible) return;
    setAccountDeletionState({
      status: 'idle',
      message: '',
    });
    setEmailVerificationState({
      status: 'idle',
      message: '',
    });
  }, [settingsVisible]);

  useEffect(() => {
    void trackMobileEvent('session_start', {
      platform: Platform.OS,
      appSurface: 'mobile_native',
    });
  }, []);

  useEffect(() => {
    void import('./src/lib/mobileAds').then((m) => m.initAds());
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
    void writeStoredMobileThemeMode(themeMode);
    if (authState.status === 'signed_in') {
      void syncMobileUserSettingsToCloud({ language: settingsLanguage, themeMode });
    }
  }, [themeMode]);  

  useEffect(() => {
    let active = true;
    void (async () => {
      const [rawIdentity, rawLanguage, rawPrivacy] = await Promise.all([
        AsyncStorage.getItem(MOBILE_PROFILE_IDENTITY_STORAGE_KEY),
        AsyncStorage.getItem(MOBILE_PROFILE_LANGUAGE_STORAGE_KEY),
        AsyncStorage.getItem(MOBILE_PROFILE_PRIVACY_STORAGE_KEY),
      ]);
      if (!active) return;
      setSettingsIdentityDraft(parseStoredIdentityDraft(rawIdentity));
      setSettingsLanguage(parseStoredLanguage(rawLanguage));
      setSettingsPrivacyDraft(parseStoredPrivacyDraft(rawPrivacy));
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
    if (authState.status === 'signed_in') {
      void syncMobileUserSettingsToCloud({ language: settingsLanguage, themeMode });
    }
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
      void notifyLeagueProgress({
        leagueKey: profileState.leagueKey,
        leagueName: profileState.leagueName,
        leagueColor: profileState.leagueColor,
        totalXp: profileState.totalXp,
      });
    }

    const previousStreakDate = lastObservedStreakDateRef.current;
    const streakDateKey = String(profileState.lastRitualDate || '').trim() || null;

    // On first observation, just initialize refs without triggering celebration
    if (!streakObservedInitRef.current) {
      streakObservedInitRef.current = true;
      lastObservedLeagueIndexRef.current = currentIndex;
      lastObservedStreakRef.current = profileState.streak;
      lastObservedStreakDateRef.current = streakDateKey;
      lastObservedTotalXpRef.current = profileState.totalXp;
      lastObservedMarksRef.current = [...(profileState.marks || [])];
      const tierInfo = getMobileLeagueTierInfo(profileState.totalXp);
      lastObservedTierRef.current = { leagueIndex: currentIndex, tier: tierInfo.tier };
      return;
    }

    // Tier advancement: same league, higher tier
    const tierInfo = getMobileLeagueTierInfo(profileState.totalXp);
    const prevTier = lastObservedTierRef.current;
    if (
      prevTier !== null &&
      currentIndex === prevTier.leagueIndex &&
      tierInfo.tier > prevTier.tier
    ) {
      setTierAdvancementEvent({
        leagueKey: profileState.leagueKey,
        tier: tierInfo.tier as 1 | 2 | 3,
        tierLabel: tierInfo.tierLabel,
        color: profileState.leagueColor,
      });
    }
    lastObservedTierRef.current = { leagueIndex: currentIndex, tier: tierInfo.tier };

    // XP gain toast
    const prevXp = lastObservedTotalXpRef.current;
    if (prevXp !== null && profileState.totalXp > prevXp) {
      setXpGainDelta(profileState.totalXp - prevXp);
    }
    lastObservedTotalXpRef.current = profileState.totalXp;

    // New mark detection
    const prevMarks = lastObservedMarksRef.current;
    if (prevMarks !== null) {
      const prevSet = new Set(prevMarks);
      const newMarks = (profileState.marks || []).filter((id) => !prevSet.has(id));
      if (newMarks.length > 0) {
        setMarkUnlockQueue((prev) => [...prev, ...newMarks]);
      }
    }
    lastObservedMarksRef.current = [...(profileState.marks || [])];

    // Streak celebration: fires when today's ritual date becomes set during this session
    const streakAdvanced =
      profileState.streak > 0 &&
      streakDateKey === getLocalDateKey() &&
      streakDateKey !== previousStreakDate;

    if (streakAdvanced) {
      setStreakCelebrationEvent({
        day: profileState.streak,
        isMilestone: isStreakMilestone(profileState.streak),
      });
      void notifyStreakProgress(profileState.streak, streakDateKey);
    }

    lastObservedLeagueIndexRef.current = currentIndex;
    lastObservedStreakRef.current = profileState.streak;
    lastObservedStreakDateRef.current = streakDateKey;
  }, [notifyLeagueProgress, notifyStreakProgress, profileState]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      setProfileActivityState({
        status: 'idle',
        message: isTurkishUi ? 'Profil aktivitesi icin giris bekleniyor.' : 'Sign in to view profile activity.',
        items: [],
      });
      setProfileMovieArchiveModalState({
        visible: false,
        status: 'idle',
        message: isTurkishUi ? 'Film arsivi icin giris bekleniyor.' : 'Sign in to view the movie archive.',
        movie: null,
        entries: [],
      });
      return;
    }
    void refreshProfileActivity();
  }, [authState.status, isTurkishUi, refreshProfileActivity]);

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
    void refreshDailyCommentFeed(dailyCommentFeedScope);
  }, [authState.status, dailyCommentFeedScope, refreshDailyCommentFeed]);

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
    const incomingUrl = String(lastIncomingUrl || '').trim();
    if (!incomingUrl) return;
    if (lastHandledAuthCallbackUrlRef.current === incomingUrl) return;
    lastHandledAuthCallbackUrlRef.current = incomingUrl;

    let active = true;

    void (async () => {
      const callbackResult = await applyMobileAuthCallbackFromUrl(incomingUrl);
      if (!active || !callbackResult.matched) return;

      if (!callbackResult.ok) {
        setAuthFlowMode(callbackResult.recoveryMode ? 'recovery' : 'login');
        setAuthPassword('');
        setAuthConfirmPassword('');
        setAuthModalVisible(true);
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

      const sessionResult = supabase ? await readSupabaseSessionSafe() : null;
      const sessionUser = sessionResult?.session?.user || null;
      const hasLiveSession = Boolean(sessionResult?.session?.access_token);
      const email = hasLiveSession ? resolveSupabaseUserAuthLabel(sessionUser) : '';

      if (callbackResult.recoveryMode) {
        setAuthEntryStage('form');
        setAuthFlowMode('recovery');
        setAuthModalVisible(true);
        setAuthPassword('');
        setAuthConfirmPassword('');
      } else {
        setAuthEntryStage('form');
        setAuthFlowMode('login');
        if (email) {
          void trackMobileEvent('login_success', {
            method: callbackResult.method,
          });
        }
      }

      setAuthState(
        hasLiveSession
          ? buildSignedInAuthState(sessionUser, callbackResult.message)
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
      setAuthEntryStage('form');
    }
  }, [authFlowMode]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      setAuthModalVisible(false);
    }
  }, [authState.status]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      hasAutoOpenedLaunchAuthRef.current = true;
      return;
    }
    if (authState.status !== 'signed_out') return;
    if (authModalVisible || hasAutoOpenedLaunchAuthRef.current) return;

    hasAutoOpenedLaunchAuthRef.current = true;
    openAuthModal('login');
  }, [authModalVisible, authState.status, openAuthModal]);

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
    openAuthModal('login');
  }, [activeIntent, authState.status, openAuthModal]);

  useEffect(() => {
    if (authState.status === 'signed_in') {
      void refreshProfileStats();
      return;
    }

    lastObservedLeagueIndexRef.current = null;
    lastObservedStreakRef.current = null;
    lastObservedStreakDateRef.current = null;
    streakObservedInitRef.current = false;
    lastObservedTierRef.current = null;
    lastObservedTotalXpRef.current = null;
    lastObservedMarksRef.current = null;
    setLeaguePromotionEvent(null);
    setStreakCelebrationEvent(null);
    setTierAdvancementEvent(null);
    setXpGainDelta(null);
    setMarkUnlockQueue([]);

    setProfileState({
      status: 'idle',
      message: 'Profil metrikleri icin giris bekleniyor.',
    });
  }, [authState.status, refreshProfileStats]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      hasCloudIdentityHydratedRef.current = false;
      hasCloudPrivacyHydratedRef.current = false;
      return;
    }
    if (hasCloudIdentityHydratedRef.current) return;
    hasCloudIdentityHydratedRef.current = true;
    void refreshSettingsIdentityFromCloud();
  }, [authState.status, refreshSettingsIdentityFromCloud]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      hasCloudPrivacyHydratedRef.current = false;
      return;
    }
    if (hasCloudPrivacyHydratedRef.current) return;
    hasCloudPrivacyHydratedRef.current = true;
    void refreshSettingsPrivacyFromCloud();
  }, [authState.status, refreshSettingsPrivacyFromCloud]);

  useEffect(() => {
    if (authState.status !== 'signed_in') return;
    void hydrateSettingsIdentityFromSession();
  }, [authState.status, hydrateSettingsIdentityFromSession]);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      hasCloudUserSettingsHydratedRef.current = false;
      return;
    }
    if (hasCloudUserSettingsHydratedRef.current) return;
    hasCloudUserSettingsHydratedRef.current = true;
    void refreshUserSettingsFromCloud();
  }, [authState.status, refreshUserSettingsFromCloud]);

  useEffect(() => {
    void syncLetterboxdImportState();
  }, [syncLetterboxdImportState]);

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
        const notificationId = String(snapshot.notificationId || '').trim();
        if (notificationId) {
          void markMobileNotificationEventsRead({ notificationIds: [notificationId] });
        }
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
    if (authState.status !== 'signed_in') {
      lastNotificationEventIdRef.current = '';
      return () => undefined;
    }

    let active = true;

    const syncLatestEvents = async (reason: 'initial' | 'poll') => {
      const syncedCount = await syncNotificationEventInbox(reason);
      if (!active || syncedCount === 0) return;
      void trackMobileEvent('page_view', {
        reason:
          reason === 'initial'
            ? 'mobile_notification_events_synced'
            : 'mobile_notification_events_polled',
        count: syncedCount,
      });
    };

    void syncLatestEvents('initial');

    const unsubscribe = subscribeToMobileNotificationEvents({
      onInsert: (snapshot) => {
        if (!active) return;
        lastNotificationEventIdRef.current = snapshot.notificationId;
        setPushState((prev) => ({
          ...prev,
          lastNotification: describePushNotification(snapshot),
        }));
        void appendPushInbox(snapshot, 'received');
        void trackMobileEvent('page_view', {
          reason: 'mobile_notification_event_received',
          hasDeepLink: Boolean(snapshot.deepLink),
          notificationType: snapshot.kind,
          title: snapshot.title || null,
        });
      },
    });

    const pollId = setInterval(() => {
      void syncLatestEvents('poll');
    }, 20000);

    return () => {
      active = false;
      clearInterval(pollId);
      unsubscribe();
    };
  }, [authState.status, appendPushInbox, describePushNotification, syncNotificationEventInbox]);

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

  const handlePullRefreshDaily = useCallback(async () => {
    if (dailyPullRefreshing) return;
    setDailyPullRefreshing(true);
    try {
      await Promise.all([loadDailyMovies(), refreshDailyCommentFeed(dailyCommentFeedScope)]);
    } finally {
      setDailyPullRefreshing(false);
    }
  }, [dailyCommentFeedScope, dailyPullRefreshing, loadDailyMovies, refreshDailyCommentFeed]);

  const handlePullRefreshExplore = useCallback(async () => {
    if (explorePullRefreshing) return;
    setExplorePullRefreshing(true);
    try {
      await refreshArenaLeaderboard();
    } finally {
      setExplorePullRefreshing(false);
    }
  }, [explorePullRefreshing, refreshArenaLeaderboard]);

  const handlePullRefreshInbox = useCallback(async () => {
    if (inboxPullRefreshing) return;
    setInboxPullRefreshing(true);
    try {
      await refreshPushInbox();
      if (authState.status === 'signed_in') {
        await syncNotificationEventInbox('poll');
      }
    } finally {
      setInboxPullRefreshing(false);
    }
  }, [authState.status, inboxPullRefreshing, refreshPushInbox, syncNotificationEventInbox]);


  const handleSubmitRitualDraft = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      openAuthModal('login');
      setRitualSubmitState({
        status: 'error',
        message: 'Yorum gondermek icin once giris yapmalisin.',
      });
      return;
    }

    if (!selectedDailyMovie) {
      setRitualSubmitState({
        status: 'error',
        message: 'Yorum icin once film secimi yapilmali.',
      });
      return;
    }

    const text = ritualDraftText.trim();
    if (!text) {
      setRitualSubmitState({
        status: 'error',
        message: 'Yorum metni bos olamaz.',
      });
      return;
    }
    if (ritualDraftRating <= 0) {
      setRitualSubmitState({
        status: 'error',
        message: 'Puan secmeden yorum gonderemezsin.',
      });
      return;
    }

    setRitualSubmitState({
      status: 'submitting',
      message: 'Yorum gonderiliyor...',
    });

    const draftLeagueKey =
      profileState.status === 'success'
        ? profileState.leagueKey
        : resolveMobileLeagueKeyFromXp(0);

    const result = await submitRitualDraftWithQueue({
      movieTitle: selectedDailyMovie.title,
      text,
      genre: selectedDailyMovie.genre,
      rating: ritualDraftRating,
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
    setRitualDraftRating(0);
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
      void refreshProfileActivity();
      void refreshDailyCommentFeed(dailyCommentFeedScope);
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
    authState.status,
    dailyCommentFeedScope,
    openAuthModal,
    profileState,
    refreshDailyCommentFeed,
    refreshProfileStats,
    refreshProfileActivity,
    ritualDraftText,
    ritualDraftRating,
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
      void refreshProfileActivity();
      void refreshDailyCommentFeed(dailyCommentFeedScope);
    }

    await refreshRitualQueue();
  }, [dailyCommentFeedScope, refreshDailyCommentFeed, refreshProfileActivity, refreshProfileStats, refreshRitualQueue]);

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
    if (!PUSH_FEATURE_ENABLED) {
      hasAttemptedSignedInPushRegistrationRef.current = false;
      return;
    }
    if (authState.status !== 'signed_in') {
      hasAttemptedSignedInPushRegistrationRef.current = false;
      return;
    }
    if (pushState.status === 'loading') return;
    if (hasAttemptedSignedInPushRegistrationRef.current) return;
    hasAttemptedSignedInPushRegistrationRef.current = true;
    void refreshPushRegistration();
  }, [authState.status, pushState.status, pushState.token, refreshPushRegistration]);

  const inviteCode =
    activeIntent.target === 'invite' || activeIntent.target === 'share'
      ? activeIntent.invite
      : undefined;
   
  const _sharePlatform = activeIntent.target === 'share' ? activeIntent.platform : undefined;
  const shareGoal = activeIntent.target === 'share' ? activeIntent.goal : undefined;
  const canSubmitRitualDraft = Boolean(
    isSignedIn && selectedDailyMovie && ritualDraftText.trim().length > 0 && ritualDraftRating > 0
  );
  const isShareRouteActive = screenPlan.screen === 'share_hub';
  const isDevSurfaceEnabled = INTERNAL_OPS_VISIBLE;
  const handleTabNavigationStateChange = useCallback(() => {
    const currentRouteName = tabNavigationRef.getCurrentRoute()?.name;
    if (!currentRouteName) return;
    const nextTabKey = MAIN_KEY_BY_TAB[currentRouteName as keyof typeof MAIN_KEY_BY_TAB];
    if (!nextTabKey) return;
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
  const inboxSummary = `${pushInboxState.items.length} ${localizedUiCopy.inboxItemsLabel}`;
  const unreadDeepLinkCount = pushInboxState.items.filter(
    (item) => !item.opened && Boolean(item.deepLink)
  ).length;
  const pendingQueueCount = ritualQueueState.pendingCount;
  const streakSummary = profileState.status === 'success' ? String(profileState.streak) : '--';
  const arenaIdentityLabel =
    profileState.status === 'success'
      ? String(profileState.displayName || '').trim()
      : authState.status === 'signed_in'
        ? String(authState.email.split('@')[0] || '').trim()
        : '';
  const arenaCurrentEntry =
    arenaIdentityLabel
      ? arenaState.entries.find(
          (entry) =>
            String(entry.displayName || '').trim().toLowerCase() === arenaIdentityLabel.toLowerCase()
        ) || null
      : null;
  const _arenaScoreSummary =
    profileState.status === 'success' ? profileState.weeklyArenaScore.toLocaleString() : '--';
  const _arenaActivitySummary =
    profileState.status === 'success' ? String(profileState.weeklyArenaActivity) : '--';
  const _arenaRankSummary = arenaCurrentEntry ? `#${arenaCurrentEntry.rank}` : '--';
  const arenaAboveEntry =
    arenaCurrentEntry && arenaCurrentEntry.rank > 1
      ? arenaState.entries[arenaCurrentEntry.rank - 2] || null
      : null;
  const arenaGapValue =
    arenaAboveEntry && arenaCurrentEntry
      ? Math.max(0, arenaAboveEntry.weeklyArenaScore - arenaCurrentEntry.weeklyArenaScore)
      : 0;
  const _arenaGapSummary =
    arenaCurrentEntry && arenaCurrentEntry.rank === 1
      ? isTurkishUi
        ? 'Lider'
        : 'Leader'
      : arenaGapValue > 0
        ? `-${arenaGapValue}`
        : '--';
  const _arenaSeasonSummary = arenaState.weekKey || '--';
  const _arenaGroupSummary =
    arenaState.scope === 'league' && arenaState.cohortLeagueKey
      ? arenaState.cohortLeagueKey
      : isTurkishUi
        ? 'Genel'
        : 'Global';
  const _arenaLeagueSummary =
    profileState.status === 'success'
      ? `${profileState.leagueName}${isTurkishUi ? ' ligi' : ' league'}`
      : isTurkishUi
        ? 'Lig bekleniyor'
        : 'League pending';
  const _arenaSourceSummary =
    arenaCurrentEntry && arenaCurrentEntry.rank === 1
      ? isTurkishUi
        ? 'Bu tabloda liderlik sende.'
        : 'You are leading this board.'
      : arenaGapValue > 0 && arenaAboveEntry
        ? isTurkishUi
          ? `${arenaGapValue.toLocaleString()} puan sonra ${arenaAboveEntry.displayName} ustune cikarsin.`
          : `${arenaGapValue.toLocaleString()} points to pass ${arenaAboveEntry.displayName}.`
        : arenaState.message;
   
  const _commentFeedSummary =
    commentFeedState.status === 'ready'
      ? localizedUiCopy.explore.commentReady(commentFeedState.items.length)
      : commentFeedState.status === 'error'
        ? localizedUiCopy.explore.commentError
        : commentFeedState.status === 'loading'
          ? localizedUiCopy.explore.commentLoading
          : localizedUiCopy.explore.commentIdle;
  const inboxTabBadge =
    unreadDeepLinkCount > 0 ? (unreadDeepLinkCount > 9 ? '9+' : unreadDeepLinkCount) : undefined;
  const themeModeLabel = isDawnTheme ? localizedUiCopy.themeMode.dawn : localizedUiCopy.themeMode.midnight;
  const tabLabels = useMemo(() => MOBILE_TAB_LABELS[settingsLanguage] || MOBILE_TAB_LABELS.tr, [settingsLanguage]);
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <AnimatedTabBar {...props} tabLabels={tabLabels} inboxBadge={inboxTabBadge} isDawnTheme={isDawnTheme} />
    ),
    [tabLabels, inboxTabBadge, isDawnTheme]
  );
  const dailyHeroFirstName =
    String(
      settingsIdentityDraft.fullName ||
        (profileState.status === 'success' ? profileState.displayName : '') ||
        (authState.status === 'signed_in' ? authState.email.split('@')[0] : '')
    )
      .trim()
      .split(/\s+/)[0] || null;
  const dailyHeroGreeting =
    dailyState.status === 'success'
      ? buildDailyGreetingCard({
          language: settingsLanguage,
          hour: new Date().getHours(),
          completed: selectedDailyMovieId != null,
          streakValue: profileState.status === 'success' ? profileState.streak : 0,
          firstName: dailyHeroFirstName,
          selectedMovieTitle:
            dailyState.movies.find((movie) => movie.id === selectedDailyMovieId)?.title?.trim() || null,
          firstMovieTitle: dailyState.movies[0]?.title?.trim() || null,
          dateKey: dailyState.date || null,
        })
      : null;
  const dailyHeroGreetingAccent =
    dailyHeroGreeting?.tone === 'sage'
      ? '#8A9A5B'
      : dailyHeroGreeting?.tone === 'clay'
        ? '#A57164'
        : '#B68B4C';
  const mobileDailySectionCopy = useMemo(
    () =>
      ({
        tr: {
          dailyTitle: 'Gunluk Filmler',
          dailyMeta: 'Secimler',
          commentsTitle: 'Yorumlar',
          commentsMetaToday: 'Gunluk akis',
          commentsMetaAll: 'Tum yorumlar',
          commentsTodayLabel: 'Bugun',
          commentsAllLabel: 'Tum Yorumlar',
          routesTitle: 'Kesif Rotalari',
          routesCount: (count: number) => `${count} rota`,
        },
        en: {
          dailyTitle: 'Daily Films',
          dailyMeta: 'Picks',
          commentsTitle: 'Comments',
          commentsMetaToday: 'Daily feed',
          commentsMetaAll: 'All comments',
          commentsTodayLabel: 'Today',
          commentsAllLabel: 'All Comments',
          routesTitle: 'Discovery Routes',
          routesCount: (count: number) => `${count} routes`,
        },
        es: {
          dailyTitle: 'Peliculas del Dia',
          dailyMeta: 'Selecciones',
          commentsTitle: 'Comentarios',
          commentsMetaToday: 'Flujo diario',
          commentsMetaAll: 'Todos los comentarios',
          commentsTodayLabel: 'Hoy',
          commentsAllLabel: 'Todos',
          routesTitle: 'Rutas de Descubrimiento',
          routesCount: (count: number) => `${count} rutas`,
        },
        fr: {
          dailyTitle: 'Films du Jour',
          dailyMeta: 'Selections',
          commentsTitle: 'Commentaires',
          commentsMetaToday: 'Flux quotidien',
          commentsMetaAll: 'Tous les commentaires',
          commentsTodayLabel: "Aujourd hui",
          commentsAllLabel: 'Tous',
          routesTitle: 'Routes de Decouverte',
          routesCount: (count: number) => `${count} routes`,
        },
      })[settingsLanguage] || {
        dailyTitle: 'Daily Films',
        dailyMeta: 'Picks',
        commentsTitle: 'Comments',
        commentsMetaToday: 'Daily feed',
        commentsMetaAll: 'All comments',
        commentsTodayLabel: 'Today',
        commentsAllLabel: 'All Comments',
        routesTitle: 'Discovery Routes',
        routesCount: (count: number) => `${count} routes`,
      },
    [settingsLanguage]
  );
  const mobileArenaSectionCopy = useMemo(
    () =>
      ({
        tr: {
          meta: 'Siralama',
          leaguesTitle: 'Ligler',
          leaguesMeta: `Her ${LEVEL_THRESHOLD} XP`,
        },
        en: {
          meta: 'Ranking',
          leaguesTitle: 'Leagues',
          leaguesMeta: `Every ${LEVEL_THRESHOLD} XP`,
        },
        es: {
          meta: 'Clasificacion',
          leaguesTitle: 'Ligas',
          leaguesMeta: `Cada ${LEVEL_THRESHOLD} XP`,
        },
        fr: {
          meta: 'Classement',
          leaguesTitle: 'Ligues',
          leaguesMeta: `Chaque ${LEVEL_THRESHOLD} XP`,
        },
      })[settingsLanguage] || {
        meta: 'Ranking',
        leaguesTitle: 'Leagues',
        leaguesMeta: `Every ${LEVEL_THRESHOLD} XP`,
      },
    [settingsLanguage]
  );
  const _mobileHeroCopy = useMemo(
    () =>
      ({
        tr: {
          subtitle: 'Gunluk secim, yorum notu ve sosyal akis tek yerde.',
          sessionReady: 'Oturum: hazir',
          sessionRequired: 'Oturum: gerekli',
        },
        en: {
          subtitle: 'Daily pick, comment notes, and social feed in one place.',
          sessionReady: 'Session: ready',
          sessionRequired: 'Session: required',
        },
        es: {
          subtitle: 'Seleccion diaria, notas de comentarios y flujo social en un solo lugar.',
          sessionReady: 'Sesion: lista',
          sessionRequired: 'Sesion: necesaria',
        },
        fr: {
          subtitle: 'Selection du jour, notes de commentaires et flux social au meme endroit.',
          sessionReady: 'Session: prete',
          sessionRequired: 'Session: requise',
        },
      })[settingsLanguage] || {
        subtitle: 'Daily pick, comment notes, and social feed in one place.',
        sessionReady: 'Session: ready',
        sessionRequired: 'Session: required',
      },
    [settingsLanguage]
  );
  const mobileDiscoverRouteSurfaceCopy = useMemo(
    () =>
      ({
        tr: {
          eyebrow: 'Kesif Rotasi',
          fallbackTitle: 'Rota',
          openInBrowser: 'Tarayicida Ac',
          close: 'Kapat',
          loading: 'Kesif rotasi yukleniyor...',
          error: 'Rota yuklenemedi.',
          errorTitle: 'Rota yuklenemedi',
        },
        en: {
          eyebrow: 'Discovery Route',
          fallbackTitle: 'Route',
          openInBrowser: 'Open in Browser',
          close: 'Close',
          loading: 'Loading discovery route...',
          error: 'Route could not be loaded.',
          errorTitle: 'Route could not be loaded',
        },
        es: {
          eyebrow: 'Ruta de Descubrimiento',
          fallbackTitle: 'Ruta',
          openInBrowser: 'Abrir en el Navegador',
          close: 'Cerrar',
          loading: 'Cargando ruta de descubrimiento...',
          error: 'No se pudo cargar la ruta.',
          errorTitle: 'No se pudo cargar la ruta',
        },
        fr: {
          eyebrow: 'Route de Decouverte',
          fallbackTitle: 'Route',
          openInBrowser: 'Ouvrir dans le Navigateur',
          close: 'Fermer',
          loading: 'Chargement de la route de decouverte...',
          error: 'La route n a pas pu etre chargee.',
          errorTitle: 'La route n a pas pu etre chargee',
        },
      })[settingsLanguage] || {
        eyebrow: 'Discovery Route',
        fallbackTitle: 'Route',
        openInBrowser: 'Open in Browser',
        close: 'Close',
        loading: 'Loading discovery route...',
        error: 'Route could not be loaded.',
        errorTitle: 'Route could not be loaded',
      },
    [settingsLanguage]
  );
  const profileDisplayName = String(
    settingsIdentityDraft.fullName ||
      (profileState.status === 'success' ? profileState.displayName : '') ||
      (authState.status === 'signed_in' ? authState.email.split('@')[0] : localizedUiCopy.observerLabel)
  ).trim();
  const profileUsername = String(settingsIdentityDraft.username || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  const rawProfileBio = String(settingsIdentityDraft.bio || '').trim();
  const profileBio = /^(a silent observer\.?|manage your profile and archive here\.?|manage your profile and league status here\.?)$/i.test(rawProfileBio)
    ? ''
    : rawProfileBio;
  const profileAvatarUrl = String(settingsIdentityDraft.avatarUrl || '').trim();
  const profileLink = String(settingsIdentityDraft.profileLink || '').trim();
  const profileBirthDateLabel = normalizeDateLabel(settingsIdentityDraft.birthDate);
  const profileGenderLabel =
    settingsIdentityDraft.gender === 'female'
      ? isTurkishUi
        ? 'Kadin'
        : 'Female'
      : settingsIdentityDraft.gender === 'male'
        ? isTurkishUi
          ? 'Erkek'
          : 'Male'
        : settingsIdentityDraft.gender === 'non_binary'
          ? isTurkishUi
            ? 'Ikili olmayan'
            : 'Non-binary'
          : settingsIdentityDraft.gender === 'prefer_not_to_say'
            ? isTurkishUi
              ? 'Belirtmek istemiyorum'
              : 'Prefer not to say'
            : '';

  const profileShellTitle = isSignedIn
    ? profileDisplayName || localizedUiCopy.observerLabel
    : localizedUiCopy.profile.screenTitle;
  const profileShellBody = isSignedIn
    ? profileBio || localizedUiCopy.profile.bioFallback
    : localizedUiCopy.profile.readOnlyBody;
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
  const publicProfileDisplayName = String(
    publicSnapshot?.displayName || publicProfileFullState.displayName || localizedUiCopy.unknownProfileLabel
  ).trim();
  const publicProfileAvatarUrl = String(publicSnapshot?.avatarUrl || '').trim();
  const publicProfileVisibility = publicSnapshot?.visibility || DEFAULT_SETTINGS_PRIVACY;
  const publicProfileResolvedMarks = useMemo(() => {
    if (!publicSnapshot) {
      return {
        marks: [],
        featuredMarks: [],
      };
    }

    if (publicSnapshot.marks.length > 0 || publicProfileFullState.items.length === 0) {
      return {
        marks: publicSnapshot.marks,
        featuredMarks: publicSnapshot.featuredMarks,
      };
    }

    const dailyRituals = publicProfileFullState.items.map((item) => ({
      date: String(item.dayKey || '').trim() || null,
      movieId: item.movieId,
      movieTitle: item.movieTitle,
      text: item.text,
      genre: item.genre,
      year: item.year,
      created_at: item.rawTimestamp,
    }));

    const activeDays = Array.from(
      new Set(
        publicProfileFullState.items
          .map((item) => String(item.dayKey || '').trim())
          .filter(Boolean)
      )
    );

    const uniqueGenres = Array.from(
      new Set(
        publicProfileFullState.items
          .map((item) => String(item.genre || '').trim())
          .filter(Boolean)
      )
    );

    return resolveStoredProfileMarks({
      marks: publicSnapshot.marks,
      featuredMarks: publicSnapshot.featuredMarks,
      dailyRituals,
      activeDays,
      uniqueGenres,
      streak: publicSnapshot.streak,
      following:
        publicSnapshot.followingCount > 0
          ? Array.from({ length: publicSnapshot.followingCount }, (_, index) => `follow-${index + 1}`)
          : [],
    });
  }, [publicProfileFullState.items, publicSnapshot]);
  const publicProfileCommentCount = publicSnapshot
    ? Math.max(publicSnapshot.ritualsCount, publicProfileFullState.items.length)
    : 0;
  const publicProfileStats = publicSnapshot
    ? {
        streak: publicSnapshot.streak,
        rituals: publicProfileCommentCount,
        marks: publicProfileResolvedMarks.marks.length,
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
   
  const _publicProfileLeadMetrics = [
    ...(publicProfileVisibility.showStats
      ? [
          { label: localizedUiCopy.publicProfile.metrics.comments, value: String(publicProfileStats.rituals) },
          { label: localizedUiCopy.publicProfile.metrics.streak, value: String(publicProfileStats.streak) },
        ]
      : [{ label: localizedUiCopy.publicProfile.metrics.stats, value: localizedUiCopy.publicProfile.hidden }]),
    ...(publicProfileVisibility.showFollowCounts
      ? [
          { label: localizedUiCopy.publicProfile.metrics.followers, value: String(publicProfileStats.followers) },
          { label: localizedUiCopy.publicProfile.metrics.following, value: String(publicProfileStats.following) },
        ]
      : [{ label: localizedUiCopy.publicProfile.metrics.follow, value: localizedUiCopy.publicProfile.hidden }]),
  ];
  const publicProfileMarksState: ProfileState = publicSnapshot
    ? {
        status: 'success',
        message: 'Profil marklari yuklendi.',
        displayName: publicSnapshot.displayName,
        totalXp: publicSnapshot.totalXp,
        leagueKey: publicProfileLeague?.leagueKey || fallbackLeague.leagueKey,
        leagueName: publicProfileLeague?.leagueInfo.name || fallbackLeague.leagueInfo.name,
        leagueColor: publicProfileLeague?.leagueInfo.color || fallbackLeague.leagueInfo.color,
        nextLeagueKey: null,
        nextLeagueName: null,
        streak: publicSnapshot.streak,
        ritualsCount: publicProfileCommentCount,
        daysPresent: publicSnapshot.daysPresent,
        followersCount: publicSnapshot.followersCount,
        followingCount: publicSnapshot.followingCount,
        marks: publicProfileResolvedMarks.marks,
        featuredMarks: publicProfileResolvedMarks.featuredMarks,
        lastRitualDate: publicSnapshot.lastRitualDate,
        weeklyArenaScore: 0,
        weeklyArenaActivity: 0,
        streakProtectionWeekKey: null,
        streakProtectionDate: null,
        streakProtectionClaimedAt: null,
        source: publicSnapshot.source,
      }
    : {
        status: 'idle',
        message: 'Profil verisi hazir degil.',
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
  const inviteStatsLabel = localizedUiCopy.inviteStatsEmpty;
  const inviteRewardLabel = localizedUiCopy.inviteRewardLabel;
  const letterboxdSummary = formatMobileLetterboxdSummary(letterboxdImportState.snapshot);
  const activeAccountLabel = profileDisplayName || localizedUiCopy.observerLabel;
  const activeEmailLabel = authState.status === 'signed_in' ? authState.email : '-';
  const isEmailVerified = authState.status === 'signed_in' ? authState.emailVerified : false;
  const emailConfirmedAt = authState.status === 'signed_in' ? authState.emailConfirmedAt : null;
  const shareHandle = String(
    profileUsername || (authState.status === 'signed_in' ? authState.email.split('@')[0] : localizedUiCopy.observerHandle)
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
  const effectiveShareInviteCode = '';
  const effectiveShareInviteLink = '';
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
    if (authState.status !== 'signed_in') {
      openAuthModal('login');
    }
    if (tabNavigationRef.isReady()) {
      tabNavigationRef.navigate(MAIN_TAB_BY_KEY.profile);
    }
    void trackMobileEvent('page_view', {
      reason: 'mobile_profile_open_share_hub',
      hasInviteCode: Boolean(effectiveShareInviteCode),
      preferredGoal: canShareStreak ? 'streak' : 'comment',
    });
  }, [authState.status, canShareStreak, effectiveShareInviteCode, openAuthModal, setManualIntent]);

   
  const _handleCommentFeedScopeChange = useCallback((scope: CommentFeedScope) => {
    setCommentFeedScope(scope);
    setCommentFeedState((prev) => ({
      ...prev,
      scope,
    }));
  }, []);

   
  const _handleCommentFeedQueryChange = useCallback((query: string) => {
    setCommentFeedQuery(query);
    setCommentFeedState((prev) => ({
      ...prev,
      query,
    }));
  }, []);

   
  const _handleCommentFeedSortChange = useCallback((sort: CommentFeedSort) => {
    setCommentFeedSort(sort);
    setCommentFeedState((prev) => ({
      ...prev,
      sort,
    }));
  }, []);

  const handleDailyCommentFeedScopeChange = useCallback((scope: CommentFeedScope) => {
    setDailyCommentFeedScope(scope);
    setDailyCommentFeedState((prev) => ({
      ...prev,
      scope,
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
    if (!item.isMine) {
      void sendEngagementPushNotification({
        kind: 'like',
        ritualId: item.id,
        actorLabel: resolveNotificationActorLabel(),
      }).then((pushResult) => {
        void trackMobileEvent('page_view', {
          reason: pushResult.ok
            ? 'mobile_comment_echo_push_sent'
            : 'mobile_comment_echo_push_failed',
          ritualId: item.id,
          targetUserId: item.userId,
        });
      });
    }
    return result;
  }, [resolveNotificationActorLabel]);

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

  const handleEchoReply = useCallback(async (reply: MobileCommentReply) => {
    const result = await echoMobileCommentReply(reply.id);
    void trackMobileEvent('page_view', {
      reason: result.ok ? 'mobile_reply_echo_sent' : 'mobile_reply_echo_failed',
      replyId: reply.id,
    });
    return result;
  }, []);

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
        if (!item.isMine) {
          void sendEngagementPushNotification({
            kind: 'comment',
            ritualId: item.id,
            actorLabel: resolveNotificationActorLabel(),
          }).then((pushResult) => {
            void trackMobileEvent('page_view', {
              reason: pushResult.ok
                ? 'mobile_comment_reply_push_sent'
                : 'mobile_comment_reply_push_failed',
              ritualId: item.id,
              targetUserId: item.userId,
            });
          });
        }
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
    [profileDisplayName, resolveNotificationActorLabel]
  );

  const deleteOwnCommentById = useCallback(
    async (id: string) => {
      const result = await deleteMobileCommentRitual(id);

      setCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
        items: result.ok ? prev.items.filter((entry) => entry.id !== id) : prev.items,
      }));
      setDailyCommentFeedState((prev) => ({
        ...prev,
        message: result.message,
        items: result.ok ? prev.items.filter((entry) => entry.id !== id) : prev.items,
      }));
      setProfileMovieArchiveModalState((prev) => ({
        ...prev,
        message: prev.visible ? result.message : prev.message,
        entries: result.ok ? prev.entries.filter((entry) => entry.id !== id) : prev.entries,
      }));

      if (result.ok) {
        void refreshProfileStats();
        void refreshProfileActivity();
      }

      return result;
    },
    [refreshProfileActivity, refreshProfileStats]
  );

  const handleDeleteComment = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      if (!item.isMine) {
        return {
          ok: false,
          message: 'Sadece kendi yorumunu silebilirsin.',
        };
      }

      return deleteOwnCommentById(item.id);
    },
    [deleteOwnCommentById]
  );

  const handleDeleteProfileMovieArchiveEntry = useCallback(
    async (entry: MobileProfileMovieArchiveEntry) => deleteOwnCommentById(entry.id),
    [deleteOwnCommentById]
  );

  const handleCloseDiscoverRouteSurface = useCallback(() => {
    setDiscoverRouteSurfaceState({
      visible: false,
      title: '',
      url: '',
      loading: false,
      error: '',
    });
  }, []);

  useEffect(() => {
    setInviteClaimState({ status: 'idle' });
  }, [screenPlan.screen, inviteCode]);

  // handleOpenDiscoverRoute removed — discovery routes replaced by Quiz tab

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

  const handleChangeSettingsPrivacy = useCallback(
    (patch: Partial<MobileSettingsPrivacyDraft>) => {
      setSettingsPrivacyDraft((prev) =>
        normalizeMobileProfileVisibility({
          ...prev,
          ...patch,
        })
      );
      setSettingsSaveState((prev) =>
        prev.status === 'idle' && !prev.message ? prev : { status: 'idle', message: '' }
      );
    },
    []
  );

  const handleImportLetterboxd = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setLetterboxdImportState((prev) => ({
        ...prev,
        status: 'error',
        message: 'Letterboxd importu icin once giris yap.',
      }));
      return;
    }

    setLetterboxdImportState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'CSV seciliyor...',
    }));

    try {
      const identity = await readLetterboxdImportIdentity();
      if (!identity) {
        setLetterboxdImportState((prev) => ({
          ...prev,
          status: 'error',
          message: 'Letterboxd importu icin oturum bulunamadi.',
        }));
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: Platform.OS === 'web',
      });
      if (result.canceled) {
        setLetterboxdImportState((prev) => ({
          ...prev,
          status: prev.snapshot ? 'ready' : 'idle',
          message: prev.snapshot ? 'Letterboxd import hazir.' : '',
        }));
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setLetterboxdImportState((prev) => ({
          ...prev,
          status: 'error',
          message: 'CSV dosyasi okunamadi.',
        }));
        return;
      }

      const csvText = await readPickedAssetAsText(asset);
      const importResult = await importMobileLetterboxdCsv(identity, csvText, asset.name);
      if (!importResult.ok) {
        setLetterboxdImportState((prev) => ({
          ...prev,
          status: 'error',
          message: importResult.message,
        }));
        return;
      }

      setLetterboxdImportState({
        status: 'ready',
        message: importResult.message,
        snapshot: importResult.snapshot,
      });
      void syncLetterboxdImportState();
      void trackMobileEvent('page_view', {
        reason: 'mobile_letterboxd_imported',
        importedRows: importResult.analysis.parse.importedRows,
        movieCount: importResult.snapshot.items.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Letterboxd importu tamamlanamadi.';
      setLetterboxdImportState((prev) => ({
        ...prev,
        status: 'error',
        message,
      }));
      void trackMobileEvent('page_view', {
        reason: 'mobile_letterboxd_import_failed',
        message,
      });
    }
  }, [authState.status, readLetterboxdImportIdentity, syncLetterboxdImportState]);

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

  const handleSaveSettingsPrivacy = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setSettingsSaveState({
        status: 'error',
        message: 'Gizlilik ayarlari icin once giris yap.',
      });
      return;
    }

    const normalizedDraft = normalizeMobileProfileVisibility(settingsPrivacyDraft);

    setSettingsSaveState({
      status: 'saving',
      message: 'Gizlilik ayarlari kaydediliyor...',
    });

    try {
      await AsyncStorage.setItem(
        MOBILE_PROFILE_PRIVACY_STORAGE_KEY,
        JSON.stringify(normalizedDraft)
      );
      const syncResult = await syncMobileProfilePrivacyToCloud(normalizedDraft);
      if (syncResult.ok) {
        setSettingsPrivacyDraft(syncResult.visibility);
        setSettingsSaveState({
          status: 'success',
          message: 'Gizlilik ayarlari kaydedildi. Cloud senkronu tamamlandi.',
        });
        void trackMobileEvent('page_view', {
          reason: 'mobile_profile_privacy_saved',
          cloudStatus: 'synced',
        });
      } else {
        setSettingsPrivacyDraft(normalizedDraft);
        setSettingsSaveState({
          status: 'success',
          message: `Gizlilik ayarlari yerelde kaydedildi. Cloud sync beklemede: ${syncResult.message}`,
        });
        void trackMobileEvent('page_view', {
          reason: 'mobile_profile_privacy_saved',
          cloudStatus: 'pending',
          message: syncResult.message,
        });
      }
      void refreshProfileStats();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gizlilik ayarlari kaydedilemedi.';
      setSettingsSaveState({
        status: 'error',
        message,
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_profile_privacy_save_failed',
        message,
      });
    }
  }, [authState.status, refreshProfileStats, settingsPrivacyDraft]);

  const handleSaveSettingsPassword = useCallback(
    async (password: string, confirmPassword: string) => {
      if (authState.status !== 'signed_in') {
        return {
          ok: false,
          message: 'Sifre degistirmek icin once giris yap.',
        };
      }

      if (!supabase) {
        return {
          ok: false,
          message: 'Supabase hazir degil.',
        };
      }

      const normalizedPassword = password.trim();
      const normalizedConfirmPassword = confirmPassword.trim();

      if (normalizedPassword.length < 6) {
        return {
          ok: false,
          message: 'Sifre en az 6 karakter olmali.',
        };
      }

      if (normalizedPassword !== normalizedConfirmPassword) {
        return {
          ok: false,
          message: 'Sifre tekrar alanlari ayni olmali.',
        };
      }

      try {
        const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
        if (error) {
          void trackMobileEvent('auth_failure', {
            method: 'settings_password_change',
            reason: error.message || 'password_update_failed',
          });
          return {
            ok: false,
            message: error.message || 'Sifre guncellenemedi.',
          };
        }

        void trackMobileEvent('password_reset_completed', {
          method: 'settings',
        });
        return {
          ok: true,
          message: 'Sifren guncellendi. Yeni sifren artik aktif.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sifre guncellenemedi.';
        void trackMobileEvent('auth_failure', {
          method: 'settings_password_change',
          reason: message,
        });
        return {
          ok: false,
          message,
        };
      }
    },
    [authState.status]
  );

  const handleSendVerificationEmail = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setEmailVerificationState({
        status: 'error',
        message: isTurkishUi ? 'Supabase ayarlari eksik.' : 'Supabase settings are missing.',
      });
      return;
    }

    if (authState.status !== 'signed_in') {
      setEmailVerificationState({
        status: 'error',
        message: isTurkishUi ? 'Bu islem icin once giris yap.' : 'Sign in first for this action.',
      });
      return;
    }

    if (authState.emailVerified) {
      setEmailVerificationState({
        status: 'success',
        message: isTurkishUi
          ? 'Bu e-posta zaten dogrulanmis gorunuyor.'
          : 'This email already appears to be verified.',
      });
      return;
    }

    const email = String(authState.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.endsWith('@private.local') || email.endsWith('@local.user')) {
      setEmailVerificationState({
        status: 'error',
        message: isTurkishUi
          ? 'Dogrulama icin gecerli bir e-posta bulunamadi.'
          : 'No valid email was found for verification.',
      });
      return;
    }

    setEmailVerificationState({
      status: 'saving',
      message: '',
    });

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: MOBILE_AUTH_CALLBACK_URL,
        },
      });

      if (error) {
        setEmailVerificationState({
          status: 'error',
          message:
            error.message ||
            (isTurkishUi ? 'Dogrulama maili gonderilemedi.' : 'Verification email could not be sent.'),
        });
        void trackMobileEvent('auth_failure', {
          method: 'email_verification_resend',
          reason: error.message || 'email_verification_resend_failed',
        });
        return;
      }

      setEmailVerificationState({
        status: 'success',
        message: isTurkishUi
          ? 'Dogrulama maili gonderildi. Gelen kutunu kontrol et.'
          : 'Verification email sent. Check your inbox.',
      });
      void trackMobileEvent('email_verification_requested', {
        method: 'email',
        redirectTo: MOBILE_AUTH_CALLBACK_URL,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isTurkishUi
            ? 'Dogrulama maili gonderilemedi.'
            : 'Verification email could not be sent.';
      setEmailVerificationState({
        status: 'error',
        message,
      });
      void trackMobileEvent('auth_failure', {
        method: 'email_verification_resend',
        reason: message,
      });
    }
  }, [authState, isTurkishUi]);

  const handleSelectPresetAvatar = useCallback((avatarUrl: string) => {
    const normalized = normalizeMobileAvatarUrl(avatarUrl);
    setSettingsIdentityDraft((prev) => ({ ...prev, avatarUrl: normalized }));
  }, []);

  const handleCopyInviteLink = useCallback(async () => {
    const inviteLink = String(inviteProgram.inviteLink || '').trim();
    if (!inviteLink) {
      setInviteStatus(
        isTurkishUi
          ? 'Kopyalanacak davet linki bulunamadi.'
          : 'No invite link is available to copy.'
      );
      return;
    }

    try {
      const copied = await writeClipboardString(inviteLink);
      if (!copied) throw new Error('clipboard_unavailable');
      setInviteStatus(
        isTurkishUi ? 'Davet linki panoya kopyalandi.' : 'Invite link copied to clipboard.'
      );
    } catch {
      setInviteStatus(
        isTurkishUi
          ? 'Davet linki kopyalanamadi. Tekrar dene.'
          : 'Invite link could not be copied. Try again.'
      );
    }
  }, [inviteProgram.inviteLink, isTurkishUi]);

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
      followMessage: isTurkishUi ? 'Takip durumu guncelleniyor...' : 'Updating follow status...',
    }));

    const result = await toggleMobileFollowState(targetUserId);
    if (!result.ok) {
      setPublicProfileModalState((prev) => ({
        ...prev,
        followStatus: 'error',
        followMessage: formatFollowMessage(result),
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
        followMessage: formatFollowMessage(result),
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
    if (result.isFollowing) {
      void sendEngagementPushNotification({
        kind: 'follow',
        targetUserId,
        actorLabel: resolveNotificationActorLabel(),
      }).then((pushResult) => {
        void trackMobileEvent('page_view', {
          reason: pushResult.ok
            ? 'mobile_follow_push_sent'
            : 'mobile_follow_push_failed',
          targetUserId,
        });
      });
    }
  }, [
    formatFollowMessage,
    isTurkishUi,
    publicProfileModalState.profile?.userId,
    publicProfileTarget,
    refreshProfileStats,
    resolveNotificationActorLabel,
  ]);

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
      followMessage: formatFollowMessage(followResult),
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
    formatFollowMessage,
    loadPublicProfileFull,
    publicProfileModalState.displayNameHint,
    publicProfileModalState.profile?.displayName,
    publicProfileModalState.profile?.userId,
    publicProfileTarget,
  ]);

  const handleClosePublicProfileFull = useCallback(() => {
    const returnTabRoute = publicProfileReturnTabRef.current;
    const source = publicProfileTarget?.source || publicProfileModalState.source;

    setPublicProfileFullState((prev) => ({
      ...prev,
      visible: false,
    }));
    setPublicProfileMovieArchiveModalState((prev) => ({
      ...prev,
      visible: false,
    }));
    setPublicProfileTarget(null);
    publicProfileReturnTabRef.current = null;

    if (source === 'deeplink') {
      clearIncomingIntent();
    }

    if (returnTabRoute && tabNavigationRef.isReady()) {
      const currentRouteName = tabNavigationRef.getCurrentRoute()?.name;
      if (currentRouteName !== returnTabRoute) {
        tabNavigationRef.navigate(returnTabRoute);
      }
    }
  }, [clearIncomingIntent, publicProfileModalState.source, publicProfileTarget]);

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

  const resetLocalAccountStateAfterDeletion = useCallback(async (message: string) => {
    await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await clearPushInbox().catch(() => undefined);
    await AsyncStorage.multiRemove([
      MOBILE_PROFILE_IDENTITY_STORAGE_KEY,
      MOBILE_PROFILE_PRIVACY_STORAGE_KEY,
      MOBILE_AUTH_REMEMBER_ME_STORAGE_KEY,
    ]).catch(() => undefined);

    setAuthState({
      status: 'signed_out',
      message,
    });
    setAuthModalVisible(false);
    setSettingsVisible(false);
    setAuthEmail('');
    setAuthFullName('');
    setAuthUsername('');
    setAuthBirthDate('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthFlowMode('login');
    setAuthEntryStage('intro');
    setSettingsIdentityDraft(DEFAULT_SETTINGS_IDENTITY);
    setSettingsPrivacyDraft(DEFAULT_SETTINGS_PRIVACY);
    setSettingsSaveState({
      status: 'idle',
      message: '',
    });
    setInviteCodeDraft('');
    setInviteStatus('');
    setInviteProgram({
      code: '',
      inviteLink: '',
      claimCount: 0,
    });
    setInviteClaimState({ status: 'idle' });
    setProfileState({
      status: 'idle',
      message: isTurkishUi ? 'Profil metrikleri hazir degil.' : 'Profile metrics are not ready.',
    });
    setProfileActivityState({
      status: 'idle',
      message: isTurkishUi ? 'Profil aktivitesi hazir degil.' : 'Profile activity is not ready.',
      items: [],
    });
    setPushInboxState({
      status: 'idle',
      message: isTurkishUi ? 'Bildirim kutusu yuklenmedi.' : 'Notification inbox has not loaded yet.',
      items: [],
    });
    setPushState({
      status: PUSH_FEATURE_ENABLED ? 'idle' : 'unsupported',
      message: PUSH_FEATURE_ENABLED
        ? isTurkishUi
          ? 'Push kaydi bekleniyor.'
          : 'Waiting for push registration.'
        : isTurkishUi
          ? 'Push modulu gecici olarak devre disi.'
          : 'Push module is temporarily disabled.',
      permissionStatus: 'unknown',
      token: '',
      projectId: null,
      lastNotification: 'none',
      cloudStatus: 'idle',
      cloudMessage: isTurkishUi
        ? 'Push cloud sync icin token bekleniyor.'
        : 'Waiting for a token before push cloud sync.',
      deviceKey: '',
      lastSyncedToken: '',
    });
  }, [isTurkishUi]);

  const handleOpenAccountDeletionInfo = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(MOBILE_ACCOUNT_DELETION_URL);
      if (!canOpen) return;
      await Linking.openURL(MOBILE_ACCOUNT_DELETION_URL);
      void trackMobileEvent('page_view', {
        reason: 'mobile_account_deletion_info_open',
      });
    } catch {
      // ignore link open failures in account deletion action
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (authState.status !== 'signed_in') {
      setAccountDeletionState({
        status: 'error',
        message: isTurkishUi
          ? 'Hesap silmek icin once giris yapman gerekiyor.'
          : 'You need to sign in before deleting the account.',
      });
      return;
    }

    setAccountDeletionState({
      status: 'saving',
      message: isTurkishUi ? 'Hesap siliniyor...' : 'Deleting account...',
    });

    void trackMobileEvent('page_view', {
      reason: 'mobile_account_deletion_requested',
    });

    const result = await deleteMobileAccount();
    if (!result.ok) {
      const message = isTurkishUi
        ? 'Hesap silme istegi basarisiz oldu.'
        : 'Account deletion request failed.';
      setAccountDeletionState({
        status: 'error',
        message,
      });
      void trackMobileEvent('page_view', {
        reason: 'mobile_account_deletion_failed',
        message,
      });
      return;
    }

    const message = isTurkishUi
      ? 'Hesabin kalici olarak silindi.'
      : 'Your account was permanently deleted.';
    setAccountDeletionState({
      status: 'success',
      message,
    });
    void trackMobileEvent('page_view', {
      reason: 'mobile_account_deleted',
    });
    await resetLocalAccountStateAfterDeletion(message);
  }, [authState.status, isTurkishUi, resetLocalAccountStateAfterDeletion]);

  const handlePullRefreshProfile = useCallback(async () => {
    if (profilePullRefreshing) return;
    setProfilePullRefreshing(true);
    try {
      if (publicProfileFullState.visible) {
        await handleRefreshPublicProfileFull();
      } else {
        await Promise.all([
          refreshProfileStats(),
          refreshProfileActivity(),
          syncLetterboxdImportState(),
        ]);
      }
    } finally {
      setProfilePullRefreshing(false);
    }
  }, [
    handleRefreshPublicProfileFull,
    profilePullRefreshing,
    publicProfileFullState.visible,
    refreshProfileStats,
    refreshProfileActivity,
    syncLetterboxdImportState,
  ]);

  const handleClaimInvite = useCallback(async (rawInviteCode: string) => {
    if (authState.status !== 'signed_in') {
      openAuthModal('login');
      return;
    }

    const inviteCodeText = String(rawInviteCode || '').trim().toUpperCase();
    if (!inviteCodeText) {
      setInviteClaimState({
        status: 'error',
        inviteCode: '',
        errorCode: 'INVALID_CODE',
        message: resolveInviteMessage('INVALID_CODE'),
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
        const giftValue = Math.max(0, Number(result.data.value || 0));
        const successMessage = result.data.giftType === 'premium'
          ? isTurkishUi
            ? `Premium hediye kodu uygulandi. +${giftValue} gun.`
            : `Premium gift code applied. +${giftValue} days.`
          : isTurkishUi
            ? `Bilet hediye kodu uygulandi. +${giftValue} bilet.`
            : `Ticket gift code applied. +${giftValue} tickets.`;
        const inviteeRewardXp = 0;
        const inviterRewardXp = 0;

        setInviteClaimState({
          status: 'success',
          inviteCode: inviteCodeText,
          message: successMessage,
          inviteeRewardXp,
          inviterRewardXp,
          claimCount: 0,
        });
        void persistClaimedInviteCode(inviteCodeText);

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
      const message = resolveInviteMessage(errorCode, result.message);

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
        message: `${resolveInviteMessage('SERVER_ERROR')} (${errorMessage})`,
      });
      void trackMobileEvent('invite_claim_failed', {
        reason: 'client_exception',
        inviteCode: inviteCodeText,
        errorCode: 'SERVER_ERROR',
        apiMessage: errorMessage,
      });
    }
  }, [authState.status, isTurkishUi, openAuthModal, resolveInviteMessage]);

  const handleApplyInviteCodeFromSettings = useCallback(async () => {
    const inviteCodeText = String(inviteCodeDraft || '').trim().toUpperCase();
    if (!inviteCodeText) {
      setInviteStatus(isTurkishUi ? 'Hediye kodu gir.' : 'Enter a gift code.');
      return;
    }

    setIsInviteActionBusy(true);
    setInviteStatus(isTurkishUi ? 'Kod uygulaniyor...' : 'Applying gift code...');

    try {
      const result = await claimInviteCodeViaApi(inviteCodeText);
      if (result.ok && result.data) {
        const giftValue = Math.max(0, Number(result.data.value || 0));
        const inviteeRewardXp = 0;
        const inviterRewardXp = 0;
        const claimCount = 0;
        const successMessage = result.data.giftType === 'premium'
          ? isTurkishUi
            ? `Premium hediye kodu uygulandi. +${giftValue} gun.`
            : `Premium gift code applied. +${giftValue} days.`
          : isTurkishUi
            ? `Bilet hediye kodu uygulandi. +${giftValue} bilet.`
            : `Ticket gift code applied. +${giftValue} tickets.`;
        setInviteClaimState({
          status: 'success',
          inviteCode: inviteCodeText,
          message: successMessage,
          inviteeRewardXp,
          inviterRewardXp,
          claimCount,
        });
        void persistClaimedInviteCode(inviteCodeText);
        setInviteStatus(successMessage);
        setInviteCodeDraft('');
        void refreshProfileStats();
      } else {
        const message = resolveInviteMessage(result.errorCode, result.message);
        setInviteClaimState({
          status: 'error',
          inviteCode: inviteCodeText,
          errorCode: result.errorCode || 'SERVER_ERROR',
          message,
        });
        setInviteStatus(message);
      }
    } catch {
      const message = resolveInviteMessage('SERVER_ERROR');
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
  }, [inviteCodeDraft, isTurkishUi, refreshProfileStats, resolveInviteMessage]);

  const refreshInviteProgram = useCallback(async () => {
    setInviteProgram({
      code: '',
      inviteLink: '',
      claimCount: 0,
    });
  }, []);

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
          ? isTurkishUi
            ? 'Seri paylasimi hazir. Platform secip devam et.'
            : 'Streak share is ready. Pick a platform to continue.'
          : isTurkishUi
            ? 'Yorum paylasimi hazir. Platform secip devam et.'
            : 'Comment share is ready. Pick a platform to continue.',
    });
  }, [isShareRouteActive, isTurkishUi, shareGoal]);

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


   
  const _handleShareHubShare = useCallback(
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
            ? isTurkishUi
              ? 'Paylasim icin bugun bir yorumun olmali.'
              : 'You need a comment from today to share it.'
            : isTurkishUi
              ? 'Seri paylasimi icin bugunku yorum ve aktif seri gerekiyor.'
              : "You need today's comment and an active streak to share your streak.";
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
              `${profileDisplayName} (@${shareHandle || localizedUiCopy.observerHandle})`,
              `${isTurkishUi ? 'Bugunku seri tamamlandi' : "Today's streak completed"}: ${profileStats.streak} ${isTurkishUi ? 'gun' : 'days'}`,
              `${shareLeagueLabel} - ${Math.floor(shareTotalXp)} XP`,
              `${platformTag} #180AbsoluteCinema`,
            ].join('\n')
          : [
              '180 Absolute Cinema',
              `${profileDisplayName} (@${shareHandle || localizedUiCopy.observerHandle})`,
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
          message: isTurkishUi
            ? 'Paylasim linki hazirlanamadi.'
            : 'Share link could not be prepared.',
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
        message: isTurkishUi ? 'Paylasim paneli hazirlaniyor...' : 'Preparing the share sheet...',
      });

      if (platform !== 'x') {
        copiedToClipboard = await writeClipboardString(shareMessage);
      }

      try {
        const result = await Share.share({
          title:
            goal === 'streak'
              ? isTurkishUi
                ? 'Seri Paylasimi'
                : 'Streak Share'
              : isTurkishUi
                ? 'Yorum Paylasimi'
                : 'Comment Share',
          message: shareMessage,
          url: destinationUrl,
        });
        const dismissed = result.action === Share.dismissedAction;
        if (dismissed) {
          setShareHubState({
            status: 'idle',
            message: copiedToClipboard
              ? isTurkishUi
                ? 'Paylasim iptal edildi. Metin panoda hazir.'
                : 'Share canceled. The text is ready in the clipboard.'
              : isTurkishUi
                ? 'Paylasim iptal edildi.'
                : 'Share canceled.',
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
            ? isTurkishUi
              ? 'Paylasim paneli acildi. Metin panoya da kopyalandi.'
              : 'Share sheet opened. The text was also copied to the clipboard.'
            : isTurkishUi
              ? 'Paylasim paneli acildi.'
              : 'Share sheet opened.',
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
              ? isTurkishUi
                ? `Paylasim paneli acildi. Metin panoya kopyalandi. +${MOBILE_SHARE_REWARD_XP} XP eklendi.`
                : `Share sheet opened. The text was copied to the clipboard. +${MOBILE_SHARE_REWARD_XP} XP added.`
              : isTurkishUi
                ? `Paylasim paneli acildi. +${MOBILE_SHARE_REWARD_XP} XP eklendi.`
                : `Share sheet opened. +${MOBILE_SHARE_REWARD_XP} XP added.`,
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
                ? isTurkishUi
                  ? 'Paylasim paneli acildi. Metin panoda hazir. Bugunki bonus zaten alinmis.'
                  : "Share sheet opened. The text is ready in the clipboard. Today's bonus was already claimed."
                : isTurkishUi
                  ? 'Paylasim paneli acildi. Bugunki bonus zaten alinmis.'
                  : "Share sheet opened. Today's bonus was already claimed."
              : copiedToClipboard
                ? isTurkishUi
                  ? 'Paylasim acildi ama XP bonusu kaydedilemedi. Metin panoda hazir.'
                  : 'Share opened, but the XP bonus could not be saved. The text is ready in the clipboard.'
                : isTurkishUi
                  ? 'Paylasim acildi ama XP bonusu kaydedilemedi.'
                  : 'Share opened, but the XP bonus could not be saved.',
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
            ? isTurkishUi
              ? 'Paylasim acilamadi. Metin panoda hazir.'
              : 'Share could not be opened. The text is ready in the clipboard.'
            : isTurkishUi
              ? 'Paylasim acilamadi. Tekrar dene.'
              : 'Share could not be opened. Try again.',
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
      isTurkishUi,
      latestOwnComment,
      localizedUiCopy.observerHandle,
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.heroEyebrow}>Absolute Cinema</Text>
          <Text style={styles.title}>180 Absolute Cinema</Text>
        </View>
        <Pressable
          onPress={() => setSearchVisible(true)}
          hitSlop={10}
          accessibilityLabel="Ara"
          style={{ padding: 6 }}
        >
          <Ionicons name="search" size={22} color="rgba(163,177,138,0.6)" />
        </Pressable>
      </View>
      {dailyHeroGreeting ? (
        <View style={styles.heroPulseWrap}>
          <View style={styles.heroPulseBodyRow}>
            <View
              style={[
                styles.heroPulseIconWrap,
                {
                  backgroundColor: `${dailyHeroGreetingAccent}16`,
                  borderColor: `${dailyHeroGreetingAccent}30`,
                },
              ]}
            >
              <Ionicons name={dailyHeroGreeting.icon} size={18} color={dailyHeroGreetingAccent} />
            </View>
            <View style={styles.heroPulseCopy}>
              <Text style={styles.heroPulseTitle} numberOfLines={2}>
                {dailyHeroGreeting.title}
              </Text>
              <Text style={styles.heroPulseBody} numberOfLines={2}>
                {dailyHeroGreeting.body}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {isDevSurfaceEnabled ? (
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroBadge}>Screen: {screenPlan.screen}</Text>
          <Text style={styles.heroBadge}>Tab: {tabLabel}</Text>
          <Text style={styles.heroBadgeNeutral}>{MOBILE_UI_PACKAGE_LABEL}</Text>
        </View>
      ) : null}
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
          <StatusBar style="light" />
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
          language={settingsLanguage}
          onClose={() => setLeaguePromotionEvent(null)}
        />
        <StreakCelebrationModal
          event={streakCelebrationEvent}
          language={settingsLanguage}
          onClose={() => setStreakCelebrationEvent(null)}
        />
        <TierAdvancementModal
          event={tierAdvancementEvent}
          language={settingsLanguage}
          onClose={() => setTierAdvancementEvent(null)}
        />
        <MarkUnlockModal
          event={activeMarkUnlockEvent}
          language={settingsLanguage}
          onClose={() => setMarkUnlockQueue((prev) => prev.slice(1))}
        />
        <XpGainToast xpDelta={xpGainDelta} onDone={() => setXpGainDelta(null)} />
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
              tabBar={renderTabBar}
              screenOptions={({ route }) => ({
                headerShown: false,
                sceneStyle: [styles.navScene, isDawnTheme ? styles.navSceneDawn : null],
                tabBarStyle: [styles.navTabBar, isDawnTheme ? styles.navTabBarDawn : null],
                tabBarItemStyle: styles.navTabItem,
                tabBarShowLabel: true,
                tabBarLabel: tabLabels[MAIN_KEY_BY_TAB[route.name]],
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
                  <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    enabled={Platform.OS !== 'web'}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
                  >
                    <ScrollView
                      contentContainerStyle={[styles.container, styles.containerWithTabs]}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                      automaticallyAdjustKeyboardInsets
                      refreshControl={
                        <RefreshControl
                          refreshing={dailyPullRefreshing}
                          onRefresh={() => {
                            void handlePullRefreshDaily();
                          }}
                          tintColor={isDawnTheme ? '#A57164' : '#8A9A5B'}
                        />
                      }
                      showsVerticalScrollIndicator={false}
                    >
                      {renderHeroCard(tabLabels.daily)}
                      <View style={{ height: 12 }} />

                      <DailyHomeScreen
                        state={dailyState}
                        showOpsMeta={isDevSurfaceEnabled}
                        showGreetingCard={false}
                        language={settingsLanguage}
                        selectedMovieId={selectedDailyMovieId}
                        streak={profileState.status === 'success' ? profileState.streak : null}
                        username={profileDisplayName || null}
                        onSelectMovie={(movieId) => {
                          setSelectedDailyMovieId(movieId);
                          setDailyMovieDetailsVisible(true);
                        }}
                      />
                      <View style={styles.sectionAnchor}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={styles.sectionHeader}>{mobileDailySectionCopy.commentsTitle}</Text>
                          <Text style={styles.sectionHeaderMeta}>
                            {dailyCommentFeedScope === 'today'
                              ? mobileDailySectionCopy.commentsMetaToday
                              : mobileDailySectionCopy.commentsMetaAll}
                          </Text>
                        </View>
                        <View style={styles.commentFeedFilterStack}>
                          <View style={styles.commentFeedControlRow}>
                            <Pressable
                              style={[
                                styles.commentFeedSegmentOption,
                                dailyCommentFeedScope === 'today' && styles.commentFeedSegmentActive,
                              ]}
                              onPress={() => handleDailyCommentFeedScopeChange('today')}
                              accessibilityLabel={mobileDailySectionCopy.commentsTodayLabel}
                            >
                              <Text
                                style={[
                                  styles.commentFeedSegmentText,
                                  dailyCommentFeedScope === 'today' && styles.commentFeedSegmentTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {mobileDailySectionCopy.commentsTodayLabel}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.commentFeedSegmentOption,
                                dailyCommentFeedScope === 'all' && styles.commentFeedSegmentActive,
                              ]}
                              onPress={() => handleDailyCommentFeedScopeChange('all')}
                              accessibilityLabel={mobileDailySectionCopy.commentsAllLabel}
                            >
                              <Text
                                style={[
                                  styles.commentFeedSegmentText,
                                  dailyCommentFeedScope === 'all' && styles.commentFeedSegmentTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {mobileDailySectionCopy.commentsAllLabel}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                      <CommentFeedCard
                        state={dailyCommentFeedState}
                        language={settingsLanguage}
                        currentUserAvatarUrl={profileAvatarUrl}
                        showFilters={false}
                        onScopeChange={handleDailyCommentFeedScopeChange}
                        onSortChange={() => undefined}
                        onQueryChange={() => undefined}
                        onEcho={handleEchoComment}
                        onLoadReplies={handleLoadCommentReplies}
                        onSubmitReply={handleSubmitCommentReply}
                        onEchoReply={handleEchoReply}
                        onDeleteItem={handleDeleteComment}
                        onOpenAuthorProfile={handleOpenCommentAuthorProfile}
                      />
                      {/* Discovery routes removed — replaced by Quiz tab */}
                    </ScrollView>
                  </KeyboardAvoidingView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.quiz}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                  >
                    <QuizHomeScreen
                      language={settingsLanguage}
                      isDawn={isDawnTheme}
                      isSignedIn={isSignedIn}
                      isPremium={subscription.isPremium}
                      walletBalance={wallet.snapshot.balance}
                      walletInventory={wallet.snapshot.inventory}
                      walletReadyTaskRewardTickets={walletReadyTaskRewardTickets}
                      walletOverlayVisible={walletVisible}
                      onOpenWallet={openWallet}
                      onRefreshWallet={wallet.refresh}
                      onRequireAuth={() => setAuthModalVisible(true)}
                      onRequirePaywall={() => setPaywallVisible(true)}
                      onNewMarks={(ids) => setMarkUnlockQueue((prev) => [...prev, ...ids])}
                    />
                  </ScrollView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.inbox}>
                {() => (
                  <ScrollView
                    contentContainerStyle={[styles.container, styles.containerWithTabs]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    refreshControl={
                      <RefreshControl
                        refreshing={inboxPullRefreshing}
                        onRefresh={() => {
                          void handlePullRefreshInbox();
                        }}
                        tintColor={isDawnTheme ? '#A57164' : '#8A9A5B'}
                      />
                    }
                    showsVerticalScrollIndicator={false}
                  >
                    <PushInboxCard
                      state={pushInboxState}
                      showOpsMeta={isDevSurfaceEnabled}
                      language={settingsLanguage}
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

              <Tab.Screen name={MAIN_TAB_BY_KEY.arena}>
                {() => (
                  <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    enabled={Platform.OS !== 'web'}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
                  >
                    <ScrollView
                      contentContainerStyle={[styles.container, styles.containerWithTabs]}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                      automaticallyAdjustKeyboardInsets
                      refreshControl={
                        <RefreshControl
                          refreshing={explorePullRefreshing}
                          onRefresh={() => {
                            void handlePullRefreshExplore();
                          }}
                          tintColor={isDawnTheme ? '#A57164' : '#8A9A5B'}
                        />
                      }
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.sectionAnchor}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={styles.sectionHeader}>Arena</Text>
                          <Text style={styles.sectionHeaderMeta}>{mobileArenaSectionCopy.meta}</Text>
                        </View>
                      </View>
                      <ArenaLeaderboardCard
                        state={arenaState}
                        language={settingsLanguage}
                        currentDisplayName={arenaIdentityLabel || null}
                        onOpenProfile={(item) => {
                          void handleOpenArenaProfile(item);
                        }}
                      />
                    </ScrollView>
                  </KeyboardAvoidingView>
                )}
              </Tab.Screen>

              <Tab.Screen name={MAIN_TAB_BY_KEY.profile}>
                {() =>
                  !isSignedIn && !publicProfileFullState.visible ? (
                    <ScreenErrorBoundary section="Profil">
                      <AuthGateScreen
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
                        onGoogleSignIn={handleGoogleSignIn}
                        onAppleSignIn={handleAppleSignIn}
                        onRequestPasswordReset={handleRequestPasswordReset}
                        onCompletePasswordReset={handleCompletePasswordReset}
                        entryStage={authEntryStage}
                        onContinue={() => setAuthEntryStage('form')}
                      />
                    </ScreenErrorBoundary>
                  ) : (
                    <ScreenErrorBoundary section="Profil">
                      <ScrollView
                        ref={profileScrollRef}
                        contentContainerStyle={[styles.container, styles.containerWithTabs]}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        refreshControl={
                          <RefreshControl
                            refreshing={profilePullRefreshing}
                            onRefresh={() => {
                              void handlePullRefreshProfile();
                            }}
                            tintColor={isDawnTheme ? '#A57164' : '#8A9A5B'}
                          />
                        }
                        showsVerticalScrollIndicator={false}
                      >
                    {isDevSurfaceEnabled
                      ? renderSurfaceIntro({
                          title: isTurkishUi ? 'Profil ve Hesap' : 'Profile and Account',
                          body: isTurkishUi
                            ? 'Seri, XP metrikleri ile hesap yonetimini tek noktadan yap.'
                            : 'Manage streak, XP metrics, and account controls from one place.',
                          badges: [
                            { label: isTurkishUi ? `Seri ${streakSummary}` : `Streak ${streakSummary}` },
                            { label: `Tema ${themeModeLabel}` },
                            {
                              label: isSignedIn ? (isTurkishUi ? 'Oturum hazir' : 'Session ready') : (isTurkishUi ? 'Oturum gerekli' : 'Sign-in required'),
                              muted: !isSignedIn,
                            },
                          ],
                        })
                      : null}
                    {publicProfileFullState.visible ? (
                      <>
                        {/* ── Public profile hero card (Concept C style) ── */}
                        {(() => {
                          const rawColor = publicProfileLeague?.leagueInfo.color ?? null;
                          const accentColor = rawColor && rawColor !== '#121212' && rawColor !== '#e5e4e2' ? rawColor : '#8a9a5b';
                          const borderColor = rawColor && rawColor !== '#121212' && rawColor !== '#e5e4e2' ? `${rawColor}CC` : 'rgba(255,255,255,0.12)';
                          const leagueName = publicProfileLeague?.leagueInfo.name ?? null;
                          const isFollowBusy = publicProfileModalState.followStatus === 'loading';
                          const publicMetricItems = [
                            ...(publicProfileVisibility.showStats
                              ? [
                                  {
                                    key: 'comments',
                                    label: isTurkishUi ? 'Yorum' : 'Comments',
                                    value: String(publicProfileStats.rituals),
                                    accent: '#8A9A5B',
                                  },
                                ]
                              : []),
                            ...(publicProfileVisibility.showFollowCounts
                              ? [
                                  {
                                    key: 'following',
                                    label: isTurkishUi ? 'Takip' : 'Following',
                                    value: String(publicProfileStats.following),
                                    accent: 'rgba(229,228,226,0.82)',
                                  },
                                  {
                                    key: 'followers',
                                    label: isTurkishUi ? 'Takipci' : 'Followers',
                                    value: String(publicProfileStats.followers),
                                    accent: '#C98B6B',
                                  },
                                ]
                              : []),
                          ];
                          return (
                            <View style={[styles.screenCard, { position: 'relative' }]}>
                              <View style={[styles.screenCardAccent, styles.screenCardAccentSage]} />
                              {/* Close button */}
                              <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
                                <Pressable
                                  onPress={handleClosePublicProfileFull}
                                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                  accessibilityRole="button"
                                  accessibilityLabel={isTurkishUi ? 'Kapat' : 'Close'}
                                  style={({ pressed }) => [
                                    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
                                    pressed && { opacity: 0.55, transform: [{ scale: 0.88 }] },
                                  ]}
                                >
                                  <Ionicons name="close" size={16} color="#E5E4E2" />
                                </Pressable>
                              </View>
                              {/* Hero row */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 }}>
                                <AvatarView
                                  avatarUrl={publicProfileAvatarUrl}
                                  displayName={publicProfileDisplayName}
                                  size={72}
                                  borderColor={borderColor}
                                />
                                <View style={{ flex: 1, gap: 4, paddingRight: 40 }}>
                                  <Text style={styles.sectionLeadTitle} numberOfLines={1}>{publicProfileDisplayName}</Text>
                                  {leagueName ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55`, borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                                      <Text style={{ color: accentColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>{'✦ '}{leagueName}</Text>
                                    </View>
                                  ) : null}
                                  {publicProfileModalState.followsYou && !publicProfileModalState.isSelfProfile ? (
                                    <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '600' }}>
                                      {isTurkishUi ? 'Seni takip ediyor' : 'Follows you'}
                                    </Text>
                                  ) : null}
                                </View>
                                {publicProfileVisibility.showStats && publicProfileStats.streak > 0 ? (
                                  <View style={{ backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.28)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', minWidth: 52 }}>
                                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#FF9500', lineHeight: 26 }}>{publicProfileStats.streak}</Text>
                                    <Text style={{ fontSize: 9, color: '#FF9500', fontWeight: '700', letterSpacing: 0.5 }}>{'🔥 '}{isTurkishUi ? 'SERİ' : 'STREAK'}</Text>
                                  </View>
                                ) : null}
                              </View>
                              {/* Stats row */}
                              {publicMetricItems.length > 0 ? (
                                <View style={styles.publicProfileMetricStrip}>
                                  {publicMetricItems.map((item, index) => (
                                    <View
                                      key={item.key}
                                      style={[
                                        styles.publicProfileMetricCell,
                                        index < publicMetricItems.length - 1 ? styles.publicProfileMetricCellBorder : null,
                                      ]}
                                    >
                                      <View style={[styles.publicProfileMetricAccent, { backgroundColor: item.accent }]} />
                                      <Text style={styles.publicProfileMetricLabel}>{item.label}</Text>
                                      <Text style={styles.publicProfileMetricValue}>{item.value}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                              {/* Actions */}
                              {!publicProfileModalState.isSelfProfile && isSignedIn ? (
                                <View style={{ marginTop: 14 }}>
                                  <UiButton
                                    label={isFollowBusy ? (isTurkishUi ? 'Isleniyor...' : 'Processing...') : publicProfileModalState.isFollowing ? (isTurkishUi ? 'Takipten Cik' : 'Unfollow') : (isTurkishUi ? 'Takip Et' : 'Follow')}
                                    tone={publicProfileModalState.isFollowing ? 'danger' : 'brand'}
                                    onPress={() => { void handleTogglePublicProfileFollow(); }}
                                    disabled={isFollowBusy}
                                  />
                                </View>
                              ) : null}
                              {publicProfileModalState.followStatus === 'error' && publicProfileModalState.followMessage ? (
                                <Text style={{ color: '#8e8b84', fontSize: 11, marginTop: 8, textAlign: 'center' }}>{publicProfileModalState.followMessage}</Text>
                              ) : null}
                            </View>
                          );
                        })()}

                        {publicProfileVisibility.showActivity ? (
                          <CollapsibleSectionCard
                            accent="sage"
                            title={isTurkishUi ? 'Film Arsivi' : 'Movie Archive'}
                            meta={`${publicWatchedMovies.length} ${isTurkishUi ? 'film' : 'movies'}`}
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
                                      void handleOpenPublicProfileMovieArchive(movie);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={isTurkishUi ? `${movie.movieTitle} film izi detayini ac` : `Open archive details for ${movie.movieTitle}`}
                                  >
                                    <Text style={styles.movieTitle}>{movie.movieTitle}</Text>
                                    <Text style={styles.movieMeta}>
                                      {movie.year ? `${movie.year} | ` : ''}
                                      {isTurkishUi ? 'Son izleme' : 'Last watched'}: {movie.watchedDayKey || '-'}
                                      {movie.watchCount > 1 ? ` | ${isTurkishUi ? 'Tekrar' : 'Rewatch'}: ${movie.watchCount}` : ''}
                                    </Text>
                                    <Text style={styles.movieRowActionHint}>{isTurkishUi ? 'Film Izi' : 'Archive'}</Text>
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
                                eyebrow={isTurkishUi ? 'Film Arsivi' : 'Movie Archive'}
                                title={
                                  publicProfileFullState.status === 'loading'
                                    ? (isTurkishUi ? 'Film izi taraniyor' : 'Scanning movie archive')
                                    : publicProfileFullState.status === 'error'
                                      ? (isTurkishUi ? 'Film arsivi okunamadi' : 'Movie archive could not be loaded')
                                      : (isTurkishUi ? 'Bu profilde henuz film izi yok' : 'No movie archive entries on this profile yet')
                                }
                                body={
                                  publicProfileFullState.status === 'error'
                                    ? publicProfileFullState.message ||
                                      isTurkishUi ? 'Film arsivi okunurken gecici bir sorun olustu.' : 'A temporary issue occurred while loading the movie archive.'
                                    : (isTurkishUi ? 'Izlenen filmler burada listelenir.' : 'Watched movies appear here.')
                                }
                                meta={isTurkishUi ? 'Yorumlar bu profilde gosterilmez.' : 'Comments are not shown on this profile.'}
                              />
                            )}
                          </CollapsibleSectionCard>
                        ) : (
                          <StatePanel
                            tone="sage"
                            variant="empty"
                            eyebrow={isTurkishUi ? 'Aktivite' : 'Activity'}
                            title={isTurkishUi ? 'Bu kullanici aktivite alanini gizledi' : 'This user hid their activity section'}
                            body={isTurkishUi ? 'Film arsivi ve yorum akisi bu profilde gosterilmiyor.' : 'The movie archive and comment feed are hidden on this profile.'}
                            meta={isTurkishUi ? 'Takip iliskisi etkilenmez.' : 'The follow relationship is not affected.'}
                          />
                        )}

                        {publicProfileVisibility.showMarks ? (
                          <ProfileMarksCard
                            state={publicProfileMarksState}
                            isSignedIn={isSignedIn || Boolean(publicSnapshot)}
                            language={settingsLanguage}
                            mode="unlocked"
                          />
                        ) : (
                          <StatePanel
                            tone="sage"
                            variant="empty"
                            eyebrow={isTurkishUi ? 'Marklar' : 'Marks'}
                            title={isTurkishUi ? 'Bu kullanici mark koleksiyonunu gizledi' : 'This user hid the marks collection'}
                            body={isTurkishUi ? 'Rozetler ve acik marklar profil detayinda gosterilmiyor.' : 'Badges and visible marks are hidden in profile details.'}
                            meta={isTurkishUi ? 'Takip iliskisi devam eder; sadece mark alani kapali.' : 'The follow relationship continues; only the marks area is hidden.'}
                          />
                        )}

                        {publicProfileVisibility.showActivity ? (
                          <ProfileCinematicCard
                            state={publicProfileMarksState}
                            isSignedIn={isSignedIn || Boolean(publicSnapshot)}
                            showFilmFallback={false}
                            language={settingsLanguage}
                            activityState={{
                              status: publicProfileFullState.status,
                              message: publicProfileFullState.message,
                              items: publicProfileFullState.items.map((item) => ({
                                id: item.id,
                                movieId: item.movieId,
                                movieTitle: item.movieTitle,
                                text: item.text,
                                genre: (item as { genre?: string | null }).genre ?? null,
                                posterPath: item.posterPath,
                                year: item.year,
                                rawTimestamp: item.rawTimestamp,
                                timestampLabel: item.timestampLabel,
                                dayKey: item.dayKey,
                              })),
                            }}
                          />
                        ) : null}

                      </>
                    ) : null}
                    {!publicProfileFullState.visible ? (
                      <>
                        <ProfileUnifiedCard
                          state={profileState}
                          isSignedIn={isSignedIn}
                          isPremium={subscription.isPremium}
                          language={settingsLanguage}
                          displayName={profileShellTitle}
                          avatarUrl={profileAvatarUrl}
                          _username={profileUsername}
                          bio={profileShellBody}
                          birthDateLabel={profileBirthDateLabel}
                          genderLabel={profileGenderLabel}
                          profileLink={profileLink}
                          onOpenSettings={isSignedIn ? () => setSettingsVisible(true) : undefined}
                          onOpenProfileLink={() => {
                            void handleOpenProfileLink();
                          }}
                          onOpenShareHub={handleOpenShareHubFromProfile}
                          onOpenComments={handleOpenProfileCommentsSheet}
                          onOpenFollowing={() => {
                            void handleOpenProfileFollowSheet('following');
                          }}
                          onOpenFollowers={() => {
                            void handleOpenProfileFollowSheet('followers');
                          }}
                          onOpenMarks={handleOpenProfileMarksSheet}
                        />
                        <ProfileCinematicCard
                          state={profileState}
                          isSignedIn={isSignedIn}
                          language={settingsLanguage}
                          activityState={profileActivityState}
                        />

                        {/* Marks section — collapsed by default, toggle via Marks stat button */}
                        {isSignedIn ? (
                          <>
                            {screenPlan.screen === 'invite_claim' ? (
                              <InviteClaimScreen
                                inviteCode={inviteCode}
                                claimState={inviteClaimState}
                                onClaim={handleClaimInvite}
                                language={settingsLanguage}
                              />
                            ) : null}

                          </>
                        ) : null}
                    {isDevSurfaceEnabled ? (
                      <>
                        <View style={styles.card}>
                          <Text style={styles.cardTitle}>{isTurkishUi ? 'Surum Ozeti' : 'Release Snapshot'}</Text>
                          <Text style={styles.screenMeta}>{isTurkishUi ? 'Push izni' : 'Push permission'}: {pushState.permissionStatus}</Text>
                          <Text style={styles.screenMeta}>{isTurkishUi ? 'Push bulut' : 'Push cloud'}: {pushState.cloudStatus}</Text>
                          <Text style={styles.screenMeta}>{isTurkishUi ? 'Bekleyen kuyruk' : 'Pending queue'}: {pendingQueueCount}</Text>
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
                            label={debugExpanded ? (isTurkishUi ? 'Gelistirici Detaylarini Gizle' : 'Hide Developer Details') : (isTurkishUi ? 'Gelistirici Detaylarini Goster' : 'Show Developer Details')}
                            tone="neutral"
                            stretch
                            onPress={() => setDebugExpanded((prev) => !prev)}
                          />
                        </View>
                        {debugExpanded ? (
                          <>
                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>{isTurkishUi ? 'Aktif Ekran Plani' : 'Active Screen Plan'}</Text>
                              <Text style={styles.code}>{JSON.stringify(screenPlan, null, 2)}</Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>{isTurkishUi ? 'Uretilen Deep Link' : 'Generated Deep Link'}</Text>
                              <Text selectable style={styles.code}>
                                {deepLink}
                              </Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>{isTurkishUi ? 'Son Gelen URL' : 'Last Incoming URL'}</Text>
                              <Text selectable style={styles.code}>
                                {lastIncomingUrl || (isTurkishUi ? '(henuz yok)' : '(none yet)')}
                              </Text>
                            </View>

                            <View style={styles.card}>
                              <Text style={styles.cardTitle}>{isTurkishUi ? 'Son Gelen Intent' : 'Last Incoming Intent'}</Text>
                              <Text style={styles.code}>
                                {lastIncomingIntent
                                  ? JSON.stringify(lastIncomingIntent, null, 2)
                                  : isTurkishUi ? '(henuz yok)' : '(none yet)'}
                              </Text>
                            </View>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {isSignedIn ? (
                      <View style={[styles.singleActionRow, { marginTop: 12 }]}>
                        <UiButton
                          label={isTurkishUi ? 'Cikis Yap' : 'Sign Out'}
                          tone="danger"
                          stretch
                          onPress={() => {
                            void handleSignOut();
                          }}
                        />
                      </View>
                    ) : (
                      <View style={[styles.singleActionRow, { marginTop: 12 }]}>
                        <UiButton
                          label={isTurkishUi ? 'Giris Yap / Uye Ol' : 'Sign In / Register'}
                          tone="neutral"
                          stretch
                          onPress={() => {
                            openAuthModal('login');
                          }}
                        />
                      </View>
                    )}
                      </>
                    ) : null}
                      </ScrollView>
                    </ScreenErrorBoundary>
                  )
                }
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>

          <PaywallModal
            visible={paywallVisible}
            onClose={() => setPaywallVisible(false)}
            onPurchase={(plan) => void subscription.purchase(plan).then((ok) => { if (ok) setPaywallVisible(false); })}
            onRestore={() => void subscription.restore()}
            purchasing={subscription.purchasing}
            error={subscription.error}
            language={settingsLanguage as 'tr' | 'en' | 'es' | 'fr'}
          />

          <AuthModal
            visible={authModalVisible}
            onClose={closeAuthModal}
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
            showAppleSignIn
            onAppleSignIn={handleAppleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            onRequestPasswordReset={handleRequestPasswordReset}
            onCompletePasswordReset={handleCompletePasswordReset}
          />

          <MovieDetailsModal
            movie={
              dailyMovieDetailsVisible && selectedDailyMovie
                ? {
                    id: selectedDailyMovie.id,
                    title: selectedDailyMovie.title,
                    overview: selectedDailyMovie.overview,
                    voteAverage: selectedDailyMovie.voteAverage,
                    genre: selectedDailyMovie.genre,
                    year: selectedDailyMovie.year,
                    director: selectedDailyMovie.director,
                    cast: selectedDailyMovie.cast,
                    posterPath: selectedDailyMovie.posterPath,
                    originalLanguage: selectedDailyMovie.originalLanguage,
                    dateKey: dailyState.status === 'success' ? dailyState.date : null,
                  }
                : null
            }
            onClose={() => setDailyMovieDetailsVisible(false)}
            onOpenCommentComposer={() => {
              setDailyMovieDetailsVisible(false);
              setRitualComposerVisible(true);
            }}
            onRequireAuth={() => {
              setDailyMovieDetailsVisible(false);
              openAuthModal('login');
            }}
            onApplyQuizProgress={applyQuizProgressToProfile}
            language={settingsLanguage}
            isSignedIn={isSignedIn}
            commentFeedState={dailyCommentFeedState}
            currentUserAvatarUrl={profileAvatarUrl}
            onEchoComment={handleEchoComment}
            onLoadCommentReplies={handleLoadCommentReplies}
            onSubmitCommentReply={handleSubmitCommentReply}
            onEchoCommentReply={handleEchoReply}
            onDeleteComment={handleDeleteComment}
            onOpenCommentAuthorProfile={handleOpenCommentAuthorProfile}
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
            rating={ritualDraftRating}
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
            onRatingChange={(value) => {
              setRitualDraftRating(value);
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
            language={settingsLanguage}
            onSubmit={handleSubmitRitualDraft}
            onFlushQueue={handleFlushRitualQueue}
            onClose={() => setRitualComposerVisible(false)}
          />

          <MoviePageModal
            visible={moviePageVisible}
            movieId={moviePageId}
            movieTitle={moviePageTitle}
            onClose={() => setMoviePageVisible(false)}
            onWriteRitual={(id, title) => {
              setMoviePageVisible(false);
              setRitualComposerVisible(true);
            }}
          />

          <SearchModal
            visible={searchVisible}
            onClose={() => setSearchVisible(false)}
            onMovieSelect={(movieId, movieTitle) => {
              setSearchVisible(false);
              setMoviePageId(movieId);
              setMoviePageTitle(movieTitle);
              setMoviePageVisible(true);
            }}
            onUserSelect={(userId, username) => {
              setSearchVisible(false);
              console.log('Kullanici seçildi:', userId, username);
            }}
          />

          <ProfileCommentsModal
            visible={profileStatsSheetState.visible && profileStatsSheetState.section === 'comments'}
            activityState={profileActivityState}
            language={settingsLanguage}
            onClose={handleCloseProfileStatsSheet}
          />

          <ProfileFollowListModal
            visible={
              profileStatsSheetState.visible &&
              (profileStatsSheetState.section === 'following' || profileStatsSheetState.section === 'followers')
            }
            mode={profileStatsSheetState.section === 'followers' ? 'followers' : 'following'}
            state={profileFollowListState}
            language={settingsLanguage}
            onOpenProfile={(userId, displayName) => {
              void handleOpenProfileFollowUser(userId, displayName);
            }}
            onClose={handleCloseProfileStatsSheet}
          />

          <ProfileMarksModal
            visible={profileStatsSheetState.visible && profileStatsSheetState.section === 'marks'}
            state={profileState}
            isSignedIn={isSignedIn}
            language={settingsLanguage}
            onClose={handleCloseProfileStatsSheet}
          />

          <ProfileMovieArchiveModal
            visible={profileMovieArchiveModalState.visible}
            status={profileMovieArchiveModalState.status}
            message={profileMovieArchiveModalState.message}
            movie={profileMovieArchiveModalState.movie}
            entries={profileMovieArchiveModalState.entries}
            onDeleteEntry={handleDeleteProfileMovieArchiveEntry}
            onClose={handleCloseProfileMovieArchive}
          />

          <PublicProfileMovieArchiveModal
            visible={publicProfileMovieArchiveModalState.visible}
            language={settingsLanguage}
            status={publicProfileMovieArchiveModalState.status}
            message={publicProfileMovieArchiveModalState.message}
            displayName={publicProfileMovieArchiveModalState.displayName}
            movie={publicProfileMovieArchiveModalState.movie}
            items={publicProfileMovieArchiveModalState.items}
            onClose={handleClosePublicProfileMovieArchive}
          />

          <MobileSettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            language={settingsLanguage}
            themeMode={themeMode}
            identityDraft={settingsIdentityDraft}
            onChangeIdentity={handleChangeSettingsIdentity}
            onSaveIdentity={handleSaveSettingsIdentity}
            onChangeTheme={setThemeMode}
            onChangeLanguage={setSettingsLanguage}
            onSavePassword={handleSaveSettingsPassword}
            onSendVerificationEmail={() => {
              void handleSendVerificationEmail();
            }}
            privacyDraft={settingsPrivacyDraft}
            onChangePrivacy={handleChangeSettingsPrivacy}
            onSavePrivacy={handleSaveSettingsPrivacy}
            saveState={settingsSaveState}
            onSelectAvatar={handleSelectPresetAvatar}
            onBuyAvatar={(avatarId) => { void wallet.buyAvatar(avatarId); }}
            ownedAvatarIds={wallet.snapshot.ownedAvatarIds}
            avatarPurchaseCost={wallet.snapshot.avatarPurchaseCost}
            isPremium={subscription.isPremium}
            activeAccountLabel={activeAccountLabel}
            activeEmailLabel={activeEmailLabel}
            isEmailVerified={isEmailVerified}
            emailConfirmedAt={emailConfirmedAt}
            emailVerificationState={emailVerificationState}
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
            accountDeletionState={accountDeletionState}
            onDeleteAccount={() => {
              void handleDeleteAccount();
            }}
            onOpenAccountDeletionInfo={() => {
              void handleOpenAccountDeletionInfo();
            }}
            letterboxdSummary={letterboxdSummary}
            letterboxdStatus={letterboxdImportState.message}
            isImportingLetterboxd={letterboxdImportState.status === 'loading'}
            onImportLetterboxd={() => {
              void handleImportLetterboxd();
            }}
            onOpenShareHub={() => {
              setSettingsVisible(false);
              handleOpenShareHubFromProfile();
            }}
            onSignOut={() => {
              void handleSignOut();
            }}
          />

          <WalletModal
            visible={walletVisible}
            onClose={() => {
              setWalletVisible(false);
              setWalletFocusItem(null);
            }}
            language={settingsLanguage}
            isPremium={subscription.isPremium}
            balance={wallet.snapshot.balance}
            inventory={wallet.snapshot.inventory}
            rewardedAd={wallet.snapshot.rewardedAd}
            dailyTasks={wallet.snapshot.dailyTasks}
            productMap={wallet.productMap}
            actionBusy={wallet.actionBusy}
            topupPurchasing={wallet.topupPurchasing}
            message={wallet.message}
            error={wallet.error}
            focusedItemKey={walletFocusItem}
            onBuyStoreItem={(itemKey) => {
              setWalletFocusItem(itemKey);
              void wallet.buyStoreItem(itemKey);
            }}
            onClaimRewarded={() => {
              void wallet.claimRewardedReels();
            }}
            onClaimDailyTask={(taskKey) => {
              void wallet.claimDailyTask(taskKey);
            }}
            onPurchasePack={(packKey) => {
              void wallet.purchaseTopupPack(packKey);
            }}
          />

          <Modal
            visible={discoverRouteSurfaceState.visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleCloseDiscoverRouteSurface}
          >
            <SafeAreaView style={styles.discoverRouteSurfaceModal} edges={['top', 'bottom']}>
              <View style={styles.discoverRouteSurfaceHeader}>
                <View style={styles.discoverRouteSurfaceHeaderCopy}>
                  <Text style={styles.discoverRouteSurfaceEyebrow}>
                    {mobileDiscoverRouteSurfaceCopy.eyebrow}
                  </Text>
                  <Text style={styles.discoverRouteSurfaceTitle}>
                    {discoverRouteSurfaceState.title || mobileDiscoverRouteSurfaceCopy.fallbackTitle}
                  </Text>
                </View>
                <View style={styles.discoverRouteSurfaceActions}>
                  <UiButton
                    label={mobileDiscoverRouteSurfaceCopy.openInBrowser}
                    tone="neutral"
                    onPress={() => {
                      const targetUrl = String(discoverRouteSurfaceState.url || '').trim();
                      if (!targetUrl) return;
                      void Linking.openURL(targetUrl);
                    }}
                  />
                  <UiButton
                    label={mobileDiscoverRouteSurfaceCopy.close}
                    tone="brand"
                    onPress={handleCloseDiscoverRouteSurface}
                  />
                </View>
              </View>

              <View style={styles.discoverRouteSurfaceBody}>
                <WebView
                  source={{ uri: discoverRouteSurfaceState.url }}
                  sharedCookiesEnabled
                  setSupportMultipleWindows={false}
                  startInLoadingState
                  onLoadStart={() =>
                    setDiscoverRouteSurfaceState((prev) => ({
                      ...prev,
                      loading: true,
                      error: '',
                    }))
                  }
                  onLoadEnd={() =>
                    setDiscoverRouteSurfaceState((prev) => ({
                      ...prev,
                      loading: false,
                    }))
                  }
                  onError={(event) =>
                    setDiscoverRouteSurfaceState((prev) => ({
                      ...prev,
                      loading: false,
                      error:
                        String(event.nativeEvent.description || '').trim() ||
                        mobileDiscoverRouteSurfaceCopy.error,
                    }))
                  }
                  renderLoading={() => (
                    <View style={styles.discoverRouteSurfaceLoading}>
                      <ActivityIndicator size="small" color="#c7bcb2" />
                      <Text style={styles.discoverRouteSurfaceLoadingText}>
                        {mobileDiscoverRouteSurfaceCopy.loading}
                      </Text>
                    </View>
                  )}
                />

                {discoverRouteSurfaceState.error ? (
                  <View style={styles.discoverRouteSurfaceErrorCard}>
                    <Text style={styles.discoverRouteSurfaceErrorTitle}>
                      {mobileDiscoverRouteSurfaceCopy.errorTitle}
                    </Text>
                    <Text style={styles.discoverRouteSurfaceErrorBody}>
                      {discoverRouteSurfaceState.error}
                    </Text>
                  </View>
                ) : null}
              </View>
            </SafeAreaView>
          </Modal>
        </Animated.View>
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

















