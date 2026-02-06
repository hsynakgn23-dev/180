const CLAY = { r: 165, g: 113, b: 100 };
const SAGE = { r: 138, g: 154, b: 91 };

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const mixChannel = (from: number, to: number, t: number): number =>
    Math.round(from + (to - from) * t);

const toRgb = (r: number, g: number, b: number): string => `rgb(${r}, ${g}, ${b})`;

export const getProgressRatio = (progress: number): number => clamp(progress, 0, 100) / 100;

export const getProgressHeadColor = (progress: number): string => {
    const t = getProgressRatio(progress);
    return toRgb(
        mixChannel(CLAY.r, SAGE.r, t),
        mixChannel(CLAY.g, SAGE.g, t),
        mixChannel(CLAY.b, SAGE.b, t)
    );
};

export const getProgressTailColor = (progress: number): string => {
    const t = clamp(getProgressRatio(progress) + 0.18, 0, 1);
    return toRgb(
        mixChannel(CLAY.r, SAGE.r, t),
        mixChannel(CLAY.g, SAGE.g, t),
        mixChannel(CLAY.b, SAGE.b, t)
    );
};

export const getProgressFill = (progress: number): string =>
    `linear-gradient(90deg, ${getProgressHeadColor(progress)} 0%, ${getProgressTailColor(progress)} 100%)`;

export const getProgressTransitionMs = (progress: number): number => {
    const t = getProgressRatio(progress);
    // Make late-stage progress feel heavier/slower.
    return Math.round(420 + Math.pow(t, 2.2) * 1900);
};
