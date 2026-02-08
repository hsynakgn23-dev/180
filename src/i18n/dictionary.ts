export type LanguageCode = 'tr' | 'en';

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
    };
    login: {
        modeRegister: string;
        modeLogin: string;
        registerForm: string;
        loginForm: string;
        registerInfo: string;
        loginInfo: string;
        fullName: string;
        username: string;
        gender: string;
        birthDate: string;
        email: string;
        password: string;
        fullNamePlaceholder: string;
        usernamePlaceholder: string;
        emailPlaceholder: string;
        passwordPlaceholder: string;
        submitRegister: string;
        submitLogin: string;
        submitLoading: string;
        googleContinue: string;
        googleRedirecting: string;
        localAuthInfo: string;
        loginFailed: string;
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
        searchPlaceholder: string;
        sortLatest: string;
        sortMostLiked: string;
        loading: string;
        empty: string;
        end: string;
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
        replyNotification: string;
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
        app: { brandSubtitle: 'Absolute Cinema', profileTitle: 'Profil', profileAria: 'Profili ac' },
        landing: {
            login: 'Giris Yap', refreshInfo: 'Her gun 00:00 yenilenir', titleLine1: 'GUNLUK', titleLine2: 'SINEMA LISTESI',
            subtitle: 'Her gun 5 film. Bir filme yorum yazarak gunu tamamla.', start: 'Basla',
            featureDailyTitle: 'Gunluk 5 Film', featureDailyText: 'Her sabah yenilenen 5 filmlik secim.',
            featureCommentTitle: '180 Karakter', featureCommentText: 'Kisa ve net yorum yaz.',
            featureProgressTitle: 'Seviye Sistemi', featureProgressText: 'Duzenli katilimla seviyeni arttir.',
            footerManifesto: 'Manifesto', footerRules: 'Kurallar', footerContact: 'Iletisim'
        },
        login: {
            modeRegister: 'Yeni Uyelik', modeLogin: 'Uye Girisi', registerForm: 'Kayit Formu', loginForm: 'Giris Formu',
            registerInfo: 'Kullanici adi, cinsiyet ve dogum tarihi profiline kaydedilir.', loginInfo: 'Mevcut hesabinla giris yap.',
            fullName: 'Isim Soyisim', username: 'Kullanici Adi', gender: 'Cinsiyet', birthDate: 'Dogum Tarihi',
            email: 'E-posta', password: 'Sifre', fullNamePlaceholder: 'Ad Soyad', usernamePlaceholder: 'ornek_kullanici',
            emailPlaceholder: 'ornek@email.com', passwordPlaceholder: 'minimum 6 karakter',
            submitRegister: 'Kayit Ol', submitLogin: 'Giris Yap', submitLoading: 'Bekleyin...',
            googleContinue: 'Google ile Devam Et', googleRedirecting: 'Yonlendiriliyor...', localAuthInfo: 'Supabase auth tanimli degil, yerel giris modu aktif.',
            loginFailed: 'Giris basarisiz.', googleFailed: 'Google girisi basarisiz.', or: 'VEYA'
        },
        settings: {
            title: 'Ayarlar', subtitle: 'Hesap ve deneyim ayarlari', close: 'Kapat',
            tabIdentity: 'Kimlik', tabAppearance: 'Gorunum', tabSession: 'Oturum',
            avatar: 'Avatar', uploadAvatar: 'Avatar Yukle', avatarHint: 'Oneri: kare goruntu',
            personalInfo: 'Kisisel Bilgiler', fullName: 'Isim', username: 'Kullanici', gender: 'Cinsiyet', birthDate: 'Dogum',
            select: 'Seciniz', usernameHint: 'Kullanici adi: 3-20 karakter, harf/rakam/_',
            bio: 'Biyografi', bioPlaceholder: 'Kisa bir profil notu yaz...', saveIdentity: 'Kimligi Kaydet',
            theme: 'Tema', themeMidnight: 'Gece', themeDawn: 'Gunduz', language: 'Dil', languageTr: 'Turkce', languageEn: 'Ingilizce',
            activeAccount: 'Aktif Hesap', unknown: 'bilinmiyor', sessionControl: 'Oturum Kontrolu', logout: 'Cikis Yap', logoutConfirm: 'Tekrar Tikla ve Cik',
            statusThemeUpdated: 'Tema guncellendi', statusLanguageSaved: 'Dil tercihi kaydedildi', statusIdentitySaveFailed: 'Kimlik kaydi basarisiz',
            statusIdentitySaved: 'Kimlik kaydedildi', statusAvatarUpdated: 'Avatar guncellendi'
        },
        daily: { loading: 'GUNLUK LISTE YUKLENIYOR...', title: 'GUNUN FILMLERI', subtitle: 'Her gun secilen 5 film', swipeHint: 'Kartlari kaydir', lockLine1: 'Kilidi acmak icin', lockLine2: '1 yorum yap', newSelection: 'YENI SECIM', scrollLeftAria: 'Filmleri sola kaydir', scrollRightAria: 'Filmleri saga kaydir' },
        movieCard: { searching: 'Arsivde araniyor...', imageUnavailable: 'Poster yok', watched: 'Yorumlandi' },
        movieDetail: { close: 'Kapat', directedBy: 'Yonetmen', noDetails: 'Detay bulunamadi.', cast: 'Oyuncular', language: 'Dil', unknown: 'Bilinmiyor', startComment: 'Yorum Yaz' },
        writeOverlay: { title: 'Yorum', placeholder: 'Dusunceni yaz...', cancel: 'Vazgec', save: 'Kaydet' },
        arena: {
            title: 'Yorum Akisi', subtitle: 'Yorumlar film kartlari uzerinden gonderilir.', all: 'Tum', today: 'Bugun',
            searchPlaceholder: 'Yorum ara...', sortLatest: 'En Yeni', sortMostLiked: 'En Cok Tepki',
            loading: 'Genel yorum akisi yukleniyor...', empty: 'Bu filtrede yorum bulunamadi.', end: 'Yorum akisinin sonu',
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
            replyNotification: '{author} yorumuna yanit: "{text}"', now: 'Simdi'
        },
        notifications: { title: 'Bildirimler', panelTitle: 'Bildirim Merkezi', empty: 'Bildirim yok.' },
        profileWidget: {
            profile: 'Profil', openArchive: 'Profili Ac', openSettings: 'Ayarlari Ac', xpToNext: 'Sonraki seviye icin {xp} XP',
            streak: 'Seri', comments: 'Yorum', days: 'Gun', marksUnlocked: 'Acilan Isaretler', observer: 'Gozlemci'
        },
        profile: {
            backHome: 'Ana sayfaya don', openSettings: 'Ayarlari ac', logout: 'Cikis yap', upload: 'Yukle', save: 'Kaydet', cancel: 'Iptal',
            editIdentity: 'Profili Duzenle', unnamed: 'ISIMSIZ', missingName: 'Isim belirtilmedi', missingGender: 'Cinsiyet belirtilmedi', missingBirthDate: 'Dogum tarihi yok',
            genreDistribution: 'Tur Dagilimi', stats: 'Istatistik', days: 'Gun', rituals: 'Ritueller', comments: 'Yorumlar', films: 'Filmler', topGenre: 'En Cok Tur', mostCommented: 'En Cok Yorumlanan',
            noRecords: 'Kayit yok', activity: 'Aktivite', profileFeed: 'Profil Akisi', filmArchive: 'Film Arsivi',
            noFilmComments: 'Henuz yorumlanan film yok.', noFilmCommentsHint: 'Ilk yorumunla arsivi baslat.',
            marksArchive: 'Isaret Arsivi', featured: '{count}/3 One Cikan', markCategorySuffix: 'Isaretleri', requirement: 'Kazanim', unlocked: 'Acik', locked: 'Kilitli',
            closeMovieModal: 'Film penceresini kapat', unknownGenre: 'Tur bilinmiyor', commentsAndReplies: 'Yorumlar ve Yanitlar', commentRecords: '{count} yorum kaydi',
            close: 'Kapat', repliesLoading: 'Yanitlar yukleniyor...', replies: 'Yanitlar ({count})', deleteComment: 'Yorumu sil', noReplies: 'Bu yoruma henuz yanit yok.',
            openFilmDetails: '{title} yorum ve yanitlarini ac', observerHandle: 'gozlemci', curatorFallback: 'KURATOR', filmCount: '{count} Film', commentCount: '{count} yorum',
            filmFallback: 'Film #{id}', timeToday: 'Bugun', timeJustNow: 'Simdi', timeHoursAgo: '{count}s once', timeDaysAgo: '{count}g once'
        },
        xp: { markUnlockedFallback: 'Yeni isaret acildi.' }
    },
    en: {
        app: { brandSubtitle: 'Absolute Cinema', profileTitle: 'Profile', profileAria: 'Open profile' },
        landing: {
            login: 'Login', refreshInfo: 'Refreshes every day at 00:00', titleLine1: 'DAILY', titleLine2: 'CINEMA LIST',
            subtitle: '5 films every day. Complete the day by posting one comment.', start: 'Start',
            featureDailyTitle: 'Daily 5', featureDailyText: 'A fresh selection of 5 films every morning.',
            featureCommentTitle: '180 Characters', featureCommentText: 'Write short and clear comments.',
            featureProgressTitle: 'Level System', featureProgressText: 'Grow your level with consistent activity.',
            footerManifesto: 'Manifesto', footerRules: 'Rules', footerContact: 'Contact'
        },
        login: {
            modeRegister: 'New Membership', modeLogin: 'Member Login', registerForm: 'Register Form', loginForm: 'Login Form',
            registerInfo: 'Username, gender and birth date are saved to your profile.', loginInfo: 'Sign in with your existing account.',
            fullName: 'Full Name', username: 'Username', gender: 'Gender', birthDate: 'Birth Date',
            email: 'Email', password: 'Password', fullNamePlaceholder: 'Full name', usernamePlaceholder: 'sample_user',
            emailPlaceholder: 'sample@email.com', passwordPlaceholder: 'minimum 6 characters',
            submitRegister: 'Sign Up', submitLogin: 'Sign In', submitLoading: 'Please wait...',
            googleContinue: 'Continue with Google', googleRedirecting: 'Redirecting...', localAuthInfo: 'Supabase auth is not configured, local login mode is active.',
            loginFailed: 'Login failed.', googleFailed: 'Google sign-in failed.', or: 'OR'
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
            statusThemeUpdated: 'Theme updated', statusLanguageSaved: 'Language preference saved', statusIdentitySaveFailed: 'Identity save failed',
            statusIdentitySaved: 'Identity saved', statusAvatarUpdated: 'Avatar updated'
        },
        daily: { loading: 'LOADING DAILY LIST...', title: 'TODAYS FILMS', subtitle: '5 films selected for today', swipeHint: 'Swipe cards', lockLine1: 'To unlock', lockLine2: 'post 1 comment', newSelection: 'NEW SELECTION', scrollLeftAria: 'Scroll movies left', scrollRightAria: 'Scroll movies right' },
        movieCard: { searching: 'Searching archive...', imageUnavailable: 'Poster unavailable', watched: 'Commented' },
        movieDetail: { close: 'Close', directedBy: 'Directed by', noDetails: 'No details available.', cast: 'Cast', language: 'Language', unknown: 'Unknown', startComment: 'Write Comment' },
        writeOverlay: { title: 'Comment', placeholder: 'Write your thoughts...', cancel: 'Cancel', save: 'Save' },
        arena: {
            title: 'Comment Feed', subtitle: 'Comments are posted from film cards.', all: 'All', today: 'Today',
            searchPlaceholder: 'Search comments...', sortLatest: 'Latest', sortMostLiked: 'Most Liked',
            loading: 'Loading global comment feed...', empty: 'No comments found for this filter.', end: 'End of comment feed',
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
            filmFallback: 'Film #{id}', timeToday: 'Today', timeJustNow: 'Just now', timeHoursAgo: '{count}h ago', timeDaysAgo: '{count}d ago'
        },
        xp: { markUnlockedFallback: 'Mark unlocked.' }
    }
};

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
        archive_keeper: { title: 'Arsiv Bekcisi', description: '50 rituel gonder.', whisper: 'Arsiv hatirlar.' }
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
        archive_keeper: { title: 'Archive Keeper', description: 'Submit 50 rituals.', whisper: 'The archive remembers.' }
    }
};

export const MARK_CATEGORY_DICTIONARY: Record<LanguageCode, Record<string, string>> = {
    tr: { Presence: 'Katilim', Writing: 'Yazim', Rhythm: 'Ritim', Discovery: 'Kesif', Ritual: 'Yorum', Social: 'Sosyal', Legacy: 'Miras' },
    en: { Presence: 'Presence', Writing: 'Writing', Rhythm: 'Rhythm', Discovery: 'Discovery', Ritual: 'Comment', Social: 'Social', Legacy: 'Legacy' }
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
    }
};
