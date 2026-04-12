type FetchWithTimeoutParams = {
    url: string;
    init?: RequestInit;
    timeoutMs?: number;
    timeoutMessage?: string;
};

type RunWithAbortTimeoutParams<T> = {
    task: (signal: AbortSignal) => Promise<T>;
    timeoutMs?: number;
    timeoutMessage?: string;
};

const isAbortError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const name = String((error as { name?: unknown }).name || '').toLowerCase();
    const message = String((error as { message?: unknown }).message || '').toLowerCase();
    return name === 'aborterror' || message.includes('abort');
};

export const runWithAbortTimeout = async <T>({
    task,
    timeoutMs = 10000,
    timeoutMessage = 'Request timeout',
}: RunWithAbortTimeoutParams<T>): Promise<T> => {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let didTimeout = false;

    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, timeoutMs);
    }

    try {
        return await task(controller.signal);
    } catch (error) {
        if (didTimeout || controller.signal.aborted || isAbortError(error)) {
            throw new Error(timeoutMessage);
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

export const fetchWithTimeout = async ({
    url,
    init,
    timeoutMs = 10000,
    timeoutMessage = 'Request timeout',
}: FetchWithTimeoutParams): Promise<Response> =>
    runWithAbortTimeout({
        timeoutMs,
        timeoutMessage,
        task: async (signal) => {
            const controller = new AbortController();
            const sourceSignal = init?.signal;
            let removeAbortForwarder: (() => void) | null = null;

            if (sourceSignal) {
                if (sourceSignal.aborted) {
                    controller.abort();
                } else {
                    const forwardAbort = () => controller.abort();
                    sourceSignal.addEventListener('abort', forwardAbort, { once: true });
                    removeAbortForwarder = () => sourceSignal.removeEventListener('abort', forwardAbort);
                }
            }

            if (signal.aborted) {
                controller.abort();
            } else {
                const forwardTimeoutAbort = () => controller.abort();
                signal.addEventListener('abort', forwardTimeoutAbort, { once: true });
                const previousCleanup = removeAbortForwarder;
                removeAbortForwarder = () => {
                    signal.removeEventListener('abort', forwardTimeoutAbort);
                    previousCleanup?.();
                };
            }

            try {
                return await fetch(url, {
                    ...(init || {}),
                    signal: controller.signal,
                });
            } finally {
                removeAbortForwarder?.();
            }
        },
    });
