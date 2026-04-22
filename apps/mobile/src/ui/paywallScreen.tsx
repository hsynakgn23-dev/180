import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from 'expo-iap';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IAP_PRODUCTS, type IapPlan, type SubscriptionTier } from '../lib/useSubscription';
import { MOBILE_THEME } from './theme';

type Plan = {
  key: IapPlan;
  label: string;
  price: string;
  period: string;
  badge?: string;
  accent: string;
  summary: string;
  detail: string;
  meta: string;
};

type Benefit = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
};

type HeroStat = {
  value: string;
  label: string;
};

const SAGE = MOBILE_THEME.color.buttonBrandBg;
const CLAY = MOBILE_THEME.color.buttonTealBg;
const TEXT_PRIMARY = MOBILE_THEME.color.textPrimary;
const TEXT_MUTED = MOBILE_THEME.color.textMuted;
const SURFACE = 'rgba(23, 23, 23, 0.88)';
const SURFACE_ELEVATED = 'rgba(31, 31, 31, 0.72)';
const BORDER = 'rgba(255, 255, 255, 0.1)';
const BORDER_SOFT = 'rgba(255, 255, 255, 0.08)';

const PLAN_FALLBACKS: Plan[] = [
  {
    key: 'monthly',
    label: 'Aylık',
    price: '$0.99',
    period: 'aylık yenilenir',
    accent: SAGE,
    summary: 'Esnek başlangıç',
    detail: 'İstediğin zaman çık.',
    meta: 'Reklamsız + limitsiz',
  },
  {
    key: 'annual',
    label: 'Yıllık',
    price: '$9.99',
    period: '12 ay',
    badge: 'EN İYİ',
    accent: CLAY,
    summary: 'En iyi fiyat',
    detail: 'En dengeli seçim.',
    meta: 'Yaklaşık $0.83 / ay',
  },
  {
    key: 'supporter',
    label: 'Destekçi',
    price: '$19.99',
    period: 'tek seferlik',
    badge: 'DESTEK',
    accent: TEXT_MUTED,
    summary: 'Destek paketi',
    detail: 'Tek ödeme ile projeyi destekle.',
    meta: 'Kalıcı destek paketi',
  },
];

const BENEFITS: Benefit[] = [
  {
    icon: 'sparkles-outline',
    title: 'Reklamsız akış',
    body: 'Daha temiz kullanım.',
  },
  {
    icon: 'infinite-outline',
    title: 'Limitsiz quiz',
    body: 'Günlük sınır kalkar.',
  },
  {
    icon: 'ribbon-outline',
    title: 'Rozet ve koruma',
    body: 'Profil rozeti ve ekstra koruma.',
  },
];

const HERO_STATS: HeroStat[] = [
  { value: 'INF', label: 'Quiz' },
  { value: '0', label: 'Reklam' },
  { value: '2X', label: 'Streak' },
];

const HeroStatChip = ({ item }: { item: HeroStat }) => (
  <View style={pw.heroStatChip}>
    <Text style={pw.heroStatValue}>{item.value}</Text>
    <Text style={pw.heroStatLabel}>{item.label}</Text>
  </View>
);

const BenefitRow = ({
  item,
  delay,
}: {
  item: Benefit;
  delay: number;
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        pw.benefitRow,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={pw.benefitIconWrap}>
        <Ionicons name={item.icon} size={18} color={SAGE} />
      </View>
      <View style={pw.benefitCopy}>
        <Text style={pw.benefitTitle}>{item.title}</Text>
        <Text style={pw.benefitBody}>{item.body}</Text>
      </View>
    </Animated.View>
  );
};

const PlanCard = ({
  plan,
  selected,
  active,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.985,
      useNativeDriver: true,
      speed: 32,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 3,
    }).start();
  };

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <Animated.View
        style={[
          pw.planCard,
          selected
            ? {
                borderColor: plan.accent,
                backgroundColor:
                  plan.key === 'annual'
                    ? 'rgba(165, 113, 100, 0.14)'
                    : plan.key === 'monthly'
                      ? 'rgba(138, 154, 91, 0.14)'
                      : 'rgba(255, 255, 255, 0.08)',
              }
            : null,
          { transform: [{ scale }] },
        ]}
      >
        <View style={[pw.planAccentRail, { backgroundColor: plan.accent }]} />

        {plan.badge || active ? (
          <View style={pw.planBadgeRow}>
            <View style={pw.planBadgeStack}>
              {plan.badge ? (
                <View style={[pw.planBadge, { backgroundColor: plan.accent }]}>
                  <Text style={pw.planBadgeText}>{plan.badge}</Text>
                </View>
              ) : null}
            </View>
            {active ? (
              <View style={[pw.planStatePill, { borderColor: plan.accent }]}>
                <Text style={[pw.planStatePillText, { color: plan.accent }]}>AKTIF</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={pw.planHeaderRow}>
          <View style={pw.planTitleBlock}>
            <Text style={pw.planLabel}>{plan.label}</Text>
            <Text style={pw.planSummary}>{plan.summary}</Text>
          </View>
          <View style={pw.planPriceBlock}>
            <Text style={[pw.planPrice, selected ? { color: plan.accent } : null]}>
              {plan.price}
            </Text>
            <Text style={pw.planPeriod}>{plan.period}</Text>
          </View>
        </View>

        <View style={pw.planFooterRow}>
          <View style={pw.planInfoStack}>
            <Text style={pw.planDetail}>{plan.detail}</Text>
            <Text style={pw.planMeta}>{plan.meta}</Text>
          </View>
          <View style={[pw.planRadio, selected ? { borderColor: plan.accent } : null]}>
            {selected ? <View style={[pw.planRadioDot, { backgroundColor: plan.accent }]} /> : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

type PaywallLanguage = 'tr' | 'en' | 'es' | 'fr';

const PAYWALL_LEGAL_COPY: Record<PaywallLanguage, {
  oneTimeLegal: string;
  subscriptionLegalYear: (price: string) => string;
  subscriptionLegalMonth: (price: string) => string;
  webPreview: string;
  plansLoading: string;
  currentPlanActive: string;
  privacyPolicy: string;
  termsOfService: string;
  restorePurchases: string;
  planLabels: { monthly: string; annual: string; supporter: string };
  planSummaries: { monthly: string; annual: string; supporter: string };
  planDetails: { monthly: string; annual: string; supporter: string };
  planMetas: { monthly: string; annual: string; supporter: string };
  planPeriods: { monthly: string; annual: string; supporter: string };
  planBadgeAnnual: string;
  planBadgeSupporter: string;
  ctaPay: string;
  ctaProcessing: string;
  ctaLoadingPlans: string;
  ctaActivePlan: string;
  ctaSwitchPlan: string;
  subscriptionOptional: string;
}> = {
  tr: {
    oneTimeLegal: 'Tek seferlik ödemedir. Yenilenmez.',
    subscriptionLegalYear: (price) =>
      Platform.OS === 'ios'
        ? `Abonelik ${price} / yıl olarak yenilenir. Ödeme iTunes hesabınızdan alınır. Abonelik dönem sonu otomatik yenilenir. Yenilemeyi iptal etmek için App Store > Hesap > Abonelikler yolunu izleyebilirsiniz. İptal en az 24 saat öncesinden yapılmalıdır. Uygulama abonelik olmadan da kullanılabilir.`
        : `Abonelik ${price} / yıl olarak yenilenir. Ödeme Google Play hesabınızdan alınır. Abonelik dönem sonu otomatik yenilenir. Yenilemeyi iptal etmek için Google Play > Abonelikler > 180 Absolute Cinema > İptal Et yolunu izleyebilirsiniz. İptal en az 24 saat öncesinden yapılmalıdır. Uygulama abonelik olmadan da kullanılabilir.`,
    subscriptionLegalMonth: (price) =>
      Platform.OS === 'ios'
        ? `Abonelik ${price} / ay olarak yenilenir. Ödeme iTunes hesabınızdan alınır. Abonelik dönem sonu otomatik yenilenir. Yenilemeyi iptal etmek için App Store > Hesap > Abonelikler yolunu izleyebilirsiniz. İptal en az 24 saat öncesinden yapılmalıdır. Uygulama abonelik olmadan da kullanılabilir.`
        : `Abonelik ${price} / ay olarak yenilenir. Ödeme Google Play hesabınızdan alınır. Abonelik dönem sonu otomatik yenilenir. Yenilemeyi iptal etmek için Google Play > Abonelikler > 180 Absolute Cinema > İptal Et yolunu izleyebilirsiniz. İptal en az 24 saat öncesinden yapılmalıdır. Uygulama abonelik olmadan da kullanılabilir.`,
    webPreview: 'Web önizleme. Satın alma mobilde çalışır.',
    plansLoading: 'Planlar hazırlanıyor. Fiyatlar yüklenince satın alma açılacak.',
    currentPlanActive: 'Bu plan hesabında zaten açık.',
    privacyPolicy: 'Gizlilik Politikası',
    termsOfService: 'Kullanım Koşulları',
    restorePurchases: 'Satın alımları geri yükle',
    planLabels: { monthly: 'Aylık', annual: 'Yıllık', supporter: 'Destekçi' },
    planSummaries: { monthly: 'Esnek başlangıç', annual: 'En iyi fiyat', supporter: 'Destek paketi' },
    planDetails: { monthly: 'İstediğin zaman çık.', annual: 'En dengeli seçim.', supporter: 'Tek ödeme ile projeyi destekle.' },
    planMetas: { monthly: 'Reklamsız + limitsiz', annual: 'Yaklaşık $0.83 / ay', supporter: 'Kalıcı destek paketi' },
    planPeriods: { monthly: 'aylık yenilenir', annual: 'yıllık yenilenir', supporter: 'tek seferlik' },
    planBadgeAnnual: 'EN İYİ',
    planBadgeSupporter: 'DESTEK',
    ctaPay: 'Ödemeyi yap',
    ctaProcessing: 'İşleniyor...',
    ctaLoadingPlans: 'Planlar yükleniyor...',
    ctaActivePlan: 'Aktif plan',
    ctaSwitchPlan: 'Bu plana geç',
    subscriptionOptional: 'Abonelik zorunlu değildir — uygulama ücretsiz de kullanılabilir.',
  },
  en: {
    oneTimeLegal: 'One-time payment. Does not renew.',
    subscriptionLegalYear: (price) =>
      Platform.OS === 'ios'
        ? `Subscription renews at ${price}/year. Payment is charged to your iTunes Account. Subscription auto-renews at the end of each period. To cancel, go to App Store > Account > Subscriptions. Cancellation must be made at least 24 hours before the end of the current period. The app can be used without a subscription.`
        : `Subscription renews at ${price}/year. Payment is charged to your Google Play account. Subscription auto-renews at the end of each period. To cancel, go to Google Play > Subscriptions > 180 Absolute Cinema > Cancel. Cancellation must be made at least 24 hours before the end of the current period. The app can be used without a subscription.`,
    subscriptionLegalMonth: (price) =>
      Platform.OS === 'ios'
        ? `Subscription renews at ${price}/month. Payment is charged to your iTunes Account. Subscription auto-renews at the end of each period. To cancel, go to App Store > Account > Subscriptions. Cancellation must be made at least 24 hours before the end of the current period. The app can be used without a subscription.`
        : `Subscription renews at ${price}/month. Payment is charged to your Google Play account. Subscription auto-renews at the end of each period. To cancel, go to Google Play > Subscriptions > 180 Absolute Cinema > Cancel. Cancellation must be made at least 24 hours before the end of the current period. The app can be used without a subscription.`,
    webPreview: 'Web preview. Purchases work on mobile.',
    plansLoading: 'Loading plans. Purchase will be available once prices load.',
    currentPlanActive: 'This plan is already active on your account.',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    restorePurchases: 'Restore purchases',
    planLabels: { monthly: 'Monthly', annual: 'Annual', supporter: 'Supporter' },
    planSummaries: { monthly: 'Flexible start', annual: 'Best value', supporter: 'Support pack' },
    planDetails: { monthly: 'Cancel anytime.', annual: 'Most balanced choice.', supporter: 'Support the project with a single payment.' },
    planMetas: { monthly: 'Ad-free + unlimited', annual: 'About $0.83 / month', supporter: 'Permanent support pack' },
    planPeriods: { monthly: 'renews monthly', annual: 'renews annually', supporter: 'one-time' },
    planBadgeAnnual: 'BEST',
    planBadgeSupporter: 'SUPPORT',
    ctaPay: 'Subscribe',
    ctaProcessing: 'Processing...',
    ctaLoadingPlans: 'Loading plans...',
    ctaActivePlan: 'Active plan',
    ctaSwitchPlan: 'Switch to this plan',
    subscriptionOptional: 'Subscription is optional — the app is free to use without one.',
  },
  es: {
    oneTimeLegal: 'Pago único. No se renueva.',
    subscriptionLegalYear: (price) =>
      Platform.OS === 'ios'
        ? `La suscripción se renueva a ${price}/año. El pago se cobra en tu cuenta de iTunes. La suscripción se renueva automáticamente al final de cada período. Para cancelar, ve a App Store > Cuenta > Suscripciones. La cancelación debe realizarse al menos 24 horas antes del final del período actual. La app puede usarse sin suscripción.`
        : `La suscripción se renueva a ${price}/año. El pago se cobra en tu cuenta de Google Play. La suscripción se renueva automáticamente al final de cada período. Para cancelar, ve a Google Play > Suscripciones > 180 Absolute Cinema > Cancelar. La cancelación debe realizarse al menos 24 horas antes del final del período actual. La app puede usarse sin suscripción.`,
    subscriptionLegalMonth: (price) =>
      Platform.OS === 'ios'
        ? `La suscripción se renueva a ${price}/mes. El pago se cobra en tu cuenta de iTunes. La suscripción se renueva automáticamente al final de cada período. Para cancelar, ve a App Store > Cuenta > Suscripciones. La cancelación debe realizarse al menos 24 horas antes del final del período actual. La app puede usarse sin suscripción.`
        : `La suscripción se renueva a ${price}/mes. El pago se cobra en tu cuenta de Google Play. La suscripción se renueva automáticamente al final de cada período. Para cancelar, ve a Google Play > Suscripciones > 180 Absolute Cinema > Cancelar. La cancelación debe realizarse al menos 24 horas antes del final del período actual. La app puede usarse sin suscripción.`,
    webPreview: 'Vista previa web. Las compras funcionan en el móvil.',
    plansLoading: 'Cargando planes. La compra estará disponible cuando se carguen los precios.',
    currentPlanActive: 'Este plan ya está activo en tu cuenta.',
    privacyPolicy: 'Política de Privacidad',
    termsOfService: 'Términos de Servicio',
    restorePurchases: 'Restaurar compras',
    planLabels: { monthly: 'Mensual', annual: 'Anual', supporter: 'Patrocinador' },
    planSummaries: { monthly: 'Inicio flexible', annual: 'Mejor precio', supporter: 'Paquete de apoyo' },
    planDetails: { monthly: 'Cancela cuando quieras.', annual: 'La elección más equilibrada.', supporter: 'Apoya el proyecto con un único pago.' },
    planMetas: { monthly: 'Sin anuncios + ilimitado', annual: 'Aprox. $0.83 / mes', supporter: 'Paquete de apoyo permanente' },
    planPeriods: { monthly: 'se renueva mensualmente', annual: 'se renueva anualmente', supporter: 'pago único' },
    planBadgeAnnual: 'MEJOR',
    planBadgeSupporter: 'APOYO',
    ctaPay: 'Suscribirse',
    ctaProcessing: 'Procesando...',
    ctaLoadingPlans: 'Cargando planes...',
    ctaActivePlan: 'Plan activo',
    ctaSwitchPlan: 'Cambiar a este plan',
    subscriptionOptional: 'La suscripción es opcional — la app se puede usar gratis.',
  },
  fr: {
    oneTimeLegal: 'Paiement unique. Ne se renouvelle pas.',
    subscriptionLegalYear: (price) =>
      Platform.OS === 'ios'
        ? `L'abonnement se renouvelle à ${price}/an. Le paiement est débité de votre compte iTunes. L'abonnement se renouvelle automatiquement à la fin de chaque période. Pour annuler, allez dans App Store > Compte > Abonnements. L'annulation doit être effectuée au moins 24 heures avant la fin de la période en cours. L'application peut être utilisée sans abonnement.`
        : `L'abonnement se renouvelle à ${price}/an. Le paiement est débité de votre compte Google Play. L'abonnement se renouvelle automatiquement à la fin de chaque période. Pour annuler, allez dans Google Play > Abonnements > 180 Absolute Cinema > Annuler. L'annulation doit être effectuée au moins 24 heures avant la fin de la période en cours. L'application peut être utilisée sans abonnement.`,
    subscriptionLegalMonth: (price) =>
      Platform.OS === 'ios'
        ? `L'abonnement se renouvelle à ${price}/mois. Le paiement est débité de votre compte iTunes. L'abonnement se renouvelle automatiquement à la fin de chaque période. Pour annuler, allez dans App Store > Compte > Abonnements. L'annulation doit être effectuée au moins 24 heures avant la fin de la période en cours. L'application peut être utilisée sans abonnement.`
        : `L'abonnement se renouvelle à ${price}/mois. Le paiement est débité de votre compte Google Play. L'abonnement se renouvelle automatiquement à la fin de chaque période. Pour annuler, allez dans Google Play > Abonnements > 180 Absolute Cinema > Annuler. L'annulation doit être effectuée au moins 24 heures avant la fin de la période en cours. L'application peut être utilisée sans abonnement.`,
    webPreview: 'Aperçu web. Les achats fonctionnent sur mobile.',
    plansLoading: "Chargement des plans. L'achat sera disponible une fois les prix chargés.",
    currentPlanActive: 'Ce plan est déjà actif sur votre compte.',
    privacyPolicy: 'Politique de Confidentialité',
    termsOfService: "Conditions d'Utilisation",
    restorePurchases: 'Restaurer les achats',
    planLabels: { monthly: 'Mensuel', annual: 'Annuel', supporter: 'Soutien' },
    planSummaries: { monthly: 'Démarrage flexible', annual: 'Meilleur prix', supporter: 'Pack de soutien' },
    planDetails: { monthly: 'Annulez à tout moment.', annual: 'Le choix le plus équilibré.', supporter: 'Soutenez le projet avec un paiement unique.' },
    planMetas: { monthly: 'Sans pub + illimité', annual: 'Environ $0.83 / mois', supporter: 'Pack de soutien permanent' },
    planPeriods: { monthly: 'renouvellement mensuel', annual: 'renouvellement annuel', supporter: 'paiement unique' },
    planBadgeAnnual: 'MEILLEUR',
    planBadgeSupporter: 'SOUTIEN',
    ctaPay: "S'abonner",
    ctaProcessing: 'Traitement...',
    ctaLoadingPlans: 'Chargement des plans...',
    ctaActivePlan: 'Plan actif',
    ctaSwitchPlan: 'Passer à ce plan',
    subscriptionOptional: "L'abonnement est facultatif — l'application est gratuite sans abonnement.",
  },
};

export const PaywallModal = ({
  visible,
  onClose,
  onPurchase,
  onRestore,
  products,
  currentTier,
  currentPlan,
  loading = false,
  purchasing,
  error,
  language = 'tr',
}: {
  visible: boolean;
  onClose: () => void;
  onPurchase: (plan: IapPlan) => void;
  onRestore?: () => void;
  products?: Product[];
  currentTier?: SubscriptionTier;
  currentPlan?: IapPlan | null;
  loading?: boolean;
  purchasing: boolean;
  error: string | null;
  language?: PaywallLanguage;
}) => {
  const [selected, setSelected] = useState<IapPlan>('annual');

  useEffect(() => {
    if (!visible) return;
    setSelected(currentPlan || 'annual');
  }, [currentPlan, visible]);

  const plans = useMemo(() => {
    const productMap = new Map<string, Product>();
    for (const product of products || []) {
      productMap.set(String(product.id || '').trim(), product);
    }

    return PLAN_FALLBACKS.map((plan) => {
      const product = productMap.get(IAP_PRODUCTS[plan.key]);
      const copy = PAYWALL_LEGAL_COPY[language] || PAYWALL_LEGAL_COPY.en;
      return {
        ...plan,
        label: copy.planLabels[plan.key],
        summary: copy.planSummaries[plan.key],
        detail: copy.planDetails[plan.key],
        meta: copy.planMetas[plan.key],
        badge: plan.key === 'annual' ? copy.planBadgeAnnual : plan.key === 'supporter' ? copy.planBadgeSupporter : plan.badge,
        price: String(product?.displayPrice || '').trim() || plan.price,
        period: copy.planPeriods[plan.key],
      };
    });
  }, [products, language]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selected) || plans[1] || PLAN_FALLBACKS[1],
    [plans, selected]
  );
  const activePlan = useMemo(
    () => plans.find((plan) => plan.key === currentPlan) || null,
    [currentPlan, plans]
  );

  const isWebPreview = Platform.OS === 'web';
  const isProductLoading = !isWebPreview && loading && (!products || products.length === 0);
  const hasActiveEntitlement = currentTier === 'premium' || currentTier === 'supporter';
  const selectedIsCurrentPlan = Boolean(currentPlan && selected === currentPlan);
  const purchaseDisabled = purchasing || isWebPreview || selectedIsCurrentPlan || isProductLoading;
  const legalCopy = PAYWALL_LEGAL_COPY[language] || PAYWALL_LEGAL_COPY.en;
  const paymentSummary = `${selectedPlan.label} • ${selectedPlan.price} • ${selectedPlan.period}`;
  const paymentLegal =
    selected === 'supporter'
      ? legalCopy.oneTimeLegal
      : selected === 'annual'
        ? legalCopy.subscriptionLegalYear(selectedPlan.price)
        : legalCopy.subscriptionLegalMonth(selectedPlan.price);
  const footerNote = isWebPreview
    ? legalCopy.webPreview
    : isProductLoading
      ? legalCopy.plansLoading
    : paymentLegal;
  const currentPlanLabel =
    activePlan?.label || (currentTier === 'supporter' ? legalCopy.planLabels.supporter : 'Premium');
  const currentPlanBody =
    currentTier === 'supporter'
      ? legalCopy.subscriptionOptional
      : legalCopy.subscriptionOptional;
  const effectiveFooterNote =
    !isWebPreview && selectedIsCurrentPlan
      ? legalCopy.currentPlanActive
      : footerNote;
  const effectiveCtaLabel = purchasing
    ? legalCopy.ctaProcessing
    : isProductLoading
      ? legalCopy.ctaLoadingPlans
    : selectedIsCurrentPlan
      ? legalCopy.ctaActivePlan
      : hasActiveEntitlement
        ? legalCopy.ctaSwitchPlan
        : legalCopy.ctaPay;

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={pw.container}>
        <Pressable
          style={({ pressed }) => [pw.closeBtn, pressed ? pw.closeBtnPressed : null]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Abonelik ekranını kapat"
        >
          <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
        </Pressable>

        <ScrollView
          contentContainerStyle={pw.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={pw.heroShell}>
            <View style={pw.heroRail}>
              <View style={[pw.heroRailLine, { backgroundColor: SAGE }]} />
              <View style={[pw.heroRailLine, { backgroundColor: CLAY }]} />
              <View style={pw.heroRailLineMuted} />
            </View>

            <Text style={pw.heroEyebrow}>180 PREMIUM</Text>
            <Text style={pw.heroTitle}>Quiz tarafını limitsiz aç.</Text>
            <Text style={pw.heroSub}>Reklamsız akış ve premium ayrıcalıklar tek yerde.</Text>

            {hasActiveEntitlement ? (
              <View style={pw.activeStatusRow}>
                <View style={pw.activeStatusDot} />
                <View style={pw.activeStatusCopy}>
                  <Text style={pw.activeStatusTitle}>{currentPlanLabel} aktif</Text>
                  <Text style={pw.activeStatusBody}>{currentPlanBody}</Text>
                </View>
              </View>
            ) : null}

            <View style={pw.heroPanel}>
              <View style={pw.heroPanelTop}>
                <View style={pw.heroIconWrap}>
                  <Ionicons name="diamond-outline" size={20} color={CLAY} />
                </View>
                <View style={pw.heroPanelCopy}>
                  <Text style={pw.heroPanelTitle}>Premium açıldığında</Text>
                  <Text style={pw.heroPanelBody}>Limit kalkar, reklam gider, rozet açılır.</Text>
                </View>
              </View>

              <View style={pw.heroStatsRow}>
                {HERO_STATS.map((item) => (
                  <HeroStatChip key={item.label} item={item} />
                ))}
              </View>
            </View>
          </View>

          <View style={pw.sectionHeader}>
            <Text style={pw.sectionEyebrow}>Kısa özet</Text>
            <Text style={pw.sectionTitle}>Ne alırsın?</Text>
          </View>

          <View style={pw.benefitsList}>
            {BENEFITS.map((item, index) => (
              <BenefitRow key={item.title} item={item} delay={index * 50} />
            ))}
          </View>

          <View style={pw.sectionHeader}>
            <Text style={pw.sectionEyebrow}>Planlar</Text>
            <Text style={pw.sectionTitle}>Plan seç</Text>
          </View>

          {isProductLoading ? (
            <View style={pw.loadingPlanCard}>
              <View style={pw.loadingPlanHeader}>
                <ActivityIndicator size="small" color={CLAY} />
                <View style={pw.loadingPlanCopy}>
                  <Text style={pw.loadingPlanTitle}>Planlar hazırlanıyor</Text>
                  <Text style={pw.loadingPlanBody}>
                    Store fiyatları ve satın alma detayları yükleniyor.
                  </Text>
                </View>
              </View>

              <View style={pw.loadingPlanSkeletonStack}>
                <View style={pw.loadingPlanSkeletonRow}>
                  <View style={[pw.loadingPlanSkeletonLine, pw.loadingPlanSkeletonLineWide]} />
                  <View style={[pw.loadingPlanSkeletonLine, pw.loadingPlanSkeletonLineShort]} />
                </View>
                <View style={pw.loadingPlanSkeletonRow}>
                  <View style={[pw.loadingPlanSkeletonLine, pw.loadingPlanSkeletonLineMedium]} />
                  <View style={[pw.loadingPlanSkeletonLine, pw.loadingPlanSkeletonLineTiny]} />
                </View>
                <View style={pw.loadingPlanSkeletonPillRow}>
                  <View style={pw.loadingPlanSkeletonPill} />
                  <View style={pw.loadingPlanSkeletonPill} />
                  <View style={pw.loadingPlanSkeletonPillMuted} />
                </View>
              </View>
            </View>
          ) : (
            <View style={pw.planList}>
              {plans.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  selected={selected === plan.key}
                  active={Boolean(currentPlan && currentPlan === plan.key)}
                  onSelect={() => setSelected(plan.key)}
                />
              ))}
            </View>
          )}

          {error ? <Text style={pw.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={pw.footerShell}>
          <Text style={[pw.footerSummary, { color: selectedPlan.accent }]}>{paymentSummary}</Text>

          <Pressable
            style={({ pressed }) => [
              pw.ctaBtn,
              purchaseDisabled ? pw.ctaBtnDisabled : null,
              pressed && !purchaseDisabled ? pw.ctaBtnPressed : null,
            ]}
            onPress={() => {
              if (purchaseDisabled) return;
              onPurchase(selected);
            }}
            disabled={purchaseDisabled}
            accessibilityRole="button"
            accessibilityLabel="Premium satın al"
          >
            <Text style={pw.ctaBtnText}>{effectiveCtaLabel}</Text>
          </Pressable>

          <Text style={pw.legalText}>{effectiveFooterNote}</Text>

          <View style={pw.legalLinksRow}>
            <Pressable
              onPress={() => {
                void Linking.openURL('https://180absolutecinema.com/privacy/');
              }}
              accessibilityRole="link"
            >
              <Text style={pw.legalLinkText}>{legalCopy.privacyPolicy}</Text>
            </Pressable>
            <Text style={pw.legalLinkDivider}>|</Text>
            <Pressable
              onPress={() => {
                void Linking.openURL('https://180absolutecinema.com/terms/');
              }}
              accessibilityRole="link"
            >
              <Text style={pw.legalLinkText}>{legalCopy.termsOfService}</Text>
            </Pressable>
          </View>

          {!isWebPreview && onRestore ? (
            <Pressable
              style={({ pressed }) => [pw.restoreBtn, pressed ? pw.restoreBtnPressed : null]}
              onPress={onRestore}
              disabled={purchasing}
              accessibilityRole="button"
              accessibilityLabel="Satın alımları geri yükle"
            >
              <Text style={pw.restoreBtnText}>{legalCopy.restorePurchases}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const pw = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 31, 31, 0.9)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 82,
    paddingBottom: 228,
  },
  heroShell: {
    marginBottom: 24,
  },
  heroRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  heroRailLine: {
    width: 34,
    height: 4,
    borderRadius: 999,
  },
  heroRailLineMuted: {
    width: 20,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: CLAY,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    maxWidth: 320,
  },
  heroSub: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#c9c6bf',
    maxWidth: 320,
  },
  activeStatusRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  activeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    backgroundColor: SAGE,
    flexShrink: 0,
  },
  activeStatusCopy: {
    flex: 1,
  },
  activeStatusTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  activeStatusBody: {
    fontSize: 12,
    lineHeight: 17,
    color: TEXT_MUTED,
  },
  heroPanel: {
    marginTop: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 18,
    gap: 16,
  },
  heroPanelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(165, 113, 100, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(165, 113, 100, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPanelCopy: {
    flex: 1,
  },
  heroPanelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  heroPanelBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#c9c6bf',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatChip: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    paddingVertical: 12,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: TEXT_MUTED,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: TEXT_MUTED,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  benefitsList: {
    marginBottom: 22,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  benefitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(138, 154, 91, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  benefitBody: {
    fontSize: 12,
    lineHeight: 16,
    color: '#c9c6bf',
  },
  planList: {
    gap: 12,
  },
  loadingPlanCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 18,
    gap: 16,
  },
  loadingPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingPlanCopy: {
    flex: 1,
    gap: 4,
  },
  loadingPlanTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  loadingPlanBody: {
    fontSize: 12,
    lineHeight: 17,
    color: '#c9c6bf',
  },
  loadingPlanSkeletonStack: {
    gap: 10,
  },
  loadingPlanSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  loadingPlanSkeletonLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  loadingPlanSkeletonLineWide: {
    flex: 1,
    maxWidth: '62%',
  },
  loadingPlanSkeletonLineMedium: {
    flex: 1,
    maxWidth: '48%',
  },
  loadingPlanSkeletonLineShort: {
    width: 72,
  },
  loadingPlanSkeletonLineTiny: {
    width: 44,
  },
  loadingPlanSkeletonPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  loadingPlanSkeletonPill: {
    height: 34,
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadingPlanSkeletonPillMuted: {
    height: 34,
    width: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  planCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    gap: 14,
  },
  planAccentRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  planBadgeStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#121212',
    letterSpacing: 0.45,
  },
  planStatePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  planStatePillText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  planHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  planTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  planLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  planSummary: {
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
  },
  planPriceBlock: {
    alignItems: 'flex-end',
    minWidth: 84,
    flexShrink: 0,
  },
  planPrice: {
    fontSize: 25,
    fontWeight: '900',
    color: TEXT_PRIMARY,
  },
  planPeriod: {
    fontSize: 11,
    lineHeight: 15,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  planFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planInfoStack: {
    flex: 1,
    gap: 2,
  },
  planDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: '#c9c6bf',
  },
  planMeta: {
    fontSize: 11,
    lineHeight: 15,
    color: TEXT_MUTED,
  },
  planRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#f08a8a',
    textAlign: 'center',
  },
  footerShell: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 24,
    padding: 15,
    gap: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  footerSummary: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  ctaBtn: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: SAGE,
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnPressed: {
    transform: [{ scale: 0.985 }],
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: MOBILE_THEME.color.buttonBrandText,
    textAlign: 'center',
  },
  legalText: {
    fontSize: 11,
    lineHeight: 16,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  legalLinkText: {
    fontSize: 11,
    color: SAGE,
    textDecorationLine: 'underline',
  },
  legalLinkDivider: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  restoreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  restoreBtnPressed: {
    opacity: 0.72,
  },
  restoreBtnText: {
    fontSize: 11,
    lineHeight: 16,
    color: TEXT_MUTED,
    textDecorationLine: 'underline',
  },
});
