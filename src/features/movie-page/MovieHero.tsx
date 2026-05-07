import { resolveImageUrl } from '../../lib/tmdbImage';
import type { MoviePageData } from '../../lib/movieApi';

interface MovieHeroProps {
  movie: MoviePageData;
  onClose: () => void;
  onWriteRitual: () => void;
}

export function MovieHero({ movie, onClose, onWriteRitual }: MovieHeroProps) {
  const backdrop = resolveImageUrl(movie.backdrop_path, 'w780');
  const poster = resolveImageUrl(movie.poster_path, 'w342');

  return (
    <div className="relative">
      {/* Backdrop */}
      {backdrop && (
        <div className="absolute inset-0 h-72 sm:h-96 overflow-hidden">
          <img
            src={backdrop}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/30 via-[#121212]/60 to-[#121212]" />
        </div>
      )}
      {!backdrop && (
        <div className="absolute inset-0 h-72 sm:h-96 bg-gradient-to-b from-sage/5 to-[#121212]" />
      )}

      {/* Back button */}
      <div className="relative z-10 flex justify-between items-start p-4 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Geri
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 pt-16 sm:pt-24 pb-6">
        <div className="flex gap-5 sm:gap-8 items-end">
          {/* Poster */}
          {poster && (
            <div className="shrink-0 w-24 sm:w-36 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10">
              <img src={poster} alt={movie.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1 pb-2">
            {movie.tagline && (
              <p className="text-sage/60 text-xs sm:text-sm italic mb-1.5 truncate">{movie.tagline}</p>
            )}
            <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight mb-2">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-white/40">
              {movie.release_year && <span>{movie.release_year}</span>}
              {movie.director && <span>· {movie.director}</span>}
              {movie.runtime && <span>· {movie.runtime} dk</span>}
              {movie.genre && <span>· {movie.genre}</span>}
              {movie.vote_average && (
                <span className="text-sage/70">★ {movie.vote_average.toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Write ritual button */}
        <button
          type="button"
          onClick={onWriteRitual}
          className="mt-5 flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 px-5 py-2.5 text-sm text-sage hover:bg-sage/20 hover:border-sage/50 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Ritual Yaz
        </button>
      </div>
    </div>
  );
}
