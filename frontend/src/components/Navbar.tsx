import React, { useState } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  BarChart3, 
  ListFilter, 
  PlusCircle, 
  Layers, 
  BookOpen,
  Scale,
  CheckSquare,
  Users,
  Landmark,
  Shield,
  Home,
  LogOut,
  Archive,
  Download,
  CheckCircle2,
  Key,
  Zap,
  Printer,
  LayoutGrid,
  Maximize,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { LicenseStatus, WindowType } from '../types';
import { api } from '../services/api';

interface NavbarProps {
  activeTab: 'dashboard' | 'accounts' | 'journal' | 'checks' | 'vendors' | 'import' | 'transactions' | 'properties';
  setActiveTab: (tab: 'dashboard' | 'accounts' | 'journal' | 'checks' | 'vendors' | 'import' | 'transactions' | 'properties') => void;
  isMultiWindowMode: boolean;
  setIsMultiWindowMode: (val: boolean) => void;
  onOpenWindow: (type: WindowType, title: string) => void;
  onOpenWriteCheckModal: () => void;
  onOpenMakeJournalModal: () => void;
  onOpenManualModal: () => void;
  onCloseCompany: () => void;
  activeCompanyName: string;
  isSample: boolean;
  licenseStatus: LicenseStatus | null;
  onOpenLicenseModal: () => void;
  onOpenCreateNewCompany: () => void;
  onOpenEntitySetup: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isMultiWindowMode,
  setIsMultiWindowMode,
  onOpenWindow,
  onOpenWriteCheckModal,
  onOpenMakeJournalModal,
  onOpenManualModal,
  onCloseCompany,
  activeCompanyName,
  isSample,
  licenseStatus,
  onOpenLicenseModal,
  onOpenCreateNewCompany,
  onOpenEntitySetup
}) => {
  const [backingUp, setBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  const handleManualBackup = async () => {
    try {
      setBackingUp(true);
      const res = await api.createBackup();
      setBackupSuccess(`Backup saved: ${res.filename}`);
      setTimeout(() => setBackupSuccess(null), 3500);
      window.open(api.getBackupDownloadUrl(res.filename), '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to create backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleNavClick = (tab: 'dashboard' | 'accounts' | 'journal' | 'checks' | 'vendors' | 'import' | 'transactions' | 'properties', title: string) => {
    setActiveTab(tab);
    if (isMultiWindowMode) {
      onOpenWindow(tab, title);
    }
  };

  const isTrial = licenseStatus?.is_trial;
  const isExpired = licenseStatus?.status === 'EXPIRED';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-md">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Active Company */}
          <div className="flex items-center space-x-3 shrink-0">
            <div 
              className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-950/40 cursor-pointer"
              onClick={() => handleNavClick('dashboard', 'Financial P&L')}
            >
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">PropBooks</span>
                
                {/* Company Dropdown Badge */}
                <div className="relative">
                  <button
                    onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                    className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-emerald-300 hover:text-white hover:bg-slate-700/80 border border-slate-700 flex items-center space-x-1.5 transition cursor-pointer"
                    title="Company & Entity Menu"
                  >
                    <Landmark className="w-3 h-3 text-emerald-400" />
                    <span className="truncate max-w-36">{activeCompanyName}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {/* Company Dropdown Menu */}
                  {showCompanyMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowCompanyMenu(false)} 
                      />
                      <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3.5 py-2.5 border-b border-slate-800 text-xs">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current File</div>
                          <div className="font-bold text-emerald-300 text-sm truncate">{activeCompanyName}</div>
                        </div>

                        <div className="py-1">
                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onOpenCreateNewCompany();
                            }}
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-800 hover:text-white flex items-center space-x-3 cursor-pointer group transition"
                          >
                            <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition">
                              <PlusCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 group-hover:text-indigo-300">Create a New Company...</div>
                              <div className="text-[10px] text-slate-400">Launch guided Entity Setup wizard</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onOpenEntitySetup();
                            }}
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-800 hover:text-white flex items-center space-x-3 cursor-pointer group transition"
                          >
                            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 group-hover:text-emerald-300">+ Entity Setup Interview...</div>
                              <div className="text-[10px] text-slate-400">Add LLC or Org to current file</div>
                            </div>
                          </button>
                        </div>

                        <div className="border-t border-slate-800 py-1">
                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              handleManualBackup();
                            }}
                            disabled={backingUp}
                            className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-800 hover:text-white flex items-center space-x-2.5 cursor-pointer text-slate-300"
                          >
                            <Archive className="w-4 h-4 text-cyan-400" />
                            <span>{backingUp ? 'Creating Backup...' : 'Create Backup Archive (.propbackup)'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onCloseCompany();
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-800 hover:text-rose-300 flex items-center space-x-2.5 cursor-pointer text-slate-300"
                          >
                            <LogOut className="w-4 h-4 text-rose-400" />
                            <span>Open Company / Switch File...</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {isSample && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Sample
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Desktop Pro Edition</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden xl:flex items-center space-x-1 bg-slate-800/70 p-1 rounded-xl border border-slate-700/60 overflow-x-auto max-w-2xl">
            <button
              onClick={() => setShowCompanyMenu(!showCompanyMenu)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                showCompanyMenu
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-indigo-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Company & Entity Management"
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Company ▾</span>
            </button>

            <button
              onClick={() => handleNavClick('dashboard', 'Financial P&L')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Financial P&L</span>
            </button>

            <button
              onClick={() => handleNavClick('accounts', 'Chart of Accounts')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>COA</span>
            </button>

            <button
              onClick={() => handleNavClick('journal', 'General Journal Entries')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'journal'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>

            <button
              onClick={() => handleNavClick('checks', 'Check Register')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'checks'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-emerald-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Checks</span>
            </button>

            <button
              onClick={() => handleNavClick('vendors', 'Vendor Center')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'vendors'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                  : 'text-amber-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Vendors</span>
            </button>

            <button
              onClick={() => handleNavClick('import', 'Import Statements')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'import'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>

            <button
              onClick={() => handleNavClick('transactions', 'Transactions Register')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Transactions</span>
            </button>

            <button
              onClick={() => handleNavClick('properties', 'Entities & Properties')}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'properties'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Properties</span>
            </button>
          </nav>

          {/* Quick Actions & Workspace Mode Toggle */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* Multi-Window Workspace Mode Toggle */}
            <button
              onClick={() => setIsMultiWindowMode(!isMultiWindowMode)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                isMultiWindowMode
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
              title={isMultiWindowMode ? 'Multi-Window Mode Active (Click to switch to Tabbed Mode)' : 'Switch to Multi-Window Desktop Workspace'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isMultiWindowMode ? 'Multi-Window' : 'Single View'}</span>
            </button>

            {/* Quick Action: Write Check */}
            <button
              onClick={onOpenWriteCheckModal}
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              title="Write Check (QuickBooks Desktop Format)"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Write Check</span>
            </button>

            {/* Quick Action: Make Journal Entry */}
            <button
              onClick={onOpenMakeJournalModal}
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              title="Make General Journal Entry by Date"
            >
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              <span>Journal Entry</span>
            </button>

            {/* License Status Pill */}
            <button
              onClick={onOpenLicenseModal}
              title="Click to view license & subscription pricing"
              className={`flex items-center space-x-1 px-2 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                isExpired
                  ? 'bg-rose-950 text-rose-300 border-rose-700 hover:bg-rose-900'
                  : isTrial
                  ? 'bg-amber-950/70 text-amber-300 border-amber-600/60 hover:bg-amber-900/70'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/70'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">{licenseStatus?.is_trial ? `Trial (${licenseStatus.days_remaining}d)` : (licenseStatus?.plan || 'Pro')}</span>
            </button>

            {/* Close Company (Auto-Backup on close) */}
            <button
              onClick={onCloseCompany}
              title="Close company and auto-backup on exit"
              className="flex items-center space-x-1 px-2 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backup Success Toast */}
      {backupSuccess && (
        <div className="bg-cyan-900 text-cyan-100 text-xs py-1.5 px-4 text-center font-medium border-t border-cyan-700 flex items-center justify-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>{backupSuccess} (Downloaded)</span>
        </div>
      )}

      {/* Mobile nav */}
      <div className="xl:hidden flex overflow-x-auto px-4 py-2 space-x-2 border-t border-slate-800 bg-slate-900/90 text-xs">
        <button onClick={() => setShowCompanyMenu(!showCompanyMenu)} className="px-2.5 py-1 rounded whitespace-nowrap bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold flex items-center space-x-1 cursor-pointer">
          <Landmark className="w-3 h-3 text-indigo-400" />
          <span>Company ▾</span>
        </button>
        <button onClick={() => handleNavClick('dashboard', 'Financial P&L')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'}`}>Financial P&L</button>
        <button onClick={() => handleNavClick('accounts', 'Chart of Accounts')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'accounts' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'}`}>COA</button>
        <button onClick={() => handleNavClick('journal', 'General Journal Entries')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'journal' ? 'bg-cyan-600 text-white font-bold' : 'text-cyan-300'}`}>Journal</button>
        <button onClick={() => handleNavClick('checks', 'Check Register')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'checks' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-300'}`}>Checks</button>
        <button onClick={() => handleNavClick('vendors', 'Vendor Center')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'vendors' ? 'bg-amber-600 text-white font-bold' : 'text-amber-300'}`}>Vendors</button>
        <button onClick={() => handleNavClick('import', 'Import Statements')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'import' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'}`}>Import</button>
        <button onClick={() => handleNavClick('transactions', 'Transactions Register')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'transactions' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'}`}>Transactions</button>
        <button onClick={() => handleNavClick('properties', 'Entities & Properties')} className={`px-2.5 py-1 rounded whitespace-nowrap ${activeTab === 'properties' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300'}`}>Properties</button>
      </div>
    </header>
  );
};
