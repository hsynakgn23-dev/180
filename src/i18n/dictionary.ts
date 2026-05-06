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
            badge: 'Mobilde devam et',
            title: 'Uygulamada devam et',
            subtitle: 'Bir sonraki yorum akışını mobilde aç ve ritmini senkronize tut.',
            openInApp: 'Uygulamada aç',
            joinBeta: 'Mobil betaya katıl',
            later: 'Sonra'
        },
        landing: {
            login: 'Giriş Yap', refreshInfo: "Her gün 00:00'da yenilenir", titleLine1: 'GÜNLÜK', titleLine2: 'SİNEMA LİSTESİ',
            subtitle: 'Her gün özenle seçilen 5 filmden birine 180 karakterlik bir yorum yaz ve serini sürdür.', start: 'Başla',
            featureDailyTitle: 'Günlük 5 Film', featureDailyText: 'Her sabah yenilenen 5 filmlik seçim.',
            featureCommentTitle: '180 Karakter', featureCommentText: 'Kısa ve net yorumlar yaz.',
            featureProgressTitle: 'Seviye Sistemi', featureProgressText: 'Düzenli katılımla seviyeni yükselt.',
            footerManifesto: 'Manifesto', footerRules: 'Kurallar', footerContact: 'İletişim',
            infoPanelClose: 'Kapat',
            manifestoTitle: '180 Manifestosu',
            manifestoBody: '180, sinemayı kısa ama öz bir yorum disipliniyle takip etmek için kuruldu.',
            manifestoPoints: [
                'Her gün sinema ile bağ kurmak, süreklilik yaratmak ve bakışı derinleştirmek.',
                'Az ama net yazarak düşünceyi berraklaştırmak: 180 karakterlik odaklı yorumlar.',
                'Rekabet yerine ritim, gösteriş yerine tutarlılık ve öğrenme odaklı bir topluluk.'
            ],
            rulesTitle: 'Platform Kuralları',
            rulesBody: 'Akışın temiz, adil ve kaliteli kalması için temel kurallar:',
            rulesPoints: [
                'Saygılı ol: hakaret, hedef gösteren veya aşağılayıcı dil kullanma.',
                'Spoiler verirken açıkça belirt; ana deneyimi bozacak paylaşım yapma.',
                'Yorumların filmi merkezde tutsun; alakasız spam ve tekrar içerik girme.',
                'Tek hesap, doğru profil: taklit veya yönlendirici sahte kimlik kullanma.',
                'Nefret söylemi, ayrımcılık, taciz ve tehdit kesinlikle yasaktır.',
                'Kuralları ihlal eden içerikler kaldırılabilir; tekrarında hesap kısıtlanabilir.'
            ]
        },
        login: {
            modeRegister: 'Hesap Oluştur', modeLogin: 'Giriş Yap', modeForgotPassword: 'Şifre Sıfırla', modeResetPassword: 'Yeni Şifre',
            registerForm: 'Kayıt Formu', loginForm: 'Giriş Formu', forgotPasswordForm: 'Şifre Sıfırlama', resetPasswordForm: 'Yeni Şifre Belirle',
            registerInfo: 'Kullanıcı adı, cinsiyet ve doğum tarihi profiline kaydedilir.', loginInfo: 'Mevcut hesabınla giriş yap.',
            forgotPasswordInfo: 'Kayıtlı e-posta adresini gir, şifre yenileme bağlantısı gönderelim.', resetPasswordInfo: 'Güvenli bir yeni şifre belirleyip devam et.',
            fullName: 'İsim Soyisim', username: 'Kullanıcı Adı', gender: 'Cinsiyet', birthDate: 'Doğum Tarihi',
            email: 'E-posta', password: 'Şifre', newPassword: 'Yeni Şifre', confirmNewPassword: 'Yeni Şifre Tekrar',
            fullNamePlaceholder: 'Ad Soyad', usernamePlaceholder: 'ornek_kullanici',
            emailPlaceholder: 'ornek@email.com', passwordPlaceholder: 'minimum 6 karakter',
            newPasswordPlaceholder: 'yeni şifren (minimum 6 karakter)', confirmNewPasswordPlaceholder: 'yeni şifreni tekrar yaz',
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
            select: 'Seç', usernameHint: 'Kullanıcı adı: 3-20 karakter, harf/rakam/_',
            bio: 'Biyografi', bioPlaceholder: 'Kısa bir profil notu yaz...', saveIdentity: 'Kimliği Kaydet',
            theme: 'Tema', themeMidnight: 'Gece', themeDawn: 'Gündüz', language: 'Dil', languageTr: 'Türkçe', languageEn: 'İngilizce',
            activeAccount: 'Aktif Hesap', unknown: 'bilinmiyor', sessionControl: 'Oturum Kontrolü', logout: 'Çıkış Yap', logoutConfirm: 'Çıkmak için tekrar dokun',
            accountDeletion: 'Hesap Silme', accountDeletionDescription: 'Hesap silme talebini başlatmak ve saklama notlarını görmek için yayındaki talep sayfasını aç.',
            accountDeletionOpen: 'Talep sayfasını aç', accountDeletionMeta: 'Talebi, hesaba bağlı e-posta ile App Store destek kanalı üzerinden gönder.',
            statusThemeUpdated: 'Tema güncellendi', statusLanguageSaved: 'Dil tercihi kaydedildi', statusIdentitySaveFailed: 'Kimlik kaydı başarısız',
            statusIdentitySaved: 'Kimlik kaydedildi', statusAvatarUpdated: 'Avatar güncellendi'
        },
        daily: { loading: 'GÜNLÜK LİSTE YÜKLENİYOR...', title: 'GÜNÜN FİLMLERİ', subtitle: 'Her gün seçilen 5 film', swipeHint: 'Kartları kaydır', lockLine1: 'Kilidi açmak için', lockLine2: '1 yorum yap', newSelection: 'YENİ SEÇİM', scrollLeftAria: 'Filmleri sola kaydır', scrollRightAria: 'Filmleri sağa kaydır' },
        movieCard: { searching: 'Arşivde aranıyor...', imageUnavailable: 'Poster yok', watched: 'Yorumlandı' },
        movieDetail: { close: 'Kapat', directedBy: 'Yönetmen', noDetails: 'Detay bulunamadı.', cast: 'Oyuncular', language: 'Dil', unknown: 'Bilinmiyor', startComment: 'Yorum Yaz' },
        writeOverlay: { title: 'Yorum', placeholder: 'Düşünceni yaz...', cancel: 'Vazgeç', save: 'Kaydet' },
        arena: {
            title: 'Yorum Akışı', subtitle: 'Yorumlar film kartları üzerinden gönderilir.', all: 'Tüm', today: 'Bugün',
            selfHandleLabel: 'Kullanıcı adın: @{handle}', findMyComments: 'Yorumlarımı bul',
            searchPlaceholder: 'Yorum ara...', sortLatest: 'En Yeni', sortMostLiked: 'En Çok Tepki Alan',
            loading: 'Genel yorum akışı yükleniyor...', empty: 'Bu filtrede yorum bulunamadı.', end: 'Yorum akışının sonu', hotStreakBadge: 'Sıcak Seri',
            feedFallback: 'Genel yorum akışı şu an kullanılamıyor. Yerel akış gösteriliyor.',
            feedLoadFailed: 'Yorum akışı yüklenemiyor. Bağlantıyı kontrol edip tekrar dene.',
            reactionLoadFailed: 'Tepki verileri senkronize edilemedi. Akışı yenileyip tekrar dene.',
            replyLoadFailed: 'Yanıt verileri senkronize edilemedi. Akışı yenileyip tekrar dene.',
            deleteFailed: 'Yorum silinemedi. Tekrar dene.'
        },
        ritualCard: {
            readMore: 'Devamını oku', readLess: 'Daha az göster', reactions: '{count} TEPKİ', reply: 'YANIT ({count})',
            delete: 'SİL', deleteTitle: 'Yorumunu sil', replyPlaceholder: 'Yanıt yaz...', send: 'Gönder', anonymous: 'ANONİM',
            reactionSyncFailed: 'Tepki senkronize edilemedi. Akışı yenileyip tekrar dene.',
            replySyncFailed: 'Yanıt senkronize edilemedi. Akışı yenileyip tekrar dene.',
            rateLimitReached: 'Hız limiti aşıldı. Biraz bekleyip tekrar dene.',
            follow: 'Takip Et', following: 'Takipte', you: 'Sen', openProfile: 'Profili aç',
            replyNotification: '{author} yorumuna yanıt: "{text}"', now: 'Şimdi'
        },
        notifications: { title: 'Bildirimler', panelTitle: 'Bildirim Merkezi', empty: 'Bildirim yok.' },
        profileWidget: {
            profile: 'Profil', openArchive: 'Profili aç', openSettings: 'Ayarları aç', xpToNext: 'Sonraki seviye için {xp} XP',
            streak: 'Seri', comments: 'Yorum', days: 'Gün', marksUnlocked: 'Açılan Marklar', observer: 'Gözlemci'
        },
        profile: {
            backHome: 'Ana sayfaya dön', openSettings: 'Ayarları aç', logout: 'Çıkış yap', upload: 'Yükle', save: 'Kaydet', cancel: 'İptal',
            editIdentity: 'Kimliği düzenle', unnamed: 'İSİMSİZ', missingName: 'İsim belirtilmedi', missingGender: 'Cinsiyet belirtilmedi', missingBirthDate: 'Doğum tarihi yok',
            genreDistribution: 'Tür Dağılımı', stats: 'İstatistik', days: 'Gün', rituals: 'Yorumlar', comments: 'Yorumlar', films: 'Filmler', topGenre: 'En Çok Tür', mostCommented: 'En Çok Yorumlanan',
            noRecords: 'Kayıt yok', activity: 'Etkinlik', profileFeed: 'Profil Akışı', filmArchive: 'Film Arşivi',
            noFilmComments: 'Henüz yorumlanan film yok.', noFilmCommentsHint: 'İlk yorumunla arşivi başlat.',
            marksArchive: 'Mark Arşivi', featured: '{count}/3 Öne Çıkan', markCategorySuffix: 'Markları', requirement: 'Koşul', unlocked: 'Açıldı', locked: 'Kilitli',
            closeMovieModal: 'Film penceresini kapat', unknownGenre: 'Tür bilinmiyor', commentsAndReplies: 'Yorumlar ve Yanıtlar', commentRecords: '{count} yorum kaydı',
            close: 'Kapat', repliesLoading: 'Yanıtlar yükleniyor...', replies: 'Yanıtlar ({count})', deleteComment: 'Yorumu sil', noReplies: 'Bu yoruma henüz yanıt yok.',
            openFilmDetails: '{title} yorum ve yanıtlarını aç', observerHandle: 'gözlemci', curatorFallback: 'KÜRATÖR', filmCount: '{count} Film', commentCount: '{count} yorum',
            filmFallback: 'Film #{id}', follow: 'Takip Et', following: 'Takipte', followers: 'Takipçiler', block: 'Engelle', blocked: 'Engellendi', unblock: 'Engeli kaldır', blockConfirm: 'Bu kullanıcıyı engellemek istiyor musun?', blockSuccess: 'Kullanıcı engellendi.', unblockSuccess: 'Kullanıcının engeli kaldırıldı.', blockedNotice: 'Bu kullanıcıyı engelledin. İçerik gizlendi.', blockedNoticeMeta: 'Engeli kaldırmadan bu profili tekrar göremezsin.', followCountsHidden: 'Takip sayıları gizli.', profileStatsHidden: 'Bu kullanıcı profil istatistiklerini gizliyor.', activityHidden: 'Bu kullanıcı etkinlik özetini gizliyor.', archiveHidden: 'Bu kullanıcı arşiv etkinliğini gizliyor.', commentsHidden: 'Bu kullanıcı yorum ve yanıtlarını gizliyor.', leagueLabel: 'Lig',
            loadingProfile: 'Profil yükleniyor...', profileLoadFailed: 'Profil verisi yüklenemedi.', publicProfileRequiresSupabase: 'Genel profil Supabase gerektirir.',
            timeToday: 'Bugün', timeJustNow: 'Şimdi', timeHoursAgo: '{count}s önce', timeDaysAgo: '{count}g önce'
        },
        xp: { markUnlockedFallback: 'Yeni Mark açıldı.' }
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
            badge: 'Continue on Mobile',
            title: 'Continue in the app',
            subtitle: 'Open your next comment flow on mobile and keep your momentum in sync.',
            openInApp: 'Open in App',
            joinBeta: 'Join the Mobile Beta',
            later: 'Later'
        },
        landing: {
            login: 'Sign In', refreshInfo: 'Refreshes every day at 00:00', titleLine1: 'DAILY', titleLine2: 'CINEMA LIST',
            subtitle: 'Write one focused 180-character comment on 1 of 5 curated daily films and keep your streak moving.', start: 'Get Started',
            featureDailyTitle: 'Daily 5', featureDailyText: 'A fresh selection of 5 films every morning.',
            featureCommentTitle: '180 Characters', featureCommentText: 'Write short and clear comments.',
            featureProgressTitle: 'Level System', featureProgressText: 'Grow your level with consistent activity.',
            footerManifesto: 'Manifesto', footerRules: 'Rules', footerContact: 'Contact',
            infoPanelClose: 'Close',
            manifestoTitle: '180 Manifesto',
            manifestoBody: '180 is built to turn daily film watching into a focused comment practice.',
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
            modeRegister: 'Create Account', modeLogin: 'Sign In', modeForgotPassword: 'Reset Password', modeResetPassword: 'Set New Password',
            registerForm: 'Sign-up Form', loginForm: 'Sign-in Form', forgotPasswordForm: 'Password Reset', resetPasswordForm: 'Set New Password',
            registerInfo: 'Username, gender and birth date are saved to your profile.', loginInfo: 'Sign in with your existing account.',
            forgotPasswordInfo: 'Enter your account email and we will send a reset link.', resetPasswordInfo: 'Set a secure new password to continue.',
            fullName: 'Full Name', username: 'Username', gender: 'Gender', birthDate: 'Birth Date',
            email: 'Email', password: 'Password', newPassword: 'New Password', confirmNewPassword: 'Confirm New Password',
            fullNamePlaceholder: 'Full name', usernamePlaceholder: 'sample_user',
            emailPlaceholder: 'sample@email.com', passwordPlaceholder: 'minimum 6 characters',
            newPasswordPlaceholder: 'your new password (minimum 6 characters)', confirmNewPasswordPlaceholder: 'repeat your new password',
            submitRegister: 'Create Account', submitLogin: 'Sign In', submitForgotPassword: 'Send Reset Link', submitResetPassword: 'Update Password', submitLoading: 'Please wait...',
            forgotPasswordLink: 'Forgot Password?', backToLogin: 'Back to Login',
            googleContinue: 'Continue with Google', googleRedirecting: 'Redirecting...', localAuthInfo: 'Supabase auth is not configured, local login mode is active.',
            loginFailed: 'Login failed.', forgotPasswordFailed: 'Password reset request failed.', resetPasswordFailed: 'Password update failed.',
            forgotPasswordSuccess: 'Password reset link sent.', resetPasswordSuccess: 'Password updated successfully.', passwordMismatch: 'Passwords do not match.',
            googleFailed: 'Google sign-in failed.', or: 'OR'
        },
        settings: {
            title: 'Settings', subtitle: 'Account and app settings', close: 'Close',
            tabIdentity: 'Identity', tabAppearance: 'Appearance', tabSession: 'Session',
            avatar: 'Avatar', uploadAvatar: 'Upload Avatar', avatarHint: 'Recommended: square image',
            personalInfo: 'Personal Information', fullName: 'Name', username: 'Username', gender: 'Gender', birthDate: 'Birth Date',
            select: 'Select', usernameHint: 'Username: 3-20 chars, letters/numbers/_',
            bio: 'About', bioPlaceholder: 'Write a short profile note...', saveIdentity: 'Save Identity',
            theme: 'Theme', themeMidnight: 'Midnight', themeDawn: 'Dawn', language: 'Language', languageTr: 'Turkish', languageEn: 'English',
            activeAccount: 'Active Account', unknown: 'unknown', sessionControl: 'Session Control', logout: 'Logout', logoutConfirm: 'Tap again to log out',
            accountDeletion: 'Account Deletion', accountDeletionDescription: 'Open the published account deletion instructions and retention notes for this product.',
            accountDeletionOpen: 'Open Deletion Page', accountDeletionMeta: 'Submit the request from the email tied to the account through the App Store support channel.',
            statusThemeUpdated: 'Theme updated', statusLanguageSaved: 'Language preference saved', statusIdentitySaveFailed: 'Identity save failed',
            statusIdentitySaved: 'Identity saved', statusAvatarUpdated: 'Avatar updated'
        },
        daily: { loading: 'LOADING DAILY LIST...', title: "TODAY'S FILMS", subtitle: '5 films selected for today', swipeHint: 'Swipe cards', lockLine1: 'To unlock', lockLine2: 'post 1 comment', newSelection: 'NEW SELECTION', scrollLeftAria: 'Scroll movies left', scrollRightAria: 'Scroll movies right' },
        movieCard: { searching: 'Searching archive...', imageUnavailable: 'Poster unavailable', watched: 'Commented' },
        movieDetail: { close: 'Close', directedBy: 'Directed by', noDetails: 'No details available.', cast: 'Cast', language: 'Language', unknown: 'Unknown', startComment: 'Write Comment' },
        writeOverlay: { title: 'Comment', placeholder: 'Write your thoughts...', cancel: 'Cancel', save: 'Save' },
        arena: {
            title: 'Comment Feed', subtitle: 'Comments are posted from film cards.', all: 'All', today: 'Today',
            selfHandleLabel: 'Your handle: @{handle}', findMyComments: 'Find my comments',
            searchPlaceholder: 'Search comments...', sortLatest: 'Latest', sortMostLiked: 'Top Reactions',
            loading: 'Loading global comment feed...', empty: 'No comments found for this filter.', end: 'End of feed', hotStreakBadge: 'Hot Streak',
            feedFallback: 'Global comment feed is unavailable. Local feed is shown.',
            feedLoadFailed: 'Comment feed cannot be loaded. Check your connection and retry.',
            reactionLoadFailed: 'Reaction data could not be synced. Refresh and try again.',
            replyLoadFailed: 'Reply data could not be synced. Refresh and try again.',
            deleteFailed: 'Comment could not be deleted. Try again.'
        },
        ritualCard: {
            readMore: 'Read more', readLess: 'Read less', reactions: '{count} REACTIONS', reply: 'REPLY ({count})',
            delete: 'DELETE', deleteTitle: 'Delete your comment', replyPlaceholder: 'Write a reply...', send: 'Send', anonymous: 'ANONYMOUS',
            reactionSyncFailed: 'Reaction sync failed. Refresh the feed and retry.',
            replySyncFailed: 'Reply sync failed. Refresh the feed and retry.',
            rateLimitReached: 'Rate limit reached. Please wait and try again shortly.',
            follow: 'Follow', following: 'Following', you: 'You', openProfile: 'Open profile',
            replyNotification: 'Reply sent to {author}: "{text}"', now: 'Now'
        },
        notifications: { title: 'Notifications', panelTitle: 'Notification Center', empty: 'No notifications.' },
        profileWidget: {
            profile: 'Profile', openArchive: 'Open profile', openSettings: 'Open settings', xpToNext: '{xp} XP to next level',
            streak: 'Streak', comments: 'Comments', days: 'Days', marksUnlocked: 'Unlocked marks', observer: 'Observer'
        },
        profile: {
            backHome: 'Back to home', openSettings: 'Open settings', logout: 'Logout', upload: 'Upload', save: 'Save', cancel: 'Cancel',
            editIdentity: 'Edit identity', unnamed: 'UNNAMED', missingName: 'No name set', missingGender: 'No gender set', missingBirthDate: 'No birth date',
            genreDistribution: 'Genre Distribution', stats: 'Stats', days: 'Days', rituals: 'Comments', comments: 'Comments', films: 'Films', topGenre: 'Top Genre', mostCommented: 'Most Commented',
            noRecords: 'No records yet', activity: 'Activity', profileFeed: 'Profile feed', filmArchive: 'Film archive',
            noFilmComments: 'No commented films yet.', noFilmCommentsHint: 'Start your archive with your first comment.',
            marksArchive: 'Mark archive', featured: '{count}/3 featured', markCategorySuffix: 'Marks', requirement: 'Requirement', unlocked: 'Unlocked', locked: 'Locked',
            closeMovieModal: 'Close film panel', unknownGenre: 'Unknown genre', commentsAndReplies: 'Comments and Replies', commentRecords: '{count} comment entries',
            close: 'Close', repliesLoading: 'Loading replies...', replies: 'Replies ({count})', deleteComment: 'Delete comment', noReplies: 'No replies for this comment yet.',
            openFilmDetails: 'Open comments and replies for {title}', observerHandle: 'observer', curatorFallback: 'CURATOR', filmCount: '{count} films', commentCount: '{count} comments',
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
        brandSubtitle: 'Absolute Cinema',
        profileTitle: 'Perfil',
        profileAria: 'Abrir perfil',
        discoverSectionTitle: 'Descubrimientos editoriales',
        discoverMoodLink: 'Mejores películas por estado de ánimo',
        discoverDirectorLink: 'Explorar directores',
        discoverDailyLink: 'Selecciones diarias',
        loadingDailyShowcase: 'Cargando selección diaria...',
        loadingArena: 'Cargando arena...',
        dailyUnavailable: 'La lista diaria no está disponible por ahora. Actualice en un momento.',
        arenaUnavailable: 'La arena no está disponible por ahora. Su sesión sigue activa.'
    },
    webToApp: {
        ...EN_UI_BASE.webToApp,
        badge: 'Seguir en móvil',
        title: 'Continuar en la app',
        subtitle: 'Abre tu próximo flujo de comentarios en móvil y mantén tu ritmo sincronizado.',
        openInApp: 'Abrir en la app',
        joinBeta: 'Unirse a la beta móvil',
        later: 'Más tarde'
    },
    landing: {
        ...EN_UI_BASE.landing,
        login: 'Iniciar sesión',
        refreshInfo: 'Se actualiza cada día a las 00:00',
        titleLine1: 'LISTA',
        titleLine2: 'DIARIA DE CINE',
        subtitle: 'Escribe un comentario enfocado de 180 caracteres sobre 1 de 5 películas diarias y mantén tu racha en marcha.',
        start: 'Empezar',
        featureDailyTitle: '5 diarias',
        featureDailyText: 'Una nueva selección de 5 películas cada mañana.',
        featureCommentTitle: '180 caracteres',
        featureCommentText: 'Comentarios cortos y claros.',
        featureProgressTitle: 'Sistema de niveles',
        featureProgressText: 'Suba de nivel con actividad constante.',
        footerManifesto: 'Manifiesto',
        footerRules: 'Reglas',
        footerContact: 'Contacto',
        infoPanelClose: 'Cerrar',
        manifestoTitle: 'Manifiesto 180',
        manifestoBody: '180 está hecho para convertir el visionado diario en una práctica de comentario enfocada.',
        manifestoPoints: [
            'Construye constancia conectando con el cine cada día.',
            'Piensa con claridad en poco espacio y con precisión de 180 caracteres.',
            'Prioriza el ritmo, el oficio y la conversación valiosa por encima del ruido.'
        ],
        rulesTitle: 'Reglas de la plataforma',
        rulesBody: 'Para mantener este espacio limpio y justo, sigue estas reglas:',
        rulesPoints: [
            'Sé respetuoso; no se permite acoso, insultos ni abuso dirigido.',
            'Marca los spoilers con claridad; no arruines experiencias clave de visionado.',
            'Mantén los comentarios centrados en la película; sin spam ni contenido repetitivo fuera de tema.',
            'Usa una sola cuenta auténtica; sin suplantación ni identidad engañosa.',
            'Se prohíben el discurso de odio, la discriminación, las amenazas y el lenguaje violento.',
            'El contenido que infrinja las reglas puede eliminarse; los abusos repetidos pueden generar restricciones.'
        ]
    },
    login: {
        ...EN_UI_BASE.login,
        modeRegister: 'Crear cuenta',
        modeLogin: 'Iniciar sesión',
        modeForgotPassword: 'Restablecer contraseña',
        modeResetPassword: 'Crear nueva contraseña',
        registerForm: 'Formulario de registro',
        loginForm: 'Formulario de acceso',
        forgotPasswordForm: 'Restablecer contraseña',
        resetPasswordForm: 'Crear nueva contraseña',
        registerInfo: 'Tu usuario, género y fecha de nacimiento se guardarán en tu perfil.',
        loginInfo: 'Inicia sesión con tu cuenta existente.',
        forgotPasswordInfo: 'Ingresa el correo de tu cuenta y te enviaremos un enlace de restablecimiento.',
        resetPasswordInfo: 'Define una nueva contraseña segura para continuar.',
        fullName: 'Nombre completo',
        username: 'Usuario',
        gender: 'Género',
        birthDate: 'Fecha de nacimiento',
        email: 'Correo electrónico',
        password: 'Contraseña',
        newPassword: 'Nueva contraseña',
        confirmNewPassword: 'Confirmar nueva contraseña',
        fullNamePlaceholder: 'Nombre completo',
        usernamePlaceholder: 'usuario_ejemplo',
        emailPlaceholder: 'ejemplo@email.com',
        passwordPlaceholder: 'mínimo 6 caracteres',
        newPasswordPlaceholder: 'tu nueva contraseña (mínimo 6 caracteres)',
        confirmNewPasswordPlaceholder: 'repite tu nueva contraseña',
        submitRegister: 'Registrarse',
        submitLogin: 'Iniciar sesión',
        submitForgotPassword: 'Enviar enlace',
        submitResetPassword: 'Actualizar contraseña',
        submitLoading: 'Espere...',
        forgotPasswordLink: '¿Olvidaste tu contraseña?',
        backToLogin: 'Volver al acceso',
        googleContinue: 'Continuar con Google',
        googleRedirecting: 'Redirigiendo...',
        localAuthInfo: 'La autenticación de Supabase no está configurada; el acceso local está activo.',
        loginFailed: 'No se pudo iniciar sesión.',
        forgotPasswordFailed: 'No se pudo solicitar el restablecimiento.',
        resetPasswordFailed: 'No se pudo actualizar la contraseña.',
        forgotPasswordSuccess: 'Se envió el enlace de restablecimiento.',
        resetPasswordSuccess: 'La contraseña se actualizó correctamente.',
        passwordMismatch: 'Las contraseñas no coinciden.',
        googleFailed: 'Falló el acceso con Google.',
        or: 'O'
    },
    settings: {
        ...EN_UI_BASE.settings,
        title: 'Ajustes',
        subtitle: 'Ajustes de cuenta y experiencia',
        close: 'Cerrar',
        tabIdentity: 'Identidad',
        tabAppearance: 'Apariencia',
        tabSession: 'Sesión',
        avatar: 'Avatar',
        uploadAvatar: 'Subir avatar',
        avatarHint: 'Recomendado: imagen cuadrada',
        personalInfo: 'Información personal',
        fullName: 'Nombre',
        username: 'Usuario',
        gender: 'Género',
        birthDate: 'Fecha de nacimiento',
        select: 'Seleccionar',
        usernameHint: 'Usuario: 3-20 caracteres, letras/números/_',
        bio: 'Biografía',
        bioPlaceholder: 'Escribe una nota breve para tu perfil...',
        saveIdentity: 'Guardar identidad',
        theme: 'Tema',
        themeMidnight: 'Noche',
        themeDawn: 'Día',
        language: 'Idioma',
        languageTr: 'Turco',
        languageEn: 'Inglés',
        activeAccount: 'Cuenta activa',
        unknown: 'desconocido',
        sessionControl: 'Control de sesión',
        logout: 'Cerrar sesión',
        logoutConfirm: 'Pulsa otra vez para cerrar sesión',
        accountDeletion: 'Eliminación de cuenta',
        accountDeletionDescription: 'Abre las instrucciones públicas de eliminación y retención de esta app.',
        accountDeletionOpen: 'Abrir página de eliminación',
        accountDeletionMeta: 'Envía la solicitud desde el correo vinculado a tu cuenta mediante el soporte de App Store.',
        statusThemeUpdated: 'Tema actualizado',
        statusLanguageSaved: 'Idioma guardado',
        statusIdentitySaveFailed: 'No se pudo guardar la identidad.',
        statusIdentitySaved: 'Identidad guardada',
        statusAvatarUpdated: 'Avatar actualizado'
    },
    daily: {
        ...EN_UI_BASE.daily,
        loading: 'CARGANDO LISTA DIARIA...',
        title: 'PELÍCULAS DE HOY',
        subtitle: '5 películas seleccionadas para hoy',
        swipeHint: 'Deslizar tarjetas',
        lockLine1: 'Para desbloquear',
        lockLine2: 'publica 1 comentario',
        newSelection: 'NUEVA SELECCIÓN',
        scrollLeftAria: 'Desplazar películas a la izquierda',
        scrollRightAria: 'Desplazar películas a la derecha'
    },
    movieCard: {
        ...EN_UI_BASE.movieCard,
        searching: 'Buscando en el archivo...',
        imageUnavailable: 'Póster no disponible',
        watched: 'Comentada'
    },
    movieDetail: {
        ...EN_UI_BASE.movieDetail,
        close: 'Cerrar',
        directedBy: 'Dirigida por',
        noDetails: 'No hay detalles disponibles.',
        cast: 'Reparto',
        language: 'Idioma',
        unknown: 'Desconocido',
        startComment: 'Escribir comentario'
    },
    writeOverlay: {
        ...EN_UI_BASE.writeOverlay,
        title: 'Comentario',
        placeholder: 'Escribe tu opinión...',
        cancel: 'Cancelar',
        save: 'Guardar'
    },
    arena: {
        ...EN_UI_BASE.arena,
        title: 'Flujo de comentarios',
        subtitle: 'Los comentarios se publican desde las tarjetas de películas.',
        all: 'Todo',
        today: 'Hoy',
        selfHandleLabel: 'Tu usuario: @{handle}',
        findMyComments: 'Buscar mis comentarios',
        searchPlaceholder: 'Buscar comentarios...',
        sortLatest: 'Más recientes',
        sortMostLiked: 'Más valorados',
        loading: 'Cargando el flujo global de comentarios...',
        empty: 'No se encontraron comentarios para este filtro.',
        end: 'Fin del flujo de comentarios',
        hotStreakBadge: 'Racha activa',
        feedFallback: 'El flujo global de comentarios no está disponible. Se muestra el flujo local.',
        feedLoadFailed: 'No se pudo cargar el flujo de comentarios. Revisa tu conexión e inténtalo de nuevo.',
        reactionLoadFailed: 'No se pudieron sincronizar las reacciones. Actualiza e inténtalo de nuevo.',
        replyLoadFailed: 'No se pudieron sincronizar las respuestas. Actualiza e inténtalo de nuevo.',
        deleteFailed: 'No se pudo eliminar el comentario. Inténtalo de nuevo.'
    },
    ritualCard: {
        ...EN_UI_BASE.ritualCard,
        readMore: 'Leer más',
        readLess: 'Leer menos',
        reactions: '{count} REACCIONES',
        reply: 'RESPONDER ({count})',
        delete: 'ELIMINAR',
        deleteTitle: 'Eliminar tu comentario',
        replyPlaceholder: 'Escribe una respuesta...',
        send: 'Enviar',
        anonymous: 'ANÓNIMO',
        reactionSyncFailed: 'No se pudieron sincronizar las reacciones. Actualiza el flujo e inténtalo de nuevo.',
        replySyncFailed: 'No se pudieron sincronizar las respuestas. Actualiza el flujo e inténtalo de nuevo.',
        rateLimitReached: 'Se alcanzó el límite. Espera un momento e inténtalo de nuevo.',
        follow: 'Seguir',
        following: 'Siguiendo',
        you: 'Tú',
        openProfile: 'Abrir perfil',
        replyNotification: 'Respuesta enviada a {author}: "{text}"',
        now: 'Ahora'
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
        xpToNext: '{xp} XP para el siguiente nivel',
        streak: 'Racha',
        comments: 'Comentarios',
        days: 'Días',
        marksUnlocked: 'Marks desbloqueados',
        observer: 'Observador'
    },
    profile: {
        ...EN_UI_BASE.profile,
        backHome: 'Volver al inicio',
        openSettings: 'Abrir ajustes',
        logout: 'Cerrar sesión',
        upload: 'Subir',
        save: 'Guardar',
        cancel: 'Cancelar',
        editIdentity: 'Editar identidad',
        unnamed: 'SIN NOMBRE',
        missingName: 'Sin nombre',
        missingGender: 'Sin género',
        missingBirthDate: 'Sin fecha de nacimiento',
        genreDistribution: 'Distribución de géneros',
        stats: 'Estadísticas',
        days: 'Días',
        rituals: 'Comentarios',
        comments: 'Comentarios',
        films: 'Películas',
        topGenre: 'Género principal',
        mostCommented: 'Más comentada',
        noRecords: 'Sin registros',
        activity: 'Actividad',
        profileFeed: 'Flujo del perfil',
        filmArchive: 'Archivo de películas',
        noFilmComments: 'Aún no hay películas comentadas.',
        noFilmCommentsHint: 'Empieza tu archivo con tu primer comentario.',
        marksArchive: 'Archivo de Marks',
        featured: '{count}/3 destacados',
        markCategorySuffix: 'Marks',
        requirement: 'Requisito',
        unlocked: 'Desbloqueada',
        locked: 'Bloqueada',
        closeMovieModal: 'Cerrar ventana de la película',
        unknownGenre: 'Género desconocido',
        commentsAndReplies: 'Comentarios y respuestas',
        commentRecords: '{count} registros de comentarios',
        close: 'Cerrar',
        repliesLoading: 'Cargando respuestas...',
        replies: 'Respuestas ({count})',
        deleteComment: 'Eliminar comentario',
        noReplies: 'Aún no hay respuestas para este comentario.',
        openFilmDetails: 'Abrir comentarios y respuestas de {title}',
        observerHandle: 'observador',
        curatorFallback: 'CURADOR',
        filmCount: '{count} películas',
        commentCount: '{count} comentarios',
        filmFallback: 'Película #{id}',
        follow: 'Seguir',
        following: 'Siguiendo',
        followers: 'Seguidores',
        block: 'Bloquear',
        blocked: 'Bloqueado',
        unblock: 'Desbloquear',
        blockConfirm: '¿Quieres bloquear a este usuario?',
        blockSuccess: 'Usuario bloqueado.',
        unblockSuccess: 'Usuario desbloqueado.',
        blockedNotice: 'Has bloqueado a este usuario. El contenido está oculto.',
        blockedNoticeMeta: 'No volverás a ver este perfil hasta quitar el bloqueo.',
        followCountsHidden: 'Los conteos de seguimiento están ocultos.',
        profileStatsHidden: 'Este usuario oculta las estadísticas del perfil.',
        activityHidden: 'Este usuario oculta la actividad.',
        archiveHidden: 'Este usuario oculta la actividad del archivo.',
        commentsHidden: 'Este usuario oculta comentarios y respuestas.',
        leagueLabel: 'Liga',
        loadingProfile: 'Cargando perfil...',
        profileLoadFailed: 'No se pudo cargar el perfil.',
        publicProfileRequiresSupabase: 'El perfil público requiere Supabase.',
        timeToday: 'Hoy',
        timeJustNow: 'Ahora',
        timeHoursAgo: 'hace {count} h',
        timeDaysAgo: 'hace {count} d'
    },
    xp: {
        ...EN_UI_BASE.xp,
        markUnlockedFallback: 'Mark desbloqueado.'
    }
};

UI_DICTIONARY.fr = {
    ...EN_UI_BASE,
    app: {
        ...EN_UI_BASE.app,
        brandSubtitle: 'Absolute Cinema',
        profileTitle: 'Profil',
        profileAria: 'Ouvrir le profil',
        discoverSectionTitle: 'Découvertes éditoriales',
        discoverMoodLink: 'Meilleurs films par humeur',
        discoverDirectorLink: 'Explorer les réalisateurs',
        discoverDailyLink: 'Sélections du jour',
        loadingDailyShowcase: 'Chargement de la sélection du jour...',
        loadingArena: "Chargement de l'arène...",
        dailyUnavailable: 'La liste du jour est temporairement indisponible. Actualisez dans un instant.',
        arenaUnavailable: "L'arène est temporairement indisponible. Votre session reste active."
    },
    webToApp: {
        ...EN_UI_BASE.webToApp,
        badge: 'Continuer sur mobile',
        title: "Continuer dans l'app",
        subtitle: 'Ouvrez votre prochain fil de commentaires sur mobile et gardez votre rythme synchronisé.',
        openInApp: "Ouvrir dans l'app",
        joinBeta: 'Rejoindre la bêta mobile',
        later: 'Plus tard'
    },
    landing: {
        ...EN_UI_BASE.landing,
        login: 'Se connecter',
        refreshInfo: 'Actualisé chaque jour à 00:00',
        titleLine1: 'LISTE',
        titleLine2: 'CINÉMA DU JOUR',
        subtitle: 'Rédigez un commentaire ciblé de 180 caractères sur 1 des 5 films du jour et gardez votre série en mouvement.',
        start: 'Commencer',
        featureDailyTitle: '5 quotidiens',
        featureDailyText: 'Une nouvelle sélection de 5 films chaque matin.',
        featureCommentTitle: '180 caractères',
        featureCommentText: 'Commentaires courts et clairs.',
        featureProgressTitle: 'Système de niveaux',
        featureProgressText: 'Progressez avec une activité régulière.',
        footerManifesto: 'Manifeste',
        footerRules: 'Règles',
        footerContact: 'Contact',
        infoPanelClose: 'Fermer',
        manifestoTitle: 'Manifeste 180',
        manifestoBody: '180 est conçu pour transformer le visionnage quotidien en une pratique de commentaire ciblée.',
        manifestoPoints: [
            'Construisez une régularité en vous reliant au cinéma chaque jour.',
            'Pensez avec clarté dans un espace limité grâce à la précision des 180 caractères.',
            'Privilégiez le rythme, le geste critique et les échanges utiles plutôt que le bruit.'
        ],
        rulesTitle: 'Règles de la plateforme',
        rulesBody: 'Pour garder cet espace propre et équitable, veuillez suivre ces règles :',
        rulesPoints: [
            'Restez respectueux ; aucun harcèlement, aucune insulte ni attaque ciblée.',
            "Signalez clairement les spoilers ; ne gâchez pas l'expérience essentielle de visionnage.",
            'Gardez les commentaires centrés sur les films ; pas de spam ni de hors-sujet répétitif.',
            'Utilisez un seul compte authentique ; aucune usurpation ni identité trompeuse.',
            'Les discours haineux, la discrimination, les menaces et le langage violent sont interdits.',
            'Les contenus contraires aux règles peuvent être retirés ; les abus répétés peuvent entraîner des restrictions.'
        ]
    },
    login: {
        ...EN_UI_BASE.login,
        modeRegister: 'Créer un compte',
        modeLogin: 'Se connecter',
        modeForgotPassword: 'Réinitialiser le mot de passe',
        modeResetPassword: 'Définir un nouveau mot de passe',
        registerForm: "Formulaire d'inscription",
        loginForm: 'Formulaire de connexion',
        forgotPasswordForm: 'Réinitialisation du mot de passe',
        resetPasswordForm: 'Définir un nouveau mot de passe',
        registerInfo: 'Votre pseudo, votre genre et votre date de naissance sont enregistrés sur votre profil.',
        loginInfo: 'Connectez-vous avec votre compte existant.',
        forgotPasswordInfo: "Saisissez l'e-mail de votre compte et nous vous enverrons un lien de réinitialisation.",
        resetPasswordInfo: 'Définissez un nouveau mot de passe sécurisé pour continuer.',
        fullName: 'Nom complet',
        username: 'Pseudo',
        gender: 'Genre',
        birthDate: 'Date de naissance',
        email: 'E-mail',
        password: 'Mot de passe',
        newPassword: 'Nouveau mot de passe',
        confirmNewPassword: 'Confirmer le nouveau mot de passe',
        fullNamePlaceholder: 'Nom complet',
        usernamePlaceholder: 'pseudo_exemple',
        emailPlaceholder: 'exemple@email.com',
        passwordPlaceholder: '6 caractères minimum',
        newPasswordPlaceholder: 'votre nouveau mot de passe (6 caractères minimum)',
        confirmNewPasswordPlaceholder: 'répétez votre nouveau mot de passe',
        submitRegister: "S'inscrire",
        submitLogin: 'Se connecter',
        submitForgotPassword: 'Envoyer le lien',
        submitResetPassword: 'Mettre à jour le mot de passe',
        submitLoading: 'Veuillez patienter...',
        forgotPasswordLink: 'Mot de passe oublié ?',
        backToLogin: 'Retour à la connexion',
        googleContinue: 'Continuer avec Google',
        googleRedirecting: 'Redirection...',
        localAuthInfo: "L'authentification Supabase n'est pas configurée ; le mode local est actif.",
        loginFailed: 'La connexion a échoué.',
        forgotPasswordFailed: 'La demande de réinitialisation a échoué.',
        resetPasswordFailed: 'La mise à jour du mot de passe a échoué.',
        forgotPasswordSuccess: 'Le lien de réinitialisation a été envoyé.',
        resetPasswordSuccess: 'Le mot de passe a été mis à jour avec succès.',
        passwordMismatch: 'Les mots de passe ne correspondent pas.',
        googleFailed: 'La connexion Google a échoué.',
        or: 'OU'
    },
    settings: {
        ...EN_UI_BASE.settings,
        title: 'Paramètres',
        subtitle: "Paramètres du compte et de l'expérience",
        close: 'Fermer',
        tabIdentity: 'Identité',
        tabAppearance: 'Apparence',
        tabSession: 'Session',
        avatar: 'Avatar',
        uploadAvatar: "Téléverser l'avatar",
        avatarHint: 'Recommandé : image carrée',
        personalInfo: 'Informations personnelles',
        fullName: 'Nom',
        username: 'Pseudo',
        gender: 'Genre',
        birthDate: 'Date de naissance',
        select: 'Sélectionner',
        usernameHint: 'Pseudo : 3 à 20 caractères, lettres/chiffres/_',
        bio: 'Bio',
        bioPlaceholder: 'Écrire une courte note de profil...',
        saveIdentity: "Enregistrer l'identité",
        theme: 'Thème',
        themeMidnight: 'Nuit',
        themeDawn: 'Jour',
        language: 'Langue',
        languageTr: 'Turc',
        languageEn: 'Anglais',
        activeAccount: 'Compte actif',
        unknown: 'inconnu',
        sessionControl: 'Gestion de session',
        logout: 'Se déconnecter',
        logoutConfirm: 'Appuyez encore pour vous déconnecter',
        accountDeletion: 'Suppression du compte',
        accountDeletionDescription: 'Ouvrir les consignes publiques de suppression et de conservation pour cette app.',
        accountDeletionOpen: 'Ouvrir la page de suppression',
        accountDeletionMeta: "Envoyez la demande depuis l'e-mail lié au compte via le support App Store.",
        statusThemeUpdated: 'Thème mis à jour',
        statusLanguageSaved: 'Langue enregistrée',
        statusIdentitySaveFailed: "L'enregistrement de l'identité a échoué.",
        statusIdentitySaved: 'Identité enregistrée',
        statusAvatarUpdated: 'Avatar mis à jour'
    },
    daily: {
        ...EN_UI_BASE.daily,
        loading: 'CHARGEMENT DE LA LISTE DU JOUR...',
        title: 'FILMS DU JOUR',
        subtitle: "5 films sélectionnés pour aujourd'hui",
        swipeHint: 'Faire glisser les cartes',
        lockLine1: 'Pour débloquer',
        lockLine2: 'publier 1 commentaire',
        newSelection: 'NOUVELLE SÉLECTION',
        scrollLeftAria: 'Faire défiler les films vers la gauche',
        scrollRightAria: 'Faire défiler les films vers la droite'
    },
    movieCard: {
        ...EN_UI_BASE.movieCard,
        searching: "Recherche dans l'archive...",
        imageUnavailable: 'Affiche indisponible',
        watched: 'Commenté'
    },
    movieDetail: {
        ...EN_UI_BASE.movieDetail,
        close: 'Fermer',
        directedBy: 'Réalisé par',
        noDetails: 'Aucun détail disponible.',
        cast: 'Distribution',
        language: 'Langue',
        unknown: 'Inconnu',
        startComment: 'Écrire un commentaire'
    },
    writeOverlay: {
        ...EN_UI_BASE.writeOverlay,
        title: 'Commentaire',
        placeholder: 'Écrire votre avis...',
        cancel: 'Annuler',
        save: 'Enregistrer'
    },
    arena: {
        ...EN_UI_BASE.arena,
        title: 'Flux des commentaires',
        subtitle: 'Les commentaires sont publiés depuis les cartes de films.',
        all: 'Tous',
        today: "Aujourd'hui",
        selfHandleLabel: 'Votre identifiant : @{handle}',
        findMyComments: 'Trouver mes commentaires',
        searchPlaceholder: 'Rechercher des commentaires...',
        sortLatest: 'Plus récents',
        sortMostLiked: 'Plus appréciés',
        loading: 'Chargement du flux global de commentaires...',
        empty: 'Aucun commentaire trouvé pour ce filtre.',
        end: 'Fin du flux de commentaires',
        hotStreakBadge: 'Série active',
        feedFallback: 'Le flux global de commentaires est indisponible. Le flux local est affiché.',
        feedLoadFailed: "Le flux de commentaires n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.",
        reactionLoadFailed: "Les réactions n'ont pas pu être synchronisées. Actualisez puis réessayez.",
        replyLoadFailed: "Les réponses n'ont pas pu être synchronisées. Actualisez puis réessayez.",
        deleteFailed: "Le commentaire n'a pas pu être supprimé. Réessayez."
    },
    ritualCard: {
        ...EN_UI_BASE.ritualCard,
        readMore: 'Lire plus',
        readLess: 'Lire moins',
        reactions: '{count} RÉACTIONS',
        reply: 'RÉPONDRE ({count})',
        delete: 'SUPPRIMER',
        deleteTitle: 'Supprimer votre commentaire',
        replyPlaceholder: 'Écrire une réponse...',
        send: 'Envoyer',
        anonymous: 'ANONYME',
        reactionSyncFailed: 'La synchronisation des réactions a échoué. Actualisez le flux puis réessayez.',
        replySyncFailed: 'La synchronisation des réponses a échoué. Actualisez le flux puis réessayez.',
        rateLimitReached: 'La limite est atteinte. Veuillez patienter puis réessayer.',
        follow: 'Suivre',
        following: 'Abonné',
        you: 'Vous',
        openProfile: 'Ouvrir le profil',
        replyNotification: 'Réponse envoyée à {author} : "{text}"',
        now: "À l'instant"
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
        xpToNext: '{xp} XP avant le niveau suivant',
        streak: 'Série',
        comments: 'Commentaires',
        days: 'Jours',
        marksUnlocked: 'Marks débloqués',
        observer: 'Observateur'
    },
    profile: {
        ...EN_UI_BASE.profile,
        backHome: "Retour à l'accueil",
        openSettings: 'Ouvrir les paramètres',
        logout: 'Se déconnecter',
        upload: 'Téléverser',
        save: 'Enregistrer',
        cancel: 'Annuler',
        editIdentity: "Modifier l'identité",
        unnamed: 'SANS NOM',
        missingName: 'Aucun nom',
        missingGender: 'Aucun genre',
        missingBirthDate: 'Aucune date de naissance',
        genreDistribution: 'Répartition des genres',
        stats: 'Statistiques',
        days: 'Jours',
        rituals: 'Commentaires',
        comments: 'Commentaires',
        films: 'Films',
        topGenre: 'Genre principal',
        mostCommented: 'Le plus commenté',
        noRecords: 'Aucune donnée',
        activity: 'Activité',
        profileFeed: 'Flux du profil',
        filmArchive: 'Archive des films',
        noFilmComments: 'Aucun film commenté pour le moment.',
        noFilmCommentsHint: 'Commencez votre archive avec votre premier commentaire.',
        marksArchive: 'Archive des Marks',
        featured: '{count}/3 en avant',
        markCategorySuffix: 'Marks',
        requirement: 'Condition',
        unlocked: 'Débloquée',
        locked: 'Verrouillée',
        closeMovieModal: 'Fermer la fenêtre du film',
        unknownGenre: 'Genre inconnu',
        commentsAndReplies: 'Commentaires et réponses',
        commentRecords: '{count} commentaires enregistrés',
        close: 'Fermer',
        repliesLoading: 'Chargement des réponses...',
        replies: 'Réponses ({count})',
        deleteComment: 'Supprimer le commentaire',
        noReplies: 'Aucune réponse pour ce commentaire pour le moment.',
        openFilmDetails: 'Ouvrir les commentaires et réponses pour {title}',
        observerHandle: 'observateur',
        curatorFallback: 'CURATEUR',
        filmCount: '{count} films',
        commentCount: '{count} commentaires',
        filmFallback: 'Film #{id}',
        follow: 'Suivre',
        following: 'Abonné',
        followers: 'Abonnés',
        block: 'Bloquer',
        blocked: 'Bloqué',
        unblock: 'Débloquer',
        blockConfirm: 'Voulez-vous bloquer cet utilisateur ?',
        blockSuccess: 'Utilisateur bloqué.',
        unblockSuccess: 'Utilisateur débloqué.',
        blockedNotice: 'Vous avez bloqué cet utilisateur. Le contenu est masqué.',
        blockedNoticeMeta: 'Vous ne reverrez pas ce profil avant de lever le blocage.',
        followCountsHidden: "Les compteurs d'abonnements sont masqués.",
        profileStatsHidden: 'Cet utilisateur masque les statistiques du profil.',
        activityHidden: "Cet utilisateur masque l'activité.",
        archiveHidden: "Cet utilisateur masque l'activité de l'archive.",
        commentsHidden: 'Cet utilisateur masque les commentaires et réponses.',
        leagueLabel: 'Ligue',
        loadingProfile: 'Chargement du profil...',
        profileLoadFailed: "Le profil n'a pas pu être chargé.",
        publicProfileRequiresSupabase: 'Le profil public nécessite Supabase.',
        timeToday: "Aujourd'hui",
        timeJustNow: "À l'instant",
        timeHoursAgo: 'il y a {count} h',
        timeDaysAgo: 'il y a {count} j'
    },
    xp: {
        ...EN_UI_BASE.xp,
        markUnlockedFallback: 'Mark débloqué.'
    }
};

UI_DICTIONARY.tr.profile.rituals = 'Yorumlar';
UI_DICTIONARY.en.profile.rituals = 'Comments';
UI_DICTIONARY.es.profile.rituals = 'Comentarios';
UI_DICTIONARY.fr.profile.rituals = 'Commentaires';

export const MARK_DICTIONARY: Record<LanguageCode, Record<string, MarkCopy>> = {
    tr: {
        first_mark: { title: 'İlk İşaret', description: 'İlk yorumunu tamamla.', whisper: 'Başlangıç yapıldı.' },
        daybreaker: { title: 'Gün Açan', description: '14 aktif gün boyunca varlık göster.', whisper: 'Her gün geri geldin.' },

        '180_exact': { title: 'Mimar', description: 'Tam 180 karakter yaz.', whisper: 'Kusursuz çerçeve.' },
        precision_loop: { title: 'Hassas Döngü', description: 'Tam 180 karakteri 3 kez yaz.', whisper: 'Hassasiyet tekrarlandı.' },
        minimalist: { title: 'Minimalist', description: '40 karakterden kısa bir yorum yaz.', whisper: 'Az söz.' },
        deep_diver: { title: 'Derin Dalgıç', description: 'Uzun bir yorum gönder (160+ karakter).', whisper: 'Derinlere indin.' },

        no_rush: { title: 'Acelesiz', description: 'Ardışık olmadan 10 yorum tamamla.', whisper: 'Tempon sana ait.' },
        daily_regular: { title: 'Düzenli', description: '3 günlük seri koru.', whisper: 'Sabit bir ritim.' },
        seven_quiet_days: { title: 'Sessizlik Koruyucusu', description: '7 günlük seri koru.', whisper: 'Yedi günlük sessizlik.' },
        ritual_marathon: { title: 'Maraton', description: '20 yorum gönder.', whisper: 'Momentum korundu.' },

        wide_lens: { title: 'Geniş Açı', description: '10 benzersiz türde yorum yap.', whisper: 'Daha geniş bir bakış.' },
        hidden_gem: { title: 'Gizli Cevher', description: 'Düşük puanlı bir filme yorum yap (<= 7.9).', whisper: 'Özel bir yörünge.' },
        genre_discovery: { title: 'Spektrum', description: '3 benzersiz türde yorum yap.', whisper: 'Spektrum açıldı.' },
        one_genre_devotion: { title: 'Adanmış', description: 'Tek bir türde 20 yorum yaz.', whisper: 'Tek odak.' },
        classic_soul: { title: 'Klasik Ruh', description: '1990 öncesi bir film izle.', whisper: 'Geçmişten bir yankı.' },
        genre_nomad: { title: 'Tür Göçebesi', description: 'Art arda 5 farklı türde 5 yorum yaz.', whisper: 'Sabit yörünge yok.' },

        watched_on_time: { title: 'Şafak İzleyicisi', description: '05:00-07:00 arasında yorum gönder.', whisper: 'Tam zamanında.' },
        held_for_five: { title: 'Koruyucu', description: '5 günlük aktif seri koru.', whisper: 'Seriyi tuttun.' },
        mystery_solver: { title: 'Gizem Çözücü', description: 'Gizem slotunu aç.', whisper: 'Bilinmeyen açığa çıktı.' },
        midnight_ritual: { title: 'Gece Yarısı', description: '00:00-01:00 arasında yorum gönder.', whisper: 'Gecenin saati.' },

        first_echo: { title: 'İlk Eko', description: 'İlk eko tepkini al.', whisper: 'Biri seni duydu.' },
        echo_receiver: { title: 'Eko Alıcı', description: 'İlk eko tepkini al.', whisper: 'Duyuluyorsun.' },
        echo_initiate: { title: 'Eko Başlangıcı', description: '1 eko ver.', whisper: 'Küçük bir sinyal.' },
        influencer: { title: 'Etki Yaratan', description: '5 eko al.', whisper: 'Daha geniş bir frekans.' },
        resonator: { title: 'Rezonans', description: '5 eko al.', whisper: 'Rezonans kuruldu.' },
        quiet_following: { title: 'Sessiz Takip', description: '5 kullanıcıyı takip et.', whisper: 'Küçük bir yörünge.' },
        echo_chamber: { title: 'Eko Odası', description: '10 eko ver.', whisper: 'Sinyal sürdürüldü.' },

        eternal_mark: { title: 'Eternal', description: 'Eternal ligine ulaş.', whisper: 'Hâlâ buradasın.' },
        legacy: { title: 'Sütun', description: '30+ gün aktif kal.', whisper: 'Zamanda bir sütun.' },
        archive_keeper: { title: 'Arşiv Bekçisi', description: '50 yorum gönder.', whisper: 'Arşiv hatırlar.' },

        first_answer: { title: 'İlk Cevap', description: 'İlk havuz sorusunu cevapla.', whisper: 'Bir bilgi kıvılcımı.' },
        quiz_curious: { title: 'Meraklı Zihin', description: '25 havuz sorusu cevapla.', whisper: 'Sorular bilgelik doğurur.' },
        quiz_scholar: { title: 'Bilgin', description: '100 havuz sorusu cevapla.', whisper: 'Arşiv derinleşiyor.' },
        quiz_master: { title: 'Quiz Ustası', description: '500 havuz sorusunu doğru cevapla.', whisper: 'Ustalık kazanıldı.' },
        perfect_film: { title: 'Kusursuz Hafıza', description: 'Tek bir filmde 5 soruyu doğru cevapla.', whisper: 'Tam hatırlama.' },
        perfect_streak: { title: 'Kusursuz Seri', description: 'Art arda 3 filmde 5/5 doğru yap.', whisper: 'Hassasiyet sürdürüldü.' },
        rush_survivor: { title: 'Rush Hayatta Kalan', description: 'Bir Rush 10 oturumunu tamamla.', whisper: "Rush'tan sağ çıktın." },
        rush_ace: { title: 'Rush Ası', description: "Rush 10'da 7+ doğru yap.", whisper: 'Baskı altında berraklık.' },
        rush_legend: { title: 'Rush Efsanesi', description: "Rush 20'de 14+ doğru yap.", whisper: 'Ateşte dövülmüş efsane.' },
        rush_endless_10: { title: 'Durdurulamaz', description: 'Sınırsız modda 10 doğru cevaba ulaş.', whisper: 'Son görünmede değil.' },
        swipe_explorer: { title: 'Film Kaşifi', description: '20 filme sağa kaydır.', whisper: 'Hep arayan.' },
        genre_brain: { title: 'Tür Beyni', description: '5 farklı türde doğru cevap ver.', whisper: 'Sınır tanımayan zihin.' },
        league_silver: { title: 'Gümüş Çıkış', description: 'Gümüş ligine ulaş.', whisper: 'Tırmanma başlıyor.' },
        league_gold: { title: 'Altın Standart', description: 'Altın ligine ulaş.', whisper: 'Değerine değer.' },
        league_platinum: { title: 'Platin Zihin', description: 'Platin ligine ulaş.', whisper: 'Baskı altında rafine.' },
        league_emerald: { title: 'Zümrüt Göz', description: 'Zümrüt ligine ulaş.', whisper: 'Daha nadir bir mercek.' },
        league_sapphire: { title: 'Safir Derinlik', description: 'Safir ligine ulaş.', whisper: 'Derin sular.' },
        league_ruby: { title: 'Rubin Vizyon', description: 'Rubin ligine ulaş.', whisper: 'Parlak yanar.' },
        league_diamond: { title: 'Elmas Kesim', description: 'Elmas ligine ulaş.', whisper: 'Kırılmaz berraklık.' },
        league_master: { title: 'Usta Kare', description: 'Usta ligine ulaş.', whisper: 'Zanaat senindir.' },
        league_grandmaster: { title: 'Büyükusta', description: 'Büyükusta ligine ulaş.', whisper: 'Az kişi buraya geldi.' },
        league_absolute: { title: 'Mutlak', description: 'Mutlak ligine ulaş.', whisper: 'Bilinmeyene doğru.' },
        streak_fourteen: { title: 'İki Hafta', description: '14 günlük seri yap.', whisper: 'İki hafta, tek bir atış gibi.' },
        streak_thirty: { title: 'Sabit Olan', description: '30 günlük seri yap.', whisper: 'Bir ay. Kırılmamış.' }
    },
    en: {
        first_mark: { title: 'First Mark', description: 'Complete your first comment.', whisper: 'It begins.' },
        daybreaker: { title: 'Daybreaker', description: 'Be present for 14 active days.', whisper: 'You kept showing up.' },

        '180_exact': { title: 'The Architect', description: 'Write exactly 180 characters.', whisper: 'Perfectly framed.' },
        precision_loop: { title: 'Precision Loop', description: 'Write exactly 180 characters 3 times.', whisper: 'Precision repeated.' },
        minimalist: { title: 'Minimalist', description: 'Write a comment with < 40 characters.', whisper: 'Less said.' },
        deep_diver: { title: 'Deep Diver', description: 'Submit a long-form comment (160+ chars).', whisper: 'The depths explored.' },

        no_rush: { title: 'No Rush', description: 'Complete 10 comments, none consecutive.', whisper: 'Your pace is yours.' },
        daily_regular: { title: 'Regular', description: 'Maintain a 3-day streak.', whisper: 'A steady pulse.' },
        seven_quiet_days: { title: 'Silence Keeper', description: 'Maintain a 7-day streak.', whisper: 'Seven days of silence.' },
        ritual_marathon: { title: 'Marathon', description: 'Submit 20 comments.', whisper: 'Momentum held.' },

        wide_lens: { title: 'Wide Lens', description: 'Review 10 unique genres.', whisper: 'A wider lens.' },
        hidden_gem: { title: 'Hidden Gem', description: 'Review a lower-rated title (<= 7.9).', whisper: 'A private orbit.' },
        genre_discovery: { title: 'Spectrum', description: 'Review 3 unique genres.', whisper: 'A spectrum revealed.' },
        one_genre_devotion: { title: 'Devotee', description: '20 comments in one genre.', whisper: 'A singular focus.' },
        classic_soul: { title: 'Classic Soul', description: 'Watch a movie from before 1990.', whisper: 'An echo from the past.' },
        genre_nomad: { title: 'Genre Nomad', description: 'Write 5 comments in 5 different genres in a row.', whisper: 'No fixed orbit.' },

        watched_on_time: { title: 'Dawn Watcher', description: 'Submit a comment between 05:00 and 07:00.', whisper: 'Right on time.' },
        held_for_five: { title: 'The Keeper', description: '5-day active streak.', whisper: 'You held it.' },
        mystery_solver: { title: 'Mystery Solver', description: 'Unlock the Mystery Slot.', whisper: 'The unknown revealed.' },
        midnight_ritual: { title: 'Midnight', description: 'Comment between 00:00-01:00.', whisper: 'The witching hour.' },

        first_echo: { title: 'First Echo', description: 'Receive your first Echo.', whisper: 'Someone heard you.' },
        echo_receiver: { title: 'Echo Receiver', description: 'Receive your first Echo.', whisper: 'You are heard.' },
        echo_initiate: { title: 'Echo Initiate', description: 'Give 1 Echo.', whisper: 'A small signal.' },
        influencer: { title: 'Influencer', description: 'Receive 5 Echoes.', whisper: 'A wider frequency.' },
        resonator: { title: 'Resonator', description: 'Receive 5 Echoes.', whisper: 'Resonance established.' },
        quiet_following: { title: 'Quiet Following', description: 'Follow 5 users.', whisper: 'A small orbit.' },
        echo_chamber: { title: 'Echo Chamber', description: 'Give 10 Echoes.', whisper: 'Signal sustained.' },

        eternal_mark: { title: 'Eternal', description: 'Reach the Eternal League.', whisper: 'Still here.' },
        legacy: { title: 'The Pillar', description: 'Active for 30+ days.', whisper: 'A pillar in time.' },
        archive_keeper: { title: 'Archive Keeper', description: 'Submit 50 comments.', whisper: 'The archive remembers.' },

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
        genre_brain: { title: 'Genre Brain', description: 'Answer correctly across 5 different genres.', whisper: 'A mind without borders.' },
        league_silver: { title: 'Silver Ascent', description: 'Reach Silver league.', whisper: 'The climb begins.' },
        league_gold: { title: 'Golden Standard', description: 'Reach Gold league.', whisper: 'Worth its weight.' },
        league_platinum: { title: 'Platinum Mind', description: 'Reach Platinum league.', whisper: 'Refined under pressure.' },
        league_emerald: { title: 'Emerald Eye', description: 'Reach Emerald league.', whisper: 'A rarer lens.' },
        league_sapphire: { title: 'Sapphire Depth', description: 'Reach Sapphire league.', whisper: 'Deep waters.' },
        league_ruby: { title: 'Ruby Vision', description: 'Reach Ruby league.', whisper: 'Burning bright.' },
        league_diamond: { title: 'Diamond Cut', description: 'Reach Diamond league.', whisper: 'Unbreakable clarity.' },
        league_master: { title: 'Master Frame', description: 'Reach Master league.', whisper: 'The craft is yours.' },
        league_grandmaster: { title: 'Grandmaster', description: 'Reach Grandmaster league.', whisper: 'Few have walked here.' },
        league_absolute: { title: 'The Absolute', description: 'Reach Absolute league.', whisper: 'Into the void.' },
        streak_fourteen: { title: 'Fortnight', description: 'Maintain a 14-day streak.', whisper: 'Two weeks without missing a beat.' },
        streak_thirty: { title: 'The Constant', description: 'Maintain a 30-day streak.', whisper: 'A month. Unbroken.' }
    },
    es: {
        first_mark: { title: 'Primera Marca', description: 'Completar el primer comentario.', whisper: 'Comienzo.' },
        daybreaker: { title: 'Rompealbas', description: 'Mantener presencia durante 14 días activos.', whisper: 'Constancia diaria.' },

        '180_exact': { title: 'El Arquitecto', description: 'Escribir exactamente 180 caracteres.', whisper: 'Encuadre perfecto.' },
        precision_loop: { title: 'Bucle de Precisión', description: 'Escribir exactamente 180 caracteres 3 veces.', whisper: 'Precisión repetida.' },
        minimalist: { title: 'Minimalista', description: 'Escribir un comentario con menos de 40 caracteres.', whisper: 'Menos es más.' },
        deep_diver: { title: 'Explorador de Fondo', description: 'Enviar un comentario largo (160+ caracteres).', whisper: 'Las profundidades exploradas.' },

        no_rush: { title: 'Sin Prisa', description: 'Completar 10 comentarios, ninguno consecutivo.', whisper: 'Ritmo propio.' },
        daily_regular: { title: 'Constante', description: 'Mantener una racha de 3 días.', whisper: 'Un pulso estable.' },
        seven_quiet_days: { title: 'Guardián del Silencio', description: 'Mantener una racha de 7 días.', whisper: 'Siete días en silencio.' },
        ritual_marathon: { title: 'Maratón', description: 'Enviar 20 comentarios.', whisper: 'El ritmo se mantiene.' },

        wide_lens: { title: 'Gran Angular', description: 'Comentar en 10 géneros distintos.', whisper: 'Una visión más amplia.' },
        hidden_gem: { title: 'Joya Oculta', description: 'Comentar una película de baja puntuación (≤ 7.9).', whisper: 'Una órbita privada.' },
        genre_discovery: { title: 'Espectro', description: 'Comentar en 3 géneros distintos.', whisper: 'Un espectro revelado.' },
        one_genre_devotion: { title: 'Devoto', description: 'Escribir 20 comentarios en un solo género.', whisper: 'Un enfoque singular.' },
        classic_soul: { title: 'Alma Clásica', description: 'Comentar una película anterior a 1990.', whisper: 'Un eco del pasado.' },
        genre_nomad: { title: 'Nómada de Géneros', description: 'Escribir 5 comentarios seguidos en 5 géneros distintos.', whisper: 'Sin órbita fija.' },

        watched_on_time: { title: 'Vigía del Alba', description: 'Enviar un comentario entre las 05:00 y las 07:00.', whisper: 'Justo a tiempo.' },
        held_for_five: { title: 'El Guardián', description: 'Mantener una racha activa de 5 días.', whisper: 'Racha sostenida.' },
        mystery_solver: { title: 'Descifrador', description: 'Desbloquear la ranura misteriosa.', whisper: 'Lo desconocido revelado.' },
        midnight_ritual: { title: 'Medianoche', description: 'Comentar entre las 00:00 y la 01:00.', whisper: 'La hora de los espíritus.' },

        first_echo: { title: 'Primer Eco', description: 'Recibir el primer Eco.', whisper: 'La señal llegó.' },
        echo_receiver: { title: 'Receptor de Eco', description: 'Recibir el primer Eco.', whisper: 'La señal responde.' },
        echo_initiate: { title: 'Iniciado del Eco', description: 'Dar 1 Eco.', whisper: 'Una pequeña señal.' },
        influencer: { title: 'Influencer', description: 'Recibir 5 Ecos.', whisper: 'Una frecuencia más amplia.' },
        resonator: { title: 'Resonador', description: 'Recibir 5 Ecos.', whisper: 'Resonancia establecida.' },
        quiet_following: { title: 'Seguimiento Silencioso', description: 'Seguir a 5 usuarios.', whisper: 'Una pequeña órbita.' },
        echo_chamber: { title: 'Cámara de Eco', description: 'Dar 10 Ecos.', whisper: 'Señal sostenida.' },

        eternal_mark: { title: 'Eternal', description: 'Alcanzar la Liga Eternal.', whisper: 'Aún aquí.' },
        legacy: { title: 'El Pilar', description: 'Mantenerse activo durante 30+ días.', whisper: 'Un pilar en el tiempo.' },
        archive_keeper: { title: 'Guardián del Archivo', description: 'Enviar 50 comentarios.', whisper: 'El archivo recuerda.' },

        first_answer: { title: 'Primera Respuesta', description: 'Responder la primera pregunta del pool.', whisper: 'Una chispa de saber.' },
        quiz_curious: { title: 'Mente Curiosa', description: 'Responder 25 preguntas del pool.', whisper: 'Las preguntas engendran sabiduría.' },
        quiz_scholar: { title: 'Erudito', description: 'Responder 100 preguntas del pool.', whisper: 'El archivo se profundiza.' },
        quiz_master: { title: 'Maestro del Quiz', description: 'Responder correctamente 500 preguntas del pool.', whisper: 'Maestría ganada.' },
        perfect_film: { title: 'Memoria Perfecta', description: 'Acertar las 5 preguntas de una sola película.', whisper: 'Recuerdo total.' },
        perfect_streak: { title: 'Racha Impecable', description: 'Acertar las 5 en 3 películas seguidas.', whisper: 'Precisión sostenida.' },
        rush_survivor: { title: 'Superviviente del Rush', description: 'Completar una sesión de Rush 10.', whisper: 'Rush superado.' },
        rush_ace: { title: 'As del Rush', description: 'Lograr 7+ correctas en Rush 10.', whisper: 'Claridad bajo presión.' },
        rush_legend: { title: 'Leyenda del Rush', description: 'Lograr 14+ correctas en Rush 20.', whisper: 'Leyenda forjada en el fuego.' },
        rush_endless_10: { title: 'Imparable', description: 'Alcanzar 10 correctas en modo Endless.', whisper: 'Sin final a la vista.' },
        swipe_explorer: { title: 'Explorador de Películas', description: 'Deslizar a la derecha en 20 películas.', whisper: 'Siempre buscando.' },
        genre_brain: { title: 'Mente de Géneros', description: 'Responder correctamente en 5 géneros distintos.', whisper: 'Una mente sin fronteras.' },
        league_silver: { title: 'Ascenso Plata', description: 'Alcanzar la liga Plata.', whisper: 'La escalada comienza.' },
        league_gold: { title: 'Estándar Dorado', description: 'Alcanzar la liga Oro.', whisper: 'Vale lo que pesa.' },
        league_platinum: { title: 'Mente Platino', description: 'Alcanzar la liga Platino.', whisper: 'Refinado bajo presión.' },
        league_emerald: { title: 'Ojo Esmeralda', description: 'Alcanzar la liga Esmeralda.', whisper: 'Un lente más raro.' },
        league_sapphire: { title: 'Profundidad Zafiro', description: 'Alcanzar la liga Zafiro.', whisper: 'Aguas profundas.' },
        league_ruby: { title: 'Visión Rubí', description: 'Alcanzar la liga Rubí.', whisper: 'Ardiendo con fuerza.' },
        league_diamond: { title: 'Corte Diamante', description: 'Alcanzar la liga Diamante.', whisper: 'Claridad inquebrantable.' },
        league_master: { title: 'Marco Maestro', description: 'Alcanzar la liga Maestro.', whisper: 'El oficio toma forma.' },
        league_grandmaster: { title: 'Gran Maestro', description: 'Alcanzar la liga Gran Maestro.', whisper: 'Pocos han llegado aquí.' },
        league_absolute: { title: 'El Absoluto', description: 'Alcanzar la liga Absolute.', whisper: 'Hacia el vacío.' },
        streak_fourteen: { title: 'Quincena', description: 'Mantener una racha de 14 días.', whisper: 'Dos semanas sin perder el ritmo.' },
        streak_thirty: { title: 'Lo Constante', description: 'Mantener una racha de 30 días.', whisper: 'Un mes. Sin romper.' }
    },
    fr: {
        first_mark: { title: 'Première Marque', description: 'Compléter le premier commentaire.', whisper: 'Le départ.' },
        daybreaker: { title: 'Brise-Aube', description: 'Être présent pendant 14 jours actifs.', whisper: 'Retour quotidien.' },

        '180_exact': { title: "L'Architecte", description: 'Écrire exactement 180 caractères.', whisper: 'Cadrage parfait.' },
        precision_loop: { title: 'Boucle de Précision', description: 'Écrire exactement 180 caractères 3 fois.', whisper: 'Précision répétée.' },
        minimalist: { title: 'Minimaliste', description: 'Écrire un commentaire avec moins de 40 caractères.', whisper: "Moins, c'est plus." },
        deep_diver: { title: 'Grand Plongeur', description: 'Envoyer un long commentaire (160+ caractères).', whisper: 'Les profondeurs explorées.' },

        no_rush: { title: 'Sans Hâte', description: 'Compléter 10 commentaires, sans enchaînement.', whisper: 'Rythme personnel.' },
        daily_regular: { title: 'Régulier', description: 'Maintenir une série de 3 jours.', whisper: 'Un pouls stable.' },
        seven_quiet_days: { title: 'Gardien du Silence', description: 'Maintenir une série de 7 jours.', whisper: 'Sept jours de silence.' },
        ritual_marathon: { title: 'Marathon', description: 'Envoyer 20 commentaires.', whisper: "L'élan tient." },

        wide_lens: { title: 'Grand Angle', description: 'Commenter dans 10 genres différents.', whisper: 'Une vision plus large.' },
        hidden_gem: { title: 'Pépite Cachée', description: 'Commenter un film peu noté (≤ 7,9).', whisper: 'Une orbite privée.' },
        genre_discovery: { title: 'Spectre', description: 'Commenter dans 3 genres différents.', whisper: 'Un spectre révélé.' },
        one_genre_devotion: { title: 'Dévoué', description: 'Écrire 20 commentaires dans un seul genre.', whisper: 'Un focus singulier.' },
        classic_soul: { title: 'Âme Classique', description: "Commenter un film d'avant 1990.", whisper: 'Un écho du passé.' },
        genre_nomad: { title: 'Nomade de Genres', description: "Écrire 5 commentaires d'affilée dans 5 genres différents.", whisper: "Pas d'orbite fixe." },

        watched_on_time: { title: "Guetteur de l'Aube", description: 'Envoyer un commentaire entre 05 h 00 et 07 h 00.', whisper: 'Juste à temps.' },
        held_for_five: { title: 'Le Gardien', description: 'Maintenir une série active de 5 jours.', whisper: 'Série tenue.' },
        mystery_solver: { title: 'Déchiffreur', description: 'Débloquer la case mystère.', whisper: "L'inconnu révélé." },
        midnight_ritual: { title: 'Minuit', description: 'Commenter entre 00 h 00 et 01 h 00.', whisper: "L'heure des esprits." },

        first_echo: { title: 'Premier Écho', description: 'Recevoir le premier Écho.', whisper: 'Le signal est arrivé.' },
        echo_receiver: { title: "Récepteur d'Écho", description: 'Recevoir le premier Écho.', whisper: 'Le signal répond.' },
        echo_initiate: { title: "Initié à l'Écho", description: 'Donner 1 Écho.', whisper: 'Un petit signal.' },
        influencer: { title: 'Influenceur', description: 'Recevoir 5 Échos.', whisper: 'Une fréquence plus large.' },
        resonator: { title: 'Résonateur', description: 'Recevoir 5 Échos.', whisper: 'Résonance établie.' },
        quiet_following: { title: 'Suivi Silencieux', description: 'Suivre 5 utilisateurs.', whisper: 'Une petite orbite.' },
        echo_chamber: { title: "Chambre d'Écho", description: 'Donner 10 Échos.', whisper: 'Signal maintenu.' },

        eternal_mark: { title: 'Eternal', description: 'Atteindre la Ligue Eternal.', whisper: 'Toujours là.' },
        legacy: { title: 'Le Pilier', description: 'Rester actif pendant 30+ jours.', whisper: 'Un pilier dans le temps.' },
        archive_keeper: { title: 'Gardien des Archives', description: 'Envoyer 50 commentaires.', whisper: "L'archive se souvient." },

        first_answer: { title: 'Première Réponse', description: 'Répondre à la première question du pool.', whisper: 'Une étincelle de savoir.' },
        quiz_curious: { title: 'Esprit Curieux', description: 'Répondre à 25 questions du pool.', whisper: 'Les questions engendrent la sagesse.' },
        quiz_scholar: { title: 'Érudit', description: 'Répondre à 100 questions du pool.', whisper: "L'archive s'approfondit." },
        quiz_master: { title: 'Maître du Quiz', description: 'Répondre correctement à 500 questions du pool.', whisper: 'Maîtrise acquise.' },
        perfect_film: { title: 'Mémoire Parfaite', description: "Réussir les 5 questions d'un seul film.", whisper: 'Rappel total.' },
        perfect_streak: { title: 'Série Impeccable', description: "Réussir les 5 questions sur 3 films d'affilée.", whisper: 'Précision maintenue.' },
        rush_survivor: { title: 'Survivant du Rush', description: 'Terminer une session Rush 10.', whisper: 'Rush traversé.' },
        rush_ace: { title: 'As du Rush', description: 'Obtenir 7+ corrects en Rush 10.', whisper: 'Clarté sous pression.' },
        rush_legend: { title: 'Légende du Rush', description: 'Obtenir 14+ corrects en Rush 20.', whisper: 'Légende forgée dans le feu.' },
        rush_endless_10: { title: 'Inarrêtable', description: 'Atteindre 10 réponses correctes en mode Endless.', whisper: 'Pas de fin en vue.' },
        swipe_explorer: { title: 'Explorateur de Films', description: 'Glisser vers la droite sur 20 films.', whisper: 'Toujours en quête.' },
        genre_brain: { title: 'Cerveau des Genres', description: 'Répondre correctement dans 5 genres différents.', whisper: 'Un esprit sans frontières.' },
        league_silver: { title: 'Montée Argent', description: 'Atteindre la ligue Argent.', whisper: "L'ascension commence." },
        league_gold: { title: 'Standard Or', description: 'Atteindre la ligue Or.', whisper: 'À sa juste valeur.' },
        league_platinum: { title: 'Esprit Platine', description: 'Atteindre la ligue Platine.', whisper: 'Affiné sous pression.' },
        league_emerald: { title: 'Œil Émeraude', description: 'Atteindre la ligue Émeraude.', whisper: 'Un prisme plus rare.' },
        league_sapphire: { title: 'Profondeur Saphir', description: 'Atteindre la ligue Saphir.', whisper: 'Eaux profondes.' },
        league_ruby: { title: 'Vision Rubis', description: 'Atteindre la ligue Rubis.', whisper: 'Ardeur brillante.' },
        league_diamond: { title: 'Taille Diamant', description: 'Atteindre la ligue Diamant.', whisper: 'Clarté indestructible.' },
        league_master: { title: 'Cadre Maître', description: 'Atteindre la ligue Maître.', whisper: "L'art prend forme." },
        league_grandmaster: { title: 'Grand Maître', description: 'Atteindre la ligue Grand Maître.', whisper: 'Peu sont arrivés jusque-là.' },
        league_absolute: { title: "L'Absolu", description: 'Atteindre la ligue Absolute.', whisper: 'Vers le vide.' },
        streak_fourteen: { title: 'Quinzaine', description: 'Maintenir une série de 14 jours.', whisper: 'Deux semaines sans manquer un battement.' },
        streak_thirty: { title: 'La Constante', description: 'Maintenir une série de 30 jours.', whisper: 'Un mois. Sans briser.' }
    }
};

export const MARK_CATEGORY_DICTIONARY: Record<LanguageCode, Record<string, string>> = {
    tr: { Presence: 'Katılım', Writing: 'Yazım', Rhythm: 'Ritim', Discovery: 'Keşif', Ritual: 'Yorum', Social: 'Sosyal', Legacy: 'Miras', Knowledge: 'Bilgi' },
    en: { Presence: 'Presence', Writing: 'Writing', Rhythm: 'Rhythm', Discovery: 'Discovery', Ritual: 'Comment', Social: 'Social', Legacy: 'Legacy', Knowledge: 'Knowledge' },
    es: { Presence: 'Presencia', Writing: 'Escritura', Rhythm: 'Ritmo', Discovery: 'Descubrimiento', Ritual: 'Comentario', Social: 'Social', Legacy: 'Legado', Knowledge: 'Conocimiento' },
    fr: { Presence: 'Présence', Writing: 'Écriture', Rhythm: 'Rythme', Discovery: 'Découverte', Ritual: 'Commentaire', Social: 'Social', Legacy: 'Héritage', Knowledge: 'Connaissance' }
};

export const LEAGUE_DICTIONARY: Record<LanguageCode, Record<string, LeagueCopy>> = {
    tr: {
        Bronze: { name: 'Figüran', description: 'Başlangıç seviyesi.' }, Silver: { name: 'İzleyici', description: 'Düzenli katılım başladı.' },
        Gold: { name: 'Yorumcu', description: 'Yorumların daha net.' }, Platinum: { name: 'Eleştirmen', description: 'Analiz seviyesi arttı.' },
        Emerald: { name: 'Uzman', description: 'Seçimlerin tutarlı.' }, Sapphire: { name: 'Sinefil', description: 'Sinemaya bağlılık yüksek.' },
        Ruby: { name: 'Vizyoner', description: 'İçerik kalitesi yüksek.' }, Diamond: { name: 'Yönetmen', description: 'Üst seviye katılım.' },
        Master: { name: 'Auteur', description: 'Kendi tarzını kurdun.' }, Grandmaster: { name: 'Efsane', description: 'Uzun süreli başarı.' },
        Absolute: { name: 'Absolute', description: 'Sınırın üstü seviye.' }, Eternal: { name: 'Eternal', description: 'En üst lig.' }
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
        Gold: { name: 'Oro', description: 'Mejora la calidad de comentarios.' }, Platinum: { name: 'Platino', description: 'Aumenta la profundidad de análisis.' },
        Emerald: { name: 'Esmeralda', description: 'El gusto se vuelve más refinado.' }, Sapphire: { name: 'Zafiro', description: 'Fuerte compromiso con el cine.' },
        Ruby: { name: 'Rubí', description: 'Progreso de alta calidad.' }, Diamond: { name: 'Diamante', description: 'Constancia de alto nivel.' },
        Master: { name: 'Maestro', description: 'Estilo personal establecido.' }, Grandmaster: { name: 'Gran maestro', description: 'Alto rendimiento sostenido.' },
        Absolute: { name: 'Absolute', description: 'Más allá de los niveles estándar.' }, Eternal: { name: 'Eternal', description: 'Liga máxima.' }
    },
    fr: {
        Bronze: { name: 'Bronze', description: "Niveau d'entrée." }, Silver: { name: 'Argent', description: 'La régularité commence.' },
        Gold: { name: 'Or', description: 'La qualité des commentaires progresse.' }, Platinum: { name: 'Platine', description: "L'analyse devient plus profonde." },
        Emerald: { name: 'Émeraude', description: 'Le goût devient plus raffiné.' }, Sapphire: { name: 'Saphir', description: 'Fort engagement cinéphile.' },
        Ruby: { name: 'Rubis', description: 'Progression de haute qualité.' }, Diamond: { name: 'Diamant', description: 'Régularité de haut niveau.' },
        Master: { name: 'Maître', description: 'Style personnel établi.' }, Grandmaster: { name: 'Grand Maître', description: 'Haute performance durable.' },
        Absolute: { name: 'Absolute', description: 'Au-delà des paliers standards.' }, Eternal: { name: 'Eternal', description: 'Ligue maximale.' }
    }
};
