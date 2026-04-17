type SupabaseClientLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type LedgerMetadata = Record<string, unknown>;

const normalizeText = (value: unknown, maxLength = 240): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const toSafeInt = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};

const toSignedInt = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.trunc(numeric);
};

const sanitizeJsonValue = (value: unknown, depth = 0): unknown => {
  if (depth > 3) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return normalizeText(value, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 30)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizeJsonValue(nested, depth + 1);
      if (sanitized === undefined) continue;
      next[normalizeText(key, 80)] = sanitized;
    }
    return next;
  }
  return undefined;
};

const sanitizeMetadata = (value: LedgerMetadata | null | undefined): Record<string, unknown> => {
  const sanitized = sanitizeJsonValue(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return {};
  }
  return sanitized as Record<string, unknown>;
};

const buildEventKey = (input: {
  source: string;
  sourceId?: string | null;
  eventKey?: string | null;
}): string | null => {
  const explicit = normalizeText(input.eventKey, 240);
  if (explicit) return explicit;

  const source = normalizeText(input.source, 80);
  const sourceId = normalizeText(input.sourceId, 160);
  if (!source || !sourceId) return null;
  return `${source}:${sourceId}`.slice(0, 240);
};

const isIgnorableLedgerError = (
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean => {
  if (!error) return false;
  const code = normalizeText(error.code, 40).toUpperCase();
  const message = normalizeText(error.message, 260).toLowerCase();
  if (
    code === '23505' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42501' ||
    code === 'PGRST205'
  ) {
    return true;
  }

  return (
    message.includes('duplicate key') ||
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('column')
  );
};

const insertLedgerRow = async (
  supabase: SupabaseClientLike,
  table: 'wallet_ledger' | 'xp_ledger' | 'arena_ledger',
  payload: Record<string, unknown>
): Promise<boolean> => {
  const { error } = await supabase.from(table).insert(payload);
  if (!error) return true;

  if (!isIgnorableLedgerError(error)) {
    console.error(`[ledger] failed to write ${table}`, {
      code: normalizeText(error.code, 40),
      message: normalizeText(error.message, 320),
      payload,
    });
  }
  return false;
};

export const recordWalletLedgerEntry = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  source: string;
  sourceId?: string | null;
  reason?: string | null;
  delta: number;
  balanceAfter: number;
  metadata?: LedgerMetadata | null;
  eventKey?: string | null;
  allowZeroDelta?: boolean;
}): Promise<boolean> => {
  const delta = toSignedInt(input.delta);
  if (delta === 0 && !input.allowZeroDelta) return false;

  return insertLedgerRow(input.supabase, 'wallet_ledger', {
    user_id: normalizeText(input.userId, 80),
    event_key: buildEventKey(input),
    source: normalizeText(input.source, 80) || 'wallet',
    source_id: normalizeText(input.sourceId, 160) || null,
    reason: normalizeText(input.reason, 160) || null,
    delta,
    balance_after: toSafeInt(input.balanceAfter),
    metadata: sanitizeMetadata(input.metadata),
  });
};

export const recordXpLedgerEntry = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  source: string;
  sourceId?: string | null;
  reason?: string | null;
  delta: number;
  totalAfter: number;
  metadata?: LedgerMetadata | null;
  eventKey?: string | null;
}): Promise<boolean> => {
  const delta = toSignedInt(input.delta);
  if (delta === 0) return false;

  return insertLedgerRow(input.supabase, 'xp_ledger', {
    user_id: normalizeText(input.userId, 80),
    event_key: buildEventKey(input),
    source: normalizeText(input.source, 80) || 'progression_reward',
    source_id: normalizeText(input.sourceId, 160) || null,
    reason: normalizeText(input.reason, 160) || null,
    delta,
    total_after: toSafeInt(input.totalAfter),
    metadata: sanitizeMetadata(input.metadata),
  });
};

export const recordArenaLedgerEntry = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  weekKey: string;
  source: string;
  sourceId?: string | null;
  reason?: string | null;
  delta: number;
  activityDelta?: number;
  totalAfter: number;
  metadata?: LedgerMetadata | null;
  eventKey?: string | null;
}): Promise<boolean> => {
  const delta = toSignedInt(input.delta);
  const activityDelta = toSignedInt(input.activityDelta);
  if (delta === 0 && activityDelta === 0) return false;

  return insertLedgerRow(input.supabase, 'arena_ledger', {
    user_id: normalizeText(input.userId, 80),
    week_key: normalizeText(input.weekKey, 40),
    event_key: buildEventKey(input),
    source: normalizeText(input.source, 80) || 'arena',
    source_id: normalizeText(input.sourceId, 160) || null,
    reason: normalizeText(input.reason, 160) || null,
    delta,
    activity_delta: activityDelta,
    total_after: toSafeInt(input.totalAfter),
    metadata: sanitizeMetadata(input.metadata),
  });
};

export const recordProgressionRewardLedger = async (input: {
  supabase: SupabaseClientLike;
  userId: string;
  source: string;
  sourceId?: string | null;
  reason?: string | null;
  xpDelta: number;
  totalXpAfter: number;
  ticketDelta: number;
  walletBalanceAfter: number;
  arenaDelta: number;
  arenaActivityDelta?: number;
  arenaTotalAfter: number;
  arenaWeekKey: string;
  metadata?: LedgerMetadata | null;
  eventKey?: string | null;
}): Promise<void> => {
  await Promise.all([
    recordXpLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: input.source,
      sourceId: input.sourceId,
      reason: input.reason,
      delta: input.xpDelta,
      totalAfter: input.totalXpAfter,
      metadata: input.metadata,
      eventKey: input.eventKey,
    }),
    recordWalletLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      source: input.source,
      sourceId: input.sourceId,
      reason: input.reason,
      delta: input.ticketDelta,
      balanceAfter: input.walletBalanceAfter,
      metadata: input.metadata,
      eventKey: input.eventKey,
    }),
    recordArenaLedgerEntry({
      supabase: input.supabase,
      userId: input.userId,
      weekKey: input.arenaWeekKey,
      source: input.source,
      sourceId: input.sourceId,
      reason: input.reason,
      delta: input.arenaDelta,
      activityDelta: input.arenaActivityDelta,
      totalAfter: input.arenaTotalAfter,
      metadata: input.metadata,
      eventKey: input.eventKey,
    }),
  ]);
};
