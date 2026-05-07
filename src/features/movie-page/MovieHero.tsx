import { resolveImageUrl } from '../../lib/tmdbImage';
import type { MoviePageData } from '../../lib/movieApi';

const SAGE = '#8A9A5B';

interface MovieHeroProps {
  movie: MoviePageData;
  onClose: () => void;
  onWriteRitual: () => void;
}

export function MovieHero({ movie, onClose, onWriteRitual }: MovieHeroProps) {
  const backdrop = resolveImageUrl(movie.backdrop_path, 'w780');
  const poster = resolveImageUrl(movie.poster_path, 'w342');

  return (
    <section className="relative overflow-hidden" style={{ minHeight: 520 }}>
      {/* Backdrop layer */}
      <div className="absolute inset-0">
        {backdrop ? (
          <img src={backdrop} alt="" className="w-full h-full object-cover" style={{ filter: 'saturate(0.75) contrast(1.1)' }} />
        ) : (
          <div className="w-full h-full" style={{
            background: `radial-gradient(ellipse at 30% 30%, rgba(138,154,91,0.15), transparent 60%),
                         radial-gradient(ellipse at 70% 60%, rgba(165,113,100,0.12), transparent 65%),
                         linear-gradient(135deg, #1f1810 0%, #16131a 60%, #0a0a10 100%)`
          }} />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, #121212 0%, rgba(18,18,18,0.88) 35%, rgba(18,18,18,0.45) 65%, rgba(18,18,18,0.25) 100%)'
        }} />
        <div className="absolute top-0 left-0 right-0 h-36" style={{
          background: 'linear-gradient(to bottom, rgba(18,18,18,0.75), transparent)'
        }} />
      </div>

      {/* Back button */}
      <div className="relative z-10 p-4 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Geri
        </button>
      </div>

      {/* Hero content — poster + info side by side */}
      <div className="relative z-10 px-4 sm:px-8 pb-8 sm:pb-12 pt-4">
        <div className="flex gap-6 sm:gap-10 items-end max-w-4xl">
          {/* Poster */}
          {poster && (
            <div className="shrink-0 hidden sm:block"
              style={{
                width: 160, height: 240,
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)'
              }}
            >
              <img src={poster} alt={movie.title} className="w-full h-full object-cover" />
            </div>
          )}
          {/* Mobile poster (small) */}
          {poster && (
            <div className="shrink-0 sm:hidden w-20 h-28 overflow-hidden rounded-lg border border-white/8"
              style={{ boxShadow: '0 10px 30px -8px rgba(0,0,0,0.7)' }}
            >
              <img src={poster} alt={movie.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Right column */}
          <div className="flex-1 min-w-0 pb-1">
            {/* Section label */}
            <div className="text-[10px] font-bold tracking-[0.3em] uppercase mb-3" style={{ color: SAGE }}>
              Now Showing in the Archive
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-none text-white mb-3 sm:mb-4">
              {movie.title}
            </h1>

            {/* Tagline */}
            {movie.tagline && (
              <p className="text-sm sm:text-base text-white/45 italic mb-4 max-w-xl leading-relaxed">
                "{movie.tagline}"
              </p>
            )}

            {/* Meta chips */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 mb-4 sm:mb-5">
              {movie.release_year && (
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-white/85 px-2.5 py-1 border border-white/15 rounded">
                  {movie.release_year}
                </span>
              )}
              {movie.genre && movie.genre.split('/').map((g) => (
                <span key={g} className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/55 px-2.5 py-1 border border-white/15 rounded">
                  {g.trim()}
                </span>
              ))}
              {movie.runtime && (
                <span className="text-[11px] font-mono text-white/40">{movie.runtime}m</span>
              )}
            </div>

            {/* Director */}
            {movie.director && (
              <div className="mb-5">
                <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/25 mr-2.5">Directed by</span>
                <span className="text-sm font-medium text-white/80">{movie.director}</span>
              </div>
            )}

            {/* Rating badge + CTA row */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Score badge */}
              {movie.vote_average && (
                <div className="flex items-center gap-3.5 px-4 py-3 border rounded-lg"
                  style={{ borderColor: 'rgba(138,154,91,0.3)', background: 'rgba(138,154,91,0.06)' }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill={SAGE}>
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                  </svg>
                  <div>
                    <div className="text-[8px] font-bold tracking-[0.25em] uppercase mb-0.5" style={{ color: SAGE }}>180 Score</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold tracking-tight text-white">{movie.vote_average.toFixed(1)}</span>
                      <span className="text-xs text-white/35">/ 10</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Write Ritual CTA */}
              <button
                type="button"
                onClick={onWriteRitual}
                className="px-7 py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase rounded transition-all duration-200"
                style={{
                  background: SAGE,
                  color: '#121212',
                  boxShadow: '0 0 30px rgba(163,177,138,0.25)'
                }}
              >
                Write Ritual
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
