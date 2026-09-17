import React, { useEffect, useState } from 'react';
import { PlusCircle, CheckCircle, XCircle, AlertTriangle, Layers, ArrowRight, FileText, Download, Sparkles, RefreshCw } from 'lucide-react';
import { listInspections, downloadReportPdf } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';

export function Dashboard({ onNavigate, onOpenInspection, onLoadDemo }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInspections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInspections();
      setInspections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load inspection history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  // Compute real statistics solely from actual inspection sessions returned by the backend
  const totalCount = inspections.length;
  const compliantCount = inspections.filter((s) => s.status === 'COMPLIANT').length;
  const nonCompliantCount = inspections.filter((s) => s.status === 'NON_COMPLIANT').length;
  const partialCount = inspections.filter(
    (s) => s.status === 'PARTIALLY_VERIFIABLE' || s.status === 'NOT_VERIFIABLE'
  ).length;

  return (
    <div>
      {/* Top Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Inspection Dashboard</h1>
          <p className="page-description">
            Automated Legal Metrology inspection platform for packaged commodities. Audits statutory package declarations against codified Rules, 2011 with evidence-backed traceability.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchInspections}
            title="Refresh Inspection Data"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('new_inspection')}
          >
            <PlusCircle size={16} />
            <span>+ New Inspection</span>
          </button>
        </div>
      </div>

      {/* Error alert if backend offline */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FCA5A5',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#EF4444', flexShrink: 0 }} />
          <div>
            <strong>Connection Notice: </strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Analytics Metric Cards (Derived from real inspections) */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-neutral-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-neutral-text)' }}>
              Total Inspections
            </span>
            <Layers size={16} style={{ color: 'var(--status-neutral-border)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-neutral-text)' }}>
            {loading ? '...' : totalCount}
          </span>
          <span className="metric-footer">Active package audit sessions</span>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-pass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-pass-text)' }}>
              Compliant Packages
            </span>
            <CheckCircle size={16} style={{ color: 'var(--status-pass-border)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-pass-text)' }}>
            {loading ? '...' : compliantCount}
          </span>
          <span className="metric-footer">Passed all mandatory rules</span>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-fail-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-fail-text)' }}>
              Non-Compliant
            </span>
            <XCircle size={16} style={{ color: 'var(--status-fail-border)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-fail-text)' }}>
            {loading ? '...' : nonCompliantCount}
          </span>
          <span className="metric-footer">Definite statutory infractions</span>
        </div>

        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-partial-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-partial-text)' }}>
              Needs Review / Partial
            </span>
            <AlertTriangle size={16} style={{ color: 'var(--status-partial-border)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-partial-text)' }}>
            {loading ? '...' : partialCount}
          </span>
          <span className="metric-footer">Unclear or missing panel views</span>
        </div>
      </div>

      {/* Recent Inspections Table or Empty State */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Recent Commodity Inspections
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Latest packaging audits executed across retail and distributor samples
            </span>
          </div>
          {inspections.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('history')}
            >
              <span>View All History</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Loading inspection sessions from backend...</p>
          </div>
        ) : inspections.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <div className="empty-state-icon">
              <Layers size={28} />
            </div>
            <h3 className="empty-state-title">
              No Inspections Found
            </h3>
            <p className="empty-state-desc">
              No product inspections have been conducted yet in this environment. Create a new inspection or test with our pre-built Parle-G sample packaging.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('new_inspection')}
              >
                <PlusCircle size={16} />
                <span>Create First Inspection</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onLoadDemo}
              >
                <Sparkles size={16} style={{ color: '#F59E0B' }} />
                <span>Load Sample Demonstration</span>
              </button>
            </div>
          </div>
        ) : (
          /* Real Data Table */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Product / Commodity</th>
                  <th>Date & Time</th>
                  <th>Panels</th>
                  <th>Compliance Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.slice(0, 6).map((session) => {
                  const prodName = session.combined_fields?.product_name?.value || 'Unidentified Commodity';
                  const dateStr = session.created_at
                    ? new Date(session.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'N/A';

                  return (
                    <tr key={session.inspection_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-500)' }}>
                        {session.inspection_id}
                      </td>
                      <td>
                        <strong>{prodName}</strong>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {dateStr}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '0.15rem 0.5rem',
                            backgroundColor: 'rgba(55, 65, 81, 0.5)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {session.images?.length || 0} images
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={session.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onOpenInspection(session.inspection_id)}
                          >
                            <FileText size={14} />
                            <span>View Details</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Download PDF"
                            onClick={() => downloadReportPdf(session.inspection_id)}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
