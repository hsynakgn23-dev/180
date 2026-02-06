import { useState } from 'react'
import './App.css'
import { XPProvider, useXP } from './context/XPContext'
import { NotificationProvider } from './context/NotificationContext'
import { DebugPanel } from './components/debug/DebugPanel'
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
  const { levelUpEvent, closeLevelUp, user } = useXP();
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [startProfileInSettings, setStartProfileInSettings] = useState(false);

  const [showLanding, setShowLanding] = useState(true);

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

      <DebugPanel />

      {/* Top Right Controls */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-40 flex items-start sm:items-center gap-2 sm:gap-4 max-w-[calc(100vw-1.5rem)]">
        <NotificationCenter />
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
        <div className="h-[160px] w-full bg-transparent flex items-end justify-center pb-8 pointer-events-none" />

        <main className="container mx-auto px-4 sm:px-6 relative z-10">
          <header className="mb-16 text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-sage mb-4 drop-shadow-sm">180</h1>
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
