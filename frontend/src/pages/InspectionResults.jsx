import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  BookOpen,
  Layers,
  Search,
  Eye,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { getInspection, downloadReportPdf, downloadReportJsonFile } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';
import { ImageViewer } from '../components/ImageViewer';
import { LegalBasisCard } from '../components/LegalBasisCard';

export function InspectionResults({ inspectionId, onBack, onOpenInspection }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'fields' | 'images' | 'legal'
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [ruleFilter, setRuleFilter] = useState('ALL'); // 'ALL' | 'FAIL' | 'PASS' | 'UNCLEAR'

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!inspectionId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getInspection(inspectionId);
        if (isMounted) {
          setSession(data);
          // Pre-select first evidence if available
          if (data.evidence && data.evidence.length > 0) {
            setSelectedEvidence(data.evidence[0]);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load inspection details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [inspectionId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={36} className="spinning" style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
        <p>Loading inspection session {inspectionId}...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem' }}>
        <AlertTriangle size={48} style={{ margin: '0 auto 1rem', color: '#EF4444' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Unable to Load Inspection
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error || `Inspection ID "${inspectionId}" was not found in the local repository.`}
        </p>
        <button type="button" className="btn btn-primary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const comp = session.compliance || {};
  const evaluations = comp.evaluations || [];
  const fields = session.combined_fields || {};
  const images = session.images || [];

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((ev) => {
    if (ruleFilter === 'ALL') return true;
    if (ruleFilter === 'FAIL') return ev.status === 'FAIL';
    if (ruleFilter === 'PASS') return ev.status === 'PASS';
    if (ruleFilter === 'UNCLEAR') return ev.status === 'UNCLEAR' || ev.status === 'NOT_VERIFIABLE';
    return true;
  });

  const handleInspectVisualEvidence = (ev) => {
    // Find matching evidence item
    const match = (session.evidence || []).find(
      (item) => item.rule_id === ev.rule_id || item.field === ev.field
    );
    if (match) {
      setSelectedEvidence(match);
      setActiveTab('images');
    } else {
      setActiveTab('images');
    }
  };

  return (
    <div>
      {/* Top Header & Action Controls */}
      <div className="page-header">
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            style={{ marginBottom: '0.75rem' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Inspections</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontFamily: 'var(--font-mono)' }}>
              {session.inspection_id}
            </h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="page-description">
            Aggregated findings across {images.length} packaging panel{images.length === 1 ? '' : 's'}. Tested against codified Legal Metrology (Packaged Commodities) Rules, 2011.
          </p>
        </div>

        {/* Download Actions */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadReportJsonFile(session.inspection_id)}
            title="Download JSON Report"
          >
            <FileText size={16} />
            <span>JSON Report</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadReportPdf(session.inspection_id)}
            title="Download PDF Report"
          >
            <Download size={16} />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {/* High-Level Compliance Summary Banner */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          backgroundColor:
            session.status === 'COMPLIANT'
              ? 'rgba(6, 78, 59, 0.2)'
              : session.status === 'NON_COMPLIANT'
              ? 'rgba(127, 29, 29, 0.2)'
              : 'rgba(120, 53, 15, 0.2)',
          borderLeft: `4px solid ${
            session.status === 'COMPLIANT'
              ? 'var(--status-pass-border)'
              : session.status === 'NON_COMPLIANT'
              ? 'var(--status-fail-border)'
              : 'var(--status-partial-border)'
          }`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Overall Verification Rationale
            </div>
            <p style={{ fontSize: '1rem', color: 'var(--text-primary)', marginTop: '0.35rem', fontWeight: 500 }}>
              {session.summary || comp.summary || 'Deterministic Legal Metrology evaluation complete.'}
            </p>
          </div>

          {/* Quick Stat Pills */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '4px', backgroundColor: 'var(--status-pass-bg)', color: 'var(--status-pass-text)', border: '1px solid var(--status-pass-border)' }}>
              <strong>{comp.rules_passed || 0}</strong> Passed
            </span>
            <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '4px', backgroundColor: 'var(--status-fail-bg)', color: 'var(--status-fail-text)', border: '1px solid var(--status-fail-border)' }}>
              <strong>{comp.rules_failed || 0}</strong> Failed
            </span>
            <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem', borderRadius: '4px', backgroundColor: 'var(--status-partial-bg)', color: 'var(--status-partial-text)', border: '1px solid var(--status-partial-border)' }}>
              <strong>{(comp.rules_unclear || 0) + (comp.rules_not_verifiable || 0)}</strong> Needs Review
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Detailed Rule Findings ({evaluations.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'fields' ? 'active' : ''}`}
          onClick={() => setActiveTab('fields')}
        >
          Extracted Product Declarations
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Visual Evidence & Image Viewer ({images.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'legal' ? 'active' : ''}`}
          onClick={() => setActiveTab('legal')}
        >
          Authoritative Legal Basis
        </button>
      </div>

      {/* TAB 1: Detailed Rule Findings */}
      {activeTab === 'rules' && (
        <div>
          {/* Rule Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filter by status:</span>
            {['ALL', 'FAIL', 'PASS', 'UNCLEAR'].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`btn btn-sm ${ruleFilter === filterKey ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRuleFilter(filterKey)}
              >
                {filterKey === 'ALL' ? 'All Rules' : filterKey === 'FAIL' ? 'Infractions (Fail)' : filterKey === 'PASS' ? 'Passed' : 'Needs Review'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredEvaluations.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No rules match the selected filter.
              </div>
            ) : (
              filteredEvaluations.map((ev, idx) => {
                const confidencePct = Math.round((ev.confidence || 0) * 100);
                const hasVisualEvidence =
                  ev.evidence && (typeof ev.evidence === 'object' ? ev.evidence.text : ev.evidence);

                return (
                  <div key={ev.rule_id || idx} className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#93C5FD', fontSize: '0.95rem' }}>
                            {ev.rule_id}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface-elevated)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                            {ev.category}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                          {ev.name}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <StatusBadge status={ev.status} />
                      </div>
                    </div>

                    {/* Statutory Requirement */}
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Statutory Requirement: </strong>
                      <span>{ev.requirement}</span>
                    </div>

                    {/* Findings & Evidence Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '0.75rem',
                        padding: '0.85rem',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Target Field: </span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{ev.field}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Detected Snippet: </span>
                        <strong style={{ color: '#93C5FD' }}>
                          {hasVisualEvidence ? `"${typeof ev.evidence === 'object' ? ev.evidence.text : ev.evidence}"` : 'None detected'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>OCR Confidence: </span>
                        <span style={{ color: confidencePct > 75 ? '#34D399' : '#FBBF24', fontWeight: 600 }}>
                          {confidencePct}%
                        </span>
                      </div>
                    </div>

                    {/* Evaluation Rationale */}
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Rationale: </strong>
                      <span>{ev.reason}</span>
                    </div>

                    {/* Legal Basis Section */}
                    {ev.legal_basis && ev.legal_basis.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                          Authoritative Legal Basis:
                        </div>
                        <LegalBasisCard legalBasis={ev.legal_basis} />
                      </div>
                    )}

                    {/* Action link to Image Viewer */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInspectVisualEvidence(ev)}
                      >
                        <Eye size={14} />
                        <span>Inspect Visual Evidence</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Extracted Product Declarations */}
      {activeTab === 'fields' && (
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Canonical Product Package Declarations
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Extracted structured declarations mapped from multi-angle OCR scans and verified against canonical Legal Metrology data models.
          </p>

          {/* Desktop Table View */}
          <div className="table-container desktop-only-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Extraction Status</th>
                  <th>Canonical Value</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'product_name', label: 'Product / Generic Name' },
                  { key: 'net_quantity', label: 'Net Quantity' },
                  { key: 'mrp', label: 'Maximum Retail Price (MRP)' },
                  { key: 'manufacturer', label: 'Manufacturer' },
                  { key: 'address', label: 'Manufacturer Address' },
                  { key: 'date_information', label: 'Date (MFD / Expiry)' },
                  { key: 'consumer_care', label: 'Consumer Care / Helpline' },
                  { key: 'country_of_origin', label: 'Country of Origin' },
                  { key: 'packer', label: 'Packer (if distinct)' },
                  { key: 'importer', label: 'Importer (if imported)' },
                ].map(({ key, label }) => {
                  const fieldItem = fields[key] || { status: 'NOT_VERIFIABLE', value: null, confidence: 0 };
                  const val = fieldItem.value;
                  const conf = Math.round((fieldItem.confidence || 0) * 100);

                  return (
                    <tr key={key}>
                      <td>
                        <strong>{label}</strong>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {key}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={fieldItem.status} size="sm" />
                      </td>
                      <td>
                        {val ? (
                          <span style={{ color: '#93C5FD', fontWeight: 500 }}>{val}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not detected</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {conf}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="mobile-only-cards">
            {[
              { key: 'product_name', label: 'Product / Generic Name' },
              { key: 'net_quantity', label: 'Net Quantity' },
              { key: 'mrp', label: 'Maximum Retail Price (MRP)' },
              { key: 'manufacturer', label: 'Manufacturer' },
              { key: 'address', label: 'Manufacturer Address' },
              { key: 'date_information', label: 'Date (MFD / Expiry)' },
              { key: 'consumer_care', label: 'Consumer Care / Helpline' },
              { key: 'country_of_origin', label: 'Country of Origin' },
              { key: 'packer', label: 'Packer (if distinct)' },
              { key: 'importer', label: 'Importer (if imported)' },
            ].map(({ key, label }) => {
              const fieldItem = fields[key] || { status: 'NOT_VERIFIABLE', value: null, confidence: 0 };
              const val = fieldItem.value;
              const conf = Math.round((fieldItem.confidence || 0) * 100);

              return (
                <div
                  key={key}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</strong>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{key}</div>
                    </div>
                    <StatusBadge status={fieldItem.status} size="sm" />
                  </div>

                  <div style={{ padding: '0.5rem 0.65rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Declared Value:</div>
                    <div style={{ fontSize: '0.85rem', color: val ? '#93C5FD' : 'var(--text-muted)', fontWeight: val ? 600 : 400, marginTop: '0.15rem' }}>
                      {val || 'Not detected on submitted panels'}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'right' }}>
                    OCR Confidence: <strong style={{ color: conf > 75 ? '#34D399' : '#FBBF24' }}>{conf}%</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Visual Evidence & Image Viewer */}
      {activeTab === 'images' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Packaging Image & Evidence Viewer
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Interactive pan/zoom viewer displaying normalized OCR bounding boxes <code style={{ color: '#93C5FD' }}>[ymin, xmin, ymax, xmax]</code> overlaid onto original packaging panels.
            </p>
          </div>

          <ImageViewer
            images={images}
            inspectionId={session.inspection_id}
            selectedEvidence={selectedEvidence}
            onSelectEvidence={(ev) => setSelectedEvidence(ev)}
          />

          {/* Evidence Details Card */}
          {selectedEvidence && (
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#93C5FD' }}>
                Active Visual Evidence Region
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Rule ID: </span>
                  <strong>{selectedEvidence.rule_id || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Field: </span>
                  <span>{selectedEvidence.field}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Panel: </span>
                  <span>{selectedEvidence.panel || 'UNKNOWN'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Detected OCR Text: </span>
                  <strong style={{ color: '#FCD34D' }}>"{selectedEvidence.text}"</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
                  <span>{Math.round((selectedEvidence.confidence || 0) * 100)}%</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Normalized Coordinates: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#93C5FD' }}>
                    {selectedEvidence.bounding_box
                      ? Array.isArray(selectedEvidence.bounding_box)
                        ? `[${selectedEvidence.bounding_box.map((n) => n.toFixed(3)).join(', ')}]`
                        : `[${selectedEvidence.bounding_box.ymin.toFixed(3)}, ${selectedEvidence.bounding_box.xmin.toFixed(3)}, ${selectedEvidence.bounding_box.ymax.toFixed(3)}, ${selectedEvidence.bounding_box.xmax.toFixed(3)}]`
                      : 'Visual coordinates unavailable'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Authoritative Legal Basis */}
      {activeTab === 'legal' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <BookOpen size={20} style={{ color: '#3B82F6' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Retrieved Statutory Provisions & Gazette Citations
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            All statutory citations are deterministically retrieved from the official Legal Metrology knowledge base and linked directly to official Gazette publications on <code style={{ color: '#93C5FD' }}>consumeraffairs.nic.in</code>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {evaluations.map((ev, idx) => (
              <div
                key={ev.rule_id || idx}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#93C5FD', marginRight: '0.5rem' }}>
                      {ev.rule_id}
                    </span>
                    {ev.name} ({ev.field})
                  </div>
                  <StatusBadge status={ev.status} size="sm" />
                </div>
                <LegalBasisCard legalBasis={ev.legal_basis} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
