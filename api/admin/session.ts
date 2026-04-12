import { requireAdminAccess, sendJson, type ApiRequest, type ApiResponse } from '../lib/admin.js';

export const config = {
    runtime: 'nodejs'
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const access = await requireAdminAccess(req, res, 'GET,OPTIONS');
    if (!access.ok) {
        return access.response;
    }

    const { corsHeaders, authUser, membership, csrfToken } = access.context;
    return sendJson(
        res,
        200,
        {
            ok: true,
            csrfToken,
            data: {
                userId: authUser.id,
                email: authUser.email,
                role: membership.role,
                note: membership.note,
                createdAt: membership.createdAt
            }
        },
        corsHeaders
    );
}
