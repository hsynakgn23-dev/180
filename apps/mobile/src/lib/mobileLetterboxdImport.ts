import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileWatchedMovie } from './mobileProfileWatchedMovies';

const STORAGE_KEY_PREFIX = 'ac_mobile_letterboxd_import_v1_';

type LetterboxdImportMovie = MobileWatchedMovie & {
  source: 'letterboxd';
};

type StoredMobileLetterboxdImport = {
  movieIds: number[];
  titleKeys: string[];
  totalRows: number;
  importedRows: number;
  importedAt: string;
  sourceFileName?: string;
  items: LetterboxdImportMovie[];
};

type MobileLetterboxdCsvAnalysis = {
  parse: {
    totalRows: number;
    importedRows: number;
    movieIds: number[];
    titleKeys: string[];
  };
  items: LetterboxdImportMovie[];
};

type MobileLetterboxdImportResult =
  | {
      ok: true;
      message: string;
      analysis: MobileLetterboxdCsvAnalysis;
      snapshot: StoredMobileLetterboxdImport;
    }
  | {
      ok: false;
      message: string;
    };

const normalizeText = (value: unknown, maxLength = 220): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const normalizeIdentity = (identity: string): string => identity.trim().toLowerCase();

const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const normalizeTitleKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseCsvRows = (rawInput: string): string[][] => {
  const input = rawInput.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      if (currentRow.some((entry) => entry.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((entry) => entry.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
};

const findColumnIndex = (headers: string[], variants: string[]): number => {
  for (const variant of variants) {
    const index = headers.indexOf(variant);
    if (index >= 0) return index;
  }
  return -1;
};

const parsePositiveInt = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseYear = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1888 || parsed > 2200) return null;
  return parsed;
};

const detectColumnIndexes = (normalizedHeaders: string[]) => ({
  titleIndex: findColumnIndex(normalizedHeaders, ['name', 'title', 'filmtitle']),
  yearIndex: findColumnIndex(normalizedHeaders, ['year', 'releaseyear']),
  tmdbIdIndex: findColumnIndex(normalizedHeaders, ['tmdbid', 'tmdb']),
  watchedDateIndex: findColumnIndex(normalizedHeaders, ['watcheddate', 'date', 'watched', 'datewatched']),
});

const trimCell = (row: string[], index: number): string => {
  if (index < 0 || index >= row.length) return '';
  return normalizeText(row[index], 280);
};

const getLocalDateKey = (value = new Date()): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeWatchedAt = (rawDate: string, year: number | null, index: number): string => {
  const directMs = Date.parse(rawDate);
  if (Number.isFinite(directMs)) {
    return new Date(directMs).toISOString();
  }

  if (year) {
    return new Date(Date.UTC(year, 0, 1, 12, index % 60, 0)).toISOString();
  }

  return new Date(Date.UTC(1970, 0, 1, 12, index % 60, 0)).toISOString();
};

const toMovieKey = (movieTitle: string, year: number | null): string =>
  `${normalizeTitleKey(movieTitle)}::${year ?? ''}`;

const toDayKey = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '';
  return getLocalDateKey(new Date(parsed));
};

const sortMovies = <T extends MobileWatchedMovie>(items: T[]): T[] =>
  [...items].sort((left, right) => {
    const leftTime = Date.parse(left.watchedAt);
    const rightTime = Date.parse(right.watchedAt);
    if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
    if (!Number.isFinite(leftTime)) return 1;
    if (!Number.isFinite(rightTime)) return -1;
    return rightTime - leftTime;
  });

const mergeImportedMovie = (
  existing: LetterboxdImportMovie,
  next: LetterboxdImportMovie
): LetterboxdImportMovie => {
  const existingTime = Date.parse(existing.watchedAt);
  const nextTime = Date.parse(next.watchedAt);
  const nextIsNewer =
    Number.isFinite(nextTime) && (!Number.isFinite(existingTime) || nextTime > existingTime);

  return {
    ...existing,
    id: existing.id || next.id,
    posterPath: existing.posterPath || next.posterPath || null,
    watchedAt: nextIsNewer ? next.watchedAt : existing.watchedAt,
    watchedDayKey: nextIsNewer ? next.watchedDayKey : existing.watchedDayKey,
    watchCount: Math.max(existing.watchCount, next.watchCount),
    source: 'letterboxd',
  };
};

const dedupeImportedMovies = (items: LetterboxdImportMovie[]): LetterboxdImportMovie[] => {
  const deduped = new Map<string, LetterboxdImportMovie>();

  for (const item of items) {
    const movieTitle = normalizeText(item.movieTitle, 180);
    if (!movieTitle) continue;

    const year =
      typeof item.year === 'number' && Number.isFinite(item.year)
        ? Math.floor(item.year)
        : null;
    const key = toMovieKey(movieTitle, year);
    const nextItem: LetterboxdImportMovie = {
      ...item,
      id: normalizeText(item.id, 180) || `letterboxd:${key}`,
      movieTitle,
      year,
      posterPath: normalizeText(item.posterPath, 500) || null,
      watchedAt: normalizeText(item.watchedAt, 80) || new Date(0).toISOString(),
      watchedDayKey:
        normalizeText(item.watchedDayKey, 20) || toDayKey(normalizeText(item.watchedAt, 80)),
      watchCount: Math.max(1, Math.floor(Number(item.watchCount) || 1)),
      source: 'letterboxd',
    };
    const existing = deduped.get(key);
    deduped.set(key, existing ? mergeImportedMovie(existing, nextItem) : nextItem);
  }

  return sortMovies(Array.from(deduped.values()));
};

const buildImportedMovies = (rows: string[][]): MobileLetterboxdCsvAnalysis => {
  if (!rows.length) {
    return {
      parse: {
        totalRows: 0,
        importedRows: 0,
        movieIds: [],
        titleKeys: [],
      },
      items: [],
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const { titleIndex, yearIndex, tmdbIdIndex, watchedDateIndex } = detectColumnIndexes(
    normalizedHeaders
  );

  const movieIds = new Set<number>();
  const titleKeys = new Set<string>();
  const collected: LetterboxdImportMovie[] = [];
  const watchCountByMovieKey = new Map<string, number>();
  let importedRows = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rawTitle = trimCell(row, titleIndex);
    if (!rawTitle) continue;

    const rawYear = trimCell(row, yearIndex);
    const year = parseYear(rawYear);
    const titleKeyBase = normalizeTitleKey(rawTitle);
    if (!titleKeyBase) continue;

    const titleKey = year ? `${titleKeyBase} ${year}` : titleKeyBase;
    titleKeys.add(titleKeyBase);
    titleKeys.add(titleKey);

    const tmdbId = parsePositiveInt(trimCell(row, tmdbIdIndex));
    if (tmdbId) {
      movieIds.add(tmdbId);
    }

    const watchedAt = normalizeWatchedAt(trimCell(row, watchedDateIndex), year, rowIndex);
    const movieKey = toMovieKey(rawTitle, year);
    const watchCount = (watchCountByMovieKey.get(movieKey) || 0) + 1;
    watchCountByMovieKey.set(movieKey, watchCount);

    collected.push({
      id: `letterboxd:${titleKey}:${rowIndex}`,
      movieTitle: rawTitle,
      posterPath: null,
      year,
      watchedAt,
      watchedDayKey: toDayKey(watchedAt),
      watchCount,
      source: 'letterboxd',
    });
    importedRows += 1;
  }

  return {
    parse: {
      totalRows: Math.max(0, rows.length - 1),
      importedRows,
      movieIds: Array.from(movieIds).sort((left, right) => left - right),
      titleKeys: Array.from(titleKeys).sort((left, right) => left.localeCompare(right)),
    },
    items: dedupeImportedMovies(collected),
  };
};

const sanitizeStoredSnapshot = (value: unknown): StoredMobileLetterboxdImport | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value as Partial<StoredMobileLetterboxdImport>;
  const movieIds = Array.isArray(snapshot.movieIds)
    ? snapshot.movieIds.filter((entry) => Number.isInteger(entry) && entry > 0)
    : [];
  const titleKeys = Array.isArray(snapshot.titleKeys)
    ? snapshot.titleKeys
        .map((entry) => normalizeTitleKey(String(entry)))
        .filter(Boolean)
    : [];
  const items = Array.isArray(snapshot.items)
    ? dedupeImportedMovies(
        snapshot.items
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const candidate = item as Partial<LetterboxdImportMovie>;
            const movieTitle = normalizeText(candidate.movieTitle, 180);
            if (!movieTitle) return null;
            const year =
              typeof candidate.year === 'number' && Number.isFinite(candidate.year)
                ? Math.floor(candidate.year)
                : null;
            const watchedAt = normalizeText(candidate.watchedAt, 80) || new Date(0).toISOString();
            return {
              id:
                normalizeText(candidate.id, 180) ||
                `letterboxd:${toMovieKey(movieTitle, year)}`,
              movieTitle,
              posterPath: normalizeText(candidate.posterPath, 500) || null,
              year,
              watchedAt,
              watchedDayKey:
                normalizeText(candidate.watchedDayKey, 20) || toDayKey(watchedAt),
              watchCount: Math.max(1, Math.floor(Number(candidate.watchCount) || 1)),
              source: 'letterboxd' as const,
            };
          })
          .filter((entry): entry is LetterboxdImportMovie => Boolean(entry))
      )
    : [];

  return {
    movieIds: Array.from(new Set(movieIds)).sort((left, right) => left - right),
    titleKeys: Array.from(new Set(titleKeys)).sort((left, right) => left.localeCompare(right)),
    totalRows: Math.max(0, Math.floor(Number(snapshot.totalRows) || 0)),
    importedRows: Math.max(0, Math.floor(Number(snapshot.importedRows) || 0)),
    importedAt: normalizeText(snapshot.importedAt, 80),
    sourceFileName: normalizeText(snapshot.sourceFileName, 180) || undefined,
    items,
  };
};

export const analyzeMobileLetterboxdCsv = (csvText: string): MobileLetterboxdCsvAnalysis => {
  const rows = parseCsvRows(csvText);
  return buildImportedMovies(rows);
};

export const readStoredMobileLetterboxdImport = async (
  identity: string
): Promise<StoredMobileLetterboxdImport | null> => {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return null;

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${normalizedIdentity}`);
    if (!raw) return null;
    return sanitizeStoredSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const importMobileLetterboxdCsv = async (
  identity: string,
  csvText: string,
  sourceFileName?: string
): Promise<MobileLetterboxdImportResult> => {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) {
    return {
      ok: false,
      message: 'Letterboxd importu icin once giris yap.',
    };
  }

  const analysis = analyzeMobileLetterboxdCsv(csvText);
  if (analysis.parse.importedRows === 0 || analysis.items.length === 0) {
    return {
      ok: false,
      message: 'CSV icinde aktarilabilir film bulunamadi.',
    };
  }

  const previous = await readStoredMobileLetterboxdImport(normalizedIdentity);
  const snapshot: StoredMobileLetterboxdImport = {
    movieIds: Array.from(
      new Set([...(previous?.movieIds || []), ...analysis.parse.movieIds])
    ).sort((left, right) => left - right),
    titleKeys: Array.from(
      new Set([...(previous?.titleKeys || []), ...analysis.parse.titleKeys])
    ).sort((left, right) => left.localeCompare(right)),
    totalRows: (previous?.totalRows || 0) + analysis.parse.totalRows,
    importedRows: (previous?.importedRows || 0) + analysis.parse.importedRows,
    importedAt: new Date().toISOString(),
    sourceFileName: normalizeText(sourceFileName, 180) || previous?.sourceFileName,
    items: dedupeImportedMovies([...(previous?.items || []), ...analysis.items]),
  };

  await AsyncStorage.setItem(
    `${STORAGE_KEY_PREFIX}${normalizedIdentity}`,
    JSON.stringify(snapshot)
  );

  return {
    ok: true,
    message: `${analysis.items.length} film eklendi.`,
    analysis,
    snapshot,
  };
};

export const mergeLetterboxdImportIntoWatchedMovies = (
  liveItems: MobileWatchedMovie[],
  snapshot: StoredMobileLetterboxdImport | null,
  limit = 24
): MobileWatchedMovie[] => {
  const deduped = new Map<string, MobileWatchedMovie>();

  for (const item of liveItems) {
    const movieTitle = normalizeText(item.movieTitle, 180);
    if (!movieTitle) continue;
    const year =
      typeof item.year === 'number' && Number.isFinite(item.year)
        ? Math.floor(item.year)
        : null;
    deduped.set(toMovieKey(movieTitle, year), {
      ...item,
      movieTitle,
      year,
      source: item.source === 'letterboxd' ? 'letterboxd' : 'ritual',
    });
  }

  for (const item of snapshot?.items || []) {
    const movieTitle = normalizeText(item.movieTitle, 180);
    if (!movieTitle) continue;
    const year =
      typeof item.year === 'number' && Number.isFinite(item.year)
        ? Math.floor(item.year)
        : null;
    const key = toMovieKey(movieTitle, year);
    if (deduped.has(key)) continue;
    deduped.set(key, {
      ...item,
      movieTitle,
      year,
      source: 'letterboxd',
    });
  }

  return sortMovies(Array.from(deduped.values())).slice(0, Math.max(1, limit));
};

export const formatMobileLetterboxdSummary = (
  snapshot: StoredMobileLetterboxdImport | null
): string => {
  if (!snapshot || snapshot.items.length === 0) return '';
  return `${snapshot.items.length} film · ${snapshot.importedRows} kayit`;
};

export type { StoredMobileLetterboxdImport };
