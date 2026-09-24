import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Package,
  Building2,
  Calendar,
  Barcode,
  Tag,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Edit2,
  Eye,
  ExternalLink,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { getProduct } from '../../api/products';
import { getInspection, getInspectionImageUrl } from '../../api/inspections';
import { StatusBadge } from '../../components/StatusBadge';
import { AddProductModal } from './AddProductModal';

export function ProductDetails({ productId, onBack, onNavigate, onStartCheckForProduct, onOpenInspection }) {
  const [product, setProduct] = useState(null);
  const [latestSession, setLatestSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchDetails = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const prod = await getProduct(productId);
      setProduct(prod);

      if (prod.latest_inspection_id) {
        try {
          const session = await getInspection(prod.latest_inspection_id);
          setLatestSession(session);
        } catch (e) {
          console.warn('Could not load latest inspection session:', e);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [productId]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 0.75rem' }} />
        <div>Loading product details...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--status-fail-text)', marginBottom: '1rem' }}>
          {error || 'Product not found.'}
        </p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Products</span>
        </button>
      </div>
    );
  }

  return (
    <div className="product-details-page">
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Products</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit2 size={14} />
            <span>Edit Product</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (onStartCheckForProduct) onStartCheckForProduct(product);
              onNavigate('vendor_check');
            }}
          >
            <ShieldCheck size={14} />
            <span>Run Compliance Check</span>
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--primary-600)',
                  backgroundColor: 'var(--primary-50)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--primary-100)',
                }}
              >
                {product.category}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Code: <strong>{product.product_code}</strong>
              </span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              {product.product_name}
            </h1>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Brand: <strong>{product.brand_name}</strong> &bull; Vendor ID: {product.vendor_id}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Compliance Status
            </div>
            <StatusBadge status={product.status} />
          </div>
        </div>

        {product.description && (
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}
          >
            <strong>Notes / Artwork Details:</strong> {product.description}
          </div>
        )}

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>Registered: {new Date(product.created_at).toLocaleDateString()}</div>
          <div>Last Updated: {new Date(product.updated_at).toLocaleDateString()}</div>
          <div>Total Checks: {(product.inspection_ids || []).length}</div>
        </div>
      </div>

      {/* Latest Inspection Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--primary-600)' }} />
            <span>Latest Compliance Inspection</span>
          </h2>
          {latestSession && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (onOpenInspection) onOpenInspection(latestSession.inspection_id);
                onNavigate('vendor_findings');
              }}
            >
              <span>View Full Findings</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {!product.latest_inspection_id ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              No Inspection Conducted Yet
            </div>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '1rem' }}>
              Upload packaging panels to verify Legal Metrology compliance and generate evidence.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (onStartCheckForProduct) onStartCheckForProduct(product);
                onNavigate('vendor_check');
              }}
            >
              <ShieldCheck size={14} />
              <span>Run First Inspection</span>
            </button>
          </div>
        ) : !latestSession ? (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
            Inspection session <code>{product.latest_inspection_id}</code> is recorded.
          </div>
        ) : (
          <div>
            {/* Summary metrics row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Result</div>
                <div style={{ marginTop: '0.35rem' }}>
                  <StatusBadge status={latestSession.status} size="sm" />
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requirements</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {latestSession.requirements_checked || 0}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--status-pass-text)' }}>Passed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--status-pass-text)' }}>
                  {latestSession.passed || 0}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--status-fail-text)' }}>Issues Found</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--status-fail-text)' }}>
                  {latestSession.potential_issues || 0}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--status-partial-text)' }}>Needs Review</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--status-partial-text)' }}>
                  {latestSession.review || 0}
                </div>
              </div>
            </div>

            {/* Packaging Images Preview */}
            {latestSession.evidence && latestSession.evidence.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Submitted Package Panels ({latestSession.evidence.length})
                </h4>
                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {latestSession.evidence.map((item, idx) => (
                    <div
                      key={item.evidence_id || idx}
                      style={{
                        minWidth: '110px',
                        maxWidth: '130px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-surface-elevated)',
                      }}
                    >
                      <img
                        src={getInspectionImageUrl(latestSession.inspection_id, item.image_id)}
                        alt={`Panel ${item.panel_type}`}
                        style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, textAlign: 'center' }}>
                        {item.panel_type || 'PANEL'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <strong>Summary:</strong> {latestSession.summary}
            </div>
          </div>
        )}
      </div>

      {/* Check History for this Product */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Historical Checks ({ (product.inspection_ids || []).length })
        </h3>
        {(product.inspection_ids || []).length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No previous inspection records for this product.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(product.inspection_ids || []).map((inspId, idx) => (
              <div
                key={inspId}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>Inspection #{idx + 1}:</span> <code>{inspId}</code>
                  {inspId === product.latest_inspection_id && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--primary-50)',
                        color: 'var(--primary-700)',
                      }}
                    >
                      LATEST
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (onOpenInspection) onOpenInspection(inspId);
                    onNavigate('vendor_findings');
                  }}
                >
                  <Eye size={13} />
                  <span>View Findings</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddProductModal
        isOpen={isEditModalOpen}
        initialProduct={product}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          fetchDetails();
        }}
      />
    </div>
  );
}
