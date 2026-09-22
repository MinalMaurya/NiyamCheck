import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Package,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Info,
  BookOpen,
  PhoneCall,
  ShieldCheck,
  X,
  FileQuestion,
  Sparkles,
} from 'lucide-react';
import { getInspection, getInspectionImageUrl } from '../api/inspections';
import { ConsumerStatusBadge } from '../components/ConsumerStatusBadge';
import { parseConsumerCheckResult } from '../utils/consumerUtils';
import { ImageViewer } from '../components/ImageViewer';

export function ConsumerCheckResult({
  inspectionId,
  onNavigate,
  onViewProductInfo,
  onCheckAnother,
}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [expandedWhy, setExpandedWhy] = useState({});

  const fetchResult = async () => {
    if (!inspectionId) {
      setError('No inspection reference provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getInspection(inspectionId);
      setSession(data);
    } catch (err) {
      setError(err.message || 'Failed to load check results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, [inspectionId]);

  const toggleWhy = (ruleId) => {
    setExpandedWhy((prev) => ({ ...prev, [ruleId]: !prev[ruleId] }));
  };

  // Loading State
  if (loading) {
    return (
      <div className="consumer-page-container" style={{ textAlign: 'center', padding: '4.5rem 1rem' }}>
        <RefreshCw size={36} className="spinning" style={{ color: '#10B981', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          Preparing Your Check Result...
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Compiling evidence and evaluating packaging declarations.
        </p>
      </div>
    );
  }

  // Error State
  if (error || !session) {
    return (
      <div className="consumer-page-container" style={{ padding: '2rem 1rem' }}>
        <div className="consumer-alert-notice error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ color: '#F43F5E', flexShrink: 0 }} />
          <div>
            <strong>Error: </strong>
            <span>{error || 'Check result could not be retrieved.'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={() => onNavigate('consumer_dashboard')}
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </button>
          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={fetchResult}
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const result = parseConsumerCheckResult(session);

  // Incomplete Data State
  if (result.isIncomplete) {
    return (
      <div className="consumer-page-container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div className="consumer-empty-col-card" style={{ maxWidth: '540px', margin: '0 auto 1.5rem' }}>
          <FileQuestion size={40} style={{ color: '#F59E0B', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Incomplete Inspection Data
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            No compliance evaluation findings were returned for this product check session. The photos may not have contained readable packaging text.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={() => onNavigate('consumer_dashboard')}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={onCheckAnother || (() => onNavigate('consumer_check'))}
          >
            <Camera size={16} />
            <span>Check Another Product</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="consumer-page-container">
      {/* Top Header & Breadcrumb Actions */}
      <div className="consumer-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm touch-btn"
            onClick={() => onNavigate('consumer_dashboard')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Home</span>
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {onViewProductInfo && (
              <button
                type="button"
                className="btn btn-secondary btn-sm touch-btn"
                onClick={onViewProductInfo}
              >
                <Package size={14} />
                <span>Product Information</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm touch-btn"
              onClick={onCheckAnother || (() => onNavigate('consumer_check'))}
            >
              <Camera size={14} />
              <span>Check Another</span>
            </button>
          </div>
        </div>

        <span className="consumer-pill-tag">
          <ShieldCheck size={13} style={{ color: '#10B981' }} />
          Compliance Check Result
        </span>
      </div>

      {/* Main Verdict Card (4 Categories) */}
      <div className={`consumer-verdict-hero ${result.consumerStatus.badgeClass}`}>
        <div className="consumer-verdict-content">
          <div className="consumer-verdict-badge-row">
            <ConsumerStatusBadge status={session.status} size="normal" showDescription={false} />
            <span className="consumer-verdict-id">Reference: {session.inspection_id}</span>
          </div>

          <h1 className="consumer-verdict-title">{result.verdictTitle}</h1>
          <p className="consumer-verdict-desc">{result.verdictDescription}</p>

          <div className="consumer-verdict-metrics-pills">
            <span className="consumer-metric-pill ok">
              <CheckCircle2 size={13} />
              <span>{result.okCount} Verified OK</span>
            </span>

            {result.attentionCount > 0 && (
              <span className="consumer-metric-pill attention">
                <AlertTriangle size={13} />
                <span>{result.attentionCount} Need Attention</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2-Column Findings Layout: "What is OK?" vs "What Needs Attention?" */}
      <div className="consumer-results-grid">
        {/* COLUMN 1: What is OK? */}
        <div className="consumer-results-col">
          <div className="consumer-results-col-header ok">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10B981' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                What is OK? ({result.okCount})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Mandatory declarations confirmed on packaging
            </span>
          </div>

          {result.okFindings.length === 0 ? (
            <div className="consumer-empty-col-card">
              <HelpCircle size={28} style={{ color: '#94A3B8', margin: '0 auto 0.5rem' }} />
              <p>No mandatory declarations could be confirmed on the submitted packaging photo(s).</p>
            </div>
          ) : (
            <div className="consumer-findings-list">
              {result.okFindings.map((item) => {
                const isWhyOpen = Boolean(expandedWhy[item.ruleId]);
                return (
                  <div key={item.ruleId} className="consumer-finding-card ok">
                    <div className="consumer-finding-header">
                      <strong className="consumer-finding-title">{item.simpleName}</strong>
                      <span className="consumer-verified-pill">Verified</span>
                    </div>

                    <p className="consumer-finding-reason">{item.reason}</p>

                    {/* Evidence Snippet */}
                    {item.evidenceText && (
                      <div className="consumer-finding-evidence-snippet">
                        <span className="consumer-evidence-label">Detected on pack:</span>
                        <strong className="consumer-evidence-text">"{item.evidenceText}"</strong>
                        {item.evidencePanel && (
                          <span className="consumer-evidence-panel">({item.evidencePanel} Panel)</span>
                        )}
                      </div>
                    )}

                    {/* "Why does this matter?" Collapsible */}
                    <div className="consumer-why-wrap">
                      <button
                        type="button"
                        className="consumer-why-toggle-btn"
                        onClick={() => toggleWhy(item.ruleId)}
                        aria-expanded={isWhyOpen}
                      >
                        <Info size={13} />
                        <span>Why does this matter?</span>
                      </button>

                      {isWhyOpen && (
                        <div className="consumer-why-content">
                          <p>{item.whyItMatters}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMN 2: What Needs Attention? */}
        <div className="consumer-results-col">
          <div className="consumer-results-col-header attention">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                What Needs Attention? ({result.attentionCount})
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Declarations that are unobserved or require closer review
            </span>
          </div>

          {result.attentionFindings.length === 0 ? (
            <div className="consumer-all-verified-card">
              <CheckCircle2 size={32} style={{ color: '#10B981', margin: '0 auto 0.6rem' }} />
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                No Issues Flagged!
              </strong>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Every checked statutory declaration was verified on the submitted packaging images.
              </p>
            </div>
          ) : (
            <div className="consumer-findings-list">
              {result.attentionFindings.map((item) => {
                const isWhyOpen = Boolean(expandedWhy[item.ruleId]);
                const badgeClass = item.isIssue ? 'consumer-unverified-pill issue' : 'consumer-unverified-pill';

                return (
                  <div key={item.ruleId} className={`consumer-finding-card ${item.isIssue ? 'issue' : 'review'}`}>
                    <div className="consumer-finding-header">
                      <strong className="consumer-finding-title">{item.simpleName}</strong>
                      <span className={badgeClass}>{item.category}</span>
                    </div>

                    <p className="consumer-finding-reason">{item.reason}</p>

                    {/* Consumer Advice Box */}
                    <div className="consumer-finding-advice-box">
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                        💡 What you can do:
                      </span>
                      <span>{item.consumerAdvice}</span>
                    </div>

                    {/* "Why does this matter?" Collapsible */}
                    <div className="consumer-why-wrap">
                      <button
                        type="button"
                        className="consumer-why-toggle-btn"
                        onClick={() => toggleWhy(item.ruleId)}
                        aria-expanded={isWhyOpen}
                      >
                        <Info size={13} />
                        <span>Why does this matter?</span>
                      </button>

                      {isWhyOpen && (
                        <div className="consumer-why-content">
                          <p>{item.whyItMatters}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Non-Accusatory Consumer Notice */}
      <div className="consumer-disclaimer-notice" style={{ marginTop: '1.5rem' }}>
        <Info size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          <strong>Consumer Notice:</strong> NiyamCheck evaluates declarations solely from visible packaging photos. If a declaration is marked as unobserved, it may be printed on another surface of the package. This tool assists in consumer awareness and does not constitute an official government enforcement determination.
        </p>
      </div>

      {/* National Consumer Helpline Card */}
      <div className="consumer-helpline-banner" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="consumer-helpline-icon-wrap">
            <PhoneCall size={24} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.2rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              National Consumer Helpline (NCH)
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Toll-Free Helpline: <strong>1915</strong> &bull; SMS to 8800001915 &bull; consumerhelpline.gov.in
            </p>
          </div>
        </div>

        <a
          href="https://consumerhelpline.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          <span>Official Portal</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Bottom Sticky Actions */}
      <div className="consumer-product-info-actions" style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary touch-btn"
          onClick={() => onNavigate('consumer_dashboard')}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {onViewProductInfo && (
            <button
              type="button"
              className="btn btn-secondary touch-btn"
              onClick={onViewProductInfo}
            >
              <Package size={15} />
              <span>Product Information</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary touch-btn consumer-primary-btn"
            onClick={onCheckAnother || (() => onNavigate('consumer_check'))}
          >
            <Camera size={16} />
            <span>Check Another Product</span>
          </button>
        </div>
      </div>
    </div>
  );
}
