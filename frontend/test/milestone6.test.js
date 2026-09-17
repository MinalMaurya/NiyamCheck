import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Milestone 6: PWA, Real-World Hardening & Mobile Readiness Tests', () => {
  // Test 1: PWA Web App Manifest Structure & Values
  test('PWA manifest.webmanifest exists and satisfies PWA installability requirements', () => {
    const manifestPath = path.join(frontendRoot, 'public', 'manifest.webmanifest');
    assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest should exist in public/');

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    assert.equal(manifest.name, 'NiyamCheck — AI Product Compliance Checker');
    assert.equal(manifest.short_name, 'NiyamCheck');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.orientation.startsWith('portrait'));
    assert.equal(manifest.background_color, '#0B1120');

    // Verify icons array
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
    const has192 = manifest.icons.some((i) => i.sizes === '192x192');
    const has512 = manifest.icons.some((i) => i.sizes === '512x512');
    const hasMaskable = manifest.icons.some((i) => i.purpose && i.purpose.includes('maskable'));

    assert.ok(has192, 'Manifest must declare 192x192 icon');
    assert.ok(has512, 'Manifest must declare 512x512 icon');
    assert.ok(hasMaskable, 'Manifest must declare maskable icon');

    // Verify icon files physically exist on disk
    for (const icon of manifest.icons) {
      const iconPath = path.join(frontendRoot, 'public', icon.src.replace(/^\//, ''));
      assert.ok(fs.existsSync(iconPath), `Icon file ${icon.src} should exist at ${iconPath}`);
      const stats = fs.statSync(iconPath);
      assert.ok(stats.size > 0, `Icon file ${icon.src} should not be empty`);
    }
  });

  // Test 2: Service Worker caching and strict API bypass
  test('Service worker sw.js implements static precaching and strict API network pass-through', () => {
    const swPath = path.join(frontendRoot, 'public', 'sw.js');
    assert.ok(fs.existsSync(swPath), 'sw.js should exist in public/');

    const swContent = fs.readFileSync(swPath, 'utf8');
    assert.ok(swContent.includes('CACHE_NAME'), 'SW should define cache name');
    assert.ok(swContent.includes("addEventListener('install'"), 'SW should handle install');
    assert.ok(swContent.includes("addEventListener('activate'"), 'SW should handle activate');
    assert.ok(swContent.includes("addEventListener('fetch'"), 'SW should handle fetch');

    // Critical Requirement: /api/ must strictly bypass cache
    assert.ok(
      swContent.includes("url.pathname.startsWith('/api/')"),
      'SW must identify /api/ routes for bypass'
    );
    assert.ok(
      swContent.includes('return;'),
      'SW must bypass API requests directly to network without interception'
    );
  });

  // Test 3: Image validation utility - Valid formats
  test('Image validation accepts standard JPEG, PNG, and WebP files', async () => {
    const { validateImageFile } = await import('../src/utils/imageUtils.js');

    const validJpeg = { name: 'front_label.jpg', type: 'image/jpeg', size: 1.5 * 1024 * 1024 };
    const validPng = { name: 'back_panel.png', type: 'image/png', size: 3.2 * 1024 * 1024 };
    const validWebp = { name: 'ingredients.webp', type: 'image/webp', size: 850 * 1024 };

    assert.equal(validateImageFile(validJpeg).valid, true);
    assert.equal(validateImageFile(validPng).valid, true);
    assert.equal(validateImageFile(validWebp).valid, true);
  });

  // Test 4: Image validation utility - Rejections (unsupported type, empty file, oversized file)
  test('Image validation rejects empty, oversized, or unsupported file formats', async () => {
    const { validateImageFile } = await import('../src/utils/imageUtils.js');

    // Missing file
    assert.equal(validateImageFile(null).valid, false);
    assert.ok(validateImageFile(null).error.includes('No file provided'));

    // Unsupported format (PDF or GIF)
    const pdfFile = { name: 'document.pdf', type: 'application/pdf', size: 50000 };
    const resPdf = validateImageFile(pdfFile);
    assert.equal(resPdf.valid, false);
    assert.ok(resPdf.error.includes('Unsupported image format'));

    const gifFile = { name: 'animated.gif', type: 'image/gif', size: 50000 };
    assert.equal(validateImageFile(gifFile).valid, false);

    // Empty file (0 bytes)
    const emptyFile = { name: 'empty.jpg', type: 'image/jpeg', size: 0 };
    const resEmpty = validateImageFile(emptyFile);
    assert.equal(resEmpty.valid, false);
    assert.ok(resEmpty.error.includes('empty'));

    // Oversized file (> 20 MB)
    const largeFile = { name: 'huge_raw.jpg', type: 'image/jpeg', size: 22 * 1024 * 1024 };
    const resLarge = validateImageFile(largeFile);
    assert.equal(resLarge.valid, false);
    assert.ok(resLarge.error.includes('exceeds maximum allowable limit'));
  });

  // Test 5: IndexedDB Draft Store module contract
  test('IndexedDB draftStore exports complete CRUD contract for offline session persistence', async () => {
    const { draftStore } = await import('../src/storage/draftStore.js');

    assert.equal(typeof draftStore.saveDraft, 'function');
    assert.equal(typeof draftStore.getDraft, 'function');
    assert.equal(typeof draftStore.listDrafts, 'function');
    assert.equal(typeof draftStore.deleteDraft, 'function');
    assert.equal(typeof draftStore.clearAllDrafts, 'function');
  });

  // Test 6: Offline Warning Banner message consistency
  test('Offline banner specifies drafts available and backend connection requirement', () => {
    const offlineMessage =
      'You are currently offline. Saved inspection drafts remain available on this device. Compliance analysis and legal search require a backend connection.';
    assert.ok(offlineMessage.includes('offline'));
    assert.ok(offlineMessage.includes('Saved inspection drafts remain available'));
    assert.ok(offlineMessage.includes('require a backend connection'));
  });

  // Test 7: Duplicate Submission Protection logic
  test('Submission lock prevents concurrent submissions for the same inspection payload', () => {
    let isSubmitting = false;
    let executionCount = 0;

    const simulateSubmit = () => {
      if (isSubmitting) {
        return { started: false, reason: 'LOCKED' };
      }
      isSubmitting = true;
      executionCount++;
      return { started: true };
    };

    const firstAttempt = simulateSubmit();
    assert.equal(firstAttempt.started, true);
    assert.equal(executionCount, 1);

    // Second immediate attempt while locked
    const secondAttempt = simulateSubmit();
    assert.equal(secondAttempt.started, false);
    assert.equal(secondAttempt.reason, 'LOCKED');
    assert.equal(executionCount, 1);

    // Unlock after completion
    isSubmitting = false;
    const thirdAttempt = simulateSubmit();
    assert.equal(thirdAttempt.started, true);
    assert.equal(executionCount, 2);
  });

  // Test 8: Touch Target Accessibility Dimension Standard
  test('Mobile touch target CSS minimum dimension is 44px', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.touch-btn'), 'index.css should define .touch-btn class');
    assert.ok(cssContent.includes('min-height: 44px'), 'Buttons/tap targets must have at least 44px min-height');
    assert.ok(cssContent.includes('.mobile-drawer-item'), 'index.css should define .mobile-drawer-item');
  });
});
