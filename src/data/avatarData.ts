export interface CinemaAvatar {
  id: string;
  label: string;
  bg: string;
  color: string;
  svgPaths: string;
  isFree: boolean;
}

// Film Reel
const SVG_REEL = `
<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
<circle cx="12" cy="12" r="2.5" fill="currentColor"/>
<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/>
<circle cx="17.95" cy="8.75" r="1.5" fill="currentColor"/>
<circle cx="17.95" cy="15.25" r="1.5" fill="currentColor"/>
<circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>
<circle cx="6.05" cy="15.25" r="1.5" fill="currentColor"/>
<circle cx="6.05" cy="8.75" r="1.5" fill="currentColor"/>
`;

// Clapperboard
const SVG_CLAP = `
<rect x="3" y="8" width="18" height="13" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
<rect x="3" y="4.5" width="18" height="4" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.6"/>
<line x1="8" y1="4.5" x2="6" y2="8.5" stroke="currentColor" stroke-width="1.6"/>
<line x1="13" y1="4.5" x2="11" y2="8.5" stroke="currentColor" stroke-width="1.6"/>
<line x1="18" y1="4.5" x2="16" y2="8.5" stroke="currentColor" stroke-width="1.6"/>
`;

// Movie Camera
const SVG_CAMERA = `
<rect x="2" y="7" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
<polyline points="15,9.5 22,6.5 22,17.5 15,14.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="8.5" cy="12" r="2.5" stroke="currentColor" stroke-width="1.4"/>
`;

// Film Strip
const SVG_STRIP = `
<rect x="2" y="4" width="20" height="16" rx="1" stroke="currentColor" stroke-width="1.6"/>
<rect x="4.5" y="4" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="9" y="4" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="13" y="4" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="17.5" y="4" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="4.5" y="16.5" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="9" y="16.5" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="13" y="16.5" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<rect x="17.5" y="16.5" width="2" height="3.5" fill="currentColor" rx="0.3"/>
<line x1="2" y1="9" x2="22" y2="9" stroke="currentColor" stroke-width="1"/>
<line x1="2" y1="15" x2="22" y2="15" stroke="currentColor" stroke-width="1"/>
`;

// Director's Viewfinder / Frame
const SVG_FRAME = `
<polyline points="3,8 3,3 8,3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<polyline points="16,3 21,3 21,8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<polyline points="21,16 21,21 16,21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<polyline points="8,21 3,21 3,16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<line x1="12" y1="9" x2="12" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
<line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
<circle cx="12" cy="12" r="1.5" fill="currentColor"/>
`;

// Cinema Star
const SVG_STAR = `
<polygon points="12,2.5 14.5,9.2 21.5,9.5 16.2,13.8 18.1,20.7 12,16.8 5.9,20.7 7.8,13.8 2.5,9.5 9.5,9.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" opacity="0.15"/>
<polygon points="12,2.5 14.5,9.2 21.5,9.5 16.2,13.8 18.1,20.7 12,16.8 5.9,20.7 7.8,13.8 2.5,9.5 9.5,9.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
`;

// Camera Lens / Aperture
const SVG_LENS = `
<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
<circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.4"/>
<line x1="12" y1="3" x2="12" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<line x1="12" y1="15.5" x2="12" y2="21" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<line x1="20.2" y1="7.5" x2="15.5" y2="10.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<line x1="8.5" y1="13.75" x2="3.8" y2="16.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<line x1="20.2" y1="16.5" x2="15.5" y2="13.75" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<line x1="8.5" y1="10.25" x2="3.8" y2="7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
`;

// Film Projector
const SVG_PROJECTOR = `
<rect x="5" y="8" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
<circle cx="12" cy="13" r="2.8" stroke="currentColor" stroke-width="1.4"/>
<circle cx="12" cy="13" r="1" fill="currentColor"/>
<path d="M5,10 L2,8 L2,18 L5,16" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
<circle cx="8" cy="5.5" r="2" stroke="currentColor" stroke-width="1.4"/>
<circle cx="16" cy="5.5" r="2" stroke="currentColor" stroke-width="1.4"/>
<line x1="10" y1="5.5" x2="14" y2="5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
`;

// Spotlight
const SVG_SPOTLIGHT = `
<rect x="8" y="2" width="8" height="5" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity="0.15"/>
<circle cx="12" cy="4.5" r="1.2" fill="currentColor"/>
<path d="M5,21 L8,7 L16,7 L19,21 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" opacity="0.1"/>
<line x1="5" y1="21" x2="19" y2="21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
`;

// Director's Chair
const SVG_CHAIR = `
<line x1="7" y1="21" x2="13.5" y2="5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="17" y1="21" x2="10.5" y2="5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="8.5" y1="14" x2="15.5" y2="14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
<path d="M9.5,5 Q12,3.5 14.5,5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" fill="none"/>
<line x1="7" y1="21" x2="17" y2="21" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
`;

// Cinema Ticket
const SVG_TICKET = `
<rect x="2" y="6" width="20" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/>
<circle cx="8" cy="6" r="2.2" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.2"/>
<circle cx="8" cy="18" r="2.2" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.2"/>
<line x1="8" y1="8.2" x2="8" y2="15.8" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 1.8"/>
<polygon points="15,8.5 16.1,11.2 19,11.4 16.9,13.2 17.6,16.1 15,14.5 12.4,16.1 13.1,13.2 11,11.4 13.9,11.2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="currentColor" opacity="0.18"/>
`;

// Popcorn
const SVG_POPCORN = `
<rect x="7" y="11" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity="0.1"/>
<path d="M7,11 L8.5,21 L15.5,21 L17,11 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" opacity="0.1"/>
<line x1="12" y1="11" x2="12" y2="21" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
<circle cx="9" cy="8" r="2.8" stroke="currentColor" stroke-width="1.5" fill="none"/>
<circle cx="15" cy="8" r="2.8" stroke="currentColor" stroke-width="1.5" fill="none"/>
<circle cx="12" cy="6.5" r="2.8" stroke="currentColor" stroke-width="1.5" fill="none"/>
`;

// Megaphone / Director's Horn
const SVG_MEGAPHONE = `
<path d="M3,9 L3,15 L7,15 L17,20 L17,4 L7,9 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" opacity="0.12"/>
<line x1="3" y1="9" x2="3" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
<path d="M7,9.5 L7,14.5 L10,17.5 L10,21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="M20,7 Q22,12 20,17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
<path d="M18.5,9 Q20,12 18.5,15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>
`;

// Film Canister
const SVG_CANISTER = `
<ellipse cx="12" cy="5" rx="8" ry="2.5" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity="0.12"/>
<rect x="4" y="5" width="16" height="14" rx="0" stroke="currentColor" stroke-width="1.6" fill="none"/>
<ellipse cx="12" cy="19" rx="8" ry="2.5" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity="0.12"/>
<line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
<line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
<circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5"/>
`;

// Theater Curtain
const SVG_CURTAIN = `
<rect x="2" y="2" width="20" height="20" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.4"/>
<path d="M2,2 Q6,8 4,14 Q6,18 8,20" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
<path d="M22,2 Q18,8 20,14 Q18,18 16,20" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
<line x1="2" y1="2" x2="22" y2="2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
<rect x="9" y="14" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="currentColor" opacity="0.2"/>
`;

// Countdown / Film Leader
const SVG_COUNTDOWN = `
<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
<circle cx="12" cy="12" r="5.5" stroke="currentColor" stroke-width="1"/>
<line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<path d="M10,9.5 Q14,9.5 14,11.5 Q14,12 12,12 Q14,12 14,14 Q14,16 10,16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
`;

// Headphones / Sound
const SVG_HEADPHONES = `
<path d="M4,13 C4,7.5 7.6,3 12,3 C16.4,3 20,7.5 20,13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<rect x="2" y="12" width="4" height="6" rx="2" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity="0.2"/>
<rect x="18" y="12" width="4" height="6" rx="2" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity="0.2"/>
`;

// Slate / Scene marker
const SVG_SLATE = `
<rect x="3" y="7" width="18" height="14" rx="1.5" stroke="currentColor" stroke-width="1.6" fill="none"/>
<rect x="3" y="3" width="18" height="5" rx="1" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity="0.15"/>
<line x1="7.5" y1="3" x2="5.5" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="12.5" y1="3" x2="10.5" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="17.5" y1="3" x2="15.5" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
<line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
<line x1="8" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
`;

// Play Button
const SVG_PLAY = `
<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
<polygon points="10,8.5 10,15.5 17,12" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="currentColor" opacity="0.8"/>
`;

// Trophy / Award
const SVG_TROPHY = `
<path d="M8,3 L16,3 L15.5,10.5 C15.2,13.2 13.8,15 12,15 C10.2,15 8.8,13.2 8.5,10.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" opacity="0.12"/>
<path d="M8,4 C7,4 5,4 5,7.5 C5,10.5 7.5,11.5 8.5,11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<path d="M16,4 C17,4 19,4 19,7.5 C19,10.5 16.5,11.5 15.5,11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<line x1="12" y1="15" x2="12" y2="18.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
<rect x="7.5" y="18.5" width="9" height="2.5" rx="0.8" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity="0.15"/>
`;

export const CINEMA_AVATARS: CinemaAvatar[] = [
  { id: 'cinema_reel',       label: 'Film Reel',  bg: 'bg-sage/10',        color: '#8A9A5B', svgPaths: SVG_REEL,       isFree: true  },
  { id: 'cinema_clap',       label: 'Clapboard',  bg: 'bg-clay/10',        color: '#C4A882', svgPaths: SVG_CLAP,       isFree: false },
  { id: 'cinema_camera',     label: 'Camera',     bg: 'bg-white/5',        color: '#E5E4E2', svgPaths: SVG_CAMERA,     isFree: false },
  { id: 'cinema_strip',      label: 'Film Strip', bg: 'bg-purple-900/20',  color: '#A78BCA', svgPaths: SVG_STRIP,      isFree: false },
  { id: 'cinema_frame',      label: 'Viewfinder', bg: 'bg-blue-900/20',    color: '#60A5FA', svgPaths: SVG_FRAME,      isFree: false },
  { id: 'cinema_star',       label: 'Star',       bg: 'bg-amber-900/20',   color: '#F59E0B', svgPaths: SVG_STAR,       isFree: false },
  { id: 'cinema_lens',       label: 'Lens',       bg: 'bg-red-900/10',     color: '#F87171', svgPaths: SVG_LENS,       isFree: false },
  { id: 'cinema_projector',  label: 'Projector',  bg: 'bg-gray-700/20',    color: '#94A3B8', svgPaths: SVG_PROJECTOR,  isFree: false },
  { id: 'cinema_spotlight',  label: 'Spotlight',  bg: 'bg-cyan-900/20',    color: '#22D3EE', svgPaths: SVG_SPOTLIGHT,  isFree: false },
  { id: 'cinema_chair',      label: 'Director',   bg: 'bg-orange-900/20',  color: '#FB923C', svgPaths: SVG_CHAIR,      isFree: false },
  { id: 'cinema_ticket',     label: 'Ticket',     bg: 'bg-emerald-900/20', color: '#34D399', svgPaths: SVG_TICKET,     isFree: false },
  { id: 'cinema_trophy',     label: 'Trophy',     bg: 'bg-yellow-900/20',  color: '#FBBF24', svgPaths: SVG_TROPHY,     isFree: false },
  { id: 'cinema_popcorn',    label: 'Popcorn',    bg: 'bg-yellow-900/10',  color: '#FDE68A', svgPaths: SVG_POPCORN,    isFree: false },
  { id: 'cinema_megaphone',  label: 'Megaphone',  bg: 'bg-rose-900/20',    color: '#FB7185', svgPaths: SVG_MEGAPHONE,  isFree: false },
  { id: 'cinema_canister',   label: 'Canister',   bg: 'bg-zinc-800/30',    color: '#D4D4D8', svgPaths: SVG_CANISTER,   isFree: false },
  { id: 'cinema_curtain',    label: 'Curtain',    bg: 'bg-red-900/20',     color: '#FCA5A5', svgPaths: SVG_CURTAIN,    isFree: false },
  { id: 'cinema_countdown',  label: 'Countdown',  bg: 'bg-indigo-900/20',  color: '#818CF8', svgPaths: SVG_COUNTDOWN,  isFree: false },
  { id: 'cinema_headphones', label: 'Sound',      bg: 'bg-teal-900/20',    color: '#2DD4BF', svgPaths: SVG_HEADPHONES, isFree: false },
  { id: 'cinema_slate', label: 'Slate', bg: 'bg-sky-900/20',  color: '#7DD3FC', svgPaths: SVG_SLATE, isFree: false },
  { id: 'cinema_play',  label: 'Play',  bg: 'bg-lime-900/20', color: '#A3E635', svgPaths: SVG_PLAY,  isFree: false },
];

export const DEFAULT_AVATAR_ID = 'cinema_reel';

export const getAvatarById = (id: string): CinemaAvatar =>
  CINEMA_AVATARS.find((a) => a.id === id) ?? CINEMA_AVATARS[0];

export const resolveAvatarDisplay = (avatarId: string): { svgPaths: string; bg: string; color: string } => {
  // Legacy geo_ IDs — map to cinema equivalents
  if (avatarId === 'geo_1') return { svgPaths: SVG_REEL, bg: 'bg-sage/10', color: '#8A9A5B' };
  if (avatarId === 'geo_2') return { svgPaths: SVG_CLAP, bg: 'bg-clay/10', color: '#C4A882' };
  if (avatarId === 'geo_3') return { svgPaths: SVG_STRIP, bg: 'bg-purple-900/20', color: '#A78BCA' };
  if (avatarId === 'geo_4') return { svgPaths: SVG_CAMERA, bg: 'bg-white/5', color: '#E5E4E2' };

  const found = CINEMA_AVATARS.find((a) => a.id === avatarId);
  return found
    ? { svgPaths: found.svgPaths, bg: found.bg, color: found.color }
    : { svgPaths: SVG_REEL, bg: 'bg-sage/10', color: '#8A9A5B' };
};
