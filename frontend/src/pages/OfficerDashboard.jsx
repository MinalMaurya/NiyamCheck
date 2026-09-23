import React, { useEffect, useState } from 'react';
import {
  Shield,
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Download,
  FileText,
  BadgeAlert,
  Sparkles,
  UserCheck,
  Building,
  MapPin,
  Tag,
} from 'lucide-react';
import { listInspections, downloadReportPdf } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

export function OfficerDashboard({ onNavigate, onOpenInspection, onLoadDemo }) {
  const { currentUser, isOfficer } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('ALL'); // ALL, REVIEW, NON_COMPLIANT, COMPLIANT, FINALIZED
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchInspections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInspections();
      setInspections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve inspection records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  // Compute real metrics from loaded inspections
  const totalCount = inspections.length;
  const compliantCount = inspections.filter((s) => s.status === 'COMPLIANT').length;
  const nonCompliantCount = inspections.filter((s) => s.status === 'NON_COMPLIANT').length;
  const reviewRequiredCount = inspections.filter(
    (s) =>
      s.status === 'PARTIALLY_VERIFIABLE' ||
      s.status === 'UNCLEAR' ||
      s.status === 'NOT_VERIFIABLE' ||
      !s.is_finalized
  ).length;
  const finalizedCount = inspections.filter((s) => s.is_finalized).length;

  // Filter inspections based on tab and search
  const filteredInspections = inspections.filter((item) => {
    // Tab filter
    if (filterTab === 'REVIEW' && (item.is_finalized || (item.status === 'COMPLIANT' && item.is_finalized))) {
      return false;
    }
    if (filterTab === 'NON_COMPLIANT' && item.status !== 'NON_COMPLIANT') {
      return false;
    }
    if (filterTab === 'COMPLIANT' && item.status !== 'COMPLIANT') {
      return false;
    }
    if (filterTab === 'FINALIZED' && !item.is_finalized) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (item.inspection_id || '').toLowerCase().includes(q);
      const prodName = (item.combined_fields?.product_name?.value || '').toLowerCase();
      const mfgName = (item.combined_fields?.manufacturer?.value || '').toLowerCase();
      const category = (item.product_category || '').toLowerCase();
      const notes = (item.officer_notes || '').toLowerCase();
      const establishment = (item.establishment_name || '').toLowerCase();
      const location = (item.sampling_location || '').toLowerCase();
      const sampleId = (item.batch_sample_id || '').toLowerCase();
      return (
        matchId ||
        prodName.includes(q) ||
        mfgName.includes(q) ||
        category.includes(q) ||
        notes.includes(q) ||
        establishment.includes(q) ||
        location.includes(q) ||
        sampleId.includes(q)
      );
    }
    return true;
  });

  const handleDownloadPdf = async (e, inspectionId) => {
    e.stopPropagation();
    setDownloadingId(inspectionId);
    try {
      await downloadReportPdf(inspectionId);
    } catch (err) {
      alert(`Failed to download inspection PDF: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="officer-dashboard">
      {/* Officer Header Banner */}
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
              Enforcement Workbench
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Rule 6 &bull; Legal Metrology (Packaged Commodities) Rules, 2011
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', margin: '0 0 0.4rem 0' }}>
            Legal Metrology Officer Dashboard
          </h1>
          <p className="page-description" style={{ margin: 0, fontSize: '0.9rem' }}>
            Auditing authority station for statutory package declarations, multimodal bounding-box evidence review, and enforcement determination.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchInspections}
            title="Refresh Inspection Registry"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>

          {onLoadDemo && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onLoadDemo}
              title="Load Pre-configured Multi-Panel Demo Package"
            >
              <Sparkles size={15} style={{ color: '#F59E0B' }} />
              <span>Demo Package</span>
            </button>
          )}

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

      {/* Officer Credential Card */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1.25rem',
          background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(30, 41, 59, 0.7) 100%)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid var(--primary-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-500)',
              flexShrink: 0,
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                {currentUser?.name || 'Inspecting Officer'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {currentUser?.badge || 'LM-OFF-MH-4001'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building size={12} />
              <span>{currentUser?.jurisdiction || 'Department of Consumer Affairs, Legal Metrology Division'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.82rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Status: </span>
            <span style={{ color: 'var(--primary-500)', fontWeight: 600 }}>Active Station</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Statutory Act: </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Legal Metrology Act, 2009</span>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            padding: '0.9rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FCA5A5',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* 5-Pillar Officer Statistics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Audits */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #64748B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Package Audits
            </span>
            <FileText size={18} style={{ color: '#94A3B8' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            All multi-panel packaging sessions
          </div>
        </div>

        {/* Compliant Packages */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: '#34D399', fontWeight: 600, textTransform: 'uppercase' }}>
              Verified Compliant
            </span>
            <CheckCircle size={18} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34D399', marginTop: '0.4rem' }}>
            {compliantCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            All statutory declarations present
          </div>
        </div>

        {/* Non-Compliant / Violations */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: '#F87171', fontWeight: 600, textTransform: 'uppercase' }}>
              Statutory Violations
            </span>
            <XCircle size={18} style={{ color: '#EF4444' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F87171', marginTop: '0.4rem' }}>
            {nonCompliantCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Non-conforming under Rule 6 / Sec 18
          </div>
        </div>

        {/* Review Required */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: '#FBBF24', fontWeight: 600, textTransform: 'uppercase' }}>
              Review Required
            </span>
            <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#FBBF24', marginTop: '0.4rem' }}>
            {reviewRequiredCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Unclear or pending officer review
          </div>
        </div>

        {/* Finalized by Officer */}
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', color: '#A78BFA', fontWeight: 600, textTransform: 'uppercase' }}>
              Officer Finalized
            </span>
            <FileCheck size={18} style={{ color: '#8B5CF6' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#A78BFA', marginTop: '0.4rem' }}>
            {finalizedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Official sign-off completed
          </div>
        </div>
      </div>

      {/* Main Inspection Registry Section */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All Audits (${totalCount})` },
              { id: 'REVIEW', label: `Needs Review (${reviewRequiredCount})` },
              { id: 'NON_COMPLIANT', label: `Violations (${nonCompliantCount})` },
              { id: 'COMPLIANT', label: `Compliant (${compliantCount})` },
              { id: 'FINALIZED', label: `Finalized (${finalizedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${filterTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterTab(tab.id)}
                style={{ fontSize: '0.8rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search by ID, commodity, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Inspections Table / List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 0.75rem auto' }} />
            <div>Loading Legal Metrology inspection records...</div>
          </div>
        ) : filteredInspections.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-default)',
            }}
          >
            <Shield size={32} style={{ margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }} />
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No Inspections Found</h3>
            <p style={{ margin: '0 auto 1.25rem auto', maxWidth: '420px', fontSize: '0.875rem' }}>
              {searchQuery
                ? `No inspection records match query "${searchQuery}".`
                : filterTab !== 'ALL'
                ? `No inspections currently in "${filterTab}" state.`
                : 'No package inspections recorded yet. Start a new audit or load sample data.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('new_inspection')}
            >
              <PlusCircle size={15} />
              <span>Initiate Package Audit</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Inspection ID</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Commodity / Brand</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Panels</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Rule Engine Verdict</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Officer Action</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Audit Date</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp) => {
                  const prodName = insp.combined_fields?.product_name?.value || 'Unidentified Commodity';
                  const mfg = insp.combined_fields?.manufacturer?.value || insp.combined_fields?.packer?.value || '';
                  const panelCount = Array.isArray(insp.images) ? insp.images.length : 0;
                  const dateStr = insp.created_at
                    ? new Date(insp.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <tr
                      key={insp.inspection_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => onOpenInspection(insp.inspection_id)}
                      className="hover-row"
                    >
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-500)' }}>
                        {insp.inspection_id}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prodName}</div>
                        {mfg && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                            {mfg}
                          </div>
                        )}
                        {insp.establishment_name && (
                          <div style={{ fontSize: '0.73rem', color: 'var(--primary-400)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                            <Building size={11} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              {insp.establishment_name}
                            </span>
                            {insp.sampling_location && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                &bull; {insp.sampling_location}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          {panelCount} {panelCount === 1 ? 'panel' : 'panels'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <StatusBadge status={insp.status} size="sm" />
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {insp.is_finalized ? (
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
                            Finalized ({insp.final_verdict || 'COMPLIANT'})
                          </span>
                        ) : insp.status === 'NON_COMPLIANT' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#F87171',
                              background: 'rgba(239, 68, 68, 0.12)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            <BadgeAlert size={12} />
                            Notice Required
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Pending Review
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Download PDF Inspection Report"
                            onClick={(e) => handleDownloadPdf(e, insp.inspection_id)}
                            disabled={downloadingId === insp.inspection_id}
                          >
                            <Download size={13} className={downloadingId === insp.inspection_id ? 'spinning' : ''} />
                            <span className="desktop-only">PDF</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            title="Open Officer Inspection Workbench"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInspection(insp.inspection_id);
                            }}
                          >
                            <span>Inspect</span>
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
    </div>
  );
}
