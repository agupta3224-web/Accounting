import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Hash, 
  BookOpen, 
  RefreshCw,
  Building2,
  DollarSign,
  PieChart,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { AccountItem } from '../types';
import { api } from '../services/api';
import { AccountFormModal } from '../components/AccountFormModal';
import { CoaImportModal } from '../components/CoaImportModal';

interface ChartOfAccountsProps {
  activeCompanyName: string;
  onAccountsChange?: () => void;
}

const CLASSIFICATION_FILTERS = [
  { key: 'ALL', label: 'All Accounts', badge: 'All' },
  { key: 'ASSET', label: '1xxxx Assets', badge: '10000-19999', color: 'emerald' },
  { key: 'LIABILITY', label: '2xxxx Payables & Liabilities', badge: '20000-29999', color: 'amber' },
  { key: 'EQUITY', label: '3xxxx Equity', badge: '30000-39999', color: 'blue' },
  { key: 'INCOME', label: '4xxxx Revenue & Income', badge: '40000-49999', color: 'teal' },
  { key: 'COGS', label: '5xxxx Cost of Goods Sold', badge: '50000-59999', color: 'orange' },
  { key: 'OPERATING_EXPENSE', label: '6xxxx-8xxxx Operating Expenses', badge: '60000-89999', color: 'rose' },
  { key: 'OTHER_INCOME_EXPENSE', label: '9xxxx Other Income/Expense', badge: '90000-99999', color: 'purple' },
];

export const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({ activeCompanyName, onAccountsChange }) => {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editAccount, setEditAccount] = useState<AccountItem | null>(null);
  const [parentAccountPreset, setParentAccountPreset] = useState<AccountItem | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [templateResetting, setTemplateResetting] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [selectedType, search, activeOnly]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.getAccounts({
        type: selectedType === 'ALL' ? undefined : selectedType,
        search: search.trim() || undefined,
        active_only: activeOnly
      });
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateNew = () => {
    setEditAccount(null);
    setParentAccountPreset(null);
    setIsFormModalOpen(true);
  };

  const handleAddSubAccount = (parentAcct: AccountItem) => {
    setEditAccount(null);
    setParentAccountPreset(parentAcct);
    setIsFormModalOpen(true);
  };

  const handleApplyTemplate = async (template: 'DEFAULT' | 'CUSTOM') => {
    const label = template === 'CUSTOM'
      ? 'Custom 8-Base Account COA (10000 All Assets through 80000 Other Income/Expenses)'
      : 'Standard Real Estate Chart of Accounts';
    if (!window.confirm(`Initialize ${label}? This will reset existing chart of accounts.`)) {
      return;
    }

    try {
      setTemplateResetting(true);
      const res = await api.resetCoaTemplate(template, true);
      showToast(res.message || 'Chart of Accounts initialized');
      setShowTemplateModal(false);
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to initialize template');
    } finally {
      setTemplateResetting(false);
    }
  };

  const handleEdit = (acct: AccountItem) => {
    setParentAccountPreset(null);
    setEditAccount(acct);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (acct: AccountItem) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate account "[${acct.account_number}] ${acct.name}"?`)) {
      return;
    }

    try {
      const res = await api.deleteAccount(acct.id);
      showToast(res.message || 'Account processed');
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  const handleExportCsv = () => {
    window.open(api.getAccountsExportUrl(), '_blank');
  };

  const handleDownloadTemplate = () => {
    window.open(api.getAccountsTemplateUrl(), '_blank');
  };

  // Group counts
  const assetCount = accounts.filter(a => a.type === 'ASSET').length;
  const liabilityCount = accounts.filter(a => a.type === 'LIABILITY').length;
  const equityCount = accounts.filter(a => a.type === 'EQUITY').length;
  const incomeCount = accounts.filter(a => a.type === 'INCOME' || a.type === 'REVENUE').length;
  const cogsCount = accounts.filter(a => a.type === 'COGS').length;
  const expenseCount = accounts.filter(a => a.type === 'OPERATING_EXPENSE').length;
  const otherCount = accounts.filter(a => a.type === 'OTHER_INCOME_EXPENSE' || a.type === 'NON_OPERATING_EXPENSE' || a.type === 'CAPEX').length;

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'ASSET': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'LIABILITY': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'EQUITY': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'INCOME':
      case 'REVENUE': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'COGS': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'OPERATING_EXPENSE': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'OTHER_INCOME_EXPENSE':
      case 'NON_OPERATING_EXPENSE':
      case 'CAPEX': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getNumberColorClass = (numStr: string) => {
    if (!numStr) return 'text-slate-400 bg-slate-800 border-slate-700';
    const firstDigit = numStr.trim()[0];
    if (firstDigit === '1') return 'text-emerald-300 bg-emerald-950/60 border-emerald-800/80';
    if (firstDigit === '2') return 'text-amber-300 bg-amber-950/60 border-amber-800/80';
    if (firstDigit === '3') return 'text-blue-300 bg-blue-950/60 border-blue-800/80';
    if (firstDigit === '4') return 'text-teal-300 bg-teal-950/60 border-teal-800/80';
    if (firstDigit === '5') return 'text-orange-300 bg-orange-950/60 border-orange-800/80';
    if (['6', '7', '8'].includes(firstDigit)) return 'text-rose-300 bg-rose-950/60 border-rose-800/80';
    if (firstDigit === '9') return 'text-purple-300 bg-purple-950/60 border-purple-800/80';
    return 'text-slate-300 bg-slate-800 border-slate-700';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-900 border border-emerald-700 text-emerald-100 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Chart of Accounts</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard Real Estate Accounting Numbering System (1xxxx–9xxxx) • <span className="text-emerald-300 font-semibold">{activeCompanyName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Button Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadTemplate}
            title="Download blank sample CSV template with 1xxxx–9xxxx structure"
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Sample Template</span>
          </button>

          <button
            onClick={handleExportCsv}
            title="Export all accounts to CSV file"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 rounded-xl transition cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            title="Import Chart of Accounts from CSV"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-teal-200 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-700/60 rounded-xl transition cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowTemplateModal(true)}
            title="Switch or reset Chart of Accounts template (Standard vs 8-Account Custom Base)"
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/60 rounded-xl transition cursor-pointer shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>COA Templates</span>
          </button>

          <button
            onClick={handleCreateNew}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ New Account</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div 
          onClick={() => setSelectedType('ALL')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'ALL' ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Accounts</span>
          <p className="text-xl font-extrabold text-white mt-0.5">{accounts.length}</p>
        </div>

        <div 
          onClick={() => setSelectedType('ASSET')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'ASSET' ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-emerald-400">1xxxx Assets</span>
          <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{assetCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('LIABILITY')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'LIABILITY' ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-amber-400">2xxxx Payables</span>
          <p className="text-xl font-extrabold text-amber-300 mt-0.5">{liabilityCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('EQUITY')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'EQUITY' ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-blue-400">3xxxx Equities</span>
          <p className="text-xl font-extrabold text-blue-300 mt-0.5">{equityCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('INCOME')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'INCOME' ? 'bg-teal-950/40 border-teal-500 ring-1 ring-teal-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-teal-400">4xxxx Revenue</span>
          <p className="text-xl font-extrabold text-teal-300 mt-0.5">{incomeCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('COGS')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'COGS' ? 'bg-orange-950/40 border-orange-500 ring-1 ring-orange-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-orange-400">5xxxx COGS</span>
          <p className="text-xl font-extrabold text-orange-300 mt-0.5">{cogsCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('OPERATING_EXPENSE')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'OPERATING_EXPENSE' ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-rose-400">6xxxx Expenses</span>
          <p className="text-xl font-extrabold text-rose-300 mt-0.5">{expenseCount}</p>
        </div>

        <div 
          onClick={() => setSelectedType('OTHER_INCOME_EXPENSE')}
          className={`p-3 rounded-xl border transition cursor-pointer ${selectedType === 'OTHER_INCOME_EXPENSE' ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'}`}
        >
          <span className="text-[10px] uppercase font-bold text-purple-400">9xxxx Other</span>
          <p className="text-xl font-extrabold text-purple-300 mt-0.5">{otherCount}</p>
        </div>
      </div>

      {/* Accounting Numbering Reference Guide Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800/50 transition cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span>Standard Real Estate Accounting Numbering Reference & Guidelines</span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 font-normal">
            <span>{showGuide ? 'Hide Guide' : 'Show Standard Breakdown'}</span>
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showGuide && (
          <div className="p-5 border-t border-slate-800 bg-slate-950/50 text-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-emerald-300">
                  <span className="px-1.5 py-0.5 bg-emerald-900 text-emerald-200 rounded font-mono text-[10px]">1xxxx</span>
                  <span>Assets</span>
                </div>
                <p className="text-slate-400 text-[11px]">10010 Operating Bank, 10020 Security Escrow, 10100 Cash on Hand, 10200 Accounts Receivable, 15000 Property Buildings.</p>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-amber-300">
                  <span className="px-1.5 py-0.5 bg-amber-900 text-amber-200 rounded font-mono text-[10px]">2xxxx</span>
                  <span>Payables & Liabilities</span>
                </div>
                <p className="text-slate-400 text-[11px]">20100 Accounts Payable, 20200 Tenant Security Deposits Held, 20300 Credit Cards, 25000 Long-Term Mortgages.</p>
              </div>

              <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-blue-300">
                  <span className="px-1.5 py-0.5 bg-blue-900 text-blue-200 rounded font-mono text-[10px]">3xxxx</span>
                  <span>Equities</span>
                </div>
                <p className="text-slate-400 text-[11px]">30100 Owner's Equity & Contributions, 30200 Owner's Draws & Distributions, 30300 Retained Earnings.</p>
              </div>

              <div className="p-3 bg-teal-950/20 border border-teal-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-teal-300">
                  <span className="px-1.5 py-0.5 bg-teal-900 text-teal-200 rounded font-mono text-[10px]">4xxxx</span>
                  <span>Revenue & Income</span>
                </div>
                <p className="text-slate-400 text-[11px]">40100 Rental Income, 40200 Late Fees & Misc, 40300 Laundry & Parking, 40400 Pet Fees & Screening.</p>
              </div>

              <div className="p-3 bg-orange-950/20 border border-orange-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-orange-300">
                  <span className="px-1.5 py-0.5 bg-orange-900 text-orange-200 rounded font-mono text-[10px]">5xxxx</span>
                  <span>Cost of Goods Sold (COGS)</span>
                </div>
                <p className="text-slate-400 text-[11px]">50100 Direct Turnaround Cleaning, 50200 Turnover Subcontractors, 50300 Turnover Hardware & Supplies.</p>
              </div>

              <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 font-bold text-rose-300">
                  <span className="px-1.5 py-0.5 bg-rose-900 text-rose-200 rounded font-mono text-[10px]">6xxxx-8xxxx</span>
                  <span>Operating Expenses</span>
                </div>
                <p className="text-slate-400 text-[11px]">60100 Repairs & Maintenance, 60200 Management Fees, 60300 Taxes, 60400 Insurance, 60500 Utilities, 60600 Landscaping.</p>
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-xl space-y-1 md:col-span-2 lg:col-span-3">
                <div className="flex items-center space-x-2 font-bold text-purple-300">
                  <span className="px-1.5 py-0.5 bg-purple-900 text-purple-200 rounded font-mono text-[10px]">9xxxx</span>
                  <span>Other Income & Expenses / CapEx</span>
                </div>
                <p className="text-slate-400 text-[11px]">90100 Interest Income, 90200 Mortgage Principal & Interest, 90300 Capital Improvements (CapEx), 90400 Depreciation.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account number, name, sub-type, or description..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Active Only Switch */}
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 text-xs text-slate-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500"
              />
              <span>Active Accounts Only</span>
            </label>
            <button
              onClick={fetchAccounts}
              title="Refresh Accounts"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Classification Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {CLASSIFICATION_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSelectedType(f.key)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                selectedType === f.key
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950 font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>{f.label}</span>
              <span className="text-[10px] opacity-75 font-mono">({f.badge})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Loading Chart of Accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No accounts found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No accounts match the current classification or search criteria.
            </p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
            >
              + Create First Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700/80 text-[11px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 w-24">Account #</th>
                  <th className="px-4 py-3.5">Account Name</th>
                  <th className="px-4 py-3.5">Classification Type</th>
                  <th className="px-4 py-3.5">Sub-Type / Detail</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5 text-right">Balance</th>
                  <th className="px-4 py-3.5 text-center">Txns</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accounts.map((acct) => (
                  <tr key={acct.id} className="hover:bg-slate-800/40 transition">
                    {/* Account Number */}
                    <td className="px-4 py-3 font-mono">
                      <span className={`px-2 py-0.5 rounded-md border font-bold text-xs ${getNumberColorClass(acct.account_number)}`}>
                        {acct.account_number || '—'}
                      </span>
                    </td>

                    {/* Account Name & Special Badges */}
                    <td className="px-4 py-3">
                      <div className={`flex items-center space-x-2 ${(acct.is_sub_account || acct.parent_account_id) ? 'pl-6' : ''}`}>
                        {(acct.is_sub_account || acct.parent_account_id) && (
                          <span className="text-slate-500 font-mono text-xs font-bold">↳</span>
                        )}
                        <span className={`text-slate-100 ${(acct.is_sub_account || acct.parent_account_id) ? 'font-medium text-slate-200' : 'font-bold'}`}>
                          {acct.name}
                        </span>
                        {(acct.is_sub_account || acct.parent_account_id) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Sub of {acct.parent_account_number ? `[${acct.parent_account_number}] ` : ''}{acct.parent_account_name || 'Parent'}
                          </span>
                        )}
                        {acct.is_rental_income && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Rental Income
                          </span>
                        )}
                        {acct.is_repair_category && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Repairs
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Classification Type */}
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getTypeBadgeColor(acct.type)}`}>
                        {acct.type}
                      </span>
                    </td>

                    {/* Sub-Type */}
                    <td className="px-4 py-3 text-slate-300">
                      {acct.sub_type ? (
                        <span className="flex items-center space-x-1 text-slate-300">
                          <Tag className="w-3 h-3 text-slate-500" />
                          <span>{acct.sub_type}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={acct.description || ''}>
                      {acct.description || '—'}
                    </td>

                    {/* Balance & Opening Balance */}
                    <td className="px-4 py-3 text-right font-mono">
                      <div className="font-semibold text-slate-100 text-xs">
                        {acct.current_balance !== undefined && acct.current_balance !== null
                          ? (acct.current_balance < 0
                              ? `-$${Math.abs(acct.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${acct.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                          : (acct.opening_balance !== undefined && acct.opening_balance !== null && acct.opening_balance !== 0
                              ? `$${acct.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—')}
                      </div>
                      {acct.opening_balance !== undefined && acct.opening_balance !== null && acct.opening_balance !== 0 && (
                        <div className="text-[10px] text-emerald-400 font-normal mt-0.5" title={`Opening Balance recorded as of ${acct.opening_balance_date || 'initial setup'}`}>
                          Opening: ${acct.opening_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {acct.opening_balance_date ? ` (${acct.opening_balance_date})` : ''}
                        </div>
                      )}
                    </td>

                    {/* Transactions count */}
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {acct.transactions_count || 0}
                      </span>
                    </td>

                    {/* Active Status */}
                    <td className="px-4 py-3 text-center">
                      {acct.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleAddSubAccount(acct)}
                          title={`Add Sub-Account under [${acct.account_number}] ${acct.name}`}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 transition cursor-pointer"
                        >
                          + Sub
                        </button>
                        <button
                          onClick={() => handleEdit(acct)}
                          title="Edit Account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(acct)}
                          title="Delete / Deactivate Account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Form Modal */}
      <AccountFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setParentAccountPreset(null);
        }}
        onSuccess={() => {
          showToast(editAccount ? 'Account updated successfully' : 'New account created successfully');
          fetchAccounts();
          onAccountsChange?.();
        }}
        editAccount={editAccount}
        parentAccountPreset={parentAccountPreset}
        allAccounts={accounts}
      />

      {/* COA CSV Import Modal */}
      <CoaImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          showToast('Chart of Accounts import processed');
          fetchAccounts();
          onAccountsChange?.();
        }}
      />

      {/* COA Templates / Reset Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Chart of Accounts Templates</h3>
                  <p className="text-xs text-slate-400">Choose your base structure or apply standard presets</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <ChevronUp className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-purple-500/50 transition flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-purple-300">Custom 8-Account Base System</span>
                  <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 font-mono text-[10px] font-bold">10000 - 80000</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Initializes the exact 8 base accounts specified for real estate investors who want to build their own chart of accounts from scratch:
                </p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-300 pt-1">
                  <span>10000 All Assets</span>
                  <span>50000 Used for Flips only</span>
                  <span>20000 All Liabilities</span>
                  <span>60000 All Operating Expenses</span>
                  <span>30000 All Equity</span>
                  <span>70000 All Operating Expenses</span>
                  <span>40000 All Revenue (Income)</span>
                  <span>80000 Other Income/Expenses</span>
                </div>
                <div className="pt-2">
                  <button
                    disabled={templateResetting}
                    onClick={() => handleApplyTemplate('CUSTOM')}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>{templateResetting ? 'Applying...' : 'Apply Custom Base System (10000 - 80000)'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-emerald-500/50 transition flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-300">Standard Real Estate Chart of Accounts</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 font-mono text-[10px] font-bold">Recommended</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Pre-configured with industry-standard real estate accounts including Operating Bank, Security Deposits Escrow, Rental Income, Repairs, Capex, Mortgage Principal &amp; Interest, and Management Fees.
                </p>
                <div className="pt-2">
                  <button
                    disabled={templateResetting}
                    onClick={() => handleApplyTemplate('DEFAULT')}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <span>{templateResetting ? 'Applying...' : 'Apply Standard Real Estate Template'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COA CSV Import Modal */}
      <CoaImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          showToast('Chart of Accounts import processed');
          fetchAccounts();
        }}
      />
    </div>
  );
};

