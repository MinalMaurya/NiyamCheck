import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Trash2,
  RotateCcw,
  Info,
  ShieldCheck,
  Eye,
  FileQuestion,
} from 'lucide-react';
import { createInspection } from '../api/inspections';
import { validateImageFile, optimizeImageForUpload } from '../utils/imageUtils';

const PANEL_PRESETS = [
  { value: 'FRONT', label: 'Front Panel (Product name & weight)' },
  { value: 'BACK', label: 'Back Panel (Details, MRP, date)' },
  { value: 'SIDE', label: 'Side Panel (Nutritional / Barcode)' },
  { value: 'OTHER', label: 'Price / Date Stamp' },
];

export function ConsumerCheck({ onInspectionCreated, onStartProcessing, onCancel, onLoadDemo, isOnline = true }) {
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState(0); // 0: Idle, 1: Uploading, 2: Scanning text, 3: Verifying rules
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetIdRef = useRef(null);
  const submissionLockRef = useRef(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
    };
  }, []);

  const processIncomingFiles = async (filesList) => {
    setError(null);
    const newItems = [];

    for (let i = 0; i < filesList.length; i++) {
      const originalFile = filesList[i];

      // Client-side format & size validation
      const validation = validateImageFile(originalFile);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      // Automatically optimize high-res phone camera shots for bandwidth and OCR sharpness
      let file = originalFile;
      try {
        file = await optimizeImageForUpload(originalFile);
      } catch (optErr) {
        console.warn('Image optimization skipped:', optErr);
      }

      // Assign default panel category based on current image count
      const currentCount = images.length + newItems.length;
      let defaultPanel = 'FRONT';
      if (currentCount === 1) defaultPanel = 'BACK';
      else if (currentCount === 2) defaultPanel = 'SIDE';
      else if (currentCount >= 3) defaultPanel = 'OTHER';

      newItems.push({
        id: `consumer-img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        panel: defaultPanel,
        filename: originalFile.name || `photo_${currentCount + 1}.jpg`,
        sizeFormatted: `${(originalFile.size / 1024).toFixed(0)} KB`,
      });
    }

    setImages((prev) => [...prev, ...newItems]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleCameraChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleReplaceFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0 && replaceTargetIdRef.current) {
      const targetId = replaceTargetIdRef.current;
      const originalFile = e.target.files[0];

      const validation = validateImageFile(originalFile);
      if (!validation.valid) {
        setError(validation.error);
        e.target.value = '';
        return;
      }

      let file = originalFile;
      try {
        file = await optimizeImageForUpload(originalFile);
      } catch (optErr) {
        console.warn('Optimization skipped on replace:', optErr);
      }

      setImages((prev) =>
        prev.map((item) => {
          if (item.id === targetId) {
            if (item.preview) URL.revokeObjectURL(item.preview);
            return {
              ...item,
              file,
              preview: URL.createObjectURL(file),
              filename: originalFile.name || 'replaced_photo.jpg',
              sizeFormatted: `${(originalFile.size / 1024).toFixed(0)} KB`,
            };
          }
          return item;
        })
      );
    }
    replaceTargetIdRef.current = null;
    e.target.value = '';
  };

  const triggerReplace = (id) => {
    replaceTargetIdRef.current = id;
    replaceInputRef.current?.click();
  };

  const handleRemoveImage = (id) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpdatePanel = (id, newPanel) => {
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, panel: newPanel } : item))
    );
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  // Submit product check to backend API
  const handleSubmitCheck = async () => {
    if (images.length === 0) {
      setError('Please add at least one product photo before continuing.');
      return;
    }

    const files = images.map((item) => item.file);
    // Map consumer panel tags to backend panel identifiers (FRONT, BACK, OTHER)
    const panels = images.map((item) => {
      if (item.panel === 'FRONT') return 'FRONT';
      if (item.panel === 'BACK') return 'BACK';
      if (item.panel === 'SIDE') return 'LEFT';
      return 'OTHER';
    });

    // If parent provides dedicated processing flow, delegate to it
    if (onStartProcessing) {
      onStartProcessing({ files, panels });
      return;
    }

    if (submissionLockRef.current) return;
    submissionLockRef.current = true;

    setIsSubmitting(true);
    setError(null);
    setSubmitStep(1); // Uploading

    try {
      // Advance step animation for user clarity
      const stepTimer1 = setTimeout(() => setSubmitStep(2), 700);
      const stepTimer2 = setTimeout(() => setSubmitStep(3), 1600);

      const session = await createInspection({ files, panels });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (onInspectionCreated && session?.inspection_id) {
        onInspectionCreated(session.inspection_id);
      } else {
        throw new Error('Server responded without a valid check ID.');
      }
    } catch (err) {
      setError(
        err.message ||
          'Unable to check product. Please ensure the backend server is running and try again.'
      );
      setIsSubmitting(false);
      setSubmitStep(0);
      submissionLockRef.current = false;
    }
  };

  // Render friendly processing / scanning view
  if (isSubmitting) {
    return (
      <div className="consumer-processing-wrap">
        <div className="consumer-processing-card">
          <div className="consumer-processing-icon-wrap">
            <RefreshCw size={36} className="spinning" style={{ color: '#10B981' }} />
          </div>

          <h2 className="consumer-processing-title">Checking Your Product...</h2>
          <p className="consumer-processing-subtitle">
            Analyzing package declarations under Indian Legal Metrology standards.
          </p>

          <div className="consumer-processing-steps">
            <div className={`consumer-processing-step ${submitStep >= 1 ? 'active' : ''}`}>
              <div className="consumer-step-dot" />
              <span>Uploading {images.length} package photo{images.length > 1 ? 's' : ''}...</span>
            </div>

            <div className={`consumer-processing-step ${submitStep >= 2 ? 'active' : ''}`}>
              <div className="consumer-step-dot" />
              <span>Reading labels & detecting text (MRP, Net Qty, Dates)...</span>
            </div>

            <div className={`consumer-processing-step ${submitStep >= 3 ? 'active' : ''}`}>
              <div className="consumer-step-dot" />
              <span>Verifying declarations against mandatory requirements...</span>
            </div>
          </div>

          <span className="consumer-processing-note">
            This typically takes just a few seconds.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="consumer-check-container">
      {/* Hidden File & Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCameraChange}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleReplaceFileChange}
      />

      {/* Top Navigation & Header */}
      <div className="consumer-check-header">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary btn-sm touch-btn"
            onClick={onCancel}
            style={{ marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span className="consumer-pill-tag">
            <ShieldCheck size={13} style={{ color: '#10B981' }} />
            Simple Product Check
          </span>
        </div>

        <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
          Check a Packaged Product
        </h1>
        <p className="page-description" style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0 }}>
          Take or upload photos of your product's packaging. We will read the label and verify mandatory details like MRP, Net Weight, Dates, and Manufacturer information.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="consumer-alert-notice error" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
          <div>
            <strong>Notice: </strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Upload / Capture Zone */}
      <div
        className={`consumer-upload-dropzone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="consumer-dropzone-icon-wrap">
          <Camera size={32} style={{ color: '#10B981' }} />
        </div>

        <h3 className="consumer-dropzone-title">
          Add Photos of the Product Packaging
        </h3>
        <p className="consumer-dropzone-desc">
          Drag & drop photos here, use your device camera, or browse files
        </p>

        {/* Primary Action Buttons */}
        <div className="consumer-dropzone-buttons">
          <button
            type="button"
            className="btn btn-primary touch-btn consumer-upload-cta"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera size={17} />
            <span>Take Photo</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary touch-btn consumer-upload-cta"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={17} />
            <span>Upload from Device</span>
          </button>
        </div>

        <span className="consumer-dropzone-hint">
          Supports JPEG, PNG, or WebP &bull; Max 20MB per photo
        </span>

        {/* Quick Demo Option */}
        {onLoadDemo && (
          <div className="consumer-demo-shortcut">
            <span>Don't have a package handy? </span>
            <button
              type="button"
              className="consumer-link-btn"
              onClick={onLoadDemo}
            >
              <Sparkles size={14} style={{ color: '#F59E0B' }} />
              <span>Try with sample Parle-G Biscuit package</span>
            </button>
          </div>
        )}
      </div>

      {/* Selected Photos Gallery */}
      {images.length > 0 && (
        <div className="consumer-photos-section">
          <div className="consumer-photos-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Selected Photos ({images.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Review, replace, or categorize your photos before checking
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm touch-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={15} />
              <span>Add Another Photo</span>
            </button>
          </div>

          <div className="consumer-photos-grid">
            {images.map((item, idx) => (
              <div key={item.id} className="consumer-photo-card">
                {/* Photo Thumbnail */}
                <div className="consumer-photo-thumb-wrap">
                  <img
                    src={item.preview}
                    alt={`Product preview ${idx + 1}`}
                    className="consumer-photo-thumb"
                  />
                  <span className="consumer-photo-number">#{idx + 1}</span>
                </div>

                {/* Photo Details & Controls */}
                <div className="consumer-photo-details">
                  <div className="consumer-photo-filename" title={item.filename}>
                    {item.filename}
                  </div>
                  <div className="consumer-photo-size">{item.sizeFormatted}</div>

                  {/* Panel selector dropdown */}
                  <label className="consumer-panel-select-label">
                    <span>Packaging Angle:</span>
                    <select
                      value={item.panel}
                      onChange={(e) => handleUpdatePanel(item.id, e.target.value)}
                      className="consumer-panel-select"
                    >
                      {PANEL_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Card Actions */}
                  <div className="consumer-photo-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs touch-btn"
                      onClick={() => triggerReplace(item.id)}
                      title="Replace this photo"
                    >
                      <RotateCcw size={12} />
                      <span>Replace</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-xs touch-btn consumer-delete-btn"
                      onClick={() => handleRemoveImage(item.id)}
                      title="Remove this photo"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helpful Guidance Card */}
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Info size={17} style={{ color: '#10B981' }} />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Tips for Getting the Best Check Results
          </h3>
        </div>

        <div className="consumer-capture-tips-grid">
          <div className="consumer-capture-tip">
            <strong>📸 Keep it Sharp</strong>
            <p>Ensure small numbers like MRP, weight, and date stamps are in clear focus.</p>
          </div>
          <div className="consumer-capture-tip">
            <strong>💡 Avoid Glare</strong>
            <p>Shiny foil or plastic can reflect flash or light. Tilt the pack slightly if needed.</p>
          </div>
          <div className="consumer-capture-tip">
            <strong>📐 Include the Whole Panel</strong>
            <p>Try to capture the entire face of the box or pouch without cutting off edges.</p>
          </div>
          <div className="consumer-capture-tip">
            <strong>📦 Add Both Front & Back</strong>
            <p>Front shows brand and weight; back usually contains MRP, date, and helpline.</p>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Submission Bar */}
      <div className="consumer-submit-bar">
        <div className="consumer-submit-info">
          {images.length === 0 ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Add at least 1 photo to start verification
            </span>
          ) : (
            <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
              Ready to verify {images.length} packaging photo{images.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="consumer-submit-buttons">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary touch-btn"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <span>Cancel</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary consumer-primary-btn touch-btn"
            disabled={images.length === 0 || isSubmitting}
            onClick={handleSubmitCheck}
          >
            <span>Check Product</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
