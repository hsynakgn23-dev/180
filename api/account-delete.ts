import {
    getBearerToken,
    isSupabaseCapabilityError,
    parseBody,
    sendJson,
    toObject,
    toText,
    type ApiRequest,
    type ApiResponse
} from './lib/admin.js';
import { createCorsHeaders } from './lib/cors.js';
import { createSupabaseServiceClient } from './lib/supabaseServiceClient.js';

export const config = {
    runtime: 'nodejs'
};

type AccountDeleteConfig = {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
};

type AuthenticatedUser = {
    id: string;
    email: string;
};

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value: unknown): string => {
    const normalized = toText(value, 80);
    return UUID_REGEX.test(normalized) ? normalized : '';
};

const getAccountDeleteConfig = (): AccountDeleteConfig | null => {
    const url = toText(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, 240);
    const serviceRoleKey = toText(process.env.SUPABASE_SERVICE_ROLE_KEY, 2048);
    const anonKey = toText(
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        2048
    );

    if (!url || !serviceRoleKey || !anonKey) return null;
    return {
        url: url.replace(/\/+$/, ''),
        serviceRoleKey,
        anonKey
    };
};

const readAuthenticatedUser = async (
    configValue: AccountDeleteConfig,
    accessToken: string
): Promise<AuthenticatedUser | null> => {
    try {
        const response = await fetch(`${configValue.url}/auth/v1/user`, {
            headers: {
                apikey: configValue.anonKey,
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!response.ok) return null;
        const payload = (await response.json()) as { id?: unknown; email?: unknown };
        const userId = normalizeUuid(payload.id);
        if (!userId) return null;

        return {
            id: userId,
            email: toText(payload.email, 240).toLowerCase() || `${userId}@users.local`
        };
    } catch {
        return null;
    }
};

const deleteResidualUserRows = async (
    serviceClient: ReturnType<typeof createSupabaseServiceClient>,
    userId: string
): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await serviceClient
        .from('rituals_legacy_social_snapshot')
        .delete()
        .eq('user_id', userId);

    if (error && !isSupabaseCapabilityError(error)) {
        return {
            ok: false,
            message: toText(error.message, 220) || 'Residual account cleanup failed.'
        };
    }

    return { ok: true };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
    const corsHeaders = createCorsHeaders(req, {
        methods: 'POST,OPTIONS',
        headers: 'content-type,authorization'
    });

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, { ok: true }, corsHeaders);
    }

    if (String(req.method || 'GET').toUpperCase() !== 'POST') {
        return sendJson(
            res,
            405,
            { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
            corsHeaders
        );
    }

    const configValue = getAccountDeleteConfig();
    if (!configValue) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: 'Missing Supabase env config.'
            },
            corsHeaders
        );
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) {
        return sendJson(
            res,
            401,
            {
                ok: false,
                errorCode: 'UNAUTHORIZED',
                message: 'Missing bearer token.'
            },
            corsHeaders
        );
    }

    const body = toObject(await parseBody(req));
    if (body?.confirm !== true) {
        return sendJson(
            res,
            400,
            {
                ok: false,
                errorCode: 'CONFIRMATION_REQUIRED',
                message: 'Explicit deletion confirmation is required.'
            },
            corsHeaders
        );
    }

    const authUser = await readAuthenticatedUser(configValue, accessToken);
    if (!authUser?.id) {
        return sendJson(
            res,
            401,
            {
                ok: false,
                errorCode: 'UNAUTHORIZED',
                message: 'Session is not valid.'
            },
            corsHeaders
        );
    }

    const serviceClient = createSupabaseServiceClient(
        configValue.url,
        configValue.serviceRoleKey
    );
    const cleanupResult = await deleteResidualUserRows(serviceClient, authUser.id);
    if (!cleanupResult.ok) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: cleanupResult.message
            },
            corsHeaders
        );
    }

    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(authUser.id, false);
    if (deleteError) {
        return sendJson(
            res,
            500,
            {
                ok: false,
                errorCode: 'SERVER_ERROR',
                message: toText(deleteError.message, 220) || 'Account deletion failed.'
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
                deletedUserId: authUser.id,
                email: authUser.email,
                deletedAt
            }
        },
        corsHeaders
    );
}
