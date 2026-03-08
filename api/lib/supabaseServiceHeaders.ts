const isSupabaseSecretApiKey = (value: string): boolean => {
    const normalized = String(value || '').trim();
    return normalized.startsWith('sb_secret_');
};

export const createSupabaseServiceHeaders = (
    serviceRoleKey: string,
    extra: Record<string, string> = {}
): Record<string, string> => {
    const normalizedKey = String(serviceRoleKey || '').trim();
    const headers: Record<string, string> = {
        apikey: normalizedKey,
        ...extra
    };

    if (normalizedKey && !isSupabaseSecretApiKey(normalizedKey)) {
        headers.Authorization = `Bearer ${normalizedKey}`;
    }

    return headers;
};
