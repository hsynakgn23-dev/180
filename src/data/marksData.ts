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
import { MARK_CATALOG, type MarkCategory, type MarkMotion } from '../domain/marksCatalog';

type MarkIcon = React.ComponentType<{ color?: string; size?: number; className?: string; opacity?: number }>;

export interface MarkDef {
    id: string;
    title: string;
    description: string;
    category: MarkCategory;
    Icon: MarkIcon;
    whisper: string;
    motion: MarkMotion;
    badgeAsset?: string;
}

const ICON_BY_MARK_ID: Record<string, MarkIcon> = {
    first_mark: CircleMark,
    daybreaker: SunMark,
    '180_exact': HexagonMark,
    precision_loop: HexagonMark,
    minimalist: CrossMark,
    deep_diver: GridMark,
    no_rush: PentagonMark,
    daily_regular: InfinityMark,
    seven_quiet_days: InfinityMark,
    ritual_marathon: PentagonMark,
    wide_lens: TriangleMark,
    hidden_gem: OrbitMark,
    genre_discovery: TriangleMark,
    one_genre_devotion: SignalMark,
    classic_soul: CrossMark,
    genre_nomad: OrbitMark,
    watched_on_time: SunMark,
    held_for_five: ShieldMark,
    mystery_solver: NestedSquareMark,
    midnight_ritual: SparkMark,
    first_echo: DiamondMark,
    echo_receiver: DiamondMark,
    echo_initiate: AtomMark,
    influencer: SignalMark,
    resonator: ShieldMark,
    quiet_following: EyeMark,
    echo_chamber: AtomMark,
    eternal_mark: MonumentMark,
    legacy: MonumentMark,
    archive_keeper: MonumentMark,
};

export const MAJOR_MARKS: MarkDef[] = MARK_CATALOG.map((mark) => ({
    ...mark,
    Icon: ICON_BY_MARK_ID[mark.id] || CircleMark,
}));
