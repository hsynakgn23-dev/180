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
import { UiButton } from './primitives';
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
import type { MobilePublicProfileActivityItem } from '../lib/mobilePublicProfileActivity';
import type { MobileProfileVisibility } from '../lib/mobileProfileVisibility';

const PRESSABLE_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const SUPPORTS_NATIVE_DRIVER = Platform.OS !== 'web';
const KEYBOARD_AVOIDING_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
const KEYBOARD_AVOIDING_OFFSET = Platform.OS === 'ios' ? 12 : 0;
const DAILY_MOVIE_CARD_STRIDE = 144;
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';
const STORAGE_OBJECT_PUBLIC_PATH = 'storage/v1/object/public/';
const MOBILE_SUPABASE_BASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const MOBILE_SUPABASE_STORAGE_BUCKET =
  String(process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || 'posters')
    .trim()
    .replace(/^\/+|\/+$/g, '') || 'posters';
const DAWN_TEXT_COLOR_STYLE = { color: '#A45E4A' } as const;
let APP_SCREENS_THEME_MODE: MobileThemeMode = 'midnight';

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

const Text = ({ style, ...props }: TextProps) => (
  <RNText
    {...props}
    style={[style, APP_SCREENS_THEME_MODE === 'dawn' ? DAWN_TEXT_COLOR_STYLE : null]}
  />
);

const setAppScreensThemeMode = (mode: MobileThemeMode) => {
  APP_SCREENS_THEME_MODE = mode === 'dawn' ? 'dawn' : 'midnight';
};

type DailyMovieRailItem = Extract<DailyState, { status: 'success' }>['movies'][number];

export type MobileLeaguePromotionEvent = {
  leagueKey: string;
  leagueName: string;
  leagueColor: string;
  previousLeagueKey?: string | null;
};

const MOBILE_LEAGUE_TRANSITION_COPY: Record<
  MobileSettingsLanguage,
  { badge: string; body: string; meta: string; action: string }
> = {
  tr: {
    badge: 'Lig Atlandi',
    body: 'Tebrikler. Toplam XP seviyen bu lige yukseldi.',
    meta: 'Lig gecisi tamamlandi',
    action: 'Tamam',
  },
  en: {
    badge: 'League Advanced',
    body: 'Congratulations. Your total XP has moved up into this league.',
    meta: 'League promoted',
    action: 'Done',
  },
  es: {
    badge: 'Liga Ascendida',
    body: 'Felicidades. Tu XP total subio a esta liga.',
    meta: 'Ascenso completado',
    action: 'Listo',
  },
  fr: {
    badge: 'Ligue Debloquee',
    body: 'Felicitations. Ton XP total est monte jusqua cette ligue.',
    meta: 'Promotion confirmee',
    action: 'Terminer',
  },
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
  const copy = MOBILE_LEAGUE_TRANSITION_COPY[language] || MOBILE_LEAGUE_TRANSITION_COPY.tr;

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
            style={styles.leagueTransitionButton}
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
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^\/\//.test(normalized)) return `https:${normalized}`;

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
  return `${TMDB_POSTER_BASE_URL}${normalizedPath}`;
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
        : 'Giriş Yap';
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
  switch (motion) {
    case 'spin':
      return 3600;
    case 'signal':
      return 1800;
    case 'spark':
      return 1500;
    case 'float':
      return 2600;
    case 'pulse':
    default:
      return 2200;
  }
};

const MobileMarkPill = ({
  title,
  motion,
  isUnlocked,
  isFeatured,
  onPress,
  accessibilityLabel,
}: {
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
    if (!isUnlocked) return;

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

  const containerAnimatedStyle = isUnlocked
    ? {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
        transform: [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.985, isFeatured ? 1.05 : 1.03],
            }),
          },
        ],
      }
    : null;

  const glyphAnimatedStyle = (() => {
    if (!isUnlocked) return null;

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
                outputRange: [0, -2, 0],
              }),
            },
          ],
        };
      case 'signal':
        return {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1.18],
              }),
            },
          ],
        };
      case 'spark':
        return {
          opacity: progress.interpolate({
            inputRange: [0, 0.35, 0.7, 1],
            outputRange: [0.74, 1, 0.86, 0.74],
          }),
          transform: [
            {
              rotate: progress.interpolate({
                inputRange: [0, 0.35, 0.7, 1],
                outputRange: ['-8deg', '8deg', '0deg', '-8deg'],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.35, 0.7, 1],
                outputRange: [0.9, 1.16, 1, 0.9],
              }),
            },
          ],
        };
      case 'pulse':
      default:
        return {
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1.12],
              }),
            },
          ],
        };
    }
  })();

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
        <Animated.View
          style={[
            styles.markPillGlyph,
            isUnlocked ? styles.markPillGlyphUnlocked : styles.markPillGlyphLocked,
            isUnlocked && isFeatured ? styles.markPillGlyphFeatured : null,
            glyphAnimatedStyle,
          ]}
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

const ProfileUnifiedCard = ({
  state,
  isSignedIn,
  language = 'tr',
  isShareHubActive = false,
  themeModeLabel,
  displayName,
  avatarUrl,
  username,
  bio,
  birthDateLabel,
  profileLink,
  genreItems,
  watchedMoviesState,
  onOpenSettings,
  onOpenProfileLink,
  onOpenShareHub,
  onOpenMovieArchive,
}: {
  state: ProfileState;
  isSignedIn: boolean;
  language?: MobileSettingsLanguage;
  isShareHubActive?: boolean;
  themeModeLabel: string;
  displayName: string;
  avatarUrl?: string;
  username?: string;
  bio?: string;
  birthDateLabel?: string;
  profileLink?: string;
  genreItems: Array<{ genre: string; count: number }>;
  watchedMoviesState: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: MobileWatchedMovie[];
  };
  onOpenSettings?: () => void;
  onOpenProfileLink?: () => void;
  onOpenShareHub: () => void;
  onOpenMovieArchive: (movie: MobileWatchedMovie) => void;
}) => {
  const normalizedDisplayName = String(displayName || '').trim() || 'Observer';
  const normalizedAvatarUrl = String(avatarUrl || '').trim();
  const normalizedUsername = String(username || '').trim().replace(/^@+/, '');
  const normalizedBio =
    String(bio || '').trim() || 'Profil notunu ayarlardan duzenleyerek sahneni netlestirebilirsin.';
  const normalizedBirthDate = String(birthDateLabel || '').trim();
  const normalizedLink = String(profileLink || '').trim();
  const hasLink = Boolean(normalizedLink);
  const isProfileReady = state.status === 'success';
  const totalXp = isProfileReady ? Math.max(0, Math.floor(Number(state.totalXp || 0))) : 0;
  const progress = resolveMobileLeagueProgress(totalXp);
  const currentLevelXp = Math.max(0, totalXp - progress.currentLevelStart);
  const xpToNext = Math.max(0, Math.floor(progress.nextLevelXp - totalXp));
  const nextLeagueLabel = isProfileReady
    ? String(state.nextLeagueName || '').trim() || 'Son Lig'
    : 'Beklemede';
  const progressPercentLabel = Math.round(progress.progressPercentage);
  const fillHeadColor = getProgressHeadColor(progress.progressPercentage);
  const fillTailColor = getProgressTailColor(progress.progressPercentage);
  const effectiveProgressWidth =
    progress.progressPercentage > 0 ? Math.max(progress.progressPercentage, 3) : 0;
  const topGenres = genreItems.slice(0, 4);
  const archivePreview = watchedMoviesState.items.slice(0, 6);
  const unlockedMarks = isProfileReady ? state.marks : [];
  const featuredMarks = isProfileReady ? state.featuredMarks : [];
  const markPreviewIds = (featuredMarks.length > 0 ? featuredMarks : unlockedMarks).slice(0, 8);
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const topFeaturedTitle = featuredMarks[0]
    ? resolveMobileMarkTitle(featuredMarks[0], language)
    : '';
  const activeMark = activeMarkId ? resolveMobileMarkMeta(activeMarkId, language) : null;

  return (
    <>
    <ScreenCard accent="sage">
      <View style={styles.profileUnifiedHeaderRow}>
        <View style={styles.profileUnifiedHeaderCopy}>
          <Text style={styles.sectionLeadEyebrow}>Profil Merkezi</Text>
          <Text style={styles.sectionLeadTitle}>{normalizedDisplayName}</Text>
          <Text style={styles.sectionLeadBody}>
            {isSignedIn
              ? normalizedBio
              : 'Profil, arsiv ve marklarin tek merkezden gorunmesi icin oturum ac.'}
          </Text>
        </View>
        {onOpenSettings ? (
          <Pressable
            style={styles.profileSettingsButton}
            onPress={onOpenSettings}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Profil ayarlarini ac"
          >
            <Ionicons name="settings-sharp" size={18} color="#E5E4E2" />
          </Pressable>
        ) : null}
      </View>

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
          <Text style={styles.detailInfoLabel}>Kimlik Katmani</Text>
          <Text style={styles.detailInfoValue}>
            {normalizedUsername ? `@${normalizedUsername}` : 'Handle eklenmedi'}
          </Text>
          <Text style={styles.screenMeta}>
            {normalizedBirthDate ? `Dogum: ${normalizedBirthDate}` : 'Dogum bilgisi opsiyonel.'}
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
        </View>
      </View>

      <View style={styles.sectionLeadBadgeRow}>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeSage]}>
          <Text style={styles.sectionLeadBadgeText}>
            {isProfileReady ? state.leagueName : 'Profil sync'}
          </Text>
        </View>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
          <Text style={styles.sectionLeadBadgeText}>{themeModeLabel}</Text>
        </View>
        <View
          style={[
            styles.sectionLeadBadge,
            normalizedUsername ? styles.sectionLeadBadgeMuted : styles.sectionLeadBadgeClay,
          ]}
        >
          <Text style={styles.sectionLeadBadgeText}>
            {normalizedUsername ? `@${normalizedUsername}` : 'handle bekliyor'}
          </Text>
        </View>
        <View
          style={[
            styles.sectionLeadBadge,
            hasLink ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted,
          ]}
        >
          <Text style={styles.sectionLeadBadgeText}>{hasLink ? 'link hazir' : 'link yok'}</Text>
        </View>
      </View>

      <View style={styles.detailInfoGrid}>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Yorum</Text>
          <Text style={styles.detailInfoValue}>
            {isProfileReady ? String(state.ritualsCount) : '--'}
          </Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Streak</Text>
          <Text style={styles.detailInfoValue}>
            {isProfileReady ? String(state.streak) : '--'}
          </Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Takip</Text>
          <Text style={styles.detailInfoValue}>
            {isProfileReady ? String(state.followingCount) : '--'}
          </Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Takipci</Text>
          <Text style={styles.detailInfoValue}>
            {isProfileReady ? String(state.followersCount) : '--'}
          </Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Mark</Text>
          <Text style={styles.detailInfoValue}>{isProfileReady ? String(state.marks.length) : '--'}</Text>
        </View>
        <View style={styles.detailInfoCard}>
          <Text style={styles.detailInfoLabel}>Aktif Gun</Text>
          <Text style={styles.detailInfoValue}>
            {isProfileReady ? String(state.daysPresent) : '--'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionLeadActionRow}>
        {hasLink ? (
          <UiButton
            label="Linki Ac"
            tone="teal"
            onPress={() => {
              onOpenProfileLink?.();
            }}
            disabled={!isSignedIn}
          />
        ) : null}
        <UiButton
          label={isShareHubActive ? 'Paylasim Acik' : 'Paylas'}
          tone="neutral"
          onPress={onOpenShareHub}
          disabled={!isSignedIn}
        />
      </View>

      <View style={styles.profileUnifiedDivider} />

      <View style={styles.profileUnifiedSection}>
        <Text style={styles.subSectionLabel}>XP ve Lig Rotasi</Text>
        <Text style={styles.screenMeta}>
          {isProfileReady
            ? state.nextLeagueName
              ? `${nextLeagueLabel} icin ${xpToNext} XP kaldi.`
              : 'Su an erisilebilir en ust ligdesin.'
            : state.message}
        </Text>

        <View style={styles.profileXpSummaryRow}>
          <View style={styles.profileXpSummaryBlock}>
            <Text style={styles.profileXpSummaryLabel}>Bulundugun Lig</Text>
            <Text style={styles.profileXpSummaryValue}>
              {isProfileReady ? state.leagueName : 'Beklemede'}
            </Text>
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
            <Text style={styles.detailInfoLabel}>Toplam XP</Text>
            <Text style={styles.detailInfoValue}>{isProfileReady ? `${totalXp} XP` : '--'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Bu Ligde</Text>
            <Text style={styles.detailInfoValue}>{isProfileReady ? `${currentLevelXp} XP` : '--'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Doluluk</Text>
            <Text style={styles.detailInfoValue}>{isProfileReady ? `%${progressPercentLabel}` : '--'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.profileUnifiedDivider} />

      <View style={styles.profileUnifiedSection}>
        <Text style={styles.subSectionLabel}>Tat Haritasi</Text>
        {topGenres.length > 0 ? (
          <View style={styles.profileGenreList}>
            {topGenres.map((item) => (
              <View key={`profile-hub-genre-${item.genre}`} style={styles.profileGenreRow}>
                <Text style={styles.profileGenreLabel}>{item.genre}</Text>
                <Text style={styles.profileGenreValue}>x{item.count}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.profileUnifiedEmptyText}>
            {isSignedIn
              ? 'Tur dagilimi henuz olusmadi. Yeni yorumlar geldikce burada yogunluk gorunecek.'
              : 'Oturum acinca tur dagilimi burada toplanir.'}
          </Text>
        )}
      </View>

      <View style={styles.profileUnifiedDivider} />

      <View style={styles.profileUnifiedSection}>
        <Text style={styles.subSectionLabel}>Son Izlenenler</Text>
        {archivePreview.length > 0 ? (
          <View style={styles.movieList}>
            {archivePreview.map((movie) => {
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
                    {isLetterboxdItem ? 'Letterboxd importu' : 'Yorum arsivini ac'}
                  </Text>
                </>
              );

              if (isLetterboxdItem) {
                return (
                  <View key={`profile-hub-movie-${movie.id}`} style={styles.movieRow}>
                    {content}
                  </View>
                );
              }

              return (
                <Pressable
                  key={`profile-hub-movie-${movie.id}`}
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
        ) : (
          <Text style={styles.profileUnifiedEmptyText}>
            {watchedMoviesState.status === 'loading'
              ? 'Film arsivi yukleniyor.'
              : watchedMoviesState.message || 'Izlenen filmler burada toplanir.'}
          </Text>
        )}
      </View>

      <View style={styles.profileUnifiedDivider} />

      <View style={styles.profileUnifiedSection}>
        <Text style={styles.subSectionLabel}>Mark Vitrini</Text>
        <Text style={styles.screenMeta}>
          {isProfileReady
            ? featuredMarks.length > 0
              ? `${featuredMarks.length} vitrin marki secili. Ilk mark: ${topFeaturedTitle || 'hazir'}.`
              : `${unlockedMarks.length} acik mark var.`
            : 'Mark koleksiyonu profil verisiyle birlikte acilir.'}
        </Text>
        {markPreviewIds.length > 0 ? (
          <View style={styles.markPillRow}>
            {markPreviewIds.map((markId) => {
              const markMeta = resolveMobileMarkMeta(markId, language);
              const isFeatured = featuredMarks.includes(markId);
              return (
                <MobileMarkPill
                  key={`profile-hub-mark-${markId}`}
                  title={resolveMobileMarkTitle(markId, language)}
                  motion={markMeta.motion}
                  isUnlocked
                  isFeatured={isFeatured}
                  onPress={() => setActiveMarkId(markId)}
                  accessibilityLabel={`${markMeta.title} mark detayini ac`}
                />
              );
            })}
          </View>
        ) : (
          <Text style={styles.profileUnifiedEmptyText}>
            {isSignedIn
              ? 'Henuz acik mark yok. Yeni yorumlar ve streak ile vitrin dolacak.'
              : 'Oturum acinca mark vitrinleri burada gorunur.'}
          </Text>
        )}
      </View>
    </ScreenCard>
    <MobileMarkDetailModal
      mark={activeMark}
      language={language}
      isUnlocked={Boolean(activeMarkId && unlockedMarks.includes(activeMarkId))}
      isFeatured={Boolean(activeMarkId && featuredMarks.includes(activeMarkId))}
      onClose={() => setActiveMarkId(null)}
    />
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

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Marks"
        title={mode === 'unlocked' ? 'Acik Marklar' : 'Mark Arsivi'}
        body={mode === 'unlocked' ? 'Kazandigin marklar burada.' : 'Tum marklar tek yerde.'}
        badges={[
          { label: `${unlockedMarks.length} acik`, tone: 'sage' },
          { label: `${featuredMarks.length} vitrin`, tone: featuredMarks.length > 0 ? 'muted' : 'clay' },
          ...(mode === 'all' ? [{ label: `${MOBILE_MARK_CATALOG.length} toplam`, tone: 'muted' as const }] : []),
        ]}
        metrics={[
          { label: 'Acik', value: String(unlockedMarks.length) },
          { label: 'Vitrin', value: String(featuredMarks.length) },
          { label: 'Grup', value: String(visibleGroups.length) },
        ]}
      />

      {!isSignedIn ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Marks"
          title="Marklar icin giris yap"
          body="Koleksiyon ve vitrin oturumla acilir."
        />
      ) : state.status !== 'success' ? (
        <StatePanel
          tone="sage"
          variant={state.status === 'loading' ? 'loading' : 'empty'}
          eyebrow="Marks"
          title={state.status === 'loading' ? 'Marklar yukleniyor' : 'Mark verisi hazir degil'}
          body={state.status === 'loading' ? 'Biraz bekle.' : 'Yeni marklar geldikce burada gorunur.'}
        />
      ) : (
        <>
          {featuredMarks.length > 0 ? (
            <StatusStrip
              tone="sage"
              eyebrow="Vitrin"
              title={`${featuredMarks.length} mark secili`}
              body={topFeaturedTitle || 'Secili marklar hazir.'}
            />
          ) : null}

          {featuredMarks.length > 0 ? (
            <ScreenCard accent="sage">
              <Text style={styles.subSectionLabel}>Vitrin</Text>
              <View style={styles.markPillRow}>
                {featuredMarks.map((markId) => {
                  const markMeta = resolveMobileMarkMeta(markId, language);
                  return (
                    <MobileMarkPill
                      key={`featured-${markId}`}
                      title={resolveMobileMarkTitle(markId, language)}
                      motion={markMeta.motion}
                      isUnlocked
                      isFeatured
                      onPress={() => setActiveMarkId(markId)}
                      accessibilityLabel={`${markMeta.title} mark detayini ac`}
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
              eyebrow="Marks"
              title="Henuz acik mark yok"
              body="Yeni yorumlar ve streak ile koleksiyon dolacak."
            />
          ) : (
            <ScreenCard accent="sage">
              <Text style={styles.subSectionLabel}>
                {mode === 'unlocked' ? 'Kazanilan Marklar' : 'Tum Marklar'}
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
                            title={mark.title}
                            motion={mark.motion}
                            isUnlocked={isUnlocked}
                            isFeatured={isUnlocked && isFeatured}
                            onPress={() => setActiveMarkId(mark.id)}
                            accessibilityLabel={`${mark.title} mark detayini ac`}
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
}: {
  state: PushInboxState;
  showOpsMeta?: boolean;
  onClear: () => void;
  onPressItem: (item: PushInboxItem) => void;
  onOpenDeepLink: (item: PushInboxItem) => void;
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
    return (
      <StatePanel
        tone="sage"
        variant={state.status === 'loading' ? 'loading' : state.status === 'error' ? 'error' : 'empty'}
        eyebrow="Bildirimler"
        title={
          state.status === 'loading'
            ? 'Bildirimler yukleniyor'
            : state.status === 'error'
              ? 'Bildirimler okunamadi'
              : 'Henuz bildirim yok'
        }
        body={
          state.status === 'loading'
            ? 'Bildirim listesi hazirlaniyor.'
            : state.status === 'error'
              ? 'Bildirim listesi gecici olarak acilamadi.'
              : 'Yeni bir bildirim geldiginde burada gorunecek.'
        }
        meta={state.status === 'error' ? state.message : undefined}
      />
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

const CommentFeedCard = ({
  state,
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
        {isMovieFiltering ? 'Secili Film Yorumlari' : showFilters ? 'Tum Yorumlar' : 'Bugunun Yorumlari'}
      </Text>
      <Text style={styles.screenBody}>
        {isMovieFiltering
          ? 'Ana sayfada sadece secili film ile ilgili yorumlar gosterilir.'
          : showFilters
            ? 'Kesfet ekraninda tum akisi filtreleyebilir ve siralayabilirsin.'
            : 'Ana sayfada yalnizca bugun yazilan yorumlar listelenir.'}
      </Text>
      {isMovieFiltering ? (
        <Text style={styles.screenMeta}>
          Film filtresi: {normalizedSelectedMovieTitle || 'Film secimi bekleniyor'}
        </Text>
      ) : null}

      {showFilters ? (
        <>
          <View style={styles.commentFeedFilterStack}>
            <View style={styles.commentFeedControlRow}>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.scope === 'all' && styles.commentFeedSegmentActive]}
                onPress={() => onScopeChange('all')}
                accessibilityLabel="Tum yorumlari goster"
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.scope === 'all' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  Tum Akis
                </Text>
              </Pressable>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.scope === 'today' && styles.commentFeedSegmentActive]}
                onPress={() => onScopeChange('today')}
                accessibilityLabel="Sadece bugun yorumlarini goster"
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.scope === 'today' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  Sadece Bugun
                </Text>
              </Pressable>
            </View>
            <View style={styles.commentFeedControlRow}>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.sort === 'latest' && styles.commentFeedSegmentActive]}
                onPress={() => onSortChange('latest')}
                accessibilityLabel="Yorumlari en yeniye gore sirala"
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.sort === 'latest' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  En Yeni
                </Text>
              </Pressable>
              <Pressable
                style={[styles.commentFeedSegmentOption, state.sort === 'echoes' && styles.commentFeedSegmentActive]}
                onPress={() => onSortChange('echoes')}
                accessibilityLabel="Yorumlari en cok echoya gore sirala"
              >
                <Text
                  style={[styles.commentFeedSegmentText, state.sort === 'echoes' && styles.commentFeedSegmentTextActive]}
                  numberOfLines={1}
                >
                  En Cok Echo
                </Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            style={styles.commentFeedSearchInput}
            value={state.query}
            onChangeText={onQueryChange}
            autoCapitalize="none"
            placeholder="Yorum, film ya da yazar ara..."
            placeholderTextColor="#8e8b84"
            accessibilityLabel="Tum yorumlarda ara"
          />
        </>
      ) : null}

      {waitingMovieSelection ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Film Filtresi"
          title="Once bir film sec"
          body="Ana sayfada secili filme odaklandigin zaman yorum akisi burada sade bir sekilde acilir."
          meta="Film secildiginde yorumlar ve yanitlar bu panelin altinda listelenir."
        />
      ) : isBusy && visibleItems.length === 0 ? (
        <StatePanel
          tone="clay"
          variant="loading"
          eyebrow="Yorum Akisi"
          title="Sosyal akis toparlaniyor"
          body="Yorumlar, echo sayilari ve yanitlar yenileniyor."
          meta={state.message}
        />
      ) : visibleItems.length === 0 ? (
        <StatePanel
          tone="clay"
          variant={state.status === 'error' ? 'error' : 'empty'}
          eyebrow="Yorum Akisi"
          title={state.status === 'error' ? 'Yorumlar alinamadi' : 'Bu filtrede yorum yok'}
          body={
            state.status === 'error'
              ? 'Akis gecici olarak okunamadi. Asagi cekip tekrar deneyebilirsin.'
              : 'Filtreyi degistirerek daha genis bir akis gorebilir ya da yeni yorumlar geldikce burayi tekrar kontrol edebilirsin.'
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
                  {item.isMine ? <Text style={styles.commentFeedMineBadge}>SENIN</Text> : null}
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
                    accessibilityLabel={`${item.author} profilini ac`}
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
                      {resolveMobileLeagueInfo(item.leagueKey || 'Bronze').name}
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
                      accessibilityLabel={`${item.author} yorumuna echo ver`}
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
                        Echo {item.echoCount}
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
                      accessibilityLabel={`${item.author} yorumunun yanitlarini ac`}
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
                        Yanit {item.replyCount}
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
                        accessibilityLabel="Kendi yorumunu sil"
                      >
                        <Ionicons name="trash-outline" size={16} color="#A57164" />
                        <Text
                          style={[
                            styles.commentFeedInlineActionText,
                            styles.commentFeedInlineActionDangerText,
                          ]}
                        >
                          {deleteSubmitting[item.id] ? 'Siliniyor' : 'Sil'}
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
                      <Text style={styles.commentFeedMeta}>Yanitlar yukleniyor...</Text>
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
                      <Text style={styles.commentFeedMeta}>Bu yorum icin henuz yanit yok.</Text>
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
                        placeholder="Yanit yaz..."
                        placeholderTextColor="#8e8b84"
                        maxLength={180}
                        accessibilityLabel={`${item.author} yorumuna yanit yaz`}
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
                        accessibilityLabel={`${item.author} yorumuna yanit gonder`}
                      >
                        <Text style={styles.commentFeedReplySendButtonText}>
                          {replySubmitting[item.id] ? 'Gonderiliyor...' : 'Yanitla'}
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
              state.isAppending ? 'Yorumlar yukleniyor' : 'Yorum akisindan daha fazla kayit yukle'
            }
            accessibilityState={{ disabled: isBusy || state.isAppending || !state.hasMore }}
          >
            <Text style={styles.retryText}>
              {state.isAppending ? 'Yukleniyor...' : 'Daha Fazla Yorum Yukle'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </ScreenCard>
    </KeyboardAvoidingView>
  );
};
const DailyCycleTime = () => {
  const [status, setStatus] = useState({ remaining: '', progress: 0 });

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
        <Text style={styles.cycleTimeTextMode}>Siradaki Secime</Text>
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
}: {
  state: DailyState;
  showOpsMeta?: boolean;
  selectedMovieId?: number | null;
  onSelectMovie?: (movieId: number) => void;
}) => {
  const railRef = useRef<FlatList<DailyMovieRailItem> | null>(null);
  const railScrollOffsetRef = useRef(0);
  const railDragStartOffsetRef = useRef(0);
  const railDragStartXRef = useRef(0);
  const railMovies = state.status === 'success' ? state.movies.slice(0, 5) : [];

  const formatAge = (ageSeconds: number | null): string => {
    if (ageSeconds === null || ageSeconds < 0) return 'bilinmiyor';
    if (ageSeconds < 60) return `${ageSeconds}s`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)} dk`;
    return `${Math.floor(ageSeconds / 3600)} sa`;
  };

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
    if (Platform.OS !== 'web') return null;

    return {
      onMoveShouldSetResponder: (event: { nativeEvent: { pageX: number } }) =>
        Math.abs(event.nativeEvent.pageX - railDragStartXRef.current) > 6,
      onMoveShouldSetResponderCapture: (event: { nativeEvent: { pageX: number } }) =>
        Math.abs(event.nativeEvent.pageX - railDragStartXRef.current) > 6,
      onResponderGrant: (event: { nativeEvent: { pageX: number } }) => {
        railDragStartXRef.current = event.nativeEvent.pageX;
        railDragStartOffsetRef.current = railScrollOffsetRef.current;
      },
      onResponderMove: (event: { nativeEvent: { pageX: number } }) => {
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
      },
      onResponderTerminate: () => {
        snapRailToNearest(railScrollOffsetRef.current);
      },
      onResponderTerminationRequest: () => false,
    };
  }, [railMovies.length, snapRailToNearest]);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow="Gunluk Filmler"
        title="Bugunun filmleri hazirlaniyor"
        body="Secki ve film kartlari yukleniyor."
        meta="Birazdan bugunun onerileri burada acilacak."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="clay"
        variant="error"
        eyebrow="Gunluk Filmler"
        title="Bugunun filmleri simdi acilamadi"
        body="Baglanti veya servis kaynakli gecici bir sorun var. Sayfayi asagi cekerek seckiyi yeniden isteyebilirsin."
        meta={
          showOpsMeta ? `Detay: ${state.message} | Uc nokta: ${state.endpoint || 'yok'}` : state.message
        }
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
        eyebrow="Gunluk Filmler"
        title="Bugun icin film bulunmadi"
        body="Gunluk liste henuz gelmedi. Sayfayi asagi cekerek seckiyi yeniden isteyebilirsin."
        meta={successState.warning || undefined}
      />
    );
  }

  const dataSourceLabel =
    successState.dataSource === 'live'
      ? 'canli'
      : successState.dataSource === 'cache'
        ? 'onbellek'
        : 'fallback';
  // eslint-disable-next-line react-hooks/refs
  const railGestureProps = railResponderHandlers || {};

  return (
    <View style={{ marginBottom: 12 }}>
      <ScreenCard accent="sage">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.screenTitle}>Gunluk Filmler</Text>
            <Text style={[styles.screenBody, { marginTop: 4 }]}>
              {successState.dataSource === 'cache'
                ? 'Baglanti zayif oldugu icin son kaydedilen secki gosteriliyor.'
                : successState.dataSource === 'fallback'
                  ? 'Servise ulasilamadi, yedek film listesi gosteriliyor.'
                  : 'Bugunun secilen filmleri hazir.'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <DailyCycleTime />
        </View>

        <View style={styles.dailyDataSourceRow}>
          <Text style={styles.screenMeta}>Tarih: {successState.date || 'bugun'}</Text>
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
                VERI: {dataSourceLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {showOpsMeta ? <Text style={styles.screenMeta}>Kaynak: {successState.source || 'bilinmiyor'}</Text> : null}
        {showOpsMeta ? <Text style={styles.screenMeta}>Uc nokta: {successState.endpoint}</Text> : null}
        {showOpsMeta ? (
          <View style={styles.badgeRow}>
            <Text style={styles.screenMeta}>Veri: {successState.dataSource}</Text>
            <Text style={styles.screenMeta}>Bayat: {successState.stale ? 'evet' : 'hayir'}</Text>
            {successState.dataSource === 'cache' ? (
              <Text style={styles.screenMeta}>Yas: {formatAge(successState.cacheAgeSeconds)}</Text>
            ) : null}
          </View>
        ) : null}
        {showOpsMeta && successState.warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Veri uyarisi: {successState.warning}
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
                  style={[styles.movieCardWrapper, isSelected ? styles.movieCardWrapperSelected : null]}
                  onPress={() => onSelectMovie?.(movie.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${movie.title} filmini detayli goruntule`}
                >
                  <View style={styles.movieCardPoster}>
                    {posterUri ? (
                      <Image source={{ uri: posterUri }} style={styles.movieCardPosterImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.movieCardPosterFallbackLabel}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.movieCardContentWrapper}>
                    <Text style={styles.movieCardTitleLabel} numberOfLines={2}>
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
            onScroll={(event) => {
              railScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            onMomentumScrollEnd={(event) => snapRailToNearest(event.nativeEvent.contentOffset.x)}
            onScrollEndDrag={(event) => snapRailToNearest(event.nativeEvent.contentOffset.x)}
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
}: {
  movieId: number;
  dateKey?: string | null;
  language: MobileDailyQuizLanguageCode;
  isSignedIn: boolean;
  onStartComment: () => void;
  onRequireAuth?: () => void;
}) => {
  const copy = MOBILE_QUIZ_COPY[language];
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
    () => bundle?.questionsByMovie.find((entry) => entry.movieId === movieId) || null,
    [bundle?.questionsByMovie, movieId]
  );

  const answeredCount = movieBlock?.questions.filter((question) => question.attempt).length || 0;
  const correctCount = movieBlock?.questions.filter((question) => question.attempt?.isCorrect).length || 0;
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
    [bundle, copy.error, isSignedIn, language, submittingQuestionId]
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
              {copy.progress}: {answeredCount}/{movieBlock.questions.length}
            </Text>
            <Text style={styles.dailyQuizSummaryText}>
              {copy.correct}: {correctCount}/{requiredCorrectCount}
            </Text>
            <Text style={styles.dailyQuizSummaryText}>
              {copy.xp}: {bundle?.progress?.xpAwarded || 0}
            </Text>
            {lastXpDelta > 0 ? <Text style={styles.dailyQuizSummaryText}>+{lastXpDelta} XP</Text> : null}
          </View>

          {movieBlock.questions.map((question) => {
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
                <MobileDailyQuizPanel
                  movieId={movie.id}
                  dateKey={movie.dateKey}
                  language={language}
                  isSignedIn={isSignedIn}
                  onStartComment={onOpenCommentComposer}
                  onRequireAuth={onRequireAuth}
                />
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
                body="Seçilen filme ait yorumlar ve yanıtlar yeniden yükleniyor."
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

const PublicProfileMovieArchiveModal = ({
  visible,
  status,
  message,
  displayName,
  movie,
  items,
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
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(movie));
  if (!visible || !movie) return null;

  const posterUri = resolvePosterUrl(movie.posterPath || items[0]?.posterPath || null);
  const profileLabel = String(displayName || '@bilinmeyen').trim() || '@bilinmeyen';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.sectionHeader}>Public Film Arsivi</Text>
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
                      <Text style={styles.movieArchiveBadgeText}>{items.length} yorum kaydi</Text>
                    </View>
                    {movie.watchCount > 1 ? (
                      <View style={styles.movieArchiveBadge}>
                        <Text style={styles.movieArchiveBadgeText}>Tekrar {movie.watchCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.screenMeta}>Profil: {profileLabel}</Text>
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
                eyebrow="Public Arsiv"
                title="Public akis tazeleniyor"
                body="Seçilen kullanıcının bu filme ait yorumları yeniden yükleniyor."
                meta={`${profileLabel} profilinden gelen yorum izi taraniyor.`}
              />
            ) : null}

            {status !== 'loading' && items.length === 0 ? (
              <StatePanel
                tone="clay"
                variant={status === 'error' ? 'error' : 'empty'}
                eyebrow="Public Arsiv"
                title={status === 'error' ? 'Public arsiv okunamadi' : 'Public yorum izine rastlanmadi'}
                body={
                  status === 'error'
                    ? message || 'Public film arsivi okunurken gecici bir sorun olustu.'
                    : 'Bu film icin public yorum kaydi bulunamadi.'
                }
                meta={`${profileLabel} yeni yorum biraktikca bu alan dolacak.`}
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
              <UiButton label="Kapat" tone="neutral" stretch onPress={onClose} />
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
                : 'Birkaç net cümle ile filmin sende biraktigi izi toparla, sonra kaydet.'
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
    sectionMeta: string;
    eyebrow: string;
  };
};

const SETTINGS_GENDER_OPTIONS: Array<{ key: MobileSettingsGender; label: string }> = [
  { key: '', label: 'Seç' },
  { key: 'female', label: 'Kadın' },
  { key: 'male', label: 'Erkek' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' },
];
const SETTINGS_PLATFORM_RULES = [
  'Yorum notlari net, kisa ve konu odakli olmali.',
  'Toksik/nefret dili ve spam icerik kaldirilir.',
  'Ayni davet kodunu kotuye kullanma davranisi engellenir.',
  'Tekrarlayan ihlallerde hesap aksiyonu uygulanabilir.',
];
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
      appearance: 'Görünüm',
      privacy: 'Gizlilik',
      session: 'Oturum',
    },
    appearance: {
      eyebrow: 'Görünüm',
      body: 'Tema ve dil seçimleri ayar yüzeyine anında uygulanır.',
      themeMetric: 'Tema',
      languageMetric: 'Dil',
      livePreviewEyebrow: 'Canlı Önizleme',
      livePreviewTitle: 'Değişiklikler anında görünür',
      livePreviewBody: 'Tema ve dil seçimleri ek kayıt adımı beklemeden uygulanır.',
      themeTitle: 'Tema',
      themeMidnight: 'Gece',
      themeDawn: 'Gündüz',
      themeDescription: 'Cihaz hissine en uygun gece ya da gündüz yüzeyini seç.',
      themeStatusEyebrow: 'Tema Durumu',
      themeStatusBodyMidnight: 'Koyu sinema hissini koruyan gece teması aktif.',
      themeStatusBodyDawn: 'Daha aydınlık ve sıcak tonlu yüzeyler açık.',
      languageTitle: 'Dil',
      languageDescription: 'Arayüz kopyasını tercih ettiğin dile çek. Desteklenen ayar yüzeyleri anında güncellenir.',
      languageStatusEyebrow: 'Dil',
      languageStatusBody: 'Seçili dil desteklenen ayar yüzeylerinde gösteriliyor.',
      languageCoverageMeta: 'Mobil yerelleşme kapsamı ekran bazlı olarak genişlemeye devam eder.',
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
      body: 'Talep yolu, silinen veriler ve saklanan kayıt notları için yayındaki hesap silme sayfasını aç.',
      meta: 'Talebi, hesaba bağlı e-posta ile App Store destek kanalı üzerinden gönder.',
      button: 'Silme Sayfasını Aç',
      sectionMeta: 'Web talep yolu',
      eyebrow: 'Talep Akışı',
    },
  },
  es: {
    settingsTitle: 'Ajustes',
    close: 'Cerrar',
    tabs: {
      identity: 'Identidad',
      appearance: 'Apariencia',
      privacy: 'Privacidad',
      session: 'Sesión',
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
      themeDawn: 'Día',
      themeDescription: 'Elige la superficie nocturna o diurna que mejor encaje con la sensación del dispositivo.',
      themeStatusEyebrow: 'Estado del Tema',
      themeStatusBodyMidnight: 'El tema nocturno mantiene activa la atmósfera más cinematográfica y oscura.',
      themeStatusBodyDawn: 'El tema diurno mueve la superficie de ajustes a un tono más claro y cálido.',
      languageTitle: 'Idioma',
      languageDescription: 'Elige el idioma de interfaz que prefieras. Las superficies de ajustes compatibles se actualizan al instante.',
      languageStatusEyebrow: 'Idioma',
      languageStatusBody: 'El idioma seleccionado se muestra en las superficies de ajustes compatibles.',
      languageCoverageMeta: 'La cobertura de idioma en mobile sigue ampliándose pantalla por pantalla.',
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
      title: 'Eliminación de Cuenta',
      body: 'Abre la página publicada de eliminación para revisar el flujo de solicitud, los datos eliminados y los registros conservados.',
      meta: 'Envía la solicitud desde el correo asociado a la cuenta mediante el canal de soporte de la App Store.',
      button: 'Abrir Página de Eliminación',
      sectionMeta: 'Ruta web de solicitud',
      eyebrow: 'Flujo de Solicitud',
    },
  },
  fr: {
    settingsTitle: 'Réglages',
    close: 'Fermer',
    tabs: {
      identity: 'Identité',
      appearance: 'Apparence',
      privacy: 'Confidentialite',
      session: 'Session',
    },
    appearance: {
      eyebrow: 'Apparence',
      body: 'Les changements de thème et de langue sont appliqués tout de suite à la surface des réglages.',
      themeMetric: 'Thème',
      languageMetric: 'Langue',
      livePreviewEyebrow: 'Aperçu',
      livePreviewTitle: 'Les changements apparaissent tout de suite',
      livePreviewBody: 'Le thème et la langue sont appliqués sans attendre une sauvegarde supplémentaire.',
      themeTitle: 'Thème',
      themeMidnight: 'Nuit',
      themeDawn: 'Jour',
      themeDescription: 'Choisis la surface nuit ou jour qui correspond le mieux au ressenti voulu sur l’appareil.',
      themeStatusEyebrow: 'État du Thème',
      themeStatusBodyMidnight: 'Le thème nuit garde une atmosphère cinéma plus sombre.',
      themeStatusBodyDawn: 'Le thème jour rend la surface des réglages plus claire et plus chaude.',
      languageTitle: 'Langue',
      languageDescription: 'Choisis la langue d’interface que tu préfères. Les surfaces de réglages prises en charge se mettent à jour immédiatement.',
      languageStatusEyebrow: 'Langue',
      languageStatusBody: 'La langue choisie est affichée sur les surfaces de réglages prises en charge.',
      languageCoverageMeta: 'La couverture de langue sur mobile continue de progresser écran par écran.',
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
      body: 'Ouvre la page publiée de suppression pour revoir le parcours de demande, les données supprimées et les données conservées.',
      meta: 'Envoie la demande depuis l’e-mail lié au compte via le canal support de l’App Store.',
      button: 'Ouvrir la Page de Suppression',
      sectionMeta: 'Parcours web de demande',
      eyebrow: 'Parcours de Demande',
    },
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
  onSubmit: () => void;
  onFlushQueue: () => void;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(targetMovie));
  if (!visible || !targetMovie) return null;
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
              <Text style={styles.screenTitle}>Yorum Yaz</Text>
              <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
                <Text style={styles.modalCloseTextBtn}>Kapat</Text>
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
  onOpenAccountDeletion,
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
  onOpenAccountDeletion: () => void;
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
      : normalizedInviteStatus.includes('uygulandı') ||
          normalizedInviteStatus.includes('uygulandi') ||
          normalizedInviteStatus.includes('kopyalandı') ||
          normalizedInviteStatus.includes('kopyalandi')
        ? 'sage'
        : 'muted';
  const identityDisplayName = String(identityDraft.fullName || '').trim();
  const identityUsername = String(identityDraft.username || '')
    .trim()
    .replace(/^@+/, '');
  const identityBirthDate = String(identityDraft.birthDate || '').trim();
  const identityBio = String(identityDraft.bio || '').trim();
  const identityProfileLink = String(identityDraft.profileLink || '').trim();
  const activeGenderLabel =
    SETTINGS_GENDER_OPTIONS.find((option) => option.key === identityDraft.gender)?.label || 'Seç';
  const settingsCopy = MOBILE_SETTINGS_COPY[language] || MOBILE_SETTINGS_COPY.tr;
  const accountDeletionTitle = settingsCopy.accountDeletion.title;
  const accountDeletionBody = settingsCopy.accountDeletion.body;
  const accountDeletionMeta = settingsCopy.accountDeletion.meta;
  const accountDeletionButton = settingsCopy.accountDeletion.button;
  const isPasswordSaving = passwordState.status === 'saving';
  const passwordTone =
    passwordState.status === 'error'
      ? 'clay'
      : passwordState.status === 'success'
        ? 'sage'
        : 'muted';

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
              eyebrow="Durum"
              title={saveTone === 'clay' ? 'Kayit basarisiz' : saveTone === 'sage' ? 'Kayit tamamlandi' : 'Taslak guncellendi'}
              body={saveState.message}
              meta={
                isSignedIn
                  ? 'Degisikliklerin hesabinla saklanir.'
                  : 'Kaydetmek icin once giris yap.'
              }
            />
          ) : null}

          <ScrollView contentContainerStyle={styles.modalSheetScroll}>
            {activeTab === 'identity' ? (
              <>
                <SectionLeadCard
                  accent="clay"
                  eyebrow="Profil"
                  title={identityDisplayName || 'Profil Kimligi'}
                  body={identityBio || 'Profilini duzenle.'}
                  badges={[
                    {
                      label: identityUsername ? `@${identityUsername}` : 'kullanici adi bekleniyor',
                      tone: identityUsername ? 'sage' : 'muted',
                    },
                    {
                      label: identityDraft.avatarUrl ? 'Avatar hazir' : 'Avatar bos',
                      tone: identityDraft.avatarUrl ? 'sage' : 'muted',
                    },
                    { label: activeGenderLabel, tone: 'muted' },
                  ]}
                  metrics={[
                    { label: 'Yazi', value: String(identityBio.length) },
                    { label: 'Profil', value: identityProfileLink ? 'hazir' : '--' },
                    { label: 'Dogum', value: identityBirthDate ? 'var' : '--' },
                  ]}
                />

                {!isSignedIn ? (
                  <StatusStrip
                    tone="muted"
                    eyebrow="Kayit"
                    title="Taslak hazir"
                    body="Kaydetmek icin giris yap."
                  />
                ) : null}

                <CollapsibleSectionCard
                  accent="clay"
                  title="Avatar ve Temel Bilgiler"
                  meta={identityUsername ? `@${identityUsername}` : 'Profil girisi'}
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
                        label={isPickingAvatar ? 'Seçiliyor...' : 'Cihazdan Seç'}
                        tone="neutral"
                        onPress={onPickAvatar}
                        disabled={isPickingAvatar || !isSignedIn}
                        style={styles.exploreRouteAction}
                      />
                      <UiButton
                        label="Temizle"
                        tone="neutral"
                        onPress={onClearAvatar}
                        disabled={isPickingAvatar || !identityDraft.avatarUrl || !isSignedIn}
                        style={styles.exploreRouteAction}
                      />
                    </View>
                  </View>

                  <StatusStrip
                    tone={identityDraft.avatarUrl ? 'sage' : 'muted'}
                    eyebrow="Avatar"
                    title={identityDraft.avatarUrl ? 'Avatar secildi' : 'Avatar opsiyonel'}
                    body={
                      identityDraft.avatarUrl
                        ? 'Profilinde kullanilacak.'
                        : 'Istersen bos birak.'
                    }
                  />

                  <TextInput
                    style={styles.input}
                    value={identityDraft.fullName}
                    onChangeText={(value) => onChangeIdentity({ fullName: value })}
                    placeholder="Ad Soyad"
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="words"
                    accessibilityLabel="Ad Soyad"
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.username}
                    onChangeText={(value) => onChangeIdentity({ username: value.replace(/\s+/g, '').toLowerCase() })}
                    placeholder="Kullanici adi"
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel="Kullanici adi"
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.birthDate}
                    onChangeText={(value) => onChangeIdentity({ birthDate: value })}
                    placeholder="Doğum tarihi (GG/AA/YYYY)"
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel="Doğum tarihi"
                  />

                  <View style={styles.detailInfoGrid}>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>Kullanici</Text>
                      <Text style={styles.detailInfoValue}>
                        {identityUsername ? `@${identityUsername}` : 'Kullanici adi bekleniyor'}
                      </Text>
                    </View>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>Doğum</Text>
                      <Text style={styles.detailInfoValue}>
                        {identityBirthDate || 'Henuz dogum tarihi girilmedi'}
                      </Text>
                    </View>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>Cinsiyet</Text>
                      <Text style={styles.detailInfoValue}>{activeGenderLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.subSectionLabel}>Cinsiyet</Text>
                  <View style={styles.settingsGenderRow}>
                    {SETTINGS_GENDER_OPTIONS.map((option) => (
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
                  title="Hakkimda ve Profil Linki"
                  meta={`${identityBio.length}/180 karakter`}
                  defaultExpanded
                >
                  <TextInput
                    style={styles.ritualInput}
                    multiline
                    textAlignVertical="top"
                    value={identityDraft.bio}
                    onChangeText={(value) => onChangeIdentity({ bio: value.slice(0, 180) })}
                    placeholder="Hakkimda (maks 180)"
                    placeholderTextColor="#8e8b84"
                    accessibilityLabel="Hakkimda"
                  />
                  <TextInput
                    style={styles.input}
                    value={identityDraft.profileLink}
                    onChangeText={(value) => onChangeIdentity({ profileLink: value })}
                    placeholder="Web sitesi veya sosyal profil URL"
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel="Profil Linki"
                  />

                  <StatusStrip
                    tone={identityProfileLink ? 'sage' : 'muted'}
                    eyebrow="Profil Linki"
                    title={identityProfileLink ? 'Link hazir' : 'Link opsiyonel'}
                    body={
                      identityProfileLink
                        ? identityProfileLink
                        : 'Istersen profiline link ekle.'
                    }
                  />

                  <UiButton
                    label={isSaving ? 'Kaydediliyor...' : 'Kimligi Kaydet'}
                    tone="brand"
                    onPress={onSaveIdentity}
                    disabled={isSaving || !isSignedIn}
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title="Letterboxd"
                  meta={letterboxdSummary || 'Import et'}
                  defaultExpanded={false}
                >
                  {!isSignedIn ? (
                    <StatePanel
                      tone="clay"
                      variant="empty"
                      eyebrow="Letterboxd"
                      title="Import icin giris yap"
                      body="CSV dosyani hesabinla ekle."
                    />
                  ) : (
                    <>
                      <StatusStrip
                        tone={letterboxdSummary ? 'sage' : 'muted'}
                        eyebrow="Import"
                        title={letterboxdSummary || 'Henuz import yok'}
                        body={letterboxdStatus || 'CSV sec ve ekle.'}
                      />
                      <UiButton
                        label={isImportingLetterboxd ? 'Import ediliyor...' : 'Letterboxd CSV Sec'}
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
                  eyebrow="Gizlilik"
                  title="Public profil gorunurlugu"
                  body="Gorunen alanlari sec."
                  badges={[
                    {
                      label: privacyDraft.showStats ? 'Istatistik acik' : 'Istatistik gizli',
                      tone: privacyDraft.showStats ? 'sage' : 'clay',
                    },
                    {
                      label: privacyDraft.showFollowCounts ? 'Takip acik' : 'Takip gizli',
                      tone: privacyDraft.showFollowCounts ? 'sage' : 'clay',
                    },
                  ]}
                  metrics={[
                    { label: 'Mark', value: privacyDraft.showMarks ? 'acik' : 'gizli' },
                    { label: 'Takip', value: privacyDraft.showFollowCounts ? 'acik' : 'gizli' },
                  ]}
                />

                {([
                  {
                    key: 'showStats',
                    title: 'Istatistikleri goster',
                    body: 'Yorum, streak ve gun ozetini goster.',
                  },
                  {
                    key: 'showFollowCounts',
                    title: 'Takip sayilarini goster',
                    body: 'Takip ve takipci sayilari gorunsun.',
                  },
                  {
                    key: 'showMarks',
                    title: 'Marklari goster',
                    body: 'Acik marklar profilde gorunsun.',
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
                  label={isSaving ? 'Kaydediliyor...' : 'Gizliligi Kaydet'}
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
                  meta={settingsCopy.accountDeletion.sectionMeta}
                  defaultExpanded
                >
                  <StatusStrip
                    tone="muted"
                    eyebrow={settingsCopy.accountDeletion.eyebrow}
                    title={accountDeletionTitle}
                    body={accountDeletionBody}
                    meta={accountDeletionMeta}
                  />

                  <UiButton
                    label={accountDeletionButton}
                    tone="neutral"
                    onPress={onOpenAccountDeletion}
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="clay"
                  title="Platform Kurallari"
                  meta="Topluluk notlari"
                  defaultExpanded={false}
                >
                  <Text style={styles.screenBody}>
                    Topluluk guvenligi ve kalite standartlari bu ayar panelinde de gorunur.
                  </Text>
                  <View style={styles.rulesList}>
                    {SETTINGS_PLATFORM_RULES.map((rule, index) => (
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
}: {
  inviteCode?: string;
  claimState: InviteClaimState;
  onClaim: (inviteCode: string) => void;
}) => {
  const isLoading = claimState.status === 'loading';
  const hasInviteCode = Boolean(inviteCode);

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Invite Gateway"
        title="Davet Onayi"
        body="Kodu onayla."
        badges={[
          { label: hasInviteCode ? `Kod ${inviteCode}` : 'Kod yok', tone: hasInviteCode ? 'sage' : 'clay' },
          { label: claimState.status, tone: claimState.status === 'error' ? 'clay' : 'muted' },
        ]}
        actions={
          hasInviteCode
            ? [
                {
                  label: isLoading ? 'Kontrol ediliyor...' : 'Davet Kodunu Uygula',
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
          eyebrow="Invite Link"
          title="Kod bulunamadi"
          body="Yeni bir davet linkiyle tekrar dene."
        />
      ) : null}

      {claimState.status === 'loading' ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow="Invite Claim"
          title="Kod dogrulaniyor"
          body="Biraz bekle."
          meta={`Kod: ${inviteCode}`}
        />
      ) : null}

      {claimState.status === 'success' ? (
        <ScreenCard accent="sage">
          <Text style={styles.sectionLeadTitle}>Ödül uygulandı</Text>
          <Text style={styles.sectionLeadBody}>{claimState.message}</Text>
          <View style={styles.sectionLeadMetricRow}>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviteeRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Sen</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviterRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Davet Eden</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>{claimState.claimCount}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Toplam</Text>
            </View>
          </View>
        </ScreenCard>
      ) : null}

      {claimState.status === 'error' ? (
        <StatePanel
          tone="clay"
          variant="error"
          eyebrow="Invite Claim"
          title="Kod uygulanamadi"
          body={claimState.message}
          meta={claimState.errorCode ? `Kod: ${claimState.errorCode}` : undefined}
          actionLabel="Tekrar Dene"
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
}) => {
  const normalizedGoal = goal === 'streak' ? 'streak' : 'comment';
  const normalizedPlatform =
    platform === 'instagram' || platform === 'tiktok' || platform === 'x' ? platform : undefined;
  const hasInviteLink = Boolean(String(inviteLink || '').trim());
  const safeStreak = Math.max(0, Number(streakValue || 0));

  const title =
    normalizedGoal === 'streak'
      ? 'Streak Paylasimi'
      : normalizedGoal === 'comment'
        ? 'Yorum Paylasimi'
        : 'Paylasim Merkezi';

  const body =
    normalizedGoal === 'streak'
      ? 'Streak paylas.'
      : normalizedGoal === 'comment'
        ? 'Yorumunu paylas.'
        : 'Paylasim hazir.';
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
        eyebrow="Share Hub"
        title={title}
        body={body}
        badges={[
          { label: normalizedGoal === 'streak' ? 'Streak modu' : 'Yorum modu', tone: normalizedGoal === 'streak' ? 'clay' : 'sage' },
          { label: normalizedPlatform || 'platform sec', tone: 'muted' },
          { label: inviteCode ? `Kod ${inviteCode}` : 'Kod yok', tone: inviteCode ? 'muted' : 'clay' },
          { label: hasInviteLink ? 'link hazir' : 'link yok', tone: hasInviteLink ? 'muted' : 'clay' },
        ]}
        metrics={[
          { label: 'Streak', value: String(safeStreak) },
          { label: 'Hazir', value: canShareSelectedGoal ? 'evet' : 'hayir' },
          { label: 'Platform', value: normalizedPlatform || '--' },
        ]}
      />

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>Hedef</Text>
        <View style={styles.themeModeSegmentContainer}>
          <Pressable
            style={[
              styles.themeModeSegmentOption,
              normalizedGoal === 'comment' ? styles.themeModeSegmentActiveMidnight : null,
            ]}
            onPress={() => onSetGoal('comment')}
            accessibilityRole="button"
            accessibilityLabel="Yorum paylasimini sec"
          >
            <Text
              style={[
                styles.themeModeSegmentText,
                normalizedGoal === 'comment' ? styles.themeModeSegmentTextActiveMidnight : null,
              ]}
            >
              Yorum Paylas
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.themeModeSegmentOption,
              normalizedGoal === 'streak' ? styles.themeModeSegmentActiveMidnight : null,
            ]}
            onPress={() => onSetGoal('streak')}
            accessibilityRole="button"
            accessibilityLabel="Streak paylasimini sec"
          >
            <Text
              style={[
                styles.themeModeSegmentText,
                normalizedGoal === 'streak' ? styles.themeModeSegmentTextActiveMidnight : null,
              ]}
            >
              Streak Paylas
            </Text>
          </Pressable>
        </View>

        {canShareSelectedGoal ? (
          <StatusStrip
            tone="sage"
            eyebrow="Preview"
            title={normalizedGoal === 'streak' ? 'Streak paketi hazir' : 'Yorum paketi hazir'}
            body={
              normalizedGoal === 'streak'
                ? `Bugunku streak tamamlandi: ${safeStreak} gun`
                : `"${commentPreview}"`
            }
            meta={inviteCode ? `Davet kodu: ${inviteCode}` : undefined}
          />
        ) : (
          <StatePanel
            tone="clay"
            variant="empty"
            eyebrow="Share Readiness"
            title={normalizedGoal === 'comment' ? 'Yorum paylasimi henuz hazir degil' : 'Streak paketi henuz hazir degil'}
            body={
              normalizedGoal === 'comment'
                ? 'Paylasim icin bugun bir yorumun olmali.'
                : 'Streak paylasimi icin bugunku yorum ve aktif streak gerekiyor.'
            }
          />
        )}
      </ScreenCard>

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>Platform</Text>
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
          eyebrow="Share Status"
          body={shareStatus}
          meta={canShareSelectedGoal ? undefined : 'Hedef hazir degil.'}
        />
        <Text style={[styles.screenMeta, statusStyle]}>
          {normalizedPlatform ? `Secili platform: ${normalizedPlatform}` : 'Henuz platform secilmedi.'}
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

const DiscoverRoutesCard = ({
  routes,
  onOpenRoute,
}: {
  routes: DiscoverRouteItem[];
  onOpenRoute: (route: DiscoverRouteItem) => void;
}) => {
  const readyCount = routes.filter((route) => Boolean(route.href)).length;

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Explore Routes"
        title="Kesif Rotalari"
        body="Kategori secip ilgili rotayi ac."
        badges={[
          { label: `${routes.length} rota`, tone: 'sage' },
          { label: `${readyCount} hazir`, tone: readyCount > 0 ? 'sage' : 'clay' },
        ]}
        metrics={[
          { label: 'Hazir', value: String(readyCount) },
          { label: 'Beklemede', value: String(Math.max(0, routes.length - readyCount)) },
        ]}
      />

      {routes.length === 0 ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Kesif"
          title="Henuz rota gelmedi"
          body="Kesif rotalari yuklendiginde bu alanda kategori bazli giris kartlari gorunecek."
          meta="Web kaynaklari veya route envanteri tekrar senkronlandiginda dolacak."
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
                  eyebrow="Route State"
                  title={route.href ? 'Rota acilmaya hazir' : 'URL konfigrasyonu bekleniyor'}
                  body={
                    route.href
                      ? 'Bu rota mobil yuzeyin icindeki kesif katmaninda acilir.'
                      : 'Bu rota icin web URL konfigrasyonu tamamlanmamis.'
                  }
                  meta={route.href || undefined}
                />
              </View>
              <UiButton
                label={route.href ? 'Ac' : 'Bekle'}
                tone={route.href ? 'brand' : 'neutral'}
                onPress={() => onOpenRoute(route)}
                style={styles.exploreRouteAction}
                accessibilityLabel={`${route.title} rotasini ac`}
                disabled={!route.href}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );
};

const ArenaChallengeCard = ({
  streakLabel,
  ritualsLabel,
  onOpenDaily,
}: {
  streakLabel: string;
  ritualsLabel: string;
  onOpenDaily?: () => void;
}) => (
  <>
    <SectionLeadCard
      accent="clay"
      eyebrow="Arena Pulse"
      title="Haftalik challenge nabzi"
      body="Gunluk yorum ritmi, aktif seri ve sosyal akis Arena tablosundaki yerini belirler."
      badges={[
        { label: `Seri ${streakLabel}`, tone: 'sage' },
        { label: `Yorum ${ritualsLabel}`, tone: 'muted' },
        { label: 'haftalik tempo', tone: 'clay' },
      ]}
      metrics={[
        { label: 'Seri', value: streakLabel },
        { label: 'Yorum', value: ritualsLabel },
        { label: 'Mod', value: 'Haftalik' },
      ]}
      actions={onOpenDaily ? [{ label: 'Gunluk Akisa Gec', tone: 'brand', onPress: onOpenDaily }] : undefined}
    />
    <StatusStrip
      tone="clay"
      eyebrow="Arena Rhythm"
      title="Challenge skoru gunluk ritimden beslenir"
      body="Bugunku yorumunu birak, yorum akisinda echo al ve haftalik leaderboarddaki ivmeni koru."
      meta="Canli ya da fallback siralama asagidaki leaderboard kartinda guncellenir."
    />
  </>
);

const ArenaLeaderboardCard = ({
  state,
  onOpenProfile,
}: {
  state: ArenaLeaderboardState;
  onOpenProfile: (item: ArenaLeaderboardItem) => void;
}) => (
  <>
    <SectionLeadCard
      accent="sage"
      eyebrow="Arena Board"
      title="Arena Leaderboard"
      body="Son yorum aktivitesinden uretilen haftalik siralama. Nick uzerine dokunarak profili ac."
      badges={[
        { label: `${state.entries.length} oyuncu`, tone: 'muted' },
      ]}
      metrics={[{ label: 'Durum', value: state.status === 'loading' ? 'Hazirlaniyor' : 'Haftalik' }]}
    />

    {state.status === 'loading' && state.entries.length === 0 ? (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow="Arena"
        title="Haftalik siralama yukleniyor"
        body="Canli yorum aktivitesi ve profil gecisleri toparlaniyor."
      />
    ) : null}

    {state.entries.length === 0 && state.status !== 'loading' ? (
      <StatePanel
        tone={state.status === 'error' ? 'clay' : 'sage'}
        variant={state.status === 'error' ? 'error' : 'empty'}
        eyebrow="Arena"
        title={state.status === 'error' ? 'Arena tablosu acilamadi' : 'Bu hafta henuz arena izi yok'}
        body={
          state.status === 'error'
            ? 'Siralama okunurken gecici bir sorun olustu.'
            : 'Yeni yorum ve echo hareketleri geldikce arena siralamasi burada gorunecek.'
        }
      />
    ) : null}

    {state.entries.length > 0 ? (
      <View style={styles.arenaLeaderboardList}>
        {state.entries.map((item) => {
          const canOpenProfile = Boolean(
            String(item.userId || '').trim() || String(item.displayName || '').trim()
          );
          return (
            <View key={`${item.rank}-${item.displayName}`} style={styles.arenaLeaderboardRow}>
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
              <View style={styles.arenaLeaderboardContent}>
                <Pressable
                  onPress={() => onOpenProfile(item)}
                  disabled={!canOpenProfile}
                  hitSlop={PRESSABLE_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName} profilini ac`}
                >
                  <Text style={styles.arenaLeaderboardName}>{item.displayName}</Text>
                </Pressable>
                <Text style={styles.arenaLeaderboardMeta}>
                  Yorum {item.ritualsCount} | Echo {item.echoCount}
                </Text>
              </View>
              <UiButton
                label={canOpenProfile ? 'Profil' : 'Kilitli'}
                tone={canOpenProfile ? 'neutral' : 'danger'}
                onPress={() => onOpenProfile(item)}
                disabled={!canOpenProfile}
                style={styles.arenaLeaderboardAction}
                accessibilityLabel={`${item.displayName} profiline git`}
              />
            </View>
          );
        })}
      </View>
    ) : null}
  </>
);

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
      <Text style={styles.sectionLeadTitle}>Public Profil</Text>
      <Text style={styles.sectionLeadBody}>@kullanici ile ac.</Text>

      <TextInput
        style={styles.publicProfileInput}
        value={profileInput}
        onChangeText={onProfileInputChange}
        autoCapitalize="none"
        placeholder="kullanici-adi"
        placeholderTextColor="#8e8b84"
        accessibilityLabel="Public profile kullanici adi"
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
        accessibilityLabel="Public profile ac"
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

  return (
    <>
      <SectionLeadCard
        accent="clay"
        eyebrow="Public Detail"
        title={profileDisplayName || '@bilinmeyen'}
        body={status === 'loading' ? 'Profil yukleniyor...' : 'Public profil ozeti.'}
        badges={[
          { label: status, tone: status === 'error' ? 'clay' : status === 'ready' ? 'sage' : 'muted' },
          ...(isSelfProfile ? [{ label: 'kendi profilin', tone: 'muted' as const }] : []),
          ...(!isSelfProfile && followsYou ? [{ label: 'seni takip ediyor', tone: 'sage' as const }] : []),
        ]}
        metrics={[
          { label: 'Yorum', value: String(ritualsCount) },
          { label: 'Takip', value: String(followingCount) },
          { label: 'Takipci', value: String(followersCount) },
        ]}
        actions={[
          {
            label: 'Profili Tam Ac',
            tone: 'brand',
            onPress: onOpenFullProfile,
          },
          {
            label: 'Kapat',
            tone: 'neutral',
            onPress: onBack,
          },
        ]}
      />

      {status === 'loading' && !profile ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow="Public Profil"
          title="Profil yukleniyor"
          body="Biraz bekle."
        />
      ) : null}

      {status === 'error' && !profile ? (
        <StatePanel
          tone="clay"
          variant="error"
          eyebrow="Public Profil"
          title="Profil acilamadi"
          body={message}
        />
      ) : null}

      {profile ? (
        <ScreenCard accent="sage">
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
                  {(profileDisplayName.slice(0, 1) || 'O').toUpperCase()}
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

          <Text style={styles.subSectionLabel}>Ozet</Text>
          <View style={styles.detailInfoGrid}>
            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>Yorum</Text>
              <Text style={styles.detailInfoValue}>{ritualsCount}</Text>
            </View>
            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>Takip</Text>
              <Text style={styles.detailInfoValue}>{followingCount}</Text>
            </View>
            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>Takipci</Text>
              <Text style={styles.detailInfoValue}>{followersCount}</Text>
            </View>
          </View>

          <StatusStrip
            tone={followTone}
            eyebrow="Takip"
            title={
              isSelfProfile
                ? 'Bu profil sana ait'
                : isFollowing
                  ? 'Takip durumu aktif'
                  : 'Takip durumu acik'
            }
            body={
              followMessage ||
              (isSelfProfile
                ? 'Takip islemi gosterilmez.'
                : isSignedIn
                  ? 'Istersen takip edebilirsin.'
                  : 'Takip icin giris yap.')
            }
            meta={!isSelfProfile && followsYou ? 'Bu kisi seni takip ediyor.' : undefined}
          />

          {!isSelfProfile && isSignedIn ? (
            <UiButton
              label={isFollowBusy ? 'Isleniyor...' : isFollowing ? 'Takipten Cik' : 'Takip Et'}
              tone={isFollowing ? 'danger' : 'brand'}
              onPress={onToggleFollow}
              disabled={isFollowBusy || !profile}
            />
          ) : null}
        </ScreenCard>
      ) : null}
    </>
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
        eyebrow="Policy Layer"
        title="Platform Kurallari"
        body="Webdeki manifesto ve topluluk cizgisi mobile de ayni cekirdek prensiplerle isler."
        badges={[
          { label: `${rules.length} ilke`, tone: 'sage' },
          { label: 'manifesto parity', tone: 'muted' },
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
