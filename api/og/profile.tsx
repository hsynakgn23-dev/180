export const config = {
    runtime: 'nodejs'
};

type ApiRequest = {
    query?: Record<string, string | string[] | undefined>;
    url?: string;
    headers?: Record<string, string | undefined>;
};

type ApiResponder = {
    send?: (body: string) => unknown;
    end?: (body?: string) => unknown;
};

type ApiResponse = {
    setHeader?: (key: string, value: string) => void;
    status?: (statusCode: number) => ApiResponder;
};

const safeText = (value: string | null | undefined, max = 40): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const safeInt = (value: string | null | undefined, fallback = 0): number => {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
};

const escapeXml = (value: string): string => (
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
);

const getQueryParam = (req: ApiRequest, key: string): string | null => {
    const rawQueryValue = req?.query?.[key];
    if (typeof rawQueryValue === 'string') return rawQueryValue;
    if (Array.isArray(rawQueryValue) && typeof rawQueryValue[0] === 'string') return rawQueryValue[0];

    const rawUrl = typeof req?.url === 'string' ? req.url : '';
    if (!rawUrl) return null;

    try {
        const host = req?.headers?.host || 'localhost';
        const url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : `https://${host}`);
        return url.searchParams.get(key);
    } catch {
        return null;
    }
};

const sendSvg = (res: ApiResponse | undefined, status: number, body: string): Response | unknown => {
    const cacheControl = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
    if (res && typeof res.setHeader === 'function') {
        res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
        res.setHeader('cache-control', cacheControl);
    }

    if (res && typeof res.status === 'function') {
        const responder = res.status(status);
        if (responder && typeof responder.send === 'function') return responder.send(body);
        if (responder && typeof responder.end === 'function') return responder.end(body);
    }

    return new Response(body, {
        status,
        headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': cacheControl
        }
    });
};

const buildProfileSvg = (params: { handle: string; name: string; league: string; xp: number; streak: number }): string => {
    const handle = escapeXml(params.handle);
    const name = escapeXml(params.name);
    const league = escapeXml(params.league);
    const xp = String(params.xp);
    const streak = String(params.streak);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="180 Absolute Cinema profile card">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121212" />
      <stop offset="52%" stop-color="#1a1d14" />
      <stop offset="100%" stop-color="#2a2116" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="36" y="30" width="1128" height="570" rx="24" fill="none" stroke="rgba(138,154,91,0.28)" />
  <text x="72" y="96" fill="#8A9A5B" font-family="Segoe UI, Arial, sans-serif" font-size="28" letter-spacing="4.5">180 | ABSOLUTE CINEMA</text>
  <text x="72" y="196" fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700">${name}</text>
  <text x="72" y="246" fill="#D6D4CF" font-family="Segoe UI, Arial, sans-serif" font-size="34">@${handle}</text>

  <rect x="72" y="356" width="270" height="156" rx="16" fill="rgba(18,18,18,0.6)" stroke="rgba(255,255,255,0.16)" />
  <text x="98" y="394" fill="rgba(229,228,226,0.68)" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="2.2">LEAGUE</text>
  <text x="98" y="452" fill="#8A9A5B" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="700">${league}</text>

  <rect x="362" y="356" width="220" height="156" rx="16" fill="rgba(18,18,18,0.6)" stroke="rgba(255,255,255,0.16)" />
  <text x="388" y="394" fill="rgba(229,228,226,0.68)" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="2.2">XP</text>
  <text x="388" y="452" fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="700">${xp}</text>

  <rect x="602" y="356" width="270" height="156" rx="16" fill="rgba(18,18,18,0.6)" stroke="rgba(255,255,255,0.16)" />
  <text x="628" y="394" fill="rgba(229,228,226,0.68)" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="2.2">STREAK</text>
  <text x="628" y="452" fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="700">${streak} days</text>
</svg>`;
};

export default function handler(req: ApiRequest, res?: ApiResponse) {
    try {
        const handle = safeText(getQueryParam(req, 'handle'), 24) || 'observer';
        const name = safeText(getQueryParam(req, 'name'), 34) || '@observer';
        const league = safeText(getQueryParam(req, 'league'), 24) || 'Curator';
        const xp = safeInt(getQueryParam(req, 'xp'));
        const streak = safeInt(getQueryParam(req, 'streak'));
        const svg = buildProfileSvg({ handle, name, league, xp, streak });
        return sendSvg(res, 200, svg);
    } catch {
        const fallback = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#121212"/><text x="60" y="120" fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="36">Failed to generate profile OG image</text></svg>';
        return sendSvg(res, 500, fallback);
    }
}
