import React from 'react';
import { Shield, Info } from 'lucide-react';

export function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        {/* Statutory Legal Disclaimer */}
        <div className="statutory-disclaimer-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', color: '#93C5FD', fontWeight: 600 }}>
            <Info size={16} />
            <span>Statutory Legal Disclaimer & Regulatory Scope</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem' }}>
            NiyamCheck provides automated document/image analysis and source-linked regulatory information. It is not a substitute for official legal or enforcement determination. Results are limited by submitted images, OCR accuracy, configured rules, and available authoritative sources.
          </p>
        </div>

        {/* Footer Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={14} style={{ color: '#3B82F6' }} />
            <span>NiyamCheck &bull; Smart India Hackathon (SIH 2026) &bull; Problem Statement SIH26034</span>
          </div>
          <div>
            Built with integrity by <strong>Team CodeHexa</strong> &bull; Department of Consumer Affairs, Legal Metrology Rules, 2011
          </div>
        </div>
      </div>
    </footer>
  );
}
