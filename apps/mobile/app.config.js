const baseConfig = require('./app.json');

const config = baseConfig.expo;

module.exports = {
  expo: {
    ...config,
    version: '1.0.4',
    android: {
      ...config.android,
      versionCode: 32,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      permissions: [
        ...(config.android.permissions ?? []),
        'com.google.android.gms.permission.AD_ID',
      ],
    },
    ios: {
      ...config.ios,
      buildNumber: '19',
    },
  },
};
