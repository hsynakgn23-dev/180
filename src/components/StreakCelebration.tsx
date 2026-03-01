import { useEffect, useState, type CSSProperties } from 'react';
import type { StreakCelebrationEvent } from '../context/XPContext';
import { useLanguage } from '../context/LanguageContext';
import type { LanguageCode } from '../i18n/localization';

interface StreakCelebrationProps {
    event: StreakCelebrationEvent;
    onComplete: () => void;
}

type CelebrationTheme = {
    badge?: string;
    title?: string;
    subtitle?: string;
    shellClass: string;
    cardClass: string;
    accentHex: string;
};

const DEFAULT_THEME: CelebrationTheme = {
    shellClass: 'bg-gradient-to-br from-[#0c1415]/90 via-[#10161b]/90 to-[#0c0f15]/90',
    cardClass: 'bg-gradient-to-br from-[#121b1d]/90 via-[#162028]/90 to-[#11141c]/90',
    accentHex: '#8A9A5B'
};

type CelebrationTextTheme = {
    badge: string;
    title: string;
    subtitle: string;
};

const STREAK_THEME_COPY: Record<LanguageCode, { default: CelebrationTextTheme } & Partial<Record<number, CelebrationTextTheme>>> = {
    en: {
        default: {
            badge: 'Daily Streak',
            title: 'Series Locked In',
            subtitle: 'Nice work. You protected today\'s streak with a new ritual.'
        },
        5: {
            badge: '5 Day Milestone',
            title: 'First Spark',
            subtitle: 'Nice work. You crossed your first major streak threshold.'
        },
        7: {
            badge: '7 Day Milestone',
            title: 'Lucky Orbit',
            subtitle: 'Nice work. You now own a full week of rhythm.'
        },
        10: {
            badge: '10 Day Milestone',
            title: 'Double Digits',
            subtitle: 'Nice work. You reached double-digit streak status.'
        },
        20: {
            badge: '20 Day Milestone',
            title: 'Momentum Gate',
            subtitle: 'Nice work. The rhythm has turned into habit.'
        },
        40: {
            badge: '40 Day Milestone',
            title: 'Forty Pulse',
            subtitle: 'Nice work. You proved long-run streak resilience.'
        },
        50: {
            badge: '50 Day Milestone',
            title: 'Golden Frame',
            subtitle: 'Nice work. Half a hundred days are now yours.'
        },
        100: {
            badge: '100 Day Milestone',
            title: 'Century Flame',
            subtitle: 'Nice work. You entered legendary triple-digit streak territory.'
        },
        200: {
            badge: '200 Day Milestone',
            title: 'Double Century',
            subtitle: 'Nice work. Your consistency is now benchmark level.'
        },
        250: {
            badge: '250 Day Milestone',
            title: 'Silver Surge',
            subtitle: 'Nice work. This long streak has left a permanent trace.'
        },
        300: {
            badge: '300 Day Milestone',
            title: 'Triple Orbit',
            subtitle: 'Nice work. This streak is now beyond the game.'
        },
        350: {
            badge: '350 Day Milestone',
            title: 'Titan Run',
            subtitle: 'Nice work. You climbed into historic streak territory.'
        }
    },
    tr: {
        default: {
            badge: 'Günlük Seri',
            title: 'Seri Korundu',
            subtitle: 'Tebrikler. Bugünkü ritüelle seriyi korudun.'
        },
        5: {
            badge: '5 Gün Eşiği',
            title: 'İlk Kıvılcım',
            subtitle: 'Tebrikler. İlk büyük eşiği geçtin.'
        },
        7: {
            badge: '7 Gün Eşiği',
            title: 'Şanslı Yörünge',
            subtitle: 'Tebrikler. Artık bir haftalık ritim sende.'
        },
        10: {
            badge: '10 Gün Eşiği',
            title: 'Çift Hane',
            subtitle: 'Tebrikler. İki haneli seri seviyesine geldin.'
        },
        20: {
            badge: '20 Gün Eşiği',
            title: 'Momentum Kapısı',
            subtitle: 'Tebrikler. Ritim artık alışkanlığa dönüştü.'
        },
        40: {
            badge: '40 Gün Eşiği',
            title: 'Kırk Nefesi',
            subtitle: 'Tebrikler. Uzun seri dayanımını kanıtladın.'
        },
        50: {
            badge: '50 Gün Eşiği',
            title: 'Altın Kare',
            subtitle: 'Tebrikler. Yarım asırlık seri artık sende.'
        },
        100: {
            badge: '100 Gün Eşiği',
            title: 'Yüzyıl Alevi',
            subtitle: 'Tebrikler. Üç haneli efsanevi seriye ulaştın.'
        },
        200: {
            badge: '200 Gün Eşiği',
            title: 'Çift Yüzyıl',
            subtitle: 'Tebrikler. İstikrarın artık referans seviyesinde.'
        },
        250: {
            badge: '250 Gün Eşiği',
            title: 'Gümüş Yükseliş',
            subtitle: 'Tebrikler. Bu uzun seri kalıcı bir iz bıraktı.'
        },
        300: {
            badge: '300 Gün Eşiği',
            title: 'Üçüncü Yörünge',
            subtitle: 'Tebrikler. Bu seri artık oyunun üstünde.'
        },
        350: {
            badge: '350 Gün Eşiği',
            title: 'Titan Koşusu',
            subtitle: 'Tebrikler. Tarihî bir seri seviyesine çıktın.'
        }
    },
    es: {
        default: {
            badge: 'Racha Diaria',
            title: 'Racha Asegurada',
            subtitle: 'Buen trabajo. Protegiste la racha de hoy con un nuevo ritual.'
        },
        5: {
            badge: 'Meta de 5 Días',
            title: 'Primera Chispa',
            subtitle: 'Buen trabajo. Cruzaste tu primer gran umbral de racha.'
        },
        7: {
            badge: 'Meta de 7 Días',
            title: 'Órbita Afortunada',
            subtitle: 'Buen trabajo. Ya tienes una semana completa de ritmo.'
        },
        10: {
            badge: 'Meta de 10 Días',
            title: 'Doble Dígito',
            subtitle: 'Buen trabajo. Alcanzaste una racha de dos cifras.'
        },
        20: {
            badge: 'Meta de 20 Días',
            title: 'Puerta del Impulso',
            subtitle: 'Buen trabajo. El ritmo ya se convirtió en hábito.'
        },
        40: {
            badge: 'Meta de 40 Días',
            title: 'Pulso Cuarenta',
            subtitle: 'Buen trabajo. Demostraste resistencia en una racha larga.'
        },
        50: {
            badge: 'Meta de 50 Días',
            title: 'Marco Dorado',
            subtitle: 'Buen trabajo. Medio centenar de días ya es tuyo.'
        },
        100: {
            badge: 'Meta de 100 Días',
            title: 'Llama Centenaria',
            subtitle: 'Buen trabajo. Entraste en un territorio legendario de tres cifras.'
        },
        200: {
            badge: 'Meta de 200 Días',
            title: 'Doble Centena',
            subtitle: 'Buen trabajo. Tu constancia ya está en nivel de referencia.'
        },
        250: {
            badge: 'Meta de 250 Días',
            title: 'Oleada Plateada',
            subtitle: 'Buen trabajo. Esta racha larga ya dejó una huella permanente.'
        },
        300: {
            badge: 'Meta de 300 Días',
            title: 'Triple Órbita',
            subtitle: 'Buen trabajo. Esta racha ya está por encima del juego.'
        },
        350: {
            badge: 'Meta de 350 Días',
            title: 'Carrera Titán',
            subtitle: 'Buen trabajo. Llegaste a una zona histórica de racha.'
        }
    },
    fr: {
        default: {
            badge: 'Série Quotidienne',
            title: 'Série Confirmée',
            subtitle: 'Beau travail. Tu as protégé la série du jour avec un nouveau rituel.'
        },
        5: {
            badge: 'Palier 5 Jours',
            title: 'Première Étincelle',
            subtitle: 'Beau travail. Tu as franchi ton premier grand palier de série.'
        },
        7: {
            badge: 'Palier 7 Jours',
            title: 'Orbite Chanceuse',
            subtitle: 'Beau travail. Tu tiens maintenant une semaine complète de rythme.'
        },
        10: {
            badge: 'Palier 10 Jours',
            title: 'Double Chiffre',
            subtitle: 'Beau travail. Tu as atteint une série à deux chiffres.'
        },
        20: {
            badge: 'Palier 20 Jours',
            title: 'Porte d’Élan',
            subtitle: 'Beau travail. Le rythme est devenu une habitude.'
        },
        40: {
            badge: 'Palier 40 Jours',
            title: 'Pouls Quarante',
            subtitle: 'Beau travail. Tu as prouvé ton endurance sur une longue série.'
        },
        50: {
            badge: 'Palier 50 Jours',
            title: 'Cadre Doré',
            subtitle: 'Beau travail. Un demi-centenaire de jours est maintenant à toi.'
        },
        100: {
            badge: 'Palier 100 Jours',
            title: 'Flamme Centenaire',
            subtitle: 'Beau travail. Tu es entré dans un territoire légendaire à trois chiffres.'
        },
        200: {
            badge: 'Palier 200 Jours',
            title: 'Double Centaine',
            subtitle: 'Beau travail. Ta constance est désormais une référence.'
        },
        250: {
            badge: 'Palier 250 Jours',
            title: 'Vague d’Argent',
            subtitle: 'Beau travail. Cette longue série a laissé une trace durable.'
        },
        300: {
            badge: 'Palier 300 Jours',
            title: 'Triple Orbite',
            subtitle: 'Beau travail. Cette série dépasse maintenant le cadre du jeu.'
        },
        350: {
            badge: 'Palier 350 Jours',
            title: 'Course Titan',
            subtitle: 'Beau travail. Tu as atteint une zone historique de série.'
        }
    }
};

const STREAK_SURFACE_COPY: Record<LanguageCode, { dayLabel: string; completed: string; action: string }> = {
    en: {
        dayLabel: 'Streak Day',
        completed: 'Congratulations. Streak increase recorded.',
        action: 'Done'
    },
    tr: {
        dayLabel: 'Seri Günü',
        completed: 'Tebrikler. Seri artışı kaydedildi.',
        action: 'Tamam'
    },
    es: {
        dayLabel: 'Día de Racha',
        completed: 'Felicidades. El aumento de la racha se registró.',
        action: 'Listo'
    },
    fr: {
        dayLabel: 'Jour de Série',
        completed: 'Félicitations. La progression de la série a été enregistrée.',
        action: 'Terminer'
    }
};

const MILESTONE_THEMES: Record<number, CelebrationTheme> = {
    5: {
        badge: '5 Day Milestone',
        title: 'First Spark',
        subtitle: 'Tebrikler. İlk büyük eşiği geçtin.',
        shellClass: 'bg-gradient-to-br from-[#2a1308]/92 via-[#31180d]/90 to-[#170d09]/94',
        cardClass: 'bg-gradient-to-br from-[#3a1d0f]/90 via-[#5b2b16]/90 to-[#1f120d]/90',
        accentHex: '#f59e0b'
    },
    7: {
        badge: '7 Day Milestone',
        title: 'Lucky Orbit',
        subtitle: 'Tebrikler. Artık bir haftalık ritim sende.',
        shellClass: 'bg-gradient-to-br from-[#0e1026]/92 via-[#1b1f47]/90 to-[#0d1020]/94',
        cardClass: 'bg-gradient-to-br from-[#1a1f4f]/90 via-[#313b8a]/88 to-[#141836]/92',
        accentHex: '#818cf8'
    },
    10: {
        badge: '10 Day Milestone',
        title: 'Double Digits',
        subtitle: 'Tebrikler. İki haneli seri seviyesine geldin.',
        shellClass: 'bg-gradient-to-br from-[#1f0b25]/92 via-[#2a0f34]/90 to-[#140a1f]/94',
        cardClass: 'bg-gradient-to-br from-[#2b123a]/90 via-[#4f1f6a]/88 to-[#1a112d]/92',
        accentHex: '#c084fc'
    },
    20: {
        badge: '20 Day Milestone',
        title: 'Momentum Gate',
        subtitle: 'Tebrikler. Ritim artık alışkanlığa dönüştü.',
        shellClass: 'bg-gradient-to-br from-[#0a2320]/92 via-[#0f3430]/90 to-[#08201d]/94',
        cardClass: 'bg-gradient-to-br from-[#0e3a34]/90 via-[#1b5c55]/88 to-[#0c2a27]/92',
        accentHex: '#34d399'
    },
    40: {
        badge: '40 Day Milestone',
        title: 'Forty Pulse',
        subtitle: 'Tebrikler. Uzun seri dayanımını kanıtladın.',
        shellClass: 'bg-gradient-to-br from-[#23170b]/92 via-[#3a220c]/90 to-[#1f1308]/94',
        cardClass: 'bg-gradient-to-br from-[#3d2a0f]/90 via-[#69410f]/88 to-[#2b1909]/92',
        accentHex: '#f97316'
    },
    50: {
        badge: '50 Day Milestone',
        title: 'Golden Frame',
        subtitle: 'Tebrikler. Yarım asırlık seri artık sende.',
        shellClass: 'bg-gradient-to-br from-[#241c08]/92 via-[#3f2e0b]/90 to-[#1d1407]/94',
        cardClass: 'bg-gradient-to-br from-[#4f390e]/90 via-[#7a5a0f]/88 to-[#2f2209]/92',
        accentHex: '#facc15'
    },
    100: {
        badge: '100 Day Milestone',
        title: 'Century Flame',
        subtitle: 'Tebrikler. Üç haneli efsanevi seriye ulaştın.',
        shellClass: 'bg-gradient-to-br from-[#2a0f12]/92 via-[#4a141a]/90 to-[#1f0b0f]/94',
        cardClass: 'bg-gradient-to-br from-[#5a151e]/90 via-[#8f1f2c]/88 to-[#341015]/92',
        accentHex: '#fb7185'
    },
    200: {
        badge: '200 Day Milestone',
        title: 'Double Century',
        subtitle: 'Tebrikler. İstikrarın artık benchmark seviyesinde.',
        shellClass: 'bg-gradient-to-br from-[#0f1e2b]/92 via-[#163347]/90 to-[#0d1823]/94',
        cardClass: 'bg-gradient-to-br from-[#173a52]/90 via-[#245f84]/88 to-[#102738]/92',
        accentHex: '#38bdf8'
    },
    250: {
        badge: '250 Day Milestone',
        title: 'Silver Surge',
        subtitle: 'Tebrikler. Bu uzun seri kalıcı bir iz bıraktı.',
        shellClass: 'bg-gradient-to-br from-[#151920]/92 via-[#222a36]/90 to-[#12151b]/94',
        cardClass: 'bg-gradient-to-br from-[#252f3d]/90 via-[#3f4f65]/88 to-[#1a222e]/92',
        accentHex: '#94a3b8'
    },
    300: {
        badge: '300 Day Milestone',
        title: 'Triple Orbit',
        subtitle: 'Tebrikler. Bu seri artık oyunun üstünde.',
        shellClass: 'bg-gradient-to-br from-[#142311]/92 via-[#21391b]/90 to-[#101b0d]/94',
        cardClass: 'bg-gradient-to-br from-[#223f1b]/90 via-[#3a6a2f]/88 to-[#162b12]/92',
        accentHex: '#84cc16'
    },
    350: {
        badge: '350 Day Milestone',
        title: 'Titan Run',
        subtitle: 'Tebrikler. Tarihî bir seri seviyesine çıktın.',
        shellClass: 'bg-gradient-to-br from-[#2c1b0f]/92 via-[#4d2a14]/90 to-[#1f130b]/94',
        cardClass: 'bg-gradient-to-br from-[#5c3218]/90 via-[#934d1b]/88 to-[#321c0f]/92',
        accentHex: '#fb923c'
    }
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.trim().replace('#', '');
    const expanded = normalized.length === 3
        ? normalized.split('').map((ch) => ch + ch).join('')
        : normalized;

    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
        return `rgba(138,154,91,${alpha})`;
    }

    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

export const StreakCelebration: React.FC<StreakCelebrationProps> = ({ event, onComplete }) => {
    const { language } = useLanguage();
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        setDismissed(false);
    }, [event.day]);

    if (dismissed) return null;

    const handleClose = () => {
        setDismissed(true);
        onComplete();
    };

    const theme = MILESTONE_THEMES[event.day] || DEFAULT_THEME;
    const themeCopy = STREAK_THEME_COPY[language][event.day] || STREAK_THEME_COPY[language].default;
    const surfaceCopy = STREAK_SURFACE_COPY[language];

    const cardStyle: CSSProperties = {
        borderColor: hexToRgba(theme.accentHex, 0.42),
        boxShadow: `0 28px 92px rgba(0,0,0,0.62), 0 0 0 1px ${hexToRgba(theme.accentHex, 0.24)} inset`
    };
    const accentLineStyle: CSSProperties = {
        background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(theme.accentHex, 0.9)} 50%, transparent 100%)`
    };
    const dayStyle: CSSProperties = {
        color: theme.accentHex
    };
    const pulseStyle: CSSProperties = {
        boxShadow: `0 0 0 2px ${hexToRgba(theme.accentHex, 0.36)} inset, 0 0 48px ${hexToRgba(theme.accentHex, 0.45)}`
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-auto overflow-hidden">
            <div className={`absolute inset-0 pointer-events-none ${theme.shellClass}`} />

            <div
                className={`relative z-10 mx-4 w-[min(92vw,560px)] rounded-[28px] border px-8 py-8 text-center backdrop-blur-md ${theme.cardClass}`}
                style={cardStyle}
            >
                <div className="mx-auto mb-5 h-[2px] w-28" style={accentLineStyle} />

                <p className="mb-2 text-[10px] font-semibold tracking-[0.34em] uppercase text-[#f5f5f4]/65">
                    {themeCopy.badge}
                </p>

                <h2 className="text-2xl md:text-4xl font-bold tracking-[0.18em] uppercase text-[#f8fafc]">
                    {themeCopy.title}
                </h2>

                <div className="mt-4 mb-5 inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/20 px-5 py-2">
                    <span className="text-[11px] tracking-[0.22em] uppercase text-white/70">{surfaceCopy.dayLabel}</span>
                    <span className="text-2xl md:text-3xl font-bold tracking-tight" style={dayStyle}>
                        {event.day}
                    </span>
                </div>

                <p className="text-sm md:text-base font-medium text-[#f1f5f9]/90">
                    {themeCopy.subtitle}
                </p>

                <p className="mt-2 text-[11px] tracking-[0.26em] uppercase text-[#f8fafc]/60">
                    {surfaceCopy.completed}
                </p>

                <button
                    type="button"
                    onClick={handleClose}
                    className="relative z-20 mt-7 inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-white hover:bg-white/15 transition-colors"
                >
                    {surfaceCopy.action}
                </button>

                <div className="pointer-events-none absolute -inset-5 rounded-[34px]" style={pulseStyle} />
            </div>
        </div>
    );
};
