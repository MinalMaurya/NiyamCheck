import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Inspection Coverage Feature — Frontend Tests', () => {
  const STANDARD_6_PANELS = [
    { id: 'FRONT', label: 'Front', priority: 'high' },
    { id: 'BACK', label: 'Back', priority: 'high' },
    { id: 'LEFT', label: 'Left', priority: 'medium' },
    { id: 'RIGHT', label: 'Right', priority: 'medium' },
    { id: 'TOP', label: 'Top', priority: 'low' },
    { id: 'BOTTOM', label: 'Bottom', priority: 'low' },
  ];

  // Helper simulating the InspectionCoverageCard panel item calculation
  function computeCoverageItems(coverage, images = []) {
    return STANDARD_6_PANELS.map((p) => {
      let captured = false;
      let imageId = null;
      let uploadStatus = 'not_captured';
      let ocrStatus = 'pending';

      if (coverage && Array.isArray(coverage.panels)) {
        const covItem = coverage.panels.find((item) => (item.panel || '').toUpperCase() === p.id);
        if (covItem) {
          captured = covItem.captured;
          imageId = covItem.image_id;
          uploadStatus = covItem.upload_status || (captured ? 'captured' : 'not_captured');
          ocrStatus = covItem.ocr_status || (captured ? 'completed' : 'pending');
        }
      } else if (images && images.length > 0) {
        const match = images.find((img) => (img.panel || '').toUpperCase() === p.id);
        if (match) {
          captured = true;
          imageId = match.id || match.image_id;
          uploadStatus = match.upload_status || 'captured';
          ocrStatus = match.ocr_status || 'completed';
        }
      }

      return {
        id: p.id,
        label: p.label,
        priority: p.priority,
        captured,
        imageId,
        uploadStatus,
        ocrStatus,
      };
    });
  }

  test('Inspection coverage handles 0 captured images safely', () => {
    const items = computeCoverageItems(null, []);
    assert.equal(items.length, 6);
    const capturedCount = items.filter((i) => i.captured).length;
    assert.equal(capturedCount, 0);
    assert.equal(Math.round((capturedCount / items.length) * 100), 0);
    items.forEach((item) => {
      assert.equal(item.captured, false);
      assert.equal(item.uploadStatus, 'not_captured');
      assert.equal(item.ocrStatus, 'pending');
    });
  });

  test('Inspection coverage handles 1 captured panel correctly', () => {
    const images = [{ id: 'img-front', panel: 'FRONT', upload_status: 'captured', ocr_status: 'completed' }];
    const items = computeCoverageItems(null, images);
    const captured = items.filter((i) => i.captured);
    const missing = items.filter((i) => !i.captured);

    assert.equal(captured.length, 1);
    assert.equal(missing.length, 5);
    assert.equal(captured[0].id, 'FRONT');
    assert.equal(captured[0].imageId, 'img-front');
    assert.equal(captured[0].uploadStatus, 'captured');
    assert.equal(captured[0].ocrStatus, 'completed');

    // Missing panels have clear not_captured status
    missing.forEach((m) => {
      assert.equal(m.captured, false);
      assert.equal(m.uploadStatus, 'not_captured');
    });
  });

  test('Inspection coverage computes 3 of 6 panels as requested in user prompt', () => {
    const images = [
      { id: 'img-front', panel: 'FRONT' },
      { id: 'img-back', panel: 'BACK' },
      { id: 'img-left', panel: 'LEFT' },
    ];
    const items = computeCoverageItems(null, images);
    const capturedCount = items.filter((i) => i.captured).length;

    assert.equal(capturedCount, 3);
    assert.equal(items.length, 6);
    const percentage = Math.round((capturedCount / items.length) * 100);
    assert.equal(percentage, 50);

    const front = items.find((i) => i.id === 'FRONT');
    const back = items.find((i) => i.id === 'BACK');
    const left = items.find((i) => i.id === 'LEFT');
    const right = items.find((i) => i.id === 'RIGHT');
    const top = items.find((i) => i.id === 'TOP');
    const bottom = items.find((i) => i.id === 'BOTTOM');

    assert.equal(front.captured, true);
    assert.equal(back.captured, true);
    assert.equal(left.captured, true);
    assert.equal(right.captured, false);
    assert.equal(top.captured, false);
    assert.equal(bottom.captured, false);
  });

  test('Inspection coverage consumes backend coverage object with panel metadata', () => {
    const backendCoverage = {
      total_panels_expected: 6,
      panels_captured: 6,
      coverage_percentage: 100.0,
      is_complete: true,
      panels: STANDARD_6_PANELS.map((p, idx) => ({
        panel: p.id,
        captured: true,
        image_id: `img-${idx + 1}`,
        upload_status: 'captured',
        ocr_status: 'completed',
      })),
      missing_panels: [],
    };

    const items = computeCoverageItems(backendCoverage);
    assert.equal(items.filter((i) => i.captured).length, 6);
    items.forEach((item, idx) => {
      assert.equal(item.captured, true);
      assert.equal(item.imageId, `img-${idx + 1}`);
      assert.equal(item.uploadStatus, 'captured');
      assert.equal(item.ocrStatus, 'completed');
    });
  });

  test('Non-accusatory missing panel wording is verified', () => {
    const requiredPhrase = 'Unable to verify from captured evidence because the relevant package panel was not captured.';
    
    // Check aggregator.py contains the exact required wording
    const aggregatorPath = path.resolve(frontendRoot, '../backend/inspections/aggregator.py');
    const aggregatorContent = fs.readFileSync(aggregatorPath, 'utf8');
    assert.ok(
      aggregatorContent.includes(requiredPhrase),
      'Aggregator must include the exact missing panel phrase requested by the user'
    );
  });

  test('StatusBadge handles UNABLE_TO_VERIFY and INSUFFICIENT_EVIDENCE cleanly', () => {
    const badgePath = path.resolve(frontendRoot, 'src/components/StatusBadge.jsx');
    const badgeContent = fs.readFileSync(badgePath, 'utf8');
    assert.ok(badgeContent.includes('UNABLE_TO_VERIFY'), 'StatusBadge must support UNABLE_TO_VERIFY');
    assert.ok(badgeContent.includes('INSUFFICIENT_EVIDENCE'), 'StatusBadge must support INSUFFICIENT_EVIDENCE');
    assert.ok(badgeContent.includes('badge-not-verifiable'), 'StatusBadge must map to badge-not-verifiable');
  });

  test('CreateInspection and InspectionResults include InspectionCoverageCard', () => {
    const createPath = path.resolve(frontendRoot, 'src/pages/CreateInspection.jsx');
    const createContent = fs.readFileSync(createPath, 'utf8');
    assert.ok(createContent.includes('InspectionCoverageCard'), 'CreateInspection must render InspectionCoverageCard');

    const resultsPath = path.resolve(frontendRoot, 'src/pages/InspectionResults.jsx');
    const resultsContent = fs.readFileSync(resultsPath, 'utf8');
    assert.ok(resultsContent.includes('InspectionCoverageCard'), 'InspectionResults must render InspectionCoverageCard');
    assert.ok(resultsContent.includes('Unable to Verify / Insufficient Evidence'), 'InspectionResults must have Unable to Verify filter');
  });
});
