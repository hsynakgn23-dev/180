export type ProfileVisibility = {
    showStats: boolean;
    showFollowCounts: boolean;
    showMarks: boolean;
    showActivity: boolean;
};

const DEFAULT_VISIBILITY: ProfileVisibility = {
    showStats: true,
    showFollowCounts: true,
    showMarks: true,
    showActivity: true
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(text)) return true;
    if (['0', 'false', 'no', 'off'].includes(text)) return false;
    return fallback;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

export const getDefaultProfileVisibility = (): ProfileVisibility => ({
    ...DEFAULT_VISIBILITY
});

export const normalizeProfileVisibility = (
    value: Partial<Record<keyof ProfileVisibility, unknown>> | null | undefined
): ProfileVisibility => ({
    showStats: normalizeBoolean(value?.showStats, DEFAULT_VISIBILITY.showStats),
    showFollowCounts: normalizeBoolean(value?.showFollowCounts, DEFAULT_VISIBILITY.showFollowCounts),
    showMarks: normalizeBoolean(value?.showMarks, DEFAULT_VISIBILITY.showMarks),
    showActivity: normalizeBoolean(value?.showActivity, DEFAULT_VISIBILITY.showActivity)
});

export const readProfileVisibilityFromXpState = (xpState: unknown): ProfileVisibility => {
    const state = toObject(xpState);
    const privacy = toObject(state?.privacy);
    if (!privacy) return getDefaultProfileVisibility();
    return normalizeProfileVisibility({
        showStats: privacy.showStats ?? privacy.show_stats,
        showFollowCounts: privacy.showFollowCounts ?? privacy.show_follow_counts,
        showMarks: privacy.showMarks ?? privacy.show_marks,
        showActivity: privacy.showActivity ?? privacy.show_activity
    });
};

export const writeProfileVisibilityToXpState = (
    xpState: Record<string, unknown>,
    visibility: ProfileVisibility
): Record<string, unknown> => {
    const normalized = normalizeProfileVisibility(visibility);
    return {
        ...xpState,
        privacy: {
            showStats: normalized.showStats,
            show_stats: normalized.showStats,
            showFollowCounts: normalized.showFollowCounts,
            show_follow_counts: normalized.showFollowCounts,
            showMarks: normalized.showMarks,
            show_marks: normalized.showMarks,
            showActivity: normalized.showActivity,
            show_activity: normalized.showActivity
        }
    };
};
