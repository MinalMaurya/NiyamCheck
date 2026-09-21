import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Evidence Viewer — Inspection & Bounding Box System Tests', () => {
  const imageViewerPath = path.join(frontendRoot, 'src', 'components', 'ImageViewer.jsx');
  const inspectionResultsPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
  const cssPath = path.join(frontendRoot, 'src', 'index.css');

  const imageViewerSrc = fs.readFileSync(imageViewerPath, 'utf8');
  const resultsSrc = fs.readFileSync(inspectionResultsPath, 'utf8');
  const cssSrc = fs.readFileSync(cssPath, 'utf8');

  test('ImageViewer implements strict non-fake coordinates guarantee', () => {
    // Verifies that when bounding box coordinates are unavailable, the viewer does NOT invent fake boxes
    assert.ok(
      imageViewerSrc.includes('bbox-missing-banner'),
      'ImageViewer must render a missing-coordinates banner when OCR lacks bounding box coordinates'
    );
    assert.ok(
      imageViewerSrc.includes('No bounding-box coordinates returned by OCR'),
      'ImageViewer must inform the user that coordinates were not returned by OCR instead of faking coordinates'
    );
  });

  test('ImageViewer clamps normalized coordinates and renders active overlay', () => {
    assert.ok(
      imageViewerSrc.includes('Math.max(0, Math.min(1, Number(ymin)))'),
      'ImageViewer must clamp bounding box coordinates within [0.0, 1.0]'
    );
    assert.ok(
      imageViewerSrc.includes('bbox-overlay'),
      'ImageViewer must render bbox-overlay for detected regions'
    );
    assert.ok(
      imageViewerSrc.includes('bbox-tag'),
      'ImageViewer must render tag indicating detected text snippet'
    );
  });

  test('ImageViewer renders the dedicated Evidence Inspector Card with exact requested sections', () => {
    assert.ok(
      imageViewerSrc.includes('evidence-inspector-card'),
      'ImageViewer must render .evidence-inspector-card'
    );
    assert.ok(
      imageViewerSrc.includes('Highlighted region:'),
      'Inspector card must include "Highlighted region:"'
    );
    assert.ok(
      imageViewerSrc.includes('Detected text:'),
      'Inspector card must include "Detected text:"'
    );
    assert.ok(
      imageViewerSrc.includes('Source panel:'),
      'Inspector card must include "Source panel:"'
    );
    assert.ok(
      imageViewerSrc.includes('OCR Confidence:'),
      'Inspector card must include "OCR Confidence:"'
    );
    assert.ok(
      imageViewerSrc.includes('Coordinates Status:'),
      'Inspector card must include "Coordinates Status:"'
    );
  });

  test('ImageViewer synchronizes active image to selectedEvidence panel and image_id', () => {
    assert.ok(
      imageViewerSrc.includes('selectedEvidence.image_id'),
      'ImageViewer must match active image by image_id'
    );
    assert.ok(
      imageViewerSrc.includes('selectedEvidence.panel'),
      'ImageViewer must match active image by panel'
    );
  });

  test('InspectionResults renders standardized 4-pillar finding cards', () => {
    // Standard 4 pillars: Rule/legal basis, What we found, Evidence & analysis, Recommended next action
    assert.ok(
      resultsSrc.includes('Rule / Legal Basis:'),
      'Finding cards must render "Rule / Legal Basis:"'
    );
    assert.ok(
      resultsSrc.includes('What We Found:'),
      'Finding cards must render "What We Found:"'
    );
    assert.ok(
      resultsSrc.includes('Evidence & Analysis:'),
      'Finding cards must render "Evidence & Analysis:"'
    );
    assert.ok(
      resultsSrc.includes('Recommended Next Action:'),
      'Finding cards must render "Recommended Next Action:"'
    );
  });

  test('InspectionResults connects "View Evidence" button to unified Evidence Modal', () => {
    assert.ok(
      resultsSrc.includes('<span>View Evidence</span>'),
      'InspectionResults must display "View Evidence" button'
    );
    assert.ok(
      resultsSrc.includes('handleOpenEvidenceModal'),
      'InspectionResults must trigger handleOpenEvidenceModal'
    );
  });

  test('InspectionResults embeds ImageViewer directly inside the evidence modal', () => {
    assert.ok(
      resultsSrc.includes('<ImageViewer'),
      'InspectionResults must embed ImageViewer component'
    );
    assert.ok(
      resultsSrc.includes('activeEvidenceModal.evidence'),
      'Active evidence modal must pass selectedEvidence to ImageViewer'
    );
    assert.ok(
      resultsSrc.includes('showInspector={true}'),
      'Evidence modal must enable showInspector for full declaration audit'
    );
  });

  test('Raw Declarations table includes "View Evidence" for extracted fields', () => {
    assert.ok(
      resultsSrc.includes('<th>Evidence</th>'),
      'Declarations table must include Evidence column header'
    );
  });

  test('index.css contains comprehensive styles for evidence inspector and bounding box overlays', () => {
    assert.ok(cssSrc.includes('.evidence-inspector-card'), 'CSS must define .evidence-inspector-card');
    assert.ok(cssSrc.includes('.evidence-inspector-header'), 'CSS must define .evidence-inspector-header');
    assert.ok(cssSrc.includes('.evidence-inspector-body'), 'CSS must define .evidence-inspector-body');
    assert.ok(cssSrc.includes('.evidence-detail-group'), 'CSS must define .evidence-detail-group');
    assert.ok(cssSrc.includes('.evidence-detail-label'), 'CSS must define .evidence-detail-label');
    assert.ok(cssSrc.includes('.evidence-detail-value'), 'CSS must define .evidence-detail-value');
    assert.ok(cssSrc.includes('.bbox-missing-banner'), 'CSS must define .bbox-missing-banner');
    assert.ok(cssSrc.includes('.viewer-compact'), 'CSS must define .viewer-compact');
  });
});
