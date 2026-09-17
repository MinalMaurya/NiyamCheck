import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  X,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileUp,
  Save,
  FolderOpen,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { createInspection } from '../api/inspections';
import { createDemoPackageFiles } from '../api/sampleData';
import { draftStore } from '../storage/draftStore';
import { validateImageFile, optimizeImageForUpload } from '../utils/imageUtils';

const PANEL_OPTIONS = [
  { value: 'FRONT', label: 'Front Panel (Principal Display)' },
  { value: 'BACK', label: 'Back Panel (Statutory Info)' },
  { value: 'LEFT', label: 'Left Side' },
  { value: 'RIGHT', label: 'Right Side' },
  { value: 'TOP', label: 'Top Panel' },
  { value: 'BOTTOM', label: 'Bottom Panel' },
  { value: 'OTHER', label: 'Other / Stamp Area' },
];

export function CreateInspection({ onInspectionCreated, isOnline = true }) {
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState(0); // 0: Idle, 1: Uploading, 2: Analyzing, 3: Completed
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [saveDraftFeedback, setSaveDraftFeedback] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    loadSavedDrafts();
  }, []);

  const loadSavedDrafts = async () => {
    try {
      const saved = await draftStore.listDrafts();
      setDrafts(saved);
    } catch (e) {
      console.warn('Failed to load drafts:', e);
    }
  };

  const processIncomingFiles = async (filesList) => {
    setError(null);
    const newItems = [];

    for (let i = 0; i < filesList.length; i++) {
      const originalFile = filesList[i];

      // Validate image format and size
      const validation = validateImageFile(originalFile);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      // Optimize excessively large phone camera photos (preserves aspect ratio & OCR sharpness)
      const file = await optimizeImageForUpload(originalFile);

      // Guess panel based on existing panels
      let defaultPanel = 'FRONT';
      const existingPanels = images.map((img) => img.panel);
      if (existingPanels.includes('FRONT') && !existingPanels.includes('BACK')) {
        defaultPanel = 'BACK';
      } else if (existingPanels.includes('BACK')) {
        defaultPanel = 'OTHER';
      }

      newItems.push({
        id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        panel: defaultPanel,
        filename: file.name,
      });
    }

    setImages((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (id) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const target = prev.find((img) => img.id === id);
      if (target && target.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return filtered;
    });
  };

  const handlePanelChange = (id, newPanel) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, panel: newPanel } : img))
    );
  };

  // Save current workflow as a local draft in IndexedDB
  const handleSaveDraft = async () => {
    if (images.length === 0) {
      setError('Please add at least one image before saving a draft.');
      return;
    }

    try {
      const serializedImages = images.map((item) => ({
        id: item.id,
        panel: item.panel,
        filename: item.filename,
        fileBlob: item.file,
      }));

      const saved = await draftStore.saveDraft({
        draftId: activeDraftId,
        title: `Package Inspection (${images.length} panels)`,
        images: serializedImages,
      });

      setActiveDraftId(saved.draftId);
      setSaveDraftFeedback('Draft saved securely to your device.');
      setTimeout(() => setSaveDraftFeedback(null), 3000);
      loadSavedDrafts();
    } catch (err) {
      setError(`Failed to save draft: ${err.message}`);
    }
  };

  // Restore draft from IndexedDB
  const handleResumeDraft = (draft) => {
    // Revoke old previews
    images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));

    const restoredImages = (draft.images || []).map((item) => ({
      id: item.id,
      file: item.fileBlob,
      preview: URL.createObjectURL(item.fileBlob),
      panel: item.panel,
      filename: item.filename,
    }));

    setImages(restoredImages);
    setActiveDraftId(draft.draftId);
    setShowDraftsDrawer(false);
    setError(null);
  };

  const handleDeleteDraft = async (draftId, e) => {
    e.stopPropagation();
    await draftStore.deleteDraft(draftId);
    if (activeDraftId === draftId) setActiveDraftId(null);
    loadSavedDrafts();
  };

  // Demo sample loader for SIH judging
  const handleLoadDemoSample = async (type = 'parle_g') => {
    setError(null);
    try {
      const demoSamples = await createDemoPackageFiles(type);
      const newItems = demoSamples.map((s, idx) => ({
        id: `demo-${Date.now()}-${idx}`,
        file: s.file,
        preview: s.preview,
        panel: s.panel,
        filename: s.file.name,
      }));
      setImages(newItems);
    } catch (err) {
      setError(`Failed to generate demo sample: ${err.message}`);
    }
  };

  // Submit with duplicate submission protection & retry support
  const handleSubmit = async () => {
    // Duplicate submission guard
    if (submissionLockRef.current || isSubmitting) {
      return;
    }

    if (images.length === 0) {
      setError('Please upload or capture at least one packaging panel image to inspect.');
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setSubmitPhase(1); // Ingesting

    try {
      const rawFiles = images.map((item) => item.file);
      const panelTypes = images.map((item) => item.panel);

      setTimeout(() => {
        setSubmitPhase(2); // Analysis & Legal RAG
      }, 400);

      const session = await createInspection({
        files: rawFiles,
        panels: panelTypes,
      });

      // If this was from a draft, delete the draft upon successful submission
      if (activeDraftId) {
        await draftStore.deleteDraft(activeDraftId);
        loadSavedDrafts();
      }

      setSubmitPhase(3); // Complete
      setTimeout(() => {
        submissionLockRef.current = false;
        if (onInspectionCreated) {
          onInspectionCreated(session.inspection_id);
        }
      }, 500);
    } catch (err) {
      submissionLockRef.current = false;
      setIsSubmitting(false);
      setSubmitPhase(0);

      const stageInfo = err.stage ? `[Stage: ${err.stage.toUpperCase()}] ` : '';
      const codeInfo = err.errorCode ? `(${err.errorCode}) ` : '';
      const detailInfo = err.details && err.details !== err.message ? ` — ${err.details}` : '';
      const mainMsg = err.message || 'Network error';

      // Preserve images and notify user with structured retry and draft options
      setError(
        `Inspection submission failed: ${stageInfo}${codeInfo}${mainMsg}${detailInfo}. Your captured images have been preserved. You can retry or save as a draft.`
      );
    }
  };

  return (
    <div>
      {/* Hidden file inputs for Camera and Gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) processIncomingFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) processIncomingFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">New Package Inspection</h1>
          <p className="page-description">
            Capture or upload product packaging panels (Front, Back, Sides). NiyamCheck evaluates image quality, detects text regions, and verifies compliance against Legal Metrology Rules, 2011.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {drafts.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDraftsDrawer(!showDraftsDrawer)}
            >
              <FolderOpen size={16} />
              <span>Saved Drafts ({drafts.length})</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleLoadDemoSample('parle_g')}
            disabled={isSubmitting}
            title="Load Parle-G Biscuit front & back sample panels"
          >
            <Sparkles size={16} style={{ color: '#F59E0B' }} />
            <span>Load Demo Sample</span>
          </button>
        </div>
      </div>

      {/* Save Draft Feedback Notification */}
      {saveDraftFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            borderRadius: 'var(--radius-md)',
            color: '#34D399',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{saveDraftFeedback}</span>
        </div>
      )}

      {/* Error & Retry Alert */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FCA5A5',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: '#EF4444', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>

          {/* Quick Actions after failure */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {images.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isOnline}
                >
                  <RotateCcw size={14} />
                  <span>Retry Submission</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSaveDraft}
                >
                  <Save size={14} />
                  <span>Save Images as Draft</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Saved Drafts Drawer */}
      {showDraftsDrawer && drafts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Local Inspection Drafts</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDraftsDrawer(false)}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {drafts.map((d) => (
              <div
                key={d.draftId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>{d.title}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {d.images?.length || 0} panels &bull; Updated{' '}
                    {new Date(d.updatedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleResumeDraft(d)}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={(e) => handleDeleteDraft(d.draftId, e)}
                    title="Delete Draft"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress View during Active Submission */}
      {isSubmitting ? (
        <div className="card" style={{ maxWidth: '650px', margin: '2rem auto', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <RefreshCw size={42} className="spinning" style={{ margin: '0 auto 1rem', color: 'var(--primary-500)' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              Analyzing Product Packaging
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
              Executing deterministic Legal Metrology compliance pipeline
            </p>
          </div>

          <div className="stepper-container">
            <div className="stepper-item">
              <div className={`stepper-icon ${submitPhase >= 1 ? (submitPhase > 1 ? 'completed' : 'current') : 'pending'}`}>
                {submitPhase > 1 ? <CheckCircle2 size={16} /> : '1'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Ingesting Package Panel Images ({images.length} uploaded)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Transmitting multi-angle photos to FastAPI backend
                </div>
              </div>
            </div>

            <div className="stepper-item">
              <div className={`stepper-icon ${submitPhase >= 2 ? (submitPhase > 2 ? 'completed' : 'current') : 'pending'}`}>
                {submitPhase > 2 ? <CheckCircle2 size={16} /> : '2'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Image Quality Assessment & OCR Text Localization
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Evaluating sharpness and localizing candidate bounding coordinates
                </div>
              </div>
            </div>

            <div className="stepper-item">
              <div className={`stepper-icon ${submitPhase >= 2 ? (submitPhase > 2 ? 'completed' : 'current') : 'pending'}`}>
                {submitPhase > 2 ? <CheckCircle2 size={16} /> : '3'}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Deterministic Compliance Engine & Legal Knowledge Retrieval
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Auditing statutory declarations against Gazette provisions
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Image Capture & Management View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Mobile-Friendly Capture & Dropzone Options */}
          <div
            className="card"
            style={{
              padding: '2.5rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '2px dashed var(--border-default)',
              transition: 'border-color 0.2s ease',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Camera size={44} style={{ color: 'var(--primary-500)', marginBottom: '0.75rem', opacity: 0.95 }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Add Packaging Images
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '480px', marginBottom: '1.5rem' }}>
              Take photos directly with your phone's camera in the field or choose high-resolution packaging scans from your gallery.
            </p>

            {/* Action Buttons with 44px+ comfortable mobile touch targets */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary touch-btn"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={18} />
                <span>Take Photo (Camera)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary touch-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={18} />
                <span>Choose from Gallery</span>
              </button>
            </div>
          </div>

          {/* Uploaded / Captured Image Cards */}
          {images.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    Package Panels ({images.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Assign panel view to each photo for multi-image declaration aggregation
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSaveDraft}
                    title="Save current images locally to continue later"
                  >
                    <Save size={14} />
                    <span>Save Draft</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    {/* Thumbnail Preview */}
                    <div
                      style={{
                        height: '180px',
                        backgroundColor: '#0F172A',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <img
                        src={item.preview}
                        alt={`Panel ${item.panel}`}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Metadata */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.filename}
                      >
                        {item.filename}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Panel #{idx + 1} &bull; {(item.file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>

                    {/* Panel Selection */}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Panel:
                      </label>
                      <select
                        value={item.panel}
                        onChange={(e) => handlePanelChange(item.id, e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.4rem 0.5rem',
                          fontSize: '0.8rem',
                          outline: 'none',
                        }}
                      >
                        {PANEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveImage(item.id)}
                        title="Remove panel"
                        style={{ padding: '0.4rem 0.55rem' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start Analysis CTA & Guard */}
              <div
                style={{
                  marginTop: '2rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.85rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary touch-btn"
                  onClick={() => {
                    images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
                    setImages([]);
                    setActiveDraftId(null);
                  }}
                  disabled={isSubmitting}
                >
                  Clear All
                </button>

                <button
                  type="button"
                  className="btn btn-primary touch-btn"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{ padding: '0.75rem 2rem', fontSize: '0.95rem' }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spinning" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Package ({images.length} Panels)</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
