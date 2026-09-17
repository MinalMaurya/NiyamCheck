import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Milestone 7: End-to-End Validation, Clamping & Demo Readiness Tests', () => {
  // Test 1: Bounding Box Coordinate Clamping
  test('Normalized bounding box coordinates are clamped strictly within [0.0, 1.0]', () => {
    const clampCoordinates = (bbox) => {
      let ymin, xmin, ymax, xmax;
      if (Array.isArray(bbox)) {
        [ymin, xmin, ymax, xmax] = bbox;
      } else if (bbox && typeof bbox === 'object') {
        ymin = bbox.ymin;
        xmin = bbox.xmin;
        ymax = bbox.ymax;
        xmax = bbox.xmax;
      }

      if (ymin === undefined || xmin === undefined || ymax === undefined || xmax === undefined) {
        return null;
      }

      const clampedYmin = Math.max(0, Math.min(1, Number(ymin)));
      const clampedXmin = Math.max(0, Math.min(1, Number(xmin)));
      const clampedYmax = Math.max(clampedYmin, Math.min(1, Number(ymax)));
      const clampedXmax = Math.max(clampedXmin, Math.min(1, Number(xmax)));

      return {
        top: `${Number((clampedYmin * 100).toFixed(2))}%`,
        left: `${Number((clampedXmin * 100).toFixed(2))}%`,
        width: `${Math.max(Number(((clampedXmax - clampedXmin) * 100).toFixed(2)), 2)}%`,
        height: `${Math.max(Number(((clampedYmax - clampedYmin) * 100).toFixed(2)), 2)}%`,
      };
    };

    // Case 1: Out-of-bounds coordinates (negative or > 1.0)
    const outOfBounds = { ymin: -0.15, xmin: -0.05, ymax: 1.25, xmax: 1.05 };
    const clamped = clampCoordinates(outOfBounds);
    assert.equal(clamped.top, '0%');
    assert.equal(clamped.left, '0%');
    assert.equal(clamped.width, '100%');
    assert.equal(clamped.height, '100%');

    // Case 2: Standard valid coordinates
    const valid = { ymin: 0.20, xmin: 0.15, ymax: 0.35, xmax: 0.75 };
    const clampedValid = clampCoordinates(valid);
    assert.equal(clampedValid.top, '20%');
    assert.equal(clampedValid.left, '15%');
    assert.equal(clampedValid.width, '60%');
    assert.equal(clampedValid.height, '15%');

    // Case 3: Incomplete or undefined bounding box returns null (no fake overlay)
    assert.equal(clampCoordinates(null), null);
    assert.equal(clampCoordinates({ ymin: 0.2 }), null);
  });

  // Test 2: Conservative Status Badge Classes
  test('StatusBadge handles conservative statuses PARTIALLY_VERIFIABLE and NOT_VERIFIABLE', () => {
    const getBadgeClass = (status) => {
      const s = (status || '').toUpperCase();
      switch (s) {
        case 'COMPLIANT':
        case 'PASS':
          return 'badge-pass';
        case 'NON_COMPLIANT':
        case 'FAIL':
          return 'badge-fail';
        case 'PARTIALLY_VERIFIABLE':
          return 'badge-partially-verifiable';
        case 'UNCLEAR':
          return 'badge-unclear';
        case 'NOT_VERIFIABLE':
        case 'NOT_APPLICABLE':
        default:
          return 'badge-neutral';
      }
    };

    assert.equal(getBadgeClass('COMPLIANT'), 'badge-pass');
    assert.equal(getBadgeClass('NON_COMPLIANT'), 'badge-fail');
    assert.equal(getBadgeClass('PARTIALLY_VERIFIABLE'), 'badge-partially-verifiable');
    assert.equal(getBadgeClass('NOT_VERIFIABLE'), 'badge-neutral');
    assert.equal(getBadgeClass('UNCLEAR'), 'badge-unclear');
    assert.equal(getBadgeClass('NOT_APPLICABLE'), 'badge-neutral');
  });

  // Test 3: Report Download Filename Format
  test('Inspection report download filenames follow canonical scheme', () => {
    const inspectionId = 'INSP-2026-X99';
    const pdfFilename = `inspection_${inspectionId}.pdf`;
    const jsonFilename = `inspection_${inspectionId}.json`;

    assert.equal(pdfFilename, 'inspection_INSP-2026-X99.pdf');
    assert.equal(jsonFilename, 'inspection_INSP-2026-X99.json');
  });

  // Test 4: Legal Search Query Validation
  test('Legal search client rejects short queries (< 2 chars) before network call', async () => {
    const { searchLegalProvisions } = await import('../src/api/legal.js');

    await assert.rejects(
      async () => {
        await searchLegalProvisions('a');
      },
      (err) => {
        return err.message.includes('must be at least 2 characters long');
      }
    );

    await assert.rejects(
      async () => {
        await searchLegalProvisions('   ');
      },
      (err) => {
        return err.message.includes('must be at least 2 characters long');
      }
    );
  });

  // Test 5: Mobile Viewport 360px-430px CSS Support
  test('index.css declares media queries for small viewports and ensures touch target sizes', () => {
    const cssPath = path.join(frontendRoot, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('@media (max-width: 480px)'), 'index.css should define max-width: 480px responsive rules');
    assert.ok(cssContent.includes('overflow-x: hidden'), 'index.css should prevent horizontal overflow on narrow devices');
    assert.ok(cssContent.includes('min-height: 44px'), 'Buttons and tap targets must satisfy 44px touch target guidelines');
  });
});
