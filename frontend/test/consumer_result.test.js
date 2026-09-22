import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

// ─── Shared Mock Helpers ────────────────────────────────────────────────────

/**
 * Builds a realistic InspectionSession mock that mirrors the real
 * backend shape: findings come from session.compliance.evaluations.
 */
function buildMockSession(overrides = {}) {
  return {
    inspection_id: 'INSP-TEST-001',
    status: 'COMPLIANT',
    product_category: 'Packaged Food',
    combined_fields: {
      product_name: { value: 'Whole Wheat Flour 1 kg', status: 'PRESENT', source_panel: 'FRONT' },
    },
    compliance: {
      evaluations: [
        {
          rule_id: 'LM-MRP-001',
          name: 'Maximum Retail Price (MRP)',
          status: 'PASS',
          reason: 'MRP declared as ₹ 55 (Incl. of all taxes)',
          confidence: 0.97,
          evidence: { text: '₹ 55 Incl. all taxes', source_panel: 'FRONT' },
        },
        {
          rule_id: 'LM-NQ-001',
          name: 'Net Quantity (Weight / Volume)',
          status: 'PASS',
          reason: 'Net quantity declared as 1 kg',
          confidence: 0.95,
          evidence: { text: '1 kg', source_panel: 'FRONT' },
        },
        {
          rule_id: 'LM-DATE-001',
          name: 'Manufacture / Packaging Date',
          status: 'PASS',
          reason: 'Date of packaging: 06/2026',
          confidence: 0.90,
          evidence: { text: 'PKG: 06/2026', source_panel: 'BOTTOM' },
        },
      ],
    },
    images: [{ image_id: 'img-001', panel: 'FRONT' }],
    ...overrides,
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Consumer Module — Phase 4: Check Result Tests', () => {
  // ── 1. Verified status ───────────────────────────────────────────────────
  test('parseConsumerCheckResult maps COMPLIANT/PASS session to Verified status with correct verdict', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({ status: 'COMPLIANT' });
    const result = parseConsumerCheckResult(session);

    assert.equal(result.isIncomplete, false);
    assert.equal(result.consumerStatus.category, 'Verified');
    assert.ok(result.verdictTitle.includes('Verified'), 'Verified verdict title must mention "Verified"');
    assert.equal(result.okCount, 3, 'All 3 PASS findings should be in okFindings');
    assert.equal(result.attentionCount, 0, 'No attention findings expected for COMPLIANT session');
    assert.equal(result.okFindings[0].status, 'Verified');
  });

  test('parseConsumerCheckResult PASS status also resolves to Verified category', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({ status: 'PASS' });
    const result = parseConsumerCheckResult(session);

    assert.equal(result.consumerStatus.category, 'Verified');
    assert.ok(result.attentionCount === 0);
  });

  // ── 2. Requires Review status ────────────────────────────────────────────
  test('parseConsumerCheckResult maps PARTIALLY_VERIFIABLE to Requires Review with mixed findings', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'PARTIALLY_VERIFIABLE',
      compliance: {
        evaluations: [
          {
            rule_id: 'LM-MRP-001',
            name: 'Maximum Retail Price (MRP)',
            status: 'PASS',
            reason: 'MRP clearly printed.',
            confidence: 0.95,
            evidence: { text: '₹ 55', source_panel: 'FRONT' },
          },
          {
            rule_id: 'LM-ADDR-001',
            name: 'Manufacturer Postal Address',
            status: 'REVIEW',
            reason: 'Address not visible on submitted photo(s).',
            confidence: 0.40,
            evidence: null,
          },
        ],
      },
    });

    const result = parseConsumerCheckResult(session);

    assert.equal(result.consumerStatus.category, 'Requires Review');
    assert.ok(result.verdictTitle.includes('Review'), 'Requires Review title must include "Review"');
    assert.equal(result.okCount, 1);
    assert.equal(result.attentionCount, 1);
    assert.equal(result.attentionFindings[0].category, 'Requires Review');
    assert.equal(result.attentionFindings[0].isIssue, false);
  });

  test('parseConsumerCheckResult maps NEEDS_REVIEW and UNCLEAR to Requires Review category', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    for (const status of ['NEEDS_REVIEW', 'UNCLEAR']) {
      const session = buildMockSession({ status });
      const result = parseConsumerCheckResult(session);
      assert.equal(result.consumerStatus.category, 'Requires Review', `Status ${status} should map to Requires Review`);
    }
  });

  // ── 3. Potential Issue status ────────────────────────────────────────────
  test('parseConsumerCheckResult maps NON_COMPLIANT to Potential Issue with attention findings flagged as issues', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'NON_COMPLIANT',
      compliance: {
        evaluations: [
          {
            rule_id: 'LM-NQ-001',
            name: 'Net Quantity',
            status: 'FAIL',
            reason: 'Net quantity declaration missing standard metric units.',
            confidence: 0.20,
            evidence: null,
          },
          {
            rule_id: 'LM-MRP-001',
            name: 'Maximum Retail Price (MRP)',
            status: 'PASS',
            reason: 'MRP is present.',
            confidence: 0.92,
            evidence: { text: '₹ 40', source_panel: 'FRONT' },
          },
        ],
      },
    });

    const result = parseConsumerCheckResult(session);

    assert.equal(result.consumerStatus.category, 'Potential Issue');
    assert.ok(result.verdictTitle.includes('Potential'), 'Potential Issue title must include "Potential"');
    assert.equal(result.okCount, 1);
    assert.equal(result.attentionCount, 1);
    assert.equal(result.attentionFindings[0].isIssue, true, 'FAIL finding must be flagged as isIssue');
    assert.equal(result.attentionFindings[0].category, 'Potential Issue');
  });

  test('parseConsumerCheckResult maps FAIL and POTENTIAL_ISSUE statuses to Potential Issue category', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    for (const status of ['FAIL', 'POTENTIAL_ISSUE']) {
      const session = buildMockSession({ status });
      const result = parseConsumerCheckResult(session);
      assert.equal(result.consumerStatus.category, 'Potential Issue', `Status ${status} should map to Potential Issue`);
    }
  });

  // ── 4. Not Verifiable status ─────────────────────────────────────────────
  test('parseConsumerCheckResult maps NOT_VERIFIABLE to Not Verifiable with appropriate verdict', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'NOT_VERIFIABLE',
      compliance: { evaluations: [] },
    });

    const result = parseConsumerCheckResult(session);

    assert.equal(result.consumerStatus.category, 'Not Verifiable');
    assert.ok(result.verdictTitle.includes('Not Verifiable'), 'Not Verifiable verdict must mention "Not Verifiable"');
    assert.equal(result.isIncomplete, true, 'Empty evaluations should be flagged as incomplete');
  });

  test('parseConsumerCheckResult maps UNABLE_TO_VERIFY and INSUFFICIENT_EVIDENCE to Not Verifiable', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    for (const status of ['UNABLE_TO_VERIFY', 'INSUFFICIENT_EVIDENCE']) {
      const session = buildMockSession({ status });
      const result = parseConsumerCheckResult(session);
      assert.equal(result.consumerStatus.category, 'Not Verifiable', `Status ${status} should map to Not Verifiable`);
    }
  });

  // ── 5. "What is OK?" findings ────────────────────────────────────────────
  test('"What is OK?" findings include simpleName, reason, whyItMatters, and optional evidence for known rule IDs', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({ status: 'COMPLIANT' });
    const result = parseConsumerCheckResult(session);

    assert.ok(result.okFindings.length > 0, 'Must have at least one OK finding');

    result.okFindings.forEach((finding) => {
      assert.ok(typeof finding.simpleName === 'string' && finding.simpleName.length > 0, 'Each OK finding must have simpleName');
      assert.ok(typeof finding.reason === 'string' && finding.reason.length > 0, 'Each OK finding must have reason');
      assert.ok(typeof finding.whyItMatters === 'string' && finding.whyItMatters.length > 0, 'Each OK finding must have whyItMatters');
      assert.equal(finding.status, 'Verified');
    });

    // MRP finding should have evidence text from mock
    const mrpFinding = result.okFindings.find((f) => f.ruleId === 'LM-MRP-001');
    assert.ok(mrpFinding, 'LM-MRP-001 finding must be present in OK findings');
    assert.ok(mrpFinding.evidenceText, 'MRP finding must carry evidence text from backend');
    assert.equal(mrpFinding.evidencePanel, 'FRONT', 'Evidence panel must match backend data');
  });

  test('"What is OK?" findings carry backend evidence text without invention', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({ status: 'PASS' });
    const result = parseConsumerCheckResult(session);

    // Evidence text must only come from the backend evidence.text field
    result.okFindings.forEach((finding) => {
      if (finding.evidenceText) {
        // The evidence text must not be a fabricated string - it must match one of the mock evidence texts
        const validEvidenceTexts = ['₹ 55 Incl. all taxes', '1 kg', 'PKG: 06/2026'];
        assert.ok(
          validEvidenceTexts.includes(finding.evidenceText),
          `Evidence text "${finding.evidenceText}" must come from backend, not be invented`
        );
      }
    });
  });

  // ── 6. "What needs attention?" findings ──────────────────────────────────
  test('"What needs attention?" findings include category, consumerAdvice, and whyItMatters', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'PARTIALLY_VERIFIABLE',
      compliance: {
        evaluations: [
          {
            rule_id: 'LM-CARE-001',
            name: 'Customer Care Details',
            status: 'REVIEW',
            reason: 'Helpline contact not detected on submitted images.',
            confidence: 0.30,
            evidence: null,
          },
        ],
      },
    });

    const result = parseConsumerCheckResult(session);

    assert.equal(result.attentionFindings.length, 1);
    const finding = result.attentionFindings[0];

    assert.ok(typeof finding.category === 'string', 'Attention finding must have category');
    assert.ok(typeof finding.consumerAdvice === 'string' && finding.consumerAdvice.length > 0, 'Attention finding must have consumerAdvice');
    assert.ok(typeof finding.whyItMatters === 'string' && finding.whyItMatters.length > 0, 'Attention finding must have whyItMatters');
    assert.ok(typeof finding.reason === 'string' && finding.reason.length > 0, 'Attention finding must have reason');
    assert.equal(finding.isIssue, false, 'REVIEW status must not be flagged as an issue');
  });

  test('FAIL findings in attentionFindings have isIssue=true; REVIEW findings have isIssue=false', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'NON_COMPLIANT',
      compliance: {
        evaluations: [
          { rule_id: 'LM-NQ-001', name: 'Net Quantity', status: 'FAIL', reason: 'Missing units.', confidence: 0.1, evidence: null },
          { rule_id: 'LM-ADDR-001', name: 'Address', status: 'REVIEW', reason: 'Not visible.', confidence: 0.35, evidence: null },
          { rule_id: 'LM-MRP-001', name: 'MRP', status: 'NON_COMPLIANT', reason: 'MRP absent.', confidence: 0.1, evidence: null },
        ],
      },
    });

    const result = parseConsumerCheckResult(session);

    const failFinding = result.attentionFindings.find((f) => f.ruleId === 'LM-NQ-001');
    const reviewFinding = result.attentionFindings.find((f) => f.ruleId === 'LM-ADDR-001');
    const ncFinding = result.attentionFindings.find((f) => f.ruleId === 'LM-MRP-001');

    assert.equal(failFinding.isIssue, true, 'FAIL status must set isIssue=true');
    assert.equal(reviewFinding.isIssue, false, 'REVIEW status must set isIssue=false');
    assert.equal(ncFinding.isIssue, true, 'NON_COMPLIANT status must set isIssue=true');
  });

  // ── 7. Incomplete / uncertain data handling ───────────────────────────────
  test('parseConsumerCheckResult returns isIncomplete=true when session has no findings', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    // No compliance evaluations and no findings field
    const emptySession = {
      inspection_id: 'INSP-EMPTY-001',
      status: 'COMPLIANT',
      combined_fields: {},
    };

    const result = parseConsumerCheckResult(emptySession);
    assert.equal(result.isIncomplete, true, 'Session with no findings must be marked incomplete');
  });

  test('parseConsumerCheckResult returns isIncomplete=true when called with null', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const result = parseConsumerCheckResult(null);
    assert.equal(result.isIncomplete, true);
  });

  test('parseConsumerCheckResult falls back gracefully for unknown rule IDs not in CONSUMER_RULE_DETAILS', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({
      status: 'COMPLIANT',
      compliance: {
        evaluations: [
          {
            rule_id: 'UNKNOWN-RULE-999',
            name: 'Some Future Rule',
            status: 'PASS',
            reason: 'Compliant.',
            confidence: 0.88,
            evidence: { text: 'detected text', source_panel: 'SIDE' },
          },
        ],
      },
    });

    const result = parseConsumerCheckResult(session);

    assert.equal(result.isIncomplete, false);
    assert.equal(result.okCount, 1, 'Unknown rule IDs should still be counted in okFindings');
    assert.equal(result.okFindings[0].ruleId, 'UNKNOWN-RULE-999');
    // simpleName falls back to finding.name or ruleId — either is acceptable
    assert.ok(
      result.okFindings[0].simpleName === 'Some Future Rule' || result.okFindings[0].simpleName === 'UNKNOWN-RULE-999',
      'Unknown rule must fall back to finding.name or rule ID'
    );
  });

  test('parseConsumerCheckResult exposes confidence percentage as integer 0-100', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    const session = buildMockSession({ status: 'COMPLIANT' });
    const result = parseConsumerCheckResult(session);

    result.okFindings.forEach((f) => {
      if (f.confidencePct !== null) {
        assert.ok(Number.isInteger(f.confidencePct), 'Confidence must be an integer');
        assert.ok(f.confidencePct >= 0 && f.confidencePct <= 100, 'Confidence must be 0-100');
      }
    });
  });

  // ── 8. No "illegal" frontend claim ──────────────────────────────────────
  test('ConsumerCheckResult component source does not generate accusatory terms like "illegal" or "criminal"', () => {
    const resultPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheckResult.jsx');
    assert.ok(fs.existsSync(resultPath), 'ConsumerCheckResult.jsx must exist');

    const code = fs.readFileSync(resultPath, 'utf8').toLowerCase();

    assert.ok(!code.includes('illegal'), 'ConsumerCheckResult must NOT use the word "illegal"');
    assert.ok(!code.includes('criminal'), 'ConsumerCheckResult must NOT use the word "criminal"');
    assert.ok(!code.includes('fraudulent'), 'ConsumerCheckResult must NOT allege fraud');
    assert.ok(!code.includes('violator'), 'ConsumerCheckResult must NOT call manufacturers violators');
    assert.ok(!code.includes('unlawful'), 'ConsumerCheckResult must NOT allege unlawful activity');
  });

  test('CONSUMER_RULE_DETAILS whyItMatters text does not contain accusatory language', async () => {
    const { CONSUMER_RULE_DETAILS } = await import('../src/utils/consumerUtils.js');

    const allText = Object.values(CONSUMER_RULE_DETAILS)
      .map((r) => `${r.whyItMatters} ${r.passExplanation} ${r.reviewExplanation} ${r.issueExplanation}`)
      .join(' ')
      .toLowerCase();

    assert.ok(!allText.includes('criminal'), 'Rule detail text must not contain "criminal"');
    assert.ok(!allText.includes('fraudulent'), 'Rule detail text must not allege fraud');
    // "illegal" is a common word — the explanations should avoid it
    assert.ok(!allText.includes('is illegal'), 'Rule detail text must not declare products "is illegal"');
  });

  // ── 9. parseConsumerCheckResult with findings from session.findings (alternate shape) ──
  test('parseConsumerCheckResult reads findings from session.findings when compliance.evaluations is absent', async () => {
    const { parseConsumerCheckResult } = await import('../src/utils/consumerUtils.js');

    // Some backend responses may return top-level "findings" instead of "compliance.evaluations"
    const session = {
      inspection_id: 'INSP-ALT-001',
      status: 'PASS',
      combined_fields: {},
      findings: [
        {
          rule_id: 'LM-MRP-001',
          name: 'MRP',
          status: 'PASS',
          reason: 'Clearly printed.',
          confidence: 0.98,
          evidence: { text: '₹ 45', source_panel: 'FRONT' },
        },
      ],
    };

    const result = parseConsumerCheckResult(session);

    assert.equal(result.isIncomplete, false);
    assert.equal(result.okCount, 1, 'Must read findings from session.findings fallback');
  });

  // ── 10. ConsumerCheckResult component source integrity ────────────────────
  test('ConsumerCheckResult.jsx contains verdict hero, 4-category logic, and National Consumer Helpline 1915', () => {
    const resultPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheckResult.jsx');
    const code = fs.readFileSync(resultPath, 'utf8');

    // Verdict hero card
    assert.ok(code.includes('consumer-verdict-hero'), 'Must render verdict hero card');
    assert.ok(code.includes('result.verdictTitle'), 'Must render verdict title from parsed result');
    assert.ok(code.includes('result.verdictDescription'), 'Must render verdict description from parsed result');

    // What is OK / What Needs Attention columns
    assert.ok(code.includes('What is OK?'), 'Must render "What is OK?" column header');
    assert.ok(code.includes('What Needs Attention?'), 'Must render "What Needs Attention?" column header');
    assert.ok(code.includes('consumer-results-grid'), 'Must use consumer-results-grid two-column layout');

    // Why does this matter
    assert.ok(code.includes('Why does this matter?'), 'Must include "Why does this matter?" collapsible');

    // National Consumer Helpline
    assert.ok(code.includes('1915'), 'Must reference National Consumer Helpline 1915');
    assert.ok(code.includes('consumerhelpline.gov.in'), 'Must reference official consumer helpline URL');
    assert.ok(code.includes('PhoneCall'), 'Must include phone call icon for helpline');

    // Consumer notice / disclaimer
    assert.ok(code.includes('Consumer Notice'), 'Must include non-accusatory Consumer Notice disclaimer');
    assert.ok(code.includes('does not constitute an official government enforcement'), 'Must clarify non-enforcement nature');
  });

  test('ConsumerCheckResult.jsx handles loading, error, incomplete, and success states', () => {
    const resultPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheckResult.jsx');
    const code = fs.readFileSync(resultPath, 'utf8');

    // Loading state
    assert.ok(code.includes('Preparing Your Check Result'), 'Must render friendly loading message');
    assert.ok(code.includes('loading'), 'Must manage loading state');

    // Error state
    assert.ok(code.includes('setError'), 'Must manage error state');
    assert.ok(code.includes('Retry'), 'Must provide Retry action on error');
    assert.ok(code.includes('fetchResult'), 'Must have retry handler calling fetchResult');

    // Incomplete/empty state
    assert.ok(code.includes('Incomplete Inspection Data'), 'Must render incomplete state message');
    assert.ok(code.includes('result.isIncomplete'), 'Must check result.isIncomplete before rendering main result');

    // Actions
    assert.ok(code.includes('Check Another Product'), 'Must provide Check Another Product action');
    assert.ok(code.includes('Back to Dashboard') || code.includes('Back to Home'), 'Must provide back navigation');
  });

  test('ConsumerCheckResult.jsx uses parseConsumerCheckResult from consumerUtils and ConsumerStatusBadge', () => {
    const resultPath = path.join(frontendRoot, 'src', 'pages', 'ConsumerCheckResult.jsx');
    const code = fs.readFileSync(resultPath, 'utf8');

    assert.ok(code.includes("from '../utils/consumerUtils'"), 'Must import from consumerUtils');
    assert.ok(code.includes('parseConsumerCheckResult'), 'Must call parseConsumerCheckResult');
    assert.ok(code.includes('ConsumerStatusBadge'), 'Must render ConsumerStatusBadge');
    assert.ok(code.includes('getInspection'), 'Must call getInspection API to load real data');
  });

  // ── 11. App.jsx integration ───────────────────────────────────────────────
  test('App.jsx mounts ConsumerCheckResult for consumer_result tab with correct props', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes('ConsumerCheckResult'), 'App.jsx must import ConsumerCheckResult');
    assert.ok(code.includes("activeTab === 'consumer_result'"), 'App.jsx must route consumer_result tab');
    assert.ok(code.includes('<ConsumerCheckResult'), 'App.jsx must render <ConsumerCheckResult');
    assert.ok(code.includes('onViewProductInfo'), 'App.jsx must wire onViewProductInfo prop');
    assert.ok(code.includes('onCheckAnother'), 'App.jsx must wire onCheckAnother prop');
  });

  // ── 12. CSS classes required by Phase 4 ─────────────────────────────────
  test('index.css declares all Phase 4 result layout and verdict card classes', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.consumer-results-grid'), 'CSS must define .consumer-results-grid');
    assert.ok(css.includes('.consumer-results-col'), 'CSS must define .consumer-results-col');
    assert.ok(css.includes('.consumer-results-col-header'), 'CSS must define .consumer-results-col-header');
  });
});
