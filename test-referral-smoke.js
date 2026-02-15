import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const loadDotEnvFile = (path = '.env') => {
    if (!fs.existsSync(path)) return;
    const raw = fs.readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx < 1) continue;
        const key = trimmed.slice(0, idx).trim();
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = trimmed.slice(idx + 1).trim();
    }
};

loadDotEnvFile('.env');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const REFERRAL_API_BASE = (process.env.REFERRAL_API_BASE || process.env.VITE_REFERRAL_API_BASE || '').trim();

const INVITER_EMAIL = (process.env.REFERRAL_TEST_INVITER_EMAIL || '').trim();
const INVITER_PASSWORD = (process.env.REFERRAL_TEST_INVITER_PASSWORD || '').trim();
const INVITEE_EMAIL = (process.env.REFERRAL_TEST_INVITEE_EMAIL || '').trim();
const INVITEE_PASSWORD = (process.env.REFERRAL_TEST_INVITEE_PASSWORD || '').trim();
const FALLBACK_DEVICE_KEY = `dev-smoke-${Date.now().toString(36)}`;
const DEVICE_KEY = (
    process.env.REFERRAL_TEST_DEVICE_KEY ||
    process.env.REFERRAL_DEVICE_KEY ||
    FALLBACK_DEVICE_KEY
).trim();

const INVITE_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const MODE = (process.argv[2] || 'e2e').trim().toLowerCase();

const findArgValue = (prefix) => {
    const arg = process.argv.find((item) => item.startsWith(`${prefix}=`));
    if (!arg) return '';
    return String(arg.split('=').slice(1).join('=')).trim();
};

const CODE_FROM_ARG = findArgValue('--code').toUpperCase();

const section = (label) => {
    console.log(`\n=== ${label} ===`);
};

const fail = (message, detail) => {
    console.error(`[FAIL] ${message}`);
    if (detail) {
        console.error(detail);
    }
    process.exit(1);
};

const normalizeBase = (value) => value.replace(/\/+$/, '');

const ensureConfig = () => {
    if (!SUPABASE_URL) fail('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
    if (!SUPABASE_ANON_KEY) fail('Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.');
    if (!REFERRAL_API_BASE) fail('Missing REFERRAL_API_BASE (or VITE_REFERRAL_API_BASE).');
};

const createSupabaseClient = () =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });

const signIn = async (email, password, label) => {
    if (!email || !password) {
        fail(`Missing ${label} credentials.`, `Set ${label}_EMAIL and ${label}_PASSWORD env vars.`);
    }
    const client = createSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token || !data.user?.id) {
        fail(`${label} sign in failed.`, error?.message || 'No session returned.');
    }
    return {
        token: data.session.access_token,
        userId: data.user.id,
        email: data.user.email || email
    };
};

const parseJsonSafe = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const postApi = async (path, token, payload) => {
    const base = normalizeBase(REFERRAL_API_BASE);
    const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
    const json = await parseJsonSafe(response);
    return {
        status: response.status,
        ok: response.ok,
        body: json
    };
};

const assertInviteCode = (value) => {
    const code = String(value || '').trim().toUpperCase();
    if (!INVITE_CODE_REGEX.test(code)) {
        fail('Invite code is invalid in API response.', code);
    }
    return code;
};

const runCreateOnly = async () => {
    section('Create Invite');
    const inviter = await signIn(INVITER_EMAIL, INVITER_PASSWORD, 'REFERRAL_TEST_INVITER');
    const createResult = await postApi('/api/referral/create', inviter.token, {
        seed: inviter.email
    });

    if (!createResult.ok || createResult.body?.ok !== true || !createResult.body?.data?.code) {
        fail('Create endpoint failed.', JSON.stringify(createResult, null, 2));
    }

    const code = assertInviteCode(createResult.body.data.code);
    console.log(`[OK] invite code: ${code}`);
    console.log(`[OK] created: ${Boolean(createResult.body.data.created)}`);
    console.log(`[OK] claimCount: ${Number(createResult.body.data.claimCount || 0)}`);
};

const runClaimOnly = async () => {
    section('Claim Invite');
    const code = assertInviteCode(CODE_FROM_ARG || process.env.REFERRAL_TEST_CODE || '');
    const invitee = await signIn(INVITEE_EMAIL, INVITEE_PASSWORD, 'REFERRAL_TEST_INVITEE');
    const claimResult = await postApi('/api/referral/claim', invitee.token, {
        code,
        deviceKey: DEVICE_KEY
    });

    if (!claimResult.ok || claimResult.body?.ok !== true || !claimResult.body?.data?.code) {
        fail('Claim endpoint failed.', JSON.stringify(claimResult, null, 2));
    }

    console.log(`[OK] code: ${claimResult.body.data.code}`);
    console.log(`[OK] inviterRewardXp: ${claimResult.body.data.inviterRewardXp}`);
    console.log(`[OK] inviteeRewardXp: ${claimResult.body.data.inviteeRewardXp}`);
    console.log(`[OK] claimCount: ${claimResult.body.data.claimCount}`);
};

const runE2E = async () => {
    section('E2E Invite Create + Claim');
    const inviter = await signIn(INVITER_EMAIL, INVITER_PASSWORD, 'REFERRAL_TEST_INVITER');
    const invitee = await signIn(INVITEE_EMAIL, INVITEE_PASSWORD, 'REFERRAL_TEST_INVITEE');

    const createResult = await postApi('/api/referral/create', inviter.token, {
        seed: inviter.email
    });
    if (!createResult.ok || createResult.body?.ok !== true || !createResult.body?.data?.code) {
        fail('Create endpoint failed.', JSON.stringify(createResult, null, 2));
    }
    const code = assertInviteCode(createResult.body.data.code);
    console.log(`[OK] invite created/reused: ${code}`);

    const claimResult = await postApi('/api/referral/claim', invitee.token, {
        code,
        deviceKey: DEVICE_KEY
    });
    if (!claimResult.ok || claimResult.body?.ok !== true || !claimResult.body?.data?.code) {
        fail('Claim endpoint failed.', JSON.stringify(claimResult, null, 2));
    }
    console.log(`[OK] claim success for code ${claimResult.body.data.code}`);
    console.log(`[OK] rewards inviter=${claimResult.body.data.inviterRewardXp} invitee=${claimResult.body.data.inviteeRewardXp}`);

    const duplicateProbe = await postApi('/api/referral/claim', invitee.token, {
        code,
        deviceKey: DEVICE_KEY
    });
    const duplicateCode = String(duplicateProbe.body?.errorCode || '').toUpperCase();
    if (duplicateProbe.ok || duplicateProbe.body?.ok !== false || duplicateCode !== 'ALREADY_CLAIMED') {
        fail(
            'Duplicate claim probe did not return expected ALREADY_CLAIMED.',
            JSON.stringify(duplicateProbe, null, 2)
        );
    }
    console.log('[OK] duplicate claim blocked with ALREADY_CLAIMED');
};

const run = async () => {
    ensureConfig();
    section('Referral Smoke Runner');
    console.log(`mode=${MODE}`);
    console.log(`apiBase=${normalizeBase(REFERRAL_API_BASE)}`);
    console.log(`deviceKey=${DEVICE_KEY}`);

    if (MODE === 'create') {
        await runCreateOnly();
        return;
    }
    if (MODE === 'claim') {
        await runClaimOnly();
        return;
    }
    if (MODE === 'e2e') {
        await runE2E();
        return;
    }

    fail(`Unknown mode: ${MODE}`, 'Use one of: create, claim, e2e');
};

run().catch((error) => {
    fail('Unexpected runner error.', error instanceof Error ? error.stack || error.message : String(error));
});
