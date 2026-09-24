import React, { useState, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Info,
  Tag,
  MapPin,
  Calendar,
  DollarSign,
  Building,
  PhoneCall,
  Globe,
  Package,
} from 'lucide-react';
import { getInspectionImageUrl } from '../api/inspections';

// Icon mapping for standard declaration categories
const DECLARATION_ICONS = {
  mrp: DollarSign,
  'LM-MRP-001': DollarSign,
  net_quantity: Tag,
  'LM-NQ-001': Tag,
  product_name: Package,
  'LM-PN-001': Package,
  date_information: Calendar,
  'LM-DATE-001': Calendar,
  manufacturer: Building,
  'LM-MFG-001': Building,
  packer: Building,
  'LM-PCK-001': Building,
  importer: Building,
  'LM-IMP-001': Building,
  address: MapPin,
  'LM-ADDR-001': MapPin,
  consumer_care: PhoneCall,
  'LM-CARE-001': PhoneCall,
  country_of_origin: Globe,
  'LM-COO-001': Globe,
};

/**
 * ImageViewer
 *
 * Audit-grade Packaging Evidence Viewer.
 * Connects every compliance finding to its source image, panel, detected text,
 * confidence score, and exact localized bounding box (where available).
 *
 * Strictly adheres to non-fake coordinates:
 * If the OCR pipeline does not provide bounding-box coordinates for a declaration,
 * the viewer never creates fake boxes. Instead, it identifies the source image,
 * highlights the panel, displays the detected text, and clearly indicates that
 * visual coordinates were not provided by the OCR pipeline.
 */
export function ImageViewer({
  images = [],
  inspectionId,
  selectedEvidence = null,
  onSelectEvidence = null,
  showInspector = true,
  compact = false,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);
  const [imageLoadError, setImageLoadError] = useState(false);

  const currentImage = images[activeImageIndex] || images[0];

  // Reset load error when switching images or when image props update
  useEffect(() => {
    setImageLoadError(false);
  }, [activeImageIndex, currentImage?.image_id, currentImage?.preview, currentImage?.image_url]);

  // Sync active image with selectedEvidence panel or image_id
  useEffect(() => {
    if (selectedEvidence && images.length > 0) {
      let targetIdx = -1;

      // 1. Match by exact image_id
      if (selectedEvidence.image_id) {
        targetIdx = images.findIndex((img) => img.image_id === selectedEvidence.image_id);
      }

      // 2. Match by panel type
      if (targetIdx === -1 && selectedEvidence.panel) {
        targetIdx = images.findIndex(
          (img) => (img.panel || '').toUpperCase() === (selectedEvidence.panel || '').toUpperCase()
        );
      }

      if (targetIdx !== -1) {
        setActiveImageIndex(targetIdx);
      }
    }
  }, [selectedEvidence, images]);

  if (!images || images.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
        <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
        <p>No packaging panel images available for this session.</p>
      </div>
    );
  }

  // Resolve Image Source: preview > image_url > canonical endpoint URL
  const imageSrc =
    currentImage.preview ||
    (currentImage.image_url
      ? currentImage.image_url.startsWith('http')
        ? currentImage.image_url
        : getInspectionImageUrl(inspectionId, currentImage.image_id)
      : getInspectionImageUrl(inspectionId, currentImage.image_id));

  // Compile all valid evidence regions for the current active image
  const panelEvidence = useMemo(() => {
    const list = [...(currentImage.evidence || [])];

    // If selectedEvidence belongs to this image/panel but is not in currentImage.evidence, include it
    if (
      selectedEvidence &&
      (selectedEvidence.image_id === currentImage.image_id ||
        (selectedEvidence.panel && selectedEvidence.panel === currentImage.panel)) &&
      selectedEvidence.bounding_box
    ) {
      const alreadyPresent = list.some(
        (ev) =>
          ev.evidence_id === selectedEvidence.evidence_id ||
          (ev.rule_id === selectedEvidence.rule_id && ev.text === selectedEvidence.text)
      );
      if (!alreadyPresent) {
        list.push(selectedEvidence);
      }
    }

    return list.filter(
      (ev) => ev.bounding_box && (ev.bounding_box.ymin !== undefined || Array.isArray(ev.bounding_box))
    );
  }, [currentImage, selectedEvidence]);

  // Check if selectedEvidence is currently active on this panel
  const isSelectedOnCurrentPanel = Boolean(
    selectedEvidence &&
      (!selectedEvidence.image_id || selectedEvidence.image_id === currentImage.image_id ||
        (selectedEvidence.panel && (selectedEvidence.panel || '').toUpperCase() === (currentImage.panel || '').toUpperCase()))
  );

  const hasSelectedBBox = Boolean(
    isSelectedOnCurrentPanel &&
      selectedEvidence?.bounding_box &&
      (selectedEvidence.bounding_box.ymin !== undefined || Array.isArray(selectedEvidence.bounding_box))
  );

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const FieldIcon = selectedEvidence
    ? DECLARATION_ICONS[selectedEvidence.field] ||
      DECLARATION_ICONS[selectedEvidence.rule_id] ||
      Tag
    : Tag;

  return (
    <div className={`image-viewer-container ${compact ? 'viewer-compact' : ''}`}>
      {/* Evidence Viewer Top Header */}
      <div className="image-viewer-toolbar">
        {/* Panel Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.2rem' }}>
            Packaging Panels:
          </span>
          {images.map((img, idx) => {
            const isTarget =
              selectedEvidence &&
              (selectedEvidence.image_id === img.image_id ||
                (selectedEvidence.panel && (selectedEvidence.panel || '').toUpperCase() === (img.panel || '').toUpperCase()));

            return (
              <button
                key={img.image_id || idx}
                type="button"
                className={`btn btn-sm ${idx === activeImageIndex ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  position: 'relative',
                  fontWeight: isTarget ? 700 : 500,
                  boxShadow: isTarget && idx !== activeImageIndex ? '0 0 0 2px var(--primary-500)' : undefined,
                }}
                onClick={() => {
                  setActiveImageIndex(idx);
                  setZoomLevel(1);
                }}
              >
                <span>{img.panel || `Panel ${idx + 1}`}</span>
                {isTarget && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: idx === activeImageIndex ? '#FFFFFF' : 'var(--primary-500)',
                      marginLeft: '0.35rem',
                      display: 'inline-block',
                    }}
                    title="Active evidence target panel"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Zoom & Overlay Controls */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${showOverlays ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowOverlays(!showOverlays)}
            title="Toggle Bounding Box Overlays"
          >
            <Eye size={14} />
            <span>{showOverlays ? 'Hide Boxes' : 'Show Boxes'}</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '0.8rem', minWidth: '42px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetZoom} title="Reset Zoom">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Image Viewport with Bounding Box Overlays */}
      <div className="image-canvas-viewport">
        <div
          className="image-wrapper"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={imageSrc}
            alt={`Package panel ${currentImage.panel || currentImage.image_id}`}
            onError={(e) => {
              e.target.onerror = null;
              setImageLoadError(true);
              e.target.src =
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%231f2937" width="400" height="300"/><text fill="%23f87171" font-family="sans-serif" font-weight="600" font-size="14" x="50%" y="46%" text-anchor="middle">Unable to load package image.</text><text fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%" y="58%" text-anchor="middle">Please check connection or re-upload panel photo.</text></svg>';
            }}
          />

          {/* Bounding Box Overlays */}
          {showOverlays &&
            panelEvidence.map((ev, i) => {
              const bbox = ev.bounding_box;
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

              // Strict coordinate clamping within [0.0, 1.0]
              const clampedYmin = Math.max(0, Math.min(1, Number(ymin)));
              const clampedXmin = Math.max(0, Math.min(1, Number(xmin)));
              const clampedYmax = Math.max(clampedYmin, Math.min(1, Number(ymax)));
              const clampedXmax = Math.max(clampedXmin, Math.min(1, Number(xmax)));

              const isSelected =
                selectedEvidence &&
                (selectedEvidence.evidence_id === ev.evidence_id ||
                  selectedEvidence.rule_id === ev.rule_id ||
                  selectedEvidence.text === ev.text);

              const top = `${Number((clampedYmin * 100).toFixed(2))}%`;
              const left = `${Number((clampedXmin * 100).toFixed(2))}%`;
              const width = `${Math.max(Number(((clampedXmax - clampedXmin) * 100).toFixed(2)), 2)}%`;
              const height = `${Math.max(Number(((clampedYmax - clampedYmin) * 100).toFixed(2)), 2)}%`;

              return (
                <div
                  key={ev.evidence_id || i}
                  className={`bbox-overlay ${isSelected ? 'active' : ''}`}
                  style={{
                    top,
                    left,
                    width,
                    height,
                    border: isSelected ? '3px solid var(--primary-500)' : '2px solid rgba(59, 130, 246, 0.75)',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.22)' : 'rgba(59, 130, 246, 0.12)',
                    boxShadow: isSelected ? '0 0 16px rgba(16, 185, 129, 0.7)' : undefined,
                    zIndex: isSelected ? 25 : 10,
                  }}
                  onClick={() => onSelectEvidence && onSelectEvidence(ev)}
                  title={`[${ev.rule_id || 'Rule'}] ${ev.text || ev.field} (Confidence: ${Math.round((ev.confidence || 0) * 100)}%)`}
                >
                  <span
                    className="bbox-tag"
                    style={{
                      backgroundColor: isSelected ? 'var(--primary-600)' : 'rgba(30, 58, 138, 0.9)',
                      borderColor: isSelected ? 'var(--primary-500)' : '#3B82F6',
                    }}
                  >
                    {ev.rule_id || ev.field}: "{ev.text ? (ev.text.length > 22 ? ev.text.substring(0, 20) + '...' : ev.text) : ''}"
                  </span>
                </div>
              );
            })}

          {/* Non-fake coordinates indicator when target evidence lacks visual coordinates */}
          {isSelectedOnCurrentPanel && !hasSelectedBBox && selectedEvidence?.text && (
            <div className="bbox-missing-banner">
              <Info size={14} />
              <span>No bounding-box coordinates returned by OCR for this declaration (Full panel photo displayed)</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Bar */}
      <div className="image-viewer-footer">
        <div>
          <strong>File:</strong> {currentImage.filename || currentImage.image_id} &bull;{' '}
          <strong>Panel:</strong> {currentImage.panel || 'UNKNOWN'} &bull;{' '}
          <strong>Detected Boxes:</strong> {panelEvidence.length}
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {imageLoadError ? (
            <span style={{ color: '#F87171', fontWeight: 600 }}>Image load failed &bull; Unable to load package image.</span>
          ) : panelEvidence.length > 0 ? (
            <span>Normalized coordinates: <code style={{ color: 'var(--status-info-text)' }}>[ymin, xmin, ymax, xmax]</code></span>
          ) : (
            <span>No bounding-box coordinates in current view</span>
          )}
        </div>
      </div>

      {/* Dedicated Evidence Inspector Panel (Matches Exact Requested UI) */}
      {showInspector && selectedEvidence && (
        <div className="evidence-inspector-card">
          <div className="evidence-inspector-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <FieldIcon size={18} style={{ color: 'var(--primary-600)' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Evidence
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedEvidence.panel || currentImage.panel || 'Package'} panel
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="coverage-badge">
                {selectedEvidence.panel || currentImage.panel || 'Panel'} Panel
              </span>
              {selectedEvidence.rule_id && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--status-info-text)',
                  }}
                >
                  {selectedEvidence.rule_id}
                </span>
              )}
            </div>
          </div>

          <div className="evidence-inspector-body">
            {/* Highlighted region */}
            <div className="evidence-detail-group">
              <span className="evidence-detail-label">Highlighted region:</span>
              <div className="evidence-detail-value verbatim">
                {selectedEvidence.text || selectedEvidence.evidence_text || selectedEvidence.detected_value || 'No region text recorded'}
              </div>
            </div>

            {/* Detected text */}
            <div className="evidence-detail-group">
              <span className="evidence-detail-label">Detected text:</span>
              <div className="evidence-detail-value extracted">
                <strong>{selectedEvidence.detected_value || selectedEvidence.text || 'N/A'}</strong>
              </div>
            </div>

            {/* Source panel & OCR confidence */}
            <div className="evidence-meta-row">
              <div className="evidence-detail-group">
                <span className="evidence-detail-label">Source panel:</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {selectedEvidence.panel || currentImage.panel || 'Not specified'}
                </span>
              </div>

              <div className="evidence-detail-group">
                <span className="evidence-detail-label">OCR Confidence:</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--status-pass-text)', fontWeight: 600 }}>
                  {selectedEvidence.confidence !== undefined && selectedEvidence.confidence !== null
                    ? `${Math.round(selectedEvidence.confidence * 100)}%`
                    : 'Verified via OCR'}
                </span>
              </div>

              <div className="evidence-detail-group">
                <span className="evidence-detail-label">Coordinates Status:</span>
                <span style={{ fontSize: '0.8rem', color: hasSelectedBBox ? 'var(--status-pass-text)' : 'var(--text-muted)' }}>
                  {hasSelectedBBox ? (
                    <code>
                      {Array.isArray(selectedEvidence.bounding_box)
                        ? `[${selectedEvidence.bounding_box.map((n) => Number(n).toFixed(2)).join(', ')}]`
                        : `[${Number(selectedEvidence.bounding_box.ymin).toFixed(2)}, ${Number(selectedEvidence.bounding_box.xmin).toFixed(2)}, ${Number(selectedEvidence.bounding_box.ymax).toFixed(2)}, ${Number(selectedEvidence.bounding_box.xmax).toFixed(2)}]`}
                    </code>
                  ) : (
                    <em>Visual coordinates unavailable from OCR</em>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
