import React, { useState } from 'react';
import {
  Scale,
  PlusCircle,
  LayoutDashboard,
  History,
  Search,
  BookOpen,
  Menu,
  X,
  Smartphone,
  Info,
  Wifi,
  WifiOff,
} from 'lucide-react';

export function Navbar({
  activeTab,
  setActiveTab,
  isOnline = true,
  isPwaInstallable = false,
  onInstallPwa = null,
  onOpenSystemInfo = null,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new_inspection', label: 'New Inspection', icon: PlusCircle },
    { id: 'history', label: 'History', icon: History },
    { id: 'legal_search', label: 'Legal Search', icon: Search },
    { id: 'legal_sources', label: 'Legal Sources', icon: BookOpen },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar" role="banner">
      <div className="navbar-inner">
        {/* Brand */}
        <div
          className="nav-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => handleNavClick('dashboard')}
          tabIndex={0}
          role="button"
          aria-label="Go to Dashboard"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleNavClick('dashboard');
          }}
        >
          <div className="brand-icon">
            <Scale size={24} />
          </div>
          <div className="brand-title-wrap">
            <div className="brand-name">
              <span>NiyamCheck</span>
              <span style={{ fontSize: '0.85rem', color: '#93C5FD', fontWeight: 500 }}>नियमचेक</span>
              <span className="brand-sih-badge">SIH26034</span>
            </div>
            <div className="brand-subtitle">Legal Metrology Compliance &bull; CodeHexa</div>
          </div>
        </div>

        {/* Desktop Navigation Items */}
        <nav className="nav-links desktop-only" role="navigation" aria-label="Desktop Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Health Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* PWA Install Button */}
          {isPwaInstallable && (
            <button
              type="button"
              className="btn btn-sm btn-primary pwa-install-btn"
              onClick={onInstallPwa}
              title="Install NiyamCheck to Home Screen"
            >
              <Smartphone size={14} />
              <span>Install App</span>
            </button>
          )}

          {/* Health status pill */}
          <div
            className="nav-health"
            title={isOnline ? 'FastAPI Backend Online & Connected' : 'Offline Mode — Local drafts available'}
          >
            {isOnline ? (
              <Wifi size={13} style={{ color: '#10B981' }} />
            ) : (
              <WifiOff size={13} style={{ color: '#EF4444' }} />
            )}
            <span style={{ color: isOnline ? '#10B981' : '#EF4444', fontWeight: 600 }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* System Information Modal Trigger */}
          {onOpenSystemInfo && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenSystemInfo}
              title="System Information & Diagnostics"
              style={{ padding: '0.4rem 0.5rem' }}
            >
              <Info size={16} />
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm mobile-only-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-menu" role="menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-drawer-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                role="menuitem"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
