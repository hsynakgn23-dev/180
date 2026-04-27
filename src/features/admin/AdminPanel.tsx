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
    updateAdminGiftCode,
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
type AdminTab = 'users' | 'content' | 'reports' | 'gifts' | 'audit';
type GiftType = 'tickets' | 'premium';

type PendingUserAction = {
    targetUserId: string;
    targetLabel: string;
    action: DestructiveUserAction;
    durationHours?: number;
};

const formatDateTime = (value: string | null | undefined, language: string): string => {
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

const giftCodeStatus = (giftCode: GiftCode, activeLabel: string, revokedLabel: string, exhaustedLabel: string) => {
    if (giftCode.is_revoked) return revokedLabel;
    if (giftCode.use_count >= giftCode.max_uses) return exhaustedLabel;
    return activeLabel;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onHome }) => {
    const { language } = useLanguage();
    const copy = useMemo(
        () =>
            language === 'tr'
                ? {
                      title: 'Moderasyon Paneli',
                      subtitle:
                          'Kullanici, icerik, rapor, hediye kodu ve audit akisini tek yerden yonet.',
                      loading: 'Admin oturumu kontrol ediliyor...',
                      forbidden: 'Bu hesap admin paneline erisemiyor.',
                      error: 'Admin paneli yuklenemedi.',
                      refresh: 'Yenile',
                      search: 'Ara',
                      searchPlaceholder: 'email, isim veya user id',
                      home: 'Ana Sayfa',
                      close: 'Kapat',
                      users: 'Kullanicilar',
                      content: 'Icerik',
                      rituals: 'Yorumlar',
                      replies: 'Yanitlar',
                      reports: 'Raporlar',
                      gifts: 'Hediye Kodlari',
                      audit: 'Islem Gecmisi',
                      suspend24: '24 Saat Askiya Al',
                      suspend7d: '7 Gun Askiya Al',
                      unsuspend: 'Askiyi Kaldir',
                      deleteUser: 'Hesabi Sil',
                      cancel: 'Vazgec',
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
                      ritualRef: 'Yorum',
                      newCode: '+ Yeni Kod',
                      code: 'Kod',
                      type: 'Tur',
                      value: 'Deger',
                      uses: 'Kullanim',
                      expires: 'Son Tarih',
                      note: 'Not',
                      revoke: 'Iptal Et',
                      activate: 'Aktif Et',
                      copyCode: 'Kopyala',
                      redemptions: 'Kullanim Gecmisi',
                      noRedemptions: 'Kullanim yok',
                      createCode: 'Kodu Olustur',
                      codeCopied: 'Kod kopyalandi.',
                      codeUpdated: 'Kod guncellendi.',
                      noExpiry: 'Suresiz',
                      revoked: 'Iptal',
                      exhausted: 'Tukendi',
                      maxUses: 'Max kullanim',
                      expiresInDays: 'Son kullanma (gun)',
                      amountPlaceholder: 'Miktar',
                      giftCreateTitle: 'Yeni Hediye Kodu',
                      tickets: 'Bilet',
                      premium: 'Premium (gun)',
                      metadata: 'Metadata',
                      actor: 'Actor',
                      target: 'Hedef'
                  }
                : {
                      title: 'Moderation Panel',
                      subtitle:
                          'Manage users, content, reports, gift codes, and audit flow from one workspace.',
                      loading: 'Checking admin session...',
                      forbidden: 'This account cannot access the admin panel.',
                      error: 'Admin panel could not be loaded.',
                      refresh: 'Refresh',
                      search: 'Search',
                      searchPlaceholder: 'email, display name, or user id',
                      home: 'Home',
                      close: 'Close',
                      users: 'Users',
                      content: 'Content',
                      rituals: 'Comments',
                      replies: 'Replies',
                      reports: 'Reports',
                      gifts: 'Gift Codes',
                      audit: 'Audit',
                      suspend24: 'Suspend 24h',
                      suspend7d: 'Suspend 7d',
                      unsuspend: 'Lift Suspension',
                      deleteUser: 'Delete Account',
                      cancel: 'Cancel',
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
                      ritualRef: 'Comment',
                      newCode: '+ New Code',
                      code: 'Code',
                      type: 'Type',
                      value: 'Value',
                      uses: 'Uses',
                      expires: 'Expires',
                      note: 'Note',
                      revoke: 'Revoke',
                      activate: 'Activate',
                      copyCode: 'Copy',
                      redemptions: 'Redemptions',
                      noRedemptions: 'No redemptions',
                      createCode: 'Create Code',
                      codeCopied: 'Code copied.',
                      codeUpdated: 'Code updated.',
                      noExpiry: 'No expiry',
                      revoked: 'Revoked',
                      exhausted: 'Exhausted',
                      maxUses: 'Max uses',
                      expiresInDays: 'Expires in days',
                      amountPlaceholder: 'Amount',
                      giftCreateTitle: 'New Gift Code',
                      tickets: 'Tickets',
                      premium: 'Premium (days)',
                      metadata: 'Metadata',
                      actor: 'Actor',
                      target: 'Target'
                  },
        [language]
    );

    const [viewState, setViewState] = useState<ViewState>('loading');
    const [session, setSession] = useState<AdminSessionPayload | null>(null);
    const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
    const [query, setQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [pendingUserAction, setPendingUserAction] = useState<PendingUserAction | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
    const [expandedGiftCodeId, setExpandedGiftCodeId] = useState<string | null>(null);
    const [showGiftForm, setShowGiftForm] = useState(false);
    const [giftType, setGiftType] = useState<GiftType>('tickets');
    const [giftAmount, setGiftAmount] = useState('100');
    const [giftMaxUses, setGiftMaxUses] = useState('1');
    const [giftExpiresInDays, setGiftExpiresInDays] = useState('30');
    const [giftNote, setGiftNote] = useState('');

    const loadDashboard = async (nextQuery = query, withLoading = true) => {
        if (withLoading) setViewState('loading');
        const result = await readAdminDashboard(nextQuery, 24);
        if (!result.ok || !result.data) {
            setViewState(result.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error');
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setDashboard(result.data);
        setQuery(nextQuery);
        setViewState('ready');
    };

    const loadGiftCodes = async () => {
        const result = await listAdminGiftCodes();
        if (!result.ok || !result.data) {
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setGiftCodes(result.data);
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
            const [dashboardResult, giftResult] = await Promise.all([
                readAdminDashboard('', 24),
                listAdminGiftCodes()
            ]);
            if (!active) return;

            if (!dashboardResult.ok || !dashboardResult.data) {
                setViewState(dashboardResult.errorCode === 'FORBIDDEN' ? 'forbidden' : 'error');
                setStatusMessage(dashboardResult.message || copy.failed);
                return;
            }

            setDashboard(dashboardResult.data);
            setGiftCodes(giftResult.ok && giftResult.data ? giftResult.data : []);
            setQuery('');
            setViewState('ready');
        })();
        return () => {
            active = false;
        };
    }, [copy.failed]);

    useEffect(() => {
        if (!statusMessage) return;
        const timeout = window.setTimeout(() => setStatusMessage(''), 3200);
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
        setStatusMessage(result.data?.auditWarning || copy.success);
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
        setStatusMessage(result.data?.auditWarning || copy.success);
        if (result.data?.id) setExpandedGiftCodeId(result.data.id);
        await loadGiftCodes();
    };

    const handleGiftRevocation = async (giftCode: GiftCode) => {
        const nextRevoked = !giftCode.is_revoked;
        setBusyKey(`gift:${giftCode.id}:revoked`);
        const result = await updateAdminGiftCode({
            codeId: giftCode.id,
            isRevoked: nextRevoked
        });
        setBusyKey(null);
        if (!result.ok) {
            setStatusMessage(result.message || copy.failed);
            return;
        }
        setStatusMessage(result.data?.auditWarning || copy.codeUpdated);
        await loadGiftCodes();
    };

    const handleCopyGiftCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setStatusMessage(copy.codeCopied);
        } catch {
            setStatusMessage(code);
        }
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
        setStatusMessage(result.data?.reportResolutionWarning || result.data?.auditWarning || copy.success);
        await loadDashboard(query, false);
    };

    const renderGate = (message: string, details?: string) => (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--color-bg)] text-[#E5E4E2]">
            <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 md:px-10">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-8">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">{message}</p>
                    {details ? (
                        <p className="mt-3 break-words text-sm leading-relaxed text-white/55">{details}</p>
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
    const activeGiftCodes = giftCodes.filter((giftCode) => !giftCode.is_revoked && giftCode.use_count < giftCode.max_uses).length;
    const giftRedemptionCount = giftCodes.reduce(
        (total, giftCode) => total + (giftCode.redemption_count ?? giftCode.use_count ?? 0),
        0
    );
    const tabs: Array<{ id: AdminTab; label: string; count: number }> = [
        { id: 'users', label: copy.users, count: users.length },
        { id: 'content', label: copy.content, count: rituals.length + replies.length },
        { id: 'reports', label: copy.reports, count: reports.length },
        { id: 'gifts', label: copy.gifts, count: activeGiftCodes },
        { id: 'audit', label: copy.audit, count: actions.length }
    ];
    const pendingActionMessage =
        pendingUserAction?.action === 'delete'
            ? copy.deleteConfirm
            : pendingUserAction?.durationHours === 168
              ? copy.suspend7dConfirm
              : copy.suspend24Confirm;
    const pendingActionCta =
        pendingUserAction?.action === 'delete' ? copy.deleteConfirmCta : copy.suspendConfirmCta;

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--color-bg)] text-[#E5E4E2]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(138,154,91,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(229,228,226,0.08),transparent_28%)]" />
            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
                <header className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-6 sm:px-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.26em] text-sage/75">
                                {language === 'tr' ? 'Web Yonetim' : 'Web Admin'}
                            </p>
                            <h1 className="mt-3 text-2xl font-bold uppercase tracking-[0.08em] sm:text-3xl">
                                {copy.title}
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
                                {copy.subtitle}
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
                                onClick={() => void Promise.all([loadDashboard(query, false), loadGiftCodes()])}
                                className="rounded-lg border border-sage/30 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-sage transition-colors hover:border-sage/60"
                            >
                                {copy.refresh}
                            </button>
                            {onHome ? (
                                <button
                                    type="button"
                                    onClick={onHome}
                                    className="rounded-lg border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-sage/40 hover:text-sage"
                                >
                                    {copy.home}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-sage/40 hover:text-sage"
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
                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] outline-none placeholder:text-gray-600 focus:border-sage/40"
                        />
                        <button
                            type="submit"
                            className="rounded-lg bg-sage px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#121212]"
                        >
                            {copy.search}
                        </button>
                    </form>
                    {statusMessage ? (
                        <p className="mt-3 break-words text-[10px] uppercase tracking-[0.14em] text-sage/85">
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
                        <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-2xl font-black text-sage">{item.value}</p>
                            <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-gray-500">
                                {item.label}
                            </p>
                        </div>
                    ))}
                </section>

                <nav className="mt-6 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    {tabs.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex min-h-11 items-center gap-3 rounded-lg px-4 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                                    active
                                        ? 'bg-sage text-[#111]'
                                        : 'border border-white/10 text-white/65 hover:border-sage/35 hover:text-sage'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={active ? 'text-[#111]/70' : 'text-white/35'}>{tab.count}</span>
                            </button>
                        );
                    })}
                </nav>

                {activeTab === 'users' ? (
                    <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.users}</h2>
                            <div className="mt-4 space-y-3">
                                {users.length === 0 ? (
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                                ) : (
                                    users.map((user) => {
                                        const suspended = Boolean(user.suspendedUntil);
                                        return (
                                            <article key={user.userId} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="break-words text-sm font-semibold text-white/90">
                                                                {user.displayName || user.email || shortId(user.userId)}
                                                            </p>
                                                            <span className={`rounded-md border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${
                                                                suspended
                                                                    ? 'border-red-400/25 text-red-200/85'
                                                                    : 'border-sage/25 text-sage'
                                                            }`}>
                                                                {suspended ? copy.suspendedUsers : copy.active}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 break-all font-mono text-[11px] text-gray-500">
                                                            {user.email || shortId(user.userId)}
                                                        </p>
                                                        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                            {copy.role}: {user.role || '-'} · {formatDateTime(user.createdAt, language)}
                                                        </p>
                                                        {user.suspendedUntil ? (
                                                            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-red-200/70">
                                                                {copy.status}: {formatDateTime(user.suspendedUntil, language)}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[330px]">
                                                        {suspended ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleUserAction(user.userId, 'unsuspend', user.email || user.userId)}
                                                                disabled={busyKey === `user:${user.userId}:unsuspend`}
                                                                className="rounded-lg border border-sage/25 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-sage transition-colors hover:border-sage/50 disabled:opacity-60"
                                                            >
                                                                {copy.unsuspend}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleUserAction(user.userId, 'suspend', user.email || user.userId, 24)}
                                                                    className="rounded-lg border border-amber-400/25 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-amber-100 transition-colors hover:border-amber-400/50"
                                                                >
                                                                    {copy.suspend24}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleUserAction(user.userId, 'suspend', user.email || user.userId, 168)}
                                                                    className="rounded-lg border border-amber-400/25 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-amber-100 transition-colors hover:border-amber-400/50"
                                                                >
                                                                    {copy.suspend7d}
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleUserAction(user.userId, 'delete', user.email || user.userId)}
                                                            className="rounded-lg border border-red-400/25 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-red-200 transition-colors hover:border-red-400/50 sm:col-span-2"
                                                        >
                                                            {copy.deleteUser}
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.session}</h2>
                            <div className="mt-4 space-y-3 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                                <p>{copy.actor}: <span className="text-white/80">{session?.email || '-'}</span></p>
                                <p>{copy.role}: <span className="text-sage">{session?.role || '-'}</span></p>
                                <p>{copy.suspendedUsers}: <span className="text-white/80">{dashboard?.stats.suspendedUsers || 0}</span></p>
                                <p>{copy.openReports}: <span className="text-white/80">{dashboard?.stats.openReports || 0}</span></p>
                            </div>
                        </aside>
                    </section>
                ) : null}

                {activeTab === 'content' ? (
                    <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.rituals}</h2>
                            <div className="custom-scrollbar mt-4 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                                {rituals.length === 0 ? (
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                                ) : (
                                    rituals.map((item) => (
                                        <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="break-words text-sm text-white/90">{item.movieTitle || copy.ritualRef}</p>
                                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                        {item.author || shortId(item.userId)}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleCommentAction('ritual', item.id, item.isRemoved ? 'restore' : 'remove')}
                                                    disabled={busyKey === `ritual:${item.id}:${item.isRemoved ? 'restore' : 'remove'}`}
                                                    className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors disabled:opacity-60 ${
                                                        item.isRemoved
                                                            ? 'border-sage/25 text-sage hover:border-sage/50'
                                                            : 'border-red-400/25 text-red-200/85 hover:border-red-400/50'
                                                    }`}
                                                >
                                                    {item.isRemoved ? copy.restore : copy.remove}
                                                </button>
                                            </div>
                                            <p className="mt-3 text-sm leading-relaxed text-gray-300">"{item.text}"</p>
                                            <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                {formatDateTime(item.createdAt, language)} · {item.isRemoved ? copy.removed : copy.active}
                                            </p>
                                        </article>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.replies}</h2>
                            <div className="custom-scrollbar mt-4 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                                {replies.length === 0 ? (
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                                ) : (
                                    replies.map((item) => (
                                        <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="break-words text-sm text-white/90">{item.author || shortId(item.userId)}</p>
                                                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                        {copy.ritualRef} {shortId(item.ritualId)}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleCommentAction('reply', item.id, item.isRemoved ? 'restore' : 'remove')}
                                                    disabled={busyKey === `reply:${item.id}:${item.isRemoved ? 'restore' : 'remove'}`}
                                                    className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors disabled:opacity-60 ${
                                                        item.isRemoved
                                                            ? 'border-sage/25 text-sage hover:border-sage/50'
                                                            : 'border-red-400/25 text-red-200/85 hover:border-red-400/50'
                                                    }`}
                                                >
                                                    {item.isRemoved ? copy.restore : copy.remove}
                                                </button>
                                            </div>
                                            <p className="mt-3 text-sm leading-relaxed text-gray-300">"{item.text}"</p>
                                        </article>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                ) : null}

                {activeTab === 'reports' ? (
                    <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.reports}</h2>
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {reports.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                reports.map((item) => (
                                    <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                    {copy.reason}: <span className="text-white/80">{item.reasonCode || copy.empty}</span>
                                                </p>
                                                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                    {copy.status}: <span className="text-sage">{item.status || copy.empty}</span>
                                                </p>
                                            </div>
                                            <span className="font-mono text-[10px] text-white/35">{shortId(item.id)}</span>
                                        </div>
                                        {item.details ? (
                                            <p className="mt-3 text-sm leading-relaxed text-gray-300">{item.details}</p>
                                        ) : null}
                                        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                            {copy.target}: {shortId(item.targetUserId || item.ritualId || item.replyId)}
                                        </p>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                ) : null}

                {activeTab === 'gifts' ? (
                    <section className="mt-6 rounded-xl border border-amber-400/15 bg-white/[0.03] p-5 sm:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-amber-200/85">{copy.gifts}</h2>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                    <span className="rounded-lg border border-white/10 px-3 py-2">{copy.active}: {activeGiftCodes}</span>
                                    <span className="rounded-lg border border-white/10 px-3 py-2">{copy.redemptions}: {giftRedemptionCount}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGiftForm(true)}
                                className="rounded-lg border border-amber-400/30 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-amber-200/80 transition-colors hover:border-amber-400/55"
                            >
                                {copy.newCode}
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {giftCodes.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                giftCodes.map((giftCode) => {
                                    const expanded = expandedGiftCodeId === giftCode.id;
                                    const redemptions = giftCode.redemptions || [];
                                    return (
                                        <article key={giftCode.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="break-all font-mono text-sm font-bold text-amber-200/90">{giftCode.code}</p>
                                                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                        {giftCodeStatus(giftCode, copy.active, copy.revoked, copy.exhausted)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCopyGiftCode(giftCode.code)}
                                                        className="rounded-lg border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-amber-400/40 hover:text-amber-100"
                                                    >
                                                        {copy.copyCode}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleGiftRevocation(giftCode)}
                                                        disabled={busyKey === `gift:${giftCode.id}:revoked`}
                                                        className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors disabled:opacity-60 ${
                                                            giftCode.is_revoked
                                                                ? 'border-sage/25 text-sage hover:border-sage/50'
                                                                : 'border-red-400/25 text-red-200 hover:border-red-400/50'
                                                        }`}
                                                    >
                                                        {giftCode.is_revoked ? copy.activate : copy.revoke}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.14em] text-gray-500 sm:grid-cols-4">
                                                <p>{copy.type}<span className="mt-1 block text-white/80">{giftCode.gift_type}</span></p>
                                                <p>{copy.value}<span className="mt-1 block text-white/80">{giftCode.value}</span></p>
                                                <p>{copy.uses}<span className="mt-1 block text-white/80">{giftCode.use_count}/{giftCode.max_uses}</span></p>
                                                <p>{copy.expires}<span className="mt-1 block text-white/80">{giftCode.expires_at ? formatDateTime(giftCode.expires_at, language) : copy.noExpiry}</span></p>
                                            </div>
                                            {giftCode.note ? (
                                                <p className="mt-4 text-sm leading-relaxed text-gray-300">{giftCode.note}</p>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedGiftCodeId(expanded ? null : giftCode.id)}
                                                className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-amber-400/35 hover:text-amber-100"
                                            >
                                                {copy.redemptions} ({giftCode.redemption_count ?? giftCode.use_count ?? 0})
                                            </button>
                                            {expanded ? (
                                                <div className="mt-3 space-y-2">
                                                    {redemptions.length === 0 ? (
                                                        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{copy.noRedemptions}</p>
                                                    ) : (
                                                        redemptions.map((redemption) => (
                                                            <div key={redemption.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                                <p className="font-mono text-[11px] text-white/75">{shortId(redemption.user_id)}</p>
                                                                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                                    {redemption.status} · {formatDateTime(redemption.redeemed_at, language)}
                                                                </p>
                                                                {redemption.last_error ? (
                                                                    <p className="mt-2 text-[11px] text-red-200/75">{redemption.last_error}</p>
                                                                ) : null}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    </section>
                ) : null}

                {activeTab === 'audit' ? (
                    <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                        <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-sage">{copy.audit}</h2>
                        <div className="mt-4 space-y-3">
                            {actions.length === 0 ? (
                                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{copy.empty}</p>
                            ) : (
                                actions.map((item) => {
                                    const metadataStatus = typeof item.metadata?.status === 'string' ? item.metadata.status : '';
                                    return (
                                        <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.16em] text-sage">{item.action || copy.empty}</p>
                                                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                                                        {formatDateTime(item.createdAt, language)}
                                                    </p>
                                                </div>
                                                <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 md:text-right">
                                                    <p>{copy.actor}: {shortId(item.actorUserId)}</p>
                                                    <p className="mt-1">{copy.target}: {shortId(item.targetUserId || item.ritualId || item.replyId || item.reportId)}</p>
                                                </div>
                                            </div>
                                            {metadataStatus ? (
                                                <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">
                                                    {copy.status}: {metadataStatus}
                                                </p>
                                            ) : null}
                                            {item.note ? (
                                                <p className="mt-3 text-sm leading-relaxed text-gray-300">{item.note}</p>
                                            ) : null}
                                        </article>
                                    );
                                })
                            )}
                        </div>
                    </section>
                ) : null}
            </div>

            <InfoFooter
                className="mt-auto w-full"
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
                    <div className="relative w-full max-w-md rounded-xl border border-amber-400/20 bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
                            {copy.giftCreateTitle}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setGiftType('tickets')}
                                className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                                    giftType === 'tickets'
                                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                                        : 'border-white/15 text-white/55 hover:border-amber-400/30'
                                }`}
                            >
                                {copy.tickets}
                            </button>
                            <button
                                type="button"
                                onClick={() => setGiftType('premium')}
                                className={`rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                                    giftType === 'premium'
                                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                                        : 'border-white/15 text-white/55 hover:border-amber-400/30'
                                }`}
                            >
                                {copy.premium}
                            </button>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={5000}
                            value={giftAmount}
                            onChange={(event) => setGiftAmount(event.target.value)}
                            placeholder={copy.amountPlaceholder}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] outline-none placeholder:text-gray-600 focus:border-amber-400/40"
                        />
                        <input
                            type="number"
                            min={1}
                            max={10000}
                            value={giftMaxUses}
                            onChange={(event) => setGiftMaxUses(event.target.value)}
                            placeholder={copy.maxUses}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] outline-none placeholder:text-gray-600 focus:border-amber-400/40"
                        />
                        <input
                            type="number"
                            min={0}
                            max={365}
                            value={giftExpiresInDays}
                            onChange={(event) => setGiftExpiresInDays(event.target.value)}
                            placeholder={copy.expiresInDays}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] outline-none placeholder:text-gray-600 focus:border-amber-400/40"
                        />
                        <input
                            type="text"
                            value={giftNote}
                            onChange={(event) => setGiftNote(event.target.value)}
                            placeholder={copy.note}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-sm text-[#E5E4E2] outline-none placeholder:text-gray-600 focus:border-amber-400/40"
                        />
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowGiftForm(false)}
                                className="rounded-lg border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/30"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCreateGiftCode()}
                                disabled={busyKey === 'gift:create'}
                                className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-400/15 disabled:opacity-60"
                            >
                                {copy.createCode}
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
                    <div className="relative w-full max-w-md rounded-xl border border-red-400/20 bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-red-200/80">
                            {copy.confirmTitle}
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-white/90">{pendingActionMessage}</p>
                        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
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
                                className="rounded-lg border border-white/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/30"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleConfirmPendingUserAction()}
                                className="rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-red-100 transition-colors hover:border-red-400/50 hover:bg-red-400/15"
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
