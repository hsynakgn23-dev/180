import { supabase } from './supabase';

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RitualAuthorRow = {
  author?: string | null;
  user_id?: string | null;
};

type ProfileAuthorRow = {
  display_name?: string | null;
  user_id?: string | null;
};

const MAX_AUTHOR_COUNT = 120;
const MAX_AUTHOR_LENGTH = 80;
const QUERY_CHUNK_SIZE = 36;

const normalizeText = (value: unknown, maxLength = 120): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

export const toAuthorIdentityKey = (value: unknown): string =>
  normalizeText(value, MAX_AUTHOR_LENGTH).replace(/\s+/g, ' ').toLowerCase();

const isSupabaseCapabilityError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01' || code === '42501') return true;
  return (
    message.includes('relation "') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('jwt') ||
    message.includes('forbidden')
  );
};

const sanitizeAuthorNames = (authors: string[]): string[] => {
  const byKey = new Map<string, string>();
  for (const author of authors) {
    const normalized = normalizeText(author, MAX_AUTHOR_LENGTH);
    const key = toAuthorIdentityKey(normalized);
    if (!normalized || !key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, normalized);
    }
    if (byKey.size >= MAX_AUTHOR_COUNT) break;
  }
  return Array.from(byKey.values());
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const mergeMap = (
  map: Map<string, string>,
  rows: Array<{ authorName: string; userId: string }>
): void => {
  for (const row of rows) {
    const key = toAuthorIdentityKey(row.authorName);
    const userId = normalizeText(row.userId, 120);
    if (!key || !userId || map.has(key)) continue;
    map.set(key, userId);
  }
};

export const resolveUserIdsByAuthorNames = async (
  authorNames: string[]
): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>();
  if (!supabase) return resolved;

  const sanitizedNames = sanitizeAuthorNames(authorNames);
  if (sanitizedNames.length === 0) return resolved;

  for (const chunk of chunkArray(sanitizedNames, QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('rituals')
      .select('author,user_id')
      .in('author', chunk)
      .limit(900);

    if (error) {
      if (isSupabaseCapabilityError(error)) continue;
      continue;
    }

    const rows = Array.isArray(data) ? (data as RitualAuthorRow[]) : [];
    const merged = rows
      .map((row) => ({
        authorName: normalizeText(row.author, MAX_AUTHOR_LENGTH),
        userId: normalizeText(row.user_id, 120),
      }))
      .filter((row) => Boolean(row.authorName && row.userId));
    mergeMap(resolved, merged);
  }

  const unresolvedNames = sanitizedNames.filter((author) => !resolved.has(toAuthorIdentityKey(author)));
  if (unresolvedNames.length === 0) return resolved;

  for (const chunk of chunkArray(unresolvedNames, QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('profiles_public')
      .select('display_name,user_id')
      .in('display_name', chunk)
      .limit(900);

    if (error) {
      if (isSupabaseCapabilityError(error)) continue;
      continue;
    }

    const rows = Array.isArray(data) ? (data as ProfileAuthorRow[]) : [];
    const merged = rows
      .map((row) => ({
        authorName: normalizeText(row.display_name, MAX_AUTHOR_LENGTH),
        userId: normalizeText(row.user_id, 120),
      }))
      .filter((row) => Boolean(row.authorName && row.userId));
    mergeMap(resolved, merged);
  }

  return resolved;
};
