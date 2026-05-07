import { resolveImageUrl } from '../../lib/tmdbImage';
import type { MovieSearchResult } from '../../lib/movieApi';

interface MovieRecommendationsProps {
  movies: MovieSearchResult[];
  onMovieSelect: (movieId: string) => void;
}

export function MovieRecommendations({ movies, onMovieSelect }: MovieRecommendationsProps) {
  if (movies.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 py-6 border-t border-white/5">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-4">Benzer Filmler</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {movies.map((movie) => {
          const poster = resolveImageUrl(movie.poster_path, 'w200');
          return (
            <button
              key={movie.id}
              type="button"
              onClick={() => onMovieSelect(movie.id)}
              className="group text-left"
            >
              <div className="rounded-lg overflow-hidden border border-white/5 bg-white/5 mb-1.5 aspect-[2/3] group-hover:border-sage/30 transition-colors">
                {poster
                  ? <img src={poster} alt={movie.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/10 text-xs text-center p-2">{movie.title}</div>
                }
              </div>
              <div className="text-[10px] text-white/50 truncate leading-tight group-hover:text-white/70 transition-colors">
                {movie.title}
              </div>
              {movie.release_year && (
                <div className="text-[9px] text-white/25">{movie.release_year}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
