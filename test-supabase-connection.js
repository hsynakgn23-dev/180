
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aziamkechdrirrukhmgm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6aWFta2VjaGRyaXJydWtobWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzkxMjIsImV4cCI6MjA4NTgxNTEyMn0.IK7EpSthZyP3mGkjXefF7nFjKXJY3tsPSNfs1Ki7j7M';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
    console.log('🔌 Testing Supabase Connection...');

    // 1. Test Read (Daily Showcase)
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Checking Daily Showcase for: ${today}`);

    const { data: readData, error: readError } = await supabase
        .from('daily_showcase')
        .select('*')
        .eq('date', today);

    if (readError) {
        console.error('❌ Read Failed:', readError.message);
    } else {
        console.log('✅ Read Successful!');
        if (readData.length === 0) {
            console.log('   -> Database is currently empty for today (Expected for fresh setup).');
        } else {
            console.log(`   -> Found ${readData.length} entry/entries.`);
        }
    }

    // 2. Test Write (Dummy Ritual)
    // We'll try to insert a dummy ritual since that table is also open
    console.log('📝 Testing Write Permission (Rituals Table)...');
    const { data: writeData, error: writeError } = await supabase
        .from('rituals')
        .insert([
            {
                author: 'System Test',
                movie_title: 'Inception',
                text: 'Connection verification echo.',
                poster_path: '/test.jpg'
            }
        ])
        .select();

    if (writeError) {
        console.error('❌ Write Failed:', writeError.message);
        console.log('   (Did you run the SQL setup script in Supabase Dashboard?)');
    } else {
        console.log('✅ Write Successful! Ritual ID:', writeData[0].id);

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await supabase.from('rituals').delete().eq('id', writeData[0].id);
        console.log('✅ Cleanup Done.');
    }
}

testConnection();
