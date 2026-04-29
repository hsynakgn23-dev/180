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

const sendResponse = (res: unknown, status: number, payload: Record<string, unknown>) => {
    if (res && typeof (res as { status?: unknown }).status === 'function') {
        return (res as { status: (code: number) => { json: (body: unknown) => unknown } })
            .status(status)
            .json(payload);
    }

    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8'
        }
    });
};

export default async function handler(req: ApiRequest, res: unknown) {
    const action = readReferralAction(req);

    if (action === 'create' || action === 'claim') {
        return sendResponse(res, 410, {
            ok: false,
            errorCode: 'REFERRAL_PROGRAM_DISABLED',
            message: 'Friend invite program is disabled. Gift codes are handled through /api/gift-redeem.'
        });
    }

    return sendResponse(res, 400, {
        ok: false,
        errorCode: 'INVALID_ACTION',
        message: 'Referral action is invalid.'
    });
}
