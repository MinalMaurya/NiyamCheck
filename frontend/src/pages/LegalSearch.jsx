import React, { useState } from 'react';
import { Search, BookOpen, ExternalLink, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { searchLegalProvisions } from '../api/legal';

const SUGGESTED_QUERIES = [
  'net quantity',
  'maximum retail price',
  'consumer care complaints',
  'country of origin',
  'manufacturer name and address',
  'month and year of manufacture',
  'unit sale price',
];

export function LegalSearch() {
  const [query, setQuery] = useState('net quantity');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (targetQuery = query) => {
    if (!targetQuery || targetQuery.trim().length < 2) {
      setError('Please enter at least 2 characters for statutory search.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await searchLegalProvisions(targetQuery, 8);
      setResults(response.results || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Legal search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Statutory Legal Knowledge Search</h1>
          <p className="page-description">
            Deterministic lexical search directly across codified Legal Metrology statutory instruments, Gazette notifications, and amendments published by the Department of Consumer Affairs.
          </p>
        </div>
      </div>

      {/* Search Bar Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search legal provisions (e.g. 'net quantity', 'mrp taxes', 'Rule 6')..."
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.5rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <RefreshCw size={16} className="spinning" /> : <Search size={16} />}
            <span>Search Provisions</span>
          </button>
        </form>

        {/* Suggested Query Chips */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Sparkles size={12} style={{ color: '#F59E0B' }} /> Quick queries:
          </span>
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              {sq}
            </button>
          ))}
        </div>
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

      {/* Search Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="spinning" style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
          <p>Searching official statutory provisions...</p>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <BookOpen size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            No Provisions Found
          </h3>
          <p style={{ fontSize: '0.85rem' }}>
            No authoritative legal provisions matched the query "{query}". Try searching with different keywords like "Rule 6", "quantity", or "mrp".
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((item, idx) => (
            <div key={item.chunk_id || idx} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#93C5FD', backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                      {item.rule_number} {item.section ? `(${item.section})` : ''}
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{item.title}</strong>
                  </div>
                </div>

                {item.score !== undefined && (
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#34D399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                    Relevance: {Math.round(item.score * 100)}%
                  </span>
                )}
              </div>

              {/* Citation String */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                <strong>Citation: </strong>
                <span>{item.citation}</span>
              </div>

              {/* Text Snippet */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid #3B82F6',
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  marginBottom: '0.75rem',
                }}
              >
                "{item.text}"
              </div>

              {/* Official Source Link */}
              {item.source_url && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <ExternalLink size={12} />
                    <span>View Official Government Publication</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
