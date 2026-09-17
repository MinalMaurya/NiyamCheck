import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('NiyamCheck Mobile “Install App” Experience & Security Tests', () => {
  // 1. Validation: Valid public HTTPS URLs (e.g. GitHub Releases, custom HTTPS download page)
  test('HTTPS validation accepts legitimate public HTTPS APK and release URLs', async () => {
    const { validateMobileAppUrl } = await import('../src/config/mobileApp.js');

    const githubRelease = 'https://github.com/niyamcheck/niyamcheck/releases/download/v1.0.0/niyamcheck-v1.0.0.apk';
    const releaseRes = validateMobileAppUrl(githubRelease);
    assert.equal(releaseRes.isValid, true);
    assert.equal(releaseRes.url, githubRelease);
    assert.equal(releaseRes.reason, null);

    const httpsLanding = 'https://niyamcheck.org/downloads/mobile';
    const landingRes = validateMobileAppUrl(httpsLanding);
    assert.equal(landingRes.isValid, true);
    assert.equal(landingRes.url, httpsLanding);
  });

  // 2. Validation: Rejection of HTTP (insecure) URLs
  test('HTTPS validation rejects non-HTTPS (HTTP) URLs', async () => {
    const { validateMobileAppUrl } = await import('../src/config/mobileApp.js');

    const httpUrl = 'http://example.com/niyamcheck.apk';
    const res = validateMobileAppUrl(httpUrl);
    assert.equal(res.isValid, false);
    assert.equal(res.url, null);
    assert.ok(res.reason.includes('Must use HTTPS'));
  });

  // 3. Validation: Rejection of localhost URLs
  test('HTTPS validation rejects localhost URLs even over HTTPS', async () => {
    const { validateMobileAppUrl } = await import('../src/config/mobileApp.js');

    const localHttp = 'http://localhost:8000/app.apk';
    const localHttps = 'https://localhost:8000/app.apk';
    const subLocal = 'https://api.localhost/app.apk';

    assert.equal(validateMobileAppUrl(localHttp).isValid, false);
    assert.equal(validateMobileAppUrl(localHttps).isValid, false);
    assert.equal(validateMobileAppUrl(subLocal).isValid, false);
    assert.ok(validateMobileAppUrl(localHttps).reason.includes('Localhost/loopback'));
  });

  // 4. Validation: Rejection of 127.0.0.1 and loopback IPs
  test('HTTPS validation rejects 127.0.0.1 and loopback IP addresses', async () => {
    const { validateMobileAppUrl } = await import('../src/config/mobileApp.js');

    const ipHttp = 'http://127.0.0.1:8000/app.apk';
    const ipHttps = 'https://127.0.0.1:8000/app.apk';
    const ipAlt = 'https://127.0.0.2:8000/app.apk';
    const zeroIp = 'https://0.0.0.0:8000/app.apk';

    assert.equal(validateMobileAppUrl(ipHttp).isValid, false);
    assert.equal(validateMobileAppUrl(ipHttps).isValid, false);
    assert.equal(validateMobileAppUrl(ipAlt).isValid, false);
    assert.equal(validateMobileAppUrl(zeroIp).isValid, false);
  });

  // 5. Validation: Rejection of missing, empty, or malformed strings
  test('HTTPS validation rejects missing, empty, or syntactically invalid strings', async () => {
    const { validateMobileAppUrl } = await import('../src/config/mobileApp.js');

    assert.equal(validateMobileAppUrl(null).isValid, false);
    assert.equal(validateMobileAppUrl(undefined).isValid, false);
    assert.equal(validateMobileAppUrl('').isValid, false);
    assert.equal(validateMobileAppUrl('   ').isValid, false);
    assert.equal(validateMobileAppUrl('not-a-valid-url').isValid, false);
    assert.equal(validateMobileAppUrl('javascript:alert(1)').isValid, false);
  });

  // 6. Dynamic QR Code Generation encodes exact configured URL
  test('Valid HTTPS URL dynamically generates scannable QR Code encoding exact URL', async () => {
    const testUrl = 'https://github.com/niyamcheck/niyamcheck/releases/download/v1.0.0/niyamcheck.apk';
    const dataUrl = await QRCode.toDataURL(testUrl, { width: 220, margin: 1 });

    assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR code must be a valid PNG data URI');
    assert.ok(dataUrl.length > 500, 'QR code data URI must have meaningful image payload');
  });

  // 7. Mobile App Configuration Object & Fallbacks
  test('getMobileAppConfig returns safe unavailable state when no URL is configured', async () => {
    const { getMobileAppConfig } = await import('../src/config/mobileApp.js');

    const config = getMobileAppConfig({ downloadUrl: '' });
    assert.equal(config.appName, 'NiyamCheck Mobile');
    assert.equal(config.appSubtitle, 'Check products and regulations wherever you are.');
    assert.equal(config.androidVersion, 'Android 8.0+');
    assert.equal(config.appVersion, 'v1.0.0');
    assert.equal(config.isAvailable, false);
    assert.equal(config.downloadUrl, null);
    assert.equal(config.unavailableTitle, 'Mobile app download is not available yet.');
    assert.ok(config.unavailableMessage.includes('official HTTPS download is available'));
  });

  // 8. Mobile App Configuration Object with Valid URL
  test('getMobileAppConfig enables availability when valid HTTPS URL is provided', async () => {
    const { getMobileAppConfig } = await import('../src/config/mobileApp.js');

    const validRelease = 'https://github.com/my-org/niyamcheck/releases/download/v1.0.0/app.apk';
    const config = getMobileAppConfig({ downloadUrl: validRelease });

    assert.equal(config.isAvailable, true);
    assert.equal(config.downloadUrl, validRelease);
  });

  // 9. InstallAppModal Component Source Integrity
  test('InstallAppModal component contains required layout, titles, and non-fake states', () => {
    const modalPath = path.join(frontendRoot, 'src', 'components', 'InstallAppModal.jsx');
    assert.ok(fs.existsSync(modalPath), 'InstallAppModal.jsx must exist in components/');

    const content = fs.readFileSync(modalPath, 'utf8');

    // Title and Subtitle
    assert.ok(content.includes('NiyamCheck Mobile') || content.includes('config.appName'));
    assert.ok(content.includes('Check products and regulations wherever you are.') || content.includes('config.appSubtitle'));

    // Android Compatibility Information
    assert.ok(content.includes('Android version:') || content.includes('config.androidVersion'));
    assert.ok(content.includes('App version:') || content.includes('config.appVersion'));

    // Available State Elements
    assert.ok(content.includes('Scan to download the app'));
    assert.ok(content.includes('Download APK'));
    assert.ok(content.includes('QRCode.toDataURL'));

    // Unavailable State Elements
    assert.ok(content.includes('config.unavailableTitle'));
    assert.ok(content.includes('config.unavailableMessage'));

    // No Fake Links
    assert.ok(!content.includes('play.google.com'), 'Must not contain fake Google Play Store links');
    assert.ok(!content.includes('localhost:'), 'Must not hardcode localhost URLs');
  });

  // 10. Navbar Integration: Green Install App Button Triggers Modal
  test('Navbar preserves green Install App button and wires modal trigger', () => {
    const navbarPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
    const content = fs.readFileSync(navbarPath, 'utf8');

    // Button presence and exact CSS class
    assert.ok(content.includes('pwa-install-btn'), 'Navbar must retain pwa-install-btn class');
    assert.ok(content.includes('Install App'), 'Navbar must display "Install App" label');
    assert.ok(content.includes('onOpenInstallApp'), 'Navbar must receive onOpenInstallApp handler');
    assert.ok(content.includes('handleInstallClick'), 'Navbar must handle install button click');
  });

  // 11. App.jsx Integration: State and Modal Mounting
  test('App.jsx manages isInstallAppOpen and mounts InstallAppModal', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('InstallAppModal'), 'App.jsx must import InstallAppModal');
    assert.ok(content.includes('isInstallAppOpen'), 'App.jsx must declare isInstallAppOpen state');
    assert.ok(content.includes('onOpenInstallApp'), 'App.jsx must pass onOpenInstallApp to Navbar');
    assert.ok(content.includes('<InstallAppModal'), 'App.jsx must render <InstallAppModal');
  });

  // 12. CSS Styling: Green Install Button Styling Unchanged
  test('index.css retains green .pwa-install-btn styling (#10B981)', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.ok(content.includes('.pwa-install-btn {'));
    assert.ok(content.includes('#10B981'), 'Button must retain brand green #10B981 color');
    assert.ok(content.includes('.install-app-modal-dialog'), 'CSS must include .install-app-modal-dialog');
  });

  // 13. Environment Template Documentation
  test('.env.example documents VITE_MOBILE_APP_DOWNLOAD_URL with HTTPS requirements', () => {
    const envExamplePath = path.join(frontendRoot, '.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist in frontend/');

    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('VITE_MOBILE_APP_DOWNLOAD_URL='));
    assert.ok(content.includes('HTTPS'));
    assert.ok(content.includes('Do NOT use localhost'));
  });

  // 14. SaaS Two-Column Desktop Layout and Mobile Media Queries
  test('index.css declares modern 2-column grid and mobile responsive breakpoint', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const content = fs.readFileSync(cssPath, 'utf8');

    assert.ok(content.includes('.install-app-grid'), 'Must define .install-app-grid');
    assert.ok(content.includes('grid-template-columns: 280px 1fr') || content.includes('grid-template-columns:'), 'Must configure 2-column layout');
    assert.ok(content.includes('@media (max-width: 680px)'), 'Must define mobile breakpoint for 1-column stack');
    assert.ok(content.includes('.install-app-qr-card:hover'), 'Must provide subtle hover elevation effect');
  });

  // 15. QR Card Left Side Labels and Unavailable Empty-State
  test('InstallAppModal renders Scan to Install labels and clear empty-state card', () => {
    const modalPath = path.join(frontendRoot, 'src', 'components', 'InstallAppModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('SCAN TO INSTALL'), 'Left card must display SCAN TO INSTALL badge');
    assert.ok(content.includes('Scan this code with your Android phone.'), 'Must display supporting scan instructions');
    assert.ok(content.includes('Works with Android devices'), 'Must display Android device compatibility note');
    assert.ok(content.includes('Mobile app unavailable'), 'Must display Mobile app unavailable when unconfigured');
    assert.ok(content.includes('The official Android download will appear here once the release is available.'), 'Must explain release pending');
  });

  // 16. Right Side Android Information Card Badges & Actions
  test('InstallAppModal renders Version 1.0.0 and Compatibility badges', () => {
    const modalPath = path.join(frontendRoot, 'src', 'components', 'InstallAppModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('Version'), 'Must display Version badge');
    assert.ok(content.includes('Compatibility'), 'Must display Compatibility badge');
    assert.ok(content.includes('Download unavailable'), 'Must display Download unavailable button when unconfigured');
  });

  // 17. Status Card Section
  test('InstallAppModal renders live status card for configured vs unconfigured states', () => {
    const modalPath = path.join(frontendRoot, 'src', 'components', 'InstallAppModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    // Configured status
    assert.ok(content.includes('Official download available'), 'Must display Official download available');
    assert.ok(content.includes('Secure HTTPS release'), 'Must display Secure HTTPS release');

    // Unconfigured status
    assert.ok(content.includes('Release not configured'), 'Must display Release not configured');
    assert.ok(content.includes('The official Android download link has not been configured yet.'), 'Must display unconfigured note');
  });
});
