import AsyncStorage from '@react-native-async-storage/async-storage';

const MOBILE_ONBOARDING_SEEN_KEY = '180_mobile_onboarding_seen_v1';
const MOBILE_ONBOARDING_SEEN_VALUE = '1';

export const readMobileOnboardingSeen = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_ONBOARDING_SEEN_KEY);
    return raw === MOBILE_ONBOARDING_SEEN_VALUE;
  } catch {
    return false;
  }
};

export const writeMobileOnboardingSeen = async (seen: boolean): Promise<void> => {
  try {
    if (seen) {
      await AsyncStorage.setItem(MOBILE_ONBOARDING_SEEN_KEY, MOBILE_ONBOARDING_SEEN_VALUE);
      return;
    }
    await AsyncStorage.removeItem(MOBILE_ONBOARDING_SEEN_KEY);
  } catch {
    // best-effort persistence only
  }
};

