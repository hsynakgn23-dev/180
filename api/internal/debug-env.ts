export const config = { runtime: 'nodejs' };

export default function handler(req: { method?: string; headers?: Record<string, string> }, res: { status: (code: number) => { json: (data: Record<string, unknown>) => void } }) {
    const has = (k: string) => !!process.env[k];
    res.status(200).json({
        method: req.method,
        hasCronSecret: has('CRON_SECRET'),
        hasDailySource: has('DAILY_SOURCE_SECRET'),
        hasDailyImport: has('DAILY_QUIZ_IMPORT_SECRET'),
        cronSecretLen: (process.env.CRON_SECRET || '').length,
        cronSecretStart: (process.env.CRON_SECRET || '').slice(0, 5),
    });
}
