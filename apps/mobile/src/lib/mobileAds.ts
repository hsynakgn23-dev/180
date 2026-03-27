import { Platform } from 'react-native';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// Use test IDs in dev, real IDs in production
const IS_TEST = __DEV__;

export const ADMOB_INTERSTITIAL_ID = IS_TEST
  ? (Platform.OS === 'ios' ? TestIds.INTERSTITIAL : TestIds.INTERSTITIAL)
  : (Platform.OS === 'ios'
      ? 'ca-app-pub-5762109870281582/1214411951'
      : 'ca-app-pub-5762109870281582/9401958935');

let adsInitialized = false;

export async function initAds(): Promise<void> {
  if (adsInitialized) return;
  try {
    await mobileAds().initialize();
    adsInitialized = true;
  } catch (e) {
    // Ads not available (web/simulator)
  }
}

/**
 * Load and show an interstitial ad.
 * Resolves when ad is dismissed or if ad fails to load (silent fail).
 */
export function showInterstitialAd(): Promise<void> {
  return new Promise((resolve) => {
    // Web — skip silently
    if (Platform.OS === 'web') { resolve(); return; }

    try {
      const ad = InterstitialAd.createForAdRequest(ADMOB_INTERSTITIAL_ID, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeClosed();
        unsubscribeError();
        resolve();
      });

      const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
        unsubscribeClosed();
        unsubscribeError();
        resolve(); // fail silently
      });

      ad.addAdEventListener(AdEventType.LOADED, () => {
        ad.show();
      });

      ad.load();
    } catch (e) {
      resolve(); // fail silently
    }
  });
}
