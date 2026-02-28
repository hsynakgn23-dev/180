import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  FlatList,
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
import {
  MOBILE_MARK_CATALOG,
  groupMobileMarksByCategory,
  resolveMobileMarkMeta,
  resolveMobileMarkTitle,
} from '../lib/mobileMarksCatalog';
import { type PushInboxItem } from '../lib/mobilePushInbox';
import { isSupabaseConfigured } from '../lib/supabase';
import type { MobileThemeMode } from '../lib/mobileThemeMode';
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

const PRESSABLE_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const SUPPORTS_NATIVE_DRIVER = Platform.OS !== 'web';
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

export type MobileLeaguePromotionEvent = {
  leagueKey: string;
  leagueName: string;
  leagueColor: string;
  previousLeagueKey?: string | null;
};

const LeaguePromotionModal = ({
  event,
  onClose,
}: {
  event: MobileLeaguePromotionEvent | null;
  onClose: () => void;
}) => {
  useWebModalFocusReset(Boolean(event));
  if (!event) return null;

  const accentColor = String(event.leagueColor || '#8A9A5B').trim() || '#8A9A5B';

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
          <Text style={styles.leagueTransitionEyebrow}>League Advanced</Text>
          <Text style={[styles.leagueTransitionLeagueName, { color: accentColor }]}>
            {event.leagueName || event.leagueKey}
          </Text>
          <Text style={styles.leagueTransitionBody}>
            Tebrikler. Toplam XP seviyen yeni lige yukseldi.
          </Text>
          {event.previousLeagueKey ? (
            <Text style={styles.leagueTransitionMeta}>
              {event.previousLeagueKey}
              {' -> '}
              {event.leagueKey}
            </Text>
          ) : null}
          <Pressable
            style={styles.leagueTransitionButton}
            onPress={onClose}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Lig atlama ekranini tamamla"
          >
            <Text style={styles.leagueTransitionButtonText}>Tamam</Text>
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

const AuthCard = ({
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
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
  onSignOut,
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
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
  onSignOut: () => void;
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
          <UiButton label="Cikis Yap" tone="danger" onPress={onSignOut} disabled={isBusy} />
        </View>
      )}
    </ScreenCard>
  );
};

const AuthModal = ({
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
  onGoogleSignIn,
  onRequestPasswordReset,
  onCompletePasswordReset,
  onSignOut,
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
  onGoogleSignIn: () => void;
  onRequestPasswordReset: () => void;
  onCompletePasswordReset: () => void;
  onSignOut: () => void;
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
              <AuthCard
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
                onGoogleSignIn={onGoogleSignIn}
                onRequestPasswordReset={onRequestPasswordReset}
                onCompletePasswordReset={onCompletePasswordReset}
                onSignOut={onSignOut}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ProfileSnapshotCard = ({
  state,
  isSignedIn,
  onRefresh,
}: {
  state: ProfileState;
  isSignedIn: boolean;
  onRefresh: () => void;
}) => {
  const isRefreshing = state.status === 'loading';

  return (
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Profil Ozeti</Text>
      <Text style={styles.screenBody}>
        Mobilde streak ve profil metriklerinin cloud senkron durumunu hizli kontrol et.
      </Text>

      {!isSignedIn ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Profil metrikleri icin once Session kartindan giris yap.
        </Text>
      ) : null}

      {state.status === 'success' ? (
        <>
          <Text style={styles.screenMeta}>User: {state.displayName}</Text>
          <Text style={styles.screenMeta}>Source: {state.source}</Text>
          <Text style={styles.screenMeta}>League: {state.leagueKey}</Text>
          <Text style={styles.screenMeta}>Last ritual day: {state.lastRitualDate || 'none'}</Text>
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
              <Text style={styles.profileMetricLabel}>Rituals</Text>
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

      <Pressable
        style={[styles.retryButton, !isSignedIn || isRefreshing ? styles.claimButtonDisabled : null]}
        disabled={!isSignedIn || isRefreshing}
        onPress={onRefresh}
        hitSlop={PRESSABLE_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={isRefreshing ? 'Profil yukleniyor' : 'Profili yenile'}
        accessibilityState={{ disabled: !isSignedIn || isRefreshing }}
      >
        <Text style={styles.retryText}>{isRefreshing ? 'Yukleniyor...' : 'Profili Yenile'}</Text>
      </Pressable>
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
      Gece/Gunduz altyapisi mobile eklendi. Tasarim katmani bu secimi referans alacak.
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
        accessibilityLabel="Gunduz modunu sec"
      >
        <Text
          style={[
            styles.themeModeSegmentText,
            mode === 'dawn' && styles.themeModeSegmentTextActiveDawn,
          ]}
        >
          Gunduz Modu
        </Text>
      </Pressable>
    </View>
  </ScreenCard>
);

const ProfileIdentityCard = ({
  displayName,
  username,
  bio,
  birthDateLabel,
  followingCount,
  followersCount,
  profileLink,
  onOpenProfileLink,
}: {
  displayName: string;
  username?: string;
  bio?: string;
  birthDateLabel?: string;
  followingCount: number;
  followersCount: number;
  profileLink?: string;
  onOpenProfileLink?: () => void;
}) => {
  const normalizedDisplayName = String(displayName || '').trim() || 'Observer';
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
  onRefresh,
}: {
  items: Array<{ genre: string; count: number }>;
  isSignedIn: boolean;
  onRefresh: () => void;
}) => {
  const topGenre = items[0];
  const totalCount = items.reduce((sum, item) => sum + Math.max(0, Number(item.count || 0)), 0);

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Taste Map"
        title="Tur Dagilimi"
        body="Ritual kayitlarindan cikan baskin tur izi. Profilin hangi sinema damarinda aktigini hizli gosterir."
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
        actions={[
          {
            label: isSignedIn ? 'Dagilimi Yenile' : 'Oturum Bekleniyor',
            tone: 'neutral',
            onPress: onRefresh,
            disabled: !isSignedIn,
          },
        ]}
      />

      {!isSignedIn ? (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Genre"
          title="Tur haritasi icin oturum ac"
          body="Tur dagilimi, profiline yazilan ritual verileri uzerinden hesaplanir."
          meta="Giris yaptiginda bu alan favori eksenlerini otomatik olarak listeler."
        />
      ) : items.length === 0 ? (
        <StatePanel
          tone="sage"
          variant="empty"
          eyebrow="Genre"
          title="Henuz dagilim olusmadi"
          body="Farkli turlerde ritual biraktikca burada baskin sinema haritan gorunecek."
          meta="Veri geldikten sonra en guclu bes kategori listelenir."
          actionLabel="Dagilimi Yenile"
          onAction={onRefresh}
        />
      ) : (
        <>
          <StatusStrip
            tone="sage"
            eyebrow="Taste Pulse"
            title={`${topGenre?.genre || 'Baskin tur'} onde gidiyor`}
            body={`Toplam ${totalCount} ritual kaydi icinde en guclu genre izi ${topGenre?.genre || 'belirsiz'}.`}
            meta="Bu dagilim yeni yorumlar geldikce profil tarafinda yenilenir."
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
  onRefresh,
  onOpenMovieArchive,
}: {
  state: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    message: string;
    items: MobileWatchedMovie[];
  };
  isSignedIn: boolean;
  onRefresh: () => void;
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
        body="Yazdigin ritual notlari film bazli bir arsive donusur. Satira dokunarak ilgili yorum arsivini ac."
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
        actions={[
          {
            label: state.status === 'loading' ? 'Yukleniyor...' : 'Arsivi Yenile',
            tone: 'neutral',
            onPress: onRefresh,
            disabled: !isSignedIn || state.status === 'loading',
          },
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
            : 'Film satirina dokununca ilgili yorum arsivi acilir.'
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
              ? 'Film bazli arsiv, mobil session ve ritual kayitlari ile olusur.'
              : state.status === 'error'
                ? state.message || 'Film arsivi okunurken gecici bir sorun olustu.'
                : state.message || 'Yazdigin yorumlar geldikce burada film bazli bir arsiv olusur.'
          }
          meta="Film satirina dokununca o filme ait yorum ve yanit arsivi acilir."
          actionLabel={!isSignedIn || state.status === 'loading' ? undefined : 'Izlenen Filmleri Yenile'}
          onAction={!isSignedIn || state.status === 'loading' ? undefined : onRefresh}
        />
      ) : (
        <ScreenCard accent="sage">
          <Text style={styles.subSectionLabel}>Son Izler</Text>
          <View style={styles.movieList}>
            {state.items.slice(0, 20).map((movie) => (
              <Pressable
                key={movie.id}
                style={({ pressed }) => [styles.movieRow, pressed ? styles.movieRowPressed : null]}
                onPress={() => onOpenMovieArchive(movie)}
                hitSlop={PRESSABLE_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`${movie.movieTitle} film arsivini ac`}
              >
                <Text style={styles.movieTitle}>{movie.movieTitle}</Text>
                <Text style={styles.movieMeta}>
                  {movie.year ? `${movie.year} | ` : ''}
                  Son izleme: {movie.watchedDayKey || '-'}
                  {movie.watchCount > 1 ? ` | Tekrar: ${movie.watchCount}` : ''}
                </Text>
                <Text style={styles.movieRowActionHint}>Yorum Arsivini Ac</Text>
              </Pressable>
            ))}
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
}: {
  title: string;
  motion: string;
  isUnlocked: boolean;
  isFeatured: boolean;
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

  return (
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
};

const ProfileMarksCard = ({
  state,
  isSignedIn,
  mode = 'all',
}: {
  state: ProfileState;
  isSignedIn: boolean;
  mode?: 'all' | 'unlocked';
}) => {
  const unlockedMarks = state.status === 'success' ? state.marks : [];
  const featuredMarks = state.status === 'success' ? state.featuredMarks : [];
  const unlockedSet = useMemo(() => new Set(unlockedMarks), [unlockedMarks]);
  const groupedUnlockedMarks = useMemo(
    () => groupMobileMarksByCategory(unlockedMarks),
    [unlockedMarks]
  );
  const groupedCatalogMarks = useMemo(
    () => groupMobileMarksByCategory(MOBILE_MARK_CATALOG.map((mark) => mark.id)),
    []
  );

  return (
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Mark Arsivi</Text>
      <Text style={styles.screenBody}>
        Toplanan tum 180AC DNA parcalari ve onur nisani marklar burada listelenir.
      </Text>
      {!isSignedIn ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Koleksiyonunu gormek icin oturum acmalisin.
        </Text>
      ) : null}
      {state.status === 'success' ? (
        <>
          <View style={styles.profileGrid}>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{unlockedMarks.length}</Text>
              <Text style={styles.profileMetricLabel}>Koleksiyon</Text>
            </View>
            <View style={styles.profileMetricCard}>
              <Text style={styles.profileMetricValue}>{featuredMarks.length}</Text>
              <Text style={styles.profileMetricLabel}>Vitrin</Text>
            </View>
          </View>

          <View style={styles.markCategoryBlock}>
            <Text style={styles.markCategoryTitle}>Ozellesmis Vitrin</Text>
            {featuredMarks.length === 0 ? (
              <Text style={styles.screenMeta}>Vitrine hic mark secilmemis.</Text>
            ) : (
              <View style={styles.markPillRow}>
                {featuredMarks.map((markId) => {
                  const markMeta = resolveMobileMarkMeta(markId);
                  return (
                    <MobileMarkPill
                      key={`featured-${markId}`}
                      title={resolveMobileMarkTitle(markId)}
                      motion={markMeta.motion}
                      isUnlocked
                      isFeatured
                    />
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.markCategoryBlock}>
            <Text style={styles.markCategoryTitle}>
              {mode === 'unlocked' ? 'Kazanilan Marklar' : 'Tum Marklar'}
            </Text>
            {mode === 'unlocked' && unlockedMarks.length === 0 ? (
              <Text style={styles.screenMeta}>Henuz kazanilan mark yok.</Text>
            ) : (
              <View style={styles.markCategoryList}>
                {(mode === 'unlocked' ? groupedUnlockedMarks : groupedCatalogMarks).map((group) => (
                  <View key={`mark-category-${group.category}`} style={styles.markCategoryBlock}>
                    <Text style={styles.markCategoryTitle}>{group.category}</Text>
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
                          />
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        <Text style={styles.screenMeta}>
          {state.status === 'loading' ? 'Mark arsivi kalibre ediliyor...' : 'Mark verisi hazir degil.'}
        </Text>
      )}
    </ScreenCard>
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
  const unreadCount = state.items.filter((item) => !item.opened && Boolean(item.deepLink)).length;
  const actionableCount = state.items.filter((item) => Boolean(item.deepLink)).length;
  const openedCount = state.items.filter((item) => item.opened).length;
  const statusTone =
    state.status === 'error' ? 'clay' : state.status === 'ready' ? 'sage' : 'muted';

  const sortedItems = useMemo(() => {
    return [...state.items].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  }, [state.items]);
  const visibleItems = sortedItems.slice(0, 10);
  const latestInboxTimestamp = visibleItems[0]?.receivedAt || '';

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

  return (
    <>
      <SectionLeadCard
        accent="sage"
        eyebrow="Inbox Relay"
        title="Bildirim Kutusu"
        body="Push ve deep-link olaylari burada toplanir. Satira dokununca ilgili akis tetiklenir ve bildirim okunduya alinir."
        badges={[
          { label: `${unreadCount} yeni link`, tone: unreadCount > 0 ? 'sage' : 'muted' },
          { label: `${state.items.length} toplam`, tone: 'muted' },
          { label: showOpsMeta ? 'ops meta acik' : 'urun gorunumu', tone: showOpsMeta ? 'clay' : 'muted' },
        ]}
        metrics={[
          { label: 'Toplam', value: String(state.items.length) },
          { label: 'Acilmis', value: String(openedCount) },
          { label: 'Linkli', value: String(actionableCount) },
        ]}
        actions={[
          {
            label: isBusy ? 'Kutu Isleniyor...' : 'Kutuyu Temizle',
            tone: 'neutral',
            onPress: onClear,
            disabled: isBusy || state.items.length === 0,
          },
        ]}
      />

      <StatusStrip
        tone={statusTone}
        eyebrow="Inbox State"
        title={
          state.status === 'error'
            ? 'Bildirim kutusu sorun yasiyor'
            : state.status === 'ready'
              ? 'Inbox akis halinde'
              : 'Inbox hazirlaniyor'
        }
        body={state.message}
        meta={
          latestInboxTimestamp
            ? `Son olay: ${latestInboxTimestamp}`
            : 'Yenilemek icin sayfayi yukaridan asagi cekebilirsin.'
        }
      />

      {sortedItems.length === 0 ? (
        <StatePanel
          tone="sage"
          variant={state.status === 'loading' ? 'loading' : state.status === 'error' ? 'error' : 'empty'}
          eyebrow="Inbox"
          title={
            state.status === 'loading'
              ? 'Bildirim kutusu hazirlaniyor'
              : state.status === 'error'
                ? 'Bildirimler okunamadi'
                : 'Kutu su an bos'
          }
          body={
            state.status === 'loading'
              ? 'Yeni deep link ve push olaylari icin kutu senkronize ediliyor.'
              : state.status === 'error'
                ? 'Bildirim akisi gecici olarak okunamadi. Bir sonraki push ile tekrar deneyebilirsin.'
                : 'Yeni bir bildirim geldiginde burada daha okunur kartlar halinde gorunecek.'
          }
          meta={state.message}
        />
      ) : (
        <>
          <StatusStrip
            tone="muted"
            eyebrow="Interaction"
            title="Satira dokun, akisa gec"
            body="Linkli bildirimler ilgili ekran planini acarken, digerleri bildirim kaydini okundu olarak gunceller."
            meta={
              showOpsMeta
                ? 'Ops modu acik: kaynak, tip ve deep-link meta bilgileri satirda gosterilir.'
                : 'Ops modu kapali: yalnizca urun akis bilgisi gosterilir.'
            }
          />

          <ScreenCard accent="sage">
            <Text style={styles.subSectionLabel}>Son 10 Bildirim</Text>
            <View style={styles.detailInfoGrid}>
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>Yeni Link</Text>
                <Text style={styles.detailInfoValue}>{unreadCount}</Text>
              </View>
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>Acilmis</Text>
                <Text style={styles.detailInfoValue}>{openedCount}</Text>
              </View>
              <View style={styles.detailInfoCard}>
                <Text style={styles.detailInfoLabel}>Linkli</Text>
                <Text style={styles.detailInfoValue}>{actionableCount}</Text>
              </View>
            </View>

            <FlatList
              data={visibleItems}
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
        </>
      )}

    </>
  );
};

const CommentFeedCard = ({
  state,
  showFilters = true,
  showOpsMeta = false,
  onScopeChange,
  onSortChange,
  onQueryChange,
  onLoadMore,
  onEcho,
  onLoadReplies,
  onSubmitReply,
  onOpenAuthorProfile,
  onRefresh,
  selectedMovieTitle,
  movieFilterMode = 'all',
}: {
  state: CommentFeedState;
  showFilters?: boolean;
  showOpsMeta?: boolean;
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
  onOpenAuthorProfile: (item: CommentFeedState['items'][number]) => void;
  onRefresh: () => void;
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
  const [repliesByItemId, setRepliesByItemId] = useState<Record<string, MobileCommentReply[]>>({});
  const normalizedSelectedMovieTitle = String(selectedMovieTitle || '').trim();
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

  return (
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
      <Text style={styles.screenMeta}>
        Kaynak: {state.source === 'live' ? 'canli' : 'fallback'} | Kayit: {state.items.length}
      </Text>
      <Text
        style={[
          styles.screenMeta,
          state.status === 'error'
            ? styles.ritualStateError
            : state.status === 'ready'
              ? styles.ritualStateOk
              : styles.screenMeta,
        ]}
      >
        {state.message}
      </Text>

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
              ? 'Akis gecici olarak okunamadi. Yenileyip tekrar deneyebilirsin.'
              : 'Filtreyi degistirerek daha genis bir akis gorebilir ya da yeni yorumlar geldikce burayi tekrar kontrol edebilirsin.'
          }
          meta={state.message}
          actionLabel="Akisi Yenile"
          onAction={onRefresh}
          actionTone={state.status === 'error' ? 'danger' : 'brand'}
        />
      ) : (
        <View style={styles.commentFeedList}>
          {visibleItems.map((item) => (
            <View key={item.id} style={styles.commentFeedRow}>
              <View style={styles.commentFeedRowHeader}>
                <Text style={styles.commentFeedMovieTitle}>{item.movieTitle}</Text>
                {item.isMine ? <Text style={styles.commentFeedMineBadge}>SENIN</Text> : null}
              </View>
              <View style={styles.commentFeedAuthorMetaRow}>
                <View style={styles.commentFeedAvatarWrap}>
                  {item.authorAvatarUrl ? (
                    <Image
                      source={{ uri: item.authorAvatarUrl }}
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
                    {item.leagueKey || 'Bronze'}
                  </Text>
                </View>
                <Text style={styles.commentFeedMeta}>{item.timestampLabel}</Text>
              </View>
              <Text style={styles.commentFeedBody}>{item.text}</Text>
              <View style={styles.commentFeedActionRow}>
                <Text style={styles.commentFeedMeta}>
                  Echo: {item.echoCount} | Reply: {item.replyCount}
                  {showOpsMeta ? `  |  ops::day:${item.dayKey || '?'}` : ''}
                </Text>
                <View style={styles.commentFeedInlineActions}>
                  <Pressable
                    style={[
                      styles.commentFeedActionButton,
                      item.isEchoedByMe ? styles.commentFeedActionButtonActive : null,
                      echoSubmitting[item.id] ? styles.claimButtonDisabled : null,
                    ]}
                    onPress={() => {
                      void handleEchoPress(item);
                    }}
                    disabled={item.isEchoedByMe || echoSubmitting[item.id]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.author} yorumuna echo ver`}
                  >
                    <Text
                      style={[
                        styles.commentFeedActionButtonText,
                        item.isEchoedByMe ? styles.commentFeedActionButtonTextActive : null,
                      ]}
                    >
                      {item.isEchoedByMe ? 'Echoed' : 'Echo'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.commentFeedActionButton,
                      expandedReplies[item.id] ? styles.commentFeedActionButtonActive : null,
                    ]}
                    onPress={() => {
                      void handleToggleReplies(item);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.author} yorumunun yanitlarini ac`}
                  >
                    <Text
                      style={[
                        styles.commentFeedActionButtonText,
                        expandedReplies[item.id] ? styles.commentFeedActionButtonTextActive : null,
                      ]}
                    >
                      Reply
                    </Text>
                  </Pressable>
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
          ))}
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

        <Pressable
          style={[
            styles.retryButton,
            styles.commentFeedBottomActionButton,
            isBusy ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy}
          onPress={onRefresh}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={isBusy ? 'Yorum akisi yenileniyor' : 'Yorum akisina yenile'}
          accessibilityState={{ disabled: isBusy }}
        >
          <Text style={styles.retryText}>{isBusy ? 'Yukleniyor...' : 'Yorum Akisini Yenile'}</Text>
        </Pressable>
      </View>
    </ScreenCard>
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
  onRetry,
}: {
  state: DailyState;
  showOpsMeta?: boolean;
  selectedMovieId?: number | null;
  onSelectMovie?: (movieId: number) => void;
  onRetry: () => void;
}) => {
  const formatAge = (ageSeconds: number | null): string => {
    if (ageSeconds === null || ageSeconds < 0) return 'unknown';
    if (ageSeconds < 60) return `${ageSeconds}s`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m`;
    return `${Math.floor(ageSeconds / 3600)}h`;
  };

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow="Daily Selection"
        title="Bugunun secimi kuruluyor"
        body="Poster, editorial not ve secili film aksiyonlari hazirlaniyor."
        meta="Canli veri, cache ya da fallback kaynagi kontrol ediliyor."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="clay"
        variant="error"
        eyebrow="Daily Selection"
        title="Bugunun secimi su an acilamadi"
        body="Kaynak akisinda gecici bir sorun var. Tekrar denediginde canli secim, cache ya da fallback geri gelebilir."
        meta={
          showOpsMeta ? `Trace: ${state.message} | Endpoint: ${state.endpoint || 'unset'}` : state.message
        }
        actionLabel="Tekrar Dene"
        onAction={onRetry}
        actionTone="danger"
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
        eyebrow="Daily Selection"
        title="Bugun icin film bulunmadi"
        body="Secim listesi bos dondu. Servis yenilendiginde yeni gunluk secim burada gorunecek."
        meta={successState.message}
        actionLabel="Yenile"
        onAction={onRetry}
      />
    );
  }

  const dataSourceLabel =
    successState.dataSource === 'live'
      ? 'canli'
      : successState.dataSource === 'cache'
        ? 'onbellek'
        : 'fallback';

  return (
    <View style={{ marginBottom: 12 }}>
      <ScreenCard accent="sage">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.screenTitle}>Gunun Secimi</Text>
            <Text style={[styles.screenBody, { marginTop: 4 }]}>
              {successState.dataSource === 'cache'
                ? 'Baglanti sinirli, son basarili secim gosteriliyor.'
                : successState.dataSource === 'fallback'
                  ? 'Servis erisimi olmadigi icin local fallback secim gosteriliyor.'
                  : 'Bugunun secimi listelendi.'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <DailyCycleTime />
        </View>

        <View style={styles.dailyDataSourceRow}>
          <View style={successState.dataSource === 'live' ? styles.dataSourceBadgeLive : styles.dataSourceBadgeFallback}>
            <Text style={successState.dataSource === 'live' ? styles.dataSourceTextLive : styles.dataSourceTextFallback}>
              VERI YOLU: {dataSourceLabel}
            </Text>
          </View>
          <Text style={styles.screenMeta}>Tarih: {successState.date || 'unknown'}</Text>
        </View>

        {showOpsMeta ? <Text style={styles.screenMeta}>Source: {successState.source || 'unknown'}</Text> : null}
        {showOpsMeta ? <Text style={styles.screenMeta}>Endpoint: {successState.endpoint}</Text> : null}
        {showOpsMeta ? (
          <View style={styles.badgeRow}>
            <Text style={styles.screenMeta}>Data: {successState.dataSource}</Text>
            <Text style={styles.screenMeta}>Stale: {successState.stale ? 'yes' : 'no'}</Text>
            {successState.dataSource === 'cache' ? (
              <Text style={styles.screenMeta}>Age: {formatAge(successState.cacheAgeSeconds)}</Text>
            ) : null}
          </View>
        ) : null}
        {successState.warning ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              {showOpsMeta ? 'Live fetch warning' : 'Canli veri uyarisi'}: {successState.warning}
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.movieListHorizontal}
        >
          {successState.movies.slice(0, 5).map((movie, index) => {
            const isSelected = selectedMovieId === movie.id;
            const posterUri = resolvePosterUrl(movie.posterPath);
            return (
              <Pressable
                key={`${movie.id}-${index}`}
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
          })}
        </ScrollView>
      </ScreenCard>
    </View>
  );
};

const MovieDetailsModal = ({
  movie,
  onClose,
  onOpenCommentComposer,
}: {
  movie: {
    title: string;
    overview: string | null;
    voteAverage: number | null;
    genre: string | null;
    year: number | null;
    director: string | null;
    cast?: string[];
    posterPath?: string | null;
    originalLanguage?: string | null;
  } | null;
  onClose: () => void;
  onOpenCommentComposer?: () => void;
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
        <View style={styles.modalContentSurface}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.movieDetailPoster} resizeMode="cover" />
          ) : null}
          <Text style={styles.movieDetailTitle}>{movie.title}</Text>
          <Text style={styles.movieDetailMeta}>
            {movie.year ? `${movie.year} | ` : ''}
            {movie.genre || 'Tur bilgisi hazirlaniyor'} | Puan: {movie.voteAverage?.toFixed(1) || 'N/A'}
          </Text>
          <Text style={styles.movieDetailBody}>{movie.overview || 'Konu ozeti bulunamiyor.'}</Text>
          <Text style={styles.movieDetailCast}>Yonetmen: {directorLabel}</Text>
          <Text style={styles.movieDetailCast}>Oyuncular: {castLabel}</Text>
          {movie.originalLanguage ? (
            <Text style={styles.movieDetailCast}>Dil: {movie.originalLanguage.toUpperCase()}</Text>
          ) : null}

          <View style={styles.modalActionStack}>
            {onOpenCommentComposer ? (
              <UiButton label="Bu Film Icin Yorum Yaz" tone="brand" stretch onPress={onOpenCommentComposer} />
            ) : null}
            <UiButton label="Kapat" tone="neutral" stretch onPress={onClose} />
          </View>
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
  onRefresh,
  onClose,
}: {
  visible: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  movie: MobileWatchedMovie | null;
  entries: MobileProfileMovieArchiveEntry[];
  onRefresh: () => void;
  onClose: () => void;
}) => {
  useWebModalFocusReset(visible && Boolean(movie));
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
                meta="Yeni ritual geldikce bu alan otomatik dolar."
                actionLabel="Arsivi Yenile"
                onAction={onRefresh}
              />
            ) : null}

            {entries.length > 0 ? (
              <View style={styles.movieArchiveEntryList}>
                {entries.map((entry) => (
                  <View key={entry.id} style={styles.movieArchiveEntryCard}>
                    <View style={styles.movieArchiveEntryHeader}>
                      <Text style={styles.movieArchiveEntryDate}>{entry.date}</Text>
                      {entry.genre ? (
                        <Text style={styles.movieArchiveEntryGenre}>{entry.genre}</Text>
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
              <UiButton label="Arsivi Yenile" tone="brand" stretch onPress={onRefresh} />
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
  onRefresh,
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
  onRefresh: () => void;
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
                body="Secilen kullanicinin bu filme ait yorumlari yeniden yukleniyor."
                meta={`${profileLabel} profilinden gelen ritual izi taraniyor.`}
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
                meta={`${profileLabel} yeni ritual biraktikca bu alan dolacak.`}
                actionLabel="Public Arsivi Yenile"
                onAction={onRefresh}
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
              <UiButton label="Public Arsivi Yenile" tone="brand" stretch onPress={onRefresh} />
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
  const filmTitle = targetMovie?.title || 'Ritual Notu';
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
        eyebrow="Ritual Studio"
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
              ? 'Ritual kaydi icin oturum ac'
              : canSubmit
                ? 'Yorum gonderime hazir'
                : 'Taslagini sekillendir'
        }
        body={
          !targetMovie
            ? 'Film secimi yapildiginda ritual composer ilgili baslik ve metadata ile dolar.'
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
          placeholder="Ritual notlari..."
          placeholderTextColor="#8e8b84"
          value={draftText}
          maxLength={180}
          onChangeText={onDraftTextChange}
          editable={targetMovie !== null && submitState.status !== 'submitting'}
          accessibilityLabel="Ritual notu giris alani"
        />

        <View style={styles.ritualMetaRow}>
          <Text style={styles.screenMeta}>{textLength}/180</Text>
          <Text style={styles.screenMeta}>Bekleyen kuyruk: {queueState.pendingCount}</Text>
        </View>

        {submitState.message ? (
          <StatusStrip
            tone={submitTone}
            eyebrow="Submit State"
            title={
              submitState.status === 'synced'
                ? 'Ritual clouda gitti'
                : submitState.status === 'queued'
                  ? 'Taslak kuyruga alindi'
                  : submitState.status === 'error'
                    ? 'Ritual gonderimi durdu'
                    : submitState.status === 'submitting'
                      ? 'Ritual gonderiliyor'
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
            eyebrow="Queue State"
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
            label={submitState.status === 'submitting' ? 'Gonderiliyor...' : 'Ritual Kaydet'}
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
type MobileSettingsLanguage = 'tr' | 'en';
type MobileSettingsIdentityDraft = {
  fullName: string;
  username: string;
  gender: MobileSettingsGender;
  birthDate: string;
  bio: string;
  avatarUrl: string;
  profileLink: string;
};
type MobileSettingsSaveState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  message: string;
};

const SETTINGS_GENDER_OPTIONS: Array<{ key: MobileSettingsGender; label: string }> = [
  { key: '', label: 'Sec' },
  { key: 'female', label: 'Kadin' },
  { key: 'male', label: 'Erkek' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' },
];
const SETTINGS_PLATFORM_RULES = [
  'Ritual notlari net, kisa ve konu odakli olmali.',
  'Toksik/nefret dili ve spam icerik kaldirilir.',
  'Ayni davet kodunu kotuye kullanma davranisi engellenir.',
  'Tekrarlayan ihlallerde hesap aksiyonu uygulanabilir.',
];

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
      <View style={styles.modalOverlaySurface}>
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.screenTitle}>Yorum Yaz</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalSheetScroll}>
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
    </Modal>
  );
};

const MobileSettingsModal = ({
  visible,
  onClose,
  identityDraft,
  onChangeIdentity,
  onSaveIdentity,
  saveState,
  themeMode,
  onSetThemeMode,
  language,
  onSetLanguage,
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
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  identityDraft: MobileSettingsIdentityDraft;
  onChangeIdentity: (patch: Partial<MobileSettingsIdentityDraft>) => void;
  onSaveIdentity: () => void;
  saveState: MobileSettingsSaveState;
  themeMode: MobileThemeMode;
  onSetThemeMode: (mode: MobileThemeMode) => void;
  language: MobileSettingsLanguage;
  onSetLanguage: (language: MobileSettingsLanguage) => void;
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
  onSignOut: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'appearance' | 'session'>('identity');
  const [confirmLogout, setConfirmLogout] = useState(false);
  useWebModalFocusReset(visible);

  useEffect(() => {
    if (!visible) return;
    setActiveTab('identity');
    setConfirmLogout(false);
  }, [visible]);

  if (!visible) return null;
  const isSaving = saveState.status === 'saving';
  const saveTone =
    saveState.status === 'error' ? 'clay' : saveState.status === 'success' ? 'sage' : 'muted';
  const inviteStatusTone =
    inviteStatus.toLowerCase().includes('hata')
      ? 'clay'
      : inviteStatus.toLowerCase().includes('uygulandi') ||
          inviteStatus.toLowerCase().includes('kopyalandi')
        ? 'sage'
        : 'muted';
  const handleSignOutPress = () => {
    if (!isSignedIn || isInviteActionBusy) return;
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setConfirmLogout(false);
    onSignOut();
  };
  const identityDisplayName = String(identityDraft.fullName || '').trim();
  const identityUsername = String(identityDraft.username || '')
    .trim()
    .replace(/^@+/, '');
  const identityBirthDate = String(identityDraft.birthDate || '').trim();
  const identityBio = String(identityDraft.bio || '').trim();
  const identityProfileLink = String(identityDraft.profileLink || '').trim();
  const activeGenderLabel =
    SETTINGS_GENDER_OPTIONS.find((option) => option.key === identityDraft.gender)?.label || 'Sec';
  const themeLabel = themeMode === 'dawn' ? 'Gunduz' : 'Gece';
  const languageLabel = language === 'tr' ? 'Turkce' : 'English';
  const accountDeletionTitle = language === 'en' ? 'Account Deletion' : 'Hesap Silme';
  const accountDeletionBody =
    language === 'en'
      ? 'Open the published deletion page to review the request path, deleted data, and retained records.'
      : 'Talep yolu, silinen veriler ve saklanan kayit notlari icin yayindaki hesap silme sayfasini ac.';
  const accountDeletionMeta =
    language === 'en'
      ? 'Submit the request from the email tied to the account through the app store support channel.'
      : 'Talebi, hesaba bagli e-posta ile app store support kanali uzerinden gonder.';
  const accountDeletionButton = language === 'en' ? 'Open Deletion Page' : 'Silme Sayfasini Ac';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlaySurface}>
        <View style={styles.modalSheetSurface}>
          <View style={styles.modalNavRow}>
            <Text style={styles.screenTitle}>Ayarlar</Text>
            <Pressable onPress={onClose} hitSlop={PRESSABLE_HIT_SLOP}>
              <Text style={styles.modalCloseTextBtn}>Kapat</Text>
            </Pressable>
          </View>

          <View style={styles.settingsTabRow}>
            {([
              { id: 'identity', label: 'Kimlik' },
              { id: 'appearance', label: 'Gorunum' },
              { id: 'session', label: 'Oturum' },
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
              eyebrow="Save State"
              title={saveTone === 'clay' ? 'Kayit basarisiz' : saveTone === 'sage' ? 'Kayit tamamlandi' : 'Taslak guncellendi'}
              body={saveState.message}
              meta={
                isSignedIn
                  ? 'Kimlik degisiklikleri cloud ile senkron tutulur.'
                  : 'Cloud kaydi icin once mobil oturum ac.'
              }
            />
          ) : null}

          <ScrollView contentContainerStyle={styles.modalSheetScroll}>
            {activeTab === 'identity' ? (
              <>
                <SectionLeadCard
                  accent="clay"
                  eyebrow="Identity Layer"
                  title={identityDisplayName || 'Profil Kimligi'}
                  body={identityBio || 'Avatar, kullanici adi ve profil notunu burada sekillendir.'}
                  badges={[
                    {
                      label: identityUsername ? `@${identityUsername}` : 'handle bekleniyor',
                      tone: identityUsername ? 'sage' : 'muted',
                    },
                    {
                      label: identityDraft.avatarUrl ? 'Avatar hazir' : 'Avatar bos',
                      tone: identityDraft.avatarUrl ? 'sage' : 'muted',
                    },
                    { label: activeGenderLabel, tone: 'muted' },
                  ]}
                  metrics={[
                    { label: 'Bio', value: String(identityBio.length) },
                    { label: 'Link', value: identityProfileLink ? 'hazir' : '--' },
                    { label: 'Dogum', value: identityBirthDate ? 'var' : '--' },
                  ]}
                />

                {!isSignedIn ? (
                  <StatusStrip
                    tone="muted"
                    eyebrow="Cloud Save"
                    title="Yerel taslak acik"
                    body="Bu alanlari doldurabilirsin ama cloud kayit icin once mobil oturum acman gerekir."
                    meta="Giris yaptiginda Kaydet aksiyonu aktif hale gelir."
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
                        label={isPickingAvatar ? 'Seciliyor...' : 'Cihazdan Sec'}
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
                    title={identityDraft.avatarUrl ? 'Profil gorseli secildi' : 'Avatar opsiyonel'}
                    body={
                      identityDraft.avatarUrl
                        ? 'Secilen avatar kimlik katmaninda kullanilacak.'
                        : 'Avatar URL yerine cihazdan manuel secim kullaniliyor.'
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
                    placeholder="Dogum tarihi (GG/AA/YYYY)"
                    placeholderTextColor="#8e8b84"
                    autoCapitalize="none"
                    accessibilityLabel="Dogum tarihi"
                  />

                  <View style={styles.detailInfoGrid}>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>Handle</Text>
                      <Text style={styles.detailInfoValue}>
                        {identityUsername ? `@${identityUsername}` : 'Kullanici adi bekleniyor'}
                      </Text>
                    </View>
                    <View style={styles.detailInfoCard}>
                      <Text style={styles.detailInfoLabel}>Dogum</Text>
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
                  title="Bio ve Profil Linki"
                  meta={`${identityBio.length}/180 karakter`}
                  defaultExpanded
                >
                  <TextInput
                    style={styles.ritualInput}
                    multiline
                    textAlignVertical="top"
                    value={identityDraft.bio}
                    onChangeText={(value) => onChangeIdentity({ bio: value.slice(0, 180) })}
                    placeholder="Bio (maks 180)"
                    placeholderTextColor="#8e8b84"
                    accessibilityLabel="Bio"
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
                    title={identityProfileLink ? 'Harici profil hazir' : 'Link opsiyonel'}
                    body={
                      identityProfileLink
                        ? identityProfileLink
                        : 'Web sitesi veya sosyal profil URL bilgisini burada saklayabilirsin.'
                    }
                    meta="Letterboxd import mobilde sonraki surumde acilacak."
                  />

                  <UiButton
                    label={isSaving ? 'Kaydediliyor...' : 'Kimligi Kaydet'}
                    tone="brand"
                    onPress={onSaveIdentity}
                    disabled={isSaving || !isSignedIn}
                  />
                </CollapsibleSectionCard>
              </>
            ) : null}

            {activeTab === 'appearance' ? (
              <>
                <SectionLeadCard
                  accent={themeMode === 'dawn' ? 'clay' : 'sage'}
                  eyebrow="Appearance"
                  title={`${themeLabel} Modu`}
                  body="Tema ve dil secimleri arayuz yuzeyine aninda uygulanir."
                  badges={[
                    { label: themeLabel, tone: themeMode === 'dawn' ? 'clay' : 'sage' },
                    { label: languageLabel, tone: 'muted' },
                  ]}
                  metrics={[
                    { label: 'Theme', value: themeLabel },
                    { label: 'Dil', value: languageLabel },
                  ]}
                />

                <StatusStrip
                  tone="sage"
                  eyebrow="Live Preview"
                  title="Degisiklikler aninda gorunur"
                  body="Tema ve dil secimleri kayit beklemeden uygulama yuzeyine islenir."
                />

                <CollapsibleSectionCard
                  accent={themeMode === 'dawn' ? 'clay' : 'sage'}
                  title="Tema"
                  meta={themeLabel}
                  defaultExpanded
                >
                  <Text style={styles.screenBody}>
                    Gece ve gunduz gorunumleri arasinda cihaz hissine uygun akisi sec.
                  </Text>
                  <View style={styles.themeModeSegmentContainer}>
                    <Pressable
                      style={[
                        styles.themeModeSegmentOption,
                        themeMode === 'midnight' ? styles.themeModeSegmentActiveMidnight : null,
                      ]}
                      onPress={() => onSetThemeMode('midnight')}
                    >
                      <Text
                        style={[
                          styles.themeModeSegmentText,
                          themeMode === 'midnight' ? styles.themeModeSegmentTextActiveMidnight : null,
                        ]}
                      >
                        Gece
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.themeModeSegmentOption,
                        themeMode === 'dawn' ? styles.themeModeSegmentActiveDawn : null,
                      ]}
                      onPress={() => onSetThemeMode('dawn')}
                    >
                      <Text
                        style={[
                          styles.themeModeSegmentText,
                          themeMode === 'dawn' ? styles.themeModeSegmentTextActiveDawn : null,
                        ]}
                      >
                        Gunduz
                      </Text>
                    </Pressable>
                  </View>
                  <StatusStrip
                    tone={themeMode === 'dawn' ? 'clay' : 'sage'}
                    eyebrow="Tema Durumu"
                    title={`${themeLabel} temasi aktif`}
                    body={
                      themeMode === 'dawn'
                        ? 'Daha aydinlik ve sicak tonlu yuzeyler acik.'
                        : 'Koyu sinema hissini koruyan gece temasi aktif.'
                    }
                  />
                </CollapsibleSectionCard>

                <CollapsibleSectionCard
                  accent="sage"
                  title="Dil"
                  meta={languageLabel}
                  defaultExpanded
                >
                  <Text style={styles.screenBody}>
                    Arayuz kopyasini tercih ettigin dile cek. Diger yuzeyler ayni davranir.
                  </Text>
                  <View style={styles.settingsGenderRow}>
                    <Pressable
                      style={[styles.settingsGenderChip, language === 'tr' ? styles.settingsGenderChipActive : null]}
                      onPress={() => onSetLanguage('tr')}
                    >
                      <Text
                        style={[
                          styles.settingsGenderChipText,
                          language === 'tr' ? styles.settingsGenderChipTextActive : null,
                        ]}
                      >
                        Turkce
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.settingsGenderChip, language === 'en' ? styles.settingsGenderChipActive : null]}
                      onPress={() => onSetLanguage('en')}
                    >
                      <Text
                        style={[
                          styles.settingsGenderChipText,
                          language === 'en' ? styles.settingsGenderChipTextActive : null,
                        ]}
                      >
                        English
                      </Text>
                    </Pressable>
                  </View>
                  <StatusStrip
                    tone="muted"
                    eyebrow="Language"
                    title={language === 'tr' ? 'Turkce arayuz aktif' : 'English interface active'}
                    body={
                      language === 'tr'
                        ? 'Metinler Turkce gosteriliyor.'
                        : 'Labels and interface copy are shown in English.'
                    }
                    meta="Yerellesme kapsami ekran bazli olarak genislemeye devam eder."
                  />
                </CollapsibleSectionCard>
              </>
            ) : null}

            {activeTab === 'session' ? (
              <>
                <SectionLeadCard
                  accent="clay"
                  eyebrow="Account Center"
                  title={isSignedIn ? activeAccountLabel : 'Cloud oturumu bagli degil'}
                  body={
                    isSignedIn
                      ? 'Davet programi, cikis ve platform kurallarini ayni sekmeden yonet.'
                      : 'Cloud baglamak icin once profil sekmesindeki oturum kartindan giris yap.'
                  }
                  badges={[
                    { label: isSignedIn ? 'Cloud hazir' : 'Giris gerekli', tone: isSignedIn ? 'sage' : 'clay' },
                    { label: activeEmailLabel || 'email yok', tone: 'muted' },
                    { label: inviteCode ? `Kod ${inviteCode}` : 'Kod bekleniyor', tone: inviteCode ? 'muted' : 'clay' },
                  ]}
                  metrics={[
                    { label: 'Invite', value: inviteCode ? 'hazir' : '--' },
                    { label: 'Status', value: isInviteActionBusy ? 'busy' : isSignedIn ? 'ready' : 'guest' },
                    { label: 'Referral', value: invitedByCode ? 'bagli' : 'acik' },
                  ]}
                  actions={[
                    {
                      label: confirmLogout ? 'Tekrar Tikla ve Cik' : 'Cikis Yap',
                      tone: confirmLogout ? 'danger' : 'neutral',
                      onPress: handleSignOutPress,
                      disabled: !isSignedIn || isInviteActionBusy,
                    },
                  ]}
                />

                {inviteStatus ? (
                  <StatusStrip
                    tone={inviteStatusTone}
                    eyebrow="Invite Status"
                    title={inviteStatusTone === 'clay' ? 'Davet akisi hata verdi' : 'Davet akisi guncellendi'}
                    body={inviteStatus}
                    meta={inviteStatsLabel}
                  />
                ) : null}

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
                      eyebrow="Referral"
                      title="Davet programi icin once giris yap"
                      body="Link kopyalama ve kod uygulama akislari cloud oturumu gerektirir."
                      meta="Oturum acildiginda bu bolum otomatik olarak aktiflesir."
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
                        eyebrow="Referral Notu"
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
                  accent="clay"
                  title={accountDeletionTitle}
                  meta={language === 'en' ? 'Web request path' : 'Web talep yolu'}
                  defaultExpanded
                >
                  <StatusStrip
                    tone="muted"
                    eyebrow={language === 'en' ? 'Request Flow' : 'Talep Akisi'}
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
        body="Davet kodunu backend uzerinden dogrula ve odul akisina bagla."
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
          title="Deep link icinde davet kodu yok"
          body="Bu ekran bir davet kodu yakaladiginda odul akisini burada calistirir."
          meta="Yeni bir davet baglantisiyla uygulamaya geri dondugunde tekrar dene."
        />
      ) : null}

      {claimState.status === 'loading' ? (
        <StatePanel
          tone="sage"
          variant="loading"
          eyebrow="Invite Claim"
          title="Kod dogrulaniyor"
          body="Kod gecerliligi ve odul haklari backend tarafinda kontrol ediliyor."
          meta={`Kod: ${inviteCode}`}
        />
      ) : null}

      {claimState.status === 'success' ? (
        <ScreenCard accent="sage">
          <Text style={styles.sectionLeadEyebrow}>Claim Success</Text>
          <Text style={styles.sectionLeadTitle}>Odul uygulandi</Text>
          <Text style={styles.sectionLeadBody}>{claimState.message}</Text>
          <View style={styles.sectionLeadMetricRow}>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviteeRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Invitee XP</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>+{claimState.inviterRewardXp}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Inviter XP</Text>
            </View>
            <View style={styles.sectionLeadMetricCard}>
              <Text style={styles.sectionLeadMetricValue}>{claimState.claimCount}</Text>
              <Text style={styles.sectionLeadMetricLabel}>Claim Count</Text>
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
          meta={claimState.errorCode ? `Error code: ${claimState.errorCode}` : undefined}
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
  onOpenDaily,
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
  onOpenDaily?: () => void;
}) => {
  const normalizedGoal = goal === 'streak' ? 'streak' : 'comment';
  const normalizedPlatform =
    platform === 'instagram' || platform === 'tiktok' || platform === 'x' ? platform : undefined;
  const safeStreak = Math.max(0, Number(streakValue || 0));

  const title =
    normalizedGoal === 'streak'
      ? 'Streak Paylasimi'
      : normalizedGoal === 'comment'
        ? 'Yorum Paylasimi'
        : 'Paylasim Merkezi';

  const body =
    normalizedGoal === 'streak'
      ? 'Seri tamamlandi. Paylasim niyeti deep link ile alindi; mobilde route bilgisi hazir.'
      : normalizedGoal === 'comment'
        ? 'Yorum paylasimi niyeti deep link ile alindi; mobilde route bilgisi hazir.'
        : 'Paylasim hedefi bilgisi bulunamadi. Varsayilan route acildi.';
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
        ]}
        metrics={[
          { label: 'Streak', value: String(safeStreak) },
          { label: 'Ready', value: canShareSelectedGoal ? 'yes' : 'no' },
          { label: 'Platform', value: normalizedPlatform || '--' },
        ]}
        actions={
          onOpenDaily
            ? [{ label: 'Gunluk Akisa Don', tone: 'brand', onPress: () => onOpenDaily() }]
            : undefined
        }
      />

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>Paylasim Hedefi</Text>
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

        <View style={styles.detailInfoGrid}>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Invite</Text>
            <Text style={styles.detailInfoValue}>{inviteCode || 'none'}</Text>
          </View>
          <View style={styles.detailInfoCard}>
            <Text style={styles.detailInfoLabel}>Link</Text>
            <Text style={styles.detailInfoValue} numberOfLines={3}>
              {inviteLink || 'hazirlaniyor'}
            </Text>
          </View>
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
            meta="Platform sectiginde native share paneli ve odul akisi devreye girer."
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
            meta="Gunluk akisa donup yeni ritual biraktiginda bu alan otomatik olarak acilir."
          />
        )}
      </ScreenCard>

      <ScreenCard accent={normalizedGoal === 'streak' ? 'clay' : 'sage'}>
        <Text style={styles.subSectionLabel}>Platform Sec</Text>
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
          meta={canShareSelectedGoal ? 'Platform secimi hazir.' : 'Paylasim oncesi hedef gereksinimleri eksik.'}
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
        body="Webdeki kesif alanlarini mobile ayni dilde tasidik. Kategori secip ilgili rotayi ac."
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
                      ? 'Bu rota mobil yuzeyden web kesfine dogrudan gecer.'
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
  onOpenDaily: () => void;
}) => (
  <>
    <SectionLeadCard
      accent="clay"
      eyebrow="Arena Pulse"
      title="Haftalik challenge nabzi"
      body="Gunluk ritual ritmi, aktif seri ve yorum akisi Arena tablosundaki yerini belirler."
      badges={[
        { label: `Seri ${streakLabel}`, tone: 'sage' },
        { label: `Ritual ${ritualsLabel}`, tone: 'muted' },
        { label: 'haftalik tempo', tone: 'clay' },
      ]}
      metrics={[
        { label: 'Seri', value: streakLabel },
        { label: 'Ritual', value: ritualsLabel },
        { label: 'Mod', value: 'Haftalik' },
      ]}
      actions={[
        {
          label: 'Gunluk Akisa Gec',
          tone: 'brand',
          onPress: onOpenDaily,
        },
      ]}
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
  onRefresh,
  onOpenProfile,
}: {
  state: ArenaLeaderboardState;
  onRefresh: () => void;
  onOpenProfile: (item: ArenaLeaderboardItem) => void;
}) => (
  <>
    <SectionLeadCard
      accent="sage"
      eyebrow="Arena Board"
      title="Arena Leaderboard"
      body="Son ritual aktivitesinden uretilen haftalik siralama. Nick uzerine dokunarak profili ac."
      badges={[
        { label: state.source === 'live' ? 'canli kaynak' : 'fallback kaynak', tone: state.source === 'live' ? 'sage' : 'clay' },
        { label: `${state.entries.length} oyuncu`, tone: 'muted' },
      ]}
      metrics={[
        { label: 'Kaynak', value: state.source === 'live' ? 'live' : 'fallback' },
        { label: 'Durum', value: state.status },
      ]}
      actions={[
        {
          label: state.status === 'loading' ? 'Yenileniyor...' : 'Leaderboard Yenile',
          tone: 'neutral',
          onPress: onRefresh,
          disabled: state.status === 'loading',
        },
      ]}
    />

    <StatusStrip
      tone={state.status === 'error' ? 'clay' : state.source === 'live' ? 'sage' : 'muted'}
      eyebrow="Arena Feed"
      title={state.status === 'error' ? 'Leaderboard okunamadi' : state.source === 'live' ? 'Canli siralama acik' : 'Fallback siralama aktif'}
      body={state.message}
      meta="Profil acilislari siralama satirlarindan tetiklenir."
    />

    {state.status === 'loading' && state.entries.length === 0 ? (
      <StatePanel
        tone="sage"
        variant="loading"
        eyebrow="Arena"
        title="Haftalik siralama yukleniyor"
        body="Canli ritual aktivitesi ve profil gecisleri toparlaniyor."
        meta="Kaynak canli degilse fallback tablo devreye girebilir."
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
            : 'Yeni ritual ve echo hareketleri geldikce arena siralamasi burada gorunecek.'
        }
        meta={state.message}
        actionLabel="Leaderboard Yenile"
        onAction={onRefresh}
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
                  Ritual {item.ritualsCount} | Echo {item.echoCount}
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
      <Text style={styles.sectionLeadEyebrow}>Public Bridge</Text>
      <Text style={styles.sectionLeadTitle}>Public Profile Gecisi</Text>
      <Text style={styles.sectionLeadBody}>
        Kullanici adini gir, profili mobil icinde ac ve yorum/film arsivine dogrudan gec.
      </Text>
      <View style={styles.sectionLeadBadgeRow}>
        <View
          style={[
            styles.sectionLeadBadge,
            canOpenProfile ? styles.sectionLeadBadgeSage : styles.sectionLeadBadgeMuted,
          ]}
        >
          <Text style={styles.sectionLeadBadgeText}>
            {canOpenProfile ? 'profil hazir' : 'handle bekleniyor'}
          </Text>
        </View>
        <View style={[styles.sectionLeadBadge, styles.sectionLeadBadgeMuted]}>
          <Text style={styles.sectionLeadBadgeText}>@kullanici-adi</Text>
        </View>
      </View>

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
          eyebrow="Hazir Profil"
          title={`@${normalizedInput}`}
          body="Bu handle ile native public profile ekranini acabilirsin."
          meta="Giris yapmadan da profil, film ve yorum akislarini inceleyebilirsin."
        />
      ) : (
        <StatePanel
          tone="clay"
          variant="empty"
          eyebrow="Profil Arama"
          title="Once bir kullanici adi yaz"
          body="Public profile acilisi handle bazli calisir. Bosluk olmadan kullanici adini gir."
          meta="Ornek: @cinephile ya da cinephile"
        />
      )}

      <UiButton
        label={canOpenProfile ? 'Profili Ac' : 'Kullanici Adi Bekleniyor'}
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
  onRefresh,
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
  onRefresh: () => void;
}) => {
  const profileDisplayName = String(profile?.displayName || displayNameHint || '@bilinmeyen').trim();
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
        body={status === 'loading' ? 'Profil yukleniyor...' : message}
        badges={[
          { label: status, tone: status === 'error' ? 'clay' : status === 'ready' ? 'sage' : 'muted' },
          ...(isSelfProfile ? [{ label: 'kendi profilin', tone: 'muted' as const }] : []),
          ...(!isSelfProfile && followsYou ? [{ label: 'seni takip ediyor', tone: 'sage' as const }] : []),
        ]}
        metrics={[
          { label: 'Ritual', value: String(ritualsCount) },
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
            label: 'Yenile',
            tone: 'neutral',
            onPress: onRefresh,
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
          title="Profil verisi toparlaniyor"
          body="Temel metrikler ve follow durumu okunuyor."
          meta="Profil acildiginda film ve yorum arsivine asagidan gecersin."
        />
      ) : null}

      {status === 'error' && !profile ? (
        <StatePanel
          tone="clay"
          variant="error"
          eyebrow="Public Profil"
          title="Profil su an acilamadi"
          body={message}
          meta="Kullanici adi dogruysa yenileyip tekrar deneyebilirsin."
          actionLabel="Yenile"
          onAction={onRefresh}
          actionTone="danger"
        />
      ) : null}

      {profile ? (
        <ScreenCard accent="sage">
          <Text style={styles.subSectionLabel}>Toplu Ozet</Text>
          <View style={styles.detailInfoGrid}>
            <View style={styles.detailInfoCard}>
              <Text style={styles.detailInfoLabel}>Ritual</Text>
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
            eyebrow="Follow State"
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
                ? 'Kendi profilinde follow aksiyonu gosterilmez.'
                : isSignedIn
                  ? 'Istersen bu profili takip edip sosyal akisina ekleyebilirsin.'
                  : 'Takip etmek icin once mobil session acman gerekir.')
            }
            meta={!isSelfProfile && followsYou ? 'Bu kisi seni takip ediyor.' : 'Detayli profil icin ustteki aksiyonu kullan.'}
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
    'Ritual notlari net, kisa ve konu odakli olmali.',
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
  CollapsibleSectionCard,
  SectionLeadCard,
  StatePanel,
  ThemeModeCard,
  ScreenErrorBoundary,
  MobileSettingsModal,
  ProfileIdentityCard,
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
  MobileSettingsGender,
  MobileSettingsLanguage,
  MobileSettingsIdentityDraft,
  MobileSettingsSaveState,
};
