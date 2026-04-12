import AsyncStorage from '@react-native-async-storage/async-storage';

export type PushInboxItem = {
  id: string;
  notificationId: string;
  title: string;
  body: string;
  deepLink: string | null;
  kind: 'comment' | 'like' | 'follow' | 'daily_drop' | 'streak' | 'generic';
  receivedAt: string;
  source: 'received' | 'opened';
  opened: boolean;
  openedAt: string | null;
};

type PushInboxRawItem = {
  id?: unknown;
  notificationId?: unknown;
  title?: unknown;
  body?: unknown;
  deepLink?: unknown;
  kind?: unknown;
  receivedAt?: unknown;
  source?: unknown;
  opened?: unknown;
  openedAt?: unknown;
};

const PUSH_INBOX_STORAGE_KEY = '180_mobile_push_inbox_v1';
const PUSH_INBOX_DISMISSED_STORAGE_KEY = '180_mobile_push_inbox_dismissed_ids_v1';
const PUSH_INBOX_VIEW_PREFS_KEY = '180_mobile_push_inbox_view_prefs_v1';
const MAX_ITEMS = 40;
const MAX_DISMISSED_ITEMS = 500;
const DEDUPE_TIME_WINDOW_MS = 15 * 60 * 1000;

export type PushInboxViewPrefs = {
  filterKey: string;
  sortKey: string;
  searchQuery: string;
};

const normalizeText = (value: unknown, maxLength = 320): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const generateId = (): string => {
  const maybeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybeCrypto?.randomUUID) return `inbox-${maybeCrypto.randomUUID()}`;
  return `inbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeIsoDate = (value: unknown): string => {
  const text = normalizeText(value, 80);
  if (!text) return new Date().toISOString();
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
};

const toTimeMs = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildComparableContent = (item: {
  title: string;
  body: string;
  deepLink: string | null;
  kind: PushInboxItem['kind'];
}): { kind: string; title: string; body: string; deepLink: string } => {
  return {
    kind: normalizeText(item.kind, 20).toLowerCase(),
    title: normalizeText(item.title, 160).toLowerCase(),
    body: normalizeText(item.body, 320).toLowerCase(),
    deepLink: normalizeText(item.deepLink, 500).toLowerCase(),
  };
};

const toPushInboxItem = (raw: PushInboxRawItem): PushInboxItem => {
  const id = normalizeText(raw.id, 120) || generateId();
  const notificationId = normalizeText(raw.notificationId, 120);
  const receivedAt = normalizeIsoDate(raw.receivedAt);
  const source = raw.source === 'opened' ? 'opened' : 'received';
  const deepLinkText = normalizeText(raw.deepLink, 500);
  const kindRaw = normalizeText(raw.kind, 40).toLowerCase();
  const normalizedKind =
    kindRaw === 'reply'
      ? 'comment'
      : kindRaw === 'echo'
        ? 'like'
        : kindRaw === 'daily'
          ? 'daily_drop'
          : kindRaw;
  const kind =
    normalizedKind === 'comment' ||
    normalizedKind === 'like' ||
    normalizedKind === 'follow' ||
    normalizedKind === 'daily_drop' ||
    normalizedKind === 'streak'
      ? normalizedKind
      : 'generic';

  return {
    id,
    notificationId,
    title: normalizeText(raw.title, 160) || '(no-title)',
    body: normalizeText(raw.body, 320),
    deepLink: deepLinkText || null,
    kind,
    receivedAt,
    source,
    opened: Boolean(raw.opened) || source === 'opened',
    openedAt: raw.openedAt ? normalizeIsoDate(raw.openedAt) : source === 'opened' ? receivedAt : null,
  };
};

const findDuplicateIndex = (
  items: PushInboxItem[],
  incoming: PushInboxItem
): number => {
  if (incoming.notificationId) {
    const byNotificationId = items.findIndex(
      (item) => item.notificationId && item.notificationId === incoming.notificationId
    );
    if (byNotificationId >= 0) return byNotificationId;
  }

  const incomingContent = buildComparableContent(incoming);
  return items.findIndex((item) => {
    const itemContent = buildComparableContent(item);
    if (itemContent.kind !== incomingContent.kind) return false;
    if (itemContent.title !== incomingContent.title) return false;
    if (itemContent.body !== incomingContent.body) return false;
    if (
      itemContent.deepLink &&
      incomingContent.deepLink &&
      itemContent.deepLink !== incomingContent.deepLink
    ) {
      return false;
    }
    const delta = Math.abs(toTimeMs(item.receivedAt) - toTimeMs(incoming.receivedAt));
    return delta <= DEDUPE_TIME_WINDOW_MS;
  });
};

const mergeInboxItem = (existing: PushInboxItem, incoming: PushInboxItem): PushInboxItem => {
  const existingMs = toTimeMs(existing.receivedAt);
  const incomingMs = toTimeMs(incoming.receivedAt);
  const mergedOpened = existing.opened || incoming.opened || incoming.source === 'opened';
  const openedAtCandidate =
    existing.openedAt ||
    incoming.openedAt ||
    (incoming.source === 'opened' ? incoming.receivedAt : null);

  return {
    ...existing,
    notificationId: existing.notificationId || incoming.notificationId,
    title: incoming.title || existing.title,
    body: incoming.body || existing.body,
    deepLink: incoming.deepLink || existing.deepLink,
    kind: incoming.kind || existing.kind,
    source: mergedOpened ? 'opened' : existing.source,
    opened: mergedOpened,
    openedAt: mergedOpened ? normalizeIsoDate(openedAtCandidate || new Date().toISOString()) : null,
    receivedAt:
      existingMs > 0 && incomingMs > 0
        ? new Date(Math.min(existingMs, incomingMs)).toISOString()
        : existing.receivedAt || incoming.receivedAt,
  };
};

const parseInbox = (rawText: string): PushInboxItem[] => {
  if (!rawText.trim()) return [];
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => toPushInboxItem((item || {}) as PushInboxRawItem))
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

const saveInbox = async (items: PushInboxItem[]): Promise<void> => {
  const sorted = items
    .slice(0, MAX_ITEMS)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  await AsyncStorage.setItem(PUSH_INBOX_STORAGE_KEY, JSON.stringify(sorted));
};

const readDismissedNotificationIds = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_INBOX_DISMISSED_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return normalizeIdSet(parsed.map((id) => String(id || '')));
  } catch {
    return new Set();
  }
};

const saveDismissedNotificationIds = async (ids: Set<string>): Promise<void> => {
  const next = Array.from(ids).filter(Boolean).slice(-MAX_DISMISSED_ITEMS);
  await AsyncStorage.setItem(PUSH_INBOX_DISMISSED_STORAGE_KEY, JSON.stringify(next));
};

const dismissNotificationIds = async (ids: string[]): Promise<Set<string>> => {
  const normalizedIds = normalizeIdSet(ids);
  const current = await readDismissedNotificationIds();
  if (normalizedIds.size === 0) return current;
  normalizedIds.forEach((id) => current.add(id));
  await saveDismissedNotificationIds(current);
  return current;
};

const normalizeIdSet = (ids: string[]): Set<string> =>
  new Set(
    ids
      .map((id) => normalizeText(id, 120))
      .filter(Boolean)
  );

export const readPushInbox = async (): Promise<PushInboxItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_INBOX_STORAGE_KEY);
    return parseInbox(raw || '');
  } catch {
    return [];
  }
};

export const readPushInboxViewPrefs = async (): Promise<PushInboxViewPrefs | null> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_INBOX_VIEW_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    return {
      filterKey: normalizeText(record.filterKey, 32),
      sortKey: normalizeText(record.sortKey, 32),
      searchQuery: normalizeText(record.searchQuery, 160),
    };
  } catch {
    return null;
  }
};

export const writePushInboxViewPrefs = async (prefs: PushInboxViewPrefs): Promise<void> => {
  try {
    const payload: PushInboxViewPrefs = {
      filterKey: normalizeText(prefs.filterKey, 32),
      sortKey: normalizeText(prefs.sortKey, 32),
      searchQuery: normalizeText(prefs.searchQuery, 160),
    };
    await AsyncStorage.setItem(PUSH_INBOX_VIEW_PREFS_KEY, JSON.stringify(payload));
  } catch {
    // ignore prefs write errors
  }
};

export const appendPushInboxItem = async (input: {
  notificationId?: string | null;
  title: string;
  body: string;
  deepLink: string | null;
  kind: PushInboxItem['kind'];
  receivedAt: string;
  source: 'received' | 'opened';
}): Promise<{ item: PushInboxItem; items: PushInboxItem[] }> => {
  const item = toPushInboxItem({
    id: generateId(),
    notificationId: input.notificationId,
    title: input.title,
    body: input.body,
    deepLink: input.deepLink,
    kind: input.kind,
    receivedAt: input.receivedAt,
    source: input.source,
  });

  const current = await readPushInbox();

  if (item.notificationId) {
    const dismissedIds = await readDismissedNotificationIds();
    if (dismissedIds.has(item.notificationId)) {
      return { item, items: current };
    }
  }

  if (item.source === 'opened') {
    if (item.notificationId) {
      await dismissNotificationIds([item.notificationId]);
      const next = current.filter((entry) => entry.notificationId !== item.notificationId);
      await saveInbox(next);
      return { item, items: next };
    }
    return { item, items: current };
  }

  const duplicateIndex = findDuplicateIndex(current, item);
  const next =
    duplicateIndex >= 0
      ? current
          .map((existing, index) =>
            index === duplicateIndex ? mergeInboxItem(existing, item) : existing
          )
          .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
          .slice(0, MAX_ITEMS)
      : [item, ...current]
          .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
          .slice(0, MAX_ITEMS);
  const storedItem =
    duplicateIndex >= 0
      ? next.find((entry) => entry.id === current[duplicateIndex].id) || item
      : item;
  await saveInbox(next);
  return { item: storedItem, items: next };
};

export const markPushInboxItemOpened = async (
  id: string
): Promise<{ updated: boolean; items: PushInboxItem[] }> => {
  const normalizedId = normalizeText(id, 120);
  if (!normalizedId) return { updated: false, items: await readPushInbox() };

  const current = await readPushInbox();
  let updated = false;
  const nowIso = new Date().toISOString();
  const next = current.map<PushInboxItem>((item) => {
    if (item.id !== normalizedId) return item;
    updated = true;
    return {
      ...item,
      source: 'opened',
      opened: true,
      openedAt: item.openedAt || nowIso,
    };
  });

  if (updated) await saveInbox(next);
  return { updated, items: next };
};

export const markPushInboxItemsOpened = async (
  ids: string[]
): Promise<{ updatedCount: number; items: PushInboxItem[] }> => {
  const idSet = normalizeIdSet(ids);
  if (idSet.size === 0) {
    return { updatedCount: 0, items: await readPushInbox() };
  }

  const current = await readPushInbox();
  let updatedCount = 0;
  const nowIso = new Date().toISOString();
  const next = current.map<PushInboxItem>((item) => {
    if (!idSet.has(item.id)) return item;
    const shouldUpdate = !item.opened || item.source !== 'opened' || !item.openedAt;
    if (!shouldUpdate) return item;
    updatedCount += 1;
    return {
      ...item,
      source: 'opened',
      opened: true,
      openedAt: item.openedAt || nowIso,
    };
  });

  if (updatedCount > 0) {
    await saveInbox(next);
  }
  return { updatedCount, items: next };
};

export const removePushInboxItems = async (
  ids: string[]
): Promise<{ removedCount: number; items: PushInboxItem[] }> => {
  const idSet = normalizeIdSet(ids);
  if (idSet.size === 0) {
    return { removedCount: 0, items: await readPushInbox() };
  }

  const current = await readPushInbox();
  const notificationIdsToDismiss = current
    .filter((item) => idSet.has(item.id))
    .map((item) => item.notificationId)
    .filter(Boolean);
  const next = current.filter((item) => !idSet.has(item.id));
  const removedCount = current.length - next.length;
  if (removedCount > 0) {
    await dismissNotificationIds(notificationIdsToDismiss);
    await saveInbox(next);
  }
  return { removedCount, items: next };
};

export const clearPushInbox = async (): Promise<void> => {
  try {
    const current = await readPushInbox();
    const notificationIdsToDismiss = current.map((item) => item.notificationId).filter(Boolean);
    await dismissNotificationIds(notificationIdsToDismiss);
    await AsyncStorage.removeItem(PUSH_INBOX_STORAGE_KEY);
  } catch {
    // ignore
  }
};
