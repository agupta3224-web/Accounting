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
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-lg">
      <div className="w-full px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-20 gap-2 xl:gap-4">
          
          {/* Brand & Active Company */}
          <div className="flex items-center space-x-3 shrink-0">
            <div 
              className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-emerald-400/30 cursor-pointer active:scale-95 transition-all"
              onClick={() => handleNavClick('dashboard', 'Financial P&L')}
            >
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white">PropBooks</span>
                
                {/* Company Dropdown Badge */}
                <div className="relative">
                  <button
                    onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-white hover:border-emerald-500/50 border border-slate-700/80 shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
                    title="Company & Entity Menu"
                  >
                    <Landmark className="w-3.5 h-3.5 text-emerald-400" />
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

          {/* Navigation Bar - Dynamically scales and fills the available width */}
          <nav className="hidden lg:flex flex-1 items-center justify-center min-w-0 mx-1 xl:mx-3">
            <div className="flex items-center space-x-1.5 xl:space-x-2 bg-slate-950/85 p-1.5 rounded-2xl border border-slate-750/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)] overflow-x-auto no-scrollbar max-w-full">
              <button
                onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  showCompanyMenu
                    ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white font-extrabold border border-indigo-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(99,102,241,0.4)] ring-2 ring-indigo-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-indigo-300 hover:text-white border border-indigo-500/40 hover:border-indigo-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
                title="Company & Entity Management"
              >
                <Landmark className="w-4 h-4 text-indigo-400" />
                <span>Company ▾</span>
              </button>

              <button
                onClick={() => handleNavClick('dashboard', 'Financial P&L')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <BarChart3 className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Financial P&L</span>
              </button>

              <button
                onClick={() => handleNavClick('accounts', 'Chart of Accounts')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'accounts'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${activeTab === 'accounts' ? 'text-white' : 'text-emerald-400'}`} />
                <span>COA</span>
              </button>

              <button
                onClick={() => handleNavClick('journal', 'General Journal Entries')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'journal'
                    ? 'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white font-extrabold border border-cyan-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <Scale className={`w-4 h-4 ${activeTab === 'journal' ? 'text-white' : 'text-cyan-400'}`} />
                <span>Journal</span>
              </button>

              <button
                onClick={() => handleNavClick('checks', 'Check Register')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'checks'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-emerald-300 hover:text-white border border-emerald-500/40 hover:border-emerald-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <CheckSquare className={`w-4 h-4 ${activeTab === 'checks' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Checks</span>
              </button>

              <button
                onClick={() => handleNavClick('vendors', 'Vendor Center')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'vendors'
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-white font-extrabold border border-amber-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(245,158,11,0.4)] ring-2 ring-amber-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-amber-300 hover:text-white border border-amber-500/40 hover:border-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'vendors' ? 'text-white' : 'text-amber-400'}`} />
                <span>Vendors</span>
              </button>

              <button
                onClick={() => handleNavClick('import', 'Import Statements')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'import'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'import' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Import</span>
              </button>

              <button
                onClick={() => handleNavClick('transactions', 'Transactions Register')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'transactions'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <ListFilter className={`w-4 h-4 ${activeTab === 'transactions' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Transactions</span>
              </button>

              <button
                onClick={() => handleNavClick('properties', 'Company/Property Structure')}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98] ${
                  activeTab === 'properties'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/40'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.3)]'
                }`}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'properties' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Company/Property Structure</span>
              </button>
            </div>
          </nav>

          {/* Quick Actions & Workspace Mode Toggle */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* Multi-Window Workspace Mode Toggle */}
            <button
              onClick={() => setIsMultiWindowMode(!isMultiWindowMode)}
              className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.25)] active:translate-y-0.5 ${
                isMultiWindowMode
                  ? 'bg-gradient-to-b from-emerald-900/60 to-emerald-950/90 text-emerald-300 border-emerald-500/60 hover:border-emerald-400'
                  : 'bg-gradient-to-b from-slate-800 to-slate-850 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
              }`}
              title={isMultiWindowMode ? 'Multi-Window Mode Active (Click to switch to Tabbed Mode)' : 'Switch to Multi-Window Desktop Workspace'}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
              <span className="hidden xl:inline">{isMultiWindowMode ? 'Multi-Window' : 'Single View'}</span>
            </button>

            {/* Quick Action: Write Check */}
            <button
              onClick={onOpenWriteCheckModal}
              className="h-11 xl:h-12 hidden lg:flex items-center space-x-1.5 px-3.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border border-emerald-400/80 rounded-xl text-xs font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(16,185,129,0.3)] active:translate-y-0.5 cursor-pointer"
              title="Write Check (QuickBooks Desktop Format)"
            >
              <CheckSquare className="w-4 h-4 text-emerald-200" />
              <span>Write Check</span>
            </button>

            {/* Quick Action: Make Journal Entry */}
            <button
              onClick={onOpenMakeJournalModal}
              className="h-11 xl:h-12 hidden lg:flex items-center space-x-1.5 px-3.5 bg-gradient-to-b from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white border border-cyan-400/80 rounded-xl text-xs font-bold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(6,182,212,0.3)] active:translate-y-0.5 cursor-pointer"
              title="Make General Journal Entry by Date"
            >
              <Scale className="w-4 h-4 text-cyan-200" />
              <span>Journal Entry</span>
            </button>

            {/* License Status Pill */}
            <button
              onClick={onOpenLicenseModal}
              title="Click to view license & subscription pricing"
              className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 text-xs font-bold rounded-xl border transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.25)] active:translate-y-0.5 cursor-pointer ${
                isExpired
                  ? 'bg-gradient-to-b from-rose-900 to-rose-950 text-rose-200 border-rose-600 hover:border-rose-400'
                  : isTrial
                  ? 'bg-gradient-to-b from-amber-950/80 to-slate-900 text-amber-300 border-amber-600/70 hover:border-amber-400'
                  : 'bg-gradient-to-b from-emerald-950/80 to-slate-900 text-emerald-300 border-emerald-600/70 hover:border-emerald-400'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{licenseStatus?.is_trial ? `Trial (${licenseStatus.days_remaining}d)` : (licenseStatus?.plan || 'Pro')}</span>
            </button>

            {/* Close Company (Auto-Backup on close) */}
            <button
              onClick={onCloseCompany}
              title="Close company and auto-backup on exit"
              className="h-11 xl:h-12 flex items-center space-x-1.5 px-3 text-xs font-bold text-slate-300 hover:text-rose-200 bg-gradient-to-b from-slate-800 to-slate-850 hover:from-rose-950 hover:to-rose-900 border border-slate-700 hover:border-rose-700/70 rounded-xl transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.25)] active:translate-y-0.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
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

      {/* Mobile nav (< lg) */}
      <div className="lg:hidden flex overflow-x-auto no-scrollbar px-3 py-2 space-x-2 border-t border-slate-800 bg-slate-900/95 text-xs">
        <button onClick={() => setShowCompanyMenu(!showCompanyMenu)} className="h-9 px-3 rounded-lg whitespace-nowrap bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-bold flex items-center space-x-1.5 shadow-sm cursor-pointer active:scale-95">
          <Landmark className="w-3.5 h-3.5 text-indigo-400" />
          <span>Company ▾</span>
        </button>
        <button onClick={() => handleNavClick('dashboard', 'Financial P&L')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>Financial P&L</button>
        <button onClick={() => handleNavClick('accounts', 'Chart of Accounts')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'accounts' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>COA</button>
        <button onClick={() => handleNavClick('journal', 'General Journal Entries')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'journal' ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-slate-800 text-cyan-300 border-slate-700'}`}>Journal</button>
        <button onClick={() => handleNavClick('checks', 'Check Register')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'checks' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-emerald-300 border-slate-700'}`}>Checks</button>
        <button onClick={() => handleNavClick('vendors', 'Vendor Center')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'vendors' ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-800 text-amber-300 border-slate-700'}`}>Vendors</button>
        <button onClick={() => handleNavClick('import', 'Import Statements')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'import' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>Import</button>
        <button onClick={() => handleNavClick('transactions', 'Transactions Register')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'transactions' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>Transactions</button>
        <button onClick={() => handleNavClick('properties', 'Company/Property Structure')} className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-sm cursor-pointer ${activeTab === 'properties' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>Company/Property Structure</button>
      </div>
    </header>
  );
};
