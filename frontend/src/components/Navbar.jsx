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
  Settings as SettingsIcon,
  Sun,
  Moon,
  UserCheck,
  Shield,
  Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar({
  activeTab,
  setActiveTab,
  portalMode = 'consumer',
  onTogglePortalMode,
  isOnline = true,
  isPwaInstallable = false,
  onInstallPwa,
  onOpenSystemInfo,
  onOpenInstallApp,
  theme = 'dark',
  onToggleTheme,
}) {
  const { role, setRole, isOfficer } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Consumer navigation items
  const consumerNavItems = [
    { id: 'consumer_dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'consumer_check', label: 'Check a Product', icon: Camera },
    { id: 'consumer_history', label: 'My Checks', icon: History },
    { id: 'consumer_help', label: 'Guide & Help', icon: BookOpen },
  ];

  // Official Legal Metrology Inspector navigation items
  const officerNavItems = [
    { id: 'dashboard', label: isOfficer ? 'Officer Station' : 'Dashboard', icon: LayoutDashboard },
    { id: 'new_inspection', label: 'New Inspection', icon: PlusCircle },
    { id: 'history', label: isOfficer ? 'Case Registry' : 'History', icon: History },
    { id: 'legal_search', label: 'Legal Search', icon: Search },
    { id: 'legal_sources', label: 'Legal Sources', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const isConsumer = portalMode === 'consumer';
  const navItems = isConsumer ? consumerNavItems : officerNavItems;

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const handleBrandClick = () => {
    handleNavClick(isConsumer ? 'consumer_dashboard' : 'dashboard');
  };

  const handleInstallClick = () => {
    if (onOpenInstallApp) {
      onOpenInstallApp();
    } else if (onInstallPwa) {
      onInstallPwa();
    }
  };

  return (
    <header className="navbar" role="banner">
      <div className="navbar-inner">
        {/* Brand */}
        <div
          className="nav-brand"
          style={{ cursor: 'pointer' }}
          onClick={handleBrandClick}
          tabIndex={0}
          role="button"
          aria-label={isConsumer ? 'Go to Consumer Home' : 'Go to Officer Dashboard'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleBrandClick();
          }}
        >
          <div className="brand-icon">
            <Scale size={24} />
          </div>
          <div className="brand-title-wrap">
            <div className="brand-name">
              <span>NiyamCheck</span>
              <span className={`brand-mode-badge ${isConsumer ? 'badge-consumer-mode' : 'badge-officer-mode'}`}>
                {isConsumer ? 'Consumer' : 'Officer'}
              </span>
            </div>
          </div>
        </div>

        {/* Portal Mode Switcher (Consumer vs Officer) */}
        {onTogglePortalMode && (
          <div className="portal-mode-toggle" role="group" aria-label="Portal Mode Switcher">
            <button
              type="button"
              className={`portal-mode-btn ${isConsumer ? 'active' : ''}`}
              onClick={() => {
                onTogglePortalMode('consumer');
                setActiveTab('consumer_dashboard');
              }}
              title="Switch to Consumer Product Check View"
            >
              <UserCheck size={13} />
              <span>Consumer</span>
            </button>
            <button
              type="button"
              className={`portal-mode-btn ${!isConsumer ? 'active' : ''}`}
              onClick={() => {
                onTogglePortalMode('officer');
                setActiveTab('dashboard');
              }}
              title="Switch to Officer Inspection Workbench"
            >
              <Shield size={13} />
              <span>Officer</span>
            </button>
          </div>
        )}

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
          {/* Install App Button */}
          <button
            type="button"
            className="btn btn-sm btn-primary pwa-install-btn"
            onClick={handleInstallClick}
            title="Install NiyamCheck Mobile App"
          >
            <Smartphone size={14} />
            <span>Install App</span>
          </button>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
              aria-label="Toggle color theme"
              style={{ padding: '0.4rem 0.5rem' }}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          )}

          {/* RBAC Role Switcher */}
          <div className="role-switcher-wrap" title="Switch User Persona (RBAC)">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="role-select"
              aria-label="Select User Role"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.55rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isOfficer ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface-elevated)',
                border: isOfficer ? '1px solid #8B5CF6' : '1px solid var(--border-default)',
                color: isOfficer ? '#A78BFA' : 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="OFFICER">🛡️ Officer</option>
              <option value="CONSUMER">🛒 Consumer</option>
              <option value="VENDOR">🏭 Vendor</option>
            </select>
          </div>

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
          {/* Mobile Portal Mode Switcher */}
          {onTogglePortalMode && (
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
              <div className="portal-mode-toggle" style={{ width: '100%' }}>
                <button
                  type="button"
                  style={{ flex: 1 }}
                  className={`portal-mode-btn ${isConsumer ? 'active' : ''}`}
                  onClick={() => {
                    onTogglePortalMode('consumer');
                    handleNavClick('consumer_dashboard');
                  }}
                >
                  <UserCheck size={14} />
                  <span>Consumer Mode</span>
                </button>
                <button
                  type="button"
                  style={{ flex: 1 }}
                  className={`portal-mode-btn ${!isConsumer ? 'active' : ''}`}
                  onClick={() => {
                    onTogglePortalMode('officer');
                    handleNavClick('dashboard');
                  }}
                >
                  <Shield size={14} />
                  <span>Officer Mode</span>
                </button>
              </div>
            </div>
          )}

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
