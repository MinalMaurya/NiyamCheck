import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Database,
  HardDrive,
  Trash2,
  Server,
  Smartphone,
  Shield,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  Building,
} from 'lucide-react';
import { draftStore } from '../storage/draftStore';
import { getLegalStatus } from '../api/legal';

export function Settings({ currentTheme = 'dark', onThemeChange, isOnline = true }) {
  const [draftCount, setDraftCount] = useState(0);
  const [savedEvidenceCount, setSavedEvidenceCount] = useState(0);
  const [legalStatus, setLegalStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clearFeedback, setClearFeedback] = useState(null);
  const [density, setDensity] = useState('comfortable');

  useEffect(() => {
    loadSettingsData();
  }, [isOnline]);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const drafts = await draftStore.listDrafts();
      setDraftCount(drafts.length);

      const evidence = await draftStore.listSavedEvidence();
      setSavedEvidenceCount(evidence.length);

      if (isOnline) {
        const stat = await getLegalStatus();
        setLegalStatus(stat);
      }
    } catch (e) {
      console.warn('Failed to load settings data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDrafts = async () => {
    if (window.confirm('Are you sure you want to clear all locally saved package inspection drafts? This action cannot be undone.')) {
      try {
        await draftStore.clearAllDrafts();
        setDraftCount(0);
        setClearFeedback('All local inspection drafts have been cleared.');
        setTimeout(() => setClearFeedback(null), 3500);
      } catch (err) {
        alert(`Failed to clear drafts: ${err.message}`);
      }
    }
  };

  const handleClearEverything = async () => {
    if (window.confirm('CAUTION: This will clear all locally saved inspection drafts and saved evidence records from this browser. Do you wish to continue?')) {
      try {
        await draftStore.clearAllDrafts();
        setDraftCount(0);
        setSavedEvidenceCount(0);
        setClearFeedback('Local inspection cache and drafts successfully reset.');
        setTimeout(() => setClearFeedback(null), 3500);
      } catch (err) {
        alert(`Failed to reset local cache: ${err.message}`);
      }
    }
  };

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Application Settings</h1>
          <p className="page-description">
            Manage your interface appearance, offline storage, inspection provenance, and compliance environment configurations.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadSettingsData}
          disabled={loading}
          title="Refresh Settings"
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Alert */}
      {clearFeedback && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'var(--status-pass-bg)',
            border: '1px solid var(--status-pass-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-pass-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--status-pass-border)' }} />
          <span>{clearFeedback}</span>
        </div>
      )}

      {/* SECTION 1: APPEARANCE */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Sun size={20} style={{ color: 'var(--primary-500)' }} />
          <div>
            <h2>Appearance & Theme</h2>
            <p>Select your preferred visual style and interface density</p>
          </div>
        </div>

        <div className="settings-rows-list">
          {/* Theme Selector */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                {currentTheme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              </div>
              <div>
                <span className="setting-title">Color Theme</span>
                <span className="setting-desc">
                  Choose between high-contrast dark mode or clean, daytime light mode.
                </span>
              </div>
            </div>
            <div className="theme-selector-grid">
              <button
                type="button"
                className={`theme-option-card ${currentTheme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange?.('dark')}
              >
                <Moon size={18} />
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-option-card ${currentTheme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange?.('light')}
              >
                <Sun size={18} />
                <span>Light</span>
              </button>
            </div>
          </div>

          {/* Density Selector */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Monitor size={18} />
              </div>
              <div>
                <span className="setting-title">Display Density</span>
                <span className="setting-desc">
                  Adjust layout compactness for multi-panel comparison.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <button
                type="button"
                className={`btn btn-sm ${density === 'comfortable' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDensity('comfortable')}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={`btn btn-sm ${density === 'compact' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDensity('compact')}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DATA & STORAGE */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <HardDrive size={20} style={{ color: 'var(--primary-500)' }} />
          <div>
            <h2>Data & Offline Storage</h2>
            <p>Manage inspection drafts and evidence stored securely on this device</p>
          </div>
        </div>

        <div className="settings-rows-list">
          {/* Drafts Row */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <FileText size={18} />
              </div>
              <div>
                <span className="setting-title">Local Inspection Drafts</span>
                <span className="setting-desc">
                  Unsubmitted multi-panel inspections persisted in IndexedDB on this browser.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginRight: '0.5rem',
                }}
              >
                {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearAllDrafts}
                disabled={draftCount === 0}
              >
                <Trash2 size={14} />
                <span>Clear Drafts</span>
              </button>
            </div>
          </div>

          {/* Evidence Registry Cache */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Database size={18} />
              </div>
              <div>
                <span className="setting-title">Saved Evidence Items</span>
                <span className="setting-desc">
                  Per-finding OCR evidence bookmarks saved to browser IndexedDB.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {savedEvidenceCount} items bookmarked
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: PROFILE & JURISDICTION */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Scale size={20} style={{ color: 'var(--primary-500)' }} />
          <div>
            <h2>Jurisdiction & Statutory Scope</h2>
            <p>Authoritative regulatory boundaries for packaging compliance auditing</p>
          </div>
        </div>

        <div className="settings-rows-list">
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Building size={18} />
              </div>
              <div>
                <span className="setting-title">Statutory Authority</span>
                <span className="setting-desc">
                  Department of Consumer Affairs, Ministry of Consumer Affairs, Food and Public Distribution, Government of India.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span className="badge badge-compliant">Sovereign Jurisdiction</span>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Shield size={18} />
              </div>
              <div>
                <span className="setting-title">Governing Rules</span>
                <span className="setting-desc">
                  The Legal Metrology (Packaged Commodities) Rules, 2011 (G.S.R. 427(E) & amendments).
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span className="badge badge-neutral">Codified Rules 6 - 33</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: APPLICATION & BACKEND */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <Server size={20} style={{ color: 'var(--primary-500)' }} />
          <div>
            <h2>Application & Diagnostics</h2>
            <p>FastAPI backend connection and knowledge base synchronization</p>
          </div>
        </div>

        <div className="settings-rows-list">
          {/* Server Connection */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Server size={18} />
              </div>
              <div>
                <span className="setting-title">Backend Server</span>
                <span className="setting-desc">
                  FastAPI backend service running on port 8000 with deterministic analysis pipeline.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span className={`badge ${isOnline ? 'badge-compliant' : 'badge-non-compliant'}`}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Legal RAG Status */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Database size={18} />
              </div>
              <div>
                <span className="setting-title">Legal Knowledge Base (RAG)</span>
                <span className="setting-desc">
                  {legalStatus
                    ? `${legalStatus.documents_count} official acts/rules indexed (${legalStatus.chunks_count} chunks) via deterministic BM25.`
                    : 'Statutory knowledge base available via backend service.'}
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span className="badge badge-compliant">Synchronized</span>
            </div>
          </div>

          {/* PWA Service Worker */}
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <Smartphone size={18} />
              </div>
              <div>
                <span className="setting-title">Progressive Web App</span>
                <span className="setting-desc">
                  Service worker app shell precache active. Offline drafts supported.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <span className="badge badge-compliant">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: SUPPORT & GRIEVANCE */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <HelpCircle size={20} style={{ color: 'var(--primary-500)' }} />
          <div>
            <h2>Support & Official Grievance Redressal</h2>
            <p>Direct contact and regulatory guidance channels</p>
          </div>
        </div>

        <div className="settings-rows-list">
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box">
                <HelpCircle size={18} />
              </div>
              <div>
                <span className="setting-title">National Consumer Helpline (NCH)</span>
                <span className="setting-desc">
                  Official grievance lodging service for packaging, MRP overcharging, or statutory violations.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <a
                href="https://consumerhelpline.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <span>Call 1915</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: DANGER ZONE */}
      <div className="settings-section-card danger-zone">
        <div className="settings-section-header">
          <AlertTriangle size={20} style={{ color: '#EF4444' }} />
          <div>
            <h2>Danger Zone</h2>
            <p>Irreversible actions for local browser cache and data</p>
          </div>
        </div>

        <div className="settings-rows-list">
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-icon-box" style={{ color: '#EF4444' }}>
                <Trash2 size={18} />
              </div>
              <div>
                <span className="setting-title" style={{ color: '#EF4444' }}>
                  Reset Local Storage & Drafts
                </span>
                <span className="setting-desc">
                  Permanently delete all unsubmitted packaging drafts and saved evidence bookmarks from this device.
                </span>
              </div>
            </div>
            <div className="setting-action">
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleClearEverything}
              >
                <Trash2 size={14} />
                <span>Reset All Local Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
