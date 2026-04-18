import { createCorsHeaders } from './cors.js';
import { applyProgressionReward } from './progressionProfile.js';
import { createSupabaseServiceHeaders } from './supabaseServiceHeaders.js';
import { createSupabaseServiceClient } from './supabaseServiceClient.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
};

type ApiJsonResponder = {
    json: (payload: Record<string, unknown>) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiJsonResponder;
};

type AuthUser = {
    id: string;
    email: string;
};

type ClaimSuccessData = {
    code: string;
    inviterUserId: string | null;
    inviterRewardXp: number;
    inviteeRewardXp: number;
    claimCount: number;
};

type ClaimFallbackResult =
    | { ok: true; data: ClaimSuccessData }
    | { ok: false; status: number; errorCode: string; message: string };

type ReferralClaimRow = {
    id: string;
    code: string;
    inviteeUserId: string;
    inviteeEmail: string;
    inviterRewardXp: number;
    inviteeRewardXp: number;
    inviterRewardAppliedAt: string | null;
    inviteeRewardAppliedAt: string | null;
};

type ReferralInviteRow = {
    code: string;
    inviterUserId: string | null;
    inviterEmail: string | null;
    claimCount: number;
};

type ServiceSupabase = ReturnType<typeof createSupabaseServiceClient>;

const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const DEVICE_KEY_REGEX = /^[a-zA-Z0-9:_-]{8,80}$/;

const sendJson = (
    res: ApiResponse,
    status: number,
    payload: Record<string, unknown>,
    headers: Record<string, string> = {}
) => {
    if (res && typeof res.setHeader === 'function') {
        for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
        }
    }

    if (res && typeof res.status === 'function') {
        return res.status(status).json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            ...headers
        }
    });
};

const getHeader = (req: ApiRequest, key: string): string => {
    const headers = req.headers;
    if (!headers) return '';

    if (typeof (headers as Headers).get === 'function') {
        return ((headers as Headers).get(key) || '').trim();
    }

    const objectHeaders = headers as Record<string, string | undefined>;
    return (objectHeaders[key.toLowerCase()] || objectHeaders[key] || '').trim();
};

const getBearerToken = (req: ApiRequest): string | null => {
    const authHeader = getHeader(req, 'authorization');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    return token || null;
};

const parseBody = async (req: ApiRequest): Promise<unknown> => {
    if (req.body !== undefined) return req.body;
    if (typeof req.on !== 'function') return null;

    const chunks: string[] = [];
    await new Promise<void>((resolve) => {
        req.on?.('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
        });
        req.on?.('end', () => resolve());
    });

    const raw = chunks.join('').trim();
    if (!raw) return null;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const toText = (value: unknown, maxLength: number): string => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeEmail = (email: string | null | undefined, userId: string): string => {
    const value = String(email || '').trim().toLowerCase();
    if (value) return value;
    return `${userId}@users.local`;
};

const normalizeInviteCode = (value: unknown): string =>
    toText(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeDeviceKey = (value: unknown): string =>
    toText(value, 80).replace(/[^a-zA-Z0-9:_-]/g, '');

const getSupabaseConfig = (): { url: string; serviceRoleKey: string; anonKey: string } | null => {
    const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = String(
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ''
    ).trim();

    if (!url || !serviceRoleKey || !anonKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey,
        anonKey
    };
};

const readAuthUser = async (
    config: { url: string; anonKey: string },
    accessToken: string
): Promise<AuthUser | null> => {
    try {
        const response = await fetch(`${config.url}/auth/v1/user`, {
            headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${accessToken}`
            }
        });
        if (!response.ok) return null;

        const raw = (await response.json()) as { id?: unknown; email?: unknown };
        const id = toText(raw.id, 80);
        if (!id) return null;

        return {
            id,
            email: normalizeEmail(toText(raw.email, 240), id)
        };
    } catch {
        return null;
    }
};

const parseRpcRow = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) {
        const first = value[0];
        return toObject(first);
    }
    return toObject(value);
};

const mapClaimError = (
    rawMessage: string
): { errorCode: string; status: number; message: string } => {
    const message = rawMessage.toUpperCase();
    if (message.includes('INVALID_CODE')) {
        return { errorCode: 'INVALID_CODE', status: 400, message: 'Invite code is invalid.' };
    }
    if (message.includes('INVITE_NOT_FOUND')) {
        return { errorCode: 'INVITE_NOT_FOUND', status: 404, message: 'Invite code was not found.' };
    }
    if (message.includes('SELF_INVITE')) {
        return { errorCode: 'SELF_INVITE', status: 400, message: 'Self invite is not allowed.' };
    }
    if (message.includes('ALREADY_CLAIMED')) {
        return { errorCode: 'ALREADY_CLAIMED', status: 409, message: 'Account already used an invite code.' };
    }
    if (message.includes('DEVICE_DAILY_LIMIT')) {
        return { errorCode: 'DEVICE_DAILY_LIMIT', status: 429, message: 'Device daily invite limit reached.' };
    }
    if (message.includes('DEVICE_CODE_REUSE')) {
        return { errorCode: 'DEVICE_CODE_REUSE', status: 409, message: 'This device already claimed this code today.' };
    }
    if (message.includes('UNAUTHORIZED')) {
        return { errorCode: 'UNAUTHORIZED', status: 401, message: 'Unauthorized.' };
    }
    return { errorCode: 'SERVER_ERROR', status: 500, message: 'Invite claim failed.' };
};

// Grant XP reward to a user after a successful referral claim.
// Wrapped in try/catch so reward failure never blocks the claim response.
const grantReferralXpSafe = async (
    config: { url: string; serviceRoleKey: string },
    userId: string,
    xpAmount: number,
    label: string
): Promise<void> => {
    if (!userId || xpAmount <= 0) return;
    try {
        const supabase = createSupabaseServiceClient(config.url, config.serviceRoleKey);
        await applyProgressionReward({
            supabase,
            userId,
            reward: { xp: xpAmount, tickets: 0, arenaScore: 0, arenaActivity: 0 },
        });
    } catch (err) {
        console.error(`referralClaim: grantReferralXpSafe failed for ${label} userId=${userId}`, {
            xpAmount,
            error: err instanceof Error ? err.message : String(err),
        });
    }
};

const isAmbiguousClaimCountError = (rawMessage: string): boolean => {
    const text = rawMessage.toLowerCase();
    return text.includes('claim_count') && text.includes('ambiguous');
};

const parseDbError = (value: unknown): { code: string; message: string; details: string } => {
    const objectValue = toObject(value);
    return {
        code: toText(objectValue?.code, 40),
        message: toText(objectValue?.message || objectValue?.error, 320),
        details: toText(objectValue?.details, 320)
    };
};

const serviceHeaders = (config: { serviceRoleKey: string }, extra: Record<string, string> = {}) =>
    createSupabaseServiceHeaders(config.serviceRoleKey, {
        'content-type': 'application/json',
        ...extra
    });

const parseReferralClaimRow = (value: unknown): ReferralClaimRow | null => {
    const row = toObject(value);
    const id = toText(row?.id, 80);
    const code = normalizeInviteCode(row?.code);
    const inviteeUserId = toText(row?.invitee_user_id, 80);
    if (!id || !code || !inviteeUserId) return null;

    const inviterRewardXp = Number(row?.inviter_reward_xp);
    const inviteeRewardXp = Number(row?.invitee_reward_xp);

    return {
        id,
        code,
        inviteeUserId,
        inviteeEmail: normalizeEmail(toText(row?.invitee_email, 240), inviteeUserId),
        inviterRewardXp: Number.isFinite(inviterRewardXp) ? Math.max(0, inviterRewardXp) : 0,
        inviteeRewardXp: Number.isFinite(inviteeRewardXp) ? Math.max(0, inviteeRewardXp) : 0,
        inviterRewardAppliedAt: toText(row?.inviter_reward_applied_at, 80) || null,
        inviteeRewardAppliedAt: toText(row?.invitee_reward_applied_at, 80) || null
    };
};

const parseReferralInviteRow = (value: unknown): ReferralInviteRow | null => {
    const row = toObject(value);
    const code = normalizeInviteCode(row?.code);
    if (!code) return null;

    const claimCount = Number(row?.claim_count);

    return {
        code,
        inviterUserId: toText(row?.inviter_user_id, 80) || null,
        inviterEmail: toText(row?.inviter_email, 240) || null,
        claimCount: Number.isFinite(claimCount) ? Math.max(0, claimCount) : 0
    };
};

const readReferralClaimRecord = async (
    supabase: ServiceSupabase,
    input: { inviteeUserId: string; inviteCode?: string | null }
): Promise<ReferralClaimRow | null> => {
    const inviteeUserId = toText(input.inviteeUserId, 80);
    const inviteCode = normalizeInviteCode(input.inviteCode);
    let query = supabase
        .from('referral_claims')
        .select(
            'id,code,invitee_user_id,invitee_email,inviter_reward_xp,invitee_reward_xp,inviter_reward_applied_at,invitee_reward_applied_at'
        )
        .eq('invitee_user_id', inviteeUserId);

    if (inviteCode) {
        query = query.eq('code', inviteCode);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) {
        throw new Error(error.message || 'Failed to read referral claim.');
    }

    return parseReferralClaimRow(data);
};

const readReferralInviteRecord = async (
    supabase: ServiceSupabase,
    inviteCode: string
): Promise<ReferralInviteRow | null> => {
    const normalizedCode = normalizeInviteCode(inviteCode);
    if (!normalizedCode) return null;

    const { data, error } = await supabase
        .from('referral_invites')
        .select('code,inviter_user_id,inviter_email,claim_count')
        .eq('code', normalizedCode)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || 'Failed to read referral invite.');
    }

    return parseReferralInviteRow(data);
};

const markReferralRewardApplied = async (
    supabase: ServiceSupabase,
    input: {
        claimId: string;
        column: 'inviter_reward_applied_at' | 'invitee_reward_applied_at';
    }
): Promise<void> => {
    const { error } = await supabase
        .from('referral_claims')
        .update({
            [input.column]: new Date().toISOString()
        })
        .eq('id', input.claimId)
        .is(input.column, null);

    if (error) {
        throw new Error(error.message || 'Failed to persist referral reward settlement.');
    }
};

const settleReferralClaimRewards = async (
    supabase: ServiceSupabase,
    input: {
        claim: ReferralClaimRow;
        invite: ReferralInviteRow | null;
        inviteeEmail: string;
    }
): Promise<void> => {
    const invite = input.invite;
    if (!invite?.inviterUserId) {
        throw new Error('Referral invite record is missing inviter metadata.');
    }

    if (!input.claim.inviteeRewardAppliedAt) {
        if (input.claim.inviteeRewardXp > 0) {
            await applyProgressionReward({
                supabase,
                userId: input.claim.inviteeUserId,
                fallbackEmail: input.claim.inviteeEmail || input.inviteeEmail,
                reward: {
                    xp: input.claim.inviteeRewardXp,
                    tickets: 0,
                    arenaScore: 0,
                    arenaActivity: 0
                },
                idempotencyKey: `referral:invitee:${input.claim.id}`,
                ledger: {
                    source: 'referral_invite',
                    sourceId: input.claim.id,
                    reason: 'referral_invitee_reward',
                    metadata: {
                        code: input.claim.code,
                        role: 'invitee',
                        inviterUserId: invite.inviterUserId,
                    },
                }
            });
        }

        await markReferralRewardApplied(supabase, {
            claimId: input.claim.id,
            column: 'invitee_reward_applied_at'
        });
    }

    if (!input.claim.inviterRewardAppliedAt) {
        if (input.claim.inviterRewardXp > 0) {
            await applyProgressionReward({
                supabase,
                userId: invite.inviterUserId,
                fallbackEmail: invite.inviterEmail,
                reward: {
                    xp: input.claim.inviterRewardXp,
                    tickets: 0,
                    arenaScore: 0,
                    arenaActivity: 0
                },
                idempotencyKey: `referral:inviter:${input.claim.id}`,
                ledger: {
                    source: 'referral_invite',
                    sourceId: input.claim.id,
                    reason: 'referral_inviter_reward',
                    metadata: {
                        code: input.claim.code,
                        role: 'inviter',
                        inviteeUserId: input.claim.inviteeUserId,
                    },
                }
            });
        }

        await markReferralRewardApplied(supabase, {
            claimId: input.claim.id,
            column: 'inviter_reward_applied_at'
        });
    }
};

const finalizeReferralClaim = async (
    supabase: ServiceSupabase,
    input: {
        inviteeUserId: string;
        inviteeEmail: string;
        inviteCode?: string | null;
    }
): Promise<ClaimSuccessData | null> => {
    const claim = await readReferralClaimRecord(supabase, {
        inviteeUserId: input.inviteeUserId,
        inviteCode: input.inviteCode || null
    });
    if (!claim) return null;

    const normalizedExpectedCode = normalizeInviteCode(input.inviteCode);
    if (normalizedExpectedCode && claim.code !== normalizedExpectedCode) {
        return null;
    }

    const invite = await readReferralInviteRecord(supabase, claim.code);
    await settleReferralClaimRewards(supabase, {
        claim,
        invite,
        inviteeEmail: input.inviteeEmail
    });

    return {
        code: claim.code,
        inviterUserId: invite?.inviterUserId || null,
        inviterRewardXp: claim.inviterRewardXp,
        inviteeRewardXp: claim.inviteeRewardXp,
        claimCount: invite ? Math.max(0, invite.claimCount) : 0
    };
};

const fallbackClaimReferralInvite = async (
    config: { url: string; serviceRoleKey: string },
    input: {
        inviteCode: string;
        inviteeUserId: string;
        inviteeEmail: string;
        deviceKey: string;
    }
): Promise<ClaimFallbackResult> => {
    const inviteCode = normalizeInviteCode(input.inviteCode);
    const inviteeUserId = toText(input.inviteeUserId, 80);
    const inviteeEmail = normalizeEmail(input.inviteeEmail, inviteeUserId);
    const deviceKey = normalizeDeviceKey(input.deviceKey);
    const today = new Date().toISOString().slice(0, 10);

    const inviteResp = await fetch(
        `${config.url}/rest/v1/referral_invites?code=eq.${encodeURIComponent(inviteCode)}&select=code,inviter_user_id,inviter_email,claim_count&limit=1`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!inviteResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const inviteRows = (await inviteResp.json().catch(() => [])) as unknown;
    const inviteRow = Array.isArray(inviteRows) ? toObject(inviteRows[0]) : null;
    if (!inviteRow) {
        return { ok: false, status: 404, errorCode: 'INVITE_NOT_FOUND', message: 'Invite code was not found.' };
    }

    const inviterUserId = toText(inviteRow.inviter_user_id, 80) || null;
    const inviterEmail = normalizeEmail(toText(inviteRow.inviter_email, 240), inviterUserId || 'unknown');
    if (inviterUserId && inviterUserId === inviteeUserId) {
        return { ok: false, status: 400, errorCode: 'SELF_INVITE', message: 'Self invite is not allowed.' };
    }

    if (inviterEmail === inviteeEmail) {
        return { ok: false, status: 400, errorCode: 'SELF_INVITE', message: 'Self invite is not allowed.' };
    }

    const alreadyClaimedResp = await fetch(
        `${config.url}/rest/v1/referral_claims?invitee_user_id=eq.${encodeURIComponent(inviteeUserId)}&select=id&limit=1`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!alreadyClaimedResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }
    const alreadyClaimedRows = (await alreadyClaimedResp.json().catch(() => [])) as unknown;
    if (Array.isArray(alreadyClaimedRows) && alreadyClaimedRows.length > 0) {
        return {
            ok: false,
            status: 409,
            errorCode: 'ALREADY_CLAIMED',
            message: 'Account already used an invite code.'
        };
    }

    const deviceRowsResp = await fetch(
        `${config.url}/rest/v1/referral_device_claims?device_key=eq.${encodeURIComponent(deviceKey)}&claim_date=eq.${encodeURIComponent(today)}&select=code,id&limit=10`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );
    if (!deviceRowsResp.ok) {
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const deviceRows = (await deviceRowsResp.json().catch(() => [])) as unknown;
    const normalizedDeviceRows = Array.isArray(deviceRows)
        ? deviceRows.map((row) => toObject(row)).filter(Boolean) as Record<string, unknown>[]
        : [];

    if (normalizedDeviceRows.length >= 3) {
        return {
            ok: false,
            status: 429,
            errorCode: 'DEVICE_DAILY_LIMIT',
            message: 'Device daily invite limit reached.'
        };
    }

    const codeAlreadyUsedOnDevice = normalizedDeviceRows.some((row) => normalizeInviteCode(row.code) === inviteCode);
    if (codeAlreadyUsedOnDevice) {
        return {
            ok: false,
            status: 409,
            errorCode: 'DEVICE_CODE_REUSE',
            message: 'This device already claimed this code today.'
        };
    }

    const insertClaimResp = await fetch(`${config.url}/rest/v1/referral_claims`, {
        method: 'POST',
        headers: serviceHeaders(config, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            code: inviteCode,
            invitee_user_id: inviteeUserId,
            invitee_email: inviteeEmail,
            inviter_reward_xp: 40,
            invitee_reward_xp: 24
        })
    });

    if (!insertClaimResp.ok) {
        const claimDbError = parseDbError(await insertClaimResp.json().catch(() => ({})));
        const upper = `${claimDbError.code} ${claimDbError.message} ${claimDbError.details}`.toUpperCase();
        if (upper.includes('23505') || upper.includes('UNIQUE') || upper.includes('INVITEE_USER_ID')) {
            return {
                ok: false,
                status: 409,
                errorCode: 'ALREADY_CLAIMED',
                message: 'Account already used an invite code.'
            };
        }
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    const insertDeviceResp = await fetch(`${config.url}/rest/v1/referral_device_claims`, {
        method: 'POST',
        headers: serviceHeaders(config, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            device_key: deviceKey,
            claim_date: today,
            code: inviteCode,
            invitee_user_id: inviteeUserId
        })
    });

    if (!insertDeviceResp.ok) {
        await fetch(
            `${config.url}/rest/v1/referral_claims?invitee_user_id=eq.${encodeURIComponent(inviteeUserId)}&code=eq.${encodeURIComponent(inviteCode)}`,
            {
                method: 'DELETE',
                headers: serviceHeaders(config)
            }
        ).catch(() => undefined);

        const deviceDbError = parseDbError(await insertDeviceResp.json().catch(() => ({})));
        const upper = `${deviceDbError.code} ${deviceDbError.message} ${deviceDbError.details}`.toUpperCase();
        if (upper.includes('DEVICE_DAILY_LIMIT')) {
            return {
                ok: false,
                status: 429,
                errorCode: 'DEVICE_DAILY_LIMIT',
                message: 'Device daily invite limit reached.'
            };
        }
        if (upper.includes('23505') || upper.includes('UNIQUE') || upper.includes('DEVICE_KEY')) {
            return {
                ok: false,
                status: 409,
                errorCode: 'DEVICE_CODE_REUSE',
                message: 'This device already claimed this code today.'
            };
        }
        return { ok: false, status: 500, errorCode: 'SERVER_ERROR', message: 'Invite claim failed.' };
    }

    let finalClaimCount = 1;
    const refreshInviteResp = await fetch(
        `${config.url}/rest/v1/referral_invites?code=eq.${encodeURIComponent(inviteCode)}&select=claim_count&limit=1`,
        {
            method: 'GET',
            headers: serviceHeaders(config)
        }
    );

    if (refreshInviteResp.ok) {
        const refreshedRows = (await refreshInviteResp.json().catch(() => [])) as unknown;
        const refreshedRow = Array.isArray(refreshedRows) ? toObject(refreshedRows[0]) : null;
        const refreshedClaimCount = Number(refreshedRow?.claim_count);
        if (Number.isFinite(refreshedClaimCount)) {
            finalClaimCount = Math.max(0, refreshedClaimCount);
        }
    }

    return {
        ok: true,
        data: {
            code: inviteCode,
            inviterUserId,
            inviterRewardXp: 40,
            inviteeRewardXp: 24,
            claimCount: finalClaimCount
        }
    };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = createCorsHeaders(req, {
        methods: 'POST,OPTIONS',
        headers: 'content-type,authorization'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { ok: false, errorCode: 'SERVER_ERROR', message: 'Method not allowed' }, corsHeaders);
    }

    const config = getSupabaseConfig();
    if (!config) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Missing Supabase env config.' },
            corsHeaders
        );
    }

    const supabase = createSupabaseServiceClient(config.url, config.serviceRoleKey);
    const token = getBearerToken(req);
    if (!token) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Missing bearer token.' },
            corsHeaders
        );
    }

    const authUser = await readAuthUser(config, token);
    if (!authUser) {
        return sendJson(
            res,
            401,
            { ok: false, errorCode: 'UNAUTHORIZED', message: 'Session is not valid.' },
            corsHeaders
        );
    }

    const body = await parseBody(req);
    const objectBody = toObject(body);
    const inviteCode = normalizeInviteCode(objectBody?.code);
    const deviceKey = normalizeDeviceKey(objectBody?.deviceKey);

    if (!INVITE_CODE_REGEX.test(inviteCode)) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'INVALID_CODE', message: 'Invite code is invalid.' },
            corsHeaders
        );
    }

    if (!DEVICE_KEY_REGEX.test(deviceKey)) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'DEVICE_CODE_REUSE', message: 'Device key is invalid.' },
            corsHeaders
        );
    }

    const rpcResponse = await fetch(`${config.url}/rest/v1/rpc/claim_referral_invite`, {
        method: 'POST',
        headers: createSupabaseServiceHeaders(config.serviceRoleKey, {
            'content-type': 'application/json'
        }),
        body: JSON.stringify({
            p_code: inviteCode,
            p_invitee_user_id: authUser.id,
            p_invitee_email: authUser.email,
            p_device_key: deviceKey
        })
    });

    const rawPayload = (await rpcResponse.json().catch(() => ({}))) as unknown;
    if (!rpcResponse.ok) {
        const rpcError = toObject(rawPayload);
        const rawMessage = toText(rpcError?.message || rpcError?.error || '', 320);

        if (isAmbiguousClaimCountError(rawMessage)) {
            const fallback = await fallbackClaimReferralInvite(config, {
                inviteCode,
                inviteeUserId: authUser.id,
                inviteeEmail: authUser.email,
                deviceKey
            });

            if (fallback.ok === false) {
                return sendJson(
                    res,
                    fallback.status,
                    {
                        ok: false,
                        errorCode: fallback.errorCode,
                        message: fallback.message
                    },
                    corsHeaders
                );
            }

            try {
                const settled = await finalizeReferralClaim(supabase, {
                    inviteeUserId: authUser.id,
                    inviteeEmail: authUser.email,
                    inviteCode: fallback.data.code
                });

                if (!settled) {
                    return sendJson(
                        res,
                        500,
                        { ok: false, errorCode: 'SERVER_ERROR', message: 'Invite reward settlement failed.' },
                        corsHeaders
                    );
                }

                return sendJson(
                    res,
                    200,
                    {
                        ok: true,
                        data: settled
                    },
                    corsHeaders
                );
            } catch {
                return sendJson(
                    res,
                    500,
                    { ok: false, errorCode: 'SERVER_ERROR', message: 'Invite reward settlement failed.' },
                    corsHeaders
                );
            }
        }

        const mapped = mapClaimError(rawMessage);
        if (mapped.errorCode === 'ALREADY_CLAIMED') {
            try {
                const recovered = await finalizeReferralClaim(supabase, {
                    inviteeUserId: authUser.id,
                    inviteeEmail: authUser.email,
                    inviteCode
                });

                if (recovered) {
                    return sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            data: recovered
                        },
                        corsHeaders
                    );
                }
            } catch {
                return sendJson(
                    res,
                    500,
                    { ok: false, errorCode: 'SERVER_ERROR', message: 'Invite reward settlement failed.' },
                    corsHeaders
                );
            }
        }

        return sendJson(
            res,
            mapped.status,
            {
                ok: false,
                errorCode: mapped.errorCode,
                message: mapped.message
            },
            corsHeaders
        );
    }

    const row = parseRpcRow(rawPayload);
    const responseCode = normalizeInviteCode(row?.code);

    if (!INVITE_CODE_REGEX.test(responseCode)) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'RPC did not return a valid claim payload.' },
            corsHeaders
        );
    }

    try {
        const settled = await finalizeReferralClaim(supabase, {
            inviteeUserId: authUser.id,
            inviteeEmail: authUser.email,
            inviteCode: responseCode
        });

        if (!settled) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Invite reward settlement failed.' },
                corsHeaders
            );
        }

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: settled
            },
            corsHeaders
        );
    } catch {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Invite reward settlement failed.' },
            corsHeaders
        );
    }
}
