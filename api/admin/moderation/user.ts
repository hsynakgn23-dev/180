import {
    clampInteger,
    normalizeUuid,
    parseBody,
    requireAdminAccess,
    sendJson,
    toObject,
    toText,
    type ApiRequest,
    type ApiResponse
} from '../../lib/admin.js';

export const config = {
    runtime: 'nodejs'
};

const buildModerationSnapshot = async (
    serviceClient: Awaited<ReturnType<typeof requireAdminAccess>> extends {
        ok: true;
        context: infer Context;
    }
        ? Context['serviceClient']
        : never,
    targetUserId: string
) => {
    const [profileRes, authUserRes] = await Promise.all([
        serviceClient
            .from('profiles')
            .select('user_id,email,display_name,created_at,updated_at')
            .eq('user_id', targetUserId)
            .maybeSingle(),
        serviceClient.auth.admin.getUserById(targetUserId)
    ]);

    const profileRow =
        profileRes.data && typeof profileRes.data === 'object' && !Array.isArray(profileRes.data)
            ? (profileRes.data as Record<string, unknown>)
            : null;
    const authUser = authUserRes.data.user;

    return {
        email:
            toText(profileRow?.email, 240) ||
            toText(authUser?.email, 240).toLowerCase() ||
            '',
        displayName:
            toText(profileRow?.display_name, 120) ||
            toText(authUser?.user_metadata?.full_name, 120) ||
            toText(authUser?.user_metadata?.name, 120) ||
            '',
        createdAt: toText(profileRow?.created_at, 80) || null,
        updatedAt: toText(profileRow?.updated_at, 80) || null
    };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'POST,OPTIONS');
    if (!access.ok) {
        return access.response;
    }

    const { corsHeaders, serviceClient, authUser } = access.context;
    const body = toObject(await parseBody(req));
    const action = toText(body?.action, 20);
    const targetUserId = normalizeUuid(body?.targetUserId);
    const reasonCode = toText(body?.reasonCode, 80) || 'admin_review';
    const note = toText(body?.note, 320);

    if (!targetUserId) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'INVALID_ID', message: 'Target user id is invalid.' },
            corsHeaders
        );
    }

    if (targetUserId === authUser.id) {
        return sendJson(
            res,
            400,
            {
                ok: false,
                errorCode: 'INVALID_TARGET',
                message: 'Admin self-moderation is blocked.'
            },
            corsHeaders
        );
    }

    const targetSnapshot = await buildModerationSnapshot(serviceClient, targetUserId);
    const nowIso = new Date().toISOString();

    if (action === 'suspend') {
        const durationHours = clampInteger(body?.durationHours, 1, 24 * 365, 24);
        const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

        const { error: moderationStateError } = await serviceClient
            .from('user_moderation_state')
            .upsert(
                {
                    user_id: targetUserId,
                    suspended_until: suspendedUntil,
                    updated_by: authUser.id,
                    note
                },
                { onConflict: 'user_id' }
            );

        if (moderationStateError) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Suspension write failed.' },
                corsHeaders
            );
        }

        await serviceClient.auth.admin.updateUserById(targetUserId, {
            ban_duration: `${durationHours}h`
        });

        await serviceClient.from('moderation_actions').insert([
            {
                actor_user_id: authUser.id,
                target_user_id: targetUserId,
                action: 'user_suspend',
                reason_code: reasonCode,
                note,
                metadata: {
                    durationHours,
                    suspendedUntil,
                    email: targetSnapshot.email,
                    displayName: targetSnapshot.displayName
                }
            }
        ]);

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'suspend',
                    targetUserId,
                    suspendedUntil
                }
            },
            corsHeaders
        );
    }

    if (action === 'unsuspend') {
        const { error: moderationStateError } = await serviceClient
            .from('user_moderation_state')
            .upsert(
                {
                    user_id: targetUserId,
                    suspended_until: null,
                    updated_by: authUser.id,
                    note
                },
                { onConflict: 'user_id' }
            );

        if (moderationStateError) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: 'Unsuspend write failed.' },
                corsHeaders
            );
        }

        await serviceClient.auth.admin.updateUserById(targetUserId, {
            ban_duration: 'none'
        });

        await serviceClient.from('moderation_actions').insert([
            {
                actor_user_id: authUser.id,
                target_user_id: targetUserId,
                action: 'user_unsuspend',
                reason_code: reasonCode,
                note,
                metadata: {
                    email: targetSnapshot.email,
                    displayName: targetSnapshot.displayName
                }
            }
        ]);

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'unsuspend',
                    targetUserId,
                    suspendedUntil: null
                }
            },
            corsHeaders
        );
    }

    if (action === 'delete') {
        await serviceClient.from('moderation_actions').insert([
            {
                actor_user_id: authUser.id,
                target_user_id: targetUserId,
                action: 'user_delete',
                reason_code: reasonCode,
                note,
                metadata: {
                    email: targetSnapshot.email,
                    displayName: targetSnapshot.displayName,
                    requestedAt: nowIso
                }
            }
        ]);

        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId, false);
        if (deleteError) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: deleteError.message },
                corsHeaders
            );
        }

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'delete',
                    targetUserId
                }
            },
            corsHeaders
        );
    }

    return sendJson(
        res,
        400,
        { ok: false, errorCode: 'INVALID_ACTION', message: 'Invalid moderation action.' },
        corsHeaders
    );
}
