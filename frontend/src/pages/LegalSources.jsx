import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, ShieldCheck, Database, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { getLegalSources, getLegalStatus } from '../api/legal';

export function LegalSources() {
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSourcesAndStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourcesData, statusData] = await Promise.all([
        getLegalSources(),
        getLegalStatus(),
      ]);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setStatus(statusData);
    } catch (err) {
      setError(err.message || 'Failed to retrieve authoritative legal sources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSourcesAndStatus();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Authoritative Statutory Sources & Provenance</h1>
          <p className="page-description">
            Codified statutory instruments governing pre-packaged commodities in India. All verification verdicts are grounded in these official Gazette notifications published by the Department of Consumer Affairs.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadSourcesAndStatus}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          <span>Refresh Sources</span>
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

      {/* Provenance & Knowledge Base Status Cards */}
      {status && (
        <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
          <div className="metric-card">
            <span className="metric-title">Official Acts & Rules</span>
            <span className="metric-value" style={{ color: '#93C5FD' }}>
              {status.documents_count || sources.length}
            </span>
            <span className="metric-footer">Sovereign statutory instruments</span>
          </div>

          <div className="metric-card">
            <span className="metric-title">Granular Legal Chunks</span>
            <span className="metric-value" style={{ color: '#A78BFA' }}>
              {status.chunks_count || 0}
            </span>
            <span className="metric-footer">Rule-level statutory provisions</span>
          </div>

          <div className="metric-card">
            <span className="metric-title">Retrieval Engine</span>
            <span
              className="metric-value"
              style={{ fontSize: '1.25rem', color: '#34D399', marginTop: '0.75rem' }}
            >
              {status.retrieval_method || 'Deterministic BM25'}
            </span>
            <span className="metric-footer">Zero hallucinations / First principles</span>
          </div>

          <div className="metric-card">
            <span className="metric-title">Indexing Timestamp</span>
            <span
              className="metric-value"
              style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}
            >
              {status.last_indexed
                ? new Date(status.last_indexed).toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                  })
                : 'Active'}
            </span>
            <span className="metric-footer">Knowledge base version synchronization</span>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Authoritative Gazette Publications
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Official Gazette publications and statutory orders directly loaded from backend repository.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
            <p>Loading statutory documents...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sources.map((doc, idx) => (
              <div
                key={doc.source_id || idx}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: '#93C5FD',
                        }}
                      >
                        {doc.source_id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34D399',
                        }}
                      >
                        {doc.document_type}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {doc.title}
                    </h3>
                  </div>

                  {doc.source_url && (
                    <a
                      href={doc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Open Official Source</span>
                    </a>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Authority: </span>
                    <span>{doc.authority}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Gazette Notification: </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{doc.version}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Effective Date: </span>
                    <span>{doc.effective_date || doc.publication_date}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                    <span style={{ color: '#34D399', fontWeight: 600 }}>{doc.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
