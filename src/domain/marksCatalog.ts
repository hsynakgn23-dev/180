export type MarkCategory =
  | 'Presence'
  | 'Writing'
  | 'Rhythm'
  | 'Discovery'
  | 'Ritual'
  | 'Social'
  | 'Legacy'
  | 'Knowledge';

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
  { id: 'first_mark', title: 'First Mark', description: 'Complete your first comment.', category: 'Presence', whisper: 'It begins.', motion: 'pulse' },
  { id: 'daybreaker', title: 'Daybreaker', description: 'Be present for 14 active days.', category: 'Presence', whisper: 'You kept showing up.', motion: 'spin' },

  { id: '180_exact', title: 'The Architect', description: 'Write exactly 180 characters.', category: 'Writing', whisper: 'Perfectly framed.', motion: 'spin' },
  { id: 'precision_loop', title: 'Precision Loop', description: 'Write exactly 180 characters 3 times.', category: 'Writing', whisper: 'Precision repeated.', motion: 'spin' },
  { id: 'minimalist', title: 'Minimalist', description: 'Write a comment with < 40 characters.', category: 'Writing', whisper: 'Less said.', motion: 'spin' },
  { id: 'deep_diver', title: 'Deep Diver', description: 'Submit a long-form comment (160+ chars).', category: 'Writing', whisper: 'The depths explored.', motion: 'pulse' },

  { id: 'no_rush', title: 'No Rush', description: 'Complete 10 comments, none consecutive.', category: 'Rhythm', whisper: 'Your pace is yours.', motion: 'pulse' },
  { id: 'daily_regular', title: 'Regular', description: 'Maintain a 3-day streak.', category: 'Rhythm', whisper: 'A steady pulse.', motion: 'pulse' },
  { id: 'seven_quiet_days', title: 'Silence Keeper', description: 'Maintain a 7-day streak.', category: 'Rhythm', whisper: 'Seven days of silence.', motion: 'pulse' },
  { id: 'ritual_marathon', title: 'Marathon', description: 'Submit 20 comments.', category: 'Rhythm', whisper: 'Momentum held.', motion: 'pulse' },

  { id: 'wide_lens', title: 'Wide Lens', description: 'Review 10 unique genres.', category: 'Discovery', whisper: 'A wider lens.', motion: 'pulse' },
  { id: 'hidden_gem', title: 'Hidden Gem', description: 'Review a lower-rated title (<= 7.9).', category: 'Discovery', whisper: 'A private orbit.', motion: 'spin' },
  { id: 'genre_discovery', title: 'Spectrum', description: 'Review 3 unique genres.', category: 'Discovery', whisper: 'A spectrum revealed.', motion: 'pulse' },
  { id: 'one_genre_devotion', title: 'Devotee', description: '20 comments in one genre.', category: 'Discovery', whisper: 'A singular focus.', motion: 'signal' },
  { id: 'classic_soul', title: 'Classic Soul', description: 'Watch a movie from before 1990.', category: 'Discovery', whisper: 'An echo from the past.', motion: 'spin' },
  { id: 'genre_nomad', title: 'Genre Nomad', description: 'Write 5 comments in 5 different genres in a row.', category: 'Discovery', whisper: 'No fixed orbit.', motion: 'spin' },

  { id: 'watched_on_time', title: 'Dawn Watcher', description: 'Submit a comment between 05:00 and 07:00.', category: 'Ritual', whisper: 'Right on time.', motion: 'spin' },
  { id: 'held_for_five', title: 'The Keeper', description: '5-day active streak.', category: 'Ritual', whisper: 'You held it.', motion: 'pulse' },
  { id: 'mystery_solver', title: 'Mystery Solver', description: 'Unlock the Mystery Slot.', category: 'Ritual', whisper: 'The unknown revealed.', motion: 'spin' },
  { id: 'midnight_ritual', title: 'Midnight', description: 'Comment between 00:00-01:00.', category: 'Ritual', whisper: 'The witching hour.', motion: 'spark' },

  { id: 'first_echo', title: 'First Echo', description: 'Receive your first Echo.', category: 'Social', whisper: 'Someone heard you.', motion: 'pulse' },
  { id: 'echo_receiver', title: 'Echo Receiver', description: 'Receive your first Echo.', category: 'Social', whisper: 'You are heard.', motion: 'pulse' },
  { id: 'echo_initiate', title: 'Echo Initiate', description: 'Give 1 Echo.', category: 'Social', whisper: 'A small signal.', motion: 'spin' },
  { id: 'influencer', title: 'Influencer', description: 'Receive 5 Echoes.', category: 'Social', whisper: 'A wider frequency.', motion: 'signal' },
  { id: 'resonator', title: 'Resonator', description: 'Receive 5 Echoes.', category: 'Social', whisper: 'Resonance established.', motion: 'pulse' },
  { id: 'quiet_following', title: 'Quiet Following', description: 'Follow 5 users.', category: 'Social', whisper: 'A small orbit.', motion: 'pulse' },
  { id: 'echo_chamber', title: 'Echo Chamber', description: 'Give 10 Echoes.', category: 'Social', whisper: 'Signal sustained.', motion: 'spin' },

  // Arena season marks — top 3 per cohort per week
  { id: 'arena_gold', title: 'Arena Gold', description: 'Finish 1st in your weekly arena cohort.', category: 'Legacy', whisper: 'The week was yours.', motion: 'signal' },
  { id: 'arena_silver', title: 'Arena Silver', description: 'Finish 2nd in your weekly arena cohort.', category: 'Legacy', whisper: 'Within arm\u2019s reach.', motion: 'spark' },
  { id: 'arena_bronze', title: 'Arena Bronze', description: 'Finish 3rd in your weekly arena cohort.', category: 'Legacy', whisper: 'A podium earned.', motion: 'spark' },

  { id: 'eternal_mark', title: 'Eternal', description: 'Reach the Eternal League.', category: 'Legacy', whisper: 'Still here.', motion: 'float' },
  { id: 'legacy', title: 'The Pillar', description: 'Active for 30+ days.', category: 'Legacy', whisper: 'A pillar in time.', motion: 'float' },
  { id: 'archive_keeper', title: 'Archive Keeper', description: 'Submit 50 comments.', category: 'Legacy', whisper: 'The archive remembers.', motion: 'float' },

  // Knowledge — Quiz & Rush marks
  { id: 'first_answer', title: 'First Answer', description: 'Answer your first pool question.', category: 'Knowledge', whisper: 'A spark of knowing.', motion: 'pulse' },
  { id: 'quiz_curious', title: 'Curious Mind', description: 'Answer 25 pool questions.', category: 'Knowledge', whisper: 'Questions breed wisdom.', motion: 'pulse' },
  { id: 'quiz_scholar', title: 'Scholar', description: 'Answer 100 pool questions.', category: 'Knowledge', whisper: 'The archive deepens.', motion: 'spin' },
  { id: 'quiz_master', title: 'Quiz Master', description: 'Answer 500 pool questions correctly.', category: 'Knowledge', whisper: 'Mastery earned.', motion: 'signal' },
  { id: 'perfect_film', title: 'Perfect Recall', description: 'Get all 5 questions right on a single film.', category: 'Knowledge', whisper: 'Total recall.', motion: 'spin' },
  { id: 'perfect_streak', title: 'Flawless Run', description: 'Get all 5 right on 3 films in a row.', category: 'Knowledge', whisper: 'Precision sustained.', motion: 'spark' },
  { id: 'rush_survivor', title: 'Rush Survivor', description: 'Complete a Rush 10 session.', category: 'Knowledge', whisper: 'You survived the rush.', motion: 'pulse' },
  { id: 'rush_ace', title: 'Rush Ace', description: 'Score 7+ correct in Rush 10.', category: 'Knowledge', whisper: 'Under pressure, clarity.', motion: 'spin' },
  { id: 'rush_legend', title: 'Rush Legend', description: 'Score 14+ correct in Rush 20.', category: 'Knowledge', whisper: 'Legend forged in fire.', motion: 'signal' },
  { id: 'rush_endless_10', title: 'Unstoppable', description: 'Reach 10 correct in Endless mode.', category: 'Knowledge', whisper: 'No end in sight.', motion: 'float' },
  { id: 'swipe_explorer', title: 'Film Explorer', description: 'Swipe right on 20 films.', category: 'Knowledge', whisper: 'Always seeking.', motion: 'pulse' },
  { id: 'genre_brain', title: 'Genre Brain', description: 'Answer correctly across 5 different genres.', category: 'Knowledge', whisper: 'A mind without borders.', motion: 'spin' },

  // League milestone marks — one per league reached
  { id: 'league_silver', title: 'Silver Ascent', description: 'Reach Silver league.', category: 'Legacy', whisper: 'The climb begins.', motion: 'pulse' },
  { id: 'league_gold', title: 'Golden Standard', description: 'Reach Gold league.', category: 'Legacy', whisper: 'Worth its weight.', motion: 'pulse' },
  { id: 'league_platinum', title: 'Platinum Mind', description: 'Reach Platinum league.', category: 'Legacy', whisper: 'Refined under pressure.', motion: 'spin' },
  { id: 'league_emerald', title: 'Emerald Eye', description: 'Reach Emerald league.', category: 'Legacy', whisper: 'A rarer lens.', motion: 'float' },
  { id: 'league_sapphire', title: 'Sapphire Depth', description: 'Reach Sapphire league.', category: 'Legacy', whisper: 'Deep waters.', motion: 'float' },
  { id: 'league_ruby', title: 'Ruby Vision', description: 'Reach Ruby league.', category: 'Legacy', whisper: 'Burning bright.', motion: 'signal' },
  { id: 'league_diamond', title: 'Diamond Cut', description: 'Reach Diamond league.', category: 'Legacy', whisper: 'Unbreakable clarity.', motion: 'spin' },
  { id: 'league_master', title: 'Master Frame', description: 'Reach Master league.', category: 'Legacy', whisper: 'The craft is yours.', motion: 'signal' },
  { id: 'league_grandmaster', title: 'Grandmaster', description: 'Reach Grandmaster league.', category: 'Legacy', whisper: 'Few have walked here.', motion: 'float' },
  { id: 'league_absolute', title: 'The Absolute', description: 'Reach Absolute league.', category: 'Legacy', whisper: 'Into the void.', motion: 'spark' },

  // Extended streak marks
  { id: 'streak_fourteen', title: 'Fortnight', description: 'Maintain a 14-day streak.', category: 'Rhythm', whisper: 'Two weeks without missing a beat.', motion: 'pulse' },
  { id: 'streak_thirty', title: 'The Constant', description: 'Maintain a 30-day streak.', category: 'Rhythm', whisper: 'A month. Unbroken.', motion: 'float' },
];
