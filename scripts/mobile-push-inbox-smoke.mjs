import assert from 'node:assert/strict';

const storageMap = new Map();
const localStoragePolyfill = {
  get length() {
    return storageMap.size;
  },
  key(index) {
    const keys = Array.from(storageMap.keys());
    return keys[index] || null;
  },
  getItem(key) {
    if (!storageMap.has(String(key))) return null;
    return String(storageMap.get(String(key)));
  },
  setItem(key, value) {
    storageMap.set(String(key), String(value));
  },
  removeItem(key) {
    storageMap.delete(String(key));
  },
  clear() {
    storageMap.clear();
  },
};

if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.self) globalThis.self = globalThis;
if (!globalThis.localStorage) globalThis.localStorage = localStoragePolyfill;

const importedModule = await import('../apps/mobile/src/lib/mobilePushInbox.ts');
const resolvedModule =
  importedModule?.appendPushInboxItem
    ? importedModule
    : importedModule?.default?.appendPushInboxItem
      ? importedModule.default
      : importedModule?.['module.exports']?.appendPushInboxItem
        ? importedModule['module.exports']
        : null;

if (!resolvedModule) {
  console.error('[mobile-push-inbox-smoke] FAIL unable to resolve mobilePushInbox exports');
  process.exit(1);
}

const appendPushInboxItem = resolvedModule.appendPushInboxItem;
const clearPushInbox = resolvedModule.clearPushInbox;
const markPushInboxItemOpened = resolvedModule.markPushInboxItemOpened;
const markPushInboxItemsOpened = resolvedModule.markPushInboxItemsOpened;
const readPushInbox = resolvedModule.readPushInbox;
const readPushInboxViewPrefs = resolvedModule.readPushInboxViewPrefs;
const removePushInboxItems = resolvedModule.removePushInboxItems;
const writePushInboxViewPrefs = resolvedModule.writePushInboxViewPrefs;

const log = (message) => {
  console.info(`[mobile-push-inbox-smoke] ${message}`);
};

const run = async () => {
  await clearPushInbox();

  await writePushInboxViewPrefs({
    filterKey: 'reply',
    sortKey: 'newest',
    searchQuery: 'ritual',
  });
  const prefs = await readPushInboxViewPrefs();
  assert.ok(prefs, 'view prefs should be readable after write');
  assert.equal(prefs.filterKey, 'reply', 'view prefs filter must persist');
  assert.equal(prefs.sortKey, 'newest', 'view prefs sort must persist');
  assert.equal(prefs.searchQuery, 'ritual', 'view prefs search must persist');

  const firstReceivedAt = new Date().toISOString();
  const first = await appendPushInboxItem({
    notificationId: 'notif-abc-1',
    title: 'Reply Notification',
    body: 'Someone replied to your ritual.',
    deepLink: 'absolutecinema://open?target=invite&invite=ABC12345',
    kind: 'reply',
    receivedAt: firstReceivedAt,
    source: 'received',
  });
  assert.equal(first.items.length, 1, 'first append should create one inbox row');

  const firstOpenedAt = new Date(Date.now() + 1200).toISOString();
  const mergedById = await appendPushInboxItem({
    notificationId: 'notif-abc-1',
    title: 'Reply Notification',
    body: 'Someone replied to your ritual.',
    deepLink: 'absolutecinema://open?target=invite&invite=ABC12345',
    kind: 'reply',
    receivedAt: firstOpenedAt,
    source: 'opened',
  });
  assert.equal(
    mergedById.items.length,
    1,
    'received + opened for same notificationId must stay single row'
  );
  assert.equal(mergedById.items[0].opened, true, 'merged row must be opened');
  assert.equal(mergedById.items[0].source, 'opened', 'merged row source must be opened');
  assert.ok(mergedById.items[0].openedAt, 'merged row openedAt must be set');

  await appendPushInboxItem({
    notificationId: '',
    title: 'Fallback Dedupe',
    body: 'No notification id payload.',
    deepLink: null,
    kind: 'generic',
    receivedAt: new Date(Date.now() + 2400).toISOString(),
    source: 'received',
  });
  const mergedByFallback = await appendPushInboxItem({
    notificationId: '',
    title: 'Fallback Dedupe',
    body: 'No notification id payload.',
    deepLink: null,
    kind: 'generic',
    receivedAt: new Date(Date.now() + 3000).toISOString(),
    source: 'opened',
  });
  assert.equal(
    mergedByFallback.items.length,
    2,
    'fallback fingerprint dedupe should merge into existing row'
  );

  const fallbackItem = mergedByFallback.items.find((item) => item.title === 'Fallback Dedupe');
  assert.ok(fallbackItem, 'fallback row should exist');
  assert.equal(fallbackItem.opened, true, 'fallback row should be opened after merge');

  const markResult = await markPushInboxItemOpened(first.item.id);
  assert.equal(markResult.updated, true, 'mark opened should update the targeted row');

  await appendPushInboxItem({
    notificationId: 'notif-abc-2',
    title: 'Follow Notification',
    body: 'Someone followed you.',
    deepLink: null,
    kind: 'follow',
    receivedAt: new Date(Date.now() + 3600).toISOString(),
    source: 'received',
  });

  const beforeBulk = await readPushInbox();
  const bulkOpenTarget = beforeBulk.filter((item) => !item.opened).map((item) => item.id);
  const bulkOpenResult = await markPushInboxItemsOpened(bulkOpenTarget);
  assert.ok(
    bulkOpenResult.updatedCount >= 1,
    'bulk opened should update at least one row when unopened items exist'
  );
  assert.equal(
    bulkOpenResult.items.some((item) => !item.opened),
    false,
    'all targeted rows should be opened after bulk update'
  );

  const removeTarget = bulkOpenResult.items
    .filter((item) => item.kind === 'generic')
    .map((item) => item.id);
  const removeResult = await removePushInboxItems(removeTarget);
  assert.equal(
    removeResult.removedCount,
    removeTarget.length,
    'remove should delete all targeted rows'
  );
  assert.equal(
    removeResult.items.some((item) => removeTarget.includes(item.id)),
    false,
    'removed rows must not remain in inbox'
  );

  const persisted = await readPushInbox();
  assert.equal(
    persisted.length,
    removeResult.items.length,
    'persisted inbox should match post-remove item count'
  );

  await clearPushInbox();
  log('PASS');
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mobile-push-inbox-smoke] FAIL ${message}`);
  process.exit(1);
});
