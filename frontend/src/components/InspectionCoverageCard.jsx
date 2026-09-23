import React from 'react';
import { CheckCircle2, AlertTriangle, Circle, Plus, Info, ShieldCheck } from 'lucide-react';

export const STANDARD_6_PANELS = [
  { id: 'FRONT', label: 'Front', priority: 'high', description: 'Principal display panel (product name, net quantity)' },
  { id: 'BACK', label: 'Back', priority: 'high', description: 'Mandatory statutory panel (MRP, MFD, manufacturer, consumer care)' },
  { id: 'LEFT', label: 'Left', priority: 'medium', description: 'Side declarations, bar codes, or nutrition facts' },
  { id: 'RIGHT', label: 'Right', priority: 'medium', description: 'Side declarations, consumer instructions' },
  { id: 'TOP', label: 'Top', priority: 'low', description: 'Top seal, date stamping, batch codes' },
  { id: 'BOTTOM', label: 'Bottom', priority: 'low', description: 'Bottom base, date stamping, best before' },
];

/**
 * InspectionCoverageCard
 *
 * Displays packaging coverage across standard package panels.
 * Accepts either:
 *  - coverage: backend InspectionCoverage object
 *  - images: array of image objects ({ id, panel, file, upload_status, ocr_status, etc. })
 *
 * Distinguishes:
 *  1. Declaration actually checked and found
 *  2. Declaration checked but not found on captured panels
 *  3. Package panel was never captured, so declaration cannot confidently be verified
 */
export function InspectionCoverageCard({
  coverage,
  images = [],
  onAddPanel,
  interactive = false,
  compact = false,
}) {
  // Derive panel items either from pre-computed backend coverage or frontend images list
  const panelItems = STANDARD_6_PANELS.map((p) => {
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
      description: p.description,
      captured,
      imageId,
      uploadStatus,
      ocrStatus,
    };
  });

  const capturedCount = panelItems.filter((p) => p.captured).length;
  const totalCount = panelItems.length;
  const percentage = Math.round((capturedCount / totalCount) * 100);

  return (
    <div className={`coverage-card ${compact ? 'coverage-card-compact' : ''}`}>
      <div className="coverage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--primary-600)' }} />
          <h3 className="coverage-title">Inspection Coverage</h3>
        </div>
        <span className="coverage-badge">
          {capturedCount} / {totalCount} panels captured ({percentage}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="coverage-progress-track" aria-hidden="true">
        <div
          className="coverage-progress-bar"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              percentage === 100
                ? 'var(--status-pass-border)'
                : percentage >= 50
                ? 'var(--primary-500)'
                : 'var(--status-partial-border)',
          }}
        />
      </div>

      {/* Panel List */}
      <div className="coverage-panel-list">
        {panelItems.map((item) => {
          if (item.captured) {
            return (
              <div key={item.id} className="coverage-panel-item captured">
                <span className="coverage-icon pass" title="Panel captured">
                  <CheckCircle2 size={16} />
                </span>
                <div className="coverage-item-info">
                  <span className="coverage-panel-name">
                    <strong>✓ {item.label}</strong>
                  </span>
                  <span className="coverage-item-meta">
                    {item.imageId ? `ID: ${item.imageId}` : 'Captured'} &bull; OCR: {item.ocrStatus}
                  </span>
                </div>
              </div>
            );
          }

          // Uncaptured panels: high/medium priority show warning icon (⚠), low priority show circle (○)
          const isHighPriority = item.priority === 'high' || item.priority === 'medium';

          return (
            <div
              key={item.id}
              className={`coverage-panel-item missing ${interactive && onAddPanel ? 'clickable' : ''}`}
              onClick={() => {
                if (interactive && onAddPanel) {
                  onAddPanel(item.id);
                }
              }}
              title={item.description}
            >
              <span className={`coverage-icon ${isHighPriority ? 'warning' : 'neutral'}`}>
                {isHighPriority ? <AlertTriangle size={15} /> : <Circle size={14} />}
              </span>
              <div className="coverage-item-info">
                <span className="coverage-panel-name">
                  {isHighPriority ? (
                    <span>
                      ⚠ <strong>{item.label}</strong> — not captured
                    </span>
                  ) : (
                    <span>
                      ○ <strong>{item.label}</strong> — not captured
                    </span>
                  )}
                </span>
                <span className="coverage-item-meta text-muted">
                  {item.description}
                </span>
              </div>
              {interactive && onAddPanel && (
                <button
                  type="button"
                  className="btn btn-xs btn-secondary add-panel-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPanel(item.id);
                  }}
                  title={`Add ${item.label} Panel`}
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Educational helper note */}
      <div className="coverage-footer-note">
        <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
        <span>
          <strong>Partial coverage is supported.</strong> Do not force all six images.
          Missing panels are not treated as violations — unobserved declarations will be categorized as
          {' '}<em style={{ color: 'var(--text-primary)' }}>Unable to Verify</em> due to insufficient evidence.
        </span>
      </div>
    </div>
  );
}
