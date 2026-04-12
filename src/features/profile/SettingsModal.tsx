import React, { useEffect, useState } from 'react';
import { CINEMA_AVATARS, resolveAvatarDisplay } from '../../data/avatarData';
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
import { readAvatarFileAsDataUrl } from '../../lib/avatarUpload';
import { isSupabaseLive, supabase } from '../../lib/supabase';
import {
    getDefaultProfileVisibility,
    normalizeProfileVisibility,
    readProfileVisibilityFromXpState,
    writeProfileVisibilityToXpState,
    type ProfileVisibility
} from '../../lib/profileVisibility';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'identity' | 'appearance' | 'privacy' | 'session';

const getPrivacyStorageKey = (identity: string): string =>
    `ac_web_profile_visibility_v1:${identity.trim().toLowerCase()}`;

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
        completePasswordReset,
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
        claimInviteCode,
        isPremium
    } = useXP();
    const { text, language, setLanguage } = useLanguage();
    const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
    const [bioDraft, setBioDraft] = useState(bio);
    const [avatarIdDraft, setAvatarIdDraft] = useState(avatarId);
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
    const [privacyDraft, setPrivacyDraft] = useState<ProfileVisibility>(getDefaultProfileVisibility());
    const [passwordDraft, setPasswordDraft] = useState('');
    const [passwordConfirmDraft, setPasswordConfirmDraft] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
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
                subtitle: 'Sube tu CSV de Letterboxd para transferir historial al motor de personalizaciÃ³n.',
                cta: 'Subir CSV',
                inProgress: 'Importando...',
                noIdentity: 'No hay una cuenta activa. Vuelve a iniciar sesiÃ³n.',
                parseFailed: 'No se pudo leer el CSV. Intenta de nuevo con el export de Letterboxd.',
                emptyFile: 'No se encontraron filas vÃ¡lidas. Revisa los encabezados del CSV.',
                importSuccess: 'Datos de Letterboxd agregados.',
                statsPrefix: 'Importado total',
                previewReady: 'Vista previa lista. Puedes confirmar la importaciÃ³n.',
                previewTitle: 'Vista Previa CSV',
                mappingTitle: 'Asignaciones Detectadas',
                sampleTitle: 'Filas de Muestra',
                confirmImport: 'Confirmar ImportaciÃ³n',
                clearPreview: 'Limpiar',
                colTitle: 'PelÃ­cula',
                colYear: 'AÃ±o',
                colTmdb: 'TMDB',
                colImdb: 'IMDb',
                colWatched: 'Visto',
                colRating: 'PuntuaciÃ³n',
                rowsLabel: 'filas',
                idsLabel: 'ids',
                titleKeysLabel: 'claves de tÃ­tulo'
            };
        }
        if (language === 'fr') {
            return {
                title: 'Import Letterboxd',
                subtitle: 'Ajoute ton CSV Letterboxd pour transfÃ©rer lâ€™historique vers la personnalisation.',
                cta: 'Importer CSV',
                inProgress: 'Import en cours...',
                noIdentity: 'Aucun compte actif. Reconnecte-toi.',
                parseFailed: 'CSV illisible. RÃ©essaie avec lâ€™export Letterboxd.',
                emptyFile: 'Aucune ligne valide dÃ©tectÃ©e. VÃ©rifie les en-tÃªtes CSV.',
                importSuccess: 'Donnees Letterboxd ajoutees.',
                statsPrefix: 'Total importÃ©',
                previewReady: 'AperÃ§u prÃªt. Tu peux confirmer lâ€™import.',
                previewTitle: 'AperÃ§u CSV',
                mappingTitle: 'Correspondances DÃ©tectÃ©es',
                sampleTitle: 'Lignes Exemple',
                confirmImport: 'Confirmer Import',
                clearPreview: 'Effacer',
                colTitle: 'Film',
                colYear: 'AnnÃ©e',
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
                alreadyClaimed: 'Bu hesap zaten bir davet kodu kullandÄ±.',
                claimSuccess: `Kod uygulandÄ±. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Davet linki kopyalandÄ±.',
                stats: `KazandÄ±rÄ±lan: ${inviteClaimsCount} davet / ${inviteRewardsEarned} XP`,
                rewardSummary: `Davet Eden: +${inviteRewardConfig.inviterXp} XP | Davet Alan: +${inviteRewardConfig.inviteeXp} XP`
            };
        }
        if (language === 'es') {
            return {
                title: 'Programa de InvitaciÃ³n',
                subtitle: 'Comparte tu enlace y, cuando llegue un nuevo usuario, ambos ganan XP.',
                yourCode: 'Tu CÃ³digo',
                copyLink: 'Copiar Enlace',
                pasteCode: 'Ingresar CÃ³digo',
                applyCode: 'Aplicar CÃ³digo',
                alreadyClaimed: 'Esta cuenta ya usÃ³ un cÃ³digo de invitaciÃ³n.',
                claimSuccess: `CÃ³digo aplicado. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Enlace de invitaciÃ³n copiado.',
                stats: `Ganado: ${inviteClaimsCount} invitaciones / ${inviteRewardsEarned} XP`,
                rewardSummary: `Invitador: +${inviteRewardConfig.inviterXp} XP | Invitado: +${inviteRewardConfig.inviteeXp} XP`
            };
        }
        if (language === 'fr') {
            return {
                title: 'Programme dâ€™Invitation',
                subtitle: 'Partage ton lien. Si un nouveau compte rejoint, vous gagnez tous les deux de lâ€™XP.',
                yourCode: 'Ton Code',
                copyLink: 'Copier le Lien',
                pasteCode: 'Entrer un Code',
                applyCode: 'Appliquer le Code',
                alreadyClaimed: 'Ce compte a dÃ©jÃ  utilisÃ© un code dâ€™invitation.',
                claimSuccess: `Code appliquÃ©. +${inviteRewardConfig.inviteeXp} XP`,
                copied: 'Lien dâ€™invitation copiÃ©.',
                stats: `GagnÃ©: ${inviteClaimsCount} invitations / ${inviteRewardsEarned} XP`,
                rewardSummary: `Inviteur: +${inviteRewardConfig.inviterXp} XP | InvitÃ©: +${inviteRewardConfig.inviteeXp} XP`
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
            stats: `Earned: ${inviteClaimsCount} invites / ${inviteRewardsEarned} XP`,
            rewardSummary: `Inviter: +${inviteRewardConfig.inviterXp} XP | Invitee: +${inviteRewardConfig.inviteeXp} XP`
        };
    }, [inviteClaimsCount, inviteRewardConfig.inviteeXp, inviteRewardConfig.inviterXp, inviteRewardsEarned, language]);

    const privacyCopy = React.useMemo(() => {
        if (language === 'tr') {
            return {
                tab: 'Gizlilik',
                title: 'Profil Gizliligi',
                subtitle: 'Web public profilinde hangi alanlarin gorunecegini sec.',
                statsTitle: 'Istatistikleri goster',
                statsBody: 'Seri, gun ve yorum ozetleri public profilde gorunsun.',
                followsTitle: 'Takip sayilarini goster',
                followsBody: 'Takip ve takipci sayilari public profilde gorunsun.',
                marksTitle: 'Marklari goster',
                marksBody: 'Acik marklar future web yuzeyleri icin saklansin.',
                save: 'Gizliligi Kaydet',
                saved: 'Gizlilik ayarlari kaydedildi.',
                failed: 'Gizlilik ayarlari kaydedilemedi.',
                signInRequired: 'Gizlilik ayarlari icin once giris yap.'
            };
        }
        if (language === 'es') {
            return {
                tab: 'Privacidad',
                title: 'Privacidad del Perfil',
                subtitle: 'Elige que se muestra en tu perfil publico web.',
                statsTitle: 'Mostrar estadisticas',
                statsBody: 'Muestra racha, dias y resumen de comentarios.',
                followsTitle: 'Mostrar conteos de seguimiento',
                followsBody: 'Muestra totales de siguiendo y seguidores.',
                marksTitle: 'Mostrar marcas',
                marksBody: 'Guarda tus marcas abiertas para futuras superficies web.',
                save: 'Guardar Privacidad',
                saved: 'La privacidad se guardo.',
                failed: 'No se pudo guardar la privacidad.',
                signInRequired: 'Inicia sesion para guardar privacidad.'
            };
        }
        if (language === 'fr') {
            return {
                tab: 'Confidentialite',
                title: 'Confidentialite du Profil',
                subtitle: 'Choisis ce qui apparait sur ton profil public web.',
                statsTitle: 'Afficher les stats',
                statsBody: 'Affiche la serie, les jours et le resume des commentaires.',
                followsTitle: 'Afficher les abonnements',
                followsBody: 'Affiche les totaux abonnes et abonnements.',
                marksTitle: 'Afficher les marques',
                marksBody: 'Conserve les marques debloquees pour les futures surfaces web.',
                save: 'Enregistrer la Confidentialite',
                saved: 'Les reglages de confidentialite sont enregistres.',
                failed: 'La confidentialite na pas pu etre enregistree.',
                signInRequired: 'Connecte-toi pour enregistrer la confidentialite.'
            };
        }
        return {
            tab: 'Privacy',
            title: 'Profile Privacy',
            subtitle: 'Choose what appears on your public web profile.',
            statsTitle: 'Show stats',
            statsBody: 'Show streak, days, and comment summaries on the public profile.',
            followsTitle: 'Show follow counts',
            followsBody: 'Show following and follower totals on the public profile.',
            marksTitle: 'Show marks',
            marksBody: 'Keep unlocked marks available for future web surfaces.',
            save: 'Save Privacy',
            saved: 'Privacy settings saved.',
            failed: 'Privacy settings could not be saved.',
            signInRequired: 'Sign in to save privacy settings.'
        };
    }, [language]);

    const settingsUiCopy = React.useMemo(() => {
        if (language === 'tr') {
            return {
                avatarFileFailed: 'Avatar dosyasi islenemedi.',
                clipboardUnavailable: 'Pano kullanilamiyor.',
                clipboardFailed: 'Pano kopyalanamadi.',
                inviteCodeFailed: 'Davet kodu uygulanamadi.',
                claimedCodeLabel: 'Kullanilan kod',
                toggleOn: 'Acik',
                toggleOff: 'Kapali'
            };
        }
        if (language === 'es') {
            return {
                avatarFileFailed: 'No se pudo procesar el archivo del avatar.',
                clipboardUnavailable: 'Portapapeles no disponible.',
                clipboardFailed: 'No se pudo copiar al portapapeles.',
                inviteCodeFailed: 'No se pudo aplicar el codigo.',
                claimedCodeLabel: 'Codigo usado',
                toggleOn: 'Activo',
                toggleOff: 'Inactivo'
            };
        }
        if (language === 'fr') {
            return {
                avatarFileFailed: 'Le fichier avatar n a pas pu etre traite.',
                clipboardUnavailable: 'Presse-papiers indisponible.',
                clipboardFailed: 'La copie dans le presse-papiers a echoue.',
                inviteCodeFailed: 'Le code n a pas pu etre applique.',
                claimedCodeLabel: 'Code utilise',
                toggleOn: 'Actif',
                toggleOff: 'Inactif'
            };
        }
        return {
            avatarFileFailed: 'Avatar file could not be processed.',
            clipboardUnavailable: 'Clipboard unavailable.',
            clipboardFailed: 'Clipboard copy failed.',
            inviteCodeFailed: 'Invite code could not be applied.',
            claimedCodeLabel: 'Claimed code',
            toggleOn: 'On',
            toggleOff: 'Off'
        };
    }, [language]);

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
        setPasswordDraft('');
        setPasswordConfirmDraft('');
        setIsUpdatingPassword(false);
        const privacyIdentity = user?.id || user?.email || '';
        if (privacyIdentity) {
            try {
                const raw = localStorage.getItem(getPrivacyStorageKey(privacyIdentity));
                if (raw) {
                    setPrivacyDraft(normalizeProfileVisibility(JSON.parse(raw) as ProfileVisibility));
                } else {
                    setPrivacyDraft(getDefaultProfileVisibility());
                }
            } catch {
                setPrivacyDraft(getDefaultProfileVisibility());
            }
        } else {
            setPrivacyDraft(getDefaultProfileVisibility());
        }

        setTheme(resolveThemeMode());
        setLetterboxdSnapshot(readStoredLetterboxdImport(user?.id || user?.email || ''));

    }, [isOpen, bio, fullName, username, gender, birthDate, user?.id, user?.email]);

    useEffect(() => {
        if (!isOpen || !user?.id || !isSupabaseLive() || !supabase) return;
        let active = true;

        void supabase
            .from('profiles')
            .select('xp_state')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!active || error || !data?.xp_state) return;
                const nextVisibility = readProfileVisibilityFromXpState(data.xp_state);
                setPrivacyDraft(nextVisibility);
                try {
                    localStorage.setItem(
                        getPrivacyStorageKey(user.id || user.email || ''),
                        JSON.stringify(nextVisibility)
                    );
                } catch {
                    // ignore local cache failures
                }
            });

        return () => {
            active = false;
        };
    }, [isOpen, user?.email, user?.id]);

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
        updateIdentity(bioDraft, avatarIdDraft);
        setStatusMessage(profileResult.message || text.settings.statusIdentitySaved);
    };

    const handleChangePassword = async () => {
        if (!user) {
            setStatusMessage(text.login.resetPasswordFailed);
            return;
        }

        if (passwordDraft !== passwordConfirmDraft) {
            setStatusMessage(text.login.passwordMismatch);
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const result = await completePasswordReset(passwordDraft);
            if (!result.ok) {
                setStatusMessage(result.message || text.login.resetPasswordFailed);
                return;
            }

            setPasswordDraft('');
            setPasswordConfirmDraft('');
            setStatusMessage(result.message || text.login.resetPasswordSuccess);
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleSavePrivacy = async () => {
        if (!user) {
            setStatusMessage(privacyCopy.signInRequired);
            return;
        }

        const normalizedVisibility = normalizeProfileVisibility(privacyDraft);
        const localIdentity = user.id || user.email || '';
        if (localIdentity) {
            try {
                localStorage.setItem(
                    getPrivacyStorageKey(localIdentity),
                    JSON.stringify(normalizedVisibility)
                );
            } catch {
                // ignore local cache failures
            }
        }

        if (!isSupabaseLive() || !supabase || !user.id) {
            setPrivacyDraft(normalizedVisibility);
            setStatusMessage(privacyCopy.saved);
            return;
        }

        const { data: profileRow } = await supabase
            .from('profiles')
            .select('xp_state')
            .eq('user_id', user.id)
            .maybeSingle();

        const baseXpState =
            profileRow?.xp_state && typeof profileRow.xp_state === 'object'
                ? (profileRow.xp_state as Record<string, unknown>)
                : {};

        const nextXpState = writeProfileVisibilityToXpState(baseXpState, normalizedVisibility);
        const { error } = await supabase
            .from('profiles')
            .upsert(
                {
                    user_id: user.id,
                    email: user.email,
                    display_name: usernameDraft || fullNameDraft || user.name,
                    xp_state: nextXpState,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            setStatusMessage(privacyCopy.failed);
            return;
        }

        setPrivacyDraft(normalizedVisibility);
        setStatusMessage(privacyCopy.saved);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readAvatarFileAsDataUrl(file);
            updateAvatar(dataUrl);
            setStatusMessage(text.settings.statusAvatarUpdated);
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : settingsUiCopy.avatarFileFailed);
        } finally {
            e.target.value = '';
        }
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
                setInviteStatus(settingsUiCopy.clipboardUnavailable);
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
            setInviteStatus(settingsUiCopy.clipboardFailed);
        }
    };

    const handleApplyInviteCode = async () => {
        if (invitedByCode) {
            setInviteStatus(inviteCopy.alreadyClaimed);
            return;
        }
        const result = await claimInviteCode(inviteCodeDraft);
        if (result.ok) {
            setInviteCodeDraft('');
            setInviteStatus(inviteCopy.claimSuccess);
        } else {
            setInviteStatus(result.message || settingsUiCopy.inviteCodeFailed);
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

    const handleOpenAccountDeletion = () => {
        trackEvent('page_view', {
            reason: 'web_settings_account_deletion_open',
            source: 'web_settings_modal'
        });
        window.open('/account-deletion/', '_blank', 'noopener,noreferrer');
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[70] animate-fade-in"
                onClick={onClose}
            />

            <div className="settings-modal-shell fixed inset-y-0 right-0 w-full max-w-xl border-l z-[80] animate-slide-in-right overflow-y-auto">
                <div className="settings-modal-header sticky top-0 backdrop-blur-xl border-b p-6 sm:p-7 z-10">
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

                    <div className="flex flex-wrap gap-2 mt-5">
                        {([
                            { id: 'identity', label: text.settings.tabIdentity },
                            { id: 'appearance', label: text.settings.tabAppearance },
                            { id: 'privacy', label: privacyCopy.tab },
                            { id: 'session', label: text.settings.tabSession }
                        ] as const).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 text-[10px] uppercase tracking-[0.2em] rounded border transition-colors ${
                                    activeTab === tab.id
                                        ? 'settings-tab-button bg-sage text-[#121212] border-sage'
                                        : 'settings-tab-button settings-tab-button-inactive bg-white/5 text-gray-400 border-white/10 hover:text-sage hover:border-sage/30'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="settings-modal-body p-6 pb-10 sm:p-7 sm:pb-12">
                    {statusMessage && (
                        <div className="mb-5 text-[10px] uppercase tracking-[0.16em] text-sage/90 border border-sage/20 bg-sage/10 rounded px-3 py-2">
                            {statusMessage}
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-4">{text.settings.avatar}</p>

                                {/* Current avatar preview */}
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-[#0f0f0f] flex items-center justify-center shrink-0">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            (() => {
                                                const { svgPaths, bg, color } = resolveAvatarDisplay(avatarIdDraft);
                                                return (
                                                    <div className={`w-full h-full flex items-center justify-center ${bg}`} style={{ color }}>
                                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                                            strokeLinecap="round" strokeLinejoin="round"
                                                            dangerouslySetInnerHTML={{ __html: svgPaths }} />
                                                    </div>
                                                );
                                            })()
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

                                {/* Cinema avatar grid */}
                                <div className="grid grid-cols-4 gap-2">
                                    {CINEMA_AVATARS.map((av) => {
                                        const isSelected = !avatarUrl && avatarIdDraft === av.id;
                                        const isLocked = !av.isFree && !isPremium;
                                        return (
                                            <button
                                                key={av.id}
                                                type="button"
                                                disabled={isLocked}
                                                onClick={() => {
                                                    if (isLocked) return;
                                                    setAvatarIdDraft(av.id);
                                                    if (avatarUrl) updateAvatar('');
                                                }}
                                                className={`relative flex flex-col items-center justify-center gap-1 rounded-lg p-2 border transition-colors ${
                                                    isLocked
                                                        ? 'border-white/5 bg-white/2 opacity-45 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'border-sage/60 bg-sage/10'
                                                            : 'border-white/10 hover:border-sage/30 bg-white/5'
                                                }`}
                                                title={isLocked ? 'Premium üyelik gerektirir' : av.label}
                                            >
                                                {isLocked && (
                                                    <span className="absolute top-1 right-1 text-[8px] leading-none">🔒</span>
                                                )}
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                                                    strokeLinecap="round" strokeLinejoin="round"
                                                    style={{ color: av.color }}
                                                    dangerouslySetInnerHTML={{ __html: av.svgPaths }} />
                                                <span className="text-[8px] uppercase tracking-widest text-gray-500 truncate w-full text-center">{av.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {!isPremium && (
                                    <div className="flex items-center gap-2 bg-amber-900/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
                                        <span className="text-[10px] text-amber-400/80">🔒 Diğer avatarlar premium üyelik gerektirir.</span>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-3">{text.settings.personalInfo}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.fullName}
                                        <input
                                            value={fullNameDraft}
                                            onChange={(e) => setFullNameDraft(e.target.value)}
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
                                            placeholder={text.login.fullNamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.username}
                                        <input
                                            value={usernameDraft}
                                            onChange={(e) => setUsernameDraft(e.target.value.trim())}
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
                                            placeholder={text.login.usernamePlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
                                        {text.settings.gender}
                                        <select
                                            value={genderDraft}
                                            onChange={(e) => setGenderDraft(e.target.value as RegistrationGender | '')}
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
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
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
                                        />
                                    </label>
                                </div>
                                <p className="mt-3 text-[10px] text-gray-500">{text.settings.usernameHint}</p>
                            </div>

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <label className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2 block">
                                    {text.settings.bio} ({bioDraft.length}/180)
                                </label>
                                <textarea
                                    value={bioDraft}
                                    onChange={(e) => setBioDraft(e.target.value.slice(0, 180))}
                                    rows={4}
                                    className="settings-field w-full rounded px-3 py-2.5 text-sm focus:border-sage/40 outline-none resize-none"
                                    placeholder={text.settings.bioPlaceholder}
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveIdentity}
                                    className="settings-primary-action mt-4 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
                                >
                                    {text.settings.saveIdentity}
                                </button>
                            </div>

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
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
                                                    {pendingImportFileName || 'letterboxd.csv'} Â· {pendingLetterboxdImport.parse.totalRows} {importCopy.rowsLabel}
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
                                                        <span className="text-gray-500"> Â· {entry.year || '-'} Â· {importCopy.colTmdb}: {entry.tmdbId || '-'} Â· {importCopy.colWatched}: {entry.watchedDate || '-'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={confirmPendingLetterboxdImport}
                                            className="settings-primary-action mt-4 w-full bg-sage text-[#121212] rounded py-2 text-[10px] uppercase tracking-[0.18em] font-bold hover:opacity-90 transition-opacity"
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
                            <div className="settings-panel rounded-xl p-5 sm:p-6">
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

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
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

                    {activeTab === 'privacy' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{privacyCopy.title}</p>
                                <p className="text-xs text-gray-500">{privacyCopy.subtitle}</p>
                            </div>

                            {([
                                { key: 'showStats', title: privacyCopy.statsTitle, body: privacyCopy.statsBody },
                                { key: 'showFollowCounts', title: privacyCopy.followsTitle, body: privacyCopy.followsBody },
                                { key: 'showMarks', title: privacyCopy.marksTitle, body: privacyCopy.marksBody }
                            ] as const).map((item) => {
                                const enabled = privacyDraft[item.key];
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() =>
                                            setPrivacyDraft((prev) => ({
                                                ...prev,
                                                [item.key]: !enabled
                                            }))
                                        }
                                        className={`settings-privacy-row w-full rounded-xl border p-4 sm:p-5 text-left transition-colors ${
                                            enabled
                                                ? 'border-sage/35 bg-sage/10'
                                                : 'border-white/10 bg-white/5 hover:border-sage/25'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.16em] text-[#E5E4E2]">{item.title}</p>
                                                <p className="mt-2 text-xs text-gray-500">{item.body}</p>
                                            </div>
                                            <span
                                                className={`settings-status-chip mt-0.5 inline-flex min-w-[70px] justify-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                                                    enabled
                                                        ? 'border-sage/40 text-sage bg-sage/10'
                                                        : 'border-white/10 text-gray-500'
                                                }`}
                                            >
                                                {enabled ? settingsUiCopy.toggleOn : settingsUiCopy.toggleOff}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => void handleSavePrivacy()}
                                className="settings-primary-action mt-2 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity"
                            >
                                {privacyCopy.save}
                            </button>
                        </div>
                    )}

                    {activeTab === 'session' && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">{text.settings.activeAccount}</p>
                                <p className="text-sm font-bold text-[#E5E4E2]">{user?.name || text.profileWidget.observer}</p>
                                <p className="text-xs text-gray-500 mt-1">{user?.email || text.settings.unknown}</p>
                            </div>

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">
                                    {text.login.resetPasswordForm}
                                </p>
                                <p className="text-xs text-gray-500 mb-4">{text.login.resetPasswordInfo}</p>

                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500 block">
                                        {text.login.newPassword}
                                        <input
                                            type="password"
                                            value={passwordDraft}
                                            onChange={(e) => setPasswordDraft(e.target.value)}
                                            disabled={!user}
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
                                            placeholder={text.login.newPasswordPlaceholder}
                                        />
                                    </label>
                                    <label className="text-[10px] uppercase tracking-[0.12em] text-gray-500 block">
                                        {text.login.confirmNewPassword}
                                        <input
                                            type="password"
                                            value={passwordConfirmDraft}
                                            onChange={(e) => setPasswordConfirmDraft(e.target.value)}
                                            disabled={!user}
                                            className="settings-field mt-1 w-full rounded px-3 py-2.5 text-sm normal-case tracking-normal focus:border-sage/40 outline-none"
                                            placeholder={text.login.confirmNewPasswordPlaceholder}
                                        />
                                    </label>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void handleChangePassword()}
                                    disabled={isUpdatingPassword || !user}
                                    className="settings-primary-action mt-4 w-full bg-sage text-[#121212] rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isUpdatingPassword ? text.login.submitLoading : text.login.submitResetPassword}
                                </button>
                            </div>

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
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
                                    {inviteCopy.rewardSummary}
                                </p>

                                {invitedByCode ? (
                                    <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-sage/80">
                                        {settingsUiCopy.claimedCodeLabel}: {invitedByCode}
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
                                                className="settings-field flex-1 rounded px-3 py-2.5 text-sm tracking-[0.14em] focus:border-sage/40 outline-none"
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

                            <div className="settings-panel rounded-xl p-5 sm:p-6">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-2">
                                    {text.settings.accountDeletion}
                                </p>
                                <p className="text-xs text-gray-500 mb-4">{text.settings.accountDeletionDescription}</p>

                                <div className="rounded border border-white/10 bg-[#141414] px-3 py-2 mb-4">
                                    <p className="text-[9px] uppercase tracking-[0.14em] text-gray-500">
                                        {text.settings.accountDeletionMeta}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {user?.email || text.settings.unknown}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleOpenAccountDeletion}
                                    className="w-full border border-sage/30 text-sage rounded py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-sage/10 transition-colors"
                                >
                                    {text.settings.accountDeletionOpen}
                                </button>
                            </div>

                            <div className="settings-danger-panel rounded-xl p-5 sm:p-6">
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
