import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const DOUBLE_PRESS_WINDOW_MS = 2000;

/**
 * Android back button double-tap-to-exit hook.
 * - First press: shows a toast message.
 * - Second press within 2 s: exits the app via BackHandler.exitApp().
 * Only active on Android. Pass enabled=false on inner screens so stack
 * navigation handles the back press normally.
 */
export const useBackHandler = (enabled = true): void => {
  const lastPressAtRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - lastPressAtRef.current < DOUBLE_PRESS_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastPressAtRef.current = now;
      ToastAndroid.show('Çıkmak için tekrar bas', ToastAndroid.SHORT);
      return true;
    });

    return () => subscription.remove();
  }, [enabled]);
};
