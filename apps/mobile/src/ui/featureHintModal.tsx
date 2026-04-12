import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { FeatureHintKey } from '../lib/mobileFeatureTour';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HintLanguage = 'tr' | 'en' | 'es' | 'fr';

type HintContent = {
  eyebrow: string;
  title: string;
  body: string;
  highlights: string[];
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
  dismiss: string;
};

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const COPY: Record<HintLanguage, Record<FeatureHintKey, HintContent>> = {
  tr: {
    daily: {
      eyebrow: 'GUNLUK FILM',
      title: 'Her gün 5 film gelir. Birini seç, görüşünü bırak.',
      body: 'Ana ekranda o güne ait 5 film sıralanır. Beğendiğini seçip 180 karakterlik yorumunu yaz. Diğer izleyicilerin neler düşündüğünü de orada görebilirsin.',
      highlights: ['5 günlük film', '180 karakter', 'Topluluk yorumları'],
      accent: '#A57164',
      icon: 'film-outline',
      dismiss: 'Anladım',
    },
    quiz: {
      eyebrow: 'QUIZ',
      title: 'Seçtiğin filmin sorularını yanıtla, XP kazan.',
      body: 'Bu ekranda günlük filmlere ait soruları çözebilirsin. Her doğru yanıt XP kazandırır. Rush modunda süre baskısı altında daha fazla puan elde edebilirsin.',
      highlights: ['Günlük sorular', 'XP kazan', 'Rush modu'],
      accent: '#8A9A5B',
      icon: 'flash-outline',
      dismiss: 'Anladım',
    },
    arena: {
      eyebrow: 'LIG',
      title: 'Kazandığın XP seni liglerde yukarı taşır.',
      body: 'Haftalık sıralamayı ve kendi konumunu buradan görebilirsin. İyi bir hafta geçirirsen bir üst lige çıkarsın; kötü geçirirsen düşebilirsin.',
      highlights: ['Haftalık sıralama', 'Lig atlama', 'Rakipler'],
      accent: '#B68B4C',
      icon: 'trophy-outline',
      dismiss: 'Anladım',
    },
    streak: {
      eyebrow: 'STREAK',
      title: 'Her gün geri gel, serini büyüt.',
      body: 'Uygulamaya her gün girip yorum bıraktığında serin bir gün daha uzar. Seriyi kırma — profil sayfandan kaç günlük olduğunu takip edebilirsin.',
      highlights: ['Günlük giriş', 'Seri sayacı', 'Profilde görünür'],
      accent: '#e07842',
      icon: 'flame-outline',
      dismiss: 'Anladım',
    },
  },
  en: {
    daily: {
      eyebrow: 'DAILY FILM',
      title: 'Five films arrive every day. Pick one, leave your take.',
      body: 'The home screen shows five films for the day. Choose one and write a 180-character note. You can also read what others think right there.',
      highlights: ['5 daily films', '180-char note', 'Community feed'],
      accent: '#A57164',
      icon: 'film-outline',
      dismiss: 'Got it',
    },
    quiz: {
      eyebrow: 'QUIZ',
      title: "Answer today's film questions and earn XP.",
      body: 'This screen has questions about the daily films. Every correct answer earns XP. Rush mode adds a timer for even more points.',
      highlights: ['Daily questions', 'Earn XP', 'Rush mode'],
      accent: '#8A9A5B',
      icon: 'flash-outline',
      dismiss: 'Got it',
    },
    arena: {
      eyebrow: 'LEAGUE',
      title: 'Your XP moves you up the league table.',
      body: 'Check the weekly leaderboard and your rank here. A good week moves you up a league; a quiet week can drop you back down.',
      highlights: ['Weekly rank', 'League promotion', 'Rivals'],
      accent: '#B68B4C',
      icon: 'trophy-outline',
      dismiss: 'Got it',
    },
    streak: {
      eyebrow: 'STREAK',
      title: 'Keep coming back. Your streak grows.',
      body: 'Every day you open the app and leave a note adds to your streak. Do not break it — check your profile page to see how many days you are at.',
      highlights: ['Daily check-in', 'Streak counter', 'Profile badge'],
      accent: '#e07842',
      icon: 'flame-outline',
      dismiss: 'Got it',
    },
  },
  es: {
    daily: {
      eyebrow: 'PELICULA DEL DIA',
      title: 'Cada dia llegan 5 peliculas. Elige una y deja tu opinion.',
      body: 'La pantalla principal muestra 5 peliculas del dia. Elige una y escribe tu nota de 180 caracteres. Tambien puedes leer lo que piensan otros.',
      highlights: ['5 peliculas diarias', 'Nota de 180 chars', 'Feed comunidad'],
      accent: '#A57164',
      icon: 'film-outline',
      dismiss: 'Entendido',
    },
    quiz: {
      eyebrow: 'QUIZ',
      title: 'Responde las preguntas del dia y gana XP.',
      body: 'Esta pantalla tiene preguntas sobre las peliculas del dia. Cada respuesta correcta da XP. El modo Rush agrega tiempo limite para mas puntos.',
      highlights: ['Preguntas diarias', 'Gana XP', 'Modo Rush'],
      accent: '#8A9A5B',
      icon: 'flash-outline',
      dismiss: 'Entendido',
    },
    arena: {
      eyebrow: 'LIGA',
      title: 'Tu XP te sube en la tabla de ligas.',
      body: 'Ve el ranking semanal y tu posicion aqui. Una buena semana te sube de liga; una semana tranquila puede bajarte.',
      highlights: ['Ranking semanal', 'Ascenso de liga', 'Rivales'],
      accent: '#B68B4C',
      icon: 'trophy-outline',
      dismiss: 'Entendido',
    },
    streak: {
      eyebrow: 'RACHA',
      title: 'Vuelve cada dia. Tu racha crece.',
      body: 'Cada dia que abres la app y dejas una nota suma a tu racha. No la rompas. Revisa tu perfil para ver cuantos dias llevas.',
      highlights: ['Entrada diaria', 'Contador de racha', 'Insignia en perfil'],
      accent: '#e07842',
      icon: 'flame-outline',
      dismiss: 'Entendido',
    },
  },
  fr: {
    daily: {
      eyebrow: 'FILM DU JOUR',
      title: 'Cinq films arrivent chaque jour. Choisis-en un et laisse ton avis.',
      body: "L'ecran principal affiche 5 films du jour. Choisis-en un et ecris une note de 180 caracteres. Tu peux aussi lire ce que pensent les autres.",
      highlights: ['5 films par jour', 'Note de 180 chars', 'Fil communautaire'],
      accent: '#A57164',
      icon: 'film-outline',
      dismiss: 'Compris',
    },
    quiz: {
      eyebrow: 'QUIZ',
      title: 'Reponds aux questions du jour et gagne des XP.',
      body: "Cet ecran contient des questions sur les films du jour. Chaque bonne reponse rapporte des XP. Le mode Rush ajoute une contrainte de temps pour encore plus de points.",
      highlights: ['Questions du jour', 'Gagne des XP', 'Mode Rush'],
      accent: '#8A9A5B',
      icon: 'flash-outline',
      dismiss: 'Compris',
    },
    arena: {
      eyebrow: 'LIGUE',
      title: 'Tes XP te font monter dans les ligues.',
      body: "Consulte le classement hebdomadaire et ta position ici. Une bonne semaine te fait monter de ligue; une semaine calme peut te faire descendre.",
      highlights: ['Classement hebdo', 'Promotion de ligue', 'Rivaux'],
      accent: '#B68B4C',
      icon: 'trophy-outline',
      dismiss: 'Compris',
    },
    streak: {
      eyebrow: 'SERIE',
      title: 'Reviens chaque jour. Ta serie grandit.',
      body: "Chaque jour ou tu ouvres l'app et laisses une note, ta serie s'allonge. Ne la brise pas. Consulte ton profil pour voir combien de jours tu as enchaines.",
      highlights: ['Connexion quotidienne', 'Compteur de serie', 'Badge sur le profil'],
      accent: '#e07842',
      icon: 'flame-outline',
      dismiss: 'Compris',
    },
  },
};

const resolveCopy = (language: HintLanguage, feature: FeatureHintKey): HintContent =>
  (COPY[language] ?? COPY.en)[feature];

// ---------------------------------------------------------------------------
// Animated icon
// ---------------------------------------------------------------------------

const HintIcon = ({ icon, accent }: { icon: keyof typeof Ionicons.glyphMap; accent: string }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  const ring = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 10,
      bounciness: 14,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1.2, duration: 950, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0.8, duration: 950, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, ring]);

  return (
    <View style={iconStyles.wrapper}>
      <Animated.View
        style={[
          iconStyles.ring,
          { borderColor: accent, transform: [{ scale: ring }] },
        ]}
      />
      <Animated.View
        style={[
          iconStyles.disc,
          {
            backgroundColor: `${accent}1a`,
            borderColor: `${accent}44`,
            transform: [{ scale }],
          },
        ]}
      >
        <Ionicons name={icon} size={40} color={accent} />
      </Animated.View>
    </View>
  );
};

const iconStyles = StyleSheet.create({
  wrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    opacity: 0.22,
  },
  disc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type FeatureHintModalProps = {
  feature: FeatureHintKey | null;
  language?: HintLanguage;
  onDismiss: () => void;
};

export const FeatureHintModal = ({
  feature,
  language = 'tr',
  onDismiss,
}: FeatureHintModalProps) => {
  const slideY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!feature) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }
    slideY.setValue(300);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        speed: 14,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [feature, slideY, backdropOpacity]);

  if (!feature) return null;

  const hint = resolveCopy(language, feature);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[hintStyles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="none"
      />
      <Pressable style={hintStyles.backdropTap} onPress={onDismiss} />

      {/* Card */}
      <Animated.View
        style={[hintStyles.card, { transform: [{ translateY: slideY }] }]}
      >
        {/* Top row: icon + eyebrow */}
        <View style={hintStyles.topRow}>
          <HintIcon icon={hint.icon} accent={hint.accent} />
          <View style={hintStyles.eyebrowCol}>
            <View style={[hintStyles.eyebrowPill, { borderColor: `${hint.accent}44`, backgroundColor: `${hint.accent}14` }]}>
              <Text style={[hintStyles.eyebrowText, { color: hint.accent }]}>{hint.eyebrow}</Text>
            </View>
          </View>
        </View>

        <Text style={hintStyles.title}>{hint.title}</Text>
        <Text style={hintStyles.body}>{hint.body}</Text>

        {/* Highlight pills */}
        <View style={hintStyles.highlights}>
          {hint.highlights.map((hl) => (
            <View
              key={hl}
              style={[hintStyles.pill, { borderColor: `${hint.accent}33` }]}
            >
              <View style={[hintStyles.pillDot, { backgroundColor: hint.accent }]} />
              <Text style={hintStyles.pillText}>{hl}</Text>
            </View>
          ))}
        </View>

        {/* Dismiss button */}
        <Pressable
          style={({ pressed }) => [
            hintStyles.dismissBtn,
            { backgroundColor: hint.accent, opacity: pressed ? 0.82 : 1 },
          ]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={hint.dismiss}
        >
          <Text style={hintStyles.dismissText}>{hint.dismiss}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const hintStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131210',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  eyebrowCol: {
    flex: 1,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#f2ede7',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 10,
  },
  body: {
    color: '#a09890',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    color: '#ccc5bb',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
