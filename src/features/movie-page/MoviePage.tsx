import { useEffect, useState } from 'react';
import { fetchMoviePage, type MoviePageResponse } from '../../lib/movieApi';
import { resolveImageUrl } from '../../lib/tmdbImage';
import { MovieHero } from './MovieHero';
import { MovieRecommendations } from './MovieRecommendations';
import { MovieRitualSection } from './MovieRitualSection';

interface MoviePageProps {
  movieId: string;
  onClose?: () => void;
}

export function MoviePage({ movieId, onClose }: MoviePageProps) {
  const [data, setData] = useState<MoviePageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMovieId, setCurrentMovieId] = useState(movieId);

  useEffect(() => {
    setCurrentMovieId(movieId);
  }, [movieId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);

    fetchMoviePage(currentMovieId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Film yüklenemedi');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [currentMovieId]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  const handleMovieSelect = (id: string) => {
    setCurrentMovieId(id);
    window.location.hash = `/film/${encodeURIComponent(id)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openWriteOverlay = () => {
    // Scroll to ritual section
    setTimeout(() => {
      document.getElementById('ritual-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#121212] flex items-center justify-center">
        <svg className="w-8 h-8 text-sage/30 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm">{error || 'Film bulunamadı'}</p>
        <button type="button" onClick={handleClose} className="text-sage/60 text-sm underline">
          Geri Dön
        </button>
      </div>
    );
  }

  const { movie, recommendations } = data;

  return (
    <div className="fixed inset-0 z-40 bg-[#121212] overflow-y-auto">
        <div className="max-w-2xl mx-auto min-h-full">
          <MovieHero
            movie={movie}
            onClose={handleClose}
            onWriteRitual={openWriteOverlay}
          />

          {/* Overview */}
          {movie.overview && (
            <div className="px-4 sm:px-6 py-4 border-t border-white/5">
              <p className="text-sm text-white/50 leading-relaxed">{movie.overview}</p>
            </div>
          )}

          {/* Cast */}
          {movie.cast_details && movie.cast_details.length > 0 && (
            <div className="px-4 sm:px-6 py-6 border-t border-white/5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-4">Oyuncular</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {movie.cast_details.map((actor, i) => {
                  const profile = resolveImageUrl(actor.profile_path, 'w200');
                  return (
                    <div key={i} className="flex-shrink-0 w-16 text-center">
                      <div className="w-14 h-14 rounded-full mx-auto mb-1.5 bg-white/5 overflow-hidden border border-white/5">
                        {profile
                          ? <img src={profile} alt={actor.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">
                              {actor.name.slice(0, 2).toUpperCase()}
                            </div>
                        }
                      </div>
                      <div className="text-[9px] text-white/50 truncate leading-tight">{actor.name}</div>
                      <div className="text-[8px] text-white/25 truncate leading-tight italic">{actor.character}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ritual section */}
          <div id="ritual-section">
            <MovieRitualSection
              poolMovieId={movie.id}
              movieTitle={movie.title}
            />
          </div>

          {/* Recommendations */}
          <MovieRecommendations
            movies={recommendations}
            onMovieSelect={handleMovieSelect}
          />

          {/* Bottom padding */}
          <div className="h-12" />
        </div>
    </div>
  );
}
