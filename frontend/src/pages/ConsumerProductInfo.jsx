import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Package,
  Calendar,
  DollarSign,
  Building,
  MapPin,
  PhoneCall,
  Globe,
  Tag,
  Scale,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { getInspection, getInspectionImageUrl } from '../api/inspections';
import { ConsumerStatusBadge } from '../components/ConsumerStatusBadge';
import { parseConsumerProductInfo } from '../utils/consumerUtils';

const FIELD_ICONS = {
  product_name: Tag,
  net_quantity: Scale,
  mrp: DollarSign,
  date_information: Calendar,
  manufacturer: Building,
  address: MapPin,
  consumer_care: PhoneCall,
  country_of_origin: Globe,
};

export function ConsumerProductInfo({
  inspectionId,
  onNavigate,
  onViewFullResult,
  onCheckAnother,
}) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchSessionData = async () => {
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
      setError(err.message || 'Failed to load product information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [inspectionId]);

  if (loading) {
    return (
      <div className="consumer-page-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <RefreshCw size={36} className="spinning" style={{ color: '#10B981', margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          Loading Product Information...
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Retrieving verified declarations and packaging evidence.
        </p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="consumer-page-container" style={{ padding: '2rem 1rem' }}>
        <div className="consumer-alert-notice error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ color: '#F43F5E', flexShrink: 0 }} />
          <div>
            <strong>Error: </strong>
            <span>{error || 'Product information is not available.'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={() => onNavigate('consumer_dashboard')}
          >
            <ArrowLeft size={16} />
            <span>Return to Home</span>
          </button>
          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={fetchSessionData}
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const parsed = parseConsumerProductInfo(session);
  const images = session.images || [];

  const dateStr = session.created_at
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(session.created_at))
    : 'Recently';

  return (
    <div className="consumer-page-container">
      {/* Top Header & Actions */}
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
            <button
              type="button"
              className="btn btn-primary btn-sm touch-btn"
              onClick={onCheckAnother || (() => onNavigate('consumer_check'))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Camera size={14} />
              <span>Check Another Product</span>
            </button>
          </div>
        </div>

        <span className="consumer-pill-tag">
          <Package size={13} style={{ color: '#10B981' }} />
          Product Information Summary
        </span>
      </div>

      {/* Main Product Card */}
      <div className="consumer-product-hero-card">
        <div className="consumer-product-hero-header">
          <div className="consumer-product-hero-titles">
            <span className="consumer-product-category-tag">
              {parsed.productCategory}
            </span>
            <h1 className="consumer-product-title">
              {parsed.productName}
            </h1>
            <div className="consumer-product-brand-line">
              <span>Brand / Maker: </span>
              <strong>{parsed.brandOrMfg}</strong>
            </div>
          </div>

          <div className="consumer-product-status-box">
            <ConsumerStatusBadge status={session.status} size="normal" showDescription={false} />
            <span className="consumer-product-session-id">
              ID: {session.inspection_id}
            </span>
            <span className="consumer-product-date">
              Checked on {dateStr}
            </span>
          </div>
        </div>

        {/* Uploaded Photos Carousel / Row */}
        {images.length > 0 && (
          <div className="consumer-product-images-row">
            <div className="consumer-product-images-label">
              <span>Uploaded Packaging Photos ({images.length}):</span>
            </div>
            <div className="consumer-product-thumbs-list">
              {images.map((img, idx) => {
                const imgUrl = getInspectionImageUrl(session.inspection_id, img.image_id);
                return (
                  <div
                    key={img.image_id}
                    className="consumer-product-thumb-card"
                    onClick={() => setSelectedPhoto({ url: imgUrl, panel: img.panel, idx: idx + 1 })}
                    role="button"
                    tabIndex={0}
                    title={`View ${img.panel} photo`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Panel ${img.panel}`}
                      className="consumer-product-thumb-img"
                      onError={(e) => {
                        // Fallback if direct image not found
                        e.target.style.display = 'none';
                      }}
                    />
                    <span className="consumer-product-thumb-badge">
                      {img.panel || `Photo ${idx + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Declarations Breakdown: Verified vs. Not Verified */}
      <div className="consumer-declarations-layout">
        {/* SECTION 1: Verified Declarations */}
        <div className="consumer-declarations-column">
          <div className="consumer-col-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10B981' }} />
              <h2 className="consumer-col-title">
                Verified Declarations ({parsed.detectedCount})
              </h2>
            </div>
            <span className="consumer-col-subtitle">
              Information clearly detected and confirmed on packaging
            </span>
          </div>

          {parsed.detectedDeclarations.length === 0 ? (
            <div className="consumer-empty-col-card">
              <HelpCircle size={24} style={{ color: '#94A3B8', margin: '0 auto 0.5rem' }} />
              <p>No mandatory declarations were clearly detected on the submitted photo(s).</p>
            </div>
          ) : (
            <div className="consumer-declarations-list">
              {parsed.detectedDeclarations.map((item) => {
                const Icon = FIELD_ICONS[item.id] || Tag;
                return (
                  <div key={item.id} className="consumer-declaration-card detected">
                    <div className="consumer-dec-header">
                      <div className="consumer-dec-title-wrap">
                        <Icon size={16} style={{ color: '#10B981' }} />
                        <strong className="consumer-dec-title">{item.label}</strong>
                      </div>
                      <span className="consumer-verified-pill">
                        Verified
                      </span>
                    </div>

                    <div className="consumer-dec-value-box">
                      <span className="consumer-dec-value">{item.value}</span>
                    </div>

                    <div className="consumer-dec-footer">
                      {item.sourcePanel && (
                        <span className="consumer-dec-panel-hint">
                          Found on {item.sourcePanel} panel
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Could Not Be Verified / Needs Attention */}
        <div className="consumer-declarations-column">
          <div className="consumer-col-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
              <h2 className="consumer-col-title">
                Could Not Be Verified ({parsed.unverifiedCount})
              </h2>
            </div>
            <span className="consumer-col-subtitle">
              Declarations not clearly observed on the submitted photo(s)
            </span>
          </div>

          {parsed.unverifiedDeclarations.length === 0 ? (
            <div className="consumer-all-verified-card">
              <CheckCircle2 size={28} style={{ color: '#10B981', margin: '0 auto 0.5rem' }} />
              <strong>All mandatory declarations confirmed!</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Every required packaging label was observed on the submitted photos.
              </p>
            </div>
          ) : (
            <div className="consumer-declarations-list">
              {parsed.unverifiedDeclarations.map((item) => {
                const Icon = FIELD_ICONS[item.id] || Tag;
                return (
                  <div key={item.id} className="consumer-declaration-card unverified">
                    <div className="consumer-dec-header">
                      <div className="consumer-dec-title-wrap">
                        <Icon size={16} style={{ color: '#94A3B8' }} />
                        <strong className="consumer-dec-title">{item.label}</strong>
                      </div>
                      <span className="consumer-unverified-pill">
                        Unobserved
                      </span>
                    </div>

                    <p className="consumer-dec-reason">
                      {item.reason}
                    </p>

                    <div className="consumer-dec-tip">
                      💡 <span>{item.hint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="consumer-product-info-actions">
        <button
          type="button"
          className="btn btn-secondary touch-btn"
          onClick={() => onNavigate('consumer_dashboard')}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {onViewFullResult && (
            <button
              type="button"
              className="btn btn-secondary touch-btn"
              onClick={() => onViewFullResult(session.inspection_id)}
              title="View full evidence and statutory citations"
            >
              <span>View Full Compliance Report</span>
              <ChevronRight size={15} />
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

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="modal-backdrop" onClick={() => setSelectedPhoto(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">
                Packaging Photo ({selectedPhoto.panel} Face)
              </span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedPhoto(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1rem', textAlign: 'center' }}>
              <img
                src={selectedPhoto.url}
                alt="Product face preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#0F172A',
                }}
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPhoto(null)}
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
