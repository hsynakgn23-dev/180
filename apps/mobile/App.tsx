import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  buildMobileDeepLinkFromRouteIntent,
  parseMobileDeepLink,
  resolveMobileScreenPlan,
  resolveMobileWebPromptDecision,
  type MobileRouteIntent,
} from '../../packages/shared/src/mobile';
import { fetchDailyMovies } from './src/lib/dailyApi';
import { trackMobileEvent } from './src/lib/mobileAnalytics';
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
  readPushInbox,
  type PushInboxItem,
} from './src/lib/mobilePushInbox';
import { sendPushTestNotification } from './src/lib/mobilePushApi';
import { syncPushTokenToProfileState } from './src/lib/mobilePushProfileSync';
import { claimInviteCodeViaApi } from './src/lib/mobileReferralApi';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';

const MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';

const isEnvFlagEnabled = (value: string | undefined, defaultValue = true): boolean => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(normalized);
};

const PUSH_FEATURE_ENABLED = isEnvFlagEnabled(process.env.EXPO_PUBLIC_PUSH_ENABLED, true);

type DailyState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string; endpoint: string }
  | {
      status: 'success';
      endpoint: string;
      date: string | null;
      source: string | null;
      dataSource: 'live' | 'cache';
      cacheAgeSeconds: number | null;
      stale: boolean;
      warning: string | null;
      movies: Array<{ id: number; title: string; voteAverage: number | null; genre: string | null }>;
    };

type InviteClaimState =
  | { status: 'idle' }
  | { status: 'loading'; inviteCode: string }
  | {
      status: 'success';
      inviteCode: string;
      message: string;
      inviteeRewardXp: number;
      inviterRewardXp: number;
      claimCount: number;
    }
  | { status: 'error'; inviteCode: string; message: string; errorCode: string };

type AuthState =
  | { status: 'idle'; message: string }
  | { status: 'loading'; message: string }
  | { status: 'signed_out'; message: string }
  | { status: 'signed_in'; message: string; email: string }
  | { status: 'error'; message: string };

type RitualSubmitState = {
  status: 'idle' | 'submitting' | 'synced' | 'queued' | 'error';
  message: string;
};

type RitualQueueState = {
  status: 'idle' | 'syncing' | 'done' | 'error';
  message: string;
  pendingCount: number;
};

type ProfileState =
  | { status: 'idle' | 'loading'; message: string }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      message: string;
      displayName: string;
      totalXp: number;
      streak: number;
      ritualsCount: number;
      daysPresent: number;
      followersCount: number;
      followingCount: number;
      lastRitualDate: string | null;
      source: 'xp_state' | 'fallback';
    };

type PushState =
  | {
      status: 'idle' | 'loading';
      message: string;
      permissionStatus: string;
      token: string;
      projectId: string | null;
      lastNotification: string;
      cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';
      cloudMessage: string;
      deviceKey: string;
      lastSyncedToken: string;
    }
  | {
      status: 'error' | 'ready' | 'unsupported';
      message: string;
      permissionStatus: string;
      token: string;
      projectId: string | null;
      lastNotification: string;
      cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';
      cloudMessage: string;
      deviceKey: string;
      lastSyncedToken: string;
    };

type PushTestState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  sentCount: number;
  ticketCount: number;
  errorCount: number;
  ticketIdCount: number;
  receiptStatus: 'idle' | 'ok' | 'unavailable';
  receiptCheckedCount: number;
  receiptOkCount: number;
  receiptErrorCount: number;
  receiptPendingCount: number;
  receiptMessage: string;
  receiptErrorPreview: string;
};

type LocalPushSimState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

type PushInboxState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message: string;
  items: PushInboxItem[];
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
  INVALID_CODE: 'Davet kodu gecersiz.',
  INVITE_NOT_FOUND: 'Davet kodu bulunamadi.',
  SELF_INVITE: 'Kendi davet kodunu kullanamazsin.',
  ALREADY_CLAIMED: 'Bu hesap zaten bir davet kodu kullandi.',
  DEVICE_DAILY_LIMIT: 'Gunluk cihaz limiti doldu. Daha sonra tekrar dene.',
  DEVICE_CODE_REUSE: 'Bu cihazda bu kod daha once kullanilmis.',
  SERVER_ERROR: 'Sunucuya ulasilamadi. Birazdan tekrar dene.',
};

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
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Session</Text>
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
            placeholderTextColor="#64748b"
            onChangeText={onEmailChange}
          />
          <TextInput
            style={styles.input}
            value={password}
            autoCapitalize="none"
            secureTextEntry
            returnKeyType="done"
            placeholder="Password"
            placeholderTextColor="#64748b"
            onChangeText={onPasswordChange}
            onSubmitEditing={onSignIn}
          />
          <Pressable
            style={[
              styles.claimButton,
              isBusy ? styles.claimButtonDisabled : null,
              !isConfigured ? styles.claimButtonDisabled : null,
            ]}
            onPress={onSignIn}
            disabled={isBusy || !isConfigured}
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
          >
            <Text style={styles.claimButtonText}>Cikis Yap</Text>
          </Pressable>
        </View>
      )}
    </View>
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
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Profile Snapshot</Text>
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
      >
        <Text style={styles.retryText}>{isRefreshing ? 'Yukleniyor...' : 'Profili Yenile'}</Text>
      </Pressable>
    </View>
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
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Push Status</Text>
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
    </View>
  );
};

const PushInboxCard = ({
  state,
  onReload,
  onClear,
  onOpenDeepLink,
}: {
  state: PushInboxState;
  onReload: () => void;
  onClear: () => void;
  onOpenDeepLink: (item: PushInboxItem) => void;
}) => {
  const isBusy = state.status === 'loading';
  const unreadCount = state.items.filter((item) => !item.opened && Boolean(item.deepLink)).length;
  const previewItems = state.items.slice(0, 6);

  return (
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Notification Inbox</Text>
      <Text style={styles.screenBody}>
        Son gelen bildirimleri saklar. Deep-link icerenleri tek tikla acabilirsin.
      </Text>
      <Text style={styles.screenMeta}>
        Total: {state.items.length} | Unread deep-link: {unreadCount}
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

      {previewItems.length === 0 ? (
        <Text style={styles.screenMeta}>Henüz inbox bildirimi yok.</Text>
      ) : (
        <View style={styles.inboxList}>
          {previewItems.map((item) => {
            const isActionable = Boolean(item.deepLink);
            return (
              <View key={item.id} style={styles.inboxRow}>
                <Text style={styles.inboxTitle}>
                  {item.title} {item.opened ? '(opened)' : '(new)'}
                </Text>
                <Text style={styles.inboxMeta}>
                  {item.receivedAt} | source: {item.source} | type: {item.kind}
                </Text>
                {item.body ? <Text style={styles.inboxBody}>{item.body}</Text> : null}
                <Text style={styles.inboxMeta}>Deep-link: {item.deepLink || 'none'}</Text>
                <Pressable
                  style={[
                    styles.inboxOpenButton,
                    !isActionable ? styles.claimButtonDisabled : null,
                  ]}
                  disabled={!isActionable}
                  onPress={() => onOpenDeepLink(item)}
                >
                  <Text style={styles.retryText}>
                    {isActionable ? 'Deep-link Ac' : 'Deep-link Yok'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.ritualActionRow}>
        <Pressable
          style={[styles.retryButton, isBusy ? styles.claimButtonDisabled : null]}
          disabled={isBusy}
          onPress={onReload}
        >
          <Text style={styles.retryText}>{isBusy ? 'Yukleniyor...' : 'Inbox Yenile'}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.signOutButton,
            isBusy || state.items.length === 0 ? styles.claimButtonDisabled : null,
          ]}
          disabled={isBusy || state.items.length === 0}
          onPress={onClear}
        >
          <Text style={styles.claimButtonText}>Inbox Temizle</Text>
        </Pressable>
      </View>
    </View>
  );
};

const DailyHomeScreen = ({
  state,
  onRetry,
}: {
  state: DailyState;
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
      <View style={styles.screenCard}>
        <Text style={styles.screenTitle}>Daily Home</Text>
        <Text style={styles.screenBody}>Bugunun secimi yukleniyor...</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.screenCard}>
        <Text style={styles.screenTitle}>Daily Home</Text>
        <Text style={styles.screenBody}>Daily API ulasilamadi.</Text>
        <Text style={styles.screenMeta}>Error: {state.message}</Text>
        <Text style={styles.screenMeta}>Endpoint: {state.endpoint || 'unset'}</Text>
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Daily Home</Text>
      <Text style={styles.screenBody}>
        {state.dataSource === 'cache'
          ? 'Offline fallback: son basarili daily cache gosteriliyor.'
          : 'Bugunun secimi API uzerinden yuklendi.'}
      </Text>
      <Text style={styles.screenMeta}>Date: {state.date || 'unknown'}</Text>
      <Text style={styles.screenMeta}>Source: {state.source || 'unknown'}</Text>
      <Text style={styles.screenMeta}>Endpoint: {state.endpoint}</Text>
      <View style={styles.badgeRow}>
        <Text style={styles.screenMeta}>Data: {state.dataSource}</Text>
        <Text style={styles.screenMeta}>Stale: {state.stale ? 'yes' : 'no'}</Text>
        {state.dataSource === 'cache' ? (
          <Text style={styles.screenMeta}>Age: {formatAge(state.cacheAgeSeconds)}</Text>
        ) : null}
      </View>
      {state.warning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>Live fetch warning: {state.warning}</Text>
        </View>
      ) : null}

      <View style={styles.movieList}>
        {state.movies.slice(0, 5).map((movie, index) => (
          <View key={`${movie.id}-${index}`} style={styles.movieRow}>
            <Text style={styles.movieTitle}>
              {index + 1}. {movie.title}
            </Text>
            <Text style={styles.movieMeta}>
              {movie.voteAverage ? `Rating ${movie.voteAverage.toFixed(1)}` : 'Rating n/a'}
              {movie.genre ? ` | ${movie.genre}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Ritual Draft</Text>
      <Text style={styles.screenBody}>
        Daily listesinden bir filme kisa yorum yaz. Baglanti hatasinda taslak otomatik kuyruga alinir.
      </Text>
      <Text style={styles.screenMeta}>Movie: {primaryMovie?.title || 'Daily data bekleniyor'}</Text>
      <Text style={styles.screenMeta}>Genre: {primaryMovie?.genre || 'unknown'}</Text>

      <TextInput
        style={styles.ritualInput}
        multiline
        textAlignVertical="top"
        editable={Boolean(primaryMovie)}
        placeholder="180 karakterlik ritual notunu yaz..."
        placeholderTextColor="#64748b"
        value={draftText}
        maxLength={180}
        onChangeText={onDraftTextChange}
      />

      <View style={styles.ritualMetaRow}>
        <Text style={styles.screenMeta}>{textLength}/180</Text>
        <Text style={styles.screenMeta}>Pending queue: {queueState.pendingCount}</Text>
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
        >
          <Text style={styles.claimButtonText}>
            {submitState.status === 'submitting' ? 'Gonderiliyor...' : 'Ritual Kaydet'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.retryButton, !canRetryQueue ? styles.claimButtonDisabled : null]}
          disabled={!canRetryQueue}
          onPress={onFlushQueue}
        >
          <Text style={styles.retryText}>
            {queueState.status === 'syncing' ? 'Kuyruk Senkron...' : 'Kuyrugu Tekrar Dene'}
          </Text>
        </Pressable>
      </View>
    </View>
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
    <View style={styles.screenCard}>
      <Text style={styles.screenTitle}>Invite Claim</Text>
      <Text style={styles.screenBody}>Davet kodunu backend uzerinden dogrula ve uygula.</Text>
      <Text style={styles.screenMeta}>Invite: {inviteCode || 'none'}</Text>

      {inviteCode ? (
        <Pressable
          style={[styles.claimButton, isLoading ? styles.claimButtonDisabled : null]}
          onPress={() => onClaim(inviteCode)}
          disabled={isLoading}
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
    </View>
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
  <View style={styles.screenCard}>
    <Text style={styles.screenTitle}>Share Hub</Text>
    <Text style={styles.screenBody}>Paylasim hedefi bazli mobil ekran.</Text>
    <Text style={styles.screenMeta}>Platform: {platform || 'none'}</Text>
    <Text style={styles.screenMeta}>Goal: {goal || 'none'}</Text>
    <Text style={styles.screenMeta}>Invite: {inviteCode || 'none'}</Text>
  </View>
);

export default function App() {
  const [lastIncomingUrl, setLastIncomingUrl] = useState<string | null>(null);
  const [lastIncomingIntent, setLastIncomingIntent] = useState<MobileRouteIntent | null>(null);
  const [manualIntent, setManualIntent] = useState<MobileRouteIntent | null>(null);
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

  const promptDecision = useMemo(
    () =>
      resolveMobileWebPromptDecision({
        streak: 4,
        dailyRitualsCount: 2,
        inviteCode: 'ABC12345',
      }),
    []
  );

  const activeIntent = manualIntent || lastIncomingIntent || promptDecision.routeIntent;
  const screenPlan = useMemo(() => resolveMobileScreenPlan(activeIntent), [activeIntent]);

  const deepLink = useMemo(
    () =>
      buildMobileDeepLinkFromRouteIntent(activeIntent, {
        base: MOBILE_DEEP_LINK_BASE,
      }),
    [activeIntent]
  );

  const primaryDailyMovie =
    dailyState.status === 'success' && dailyState.movies.length > 0 ? dailyState.movies[0] : null;

  const isSignedIn = authState.status === 'signed_in';

  const trackEntryIntent = useCallback((intent: MobileRouteIntent, rawUrl: string) => {
    if (intent.target === 'invite') {
      void trackMobileEvent('app_opened_from_invite', {
        inviteCode: intent.invite || null,
        rawUrl,
      });
      return;
    }

    if (intent.target === 'share') {
      void trackMobileEvent('app_opened_from_share', {
        inviteCode: intent.invite || null,
        platform: intent.platform || null,
        goal: intent.goal || null,
        rawUrl,
      });
    }
  }, []);

  const handleIncomingUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      setLastIncomingUrl(url);

      const parsedRoute = parseMobileDeepLink(url);
      if (!parsedRoute) return;

      setLastIncomingIntent(parsedRoute);
      setManualIntent(null);
      trackEntryIntent(parsedRoute, url);
    },
    [trackEntryIntent]
  );

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

  const describePushNotification = useCallback((snapshot: PushNotificationSnapshot): string => {
    const title = snapshot.title || '(no-title)';
    const deepLinkMark = snapshot.deepLink ? 'with-link' : 'no-link';
    return `${snapshot.receivedAt} | ${snapshot.kind} | ${title} | ${deepLinkMark}`;
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
    void Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  const inviteCode =
    activeIntent.target === 'invite' || activeIntent.target === 'share'
      ? activeIntent.invite
      : undefined;
  const sharePlatform = activeIntent.target === 'share' ? activeIntent.platform : undefined;
  const shareGoal = activeIntent.target === 'share' ? activeIntent.goal : undefined;
  const canSubmitRitualDraft = Boolean(
    isSignedIn && primaryDailyMovie && ritualDraftText.trim().length > 0
  );

  useEffect(() => {
    setInviteClaimState({ status: 'idle' });
  }, [screenPlan.screen, inviteCode]);

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>180 Absolute Cinema Mobile</Text>
          <Text style={styles.subtitle}>Phase-1.5 flow routing live.</Text>

          <AuthCard
            authState={authState}
            email={authEmail}
            password={authPassword}
            onEmailChange={setAuthEmail}
            onPasswordChange={setAuthPassword}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />

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

          <PushInboxCard
            state={pushInboxState}
            onReload={() => {
              void refreshPushInbox();
            }}
            onClear={() => {
              void handleClearPushInbox();
            }}
            onOpenDeepLink={(item) => {
              void handleOpenInboxDeepLink(item);
            }}
          />

          <ProfileSnapshotCard
            state={profileState}
            isSignedIn={isSignedIn}
            onRefresh={() => {
              void refreshProfileStats();
            }}
          />

          {screenPlan.screen === 'daily_home' ? (
            <>
              <DailyHomeScreen
                state={dailyState}
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
            </>
          ) : null}
          {screenPlan.screen === 'invite_claim' ? (
            <InviteClaimScreen
              inviteCode={inviteCode}
              claimState={inviteClaimState}
              onClaim={handleClaimInvite}
            />
          ) : null}
          {screenPlan.screen === 'share_hub' ? (
            <ShareHubScreen inviteCode={inviteCode} platform={sharePlatform} goal={shareGoal} />
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionButton}
              onPress={() => setManualIntent({ target: 'daily' })}
            >
              <Text style={styles.actionText}>Daily</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => setManualIntent({ target: 'invite', invite: 'ABC12345' })}
            >
              <Text style={styles.actionText}>Invite</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                setManualIntent({
                  target: 'share',
                  invite: 'ABC12345',
                  platform: 'x',
                  goal: 'streak',
                })
              }
            >
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
          </View>

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
              {lastIncomingIntent ? JSON.stringify(lastIncomingIntent, null, 2) : '(none yet)'}
            </Text>
          </View>
        </ScrollView>
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1321',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 6,
  },
  screenCard: {
    backgroundColor: '#0f172a',
    borderColor: '#2b3650',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  screenTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  screenBody: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  screenMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  movieList: {
    marginTop: 8,
    gap: 8,
  },
  movieRow: {
    padding: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22314a',
  },
  movieTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  movieMeta: {
    marginTop: 2,
    color: '#94a3b8',
    fontSize: 12,
  },
  inboxList: {
    marginTop: 6,
    gap: 8,
  },
  inboxRow: {
    backgroundColor: '#111827',
    borderColor: '#22314a',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  inboxTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  inboxMeta: {
    color: '#94a3b8',
    fontSize: 11,
  },
  inboxBody: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  inboxOpenButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ritualInput: {
    minHeight: 88,
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ritualMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ritualStateOk: {
    color: '#86efac',
  },
  ritualStateWarn: {
    color: '#fbbf24',
  },
  ritualStateError: {
    color: '#fecaca',
  },
  ritualActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileGrid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileMetricCard: {
    minWidth: 90,
    flexGrow: 1,
    backgroundColor: '#111827',
    borderColor: '#22314a',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  profileMetricValue: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  profileMetricLabel: {
    color: '#94a3b8',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeRow: {
    marginTop: 4,
    gap: 2,
  },
  warningBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7c2d12',
    backgroundColor: '#2f1a12',
  },
  warningText: {
    color: '#fdba74',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  authForm: {
    marginTop: 8,
    gap: 8,
  },
  authSignedInBox: {
    marginTop: 8,
    gap: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  claimButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimSuccess: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#14532d',
    backgroundColor: '#0f2a1f',
    gap: 2,
  },
  claimSuccessText: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '600',
  },
  claimError: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#2f1212',
    gap: 2,
  },
  claimErrorText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  code: {
    color: '#cbd5e1',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
