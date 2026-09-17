/**
 * NiyamCheck Mobile App Configuration & HTTPS Validation
 * Centralized configuration for the mobile Android application download and release channels.
 */

export const DEFAULT_MOBILE_APP_CONFIG = {
  appName: 'NiyamCheck Mobile',
  appSubtitle: 'Check products and regulations wherever you are.',
  androidVersion: 'Android 8.0+',
  appVersion: 'v1.0.0',
  unavailableTitle: 'Mobile app download is not available yet.',
  unavailableMessage: 'The Android app release link will appear here once an official HTTPS download is available.',
};

/**
 * Validates whether a given URL is a legitimate public HTTPS download/release URL.
 * Rejects missing, non-HTTPS, localhost, loopback, and invalid URLs.
 *
 * @param {string} url - Target URL to inspect
 * @returns {{ isValid: boolean, url: string | null, reason: string | null }}
 */
export function validateMobileAppUrl(url) {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      url: null,
      reason: 'URL is missing or empty',
    };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return {
      isValid: false,
      url: null,
      reason: 'URL is empty',
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return {
      isValid: false,
      url: null,
      reason: 'URL is not a valid syntactically well-formed URL',
    };
  }

  // Strict Protocol Enforcement: Must be HTTPS
  if (parsed.protocol !== 'https:') {
    return {
      isValid: false,
      url: null,
      reason: `Insecure or invalid protocol '${parsed.protocol}'. Must use HTTPS.`,
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase();

  // Hostname existence check
  if (!hostname) {
    return {
      isValid: false,
      url: null,
      reason: 'Hostname is missing',
    };
  }

  // Rejection of Localhost & Loopback Addresses
  const isLocalhost =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.') ||
    hostname === '0.0.0.0';

  if (isLocalhost) {
    return {
      isValid: false,
      url: null,
      reason: `Localhost/loopback hostname '${hostname}' is rejected for public mobile app downloads.`,
    };
  }

  // Rejection of internal or dummy top-level domains
  if (hostname.endsWith('.test') || hostname.endsWith('.example') || hostname.endsWith('.invalid')) {
    return {
      isValid: false,
      url: null,
      reason: `Reserved dummy domain '${hostname}' is rejected.`,
    };
  }

  return {
    isValid: true,
    url: parsed.href,
    reason: null,
  };
}

/**
 * Retrieves the raw configured mobile app download URL from environment variables.
 * Compatible with Vite (import.meta.env) and Node.js testing environments (process.env).
 *
 * @returns {string}
 */
export function getRawMobileAppDownloadUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MOBILE_APP_DOWNLOAD_URL) {
    return import.meta.env.VITE_MOBILE_APP_DOWNLOAD_URL;
  }
  if (typeof process !== 'undefined' && process.env && process.env.VITE_MOBILE_APP_DOWNLOAD_URL) {
    return process.env.VITE_MOBILE_APP_DOWNLOAD_URL;
  }
  return '';
}

/**
 * Returns the resolved, validated mobile app configuration.
 *
 * @param {object} [overrides={}] - Optional overrides for testing or runtime context
 * @returns {object}
 */
export function getMobileAppConfig(overrides = {}) {
  const rawUrl = overrides.downloadUrl !== undefined ? overrides.downloadUrl : getRawMobileAppDownloadUrl();
  const validation = validateMobileAppUrl(rawUrl);

  const androidVersion =
    overrides.androidVersion ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MOBILE_APP_ANDROID_VERSION) ||
    DEFAULT_MOBILE_APP_CONFIG.androidVersion;

  const appVersion =
    overrides.appVersion ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MOBILE_APP_VERSION) ||
    DEFAULT_MOBILE_APP_CONFIG.appVersion;

  return {
    appName: DEFAULT_MOBILE_APP_CONFIG.appName,
    appSubtitle: DEFAULT_MOBILE_APP_CONFIG.appSubtitle,
    androidVersion,
    appVersion,
    downloadUrl: validation.url,
    isAvailable: validation.isValid,
    validationReason: validation.reason,
    unavailableTitle: DEFAULT_MOBILE_APP_CONFIG.unavailableTitle,
    unavailableMessage: DEFAULT_MOBILE_APP_CONFIG.unavailableMessage,
  };
}
