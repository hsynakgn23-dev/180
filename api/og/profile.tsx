import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge'
};

const safeText = (value: string | null, max = 40): string => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const safeInt = (value: string | null, fallback = 0): number => {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
};

export default function handler(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const handle = safeText(searchParams.get('handle'), 24) || 'observer';
        const name = safeText(searchParams.get('name'), 34) || '@observer';
        const league = safeText(searchParams.get('league'), 24) || 'Curator';
        const xp = safeInt(searchParams.get('xp'));
        const streak = safeInt(searchParams.get('streak'));

        return new ImageResponse(
            (
                <div
                    style={{
                        width: '1200px',
                        height: '630px',
                        display: 'flex',
                        background: 'linear-gradient(145deg, #121212 0%, #1a1d14 52%, #2a2116 100%)',
                        color: '#E5E4E2',
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                        padding: '56px 64px',
                        position: 'relative'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '34px',
                            right: '38px',
                            border: '1px solid rgba(138,154,91,0.38)',
                            color: '#8A9A5B',
                            borderRadius: '999px',
                            padding: '8px 18px',
                            fontSize: '20px',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase'
                        }}
                    >
                        Profile Card
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            width: '100%'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div
                                style={{
                                    color: '#8A9A5B',
                                    fontSize: '32px',
                                    letterSpacing: '0.28em',
                                    textTransform: 'uppercase'
                                }}
                            >
                                180 | Absolute Cinema
                            </div>
                            <div style={{ fontSize: '74px', fontWeight: 700, lineHeight: 1 }}>{name}</div>
                            <div style={{ fontSize: '34px', color: 'rgba(229,228,226,0.84)' }}>@{handle}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: 'rgba(18,18,18,0.64)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    minWidth: '220px'
                                }}
                            >
                                <span style={{ fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(229,228,226,0.68)' }}>
                                    League
                                </span>
                                <span style={{ marginTop: '10px', fontSize: '38px', color: '#8A9A5B', fontWeight: 700 }}>{league}</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: 'rgba(18,18,18,0.64)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    minWidth: '180px'
                                }}
                            >
                                <span style={{ fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(229,228,226,0.68)' }}>
                                    XP
                                </span>
                                <span style={{ marginTop: '10px', fontSize: '38px', fontWeight: 700 }}>{xp}</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: 'rgba(18,18,18,0.64)',
                                    border: '1px solid rgba(255,255,255,0.16)',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    minWidth: '220px'
                                }}
                            >
                                <span style={{ fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(229,228,226,0.68)' }}>
                                    Streak
                                </span>
                                <span style={{ marginTop: '10px', fontSize: '38px', fontWeight: 700 }}>{streak} days</span>
                            </div>
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
        return new Response('Failed to generate profile OG image', { status: 500 });
    }
}
