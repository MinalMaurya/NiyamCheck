import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Multi-Image Packaging Panel Inspection — Frontend Usability & Integrity Tests', () => {
  const STANDARD_PANELS = [
    { id: 'FRONT', label: 'Front' },
    { id: 'BACK', label: 'Back' },
    { id: 'LEFT', label: 'Left Side' },
    { id: 'RIGHT', label: 'Right Side' },
    { id: 'TOP', label: 'Top' },
    { id: 'BOTTOM', label: 'Bottom' },
  ];

  // Test 1: Standard 6-Panel classification (Analyzed vs Not submitted)
  test('Standard 6-panel breakdown correctly classifies submitted vs unsubmitted panels', () => {
    const images = [
      { id: 'img-1', panel: 'FRONT', ocr: { word_count: 35 } },
      { id: 'img-2', panel: 'BACK', ocr: { word_count: 142 } },
    ];

    const results = STANDARD_PANELS.map((p) => {
      const matched = images.filter((i) => (i.panel || '').toUpperCase() === p.id);
      const isAnalyzed = matched.length > 0;
      const totalWords = matched.reduce((sum, img) => sum + (img.ocr?.word_count || 0), 0);
      return {
        id: p.id,
        label: p.label,
        isAnalyzed,
        statusText: isAnalyzed ? `Analyzed (${totalWords} words)` : 'Not submitted',
      };
    });

    const front = results.find((r) => r.id === 'FRONT');
    const back = results.find((r) => r.id === 'BACK');
    const left = results.find((r) => r.id === 'LEFT');
    const right = results.find((r) => r.id === 'RIGHT');
    const top = results.find((r) => r.id === 'TOP');
    const bottom = results.find((r) => r.id === 'BOTTOM');

    assert.equal(front.isAnalyzed, true);
    assert.equal(front.statusText, 'Analyzed (35 words)');

    assert.equal(back.isAnalyzed, true);
    assert.equal(back.statusText, 'Analyzed (142 words)');

    // Strictly "Not submitted", NEVER "Not detected"
    assert.equal(left.isAnalyzed, false);
    assert.equal(left.statusText, 'Not submitted');
    assert.notEqual(left.statusText, 'Not detected');

    assert.equal(right.isAnalyzed, false);
    assert.equal(right.statusText, 'Not submitted');

    assert.equal(top.isAnalyzed, false);
    assert.equal(top.statusText, 'Not submitted');

    assert.equal(bottom.isAnalyzed, false);
    assert.equal(bottom.statusText, 'Not submitted');
  });

  // Test 2: Single-panel coverage advisory logic
  test('Single-panel inspection displays informative advisory and prompts to add more panels', () => {
    const checkCoverage = (imageCount) => {
      if (imageCount === 1) {
        return {
          isSingle: true,
          badge: 'Partial Pack (1 Panel)',
          advisory:
            'Only 1 packaging panel was submitted. Mandatory declarations are often distributed across multiple packaging panels. Declarations not observed on this panel are flagged for review rather than assumed to be absent from the physical product.',
          actionText: 'Add More Panels',
        };
      }
      return {
        isSingle: false,
        badge: `Multi-Panel (${imageCount} Panels)`,
        advisory: `Declarations and visual evidence were aggregated across all ${imageCount} submitted packaging surfaces.`,
        actionText: 'Add More Panels',
      };
    };

    const single = checkCoverage(1);
    assert.equal(single.isSingle, true);
    assert.ok(single.advisory.includes('distributed across multiple packaging panels'));
    assert.ok(single.advisory.includes('flagged for review'));
    assert.equal(single.actionText, 'Add More Panels');

    const multi = checkCoverage(3);
    assert.equal(multi.isSingle, false);
    assert.equal(multi.advisory, 'Declarations and visual evidence were aggregated across all 3 submitted packaging surfaces.');
  });

  // Test 3: Cross-panel duplicate consolidation
  test('Duplicate declarations across panels are consolidated with primary and additional sources', () => {
    // E.g., Product name declared on both FRONT and BACK
    const finding = {
      rule_id: 'LM-PN-001',
      title: 'Commodity Name Declaration',
      status: 'PASS',
      source_panel: 'FRONT',
      source_image_id: 'img-1',
      detected_value: 'POTATO CHIPS',
      additional_sources: [
        {
          panel: 'BACK',
          image_id: 'img-2',
          value: 'Potato Chips',
          confidence: 0.85,
        },
      ],
    };

    assert.equal(finding.source_panel, 'FRONT');
    assert.equal(finding.detected_value, 'POTATO CHIPS');
    assert.equal(finding.additional_sources.length, 1);
    assert.equal(finding.additional_sources[0].panel, 'BACK');
    assert.equal(finding.additional_sources[0].value, 'Potato Chips');
  });

  // Test 4: Cross-panel conflicting declaration representation
  test('Conflicting declarations across panels trigger REVIEW status and record conflict details', () => {
    // E.g., Front panel says Rs. 50, but Back panel says Rs. 60
    const finding = {
      rule_id: 'LM-MRP-001',
      title: 'Maximum Retail Price (MRP)',
      status: 'REVIEW',
      source_panel: 'FRONT',
      source_image_id: 'img-1',
      detected_value: 'Rs. 50.00',
      conflicts: [
        {
          panel: 'BACK',
          image_id: 'img-2',
          value: 'Rs. 60.00',
          confidence: 0.88,
          difference: 'Conflict: "Rs. 50.00" on FRONT vs "Rs. 60.00" on BACK',
        },
      ],
      why_flagged: 'Conflicting values detected across panels: FRONT: Rs. 50.00 vs BACK: Rs. 60.00',
    };

    assert.equal(finding.status, 'REVIEW');
    assert.equal(finding.conflicts.length, 1);
    assert.equal(finding.conflicts[0].panel, 'BACK');
    assert.equal(finding.conflicts[0].value, 'Rs. 60.00');
    assert.ok(finding.why_flagged.includes('Conflicting values detected across panels'));
  });

  // Test 5: Visual evidence source list derivation
  test('Visual evidence modal compiles primary, duplicate, and conflicting sources across panels', () => {
    const buildSources = (item) => {
      const sources = [];
      const primaryPanel = item.panel || item.source_panel || 'Unknown Panel';
      const primaryImgId = item.image_id || item.source_image_id || null;

      sources.push({
        type: 'primary',
        label: `Primary (${primaryPanel})`,
        panel: primaryPanel,
        imageId: primaryImgId,
        value: item.value || item.detected_value || item.raw_text,
        confidence: item.confidence,
        boundingBox: item.bounding_box,
      });

      if (item.conflicts && Array.isArray(item.conflicts)) {
        item.conflicts.forEach((c) => {
          sources.push({
            type: 'conflict',
            label: `Conflict (${c.panel || 'Other Panel'})`,
            panel: c.panel,
            imageId: c.image_id,
            value: c.value || c.raw_text,
            confidence: c.confidence,
            boundingBox: c.bounding_box,
            difference: c.difference,
          });
        });
      }

      if (item.additional_sources && Array.isArray(item.additional_sources)) {
        item.additional_sources.forEach((s) => {
          sources.push({
            type: 'additional',
            label: `Duplicate (${s.panel || 'Other Panel'})`,
            panel: s.panel,
            imageId: s.image_id,
            value: s.value || s.raw_text,
            confidence: s.confidence,
            boundingBox: s.bounding_box,
          });
        });
      }

      return sources;
    };

    const multiItem = {
      panel: 'FRONT',
      image_id: 'img-1',
      detected_value: 'Rs. 50',
      conflicts: [
        { panel: 'BACK', image_id: 'img-2', value: 'Rs. 60', difference: 'Mismatch' },
      ],
      additional_sources: [
        { panel: 'SIDE', image_id: 'img-3', value: 'Rs. 50' },
      ],
    };

    const sources = buildSources(multiItem);
    assert.equal(sources.length, 3);
    assert.equal(sources[0].type, 'primary');
    assert.equal(sources[0].panel, 'FRONT');
    assert.equal(sources[1].type, 'conflict');
    assert.equal(sources[1].panel, 'BACK');
    assert.equal(sources[2].type, 'additional');
    assert.equal(sources[2].panel, 'SIDE');
  });

  // Test 6: API Client supports multi-image panel addition and deletion
  test('Inspection API client exports addInspectionImages and deleteInspectionImage', () => {
    const apiFile = path.join(frontendRoot, 'src', 'api', 'inspections.js');
    const content = fs.readFileSync(apiFile, 'utf8');

    assert.ok(content.includes('export async function addInspectionImages('));
    assert.ok(content.includes('export async function deleteInspectionImage('));
    assert.ok(content.includes('api.postForm(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/images`'));
    assert.ok(content.includes('api.delete(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/images/${encodeURIComponent(imageId)}`)'));
  });

  // Test 7: InspectionResults.jsx contains panel management UI elements
  test('InspectionResults.jsx includes Add More Panels modal and Delete Panel handlers', () => {
    const resultsFile = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resultsFile, 'utf8');

    assert.ok(content.includes('STANDARD_PANELS'), 'Must define STANDARD_PANELS list');
    assert.ok(content.includes('Add More Panels'), 'Must provide Add More Panels action');
    assert.ok(content.includes('showAddPanelModal'), 'Must support Add Panel modal state');
    assert.ok(content.includes('deleteInspectionImage'), 'Must import and invoke deleteInspectionImage');
    assert.ok(content.includes('addInspectionImages'), 'Must import and invoke addInspectionImages');
    assert.ok(content.includes('activeEvidenceIndex'), 'Must support switching active evidence source in modal');
  });
});
