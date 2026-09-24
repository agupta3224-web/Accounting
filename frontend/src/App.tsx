import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LicenseBanner } from './components/LicenseBanner';
import { LicenseActivationModal } from './components/LicenseActivationModal';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { StatementImportPortal } from './pages/StatementImportPortal';
import { TransactionsList } from './pages/TransactionsList';
import { PropertiesManager } from './pages/PropertiesManager';
import { ChartOfAccounts } from './pages/ChartOfAccounts';
import { JournalEntriesPage } from './pages/JournalEntriesPage';
import { CheckRegisterPage } from './pages/CheckRegisterPage';
import { VendorListPage } from './pages/VendorListPage';
import { CompanyWelcomeScreen } from './pages/CompanyWelcomeScreen';
import { MultiWindowManager } from './components/workspace/MultiWindowManager';
import { ManualTransactionModal } from './components/ManualTransactionModal';
import { WriteCheckModal } from './components/WriteCheckModal';
import { GeneralJournalModal } from './components/GeneralJournalModal';
import { CheckPrintPreviewModal } from './components/CheckPrintPreviewModal';
import { EntitySetupWizardModal } from './components/entities/EntitySetupWizardModal';
import { 
  Company, 
  Property, 
  ClassEntity, 
  Category, 
  Vendor,
  SystemSession, 
  LicenseStatus, 
  CheckRecord, 
  JournalEntry,
  WorkspaceWindow,
  WindowType
} from './types';
import { api } from './services/api';

export function App() {
  const [session, setSession] = useState<SystemSession | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  // View mode: Single Tab vs Multi-Window Workspace
  const [isMultiWindowMode, setIsMultiWindowMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'journal' | 'checks' | 'vendors' | 'import' | 'transactions' | 'properties'>('dashboard');

  // Multi-window workspace state
  const [windows, setWindows] = useState<WorkspaceWindow[]>([
    {
      id: 'win-dashboard',
      type: 'dashboard',
      title: 'Financial Profit & Loss',
      x: 30,
      y: 20,
      width: 820,
      height: 560,
      zIndex: 1,
      isMinimized: false,
      isMaximized: false
    }
  ]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>('win-dashboard');
  
  // Modals state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isWriteCheckModalOpen, setIsWriteCheckModalOpen] = useState(false);
  const [initialVendorForCheck, setInitialVendorForCheck] = useState<Vendor | null>(null);
  const [isMakeJournalModalOpen, setIsMakeJournalModalOpen] = useState(false);
  const [isCheckPrintModalOpen, setIsCheckPrintModalOpen] = useState(false);
  const [selectedCheckForPrint, setSelectedCheckForPrint] = useState<CheckRecord | null>(null);
  const [isEntityWizardOpen, setIsEntityWizardOpen] = useState(false);
  const [wizardIsCreatingNewCompany, setWizardIsCreatingNewCompany] = useState(false);

  const handleOpenCreateNewCompany = () => {
    setWizardIsCreatingNewCompany(true);
    setIsEntityWizardOpen(true);
  };

  const handleOpenEntitySetup = () => {
    setWizardIsCreatingNewCompany(false);
    setIsEntityWizardOpen(true);
  };

  const [loadingSession, setLoadingSession] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchLicense = async () => {
    try {
      const lic = await api.getLicenseStatus();
      setLicenseStatus(lic);
    } catch (err) {
      console.error('Failed to fetch license status', err);
    }
  };

  const checkSession = async () => {
    try {
      setLoadingSession(true);
      const [sess, _] = await Promise.all([
        api.getSession(),
        fetchLicense()
      ]);
      setSession(sess);
      if (sess.has_active_company) {
        await loadMetadata();
      }
    } catch (err) {
      console.error('Failed to check session', err);
    } finally {
      setLoadingSession(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const [comps, cls, props, cats] = await Promise.all([
        api.getCompanies(),
        api.getClasses(),
        api.getProperties(),
        api.getCategories()
      ]);
      setCompanies(comps);
      setClasses(cls);
      setProperties(props);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load portfolio metadata', err);
    }
  };

  useEffect(() => {
    checkSession();
    const handleCoaUpdate = () => loadMetadata();
    window.addEventListener('coa-updated', handleCoaUpdate);
    return () => window.removeEventListener('coa-updated', handleCoaUpdate);
  }, []);

  const handleCloseCompany = async () => {
    try {
      await api.closeSystemCompany();
      setSession({
        active_company_key: null,
        active_company_name: null,
        is_sample: false,
        has_active_company: false
      });
    } catch (err: any) {
      alert(err.message || 'Failed to close company');
    }
  };

  const handleCompanyOpened = async () => {
    await checkSession();
    setActiveTab('dashboard');
  };

  const handleOpenPrintCheck = (check: CheckRecord) => {
    setSelectedCheckForPrint(check);
    setIsCheckPrintModalOpen(true);
  };

  const handleOpenWriteCheckWithVendor = (vendor?: Vendor) => {
    setInitialVendorForCheck(vendor || null);
    setIsWriteCheckModalOpen(true);
  };

  // Open / Focus Window in Multi-Window Mode
  const handleOpenWindow = (type: WindowType, title: string) => {
    const existing = windows.find(w => w.type === type);
    if (existing) {
      setActiveWindowId(existing.id);
      setWindows(prev => {
        const maxZ = prev.reduce((max, w) => Math.max(max, w.zIndex || 1), 1);
        return prev.map(w => w.id === existing.id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w);
      });
    } else {
      const newId = `win-${type}-${Date.now()}`;
      const maxZ = windows.reduce((max, w) => Math.max(max, w.zIndex || 1), 1);
      const offset = (windows.length % 6) * 30;
      
      const newWin: WorkspaceWindow = {
        id: newId,
        type,
        title,
        x: 40 + offset,
        y: 30 + offset,
        width: 800,
        height: 540,
        zIndex: maxZ + 1,
        isMinimized: false,
        isMaximized: false
      };
      setWindows(prev => [...prev, newWin]);
      setActiveWindowId(newId);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Loading PropBooks Accounting Engine...</p>
        </div>
      </div>
    );
  }

  // If no company is open, show the QuickBooks-style Welcome Screen
  if (!session?.has_active_company) {
    return <CompanyWelcomeScreen onCompanyOpened={handleCompanyOpened} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 overflow-x-hidden">
      {/* 21-Day Free Trial / Expiring License Warning Banner */}
      <LicenseBanner
        licenseStatus={licenseStatus}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
      />

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMultiWindowMode={isMultiWindowMode}
        setIsMultiWindowMode={setIsMultiWindowMode}
        onOpenWindow={handleOpenWindow}
        onOpenWriteCheckModal={() => handleOpenWriteCheckWithVendor()}
        onOpenMakeJournalModal={() => setIsMakeJournalModalOpen(true)}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        onCloseCompany={handleCloseCompany}
        activeCompanyName={session.active_company_name || 'Active Company'}
        isSample={session.is_sample}
        licenseStatus={licenseStatus}
        onOpenLicenseModal={() => setIsLicenseModalOpen(true)}
        onOpenCreateNewCompany={handleOpenCreateNewCompany}
        onOpenEntitySetup={handleOpenEntitySetup}
      />

      {/* Main Workspace Area (Full-Screen Multi-Window Mode vs Single-Tab View) */}
      {isMultiWindowMode ? (
        <MultiWindowManager
          windows={windows}
          setWindows={setWindows}
          activeWindowId={activeWindowId}
          setActiveWindowId={setActiveWindowId}
          onOpenWriteCheckModal={handleOpenWriteCheckWithVendor}
          onOpenMakeJournalModal={() => setIsMakeJournalModalOpen(true)}
          onOpenManualModal={() => setIsManualModalOpen(true)}
          onPrintCheck={handleOpenPrintCheck}
          companies={companies}
          classes={classes}
          properties={properties}
          categories={categories}
          activeCompanyName={session.active_company_name || 'Active Company'}
          onRefreshMetadata={loadMetadata}
        />
      ) : (
        <main className="flex-1 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full">
          {activeTab === 'dashboard' && (
            <FinancialDashboard
              companies={companies}
              classes={classes}
              properties={properties}
              onOpenManualModal={() => setIsManualModalOpen(true)}
              onNavigateToImport={() => setActiveTab('import')}
              onNavigateToHierarchy={() => setActiveTab('properties')}
            />
          )}

          {activeTab === 'accounts' && (
            <ChartOfAccounts
              activeCompanyName={session.active_company_name || 'Active Company'}
              onAccountsChange={loadMetadata}
            />
          )}

          {activeTab === 'journal' && (
            <JournalEntriesPage
              onOpenMakeJournalModal={() => setIsMakeJournalModalOpen(true)}
              classes={classes}
              properties={properties}
            />
          )}

          {activeTab === 'checks' && (
            <CheckRegisterPage
              onOpenWriteCheckModal={() => handleOpenWriteCheckWithVendor()}
              onPrintCheck={handleOpenPrintCheck}
              categories={categories}
              properties={properties}
              classes={classes}
            />
          )}

          {activeTab === 'vendors' && (
            <VendorListPage
              onWriteCheckToVendor={handleOpenWriteCheckWithVendor}
              categories={categories}
            />
          )}

          {activeTab === 'import' && (
            <StatementImportPortal
              properties={properties}
              classes={classes}
              categories={categories}
              onImportSuccess={() => {
                loadMetadata();
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsList
              properties={properties}
              classes={classes}
              onOpenManualModal={() => setIsManualModalOpen(true)}
            />
          )}

          {activeTab === 'properties' && (
            <PropertiesManager
              companies={companies}
              classes={classes}
              properties={properties}
              onRefresh={loadMetadata}
            />
          )}
        </main>
      )}

      {/* Write Check Modal (QuickBooks Desktop Format) */}
      <WriteCheckModal
        isOpen={isWriteCheckModalOpen}
        onClose={() => {
          setIsWriteCheckModalOpen(false);
          setInitialVendorForCheck(null);
        }}
        onSuccess={(check) => {
          loadMetadata();
        }}
        onPrintCheck={handleOpenPrintCheck}
        categories={categories}
        properties={properties}
        classes={classes}
        initialVendor={initialVendorForCheck}
      />

      {/* Make General Journal Entries Modal */}
      <GeneralJournalModal
        isOpen={isMakeJournalModalOpen}
        onClose={() => setIsMakeJournalModalOpen(false)}
        onSuccess={(entry) => {
          loadMetadata();
        }}
        categories={categories}
        properties={properties}
        classes={classes}
      />

      {/* Check Print Preview Modal (QuickBooks Voucher Format) */}
      <CheckPrintPreviewModal
        isOpen={isCheckPrintModalOpen}
        onClose={() => setIsCheckPrintModalOpen(false)}
        check={selectedCheckForPrint}
      />

      {/* Manual Transaction Modal */}
      <ManualTransactionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        companies={companies}
        properties={properties}
        classes={classes}
        categories={categories}
        onTransactionCreated={() => {
          loadMetadata();
        }}
      />

      {/* License Activation & Subscription Modal */}
      <LicenseActivationModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        licenseStatus={licenseStatus}
        onLicenseUpdated={fetchLicense}
      />

      {/* Global Entity Setup Interview Wizard */}
      <EntitySetupWizardModal
        isOpen={isEntityWizardOpen}
        onClose={() => setIsEntityWizardOpen(false)}
        existingCompanies={companies}
        isCreatingNewCompany={wizardIsCreatingNewCompany}
        onSuccess={async (created) => {
          setIsEntityWizardOpen(false);
          await checkSession();
          setActiveTab('dashboard');
        }}
      />
    </div>
  );
}

export default App;
