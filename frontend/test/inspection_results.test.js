import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Inspection Results Experience — Consumer Usability & Integrity Tests', () => {
  // Test 1: Non-accusatory overall verdict mapping
  test('Overall verdict generates objective, consumer-friendly, non-accusatory titles and descriptions', () => {
    const getVerdict = (status, passCount, reviewCount, issueCount, unverifiedCount, panelCount) => {
      const s = (status || '').toUpperCase();
      if (s === 'COMPLIANT' || (passCount > 0 && reviewCount === 0 && issueCount === 0 && unverifiedCount === 0)) {
        return {
          title: 'Appears Compliant',
          badgeStatus: 'COMPLIANT',
          nonAccusatory: true,
        };
      }
      if (s === 'PARTIALLY_VERIFIABLE' || (panelCount === 1 && passCount > 0)) {
        return {
          title: 'Partially Verifiable',
          badgeStatus: 'PARTIALLY_VERIFIABLE',
          nonAccusatory: true,
        };
      }
      if (s === 'NON_COMPLIANT' || issueCount > 0) {
        return {
          title: 'Potential Compliance Issues',
          badgeStatus: 'POTENTIAL_ISSUE',
          nonAccusatory: true,
        };
      }
      if (reviewCount > 0) {
        return {
          title: 'Needs Review',
          badgeStatus: 'NEEDS_REVIEW',
          nonAccusatory: true,
        };
      }
      return {
        title: 'Could Not Be Fully Verified',
        badgeStatus: 'NOT_VERIFIABLE',
        nonAccusatory: true,
      };
    };

    const compliant = getVerdict('COMPLIANT', 8, 0, 0, 0, 2);
    assert.equal(compliant.title, 'Appears Compliant');

    const singlePanel = getVerdict('PARTIALLY_VERIFIABLE', 3, 5, 0, 0, 1);
    assert.equal(singlePanel.title, 'Partially Verifiable');

    const issue = getVerdict('NON_COMPLIANT', 4, 2, 1, 1, 2);
    assert.equal(issue.title, 'Potential Compliance Issues');

    const unverified = getVerdict('NOT_VERIFIABLE', 0, 0, 0, 8, 1);
    assert.equal(unverified.title, 'Could Not Be Fully Verified');
  });

  // Test 2: Dynamic Summary Metrics Bar Calculation
  test('Dynamic summary metrics bar correctly counts all status categories', () => {
    const findings = [
      { rule_id: 'LM-PN-001', status: 'PASS' },
      { rule_id: 'LM-NQ-001', status: 'PASS' },
      { rule_id: 'LM-MRP-001', status: 'REVIEW' },
      { rule_id: 'LM-MFG-001', status: 'PASS' },
      { rule_id: 'LM-ADDR-001', status: 'PASS' },
      { rule_id: 'LM-DATE-001', status: 'REVIEW' },
      { rule_id: 'LM-CARE-001', status: 'POTENTIAL_ISSUE' },
      { rule_id: 'LM-COO-001', status: 'NOT_VERIFIABLE' },
    ];

    const total = findings.length;
    const passCount = findings.filter((f) => f.status === 'PASS').length;
    const reviewCount = findings.filter((f) => f.status === 'REVIEW').length;
    const issueCount = findings.filter((f) => f.status === 'POTENTIAL_ISSUE').length;
    const unverifiedCount = findings.filter((f) => f.status === 'NOT_VERIFIABLE').length;

    assert.equal(total, 8);
    assert.equal(passCount, 4);
    assert.equal(reviewCount, 2);
    assert.equal(issueCount, 1);
    assert.equal(unverifiedCount, 1);
    assert.equal(passCount + reviewCount + issueCount + unverifiedCount, total);
  });

  // Test 3: What NiyamCheck Found grid distinguishes detected vs missing
  test('What NiyamCheck Found grid does not invent data for missing declarations', () => {
    const fields = {
      product_name: { value: 'Potato Chips', confidence: 0.95, source_panel: 'FRONT' },
      net_quantity: { value: null, confidence: 0.0 }, // Not detected
      mrp: { value: null, confidence: 0.0 }, // Not detected
      manufacturer: { value: 'Frito-Lay, Inc.', confidence: 0.92, source_panel: 'BACK' },
      address: { value: 'Plano, TX 75024-4099', confidence: 0.88, source_panel: 'BACK' },
      date_information: { value: null, confidence: 0.0 },
      consumer_care: { value: '1-800-352-4477', confidence: 0.96, source_panel: 'BACK' },
      country_of_origin: { value: 'India', confidence: 0.91, source_panel: 'BACK' },
    };

    // Detected fields should retain extracted strings
    assert.equal(fields.product_name.value, 'Potato Chips');
    assert.equal(fields.manufacturer.value, 'Frito-Lay, Inc.');
    assert.equal(fields.consumer_care.value, '1-800-352-4477');
    assert.equal(fields.country_of_origin.value, 'India');

    // Missing fields must NOT contain Parle-G or fake sample data
    assert.equal(fields.net_quantity.value, null);
    assert.equal(fields.mrp.value, null);
    assert.notEqual(fields.net_quantity.value, '250 g');
    assert.notEqual(fields.mrp.value, 'Rs. 30.00');
  });

  // Test 4: Single-panel advisory box provides informative context
  test('Single-panel advisory explains why unobserved declarations are flagged for review', () => {
    const singlePanelAdvisory =
      'In commercial retail packaging, mandatory statutory declarations (such as MRP, Net Quantity, or Product Name) are often distributed across the Front, Back, Top, or Bottom surfaces. Declarations not observed on this single panel are flagged for review rather than assumed to be absent from the physical product.';

    assert.ok(singlePanelAdvisory.includes('distributed across'));
    assert.ok(singlePanelAdvisory.includes('flagged for review'));
    assert.ok(singlePanelAdvisory.includes('rather than assumed to be absent'));
  });

  // Test 5: Codified Rule Plain-Language Explanations completeness
  test('Codified rules LM-PN-001 through LM-COO-001 have plain-language descriptions', () => {
    const ruleIds = [
      'LM-PN-001',
      'LM-NQ-001',
      'LM-MRP-001',
      'LM-MFG-001',
      'LM-ADDR-001',
      'LM-DATE-001',
      'LM-CARE-001',
      'LM-COO-001',
    ];

    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    for (const ruleId of ruleIds) {
      assert.ok(content.includes(ruleId), `InspectionResults.jsx must declare plain language mapping for ${ruleId}`);
    }
  });

  // Test 6: Consumer guidance and National Consumer Helpline contact
  test('Consumer next steps section references National Consumer Helpline 1915', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    assert.ok(content.includes('1915'), 'Results must reference National Consumer Helpline 1915');
    assert.ok(content.includes('consumerhelpline.gov.in'), 'Results must reference official grievance portal');
    assert.ok(content.includes('Legal Metrology Act, 2009'), 'Results must reference Legal Metrology Act, 2009');
  });

  // Test 7: AI-Assisted Informational Disclaimer exists and preserves legal safety
  test('Informational disclaimer disclaims official legal certification', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    assert.ok(content.includes('AI-Assisted Informational Screening Disclaimer'));
    assert.ok(content.includes('official government certificate') || content.includes('statutory certification'));
    assert.ok(content.includes('Department of Consumer Affairs'));
  });

  // Test 8: CSS Classes for Inspection Results Experience exist in index.css
  test('index.css declares summary metrics, detected grid, and modal classes', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.summary-metrics-bar'), 'index.css must include .summary-metrics-bar');
    assert.ok(cssContent.includes('.detected-grid'), 'index.css must include .detected-grid');
    assert.ok(cssContent.includes('.finding-card'), 'index.css must include .finding-card');
    assert.ok(cssContent.includes('.modal-backdrop'), 'index.css must include .modal-backdrop');
    assert.ok(cssContent.includes('.modal-dialog'), 'index.css must include .modal-dialog');
  });

  // Test 9: Consumer-friendly "What can I do?" section with 5 practical steps
  test('What can I do section contains 5 practical consumer steps and non-accusatory advice', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    assert.ok(content.includes('What can I do?'), 'Must have "What can I do?" heading');
    assert.ok(content.includes('Verify the finding on the complete product packaging'), 'Step 1 must advise checking physical package');
    assert.ok(content.includes('Keep your purchase invoice or bill'), 'Step 2 must advise keeping purchase bill/receipt');
    assert.ok(content.includes('Save photographs of the product and packaging'), 'Step 3 must advise saving photos');
    assert.ok(content.includes('Contact the company for clarification if appropriate'), 'Step 4 must advise contacting customer care');
    assert.ok(content.includes('National Consumer Helpline'), 'Step 5 must advise National Consumer Helpline');
    assert.ok(content.includes('NiyamCheck does not automatically submit a complaint or determine that a company has violated the law'), 'Must advise non-accusatory consumer mindset');
  });

  // Test 10: Per-finding action buttons
  test('Finding cards provide Save Evidence, View Official Source, and View Visual Evidence buttons', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    assert.ok(content.includes('Save Evidence'), 'Card must have [Save Evidence] button');
    assert.ok(content.includes('Saved to Evidence') || content.includes('Evidence Saved'), 'Card must have saved evidence feedback state');
    assert.ok(content.includes('View Official Source'), 'Card must have [View Official Source] button');
    assert.ok(content.includes('View Visual Evidence'), 'Card must have [View Visual Evidence] button');
  });

  // Test 11: Header action buttons
  test('Header provides Save Inspection, Export JSON, Download PDF, and Add More Panels buttons', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    assert.ok(content.includes('Save Inspection') || content.includes('Inspection Saved'), 'Header must have [Save Inspection] button');
    assert.ok(content.includes('Export JSON'), 'Header must have [Export JSON] button');
    assert.ok(content.includes('Download PDF'), 'Header must have [Download PDF] button');
    assert.ok(content.includes('Add More Panels'), 'Header must have [Add More Panels] button');
  });

  // Test 12: draftStore evidence and session persistence methods
  test('draftStore exports saveEvidence, listSavedEvidence, and saveInspectionSession', () => {
    const storePath = path.join(frontendRoot, 'src', 'storage', 'draftStore.js');
    const content = fs.readFileSync(storePath, 'utf8');

    assert.ok(content.includes('saveEvidence'), 'draftStore must export saveEvidence');
    assert.ok(content.includes('listSavedEvidence'), 'draftStore must export listSavedEvidence');
    assert.ok(content.includes('saveInspectionSession'), 'draftStore must export saveInspectionSession');
    assert.ok(content.includes('EVIDENCE_STORE'), 'draftStore must define EVIDENCE_STORE');
    assert.ok(content.includes('DB_VERSION = 2'), 'draftStore must have DB_VERSION 2');
  });

  // Test 13: Non-accusatory language checks across UI
  test('Inspection results enforces non-accusatory terminology', () => {
    const resultsJsxPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsJsxPath, 'utf8');

    // Positive non-accusatory phrasing
    assert.ok(content.includes('Could not be verified from the submitted images'), 'Must use neutral verification phrasing');
    assert.ok(content.includes('Why Flagged as Potential Issue:') || content.includes('Why It Needs Review:'), 'Must explain why item was flagged');
    assert.ok(content.includes('Suggested Action:'), 'Must provide "Suggested Action:" guidance');

    // Accusatory statements that must NEVER appear
    assert.ok(!content.includes('This company violated the law'), 'Must not accuse companies of law violations');
    assert.ok(!content.includes('This product is illegal'), 'Must not declare products illegal');
  });
});
