import React, { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Package,
  Search,
  X,
} from 'lucide-react';
import { listInspections } from '../api/inspections';
import { ConsumerStatusBadge } from '../components/ConsumerStatusBadge';
import { getConsumerStatus } from '../utils/consumerUtils';

/**
 * Consumer-friendly Check History page.
 * Shows previous product checks in a card layout with plain-language summaries.
 */
export function ConsumerHistory({ onNavigate, onOpenCheck }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInspections();
      setInspections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load your check history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filter logic
  const filtered = inspections.filter((session) => {
    const name = (
      session.combined_fields?.product_name?.value ||
      session.product_name ||
      ''
    ).toLowerCase();
    const id = (session.inspection_id || '').toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || id.includes(searchTerm.toLowerCase());

    if (filterStatus === 'ALL') return matchesSearch;
    const cStatus = getConsumerStatus(session.status);
    return matchesSearch && cStatus.category === filterStatus;
  });

  const filterOptions = [
    { key: 'ALL', label: 'All Checks' },
    { key: 'Verified', label: 'Verified' },
    { key: 'Requires Review', label: 'Requires Review' },
    { key: 'Potential Issue', label: 'Potential Issue' },
    { key: 'Not Verifiable', label: 'Not Verifiable' },
  ];

  return (
    <div className="consumer-page-container">
      {/* Header */}
      <div className="consumer-header" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('consumer_dashboard')}
          style={{ marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ArrowLeft size={15} />
          <span>Back to Home</span>
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="consumer-pill-tag">
              <HistoryIcon size={13} />
              My Product Checks
            </span>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.4rem 0 0.3rem' }}>
              Check History
            </h1>
            <p className="page-description" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              All products you have checked, with their results.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm touch-btn"
            onClick={loadHistory}
            disabled={loading}
            aria-label="Refresh check history"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="consumer-alert-notice" role="alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
          <div>
            <strong>Couldn't load history: </strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadHistory}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search + Filter Bar */}
      {!loading && !error && (
        <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or reference ID…"
              aria-label="Search check history"
              style={{
                width: '100%',
                padding: '0.55rem 2.2rem 0.55rem 2.2rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: '0', lineHeight: 1,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`btn btn-sm ${filterStatus === opt.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterStatus(opt.key)}
                aria-pressed={filterStatus === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="consumer-loading-card" style={{ minHeight: '200px' }}>
          <RefreshCw size={32} className="spinning" style={{ opacity: 0.6, margin: '0 auto 0.75rem' }} />
          <p>Loading your check history…</p>
        </div>
      )}

      {/* Empty: No checks at all */}
      {!loading && !error && inspections.length === 0 && (
        <div className="consumer-empty-card">
          <div className="consumer-empty-icon">
            <Package size={36} />
          </div>
          <h3 className="consumer-empty-title">No Products Checked Yet</h3>
          <p className="consumer-empty-desc">
            Check any grocery or packaged item — take a quick photo of the front, back, or price label to get started!
          </p>
          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={() => onNavigate('consumer_check')}
          >
            <Camera size={16} />
            <span>Check Your First Product</span>
          </button>
        </div>
      )}

      {/* Empty: Search/filter returned no results */}
      {!loading && !error && inspections.length > 0 && filtered.length === 0 && (
        <div className="consumer-empty-card">
          <div className="consumer-empty-icon">
            <Search size={32} />
          </div>
          <h3 className="consumer-empty-title">No Matching Checks</h3>
          <p className="consumer-empty-desc">
            No previous checks match your search or filter.{' '}
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-500)', fontWeight: 600, padding: 0 }}
            >
              Clear filters
            </button>
          </p>
        </div>
      )}

      {/* History Cards */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Showing {filtered.length} of {inspections.length} check{inspections.length !== 1 ? 's' : ''}
          </p>

          <div className="consumer-history-list">
            {filtered.map((session) => {
              const productName =
                session.combined_fields?.product_name?.value ||
                session.product_name ||
                'Packaged Commodity';

              const dateStr = session.created_at
                ? new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.created_at))
                : null;

              const imgCount = session.images?.length || 0;
              const cStatus = getConsumerStatus(session.status);

              // Compute OK vs attention counts from compliance evaluations
              const evaluations = session.compliance?.evaluations || session.findings || [];
              const okCount = evaluations.filter(
                (e) => (e.status || '').toUpperCase() === 'PASS' || (e.status || '').toUpperCase() === 'COMPLIANT'
              ).length;
              const attentionCount = evaluations.length - okCount;

              return (
                <div key={session.inspection_id} className="consumer-history-card">
                  <div className="consumer-history-card-left">
                    {/* Status colour strip */}
                    <div
                      className="consumer-history-status-strip"
                      style={{ backgroundColor: cStatus.color }}
                      aria-hidden="true"
                    />
                    <div className="consumer-history-card-body">
                      <div className="consumer-history-name-row">
                        <strong className="consumer-history-name">{productName}</strong>
                        <ConsumerStatusBadge status={session.status} size="sm" />
                      </div>

                      <div className="consumer-history-meta">
                        {dateStr && <span>{dateStr}</span>}
                        {dateStr && <span aria-hidden="true">·</span>}
                        <span>{imgCount} {imgCount === 1 ? 'photo' : 'photos'}</span>
                        {evaluations.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: '#10B981' }}>
                              <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                              {okCount} verified
                            </span>
                            {attentionCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span style={{ color: '#F59E0B' }}>
                                  <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                                  {attentionCount} to review
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                        Ref: {session.inspection_id}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm touch-btn consumer-view-btn"
                    onClick={() => onOpenCheck(session.inspection_id)}
                    aria-label={`View result for ${productName}`}
                  >
                    <span>View Result</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-primary touch-btn"
              onClick={() => onNavigate('consumer_check')}
            >
              <Camera size={16} />
              <span>Check Another Product</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
