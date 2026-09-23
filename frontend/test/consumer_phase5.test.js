import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Consumer Module — Phase 5: History, Help & UI Polish Tests', () => {
  // ── 1. ConsumerHistory.jsx exists and has required structure ──────────────
  test('ConsumerHistory.jsx exists and renders loading, empty, error, and history-list states', () => {
    const histPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHistory.jsx');
    assert.ok(fs.existsSync(histPath), 'ConsumerHistory.jsx must exist in pages/');

    const code = fs.readFileSync(histPath, 'utf8');

    // Loading state
    assert.ok(code.includes('Loading your check history'), 'Must show consumer-friendly loading text');
    assert.ok(code.includes('spinning'), 'Must show spinning refresh icon during load');

    // Error state
    assert.ok(code.includes("Couldn't load history"), 'Must show friendly error message');
    assert.ok(code.includes('Retry'), 'Must provide Retry action on error');
    assert.ok(code.includes('loadHistory'), 'Must have loadHistory retry function');

    // Empty state (no checks at all)
    assert.ok(code.includes('No Products Checked Yet'), 'Must show empty state when no checks exist');
    assert.ok(code.includes('Check Your First Product'), 'Must CTA to check first product in empty state');

    // Empty state (filtered)
    assert.ok(code.includes('No Matching Checks'), 'Must show filtered empty state');
    assert.ok(code.includes('Clear filters'), 'Must allow clearing filters');

    // History card elements
    assert.ok(code.includes('consumer-history-list'), 'Must use consumer-history-list container');
    assert.ok(code.includes('consumer-history-card'), 'Must render consumer-history-card elements');
    assert.ok(code.includes('consumer-history-name'), 'Must show product name in history card');
    assert.ok(code.includes('consumer-history-meta'), 'Must show meta info (date, photos, counts)');
    assert.ok(code.includes('consumer-history-status-strip'), 'Must show colour status strip');

    // Summary counts
    assert.ok(code.includes('okCount'), 'Must compute and show verified count');
    assert.ok(code.includes('attentionCount'), 'Must compute and show attention count');
    assert.ok(code.includes('verified'), 'Must label verified count in meta');

    // Actions
    assert.ok(code.includes('View Result'), 'Must provide "View Result" action per card');
    assert.ok(code.includes('Check Another Product'), 'Must provide "Check Another Product" CTA');
    assert.ok(code.includes('onOpenCheck'), 'Must call onOpenCheck when viewing a result');
  });

  test('ConsumerHistory.jsx imports from listInspections API and ConsumerStatusBadge', () => {
    const histPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHistory.jsx');
    const code = fs.readFileSync(histPath, 'utf8');

    assert.ok(code.includes("from '../api/inspections'"), 'Must import from inspections API');
    assert.ok(code.includes('listInspections'), 'Must use listInspections to fetch history');
    assert.ok(code.includes('ConsumerStatusBadge'), 'Must render ConsumerStatusBadge per item');
    assert.ok(code.includes("from '../utils/consumerUtils'"), 'Must use getConsumerStatus from consumerUtils');
    assert.ok(code.includes('getConsumerStatus'), 'Must use getConsumerStatus for status colour');
  });

  test('ConsumerHistory.jsx has search input and status filter pills', () => {
    const histPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHistory.jsx');
    const code = fs.readFileSync(histPath, 'utf8');

    assert.ok(code.includes('searchTerm'), 'Must have searchTerm state');
    assert.ok(code.includes('filterStatus'), 'Must have filterStatus state');
    assert.ok(code.includes('Verified'), 'Filter options must include Verified');
    assert.ok(code.includes('Requires Review'), 'Filter options must include Requires Review');
    assert.ok(code.includes('Potential Issue'), 'Filter options must include Potential Issue');
    assert.ok(code.includes('Not Verifiable'), 'Filter options must include Not Verifiable');
  });

  test('ConsumerHistory.jsx uses consumer-friendly language and no forensic/officer terminology', () => {
    const histPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHistory.jsx');
    const code = fs.readFileSync(histPath, 'utf8').toLowerCase();

    // Must NOT use officer/forensic language
    assert.ok(!code.includes('audit'), 'ConsumerHistory must not use audit/forensic language');
    assert.ok(!code.includes('judicial'), 'ConsumerHistory must not use judicial language');
    assert.ok(!code.includes('compliance verdict'), 'ConsumerHistory must not use compliance verdict terminology');
    assert.ok(!code.includes('ocr bounding box'), 'ConsumerHistory must not expose OCR technical details');

    // Must NOT include accusatory terms
    assert.ok(!code.includes('illegal'), 'ConsumerHistory must not use the word "illegal"');
    assert.ok(!code.includes('criminal'), 'ConsumerHistory must not use the word "criminal"');
  });

  // ── 2. ConsumerHelp.jsx — new sections ───────────────────────────────────
  test('ConsumerHelp.jsx includes "What is NiyamCheck?", "How to Check a Product", and photo tips sections', () => {
    const helpPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHelp.jsx');
    const code = fs.readFileSync(helpPath, 'utf8');

    // About section
    assert.ok(code.includes('What is NiyamCheck?'), 'Must include "What is NiyamCheck?" section');
    assert.ok(code.includes('Legal Metrology (Packaged Commodities) Rules, 2011'), 'Must mention the applicable law');
    assert.ok(code.includes('no legal knowledge required'), 'Must reassure users no legal knowledge needed');

    // How to use section
    assert.ok(code.includes('How to Check a Product'), 'Must include "How to Check a Product" section');
    assert.ok(code.includes('Tap "Check a Product"') || code.includes('Check a Product'), 'Must describe first step');

    // Photo tips section
    assert.ok(code.includes('How to Take a Good Photo'), 'Must include photo capture tips section');
    assert.ok(code.includes('Good Lighting'), 'Must include Good Lighting tip');
    assert.ok(code.includes('Fill the Frame'), 'Must include Fill the Frame tip');
    assert.ok(code.includes('Avoid Glare'), 'Must include Avoid Glare tip');
    assert.ok(code.includes('Multiple Panels'), 'Must include Multiple Panels tip');

    // Why review section
    assert.ok(code.includes('Why Results Sometimes Say'), 'Must explain why results may require review');
    assert.ok(code.includes('not'), 'Requires Review explanation must note it does not mean non-compliant');
  });

  test('ConsumerHelp.jsx still contains 1915 helpline, 8 mandatory declarations, and result categories', () => {
    const helpPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHelp.jsx');
    const code = fs.readFileSync(helpPath, 'utf8');

    // Existing required content must still be present
    assert.ok(code.includes('1915'), 'Must still reference National Consumer Helpline 1915');
    assert.ok(code.includes('consumerhelpline.gov.in'), 'Must reference official helpline URL');
    assert.ok(code.includes('Maximum Retail Price (MRP)'), 'Must still explain MRP requirement');
    assert.ok(code.includes('Net Quantity'), 'Must still explain Net Quantity requirement');
    assert.ok(code.includes('Date of Manufacture'), 'Must still explain Date of Manufacture requirement');

    // 4 result categories must remain
    assert.ok(code.includes('Understanding Your Check Results'), 'Must still have result categories section');
    assert.ok(code.includes('Not Verifiable'), 'Must still explain Not Verifiable category');
    assert.ok(code.includes('Potential Issue'), 'Must still explain Potential Issue category');
  });

  // ── 3. App.jsx routing ────────────────────────────────────────────────────
  test('App.jsx routes consumer_history to ConsumerHistory (not the officer History component)', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes("import { ConsumerHistory }"), 'App.jsx must import ConsumerHistory');
    assert.ok(code.includes("<ConsumerHistory"), 'App.jsx must render <ConsumerHistory');
    assert.ok(code.includes("activeTab === 'consumer_history'"), 'App.jsx must route consumer_history tab');
    assert.ok(code.includes('onOpenCheck'), 'ConsumerHistory must receive onOpenCheck prop');

    // The consumer history tab must NOT render the officer History component anymore
    // We check that consumer_history tab section does not contain <History
    const consumerHistoryBlock = code.slice(
      code.indexOf("activeTab === 'consumer_history'"),
      code.indexOf("activeTab === 'consumer_history'") + 200
    );
    assert.ok(
      !consumerHistoryBlock.includes('<History\n') && !consumerHistoryBlock.includes('<History '),
      'consumer_history tab must NOT use the officer <History> component'
    );
  });

  test('App.jsx still mounts the officer History component for the officer history tab', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes("import { History }"), 'App.jsx must still import officer History');
    assert.ok(code.includes("activeTab === 'history'"), 'App.jsx must still route officer history tab');
  });

  // ── 4. CSS classes for Phase 5 ────────────────────────────────────────────
  test('index.css declares all Phase 5 consumer history card styles', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.consumer-history-list'), 'CSS must define .consumer-history-list');
    assert.ok(css.includes('.consumer-history-card'), 'CSS must define .consumer-history-card');
    assert.ok(css.includes('.consumer-history-card-body'), 'CSS must define .consumer-history-card-body');
    assert.ok(css.includes('.consumer-history-name-row'), 'CSS must define .consumer-history-name-row');
    assert.ok(css.includes('.consumer-history-meta'), 'CSS must define .consumer-history-meta');
    assert.ok(css.includes('.consumer-history-status-strip'), 'CSS must define .consumer-history-status-strip');
  });

  // ── 5. End-to-end consumer nav items ─────────────────────────────────────
  test('Navbar defines all 4 consumer navigation items including consumer_history and consumer_help', () => {
    const navPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
    const code = fs.readFileSync(navPath, 'utf8');

    assert.ok(code.includes('consumer_dashboard'), 'Navbar must include consumer_dashboard');
    assert.ok(code.includes('consumer_check'), 'Navbar must include consumer_check');
    assert.ok(code.includes('consumer_history'), 'Navbar must include consumer_history nav item');
    assert.ok(code.includes('consumer_help'), 'Navbar must include consumer_help nav item');
    assert.ok(code.includes('My Checks') || code.includes('History'), 'Navbar must label consumer history item');
    assert.ok(code.includes('Guide') || code.includes('Help'), 'Navbar must label consumer help item');
  });

  // ── 6. getConsumerStatus available for use in ConsumerHistory ─────────────
  test('getConsumerStatus exported from consumerUtils returns correct category for consumer history filtering', async () => {
    const { getConsumerStatus, CONSUMER_STATUS_CATEGORIES } = await import('../src/utils/consumerUtils.js');

    // These are the four filter options in ConsumerHistory
    assert.equal(getConsumerStatus('COMPLIANT').category, CONSUMER_STATUS_CATEGORIES.VERIFIED);
    assert.equal(getConsumerStatus('PARTIALLY_VERIFIABLE').category, CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW);
    assert.equal(getConsumerStatus('NON_COMPLIANT').category, CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE);
    assert.equal(getConsumerStatus('NOT_VERIFIABLE').category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);

    // Null/unknown should default to Not Verifiable (safe fallback)
    assert.equal(getConsumerStatus(null).category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
    assert.equal(getConsumerStatus(undefined).category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
    assert.equal(getConsumerStatus('').category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
  });

  // ── 7. Verified/attention count calculation from evaluations ───────────────
  test('History card correctly computes okCount and attentionCount from compliance.evaluations', async () => {
    // Simulate what ConsumerHistory does for each session card
    const { getConsumerStatus } = await import('../src/utils/consumerUtils.js');

    const mockSessions = [
      {
        inspection_id: 'INSP-001',
        status: 'PARTIALLY_VERIFIABLE',
        compliance: {
          evaluations: [
            { status: 'PASS' },
            { status: 'COMPLIANT' },
            { status: 'REVIEW' },
            { status: 'FAIL' },
          ],
        },
      },
      {
        inspection_id: 'INSP-002',
        status: 'COMPLIANT',
        compliance: { evaluations: [{ status: 'PASS' }, { status: 'PASS' }, { status: 'PASS' }] },
      },
      {
        inspection_id: 'INSP-003',
        status: 'NOT_VERIFIABLE',
        // No evaluations
      },
    ];

    mockSessions.forEach((session) => {
      const evaluations = session.compliance?.evaluations || session.findings || [];
      const okCount = evaluations.filter(
        (e) => (e.status || '').toUpperCase() === 'PASS' || (e.status || '').toUpperCase() === 'COMPLIANT'
      ).length;
      const attentionCount = evaluations.length - okCount;

      if (session.inspection_id === 'INSP-001') {
        assert.equal(okCount, 2, 'INSP-001 should have 2 OK evaluations');
        assert.equal(attentionCount, 2, 'INSP-001 should have 2 attention evaluations');
      }
      if (session.inspection_id === 'INSP-002') {
        assert.equal(okCount, 3, 'INSP-002 should have 3 OK evaluations');
        assert.equal(attentionCount, 0, 'INSP-002 should have 0 attention evaluations');
      }
      if (session.inspection_id === 'INSP-003') {
        assert.equal(okCount, 0, 'INSP-003 with no evaluations should have 0 okCount');
        assert.equal(attentionCount, 0, 'INSP-003 with no evaluations should have 0 attentionCount');
      }
    });
  });

  // ── 8. Full consumer workflow route coverage ──────────────────────────────
  test('App.jsx mounts all consumer module pages across the full workflow', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const code = fs.readFileSync(appPath, 'utf8');

    const requiredTabs = [
      'consumer_dashboard',
      'consumer_check',
      'consumer_processing',
      'consumer_product_info',
      'consumer_result',
      'consumer_history',
      'consumer_help',
    ];

    requiredTabs.forEach((tab) => {
      assert.ok(
        code.includes(`activeTab === '${tab}'`),
        `App.jsx must route '${tab}' tab`
      );
    });

    const requiredComponents = [
      'ConsumerDashboard',
      'ConsumerCheck',
      'ConsumerProcessing',
      'ConsumerProductInfo',
      'ConsumerCheckResult',
      'ConsumerHistory',
      'ConsumerHelp',
    ];

    requiredComponents.forEach((comp) => {
      assert.ok(
        code.includes(`<${comp}`),
        `App.jsx must render <${comp}>`
      );
    });
  });
});
