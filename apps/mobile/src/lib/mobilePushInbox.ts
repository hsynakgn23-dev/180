import AsyncStorage from '@react-native-async-storage/async-storage';

export type PushInboxItem = {
  id: string;
  title: string;
  body: string;
  deepLink: string | null;
  kind: 'reply' | 'follow' | 'streak' | 'generic';
  receivedAt: string;
  source: 'received' | 'opened';
  opened: boolean;
  openedAt: string | null;
};

type PushInboxRawItem = Partial<PushInboxItem>;

const PUSH_INBOX_STORAGE_KEY = '180_mobile_push_inbox_v1';
const MAX_ITEMS = 40;

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

const toPushInboxItem = (raw: PushInboxRawItem): PushInboxItem | null => {
  const id = normalizeText(raw.id, 120) || generateId();
  const receivedAt = normalizeIsoDate(raw.receivedAt);
  const source = raw.source === 'opened' ? 'opened' : 'received';
  const deepLinkText = normalizeText(raw.deepLink, 500);
  const kindRaw = normalizeText(raw.kind, 40).toLowerCase();
  const kind =
    kindRaw === 'reply' || kindRaw === 'follow' || kindRaw === 'streak'
      ? kindRaw
      : 'generic';

  return {
    id,
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

const parseInbox = (rawText: string): PushInboxItem[] => {
  if (!rawText.trim()) return [];
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => toPushInboxItem((item || {}) as PushInboxRawItem))
      .filter((item): item is PushInboxItem => Boolean(item))
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

export const readPushInbox = async (): Promise<PushInboxItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(PUSH_INBOX_STORAGE_KEY);
    return parseInbox(raw || '');
  } catch {
    return [];
  }
};

export const appendPushInboxItem = async (input: {
  title: string;
  body: string;
  deepLink: string | null;
  kind: PushInboxItem['kind'];
  receivedAt: string;
  source: 'received' | 'opened';
}): Promise<{ item: PushInboxItem; items: PushInboxItem[] }> => {
  const item = toPushInboxItem({
    id: generateId(),
    title: input.title,
    body: input.body,
    deepLink: input.deepLink,
    kind: input.kind,
    receivedAt: input.receivedAt,
    source: input.source,
  }) as PushInboxItem;

  const current = await readPushInbox();
  const next = [item, ...current]
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, MAX_ITEMS);
  await saveInbox(next);
  return { item, items: next };
};

export const markPushInboxItemOpened = async (
  id: string
): Promise<{ updated: boolean; items: PushInboxItem[] }> => {
  const normalizedId = normalizeText(id, 120);
  if (!normalizedId) return { updated: false, items: await readPushInbox() };

  const current = await readPushInbox();
  let updated = false;
  const nowIso = new Date().toISOString();
  const next = current.map((item) => {
    if (item.id !== normalizedId) return item;
    updated = true;
    return {
      ...item,
      opened: true,
      openedAt: item.openedAt || nowIso,
    };
  });

  if (updated) await saveInbox(next);
  return { updated, items: next };
};

export const clearPushInbox = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PUSH_INBOX_STORAGE_KEY);
  } catch {
    // ignore
  }
};
