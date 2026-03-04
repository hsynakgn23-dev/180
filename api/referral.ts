import claimReferralHandler from './lib/referralClaim.js';
import createReferralHandler from './lib/referralCreate.js';

export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | undefined> | Headers;
    on?: (event: string, callback: (chunk: Buffer | string) => void) => void;
    url?: string;
};

const readReferralAction = (req: ApiRequest): 'create' | 'claim' | null => {
    const rawUrl = String(req.url || '').trim();
    if (!rawUrl) return null;

    try {
        const parsedUrl = new URL(rawUrl, 'http://localhost');
        const action = String(parsedUrl.searchParams.get('action') || '').trim().toLowerCase();
        if (action === 'create' || action === 'claim') return action;

        if (parsedUrl.pathname.endsWith('/create')) return 'create';
        if (parsedUrl.pathname.endsWith('/claim')) return 'claim';
        return null;
    } catch {
        return null;
    }
};

export default async function handler(req: ApiRequest, res: unknown) {
    const action = readReferralAction(req);

    if (action === 'create') {
        return createReferralHandler(req, res as never);
    }

    if (action === 'claim') {
        return claimReferralHandler(req, res as never);
    }

    const responseBody = {
        ok: false,
        errorCode: 'INVALID_ACTION',
        message: 'Referral action is invalid.'
    };

    if (res && typeof (res as { status?: unknown }).status === 'function') {
        return (res as { status: (code: number) => { json: (payload: unknown) => unknown } })
            .status(400)
            .json(responseBody);
    }

    return new Response(JSON.stringify(responseBody), {
        status: 400,
        headers: {
            'content-type': 'application/json; charset=utf-8'
        }
    });
}
