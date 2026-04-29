import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
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
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  Modal,
  Image,
  type TextProps,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Audio } from 'expo-av';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { mobileTranslations } from '../i18n';
import {
  MOBILE_MARK_CATALOG,
  groupMobileMarksByCategory,
  resolveMobileMarkMeta,
  resolveMobileMarkTitle,
} from '../lib/mobileMarksCatalog';
import { resolveMobileLeagueProgress, MOBILE_LEAGUES_DATA } from '../lib/mobileLeagueSystem';
import { CINEMA_AVATAR_CATALOG, getCinemaAvatarEntry, makeCinemaAvatarUrl, resolveAvatarEntry, type CinemaAvatarEntry } from '../lib/mobileAvatarCatalog';
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
import { LEAGUE_TRANSITION_COPY, resolveMarkUnlockSurfaceCopy, resolveStreakCelebrationCopy, resolveStreakCelebrationTheme, resolveStreakSurfaceCopy } from '../../../../src/domain/celebrations';
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DAILY_QUIZ_SOUND_CORRECT = require('../../assets/sounds/correct.wav') as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DAILY_QUIZ_SOUND_WRONG = require('../../assets/sounds/wrong.wav') as number;
const DAILY_QUIZ_CONFETTI_COLORS = ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa'];
const DAILY_QUIZ_CONFETTI_COUNT = 28;

let dailyQuizAudioCtx: AudioContext | null = null;
let dailyQuizAudioSuspendTimer: ReturnType<typeof setTimeout> | null = null;
const DAILY_QUIZ_AUDIO_IDLE_MS = 12000;

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

const resolveGenreVisual = (
  genreValue: string
): {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
} => {
  const genre = String(genreValue || '').trim().toLowerCase();
  const normalized = genre
    .replace(/[()]/g, ' ')
    .replace(/[,&]/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  const has = (...needles: string[]) =>
    needles.some((needle) => genre.includes(needle) || normalized.includes(needle));
  const hasAll = (...groups: string[][]) =>
    groups.every((group) =>
      group.some((needle) => genre.includes(needle) || normalized.includes(needle))
    );

  if (
    hasAll(
      ['action', 'aksiyon'],
      ['science fiction', 'sci-fi', 'scifi', 'bilim kurgu']
    )
  ) {
    return { icon: 'rocket-launch', accent: '#60a5fa' };
  }
  if (hasAll(['action', 'aksiyon'], ['adventure', 'macera'])) {
    return { icon: 'sword-cross', accent: '#a3e635' };
  }
  if (hasAll(['drama'], ['romance', 'romantik', 'ask', 'aşk'])) {
    return { icon: 'heart-multiple', accent: '#ec4899' };
  }
  if (hasAll(['comedy', 'komedi'], ['romance', 'romantik', 'ask', 'aşk'])) {
    return { icon: 'emoticon-kiss-outline', accent: '#f472b6' };
  }
  if (hasAll(['horror', 'korku'], ['thriller', 'gerilim'])) {
    return { icon: 'ghost-outline', accent: '#fb7185' };
  }
  if (hasAll(['crime', 'suc', 'suç'], ['drama'])) {
    return { icon: 'police-badge-outline', accent: '#fb923c' };
  }
  if (hasAll(['mystery', 'gizem'], ['thriller', 'gerilim'])) {
    return { icon: 'incognito', accent: '#a78bfa' };
  }

  if (has('action', 'aksiyon')) return { icon: 'bomb', accent: '#f59e0b' };
  if (has('adventure', 'macera')) return { icon: 'compass-outline', accent: '#84cc16' };
  if (has('drama')) return { icon: 'drama-masks', accent: '#c98b6b' };
  if (has('horror', 'korku')) return { icon: 'wizard-hat', accent: '#ef4444' };
  if (has('thriller', 'gerilim')) return { icon: 'heart-pulse', accent: '#fb7185' };
  if (has('crime', 'suc', 'suç')) return { icon: 'scale-balance', accent: '#f97316' };
  if (has('romance', 'romantik', 'ask', 'aşk')) return { icon: 'heart', accent: '#ec4899' };
  if (has('comedy', 'komedi')) return { icon: 'emoticon-happy-outline', accent: '#facc15' };
  if (has('science fiction', 'sci-fi', 'scifi', 'bilim kurgu')) {
    return { icon: 'ufo', accent: '#60a5fa' };
  }
  if (has('fantasy', 'fantezi')) return { icon: 'auto-fix', accent: '#a78bfa' };
  if (has('animation', 'animasyon')) return { icon: 'star-four-points-outline', accent: '#22c55e' };
  if (has('documentary', 'belgesel')) return { icon: 'camera-outline', accent: '#94a3b8' };
  if (has('family', 'aile')) return { icon: 'home-heart', accent: '#10b981' };
  if (has('history', 'tarih')) return { icon: 'bank-outline', accent: '#c084fc' };
  if (has('war', 'savas', 'savaş')) return { icon: 'shield-sword-outline', accent: '#fb923c' };
  if (has('western')) return { icon: 'hat-fedora', accent: '#f59e0b' };
  if (has('music', 'muzik', 'müzik')) return { icon: 'music-note-outline', accent: '#38bdf8' };
  if (has('mystery', 'gizem')) return { icon: 'magnify', accent: '#a78bfa' };
  return { icon: 'movie-open-outline', accent: '#8A9A5B' };
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

const blendHexColors = (fromHex: string, toHex: string, ratio: number): string => {
  const normalize = (value: string): string => {
    const normalized = value.trim().replace('#', '');
    const expanded = normalized.length === 3
      ? normalized.split('').map((ch) => ch + ch).join('')
      : normalized;
    return /^[0-9a-fA-F]{6}$/.test(expanded) ? expanded : '8A9A5B';
  };

  const from = normalize(fromHex);
  const to = normalize(toHex);
  const safeRatio = Math.min(1, Math.max(0, ratio));
  const mixChannel = (start: number, end: number) =>
    Math.round(start + (end - start) * safeRatio)
      .toString(16)
      .padStart(2, '0');

  const r = mixChannel(parseInt(from.slice(0, 2), 16), parseInt(to.slice(0, 2), 16));
  const g = mixChannel(parseInt(from.slice(2, 4), 16), parseInt(to.slice(2, 4), 16));
  const b = mixChannel(parseInt(from.slice(4, 6), 16), parseInt(to.slice(4, 6), 16));
  return `#${r}${g}${b}`.toUpperCase();
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

export type MobileMarkUnlockEvent = {
  markId: string;
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
  body?: string;
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
    {body ? <Text style={styles.sectionLeadBody}>{body}</Text> : null}

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

// ─── AvatarView ─────────────────────────────────────────────────────────────
// Unified avatar renderer — handles preset avatars and fallback initials.
// Photo uploads are no longer supported; all avatars are preset-based.
const AvatarView = ({
  avatarUrl,
  displayName,
  size = 48,
  borderColor,
}: {
  avatarUrl?: string | null;
  displayName?: string | null;
  size?: number;
  borderColor?: string;
}) => {
  const entry = resolveAvatarEntry(avatarUrl || '');
  const initial = (String(displayName || '').trim().slice(0, 1) || 'O').toUpperCase();
  const radius = size / 2;
  const fontSize = Math.round(size * 0.42);
  const iconSize = Math.round(size * 0.55);

  // Cinema SVG avatar
  if (entry) {
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${entry.svgPaths}</svg>`;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: entry.bg,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          borderWidth: 2,
          borderColor: borderColor || entry.accent,
        }}
      >
        <SvgXml xml={xml} width={iconSize} height={iconSize} color={entry.accent} />
      </View>
    );
  }
  // Fallback: initials
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: '#1a1a1a',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderWidth: 2,
        borderColor: borderColor || 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ color: borderColor || '#8e8b84', fontSize, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
};

// ─── PresetAvatarPickerGrid ──────────────────────────────────────────────────
// Grid of selectable preset avatars for the settings modal.
const PresetAvatarPickerGrid = ({
  selectedAvatarUrl,
  isPremium,
  onSelect,
  language = 'tr',
}: {
  selectedAvatarUrl: string;
  isPremium: boolean;
  onSelect: (avatarUrl: string) => void;
  language?: MobileSettingsLanguage;
}) => {
  const premiumHint = language === 'tr' ? 'Premium uyelik gerektirir' : language === 'fr' ? 'Abonnement premium requis' : language === 'es' ? 'Requiere suscripcion premium' : 'Requires premium membership';

  const renderAvatarButton = (entry: CinemaAvatarEntry) => {
    const avatarUrl = makeCinemaAvatarUrl(entry.id);
    const isSelected = selectedAvatarUrl === avatarUrl;
    const isLocked = !entry.isFree && !isPremium;
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${entry.svgPaths}</svg>`;
    return (
      <Pressable
        key={entry.id}
        onPress={() => !isLocked && onSelect(avatarUrl)}
        disabled={isLocked}
        style={{ alignItems: 'center' as const, gap: 4, opacity: isLocked ? 0.4 : 1, width: 64 }}
        accessibilityRole="button"
        accessibilityLabel={entry.label}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: entry.bg,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? entry.accent : 'rgba(255,255,255,0.08)',
          }}
        >
          <SvgXml xml={xml} width={30} height={30} color={entry.accent} />
          {isLocked ? (
            <View style={{ position: 'absolute' as const, top: 2, right: 2 }}>
              <Text style={{ fontSize: 9 }}>🔒</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: isSelected ? entry.accent : '#6b6b6b', fontSize: 9, fontWeight: isSelected ? '700' : '400', textAlign: 'center' as const }}>
          {entry.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 }}>
        {CINEMA_AVATAR_CATALOG.map(renderAvatarButton)}
      </View>
      {!isPremium ? (
        <View style={{ backgroundColor: 'rgba(255,149,0,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,149,0,0.2)', paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: '#FF9500', fontSize: 11 }}>🔒 {premiumHint}</Text>
        </View>
      ) : null}
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
          <AvatarView avatarUrl={normalizedAvatarUrl} displayName={normalizedDisplayName} size={64} />
          <View style={styles.profileIdentityHeroCopy}>
            <Text style={styles.detailInfoLabel}>Avatar</Text>
            <Text style={styles.detailInfoValue}>
              {normalizedAvatarUrl ? 'Secildi' : 'Secilmedi'}
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
  _username,
  bio,
  birthDateLabel,
  genderLabel,
  profileLink,
  onOpenSettings,
  onOpenProfileLink,
  onOpenShareHub,
  onOpenComments,
  onOpenFollowing,
  onOpenFollowers,
  onOpenMarks,
  language = 'tr',
}: {
  state: ProfileState;
  isSignedIn: boolean;
  isShareHubActive?: boolean;
  displayName: string;
  avatarUrl?: string;
  _username?: string;
  bio?: string;
  birthDateLabel?: string;
  genderLabel?: string;
  profileLink?: string;
  language?: MobileSettingsLanguage;
  onOpenSettings?: () => void;
  onOpenProfileLink?: () => void;
  onOpenShareHub?: () => void;
  onOpenComments?: () => void;
  onOpenFollowing?: () => void;
  onOpenFollowers?: () => void;
  onOpenMarks?: () => void;
}) => {
  const copy =
    language === 'tr'
      ? {
          observer: 'Gozlemci',
          eyebrow: 'Profil',
          bioFallback: 'Profil notunu ayarlardan duzenleyerek sahneni daha net hale getirebilirsin.',
          settingsA11y: 'Profil ayarlarini ac',
          linkLabel: 'Link',
          noteLabel: 'Profil notu',
          gender: 'Cinsiyet',
          birth: 'Dogum',
          handleMissing: 'Handle eklenmedi',
          profileSync: 'Profil senkronlaniyor',
          comments: 'Yorum',
          following: 'Takip',
          followers: 'Takipci',
          marks: 'Mark',
          streak: 'Seri',
          streakTitle: 'Aktif seri',
          streakHint: 'Bugunku ritmini korudukca burada buyur.',
          activeDays: 'Aktif gun',
          linkReady: 'Profil linki hazir',
          shareOpen: 'Paylasim acik',
          sharePending: 'Paylasim hazirlaniyor',
          xpSection: 'Lig ilerleyisi',
          xpRemaining: (label: string, xp: number) => `${label} icin ${xp} XP kaldi.`,
          topLeague: 'Su an en ust ligdesin.',
          openLink: 'Linki ac',
          shareHub: 'Paylasim hubi',
          shareOpenButton: 'Paylas',
          progressNow: (current: number, total: number) => `${current}/${total} XP`,
        }
      : {
          observer: 'Observer',
          eyebrow: 'Profile',
          bioFallback: 'Refine your profile note in settings to make your scene clearer.',
          settingsA11y: 'Open profile settings',
          linkLabel: 'Link',
          noteLabel: 'Profile note',
          gender: 'Gender',
          birth: 'Birth',
          handleMissing: 'Handle missing',
          profileSync: 'Profile syncing',
          comments: 'Comments',
          following: 'Following',
          followers: 'Followers',
          marks: 'Marks',
          streak: 'Streak',
          streakTitle: 'Active streak',
          streakHint: 'This grows as you keep the daily rhythm alive.',
          activeDays: 'Active days',
          linkReady: 'Profile link ready',
          shareOpen: 'Share live',
          sharePending: 'Share pending',
          xpSection: 'League progress',
          xpRemaining: (label: string, xp: number) => `${xp} XP left for ${label}.`,
          topLeague: 'You are already in the top league.',
          openLink: 'Open link',
          shareHub: 'Share hub',
          shareOpenButton: 'Share',
          progressNow: (current: number, total: number) => `${current}/${total} XP`,
        };
  const normalizedDisplayName = String(displayName || '').trim() || copy.observer;
  const normalizedAvatarUrl = String(avatarUrl || '').trim();
  const rawBio = String(bio || '').trim();
  const normalizedBio =
    rawBio &&
    rawBio !== copy.bioFallback &&
    !/^(profilini ve lig durumunu buradan yonet\.?|manage your profile and league status here\.?|manage your profile and archive here\.?|a silent observer\.?)$/i.test(
      rawBio
    )
      ? rawBio
      : '';
  const normalizedBirthDate = String(birthDateLabel || '').trim();
  const normalizedGender = String(genderLabel || '').trim();
  const normalizedLink = String(profileLink || '').trim();
  const hasLink = Boolean(normalizedLink);
  const hasShareHubAction = typeof onOpenShareHub === 'function';
  const isProfileReady = state.status === 'success';
  const totalXp = isProfileReady ? Math.max(0, Math.floor(Number(state.totalXp || 0))) : 0;
  const progress = resolveMobileLeagueProgress(totalXp);
  const xpToNext = Math.max(0, Math.floor(progress.nextLevelXp - totalXp));
  const currentLeagueLabel = isProfileReady
    ? resolveLocalizedLeagueDisplayName(language, state.leagueKey, state.leagueName)
    : copy.profileSync;
  const nextLeagueLabel = isProfileReady
    ? resolveLocalizedLeagueDisplayName(language, state.nextLeagueKey, state.nextLeagueName)
    : '';
  const effectiveProgressWidth =
    progress.progressPercentage > 0 ? Math.max(progress.progressPercentage, 3) : 0;
  const fallbackLeagueColor = getProgressHeadColor(progress.progressPercentage);
  const currentLeagueColor = isProfileReady
    ? MOBILE_LEAGUES_DATA[state.leagueKey as keyof typeof MOBILE_LEAGUES_DATA]?.color ||
      state.leagueColor ||
      fallbackLeagueColor
    : fallbackLeagueColor;
  const nextLeagueColor =
    isProfileReady && state.nextLeagueKey
      ? MOBILE_LEAGUES_DATA[state.nextLeagueKey as keyof typeof MOBILE_LEAGUES_DATA]?.color ||
        currentLeagueColor
      : currentLeagueColor;
  const leagueTransitionRatio = Math.min(1, Math.max(0, progress.progressPercentage / 100));
  const leagueAccentColor = blendHexColors(currentLeagueColor, nextLeagueColor, leagueTransitionRatio);
  const xpBarHeadColor = blendHexColors(
    currentLeagueColor,
    nextLeagueColor,
    Math.min(1, leagueTransitionRatio + 0.16)
  );
  const xpBarBaseColor = hexToRgba(currentLeagueColor, 0.2);
  const avatarBorderColor = `${currentLeagueColor}CC`;
  const xpBarOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(xpBarOpacity, {
      toValue: 1,
      duration: 500,
      delay: 150,
      useNativeDriver: SUPPORTS_NATIVE_DRIVER,
    }).start();
  }, [xpBarOpacity]);

  const compactLinkLabel = hasLink
    ? normalizedLink.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : '';
  const summaryBadges = [
    currentLeagueLabel,
  ].filter(Boolean) as string[];
  const detailCards = [
    normalizedGender ? { key: 'gender', label: copy.gender, value: normalizedGender } : null,
    normalizedBirthDate ? { key: 'birth', label: copy.birth, value: normalizedBirthDate } : null,
    hasLink ? { key: 'link', label: copy.linkLabel, value: compactLinkLabel } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; value: string }>;
  const statCards = [
    {
      key: 'comments',
      label: copy.comments,
      value: isProfileReady ? String(state.ritualsCount) : '--',
      onPress: onOpenComments,
    },
    {
      key: 'following',
      label: copy.following,
      value: isProfileReady ? String(state.followingCount) : '--',
      onPress: onOpenFollowing,
    },
    {
      key: 'followers',
      label: copy.followers,
      value: isProfileReady ? String(state.followersCount) : '--',
      onPress: onOpenFollowers,
    },
    {
      key: 'marks',
      label: copy.marks,
      value: isProfileReady ? String(state.marks.length) : '--',
      onPress: onOpenMarks,
    },
  ];
  const xpMeta = isProfileReady
    ? state.nextLeagueName
      ? copy.xpRemaining(nextLeagueLabel, xpToNext)
      : copy.topLeague
    : copy.profileSync;
  return (
    <ScreenCard accent="sage">
      {onOpenSettings ? (
        <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
          <Pressable
            style={({ pressed }) => [
              styles.profileSettingsButton,
              pressed ? { opacity: 0.55, transform: [{ scale: 0.88 }] } : null,
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 40 }}>
        {(() => {
          const entry = resolveAvatarEntry(normalizedAvatarUrl);
          const accentBorder = entry ? entry.accent : avatarBorderColor;
          return (
            <AvatarView
              avatarUrl={normalizedAvatarUrl}
              displayName={normalizedDisplayName}
              size={88}
              borderColor={accentBorder}
            />
          );
        })()}

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.sectionLeadEyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.sectionLeadTitle} numberOfLines={1}>
            {normalizedDisplayName}
          </Text>
          {summaryBadges.length > 0 ? (
            <View style={[styles.sectionLeadBadgeRow, { marginTop: 10 }]}>
              {summaryBadges.map((badge) => (
                <View key={badge} style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
                  <Text style={styles.sectionLeadBadgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {isProfileReady ? (
        <View
          style={[
            styles.detailInfoCard,
            {
              marginTop: 16,
              borderColor: 'rgba(255,149,0,0.22)',
              backgroundColor: 'rgba(255,149,0,0.08)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailInfoLabel, { color: '#FFB457' }]}>{copy.streakTitle}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 }}>
                <Text style={[styles.detailInfoValue, { color: '#FFB457', fontSize: 34, lineHeight: 36 }]}>
                  {state.streak}
                </Text>
                <Text style={[styles.screenMeta, { marginBottom: 4, color: '#c4b29d' }]}>
                  {copy.streak}
                </Text>
              </View>
            </View>
            <View
              style={{
                minWidth: 72,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,180,87,0.22)',
                backgroundColor: 'rgba(255,180,87,0.12)',
              }}
            >
              <Text style={[styles.detailInfoLabel, { color: '#FFB457', textAlign: 'center' }]}>
                {copy.activeDays}
              </Text>
              <Text style={[styles.detailInfoValue, { color: '#FFB457', textAlign: 'center' }]}>
                {state.daysPresent}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasShareHubAction || hasLink ? (
        <View style={[styles.sectionLeadActionRow, { marginTop: 14 }]}>
          {hasShareHubAction ? (
            <UiButton
              label={isShareHubActive ? copy.shareOpenButton : copy.shareHub}
              tone="neutral"
              onPress={() => onOpenShareHub?.()}
              disabled={!isSignedIn}
            />
          ) : null}
          {hasLink ? (
            <UiButton
              label={copy.openLink}
              tone="teal"
              onPress={() => onOpenProfileLink?.()}
              disabled={!isSignedIn}
            />
          ) : null}
        </View>
      ) : null}

      {normalizedBio ? (
        <View style={[styles.detailInfoCard, { marginTop: 16 }]}>
          <Text style={styles.detailInfoLabel}>{copy.noteLabel}</Text>
          <Text style={[styles.sectionLeadBody, { marginTop: 6 }]}>{normalizedBio}</Text>
        </View>
      ) : null}

      {detailCards.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {detailCards.map((item) => (
            <View key={item.key} style={[styles.detailInfoCard, { flexBasis: '48%', flexGrow: 1 }]}>
              <Text style={styles.detailInfoLabel}>{item.label}</Text>
              <Text style={[styles.screenMeta, { marginTop: 4 }]} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.profileUnifiedDivider, { marginTop: 16 }]} />

      <View style={{ gap: 8, marginTop: 16 }}>
        <Text style={styles.subSectionLabel}>{copy.xpSection}</Text>
        <Text style={styles.sectionLeadBody}>{xpMeta}</Text>
        <Animated.View
          style={[
            styles.profileXpTrack,
            {
              opacity: xpBarOpacity,
              backgroundColor: hexToRgba(nextLeagueColor, 0.1),
              borderColor: hexToRgba(leagueAccentColor, 0.3),
            },
          ]}
        >
          {effectiveProgressWidth > 0 ? (
            <View
              style={[
                styles.profileXpFill,
                {
                  width: `${effectiveProgressWidth}%`,
                  backgroundColor: xpBarBaseColor,
                },
              ]}
            >
              <View style={[styles.profileXpFillHeadTint, { backgroundColor: leagueAccentColor }]} />
              <View
                style={[
                  styles.profileXpFillHeadTint,
                  {
                    width: '30%',
                    right: 0,
                    left: undefined,
                    backgroundColor: xpBarHeadColor,
                  },
                ]}
              />
            </View>
          ) : null}
        </Animated.View>
        <View style={styles.profileXpScaleRow}>
          <Text style={styles.profileXpScaleText}>{currentLeagueLabel}</Text>
          <Text style={styles.profileXpScaleText}>{nextLeagueLabel || currentLeagueLabel}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {statCards.map((stat) =>
          stat.onPress ? (
            <Pressable
              key={stat.key}
              style={[styles.detailInfoCard, { flexBasis: '48%', flexGrow: 1 }]}
              onPress={stat.onPress}
              accessibilityRole="button"
            >
              <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{stat.label}</Text>
              <Text style={styles.detailInfoValue}>{stat.value}</Text>
            </Pressable>
          ) : (
            <View key={stat.key} style={[styles.detailInfoCard, { flexBasis: '48%', flexGrow: 1 }]}>
              <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{stat.label}</Text>
              <Text style={styles.detailInfoValue}>{stat.value}</Text>
            </View>
          )
        )}
      </View>

    </ScreenCard>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LegacyProfileUnifiedCard = ({
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
  onOpenComments,
  onOpenFollowing,
  onOpenMarks,
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
  onOpenComments?: () => void;
  onOpenFollowing?: () => void;
  onOpenMarks?: () => void;
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
   
  const _fillTailColor = getProgressTailColor(progress.progressPercentage);
  const effectiveProgressWidth =
    progress.progressPercentage > 0 ? Math.max(progress.progressPercentage, 3) : 0;
  // League color for avatar border and XP bar
  // Use leagueColor directly from state; guard against Absolute (black) and Eternal (white) extremes
  const rawLeagueColor = state.status === 'success' ? state.leagueColor : null;
  const leagueAccentColor =
    rawLeagueColor && rawLeagueColor !== '#121212' && rawLeagueColor !== '#e5e4e2'
      ? rawLeagueColor
      : fillHeadColor;
  const avatarBorderColor =
    rawLeagueColor && rawLeagueColor !== '#121212' && rawLeagueColor !== '#e5e4e2'
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
        {/* Avatar — cinema SVG icon or photo */}
        {(() => {
          const entry = resolveAvatarEntry(normalizedAvatarUrl);
          const accentBorder = entry ? entry.accent : avatarBorderColor;
          return (
            <AvatarView
              avatarUrl={normalizedAvatarUrl}
              displayName={normalizedDisplayName}
              size={96}
              borderColor={accentBorder}
            />
          );
        })()}

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
            <Text style={[styles.sectionLeadBody, { fontSize: 11, color: '#6f665c' }]}>{identityMeta}</Text>
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

      {/* ── Stats — 3 interactive items ── */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        {[
          { label: copy.comments, value: isProfileReady ? String(state.ritualsCount) : '--', onPress: onOpenComments },
          { label: copy.following, value: isProfileReady ? String(state.followingCount) : '--', onPress: onOpenFollowing },
          { label: copy.marks, value: isProfileReady ? String(state.marks.length) : '--', onPress: onOpenMarks },
        ].map((stat) => (
          <Pressable key={stat.label} style={[styles.detailInfoCard, { flex: 1, minWidth: 0 }]} onPress={stat.onPress} accessibilityRole="button">
            <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]} numberOfLines={2}>{stat.label}</Text>
            <Text style={styles.detailInfoValue}>{stat.value}</Text>
          </Pressable>
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
  showFilmFallback = true,
  language = 'tr',
}: {
  state: ProfileState;
  isSignedIn: boolean;
  activityState: ProfileActivitySurfaceState;
  showFilmFallback?: boolean;
  language?: MobileSettingsLanguage;
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
  const fallbackFilms = useMemo(
    () => buildProfileFilmSummaries(activityState.items, 3),
    [activityState.items]
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
  const dominantGenreVisual = topGenres[0] ? resolveGenreVisual(topGenres[0].genre) : null;
  const copy =
    language === 'tr'
      ? {
          eyebrow: 'Cinematic DNA',
          body: 'Yorum yaptigin filmlere gore Cinematic DNA burada sekillenir.',
          fallbackTitle: 'Tur izi zayif ama ritim gorunuyor',
          fallbackBody: 'Tur verisi eksik yorumlar da profilin film hafizasina ekleniyor.',
          emptyTitle: 'Henuz DNA izi olusmadi',
          emptyBody: 'Yorum geldikce baskin turler burada belirir.',
          loadingTitle: 'DNA sinyali yukleniyor',
          loadingBody: 'Profil sinyalleri hazirlaniyor.',
          errorTitle: 'DNA sinyali okunamadi',
          comments: 'yorum',
          genres: 'tur',
          streak: 'seri',
          traces: 'yorum izi',
        }
      : {
          eyebrow: 'Cinematic DNA',
          body: 'Your Cinematic DNA takes shape from the films you comment on.',
          fallbackTitle: 'Genre signal is weak but the rhythm is visible',
          fallbackBody: 'Comments without genre data still feed the film memory.',
          emptyTitle: 'No DNA signal yet',
          emptyBody: 'Dominant genres appear here as comments arrive.',
          loadingTitle: 'Loading DNA signal',
          loadingBody: 'Preparing profile signals.',
          errorTitle: 'DNA signal could not be read',
          comments: 'comments',
          genres: 'genres',
          streak: 'streak',
          traces: 'comment traces',
        };

  if (!isSignedIn) {
    return (
      <StatePanel
        tone="clay"
        variant="empty"
        eyebrow="Cinematic DNA"
        title="DNA katmani icin giris yap"
        body="DNA karti sadece oturumla acilir."
      />
    );
  }

  if (activityState.status !== 'ready' && activityState.items.length === 0) {
    return (
      <StatePanel
        tone="sage"
        variant={
          activityState.status === 'loading'
            ? 'loading'
            : activityState.status === 'error'
              ? 'error'
              : 'empty'
        }
        eyebrow={copy.eyebrow}
        title={activityState.status === 'error' ? copy.errorTitle : copy.loadingTitle}
        body={activityState.status === 'error' ? activityState.message || copy.loadingBody : copy.loadingBody}
      />
    );
  }

  if (topGenres.length === 0) {
    if (showFilmFallback && fallbackFilms.length > 0) {
      return (
        <ScreenCard accent="sage">
          <Text style={styles.sectionLeadEyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.sectionLeadTitle}>{copy.fallbackTitle}</Text>
          <Text style={styles.sectionLeadBody}>{copy.fallbackBody}</Text>

          <View style={[styles.sectionLeadBadgeRow, { marginTop: 14 }]}>
            <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
              <Text style={styles.sectionLeadBadgeText}>{`${activityState.items.length} ${copy.comments}`}</Text>
            </View>
            <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
              <Text style={styles.sectionLeadBadgeText}>{`${fallbackFilms.length} film`}</Text>
            </View>
            <View
              style={[
                styles.sectionLeadBadge,
                exact180Count > 0 ? styles.sectionLeadBadgeClay : styles.sectionLeadBadgeMuted,
              ]}
            >
              <Text style={styles.sectionLeadBadgeText}>{`${exact180Count} exact-180`}</Text>
            </View>
          </View>

          <View style={{ marginTop: 16, gap: 10 }}>
            {fallbackFilms.map((film) => (
              <View key={`dna-fallback-${film.key}`} style={styles.profileArchiveRow}>
                <View style={styles.profileArchiveRowCopy}>
                  <Text style={styles.profileArchiveTitle}>{film.title}</Text>
                  <Text style={styles.profileArchiveMeta}>
                    {film.year ? `${film.year} | ` : ''}
                    {film.count} yorum
                    {film.lastDate ? ` | Son: ${film.lastDate}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScreenCard>
      );
    }

    return (
      <StatePanel
        tone="sage"
        variant="empty"
        eyebrow={copy.eyebrow}
        title={copy.emptyTitle}
        body={
          activityState.items.length > 0
            ? 'Film kayitlari gorundu ama tur sinyali henuz okunamadi.'
            : copy.emptyBody
        }
      />
    );
  }

  return (
    <ScreenCard accent="sage">
      <Text style={styles.sectionLeadEyebrow}>{copy.eyebrow}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${dominantGenreVisual?.accent || '#8A9A5B'}18`,
            borderWidth: 1,
            borderColor: `${dominantGenreVisual?.accent || '#8A9A5B'}44`,
          }}
        >
          <MaterialCommunityIcons
            name={dominantGenreVisual?.icon || 'movie-open-outline'}
            size={18}
            color={dominantGenreVisual?.accent || '#8A9A5B'}
          />
        </View>
        <Text style={[styles.sectionLeadTitle, { flex: 1 }]}>{topGenres[0]?.genre || 'DNA'}</Text>
      </View>
      <Text style={styles.sectionLeadBody}>{copy.body}</Text>

        <View style={[styles.sectionLeadBadgeRow, { marginTop: 14 }]}>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
            <Text style={styles.sectionLeadBadgeText}>{`${activityState.items.length} ${copy.comments}`}</Text>
          </View>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>{`${genreSignals.length} ${copy.genres}`}</Text>
          </View>
        {hiddenGemCount > 0 ? (
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeClay]}>
            <Text style={styles.sectionLeadBadgeText}>{`${hiddenGemCount} hidden gem`}</Text>
          </View>
        ) : null}
        {streakValue > 0 ? (
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>{`${streakValue} ${copy.streak}`}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.profileGrid, { marginTop: 14 }]}>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{streakValue}</Text>
          <Text style={styles.profileMetricLabel}>Streak</Text>
        </View>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{genreSignals.length}</Text>
          <Text style={styles.profileMetricLabel}>Tur</Text>
        </View>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{exact180Count}</Text>
          <Text style={styles.profileMetricLabel}>Exact-180</Text>
        </View>
      </View>

      <View style={[styles.profileDnaList, { marginTop: 14 }]}>
        {topGenres.map((genreEntry) => {
          const percentage = totalGenres > 0 ? Math.round((genreEntry.count / totalGenres) * 100) : 0;
          const genreVisual = resolveGenreVisual(genreEntry.genre);
          return (
            <View key={`profile-dna-row-${genreEntry.genre}`} style={styles.profileDnaListItem}>
              <View style={styles.profileGenreRow}>
                <View style={[styles.profileDnaGenreCopy, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${genreVisual.accent}18`,
                      borderWidth: 1,
                      borderColor: `${genreVisual.accent}3f`,
                    }}
                  >
                    <MaterialCommunityIcons name={genreVisual.icon} size={15} color={genreVisual.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileGenreLabel} numberOfLines={1}>
                      {genreEntry.genre}
                    </Text>
                    <Text style={styles.profileDnaGenreHint}>{genreEntry.count} {copy.traces}</Text>
                  </View>
                </View>
                <Text style={styles.profileDnaGenreValue}>{percentage}%</Text>
              </View>
              <View style={styles.profileDnaGenreTrack}>
                <View
                  style={[
                    styles.profileDnaGenreFill,
                    {
                      width: `${Math.max(12, percentage)}%`,
                      backgroundColor: `${genreVisual.accent}CC`,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </ScreenCard>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LegacyProfileCinematicCard = ({
  state,
  isSignedIn,
  activityState,
  showFilmFallback = true,
}: {
  state: ProfileState;
  isSignedIn: boolean;
  activityState: ProfileActivitySurfaceState;
  showFilmFallback?: boolean;
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
  const fallbackFilms = useMemo(
    () => buildProfileFilmSummaries(activityState.items, 3),
    [activityState.items]
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
  const _unlockedCount = dnaSegments.filter((segment) => segment.unlocked).length;

  if (!isSignedIn) {
    return (
      <StatePanel
        tone="clay"
        variant="empty"
        eyebrow="Cinematic DNA"
        title="DNA katmani icin giris yap"
        body="DNA karti oturumla acilir."
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
            : 'Profil sinyalleri hazirlaniyor.'
        }
      />
    );
  }

  if (topGenres.length === 0) {
    if (showFilmFallback && activityState.items.length > 0) {
      return (
        <>
          <SectionLeadCard
            accent="sage"
            eyebrow="Cinematic DNA"
            title={fallbackFilms[0]?.title || 'Profil izi'}
            body="Tur verisi eksik olsa da yorum ritmi okundu."
            badges={[
              { label: `${activityState.items.length} yorum`, tone: 'sage' },
              { label: `${fallbackFilms.length} film`, tone: 'muted' },
              { label: `${exact180Count} exact-180`, tone: exact180Count > 0 ? 'clay' : 'muted' },
            ]}
            metrics={[
              { label: 'Streak', value: String(streakValue) },
              { label: 'Film', value: String(fallbackFilms.length) },
              { label: 'Iz', value: String(activityState.items.length) },
            ]}
          />
          <ScreenCard accent="sage">
            <Text style={styles.subSectionLabel}>Film Izleri</Text>
            <View style={styles.profileArchiveList}>
              {fallbackFilms.map((film) => (
                <View key={`dna-fallback-${film.key}`} style={styles.profileArchiveRow}>
                  <View style={styles.profileArchiveRowCopy}>
                    <Text style={styles.profileArchiveTitle}>{film.title}</Text>
                    <Text style={styles.profileArchiveMeta}>
                      {film.year ? `${film.year} | ` : ''}
                      {film.count} yorum
                      {film.lastDate ? ` | Son: ${film.lastDate}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScreenCard>
        </>
      );
    }
    return (
      <StatePanel
        tone="sage"
        variant="empty"
        eyebrow="Cinematic DNA"
        title="Henuz DNA izi olusmadi"
        body={
          activityState.items.length > 0
            ? 'Film kayitlari gorundu ama tur sinyali henuz okunamadi.'
            : 'Yorum geldikce baskin turler burada belirir.'
        }
      />
    );
  }

  return (
    <ScreenCard accent="sage">
      <Text style={styles.sectionLeadEyebrow}>Cinematic DNA</Text>
      <Text style={styles.sectionLeadTitle}>{topGenres[0]?.genre || 'DNA sinyali'}</Text>

      <View style={styles.profileGrid}>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{streakValue}</Text>
          <Text style={styles.profileMetricLabel}>Streak</Text>
        </View>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{genreSignals.length}</Text>
          <Text style={styles.profileMetricLabel}>Tur</Text>
        </View>
        <View style={styles.profileMetricCard}>
          <Text style={styles.profileMetricValue}>{activityState.items.length}</Text>
          <Text style={styles.profileMetricLabel}>Yorum</Text>
        </View>
      </View>

      <View style={styles.profileDnaList}>
        {topGenres.map((genreEntry) => {
          const percentage = totalGenres > 0 ? Math.round((genreEntry.count / totalGenres) * 100) : 0;
          const fillWidth = `${Math.max(12, percentage)}%` as `${number}%`;

          return (
            <View key={`profile-dna-row-${genreEntry.genre}`} style={styles.profileDnaListItem}>
              <View style={styles.profileGenreRow}>
                <View style={styles.profileDnaGenreCopy}>
                  <Text style={styles.profileGenreLabel} numberOfLines={1}>
                    {genreEntry.genre}
                  </Text>
                  <Text style={styles.profileDnaGenreHint}>
                    {genreEntry.count} yorum izi
                  </Text>
                </View>
                <Text style={styles.profileDnaGenreValue}>{percentage}%</Text>
              </View>
              <View style={styles.profileDnaGenreTrack}>
                <View style={[styles.profileDnaGenreFill, { width: fillWidth }]} />
              </View>
            </View>
          );
        })}
      </View>
    </ScreenCard>
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
  const activeMark = activeMarkId ? resolveMobileMarkMeta(activeMarkId, language) : null;
  const visibleGroups = mode === 'unlocked' ? groupedUnlockedMarks : groupedCatalogMarks;
  const copy =
    language === 'tr'
      ? {
          eyebrow: 'Marklar',
          titleUnlocked: 'Acik Marklar',
          titleAll: 'Mark Arsivi',
          bodyUnlocked: 'Kazandigin marklar burada toplaniyor.',
          bodyAll: 'Tum marklar tek yerde gorunur.',
          unlocked: 'acik',
          featured: 'vitrin',
          groups: 'grup',
          total: 'toplam',
          showcase: 'Vitrin',
          signInTitle: 'Marklar icin giris yap',
          signInBody: 'Koleksiyonun oturumla birlikte gorunur.',
          loadingTitle: 'Marklar yukleniyor',
          loadingBody: 'Biraz bekle.',
          emptyTitle: 'Henuz acik mark yok',
          emptyBody: 'Yeni yorumlarla koleksiyon dolacak.',
          unavailableTitle: 'Mark verisi hazir degil',
          unavailableBody: 'Marklar hazir oldugunda burada gorunur.',
          detailSuffix: 'mark detayini ac',
        }
      : {
          eyebrow: 'Marks',
          titleUnlocked: 'Unlocked Marks',
          titleAll: 'Marks Archive',
          bodyUnlocked: 'The marks you earned gather here.',
          bodyAll: 'Every mark appears in one place.',
          unlocked: 'unlocked',
          featured: 'featured',
          groups: 'groups',
          total: 'total',
          showcase: 'Showcase',
          signInTitle: 'Sign in to view marks',
          signInBody: 'Your collection becomes visible after sign-in.',
          loadingTitle: 'Loading marks',
          loadingBody: 'Please wait a moment.',
          emptyTitle: 'No unlocked marks yet',
          emptyBody: 'New comments will fill the collection.',
          unavailableTitle: 'Mark data is unavailable',
          unavailableBody: 'Marks will appear here when ready.',
          detailSuffix: 'open mark details',
        };

  if (!isSignedIn) {
    return (
      <StatePanel
        tone="clay"
        variant="empty"
        eyebrow={copy.eyebrow}
        title={copy.signInTitle}
        body={copy.signInBody}
      />
    );
  }

  if (state.status !== 'success') {
    return (
      <StatePanel
        tone="sage"
        variant={state.status === 'loading' ? 'loading' : 'empty'}
        eyebrow={copy.eyebrow}
        title={state.status === 'loading' ? copy.loadingTitle : copy.unavailableTitle}
        body={state.status === 'loading' ? copy.loadingBody : copy.unavailableBody}
      />
    );
  }

  if (mode === 'unlocked' && unlockedMarks.length === 0) {
    return (
      <>
        <StatePanel
          tone="sage"
          variant="empty"
          eyebrow={copy.eyebrow}
          title={copy.emptyTitle}
          body={copy.emptyBody}
        />
        <MobileMarkDetailModal
          mark={activeMark}
          language={language}
          isUnlocked={Boolean(activeMarkId && unlockedSet.has(activeMarkId))}
          isFeatured={Boolean(activeMarkId && featuredMarks.includes(activeMarkId))}
          onClose={() => setActiveMarkId(null)}
        />
      </>
    );
  }

  return (
    <>
      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.sectionLeadTitle}>
          {mode === 'unlocked' ? copy.titleUnlocked : copy.titleAll}
        </Text>
        <Text style={styles.sectionLeadBody}>
          {mode === 'unlocked' ? copy.bodyUnlocked : copy.bodyAll}
        </Text>

        <View style={[styles.sectionLeadBadgeRow, { marginTop: 14 }]}>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
            <Text style={styles.sectionLeadBadgeText}>{`${unlockedMarks.length} ${copy.unlocked}`}</Text>
          </View>
          <View
            style={[
              styles.sectionLeadBadge,
              featuredMarks.length > 0 ? styles.sectionLeadBadgeClay : styles.sectionLeadBadgeMuted,
            ]}
          >
            <Text style={styles.sectionLeadBadgeText}>{`${featuredMarks.length} ${copy.featured}`}</Text>
          </View>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>{`${visibleGroups.length} ${copy.groups}`}</Text>
          </View>
          {mode === 'all' ? (
            <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
              <Text style={styles.sectionLeadBadgeText}>{`${MOBILE_MARK_CATALOG.length} ${copy.total}`}</Text>
            </View>
          ) : null}
        </View>

        {featuredMarks.length > 0 ? (
          <>
            <Text style={[styles.subSectionLabel, { marginTop: 16 }]}>{copy.showcase}</Text>
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
                    accessibilityLabel={`${markMeta.title} ${copy.detailSuffix}`}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        <View style={[styles.profileUnifiedDivider, { marginTop: 16 }]} />

        <View style={[styles.markCategoryList, { marginTop: 14 }]}>
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
                      accessibilityLabel={`${mark.title} ${copy.detailSuffix}`}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScreenCard>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LegacyProfileMarksCard = ({
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
          bodyAll: 'Tum marklar burada.',
          unlockedBadgeSuffix: 'acik',
          featuredBadgeSuffix: 'vitrin',
          totalBadgeSuffix: 'toplam',
          metricUnlocked: 'Acik',
          metricFeatured: 'Vitrin',
          metricGroups: 'Grup',
          signInTitle: 'Marklar icin giris yap',
          signInBody: 'Koleksiyon icin giris yap.',
          loadingTitle: 'Marklar yukleniyor',
          loadingBody: 'Biraz bekle.',
          unavailableTitle: 'Mark verisi hazir degil',
          unavailableBody: 'Mark verisi hazir oldugunda burada gorunur.',
          showcaseEyebrow: 'Vitrin',
          featuredCount: (count: number) => `${count} vitrin`,
          showcaseFallback: 'Secili marklar hazir.',
          emptyUnlockedTitle: 'Henuz acik mark yok',
          emptyUnlockedBody: 'Yeni yorumlarla koleksiyon dolacak.',
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
        body={mode === 'all' ? copy.bodyAll : undefined}
        badges={
          mode === 'all'
            ? [
                { label: `${unlockedMarks.length} ${copy.unlockedBadgeSuffix}`, tone: 'sage' },
                { label: `${featuredMarks.length} ${copy.featuredBadgeSuffix}`, tone: featuredMarks.length > 0 ? 'muted' : 'clay' },
                { label: `${MOBILE_MARK_CATALOG.length} ${copy.totalBadgeSuffix}`, tone: 'muted' as const },
              ]
            : undefined
        }
        metrics={
          mode === 'all'
            ? [
                { label: copy.metricUnlocked, value: String(unlockedMarks.length) },
                { label: copy.metricFeatured, value: String(featuredMarks.length) },
                { label: copy.metricGroups, value: String(visibleGroups.length) },
              ]
            : undefined
        }
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
      <View style={[styles.inboxRow, !item.opened ? styles.inboxRowUnread : null]}>
        <Pressable
          style={({ pressed }) => [
            styles.inboxPressTarget,
            pressed ? styles.inboxPressTargetPressed : null,
          ]}
          onPress={() => (isActionable ? onOpenDeepLink(item) : onPressRow(item))}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            isActionable
              ? `${item.title} bildirim detayini ac`
              : `${item.title} bildirimini kapat`
          }
        >
          <View style={styles.inboxRowHeader}>
            {!item.opened ? <View style={styles.inboxUnreadDot} /> : null}
            <Text style={[styles.inboxTitle, item.opened ? styles.inboxTitleRead : null]}>
              {item.title || 'Bildirim'}{' '}
              <Text style={styles.inboxMeta}>({stateLabel})</Text>
            </Text>
          </View>
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
        </Pressable>
      </View>
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
      {state.message ? <Text style={[styles.screenMeta, { marginTop: 6 }]}>{state.message}</Text> : null}

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
    bodyAll: 'Bu modda bugun ve onceki gunlerden yorumlar birlikte listelenir.',
    bodyToday: 'Bu modda yalnizca bugun yazilan yorumlar listelenir.',
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
    bodyAll: 'This view shows comments from today together with earlier days.',
    bodyToday: 'This view only lists comments written today.',
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
    bodyAll: 'Esta vista muestra juntos los comentarios de hoy y de dias anteriores.',
    bodyToday: 'Esta vista solo muestra los comentarios escritos hoy.',
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
    bodyAll: "Cette vue affiche ensemble les commentaires d aujourd hui et des jours precedents.",
    bodyToday: "Cette vue affiche seulement les commentaires ecrits aujourd hui.",
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
  embedded = false,
  onScopeChange,
  onSortChange,
  onQueryChange,
  onLoadMore,
  onEcho,
  onLoadReplies,
  onSubmitReply,
  onEchoReply,
  onDeleteItem,
  onOpenAuthorProfile,
  selectedMovieTitle,
  movieFilterMode = 'all',
}: {
  state: CommentFeedState;
  language?: MobileSettingsLanguage;
  currentUserAvatarUrl?: string;
  showFilters?: boolean;
  embedded?: boolean;
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
  onEchoReply?: (
    reply: MobileCommentReply
  ) => Promise<{ ok: boolean; message: string }>;
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
  const [replyEchoSubmitting, setReplyEchoSubmitting] = useState<Record<string, boolean>>({});
  const [deleteSubmitting, setDeleteSubmitting] = useState<Record<string, boolean>>({});
  const [repliesByItemId, setRepliesByItemId] = useState<Record<string, MobileCommentReply[]>>({});
  const normalizedSelectedMovieTitle = String(selectedMovieTitle || '').trim();
  const normalizedCurrentUserAvatarUrl = String(currentUserAvatarUrl || '').trim();
  const isMovieFiltering = movieFilterMode === 'selected_movie';
  const isAllScope = !isMovieFiltering && state.scope === 'all';
  const waitingMovieSelection = isMovieFiltering && !normalizedSelectedMovieTitle;
  const isEmbedded = embedded && isMovieFiltering;
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
    setReplyEchoSubmitting((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => visibleIds.has(key))));
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

  const handleReplyEchoPress = useCallback(
    async (item: CommentFeedState['items'][number], reply: MobileCommentReply) => {
      if (!onEchoReply || replyEchoSubmitting[reply.id] || reply.isEchoedByMe) return;

      setReplyEchoSubmitting((prev) => ({ ...prev, [reply.id]: true }));
      const result = await onEchoReply(reply);
      if (result.ok) {
        setRepliesByItemId((prev) => ({
          ...prev,
          [item.id]: (prev[item.id] || []).map((r) =>
            r.id === reply.id
              ? { ...r, echoCount: r.echoCount + 1, isEchoedByMe: true }
              : r
          ),
        }));
      }
      setReplyEchoSubmitting((prev) => ({ ...prev, [reply.id]: false }));
    },
    [onEchoReply, replyEchoSubmitting, setRepliesByItemId]
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

  const content = (
    <>
        {!isMovieFiltering ? (
          <>
            <Text style={styles.screenTitle}>
              {isAllScope || showFilters ? commentFeedCopy.titleAll : commentFeedCopy.titleToday}
            </Text>
            <Text style={styles.screenBody}>
              {isAllScope || showFilters ? commentFeedCopy.bodyAll : commentFeedCopy.bodyToday}
            </Text>
          </>
        ) : null}
        {isMovieFiltering ? (
          <View style={styles.commentFeedSelectedMoviePill}>
            <Ionicons name="film-outline" size={14} color="#E5E4E2" />
            <Text style={styles.commentFeedSelectedMovieText}>
              {normalizedSelectedMovieTitle || commentFeedCopy.selectedMoviePending}
            </Text>
          </View>
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
        isEmbedded ? (
          <View style={styles.commentFeedEmbeddedEmpty}>
            <Text style={styles.commentFeedEmbeddedEyebrow}>{commentFeedCopy.feedEyebrow}</Text>
            <Text style={styles.commentFeedEmbeddedEmptyTitle}>
              {state.status === 'error' ? commentFeedCopy.errorTitle : commentFeedCopy.emptyTitle}
            </Text>
            {state.status === 'error' ? (
              <Text style={styles.commentFeedEmbeddedEmptyBody}>{commentFeedCopy.errorBody}</Text>
            ) : null}
          </View>
        ) : (
          <StatePanel
            tone="clay"
            variant={state.status === 'error' ? 'error' : 'empty'}
            eyebrow={commentFeedCopy.feedEyebrow}
            title={state.status === 'error' ? commentFeedCopy.errorTitle : commentFeedCopy.emptyTitle}
            body={
              state.status === 'error'
                ? commentFeedCopy.errorBody
                : isMovieFiltering
                  ? ''
                  : commentFeedCopy.emptyBody
            }
          />
        )
      ) : (
        <View style={[styles.commentFeedList, isEmbedded ? styles.commentFeedListEmbedded : null]}>
          {visibleItems.map((item) => {
            const resolvedAvatarUrl =
              String(item.authorAvatarUrl || '').trim() ||
              (item.isMine ? normalizedCurrentUserAvatarUrl : '');
            const posterUri = resolvePosterUrl(item.posterPath);
            const posterFallbackLabel = (String(item.movieTitle || '').trim().slice(0, 1) || '?').toUpperCase();
            return (
              <View key={item.id} style={[styles.commentFeedRow, isEmbedded ? styles.commentFeedRowEmbedded : null]}>
                <View style={styles.commentFeedRowHeader}>
                  <View style={styles.commentFeedMovieHeaderMain}>
                    {posterUri ? (
                      <Image source={{ uri: posterUri }} style={styles.commentFeedMoviePoster} resizeMode="cover" />
                    ) : (
                      <View style={styles.commentFeedMoviePosterFallback}>
                        <Text style={styles.commentFeedMoviePosterFallbackText}>{posterFallbackLabel}</Text>
                      </View>
                    )}
                    <Text style={styles.commentFeedMovieTitle} numberOfLines={2}>
                      {item.movieTitle}
                    </Text>
                  </View>
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
                            {onEchoReply ? (
                              <View style={styles.commentFeedReplyEchoRow}>
                                <Pressable
                                  style={[
                                    styles.commentFeedReplyEchoButton,
                                    reply.isEchoedByMe ? styles.commentFeedReplyEchoButtonActive : null,
                                  ]}
                                  onPress={() => { void handleReplyEchoPress(item, reply); }}
                                  disabled={reply.isEchoedByMe || replyEchoSubmitting[reply.id]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Echo ${reply.author} yaniti`}
                                >
                                  <Text
                                    style={[
                                      styles.commentFeedReplyEchoText,
                                      reply.isEchoedByMe ? styles.commentFeedReplyEchoTextActive : null,
                                    ]}
                                  >
                                    {reply.isEchoedByMe ? '✦' : '✧'}{reply.echoCount > 0 ? ` ${reply.echoCount}` : ''}
                                  </Text>
                                </Pressable>
                              </View>
                            ) : null}
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
    </>
  );

  return (
    <KeyboardAvoidingView
      enabled={Platform.OS !== 'web'}
      behavior={KEYBOARD_AVOIDING_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_AVOIDING_OFFSET}
    >
      {isEmbedded ? (
        <View style={styles.commentFeedEmbeddedShell}>
          <View style={[styles.screenCardAccent, styles.screenCardAccentClay]} />
          {content}
        </View>
      ) : (
        <ScreenCard accent="clay">{content}</ScreenCard>
      )}
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

type DailyGreetingTone = 'sage' | 'clay' | 'gold';
type DailyGreetingScenario =
  | 'night_open'
  | 'morning_open_streak'
  | 'morning_open_fresh'
  | 'morning_done'
  | 'midday_open'
  | 'midday_done'
  | 'afternoon_open'
  | 'afternoon_done'
  | 'evening_streak_open'
  | 'evening_open'
  | 'evening_done'
  | 'late_open';

type DailyGreetingCardData = {
  eyebrow: string;
  title: string;
  body: string;
  tone: DailyGreetingTone;
  icon: ComponentProps<typeof Ionicons>['name'];
  pill: string;
};

const hashDailyGreetingSeed = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickSeededGreeting = <T,>(items: readonly T[], seed: string): T => {
  if (items.length === 0) {
    throw new Error('Greeting pool cannot be empty.');
  }
  return items[hashDailyGreetingSeed(seed) % items.length];
};

const withFirstName = (firstName: string | null, message: string): string =>
  firstName ? `${firstName}, ${message}` : message;

const resolveDailyGreetingScenario = (
  hour: number,
  completed: boolean,
  streakValue: number
): DailyGreetingScenario => {
  if (hour < 6) return 'night_open';
  if (hour < 10) return completed ? 'morning_done' : streakValue > 0 ? 'morning_open_streak' : 'morning_open_fresh';
  if (hour < 14) return completed ? 'midday_done' : 'midday_open';
  if (hour < 18) return completed ? 'afternoon_done' : 'afternoon_open';
  if (hour < 22) return completed ? 'evening_done' : streakValue > 0 ? 'evening_streak_open' : 'evening_open';
  return completed ? 'evening_done' : 'late_open';
};

const resolveDailyGreetingEyebrow = (
  language: MobileSettingsLanguage,
  scenario: DailyGreetingScenario
): string => {
  const phase =
    scenario === 'night_open' || scenario === 'late_open'
      ? 'night'
      : scenario.startsWith('morning_')
        ? 'morning'
        : scenario.startsWith('midday_')
          ? 'midday'
          : scenario.startsWith('afternoon_')
            ? 'afternoon'
            : 'evening';

  if (language === 'tr') {
    if (phase === 'night') return 'GECE PENCERESI';
    if (phase === 'morning') return 'SABAH KADRAJI';
    if (phase === 'midday') return 'OGLE SINYALI';
    if (phase === 'afternoon') return 'IKINDI PULSU';
    return 'AKSAM PULSU';
  }
  if (language === 'es') {
    if (phase === 'night') return 'VENTANA NOCTURNA';
    if (phase === 'morning') return 'MARCO MATINAL';
    if (phase === 'midday') return 'SENAL DEL MEDIODIA';
    if (phase === 'afternoon') return 'PULSO DE LA TARDE';
    return 'PULSO DE LA NOCHE';
  }
  if (language === 'fr') {
    if (phase === 'night') return 'FENETRE DE NUIT';
    if (phase === 'morning') return 'CADRE DU MATIN';
    if (phase === 'midday') return 'SIGNAL DE MIDI';
    if (phase === 'afternoon') return 'POULS DE L APRES MIDI';
    return 'POULS DU SOIR';
  }
  if (phase === 'night') return 'NIGHT WINDOW';
  if (phase === 'morning') return 'MORNING FRAME';
  if (phase === 'midday') return 'MIDDAY SIGNAL';
  if (phase === 'afternoon') return 'AFTERNOON PULSE';
  return 'EVENING PULSE';
};

const resolveDailyGreetingPill = (
  language: MobileSettingsLanguage,
  completed: boolean,
  streakValue: number
): string => {
  if (completed) {
    if (language === 'tr') return 'BUGUN TAMAM';
    if (language === 'es') return 'HOY LISTO';
    if (language === 'fr') return 'AUJOURD HUI FAIT';
    return 'TODAY DONE';
  }
  if (streakValue > 0) {
    if (language === 'tr') return `${streakValue} GUN SERI`;
    if (language === 'es') return `${streakValue} DIAS`;
    if (language === 'fr') return `${streakValue} JOURS`;
    return `${streakValue} DAY STREAK`;
  }
  if (language === 'tr') return 'ACIK PENCERE';
  if (language === 'es') return 'ABIERTO';
  if (language === 'fr') return 'OUVERT';
  return 'OPEN NOW';
};

const resolveDailyGreetingSupportBody = ({
  language,
  completed,
  streakValue,
  selectedMovieTitle: _selectedMovieTitle,
  firstMovieTitle: _firstMovieTitle,
}: {
  language: MobileSettingsLanguage;
  completed: boolean;
  streakValue: number;
  selectedMovieTitle: string | null;
  firstMovieTitle: string | null;
}): string => {
  if (language === 'tr') {
    if (completed) {
      return 'Bugunun puani yazildi. Yarin yeni tur acilir.';
    }
    if (streakValue > 0) {
      return `${streakValue} gunluk seriyi korumak icin tek hamle yetiyor.`;
    }
    return 'Secimini yap, notunu birak, bugunun akisini ac.';
  }

  if (language === 'es') {
    if (completed) {
      return 'La puntuacion de hoy ya entro. Manana abre una nueva ronda.';
    }
    if (streakValue > 0) {
      return `Una sola jugada protege tu racha de ${streakValue} dias.`;
    }
    return 'Elige, comenta y abre tu ritmo de hoy.';
  }

  if (language === 'fr') {
    if (completed) {
      return 'Le score du jour est deja enregistre. Une nouvelle manche arrive demain.';
    }
    if (streakValue > 0) {
      return `Un seul geste suffit pour proteger ta serie de ${streakValue} jours.`;
    }
    return 'Choisis, note, et lance ton rythme du jour.';
  }

  if (completed) {
    return "Today's score is locked. A new round opens tomorrow.";
  }
  if (streakValue > 0) {
    return `One move protects the ${streakValue}-day streak.`;
  }
  return 'Pick, post, and open today on your terms.';
};

const resolveDailyGreetingVisual = (
  language: MobileSettingsLanguage,
  scenario: DailyGreetingScenario,
  firstName: string | null,
  streakValue: number
): {
  tone: DailyGreetingTone;
  icon: ComponentProps<typeof Ionicons>['name'];
  messages: string[];
} => {
  if (language === 'tr') {
    switch (scenario) {
      case 'night_open':
        return {
          tone: 'gold',
          icon: 'moon-outline',
          messages: [
            'Gece sessiz. Tur yarin.',
            'Bugun kapandi. Yarin yeniden.',
            'Perde kapali. Puan yarin.',
          ],
        };
      case 'morning_open_streak':
        return {
          tone: 'sage',
          icon: 'flame-outline',
          messages: [
            withFirstName(firstName, `seri acik. Bugun kaybetme.`),
            `${streakValue} gunluk seri savunmada.`,
            'Sabah hamlesi seriyi korur.',
          ],
        };
      case 'morning_open_fresh':
        return {
          tone: 'gold',
          icon: 'sunny-outline',
          messages: [
            withFirstName(firstName, 'yeni tur acildi'),
            'Gun basladi. Sahne sende.',
            'Bugunluk tur masada.',
          ],
        };
      case 'morning_done':
        return {
          tone: 'sage',
          icon: 'checkmark-done-outline',
          messages: [
            withFirstName(firstName, 'bugun cebinde'),
            'Erken hamle. Temiz skor.',
            'Sabah puani yazildi.',
          ],
        };
      case 'midday_open':
        return {
          tone: 'clay',
          icon: 'time-outline',
          messages: [
            withFirstName(firstName, 'gun hala acik'),
            'Orta turdasin. Gir.',
            'Skor tahtasi seni bekliyor.',
          ],
        };
      case 'midday_done':
        return {
          tone: 'sage',
          icon: 'sparkles-outline',
          messages: [
            'Skor yazildi.',
            'Bugun kilitlendi.',
            'Hamle yerine oturdu.',
          ],
        };
      case 'afternoon_open':
        return {
          tone: 'clay',
          icon: 'flash-outline',
          messages: [
            'Baski var. Oyun bitmedi.',
            'Hala yetisirsin.',
            'Bir hamlelik acik var.',
          ],
        };
      case 'afternoon_done':
        return {
          tone: 'sage',
          icon: 'trophy-outline',
          messages: [
            'Bugun akista.',
            'Skor sabitlendi.',
            'Hamle temiz kapandi.',
          ],
        };
      case 'evening_streak_open':
        return {
          tone: 'gold',
          icon: 'flame-outline',
          messages: [
            withFirstName(firstName, 'seri bu gece sinanir'),
            `${streakValue} gunluk seri riskte.`,
            'Bu gece hamle zamani.',
          ],
        };
      case 'evening_open':
        return {
          tone: 'gold',
          icon: 'moon-outline',
          messages: [
            withFirstName(firstName, 'son tur acik'),
            'Bugun hala senin olabilir.',
            'Gece gelmeden gir.',
          ],
        };
      case 'evening_done':
        return {
          tone: 'sage',
          icon: 'checkmark-circle-outline',
          messages: [
            withFirstName(firstName, 'bugun kasada'),
            'Skor kapandi. Yarin yeni tur.',
            'Bugun tamam. Ritim sende.',
          ],
        };
      case 'late_open':
      default:
        return {
          tone: 'gold',
          icon: 'hourglass-outline',
          messages: [
            'Final pencere acik.',
            'Reset oncesi son hamle.',
            withFirstName(firstName, 'simdi gir ya da yarini bekle'),
          ],
        };
    }
  }

  if (language === 'en') {
    switch (scenario) {
      case 'night_open':
        return {
          tone: 'gold',
          icon: 'moon-outline',
          messages: [
            'Night is quiet. Next round tomorrow.',
            'Today is closed. Tomorrow reopens.',
            'Screen down. Score tomorrow.',
          ],
        };
      case 'morning_open_streak':
        return {
          tone: 'sage',
          icon: 'flame-outline',
          messages: [
            withFirstName(firstName, 'the streak is live. Do not drop it.'),
            `${streakValue}-day streak on defense.`,
            'Morning move saves the streak.',
          ],
        };
      case 'morning_open_fresh':
        return {
          tone: 'gold',
          icon: 'sunny-outline',
          messages: [
            withFirstName(firstName, 'a new round is open'),
            'Fresh day. Your move.',
            'Today is on the board.',
          ],
        };
      case 'morning_done':
        return {
          tone: 'sage',
          icon: 'checkmark-done-outline',
          messages: [
            withFirstName(firstName, 'today is already banked'),
            'Early move. Clean score.',
            "Today's points are in.",
          ],
        };
      case 'midday_open':
        return {
          tone: 'clay',
          icon: 'time-outline',
          messages: [
            withFirstName(firstName, 'the day is still open'),
            'Mid-round. Step in.',
            'The board is waiting.',
          ],
        };
      case 'midday_done':
        return {
          tone: 'sage',
          icon: 'sparkles-outline',
          messages: [
            'Score locked.',
            'Today is secured.',
            'The move landed.',
          ],
        };
      case 'afternoon_open':
        return {
          tone: 'clay',
          icon: 'flash-outline',
          messages: [
            'Pressure is up. Game is not over.',
            'You can still land it.',
            'One move still fits.',
          ],
        };
      case 'afternoon_done':
        return {
          tone: 'sage',
          icon: 'trophy-outline',
          messages: [
            'Today is in the feed.',
            'Score is stable.',
            'The move closed clean.',
          ],
        };
      case 'evening_streak_open':
        return {
          tone: 'gold',
          icon: 'flame-outline',
          messages: [
            withFirstName(firstName, 'the streak gets tested tonight'),
            `${streakValue}-day streak at risk.`,
            'Tonight is the save point.',
          ],
        };
      case 'evening_open':
        return {
          tone: 'gold',
          icon: 'moon-outline',
          messages: [
            withFirstName(firstName, 'final round is open'),
            'The day can still flip.',
            'Get in before midnight.',
          ],
        };
      case 'evening_done':
        return {
          tone: 'sage',
          icon: 'checkmark-circle-outline',
          messages: [
            withFirstName(firstName, 'today is banked'),
            'Score closed. New round tomorrow.',
            'You closed on time.',
          ],
        };
      case 'late_open':
      default:
        return {
          tone: 'gold',
          icon: 'hourglass-outline',
          messages: [
            'Final window is open.',
            'One last move before reset.',
            withFirstName(firstName, 'jump in now or wait for tomorrow'),
          ],
        };
    }
  }

  if (language === 'es') {
    switch (scenario) {
      case 'night_open':
        return { tone: 'gold', icon: 'moon-outline', messages: ['La noche esta en calma, manana abrira una nueva seleccion.'] };
      case 'morning_open_streak':
        return { tone: 'sage', icon: 'flame-outline', messages: [withFirstName(firstName, `tu racha de ${streakValue} dias tiene una buena apertura esta manana`)] };
      case 'morning_open_fresh':
        return { tone: 'gold', icon: 'sunny-outline', messages: [withFirstName(firstName, 'la primera escena del dia ya esta lista')] };
      case 'morning_done':
        return { tone: 'sage', icon: 'checkmark-done-outline', messages: [withFirstName(firstName, 'cerraste el ritual de hoy muy temprano')] };
      case 'midday_open':
        return { tone: 'clay', icon: 'time-outline', messages: [withFirstName(firstName, 'el mediodia llego y la seleccion de hoy sigue abierta')] };
      case 'midday_done':
        return { tone: 'sage', icon: 'sparkles-outline', messages: ['Aseguraste el ritual de hoy antes del momento mas ocupado.'] };
      case 'afternoon_open':
        return { tone: 'clay', icon: 'flash-outline', messages: ['La tarde avanza, pero todavia puedes entrar al ritual de hoy.'] };
      case 'afternoon_done':
        return { tone: 'sage', icon: 'trophy-outline', messages: ['El ritual de hoy ya esta colocado en el flujo.'] };
      case 'evening_streak_open':
        return { tone: 'gold', icon: 'flame-outline', messages: [withFirstName(firstName, `esta franja protege tu racha de ${streakValue} dias`)] };
      case 'evening_open':
        return { tone: 'gold', icon: 'moon-outline', messages: ['La noche sigue abierta si quieres girar el dia a tu favor.'] };
      case 'evening_done':
        return { tone: 'sage', icon: 'checkmark-circle-outline', messages: [withFirstName(firstName, 'el ritual de hoy esta completo')] };
      case 'late_open':
      default:
        return { tone: 'gold', icon: 'hourglass-outline', messages: ['Ultima ventana de la noche, deja tu nota antes del reinicio.'] };
    }
  }

  switch (scenario) {
    case 'night_open':
      return { tone: 'gold', icon: 'moon-outline', messages: ['La nuit est calme, une nouvelle selection s ouvrira demain matin.'] };
    case 'morning_open_streak':
      return { tone: 'sage', icon: 'flame-outline', messages: [withFirstName(firstName, `ta serie de ${streakValue} jours a une belle ouverture ce matin`)] };
    case 'morning_open_fresh':
      return { tone: 'gold', icon: 'sunny-outline', messages: [withFirstName(firstName, 'la premiere scene du jour est deja prete')] };
    case 'morning_done':
      return { tone: 'sage', icon: 'checkmark-done-outline', messages: [withFirstName(firstName, 'tu as boucle le rituel du jour tres tot')] };
    case 'midday_open':
      return { tone: 'clay', icon: 'time-outline', messages: [withFirstName(firstName, 'midi est la et la selection du jour est encore ouverte')] };
    case 'midday_done':
      return { tone: 'sage', icon: 'sparkles-outline', messages: ['Tu as verrouille le rituel du jour avant le rush.'] };
    case 'afternoon_open':
      return { tone: 'clay', icon: 'flash-outline', messages: ['L apres midi avance, mais il reste du temps pour le rituel du jour.'] };
    case 'afternoon_done':
      return { tone: 'sage', icon: 'trophy-outline', messages: ['Le rituel du jour est deja pose dans le flux.'] };
    case 'evening_streak_open':
      return { tone: 'gold', icon: 'flame-outline', messages: [withFirstName(firstName, `cette plage protege ta serie de ${streakValue} jours`)] };
    case 'evening_open':
      return { tone: 'gold', icon: 'moon-outline', messages: ['La soiree reste ouverte si tu veux encore changer le rythme du jour.'] };
    case 'evening_done':
      return { tone: 'sage', icon: 'checkmark-circle-outline', messages: [withFirstName(firstName, 'le rituel du jour est complet')] };
    case 'late_open':
    default:
      return { tone: 'gold', icon: 'hourglass-outline', messages: ['Derniere fenetre ce soir, laisse ta note avant la remise a zero.'] };
  }
};

const clearDailyQuizAudioSuspendTimer = () => {
  if (dailyQuizAudioSuspendTimer === null) return;
  clearTimeout(dailyQuizAudioSuspendTimer);
  dailyQuizAudioSuspendTimer = null;
};

const suspendDailyQuizAudioCtx = async (): Promise<void> => {
  clearDailyQuizAudioSuspendTimer();
  const ctx = dailyQuizAudioCtx;
  if (!ctx || ctx.state !== 'running') return;
  await ctx.suspend().catch(() => undefined);
};

const closeDailyQuizAudioCtx = async (): Promise<void> => {
  clearDailyQuizAudioSuspendTimer();
  const ctx = dailyQuizAudioCtx;
  dailyQuizAudioCtx = null;
  if (!ctx || ctx.state === 'closed') return;
  await ctx.close().catch(() => undefined);
};

const scheduleDailyQuizAudioSuspend = () => {
  if (Platform.OS !== 'web') return;
  clearDailyQuizAudioSuspendTimer();
  dailyQuizAudioSuspendTimer = setTimeout(() => {
    void suspendDailyQuizAudioCtx();
  }, DAILY_QUIZ_AUDIO_IDLE_MS);
};

const getDailyQuizAudioCtx = (): AudioContext | null => {
  if (Platform.OS !== 'web') return null;
  if (dailyQuizAudioCtx?.state === 'closed') dailyQuizAudioCtx = null;
  if (!dailyQuizAudioCtx) {
    try {
      dailyQuizAudioCtx = new (
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      )();
    } catch {
      return null;
    }
  }
  if (dailyQuizAudioCtx.state === 'suspended') {
    void dailyQuizAudioCtx.resume().catch(() => undefined);
  }
  clearDailyQuizAudioSuspendTimer();
  return dailyQuizAudioCtx;
};

const playDailyQuizTone = (
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.24
) => {
  const ctx = getDailyQuizAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
  scheduleDailyQuizAudioSuspend();
};

const playDailyQuizNativeSound = async (source: number) => {
  try {
    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // ignore audio failures on preview surfaces
  }
};

const playDailyQuizCorrectSound = () => {
  if (Platform.OS === 'web') {
    playDailyQuizTone(523, 0.12, 'sine', 0.2);
    setTimeout(() => playDailyQuizTone(784, 0.18, 'sine', 0.24), 100);
    return;
  }
  void playDailyQuizNativeSound(DAILY_QUIZ_SOUND_CORRECT);
};

const playDailyQuizWrongSound = () => {
  if (Platform.OS === 'web') {
    playDailyQuizTone(200, 0.24, 'square', 0.15);
    setTimeout(() => playDailyQuizTone(150, 0.18, 'square', 0.12), 120);
    return;
  }
  void playDailyQuizNativeSound(DAILY_QUIZ_SOUND_WRONG);
};

type DailyQuizConfettiParticle = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  isCircle: boolean;
};

const DailyQuizConfettiBlast = ({ trigger }: { trigger: number }) => {
  const particles = useRef<DailyQuizConfettiParticle[]>([]);
  const prevTrigger = useRef(0);

  useEffect(() => {
    if (particles.current.length > 0) return;
    particles.current = Array.from({ length: DAILY_QUIZ_CONFETTI_COUNT }, (_, index) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(0),
      color: DAILY_QUIZ_CONFETTI_COLORS[index % DAILY_QUIZ_CONFETTI_COLORS.length],
      size: 6 + Math.random() * 7,
      isCircle: Math.random() > 0.45,
    }));
  }, []);

  useEffect(() => {
    if (trigger === 0 || trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;

    const animations = particles.current.map((particle) => {
      const startX = (Math.random() - 0.5) * 50;
      const endX = startX + (Math.random() - 0.5) * 220;
      const endY = -(140 + Math.random() * 180);
      const rotations = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4);

      particle.x.setValue(startX);
      particle.y.setValue(0);
      particle.rotate.setValue(0);
      particle.opacity.setValue(1);

      return Animated.parallel([
        Animated.timing(particle.x, {
          toValue: endX,
          duration: 650 + Math.random() * 260,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(particle.y, {
            toValue: endY * 0.55,
            duration: 360 + Math.random() * 140,
            useNativeDriver: true,
          }),
          Animated.timing(particle.y, {
            toValue: endY + 40,
            duration: 300 + Math.random() * 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(particle.rotate, {
          toValue: rotations,
          duration: 760 + Math.random() * 220,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(particle.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.delay(420 + Math.random() * 160),
          Animated.timing(particle.opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.stagger(16, animations).start();
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <View style={styles.dailyQuizConfettiLayer} pointerEvents="none">
      {particles.current.map((particle, index) => {
        const rotateDeg = particle.rotate.interpolate({
          inputRange: [-10, 10],
          outputRange: ['-3600deg', '3600deg'],
        });

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              bottom: '14%',
              left: '50%',
              width: particle.size,
              height: particle.isCircle ? particle.size : particle.size * 1.5,
              borderRadius: particle.isCircle ? particle.size / 2 : 2,
              backgroundColor: particle.color,
              opacity: particle.opacity,
              transform: [{ translateX: particle.x }, { translateY: particle.y }, { rotate: rotateDeg }],
            }}
          />
        );
      })}
    </View>
  );
};

const buildDailyGreetingCard = ({
  language,
  hour,
  completed,
  streakValue,
  firstName,
  selectedMovieTitle,
  firstMovieTitle,
  dateKey,
}: {
  language: MobileSettingsLanguage;
  hour: number;
  completed: boolean;
  streakValue: number;
  firstName: string | null;
  selectedMovieTitle: string | null;
  firstMovieTitle: string | null;
  dateKey: string | null;
}): DailyGreetingCardData => {
  const scenario = resolveDailyGreetingScenario(hour, completed, streakValue);
  const visual = resolveDailyGreetingVisual(language, scenario, firstName, streakValue);
  const title = pickSeededGreeting(
    visual.messages,
    [language, scenario, dateKey || 'today', firstName || 'guest', selectedMovieTitle || firstMovieTitle || 'film'].join('|')
  );

  return {
    eyebrow: resolveDailyGreetingEyebrow(language, scenario),
    title,
    body: resolveDailyGreetingSupportBody({
      language,
      completed,
      streakValue,
      selectedMovieTitle,
      firstMovieTitle,
    }),
    tone: visual.tone,
    icon: visual.icon,
    pill: resolveDailyGreetingPill(language, completed, streakValue),
  };
};

const DailyHomeScreen = ({
  state,
  showOpsMeta = false,
  showGreetingCard = true,
  selectedMovieId,
  onSelectMovie,
  language = 'tr',
  streak,
  username,
}: {
  state: DailyState;
  showOpsMeta?: boolean;
  showGreetingCard?: boolean;
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
  const sv = streak ?? 0;

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
  const _retentionMsg: string = (() => {
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
  const selectedMovieTitle =
    successState.movies.find((movie) => movie.id === selectedMovieId)?.title?.trim() || null;
  const firstMovieTitle = successState.movies[0]?.title?.trim() || null;
  const dailyGreeting = buildDailyGreetingCard({
    language,
    hour,
    completed,
    streakValue: sv,
    firstName,
    selectedMovieTitle,
    firstMovieTitle,
    dateKey: successState.date || null,
  });
  const greetingAccentColor =
    dailyGreeting.tone === 'sage' ? '#8A9A5B' : dailyGreeting.tone === 'clay' ? '#A57164' : '#B68B4C';
   
  const railGestureProps = railResponderHandlers || {};

  return (
    <View style={{ marginBottom: 12 }}>
      <ScreenCard accent="sage">
        {showGreetingCard ? (
          <View
            style={[
              styles.dailyGreetingCard,
              dailyGreeting.tone === 'sage'
                ? styles.dailyGreetingCardSage
                : dailyGreeting.tone === 'clay'
                  ? styles.dailyGreetingCardClay
                  : styles.dailyGreetingCardGold,
            ]}
          >
            <View style={styles.dailyGreetingSignalRow}>
              <View style={[styles.dailyGreetingSignalDot, { backgroundColor: greetingAccentColor }]} />
              <View style={[styles.dailyGreetingSignalBarShort, { backgroundColor: greetingAccentColor }]} />
              <View style={[styles.dailyGreetingSignalBarLong, styles.dailyGreetingSignalMuted]} />
            </View>
            <View
              style={[
                styles.dailyGreetingGlow,
                dailyGreeting.tone === 'sage'
                  ? styles.dailyGreetingGlowSage
                  : dailyGreeting.tone === 'clay'
                    ? styles.dailyGreetingGlowClay
                    : styles.dailyGreetingGlowGold,
              ]}
            />
            <View style={styles.dailyGreetingHeader}>
              <View style={styles.dailyGreetingEyebrowRow}>
                <View style={[styles.dailyGreetingEyebrowDot, { backgroundColor: greetingAccentColor }]} />
                <Text style={styles.dailyGreetingEyebrowText}>{dailyGreeting.eyebrow}</Text>
              </View>
              <View
                style={[
                  styles.dailyGreetingPill,
                  dailyGreeting.tone === 'sage'
                    ? styles.dailyGreetingPillSage
                    : dailyGreeting.tone === 'clay'
                      ? styles.dailyGreetingPillClay
                      : styles.dailyGreetingPillGold,
                ]}
              >
                <Text style={styles.dailyGreetingPillText}>{dailyGreeting.pill}</Text>
              </View>
            </View>
            <View style={styles.dailyGreetingBodyRow}>
              <View
                style={[
                  styles.dailyGreetingIconWrap,
                  dailyGreeting.tone === 'sage'
                    ? styles.dailyGreetingIconWrapSage
                    : dailyGreeting.tone === 'clay'
                      ? styles.dailyGreetingIconWrapClay
                      : styles.dailyGreetingIconWrapGold,
                ]}
              >
                <Ionicons name={dailyGreeting.icon} size={18} color={greetingAccentColor} />
              </View>
              <View style={styles.dailyGreetingCopy}>
                <Text style={styles.dailyGreetingTitle} numberOfLines={2}>
                  {dailyGreeting.title}
                </Text>
                <Text style={styles.dailyGreetingBody} numberOfLines={2}>
                  {dailyGreeting.body}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
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
  nextCta: string;
  finishCta: string;
  questionProgress: string;
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
    nextCta: 'Sonraki Soru',
    finishCta: 'Quiz Tamamlandi',
    questionProgress: 'Soru',
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
    nextCta: 'Next Question',
    finishCta: 'Quiz Complete',
    questionProgress: 'Question',
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
    nextCta: 'Siguiente Pregunta',
    finishCta: 'Quiz Completado',
    questionProgress: 'Pregunta',
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
    nextCta: 'Question Suivante',
    finishCta: 'Quiz Termine',
    questionProgress: 'Question',
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

const getDailyQuizInitialQuestionIndex = (
  questions: MobileDailyQuizBundle['questionsByMovie'][number]['questions']
): number => {
  if (!questions.length) return 0;
  const firstUnansweredIndex = questions.findIndex((question) => !question.attempt);
  if (firstUnansweredIndex >= 0) return firstUnansweredIndex;
  return Math.max(0, questions.length - 1);
};

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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [pendingOptionKey, setPendingOptionKey] = useState<MobileDailyQuizOptionKey | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [lastXpDelta, setLastXpDelta] = useState(0);
  const questionScopeRef = useRef<string>('');

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
  const questionScopeKey = `${movieId}:${dateKey || ''}:${language}`;
  const currentQuestion =
    questions[Math.max(0, Math.min(activeQuestionIndex, Math.max(0, questions.length - 1)))] || null;
  const currentAttempt = currentQuestion?.attempt || null;
  const currentQuestionNumber = currentQuestion ? activeQuestionIndex + 1 : 0;
  const hasNextQuestion = currentQuestionNumber > 0 && currentQuestionNumber < questions.length;
  const hasAnsweredCurrentQuestion = Boolean(currentAttempt);

  useEffect(() => {
    if (!questions.length) {
      setActiveQuestionIndex(0);
      return;
    }

    if (questionScopeRef.current !== questionScopeKey) {
      questionScopeRef.current = questionScopeKey;
      setActiveQuestionIndex(getDailyQuizInitialQuestionIndex(questions));
      return;
    }

    setActiveQuestionIndex((current) => Math.min(current, Math.max(0, questions.length - 1)));
  }, [questionScopeKey, questions]);

  useEffect(
    () => () => {
      void closeDailyQuizAudioCtx();
    },
    []
  );

  const handleAnswer = useCallback(
    async (questionId: string, selectedOption: MobileDailyQuizOptionKey) => {
      if (!bundle || submittingQuestionId || !isSignedIn) return;

      setPendingOptionKey(selectedOption);
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
        setPendingOptionKey(null);
        setSubmittingQuestionId(null);
        return;
      }

      if (result.isCorrect) {
        playDailyQuizCorrectSound();
        setConfettiKey((current) => current + 1);
      } else {
        playDailyQuizWrongSound();
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
      setPendingOptionKey(null);
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
            <View style={styles.dailyQuizSummaryMetric}>
              <Text style={styles.dailyQuizSummaryLabel}>{copy.progress}</Text>
              <Text style={styles.dailyQuizSummaryValue}>
                {answeredCount}/{questions.length}
              </Text>
            </View>
            <View style={styles.dailyQuizSummaryMetric}>
              <Text style={styles.dailyQuizSummaryLabel}>{copy.correct}</Text>
              <Text style={styles.dailyQuizSummaryValue}>
                {correctCount}/{requiredCorrectCount}
              </Text>
            </View>
            <View style={styles.dailyQuizSummaryMetric}>
              <Text style={styles.dailyQuizSummaryLabel}>{copy.xp}</Text>
              <Text style={styles.dailyQuizSummaryValue}>{bundle?.progress?.xpAwarded || 0}</Text>
            </View>
            {lastXpDelta > 0 ? (
              <View style={[styles.dailyQuizSummaryMetric, styles.dailyQuizSummaryMetricAccent]}>
                <Text style={styles.dailyQuizSummaryLabel}>XP</Text>
                <Text style={styles.dailyQuizSummaryValue}>+{lastXpDelta}</Text>
              </View>
            ) : null}
          </View>

          {currentQuestion ? (
            <View style={styles.dailyQuizQuestionCard}>
              <DailyQuizConfettiBlast trigger={confettiKey} />
              <View style={styles.dailyQuizSceneHeader}>
                <View style={styles.dailyQuizProgressDots}>
                  {questions.map((question, index) => (
                    <View
                      key={question.id}
                      style={[
                        styles.dailyQuizProgressDot,
                        index === activeQuestionIndex ? styles.dailyQuizProgressDotActive : null,
                        index < activeQuestionIndex || question.attempt
                          ? question.attempt?.isCorrect
                            ? styles.dailyQuizProgressDotCorrect
                            : styles.dailyQuizProgressDotDone
                          : null,
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.dailyQuizCounterPill}>
                  <Text style={styles.dailyQuizCounterText}>
                    {copy.questionProgress} {currentQuestionNumber}/{questions.length}
                  </Text>
                </View>
              </View>

              <View style={styles.dailyQuizQuestionStage}>
                <Text style={styles.dailyQuizQuestionText}>{currentQuestion.question}</Text>
              </View>

              <View style={styles.dailyQuizOptionList}>
                {currentQuestion.options.map((option) => {
                  const isSelected = currentAttempt?.selectedOption === option.key;
                  const isPendingSelection =
                    pendingOptionKey === option.key &&
                    submittingQuestionId === currentQuestion.id &&
                    !currentAttempt;
                  const optionStateStyle = isPendingSelection
                    ? styles.dailyQuizOptionPending
                    : isSelected && currentAttempt?.isCorrect
                      ? styles.dailyQuizOptionCorrect
                      : isSelected && currentAttempt && !currentAttempt.isCorrect
                        ? styles.dailyQuizOptionWrong
                        : isSelected
                          ? styles.dailyQuizOptionSelected
                          : null;
                  const optionBadgeStyle = isPendingSelection
                    ? styles.dailyQuizOptionBadgePending
                    : isSelected && currentAttempt?.isCorrect
                      ? styles.dailyQuizOptionBadgeCorrect
                      : isSelected && currentAttempt && !currentAttempt.isCorrect
                        ? styles.dailyQuizOptionBadgeWrong
                        : null;
                  const trailingIcon: keyof typeof Ionicons.glyphMap = isPendingSelection
                    ? 'time-outline'
                    : isSelected && currentAttempt?.isCorrect
                      ? 'sparkles'
                      : isSelected && currentAttempt && !currentAttempt.isCorrect
                        ? 'close-circle'
                        : 'chevron-forward';
                  const trailingColor = isPendingSelection
                    ? '#facc15'
                    : isSelected && currentAttempt?.isCorrect
                      ? '#4ade80'
                      : isSelected && currentAttempt && !currentAttempt.isCorrect
                        ? '#f87171'
                        : '#8A9A5B';

                  return (
                    <Pressable
                      key={option.key}
                      style={({ pressed }) => [
                        styles.dailyQuizOptionButton,
                        optionStateStyle,
                        pressed && !hasAnsweredCurrentQuestion && !submittingQuestionId && isSignedIn
                          ? styles.dailyQuizOptionPressed
                          : null,
                        (!isSignedIn || hasAnsweredCurrentQuestion || Boolean(submittingQuestionId))
                          ? styles.dailyQuizOptionDisabled
                          : null,
                      ]}
                      disabled={!isSignedIn || hasAnsweredCurrentQuestion || Boolean(submittingQuestionId)}
                      onPress={() => {
                        void handleAnswer(currentQuestion.id, option.key);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.key.toUpperCase()} ${option.label}`}
                      accessibilityState={{
                        disabled: !isSignedIn || hasAnsweredCurrentQuestion || Boolean(submittingQuestionId),
                      }}
                    >
                      <View style={[styles.dailyQuizOptionBadge, optionBadgeStyle]}>
                        <Text style={styles.dailyQuizOptionBadgeText}>
                          {isPendingSelection
                            ? '...'
                            : isSelected && currentAttempt?.isCorrect
                              ? 'V'
                              : isSelected && currentAttempt && !currentAttempt.isCorrect
                                ? 'X'
                                : option.key.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.dailyQuizOptionText}>{option.label}</Text>
                      <View style={styles.dailyQuizOptionTrailing}>
                        <Ionicons name={trailingIcon} size={16} color={trailingColor} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {submittingQuestionId === currentQuestion.id ? (
                <Text style={styles.dailyQuizSavingText}>{copy.saving}</Text>
              ) : null}

              {currentAttempt ? (
                <View style={styles.dailyQuizExplanationCard}>
                  <Text
                    style={[
                      styles.dailyQuizExplanationLabel,
                      currentAttempt.isCorrect
                        ? styles.dailyQuizExplanationLabelCorrect
                        : styles.dailyQuizExplanationLabelWrong,
                    ]}
                  >
                    {currentAttempt.isCorrect ? copy.correct : copy.wrong}
                  </Text>
                  <Text style={styles.dailyQuizExplanationBody}>{currentAttempt.explanation}</Text>
                </View>
              ) : null}

              {currentAttempt && hasNextQuestion ? (
                <UiButton
                  label={copy.nextCta}
                  tone="neutral"
                  stretch
                  onPress={() => setActiveQuestionIndex((current) => Math.min(current + 1, questions.length - 1))}
                />
              ) : null}

              {currentAttempt && !hasNextQuestion ? (
                <UiButton label={copy.finishCta} tone="neutral" stretch disabled onPress={() => undefined} />
              ) : null}
            </View>
          ) : null}

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
  commentFeedState,
  currentUserAvatarUrl,
  onEchoComment,
  onLoadCommentReplies,
  onSubmitCommentReply,
  onEchoCommentReply,
  onDeleteComment,
  onOpenCommentAuthorProfile,
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
  commentFeedState: CommentFeedState;
  currentUserAvatarUrl?: string | null;
  onEchoComment?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; message: string }>;
  onLoadCommentReplies?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; replies: MobileCommentReply[]; message: string }>;
  onSubmitCommentReply?: (
    item: CommentFeedState['items'][number],
    text: string
  ) => Promise<{ ok: boolean; message: string; reply?: MobileCommentReply }>;
  onEchoCommentReply?: (
    reply: MobileCommentReply
  ) => Promise<{ ok: boolean; message: string }>;
  onDeleteComment?: (
    item: CommentFeedState['items'][number]
  ) => Promise<{ ok: boolean; message: string }>;
  onOpenCommentAuthorProfile?: (item: CommentFeedState['items'][number]) => void;
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

              {onOpenCommentAuthorProfile ? (
                <ScreenErrorBoundary section="Film Yorumlari">
                  <CommentFeedCard
                    state={commentFeedState}
                    language={language}
                    currentUserAvatarUrl={currentUserAvatarUrl || undefined}
                    showFilters={false}
                    embedded
                    onScopeChange={() => undefined}
                    onSortChange={() => undefined}
                    onQueryChange={() => undefined}
                    onEcho={onEchoComment}
                    onLoadReplies={onLoadCommentReplies}
                    onSubmitReply={onSubmitCommentReply}
                    onEchoReply={onEchoCommentReply}
                    onDeleteItem={onDeleteComment}
                    onOpenAuthorProfile={onOpenCommentAuthorProfile}
                    selectedMovieTitle={movie.title}
                    movieFilterMode="selected_movie"
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
                    <Text style={styles.movieArchiveEntryBody}>
                      {String(item.text || '').trim()
                        ? `"${String(item.text || '').trim()}"`
                        : language === 'tr'
                          ? 'Bu kayitta acik yorum yok.'
                          : 'No public note on this record.'}
                    </Text>
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

const PROFILE_COMMENTS_MODAL_COPY = {
  tr: {
    header: 'Yorumlar',
    close: 'Kapat',
    eyebrow: 'Yorum Akisi',
    loadingTitle: 'Yorumlar yukleniyor',
    loadingBody: 'Filmlere birakilan notlar toparlaniyor.',
    emptyTitle: 'Henuz yorum yok',
    emptyBody: 'Film yorumlari geldiginde burada gorunecek.',
    untitled: 'Film kaydi',
    noteFallback: 'Bu kayit icin acik bir yorum yok.',
  },
  en: {
    header: 'Comments',
    close: 'Close',
    eyebrow: 'Comment Feed',
    loadingTitle: 'Loading comments',
    loadingBody: 'Movie notes are being gathered.',
    emptyTitle: 'No comments yet',
    emptyBody: 'Movie comments will appear here.',
    untitled: 'Movie record',
    noteFallback: 'There is no visible note on this record.',
  },
} as const;

const ProfileCommentsModal = ({
  visible,
  activityState,
  language = 'tr',
  onClose,
}: {
  visible: boolean;
  activityState: ProfileActivitySurfaceState;
  language?: MobileSettingsLanguage;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible);
  if (!visible) return null;

  const copy =
    PROFILE_COMMENTS_MODAL_COPY[language as keyof typeof PROFILE_COMMENTS_MODAL_COPY] ||
    PROFILE_COMMENTS_MODAL_COPY.en;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
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
            {activityState.status === 'loading' && activityState.items.length === 0 ? (
              <StatePanel
                tone="sage"
                variant="loading"
                eyebrow={copy.eyebrow}
                title={copy.loadingTitle}
                body={copy.loadingBody}
              />
            ) : null}

            {activityState.status !== 'loading' && activityState.items.length === 0 ? (
              <StatePanel
                tone="clay"
                variant={activityState.status === 'error' ? 'error' : 'empty'}
                eyebrow={copy.eyebrow}
                title={copy.emptyTitle}
                body={activityState.status === 'error' ? activityState.message || copy.emptyBody : copy.emptyBody}
              />
            ) : null}

            {activityState.items.length > 0 ? (
              <View style={styles.profileArchiveList}>
                {activityState.items.map((item) => {
                  const posterUrl = resolvePosterUrl(item.posterPath);
                  const movieTitle = String(item.movieTitle || '').trim() || copy.untitled;
                  const note = String(item.text || '').trim();
                  return (
                    <View key={item.id} style={styles.profileArchiveRow}>
                      <View style={styles.profileArchivePosterWrap}>
                        {posterUrl ? (
                          <Image
                            source={{ uri: posterUrl }}
                            style={styles.profileArchivePosterImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.profileArchivePosterFallback}>
                            {(movieTitle.slice(0, 1) || 'F').toUpperCase()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.profileArchiveRowCopy}>
                        <Text style={styles.profileArchiveTitle}>{movieTitle}</Text>
                        <Text style={styles.profileArchiveMeta}>
                          {item.year ? `${item.year} | ` : ''}
                          {item.timestampLabel || item.dayKey || '-'}
                        </Text>
                        <Text style={styles.sectionLeadBody}>
                          {note ? `"${note}"` : copy.noteFallback}
                        </Text>
                      </View>
                    </View>
                  );
                })}
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

const PROFILE_FOLLOW_MODAL_COPY = {
  tr: {
    followingHeader: 'Takip',
    followersHeader: 'Takipciler',
    followingEyebrow: 'Takip Ettiklerin',
    followersEyebrow: 'Takipciler',
    close: 'Kapat',
    loadingTitle: 'Liste yukleniyor',
    loadingBody: 'Takip iliskileri getiriliyor.',
    followingEmpty: 'Henuz takip edilen yok',
    followersEmpty: 'Henuz takipci yok',
    openProfile: 'Profili ac',
    unknownUser: 'Bilinmeyen kullanici',
  },
  en: {
    followingHeader: 'Following',
    followersHeader: 'Followers',
    followingEyebrow: 'Following List',
    followersEyebrow: 'Followers List',
    close: 'Close',
    loadingTitle: 'Loading list',
    loadingBody: 'Follow relationships are being fetched.',
    followingEmpty: 'No following users yet',
    followersEmpty: 'No followers yet',
    openProfile: 'Open profile',
    unknownUser: 'Unknown user',
  },
} as const;

const ProfileFollowListModal = ({
  visible,
  mode,
  state,
  language = 'tr',
  onOpenProfile,
  onClose,
}: {
  visible: boolean;
  mode: 'following' | 'followers';
  state: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: Array<{
      userId: string;
      displayName: string;
      avatarUrl?: string;
      secondary?: string;
    }>;
  };
  language?: MobileSettingsLanguage;
  onOpenProfile?: (userId: string, displayName: string) => void;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible);
  if (!visible) return null;

  const copy =
    PROFILE_FOLLOW_MODAL_COPY[language as keyof typeof PROFILE_FOLLOW_MODAL_COPY] ||
    PROFILE_FOLLOW_MODAL_COPY.en;
  const header = mode === 'following' ? copy.followingHeader : copy.followersHeader;
  const eyebrow = mode === 'following' ? copy.followingEyebrow : copy.followersEyebrow;
  const emptyTitle = mode === 'following' ? copy.followingEmpty : copy.followersEmpty;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>{header}</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>{copy.close}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            {state.status === 'loading' && state.items.length === 0 ? (
              <StatePanel
                tone="sage"
                variant="loading"
                eyebrow={eyebrow}
                title={copy.loadingTitle}
                body={copy.loadingBody}
              />
            ) : null}

            {state.status !== 'loading' && state.items.length === 0 ? (
              <StatePanel
                tone="clay"
                variant={state.status === 'error' ? 'error' : 'empty'}
                eyebrow={eyebrow}
                title={emptyTitle}
                body={state.status === 'error' ? state.message || emptyTitle : emptyTitle}
              />
            ) : null}

            {state.items.length > 0 ? (
              <View style={{ gap: 10 }}>
                {state.items.map((item) => {
                  const displayName = String(item.displayName || '').trim() || copy.unknownUser;
                  const secondary = String(item.secondary || '').trim();
                  return (
                    <Pressable
                      key={`${mode}-${item.userId}`}
                      style={({ pressed }) => [
                        styles.profileArchiveRow,
                        { alignItems: 'center' },
                        pressed ? styles.profileArchiveRowPressed : null,
                      ]}
                      onPress={() => onOpenProfile?.(item.userId, displayName)}
                      accessibilityRole="button"
                      accessibilityLabel={`${displayName} ${copy.openProfile}`}
                    >
                      <AvatarView
                        avatarUrl={item.avatarUrl || ''}
                        displayName={displayName}
                        size={54}
                        borderColor="rgba(138,154,91,0.35)"
                      />
                      <View style={styles.profileArchiveRowCopy}>
                        <Text style={styles.profileArchiveTitle}>{displayName}</Text>
                        {secondary ? (
                          <Text style={styles.profileArchiveMeta}>{secondary}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
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

const PROFILE_MARKS_MODAL_COPY = {
  tr: {
    header: 'Marklar',
    close: 'Kapat',
  },
  en: {
    header: 'Marks',
    close: 'Close',
  },
} as const;

const ProfileMarksModal = ({
  visible,
  state,
  isSignedIn,
  language = 'tr',
  onClose,
}: {
  visible: boolean;
  state: ProfileState;
  isSignedIn: boolean;
  language?: MobileSettingsLanguage;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible);
  if (!visible) return null;

  const copy =
    PROFILE_MARKS_MODAL_COPY[language as keyof typeof PROFILE_MARKS_MODAL_COPY] ||
    PROFILE_MARKS_MODAL_COPY.en;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
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
            <ProfileMarksCard state={state} isSignedIn={isSignedIn} language={language} mode="unlocked" />
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
  rating,
  onDraftTextChange,
  onRatingChange,
  submitState,
  queueState,
  canSubmit,
  isSignedIn,
  onSubmit,
  onFlushQueue,
}: {
  targetMovie: { title: string; genre: string | null; year?: number | null; director?: string | null } | null;
  draftText: string;
  rating: number;
  onDraftTextChange: (value: string) => void;
  onRatingChange: (value: number) => void;
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
  const filmInitial = filmTitle.trim().charAt(0).toUpperCase() || 'Y';
  const genreLabel = String(targetMovie?.genre || '').trim() || 'Tur bekleniyor';
  const yearLabel = targetMovie?.year ? String(targetMovie.year) : '--';
  const directorLabel = String(targetMovie?.director || '').trim();
  const infoItems = [
    { label: 'Tur', value: genreLabel },
    ...(yearLabel !== '--' ? [{ label: 'Yil', value: yearLabel }] : []),
  ];
  const ratingDescriptor =
    rating >= 9
      ? 'Favori'
      : rating >= 7
        ? 'Guclu'
        : rating >= 5
          ? 'Dengeli'
          : rating >= 3
            ? 'Mesafeli'
            : rating >= 1
              ? 'Zayif'
              : 'Sec';
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
  const showQueueStatus =
    queueState.pendingCount > 0 || queueState.status === 'syncing' || queueState.status === 'error';

  return (
    <ScreenCard accent="clay">
      <View style={styles.ritualComposerHero}>
        <View style={styles.ritualComposerMonogram}>
          <Text style={styles.ritualComposerMonogramText}>{filmInitial}</Text>
        </View>
        <View style={styles.ritualComposerHeroCopy}>
          <Text style={styles.ritualComposerEyebrow}>Yorum Notu</Text>
          <Text style={styles.ritualComposerTitle}>{filmTitle}</Text>
        </View>
      </View>

      <View style={styles.ritualComposerInfoPanel}>
        <View style={styles.ritualComposerInfoGrid}>
          {infoItems.map((item) => (
            <View key={item.label} style={styles.ritualComposerInfoCell}>
              <Text style={styles.ritualComposerInfoLabel}>{item.label}</Text>
              <Text style={styles.ritualComposerInfoValue} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        {directorLabel ? (
          <View style={styles.ritualComposerDirectorRow}>
            <Text style={styles.ritualComposerInfoLabel}>Yonetmen</Text>
            <Text style={styles.ritualComposerDirectorValue} numberOfLines={1}>
              {directorLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.ritualComposerRatingPanel}>
        <View style={styles.ritualComposerRatingHeader}>
          <Text style={styles.ritualComposerEditorTitle}>Puan</Text>
          <View style={styles.ritualComposerRatingBadge}>
            <Text style={styles.ritualComposerRatingBadgeText}>
              {rating > 0 ? `${rating}/10 ${ratingDescriptor}` : 'Sec'}
            </Text>
          </View>
        </View>
        <View style={styles.ritualComposerRatingTrack}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
            const selected = rating === value;
            const passed = rating > value;
            return (
              <Pressable
                key={value}
                onPress={() => onRatingChange(value)}
                style={[
                  styles.ritualComposerRatingButton,
                  passed ? styles.ritualComposerRatingButtonPassed : null,
                  selected ? styles.ritualComposerRatingButtonActive : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filme ${value} puan ver`}
              >
                <Text
                  style={[
                    styles.ritualComposerRatingButtonText,
                    passed ? styles.ritualComposerRatingButtonTextPassed : null,
                    selected ? styles.ritualComposerRatingButtonTextActive : null,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.ritualComposerEditor}>
        <View style={styles.ritualComposerEditorHeader}>
          <Text style={styles.ritualComposerEditorTitle}>Kisa yorum</Text>
          <Text style={styles.screenMeta}>{textLength}/180</Text>
        </View>

        <TextInput
          style={[styles.ritualInput, styles.ritualComposerInput]}
          multiline
          textAlignVertical="top"
          placeholder="Filmin sende biraktigi izi yaz..."
          placeholderTextColor="#8e8b84"
          value={draftText}
          maxLength={180}
          onChangeText={onDraftTextChange}
          editable={targetMovie !== null && submitState.status !== 'submitting'}
          accessibilityLabel="Yorum notu giris alani"
        />
      </View>

      {submitState.message ? (
        <StatusStrip
          tone={submitTone}
          eyebrow="Kayit"
          body={submitState.message}
          meta={
            submitState.status === 'queued'
              ? 'Baglanti geldiginde yeniden denenir.'
              : submitState.status === 'synced'
                ? 'Yorum profile ve akisa islenir.'
                : undefined
          }
        />
      ) : null}

      {queueState.message && showQueueStatus ? (
        <StatusStrip
          tone={queueTone}
          eyebrow="Kuyruk"
          body={queueState.message}
          meta={
            queueState.pendingCount > 0
              ? `${queueState.pendingCount} taslak bekliyor.`
              : 'Bekleyen kuyruk yok.'
          }
        />
      ) : null}

      <View style={styles.ritualActionRow}>
        <UiButton
          label={submitState.status === 'submitting' ? 'Gonderiliyor...' : 'Yorumu Kaydet'}
          tone="brand"
          stretch
          onPress={onSubmit}
          disabled={submitState.status === 'submitting' || !canSubmit}
        />
        {canRetryQueue ? (
          <UiButton
            label={queueState.status === 'syncing' ? 'Kuyruk Senkron...' : 'Kuyrugu Tekrar Dene'}
            tone="neutral"
            stretch
            onPress={onFlushQueue}
            disabled={!canRetryQueue}
          />
        ) : null}
      </View>
    </ScreenCard>
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
  emailVerification: {
    title: string;
    body: string;
    verifiedTitle: string;
    verifiedBody: string;
    unverifiedTitle: string;
    unverifiedBody: string;
    send: string;
    sendBusy: string;
    sentTitle: string;
    signedOutTitle: string;
    signedOutBody: string;
    sectionMetaVerified: string;
    sectionMetaPending: string;
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
  tr: mobileTranslations.tr.settings.genderOptions.map((option) => ({
    key: option.key as MobileSettingsGender,
    label: option.label,
  })),
  en: mobileTranslations.en.settings.genderOptions.map((option) => ({
    key: option.key as MobileSettingsGender,
    label: option.label,
  })),
  es: mobileTranslations.es.settings.genderOptions.map((option) => ({
    key: option.key as MobileSettingsGender,
    label: option.label,
  })),
  fr: mobileTranslations.fr.settings.genderOptions.map((option) => ({
    key: option.key as MobileSettingsGender,
    label: option.label,
  })),
};
const MOBILE_SETTINGS_IDENTITY_FIELD_COPY: Record<MobileSettingsLanguage, string> = {
  tr: mobileTranslations.tr.settings.genderFieldLabel,
  en: mobileTranslations.en.settings.genderFieldLabel,
  es: mobileTranslations.es.settings.genderFieldLabel,
  fr: mobileTranslations.fr.settings.genderFieldLabel,
};
const SETTINGS_PLATFORM_RULES: Record<MobileSettingsLanguage, string[]> = {
  tr: [...mobileTranslations.tr.settings.rules.items],
  en: [...mobileTranslations.en.settings.rules.items],
  es: [...mobileTranslations.es.settings.rules.items],
  fr: [...mobileTranslations.fr.settings.rules.items],
};
const MOBILE_SETTINGS_RULES_CARD_COPY: Record<
  MobileSettingsLanguage,
  {
    title: string;
    meta: string;
    body: string;
  }
> = {
  tr: mobileTranslations.tr.settings.rules,
  en: mobileTranslations.en.settings.rules,
  es: mobileTranslations.es.settings.rules,
  fr: mobileTranslations.fr.settings.rules,
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
  tr: mobileTranslations.tr.settings.status,
  en: mobileTranslations.en.settings.status,
  es: mobileTranslations.es.settings.status,
  fr: mobileTranslations.fr.settings.status,
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
    avatarPickPreset: string;
    avatarClear: string;
    avatarPremiumHint: string;
    avatarFemaleLabel: string;
    avatarMaleLabel: string;
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
    avatarPickPreset: 'Avatar Sec',
    avatarClear: 'Temizle',
    avatarPremiumHint: 'Premium uyelik gerektirir',
    avatarFemaleLabel: 'Kadinlar',
    avatarMaleLabel: 'Erkekler',
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
    avatarPickPreset: 'Select Avatar',
    avatarClear: 'Clear',
    avatarPremiumHint: 'Requires premium membership',
    avatarFemaleLabel: 'Female',
    avatarMaleLabel: 'Male',
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
    avatarPickPreset: 'Seleccionar Avatar',
    avatarClear: 'Limpiar',
    avatarPremiumHint: 'Requiere suscripcion premium',
    avatarFemaleLabel: 'Mujeres',
    avatarMaleLabel: 'Hombres',
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
    avatarPickPreset: 'Choisir un Avatar',
    avatarClear: 'Effacer',
    avatarPremiumHint: 'Abonnement premium requis',
    avatarFemaleLabel: 'Femmes',
    avatarMaleLabel: 'Hommes',
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
    emailVerification: {
      title: 'Email Verification',
      body: 'Email confirmation is optional. You can request a verification mail whenever you want.',
      verifiedTitle: 'Email already verified',
      verifiedBody: 'This account is already tied to a confirmed email address.',
      unverifiedTitle: 'Email still optional',
      unverifiedBody: 'You can keep using your account, or send a confirmation mail from here.',
      send: 'Send verification email',
      sendBusy: 'Sending...',
      sentTitle: 'Verification mail sent',
      signedOutTitle: 'Sign in required',
      signedOutBody: 'Sign in first to manage email verification.',
      sectionMetaVerified: 'Verified email',
      sectionMetaPending: 'Optional verification',
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
    emailVerification: {
      title: 'E-posta Dogrulama',
      body: 'E-posta onayi artik opsiyonel. Istersen buradan dogrulama maili isteyebilirsin.',
      verifiedTitle: 'E-posta zaten dogrulandi',
      verifiedBody: 'Bu hesap dogrulanmis bir e-posta adresine bagli.',
      unverifiedTitle: 'E-posta onayi opsiyonel',
      unverifiedBody: 'Hesabini kullanmaya devam edebilirsin; istersen buradan onay maili gonderilir.',
      send: 'Dogrulama maili gonder',
      sendBusy: 'Gonderiliyor...',
      sentTitle: 'Dogrulama maili gonderildi',
      signedOutTitle: 'Giris gerekli',
      signedOutBody: 'E-posta durumunu yonetmek icin once giris yap.',
      sectionMetaVerified: 'Dogrulandi',
      sectionMetaPending: 'Opsiyonel',
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
    emailVerification: {
      title: 'Verificacion de Correo',
      body: 'La confirmacion por correo ahora es opcional. Puedes pedir un correo de verificacion cuando quieras.',
      verifiedTitle: 'Correo ya verificado',
      verifiedBody: 'Esta cuenta ya esta vinculada a un correo confirmado.',
      unverifiedTitle: 'La verificacion es opcional',
      unverifiedBody: 'Puedes seguir usando tu cuenta o pedir un correo de confirmacion desde aqui.',
      send: 'Enviar correo de verificacion',
      sendBusy: 'Enviando...',
      sentTitle: 'Correo de verificacion enviado',
      signedOutTitle: 'Inicia sesion',
      signedOutBody: 'Inicia sesion primero para gestionar la verificacion del correo.',
      sectionMetaVerified: 'Verificado',
      sectionMetaPending: 'Opcional',
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
    emailVerification: {
      title: 'Verification E-mail',
      body: 'La confirmation par e-mail est maintenant optionnelle. Tu peux demander un e-mail de verification quand tu veux.',
      verifiedTitle: 'E-mail deja verifie',
      verifiedBody: 'Ce compte est deja lie a une adresse e-mail confirmee.',
      unverifiedTitle: 'La verification est optionnelle',
      unverifiedBody: 'Tu peux continuer a utiliser ton compte ou demander un e-mail de confirmation ici.',
      send: 'Envoyer l e-mail de verification',
      sendBusy: 'Envoi...',
      sentTitle: 'E-mail de verification envoye',
      signedOutTitle: 'Connexion requise',
      signedOutBody: 'Connecte-toi d abord pour gerer la verification de l e-mail.',
      sectionMetaVerified: 'Verifie',
      sectionMetaPending: 'Optionnel',
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
  rating,
  onDraftTextChange,
  onRatingChange,
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
  rating: number;
  onDraftTextChange: (value: string) => void;
  onRatingChange: (value: number) => void;
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
                rating={rating}
                onDraftTextChange={onDraftTextChange}
                onRatingChange={onRatingChange}
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
  onSendVerificationEmail,
  onSelectAvatar,
  isPremium,
  activeAccountLabel,
  activeEmailLabel,
  isEmailVerified,
  emailConfirmedAt,
  emailVerificationState,
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
  onSignOut,
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
  onSendVerificationEmail: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  isPremium: boolean;
  activeAccountLabel: string;
  activeEmailLabel: string;
  isEmailVerified: boolean;
  emailConfirmedAt: string | null;
  emailVerificationState: MobileSettingsSaveState;
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
  onSignOut: () => void;
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
  return (
    <MobileSettingsNavigatorModal
      visible={visible}
      onClose={onClose}
      language={language}
      themeMode={themeMode}
      identityDraft={identityDraft}
      onChangeIdentity={onChangeIdentity}
      onSaveIdentity={onSaveIdentity}
      onChangeTheme={onChangeTheme}
      onChangeLanguage={onChangeLanguage}
      saveState={saveState}
      onSavePassword={onSavePassword}
      onSendVerificationEmail={onSendVerificationEmail}
      onSelectAvatar={onSelectAvatar}
      isPremium={isPremium}
      activeAccountLabel={activeAccountLabel}
      activeEmailLabel={activeEmailLabel}
      isEmailVerified={isEmailVerified}
      emailConfirmedAt={emailConfirmedAt}
      emailVerificationState={emailVerificationState}
      inviteCode={inviteCode}
      inviteLink={inviteLink}
      inviteStatsLabel={inviteStatsLabel}
      inviteRewardLabel={inviteRewardLabel}
      invitedByCode={invitedByCode}
      inviteCodeDraft={inviteCodeDraft}
      onInviteCodeDraftChange={onInviteCodeDraftChange}
      onApplyInviteCode={onApplyInviteCode}
      onCopyInviteLink={onCopyInviteLink}
      inviteStatus={inviteStatus}
      isInviteActionBusy={isInviteActionBusy}
      canCopyInviteLink={canCopyInviteLink}
      isSignedIn={isSignedIn}
      accountDeletionState={accountDeletionState}
      onDeleteAccount={onDeleteAccount}
      onOpenAccountDeletionInfo={onOpenAccountDeletionInfo}
      privacyDraft={privacyDraft}
      onChangePrivacy={onChangePrivacy}
      onSavePrivacy={onSavePrivacy}
      _letterboxdSummary={letterboxdSummary}
      _letterboxdStatus={letterboxdStatus}
      _isImportingLetterboxd={isImportingLetterboxd}
      _onImportLetterboxd={onImportLetterboxd}
      onOpenShareHub={onOpenShareHub}
      onSignOut={onSignOut}
    />
  );
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
  const emailVerificationCopy = settingsCopy.emailVerification;
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
  const emailVerificationTone = isEmailVerified
    ? 'sage'
    : emailVerificationState.status === 'error'
      ? 'clay'
      : emailVerificationState.status === 'success'
        ? 'sage'
        : 'muted';
  const isSendingVerificationEmail = emailVerificationState.status === 'saving';
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
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, marginBottom: 12 }}>
                    <AvatarView
                      avatarUrl={identityDraft.avatarUrl}
                      displayName={identityDraft.fullName || identityDraft.username}
                      size={64}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: '#f5f2eb', fontSize: 14, fontWeight: '600' }}>
                        {identityDraft.avatarUrl
                          ? getCinemaAvatarEntry(identityDraft.avatarUrl)?.label || identityCopy.avatarSelected
                          : identityCopy.avatarOptional}
                      </Text>
                      <Text style={{ color: '#8e8b84', fontSize: 11 }}>
                        {identityDraft.avatarUrl ? identityCopy.avatarSelectedBody : identityCopy.avatarOptionalBody}
                      </Text>
                      {identityDraft.avatarUrl ? (
                        <Pressable
                          onPress={() => onSelectAvatar('')}
                          hitSlop={PRESSABLE_HIT_SLOP}
                          disabled={!isSignedIn}
                        >
                          <Text style={{ color: '#E07842', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                            {identityCopy.avatarClear}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <PresetAvatarPickerGrid
                    selectedAvatarUrl={identityDraft.avatarUrl}
                    isPremium={isPremium}
                    onSelect={onSelectAvatar}
                    language={language}
                  />

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
                      ? 'Hediye kodu ve platform kurallarini bu sekmeden yonet.'
                      : 'Giris yaptiginda hediye kodu ve hesap islemleri burada acilir.'
                  }
                  badges={[
                    { label: isSignedIn ? 'Hesap acik' : 'Giris gerekli', tone: isSignedIn ? 'sage' : 'clay' },
                    { label: activeEmailLabel || 'E-posta yok', tone: 'muted' },
                    { label: 'Hediye kodu', tone: 'muted' },
                  ]}
                  metrics={[
                    { label: 'Hediye', value: 'kod' },
                    { label: 'Durum', value: isInviteActionBusy ? 'isleniyor' : isSignedIn ? 'hazir' : 'misafir' },
                    { label: 'Tip', value: 'premium/bilet' },
                  ]}
                />

                {inviteStatus ? (
                  <StatusStrip
                    tone={inviteStatusTone}
                    eyebrow="Hediye Kodu"
                    title={inviteStatusTone === 'clay' ? 'Hediye kodu uygulanamadi' : 'Hediye kodu uygulandi'}
                    body={inviteStatus}
                    meta={inviteStatsLabel}
                  />
                ) : null}

                <CollapsibleSectionCard
                  accent="sage"
                  title={emailVerificationCopy.title}
                  meta={
                    isSignedIn
                      ? isEmailVerified
                        ? emailVerificationCopy.sectionMetaVerified
                        : emailVerificationCopy.sectionMetaPending
                      : emailVerificationCopy.signedOutTitle
                  }
                  defaultExpanded
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow={emailVerificationCopy.title}
                      title={emailVerificationCopy.signedOutTitle}
                      body={emailVerificationCopy.signedOutBody}
                    />
                  ) : (
                    <>
                      <StatusStrip
                        tone={emailVerificationTone}
                        eyebrow={emailVerificationCopy.title}
                        title={
                          isEmailVerified
                            ? emailVerificationCopy.verifiedTitle
                            : emailVerificationState.status === 'success'
                              ? emailVerificationCopy.sentTitle
                              : emailVerificationCopy.unverifiedTitle
                        }
                        body={
                          isEmailVerified
                            ? emailVerificationCopy.verifiedBody
                            : emailVerificationState.message || emailVerificationCopy.unverifiedBody
                        }
                        meta={activeEmailLabel || emailConfirmedAt || undefined}
                      />

                      <Text style={styles.screenBody}>{emailVerificationCopy.body}</Text>

                      {!isEmailVerified ? (
                        <UiButton
                          label={
                            isSendingVerificationEmail
                              ? emailVerificationCopy.sendBusy
                              : emailVerificationCopy.send
                          }
                          tone="neutral"
                          onPress={onSendVerificationEmail}
                          disabled={isSendingVerificationEmail}
                        />
                      ) : null}
                    </>
                  )}
                </CollapsibleSectionCard>

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
                  title="Hediye Kodu"
                  meta="Premium / bilet"
                  defaultExpanded
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow="Hediye"
                      title="Hediye kodu icin once giris yap"
                      body="Premium veya bilet kodunu kullanmak icin hesabina giris yapman gerekir."
                      meta="Giris yaptiginda bu bolum acilir."
                    />
                  ) : (
                    <>
                      <StatusStrip
                        tone="sage"
                        eyebrow="Hediye Kodu"
                        body={inviteRewardLabel}
                        meta={inviteStatsLabel}
                      />

                      <Text style={styles.subSectionLabel}>Hediye Kodu Gir</Text>
                      <TextInput
                        style={styles.input}
                        value={inviteCodeDraft}
                        onChangeText={(value) =>
                          onInviteCodeDraftChange(value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())
                        }
                        autoCapitalize="characters"
                        maxLength={80}
                        placeholder="CINE-XXXX-XXXX"
                        placeholderTextColor="#8e8b84"
                        accessibilityLabel="Hediye kodu gir"
                      />
                      <UiButton
                        label={isInviteActionBusy ? 'Uygulaniyor...' : 'Kodu Uygula'}
                        tone="brand"
                        onPress={onApplyInviteCode}
                        disabled={isInviteActionBusy || !inviteCodeDraft.trim()}
                      />
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
        codeLabel: 'Kod',
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
        codeLabel: 'Code',
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
  totalXp: number;
  leagueKey: string;
  weeklyArenaScore: number;
  weeklyArenaActivity: number;
  commentRewards: number;
  quizRewards: number;
  updatedAt: string | null;
};

type ArenaLeaderboardState = {
  status: 'loading' | 'ready' | 'error';
  source: 'live' | 'fallback';
  message: string;
  scope?: 'league' | 'global';
  cohortLeagueKey?: string | null;
  weekKey?: string | null;
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
  leagueLabel: string;
  xpLabel: string;
};

const MOBILE_ARENA_COPY_EN: MobileArenaCopy = {
  pulseEyebrow: 'Arena Pulse',
  pulseTitle: 'Weekly season pulse',
  pulseBody: 'Daily completions, rewardable notes, and quiz runs shape your place on the arena board.',
  seriesLabel: 'Streak',
  commentLabel: 'Comments',
  weeklyPace: 'weekly pace',
  modeLabel: 'Mode',
  weeklyMode: 'Weekly',
  openDaily: 'Go To Daily Feed',
  rhythmEyebrow: 'Arena Rhythm',
  rhythmTitle: 'Season score builds from daily momentum',
  rhythmBody: 'Close the daily loop, leave rewardable notes, and finish quiz runs to keep climbing the weekly table.',
  rhythmMeta: 'The leaderboard below reflects weekly arena score rather than social feed activity.',
  boardEyebrow: 'Arena Board',
  boardTitle: 'Arena Leaderboard',
  boardBody: 'Weekly ranking generated from arena score. Tap a nickname to open the profile.',
  playerSuffix: 'players',
  statusLabel: 'Status',
  loadingValue: 'Loading',
  loadingTitle: 'Weekly ranking is loading',
  loadingBody: 'Weekly arena score and league placement are being collected.',
  errorTitle: 'Arena board could not be opened',
  emptyTitle: 'No arena activity yet this week',
  errorBody: 'There was a temporary problem while loading the ranking.',
  emptyBody: 'The arena ranking will appear here once this week starts collecting score.',
  profileButton: 'Profile',
  lockedButton: 'Locked',
  nameAccessibilitySuffix: 'profile',
  buttonAccessibilitySuffix: 'profile',
  echoLabel: 'Echo',
  leagueLabel: 'League',
  xpLabel: 'XP',
} as const;

const MOBILE_ARENA_COPY: Record<MobileSettingsLanguage, MobileArenaCopy> = {
  tr: {
    pulseEyebrow: 'Arena Nabzi',
    pulseTitle: 'Haftalik sezon nabzi',
    pulseBody: 'Gunluk kapanislar, odul acan notlar ve quiz turlari Arena tablosundaki yerini belirler.',
    seriesLabel: 'Seri',
    commentLabel: 'Yorum',
    weeklyPace: 'haftalik tempo',
    modeLabel: 'Mod',
    weeklyMode: 'Haftalik',
    openDaily: 'Gunluk Akisa Gec',
    rhythmEyebrow: 'Arena Ritmi',
    rhythmTitle: 'Sezon skoru gunluk ritimden beslenir',
    rhythmBody: 'Gunluk donguyu kapat, odul acan notunu birak ve quiz turu bitirerek haftalik tabloda yuksel.',
    rhythmMeta: 'Asagidaki tablo sosyal akis degil, haftalik arena skorunu gosterir.',
    boardEyebrow: 'Arena Tablosu',
    boardTitle: 'Arena Siralamasi',
    boardBody: 'Haftalik arena skorundan uretilen siralama. Isme dokunarak profili ac.',
    playerSuffix: 'oyuncu',
    statusLabel: 'Durum',
    loadingValue: 'Hazirlaniyor',
    loadingTitle: 'Haftalik siralama yukleniyor',
    loadingBody: 'Haftalik arena skoru ve lig yerlesimi toparlaniyor.',
    errorTitle: 'Arena tablosu acilamadi',
    emptyTitle: 'Bu hafta henuz arena izi yok',
    errorBody: 'Siralama okunurken gecici bir sorun olustu.',
    emptyBody: 'Bu hafta skor birikmeye basladiginda arena siralamasi burada gorunecek.',
    profileButton: 'Profil',
    lockedButton: 'Kilitli',
    nameAccessibilitySuffix: 'profilini ac',
    buttonAccessibilitySuffix: 'profiline git',
    echoLabel: 'Echo',
    leagueLabel: 'Lig',
    xpLabel: 'XP',
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
    leagueLabel: 'Ligue',
    xpLabel: 'XP',
  },
};

const buildArenaGapMessage = (
  language: MobileSettingsLanguage,
  gap: number,
  targetName: string | null
): string | null => {
  if (gap <= 0 || !targetName) return null;
  if (language === 'tr') {
    return `${gap.toLocaleString()} puan ile ${targetName} ustune cikarsin.`;
  }
  return `${gap.toLocaleString()} points to pass ${targetName}.`;
};

const ArenaChallengeCard = ({
  scoreLabel,
  activityLabel,
  rankLabel,
  gapLabel,
  leagueLabel,
  seasonLabel,
  groupLabel,
  sourceMessage,
  onOpenDaily,
  language = 'tr',
}: {
  scoreLabel: string;
  activityLabel: string;
  rankLabel: string;
  gapLabel: string;
  leagueLabel: string;
  seasonLabel: string;
  groupLabel: string;
  sourceMessage?: string | null;
  onOpenDaily?: () => void;
  language?: MobileSettingsLanguage;
}) => {
  const isTurkish = language === 'tr';
  const copy = MOBILE_ARENA_COPY[language] || MOBILE_ARENA_COPY.tr;
  const seasonEyebrow = isTurkish ? 'Arena Sezonu' : 'Arena Season';
  const seasonTitle = isTurkish ? 'Haftalik yaris merkezi' : 'Weekly race center';
  const seasonBody = isTurkish
    ? 'Arena, notlarin ve quiz turlarinin haftalik yaris halidir. Burada sirani, farkini ve sonraki hamleni gorursun.'
    : 'Arena is the weekly race built from your notes and quiz runs. Open the board, see your gap, and decide your next move.';
  const scoreSourcesTitle = isTurkish ? 'Skor kaynaklari' : 'Score sources';
  const seasonBadge = isTurkish ? `Sezon ${seasonLabel}` : `Season ${seasonLabel}`;
  const groupBadge = isTurkish ? `Grup ${groupLabel}` : `Group ${groupLabel}`;
  const sources = isTurkish
    ? [
        {
          title: 'Gunluk 5 film',
          body: 'Tum gunluk film akisini kapatmak sezon skorunu en saglam sekilde biriktirir.',
          meta: 'Gunluk ilerleme + Arena',
        },
        {
          title: 'Kaliteli not',
          body: 'Odul acan yorumlar haftalik tabloda agirlik tasir ve tempo kurar.',
          meta: 'Yorum odulu + Arena',
        },
        {
          title: 'Quiz yan gorevi',
          body: 'Quick, Marathon, Rush ve Blur turlari haftalik yarisi hizlandirir.',
          meta: 'Quiz kapanisi + Arena',
        },
      ]
    : [
        {
          title: 'Daily Five',
          body: 'Closing the full daily film loop is the most reliable way to build season score.',
          meta: 'Daily progress + Arena',
        },
        {
          title: 'Qualifying note',
          body: 'Rewardable notes carry real weekly weight and keep your pace visible.',
          meta: 'Comment reward + Arena',
        },
        {
          title: 'Quiz side quest',
          body: 'Quick, Marathon, Rush, and Blur runs push your weekly race forward.',
          meta: 'Quiz completion + Arena',
        },
      ];

  return (
    <ScreenCard accent="clay">
      <Text style={styles.sectionLeadEyebrow}>{seasonEyebrow}</Text>
      <Text style={styles.sectionLeadTitle}>{seasonTitle}</Text>
      <Text style={styles.sectionLeadBody}>{seasonBody}</Text>

      <View style={styles.sectionLeadBadgeRow}>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeClay]}>
          <Text style={styles.sectionLeadBadgeText}>{seasonBadge}</Text>
        </View>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
          <Text style={styles.sectionLeadBadgeText}>{groupBadge}</Text>
        </View>
      </View>

      <View style={[styles.sectionLeadMetricRow, { marginTop: 12 }]}>
        <View style={styles.sectionLeadMetricCard}>
          <Text style={styles.sectionLeadMetricValue}>{scoreLabel}</Text>
          <Text style={styles.sectionLeadMetricLabel}>{isTurkish ? 'Skor' : 'Score'}</Text>
        </View>
        <View style={styles.sectionLeadMetricCard}>
          <Text style={styles.sectionLeadMetricValue}>{activityLabel}</Text>
          <Text style={styles.sectionLeadMetricLabel}>{isTurkish ? 'Hamle' : 'Activity'}</Text>
        </View>
        <View style={styles.sectionLeadMetricCard}>
          <Text style={styles.sectionLeadMetricValue}>{rankLabel}</Text>
          <Text style={styles.sectionLeadMetricLabel}>{isTurkish ? 'Sira' : 'Rank'}</Text>
        </View>
        <View style={styles.sectionLeadMetricCard}>
          <Text style={styles.sectionLeadMetricValue} numberOfLines={1}>
            {gapLabel}
          </Text>
          <Text style={styles.sectionLeadMetricLabel}>{isTurkish ? 'Fark' : 'Gap'}</Text>
        </View>
      </View>

      <StatusStrip
        tone="clay"
        eyebrow={isTurkish ? 'Lig' : 'League'}
        title={leagueLabel}
        body={sourceMessage || (isTurkish ? 'Bu hafta skor topladiginda tabloya girersin.' : 'Build score this week to enter the board.')}
      />

      <Text style={[styles.sectionLeadEyebrow, { marginTop: 14 }]}>{scoreSourcesTitle}</Text>
      <View style={{ gap: 8, marginTop: 10 }}>
        {sources.map((source) => (
          <View
            key={source.title}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              backgroundColor: 'rgba(255,255,255,0.03)',
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 4,
            }}
          >
            <Text style={{ color: '#f5f2eb', fontSize: 13, fontWeight: '700' }}>{source.title}</Text>
            <Text style={{ color: '#b5b0a6', fontSize: 12, lineHeight: 18 }}>{source.body}</Text>
            <Text style={{ color: '#8A9A5B', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
              {source.meta}
            </Text>
          </View>
        ))}
      </View>

      {onOpenDaily ? (
        <View style={{ marginTop: 14 }}>
          <UiButton label={copy.openDaily} tone="brand" stretch onPress={onOpenDaily} />
        </View>
      ) : null}
    </ScreenCard>
  );
};

type MobileSettingsRoute = 'home' | 'profile' | 'appearance' | 'privacy' | 'account';

const MobileSettingsNavigatorModal = ({
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
  onSendVerificationEmail,
  onSelectAvatar,
  isPremium,
  activeAccountLabel,
  activeEmailLabel,
  isEmailVerified,
  emailConfirmedAt,
  emailVerificationState,
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
  _letterboxdSummary,
  _letterboxdStatus,
  _isImportingLetterboxd,
  _onImportLetterboxd,
  onOpenShareHub,
  onSignOut,
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
  onSendVerificationEmail: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  isPremium: boolean;
  activeAccountLabel: string;
  activeEmailLabel: string;
  isEmailVerified: boolean;
  emailConfirmedAt: string | null;
  emailVerificationState: MobileSettingsSaveState;
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
  _letterboxdSummary: string;
  _letterboxdStatus: string;
  _isImportingLetterboxd: boolean;
  _onImportLetterboxd: () => void;
  onOpenShareHub: () => void;
  onSignOut: () => void;
}) => {
  const [activeRoute, setActiveRoute] = useState<MobileSettingsRoute>('home');
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
    setActiveRoute('home');
    setPasswordDraft('');
    setConfirmPasswordDraft('');
    setAccountDeletionArmed(false);
    setPasswordState({ status: 'idle', message: '' });
  }, [visible]);

  if (!visible) return null;

  const mobileCopy = mobileTranslations[language] || mobileTranslations.en;
  const settingsCopy = mobileCopy.settings;
  const settingsStatusCopy = mobileCopy.settings.status;
  const identityCopy = mobileCopy.identity;
  const privacyCopy = mobileCopy.privacy;
  const rulesCopy = mobileCopy.settings.rules;
  const platformRules = mobileCopy.settings.rules.items;
  const accountDeletionCopy = mobileCopy.settings.accountDeletion;
  const settingsGenderOptions = SETTINGS_GENDER_OPTIONS_BY_LANGUAGE[language] || SETTINGS_GENDER_OPTIONS_BY_LANGUAGE.en;

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
  const activeGenderLabel =
    settingsGenderOptions.find((option) => option.key === identityDraft.gender)?.label ||
    settingsGenderOptions[0]?.label ||
    'Select';
  const settingsGenderLabel =
    MOBILE_SETTINGS_IDENTITY_FIELD_COPY[language] || MOBILE_SETTINGS_IDENTITY_FIELD_COPY.en;
  const isSaving = saveState.status === 'saving';
  const saveTone =
    saveState.status === 'error' ? 'clay' : saveState.status === 'success' ? 'sage' : 'muted';
  const normalizedInviteStatus = inviteStatus.toLocaleLowerCase('tr-TR');
  const inviteStatusTone =
    normalizedInviteStatus.includes('hata')
      ? 'clay'
      : normalizedInviteStatus.includes('uygulandi') || normalizedInviteStatus.includes('kopyalandi')
        ? 'sage'
        : 'muted';
  const isPasswordSaving = passwordState.status === 'saving';
  const passwordTone =
    passwordState.status === 'error'
      ? 'clay'
      : passwordState.status === 'success'
        ? 'sage'
        : 'muted';
  const emailVerificationTone = isEmailVerified
    ? 'sage'
    : emailVerificationState.status === 'error'
      ? 'clay'
      : emailVerificationState.status === 'success'
        ? 'sage'
        : 'muted';
  const accountDeletionTone =
    accountDeletionState.status === 'error'
      ? 'clay'
      : accountDeletionState.status === 'success'
        ? 'sage'
        : 'muted';
  const isSendingVerificationEmail = emailVerificationState.status === 'saving';
  const isAccountDeletionBusy = accountDeletionState.status === 'saving';
  const activeThemeLabel =
    themeMode === 'dawn'
      ? settingsCopy.appearance.themeDawn
      : settingsCopy.appearance.themeMidnight;
  const privacyVisibleCount = [
    privacyDraft.showStats,
    privacyDraft.showFollowCounts,
    privacyDraft.showMarks,
  ].filter(Boolean).length;

  const navigatorCopy = mobileCopy.settings.navigator;

  const routeTitle =
    activeRoute === 'home'
      ? settingsCopy.settingsTitle
      : activeRoute === 'profile'
        ? navigatorCopy.profileTitle
        : activeRoute === 'appearance'
          ? navigatorCopy.appearanceTitle
          : activeRoute === 'privacy'
            ? navigatorCopy.privacyTitle
            : navigatorCopy.accountTitle;

  const handleSavePasswordPress = async () => {
    setPasswordState({ status: 'saving', message: '' });
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

  const renderMenuRow = ({
    key,
    icon,
    title,
    body,
    value,
  }: {
    key: Exclude<MobileSettingsRoute, 'home'>;
    icon: ComponentProps<typeof Ionicons>['name'];
    title: string;
    body: string;
    value: string;
  }) => (
    <Pressable
      key={key}
      onPress={() => setActiveRoute(key)}
      hitSlop={PRESSABLE_HIT_SLOP}
      style={({ pressed }) => [
        {
          borderTopWidth: 1,
          borderTopColor: '#242424',
          paddingVertical: 14,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1D1D1D',
            borderWidth: 1,
            borderColor: '#2F2F2F',
          }}
        >
          <Ionicons name={icon} size={18} color="#A8B97A" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: '#F5F2EB', fontSize: 15, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: '#8E8B84', fontSize: 12, lineHeight: 16 }}>{body}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: 120 }}>
          <Text style={{ color: '#CFCAC2', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
            {value}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#8E8B84" />
        </View>
      </View>
    </Pressable>
  );

  const renderHome = () => (
    <>
      <ScreenCard accent="clay">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AvatarView
            avatarUrl={identityDraft.avatarUrl}
            displayName={identityDraft.fullName || identityDraft.username || navigatorCopy.guestTitle}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.overviewEyebrow}</Text>
            <Text style={styles.sectionLeadTitle}>
              {identityDisplayName || activeAccountLabel || navigatorCopy.guestTitle}
            </Text>
            <Text style={styles.sectionLeadBody}>
              {isSignedIn
                ? activeEmailLabel || navigatorCopy.profileSummary
                : navigatorCopy.overviewSignedOut}
            </Text>
          </View>
        </View>
      </ScreenCard>

      <ScreenCard accent="sage">
        {renderMenuRow({
          key: 'profile',
          icon: 'person-circle-outline',
          title: navigatorCopy.profileTitle,
          body: navigatorCopy.profileSummary,
          value: identityUsername ? `@${identityUsername}` : identityDisplayName || identityCopy.usernamePending,
        })}
        {renderMenuRow({
          key: 'appearance',
          icon: 'color-palette-outline',
          title: navigatorCopy.appearanceTitle,
          body: navigatorCopy.appearanceSummary,
          value: `${activeThemeLabel} · ${language.toUpperCase()}`,
        })}
        {renderMenuRow({
          key: 'privacy',
          icon: 'lock-closed-outline',
          title: navigatorCopy.privacyTitle,
          body: navigatorCopy.privacySummary,
          value: `${privacyVisibleCount}/3`,
        })}
        {renderMenuRow({
          key: 'account',
          icon: 'shield-checkmark-outline',
          title: navigatorCopy.accountTitle,
          body: navigatorCopy.accountSummary,
          value: isSignedIn ? activeEmailLabel || activeAccountLabel || 'account' : navigatorCopy.signOutHint,
        })}
      </ScreenCard>

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
    </>
  );

  const renderProfile = () => (
    <>
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
        />
      ) : null}

      {!isSignedIn ? (
        <StatusStrip
          tone="muted"
          eyebrow={identityCopy.signedOutEyebrow}
          title={identityCopy.signedOutTitle}
          body={navigatorCopy.signOutHint}
        />
      ) : null}

      <ScreenCard accent="clay">
        <Text style={styles.sectionLeadEyebrow}>{identityCopy.avatarEyebrow}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <AvatarView
            avatarUrl={identityDraft.avatarUrl}
            displayName={identityDraft.fullName || identityDraft.username}
            size={64}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.sectionLeadTitle}>
              {getCinemaAvatarEntry(identityDraft.avatarUrl)?.label ||
                (identityDraft.avatarUrl ? identityCopy.avatarSelected : identityCopy.avatarOptional)}
            </Text>
            <Text style={styles.sectionLeadBody}>
              {identityDraft.avatarUrl ? identityCopy.avatarSelectedBody : identityCopy.avatarOptionalBody}
            </Text>
            {identityDraft.avatarUrl ? (
              <Pressable
                onPress={() => onSelectAvatar('')}
                hitSlop={PRESSABLE_HIT_SLOP}
                disabled={!isSignedIn}
              >
                <Text style={{ color: '#E07842', fontSize: 12, fontWeight: '700' }}>
                  {identityCopy.avatarClear}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <PresetAvatarPickerGrid
          selectedAvatarUrl={identityDraft.avatarUrl}
          isPremium={isPremium}
          onSelect={onSelectAvatar}
          language={language}
        />
      </ScreenCard>

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{settingsCopy.tabs.identity}</Text>
        <Text style={styles.sectionLeadTitle}>{navigatorCopy.profileIdentityTitle}</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
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
        </View>

        <View style={[styles.detailInfoGrid, { marginTop: 12 }]}>
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

        <View style={{ marginTop: 12 }}>
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
        </View>
      </ScreenCard>

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.profileTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{navigatorCopy.profileBioTitle}</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
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
        </View>
        <View style={[styles.sectionLeadBadgeRow, { marginTop: 12 }]}>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>
              {identityCopy.characterCountMeta(identityBio.length)}
            </Text>
          </View>
          <View
            style={[
              styles.sectionLeadBadge,
              identityProfileLink ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted,
            ]}
          >
            <Text style={styles.sectionLeadBadgeText}>
              {identityProfileLink ? identityCopy.profileLinkReady : identityCopy.profileLinkOptional}
            </Text>
          </View>
        </View>
      </ScreenCard>

      <ScreenCard accent="clay">
        <UiButton
          label={isSaving ? identityCopy.saveBusy : identityCopy.save}
          tone="brand"
          onPress={onSaveIdentity}
          disabled={isSaving || !isSignedIn}
        />
      </ScreenCard>
    </>
  );

  const renderAppearance = () => (
    <>
      <ScreenCard accent={themeMode === 'dawn' ? 'clay' : 'sage'}>
        <Text style={styles.sectionLeadEyebrow}>{settingsCopy.appearance.eyebrow}</Text>
        <Text style={styles.sectionLeadTitle}>{settingsCopy.appearance.themeTitle}</Text>
        <View style={[styles.sectionLeadBadgeRow, { marginTop: 12 }]}>
          <View
            style={[
              styles.sectionLeadBadge,
              themeMode === 'dawn' ? styles.sectionLeadBadgeClay : styles.sectionLeadBadgeSage,
            ]}
          >
            <Text style={styles.sectionLeadBadgeText}>{activeThemeLabel}</Text>
          </View>
        </View>
        <View style={[styles.themeModeSegmentContainer, { marginTop: 12 }]}>
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
                themeMode === 'midnight' ? styles.themeModeSegmentTextActiveMidnight : null,
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
      </ScreenCard>

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{settingsCopy.appearance.languageTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{language.toUpperCase()}</Text>
        <View style={[styles.settingsGenderRow, { marginTop: 12 }]}>
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
      </ScreenCard>

    </>
  );
  const renderPrivacy = () => (
    <>
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
        />
      ) : null}

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{privacyCopy.eyebrow}</Text>
        <Text style={styles.sectionLeadTitle}>{privacyCopy.title}</Text>
        <View style={[styles.sectionLeadBadgeRow, { marginTop: 12 }]}>
          <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
            <Text style={styles.sectionLeadBadgeText}>{`${privacyVisibleCount}/3`}</Text>
          </View>
        </View>

        <View style={{ marginTop: 12, gap: 10 }}>
          {([
            { key: 'showStats', title: privacyCopy.showStatsTitle, body: privacyCopy.showStatsBody },
            {
              key: 'showFollowCounts',
              title: privacyCopy.showFollowsTitle,
              body: privacyCopy.showFollowsBody,
            },
            { key: 'showMarks', title: privacyCopy.showMarksTitle, body: privacyCopy.showMarksBody },
          ] as const).map((item) => {
            const isEnabled = privacyDraft[item.key];
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.settingsPrivacyRow,
                  pressed ? styles.settingsPrivacyRowPressed : null,
                ]}
                onPress={() =>
                  onChangePrivacy({ [item.key]: !isEnabled } as Partial<MobileSettingsPrivacyDraft>)
                }
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
        </View>
      </ScreenCard>

      <ScreenCard accent="clay">
        <UiButton
          style={styles.settingsPrimaryAction}
          label={isSaving ? privacyCopy.saveBusy : privacyCopy.save}
          tone="brand"
          onPress={onSavePrivacy}
          disabled={isSaving || !isSignedIn}
        />
      </ScreenCard>
    </>
  );

  const renderAccount = () => (
    <>
      {inviteStatus ? (
        <StatusStrip
          tone={inviteStatusTone}
          eyebrow={navigatorCopy.inviteTitle}
          title={
            inviteStatusTone === 'clay'
              ? (language === 'tr' ? 'Davet islemi tamamlanamadi' : 'Invite update failed')
              : (language === 'tr' ? 'Davet bilgisi guncellendi' : 'Invite updated')
          }
          body={inviteStatus}
          meta={inviteStatsLabel}
        />
      ) : null}

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{settingsCopy.emailVerification.title}</Text>
        <Text style={styles.sectionLeadTitle}>
          {activeEmailLabel || activeAccountLabel || navigatorCopy.accountTitle}
        </Text>
        <StatusStrip
          tone={emailVerificationTone}
          eyebrow={settingsCopy.emailVerification.title}
          title={
            isSignedIn
              ? isEmailVerified
                ? settingsCopy.emailVerification.verifiedTitle
                : emailVerificationState.status === 'success'
                  ? settingsCopy.emailVerification.sentTitle
                  : settingsCopy.emailVerification.unverifiedTitle
              : settingsCopy.emailVerification.signedOutTitle
          }
          body={
            isSignedIn
              ? isEmailVerified
                ? settingsCopy.emailVerification.verifiedBody
                : emailVerificationState.message || settingsCopy.emailVerification.unverifiedBody
              : settingsCopy.emailVerification.signedOutBody
          }
          meta={isSignedIn ? activeEmailLabel || emailConfirmedAt || undefined : undefined}
        />
        {!isEmailVerified ? (
          <UiButton
            label={
              isSendingVerificationEmail
                ? settingsCopy.emailVerification.sendBusy
                : settingsCopy.emailVerification.send
            }
            tone="neutral"
            onPress={onSendVerificationEmail}
            disabled={isSendingVerificationEmail || !isSignedIn}
          />
        ) : null}
      </ScreenCard>

      <ScreenCard accent="clay">
        <Text style={styles.sectionLeadEyebrow}>{settingsCopy.password.title}</Text>
        <Text style={styles.sectionLeadTitle}>{settingsCopy.password.title}</Text>
        <StatusStrip
          tone={passwordTone}
          eyebrow={settingsCopy.password.title}
          body={
            isSignedIn
              ? passwordState.message || settingsCopy.password.body
              : settingsCopy.password.signedOutBody
          }
        />
        <View style={{ gap: 12 }}>
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
        </View>
        <UiButton
          label={isPasswordSaving ? settingsCopy.password.saveBusy : settingsCopy.password.save}
          tone="brand"
          onPress={() => {
            void handleSavePasswordPress();
          }}
          disabled={isPasswordSaving || !isSignedIn}
        />
      </ScreenCard>

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.inviteTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{navigatorCopy.inviteTitle}</Text>
        <StatusStrip
          tone="sage"
          eyebrow={navigatorCopy.inviteTitle}
          body={inviteRewardLabel}
          meta={inviteStatsLabel}
        />

        <Text style={styles.subSectionLabel}>{navigatorCopy.inviteInputLabel}</Text>
        <TextInput
          style={styles.input}
          value={inviteCodeDraft}
          onChangeText={(value) =>
            onInviteCodeDraftChange(value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())
          }
          autoCapitalize="characters"
          maxLength={80}
          placeholder={navigatorCopy.inviteInputPlaceholder}
          placeholderTextColor="#8e8b84"
          accessibilityLabel={navigatorCopy.inviteInputLabel}
        />
        <UiButton
          label={isInviteActionBusy ? navigatorCopy.inviteBusy : navigatorCopy.inviteApply}
          tone="brand"
          onPress={onApplyInviteCode}
          disabled={isInviteActionBusy || !inviteCodeDraft.trim() || !isSignedIn}
        />
      </ScreenCard>

      <ScreenCard accent="sage">
        <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.shareTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{navigatorCopy.shareTitle}</Text>
        <Text style={styles.screenBody}>{navigatorCopy.shareBody}</Text>
        <UiButton
          label={navigatorCopy.shareAction}
          tone="brand"
          onPress={onOpenShareHub}
          disabled={!isSignedIn}
        />
      </ScreenCard>

      <ScreenCard accent="clay">
        <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.signOutTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{navigatorCopy.signOutTitle}</Text>
        <Text style={styles.screenBody}>
          {isSignedIn ? navigatorCopy.signOutBody : navigatorCopy.signOutHint}
        </Text>
        <UiButton
          label={navigatorCopy.signOutAction}
          tone="danger"
          onPress={onSignOut}
          disabled={!isSignedIn}
        />
      </ScreenCard>

      <ScreenCard accent="clay">
        <Text style={styles.sectionLeadEyebrow}>{accountDeletionCopy.eyebrow}</Text>
        <Text style={styles.sectionLeadTitle}>{settingsCopy.accountDeletion.title}</Text>
        <StatusStrip
          tone={accountDeletionTone}
          eyebrow={accountDeletionCopy.eyebrow}
          body={
            accountDeletionState.message ||
            (isSignedIn ? accountDeletionCopy.body : accountDeletionCopy.signedOutBody)
          }
          meta={accountDeletionCopy.meta}
        />
        <View style={{ gap: 10 }}>
          {isSignedIn && accountDeletionArmed ? (
            <>
              <StatusStrip
                tone="clay"
                eyebrow={accountDeletionCopy.eyebrow}
                title={accountDeletionCopy.confirmTitle}
                body={accountDeletionCopy.confirmBody}
              />
              <UiButton
                label={
                  isAccountDeletionBusy
                    ? `${accountDeletionCopy.confirmButton}...`
                    : accountDeletionCopy.confirmButton
                }
                tone="danger"
                onPress={onDeleteAccount}
                disabled={isAccountDeletionBusy}
              />
              <UiButton
                label={accountDeletionCopy.cancelButton}
                tone="neutral"
                onPress={() => setAccountDeletionArmed(false)}
                disabled={isAccountDeletionBusy}
              />
            </>
          ) : (
            <UiButton
              label={accountDeletionCopy.button}
              tone="danger"
              onPress={() => setAccountDeletionArmed(true)}
              disabled={isAccountDeletionBusy || !isSignedIn}
            />
          )}
          <UiButton
            label={accountDeletionCopy.infoButton}
            tone="neutral"
            onPress={onOpenAccountDeletionInfo}
            disabled={isAccountDeletionBusy}
          />
        </View>
      </ScreenCard>

      <ScreenCard accent="clay">
        <Text style={styles.sectionLeadEyebrow}>{navigatorCopy.communityTitle}</Text>
        <Text style={styles.sectionLeadTitle}>{rulesCopy.title}</Text>
        <Text style={styles.screenBody}>{navigatorCopy.communityBody}</Text>
        <View style={styles.rulesList}>
          {platformRules.map((rule, index) => (
            <View key={`settings-rule-${index}`} style={styles.rulesRow}>
              <View style={styles.rulesDot} />
              <Text style={styles.rulesText}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScreenCard>
    </>
  );

  const renderActiveRoute = () => {
    if (activeRoute === 'profile') return renderProfile();
    if (activeRoute === 'appearance') return renderAppearance();
    if (activeRoute === 'privacy') return renderPrivacy();
    if (activeRoute === 'account') return renderAccount();
    return renderHome();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <View style={{ minWidth: 54 }}>
              {activeRoute !== 'home' ? (
                <Pressable onPress={() => setActiveRoute('home')} hitSlop={PRESSABLE_HIT_SLOP}>
                  <Text style={styles.modalCloseTextBtn}>{navigatorCopy.back}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.screenTitle}>{routeTitle}</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>{settingsCopy.close}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalSheetScroll} showsVerticalScrollIndicator={false}>
            {renderActiveRoute()}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
      {state.status === 'loading' && state.entries.length === 0 ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow={language === 'tr' ? 'Arena' : 'Arena'}
          title={copy.loadingTitle}
          body={copy.loadingBody}
        />
      ) : null}

      {state.entries.length === 0 && state.status !== 'loading' ? (
        <StatePanel
          tone={state.status === 'error' ? 'clay' : 'sage'}
          variant={state.status === 'error' ? 'error' : 'empty'}
          eyebrow={language === 'tr' ? 'Arena' : 'Arena'}
          title={state.status === 'error' ? copy.errorTitle : copy.emptyTitle}
          body={state.status === 'error' ? copy.errorBody : copy.emptyBody}
        />
      ) : null}

      {state.entries.length > 0 ? (
        <ScreenCard accent="sage">
          <View style={{ gap: 8 }}>
          {state.entries.map((item) => {
            const leagueData = (MOBILE_LEAGUES_DATA as Record<string, { name: string; color: string }>)[item.leagueKey];
            const leagueColor = leagueData ? leagueData.color : '#CD7F32';
            const canOpenProfile = Boolean(
              String(item.userId || '').trim() || String(item.displayName || '').trim()
            );
            const isCurrentUser = Boolean(
              currentDisplayName &&
              String(item.displayName || '').trim().toLowerCase() === currentDisplayName.trim().toLowerCase()
            );
            return (
              <Pressable
                key={`${item.rank}-${item.displayName}`}
                style={({ pressed }) => ({
                  backgroundColor: isCurrentUser ? 'rgba(138,154,91,0.14)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: leagueColor,
                  borderWidth: isCurrentUser ? 1 : 0,
                  borderColor: isCurrentUser ? 'rgba(138,154,91,0.34)' : 'transparent',
                  padding: 12,
                  flexDirection: 'row' as const,
                  alignItems: 'center' as const,
                  opacity: canOpenProfile && pressed ? 0.7 : 1,
                  gap: 10,
                })}
                onPress={() => canOpenProfile && onOpenProfile(item)}
                disabled={!canOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={`${item.displayName} ${copy.nameAccessibilitySuffix}`}
              >
                <View style={{ width: 24, alignItems: 'center' as const }}>
                  <Text style={{ color: item.rank <= 3 ? '#FFD700' : '#8e8b84', fontSize: 15, fontWeight: '700' }}>
                    {item.rank}
                  </Text>
                </View>

                <AvatarView
                  avatarUrl={item.avatarUrl}
                  displayName={item.displayName}
                  size={38}
                  borderColor={leagueColor}
                />

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const }}>
                    <Text style={{ color: '#f5f2eb', fontSize: 15, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    {isCurrentUser ? (
                      <View style={{ backgroundColor: 'rgba(138,154,91,0.16)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#8A9A5B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                          {language === 'tr' ? 'SEN' : 'YOU'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' as const, gap: 2 }}>
                  <Text style={{ color: '#f5f2eb', fontSize: 16, fontWeight: '800' }}>
                    {item.weeklyArenaScore.toLocaleString()}
                  </Text>
                  <Text style={{ color: '#8e8b84', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                    {language === 'tr' ? 'PUAN' : 'POINTS'}
                  </Text>
                </View>

                {canOpenProfile ? (
                  <Ionicons name="chevron-forward" size={14} color="#8e8b84" style={{ marginLeft: 4 }} />
                ) : null}
              </Pressable>
            );
          })}
          {(() => {
            return null;
            const normalizedName = String(currentDisplayName || '').trim().toLowerCase();
            if (!normalizedName || state.entries.length < 2) return null;
            const myIdx = state.entries.findIndex(
              (e) => String(e.displayName || '').trim().toLowerCase() === normalizedName
            );
            if (myIdx < 1) return null;
            const myEntry = state.entries[myIdx];
            const above = state.entries[myIdx - 1];
            const arenaGapMessage = buildArenaGapMessage(
              language,
              above.weeklyArenaScore - myEntry.weeklyArenaScore,
              String(above.displayName || '').trim()
            );
            if (!arenaGapMessage) return null;
            
            /*
                ? `${aboveName}'i geçmek için ${xpDiff.toLocaleString()} XP kaldı.`
                : language === 'fr'
                  ? `${xpDiff.toLocaleString()} XP pour dépasser ${aboveName} !`
                  : language === 'es'
                    ? `Te faltan ${xpDiff.toLocaleString()} XP para superar a ${aboveName}`
                    : `${xpDiff.toLocaleString()} XP to overtake ${aboveName}.`;
            */
            return (
              <View style={{ marginTop: 6, backgroundColor: 'rgba(138,154,91,0.10)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(138,154,91,0.28)', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                <Text style={{ fontSize: 16 }}>{'🏆'}</Text>
                <Text style={{ color: '#DDE6BE', fontSize: 12, fontWeight: '600', flex: 1 }}>{arenaGapMessage}</Text>
              </View>
            );
          })()}
        </View>
        </ScreenCard>
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
  const stateBadge = isSelfProfile
    ? 'Bu profil sana ait'
    : followsYou
      ? 'Seni takip ediyor'
      : isFollowing
        ? 'Takip ediyorsun'
        : '';

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
      <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}>
        <Pressable
          onPress={onBack}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={({ pressed }) => [
            {
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed ? { opacity: 0.55, transform: [{ scale: 0.88 }] } : null,
          ]}
        >
          <Ionicons name="close" size={16} color="#E5E4E2" />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 40 }}>
        <AvatarView avatarUrl={normalizedAvatarUrl} displayName={profileDisplayName} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.sectionLeadEyebrow}>Profil</Text>
          <Text style={styles.sectionLeadTitle} numberOfLines={1}>
            {profileDisplayName}
          </Text>
          {stateBadge ? (
            <View style={[styles.sectionLeadBadgeRow, { marginTop: 2 }]}>
              <View style={[styles.sectionLeadBadge, followsYou ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted]}>
                <Text style={styles.sectionLeadBadgeText}>{stateBadge}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {[
          { label: 'YORUM', value: String(ritualsCount) },
          { label: 'TAKIP', value: String(followingCount) },
          { label: 'TAKIPCI', value: String(followersCount) },
        ].map((item) => (
          <View key={item.label} style={[styles.detailInfoCard, { flex: 1 }]}>
            <Text style={[styles.detailInfoLabel, { textAlign: 'center' }]}>{item.label}</Text>
            <Text style={styles.detailInfoValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.sectionLeadActionRow, { marginTop: 14 }]}>
        {!isSelfProfile && isSignedIn ? (
          <UiButton
            label={isFollowBusy ? 'Isleniyor...' : isFollowing ? 'Takipten cik' : 'Takip et'}
            tone={isFollowing ? 'danger' : 'brand'}
            onPress={onToggleFollow}
            disabled={isFollowBusy || !profile}
          />
        ) : null}
        <UiButton label="Profili ac" tone="neutral" onPress={onOpenFullProfile} />
      </View>

      {followStatus === 'error' && followMessage ? (
        <Text style={[styles.screenMeta, { marginTop: 8 }]}>{followMessage}</Text>
      ) : null}
      {status === 'error' && message ? (
        <Text style={[styles.screenMeta, { marginTop: 4 }]}>{message}</Text>
      ) : null}
    </ScreenCard>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LegacyPublicProfileDetailCard = ({
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
   
  const _followTone =
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
        <AvatarView
          avatarUrl={normalizedAvatarUrl}
          displayName={profileDisplayName}
          size={72}
        />
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

      {followStatus === 'error' && followMessage ? (
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

// ---------------------------------------------------------------------------
// MarkUnlockModal — celebration bottom sheet when a mark is earned
// ---------------------------------------------------------------------------

const MARK_CATEGORY_ACCENT: Record<string, string> = {
  Presence: '#A57164',
  Writing: '#8A9A5B',
  Rhythm: '#e07842',
  Discovery: '#50C878',
  Ritual: '#9400D3',
  Social: '#0F52BA',
  Legacy: '#B68B4C',
  Knowledge: '#0096FF',
  Unknown: '#666',
};

export type MarkUnlockModalProps = {
  event: MobileMarkUnlockEvent | null;
  language?: MobileSettingsLanguage;
  onClose: () => void;
};

export const MarkUnlockModal = ({
  event,
  language = 'tr',
  onClose,
}: MarkUnlockModalProps) => {
  const slideY = useRef(new Animated.Value(320)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;
  const iconRing = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!event) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 320, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }

    slideY.setValue(320);
    backdropOpacity.setValue(0);
    iconScale.setValue(0.4);
    iconRing.setValue(0.8);

    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, speed: 14, bounciness: 6, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, speed: 10, bounciness: 14, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconRing, { toValue: 1.18, duration: 1000, useNativeDriver: true }),
        Animated.timing(iconRing, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
   
  }, [event]);

  if (!event) return null;

  const lang = (language as string) === 'tr' ? 'tr' : (language as string) === 'es' ? 'es' : (language as string) === 'fr' ? 'fr' : 'en';
  const surfaceCopy = resolveMarkUnlockSurfaceCopy(lang as 'en' | 'tr' | 'es' | 'fr');
  const markMeta = resolveMobileMarkMeta(event.markId, lang as 'en' | 'tr' | 'es' | 'fr');
  const accent = MARK_CATEGORY_ACCENT[markMeta.category] ?? '#8A9A5B';

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[markModalStyles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
      <Pressable style={markModalStyles.backdropTap} onPress={onClose} />
      <Animated.View style={[markModalStyles.card, { transform: [{ translateY: slideY }] }]}>
        <View style={[markModalStyles.strip, { backgroundColor: accent }]} />
        <View style={markModalStyles.topRow}>
          <View style={markModalStyles.iconWrapper}>
            <Animated.View style={[markModalStyles.iconRing, { borderColor: accent, transform: [{ scale: iconRing }] }]} />
            <Animated.View style={[markModalStyles.iconDisc, { backgroundColor: `${accent}1a`, borderColor: `${accent}44`, transform: [{ scale: iconScale }] }]}>
              <MobileMarkIcon markId={event.markId} color={accent} size={36} />
            </Animated.View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[markModalStyles.eyebrowPill, { borderColor: `${accent}44`, backgroundColor: `${accent}14` }]}>
              <Text style={[markModalStyles.eyebrowText, { color: accent }]}>{surfaceCopy.eyebrow}</Text>
            </View>
            <Text style={markModalStyles.categoryLabel}>{markMeta.categoryLabel}</Text>
          </View>
        </View>
        <Text style={markModalStyles.title}>{markMeta.title}</Text>
        <Text style={[markModalStyles.whisper, { color: `${accent}cc` }]}>"{markMeta.whisper}"</Text>
        <Text style={markModalStyles.description}>{markMeta.description}</Text>
        <Pressable
          style={({ pressed }) => [markModalStyles.actionBtn, { backgroundColor: accent, opacity: pressed ? 0.82 : 1 }]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={markModalStyles.actionText}>{surfaceCopy.action}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const markModalStyles = StyleSheet.create({
  backdrop: { ...{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: 'rgba(0,0,0,0.62)' },
  backdropTap: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#131210', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 24, paddingTop: 0, paddingBottom: Platform.OS === 'ios' ? 46 : 30, overflow: 'hidden',
  },
  strip: { height: 3, marginHorizontal: -24, marginBottom: 24, opacity: 0.75 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  iconWrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  iconRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, opacity: 0.22 },
  iconDisc: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrowPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  eyebrowText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  categoryLabel: { color: '#6b6560', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#f2ede7', fontSize: 26, fontWeight: '800', lineHeight: 32, marginBottom: 8 },
  whisper: { fontSize: 14, fontStyle: 'italic', lineHeight: 20, marginBottom: 10 },
  description: { color: '#a09890', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionText: { color: '#111', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});

// ---------------------------------------------------------------------------
// XpGainToast — brief animated pill showing "+X XP" after a reward
// ---------------------------------------------------------------------------

export type XpGainToastProps = {
  xpDelta: number | null;
  onDone: () => void;
};

export const XpGainToast = ({ xpDelta, onDone }: XpGainToastProps) => {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (xpDelta === null || xpDelta <= 0) return;
    translateY.setValue(60);
    opacity.setValue(0);
    const show = Animated.parallel([
      Animated.spring(translateY, { toValue: 0, speed: 20, bounciness: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]);
    const hide = Animated.parallel([
      Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    show.start(() => {
      const timer = setTimeout(() => { hide.start(() => onDone()); }, 1800);
      return () => clearTimeout(timer);
    });
   
  }, [xpDelta]);

  if (xpDelta === null || xpDelta <= 0) return null;

  return (
    <Animated.View style={[xpToastStyles.pill, { transform: [{ translateY }], opacity }]} pointerEvents="none">
      <Text style={xpToastStyles.plus}>+</Text>
      <Text style={xpToastStyles.value}>{xpDelta}</Text>
      <Text style={xpToastStyles.label}> XP</Text>
    </Animated.View>
  );
};

const xpToastStyles = StyleSheet.create({
  pill: {
    position: 'absolute', bottom: 120, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,18,16,0.92)', borderWidth: 1,
    borderColor: 'rgba(180,150,80,0.55)', borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10, gap: 2, zIndex: 9999,
  },
  plus: { color: '#c9a84c', fontSize: 17, fontWeight: '700' },
  value: { color: '#f2e6c8', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  label: { color: '#c9a84c', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});

// ---------------------------------------------------------------------------
// TierAdvancementModal — celebration when user advances a tier within a league
// ---------------------------------------------------------------------------

export type TierAdvancementEvent = {
  leagueKey: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  color: string;
};

type TierAdvancementCopy = {
  eyebrow: string;
  title: (tierLabel: string) => string;
  body: string;
  action: string;
};

const TIER_ADVANCEMENT_COPY: Record<MobileSettingsLanguage, TierAdvancementCopy> = {
  tr: { eyebrow: 'YENİ KAT', title: (t) => `${t}'a ulaştın!`, body: 'XP kazanmaya devam et, bir sonraki kata çık.', action: 'Devam Et' },
  en: { eyebrow: 'TIER UP', title: (t) => `You reached ${t}!`, body: 'Keep earning XP to advance to the next tier.', action: 'Keep Going' },
  es: { eyebrow: 'NUEVO NIVEL', title: (t) => `¡Alcanzaste ${t}!`, body: 'Sigue ganando XP para avanzar al siguiente nivel.', action: 'Continuar' },
  fr: { eyebrow: 'NIVEAU SUPÉRIEUR', title: (t) => `Tu as atteint ${t} !`, body: 'Continue à gagner des XP pour passer au niveau suivant.', action: 'Continuer' },
};

const TIER_ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' };

export type TierAdvancementModalProps = {
  event: TierAdvancementEvent | null;
  language?: MobileSettingsLanguage;
  onClose: () => void;
};

export const TierAdvancementModal = ({
  event,
  language = 'tr',
  onClose,
}: TierAdvancementModalProps) => {
  const slideY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dot1Scale = useRef(new Animated.Value(0.3)).current;
  const dot2Scale = useRef(new Animated.Value(0.3)).current;
  const dot3Scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!event) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }
    slideY.setValue(300);
    backdropOpacity.setValue(0);
    dot1Scale.setValue(0.3);
    dot2Scale.setValue(0.3);
    dot3Scale.setValue(0.3);

    const dotScales = [dot1Scale, dot2Scale, dot3Scale];
    const dotAnims = dotScales.slice(0, event.tier).map((scale, i) =>
      Animated.sequence([
        Animated.delay(i * 80),
        Animated.spring(scale, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }),
      ])
    );

    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, speed: 14, bounciness: 6, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ...dotAnims,
    ]).start();
  }, [event, slideY, backdropOpacity, dot1Scale, dot2Scale, dot3Scale]);

  if (!event) return null;

  const copy = TIER_ADVANCEMENT_COPY[language] ?? TIER_ADVANCEMENT_COPY.tr;
  const accent = event.color;
  const dotScaleValues = [dot1Scale, dot2Scale, dot3Scale];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[tierModalStyles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
      <Pressable style={tierModalStyles.backdropTap} onPress={onClose} />
      <Animated.View style={[tierModalStyles.card, { borderTopColor: accent, transform: [{ translateY: slideY }] }]}>
        <View style={[tierModalStyles.strip, { backgroundColor: accent }]} />
        <View style={[tierModalStyles.eyebrowPill, { borderColor: `${accent}44`, backgroundColor: `${accent}14` }]}>
          <Text style={[tierModalStyles.eyebrowText, { color: accent }]}>{copy.eyebrow}</Text>
        </View>
        <Text style={tierModalStyles.title}>{copy.title(event.tierLabel)}</Text>
        <View style={tierModalStyles.dotsRow}>
          {([0, 1, 2] as const).map((i) => {
            const tierNum = (i + 1) as 1 | 2 | 3;
            const isDone = tierNum <= event.tier;
            return (
              <View key={i} style={tierModalStyles.dotWrap}>
                <Animated.View style={[tierModalStyles.dot, { backgroundColor: isDone ? accent : 'rgba(255,255,255,0.1)', transform: [{ scale: isDone ? dotScaleValues[i] : new Animated.Value(1) }] }]} />
                <Text style={[tierModalStyles.dotLabel, isDone && { color: accent }]}>{TIER_ROMAN[tierNum]}</Text>
              </View>
            );
          })}
        </View>
        <Text style={tierModalStyles.body}>{copy.body}</Text>
        <Pressable
          style={({ pressed }) => [tierModalStyles.actionBtn, { backgroundColor: accent, opacity: pressed ? 0.82 : 1 }]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={tierModalStyles.actionText}>{copy.action}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const tierModalStyles = StyleSheet.create({
  backdrop: { ...{ position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: 'rgba(0,0,0,0.58)' },
  backdropTap: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#131210', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 0, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 3, overflow: 'hidden',
  },
  strip: { height: 3, marginHorizontal: -24, marginBottom: 22, opacity: 0.7 },
  eyebrowPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14 },
  eyebrowText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#f2ede7', fontSize: 22, fontWeight: '800', lineHeight: 30, marginBottom: 22 },
  dotsRow: { flexDirection: 'row', gap: 28, marginBottom: 22 },
  dotWrap: { alignItems: 'center', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  dotLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  body: { color: '#a09890', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  actionBtn: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  actionText: { color: '#111', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});

export {
  setAppScreensThemeMode,
  AvatarView,
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
  ProfileCommentsModal,
  ProfileFollowListModal,
  ProfileMarksModal,
  PushStatusCard,
  PushInboxCard,
  WatchedMoviesCard,
  buildDailyGreetingCard,
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








