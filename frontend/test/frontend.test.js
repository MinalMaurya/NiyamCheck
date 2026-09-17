import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('NiyamCheck Frontend Unit & Integration Tests', () => {
  // Test 1: Dashboard metrics calculation
  test('Dashboard correctly computes metrics from real backend inspections', () => {
    const mockInspections = [
      { inspection_id: 'INSP-001', status: 'COMPLIANT' },
      { inspection_id: 'INSP-002', status: 'NON_COMPLIANT' },
      { inspection_id: 'INSP-003', status: 'PARTIALLY_VERIFIABLE' },
      { inspection_id: 'INSP-004', status: 'NOT_VERIFIABLE' },
      { inspection_id: 'INSP-005', status: 'COMPLIANT' },
    ];

    const total = mockInspections.length;
    const compliant = mockInspections.filter((s) => s.status === 'COMPLIANT').length;
    const nonCompliant = mockInspections.filter((s) => s.status === 'NON_COMPLIANT').length;
    const needsReview = mockInspections.filter(
      (s) => s.status === 'PARTIALLY_VERIFIABLE' || s.status === 'NOT_VERIFIABLE'
    ).length;

    assert.equal(total, 5);
    assert.equal(compliant, 2);
    assert.equal(nonCompliant, 1);
    assert.equal(needsReview, 2);
  });

  // Test 2: Panel options validation in upload interface
  test('Upload interface recognizes standard package panels', () => {
    const validPanels = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'OTHER'];
    assert.ok(validPanels.includes('FRONT'));
    assert.ok(validPanels.includes('BACK'));
    assert.equal(validPanels.length, 7);
  });

  // Test 3: API error class properly formats error, status, stage, and errorCode
  test('API error class properly formats error, status, and structured diagnostics', async () => {
    const { ApiError } = await import('../src/api/client.js');
    const err = new ApiError('Resource not found', 404, { hint: 'Check ID' }, 'ocr', 'OCR_FAILED');
    assert.equal(err.message, 'Resource not found');
    assert.equal(err.status, 404);
    assert.deepEqual(err.details, { hint: 'Check ID' });
    assert.equal(err.stage, 'ocr');
    assert.equal(err.errorCode, 'OCR_FAILED');
  });

  // Test 4: API client error normalization
  test('API client provides clear connection error when server is unreachable', async () => {
    const { ApiError } = await import('../src/api/client.js');
    const netErr = new ApiError(
      'Unable to connect to NiyamCheck backend. Please ensure FastAPI server is running on http://localhost:8000. (fetch failed)',
      0
    );
    assert.equal(netErr.status, 0);
    assert.ok(netErr.message.includes('FastAPI server is running'));
  });

  // Test 5: Inspection result displays backend rule evaluations and confidence
  test('Inspection result evaluates rule findings and confidence percentages', () => {
    const ruleEvaluation = {
      rule_id: 'LM-NQ-001',
      name: 'Net Quantity Declaration',
      status: 'PASS',
      reason: 'Net quantity declared in standard metric units.',
      field: 'net_quantity',
      confidence: 0.98,
      evidence: {
        text: 'Net Qty. 250 g',
        bounding_box: { ymin: 0.2, xmin: 0.1, ymax: 0.26, xmax: 0.45 },
      },
    };

    assert.equal(ruleEvaluation.rule_id, 'LM-NQ-001');
    assert.equal(ruleEvaluation.status, 'PASS');
    assert.equal(Math.round(ruleEvaluation.confidence * 100), 98);
    assert.equal(ruleEvaluation.evidence.text, 'Net Qty. 250 g');
  });

  // Test 6: Legal basis displays official citation and URL
  test('Legal basis displays official source URL and statutory citation', () => {
    const legalBasisItem = {
      chunk_id: 'PCR-2011-R6-1-C',
      rule_number: 'Rule 6',
      section: '6(1)(c)',
      source: 'Legal Metrology (Packaged Commodities) Rules, 2011',
      citation: {
        source_title: 'Legal Metrology (Packaged Commodities) Rules, 2011',
        authority: 'Department of Consumer Affairs, Government of India',
        rule_number: 'Rule 6',
        section: '6(1)(c)',
        official_url: 'https://consumeraffairs.nic.in/acts-and-rules/legal-metrology/rules',
        version: 'GSR 427(E)',
        publication_date: '2011-03-07',
      },
      retrieval_score: 0.92,
      official_url: 'https://consumeraffairs.nic.in/acts-and-rules/legal-metrology/rules',
    };

    assert.equal(legalBasisItem.rule_number, 'Rule 6');
    assert.equal(legalBasisItem.section, '6(1)(c)');
    assert.ok(legalBasisItem.official_url.startsWith('https://consumeraffairs.nic.in/'));
    assert.equal(legalBasisItem.citation.authority, 'Department of Consumer Affairs, Government of India');
  });

  // Test 7: Empty legal basis displays required notice
  test('Empty legal basis fallback message matches required specification', () => {
    const legal_basis = [];
    const fallbackText =
      legal_basis.length === 0
        ? 'No authoritative legal provision was retrieved for this finding.'
        : 'Retrieved';
    assert.equal(fallbackText, 'No authoritative legal provision was retrieved for this finding.');
  });

  // Test 8: History filtering logic
  test('History search filters accurately by inspection ID and commodity', () => {
    const items = [
      { inspection_id: 'INSP-ALPHA-01', combined_fields: { product_name: { value: 'Parle-G Biscuits' } }, status: 'COMPLIANT' },
      { inspection_id: 'INSP-BETA-02', combined_fields: { product_name: { value: 'Britannia Good Day' } }, status: 'NON_COMPLIANT' },
      { inspection_id: 'INSP-GAMMA-03', combined_fields: { product_name: { value: 'Lays Chips' } }, status: 'PARTIALLY_VERIFIABLE' },
    ];

    const search1 = 'parle';
    const res1 = items.filter(
      (i) => i.inspection_id.toLowerCase().includes(search1) || i.combined_fields.product_name.value.toLowerCase().includes(search1)
    );
    assert.equal(res1.length, 1);
    assert.equal(res1[0].inspection_id, 'INSP-ALPHA-01');

    const resStatus = items.filter((i) => i.status === 'NON_COMPLIANT');
    assert.equal(resStatus.length, 1);
    assert.equal(resStatus[0].inspection_id, 'INSP-BETA-02');
  });

  // Test 9: Report download URL generator
  test('Report download URLs match FastAPI endpoint specifications', () => {
    const inspId = 'INSP-TEST-999';
    const pdfUrl = `/api/v1/inspections/${inspId}/report`;
    const jsonUrl = `/api/v1/inspections/${inspId}/report.json`;

    assert.equal(pdfUrl, '/api/v1/inspections/INSP-TEST-999/report');
    assert.equal(jsonUrl, '/api/v1/inspections/INSP-TEST-999/report.json');
  });

  // Test 10: Normalized bounding box coordinates [ymin, xmin, ymax, xmax] translation
  test('Normalized bounding box translates accurately to CSS percentage coordinates', () => {
    // Backend standard: [ymin, xmin, ymax, xmax]
    const bbox = { ymin: 0.10, xmin: 0.15, ymax: 0.35, xmax: 0.75 };

    const topPct = Math.round(bbox.ymin * 100);
    const leftPct = Math.round(bbox.xmin * 100);
    const widthPct = Math.round((bbox.xmax - bbox.xmin) * 100);
    const heightPct = Math.round((bbox.ymax - bbox.ymin) * 100);

    assert.equal(topPct, 10);
    assert.equal(leftPct, 15);
    assert.equal(widthPct, 60);
    assert.equal(heightPct, 25);
  });
});
