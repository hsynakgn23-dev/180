import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeatureHintKey = 'daily' | 'quiz' | 'arena' | 'streak';

const hintStorageKey = (feature: FeatureHintKey) => `180_feature_hint_seen_${feature}_v1`;

export async function readFeatureHintSeen(feature: FeatureHintKey): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(hintStorageKey(feature));
    return value === 'true';
  } catch {
    return false;
  }
}

export async function writeFeatureHintSeen(feature: FeatureHintKey): Promise<void> {
  try {
    await AsyncStorage.setItem(hintStorageKey(feature), 'true');
  } catch {
    // Non-fatal: hint will show again next launch.
  }
}
