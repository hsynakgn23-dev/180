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
import { PublicProfileView, type PublicProfileTarget } from './features/profile/PublicProfileView'
import { LeagueTransition } from './components/LeagueTransition'
import { StreakCelebration } from './components/StreakCelebration'
import { SharePromptModal } from './components/SharePromptModal'
import { InfoFooter } from './components/InfoFooter'
import type { Movie } from './data/mockMovies'
import { LanguageProvider, useLanguage } from './context/LanguageContext'

import { LoginView } from './features/auth/LoginView'
import { LandingPage } from './features/landing/LandingPage'

const parsePublicProfileHash = (hash: string): PublicProfileTarget | null => {
  const normalized = (hash || '').trim()
  if (!normalized.startsWith('#/u/')) return null

  const pathWithQuery = normalized.slice(4)
  const [rawKey, rawQuery = ''] = pathWithQuery.split('?')
  const decodedKey = decodeURIComponent(rawKey || '')
  const query = new URLSearchParams(rawQuery)
  const nameFromQuery = query.get('name') || undefined

  if (decodedKey.startsWith('id:')) {
    const userId = decodedKey.slice(3).trim()
    if (!userId) return null
    return {
      userId,
      username: nameFromQuery
    }
  }

  if (decodedKey.startsWith('name:')) {
    const username = decodedKey.slice(5).trim()
    if (!username) return null
    return {
      username
    }
  }

  const fallbackUsername = decodedKey.trim()
  if (!fallbackUsername) return null
  return {
    username: fallbackUsername
  }
}

const AppContent = () => {
  const { text } = useLanguage();
  const {
    levelUpEvent,
    closeLevelUp,
    streakCelebrationEvent,
    closeStreakCelebration,
    sharePromptEvent,
    dismissSharePrompt,
    user,
    isPasswordRecoveryMode,
    avatarUrl
  } = useXP();
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [startProfileInSettings, setStartProfileInSettings] = useState(false);
  const [publicProfileTarget, setPublicProfileTarget] = useState<PublicProfileTarget | null>(() => parsePublicProfileHash(window.location.hash));
  const [DebugPanelComponent, setDebugPanelComponent] = useState<ComponentType | null>(null);

  const [showLanding, setShowLanding] = useState(true);
  const showDebugPanel = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_PANEL !== '0';

  useEffect(() => {
    const syncFromHash = () => {
      setPublicProfileTarget(parsePublicProfileHash(window.location.hash));
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (!publicProfileTarget) return;
    setShowProfile(false);
    setStartProfileInSettings(false);
    setActiveMovie(null);
    setDetailMovie(null);
  }, [publicProfileTarget]);

  const openHome = () => {
    setActiveMovie(null);
    setDetailMovie(null);
    setShowProfile(false);
    setStartProfileInSettings(false);
    setPublicProfileTarget(null);
    if (window.location.hash.startsWith('#/u/')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  if (!user || isPasswordRecoveryMode) {
    if (showLanding && !isPasswordRecoveryMode) {
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

      {streakCelebrationEvent && (
        <StreakCelebration
          event={streakCelebrationEvent}
          onComplete={closeStreakCelebration}
        />
      )}

      {sharePromptEvent && !showProfile && (
        <SharePromptModal
          event={sharePromptEvent}
          onClose={dismissSharePrompt}
        />
      )}

      {showDebugPanel && DebugPanelComponent ? <DebugPanelComponent /> : null}

      {/* Top Right Controls */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-40 flex items-start sm:items-center gap-2 sm:gap-4">
        <NotificationCenter />
        <button
          type="button"
          onClick={() => {
            if (window.location.hash.startsWith('#/u/')) {
              window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
              setPublicProfileTarget(null);
            }
            setStartProfileInSettings(false);
            setShowProfile(true);
          }}
          className="sm:hidden relative p-0.5 w-9 h-9 rounded-full border border-sage/35 bg-[#121212]/95 text-sage/70 hover:text-sage transition-colors overflow-hidden"
          title={text.app.profileTitle}
          aria-label={text.app.profileAria}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={text.app.profileTitle} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold tracking-wide">
              {user?.name?.slice(0, 2).toUpperCase() || 'OB'}
            </span>
          )}
        </button>
        <div className="hidden sm:block">
          <ProfileWidget
            onClick={() => {
              if (window.location.hash.startsWith('#/u/')) {
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
                setPublicProfileTarget(null);
              }
              setStartProfileInSettings(false);
              setShowProfile(true);
            }}
            onOpenSettings={() => {
              if (window.location.hash.startsWith('#/u/')) {
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
                setPublicProfileTarget(null);
              }
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
          onClose={openHome}
          onHome={openHome}
          startInSettings={startProfileInSettings}
        />
      )}

      {publicProfileTarget && (
        <PublicProfileView
          target={publicProfileTarget}
          onClose={openHome}
          onHome={openHome}
        />
      )}

      <div className={`min-h-screen font-sans selection:bg-sage selection:text-white transition-opacity duration-500 ${activeMovie || showProfile || detailMovie || publicProfileTarget ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="h-[72px] sm:h-[160px] w-full bg-transparent flex items-end justify-center pb-2 sm:pb-8 pointer-events-none" />

        <main className="container mx-auto px-4 sm:px-6 relative z-10">
          <header className="mb-8 sm:mb-16 text-center animate-fade-in">
            <button
              type="button"
              onClick={openHome}
              className="inline-flex flex-col items-center"
              aria-label={text.profile.backHome}
              title={text.profile.backHome}
            >
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-sage mb-2 sm:mb-4 drop-shadow-sm">180</h1>
              <p className="text-clay font-medium tracking-[0.2em] text-sm md:text-base uppercase">{text.app.brandSubtitle}</p>
            </button>
          </header>

          <DailyShowcase onMovieSelect={setDetailMovie} />
          <Arena />
        </main>

        <InfoFooter className="mt-8" panelWrapperClassName="px-4 sm:px-6 pb-4" footerClassName="py-8 px-4 sm:px-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20" />
      </div>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <XPProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </XPProvider>
    </LanguageProvider>
  )
}

export default App
