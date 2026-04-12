import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildMobileDeepLinkFromRouteIntent,
  parseMobileDeepLink,
  resolveMobileScreenPlan,
  type MobileRouteIntent,
} from '../../../../packages/shared/src/mobile';
import { trackMobileEvent } from '../lib/mobileAnalytics';

const DEFAULT_MOBILE_DEEP_LINK_BASE = 'absolutecinema://open';
const DEFAULT_ROUTE_INTENT: MobileRouteIntent = { target: 'daily' };

type UseMobileRouteIntentOptions = {
  deepLinkBase?: string;
};

type UseMobileRouteIntentResult = {
  activeIntent: MobileRouteIntent;
  clearIncomingIntent: () => void;
  deepLink: string;
  handleIncomingUrl: (url: string | null) => void;
  lastIncomingIntent: MobileRouteIntent | null;
  lastIncomingUrl: string | null;
  screenPlan: ReturnType<typeof resolveMobileScreenPlan>;
  setManualIntent: (intent: MobileRouteIntent | null) => void;
};

export const useMobileRouteIntent = (
  options: UseMobileRouteIntentOptions = {}
): UseMobileRouteIntentResult => {
  const deepLinkBase = options.deepLinkBase || DEFAULT_MOBILE_DEEP_LINK_BASE;
  const [lastIncomingUrl, setLastIncomingUrl] = useState<string | null>(null);
  const [lastIncomingIntent, setLastIncomingIntent] = useState<MobileRouteIntent | null>(null);
  const [manualIntent, setManualIntentState] = useState<MobileRouteIntent | null>(null);

  const activeIntent = manualIntent || lastIncomingIntent || DEFAULT_ROUTE_INTENT;
  const screenPlan = useMemo(() => resolveMobileScreenPlan(activeIntent), [activeIntent]);
  const deepLink = useMemo(
    () =>
      buildMobileDeepLinkFromRouteIntent(activeIntent, {
        base: deepLinkBase,
      }),
    [activeIntent, deepLinkBase]
  );

  const setManualIntent = useCallback((intent: MobileRouteIntent | null) => {
    setManualIntentState(intent);
  }, []);

  const clearIncomingIntent = useCallback(() => {
    setLastIncomingIntent(null);
    setLastIncomingUrl(null);
  }, []);

  const trackEntryIntent = useCallback((intent: MobileRouteIntent, rawUrl: string) => {
    if (intent.target === 'invite') {
      void trackMobileEvent('app_opened_from_invite', {
        inviteCode: intent.invite || null,
        rawUrl,
      });
      return;
    }

    if (intent.target === 'share') {
      void trackMobileEvent('app_opened_from_share', {
        inviteCode: intent.invite || null,
        platform: intent.platform || null,
        goal: intent.goal || null,
        rawUrl,
      });
    }
  }, []);

  const handleIncomingUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      setLastIncomingUrl(url);

      const parsedRoute = parseMobileDeepLink(url);
      if (!parsedRoute) return;

      setLastIncomingIntent(parsedRoute);
      setManualIntentState(null);
      trackEntryIntent(parsedRoute, url);
    },
    [trackEntryIntent]
  );

  useEffect(() => {
    void Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  return {
    activeIntent,
    clearIncomingIntent,
    deepLink,
    handleIncomingUrl,
    lastIncomingIntent,
    lastIncomingUrl,
    screenPlan,
    setManualIntent,
  };
};
