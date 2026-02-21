type FetchWithTimeoutParams = {
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  timeoutMessage?: string;
};

export const fetchWithTimeout = async ({
  url,
  init,
  timeoutMs = 10000,
  timeoutMessage = 'Request timeout',
}: FetchWithTimeoutParams): Promise<Response> => {
  const controller = new AbortController();
  const sourceSignal = init?.signal;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let removeAbortForwarder: (() => void) | null = null;
  let didTimeout = false;

  if (sourceSignal) {
    if (sourceSignal.aborted) {
      controller.abort();
    } else {
      const forwardAbort = () => controller.abort();
      sourceSignal.addEventListener('abort', forwardAbort, { once: true });
      removeAbortForwarder = () => sourceSignal.removeEventListener('abort', forwardAbort);
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    return await fetch(url, {
      ...(init || {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (removeAbortForwarder) removeAbortForwarder();
  }
};
