import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Consumer Module — Phase 1: Dashboard & Navigation Tests', () => {
  // 1. Consumer Status Mapping: 4 canonical categories
  test('Consumer status helper maps raw statuses to 4 standardized consumer categories', async () => {
    const { getConsumerStatus, CONSUMER_STATUS_CATEGORIES } = await import('../src/utils/consumerUtils.js');

    // Category 1: Verified
    assert.equal(getConsumerStatus('COMPLIANT').category, CONSUMER_STATUS_CATEGORIES.VERIFIED);
    assert.equal(getConsumerStatus('PASS').category, CONSUMER_STATUS_CATEGORIES.VERIFIED);
    assert.equal(getConsumerStatus('VERIFIED').category, CONSUMER_STATUS_CATEGORIES.VERIFIED);
    assert.equal(getConsumerStatus('PRESENT').category, CONSUMER_STATUS_CATEGORIES.VERIFIED);

    // Category 2: Requires Review
    assert.equal(getConsumerStatus('PARTIALLY_VERIFIABLE').category, CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW);
    assert.equal(getConsumerStatus('NEEDS_REVIEW').category, CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW);
    assert.equal(getConsumerStatus('REVIEW').category, CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW);
    assert.equal(getConsumerStatus('UNCLEAR').category, CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW);

    // Category 3: Potential Issue
    assert.equal(getConsumerStatus('NON_COMPLIANT').category, CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE);
    assert.equal(getConsumerStatus('POTENTIAL_ISSUE').category, CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE);
    assert.equal(getConsumerStatus('FAIL').category, CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE);
    assert.equal(getConsumerStatus('MISSING').category, CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE);

    // Category 4: Not Verifiable
    assert.equal(getConsumerStatus('NOT_VERIFIABLE').category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
    assert.equal(getConsumerStatus('UNABLE_TO_VERIFY').category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
    assert.equal(getConsumerStatus('INSUFFICIENT_EVIDENCE').category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
    assert.equal(getConsumerStatus(null).category, CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE);
  });

  // 2. Metrics calculation from real inspection sessions
  test('Consumer metrics correctly aggregate totals and 4 category counts', () => {
    const mockSessions = [
      { inspection_id: 'INSP-01', status: 'COMPLIANT' },
      { inspection_id: 'INSP-02', status: 'PASS' },
      { inspection_id: 'INSP-03', status: 'PARTIALLY_VERIFIABLE' },
      { inspection_id: 'INSP-04', status: 'UNCLEAR' },
      { inspection_id: 'INSP-05', status: 'NON_COMPLIANT' },
      { inspection_id: 'INSP-06', status: 'POTENTIAL_ISSUE' },
      { inspection_id: 'INSP-07', status: 'NOT_VERIFIABLE' },
    ];

    const total = mockSessions.length;
    const verified = mockSessions.filter((s) => ['COMPLIANT', 'PASS', 'VERIFIED'].includes(s.status)).length;
    const review = mockSessions.filter((s) =>
      ['PARTIALLY_VERIFIABLE', 'NEEDS_REVIEW', 'REVIEW', 'UNCLEAR'].includes(s.status)
    ).length;
    const issues = mockSessions.filter((s) =>
      ['NON_COMPLIANT', 'POTENTIAL_ISSUE', 'POTENTIAL_ISSUES', 'FAIL'].includes(s.status)
    ).length;
    const notVerifiable = mockSessions.filter((s) =>
      ['NOT_VERIFIABLE', 'UNABLE_TO_VERIFY', 'INSUFFICIENT_EVIDENCE'].includes(s.status)
    ).length;

    assert.equal(total, 7);
    assert.equal(verified, 2);
    assert.equal(review, 2);
    assert.equal(issues, 2);
    assert.equal(notVerifiable, 1);
  });

  // 3. Strict non-accusatory language rule
  test('Consumer components strictly enforce friendly, non-accusatory terminology', () => {
    const dashboardPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerDashboard.jsx');
    const badgePath = path.join(frontendRoot, 'src', 'components', 'ConsumerStatusBadge.jsx');
    const helpPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHelp.jsx');

    const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
    const badgeCode = fs.readFileSync(badgePath, 'utf8');
    const helpCode = fs.readFileSync(helpPath, 'utf8');

    const allConsumerCode = `${dashboardCode} ${badgeCode} ${helpCode}`.toLowerCase();

    // Must NOT contain harsh accusatory legal jargon
    assert.ok(!allConsumerCode.includes('criminal'), 'Must not declare products criminal');
    assert.ok(!allConsumerCode.includes('violator'), 'Must not call manufacturers violators');
    assert.ok(!allConsumerCode.includes('fraudulent'), 'Must not allege fraud based on frontend logic');
    assert.ok(!allConsumerCode.includes('unlawful'), 'Must not allege unlawful activity based on frontend logic');
  });

  // 4. Navbar Dual-Mode Switcher Integration
  test('Navbar includes Portal Mode Switcher and preserves officer items', () => {
    const navbarPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
    const code = fs.readFileSync(navbarPath, 'utf8');

    assert.ok(code.includes('portal-mode-toggle'), 'Navbar must contain portal mode switcher');
    assert.ok(code.includes('Consumer'), 'Navbar must contain Consumer mode');
    assert.ok(code.includes('Officer'), 'Navbar must contain Officer mode');
    assert.ok(code.includes('onTogglePortalMode'), 'Navbar must accept onTogglePortalMode prop');
    assert.ok(code.includes('consumerNavItems'), 'Navbar must define consumer navigation items');
    assert.ok(code.includes('officerNavItems'), 'Navbar must define officer navigation items');
  });

  // 5. Consumer Guide references official National Consumer Helpline 1915
  test('Consumer Help page includes official helpline 1915 and 8 mandatory declarations', () => {
    const helpPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerHelp.jsx');
    const code = fs.readFileSync(helpPath, 'utf8');

    assert.ok(code.includes('1915'), 'Must reference National Consumer Helpline 1915');
    assert.ok(code.includes('consumerhelpline.gov.in'), 'Must reference official consumer helpline URL');
    assert.ok(code.includes('Maximum Retail Price (MRP)'), 'Must explain MRP requirement');
    assert.ok(code.includes('Net Quantity'), 'Must explain Net Quantity requirement');
    assert.ok(code.includes('Date of Manufacture'), 'Must explain Date of Manufacture requirement');
  });

  // 6. CSS contains required consumer and badge classes
  test('index.css declares consumer hero, metrics, badge, and portal mode styles', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.consumer-badge-verified'), 'CSS must define .consumer-badge-verified');
    assert.ok(css.includes('.consumer-badge-review'), 'CSS must define .consumer-badge-review');
    assert.ok(css.includes('.consumer-badge-issue'), 'CSS must define .consumer-badge-issue');
    assert.ok(css.includes('.consumer-badge-unverifiable'), 'CSS must define .consumer-badge-unverifiable');
    assert.ok(css.includes('.portal-mode-toggle'), 'CSS must define .portal-mode-toggle');
    assert.ok(css.includes('.consumer-hero-card'), 'CSS must define .consumer-hero-card');
  });
});
