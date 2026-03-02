import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushRegistrationResult =
  | {
      ok: true;
      token: string;
      permissionStatus: string;
      projectId: string | null;
    }
  | {
      ok: false;
      reason:
        | 'not_device'
        | 'permission_denied'
        | 'token_unavailable'
        | 'config_missing'
        | 'unknown';
      message: string;
      permissionStatus: string;
      projectId: string | null;
    };

type PushRegistrationFailureReason = Exclude<PushRegistrationResult, { ok: true }>['reason'];

export type PushNotificationSnapshot = {
  notificationId: string;
  title: string;
  body: string;
  deepLink: string | null;
  kind: 'comment' | 'like' | 'follow' | 'daily_drop' | 'streak' | 'generic';
  receivedAt: string;
};

export type LocalPushSimulationResult =
  | {
      ok: true;
      message: string;
      deepLink: string;
    }
  | {
      ok: false;
      message: string;
      deepLink: string;
      permissionStatus: string;
    };

type NotificationData = Record<string, unknown>;

type NotificationHandlerInput = {
  onNotificationReceived?: (snapshot: PushNotificationSnapshot) => void;
  onNotificationResponse?: (snapshot: PushNotificationSnapshot) => void;
};

type NotificationsModule = typeof ExpoNotifications;

const PUSH_TOKEN_STORAGE_KEY = '180_mobile_push_token_v1';

let notificationsModulePromise: Promise<NotificationsModule> | null = null;

const normalizeText = (value: unknown, maxLength = 300): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizePushRegistrationFailure = (
  rawMessage: string,
  projectId: string | null
): {
  reason: PushRegistrationFailureReason;
  message: string;
} => {
  const compact = normalizeText(rawMessage, 260);
  const lower = compact.toLowerCase();
  const hasProjectId = Boolean(normalizeText(projectId, 80));

  const firebaseInitMissing =
    lower.includes('default firebaseapp is not initialized') ||
    lower.includes('firebaseapp.initializeapp');
  if (firebaseInitMissing) {
    return {
      reason: 'config_missing',
      message:
        'Firebase init eksik. Push kapali devam etmek icin EXPO_PUBLIC_PUSH_ENABLED=0 kullan; push acacaksan apps/mobile/google-services.json ekleyip dev clienti tekrar build et.',
    };
  }

  const projectIdMissing =
    lower.includes('project id') ||
    lower.includes('projectid') ||
    lower.includes('eas project');
  if (projectIdMissing && !hasProjectId) {
    return {
      reason: 'config_missing',
      message:
        'EXPO_PUBLIC_EXPO_PROJECT_ID eksik. mobile:ready sonrasi dev clienti tekrar baslat.',
    };
  }

  return {
    reason: hasProjectId ? 'unknown' : 'config_missing',
    message: compact || 'Push token hatasi.',
  };
};

const isExpoGoClient = (): boolean => {
  const executionEnvironment = normalizeText(
    (Constants as { executionEnvironment?: string } | null)?.executionEnvironment,
    60
  ).toLowerCase();
  const appOwnership = normalizeText(
    (Constants as { appOwnership?: string } | null)?.appOwnership,
    60
  ).toLowerCase();
  return executionEnvironment === 'storeclient' || appOwnership === 'expo';
};

const loadNotificationsModule = async (): Promise<NotificationsModule | null> => {
  if (Platform.OS === 'web') return null;
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  try {
    return await notificationsModulePromise;
  } catch {
    notificationsModulePromise = null;
    return null;
  }
};

const readPermissionStatus = async (): Promise<string> => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return 'unsupported';

  try {
    const existing = await Notifications.getPermissionsAsync();
    const status = normalizeText((existing as { status?: unknown } | null)?.status, 60);
    return status || 'unknown';
  } catch {
    return 'unknown';
  }
};

const requestPermissionStatus = async (currentStatus: string): Promise<string> => {
  if (currentStatus === 'granted') return currentStatus;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return currentStatus || 'unsupported';

  try {
    const requested = await Notifications.requestPermissionsAsync();
    const next = normalizeText((requested as { status?: unknown } | null)?.status, 60);
    return next || currentStatus || 'unknown';
  } catch {
    return currentStatus || 'unknown';
  }
};

const resolveProjectId = (): string | null => {
  const fromEnv = normalizeText(process.env.EXPO_PUBLIC_EXPO_PROJECT_ID, 120);
  if (fromEnv) return fromEnv;

  const fromEasConfig = normalizeText((Constants.easConfig as { projectId?: string } | null)?.projectId, 120);
  if (fromEasConfig) return fromEasConfig;

  const expoConfig = Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null;
  const fromExtra = normalizeText(expoConfig?.extra?.eas?.projectId, 120);
  if (fromExtra) return fromExtra;

  return null;
};

const extractDeepLinkFromData = (data: NotificationData): string | null => {
  const candidates = [
    data.deepLink,
    data.deep_link,
    data.url,
    data.link,
    data.app_link,
  ];
  for (const candidate of candidates) {
    const value = normalizeText(candidate, 500);
    if (value) return value;
  }
  return null;
};

const extractNotificationKindFromData = (
  data: NotificationData
): PushNotificationSnapshot['kind'] => {
  const candidates = [
    data.notificationType,
    data.notification_type,
    data.type,
    data.kind,
    data.eventType,
    data.event_type,
  ];
  const raw = candidates
    .map((candidate) => normalizeText(candidate, 80).toLowerCase())
    .find(Boolean);

  if (!raw) return 'generic';
  if (raw.includes('reply') || raw.includes('comment')) return 'comment';
  if (raw.includes('echo') || raw.includes('like')) return 'like';
  if (raw.includes('follow')) return 'follow';
  if (raw.includes('daily') || raw.includes('movie_drop') || raw.includes('new_movies')) {
    return 'daily_drop';
  }
  if (raw.includes('streak')) return 'streak';
  return 'generic';
};

const snapshotFromNotification = (
  notification: ExpoNotifications.Notification
): PushNotificationSnapshot => {
  const content = notification.request.content;
  const data = (content.data || {}) as NotificationData;
  const notificationId =
    normalizeText((notification.request as { identifier?: string } | null)?.identifier, 120) ||
    normalizeText(data.notificationId, 120) ||
    normalizeText(data.notification_id, 120) ||
    '';
  return {
    notificationId,
    title: normalizeText(content.title, 140),
    body: normalizeText(content.body, 300),
    deepLink: extractDeepLinkFromData(data),
    kind: extractNotificationKindFromData(data),
    receivedAt: new Date().toISOString(),
  };
};

export const readStoredPushToken = async (): Promise<string> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    return normalizeText(raw, 240);
  } catch {
    return '';
  }
};

const writeStoredPushToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, normalizeText(token, 240));
  } catch {
    // best-effort storage
  }
};

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0f766e',
    });
  } catch {
    // best-effort on platforms/builds that do not expose channels
  }
};

export const registerForPushNotifications = async (): Promise<PushRegistrationResult> => {
  const projectId = resolveProjectId();

  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Web build Expo push token kaydi yapmiyor.',
      permissionStatus: 'unsupported',
      projectId,
    };
  }

  if (isExpoGoClient()) {
    return {
      ok: false,
      reason: 'config_missing',
      message:
        'Expo Go (SDK 53+) remote push token desteklemiyor. Development build veya fiziksel cihaz + dev client kullan.',
      permissionStatus: 'unavailable',
      projectId,
    };
  }

  if (!Device.isDevice) {
    return {
      ok: false,
      reason: 'not_device',
      message: 'Push token almak icin fiziksel cihaz gerekiyor.',
      permissionStatus: 'unavailable',
      projectId,
    };
  }

  await ensureAndroidChannel();

  let permissionStatus = await readPermissionStatus();
  permissionStatus = await requestPermissionStatus(permissionStatus);

  if (permissionStatus !== 'granted') {
    return {
      ok: false,
      reason: 'permission_denied',
      message: 'Push bildirimi izni verilmedi.',
      permissionStatus,
      projectId,
    };
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return {
        ok: false,
        reason: 'unknown',
        message: 'Push modulu bu platformda hazir degil.',
        permissionStatus,
        projectId,
      };
    }

    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = normalizeText(tokenResponse.data, 240);
    if (!token) {
      return {
        ok: false,
        reason: 'token_unavailable',
        message: 'Push token uretilmedi.',
        permissionStatus,
        projectId,
      };
    }

    await writeStoredPushToken(token);
    return {
      ok: true,
      token,
      permissionStatus,
      projectId,
    };
  } catch (error) {
    const rawMessage = normalizeText(error instanceof Error ? error.message : 'Push token error', 240);
    const normalizedFailure = normalizePushRegistrationFailure(rawMessage, projectId);
    return {
      ok: false,
      reason: normalizedFailure.reason,
      message: normalizedFailure.message,
      permissionStatus,
      projectId,
    };
  }
};

export const subscribeToPushNotifications = (
  input: NotificationHandlerInput
): (() => void) => {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  let cancelled = false;
  let receivedSub: { remove: () => void } | null = null;
  let responseSub: { remove: () => void } | null = null;

  void loadNotificationsModule()
    .then((Notifications) => {
      if (!Notifications || cancelled) return;
      try {
        receivedSub = Notifications.addNotificationReceivedListener((notification) => {
          input.onNotificationReceived?.(snapshotFromNotification(notification));
        });
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          input.onNotificationResponse?.(snapshotFromNotification(response.notification));
        });
      } catch {
        receivedSub = null;
        responseSub = null;
      }
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    receivedSub?.remove();
    responseSub?.remove();
  };
};

export const configureDefaultNotificationHandler = (): void => {
  if (Platform.OS === 'web') return;

  void loadNotificationsModule()
    .then((Notifications) => {
      if (!Notifications) return;
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
      } catch {
        // no-op
      }
    })
    .catch(() => undefined);
};

export const sendLocalPushSimulation = async (input?: {
  title?: string;
  body?: string;
  deepLink?: string;
  kind?: PushNotificationSnapshot['kind'];
}): Promise<LocalPushSimulationResult> => {
  const title = normalizeText(input?.title, 140) || '180 Absolute Cinema (Local Test)';
  const body = normalizeText(input?.body, 300) || 'Emulator local push test bildirimi.';
  const deepLink = normalizeText(input?.deepLink, 500) || 'absolutecinema://open?target=daily';
  const kind =
    input?.kind === 'comment' ||
    input?.kind === 'like' ||
    input?.kind === 'follow' ||
    input?.kind === 'daily_drop' ||
    input?.kind === 'streak'
      ? input.kind
      : 'generic';

  if (Platform.OS === 'web') {
    return {
      ok: false,
      message: 'Web build local Expo bildirimi planlamiyor.',
      deepLink,
      permissionStatus: 'unsupported',
    };
  }

  await ensureAndroidChannel();

  let permissionStatus = await readPermissionStatus();
  permissionStatus = await requestPermissionStatus(permissionStatus);

  if (permissionStatus !== 'granted') {
    return {
      ok: false,
      message: 'Local bildirim izni verilmedi.',
      deepLink,
      permissionStatus,
    };
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return {
        ok: false,
        message: 'Push modulu bu platformda hazir degil.',
        deepLink,
        permissionStatus,
      };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          source: 'mobile_push_local_simulation',
          notificationType: kind,
          deepLink,
          sentAt: new Date().toISOString(),
        },
      },
      trigger: null,
    });

    return {
      ok: true,
      message: 'Local test bildirimi tetiklendi.',
      deepLink,
    };
  } catch (error) {
    const message = normalizeText(error instanceof Error ? error.message : 'Local push schedule error', 220);
    return {
      ok: false,
      message: message || 'Local test bildirimi tetiklenemedi.',
      deepLink,
      permissionStatus,
    };
  }
};
