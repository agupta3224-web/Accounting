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
  LogOut, 
  Archive, 
  CheckCircle2, 
  Zap, 
  LayoutGrid, 
  ChevronDown, 
  Sparkles,
  Palette,
  Check
} from 'lucide-react';
import { LicenseStatus, WindowType, AppTheme } from '../types';
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
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
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
  onOpenEntitySetup,
  theme,
  setTheme
}) => {
  const [backingUp, setBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const THEMES: { id: AppTheme; label: string; icon: string; desc: string }[] = [
    { id: 'dark', label: 'Dark Mode (Default)', icon: '🌙', desc: 'Modern Midnight & Slate' },
    { id: 'light', label: 'Light Mode', icon: '☀️', desc: 'Classic Clean Accounting' },
    { id: 'navy', label: 'Navy Executive', icon: '🏛️', desc: 'Corporate Wall Street Blue' },
    { id: 'emerald', label: 'Emerald Estate', icon: '🌲', desc: 'Luxury Real Estate Forest' },
  ];

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

  const isLight = theme === 'light';
  const isNavy = theme === 'navy';
  const isEmerald = theme === 'emerald';

  // Dynamic Theme Containers
  const headerClass = isLight
    ? 'bg-white border-b border-slate-200 sticky top-0 z-40 text-slate-800 shadow-xs'
    : isNavy
    ? 'bg-[#0a1124] border-b border-blue-900/60 sticky top-0 z-40 text-white shadow-lg'
    : isEmerald
    ? 'bg-[#041710] border-b border-emerald-900/60 sticky top-0 z-40 text-white shadow-lg'
    : 'bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-lg';

  const brandTitleClass = isLight ? 'font-extrabold text-base tracking-tight text-slate-900' : 'font-extrabold text-base tracking-tight text-white';
  const brandSubClass = isLight ? 'text-[11px] text-slate-500 font-medium' : 'text-[11px] text-slate-400';

  const companyBadgeBtnClass = isLight
    ? 'text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-900 border border-slate-300 shadow-2xs flex items-center space-x-1.5 transition cursor-pointer'
    : 'text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-white hover:border-emerald-500/50 border border-slate-700/80 shadow-sm flex items-center space-x-1.5 transition cursor-pointer';

  const dropdownMenuClass = isLight
    ? 'absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-100'
    : 'absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-100';

  const dropdownBorderClass = isLight ? 'border-b border-slate-200 text-xs' : 'border-b border-slate-800 text-xs';

  const dockContainerClass = isLight
    ? 'flex items-center space-x-1.5 xl:space-x-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-300/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar max-w-full'
    : isNavy
    ? 'flex items-center space-x-1.5 xl:space-x-2 bg-[#060b17]/90 p-1.5 rounded-2xl border border-blue-900/60 shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)] overflow-x-auto no-scrollbar max-w-full'
    : isEmerald
    ? 'flex items-center space-x-1.5 xl:space-x-2 bg-[#020e09]/90 p-1.5 rounded-2xl border border-emerald-900/60 shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)] overflow-x-auto no-scrollbar max-w-full'
    : 'flex items-center space-x-1.5 xl:space-x-2 bg-slate-950/85 p-1.5 rounded-2xl border border-slate-750/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)] overflow-x-auto no-scrollbar max-w-full';

  // Navigation button inactive helper
  const navBtnBase = 'h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs xl:text-[13px] font-bold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5 active:scale-[0.98]';

  const getNavBtnClass = (isActive: boolean, activeGradient: string, inactiveLightExtra: string, inactiveDarkExtra: string) => {
    if (isActive) {
      if (isLight) {
        return `${navBtnBase} bg-white text-emerald-950 font-black border-2 border-emerald-600 shadow-md ring-2 ring-emerald-500/20`;
      }
      return `${navBtnBase} ${activeGradient}`;
    }
    if (isLight) {
      return `${navBtnBase} bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-300 hover:border-slate-400 shadow-2xs ${inactiveLightExtra}`;
    }
    if (isNavy) {
      return `${navBtnBase} bg-gradient-to-b from-[#111e38] to-[#0d182d] hover:from-[#17294d] hover:to-[#111e38] text-slate-200 hover:text-white border border-blue-900/50 shadow-sm ${inactiveDarkExtra}`;
    }
    if (isEmerald) {
      return `${navBtnBase} bg-gradient-to-b from-[#08291e] to-[#051e16] hover:from-[#0d3b2c] hover:to-[#08291e] text-emerald-100 hover:text-white border border-emerald-900/50 shadow-sm ${inactiveDarkExtra}`;
    }
    return `${navBtnBase} bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-slate-200 hover:text-white border border-slate-700/90 hover:border-slate-500 shadow-sm ${inactiveDarkExtra}`;
  };

  return (
    <header className={headerClass}>
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
                <span className={brandTitleClass}>PropBooks</span>
                
                {/* Company Dropdown Badge */}
                <div className="relative">
                  <button
                    onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                    className={companyBadgeBtnClass}
                    title="Company & Entity Menu"
                  >
                    <Landmark className={`w-3.5 h-3.5 ${isLight ? 'text-indigo-600' : 'text-emerald-400'}`} />
                    <span className="truncate max-w-36">{activeCompanyName}</span>
                    <ChevronDown className={`w-3 h-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>

                  {/* Company Dropdown Menu */}
                  {showCompanyMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowCompanyMenu(false)} 
                      />
                      <div className={dropdownMenuClass}>
                        <div className={`px-3.5 py-2.5 ${dropdownBorderClass}`}>
                          <div className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Current File</div>
                          <div className={`font-bold text-sm truncate ${isLight ? 'text-indigo-900' : 'text-emerald-300'}`}>{activeCompanyName}</div>
                        </div>

                        <div className="py-1">
                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onOpenCreateNewCompany();
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-3 cursor-pointer group transition ${
                              isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-slate-800 text-slate-200 hover:text-white'
                            }`}
                          >
                            <div className="p-1.5 bg-indigo-500/20 text-indigo-500 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
                              <PlusCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className={`font-bold ${isLight ? 'text-slate-800 group-hover:text-indigo-700' : 'text-slate-100 group-hover:text-indigo-300'}`}>Create a New Company...</div>
                              <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Launch guided Entity Setup wizard</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onOpenEntitySetup();
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center space-x-3 cursor-pointer group transition ${
                              isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-slate-800 text-slate-200 hover:text-white'
                            }`}
                          >
                            <div className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <div className={`font-bold ${isLight ? 'text-slate-800 group-hover:text-emerald-700' : 'text-slate-100 group-hover:text-emerald-300'}`}>+ Entity Setup Interview...</div>
                              <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Add LLC or Org to current file</div>
                            </div>
                          </button>
                        </div>

                        <div className={`border-t py-1 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              handleManualBackup();
                            }}
                            disabled={backingUp}
                            className={`w-full text-left px-3.5 py-2 text-xs flex items-center space-x-2.5 cursor-pointer ${
                              isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <Archive className="w-4 h-4 text-cyan-500" />
                            <span>{backingUp ? 'Creating Backup...' : 'Create Backup Archive (.propbackup)'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowCompanyMenu(false);
                              onCloseCompany();
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs flex items-center space-x-2.5 cursor-pointer ${
                              isLight ? 'hover:bg-rose-50 text-rose-700' : 'hover:bg-slate-800 hover:text-rose-300 text-slate-300'
                            }`}
                          >
                            <LogOut className="w-4 h-4 text-rose-500" />
                            <span>Open Company / Switch File...</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {isSample && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    Sample
                  </span>
                )}
              </div>
              <p className={brandSubClass}>Desktop Pro Edition</p>
            </div>
          </div>

          {/* Navigation Bar - Dynamically scales and fills the available width */}
          <nav className="hidden lg:flex flex-1 items-center justify-center min-w-0 mx-1 xl:mx-3">
            <div className={dockContainerClass}>
              
              {/* Company Button */}
              <button
                onClick={() => setShowCompanyMenu(!showCompanyMenu)}
                className={getNavBtnClass(
                  showCompanyMenu,
                  'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white font-extrabold border border-indigo-350 shadow-md ring-2 ring-indigo-400/40',
                  'text-indigo-700 hover:text-indigo-950 border-indigo-200',
                  'text-indigo-300 hover:text-white border-indigo-500/40'
                )}
                title="Company & Entity Management"
              >
                <Landmark className={`w-4 h-4 ${showCompanyMenu ? 'text-white' : isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
                <span>Company ▾</span>
              </button>

              {/* Financial P&L */}
              <button
                onClick={() => handleNavClick('dashboard', 'Financial P&L')}
                className={getNavBtnClass(
                  activeTab === 'dashboard',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-slate-700 hover:text-slate-950 border-slate-300',
                  'text-slate-200 hover:text-white border-slate-700/90'
                )}
              >
                <BarChart3 className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Financial P&L</span>
              </button>

              {/* COA */}
              <button
                onClick={() => handleNavClick('accounts', 'Chart of Accounts')}
                className={getNavBtnClass(
                  activeTab === 'accounts',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-slate-700 hover:text-slate-950 border-slate-300',
                  'text-slate-200 hover:text-white border-slate-700/90'
                )}
              >
                <BookOpen className={`w-4 h-4 ${activeTab === 'accounts' ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>COA</span>
              </button>

              {/* Journal */}
              <button
                onClick={() => handleNavClick('journal', 'General Journal Entries')}
                className={getNavBtnClass(
                  activeTab === 'journal',
                  'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white font-extrabold border border-cyan-350 shadow-md ring-2 ring-cyan-400/40',
                  'text-cyan-800 hover:text-cyan-950 border-cyan-300',
                  'text-cyan-300 hover:text-white border-cyan-500/40'
                )}
              >
                <Scale className={`w-4 h-4 ${activeTab === 'journal' ? 'text-white' : isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                <span>Journal</span>
              </button>

              {/* Checks */}
              <button
                onClick={() => handleNavClick('checks', 'Check Register')}
                className={getNavBtnClass(
                  activeTab === 'checks',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-emerald-800 hover:text-emerald-950 border-emerald-300',
                  'text-emerald-300 hover:text-white border-emerald-500/40'
                )}
              >
                <CheckSquare className={`w-4 h-4 ${activeTab === 'checks' ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Checks</span>
              </button>

              {/* Vendors */}
              <button
                onClick={() => handleNavClick('vendors', 'Vendor Center')}
                className={getNavBtnClass(
                  activeTab === 'vendors',
                  'bg-gradient-to-b from-amber-500 to-amber-600 text-white font-extrabold border border-amber-350 shadow-md ring-2 ring-amber-400/40',
                  'text-amber-800 hover:text-amber-950 border-amber-300',
                  'text-amber-300 hover:text-white border-amber-500/40'
                )}
              >
                <Users className={`w-4 h-4 ${activeTab === 'vendors' ? 'text-white' : isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                <span>Vendors</span>
              </button>

              {/* Import */}
              <button
                onClick={() => handleNavClick('import', 'Import Statements')}
                className={getNavBtnClass(
                  activeTab === 'import',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-slate-700 hover:text-slate-950 border-slate-300',
                  'text-slate-200 hover:text-white border-slate-700/90'
                )}
              >
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'import' ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Import</span>
              </button>

              {/* Transactions */}
              <button
                onClick={() => handleNavClick('transactions', 'Transactions Register')}
                className={getNavBtnClass(
                  activeTab === 'transactions',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-slate-700 hover:text-slate-950 border-slate-300',
                  'text-slate-200 hover:text-white border-slate-700/90'
                )}
              >
                <ListFilter className={`w-4 h-4 ${activeTab === 'transactions' ? 'text-white' : isLight ? 'text-teal-600' : 'text-emerald-400'}`} />
                <span>Transactions</span>
              </button>

              {/* Company/Property Structure */}
              <button
                onClick={() => handleNavClick('properties', 'Company/Property Structure')}
                className={getNavBtnClass(
                  activeTab === 'properties',
                  'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-extrabold border border-emerald-350 shadow-md ring-2 ring-emerald-400/40',
                  'text-slate-700 hover:text-slate-950 border-slate-300',
                  'text-slate-200 hover:text-white border-slate-700/90'
                )}
              >
                <Layers className={`w-4 h-4 ${activeTab === 'properties' ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                <span>Company/Property Structure</span>
              </button>
            </div>
          </nav>

          {/* Quick Actions & Workspace Mode Toggle */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* Theme Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:translate-y-0.5 ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                    : isNavy
                    ? 'bg-[#111e38] hover:bg-[#16274a] text-amber-300 border-blue-900/60'
                    : isEmerald
                    ? 'bg-[#08291e] hover:bg-[#0c392b] text-amber-300 border-emerald-900/60'
                    : 'bg-gradient-to-b from-slate-800 to-slate-850 hover:from-slate-700 hover:to-slate-800 text-amber-300 hover:text-white border-slate-700 hover:border-amber-500/50'
                }`}
                title="Theme Settings (Dark, Light, Navy Executive, Emerald Estate)"
              >
                <Palette className="w-4 h-4 text-amber-400" />
                <span className="hidden xl:inline capitalize">
                  {theme === 'dark' ? 'Theme: Dark' : theme === 'light' ? 'Theme: Light' : theme === 'navy' ? 'Theme: Navy' : 'Theme: Emerald'}
                </span>
                <ChevronDown className={`w-3 h-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </button>

              {/* Theme Dropdown Menu */}
              {showThemeMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowThemeMenu(false)} 
                  />
                  <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 border ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}>
                    <div className={`px-3.5 py-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <div className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Color Theme</div>
                      <div className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Select interface appearance</div>
                    </div>
                    <div className="py-1">
                      {THEMES.map((t) => {
                        const isSelected = theme === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setTheme(t.id);
                              setShowThemeMenu(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between cursor-pointer transition ${
                              isSelected
                                ? isLight ? 'bg-slate-100 font-bold text-emerald-700' : 'bg-slate-800/90 font-bold text-emerald-300'
                                : isLight ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <span className="text-base">{t.icon}</span>
                              <div>
                                <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{t.label}</div>
                                <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{t.desc}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Multi-Window Workspace Mode Toggle */}
            <button
              onClick={() => setIsMultiWindowMode(!isMultiWindowMode)}
              className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 xl:px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:translate-y-0.5 ${
                isLight
                  ? isMultiWindowMode
                    ? 'bg-white hover:bg-emerald-50 text-emerald-950 border-2 border-emerald-600 shadow-sm'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 shadow-2xs'
                  : isMultiWindowMode
                  ? 'bg-gradient-to-b from-emerald-900/60 to-emerald-950/90 text-emerald-300 border border-emerald-500/60 hover:border-emerald-400 font-bold'
                  : 'bg-gradient-to-b from-slate-800 to-slate-850 text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white font-bold'
              }`}
              title={isMultiWindowMode ? 'Multi-Window Mode Active (Click to switch to Tabbed Mode)' : 'Switch to Multi-Window Desktop Workspace'}
            >
              <LayoutGrid className={`w-4 h-4 ${isLight ? (isMultiWindowMode ? 'text-emerald-700' : 'text-slate-600') : 'text-emerald-500'}`} />
              <span className={`hidden xl:inline ${isLight ? (isMultiWindowMode ? 'text-emerald-950 font-black' : 'text-slate-800 font-bold') : ''}`}>
                {isMultiWindowMode ? 'Multi-Window' : 'Single View'}
              </span>
            </button>

            {/* Quick Action: Write Check */}
            <button
              onClick={onOpenWriteCheckModal}
              className={`h-11 xl:h-12 hidden lg:flex items-center space-x-1.5 px-3.5 rounded-xl text-xs font-black transition-all shadow-xs active:translate-y-0.5 cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-emerald-50 text-emerald-950 border-2 border-emerald-600'
                  : 'bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border border-emerald-400/80 font-bold shadow-sm'
              }`}
              title="Write Check (QuickBooks Desktop Format)"
            >
              <CheckSquare className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-100'}`} />
              <span className={isLight ? 'text-emerald-950 font-black' : ''}>Write Check</span>
            </button>

            {/* Quick Action: Make Journal Entry */}
            <button
              onClick={onOpenMakeJournalModal}
              className={`h-11 xl:h-12 hidden lg:flex items-center space-x-1.5 px-3.5 rounded-xl text-xs font-black transition-all shadow-xs active:translate-y-0.5 cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-cyan-50 text-cyan-950 border-2 border-cyan-600'
                  : 'bg-gradient-to-b from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white border border-cyan-400/80 font-bold shadow-sm'
              }`}
              title="Make General Journal Entry by Date"
            >
              <Scale className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-100'}`} />
              <span className={isLight ? 'text-cyan-950 font-black' : ''}>Journal Entry</span>
            </button>

            {/* License Status Pill */}
            <button
              onClick={onOpenLicenseModal}
              title="Click to view license & subscription pricing"
              className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 text-xs font-black rounded-xl transition-all shadow-xs active:translate-y-0.5 cursor-pointer ${
                isLight
                  ? isExpired
                    ? 'bg-white hover:bg-rose-50 text-rose-950 border-2 border-rose-500'
                    : isTrial
                    ? 'bg-white hover:bg-amber-50 text-amber-950 border-2 border-amber-500'
                    : 'bg-white hover:bg-emerald-50 text-emerald-950 border-2 border-emerald-600'
                  : isExpired
                  ? 'bg-gradient-to-b from-rose-900 to-rose-950 text-rose-200 border border-rose-600 hover:border-rose-400 font-bold'
                  : isTrial
                  ? 'bg-gradient-to-b from-amber-950/80 to-slate-900 text-amber-300 border border-amber-600/70 hover:border-amber-400 font-bold'
                  : 'bg-gradient-to-b from-emerald-950/80 to-slate-900 text-emerald-300 border border-emerald-600/70 hover:border-emerald-400 font-bold'
              }`}
            >
              <Zap className={`w-4 h-4 ${isLight ? 'text-amber-500 fill-amber-500' : 'text-amber-400'}`} />
              <span className={`hidden sm:inline ${isLight ? 'text-emerald-950 font-black' : ''}`}>
                {licenseStatus?.is_trial ? `Trial (${licenseStatus.days_remaining}d)` : (licenseStatus?.plan || 'Pro')}
              </span>
            </button>

            {/* Close Company (Auto-Backup on close) */}
            <button
              onClick={onCloseCompany}
              title="Close company and auto-backup on exit"
              className={`h-11 xl:h-12 flex items-center space-x-1.5 px-3 text-xs font-black rounded-xl transition-all shadow-xs active:translate-y-0.5 cursor-pointer ${
                isLight
                  ? 'text-rose-800 hover:text-rose-950 bg-white hover:bg-rose-50 border-2 border-rose-400'
                  : 'text-slate-300 hover:text-rose-200 bg-gradient-to-b from-slate-800 to-slate-850 hover:from-rose-950 hover:to-rose-900 border border-slate-700 hover:border-rose-700/70 font-bold'
              }`}
            >
              <LogOut className={`w-4 h-4 ${isLight ? 'text-rose-600' : 'text-rose-500'}`} />
              <span className={`hidden sm:inline ${isLight ? 'text-rose-800 font-black' : ''}`}>Close</span>
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
      <div className={`lg:hidden flex overflow-x-auto no-scrollbar px-3 py-2 space-x-2 border-t ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900/95 border-slate-800 text-slate-200'
      }`}>
        <button
          onClick={() => {
            const next: AppTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'navy' : theme === 'navy' ? 'emerald' : 'dark';
            setTheme(next);
          }}
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95 border ${
            isLight ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          }`}
          title="Cycle Theme"
        >
          <Palette className="w-3.5 h-3.5 text-amber-500" />
          <span className="capitalize">{theme}</span>
        </button>
        <button 
          onClick={() => setShowCompanyMenu(!showCompanyMenu)} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95 border ${
            isLight ? 'bg-indigo-50 text-indigo-900 border-indigo-200' : 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 text-indigo-500" />
          <span>Company ▾</span>
        </button>
        <button 
          onClick={() => handleNavClick('dashboard', 'Financial P&L')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Financial P&L
        </button>
        <button 
          onClick={() => handleNavClick('accounts', 'Chart of Accounts')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          COA
        </button>
        <button 
          onClick={() => handleNavClick('journal', 'General Journal Entries')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'journal'
              ? 'bg-cyan-600 text-white border-cyan-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Journal
        </button>
        <button 
          onClick={() => handleNavClick('checks', 'Check Register')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'checks'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Checks
        </button>
        <button 
          onClick={() => handleNavClick('vendors', 'Vendor Center')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'vendors'
              ? 'bg-amber-600 text-white border-amber-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Vendors
        </button>
        <button 
          onClick={() => handleNavClick('import', 'Import Statements')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'import'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Import
        </button>
        <button 
          onClick={() => handleNavClick('transactions', 'Transactions Register')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Transactions
        </button>
        <button 
          onClick={() => handleNavClick('properties', 'Company/Property Structure')} 
          className={`h-9 px-3 rounded-lg whitespace-nowrap font-bold border transition shadow-2xs cursor-pointer ${
            activeTab === 'properties'
              ? 'bg-emerald-600 text-white border-emerald-500' 
              : isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          Company/Property Structure
        </button>
      </div>
    </header>
  );
};
