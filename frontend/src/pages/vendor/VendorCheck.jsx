import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  X,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import { createInspection } from '../../api/inspections';
import { createDemoPackageFiles } from '../../api/sampleData';
import { linkProductInspection, listProducts } from '../../api/products';
import { getVendorContext } from '../../context/vendorContext';
import { validateImageFile, optimizeImageForUpload } from '../../utils/imageUtils';

const STANDARD_PANELS = [
  { value: 'FRONT', label: 'Front Panel (Principal Display Panel)' },
  { value: 'BACK', label: 'Back Panel (Statutory Mandatory Info)' },
  { value: 'LEFT', label: 'Left Side Panel' },
  { value: 'RIGHT', label: 'Right Side Panel' },
  { value: 'TOP', label: 'Top Panel' },
  { value: 'BOTTOM', label: 'Bottom Panel' },
  { value: 'OTHER', label: 'Other / Crimp / Stamp Area' },
];

export function VendorCheck({
  initialProduct = null,
  onInspectionCompleted,
  onNavigate,
}) {
  const vendor = getVendorContext();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(
    initialProduct?.product_id || ''
  );
  const [images, setImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState(0); // 0: Idle, 1: Uploading, 2: Analyzing, 3: Completed
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const targetPanelRef = useRef(null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const list = await listProducts({ vendorId: vendor.vendor_id });
        setProducts(list || []);
        if (!selectedProductId && list && list.length > 0) {
          setSelectedProductId(list[0].product_id);
        }
      } catch (e) {
        console.warn('Could not load products for selection:', e);
      }
    }
    loadProducts();
  }, [vendor.vendor_id]);

  useEffect(() => {
    if (initialProduct?.product_id) {
      setSelectedProductId(initialProduct.product_id);
    }
  }, [initialProduct]);

  const processIncomingFiles = async (filesList) => {
    setError(null);
    const newItems = [];

    for (let i = 0; i < filesList.length; i++) {
      const originalFile = filesList[i];
      const validation = validateImageFile(originalFile);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      const file = await optimizeImageForUpload(originalFile);
      let defaultPanel = targetPanelRef.current;
      targetPanelRef.current = null;

      if (!defaultPanel) {
        const currentPanels = [
          ...images.map((img) => img.panel),
          ...newItems.map((img) => img.panel),
        ];
        const standardOrder = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];
        const missing = standardOrder.find((p) => !currentPanels.includes(p));
        defaultPanel = missing || 'OTHER';
      }

      newItems.push({
        id: `vend-img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        panel: defaultPanel,
        filename: file.name,
      });
    }

    setImages((prev) => [...prev, ...newItems]);
  };

  const handlePanelChange = (id, newPanel) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, panel: newPanel } : img))
    );
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

  const handleAddSpecificPanel = (panelId) => {
    targetPanelRef.current = panelId;
    fileInputRef.current?.click();
  };

  // Demo sample loader helper
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
      setError(`Failed to load demo package: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    if (submissionLockRef.current || isSubmitting) return;

    if (images.length === 0) {
      setError('Please upload at least one packaging panel image to inspect.');
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setSubmitPhase(1); // Uploading

    try {
      const rawFiles = images.map((item) => item.file);
      const panelTypes = images.map((item) => item.panel);

      setTimeout(() => {
        setSubmitPhase(2); // Analyzing with Legal Metrology Engine
      }, 400);

      // Reuses Minal's core inspection API directly
      const session = await createInspection({
        files: rawFiles,
        panels: panelTypes,
      });

      // Link inspection to selected product if a product was selected
      if (selectedProductId) {
        try {
          await linkProductInspection(selectedProductId, session.inspection_id);
        } catch (linkErr) {
          console.warn('Inspection executed, but product linking encountered:', linkErr);
        }
      }

      setSubmitPhase(3); // Completed
      setTimeout(() => {
        submissionLockRef.current = false;
        if (onInspectionCompleted) {
          onInspectionCompleted(session.inspection_id);
        }
      }, 500);
    } catch (err) {
      submissionLockRef.current = false;
      setIsSubmitting(false);
      setSubmitPhase(0);
      setError(err.message || 'Inspection failed. Please check network or file format.');
    }
  };

  const selectedProduct = products.find((p) => p.product_id === selectedProductId);

  return (
    <div className="vendor-check-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Run Vendor Compliance Check</h1>
          <p className="page-description">
            Upload pre-market packaging artwork or label photographs. NiyamCheck evaluates OCR declarations against the Legal Metrology (Packaged Commodities) Rules 2011.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--status-fail-bg)',
            border: '1px solid var(--status-fail-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-fail-text)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Product Selection Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={18} style={{ color: 'var(--primary-600)' }} />
          <span>Associated Product in Catalog</span>
        </h3>

        {products.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No products found in catalog. You can still inspect package panels as a standalone check.
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('vendor_products')}
            >
              Add Product to Catalog First
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                Select Product to Audit:
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">-- Standalone Check (No Product Association) --</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} ({p.brand_name} &bull; {p.product_code})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                }}
              >
                <div><strong>Category:</strong> {selectedProduct.category}</div>
                <div><strong>Code:</strong> {selectedProduct.product_code}</div>
                <div><strong>Current Status:</strong> {selectedProduct.status}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Package Panels Upload Area */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              Upload Packaging Panels ({images.length} added)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Multi-panel submission provides higher verification accuracy across Front, Back, and Side statutory declarations.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleLoadDemoSample('parle_g')}
            title="Load standard demo package for testing"
          >
            <Sparkles size={14} style={{ color: 'var(--primary-600)' }} />
            <span>Load Demo Package</span>
          </button>
        </div>

        {/* Quick Panel Slots Strip */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {STANDARD_PANELS.slice(0, 6).map((panel) => {
            const hasPanel = images.some((img) => img.panel === panel.value);
            return (
              <button
                key={panel.value}
                type="button"
                className={`btn btn-sm ${hasPanel ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={() => handleAddSpecificPanel(panel.value)}
              >
                {hasPanel ? <CheckCircle2 size={13} /> : <Plus size={13} />}
                <span>+ {panel.label.split(' ')[0]} Panel</span>
              </button>
            );
          })}
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) processIncomingFiles(e.dataTransfer.files);
          }}
          style={{
            border: '2px dashed var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            cursor: 'pointer',
            marginBottom: '1.5rem',
            transition: 'border-color 0.2s',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) processIncomingFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Upload size={36} style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Click to Browse or Drag & Drop Packaging Images
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Supported formats: JPEG, PNG, WebP &bull; Maximum resolution preserved for sharp OCR
          </p>
        </div>

        {/* Selected Images Grid */}
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#000' }}>
                  <img
                    src={img.preview}
                    alt={img.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                    title="Remove Image"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div style={{ padding: '0.65rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Panel Designation:
                  </label>
                  <select
                    value={img.panel}
                    onChange={(e) => handlePanelChange(img.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {STANDARD_PANELS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {images.length === 0 ? 'Add at least 1 image to begin' : `${images.length} panel image(s) ready for inspection`}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || images.length === 0}
            style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="spinning" />
                <span>
                  {submitPhase === 1
                    ? 'Uploading Images...'
                    : submitPhase === 2
                    ? 'Running OCR & Legal Rules...'
                    : 'Finalizing Audit...'}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Run NiyamCheck Inspection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
