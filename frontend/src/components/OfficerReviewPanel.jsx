import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scale,
  Save,
  Lock,
  Unlock,
  Download,
  FileText,
  UserCheck,
  Building,
  Check,
  AlertCircle,
  BadgeAlert,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { updateOfficerReview, downloadReportPdf, downloadReportJsonFile } from '../api/inspections';
import { StatusBadge } from './StatusBadge';
import { useAuth } from '../context/AuthContext';

const REVIEW_DECISIONS = [
  { value: 'CONFIRM_AI_VERDICT', label: 'Accept AI Finding', color: 'var(--text-secondary)' },
  { value: 'ACCEPT_AS_COMPLIANT', label: 'Officer Overruled: Compliant', color: '#10B981' },
  { value: 'CONFIRM_VIOLATION', label: 'Statutory Violation (Notice Required)', color: '#EF4444' },
  { value: 'REQUIRES_FIELD_SAMPLE', label: 'Requires Physical Lab Test', color: '#F59E0B' },
  { value: 'DISMISS_EXEMPT', label: 'Exempt under PCR 2011', color: '#8B5CF6' },
];

const FINAL_VERDICTS = [
  { value: 'COMPLIANT', label: 'Compliant — Package Approved for Retail' },
  { value: 'NON_COMPLIANT_NOTICE', label: 'Non-Compliant — Issue Statutory Notice (Sec 18 / Rule 6)' },
  { value: 'SEIZE_COMMODITY', label: 'Seize Commodity (Section 15 Enforcement)' },
  { value: 'SEND_TO_METROLOGY_LAB', label: 'Send to Regional Metrology Lab for Verification' },
  { value: 'DISMISSED_EXEMPT', label: 'Dismissed — Exempt Commodity' },
];

export function OfficerReviewPanel({ session, onSessionUpdated }) {
  const { currentUser, isOfficer } = useAuth();

  const [officerNotes, setOfficerNotes] = useState('');
  const [findingReviews, setFindingReviews] = useState({});
  const [finalVerdict, setFinalVerdict] = useState('COMPLIANT');
  const [isFinalized, setIsFinalized] = useState(false);
  const [isEditingAfterFinalize, setIsEditingAfterFinalize] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (session) {
      setOfficerNotes(session.officer_notes || '');
      setFindingReviews(session.finding_reviews || {});
      setFinalVerdict(
        session.final_verdict ||
          (session.status === 'COMPLIANT' ? 'COMPLIANT' : 'NON_COMPLIANT_NOTICE')
      );
      setIsFinalized(Boolean(session.is_finalized));
    }
  }, [session]);

  if (!session) return null;

  const findings = session.compliance?.findings || [];
  const isLocked = isFinalized && !isEditingAfterFinalize;

  const handleDecisionChange = (ruleId, decision) => {
    if (isLocked) return;
    setFindingReviews((prev) => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        decision,
      },
    }));
  };

  const handleFindingRemarkChange = (ruleId, remark) => {
    if (isLocked) return;
    setFindingReviews((prev) => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        remark,
      },
    }));
  };

  const handleSave = async (shouldFinalize = false) => {
    setSaving(true);
    setError(null);
    setSaveFeedback(null);

    try {
      const payload = {
        officerName: currentUser?.name || 'Inspecting Officer',
        officerId: currentUser?.badge || 'LM-OFF-MH-4001',
        officerNotes: officerNotes,
        findingReviews: findingReviews,
        finalVerdict: finalVerdict,
        isFinalized: shouldFinalize ? true : isFinalized,
      };

      const updated = await updateOfficerReview(session.inspection_id, payload);
      setIsFinalized(Boolean(updated.is_finalized));
      setIsEditingAfterFinalize(false);
      setSaveFeedback(
        shouldFinalize
          ? 'Inspection successfully finalized and officially signed.'
          : 'Officer review and observations saved.'
      );

      if (onSessionUpdated) {
        onSessionUpdated(updated);
      }

      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update officer review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="card officer-review-panel"
      style={{
        marginTop: '1.75rem',
        padding: '1.5rem',
        background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: isFinalized
          ? '2px solid rgba(139, 92, 246, 0.5)'
          : '2px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isFinalized ? '0 0 25px rgba(139, 92, 246, 0.15)' : 'var(--shadow-md)',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-default)',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                background: isFinalized ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                border: isFinalized ? '1px solid #8B5CF6' : '1px solid var(--primary-500)',
                color: isFinalized ? '#A78BFA' : 'var(--primary-500)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <Shield size={13} />
              {isFinalized ? 'Official Certified Record' : 'Officer Enforcement Station'}
            </span>

            {isFinalized && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  color: '#A78BFA',
                  fontWeight: 600,
                }}
              >
                <Lock size={12} />
                Finalized by {session.officer_name || currentUser?.name}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
            Legal Metrology Officer Review & Statutory Finalization
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Exercise statutory discretion under Section 18 of the Legal Metrology Act, 2009. Review AI findings, append case notes, and issue final compliance determinations.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isFinalized && !isEditingAfterFinalize ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditingAfterFinalize(true)}
              title="Unlock to amend officer determination"
            >
              <Unlock size={14} />
              <span>Amend Review</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                <Save size={14} className={saving ? 'spinning' : ''} />
                <span>Save Notes</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', borderColor: '#7C3AED' }}
              >
                <FileCheck size={14} />
                <span>Finalize & Sign Inspection</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {saveFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--primary-500)',
            borderRadius: 'var(--radius-md)',
            color: '#34D399',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
          }}
        >
          <Check size={16} />
          <span>{saveFeedback}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#FCA5A5',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Officer Credential Stamp */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Inspecting Officer: </span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {session.officer_name || currentUser?.name || 'Inspector R. Sharma'}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Officer Badge / ID: </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-500)', fontWeight: 600 }}>
            {session.officer_id || currentUser?.badge || 'LM-OFF-MH-4001'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Audit Date: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {session.created_at ? new Date(session.created_at).toLocaleString('en-IN') : 'N/A'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Audit Digest (SHA-256): </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {(session.inspection_id || '').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Per-Rule Finding Review Matrix */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Scale size={16} style={{ color: 'var(--primary-500)' }} />
          <span>Statutory Rule Finding Determinations</span>
        </h3>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {findings.map((f) => {
            const ruleReview = findingReviews[f.rule_id] || {};
            const activeDecision = ruleReview.decision || 'CONFIRM_AI_VERDICT';
            const remarkText = ruleReview.remark || '';

            return (
              <div
                key={f.rule_id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  display: 'grid',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary-500)', fontWeight: 700 }}>
                        {f.rule_id}
                      </span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {f.rule_name}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {f.explanation}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI Finding:</span>
                    <StatusBadge status={f.status} size="sm" />
                  </div>
                </div>

                {/* Officer Review Control */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(240px, 1fr) 2fr',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginTop: '0.35rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px dashed var(--border-subtle)',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Officer Determination:
                    </label>
                    <select
                      className="input"
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                      value={activeDecision}
                      onChange={(e) => handleDecisionChange(f.rule_id, e.target.value)}
                      disabled={isLocked}
                    >
                      {REVIEW_DECISIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Officer Remark / Physical Sample Note:
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Add officer remark on this finding (optional)..."
                      value={remarkText}
                      onChange={(e) => handleFindingRemarkChange(f.rule_id, e.target.value)}
                      disabled={isLocked}
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* General Officer Observations & Case Notes */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} style={{ color: 'var(--primary-500)' }} />
          <span>Officer Field Observations & Evidence Remarks</span>
        </h3>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Record retail premises details, batch sampling circumstances, seized quantity, or grounds for compounding under Section 48.
        </p>
        <textarea
          className="input"
          rows={4}
          placeholder="Enter detailed inspection observations, seller verification details, or formal enforcement notes here..."
          value={officerNotes}
          onChange={(e) => setOfficerNotes(e.target.value)}
          disabled={isLocked}
          style={{ width: '100%', resize: 'vertical', fontSize: '0.875rem', lineHeight: '1.5' }}
        />
      </div>

      {/* Final Statutory Determination Selector */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          marginBottom: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BadgeAlert size={16} style={{ color: '#F59E0B' }} />
          <span>Final Statutory Determination</span>
        </h3>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Official conclusion of this Legal Metrology audit under the Legal Metrology Act, 2009.
        </p>

        <div style={{ maxWidth: '600px' }}>
          <select
            className="input"
            value={finalVerdict}
            onChange={(e) => setFinalVerdict(e.target.value)}
            disabled={isLocked}
            style={{ fontWeight: 600, fontSize: '0.9rem', padding: '0.55rem 0.75rem' }}
          >
            {FINAL_VERDICTS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Generation & Audit Download Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Clock size={14} />
          <span>
            {isFinalized && session.finalized_at
              ? `Officially signed on ${new Date(session.finalized_at).toLocaleString('en-IN')}`
              : 'Pending officer signature and final submission'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadReportJsonFile(session.inspection_id)}
          >
            <Download size={14} />
            <span>Audit JSON</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => downloadReportPdf(session.inspection_id)}
          >
            <Download size={14} />
            <span>Download Official PDF Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
