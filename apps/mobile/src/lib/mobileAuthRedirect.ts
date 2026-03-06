import { resolveMobileWebBaseUrl, type MobileEnvRecord } from './mobileEnv';

const DEFAULT_MOBILE_AUTH_RETURN_URL = 'absolutecinema://open';
const MOBILE_AUTH_CALLBACK_PATH = '/auth/mobile-callback/';

const normalizeText = (value: unknown, maxLength = 1200): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) : text;
};

const readStaticExpoPublicEnv = (key: string): string => {
  switch (key) {
    case 'EXPO_PUBLIC_AUTH_REDIRECT_TO':
      return normalizeText(process.env.EXPO_PUBLIC_AUTH_REDIRECT_TO);
    case 'EXPO_PUBLIC_AUTH_RETURN_TO':
      return normalizeText(process.env.EXPO_PUBLIC_AUTH_RETURN_TO);
    default:
      return '';
  }
};

const readEnv = (env: MobileEnvRecord, key: string): string => {
  const explicitValue = normalizeText(env[key]);
  if (explicitValue) return explicitValue;
  if (env !== process.env) return '';
  return readStaticExpoPublicEnv(key);
};

export const resolveMobileAuthReturnUrl = (env: MobileEnvRecord = process.env): string => {
  const configured = readEnv(env, 'EXPO_PUBLIC_AUTH_RETURN_TO');
  return configured || DEFAULT_MOBILE_AUTH_RETURN_URL;
};

export const resolveMobileAuthCallbackUrl = (env: MobileEnvRecord = process.env): string => {
  const returnUrl = resolveMobileAuthReturnUrl(env);
  const explicitRedirect = readEnv(env, 'EXPO_PUBLIC_AUTH_REDIRECT_TO');
  if (explicitRedirect) return explicitRedirect;

  const webBase = resolveMobileWebBaseUrl(env);
  if (!webBase) return returnUrl;

  try {
    const callbackUrl = new URL(`${webBase}${MOBILE_AUTH_CALLBACK_PATH}`);
    callbackUrl.searchParams.set('app_redirect', returnUrl);
    return callbackUrl.toString();
  } catch {
    return returnUrl;
  }
};
