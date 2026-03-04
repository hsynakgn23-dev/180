import {
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

type AdminRitualRow = {
    id?: unknown;
    user_id?: unknown;
    author?: unknown;
    movie_title?: unknown;
    text?: unknown;
    timestamp?: unknown;
    created_at?: unknown;
    is_removed?: unknown;
    removed_at?: unknown;
    removal_reason?: unknown;
};

type AdminReplyRow = {
    id?: unknown;
    ritual_id?: unknown;
    user_id?: unknown;
    author?: unknown;
    text?: unknown;
    created_at?: unknown;
    is_removed?: unknown;
    removed_at?: unknown;
    removal_reason?: unknown;
};

const normalizeSearchQuery = (value: string): string =>
    toText(value, 120).replace(/[%(),']/g, ' ').replace(/\s+/g, ' ').trim();

const RITUAL_VARIANTS = [
    {
        select:
            'id,user_id,author,movie_title,text,timestamp,is_removed,removed_at,removal_reason',
        orderBy: 'timestamp'
    },
    {
        select:
            'id,user_id,author,movie_title,text,created_at,is_removed,removed_at,removal_reason',
        orderBy: 'created_at'
    }
] as const;

const readRecentRituals = async (serviceClient: AdminContext['serviceClient'], limit: number) => {
    let lastError: { code?: string | null; message?: string | null } | null = null;
    for (const variant of RITUAL_VARIANTS) {
        const { data, error } = await serviceClient
            .from('rituals')
            .select(variant.select)
            .order(variant.orderBy, { ascending: false })
            .limit(limit);

        if (error) {
            lastError = error;
            if (isSupabaseCapabilityError(error)) continue;
            return { rows: [], error };
        }

        return {
            rows: Array.isArray(data) ? (data as AdminRitualRow[]) : [],
            error: null
        };
    }

    return { rows: [], error: lastError };
};

const readRecentReplies = async (serviceClient: AdminContext['serviceClient'], limit: number) => {
    const { data, error } = await serviceClient
        .from('ritual_replies')
        .select(
            'id,ritual_id,user_id,author,text,created_at,is_removed,removed_at,removal_reason'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

    return {
        rows: Array.isArray(data) ? (data as AdminReplyRow[]) : [],
        error
    };
};

type AdminContext = Awaited<ReturnType<typeof requireAdminAccess>> extends {
    ok: true;
    context: infer Context;
}
    ? Context
    : never;

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'GET,OPTIONS');
    if (!access.ok) {
        return access.response;
    }

    const { corsHeaders, serviceClient } = access.context;
    const limit = clampInteger(getQueryValue(req, 'limit'), 5, 40, 20);
    const rawQuery = getQueryValue(req, 'q');
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    const queryUuid = normalizeUuid(normalizedQuery);
    const nowIso = new Date().toISOString();

    const usersQuery = (() => {
        const request = serviceClient
            .from('profiles')
            .select('user_id,email,display_name,created_at,updated_at')
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (queryUuid) {
            return request.eq('user_id', queryUuid);
        }

        if (normalizedQuery) {
            const safe = normalizedQuery.replace(/\s+/g, '%');
            return request.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`);
        }

        return request;
    })();

    const [
        openReportsRes,
        removedRitualsRes,
        removedRepliesRes,
        suspendedUsersRes,
        recentReportsRes,
        recentActionsRes,
        usersRes,
        ritualsResult,
        repliesResult
    ] = await Promise.all([
        serviceClient
            .from('content_reports')
            .select('id', { head: true, count: 'exact' })
            .eq('status', 'open'),
        serviceClient
            .from('rituals')
            .select('id', { head: true, count: 'exact' })
            .eq('is_removed', true),
        serviceClient
            .from('ritual_replies')
            .select('id', { head: true, count: 'exact' })
            .eq('is_removed', true),
        serviceClient
            .from('user_moderation_state')
            .select('user_id', { head: true, count: 'exact' })
            .gt('suspended_until', nowIso),
        serviceClient
            .from('content_reports')
            .select(
                'id,reporter_user_id,target_user_id,ritual_id,reply_id,reason_code,details,status,created_at'
            )
            .order('created_at', { ascending: false })
            .limit(Math.min(12, limit)),
        serviceClient
            .from('moderation_actions')
            .select(
                'id,actor_user_id,target_user_id,ritual_id,reply_id,report_id,action,reason_code,note,metadata,created_at'
            )
            .order('created_at', { ascending: false })
            .limit(Math.min(20, limit)),
        usersQuery,
        readRecentRituals(serviceClient, limit),
        readRecentReplies(serviceClient, limit)
    ]);

    const usersRows = Array.isArray(usersRes.data)
        ? (usersRes.data as Array<Record<string, unknown>>)
        : [];
    const userIds = Array.from(
        new Set(usersRows.map((row) => normalizeUuid(row.user_id)).filter(Boolean))
    );

    const [userModerationRes, userAdminRolesRes] = userIds.length
        ? await Promise.all([
              serviceClient
                  .from('user_moderation_state')
                  .select('user_id,suspended_until,note')
                  .in('user_id', userIds),
              serviceClient.from('admin_users').select('user_id,role').in('user_id', userIds)
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

    const moderationMap = new Map<
        string,
        { suspendedUntil: string | null; note: string }
    >();
    for (const row of Array.isArray(userModerationRes.data)
        ? (userModerationRes.data as Array<Record<string, unknown>>)
        : []) {
        const userId = normalizeUuid(row.user_id);
        if (!userId) continue;
        moderationMap.set(userId, {
            suspendedUntil: toText(row.suspended_until, 80) || null,
            note: toText(row.note, 320)
        });
    }

    const adminRoleMap = new Map<string, string>();
    for (const row of Array.isArray(userAdminRolesRes.data)
        ? (userAdminRolesRes.data as Array<Record<string, unknown>>)
        : []) {
        const userId = normalizeUuid(row.user_id);
        if (!userId) continue;
        adminRoleMap.set(userId, toText(row.role, 24) || 'member');
    }

    const users = usersRows.map((row) => {
        const userId = normalizeUuid(row.user_id);
        const moderationState = userId ? moderationMap.get(userId) : null;
        const role = userId ? adminRoleMap.get(userId) || 'member' : 'member';
        return {
            userId,
            email: toText(row.email, 240),
            displayName: toText(row.display_name, 120),
            createdAt: toText(row.created_at, 80) || null,
            updatedAt: toText(row.updated_at, 80) || null,
            role,
            suspendedUntil: moderationState?.suspendedUntil || null,
            moderationNote: moderationState?.note || ''
        };
    });

    const rituals = ritualsResult.rows.map((row) => ({
        id: toText(row.id, 120),
        userId: normalizeUuid(row.user_id),
        author: toText(row.author, 120),
        movieTitle: toText(row.movie_title, 180),
        text: toText(row.text, 280),
        createdAt: toText(row.timestamp || row.created_at, 80) || null,
        isRemoved: Boolean(row.is_removed),
        removedAt: toText(row.removed_at, 80) || null,
        removalReason: toText(row.removal_reason, 120)
    }));

    const replies = repliesResult.rows.map((row) => ({
        id: toText(row.id, 120),
        ritualId: toText(row.ritual_id, 120),
        userId: normalizeUuid(row.user_id),
        author: toText(row.author, 120),
        text: toText(row.text, 280),
        createdAt: toText(row.created_at, 80) || null,
        isRemoved: Boolean(row.is_removed),
        removedAt: toText(row.removed_at, 80) || null,
        removalReason: toText(row.removal_reason, 120)
    }));

    const reports = (Array.isArray(recentReportsRes.data)
        ? (recentReportsRes.data as Array<Record<string, unknown>>)
        : []
    ).map((row) => ({
        id: toText(row.id, 120),
        reporterUserId: normalizeUuid(row.reporter_user_id),
        targetUserId: normalizeUuid(row.target_user_id),
        ritualId: toText(row.ritual_id, 120),
        replyId: toText(row.reply_id, 120),
        reasonCode: toText(row.reason_code, 80),
        details: toText(row.details, 280),
        status: toText(row.status, 40),
        createdAt: toText(row.created_at, 80) || null
    }));

    const actions = (Array.isArray(recentActionsRes.data)
        ? (recentActionsRes.data as Array<Record<string, unknown>>)
        : []
    ).map((row) => ({
        id: toText(row.id, 120),
        actorUserId: normalizeUuid(row.actor_user_id),
        targetUserId: normalizeUuid(row.target_user_id),
        ritualId: toText(row.ritual_id, 120),
        replyId: toText(row.reply_id, 120),
        reportId: toText(row.report_id, 120),
        action: toText(row.action, 80),
        reasonCode: toText(row.reason_code, 80),
        note: toText(row.note, 320),
        metadata:
            row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
                ? row.metadata
                : {},
        createdAt: toText(row.created_at, 80) || null
    }));

    const hasFatalError =
        Boolean(usersRes.error) ||
        Boolean(ritualsResult.error && !isSupabaseCapabilityError(ritualsResult.error)) ||
        Boolean(repliesResult.error) ||
        Boolean(recentReportsRes.error) ||
        Boolean(recentActionsRes.error);

    if (hasFatalError) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: 'Admin dashboard data could not be loaded.'
            },
            corsHeaders
        );
    }

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                query: normalizedQuery,
                stats: {
                    openReports: Math.max(0, Number(openReportsRes.count || 0)),
                    removedRituals: Math.max(0, Number(removedRitualsRes.count || 0)),
                    removedReplies: Math.max(0, Number(removedRepliesRes.count || 0)),
                    suspendedUsers: Math.max(0, Number(suspendedUsersRes.count || 0))
                },
                users,
                rituals,
                replies,
                reports,
                actions
            }
        },
        corsHeaders
    );
}
