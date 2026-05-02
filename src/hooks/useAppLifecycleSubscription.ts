import { useEffect, useRef } from 'react';

export type AppLifecycleStatus = 'foreground' | 'background';

export type AppLifecycleReason =
    | 'mount'
    | 'focus'
    | 'blur'
    | 'visibilitychange'
    | 'appstate'
    | 'disabled'
    | 'cleanup';

export type AppLifecycleSnapshot = {
    reason: AppLifecycleReason;
    status: AppLifecycleStatus;
    isCurrent: () => boolean;
};

type AppLifecycleCleanup = () => void;

type AppStateSubscription = {
    remove: () => void;
};

export type AppLifecycleAppStateAdapter = {
    currentState?: string | null;
    addEventListener?: (
        type: 'change',
        listener: (state: string) => void,
    ) => AppStateSubscription | AppLifecycleCleanup | void;
};

export type UseAppLifecycleSubscriptionOptions = {
    enabled?: boolean;
    appState?: AppLifecycleAppStateAdapter | null;
    onForeground?: (snapshot: AppLifecycleSnapshot) => void | Promise<void>;
    onBackground?: (snapshot: AppLifecycleSnapshot) => void | Promise<void>;
    subscribe?: (snapshot: AppLifecycleSnapshot) => AppLifecycleCleanup | void;
};

const resolveWebLifecycleStatus = (): AppLifecycleStatus => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return 'background';
    }

    if (
        typeof document !== 'undefined' &&
        typeof document.hasFocus === 'function' &&
        !document.hasFocus()
    ) {
        return 'background';
    }

    return 'foreground';
};

const resolveAppStateLifecycleStatus = (
    appState: AppLifecycleAppStateAdapter | null | undefined,
): AppLifecycleStatus => {
    if (!appState || !appState.currentState) {
        return 'foreground';
    }

    return appState.currentState === 'active' ? 'foreground' : 'background';
};

const resolveLifecycleStatus = (
    appState: AppLifecycleAppStateAdapter | null | undefined,
): AppLifecycleStatus => {
    const webStatus = resolveWebLifecycleStatus();
    const appStateStatus = resolveAppStateLifecycleStatus(appState);

    return webStatus === 'foreground' && appStateStatus === 'foreground'
        ? 'foreground'
        : 'background';
};

const removeAppStateSubscription = (
    subscription: AppStateSubscription | AppLifecycleCleanup | void,
) => {
    if (!subscription) return;

    if (typeof subscription === 'function') {
        subscription();
        return;
    }

    subscription.remove();
};

export const useAppLifecycleSubscription = ({
    enabled = true,
    appState,
    onForeground,
    onBackground,
    subscribe,
}: UseAppLifecycleSubscriptionOptions) => {
    const cleanupRef = useRef<AppLifecycleCleanup | null>(null);
    const statusRef = useRef<AppLifecycleStatus | null>(null);
    const generationRef = useRef(0);

    useEffect(() => {
        let disposed = false;

        const makeSnapshot = (
            reason: AppLifecycleReason,
            status: AppLifecycleStatus,
            generation: number,
        ): AppLifecycleSnapshot => ({
            reason,
            status,
            isCurrent: () =>
                !disposed &&
                generationRef.current === generation &&
                statusRef.current === status,
        });

        const stopSubscription = (reason: AppLifecycleReason) => {
            if (statusRef.current === 'background' && !cleanupRef.current) return;

            generationRef.current += 1;
            statusRef.current = 'background';

            const cleanup = cleanupRef.current;
            cleanupRef.current = null;
            cleanup?.();

            const snapshot = makeSnapshot(reason, 'background', generationRef.current);
            void onBackground?.(snapshot);
        };

        const startSubscription = (reason: AppLifecycleReason) => {
            if (!enabled) {
                stopSubscription('disabled');
                return;
            }

            if (statusRef.current === 'foreground' && cleanupRef.current) return;

            generationRef.current += 1;
            statusRef.current = 'foreground';

            const snapshot = makeSnapshot(reason, 'foreground', generationRef.current);
            void onForeground?.(snapshot);

            const cleanup = subscribe?.(snapshot);
            cleanupRef.current = cleanup ?? null;
        };

        const applyLifecycleStatus = (reason: AppLifecycleReason) => {
            if (disposed) return;

            const nextStatus = enabled ? resolveLifecycleStatus(appState) : 'background';

            if (nextStatus === 'foreground') {
                startSubscription(reason);
                return;
            }

            stopSubscription(reason);
        };

        applyLifecycleStatus('mount');

        const handleFocus = () => applyLifecycleStatus('focus');
        const handleBlur = () => applyLifecycleStatus('blur');
        const handleVisibilityChange = () => applyLifecycleStatus('visibilitychange');
        const handleAppStateChange = () => applyLifecycleStatus('appstate');

        if (typeof window !== 'undefined') {
            window.addEventListener('focus', handleFocus);
            window.addEventListener('blur', handleBlur);
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        const appStateSubscription = appState?.addEventListener?.('change', handleAppStateChange);

        return () => {
            disposed = true;

            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', handleFocus);
                window.removeEventListener('blur', handleBlur);
            }

            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }

            removeAppStateSubscription(appStateSubscription);
            stopSubscription('cleanup');
        };
    }, [appState, enabled, onBackground, onForeground, subscribe]);
};
