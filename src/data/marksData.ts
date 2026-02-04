import React from 'react';
import { HexagonMark } from '../components/icons/HexagonMark';
import { PentagonMark } from '../components/icons/PentagonMark';
import { NestedSquareMark } from '../components/icons/NestedSquareMark';
import { CircleMark } from '../components/icons/CircleMark';
import { DiamondMark } from '../components/icons/DiamondMark';
import { InfinityMark } from '../components/icons/InfinityMark';
import { GridMark } from '../components/icons/GridMark';
import { SparkMark } from '../components/icons/SparkMark';
import { TriangleMark } from '../components/icons/TriangleMark';
import { CrossMark } from '../components/icons/CrossMark';
import { EyeMark } from '../components/icons/EyeMark';
import { OrbitMark } from '../components/icons/OrbitMark';
import { SunMark } from '../components/icons/SunMark';
import { ShieldMark } from '../components/icons/ShieldMark';
import { AtomMark } from '../components/icons/AtomMark';
import { SignalMark } from '../components/icons/SignalMark';
import { MonumentMark } from '../components/icons/MonumentMark';

export interface MarkDef {
    id: string;
    title: string;
    description: string;
    category: 'Ritual' | 'Discovery' | 'Social' | 'Presence' | 'Writing' | 'Rhythm' | 'Legacy';
    Icon: React.FC<any>;
    whisper: string;
}

export const MAJOR_MARKS: MarkDef[] = [
    // --- CATEGORY A: PRESENCE ---
    { id: 'first_mark', title: 'First Mark', description: 'Complete your first ritual.', category: 'Presence', Icon: CircleMark, whisper: 'It begins.' },

    // --- CATEGORY B: WRITING ---
    { id: '180_exact', title: 'The Architect', description: 'Write exactly 180 characters.', category: 'Writing', Icon: HexagonMark, whisper: 'Perfectly framed.' },
    { id: 'minimalist', title: 'Minimalist', description: 'Write a ritual with < 40 characters.', category: 'Writing', Icon: CrossMark, whisper: 'Less said.' },
    { id: 'deep_diver', title: 'Deep Diver', description: 'Submit a long-form ritual.', category: 'Writing', Icon: GridMark, whisper: 'The depths explored.' },

    // --- CATEGORY C: RHYTHM ---
    { id: 'no_rush', title: 'No Rush', description: 'Complete 10 rituals, none consecutive.', category: 'Rhythm', Icon: PentagonMark, whisper: 'Your pace is yours.' },
    { id: 'daily_regular', title: 'Regular', description: 'Maintain a 3-day streak.', category: 'Rhythm', Icon: InfinityMark, whisper: 'A steady pulse.' },
    { id: 'seven_quiet_days', title: 'Silence Keeper', description: 'Maintain a 7-day streak.', category: 'Rhythm', Icon: InfinityMark, whisper: 'Seven days of silence.' },

    // --- CATEGORY D: DISCOVERY ---
    { id: 'wide_lens', title: 'Wide Lens', description: 'Review 10 unique genres.', category: 'Discovery', Icon: TriangleMark, whisper: 'A wider lens.' },
    { id: 'hidden_gem', title: 'Hidden Gem', description: 'Review a low-popularity movie.', category: 'Discovery', Icon: OrbitMark, whisper: 'A private orbit.' },
    { id: 'genre_discovery', title: 'Spectrum', description: 'Review 3 unique genres.', category: 'Discovery', Icon: TriangleMark, whisper: 'A spectrum revealed.' },
    { id: 'one_genre_devotion', title: 'Devotee', description: '20 rituals in one genre.', category: 'Discovery', Icon: SignalMark, whisper: 'A singular focus.' },
    { id: 'classic_soul', title: 'Classic Soul', description: 'Watch a movie from before 1990.', category: 'Discovery', Icon: CrossMark, whisper: 'An echo from the past.' },

    // --- CATEGORY E: CINEMA RITUALS ---
    { id: 'watched_on_time', title: 'Dawn Watcher', description: 'Ritual within 24h of release.', category: 'Ritual', Icon: SunMark, whisper: 'Right on time.' },
    { id: 'held_for_five', title: 'The Keeper', description: '5-day active streak.', category: 'Ritual', Icon: ShieldMark, whisper: 'You held it.' },
    { id: 'mystery_solver', title: 'Mystery Solver', description: 'Unlock the Mystery Slot.', category: 'Ritual', Icon: NestedSquareMark, whisper: 'The unknown revealed.' },
    { id: 'midnight_ritual', title: 'Midnight', description: 'Ritual between 00:00-01:00.', category: 'Ritual', Icon: SparkMark, whisper: 'The witching hour.' },

    // --- CATEGORY F: SOCIAL ---
    { id: 'first_echo', title: 'First Echo', description: 'Receive your first Echo.', category: 'Social', Icon: DiamondMark, whisper: 'Someone heard you.' },
    { id: 'echo_receiver', title: 'Echo Receiver', description: 'Receive your first Echo.', category: 'Social', Icon: DiamondMark, whisper: 'You are heard.' },
    { id: 'echo_initiate', title: 'Echo Initiate', description: 'Give 1 Echo.', category: 'Social', Icon: AtomMark, whisper: 'A small signal.' },
    { id: 'influencer', title: 'Influencer', description: 'Receive 5 Echoes.', category: 'Social', Icon: SignalMark, whisper: 'A wider frequency.' },
    { id: 'resonator', title: 'Resonator', description: 'Receive 5 Echoes.', category: 'Social', Icon: ShieldMark, whisper: 'Resocnance established.' },
    { id: 'quiet_following', title: 'Quiet Following', description: 'Reach 10 Followers.', category: 'Social', Icon: EyeMark, whisper: 'A small orbit.' },

    // --- CATEGORY G: LEGACY / LEAGUES ---
    { id: 'eternal_mark', title: 'Eternal', description: 'Reach the Eternal League.', category: 'Legacy', Icon: MonumentMark, whisper: 'Still here.' },
    { id: 'legacy', title: 'The Pillar', description: 'Active for 30+ days.', category: 'Legacy', Icon: MonumentMark, whisper: 'A pillar in time.' }
];
