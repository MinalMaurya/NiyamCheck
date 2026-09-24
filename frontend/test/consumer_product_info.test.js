import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Consumer Module — Phase 3: Processing & Product Information Tests', () => {
  // 1. parseConsumerProductInfo parser integrity
  test('parseConsumerProductInfo accurately divides detected vs unverified declarations without inventing data', async () => {
    const { parseConsumerProductInfo } = await import('../src/utils/consumerUtils.js');

    const mockSession = {
      inspection_id: 'INSP-SAMPLE-123',
      created_at: '2026-09-22T12:00:00Z',
      product_category: 'Packaged Food',
      status: 'PARTIALLY_VERIFIABLE',
      combined_fields: {
        product_name: { value: 'Parle-G Original Glucose Biscuits', status: 'PRESENT', source_panel: 'FRONT' },
        net_quantity: { value: '250 g', status: 'PRESENT', source_panel: 'FRONT' },
        mrp: { value: '₹ 30.00 (Incl. of all taxes)', status: 'PRESENT', source_panel: 'FRONT' },
        date_information: { value: '07/2026', status: 'PRESENT', source_panel: 'BACK' },
        manufacturer: { value: 'Parle Products Pvt. Ltd.', status: 'PRESENT', source_panel: 'BACK' },
        address: { value: 'Mumbai - 400057, Maharashtra', status: 'PRESENT', source_panel: 'BACK' },
        consumer_care: { value: null, status: 'MISSING', source_panel: null },
        country_of_origin: { value: 'India', status: 'PRESENT', source_panel: 'BACK' },
      },
      images: [
        { image_id: 'img-001', panel: 'FRONT' },
        { image_id: 'img-002', panel: 'BACK' },
      ],
    };

    const parsed = parseConsumerProductInfo(mockSession);

    assert.equal(parsed.inspectionId, 'INSP-SAMPLE-123');
    assert.equal(parsed.productName, 'Parle-G Original Glucose Biscuits');
    assert.equal(parsed.brandOrMfg, 'Parle Products Pvt. Ltd.');
    assert.equal(parsed.productCategory, 'Packaged Food');
    assert.equal(parsed.consumerStatus.category, 'Requires Review');

    // 7 present declarations, 1 missing (consumer_care)
    assert.equal(parsed.detectedCount, 7);
    assert.equal(parsed.unverifiedCount, 1);

    // Verify detected declarations
    const detectedIds = parsed.detectedDeclarations.map((d) => d.id);
    assert.ok(detectedIds.includes('product_name'));
    assert.ok(detectedIds.includes('net_quantity'));
    assert.ok(detectedIds.includes('mrp'));
    assert.ok(detectedIds.includes('date_information'));
    assert.ok(detectedIds.includes('manufacturer'));
    assert.ok(detectedIds.includes('address'));
    assert.ok(detectedIds.includes('country_of_origin'));

    // Verify unverified declarations
    const unverifiedIds = parsed.unverifiedDeclarations.map((d) => d.id);
    assert.ok(unverifiedIds.includes('consumer_care'));
    assert.equal(parsed.unverifiedDeclarations[0].value, null);
    assert.ok(parsed.unverifiedDeclarations[0].reason.includes('not detected'));
  });

  // 2. ConsumerProcessing Component Source Integrity
  test('ConsumerProcessing component contains step animation, timeout handling, and retry', () => {
    const procPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerProcessing.jsx');
    assert.ok(fs.existsSync(procPath), 'ConsumerProcessing.jsx must exist in pages/');

    const content = fs.readFileSync(procPath, 'utf8');

    // Multi-step messaging
    assert.ok(content.includes('Checking Your Product...'), 'Must show friendly processing title');
    assert.ok(content.includes('Uploading'), 'Must show upload step');
    assert.ok(content.includes('Reading packaging text & detecting labels'), 'Must show text scanning step');
    assert.ok(content.includes('Verifying declarations against mandatory requirements'), 'Must show verification step');

    // Timeout and retry
    assert.ok(content.includes('isTimedOut'), 'Must manage timeout state');
    assert.ok(content.includes('Taking longer than usual'), 'Must render timeout advisory');
    assert.ok(content.includes('handleManualRetry'), 'Must support manual retry');
    assert.ok(content.includes('Return to Photos') || content.includes('Cancel Check'), 'Must allow returning/cancelling');
  });

  // 3. ConsumerProductInfo Component Source Integrity
  test('ConsumerProductInfo component renders product details, detected vs unverified split, and photos gallery', () => {
    const infoPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerProductInfo.jsx');
    assert.ok(fs.existsSync(infoPath), 'ConsumerProductInfo.jsx must exist in pages/');

    const content = fs.readFileSync(infoPath, 'utf8');

    // Product identity elements
    assert.ok(content.includes('parsed.productName'), 'Must render product name');
    assert.ok(content.includes('parsed.brandOrMfg'), 'Must render brand or manufacturer');
    assert.ok(content.includes('parsed.productCategory'), 'Must render product category');
    assert.ok(content.includes('ConsumerStatusBadge'), 'Must render consumer status badge');

    // Photo gallery
    assert.ok(content.includes('getInspectionImageUrl'), 'Must load packaging photo URLs');
    assert.ok(content.includes('Uploaded Packaging Photos'), 'Must display packaging photos row');

    // Distinct sections: detected vs unverified
    assert.ok(content.includes('Verified Declarations'), 'Must label verified declarations section');
    assert.ok(content.includes('Could Not Be Verified'), 'Must label unverified declarations section');
    assert.ok(content.includes('consumer-declaration-card detected'), 'Must apply detected card styling');
    assert.ok(content.includes('consumer-declaration-card unverified'), 'Must apply unverified card styling');

    // Actions
    assert.ok(content.includes('Check Another Product'), 'Must provide Check Another Product action');
    assert.ok(content.includes('Back to Dashboard') || content.includes('Back to Home'), 'Must provide back navigation');
  });

  // 4. App.jsx Integration for Processing and Product Info
  test('App.jsx mounts ConsumerProcessing and ConsumerProductInfo', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('ConsumerProcessing'), 'App.jsx must import ConsumerProcessing');
    assert.ok(content.includes('ConsumerProductInfo'), 'App.jsx must import ConsumerProductInfo');
    assert.ok(content.includes("activeTab === 'consumer_processing'"), 'App.jsx must route consumer_processing');
    assert.ok(content.includes("activeTab === 'consumer_product_info'"), 'App.jsx must route consumer_product_info');
    assert.ok(content.includes('<ConsumerProcessing'), 'App.jsx must render <ConsumerProcessing');
    assert.ok(content.includes('<ConsumerProductInfo'), 'App.jsx must render <ConsumerProductInfo');
  });

  // 5. Strict Non-Accusatory Terminology in Processing & Product Info
  test('ConsumerProcessing and ConsumerProductInfo enforce friendly, non-accusatory language', () => {
    const procPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerProcessing.jsx');
    const infoPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerProductInfo.jsx');

    const combined = `${fs.readFileSync(procPath, 'utf8')} ${fs.readFileSync(infoPath, 'utf8')}`.toLowerCase();

    assert.ok(!combined.includes('criminal'), 'Must not declare products criminal');
    assert.ok(!combined.includes('violator'), 'Must not call manufacturers violators');
    assert.ok(!combined.includes('fraudulent'), 'Must not allege fraud');
    assert.ok(!combined.includes('unlawful'), 'Must not allege unlawful action');
  });
});
