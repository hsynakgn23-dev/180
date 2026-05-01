// TEK VERSİYON KAYNAĞI — versiyon güncellemek için sadece bu dosyayı düzenle
// version, android.versionCode, ios.buildNumber

module.exports = {
  expo: {
    name: '180 Absolute Cinema',
    slug: 'absolute-cinema-mobile',
    version: '1.0.6',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'absolutecinema',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/0b479a86-b942-482a-a616-297317401220',
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#121212',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.absolutecinema',
      buildNumber: '37',
      usesAppleSignIn: true,
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.hsyna.absolutecinema',
      versionCode: 37,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#121212',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ['com.google.android.gms.permission.AD_ID'],
    },
    plugins: [
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-5762109870281582~1906612293',
          iosAppId: 'ca-app-pub-5762109870281582~4032146981',
          delayAppMeasurementInit: true,
          userTrackingUsageDescription:
            'This identifier will be used to deliver more relevant ads to you.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#121212',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Avatar seçmek için fotoğraflarına erişim gerekiyor.',
        },
      ],
      'expo-dev-client',
      'expo-web-browser',
      'expo-iap',
    ],
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '0b479a86-b942-482a-a616-297317401220',
      },
    },
    owner: '180absolutecinema',
  },
};
