import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Ban, 
  RefreshCw, 
  Landmark, 
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Upload,
  Sparkles,
  Sliders,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { CheckRecord, Category, Property, ClassEntity } from '../types';
import { BankImportWizardModal } from '../components/banking/BankImportWizardModal';
import { BankRulesModal } from '../components/banking/BankRulesModal';

interface CheckRegisterPageProps {
  onOpenWriteCheckModal: () => void;
  onPrintCheck: (check: CheckRecord) => void;
  categories: Category[];
  properties: Property[];
  classes: ClassEntity[];
}

export const CheckRegisterPage: React.FC<CheckRegisterPageProps> = ({
  onOpenWriteCheckModal,
  onPrintCheck,
  categories,
  properties,
  classes
}) => {
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bank import and rules modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Filters
  const [bankFilter, setBankFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Auto-refresh categories when register opens or COA is modified
  const [allCategories, setAllCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setAllCategories(categories);
  }, [categories]);

  const refreshCategories = async () => {
    try {
      const cats = await api.getCategories();
      setAllCategories(cats);
    } catch (err) {
      console.error('Failed to refresh categories for check register:', err);
    }
  };

  useEffect(() => {
    refreshCategories();
    const handleCoaUpdate = () => refreshCategories();
    window.addEventListener('coa-updated', handleCoaUpdate);
    return () => window.removeEventListener('coa-updated', handleCoaUpdate);
  }, []);

  // Helper to determine if an account is a bank/checking account or sub-account
  const isBankOrSubAccount = (c: Category, allCats: Category[]): boolean => {
    if (c.type === 'BANK' || (c.sub_type && c.sub_type.toLowerCase().includes('bank'))) return true;
    if (c.parent_account_id) {
      const parent = allCats.find(p => p.id === c.parent_account_id);
      if (parent && isBankOrSubAccount(parent, allCats)) return true;
    }
    const num = parseInt(c.account_number?.replace(/\D/g, '') || '0', 10);
    if (c.type === 'ASSET' && num >= 10000 && num < 10500) return true;
    return false;
  };

  // Build hierarchical list of bank accounts
  const bankAccounts = React.useMemo(() => {
    const rawBankCats = allCategories.filter(c => isBankOrSubAccount(c, allCategories));
    
    const parents = rawBankCats.filter(c => !c.parent_account_id);
    const subMap = new Map<number, Category[]>();
    rawBankCats.forEach(c => {
      if (c.parent_account_id) {
        const list = subMap.get(c.parent_account_id) || [];
        list.push(c);
        subMap.set(c.parent_account_id, list);
      }
    });

    const ordered: { account: Category; isSub: boolean; parentName?: string; depth: number }[] = [];
    const addedIds = new Set<number>();

    parents.forEach(p => {
      ordered.push({ account: p, isSub: false, depth: 0 });
      addedIds.add(p.id);
      const subs = subMap.get(p.id) || [];
      subs.sort((a, b) => (a.account_number || '').localeCompare(b.account_number || ''));
      subs.forEach(s => {
        ordered.push({ account: s, isSub: true, parentName: p.name, depth: 1 });
        addedIds.add(s.id);
      });
    });

    rawBankCats.forEach(c => {
      if (!addedIds.has(c.id)) {
        const parent = allCategories.find(p => p.id === c.parent_account_id);
        ordered.push({ 
          account: c, 
          isSub: Boolean(c.parent_account_id), 
          parentName: parent?.name,
          depth: c.parent_account_id ? 1 : 0 
        });
        addedIds.add(c.id);
      }
    });

    return ordered;
  }, [allCategories]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getChecks({
        bank_account_id: bankFilter ? parseInt(bankFilter) : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: searchTerm || undefined
      });
      setChecks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch check register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecks();
  }, [bankFilter, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchChecks();
  };

  const handleVoid = async (check: CheckRecord) => {
    if (!window.confirm(`Are you sure you want to void Check #${check.check_number} to ${check.payee}?`)) {
      return;
    }
    try {
      const updated = await api.voidCheck(check.id);
      setChecks(checks.map(c => c.id === check.id ? updated : c));
    } catch (err: any) {
      alert(err.message || 'Failed to void check');
    }
  };

  const activeChecks = checks.filter(c => !c.is_void);
  const totalDisbursed = activeChecks.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>Check Register</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {checks.length} Checks
                </span>
              </h1>
              <p className="text-xs text-slate-400">Manage written checks, import bank statements, and track account disbursements</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchChecks}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refresh Register"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 font-semibold text-xs rounded-xl shadow transition cursor-pointer"
            title="Manage recurring bank import classification rules"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Automated Rules</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-semibold text-xs rounded-xl shadow transition cursor-pointer"
            title="Import transactions from CSV or PDF bank statement"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import Statement (CSV / PDF)</span>
          </button>

          <button
            onClick={onOpenWriteCheckModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Write Check</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Checks Written</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">{checks.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Disbursed ($)</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">${totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Checks</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{activeChecks.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Voided Checks</span>
          <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">{checks.filter(c => c.is_void).length}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1">
          {/* Bank Selector */}
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="">All Bank Accounts (Consolidated)</option>
            {bankAccounts.map(({ account, isSub, parentName }) => (
              <option key={account.id} value={account.id}>
                {isSub 
                  ? `\u00A0\u00A0\u00A0\u00A0└─ [${account.account_number || ''}] ${account.name} (Sub-acct of ${parentName || 'Parent'})`
                  : `[${account.account_number || ''}] ${account.name}${account.sub_accounts_count ? ' (Parent Account)' : ''}`}
              </option>
            ))}
          </select>

          {/* Payee / Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Payee, Check #, or Memo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* From Date */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Filter
          </button>

          {(bankFilter || fromDate || toDate || searchTerm) && (
            <button
              type="button"
              onClick={() => { setBankFilter(''); setFromDate(''); setToDate(''); setSearchTerm(''); }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Checks Table */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-400" />
          <p className="text-sm font-semibold">Loading Check Register...</p>
        </div>
      ) : checks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-base font-bold text-slate-200">No Checks Recorded</p>
          <p className="text-xs text-slate-400 mt-1">Write your first check disbursement using the button above.</p>
          <button
            onClick={onOpenWriteCheckModal}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
          >
            + Write Check
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800/90 text-slate-300 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-3.5">TYPE</th>
                  <th className="p-3.5">CHECK / REF #</th>
                  <th className="p-3.5">DATE</th>
                  <th className="p-3.5">PAY TO THE ORDER OF (PAYEE)</th>
                  <th className="p-3.5">BANK ACCOUNT</th>
                  <th className="p-3.5 w-32 text-right">AMOUNT ($)</th>
                  <th className="p-3.5">MEMO / PURPOSE</th>
                  <th className="p-3.5 text-center">SOURCE</th>
                  <th className="p-3.5 text-center">STATUS</th>
                  <th className="p-3.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {checks.map((c) => {
                  const txnType = c.transaction_type || 'CHECK';
                  const isImported = c.source === 'BANK_IMPORT';

                  return (
                    <tr key={c.id} className={`hover:bg-slate-800/40 transition ${c.is_void ? 'opacity-50 line-through' : ''}`}>
                      {/* Transaction Type */}
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          txnType === 'CHECK'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : txnType === 'ACH'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : txnType === 'DEBIT'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                : 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                        }`}>
                          {txnType}
                        </span>
                      </td>

                      {/* Check # */}
                      <td className="p-3.5 font-mono font-bold text-emerald-400">
                        #{c.check_number}
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">
                        {c.date}
                      </td>

                      {/* Payee */}
                      <td className="p-3.5 font-bold text-white">
                        {c.payee}
                      </td>

                      {/* Bank Account */}
                      <td className="p-3.5 text-slate-300">
                        {c.bank_account_display || c.bank_account_name}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-300">
                        ${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Memo */}
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">
                        {c.memo || '—'}
                      </td>

                      {/* Source */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isImported
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {isImported ? 'Bank Import' : 'Manual'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        {c.is_void ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            VOID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onPrintCheck(c)}
                            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 transition cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Voucher</span>
                          </button>

                          {!c.is_void && (
                            <button
                              onClick={() => handleVoid(c)}
                              className="flex items-center space-x-1 px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 rounded border border-rose-800/40 transition cursor-pointer"
                              title="Void Check"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Void</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bank Statement Import Wizard Modal */}
      <BankImportWizardModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          fetchChecks();
        }}
        categories={allCategories}
        properties={properties}
        classes={classes}
        initialBankAccountId={bankFilter ? parseInt(bankFilter) : undefined}
      />

      {/* Automated Bank Rules Manager Modal */}
      <BankRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        categories={allCategories}
        properties={properties}
        classes={classes}
      />

    </div>
  );
};
