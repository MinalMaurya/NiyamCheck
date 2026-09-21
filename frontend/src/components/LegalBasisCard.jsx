import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

export function LegalBasisCard({ legalBasis = [] }) {
  if (!legalBasis || legalBasis.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-default)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
        }}
      >
        <AlertCircle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span>No authoritative legal provision was retrieved for this finding.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {legalBasis.map((item, index) => {
        const citation = item.citation || {};
        const officialUrl = item.official_url || citation.official_url;
        const sourceTitle = item.source || citation.source_title || 'Legal Metrology (Packaged Commodities) Rules, 2011';
        const ruleNum = item.rule_number || citation.rule_number || '';
        const section = item.section || citation.section || '';
        const authority = citation.authority || 'Department of Consumer Affairs, Government of India';
        const version = citation.version || '';
        const pubDate = citation.publication_date || '';

        return (
          <div
            key={item.chunk_id || index}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={16} style={{ color: 'var(--primary-500)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {sourceTitle}
                </span>
              </div>
              {item.retrieval_score !== undefined && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--status-pass-bg)',
                    color: 'var(--status-pass-text)',
                    border: '1px solid var(--status-pass-border)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Match Score: {(item.retrieval_score * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Provision: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{ruleNum} {section ? `(${section})` : ''}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Authority: </span>
                <span>{authority}</span>
              </div>
              {version && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Version: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{version}</span>
                </div>
              )}
              {pubDate && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                  <span>{pubDate}</span>
                </div>
              )}
            </div>

            {/* Verbatim Excerpt */}
            {item.excerpt && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--status-info)',
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  lineHeight: '1.45',
                }}
              >
                "{item.excerpt}"
              </div>
            )}

            {/* Official Source Link */}
            {officialUrl && (
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  <ExternalLink size={12} />
                  <span>View Official Gazette / Source</span>
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
