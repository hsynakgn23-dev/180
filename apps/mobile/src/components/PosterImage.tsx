import { Image, type ImageContentFit, type ImageStyle, type ImageSource } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type PosterImageSize = 'small' | 'large';

export type PosterImageProps = {
  movieId?: number | null;
  posterPath?: string | null;
  size?: PosterImageSize;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  fallback?: React.ReactNode;
  fallbackLabel?: string;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackTextStyle?: StyleProp<TextStyle>;
  blurHash?: string | null;
  accessibilityLabel?: string;
  priority?: 'low' | 'normal' | 'high';
  transition?: number;
  blurRadius?: number;
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';
const DEFAULT_IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url=';
const SUPABASE_BASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_STORAGE_BUCKET = String(process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || 'posters').trim() || 'posters';
const POSTER_SIZE_MAP: Record<PosterImageSize, 'w342' | 'w500'> = {
  small: 'w342',
  large: 'w500',
};
const STORAGE_EXTENSIONS = ['webp', 'jpg', 'png'] as const;

const resolveImageProxyBase = (): string => {
  const configured = String(process.env.EXPO_PUBLIC_IMAGE_PROXIES || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return configured[0] || DEFAULT_IMAGE_PROXY_BASE;
};

const wrapWebPosterUrl = (absoluteUrl: string): string => {
  if (Platform.OS !== 'web') return absoluteUrl;
  if (!/^https?:\/\/image\.tmdb\.org\/t\/p\//i.test(absoluteUrl)) return absoluteUrl;

  const proxyBase = resolveImageProxyBase();
  const encoded = encodeURIComponent(absoluteUrl);
  const proxied = proxyBase.includes('{url}')
    ? proxyBase.replace('{url}', encoded)
    : `${proxyBase}${encoded}`;
  const separator = proxied.includes('?') ? '&' : '?';
  return /[?&]output=/i.test(proxied) ? proxied : `${proxied}${separator}output=webp`;
};

const dedupe = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const isOriginalCandidate = (value: string): boolean => /\/original(?:\/|[.?#]|$)/i.test(value);

const resolveStoragePosterCandidates = (
  normalized: string,
  size: 'w342' | 'w500',
  movieId?: number | null,
): string[] => {
  if (!SUPABASE_BASE_URL) return [];

  if (movieId) {
    return STORAGE_EXTENSIONS.map(
      (ext) => `${SUPABASE_BASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${movieId}/${size}.${ext}`,
    );
  }

  if (normalized.startsWith(STORAGE_PUBLIC_PATH)) {
    return [`${SUPABASE_BASE_URL}${normalized}`];
  }
  if (normalized.startsWith(STORAGE_PUBLIC_PATH.slice(1))) {
    return [`${SUPABASE_BASE_URL}/${normalized}`];
  }
  if (normalized.startsWith('object/public/')) {
    return [`${SUPABASE_BASE_URL}/storage/v1/${normalized}`];
  }
  if (normalized.startsWith(`${SUPABASE_STORAGE_BUCKET}/`)) {
    return [`${SUPABASE_BASE_URL}/storage/v1/object/public/${normalized}`];
  }

  return [];
};

const resolveExternalPosterUrl = (
  normalized: string,
  size: 'w342' | 'w500',
): string | null => {
  if (/^\/\//.test(normalized)) return wrapWebPosterUrl(`https:${normalized}`);

  if (/^https?:\/\//i.test(normalized)) {
    const tmdbMatch = normalized.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/i);
    if (tmdbMatch) {
      return wrapWebPosterUrl(`${TMDB_IMAGE_BASE}/${size}/${tmdbMatch[1]}`);
    }
    return normalized;
  }

  if (
    normalized.startsWith(STORAGE_PUBLIC_PATH) ||
    normalized.startsWith(STORAGE_PUBLIC_PATH.slice(1))
  ) {
    return null;
  }

  const normalizedPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return wrapWebPosterUrl(`${TMDB_IMAGE_BASE}/${size}${normalizedPath}`);
};

export const resolvePosterImageUris = (
  posterPath: string | null | undefined,
  options: { size?: PosterImageSize; movieId?: number | null } = {},
): string[] => {
  const normalized = String(posterPath || '').trim();
  if (!normalized && !options.movieId) return [];

  const size = POSTER_SIZE_MAP[options.size || 'small'];
  const storageCandidates = resolveStoragePosterCandidates(normalized, size, options.movieId);
  const external = normalized ? resolveExternalPosterUrl(normalized, size) : null;

  return dedupe([...storageCandidates, external || '']).filter(
    (candidate) => !isOriginalCandidate(candidate),
  );
};

export const PosterImage: React.FC<PosterImageProps> = ({
  movieId,
  posterPath,
  size = 'small',
  style,
  contentFit = 'cover',
  fallback,
  fallbackLabel = '180',
  fallbackStyle,
  fallbackTextStyle,
  blurHash,
  accessibilityLabel,
  priority = 'normal',
  transition = 160,
  blurRadius = 0,
}) => {
  const candidates = useMemo(
    () => resolvePosterImageUris(posterPath, { size, movieId }),
    [movieId, posterPath, size],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const placeholder = useMemo<ImageSource | null>(
    () => (blurHash ? { blurhash: blurHash, width: 16, height: 24 } : null),
    [blurHash],
  );
  const uri = candidates[candidateIndex] ?? null;

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  if (!uri) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <View style={[styles.fallback, fallbackStyle]} accessibilityLabel={accessibilityLabel}>
        <Text style={[styles.fallbackText, fallbackTextStyle]} numberOfLines={1}>
          {fallbackLabel}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit={contentFit}
      transition={transition}
      blurRadius={blurRadius}
      cachePolicy="disk"
      priority={priority}
      recyclingKey={uri}
      accessibilityLabel={accessibilityLabel}
      onError={() => {
        setCandidateIndex((current) => {
          const next = current + 1;
          return next < candidates.length ? next : current;
        });
      }}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  fallbackText: {
    color: 'rgba(229, 228, 226, 0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default PosterImage;
