import React, { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  FileText,
  Download,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Shield,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Filter,
  BadgeAlert,
} from 'lucide-react';
import { listInspections, downloadReportPdf, downloadReportJsonFile } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function OfficerHistory({ onOpenInspection, onNavigate }) {
  const { currentUser, isOfficer } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInspections();
      setInspections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load official inspection history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalAudits = inspections.length;
  const compliantAudits = inspections.filter((s) => s.status === 'COMPLIANT').length;
  const violationAudits = inspections.filter((s) => s.status === 'NON_COMPLIANT').length;
  const finalizedAudits = inspections.filter((s) => s.is_finalized).length;

  const filtered = inspections.filter((session) => {
    const q = searchTerm.toLowerCase().trim();
    if (q) {
      const matchId = (session.inspection_id || '').toLowerCase().includes(q);
      const matchProduct = (session.combined_fields?.product_name?.value || '').toLowerCase().includes(q);
      const matchMfg = (session.combined_fields?.manufacturer?.value || '').toLowerCase().includes(q);
      const matchNotes = (session.officer_notes || '').toLowerCase().includes(q);
      const matchOfficer = (session.officer_name || '').toLowerCase().includes(q);
      if (!matchId && !matchProduct && !matchMfg && !matchNotes && !matchOfficer) {
        return false;
      }
    }

    if (statusFilter !== 'ALL') {
      if (session.status !== statusFilter) return false;
    }

    if (verdictFilter === 'FINALIZED' && !session.is_finalized) return false;
    if (verdictFilter === 'PENDING' && session.is_finalized) return false;
    if (verdictFilter === 'NOTICE' && session.status !== 'NON_COMPLIANT') return false;

    return true;
  });

  const handleDownloadPdf = async (e, inspectionId) => {
    e.stopPropagation();
    setDownloadingPdfId(inspectionId);
    try {
      await downloadReportPdf(inspectionId);
    } catch (err) {
      alert(`Failed to download report PDF: ${err.message}`);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  return (
    <div className="officer-history">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid var(--primary-500)',
                color: 'var(--primary-500)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <Shield size={12} />
              Enforcement Archive
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Legal Metrology Directorate &bull; Statutory Audit Registry
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', margin: '0 0 0.4rem 0' }}>
            Official Packaging Audit Registry
          </h1>
          <p className="page-description" style={{ margin: 0, fontSize: '0.9rem' }}>
            Searchable repository of all verified package inspections, multi-panel evidence trails, and officer determinations under the Legal Metrology Act, 2009.
          </p>
        </div>

        <button type="button" className="btn btn-secondary" onClick={loadData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh Registry</span>
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
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={18} style={{ color: '#EF4444' }} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL AUDITS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {totalAudits}
          </div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600 }}>COMPLIANT PACKAGES</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34D399', marginTop: '0.2rem' }}>
            {compliantAudits}
          </div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#F87171', fontWeight: 600 }}>STATUTORY VIOLATIONS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F87171', marginTop: '0.2rem' }}>
            {violationAudits}
          </div>
        </div>

        <div className="card" style={{ padding: '0.85rem 1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#A78BFA', fontWeight: 600 }}>OFFICIALLY FINALIZED</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#A78BFA', marginTop: '0.2rem' }}>
            {finalizedAudits}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search
              size={15}
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
              placeholder="Search by ID, commodity, brand, manufacturer, officer..."
              className="input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['ALL', 'COMPLIANT', 'NON_COMPLIANT', 'PARTIALLY_VERIFIABLE', 'NOT_VERIFIABLE'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Officer Decision Filter */}
          <select
            className="input"
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
          >
            <option value="ALL">All Officer States</option>
            <option value="FINALIZED">Finalized & Signed Only</option>
            <option value="PENDING">Pending Officer Review</option>
            <option value="NOTICE">Notice Required</option>
          </select>
        </div>
      </div>

      {/* Case List Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 0.75rem auto' }} />
          <div>Loading official case registry...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            color: 'var(--text-muted)',
          }}
        >
          <HistoryIcon size={32} style={{ margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No Matching Inspection Records</h3>
          <p style={{ margin: '0 auto 1.25rem auto', maxWidth: '420px', fontSize: '0.875rem' }}>
            {searchTerm || statusFilter !== 'ALL' || verdictFilter !== 'ALL'
              ? 'Try adjusting your search criteria or clear active filters.'
              : 'No package inspections recorded yet. Start a new inspection to build the case registry.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('new_inspection')}
          >
            Start New Inspection
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.5rem', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.6rem' }}>Inspection ID</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Commodity Name</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Manufacturer / Entity</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Compliance Verdict</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Officer Determination</th>
                <th style={{ padding: '0.75rem 0.6rem' }}>Audit Date</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const prodName = item.combined_fields?.product_name?.value || 'Unidentified Commodity';
                const mfgName = item.combined_fields?.manufacturer?.value || item.combined_fields?.packer?.value || '—';
                const dateStr = item.created_at
                  ? new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';

                return (
                  <tr
                    key={item.inspection_id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onClick={() => onOpenInspection(item.inspection_id)}
                    className="hover-row"
                  >
                    <td style={{ padding: '0.75rem 0.6rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-500)' }}>
                      {item.inspection_id}
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {prodName}
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mfgName}
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem' }}>
                      <StatusBadge status={item.status} size="sm" />
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem' }}>
                      {item.is_finalized ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#A78BFA',
                            background: 'rgba(139, 92, 246, 0.12)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                          }}
                        >
                          <FileCheck size={12} />
                          Finalized ({item.final_verdict || 'COMPLIANT'})
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Pending Review
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {dateStr}
                    </td>

                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Download Official PDF Report"
                          onClick={(e) => handleDownloadPdf(e, item.inspection_id)}
                          disabled={downloadingPdfId === item.inspection_id}
                        >
                          <Download size={13} className={downloadingPdfId === item.inspection_id ? 'spinning' : ''} />
                          <span className="desktop-only">PDF</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          title="Open Officer Inspection Workbench"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInspection(item.inspection_id);
                          }}
                        >
                          <span>Open</span>
                          <ExternalLink size={13} />
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
  );
}
