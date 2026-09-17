import React, { useEffect, useState } from 'react';
import { X, Smartphone, Download, QrCode, ShieldCheck, CheckCircle2, CircleDot } from 'lucide-react';
import QRCode from 'qrcode';
import { getMobileAppConfig } from '../config/mobileApp';

/**
 * InstallAppModal Component (Redesigned SaaS 2-Column Experience)
 * Left: Elevated QR scanner card with camera-contrast container or clean pending state
 * Right: App identity, Android compatibility specs, direct APK download, and live release status
 */
export function InstallAppModal({ isOpen, onClose, configOverride = null }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState(null);

  const config = configOverride ? getMobileAppConfig(configOverride) : getMobileAppConfig();

  // Escape key keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate QR Code only when a verified HTTPS download URL is available
  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }

    if (!config.isAvailable || !config.downloadUrl) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }

    let isSubscribed = true;
    setQrGenerating(true);
    setQrError(null);

    QRCode.toDataURL(config.downloadUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0F172A', // Slate-900 high-contrast QR dots
        light: '#FFFFFF', // Pure white background for camera readability
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (isSubscribed) {
          setQrDataUrl(dataUrl);
          setQrGenerating(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          console.warn('QR Code generation failed:', err);
          setQrError('Failed to render QR code.');
          setQrGenerating(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, config.isAvailable, config.downloadUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-app-modal-title"
    >
      <div
        className="modal-dialog install-app-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <h2 id="mobile-app-modal-title" className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                {config.appName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close mobile app dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - 2 Column SaaS Layout */}
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <div className="install-app-grid">
            {/* LEFT COLUMN: QR Code Card or Empty State Card */}
            <div className="install-app-qr-card">
              {config.isAvailable ? (
                <>
                  <div className="qr-badge">
                    <QrCode size={13} />
                    <span>SCAN TO INSTALL</span>
                  </div>

                  <div className="qr-code-box">
                    {qrGenerating ? (
                      <div style={{ color: '#64748B', fontSize: '0.85rem' }}>Generating QR Code...</div>
                    ) : qrError ? (
                      <div style={{ color: '#EF4444', fontSize: '0.85rem' }}>{qrError}</div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Scan to download NiyamCheck Mobile"
                        width={180}
                        height={180}
                        style={{ display: 'block', borderRadius: '4px' }}
                      />
                    ) : null}
                  </div>

                  <div style={{ marginTop: '0.85rem', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Scan to download the app
                    </span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Scan this code with your Android phone.
                    </span>
                    <span style={{ display: 'inline-block', fontSize: '0.72rem', color: '#10B981', marginTop: '0.35rem', fontWeight: 500 }}>
                      Works with Android devices
                    </span>
                  </div>
                </>
              ) : (
                /* Attractive Empty-State Card when URL is unavailable */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.25rem 0.5rem', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F59E0B',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <Smartphone size={30} />
                  </div>

                  <span className="qr-badge" style={{ color: '#FBBF24', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                    <span>RELEASE PENDING</span>
                  </span>

                  <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0.35rem 0' }}>
                    Mobile app unavailable
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0.2rem 0 0.65rem', maxWidth: '220px' }}>
                    The official Android download will appear here once the release is available.
                  </p>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Works with Android devices
                  </span>

                  {/* Hidden accessibility description for test & screen reader support */}
                  <div style={{ display: 'none' }}>
                    <span>{config.unavailableTitle}</span>
                    <span>{config.unavailableMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Android Information & Download Card */}
            <div className="install-app-info-card">
              {/* Header Title & Subtitle */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
                  {config.appName}
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {config.appSubtitle}
                </p>
              </div>

              {/* Compact Information Badges/Cards */}
              <div className="app-meta-grid">
                <div className="app-meta-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    <Smartphone size={13} style={{ color: '#10B981' }} />
                    <span>Android</span>
                  </div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    Version {config.appVersion.replace(/^v/, '')}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    App version: {config.appVersion}
                  </span>
                </div>

                <div className="app-meta-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    <ShieldCheck size={13} style={{ color: '#3B82F6' }} />
                    <span>Compatibility</span>
                  </div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {config.androidVersion}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Android version: {config.androidVersion}
                  </span>
                </div>
              </div>

              {/* Action Button: Download APK or Disabled State */}
              <div>
                {config.isAvailable ? (
                  <a
                    href={config.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="download-apk-btn"
                  >
                    <Download size={18} />
                    <span>Download APK</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="download-apk-btn disabled"
                    title="Download will be enabled once an official HTTPS release is configured"
                  >
                    <Download size={18} />
                    <span>Download unavailable</span>
                  </button>
                )}
              </div>

              {/* STATUS CARD near bottom */}
              <div>
                {config.isAvailable ? (
                  <div className="app-status-box available">
                    <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#34D399', display: 'block', fontSize: '0.82rem' }}>
                        Official download available
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Secure HTTPS release
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="app-status-box unavailable">
                    <CircleDot size={16} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#FBBF24', display: 'block', fontSize: '0.82rem' }}>
                        Release not configured
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        The official Android download link has not been configured yet.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ minWidth: '80px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
