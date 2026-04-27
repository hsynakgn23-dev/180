import assert from 'node:assert/strict';

import {
  getBearerToken,
  getHeader,
  getQueryParam,
  parseBody,
  requireAuth,
  sendJson,
} from '../../build/cloudrun/api/lib/httpHelpers.js';
import {
  WalletProfileAuthorizationError,
  loadWalletProfile,
  mutateWalletProfile,
} from '../../build/cloudrun/api/lib/progressionWallet.js';

const tests = [
  {
    name: 'httpHelpers',
    run: async () => {
      const response = sendJson({}, 202, { ok: true }, { 'x-test': '1' });
      assert.ok(response instanceof Response);
      assert.equal(response.status, 202);
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(response.headers.get('x-test'), '1');
      assert.deepEqual(await response.json(), { ok: true });

      assert.equal(getHeader({ headers: new Headers({ Authorization: ' Bearer token ' }) }, 'authorization'), 'Bearer token');
      assert.equal(getHeader({ headers: { authorization: ' value ' } }, 'authorization'), 'value');
      assert.equal(getHeader({}, 'authorization'), '');

      assert.equal(getBearerToken({ headers: { authorization: 'Bearer abc123  ' } }), 'abc123');
      assert.equal(getBearerToken({ headers: { authorization: 'Basic abc123' } }), null);
      assert.equal(getBearerToken({ headers: { authorization: 'Bearer    ' } }), null);

      assert.deepEqual(await parseBody({ body: { ok: true } }), { ok: true });

      const listeners = new Map();
      const request = {
        on(event, callback) {
          const existing = listeners.get(event) || [];
          existing.push(callback);
          listeners.set(event, existing);
        },
      };

      const parsedPromise = parseBody(request);
      for (const callback of listeners.get('data') || []) callback('{"value":');
      for (const callback of listeners.get('data') || []) callback('"ok"}');
      for (const callback of listeners.get('end') || []) callback();
      assert.deepEqual(await parsedPromise, { value: 'ok' });
      assert.equal(await parseBody({ on: request.on.bind(request) }), null);

      assert.equal(getQueryParam({ query: { movieId: ['abc', 'def'] } }, 'movieId'), 'abc');
      assert.equal(
        getQueryParam(
          {
            url: '/api/blur-quiz?exclude=1,2,3',
            headers: { host: 'example.test' },
          },
          'exclude'
        ),
        '1,2,3'
      );
      assert.equal(getQueryParam({ url: 'not a url' }, 'exclude'), null);

      const missingAuth = await requireAuth({}, {});
      assert.equal(missingAuth.ok, false);
      assert.ok(missingAuth.response instanceof Response);
      assert.equal(missingAuth.response.status, 401);
      assert.deepEqual(await missingAuth.response.json(), { ok: false, error: 'Missing authorization.' });

      const originalSupabaseUrl = process.env.SUPABASE_URL;
      const originalViteSupabaseUrl = process.env.VITE_SUPABASE_URL;
      const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        const missingConfig = await requireAuth(
          { headers: { authorization: 'Bearer test-token' } },
          {}
        );
        assert.equal(missingConfig.ok, false);
        assert.ok(missingConfig.response instanceof Response);
        assert.equal(missingConfig.response.status, 500);
        assert.deepEqual(await missingConfig.response.json(), { ok: false, error: 'Server config error.' });
      } finally {
        if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = originalSupabaseUrl;
        if (originalViteSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
        else process.env.VITE_SUPABASE_URL = originalViteSupabaseUrl;
        if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
      }
    },
  },
  {
    name: 'progressionWallet',
    run: async () => {
      const createUnusedSupabase = () => ({
        from() {
          throw new Error('Supabase should not be called when authorization fails first.');
        },
      });

      await assert.rejects(
        loadWalletProfile({
          supabase: createUnusedSupabase(),
          userId: 'wallet-owner',
          authenticatedUserId: 'different-user',
        }),
        (error) =>
          error instanceof WalletProfileAuthorizationError &&
          error.statusCode === 403 &&
          error.message.includes('forbidden')
      );

      let mutateCalled = false;
      await assert.rejects(
        mutateWalletProfile({
          supabase: createUnusedSupabase(),
          userId: 'wallet-owner',
          authenticatedUserId: 'different-user',
          mutate: async () => {
            mutateCalled = true;
            return {
              ok: true,
              result: { reached: true },
              wallet: {
                balance: 0,
                inventory: {
                  joker_fifty_fifty: 0,
                  joker_freeze: 0,
                  joker_pass: 0,
                  streak_shield: 0,
                },
                lifetimeEarned: 0,
                lifetimeSpent: 0,
                rewardedClaimsToday: 0,
                rewardedDate: null,
                lastRewardedClaimAt: null,
                premiumStarterGrantedAt: null,
                premiumStarterProductId: null,
                processedTopups: [],
              },
            };
          },
        }),
        WalletProfileAuthorizationError
      );

      assert.equal(mutateCalled, false);
    },
  },
];

const main = async () => {
  let failures = 0;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`PASS ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${test.name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(`PASS ${tests.length} focused cloudrun unit tests`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
