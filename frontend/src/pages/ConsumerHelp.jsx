import React from 'react';
import {
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  PhoneCall,
  ExternalLink,
  BookOpen,
  ArrowLeft,
  Package,
  Scale,
  Sparkles,
  Info,
} from 'lucide-react';

export function ConsumerHelp({ onNavigate }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span className="consumer-pill-tag">
            <BookOpen size={13} />
            Consumer Knowledge Guide
          </span>
        </div>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
          Understanding Product Declarations
        </h1>
        <p className="page-description" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>
          Everything you need to know about mandatory packaging labels, consumer rights, and how to read your NiyamCheck results.
        </p>
      </div>

      {/* About NiyamCheck */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Info size={18} style={{ color: '#2563EB' }} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            What is NiyamCheck?
          </h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
          NiyamCheck is a free consumer tool that helps you verify whether a packaged product carries all the mandatory declarations required under the <strong>Legal Metrology (Packaged Commodities) Rules, 2011</strong> — India's consumer protection law for pre-packed goods.
        </p>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Simply photograph the packaging and our system reads the text, checks for mandatory labels (MRP, Net Weight, Dates, Manufacturer, Customer Care), and gives you a plain-language result — no legal knowledge required.
        </p>
      </div>

      {/* How to Use NiyamCheck */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={18} style={{ color: '#10B981' }} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            How to Check a Product
          </h2>
        </div>
        <ol style={{ paddingLeft: '1.35rem', margin: 0 }}>
          {[
            { step: 'Tap "Check a Product" on the home screen.' },
            { step: 'Upload one or more photos of the packaging — front, back, price label, and side panels are best.' },
            { step: 'Wait a few seconds for the system to read and verify the packaging text.' },
            { step: 'Review your result: what is verified, what needs attention, and what you can do.' },
            { step: 'If something seems wrong, refer to the National Consumer Helpline (1915) for guidance.' },
          ].map((item, i) => (
            <li key={i} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.4rem' }}>
              {item.step}
            </li>
          ))}
        </ol>
      </div>

      {/* How to Capture a Good Photo */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={18} style={{ color: '#F59E0B' }} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            How to Take a Good Photo
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          The quality of your photo directly affects the accuracy of the check. Follow these tips for the best results:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {[
            { icon: '💡', title: 'Good Lighting', desc: 'Use natural light or a bright lamp. Avoid shadows falling across the text.' },
            { icon: '📸', title: 'Fill the Frame', desc: 'Hold the package close enough so text fills most of the frame. Avoid shooting from too far away.' },
            { icon: '🔍', title: 'Stay Focused', desc: 'Tap your phone screen on the text area to focus before shooting. Blurry photos cannot be read.' },
            { icon: '🚫', title: 'Avoid Glare', desc: 'Tilt the package slightly if you see bright reflections. Metallic or glossy packs can reflect camera flash.' },
            { icon: '📦', title: 'Multiple Panels', desc: 'The back, bottom, and side panels often contain MRP, dates, and manufacturer details. Add extra photos if needed.' },
            { icon: '✂️', title: 'Nothing Torn or Hidden', desc: 'Make sure key text is not covered by stickers, price tags, or torn packaging.' },
          ].map((tip) => (
            <div key={tip.icon} className="consumer-capture-tip" style={{ padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '1.4rem', display: 'block', marginBottom: '0.3rem' }}>{tip.icon}</span>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>{tip.title}</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why Results May Require Review */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HelpCircle size={18} style={{ color: '#F43F5E' }} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Why Results Sometimes Say "Requires Review"
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 0.75rem 0' }}>
          A "Requires Review" result does <strong>not</strong> necessarily mean the product is non-compliant. Common reasons include:
        </p>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          {[
            'The required information is on a panel that was not photographed (e.g., the bottom or side).',
            'The text was too small, blurry, or poorly lit for the system to read reliably.',
            'Metallic packaging or embossed printing is harder to detect from photos.',
            'Some declarations are printed in a non-standard location or font size.',
          ].map((reason, i) => (
            <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '0.35rem' }}>
              {reason}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0.75rem 0 0' }}>
          In these cases, adding photos of the remaining panels often improves accuracy. If you believe a product is genuinely missing a required declaration, contact the National Consumer Helpline.
        </p>
      </div>

      {/* 4 Status Badges Explained */}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          Understanding Your Check Results
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          NiyamCheck categorizes each product check into one of four evidence-based statuses:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* 1. Verified */}
          <div className="consumer-help-badge-card" style={{ borderLeft: '4px solid #10B981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: '#10B981' }} />
              <strong style={{ color: '#065F46', fontSize: '0.95rem' }}>Verified</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              All checked mandatory declarations (MRP, Net Weight, Dates, Manufacturer details) were clearly observed on the submitted photos and meet standard requirements.
            </p>
          </div>

          {/* 2. Requires Review */}
          <div className="consumer-help-badge-card" style={{ borderLeft: '4px solid #F59E0B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
              <strong style={{ color: '#92400E', fontSize: '0.95rem' }}>Requires Review</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Some declarations could not be fully verified from the photos provided. The package may have details printed on another face (like the back or bottom). Adding more angles often resolves this.
            </p>
          </div>

          {/* 3. Potential Issue */}
          <div className="consumer-help-badge-card" style={{ borderLeft: '4px solid #F43F5E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertCircle size={18} style={{ color: '#F43F5E' }} />
              <strong style={{ color: '#9F1239', fontSize: '0.95rem' }}>Potential Issue</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              An apparent discrepancy was detected — such as an incomplete price declaration, non-standard measurement units, or missing manufacturing contact info.
            </p>
          </div>

          {/* 4. Not Verifiable */}
          <div className="consumer-help-badge-card" style={{ borderLeft: '4px solid #64748B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <HelpCircle size={18} style={{ color: '#64748B' }} />
              <strong style={{ color: '#334155', fontSize: '0.95rem' }}>Not Verifiable</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              The image was too blurry, dark, reflective, or taken from too far away to reliably read the text. Try re-taking the photo in better lighting.
            </p>
          </div>
        </div>
      </div>

      {/* 8 Mandatory Packaging Declarations */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          8 Things Every Packaged Product Must Show in India
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Under the Legal Metrology (Packaged Commodities) Rules, 2011, manufacturers and sellers are required by law to provide clear declarations on retail packages:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[
            {
              num: '1',
              title: 'Product Identity / Common Name',
              desc: 'Must state the generic or common commodity name (e.g., "Biscuits", "Wheat Flour") on the main display face.',
            },
            {
              num: '2',
              title: 'Net Quantity',
              desc: 'Weight, volume, or count declared in standard metric units (g, kg, ml, l). Words like "approx." or "when packed" are not permitted.',
            },
            {
              num: '3',
              title: 'Maximum Retail Price (MRP)',
              desc: 'Must be declared in Indian Rupees (₹ or Rs.) and explicitly state "Inclusive of all taxes". No retailer can charge above this.',
            },
            {
              num: '4',
              title: 'Date of Manufacture / Packing',
              desc: 'Month and year when the product was manufactured, pre-packed, or imported, ensuring you know its freshness.',
            },
            {
              num: '5',
              title: 'Manufacturer / Packer Name',
              desc: 'The corporate identity of who made or packed the item, fixing accountability.',
            },
            {
              num: '6',
              title: 'Complete Postal Address',
              desc: 'Physical address with city, state, and PIN code where official inquiries or mail can be sent.',
            },
            {
              num: '7',
              title: 'Customer Care Details',
              desc: 'At least one telephone helpline number, email address, or designated grievance officer for consumer complaints.',
            },
            {
              num: '8',
              title: 'Country of Origin',
              desc: 'For all products (domestic or imported), the country of manufacture or assembly must be clearly stated.',
            },
          ].map((item) => (
            <div key={item.num} className="consumer-rule-guide-item">
              <div className="consumer-rule-guide-num">{item.num}</div>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem', display: 'block', marginBottom: '0.2rem' }}>
                  {item.title}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Practical Consumer Steps */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
          What to Do If Something Looks Wrong
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          If a product seems to be missing required information or overcharging above MRP:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div className="consumer-action-box">
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              1. Inspect the Whole Pack
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Check the bottom, sealing crimp, and back panel. Some details (like batch codes or dates) are dot-matrix stamped in discreet places.
            </p>
          </div>

          <div className="consumer-action-box">
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              2. Verify the Bill / Invoice
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Ensure the cash memo matches the printed MRP. Retailers cannot add taxes or service fees on top of the printed Maximum Retail Price.
            </p>
          </div>

          <div className="consumer-action-box">
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              3. Contact the Brand's Care Cell
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Most reputable brands have dedicated consumer care teams who can verify batch codes and resolve product inquiries directly.
            </p>
          </div>

          <div className="consumer-action-box">
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              4. File a Grievance on National Helpline
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Call <strong>1915</strong> or register online with the Department of Consumer Affairs for prompt resolution of unfair trade practices.
            </p>
          </div>
        </div>
      </div>

      {/* Official Grievance Channels Banner */}
      <div className="consumer-helpline-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="consumer-helpline-icon-wrap">
            <PhoneCall size={24} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              National Consumer Helpline (NCH)
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Toll-free Assistance: <strong>1915</strong> (8 AM – 8 PM) &bull; SMS to 8800001915 &bull; Department of Consumer Affairs, GoI
            </p>
          </div>
        </div>
        <a
          href="https://consumerhelpline.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
        >
          <span>consumerhelpline.gov.in</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
