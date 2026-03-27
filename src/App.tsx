import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import './App.css'
import { XPProvider, useXP } from './context/XPContext'
import { NotificationProvider, useNotifications } from './context/NotificationContext'
import { ProfileWidget } from './components/ProfileWidget'
import { NotificationCenter } from './features/notifications/NotificationCenter'
import { LeagueTransition } from './components/LeagueTransition'
import { StreakCelebration } from './components/StreakCelebration'
import { InfoFooter } from './components/InfoFooter'
import { SectionErrorBoundary } from './components/SectionErrorBoundary'
import type { Movie } from './data/mockMovies'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import type { PublicProfileTarget } from './features/profile/PublicProfileView'
import { appendMobileDeepLinkParamsToHref } from './domain/deepLinks'
import { buildLeagueNotificationCopy, buildStreakNotificationCopy } from './domain/celebrations'
import { readAdminSession } from './lib/adminApi'

const DailyShowcase = lazy(() =>
  import('./features/daily-showcase/DailyShowcase').then((mod) => ({ default: mod.DailyShowcase }))
)
const PoolDiscoveryPanel = lazy(() =>
  import('./features/pool-quiz/PoolDiscoveryPanel').then((mod) => ({ default: mod.PoolDiscoveryPanel }))
)
const QuizRushPanel = lazy(() =>
  import('./features/pool-quiz/QuizRushPanel').then((mod) => ({ default: mod.QuizRushPanel }))
)
const MovieDetailModal = lazy(() =>
  import('./features/daily-showcase/MovieDetailModal').then((mod) => ({ default: mod.MovieDetailModal }))
)
const Arena = lazy(() =>
  import('./features/arena/Arena').then((mod) => ({ default: mod.Arena }))
)
const WriteOverlay = lazy(() =>
  import('./features/ritual/WriteOverlay').then((mod) => ({ default: mod.WriteOverlay }))
)
const ProfileView = lazy(() =>
  import('./features/profile/ProfileView').then((mod) => ({ default: mod.ProfileView }))
)
const PublicProfileView = lazy(() =>
  import('./features/profile/PublicProfileView').then((mod) => ({ default: mod.PublicProfileView }))
)
const SharePromptModal = lazy(() =>
  import('./components/SharePromptModal').then((mod) => ({ default: mod.SharePromptModal }))
)
const LoginView = lazy(() =>
  import('./features/auth/LoginView').then((mod) => ({ default: mod.LoginView }))
)
const LandingPage = lazy(() =>
  import('./features/landing/LandingPage').then((mod) => ({ default: mod.LandingPage }))
)
const WebToAppPrompt = lazy(() =>
  import('./components/WebToAppPrompt').then((mod) => ({ default: mod.WebToAppPrompt }))
)
const AdminPanel = lazy(() =>
  import('./features/admin/AdminPanel').then((mod) => ({ default: mod.AdminPanel }))
)

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

const parseAdminHash = (hash: string): boolean => {
  const normalized = (hash || '').trim()
  return normalized === '#/admin' || normalized.startsWith('#/admin?')
}

const AppContent = () => {
  const { text, language } = useLanguage();
  const { addNotification } = useNotifications();
  const {
    levelUpEvent,
    closeLevelUp,
    streakCelebrationEvent,
    closeStreakCelebration,
    sharePromptEvent,
    dismissSharePrompt,
    user,
    isPasswordRecoveryMode,
    avatarUrl,
    streak,
    dailyRitualsCount,
    inviteCode
  } = useXP();
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [startProfileInSettings, setStartProfileInSettings] = useState(false);
  const [publicProfileTarget, setPublicProfileTarget] = useState<PublicProfileTarget | null>(() => parsePublicProfileHash(window.location.hash));
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(() => parseAdminHash(window.location.hash));
  const [canOpenAdminPanel, setCanOpenAdminPanel] = useState(false);
  const [DebugPanelComponent, setDebugPanelComponent] = useState<ComponentType | null>(null);
  const lastLevelUpNotificationKeyRef = useRef('');
  const lastStreakNotificationKeyRef = useRef('');

  useEffect(() => {
    if (user?.id) return;
    lastLevelUpNotificationKeyRef.current = '';
    lastStreakNotificationKeyRef.current = '';
  }, [user?.id]);

  useEffect(() => {
    if (!levelUpEvent) return;
    const notificationKey = `${levelUpEvent.name}-${dailyRitualsCount}-${streak}`;
    if (lastLevelUpNotificationKeyRef.current === notificationKey) return;
    lastLevelUpNotificationKeyRef.current = notificationKey;
    const copy = buildLeagueNotificationCopy(language, levelUpEvent.name);
    addNotification({
      type: 'system',
      message: `${copy.title}: ${copy.body}`,
    });
  }, [addNotification, dailyRitualsCount, language, levelUpEvent, streak]);

  useEffect(() => {
    if (!streakCelebrationEvent) return;
    const notificationKey = `${streakCelebrationEvent.day}-${dailyRitualsCount}`;
    if (lastStreakNotificationKeyRef.current === notificationKey) return;
    lastStreakNotificationKeyRef.current = notificationKey;
    const copy = buildStreakNotificationCopy(language, streakCelebrationEvent.day);
    addNotification({
      type: 'system',
      message: `${copy.title}: ${copy.body}`,
    });
  }, [addNotification, dailyRitualsCount, language, streakCelebrationEvent]);

  const [showLanding, setShowLanding] = useState(true);
  const showDebugPanel = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_PANEL !== '0';
  const discoverLinks = useMemo(
    () => [
      {
        href: appendMobileDeepLinkParamsToHref('/discover/mood-films/', {
          type: 'discover',
          route: 'mood_films',
        }),
        label: text.app.discoverMoodLink,
      },
      {
        href: appendMobileDeepLinkParamsToHref('/discover/director-deep-dives/', {
          type: 'discover',
          route: 'director_deep_dives',
        }),
        label: text.app.discoverDirectorLink,
      },
      {
        href: appendMobileDeepLinkParamsToHref('/discover/daily-curated-picks/', {
          type: 'discover',
          route: 'daily_curated_picks',
        }),
        label: text.app.discoverDailyLink,
      },
    ],
    [text.app.discoverDailyLink, text.app.discoverDirectorLink, text.app.discoverMoodLink]
  );

  useEffect(() => {
    const syncFromHash = () => {
      setPublicProfileTarget(parsePublicProfileHash(window.location.hash));
      setShowAdminPanel(parseAdminHash(window.location.hash));
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (!publicProfileTarget) return;
    setShowProfile(false);
    setShowAdminPanel(false);
    setStartProfileInSettings(false);
    setActiveMovie(null);
    setDetailMovie(null);
  }, [publicProfileTarget]);

  useEffect(() => {
    if (!showAdminPanel) return;
    setShowProfile(false);
    setStartProfileInSettings(false);
    setPublicProfileTarget(null);
    setActiveMovie(null);
    setDetailMovie(null);
  }, [showAdminPanel]);

  useEffect(() => {
    if (!showProfile && !publicProfileTarget && !showAdminPanel) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [showAdminPanel, showProfile, publicProfileTarget]);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setCanOpenAdminPanel(false);
      return () => {
        active = false;
      };
    }

    void readAdminSession().then((result) => {
      if (!active) return;
      setCanOpenAdminPanel(Boolean(result.ok && result.data));
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const openHome = () => {
    setActiveMovie(null);
    setDetailMovie(null);
    setShowProfile(false);
    setShowAdminPanel(false);
    setStartProfileInSettings(false);
    setPublicProfileTarget(null);
    if (window.location.hash.startsWith('#/u/') || parseAdminHash(window.location.hash)) {
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

  const fullScreenFallback = <div className="min-h-screen" aria-hidden="true" />;

  if (!user || isPasswordRecoveryMode) {
    if (showLanding && !isPasswordRecoveryMode) {
      return (
        <Suspense fallback={fullScreenFallback}>
          <LandingPage onStart={() => setShowLanding(false)} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={fullScreenFallback}>
        <LoginView />
      </Suspense>
    );
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
        <Suspense fallback={null}>
          <SharePromptModal
            event={sharePromptEvent}
            onClose={dismissSharePrompt}
          />
        </Suspense>
      )}

      {showDebugPanel && DebugPanelComponent ? <DebugPanelComponent /> : null}

      {/* Top Right Controls */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-40 flex items-start sm:items-center gap-2 sm:gap-4">
        <NotificationCenter />
        {canOpenAdminPanel ? (
          <button
            type="button"
            onClick={() => {
              window.location.hash = '/admin'
              setShowAdminPanel(true)
            }}
            className="rounded-full border border-sage/30 bg-[#121212]/95 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-sage hover:border-sage/60 transition-colors"
          >
            Admin
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (window.location.hash.startsWith('#/u/') || parseAdminHash(window.location.hash)) {
              window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
              setPublicProfileTarget(null);
              setShowAdminPanel(false);
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
              if (window.location.hash.startsWith('#/u/') || parseAdminHash(window.location.hash)) {
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
                setPublicProfileTarget(null);
                setShowAdminPanel(false);
              }
              setStartProfileInSettings(false);
              setShowProfile(true);
            }}
            onOpenSettings={() => {
              if (window.location.hash.startsWith('#/u/') || parseAdminHash(window.location.hash)) {
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
                setPublicProfileTarget(null);
                setShowAdminPanel(false);
              }
              setStartProfileInSettings(true);
              setShowProfile(true);
            }}
          />
        </div>
      </div>

      {detailMovie && (
        <Suspense fallback={null}>
          <MovieDetailModal
            movie={detailMovie}
            onClose={() => setDetailMovie(null)}
            onStartRitual={() => {
              setDetailMovie(null);
              setActiveMovie(detailMovie);
            }}
          />
        </Suspense>
      )}

      {activeMovie && (
        <Suspense fallback={null}>
          <WriteOverlay
            movie={activeMovie}
            onClose={() => setActiveMovie(null)}
          />
        </Suspense>
      )}

      {showProfile && (
        <Suspense fallback={null}>
          <ProfileView
            onClose={openHome}
            onHome={openHome}
            startInSettings={startProfileInSettings}
          />
        </Suspense>
      )}

      {publicProfileTarget && (
        <Suspense fallback={null}>
          <PublicProfileView
            target={publicProfileTarget}
            onClose={openHome}
            onHome={openHome}
          />
        </Suspense>
      )}

      {showAdminPanel && (
        <Suspense fallback={null}>
          <AdminPanel
            onClose={openHome}
            onHome={openHome}
          />
        </Suspense>
      )}

      <div className={`min-h-screen overflow-x-hidden font-sans selection:bg-sage selection:text-white transition-opacity duration-500 ${activeMovie || showProfile || detailMovie || publicProfileTarget || showAdminPanel ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="h-[72px] sm:h-[160px] w-full bg-transparent flex items-end justify-center pb-2 sm:pb-8 pointer-events-none" />

        <main className="container mx-auto px-4 sm:px-6 relative z-10">
          <header className="mb-8 sm:mb-16 text-center animate-fade-in z-20 relative">
            <button
              type="button"
              onClick={openHome}
              className="inline-flex flex-col items-center group outline-none"
              aria-label={text.profile.backHome}
              title={text.profile.backHome}
            >
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-sage mb-2 sm:mb-4 drop-shadow-[0_0_12px_rgba(138,154,91,0.2)] group-hover:drop-shadow-[0_0_24px_rgba(138,154,91,0.5)] group-hover:scale-105 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">180</h1>
              <p className="text-clay font-medium tracking-[0.2em] text-sm md:text-base uppercase group-hover:tracking-[0.3em] group-hover:text-sage transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">{text.app.brandSubtitle}</p>
            </button>
          </header>

          <Suspense fallback={null}>
            <WebToAppPrompt
              streak={streak}
              dailyRitualsCount={dailyRitualsCount}
              inviteCode={inviteCode}
            />
          </Suspense>


          <Suspense fallback={<section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">{text.app.loadingDailyShowcase}</section>}>
            <SectionErrorBoundary
              title={text.daily.title}
              fallbackMessage={text.app.dailyUnavailable}
            >
              <DailyShowcase onMovieSelect={setDetailMovie} />
            </SectionErrorBoundary>
          </Suspense>

          <Suspense fallback={null}>
            <SectionErrorBoundary title="Quiz" fallbackMessage="">
              <PoolDiscoveryPanel />
            </SectionErrorBoundary>
          </Suspense>

          <Suspense fallback={null}>
            <SectionErrorBoundary title="Quiz Rush" fallbackMessage="">
              <QuizRushPanel />
            </SectionErrorBoundary>
          </Suspense>

          <Suspense fallback={<section className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">{text.app.loadingArena}</section>}>
            <SectionErrorBoundary
              title={text.arena.title}
              fallbackMessage={text.app.arenaUnavailable}
            >
              <Arena />
            </SectionErrorBoundary>
          </Suspense>
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



