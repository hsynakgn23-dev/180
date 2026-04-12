export const ADMOB_INTERSTITIAL_ID = '';
export const ADMOB_REWARDED_ID = '';

export type MobileAdsConsentSnapshot = {
  status: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED';
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  isConsentFormAvailable: boolean;
  requestNonPersonalizedAdsOnly: boolean;
};

export const DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT: MobileAdsConsentSnapshot = {
  status: 'NOT_REQUIRED',
  canRequestAds: false,
  privacyOptionsRequired: false,
  isConsentFormAvailable: false,
  requestNonPersonalizedAdsOnly: false,
};

export async function readAdsConsentSnapshot(): Promise<MobileAdsConsentSnapshot> {
  return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
}

export async function gatherAdsConsent(): Promise<MobileAdsConsentSnapshot> {
  return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
}

export async function showAdsPrivacyOptions(): Promise<MobileAdsConsentSnapshot> {
  return DEFAULT_MOBILE_ADS_CONSENT_SNAPSHOT;
}

export async function initAds(): Promise<void> {
  return;
}

export async function showInterstitialAd(): Promise<void> {
  return;
}

export async function showRewardedAd(): Promise<boolean> {
  return false;
}
