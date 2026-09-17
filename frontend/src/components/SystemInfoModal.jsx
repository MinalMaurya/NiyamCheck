import React, { useEffect, useState } from 'react';
import { X, Server, Database, Smartphone, HardDrive, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { getLegalStatus } from '../api/legal';
import { draftStore } from '../storage/draftStore';

export function SystemInfoModal({ isOpen, onClose, isOnline, isPwaInstallable, onInstallPwa }) {
  const [legalStatus, setLegalStatus] = useState(null);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const drafts = await draftStore.listDrafts();
      setDraftCount(drafts.length);

      if (isOnline) {
        const stat = await getLegalStatus();
        setLegalStatus(stat);
      }
    } catch (e) {
      console.warn('Could not load system info:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDrafts = async () => {
    if (confirm('Are you sure you want to clear all locally saved drafts? This action cannot be undone.')) {
      await draftStore.clearAllDrafts();
      setDraftCount(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            System Information & Storage
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Backend & Connectivity */}
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Server size={18} style={{ color: '#3B82F6' }} />
              <strong style={{ fontSize: '0.95rem' }}>Backend Connectivity</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                <span style={{ color: isOnline ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Server: </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>FastAPI (Port 8000)</span>
              </div>
            </div>
          </div>

          {/* Legal Knowledge Base Provenance */}
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Database size={18} style={{ color: '#8B5CF6' }} />
              <strong style={{ fontSize: '0.95rem' }}>Authoritative Legal Metrology RAG</strong>
            </div>
            {loading ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading provenance data...</div>
            ) : legalStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Statutory Acts/Rules: </span>
                  <strong>{legalStatus.documents_count}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Legal Chunks: </span>
                  <strong>{legalStatus.chunks_count}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Retrieval Engine: </span>
                  <span>{legalStatus.retrieval_method || 'Deterministic BM25'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Jurisdiction: </span>
                  <span>India (Department of Consumer Affairs)</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Knowledge base status unavailable while offline.
              </div>
            )}
          </div>

          {/* PWA & Mobile Capabilities */}
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Smartphone size={18} style={{ color: '#10B981' }} />
              <strong style={{ fontSize: '0.95rem' }}>Progressive Web App (PWA)</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Service Worker: </span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>Active (App Shell Cache)</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Camera Access: </span>
                <span>Enabled (Native Environment)</span>
              </div>
            </div>
            {isPwaInstallable && (
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={onInstallPwa}>
                  <Smartphone size={14} />
                  <span>Install NiyamCheck PWA to Home Screen</span>
                </button>
              </div>
            )}
          </div>

          {/* Offline Draft Storage */}
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HardDrive size={18} style={{ color: '#F59E0B' }} />
                <strong style={{ fontSize: '0.95rem' }}>Local Device Draft Storage (IndexedDB)</strong>
              </div>
              {draftCount > 0 && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleClearAllDrafts}
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  <Trash2 size={12} />
                  <span>Clear All</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Saved inspection drafts: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{draftCount}</strong>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
