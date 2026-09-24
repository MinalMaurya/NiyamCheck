import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  FileText,
  Download,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { listInspections, downloadReportPdf } from '../api/inspections';
import { StatusBadge } from '../components/StatusBadge';

// Codified Legal Metrology rule identifiers and user-friendly labels
const RULE_NAMES = {
  'LM-PN-001': 'Product / Generic Commodity Name',
  'LM-NQ-001': 'Net Quantity Metric Declaration',
  'LM-MRP-001': 'Maximum Retail Price (MRP)',
  'LM-MFG-001': 'Manufacturer / Packer Identity',
  'LM-ADDR-001': 'Complete Postal Address',
  'LM-DATE-001': 'Date of Manufacture / Packaging',
  'LM-CC-001': 'Consumer Care Contact Details',
  'LM-COO-001': 'Country of Origin Declaration',
};

const RULE_CATEGORIES = {
  'LM-PN-001': 'Identity',
  'LM-NQ-001': 'Quantity',
  'LM-MRP-001': 'Pricing',
  'LM-MFG-001': 'Accountability',
  'LM-ADDR-001': 'Accountability',
  'LM-DATE-001': 'Consumer Info',
  'LM-CC-001': 'Consumer Redressal',
  'LM-COO-001': 'Trade & Origin',
};

export function Dashboard({ onNavigate, onOpenInspection, onLoadDemo }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMethodology, setShowMethodology] = useState(false);

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
  const verifiedCount = inspections.filter(
    (s) => s.status === 'COMPLIANT' || s.status === 'PASS'
  ).length;
  const needsReviewCount = inspections.filter(
    (s) =>
      s.status === 'PARTIALLY_VERIFIABLE' ||
      s.status === 'NEEDS_REVIEW' ||
      s.status === 'REVIEW' ||
      s.status === 'UNCLEAR' ||
      s.status === 'NOT_VERIFIABLE'
  ).length;
  const potentialIssuesCount = inspections.filter(
    (s) =>
      s.status === 'NON_COMPLIANT' ||
      s.status === 'POTENTIAL_ISSUE' ||
      s.status === 'FAIL'
  ).length;

  // Aggregate common findings based on real inspection data
  const computeCommonFindings = () => {
    if (inspections.length === 0) return [];

    const stats = {};

    inspections.forEach((session) => {
      // Extract findings from findings list or compliance evaluations
      const findingsList =
        session.findings && session.findings.length > 0
          ? session.findings
          : session.compliance?.evaluations || [];

      const seenRulesInSession = new Set();

      findingsList.forEach((f) => {
        const ruleId = f.rule_id || f.id;
        if (!ruleId) return;

        const rawStatus = (f.status || '').toUpperCase();
        const isIssue =
          rawStatus === 'FAIL' ||
          rawStatus === 'NON_COMPLIANT' ||
          rawStatus === 'POTENTIAL_ISSUE';
        const isReview =
          rawStatus === 'REVIEW' ||
          rawStatus === 'NEEDS_REVIEW' ||
          rawStatus === 'UNCLEAR' ||
          rawStatus === 'PARTIALLY_VERIFIABLE' ||
          rawStatus === 'NOT_VERIFIABLE';

        // Only aggregate non-passing findings
        if (!isIssue && !isReview) return;

        if (!stats[ruleId]) {
          stats[ruleId] = {
            ruleId,
            name: f.name || RULE_NAMES[ruleId] || ruleId,
            category: f.category || RULE_CATEGORIES[ruleId] || 'Statutory Compliance',
            flaggedCount: 0,
            issueCount: 0,
            reviewCount: 0,
          };
        }

        if (!seenRulesInSession.has(ruleId)) {
          seenRulesInSession.add(ruleId);
          stats[ruleId].flaggedCount += 1;
        }

        if (isIssue) {
          stats[ruleId].issueCount += 1;
        } else if (isReview) {
          stats[ruleId].reviewCount += 1;
        }
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.flaggedCount - a.flaggedCount || b.issueCount - a.issueCount)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percentage: totalCount > 0 ? Math.round((item.flaggedCount / totalCount) * 100) : 0,
      }));
  };

  const commonFindings = computeCommonFindings();

  return (
    <div>
      {/* Top Section: Inspection Command Center */}
      <div className="page-header command-center-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--status-pass-bg)',
                color: 'var(--status-pass-text)',
                border: '1px solid var(--status-pass-border)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-pass)' }} />
              Inspection Command Center
            </span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            NiyamCheck
          </h1>
          <p className="page-description" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>
            Legal Metrology Inspection Platform &bull; Automated Packaged Commodity Verification
          </p>
        </div>

        {/* Primary CTA & Command Actions */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={fetchInspections}
            disabled={loading}
            title="Refresh Inspection Data"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>

          {onLoadDemo && (
            <button
              type="button"
              className="btn btn-secondary touch-btn"
              onClick={onLoadDemo}
              title="Load Parle-G Biscuit sample packaging panels"
            >
              <Sparkles size={15} style={{ color: 'var(--status-partial)' }} />
              <span>Load Demo</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={() => onNavigate('new_inspection')}
            style={{ fontWeight: 600, padding: '0.65rem 1.25rem' }}
          >
            <PlusCircle size={18} />
            <span>+ New Inspection</span>
          </button>
        </div>
      </div>

      {/* Error alert if backend offline */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
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
          <AlertTriangle size={20} style={{ color: 'var(--status-fail)', flexShrink: 0 }} />
          <div>
            <strong>Connection Notice: </strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 4 Summary Cards (Derived strictly from real inspections) */}
      <div className="metrics-grid">
        {/* Total Inspections */}
        <div className="metric-card" style={{ borderLeft: '4px solid var(--primary-500)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--text-secondary)' }}>
              Total Inspections
            </span>
            <Layers size={18} style={{ color: 'var(--primary-500)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--text-primary)' }}>
            {loading ? '...' : totalCount}
          </span>
          <span className="metric-footer">All recorded package audits</span>
        </div>

        {/* Verified */}
        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-pass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-pass-text)' }}>
              Verified
            </span>
            <CheckCircle size={18} style={{ color: 'var(--status-pass)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-pass-text)' }}>
            {loading ? '...' : verifiedCount}
          </span>
          <span className="metric-footer">Passed all mandatory rules</span>
        </div>

        {/* Needs Review */}
        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-partial)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-partial-text)' }}>
              Needs Review
            </span>
            <AlertTriangle size={18} style={{ color: 'var(--status-partial)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-partial-text)' }}>
            {loading ? '...' : needsReviewCount}
          </span>
          <span className="metric-footer">Single panel or unverified angles</span>
        </div>

        {/* Potential Issues */}
        <div className="metric-card" style={{ borderLeft: '4px solid var(--status-fail)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-title" style={{ color: 'var(--status-fail-text)' }}>
              Potential Issues
            </span>
            <XCircle size={18} style={{ color: 'var(--status-fail)' }} />
          </div>
          <span className="metric-value" style={{ color: 'var(--status-fail-text)' }}>
            {loading ? '...' : potentialIssuesCount}
          </span>
          <span className="metric-footer">Statutory discrepancies flagged</span>
        </div>
      </div>

      {/* Command Center 2-Column Grid: Recent Inspections & Common Findings */}
      <div className="dashboard-command-grid">
        {/* COLUMN 1: Recent Inspections */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Recent Inspections
                </h2>
                {inspections.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {inspections.length} recorded
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Latest packaging audits executed across retail and distributor samples
              </p>
            </div>

            {inspections.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm touch-btn"
                onClick={() => onNavigate('history')}
              >
                <span>View All History</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
              <p>Loading inspection sessions from backend...</p>
            </div>
          ) : inspections.length === 0 ? (
            /* Clean Empty State */
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
                  className="btn btn-primary touch-btn"
                  onClick={() => onNavigate('new_inspection')}
                >
                  <PlusCircle size={16} />
                  <span>Create First Inspection</span>
                </button>
                {onLoadDemo && (
                  <button
                    type="button"
                    className="btn btn-secondary touch-btn"
                    onClick={onLoadDemo}
                  >
                    <Sparkles size={16} style={{ color: 'var(--status-partial)' }} />
                    <span>Load Sample Demonstration</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View: Clean Table */}
              <div className="table-container desktop-inspection-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product / Commodity</th>
                      <th>Inspection Date</th>
                      <th>Captured Images</th>
                      <th>Overall Result</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.slice(0, 6).map((session) => {
                      const prodName =
                        session.combined_fields?.product_name?.value ||
                        session.product_name ||
                        'Unidentified Commodity';
                      const dateStr = session.created_at
                        ? new Intl.DateTimeFormat('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(session.created_at))
                        : 'N/A';
                      const imgCount = session.images?.length || 0;

                      return (
                        <tr key={session.inspection_id}>
                          <td>
                            <div>
                              <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.9rem' }}>
                                {prodName}
                              </strong>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary-500)' }}>
                                {session.inspection_id}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            {dateStr}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '0.18rem 0.55rem',
                                backgroundColor: 'var(--bg-surface-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {imgCount} {imgCount === 1 ? 'panel' : 'panels'}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={session.status} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm touch-btn"
                                onClick={() => onOpenInspection(session.inspection_id)}
                                title={`View detailed inspection findings for ${session.inspection_id}`}
                              >
                                <FileText size={14} />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm touch-btn"
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

              {/* Mobile View: Responsive Inspection Cards */}
              <div className="recent-inspection-mobile-list">
                {inspections.slice(0, 6).map((session) => {
                  const prodName =
                    session.combined_fields?.product_name?.value ||
                    session.product_name ||
                    'Unidentified Commodity';
                  const dateStr = session.created_at
                    ? new Intl.DateTimeFormat('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(session.created_at))
                    : 'N/A';
                  const imgCount = session.images?.length || 0;

                  return (
                    <div key={session.inspection_id} className="recent-inspection-mobile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', display: 'block' }}>
                            {prodName}
                          </strong>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary-500)' }}>
                            {session.inspection_id}
                          </span>
                        </div>
                        <StatusBadge status={session.status} size="sm" />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        <span>{dateStr}</span>
                        <span>{imgCount} {imgCount === 1 ? 'panel' : 'panels'}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm touch-btn"
                          style={{ flex: 1 }}
                          onClick={() => onOpenInspection(session.inspection_id)}
                        >
                          <FileText size={14} />
                          <span>View Details</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm touch-btn"
                          title="Download PDF Report"
                          onClick={() => downloadReportPdf(session.inspection_id)}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* COLUMN 2: Common Findings */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <TrendingDown size={18} style={{ color: 'var(--status-partial)' }} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Common Findings
                </h2>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Most frequent statutory findings across evaluated commodities
              </p>
            </div>
            {commonFindings.length > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--status-partial-text)',
                  backgroundColor: 'var(--status-partial-bg)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--status-partial-border)',
                }}
              >
                Top {commonFindings.length}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
              <p style={{ fontSize: '0.85rem' }}>Aggregating compliance analytics...</p>
            </div>
          ) : commonFindings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {commonFindings.map((finding, idx) => (
                <div key={finding.ruleId} className="common-finding-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--primary-500)',
                        backgroundColor: 'var(--status-pass-bg)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        border: '1px solid var(--status-pass-border)',
                      }}
                    >
                      #{idx + 1} {finding.ruleId}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {finding.flaggedCount} {finding.flaggedCount === 1 ? 'package' : 'packages'} ({finding.percentage}%)
                    </span>
                  </div>

                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                    {finding.name}
                  </div>

                  {/* Percentage Progress Bar */}
                  <div className="finding-bar-track">
                    <div
                      className="finding-bar-fill"
                      style={{
                        width: `${Math.min(finding.percentage, 100)}%`,
                        backgroundColor: finding.issueCount > 0 ? 'var(--status-fail)' : 'var(--status-partial)',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>{finding.category}</span>
                    <span>
                      {finding.issueCount > 0 && (
                        <strong style={{ color: 'var(--status-fail-text)', marginRight: '0.4rem' }}>
                          {finding.issueCount} {finding.issueCount === 1 ? 'issue' : 'issues'}
                        </strong>
                      )}
                      {finding.reviewCount > 0 && (
                        <span style={{ color: 'var(--status-partial-text)' }}>
                          {finding.reviewCount} {finding.reviewCount === 1 ? 'review' : 'reviews'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clean Frontend-Ready Section when no recurring discrepancies exist */
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-pass-bg)',
                  color: 'var(--status-pass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                  border: '1px solid var(--status-pass-border)',
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No Recurring Compliance Discrepancies
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 auto 1rem', maxWidth: '280px' }}>
                {totalCount > 0
                  ? 'All evaluated packages currently satisfy mandatory codified declarations without flagged discrepancies.'
                  : 'No package inspections recorded yet. Compliance findings will automatically aggregate here as inspections are executed.'}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Analytics pipeline ready &bull; /api/v1/inspections
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Multimodal Legal Metrology Verification Engine Info Card (Collapsible) */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setShowMethodology(!showMethodology)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setShowMethodology(!showMethodology);
          }}
          aria-expanded={showMethodology}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Info size={18} style={{ color: 'var(--primary-500)' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Multimodal Legal Metrology Verification Architecture
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Why OCR alone is not enough for Packaged Commodities compliance &bull; 3-step pipeline
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm touch-btn"
            style={{ padding: '0.3rem 0.5rem' }}
            aria-label={showMethodology ? 'Collapse architecture explanation' : 'Expand architecture explanation'}
          >
            {showMethodology ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showMethodology && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: '1.25rem' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.88rem' }}>
                OCR can read raw characters, but retail packages are physically complex and 3-dimensional. Declarations may be small, distorted, curved, or spread across multiple panels. Without layout geometry, contextual disambiguation, and codified legal rules, an automated system cannot reliably determine whether a label is complete, legible, correctly positioned on the Principal Display Panel (PDP), and legally compliant under the Legal Metrology (Packaged Commodities) Rules, 2011.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {[
                {
                  title: 'Complex Packaging Surfaces',
                  text: 'Mandatory declarations are distributed across Front, Back, Sides, and Top panels—not on a single flat surface.',
                },
                {
                  title: 'Visual Legibility & Contrast',
                  text: 'Font sizes, reflection, glare, and curved contours require geometric measurement beyond flat OCR.',
                },
                {
                  title: 'Contextual Disambiguation',
                  text: 'MRP, batch numbers, net weights, and customer care numbers often appear close together and require semantic context.',
                },
                {
                  title: 'Codified Legal Placement',
                  text: 'Rules require specific declarations (e.g., Net Quantity on PDP) to be placed in defined zones with minimum font heights.',
                },
              ].map((item) => (
                <div key={item.title} style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.title}</h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.82rem' }}>{item.text}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--status-info-bg)', border: '1px solid var(--status-info-border)' }}>
              <div style={{ fontWeight: 700, color: 'var(--status-info-text)', fontSize: '0.9rem' }}>
                3-Step Deterministic Multimodal Workflow
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {[
                  { title: '1. Capture', text: 'Multi-panel photography and panel geometry analysis.' },
                  { title: '2. Interpret', text: 'OCR text detection with spatial bounding-box tagging.' },
                  { title: '3. Verify', text: 'Deterministic evaluation against codified Rules, 2011 with Gazette citations.' },
                ].map((step) => (
                  <div key={step.title} style={{ padding: '0.75rem 0.85rem', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                    <strong style={{ color: 'var(--status-info-text)', display: 'block', marginBottom: '0.2rem' }}>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
