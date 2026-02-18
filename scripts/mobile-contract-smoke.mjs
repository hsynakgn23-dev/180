import assert from 'node:assert/strict';

const routeModule = await import('../packages/shared/src/mobile/mobileRouteContract.ts');
const screenModule = await import('../packages/shared/src/mobile/mobileScreenMap.ts');
const deepLinkModule = await import('../packages/shared/src/mobile/deepLinks.ts');
const promptModule = await import('../packages/shared/src/mobile/mobileWebPromptContract.ts');
const analyticsModule = await import('../packages/shared/src/mobile/analyticsEvents.ts');

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

runCase('screen map resolves invite target', () => {
  const screenPlan = resolveMobileScreenPlan({ target: 'invite', invite: 'ABC12345' });
  assert.deepEqual(screenPlan, {
    screen: 'invite_claim',
    params: { invite: 'ABC12345' },
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
