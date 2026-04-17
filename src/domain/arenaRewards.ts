// Weekly arena season rewards.
//
// At the end of each ISO week, users within each cohort (league) are ranked
// by their weekly arena score. The top performers receive bonus XP, tickets,
// and optionally a commemorative mark.
//
// Approved tiers (2026-04-17):
//   1st place  → 150 XP + 20 tickets + arena_gold mark
//   2nd place  → 100 XP + 12 tickets + arena_silver mark
//   3rd place  →  75 XP +  8 tickets + arena_bronze mark
//   4th–10th   →  50 XP +  5 tickets
//   11th–25th  →  25 XP +  3 tickets
//   26th+      →  no reward (but participation still recorded)
//
// A minimum activity threshold gates rewards: users must have at least
// MIN_ARENA_ACTIVITY_FOR_REWARD activity points in the week to qualify,
// otherwise they are skipped in ranking (prevents 1-point "squatters").

import type { ProgressionRewardGrant } from './progressionRewards.js';

export const MIN_ARENA_ACTIVITY_FOR_REWARD = 3;

export type ArenaSeasonReward = {
  rank: number;
  xp: number;
  tickets: number;
  mark: string | null;
};

const ARENA_SEASON_TIERS: readonly ArenaSeasonReward[] = [
  { rank: 1,  xp: 150, tickets: 20, mark: 'arena_gold' },
  { rank: 2,  xp: 100, tickets: 12, mark: 'arena_silver' },
  { rank: 3,  xp: 75,  tickets: 8,  mark: 'arena_bronze' },
] as const;

export const getArenaSeasonReward = (rank: number): ArenaSeasonReward => {
  const safeRank = Math.max(1, Math.floor(Number(rank) || 1));
  const exact = ARENA_SEASON_TIERS.find((tier) => tier.rank === safeRank);
  if (exact) return exact;
  if (safeRank >= 4 && safeRank <= 10) {
    return { rank: safeRank, xp: 50, tickets: 5, mark: null };
  }
  if (safeRank >= 11 && safeRank <= 25) {
    return { rank: safeRank, xp: 25, tickets: 3, mark: null };
  }
  return { rank: safeRank, xp: 0, tickets: 0, mark: null };
};

export const toProgressionReward = (reward: ArenaSeasonReward): ProgressionRewardGrant => ({
  xp: reward.xp,
  tickets: reward.tickets,
  arenaScore: 0,
  arenaActivity: 0,
});

export const ARENA_SEASON_MARK_IDS = [
  'arena_gold',
  'arena_silver',
  'arena_bronze',
] as const;

export type ArenaSeasonMarkId = (typeof ARENA_SEASON_MARK_IDS)[number];
