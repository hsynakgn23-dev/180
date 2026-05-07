import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchAll, type MovieSearchResult, type UserSearchResult } from '../lib/mobileSearchApi';

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w200';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchModalProps = {
  visible: boolean;
  onClose: () => void;
  onMovieSelect: (movieId: string, movieTitle: string) => void;
  onUserSelect: (userId: string, username: string) => void;
};

// ---------------------------------------------------------------------------
// Skeleton placeholder component
// ---------------------------------------------------------------------------

const SkeletonRow = ({ pulseAnim }: { pulseAnim: Animated.Value }) => {
  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });
  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonPoster} />
      <View style={styles.skeletonTextBlock}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonMeta} />
      </View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Avatar fallback (initials)
// ---------------------------------------------------------------------------

const getInitials = (name: string | null, username: string | null): string => {
  const source = name ?? username ?? '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

// ---------------------------------------------------------------------------
// SearchModal
// ---------------------------------------------------------------------------

export const SearchModal = ({
  visible,
  onClose,
  onMovieSelect,
  onUserSelect,
}: SearchModalProps) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState<MovieSearchResult[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Start / stop skeleton pulse animation based on loading state
  useEffect(() => {
    if (loading) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(0);
    }
  }, [loading, pulseAnim]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setMovies([]);
      setUsers([]);
      setLoading(false);
      setSearched(false);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    }
  }, [visible]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length < 2) {
      setMovies([]);
      setUsers([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      const q = query.trim();
      setLoading(true);
      setSearched(false);
      searchAll(q)
        .then(({ movies: m, users: u }) => {
          setMovies(m);
          setUsers(u);
        })
        .catch(() => {
          setMovies([]);
          setUsers([]);
        })
        .finally(() => {
          setLoading(false);
          setSearched(true);
        });
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const hasResults = movies.length > 0 || users.length > 0;
  const showEmpty = searched && !loading && !hasResults && query.trim().length >= 2;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
            <Text style={styles.backLabel}>Geri</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Ara</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Search input */}
        <View
          style={[
            styles.inputWrapper,
            inputFocused && styles.inputWrapperFocused,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={inputFocused ? COLORS.sage : 'rgba(255,255,255,0.4)'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Film veya kullanici ara…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoFocus={visible}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.sage} style={styles.inputSpinner} />
          ) : null}
        </View>

        {/* Results */}
        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Loading skeletons */}
          {loading && (
            <>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} pulseAnim={pulseAnim} />
              ))}
            </>
          )}

          {/* Empty state */}
          {showEmpty && (
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
            </View>
          )}

          {/* Movies section */}
          {!loading && movies.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>FİLMLER</Text>
              {movies.map((movie) => (
                <Pressable
                  key={movie.id}
                  style={({ pressed }) => [
                    styles.movieRow,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => onMovieSelect(movie.id, movie.title)}
                >
                  {/* Poster */}
                  {movie.poster_path ? (
                    <Image
                      source={{ uri: `${TMDB_POSTER_BASE}${movie.poster_path}` }}
                      style={styles.poster}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.poster, styles.posterFallback]}>
                      <Ionicons name="film-outline" size={14} color="rgba(255,255,255,0.3)" />
                    </View>
                  )}

                  {/* Text */}
                  <View style={styles.movieTextBlock}>
                    <Text style={styles.movieTitle} numberOfLines={2}>
                      {movie.title}
                    </Text>
                    <Text style={styles.movieMeta} numberOfLines={1}>
                      {[
                        movie.release_year ? String(movie.release_year) : null,
                        movie.director ?? null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {/* Users section */}
          {!loading && users.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>KULLANICLAR</Text>
              {users.map((user) => {
                const displayName = user.full_name ?? user.username ?? 'Kullanici';
                const handle = user.username ? `@${user.username}` : '';
                const initials = getInitials(user.full_name, user.username);
                return (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [
                      styles.userRow,
                      pressed && styles.rowPressed,
                    ]}
                    onPress={() => onUserSelect(user.id, user.username ?? user.id)}
                  >
                    {/* Avatar */}
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        style={styles.avatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      </View>
                    )}

                    {/* Text */}
                    <View style={styles.userTextBlock}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {handle ? (
                        <Text style={styles.userHandle} numberOfLines={1}>
                          {handle}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#121212',
  surface: '#1a1a1a',
  sage: '#A3B18A',
  clay: '#C4A882',
  white80: 'rgba(255,255,255,0.8)',
  white40: 'rgba(255,255,255,0.4)',
  white10: 'rgba(255,255,255,0.1)',
  white30: 'rgba(255,255,255,0.3)',
} as const;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.white10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backLabel: {
    color: COLORS.white80,
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.white80,
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    minWidth: 60,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  inputWrapperFocused: {
    borderColor: COLORS.sage,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: COLORS.white80,
    fontSize: 15,
    padding: 0,
  },
  inputSpinner: {
    marginLeft: 8,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    color: COLORS.white30,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  poster: {
    width: 28,
    height: 40,
    borderRadius: 4,
    backgroundColor: COLORS.white10,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieTextBlock: {
    flex: 1,
  },
  movieTitle: {
    color: COLORS.white80,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  movieMeta: {
    color: COLORS.white40,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white10,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: COLORS.white80,
    fontSize: 12,
    fontWeight: '600',
  },
  userTextBlock: {
    flex: 1,
  },
  userName: {
    color: COLORS.white80,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  userHandle: {
    color: COLORS.white40,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  rowPressed: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    color: COLORS.white40,
    fontSize: 15,
  },
  // Skeleton styles
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  skeletonPoster: {
    width: 28,
    height: 40,
    borderRadius: 4,
    backgroundColor: COLORS.white10,
  },
  skeletonTextBlock: {
    flex: 1,
    gap: 6,
  },
  skeletonTitle: {
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.white10,
    width: '70%',
  },
  skeletonMeta: {
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.white10,
    width: '45%',
  },
});
