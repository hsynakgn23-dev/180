import { Platform } from 'react-native';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
  type AdsConsentInfo,
} from 'react-native-google-mobile-ads';

// Use test IDs in dev, real IDs in production
const IS_TEST = __DEV__;
const PROD_REWARDED_ANDROID_ID = 'ca-app-pub-5762109870281582/2544945507';
const PROD_REWARDED_IOS_ID = 'ca-app-pub-5762109870281582/6171201453';

export const ADMOB_INTERSTITIAL_ID = IS_TEST
  ? (Platform.OS === 'ios' ? TestIds.INTERSTITIAL : TestIds.INTERSTITIAL)
  : (Platform.OS === 'ios'
      ? 'ca-app-pub-5762109870281582/1214411951'
      : 'ca-app-pub-5762109870281582/9401958935');

export const ADMOB_REWARDED_ID = IS_TEST
  ? (Platform.OS === 'ios' ? TestIds.REWARDED : TestIds.REWARDED)
  : (() => {
      const platformRewardedId =
        Platform.OS === 'ios'
          ? String(process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID || '').trim()
          : String(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID || '').trim();
      const legacyRewardedId = String(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || '').trim();
      if (platformRewardedId) return platformRewardedId;
      if (legacyRewardedId) return legacyRewardedId;
      return Platform.OS === 'ios' ? PROD_REWARDED_IOS_ID : PROD_REWARDED_ANDROID_ID;
    })();

export type MobileAdsConsentSnapshot = {
  status: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED';
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  isConsentFormAvailable: boolean;
  requestNonPersonalizedAdsOnly: boolean;
};

export const DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT: MobileAdsConsentSnapshot = {
  status: AdsConsentStatus.UNKNOWN,
  canRequestAds: false,
  privacyOptionsRequired: false,
  isConsentFormAvailable: false,
  requestNonPersonalizedAdsOnly: false,
};

let adsInitialized = false;

const resolveRequestNonPersonalizedAdsOnly = async (): Promise<boolean> => {
  try {
    const gdprApplies = await AdsConsent.getGdprApplies();
    if (!gdprApplies) return false;
    const userChoices = await AdsConsent.getUserChoices();
    return userChoices.selectBasicAds && !userChoices.selectPersonalisedAds;
  } catch {
    return false;
  }
};

const toConsentSnapshot = async (info: AdsConsentInfo): Promise<MobileAdsConsentSnapshot> => ({
  status: info.status,
  canRequestAds: Boolean(info.canRequestAds),
  privacyOptionsRequired:
    info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  isConsentFormAvailable: Boolean(info.isConsentFormAvailable),
  requestNonPersonalizedAdsOnly: info.canRequestAds
    ? await resolveRequestNonPersonalizedAdsOnly()
    : false,
});

export async function readAdsConsentSnapshot(): Promise<MobileAdsConsentSnapshot> {
  if (Platform.OS === 'web') return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
  try {
    const consentInfo = await AdsConsent.getConsentInfo();
    return await toConsentSnapshot(consentInfo);
  } catch {
    return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
  }
}

export async function gatherAdsConsent(): Promise<MobileAdsConsentSnapshot> {
  if (Platform.OS === 'web') return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
  const consentInfo = await AdsConsent.gatherConsent();
  return await toConsentSnapshot(consentInfo);
}

export async function showAdsPrivacyOptions(): Promise<MobileAdsConsentSnapshot> {
  if (Platform.OS === 'web') return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
  const consentInfo = await AdsConsent.showPrivacyOptionsForm();
  return await toConsentSnapshot(consentInfo);
}

const resolveAdRequestOptions = async (): Promise<{
  requestNonPersonalizedAdsOnly: boolean;
} | null> => {
  if (Platform.OS === 'web') return null;

  let consentSnapshot = await readAdsConsentSnapshot();
  if (!consentSnapshot.canRequestAds && consentSnapshot.status === AdsConsentStatus.UNKNOWN) {
    consentSnapshot = await gatherAdsConsent().catch(() => consentSnapshot);
  }

  if (!consentSnapshot.canRequestAds) return null;

  return {
    requestNonPersonalizedAdsOnly: consentSnapshot.requestNonPersonalizedAdsOnly,
  };
};

export async function initAds(): Promise<void> {
  if (adsInitialized || Platform.OS === 'web') return;
  try {
    const requestOptions = await resolveAdRequestOptions();
    if (!requestOptions) return;
    await mobileAds().initialize();
    adsInitialized = true;
  } catch {
    // Ads not available (web/simulator)
  }
}

/**
 * Load and show an interstitial ad.
 * Resolves when ad is dismissed or if ad fails to load (silent fail).
 */
export function showInterstitialAd(): Promise<void> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve();
      return;
    }

    void (async () => {
      try {
        const requestOptions = await resolveAdRequestOptions();
        if (!requestOptions) {
          resolve();
          return;
        }

        await initAds();
        const ad = InterstitialAd.createForAdRequest(ADMOB_INTERSTITIAL_ID, requestOptions);

        const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          unsubscribeClosed();
          unsubscribeError();
          resolve();
        });

        const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
          unsubscribeClosed();
          unsubscribeError();
          resolve();
        });

        ad.addAdEventListener(AdEventType.LOADED, () => {
          ad.show();
        });

        ad.load();
      } catch {
        resolve();
      }
    })();
  });
}

export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(false);
      return;
    }

    void (async () => {
      try {
        const requestOptions = await resolveAdRequestOptions();
        if (!requestOptions) {
          resolve(false);
          return;
        }

        await initAds();
        let earnedReward = false;
        const ad = RewardedAd.createForAdRequest(ADMOB_REWARDED_ID, requestOptions);

        const cleanup = () => {
          unsubscribeLoaded();
          unsubscribeReward();
          unsubscribeClosed();
          unsubscribeError();
        };

        const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          ad.show().catch(() => {
            cleanup();
            resolve(false);
          });
        });

        const unsubscribeReward = ad.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            earnedReward = true;
          }
        );

        const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          cleanup();
          resolve(earnedReward);
        });

        const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
          cleanup();
          resolve(false);
        });

        ad.load();
      } catch {
        resolve(false);
      }
    })();
  });
}
