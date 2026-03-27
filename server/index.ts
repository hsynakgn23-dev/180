import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import adminDashboardHandler from '../api/admin/dashboard.js';
import adminSessionHandler from '../api/admin/session.js';
import adminModerationCommentHandler from '../api/admin/moderation/comment.js';
import adminModerationUserHandler from '../api/admin/moderation/user.js';
import analyticsHandler from '../api/analytics.js';
import cronDailyHandler from '../api/cron/daily.js';
import dailyHandler from '../api/daily.js';
import dailyBundleHandler from '../api/daily-bundle.js';
import dailyQuizAnswerHandler from '../api/daily-quiz-answer.js';
import dailyQuizImportHandler from '../api/internal/daily-quiz-import.js';
import dailySourceHandler from '../api/internal/daily-source.js';
import ogFilmHandler from '../api/og/film.js';
import ogProfileHandler from '../api/og/profile.js';
import pushEngagementHandler from '../api/push/engagement.js';
import pushTestHandler from '../api/push/test.js';
import referralHandler from '../api/referral.js';
import poolMoviesHandler from '../api/pool-movies.js';
import poolSwipeHandler from '../api/pool-swipe.js';
import poolQuizHandler from '../api/pool-quiz.js';
import poolAnswerHandler from '../api/pool-answer.js';
import rushStartHandler from '../api/rush-start.js';
import rushAnswerHandler from '../api/rush-answer.js';
import rushCompleteHandler from '../api/rush-complete.js';
import subscriptionStatusHandler from '../api/subscription-status.js';
import subscriptionVerifyHandler from '../api/subscription-verify.js';
import adImpressionHandler from '../api/ad-impression.js';
import poolBatchGenerateHandler from '../api/internal/pool-batch-generate.js';
import poolBatchStatusHandler from '../api/internal/pool-batch-status.js';

type QueryValue = string | string[] | undefined;

type ApiRequest = IncomingMessage & {
    query?: Record<string, QueryValue>;
    body?: unknown;
};

type ApiRouteHandler = (req: ApiRequest, res: ServerResponse) => unknown | Promise<unknown>;

type RouteEntry = {
    path: string;
    handler: ApiRouteHandler;
};

const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8'
};

const ROUTES: RouteEntry[] = [
    { path: '/api/admin/dashboard', handler: adminDashboardHandler as ApiRouteHandler },
    { path: '/api/admin/session', handler: adminSessionHandler as ApiRouteHandler },
    {
        path: '/api/admin/moderation/comment',
        handler: adminModerationCommentHandler as ApiRouteHandler
    },
    {
        path: '/api/admin/moderation/user',
        handler: adminModerationUserHandler as ApiRouteHandler
    },
    { path: '/api/analytics', handler: analyticsHandler as ApiRouteHandler },
    { path: '/api/cron/daily', handler: cronDailyHandler as ApiRouteHandler },
    { path: '/api/daily', handler: dailyHandler as ApiRouteHandler },
    { path: '/api/daily-bundle', handler: dailyBundleHandler as ApiRouteHandler },
    { path: '/api/daily-quiz-answer', handler: dailyQuizAnswerHandler as ApiRouteHandler },
    { path: '/api/internal/daily-quiz-import', handler: dailyQuizImportHandler as ApiRouteHandler },
    { path: '/api/internal/daily-source', handler: dailySourceHandler as ApiRouteHandler },
    { path: '/api/og/film', handler: ogFilmHandler as ApiRouteHandler },
    { path: '/api/og/profile', handler: ogProfileHandler as ApiRouteHandler },
    { path: '/api/push/engagement', handler: pushEngagementHandler as ApiRouteHandler },
    { path: '/api/push/test', handler: pushTestHandler as ApiRouteHandler },
    { path: '/api/referral', handler: referralHandler as ApiRouteHandler },
    { path: '/api/referral/create', handler: referralHandler as ApiRouteHandler },
    { path: '/api/referral/claim', handler: referralHandler as ApiRouteHandler },
    { path: '/api/pool-movies', handler: poolMoviesHandler as ApiRouteHandler },
    { path: '/api/pool-swipe', handler: poolSwipeHandler as ApiRouteHandler },
    { path: '/api/pool-quiz', handler: poolQuizHandler as ApiRouteHandler },
    { path: '/api/pool-answer', handler: poolAnswerHandler as ApiRouteHandler },
    { path: '/api/rush-start', handler: rushStartHandler as ApiRouteHandler },
    { path: '/api/rush-answer', handler: rushAnswerHandler as ApiRouteHandler },
    { path: '/api/rush-complete', handler: rushCompleteHandler as ApiRouteHandler },
    { path: '/api/subscription-status', handler: subscriptionStatusHandler as ApiRouteHandler },
    { path: '/api/subscription-verify', handler: subscriptionVerifyHandler as ApiRouteHandler },
    { path: '/api/ad-impression', handler: adImpressionHandler as ApiRouteHandler },
    { path: '/api/internal/pool-batch-generate', handler: poolBatchGenerateHandler as ApiRouteHandler },
    { path: '/api/internal/pool-batch-status', handler: poolBatchStatusHandler as ApiRouteHandler }
];

const trimTrailingSlash = (value: string): string => {
    if (value.length > 1 && value.endsWith('/')) {
        return value.replace(/\/+$/, '');
    }
    return value;
};

const normalizePathname = (value: string): string => trimTrailingSlash(value || '/');

const buildQueryRecord = (requestUrl: string): Record<string, QueryValue> => {
    const parsedUrl = new URL(requestUrl, 'http://localhost');
    const entries = new Map<string, QueryValue>();

    parsedUrl.searchParams.forEach((value, key) => {
        const current = entries.get(key);
        if (typeof current === 'undefined') {
            entries.set(key, value);
            return;
        }

        if (Array.isArray(current)) {
            current.push(value);
            entries.set(key, current);
            return;
        }

        entries.set(key, [current, value]);
    });

    return Object.fromEntries(entries);
};

const findRoute = (pathname: string): RouteEntry | null =>
    ROUTES.find((route) => route.path === pathname) || null;

const writeJson = (
    res: ServerResponse,
    statusCode: number,
    payload: Record<string, unknown>
): void => {
    if (res.writableEnded) return;
    res.statusCode = statusCode;
    for (const [key, value] of Object.entries(JSON_HEADERS)) {
        res.setHeader(key, value);
    }
    res.end(JSON.stringify(payload));
};

const createCompatResponse = (res: ServerResponse): ServerResponse => {
    const response = res as ServerResponse & {
        status?: (statusCode: number) => {
            json: (payload: unknown) => ServerResponse;
            send: (body: unknown) => ServerResponse;
            end: (body?: string) => ServerResponse;
        };
    };

    response.status = (statusCode: number) => {
        res.statusCode = statusCode;
        return {
            json: (payload: unknown) => {
                if (!res.hasHeader('content-type')) {
                    res.setHeader('content-type', 'application/json; charset=utf-8');
                }
                if (!res.writableEnded) {
                    res.end(JSON.stringify(payload));
                }
                return res;
            },
            send: (body: unknown) => {
                if (!res.hasHeader('content-type')) {
                    res.setHeader('content-type', 'text/plain; charset=utf-8');
                }
                if (!res.writableEnded) {
                    res.end(typeof body === 'string' ? body : String(body ?? ''));
                }
                return res;
            },
            end: (body?: string) => {
                if (!res.writableEnded) {
                    res.end(body);
                }
                return res;
            }
        };
    };

    return response;
};

const sendWebResponse = async (response: Response, res: ServerResponse): Promise<void> => {
    if (res.writableEnded) return;

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });

    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
};

const attachQuery = (req: IncomingMessage): ApiRequest => {
    const request = req as ApiRequest;
    request.query = buildQueryRecord(req.url || '/');
    return request;
};

const handleHealthRequest = (res: ServerResponse): void => {
    writeJson(res, 200, {
        ok: true,
        service: '180-absolute-cinema-api',
        time: new Date().toISOString()
    });
};

const server = createServer(async (req, res) => {
    const pathname = normalizePathname(new URL(req.url || '/', 'http://localhost').pathname);

    if (pathname === '/healthz') {
        handleHealthRequest(res);
        return;
    }

    if (pathname === '/' || pathname === '') {
        writeJson(res, 200, {
            ok: true,
            service: '180-absolute-cinema-api',
            routes: ROUTES.map((route) => route.path)
        });
        return;
    }

    const route = findRoute(pathname);
    if (!route) {
        writeJson(res, 404, {
            ok: false,
            error: 'Not found.'
        });
        return;
    }

    const compatReq = attachQuery(req);
    const compatRes = createCompatResponse(res);

    try {
        const result = await route.handler(compatReq, compatRes);
        if (result instanceof Response) {
            await sendWebResponse(result, res);
            return;
        }

        if (!res.writableEnded) {
            res.statusCode = res.statusCode || 204;
            res.end();
        }
    } catch (error) {
        console.error('[cloudrun-api] unhandled route error', pathname, error);
        writeJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : 'Unexpected server error.'
        });
    }
});

const port = Number.parseInt(process.env.PORT || '8080', 10) || 8080;

server.listen(port, () => {
    console.log(`[cloudrun-api] listening on :${port}`);
});
