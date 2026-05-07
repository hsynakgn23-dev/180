import { useCallback, useEffect, useRef, useState } from 'react';
import { searchAll, type MovieSearchResult, type UserSearchResult } from '../../lib/movieApi';
import { resolveImageUrl } from '../../lib/tmdbImage';

interface SearchBarProps {
  onMovieSelect?: (movieId: string) => void;
  onUserSelect?: (userId: string, username: string) => void;
}

export function SearchBar({ onMovieSelect, onUserSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<MovieSearchResult[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setMovies([]);
      setUsers([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const results = await searchAll(q.trim());
      setMovies(results.movies);
      setUsers(results.users);
      setOpen(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleMovieClick = (movie: MovieSearchResult) => {
    setOpen(false);
    setQuery('');
    if (onMovieSelect) {
      onMovieSelect(movie.id);
    } else {
      window.location.hash = `/film/${encodeURIComponent(movie.id)}`;
    }
  };

  const handleUserClick = (user: UserSearchResult) => {
    setOpen(false);
    setQuery('');
    const username = user.username || user.full_name || user.id;
    if (onUserSelect) {
      onUserSelect(user.id, username);
    } else {
      const key = `id:${user.id}`;
      const encoded = encodeURIComponent(key);
      const query = username ? `?name=${encodeURIComponent(username)}` : '';
      window.location.hash = `/u/${encoded}${query}`;
    }
  };

  const hasResults = movies.length > 0 || users.length > 0;
  const showDropdown = open && focused && (hasResults || loading);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200 ${focused ? 'border-sage/50 bg-[#181818]' : 'border-white/10 bg-white/5'}`}>
        {/* Search icon */}
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => {
            setFocused(true);
            if (query.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => {
            // Delay to allow click events on results
            setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Film veya kullanıcı ara…"
          className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none min-w-0"
          aria-label="Arama"
          autoComplete="off"
        />
        {loading && (
          <svg className="w-3.5 h-3.5 text-sage/50 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {!loading && (
          <span className="hidden sm:block text-[10px] text-white/20 tracking-wider shrink-0">⌘K</span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-[#181818] shadow-2xl overflow-hidden animate-fade-in">
          {movies.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/25 border-b border-white/5">Filmler</div>
              {movies.map((movie) => {
                const poster = resolveImageUrl(movie.poster_path, 'w200');
                return (
                  <button
                    key={movie.id}
                    type="button"
                    onMouseDown={() => handleMovieClick(movie)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-7 h-10 rounded overflow-hidden shrink-0 bg-white/5">
                      {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white/80 truncate">{movie.title}</div>
                      <div className="text-[10px] text-white/30 truncate">
                        {[movie.release_year, movie.director].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {movie.vote_average && (
                      <div className="text-[10px] text-sage/60 shrink-0">{movie.vote_average.toFixed(1)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {users.length > 0 && (
            <div className={movies.length > 0 ? 'border-t border-white/5' : ''}>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/25 border-b border-white/5">Kullanıcılar</div>
              {users.map((user) => {
                const avatarSrc = user.avatar_url || null;
                const displayName = user.full_name || user.username || '?';
                const initials = displayName.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={() => handleUserClick(user)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full shrink-0 bg-white/10 flex items-center justify-center overflow-hidden">
                      {avatarSrc
                        ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[10px] font-bold text-white/50">{initials}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white/80 truncate">{displayName}</div>
                      {user.username && user.full_name && (
                        <div className="text-[10px] text-white/30">@{user.username}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
