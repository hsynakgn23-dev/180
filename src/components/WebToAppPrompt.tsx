import { useEffect, useMemo, useState } from 'react';
import { buildMobileDeepLinkFromRouteIntent } from '../domain/deepLinks';
import { resolveMobileWebPromptDecision } from '../domain/mobileWebPromptContract';
import { trackEvent } from '../lib/analytics';

type WebToAppPromptProps = {
    streak: number;
    dailyRitualsCount: number;
    inviteCode?: string | null;
};

const DISMISS_STORAGE_KEY = '180_web_to_app_prompt_dismiss_until_v1';
const DISMISS_WINDOW_HOURS = 48;

const readDismissUntil = (): string | null => {
    try {
        const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
        const normalized = String(raw || '').trim();
        return normalized || null;
    } catch {
        return null;
    }
};

const writeDismissUntil = (value: string) => {
    try {
        localStorage.setItem(DISMISS_STORAGE_KEY, value);
    } catch {
        // no-op
    }
};

const getWaitlistUrl = (): string => {
    return String(import.meta.env.VITE_MOBILE_WAITLIST_URL || '').trim();
};

export const WebToAppPrompt = ({ streak, dailyRitualsCount, inviteCode }: WebToAppPromptProps) => {
    const [dismissUntil, setDismissUntil] = useState<string | null>(() => readDismissUntil());
    const [nowMs, setNowMs] = useState(0);
    const [viewTrackedKey, setViewTrackedKey] = useState('');
    const decision = useMemo(
        () => resolveMobileWebPromptDecision({ streak, dailyRitualsCount, inviteCode }),
        [streak, dailyRitualsCount, inviteCode]
    );
    const waitlistUrl = useMemo(() => getWaitlistUrl(), []);

    useEffect(() => {
        setNowMs(Date.now());
    }, []);

    const dismissUntilTime = dismissUntil ? new Date(dismissUntil).getTime() : 0;
    const isDismissed = Number.isFinite(dismissUntilTime) && dismissUntilTime > nowMs;

    const deepLink = useMemo(
        () => buildMobileDeepLinkFromRouteIntent(decision.routeIntent),
        [decision.routeIntent]
    );

    useEffect(() => {
        if (!decision.shouldShow || isDismissed) return;
        const routeIntent = decision.routeIntent;
        const nextKey = [
            decision.reason,
            routeIntent.target,
            routeIntent.target === 'share' ? routeIntent.goal || 'none' : 'none'
        ].join(':');
        if (viewTrackedKey === nextKey) return;

        trackEvent('web_to_app_prompt_viewed', {
            reason: decision.reason,
            routeTarget: routeIntent.target,
            shareGoal: routeIntent.target === 'share' ? routeIntent.goal || null : null,
            hasInvite: routeIntent.target === 'share' ? Boolean(routeIntent.invite) : false
        });
        setViewTrackedKey(nextKey);
    }, [decision, isDismissed, viewTrackedKey]);

    if (!decision.shouldShow || isDismissed) return null;

    const handleOpenApp = () => {
        trackEvent('web_to_app_prompt_clicked', {
            action: 'open_app',
            reason: decision.reason,
            routeTarget: decision.routeIntent.target,
            shareGoal: decision.routeIntent.target === 'share' ? decision.routeIntent.goal || null : null,
            hasInvite: decision.routeIntent.target === 'share' ? Boolean(decision.routeIntent.invite) : false
        });
        window.location.assign(deepLink);
    };

    const handleDismiss = () => {
        const nextDismissIso = new Date(Date.now() + DISMISS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
        writeDismissUntil(nextDismissIso);
        setDismissUntil(nextDismissIso);
        trackEvent('web_to_app_prompt_dismissed', {
            reason: decision.reason,
            dismissHours: DISMISS_WINDOW_HOURS
        });
    };

    const handleWaitlistClick = () => {
        trackEvent('web_to_app_prompt_clicked', {
            action: 'join_waitlist',
            reason: decision.reason,
            routeTarget: decision.routeIntent.target
        });
    };

    return (
        <section className="mb-6 sm:mb-8 rounded-xl border border-sage/30 bg-gradient-to-r from-sage/20 via-sage/10 to-transparent px-4 sm:px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-sage/90">Mobile Prompt</p>
                    <h2 className="mt-1 text-base sm:text-lg font-semibold text-white">Continue in the app</h2>
                    <p className="mt-1 text-xs sm:text-sm text-white/70">
                        Open your next ritual flow on mobile and keep your momentum synced.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <button
                        type="button"
                        onClick={handleOpenApp}
                        className="inline-flex items-center rounded-md border border-sage/50 bg-sage/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-sage hover:bg-sage/30 transition-colors"
                    >
                        Open In App
                    </button>
                    {waitlistUrl ? (
                        <a
                            href={waitlistUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={handleWaitlistClick}
                            className="inline-flex items-center rounded-md border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/80 hover:text-sage hover:border-sage/50 transition-colors"
                        >
                            Join Mobile Beta
                        </a>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="inline-flex items-center rounded-md border border-white/20 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/70 hover:text-white transition-colors"
                    >
                        Later
                    </button>
                </div>
            </div>
        </section>
    );
};
