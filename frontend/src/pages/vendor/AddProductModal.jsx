import React, { useState, useEffect } from 'react';
import { X, Package, Tag, Building2, Barcode, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { createProduct, updateProduct } from '../../api/products';
import { getVendorContext } from '../../context/vendorContext';

export const PRODUCT_CATEGORIES = [
  'Food & Beverages',
  'Cosmetics & Personal Care',
  'Electronics & Electrical',
  'Pharmaceuticals & Healthcare',
  'Household Goods',
  'Apparel & Textiles',
  'Automotive & Hardware',
  'General Commodity',
];

export function AddProductModal({ isOpen, onClose, onSuccess, initialProduct = null }) {
  const vendor = getVendorContext();
  const isEdit = Boolean(initialProduct && initialProduct.product_id);

  const [formData, setFormData] = useState({
    product_name: '',
    brand_name: '',
    category: PRODUCT_CATEGORIES[0],
    product_code: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialProduct) {
      setFormData({
        product_name: initialProduct.product_name || '',
        brand_name: initialProduct.brand_name || '',
        category: initialProduct.category || PRODUCT_CATEGORIES[0],
        product_code: initialProduct.product_code || '',
        description: initialProduct.description || '',
      });
    } else {
      setFormData({
        product_name: '',
        brand_name: vendor.brand_portfolio?.[0] || '',
        category: PRODUCT_CATEGORIES[0],
        product_code: '',
        description: '',
      });
    }
    setError(null);
  }, [initialProduct, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_name.trim()) {
      setError('Product Name is required.');
      return;
    }
    if (!formData.brand_name.trim()) {
      setError('Brand Name is required.');
      return;
    }
    if (!formData.category.trim()) {
      setError('Category is required.');
      return;
    }
    if (!formData.product_code.trim()) {
      setError('Product Code (SKU or Barcode) is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (isEdit) {
        result = await updateProduct(initialProduct.product_id, {
          product_name: formData.product_name.trim(),
          brand_name: formData.brand_name.trim(),
          category: formData.category.trim(),
          product_code: formData.product_code.trim(),
          description: formData.description.trim() || null,
        });
      } else {
        result = await createProduct({
          product_name: formData.product_name.trim(),
          brand_name: formData.brand_name.trim(),
          category: formData.category.trim(),
          product_code: formData.product_code.trim(),
          description: formData.description.trim() || null,
          vendor_id: vendor.vendor_id,
        });
      }
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '580px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <Package size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                {isEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Registered under {vendor.company_name} ({vendor.vendor_id})
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close modal"
            style={{ padding: '0.35rem 0.5rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-fail-bg)',
              border: '1px solid var(--status-fail-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-fail-text)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
            }}
            role="alert"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Product Name <span style={{ color: 'var(--status-fail-border)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleChange}
                  placeholder="e.g. Parle-G Gold Biscuits 250g"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Brand Name <span style={{ color: 'var(--status-fail-border)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="brand_name"
                  value={formData.brand_name}
                  onChange={handleChange}
                  placeholder="e.g. Parle"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Category <span style={{ color: 'var(--status-fail-border)' }}>*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Product Code / SKU / Barcode <span style={{ color: 'var(--status-fail-border)' }}>*</span>
              </label>
              <input
                type="text"
                name="product_code"
                value={formData.product_code}
                onChange={handleChange}
                placeholder="e.g. 8901063012345 or SKU-PAR-001"
                required
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Notes / Packaging Details (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="e.g. Standard 6-panel retail pouch packaging, revised for Legal Metrology amendment."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <span>{isEdit ? 'Update Product' : 'Register Product'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
