export type CelebrationLanguage = 'en' | 'tr' | 'es' | 'fr';

export type LeagueTransitionCopy = {
  badge: string;
  body: string;
  meta: string;
  action: string;
};

export type StreakCelebrationTheme = {
  accentHex: string;
  shellStart: string;
  shellEnd: string;
  cardStart: string;
  cardEnd: string;
};

export type StreakCelebrationCopy = {
  badge: string;
  title: string;
  subtitle: string;
};

export type StreakSurfaceCopy = {
  dayLabel: string;
  completed: string;
  action: string;
};

export const STREAK_MILESTONES = [5, 7, 10, 20, 40, 50, 100, 200, 250, 300, 350] as const;

export const STREAK_MILESTONE_SET = new Set<number>(STREAK_MILESTONES);

export const isStreakMilestone = (day: number): boolean =>
  Number.isFinite(day) && STREAK_MILESTONE_SET.has(day);

export const LEAGUE_TRANSITION_COPY: Record<CelebrationLanguage, LeagueTransitionCopy> = {
  en: {
    badge: 'League Advanced',
    body: 'Congratulations. Your total XP has moved up into this league.',
    meta: 'League promoted',
    action: 'Done',
  },
  tr: {
    badge: 'Lig Atlandi',
    body: 'Tebrikler. Toplam XP seviyen bu lige yukseldi.',
    meta: 'Lig gecisi tamamlandi',
    action: 'Tamam',
  },
  es: {
    badge: 'Liga Ascendida',
    body: 'Felicidades. Tu XP total subio a esta liga.',
    meta: 'Ascenso completado',
    action: 'Listo',
  },
  fr: {
    badge: 'Ligue Debloquee',
    body: 'Felicitations. Ton XP total est monte jusqua cette ligue.',
    meta: 'Promotion confirmee',
    action: 'Terminer',
  },
};

export const DEFAULT_STREAK_THEME: StreakCelebrationTheme = {
  shellStart: '#0c1415',
  shellEnd: '#0c0f15',
  cardStart: '#121b1d',
  cardEnd: '#11141c',
  accentHex: '#8A9A5B',
};

export const STREAK_THEME_BY_DAY: Partial<Record<number, StreakCelebrationTheme>> = {
  5: {
    shellStart: '#2a1308',
    shellEnd: '#170d09',
    cardStart: '#3a1d0f',
    cardEnd: '#1f120d',
    accentHex: '#f59e0b',
  },
  7: {
    shellStart: '#0e1026',
    shellEnd: '#0d1020',
    cardStart: '#1a1f4f',
    cardEnd: '#141836',
    accentHex: '#818cf8',
  },
  10: {
    shellStart: '#1f0b25',
    shellEnd: '#140a1f',
    cardStart: '#2b123a',
    cardEnd: '#1a112d',
    accentHex: '#c084fc',
  },
  20: {
    shellStart: '#0a2320',
    shellEnd: '#08201d',
    cardStart: '#0e3a34',
    cardEnd: '#0c2a27',
    accentHex: '#34d399',
  },
  40: {
    shellStart: '#23170b',
    shellEnd: '#1f1308',
    cardStart: '#3d2a0f',
    cardEnd: '#2b1909',
    accentHex: '#f97316',
  },
  50: {
    shellStart: '#241c08',
    shellEnd: '#1d1407',
    cardStart: '#4f390e',
    cardEnd: '#2f2209',
    accentHex: '#facc15',
  },
  100: {
    shellStart: '#2a0f12',
    shellEnd: '#1f0b0f',
    cardStart: '#5a151e',
    cardEnd: '#341015',
    accentHex: '#fb7185',
  },
  200: {
    shellStart: '#0f1e2b',
    shellEnd: '#0d1823',
    cardStart: '#173a52',
    cardEnd: '#102738',
    accentHex: '#38bdf8',
  },
  250: {
    shellStart: '#151920',
    shellEnd: '#12151b',
    cardStart: '#252f3d',
    cardEnd: '#1a222e',
    accentHex: '#94a3b8',
  },
  300: {
    shellStart: '#142311',
    shellEnd: '#101b0d',
    cardStart: '#223f1b',
    cardEnd: '#162b12',
    accentHex: '#84cc16',
  },
  350: {
    shellStart: '#2c1b0f',
    shellEnd: '#1f130b',
    cardStart: '#5c3218',
    cardEnd: '#321c0f',
    accentHex: '#fb923c',
  },
};

export const STREAK_THEME_COPY: Record<
  CelebrationLanguage,
  { default: StreakCelebrationCopy } & Partial<Record<number, StreakCelebrationCopy>>
> = {
  en: {
    default: {
      badge: 'Daily Streak',
      title: 'Series Locked In',
      subtitle: "Nice work. You protected today's streak with a new ritual.",
    },
    5: {
      badge: '5 Day Milestone',
      title: 'First Spark',
      subtitle: 'Nice work. You crossed your first major streak threshold.',
    },
    7: {
      badge: '7 Day Milestone',
      title: 'Lucky Orbit',
      subtitle: 'Nice work. You now own a full week of rhythm.',
    },
    10: {
      badge: '10 Day Milestone',
      title: 'Double Digits',
      subtitle: 'Nice work. You reached double-digit streak status.',
    },
    20: {
      badge: '20 Day Milestone',
      title: 'Momentum Gate',
      subtitle: 'Nice work. The rhythm has turned into habit.',
    },
    40: {
      badge: '40 Day Milestone',
      title: 'Forty Pulse',
      subtitle: 'Nice work. You proved long-run streak resilience.',
    },
    50: {
      badge: '50 Day Milestone',
      title: 'Golden Frame',
      subtitle: 'Nice work. Half a hundred days are now yours.',
    },
    100: {
      badge: '100 Day Milestone',
      title: 'Century Flame',
      subtitle: 'Nice work. You entered legendary triple-digit streak territory.',
    },
    200: {
      badge: '200 Day Milestone',
      title: 'Double Century',
      subtitle: 'Nice work. Your consistency is now benchmark level.',
    },
    250: {
      badge: '250 Day Milestone',
      title: 'Silver Surge',
      subtitle: 'Nice work. This long streak has left a permanent trace.',
    },
    300: {
      badge: '300 Day Milestone',
      title: 'Triple Orbit',
      subtitle: 'Nice work. This streak is now beyond the game.',
    },
    350: {
      badge: '350 Day Milestone',
      title: 'Titan Run',
      subtitle: 'Nice work. You climbed into historic streak territory.',
    },
  },
  tr: {
    default: {
      badge: 'Gunluk Seri',
      title: 'Seri Korundu',
      subtitle: 'Tebrikler. Bugunku rituelle seriyi korudun.',
    },
    5: {
      badge: '5 Gun Esigi',
      title: 'Ilk Kivilcim',
      subtitle: 'Tebrikler. Ilk buyuk esigi gectin.',
    },
    7: {
      badge: '7 Gun Esigi',
      title: 'Sansli Yorunge',
      subtitle: 'Tebrikler. Artik bir haftalik ritim sende.',
    },
    10: {
      badge: '10 Gun Esigi',
      title: 'Cift Hane',
      subtitle: 'Tebrikler. Iki haneli seri seviyesine geldin.',
    },
    20: {
      badge: '20 Gun Esigi',
      title: 'Momentum Kapisi',
      subtitle: 'Tebrikler. Ritim artik aliskanliga donustu.',
    },
    40: {
      badge: '40 Gun Esigi',
      title: 'Kirk Nefesi',
      subtitle: 'Tebrikler. Uzun seri dayanimini kanitladin.',
    },
    50: {
      badge: '50 Gun Esigi',
      title: 'Altin Kare',
      subtitle: 'Tebrikler. Yarim asirlik seri artik sende.',
    },
    100: {
      badge: '100 Gun Esigi',
      title: 'Yuzyil Alevi',
      subtitle: 'Tebrikler. Uc haneli efsanevi seriye ulastin.',
    },
    200: {
      badge: '200 Gun Esigi',
      title: 'Cift Yuzyil',
      subtitle: 'Tebrikler. Istikrarin artik benchmark seviyesinde.',
    },
    250: {
      badge: '250 Gun Esigi',
      title: 'Gumus Yukselis',
      subtitle: 'Tebrikler. Bu uzun seri kalici bir iz birakti.',
    },
    300: {
      badge: '300 Gun Esigi',
      title: 'Ucuncu Yorunge',
      subtitle: 'Tebrikler. Bu seri artik oyunun ustunde.',
    },
    350: {
      badge: '350 Gun Esigi',
      title: 'Titan Kosusu',
      subtitle: 'Tebrikler. Tarihi bir seri seviyesine ciktin.',
    },
  },
  es: {
    default: {
      badge: 'Racha Diaria',
      title: 'Racha Asegurada',
      subtitle: 'Buen trabajo. Protegiste la racha de hoy con un nuevo ritual.',
    },
    5: {
      badge: 'Meta de 5 Dias',
      title: 'Primera Chispa',
      subtitle: 'Buen trabajo. Cruzaste tu primer gran umbral de racha.',
    },
    7: {
      badge: 'Meta de 7 Dias',
      title: 'Orbita Afortunada',
      subtitle: 'Buen trabajo. Ya tienes una semana completa de ritmo.',
    },
    10: {
      badge: 'Meta de 10 Dias',
      title: 'Doble Digito',
      subtitle: 'Buen trabajo. Alcanzaste una racha de dos cifras.',
    },
    20: {
      badge: 'Meta de 20 Dias',
      title: 'Puerta del Impulso',
      subtitle: 'Buen trabajo. El ritmo ya se convirtio en habito.',
    },
    40: {
      badge: 'Meta de 40 Dias',
      title: 'Pulso Cuarenta',
      subtitle: 'Buen trabajo. Demostraste resistencia en una racha larga.',
    },
    50: {
      badge: 'Meta de 50 Dias',
      title: 'Marco Dorado',
      subtitle: 'Buen trabajo. Medio centenar de dias ya es tuyo.',
    },
    100: {
      badge: 'Meta de 100 Dias',
      title: 'Llama Centenaria',
      subtitle: 'Buen trabajo. Entraste en un territorio legendario de tres cifras.',
    },
    200: {
      badge: 'Meta de 200 Dias',
      title: 'Doble Centena',
      subtitle: 'Buen trabajo. Tu constancia ya esta en nivel de referencia.',
    },
    250: {
      badge: 'Meta de 250 Dias',
      title: 'Oleada Plateada',
      subtitle: 'Buen trabajo. Esta racha larga ya dejo una huella permanente.',
    },
    300: {
      badge: 'Meta de 300 Dias',
      title: 'Triple Orbita',
      subtitle: 'Buen trabajo. Esta racha ya esta por encima del juego.',
    },
    350: {
      badge: 'Meta de 350 Dias',
      title: 'Carrera Titan',
      subtitle: 'Buen trabajo. Llegaste a una zona historica de racha.',
    },
  },
  fr: {
    default: {
      badge: 'Serie Quotidienne',
      title: 'Serie Confirmee',
      subtitle: 'Beau travail. Tu as protege la serie du jour avec un nouveau rituel.',
    },
    5: {
      badge: 'Palier 5 Jours',
      title: 'Premiere Etincelle',
      subtitle: 'Beau travail. Tu as franchi ton premier grand palier de serie.',
    },
    7: {
      badge: 'Palier 7 Jours',
      title: 'Orbite Chanceuse',
      subtitle: 'Beau travail. Tu tiens maintenant une semaine complete de rythme.',
    },
    10: {
      badge: 'Palier 10 Jours',
      title: 'Double Chiffre',
      subtitle: 'Beau travail. Tu as atteint une serie a deux chiffres.',
    },
    20: {
      badge: 'Palier 20 Jours',
      title: 'Porte dElan',
      subtitle: 'Beau travail. Le rythme est devenu une habitude.',
    },
    40: {
      badge: 'Palier 40 Jours',
      title: 'Pouls Quarante',
      subtitle: 'Beau travail. Tu as prouve ton endurance sur une longue serie.',
    },
    50: {
      badge: 'Palier 50 Jours',
      title: 'Cadre Dore',
      subtitle: 'Beau travail. Un demi-centenaire de jours est maintenant a toi.',
    },
    100: {
      badge: 'Palier 100 Jours',
      title: 'Flamme Centenaire',
      subtitle: 'Beau travail. Tu es entre dans un territoire legendaire a trois chiffres.',
    },
    200: {
      badge: 'Palier 200 Jours',
      title: 'Double Centaine',
      subtitle: 'Beau travail. Ta constance est desormais une reference.',
    },
    250: {
      badge: 'Palier 250 Jours',
      title: 'Vague dArgent',
      subtitle: 'Beau travail. Cette longue serie a laisse une trace durable.',
    },
    300: {
      badge: 'Palier 300 Jours',
      title: 'Triple Orbite',
      subtitle: 'Beau travail. Cette serie depasse maintenant le cadre du jeu.',
    },
    350: {
      badge: 'Palier 350 Jours',
      title: 'Course Titan',
      subtitle: 'Beau travail. Tu as atteint une zone historique de serie.',
    },
  },
};

export const STREAK_SURFACE_COPY: Record<CelebrationLanguage, StreakSurfaceCopy> = {
  en: {
    dayLabel: 'Streak Day',
    completed: 'Congratulations. Streak increase recorded.',
    action: 'Done',
  },
  tr: {
    dayLabel: 'Seri Gunu',
    completed: 'Tebrikler. Seri artisi kaydedildi.',
    action: 'Tamam',
  },
  es: {
    dayLabel: 'Dia de Racha',
    completed: 'Felicidades. El aumento de la racha se registro.',
    action: 'Listo',
  },
  fr: {
    dayLabel: 'Jour de Serie',
    completed: 'Felicitations. La progression de la serie a ete enregistree.',
    action: 'Terminer',
  },
};

export const resolveStreakCelebrationTheme = (day: number): StreakCelebrationTheme =>
  STREAK_THEME_BY_DAY[day] || DEFAULT_STREAK_THEME;

export const resolveStreakCelebrationCopy = (
  language: CelebrationLanguage,
  day: number
): StreakCelebrationCopy => {
  const languageCopy = STREAK_THEME_COPY[language] || STREAK_THEME_COPY.en;
  return languageCopy[day] || languageCopy.default;
};

export const resolveStreakSurfaceCopy = (language: CelebrationLanguage): StreakSurfaceCopy =>
  STREAK_SURFACE_COPY[language] || STREAK_SURFACE_COPY.en;

export const buildStreakNotificationCopy = (
  language: CelebrationLanguage,
  day: number
): { title: string; body: string } => {
  const celebrationCopy = resolveStreakCelebrationCopy(language, day);
  const surfaceCopy = resolveStreakSurfaceCopy(language);

  return {
    title: celebrationCopy.badge,
    body: `${surfaceCopy.dayLabel}: ${day}. ${celebrationCopy.subtitle}`,
  };
};

export const buildLeagueNotificationCopy = (
  language: CelebrationLanguage,
  leagueName: string
): { title: string; body: string } => {
  const copy = LEAGUE_TRANSITION_COPY[language] || LEAGUE_TRANSITION_COPY.en;
  return {
    title: copy.badge,
    body: `${leagueName}. ${copy.body}`,
  };
};

export type MarkUnlockSurfaceCopy = {
  eyebrow: string;
  action: string;
  categoryLabel: string;
};

export const MARK_UNLOCK_SURFACE_COPY: Record<CelebrationLanguage, MarkUnlockSurfaceCopy> = {
  en: { eyebrow: 'Mark Unlocked', action: 'Nice', categoryLabel: 'Category' },
  tr: { eyebrow: 'Mark Kazanildi', action: 'Harika', categoryLabel: 'Kategori' },
  es: { eyebrow: 'Insignia Desbloqueada', action: 'Genial', categoryLabel: 'Categoria' },
  fr: { eyebrow: 'Insigne Debloquee', action: 'Super', categoryLabel: 'Categorie' },
};

export const resolveMarkUnlockSurfaceCopy = (language: CelebrationLanguage): MarkUnlockSurfaceCopy =>
  MARK_UNLOCK_SURFACE_COPY[language] || MARK_UNLOCK_SURFACE_COPY.en;
