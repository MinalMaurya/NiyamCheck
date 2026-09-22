import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { SystemInfoModal } from './components/SystemInfoModal';
import { InstallAppModal } from './components/InstallAppModal';
import { Dashboard } from './pages/Dashboard';
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
import { LegalSearch } from './pages/LegalSearch';
import { LegalSources } from './pages/LegalSources';
import { Settings } from './pages/Settings';
import { createInspection } from './api/inspections';
import { createDemoPackageFiles } from './api/sampleData';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePwaInstall } from './hooks/usePwaInstall';

export function App() {
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

  // Theme Management (Default: 'light')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('niyamcheck_theme') || 'light';
    } catch {
      return 'light';
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
      />

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
          <Dashboard
            onNavigate={setActiveTab}
            onOpenInspection={handleOpenInspection}
            onLoadDemo={handleLoadDemo}
          />
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
          <History
            onOpenInspection={handleOpenInspection}
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

      <Footer />
    </div>
  );
}

export default App;
