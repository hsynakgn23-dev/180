import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import {
  resolveMarkIconKey,
  type MarkIconKey,
} from '../../../../src/domain/markVisuals';

type MobileMarkIconProps = {
  markId: string;
  color?: string;
  size?: number;
  opacity?: number;
};

type MarkSvgProps = {
  color: string;
  size: number;
  opacity: number;
};

const SvgFrame = ({ size, opacity, children }: React.PropsWithChildren<{ size: number; opacity: number }>) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity={opacity}>
    {children}
  </Svg>
);

const CircleIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Circle cx="12" cy="12" r="6" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.2} fill="none" />
  </SvgFrame>
);

const SunIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Circle cx="12" cy="12" r="5" fill={color} />
    <Path d="M12 1V3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M12 21V23" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M4.22 4.22L5.64 5.64" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18.36 18.36L19.78 19.78" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M1 12H3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M21 12H23" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M4.22 19.78L5.64 18.36" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M18.36 5.64L19.78 4.22" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </SvgFrame>
);

const HexagonIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z" fill={color} />
    <Path d="M12 5L18 8.5V15.5L12 19L6 15.5V8.5L12 5Z" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.2} fill="none" />
  </SvgFrame>
);

const CrossIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M19 11H13V5H11V11H5V13H11V19H13V13H19V11Z" fill={color} />
  </SvgFrame>
);

const GridIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Rect x="3" y="3" width="8" height="8" rx="1" fill={color} />
    <Rect x="13" y="3" width="8" height="8" rx="1" fill={color} opacity={0.7} />
    <Rect x="3" y="13" width="8" height="8" rx="1" fill={color} opacity={0.7} />
    <Rect x="13" y="13" width="8" height="8" rx="1" fill={color} opacity={0.4} />
  </SvgFrame>
);

const PentagonIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 2L21.5 8.9L17.9 21H6.1L2.5 8.9L12 2Z" fill={color} />
    <Path d="M12 5.5L18 9.8L15.7 17.5H8.3L6 9.8L12 5.5Z" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.2} fill="none" />
  </SvgFrame>
);

const InfinityIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12ZM12 12C9.79086 12 8 13.7909 8 16C8 18.2091 9.79086 20 12 20C14.2091 20 16 18.2091 16 16C16 13.7909 14.2091 12 12 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
  </SvgFrame>
);

const TriangleIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 3L22 20H2L12 3Z" fill={color} />
    <Path d="M12 7L18 17H6L12 7Z" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.2} fill="none" />
  </SvgFrame>
);

const OrbitIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Circle cx="12" cy="12" r="3" fill={color} />
    <Path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
    <Path d="M19.0711 4.92893L17.6569 6.34315" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </SvgFrame>
);

const SignalIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 20C12 20 16 16 16 12C16 8 12 4 12 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M8 20C8 20 12 16 12 12C12 8 8 4 8 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M4 16C4 16 6 14 6 12C6 10 4 8 4 8" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
    <Path d="M20 16C20 16 18 14 18 12C18 10 20 8 20 8" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
  </SvgFrame>
);

const ShieldIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill={color} stroke={color} strokeWidth="1" />
    <Path d="M12 6L12 18" stroke="#ffffff" strokeWidth="2" strokeOpacity={0.2} strokeLinecap="round" />
  </SvgFrame>
);

const NestedSquareIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Rect x="2" y="2" width="20" height="20" rx="2" fill={color} />
    <Rect x="7" y="7" width="10" height="10" rx="1" stroke="#ffffff" strokeWidth="1.5" strokeOpacity={0.3} fill="none" />
    <Rect x="10.5" y="10.5" width="3" height="3" fill="#ffffff" fillOpacity={0.4} />
  </SvgFrame>
);

const SparkIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill={color} />
    <Circle cx="12" cy="12" r="2" fill="#ffffff" fillOpacity={0.3} />
  </SvgFrame>
);

const DiamondIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M12 2L22 12L12 22L2 12L12 2Z" fill={color} />
    <Path d="M12 6L18 12L12 18L6 12L12 6Z" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.2} fill="none" />
  </SvgFrame>
);

const AtomIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Ellipse cx="12" cy="12" rx="9" ry="3" stroke={color} strokeWidth="1.5" transform="rotate(45 12 12)" />
    <Ellipse cx="12" cy="12" rx="9" ry="3" stroke={color} strokeWidth="1.5" transform="rotate(-45 12 12)" />
  </SvgFrame>
);

const EyeIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx="12" cy="12" r="3" fill={color} />
  </SvgFrame>
);

const MonumentIcon = ({ color, size, opacity }: MarkSvgProps) => (
  <SvgFrame size={size} opacity={opacity}>
    <Path d="M8 22H16L14 2H10L8 22Z" fill={color} />
    <Path d="M12 2V22" stroke="#ffffff" strokeWidth="1" strokeOpacity={0.3} />
    <Rect x="6" y="21" width="12" height="2" fill={color} />
  </SvgFrame>
);

const ICONS: Record<MarkIconKey, React.FC<MarkSvgProps>> = {
  atom: AtomIcon,
  circle: CircleIcon,
  cross: CrossIcon,
  diamond: DiamondIcon,
  eye: EyeIcon,
  grid: GridIcon,
  hexagon: HexagonIcon,
  infinity: InfinityIcon,
  monument: MonumentIcon,
  nested_square: NestedSquareIcon,
  orbit: OrbitIcon,
  pentagon: PentagonIcon,
  shield: ShieldIcon,
  signal: SignalIcon,
  spark: SparkIcon,
  sun: SunIcon,
  triangle: TriangleIcon,
};

export const MobileMarkIcon: React.FC<MobileMarkIconProps> = ({
  markId,
  color = '#8A9A5B',
  size = 18,
  opacity = 1,
}) => {
  const Icon = ICONS[resolveMarkIconKey(markId)] || CircleIcon;
  return <Icon color={color} size={size} opacity={opacity} />;
};
