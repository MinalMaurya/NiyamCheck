import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Layers, Eye } from 'lucide-react';
import { getInspectionImageUrl } from '../api/inspections';

export function ImageViewer({
  images = [],
  inspectionId,
  selectedEvidence = null,
  onSelectEvidence = null,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showOverlays, setShowOverlays] = useState(true);

  // Sync active image with selectedEvidence panel/image_id
  useEffect(() => {
    if (selectedEvidence && images.length > 0) {
      const idx = images.findIndex(
        (img) =>
          img.image_id === selectedEvidence.image_id ||
          (selectedEvidence.panel && img.panel === selectedEvidence.panel)
      );
      if (idx !== -1) {
        setActiveImageIndex(idx);
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

  const currentImage = images[activeImageIndex] || images[0];

  // Image source: try image_url first, or construct from inspectionId + image_id, or preview
  const imageSrc =
    currentImage.preview ||
    (currentImage.image_url
      ? (currentImage.image_url.startsWith('http') ? currentImage.image_url : getInspectionImageUrl(inspectionId, currentImage.image_id))
      : getInspectionImageUrl(inspectionId, currentImage.image_id));

  // Filter evidence that corresponds to this image/panel
  const panelEvidence = (currentImage.evidence || []).filter(
    (ev) => ev.bounding_box && (ev.bounding_box.ymin !== undefined || Array.isArray(ev.bounding_box))
  );

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="image-viewer-container">
      {/* Top Toolbar */}
      <div className="image-viewer-toolbar">
        {/* Panel Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.35rem' }}>Panels:</span>
          {images.map((img, idx) => (
            <button
              key={img.image_id || idx}
              type="button"
              className={`btn btn-sm ${idx === activeImageIndex ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setActiveImageIndex(idx);
                setZoomLevel(1);
              }}
            >
              {img.panel || `Panel ${idx + 1}`}
            </button>
          ))}
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

      {/* Main Image Viewport */}
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
              // Fallback placeholder if image load fails
              e.target.onerror = null;
              e.target.src =
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%231f2937" width="400" height="300"/><text fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle">Image binary unavailable for offline session</text></svg>';
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

              // Milestone 7 Hardening: Strict bounding box coordinate clamping [0.0, 1.0]
              const clampedYmin = Math.max(0, Math.min(1, Number(ymin)));
              const clampedXmin = Math.max(0, Math.min(1, Number(xmin)));
              const clampedYmax = Math.max(clampedYmin, Math.min(1, Number(ymax)));
              const clampedXmax = Math.max(clampedXmin, Math.min(1, Number(xmax)));

              const isSelected = selectedEvidence && (selectedEvidence.evidence_id === ev.evidence_id || selectedEvidence.rule_id === ev.rule_id);

              const top = `${Number((clampedYmin * 100).toFixed(2))}%`;
              const left = `${Number((clampedXmin * 100).toFixed(2))}%`;
              const width = `${Math.max(Number(((clampedXmax - clampedXmin) * 100).toFixed(2)), 2)}%`;
              const height = `${Math.max(Number(((clampedYmax - clampedYmin) * 100).toFixed(2)), 2)}%`;

              return (
                <div
                  key={ev.evidence_id || i}
                  className={`bbox-overlay ${isSelected ? 'active' : ''}`}
                  style={{ top, left, width, height }}
                  onClick={() => onSelectEvidence && onSelectEvidence(ev)}
                  title={`[${ev.rule_id || 'Rule'}] ${ev.text || ev.field} (Confidence: ${Math.round((ev.confidence || 0) * 100)}%)`}
                >
                  <span className="bbox-tag">
                    {ev.rule_id || ev.field}: "{ev.text ? (ev.text.length > 20 ? ev.text.substring(0, 18) + '...' : ev.text) : ''}"
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Footer Info Bar */}
      <div
        style={{
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <strong>File:</strong> {currentImage.filename || currentImage.image_id} &bull;{' '}
          <strong>Panel:</strong> {currentImage.panel || 'UNKNOWN'} &bull;{' '}
          <strong>Detected Boxes:</strong> {panelEvidence.length}
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          Normalized coordinates: <code style={{ color: '#93C5FD' }}>[ymin, xmin, ymax, xmax]</code>
        </div>
      </div>
    </div>
  );
}
