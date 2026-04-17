const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toSafeInt = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};

export const hasStoredProfileXp = (xpState: unknown): boolean => {
  if (!isRecord(xpState)) return false;
  return Object.prototype.hasOwnProperty.call(xpState, 'totalXP') || Object.prototype.hasOwnProperty.call(xpState, 'xp');
};

export const readProfileTotalXp = (xpState: unknown): number => {
  if (!isRecord(xpState)) return 0;
  return Math.max(toSafeInt(xpState.totalXP), toSafeInt(xpState.xp));
};

export const hasProfileXpMirrorDrift = (xpState: unknown): boolean => {
  if (!hasStoredProfileXp(xpState)) return false;
  if (!isRecord(xpState)) return false;
  const canonicalTotalXp = readProfileTotalXp(xpState);
  return toSafeInt(xpState.totalXP) !== canonicalTotalXp || toSafeInt(xpState.xp) !== canonicalTotalXp;
};

export const withMirroredProfileXp = (
  xpState: unknown,
  totalXp?: unknown
): Record<string, unknown> => {
  const nextState = isRecord(xpState) ? { ...xpState } : {};
  const canonicalTotalXp =
    totalXp === undefined || totalXp === null
      ? readProfileTotalXp(nextState)
      : toSafeInt(totalXp);

  return {
    ...nextState,
    totalXP: canonicalTotalXp,
    xp: canonicalTotalXp,
  };
};
