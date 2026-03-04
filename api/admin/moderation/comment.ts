import {
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
        return sendJson(
            res,
            500,
            { ok: false, errorCode: 'SERVER_ERROR', message: 'Moderation update failed.' },
            corsHeaders
        );
    }

    const existingRecord =
        existingRow && typeof existingRow === 'object' && !Array.isArray(existingRow)
            ? (existingRow as unknown as Record<string, unknown>)
            : {};
    const updatedRecord =
        updatedRow && typeof updatedRow === 'object' && !Array.isArray(updatedRow)
            ? (updatedRow as unknown as Record<string, unknown>)
            : {};

    const moderationPayload = {
        actor_user_id: authUser.id,
        target_user_id: normalizeUuid(existingRecord.user_id) || null,
        action: `${entityType}_${action}`,
        reason_code: reasonCode,
        note,
        metadata: {
            author: toText(existingRecord.author, 120),
            movieTitle: toText(existingRecord.movie_title, 180),
            preview: toText(existingRecord.text, 220)
        },
        [entityConfig.idField]: entityId
    };

    await serviceClient.from('moderation_actions').insert([moderationPayload]);

    if (action === 'remove') {
        const reportField = entityConfig.idField;
        await serviceClient
            .from('content_reports')
            .update({
                status: 'resolved',
                reviewed_at: nowIso,
                reviewed_by: authUser.id
            })
            .eq(reportField, entityId)
            .in('status', ['open', 'reviewing']);
    }

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
                removalReason: toText(updatedRecord.removal_reason, 80)
            }
        },
        corsHeaders
    );
}
