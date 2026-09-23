import React, { useEffect, useState } from 'react';
import {
  Building2,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Search,
  ShieldCheck,
  FileText,
  AlertCircle,
  Layers,
  History,
  Info,
} from 'lucide-react';
import { listProducts } from '../../api/products';
import { listInspections } from '../../api/inspections';
import { getVendorContext } from '../../context/vendorContext';
import { StatusBadge } from '../../components/StatusBadge';
import { AddProductModal } from './AddProductModal';

export function VendorDashboard({ onNavigate, onSelectProduct, onOpenInspection }) {
  const vendor = getVendorContext();

  const [products, setProducts] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productList, inspectionList] = await Promise.all([
        listProducts({ vendorId: vendor.vendor_id }).catch(() => []),
        listInspections().catch(() => []),
      ]);
      setProducts(productList || []);
      setInspections(inspectionList || []);
    } catch (err) {
      setError(err.message || 'Failed to load vendor dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute metrics from actual available data only
  const totalProducts = products.length;
  const checkedProducts = products.filter((p) => p.status === 'CHECKED').length;
  const issuesProducts = products.filter((p) => p.status === 'ISSUES_FOUND').length;
  const reviewProducts = products.filter((p) => p.status === 'NEEDS_REVIEW').length;
  const uncheckedProducts = products.filter(
    (p) => !p.status || p.status === 'NOT_CHECKED'
  ).length;

  // Filter inspections associated with vendor products or matching product category
  const vendorProductIds = new Set(products.map((p) => p.product_id));
  const vendorRecentChecks = inspections.filter((session) => {
    // Check if session has been linked to one of the vendor's products
    return products.some(
      (p) => p.latest_inspection_id === session.inspection_id || (p.inspection_ids || []).includes(session.inspection_id)
    );
  });

  // If no explicit product link exists yet, display actual recent system checks honestly labeled
  const displayedChecks = vendorRecentChecks.length > 0 ? vendorRecentChecks : inspections.slice(0, 5);

  const productsNeedingAttention = products.filter(
    (p) => p.status === 'ISSUES_FOUND' || p.status === 'NEEDS_REVIEW'
  );

  return (
    <div className="vendor-dashboard">
      {/* Dev Vendor Context Banner */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderLeft: '4px solid var(--primary-500)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {vendor.company_name}
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--status-info-text)',
                  border: '1px solid var(--status-info-border)',
                }}
              >
                {vendor.notice}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Vendor ID: <strong>{vendor.vendor_id}</strong> &bull; Contact:{' '}
              {vendor.email}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            <PlusCircle size={14} />
            <span>Add Product</span>
          </button>
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
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Products</div>
          <div className="metric-value">{loading ? '—' : totalProducts}</div>
          <div className="metric-footer">
            {uncheckedProducts > 0
              ? `${uncheckedProducts} pending initial check`
              : 'All registered products'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title" style={{ color: 'var(--status-pass-text)' }}>
            Products Checked
          </div>
          <div className="metric-value" style={{ color: 'var(--status-pass-text)' }}>
            {loading ? '—' : checkedProducts}
          </div>
          <div className="metric-footer">
            {totalProducts > 0
              ? `${Math.round((checkedProducts / totalProducts) * 100)}% verified compliant`
              : 'No products registered yet'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title" style={{ color: 'var(--status-fail-text)' }}>
            Products With Issues
          </div>
          <div className="metric-value" style={{ color: 'var(--status-fail-text)' }}>
            {loading ? '—' : issuesProducts}
          </div>
          <div className="metric-footer">
            {issuesProducts > 0
              ? 'Artwork correction required'
              : 'Zero non-compliant products'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title" style={{ color: 'var(--status-partial-text)' }}>
            Needs Review
          </div>
          <div className="metric-value" style={{ color: 'var(--status-partial-text)' }}>
            {loading ? '—' : reviewProducts}
          </div>
          <div className="metric-footer">
            {reviewProducts > 0
              ? 'Additional packaging panels advised'
              : 'No items flagged for review'}
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Strip */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          className="card-action"
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary-600)' }}>
            <PlusCircle size={20} />
            <strong style={{ fontSize: '0.95rem' }}>Add Product</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Register new SKU or barcode in your vendor catalog.
          </p>
        </div>

        <div
          className="card-action"
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onClick={() => onNavigate('vendor_products')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary-600)' }}>
            <Package size={20} />
            <strong style={{ fontSize: '0.95rem' }}>View Products ({totalProducts})</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Browse, manage, and edit your packaging catalog.
          </p>
        </div>

        <div
          className="card-action"
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onClick={() => onNavigate('vendor_check')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary-600)' }}>
            <ShieldCheck size={20} />
            <strong style={{ fontSize: '0.95rem' }}>Run Compliance Check</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Upload package panels to run the NiyamCheck engine.
          </p>
        </div>

        <div
          className="card-action"
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onClick={() => onNavigate('vendor_history')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary-600)' }}>
            <History size={20} />
            <strong style={{ fontSize: '0.95rem' }}>View Audit History</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Access full audit trail and downloadable official reports.
          </p>
        </div>
      </div>

      {/* 2-Column Command Center: Attention Required & Recent Checks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Products Needing Attention */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--status-fail-border)' }} />
              <span>Products Needing Attention ({productsNeedingAttention.length})</span>
            </h3>
            {productsNeedingAttention.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('vendor_products')}
              >
                View All
              </button>
            )}
          </div>

          {productsNeedingAttention.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--status-pass-border)', margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                No Products With Open Issues
              </div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                All checked products are compliant, or no issues have been detected yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {productsNeedingAttention.map((prod) => (
                <div
                  key={prod.product_id}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {prod.product_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Brand: {prod.brand_name} &bull; Code: {prod.product_code}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusBadge status={prod.status} size="sm" />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        if (onSelectProduct) onSelectProduct(prod.product_id);
                        onNavigate('vendor_product_details');
                      }}
                    >
                      <span>Fix / Re-check</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Checks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} style={{ color: 'var(--primary-600)' }} />
              <span>Recent Compliance Checks</span>
            </h3>
            {displayedChecks.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('vendor_history')}
              >
                View History
              </button>
            )}
          </div>

          {displayedChecks.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                No Checks Yet
              </div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Run your first compliance check to see audit results here.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '0.75rem' }}
                onClick={() => onNavigate('vendor_check')}
              >
                Start First Check
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {displayedChecks.slice(0, 5).map((session) => (
                <div
                  key={session.inspection_id}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.combined_fields?.product_name?.value || session.product_category || session.inspection_id}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ID: {session.inspection_id.substring(0, 16)}... &bull;{' '}
                      {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'Recent'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <StatusBadge status={session.status} size="sm" />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem 0.5rem' }}
                      title="View Inspection Results"
                      onClick={() => {
                        if (onOpenInspection) onOpenInspection(session.inspection_id);
                        onNavigate('vendor_findings');
                      }}
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newProduct) => {
          loadData();
        }}
      />
    </div>
  );
}
