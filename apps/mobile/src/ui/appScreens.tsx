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
  groupMobileMarksByCategory,
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

const PRESSABLE_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const DAWN_TEXT_COLOR_STYLE = { color: '#A45E4A' } as const;
let APP_SCREENS_THEME_MODE: MobileThemeMode = 'midnight';

const Text = ({ style, ...props }: TextProps) => (
  <RNText
    {...props}
    style={[style, APP_SCREENS_THEME_MODE === 'dawn' ? DAWN_TEXT_COLOR_STYLE : null]}
  />
);

const setAppScreensThemeMode = (mode: MobileThemeMode) => {
  APP_SCREENS_THEME_MODE = mode === 'dawn' ? 'dawn' : 'midnight';
};

const resolvePosterUrl = (posterPath: string | null | undefined): string | null => {
  const normalized = String(posterPath || '').trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const normalizedPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${TMDB_POSTER_BASE_URL}${normalizedPath}`;
};

const ScreenCard = ({
  children,
}: {
  children: ReactNode;
  accent?: 'sage' | 'clay';
}) => <View style={styles.screenCard}>{children}</View>;

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

  componentDidCatch(_error: unknown, _errorInfo: ErrorInfo) {
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
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignOut,
}: {
  authState: AuthState;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) => {
  const isBusy = authState.status === 'loading';
  const isSignedIn = authState.status === 'signed_in';
  const isConfigured = isSupabaseConfigured;

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>Oturum</Text>
      <Text style={styles.screenBody}>
        Invite claim icin mobilde Supabase oturumu gerekiyor.
      </Text>
      <Text style={styles.screenMeta}>Status: {authState.status}</Text>
      <Text style={styles.screenMeta}>{authState.message}</Text>
      {!isConfigured ? (
        <Text style={styles.screenMeta}>
          EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ayarlanmali.
        </Text>
      ) : null}

      {!isSignedIn ? (
        <View style={styles.authForm}>
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
          <TextInput
            style={styles.input}
            value={password}
            autoCapitalize="none"
            secureTextEntry
            returnKeyType="done"
            placeholder="Password"
            placeholderTextColor="#8e8b84"
            onChangeText={onPasswordChange}
            onSubmitEditing={onSignIn}
            accessibilityLabel="Sifre"
          />
          <Pressable
            style={[
              styles.claimButton,
              isBusy ? styles.claimButtonDisabled : null,
              !isConfigured ? styles.claimButtonDisabled : null,
            ]}
            onPress={onSignIn}
            disabled={isBusy || !isConfigured}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={isBusy ? 'Giris yapiliyor' : 'Giris yap'}
            accessibilityState={{ disabled: isBusy || !isConfigured }}
          >
            <Text style={styles.claimButtonText}>{isBusy ? 'Giris yapiliyor...' : 'Giris Yap'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.authSignedInBox}>
          <Text style={styles.screenMeta}>User: {authState.email}</Text>
          <Pressable
            style={[styles.signOutButton, isBusy ? styles.claimButtonDisabled : null]}
            onPress={onSignOut}
            disabled={isBusy}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Cikis yap"
            accessibilityState={{ disabled: isBusy }}
          >
            <Text style={styles.claimButtonText}>Cikis Yap</Text>
          </Pressable>
        </View>
      )}
    </ScreenCard>
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

const ProfileMarksCard = ({
  state,
  isSignedIn,
}: {
  state: ProfileState;
  isSignedIn: boolean;
}) => {
  const unlockedMarks = state.status === 'success' ? state.marks : [];
  const featuredMarks = state.status === 'success' ? state.featuredMarks : [];
  const hasMarks = unlockedMarks.length > 0;
  const groupedMarks = useMemo(
    () => groupMobileMarksByCategory(unlockedMarks),
    [unlockedMarks]
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
                {featuredMarks.map((markId) => (
                  <View key={`featured-${markId}`} style={styles.markPillFeatured}>
                    <Text style={styles.markPillFeaturedText}>{resolveMobileMarkTitle(markId)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.markCategoryBlock}>
            <Text style={styles.markCategoryTitle}>Tum Marklar</Text>
            {hasMarks ? (
              <View style={styles.markCategoryList}>
                {groupedMarks.map((group) => (
                  <View key={`mark-category-${group.category}`} style={styles.markCategoryBlock}>
                    <Text style={styles.markCategoryTitle}>{group.category}</Text>
                    <View style={styles.markPillRow}>
                      {group.marks.map((mark) => (
                        <View key={`mark-${mark.id}`} style={styles.markPill}>
                          <Text style={styles.markPillText}>{mark.title}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.screenMeta}>Henuz kazanilmis bir mark yok.</Text>
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
  const tokenPreview =
    state.token.length > 20
      ? `${state.token.slice(0, 18)}...${state.token.slice(-10)}`
      : state.token || 'none';
  const deviceKeyPreview =
    state.deviceKey.length > 20
      ? `${state.deviceKey.slice(0, 12)}...${state.deviceKey.slice(-6)}`
      : state.deviceKey || 'none';

  const toneStyle =
    state.status === 'error'
      ? styles.ritualStateError
      : state.status === 'unsupported'
        ? styles.ritualStateWarn
        : styles.ritualStateOk;
  const testToneStyle =
    testState.status === 'error'
      ? styles.ritualStateError
      : testState.status === 'success'
        ? styles.ritualStateOk
        : styles.screenMeta;
  const receiptToneStyle =
    testState.receiptStatus === 'unavailable'
      ? styles.ritualStateWarn
      : testState.receiptStatus === 'ok'
        ? styles.ritualStateOk
        : styles.screenMeta;
  const canSendTest = pushEnabled && isSignedIn && state.cloudStatus === 'synced' && !isBusy;

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>Push Durumu</Text>
      <Text style={styles.screenBody}>
        Expo push token kaydi ve izin durumu. Bildirim datasi icinde `deepLink` varsa mobil routinge aktarilir.
      </Text>
      {!pushEnabled ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Push modulu su an gecici olarak devre disi. EXPO_PUBLIC_PUSH_ENABLED=1 ile tekrar acilir.
        </Text>
      ) : null}
      {!isSignedIn ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Push kaydi icin once Session kartindan giris yap.
        </Text>
      ) : null}
      <Text style={styles.screenMeta}>Permission: {state.permissionStatus || 'unknown'}</Text>
      <Text style={styles.screenMeta}>ProjectId: {state.projectId || 'unset'}</Text>
      <Text style={styles.screenMeta}>Token: {tokenPreview}</Text>
      <Text style={styles.screenMeta}>Cloud sync: {state.cloudStatus}</Text>
      <Text style={styles.screenMeta}>Device key: {deviceKeyPreview}</Text>
      <Text style={styles.screenMeta}>Last notification: {state.lastNotification}</Text>
      <Text style={[styles.screenMeta, toneStyle]}>{state.message}</Text>
      <Text
        style={[
          styles.screenMeta,
          state.cloudStatus === 'error'
            ? styles.ritualStateError
            : state.cloudStatus === 'synced'
              ? styles.ritualStateOk
              : styles.screenMeta,
        ]}
      >
        {state.cloudMessage}
      </Text>
      <Text style={[styles.screenMeta, testToneStyle]}>Test push: {testState.message}</Text>
      <Text
        style={[
          styles.screenMeta,
          localSimState.status === 'error'
            ? styles.ritualStateError
            : localSimState.status === 'success'
              ? styles.ritualStateOk
              : styles.screenMeta,
        ]}
      >
        Local sim: {localSimState.message}
      </Text>
      {testState.status === 'success' ? (
        <>
          <Text style={styles.screenMeta}>
            Sent: {testState.sentCount} | Tickets: {testState.ticketCount} | Ticket IDs:{' '}
            {testState.ticketIdCount} | Expo errors: {testState.errorCount}
          </Text>
          <Text style={[styles.screenMeta, receiptToneStyle]}>
            Receipt: {testState.receiptStatus} | Checked: {testState.receiptCheckedCount} | Ok:{' '}
            {testState.receiptOkCount} | Error: {testState.receiptErrorCount} | Pending:{' '}
            {testState.receiptPendingCount}
          </Text>
          {testState.receiptMessage ? (
            <Text style={[styles.screenMeta, receiptToneStyle]}>{testState.receiptMessage}</Text>
          ) : null}
          {testState.receiptErrorPreview ? (
            <Text style={[styles.screenMeta, styles.ritualStateError]}>
              Receipt error sample: {testState.receiptErrorPreview}
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.ritualActionRow}>
        <Pressable
          style={[
            styles.retryButton,
            isBusy || !isSignedIn || !pushEnabled ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy || !isSignedIn || !pushEnabled}
          onPress={onRegister}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Push izin ve token yenile"
          accessibilityState={{ disabled: isBusy || !isSignedIn || !pushEnabled }}
        >
          <Text style={styles.retryText}>
            {isBusy ? 'Push Kaydi Suruyor...' : 'Push Izin + Token Yenile'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.retryButton,
            isTestBusy || !canSendTest || !pushEnabled ? styles.claimButtonDisabled : null,
          ]}
          disabled={isTestBusy || !canSendTest || !pushEnabled}
          onPress={onSendTest}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Kendime test push gonder"
          accessibilityState={{ disabled: isTestBusy || !canSendTest || !pushEnabled }}
        >
          <Text style={styles.retryText}>
            {isTestBusy ? 'Test Push Gonderiliyor...' : 'Kendime Test Push Gonder'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.retryButton,
            isLocalSimBusy || !pushEnabled ? styles.claimButtonDisabled : null,
          ]}
          disabled={isLocalSimBusy || !pushEnabled}
          onPress={onSimulateLocal}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Local push simulasyonu baslat"
          accessibilityState={{ disabled: isLocalSimBusy || !pushEnabled }}
        >
          <Text style={styles.retryText}>
            {isLocalSimBusy ? 'Local Sim Gonderiliyor...' : 'Emulator Local Push Simule Et'}
          </Text>
        </Pressable>
      </View>
      {!canSendTest ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Test push icin cloud sync status "synced" olmali.
        </Text>
      ) : null}
    </ScreenCard>
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

  const sortedItems = useMemo(() => {
    return [...state.items].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  }, [state.items]);
  const visibleItems = sortedItems.slice(0, 10);

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
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Bildirim Kutusu</Text>
      <Text style={styles.screenBody}>
        Son gelen bildirimler burada listelenir. Bildirime dokununca otomatik okundu olur.
      </Text>
      <Text style={styles.screenMeta}>
        Toplam: {state.items.length} | Okunmamis link: {unreadCount}
      </Text>
      <Text style={styles.screenMeta}>Yenilemek icin sayfayi yukaridan asagi cek.</Text>
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

      {sortedItems.length === 0 ? (
        <Text style={styles.screenMeta}>
          Kutunda hic bildirim bulunmuyor.
        </Text>
      ) : (
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
      )}

      <Pressable
        style={[styles.retryButton, isBusy || state.items.length === 0 ? styles.claimButtonDisabled : null]}
        disabled={isBusy || state.items.length === 0}
        onPress={onClear}
        hitSlop={PRESSABLE_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Bildirim kutusunu temizle"
        accessibilityState={{ disabled: isBusy || state.items.length === 0 }}
      >
        <Text style={styles.retryText}>Bildirimleri Temizle</Text>
      </Pressable>
    </ScreenCard>
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
  onOpenAuthorProfile: (item: CommentFeedState['items'][number]) => void;
  onRefresh: () => void;
  selectedMovieTitle?: string | null;
  movieFilterMode?: 'all' | 'selected_movie';
}) => {
  const isBusy = state.status === 'loading';
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
        <Text style={styles.screenMeta}>Yorumlari gormek icin once bir film sec.</Text>
      ) : visibleItems.length === 0 ? (
        <Text style={styles.screenMeta}>Bu filtrede yorum bulunamadi.</Text>
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
                <Text style={styles.commentFeedMeta}>{item.timestampLabel}</Text>
              </View>
              <Text style={styles.commentFeedBody}>{item.text}</Text>
              <View style={styles.commentFeedActionRow}>
                <Text style={styles.commentFeedMeta}>
                  Echo: {item.echoCount} | Reply: {item.replyCount}
                  {showOpsMeta ? `  |  ops::day:${item.dayKey || '?'}` : ''}
                </Text>
              </View>
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
      <ScreenCard accent="sage">
        <Text style={styles.screenTitle}>Gunun Secimi</Text>
        <Text style={styles.screenBody}>Bugunun secimi yukleniyor...</Text>
      </ScreenCard>
    );
  }

  if (state.status === 'error') {
    return (
      <ScreenCard accent="sage">
        <Text style={styles.screenTitle}>Gunun Secimi</Text>
        <Text style={styles.screenBody}>Bugunun secimi su an yuklenemedi.</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {state.message}
          </Text>
          {showOpsMeta ? <Text style={styles.screenMeta}>Error Trace: {state.message}</Text> : null}
          {showOpsMeta ? <Text style={styles.screenMeta}>Endpoint: {state.endpoint || 'unset'}</Text> : null}
        </View>
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Gunluk secimi tekrar dene"
        >
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </Pressable>
      </ScreenCard>
    );
  }

  if (state.status !== 'success') {
    return null;
  }

  const successState = state;
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

  const submitToneStyle =
    submitState.status === 'error'
      ? styles.ritualStateError
      : submitState.status === 'queued'
        ? styles.ritualStateWarn
        : styles.ritualStateOk;

  const queueToneStyle = queueState.status === 'error' ? styles.ritualStateError : styles.ritualStateOk;

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>Ritual Notu</Text>
      <Text style={styles.screenBody}>
        Daily listesinden bir filme kisa yorum yaz. Baglanti hatasinda taslak otomatik kuyruga alinir.
      </Text>
      <Text style={styles.screenMeta}>Film: {targetMovie?.title || 'Daily data bekleniyor'}</Text>
      <Text style={styles.screenMeta}>Tur: {targetMovie?.genre || 'unknown'}</Text>

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

      {!isSignedIn ? (
        <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
          Ritual gonderimi icin once Session kartindan giris yap.
        </Text>
      ) : null}

      {submitState.message ? <Text style={[styles.screenMeta, submitToneStyle]}>{submitState.message}</Text> : null}
      {queueState.message ? <Text style={[styles.screenMeta, queueToneStyle]}>{queueState.message}</Text> : null}

      <View style={styles.ritualActionRow}>
        <Pressable
          style={[
            styles.claimButton,
            submitState.status === 'submitting' || !canSubmit ? styles.claimButtonDisabled : null,
          ]}
          disabled={submitState.status === 'submitting' || !canSubmit}
          onPress={onSubmit}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={submitState.status === 'submitting' ? 'Ritual gonderiliyor' : 'Ritual kaydet'}
          accessibilityState={{ disabled: submitState.status === 'submitting' || !canSubmit }}
        >
          <Text style={styles.claimButtonText}>
            {submitState.status === 'submitting' ? 'Gonderiliyor...' : 'Ritual Kaydet'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.retryButton, !canRetryQueue ? styles.claimButtonDisabled : null]}
          disabled={!canRetryQueue}
          onPress={onFlushQueue}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Kuyrugu tekrar dene"
          accessibilityState={{ disabled: !canRetryQueue }}
        >
          <Text style={styles.retryText}>
            {queueState.status === 'syncing' ? 'Kuyruk Senkron...' : 'Kuyrugu Tekrar Dene'}
          </Text>
        </Pressable>
      </View>
    </ScreenCard>
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
  onSignOut: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'appearance' | 'session'>('identity');
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setActiveTab('identity');
    setConfirmLogout(false);
  }, [visible]);

  if (!visible) return null;
  const isSaving = saveState.status === 'saving';
  const saveTone =
    saveState.status === 'error'
      ? styles.ritualStateError
      : saveState.status === 'success'
        ? styles.ritualStateOk
        : styles.screenMeta;
  const inviteStatusTone = inviteStatus.toLowerCase().includes('hata')
    ? styles.ritualStateError
    : inviteStatus.toLowerCase().includes('uygulandi') || inviteStatus.toLowerCase().includes('kopyalandi')
      ? styles.ritualStateOk
      : styles.screenMeta;
  const handleSignOutPress = () => {
    if (!isSignedIn || isInviteActionBusy) return;
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setConfirmLogout(false);
    onSignOut();
  };

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

          {saveState.message ? <Text style={[styles.screenMeta, saveTone]}>{saveState.message}</Text> : null}

          <ScrollView contentContainerStyle={styles.modalSheetScroll}>
            {activeTab === 'identity' ? (
              <ScreenCard accent="clay">
                <Text style={styles.screenTitle}>Kimlik</Text>
                <Text style={styles.subSectionLabel}>Avatar</Text>
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
                <Text style={styles.screenMeta}>
                  Avatar URL yerine cihazdan manuel secim kullaniliyor.
                </Text>
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
                <Text style={styles.subSectionLabel}>Profil Linki</Text>
                <TextInput
                  style={styles.input}
                  value={identityDraft.profileLink}
                  onChangeText={(value) => onChangeIdentity({ profileLink: value })}
                  placeholder="Web sitesi veya sosyal profil URL"
                  placeholderTextColor="#8e8b84"
                  autoCapitalize="none"
                  accessibilityLabel="Profil Linki"
                />
                <UiButton
                  label={isSaving ? 'Kaydediliyor...' : 'Kimligi Kaydet'}
                  tone="brand"
                  onPress={onSaveIdentity}
                  disabled={isSaving || !isSignedIn}
                />
                <Text style={styles.subSectionLabel}>Letterboxd Import</Text>
                <Text style={styles.screenMeta}>
                  Webdeki CSV import akisi mobilde sonraki surumde acilacak.
                </Text>
              </ScreenCard>
            ) : null}

            {activeTab === 'appearance' ? (
              <ScreenCard accent="sage">
                <Text style={styles.screenTitle}>Gorunum</Text>
                <Text style={styles.subSectionLabel}>Tema</Text>
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
                <Text style={styles.subSectionLabel}>Dil</Text>
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
              </ScreenCard>
            ) : null}

            {activeTab === 'session' ? (
              <>
                <ScreenCard accent="clay">
                  <Text style={styles.screenTitle}>Oturum</Text>
                  <Text style={styles.screenMeta}>Aktif hesap: {activeAccountLabel}</Text>
                  <Text style={styles.screenMeta}>Email: {activeEmailLabel}</Text>
                </ScreenCard>

                <ScreenCard accent="sage">
                  <Text style={styles.screenTitle}>Davet Programi</Text>
                  <Text style={styles.screenBody}>
                    Linkini paylas; yeni kullanici geldiginde iki taraf da XP kazanir.
                  </Text>
                  <Text style={styles.subSectionLabel}>Kodun</Text>
                  <Text style={styles.screenMeta}>{inviteCode || '-'}</Text>
                  <Text style={styles.screenMeta}>Link: {inviteLink || 'hazirlaniyor'}</Text>
                  <UiButton
                    label={isInviteActionBusy ? 'Isleniyor...' : 'Linki Kopyala'}
                    tone="neutral"
                    onPress={onCopyInviteLink}
                    disabled={!canCopyInviteLink || isInviteActionBusy}
                    style={styles.exploreRouteAction}
                  />

                  <Text style={[styles.screenMeta, styles.ritualStateWarn]}>{inviteStatsLabel}</Text>
                  <Text style={styles.screenMeta}>{inviteRewardLabel}</Text>

                  {invitedByCode ? (
                    <Text style={styles.screenMeta}>Kullanilan kod: {invitedByCode}</Text>
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
                        disabled={isInviteActionBusy || !isSignedIn || !inviteCodeDraft.trim()}
                      />
                    </>
                  )}

                  {inviteStatus ? <Text style={[styles.screenMeta, inviteStatusTone]}>{inviteStatus}</Text> : null}
                </ScreenCard>

                <ScreenCard accent="clay">
                  <Text style={styles.subSectionLabel}>Oturum Kontrolu</Text>
                  <UiButton
                    label={confirmLogout ? 'Tekrar Tikla ve Cik' : 'Cikis Yap'}
                    tone="neutral"
                    onPress={handleSignOutPress}
                    disabled={!isSignedIn || isInviteActionBusy}
                    style={styles.exploreRouteAction}
                  />
                </ScreenCard>

                <ScreenCard accent="sage">
                  <Text style={styles.screenTitle}>Platform Kurallari</Text>
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
                </ScreenCard>
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

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>Davet Onayi</Text>
      <Text style={styles.screenBody}>Davet kodunu backend uzerinden dogrula ve uygula.</Text>
      <Text style={styles.screenMeta}>Invite: {inviteCode || 'none'}</Text>

      {inviteCode ? (
        <Pressable
          style={[styles.claimButton, isLoading ? styles.claimButtonDisabled : null]}
          onPress={() => onClaim(inviteCode)}
          disabled={isLoading}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={isLoading ? 'Davet kodu kontrol ediliyor' : 'Davet kodunu uygula'}
          accessibilityState={{ disabled: isLoading }}
        >
          <Text style={styles.claimButtonText}>
            {isLoading ? 'Kontrol ediliyor...' : 'Davet Kodunu Uygula'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.screenMeta}>Deep link icinde davet kodu yok.</Text>
      )}

      {claimState.status === 'success' ? (
        <View style={styles.claimSuccess}>
          <Text style={styles.claimSuccessText}>{claimState.message}</Text>
          <Text style={styles.screenMeta}>Invitee XP: +{claimState.inviteeRewardXp}</Text>
          <Text style={styles.screenMeta}>Inviter XP: +{claimState.inviterRewardXp}</Text>
          <Text style={styles.screenMeta}>Claim count: {claimState.claimCount}</Text>
        </View>
      ) : null}

      {claimState.status === 'error' ? (
        <View style={styles.claimError}>
          <Text style={styles.claimErrorText}>{claimState.message}</Text>
          <Text style={styles.screenMeta}>Error code: {claimState.errorCode}</Text>
        </View>
      ) : null}
    </ScreenCard>
  );
};

const ShareHubScreen = ({
  inviteCode,
  platform,
  goal,
}: {
  inviteCode?: string;
  platform?: string;
  goal?: string;
}) => (
  <ScreenCard accent="sage">
    <Text style={styles.screenTitle}>Paylasim Merkezi</Text>
    <Text style={styles.screenBody}>Paylasim hedefi bazli mobil ekran.</Text>
    <Text style={styles.screenMeta}>Platform: {platform || 'none'}</Text>
    <Text style={styles.screenMeta}>Goal: {goal || 'none'}</Text>
    <Text style={styles.screenMeta}>Invite: {inviteCode || 'none'}</Text>
  </ScreenCard>
);

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
  profileHref?: string;
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
}) => (
  <ScreenCard accent="sage">
    <Text style={styles.screenTitle}>Kesif Rotalari</Text>
    <Text style={styles.screenBody}>
      Webdeki kesif alanlarini mobile ayni dilde tasidik. Kategori secip ilgili rotayi ac.
    </Text>
    <View style={styles.exploreRouteList}>
      {routes.map((route) => (
        <View key={route.id} style={styles.exploreRouteRow}>
          <View style={styles.exploreRouteContent}>
            <Text style={styles.exploreRouteTitle}>{route.title}</Text>
            <Text style={styles.exploreRouteBody}>{route.description}</Text>
            {!route.href ? (
              <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
                Web URL konfigrasyonu bekleniyor.
              </Text>
            ) : null}
          </View>
          <UiButton
            label={route.href ? 'Ac' : 'Bekle'}
            tone="neutral"
            onPress={() => onOpenRoute(route)}
            style={styles.exploreRouteAction}
            accessibilityLabel={`${route.title} rotasini ac`}
            disabled={!route.href}
          />
        </View>
      ))}
    </View>
  </ScreenCard>
);

const ArenaChallengeCard = ({
  streakLabel,
  ritualsLabel,
  onOpenDaily,
}: {
  streakLabel: string;
  ritualsLabel: string;
  onOpenDaily: () => void;
}) => (
  <ScreenCard accent="clay">
    <Text style={styles.screenTitle}>Arena Ozeti</Text>
    <Text style={styles.screenBody}>
      Haftalik challenge akisina hizli giris. Gunluk ritual ritmi Arena puanina dogrudan yansir.
    </Text>
    <View style={styles.arenaMetricGrid}>
      <View style={styles.arenaMetricCard}>
        <Text style={styles.arenaMetricValue}>{streakLabel}</Text>
        <Text style={styles.arenaMetricLabel}>Seri</Text>
      </View>
      <View style={styles.arenaMetricCard}>
        <Text style={styles.arenaMetricValue}>{ritualsLabel}</Text>
        <Text style={styles.arenaMetricLabel}>Ritual</Text>
      </View>
      <View style={styles.arenaMetricCard}>
        <Text style={styles.arenaMetricValue}>Haftalik</Text>
        <Text style={styles.arenaMetricLabel}>Challenge</Text>
      </View>
    </View>
    <Text style={styles.screenMeta}>Haftalik leaderboard ve profil gecisleri asagidaki kartta.</Text>
    <UiButton
      label="Gunluk Akisa Gec"
      tone="brand"
      onPress={onOpenDaily}
      accessibilityLabel="Gunluk akis sekmesine git"
    />
  </ScreenCard>
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
  <ScreenCard accent="sage">
    <Text style={styles.screenTitle}>Arena Leaderboard</Text>
    <Text style={styles.screenBody}>
      Son ritual aktivitesinden uretilen haftalik siralama. Profilleri tek dokunusta acabilirsin.
    </Text>
    <Text style={styles.screenMeta}>Kaynak: {state.source === 'live' ? 'canli' : 'fallback'}</Text>
    <Text
      style={[
        styles.screenMeta,
        state.status === 'error'
          ? styles.ritualStateError
          : state.source === 'live'
            ? styles.ritualStateOk
            : styles.ritualStateWarn,
      ]}
    >
      {state.message}
    </Text>
    <View style={styles.arenaLeaderboardList}>
      {state.entries.map((item) => (
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
            <Text style={styles.arenaLeaderboardName}>{item.displayName}</Text>
            <Text style={styles.arenaLeaderboardMeta}>
              Ritual {item.ritualsCount} | Echo {item.echoCount}
            </Text>
          </View>
          <UiButton
            label={item.profileHref ? 'Profil' : 'Yok'}
            tone="neutral"
            onPress={() => onOpenProfile(item)}
            disabled={!item.profileHref}
            style={styles.arenaLeaderboardAction}
            accessibilityLabel={`${item.displayName} profilini ac`}
          />
        </View>
      ))}
    </View>
    <UiButton
      label={state.status === 'loading' ? 'Yenileniyor...' : 'Leaderboard Yenile'}
      tone="neutral"
      onPress={onRefresh}
      disabled={state.status === 'loading'}
      accessibilityLabel="Arena leaderboard yenile"
    />
  </ScreenCard>
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
  hasWebBase,
}: {
  profileInput: string;
  onProfileInputChange: (value: string) => void;
  onOpenProfile: () => void;
  canOpenProfile: boolean;
  hasWebBase: boolean;
}) => (
  <ScreenCard accent="clay">
    <Text style={styles.screenTitle}>Public Profile Gecisi</Text>
    <Text style={styles.screenBody}>
      Kullanici adini girip web public profile ekranina mobil icinden gecis yap.
    </Text>
    {!hasWebBase ? (
      <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
        Web base URL tanimli degil. EXPO_PUBLIC_WEB_BASE_URL kontrol edilmeli.
      </Text>
    ) : null}
    <TextInput
      style={styles.publicProfileInput}
      value={profileInput}
      onChangeText={onProfileInputChange}
      autoCapitalize="none"
      placeholder="kullanici-adi"
      placeholderTextColor="#8e8b84"
      accessibilityLabel="Public profile kullanici adi"
    />
    <UiButton
      label={canOpenProfile ? 'Profili Ac' : 'Kullanici Adi Bekleniyor'}
      tone="neutral"
      onPress={onOpenProfile}
      disabled={!canOpenProfile}
      accessibilityLabel="Public profile ac"
    />
  </ScreenCard>
);

const PublicProfileDetailCard = ({
  status,
  message,
  displayNameHint,
  profile,
  isSignedIn,
  followStatus,
  isFollowing,
  isSelfProfile,
  followMessage,
  onToggleFollow,
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
  isSelfProfile: boolean;
  followMessage: string;
  onToggleFollow: () => void;
  onBack: () => void;
  onRefresh: () => void;
}) => {
  const profileDisplayName = String(profile?.displayName || displayNameHint || '@bilinmeyen').trim();
  const ritualsCount = Math.max(0, Number(profile?.ritualsCount || 0));
  const followingCount = Math.max(0, Number(profile?.followingCount || 0));
  const followersCount = Math.max(0, Number(profile?.followersCount || 0));
  const isFollowBusy = followStatus === 'loading';

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>{profileDisplayName || '@bilinmeyen'}</Text>
      <Text style={styles.screenBody}>{status === 'loading' ? 'Profil yukleniyor...' : message}</Text>
      {profile ? (
        <View style={styles.profileBadgeList}>
          <Text style={styles.screenMeta}>Rituals: {ritualsCount}</Text>
          <Text style={styles.screenMeta}>Takip: {followingCount} / Takipci: {followersCount}</Text>
        </View>
      ) : null}
      {!isSelfProfile && isSignedIn && profile ? (
        <Pressable
          style={[styles.claimButton, isFollowBusy ? styles.claimButtonDisabled : null]}
          onPress={onToggleFollow}
          disabled={isFollowBusy}
          hitSlop={PRESSABLE_HIT_SLOP}
        >
          <Text style={styles.claimButtonText}>{isFollowing ? 'Takipten Cik' : 'Takip Et'}</Text>
        </Pressable>
      ) : null}
      {followMessage ? (
        <Text
          style={[
            styles.screenMeta,
            followStatus === 'error'
              ? styles.ritualStateError
              : followStatus === 'ready'
                ? styles.ritualStateOk
                : styles.screenMeta,
          ]}
        >
          {followMessage}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Pressable style={styles.retryButton} onPress={onRefresh} hitSlop={PRESSABLE_HIT_SLOP}>
          <Text style={styles.retryText}>Yenile</Text>
        </Pressable>
        <Pressable
          style={[styles.retryButton, { backgroundColor: 'transparent' }]}
          onPress={onBack}
          hitSlop={PRESSABLE_HIT_SLOP}
        >
          <Text style={styles.retryText}>Kapat</Text>
        </Pressable>
      </View>
    </ScreenCard>
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
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Platform Kurallari</Text>
      <Text style={styles.screenBody}>
        Webdeki manifesto ve kural diliyle ayni cekirdek prensipler mobile de gecerli.
      </Text>
      <View style={styles.rulesList}>
        {rules.map((rule, index) => (
          <View key={`rule-${index}`} style={styles.rulesRow}>
            <View style={styles.rulesDot} />
            <Text style={styles.rulesText}>{rule}</Text>
          </View>
        ))}
      </View>
    </ScreenCard>
  );
};

export {
  setAppScreensThemeMode,
  AuthCard,
  ThemeModeCard,
  ScreenErrorBoundary,
  MobileSettingsModal,
  ProfileSnapshotCard,
  ProfileMarksCard,
  PushStatusCard,
  PushInboxCard,
  CommentFeedCard,
  DailyHomeScreen,
  RitualDraftCard,
  RitualComposerModal,
  InviteClaimScreen,
  ShareHubScreen,
  DiscoverRoutesCard,
  ArenaChallengeCard,
  ArenaLeaderboardCard,
  PublicProfileBridgeCard,
  PublicProfileDetailCard,
  PlatformRulesCard,
  MovieDetailsModal,
};

export type {
  MobileSettingsGender,
  MobileSettingsLanguage,
  MobileSettingsIdentityDraft,
  MobileSettingsSaveState,
};
