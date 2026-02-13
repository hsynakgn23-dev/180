const STORAGE_KEY_PREFIX = '180_letterboxd_import_v1_';
export const LETTERBOXD_IMPORT_UPDATED_EVENT = '180-letterboxd-import-updated';

export type LetterboxdImportPayload = {
    movieIds: number[];
    titleKeys: string[];
    totalRows: number;
    importedRows: number;
    importedAt: string;
    sourceFileName?: string;
};

export type StoredLetterboxdImport = {
    movieIds: number[];
    titleKeys: string[];
    totalRows: number;
    importedRows: number;
    importedAt: string;
    sourceFileName?: string;
};

export type LetterboxdParseResult = {
    totalRows: number;
    importedRows: number;
    movieIds: number[];
    titleKeys: string[];
};

export type LetterboxdDetectedMapping = {
    title: string | null;
    year: string | null;
    tmdbId: string | null;
    imdbId: string | null;
    watchedDate: string | null;
    rating: string | null;
};

export type LetterboxdPreviewRow = {
    title: string;
    year: string;
    tmdbId: string;
    imdbId: string;
    watchedDate: string;
    rating: string;
};

export type LetterboxdCsvAnalysis = {
    parse: LetterboxdParseResult;
    headers: string[];
    mapping: LetterboxdDetectedMapping;
    previewRows: LetterboxdPreviewRow[];
};

const normalizeIdentity = (identity: string): string => {
    return identity.trim().toLowerCase();
};

const normalizeHeader = (value: string): string => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
};

const normalizeTitleKey = (value: string): string => {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
};

const parseCsvRows = (rawInput: string): string[][] => {
    const input = rawInput.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        const nextChar = input[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i += 1;
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
                i += 1;
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

const detectColumnIndexes = (normalizedHeaders: string[]) => {
    return {
        titleIndex: findColumnIndex(normalizedHeaders, ['name', 'title', 'filmtitle']),
        yearIndex: findColumnIndex(normalizedHeaders, ['year', 'releaseyear']),
        tmdbIdIndex: findColumnIndex(normalizedHeaders, ['tmdbid', 'tmdb']),
        imdbIdIndex: findColumnIndex(normalizedHeaders, ['imdbid', 'imdburi', 'imdb']),
        watchedDateIndex: findColumnIndex(normalizedHeaders, ['watcheddate', 'date', 'watched', 'datewatched']),
        ratingIndex: findColumnIndex(normalizedHeaders, ['rating', 'stars'])
    };
};

const mapColumnName = (headers: string[], index: number): string | null => {
    if (index < 0 || index >= headers.length) return null;
    const value = (headers[index] || '').trim();
    return value || null;
};

const trimCell = (row: string[], index: number): string => {
    if (index < 0 || index >= row.length) return '';
    return (row[index] || '').trim();
};

export const analyzeLetterboxdCsv = (csvText: string): LetterboxdCsvAnalysis => {
    const rows = parseCsvRows(csvText);
    if (!rows.length) {
        return {
            parse: { totalRows: 0, importedRows: 0, movieIds: [], titleKeys: [] },
            headers: [],
            mapping: {
                title: null,
                year: null,
                tmdbId: null,
                imdbId: null,
                watchedDate: null,
                rating: null
            },
            previewRows: []
        };
    }

    const headers = rows[0].map((header) => header.trim());
    const normalizedHeaders = headers.map((header) => normalizeHeader(header));
    const {
        titleIndex,
        yearIndex,
        tmdbIdIndex,
        imdbIdIndex,
        watchedDateIndex,
        ratingIndex
    } = detectColumnIndexes(normalizedHeaders);

    const uniqueMovieIds = new Set<number>();
    const uniqueTitleKeys = new Set<string>();
    const previewRows: LetterboxdPreviewRow[] = [];
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
        uniqueTitleKeys.add(titleKey);
        uniqueTitleKeys.add(titleKeyBase);

        const tmdbId = parsePositiveInt(trimCell(row, tmdbIdIndex));
        if (tmdbId) {
            uniqueMovieIds.add(tmdbId);
        }

        if (previewRows.length < 5) {
            previewRows.push({
                title: rawTitle,
                year: rawYear,
                tmdbId: trimCell(row, tmdbIdIndex),
                imdbId: trimCell(row, imdbIdIndex),
                watchedDate: trimCell(row, watchedDateIndex),
                rating: trimCell(row, ratingIndex)
            });
        }

        importedRows += 1;
    }

    return {
        parse: {
            totalRows: Math.max(0, rows.length - 1),
            importedRows,
            movieIds: Array.from(uniqueMovieIds).sort((a, b) => a - b),
            titleKeys: Array.from(uniqueTitleKeys).sort((a, b) => a.localeCompare(b))
        },
        headers,
        mapping: {
            title: mapColumnName(headers, titleIndex),
            year: mapColumnName(headers, yearIndex),
            tmdbId: mapColumnName(headers, tmdbIdIndex),
            imdbId: mapColumnName(headers, imdbIdIndex),
            watchedDate: mapColumnName(headers, watchedDateIndex),
            rating: mapColumnName(headers, ratingIndex)
        },
        previewRows
    };
};

export const parseLetterboxdCsv = (csvText: string): LetterboxdParseResult => {
    return analyzeLetterboxdCsv(csvText).parse;
};

export const readStoredLetterboxdImport = (identity: string): StoredLetterboxdImport | null => {
    if (typeof window === 'undefined') return null;
    const normalizedIdentity = normalizeIdentity(identity);
    if (!normalizedIdentity) return null;
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${normalizedIdentity}`);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as StoredLetterboxdImport;
        const movieIds = Array.isArray(parsed.movieIds)
            ? parsed.movieIds.filter((value) => Number.isInteger(value) && value > 0)
            : [];
        const titleKeys = Array.isArray(parsed.titleKeys)
            ? parsed.titleKeys.map((value) => normalizeTitleKey(String(value))).filter(Boolean)
            : [];
        return {
            movieIds: Array.from(new Set(movieIds)).sort((a, b) => a - b),
            titleKeys: Array.from(new Set(titleKeys)).sort((a, b) => a.localeCompare(b)),
            totalRows: Number.isFinite(parsed.totalRows) ? Math.max(0, parsed.totalRows) : 0,
            importedRows: Number.isFinite(parsed.importedRows) ? Math.max(0, parsed.importedRows) : 0,
            importedAt: parsed.importedAt || '',
            sourceFileName: parsed.sourceFileName || undefined
        };
    } catch {
        return null;
    }
};

export const saveLetterboxdImport = (identity: string, payload: LetterboxdImportPayload): StoredLetterboxdImport | null => {
    if (typeof window === 'undefined') return null;
    const normalizedIdentity = normalizeIdentity(identity);
    if (!normalizedIdentity) return null;

    const previous = readStoredLetterboxdImport(normalizedIdentity);
    const next: StoredLetterboxdImport = {
        movieIds: Array.from(new Set([...(previous?.movieIds || []), ...payload.movieIds]))
            .filter((value) => Number.isInteger(value) && value > 0)
            .sort((a, b) => a - b),
        titleKeys: Array.from(
            new Set(
                [...(previous?.titleKeys || []), ...payload.titleKeys]
                    .map((value) => normalizeTitleKey(value))
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b)),
        totalRows: (previous?.totalRows || 0) + Math.max(0, payload.totalRows),
        importedRows: (previous?.importedRows || 0) + Math.max(0, payload.importedRows),
        importedAt: payload.importedAt,
        sourceFileName: payload.sourceFileName || previous?.sourceFileName
    };

    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${normalizedIdentity}`, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(LETTERBOXD_IMPORT_UPDATED_EVENT, { detail: { identity: normalizedIdentity } }));
    return next;
};
