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
import {
  resolveMarkIconKey,
  type MarkIconKey,
} from '../domain/markVisuals';

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

const ICON_BY_KEY: Record<MarkIconKey, MarkIcon> = {
  atom: AtomMark,
  circle: CircleMark,
  cross: CrossMark,
  diamond: DiamondMark,
  eye: EyeMark,
  grid: GridMark,
  hexagon: HexagonMark,
  infinity: InfinityMark,
  monument: MonumentMark,
  nested_square: NestedSquareMark,
  orbit: OrbitMark,
  pentagon: PentagonMark,
  shield: ShieldMark,
  signal: SignalMark,
  spark: SparkMark,
  sun: SunMark,
  triangle: TriangleMark,
};

export const MAJOR_MARKS: MarkDef[] = MARK_CATALOG.map((mark) => ({
  ...mark,
  Icon: ICON_BY_KEY[resolveMarkIconKey(mark.id)] || CircleMark,
}));
