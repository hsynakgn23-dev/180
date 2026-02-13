import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge'
};

const safeText = (value: string | null, max = 80): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const safeYear = (value: string | null): string => {
    if (!value) return '';
    const year = Number.parseInt(value, 10);
    if (!Number.isFinite(year) || year < 1888 || year > 2200) return '';
    return String(year);
};

export default function handler(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const title = safeText(searchParams.get('title'), 64) || 'Untitled Film';
        const year = safeYear(searchParams.get('year'));
        const genre = safeText(searchParams.get('genre'), 26);
        const author = safeText(searchParams.get('author'), 26) || 'observer';
        const slot = safeText(searchParams.get('slot'), 24);
        const quote = safeText(searchParams.get('quote'), 180);

        const subtitleParts = [year, genre].filter(Boolean);
        const subtitle = subtitleParts.length ? subtitleParts.join('  |  ') : 'Daily Selection';

        return new ImageResponse(
            (
                <div
                    style={{
                        width: '1200px',
                        height: '630px',
                        display: 'flex',
                        background: 'linear-gradient(145deg, #121212 0%, #1a1d14 52%, #241e18 100%)',
                        color: '#E5E4E2',
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                        padding: '56px 64px',
                        position: 'relative'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: '24px',
                            border: '1px solid rgba(138,154,91,0.24)',
                            borderRadius: '24px'
                        }}
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                                style={{
                                    color: '#8A9A5B',
                                    fontSize: '28px',
                                    letterSpacing: '0.22em',
                                    textTransform: 'uppercase'
                                }}
                            >
                                180 | Absolute Cinema
                            </span>
                            {slot ? (
                                <span
                                    style={{
                                        border: '1px solid rgba(138,154,91,0.48)',
                                        color: '#8A9A5B',
                                        borderRadius: '999px',
                                        padding: '8px 16px',
                                        fontSize: '18px',
                                        letterSpacing: '0.12em',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    {slot}
                                </span>
                            ) : null}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '72px', lineHeight: 1, fontWeight: 700, maxWidth: '1020px' }}>{title}</div>
                            <div style={{ fontSize: '30px', color: 'rgba(229,228,226,0.76)', letterSpacing: '0.08em' }}>{subtitle}</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {quote ? (
                                <div
                                    style={{
                                        fontSize: '34px',
                                        lineHeight: 1.25,
                                        color: '#F0EEE9',
                                        maxWidth: '1020px'
                                    }}
                                >
                                    "{quote}"
                                </div>
                            ) : null}
                            <div style={{ fontSize: '26px', color: '#8A9A5B' }}>@{author}</div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
                headers: {
                    'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
                }
            }
        );
    } catch {
        return new Response('Failed to generate film OG image', { status: 500 });
    }
}
