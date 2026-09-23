import React, { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  FileText,
  Download,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Building2,
  Package,
} from 'lucide-react';
import { listInspections, downloadReportPdf, downloadReportJsonFile } from '../../api/inspections';
import { listProducts } from '../../api/products';
import { getVendorContext } from '../../context/vendorContext';
import { StatusBadge } from '../../components/StatusBadge';

export function VendorHistory({ onOpenInspection, onNavigate }) {
  const vendor = getVendorContext();

  const [inspections, setInspections] = useState([]);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allInspections, products] = await Promise.all([
        listInspections().catch(() => []),
        listProducts({ vendorId: vendor.vendor_id }).catch(() => []),
      ]);
      setInspections(Array.isArray(allInspections) ? allInspections : []);
      setVendorProducts(Array.isArray(products) ? products : []);
    } catch (err) {
      setError(err.message || 'Failed to load vendor audit history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const vendorLinkedInspectionIds = new Set();
  vendorProducts.forEach((p) => {
    if (p.latest_inspection_id) vendorLinkedInspectionIds.add(p.latest_inspection_id);
    (p.inspection_ids || []).forEach((id) => vendorLinkedInspectionIds.add(id));
  });

  const filtered = inspections.filter((session) => {
  const matchesVendor = vendorLinkedInspectionIds.has(session.inspection_id);

  const matchesSearch =
    !searchTerm ||
    session.inspection_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.product_category?.toLowerCase().includes(searchTerm.toLowerCase());

  const matchesStatus =
    statusFilter === 'ALL' || session.status === statusFilter;

  return matchesVendor && matchesSearch && matchesStatus;
});

  return (
    <div className="vendor-history-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendor Compliance History & Audit Logs</h1>
          <p className="page-description">
            Complete audit records of package compliance checks. Review historical session outcomes, verify timestamped declarations, and download official inspection reports.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh History</span>
        </button>
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

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Inspection ID or Commodity name..."
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.2rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['ALL', 'COMPLIANT', 'NON_COMPLIANT', 'PARTIALLY_VERIFIABLE', 'NOT_VERIFIABLE'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL'
                  ? 'All Results'
                  : st === 'NON_COMPLIANT'
                  ? 'Issues Found'
                  : st === 'PARTIALLY_VERIFIABLE'
                  ? 'Needs Review'
                  : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 0.75rem' }} />
          <div>Loading inspection history...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <HistoryIcon size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.35 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
            No Audit History Found
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
            {searchTerm || statusFilter !== 'ALL'
              ? 'No inspections matched your filter criteria.'
              : 'No inspections have been conducted yet.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Check ID</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product / Commodity</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Timestamp</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Audit Summary</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => {
                  const isVendorLinked = vendorLinkedInspectionIds.has(session.inspection_id);
                  const prodName = session.combined_fields?.product_name?.value || session.product_category || 'General Commodity';

                  return (
                    <tr
                      key={session.inspection_id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.15s' }}
                    >
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                        <code>{session.inspection_id.substring(0, 18)}...</code>
                        {isVendorLinked && (
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: 'var(--primary-600)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              marginTop: '0.15rem',
                            }}
                          >
                            Catalog Product
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600 }}>{prodName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Panels: {(session.evidence || []).length} &bull; Rules Checked: {session.requirements_checked || 0}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {session.created_at ? new Date(session.created_at).toLocaleString() : 'Recent'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <StatusBadge status={session.status} size="sm" />
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.summary}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Download PDF Report"
                            onClick={() => downloadReportPdf(session.inspection_id)}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (onOpenInspection) onOpenInspection(session.inspection_id);
                              onNavigate('vendor_findings');
                            }}
                          >
                            <span>Findings</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
