import React, { useEffect, useMemo, useState } from 'react';
import { InfoFooter } from '../../components/InfoFooter';
import { useLanguage } from '../../context/LanguageContext';
import {
    createAdminGiftCode,
    listAdminGiftCodes,
    moderateAdminComment,
    moderateAdminUser,
    readAdminDashboard,
    readAdminSession,
    type AdminDashboardPayload,
    type AdminSessionPayload,
    type GiftCode
} from '../../lib/adminApi';

interface AdminPanelProps {
    onClose: () => void;
    onHome?: () => void;
}

type ViewState = 'loading' | 'ready' | 'forbidden' | 'error';
type DestructiveUserAction = 'suspend' | 'delete';

type PendingUserAction = {
    targetUserId: string;
    targetLabel: string;
    action: DestructiveUserAction;
    durationHours?: number;
};

type GiftType = 'tickets' | 'premium';

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
                      cancel: 'Vazgec',
                      confirm: 'Onayla',
                      remove: 'Kaldir',
                      restore: 'Geri Al',
                      active: 'Aktif',
                      removed: 'Kaldirildi',
                      status: 'Durum',
                      reason: 'Sebep',
                      empty: 'Kayit yok',
                      deleteConfirm: 'Bu hesap kalici olarak silinecek. Devam edilsin mi?',
                      suspend24Confirm: 'Bu hesap 24 saatligine askiya alinacak. Devam edilsin mi?',
                      suspend7dConfirm: 'Bu hesap 7 gunlugune askiya alinacak. Devam edilsin mi?',
                      confirmTitle: 'Destructive aksiyonu onayla',
                      confirmTarget: 'Hedef hesap',
                      suspendConfirmCta: 'Askiya Al',
                      deleteConfirmCta: 'Kalici Olarak Sil',
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
                      cancel: 'Cancel',
                      confirm: 'Confirm',
                      remove: 'Remove',
                      restore: 'Restore',
                      active: 'Active',
                      removed: 'Removed',
                      status: 'Status',
                      reason: 'Reason',
                      empty: 'No records',
                      deleteConfirm: 'This will permanently delete the user account. Continue?',
                      suspend24Confirm: 'This account will be suspended for 24 hours. Continue?',
                      suspend7dConfirm: 'This account will be suspended for 7 days. Continue?',
                      confirmTitle: 'Confirm destructive action',
                      confirmTarget: 'Target account',
                      suspendConfirmCta: 'Suspend Account',
                      deleteConfirmCta: 'Delete Permanently',
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
    const [pendingUserAction, setPendingUserAction] = useState<PendingUserAction | null>(null);
    const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
    const [showGiftForm, setShowGiftForm] = useState(false);
    const [giftType, setGiftType] = useState<GiftType>('tickets');
    const [giftAmount, setGiftAmount] = useState('100');
    const [giftMaxUses, setGiftMaxUses] = useState('1');
    const [giftExpiresInDays, setGiftExpiresInDays] = useState('30');
    const [giftNote, setGiftNote] = useState('');

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
            void listAdminGiftCodes().then((r) => { if (active && r.ok && r.data) setGiftCodes(r.data); });
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

    const executeUserAction = async (
        targetUserId: string,
        action: 'suspend' | 'unsuspend' | 'delete',
        durationHours?: number
    ) => {
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

    const handleUserAction = async (
        targetUserId: string,
        action: 'suspend' | 'unsuspend' | 'delete',
        targetLabel: string,
        durationHours?: number
    ) => {
        if (action === 'unsuspend') {
            await executeUserAction(targetUserId, action, durationHours);
            return;
        }

        setPendingUserAction({
            targetUserId,
            targetLabel,
            action,
            durationHours
        });
    };

    const handleConfirmPendingUserAction = async () => {
        if (!pendingUserAction) return;
        const nextAction = pendingUserAction;
        setPendingUserAction(null);
        await executeUserAction(
            nextAction.targetUserId,
            nextAction.action,
            nextAction.durationHours
        );
    };

    const loadGiftCodes = async () => {
        const result = await listAdminGiftCodes();
        if (result.ok && result.data) setGiftCodes(result.data);
    };

    const handleCreateGiftCode = async () => {
        setBusyKey('gift:create');
        const value = Math.max(1, Math.min(5000, Number(giftAmount) || 100));
        const maxUses = Math.max(1, Math.min(10000, Number(giftMaxUses) || 1));
        const expiresInDays = Math.max(0, Math.min(365, Number(giftExpiresInDays) || 30));
        const result = await createAdminGiftCode({
            giftType,
            value,
            maxUses,
            expiresInDays,
            note: giftNote || undefined
        });
        setBusyKey(null);
        if (!result.ok) {
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setShowGiftForm(false);
        setGiftNote('');
        setGiftAmount('100');
        setGiftMaxUses('1');
        setGiftExpiresInDays('30');
        setStatusMessage(copy.success);
        await loadGiftCodes();
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
    const pendingActionMessage =
        pendingUserAction?.action === 'delete'
            ? copy.deleteConfirm
            : pendingUserAction?.durationHours === 168
              ? copy.suspend7dConfirm
              : copy.suspend24Confirm;
    const pendingActionCta =
        pendingUserAction?.action === 'delete' ? copy.deleteConfirmCta : copy.suspendConfirmCta;

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
                                                onClick={() =>
                                                    void handleUserAction(
                                                        item.userId,
                                                        'suspend',
                                                        item.displayName || item.email || shortId(item.userId),
                                                        24
                                                    )
                                                }
                                                disabled={busyKey === `user:${item.userId}:suspend`}
                                                className="rounded-lg border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75 hover:border-sage/40 hover:text-sage disabled:opacity-60 transition-colors"
                                            >
                                                {copy.suspend24}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleUserAction(
                                                        item.userId,
                                                        'suspend',
                                                        item.displayName || item.email || shortId(item.userId),
                                                        168
                                                    )
                                                }
                                                disabled={busyKey === `user:${item.userId}:suspend`}
                                                className="rounded-lg border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75 hover:border-sage/40 hover:text-sage disabled:opacity-60 transition-colors"
                                            >
                                                {copy.suspend7d}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleUserAction(
                                                        item.userId,
                                                        'unsuspend',
                                                        item.displayName || item.email || shortId(item.userId)
                                                    )
                                                }
                                                disabled={busyKey === `user:${item.userId}:unsuspend`}
                                                className="rounded-lg border border-sage/25 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-sage hover:border-sage/50 disabled:opacity-60 transition-colors"
                                            >
                                                {copy.unsuspend}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleUserAction(
                                                        item.userId,
                                                        'delete',
                                                        item.displayName || item.email || shortId(item.userId)
                                                    )
                                                }
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

                <section className="mt-6 rounded-3xl border border-amber-400/15 bg-white/[0.03] p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h2 className="text-sm font-bold tracking-[0.22em] uppercase text-amber-200/85">
                            {language === 'tr' ? 'Hediye Kodları' : 'Gift Codes'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowGiftForm(true)}
                            className="rounded-lg border border-amber-400/30 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-amber-200/80 hover:border-amber-400/55 transition-colors"
                        >
                            {language === 'tr' ? '+ Yeni Kod' : '+ New Code'}
                        </button>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        {giftCodes.length === 0 ? (
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                        ) : (
                            <table className="w-full text-[11px] text-left border-collapse">
                                <thead>
                                    <tr className="text-[9px] uppercase tracking-[0.18em] text-gray-500">
                                        <th className="pb-2 pr-4">{language === 'tr' ? 'Kod' : 'Code'}</th>
                                        <th className="pb-2 pr-4">{language === 'tr' ? 'Tür' : 'Type'}</th>
                                        <th className="pb-2 pr-4">{language === 'tr' ? 'Değer' : 'Value'}</th>
                                        <th className="pb-2 pr-4">{language === 'tr' ? 'Kullanım' : 'Uses'}</th>
                                        <th className="pb-2 pr-4">{language === 'tr' ? 'Son Tarih' : 'Expires'}</th>
                                        <th className="pb-2">{language === 'tr' ? 'Durum' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {giftCodes.map((gc) => (
                                        <tr key={gc.id} className="border-t border-white/5 text-white/70">
                                            <td className="py-2 pr-4 font-mono text-amber-200/85">{gc.code}</td>
                                            <td className="py-2 pr-4">{gc.gift_type}</td>
                                            <td className="py-2 pr-4">{gc.value}</td>
                                            <td className="py-2 pr-4">{gc.use_count}/{gc.max_uses}</td>
                                            <td className="py-2 pr-4">{gc.expires_at ? formatDateTime(gc.expires_at, language) : '∞'}</td>
                                            <td className="py-2">
                                                {gc.is_revoked ? (
                                                    <span className="text-red-300/70">{language === 'tr' ? 'İptal' : 'Revoked'}</span>
                                                ) : gc.use_count >= gc.max_uses ? (
                                                    <span className="text-gray-500">{language === 'tr' ? 'Tükendi' : 'Exhausted'}</span>
                                                ) : (
                                                    <span className="text-sage">{copy.active}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>

            <InfoFooter
                className="w-full mt-auto"
                panelWrapperClassName="px-4 sm:px-6 md:px-10 pb-4"
                footerClassName="py-8 px-4 sm:px-6 md:px-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-widest text-white/20"
            />

            {showGiftForm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
                    <button
                        type="button"
                        aria-label={copy.cancel}
                        className="absolute inset-0 cursor-default"
                        onClick={() => setShowGiftForm(false)}
                    />
                    <div className="relative w-full max-w-md rounded-3xl border border-amber-400/20 bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
                            {language === 'tr' ? 'Yeni Hediye Kodu' : 'New Gift Code'}
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setGiftType('tickets')}
                                className={`flex-1 rounded-xl border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                                    giftType === 'tickets'
                                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                                        : 'border-white/15 text-white/55 hover:border-amber-400/30'
                                }`}
                            >
                                {language === 'tr' ? 'Bilet' : 'Tickets'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setGiftType('premium')}
                                className={`flex-1 rounded-xl border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                                    giftType === 'premium'
                                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                                        : 'border-white/15 text-white/55 hover:border-amber-400/30'
                                }`}
                            >
                                {language === 'tr' ? 'Premium (gün)' : 'Premium (days)'}
                            </button>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={5000}
                            value={giftAmount}
                            onChange={(e) => setGiftAmount(e.target.value)}
                            placeholder={language === 'tr' ? (giftType === 'tickets' ? 'Bilet miktarı' : 'Premium gün sayısı') : (giftType === 'tickets' ? 'Ticket amount' : 'Premium days')}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-amber-400/40"
                        />
                        <input
                            type="number"
                            min={1}
                            max={10000}
                            value={giftMaxUses}
                            onChange={(e) => setGiftMaxUses(e.target.value)}
                            placeholder={language === 'tr' ? 'Max kullanım (varsayılan 1)' : 'Max uses (default 1)'}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-amber-400/40"
                        />
                        <input
                            type="number"
                            min={0}
                            max={365}
                            value={giftExpiresInDays}
                            onChange={(e) => setGiftExpiresInDays(e.target.value)}
                            placeholder={language === 'tr' ? 'Son kullanma süresi (gün, 0=süresiz)' : 'Expires in days (0=never)'}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-amber-400/40"
                        />
                        <input
                            type="text"
                            value={giftNote}
                            onChange={(e) => setGiftNote(e.target.value)}
                            placeholder={language === 'tr' ? 'Not (opsiyonel)' : 'Note (optional)'}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] placeholder:text-gray-600 outline-none focus:border-amber-400/40"
                        />
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowGiftForm(false)}
                                className="rounded-xl border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/30"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCreateGiftCode()}
                                disabled={busyKey === 'gift:create'}
                                className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-400/15 disabled:opacity-60"
                            >
                                {language === 'tr' ? 'Kodu Oluştur' : 'Create Code'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {pendingUserAction ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
                    <button
                        type="button"
                        aria-label={copy.cancel}
                        className="absolute inset-0 cursor-default"
                        onClick={() => setPendingUserAction(null)}
                    />
                    <div className="relative w-full max-w-md rounded-3xl border border-red-400/20 bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-red-200/80">
                            {copy.confirmTitle}
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-white/90">
                            {pendingActionMessage}
                        </p>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                                {copy.confirmTarget}
                            </p>
                            <p className="mt-2 break-all text-sm text-white/85">
                                {pendingUserAction.targetLabel}
                            </p>
                        </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setPendingUserAction(null)}
                                className="rounded-xl border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/30"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirmPendingUserAction()}
                                className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-red-100 transition-colors hover:border-red-400/50 hover:bg-red-400/15"
                            >
                                {pendingActionCta}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
