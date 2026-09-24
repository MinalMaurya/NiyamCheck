import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Camera,
  History,
  Search,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  UserCheck,
  Building2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed = false,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
  portalMode = 'consumer',
  onTogglePortalMode,
}) {
  const { role, isOfficer, isConsumer, isVendor, isAdmin, currentUser } = useAuth();

  // Effective mode: if portalMode is forced to consumer, show consumer navigation
  const effectiveIsConsumer = portalMode === 'consumer' && !isAdmin;

  // Build navigation sections based on role and portal mode
  const getSections = () => {
    if (effectiveIsConsumer) {
      return [
        {
          title: 'Main',
          items: [
            { id: 'consumer_dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'consumer_check', label: 'Check a Product', icon: Camera, badge: 'AI' },
            { id: 'consumer_history', label: 'My Checks', icon: History },
          ],
        },
        {
          title: 'Help & Reference',
          items: [
            { id: 'consumer_help', label: 'Guide & Helpline', icon: BookOpen, badge: '1915' },
          ],
        },
      ];
    }

    if (isVendor) {
      return [
        {
          title: 'Main',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'consumer_check', label: 'Check Product', icon: Camera, badge: 'QA' },
            { id: 'history', label: 'Compliance History', icon: History },
            { id: 'legal_search', label: 'Legal Search', icon: Search },
          ],
        },
        {
          title: 'Reference',
          items: [
            { id: 'legal_sources', label: 'Packaging Standards', icon: BookOpen },
          ],
        },
        {
          title: 'Management',
          items: [
            { id: 'settings', label: 'Settings', icon: Settings },
          ],
        },
      ];
    }

    if (isAdmin) {
      return [
        {
          title: 'Main',
          items: [
            { id: 'dashboard', label: 'Central Console', icon: LayoutDashboard },
            { id: 'new_inspection', label: 'New Inspection', icon: PlusCircle },
            { id: 'history', label: 'Master Case Registry', icon: History },
            { id: 'legal_search', label: 'Legal Search', icon: Search },
          ],
        },
        {
          title: 'Reference & Rules',
          items: [
            { id: 'legal_sources', label: 'Legal Knowledgebase', icon: BookOpen },
          ],
        },
        {
          title: 'Administration',
          items: [
            { id: 'settings', label: 'Administration & System', icon: Settings, badge: 'Admin' },
          ],
        },
      ];
    }

    // Default: Officer
    return [
      {
        title: 'Main',
        items: [
          { id: 'dashboard', label: isOfficer ? 'Officer Station' : 'Dashboard', icon: LayoutDashboard },
          { id: 'new_inspection', label: 'New Inspection', icon: PlusCircle },
          { id: 'history', label: isOfficer ? 'Case Registry' : 'History', icon: History },
          { id: 'legal_search', label: 'Legal Search', icon: Search },
        ],
      },
      {
        title: 'Reference & Legal',
        items: [
          { id: 'legal_sources', label: 'Statutory Rules', icon: BookOpen, badge: 'PCR 2011' },
        ],
      },
      {
        title: 'Management',
        items: [
          { id: 'settings', label: 'Station Settings', icon: Settings },
        ],
      },
    ];
  };

  const sections = getSections();

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const getRoleIcon = () => {
    if (isAdmin) return <Lock size={15} />;
    if (isOfficer) return <Shield size={15} />;
    if (isVendor) return <Building2 size={15} />;
    return <UserCheck size={15} />;
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Admin';
    if (isOfficer) return 'Officer';
    if (isVendor) return 'Vendor';
    return 'Consumer';
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpenMobile ? 'mobile-open' : ''}`}
        aria-label="Application Navigation Sidebar"
      >
        {/* Mobile Header with Close Button */}
        <div className="sidebar-mobile-header">
          <div className="sidebar-mobile-title">
            <span className="sidebar-role-indicator">
              {getRoleIcon()}
              <span>{getRoleLabel()} Menu</span>
            </span>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav" role="navigation">
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="sidebar-section">
              {section.title && (
                <div className="sidebar-section-title" title={isCollapsed ? section.title : undefined}>
                  {!isCollapsed ? (
                    <span>{section.title}</span>
                  ) : (
                    <span className="sidebar-section-divider" />
                  )}
                </div>
              )}

              <div className="sidebar-section-items">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeTab === item.id ||
                    (item.id === 'consumer_history' && activeTab === 'consumer_result') ||
                    (item.id === 'history' && activeTab === 'results');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleItemClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="sidebar-item-icon">
                        <Icon size={18} />
                      </div>

                      {!isCollapsed && (
                        <span className="sidebar-item-label">{item.label}</span>
                      )}

                      {!isCollapsed && item.badge && (
                        <span className="sidebar-item-badge">{item.badge}</span>
                      )}

                      {/* Floating tooltip when collapsed on desktop */}
                      {isCollapsed && (
                        <div className="sidebar-tooltip" role="tooltip">
                          <span>{item.label}</span>
                          {item.badge && <span className="tooltip-badge">{item.badge}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer with Desktop Collapse Toggle */}
        <div className="sidebar-footer">
          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-btn desktop-only"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!isCollapsed && <span>Collapse Sidebar</span>}
            </button>
          )}

          {/* User mini status card when expanded */}
          {!isCollapsed && currentUser && (
            <div className="sidebar-user-card">
              <div className="sidebar-user-avatar">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name" title={currentUser.name}>
                  {currentUser.name}
                </div>
                <div className="sidebar-user-role">
                  {currentUser.designation || currentUser.role}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
