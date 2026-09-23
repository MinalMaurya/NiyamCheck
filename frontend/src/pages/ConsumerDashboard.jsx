import React, { useEffect, useState } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Package,
  BookOpen,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { listInspections } from '../api/inspections';
import { ConsumerStatusBadge, getConsumerStatus } from '../components/ConsumerStatusBadge';

export function ConsumerDashboard({ onNavigate, onOpenInspection, onLoadDemo }) {
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
      setError(err.message || 'Unable to connect to check records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  // Compute metrics for the 4 consumer categories
  const totalCount = inspections.length;
  const verifiedCount = inspections.filter((s) => {
    const st = (s.status || '').toUpperCase();
    return st === 'COMPLIANT' || st === 'PASS' || st === 'VERIFIED';
  }).length;
  const reviewCount = inspections.filter((s) => {
    const st = (s.status || '').toUpperCase();
    return (
      st === 'PARTIALLY_VERIFIABLE' ||
      st === 'NEEDS_REVIEW' ||
      st === 'REVIEW' ||
      st === 'UNCLEAR'
    );
  }).length;
  const issuesCount = inspections.filter((s) => {
    const st = (s.status || '').toUpperCase();
    return (
      st === 'NON_COMPLIANT' ||
      st === 'POTENTIAL_ISSUE' ||
      st === 'POTENTIAL_ISSUES' ||
      st === 'FAIL'
    );
  }).length;

  return (
    <div className="consumer-dashboard-wrap">
      {/* Hero Welcome Card */}
      <div className="consumer-hero-card">
        <div className="consumer-hero-content">
          <div className="consumer-hero-badge">
            <ShieldCheck size={14} />
            <span>Smart Consumer Assistant &bull; Legal Metrology Check</span>
          </div>
          <h1 className="consumer-hero-title">
            Check Your Packaged Products with Confidence
          </h1>
          <p className="consumer-hero-desc">
            Instantly verify mandatory declarations on packaged goods — Maximum Retail Price (MRP), Net Weight, Dates, Manufacturer details, and Customer Care helpline.
          </p>

          <div className="consumer-hero-actions">
            <button
              type="button"
              className="btn btn-primary consumer-primary-btn touch-btn"
              onClick={() => onNavigate('consumer_check')}
            >
              <Camera size={18} />
              <span>Check a Product</span>
            </button>

            {onLoadDemo && (
              <button
                type="button"
                className="btn btn-secondary consumer-secondary-btn touch-btn"
                onClick={onLoadDemo}
                title="Test with a simulated Parle-G Biscuit sample package"
              >
                <Sparkles size={16} style={{ color: '#F59E0B' }} />
                <span>Try Sample Demo</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm touch-btn"
              onClick={() => onNavigate('consumer_help')}
              title="Learn about your consumer rights"
            >
              <BookOpen size={15} />
              <span>Consumer Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connection Notice if backend offline */}
      {error && (
        <div className="consumer-alert-notice" role="alert">
          <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <div>
            <strong>Service notice: </strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 4 Consumer Summary Metric Cards */}
      <div className="consumer-metrics-grid">
        {/* Total Checked */}
        <div className="consumer-metric-card">
          <div className="consumer-metric-header">
            <span className="consumer-metric-label">Products Checked</span>
            <div className="consumer-metric-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Package size={18} />
            </div>
          </div>
          <div className="consumer-metric-num">{loading ? '...' : totalCount}</div>
          <div className="consumer-metric-hint">Total packages analyzed</div>
        </div>

        {/* Verified */}
        <div className="consumer-metric-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="consumer-metric-header">
            <span className="consumer-metric-label">Verified</span>
            <div className="consumer-metric-icon-wrap" style={{ background: '#ECFDF5', color: '#10B981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="consumer-metric-num" style={{ color: '#065F46' }}>
            {loading ? '...' : verifiedCount}
          </div>
          <div className="consumer-metric-hint">All mandatory labels confirmed</div>
        </div>

        {/* Requires Review */}
        <div className="consumer-metric-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="consumer-metric-header">
            <span className="consumer-metric-label">Requires Review</span>
            <div className="consumer-metric-icon-wrap" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="consumer-metric-num" style={{ color: '#92400E' }}>
            {loading ? '...' : reviewCount}
          </div>
          <div className="consumer-metric-hint">Unobserved angles or single panel</div>
        </div>

        {/* Potential Issues */}
        <div className="consumer-metric-card" style={{ borderLeft: '4px solid #F43F5E' }}>
          <div className="consumer-metric-header">
            <span className="consumer-metric-label">Potential Issues</span>
            <div className="consumer-metric-icon-wrap" style={{ background: '#FFF1F2', color: '#F43F5E' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="consumer-metric-num" style={{ color: '#9F1239' }}>
            {loading ? '...' : issuesCount}
          </div>
          <div className="consumer-metric-hint">Discrepancies flagged for review</div>
        </div>
      </div>

      {/* Main 2-Column Section: Recent Checks & Quick Guidance */}
      <div className="consumer-dashboard-layout">
        {/* Left Column: Recent Product Checks */}
        <div className="consumer-dashboard-main">
          <div className="consumer-section-header">
            <div>
              <h2 className="consumer-section-title">Recent Product Checks</h2>
              <p className="consumer-section-desc">
                Review products you have previously scanned and checked
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm touch-btn"
                onClick={fetchInspections}
                disabled={loading}
                title="Refresh check records"
              >
                <RefreshCw size={13} className={loading ? 'spinning' : ''} />
                <span>Refresh</span>
              </button>
              {inspections.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm touch-btn"
                  onClick={() => onNavigate('consumer_history')}
                >
                  <span>View All ({inspections.length})</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="consumer-loading-card">
              <RefreshCw size={28} className="spinning" style={{ opacity: 0.6, margin: '0 auto 0.75rem' }} />
              <p>Loading your product check history...</p>
            </div>
          ) : inspections.length === 0 ? (
            /* Friendly Empty State */
            <div className="consumer-empty-card">
              <div className="consumer-empty-icon">
                <Package size={36} />
              </div>
              <h3 className="consumer-empty-title">No Products Checked Yet</h3>
              <p className="consumer-empty-desc">
                Check any grocery or packaged item in your pantry or shopping cart. Take a quick photo of the front, back, or price label to get started!
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary touch-btn"
                  onClick={() => onNavigate('consumer_check')}
                >
                  <Camera size={16} />
                  <span>Check Your First Product</span>
                </button>
                {onLoadDemo && (
                  <button
                    type="button"
                    className="btn btn-secondary touch-btn"
                    onClick={onLoadDemo}
                  >
                    <Sparkles size={16} style={{ color: '#F59E0B' }} />
                    <span>Try Sample Product</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Recent Checks List */
            <div className="consumer-checks-list">
              {inspections.slice(0, 5).map((session) => {
                const prodName =
                  session.combined_fields?.product_name?.value ||
                  session.product_name ||
                  'Packaged Commodity';
                const dateStr = session.created_at
                  ? new Intl.DateTimeFormat('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(session.created_at))
                  : 'N/A';
                const imgCount = session.images?.length || 0;

                return (
                  <div key={session.inspection_id} className="consumer-check-item">
                    <div className="consumer-check-info">
                      <div className="consumer-check-name-row">
                        <strong className="consumer-check-name">{prodName}</strong>
                        <ConsumerStatusBadge status={session.status} size="sm" />
                      </div>
                      <div className="consumer-check-meta">
                        <span>{dateStr}</span>
                        <span>&bull;</span>
                        <span>{imgCount} {imgCount === 1 ? 'photo' : 'photos'}</span>
                        <span>&bull;</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                          ID: {session.inspection_id}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm touch-btn consumer-view-btn"
                      onClick={() => onOpenInspection(session.inspection_id)}
                      title={`View findings for ${prodName}`}
                    >
                      <span>View Results</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Educational & Quick Guidance */}
        <div className="consumer-dashboard-sidebar">
          {/* How It Works Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
              How NiyamCheck Works
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Simple 3-step verification for everyday consumers
            </p>

            <div className="consumer-steps-mini">
              <div className="consumer-step-mini-item">
                <div className="consumer-step-mini-num">1</div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                    Snap or Upload
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Take clear photos of the packaging panels (front, back, price tag).
                  </span>
                </div>
              </div>

              <div className="consumer-step-mini-item">
                <div className="consumer-step-mini-num">2</div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                    Instant AI Verification
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Our system reads mandatory declarations under Indian Legal Metrology law.
                  </span>
                </div>
              </div>

              <div className="consumer-step-mini-item">
                <div className="consumer-step-mini-num">3</div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                    Plain-Language Results
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    See what is verified, what needs attention, and what your rights are.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* What to Look For Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
              Mandatory Pack Declarations
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0' }}>
              Key statutory elements required on every pack
            </p>

            <ul className="consumer-key-points-list">
              <li>
                <strong>MRP:</strong> Must state "Inclusive of all taxes".
              </li>
              <li>
                <strong>Net Quantity:</strong> Must use standard metric units (g, kg, ml).
              </li>
              <li>
                <strong>Mfg / Pkd Date:</strong> Month and year must be clear.
              </li>
              <li>
                <strong>Customer Care:</strong> Working phone or email for complaints.
              </li>
            </ul>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}
              onClick={() => onNavigate('consumer_help')}
            >
              <BookOpen size={14} />
              <span>Read Full Consumer Guide</span>
            </button>
          </div>

          {/* National Consumer Helpline Banner */}
          <div className="consumer-helpline-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <PhoneCall size={16} style={{ color: '#2563EB' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Need Help? National Helpline
              </strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
              If you have been overcharged or sold non-compliant packaged goods, contact the National Consumer Helpline at <strong>1915</strong>.
            </p>
            <a
              href="https://consumerhelpline.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.78rem',
                color: '#2563EB',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>consumerhelpline.gov.in</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
