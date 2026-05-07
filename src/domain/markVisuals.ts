import type { MarkMotion } from './marksCatalog';

export type MarkIconKey =
  | 'atom'
  | 'circle'
  | 'cross'
  | 'diamond'
  | 'eye'
  | 'grid'
  | 'hexagon'
  | 'infinity'
  | 'monument'
  | 'nested_square'
  | 'orbit'
  | 'pentagon'
  | 'shield'
  | 'signal'
  | 'spark'
  | 'sun'
  | 'triangle';

export const MARK_ICON_KEY_BY_ID: Record<string, MarkIconKey> = {
  first_mark: 'circle',
  daybreaker: 'sun',
  '180_exact': 'hexagon',
  precision_loop: 'hexagon',
  minimalist: 'cross',
  deep_diver: 'grid',
  no_rush: 'pentagon',
  daily_regular: 'infinity',
  seven_quiet_days: 'infinity',
  ritual_marathon: 'pentagon',
  wide_lens: 'triangle',
  hidden_gem: 'orbit',
  genre_discovery: 'triangle',
  one_genre_devotion: 'signal',
  classic_soul: 'cross',
  genre_nomad: 'orbit',
  watched_on_time: 'sun',
  held_for_five: 'shield',
  mystery_solver: 'nested_square',
  midnight_ritual: 'spark',
  first_echo: 'diamond',
  echo_receiver: 'diamond',
  echo_initiate: 'atom',
  influencer: 'signal',
  resonator: 'shield',
  quiet_following: 'eye',
  echo_chamber: 'atom',
  eternal_mark: 'monument',
  legacy: 'monument',
  archive_keeper: 'monument',

  // Knowledge marks
  first_answer: 'spark',
  quiz_curious: 'eye',
  quiz_scholar: 'grid',
  quiz_master: 'shield',
  perfect_film: 'hexagon',
  perfect_streak: 'diamond',
  rush_survivor: 'pentagon',
  rush_ace: 'atom',
  rush_legend: 'signal',
  rush_endless_10: 'infinity',
  swipe_explorer: 'orbit',
  genre_brain: 'triangle',

  // League milestone marks
  league_silver: 'circle',
  league_gold: 'sun',
  league_platinum: 'diamond',
  league_emerald: 'orbit',
  league_sapphire: 'nested_square',
  league_ruby: 'spark',
  league_diamond: 'hexagon',
  league_master: 'shield',
  league_grandmaster: 'triangle',
  league_absolute: 'infinity',

  // Extended streak marks
  streak_fourteen: 'signal',
  streak_thirty: 'monument',

  // Film page marks
  page_ritualist: 'nested_square',
  screen_traveler: 'orbit',
  film_examiner: 'eye',
};

export const MARK_MOTION_DURATION_MS: Record<MarkMotion, number> = {
  spin: 7200,
  pulse: 2800,
  float: 3200,
  signal: 2200,
  spark: 1900,
};

export const resolveMarkIconKey = (markId: string): MarkIconKey =>
  MARK_ICON_KEY_BY_ID[String(markId || '').trim()] || 'circle';
