export type MarkCategory =
  | 'Presence'
  | 'Writing'
  | 'Rhythm'
  | 'Discovery'
  | 'Ritual'
  | 'Social'
  | 'Legacy';

export type MarkMotion = 'pulse' | 'spin' | 'float' | 'signal' | 'spark';

export type MarkCatalogEntry = {
  id: string;
  title: string;
  description: string;
  category: MarkCategory;
  whisper: string;
  motion: MarkMotion;
};

export const MARK_CATALOG: MarkCatalogEntry[] = [
  { id: 'first_mark', title: 'First Mark', description: 'Complete your first ritual.', category: 'Presence', whisper: 'It begins.', motion: 'pulse' },
  { id: 'daybreaker', title: 'Daybreaker', description: 'Be present for 14 active days.', category: 'Presence', whisper: 'You kept showing up.', motion: 'spin' },

  { id: '180_exact', title: 'The Architect', description: 'Write exactly 180 characters.', category: 'Writing', whisper: 'Perfectly framed.', motion: 'spin' },
  { id: 'precision_loop', title: 'Precision Loop', description: 'Write exactly 180 characters 3 times.', category: 'Writing', whisper: 'Precision repeated.', motion: 'spin' },
  { id: 'minimalist', title: 'Minimalist', description: 'Write a ritual with < 40 characters.', category: 'Writing', whisper: 'Less said.', motion: 'spin' },
  { id: 'deep_diver', title: 'Deep Diver', description: 'Submit a long-form ritual (160+ chars).', category: 'Writing', whisper: 'The depths explored.', motion: 'pulse' },

  { id: 'no_rush', title: 'No Rush', description: 'Complete 10 rituals, none consecutive.', category: 'Rhythm', whisper: 'Your pace is yours.', motion: 'pulse' },
  { id: 'daily_regular', title: 'Regular', description: 'Maintain a 3-day streak.', category: 'Rhythm', whisper: 'A steady pulse.', motion: 'pulse' },
  { id: 'seven_quiet_days', title: 'Silence Keeper', description: 'Maintain a 7-day streak.', category: 'Rhythm', whisper: 'Seven days of silence.', motion: 'pulse' },
  { id: 'ritual_marathon', title: 'Marathon', description: 'Submit 20 rituals.', category: 'Rhythm', whisper: 'Momentum held.', motion: 'pulse' },

  { id: 'wide_lens', title: 'Wide Lens', description: 'Review 10 unique genres.', category: 'Discovery', whisper: 'A wider lens.', motion: 'pulse' },
  { id: 'hidden_gem', title: 'Hidden Gem', description: 'Review a lower-rated title (<= 7.9).', category: 'Discovery', whisper: 'A private orbit.', motion: 'spin' },
  { id: 'genre_discovery', title: 'Spectrum', description: 'Review 3 unique genres.', category: 'Discovery', whisper: 'A spectrum revealed.', motion: 'pulse' },
  { id: 'one_genre_devotion', title: 'Devotee', description: '20 rituals in one genre.', category: 'Discovery', whisper: 'A singular focus.', motion: 'signal' },
  { id: 'classic_soul', title: 'Classic Soul', description: 'Watch a movie from before 1990.', category: 'Discovery', whisper: 'An echo from the past.', motion: 'spin' },
  { id: 'genre_nomad', title: 'Genre Nomad', description: 'Write 5 rituals in 5 different genres in a row.', category: 'Discovery', whisper: 'No fixed orbit.', motion: 'spin' },

  { id: 'watched_on_time', title: 'Dawn Watcher', description: 'Submit a ritual between 05:00 and 07:00.', category: 'Ritual', whisper: 'Right on time.', motion: 'spin' },
  { id: 'held_for_five', title: 'The Keeper', description: '5-day active streak.', category: 'Ritual', whisper: 'You held it.', motion: 'pulse' },
  { id: 'mystery_solver', title: 'Mystery Solver', description: 'Unlock the Mystery Slot.', category: 'Ritual', whisper: 'The unknown revealed.', motion: 'spin' },
  { id: 'midnight_ritual', title: 'Midnight', description: 'Ritual between 00:00-01:00.', category: 'Ritual', whisper: 'The witching hour.', motion: 'spark' },

  { id: 'first_echo', title: 'First Echo', description: 'Receive your first Echo.', category: 'Social', whisper: 'Someone heard you.', motion: 'pulse' },
  { id: 'echo_receiver', title: 'Echo Receiver', description: 'Receive your first Echo.', category: 'Social', whisper: 'You are heard.', motion: 'pulse' },
  { id: 'echo_initiate', title: 'Echo Initiate', description: 'Give 1 Echo.', category: 'Social', whisper: 'A small signal.', motion: 'spin' },
  { id: 'influencer', title: 'Influencer', description: 'Receive 5 Echoes.', category: 'Social', whisper: 'A wider frequency.', motion: 'signal' },
  { id: 'resonator', title: 'Resonator', description: 'Receive 5 Echoes.', category: 'Social', whisper: 'Resonance established.', motion: 'pulse' },
  { id: 'quiet_following', title: 'Quiet Following', description: 'Follow 5 users.', category: 'Social', whisper: 'A small orbit.', motion: 'pulse' },
  { id: 'echo_chamber', title: 'Echo Chamber', description: 'Give 10 Echoes.', category: 'Social', whisper: 'Signal sustained.', motion: 'spin' },

  { id: 'eternal_mark', title: 'Eternal', description: 'Reach the Eternal League.', category: 'Legacy', whisper: 'Still here.', motion: 'float' },
  { id: 'legacy', title: 'The Pillar', description: 'Active for 30+ days.', category: 'Legacy', whisper: 'A pillar in time.', motion: 'float' },
  { id: 'archive_keeper', title: 'Archive Keeper', description: 'Submit 50 rituals.', category: 'Legacy', whisper: 'The archive remembers.', motion: 'float' },
];

