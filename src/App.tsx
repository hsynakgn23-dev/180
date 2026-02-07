import { useEffect, useState, type ComponentType } from 'react'
import './App.css'
import { XPProvider, useXP } from './context/XPContext'
import { NotificationProvider } from './context/NotificationContext'
import { ProfileWidget } from './components/ProfileWidget'
import { NotificationCenter } from './features/notifications/NotificationCenter'
import { DailyShowcase } from './features/daily-showcase/DailyShowcase'
import { MovieDetailModal } from './features/daily-showcase/MovieDetailModal'
import { Arena } from './features/arena/Arena'
import { WriteOverlay } from './features/ritual/WriteOverlay'
import { ProfileView } from './features/profile/ProfileView'
import { LeagueTransition } from './components/LeagueTransition'
import type { Movie } from './data/mockMovies'

import { LoginView } from './features/auth/LoginView'
import { LandingPage } from './features/landing/LandingPage'

const AppContent = () => {
  const { levelUpEvent, closeLevelUp, user, avatarUrl } = useXP();
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [startProfileInSettings, setStartProfileInSettings] = useState(false);
  const [DebugPanelComponent, setDebugPanelComponent] = useState<ComponentType | null>(null);

  const [showLanding, setShowLanding] = useState(true);
  const showDebugPanel = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_PANEL !== '0';

  useEffect(() => {
    if (!showDebugPanel) return;

    let active = true;
    void import('./components/debug/DebugPanel').then((mod) => {
      if (!active) return;
      setDebugPanelComponent(() => mod.DebugPanel);
    });

    return () => {
      active = false;
    };
  }, [showDebugPanel]);

  if (!user) {
    if (showLanding) {
      return <LandingPage onStart={() => setShowLanding(false)} />;
    }
    return <LoginView />;
  }

  return (
    <>
      {levelUpEvent && (
        <LeagueTransition
          color={levelUpEvent.color}
          leagueName={levelUpEvent.name}
          onComplete={closeLevelUp}
        />
      )}

      {showDebugPanel && DebugPanelComponent ? <DebugPanelComponent /> : null}

      {/* Top Right Controls */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-40 flex items-start sm:items-center gap-2 sm:gap-4">
        <NotificationCenter />
        <button
          type="button"
          onClick={() => {
            setStartProfileInSettings(false);
            setShowProfile(true);
          }}
          className="sm:hidden relative p-0.5 w-9 h-9 rounded-full border border-sage/35 bg-[#121212]/95 text-sage/70 hover:text-sage transition-colors overflow-hidden"
          title="Profile"
          aria-label="Open profile"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold tracking-wide">
              {user?.name?.slice(0, 2).toUpperCase() || 'OB'}
            </span>
          )}
        </button>
        <div className="hidden sm:block">
          <ProfileWidget
            onClick={() => {
              setStartProfileInSettings(false);
              setShowProfile(true);
            }}
            onOpenSettings={() => {
              setStartProfileInSettings(true);
              setShowProfile(true);
            }}
          />
        </div>
      </div>

      {detailMovie && (
        <MovieDetailModal
          movie={detailMovie}
          onClose={() => setDetailMovie(null)}
          onStartRitual={() => {
            setDetailMovie(null);
            setActiveMovie(detailMovie);
          }}
        />
      )}

      {activeMovie && (
        <WriteOverlay
          movie={activeMovie}
          onClose={() => setActiveMovie(null)}
        />
      )}

      {showProfile && (
        <ProfileView
          onClose={() => {
            setShowProfile(false);
            setStartProfileInSettings(false);
          }}
          startInSettings={startProfileInSettings}
        />
      )}

      <div className={`min-h-screen font-sans selection:bg-sage selection:text-white transition-opacity duration-500 ${activeMovie || showProfile || detailMovie ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="h-[72px] sm:h-[160px] w-full bg-transparent flex items-end justify-center pb-2 sm:pb-8 pointer-events-none" />

        <main className="container mx-auto px-4 sm:px-6 relative z-10">
          <header className="mb-8 sm:mb-16 text-center animate-fade-in">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-sage mb-2 sm:mb-4 drop-shadow-sm">180</h1>
            <p className="text-clay font-medium tracking-[0.2em] text-sm md:text-base uppercase">Absolute Cinema</p>
          </header>

          <DailyShowcase onMovieSelect={setDetailMovie} />
          <Arena />
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <XPProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </XPProvider>
  )
}

export default App
