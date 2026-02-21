import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native';
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
  PUSH_INBOX_PAGE_SIZE,
} from './appTypes';

const PRESSABLE_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;

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

const buildHighlightedNodes = (value: string, normalizedSearch: string): ReactNode => {
  const text = String(value || '');
  if (!normalizedSearch) return text;
  const query = normalizedSearch;
  const lowerText = text.toLowerCase();
  if (!lowerText.includes(query)) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let keyIndex = 0;
  while (cursor < text.length) {
    const foundIndex = lowerText.indexOf(query, cursor);
    if (foundIndex < 0) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (foundIndex > cursor) {
      nodes.push(text.slice(cursor, foundIndex));
    }
    nodes.push(
      <Text key={`h-${keyIndex}`} style={styles.inboxHighlight}>
        {text.slice(foundIndex, foundIndex + query.length)}
      </Text>
    );
    keyIndex += 1;
    cursor = foundIndex + query.length;
  }
  return nodes;
};

const PushInboxRowCard = memo(
  ({
    item,
    normalizedSearch,
    showOpsMeta,
    isCopied,
    onOpenDeepLink,
    onCopyDeepLink,
  }: {
    item: PushInboxItem;
    normalizedSearch: string;
    showOpsMeta: boolean;
    isCopied: boolean;
    onOpenDeepLink: (item: PushInboxItem) => void;
    onCopyDeepLink: (item: PushInboxItem) => void;
  }) => {
    const isActionable = Boolean(item.deepLink);
    const idPreview = item.notificationId ? item.notificationId.slice(-8) : 'none';
    const stateLabel = item.opened ? 'acildi' : 'yeni';
    const highlightedTitle = useMemo(
      () => buildHighlightedNodes(item.title, normalizedSearch),
      [item.title, normalizedSearch]
    );
    const highlightedBody = useMemo(
      () => buildHighlightedNodes(item.body, normalizedSearch),
      [item.body, normalizedSearch]
    );
    const highlightedDeepLink = useMemo(
      () => buildHighlightedNodes(item.deepLink || 'none', normalizedSearch),
      [item.deepLink, normalizedSearch]
    );

    return (
      <View style={styles.inboxRow}>
        <Text style={styles.inboxTitle}>
          {highlightedTitle}{' '}
          <Text style={styles.inboxTitleState}>({stateLabel})</Text>
        </Text>
        {showOpsMeta ? (
          <Text style={styles.inboxMeta}>
            {item.receivedAt} | source: {item.source} | type: {item.kind} | id: {idPreview}
          </Text>
        ) : (
          <Text style={styles.inboxMeta}>{item.receivedAt}</Text>
        )}
        {item.body ? <Text style={styles.inboxBody}>{highlightedBody}</Text> : null}
        {showOpsMeta ? (
          <Text selectable style={styles.inboxMeta}>
            Deep-link: {highlightedDeepLink}
          </Text>
        ) : (
          <Text style={styles.inboxMeta}>
            {isActionable ? 'Yonlendirme baglantisi hazir.' : 'Yonlendirme baglantisi yok.'}
          </Text>
        )}
        <View style={styles.inboxActionRow}>
          <Pressable
            style={[styles.inboxOpenButton, !isActionable ? styles.claimButtonDisabled : null]}
            disabled={!isActionable}
            onPress={() => onOpenDeepLink(item)}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={isActionable ? 'Yonlendirmeyi ac' : 'Yonlendirme yok'}
            accessibilityState={{ disabled: !isActionable }}
          >
            <Text style={styles.retryText}>{isActionable ? 'Deep-link Ac' : 'Deep-link Yok'}</Text>
          </Pressable>
          <Pressable
            style={[styles.inboxCopyButton, !isActionable ? styles.claimButtonDisabled : null]}
            disabled={!isActionable}
            onPress={() => onCopyDeepLink(item)}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={isCopied ? 'Link kopyalandi' : 'Link kopyala'}
            accessibilityState={{ disabled: !isActionable }}
          >
            <Text style={styles.retryText}>{isCopied ? 'Kopyalandi' : 'Link Kopyala'}</Text>
          </Pressable>
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.item === next.item &&
    prev.normalizedSearch === next.normalizedSearch &&
    prev.showOpsMeta === next.showOpsMeta &&
    prev.isCopied === next.isCopied
);

const PushInboxCard = ({
  state,
  showOpsMeta = false,
  onReload,
  onClear,
  onOpenDeepLink,
  onMarkScopeOpened,
  onRemoveScope,
}: {
  state: PushInboxState;
  showOpsMeta?: boolean;
  onReload: () => void;
  onClear: () => void;
  onOpenDeepLink: (item: PushInboxItem) => void;
  onMarkScopeOpened: (ids: string[]) => void;
  onRemoveScope: (ids: string[]) => void;
}) => {
  const [copiedItemId, setCopiedItemId] = useState('');
  const [page, setPage] = useState(1);
  const isBusy = state.status === 'loading';
  const unreadCount = state.items.filter((item) => !item.opened && Boolean(item.deepLink)).length;

  const sortedItems = useMemo(() => {
    return [...state.items].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  }, [state.items]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PUSH_INBOX_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PUSH_INBOX_PAGE_SIZE;
  const pagedItems = sortedItems.slice(pageStart, pageStart + PUSH_INBOX_PAGE_SIZE);

  const scopeIds = useMemo(() => sortedItems.map((item) => item.id), [sortedItems]);
  const unopenedScopeIds = useMemo(
    () => sortedItems.filter((item) => !item.opened).map((item) => item.id),
    [sortedItems]
  );

  useEffect(() => {
    if (!copiedItemId) return;
    const timer = setTimeout(() => setCopiedItemId(''), 1600);
    return () => clearTimeout(timer);
  }, [copiedItemId]);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const handleCopyDeepLink = useCallback(async (item: PushInboxItem) => {
    const deepLink = String(item.deepLink || '').trim();
    if (!deepLink) return;
    try {
      await Clipboard.setStringAsync(deepLink);
      setCopiedItemId(item.id);
    } catch {
      setCopiedItemId('');
    }
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    setPage(Math.max(1, currentPage - 1));
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage >= totalPages) return;
    setPage(Math.min(totalPages, currentPage + 1));
  }, [currentPage, totalPages]);

  const renderInboxRow = useCallback(
    ({ item }: { item: PushInboxItem }) => (
      <PushInboxRowCard
        item={item}
        normalizedSearch=""
        showOpsMeta={showOpsMeta}
        isCopied={copiedItemId === item.id}
        onOpenDeepLink={onOpenDeepLink}
        onCopyDeepLink={handleCopyDeepLink}
      />
    ),
    [copiedItemId, handleCopyDeepLink, onOpenDeepLink, showOpsMeta]
  );

  return (
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Bildirim Kutusu</Text>
      <Text style={styles.screenBody}>
        Son gelen bildirimleri saklar. Linkli olanlari tek tikla acabilirsin.
      </Text>
      <Text style={styles.screenMeta}>
        Toplam: {state.items.length} bildirimi | Yeni link: {unreadCount}
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



      {sortedItems.length === 0 ? (
        <Text style={styles.screenMeta}>
          Kutunda hic bildirim bulunmuyor.
        </Text>
      ) : (
        <FlatList
          data={pagedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderInboxRow}
          scrollEnabled={false}
          initialNumToRender={PUSH_INBOX_PAGE_SIZE}
          maxToRenderPerBatch={PUSH_INBOX_PAGE_SIZE + 2}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ItemSeparatorComponent={() => <View style={styles.inboxItemSeparator} />}
          contentContainerStyle={styles.inboxList}
        />
      )}

      {sortedItems.length > 0 ? (
        <View style={styles.inboxPaginationRow}>
          <Pressable
            style={[
              styles.inboxPageButton,
              currentPage <= 1 ? styles.claimButtonDisabled : null,
            ]}
            disabled={currentPage <= 1}
            onPress={handlePrevPage}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Onceki sayfaya git"
            accessibilityState={{ disabled: currentPage <= 1 }}
          >
            <Text style={styles.retryText}>Onceki</Text>
          </Pressable>
          <Text style={styles.inboxPaginationText}>
            Sayfa {currentPage} / {totalPages}
          </Text>
          <Pressable
            style={[
              styles.inboxPageButton,
              currentPage >= totalPages ? styles.claimButtonDisabled : null,
            ]}
            disabled={currentPage >= totalPages}
            onPress={handleNextPage}
            hitSlop={PRESSABLE_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Sonraki sayfaya git"
            accessibilityState={{ disabled: currentPage >= totalPages }}
          >
            <Text style={styles.retryText}>Sonraki</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.subSectionLabel}>Toplu Islemler</Text>
      <View style={styles.ritualActionRow}>
        <Pressable
          style={[
            styles.inboxBulkOpenButton,
            isBusy || unopenedScopeIds.length === 0 ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy || unopenedScopeIds.length === 0}
          onPress={() => onMarkScopeOpened(unopenedScopeIds)}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Secili bildirimleri acildi olarak isaretle"
          accessibilityState={{ disabled: isBusy || unopenedScopeIds.length === 0 }}
        >
          <Text style={styles.retryText}>Okundu Yap ({unopenedScopeIds.length})</Text>
        </Pressable>
        <Pressable
          style={[
            styles.inboxBulkRemoveButton,
            isBusy || scopeIds.length === 0 ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy || scopeIds.length === 0}
          onPress={() => onRemoveScope(scopeIds)}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Secili bildirimleri temizle"
          accessibilityState={{ disabled: isBusy || scopeIds.length === 0 }}
        >
          <Text style={styles.retryText}>Hepsini Temizle ({scopeIds.length})</Text>
        </Pressable>
      </View>

      <Text style={styles.subSectionLabel}>Kutu Islemleri</Text>
      <View style={styles.ritualActionRow}>
        <Pressable
          style={[styles.retryButton, isBusy ? styles.claimButtonDisabled : null]}
          disabled={isBusy}
          onPress={onReload}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Bildirim kutusunu yenile"
          accessibilityState={{ disabled: isBusy }}
        >
          <Text style={styles.retryText}>{isBusy ? 'Yukleniyor...' : 'Kutuyu Yenile'}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.signOutButton,
            isBusy || state.items.length === 0 ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy || state.items.length === 0}
          onPress={onClear}
          hitSlop={PRESSABLE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Bildirim kutusunu temizle"
          accessibilityState={{ disabled: isBusy || state.items.length === 0 }}
        >
          <Text style={styles.claimButtonText}>Kutuyu Temizle</Text>
        </Pressable>
      </View>
    </ScreenCard>
  );
};

const CommentFeedCard = ({
  state,
  showOpsMeta = false,
  onScopeChange,
  onSortChange,
  onQueryChange,
  onOpenAuthorProfile,
  onRefresh,
}: {
  state: CommentFeedState;
  showOpsMeta?: boolean;
  onScopeChange: (scope: CommentFeedScope) => void;
  onSortChange: (sort: CommentFeedSort) => void;
  onQueryChange: (query: string) => void;
  onOpenAuthorProfile: (item: CommentFeedState['items'][number]) => void;
  onRefresh: () => void;
}) => {
  const isBusy = state.status === 'loading';
  const visibleItems = state.items.slice(0, 40);

  return (
    <ScreenCard accent="clay">
      <Text style={styles.screenTitle}>Tum Yorumlar</Text>
      <Text style={styles.screenBody}>
        Webdeki genel yorum akisinin mobil temeli. Supabase varsa canli, yoksa yerel fallback calisir.
      </Text>
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

      <View style={styles.commentFeedFilterRow}>
        <View style={styles.commentFeedSegmentContainer}>
          <Pressable
            style={[
              styles.commentFeedSegmentOption,
              state.scope === 'all' && styles.commentFeedSegmentActive,
            ]}
            onPress={() => onScopeChange('all')}
            accessibilityLabel="Tum yorumlari goster"
          >
            <Text
              style={[
                styles.commentFeedSegmentText,
                state.scope === 'all' && styles.commentFeedSegmentTextActive,
              ]}
            >
              Tum Akis
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.commentFeedSegmentOption,
              state.scope === 'today' && styles.commentFeedSegmentActive,
            ]}
            onPress={() => onScopeChange('today')}
            accessibilityLabel="Sadece bugun yorumlarini goster"
          >
            <Text
              style={[
                styles.commentFeedSegmentText,
                state.scope === 'today' && styles.commentFeedSegmentTextActive,
              ]}
            >
              Sadece Bugun
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.commentFeedSortRow}>
        <View style={styles.commentFeedSegmentContainer}>
          <Pressable
            style={[
              styles.commentFeedSegmentOption,
              state.sort === 'latest' && styles.commentFeedSegmentActive,
            ]}
            onPress={() => onSortChange('latest')}
            accessibilityLabel="Yorumlari en yeniye gore sirala"
          >
            <Text
              style={[
                styles.commentFeedSegmentText,
                state.sort === 'latest' && styles.commentFeedSegmentTextActive,
              ]}
            >
              En Yeni
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.commentFeedSegmentOption,
              state.sort === 'echoes' && styles.commentFeedSegmentActive,
            ]}
            onPress={() => onSortChange('echoes')}
            accessibilityLabel="Yorumlari en cok echoya gore sirala"
          >
            <Text
              style={[
                styles.commentFeedSegmentText,
                state.sort === 'echoes' && styles.commentFeedSegmentTextActive,
              ]}
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

      {visibleItems.length === 0 ? (
        <Text style={styles.screenMeta}>Bu filtrede yorum bulunamadi.</Text>
      ) : (
        <View style={styles.commentFeedList}>
          {visibleItems.map((item) => (
            <View key={item.id} style={styles.commentFeedRow}>
              <View style={styles.commentFeedRowHeader}>
                <Text style={styles.commentFeedMovieTitle}>{item.movieTitle}</Text>
                {item.isMine ? <Text style={styles.commentFeedMineBadge}>SENIN</Text> : null}
              </View>
              <Text style={styles.commentFeedMeta}>
                @{item.author} | {item.timestampLabel}
              </Text>
              <Text style={styles.commentFeedBody}>{item.text}</Text>
              <View style={styles.commentFeedActionRow}>
                <Text style={styles.commentFeedMeta}>
                  Echo: {item.echoCount} • Reply: {item.replyCount}
                  {showOpsMeta ? `  |  ops::day:${item.dayKey || '?'}` : ''}
                </Text>
                <Pressable hitSlop={PRESSABLE_HIT_SLOP} onPress={() => onOpenAuthorProfile(item)}>
                  <Text style={styles.commentFeedActionText}>@{item.author} Profil</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={[styles.retryButton, isBusy ? styles.claimButtonDisabled : null]}
        disabled={isBusy}
        onPress={onRefresh}
        hitSlop={PRESSABLE_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={isBusy ? 'Yorum akisi yenileniyor' : 'Yorum akisina yenile'}
        accessibilityState={{ disabled: isBusy }}
      >
        <Text style={styles.retryText}>{isBusy ? 'Yukleniyor...' : 'Yorum Akisini Yenile'}</Text>
      </Pressable>
    </ScreenCard>
  );
};

const DailyHomeScreen = ({
  state,
  showOpsMeta = false,
  onRetry,
}: {
  state: DailyState;
  showOpsMeta?: boolean;
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
        {showOpsMeta ? <Text style={styles.screenMeta}>Error: {state.message}</Text> : null}
        {showOpsMeta ? <Text style={styles.screenMeta}>Endpoint: {state.endpoint || 'unset'}</Text> : null}
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

  return (
    <ScreenCard accent="sage">
      <Text style={styles.screenTitle}>Gunun Secimi</Text>
      <Text style={styles.screenBody}>
        {successState.dataSource === 'cache'
          ? 'Baglanti sinirli, son basarili secim gosteriliyor.'
          : successState.dataSource === 'fallback'
            ? 'Servis erisimi olmadigi icin local fallback secim gosteriliyor.'
            : 'Bugunun secimi hazir.'}
      </Text>
      <Text style={styles.screenMeta}>Tarih: {successState.date || 'unknown'}</Text>
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
      {showOpsMeta && successState.warning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>Live fetch warning: {successState.warning}</Text>
        </View>
      ) : null}

      <View style={styles.movieList}>
        {successState.movies.slice(0, 5).map((movie, index) => (
          <View key={`${movie.id}-${index}`} style={styles.movieRow}>
            <Text style={styles.movieTitle}>
              {index + 1}. {movie.title}
            </Text>
            <Text style={styles.movieMeta}>
              {movie.voteAverage ? `Puan ${movie.voteAverage.toFixed(1)}` : 'Puan yok'}
              {movie.genre ? ` | ${movie.genre}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </ScreenCard>
  );
};

const RitualDraftCard = ({
  primaryMovie,
  draftText,
  onDraftTextChange,
  submitState,
  queueState,
  canSubmit,
  isSignedIn,
  onSubmit,
  onFlushQueue,
}: {
  primaryMovie: { title: string; genre: string | null } | null;
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
      <Text style={styles.screenMeta}>Film: {primaryMovie?.title || 'Daily data bekleniyor'}</Text>
      <Text style={styles.screenMeta}>Tur: {primaryMovie?.genre || 'unknown'}</Text>

      <TextInput
        style={styles.ritualInput}
        multiline
        textAlignVertical="top"
        editable={Boolean(primaryMovie)}
        placeholder="180 karakterlik ritual notunu yaz..."
        placeholderTextColor="#8e8b84"
        value={draftText}
        maxLength={180}
        onChangeText={onDraftTextChange}
        accessibilityLabel="Ritual notu"
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
  ritualsCount: number;
  echoCount: number;
  profileHref: string;
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
      Webdeki genel profil ekranina mobil uygulamadan dogrudan gecis yap.
    </Text>
    <Text style={styles.screenMeta}>
      Format: kullanici adi yaz, uygulama `#/u/name:` rotasini otomatik olustursun.
    </Text>
    {!hasWebBase ? (
      <Text style={[styles.screenMeta, styles.ritualStateWarn]}>
        EXPO_PUBLIC_WEB_APP_URL tanimli degil. Profil linki uretilemiyor.
      </Text>
    ) : null}
    <TextInput
      style={styles.publicProfileInput}
      value={profileInput}
      autoCapitalize="none"
      placeholder="ornek: cineast_pro"
      placeholderTextColor="#8e8b84"
      onChangeText={onProfileInputChange}
      accessibilityLabel="Public profile kullanici adi"
    />
    <UiButton
      label="Public Profile Ac"
      tone="teal"
      onPress={onOpenProfile}
      disabled={!canOpenProfile}
      accessibilityLabel="Public profile ac"
    />
  </ScreenCard>
);

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
  AuthCard,
  ThemeModeCard,
  ProfileSnapshotCard,
  ProfileMarksCard,
  PushStatusCard,
  PushInboxCard,
  CommentFeedCard,
  DailyHomeScreen,
  RitualDraftCard,
  InviteClaimScreen,
  ShareHubScreen,
  DiscoverRoutesCard,
  ArenaChallengeCard,
  ArenaLeaderboardCard,
  PublicProfileBridgeCard,
  PlatformRulesCard,
};
