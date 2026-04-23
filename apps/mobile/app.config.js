const baseConfig = require('./app.json');

const config = baseConfig.expo;

module.exports = {
  expo: {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile ?? './google-services.json',
      permissions: [
        ...(config.android.permissions ?? []),
        'com.google.android.gms.permission.AD_ID',
      ],
    },
    ios: {
      ...config.ios,
    },
  },
};
