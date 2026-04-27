import {
    type AdminContext,
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

type EntityConfig = {
    table: 'rituals' | 'ritual_replies';
    idField: 'ritual_id' | 'reply_id';
    select: string;
};

const ENTITY_CONFIG: Record<'ritual' | 'reply', EntityConfig> = {
    ritual: {
        table: 'rituals',
        idField: 'ritual_id',
        select: 'id,user_id,author,movie_title,text,is_removed'
    },
    reply: {
        table: 'ritual_replies',
        idField: 'reply_id',
        select: 'id,user_id,ritual_id,author,text,is_removed'
    }
};

const getErrorMessage = (error: unknown, fallback = 'Admin operation failed.'): string => {
    if (!error) return '';
    if (error instanceof Error) return error.message || fallback;
    if (typeof error === 'object' && 'message' in error) {
        return toText((error as { message?: unknown }).message, 320) || fallback;
    }
    return fallback;
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

const updateAuditMetadata = async (
    serviceClient: AdminContext['serviceClient'],
    auditId: string,
    metadata: Record<string, unknown>
): Promise<string> => {
    if (!auditId) return '';

    const { error } = await serviceClient
        .from('moderation_actions')
        .update({ metadata })
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
    const entityType = toText(body?.entityType, 16) === 'reply' ? 'reply' : 'ritual';
    const entityId = normalizeUuid(body?.entityId);
    const action = toText(body?.action, 16) === 'restore' ? 'restore' : 'remove';
    const reasonCode = toText(body?.reasonCode, 80) || 'admin_review';
    const note = toText(body?.note, 320);

    if (!entityId) {
        return sendJson(
            res,
            400,
            { ok: false, errorCode: 'INVALID_ID', message: 'Entity id is invalid.' },
            corsHeaders
        );
    }

    const entityConfig = ENTITY_CONFIG[entityType];
    const { data: existingRow, error: existingError } = await serviceClient
        .from(entityConfig.table)
        .select(entityConfig.select)
        .eq('id', entityId)
        .maybeSingle();

    if (existingError || !existingRow) {
        return sendJson(
            res,
            404,
            { ok: false, errorCode: 'NOT_FOUND', message: 'Moderation target was not found.' },
            corsHeaders
        );
    }

    const nowIso = new Date().toISOString();
    const existingRecord =
        existingRow && typeof existingRow === 'object' && !Array.isArray(existingRow)
            ? (existingRow as unknown as Record<string, unknown>)
            : {};
    const auditMetadata = {
        status: 'requested',
        requestedAt: nowIso,
        entityType,
        entityId,
        author: toText(existingRecord.author, 120),
        movieTitle: toText(existingRecord.movie_title, 180),
        preview: toText(existingRecord.text, 220)
    };
    const moderationPayload = {
        actor_user_id: authUser.id,
        target_user_id: normalizeUuid(existingRecord.user_id) || null,
        action: `${entityType}_${action}`,
        reason_code: reasonCode,
        note,
        metadata: auditMetadata,
        [entityConfig.idField]: entityId
    };
    const audit = await createAuditAction(serviceClient, moderationPayload);

    if (audit.error) {
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: audit.error },
            corsHeaders
        );
    }

    const updates =
        action === 'remove'
            ? {
                  is_removed: true,
                  removed_at: nowIso,
                  removed_by: authUser.id,
                  removal_reason: reasonCode
              }
            : {
                  is_removed: false,
                  removed_at: null,
                  removed_by: null,
                  removal_reason: null
              };

    const { data: updatedRow, error: updateError } = await serviceClient
        .from(entityConfig.table)
        .update(updates)
        .eq('id', entityId)
        .select(entityConfig.select)
        .maybeSingle();

    if (updateError || !updatedRow) {
        const message = getErrorMessage(updateError, 'Moderation update failed.');
        await updateAuditMetadata(serviceClient, audit.id, {
            ...auditMetadata,
            status: 'failed',
            error: message
        });
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message },
            corsHeaders
        );
    }

    let reportResolutionWarning = '';
    if (action === 'remove') {
        const reportField = entityConfig.idField;
        const { error: reportError } = await serviceClient
            .from('content_reports')
            .update({
                status: 'resolved',
                reviewed_at: nowIso,
                reviewed_by: authUser.id
            })
            .eq(reportField, entityId)
            .in('status', ['open', 'reviewing']);
        reportResolutionWarning = getErrorMessage(reportError, '');
    }

    const auditWarning = await updateAuditMetadata(serviceClient, audit.id, {
        ...auditMetadata,
        status: reportResolutionWarning ? 'fulfilled_with_report_warning' : 'fulfilled',
        ...(reportResolutionWarning ? { reportResolutionWarning } : {})
    });
    const updatedRecord =
        updatedRow && typeof updatedRow === 'object' && !Array.isArray(updatedRow)
            ? (updatedRow as unknown as Record<string, unknown>)
            : {};

    return sendJson(
        res,
        200,
        {
            ok: true,
            data: {
                entityType,
                entityId,
                action,
                isRemoved: Boolean(updatedRecord.is_removed),
                userId: normalizeUuid(updatedRecord.user_id) || null,
                author: toText(updatedRecord.author, 120),
                movieTitle: toText(updatedRecord.movie_title, 180),
                text: toText(updatedRecord.text, 280),
                removalReason: toText(updatedRecord.removal_reason, 80),
                reportResolutionWarning: reportResolutionWarning || undefined,
                auditWarning: auditWarning || undefined
            }
        },
        corsHeaders
    );
}
