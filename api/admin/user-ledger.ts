import {
    type AdminContext,
    clampInteger,
    getQueryValue,
    isSupabaseCapabilityError,
    normalizeUuid,
    requireAdminAccess,
    sendJson,
    toText,
    type ApiRequest,
    type ApiResponse
} from '../lib/admin.js';

export const config = {
    runtime: 'nodejs'
};

type WalletLedgerRow = {
    id?: unknown;
    event_key?: unknown;
    source?: unknown;
    source_id?: unknown;
    reason?: unknown;
    delta?: unknown;
    balance_after?: unknown;
    metadata?: unknown;
    created_at?: unknown;
};

type XpLedgerRow = {
    id?: unknown;
    event_key?: unknown;
    source?: unknown;
    source_id?: unknown;
    reason?: unknown;
    delta?: unknown;
    total_after?: unknown;
    metadata?: unknown;
    created_at?: unknown;
};

type ArenaLedgerRow = {
    id?: unknown;
    week_key?: unknown;
    event_key?: unknown;
    source?: unknown;
    source_id?: unknown;
    reason?: unknown;
    delta?: unknown;
    activity_delta?: unknown;
    total_after?: unknown;
    metadata?: unknown;
    created_at?: unknown;
};

type LedgerEntry =
    | {
          kind: 'wallet';
          id: string;
          createdAt: string;
          eventKey: string | null;
          source: string;
          sourceId: string | null;
          reason: string | null;
          delta: number;
          totalAfter: number;
          metadata: Record<string, unknown>;
      }
    | {
          kind: 'xp';
          id: string;
          createdAt: string;
          eventKey: string | null;
          source: string;
          sourceId: string | null;
          reason: string | null;
          delta: number;
          totalAfter: number;
          metadata: Record<string, unknown>;
      }
    | {
          kind: 'arena';
          id: string;
          createdAt: string;
          weekKey: string;
          eventKey: string | null;
          source: string;
          sourceId: string | null;
          reason: string | null;
          delta: number;
          activityDelta: number;
          totalAfter: number;
          metadata: Record<string, unknown>;
      };

type AdminServiceClient = AdminContext['serviceClient'];

const toSafeInt = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.trunc(parsed);
};

const toObject = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const compareCreatedAtDesc = (left: LedgerEntry, right: LedgerEntry): number =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')) ||
    String(right.id || '').localeCompare(String(left.id || ''));

const readWalletLedgerRows = async (
    serviceClient: AdminServiceClient,
    userId: string,
    limit: number
): Promise<{ rows: WalletLedgerRow[]; schemaReady: boolean; error: string | null }> => {
    const { data, error } = await serviceClient
        .from('wallet_ledger')
        .select('id,event_key,source,source_id,reason,delta,balance_after,metadata,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (isSupabaseCapabilityError(error)) {
            return { rows: [], schemaReady: false, error: null };
        }
        return {
            rows: [],
            schemaReady: true,
            error: toText(error.message, 320) || 'Wallet ledger could not be read.'
        };
    }

    return {
        rows: Array.isArray(data) ? (data as WalletLedgerRow[]) : [],
        schemaReady: true,
        error: null
    };
};

const readXpLedgerRows = async (
    serviceClient: AdminServiceClient,
    userId: string,
    limit: number
): Promise<{ rows: XpLedgerRow[]; schemaReady: boolean; error: string | null }> => {
    const { data, error } = await serviceClient
        .from('xp_ledger')
        .select('id,event_key,source,source_id,reason,delta,total_after,metadata,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (isSupabaseCapabilityError(error)) {
            return { rows: [], schemaReady: false, error: null };
        }
        return {
            rows: [],
            schemaReady: true,
            error: toText(error.message, 320) || 'XP ledger could not be read.'
        };
    }

    return {
        rows: Array.isArray(data) ? (data as XpLedgerRow[]) : [],
        schemaReady: true,
        error: null
    };
};

const readArenaLedgerRows = async (
    serviceClient: AdminServiceClient,
    userId: string,
    limit: number
): Promise<{ rows: ArenaLedgerRow[]; schemaReady: boolean; error: string | null }> => {
    const { data, error } = await serviceClient
        .from('arena_ledger')
        .select('id,week_key,event_key,source,source_id,reason,delta,activity_delta,total_after,metadata,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (isSupabaseCapabilityError(error)) {
            return { rows: [], schemaReady: false, error: null };
        }
        return {
            rows: [],
            schemaReady: true,
            error: toText(error.message, 320) || 'Arena ledger could not be read.'
        };
    }

    return {
        rows: Array.isArray(data) ? (data as ArenaLedgerRow[]) : [],
        schemaReady: true,
        error: null
    };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'GET,OPTIONS');
    if (!access.ok) {
        return access.response;
    }

    const { corsHeaders, serviceClient, csrfToken } = access.context;
    const userId = normalizeUuid(getQueryValue(req, 'userId'));
    const limit = clampInteger(getQueryValue(req, 'limit'), 10, 200, 80);

    if (!userId) {
        return sendJson(
            res,
            400,
            {
                ok: false,
                error: 'Missing or invalid userId.'
            },
            corsHeaders
        );
    }

    const [walletResult, xpResult, arenaResult] = await Promise.all([
        readWalletLedgerRows(serviceClient, userId, limit),
        readXpLedgerRows(serviceClient, userId, limit),
        readArenaLedgerRows(serviceClient, userId, limit)
    ]);

    const fatalError = walletResult.error || xpResult.error || arenaResult.error;
    if (fatalError) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                error: fatalError
            },
            corsHeaders
        );
    }

    const walletEntries: LedgerEntry[] = walletResult.rows.map((row) => ({
        kind: 'wallet',
        id: toText(row.id, 80) || '',
        createdAt: toText(row.created_at, 80),
        eventKey: toText(row.event_key, 240) || null,
        source: toText(row.source, 80) || 'wallet',
        sourceId: toText(row.source_id, 160) || null,
        reason: toText(row.reason, 160) || null,
        delta: toSafeInt(row.delta),
        totalAfter: Math.max(0, toSafeInt(row.balance_after)),
        metadata: toObject(row.metadata)
    }));

    const xpEntries: LedgerEntry[] = xpResult.rows.map((row) => ({
        kind: 'xp',
        id: toText(row.id, 80) || '',
        createdAt: toText(row.created_at, 80),
        eventKey: toText(row.event_key, 240) || null,
        source: toText(row.source, 80) || 'xp',
        sourceId: toText(row.source_id, 160) || null,
        reason: toText(row.reason, 160) || null,
        delta: toSafeInt(row.delta),
        totalAfter: Math.max(0, toSafeInt(row.total_after)),
        metadata: toObject(row.metadata)
    }));

    const arenaEntries: LedgerEntry[] = arenaResult.rows.map((row) => ({
        kind: 'arena',
        id: toText(row.id, 80) || '',
        createdAt: toText(row.created_at, 80),
        weekKey: toText(row.week_key, 40),
        eventKey: toText(row.event_key, 240) || null,
        source: toText(row.source, 80) || 'arena',
        sourceId: toText(row.source_id, 160) || null,
        reason: toText(row.reason, 160) || null,
        delta: toSafeInt(row.delta),
        activityDelta: toSafeInt(row.activity_delta),
        totalAfter: Math.max(0, toSafeInt(row.total_after)),
        metadata: toObject(row.metadata)
    }));

    const entries = [...walletEntries, ...xpEntries, ...arenaEntries]
        .sort(compareCreatedAtDesc)
        .slice(0, limit * 3);

    return sendJson(
        res,
        200,
        {
            ok: true,
            userId,
            limit,
            csrfToken,
            schemaReady: walletResult.schemaReady && xpResult.schemaReady && arenaResult.schemaReady,
            counts: {
                wallet: walletEntries.length,
                xp: xpEntries.length,
                arena: arenaEntries.length,
                total: entries.length
            },
            entries,
            walletEntries,
            xpEntries,
            arenaEntries
        },
        corsHeaders
    );
}
