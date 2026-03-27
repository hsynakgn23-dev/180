export type LanguageCode = 'tr' | 'en' | 'es' | 'fr';

export type MarkCopy = {
    title: string;
    description: string;
    whisper: string;
};

export type LeagueCopy = {
    name: string;
    description: string;
};

export type UiDictionary = {
    app: {
        brandSubtitle: string;
        profileTitle: string;
        profileAria: string;
        discoverSectionTitle: string;
        discoverMoodLink: string;
        discoverDirectorLink: string;
        discoverDailyLink: string;
        loadingDailyShowcase: string;
        loadingArena: string;
        dailyUnavailable: string;
        arenaUnavailable: string;
    };
    webToApp: {
        badge: string;
        title: string;
        subtitle: string;
        openInApp: string;
        joinBeta: string;
        later: string;
    };
    landing: {
        login: string;
        refreshInfo: string;
        titleLine1: string;
        titleLine2: string;
        subtitle: string;
        start: string;
        featureDailyTitle: string;
        featureDailyText: string;
        featureCommentTitle: string;
        featureCommentText: string;
        featureProgressTitle: string;
        featureProgressText: string;
        footerManifesto: string;
        footerRules: string;
        footerContact: string;
        infoPanelClose: string;
        manifestoTitle: string;
        manifestoBody: string;
        manifestoPoints: string[];
        rulesTitle: string;
        rulesBody: string;
        rulesPoints: string[];
    };
    login: {
        modeRegister: string;
        modeLogin: string;
        modeForgotPassword: string;
        modeResetPassword: string;
        registerForm: string;
        loginForm: string;
        forgotPasswordForm: string;
        resetPasswordForm: string;
        registerInfo: string;
        loginInfo: string;
        forgotPasswordInfo: string;
        resetPasswordInfo: string;
        fullName: string;
        username: string;
        gender: string;
        birthDate: string;
        email: string;
        password: string;
        newPassword: string;
        confirmNewPassword: string;
        fullNamePlaceholder: string;
        usernamePlaceholder: string;
        emailPlaceholder: string;
        passwordPlaceholder: string;
        newPasswordPlaceholder: string;
        confirmNewPasswordPlaceholder: string;
        submitRegister: string;
        submitLogin: string;
        submitForgotPassword: string;
        submitResetPassword: string;
        submitLoading: string;
        forgotPasswordLink: string;
        backToLogin: string;
        googleContinue: string;
        googleRedirecting: string;
        localAuthInfo: string;
        loginFailed: string;
        forgotPasswordFailed: string;
        resetPasswordFailed: string;
        forgotPasswordSuccess: string;
        resetPasswordSuccess: string;
        passwordMismatch: string;
        googleFailed: string;
        or: string;
    };
    settings: {
        title: string;
        subtitle: string;
        close: string;
        tabIdentity: string;
        tabAppearance: string;
        tabSession: string;
        avatar: string;
        uploadAvatar: string;
        avatarHint: string;
        personalInfo: string;
        fullName: string;
        username: string;
        gender: string;
        birthDate: string;
        select: string;
        usernameHint: string;
        bio: string;
        bioPlaceholder: string;
        saveIdentity: string;
        theme: string;
        themeMidnight: string;
        themeDawn: string;
        language: string;
        languageTr: string;
        languageEn: string;
        activeAccount: string;
        unknown: string;
        sessionControl: string;
        logout: string;
        logoutConfirm: string;
        accountDeletion: string;
        accountDeletionDescription: string;
        accountDeletionOpen: string;
        accountDeletionMeta: string;
        statusThemeUpdated: string;
        statusLanguageSaved: string;
        statusIdentitySaveFailed: string;
        statusIdentitySaved: string;
        statusAvatarUpdated: string;
    };
    daily: {
        loading: string;
        title: string;
        subtitle: string;
        swipeHint: string;
        lockLine1: string;
        lockLine2: string;
        newSelection: string;
        scrollLeftAria: string;
        scrollRightAria: string;
    };
    movieCard: {
        searching: string;
        imageUnavailable: string;
        watched: string;
    };
    movieDetail: {
        close: string;
        directedBy: string;
        noDetails: string;
        cast: string;
        language: string;
        unknown: string;
        startComment: string;
    };
    writeOverlay: {
        title: string;
        placeholder: string;
        cancel: string;
        save: string;
    };
    arena: {
        title: string;
        subtitle: string;
        all: string;
        today: string;
        selfHandleLabel: string;
        findMyComments: string;
        searchPlaceholder: string;
        sortLatest: string;
        sortMostLiked: string;
        loading: string;
        empty: string;
        end: string;
        hotStreakBadge: string;
        feedFallback: string;
        feedLoadFailed: string;
        reactionLoadFailed: string;
        replyLoadFailed: string;
        deleteFailed: string;
    };
    ritualCard: {
        readMore: string;
        readLess: string;
        reactions: string;
        reply: string;
        delete: string;
        deleteTitle: string;
        replyPlaceholder: string;
        send: string;
        anonymous: string;
        reactionSyncFailed: string;
        replySyncFailed: string;
        rateLimitReached: string;
        replyNotification: string;
        follow: string;
        following: string;
        you: string;
        openProfile: string;
        now: string;
    };
    notifications: {
        title: string;
        panelTitle: string;
        empty: string;
    };
    profileWidget: {
        profile: string;
        openArchive: string;
        openSettings: string;
        xpToNext: string;
        streak: string;
        comments: string;
        days: string;
        marksUnlocked: string;
        observer: string;
    };
    profile: {
        backHome: string;
        openSettings: string;
        logout: string;
        upload: string;
        save: string;
        cancel: string;
        editIdentity: string;
        unnamed: string;
        missingName: string;
        missingGender: string;
        missingBirthDate: string;
        genreDistribution: string;
        stats: string;
        days: string;
        rituals: string;
        comments: string;
        films: string;
        topGenre: string;
        mostCommented: string;
        noRecords: string;
        activity: string;
        profileFeed: string;
        filmArchive: string;
        noFilmComments: string;
        noFilmCommentsHint: string;
        marksArchive: string;
        featured: string;
        markCategorySuffix: string;
        requirement: string;
        unlocked: string;
        locked: string;
        closeMovieModal: string;
        unknownGenre: string;
        commentsAndReplies: string;
        commentRecords: string;
        close: string;
        repliesLoading: string;
        replies: string;
        deleteComment: string;
        noReplies: string;
        openFilmDetails: string;
        observerHandle: string;
        curatorFallback: string;
        filmCount: string;
        commentCount: string;
        filmFallback: string;
        follow: string;
        following: string;
        followers: string;
        block: string;
        blocked: string;
        unblock: string;
        blockConfirm: string;
        blockSuccess: string;
        unblockSuccess: string;
        blockedNotice: string;
        blockedNoticeMeta: string;
        followCountsHidden: string;
        profileStatsHidden: string;
        activityHidden: string;
        archiveHidden: string;
        commentsHidden: string;
        leagueLabel: string;
        loadingProfile: string;
        profileLoadFailed: string;
        publicProfileRequiresSupabase: string;
        timeToday: string;
        timeJustNow: string;
        timeHoursAgo: string;
        timeDaysAgo: string;
    };
    xp: {
        markUnlockedFallback: string;
    };
};

export const UI_DICTIONARY: Record<LanguageCode, UiDictionary> = {
    tr: {
        app: {
            brandSubtitle: 'Absolute Cinema',
            profileTitle: 'Profil',
            profileAria: 'Profili aç',
            discoverSectionTitle: 'Editör Keşifleri',
            discoverMoodLink: 'Ruh Haline Göre En İyi Filmler',
            discoverDirectorLink: 'Yönetmen Derin İncelemeleri',
            discoverDailyLink: 'Günlük Özenli Seçimler',
            loadingDailyShowcase: 'Günlük vitrin yükleniyor...',
            loadingArena: 'Arena yükleniyor...',
            dailyUnavailable: 'Günlük liste geçici olarak kullanılamıyor. Lütfen biraz sonra yenileyin.',
            arenaUnavailable: 'Arena geçici olarak kullanılamıyor. Oturumunuz aktif kalacak.'
        },
        webToApp: {
            badge: 'Mobil Devam',
            title: 'Uygulamada devam et',
            subtitle: 'Bir sonraki ritüel akışını mobilde aç ve ritmini koru.',
            openInApp: 'Uygulamada Aç',
            joinBeta: 'Mobil Betaya Katıl',
            later: 'Sonra'
        },
        landing: {
            login: 'Giriş Yap', refreshInfo: 'Her gün 00:00 yenilenir', titleLine1: 'GÜNLÜK', titleLine2: 'SİNEMA LİSTESİ',
            subtitle: 'Her gün özenle secilen 5 filmden birine 180 karakterlik yorum yaz ve ilerlemeni sürdür', start: 'Basla',
            featureDailyTitle: 'Günlük 5 Film', featureDailyText: 'Her sabah yenilenen 5 filmlik seçim.',
            featureCommentTitle: '180 Karakter', featureCommentText: 'Kısa ve net yorum yaz.',
            featureProgressTitle: 'Seviye Sistemi', featureProgressText: 'Düzenli katılımla seviyeni arttır.',
            footerManifesto: 'Manifesto', footerRules: 'Kurallar', footerContact: 'İletişim',
            infoPanelClose: 'Kapat',
            manifestoTitle: '180 Manifestosu',
            manifestoBody: '180, sinemayi kisa ama oz bir yorum disipliniyle takip etmek icin kuruldu.',
            manifestoPoints: [
                'Her gun sinema ile bag kurmak, sureklilik yaratmak ve bakisi derinlestirmek.',
                'Az ama net yazarak dusunceyi berraklastirmak: 180 karakterlik odakli yorumlar.',
                'Rekabet yerine ritim, gosteris yerine tutarlilik ve ogrenme odakli bir topluluk.'
            ],
            rulesTitle: 'Site Ici Kurallar',
            rulesBody: 'Akisin temiz, adil ve kaliteli kalmasi icin temel kurallar:',
            rulesPoints: [
                'Saygili ol: hakaret, hedef gosteren veya asagilayici dil kullanma.',
                'Spoiler verirken acikca belirt; ana deneyimi bozacak paylasim yapma.',
                'Yorumlarin filmi merkezde tutsun; alakasiz spam ve tekrar icerik girme.',
                'Tek hesap, dogru profil: taklit veya yonlendirici sahte kimlik kullanma.',
                'Nefret soylemi, ayrimcilik, taciz ve tehdit kesinlikle yasaktir.',
                'Kurallari ihlal eden icerikler kaldirilabilir; tekrarinda hesap kisitlanabilir.'
            ]
        },
        login: {
            modeRegister: 'Yeni Üyelik', modeLogin: 'Üye Girişi', modeForgotPassword: 'Şifre Sıfırla', modeResetPassword: 'Yeni Şifre',
            registerForm: 'Kayıt Formu', loginForm: 'Giriş Formu', forgotPasswordForm: 'Şifre Sıfırlama', resetPasswordForm: 'Yeni Şifre Belirle',
            registerInfo: 'Kullanici adi, cinsiyet ve dogum tarihi profiline kaydedilir.', loginInfo: 'Mevcut hesabinla giris yap.',
            forgotPasswordInfo: 'Kayitli e-posta adresini gir, sifre yenileme baglantisi gonderelim.', resetPasswordInfo: 'Guvenli bir yeni sifre belirleyip devam et.',
            fullName: 'İsim Soyisim', username: 'Kullanıcı Adı', gender: 'Cinsiyet', birthDate: 'Doğum Tarihi',
            email: 'E-posta', password: 'Şifre', newPassword: 'Yeni Şifre', confirmNewPassword: 'Yeni Şifre Tekrar',
            fullNamePlaceholder: 'Ad Soyad', usernamePlaceholder: 'ornek_kullanici',
            emailPlaceholder: 'ornek@email.com', passwordPlaceholder: 'minimum 6 karakter',
            newPasswordPlaceholder: 'yeni sifren (minimum 6 karakter)', confirmNewPasswordPlaceholder: 'yeni sifreni tekrar yaz',
            submitRegister: 'Kayıt Ol', submitLogin: 'Giriş Yap', submitForgotPassword: 'Bağlantı Gönder', submitResetPassword: 'Şifreyi Güncelle', submitLoading: 'Bekleyin...',
            forgotPasswordLink: 'Şifremi Unuttum', backToLogin: 'Giriş Ekranına Dön',
            googleContinue: 'Google ile Devam Et', googleRedirecting: 'Yönlendiriliyor...', localAuthInfo: 'Supabase auth tanımlı değil, yerel giriş modu aktif.',
            loginFailed: 'Giriş başarısız.', forgotPasswordFailed: 'Şifre yenileme isteği başarısız.', resetPasswordFailed: 'Şifre güncellenemedi.',
            forgotPasswordSuccess: 'Şifre yenileme bağlantısı gönderildi.', resetPasswordSuccess: 'Şifre güncellendi.', passwordMismatch: 'Şifreler eşleşmiyor.',
            googleFailed: 'Google girişi başarısız.', or: 'VEYA'
        },
        settings: {
            title: 'Ayarlar', subtitle: 'Hesap ve deneyim ayarları', close: 'Kapat',
            tabIdentity: 'Kimlik', tabAppearance: 'Görünüm', tabSession: 'Oturum',
            avatar: 'Avatar', uploadAvatar: 'Avatar Yükle', avatarHint: 'Öneri: kare görüntü',
            personalInfo: 'Kişisel Bilgiler', fullName: 'İsim', username: 'Kullanıcı', gender: 'Cinsiyet', birthDate: 'Doğum',
            select: 'Seçiniz', usernameHint: 'Kullanıcı adı: 3-20 karakter, harf/rakam/_',
            bio: 'Biyografi', bioPlaceholder: 'Kısa bir profil notu yaz...', saveIdentity: 'Kimliği Kaydet',
            theme: 'Tema', themeMidnight: 'Gece', themeDawn: 'Gündüz', language: 'Dil', languageTr: 'Türkçe', languageEn: 'İngilizce',
            activeAccount: 'Aktif Hesap', unknown: 'bilinmiyor', sessionControl: 'Oturum Kontrolü', logout: 'Çıkış Yap', logoutConfirm: 'Tekrar Tıkla ve Çık',
            accountDeletion: 'Hesap Silme', accountDeletionDescription: 'Hesap silme talebini başlatmak ve saklama notlarını incelemek için yayındaki talep sayfasını aç.',
            accountDeletionOpen: 'Talep Sayfasını Aç', accountDeletionMeta: 'Talebi, hesaba bağlı e-posta ile App Store destek kanalı üzerinden gönder.',
            statusThemeUpdated: 'Tema güncellendi', statusLanguageSaved: 'Dil tercihi kaydedildi', statusIdentitySaveFailed: 'Kimlik kaydı başarısız',
            statusIdentitySaved: 'Kimlik kaydedildi', statusAvatarUpdated: 'Avatar güncellendi'
        },
        daily: { loading: 'GUNLUK LISTE YUKLENIYOR...', title: 'GUNUN FILMLERI', subtitle: 'Her gun secilen 5 film', swipeHint: 'Kartlari kaydir', lockLine1: 'Kilidi acmak icin', lockLine2: '1 yorum yap', newSelection: 'YENI SECIM', scrollLeftAria: 'Filmleri sola kaydir', scrollRightAria: 'Filmleri saga kaydir' },
        movieCard: { searching: 'Arsivde araniyor...', imageUnavailable: 'Poster yok', watched: 'Yorumlandi' },
        movieDetail: { close: 'Kapat', directedBy: 'Yonetmen', noDetails: 'Detay bulunamadi.', cast: 'Oyuncular', language: 'Dil', unknown: 'Bilinmiyor', startComment: 'Yorum Yaz' },
        writeOverlay: { title: 'Yorum', placeholder: 'Dusunceni yaz...', cancel: 'Vazgec', save: 'Kaydet' },
        arena: {
            title: 'Yorum Akisi', subtitle: 'Yorumlar film kartlari uzerinden gonderilir.', all: 'Tum', today: 'Bugun',
            selfHandleLabel: 'Senin kullanici adin: @{handle}', findMyComments: 'Yorumlarimi bul',
            searchPlaceholder: 'Yorum ara...', sortLatest: 'En Yeni', sortMostLiked: 'En Cok Tepki',
            loading: 'Genel yorum akisi yukleniyor...', empty: 'Bu filtrede yorum bulunamadi.', end: 'Yorum akisinin sonu', hotStreakBadge: 'Sicak Seri',
            feedFallback: 'Genel yorum akisi su an kullanilamiyor. Yerel akis gosteriliyor.',
            feedLoadFailed: 'Yorum akisi yuklenemiyor. Baglantiyi kontrol edip tekrar dene.',
            reactionLoadFailed: 'Tepki verileri senkronize edilemedi. Akisi yenileyip tekrar dene.',
            replyLoadFailed: 'Yanit verileri senkronize edilemedi. Akisi yenileyip tekrar dene.',
            deleteFailed: 'Yorum silinemedi. Tekrar dene.'
        },
        ritualCard: {
            readMore: 'Devamini Oku', readLess: 'Daha Az Goster', reactions: '{count} TEPKI', reply: 'YANIT ({count})',
            delete: 'SIL', deleteTitle: 'Yorumunu sil', replyPlaceholder: 'Yanit yaz...', send: 'Gonder', anonymous: 'ANONIM',
            reactionSyncFailed: 'Tepki senkronize edilemedi. Akisi yenileyip tekrar dene.',
            replySyncFailed: 'Yanit senkronize edilemedi. Akisi yenileyip tekrar dene.',
            rateLimitReached: 'Hiz limiti asildi. Biraz bekleyip tekrar dene.',
            follow: 'Takip Et', following: 'Takipte', you: 'Sen', openProfile: 'Profili ac',
            replyNotification: '{author} yorumuna yanit: "{text}"', now: 'Simdi'
        },
        notifications: { title: 'Bildirimler', panelTitle: 'Bildirim Merkezi', empty: 'Bildirim yok.' },
        profileWidget: {
            profile: 'Profil', openArchive: 'Profili Ac', openSettings: 'Ayarlari Ac', xpToNext: 'Sonraki seviye icin {xp} XP',
            streak: 'Seri', comments: 'Yorum', days: 'Gun', marksUnlocked: 'Acilan Isaretler', observer: 'Gozlemci'
        },
        profile: {
            backHome: 'Ana sayfaya don', openSettings: 'Ayarlari ac', logout: 'Cikis yap', upload: 'Yukle', save: 'Kaydet', cancel: 'Iptal',
            editIdentity: 'Profili Düzenle', unnamed: 'İSİMSİZ', missingName: 'İsim belirtilmedi', missingGender: 'Cinsiyet belirtilmedi', missingBirthDate: 'Doğum tarihi yok',
            genreDistribution: 'Tur Dagilimi', stats: 'Istatistik', days: 'Gun', rituals: 'Ritueller', comments: 'Yorumlar', films: 'Filmler', topGenre: 'En Cok Tur', mostCommented: 'En Cok Yorumlanan',
            noRecords: 'Kayit yok', activity: 'Aktivite', profileFeed: 'Profil Akisi', filmArchive: 'Film Arsivi',
            noFilmComments: 'Henuz yorumlanan film yok.', noFilmCommentsHint: 'Ilk yorumunla arsivi baslat.',
            marksArchive: 'Isaret Arsivi', featured: '{count}/3 One Cikan', markCategorySuffix: 'Isaretleri', requirement: 'Kazanim', unlocked: 'Acik', locked: 'Kilitli',
            closeMovieModal: 'Film penceresini kapat', unknownGenre: 'Tur bilinmiyor', commentsAndReplies: 'Yorumlar ve Yanitlar', commentRecords: '{count} yorum kaydi',
            close: 'Kapat', repliesLoading: 'Yanitlar yukleniyor...', replies: 'Yanitlar ({count})', deleteComment: 'Yorumu sil', noReplies: 'Bu yoruma henuz yanit yok.',
            openFilmDetails: '{title} yorum ve yanitlarini ac', observerHandle: 'gozlemci', curatorFallback: 'KURATOR', filmCount: '{count} Film', commentCount: '{count} yorum',
            filmFallback: 'Film #{id}', follow: 'Takip Et', following: 'Takipte', followers: 'Takipciler', block: 'Engelle', blocked: 'Engellendi', unblock: 'Engeli Kaldir', blockConfirm: 'Bu kullaniciyi engellemek istiyor musun?', blockSuccess: 'Kullanici engellendi.', unblockSuccess: 'Kullanici engeli kaldirildi.', blockedNotice: 'Bu kullaniciyi engelledin. Icerik gizlendi.', blockedNoticeMeta: 'Engeli kaldirmadan bu profilin yorumlarini tekrar goremezsin.', followCountsHidden: 'Takip sayilari gizli.', profileStatsHidden: 'Bu kullanici profil istatistiklerini gizliyor.', activityHidden: 'Bu kullanici aktivite ozetini gizliyor.', archiveHidden: 'Bu kullanici arsiv aktivitesini gizliyor.', commentsHidden: 'Bu kullanici yorum ve yanitlarini gizliyor.', leagueLabel: 'Lig',
            loadingProfile: 'Profil yukleniyor...', profileLoadFailed: 'Profil verisi yuklenemedi.', publicProfileRequiresSupabase: 'Genel profil Supabase gerektirir.',
            timeToday: 'Bugun', timeJustNow: 'Simdi', timeHoursAgo: '{count}s once', timeDaysAgo: '{count}g once'
        },
        xp: { markUnlockedFallback: 'Yeni isaret acildi.' }
    },
    en: {
        app: {
            brandSubtitle: 'Absolute Cinema',
            profileTitle: 'Profile',
            profileAria: 'Open profile',
            discoverSectionTitle: 'Editorial Discoveries',
            discoverMoodLink: 'Best Films by Mood',
            discoverDirectorLink: 'Director Deep Dives',
            discoverDailyLink: 'Daily Curated Picks',
            loadingDailyShowcase: 'Loading daily showcase...',
            loadingArena: 'Loading arena...',
            dailyUnavailable: 'Daily list is temporarily unavailable. Please refresh in a moment.',
            arenaUnavailable: 'Arena is temporarily unavailable. Your session is still active.'
        },
        webToApp: {
            badge: 'Mobile Prompt',
            title: 'Continue in the app',
            subtitle: 'Open your next ritual flow on mobile and keep your momentum synced.',
            openInApp: 'Open In App',
            joinBeta: 'Join Mobile Beta',
            later: 'Later'
        },
        landing: {
            login: 'Login', refreshInfo: 'Refreshes every day at 00:00', titleLine1: 'DAILY', titleLine2: 'CINEMA LIST',
            subtitle: 'Write one focused 180-character comment on one of 5 curated daily films and keep your streak moving.', start: 'Start',
            featureDailyTitle: 'Daily 5', featureDailyText: 'A fresh selection of 5 films every morning.',
            featureCommentTitle: '180 Characters', featureCommentText: 'Write short and clear comments.',
            featureProgressTitle: 'Level System', featureProgressText: 'Grow your level with consistent activity.',
            footerManifesto: 'Manifesto', footerRules: 'Rules', footerContact: 'Contact',
            infoPanelClose: 'Close',
            manifestoTitle: '180 Manifesto',
            manifestoBody: '180 is built to turn daily film watching into a focused writing ritual.',
            manifestoPoints: [
                'Build consistency by connecting with cinema every day.',
                'Think clearly in limited space with 180-character precision.',
                'Prioritize rhythm, craft, and meaningful discussion over noise.'
            ],
            rulesTitle: 'Platform Rules',
            rulesBody: 'To keep the space clean and fair, follow these rules:',
            rulesPoints: [
                'Be respectful; no harassment, insults, or targeted abuse.',
                'Mark spoilers clearly; do not ruin core viewing experiences.',
                'Keep comments film-focused; no spam or repetitive off-topic content.',
                'Use one authentic account; no impersonation or deceptive identity.',
                'Hate speech, discrimination, threats, and violent language are prohibited.',
                'Rule-breaking content may be removed; repeated abuse may trigger account restrictions.'
            ]
        },
        login: {
            modeRegister: 'New Membership', modeLogin: 'Member Login', modeForgotPassword: 'Reset Password', modeResetPassword: 'Set New Password',
            registerForm: 'Register Form', loginForm: 'Login Form', forgotPasswordForm: 'Password Reset', resetPasswordForm: 'Set New Password',
            registerInfo: 'Username, gender and birth date are saved to your profile.', loginInfo: 'Sign in with your existing account.',
            forgotPasswordInfo: 'Enter your account email and we will send a reset link.', resetPasswordInfo: 'Set a secure new password to continue.',
            fullName: 'Full Name', username: 'Username', gender: 'Gender', birthDate: 'Birth Date',
            email: 'Email', password: 'Password', newPassword: 'New Password', confirmNewPassword: 'Confirm New Password',
            fullNamePlaceholder: 'Full name', usernamePlaceholder: 'sample_user',
            emailPlaceholder: 'sample@email.com', passwordPlaceholder: 'minimum 6 characters',
            newPasswordPlaceholder: 'your new password (minimum 6 characters)', confirmNewPasswordPlaceholder: 'repeat your new password',
            submitRegister: 'Sign Up', submitLogin: 'Sign In', submitForgotPassword: 'Send Reset Link', submitResetPassword: 'Update Password', submitLoading: 'Please wait...',
            forgotPasswordLink: 'Forgot Password?', backToLogin: 'Back to Login',
            googleContinue: 'Continue with Google', googleRedirecting: 'Redirecting...', localAuthInfo: 'Supabase auth is not configured, local login mode is active.',
            loginFailed: 'Login failed.', forgotPasswordFailed: 'Password reset request failed.', resetPasswordFailed: 'Password update failed.',
            forgotPasswordSuccess: 'Password reset link sent.', resetPasswordSuccess: 'Password updated successfully.', passwordMismatch: 'Passwords do not match.',
            googleFailed: 'Google sign-in failed.', or: 'OR'
        },
        settings: {
            title: 'Settings', subtitle: 'Account and experience settings', close: 'Close',
            tabIdentity: 'Identity', tabAppearance: 'Appearance', tabSession: 'Session',
            avatar: 'Avatar', uploadAvatar: 'Upload Avatar', avatarHint: 'Recommended: square image',
            personalInfo: 'Personal Info', fullName: 'Name', username: 'Username', gender: 'Gender', birthDate: 'Birth Date',
            select: 'Select', usernameHint: 'Username: 3-20 chars, letters/numbers/_',
            bio: 'Bio', bioPlaceholder: 'Write a short profile note...', saveIdentity: 'Save Identity',
            theme: 'Theme', themeMidnight: 'Midnight', themeDawn: 'Dawn', language: 'Language', languageTr: 'Turkish', languageEn: 'English',
            activeAccount: 'Active Account', unknown: 'unknown', sessionControl: 'Session Control', logout: 'Logout', logoutConfirm: 'Click Again to Logout',
            accountDeletion: 'Account Deletion', accountDeletionDescription: 'Open the published account deletion instructions and retention notes for this product.',
            accountDeletionOpen: 'Open Deletion Page', accountDeletionMeta: 'Submit the request from the email tied to the account through the App Store support channel.',
            statusThemeUpdated: 'Theme updated', statusLanguageSaved: 'Language preference saved', statusIdentitySaveFailed: 'Identity save failed',
            statusIdentitySaved: 'Identity saved', statusAvatarUpdated: 'Avatar updated'
        },
        daily: { loading: 'LOADING DAILY LIST...', title: 'TODAYS FILMS', subtitle: '5 films selected for today', swipeHint: 'Swipe cards', lockLine1: 'To unlock', lockLine2: 'post 1 comment', newSelection: 'NEW SELECTION', scrollLeftAria: 'Scroll movies left', scrollRightAria: 'Scroll movies right' },
        movieCard: { searching: 'Searching archive...', imageUnavailable: 'Poster unavailable', watched: 'Commented' },
        movieDetail: { close: 'Close', directedBy: 'Directed by', noDetails: 'No details available.', cast: 'Cast', language: 'Language', unknown: 'Unknown', startComment: 'Write Comment' },
        writeOverlay: { title: 'Comment', placeholder: 'Write your thoughts...', cancel: 'Cancel', save: 'Save' },
        arena: {
            title: 'Comment Feed', subtitle: 'Comments are posted from film cards.', all: 'All', today: 'Today',
            selfHandleLabel: 'Your handle: @{handle}', findMyComments: 'Find my comments',
            searchPlaceholder: 'Search comments...', sortLatest: 'Latest', sortMostLiked: 'Most Liked',
            loading: 'Loading global comment feed...', empty: 'No comments found for this filter.', end: 'End of comment feed', hotStreakBadge: 'Hot Streak',
            feedFallback: 'Global comment feed is unavailable. Local feed is shown.',
            feedLoadFailed: 'Comment feed cannot be loaded. Check your connection and retry.',
            reactionLoadFailed: 'Reaction data could not be synced. Refresh and try again.',
            replyLoadFailed: 'Reply data could not be synced. Refresh and try again.',
            deleteFailed: 'Comment could not be deleted. Try again.'
        },
        ritualCard: {
            readMore: 'Read More', readLess: 'Read Less', reactions: '{count} REACTIONS', reply: 'REPLY ({count})',
            delete: 'DELETE', deleteTitle: 'Delete your comment', replyPlaceholder: 'Write a reply...', send: 'Send', anonymous: 'ANONYMOUS',
            reactionSyncFailed: 'Reaction sync failed. Refresh the feed and retry.',
            replySyncFailed: 'Reply sync failed. Refresh the feed and retry.',
            rateLimitReached: 'Rate limit reached. Please wait and try again shortly.',
            follow: 'Follow', following: 'Following', you: 'You', openProfile: 'Open profile',
            replyNotification: 'Reply sent to {author}: "{text}"', now: 'Now'
        },
        notifications: { title: 'Notifications', panelTitle: 'Notification Center', empty: 'No notifications.' },
        profileWidget: {
            profile: 'Profile', openArchive: 'Open Profile', openSettings: 'Open Settings', xpToNext: '{xp} XP to next level',
            streak: 'Streak', comments: 'Comments', days: 'Days', marksUnlocked: 'Marks unlocked', observer: 'Observer'
        },
        profile: {
            backHome: 'Back to home', openSettings: 'Open settings', logout: 'Logout', upload: 'Upload', save: 'Save', cancel: 'Cancel',
            editIdentity: 'Edit Identity', unnamed: 'UNNAMED', missingName: 'No name set', missingGender: 'No gender set', missingBirthDate: 'No birth date',
            genreDistribution: 'Genre Distribution', stats: 'Stats', days: 'Days', rituals: 'Rituals', comments: 'Comments', films: 'Films', topGenre: 'Top Genre', mostCommented: 'Most Commented',
            noRecords: 'No records', activity: 'Activity', profileFeed: 'Profile Feed', filmArchive: 'Film Archive',
            noFilmComments: 'No commented films yet.', noFilmCommentsHint: 'Start your archive with your first comment.',
            marksArchive: 'Mark Archive', featured: '{count}/3 Featured', markCategorySuffix: 'Marks', requirement: 'Requirement', unlocked: 'Unlocked', locked: 'Locked',
            closeMovieModal: 'Close film modal', unknownGenre: 'Unknown genre', commentsAndReplies: 'Comments and Replies', commentRecords: '{count} comment records',
            close: 'Close', repliesLoading: 'Loading replies...', replies: 'Replies ({count})', deleteComment: 'Delete comment', noReplies: 'No replies for this comment yet.',
            openFilmDetails: 'Open comments and replies for {title}', observerHandle: 'observer', curatorFallback: 'CURATOR', filmCount: '{count} Films', commentCount: '{count} comments',
            filmFallback: 'Film #{id}', follow: 'Follow', following: 'Following', followers: 'Followers', block: 'Block', blocked: 'Blocked', unblock: 'Unblock', blockConfirm: 'Do you want to block this user?', blockSuccess: 'User blocked.', unblockSuccess: 'User unblocked.', blockedNotice: 'You blocked this user. Content is hidden.', blockedNoticeMeta: 'You will not see this profile again until you remove the block.', followCountsHidden: 'Follow counts are hidden.', profileStatsHidden: 'This user hides profile stats.', activityHidden: 'This user hides activity stats.', archiveHidden: 'This user hides archive activity.', commentsHidden: 'This user hides comments and replies.', leagueLabel: 'League',
            loadingProfile: 'Loading profile...', profileLoadFailed: 'Profile could not be loaded.', publicProfileRequiresSupabase: 'Public profile requires Supabase.',
            timeToday: 'Today', timeJustNow: 'Just now', timeHoursAgo: '{count}h ago', timeDaysAgo: '{count}d ago'
        },
        xp: { markUnlockedFallback: 'Mark unlocked.' }
    },
    es: {} as UiDictionary,
    fr: {} as UiDictionary
};

const EN_UI_BASE = UI_DICTIONARY.en;

UI_DICTIONARY.es = {
    ...EN_UI_BASE,
    app: {
        ...EN_UI_BASE.app,
        profileTitle: 'Perfil',
        profileAria: 'Abrir perfil'
    },
    landing: {
        ...EN_UI_BASE.landing,
        login: 'Iniciar sesión',
        refreshInfo: 'Se actualiza cada dia a las 00:00',
        titleLine1: 'LISTA',
        titleLine2: 'DIARIA DE CINE',
        subtitle: '5 peliculas cada dia. Completa el dia escribiendo un comentario.',
        start: 'Empezar',
        featureDailyTitle: '5 diarias',
        featureDailyText: 'Una seleccion nueva de 5 peliculas cada manana.',
        featureCommentTitle: '180 caracteres',
        featureCommentText: 'Escribe comentarios cortos y claros.',
        featureProgressTitle: 'Sistema de nivel',
        featureProgressText: 'Sube de nivel con participacion constante.',
        footerRules: 'Reglas',
        footerContact: 'Contacto'
    },
    login: {
        ...EN_UI_BASE.login,
        modeRegister: 'Nuevo registro',
        modeLogin: 'Ingreso',
        registerForm: 'Formulario de registro',
        loginForm: 'Formulario de ingreso',
        registerInfo: 'Se guardan usuario, genero y fecha de nacimiento.',
        loginInfo: 'Inicia sesión con tu cuenta existente.',
        fullName: 'Nombre completo',
        username: 'Usuario',
        gender: 'Género',
        birthDate: 'Fecha de nacimiento',
        email: 'Correo',
        password: 'Contrasena',
        fullNamePlaceholder: 'Nombre completo',
        emailPlaceholder: 'ejemplo@email.com',
        submitRegister: 'Registrarse',
        submitLogin: 'Entrar',
        googleContinue: 'Continuar con Google',
        googleRedirecting: 'Redirigiendo...',
        loginFailed: 'Error de inicio de sesión.',
        googleFailed: 'Error con Google.'
    },
    settings: {
        ...EN_UI_BASE.settings,
        title: 'Ajustes',
        subtitle: 'Ajustes de cuenta y experiencia',
        tabIdentity: 'Identidad',
        tabAppearance: 'Apariencia',
        tabSession: 'Sesión',
        uploadAvatar: 'Subir avatar',
        avatarHint: 'Recomendado: imagen cuadrada',
        personalInfo: 'Información personal',
        fullName: 'Nombre',
        birthDate: 'Nacimiento',
        select: 'Seleccionar',
        bio: 'Biografía',
        saveIdentity: 'Guardar identidad',
        themeMidnight: 'Noche',
        themeDawn: 'Día',
        language: 'Idioma',
        activeAccount: 'Cuenta activa',
        unknown: 'desconocido',
        sessionControl: 'Control de sesión',
        logout: 'Salir',
        logoutConfirm: 'Pulsa otra vez para salir',
        statusThemeUpdated: 'Tema actualizado',
        statusLanguageSaved: 'Idioma guardado',
        statusIdentitySaveFailed: 'Error al guardar identidad',
        statusIdentitySaved: 'Identidad guardada',
        statusAvatarUpdated: 'Avatar actualizado'
    },
    daily: {
        ...EN_UI_BASE.daily,
        loading: 'CARGANDO LISTA DIARIA...',
        title: 'PELICULAS DE HOY',
        subtitle: '5 peliculas seleccionadas para hoy',
        swipeHint: 'Desliza tarjetas',
        lockLine1: 'Para desbloquear',
        lockLine2: 'escribe 1 comentario'
    },
    movieDetail: {
        ...EN_UI_BASE.movieDetail,
        directedBy: 'Dirigida por',
        noDetails: 'No hay detalles disponibles.',
        cast: 'Reparto',
        language: 'Idioma',
        startComment: 'Escribir comentario'
    },
    writeOverlay: {
        ...EN_UI_BASE.writeOverlay,
        title: 'Comentario',
        placeholder: 'Escribe tu opinion...',
        cancel: 'Cancelar',
        save: 'Guardar'
    },
    arena: {
        ...EN_UI_BASE.arena,
        title: 'Feed de comentarios',
        subtitle: 'Los comentarios se publican desde las tarjetas de pelicula.',
        all: 'Todos',
        today: 'Hoy',
        selfHandleLabel: 'Tu usuario: @{handle}',
        findMyComments: 'Buscar mis comentarios',
        searchPlaceholder: 'Buscar comentarios...',
        sortLatest: 'Mas recientes',
        sortMostLiked: 'Mas valorados',
        loading: 'Cargando feed global...',
        empty: 'No se encontraron comentarios.',
        end: 'Fin del feed',
        hotStreakBadge: 'Racha Activa'
    },
    ritualCard: {
        ...EN_UI_BASE.ritualCard,
        follow: 'Seguir',
        following: 'Siguiendo',
        you: 'Tu',
        openProfile: 'Abrir perfil'
    },
    notifications: {
        ...EN_UI_BASE.notifications,
        title: 'Notificaciones',
        panelTitle: 'Centro de notificaciones',
        empty: 'No hay notificaciones.'
    },
    profileWidget: {
        ...EN_UI_BASE.profileWidget,
        profile: 'Perfil',
        openArchive: 'Abrir perfil',
        openSettings: 'Abrir ajustes',
        streak: 'Racha',
        comments: 'Comentarios',
        days: 'Días',
        marksUnlocked: 'Marcas desbloqueadas'
    },
    profile: {
        ...EN_UI_BASE.profile,
        backHome: 'Volver al inicio',
        openSettings: 'Abrir ajustes',
        logout: 'Salir',
        upload: 'Subir',
        save: 'Guardar',
        cancel: 'Cancelar',
        editIdentity: 'Editar identidad',
        missingName: 'Nombre no definido',
        missingGender: 'Género no definido',
        missingBirthDate: 'Fecha no definida',
        genreDistribution: 'Distribución de géneros',
        stats: 'Estadísticas',
        comments: 'Comentarios',
        films: 'Peliculas',
        topGenre: 'Género principal',
        mostCommented: 'Mas comentada',
        noRecords: 'Sin registros',
        activity: 'Actividad',
        profileFeed: 'Feed del perfil',
        filmArchive: 'Archivo de peliculas',
        noFilmComments: 'Aun no hay peliculas comentadas.',
        noFilmCommentsHint: 'Empieza el archivo con tu primer comentario.',
        marksArchive: 'Archivo de marcas',
        markCategorySuffix: 'Marcas',
        requirement: 'Requisito',
        unlocked: 'Desbloqueada',
        locked: 'Bloqueada',
        closeMovieModal: 'Cerrar ventana de pelicula',
        unknownGenre: 'Género desconocido',
        commentsAndReplies: 'Comentarios y respuestas',
        commentRecords: '{count} registros de comentarios',
        close: 'Cerrar',
        repliesLoading: 'Cargando respuestas...',
        replies: 'Respuestas ({count})',
        deleteComment: 'Eliminar comentario',
        noReplies: 'Todavia no hay respuestas.',
        openFilmDetails: 'Abrir comentarios y respuestas de {title}',
        observerHandle: 'observador',
        curatorFallback: 'CURADOR',
        filmCount: '{count} peliculas',
        commentCount: '{count} comentarios',
        filmFallback: 'Pelicula #{id}',
        follow: 'Seguir',
        following: 'Siguiendo',
        followers: 'Seguidores',
        block: 'Bloquear',
        blocked: 'Bloqueado',
        unblock: 'Desbloquear',
        blockConfirm: 'Quieres bloquear a este usuario?',
        blockSuccess: 'Usuario bloqueado.',
        unblockSuccess: 'Usuario desbloqueado.',
        blockedNotice: 'Has bloqueado a este usuario. El contenido esta oculto.',
        blockedNoticeMeta: 'No volveras a ver este perfil hasta quitar el bloqueo.',
        leagueLabel: 'Liga',
        loadingProfile: 'Cargando perfil...',
        profileLoadFailed: 'No se pudo cargar el perfil.',
        publicProfileRequiresSupabase: 'El perfil publico requiere Supabase.',
        timeToday: 'Hoy',
        timeJustNow: 'Ahora',
        timeHoursAgo: 'hace {count}h',
        timeDaysAgo: 'hace {count}d'
    },
    xp: {
        ...EN_UI_BASE.xp,
        markUnlockedFallback: 'Marca desbloqueada.'
    }
};

UI_DICTIONARY.fr = {
    ...EN_UI_BASE,
    app: {
        ...EN_UI_BASE.app,
        profileTitle: 'Profil',
        profileAria: 'Ouvrir le profil'
    },
    landing: {
        ...EN_UI_BASE.landing,
        login: 'Connexion',
        refreshInfo: 'Actualise chaque jour a 00:00',
        titleLine1: 'LISTE',
        titleLine2: 'CINEMA DU JOUR',
        subtitle: '5 films par jour. Termine la journee avec un commentaire.',
        start: 'Commencer',
        featureDailyTitle: '5 films quotidiens',
        featureDailyText: 'Une selection fraiche de 5 films chaque matin.',
        featureCommentTitle: '180 caracteres',
        featureCommentText: 'Ecris des commentaires courts et clairs.',
        featureProgressTitle: 'Systeme de niveau',
        featureProgressText: 'Progresse avec une participation reguliere.',
        footerRules: 'Regles',
        footerContact: 'Contact'
    },
    login: {
        ...EN_UI_BASE.login,
        modeRegister: 'Nouvelle inscription',
        modeLogin: 'Connexion membre',
        registerForm: 'Formulaire d inscription',
        loginForm: 'Formulaire de connexion',
        registerInfo: 'Nom, genre et date de naissance sont enregistres.',
        loginInfo: 'Connecte-toi avec ton compte existant.',
        fullName: 'Nom complet',
        username: 'Pseudo',
        gender: 'Genre',
        birthDate: 'Date de naissance',
        email: 'E-mail',
        password: 'Mot de passe',
        fullNamePlaceholder: 'Nom complet',
        emailPlaceholder: 'exemple@email.com',
        submitRegister: 'S inscrire',
        submitLogin: 'Se connecter',
        googleContinue: 'Continuer avec Google',
        googleRedirecting: 'Redirection...',
        loginFailed: 'Echec de connexion.',
        googleFailed: 'Echec Google.'
    },
    settings: {
        ...EN_UI_BASE.settings,
        title: 'Paramètres',
        subtitle: 'Paramètres du compte et de l’expérience',
        tabIdentity: 'Identité',
        tabAppearance: 'Apparence',
        tabSession: 'Session',
        uploadAvatar: 'Téléverser un avatar',
        avatarHint: 'Recommandé: image carrée',
        personalInfo: 'Informations personnelles',
        fullName: 'Nom',
        birthDate: 'Naissance',
        select: 'Sélectionner',
        bio: 'Bio',
        saveIdentity: 'Enregistrer l’identité',
        themeMidnight: 'Nuit',
        themeDawn: 'Jour',
        language: 'Langue',
        activeAccount: 'Compte actif',
        unknown: 'inconnu',
        sessionControl: 'Contrôle de session',
        logout: 'Déconnexion',
        logoutConfirm: 'Clique encore pour confirmer',
        statusThemeUpdated: 'Thème mis à jour',
        statusLanguageSaved: 'Langue enregistrée',
        statusIdentitySaveFailed: 'Échec d’enregistrement',
        statusIdentitySaved: 'Identité enregistrée',
        statusAvatarUpdated: 'Avatar mis à jour'
    },
    daily: {
        ...EN_UI_BASE.daily,
        loading: 'CHARGEMENT DE LA LISTE...',
        title: 'FILMS DU JOUR',
        subtitle: '5 films selectionnes pour aujourd hui',
        swipeHint: 'Fais glisser les cartes',
        lockLine1: 'Pour debloquer',
        lockLine2: 'publie 1 commentaire'
    },
    movieDetail: {
        ...EN_UI_BASE.movieDetail,
        directedBy: 'Realise par',
        noDetails: 'Aucun detail disponible.',
        cast: 'Distribution',
        language: 'Langue',
        startComment: 'Ecrire un commentaire'
    },
    writeOverlay: {
        ...EN_UI_BASE.writeOverlay,
        title: 'Commentaire',
        placeholder: 'Ecris ton avis...',
        cancel: 'Annuler',
        save: 'Enregistrer'
    },
    arena: {
        ...EN_UI_BASE.arena,
        title: 'Flux des commentaires',
        subtitle: 'Les commentaires viennent des cartes film.',
        all: 'Tous',
        today: 'Aujourd hui',
        selfHandleLabel: 'Ton identifiant: @{handle}',
        findMyComments: 'Trouver mes commentaires',
        searchPlaceholder: 'Rechercher des commentaires...',
        sortLatest: 'Plus recents',
        sortMostLiked: 'Plus aimes',
        loading: 'Chargement du flux global...',
        empty: 'Aucun commentaire trouve.',
        end: 'Fin du flux',
        hotStreakBadge: 'Série Active'
    },
    ritualCard: {
        ...EN_UI_BASE.ritualCard,
        follow: 'Suivre',
        following: 'Abonne',
        you: 'Toi',
        openProfile: 'Ouvrir le profil'
    },
    notifications: {
        ...EN_UI_BASE.notifications,
        title: 'Notifications',
        panelTitle: 'Centre de notifications',
        empty: 'Aucune notification.'
    },
    profileWidget: {
        ...EN_UI_BASE.profileWidget,
        profile: 'Profil',
        openArchive: 'Ouvrir le profil',
        openSettings: 'Ouvrir les paramètres',
        streak: 'Série',
        comments: 'Commentaires',
        days: 'Jours',
        marksUnlocked: 'Marques débloquées'
    },
    profile: {
        ...EN_UI_BASE.profile,
        backHome: 'Retour à l’accueil',
        openSettings: 'Ouvrir les paramètres',
        logout: 'Se déconnecter',
        upload: 'Téléverser',
        save: 'Enregistrer',
        cancel: 'Annuler',
        editIdentity: 'Modifier l’identité',
        missingName: 'Nom non défini',
        missingGender: 'Genre non défini',
        missingBirthDate: 'Date non définie',
        genreDistribution: 'Distribution des genres',
        stats: 'Statistiques',
        comments: 'Commentaires',
        films: 'Films',
        topGenre: 'Genre principal',
        mostCommented: 'Le plus commenté',
        noRecords: 'Aucun enregistrement',
        activity: 'Activité',
        profileFeed: 'Flux du profil',
        filmArchive: 'Archive des films',
        noFilmComments: 'Aucun film commenté pour l’instant.',
        noFilmCommentsHint: 'Commence avec ton premier commentaire.',
        marksArchive: 'Archive des marques',
        markCategorySuffix: 'Marques',
        requirement: 'Condition',
        unlocked: 'Débloquée',
        locked: 'Verrouillée',
        closeMovieModal: 'Fermer la fenêtre film',
        unknownGenre: 'Genre inconnu',
        commentsAndReplies: 'Commentaires et reponses',
        commentRecords: '{count} enregistrements de commentaires',
        close: 'Fermer',
        repliesLoading: 'Chargement des reponses...',
        replies: 'Reponses ({count})',
        deleteComment: 'Supprimer le commentaire',
        noReplies: 'Pas encore de reponse.',
        openFilmDetails: 'Ouvrir commentaires et reponses pour {title}',
        observerHandle: 'observateur',
        curatorFallback: 'CURATEUR',
        filmCount: '{count} films',
        commentCount: '{count} commentaires',
        filmFallback: 'Film #{id}',
        follow: 'Suivre',
        following: 'Abonne',
        followers: 'Abonnes',
        block: 'Bloquer',
        blocked: 'Bloque',
        unblock: 'Debloquer',
        blockConfirm: 'Voulez-vous bloquer cet utilisateur ?',
        blockSuccess: 'Utilisateur bloque.',
        unblockSuccess: 'Utilisateur debloque.',
        blockedNotice: 'Vous avez bloque cet utilisateur. Le contenu est masque.',
        blockedNoticeMeta: 'Vous ne reverrez pas ce profil avant de lever le blocage.',
        leagueLabel: 'Ligue',
        loadingProfile: 'Chargement du profil...',
        profileLoadFailed: 'Le profil n a pas pu etre charge.',
        publicProfileRequiresSupabase: 'Le profil public necessite Supabase.',
        timeToday: 'Aujourd hui',
        timeJustNow: 'A l instant',
        timeHoursAgo: 'il y a {count}h',
        timeDaysAgo: 'il y a {count}j'
    },
    xp: {
        ...EN_UI_BASE.xp,
        markUnlockedFallback: 'Marque debloquee.'
    }
};

UI_DICTIONARY.tr.webToApp.subtitle = 'Bir sonraki yorum akisini mobilde ac ve ritmini koru.';
UI_DICTIONARY.tr.profile.rituals = 'Yorumlar';
UI_DICTIONARY.en.webToApp.subtitle = 'Open your next comment flow on mobile and keep your momentum synced.';
UI_DICTIONARY.en.landing.manifestoBody = '180 is built to turn daily film watching into a focused comment practice.';
UI_DICTIONARY.en.profile.rituals = 'Comments';
UI_DICTIONARY.es.webToApp.subtitle = 'Open your next comment flow on mobile and keep your momentum synced.';
UI_DICTIONARY.es.profile.rituals = 'Comentarios';
UI_DICTIONARY.fr.webToApp.subtitle = 'Open your next comment flow on mobile and keep your momentum synced.';
UI_DICTIONARY.fr.profile.rituals = 'Commentaires';

export const MARK_DICTIONARY: Record<LanguageCode, Record<string, MarkCopy>> = {
    tr: {
        first_mark: { title: 'Ilk Isaret', description: 'Ilk rituelini tamamla.', whisper: 'Baslangic yapildi.' },
        daybreaker: { title: 'Gun Acan', description: '14 aktif gun boyunca varlik goster.', whisper: 'Her gun geri geldin.' },

        '180_exact': { title: 'Mimar', description: 'Tam 180 karakter yaz.', whisper: 'Kusursuz cerceve.' },
        precision_loop: { title: 'Hassas Dongu', description: 'Tam 180 karakteri 3 kez yaz.', whisper: 'Hassasiyet tekrarlandi.' },
        minimalist: { title: 'Minimalist', description: '40 karakterden kisa bir rituel yaz.', whisper: 'Az soz.' },
        deep_diver: { title: 'Derin Dalgic', description: 'Uzun bir rituel gonder (160+ karakter).', whisper: 'Derinlere indin.' },

        no_rush: { title: 'Acelesiz', description: 'Ardisik olmadan 10 rituel tamamla.', whisper: 'Tempon sana ait.' },
        daily_regular: { title: 'Duzenli', description: '3 gunluk seri koru.', whisper: 'Sabit bir ritim.' },
        seven_quiet_days: { title: 'Sessizlik Koruyucusu', description: '7 gunluk seri koru.', whisper: 'Yedi gunluk sessizlik.' },
        ritual_marathon: { title: 'Maraton', description: '20 rituel gonder.', whisper: 'Momentum korundu.' },

        wide_lens: { title: 'Genis Aci', description: '10 benzersiz turde yorum yap.', whisper: 'Daha genis bir bakis.' },
        hidden_gem: { title: 'Gizli Cevher', description: 'Dusuk puanli bir filme yorum yap (<= 7.9).', whisper: 'Ozel bir yorunge.' },
        genre_discovery: { title: 'Spektrum', description: '3 benzersiz turde yorum yap.', whisper: 'Spektrum acildi.' },
        one_genre_devotion: { title: 'Adanmis', description: 'Tek bir turde 20 rituel yaz.', whisper: 'Tek odak.' },
        classic_soul: { title: 'Klasik Ruh', description: '1990 oncesi bir film izle.', whisper: 'Gecmisten bir yanki.' },
        genre_nomad: { title: 'Tur Gocebesi', description: 'Art arda 5 farkli turde 5 rituel yaz.', whisper: 'Sabit yorunge yok.' },

        watched_on_time: { title: 'Safak Izleyicisi', description: '05:00-07:00 arasinda rituel gonder.', whisper: 'Tam zamaninda.' },
        held_for_five: { title: 'Koruyucu', description: '5 gunluk aktif seri koru.', whisper: 'Seriyi tuttun.' },
        mystery_solver: { title: 'Gizem Cozucu', description: 'Gizem slotunu ac.', whisper: 'Bilinmeyen aciga cikti.' },
        midnight_ritual: { title: 'Gece Yarisi', description: '00:00-01:00 arasinda rituel gonder.', whisper: 'Gecenin saati.' },

        first_echo: { title: 'Ilk Eko', description: 'Ilk eko tepkini al.', whisper: 'Biri seni duydu.' },
        echo_receiver: { title: 'Eko Alici', description: 'Ilk eko tepkini al.', whisper: 'Duyuluyorsun.' },
        echo_initiate: { title: 'Eko Baslangici', description: '1 eko ver.', whisper: 'Kucuk bir sinyal.' },
        influencer: { title: 'Etki Yaratan', description: '5 eko al.', whisper: 'Daha genis bir frekans.' },
        resonator: { title: 'Rezonans', description: '5 eko al.', whisper: 'Rezonans kuruldu.' },
        quiet_following: { title: 'Sessiz Takip', description: '5 kullaniciyi takip et.', whisper: 'Kucuk bir yorunge.' },
        echo_chamber: { title: 'Eko Odasi', description: '10 eko ver.', whisper: 'Sinyal surduruldu.' },

        eternal_mark: { title: 'Eternal', description: 'Eternal ligine ulas.', whisper: 'Hala buradasin.' },
        legacy: { title: 'Sutun', description: '30+ gun aktif kal.', whisper: 'Zamanda bir sutun.' },
        archive_keeper: { title: 'Arsiv Bekcisi', description: '50 rituel gonder.', whisper: 'Arsiv hatirlar.' },

        first_answer: { title: 'Ilk Cevap', description: 'Ilk havuz sorusunu cevapla.', whisper: 'Bir bilgi kivilcimi.' },
        quiz_curious: { title: 'Merakli Zihin', description: '25 havuz sorusu cevapla.', whisper: 'Sorular bilgelik dogurir.' },
        quiz_scholar: { title: 'Bilgin', description: '100 havuz sorusu cevapla.', whisper: 'Arsiv derinlesiyor.' },
        quiz_master: { title: 'Quiz Ustasi', description: '500 havuz sorusunu dogru cevapla.', whisper: 'Ustalik kazanildi.' },
        perfect_film: { title: 'Kusursuz Hafiza', description: 'Tek bir filmde 5 soruyu dogru cevapla.', whisper: 'Tam hatırlama.' },
        perfect_streak: { title: 'Kusursuz Seri', description: 'Art arda 3 filmde 5/5 dogru yap.', whisper: 'Hassasiyet surduruldu.' },
        rush_survivor: { title: 'Rush Hayatta Kalan', description: 'Bir Rush 10 oturumunu tamamla.', whisper: 'Rushtan sag ciktin.' },
        rush_ace: { title: 'Rush Asi', description: 'Rush 10da 7+ dogru yap.', whisper: 'Baski altinda berraklik.' },
        rush_legend: { title: 'Rush Efsanesi', description: 'Rush 20de 14+ dogru yap.', whisper: 'Ateste dovulmus efsane.' },
        rush_endless_10: { title: 'Durdurulamaz', description: 'Sinirsiz modda 10 dogru cevaba ulas.', whisper: 'Son gorunmede degil.' },
        swipe_explorer: { title: 'Film Kasifi', description: '20 filme saga kaydir.', whisper: 'Hep arayan.' },
        genre_brain: { title: 'Tur Beyni', description: '5 farkli turde dogru cevap ver.', whisper: 'Sinir tanimayan zihin.' }
    },
    en: {
        first_mark: { title: 'First Mark', description: 'Complete your first ritual.', whisper: 'It begins.' },
        daybreaker: { title: 'Daybreaker', description: 'Be present for 14 active days.', whisper: 'You kept showing up.' },

        '180_exact': { title: 'The Architect', description: 'Write exactly 180 characters.', whisper: 'Perfectly framed.' },
        precision_loop: { title: 'Precision Loop', description: 'Write exactly 180 characters 3 times.', whisper: 'Precision repeated.' },
        minimalist: { title: 'Minimalist', description: 'Write a ritual with < 40 characters.', whisper: 'Less said.' },
        deep_diver: { title: 'Deep Diver', description: 'Submit a long-form ritual (160+ chars).', whisper: 'The depths explored.' },

        no_rush: { title: 'No Rush', description: 'Complete 10 rituals, none consecutive.', whisper: 'Your pace is yours.' },
        daily_regular: { title: 'Regular', description: 'Maintain a 3-day streak.', whisper: 'A steady pulse.' },
        seven_quiet_days: { title: 'Silence Keeper', description: 'Maintain a 7-day streak.', whisper: 'Seven days of silence.' },
        ritual_marathon: { title: 'Marathon', description: 'Submit 20 rituals.', whisper: 'Momentum held.' },

        wide_lens: { title: 'Wide Lens', description: 'Review 10 unique genres.', whisper: 'A wider lens.' },
        hidden_gem: { title: 'Hidden Gem', description: 'Review a lower-rated title (<= 7.9).', whisper: 'A private orbit.' },
        genre_discovery: { title: 'Spectrum', description: 'Review 3 unique genres.', whisper: 'A spectrum revealed.' },
        one_genre_devotion: { title: 'Devotee', description: '20 rituals in one genre.', whisper: 'A singular focus.' },
        classic_soul: { title: 'Classic Soul', description: 'Watch a movie from before 1990.', whisper: 'An echo from the past.' },
        genre_nomad: { title: 'Genre Nomad', description: 'Write 5 rituals in 5 different genres in a row.', whisper: 'No fixed orbit.' },

        watched_on_time: { title: 'Dawn Watcher', description: 'Submit a ritual between 05:00 and 07:00.', whisper: 'Right on time.' },
        held_for_five: { title: 'The Keeper', description: '5-day active streak.', whisper: 'You held it.' },
        mystery_solver: { title: 'Mystery Solver', description: 'Unlock the Mystery Slot.', whisper: 'The unknown revealed.' },
        midnight_ritual: { title: 'Midnight', description: 'Ritual between 00:00-01:00.', whisper: 'The witching hour.' },

        first_echo: { title: 'First Echo', description: 'Receive your first Echo.', whisper: 'Someone heard you.' },
        echo_receiver: { title: 'Echo Receiver', description: 'Receive your first Echo.', whisper: 'You are heard.' },
        echo_initiate: { title: 'Echo Initiate', description: 'Give 1 Echo.', whisper: 'A small signal.' },
        influencer: { title: 'Influencer', description: 'Receive 5 Echoes.', whisper: 'A wider frequency.' },
        resonator: { title: 'Resonator', description: 'Receive 5 Echoes.', whisper: 'Resonance established.' },
        quiet_following: { title: 'Quiet Following', description: 'Follow 5 users.', whisper: 'A small orbit.' },
        echo_chamber: { title: 'Echo Chamber', description: 'Give 10 Echoes.', whisper: 'Signal sustained.' },

        eternal_mark: { title: 'Eternal', description: 'Reach the Eternal League.', whisper: 'Still here.' },
        legacy: { title: 'The Pillar', description: 'Active for 30+ days.', whisper: 'A pillar in time.' },
        archive_keeper: { title: 'Archive Keeper', description: 'Submit 50 rituals.', whisper: 'The archive remembers.' },

        first_answer: { title: 'First Answer', description: 'Answer your first pool question.', whisper: 'A spark of knowing.' },
        quiz_curious: { title: 'Curious Mind', description: 'Answer 25 pool questions.', whisper: 'Questions breed wisdom.' },
        quiz_scholar: { title: 'Scholar', description: 'Answer 100 pool questions.', whisper: 'The archive deepens.' },
        quiz_master: { title: 'Quiz Master', description: 'Answer 500 pool questions correctly.', whisper: 'Mastery earned.' },
        perfect_film: { title: 'Perfect Recall', description: 'Get all 5 questions right on a single film.', whisper: 'Total recall.' },
        perfect_streak: { title: 'Flawless Run', description: 'Get all 5 right on 3 films in a row.', whisper: 'Precision sustained.' },
        rush_survivor: { title: 'Rush Survivor', description: 'Complete a Rush 10 session.', whisper: 'You survived the rush.' },
        rush_ace: { title: 'Rush Ace', description: 'Score 7+ correct in Rush 10.', whisper: 'Under pressure, clarity.' },
        rush_legend: { title: 'Rush Legend', description: 'Score 14+ correct in Rush 20.', whisper: 'Legend forged in fire.' },
        rush_endless_10: { title: 'Unstoppable', description: 'Reach 10 correct in Endless mode.', whisper: 'No end in sight.' },
        swipe_explorer: { title: 'Film Explorer', description: 'Swipe right on 20 films.', whisper: 'Always seeking.' },
        genre_brain: { title: 'Genre Brain', description: 'Answer correctly across 5 different genres.', whisper: 'A mind without borders.' }
    },
    es: {},
    fr: {}
};

const cloneMarkSection = (section: Record<string, MarkCopy>): Record<string, MarkCopy> =>
    Object.fromEntries(
        Object.entries(section).map(([id, value]) => [id, { ...value }])
    ) as Record<string, MarkCopy>;

MARK_DICTIONARY.es = cloneMarkSection(MARK_DICTIONARY.en);
MARK_DICTIONARY.fr = cloneMarkSection(MARK_DICTIONARY.en);

MARK_DICTIONARY.tr.first_mark.description = 'Ilk yorumunu tamamla.';
MARK_DICTIONARY.tr.minimalist.description = '40 karakterden kisa bir yorum yaz.';
MARK_DICTIONARY.tr.deep_diver.description = 'Uzun bir yorum gonder (160+ karakter).';
MARK_DICTIONARY.tr.no_rush.description = 'Ardisik olmadan 10 yorum tamamla.';
MARK_DICTIONARY.tr.ritual_marathon.description = '20 yorum gonder.';
MARK_DICTIONARY.tr.one_genre_devotion.description = 'Tek bir turde 20 yorum yaz.';
MARK_DICTIONARY.tr.genre_nomad.description = 'Art arda 5 farkli turde 5 yorum yaz.';
MARK_DICTIONARY.tr.watched_on_time.description = '05:00-07:00 arasinda yorum gonder.';
MARK_DICTIONARY.tr.midnight_ritual.description = '00:00-01:00 arasinda yorum gonder.';
MARK_DICTIONARY.tr.archive_keeper.description = '50 yorum gonder.';

MARK_DICTIONARY.en.first_mark.description = 'Complete your first comment.';
MARK_DICTIONARY.en.minimalist.description = 'Write a comment with < 40 characters.';
MARK_DICTIONARY.en.deep_diver.description = 'Submit a long-form comment (160+ chars).';
MARK_DICTIONARY.en.no_rush.description = 'Complete 10 comments, none consecutive.';
MARK_DICTIONARY.en.ritual_marathon.description = 'Submit 20 comments.';
MARK_DICTIONARY.en.one_genre_devotion.description = '20 comments in one genre.';
MARK_DICTIONARY.en.genre_nomad.description = 'Write 5 comments in 5 different genres in a row.';
MARK_DICTIONARY.en.watched_on_time.description = 'Submit a comment between 05:00 and 07:00.';
MARK_DICTIONARY.en.midnight_ritual.description = 'Comment between 00:00-01:00.';
MARK_DICTIONARY.en.archive_keeper.description = 'Submit 50 comments.';
MARK_DICTIONARY.es = cloneMarkSection(MARK_DICTIONARY.en);
MARK_DICTIONARY.fr = cloneMarkSection(MARK_DICTIONARY.en);

export const MARK_CATEGORY_DICTIONARY: Record<LanguageCode, Record<string, string>> = {
    tr: { Presence: 'Katilim', Writing: 'Yazim', Rhythm: 'Ritim', Discovery: 'Kesif', Ritual: 'Yorum', Social: 'Sosyal', Legacy: 'Miras', Knowledge: 'Bilgi' },
    en: { Presence: 'Presence', Writing: 'Writing', Rhythm: 'Rhythm', Discovery: 'Discovery', Ritual: 'Comment', Social: 'Social', Legacy: 'Legacy', Knowledge: 'Knowledge' },
    es: { Presence: 'Presencia', Writing: 'Escritura', Rhythm: 'Ritmo', Discovery: 'Descubrimiento', Ritual: 'Comentario', Social: 'Social', Legacy: 'Legado', Knowledge: 'Conocimiento' },
    fr: { Presence: 'Presence', Writing: 'Ecriture', Rhythm: 'Rythme', Discovery: 'Decouverte', Ritual: 'Commentaire', Social: 'Social', Legacy: 'Heritage', Knowledge: 'Connaissance' }
};

export const LEAGUE_DICTIONARY: Record<LanguageCode, Record<string, LeagueCopy>> = {
    tr: {
        Bronze: { name: 'Figuran', description: 'Baslangic seviyesi.' }, Silver: { name: 'Izleyici', description: 'Duzenli katilim basladi.' },
        Gold: { name: 'Yorumcu', description: 'Yorumlarin daha net.' }, Platinum: { name: 'Elestirmen', description: 'Analiz seviyesi artti.' },
        Emerald: { name: 'Uzman', description: 'Secimlerin tutarli.' }, Sapphire: { name: 'Sinefil', description: 'Sinemaya baglilik yuksek.' },
        Ruby: { name: 'Vizyoner', description: 'Icerik kalitesi yuksek.' }, Diamond: { name: 'Yonetmen', description: 'Ust seviye katilim.' },
        Master: { name: 'Auteur', description: 'Kendi tarzini kurdun.' }, Grandmaster: { name: 'Efsane', description: 'Uzun sureli basari.' },
        Absolute: { name: 'Absolute', description: 'Sinirin ustu seviye.' }, Eternal: { name: 'Eternal', description: 'En ust lig.' }
    },
    en: {
        Bronze: { name: 'Bronze', description: 'Entry level.' }, Silver: { name: 'Silver', description: 'Consistent activity starts.' },
        Gold: { name: 'Gold', description: 'Comment quality improves.' }, Platinum: { name: 'Platinum', description: 'Analysis depth increases.' },
        Emerald: { name: 'Emerald', description: 'Taste is more refined.' }, Sapphire: { name: 'Sapphire', description: 'Strong cinema commitment.' },
        Ruby: { name: 'Ruby', description: 'High quality progression.' }, Diamond: { name: 'Diamond', description: 'Top-tier consistency.' },
        Master: { name: 'Master', description: 'Personal style established.' }, Grandmaster: { name: 'Grandmaster', description: 'Long-term high performance.' },
        Absolute: { name: 'Absolute', description: 'Beyond standard tiers.' }, Eternal: { name: 'Eternal', description: 'Top league.' }
    },
    es: {
        Bronze: { name: 'Bronce', description: 'Nivel inicial.' }, Silver: { name: 'Plata', description: 'Empieza la constancia.' },
        Gold: { name: 'Oro', description: 'Mejora la calidad de comentarios.' }, Platinum: { name: 'Platino', description: 'Aumenta la profundidad de analisis.' },
        Emerald: { name: 'Esmeralda', description: 'El gusto se vuelve mas refinado.' }, Sapphire: { name: 'Zafiro', description: 'Fuerte compromiso con el cine.' },
        Ruby: { name: 'Rubi', description: 'Progreso de alta calidad.' }, Diamond: { name: 'Diamante', description: 'Constancia de alto nivel.' },
        Master: { name: 'Maestro', description: 'Estilo personal establecido.' }, Grandmaster: { name: 'Gran maestro', description: 'Alto rendimiento sostenido.' },
        Absolute: { name: 'Absolute', description: 'Mas alla de niveles estandar.' }, Eternal: { name: 'Eternal', description: 'Liga maxima.' }
    },
    fr: {
        Bronze: { name: 'Bronze', description: 'Niveau d entree.' }, Silver: { name: 'Argent', description: 'La regularite commence.' },
        Gold: { name: 'Or', description: 'La qualite des commentaires progresse.' }, Platinum: { name: 'Platine', description: 'L analyse devient plus profonde.' },
        Emerald: { name: 'Emeraude', description: 'Le gout devient plus raffine.' }, Sapphire: { name: 'Saphir', description: 'Fort engagement cinephile.' },
        Ruby: { name: 'Rubis', description: 'Progression de haute qualite.' }, Diamond: { name: 'Diamant', description: 'Regularite de haut niveau.' },
        Master: { name: 'Maitre', description: 'Style personnel etabli.' }, Grandmaster: { name: 'Grand maitre', description: 'Haute performance durable.' },
        Absolute: { name: 'Absolute', description: 'Au-dela des paliers standards.' }, Eternal: { name: 'Eternal', description: 'Ligue maximale.' }
    }
};
