const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const TMDB_API_KEY = String(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '').trim();
const TMDB_API_BASE = 'https://api.themoviedb.org/3';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split('=');
    return [key, rest.join('=')];
  }),
);

const limit = Math.max(1, Number(args.get('--limit') || 50) || 50);
const offset = Math.max(0, Number(args.get('--offset') || 0) || 0);
const dryRun = args.has('--dry-run');
const onlyMissing = !args.has('--all');
const requestDelayMs = Math.max(0, Number(args.get('--delay-ms') || 150) || 150);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

if (!TMDB_API_KEY) {
  throw new Error('Missing TMDB_API_KEY or VITE_TMDB_API_KEY.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stripDiacritics = (value) =>
  String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const normalizeTitleKey = (value) =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dedupeTitles = (titles) => {
  const seen = new Set();
  const result = [];
  for (const title of titles) {
    const cleaned = String(title || '').trim();
    if (!cleaned) continue;
    const key = normalizeTitleKey(cleaned) || cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
};

const supabaseFetch = async (path, init = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);
  return { response, json };
};

const ensureTitleAliasesColumn = async () => {
  const { response, json } = await supabaseFetch('question_pool_movies?select=id,title_aliases&limit=1');
  if (response.ok) return;
  if (json?.code === '42703') {
    throw new Error('question_pool_movies.title_aliases kolonu Supabase tarafinda henuz yok. Once sql/migrations/20260330_blur_quiz_title_aliases.sql uygulanmali.');
  }
  throw new Error(`Supabase schema check failed: ${response.status} ${JSON.stringify(json)}`);
};

const fetchMovieBatch = async () => {
  const select = onlyMissing
    ? 'id,title,tmdb_id,title_aliases'
    : 'id,title,tmdb_id,title_aliases';
  const path = `question_pool_movies?select=${encodeURIComponent(select)}&tmdb_id=not.is.null&order=updated_at.asc.nullslast&limit=${limit}&offset=${offset}`;
  const { response, json } = await supabaseFetch(path);
  if (!response.ok || !Array.isArray(json)) {
    throw new Error(`Failed to fetch movie batch: ${response.status} ${JSON.stringify(json)}`);
  }
  if (!onlyMissing) return json;
  return json.filter((row) => !Array.isArray(row.title_aliases) || row.title_aliases.length === 0);
};

const fetchTmdbAliases = async (tmdbId, fallbackTitle) => {
  const titles = new Set();
  if (fallbackTitle) titles.add(String(fallbackTitle).trim());

  const response = await fetch(
    `${TMDB_API_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=alternative_titles,translations`,
    { signal: AbortSignal.timeout(5000) },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`TMDB ${tmdbId} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  if (payload?.title) titles.add(payload.title);
  if (payload?.original_title) titles.add(payload.original_title);
  for (const entry of payload?.alternative_titles?.titles || []) {
    if (entry?.title) titles.add(entry.title);
  }
  for (const translation of payload?.translations?.translations || []) {
    if (translation?.data?.title) titles.add(translation.data.title);
  }

  return dedupeTitles([...titles]);
};

const updateMovieAliases = async (movieId, titleAliases) => {
  const { response, json } = await supabaseFetch(`question_pool_movies?id=eq.${movieId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title_aliases: titleAliases,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update aliases for ${movieId}: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
};

await ensureTitleAliasesColumn();
const movies = await fetchMovieBatch();

if (movies.length === 0) {
  console.log(JSON.stringify({ ok: true, updated: 0, skipped: 0, message: 'No eligible movies found.' }, null, 2));
  process.exit(0);
}

let updated = 0;
let skipped = 0;
const samples = [];

for (const movie of movies) {
  const tmdbId = Number(movie.tmdb_id);
  const title = String(movie.title || '').trim();
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !title) {
    skipped += 1;
    continue;
  }

  const aliases = await fetchTmdbAliases(tmdbId, title);
  if (aliases.length === 0) {
    skipped += 1;
    continue;
  }

  samples.push({ id: movie.id, title, aliasCount: aliases.length, aliases: aliases.slice(0, 6) });

  if (!dryRun) {
    await updateMovieAliases(movie.id, aliases);
    updated += 1;
  }

  if (requestDelayMs > 0) {
    await sleep(requestDelayMs);
  }
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  offset,
  limit,
  onlyMissing,
  processed: movies.length,
  updated,
  skipped,
  samples: samples.slice(0, 10),
}, null, 2));
