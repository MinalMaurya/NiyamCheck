import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { SystemInfoModal } from './components/SystemInfoModal';
import { InstallAppModal } from './components/InstallAppModal';
import { Dashboard } from './pages/Dashboard';
import { OfficerDashboard } from './pages/OfficerDashboard';
import { ConsumerDashboard } from './pages/ConsumerDashboard';
import { ConsumerCheck } from './pages/ConsumerCheck';
import { ConsumerProcessing } from './pages/ConsumerProcessing';
import { ConsumerProductInfo } from './pages/ConsumerProductInfo';
import { ConsumerCheckResult } from './pages/ConsumerCheckResult';
import { ConsumerHelp } from './pages/ConsumerHelp';
import { ConsumerHistory } from './pages/ConsumerHistory';
import { CreateInspection } from './pages/CreateInspection';
import { InspectionResults } from './pages/InspectionResults';
import { History } from './pages/History';
import { OfficerHistory } from './pages/OfficerHistory';
import { LegalSearch } from './pages/LegalSearch';
import { LegalSources } from './pages/LegalSources';
import { Settings } from './pages/Settings';
import { VendorDashboard } from './pages/vendor/VendorDashboard';
import { VendorProducts } from './pages/vendor/VendorProducts';
import { ProductDetails } from './pages/vendor/ProductDetails';
import { VendorCheck } from './pages/vendor/VendorCheck';
import { VendorFindings } from './pages/vendor/VendorFindings';
import { VendorHistory } from './pages/vendor/VendorHistory';
import { createInspection } from './api/inspections';
import { createDemoPackageFiles } from './api/sampleData';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePwaInstall } from './hooks/usePwaInstall';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppInner() {
  // Portal Mode: 'consumer' (default) vs 'officer'
  const [portalMode, setPortalMode] = useState(() => {
    try {
      return localStorage.getItem('niyamcheck_portal_mode') || 'consumer';
    } catch {
      return 'consumer';
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    return portalMode === 'consumer' ? 'consumer_dashboard' : 'dashboard';
  });
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [activeProductInspectionId, setActiveProductInspectionId] = useState(null);
  const [pendingCheckData, setPendingCheckData] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
  const [isInstallAppOpen, setIsInstallAppOpen] = useState(false);

  // Desktop collapsible sidebar state (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('niyamcheck_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile / tablet off-canvas drawer open state
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('niyamcheck_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Could not persist sidebar collapsed state:', e);
      }
      return next;
    });
  };

  const handleToggleSidebarMobile = () => {
    setSidebarOpenMobile((prev) => !prev);
  };

  const { isOfficer } = useAuth();

  // Theme Management (Default: 'dark')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('niyamcheck_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('niyamcheck_theme', theme);
    } catch (e) {
      console.warn('Could not persist theme preference:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleTogglePortalMode = (mode) => {
    setPortalMode(mode);
    try {
      localStorage.setItem('niyamcheck_portal_mode', mode);
    } catch (e) {
      console.warn('Could not persist portal mode:', e);
    }
  };

  const { isFullyConnected: isOnline } = useNetworkStatus();
  const { isInstallable, promptInstall } = usePwaInstall();

  // Officer / General Inspection Opener

  // Vendor workflow state and handlers
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductForCheck, setSelectedProductForCheck] = useState(null);
  const [selectedVendorInspectionId, setSelectedVendorInspectionId] = useState(null);

  const handleOpenVendorInspection = (inspectionId) => {
    setSelectedVendorInspectionId(inspectionId);
    setActiveTab('vendor_findings');
  };

  const handleVendorInspectionCompleted = (inspectionId) => {
    setSelectedVendorInspectionId(inspectionId);
    setActiveTab('vendor_findings');
  };

  const handleStartCheckForProduct = (product) => {
    setSelectedProductForCheck(product);
    setActiveTab('vendor_check');
  };
  const handleOpenInspection = (inspectionId) => {
    setSelectedInspectionId(inspectionId);
    setActiveTab('results');
  };

  // Consumer Product Inspection Opener
  const handleOpenConsumerInspection = (inspectionId) => {
    setActiveProductInspectionId(inspectionId);
    setSelectedInspectionId(inspectionId);
    setActiveTab('consumer_result');
  };

  const handleInspectionCreated = (inspectionId) => {
    setSelectedInspectionId(inspectionId);
    setActiveProductInspectionId(inspectionId);
    setActiveTab(portalMode === 'consumer' ? 'consumer_result' : 'results');
  };

  // Handler for ConsumerCheck -> ConsumerProcessing
  const handleStartProcessing = (data) => {
    setPendingCheckData(data);
    setActiveTab('consumer_processing');
  };

  // Handler for ConsumerProcessing -> ConsumerCheckResult
  const handleProcessingSuccess = (inspectionId) => {
    setActiveProductInspectionId(inspectionId);
    setSelectedInspectionId(inspectionId);
    setPendingCheckData(null);
    setActiveTab('consumer_result');
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    try {
      const demoSamples = await createDemoPackageFiles('parle_g');
      const files = demoSamples.map((s) => s.file);
      const panels = demoSamples.map((s) => s.panel);
      const session = await createInspection({ files, panels });
      setSelectedInspectionId(session.inspection_id);
      setActiveProductInspectionId(session.inspection_id);
      setActiveTab(portalMode === 'consumer' ? 'consumer_result' : 'results');
    } catch (err) {
      alert(`Demo package execution failed: ${err.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        portalMode={portalMode}
        onTogglePortalMode={handleTogglePortalMode}
        isOnline={isOnline}
        isPwaInstallable={isInstallable}
        onInstallPwa={promptInstall}
        onOpenSystemInfo={() => setIsSystemInfoOpen(true)}
        onOpenInstallApp={() => setIsInstallAppOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSidebar={handleToggleSidebar}
        onToggleSidebarMobile={handleToggleSidebarMobile}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className={`app-body ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          isOpenMobile={sidebarOpenMobile}
          onCloseMobile={() => setSidebarOpenMobile(false)}
          portalMode={portalMode}
          onTogglePortalMode={handleTogglePortalMode}
        />

        <div className="app-content-wrapper">
          {!isOnline && (
            <div className="offline-banner" role="alert">
              <WifiOff size={16} />
              <span>
                You are currently offline. Saved inspection drafts remain available on this device. Compliance analysis and legal search require a backend connection.
              </span>
            </div>
          )}

          <main className="main-content" role="main">
        {/* Consumer Portal Pages */}
        {activeTab === 'consumer_dashboard' && (
          <ConsumerDashboard
            onNavigate={setActiveTab}
            onOpenInspection={handleOpenConsumerInspection}
            onLoadDemo={handleLoadDemo}
          />
        )}

        {activeTab === 'consumer_check' && (
          <ConsumerCheck
            onStartProcessing={handleStartProcessing}
            onInspectionCreated={handleInspectionCreated}
            onCancel={() => setActiveTab('consumer_dashboard')}
            onLoadDemo={handleLoadDemo}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'consumer_processing' && (
          <ConsumerProcessing
            pendingData={pendingCheckData}
            onSuccess={handleProcessingSuccess}
            onCancel={() => setActiveTab('consumer_check')}
          />
        )}

        {activeTab === 'consumer_product_info' && (
          <ConsumerProductInfo
            inspectionId={activeProductInspectionId || selectedInspectionId}
            onNavigate={setActiveTab}
            onViewFullResult={() => setActiveTab('consumer_result')}
            onCheckAnother={() => setActiveTab('consumer_check')}
          />
        )}

        {activeTab === 'consumer_result' && (
          <ConsumerCheckResult
            inspectionId={activeProductInspectionId || selectedInspectionId}
            onNavigate={setActiveTab}
            onViewProductInfo={() => setActiveTab('consumer_product_info')}
            onCheckAnother={() => setActiveTab('consumer_check')}
          />
        )}

        {activeTab === 'consumer_history' && (
          <ConsumerHistory
            onOpenCheck={handleOpenConsumerInspection}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'consumer_help' && (
          <ConsumerHelp onNavigate={setActiveTab} />
        )}

        {/* Officer Workbench Pages */}
        {activeTab === 'dashboard' && (
          isOfficer ? (
            <OfficerDashboard
              onNavigate={setActiveTab}
              onOpenInspection={handleOpenInspection}
              onLoadDemo={handleLoadDemo}
            />
          ) : (
            <Dashboard
              onNavigate={setActiveTab}
              onOpenInspection={handleOpenInspection}
              onLoadDemo={handleLoadDemo}
            />
          )
        )}

        {activeTab === 'new_inspection' && (
          <CreateInspection onInspectionCreated={handleInspectionCreated} isOnline={isOnline} />
        )}

        {activeTab === 'results' && (
          <InspectionResults
            inspectionId={selectedInspectionId}
            onBack={() => setActiveTab(portalMode === 'consumer' ? 'consumer_result' : 'dashboard')}
            onOpenInspection={handleOpenInspection}
          />
        )}

        {activeTab === 'history' && (
          isOfficer ? (
            <OfficerHistory
              onOpenInspection={handleOpenInspection}
              onNavigate={setActiveTab}
            />
          ) : (
            <History
              onOpenInspection={handleOpenInspection}
              onNavigate={setActiveTab}
            />
          )
        )}

        {activeTab === 'vendor_dashboard' && (
          <VendorDashboard
            onNavigate={setActiveTab}
            onSelectProduct={setSelectedProductId}
            onOpenInspection={handleOpenVendorInspection}
          />
        )}

        {activeTab === 'vendor_products' && (
          <VendorProducts
            onNavigate={setActiveTab}
            onSelectProduct={setSelectedProductId}
            onStartCheckForProduct={handleStartCheckForProduct}
          />
        )}

        {activeTab === 'vendor_product_details' && (
          <ProductDetails
            productId={selectedProductId}
            onBack={() => setActiveTab('vendor_products')}
            onNavigate={setActiveTab}
            onStartCheckForProduct={handleStartCheckForProduct}
            onOpenInspection={handleOpenVendorInspection}
          />
        )}

        {activeTab === 'vendor_check' && (
          <VendorCheck
            initialProduct={selectedProductForCheck}
            onInspectionCompleted={handleVendorInspectionCompleted}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'vendor_findings' && (
          <VendorFindings
            inspectionId={selectedVendorInspectionId || selectedInspectionId}
            onBack={() => setActiveTab('vendor_dashboard')}
            onNavigate={setActiveTab}
            onRecheckProduct={handleStartCheckForProduct}
          />
        )}

        {activeTab === 'vendor_history' && (
          <VendorHistory
            onOpenInspection={handleOpenVendorInspection}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'legal_search' && <LegalSearch />}

        {activeTab === 'legal_sources' && <LegalSources />}

        {activeTab === 'settings' && (
          <Settings
            currentTheme={theme}
            onThemeChange={setTheme}
            isOnline={isOnline}
          />
        )}
      </main>

      <Footer />
    </div>
  </div>

  <SystemInfoModal
    isOpen={isSystemInfoOpen}
    onClose={() => setIsSystemInfoOpen(false)}
    isOnline={isOnline}
    isPwaInstallable={isInstallable}
    onInstallPwa={promptInstall}
  />

  <InstallAppModal
    isOpen={isInstallAppOpen}
    onClose={() => setIsInstallAppOpen(false)}
  />
</div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
