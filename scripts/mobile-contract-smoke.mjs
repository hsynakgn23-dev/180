import assert from 'node:assert/strict';

const routeModule = await import('../packages/shared/src/mobile/mobileRouteContract.ts');
const screenModule = await import('../packages/shared/src/mobile/mobileScreenMap.ts');
const deepLinkModule = await import('../packages/shared/src/mobile/deepLinks.ts');
const promptModule = await import('../packages/shared/src/mobile/mobileWebPromptContract.ts');
const analyticsModule = await import('../packages/shared/src/mobile/analyticsEvents.ts');
const envModule = await import('../apps/mobile/src/lib/mobileEnv.ts');
const publicProfileModule = await import('../apps/mobile/src/lib/mobilePublicProfile.ts');
const authorMapModule = await import('../apps/mobile/src/lib/mobileAuthorUserMap.ts');

const {
  normalizeInviteCode,
  normalizeMobileRouteIntent,
  encodeMobileRouteIntentToParams,
  parseMobileRouteIntentFromParams,
} = routeModule;
const { resolveMobileScreenPlan } = screenModule;
const { buildMobileDeepLinkFromRouteIntent, parseMobileDeepLink } = deepLinkModule;
const { resolveMobileWebPromptDecision } = promptModule;
const { ANALYTICS_EVENT_NAMES } = analyticsModule;
const {
  normalizeBaseUrl,
  resolveMobileDailyApiUrl,
  resolveMobileReferralApiBase,
  resolveMobilePushApiBase,
  resolveMobileWebBaseUrl,
} = envModule;
const { buildMobilePublicProfileUrl, isAllowedMobilePublicProfileUrl } = publicProfileModule;
const { toAuthorIdentityKey } = authorMapModule;

let failed = false;

const runCase = (name, fn) => {
  try {
    fn();
    console.info(`[mobile-contract-smoke] OK ${name}`);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mobile-contract-smoke] FAIL ${name}: ${message}`);
  }
};

runCase('normalizeInviteCode sanitizes and validates', () => {
  assert.equal(normalizeInviteCode(' ab-c12 345 '), 'ABC12345');
  assert.equal(normalizeInviteCode('abc'), '');
  assert.equal(normalizeInviteCode('!!!'), '');
});

runCase('normalizeMobileRouteIntent strips invalid share params', () => {
  const normalized = normalizeMobileRouteIntent({
    target: 'share',
    invite: 'cine-1234',
    platform: 'linkedin',
    goal: 'unknown',
  });
  assert.deepEqual(normalized, {
    target: 'share',
    invite: 'CINE1234',
  });
});

runCase('normalizeMobileRouteIntent keeps valid public profile and discover params', () => {
  const profileIntent = normalizeMobileRouteIntent({
    target: 'public_profile',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    username: '@Neo User',
  });
  assert.deepEqual(profileIntent, {
    target: 'public_profile',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    username: 'Neo_User',
  });

  const discoverIntent = normalizeMobileRouteIntent({
    target: 'discover',
    route: 'director_deep_dives',
  });
  assert.deepEqual(discoverIntent, {
    target: 'discover',
    route: 'director_deep_dives',
  });
});

runCase('route encode/parse roundtrip is stable', () => {
  const intent = {
    target: 'share',
    invite: 'CINE1234',
    platform: 'x',
    goal: 'streak',
  };
  const params = new URLSearchParams(encodeMobileRouteIntentToParams(intent));
  const parsed = parseMobileRouteIntentFromParams(params);
  assert.deepEqual(parsed, intent);
});

runCase('route encode/parse handles public profile roundtrip', () => {
  const intent = {
    target: 'public_profile',
    userId: '123e4567',
    username: 'neo',
  };
  const params = new URLSearchParams(encodeMobileRouteIntentToParams(intent));
  const parsed = parseMobileRouteIntentFromParams(params);
  assert.deepEqual(parsed, intent);
});

runCase('screen map resolves invite target', () => {
  const screenPlan = resolveMobileScreenPlan({ target: 'invite', invite: 'ABC12345' });
  assert.deepEqual(screenPlan, {
    screen: 'invite_claim',
    params: { invite: 'ABC12345' },
  });
});

runCase('screen map resolves public profile and discover targets', () => {
  const publicProfileScreen = resolveMobileScreenPlan({
    target: 'public_profile',
    userId: '123e4567',
    username: 'neo',
  });
  assert.deepEqual(publicProfileScreen, {
    screen: 'public_profile',
    params: { user_id: '123e4567', username: 'neo' },
  });

  const discoverScreen = resolveMobileScreenPlan({
    target: 'discover',
    route: 'mood_films',
  });
  assert.deepEqual(discoverScreen, {
    screen: 'discover_home',
    params: { route: 'mood_films' },
  });
});

runCase('deep link builder emits route + screen params', () => {
  const link = buildMobileDeepLinkFromRouteIntent(
    {
      target: 'share',
      invite: 'CINE1234',
      platform: 'x',
      goal: 'streak',
    },
    { base: 'absolutecinema://open' }
  );
  const parsed = new URL(link);
  assert.equal(parsed.searchParams.get('target'), 'share');
  assert.equal(parsed.searchParams.get('screen'), 'share_hub');
  assert.equal(parsed.searchParams.get('invite'), 'CINE1234');
  assert.equal(parsed.searchParams.get('platform'), 'x');
  assert.equal(parsed.searchParams.get('goal'), 'streak');
});

runCase('deep link builder emits public profile params', () => {
  const link = buildMobileDeepLinkFromRouteIntent(
    {
      target: 'public_profile',
      userId: '123e4567',
      username: 'neo',
    },
    { base: 'absolutecinema://open' }
  );
  const parsed = new URL(link);
  assert.equal(parsed.searchParams.get('target'), 'public_profile');
  assert.equal(parsed.searchParams.get('screen'), 'public_profile');
  assert.equal(parsed.searchParams.get('user_id'), '123e4567');
  assert.equal(parsed.searchParams.get('username'), 'neo');
});
runCase('deep link parser handles valid and invalid URLs', () => {
  const valid = parseMobileDeepLink(
    'absolutecinema://open?target=invite&invite=abc12345&screen=invite_claim'
  );
  assert.deepEqual(valid, { target: 'invite', invite: 'ABC12345' });
  assert.equal(parseMobileDeepLink('not a url'), null);
});

runCase('web prompt decision prioritizes streak and ritual goals', () => {
  const streakDecision = resolveMobileWebPromptDecision({
    streak: 4,
    dailyRitualsCount: 0,
    inviteCode: 'cine1234',
  });
  assert.deepEqual(streakDecision, {
    shouldShow: true,
    reason: 'streak_active',
    routeIntent: {
      target: 'share',
      invite: 'CINE1234',
      goal: 'streak',
    },
  });

  const ritualDecision = resolveMobileWebPromptDecision({
    streak: 1,
    dailyRitualsCount: 2,
    inviteCode: null,
  });
  assert.deepEqual(ritualDecision, {
    shouldShow: true,
    reason: 'ritual_active',
    routeIntent: {
      target: 'share',
      goal: 'comment',
    },
  });

  const noneDecision = resolveMobileWebPromptDecision({
    streak: 0,
    dailyRitualsCount: 0,
    inviteCode: 'invalid',
  });
  assert.deepEqual(noneDecision, {
    shouldShow: false,
    reason: 'none',
    routeIntent: { target: 'daily' },
  });
});

runCase('mobile env resolver derives daily endpoint from analytics endpoint', () => {
  const dailyUrl = resolveMobileDailyApiUrl({
    EXPO_PUBLIC_ANALYTICS_ENDPOINT: 'https://cinema.example.com/api/analytics?mode=debug',
  });
  assert.equal(dailyUrl, 'https://cinema.example.com/api/daily');
});

runCase('mobile env resolver keeps explicit web base and strips query/hash', () => {
  const webBase = resolveMobileWebBaseUrl({
    EXPO_PUBLIC_WEB_APP_URL: 'https://cinema.example.com/app/?mode=dev#anchor',
  });
  assert.equal(webBase, 'https://cinema.example.com/app');
});

runCase('mobile env resolver supports default Expo public env reads', () => {
  const previousWebAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
  process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://cinema.example.com/runtime/';
  try {
    assert.equal(resolveMobileWebBaseUrl(), 'https://cinema.example.com/runtime');
  } finally {
    if (typeof previousWebAppUrl === 'string') {
      process.env.EXPO_PUBLIC_WEB_APP_URL = previousWebAppUrl;
    } else {
      delete process.env.EXPO_PUBLIC_WEB_APP_URL;
    }
  }
});

runCase('mobile env resolver falls back from daily endpoint to referral/push base', () => {
  const env = {
    EXPO_PUBLIC_DAILY_API_URL: 'https://cinema.example.com/api/daily',
  };
  assert.equal(resolveMobileReferralApiBase(env), 'https://cinema.example.com');
  assert.equal(resolveMobilePushApiBase(env), 'https://cinema.example.com');
});

runCase('mobile env resolver rejects non-http URLs for base', () => {
  assert.equal(normalizeBaseUrl('absolutecinema://open'), '');
});

runCase('mobile public profile builder emits canonical id route', () => {
  const profileUrl = buildMobilePublicProfileUrl({
    webBaseUrl: 'https://cinema.example.com/app',
    userId: '123e4567',
    username: 'neo',
    allowNameFallback: false,
  });
  assert.equal(profileUrl, 'https://cinema.example.com/app/#/u/id%3A123e4567?name=neo');
  assert.equal(
    isAllowedMobilePublicProfileUrl({
      webBaseUrl: 'https://cinema.example.com/app',
      candidateUrl: profileUrl,
      allowNameFallback: false,
    }),
    true
  );
});

runCase('mobile public profile guard blocks external and non-profile routes', () => {
  assert.equal(
    isAllowedMobilePublicProfileUrl({
      webBaseUrl: 'https://cinema.example.com/app',
      candidateUrl: 'https://evil.example.com/app/#/u/id%3A123e4567',
      allowNameFallback: false,
    }),
    false
  );
  assert.equal(
    isAllowedMobilePublicProfileUrl({
      webBaseUrl: 'https://cinema.example.com/app',
      candidateUrl: 'https://cinema.example.com/app/#/discover/mood-films',
      allowNameFallback: false,
    }),
    false
  );
});

runCase('mobile public profile builder blocks name route when fallback disabled', () => {
  const profileUrl = buildMobilePublicProfileUrl({
    webBaseUrl: 'https://cinema.example.com/app',
    username: 'cineast_pro',
    allowNameFallback: false,
  });
  assert.equal(profileUrl, '');
});

runCase('mobile author identity key normalizes case and spacing', () => {
  assert.equal(toAuthorIdentityKey('  Cineast   Pro  '), 'cineast pro');
  assert.equal(toAuthorIdentityKey(''), '');
  assert.equal(toAuthorIdentityKey(null), '');
});

runCase('analytics event names remain unique and include mobile funnel signals', () => {
  const uniqueCount = new Set(ANALYTICS_EVENT_NAMES).size;
  assert.equal(uniqueCount, ANALYTICS_EVENT_NAMES.length);
  assert.ok(ANALYTICS_EVENT_NAMES.includes('app_opened_from_invite'));
  assert.ok(ANALYTICS_EVENT_NAMES.includes('web_to_app_prompt_clicked'));
});

if (failed) {
  console.error('[mobile-contract-smoke] FAILED');
  process.exit(1);
}

console.info('[mobile-contract-smoke] PASS');
