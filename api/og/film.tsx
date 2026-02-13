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

const safeText = (value: string | null | undefined, max = 80): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const safeYear = (value: string | null | undefined): string => {
    if (!value) return '';
    const year = Number.parseInt(value, 10);
    if (!Number.isFinite(year) || year < 1888 || year > 2200) return '';
    return String(year);
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

const wrapText = (input: string, maxLineLength: number, maxLines: number): string[] => {
    const words = input.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        const testLine = current ? `${current} ${word}` : word;
        if (testLine.length <= maxLineLength) {
            current = testLine;
            continue;
        }
        if (current) lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
    }

    if (lines.length < maxLines && current) lines.push(current);
    if (lines.length > maxLines) return lines.slice(0, maxLines);
    return lines;
};

const buildTspans = (lines: string[], x: number, startY: number, lineHeight: number): string => {
    return lines
        .map((line, index) => {
            const y = startY + index * lineHeight;
            return `<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`;
        })
        .join('');
};

const buildFilmSvg = (params: { title: string; subtitle: string; author: string; slot: string; quote: string }): string => {
    const titleLines = wrapText(params.title, 28, 2);
    const quoteLines = wrapText(params.quote, 54, 2);
    const subtitle = escapeXml(params.subtitle);
    const author = escapeXml(params.author);
    const slot = escapeXml(params.slot);
    const titleText = buildTspans(titleLines, 72, 248, 82);
    const quoteText = buildTspans(quoteLines, 72, 486, 42);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="180 Absolute Cinema film card">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121212" />
      <stop offset="52%" stop-color="#1a1d14" />
      <stop offset="100%" stop-color="#241e18" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="24" y="24" width="1152" height="582" rx="24" fill="none" stroke="rgba(138,154,91,0.26)" />
  <text x="72" y="94" fill="#8A9A5B" font-family="Segoe UI, Arial, sans-serif" font-size="28" letter-spacing="4.3">180 | ABSOLUTE CINEMA</text>
  ${slot ? `<rect x="946" y="56" width="188" height="42" rx="21" fill="none" stroke="rgba(138,154,91,0.5)" /><text x="1040" y="83" text-anchor="middle" fill="#8A9A5B" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="1.8">${slot}</text>` : ''}
  <text fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700">${titleText}</text>
  <text x="72" y="372" fill="rgba(229,228,226,0.78)" font-family="Segoe UI, Arial, sans-serif" font-size="28" letter-spacing="1.6">${subtitle}</text>
  ${params.quote ? `<text fill="#F0EEE9" font-family="Georgia, Times New Roman, serif" font-size="34">${quoteText}</text>` : ''}
  <text x="72" y="584" fill="#8A9A5B" font-family="Segoe UI, Arial, sans-serif" font-size="26">@${author}</text>
</svg>`;
};

export default function handler(req: ApiRequest, res?: ApiResponse) {
    try {
        const title = safeText(getQueryParam(req, 'title'), 64) || 'Untitled Film';
        const year = safeYear(getQueryParam(req, 'year'));
        const genre = safeText(getQueryParam(req, 'genre'), 26);
        const author = safeText(getQueryParam(req, 'author'), 26) || 'observer';
        const slot = safeText(getQueryParam(req, 'slot'), 24);
        const quote = safeText(getQueryParam(req, 'quote'), 180);

        const subtitleParts = [year, genre].filter(Boolean);
        const subtitle = subtitleParts.length ? subtitleParts.join('  |  ') : 'Daily Selection';
        const svg = buildFilmSvg({ title, subtitle, author, slot, quote });
        return sendSvg(res, 200, svg);
    } catch {
        const fallback = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#121212"/><text x="60" y="120" fill="#E5E4E2" font-family="Segoe UI, Arial, sans-serif" font-size="36">Failed to generate film OG image</text></svg>';
        return sendSvg(res, 500, fallback);
    }
}
