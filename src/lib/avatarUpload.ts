export const MAX_AVATAR_BYTES = 768 * 1024;
export const MAX_AVATAR_DATA_URL_LENGTH = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 512;

export const normalizeAvatarUrl = (value: unknown): string => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    if (normalized.length > MAX_AVATAR_DATA_URL_LENGTH) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (/^data:image\//i.test(normalized)) return normalized;
    return '';
};

export const readAvatarFileAsDataUrl = async (file: File): Promise<string> => {
    if (file.size > MAX_AVATAR_BYTES) {
        throw new Error('Avatar file must be under 768 KB.');
    }

    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Avatar file could not be read.'));
        reader.onloadend = () => {
            const result = normalizeAvatarUrl(reader.result);
            if (!result) {
                reject(new Error('Avatar file could not be processed.'));
                return;
            }
            resolve(result);
        };
        reader.readAsDataURL(file);
    });
};
