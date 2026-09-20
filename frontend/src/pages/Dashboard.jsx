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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.7rem', borderRadius: '999px', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)', color: '#93C5FD', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Research Gap
            </div>
            <h2 style={{ marginTop: '0.9rem', marginBottom: '0.6rem', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
              Why OCR alone is not enough for packaged commodity compliance
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              A real packaging declaration is not just a string of text. It sits inside a visually complex package: curved surfaces,
              small or distorted fonts, competing numbers, branding, and context-rich legal information. In such environments, OCR
              can detect text but cannot reliably determine whether a declaration is complete, correctly interpreted, readable,
              placed on the correct panel, or compliant with the law.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              {
                title: 'Complex Visual Layouts',
                text: 'Declarations are spread across the principal display panel, side panels, folds, seams, and curved surfaces.',
              },
              {
                title: 'Small / Distorted Text',
                text: 'Font sizes may be tiny, reflective, or affected by glare, shadows, and package geometry.',
              },
              {
                title: 'Ambiguous Context',
                text: 'MRP, manufacturing dates, batch numbers, and country labels often compete with one another in the same visual field.',
              },
              {
                title: 'Placement & Legal Sufficiency',
                text: 'The law is not only about presence; it is also about correct placement, grouping, and statutory interpretation.',
              },
            ].map((item) => (
              <div key={item.title} style={{ padding: '1rem 1.05rem', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.96rem', color: 'var(--text-primary)' }}>{item.title}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.88rem' }}>{item.text}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0.9rem', padding: '1rem 1.1rem', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.14), rgba(59, 130, 246, 0.08))', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Multimodal framework required</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
              {[
                'OCR text detection and bounding-box extraction',
                'Visual and layout analysis of package geometry',
                'Semantic interpretation and disambiguation',
                'Rule-based legal reasoning and compliance checks',
                'Evidence mapping with placement and readability metrics',
              ].map((step) => (
                <div key={step} style={{ padding: '0.75rem 0.85rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.42)', border: '1px solid rgba(148, 163, 184, 0.16)', color: 'var(--text-primary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
