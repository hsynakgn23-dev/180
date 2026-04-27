import {
    type AdminContext,
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

type ModerationStateSnapshot = {
    userId: string;
    suspendedUntil: string | null;
    updatedBy: string | null;
    note: string | null;
};

const getErrorMessage = (error: unknown, fallback = 'Admin operation failed.'): string => {
    if (!error) return '';
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === 'object' && 'message' in error) {
        return toText((error as { message?: unknown }).message, 320) || fallback;
    }
    return fallback;
};

const buildModerationSnapshot = async (
    serviceClient: AdminContext['serviceClient'],
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

const readModerationState = async (
    serviceClient: AdminContext['serviceClient'],
    targetUserId: string
): Promise<ModerationStateSnapshot | null> => {
    const { data, error } = await serviceClient
        .from('user_moderation_state')
        .select('user_id,suspended_until,updated_by,note')
        .eq('user_id', targetUserId)
        .maybeSingle();

    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;

    const record = data as Record<string, unknown>;
    return {
        userId: normalizeUuid(record.user_id) || targetUserId,
        suspendedUntil: toText(record.suspended_until, 80) || null,
        updatedBy: normalizeUuid(record.updated_by) || null,
        note: toText(record.note, 320) || null
    };
};

const restoreModerationState = async (
    serviceClient: AdminContext['serviceClient'],
    targetUserId: string,
    previousState: ModerationStateSnapshot | null
) => {
    if (!previousState) {
        return serviceClient.from('user_moderation_state').delete().eq('user_id', targetUserId);
    }

    return serviceClient.from('user_moderation_state').upsert(
        {
            user_id: previousState.userId || targetUserId,
            suspended_until: previousState.suspendedUntil,
            updated_by: previousState.updatedBy,
            note: previousState.note
        },
        { onConflict: 'user_id' }
    );
};

const createAuditAction = async (
    serviceClient: AdminContext['serviceClient'],
    payload: Record<string, unknown>
): Promise<{ id: string; error: string }> => {
    const { data, error } = await serviceClient
        .from('moderation_actions')
        .insert([payload])
        .select('id')
        .single();

    if (error) return { id: '', error: getErrorMessage(error, 'Audit write failed.') };

    const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const id = normalizeUuid(record.id);
    if (!id) return { id: '', error: 'Audit write did not return an id.' };
    return { id, error: '' };
};

const updateAuditStatus = async (
    serviceClient: AdminContext['serviceClient'],
    auditId: string,
    metadata: Record<string, unknown>,
    status: string,
    errorMessage?: string
): Promise<string> => {
    if (!auditId) return '';

    const { error } = await serviceClient
        .from('moderation_actions')
        .update({
            metadata: {
                ...metadata,
                status,
                ...(errorMessage ? { error: errorMessage } : {})
            }
        })
        .eq('id', auditId);

    return getErrorMessage(error, 'Audit update failed.');
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
        const previousState = await readModerationState(serviceClient, targetUserId);
        const auditMetadata = {
            status: 'requested',
            requestedAt: nowIso,
            durationHours,
            suspendedUntil,
            email: targetSnapshot.email,
            displayName: targetSnapshot.displayName,
            targetUserId
        };
        const audit = await createAuditAction(serviceClient, {
            actor_user_id: authUser.id,
            target_user_id: targetUserId,
            action: 'user_suspend',
            reason_code: reasonCode,
            note,
            metadata: auditMetadata
        });

        if (audit.error) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
                corsHeaders
            );
        }

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
            const message = getErrorMessage(moderationStateError, 'Suspension write failed.');
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message },
                corsHeaders
            );
        }

        const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(
            targetUserId,
            {
                ban_duration: `${durationHours}h`
            }
        );

        if (authUpdateError) {
            const message = getErrorMessage(authUpdateError, 'Supabase Auth ban update failed.');
            const { error: restoreError } = await restoreModerationState(
                serviceClient,
                targetUserId,
                previousState
            );
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);

            return sendJson(
                res,
                500,
                {
                    ok: false,
                    errorCode: 'SERVER_ERROR',
                    message,
                    rollbackError: getErrorMessage(restoreError, '')
                },
                corsHeaders
            );
        }

        const auditWarning = await updateAuditStatus(
            serviceClient,
            audit.id,
            auditMetadata,
            'fulfilled'
        );

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'suspend',
                    targetUserId,
                    suspendedUntil,
                    auditWarning: auditWarning || undefined
                }
            },
            corsHeaders
        );
    }

    if (action === 'unsuspend') {
        const previousState = await readModerationState(serviceClient, targetUserId);
        const auditMetadata = {
            status: 'requested',
            requestedAt: nowIso,
            email: targetSnapshot.email,
            displayName: targetSnapshot.displayName,
            targetUserId
        };
        const audit = await createAuditAction(serviceClient, {
            actor_user_id: authUser.id,
            target_user_id: targetUserId,
            action: 'user_unsuspend',
            reason_code: reasonCode,
            note,
            metadata: auditMetadata
        });

        if (audit.error) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
                corsHeaders
            );
        }

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
            const message = getErrorMessage(moderationStateError, 'Unsuspend write failed.');
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message },
                corsHeaders
            );
        }

        const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(
            targetUserId,
            {
                ban_duration: 'none'
            }
        );

        if (authUpdateError) {
            const message = getErrorMessage(authUpdateError, 'Supabase Auth unban update failed.');
            const { error: restoreError } = await restoreModerationState(
                serviceClient,
                targetUserId,
                previousState
            );
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);

            return sendJson(
                res,
                500,
                {
                    ok: false,
                    errorCode: 'SERVER_ERROR',
                    message,
                    rollbackError: getErrorMessage(restoreError, '')
                },
                corsHeaders
            );
        }

        const auditWarning = await updateAuditStatus(
            serviceClient,
            audit.id,
            auditMetadata,
            'fulfilled'
        );

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'unsuspend',
                    targetUserId,
                    suspendedUntil: null,
                    auditWarning: auditWarning || undefined
                }
            },
            corsHeaders
        );
    }

    if (action === 'delete') {
        const auditMetadata = {
            status: 'requested',
            requestedAt: nowIso,
            email: targetSnapshot.email,
            displayName: targetSnapshot.displayName,
            targetUserId
        };
        const audit = await createAuditAction(serviceClient, {
            actor_user_id: authUser.id,
            target_user_id: targetUserId,
            action: 'user_delete',
            reason_code: reasonCode,
            note,
            metadata: auditMetadata
        });

        if (audit.error) {
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
                corsHeaders
            );
        }

        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
            targetUserId,
            false
        );
        if (deleteError) {
            const message = getErrorMessage(deleteError, 'User delete failed.');
            await updateAuditStatus(serviceClient, audit.id, auditMetadata, 'failed', message);
            return sendJson(
                res,
                500,
                { ok: false, errorCode: 'SERVER_ERROR', message },
                corsHeaders
            );
        }

        const auditWarning = await updateAuditStatus(
            serviceClient,
            audit.id,
            auditMetadata,
            'fulfilled'
        );

        return sendJson(
            res,
            200,
            {
                ok: true,
                data: {
                    action: 'delete',
                    targetUserId,
                    auditWarning: auditWarning || undefined
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
