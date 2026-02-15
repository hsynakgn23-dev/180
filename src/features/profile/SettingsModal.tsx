import React, { useEffect, useState } from 'react';
import { useXP, type RegistrationGender } from '../../context/XPContext';
import { useLanguage } from '../../context/LanguageContext';
import { applyThemeMode, resolveThemeMode, type ThemeMode } from '../../lib/themeMode';
import {
    getRegistrationGenderOptions,
    SUPPORTED_LANGUAGE_OPTIONS,
    type LanguageCode
} from '../../i18n/localization';
import { UI_DICTIONARY } from '../../i18n/dictionary';
import {
    analyzeLetterboxdCsv,
    readStoredLetterboxdImport,
    saveLetterboxdImport,
    type LetterboxdCsvAnalysis,
    type StoredLetterboxdImport
} from '../../lib/letterboxdImport';
import { trackEvent } from '../../lib/analytics';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'identity' | 'appearance' | 'session';

type ImportCopy = {
    title: string;
    subtitle: string;
    cta: string;
    inProgress: string;
    noIdentity: string;
    parseFailed: string;
    emptyFile: string;
    importSuccess: string;
    statsPrefix: string;
    previewReady: string;
    previewTitle: string;
    mappingTitle: string;
    sampleTitle: string;
    confirmImport: string;
    clearPreview: string;
    colTitle: string;
    colYear: string;
    colTmdb: string;
    colImdb: string;
    colWatched: string;
    colRating: string;
    rowsLabel: string;
    idsLabel: string;
    titleKeysLabel: string;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        user,
        updateIdentity,
        updatePersonalInfo,
        logout,
        bio,
        avatarUrl,
        updateAvatar,
        avatarId,
        fullName,
        username,
        gender,
        birthDate,
        inviteCode,
        inviteLink,
        invitedByCode,
        inviteClaimsCount,
        inviteRewardsEarned,
        inviteRewardConfig,
        claimInviteCode
    } = useXP();
    const { text, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
    const [bioDraft, setBioDraft] = useState(bio);
    const [fullNameDraft, setFullNameDraft] = useState(fullName);
    const [usernameDraft, setUsernameDraft] = useState(username);
    const [genderDraft, setGenderDraft] = useState<RegistrationGender | ''>(gender || '');
    const [birthDateDraft, setBirthDateDraft] = useState(birthDate);
    const [theme, setTheme] = useState<ThemeMode>('midnight');
    const [statusMessage, setStatusMessage] = useState('');
    const [confirmLogout, setConfirmLogout] = useState(false);
    const [isImportingLetterboxd, setIsImportingLetterboxd] = useState(false);
    const [letterboxdSummary, setLetterboxdSummary] = useState('');
    const [letterboxdSnapshot, setLetterboxdSnapshot] = useState<StoredLetterboxdImport | null>(null);
    const [pendingLetterboxdImport, setPendingLetterboxdImport] = useState<LetterboxdCsvAnalysis | null>(null);
    const [pendingImportFileName, setPendingImportFileName] = useState('');
    const [inviteCodeDraft, setInviteCodeDraft] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const genderOptions: Array<{ value: RegistrationGender; label: string }> = getRegistrationGenderOptions(language);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const letterboxdInputRef = React.useRef<HTMLInputElement>(null);

    const importCopy: ImportCopy = React.useMemo(() => {
        if (language === 'tr') {
            return {
                title: 'Letterboxd Import',
                subtitle: 'Letterboxd CSV dosyani yukleyip izleme gecmisini kisitlama motoruna aktar.',
                cta: 'CSV Yukle',
                inProgress: 'Aktariliyor...',
                noIdentity: 'Aktif hesap bulunamadi. Tekrar giris yap.',
                parseFailed: 'CSV dosyasi okunamadi. Letterboxd export dosyasini tekrar dene.',
                emptyFile: 'Gecerli satir bulunamadi. CSV basligini kontrol et.',
                importSuccess: 'Letterboxd verisi eklendi.',
                statsPrefix: 'Toplam aktarilan',
                previewReady: 'Onizleme hazir. Importu onaylayabilirsin.',
                previewTitle: 'CSV Onizleme',
                mappingTitle: 'Algilanan Alan Eslesmeleri',
                sampleTitle: 'Ornek Satirlar',
                confirmImport: 'Importu Onayla',
                clearPreview: 'Temizle',
                colTitle: 'Film',
                colYear: 'Yil',
                colTmdb: 'TMDB',
                colImdb: 'IMDb',
                colWatched: 'Izleme',
                colRating: 'Puan',
                rowsLabel: 'satir',
                idsLabel: 'id',
                titleKeysLabel: 'baslik anahtari'
            };
        }
        if (language === 'es') {
            return {
                title: 'Importar Letterboxd',
                subtitle: 'Sube tu CSV de Letterboxd para transferir historial al motor de personalizacion.',
                cta: 'Subir CSV',
                inProgress: 'Importando...',
                noIdentity: 'No hay una cuenta activa. Vuelve a iniciar sesion.',
                parseFailed: 'No se pudo leer el CSV. Intenta de nuevo con el export de Letterboxd.',
                emptyFile: 'No se encontraron filas validas. Revisa los encabezados del CSV.',
                importSuccess: 'Datos de Letterboxd agregados.',
                statsPrefix: 'Importado total',
                previewReady: 'Vista previa lista. Puedes confirmar la importacion.',
                previewTitle: 'Vista Previa CSV',
                mappingTitle: 'Asignaciones Detectadas',
                sampleTitle: 'Filas de Muestra',
                confirmImport: 'Confirmar Importacion',
                clearPreview: 'Limpiar',
                colTitle: 'Pelicula',
                colYear: 'Ano',
                colTmdb: 'TMDB',
                colImdb: 'IMDb',
                colWatched: 'Visto',
                colRating: 'Puntuacion',
                rowsLabel: 'filas',
                idsLabel: 'ids',
                titleKeysLabel: 'claves de titulo'
            };
        }
        if (language === 'fr') {
            return {
                title: 'Import Letterboxd',
                subtitle: 'Ajoute ton CSV Letterboxd pour transferer l historique vers la personnalisation.',
                cta: 'Importer CSV',
                inProgress: 'Import en cours...',
                noIdentity: 'Aucun compte actif. Reconnecte-toi.',
                parseFailed: 'CSV illisible. Reessaie avec l export Letterboxd.',
                emptyFile: 'Aucune ligne valide detectee. Verifie les en-tetes CSV.',
                importSuccess: 'Donnees Letterboxd ajoutees.',
                statsPrefix: 'Total importe',
                previewReady: 'Apercu pret. Tu peux confirmer l import.',
                previewTitle: 'Apercu CSV',
                mappingTitle: 'Correspondances Detectees',
                sampleTitle: 'Lignes Exemple',
                confirmImport: 'Confirmer Import',
                clearPreview: 'Effacer',
                colTitle: 'Film',
                colYear: 'Annee',
                colTmdb: 'TMDB',
                colImdb: 'IMDb',
                colWatched: 'Vu le',
                colRating: 'Note',
                rowsLabel: 'lignes',
                idsLabel: 'ids',
                titleKeysLabel: 'cles de titre'
            };
        }
        return {
            title: 'Letterboxd Import',
            subtitle: 'Upload your Letterboxd CSV and transfer watch history into personalization.',
            cta: 'Upload CSV',
            inProgress: 'Importing...',
            noIdentity: 'No active account found. Please sign in again.',
            parseFailed: 'Could not read CSV. Try the original Letterboxd export again.',
            emptyFile: 'No valid rows found. Check your CSV headers.',
            importSuccess: 'Letterboxd data added.',
            statsPrefix: 'Imported total',
            previewReady: 'Preview is ready. Confirm to import.',
            previewTitle: 'CSV Preview',
            mappingTitle: 'Detected Field Mapping',
            sampleTitle: 'Sample Rows',
            confirmImport: 'Confirm Import',
            clearPreview: 'Clear',
            colTitle: 'Title',
            colYear: 'Year',
            colTmdb: 'TMDB',
            colImdb: 'IMDb',
            colWatched: 'Watched',
            colRating: 'Rating',
            rowsLabel: 'rows',
            idsLabel: 'ids',
            titleKeysLabel: 'title keys'
        };
    }, [language]);

    const inviteCopy = React.useMemo(() => {
        if (language === 'tr') {
            return {
                title: 'Davet Programi',
                subtitle: 'Linkini paylas, yeni kullanici gelirse ikiniz de XP kazanirsiniz.',
                yourCode: 'Kodun',
                copyLink: 'Linki Kopyala',
                pasteCode: 'Davet Kodu Gir',
                applyCode: 'Kodu Uygula',
                alreadyClaimed: 'Bu hesap zaten bir davet kodu kullandi.',
                claimSuccess: `Kod uygulandi. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Davet linki kopyalandi.',
                stats: `Kazandirilan: ${inviteClaimsCount} davet / ${inviteRewardsEarned} XP`
            };
        }
        if (language === 'es') {
            return {
                title: 'Programa de Invitacion',
                subtitle: 'Comparte tu enlace y, cuando llegue un nuevo usuario, ambos ganan XP.',
                yourCode: 'Tu Codigo',
                copyLink: 'Copiar Enlace',
                pasteCode: 'Ingresar Codigo',
                applyCode: 'Aplicar Codigo',
                alreadyClaimed: 'Esta cuenta ya uso un codigo de invitacion.',
                claimSuccess: `Codigo aplicado. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Enlace de invitacion copiado.',
                stats: `Ganado: ${inviteClaimsCount} invitaciones / ${inviteRewardsEarned} XP`
            };
        }
        if (language === 'fr') {
            return {
                title: 'Programme Invitation',
                subtitle: 'Partage ton lien. Si un nouveau compte rejoint, vous gagnez tous les deux du XP.',
                yourCode: 'Ton Code',
                copyLink: 'Copier le Lien',
                pasteCode: 'Entrer un Code',
                applyCode: 'Appliquer le Code',
                alreadyClaimed: 'Ce compte a deja utilise un code invitation.',
                claimSuccess: `Code applique. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Lien invitation copie.',
                stats: `Gagne: ${inviteClaimsCount} invitations / ${inviteRewardsEarned} XP`
            };
        }
        return {
            title: 'Invite Program',
            subtitle: 'Share your link. If a new account joins, both of you earn XP.',
            yourCode: 'Your Code',
            copyLink: 'Copy Link',
            pasteCode: 'Enter Invite Code',
            applyCode: 'Apply Code',
            alreadyClaimed: 'This account already used an invite code.',
            claimSuccess: `Code applied. +${inviteRewardConfig.inviteeXp} XP`,
            copied: 'Invite link copied.',
            stats: `Earned: ${inviteClaimsCount} invites / ${inviteRewardsEarned} XP`
        };
    }, [inviteClaimsCount, inviteRewardConfig.inviteeXp, inviteRewardsEarned, language]);

    useEffect(() => {
        if (!isOpen) return;

        setBioDraft(bio);
        setFullNameDraft(fullName);
        setUsernameDraft(username);
        setGenderDraft(gender || '');
        setBirthDateDraft(birthDate);
        setStatusMessage('');
        setConfirmLogout(false);
        setLetterboxdSummary('');
        setPendingLetterboxdImport(null);
        setPendingImportFileName('');
        setInviteCodeDraft('');
        setInviteStatus('');

        setTheme(resolveThemeMode());
        setLetterboxdSnapshot(readStoredLetterboxdImport(user?.id || user?.email || ''));

    }, [isOpen, bio, fullName, username, gender, birthDate, user?.id, user?.email]);

    useEffect(() => {
        if (!statusMessage) return;
        const timeout = setTimeout(() => setStatusMessage(''), 2000);
        return () => clearTimeout(timeout);
    }, [statusMessage]);

    useEffect(() => {
        if (!inviteStatus) return;
        const timeout = setTimeout(() => setInviteStatus(''), 2800);
        return () => clearTimeout(timeout);
    }, [inviteStatus]);

    const applyTheme = (nextTheme: ThemeMode) => {
        setTheme(nextTheme);
        applyThemeMode(nextTheme);
        setStatusMessage(text.settings.statusThemeUpdated);
    };

    const applyLanguage = (nextLanguage: LanguageCode) => {
        setLanguage(nextLanguage);
        setStatusMessage(UI_DICTIONARY[nextLanguage].settings.statusLanguageSaved);
    };

    const handleSaveIdentity = async () => {
        const profileResult = await updatePersonalInfo({
            fullName: fullNameDraft,
            username: usernameDraft,
            gender: (genderDraft || 'prefer_not_to_say') as RegistrationGender,
            birthDate: birthDateDraft
        });
        if (!profileResult.ok) {
            setStatusMessage(profileResult.message || text.settings.statusIdentitySaveFailed);
            return;
        }
        updateIdentity(bioDraft, avatarId);
        setStatusMessage(profileResult.message || text.settings.statusIdentitySaved);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                updateAvatar(reader.result);
                setStatusMessage(text.settings.statusAvatarUpdated);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLetterboxdImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingLetterboxd(true);
        try {
            const csvText = await file.text();
            const analysis = analyzeLetterboxdCsv(csvText);
            if (analysis.parse.importedRows === 0) {
                setStatusMessage(analysis.parse.totalRows > 0 ? importCopy.emptyFile : importCopy.parseFailed);
                event.target.value = '';
                return;
            }

            setPendingLetterboxdImport(analysis);
            setPendingImportFileName(file.name);
            setStatusMessage(importCopy.previewReady);
        } catch {
            setStatusMessage(importCopy.parseFailed);
        } finally {
            setIsImportingLetterboxd(false);
            event.target.value = '';
        }
    };

    const clearPendingLetterboxdImport = () => {
        setPendingLetterboxdImport(null);
        setPendingImportFileName('');
    };

    const confirmPendingLetterboxdImport = () => {
        const identity = user?.id || user?.email || '';
        if (!identity) {
            setStatusMessage(importCopy.noIdentity);
            return;
        }
        if (!pendingLetterboxdImport) return;

        const parsed = pendingLetterboxdImport.parse;
        const saved = saveLetterboxdImport(identity, {
            movieIds: parsed.movieIds,
            titleKeys: parsed.titleKeys,
            totalRows: parsed.totalRows,
            importedRows: parsed.importedRows,
            importedAt: new Date().toISOString(),
            sourceFileName: pendingImportFileName || undefined
        });

        setLetterboxdSnapshot(saved);
        setStatusMessage(importCopy.importSuccess);
        clearPendingLetterboxdImport();
            if (saved) {
                setLetterboxdSummary(
                    `${importCopy.statsPrefix}: ${saved.importedRows} ${importCopy.rowsLabel}, ${saved.movieIds.length} ${importCopy.idsLabel}, ${saved.titleKeys.length} ${importCopy.titleKeysLabel}`
                );
            }
    };

    const copyInviteLink = async () => {
        if (!inviteLink) return;
        try {
            if (!navigator.clipboard?.writeText) {
                setInviteStatus('Clipboard unavailable.');
                return;
            }
            await navigator.clipboard.writeText(inviteLink);
            trackEvent('invite_created', {
                inviteCode,
                source: 'settings_copy_link'
            }, {
                userId: user?.id || null
            });
            setInviteStatus(inviteCopy.copied);
        } catch {
            setInviteStatus('Clipboard failed.');
        }
    };

    const handleApplyInviteCode = () => {
        if (invitedByCode) {
            setInviteStatus(inviteCopy.alreadyClaimed);
            return;
        }
        const result = claimInviteCode(inviteCodeDraft);
        if (result.ok) {
            setInviteCodeDraft('');
            setInviteStatus(inviteCopy.claimSuccess);
        } else {
            setInviteStatus(result.message || 'Invite code failed.');
        }
    };

    const handleLogout = async () => {
        if (!confirmLogout) {
            setConfirmLogout(true);
            return;
        }
        await logout();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[70] animate-fade-in"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#121212] border-l border-white/10 z-[80] animate-slide-in-right overflow-y-auto">
                <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 p-6 z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg tracking-[0.22em] uppercase font-bold text-sage">{text.settings.title}</h2>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#E5E4E2]/45 mt-1">
                                {text.settings.subtitle}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[10px] tracking-[0.18em] uppercase border border-white/15 rounded px-3 py-1.5 text-gray-400 hover:text-sage hover:border-sage/35 transition-colors"
                        >
                            {text.settings.close}
                        </button>
                    </div>

                    <div className="flex gap-2 mt-5">
                        {([
                            { id: 'identity', label: text.settings.tabIdentity },
                            { id: 'appearance', label: text.settings.tabAppearance },
                            { id: 'session', label: text.settings.tabSession }
                        ] as const).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 text-[10px] uppercase tracking-[0.2em] rounded border transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-sage text-[#121212] border-sage'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:text-sage hover:border-sage/30'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {statusMessage && (
                        <div className="mb-5 text-[10px] uppercase tracking-[0.16em] text-sage/90 border border-sage/20 bg-sage/10 rounded px-3 py-2">
                            {statusMessage}
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.avatar}</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-[#0f0f0f]">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg text-sage/70 font-bold">
                                                {user?.name?.slice(0, 1).toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[10px] uppercase tracking-[0.18em] border border-sage/30 rounded px-3 py-2 text-sage hover:border-sage/60 transition-colors"
                                        >
                                            {text.settings.uploadAvatar}
                                        </button>
                                        <p className="text-[10px] text-gray-500 mt-2">{text.settings.avatarHint}</p>
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.personalInfo}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.fullName}
                                        <input
                                            value={fullNameDraft}
                                            onChange={(e) => setFullNameDraft(e.target.value)}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none"
                                            placeholder={text.login.fullNamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.username}
                                        <input
                                            value={usernameDraft}
                                            onChange={(e) => setUsernameDraft(e.target.value.trim())}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none"
                                            placeholder={text.login.usernamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.gender}
                                        <select
                                            value={genderDraft}
                                            onChange={(e) => setGenderDraft(e.target.value as RegistrationGender | '')}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] focus:border-sage/40 outline-none"
                                        >
                                            <option value="">{text.settings.select}</option>
                                            {genderOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.birthDate}
                                        <input
                                            type="date"
                                            value={birthDateDraft}
                                            onChange={(e) => setBirthDateDraft(e.target.value)}
                                            className="mt-1 w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm normal-case tracking-normal text-[#E5E4E2] focus:border-sage/40 outline-none"
                                        />
                                    </label>
                                </div>
                                <p className="mt-3 text-[10px] text-gray-500">{text.settings.usernameHint}</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2 block">
                                    {text.settings.bio} ({bioDraft.length}/180)
                                </label>
                                <textarea
                                    value={bioDraft}
                                    onChange={(e) => setBioDraft(e.target.value.slice(0, 180))}
                                    rows={4}
                                    className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none resize-none"
                                    placeholder={text.settings.bioPlaceholder}
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveIdentity}
                                    className="mt-4 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
                                >
                                    {text.settings.saveIdentity}
                                </button>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{importCopy.title}</p>
                                <p className="text-xs text-gray-500 mb-4">{importCopy.subtitle}</p>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => letterboxdInputRef.current?.click()}
                                        disabled={isImportingLetterboxd}
                                        className="text-[10px] uppercase tracking-[0.18em] border border-sage/30 rounded px-3 py-2 text-sage hover:border-sage/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isImportingLetterboxd ? importCopy.inProgress : importCopy.cta}
                                    </button>
                                    {letterboxdSnapshot ? (
                                        <span className="text-[10px] text-gray-500">
                                            {importCopy.statsPrefix}: {letterboxdSnapshot.importedRows} rows
                                        </span>
                                    ) : null}
                                </div>

                                <input
                                    ref={letterboxdInputRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="hidden"
                                    onChange={(event) => void handleLetterboxdImport(event)}
                                />

                                {pendingLetterboxdImport ? (
                                    <div className="mt-4 rounded-lg border border-sage/25 bg-[#0f0f0f] p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.16em] text-sage/85">{importCopy.previewTitle}</p>
                                                <p className="mt-1 text-[10px] text-gray-500">
                                                    {pendingImportFileName || 'letterboxd.csv'} · {pendingLetterboxdImport.parse.totalRows} {importCopy.rowsLabel}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={clearPendingLetterboxdImport}
                                                className="text-[10px] uppercase tracking-[0.14em] text-gray-400 hover:text-white transition-colors"
                                            >
                                                {importCopy.clearPreview}
                                            </button>
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-2">{importCopy.mappingTitle}</p>
                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colTitle}: {pendingLetterboxdImport.mapping.title || '-'}
                                                </div>
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colYear}: {pendingLetterboxdImport.mapping.year || '-'}
                                                </div>
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colTmdb}: {pendingLetterboxdImport.mapping.tmdbId || '-'}
                                                </div>
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colImdb}: {pendingLetterboxdImport.mapping.imdbId || '-'}
                                                </div>
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colWatched}: {pendingLetterboxdImport.mapping.watchedDate || '-'}
                                                </div>
                                                <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-gray-300">
                                                    {importCopy.colRating}: {pendingLetterboxdImport.mapping.rating || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-2">{importCopy.sampleTitle}</p>
                                            <div className="space-y-1">
                                                {pendingLetterboxdImport.previewRows.map((entry, index) => (
                                                    <div key={`${entry.title}-${index}`} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-gray-300">
                                                        <span className="text-[#E5E4E2]">{entry.title || '-'}</span>
                                                        <span className="text-gray-500"> · {entry.year || '-'} · {importCopy.colTmdb}: {entry.tmdbId || '-'} · {importCopy.colWatched}: {entry.watchedDate || '-'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={confirmPendingLetterboxdImport}
                                            className="mt-4 w-full bg-sage text-[#121212] rounded py-2 text-[10px] uppercase tracking-[0.18em] font-bold hover:opacity-90 transition-opacity"
                                        >
                                            {importCopy.confirmImport}
                                        </button>
                                    </div>
                                ) : null}

                                {letterboxdSummary ? (
                                    <p className="mt-3 text-[10px] text-sage/80 uppercase tracking-[0.12em]">{letterboxdSummary}</p>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.theme}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => applyTheme('midnight')}
                                        className={`p-4 rounded border transition-colors ${
                                            theme === 'midnight'
                                                ? 'border-sage bg-sage/10'
                                                : 'border-white/10 bg-[#141414] hover:border-sage/30'
                                        }`}
                                    >
                                        <div className="theme-swatch-midnight h-10 rounded bg-[#121212] border border-white/10 mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text)]">{text.settings.themeMidnight}</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyTheme('dawn')}
                                        className={`p-4 rounded border transition-colors ${
                                            theme === 'dawn'
                                                ? 'border-sage bg-sage/10'
                                                : 'border-white/10 bg-[#141414] hover:border-sage/30'
                                        }`}
                                    >
                                        <div className="theme-swatch-dawn h-10 rounded bg-[#FDFCF8] border border-[#d8d4cc] mb-2" />
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text)]">{text.settings.themeDawn}</p>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.language}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                                        <button
                                            key={option.code}
                                            type="button"
                                            onClick={() => applyLanguage(option.code)}
                                            className={`px-4 py-2 rounded border text-[10px] uppercase tracking-[0.18em] transition-colors ${
                                                language === option.code
                                                    ? 'border-sage bg-sage/10 text-sage'
                                                    : 'border-white/10 text-gray-400 hover:border-sage/30 hover:text-sage'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'session' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{text.settings.activeAccount}</p>
                                <p className="text-sm font-bold text-[#E5E4E2]">{user?.name || text.profileWidget.observer}</p>
                                <p className="text-xs text-gray-500 mt-1">{user?.email || text.settings.unknown}</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{inviteCopy.title}</p>
                                <p className="text-xs text-gray-500 mb-4">{inviteCopy.subtitle}</p>

                                <div className="rounded border border-white/10 bg-[#141414] px-3 py-2 mb-3">
                                    <p className="text-[9px] uppercase tracking-[0.14em] text-gray-500 mb-1">{inviteCopy.yourCode}</p>
                                    <p className="text-sm tracking-[0.14em] font-bold text-sage">{inviteCode || '-'}</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void copyInviteLink()}
                                    className="w-full text-[10px] uppercase tracking-[0.18em] border border-sage/30 rounded px-3 py-2 text-sage hover:border-sage/60 transition-colors"
                                >
                                    {inviteCopy.copyLink}
                                </button>

                                <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                    {inviteCopy.stats}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                    Inviter: +{inviteRewardConfig.inviterXp} XP | Invitee: +{inviteRewardConfig.inviteeXp} XP
                                </p>

                                {invitedByCode ? (
                                    <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-sage/80">
                                        Claimed code: {invitedByCode}
                                    </p>
                                ) : (
                                    <div className="mt-4 space-y-2">
                                        <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500 block">
                                            {inviteCopy.pasteCode}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                value={inviteCodeDraft}
                                                onChange={(e) => setInviteCodeDraft(e.target.value.toUpperCase())}
                                                placeholder="ABCD1234"
                                                className="flex-1 bg-[#141414] border border-white/10 rounded px-3 py-2 text-sm tracking-[0.14em] text-[#E5E4E2] placeholder:text-gray-600 focus:border-sage/40 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleApplyInviteCode}
                                                className="text-[10px] uppercase tracking-[0.16em] border border-white/15 rounded px-3 py-2 text-white/80 hover:text-sage hover:border-sage/40 transition-colors"
                                            >
                                                {inviteCopy.applyCode}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {inviteStatus && (
                                    <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-sage/90">{inviteStatus}</p>
                                )}
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-red-400/80 mb-3">
                                    {text.settings.sessionControl}
                                </p>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full border border-red-500/30 text-red-400 rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-red-500/10 transition-colors"
                                >
                                    {confirmLogout ? text.settings.logoutConfirm : text.settings.logout}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
