import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Navigation items preserved for compatibility with test suites & consumers
export const consumerNavItems = [
  { id: 'consumer_dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'consumer_check', label: 'Check a Product', icon: Camera },
  { id: 'consumer_history', label: 'My Checks', icon: History },
  { id: 'consumer_help', label: 'Guide & Help', icon: BookOpen },
];

export const officerNavItems = [
  { id: 'dashboard', label: 'Officer Station', icon: LayoutDashboard },
  { id: 'new_inspection', label: 'New Inspection', icon: PlusCircle },
  { id: 'history', label: 'Case Registry', icon: History },
  { id: 'legal_search', label: 'Legal Search', icon: Search },
  { id: 'legal_sources', label: 'Legal Sources', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

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
  onToggleSidebar,
  onToggleSidebarMobile,
  sidebarCollapsed = false,
}) {
  const { role, setRole, isOfficer, isConsumer: authIsConsumer, isVendor, isAdmin, currentUser } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const isConsumer = portalMode === 'consumer';

  // Close profile dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  const handleBrandClick = () => {
    setActiveTab(isConsumer ? 'consumer_dashboard' : 'dashboard');
  };

  const handleInstallClick = () => {
    if (onOpenInstallApp) {
      onOpenInstallApp();
    } else if (onInstallPwa) {
      onInstallPwa();
    }
    setProfileDropdownOpen(false);
  };

  const handleToggleClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      if (onToggleSidebarMobile) onToggleSidebarMobile();
    } else {
      if (onToggleSidebar) onToggleSidebar();
    }
  };

  // Determine role-based quick action details
  const getQuickAction = () => {
    if (isConsumer || authIsConsumer || isVendor) {
      return {
        label: 'Check Product',
        tabId: 'consumer_check',
        icon: Camera,
      };
    }
    return {
      label: 'New Inspection',
      tabId: 'new_inspection',
      icon: PlusCircle,
    };
  };

  const quickAction = getQuickAction();
  const QuickIcon = quickAction.icon;

  const getRoleDisplayName = () => {
    if (isAdmin) return 'Admin';
    if (isOfficer) return 'Officer';
    if (isVendor) return 'Vendor';
    return 'Consumer';
  };

  return (
    <header className="navbar" role="banner">
      <div className="navbar-inner">
        {/* Left Side: 1. Hamburger button, 2. Logo/icon, 3. Project name */}
        <div className="navbar-left">
          {/* Hamburger button (must appear BEFORE the NiyamCheck logo/name) */}
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={handleToggleClick}
            aria-label="Toggle navigation sidebar"
            title="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          {/* NiyamCheck Logo & Name */}
          <div
            className="nav-brand"
            onClick={handleBrandClick}
            tabIndex={0}
            role="button"
            aria-label={isConsumer ? 'Go to Consumer Home' : 'Go to Officer Dashboard'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleBrandClick();
            }}
          >
            <div className="brand-icon">
              <Scale size={20} />
            </div>
            <div className="brand-title-wrap">
              <div className="brand-name">
                <span>NiyamCheck</span>
                <span className={`brand-mode-badge ${isConsumer ? 'badge-consumer-mode' : 'badge-officer-mode'}`}>
                  {isConsumer ? 'Consumer' : (isAdmin ? 'Admin' : (isVendor ? 'Vendor' : 'Officer'))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Button & Compact Profile Section */}
        <div className="navbar-right">
          {/* Quick Inspection Action Button */}
          <button
            type="button"
            className="btn btn-sm btn-primary nav-quick-action-btn"
            onClick={() => setActiveTab(quickAction.tabId)}
            title={`Start ${quickAction.label}`}
          >
            <QuickIcon size={14} />
            <span className="quick-action-text">{quickAction.label}</span>
          </button>

          {/* User Profile Section with Dropdown Menu */}
          <div className="nav-profile-container" ref={profileMenuRef}>
            <button
              type="button"
              className={`nav-profile-trigger ${profileDropdownOpen ? 'active' : ''}`}
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              title="Open user profile & preferences"
            >
              <div className="nav-profile-avatar">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="nav-profile-info">
                <span className="nav-profile-name">{currentUser?.name || 'User'}</span>
                <span className="nav-profile-role-tag">{getRoleDisplayName()}</span>
              </div>
              <ChevronDown
                size={14}
                className={`nav-profile-chevron ${profileDropdownOpen ? 'rotate' : ''}`}
              />
            </button>

            {/* Profile & Controls Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="nav-profile-dropdown" role="menu">
                {/* User Info Card */}
                <div className="profile-dropdown-user-card">
                  <div className="profile-dropdown-avatar">
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="profile-dropdown-details">
                    <div className="profile-dropdown-name">{currentUser?.name || 'User'}</div>
                    <div className="profile-dropdown-designation">
                      {currentUser?.designation || getRoleDisplayName()}
                    </div>
                    {currentUser?.badge && (
                      <div className="profile-dropdown-badge">{currentUser.badge}</div>
                    )}
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                {/* RBAC Role Switcher */}
                <div className="profile-dropdown-section">
                  <label className="profile-dropdown-label" htmlFor="dropdown-role-select">
                    User Persona (RBAC)
                  </label>
                  <div className="role-switcher-wrap" title="Switch User Persona (RBAC)">
                    <select
                      id="dropdown-role-select"
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value);
                        setProfileDropdownOpen(false);
                      }}
                      className="role-select"
                      aria-label="Select User Role"
                    >
                      <option value="OFFICER">🛡️ Officer</option>
                      <option value="CONSUMER">🛒 Consumer</option>
                      <option value="VENDOR">🏭 Vendor</option>
                      <option value="ADMIN">⚙️ Admin</option>
                    </select>
                  </div>
                </div>

                {/* Portal Mode Switcher (Consumer vs Officer) */}
                {onTogglePortalMode && (
                  <div className="profile-dropdown-section">
                    <label className="profile-dropdown-label">Portal Mode</label>
                    <div className="portal-mode-toggle" role="group" aria-label="Portal Mode Switcher">
                      <button
                        type="button"
                        className={`portal-mode-btn ${isConsumer ? 'active' : ''}`}
                        onClick={() => {
                          onTogglePortalMode('consumer');
                          setActiveTab('consumer_dashboard');
                          setProfileDropdownOpen(false);
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
                          setProfileDropdownOpen(false);
                        }}
                        title="Switch to Officer Inspection Workbench"
                      >
                        <Shield size={13} />
                        <span>Officer</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="profile-dropdown-divider" />

                {/* Actions & Tools */}
                <div className="profile-dropdown-actions">
                  {/* Install Mobile App Button */}
                  <button
                    type="button"
                    className="btn btn-sm btn-primary pwa-install-btn profile-install-btn"
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
                      className="profile-action-row-btn"
                      onClick={onToggleTheme}
                      title={theme === 'light' ? 'Switch to Dark theme' : 'Switch to Light theme'}
                    >
                      {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                      <span>{theme === 'light' ? 'Dark Theme' : 'Light Theme'}</span>
                    </button>
                  )}

                  {/* System Diagnostics Trigger */}
                  {onOpenSystemInfo && (
                    <button
                      type="button"
                      className="profile-action-row-btn"
                      onClick={() => {
                        onOpenSystemInfo();
                        setProfileDropdownOpen(false);
                      }}
                      title="System Information & Diagnostics"
                    >
                      <Info size={15} />
                      <span>Diagnostics</span>
                    </button>
                  )}

                  {/* Connection Status Indicator */}
                  <div
                    className="nav-health profile-health-pill"
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
