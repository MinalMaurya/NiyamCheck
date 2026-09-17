import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { SystemInfoModal } from './components/SystemInfoModal';
import { InstallAppModal } from './components/InstallAppModal';
import { Dashboard } from './pages/Dashboard';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);
  const [isInstallAppOpen, setIsInstallAppOpen] = useState(false);

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

  const { isFullyConnected: isOnline } = useNetworkStatus();
  const { isInstallable, promptInstall } = usePwaInstall();

  const handleOpenInspection = (inspectionId) => {
    setSelectedInspectionId(inspectionId);
    setActiveTab('results');
  };

  const handleInspectionCreated = (inspectionId) => {
    setSelectedInspectionId(inspectionId);
    setActiveTab('results');
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    try {
      const demoSamples = await createDemoPackageFiles('parle_g');
      const files = demoSamples.map((s) => s.file);
      const panels = demoSamples.map((s) => s.panel);
      const session = await createInspection({ files, panels });
      setSelectedInspectionId(session.inspection_id);
      setActiveTab('results');
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
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={setActiveTab}
            onOpenInspection={handleOpenInspection}
            onLoadDemo={handleLoadDemo}
          />
        )}

        {activeTab === 'new_inspection' && (
          <CreateInspection onInspectionCreated={handleInspectionCreated} />
        )}

        {activeTab === 'results' && (
          <InspectionResults
            inspectionId={selectedInspectionId}
            onBack={() => setActiveTab('dashboard')}
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
