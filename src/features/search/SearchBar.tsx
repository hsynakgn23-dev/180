import { useCallback, useEffect, useRef, useState } from 'react';
import { searchAll, type MovieSearchResult, type UserSearchResult } from '../../lib/movieApi';
import { resolveImageUrl } from '../../lib/tmdbImage';

const SAGE = '#8A9A5B';
const CLAY = '#A57164';

const RECENT_SUGGESTIONS = ['Tarkovsky', 'Wong Kar-wai', 'Bergman', 'Varda'];

interface SearchBarProps {
  onMovieSelect?: (movieId: string) => void;
  onUserSelect?: (userId: string, username: string) => void;
}

// Skeleton shimmer row
const ShimmerFilmRow = () => (
  <div className="flex items-center gap-3.5 px-5 py-2.5">
    <div className="w-10 h-[60px] shrink-0 rounded bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-3/5 rounded bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
      <div className="h-2 w-2/5 rounded bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
    </div>
  </div>
);
const ShimmerUserRow = () => (
  <div className="flex items-center gap-3.5 px-5 py-2.5">
    <div className="w-9 h-9 rounded-full shrink-0 bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-2/5 rounded bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
      <div className="h-2 w-1/4 rounded bg-[#1c1c1c] animate-[searchShimmer_1.4s_linear_infinite] bg-[length:200%_100%]" />
    </div>
  </div>
);

export function SearchBar({ onMovieSelect, onUserSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<MovieSearchResult[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setOpen(false);
        setFocused(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setMovies([]);
      setUsers([]);
      setSearched(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const results = await searchAll(q.trim());
      setMovies(results.movies);
      setUsers(results.users);
      setSearched(true);
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
    if (val.trim().length >= 2) {
      setLoading(true);
      setOpen(true);
    } else {
      setLoading(false);
      setOpen(false);
      setSearched(false);
    }
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleMovieClick = (movie: MovieSearchResult) => {
    setOpen(false);
    setQuery('');
    setFocused(false);
    if (onMovieSelect) {
      onMovieSelect(movie.id);
    } else {
      window.location.hash = `/film/${encodeURIComponent(movie.id)}`;
    }
  };

  const handleUserClick = (user: UserSearchResult) => {
    setOpen(false);
    setQuery('');
    setFocused(false);
    const username = user.username || user.full_name || user.id;
    if (onUserSelect) {
      onUserSelect(user.id, username);
    } else {
      const key = `id:${user.id}`;
      const encoded = encodeURIComponent(key);
      const q = username ? `?name=${encodeURIComponent(username)}` : '';
      window.location.hash = `/u/${encoded}${q}`;
    }
  };

  const handleSuggestionClick = (s: string) => {
    setQuery(s);
    inputRef.current?.focus();
    doSearch(s);
  };

  const isEmpty = searched && !loading && movies.length === 0 && users.length === 0;
  const hasResults = movies.length > 0 || users.length > 0;
  const showDropdown = open && focused;

  return (
    <>
      <style>{`
        @keyframes searchShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes searchCaret {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
        {/* Hero label — only when not focused */}
        {!focused && (
          <div className="text-center mb-5">
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase text-sage mb-3">The Archive</div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white/90 mb-1">
              Find your next <span className="italic font-normal text-white/50">ritual</span>.
            </h2>
            <p className="text-sm text-white/35 italic">Search films, directors and fellow observers.</p>
          </div>
        )}
        {focused && (
          <div className="text-center mb-4">
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40" style={{ color: SAGE }}>The Archive</div>
          </div>
        )}

        {/* Input */}
        <div className={`flex items-center gap-3.5 px-6 py-5 rounded-lg border transition-all duration-200 ${
          focused
            ? 'bg-[#0c0c0c] border-sage/40 shadow-[0_0_0_4px_rgba(138,154,91,0.06),0_12px_30px_-10px_rgba(0,0,0,0.5)]'
            : 'bg-white/[0.03] border-white/10 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] cursor-text'
        }`}
          onClick={() => inputRef.current?.focus()}
        >
          <svg className="w-4.5 h-4.5 shrink-0" width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke={focused ? SAGE : '#8e8b84'} strokeWidth="1.75">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
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
            onBlur={() => setTimeout(() => { setFocused(false); setOpen(false); }, 180)}
            placeholder={focused ? '' : 'Search films, directors, users…'}
            className="flex-1 bg-transparent text-base text-white/85 placeholder-[#666] font-light outline-none min-w-0"
            aria-label="Arama"
            autoComplete="off"
          />
          {focused && query && (
            <span className="inline-block w-px h-[18px] bg-sage align-middle ml-0.5 animate-[searchCaret_1s_infinite]" />
          )}
          <span className={`font-mono text-[10px] font-bold tracking-[0.16em] px-2 py-1 rounded border shrink-0 ${
            focused
              ? 'border-white/10 text-[#8e8b84] bg-white/[0.03]'
              : 'border-white/10 text-[#8e8b84] bg-white/[0.03]'
          }`}>
            {focused ? 'ESC' : '⌘K'}
          </span>
        </div>

        {/* Recent chips — idle state */}
        {!focused && (
          <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
            <span className="text-[9px] text-white/25 uppercase tracking-[0.25em] self-center mr-1.5">Recent</span>
            {RECENT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => handleSuggestionClick(s)}
                className="text-[11px] px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.02] text-[#aaa] hover:border-white/20 hover:text-white/70 transition-all duration-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && (loading || hasResults || isEmpty) && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-lg border border-white/8 bg-[#141414] overflow-hidden shadow-[0_30px_60px_-16px_rgba(0,0,0,0.7)] text-left">

            {/* Loading */}
            {loading && (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: SAGE }}>Films</span>
                  <span className="font-mono text-[9px] text-white/20 tracking-[0.18em]">…</span>
                </div>
                <ShimmerFilmRow /><ShimmerFilmRow /><ShimmerFilmRow />
                <div className="h-px bg-white/6 mx-5 my-2" />
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: SAGE }}>Observers</span>
                  <span className="font-mono text-[9px] text-white/20 tracking-[0.18em]">…</span>
                </div>
                <ShimmerUserRow /><ShimmerUserRow />
              </>
            )}

            {/* Empty state */}
            {isEmpty && !loading && (
              <div className="px-7 py-10 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-clay/6 border border-clay/20 flex items-center justify-center">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={CLAY} strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" />
                    <path d="M7.5 11h7" opacity="0.6" />
                  </svg>
                </div>
                <div className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/35 mb-2.5">No results</div>
                <div className="text-lg text-white/80 font-normal mb-2">
                  Nothing for <span className="italic" style={{ color: CLAY }}>"{query}"</span>
                </div>
                <p className="text-xs text-white/30 italic leading-relaxed max-w-xs mx-auto">
                  The archive is silent. Try a director,<br />a year, or a single word.
                </p>
                <div className="mt-6 pt-4 border-t border-white/4 flex flex-wrap gap-1.5 justify-center">
                  {RECENT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => handleSuggestionClick(s)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.02] text-[#aaa] hover:border-white/20 transition-all"
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {hasResults && !loading && (
              <>
                {movies.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                      <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: SAGE }}>Films</span>
                      <span className="font-mono text-[9px] text-white/25 tracking-[0.18em]">{movies.length} RESULTS</span>
                    </div>
                    {movies.map((movie, idx) => {
                      const poster = resolveImageUrl(movie.poster_path, 'w200');
                      return (
                        <button
                          key={movie.id}
                          type="button"
                          onMouseDown={() => handleMovieClick(movie)}
                          className="group w-full flex items-center gap-3.5 px-5 py-2.5 transition-all duration-150 text-left border-l-2 border-transparent hover:border-sage/70 hover:bg-sage/5"
                        >
                          <div className="w-10 h-[60px] shrink-0 rounded overflow-hidden bg-white/5 border border-white/6">
                            {poster
                              ? <img src={poster} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full" style={{ background: `linear-gradient(160deg, #2a2a2a, #0d0d0d)` }} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white/85 font-medium truncate leading-snug">{movie.title}</div>
                            <div className="text-[10px] text-white/35 mt-1">
                              {movie.release_year && <span className="font-mono tracking-wider">{movie.release_year}</span>}
                              {movie.director && <><span className="mx-2 opacity-40">·</span><span className="uppercase tracking-[0.15em] text-[9px]">{movie.director}</span></>}
                            </div>
                          </div>
                          <span className="font-mono text-[9px] text-white/20 tracking-[0.18em] shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {movies.length > 0 && users.length > 0 && (
                  <div className="h-px bg-white/6 mx-5 my-2" />
                )}

                {users.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                      <span className="text-[9px] font-bold tracking-[0.25em] uppercase" style={{ color: SAGE }}>Observers</span>
                      <span className="font-mono text-[9px] text-white/25 tracking-[0.18em]">{users.length} RESULTS</span>
                    </div>
                    {users.map((user) => {
                      const displayName = user.full_name || user.username || '?';
                      const initials = displayName.slice(0, 2).toUpperCase();
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onMouseDown={() => handleUserClick(user)}
                          className="group w-full flex items-center gap-3.5 px-5 py-2.5 transition-all duration-150 text-left border-l-2 border-transparent hover:border-clay/70 hover:bg-clay/5"
                        >
                          <div className="w-9 h-9 rounded-full shrink-0 bg-white/10 flex items-center justify-center overflow-hidden border border-white/6">
                            {user.avatar_url
                              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-[11px] font-bold text-white/40">{initials}</span>
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-white/85 font-medium truncate">{displayName}</div>
                            {user.username && (
                              <div className="text-[10px] font-mono text-white/30 tracking-[0.04em]">@{user.username}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Bottom hint bar */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/4 bg-black/30">
                  <div className="flex items-center gap-3.5 text-[10px] text-white/30 font-mono tracking-[0.14em]">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded border border-white/12 bg-white/3 text-[9px]">↑↓</kbd>
                      navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded border border-white/12 bg-white/3 text-[9px]">↵</kbd>
                      open
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
