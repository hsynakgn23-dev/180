import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY env vars.');
    process.exit(1);
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const section = (title) => {
    console.log(`\n=== ${title} ===`);
};

const checkRead = async (client, table, queryBuilder) => {
    const query = queryBuilder ? queryBuilder(client.from(table)) : client.from(table).select('*').limit(1);
    const { data, error } = await query;
    if (error) {
        console.error(`[${table}] read failed:`, error.message);
        return false;
    }
    console.log(`[${table}] read ok (${Array.isArray(data) ? data.length : 0} row sample).`);
    return true;
};

const testAnonRead = async () => {
    section('Anon Read Checks');
    const today = new Date().toISOString().split('T')[0];

    await checkRead(anonClient, 'daily_showcase', (q) => q.select('*').eq('date', today).limit(1));
    await checkRead(anonClient, 'rituals');
    await checkRead(anonClient, 'ritual_echoes');
    await checkRead(anonClient, 'ritual_replies');
};

const testServiceWrite = async () => {
    section('Service Role Write Check');
    if (!serviceClient) {
        console.log('Skipped (SUPABASE_SERVICE_ROLE_KEY not set).');
        return;
    }

    const { data, error } = await serviceClient
        .from('rituals')
        .insert([
            {
                author: 'System Test',
                movie_title: 'Inception',
                text: 'Connection verification entry.',
                poster_path: '/test.jpg',
                timestamp: new Date().toISOString()
            }
        ])
        .select('id')
        .single();

    if (error) {
        console.error('Write failed with service role:', error.message);
        return;
    }

    console.log('Write succeeded with service role. Ritual ID:', data.id);
    const { error: deleteError } = await serviceClient.from('rituals').delete().eq('id', data.id);
    if (deleteError) {
        console.error('Cleanup failed:', deleteError.message);
        return;
    }
    console.log('Cleanup succeeded.');
};

const run = async () => {
    section('Supabase Connection Test');
    await testAnonRead();
    await testServiceWrite();
};

run().catch((error) => {
    console.error('Unexpected test error:', error);
    process.exit(1);
});
