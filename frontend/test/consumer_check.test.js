import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Consumer Module — Phase 2: Scan / Upload Product Workflow Tests', () => {
  // 1. ConsumerCheck Component Source Integrity
  test('ConsumerCheck component contains device upload, camera capture, and dropzone', () => {
    const checkPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheck.jsx');
    assert.ok(fs.existsSync(checkPath), 'ConsumerCheck.jsx must exist in pages/');

    const content = fs.readFileSync(checkPath, 'utf8');

    // Device upload and camera capture inputs
    assert.ok(content.includes('capture="environment"'), 'Must support camera capture with capture="environment"');
    assert.ok(content.includes('multiple'), 'File input must support multiple packaging images');
    assert.ok(content.includes('image/jpeg,image/png,image/webp'), 'Must accept JPEG, PNG, and WebP');

    // UI actions and guidance
    assert.ok(content.includes('Take Photo'), 'Must render Take Photo button');
    assert.ok(content.includes('Upload from Device'), 'Must render Upload from Device button');
    assert.ok(content.includes('Check Product'), 'Must render Check Product action');
    assert.ok(content.includes('Tips for Getting the Best Check Results'), 'Must render capture guidance');
    assert.ok(content.includes('Avoid Glare'), 'Must advise on avoiding packaging glare');

    // Image preview & editing
    assert.ok(content.includes('handleRemoveImage'), 'Must allow removing selected images');
    assert.ok(content.includes('triggerReplace'), 'Must allow replacing selected images');
  });

  // 2. Client-Side Image Validation
  test('Image validation accepts valid packaging formats and rejects invalid formats and empty files', async () => {
    const { validateImageFile } = await import('../src/utils/imageUtils.js');

    // Valid formats
    const validJpeg = { name: 'pack_front.jpg', type: 'image/jpeg', size: 1024 * 500 };
    const validPng = { name: 'pack_back.png', type: 'image/png', size: 1024 * 800 };
    const validWebp = { name: 'pack_side.webp', type: 'image/webp', size: 1024 * 300 };

    assert.equal(validateImageFile(validJpeg).valid, true);
    assert.equal(validateImageFile(validPng).valid, true);
    assert.equal(validateImageFile(validWebp).valid, true);

    // Invalid format
    const invalidGif = { name: 'animation.gif', type: 'image/gif', size: 1024 * 200 };
    const invalidPdf = { name: 'document.pdf', type: 'application/pdf', size: 1024 * 200 };

    assert.equal(validateImageFile(invalidGif).valid, false);
    assert.ok(validateImageFile(invalidGif).error.includes('Unsupported image format'));
    assert.equal(validateImageFile(invalidPdf).valid, false);

    // Empty file
    const emptyFile = { name: 'empty.jpg', type: 'image/jpeg', size: 0 };
    assert.equal(validateImageFile(emptyFile).valid, false);
    assert.ok(validateImageFile(emptyFile).error.includes('empty'));

    // Oversized file (> 20MB)
    const oversizedFile = { name: 'giant.jpg', type: 'image/jpeg', size: 25 * 1024 * 1024 };
    assert.equal(validateImageFile(oversizedFile).valid, false);
    assert.ok(validateImageFile(oversizedFile).error.includes('exceeds maximum allowable limit'));
  });

  // 3. Multi-Image Packaging Support & API Connection
  test('ConsumerCheck connects to existing createInspection API with files and panels', () => {
    const checkPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheck.jsx');
    const content = fs.readFileSync(checkPath, 'utf8');

    assert.ok(content.includes('createInspection'), 'Must import and use createInspection API');
    assert.ok(content.includes('files'), 'Must map images array to files list');
    assert.ok(content.includes('panels'), 'Must map packaging panel selections (FRONT, BACK, etc.)');
    assert.ok(content.includes('session.inspection_id') || content.includes('session?.inspection_id'), 'Must read returned inspection_id');
  });

  // 4. Multi-Step Processing State
  test('ConsumerCheck renders friendly multi-step processing state on submit', () => {
    const checkPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheck.jsx');
    const content = fs.readFileSync(checkPath, 'utf8');

    assert.ok(content.includes('consumer-processing-wrap'), 'Must include processing view wrapper');
    assert.ok(content.includes('Checking Your Product...'), 'Must show friendly processing title');
    assert.ok(content.includes('Reading labels & detecting text'), 'Must show text scanning step');
    assert.ok(content.includes('Verifying declarations against mandatory requirements'), 'Must show verification step');
  });

  // 5. App.jsx mounts ConsumerCheck under consumer_check tab
  test('App.jsx mounts ConsumerCheck for activeTab consumer_check', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('ConsumerCheck'), 'App.jsx must import ConsumerCheck');
    assert.ok(content.includes("activeTab === 'consumer_check'"), 'App.jsx must check activeTab consumer_check');
    assert.ok(content.includes('<ConsumerCheck'), 'App.jsx must render <ConsumerCheck component');
  });

  // 6. Strict Non-Accusatory Terminology in Consumer Check
  test('ConsumerCheck uses friendly, non-accusatory language', () => {
    const checkPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheck.jsx');
    const content = fs.readFileSync(checkPath, 'utf8').toLowerCase();

    assert.ok(!content.includes('violator'), 'Must not call manufacturers violators');
    assert.ok(!content.includes('criminal'), 'Must not declare products criminal');
    assert.ok(!content.includes('fraudulent'), 'Must not allege fraud');
    assert.ok(!content.includes('unlawful'), 'Must not allege unlawful action on upload');
  });
});
