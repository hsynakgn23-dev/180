import { Ionicons } from '@expo/vector-icons';
import type { Product } from 'expo-iap';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  REEL_TOPUP_PACKS,
  WALLET_STARTER_TICKETS,
  WALLET_STORE_ITEMS,
  type ReelTopupPackKey,
  type WalletInventory,
  type WalletStoreItemKey,
} from '../../../../src/domain/progressionEconomy';
import {
  WALLET_DAILY_TASK_TOTAL_TICKETS,
  type WalletDailyTaskKey,
  type WalletDailyTaskSnapshot,
} from '../../../../src/domain/walletDailyTasks';
import { UiButton } from './primitives';

type WalletLanguage = 'tr' | 'en' | 'es' | 'fr';

const COPY = {
  tr: {
    eyebrow: 'BILET',
    unit: 'Bilet',
    title: 'Bilet Cuzdani',
    subtitle: 'Kazandigin biletleri burada tut, joker marketinde harca.',
    balance: 'Mevcut bakiye',
    inventory: 'Envanter',
    quickBuy: 'Hizli Satin Al',
    topup: 'Bilet Paketleri',
    rewarded: (amount: number) => `Reklam izle +${amount} Bilet`,
    rewardedMeta: 'Gunluk sinirli. XP veya arena puani vermez.',
    webMeta: 'Gercek satin alma sadece mobil uygulamada calisir.',
    openMobile: 'Mobil satin alma gerekir',
    buy: 'Satin al',
    use: 'Ac',
    close: 'Kapat',
    bestValue: 'EN IYI',
    remaining: 'kalan',
    packAmount: (value: number) => `${value} Bilet`,
    count: (value: number) => `${value} adet`,
  },
  en: {
    eyebrow: 'TICKETS',
    unit: 'Ticket',
    title: 'Ticket Wallet',
    subtitle: 'Keep earned tickets here and spend them in the joker market.',
    balance: 'Current balance',
    inventory: 'Inventory',
    quickBuy: 'Quick Buy',
    topup: 'Ticket Packs',
    rewarded: (amount: number) => `Watch an ad +${amount} Tickets`,
    rewardedMeta: 'Limited daily. No XP or arena score is granted.',
    webMeta: 'Real purchases only work in the mobile build.',
    openMobile: 'Mobile purchase required',
    buy: 'Buy',
    use: 'Open',
    close: 'Close',
    bestValue: 'BEST',
    remaining: 'left',
    packAmount: (value: number) => `${value} Tickets`,
    count: (value: number) => `${value} owned`,
  },
  es: {
    eyebrow: 'ENTRADAS',
    unit: 'Entrada',
    title: 'Cartera de Entradas',
    subtitle: 'Guarda aqui tus entradas y gastalas en el mercado de comodines.',
    balance: 'Saldo actual',
    inventory: 'Inventario',
    quickBuy: 'Compra rapida',
    topup: 'Paquetes de Entradas',
    rewarded: (amount: number) => `Mira un anuncio +${amount} entradas`,
    rewardedMeta: 'Disponible de forma limitada al dia. No da XP ni arena.',
    webMeta: 'Las compras reales solo funcionan en la app movil.',
    openMobile: 'Compra movil requerida',
    buy: 'Comprar',
    use: 'Abrir',
    close: 'Cerrar',
    bestValue: 'MEJOR',
    remaining: 'restantes',
    packAmount: (value: number) => `${value} Entradas`,
    count: (value: number) => `${value} en inventario`,
  },
  fr: {
    eyebrow: 'BILLETS',
    unit: 'Billet',
    title: 'Portefeuille Billets',
    subtitle: 'Garde ici tes billets gagnes et depense-les dans le marche des jokers.',
    balance: 'Solde actuel',
    inventory: 'Inventaire',
    quickBuy: 'Achat rapide',
    topup: 'Packs de Billets',
    rewarded: (amount: number) => `Regarde une pub +${amount} billets`,
    rewardedMeta: 'Disponible en quantite limitee chaque jour. Aucun XP ni score arena.',
    webMeta: 'Les achats reels fonctionnent seulement dans l app mobile.',
    openMobile: 'Achat mobile requis',
    buy: 'Acheter',
    use: 'Ouvrir',
    close: 'Fermer',
    bestValue: 'MEILLEUR',
    remaining: 'restants',
    packAmount: (value: number) => `${value} Billets`,
    count: (value: number) => `${value} en stock`,
  },
} as const;

const STORE_ITEM_COPY = {
  tr: {
    joker_fifty_fifty: {
      title: '50/50 Joker',
      subtitle: 'Bir soruda iki yanlisi kaldirir.',
    },
    joker_freeze: {
      title: 'Freeze Joker',
      subtitle: 'Rush ve maratonda +7 saniye dondurma verir.',
    },
    joker_pass: {
      title: 'Pass Joker',
      subtitle: 'Rush ve maratonda bir soruyu pas gecirir.',
    },
    streak_shield: {
      title: 'Streak Kalkani',
      subtitle: 'Tek kayip gununde seriyi korur.',
    },
  },
  en: {
    joker_fifty_fifty: {
      title: '50/50 Joker',
      subtitle: 'Removes two wrong answers on one question.',
    },
    joker_freeze: {
      title: 'Freeze Joker',
      subtitle: 'Adds +7 seconds in rush and marathon.',
    },
    joker_pass: {
      title: 'Pass Joker',
      subtitle: 'Skips one question in rush and marathon.',
    },
    streak_shield: {
      title: 'Streak Shield',
      subtitle: 'Protects your streak for one missed day.',
    },
  },
  es: {
    joker_fifty_fifty: {
      title: 'Joker 50/50',
      subtitle: 'Elimina dos respuestas incorrectas en una pregunta.',
    },
    joker_freeze: {
      title: 'Joker Freeze',
      subtitle: 'Da +7 segundos extra en rush y maraton.',
    },
    joker_pass: {
      title: 'Joker Pass',
      subtitle: 'Te deja saltar una pregunta en rush y maraton.',
    },
    streak_shield: {
      title: 'Escudo de Racha',
      subtitle: 'Protege la racha durante un dia perdido.',
    },
  },
  fr: {
    joker_fifty_fifty: {
      title: 'Joker 50/50',
      subtitle: 'Retire deux mauvaises reponses sur une question.',
    },
    joker_freeze: {
      title: 'Joker Freeze',
      subtitle: 'Ajoute +7 secondes en rush et marathon.',
    },
    joker_pass: {
      title: 'Joker Pass',
      subtitle: 'Passe une question en rush et marathon.',
    },
    streak_shield: {
      title: 'Bouclier de Serie',
      subtitle: 'Protege la serie pendant un jour manque.',
    },
  },
} as const;

const TOPUP_BADGE_COPY = {
  tr: {
    starter: 'Hizli destek',
    standard: 'Standart',
    best_value: 'En iyi deger',
    vault: 'Buyuk paket',
  },
  en: {
    starter: 'Quick support',
    standard: 'Standard',
    best_value: 'Best value',
    vault: 'Large pack',
  },
  es: {
    starter: 'Soporte rapido',
    standard: 'Estandar',
    best_value: 'Mejor valor',
    vault: 'Paquete grande',
  },
  fr: {
    starter: 'Soutien rapide',
    standard: 'Standard',
    best_value: 'Meilleure valeur',
    vault: 'Grand pack',
  },
} as const;

const resolveCopy = (language: WalletLanguage) => {
  if (language === 'tr') return COPY.tr;
  if (language === 'es') return COPY.es;
  if (language === 'fr') return COPY.fr;
  return COPY.en;
};

const resolveStoreItemCopy = (language: WalletLanguage, itemKey: WalletStoreItemKey) => {
  const localizedSet = STORE_ITEM_COPY[language] || STORE_ITEM_COPY.en;
  return localizedSet[itemKey] || STORE_ITEM_COPY.en[itemKey];
};

const resolveTopupBadge = (language: WalletLanguage, packKey: ReelTopupPackKey) => {
  const localizedSet = TOPUP_BADGE_COPY[language] || TOPUP_BADGE_COPY.en;
  return localizedSet[packKey] || TOPUP_BADGE_COPY.en[packKey];
};

const ECONOMY_COPY = {
  tr: {
    shop: 'Joker marketi',
    inventoryMeta: 'Acikta tuttugun jokerler ve korumalar.',
    shopMeta: 'Gunluk akistan gelen biletleri burada harcarsin.',
    packsMeta: 'Paketler mobil satin alma hattina bagli.',
    balanceMeta: (starter: number) =>
      `Ilk acilista ${starter} bilet gelir. Gunluk quiz ve yorumlarla denge devam eder.`,
    offlineMeta: 'Wallet verisi su an baglanamadi. API hatti kapaliysa bu alan bos gorunur.',
    ownedShort: 'elde',
    dayLoop: 'gunluk tur',
    tasks: 'Gunluk gorevler',
    tasksMeta: (total: number) => `Bugun ${total} bilete kadar bonus topla.`,
    taskReady: 'Odulu al',
    taskClaimed: 'Alindi',
    taskLocked: 'Bekliyor',
  },
  en: {
    shop: 'Joker market',
    inventoryMeta: 'Jokers and protection items currently owned.',
    shopMeta: 'Spend tickets earned from the daily loop here.',
    packsMeta: 'Packs are connected to mobile purchase flow.',
    balanceMeta: (starter: number) =>
      `A fresh wallet opens with ${starter} tickets. Daily quiz and comments sustain the loop.`,
    offlineMeta: 'Wallet data could not load right now. This stays empty if the API is offline.',
    ownedShort: 'owned',
    dayLoop: 'daily loop',
    tasks: 'Daily tasks',
    tasksMeta: (total: number) => `Collect up to ${total} bonus tickets today.`,
    taskReady: 'Claim',
    taskClaimed: 'Claimed',
    taskLocked: 'Waiting',
  },
} as const;

const resolveEconomyCopy = (language: WalletLanguage) => {
  if (language === 'tr') return ECONOMY_COPY.tr;
  return ECONOMY_COPY.en;
};

const STORE_ITEM_ICONS: Record<WalletStoreItemKey, keyof typeof Ionicons.glyphMap> = {
  joker_fifty_fifty: 'remove-circle-outline',
  joker_freeze: 'snow-outline',
  joker_pass: 'play-skip-forward-outline',
  streak_shield: 'shield-checkmark-outline',
};

const formatCooldown = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
};

type WalletModalProps = {
  visible: boolean;
  onClose: () => void;
  language?: WalletLanguage;
  isPremium: boolean;
  balance: number;
  inventory: WalletInventory;
  rewardedAd: {
    available: boolean;
    remainingClaims: number;
    dailyLimit: number;
    rewardAmount: number;
    cooldownRemainingSeconds: number;
  };
  dailyTasks: WalletDailyTaskSnapshot[];
  productMap: Map<string, Product>;
  actionBusy?: boolean;
  topupPurchasing?: boolean;
  message?: string | null;
  error?: string | null;
  focusedItemKey?: WalletStoreItemKey | null;
  onBuyStoreItem: (itemKey: WalletStoreItemKey) => void;
  onClaimRewarded: () => void;
  onClaimDailyTask: (taskKey: WalletDailyTaskKey) => void;
  onPurchasePack: (packKey: ReelTopupPackKey) => void;
};

export const WalletModal = ({
  visible,
  onClose,
  language = 'tr',
  isPremium,
  balance,
  inventory,
  rewardedAd,
  dailyTasks,
  productMap,
  actionBusy = false,
  topupPurchasing = false,
  message,
  error,
  focusedItemKey,
  onBuyStoreItem,
  onClaimRewarded,
  onClaimDailyTask,
  onPurchasePack,
}: WalletModalProps) => {
  if (!visible) return null;
  const copy = resolveCopy(language);
  const economyCopy = resolveEconomyCopy(language);
  const inventoryTotal = Object.values(inventory).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={walletStyles.container}>
        <View style={walletStyles.headerRow}>
          <View style={walletStyles.headerCopy}>
            <View style={walletStyles.headerSignal} />
            <Text style={walletStyles.eyebrow}>{copy.eyebrow}</Text>
            <Text style={walletStyles.title}>{copy.title}</Text>
            <Text style={walletStyles.body}>{copy.subtitle}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [walletStyles.closeBtn, pressed ? walletStyles.closeBtnPressed : null]}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <Ionicons name="close" size={18} color="#f4eee7" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={walletStyles.scroll} showsVerticalScrollIndicator={false}>
          <View style={walletStyles.heroCard}>
            <View style={walletStyles.heroAccent} />
            <View style={walletStyles.balanceHeader}>
              <View style={{ flex: 1 }}>
                <Text style={walletStyles.balanceLabel}>{copy.balance}</Text>
                <Text style={walletStyles.balanceValue}>{balance}</Text>
                <Text style={walletStyles.heroMeta}>{economyCopy.balanceMeta(WALLET_STARTER_TICKETS)}</Text>
              </View>
              <View style={walletStyles.balanceBadge}>
                <Ionicons name="ticket-outline" size={13} color="#0f1309" />
                <Text style={walletStyles.balanceBadgeText}>{copy.packAmount(balance)}</Text>
              </View>
            </View>
            <View style={walletStyles.heroStatRow}>
              <View style={walletStyles.heroStatCard}>
                <Text style={walletStyles.heroStatLabel}>{economyCopy.dayLoop}</Text>
                <Text style={walletStyles.heroStatValue}>+{WALLET_DAILY_TASK_TOTAL_TICKETS}</Text>
              </View>
              <View style={walletStyles.heroStatCard}>
                <Text style={walletStyles.heroStatLabel}>{copy.inventory}</Text>
                <Text style={walletStyles.heroStatValue}>{inventoryTotal}</Text>
              </View>
              <View style={walletStyles.heroStatCard}>
                <Text style={walletStyles.heroStatLabel}>{copy.unit}</Text>
                <Text style={walletStyles.heroStatValue}>{WALLET_STARTER_TICKETS}</Text>
              </View>
            </View>
          </View>

          {message ? (
            <View style={[walletStyles.feedbackStrip, walletStyles.feedbackStripPositive]}>
              <Text style={walletStyles.feedbackText}>{message}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[walletStyles.feedbackStrip, walletStyles.feedbackStripNegative]}>
              <Text style={walletStyles.feedbackText}>{error || economyCopy.offlineMeta}</Text>
            </View>
          ) : null}

          <View style={walletStyles.sectionCard}>
            <View style={walletStyles.sectionHeader}>
              <Text style={walletStyles.sectionTitle}>{economyCopy.tasks}</Text>
              <Text style={walletStyles.sectionMeta}>
                {economyCopy.tasksMeta(WALLET_DAILY_TASK_TOTAL_TICKETS)}
              </Text>
            </View>
            <View style={walletStyles.taskList}>
              {dailyTasks.length > 0 ? dailyTasks.map((task) => {
                const progressRatio = Math.max(0, Math.min(1, task.progress / Math.max(1, task.target)));
                const isReady = task.status === 'ready';
                const isClaimed = task.status === 'claimed';
                return (
                  <Pressable
                    key={task.key}
                    style={({ pressed }) => [
                      walletStyles.taskCard,
                      isReady ? walletStyles.taskCardReady : null,
                      isClaimed ? walletStyles.taskCardClaimed : null,
                      pressed && isReady ? walletStyles.taskCardPressed : null,
                    ]}
                    onPress={() => {
                      if (isReady) onClaimDailyTask(task.key);
                    }}
                    disabled={!isReady || actionBusy}
                    accessibilityRole="button"
                  >
                    <View style={[
                      walletStyles.taskIconWrap,
                      isReady ? walletStyles.taskIconWrapReady : null,
                      isClaimed ? walletStyles.taskIconWrapClaimed : null,
                    ]}>
                      <Ionicons
                        name={isClaimed ? 'checkmark' : isReady ? 'ticket-outline' : 'ellipse-outline'}
                        size={16}
                        color={isClaimed ? '#0f1309' : isReady ? '#0f1309' : '#d7d08d'}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={walletStyles.taskRow}>
                        <Text style={walletStyles.taskTitle}>{task.title}</Text>
                        <View style={[walletStyles.taskRewardPill, isReady ? walletStyles.taskRewardPillReady : null]}>
                          <Text style={[walletStyles.taskRewardText, isReady ? walletStyles.taskRewardTextReady : null]}>
                            +{task.ticketReward}
                          </Text>
                        </View>
                      </View>
                      <Text style={walletStyles.taskBody}>{task.description}</Text>
                      <View style={walletStyles.taskProgressTrack}>
                        <View style={[walletStyles.taskProgressFill, { width: `${progressRatio * 100}%` }]} />
                      </View>
                      <View style={walletStyles.taskFooter}>
                        <Text style={walletStyles.taskProgressText}>{task.progress}/{task.target}</Text>
                        <Text style={[
                          walletStyles.taskStatusText,
                          isReady ? walletStyles.taskStatusTextReady : null,
                          isClaimed ? walletStyles.taskStatusTextClaimed : null,
                        ]}>
                          {isClaimed ? economyCopy.taskClaimed : isReady ? economyCopy.taskReady : economyCopy.taskLocked}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }) : (
                <View style={walletStyles.taskEmptyCard}>
                  <Text style={walletStyles.taskTitle}>{economyCopy.tasks}</Text>
                  <Text style={walletStyles.taskBody}>{economyCopy.offlineMeta}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={walletStyles.sectionCard}>
            <View style={walletStyles.sectionHeader}>
              <Text style={walletStyles.sectionTitle}>{copy.inventory}</Text>
              <Text style={walletStyles.sectionMeta}>{economyCopy.inventoryMeta}</Text>
            </View>
            <View style={walletStyles.inventoryRow}>
              {WALLET_STORE_ITEMS.map((item) => {
                const itemCopy = resolveStoreItemCopy(language, item.key);
                return (
                  <View key={item.key} style={walletStyles.inventoryCard}>
                    <View style={walletStyles.inventoryIconWrap}>
                      <Ionicons name={STORE_ITEM_ICONS[item.key]} size={16} color="#b7c16f" />
                    </View>
                    <Text style={walletStyles.inventoryName}>{itemCopy.title}</Text>
                    <Text style={walletStyles.inventoryCount}>{inventory[item.inventoryKey]} {economyCopy.ownedShort}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={walletStyles.sectionCard}>
            <View style={walletStyles.sectionHeader}>
              <Text style={walletStyles.sectionTitle}>{economyCopy.shop}</Text>
              <Text style={walletStyles.sectionMeta}>{economyCopy.shopMeta}</Text>
            </View>
            <View style={walletStyles.shopList}>
              {WALLET_STORE_ITEMS.map((item) => {
                const itemCopy = resolveStoreItemCopy(language, item.key);
                const isFocused = focusedItemKey === item.key;
                return (
                  <View key={item.key} style={[walletStyles.shopCard, isFocused ? walletStyles.shopCardFocused : null]}>
                    <View style={walletStyles.shopIconWrap}>
                      <Ionicons name={STORE_ITEM_ICONS[item.key]} size={18} color="#f2e6d0" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={walletStyles.shopRow}>
                        <Text style={walletStyles.shopTitle}>{itemCopy.title}</Text>
                        <View style={walletStyles.shopPricePill}>
                          <Ionicons name="ticket-outline" size={12} color="#101408" />
                          <Text style={walletStyles.shopPriceText}>{item.reelCost}</Text>
                        </View>
                      </View>
                      <Text style={walletStyles.shopBody}>{itemCopy.subtitle}</Text>
                      <Text style={walletStyles.shopOwned}>
                        {inventory[item.inventoryKey]} {economyCopy.ownedShort}
                      </Text>
                    </View>
                    <UiButton
                      label={copy.buy}
                      tone={isFocused ? 'brand' : 'neutral'}
                      onPress={() => onBuyStoreItem(item.key)}
                      disabled={actionBusy}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={walletStyles.sectionCard}>
            <View style={walletStyles.sectionHeader}>
              <Text style={walletStyles.sectionTitle}>{copy.topup}</Text>
              <Text style={walletStyles.sectionMeta}>{economyCopy.packsMeta}</Text>
            </View>
            <View style={walletStyles.rewardedCard}>
                <View style={walletStyles.rewardedLead}>
                  <View style={walletStyles.rewardedBadge}>
                    <Ionicons name="play-circle-outline" size={14} color="#d6dfa1" />
                    <Text style={walletStyles.rewardedBadgeText}>{`+${rewardedAd.rewardAmount}`}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={walletStyles.rewardedTitle}>{copy.rewarded(rewardedAd.rewardAmount)}</Text>
                    <Text style={walletStyles.rewardedBody}>
                      {rewardedAd.cooldownRemainingSeconds > 0
                        ? `${copy.rewardedMeta} ${formatCooldown(rewardedAd.cooldownRemainingSeconds)}`
                        : `${copy.rewardedMeta} ${rewardedAd.remainingClaims}/${rewardedAd.dailyLimit} ${copy.remaining}.`}
                    </Text>
                  </View>
                </View>
                <UiButton
                  label={`+${rewardedAd.rewardAmount} ${copy.unit}`}
                  tone="brand"
                  onPress={onClaimRewarded}
                  disabled={actionBusy || !rewardedAd.available}
                />
              </View>

            <View style={walletStyles.packList}>
              {REEL_TOPUP_PACKS.map((pack) => {
                const product = productMap.get(pack.productId);
                const price =
                  String(product?.displayPrice || '').trim() || String(pack.fallbackDisplayPrice || '').trim() || copy.openMobile;
                return (
                  <Pressable
                    key={pack.key}
                    style={({ pressed }) => [
                      walletStyles.packCard,
                      pack.featured ? walletStyles.packCardFeatured : null,
                      pressed ? walletStyles.packCardPressed : null,
                    ]}
                    onPress={() => onPurchasePack(pack.key)}
                    disabled={topupPurchasing}
                  >
                    <View style={walletStyles.packHeader}>
                      <Text style={walletStyles.packTitle}>{copy.packAmount(pack.reels)}</Text>
                      <View style={[walletStyles.packBadge, pack.featured ? walletStyles.packBadgeFeatured : null]}>
                        <Text style={[walletStyles.packBadgeText, pack.featured ? walletStyles.packBadgeTextFeatured : null]}>
                          {pack.featured ? copy.bestValue : resolveTopupBadge(language, pack.key)}
                        </Text>
                      </View>
                    </View>
                    <Text style={walletStyles.packPrice}>{price}</Text>
                    <Text style={walletStyles.packMeta}>{Platform.OS === 'web' ? copy.webMeta : copy.packAmount(pack.reels)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <UiButton label={copy.close} tone="neutral" onPress={onClose} stretch />
        </ScrollView>
      </View>
    </Modal>
  );
};

const walletStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  headerSignal: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#a8b56a',
    marginBottom: 14,
  },
  eyebrow: {
    color: '#b78e67',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    color: '#f6f1ea',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: '#b8ab9c',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  scroll: {
    gap: 18,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  heroAccent: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#a8b56a',
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#a8a093',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#d7d08d',
  },
  balanceBadgeText: {
    color: '#0f1309',
    fontSize: 11,
    fontWeight: '700',
  },
  balanceValue: {
    color: '#fff7ef',
    fontSize: 46,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroMeta: {
    color: '#a79e8f',
    fontSize: 12,
    lineHeight: 18,
  },
  heroStatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1b1b1b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroStatLabel: {
    color: '#8f897f',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroStatValue: {
    color: '#f4eee7',
    fontSize: 20,
    fontWeight: '800',
  },
  feedbackStrip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackStripPositive: {
    backgroundColor: 'rgba(138,154,91,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(138,154,91,0.3)',
  },
  feedbackStripNegative: {
    backgroundColor: 'rgba(165,113,100,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(165,113,100,0.26)',
  },
  feedbackText: {
    color: '#f6f1ea',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: '#ece3d7',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#8f897f',
    fontSize: 12,
    lineHeight: 18,
  },
  taskList: {
    gap: 10,
  },
  taskCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 13,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  taskCardReady: {
    backgroundColor: '#212719',
    borderColor: 'rgba(168,181,106,0.38)',
  },
  taskCardClaimed: {
    opacity: 0.72,
  },
  taskCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  taskIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,181,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,181,106,0.18)',
  },
  taskIconWrapReady: {
    backgroundColor: '#d8e29b',
    borderColor: '#d8e29b',
  },
  taskIconWrapClaimed: {
    backgroundColor: '#8f9b59',
    borderColor: '#8f9b59',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    color: '#f2eadf',
    fontSize: 14,
    fontWeight: '800',
  },
  taskRewardPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(168,181,106,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(168,181,106,0.2)',
  },
  taskRewardPillReady: {
    backgroundColor: '#d8e29b',
    borderColor: '#d8e29b',
  },
  taskRewardText: {
    color: '#d8e29b',
    fontSize: 11,
    fontWeight: '900',
  },
  taskRewardTextReady: {
    color: '#0f1309',
  },
  taskBody: {
    color: '#a79e8f',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  taskProgressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 9,
  },
  taskProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#a8b56a',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskProgressText: {
    color: '#817b72',
    fontSize: 11,
    fontWeight: '700',
  },
  taskStatusText: {
    color: '#a79e8f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  taskStatusTextReady: {
    color: '#d8e29b',
  },
  taskStatusTextClaimed: {
    color: '#8f9b59',
  },
  taskEmptyCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inventoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inventoryCard: {
    minWidth: '47%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inventoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,181,106,0.12)',
    marginBottom: 10,
  },
  inventoryName: {
    color: '#f2eadf',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  inventoryCount: {
    color: '#b9ad9e',
    fontSize: 12,
  },
  shopList: {
    gap: 10,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  shopCardFocused: {
    borderColor: 'rgba(168,181,106,0.32)',
    backgroundColor: '#1d2017',
  },
  shopIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,181,106,0.12)',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  shopTitle: {
    color: '#fff6ec',
    fontSize: 14,
    fontWeight: '700',
  },
  shopBody: {
    color: '#b5a796',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  shopOwned: {
    color: '#d7c8b8',
    fontSize: 11,
    fontWeight: '600',
  },
  shopPricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#d7d08d',
  },
  shopPriceText: {
    color: '#101408',
    fontSize: 11,
    fontWeight: '800',
  },
  rewardedCard: {
    gap: 14,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#171b14',
    borderWidth: 1,
    borderColor: 'rgba(168,181,106,0.22)',
  },
  rewardedLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardedBadge: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(168,181,106,0.12)',
    gap: 4,
  },
  rewardedBadgeText: {
    color: '#d6dfa1',
    fontSize: 11,
    fontWeight: '800',
  },
  rewardedTitle: {
    color: '#f1f7ef',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rewardedBody: {
    color: '#b8c7b8',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  packList: {
    gap: 10,
  },
  packCard: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  packCardFeatured: {
    borderColor: 'rgba(168,181,106,0.32)',
    backgroundColor: '#1d2017',
  },
  packCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  packTitle: {
    color: '#f7efe6',
    fontSize: 16,
    fontWeight: '800',
  },
  packBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  packBadgeFeatured: {
    backgroundColor: '#d7d08d',
  },
  packBadgeText: {
    color: '#d9c6a5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  packBadgeTextFeatured: {
    color: '#101408',
  },
  packPrice: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  packMeta: {
    color: '#9b8e7e',
    fontSize: 11,
    lineHeight: 16,
  },
});
