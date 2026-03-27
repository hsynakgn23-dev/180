import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IapPlan } from '../lib/useSubscription';

// ── Types ────────────────────────────────────────────────
type Plan = {
  key: IapPlan;
  label: string;
  price: string;
  period: string;
  badge?: string;
  accent: string;
};

const PLANS: Plan[] = [
  {
    key: 'monthly',
    label: 'Aylık',
    price: '$0.99',
    period: 'ay',
    accent: '#8A9A5B',
  },
  {
    key: 'annual',
    label: 'Yıllık',
    price: '$9.99',
    period: 'yıl',
    badge: '2 AY BEDAVA',
    accent: '#A57164',
  },
  {
    key: 'supporter',
    label: 'Destekçi',
    price: '$19.99',
    period: 'tek seferlik',
    badge: '❤️ DESTEK',
    accent: '#B8860B',
  },
];

const BENEFITS = [
  { icon: 'ban-outline' as const,        text: 'Reklam yok' },
  { icon: 'infinite-outline' as const,   text: 'Sınırsız soru cevaplama' },
  { icon: 'shield-checkmark' as const,   text: '2× haftalık streak koruma' },
  { icon: 'star' as const,               text: 'Profilde premium rozet' },
  { icon: 'sparkles-outline' as const,   text: 'Özel görsel animasyonlar' },
  { icon: 'film-outline' as const,       text: 'Daha fazla marka erişimi' },
];

// ── Animated benefit row ─────────────────────────────────
const BenefitRow = ({ icon, text, delay }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; delay: number }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={[pw.benefitRow, { opacity, transform: [{ translateY }] }]}>
      <View style={pw.benefitIconWrap}>
        <Ionicons name={icon} size={16} color="#8A9A5B" />
      </View>
      <Text style={pw.benefitText}>{text}</Text>
    </Animated.View>
  );
};

// ── Plan card ────────────────────────────────────────────
const PlanCard = ({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  return (
    <Pressable onPress={onSelect} onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
      <Animated.View style={[pw.planCard, selected && { borderColor: plan.accent, backgroundColor: 'rgba(255,255,255,0.05)' }, { transform: [{ scale }] }]}>
        {plan.badge && (
          <View style={[pw.planBadge, { backgroundColor: plan.accent }]}>
            <Text style={pw.planBadgeText}>{plan.badge}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={pw.planLabel}>{plan.label}</Text>
          <Text style={pw.planPeriod}>/ {plan.period}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[pw.planPrice, selected && { color: plan.accent }]}>{plan.price}</Text>
        </View>
        <View style={[pw.planRadio, selected && { borderColor: plan.accent }]}>
          {selected && <View style={[pw.planRadioDot, { backgroundColor: plan.accent }]} />}
        </View>
      </Animated.View>
    </Pressable>
  );
};

// ── PaywallModal ─────────────────────────────────────────
export const PaywallModal = ({
  visible,
  onClose,
  onPurchase,
  onRestore,
  purchasing,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onPurchase: (plan: IapPlan) => void;
  onRestore: () => void;
  purchasing: boolean;
  error: string | null;
}) => {
  const [selected, setSelected] = useState<IapPlan>('annual');
  const shineAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, { toValue: 400, duration: 2200, delay: 800, useNativeDriver: true }),
        Animated.timing(shineAnim, { toValue: -200, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, shineAnim]);

  const selectedPlan = PLANS.find(p => p.key === selected)!;

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={pw.container}>
        {/* Close */}
        <Pressable style={pw.closeBtn} onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Ionicons name="close" size={22} color="#8e8b84" />
        </Pressable>

        <ScrollView contentContainerStyle={pw.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={pw.hero}>
            <View style={pw.crownWrap}>
              <Ionicons name="star" size={32} color="#B8860B" />
              {/* shine sweep */}
              <Animated.View style={[pw.shine, { transform: [{ translateX: shineAnim }] }]} />
            </View>
            <Text style={pw.heroTitle}>180 Premium</Text>
            <Text style={pw.heroSub}>Sinema deneyimini üst seviyeye taşı</Text>
          </View>

          {/* Benefits */}
          <View style={pw.benefitsWrap}>
            {BENEFITS.map((b, i) => (
              <BenefitRow key={b.text} icon={b.icon} text={b.text} delay={i * 60} />
            ))}
          </View>

          {/* Divider */}
          <View style={pw.divider} />

          {/* Plans */}
          <Text style={pw.sectionLabel}>Plan seç</Text>
          <View style={{ gap: 10 }}>
            {PLANS.map(plan => (
              <PlanCard key={plan.key} plan={plan} selected={selected === plan.key} onSelect={() => setSelected(plan.key)} />
            ))}
          </View>

          {error && <Text style={pw.errorText}>{error}</Text>}

          {/* CTA */}
          <Pressable
            style={[pw.ctaBtn, { backgroundColor: selectedPlan.accent }, purchasing && { opacity: 0.6 }]}
            onPress={() => !purchasing && onPurchase(selected)}
            disabled={purchasing}
            accessibilityRole="button"
          >
            <Text style={pw.ctaBtnText}>
              {purchasing ? 'İşleniyor...' : `${selectedPlan.price} ile başla`}
            </Text>
          </Pressable>

          {/* Restore */}
          <Pressable onPress={onRestore} style={pw.restoreBtn} accessibilityRole="button">
            <Text style={pw.restoreText}>Satın alımları geri yükle</Text>
          </Pressable>

          <Text style={pw.legalText}>
            Abonelik, seçilen plan fiyatı üzerinden App Store hesabınızdan tahsil edilir. Yenileme, mevcut dönem bitmeden en az 24 saat önce iptal edilmezse otomatik olarak gerçekleşir.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ── Styles ───────────────────────────────────────────────
const pw = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
  },
  crownWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(184,134,11,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(184,134,11,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 0,
    width: 30,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-20deg' }],
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f5f0e8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: '#8e8b84',
    textAlign: 'center',
  },
  benefitsWrap: {
    gap: 10,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(138,154,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#d4cfc7',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8b84',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
    gap: 12,
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f5f0e8',
  },
  planPeriod: {
    fontSize: 12,
    color: '#8e8b84',
    marginTop: 1,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f5f0e8',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  ctaBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  restoreText: {
    fontSize: 13,
    color: '#8e8b84',
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    color: '#5a5750',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
