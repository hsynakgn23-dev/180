import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
  Modal,
  Image,
  type TextProps,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import {
  MOBILE_MARK_CATALOG,
  groupMobileMarksByCategory,
  resolveMobileMarkMeta,
  resolveMobileMarkTitle,
} from '../lib/mobileMarksCatalog';
import { resolveMobileLeagueInfo, resolveMobileLeagueProgress } from '../lib/mobileLeagueSystem';
import { type PushInboxItem } from '../lib/mobilePushInbox';
import { isSupabaseConfigured } from '../lib/supabase';
import type { MobileThemeMode } from '../lib/mobileThemeMode';
import {
  readMobileDailyQuizBundle,
  submitMobileDailyQuizAnswer,
  type MobileDailyQuizBundle,
  type MobileDailyQuizLanguageCode,
  type MobileDailyQuizOptionKey,
} from '../lib/mobileDailyQuizApi';
import { getProgressHeadColor, getProgressTailColor } from '../../../../src/lib/progressVisuals';
import { LEAGUE_TRANSITION_COPY, resolveStreakCelebrationCopy, resolveStreakCelebrationTheme, resolveStreakSurfaceCopy } from '../../../../src/domain/celebrations';
import { MARK_MOTION_DURATION_MS } from '../../../../src/domain/markVisuals';
import {
  buildProfileActivityPulse,
  buildProfileDnaSegments,
  buildProfileFilmSummaries,
  buildProfileGenreDistribution,
  countProfileExactCommentSignals,
  countProfileHiddenGemSignals,
} from '../../../../src/domain/profileInsights';
import { UiButton } from './primitives';
import { MobileMarkIcon } from './mobileMarkIcons';
import { styles } from './appStyles';
import {
  type AuthState,
  type CommentFeedScope,
  type CommentFeedSort,
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
} from './appTypes';
import type { MobileCommentReply } from '../lib/mobileCommentInteractions';
import type { MobileWatchedMovie } from '../lib/mobileProfileWatchedMovies';
import type { MobileProfileMovieArchiveEntry } from '../lib/mobileProfileMovieArchive';
import type { MobileProfileActivityItem } from '../lib/mobileProfileActivity';
import type { MobilePublicProfileActivityItem } from '../lib/mobilePublicProfileActivity';
import type { MobileProfileVisibility } from '../lib/mobileProfileVisibility';

const PRESSABLE_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const SUPPORTS_NATIVE_DRIVER = Platform.OS !== 'web';
const KEYBOARD_AVOIDING_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const KEYBOARD_AVOIDING_OFFSET = Platform.OS === 'ios' ? 12 : 0;
const DAILY_MOVIE_CARD_STRIDE = 144;
const DAILY_MOVIE_RAIL_PRESS_GUARD_MS = 280;
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';
const STORAGE_OBJECT_PUBLIC_PATH = 'storage/v1/object/public/';
const DEFAULT_MOBILE_IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url=';
const MOBILE_SUPABASE_BASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const MOBILE_SUPABASE_STORAGE_BUCKET =
  String(process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || 'posters')
    .trim()
    .replace(/^\/+|\/+$/g, '') || 'posters';
let APP_SCREENS_THEME_MODE: MobileThemeMode = 'midnight';
const DAWN_TEXT_COLOR_STYLE = { color: '#A45E4A' } as const;

const blurActiveWebElement = (): void => {
  if (Platform.OS !== 'web') return;
  const activeElement = (
    globalThis as {
      document?: {
        activeElement?: {
          blur?: () => void;
        } | null;
      };
    }
  ).document?.activeElement;
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
};

const useWebModalFocusReset = (visible: boolean): void => {
  useEffect(() => {
    if (!visible) return;
    blurActiveWebElement();
  }, [visible]);
};

const buildAccentShadowStyle = (accentColor: string): Record<string, unknown> =>
  Platform.OS === 'web'
    ? {
        boxShadow: `0px 16px 28px ${accentColor}33`,
      }
    : {
        shadowColor: accentColor,
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      };

const buildAccentGlowStyle = (accentColor: string): Record<string, unknown> =>
  Platform.OS === 'web'
    ? {
        boxShadow: `0px 0px 24px ${accentColor}38`,
      }
    : {
        shadowColor: accentColor,
        shadowOpacity: 0.22,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
      };

const resolveMobileImageProxyBase = (): string => {
  const configured = String(process.env.EXPO_PUBLIC_IMAGE_PROXIES || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return configured[0] || DEFAULT_MOBILE_IMAGE_PROXY_BASE;
};

const maybeWrapWebPosterUrl = (absoluteUrl: string): string => {
  if (Platform.OS !== 'web') return absoluteUrl;
  if (!/^https?:\/\/image\.tmdb\.org\/t\/p\//i.test(absoluteUrl)) return absoluteUrl;

  const proxyBase = resolveMobileImageProxyBase();
  if (!proxyBase) return absoluteUrl;
  if (absoluteUrl.startsWith(proxyBase)) return absoluteUrl;
  if (proxyBase.includes('{url}')) {
    return proxyBase.replace('{url}', encodeURIComponent(absoluteUrl));
  }
  return `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.trim().replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(138,154,91,${alpha})`;
  }

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const Text = ({ style, ...props }: TextProps) => (
  <RNText
    {...props}
    style={[style, APP_SCREENS_THEME_MODE === 'dawn' ? DAWN_TEXT_COLOR_STYLE : null]}
  />
);

const setAppScreensThemeMode = (mode: MobileThemeMode) => {
  APP_SCREENS_THEME_MODE = mode === 'dawn' ? 'dawn' : 'midnight';
};

const resolveLocalizedLeagueDisplayName = (
  language: MobileSettingsLanguage,
  leagueKey: string | null | undefined,
  fallbackName: string | null | undefined
): string => {
  const normalizedFallbackName = String(fallbackName || '').trim();
  const normalizedLeagueKey = String(leagueKey || '').trim();
  return language === 'tr' ? normalizedFallbackName || normalizedLeagueKey : normalizedLeagueKey || normalizedFallbackName;
};

type DailyMovieRailItem = Extract<DailyState, { status: 'success' }>['movies'][number];

export type MobileLeaguePromotionEvent = {
  leagueKey: string;
  leagueName: string;
  leagueColor: string;
  previousLeagueKey?: string | null;
};

export type MobileStreakCelebrationEvent = {
  day: number;
  isMilestone: boolean;
};

const LeaguePromotionModal = ({
  event,
  language = 'tr',
  onClose,
}: {
  event: MobileLeaguePromotionEvent | null;
  language?: MobileSettingsLanguage;
  onClose: () => void;
}) => {
  useWebModalFocusReset(Boolean(event));
  if (!event) return null;

  const accentColor = String(event.leagueColor || '#8A9A5B').trim() || '#8A9A5B';
  const copy = LEAGUE_TRANSITION_COPY[language] || LEAGUE_TRANSITION_COPY.tr;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.leagueTransitionOverlay}>
        <Pressable
          style={styles.leagueTransitionOverlayTap}
          onPress={onClose}
          accessibilityLabel="Lig atlama ekranini kapat"
        />

        <View
          style={[
            styles.leagueTransitionCard,
            {
              borderColor: `${accentColor}66`,
              ...buildAccentShadowStyle(accentColor),
            },
          ]}
        >
          <View style={[styles.leagueTransitionLine, { backgroundColor: accentColor }]} />
          <Text style={styles.leagueTransitionEyebrow}>{copy.badge}</Text>
          <Text style={[styles.leagueTransitionLeagueName, { color: accentColor }]}>
            {event.leagueName || event.leagueKey}
          </Text>
          <Text style={styles.leagueTransitionBody}>{copy.body}</Text>
          {event.previousLeagueKey ? (
            <Text style={styles.leagueTransitionMeta}>
              {event.previousLeagueKey}
              {' -> '}
              {event.leagueKey}
            </Text>
          ) : (
            <Text style={styles.leagueTransitionMeta}>{copy.meta}</Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.leagueTransitionButton, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
            onPress={onClose}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Lig atlama ekranini tamamla"
          >
            <Text style={styles.leagueTransitionButtonText}>{copy.action}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const StreakCelebrationModal = ({
  event,
  language = 'tr',
  onClose,
}: {
  event: MobileStreakCelebrationEvent | null;
  language?: MobileSettingsLanguage;
  onClose: () => void;
}) => {
  useWebModalFocusReset(Boolean(event));
  if (!event) return null;

  const theme = resolveStreakCelebrationTheme(event.day);
  const copy = resolveStreakCelebrationCopy(language, event.day);
  const surfaceCopy = resolveStreakSurfaceCopy(language);
  const accentColor = theme.accentHex;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.streakCelebrationOverlay,
          {
            backgroundColor: hexToRgba(theme.shellEnd, 0.94),
          },
        ]}
      >
        <Pressable
          style={styles.streakCelebrationOverlayTap}
          onPress={onClose}
          accessibilityLabel="Streak kutlamasini kapat"
        />

        <View
          style={[
            styles.streakCelebrationCard,
            {
              borderColor: hexToRgba(accentColor, 0.42),
              backgroundColor: hexToRgba(theme.cardStart, 0.94),
              ...buildAccentShadowStyle(accentColor),
            },
          ]}
        >
          <View
            style={[
              styles.streakCelebrationPulseRing,
              {
                borderColor: hexToRgba(accentColor, 0.28),
                ...buildAccentGlowStyle(accentColor),
              },
            ]}
          />
          <View
            style={[
              styles.streakCelebrationLine,
              { backgroundColor: hexToRgba(accentColor, 0.92) },
            ]}
          />
          <Text style={styles.streakCelebrationEyebrow}>{copy.badge}</Text>
          <Text style={styles.streakCelebrationTitle}>{copy.title}</Text>

          <View style={styles.streakCelebrationDayChip}>
            <Text style={styles.streakCelebrationDayLabel}>{surfaceCopy.dayLabel}</Text>
            <Text style={[styles.streakCelebrationDayValue, { color: accentColor }]}>
              {event.day}
            </Text>
          </View>

          <Text style={styles.streakCelebrationBody}>{copy.subtitle}</Text>
          <Text style={styles.streakCelebrationMeta}>{surfaceCopy.completed}</Text>

          <Pressable
            style={({ pressed }) => [styles.streakCelebrationButton, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
            onPress={onClose}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Streak kutlamasini tamamla"
          >
            <Text style={styles.streakCelebrationButtonText}>{surfaceCopy.action}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const isStoragePosterPath = (value: string): boolean => {
  const normalized = value.replace(/^\/+/, '');
  return (
    normalized.startsWith(STORAGE_OBJECT_PUBLIC_PATH) ||
    normalized.startsWith('object/public/') ||
    normalized.startsWith(`${MOBILE_SUPABASE_STORAGE_BUCKET}/`) ||
    /^\d+\/(w200|w342|w500|w780|original)\.(jpg|jpeg|png|webp)$/i.test(normalized)
  );
};

const resolveStoragePosterUrl = (value: string): string | null => {
  if (!MOBILE_SUPABASE_BASE_URL) return null;

  const normalized = value.replace(/^\/+/, '');
  if (normalized.startsWith(STORAGE_OBJECT_PUBLIC_PATH)) {
    return `${MOBILE_SUPABASE_BASE_URL}/${normalized}`;
  }
  if (normalized.startsWith('object/public/')) {
    return `${MOBILE_SUPABASE_BASE_URL}/storage/v1/${normalized}`;
  }
  if (normalized.startsWith(`${MOBILE_SUPABASE_STORAGE_BUCKET}/`)) {
    return `${MOBILE_SUPABASE_BASE_URL}/storage/v1/object/public/${normalized}`;
  }
  if (/^\d+\/(w200|w342|w500|w780|original)\.(jpg|jpeg|png|webp)$/i.test(normalized)) {
    return `${MOBILE_SUPABASE_BASE_URL}/storage/v1/object/public/${MOBILE_SUPABASE_STORAGE_BUCKET}/${normalized}`;
  }
  return null;
};

const resolvePosterUrl = (posterPath: string | null | undefined): string | null => {
  const normalized = String(posterPath || '').trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return maybeWrapWebPosterUrl(normalized);
  if (/^\/\//.test(normalized)) return maybeWrapWebPosterUrl(`https:${normalized}`);

  const storageResolved = resolveStoragePosterUrl(normalized);
  if (storageResolved) return storageResolved;

  if (
    normalized.startsWith(STORAGE_PUBLIC_PATH) ||
    normalized.startsWith(STORAGE_PUBLIC_PATH.slice(1)) ||
    isStoragePosterPath(normalized)
  ) {
    return null;
  }

  const normalizedPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return maybeWrapWebPosterUrl(`${TMDB_POSTER_BASE_URL}${normalizedPath}`);
};

const ScreenCard = ({
  children,
  accent = 'sage',
}: {
  children: ReactNode;
  accent?: 'sage' | 'clay';
}) => (
  <View style={styles.screenCard}>
    <View
      style={[
        styles.screenCardAccent,
        accent === 'clay' ? styles.screenCardAccentClay : styles.screenCardAccentSage,
      ]}
    />
    {children}
  </View>
);

const SectionLeadCard = ({
  accent = 'sage',
  eyebrow,
  title,
  body,
  badges,
  metrics,
  actions,
}: {
  accent?: 'sage' | 'clay';
  eyebrow: string;
  title: string;
  body: string;
  badges?: Array<{ label: string; tone?: 'sage' | 'clay' | 'muted' }>;
  metrics?: Array<{ label: string; value: string }>;
  actions?: Array<{
    label: string;
    tone?: 'neutral' | 'brand' | 'teal' | 'danger';
    onPress: () => void;
    disabled?: boolean;
  }>;
}) => (
  <ScreenCard accent={accent}>
    <Text style={styles.sectionLeadEyebrow}>{eyebrow}</Text>
    <Text style={styles.sectionLeadTitle}>{title}</Text>
    <Text style={styles.sectionLeadBody}>{body}</Text>

    {Array.isArray(badges) && badges.length > 0 ? (
      <View style={styles.sectionLeadBadgeRow}>
        {badges.map((badge, index) => (
          <View
            key={`${title}-badge-${index}`}
            style={[
              styles.sectionLeadBadge,
              badge.tone === 'clay'
                ? styles.sectionLeadBadgeClay
                : badge.tone === 'muted'
                  ? styles.sectionLeadBadgeMuted
                  : styles.sectionLeadBadgeSage,
            ]}
          >
            <Text style={styles.sectionLeadBadgeText}>{badge.label}</Text>
          </View>
        ))}
      </View>
    ) : null}

    {Array.isArray(metrics) && metrics.length > 0 ? (
      <View style={styles.sectionLeadMetricRow}>
        {metrics.map((metric, index) => (
          <View key={`${title}-metric-${index}`} style={styles.sectionLeadMetricCard}>
            <Text style={styles.sectionLeadMetricValue}>{metric.value}</Text>
            <Text style={styles.sectionLeadMetricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>
    ) : null}

    {Array.isArray(actions) && actions.length > 0 ? (
      <View style={styles.sectionLeadActionRow}>
        {actions.map((action, index) => (
          <UiButton
            key={`${title}-action-${index}`}
            label={action.label}
            tone={action.tone || 'neutral'}
            stretch
            onPress={action.onPress}
            disabled={action.disabled}
          />
        ))}
      </View>
    ) : null}
  </ScreenCard>
);

const StatePanel = ({
  tone = 'sage',
  variant,
  eyebrow,
  title,
  body,
  meta,
  actionLabel,
  onAction,
  actionTone = 'brand',
}: {
  tone?: 'sage' | 'clay';
  variant: 'loading' | 'empty' | 'error';
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTone?: 'neutral' | 'brand' | 'teal' | 'danger';
}) => {
  const [pulse] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    if (variant !== 'loading') {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: SUPPORTS_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: SUPPORTS_NATIVE_DRIVER,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, variant]);

  const toneStyle =
    tone === 'clay' ? styles.statePanelToneClay : styles.statePanelToneSage;

  return (
    <View style={[styles.statePanel, toneStyle]}>
      <Text style={styles.statePanelEyebrow}>{eyebrow}</Text>
      <Text style={styles.statePanelTitle}>{title}</Text>
      <Text style={styles.statePanelBody}>{body}</Text>
      {meta ? <Text style={styles.statePanelMeta}>{meta}</Text> : null}

      {variant === 'loading' ? (
        <View style={styles.statePanelSkeletonStack}>
          <Animated.View style={[styles.statePanelSkeletonWide, { opacity: pulse }]} />
          <Animated.View style={[styles.statePanelSkeletonMid, { opacity: pulse }]} />
          <Animated.View style={[styles.statePanelSkeletonShort, { opacity: pulse }]} />
        </View>
      ) : null}

      {actionLabel && onAction ? (
        <UiButton label={actionLabel} tone={actionTone} onPress={onAction} />
      ) : null}
    </View>
  );
};

const StatusStrip = ({
  tone = 'muted',
  eyebrow,
  title,
  body,
  meta,
}: {
  tone?: 'sage' | 'clay' | 'muted';
  eyebrow: string;
  title?: string;
  body: string;
  meta?: string;
}) => (
  <View
    style={[
      styles.statusStrip,
      tone === 'clay'
        ? styles.statusStripToneClay
        : tone === 'sage'
          ? styles.statusStripToneSage
          : styles.statusStripToneMuted,
    ]}
  >
    <Text style={styles.statusStripEyebrow}>{eyebrow}</Text>
    {title ? <Text style={styles.statusStripTitle}>{title}</Text> : null}
    <Text style={styles.statusStripBody}>{body}</Text>
    {meta ? <Text style={styles.statusStripMeta}>{meta}</Text> : null}
  </View>
);

const CollapsibleSectionCard = ({
  accent = 'sage',
  title,
  meta,
  defaultExpanded = false,
  children,
}: {
  accent?: 'sage' | 'clay';
  title: string;
  meta?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [progress] = useState(() => new Animated.Value(defaultExpanded ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress]);

  const chevronRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });
  const maxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1200],
  });

  return (
    <ScreenCard accent={accent}>
      <Pressable
        style={({ pressed }) => [styles.collapsibleHeader, pressed ? styles.collapsibleHeaderPressed : null]}
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={PRESSABLE_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${title} bolumunu ${expanded ? 'daralt' : 'genislet'}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.collapsibleHeaderContent}>
          <Text style={styles.collapsibleTitle}>{title}</Text>
          {meta ? <Text style={styles.collapsibleMeta}>{meta}</Text> : null}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Text style={styles.collapsibleChevron}>{'>'}</Text>
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[
          styles.collapsibleBodyWrap,
          {
            opacity: progress,
            maxHeight,
            pointerEvents: expanded ? 'auto' : 'none',
          },
        ]}
      >
        <View style={styles.collapsibleBodyInner}>{children}</View>
      </Animated.View>
    </ScreenCard>
  );
};

class ScreenErrorBoundary extends Component<
  { section: string; children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'unknown_render_error',
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    void error;
    void errorInfo;
    // Rendering errors should not blank the tab.
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ScreenCard accent="clay">
        <Text style={styles.screenTitle}>{this.props.section} Ekrani</Text>
        <Text style={styles.screenBody}>
          Bu bolumde gecici bir render hatasi olustu. Ekrani yeniden acarak devam edebilirsin.
        </Text>
        <Text style={[styles.screenMeta, styles.ritualStateError]}>{this.state.message}</Text>
      </ScreenCard>
    );
  }
}

const LegacyAuthCard = ({
  authState,
  email,
  password,
  confirmPassword,
  mode,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onModeChange,
  onSignIn,
  showAppleSignIn,
  onAppleSignIn,
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
}: {
  authState: AuthState;
  email: string;
  password: string;
  confirmPassword: string;
  mode: 'login' | 'forgot' | 'recovery';
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (value: 'login' | 'forgot' | 'recovery') => void;
  onSignIn: () => void;
  showAppleSignIn: boolean;
  onAppleSignIn: () => void;
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
}) => {
  const isBusy = authState.status === 'loading';
  const isSignedIn = authState.status === 'signed_in';
  const isConfigured = isSupabaseConfigured;
  const isRecoveryMode = mode === 'recovery';
  const isForgotMode = mode === 'forgot';
  const authStatusTone =
    !isConfigured || authState.status === 'error'
      ? 'clay'
      : isSignedIn && !isRecoveryMode
        ? 'sage'
        : 'muted';
  const submitLabel = isRecoveryMode
    ? isBusy
      ? 'Sifre guncelleniyor...'
      : 'Yeni Sifreyi Kaydet'
    : isForgotMode
      ? isBusy
        ? 'Baglanti gonderiliyor...'
        : 'Sifirla Linki Gonder'
      : isBusy
        ? 'Giris yapiliyor...'
        : 'Giris Yap';
  const title = isRecoveryMode ? 'Yeni Sifre' : isForgotMode ? 'Sifre Sifirla' : 'Uye Girisi';
  const body = isRecoveryMode
    ? 'Yeni sifreni kaydet.'
    : isForgotMode
      ? 'E-postani gir.'
      : showAppleSignIn
        ? 'Email, Apple veya Google ile devam et.'
        : 'Email veya Google ile devam et.';
  const modeMeta = isRecoveryMode
    ? 'Iki alan ayni olmali.'
    : isForgotMode
      ? 'Baglanti e-postana gider.'
      : 'Supabase oturumu ile devam edilir.';
  const authStatusTitle = !isConfigured
    ? 'Supabase baglanmadi'
    : isRecoveryMode
      ? 'Recovery akisi aktif'
      : isSignedIn
        ? 'Cloud oturumu bagli'
        : 'Oturum bekleniyor';
  const authStatusBody = !isConfigured
    ? 'EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY olmadan hesap akislarini acamayiz.'
    : authState.message;

  return (
    <KeyboardAvoidingView
      enabled={Platform.OS !== 'web'}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
    >
      <ScreenCard accent="clay">
      <Text style={styles.sectionLeadTitle}>{title}</Text>
      <Text style={styles.sectionLeadBody}>{body}</Text>

      <StatusStrip
        tone={authStatusTone}
        eyebrow="Auth"
        title={!isConfigured || isRecoveryMode || isSignedIn || authState.status === 'error' ? authStatusTitle : undefined}
        body={authStatusBody}
        meta={isSignedIn && authState.email ? `Bagli hesap: ${authState.email}` : modeMeta}
      />

      {!isSignedIn || isRecoveryMode ? (
        <View style={styles.authForm}>
          <View style={styles.authModeSurface}>
            {!isRecoveryMode ? (
              <>
                <View style={styles.themeModeSegmentContainer}>
                  <Pressable
                    style={[
                      styles.themeModeSegmentOption,
                      mode === 'login' ? styles.themeModeSegmentActiveMidnight : null,
                    ]}
                    onPress={() => onModeChange('login')}
                    accessibilityRole="button"
                    accessibilityLabel="Giris modunu sec"
                  >
                    <Text
                      style={[
                        styles.themeModeSegmentText,
                        mode === 'login' ? styles.themeModeSegmentTextActiveMidnight : null,
                      ]}
                    >
                      Giris
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.themeModeSegmentOption,
                      mode === 'forgot' ? styles.themeModeSegmentActiveMidnight : null,
                    ]}
                    onPress={() => onModeChange('forgot')}
                    accessibilityRole="button"
                    accessibilityLabel="Sifre sifirlama modunu sec"
                  >
                    <Text
                      style={[
                        styles.themeModeSegmentText,
                        mode === 'forgot' ? styles.themeModeSegmentTextActiveMidnight : null,
                      ]}
                    >
                      Sifre Sifirla
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.authFieldStack}>
            {!isRecoveryMode ? (
              <TextInput
                style={styles.input}
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="#8e8b84"
                onChangeText={onEmailChange}
                accessibilityLabel="Email adresi"
              />
            ) : null}
            {!isForgotMode ? (
              <TextInput
                style={styles.input}
                value={password}
                autoCapitalize="none"
                secureTextEntry
                returnKeyType={isRecoveryMode ? 'next' : 'done'}
                placeholder={isRecoveryMode ? 'Yeni sifre' : 'Password'}
                placeholderTextColor="#8e8b84"
                onChangeText={onPasswordChange}
                onSubmitEditing={isRecoveryMode ? undefined : onSignIn}
                accessibilityLabel={isRecoveryMode ? 'Yeni sifre' : 'Sifre'}
              />
            ) : null}
            {isRecoveryMode ? (
              <TextInput
                style={styles.input}
                value={confirmPassword}
                autoCapitalize="none"
                secureTextEntry
                returnKeyType="done"
                placeholder="Yeni sifre tekrar"
                placeholderTextColor="#8e8b84"
                onChangeText={onConfirmPasswordChange}
                onSubmitEditing={onCompletePasswordReset}
                accessibilityLabel="Yeni sifre tekrar"
              />
            ) : null}
          </View>

          <View style={styles.authActionStack}>
            <UiButton
              label={submitLabel}
              tone="brand"
              stretch
              onPress={
                isRecoveryMode
                  ? onCompletePasswordReset
                  : isForgotMode
                    ? onRequestPasswordReset
                    : onSignIn
              }
              disabled={isBusy || !isConfigured}
            />
            {mode === 'login' && showAppleSignIn ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  APP_SCREENS_THEME_MODE === 'dawn'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
                }
                cornerRadius={14}
                style={[
                  styles.authAppleButton,
                  isBusy || !isConfigured ? styles.authAppleButtonDisabled : null,
                ]}
                onPress={() => {
                  if (isBusy || !isConfigured) return;
                  onAppleSignIn();
                }}
              />
            ) : null}
            {mode === 'login' ? (
              <UiButton
                label={isBusy ? 'Yonlendiriliyor...' : 'Google ile Devam Et'}
                tone="neutral"
                stretch
                onPress={onGoogleSignIn}
                disabled={isBusy || !isConfigured}
              />
            ) : null}
            {mode !== 'login' ? (
              <UiButton
                label="Giris ekranina don"
                tone="neutral"
                onPress={() => onModeChange('login')}
                disabled={isBusy}
              />
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.authSignedInBox}>
          <Text style={styles.screenMeta}>{authState.email || 'Bagli hesap'}</Text>
        </View>
      )}
      </ScreenCard>
    </KeyboardAvoidingView>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LegacyAuthModal = ({
  visible,
  onClose,
  authState,
  email,
  password,
  confirmPassword,
  mode,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onModeChange,
  onSignIn,
  showAppleSignIn,
  onAppleSignIn,
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
}: {
  visible: boolean;
  onClose: () => void;
  authState: AuthState;
  email: string;
  password: string;
  confirmPassword: string;
  mode: 'login' | 'forgot' | 'recovery';
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (value: 'login' | 'forgot' | 'recovery') => void;
  onSignIn: () => void;
  showAppleSignIn: boolean;
  onAppleSignIn: () => void;
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
}) => {
  useWebModalFocusReset(visible);
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>Uye Girisi</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentSurface}>
              <LegacyAuthCard
                authState={authState}
                email={email}
                password={password}
                confirmPassword={confirmPassword}
                mode={mode}
                onEmailChange={onEmailChange}
                onPasswordChange={onPasswordChange}
                onConfirmPasswordChange={onConfirmPasswordChange}
                onModeChange={onModeChange}
                onSignIn={onSignIn}
                showAppleSignIn={showAppleSignIn}
                onAppleSignIn={onAppleSignIn}
                onGoogleSignIn={onGoogleSignIn}
                onRequestPasswordReset={onRequestPasswordReset}
                onCompletePasswordReset={onCompletePasswordReset}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const AuthProviderLogoButton = ({
  label,
  onPress,
  disabled = false,
  icon,
  tone = 'light',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon: ReactNode;
  tone?: 'light' | 'dark';
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.authProviderLogoButton,
      tone === 'light' ? styles.authProviderLogoButtonLight : styles.authProviderLogoButtonDark,
      pressed && !disabled ? styles.authProviderLogoButtonPressed : null,
      disabled ? styles.authProviderLogoButtonDisabled : null,
    ]}
    onPress={onPress}
    disabled={disabled}
    hitSlop={PRESSABLE_HIT_SLOP}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
  >
    <View style={styles.authProviderLogoIconWrap}>{icon}</View>
  </Pressable>
);

const AuthCard = ({
  authState,
  email,
  fullName,
  username,
  birthDate,
  password,
  confirmPassword,
  mode,
  onEmailChange,
  onFullNameChange,
  onUsernameChange,
  onBirthDateChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onModeChange,
  onSignIn,
  onRegister,
  rememberMe,
  onRememberMeChange,
  showAppleSignIn,
  onAppleSignIn,
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
}: {
  authState: AuthState;
  email: string;
  fullName: string;
  username: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
  mode: 'login' | 'register' | 'forgot' | 'recovery';
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (value: 'login' | 'register' | 'forgot' | 'recovery') => void;
  onSignIn: () => void;
  onRegister: () => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  showAppleSignIn: boolean;
  onAppleSignIn: () => void;
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
}) => {
  const isBusy = authState.status === 'loading';
  const isSignedIn = authState.status === 'signed_in';
  const isConfigured = isSupabaseConfigured;
  const isRegisterMode = mode === 'register';
  const isRecoveryMode = mode === 'recovery';
  const isForgotMode = mode === 'forgot';
  const showRememberMe = !isForgotMode && !isRecoveryMode;
  const showSocialActions = !isForgotMode && !isRecoveryMode;
  const authStatusTone =
    !isConfigured || authState.status === 'error'
      ? 'clay'
      : isSignedIn && !isRecoveryMode
        ? 'sage'
        : 'muted';
  const submitLabel = isRecoveryMode
    ? isBusy
      ? 'Sifre guncelleniyor...'
      : 'Yeni Sifreyi Kaydet'
    : isForgotMode
      ? isBusy
        ? 'Baglanti gonderiliyor...'
        : 'Sifirla Linki Gonder'
      : isRegisterMode
        ? isBusy
          ? 'Hesap aciliyor...'
          : 'Uye Ol'
        : isBusy
          ? 'Giris yapiliyor...'
          : 'Giris Yap';
  const title = isRecoveryMode
    ? 'Yeni Sifre'
    : isForgotMode
      ? 'Sifre Sifirla'
      : isRegisterMode
        ? 'Uye Ol'
        : 'Uye Girisi';
  const body = isRecoveryMode
    ? 'Yeni sifreni kaydet.'
    : isForgotMode
      ? 'E-postani gir.'
      : isRegisterMode
        ? 'Bilgilerini tamamla.'
        : 'Devam etmek icin giris yap.';
  const modeMeta = isRecoveryMode
    ? 'Iki alan ayni olmali.'
    : isForgotMode
      ? 'Baglanti e-postana gider.'
    : isRegisterMode
        ? 'Kayit kisa surer.'
        : 'Bilgilerini gir.';
  const authStatusTitle = !isConfigured
    ? 'Giris su an kullanilamiyor'
    : isRecoveryMode
      ? 'Yeni sifre olustur'
      : isSignedIn
        ? 'Hesabin bagli'
        : 'Hesabina gir';
  const authStatusBody = !isConfigured
    ? 'Giris modulu gecici olarak hazir degil.'
    : authState.message;

  return (
    <KeyboardAvoidingView
      enabled={Platform.OS !== 'web'}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
    >
      <ScreenCard accent="clay">
      <Text style={styles.sectionLeadTitle}>{title}</Text>
      <Text style={styles.sectionLeadBody}>{body}</Text>

      <StatusStrip
        tone={authStatusTone}
        eyebrow="Durum"
        title={
          !isConfigured || isRecoveryMode || isSignedIn || authState.status === 'error'
            ? authStatusTitle
            : undefined
        }
        body={authStatusBody}
        meta={isSignedIn && authState.email ? `Bagli hesap: ${authState.email}` : modeMeta}
      />

      {!isSignedIn || isRecoveryMode ? (
        <View style={styles.authForm}>
          <View style={styles.authModeSurface}>
            {!isRecoveryMode ? (
              <>
                <View style={styles.themeModeSegmentContainer}>
                  <Pressable
                    style={[
                      styles.themeModeSegmentOption,
                      mode === 'login' ? styles.themeModeSegmentActiveMidnight : null,
                    ]}
                    onPress={() => onModeChange('login')}
                    accessibilityRole="button"
                    accessibilityLabel="Giris modunu sec"
                  >
                    <Text
                      style={[
                        styles.themeModeSegmentText,
                        mode === 'login' ? styles.themeModeSegmentTextActiveMidnight : null,
                      ]}
                    >
                      Giris
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.themeModeSegmentOption,
                      mode === 'register' ? styles.themeModeSegmentActiveMidnight : null,
                    ]}
                    onPress={() => onModeChange('register')}
                    accessibilityRole="button"
                    accessibilityLabel="Kayit modunu sec"
                  >
                    <Text
                      style={[
                        styles.themeModeSegmentText,
                        mode === 'register' ? styles.themeModeSegmentTextActiveMidnight : null,
                      ]}
                    >
                      Uye Ol
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => onModeChange(isForgotMode ? 'login' : 'forgot')}
                  hitSlop={PRESSABLE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isForgotMode ? 'Giris ekranina don' : 'Sifre sifirlama ekranini ac'
                  }
                >
                  <Text style={styles.authSubtleAction}>
                    {isForgotMode ? 'Giris ekranina don' : 'Sifremi unuttum'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.authRecoveryLabel}>Yeni sifreni gir ve tekrar et.</Text>
            )}
          </View>

          <View style={styles.authFieldStack}>
            {isRegisterMode ? (
              <>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  autoCapitalize="words"
                  placeholder="Ad Soyad"
                  placeholderTextColor="#8e8b84"
                  onChangeText={onFullNameChange}
                  accessibilityLabel="Ad Soyad"
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  autoCapitalize="none"
                  placeholder="Kullanici adi"
                  placeholderTextColor="#8e8b84"
                  onChangeText={(value) =>
                    onUsernameChange(value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
                  }
                  accessibilityLabel="Kullanici adi"
                />
                <TextInput
                  style={styles.input}
                  value={birthDate}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  placeholder="Dogum tarihi (YYYY-AA-GG)"
                  placeholderTextColor="#8e8b84"
                  onChangeText={onBirthDateChange}
                  accessibilityLabel="Dogum tarihi"
                />
              </>
            ) : null}
            {!isRecoveryMode ? (
              <TextInput
                style={styles.input}
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="#8e8b84"
                onChangeText={onEmailChange}
                accessibilityLabel="Email adresi"
              />
            ) : null}
            {!isForgotMode ? (
              <TextInput
                style={styles.input}
                value={password}
                autoCapitalize="none"
                secureTextEntry
                returnKeyType={isRecoveryMode ? 'next' : 'done'}
                placeholder={isRecoveryMode ? 'Yeni sifre' : 'Sifre'}
                placeholderTextColor="#8e8b84"
                onChangeText={onPasswordChange}
                onSubmitEditing={
                  isRecoveryMode ? undefined : isRegisterMode ? onRegister : onSignIn
                }
                accessibilityLabel={isRecoveryMode ? 'Yeni sifre' : 'Sifre'}
              />
            ) : null}
            {isRegisterMode || isRecoveryMode ? (
              <TextInput
                style={styles.input}
                value={confirmPassword}
                autoCapitalize="none"
                secureTextEntry
                returnKeyType="done"
                placeholder={isRecoveryMode ? 'Yeni sifre tekrar' : 'Sifre tekrar'}
                placeholderTextColor="#8e8b84"
                onChangeText={onConfirmPasswordChange}
                onSubmitEditing={isRecoveryMode ? onCompletePasswordReset : onRegister}
                accessibilityLabel={isRecoveryMode ? 'Yeni sifre tekrar' : 'Sifre tekrar'}
              />
            ) : null}
          </View>

          {showRememberMe ? (
            <Pressable
              style={({ pressed }) => [
                styles.authRememberRow,
                pressed ? styles.authRememberRowPressed : null,
              ]}
              onPress={() => onRememberMeChange(!rememberMe)}
              disabled={isBusy}
              hitSlop={PRESSABLE_HIT_SLOP}
              accessibilityRole="checkbox"
              accessibilityLabel="Beni hatirla"
              accessibilityState={{ checked: rememberMe, disabled: isBusy }}
            >
              <View
                style={[
                  styles.authRememberCheckbox,
                  rememberMe ? styles.authRememberCheckboxActive : null,
                ]}
              >
                {rememberMe ? <Ionicons name="checkmark" size={14} color="#121212" /> : null}
              </View>
              <View style={styles.authRememberCopy}>
                <Text style={styles.authRememberLabel}>Beni hatirla</Text>
                <Text style={styles.authRememberMeta}>Bu cihazda oturumu koru.</Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.authActionStack}>
            <UiButton
              label={submitLabel}
              tone="brand"
              stretch
              onPress={
                isRecoveryMode
                  ? onCompletePasswordReset
                  : isForgotMode
                    ? onRequestPasswordReset
                    : isRegisterMode
                      ? onRegister
                      : onSignIn
              }
              disabled={isBusy || !isConfigured}
            />

            {showSocialActions ? (
              <>
                <View style={styles.authDividerRow}>
                  <View style={styles.authDividerLine} />
                  <Text style={styles.authDividerText}>VEYA</Text>
                  <View style={styles.authDividerLine} />
                </View>
                <AuthProviderLogoButton
                  label={isBusy ? 'Google yonlendiriliyor' : 'Google ile uye ol'}
                  onPress={onGoogleSignIn}
                  disabled={isBusy || !isConfigured}
                  tone="light"
                  icon={<FontAwesome name="google" size={28} color="#A45E4A" />}
                />
                {showAppleSignIn ? (
                  <AuthProviderLogoButton
                    label={isBusy ? 'Apple yonlendiriliyor' : 'Apple ile uye ol'}
                    onPress={onAppleSignIn}
                    disabled={isBusy || !isConfigured}
                    tone="dark"
                    icon={<Ionicons name="logo-apple" size={28} color="#E5E4E2" />}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.authSignedInBox}>
          <Text style={styles.screenMeta}>{authState.email || 'Bagli hesap'}</Text>
        </View>
      )}
      </ScreenCard>
    </KeyboardAvoidingView>
  );
};

const AuthModal = ({
  visible,
  onClose,
  authState,
  email,
  fullName,
  username,
  birthDate,
  password,
  confirmPassword,
  mode,
  onEmailChange,
  onFullNameChange,
  onUsernameChange,
  onBirthDateChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onModeChange,
  onSignIn,
  onRegister,
  rememberMe,
  onRememberMeChange,
  showAppleSignIn,
  onAppleSignIn,
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
}: {
  visible: boolean;
  onClose: () => void;
  authState: AuthState;
  email: string;
  fullName: string;
  username: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
  mode: 'login' | 'register' | 'forgot' | 'recovery';
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (value: 'login' | 'register' | 'forgot' | 'recovery') => void;
  onSignIn: () => void;
  onRegister: () => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  showAppleSignIn: boolean;
  onAppleSignIn: () => void;
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
}) => {
  useWebModalFocusReset(visible);
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.authLaunchScreen}>
        <ScrollView
          contentContainerStyle={styles.authLaunchScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authLaunchTopRow}>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>

          <View style={styles.authLaunchHero}>
            <Text style={styles.authLaunchBrand}>180</Text>
            <Text style={styles.authLaunchEyebrow}>Absolute Cinema</Text>
            <Text style={styles.authLaunchTitle}>
              Giris ve uye ol bolumleri burada.
            </Text>
            <Text style={styles.authLaunchBody}>
              Email ile devam et, hesabini olustur ya da Google ve Apple ile giris yap.
            </Text>
          </View>

          <AuthCard
            authState={authState}
            email={email}
            fullName={fullName}
            username={username}
            birthDate={birthDate}
            password={password}
            confirmPassword={confirmPassword}
            mode={mode}
            onEmailChange={onEmailChange}
            onFullNameChange={onFullNameChange}
            onUsernameChange={onUsernameChange}
            onBirthDateChange={onBirthDateChange}
            onPasswordChange={onPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onModeChange={onModeChange}
            onSignIn={onSignIn}
            onRegister={onRegister}
            rememberMe={rememberMe}
            onRememberMeChange={onRememberMeChange}
            showAppleSignIn={showAppleSignIn}
            onAppleSignIn={onAppleSignIn}
            onGoogleSignIn={onGoogleSignIn}
            onRequestPasswordReset={onRequestPasswordReset}
            onCompletePasswordReset={onCompletePasswordReset}
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

type MobileAuthEntryStage = 'intro' | 'form';

const AuthGateScreen = ({
  authState,
  email,
  fullName,
  username,
  birthDate,
  password,
  confirmPassword,
  mode,
  onEmailChange,
  onFullNameChange,
  onUsernameChange,
  onBirthDateChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onModeChange,
  onSignIn,
  onRegister,
  rememberMe,
  onRememberMeChange,
  onGoogleSignIn,
  onAppleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
  entryStage,
  onContinue,
}: {
  authState: AuthState;
  email: string;
  fullName: string;
  username: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
  mode: 'login' | 'register' | 'forgot' | 'recovery';
  onEmailChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onModeChange: (value: 'login' | 'register' | 'forgot' | 'recovery') => void;
  onSignIn: () => void;
  onRegister: () => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
  entryStage: MobileAuthEntryStage;
  onContinue: () => void;
}) => {
  const stage = mode === 'recovery' ? 'form' : entryStage;
  const statusTone =
    authState.status === 'error'
      ? 'clay'
      : authState.status === 'loading'
        ? 'muted'
        : 'sage';

  return (
    <View style={styles.authGateScreen}>
      <ScrollView
        contentContainerStyle={styles.authGateScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authGateHero}>
          <Text style={styles.authGateBrand}>180</Text>
          <Text style={styles.authGateEyebrow}>Absolute Cinema</Text>
          <Text style={styles.authGateTitle}>Gunun 5 filmi, yorum ve sosyal akis.</Text>
          <Text style={styles.authGateBody}>Secimini yap. Yorumunu birak. Takipte kal.</Text>

          <View style={styles.authGateFeatureList}>
            <View style={styles.authGateFeatureRow}>
              <View style={styles.authGateFeatureDot} />
              <Text style={styles.authGateFeatureText}>Her gun 5 film.</Text>
            </View>
            <View style={styles.authGateFeatureRow}>
              <View style={styles.authGateFeatureDot} />
              <Text style={styles.authGateFeatureText}>Kisa yorumlar.</Text>
            </View>
            <View style={styles.authGateFeatureRow}>
              <View style={styles.authGateFeatureDot} />
              <Text style={styles.authGateFeatureText}>Takip, begeni, bildirim.</Text>
            </View>
          </View>

          <StatusStrip
            tone={statusTone}
            eyebrow="Giris"
            title={
              authState.status === 'error'
                ? 'Bir sorun var'
                : authState.status === 'loading'
                  ? 'Kontrol ediliyor'
                  : 'Hesap gerekli'
            }
            body={authState.message}
            meta="Misafir girisi kapali."
          />

          {stage === 'intro' ? (
            <UiButton
              label="Basla"
              tone="brand"
              stretch
              onPress={onContinue}
              style={styles.authGateStartButton}
            />
          ) : null}
        </View>

        {stage === 'form' ? (
          <AuthCard
            authState={authState}
            email={email}
            fullName={fullName}
            username={username}
            birthDate={birthDate}
            password={password}
            confirmPassword={confirmPassword}
            mode={mode}
            onEmailChange={onEmailChange}
            onFullNameChange={onFullNameChange}
            onUsernameChange={onUsernameChange}
            onBirthDateChange={onBirthDateChange}
            onPasswordChange={onPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onModeChange={onModeChange}
            onSignIn={onSignIn}
            onRegister={onRegister}
            rememberMe={rememberMe}
            onRememberMeChange={onRememberMeChange}
            showAppleSignIn
            onAppleSignIn={onAppleSignIn}
            onGoogleSignIn={onGoogleSignIn}
            onRequestPasswordReset={onRequestPasswordReset}
            onCompletePasswordReset={onCompletePasswordReset}
          />
        ) : null}
      </ScrollView>
    </View>
  );
};

const ProfileSnapshotCard = ({
  state,
  isSignedIn,
}: {
  state: ProfileState;
  isSignedIn: boolean;
}) => {
  return (
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Profil Ozeti</Text>
      <Text style={styles.screenBody}>
        Mobilde streak ve profil metriklerinin guncel ozetini burada gorebilirsin.
      </Text>

      {!isSignedIn ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Profil metrikleri icin once Session kartindan giris yap.
        </Text>
      ) : null}

      {state.status === 'success' ? (
        <>
          <Text style={styles.screenMeta}>User: {state.displayName}</Text>
          <Text style={styles.screenMeta}>League: {state.leagueKey}</Text>
          <Text style={styles.screenMeta}>Last comment day: {state.lastRitualDate || 'none'}</Text>
          <View style={styles.profileGrid}>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.totalXp}</Text>
              <Text style={styles.profileMetricLabel}>XP</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.streak}</Text>
              <Text style={styles.profileMetricLabel}>Streak</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.ritualsCount}</Text>
              <Text style={styles.profileMetricLabel}>Comments</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.daysPresent}</Text>
              <Text style={styles.profileMetricLabel}>Days</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.followingCount}</Text>
              <Text style={styles.profileMetricLabel}>Following</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{state.followersCount}</Text>
              <Text style={styles.profileMetricLabel}>Followers</Text>
            </View>
          </View>
        </>
      ) : null}

      <Text
        style={[
          styles.screenMeta,
          state.status === 'error'
            ? styles.ritualStateError
            : state.status === 'success'
              ? styles.ritualStateOk
              : styles.screenMeta,
        ]}
      >
        {state.message}
      </Text>
    </ScreenCard>
  );
};

const ProfileXpCard = ({
  state,
  onRefresh,
}: {
  state: ProfileState;
  onRefresh: () => void;
}) => {
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow="XP Hatti"
        title="XP akisi hazirlaniyor"
        body="Web ile ayni lig ilerlemesi hesaplanirken profil verileri okunuyor."
        meta="Her 500 XP seni bir sonraki lige tasir."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="clay"
        variant="error"
        eyebrow="XP Hatti"
        title="XP ilerlemesi simdi acilamadi"
        body="Profil seviyen okunamadi. Tekrar deneyince bar ve lig esikleri yeniden hesaplanacak."
        meta={state.message}
        actionLabel="Tekrar Dene"
        onAction={onRefresh}
        actionTone="neutral"
      />
    );
  }

  if (state.status !== 'success') {
    return null;
  }

  const successState = state;
  const totalXp = Math.max(0, Math.floor(Number(successState.totalXp || 0)));
  const progress = resolveMobileLeagueProgress(totalXp);
  const currentLevelXp = Math.max(0, totalXp - progress.currentLevelStart);
  const xpToNext = Math.max(0, Math.floor(progress.nextLevelXp - totalXp));
  const nextLeagueLabel = String(successState.nextLeagueName || '').trim() || 'Son Lig';
  const progressPercentLabel = Math.round(progress.progressPercentage);
  const fillHeadColor = getProgressHeadColor(progress.progressPercentage);
  const fillTailColor = getProgressTailColor(progress.progressPercentage);
  const effectiveProgressWidth =
    progress.progressPercentage > 0 ? Math.max(progress.progressPercentage, 3) : 0;
  const isMaxLeague = !successState.nextLeagueName;

  return (
    <ScreenCard accent="sage">
      <Text style={styles.sectionLeadEyebrow}>XP Hatti</Text>
      <Text style={styles.sectionLeadTitle}>{successState.leagueName}</Text>
      <Text style={styles.sectionLeadBody}>
        {isMaxLeague
          ? 'Web ile ayni lig sistemi burada da aktif. Su an erisilebilir en ust ligdesin.'
          : `Web ile ayni kural: her 500 XP seni bir sonraki lige tasir. ${nextLeagueLabel} icin ${xpToNext} XP kaldi.`}
      </Text>

      <View style={styles.sectionLeadBadgeRow}>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
          <Text style={styles.sectionLeadBadgeText}>{`${totalXp} XP`}</Text>
        </View>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
          <Text style={styles.sectionLeadBadgeText}>
            {isMaxLeague ? 'son lig' : `siradaki ${nextLeagueLabel}`}
          </Text>
        </View>
        <View
          style={[
            styles.sectionLeadBadge,
            progressPercentLabel >= 66 ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeClay,
          ]}
        >
          <Text style={styles.sectionLeadBadgeText}>{`%${progressPercentLabel} dolu`}</Text>
        </View>
      </View>

      <View style={styles.profileXpSummaryRow}>
        <View style={styles.profileXpSummaryBlock}>
          <Text style={styles.profileXpSummaryLabel}>Bulundugun Lig</Text>
          <Text style={styles.profileXpSummaryValue}>{successState.leagueName}</Text>
        </View>
        <View style={[styles.profileXpSummaryBlock, styles.profileXpSummaryBlockRight]}>
          <Text style={styles.profileXpSummaryLabel}>Siradaki Lig</Text>
          <Text style={styles.profileXpSummaryValue}>{nextLeagueLabel}</Text>
        </View>
      </View>

      <View style={styles.profileXpTrack}>
        {effectiveProgressWidth > 0 ? (
          <View
            style={[
              styles.profileXpFill,
              {
                width: `${effectiveProgressWidth}%`,
                backgroundColor: fillTailColor,
              },
            ]}
          >
            <View
              style={[
                styles.profileXpFillHeadTint,
                {
                  backgroundColor: fillHeadColor,
                },
              ]}
            />
            <View style={styles.profileXpFillSpark} />
          </View>
        ) : null}
      </View>

      <View style={styles.profileXpScaleRow}>
        <Text style={styles.profileXpScaleText}>{`${progress.currentLevelStart} XP`}</Text>
        <Text style={styles.profileXpScaleText}>{`${progress.nextLevelXp} XP`}</Text>
      </View>

      <View style={styles.detailInfoGrid}>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Bu Ligde</Text>
          <Text style={styles.detailInfoValue}>{`${currentLevelXp} XP`}</Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Kalan</Text>
          <Text style={styles.detailInfoValue}>{isMaxLeague ? '0 XP' : `${xpToNext} XP`}</Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Esik</Text>
          <Text style={styles.detailInfoValue}>{`Her 500 XP`}</Text>
        </View>
      </View>
    </ScreenCard>
  );
};

const ThemeModeCard = ({
  mode,
  onSetMode,
}: {
  mode: MobileThemeMode;
  onSetMode: (mode: MobileThemeMode) => void;
}) => (
  <ScreenCard accent={mode === 'dawn' ? 'clay' : 'sage'}>
    <Text style={styles.screenTitle}>Tema Modu</Text>
    <Text style={styles.screenBody}>
      Gece/Gündüz altyapısı mobile eklendi. Tasarım katmanı bu seçimi referans alacak.
    </Text>
    <View style={styles.themeModeSegmentContainer}>
      <Pressable
        style={[
          styles.themeModeSegmentOption,
          mode === 'midnight' && styles.themeModeSegmentActiveMidnight,
        ]}
        onPress={() => onSetMode('midnight')}
        accessibilityLabel="Gece modunu sec"
      >
        <Text
          style={[
            styles.themeModeSegmentText,
            mode === 'midnight' && styles.themeModeSegmentTextActiveMidnight,
          ]}
        >
          Gece Modu
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.themeModeSegmentOption,
          mode === 'dawn' && styles.themeModeSegmentActiveDawn,
        ]}
        onPress={() => onSetMode('dawn')}
        accessibilityLabel="Gündüz modunu seç"
      >
        <Text
          style={[
            styles.themeModeSegmentText,
            mode === 'dawn' && styles.themeModeSegmentTextActiveDawn,
          ]}
        >
          Gündüz Modu
        </Text>
      </Pressable>
    </View>
  </ScreenCard>
);

const ProfileIdentityCard = ({
  displayName,
  avatarUrl,
  username,
  bio,
  birthDateLabel,
  followingCount,
  followersCount,
  profileLink,
  onOpenProfileLink,
}: {
  displayName: string;
  avatarUrl?: string;
  username?: string;
  bio?: string;
  birthDateLabel?: string;
  followingCount: number;
  followersCount: number;
  profileLink?: string;
  onOpenProfileLink?: () => void;
}) => {
  const normalizedDisplayName = String(displayName || '').trim() || 'Observer';
  const normalizedAvatarUrl = String(avatarUrl || '').trim();
  const normalizedUsername = String(username || '').trim().replace(/^@+/, '');
  const normalizedBio =
    String(bio || '').trim() || 'Profil notunu ayarlardan duzenleyerek kendini daha net anlatabilirsin.';
  const normalizedLink = String(profileLink || '').trim();
  const hasLink = Boolean(normalizedLink);
  const hasBirthDate = Boolean(String(birthDateLabel || '').trim());

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Identity File"
        title={normalizedDisplayName}
        body={normalizedBio}
        badges={[
          {
            label: normalizedUsername ? `@${normalizedUsername}` : 'handle bekleniyor',
            tone: normalizedUsername ? 'sage' : 'clay',
          },
          {
            label: hasBirthDate ? `Dogum ${birthDateLabel}` : 'dogum bilgisi bos',
            tone: hasBirthDate ? 'muted' : 'clay',
          },
          { label: hasLink ? 'profil linki hazir' : 'link opsiyonel', tone: hasLink ? 'sage' : 'muted' },
        ]}
        metrics={[
          { label: 'Takip', value: String(followingCount) },
          { label: 'Takipci', value: String(followersCount) },
          { label: 'Link', value: hasLink ? 'hazir' : '--' },
        ]}
        actions={
          hasLink && onOpenProfileLink
            ? [{ label: 'Profili Ac', tone: 'brand', onPress: onOpenProfileLink }]
            : undefined
        }
      />

      <StatusStrip
        tone={hasLink ? 'sage' : 'muted'}
        eyebrow="Identity State"
        title={hasLink ? 'Profil baglantisi hazir' : 'Kimlik katmani hazir'}
        body={
          hasLink
            ? 'Dis profil linki ayarlandi. Profil yuzeyinden tek dokunusla acilabilir.'
            : 'Bio, handle ve sosyal baglam burada toplanir. Link eklemek istersen ayarlardan tamamlayabilirsin.'
        }
        meta={
          normalizedUsername
            ? `Profil handle: @${normalizedUsername}`
            : 'Kullanici adi alanini ayarlardan doldurabilirsin.'
        }
      />

      <ScreenCard accent="clay">
        <View style={styles.profileIdentityHeroRow}>
          <View style={styles.profileIdentityAvatarWrap}>
            {normalizedAvatarUrl ? (
              <Image
                source={{ uri: normalizedAvatarUrl }}
                style={styles.profileIdentityAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.profileIdentityAvatarFallback}>
                {(normalizedDisplayName.slice(0, 1) || 'O').toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.profileIdentityHeroCopy}>
            <Text style={styles.detailInfoLabel}>Profil Fotografi</Text>
            <Text style={styles.detailInfoValue}>
              {normalizedAvatarUrl ? 'Aktif' : 'Eklenmedi'}
            </Text>
          </View>
        </View>

        <Text style={styles.subSectionLabel}>Kimlik Notu</Text>
        <View style={styles.detailInfoGrid}>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Gorunen Ad</Text>
            <Text style={styles.detailInfoValue}>{normalizedDisplayName}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Handle</Text>
            <Text style={styles.detailInfoValue}>
              {normalizedUsername ? `@${normalizedUsername}` : 'Belirtilmedi'}
            </Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Dogum</Text>
            <Text style={styles.detailInfoValue}>{birthDateLabel || '--'}</Text>
          </View>
        </View>

        <Text style={styles.screenBody}>{normalizedBio}</Text>
        <Text style={styles.screenMeta}>
          Takip: {followingCount} | Takipci: {followersCount}
        </Text>

        {hasLink ? (
          <Pressable
            onPress={() => onOpenProfileLink?.()}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Profil linkini ac"
          >
            <Text style={styles.profileLinkText}>{normalizedLink}</Text>
          </Pressable>
        ) : null}
      </ScreenCard>
    </>
  );
};

const ProfileGenreDistributionCard = ({
  items,
  isSignedIn,
}: {
  items: Array<{ genre: string; count: number }>;
  isSignedIn: boolean;
}) => {
  const topGenre = items[0];
  const totalCount = items.reduce((sum, item) => sum + Math.max(0, Number(item.count || 0)), 0);

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Taste Map"
        title="Tur Dagilimi"
        body="Yorum kayitlarindan cikan baskin tur izi. Profilin hangi sinema damarinda aktigini hizli gosterir."
        badges={[
          { label: isSignedIn ? 'profil verisi hazir' : 'oturum gerekli', tone: isSignedIn ? 'sage' : 'clay' },
          { label: `${items.length} tur`, tone: items.length > 0 ? 'sage' : 'muted' },
          { label: topGenre ? `zirvede ${topGenre.genre}` : 'dagilim bekleniyor', tone: topGenre ? 'muted' : 'clay' },
        ]}
        metrics={[
          { label: 'Toplam', value: String(totalCount) },
          { label: 'Gorunen', value: String(items.length) },
          { label: 'Lider', value: topGenre ? String(topGenre.count) : '--' },
        ]}
      />

      {!isSignedIn ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Genre"
          title="Tur haritasi icin oturum ac"
          body="Tur dagilimi, profiline yazilan yorum verileri uzerinden hesaplanir."
          meta="Giris yaptiginda bu alan favori eksenlerini otomatik olarak listeler."
        />
      ) : items.length === 0 ? (
        <StatePanel
          tone="sage"
          variant="empty"
          eyebrow="Genre"
          title="Henuz dagilim olusmadi"
          body="Farkli turlerde yorum biraktikca burada baskin sinema haritan gorunecek."
          meta="Veri geldikten sonra en guclu bes kategori listelenir."
        />
      ) : (
        <>
          <StatusStrip
            tone="sage"
            eyebrow="Taste Pulse"
            title={`${topGenre?.genre || 'Baskin tur'} onde gidiyor`}
            body={`Toplam ${totalCount} yorum kaydi icinde en guclu genre izi ${topGenre?.genre || 'belirsiz'}.`}
            meta="Yeni yorumlar geldikce dagilim otomatik guncellenir."
          />

          <ScreenCard accent="sage">
            <Text style={styles.subSectionLabel}>Ilk 5 Tur</Text>
            <View style={styles.profileGenreList}>
              {items.map((item) => (
                <View key={`${item.genre}-${item.count}`} style={styles.profileGenreRow}>
                  <Text style={styles.profileGenreLabel}>{item.genre}</Text>
                  <Text style={styles.profileGenreValue}>x{item.count}</Text>
                </View>
              ))}
            </View>
          </ScreenCard>
        </>
      )}
    </>
  );
};

const WatchedMoviesCard = ({
  state,
  isSignedIn,
  onOpenMovieArchive,
}: {
  state: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: MobileWatchedMovie[];
  };
  isSignedIn: boolean;
  onOpenMovieArchive: (movie: MobileWatchedMovie) => void;
}) => {
  const repeatedCount = state.items.filter((movie) => movie.watchCount > 1).length;
  const latestMovie = state.items[0];
  const statusTone =
    state.status === 'error' ? 'clay' : state.status === 'ready' ? 'sage' : 'muted';

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Watch Archive"
        title="Izlenen Filmler"
        body="Yorum ve Letterboxd filmlerin burada."
        badges={[
          { label: isSignedIn ? 'cloud bagli' : 'oturum gerekli', tone: isSignedIn ? 'sage' : 'clay' },
          { label: `${state.items.length} film`, tone: state.items.length > 0 ? 'sage' : 'muted' },
          { label: repeatedCount > 0 ? `${repeatedCount} tekrar izleme` : 'tekil izler', tone: repeatedCount > 0 ? 'clay' : 'muted' },
        ]}
        metrics={[
          { label: 'Film', value: String(state.items.length) },
          { label: 'Tekrar', value: String(repeatedCount) },
          { label: 'Son Gun', value: latestMovie?.watchedDayKey || '--' },
        ]}
      />

      <StatusStrip
        tone={statusTone}
        eyebrow="Archive State"
        title={
          state.status === 'error'
            ? 'Film arsivi okunamadi'
            : state.status === 'ready'
              ? 'Film arsivi hazir'
              : state.status === 'loading'
                ? 'Film arsivi yukleniyor'
                : 'Film arsivi beklemede'
        }
        body={state.message}
        meta={
          latestMovie
            ? `Son iz: ${latestMovie.movieTitle}${latestMovie.year ? ` (${latestMovie.year})` : ''}`
            : 'Filmler burada listelenir.'
        }
      />

      {state.items.length === 0 ? (
        <StatePanel
          tone={state.status === 'error' || !isSignedIn ? 'clay' : 'sage'}
          variant={
            state.status === 'loading'
              ? 'loading'
              : state.status === 'error'
                ? 'error'
                : 'empty'
          }
          eyebrow="Film Arsivi"
          title={
            !isSignedIn
              ? 'Izlenen filmler icin giris yap'
              : state.status === 'loading'
                ? 'Film arsivi tazeleniyor'
                : state.status === 'error'
                  ? 'Izlenen filmler okunamadi'
                  : 'Henuz film izi olusmadi'
          }
          body={
            !isSignedIn
              ? 'Filmleri gormek icin giris yap.'
              : state.status === 'error'
                ? state.message || 'Film arsivi okunurken gecici bir sorun olustu.'
                : state.message || 'Filmler geldikce burada gorunur.'
          }
          meta="Letterboxd kayitlari profil listesine eklenir."
        />
      ) : (
        <ScreenCard accent="sage">
          <Text style={styles.subSectionLabel}>Son Izler</Text>
          <View style={styles.movieList}>
            {state.items.slice(0, 20).map((movie) => {
              const isLetterboxdItem = movie.source === 'letterboxd';
              const content = (
                <>
                  <Text style={styles.movieTitle}>{movie.movieTitle}</Text>
                  <Text style={styles.movieMeta}>
                    {movie.year ? `${movie.year} | ` : ''}
                    Son izleme: {movie.watchedDayKey || '-'}
                    {movie.watchCount > 1 ? ` | Tekrar: ${movie.watchCount}` : ''}
                    {isLetterboxdItem ? ' | Letterboxd' : ''}
                  </Text>
                  <Text style={styles.movieRowActionHint}>
                    {isLetterboxdItem ? 'Letterboxd' : 'Yorum Arsivini Ac'}
                  </Text>
                </>
              );

              if (isLetterboxdItem) {
                return (
                  <View key={movie.id} style={styles.movieRow}>
                    {content}
                  </View>
                );
              }

              return (
                <Pressable
                  key={movie.id}
                  style={({ pressed }) => [styles.movieRow, pressed ? styles.movieRowPressed : null]}
                  onPress={() => onOpenMovieArchive(movie)}
                  hitSlop={PRESSABLE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`${movie.movieTitle} film arsivini ac`}
                >
                  {content}
                </Pressable>
              );
            })}
          </View>
        </ScreenCard>
      )}
    </>
  );
};

const markMotionDurationMs = (motion: string): number => {
  if (motion === 'spin' || motion === 'pulse' || motion === 'float' || motion === 'signal' || motion === 'spark') {
    return MARK_MOTION_DURATION_MS[motion];
  }
  return MARK_MOTION_DURATION_MS.pulse;
};

const resolveMarkIconAnimatedStyle = (motion: string, progress: Animated.Value) => {
  switch (motion) {
    case 'spin':
      return {
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      };
    case 'float':
      return {
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, -1.5, 0],
            }),
          },
        ],
      };
    case 'signal':
      return {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, 1.03],
            }),
          },
        ],
      };
    case 'spark':
      return {
        opacity: progress.interpolate({
          inputRange: [0, 0.35, 0.65, 1],
          outputRange: [0.78, 1, 0.86, 0.78],
        }),
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [0, 0.35, 0.65, 1],
              outputRange: ['-1deg', '1deg', '0deg', '-1deg'],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.35, 0.65, 1],
              outputRange: [0.96, 1.08, 1, 0.96],
            }),
          },
        ],
      };
    case 'pulse':
    default:
      return {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1.04],
            }),
          },
        ],
      };
  }
};

const MobileAnimatedMarkGlyph = ({
  markId,
  motion,
  isUnlocked,
  isFeatured,
  size = 18,
  frameStyle,
  featuredFrameStyle,
}: {
  markId: string;
  motion: string;
  isUnlocked: boolean;
  isFeatured: boolean;
  size?: number;
  frameStyle?: object;
  featuredFrameStyle?: object;
}) => {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!isUnlocked || motion === 'none') return;

    const duration = markMotionDurationMs(motion);
    const animation =
      motion === 'spin'
        ? Animated.loop(
            Animated.timing(progress, {
              toValue: 1,
              duration,
              easing: Easing.linear,
              useNativeDriver: SUPPORTS_NATIVE_DRIVER,
            })
          )
        : Animated.loop(
            Animated.sequence([
              Animated.timing(progress, {
                toValue: 1,
                duration: Math.round(duration / 2),
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: SUPPORTS_NATIVE_DRIVER,
              }),
              Animated.timing(progress, {
                toValue: 0,
                duration: Math.round(duration / 2),
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: SUPPORTS_NATIVE_DRIVER,
              }),
            ])
          );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [isUnlocked, motion, progress]);

  const iconColor = !isUnlocked
    ? 'rgba(142, 139, 132, 0.62)'
    : isFeatured
      ? '#d9e2bf'
      : '#8A9A5B';

  const animatedStyle = !isUnlocked || motion === 'none'
    ? null
    : resolveMarkIconAnimatedStyle(motion, progress);

  return (
    <Animated.View
      style={[
        frameStyle,
        isUnlocked && isFeatured ? featuredFrameStyle || null : null,
        animatedStyle,
      ]}
    >
      <MobileMarkIcon
        markId={markId}
        color={iconColor}
        size={size}
        opacity={isUnlocked ? 1 : 0.84}
      />
    </Animated.View>
  );
};

const MobileMarkPill = ({
  markId,
  title,
  motion,
  isUnlocked,
  isFeatured,
  onPress,
  accessibilityLabel,
}: {
  markId: string;
  title: string;
  motion: string;
  isUnlocked: boolean;
  isFeatured: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) => {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!isUnlocked || motion === 'none') return;

    const duration = markMotionDurationMs(motion);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: Math.round(duration / 2),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: SUPPORTS_NATIVE_DRIVER,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: Math.round(duration / 2),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: SUPPORTS_NATIVE_DRIVER,
        }),
      ])
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [isUnlocked, motion, progress]);

  const containerAnimatedStyle = isUnlocked
    ? {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.98, isFeatured ? 1.04 : 1.02],
            }),
          },
        ],
      }
    : null;

  const content = (
    <Animated.View
      style={[
        styles.markPill,
        !isUnlocked ? { opacity: 0.42 } : null,
        isUnlocked && isFeatured ? styles.markPillFeatured : null,
        containerAnimatedStyle,
      ]}
    >
      <View style={styles.markPillContentRow}>
        <MobileAnimatedMarkGlyph
          markId={markId}
          motion={motion}
          isUnlocked={isUnlocked}
          isFeatured={isFeatured}
          size={18}
          frameStyle={styles.markPillIconFrame}
          featuredFrameStyle={styles.markPillIconFrameFeatured}
        />
        <Text
          style={[
            styles.markPillText,
            !isUnlocked ? { color: '#8e8b84' } : null,
            isUnlocked && isFeatured ? styles.markPillFeaturedText : null,
          ]}
        >
          {title}
        </Text>
      </View>
    </Animated.View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={PRESSABLE_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title} detayini ac`}
    >
      {content}
    </Pressable>
  );
};

const MOBILE_MARK_DETAIL_COPY: Record<
  MobileSettingsLanguage,
  {
    eyebrow: string;
    requirement: string;
    whisper: string;
    unlocked: string;
    locked: string;
    featured: string;
    close: string;
    empty: string;
  }
> = {
  tr: {
    eyebrow: 'Mark Detayi',
    requirement: 'Nasil kazanilir',
    whisper: 'Kisa not',
    unlocked: 'Acik',
    locked: 'Kilitli',
    featured: 'Vitrin',
    close: 'Kapat',
    empty: 'Bu mark icin aciklama yakinda eklenecek.',
  },
  en: {
    eyebrow: 'Mark Detail',
    requirement: 'How to earn',
    whisper: 'Whisper',
    unlocked: 'Unlocked',
    locked: 'Locked',
    featured: 'Featured',
    close: 'Close',
    empty: 'Details for this mark will appear soon.',
  },
  es: {
    eyebrow: 'Detalle de Marca',
    requirement: 'Como se gana',
    whisper: 'Susurro',
    unlocked: 'Desbloqueada',
    locked: 'Bloqueada',
    featured: 'Destacada',
    close: 'Cerrar',
    empty: 'Los detalles de esta marca apareceran pronto.',
  },
  fr: {
    eyebrow: 'Detail de Marque',
    requirement: 'Comment lobtenir',
    whisper: 'Chuchotement',
    unlocked: 'Debloquee',
    locked: 'Verrouillee',
    featured: 'En vitrine',
    close: 'Fermer',
    empty: 'Les details de cette marque arrivent bientot.',
  },
};

const MobileMarkDetailModal = ({
  mark,
  language = 'tr',
  isUnlocked,
  isFeatured,
  onClose,
}: {
  mark: ReturnType<typeof resolveMobileMarkMeta> | null;
  language?: MobileSettingsLanguage;
  isUnlocked: boolean;
  isFeatured: boolean;
  onClose: () => void;
}) => {
  useWebModalFocusReset(Boolean(mark));
  if (!mark) return null;

  const copy = MOBILE_MARK_DETAIL_COPY[language] || MOBILE_MARK_DETAIL_COPY.tr;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>{copy.eyebrow}</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>{copy.close}</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalSheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContentSurface}>
              <View style={styles.markDetailHero}>
                <MobileAnimatedMarkGlyph
                  markId={mark.id}
                  motion={mark.motion}
                  isUnlocked={isUnlocked}
                  isFeatured={isFeatured}
                  size={54}
                  frameStyle={styles.markDetailGlyphFrame}
                  featuredFrameStyle={styles.markDetailGlyphFrameFeatured}
                />
              </View>
              <Text style={styles.sectionLeadEyebrow}>{mark.categoryLabel}</Text>
              <Text style={styles.sectionLeadTitle}>{mark.title}</Text>

              <View style={styles.sectionLeadBadgeRow}>
                <View
                  style={[
                    styles.sectionLeadBadge,
                    isUnlocked ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted,
                  ]}
                >
                  <Text style={styles.sectionLeadBadgeText}>
                    {isUnlocked ? copy.unlocked : copy.locked}
                  </Text>
                </View>
                {isFeatured ? (
                  <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeClay]}>
                    <Text style={styles.sectionLeadBadgeText}>{copy.featured}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.subSectionLabel}>{copy.requirement}</Text>
              <Text style={styles.movieDetailBody}>{mark.description || copy.empty}</Text>

              {mark.whisper ? (
                <>
                  <Text style={styles.subSectionLabel}>{copy.whisper}</Text>
                  <Text style={styles.movieDetailCast}>{mark.whisper}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.modalActionStack}>
              <UiButton label={copy.close} tone="neutral" stretch onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

type ProfileActivitySurfaceState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  items: MobileProfileActivityItem[];
};

const buildProfileArchiveMovie = (film: {
  key: string;
  title: string;
  posterPath: string | null;
  year: number | null;
  lastDate: string;
  count: number;
}): MobileWatchedMovie => ({
  id: film.key,
  movieTitle: film.title,
  posterPath: film.posterPath,
  year: film.year,
  watchedAt: film.lastDate || new Date().toISOString(),
  watchedDayKey: film.lastDate || '-',
  watchCount: film.count,
  source: 'ritual',
});

const ProfileUnifiedCard = ({
  state,
  isSignedIn,
  isShareHubActive = false,
  displayName,
  avatarUrl,
  username,
  bio,
  birthDateLabel,
  genderLabel,
  profileLink,
  onOpenSettings,
  onOpenProfileLink,
  onOpenShareHub,
  language = 'tr',
}: {
  state: ProfileState;
  isSignedIn: boolean;
  isShareHubActive?: boolean;
  displayName: string;
  avatarUrl?: string;
  username?: string;
  bio?: string;
  birthDateLabel?: string;
  genderLabel?: string;
  profileLink?: string;
  language?: MobileSettingsLanguage;
  onOpenSettings?: () => void;
  onOpenProfileLink?: () => void;
  onOpenShareHub?: () => void;
}) => {
  const copy = language === 'tr'
    ? {
        observer: 'Gozlemci',
        bioFallback: 'Profil notunu ayarlardan duzenleyerek sahneni netlestirebilirsin.',
        lastLeague: 'Son Lig',
        pending: 'Beklemede',
        gender: 'Cinsiyet',
        birth: 'Dogum',
        headerEyebrow: 'Profil Merkezi',
        signedOutBody: 'Profil, lig ve streak katmanlarini gorebilmek icin oturum ac.',
        settingsA11y: 'Profil ayarlarini ac',
        identityLayer: 'Kimlik Katmani',
        handleMissing: 'Handle eklenmedi',
        identityOptional: 'Dogum ve cinsiyet alanlari opsiyonel.',
        linkA11y: 'Profil linkini ac',
        profileSync: 'Profil sync',
        handleWaiting: 'handle bekliyor',
        linkReady: 'link hazir',
        linkMissing: 'link yok',
        shareOpen: 'paylasim acik',
        sharePending: 'paylasim beklemede',
        comments: 'Yorum',
        streak: 'Seri',
        following: 'Takip',
        followers: 'Takipci',
        marks: 'Mark',
        activeDays: 'Aktif Gun',
        openLink: 'Linki Ac',
        shareHub: 'Paylasim Hubi',
        shareOpenButton: 'Paylasim Acik',
        xpSection: 'XP ve Lig Rotasi',
        xpRemaining: (label: string, xp: number) => `${label} icin ${xp} XP kaldi.`,
        topLeague: 'Su an erisilebilir en ust ligdesin.',
        currentLeague: 'Bulundugun Lig',
        nextLeague: 'Siradaki Lig',
        totalXp: 'Toplam XP',
        inLeague: 'Bu Ligde',
        fill: 'Doluluk',
      }
    : language === 'fr'
    ? {
        observer: 'Observateur',
        bioFallback: 'Modifie ta note de profil dans les paramètres pour clarifier ta scène.',
        lastLeague: 'Dernière Ligue',
        pending: 'En attente',
        gender: 'Genre',
        birth: 'Naissance',
        headerEyebrow: 'Centre de Profil',
        signedOutBody: 'Connecte-toi pour voir ton profil, ta ligue et tes séries.',
        settingsA11y: 'Ouvrir les paramètres du profil',
        identityLayer: 'Couche d\'identité',
        handleMissing: 'Pseudo non ajouté',
        identityOptional: 'La date de naissance et le genre sont optionnels.',
        linkA11y: 'Ouvrir le lien du profil',
        profileSync: 'Sync du profil',
        handleWaiting: 'pseudo en attente',
        linkReady: 'lien prêt',
        linkMissing: 'pas de lien',
        shareOpen: 'partage actif',
        sharePending: 'partage en attente',
        comments: 'Commentaires',
        streak: 'Série',
        following: 'Abonnements',
        followers: 'Abonnés',
        marks: 'Marques',
        activeDays: 'Jours Actifs',
        openLink: 'Ouvrir le Lien',
        shareHub: 'Hub de Partage',
        shareOpenButton: 'Partage Actif',
        xpSection: 'XP et Parcours de Ligue',
        xpRemaining: (label: string, xp: number) => `${xp} XP restants pour ${label}.`,
        topLeague: 'Tu es déjà dans la ligue la plus haute accessible.',
        currentLeague: 'Ligue Actuelle',
        nextLeague: 'Ligue Suivante',
        totalXp: 'XP Total',
        inLeague: 'Dans cette Ligue',
        fill: 'Remplissage',
      }
    : {
        observer: 'Observer',
        bioFallback: 'Refine your profile note in settings to clarify your scene.',
        lastLeague: 'Last League',
        pending: 'Pending',
        gender: 'Gender',
        birth: 'Birth',
        headerEyebrow: 'Profile Center',
        signedOutBody: 'Sign in to view your profile, league, and streak layers.',
        settingsA11y: 'Open profile settings',
        identityLayer: 'Identity Layer',
        handleMissing: 'Handle not added',
        identityOptional: 'Birth date and gender fields are optional.',
        linkA11y: 'Open profile link',
        profileSync: 'Profile sync',
        handleWaiting: 'handle pending',
        linkReady: 'link ready',
        linkMissing: 'no link',
        shareOpen: 'share live',
        sharePending: 'share pending',
        comments: 'Comments',
        streak: 'Streak',
        following: 'Following',
        followers: 'Followers',
        marks: 'Marks',
        activeDays: 'Active Days',
        openLink: 'Open Link',
        shareHub: 'Share Hub',
        shareOpenButton: 'Share Live',
        xpSection: 'XP and League Route',
        xpRemaining: (label: string, xp: number) => `${xp} XP left for ${label}.`,
        topLeague: 'You are already in the highest reachable league.',
        currentLeague: 'Current League',
        nextLeague: 'Next League',
        totalXp: 'Total XP',
        inLeague: 'In This League',
        fill: 'Fill',
      };
  const normalizedDisplayName = String(displayName || '').trim() || copy.observer;
  const normalizedAvatarUrl = String(avatarUrl || '').trim();
  const normalizedUsername = String(username || '').trim().replace(/^@+/, '');
  const normalizedBio = String(bio || '').trim() || copy.bioFallback;
  const normalizedBirthDate = String(birthDateLabel || '').trim();
  const normalizedGender = String(genderLabel || '').trim();
  const normalizedLink = String(profileLink || '').trim();
  const hasLink = Boolean(normalizedLink);
  const hasShareHubAction = typeof onOpenShareHub === 'function';
  const isProfileReady = state.status === 'success';
  const totalXp = isProfileReady ? Math.max(0, Math.floor(Number(state.totalXp || 0))) : 0;
  const progress = resolveMobileLeagueProgress(totalXp);
  const currentLevelXp = Math.max(0, totalXp - progress.currentLevelStart);
  const xpToNext = Math.max(0, Math.floor(progress.nextLevelXp - totalXp));
  const currentLeagueLabel = isProfileReady
    ? resolveLocalizedLeagueDisplayName(language, state.leagueKey, state.leagueName)
    : copy.profileSync;
  const nextLeagueLabel = isProfileReady
    ? resolveLocalizedLeagueDisplayName(language, state.nextLeagueKey, state.nextLeagueName) || copy.lastLeague
    : copy.pending;
  const progressPercentLabel = Math.round(progress.progressPercentage);
  const fillHeadColor = getProgressHeadColor(progress.progressPercentage);
  const fillTailColor = getProgressTailColor(progress.progressPercentage);
  const effectiveProgressWidth =
    progress.progressPercentage > 0 ? Math.max(progress.progressPercentage, 3) : 0;
  // League color for avatar border and XP bar
  // Use leagueColor directly from state; guard against Absolute (#000) and Eternal (#fff) extremes
  const rawLeagueColor = state.status === 'success' ? state.leagueColor : null;
  const leagueAccentColor =
    rawLeagueColor && rawLeagueColor !== '#000000' && rawLeagueColor !== '#FFFFFF'
      ? rawLeagueColor
      : fillHeadColor;
  const avatarBorderColor =
    rawLeagueColor && rawLeagueColor !== '#000000' && rawLeagueColor !== '#FFFFFF'
      ? `${rawLeagueColor}CC`
      : 'rgba(255,255,255,0.12)';
  // XP bar entrance animation
  const xpBarOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(xpBarOpacity, {
      toValue: 1,
      duration: 500,
      delay: 150,
      useNativeDriver: SUPPORTS_NATIVE_DRIVER,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const identityMeta = [
    normalizedGender ? `${copy.gender}: ${normalizedGender}` : '',
    normalizedBirthDate ? `${copy.birth}: ${normalizedBirthDate}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <ScreenCard accent="sage">
      {/* Settings gear — top right, absolutely positioned */}
      {onOpenSettings ? (
        <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
          <Pressable
            style={({ pressed }) => [
              styles.profileSettingsButton,
              pressed && { opacity: 0.55, transform: [{ scale: 0.88 }] },
            ]}
            onPress={onOpenSettings}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={copy.settingsA11y}
          >
            <Ionicons name="settings-sharp" size={18} color="#E5E4E2" />
          </Pressable>
        </View>
      ) : null}

      {/* ── Hero row: Avatar | Name+Handle+League | Streak ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 }}>
        {/* Avatar — enlarged to 96px */}
        <View
          style={[
            styles.profileIdentityAvatarWrap,
            { width: 96, height: 96, borderColor: avatarBorderColor, borderWidth: 2 },
          ]}
        >
          {normalizedAvatarUrl ? (
            <Image source={{ uri: normalizedAvatarUrl }} style={styles.profileIdentityAvatarImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.profileIdentityAvatarFallback, { color: leagueAccentColor, fontSize: 32 }]}>
              {(normalizedDisplayName.slice(0, 1) || 'O').toUpperCase()}
            </Text>
          )}
        </View>

        {/* Middle: Name, handle, bio, league chip */}
        <View style={{ flex: 1, gap: 3, paddingRight: 8 }}>
          <Text style={styles.sectionLeadTitle} numberOfLines={1}>{normalizedDisplayName}</Text>
          {normalizedUsername ? (
            <Text style={[styles.sectionLeadBody, { fontSize: 12 }]}>@{normalizedUsername}</Text>
          ) : null}
          {isSignedIn && normalizedBio && normalizedBio !== copy.bioFallback ? (
            <Text style={[styles.sectionLeadBody, { fontSize: 12 }]} numberOfLines={2}>{normalizedBio}</Text>
          ) : null}
          {identityMeta ? (
            <Text style={[styles.sectionLeadBody, { fontSize: 11, color: '#6e6b64' }]}>{identityMeta}</Text>
          ) : null}
          {/* League identity chip */}
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 5,
              backgroundColor: `${leagueAccentColor}22`,
              borderColor: `${leagueAccentColor}55`,
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: leagueAccentColor, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {'✦ '}{isProfileReady ? currentLeagueLabel : copy.profileSync}
            </Text>
          </View>
        </View>

        {/* Right: Streak hero block */}
        {isProfileReady && state.streak > 0 ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,149,0,0.1)',
              borderColor: 'rgba(255,149,0,0.28)',
              borderWidth: 1,
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              minWidth: 58,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#FF9500', lineHeight: 32 }}>
              {state.streak}
            </Text>
            <Text style={{ fontSize: 9, color: '#FF9500', fontWeight: '700', letterSpacing: 0.6, marginTop: 2, textTransform: 'uppercase' }}>
              🔥 {copy.streak}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── XP Bar — prominent, full width ── */}
      <View style={{ gap: 6, marginTop: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: leagueAccentColor, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
            {isProfileReady ? currentLeagueLabel : '—'}
          </Text>
          <Text style={{ color: '#8e8b84', fontSize: 11 }}>
            {isProfileReady
              ? state.nextLeagueName
                ? `${xpToNext} XP → ${nextLeagueLabel}`
                : copy.topLeague
              : '—'}
          </Text>
        </View>
        <Animated.View style={[styles.profileXpTrack, { opacity: xpBarOpacity }]}>
          {effectiveProgressWidth > 0 ? (
            <View style={[styles.profileXpFill, { width: `${effectiveProgressWidth}%`, backgroundColor: `${leagueAccentColor}55` }]}>
              <View style={[styles.profileXpFillHeadTint, { backgroundColor: leagueAccentColor }]} />
              <View style={styles.profileXpFillSpark} />
            </View>
          ) : null}
        </Animated.View>
        <View style={styles.profileXpScaleRow}>
          <Text style={styles.profileXpScaleText}>{`${progress.currentLevelStart} XP`}</Text>
          <Text style={styles.profileXpScaleText}>{`${progress.nextLevelXp} XP`}</Text>
        </View>
      </View>

      {/* ── Stats — 4 items in one row (streak lives in hero) ── */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {[
          { label: copy.comments, value: isProfileReady ? String(state.ritualsCount) : '--' },
          { label: copy.following, value: isProfileReady ? String(state.followingCount) : '--' },
          { label: copy.marks, value: isProfileReady ? String(state.marks.length) : '--' },
          { label: copy.activeDays, value: isProfileReady ? String(state.daysPresent) : '--' },
        ].map((stat) => (
          <View key={stat.label} style={[styles.detailInfoCard, { flex: 1, minWidth: 0 }]}>
            <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]} numberOfLines={2}>{stat.label}</Text>
            <Text style={styles.detailInfoValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* ── Badge row: handle · link · share ── */}
      <View style={[styles.sectionLeadBadgeRow, { marginTop: 10 }]}>
        <View style={[styles.sectionLeadBadge, normalizedUsername ? styles.sectionLeadBadgeMuted : styles.sectionLeadBadgeClay]}>
          <Text style={styles.sectionLeadBadgeText}>
            {normalizedUsername ? `@${normalizedUsername}` : copy.handleWaiting}
          </Text>
        </View>
        <View style={[styles.sectionLeadBadge, hasLink ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted]}>
          <Text style={styles.sectionLeadBadgeText}>{hasLink ? copy.linkReady : copy.linkMissing}</Text>
        </View>
        {hasShareHubAction ? (
          <View style={[styles.sectionLeadBadge, isShareHubActive ? styles.sectionLeadBadgeClay : styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>{isShareHubActive ? copy.shareOpen : copy.sharePending}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Link / Share actions ── */}
      {hasLink || hasShareHubAction ? (
        <View style={[styles.sectionLeadActionRow, { marginTop: 6 }]}>
          {hasLink ? (
            <UiButton label={copy.openLink} tone="teal" onPress={() => onOpenProfileLink?.()} disabled={!isSignedIn} />
          ) : null}
          {hasShareHubAction ? (
            <UiButton
              label={isShareHubActive ? copy.shareOpenButton : copy.shareHub}
              tone="neutral"
              onPress={() => onOpenShareHub?.()}
              disabled={!isSignedIn}
            />
          ) : null}
        </View>
      ) : null}

      {/* ── XP detail cards ── */}
      <View style={[styles.profileUnifiedDivider, { marginTop: 12 }]} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={[styles.detailInfoCard, { flex: 1, minWidth: 0 }]}>
          <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{copy.totalXp}</Text>
          <Text style={styles.detailInfoValue}>{isProfileReady ? `${totalXp} XP` : '--'}</Text>
        </View>
        <View style={[styles.detailInfoCard, { flex: 1, minWidth: 0 }]}>
          <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{copy.inLeague}</Text>
          <Text style={styles.detailInfoValue}>{isProfileReady ? `${currentLevelXp} XP` : '--'}</Text>
        </View>
        <View style={[styles.detailInfoCard, { flex: 1, minWidth: 0 }]}>
          <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{copy.fill}</Text>
          <Text style={styles.detailInfoValue}>{isProfileReady ? `%${progressPercentLabel}` : '--'}</Text>
        </View>
      </View>
    </ScreenCard>
  );
};

const ProfileCinematicCard = ({
  state,
  isSignedIn,
  activityState,
}: {
  state: ProfileState;
  isSignedIn: boolean;
  activityState: ProfileActivitySurfaceState;
}) => {
  const genreSignals = useMemo(
    () => buildProfileGenreDistribution(activityState.items, 12),
    [activityState.items]
  );
  const topGenres = useMemo(() => genreSignals.slice(0, 3), [genreSignals]);
  const totalGenres = useMemo(
    () => genreSignals.reduce((sum, item) => sum + item.count, 0),
    [genreSignals]
  );
  const hiddenGemCount = useMemo(
    () => countProfileHiddenGemSignals(activityState.items),
    [activityState.items]
  );
  const exact180Count = useMemo(
    () => countProfileExactCommentSignals(activityState.items),
    [activityState.items]
  );
  const streakValue = state.status === 'success' ? state.streak : 0;
  const dnaSegments = useMemo(
    () =>
      buildProfileDnaSegments({
        genreItems: topGenres,
        hiddenGemCount,
        exactCommentCount: exact180Count,
        streak: streakValue,
        uniqueGenreCount: genreSignals.length,
      }),
    [exact180Count, genreSignals.length, hiddenGemCount, streakValue, topGenres]
  );
  const unlockedCount = dnaSegments.filter((segment) => segment.unlocked).length;

  if (!isSignedIn) {
    return (
      <StatePanel
        tone="clay"
        variant="empty"
        eyebrow="Cinematic DNA"
        title="DNA katmani icin giris yap"
        body="Web profilindeki tur ve ritim katmani mobil profilde de ayni hesapla acilir."
      />
    );
  }

  if (activityState.status !== 'ready' && activityState.items.length === 0) {
    return (
      <StatePanel
        tone="sage"
        variant={activityState.status === 'loading' ? 'loading' : activityState.status === 'error' ? 'error' : 'empty'}
        eyebrow="Cinematic DNA"
        title={
          activityState.status === 'loading'
            ? 'DNA sinyali yukleniyor'
            : activityState.status === 'error'
              ? 'DNA sinyali okunamadi'
              : 'DNA sinyali beklemede'
        }
        body={
          activityState.status === 'error'
            ? activityState.message || 'Profil aktivitesi okunurken gecici bir sorun olustu.'
            : 'Yorumlar geldikce baskin turler ve unlock segmentleri burada cikar.'
        }
      />
    );
  }

  if (topGenres.length === 0) {
    return (
      <StatePanel
        tone="sage"
        variant="empty"
        eyebrow="Cinematic DNA"
        title="Henuz DNA izi olusmadi"
        body="Farkli turlerde yorum biraktikca web ile ayni DNA segmentleri burada dolacak."
        meta="Ilk uc tur ve unlock ilerlemesi otomatik hesaplanir."
      />
    );
  }

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Cinematic DNA"
        title={topGenres[0]?.genre || 'DNA sinyali'}
        body="Web profilindeki baskin tur, gizli cevher ve ritim mantigi mobile da ayni domain kuraliyla hesaplanir."
        badges={[
          { label: `${genreSignals.length} tur`, tone: 'sage' },
          { label: `${hiddenGemCount} hidden gem`, tone: hiddenGemCount > 0 ? 'muted' : 'clay' },
          { label: `${exact180Count} exact-180`, tone: exact180Count > 0 ? 'clay' : 'muted' },
        ]}
        metrics={[
          { label: 'Streak', value: String(streakValue) },
          { label: 'Tur', value: String(genreSignals.length) },
          { label: 'Acilan', value: String(unlockedCount) },
        ]}
      />

      <ScreenCard accent="sage">
        <Text style={styles.subSectionLabel}>Baskin Turler</Text>
        <View style={styles.profileDnaChart}>
          {topGenres.map((genreEntry) => {
            const percentage = totalGenres > 0 ? genreEntry.count / totalGenres : 0;
            const height = Math.max(22, percentage * 100);
            return (
              <View key={`profile-dna-${genreEntry.genre}`} style={styles.profileDnaBarColumn}>
                <View style={styles.profileDnaBarTrack}>
                  <View style={[styles.profileDnaBarFill, { height: `${height}%` }]}>
                    <View style={styles.profileDnaBarGlow} />
                  </View>
                </View>
                <Text style={styles.profileDnaBarLabel}>{genreEntry.genre}</Text>
                <Text style={styles.profileDnaBarMeta}>{Math.round(percentage * 100)}%</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.profileDnaSegmentGrid}>
          {dnaSegments.map((segment) => (
            <View
              key={segment.id}
              style={[
                styles.profileDnaSegmentCard,
                segment.unlocked ? styles.profileDnaSegmentCardUnlocked : null,
              ]}
            >
              <View style={styles.profileDnaSegmentHeader}>
                <Text
                  style={[
                    styles.profileDnaSegmentLabel,
                    segment.unlocked ? styles.profileDnaSegmentLabelUnlocked : null,
                  ]}
                >
                  {segment.label}
                </Text>
                <Text
                  style={[
                    styles.profileDnaSegmentState,
                    segment.unlocked ? styles.profileDnaSegmentStateUnlocked : null,
                  ]}
                >
                  {segment.unlocked ? 'Unlocked' : 'Tracking'}
                </Text>
              </View>
              <Text style={styles.profileDnaSegmentDetail}>{segment.detail}</Text>
            </View>
          ))}
        </View>
      </ScreenCard>
    </>
  );
};

const ProfileActivityCard = ({
  isSignedIn,
  activityState,
  shareCommentPreview,
  canShareComment,
  canShareStreak,
  streakValue,
  onOpenShareHub,
  onOpenMovieArchive,
}: {
  isSignedIn: boolean;
  activityState: ProfileActivitySurfaceState;
  shareCommentPreview: string;
  canShareComment: boolean;
  canShareStreak: boolean;
  streakValue: number;
  onOpenShareHub: () => void;
  onOpenMovieArchive: (movie: MobileWatchedMovie) => void;
}) => {
  const genreSignals = useMemo(
    () => buildProfileGenreDistribution(activityState.items, 12),
    [activityState.items]
  );
  const filmSummaries = useMemo(
    () => buildProfileFilmSummaries(activityState.items, 8),
    [activityState.items]
  );
  const pulse = useMemo(
    () =>
      buildProfileActivityPulse({
        records: activityState.items,
        genreItems: genreSignals,
        filmSummaries,
      }),
    [activityState.items, filmSummaries, genreSignals]
  );

  if (!isSignedIn) {
    return (
      <StatePanel
        tone="clay"
        variant="empty"
        eyebrow="Activity Pulse"
        title="Aktivite katmani icin giris yap"
        body="Yorum, film gunlugu ve paylasim bonusi web profilindeki gibi hesabina bagli calisir."
      />
    );
  }

  if (activityState.status !== 'ready' && activityState.items.length === 0) {
    return (
      <StatePanel
        tone="clay"
        variant={activityState.status === 'loading' ? 'loading' : activityState.status === 'error' ? 'error' : 'empty'}
        eyebrow="Activity Pulse"
        title={
          activityState.status === 'loading'
            ? 'Aktivite nabzi yukleniyor'
            : activityState.status === 'error'
              ? 'Aktivite nabzi okunamadi'
              : 'Aktivite nabzi beklemede'
        }
        body={
          activityState.status === 'error'
            ? activityState.message || 'Profil aktiviteleri gecici olarak acilamadi.'
            : 'Yorumlar geldikce yorum, film ve paylasim ozetleri burada toplanir.'
        }
      />
    );
  }

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Activity Pulse"
        title={pulse.mostCommented === 'No records' ? 'Profil Akisi' : pulse.mostCommented}
        body="Web profilindeki yorum, film, baskin tur ve most-commented ozetleri artik mobile da ayni hesapla ilerliyor."
        badges={[
          { label: `${pulse.commentsCount} yorum`, tone: 'sage' },
          { label: `${pulse.filmsCount} film`, tone: 'muted' },
          { label: canShareComment ? 'paylasim hazir' : 'paylasim kilitli', tone: canShareComment ? 'clay' : 'muted' },
        ]}
        metrics={[
          { label: 'Yorum', value: String(pulse.commentsCount) },
          { label: 'Film', value: String(pulse.filmsCount) },
          { label: 'Tur', value: pulse.topGenre === 'No records' ? '--' : pulse.topGenre },
          { label: 'Streak', value: String(streakValue) },
        ]}
        actions={[
          {
            label: canShareComment ? 'Paylasim Bonusu' : 'Paylasim Hubi',
            tone: 'teal',
            onPress: onOpenShareHub,
          },
        ]}
      />

      {activityState.status === 'error' ? (
        <StatusStrip
          tone="clay"
          eyebrow="Activity Sync"
          title="Aktivite verisi kismi geldi"
          body={activityState.message}
          meta="Gorunen kartlar eldeki son gecerli veriden uretiliyor."
        />
      ) : null}

      <ScreenCard accent="clay">
        <Text style={styles.subSectionLabel}>Paylasim Bonusu</Text>
        <Text style={styles.screenMeta}>
          {canShareComment
            ? 'Bugunun yorumu web ile ayni bonus mantigi uzerinden paylasima hazir.'
            : 'Bugunun yorumunu tamamlayinca yorum ve streak paylasimi birlikte acilacak.'}
        </Text>

        <View style={styles.profileSharePreviewCard}>
          <Text style={styles.profileSharePreviewEyebrow}>
            {canShareComment ? 'YORUM MODU' : 'KILITLI'}
          </Text>
          <Text style={styles.profileSharePreviewBody}>
            {canShareComment
              ? `"${shareCommentPreview}"`
              : 'Paylasim bonusunu acmak icin bugunun yorumunu tamamla.'}
          </Text>
          <Text style={styles.profileSharePreviewMeta}>
            {canShareStreak
              ? `Streak paylasimi da hazir: ${streakValue} gun`
              : 'Streak paylasimi icin once bugunku yorum gerekli.'}
          </Text>
        </View>

        <UiButton
          label={canShareComment ? 'Paylasim Hubini Ac' : 'Paylasim Hazirla'}
          tone="neutral"
          stretch
          onPress={onOpenShareHub}
        />
      </ScreenCard>

      {filmSummaries.length > 0 ? (
        <ScreenCard accent="sage">
          <Text style={styles.subSectionLabel}>Film Gunlugu</Text>
          <View style={styles.profileArchiveList}>
            {filmSummaries.map((film) => {
              const posterUrl = resolvePosterUrl(film.posterPath);
              return (
                <Pressable
                  key={film.key}
                  style={({ pressed }) => [
                    styles.profileArchiveRow,
                    pressed ? styles.profileArchiveRowPressed : null,
                  ]}
                  onPress={() => onOpenMovieArchive(buildProfileArchiveMovie(film))}
                  hitSlop={PRESSABLE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`${film.title} film gunlugu detayini ac`}
                >
                  <View style={styles.profileArchivePosterWrap}>
                    {posterUrl ? (
                      <Image
                        source={{ uri: posterUrl }}
                        style={styles.profileArchivePosterImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.profileArchivePosterFallback}>
                        {(film.title.slice(0, 1) || 'F').toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.profileArchiveRowCopy}>
                    <Text style={styles.profileArchiveTitle}>{film.title}</Text>
                    <Text style={styles.profileArchiveMeta}>
                      {film.year ? `${film.year} | ` : ''}
                      {film.count} yorum | Son: {film.lastDate || '-'}
                    </Text>
                    <Text style={styles.profileArchiveHint}>Yorum arsivini ac</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScreenCard>
      ) : (
        <StatePanel
          tone="sage"
          variant="empty"
          eyebrow="Film Gunlugu"
          title="Henuz film izi yok"
          body="Yorum yazdikca en cok dondugun filmler ve arsiv baglantilari burada toplanir."
        />
      )}
    </>
  );
};
const ProfileMarksCard = ({
  state,
  isSignedIn,
  language = 'tr',
  mode = 'all',
}: {
  state: ProfileState;
  isSignedIn: boolean;
  language?: MobileSettingsLanguage;
  mode?: 'all' | 'unlocked';
}) => {
  const unlockedMarks = state.status === 'success' ? state.marks : [];
  const featuredMarks = state.status === 'success' ? state.featuredMarks : [];
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const unlockedSet = useMemo(() => new Set(unlockedMarks), [unlockedMarks]);
  const groupedUnlockedMarks = useMemo(
    () => groupMobileMarksByCategory(unlockedMarks, language),
    [language, unlockedMarks]
  );
  const groupedCatalogMarks = useMemo(
    () => groupMobileMarksByCategory(MOBILE_MARK_CATALOG.map((mark) => mark.id), language),
    [language]
  );
  const topFeaturedTitle = featuredMarks[0]
    ? resolveMobileMarkTitle(featuredMarks[0], language)
    : '';
  const activeMark = activeMarkId ? resolveMobileMarkMeta(activeMarkId, language) : null;
  const visibleGroups = mode === 'unlocked' ? groupedUnlockedMarks : groupedCatalogMarks;
  const copy =
    language === 'tr'
      ? {
          eyebrow: 'Marklar',
          titleUnlocked: 'Acik Marklar',
          titleAll: 'Mark Arsivi',
          bodyUnlocked: 'Kazandigin marklar burada.',
          bodyAll: 'Tum marklar tek yerde.',
          unlockedBadgeSuffix: 'acik',
          featuredBadgeSuffix: 'vitrin',
          totalBadgeSuffix: 'toplam',
          metricUnlocked: 'Acik',
          metricFeatured: 'Vitrin',
          metricGroups: 'Grup',
          signInTitle: 'Marklar icin giris yap',
          signInBody: 'Koleksiyon ve vitrin oturumla acilir.',
          loadingTitle: 'Marklar yukleniyor',
          loadingBody: 'Biraz bekle.',
          unavailableTitle: 'Mark verisi hazir degil',
          unavailableBody: 'Yeni marklar geldikce burada gorunur.',
          showcaseEyebrow: 'Vitrin',
          featuredCount: (count: number) => `${count} vitrin`,
          showcaseFallback: 'Secili marklar hazir.',
          emptyUnlockedTitle: 'Henuz acik mark yok',
          emptyUnlockedBody: 'Yeni yorumlar ve streak ile koleksiyon dolacak.',
          sectionUnlocked: 'Kazanilan Marklar',
          sectionAll: 'Tum Marklar',
          detailA11ySuffix: 'mark detayini ac',
        }
      : language === 'es'
        ? {
            eyebrow: 'Marcas',
            titleUnlocked: 'Marcas Desbloqueadas',
            titleAll: 'Archivo de Marcas',
            bodyUnlocked: 'Las marcas que ganaste se reunen aqui.',
            bodyAll: 'Todas las marcas en un solo lugar.',
            unlockedBadgeSuffix: 'desbloqueadas',
            featuredBadgeSuffix: 'destacadas',
            totalBadgeSuffix: 'total',
            metricUnlocked: 'Desbloqueadas',
            metricFeatured: 'Destacadas',
            metricGroups: 'Grupos',
            signInTitle: 'Inicia sesion para ver las marcas',
            signInBody: 'La coleccion y la vitrina se abren despues de iniciar sesion.',
            loadingTitle: 'Cargando marcas',
            loadingBody: 'Espera un momento.',
            unavailableTitle: 'Los datos de marcas no estan listos',
            unavailableBody: 'Las nuevas marcas apareceran aqui.',
            showcaseEyebrow: 'Vitrina',
            featuredCount: (count: number) => `${count} destacadas`,
            showcaseFallback: 'Las marcas destacadas estan listas.',
            emptyUnlockedTitle: 'Todavia no hay marcas desbloqueadas',
            emptyUnlockedBody: 'Los nuevos comentarios y la racha llenaran tu coleccion.',
            sectionUnlocked: 'Marcas Desbloqueadas',
            sectionAll: 'Todas las Marcas',
            detailA11ySuffix: 'abrir detalle de marca',
          }
      : language === 'fr'
        ? {
            eyebrow: 'Marques',
            titleUnlocked: 'Marques Debloquees',
            titleAll: 'Archive des Marques',
            bodyUnlocked: 'Les marques gagnees sont regroupees ici.',
            bodyAll: 'Toutes les marques au meme endroit.',
            unlockedBadgeSuffix: 'debloquees',
            featuredBadgeSuffix: 'vitrine',
            totalBadgeSuffix: 'total',
            metricUnlocked: 'Debloquees',
            metricFeatured: 'Vitrine',
            metricGroups: 'Groupes',
            signInTitle: 'Connecte-toi pour voir les marques',
            signInBody: 'La collection et la vitrine s ouvrent apres la connexion.',
            loadingTitle: 'Chargement des marques',
            loadingBody: 'Patiente un instant.',
            unavailableTitle: 'Les donnees des marques ne sont pas pretes',
            unavailableBody: 'Les nouvelles marques apparaitront ici.',
            showcaseEyebrow: 'Vitrine',
            featuredCount: (count: number) => `${count} en vitrine`,
            showcaseFallback: 'Les marques mises en avant sont pretes.',
            emptyUnlockedTitle: 'Aucune marque debloquee pour le moment',
            emptyUnlockedBody: 'Les nouveaux commentaires et la serie rempliront la collection.',
            sectionUnlocked: 'Marques Debloquees',
            sectionAll: 'Toutes les Marques',
            detailA11ySuffix: 'ouvrir le detail de la marque',
          }
      : {
          eyebrow: 'Marks',
          titleUnlocked: 'Unlocked Marks',
          titleAll: 'Marks Archive',
          bodyUnlocked: 'The marks you earned are gathered here.',
          bodyAll: 'Every mark in one place.',
          unlockedBadgeSuffix: 'unlocked',
          featuredBadgeSuffix: 'featured',
          totalBadgeSuffix: 'total',
          metricUnlocked: 'Unlocked',
          metricFeatured: 'Featured',
          metricGroups: 'Groups',
          signInTitle: 'Sign in to view marks',
          signInBody: 'Your collection and showcase open after sign-in.',
          loadingTitle: 'Loading marks',
          loadingBody: 'Please wait a moment.',
          unavailableTitle: 'Mark data is unavailable',
          unavailableBody: 'New marks will appear here as they arrive.',
          showcaseEyebrow: 'Showcase',
          featuredCount: (count: number) => `${count} featured`,
          showcaseFallback: 'Featured marks are ready.',
          emptyUnlockedTitle: 'No unlocked marks yet',
          emptyUnlockedBody: 'New comments and streak progress will fill your collection.',
          sectionUnlocked: 'Unlocked Marks',
          sectionAll: 'All Marks',
          detailA11ySuffix: 'open mark details',
        };

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow={copy.eyebrow}
        title={mode === 'unlocked' ? copy.titleUnlocked : copy.titleAll}
        body={mode === 'unlocked' ? copy.bodyUnlocked : copy.bodyAll}
        badges={[
          { label: `${unlockedMarks.length} ${copy.unlockedBadgeSuffix}`, tone: 'sage' },
          { label: `${featuredMarks.length} ${copy.featuredBadgeSuffix}`, tone: featuredMarks.length > 0 ? 'muted' : 'clay' },
          ...(mode === 'all' ? [{ label: `${MOBILE_MARK_CATALOG.length} ${copy.totalBadgeSuffix}`, tone: 'muted' as const }] : []),
        ]}
        metrics={[
          { label: copy.metricUnlocked, value: String(unlockedMarks.length) },
          { label: copy.metricFeatured, value: String(featuredMarks.length) },
          { label: copy.metricGroups, value: String(visibleGroups.length) },
        ]}
      />

      {!isSignedIn ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow={copy.eyebrow}
          title={copy.signInTitle}
          body={copy.signInBody}
        />
      ) : state.status !== 'success' ? (
        <StatePanel
          tone="sage"
          variant={state.status === 'loading' ? 'loading' : 'empty'}
          eyebrow={copy.eyebrow}
          title={state.status === 'loading' ? copy.loadingTitle : copy.unavailableTitle}
          body={state.status === 'loading' ? copy.loadingBody : copy.unavailableBody}
        />
      ) : (
        <>
          {featuredMarks.length > 0 ? (
            <StatusStrip
              tone="sage"
              eyebrow={copy.showcaseEyebrow}
              title={copy.featuredCount(featuredMarks.length)}
              body={topFeaturedTitle || copy.showcaseFallback}
            />
          ) : null}

          {featuredMarks.length > 0 ? (
            <ScreenCard accent="sage">
              <Text style={styles.subSectionLabel}>{copy.showcaseEyebrow}</Text>
              <View style={styles.markPillRow}>
                {featuredMarks.map((markId) => {
                  const markMeta = resolveMobileMarkMeta(markId, language);
                  return (
                    <MobileMarkPill
                      key={`featured-${markId}`}
                      markId={markId}
                      title={resolveMobileMarkTitle(markId, language)}
                      motion={markMeta.motion}
                      isUnlocked
                      isFeatured
                      onPress={() => setActiveMarkId(markId)}
                      accessibilityLabel={`${markMeta.title} ${copy.detailA11ySuffix}`}
                    />
                  );
                })}
              </View>
            </ScreenCard>
          ) : null}

          {mode === 'unlocked' && unlockedMarks.length === 0 ? (
            <StatePanel
              tone="sage"
              variant="empty"
              eyebrow={copy.eyebrow}
              title={copy.emptyUnlockedTitle}
              body={copy.emptyUnlockedBody}
            />
          ) : (
            <ScreenCard accent="sage">
              <Text style={styles.subSectionLabel}>
                {mode === 'unlocked' ? copy.sectionUnlocked : copy.sectionAll}
              </Text>
              <View style={styles.markCategoryList}>
                {visibleGroups.map((group) => (
                  <View key={`mark-category-${group.category}`} style={styles.markCategoryBlock}>
                    <Text style={styles.markCategoryTitle}>{group.label}</Text>
                    <View style={styles.markPillRow}>
                      {group.marks.map((mark) => {
                        const isUnlocked = mode === 'unlocked' ? true : unlockedSet.has(mark.id);
                        const isFeatured = featuredMarks.includes(mark.id);
                        return (
                          <MobileMarkPill
                            key={`mark-${mark.id}`}
                            markId={mark.id}
                            title={mark.title}
                            motion={mark.motion}
                            isUnlocked={isUnlocked}
                            isFeatured={isUnlocked && isFeatured}
                            onPress={() => setActiveMarkId(mark.id)}
                            accessibilityLabel={`${mark.title} ${copy.detailA11ySuffix}`}
                          />
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScreenCard>
          )}
        </>
      )}
      <MobileMarkDetailModal
        mark={activeMark}
        language={language}
        isUnlocked={Boolean(activeMarkId && unlockedSet.has(activeMarkId))}
        isFeatured={Boolean(activeMarkId && featuredMarks.includes(activeMarkId))}
        onClose={() => setActiveMarkId(null)}
      />
    </>
  );
};

const PushStatusCard = ({
  pushEnabled,
  state,
  testState,
  localSimState,
  isSignedIn,
  onRegister,
  onSendTest,
  onSimulateLocal,
}: {
  pushEnabled: boolean;
  state: PushState;
  testState: PushTestState;
  localSimState: LocalPushSimState;
  isSignedIn: boolean;
  onRegister: () => void;
  onSendTest: () => void;
  onSimulateLocal: () => void;
}) => {
  const isBusy = state.status === 'loading';
  const isTestBusy = testState.status === 'loading';
  const isLocalSimBusy = localSimState.status === 'loading';
  const stateTone =
    state.status === 'error'
      ? 'clay'
      : state.status === 'unsupported'
        ? 'muted'
        : state.cloudStatus === 'synced'
          ? 'sage'
          : 'muted';
  const tokenPreview =
    state.token.length > 20
      ? `${state.token.slice(0, 18)}...${state.token.slice(-10)}`
      : state.token || 'none';
  const deviceKeyPreview =
    state.deviceKey.length > 20
      ? `${state.deviceKey.slice(0, 12)}...${state.deviceKey.slice(-6)}`
      : state.deviceKey || 'none';
  const canSendTest = pushEnabled && isSignedIn && state.cloudStatus === 'synced' && !isBusy;
  const testTone =
    testState.status === 'error' ? 'clay' : testState.status === 'success' ? 'sage' : 'muted';
  const receiptTone =
    testState.receiptStatus === 'unavailable'
      ? 'clay'
      : testState.receiptStatus === 'ok'
        ? 'sage'
        : 'muted';
  const localTone =
    localSimState.status === 'error'
      ? 'clay'
      : localSimState.status === 'success'
        ? 'sage'
        : 'muted';

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Push Ops"
        title={pushEnabled ? 'Bildirim kanali hazirlikta' : 'Push modulu kapali'}
        body="Expo push token kaydi, cloud senkronu ve local sim aksiyonlari bu yuzeyden kontrol edilir."
        badges={[
          { label: pushEnabled ? 'Push enabled' : 'Push disabled', tone: pushEnabled ? 'sage' : 'clay' },
          { label: isSignedIn ? 'Session ready' : 'Session required', tone: isSignedIn ? 'sage' : 'clay' },
          { label: state.cloudStatus, tone: state.cloudStatus === 'synced' ? 'sage' : state.cloudStatus === 'error' ? 'clay' : 'muted' },
        ]}
        metrics={[
          { label: 'Permission', value: state.permissionStatus || 'unknown' },
          { label: 'Test', value: testState.status },
          { label: 'Local', value: localSimState.status },
          { label: 'Cloud', value: state.cloudStatus },
        ]}
        actions={[
          {
            label: isBusy ? 'Push Kaydi Suruyor...' : 'Push Izin + Token Yenile',
            tone: 'brand',
            onPress: onRegister,
            disabled: isBusy || !isSignedIn || !pushEnabled,
          },
          {
            label: isTestBusy ? 'Test Push Gonderiliyor...' : 'Kendime Test Push Gonder',
            tone: 'teal',
            onPress: onSendTest,
            disabled: isTestBusy || !canSendTest || !pushEnabled,
          },
          {
            label: isLocalSimBusy ? 'Local Sim Gonderiliyor...' : 'Emulator Local Push Simule Et',
            tone: 'neutral',
            onPress: onSimulateLocal,
            disabled: isLocalSimBusy || !pushEnabled,
          },
        ]}
      />

      {!pushEnabled ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Push Module"
          title="Push modulu su an kapali"
          body="Remote push aksiyonlari gecici olarak devre disi. EXPO_PUBLIC_PUSH_ENABLED=1 ile geri acilir."
          meta="Local sim ve diger kartlar sadece mod aktifken anlamli veri uretir."
        />
      ) : null}

      {pushEnabled && !isSignedIn ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Session Gate"
          title="Push kaydi icin giris yapman gerekiyor"
          body="Token kaydi ve cloud sync sadece mobil session acikken tamamlanir."
          meta="Local sim aksiyonu yine de debug icin kullanilabilir."
        />
      ) : null}

      <StatusStrip
        tone={stateTone}
        eyebrow="Registration"
        title={
          state.status === 'unsupported'
            ? 'Remote push bu ortamda sinirli'
            : state.status === 'error'
              ? 'Push kaydi hata verdi'
              : state.cloudStatus === 'synced'
                ? 'Push kaydi cloud ile senkron'
                : 'Push kaydi hazirlaniyor'
        }
        body={state.message}
        meta={state.cloudMessage}
      />

      <ScreenCard accent="sage">
        <Text style={styles.subSectionLabel}>Device ve Cloud Detayi</Text>
        <View style={styles.detailInfoGrid}>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Permission</Text>
            <Text style={styles.detailInfoValue}>{state.permissionStatus || 'unknown'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>ProjectId</Text>
            <Text style={styles.detailInfoValue}>{state.projectId || 'unset'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Cloud Sync</Text>
            <Text style={styles.detailInfoValue}>{state.cloudStatus}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Last Notification</Text>
            <Text style={styles.detailInfoValue}>{state.lastNotification || 'none'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Token</Text>
            <Text style={styles.detailInfoValue}>{tokenPreview}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Device Key</Text>
            <Text style={styles.detailInfoValue}>{deviceKeyPreview}</Text>
          </View>
        </View>
      </ScreenCard>

      {!canSendTest ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Test Readiness"
          title="Test push henuz hazir degil"
          body="Server test gonderimi icin cloud sync durumunun `synced` olmasi gerekir."
          meta={
            !pushEnabled
              ? 'Once push modulu acilmali.'
              : !isSignedIn
                ? 'Once mobil session acilmali.'
                : 'Register aksiyonunu calistirip cloud sync tamamlaninca tekrar dene.'
          }
        />
      ) : (
        <StatusStrip
          tone="sage"
          eyebrow="Test Readiness"
          title="Server test push gonderimine hazir"
          body="Kendime test push gonder aksiyonu bu cihaz ve session icin aktif."
        />
      )}

      <ScreenCard accent="clay">
        <Text style={styles.subSectionLabel}>Dispatch Sonucu</Text>
        <StatusStrip
          tone={testTone}
          eyebrow="Remote Test"
          title={testState.status === 'success' ? 'Test push tamamlandi' : testState.status === 'error' ? 'Test push basarisiz' : 'Test push beklemede'}
          body={testState.message}
          meta={
            testState.status === 'success'
              ? `Sent ${testState.sentCount} | Tickets ${testState.ticketCount} | Errors ${testState.errorCount}`
              : 'Server dispatch sonucu burada ozetlenir.'
          }
        />
        <StatusStrip
          tone={receiptTone}
          eyebrow="Receipt"
          title={testState.receiptStatus === 'ok' ? 'Receipt kontrolu olumlu' : testState.receiptStatus === 'unavailable' ? 'Receipt sinirli' : 'Receipt bekleniyor'}
          body={
            testState.receiptMessage ||
            `Checked ${testState.receiptCheckedCount} | Ok ${testState.receiptOkCount} | Error ${testState.receiptErrorCount} | Pending ${testState.receiptPendingCount}`
          }
          meta={testState.receiptErrorPreview || undefined}
        />
        <StatusStrip
          tone={localTone}
          eyebrow="Local Sim"
          title={localSimState.status === 'success' ? 'Local bildirim tetiklendi' : localSimState.status === 'error' ? 'Local sim hata verdi' : 'Local sim beklemede'}
          body={localSimState.message}
          meta="Emulator akisi remote token gerekmeden deep-link ve inbox testini dogrular."
        />
      </ScreenCard>
    </>
  );
};

const PushInboxRowCard = memo(
  ({
    item,
    showOpsMeta,
    onPressRow,
    onOpenDeepLink,
  }: {
    item: PushInboxItem;
    showOpsMeta: boolean;
    onPressRow: (item: PushInboxItem) => void;
    onOpenDeepLink: (item: PushInboxItem) => void;
  }) => {
    const isActionable = Boolean(item.deepLink);
    const idPreview = item.notificationId ? item.notificationId.slice(-8) : 'none';
    const stateLabel = item.opened ? 'acildi' : 'yeni';

    return (
      <Pressable
        style={styles.inboxRow}
        onPress={() => onPressRow(item)}
        hitSlop={PRESSABLE_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`${item.title} bildirimini okundu olarak isaretle`}
      >
        <Text style={styles.inboxTitle}>
          {item.title || 'Bildirim'}{' '}
          <Text style={styles.inboxTitleState}>({stateLabel})</Text>
        </Text>
        {showOpsMeta ? (
          <Text style={styles.inboxMeta}>
            {item.receivedAt} | source: {item.source} | type: {item.kind} | id: {idPreview}
          </Text>
        ) : (
          <Text style={styles.inboxMeta}>{item.receivedAt}</Text>
        )}
        {item.body ? <Text style={styles.inboxBody}>{item.body}</Text> : null}
        {showOpsMeta ? (
          <Text selectable style={styles.inboxMeta}>
            Deep-link: {item.deepLink || 'none'}
          </Text>
        ) : null}
        {isActionable ? (
          <View style={styles.inboxActionRow}>
            <Pressable
              style={styles.inboxOpenButton}
              onPress={() => onOpenDeepLink(item)}
              hitSlop={PRESSABLE_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Bildirim detayini ac"
            >
              <Text style={styles.retryText}>Detayi Ac</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.showOpsMeta === next.showOpsMeta &&
    prev.onPressRow === next.onPressRow &&
    prev.onOpenDeepLink === next.onOpenDeepLink
);

const PushInboxCard = ({
  state,
  showOpsMeta = false,
  onClear,
  onPressItem,
  onOpenDeepLink,
  language = 'tr',
}: {
  state: PushInboxState;
  showOpsMeta?: boolean;
  onClear: () => void;
  onPressItem: (item: PushInboxItem) => void;
  onOpenDeepLink: (item: PushInboxItem) => void;
  language?: MobileSettingsLanguage;
}) => {
  const isBusy = state.status === 'loading';
  const sortedItems = useMemo(() => {
    return [...state.items].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  }, [state.items]);

  const renderInboxRow = useCallback(
    ({ item }: { item: PushInboxItem }) => (
      <PushInboxRowCard
        item={item}
        showOpsMeta={showOpsMeta}
        onPressRow={onPressItem}
        onOpenDeepLink={onOpenDeepLink}
      />
    ),
    [onOpenDeepLink, onPressItem, showOpsMeta]
  );

  if (sortedItems.length === 0) {
    if (state.status === 'loading' || state.status === 'error') {
      return (
        <StatePanel
          tone="sage"
          variant={state.status === 'loading' ? 'loading' : 'error'}
          eyebrow={language === 'tr' ? 'Bildirimler' : language === 'fr' ? 'Notifications' : language === 'es' ? 'Notificaciones' : 'Notifications'}
          title={
            state.status === 'loading'
              ? (language === 'tr' ? 'Bildirimler yukleniyor' : language === 'fr' ? 'Chargement des notifications' : language === 'es' ? 'Cargando notificaciones' : 'Loading notifications')
              : (language === 'tr' ? 'Bildirimler okunamadi' : language === 'fr' ? 'Erreur de chargement' : language === 'es' ? 'Error al cargar' : 'Could not load notifications')
          }
          body={
            state.status === 'loading'
              ? (language === 'tr' ? 'Bildirim listesi hazirlaniyor.' : language === 'fr' ? 'La liste de notifications se charge.' : language === 'es' ? 'Cargando la lista de notificaciones.' : 'Preparing notification list.')
              : (language === 'tr' ? 'Bildirim listesi gecici olarak acilamadi.' : language === 'fr' ? 'La liste de notifications est temporairement indisponible.' : language === 'es' ? 'La lista de notificaciones no esta disponible temporalmente.' : 'Notification list is temporarily unavailable.')
          }
          meta={state.status === 'error' ? state.message : undefined}
        />
      );
    }
    // Empty state — make it engaging with a feature tease
    const inboxEmptyLines =
      language === 'tr'
        ? { eyebrow: 'Bildirimler', title: 'Henuz bildirim yok', teaser: ['Lig terfi ve dus bildirimleri', 'Arena siralama degisiklikleri', 'Takip ettigin kullanicilarin aktivitesi'] }
        : language === 'fr'
          ? { eyebrow: 'Notifications', title: 'Pas encore de notification', teaser: ['Promotions et relegations de ligue', 'Changements de classement Arena', 'Activite des utilisateurs suivis'] }
          : language === 'es'
            ? { eyebrow: 'Notificaciones', title: 'Aun no hay notificaciones', teaser: ['Ascensos y descensos de liga', 'Cambios en el ranking de Arena', 'Actividad de usuarios seguidos'] }
            : { eyebrow: 'Notifications', title: 'No notifications yet', teaser: ['League promotions and relegations', 'Arena ranking changes', 'Activity from users you follow'] };
    return (
      <ScreenCard accent="sage">
        <Text style={[styles.sectionLeadEyebrow, { marginBottom: 4 }]}>{inboxEmptyLines.eyebrow}</Text>
        <Text style={[styles.screenTitle, { marginBottom: 8 }]}>{inboxEmptyLines.title}</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {inboxEmptyLines.teaser.map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8A9A5B' }} />
              <Text style={[styles.screenBody, { flex: 1 }]}>{line}</Text>
            </View>
          ))}
        </View>
      </ScreenCard>
    );
  }

  return (
    <ScreenCard accent="sage">
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.subSectionLabel}>Bildirimler</Text>
        <UiButton
          label={isBusy ? 'Isleniyor...' : 'Temizle'}
          tone="neutral"
          onPress={onClear}
          disabled={isBusy || sortedItems.length === 0}
        />
      </View>

      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderInboxRow}
        scrollEnabled={false}
        initialNumToRender={8}
        maxToRenderPerBatch={12}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ItemSeparatorComponent={() => <View style={styles.inboxItemSeparator} />}
        contentContainerStyle={styles.inboxList}
      />
    </ScreenCard>
  );
};

const MOBILE_COMMENT_FEED_COPY: Record<
  MobileSettingsLanguage,
  {
    titleSelectedMovie: string;
    titleAll: string;
    titleToday: string;
    bodySelectedMovie: string;
    bodyAll: string;
    bodyToday: string;
    movieFilterLabel: string;
    selectedMoviePending: string;
    showAllAccessibility: string;
    showTodayAccessibility: string;
    sortLatestAccessibility: string;
    sortEchoesAccessibility: string;
    allFlowLabel: string;
    todayOnlyLabel: string;
    latestLabel: string;
    mostEchoesLabel: string;
    searchPlaceholder: string;
    searchAccessibility: string;
    filterEyebrow: string;
    filterTitle: string;
    filterBody: string;
    filterMeta: string;
    feedEyebrow: string;
    loadingTitle: string;
    loadingBody: string;
    errorTitle: string;
    emptyTitle: string;
    errorBody: string;
    emptyBody: string;
    mineBadge: string;
    openProfileAccessibility: (author: string) => string;
    echoAccessibility: (author: string) => string;
    replyAccessibility: (author: string) => string;
    echoLabel: string;
    replyLabel: string;
    deleteAccessibility: string;
    deleteBusy: string;
    deleteLabel: string;
    repliesLoading: string;
    noReplies: string;
    replyPlaceholder: string;
    replyInputAccessibility: (author: string) => string;
    replySendAccessibility: (author: string) => string;
    replySendBusy: string;
    replySendLabel: string;
    loadMoreAccessibilityBusy: string;
    loadMoreAccessibility: string;
    loadMoreBusy: string;
    loadMoreLabel: string;
  }
> = {
  tr: {
    titleSelectedMovie: 'Secili Film Yorumlari',
    titleAll: 'Tum Yorumlar',
    titleToday: 'Bugunun Yorumlari',
    bodySelectedMovie: 'Ana sayfada sadece secili film ile ilgili yorumlar gosterilir.',
    bodyAll: 'Arena ekraninda tum akisi filtreleyebilir ve siralayabilirsin.',
    bodyToday: 'Ana sayfada yalnizca bugun yazilan yorumlar listelenir.',
    movieFilterLabel: 'Film filtresi',
    selectedMoviePending: 'Film secimi bekleniyor',
    showAllAccessibility: 'Tum yorumlari goster',
    showTodayAccessibility: 'Sadece bugun yorumlarini goster',
    sortLatestAccessibility: 'Yorumlari en yeniye gore sirala',
    sortEchoesAccessibility: 'Yorumlari en cok echoya gore sirala',
    allFlowLabel: 'Tum Akis',
    todayOnlyLabel: 'Sadece Bugun',
    latestLabel: 'En Yeni',
    mostEchoesLabel: 'En Cok Echo',
    searchPlaceholder: 'Yorum, film ya da yazar ara...',
    searchAccessibility: 'Tum yorumlarda ara',
    filterEyebrow: 'Film Filtresi',
    filterTitle: 'Once bir film sec',
    filterBody: 'Ana sayfada secili filme odaklandigin zaman yorum akisi burada sade bir sekilde acilir.',
    filterMeta: 'Film secildiginde yorumlar ve yanitlar bu panelin altinda listelenir.',
    feedEyebrow: 'Yorum Akisi',
    loadingTitle: 'Sosyal akis toparlaniyor',
    loadingBody: 'Yorumlar, echo sayilari ve yanitlar yenileniyor.',
    errorTitle: 'Yorumlar alinamadi',
    emptyTitle: 'Bu filtrede yorum yok',
    errorBody: 'Akis gecici olarak okunamadi. Asagi cekip tekrar deneyebilirsin.',
    emptyBody:
      'Filtreyi degistirerek daha genis bir akis gorebilir ya da yeni yorumlar geldikce burayi tekrar kontrol edebilirsin.',
    mineBadge: 'SENIN',
    openProfileAccessibility: (author: string) => `${author} profilini ac`,
    echoAccessibility: (author: string) => `${author} yorumuna echo ver`,
    replyAccessibility: (author: string) => `${author} yorumunun yanitlarini ac`,
    echoLabel: 'Echo',
    replyLabel: 'Yanit',
    deleteAccessibility: 'Kendi yorumunu sil',
    deleteBusy: 'Siliniyor',
    deleteLabel: 'Sil',
    repliesLoading: 'Yanitlar yukleniyor...',
    noReplies: 'Bu yorum icin henuz yanit yok.',
    replyPlaceholder: 'Yanit yaz...',
    replyInputAccessibility: (author: string) => `${author} yorumuna yanit yaz`,
    replySendAccessibility: (author: string) => `${author} yorumuna yanit gonder`,
    replySendBusy: 'Gonderiliyor...',
    replySendLabel: 'Yanitla',
    loadMoreAccessibilityBusy: 'Yorumlar yukleniyor',
    loadMoreAccessibility: 'Yorum akisindan daha fazla kayit yukle',
    loadMoreBusy: 'Yukleniyor...',
    loadMoreLabel: 'Daha Fazla Yorum Yukle',
  },
  en: {
    titleSelectedMovie: 'Selected Film Comments',
    titleAll: 'All Comments',
    titleToday: "Today's Comments",
    bodySelectedMovie: 'Only comments for the selected film are shown on the main screen.',
    bodyAll: 'You can filter and sort the full feed in Arena.',
    bodyToday: 'Only comments written today are listed on the main screen.',
    movieFilterLabel: 'Film filter',
    selectedMoviePending: 'Waiting for film selection',
    showAllAccessibility: 'Show all comments',
    showTodayAccessibility: "Show only today's comments",
    sortLatestAccessibility: 'Sort comments by newest',
    sortEchoesAccessibility: 'Sort comments by most echoes',
    allFlowLabel: 'All Feed',
    todayOnlyLabel: 'Today Only',
    latestLabel: 'Latest',
    mostEchoesLabel: 'Most Echoes',
    searchPlaceholder: 'Search comments, films, or authors...',
    searchAccessibility: 'Search across comments',
    filterEyebrow: 'Film Filter',
    filterTitle: 'Pick a film first',
    filterBody: 'When you focus on the selected film on the main screen, the comment feed opens here in a simpler view.',
    filterMeta: 'Comments and replies will list below this panel once a film is selected.',
    feedEyebrow: 'Comment Feed',
    loadingTitle: 'Social feed is refreshing',
    loadingBody: 'Comments, echoes, and replies are updating.',
    errorTitle: 'Comments could not be loaded',
    emptyTitle: 'There are no comments in this filter',
    errorBody: 'The feed could not be read right now. Pull down and try again.',
    emptyBody: 'Change the filter for a wider feed, or check back here as new comments arrive.',
    mineBadge: 'YOURS',
    openProfileAccessibility: (author: string) => `Open ${author} profile`,
    echoAccessibility: (author: string) => `Echo ${author}'s comment`,
    replyAccessibility: (author: string) => `Open replies to ${author}'s comment`,
    echoLabel: 'Echo',
    replyLabel: 'Reply',
    deleteAccessibility: 'Delete your comment',
    deleteBusy: 'Deleting',
    deleteLabel: 'Delete',
    repliesLoading: 'Replies are loading...',
    noReplies: 'There are no replies for this comment yet.',
    replyPlaceholder: 'Write a reply...',
    replyInputAccessibility: (author: string) => `Write a reply to ${author}'s comment`,
    replySendAccessibility: (author: string) => `Send a reply to ${author}'s comment`,
    replySendBusy: 'Sending...',
    replySendLabel: 'Reply',
    loadMoreAccessibilityBusy: 'Comments are loading',
    loadMoreAccessibility: 'Load more comments from the feed',
    loadMoreBusy: 'Loading...',
    loadMoreLabel: 'Load More Comments',
  },
  es: {
    titleSelectedMovie: 'Comentarios de la Pelicula Seleccionada',
    titleAll: 'Todos los Comentarios',
    titleToday: 'Comentarios de Hoy',
    bodySelectedMovie: 'En la pantalla principal solo se muestran comentarios de la pelicula seleccionada.',
    bodyAll: 'Puedes filtrar y ordenar todo el flujo en Arena.',
    bodyToday: 'En la pantalla principal solo se listan los comentarios escritos hoy.',
    movieFilterLabel: 'Filtro de pelicula',
    selectedMoviePending: 'Esperando la seleccion de pelicula',
    showAllAccessibility: 'Mostrar todos los comentarios',
    showTodayAccessibility: 'Mostrar solo los comentarios de hoy',
    sortLatestAccessibility: 'Ordenar comentarios por los mas recientes',
    sortEchoesAccessibility: 'Ordenar comentarios por mas ecos',
    allFlowLabel: 'Todo el Flujo',
    todayOnlyLabel: 'Solo Hoy',
    latestLabel: 'Mas Recientes',
    mostEchoesLabel: 'Mas Ecos',
    searchPlaceholder: 'Busca comentarios, peliculas o autores...',
    searchAccessibility: 'Buscar en todos los comentarios',
    filterEyebrow: 'Filtro de Pelicula',
    filterTitle: 'Elige una pelicula primero',
    filterBody:
      'Cuando enfoques la pelicula seleccionada en la pantalla principal, el flujo de comentarios se abre aqui de forma mas simple.',
    filterMeta: 'Los comentarios y respuestas se listaran debajo de este panel cuando se seleccione una pelicula.',
    feedEyebrow: 'Flujo de Comentarios',
    loadingTitle: 'El flujo social se esta actualizando',
    loadingBody: 'Se estan actualizando comentarios, ecos y respuestas.',
    errorTitle: 'No se pudieron cargar los comentarios',
    emptyTitle: 'No hay comentarios en este filtro',
    errorBody: 'No se pudo leer el flujo ahora. Desliza hacia abajo e intentalo otra vez.',
    emptyBody: 'Cambia el filtro para ver un flujo mas amplio o vuelve aqui cuando lleguen comentarios nuevos.',
    mineBadge: 'TUYO',
    openProfileAccessibility: (author: string) => `Abrir el perfil de ${author}`,
    echoAccessibility: (author: string) => `Dar eco al comentario de ${author}`,
    replyAccessibility: (author: string) => `Abrir respuestas del comentario de ${author}`,
    echoLabel: 'Eco',
    replyLabel: 'Responder',
    deleteAccessibility: 'Eliminar tu comentario',
    deleteBusy: 'Eliminando',
    deleteLabel: 'Eliminar',
    repliesLoading: 'Las respuestas se estan cargando...',
    noReplies: 'Todavia no hay respuestas para este comentario.',
    replyPlaceholder: 'Escribe una respuesta...',
    replyInputAccessibility: (author: string) => `Escribe una respuesta al comentario de ${author}`,
    replySendAccessibility: (author: string) => `Enviar una respuesta al comentario de ${author}`,
    replySendBusy: 'Enviando...',
    replySendLabel: 'Responder',
    loadMoreAccessibilityBusy: 'Los comentarios se estan cargando',
    loadMoreAccessibility: 'Cargar mas comentarios del flujo',
    loadMoreBusy: 'Cargando...',
    loadMoreLabel: 'Cargar Mas Comentarios',
  },
  fr: {
    titleSelectedMovie: 'Commentaires du Film Selectionne',
    titleAll: 'Tous les Commentaires',
    titleToday: 'Commentaires du Jour',
    bodySelectedMovie: 'Sur l ecran principal, seuls les commentaires du film selectionne sont affiches.',
    bodyAll: 'Tu peux filtrer et trier tout le flux dans Arena.',
    bodyToday: "Sur l ecran principal, seuls les commentaires ecrits aujourd hui sont listes.",
    movieFilterLabel: 'Filtre film',
    selectedMoviePending: 'En attente du choix du film',
    showAllAccessibility: 'Afficher tous les commentaires',
    showTodayAccessibility: 'Afficher seulement les commentaires du jour',
    sortLatestAccessibility: 'Trier les commentaires par les plus recents',
    sortEchoesAccessibility: 'Trier les commentaires par le plus d echos',
    allFlowLabel: 'Tout le Flux',
    todayOnlyLabel: "Seulement Aujourd hui",
    latestLabel: 'Les Plus Recents',
    mostEchoesLabel: 'Le Plus d Echos',
    searchPlaceholder: 'Recherche des commentaires, films ou auteurs...',
    searchAccessibility: 'Rechercher dans les commentaires',
    filterEyebrow: 'Filtre Film',
    filterTitle: 'Choisis un film d abord',
    filterBody:
      'Quand tu te concentres sur le film selectionne sur l ecran principal, le flux de commentaires s ouvre ici dans une vue plus simple.',
    filterMeta: 'Les commentaires et reponses apparaitront sous ce panneau quand un film sera selectionne.',
    feedEyebrow: 'Flux de Commentaires',
    loadingTitle: 'Le flux social se met a jour',
    loadingBody: 'Les commentaires, echos et reponses se mettent a jour.',
    errorTitle: "Les commentaires n ont pas pu etre charges",
    emptyTitle: "Il n y a pas de commentaires pour ce filtre",
    errorBody: "Le flux n a pas pu etre lu pour le moment. Tire vers le bas et reessaie.",
    emptyBody: 'Change le filtre pour voir un flux plus large ou reviens ici quand de nouveaux commentaires arrivent.',
    mineBadge: 'A TOI',
    openProfileAccessibility: (author: string) => `Ouvrir le profil de ${author}`,
    echoAccessibility: (author: string) => `Donner un echo au commentaire de ${author}`,
    replyAccessibility: (author: string) => `Ouvrir les reponses du commentaire de ${author}`,
    echoLabel: 'Echo',
    replyLabel: 'Repondre',
    deleteAccessibility: 'Supprimer ton commentaire',
    deleteBusy: 'Suppression...',
    deleteLabel: 'Supprimer',
    repliesLoading: 'Les reponses se chargent...',
    noReplies: "Il n y a pas encore de reponse pour ce commentaire.",
    replyPlaceholder: 'Ecris une reponse...',
    replyInputAccessibility: (author: string) => `Ecrire une reponse au commentaire de ${author}`,
    replySendAccessibility: (author: string) => `Envoyer une reponse au commentaire de ${author}`,
    replySendBusy: 'Envoi...',
    replySendLabel: 'Repondre',
    loadMoreAccessibilityBusy: 'Les commentaires se chargent',
    loadMoreAccessibility: 'Charger plus de commentaires depuis le flux',
    loadMoreBusy: 'Chargement...',
    loadMoreLabel: 'Charger Plus de Commentaires',
  },
};

const CommentFeedCard = ({
  state,
  language = 'tr',
  currentUserAvatarUrl,
  showFilters = true,
  onScopeChange,
  onSortChange,
  onQueryChange,
  onLoadMore,
  onEcho,
  onLoadReplies,
  onSubmitReply,
  onDeleteItem,
  onOpenAuthorProfile,
  selectedMovieTitle,
  movieFilterMode = 'all',
}: {
  state: CommentFeedState;
  language?: MobileSettingsLanguage;
  currentUserAvatarUrl?: string;
  showFilters?: boolean;
  onScopeChange: (scope: CommentFeedScope) => void;
  onSortChange: (sort: CommentFeedSort) => void;
  onQueryChange: (query: string) => void;
  onLoadMore?: () => void;
  onEcho?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; message: string }>;
  onLoadReplies?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; replies: MobileCommentReply[]; message: string }>;
  onSubmitReply?: (
    item: CommentFeedState['items'][number],
    text: string
  ) => Promise<{ ok: boolean; message: string; reply?: MobileCommentReply }>;
  onDeleteItem?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; message: string }>;
  onOpenAuthorProfile: (item: CommentFeedState['items'][number]) => void;
  selectedMovieTitle?: string | null;
  movieFilterMode?: 'all' | 'selected_movie';
}) => {
  const isBusy = state.status === 'loading';
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyMessages, setReplyMessages] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<string, boolean>>({});
  const [echoSubmitting, setEchoSubmitting] = useState<Record<string, boolean>>({});
  const [deleteSubmitting, setDeleteSubmitting] = useState<Record<string, boolean>>({});
  const [repliesByItemId, setRepliesByItemId] = useState<Record<string, MobileCommentReply[]>>({});
  const normalizedSelectedMovieTitle = String(selectedMovieTitle || '').trim();
  const normalizedCurrentUserAvatarUrl = String(currentUserAvatarUrl || '').trim();
  const isMovieFiltering = movieFilterMode === 'selected_movie';
  const waitingMovieSelection = isMovieFiltering && !normalizedSelectedMovieTitle;
  const visibleItems =
    waitingMovieSelection || !isMovieFiltering
      ? isMovieFiltering
        ? []
        : state.items
      : state.items.filter(
          (item) =>
            String(item.movieTitle || '').trim().toLowerCase() ===
            normalizedSelectedMovieTitle.toLowerCase()
        );
  const commentFeedCopy = MOBILE_COMMENT_FEED_COPY[language] || MOBILE_COMMENT_FEED_COPY.en;

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    setExpandedReplies((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setReplyDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setReplyMessages((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setReplyLoading((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setReplySubmitting((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setEchoSubmitting((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
    setDeleteSubmitting((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key)))
    );
    setRepliesByItemId((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key)))
    );
  }, [visibleItems]);

  const handleEchoPress = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      if (!onEcho || item.isEchoedByMe || echoSubmitting[item.id]) return;
      setEchoSubmitting((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      const result = await onEcho(item);
      setReplyMessages((prev) => ({
        ...prev,
        [item.id]: result.message,
      }));
      setEchoSubmitting((prev) => ({
        ...prev,
        [item.id]: false,
      }));
    },
    [echoSubmitting, onEcho]
  );

  const handleToggleReplies = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      const nextExpanded = !expandedReplies[item.id];
      setExpandedReplies((prev) => ({
        ...prev,
        [item.id]: nextExpanded,
      }));

      if (!nextExpanded || !onLoadReplies || replyLoading[item.id]) return;
      const currentReplies = repliesByItemId[item.id] || [];
      if (currentReplies.length >= item.replyCount && currentReplies.length > 0) return;

      setReplyLoading((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      const result = await onLoadReplies(item);
      setRepliesByItemId((prev) => ({
        ...prev,
        [item.id]: result.replies,
      }));
      setReplyMessages((prev) => ({
        ...prev,
        [item.id]: result.message,
      }));
      setReplyLoading((prev) => ({
        ...prev,
        [item.id]: false,
      }));
    },
    [expandedReplies, onLoadReplies, repliesByItemId, replyLoading]
  );

  const handleSubmitReply = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      const draft = String(replyDrafts[item.id] || '').trim();
      if (!draft || !onSubmitReply || replySubmitting[item.id]) return;

      setReplySubmitting((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      const result = await onSubmitReply(item, draft);
      if (result.ok && result.reply) {
        setRepliesByItemId((prev) => ({
          ...prev,
          [item.id]: [...(prev[item.id] || []), result.reply!],
        }));
        setReplyDrafts((prev) => ({
          ...prev,
          [item.id]: '',
        }));
      }
      setReplyMessages((prev) => ({
        ...prev,
        [item.id]: result.message,
      }));
      setReplySubmitting((prev) => ({
        ...prev,
        [item.id]: false,
      }));
    },
    [onSubmitReply, replyDrafts, replySubmitting]
  );

  const handleDeletePress = useCallback(
    async (item: CommentFeedState['items'][number]) => {
      if (!onDeleteItem || deleteSubmitting[item.id]) return;

      setDeleteSubmitting((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      const result = await onDeleteItem(item);
      setReplyMessages((prev) => ({
        ...prev,
        [item.id]: result.message,
      }));
      setDeleteSubmitting((prev) => ({
        ...prev,
        [item.id]: false,
      }));
    },
    [deleteSubmitting, onDeleteItem]
  );

  return (
    <KeyboardAvoidingView
      enabled={Platform.OS !== 'web'}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
    >
      <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>
        {isMovieFiltering
          ? commentFeedCopy.titleSelectedMovie
          : showFilters
            ? commentFeedCopy.titleAll
            : commentFeedCopy.titleToday}
      </Text>
      <Text style={styles.screenBody}>
        {isMovieFiltering
          ? commentFeedCopy.bodySelectedMovie
          : showFilters
            ? commentFeedCopy.bodyAll
            : commentFeedCopy.bodyToday}
      </Text>
      {isMovieFiltering ? (
        <Text style={styles.screenMeta}>
          {commentFeedCopy.movieFilterLabel}: {normalizedSelectedMovieTitle || commentFeedCopy.selectedMoviePending}
        </Text>
      ) : null}

      {showFilters ? (
        <>
          <View style={styles.commentFeedFilterStack}>
            <View style={styles.commentFeedControlRow}>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.scope === 'all' && styles.commentFeedSegmentActive]}
                onPress={() => onScopeChange('all')}
                accessibilityLabel={commentFeedCopy.showAllAccessibility}
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.scope === 'all' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  {commentFeedCopy.allFlowLabel}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.scope === 'today' && styles.commentFeedSegmentActive]}
                onPress={() => onScopeChange('today')}
                accessibilityLabel={commentFeedCopy.showTodayAccessibility}
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.scope === 'today' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  {commentFeedCopy.todayOnlyLabel}
                </Text>
              </Pressable>
            </View>
            <View style={styles.commentFeedControlRow}>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.sort === 'latest' && styles.commentFeedSegmentActive]}
                onPress={() => onSortChange('latest')}
                accessibilityLabel={commentFeedCopy.sortLatestAccessibility}
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.sort === 'latest' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  {commentFeedCopy.latestLabel}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.sort === 'echoes' && styles.commentFeedSegmentActive]}
                onPress={() => onSortChange('echoes')}
                accessibilityLabel={commentFeedCopy.sortEchoesAccessibility}
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.sort === 'echoes' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  {commentFeedCopy.mostEchoesLabel}
                </Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            style={styles.commentFeedSearchInput}
            value={state.query}
            onChangeText={onQueryChange}
            autoCapitalize="none"
            placeholder={commentFeedCopy.searchPlaceholder}
            placeholderTextColor="#8e8b84"
            accessibilityLabel={commentFeedCopy.searchAccessibility}
          />
        </>
      ) : null}

      {waitingMovieSelection ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow={commentFeedCopy.filterEyebrow}
          title={commentFeedCopy.filterTitle}
          body={commentFeedCopy.filterBody}
          meta={commentFeedCopy.filterMeta}
        />
      ) : isBusy && visibleItems.length === 0 ? (
        <StatePanel
          tone="clay"
          variant="loading"
          eyebrow={commentFeedCopy.feedEyebrow}
          title={commentFeedCopy.loadingTitle}
          body={commentFeedCopy.loadingBody}
          meta={state.message}
        />
      ) : visibleItems.length === 0 ? (
        <StatePanel
          tone="clay"
          variant={state.status === 'error' ? 'error' : 'empty'}
          eyebrow={commentFeedCopy.feedEyebrow}
          title={state.status === 'error' ? commentFeedCopy.errorTitle : commentFeedCopy.emptyTitle}
          body={
            state.status === 'error'
              ? commentFeedCopy.errorBody
              : commentFeedCopy.emptyBody
          }
        />
      ) : (
        <View style={styles.commentFeedList}>
          {visibleItems.map((item) => {
            const resolvedAvatarUrl =
              String(item.authorAvatarUrl || '').trim() ||
              (item.isMine ? normalizedCurrentUserAvatarUrl : '');
            return (
              <View key={item.id} style={styles.commentFeedRow}>
                <View style={styles.commentFeedRowHeader}>
                  <Text style={styles.commentFeedMovieTitle}>{item.movieTitle}</Text>
                  {item.isMine ? <Text style={styles.commentFeedMineBadge}>{commentFeedCopy.mineBadge}</Text> : null}
                </View>
                <View style={styles.commentFeedAuthorMetaRow}>
                  <View style={styles.commentFeedAvatarWrap}>
                    {resolvedAvatarUrl ? (
                      <Image
                        source={{ uri: resolvedAvatarUrl }}
                        style={styles.commentFeedAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.commentFeedAvatarFallback}>
                        {(String(item.author || '').trim().slice(0, 1) || 'U').toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    hitSlop={PRESSABLE_HIT_SLOP}
                    onPress={() => onOpenAuthorProfile(item)}
                    accessibilityRole="button"
                    accessibilityLabel={commentFeedCopy.openProfileAccessibility(item.author)}
                  >
                    <Text style={styles.commentFeedAuthorLink}>{item.author}</Text>
                  </Pressable>
                  <View
                    style={[
                      styles.commentFeedLeagueBadge,
                      {
                        borderColor: `${item.leagueColor || '#8A9A5B'}80`,
                        backgroundColor: `${item.leagueColor || '#8A9A5B'}22`,
                      },
                    ]}
                  >
                    <Text style={[styles.commentFeedLeagueBadgeText, { color: item.leagueColor || '#8A9A5B' }]}>
                      {resolveLocalizedLeagueDisplayName(language, item.leagueKey, '')}
                    </Text>
                  </View>
                  <Text style={styles.commentFeedMeta}>{item.timestampLabel}</Text>
                </View>
                <Text style={styles.commentFeedBody}>{item.text}</Text>
                <View style={styles.commentFeedActionRow}>
                  <View style={styles.commentFeedInlineActions}>
                    <Pressable
                      style={[
                        styles.commentFeedInlineAction,
                        item.isEchoedByMe ? styles.commentFeedInlineActionActive : null,
                        echoSubmitting[item.id] ? styles.claimButtonDisabled : null,
                      ]}
                      onPress={() => {
                        void handleEchoPress(item);
                      }}
                      disabled={item.isEchoedByMe || echoSubmitting[item.id]}
                      accessibilityRole="button"
                      accessibilityLabel={commentFeedCopy.echoAccessibility(item.author)}
                    >
                      <Ionicons
                        name={item.isEchoedByMe ? 'radio' : 'radio-outline'}
                        size={16}
                        color={item.isEchoedByMe ? '#A57164' : '#C9C6BF'}
                      />
                      <Text
                        style={[
                          styles.commentFeedInlineActionText,
                          item.isEchoedByMe ? styles.commentFeedInlineActionTextActive : null,
                        ]}
                      >
                        {commentFeedCopy.echoLabel} {item.echoCount}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.commentFeedInlineAction,
                        expandedReplies[item.id] ? styles.commentFeedInlineActionActive : null,
                      ]}
                      onPress={() => {
                        void handleToggleReplies(item);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={commentFeedCopy.replyAccessibility(item.author)}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={16}
                        color={expandedReplies[item.id] ? '#A57164' : '#C9C6BF'}
                      />
                      <Text
                        style={[
                          styles.commentFeedInlineActionText,
                          expandedReplies[item.id] ? styles.commentFeedInlineActionTextActive : null,
                        ]}
                      >
                        {commentFeedCopy.replyLabel} {item.replyCount}
                      </Text>
                    </Pressable>
                    {item.isMine && onDeleteItem && !item.id.startsWith('xp-') ? (
                      <Pressable
                        style={[
                          styles.commentFeedInlineAction,
                          styles.commentFeedInlineActionDanger,
                          deleteSubmitting[item.id] ? styles.claimButtonDisabled : null,
                        ]}
                        onPress={() => {
                          void handleDeletePress(item);
                        }}
                        disabled={deleteSubmitting[item.id]}
                        accessibilityRole="button"
                        accessibilityLabel={commentFeedCopy.deleteAccessibility}
                      >
                        <Ionicons name="trash-outline" size={16} color="#A57164" />
                        <Text
                          style={[
                            styles.commentFeedInlineActionText,
                            styles.commentFeedInlineActionDangerText,
                          ]}
                        >
                          {deleteSubmitting[item.id] ? commentFeedCopy.deleteBusy : commentFeedCopy.deleteLabel}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {replyMessages[item.id] ? (
                  <Text
                    style={[
                      styles.commentFeedRowStatus,
                      replyMessages[item.id].toLowerCase().includes('edilemedi') ||
                      replyMessages[item.id].toLowerCase().includes('gerekli') ||
                      replyMessages[item.id].toLowerCase().includes('bulunamadi')
                        ? styles.ritualStateError
                        : styles.ritualStateOk,
                    ]}
                  >
                    {replyMessages[item.id]}
                  </Text>
                ) : null}
                {expandedReplies[item.id] ? (
                  <View style={styles.commentFeedReplyPanel}>
                    {replyLoading[item.id] ? (
                      <Text style={styles.commentFeedMeta}>{commentFeedCopy.repliesLoading}</Text>
                    ) : (repliesByItemId[item.id] || []).length > 0 ? (
                      <View style={styles.commentFeedReplyList}>
                        {(repliesByItemId[item.id] || []).map((reply) => (
                          <View key={reply.id} style={styles.commentFeedReplyRow}>
                            <View style={styles.commentFeedReplyHeader}>
                              <Text style={styles.commentFeedReplyAuthor}>{reply.author}</Text>
                              <Text style={styles.commentFeedMeta}>{reply.timestampLabel}</Text>
                            </View>
                            <Text style={styles.commentFeedReplyText}>{reply.text}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.commentFeedMeta}>{commentFeedCopy.noReplies}</Text>
                    )}
                    <View style={styles.commentFeedReplyComposer}>
                      <TextInput
                        style={styles.commentFeedReplyInput}
                        value={replyDrafts[item.id] || ''}
                        onChangeText={(value) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [item.id]: value,
                          }))
                        }
                        autoCapitalize="sentences"
                        multiline
                        placeholder={commentFeedCopy.replyPlaceholder}
                        placeholderTextColor="#8e8b84"
                        maxLength={180}
                        accessibilityLabel={commentFeedCopy.replyInputAccessibility(item.author)}
                      />
                      <Pressable
                        style={[
                          styles.commentFeedReplySendButton,
                          !String(replyDrafts[item.id] || '').trim() || replySubmitting[item.id]
                            ? styles.claimButtonDisabled
                            : null,
                        ]}
                        onPress={() => {
                          void handleSubmitReply(item);
                        }}
                        disabled={!String(replyDrafts[item.id] || '').trim() || replySubmitting[item.id]}
                        accessibilityRole="button"
                        accessibilityLabel={commentFeedCopy.replySendAccessibility(item.author)}
                      >
                        <Text style={styles.commentFeedReplySendButtonText}>
                          {replySubmitting[item.id] ? commentFeedCopy.replySendBusy : commentFeedCopy.replySendLabel}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.commentFeedBottomActionRow}>
        {onLoadMore && (state.hasMore || state.isAppending) ? (
          <Pressable
            style={[
              styles.retryButton,
              styles.commentFeedBottomActionButton,
              isBusy || state.isAppending || !state.hasMore ? styles.claimButtonDisabled : null,
            ]}
            disabled={isBusy || state.isAppending || !state.hasMore}
            onPress={onLoadMore}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              state.isAppending
                ? commentFeedCopy.loadMoreAccessibilityBusy
                : commentFeedCopy.loadMoreAccessibility
            }
            accessibilityState={{ disabled: isBusy || state.isAppending || !state.hasMore }}
          >
            <Text style={styles.retryText}>
              {state.isAppending ? commentFeedCopy.loadMoreBusy : commentFeedCopy.loadMoreLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </ScreenCard>
    </KeyboardAvoidingView>
  );
};

const MOBILE_DAILY_CYCLE_TIME_COPY: Record<MobileSettingsLanguage, { label: string }> = {
  tr: { label: 'Siradaki Secime' },
  en: { label: 'Until Next Selection' },
  es: { label: 'Hasta la Proxima Seleccion' },
  fr: { label: 'Avant la Prochaine Selection' },
};

const DailyCycleTime = ({ language = 'tr' }: { language?: MobileSettingsLanguage }) => {
  const [status, setStatus] = useState({ remaining: '', progress: 0 });
  const copy = MOBILE_DAILY_CYCLE_TIME_COPY[language] || MOBILE_DAILY_CYCLE_TIME_COPY.en;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false });
      const mStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul', minute: '2-digit' });
      const sStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul', second: '2-digit' });

      let hour = parseInt(hStr, 10);
      let minute = parseInt(mStr, 10);
      let second = parseInt(sStr, 10);

      if (isNaN(hour)) {
        hour = now.getUTCHours();
        minute = now.getUTCMinutes();
        second = now.getUTCSeconds();
      } else if (hour === 24) hour = 0;

      const totalSecondsInDay = 24 * 60 * 60;
      const elapsedSeconds = Math.min(totalSecondsInDay - 1, Math.max(0, hour * 3600 + minute * 60 + second));
      const progress = (elapsedSeconds / totalSecondsInDay) * 100;
      const remainingSeconds = totalSecondsInDay - elapsedSeconds - 1;

      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      setStatus({
        remaining: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        progress
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status.remaining) return null;

  return (
    <View style={styles.cycleTimeContainer}>
      <View style={styles.cycleTimeLabelRow}>
        <Text style={styles.cycleTimeTextMode}>{copy.label}</Text>
        <Text style={styles.cycleTimeTextTime}>{status.remaining}</Text>
      </View>
      <View style={styles.cycleTimeBarTrack}>
        <View style={[styles.cycleTimeBarFill, { width: `${status.progress}%` }]} />
      </View>
    </View>
  );
};

const DailyHomeScreen = ({
  state,
  showOpsMeta = false,
  selectedMovieId,
  onSelectMovie,
  language = 'tr',
  streak,
  username,
}: {
  state: DailyState;
  showOpsMeta?: boolean;
  selectedMovieId?: number | null;
  onSelectMovie?: (movieId: number) => void;
  language?: MobileSettingsLanguage;
  streak?: number | null;
  username?: string | null;
}) => {
  const isWebSurface = Platform.OS === 'web';
  const railRef = useRef<FlatList<DailyMovieRailItem> | null>(null);
  const railScrollOffsetRef = useRef(0);
  const railDragStartOffsetRef = useRef(0);
  const railDragStartXRef = useRef(0);
  const lastRailGestureAtRef = useRef(0);
  const railPressGuardUntilRef = useRef(0);
  const railInteractionActiveRef = useRef(false);
  const railInteractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railMovies = state.status === 'success' ? state.movies.slice(0, 5) : [];
  // Streak badge pulse
  const streakPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!streak || streak <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(streakPulse, { toValue: 1.1, duration: 950, useNativeDriver: SUPPORTS_NATIVE_DRIVER, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(streakPulse, { toValue: 1, duration: 950, useNativeDriver: SUPPORTS_NATIVE_DRIVER, easing: Easing.inOut(Easing.ease) }),
      ]),
      { iterations: 3 }
    );
    loop.start();
    return () => loop.stop();
  }, [streak, streakPulse]);
  const copy =
    language === 'tr'
      ? {
          unknownAge: 'bilinmiyor',
          secondSuffix: 'sn',
          minuteSuffix: 'dk',
          hourSuffix: 'sa',
          loadingEyebrow: 'Gunluk Filmler',
          loadingTitle: 'Bugunun filmleri hazirlaniyor',
          loadingBody: 'Secki ve film kartlari yukleniyor.',
          loadingMeta: 'Birazdan bugunun onerileri burada acilacak.',
          errorEyebrow: 'Gunluk Filmler',
          errorTitle: 'Bugunun filmleri simdi acilamadi',
          errorBody: 'Baglanti veya servis kaynakli gecici bir sorun var. Sayfayi asagi cekerek seckiyi yeniden isteyebilirsin.',
          errorMeta: (message: string, endpoint: string) => `Detay: ${message} | Uc nokta: ${endpoint}`,
          emptyEyebrow: 'Gunluk Filmler',
          emptyTitle: 'Bugun icin film bulunmadi',
          emptyBody: 'Gunluk liste henuz gelmedi. Sayfayi asagi cekerek seckiyi yeniden isteyebilirsin.',
          sectionTitle: 'Gunluk Filmler',
          cacheBody: 'Baglanti zayif oldugu icin son kaydedilen secki gosteriliyor.',
          fallbackBody: 'Servise ulasilamadi, yedek film listesi gosteriliyor.',
          liveBody: 'Bugunun secilen filmleri hazir.',
          dateLabel: 'Tarih',
          todayLabel: 'bugun',
          dataBadgeLabel: 'VERI',
          sourceLabel: 'Kaynak',
          endpointLabel: 'Uc nokta',
          dataLabel: 'Veri',
          staleLabel: 'Bayat',
          yes: 'evet',
          no: 'hayir',
          ageLabel: 'Yas',
          warningLabel: 'Veri uyarisi',
          dataSourceLive: 'canli',
          dataSourceCache: 'onbellek',
          dataSourceFallback: 'yedek',
          unknown: 'bilinmiyor',
          none: 'yok',
          detailAccessibility: (title: string) => `${title} filmini detayli goruntule`,
          streakLine: 'serini bugun de koru',
          completedToday: 'Bugun tamamlandi',
        }
      : language === 'es'
        ? {
            unknownAge: 'desconocido',
            secondSuffix: 's',
            minuteSuffix: 'min',
            hourSuffix: 'h',
            loadingEyebrow: 'Peliculas del Dia',
            loadingTitle: 'Las peliculas de hoy se estan cargando',
            loadingBody: 'La seleccion y las tarjetas de pelicula se estan cargando.',
            loadingMeta: 'Las recomendaciones de hoy apareceran aqui en breve.',
            errorEyebrow: 'Peliculas del Dia',
            errorTitle: 'Las peliculas de hoy no pudieron abrirse ahora',
            errorBody: 'Hay un problema temporal de red o servicio. Desliza hacia abajo para pedir la seleccion otra vez.',
            errorMeta: (message: string, endpoint: string) => `Detalle: ${message} | Endpoint: ${endpoint}`,
            emptyEyebrow: 'Peliculas del Dia',
            emptyTitle: 'No se encontraron peliculas para hoy',
            emptyBody: 'La lista diaria aun no llego. Desliza hacia abajo para pedir la seleccion otra vez.',
            sectionTitle: 'Peliculas del Dia',
            cacheBody: 'Se muestra la ultima seleccion guardada porque la conexion es debil.',
            fallbackBody: 'No se pudo alcanzar el servicio, asi que se muestra una lista alternativa.',
            liveBody: 'Las peliculas seleccionadas de hoy estan listas.',
            dateLabel: 'Fecha',
            todayLabel: 'hoy',
            dataBadgeLabel: 'DATOS',
            sourceLabel: 'Fuente',
            endpointLabel: 'Endpoint',
            dataLabel: 'Datos',
            staleLabel: 'Antiguo',
            yes: 'si',
            no: 'no',
            ageLabel: 'Edad',
            warningLabel: 'Aviso de datos',
            dataSourceLive: 'en vivo',
            dataSourceCache: 'cache',
            dataSourceFallback: 'alternativa',
            unknown: 'desconocido',
            none: 'ninguno',
            detailAccessibility: (title: string) => `Ver informacion detallada de ${title}`,
            streakLine: 'mantén tu racha',
            completedToday: 'Completado hoy',
          }
      : language === 'fr'
        ? {
            unknownAge: 'inconnu',
            secondSuffix: 's',
            minuteSuffix: 'min',
            hourSuffix: 'h',
            loadingEyebrow: 'Films du Jour',
            loadingTitle: 'Les films du jour se chargent',
            loadingBody: 'La selection et les cartes de film se chargent.',
            loadingMeta: 'Les recommandations du jour apparaitront ici tres bientot.',
            errorEyebrow: 'Films du Jour',
            errorTitle: 'Les films du jour ne peuvent pas s ouvrir maintenant',
            errorBody: 'Il y a un probleme temporaire de reseau ou de service. Tire la page vers le bas pour demander de nouveau la selection.',
            errorMeta: (message: string, endpoint: string) => `Detail: ${message} | Endpoint: ${endpoint}`,
            emptyEyebrow: 'Films du Jour',
            emptyTitle: 'Aucun film trouve pour aujourd hui',
            emptyBody: 'La liste du jour n est pas encore arrivee. Tire la page vers le bas pour redemander la selection.',
            sectionTitle: 'Films du Jour',
            cacheBody: 'La derniere selection enregistree est affichee parce que la connexion est faible.',
            fallbackBody: 'Le service est inaccessible, donc une liste de secours est affichee.',
            liveBody: 'Les films selectionnes du jour sont prets.',
            dateLabel: 'Date',
            todayLabel: 'aujourd hui',
            dataBadgeLabel: 'DONNEES',
            sourceLabel: 'Source',
            endpointLabel: 'Endpoint',
            dataLabel: 'Donnees',
            staleLabel: 'Ancien',
            yes: 'oui',
            no: 'non',
            ageLabel: 'Age',
            warningLabel: 'Alerte donnees',
            dataSourceLive: 'direct',
            dataSourceCache: 'cache',
            dataSourceFallback: 'secours',
            unknown: 'inconnu',
            none: 'aucun',
            detailAccessibility: (title: string) => `Voir le detail du film ${title}`,
            streakLine: 'maintiens ta serie',
            completedToday: 'Termine aujourd hui',
          }
      : {
          unknownAge: 'unknown',
          secondSuffix: 's',
          minuteSuffix: 'min',
          hourSuffix: 'h',
          loadingEyebrow: 'Daily Films',
          loadingTitle: 'Today\'s films are loading',
          loadingBody: 'The selection and film cards are loading.',
          loadingMeta: 'Today\'s recommendations will open here shortly.',
          errorEyebrow: 'Daily Films',
          errorTitle: 'Today\'s films could not be opened right now',
          errorBody: 'There is a temporary network or service issue. Pull the page down to request the selection again.',
          errorMeta: (message: string, endpoint: string) => `Detail: ${message} | Endpoint: ${endpoint}`,
          emptyEyebrow: 'Daily Films',
          emptyTitle: 'No films were found for today',
          emptyBody: 'The daily list has not arrived yet. Pull the page down to request the selection again.',
          sectionTitle: 'Daily Films',
          cacheBody: 'The latest saved selection is shown because the connection is weak.',
          fallbackBody: 'The service could not be reached, so a fallback film list is shown.',
          liveBody: 'Today\'s selected films are ready.',
          dateLabel: 'Date',
          todayLabel: 'today',
          dataBadgeLabel: 'DATA',
          sourceLabel: 'Source',
          endpointLabel: 'Endpoint',
          dataLabel: 'Data',
          staleLabel: 'Stale',
          yes: 'yes',
          no: 'no',
          ageLabel: 'Age',
          warningLabel: 'Data warning',
          dataSourceLive: 'live',
          dataSourceCache: 'cache',
          dataSourceFallback: 'fallback',
          unknown: 'unknown',
          none: 'none',
          detailAccessibility: (title: string) => `View detailed ${title} film info`,
          streakLine: 'keep your streak alive',
          completedToday: 'Completed today',
        };

  const hour = new Date().getHours();
  const firstName = username ? username.trim().split(/\s+/)[0] : null;
  const n = firstName ?? '';
  const completed = selectedMovieId != null;
  const sv = streak ?? 0; // streak value

  // 12 retention messages — criteria: hour range + completed today + streak count
  // Rule table:
  //  1. 00-06, any       → night ambient
  //  2. 06-10, !done, s>0 → morning streak reminder
  //  3. 06-10, !done, s=0 → morning new-user nudge
  //  4. 06-10, done      → morning celebration
  //  5. 10-14, !done     → midday nudge
  //  6. 10-14, done      → midday Arena pressure
  //  7. 14-18, !done     → afternoon warning
  //  8. 14-18, done      → afternoon positive
  //  9. 18-22, !done, s>0 → evening streak endangered
  // 10. 18-22, !done, s=0 → evening last call
  // 11. 18-22, done      → evening wrap-up
  // 12. 22-24, !done     → late-night final chance (if done: use #11)
  type RetentionMsgSet = [
    string, string, string, string,
    string, string, string, string,
    string, string, string, string,
  ];
  const msgSets: Record<MobileSettingsLanguage, RetentionMsgSet> = {
    tr: [
      /* 1 */ 'Gece yarisi bile sinema — yarin sabah ritüelin basliyor',
      /* 2 */ n ? `${n}, ${sv} günlük serin var — sabah ritmiyle bugün de devam et` : `${sv} günlük seri var — sabah ritmiyle bugün de devam et`,
      /* 3 */ n ? `Güne sinemayla basla ${n} — bugünün filmi seni bekliyor` : 'Güne sinemayla basla — bugünün filmi seni bekliyor',
      /* 4 */ n ? `${n}, bugünkü ritüel tamam — yorumun Arena sirasinda bekliyor` : 'Bugünkü ritüel tamam — yorumun Arena sirasinda bekliyor',
      /* 5 */ n ? `${n}, ögle vakti — bugünkü secimi henüz yapmadiniz` : 'Ögle vakti — bugünkü secimi henüz yapmadiniz',
      /* 6 */ 'Harika baslangic — bugün erken bitirdin, Arena tablosunda siran güvende',
      /* 7 */ n ? `${n}, ikindi — Arena siralamasi sekilleniyor, hâlâ zamanin var` : 'Ikindi — Arena siralamasi sekilleniyor, hâlâ zamanin var',
      /* 8 */ n ? `${n}, bugünkü secim tamam — Arena rekabeti kizisiyor` : 'Bugünkü secim tamam — Arena rekabeti kizisiyor',
      /* 9 */ n ? `${n}, ${sv} günlük serin bugün tehlikede — gece bitmeden bir yorum birak` : `${sv} günlük seri bugün tehlikede — gece bitmeden bir yorum birak`,
      /* 10 */ n ? `${n}, aksam son cagri — bir yorum birak, serinle basla` : 'Aksam son cagri — bir yorum birak, serinle basla',
      /* 11 */ n ? `${n}, bugünkü ritüel tamamlandi — yarin da burada ol` : 'Bugünkü ritüel tamamlandi — yarin da burada ol',
      /* 12 */ n ? `Son sans ${n} — gece bitmeden yorumunu birak, seri devam etsin` : 'Son sans — gece bitmeden yorumunu birak, seri devam etsin',
    ],
    fr: [
      /* 1 */ 'Même à minuit — ton rituel recommence demain matin',
      /* 2 */ n ? `${n}, tu as une série de ${sv} jours — continue ce matin avec le rythme` : `Série de ${sv} jours — continue ce matin avec le rythme`,
      /* 3 */ n ? `Commence ta journée avec le cinéma ${n} — le film du jour t'attend` : "Commence ta journée avec le cinéma — le film du jour t'attend",
      /* 4 */ n ? `${n}, le rituel du jour est terminé — ton rang Arena est assuré` : 'Le rituel du jour est terminé — ton rang Arena est assuré',
      /* 5 */ n ? `${n}, c'est midi — tu n'as pas encore fait ton choix du jour` : "C'est midi — tu n'as pas encore fait ton choix du jour",
      /* 6 */ "Bien joué — tu as fini tôt, ta place dans le tableau Arena est sécurisée",
      /* 7 */ n ? `${n}, l'après-midi — le classement Arena se dessine, il est encore temps` : "L'après-midi — le classement Arena se dessine, il est encore temps",
      /* 8 */ n ? `${n}, ton choix du jour est fait — la compétition Arena s'intensifie` : "Ton choix du jour est fait — la compétition Arena s'intensifie",
      /* 9 */ n ? `${n}, ta série de ${sv} jours est en danger — laisse un commentaire avant la fin de la soirée` : `Ta série de ${sv} jours est en danger — laisse un commentaire avant la fin de la soirée`,
      /* 10 */ n ? `${n}, dernier appel du soir — laisse un commentaire, commence ta série` : 'Dernier appel du soir — laisse un commentaire, commence ta série',
      /* 11 */ n ? `${n}, le rituel du jour est terminé — on se retrouve demain` : 'Le rituel du jour est terminé — on se retrouve demain',
      /* 12 */ n ? `Dernière chance ${n} — laisse ton commentaire avant minuit, garde ta série` : 'Dernière chance — laisse ton commentaire avant minuit, garde ta série',
    ],
    es: [
      /* 1 */ 'Incluso a medianoche — tu ritual empieza mañana por la mañana',
      /* 2 */ n ? `${n}, tienes una racha de ${sv} días — sigue con el ritmo matutino` : `Racha de ${sv} días — sigue con el ritmo matutino`,
      /* 3 */ n ? `Empieza el día con cine ${n} — la película de hoy te espera` : 'Empieza el día con cine — la película de hoy te espera',
      /* 4 */ n ? `${n}, el ritual de hoy está completo — tu puesto en Arena está asegurado` : 'El ritual de hoy está completo — tu puesto en Arena está asegurado',
      /* 5 */ n ? `${n}, es mediodía — todavía no has hecho tu selección del día` : 'Es mediodía — todavía no has hecho tu selección del día',
      /* 6 */ '¡Bien hecho! — terminaste temprano, tu lugar en la tabla Arena está seguro',
      /* 7 */ n ? `${n}, por la tarde — el ranking Arena se forma, todavía hay tiempo` : 'Por la tarde — el ranking Arena se forma, todavía hay tiempo',
      /* 8 */ n ? `${n}, tu selección del día está hecha — la competencia Arena se intensifica` : 'Tu selección del día está hecha — la competencia Arena se intensifica',
      /* 9 */ n ? `${n}, tu racha de ${sv} días está en peligro — deja un comentario antes del anochecer` : `Tu racha de ${sv} días está en peligro — deja un comentario antes del anochecer`,
      /* 10 */ n ? `${n}, última llamada de la tarde — deja un comentario, empieza tu racha` : 'Última llamada de la tarde — deja un comentario, empieza tu racha',
      /* 11 */ n ? `${n}, el ritual del día está terminado — nos vemos mañana` : 'El ritual del día está terminado — nos vemos mañana',
      /* 12 */ n ? `Última oportunidad ${n} — deja tu comentario antes de medianoche, mantén la racha` : 'Última oportunidad — deja tu comentario antes de medianoche, mantén la racha',
    ],
    en: [
      /* 1 */ 'Even at midnight — your ritual starts fresh tomorrow morning',
      /* 2 */ n ? `${n}, ${sv}-day streak running — keep it going this morning` : `${sv}-day streak running — keep it going this morning`,
      /* 3 */ n ? `Start your day with cinema ${n} — today's film is waiting` : "Start your day with cinema — today's film is waiting",
      /* 4 */ n ? `${n}, today's ritual is done — your Arena spot is locked in` : "Today's ritual is done — your Arena spot is locked in",
      /* 5 */ n ? `${n}, it's noon — you haven't made today's pick yet` : "It's noon — you haven't made today's pick yet",
      /* 6 */ "Great start — you finished early, your Arena rank is secured",
      /* 7 */ n ? `${n}, afternoon — the Arena rankings are forming, you still have time` : 'Afternoon — the Arena rankings are forming, you still have time',
      /* 8 */ n ? `${n}, today's pick is in — the Arena competition is heating up` : "Today's pick is in — the Arena competition is heating up",
      /* 9 */ n ? `${n}, your ${sv}-day streak is at risk — drop a comment before the night is over` : `Your ${sv}-day streak is at risk — drop a comment before the night is over`,
      /* 10 */ n ? `${n}, last call tonight — leave a comment and start your streak` : 'Last call tonight — leave a comment and start your streak',
      /* 11 */ n ? `${n}, today's ritual is complete — see you tomorrow` : "Today's ritual is complete — see you tomorrow",
      /* 12 */ n ? `Last chance ${n} — leave your comment before midnight, keep the streak alive` : 'Last chance — leave your comment before midnight, keep the streak alive',
    ],
  };
  const msgs = msgSets[language] ?? msgSets.tr;
  // Pick message index based on hour + completed + streak
  const retentionMsg: string = (() => {
    if (hour < 6) return msgs[0];
    if (hour < 10) return completed ? msgs[3] : sv > 0 ? msgs[1] : msgs[2];
    if (hour < 14) return completed ? msgs[5] : msgs[4];
    if (hour < 18) return completed ? msgs[7] : msgs[6];
    if (hour < 22) return completed ? msgs[10] : sv > 0 ? msgs[8] : msgs[9];
    return completed ? msgs[10] : msgs[11];
  })();

  const formatAge = (ageSeconds: number | null): string => {
    if (ageSeconds === null || ageSeconds < 0) return copy.unknownAge;
    if (ageSeconds < 60) return `${ageSeconds}${copy.secondSuffix}`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)} ${copy.minuteSuffix}`;
    return `${Math.floor(ageSeconds / 3600)} ${copy.hourSuffix}`;
  };

  const markRailGesture = useCallback(() => {
    lastRailGestureAtRef.current = Date.now();
  }, []);

  const clearRailInteractionTimeout = useCallback(() => {
    if (railInteractionTimeoutRef.current !== null) {
      clearTimeout(railInteractionTimeoutRef.current);
      railInteractionTimeoutRef.current = null;
    }
  }, []);

  const extendRailPressGuard = useCallback((delay = DAILY_MOVIE_RAIL_PRESS_GUARD_MS) => {
    railPressGuardUntilRef.current = Math.max(railPressGuardUntilRef.current, Date.now() + delay);
  }, []);

  const beginRailInteraction = useCallback(() => {
    clearRailInteractionTimeout();
    railInteractionActiveRef.current = true;
    markRailGesture();
    extendRailPressGuard();
  }, [clearRailInteractionTimeout, extendRailPressGuard, markRailGesture]);

  const endRailInteraction = useCallback(
    (delay = DAILY_MOVIE_RAIL_PRESS_GUARD_MS) => {
      extendRailPressGuard(delay);
      clearRailInteractionTimeout();
      railInteractionTimeoutRef.current = setTimeout(() => {
        railInteractionActiveRef.current = false;
        railInteractionTimeoutRef.current = null;
      }, delay);
    },
    [clearRailInteractionTimeout, extendRailPressGuard]
  );

  useEffect(() => () => clearRailInteractionTimeout(), [clearRailInteractionTimeout]);

  const scrollToRailIndex = useCallback(
    (requestedIndex: number) => {
      if (railMovies.length === 0) return;
      const nextIndex = Math.max(0, Math.min(requestedIndex, railMovies.length - 1));
      const nextOffset = nextIndex * DAILY_MOVIE_CARD_STRIDE;
      railRef.current?.scrollToOffset({
        offset: nextOffset,
        animated: true,
      });
      railScrollOffsetRef.current = nextOffset;
    },
    [railMovies.length]
  );

  const snapRailToNearest = useCallback(
    (offsetX: number) => {
      if (railMovies.length === 0) return;
      const nextIndex = Math.max(
        0,
        Math.min(Math.round(offsetX / DAILY_MOVIE_CARD_STRIDE), railMovies.length - 1)
      );
      scrollToRailIndex(nextIndex);
    },
    [railMovies.length, scrollToRailIndex]
  );

  const railResponderHandlers = useMemo(() => {
    if (!isWebSurface) return null;

    return {
      onMoveShouldSetResponder: (event: { nativeEvent: { pageX: number } }) =>
        Math.abs(event.nativeEvent.pageX - railDragStartXRef.current) > 6,
      onMoveShouldSetResponderCapture: (event: { nativeEvent: { pageX: number } }) =>
        Math.abs(event.nativeEvent.pageX - railDragStartXRef.current) > 6,
      onResponderGrant: (event: { nativeEvent: { pageX: number } }) => {
        beginRailInteraction();
        railDragStartXRef.current = event.nativeEvent.pageX;
        railDragStartOffsetRef.current = railScrollOffsetRef.current;
      },
      onResponderMove: (event: { nativeEvent: { pageX: number } }) => {
        beginRailInteraction();
        const deltaX = event.nativeEvent.pageX - railDragStartXRef.current;
        const maxOffset = Math.max(0, (railMovies.length - 1) * DAILY_MOVIE_CARD_STRIDE);
        const nextOffset = Math.max(
          0,
          Math.min(railDragStartOffsetRef.current - deltaX, maxOffset)
        );
        railScrollOffsetRef.current = nextOffset;
        railRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
      },
      onResponderRelease: () => {
        snapRailToNearest(railScrollOffsetRef.current);
        endRailInteraction();
      },
      onResponderTerminate: () => {
        snapRailToNearest(railScrollOffsetRef.current);
        endRailInteraction();
      },
      onResponderTerminationRequest: () => false,
    };
  }, [beginRailInteraction, endRailInteraction, isWebSurface, railMovies.length, snapRailToNearest]);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow={copy.loadingEyebrow}
        title={copy.loadingTitle}
        body={copy.loadingBody}
        meta={copy.loadingMeta}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="clay"
        variant="error"
        eyebrow={copy.errorEyebrow}
        title={copy.errorTitle}
        body={copy.errorBody}
        meta={showOpsMeta ? copy.errorMeta(state.message, state.endpoint || copy.none) : state.message}
      />
    );
  }

  if (state.status !== 'success') {
    return null;
  }

  const successState = state;
  if (successState.movies.length === 0) {
    return (
      <StatePanel
        tone="sage"
        variant="empty"
        eyebrow={copy.emptyEyebrow}
        title={copy.emptyTitle}
        body={copy.emptyBody}
        meta={successState.warning || undefined}
      />
    );
  }

  const dataSourceLabel =
    successState.dataSource === 'live'
      ? copy.dataSourceLive
      : successState.dataSource === 'cache'
        ? copy.dataSourceCache
        : copy.dataSourceFallback;
  // eslint-disable-next-line react-hooks/refs
  const railGestureProps = railResponderHandlers || {};

  return (
    <View style={{ marginBottom: 12 }}>
      <ScreenCard accent="sage">
        <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
          {retentionMsg}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.screenTitle}>{copy.sectionTitle}</Text>
            <Text style={[styles.screenBody, { marginTop: 4 }]}>
              {successState.dataSource === 'cache'
                ? copy.cacheBody
                : successState.dataSource === 'fallback'
                  ? copy.fallbackBody
                  : copy.liveBody}
            </Text>
          </View>
          {streak !== null && streak !== undefined && streak > 0 ? (
            <Animated.View style={[styles.dataSourceBadgeLive, { alignItems: 'center', minWidth: 48, transform: [{ scale: streakPulse }] }]}>
              <Text style={styles.dataSourceTextLive}>
                {streak} {language === 'tr' ? 'GUN' : language === 'fr' ? 'JOUR' : language === 'es' ? 'DIA' : 'DAY'}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={{ marginTop: 12 }}>
          <DailyCycleTime language={language} />
        </View>

        {selectedMovieId != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(138,154,91,0.15)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '800' }}>✓</Text>
            <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>{copy.completedToday}</Text>
          </View>
        ) : null}
        <View style={styles.dailyDataSourceRow}>
          <Text style={styles.screenMeta}>{copy.dateLabel}: {successState.date || copy.todayLabel}</Text>
          {showOpsMeta ? (
            <View
              style={
                successState.dataSource === 'live' ? styles.dataSourceBadgeLive : styles.dataSourceBadgeFallback
              }
            >
              <Text
                style={
                  successState.dataSource === 'live' ? styles.dataSourceTextLive : styles.dataSourceTextFallback
                }
              >
                {copy.dataBadgeLabel}: {dataSourceLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {showOpsMeta ? <Text style={styles.screenMeta}>{copy.sourceLabel}: {successState.source || copy.unknown}</Text> : null}
        {showOpsMeta ? <Text style={styles.screenMeta}>{copy.endpointLabel}: {successState.endpoint}</Text> : null}
        {showOpsMeta ? (
          <View style={styles.badgeRow}>
            <Text style={styles.screenMeta}>{copy.dataLabel}: {successState.dataSource}</Text>
            <Text style={styles.screenMeta}>{copy.staleLabel}: {successState.stale ? copy.yes : copy.no}</Text>
            {successState.dataSource === 'cache' ? (
              <Text style={styles.screenMeta}>{copy.ageLabel}: {formatAge(successState.cacheAgeSeconds)}</Text>
            ) : null}
          </View>
        ) : null}
        {showOpsMeta && successState.warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {copy.warningLabel}: {successState.warning}
            </Text>
          </View>
        ) : null}

        <View {...railGestureProps}>
          <FlatList
            ref={railRef}
            horizontal
            data={railMovies}
            keyExtractor={(movie, index) => `${movie.id}-${index}`}
            renderItem={({ item: movie, index }) => {
              const isSelected = selectedMovieId === movie.id;
              const posterUri = resolvePosterUrl(movie.posterPath);
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.movieCardWrapper,
                    isSelected ? styles.movieCardWrapperSelected : null,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                  ]}
                  onPress={() => {
                    if (
                      railInteractionActiveRef.current ||
                      Date.now() < railPressGuardUntilRef.current ||
                      Date.now() - lastRailGestureAtRef.current < DAILY_MOVIE_RAIL_PRESS_GUARD_MS
                    ) {
                      return;
                    }
                    onSelectMovie?.(movie.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={copy.detailAccessibility(movie.title)}
                >
                  <View style={styles.movieCardPoster}>
                    {posterUri ? (
                      <Image
                        source={{ uri: posterUri }}
                        style={[styles.movieCardPosterImage, !isSelected && { opacity: 0.45 }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.movieCardPosterFallbackLabel}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.movieCardContentWrapper}>
                    <Text
                      style={[styles.movieCardTitleLabel, !isSelected && { color: 'rgba(229, 228, 226, 0.5)' }]}
                      numberOfLines={2}
                    >
                      {movie.title}
                    </Text>
                    <Text style={styles.movieCardMetaLabel}>
                      {movie.voteAverage ? `${movie.voteAverage.toFixed(1)}` : 'N/A'}
                      {movie.year ? ` | ${movie.year}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.movieListHorizontalSpacer} />}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            scrollEnabled={railMovies.length > 1}
            snapToInterval={DAILY_MOVIE_CARD_STRIDE}
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              beginRailInteraction();
            }}
            onMomentumScrollBegin={() => {
              beginRailInteraction();
            }}
            onScroll={(event) => {
              markRailGesture();
              railScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            onMomentumScrollEnd={(event) => {
              if (isWebSurface) {
                snapRailToNearest(event.nativeEvent.contentOffset.x);
              }
              endRailInteraction();
            }}
            onScrollEndDrag={(event) => {
              if (isWebSurface) {
                snapRailToNearest(event.nativeEvent.contentOffset.x);
              }
              endRailInteraction();
            }}
            contentContainerStyle={styles.movieListHorizontal}
          />
        </View>
      </ScreenCard>
    </View>
  );
};

type MobileQuizCopy = {
  title: string;
  subtitle: string;
  loading: string;
  pending: string;
  error: string;
  noQuestions: string;
  signIn: string;
  signInBody: string;
  progress: string;
  xp: string;
  correct: string;
  wrong: string;
  saving: string;
  unlockedHint: string;
  commentCta: string;
  authCta: string;
};

const MOBILE_QUIZ_COPY: Record<MobileDailyQuizLanguageCode, MobileQuizCopy> = {
  tr: {
    title: 'FILM QUIZ',
    subtitle: 'Yorumu acmak ve XP kazanmak icin sorulari cevapla.',
    loading: 'Sorular yukleniyor...',
    pending: 'Bu film icin quiz henuz hazir degil.',
    error: 'Quiz verisi su an yuklenemiyor.',
    noQuestions: 'Bu film icin soru bulunamadi.',
    signIn: 'Quiz ilerlemesi icin giris yap',
    signInBody: 'Dogru cevaplar XP yazar ve yorum kilidini acmak icin hesaba kaydedilir.',
    progress: 'Ilerleme',
    xp: 'XP',
    correct: 'Dogru',
    wrong: 'Yanlis',
    saving: 'Kaydediliyor...',
    unlockedHint: 'Yorum yazma alani acildi. Istersen kalan sorulari da cozmeye devam edebilirsin.',
    commentCta: 'Bu Film Icin Yorum Yaz',
    authCta: 'Giris Yap',
  },
  en: {
    title: 'FILM QUIZ',
    subtitle: 'Answer questions to unlock comments and earn XP.',
    loading: 'Loading questions...',
    pending: 'The quiz for this film is not ready yet.',
    error: 'Quiz data is unavailable right now.',
    noQuestions: 'No questions are available for this film.',
    signIn: 'Sign in to save quiz progress',
    signInBody: 'Correct answers award XP and unlock comments on your account.',
    progress: 'Progress',
    xp: 'XP',
    correct: 'Correct',
    wrong: 'Wrong',
    saving: 'Saving...',
    unlockedHint: 'Comments are unlocked. You can still finish the remaining questions.',
    commentCta: 'Write Comment',
    authCta: 'Sign In',
  },
  es: {
    title: 'QUIZ DE LA PELICULA',
    subtitle: 'Responde para desbloquear comentarios y ganar XP.',
    loading: 'Cargando preguntas...',
    pending: 'El quiz de esta pelicula todavia no esta listo.',
    error: 'Los datos del quiz no estan disponibles ahora.',
    noQuestions: 'No hay preguntas para esta pelicula.',
    signIn: 'Inicia sesion para guardar el progreso',
    signInBody: 'Las respuestas correctas dan XP y desbloquean comentarios en tu cuenta.',
    progress: 'Progreso',
    xp: 'XP',
    correct: 'Correcta',
    wrong: 'Incorrecta',
    saving: 'Guardando...',
    unlockedHint: 'Los comentarios ya estan desbloqueados. Puedes seguir con las preguntas restantes.',
    commentCta: 'Escribir comentario',
    authCta: 'Iniciar sesion',
  },
  fr: {
    title: 'QUIZ DU FILM',
    subtitle: 'Reponds pour debloquer les commentaires et gagner des XP.',
    loading: 'Chargement des questions...',
    pending: 'Le quiz de ce film n est pas encore pret.',
    error: 'Les donnees du quiz sont indisponibles pour le moment.',
    noQuestions: 'Aucune question disponible pour ce film.',
    signIn: 'Connecte-toi pour enregistrer ta progression',
    signInBody: 'Les bonnes reponses donnent des XP et debloquent les commentaires pour ton compte.',
    progress: 'Progression',
    xp: 'XP',
    correct: 'Bonne reponse',
    wrong: 'Mauvaise reponse',
    saving: 'Enregistrement...',
    unlockedHint: 'Les commentaires sont debloques. Tu peux encore terminer les questions restantes.',
    commentCta: 'Ecrire un commentaire',
    authCta: 'Se connecter',
  },
};

const getMobileUnlockHint = (
  language: MobileDailyQuizLanguageCode,
  requiredCorrectCount: number
): string => {
  switch (language) {
    case 'tr':
      return `Yorumu acmak icin en az ${requiredCorrectCount} dogru cevap gerekli.`;
    case 'es':
      return `Necesitas al menos ${requiredCorrectCount} respuestas correctas para abrir comentarios.`;
    case 'fr':
      return `Il faut au moins ${requiredCorrectCount} bonnes reponses pour ouvrir les commentaires.`;
    case 'en':
    default:
      return `You need at least ${requiredCorrectCount} correct answers to unlock comments.`;
  }
};

const updateMobileQuizBundleAfterAnswer = (
  bundle: MobileDailyQuizBundle,
  input: {
    questionId: string;
    selectedOption: MobileDailyQuizOptionKey;
    isCorrect: boolean;
    explanation: string;
    progress: NonNullable<MobileDailyQuizBundle['progress']>;
  }
): MobileDailyQuizBundle => ({
  ...bundle,
  progress: input.progress,
  questionsByMovie: bundle.questionsByMovie.map((movieBlock) => ({
    ...movieBlock,
    questions: movieBlock.questions.map((question) =>
      question.id === input.questionId
        ? {
            ...question,
            attempt: {
              selectedOption: input.selectedOption,
              isCorrect: input.isCorrect,
              answeredAt: new Date().toISOString(),
              explanation: input.explanation,
            },
          }
        : question
    ),
  })),
});

const MobileDailyQuizPanel = ({
  movieId,
  dateKey,
  language,
  isSignedIn,
  onStartComment,
  onRequireAuth,
  onApplyQuizProgress,
}: {
  movieId: number;
  dateKey?: string | null;
  language: MobileDailyQuizLanguageCode;
  isSignedIn: boolean;
  onStartComment: () => void;
  onRequireAuth?: () => void;
  onApplyQuizProgress?: (input: {
    totalXp: number | null;
    streak: number | null;
    dateKey: string;
    streakProtectedNow: boolean;
  }) => void;
}) => {
  const copy = MOBILE_QUIZ_COPY[language] || MOBILE_QUIZ_COPY.en;
  const [bundle, setBundle] = useState<MobileDailyQuizBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingQuestionId, setSubmittingQuestionId] = useState<string | null>(null);
  const [lastXpDelta, setLastXpDelta] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setPending(false);
      setError(null);
      setLastXpDelta(0);

      const result = await readMobileDailyQuizBundle({
        dateKey,
        language,
      });

      if (!active) return;

      if (!result.ok) {
        setBundle(null);
        if (result.status === 404) {
          setPending(true);
        } else {
          setError(result.error || copy.error);
        }
        setLoading(false);
        return;
      }

      setBundle(result);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [copy.error, dateKey, language, movieId]);

  const movieBlock = useMemo(
    () =>
      Array.isArray(bundle?.questionsByMovie)
        ? bundle.questionsByMovie.find((entry) => entry.movieId === movieId) || null
        : null,
    [bundle, movieId]
  );
  const questions = Array.isArray(movieBlock?.questions) ? movieBlock.questions : [];
  const answeredCount = questions.filter((question) => question.attempt).length;
  const correctCount = questions.filter((question) => question.attempt?.isCorrect).length;
  const requiredCorrectCount = movieBlock?.requiredCorrectCount || 0;
  const isUnlocked = requiredCorrectCount > 0 && correctCount >= requiredCorrectCount;
  const unlockHint = getMobileUnlockHint(language, requiredCorrectCount);

  const handleAnswer = useCallback(
    async (questionId: string, selectedOption: MobileDailyQuizOptionKey) => {
      if (!bundle || submittingQuestionId || !isSignedIn) return;

      setSubmittingQuestionId(questionId);
      setError(null);

      const result = await submitMobileDailyQuizAnswer({
        dateKey: bundle.date,
        questionId,
        selectedOption,
        language,
      });

      if (!result.ok) {
        setError(result.error || copy.error);
        setSubmittingQuestionId(null);
        return;
      }

      setLastXpDelta(result.xp.delta);
      onApplyQuizProgress?.({
        totalXp: result.xp.total,
        streak: result.xp.streak,
        dateKey: bundle.date,
        streakProtectedNow: result.xp.streakProtectedNow,
      });
      setBundle((current) =>
        current
          ? updateMobileQuizBundleAfterAnswer(current, {
              questionId: result.questionId,
              selectedOption: result.selectedOption,
              isCorrect: result.isCorrect,
              explanation: result.explanation,
              progress: result.progress,
            })
          : current
      );
      setSubmittingQuestionId(null);
    },
    [bundle, copy.error, isSignedIn, language, onApplyQuizProgress, submittingQuestionId]
  );

  return (
    <View style={styles.dailyQuizPanel}>
      <View style={styles.dailyQuizHeader}>
        <Text style={styles.dailyQuizEyebrow}>{copy.title}</Text>
        <Text style={styles.dailyQuizSubtitle}>{copy.subtitle}</Text>
      </View>

      {loading ? <Text style={styles.screenMeta}>{copy.loading}</Text> : null}
      {!loading && pending ? <Text style={styles.screenMeta}>{copy.pending}</Text> : null}
      {!loading && error ? <Text style={[styles.screenMeta, styles.ritualStateError]}>{error}</Text> : null}

      {!loading && !pending && !error && !movieBlock ? (
        <Text style={styles.screenMeta}>{copy.noQuestions}</Text>
      ) : null}

      {!loading && !pending && !error && movieBlock ? (
        <View style={styles.dailyQuizStack}>
          {!isSignedIn ? (
            <View style={styles.dailyQuizStatusCard}>
              <Text style={styles.dailyQuizStatusTitle}>{copy.signIn}</Text>
              <Text style={styles.dailyQuizStatusBody}>{copy.signInBody}</Text>
              {onRequireAuth ? (
                <UiButton label={copy.authCta} tone="neutral" stretch onPress={onRequireAuth} />
              ) : null}
            </View>
          ) : null}

          <View style={styles.dailyQuizSummaryCard}>
            <Text style={styles.dailyQuizSummaryText}>
              {copy.progress}: {answeredCount}/{questions.length}
            </Text>
            <Text style={styles.dailyQuizSummaryText}>
              {copy.correct}: {correctCount}/{requiredCorrectCount}
            </Text>
            <Text style={styles.dailyQuizSummaryText}>
              {copy.xp}: {bundle?.progress?.xpAwarded || 0}
            </Text>
            {lastXpDelta > 0 ? <Text style={styles.dailyQuizSummaryText}>+{lastXpDelta} XP</Text> : null}
          </View>

          {questions.map((question) => {
            const isSaving = submittingQuestionId === question.id;
            const selectedOption = question.attempt?.selectedOption || null;
            const isAnswered = Boolean(question.attempt);

            return (
              <View key={question.id} style={styles.dailyQuizQuestionCard}>
                <Text style={styles.dailyQuizQuestionText}>{question.question}</Text>

                <View style={styles.dailyQuizOptionList}>
                  {question.options.map((option) => {
                    const isSelected = selectedOption === option.key;
                    const isCorrectSelection = isSelected && question.attempt?.isCorrect;
                    const isWrongSelection = isSelected && question.attempt && !question.attempt.isCorrect;
                    const optionStateStyle = isCorrectSelection
                      ? styles.dailyQuizOptionCorrect
                      : isWrongSelection
                        ? styles.dailyQuizOptionWrong
                        : isSelected
                          ? styles.dailyQuizOptionSelected
                          : null;
                    const optionTextStateStyle = isCorrectSelection
                      ? styles.dailyQuizOptionTextCorrect
                      : isWrongSelection
                        ? styles.dailyQuizOptionTextWrong
                        : null;

                    return (
                      <Pressable
                        key={option.key}
                        style={({ pressed }) => [
                          styles.dailyQuizOptionButton,
                          optionStateStyle,
                          pressed && !isAnswered && !isSaving && isSignedIn ? styles.dailyQuizOptionPressed : null,
                          (!isSignedIn || isAnswered || isSaving) ? styles.dailyQuizOptionDisabled : null,
                        ]}
                        disabled={!isSignedIn || isAnswered || isSaving}
                        onPress={() => {
                          void handleAnswer(question.id, option.key);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${option.key.toUpperCase()} ${option.label}`}
                        accessibilityState={{ disabled: !isSignedIn || isAnswered || isSaving }}
                      >
                        <Text style={styles.dailyQuizOptionKey}>{option.key.toUpperCase()}</Text>
                        <Text style={[styles.dailyQuizOptionText, optionTextStateStyle]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {isSaving ? <Text style={styles.dailyQuizSavingText}>{copy.saving}</Text> : null}

                {question.attempt ? (
                  <View style={styles.dailyQuizExplanationCard}>
                    <Text style={styles.dailyQuizExplanationLabel}>
                      {question.attempt.isCorrect ? copy.correct : copy.wrong}
                    </Text>
                    <Text style={styles.dailyQuizExplanationBody}>{question.attempt.explanation}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <View style={styles.dailyQuizStatusCard}>
            <Text style={styles.dailyQuizStatusBody}>{isUnlocked ? copy.unlockedHint : unlockHint}</Text>
            <UiButton
              label={copy.commentCta}
              tone="brand"
              stretch
              onPress={onStartComment}
              disabled={!isUnlocked}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const MovieDetailsModal = ({
  movie,
  onClose,
  onOpenCommentComposer,
  onRequireAuth,
  onApplyQuizProgress,
  language,
  isSignedIn,
}: {
  movie: {
    id: number;
    title: string;
    overview: string | null;
    voteAverage: number | null;
    genre: string | null;
    year: number | null;
    director: string | null;
    cast?: string[];
    posterPath?: string | null;
    originalLanguage?: string | null;
    dateKey?: string | null;
  } | null;
  onClose: () => void;
  onOpenCommentComposer?: () => void;
  onRequireAuth?: () => void;
  onApplyQuizProgress?: (input: {
    totalXp: number | null;
    streak: number | null;
    dateKey: string;
    streakProtectedNow: boolean;
  }) => void;
  language: MobileDailyQuizLanguageCode;
  isSignedIn: boolean;
}) => {
  useWebModalFocusReset(Boolean(movie));
  if (!movie) return null;

  const directorLabel =
    String(movie.director || '').trim() && String(movie.director || '').trim().toLowerCase() !== 'unknown'
      ? String(movie.director || '').trim()
      : 'Yonetmen bilgisi hazirlaniyor';
  const castLabel =
    Array.isArray(movie.cast) && movie.cast.length > 0
      ? movie.cast.filter(Boolean).slice(0, 6).join(', ')
      : 'Oyuncu bilgisi hazirlaniyor';
  const posterUri = resolvePosterUrl(movie.posterPath || null);

  return (
    <Modal visible={Boolean(movie)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>Film Detayi</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentSurface}>
              <View style={styles.movieArchiveHeader}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.movieArchivePoster} resizeMode="cover" />
                ) : (
                  <View style={styles.movieArchivePosterFallback}>
                    <Text style={styles.movieArchivePosterFallbackText}>180</Text>
                  </View>
                )}
                <View style={styles.movieArchiveHeaderContent}>
                  <Text style={styles.movieDetailTitle}>{movie.title}</Text>
                  <Text style={styles.movieDetailMeta}>
                    {movie.year ? `${movie.year} | ` : ''}
                    {movie.genre || 'Tur bilgisi hazirlaniyor'}
                  </Text>
                  <View style={styles.movieArchiveBadgeRow}>
                    <View style={styles.movieArchiveBadge}>
                      <Text style={styles.movieArchiveBadgeText}>
                        Puan {movie.voteAverage?.toFixed(1) || 'N/A'}
                      </Text>
                    </View>
                    {movie.originalLanguage ? (
                      <View style={styles.movieArchiveBadge}>
                        <Text style={styles.movieArchiveBadgeText}>
                          Dil {movie.originalLanguage.toUpperCase()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.movieDetailCast}>Yonetmen: {directorLabel}</Text>
                  <Text style={styles.movieDetailCast}>Oyuncular: {castLabel}</Text>
                </View>
              </View>

              <Text style={styles.subSectionLabel}>Ozet</Text>
              <Text style={styles.movieDetailBody}>{movie.overview || 'Konu ozeti bulunamiyor.'}</Text>

              {onOpenCommentComposer ? (
                <ScreenErrorBoundary section="Film Quiz">
                  <MobileDailyQuizPanel
                    movieId={movie.id}
                    dateKey={movie.dateKey}
                    language={language}
                    isSignedIn={isSignedIn}
                    onStartComment={onOpenCommentComposer}
                    onRequireAuth={onRequireAuth}
                    onApplyQuizProgress={onApplyQuizProgress}
                  />
                </ScreenErrorBoundary>
              ) : null}
            </View>

            <View style={styles.modalActionStack}>
              <UiButton label="Kapat" tone="neutral" stretch onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ProfileMovieArchiveModal = ({
  visible,
  status,
  message,
  movie,
  entries,
  onDeleteEntry,
  onClose,
}: {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  movie: MobileWatchedMovie | null;
  entries: MobileProfileMovieArchiveEntry[];
  onDeleteEntry?: (
    entry: MobileProfileMovieArchiveEntry
  ) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(movie));
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  if (!visible || !movie) return null;

  const posterUri = resolvePosterUrl(movie.posterPath || entries[0]?.posterPath || null);
  const entryCountLabel = `${entries.length} yorum kaydi`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>Film Arsivi</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentSurface}>
              <View style={styles.movieArchiveHeader}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.movieArchivePoster} resizeMode="cover" />
                ) : (
                  <View style={styles.movieArchivePosterFallback}>
                    <Text style={styles.movieArchivePosterFallbackText}>180</Text>
                  </View>
                )}
                <View style={styles.movieArchiveHeaderContent}>
                  <Text style={styles.movieDetailTitle}>{movie.movieTitle}</Text>
                  <Text style={styles.movieDetailMeta}>
                    {movie.year ? `${movie.year} | ` : ''}
                    Son izleme: {movie.watchedDayKey || '-'}
                  </Text>
                  <View style={styles.movieArchiveBadgeRow}>
                    <View style={styles.movieArchiveBadge}>
                      <Text style={styles.movieArchiveBadgeText}>{entryCountLabel}</Text>
                    </View>
                    {movie.watchCount > 1 ? (
                      <View style={styles.movieArchiveBadge}>
                        <Text style={styles.movieArchiveBadgeText}>Tekrar {movie.watchCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.screenMeta,
                      status === 'error'
                        ? styles.ritualStateError
                        : status === 'ready'
                          ? styles.ritualStateOk
                          : styles.screenMeta,
                    ]}
                  >
                    {message}
                  </Text>
                </View>
              </View>
            </View>

            {status === 'loading' ? (
              <StatePanel
                tone="sage"
                variant="loading"
                eyebrow="Film Arsivi"
                title="Arsiv ritmi tazeleniyor"
                body="Secilen filme ait yorumlar ve yanitlar yeniden yukleniyor."
                meta="Yanitlar tekrar sayisi ile birlikte gruplanir."
              />
            ) : null}

            {status !== 'loading' && entries.length === 0 ? (
              <StatePanel
                tone="clay"
                variant={status === 'error' ? 'error' : 'empty'}
                eyebrow="Film Arsivi"
                title={status === 'error' ? 'Arsiv okunamadi' : 'Bu filmde henuz arsiv yok'}
                body={
                  status === 'error'
                    ? message || 'Film arsivi okunurken gecici bir sorun olustu.'
                    : 'Bu film icin mobil yuzeyde gosterilecek yorum kaydi bulunamadi.'
                }
                meta="Yeni yorum geldikce bu alan otomatik dolar."
              />
            ) : null}

            {entries.length > 0 ? (
              <View style={styles.movieArchiveEntryList}>
                {entries.map((entry) => (
                  <View key={entry.id} style={styles.movieArchiveEntryCard}>
                    <View style={styles.movieArchiveEntryHeader}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.movieArchiveEntryDate}>{entry.date}</Text>
                        {entry.genre ? (
                          <Text style={styles.movieArchiveEntryGenre}>{entry.genre}</Text>
                        ) : null}
                      </View>
                      {onDeleteEntry ? (
                        <Pressable
                          onPress={() => {
                            if (deletingEntryId) return;
                            setDeletingEntryId(entry.id);
                            void onDeleteEntry(entry).finally(() => {
                              setDeletingEntryId((current) => (current === entry.id ? null : current));
                            });
                          }}
                          disabled={Boolean(deletingEntryId)}
                          hitSlop={PRESSABLE_HIT_SLOP}
                          accessibilityRole="button"
                          accessibilityLabel="Yorumu sil"
                        >
                          <Text style={styles.movieArchiveDeleteText}>
                            {deletingEntryId === entry.id ? 'Siliniyor...' : 'Sil'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.movieArchiveEntryBody}>"{entry.text}"</Text>
                    <View style={styles.commentFeedReplyPanel}>
                      <Text style={styles.movieArchiveRepliesLabel}>Yanitlar: {entry.replies.length}</Text>
                      {entry.replies.length > 0 ? (
                        <View style={styles.commentFeedReplyList}>
                          {entry.replies.map((reply) => (
                            <View key={reply.id} style={styles.commentFeedReplyRow}>
                              <View style={styles.commentFeedReplyHeader}>
                                <Text style={styles.commentFeedReplyAuthor}>{reply.author}</Text>
                                <Text style={styles.commentFeedMeta}>{reply.timestampLabel}</Text>
                              </View>
                              <Text style={styles.commentFeedReplyText}>{reply.text}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.screenMeta}>Bu kayit icin yanit bulunmuyor.</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActionStack}>
              <UiButton label="Kapat" tone="neutral" stretch onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

type MobilePublicProfileArchiveModalCopy = {
  header: string;
  close: string;
  lastWatch: string;
  commentRecords: string;
  rewatch: string;
  profile: string;
  loadingEyebrow: string;
  loadingTitle: string;
  loadingBody: string;
  loadingMetaSuffix: string;
  emptyEyebrow: string;
  errorTitle: string;
  emptyTitle: string;
  errorBody: string;
  emptyBody: string;
  emptyMetaSuffix: string;
};

const MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY_EN: MobilePublicProfileArchiveModalCopy = {
  header: 'Movie Archive',
  close: 'Close',
  lastWatch: 'Last watch',
  commentRecords: 'comment entries',
  rewatch: 'Rewatch',
  profile: 'Profile',
  loadingEyebrow: 'Archive',
  loadingTitle: 'Refreshing movie activity',
  loadingBody: 'Comments for this movie are loading again for the selected user.',
  loadingMetaSuffix: 'profile activity is being scanned.',
  emptyEyebrow: 'Archive',
  errorTitle: 'Archive could not be opened',
  emptyTitle: 'No movie notes were found',
  errorBody: 'There was a temporary problem while loading the movie archive.',
  emptyBody: 'No comment entry was found for this movie.',
  emptyMetaSuffix: 'will fill in as new comments are added.',
} as const;

const MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY: Record<
  MobileSettingsLanguage,
  MobilePublicProfileArchiveModalCopy
> = {
  tr: {
    header: 'Film Arsivi',
    close: 'Kapat',
    lastWatch: 'Son izleme',
    commentRecords: 'yorum kaydi',
    rewatch: 'Tekrar',
    profile: 'Profil',
    loadingEyebrow: 'Arsiv',
    loadingTitle: 'Film akisi tazeleniyor',
    loadingBody: 'Secilen kullanicinin bu filme ait yorumlari yeniden yukleniyor.',
    loadingMetaSuffix: 'profilinden gelen yorum izi taraniyor.',
    emptyEyebrow: 'Arsiv',
    errorTitle: 'Arsiv okunamadi',
    emptyTitle: 'Yorum izine rastlanmadi',
    errorBody: 'Film arsivi okunurken gecici bir sorun olustu.',
    emptyBody: 'Bu film icin yorum kaydi bulunamadi.',
    emptyMetaSuffix: 'yeni yorum biraktikca bu alan dolacak.',
  },
  en: MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY_EN,
  es: MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY_EN,
  fr: MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY_EN,
};

const PublicProfileMovieArchiveModal = ({
  visible,
  status,
  message,
  displayName,
  movie,
  items,
  language = 'tr',
  onClose,
}: {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  displayName: string;
  movie: {
    movieTitle: string;
    posterPath: string | null;
    year: number | null;
    watchedDayKey: string;
    watchCount: number;
  } | null;
  items: MobilePublicProfileActivityItem[];
  language?: MobileSettingsLanguage;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(movie));
  if (!visible || !movie) return null;

  const copy = MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY[language] || MOBILE_PUBLIC_PROFILE_ARCHIVE_MODAL_COPY.tr;
  const posterUri = resolvePosterUrl(movie.posterPath || items[0]?.posterPath || null);
  const profileLabel =
    String(displayName || (language === 'tr' ? '@bilinmeyen' : '@unknown')).trim() ||
    (language === 'tr' ? '@bilinmeyen' : '@unknown');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>{copy.header}</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>{copy.close}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContentSurface}>
              <View style={styles.movieArchiveHeader}>
                {posterUri ? (
                  <Image source={{ uri: posterUri }} style={styles.movieArchivePoster} resizeMode="cover" />
                ) : (
                  <View style={styles.movieArchivePosterFallback}>
                    <Text style={styles.movieArchivePosterFallbackText}>180</Text>
                  </View>
                )}
                <View style={styles.movieArchiveHeaderContent}>
                  <Text style={styles.movieDetailTitle}>{movie.movieTitle}</Text>
                  <Text style={styles.movieDetailMeta}>
                    {movie.year ? `${movie.year} | ` : ''}
                    {copy.lastWatch}: {movie.watchedDayKey || '-'}
                  </Text>
                  <View style={styles.movieArchiveBadgeRow}>
                    <View style={styles.movieArchiveBadge}>
                      <Text style={styles.movieArchiveBadgeText}>{items.length} {copy.commentRecords}</Text>
                    </View>
                    {movie.watchCount > 1 ? (
                      <View style={styles.movieArchiveBadge}>
                        <Text style={styles.movieArchiveBadgeText}>{copy.rewatch} {movie.watchCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.screenMeta}>{copy.profile}: {profileLabel}</Text>
                  <Text
                    style={[
                      styles.screenMeta,
                      status === 'error'
                        ? styles.ritualStateError
                        : status === 'ready'
                          ? styles.ritualStateOk
                          : styles.screenMeta,
                    ]}
                  >
                    {message}
                  </Text>
                </View>
              </View>
            </View>

            {status === 'loading' ? (
              <StatePanel
                tone="clay"
                variant="loading"
                eyebrow={copy.loadingEyebrow}
                title={copy.loadingTitle}
                body={copy.loadingBody}
                meta={`${profileLabel} ${copy.loadingMetaSuffix}`}
              />
            ) : null}

            {status !== 'loading' && items.length === 0 ? (
              <StatePanel
                tone="clay"
                variant={status === 'error' ? 'error' : 'empty'}
                eyebrow={copy.emptyEyebrow}
                title={status === 'error' ? copy.errorTitle : copy.emptyTitle}
                body={status === 'error' ? message || copy.errorBody : copy.emptyBody}
                meta={`${profileLabel} ${copy.emptyMetaSuffix}`}
              />
            ) : null}

            {items.length > 0 ? (
              <View style={styles.movieArchiveEntryList}>
                {items.map((item) => (
                  <View key={item.id} style={styles.movieArchiveEntryCard}>
                    <View style={styles.movieArchiveEntryHeader}>
                      <Text style={styles.movieArchiveEntryDate}>{item.timestampLabel}</Text>
                      {item.year ? (
                        <Text style={styles.movieArchiveEntryGenre}>{item.year}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.movieArchiveEntryBody}>"{item.text}"</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActionStack}>
              <UiButton label={copy.close} tone="neutral" stretch onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
const RitualDraftCard = ({
  targetMovie,
  draftText,
  onDraftTextChange,
  submitState,
  queueState,
  canSubmit,
  isSignedIn,
  onSubmit,
  onFlushQueue,
}: {
  targetMovie: { title: string; genre: string | null; year?: number | null; director?: string | null } | null;
  draftText: string;
  onDraftTextChange: (value: string) => void;
  submitState: RitualSubmitState;
  queueState: RitualQueueState;
  canSubmit: boolean;
  isSignedIn: boolean;
  onSubmit: () => void;
  onFlushQueue: () => void;
}) => {
  const textLength = draftText.length;
  const canRetryQueue = queueState.pendingCount > 0 && queueState.status !== 'syncing' && isSignedIn;
  const filmTitle = targetMovie?.title || 'Yorum Notu';
  const genreLabel = String(targetMovie?.genre || '').trim() || 'Tur bekleniyor';
  const directorLabel =
    String(targetMovie?.director || '').trim() || 'Yonetmen bilgisi bekleniyor';
  const yearLabel = targetMovie?.year ? String(targetMovie.year) : '--';
  const syncedAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (submitState.status === 'synced') {
      syncedAnim.setValue(0.9);
      Animated.spring(syncedAnim, {
        toValue: 1,
        useNativeDriver: SUPPORTS_NATIVE_DRIVER,
        tension: 200,
        friction: 8,
      }).start();
    }
  }, [submitState.status, syncedAnim]);
  const readinessTone =
    !targetMovie || !isSignedIn
      ? 'clay'
      : canSubmit
        ? 'sage'
        : submitState.status === 'submitting'
          ? 'muted'
          : 'muted';
  const submitTone =
    submitState.status === 'error'
      ? 'clay'
      : submitState.status === 'synced'
        ? 'sage'
        : submitState.status === 'queued'
          ? 'clay'
          : 'muted';
  const queueTone =
    queueState.status === 'error'
      ? 'clay'
      : queueState.pendingCount > 0
        ? 'clay'
        : queueState.status === 'done'
          ? 'sage'
          : 'muted';

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Yorum Studio"
        title={filmTitle}
        body="Daily listesinden bir filme kisa, net ve tekrar okunabilir bir not birak. Baglanti kopsa bile taslak kuyrukta korunur."
        badges={[
          { label: genreLabel, tone: 'muted' },
          {
            label: isSignedIn ? 'session ready' : 'session gerekli',
            tone: isSignedIn ? 'sage' : 'clay',
          },
          {
            label: queueState.pendingCount > 0 ? `${queueState.pendingCount} kuyruk` : 'kuyruk temiz',
            tone: queueState.pendingCount > 0 ? 'clay' : 'sage',
          },
        ]}
        metrics={[
          { label: 'Karakter', value: `${textLength}/180` },
          { label: 'Yil', value: yearLabel },
          { label: 'Yonetmen', value: directorLabel !== 'Yonetmen bilgisi bekleniyor' ? 'hazir' : '--' },
        ]}
      />

      <StatusStrip
        tone={readinessTone}
        eyebrow="Composer State"
        title={
          !targetMovie
            ? 'Once bir daily filmi sec'
            : !isSignedIn
              ? 'Yorum kaydi icin oturum ac'
              : canSubmit
                ? 'Yorum gonderime hazir'
                : 'Taslagini sekillendir'
        }
        body={
          !targetMovie
            ? 'Film secimi yapildiginda yorum composer ilgili baslik ve metadata ile dolar.'
            : !isSignedIn
              ? 'Yorumu yazabilirsin ama gonderim ve kuyruk tekrar denemesi icin mobil session gerekir.'
              : canSubmit
                ? 'Notun hazirsa kaydet; baglanti sorunu olursa otomatik olarak kuyrukta tutulur.'
                : 'Birkac net cumle ile filmin sende biraktigi izi toparla, sonra kaydet.'
        }
        meta={targetMovie ? `${genreLabel}${yearLabel !== '--' ? ` | ${yearLabel}` : ''}` : undefined}
      />

      <ScreenCard accent="clay">
        <Text style={styles.subSectionLabel}>Film Brifi</Text>
        <View style={styles.detailInfoGrid}>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Film</Text>
            <Text style={styles.detailInfoValue}>{filmTitle}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Tur</Text>
            <Text style={styles.detailInfoValue}>{genreLabel}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Yonetmen</Text>
            <Text style={styles.detailInfoValue}>{directorLabel}</Text>
          </View>
        </View>

        <TextInput
          style={styles.ritualInput}
          multiline
          textAlignVertical="top"
          placeholder="Yorum notlari..."
          placeholderTextColor="#8e8b84"
          value={draftText}
          maxLength={180}
          onChangeText={onDraftTextChange}
          editable={targetMovie !== null && submitState.status !== 'submitting'}
          accessibilityLabel="Yorum notu giris alani"
        />

        <View style={styles.ritualMetaRow}>
          <Text style={styles.screenMeta}>{textLength}/180</Text>
          <Text style={styles.screenMeta}>Bekleyen kuyruk: {queueState.pendingCount}</Text>
        </View>

        {submitState.message ? (
          <Animated.View style={submitState.status === 'synced' ? { transform: [{ scale: syncedAnim }] } : undefined}>
            <StatusStrip
              tone={submitTone}
              eyebrow="Gonderim"
              title={
                submitState.status === 'synced'
                  ? 'Notun kaydedildi'
                  : submitState.status === 'queued'
                    ? 'Taslak beklemeye alindi'
                    : submitState.status === 'error'
                      ? 'Not gonderilemedi'
                      : submitState.status === 'submitting'
                        ? 'Not gonderiliyor'
                        : 'Taslak beklemede'
              }
              body={submitState.message}
              meta={
                submitState.status === 'queued'
                  ? 'Baglanti geri geldiginde kuyruktan tekrar denenebilir.'
                  : submitState.status === 'synced'
                    ? 'Yeni yorum sosyal akis ve profil arsivine yansir.'
                    : undefined
              }
            />
          </Animated.View>
        ) : null}

        {queueState.message ? (
          <StatusStrip
            tone={queueTone}
            eyebrow="Bekleyenler"
            title={
              queueState.status === 'syncing'
                ? 'Kuyruk tekrar deneniyor'
                : queueState.status === 'done'
                  ? 'Kuyruk temizlendi'
                  : queueState.status === 'error'
                    ? 'Kuyrukta bekleyen taslak var'
                    : 'Kuyruk beklemede'
            }
            body={queueState.message}
            meta={
              queueState.pendingCount > 0
                ? `${queueState.pendingCount} taslak hala bekliyor.`
                : 'Bekleyen kuyruk yok.'
            }
          />
        ) : null}

        <View style={styles.sectionLeadActionRow}>
          <UiButton
            label={submitState.status === 'submitting' ? 'Gonderiliyor...' : 'Yorumu Kaydet'}
            tone="brand"
            stretch
            onPress={onSubmit}
            disabled={submitState.status === 'submitting' || !canSubmit}
          />
          <UiButton
            label={queueState.status === 'syncing' ? 'Kuyruk Senkron...' : 'Kuyrugu Tekrar Dene'}
            tone="neutral"
            stretch
            onPress={onFlushQueue}
            disabled={!canRetryQueue}
          />
        </View>
      </ScreenCard>
    </>
  );
};

type MobileSettingsGender = '' | 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';
type MobileSettingsLanguage = 'en' | 'tr' | 'es' | 'fr';
type MobileSettingsIdentityDraft = {
  fullName: string;
  username: string;
  gender: MobileSettingsGender;
  birthDate: string;
  bio: string;
  avatarUrl: string;
  profileLink: string;
};
type MobileSettingsPrivacyDraft = MobileProfileVisibility;
type MobileSettingsSaveState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  message: string;
};
type MobileSettingsLocaleCopy = {
  settingsTitle: string;
  close: string;
  tabs: {
    identity: string;
    appearance: string;
    privacy: string;
    session: string;
  };
  appearance: {
    eyebrow: string;
    body: string;
    themeMetric: string;
    languageMetric: string;
    livePreviewEyebrow: string;
    livePreviewTitle: string;
    livePreviewBody: string;
    themeTitle: string;
    themeMidnight: string;
    themeDawn: string;
    themeDescription: string;
    themeStatusEyebrow: string;
    themeStatusBodyMidnight: string;
    themeStatusBodyDawn: string;
    languageTitle: string;
    languageDescription: string;
    languageStatusEyebrow: string;
    languageStatusBody: string;
    languageCoverageMeta: string;
  };
  password: {
    title: string;
    body: string;
    newPasswordLabel: string;
    confirmPasswordLabel: string;
    newPasswordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    save: string;
    saveBusy: string;
    signedOutTitle: string;
    signedOutBody: string;
  };
  accountDeletion: {
    title: string;
    body: string;
    meta: string;
    button: string;
    infoButton?: string;
    confirmTitle?: string;
    confirmBody?: string;
    confirmButton?: string;
    cancelButton?: string;
    signedOutBody?: string;
    sectionMeta: string;
    eyebrow: string;
  };
};

const SETTINGS_GENDER_OPTIONS_BY_LANGUAGE: Record<
  MobileSettingsLanguage,
  Array<{ key: MobileSettingsGender; label: string }>
> = {
  tr: [
    { key: '', label: 'Sec' },
    { key: 'female', label: 'Kadin' },
    { key: 'male', label: 'Erkek' },
    { key: 'non_binary', label: 'Ikili olmayan' },
    { key: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' },
  ],
  en: [
    { key: '', label: 'Select' },
    { key: 'female', label: 'Female' },
    { key: 'male', label: 'Male' },
    { key: 'non_binary', label: 'Non-binary' },
    { key: 'prefer_not_to_say', label: 'Prefer not to say' },
  ],
  es: [
    { key: '', label: 'Elegir' },
    { key: 'female', label: 'Mujer' },
    { key: 'male', label: 'Hombre' },
    { key: 'non_binary', label: 'No binario' },
    { key: 'prefer_not_to_say', label: 'Prefiero no decirlo' },
  ],
  fr: [
    { key: '', label: 'Choisir' },
    { key: 'female', label: 'Femme' },
    { key: 'male', label: 'Homme' },
    { key: 'non_binary', label: 'Non binaire' },
    { key: 'prefer_not_to_say', label: 'Je prefere ne pas le dire' },
  ],
};
const MOBILE_SETTINGS_IDENTITY_FIELD_COPY: Record<MobileSettingsLanguage, string> = {
  tr: 'Cinsiyet',
  en: 'Gender',
  es: 'Genero',
  fr: 'Genre',
};
const SETTINGS_PLATFORM_RULES: Record<MobileSettingsLanguage, string[]> = {
  tr: [
    'Yorum notlari net, kisa ve konu odakli olmali.',
    'Toksik/nefret dili ve spam icerik kaldirilir.',
    'Ayni davet kodunu kotuye kullanma davranisi engellenir.',
    'Tekrarlayan ihlallerde hesap aksiyonu uygulanabilir.',
  ],
  en: [
    'Comment notes should stay clear, concise, and focused on the title.',
    'Toxic or hateful language and spam content are removed.',
    'Repeated abuse of the same invite code is blocked.',
    'Repeated violations can trigger account action.',
  ],
  es: [
    'Las notas de comentarios deben ser claras, breves y centradas en la pelicula.',
    'Se elimina el lenguaje toxico, de odio y el spam.',
    'Se bloquea el abuso repetido del mismo codigo de invitacion.',
    'Las infracciones repetidas pueden activar acciones sobre la cuenta.',
  ],
  fr: [
    'Les notes de commentaire doivent rester claires, courtes et centrees sur le film.',
    'Le langage toxique, haineux et le spam sont supprimes.',
    'L abus repete du meme code d invitation est bloque.',
    'Les infractions repetees peuvent entrainer une action sur le compte.',
  ],
};
const MOBILE_SETTINGS_RULES_CARD_COPY: Record<
  MobileSettingsLanguage,
  {
    title: string;
    meta: string;
    body: string;
  }
> = {
  tr: {
    title: 'Platform Kurallari',
    meta: 'Topluluk notlari',
    body: 'Topluluk guvenligi ve kalite standartlari bu ayar panelinde de gorunur.',
  },
  en: {
    title: 'Platform Rules',
    meta: 'Community notes',
    body: 'Community safety and quality standards are also visible inside this settings panel.',
  },
  es: {
    title: 'Reglas de la Plataforma',
    meta: 'Notas de la comunidad',
    body: 'Las reglas de seguridad y calidad de la comunidad tambien aparecen en este panel de ajustes.',
  },
  fr: {
    title: 'Regles de la Plateforme',
    meta: 'Notes de la communaute',
    body: 'Les regles de securite et de qualite de la communaute sont aussi visibles dans ce panneau de reglages.',
  },
};

const MOBILE_SETTINGS_STATUS_COPY: Record<
  MobileSettingsLanguage,
  {
    eyebrow: string;
    saveFailed: string;
    saveCompleted: string;
    draftUpdated: string;
    signedInMeta: string;
    signedOutMeta: string;
  }
> = {
  tr: {
    eyebrow: 'Durum',
    saveFailed: 'Kayit basarisiz',
    saveCompleted: 'Kayit tamamlandi',
    draftUpdated: 'Taslak guncellendi',
    signedInMeta: 'Degisikliklerin hesabinla saklanir.',
    signedOutMeta: 'Kaydetmek icin once giris yap.',
  },
  en: {
    eyebrow: 'Status',
    saveFailed: 'Save failed',
    saveCompleted: 'Save complete',
    draftUpdated: 'Draft updated',
    signedInMeta: 'Your changes are saved with your account.',
    signedOutMeta: 'Sign in first to save changes.',
  },
  es: {
    eyebrow: 'Estado',
    saveFailed: 'Guardado fallido',
    saveCompleted: 'Guardado completo',
    draftUpdated: 'Borrador actualizado',
    signedInMeta: 'Tus cambios se guardan con tu cuenta.',
    signedOutMeta: 'Inicia sesion primero para guardar cambios.',
  },
  fr: {
    eyebrow: 'Etat',
    saveFailed: 'Echec de la sauvegarde',
    saveCompleted: 'Sauvegarde terminee',
    draftUpdated: 'Brouillon mis a jour',
    signedInMeta: 'Tes changements sont enregistres avec ton compte.',
    signedOutMeta: 'Connecte-toi d abord pour sauvegarder les changements.',
  },
};

const MOBILE_SETTINGS_IDENTITY_COPY: Record<
  MobileSettingsLanguage,
  {
    leadEyebrow: string;
    leadFallbackTitle: string;
    leadFallbackBody: string;
    usernamePending: string;
    avatarReady: string;
    avatarEmpty: string;
    metricBio: string;
    metricProfile: string;
    metricBirth: string;
    metricReady: string;
    metricSet: string;
    signedOutEyebrow: string;
    signedOutTitle: string;
    signedOutBody: string;
    avatarSectionTitle: string;
    avatarSectionMetaFallback: string;
    avatarSelecting: string;
    avatarPick: string;
    avatarClear: string;
    avatarEyebrow: string;
    avatarSelected: string;
    avatarOptional: string;
    avatarSelectedBody: string;
    avatarOptionalBody: string;
    fullNamePlaceholder: string;
    fullNameAccessibility: string;
    usernamePlaceholder: string;
    usernameAccessibility: string;
    birthPlaceholder: string;
    birthAccessibility: string;
    userDetailLabel: string;
    userDetailFallback: string;
    birthDetailLabel: string;
    birthDetailFallback: string;
    aboutSectionTitle: string;
    characterCountMeta: (count: number) => string;
    aboutPlaceholder: string;
    aboutAccessibility: string;
    profileLinkPlaceholder: string;
    profileLinkAccessibility: string;
    profileLinkEyebrow: string;
    profileLinkReady: string;
    profileLinkOptional: string;
    profileLinkOptionalBody: string;
    saveBusy: string;
    save: string;
    letterboxdMetaFallback: string;
    letterboxdSignedOutTitle: string;
    letterboxdSignedOutBody: string;
    letterboxdEyebrow: string;
    letterboxdImportNone: string;
    letterboxdImportBody: string;
    letterboxdImportBusy: string;
    letterboxdImport: string;
  }
> = {
  tr: {
    leadEyebrow: 'Profil',
    leadFallbackTitle: 'Profil Kimligi',
    leadFallbackBody: 'Profilini duzenle.',
    usernamePending: 'kullanici adi bekleniyor',
    avatarReady: 'Avatar hazir',
    avatarEmpty: 'Avatar bos',
    metricBio: 'Yazi',
    metricProfile: 'Profil',
    metricBirth: 'Dogum',
    metricReady: 'hazir',
    metricSet: 'var',
    signedOutEyebrow: 'Kayit',
    signedOutTitle: 'Taslak hazir',
    signedOutBody: 'Kaydetmek icin giris yap.',
    avatarSectionTitle: 'Avatar ve Temel Bilgiler',
    avatarSectionMetaFallback: 'Profil girisi',
    avatarSelecting: 'Seciliyor...',
    avatarPick: 'Cihazdan Sec',
    avatarClear: 'Temizle',
    avatarEyebrow: 'Avatar',
    avatarSelected: 'Avatar secildi',
    avatarOptional: 'Avatar opsiyonel',
    avatarSelectedBody: 'Profilinde kullanilacak.',
    avatarOptionalBody: 'Istersen bos birak.',
    fullNamePlaceholder: 'Ad Soyad',
    fullNameAccessibility: 'Ad Soyad',
    usernamePlaceholder: 'Kullanici adi',
    usernameAccessibility: 'Kullanici adi',
    birthPlaceholder: 'Dogum tarihi (GG/AA/YYYY)',
    birthAccessibility: 'Dogum tarihi',
    userDetailLabel: 'Kullanici',
    userDetailFallback: 'Kullanici adi bekleniyor',
    birthDetailLabel: 'Dogum',
    birthDetailFallback: 'Henuz dogum tarihi girilmedi',
    aboutSectionTitle: 'Hakkimda ve Profil Linki',
    characterCountMeta: (count: number) => `${count}/180 karakter`,
    aboutPlaceholder: 'Hakkimda (maks 180)',
    aboutAccessibility: 'Hakkimda',
    profileLinkPlaceholder: 'Web sitesi veya sosyal profil URL',
    profileLinkAccessibility: 'Profil Linki',
    profileLinkEyebrow: 'Profil Linki',
    profileLinkReady: 'Link hazir',
    profileLinkOptional: 'Link opsiyonel',
    profileLinkOptionalBody: 'Istersen profiline link ekle.',
    saveBusy: 'Kaydediliyor...',
    save: 'Kimligi Kaydet',
    letterboxdMetaFallback: 'Import et',
    letterboxdSignedOutTitle: 'Import icin giris yap',
    letterboxdSignedOutBody: 'CSV dosyani hesabinla ekle.',
    letterboxdEyebrow: 'Import',
    letterboxdImportNone: 'Henuz import yok',
    letterboxdImportBody: 'CSV sec ve ekle.',
    letterboxdImportBusy: 'Import ediliyor...',
    letterboxdImport: 'Letterboxd CSV Sec',
  },
  en: {
    leadEyebrow: 'Profile',
    leadFallbackTitle: 'Profile Identity',
    leadFallbackBody: 'Update your profile details.',
    usernamePending: 'username pending',
    avatarReady: 'Avatar ready',
    avatarEmpty: 'No avatar',
    metricBio: 'Bio',
    metricProfile: 'Profile',
    metricBirth: 'Birth',
    metricReady: 'ready',
    metricSet: 'set',
    signedOutEyebrow: 'Save',
    signedOutTitle: 'Draft ready',
    signedOutBody: 'Sign in to save.',
    avatarSectionTitle: 'Avatar and Basic Info',
    avatarSectionMetaFallback: 'Profile entry',
    avatarSelecting: 'Picking...',
    avatarPick: 'Pick From Device',
    avatarClear: 'Clear',
    avatarEyebrow: 'Avatar',
    avatarSelected: 'Avatar selected',
    avatarOptional: 'Avatar optional',
    avatarSelectedBody: 'It will appear on your profile.',
    avatarOptionalBody: 'You can leave it empty if you want.',
    fullNamePlaceholder: 'Full name',
    fullNameAccessibility: 'Full name',
    usernamePlaceholder: 'Username',
    usernameAccessibility: 'Username',
    birthPlaceholder: 'Birth date (DD/MM/YYYY)',
    birthAccessibility: 'Birth date',
    userDetailLabel: 'User',
    userDetailFallback: 'Username pending',
    birthDetailLabel: 'Birth',
    birthDetailFallback: 'No birth date yet',
    aboutSectionTitle: 'About and Profile Link',
    characterCountMeta: (count: number) => `${count}/180 characters`,
    aboutPlaceholder: 'About me (max 180)',
    aboutAccessibility: 'About me',
    profileLinkPlaceholder: 'Website or social profile URL',
    profileLinkAccessibility: 'Profile Link',
    profileLinkEyebrow: 'Profile Link',
    profileLinkReady: 'Link ready',
    profileLinkOptional: 'Link optional',
    profileLinkOptionalBody: 'Add a link if you want.',
    saveBusy: 'Saving...',
    save: 'Save Identity',
    letterboxdMetaFallback: 'Import status',
    letterboxdSignedOutTitle: 'Sign in to import',
    letterboxdSignedOutBody: 'Add your CSV with your account.',
    letterboxdEyebrow: 'Import',
    letterboxdImportNone: 'No import yet',
    letterboxdImportBody: 'Pick a CSV file to add it.',
    letterboxdImportBusy: 'Importing...',
    letterboxdImport: 'Select Letterboxd CSV',
  },
  es: {
    leadEyebrow: 'Perfil',
    leadFallbackTitle: 'Identidad del Perfil',
    leadFallbackBody: 'Actualiza los detalles de tu perfil.',
    usernamePending: 'nombre de usuario pendiente',
    avatarReady: 'Avatar listo',
    avatarEmpty: 'Sin avatar',
    metricBio: 'Bio',
    metricProfile: 'Perfil',
    metricBirth: 'Nacimiento',
    metricReady: 'listo',
    metricSet: 'cargado',
    signedOutEyebrow: 'Guardado',
    signedOutTitle: 'Borrador listo',
    signedOutBody: 'Inicia sesion para guardar.',
    avatarSectionTitle: 'Avatar e Informacion Basica',
    avatarSectionMetaFallback: 'Entrada del perfil',
    avatarSelecting: 'Eligiendo...',
    avatarPick: 'Elegir Desde el Dispositivo',
    avatarClear: 'Limpiar',
    avatarEyebrow: 'Avatar',
    avatarSelected: 'Avatar seleccionado',
    avatarOptional: 'Avatar opcional',
    avatarSelectedBody: 'Se usara en tu perfil.',
    avatarOptionalBody: 'Puedes dejarlo vacio si quieres.',
    fullNamePlaceholder: 'Nombre completo',
    fullNameAccessibility: 'Nombre completo',
    usernamePlaceholder: 'Nombre de usuario',
    usernameAccessibility: 'Nombre de usuario',
    birthPlaceholder: 'Fecha de nacimiento (DD/MM/AAAA)',
    birthAccessibility: 'Fecha de nacimiento',
    userDetailLabel: 'Usuario',
    userDetailFallback: 'nombre de usuario pendiente',
    birthDetailLabel: 'Nacimiento',
    birthDetailFallback: 'Aun no hay fecha de nacimiento',
    aboutSectionTitle: 'Acerca de y Enlace del Perfil',
    characterCountMeta: (count: number) => `${count}/180 caracteres`,
    aboutPlaceholder: 'Sobre mi (max 180)',
    aboutAccessibility: 'Sobre mi',
    profileLinkPlaceholder: 'Sitio web o URL de perfil social',
    profileLinkAccessibility: 'Enlace del perfil',
    profileLinkEyebrow: 'Enlace del Perfil',
    profileLinkReady: 'Enlace listo',
    profileLinkOptional: 'Enlace opcional',
    profileLinkOptionalBody: 'Agrega un enlace si quieres.',
    saveBusy: 'Guardando...',
    save: 'Guardar Identidad',
    letterboxdMetaFallback: 'Estado de importacion',
    letterboxdSignedOutTitle: 'Inicia sesion para importar',
    letterboxdSignedOutBody: 'Agrega tu CSV con tu cuenta.',
    letterboxdEyebrow: 'Importacion',
    letterboxdImportNone: 'Todavia no hay importacion',
    letterboxdImportBody: 'Elige un CSV para agregarlo.',
    letterboxdImportBusy: 'Importando...',
    letterboxdImport: 'Seleccionar CSV de Letterboxd',
  },
  fr: {
    leadEyebrow: 'Profil',
    leadFallbackTitle: 'Identite du Profil',
    leadFallbackBody: 'Mets a jour les details de ton profil.',
    usernamePending: "nom d utilisateur en attente",
    avatarReady: 'Avatar pret',
    avatarEmpty: "Pas d avatar",
    metricBio: 'Bio',
    metricProfile: 'Profil',
    metricBirth: 'Naissance',
    metricReady: 'pret',
    metricSet: 'renseigne',
    signedOutEyebrow: 'Sauvegarde',
    signedOutTitle: 'Brouillon pret',
    signedOutBody: 'Connecte-toi pour sauvegarder.',
    avatarSectionTitle: 'Avatar et Informations de Base',
    avatarSectionMetaFallback: 'Entree du profil',
    avatarSelecting: 'Selection...',
    avatarPick: "Choisir Depuis l Appareil",
    avatarClear: 'Effacer',
    avatarEyebrow: 'Avatar',
    avatarSelected: 'Avatar selectionne',
    avatarOptional: 'Avatar optionnel',
    avatarSelectedBody: 'Il sera utilise sur ton profil.',
    avatarOptionalBody: 'Tu peux le laisser vide si tu veux.',
    fullNamePlaceholder: 'Nom complet',
    fullNameAccessibility: 'Nom complet',
    usernamePlaceholder: "Nom d utilisateur",
    usernameAccessibility: "Nom d utilisateur",
    birthPlaceholder: 'Date de naissance (JJ/MM/AAAA)',
    birthAccessibility: 'Date de naissance',
    userDetailLabel: 'Utilisateur',
    userDetailFallback: "nom d utilisateur en attente",
    birthDetailLabel: 'Naissance',
    birthDetailFallback: 'Aucune date de naissance pour le moment',
    aboutSectionTitle: 'A Propos et Lien du Profil',
    characterCountMeta: (count: number) => `${count}/180 caracteres`,
    aboutPlaceholder: 'A propos de moi (max 180)',
    aboutAccessibility: 'A propos de moi',
    profileLinkPlaceholder: 'Site web ou URL de profil social',
    profileLinkAccessibility: 'Lien du profil',
    profileLinkEyebrow: 'Lien du Profil',
    profileLinkReady: 'Lien pret',
    profileLinkOptional: 'Lien optionnel',
    profileLinkOptionalBody: 'Ajoute un lien si tu veux.',
    saveBusy: 'Sauvegarde...',
    save: "Sauvegarder l Identite",
    letterboxdMetaFallback: "Etat de l import",
    letterboxdSignedOutTitle: 'Connecte-toi pour importer',
    letterboxdSignedOutBody: 'Ajoute ton CSV avec ton compte.',
    letterboxdEyebrow: 'Import',
    letterboxdImportNone: "Pas encore d import",
    letterboxdImportBody: "Choisis un fichier CSV pour l ajouter.",
    letterboxdImportBusy: 'Import en cours...',
    letterboxdImport: 'Choisir le CSV Letterboxd',
  },
};

const MOBILE_SETTINGS_COPY: Record<MobileSettingsLanguage, MobileSettingsLocaleCopy> = {
  en: {
    settingsTitle: 'Settings',
    close: 'Close',
    tabs: {
      identity: 'Identity',
      appearance: 'Appearance',
      privacy: 'Privacy',
      session: 'Session',
    },
    appearance: {
      eyebrow: 'Appearance',
      body: 'Theme and language changes apply to the settings surface right away.',
      themeMetric: 'Theme',
      languageMetric: 'Language',
      livePreviewEyebrow: 'Live Preview',
      livePreviewTitle: 'Changes appear instantly',
      livePreviewBody: 'Theme and language changes apply without waiting for an extra save action.',
      themeTitle: 'Theme',
      themeMidnight: 'Midnight',
      themeDawn: 'Dawn',
      themeDescription: 'Choose the midnight or dawn surface that fits the device feel you want.',
      themeStatusEyebrow: 'Theme Status',
      themeStatusBodyMidnight: 'Midnight theme keeps the darker cinema atmosphere active.',
      themeStatusBodyDawn: 'Dawn theme switches the settings surface to a brighter and warmer tone.',
      languageTitle: 'Language',
      languageDescription: 'Pick the interface language you prefer. Supported settings surfaces update immediately.',
      languageStatusEyebrow: 'Language',
      languageStatusBody: 'Selected language is shown across supported settings surfaces.',
      languageCoverageMeta: 'Language coverage on mobile is being expanded screen by screen.',
    },
    password: {
      title: 'Password',
      body: 'Set a new password for email login. Social login access stays available.',
      newPasswordLabel: 'New Password',
      confirmPasswordLabel: 'Confirm Password',
      newPasswordPlaceholder: 'new password (minimum 6 characters)',
      confirmPasswordPlaceholder: 'repeat new password',
      save: 'Update Password',
      saveBusy: 'Updating...',
      signedOutTitle: 'Sign in required',
      signedOutBody: 'Sign in first to change your password.',
    },
    accountDeletion: {
      title: 'Account Deletion',
      body: 'Open the published deletion page to review the request path, deleted data, and retained records.',
      meta: 'Submit the request from the email tied to the account through the App Store support channel.',
      button: 'Open Deletion Page',
      sectionMeta: 'Web request path',
      eyebrow: 'Request Flow',
    },
  },
  tr: {
    settingsTitle: 'Ayarlar',
    close: 'Kapat',
    tabs: {
      identity: 'Kimlik',
      appearance: 'Gorunum',
      privacy: 'Gizlilik',
      session: 'Oturum',
    },
    appearance: {
      eyebrow: 'Gorunum',
      body: 'Tema ve dil secimleri ayar yuzeyine aninda uygulanir.',
      themeMetric: 'Tema',
      languageMetric: 'Dil',
      livePreviewEyebrow: 'Canli Onizleme',
      livePreviewTitle: 'Degisiklikler aninda gorunur',
      livePreviewBody: 'Tema ve dil secimleri ek kayit adimi beklemeden uygulanir.',
      themeTitle: 'Tema',
      themeMidnight: 'Gece',
      themeDawn: 'Gunduz',
      themeDescription: 'Cihaz hissine en uygun gece ya da gunduz yuzeyini sec.',
      themeStatusEyebrow: 'Tema Durumu',
      themeStatusBodyMidnight: 'Koyu sinema hissini koruyan gece temasi aktif.',
      themeStatusBodyDawn: 'Daha aydinlik ve sicak tonlu yuzeyler acik.',
      languageTitle: 'Dil',
      languageDescription: 'Arayuz kopyasini tercih ettigin dile cek. Desteklenen ayar yuzeyleri aninda guncellenir.',
      languageStatusEyebrow: 'Dil',
      languageStatusBody: 'Secili dil desteklenen ayar yuzeylerinde gosteriliyor.',
      languageCoverageMeta: 'Mobil yerellestirme kapsami ekran bazli olarak genislemeye devam eder.',
    },
    password: {
      title: 'Sifre',
      body: 'E-posta ile giris icin yeni bir sifre belirle. Sosyal giris yollarin kullanilmaya devam eder.',
      newPasswordLabel: 'Yeni Sifre',
      confirmPasswordLabel: 'Yeni Sifre Tekrar',
      newPasswordPlaceholder: 'yeni sifre (minimum 6 karakter)',
      confirmPasswordPlaceholder: 'yeni sifreyi tekrar yaz',
      save: 'Sifreyi Guncelle',
      saveBusy: 'Guncelleniyor...',
      signedOutTitle: 'Giris gerekli',
      signedOutBody: 'Sifre degistirmek icin once giris yap.',
    },
    accountDeletion: {
      title: 'Hesap Silme',
      body: 'Talep yolu, silinen veriler ve saklanan kayit notlari icin yayindaki hesap silme sayfasini ac.',
      meta: 'Talebi, hesaba bagli e-posta ile App Store destek kanali uzerinden gonder.',
      button: 'Silme Sayfasini Ac',
      sectionMeta: 'Web talep yolu',
      eyebrow: 'Talep Akisi',
    },
  },
  es: {
    settingsTitle: 'Ajustes',
    close: 'Cerrar',
    tabs: {
      identity: 'Identidad',
      appearance: 'Apariencia',
      privacy: 'Privacidad',
      session: 'Sesion',
    },
    appearance: {
      eyebrow: 'Apariencia',
      body: 'Los cambios de tema e idioma se aplican al panel de ajustes al instante.',
      themeMetric: 'Tema',
      languageMetric: 'Idioma',
      livePreviewEyebrow: 'Vista Previa',
      livePreviewTitle: 'Los cambios se ven al instante',
      livePreviewBody: 'Tema e idioma se aplican sin esperar un guardado adicional.',
      themeTitle: 'Tema',
      themeMidnight: 'Noche',
      themeDawn: 'Dia',
      themeDescription: 'Elige la superficie nocturna o diurna que mejor encaje con la sensacion del dispositivo.',
      themeStatusEyebrow: 'Estado del Tema',
      themeStatusBodyMidnight: 'El tema nocturno mantiene activa la atmosfera mas cinematografica y oscura.',
      themeStatusBodyDawn: 'El tema diurno mueve la superficie de ajustes a un tono mas claro y calido.',
      languageTitle: 'Idioma',
      languageDescription: 'Elige el idioma de interfaz que prefieras. Las superficies de ajustes compatibles se actualizan al instante.',
      languageStatusEyebrow: 'Idioma',
      languageStatusBody: 'El idioma seleccionado se muestra en las superficies de ajustes compatibles.',
      languageCoverageMeta: 'La cobertura de idioma en mobile sigue ampliandose pantalla por pantalla.',
    },
    password: {
      title: 'Contrasena',
      body: 'Define una nueva contrasena para el acceso por correo. El acceso social sigue disponible.',
      newPasswordLabel: 'Nueva Contrasena',
      confirmPasswordLabel: 'Confirmar Contrasena',
      newPasswordPlaceholder: 'nueva contrasena (minimo 6 caracteres)',
      confirmPasswordPlaceholder: 'repite la nueva contrasena',
      save: 'Actualizar Contrasena',
      saveBusy: 'Actualizando...',
      signedOutTitle: 'Inicia sesion',
      signedOutBody: 'Inicia sesion primero para cambiar tu contrasena.',
    },
    accountDeletion: {
      title: 'Eliminacion de Cuenta',
      body: 'Abre la pagina publicada de eliminacion para revisar el flujo de solicitud, los datos eliminados y los registros conservados.',
      meta: 'Envia la solicitud desde el correo asociado a la cuenta mediante el canal de soporte de la App Store.',
      button: 'Abrir Pagina de Eliminacion',
      sectionMeta: 'Ruta web de solicitud',
      eyebrow: 'Flujo de Solicitud',
    },
  },
  fr: {
    settingsTitle: 'Reglages',
    close: 'Fermer',
    tabs: {
      identity: 'Identite',
      appearance: 'Apparence',
      privacy: 'Confidentialite',
      session: 'Session',
    },
    appearance: {
      eyebrow: 'Apparence',
      body: 'Les changements de theme et de langue sont appliques tout de suite a la surface des reglages.',
      themeMetric: 'Theme',
      languageMetric: 'Langue',
      livePreviewEyebrow: 'Apercu',
      livePreviewTitle: 'Les changements apparaissent tout de suite',
      livePreviewBody: 'Le theme et la langue sont appliques sans attendre une sauvegarde supplementaire.',
      themeTitle: 'Theme',
      themeMidnight: 'Nuit',
      themeDawn: 'Jour',
      themeDescription: 'Choisis la surface nuit ou jour qui correspond le mieux au ressenti voulu sur l appareil.',
      themeStatusEyebrow: 'Etat du Theme',
      themeStatusBodyMidnight: 'Le theme nuit garde une atmosphere cinema plus sombre.',
      themeStatusBodyDawn: 'Le theme jour rend la surface des reglages plus claire et plus chaude.',
      languageTitle: 'Langue',
      languageDescription: 'Choisis la langue d interface que tu preferes. Les surfaces de reglages prises en charge se mettent a jour immediatement.',
      languageStatusEyebrow: 'Langue',
      languageStatusBody: 'La langue choisie est affichee sur les surfaces de reglages prises en charge.',
      languageCoverageMeta: 'La couverture de langue sur mobile continue de progresser ecran par ecran.',
    },
    password: {
      title: 'Mot de Passe',
      body: 'Definis un nouveau mot de passe pour la connexion e-mail. Les connexions sociales restent actives.',
      newPasswordLabel: 'Nouveau Mot de Passe',
      confirmPasswordLabel: 'Confirmer le Mot de Passe',
      newPasswordPlaceholder: 'nouveau mot de passe (minimum 6 caracteres)',
      confirmPasswordPlaceholder: 'repete le nouveau mot de passe',
      save: 'Mettre a Jour le Mot de Passe',
      saveBusy: 'Mise a jour...',
      signedOutTitle: 'Connexion requise',
      signedOutBody: 'Connecte-toi d abord pour changer ton mot de passe.',
    },
    accountDeletion: {
      title: 'Suppression du Compte',
      body: 'Ouvre la page publiee de suppression pour revoir le parcours de demande, les donnees supprimees et les donnees conservees.',
      meta: 'Envoie la demande depuis l e-mail lie au compte via le canal support de l App Store.',
      button: 'Ouvrir la Page de Suppression',
      sectionMeta: 'Parcours web de demande',
      eyebrow: 'Parcours de Demande',
    },
  },
};

const MOBILE_SETTINGS_PRIVACY_COPY: Record<
  MobileSettingsLanguage,
  {
    eyebrow: string;
    title: string;
    body: string;
    statsVisible: string;
    statsHidden: string;
    followsVisible: string;
    followsHidden: string;
    marksVisible: string;
    marksHidden: string;
    metricMarks: string;
    metricFollows: string;
    visible: string;
    hidden: string;
    showStatsTitle: string;
    showStatsBody: string;
    showFollowsTitle: string;
    showFollowsBody: string;
    showMarksTitle: string;
    showMarksBody: string;
    save: string;
    saveBusy: string;
  }
> = {
  tr: {
    eyebrow: 'Gizlilik',
    title: 'Profil gorunurlugu',
    body: 'Baska izleyicilere hangi alanlarin gorunecegini sec.',
    statsVisible: 'Istatistik acik',
    statsHidden: 'Istatistik gizli',
    followsVisible: 'Takip sayilari acik',
    followsHidden: 'Takip sayilari gizli',
    marksVisible: 'Marklar acik',
    marksHidden: 'Marklar gizli',
    metricMarks: 'Mark',
    metricFollows: 'Takip',
    visible: 'acik',
    hidden: 'gizli',
    showStatsTitle: 'Istatistikleri goster',
    showStatsBody: 'Yorum, streak ve gun ozetini profilde goster.',
    showFollowsTitle: 'Takip sayilarini goster',
    showFollowsBody: 'Takip ve takipci sayilari gorunsun.',
    showMarksTitle: 'Marklari goster',
    showMarksBody: 'Acilan marklar profilde gorunsun.',
    save: 'Gizliligi Kaydet',
    saveBusy: 'Kaydediliyor...',
  },
  en: {
    eyebrow: 'Privacy',
    title: 'Public profile visibility',
    body: 'Choose which areas are visible to other viewers.',
    statsVisible: 'Stats visible',
    statsHidden: 'Stats hidden',
    followsVisible: 'Follow counts visible',
    followsHidden: 'Follow counts hidden',
    marksVisible: 'Marks visible',
    marksHidden: 'Marks hidden',
    metricMarks: 'Marks',
    metricFollows: 'Follows',
    visible: 'visible',
    hidden: 'hidden',
    showStatsTitle: 'Show stats',
    showStatsBody: 'Show comments, streak, and daily summary on the profile.',
    showFollowsTitle: 'Show follow counts',
    showFollowsBody: 'Let follow and follower totals appear publicly.',
    showMarksTitle: 'Show marks',
    showMarksBody: 'Display unlocked marks on the profile.',
    save: 'Save Privacy',
    saveBusy: 'Saving...',
  },
  es: {
    eyebrow: 'Privacidad',
    title: 'Visibilidad del perfil publico',
    body: 'Elige que areas pueden ver otros usuarios.',
    statsVisible: 'Estadisticas visibles',
    statsHidden: 'Estadisticas ocultas',
    followsVisible: 'Conteos visibles',
    followsHidden: 'Conteos ocultos',
    marksVisible: 'Marcas visibles',
    marksHidden: 'Marcas ocultas',
    metricMarks: 'Marcas',
    metricFollows: 'Seguimientos',
    visible: 'visible',
    hidden: 'oculto',
    showStatsTitle: 'Mostrar estadisticas',
    showStatsBody: 'Muestra comentarios, racha y resumen diario en el perfil.',
    showFollowsTitle: 'Mostrar conteos',
    showFollowsBody: 'Haz publicos los totales de seguidos y seguidores.',
    showMarksTitle: 'Mostrar marcas',
    showMarksBody: 'Muestra las marcas desbloqueadas en el perfil.',
    save: 'Guardar privacidad',
    saveBusy: 'Guardando...',
  },
  fr: {
    eyebrow: 'Confidentialite',
    title: 'Visibilite du profil public',
    body: 'Choisissez les zones visibles par les autres utilisateurs.',
    statsVisible: 'Statistiques visibles',
    statsHidden: 'Statistiques masquees',
    followsVisible: 'Compteurs visibles',
    followsHidden: 'Compteurs masques',
    marksVisible: 'Marques visibles',
    marksHidden: 'Marques masquees',
    metricMarks: 'Marques',
    metricFollows: 'Abonnements',
    visible: 'visible',
    hidden: 'masque',
    showStatsTitle: 'Afficher les statistiques',
    showStatsBody: 'Affiche les commentaires, la serie et le resume du jour sur le profil.',
    showFollowsTitle: 'Afficher les compteurs',
    showFollowsBody: 'Rend publics les totaux d abonnes et d abonnements.',
    showMarksTitle: 'Afficher les marques',
    showMarksBody: 'Affiche les marques debloquees sur le profil.',
    save: 'Enregistrer la confidentialite',
    saveBusy: 'Enregistrement...',
  },
};const MOBILE_ACCOUNT_DELETION_RUNTIME_COPY: Record<
  MobileSettingsLanguage,
  {
    body: string;
    meta: string;
    button: string;
    infoButton: string;
    confirmTitle: string;
    confirmBody: string;
    confirmButton: string;
    cancelButton: string;
    signedOutBody: string;
    sectionMeta: string;
    eyebrow: string;
  }
> = {
  en: {
    body: 'Delete your account and the account-linked data tied to your profile, comments, follows, referrals, and push state.',
    meta: 'This action is permanent. Limited security and abuse-prevention records may be retained for a short period.',
    button: 'Delete Account',
    infoButton: 'Review Deletion Policy',
    confirmTitle: 'Delete this account permanently?',
    confirmBody: 'Your profile, comments, replies, follows, referral state, and account-linked push data will be removed after confirmation.',
    confirmButton: 'Delete Permanently',
    cancelButton: 'Keep Account',
    signedOutBody: 'Sign in first to delete your account from inside the app.',
    sectionMeta: 'Permanent removal',
    eyebrow: 'Self-Service',
  },
  tr: {
    body: 'Profilin, yorumlarin, takiplerin, davet durumun ve hesaba bagli push verilerinle birlikte hesabini uygulama icinden kalici olarak sil.',
    meta: 'Bu islem geri alinmaz. Guvenlik ve kotuye kullanim kayitlarinin sinirli bir kismi kisa sure saklanabilir.',
    button: 'Hesabi Sil',
    infoButton: 'Silme Politikasini Ac',
    confirmTitle: 'Bu hesabi kalici olarak silmek istiyor musun?',
    confirmBody: 'Onaydan sonra profilin, yorumlarin, yanitlarin, takiplerin, davet verin ve hesaba bagli push durumu silinir.',
    confirmButton: 'Kalici Olarak Sil',
    cancelButton: 'Hesabi Koru',
    signedOutBody: 'Uygulama icinden hesap silmek icin once giris yapman gerekiyor.',
    sectionMeta: 'Kalici silme',
    eyebrow: 'Self-Service',
  },
  es: {
    body: 'Elimina tu cuenta y los datos ligados a tu perfil, comentarios, seguimientos, referidos y estado push desde la app.',
    meta: 'Esta accion es permanente. Algunos registros limitados de seguridad y abuso pueden conservarse por poco tiempo.',
    button: 'Eliminar Cuenta',
    infoButton: 'Abrir Politica de Eliminacion',
    confirmTitle: 'Eliminar esta cuenta de forma permanente?',
    confirmBody: 'Tras confirmar, se eliminaran tu perfil, comentarios, respuestas, seguimientos, referidos y datos push vinculados a la cuenta.',
    confirmButton: 'Eliminar Permanentemente',
    cancelButton: 'Conservar Cuenta',
    signedOutBody: 'Inicia sesion primero para eliminar tu cuenta desde la app.',
    sectionMeta: 'Eliminacion permanente',
    eyebrow: 'Self-Service',
  },
  fr: {
    body: 'Supprime ton compte et les donnees liees a ton profil, tes commentaires, tes suivis, tes invitations et ton etat push directement depuis l app.',
    meta: 'Cette action est definitive. Certains enregistrements limites de securite et de prevention des abus peuvent etre conserves pendant une courte periode.',
    button: 'Supprimer le Compte',
    infoButton: 'Ouvrir la Politique',
    confirmTitle: 'Supprimer ce compte definitivement ?',
    confirmBody: 'Apres confirmation, ton profil, tes commentaires, tes reponses, tes suivis, tes invitations et tes donnees push liees au compte seront supprimes.',
    confirmButton: 'Supprimer Definitivement',
    cancelButton: 'Conserver le Compte',
    signedOutBody: 'Connecte-toi d abord pour supprimer ton compte depuis l app.',
    sectionMeta: 'Suppression definitive',
    eyebrow: 'Self-Service',
  },
};

const RitualComposerModal = ({
  visible,
  targetMovie,
  draftText,
  onDraftTextChange,
  submitState,
  queueState,
  canSubmit,
  isSignedIn,
  language = 'tr',
  onSubmit,
  onFlushQueue,
  onClose,
}: {
  visible: boolean;
  targetMovie: { title: string; genre: string | null; year?: number | null; director?: string | null } | null;
  draftText: string;
  onDraftTextChange: (value: string) => void;
  submitState: RitualSubmitState;
  queueState: RitualQueueState;
  canSubmit: boolean;
  isSignedIn: boolean;
  language?: MobileSettingsLanguage;
  onSubmit: () => void;
  onFlushQueue: () => void;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(targetMovie));
  if (!visible || !targetMovie) return null;
  const copy =
    language === 'tr'
      ? { title: 'Yorum Yaz', close: 'Kapat' }
      : language === 'es'
        ? { title: 'Escribir Comentario', close: 'Cerrar' }
        : language === 'fr'
          ? { title: 'Ecrire un Commentaire', close: 'Fermer' }
          : { title: 'Write Comment', close: 'Close' };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
        behavior={KEYBOARD_AVOIDING_BEHAVIOR}
        keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
      >
        <View style={styles.modalOverlaySurface}>
          <View style={styles.modalSheetSurface}>
            <View style={styles.modalNavRow}>
              <Text style={styles.screenTitle}>{copy.title}</Text>
              <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
                <Text style={styles.modalCloseTextBtn}>{copy.close}</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalSheetScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
              <RitualDraftCard
                targetMovie={targetMovie}
                draftText={draftText}
                onDraftTextChange={onDraftTextChange}
                submitState={submitState}
                queueState={queueState}
                canSubmit={canSubmit}
                isSignedIn={isSignedIn}
                onSubmit={onSubmit}
                onFlushQueue={onFlushQueue}
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const MobileSettingsModal = ({
  visible,
  onClose,
  language = 'tr',
  themeMode,
  identityDraft,
  onChangeIdentity,
  onSaveIdentity,
  onChangeTheme,
  onChangeLanguage,
  saveState,
  onSavePassword,
  onPickAvatar,
  onClearAvatar,
  isPickingAvatar,
  activeAccountLabel,
  activeEmailLabel,
  inviteCode,
  inviteLink,
  inviteStatsLabel,
  inviteRewardLabel,
  invitedByCode,
  inviteCodeDraft,
  onInviteCodeDraftChange,
  onApplyInviteCode,
  onCopyInviteLink,
  inviteStatus,
  isInviteActionBusy,
  canCopyInviteLink,
  isSignedIn,
  accountDeletionState,
  onDeleteAccount,
  onOpenAccountDeletionInfo,
  privacyDraft,
  onChangePrivacy,
  onSavePrivacy,
  letterboxdSummary,
  letterboxdStatus,
  isImportingLetterboxd,
  onImportLetterboxd,
  onOpenShareHub,
}: {
  visible: boolean;
  onClose: () => void;
  language?: MobileSettingsLanguage;
  themeMode: MobileThemeMode;
  identityDraft: MobileSettingsIdentityDraft;
  onChangeIdentity: (patch: Partial<MobileSettingsIdentityDraft>) => void;
  onSaveIdentity: () => void;
  onChangeTheme: (mode: MobileThemeMode) => void;
  onChangeLanguage: (language: MobileSettingsLanguage) => void;
  saveState: MobileSettingsSaveState;
  onSavePassword: (
    password: string,
    confirmPassword: string
  ) => Promise<{ ok: boolean; message: string }>;
  onPickAvatar: () => void;
  onClearAvatar: () => void;
  isPickingAvatar: boolean;
  activeAccountLabel: string;
  activeEmailLabel: string;
  inviteCode: string;
  inviteLink: string;
  inviteStatsLabel: string;
  inviteRewardLabel: string;
  invitedByCode: string | null;
  inviteCodeDraft: string;
  onInviteCodeDraftChange: (value: string) => void;
  onApplyInviteCode: () => void;
  onCopyInviteLink: () => void;
  inviteStatus: string;
  isInviteActionBusy: boolean;
  canCopyInviteLink: boolean;
  isSignedIn: boolean;
  accountDeletionState: MobileSettingsSaveState;
  onDeleteAccount: () => void;
  onOpenAccountDeletionInfo: () => void;
  privacyDraft: MobileSettingsPrivacyDraft;
  onChangePrivacy: (patch: Partial<MobileSettingsPrivacyDraft>) => void;
  onSavePrivacy: () => void;
  letterboxdSummary: string;
  letterboxdStatus: string;
  isImportingLetterboxd: boolean;
  onImportLetterboxd: () => void;
  onOpenShareHub: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'appearance' | 'privacy' | 'session'>('identity');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState('');
  const [accountDeletionArmed, setAccountDeletionArmed] = useState(false);
  const [passwordState, setPasswordState] = useState<MobileSettingsSaveState>({
    status: 'idle',
    message: '',
  });
  useWebModalFocusReset(visible);

  useEffect(() => {
    if (!visible) return;
    setActiveTab('identity');
    setPasswordDraft('');
    setConfirmPasswordDraft('');
    setAccountDeletionArmed(false);
    setPasswordState({ status: 'idle', message: '' });
  }, [visible]);

  if (!visible) return null;
  const isSaving = saveState.status === 'saving';
  const saveTone =
    saveState.status === 'error' ? 'clay' : saveState.status === 'success' ? 'sage' : 'muted';
  const normalizedInviteStatus = inviteStatus.toLocaleLowerCase('tr-TR');
  const inviteStatusTone =
    normalizedInviteStatus.includes('hata')
      ? 'clay'
      : normalizedInviteStatus.includes('uygulandi') ||
          normalizedInviteStatus.includes('kopyalandi')


        ? 'sage'
        : 'muted';
  const identityDisplayName = String(identityDraft.fullName || '').trim();
  const identityUsername = String(identityDraft.username || '')
    .trim()
    .replace(/^@+/, '');
  const identityBirthDate = String(identityDraft.birthDate || '').trim();
  const rawIdentityBio = String(identityDraft.bio || '').trim();
  const identityBio = /^(a silent observer\.?|manage your profile and archive here\.?|manage your profile and league status here\.?)$/i.test(
    rawIdentityBio
  )
    ? ''
    : rawIdentityBio;
  const identityProfileLink = String(identityDraft.profileLink || '').trim();
  const settingsGenderOptions =
    SETTINGS_GENDER_OPTIONS_BY_LANGUAGE[language] || SETTINGS_GENDER_OPTIONS_BY_LANGUAGE.en;
  const activeGenderLabel =
    settingsGenderOptions.find((option) => option.key === identityDraft.gender)?.label ||
    settingsGenderOptions[0]?.label ||
    'Select';
  const settingsGenderLabel =
    MOBILE_SETTINGS_IDENTITY_FIELD_COPY[language] || MOBILE_SETTINGS_IDENTITY_FIELD_COPY.en;
  const settingsCopy = MOBILE_SETTINGS_COPY[language] || MOBILE_SETTINGS_COPY.tr;
  const settingsStatusCopy = MOBILE_SETTINGS_STATUS_COPY[language] || MOBILE_SETTINGS_STATUS_COPY.en;
  const identityCopy = MOBILE_SETTINGS_IDENTITY_COPY[language] || MOBILE_SETTINGS_IDENTITY_COPY.en;
  const privacyCopy = MOBILE_SETTINGS_PRIVACY_COPY[language] || MOBILE_SETTINGS_PRIVACY_COPY.tr;
  const rulesCopy = MOBILE_SETTINGS_RULES_CARD_COPY[language] || MOBILE_SETTINGS_RULES_CARD_COPY.en;
  const platformRules = SETTINGS_PLATFORM_RULES[language] || SETTINGS_PLATFORM_RULES.en;
  const accountDeletionCopy =
    MOBILE_ACCOUNT_DELETION_RUNTIME_COPY[language] || MOBILE_ACCOUNT_DELETION_RUNTIME_COPY.tr;
  const accountDeletionTitle = settingsCopy.accountDeletion.title;
  const accountDeletionBody = accountDeletionCopy.body;
  const accountDeletionMeta = accountDeletionCopy.meta;
  const accountDeletionButton = accountDeletionCopy.button;
  const accountDeletionInfoButton = accountDeletionCopy.infoButton;
  const accountDeletionConfirmTitle = accountDeletionCopy.confirmTitle;
  const accountDeletionConfirmBody = accountDeletionCopy.confirmBody;
  const accountDeletionConfirmButton = accountDeletionCopy.confirmButton;
  const accountDeletionCancelButton = accountDeletionCopy.cancelButton;
  const accountDeletionSignedOutBody = accountDeletionCopy.signedOutBody;
  const isPasswordSaving = passwordState.status === 'saving';
  const passwordTone =
    passwordState.status === 'error'
      ? 'clay'
      : passwordState.status === 'success'
        ? 'sage'
        : 'muted';
  const accountDeletionTone =
    accountDeletionState.status === 'error'
      ? 'clay'
      : accountDeletionState.status === 'success'
        ? 'sage'
        : 'muted';
  const isAccountDeletionBusy = accountDeletionState.status === 'saving';

  const handleSavePasswordPress = async () => {
    setPasswordState({
      status: 'saving',
      message: '',
    });

    const result = await onSavePassword(passwordDraft, confirmPasswordDraft);
    setPasswordState({
      status: result.ok ? 'success' : 'error',
      message: result.message,
    });

    if (result.ok) {
      setPasswordDraft('');
      setConfirmPasswordDraft('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.screenTitle}>{settingsCopy.settingsTitle}</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>{settingsCopy.close}</Text>
            </Pressable>
          </View>

          <View style={styles.settingsTabRow}>
            {([
              { id: 'identity', label: settingsCopy.tabs.identity },
              { id: 'appearance', label: settingsCopy.tabs.appearance },
              { id: 'privacy', label: settingsCopy.tabs.privacy },
              { id: 'session', label: settingsCopy.tabs.session },
            ] as const).map((tab) => (
              <Pressable
                key={tab.id}
                style={[styles.settingsTabChip, activeTab === tab.id ? styles.settingsTabChipActive : null]}
                onPress={() => setActiveTab(tab.id)}
                hitSlop={PRESSABLE_HIT_SLOP}
              >
                <Text
                  style={[
                    styles.settingsTabChipText,
                    activeTab === tab.id ? styles.settingsTabChipTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {saveState.message ? (
            <StatusStrip
              tone={saveTone}
              eyebrow={settingsStatusCopy.eyebrow}
              title={
                saveTone === 'clay'
                  ? settingsStatusCopy.saveFailed
                  : saveTone === 'sage'
                    ? settingsStatusCopy.saveCompleted
                    : settingsStatusCopy.draftUpdated
              }
              body={saveState.message}
              meta={isSignedIn ? settingsStatusCopy.signedInMeta : settingsStatusCopy.signedOutMeta}
            />
          ) : null}

          <ScrollView contentContainerStyle={styles.modalSheetScroll}>
            {activeTab === 'identity' ? (
              <>
                <SectionLeadCard
                  accent="clay"
                  eyebrow={identityCopy.leadEyebrow}
                  title={identityDisplayName || identityCopy.leadFallbackTitle}
                  body={identityBio || identityCopy.leadFallbackBody}
                  badges={[
                    {
                      label: identityUsername ? `@${identityUsername}` : identityCopy.usernamePending,
                      tone: identityUsername ? 'sage' : 'muted',
                    },
                    {
                      label: identityDraft.avatarUrl ? identityCopy.avatarReady : identityCopy.avatarEmpty,
                      tone: identityDraft.avatarUrl ? 'sage' : 'muted',
                    },
                    { label: activeGenderLabel, tone: 'muted' },
                  ]}
                  metrics={[
                    { label: identityCopy.metricBio, value: String(identityBio.length) },
                    { label: identityCopy.metricProfile, value: identityProfileLink ? identityCopy.metricReady : '--' },
                    { label: identityCopy.metricBirth, value: identityBirthDate ? identityCopy.metricSet : '--' },
                  ]}
                />

                {!isSignedIn ? (
                  <StatusStrip
                    tone="muted"
                    eyebrow={identityCopy.signedOutEyebrow}
                    title={identityCopy.signedOutTitle}
                    body={identityCopy.signedOutBody}
                  />
                ) : null}

                <CollapsibleSectionCard
                  accent="clay"
                  title={identityCopy.avatarSectionTitle}
                  meta={identityUsername ? `@${identityUsername}` : identityCopy.avatarSectionMetaFallback}
                  defaultExpanded
                >
                  <View style={styles.settingsAvatarPickerRow}>
                    <View style={styles.settingsAvatarPreviewWrap}>
                      {identityDraft.avatarUrl ? (
                        <Image
                          source={{ uri: identityDraft.avatarUrl }}
                          style={styles.settingsAvatarPreviewImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.settingsAvatarPreviewFallback}>
                          {(identityDraft.fullName.slice(0, 1) || identityDraft.username.slice(0, 1) || 'A')
                            .toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.settingsAvatarActionRow}>
                      <UiButton
                        label={isPickingAvatar ? identityCopy.avatarSelecting : identityCopy.avatarPick}
                        tone="neutral"
                        onPress={onPickAvatar}
                        disabled={isPickingAvatar || !isSignedIn}
                        style={styles.exploreRouteAction}
                      />
                      <UiButton
                        label={identityCopy.avatarClear}
                        tone="neutral"
                        onPress={onClearAvatar}
                        disabled={isPickingAvatar || !identityDraft.avatarUrl || !isSignedIn}
                        style={styles.exploreRouteAction}
                      />
                    </View>
                  </View>

                  <StatusStrip
                    tone={identityDraft.avatarUrl ? 'sage' : 'muted'}
                    eyebrow={identityCopy.avatarEyebrow}
                    title={identityDraft.avatarUrl ? identityCopy.avatarSelected : identityCopy.avatarOptional}
                    body={
                      identityDraft.avatarUrl
                        ? identityCopy.avatarSelectedBody
                        : identityCopy.avatarOptionalBody
                    }
                  />

                  <TextInput
                    style={styles.input}
                    value={identityDraft.fullName}
                    onChangeText={(value) => onChangeIdentity({ fullName: value })}
                    placeholder={identityCopy.fullNamePlaceholder}
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="words"
                    accessibilityLabel={identityCopy.fullNameAccessibility}
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.username}
                    onChangeText={(value) => onChangeIdentity({ username: value.replace(/\s+/g, '').toLowerCase() })}
                    placeholder={identityCopy.usernamePlaceholder}
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel={identityCopy.usernameAccessibility}
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.birthDate}
                    onChangeText={(value) => onChangeIdentity({ birthDate: value })}
                    placeholder={identityCopy.birthPlaceholder}
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel={identityCopy.birthAccessibility}
                  />

                  <View style={styles.detailInfoGrid}>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>{identityCopy.userDetailLabel}</Text>
                      <Text style={styles.detailInfoValue}>
                        {identityUsername ? `@${identityUsername}` : identityCopy.userDetailFallback}
                      </Text>
                    </View>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>{identityCopy.birthDetailLabel}</Text>
                      <Text style={styles.detailInfoValue}>
                        {identityBirthDate || identityCopy.birthDetailFallback}
                      </Text>
                    </View>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>{settingsGenderLabel}</Text>
                      <Text style={styles.detailInfoValue}>{activeGenderLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.subSectionLabel}>{settingsGenderLabel}</Text>
                  <View style={styles.settingsGenderRow}>
                    {settingsGenderOptions.map((option) => (
                      <Pressable
                        key={option.key || 'empty'}
                        style={[
                          styles.settingsGenderChip,
                          identityDraft.gender === option.key ? styles.settingsGenderChipActive : null,
                        ]}
                        onPress={() => onChangeIdentity({ gender: option.key })}
                        hitSlop={PRESSABLE_HIT_SLOP}
                      >
                        <Text
                          style={[
                            styles.settingsGenderChipText,
                            identityDraft.gender === option.key ? styles.settingsGenderChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title={identityCopy.aboutSectionTitle}
                  meta={identityCopy.characterCountMeta(identityBio.length)}
                  defaultExpanded
                >
                  <TextInput
                    style={styles.ritualInput}
                    multiline
                    textAlignVertical="top"
                    value={identityBio}
                    onChangeText={(value) => onChangeIdentity({ bio: value.slice(0, 180) })}
                    placeholder={identityCopy.aboutPlaceholder}
                    placeholderTextColor="#8e8b84"
                    accessibilityLabel={identityCopy.aboutAccessibility}
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.profileLink}
                    onChangeText={(value) => onChangeIdentity({ profileLink: value })}
                    placeholder={identityCopy.profileLinkPlaceholder}
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel={identityCopy.profileLinkAccessibility}
                  />

                  <StatusStrip
                    tone={identityProfileLink ? 'sage' : 'muted'}
                    eyebrow={identityCopy.profileLinkEyebrow}
                    title={identityProfileLink ? identityCopy.profileLinkReady : identityCopy.profileLinkOptional}
                    body={identityProfileLink ? identityProfileLink : identityCopy.profileLinkOptionalBody}
                  />

                  <UiButton
                    label={isSaving ? identityCopy.saveBusy : identityCopy.save}
                    tone="brand"
                    onPress={onSaveIdentity}
                    disabled={isSaving || !isSignedIn}
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title="Letterboxd"
                  meta={letterboxdSummary || identityCopy.letterboxdMetaFallback}
                  defaultExpanded={false}
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow="Letterboxd"
                      title={identityCopy.letterboxdSignedOutTitle}
                      body={identityCopy.letterboxdSignedOutBody}
                    />
                  ) : (
                    <>
                      <StatusStrip
                        tone={letterboxdSummary ? 'sage' : 'muted'}
                        eyebrow={identityCopy.letterboxdEyebrow}
                        title={letterboxdSummary || identityCopy.letterboxdImportNone}
                        body={letterboxdStatus || identityCopy.letterboxdImportBody}
                      />
                      <UiButton
                        label={isImportingLetterboxd ? identityCopy.letterboxdImportBusy : identityCopy.letterboxdImport}
                        tone="brand"
                        onPress={onImportLetterboxd}
                        disabled={isImportingLetterboxd}
                      />
                    </>
                  )}
                </CollapsibleSectionCard>
              </>
            ) : null}

            {activeTab === 'appearance' ? (
              <>
                <SectionLeadCard
                  accent={themeMode === 'dawn' ? 'clay' : 'sage'}
                  eyebrow={settingsCopy.appearance.eyebrow}
                  title={settingsCopy.appearance.themeTitle}
                  body={settingsCopy.appearance.body}
                  badges={[
                    {
                      label:
                        themeMode === 'dawn'
                          ? settingsCopy.appearance.themeDawn
                          : settingsCopy.appearance.themeMidnight,
                      tone: themeMode === 'dawn' ? 'clay' : 'sage',
                    },
                    { label: language.toUpperCase(), tone: 'muted' },
                  ]}
                  metrics={[
                    {
                      label: settingsCopy.appearance.themeMetric,
                      value:
                        themeMode === 'dawn'
                          ? settingsCopy.appearance.themeDawn
                          : settingsCopy.appearance.themeMidnight,
                    },
                    {
                      label: settingsCopy.appearance.languageMetric,
                      value: language.toUpperCase(),
                    },
                  ]}
                />

                <CollapsibleSectionCard
                  accent={themeMode === 'dawn' ? 'clay' : 'sage'}
                  title={settingsCopy.appearance.themeTitle}
                  meta={
                    themeMode === 'dawn'
                      ? settingsCopy.appearance.themeDawn
                      : settingsCopy.appearance.themeMidnight
                  }
                  defaultExpanded
                >
                  <Text style={styles.screenBody}>{settingsCopy.appearance.themeDescription}</Text>
                  <View style={styles.themeModeSegmentContainer}>
                    <Pressable
                      style={[
                        styles.themeModeSegmentOption,
                        themeMode === 'midnight' ? styles.themeModeSegmentActiveMidnight : null,
                      ]}
                      onPress={() => onChangeTheme('midnight')}
                      accessibilityRole="button"
                      accessibilityLabel={settingsCopy.appearance.themeMidnight}
                    >
                      <Text
                        style={[
                          styles.themeModeSegmentText,
                          themeMode === 'midnight'
                            ? styles.themeModeSegmentTextActiveMidnight
                            : null,
                        ]}
                      >
                        {settingsCopy.appearance.themeMidnight}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.themeModeSegmentOption,
                        themeMode === 'dawn' ? styles.themeModeSegmentActiveDawn : null,
                      ]}
                      onPress={() => onChangeTheme('dawn')}
                      accessibilityRole="button"
                      accessibilityLabel={settingsCopy.appearance.themeDawn}
                    >
                      <Text
                        style={[
                          styles.themeModeSegmentText,
                          themeMode === 'dawn' ? styles.themeModeSegmentTextActiveDawn : null,
                        ]}
                      >
                        {settingsCopy.appearance.themeDawn}
                      </Text>
                    </Pressable>
                  </View>
                  <StatusStrip
                    tone={themeMode === 'dawn' ? 'clay' : 'sage'}
                    eyebrow={settingsCopy.appearance.themeStatusEyebrow}
                    title={
                      themeMode === 'dawn'
                        ? settingsCopy.appearance.themeDawn
                        : settingsCopy.appearance.themeMidnight
                    }
                    body={
                      themeMode === 'dawn'
                        ? settingsCopy.appearance.themeStatusBodyDawn
                        : settingsCopy.appearance.themeStatusBodyMidnight
                    }
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title={settingsCopy.appearance.languageTitle}
                  meta={language.toUpperCase()}
                  defaultExpanded
                >
                  <Text style={styles.screenBody}>{settingsCopy.appearance.languageDescription}</Text>
                  <View style={styles.settingsGenderRow}>
                    {([
                      { code: 'tr', label: 'TR' },
                      { code: 'en', label: 'EN' },
                      { code: 'es', label: 'ES' },
                      { code: 'fr', label: 'FR' },
                    ] as const).map((option) => (
                      <Pressable
                        key={option.code}
                        style={[
                          styles.settingsGenderChip,
                          language === option.code ? styles.settingsGenderChipActive : null,
                        ]}
                        onPress={() => onChangeLanguage(option.code)}
                        hitSlop={PRESSABLE_HIT_SLOP}
                      >
                        <Text
                          style={[
                            styles.settingsGenderChipText,
                            language === option.code ? styles.settingsGenderChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <StatusStrip
                    tone="sage"
                    eyebrow={settingsCopy.appearance.languageStatusEyebrow}
                    title={language.toUpperCase()}
                    body={settingsCopy.appearance.languageStatusBody}
                    meta={settingsCopy.appearance.languageCoverageMeta}
                  />
                </CollapsibleSectionCard>
              </>
            ) : null}

            {activeTab === 'privacy' ? (
              <>
                <SectionLeadCard
                  accent="sage"
                  eyebrow={privacyCopy.eyebrow}
                  title={privacyCopy.title}
                  body={privacyCopy.body}
                  badges={[
                    {
                      label: privacyDraft.showStats ? privacyCopy.statsVisible : privacyCopy.statsHidden,
                      tone: privacyDraft.showStats ? 'sage' : 'clay',
                    },
                    {
                      label: privacyDraft.showFollowCounts
                        ? privacyCopy.followsVisible
                        : privacyCopy.followsHidden,
                      tone: privacyDraft.showFollowCounts ? 'sage' : 'clay',
                    },
                    {
                      label: privacyDraft.showMarks ? privacyCopy.marksVisible : privacyCopy.marksHidden,
                      tone: privacyDraft.showMarks ? 'sage' : 'clay',
                    },
                  ]}
                  metrics={[
                    {
                      label: privacyCopy.metricMarks,
                      value: privacyDraft.showMarks ? privacyCopy.visible : privacyCopy.hidden,
                    },
                    {
                      label: privacyCopy.metricFollows,
                      value: privacyDraft.showFollowCounts ? privacyCopy.visible : privacyCopy.hidden,
                    },
                  ]}
                />

                {([
                  {
                    key: 'showStats',
                    title: privacyCopy.showStatsTitle,
                    body: privacyCopy.showStatsBody,
                  },
                  {
                    key: 'showFollowCounts',
                    title: privacyCopy.showFollowsTitle,
                    body: privacyCopy.showFollowsBody,
                  },
                  {
                    key: 'showMarks',
                    title: privacyCopy.showMarksTitle,
                    body: privacyCopy.showMarksBody,
                  },
                ] as const).map((item) => {
                  const isEnabled = privacyDraft[item.key];
                  return (
                    <Pressable
                      key={item.key}
                      style={({ pressed }) => [
                        styles.settingsPrivacyRow,
                        pressed ? styles.settingsPrivacyRowPressed : null,
                      ]}
                      onPress={() => onChangePrivacy({ [item.key]: !isEnabled })}
                      hitSlop={PRESSABLE_HIT_SLOP}
                      accessibilityRole="switch"
                      accessibilityLabel={item.title}
                      accessibilityState={{ checked: isEnabled }}
                    >
                      <View style={styles.settingsPrivacyCopy}>
                        <Text style={styles.settingsPrivacyTitle}>{item.title}</Text>
                        <Text style={styles.settingsPrivacyBody}>{item.body}</Text>
                      </View>
                      <View
                        style={[
                          styles.settingsPrivacyToggle,
                          isEnabled ? styles.settingsPrivacyToggleActive : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.settingsPrivacyKnob,
                            isEnabled ? styles.settingsPrivacyKnobActive : null,
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}

                <UiButton
                  style={styles.settingsPrimaryAction}
                  label={isSaving ? privacyCopy.saveBusy : privacyCopy.save}
                  tone="brand"
                  onPress={onSavePrivacy}
                  disabled={isSaving || !isSignedIn}
                />
              </>
            ) : null}

            {activeTab === 'session' ? (
              <>
                <SectionLeadCard
                  accent="clay"
                  eyebrow="Hesap"
                  title={isSignedIn ? activeAccountLabel : 'Hesabin bagli degil'}
                  body={
                    isSignedIn
                      ? 'Davet programi ve platform kurallarini bu sekmeden yonet.'
                      : 'Giris yaptiginda davet ve hesap islemleri burada acilir.'
                  }
                  badges={[
                    { label: isSignedIn ? 'Hesap acik' : 'Giris gerekli', tone: isSignedIn ? 'sage' : 'clay' },
                    { label: activeEmailLabel || 'E-posta yok', tone: 'muted' },
                    { label: inviteCode ? `Kod ${inviteCode}` : 'Kod bekleniyor', tone: inviteCode ? 'muted' : 'clay' },
                  ]}
                  metrics={[
                    { label: 'Davet', value: inviteCode ? 'hazir' : '--' },
                    { label: 'Durum', value: isInviteActionBusy ? 'isleniyor' : isSignedIn ? 'hazir' : 'misafir' },
                    { label: 'Baglanti', value: invitedByCode ? 'var' : 'acik' },
                  ]}
                />

                {inviteStatus ? (
                  <StatusStrip
                    tone={inviteStatusTone}
                    eyebrow="Davet Durumu"
                    title={inviteStatusTone === 'clay' ? 'Davet islemi tamamlanamadi' : 'Davet bilgisi guncellendi'}
                    body={inviteStatus}
                    meta={inviteStatsLabel}
                  />
                ) : null}

                <CollapsibleSectionCard
                  accent="clay"
                  title={settingsCopy.password.title}
                  meta={isSignedIn ? settingsCopy.tabs.session : settingsCopy.password.signedOutTitle}
                  defaultExpanded
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow={settingsCopy.password.title}
                      title={settingsCopy.password.signedOutTitle}
                      body={settingsCopy.password.signedOutBody}
                    />
                  ) : (
                    <>
                      <StatusStrip
                        tone={passwordTone}
                        eyebrow={settingsCopy.password.title}
                        title={settingsCopy.password.title}
                        body={passwordState.message || settingsCopy.password.body}
                      />

                      <Text style={styles.subSectionLabel}>
                        {settingsCopy.password.newPasswordLabel}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={passwordDraft}
                        onChangeText={setPasswordDraft}
                        placeholder={settingsCopy.password.newPasswordPlaceholder}
                        placeholderTextColor="#8e8b84"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel={settingsCopy.password.newPasswordLabel}
                      />

                      <Text style={styles.subSectionLabel}>
                        {settingsCopy.password.confirmPasswordLabel}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={confirmPasswordDraft}
                        onChangeText={setConfirmPasswordDraft}
                        placeholder={settingsCopy.password.confirmPasswordPlaceholder}
                        placeholderTextColor="#8e8b84"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel={settingsCopy.password.confirmPasswordLabel}
                      />

                      <UiButton
                        label={
                          isPasswordSaving
                            ? settingsCopy.password.saveBusy
                            : settingsCopy.password.save
                        }
                        tone="brand"
                        onPress={() => {
                          void handleSavePasswordPress();
                        }}
                        disabled={isPasswordSaving}
                      />
                    </>
                  )}
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title="Davet Programi"
                  meta={inviteCode ? `Kod ${inviteCode}` : 'Kod hazirlaniyor'}
                  defaultExpanded
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow="Davet"
                      title="Davet programi icin once giris yap"
                      body="Link kopyalamak ve kod kullanmak icin hesabina giris yapman gerekir."
                      meta="Giris yaptiginda bu bolum acilir."
                    />
                  ) : (
                    <>
                      <View style={styles.detailInfoGrid}>
                        <View style={styles.detailInfoCard}>
                          <Text style={styles.detailInfoLabel}>Kod</Text>
                          <Text style={styles.detailInfoValue}>{inviteCode || '-'}</Text>
                        </View>
                        <View style={styles.detailInfoCard}>
                          <Text style={styles.detailInfoLabel}>Link</Text>
                          <Text style={styles.detailInfoValue} numberOfLines={3}>
                            {inviteLink || 'hazirlaniyor'}
                          </Text>
                        </View>
                      </View>

                      <UiButton
                        label={isInviteActionBusy ? 'Isleniyor...' : 'Linki Kopyala'}
                        tone="neutral"
                        onPress={onCopyInviteLink}
                        disabled={!canCopyInviteLink || isInviteActionBusy}
                      />

                      <StatusStrip
                        tone="sage"
                        eyebrow="Davet Notu"
                        body={inviteRewardLabel}
                        meta={inviteStatsLabel}
                      />

                      {invitedByCode ? (
                        <StatusStrip
                          tone="sage"
                          eyebrow="Kullanilan Kod"
                          title={invitedByCode}
                          body="Bu hesap daha once bir davet baglantisi ile iliskilendirildi."
                        />
                      ) : (
                        <>
                          <Text style={styles.subSectionLabel}>Davet Kodu Gir</Text>
                          <TextInput
                            style={styles.input}
                            value={inviteCodeDraft}
                            onChangeText={(value) =>
                              onInviteCodeDraftChange(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                            }
                            autoCapitalize="characters"
                            maxLength={12}
                            placeholder="ABCD1234"
                            placeholderTextColor="#8e8b84"
                            accessibilityLabel="Davet kodu gir"
                          />
                          <UiButton
                            label={isInviteActionBusy ? 'Uygulaniyor...' : 'Kodu Uygula'}
                            tone="brand"
                            onPress={onApplyInviteCode}
                            disabled={isInviteActionBusy || !inviteCodeDraft.trim()}
                          />
                        </>
                      )}
                    </>
                  )}
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title="Paylasim"
                  meta="Profil ve yorum"
                  defaultExpanded={false}
                >
                  <StatusStrip
                    tone="muted"
                    eyebrow="Paylasim"
                    title="Paylasim merkezini ac"
                    body="Profilini veya gunun yorumunu paylas."
                  />

                  <UiButton
                    label="Paylasim Merkezine Git"
                    tone="brand"
                    onPress={onOpenShareHub}
                    disabled={!isSignedIn}
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="clay"
                  title={accountDeletionTitle}
                  meta={accountDeletionCopy.sectionMeta}
                  defaultExpanded
                >
                  <StatusStrip
                    tone={accountDeletionTone}
                    eyebrow={accountDeletionCopy.eyebrow}
                    title={accountDeletionTitle}
                    body={accountDeletionState.message || accountDeletionBody}
                    meta={accountDeletionMeta}
                  />

                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow={accountDeletionTitle}
                      title={accountDeletionTitle}
                      body={accountDeletionSignedOutBody}
                    />
                  ) : null}

                  <View style={{ gap: 10 }}>
                    {isSignedIn && accountDeletionArmed ? (
                      <>
                        <StatusStrip
                          tone="clay"
                          eyebrow={accountDeletionCopy.eyebrow}
                          title={accountDeletionConfirmTitle}
                          body={accountDeletionConfirmBody}
                        />
                        <UiButton
                          label={
                            isAccountDeletionBusy
                              ? `${accountDeletionConfirmButton}...`
                              : accountDeletionConfirmButton
                          }
                          tone="danger"
                          onPress={onDeleteAccount}
                          disabled={isAccountDeletionBusy}
                        />
                        <UiButton
                          label={accountDeletionCancelButton}
                          tone="neutral"
                          onPress={() => setAccountDeletionArmed(false)}
                          disabled={isAccountDeletionBusy}
                        />
                      </>
                    ) : isSignedIn ? (
                      <UiButton
                        label={accountDeletionButton}
                        tone="danger"
                        onPress={() => setAccountDeletionArmed(true)}
                        disabled={isAccountDeletionBusy}
                      />
                    ) : null}

                    <UiButton
                      label={accountDeletionInfoButton}
                      tone="neutral"
                      onPress={onOpenAccountDeletionInfo}
                      disabled={isAccountDeletionBusy}
                    />
                  </View>
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="clay"
                  title={rulesCopy.title}
                  meta={rulesCopy.meta}
                  defaultExpanded={false}
                >
                  <Text style={styles.screenBody}>{rulesCopy.body}</Text>
                  <View style={styles.rulesList}>
                    {platformRules.map((rule, index) => (
                      <View key={`settings-rule-${index}`} style={styles.rulesRow}>
                        <View style={styles.rulesDot} />
                        <Text style={styles.rulesText}>{rule}</Text>
                      </View>
                    ))}
                  </View>
                </CollapsibleSectionCard>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const InviteClaimScreen = ({
  inviteCode,
  claimState,
  onClaim,
  language,
}: {
  inviteCode?: string;
  claimState: InviteClaimState;
  onClaim: (inviteCode: string) => void;
  language: MobileSettingsLanguage;
}) => {
  const isLoading = claimState.status === 'loading';
  const hasInviteCode = Boolean(inviteCode);
  const isTurkish = language === 'tr';
  const copy = isTurkish
    ? {
        eyebrow: 'Davet Girisi',
        title: 'Davet Onayi',
        body: 'Kodu onayla.',
        noCode: 'Kod yok',
        apply: 'Davet Kodunu Uygula',
        checking: 'Kontrol ediliyor...',
        emptyEyebrow: 'Davet Linki',
        emptyTitle: 'Kod bulunamadi',
        emptyBody: 'Yeni bir davet linkiyle tekrar dene.',
        loadingEyebrow: 'Davet Talebi',
        loadingTitle: 'Kod dogrulaniyor',
        loadingBody: 'Biraz bekle.',
        successTitle: 'Odul uygulandi',
        rewardYou: 'Sen',
        rewardInviter: 'Davet Eden',
        total: 'Toplam',
        errorEyebrow: 'Davet Talebi',
        errorTitle: 'Kod uygulanamadi',
        retry: 'Tekrar Dene',
        codeLabel: 'Kod',
      }
    : {
        eyebrow: 'Invite Gateway',
        title: 'Invite Approval',
        body: 'Confirm the code.',
        noCode: 'No code',
        apply: 'Apply Invite Code',
        checking: 'Checking...',
        emptyEyebrow: 'Invite Link',
        emptyTitle: 'Code not found',
        emptyBody: 'Try again with a new invite link.',
        loadingEyebrow: 'Invite Claim',
        loadingTitle: 'Checking code',
        loadingBody: 'Please wait.',
        successTitle: 'Reward applied',
        rewardYou: 'You',
        rewardInviter: 'Inviter',
        total: 'Total',
        errorEyebrow: 'Invite Claim',
        errorTitle: 'Code could not be applied',
        retry: 'Try Again',
        codeLabel: 'Code',
      };
  const statusLabels: Record<InviteClaimState['status'], string> = isTurkish
    ? {
        idle: 'hazir',
        loading: 'isleniyor',
        success: 'uygulandi',
        error: 'hata',
      }
    : {
        idle: 'ready',
        loading: 'checking',
        success: 'applied',
        error: 'error',
      };

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow={copy.eyebrow}
        title={copy.title}
        body={copy.body}
        badges={[
          {
            label: hasInviteCode ? `${copy.codeLabel} ${inviteCode}` : copy.noCode,
            tone: hasInviteCode ? 'sage' : 'clay',
          },
          { label: statusLabels[claimState.status], tone: claimState.status === 'error' ? 'clay' : 'muted' },
        ]}
        actions={
          hasInviteCode
            ? [
                {
                  label: isLoading ? copy.checking : copy.apply,
                  tone: 'brand',
                  onPress: () => onClaim(inviteCode as string),
                  disabled: isLoading,
                },
              ]
            : undefined
        }
      />

      {!hasInviteCode ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow={copy.emptyEyebrow}
          title={copy.emptyTitle}
          body={copy.emptyBody}
        />
      ) : null}

      {claimState.status === 'loading' ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow={copy.loadingEyebrow}
          title={copy.loadingTitle}
          body={copy.loadingBody}
          meta={`${copy.codeLabel}: ${inviteCode}`}
        />
      ) : null}

      {claimState.status === 'success' ? (
        <ScreenCard accent="sage">
          <Text style={styles.sectionLeadTitle}>{copy.successTitle}</Text>
          <Text style={styles.sectionLeadBody}>{claimState.message}</Text>
          <View style={styles.sectionLeadMetricRow}>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviteeRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>{copy.rewardYou}</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviterRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>{copy.rewardInviter}</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>{claimState.claimCount}</Text>
              <Text style={styles.sectionLeadMetricLabel}>{copy.total}</Text>
            </View>
          </View>
        </ScreenCard>
      ) : null}

      {claimState.status === 'error' ? (
        <StatePanel
          tone="clay"
          variant="error"
          eyebrow={copy.errorEyebrow}
          title={copy.errorTitle}
          body={claimState.message}
          meta={claimState.errorCode ? `${copy.codeLabel}: ${claimState.errorCode}` : undefined}
          actionLabel={copy.retry}
          onAction={() => {
            if (inviteCode) onClaim(inviteCode);
          }}
          actionTone="danger"
        />
      ) : null}
    </>
  );
};
const ShareHubScreen = ({
  inviteCode,
  inviteLink,
  platform,
  goal,
  streakValue,
  commentPreview,
  canShareComment,
  canShareStreak,
  shareStatus,
  shareStatusTone,
  onSetGoal,
  onShare,
  language,
}: {
  inviteCode?: string;
  inviteLink?: string;
  platform?: string;
  goal: 'comment' | 'streak';
  streakValue?: number;
  commentPreview: string;
  canShareComment: boolean;
  canShareStreak: boolean;
  shareStatus: string;
  shareStatusTone: 'idle' | 'loading' | 'ready' | 'error';
  onSetGoal: (goal: 'comment' | 'streak') => void;
  onShare: (platform: 'instagram' | 'tiktok' | 'x') => void;
  language: MobileSettingsLanguage;
}) => {
  const normalizedGoal = goal === 'streak' ? 'streak' : 'comment';
  const normalizedPlatform =
    platform === 'instagram' || platform === 'tiktok' || platform === 'x' ? platform : undefined;
  const hasInviteLink = Boolean(String(inviteLink || '').trim());
  const safeStreak = Math.max(0, Number(streakValue || 0));
  const isTurkish = language === 'tr';
  const copy = isTurkish
    ? {
        eyebrow: 'Paylasim Merkezi',
        streakTitle: 'Seri Paylasimi',
        commentTitle: 'Yorum Paylasimi',
        defaultTitle: 'Paylasim Merkezi',
        streakBody: 'Serini paylas.',
        commentBody: 'Yorumunu paylas.',
        defaultBody: 'Paylasim hazir.',
        streakMode: 'Seri modu',
        commentMode: 'Yorum modu',
        pickPlatform: 'platform sec',
        noCode: 'Kod yok',
        linkReady: 'link hazir',
        noLink: 'link yok',
        streakMetric: 'Seri',
        readyMetric: 'Hazir',
        yes: 'evet',
        no: 'hayir',
        platformMetric: 'Platform',
        goalLabel: 'Hedef',
        selectCommentA11y: 'Yorum paylasimini sec',
        selectStreakA11y: 'Seri paylasimini sec',
        shareComment: 'Yorum Paylas',
        shareStreak: 'Seri Paylas',
        previewEyebrow: 'Onizleme',
        previewStreakTitle: 'Seri paketi hazir',
        previewCommentTitle: 'Yorum paketi hazir',
        previewStreakBody: (value: number) => `Bugunku seri tamamlandi: ${value} gun`,
        codeLabel: 'Davet kodu',
        readinessEyebrow: 'Paylasim Hazirligi',
        commentNotReadyTitle: 'Yorum paylasimi henuz hazir degil',
        streakNotReadyTitle: 'Seri paketi henuz hazir degil',
        commentNotReadyBody: 'Paylasim icin bugun bir yorumun olmali.',
        streakNotReadyBody: 'Seri paylasimi icin bugunku yorum ve aktif seri gerekiyor.',
        platformLabel: 'Platform',
        statusEyebrow: 'Paylasim Durumu',
        goalNotReady: 'Hedef hazir degil.',
        selectedPlatform: (value: string) => `Secili platform: ${value}`,
        noPlatformSelected: 'Henuz platform secilmedi.',
      }
    : {
        eyebrow: 'Share Hub',
        streakTitle: 'Streak Share',
        commentTitle: 'Comment Share',
        defaultTitle: 'Share Hub',
        streakBody: 'Share your streak.',
        commentBody: 'Share your comment.',
        defaultBody: 'Share is ready.',
        streakMode: 'Streak mode',
        commentMode: 'Comment mode',
        pickPlatform: 'pick platform',
        noCode: 'No code',
        linkReady: 'link ready',
        noLink: 'no link',
        streakMetric: 'Streak',
        readyMetric: 'Ready',
        yes: 'yes',
        no: 'no',
        platformMetric: 'Platform',
        goalLabel: 'Goal',
        selectCommentA11y: 'Select comment sharing',
        selectStreakA11y: 'Select streak sharing',
        shareComment: 'Share Comment',
        shareStreak: 'Share Streak',
        previewEyebrow: 'Preview',
        previewStreakTitle: 'Streak package ready',
        previewCommentTitle: 'Comment package ready',
        previewStreakBody: (value: number) => `Today's streak completed: ${value} days`,
        codeLabel: 'Invite code',
        readinessEyebrow: 'Share Readiness',
        commentNotReadyTitle: 'Comment sharing is not ready yet',
        streakNotReadyTitle: 'Streak package is not ready yet',
        commentNotReadyBody: 'You need a comment from today to share it.',
        streakNotReadyBody: "You need today's comment and an active streak to share your streak.",
        platformLabel: 'Platform',
        statusEyebrow: 'Share Status',
        goalNotReady: 'Goal is not ready.',
        selectedPlatform: (value: string) => `Selected platform: ${value}`,
        noPlatformSelected: 'No platform selected yet.',
      };

  const title =
    normalizedGoal === 'streak'
      ? copy.streakTitle
      : normalizedGoal === 'comment'
        ? copy.commentTitle
        : copy.defaultTitle;

  const body =
    normalizedGoal === 'streak'
      ? copy.streakBody
      : normalizedGoal === 'comment'
        ? copy.commentBody
        : copy.defaultBody;

  const statusStyle =
    shareStatusTone === 'error'
      ? styles.ritualStateError
      : shareStatusTone === 'ready'
        ? styles.ritualStateOk
        : shareStatusTone === 'loading'
          ? styles.ritualStateWarn
          : styles.screenMeta;
  const canShareSelectedGoal = normalizedGoal === 'comment' ? canShareComment : canShareStreak;

  return (
    <>
      <SectionLeadCard
        accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}
        eyebrow={copy.eyebrow}
        title={title}
        body={body}
        badges={[
          {
            label: normalizedGoal === 'streak' ? copy.streakMode : copy.commentMode,
            tone: normalizedGoal === 'streak' ? 'clay' : 'sage',
          },
          { label: normalizedPlatform || copy.pickPlatform, tone: 'muted' },
          { label: inviteCode ? `${copy.codeLabel} ${inviteCode}` : copy.noCode, tone: inviteCode ? 'muted' : 'clay' },
          { label: hasInviteLink ? copy.linkReady : copy.noLink, tone: hasInviteLink ? 'muted' : 'clay' },
        ]}
        metrics={[
          { label: copy.streakMetric, value: String(safeStreak) },
          { label: copy.readyMetric, value: canShareSelectedGoal ? copy.yes : copy.no },
          { label: copy.platformMetric, value: normalizedPlatform || '--' },
        ]}
      />

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>{copy.goalLabel}</Text>
        <View style={styles.themeModeSegmentContainer}>
          <Pressable
            style={[
              styles.themeModeSegmentOption,
              normalizedGoal === 'comment' ? styles.themeModeSegmentActiveMidnight : null,
            ]}
            onPress={() => onSetGoal('comment')}
            accessibilityRole="button"
            accessibilityLabel={copy.selectCommentA11y}
          >
            <Text
              style={[
                styles.themeModeSegmentText,
                normalizedGoal === 'comment' ? styles.themeModeSegmentTextActiveMidnight : null,
              ]}
            >
              {copy.shareComment}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.themeModeSegmentOption,
              normalizedGoal === 'streak' ? styles.themeModeSegmentActiveMidnight : null,
            ]}
            onPress={() => onSetGoal('streak')}
            accessibilityRole="button"
            accessibilityLabel={copy.selectStreakA11y}
          >
            <Text
              style={[
                styles.themeModeSegmentText,
                normalizedGoal === 'streak' ? styles.themeModeSegmentTextActiveMidnight : null,
              ]}
            >
              {copy.shareStreak}
            </Text>
          </Pressable>
        </View>

        {canShareSelectedGoal ? (
          <StatusStrip
            tone="sage"
            eyebrow={copy.previewEyebrow}
            title={normalizedGoal === 'streak' ? copy.previewStreakTitle : copy.previewCommentTitle}
            body={normalizedGoal === 'streak' ? copy.previewStreakBody(safeStreak) : `"${commentPreview}"`}
            meta={inviteCode ? `${copy.codeLabel}: ${inviteCode}` : undefined}
          />
        ) : (
          <StatePanel
            tone="clay"
            variant="empty"
            eyebrow={copy.readinessEyebrow}
            title={normalizedGoal === 'comment' ? copy.commentNotReadyTitle : copy.streakNotReadyTitle}
            body={normalizedGoal === 'comment' ? copy.commentNotReadyBody : copy.streakNotReadyBody}
          />
        )}
      </ScreenCard>

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>{copy.platformLabel}</Text>
        <View style={styles.sectionLeadActionRow}>
          <UiButton
            label="Instagram"
            tone={normalizedPlatform === 'instagram' ? 'teal' : 'neutral'}
            stretch
            onPress={() => onShare('instagram')}
            disabled={!canShareSelectedGoal}
          />
          <UiButton
            label="TikTok"
            tone={normalizedPlatform === 'tiktok' ? 'teal' : 'neutral'}
            stretch
            onPress={() => onShare('tiktok')}
            disabled={!canShareSelectedGoal}
          />
          <UiButton
            label="X"
            tone={normalizedPlatform === 'x' ? 'teal' : 'neutral'}
            stretch
            onPress={() => onShare('x')}
            disabled={!canShareSelectedGoal}
          />
        </View>
        <StatusStrip
          tone={shareStatusTone === 'error' ? 'clay' : shareStatusTone === 'ready' ? 'sage' : 'muted'}
          eyebrow={copy.statusEyebrow}
          body={shareStatus}
          meta={canShareSelectedGoal ? undefined : copy.goalNotReady}
        />
        <Text style={[styles.screenMeta, statusStyle]}>
          {normalizedPlatform ? copy.selectedPlatform(normalizedPlatform) : copy.noPlatformSelected}
        </Text>
      </ScreenCard>
    </>
  );
};
type DiscoverRouteItem = {
  id: string;
  title: string;
  description: string;
  href: string;
};

type ArenaLeaderboardItem = {
  rank: number;
  userId: string | null;
  displayName: string;
  avatarUrl?: string | null;
  ritualsCount: number;
  echoCount: number;
};

type ArenaLeaderboardState = {
  status: 'loading' | 'ready' | 'error';
  source: 'live' | 'fallback';
  message: string;
  entries: ArenaLeaderboardItem[];
};

type MobileDiscoverRoutesCopy = {
  eyebrow: string;
  title: string;
  body: string;
  routeSuffix: string;
  readySuffix: string;
  readyMetric: string;
  pendingMetric: string;
  emptyEyebrow: string;
  emptyTitle: string;
  emptyBody: string;
  emptyMeta: string;
  stateEyebrow: string;
  stateReadyTitle: string;
  statePendingTitle: string;
  stateReadyBody: string;
  statePendingBody: string;
  open: string;
  wait: string;
  openAccessibilitySuffix: string;
};

const MOBILE_DISCOVER_ROUTES_COPY_EN: MobileDiscoverRoutesCopy = {
  eyebrow: 'Discovery Routes',
  title: 'Discovery Routes',
  body: 'Pick a category and open the related route.',
  routeSuffix: 'routes',
  readySuffix: 'ready',
  readyMetric: 'Ready',
  pendingMetric: 'Pending',
  emptyEyebrow: 'Discovery',
  emptyTitle: 'No routes yet',
  emptyBody: 'Category-based route cards will appear here when discovery routes load.',
  emptyMeta: 'This section fills in again when web sources or the route inventory sync.',
  stateEyebrow: 'Route State',
  stateReadyTitle: 'Route is ready to open',
  statePendingTitle: 'URL config is pending',
  stateReadyBody: 'This route opens inside the in-app route viewer.',
  statePendingBody: 'The web URL configuration for this route is not complete yet.',
  open: 'Open',
  wait: 'Wait',
  openAccessibilitySuffix: 'route',
} as const;

const MOBILE_DISCOVER_ROUTES_COPY: Record<MobileSettingsLanguage, MobileDiscoverRoutesCopy> = {
  tr: {
    eyebrow: 'Kesif Rotalari',
    title: 'Kesif Rotalari',
    body: 'Kategori secip ilgili rotayi ac.',
    routeSuffix: 'rota',
    readySuffix: 'hazir',
    readyMetric: 'Hazir',
    pendingMetric: 'Beklemede',
    emptyEyebrow: 'Kesif',
    emptyTitle: 'Henuz rota gelmedi',
    emptyBody: 'Kesif rotalari yuklendiginde bu alanda kategori bazli giris kartlari gorunecek.',
    emptyMeta: 'Web kaynaklari veya rota envanteri tekrar senkronlandiginda dolacak.',
    stateEyebrow: 'Rota Durumu',
    stateReadyTitle: 'Rota acilmaya hazir',
    statePendingTitle: 'URL konfigrasyonu bekleniyor',
    stateReadyBody: 'Bu rota mobil yuzeyin icindeki kesif katmaninda acilir.',
    statePendingBody: 'Bu rota icin web URL konfigrasyonu tamamlanmamis.',
    open: 'Ac',
    wait: 'Bekle',
    openAccessibilitySuffix: 'rotasini ac',
  },
  en: MOBILE_DISCOVER_ROUTES_COPY_EN,
  es: {
    eyebrow: 'Rutas de Descubrimiento',
    title: 'Rutas de Descubrimiento',
    body: 'Elige una categoria y abre la ruta relacionada.',
    routeSuffix: 'rutas',
    readySuffix: 'listas',
    readyMetric: 'Listas',
    pendingMetric: 'Pendientes',
    emptyEyebrow: 'Descubrimiento',
    emptyTitle: 'Todavia no hay rutas',
    emptyBody: 'Las tarjetas por categoria apareceran aqui cuando carguen las rutas de descubrimiento.',
    emptyMeta: 'Esta seccion se llenara de nuevo cuando se sincronicen las fuentes web o el inventario de rutas.',
    stateEyebrow: 'Estado de la Ruta',
    stateReadyTitle: 'La ruta esta lista para abrirse',
    statePendingTitle: 'La configuracion de URL esta pendiente',
    stateReadyBody: 'Esta ruta se abre en el visor de rutas de la app.',
    statePendingBody: 'La configuracion web de esta ruta todavia no esta completa.',
    open: 'Abrir',
    wait: 'Esperar',
    openAccessibilitySuffix: 'ruta',
  },
  fr: {
    eyebrow: 'Routes de Decouverte',
    title: 'Routes de Decouverte',
    body: 'Choisis une categorie et ouvre la route correspondante.',
    routeSuffix: 'routes',
    readySuffix: 'pretes',
    readyMetric: 'Pretes',
    pendingMetric: 'En attente',
    emptyEyebrow: 'Decouverte',
    emptyTitle: 'Aucune route pour le moment',
    emptyBody: 'Les cartes de categorie apparaitront ici lorsque les routes de decouverte seront chargees.',
    emptyMeta: 'Cette section se remplira de nouveau lorsque les sources web ou l inventaire des routes seront synchronises.',
    stateEyebrow: 'Etat de la Route',
    stateReadyTitle: 'La route est prete a s ouvrir',
    statePendingTitle: 'La configuration de l URL est en attente',
    stateReadyBody: 'Cette route s ouvre dans le lecteur de routes integre.',
    statePendingBody: 'La configuration web de cette route n est pas encore complete.',
    open: 'Ouvrir',
    wait: 'Attendre',
    openAccessibilitySuffix: 'route',
  },
};

const DiscoverRoutesCard = ({
  routes,
  onOpenRoute,
  language = 'tr',
}: {
  routes: DiscoverRouteItem[];
  onOpenRoute: (route: DiscoverRouteItem) => void;
  language?: MobileSettingsLanguage;
}) => {
  const copy = MOBILE_DISCOVER_ROUTES_COPY[language] || MOBILE_DISCOVER_ROUTES_COPY.tr;
  const readyCount = routes.filter((route) => Boolean(route.href)).length;

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow={copy.eyebrow}
        title={copy.title}
        body={copy.body}
        badges={[
          { label: `${routes.length} ${copy.routeSuffix}`, tone: 'sage' },
          { label: `${readyCount} ${copy.readySuffix}`, tone: readyCount > 0 ? 'sage' : 'clay' },
        ]}
        metrics={[
          { label: copy.readyMetric, value: String(readyCount) },
          { label: copy.pendingMetric, value: String(Math.max(0, routes.length - readyCount)) },
        ]}
      />

      {routes.length === 0 ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow={copy.emptyEyebrow}
          title={copy.emptyTitle}
          body={copy.emptyBody}
          meta={copy.emptyMeta}
        />
      ) : (
        <View style={styles.exploreRouteList}>
          {routes.map((route) => (
            <View key={route.id} style={styles.exploreRouteRow}>
              <View style={styles.exploreRouteContent}>
                <Text style={styles.exploreRouteTitle}>{route.title}</Text>
                <Text style={styles.exploreRouteBody}>{route.description}</Text>
                <StatusStrip
                  tone={route.href ? 'sage' : 'clay'}
                  eyebrow={copy.stateEyebrow}
                  title={route.href ? copy.stateReadyTitle : copy.statePendingTitle}
                  body={route.href ? copy.stateReadyBody : copy.statePendingBody}
                  meta={route.href || undefined}
                />
              </View>
              <UiButton
                label={route.href ? copy.open : copy.wait}
                tone={route.href ? 'brand' : 'neutral'}
                onPress={() => onOpenRoute(route)}
                style={styles.exploreRouteAction}
                accessibilityLabel={`${route.title} ${copy.openAccessibilitySuffix}`}
                disabled={!route.href}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
};
type MobileArenaCopy = {
  pulseEyebrow: string;
  pulseTitle: string;
  pulseBody: string;
  seriesLabel: string;
  commentLabel: string;
  weeklyPace: string;
  modeLabel: string;
  weeklyMode: string;
  openDaily: string;
  rhythmEyebrow: string;
  rhythmTitle: string;
  rhythmBody: string;
  rhythmMeta: string;
  boardEyebrow: string;
  boardTitle: string;
  boardBody: string;
  playerSuffix: string;
  statusLabel: string;
  loadingValue: string;
  loadingTitle: string;
  loadingBody: string;
  errorTitle: string;
  emptyTitle: string;
  errorBody: string;
  emptyBody: string;
  profileButton: string;
  lockedButton: string;
  nameAccessibilitySuffix: string;
  buttonAccessibilitySuffix: string;
  echoLabel: string;
};

const MOBILE_ARENA_COPY_EN: MobileArenaCopy = {
  pulseEyebrow: 'Arena Pulse',
  pulseTitle: 'Weekly challenge pulse',
  pulseBody: 'Daily comment rhythm, active streak, and social activity shape your place on the arena board.',
  seriesLabel: 'Streak',
  commentLabel: 'Comments',
  weeklyPace: 'weekly pace',
  modeLabel: 'Mode',
  weeklyMode: 'Weekly',
  openDaily: 'Go To Daily Feed',
  rhythmEyebrow: 'Arena Rhythm',
  rhythmTitle: 'Challenge score feeds on the daily rhythm',
  rhythmBody: 'Leave today\'s comment, get an echo from the feed, and keep your momentum on the weekly ranking.',
  rhythmMeta: 'The live or fallback ranking is updated in the leaderboard card below.',
  boardEyebrow: 'Arena Board',
  boardTitle: 'Arena Leaderboard',
  boardBody: 'Weekly ranking generated from recent comment activity. Tap a nickname to open the profile.',
  playerSuffix: 'players',
  statusLabel: 'Status',
  loadingValue: 'Loading',
  loadingTitle: 'Weekly ranking is loading',
  loadingBody: 'Live comment activity and profile transitions are being collected.',
  errorTitle: 'Arena board could not be opened',
  emptyTitle: 'No arena activity yet this week',
  errorBody: 'There was a temporary problem while loading the ranking.',
  emptyBody: 'The arena ranking will appear here as new comments and echoes arrive.',
  profileButton: 'Profile',
  lockedButton: 'Locked',
  nameAccessibilitySuffix: 'profile',
  buttonAccessibilitySuffix: 'profile',
  echoLabel: 'Echo',
} as const;

const MOBILE_ARENA_COPY: Record<MobileSettingsLanguage, MobileArenaCopy> = {
  tr: {
    pulseEyebrow: 'Arena Nabzi',
    pulseTitle: 'Haftalik challenge nabzi',
    pulseBody: 'Gunluk yorum ritmi, aktif seri ve sosyal akis Arena tablosundaki yerini belirler.',
    seriesLabel: 'Seri',
    commentLabel: 'Yorum',
    weeklyPace: 'haftalik tempo',
    modeLabel: 'Mod',
    weeklyMode: 'Haftalik',
    openDaily: 'Gunluk Akisa Gec',
    rhythmEyebrow: 'Arena Ritmi',
    rhythmTitle: 'Challenge skoru gunluk ritimden beslenir',
    rhythmBody: 'Bugunku yorumunu birak, yorum akisinda echo al ve haftalik siralamadaki ivmeni koru.',
    rhythmMeta: 'Canli ya da fallback siralama asagidaki siralama kartinda guncellenir.',
    boardEyebrow: 'Arena Tablosu',
    boardTitle: 'Arena Siralamasi',
    boardBody: 'Son yorum aktivitesinden uretilen haftalik siralama. Nick uzerine dokunarak profili ac.',
    playerSuffix: 'oyuncu',
    statusLabel: 'Durum',
    loadingValue: 'Hazirlaniyor',
    loadingTitle: 'Haftalik siralama yukleniyor',
    loadingBody: 'Canli yorum aktivitesi ve profil gecisleri toparlaniyor.',
    errorTitle: 'Arena tablosu acilamadi',
    emptyTitle: 'Bu hafta henuz arena izi yok',
    errorBody: 'Siralama okunurken gecici bir sorun olustu.',
    emptyBody: 'Yeni yorum ve echo hareketleri geldikce arena siralamasi burada gorunecek.',
    profileButton: 'Profil',
    lockedButton: 'Kilitli',
    nameAccessibilitySuffix: 'profilini ac',
    buttonAccessibilitySuffix: 'profiline git',
    echoLabel: 'Echo',
  },
  en: MOBILE_ARENA_COPY_EN,
  es: MOBILE_ARENA_COPY_EN,
  fr: {
    pulseEyebrow: 'Pouls de l\'Arena',
    pulseTitle: 'Pouls du défi hebdomadaire',
    pulseBody: 'Le rythme quotidien des commentaires, la série active et l\'activité sociale déterminent ta place dans l\'arena.',
    seriesLabel: 'Série',
    commentLabel: 'Commentaires',
    weeklyPace: 'rythme hebdo',
    modeLabel: 'Mode',
    weeklyMode: 'Hebdomadaire',
    openDaily: 'Aller au Fil Quotidien',
    rhythmEyebrow: 'Rythme de l\'Arena',
    rhythmTitle: 'Le score du défi se nourrit du rythme quotidien',
    rhythmBody: 'Laisse ton commentaire du jour, reçois un echo du fil et maintiens ton élan dans le classement hebdomadaire.',
    rhythmMeta: 'Le classement en direct ou de secours est mis à jour dans la carte ci-dessous.',
    boardEyebrow: 'Tableau de l\'Arena',
    boardTitle: 'Classement de l\'Arena',
    boardBody: 'Classement hebdomadaire généré depuis l\'activité de commentaires récente. Appuie sur un pseudo pour ouvrir le profil.',
    playerSuffix: 'joueurs',
    statusLabel: 'Statut',
    loadingValue: 'Chargement',
    loadingTitle: 'Classement hebdomadaire en cours',
    loadingBody: 'L\'activité des commentaires et les transitions de profil sont en cours de collecte.',
    errorTitle: 'Impossible d\'ouvrir le tableau de l\'arena',
    emptyTitle: 'Aucune activité dans l\'arena cette semaine',
    errorBody: 'Un problème temporaire est survenu lors du chargement du classement.',
    emptyBody: 'Le classement de l\'arena apparaîtra ici au fur et à mesure des commentaires et échos.',
    profileButton: 'Profil',
    lockedButton: 'Verrouillé',
    nameAccessibilitySuffix: 'ouvrir le profil',
    buttonAccessibilitySuffix: 'aller au profil',
    echoLabel: 'Echo',
  },
};

const ArenaChallengeCard = ({
  streakLabel,
  ritualsLabel,
  onOpenDaily,
  language = 'tr',
}: {
  streakLabel: string;
  ritualsLabel: string;
  onOpenDaily?: () => void;
  language?: MobileSettingsLanguage;
}) => {
  const copy = MOBILE_ARENA_COPY[language] || MOBILE_ARENA_COPY.tr;
  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow={copy.pulseEyebrow}
        title={copy.pulseTitle}
        body={copy.pulseBody}
        badges={[
          { label: `${copy.seriesLabel} ${streakLabel}`, tone: 'sage' },
          { label: `${copy.commentLabel} ${ritualsLabel}`, tone: 'muted' },
          { label: copy.weeklyPace, tone: 'clay' },
        ]}
        metrics={[
          { label: copy.seriesLabel, value: streakLabel },
          { label: copy.commentLabel, value: ritualsLabel },
          { label: copy.modeLabel, value: copy.weeklyMode },
        ]}
        actions={onOpenDaily ? [{ label: copy.openDaily, tone: 'brand', onPress: onOpenDaily }] : undefined}
      />
      <StatusStrip
        tone="clay"
        eyebrow={copy.rhythmEyebrow}
        title={copy.rhythmTitle}
        body={copy.rhythmBody}
        meta={copy.rhythmMeta}
      />
    </>
  );
};
const ArenaLeaderboardCard = ({
  state,
  onOpenProfile,
  language = 'tr',
  currentDisplayName,
}: {
  state: ArenaLeaderboardState;
  onOpenProfile: (item: ArenaLeaderboardItem) => void;
  language?: MobileSettingsLanguage;
  currentDisplayName?: string | null;
}) => {
  const copy = MOBILE_ARENA_COPY[language] || MOBILE_ARENA_COPY.tr;

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow={copy.boardEyebrow}
        title={copy.boardTitle}
        body={copy.boardBody}
        badges={[
          { label: `${state.entries.length} ${copy.playerSuffix}`, tone: 'muted' },
        ]}
        metrics={[{ label: copy.statusLabel, value: state.status === 'loading' ? copy.loadingValue : copy.weeklyMode }]}
      />

      {state.status === 'loading' && state.entries.length === 0 ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow={copy.boardEyebrow}
          title={copy.loadingTitle}
          body={copy.loadingBody}
        />
      ) : null}

      {state.entries.length === 0 && state.status !== 'loading' ? (
        <StatePanel
          tone={state.status === 'error' ? 'clay' : 'sage'}
          variant={state.status === 'error' ? 'error' : 'empty'}
          eyebrow={copy.boardEyebrow}
          title={state.status === 'error' ? copy.errorTitle : copy.emptyTitle}
          body={state.status === 'error' ? copy.errorBody : copy.emptyBody}
        />
      ) : null}

      {state.entries.length > 0 ? (
        <View style={styles.arenaLeaderboardList}>
          {state.entries.map((item) => {
            const canOpenProfile = Boolean(
              String(item.userId || '').trim() || String(item.displayName || '').trim()
            );
            return (
              <Pressable
                key={`${item.rank}-${item.displayName}`}
                style={({ pressed }) => [
                  styles.arenaLeaderboardRow,
                  canOpenProfile && pressed && { opacity: 0.7 },
                ]}
                onPress={() => canOpenProfile && onOpenProfile(item)}
                disabled={!canOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={`${item.displayName} ${copy.nameAccessibilitySuffix}`}
              >
                <View style={styles.arenaLeaderboardRankWrap}>
                  <Text style={styles.arenaLeaderboardRank}>{item.rank}</Text>
                </View>
                <View style={styles.arenaLeaderboardAvatarWrap}>
                  {item.avatarUrl ? (
                    <Image
                      source={{ uri: item.avatarUrl }}
                      style={styles.arenaLeaderboardAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.arenaLeaderboardAvatarFallback}>
                      {(String(item.displayName || '').trim().slice(0, 1) || 'U').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={[styles.arenaLeaderboardContent, { flex: 1 }]}>
                  <Text style={styles.arenaLeaderboardName}>{item.displayName}</Text>
                  <Text style={styles.arenaLeaderboardMeta}>
                    {copy.commentLabel} {item.ritualsCount} | {copy.echoLabel} {item.echoCount}
                  </Text>
                </View>
                {canOpenProfile ? (
                  <Ionicons name="chevron-forward" size={14} color="#8e8b84" style={{ marginLeft: 4 }} />
                ) : null}
              </Pressable>
            );
          })}
          {(() => {
            if (!currentDisplayName || state.entries.length < 2) return null;
            const normalizedName = currentDisplayName.trim().toLowerCase();
            const myIdx = state.entries.findIndex(
              (e) => String(e.displayName || '').trim().toLowerCase() === normalizedName
            );
            if (myIdx < 1) return null; // rank 1 or not found
            const myEntry = state.entries[myIdx];
            const above = state.entries[myIdx - 1];
            const commentDiff = above.ritualsCount - myEntry.ritualsCount;
            if (commentDiff <= 0) return null;
            const aboveName = String(above.displayName || '').trim();
            const msg =
              language === 'tr'
                ? `${aboveName}'e ${commentDiff} yorum kaldi — simdi yaz!`
                : language === 'fr'
                  ? `${commentDiff} commentaire(s) pour depasser ${aboveName} !`
                  : language === 'es'
                    ? `Te faltan ${commentDiff} comentarios para superar a ${aboveName}`
                    : `${commentDiff} comment(s) to overtake ${aboveName} — write now!`;
            return (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(255,149,0,0.10)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>🏆</Text>
                <Text style={{ color: '#FF9500', fontSize: 12, fontWeight: '600', flex: 1 }}>{msg}</Text>
              </View>
            );
          })()}
        </View>
      ) : null}
    </>
  );
};
type PublicProfileDetail = {
  displayName?: string | null;
  avatarUrl?: string | null;
  ritualsCount?: number | null;
  followingCount?: number | null;
  followersCount?: number | null;
};

const PublicProfileBridgeCard = ({
  profileInput,
  onProfileInputChange,
  onOpenProfile,
  canOpenProfile,
}: {
  profileInput: string;
  onProfileInputChange: (value: string) => void;
  onOpenProfile: () => void;
  canOpenProfile: boolean;
}) => {
  const normalizedInput = String(profileInput || '').trim().replace(/^@+/, '');

  return (
    <ScreenCard accent="clay">
      <Text style={styles.sectionLeadTitle}>Profil</Text>
      <Text style={styles.sectionLeadBody}>@kullanici ile ac.</Text>

      <TextInput
        style={styles.publicProfileInput}
        value={profileInput}
        onChangeText={onProfileInputChange}
        autoCapitalize="none"
        placeholder="kullanici-adi"
        placeholderTextColor="#8e8b84"
        accessibilityLabel="Profil kullanici adi"
      />

      {canOpenProfile ? (
        <StatusStrip
          tone="sage"
          eyebrow="Hazir"
          title={`@${normalizedInput}`}
          body="Profili acabilirsin."
        />
      ) : (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Profil Arama"
          title="Kullanici adi yaz"
          body="Ornek: cinephile"
        />
      )}

      <UiButton
        label={canOpenProfile ? 'Profili Ac' : 'Bekleniyor'}
        tone={canOpenProfile ? 'brand' : 'neutral'}
        onPress={onOpenProfile}
        disabled={!canOpenProfile}
        accessibilityLabel="Profili ac"
      />
    </ScreenCard>
  );
};

const PublicProfileDetailCard = ({
  status,
  message,
  displayNameHint,
  profile,
  isSignedIn,
  followStatus,
  isFollowing,
  followsYou,
  isSelfProfile,
  followMessage,
  onToggleFollow,
  onOpenFullProfile,
  onBack,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  displayNameHint?: string;
  profile?: PublicProfileDetail | null;
  isSignedIn: boolean;
  followStatus: 'idle' | 'loading' | 'ready' | 'error';
  isFollowing: boolean;
  followsYou: boolean;
  isSelfProfile: boolean;
  followMessage: string;
  onToggleFollow: () => void;
  onOpenFullProfile: () => void;
  onBack: () => void;
}) => {
  const profileDisplayName = String(profile?.displayName || displayNameHint || '@bilinmeyen').trim();
  const normalizedAvatarUrl = String(profile?.avatarUrl || '').trim();
  const ritualsCount = Math.max(0, Number(profile?.ritualsCount || 0));
  const followingCount = Math.max(0, Number(profile?.followingCount || 0));
  const followersCount = Math.max(0, Number(profile?.followersCount || 0));
  const isFollowBusy = followStatus === 'loading';
  const followTone =
    followStatus === 'error' ? 'clay' : followStatus === 'ready' ? 'sage' : 'muted';

  if (status === 'loading' && !profile) {
    return (
      <StatePanel tone="sage" variant="loading" eyebrow="Profil" title="Profil yukleniyor" body="Biraz bekle." />
    );
  }
  if (status === 'error' && !profile) {
    return (
      <StatePanel tone="clay" variant="error" eyebrow="Profil" title="Profil acilamadi" body={message} />
    );
  }

  return (
    <ScreenCard accent="sage">
      {/* Close button — top right */}
      <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
        <Pressable
          onPress={onBack}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
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
        <View style={[styles.profileIdentityAvatarWrap, { width: 72, height: 72 }]}>
          {normalizedAvatarUrl ? (
            <Image source={{ uri: normalizedAvatarUrl }} style={[styles.profileIdentityAvatarImage, { width: 72, height: 72, borderRadius: 36 }]} resizeMode="cover" />
          ) : (
            <Text style={[styles.profileIdentityAvatarFallback, { fontSize: 26 }]}>
              {(profileDisplayName.slice(0, 1) || 'O').toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 3, paddingRight: 40 }}>
          <Text style={styles.sectionLeadTitle} numberOfLines={1}>{profileDisplayName}</Text>
          {followsYou && !isSelfProfile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#8A9A5B' }} />
              <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '600' }}>Seni takip ediyor</Text>
            </View>
          ) : null}
          {isSelfProfile ? (
            <Text style={{ color: '#8e8b84', fontSize: 11 }}>Bu profil sana ait</Text>
          ) : null}
        </View>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {[
          { label: 'YORUM', value: String(ritualsCount) },
          { label: 'TAKİP', value: String(followingCount) },
          { label: 'TAKİPÇİ', value: String(followersCount) },
        ].map((s) => (
          <View key={s.label} style={[styles.detailInfoCard, { flex: 1 }]}>
            <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{s.label}</Text>
            <Text style={styles.detailInfoValue}>{s.value}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {!isSelfProfile && isSignedIn ? (
          <UiButton
            label={isFollowBusy ? 'Isleniyor...' : isFollowing ? 'Takipten Cik' : 'Takip Et'}
            tone={isFollowing ? 'danger' : 'brand'}
            onPress={onToggleFollow}
            disabled={isFollowBusy || !profile}
            style={{ flex: 1 }}
          />
        ) : null}
        <UiButton
          label="Tum Profil"
          tone="neutral"
          onPress={onOpenFullProfile}
          style={{ flex: 1 }}
        />
      </View>

      {followMessage ? (
        <Text style={{ color: '#8e8b84', fontSize: 11, marginTop: 8, textAlign: 'center' }}>{followMessage}</Text>
      ) : null}
    </ScreenCard>
  );
};

const PlatformRulesCard = () => {
  const rules = [
    'Yorum notlari net, kisa ve konu odakli olmali.',
    'Toksik/nefret dili ve spam icerik kaldirilir.',
    'Ayni davet kodunu kotuye kullanma davranisi engellenir.',
    'Tekrarlayan ihlallerde hesap aksiyonu uygulanabilir.',
  ];

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Kural Katmani"
        title="Platform Kurallari"
        body="Webdeki manifesto ve topluluk cizgisi mobile de ayni cekirdek prensiplerle isler."
        badges={[
          { label: `${rules.length} ilke`, tone: 'sage' },
          { label: 'manifesto uyumu', tone: 'muted' },
        ]}
        metrics={[
          { label: 'Yorum', value: 'Net' },
          { label: 'Moderasyon', value: 'Aktif' },
          { label: 'Kod', value: 'Koruma' },
        ]}
      />
      <StatusStrip
        tone="muted"
        eyebrow="Enforcement"
        title="Topluluk cizgisi net"
        body="Spam, toksik dil ve davet sistemi kotuye kullanimi tek bir ilke seti altinda ele alinir."
        meta="Mobil ve web ayni davranis sinirlarini tasir."
      />
      <ScreenCard accent="sage">
        <Text style={styles.subSectionLabel}>Cekirdek Prensipler</Text>
        <View style={styles.rulesList}>
          {rules.map((rule, index) => (
            <View key={`rule-${index}`} style={styles.rulesRow}>
              <View style={styles.rulesDot} />
              <Text style={styles.rulesText}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScreenCard>
    </>
  );
};

export {
  setAppScreensThemeMode,
  AuthModal,
  AuthCard,
  AuthGateScreen,
  CollapsibleSectionCard,
  SectionLeadCard,
  StatePanel,
  ThemeModeCard,
  ScreenErrorBoundary,
  MobileSettingsModal,
  ProfileXpCard,
  ProfileIdentityCard,
  ProfileUnifiedCard,
  ProfileCinematicCard,
  ProfileActivityCard,
  ProfileGenreDistributionCard,
  ProfileSnapshotCard,
  ProfileMarksCard,
  PushStatusCard,
  PushInboxCard,
  WatchedMoviesCard,
  CommentFeedCard,
  DailyHomeScreen,
  RitualDraftCard,
  RitualComposerModal,
  LeaguePromotionModal,
  StreakCelebrationModal,
  InviteClaimScreen,
  ShareHubScreen,
  DiscoverRoutesCard,
  ArenaChallengeCard,
  ArenaLeaderboardCard,
  PublicProfileBridgeCard,
  PublicProfileDetailCard,
  PlatformRulesCard,
  ProfileMovieArchiveModal,
  PublicProfileMovieArchiveModal,
  MovieDetailsModal,
};

export type {
  MobileAuthEntryStage,
  MobileSettingsGender,
  MobileSettingsLanguage,
  MobileSettingsIdentityDraft,
  MobileSettingsPrivacyDraft,
  MobileSettingsSaveState,
};













