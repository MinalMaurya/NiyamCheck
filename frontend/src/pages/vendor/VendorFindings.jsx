import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Download,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  PlusCircle,
  Eye,
  X,
  Upload,
  Layers,
  AlertCircle,
  Check,
  Info,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import {
  getInspection,
  downloadReportPdf,
  downloadReportJsonFile,
  addInspectionImages,
  getInspectionImageUrl,
} from '../../api/inspections';
import { StatusBadge } from '../../components/StatusBadge';
import { ImageViewer } from '../../components/ImageViewer';
import { LegalBasisCard } from '../../components/LegalBasisCard';
import { getVendorContext } from '../../context/vendorContext';

const VENDOR_REMEDIATION_GUIDES = {
  'LM-PN-001': {
    requirement: 'Generic / Common Commodity Name (Rule 6(1)(a))',
    correction_guidance:
      'Print the common or generic name of the commodity on the Principal Display Panel (PDP) in clear, conspicuous lettering so consumers immediately recognize product nature.',
  },
  'LM-NQ-001': {
    requirement: 'Net Quantity in Metric Units (Rule 6(1)(c) & Rule 12)',
    correction_guidance:
      'Declare net weight/volume using standard metric symbols (g, kg, ml, l). Do not add periods (e.g. use "g" not "gms."), and ensure numeral height meets minimum size standards relative to PDP area.',
  },
  'LM-MRP-001': {
    requirement: 'Maximum Retail Price Declaration (Rule 6(1)(e))',
    correction_guidance:
      'Ensure price is printed clearly with Indian Rupee symbol (₹ or Rs.) followed by tax-inclusive phrase: "MRP ₹ XX.XX (incl. of all taxes)". Avoid sticker overwriting or dual MRPs.',
  },
  'LM-MFG-001': {
    requirement: 'Manufacturer / Packer / Importer Identity (Rule 6(1)(b))',
    correction_guidance:
      'Clearly designate corporate role (e.g. "Manufactured by", "Packed by", or "Marketed by") followed by the full registered legal corporate entity name.',
  },
  'LM-ADDR-001': {
    requirement: 'Complete Postal Address (Rule 6(1)(b))',
    correction_guidance:
      'Include physical manufacturing or packaging premises address: locality, city, state, and 6-digit postal PIN code for consumer grievance correspondence.',
  },
  'LM-DATE-001': {
    requirement: 'Date of Manufacture / Packaging (Rule 6(1)(d))',
    correction_guidance:
      'Print month and year (MM/YYYY) of manufacture, pre-packing, or import. Ensure dot-matrix stamps or laser crimp engravings are distinct and high-contrast.',
  },
  'LM-CARE-001': {
    requirement: 'Consumer Care Contact Details (Rule 6(1)(h))',
    correction_guidance:
      'Provide at least a telephone helpline number, dedicated email address, and postal redressal address where aggrieved consumers may reach the grievance redressal cell.',
  },
  'LM-COO-001': {
    requirement: 'Country of Origin Declaration (Rule 6(10))',
    correction_guidance:
      'Declare the geographic jurisdiction of primary manufacture or assembly explicitly (e.g. "Country of Origin: India" or "Made in India").',
  },
};

export function VendorFindings({ inspectionId, onBack, onNavigate, onRecheckProduct }) {
  const vendor = getVendorContext();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL | ISSUES | REVIEW | PASS
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  // Re-check / Add panel modal
  const [isRecheckModalOpen, setIsRecheckModalOpen] = useState(false);
  const [recheckFiles, setRecheckFiles] = useState([]);
  const [recheckPanel, setRecheckPanel] = useState('BACK');
  const [rechecking, setRechecking] = useState(false);
  const [recheckFeedback, setRecheckFeedback] = useState(null);

  const fetchSession = async () => {
    if (!inspectionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getInspection(inspectionId);
      setSession(data);
      if (data.evidence && data.evidence.length > 0) {
        setSelectedEvidence(data.evidence[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load inspection findings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [inspectionId]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="spinning" style={{ margin: '0 auto 0.75rem' }} />
        <div>Retrieving compliance audit findings...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--status-fail-text)', margin: '0 auto 0.75rem' }} />
        <p style={{ color: 'var(--status-fail-text)', marginBottom: '1rem' }}>
          {error || 'Inspection findings could not be loaded.'}
        </p>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Return</span>
        </button>
      </div>
    );
  }

  // Filter findings based on active tab
  const allFindings = session.findings && session.findings.length > 0
    ? session.findings
    : (session.compliance?.evaluations || []);

  const filteredFindings = allFindings.filter((f) => {
    const st = (f.status || '').toUpperCase();
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'ISSUES') return st === 'NON_COMPLIANT' || st === 'POTENTIAL_ISSUE' || st === 'FAIL';
    if (activeFilter === 'REVIEW') return st === 'NEEDS_REVIEW' || st === 'PARTIALLY_VERIFIABLE' || st === 'UNCLEAR' || st === 'REVIEW';
    if (activeFilter === 'PASS') return st === 'COMPLIANT' || st === 'PASS';
    return true;
  });

  const handleAddCorrectedPanel = async (e) => {
    e.preventDefault();
    if (recheckFiles.length === 0) {
      alert('Please select at least one corrected panel image.');
      return;
    }

    setRechecking(true);
    setRecheckFeedback(null);
    try {
      // Reuses existing POST /api/v1/inspections/{inspection_id}/images
      const updated = await addInspectionImages({
        inspectionId: session.inspection_id,
        files: recheckFiles,
        panels: [recheckPanel],
      });
      setSession(updated);
      setRecheckFiles([]);
      setIsRecheckModalOpen(false);
      setRecheckFeedback('Corrected panel ingested. Session re-evaluated successfully.');
      setTimeout(() => setRecheckFeedback(null), 4000);
    } catch (err) {
      alert(`Re-check failed: ${err.message}`);
    } finally {
      setRechecking(false);
    }
  };

  return (
    <div className="vendor-findings-page">
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadReportPdf(session.inspection_id)}
          >
            <Download size={14} />
            <span>Download Report (PDF)</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadReportJsonFile(session.inspection_id)}
          >
            <FileText size={14} />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsRecheckModalOpen(true)}
          >
            <RotateCcw size={14} />
            <span>Upload Corrected Panel / Re-check</span>
          </button>
        </div>
      </div>

      {recheckFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--status-pass-bg)',
            border: '1px solid var(--status-pass-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--status-pass-text)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{recheckFeedback}</span>
        </div>
      )}

      {/* Legal & Informational Disclaimer */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '0.85rem 1.15rem',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderLeft: '4px solid #3B82F6',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        <strong>Legal Disclaimer:</strong> NiyamCheck is an AI-assisted informational analysis based on the submitted evidence and referenced Legal Metrology sources. It is not a final legal determination or official government certificate. Findings do not constitute statutory adjudication or regulatory enforcement action.
      </div>

      {/* Main Verdict Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Inspection Session: <code>{session.inspection_id}</code> &bull; Commodity:{' '}
              <strong>{session.combined_fields?.product_name?.value || session.product_category || 'General Commodity'}</strong>
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              Vendor Compliance Audit Findings
            </h1>
          </div>

          <div>
            <StatusBadge status={session.status} />
          </div>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {session.summary}
        </p>

        {/* Summary Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-elevated)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rules Checked</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{session.requirements_checked || 0}</div>
          </div>
          <div style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--status-pass-bg)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--status-pass-text)' }}>Compliant</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-pass-text)' }}>{session.passed || 0}</div>
          </div>
          <div style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--status-fail-bg)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--status-fail-text)' }}>Potential Issues</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-fail-text)' }}>{session.potential_issues || 0}</div>
          </div>
          <div style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--status-partial-bg)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--status-partial-text)' }}>Needs Review</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-partial-text)' }}>{session.review || 0}</div>
          </div>
        </div>
      </div>

      {/* Submitted Packaging Evidence Panel Strip */}
      {session.evidence && session.evidence.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--primary-600)' }} />
              <span>Packaging Panels ({session.evidence.length})</span>
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEvidenceModalOpen(true)}
            >
              <Eye size={14} />
              <span>Open Visual Evidence Inspector</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {session.evidence.map((item, idx) => (
              <div
                key={item.evidence_id || idx}
                style={{
                  minWidth: '130px',
                  maxWidth: '150px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
                onClick={() => {
                  setSelectedEvidence(item);
                  setIsEvidenceModalOpen(true);
                }}
              >
                <img
                  src={getInspectionImageUrl(session.inspection_id, item.image_id)}
                  alt={`Panel ${item.panel_type}`}
                  style={{ width: '100%', height: '95px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>
                  {item.panel_type || 'PANEL'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings Breakdown and Remediation Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Mandatory Declarations Checklist & Artwork Guidance
          </h3>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({allFindings.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === 'ISSUES' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('ISSUES')}
            >
              Issues ({session.potential_issues || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === 'REVIEW' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('REVIEW')}
            >
              Needs Review ({session.review || 0})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === 'PASS' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveFilter('PASS')}
            >
              Compliant ({session.passed || 0})
            </button>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No findings match the selected status filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredFindings.map((finding, idx) => {
              const ruleId = finding.rule_id || `RULE-${idx}`;
              const guide = VENDOR_REMEDIATION_GUIDES[ruleId] || {};
              const st = (finding.status || '').toUpperCase();
              const isIssue = st === 'NON_COMPLIANT' || st === 'POTENTIAL_ISSUE' || st === 'FAIL';
              const isReview = st === 'NEEDS_REVIEW' || st === 'PARTIALLY_VERIFIABLE' || st === 'UNCLEAR' || st === 'REVIEW';

              return (
                <div
                  key={ruleId}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: isIssue
                      ? 'var(--status-fail-bg)'
                      : isReview
                      ? 'var(--status-partial-bg)'
                      : 'var(--bg-surface-elevated)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {ruleId} &bull; {guide.requirement || finding.requirement_name || 'Legal Metrology Standard'}
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.15rem 0' }}>
                        {finding.requirement_name || finding.rule_name || ruleId}
                      </h4>
                    </div>
                    <StatusBadge status={finding.status} size="sm" />
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                    <strong>Finding:</strong> {finding.explanation || finding.reason || finding.message || 'No specific explanation provided.'}
                  </p>

                  {/* Vendor Correction Advice Box */}
                  {(isIssue || isReview) && guide.correction_guidance && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '0.75rem',
                        fontSize: '0.825rem',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ color: isIssue ? 'var(--status-fail-text)' : 'var(--status-partial-text)' }}>
                        How to Correct Packaging Artwork:
                      </strong>{' '}
                      {guide.correction_guidance}
                    </div>
                  )}

                  {/* Legal Basis reference if available */}
                  {finding.legal_basis && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <strong>Statutory Authority:</strong>{' '}
                      {finding.legal_basis.citation?.authority || 'Department of Consumer Affairs, Government of India'}
                      {finding.legal_basis.citation?.section && ` &bull; Section: ${finding.legal_basis.citation.section}`}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const ev = (session.evidence || []).find((e) => e.rule_id === ruleId) || session.evidence?.[0];
                        if (ev) setSelectedEvidence(ev);
                        setIsEvidenceModalOpen(true);
                      }}
                    >
                      <Eye size={13} />
                      <span>View Visual Evidence</span>
                    </button>
                    {(isIssue || isReview) && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsRecheckModalOpen(true)}
                      >
                        <Upload size={13} />
                        <span>Upload Corrected Panel</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Evidence Modal */}
      {isEvidenceModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setIsEvidenceModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '1100px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>
                Visual Evidence Inspector
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEvidenceModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <ImageViewer
              images={session.evidence || []}
              inspectionId={session.inspection_id}
              selectedEvidence={selectedEvidence}
              onSelectEvidence={setSelectedEvidence}
              showInspector={true}
            />
          </div>
        </div>
      )}

      {/* Re-check / Add Corrected Panel Modal */}
      {isRecheckModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setIsRecheckModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '520px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} />
                <span>Upload Corrected Packaging Panel</span>
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsRecheckModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Upload an updated label photograph or packaging artwork angle. The NiyamCheck compliance engine will re-evaluate the package declarations.
            </p>

            <form onSubmit={handleAddCorrectedPanel}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Target Panel Type:
                </label>
                <select
                  value={recheckPanel}
                  onChange={(e) => setRecheckPanel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="BACK">Back Panel (Mandatory Declarations)</option>
                  <option value="FRONT">Front Panel (Principal Display)</option>
                  <option value="LEFT">Left Side</option>
                  <option value="RIGHT">Right Side</option>
                  <option value="TOP">Top Panel</option>
                  <option value="BOTTOM">Bottom Panel</option>
                  <option value="OTHER">Other / Crimp Area</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Select Replacement Image:
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setRecheckFiles([e.target.files[0]]);
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRecheckModalOpen(false)}
                  disabled={rechecking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={rechecking}
                >
                  {rechecking ? 'Analyzing Corrected Panel...' : 'Run Re-Check Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
