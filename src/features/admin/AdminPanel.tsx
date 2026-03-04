import React, { useEffect, useMemo, useState } from 'react';
import { InfoFooter } from '../../components/InfoFooter';
import { useLanguage } from '../../context/LanguageContext';
import {
    moderateAdminComment,
    moderateAdminUser,
    readAdminDashboard,
    readAdminSession,
    type AdminDashboardPayload,
    type AdminSessionPayload
} from '../../lib/adminApi';

interface AdminPanelProps {
    onClose: () => void;
    onHome?: () => void;
}

type ViewState = 'loading' | 'ready' | 'forbidden' | 'error';

const formatDateTime = (value: string | null, language: string): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(parsed);
};

const shortId = (value: string | null | undefined): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return '-';
    if (normalized.length <= 14) return normalized;
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onHome }) => {
    const { language } = useLanguage();
    const copy = useMemo(
        () =>
            language === 'tr'
                ? {
                      title: 'Moderasyon Paneli',
                      subtitle:
                          'Web admin yuzeyi. Yorum kaldir, hesabı suspend et ve aksiyon gecmisini izle.',
                      loading: 'Admin oturumu kontrol ediliyor...',
                      forbidden: 'Bu hesap admin paneline erisemiyor.',
                      error: 'Admin paneli yuklenemedi.',
                      refresh: 'Yenile',
                      search: 'Ara',
                      searchPlaceholder: 'email, isim veya user id',
                      home: 'Ana Sayfa',
                      close: 'Kapat',
                      users: 'Kullanicilar',
                      rituals: 'Yorumlar',
                      replies: 'Yanitlar',
                      reports: 'Raporlar',
                      audit: 'Islem Gecmisi',
                      suspend24: '24 Saat Askiya Al',
                      suspend7d: '7 Gun Askiya Al',
                      unsuspend: 'Askiyi Kaldir',
                      deleteUser: 'Hesabi Sil',
                      remove: 'Kaldir',
                      restore: 'Geri Al',
                      active: 'Aktif',
                      removed: 'Kaldirildi',
                      status: 'Durum',
                      reason: 'Sebep',
                      empty: 'Kayit yok',
                      deleteConfirm: 'Bu hesap kalici olarak silinecek. Devam edilsin mi?',
                      success: 'Aksiyon uygulandi.',
                      failed: 'Aksiyon tamamlanamadi.',
                      session: 'Oturum',
                      role: 'Rol',
                      openReports: 'Acik Raporlar',
                      suspendedUsers: 'Askidaki Kullanicilar',
                      removedComments: 'Kaldirilan Yorum',
                      removedReplies: 'Kaldirilan Yanit',
                      ritualRef: 'Yorum'
                  }
                : {
                      title: 'Moderation Panel',
                      subtitle:
                          'Web admin surface for comment removal, account suspension, and audit review.',
                      loading: 'Checking admin session...',
                      forbidden: 'This account cannot access the admin panel.',
                      error: 'Admin panel could not be loaded.',
                      refresh: 'Refresh',
                      search: 'Search',
                      searchPlaceholder: 'email, display name, or user id',
                      home: 'Home',
                      close: 'Close',
                      users: 'Users',
                      rituals: 'Comments',
                      replies: 'Replies',
                      reports: 'Reports',
                      audit: 'Audit',
                      suspend24: 'Suspend 24h',
                      suspend7d: 'Suspend 7d',
                      unsuspend: 'Lift Suspension',
                      deleteUser: 'Delete Account',
                      remove: 'Remove',
                      restore: 'Restore',
                      active: 'Active',
                      removed: 'Removed',
                      status: 'Status',
                      reason: 'Reason',
                      empty: 'No records',
                      deleteConfirm: 'This will permanently delete the user account. Continue?',
                      success: 'Action applied.',
                      failed: 'Action failed.',
                      session: 'Session',
                      role: 'Role',
                      openReports: 'Open Reports',
                      suspendedUsers: 'Suspended Users',
                      removedComments: 'Removed Comments',
                      removedReplies: 'Removed Replies',
                      ritualRef: 'Comment'
                  },
        [language]
    );
    const panelSubtitle =
        language === 'tr'
            ? 'Web admin yuzeyi. Yorum kaldir, hesabi askiya al ve aksiyon gecmisini izle.'
            : copy.subtitle;

    const [viewState, setViewState] = useState<ViewState>('loading');
    const [session, setSession] = useState<AdminSessionPayload | null>(null);
    const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
    const [query, setQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const loadDashboard = async (nextQuery = query, withLoading = true) => {
        if (withLoading) setViewState('loading');
        const result = await readAdminDashboard(nextQuery, 18);
        if (!result.ok || !result.data) {
            setViewState(result.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error');
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setDashboard(result.data);
        setQuery(nextQuery);
        setViewState('ready');
    };

    useEffect(() => {
        let active = true;
        void (async () => {
            const sessionResult = await readAdminSession();
            if (!active) return;
            if (!sessionResult.ok || !sessionResult.data) {
                setViewState(sessionResult.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error');
                return;
            }
            setSession(sessionResult.data);
            const dashboardResult = await readAdminDashboard('', 18);
            if (!active) return;
            if (!dashboardResult.ok || !dashboardResult.data) {
                setViewState(dashboardResult.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error');
                setStatusMessage(dashboardResult.message || copy.failed);
                return;
            }
            setDashboard(dashboardResult.data);
            setQuery('');
            setViewState('ready');
        })();
        return () => {
            active = false;
        };
    }, [copy.failed]);

    useEffect(() => {
        if (!statusMessage) return;
        const timeout = window.setTimeout(() => setStatusMessage(''), 2200);
        return () => window.clearTimeout(timeout);
    }, [statusMessage]);

    const handleUserAction = async (
        targetUserId: string,
        action: 'suspend' | 'unsuspend' | 'delete',
        durationHours?: number
    ) => {
        if (action === 'delete' && !window.confirm(copy.deleteConfirm)) {
            return;
        }
        setBusyKey(`user:${targetUserId}:${action}`);
        const result = await moderateAdminUser({
            targetUserId,
            action,
            durationHours,
            reasonCode: `admin_${action}`
        });
        setBusyKey(null);
        if (!result.ok) {
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setStatusMessage(copy.success);
        await loadDashboard(query, false);
    };

    const handleCommentAction = async (
        entityType: 'ritual' | 'reply',
        entityId: string,
        action: 'remove' | 'restore'
    ) => {
        setBusyKey(`${entityType}:${entityId}:${action}`);
        const result = await moderateAdminComment({
            entityType,
            entityId,
            action,
            reasonCode: `admin_${action}`
        });
        setBusyKey(null);
        if (!result.ok) {
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setStatusMessage(copy.success);
        await loadDashboard(query, false);
    };

    const renderGate = (message: string, details?: string) => (
        <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[#E5E4E2] flex flex-col">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 md:px-10 py-12">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">{message}</p>
                    {details ? (
                        <p className="mt-3 text-sm text-white/55 normal-case tracking-normal break-words">
                            {details}
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );

    if (viewState === 'loading') return renderGate(copy.loading, statusMessage);
    if (viewState === 'forbidden') return renderGate(copy.forbidden, statusMessage);
    if (viewState === 'error') return renderGate(copy.error, statusMessage);

    const users = dashboard?.users || [];
    const rituals = dashboard?.rituals || [];
    const replies = dashboard?.replies || [];
    const reports = dashboard?.reports || [];
    const actions = dashboard?.actions || [];

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[#E5E4E2] flex flex-col">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(138,154,91,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(229,228,226,0.08),transparent_28%)]" />
            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 py-8 sm:py-10">
                <header className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 sm:px-7 py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.26em] text-sage/75">
                                {language === 'tr' ? 'Web Yonetim' : 'Web Admin'}
                            </p>
                            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-[0.08em] uppercase">
                                {copy.title}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm text-gray-400 leading-relaxed">
                                {panelSubtitle}
                            </p>
                            {session ? (
                                <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                    <span>
                                        {copy.session}: <span className="text-white/80">{session.email}</span>
                                    </span>
                                    <span>
                                        {copy.role}: <span className="text-sage">{session.role}</span>
                                    </span>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => void loadDashboard(query, false)}
                                className="rounded-lg border border-sage/30 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-sage hover:border-sage/60 transition-colors"
                            >
                                {copy.refresh}
                            </button>
                            {onHome ? (
                                <button
                                    type="button"
                                    onClick={onHome}
                                    className="rounded-lg border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-sage/40 hover:text-sage transition-colors"
                                >
                                    {copy.home}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/75 hover:border-sage/40 hover:text-sage transition-colors"
                            >
                                {copy.close}
                            </button>
                        </div>
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void loadDashboard(query, false);
                        }}
                        className="mt-6 flex flex-col gap-3 md:flex-row"
                    >
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={copy.searchPlaceholder}
                            className="flex-1 rounded-xl border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-sage/40"
                        />
                        <button
                            type="submit"
                            className="rounded-xl bg-sage px-5 py-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#121212]"
                        >
                            {copy.search}
                        </button>
                    </form>
                    {statusMessage ? (
                        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-sage/85">
                            {statusMessage}
                        </p>
                    ) : null}
                </header>

                <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: copy.openReports, value: dashboard?.stats.openReports || 0 },
                        { label: copy.suspendedUsers, value: dashboard?.stats.suspendedUsers || 0 },
                        { label: copy.removedComments, value: dashboard?.stats.removedRituals || 0 },
                        { label: copy.removedReplies, value: dashboard?.stats.removedReplies || 0 }
                    ].map((item) => (
                        <article key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                            <p className="mt-3 text-3xl font-bold text-sage">{item.value}</p>
                        </article>
                    ))}
                </section>

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-sage">{copy.users}</h2>
                        <div className="mt-4 space-y-3 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                            {users.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                users.map((item) => (
                                    <article key={item.userId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-sm font-semibold text-white/90">
                                            {item.displayName || item.email || shortId(item.userId)}
                                        </p>
                                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500 break-all">
                                            {item.email || shortId(item.userId)}
                                        </p>
                                        {item.suspendedUntil ? (
                                            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-red-200/75">
                                                {formatDateTime(item.suspendedUntil, language)}
                                            </p>
                                        ) : null}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleUserAction(item.userId, 'suspend', 24)}
                                                disabled={busyKey === `user:${item.userId}:suspend`}
                                                className="rounded-lg border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75 hover:border-sage/40 hover:text-sage disabled:opacity-60 transition-colors"
                                            >
                                                {copy.suspend24}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleUserAction(item.userId, 'suspend', 168)}
                                                disabled={busyKey === `user:${item.userId}:suspend`}
                                                className="rounded-lg border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75 hover:border-sage/40 hover:text-sage disabled:opacity-60 transition-colors"
                                            >
                                                {copy.suspend7d}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleUserAction(item.userId, 'unsuspend')}
                                                disabled={busyKey === `user:${item.userId}:unsuspend`}
                                                className="rounded-lg border border-sage/25 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-sage hover:border-sage/50 disabled:opacity-60 transition-colors"
                                            >
                                                {copy.unsuspend}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleUserAction(item.userId, 'delete')}
                                                disabled={busyKey === `user:${item.userId}:delete`}
                                                className="rounded-lg border border-red-400/25 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-red-200/85 hover:border-red-400/50 disabled:opacity-60 transition-colors"
                                            >
                                                {copy.deleteUser}
                                            </button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-sage">{copy.rituals}</h2>
                        <div className="mt-4 space-y-3 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                            {rituals.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                rituals.map((item) => (
                                    <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.14em] text-sage/85">{item.movieTitle || copy.empty}</p>
                                                <p className="mt-1 text-sm text-white/90">{item.author || shortId(item.userId)}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void handleCommentAction('ritual', item.id, item.isRemoved ? 'restore' : 'remove')}
                                                disabled={busyKey === `ritual:${item.id}:${item.isRemoved ? 'restore' : 'remove'}`}
                                                className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] disabled:opacity-60 transition-colors ${
                                                    item.isRemoved
                                                        ? 'border-sage/25 text-sage hover:border-sage/50'
                                                        : 'border-red-400/25 text-red-200/85 hover:border-red-400/50'
                                                }`}
                                            >
                                                {item.isRemoved ? copy.restore : copy.remove}
                                            </button>
                                        </div>
                                        <p className="mt-3 text-sm text-gray-300 leading-relaxed">"{item.text}"</p>
                                        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {formatDateTime(item.createdAt, language)} · {item.isRemoved ? copy.removed : copy.active}
                                        </p>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-sage">{copy.replies}</h2>
                        <div className="mt-4 space-y-3 max-h-[32vh] overflow-y-auto custom-scrollbar pr-1">
                            {replies.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                replies.map((item) => (
                                    <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm text-white/90">{item.author || shortId(item.userId)}</p>
                                                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                    {copy.ritualRef} {shortId(item.ritualId)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void handleCommentAction('reply', item.id, item.isRemoved ? 'restore' : 'remove')}
                                                disabled={busyKey === `reply:${item.id}:${item.isRemoved ? 'restore' : 'remove'}`}
                                                className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] disabled:opacity-60 transition-colors ${
                                                    item.isRemoved
                                                        ? 'border-sage/25 text-sage hover:border-sage/50'
                                                        : 'border-red-400/25 text-red-200/85 hover:border-red-400/50'
                                                }`}
                                            >
                                                {item.isRemoved ? copy.restore : copy.remove}
                                            </button>
                                        </div>
                                        <p className="mt-3 text-sm text-gray-300 leading-relaxed">"{item.text}"</p>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-sage">{copy.reports}</h2>
                        <div className="mt-4 space-y-3 max-h-[32vh] overflow-y-auto custom-scrollbar pr-1">
                            {reports.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                reports.map((item) => (
                                    <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {copy.reason}: {item.reasonCode || copy.empty}
                                        </p>
                                        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {copy.status}: {item.status || copy.empty}
                                        </p>
                                        {item.details ? (
                                            <p className="mt-3 text-sm text-gray-300 leading-relaxed">{item.details}</p>
                                        ) : null}
                                    </article>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-sage">{copy.audit}</h2>
                        <div className="mt-4 space-y-3 max-h-[32vh] overflow-y-auto custom-scrollbar pr-1">
                            {actions.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                actions.map((item) => (
                                    <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {item.action || copy.empty}
                                        </p>
                                        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {formatDateTime(item.createdAt, language)}
                                        </p>
                                        {item.note ? (
                                            <p className="mt-3 text-sm text-gray-300 leading-relaxed">{item.note}</p>
                                        ) : null}
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <InfoFooter
                className="w-full mt-auto"
                panelWrapperClassName="px-4 sm:px-6 md:px-10 pb-4"
                footerClassName="py-8 px-4 sm:px-6 md:px-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20"
            />
        </div>
    );
};
