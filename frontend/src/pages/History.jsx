import React, { useEffect, useState } from 'react';
import { History as HistoryIcon, Search, FileText, Download, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { listInspections, downloadReportPdf, downloadReportJsonFile } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';

export function History({ onOpenInspection, onNavigate }) {
  const [inspections, setInspections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
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
    loadData();
  }, []);

  const filtered = inspections.filter((session) => {
    const matchesSearch =
      (session.inspection_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.combined_fields?.product_name?.value || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && session.status === statusFilter;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspection Case History</h1>
          <p className="page-description">
            Complete audit trail of previous packaging inspections. Every session preserves raw panel images, OCR bounding boxes, and deterministic rule verdicts for judicial review.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          <span>Refresh History</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
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
          <AlertCircle size={18} style={{ color: '#EF4444' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Inspection ID or Product name..."
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
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 1rem', color: 'var(--primary-500)' }} />
            <p>Loading historical audit sessions...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <HistoryIcon size={28} />
            </div>
            <h3 className="empty-state-title">
              No Records Found
            </h3>
            <p className="empty-state-desc">
              No previous inspection records match your search or filter criteria. Try adjusting the query or view all inspections.
            </p>
            {onNavigate && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('new_inspection')}
              >
                Start New Inspection
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Product / Description</th>
                  <th>Recorded At</th>
                  <th>Panels</th>
                  <th>Compliance Verdict</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => {
                  const prodName = session.combined_fields?.product_name?.value || 'Unidentified Commodity';
                  const dateStr = session.created_at
                    ? new Intl.DateTimeFormat('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(session.created_at))
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
                          {session.images?.length || 0} panels
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
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Download PDF Report"
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
