export type CommentModerationCode =
    | 'empty'
    | 'too_long'
    | 'too_many_emoji'
    | 'blocked_language';

export type CommentModerationResult = {
    ok: boolean;
    code?: CommentModerationCode;
    message?: string;
};

type CommentModerationOptions = {
    maxChars?: number;
    maxEmojiCount?: number;
    maxEmojiRatio?: number;
};

const DEFAULT_OPTIONS: Required<CommentModerationOptions> = {
    maxChars: 180,
    maxEmojiCount: 6,
    maxEmojiRatio: 0.2
};

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

const BLOCKED_TERMS = new Set([
    'amk',
    'aq',
    'mk',
    'oc',
    'orospu',
    'pic',
    'siktir',
    'sikik',
    'sikim',
    'sikerim',
    'sikeyim',
    'yarrak',
    'gavat',
    'ibne',
    'got',
    'gerizekali',
    'salak',
    'aptal',
    'mal',
    'fuck',
    'fucking',
    'shit',
    'bitch',
    'asshole',
    'motherfucker',
    'retard',
    'slut',
    'whore'
]);

const BLOCKED_PHRASES = [
    'amina koyim',
    'amina koyayim',
    'amina koydum',
    'ananisikeyim',
    'ananin ami',
    'orospu cocugu',
    'siktir git',
    'geri zekali',
    'fuck you',
    'go to hell'
];

const normalizeForModeration = (input: string): string => {
    const lowered = input
        .toLowerCase()
        .replace(/[ıİ]/g, 'i')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[şŞ]/g, 's')
        .replace(/[çÇ]/g, 'c')
        .replace(/[öÖ]/g, 'o')
        .replace(/[üÜ]/g, 'u');

    return lowered
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const hasBlockedLanguage = (input: string): boolean => {
    const normalized = normalizeForModeration(input);
    if (!normalized) return false;

    for (const phrase of BLOCKED_PHRASES) {
        if (normalized.includes(phrase)) return true;
    }

    const tokens = normalized.split(' ');
    for (const token of tokens) {
        if (BLOCKED_TERMS.has(token)) return true;
    }

    return false;
};

const countEmoji = (input: string): number => (input.match(EMOJI_REGEX) || []).length;

const countVisibleChars = (input: string): number => {
    let count = 0;
    for (const ch of input) {
        if (!/\s/u.test(ch)) count += 1;
    }
    return count;
};

export const moderateComment = (
    input: string,
    options?: CommentModerationOptions
): CommentModerationResult => {
    const merged = { ...DEFAULT_OPTIONS, ...(options || {}) };
    const text = input ?? '';
    const trimmed = text.trim();

    if (!trimmed) {
        return { ok: false, code: 'empty', message: 'Yorum bos birakilamaz.' };
    }

    if (trimmed.length > merged.maxChars) {
        return {
            ok: false,
            code: 'too_long',
            message: `Yorum en fazla ${merged.maxChars} karakter olabilir.`
        };
    }

    const emojiCount = countEmoji(trimmed);
    const visibleChars = countVisibleChars(trimmed);
    const emojiRatio = visibleChars > 0 ? emojiCount / visibleChars : 0;
    if (emojiCount > merged.maxEmojiCount || emojiRatio > merged.maxEmojiRatio) {
        return {
            ok: false,
            code: 'too_many_emoji',
            message: 'Cok fazla emoji kullandin. Lutfen daha az emoji ile yaz.'
        };
    }

    if (hasBlockedLanguage(trimmed)) {
        return {
            ok: false,
            code: 'blocked_language',
            message: 'Yorumda kufur veya hakaret tespit edildi. Lutfen duzelt.'
        };
    }

    return { ok: true };
};

