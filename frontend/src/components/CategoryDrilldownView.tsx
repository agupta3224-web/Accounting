import React, { useState, useEffect } from 'react';
import { 
  Search, Download, RefreshCw, X, Layers, Calendar, Building, Shield, Tag, FileText, ArrowUpDown
} from 'lucide-react';
import { CategoryDrilldownData } from '../types';
import { api } from '../services/api';

interface CategoryDrilldownViewProps {
  categoryId?: number | null;
  accountName?: string;
  fromDate?: string;
  toDate?: string;
  propertyId?: number;
  classId?: number;
  companyId?: number;
  title?: string;
  onClose?: () => void;
}

export const CategoryDrilldownView: React.FC<CategoryDrilldownViewProps> = ({
  categoryId,
  accountName,
  fromDate,
  toDate,
  propertyId,
  classId,
  companyId,
  title,
  onClose
}) => {
  const [data, setData] = useState<CategoryDrilldownData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const fetchDrilldown = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCategoryDrilldown({
        category_id: categoryId,
        account_name: accountName,
        from_date: fromDate,
        to_date: toDate,
        property_id: propertyId,
        class_id: classId,
        company_id: companyId
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load category ledger transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrilldown();
  }, [categoryId, accountName, fromDate, toDate, propertyId, classId, companyId]);

  const filteredTransactions = React.useMemo(() => {
    if (!data || !data.transactions) return [];
    let list = [...data.transactions];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.payee && t.payee.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.reference_number && t.reference_number.toLowerCase().includes(q)) ||
        (t.property_name && t.property_name.toLowerCase().includes(q)) ||
        (t.class_name && t.class_name.toLowerCase().includes(q)) ||
        (t.date && t.date.includes(q)) ||
        t.amount.toString().includes(q)
      );
    }
    list.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [data, searchQuery, sortAsc]);

  const exportUrl = api.getCategoryDrilldownExportUrl({
    category_id: categoryId,
    account_name: accountName,
    from_date: fromDate,
    to_date: toDate,
    property_id: propertyId,
    class_id: classId,
    company_id: companyId
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-xl overflow-hidden">
      {/* Top Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              {data?.category.display_name || title || accountName || 'Category Ledger'}
            </h2>
            {data?.category.account_number && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                Acc #{data.category.account_number}
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase">
              {data?.category.type || 'Account'}
            </span>
          </div>
          
          <div className="flex items-center space-x-3 text-xs text-slate-400 pl-8">
            <span className="flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{data?.period_info.date_label || `${fromDate || 'Start'} to ${toDate || 'End'}`}</span>
            </span>
            <span>&bull;</span>
            <span className="font-semibold text-slate-300">
              {filteredTransactions.length} of {data?.transaction_count || 0} transaction(s)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <a
            href={exportUrl}
            download
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
            title="Download CSV of this Category's Ledger"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={fetchDrilldown}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition cursor-pointer"
              title="Close View"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter & Summary Bar */}
      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search payee, check #, memo, property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 text-xs font-medium"
          />
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortAsc ? 'Date: Oldest First' : 'Date: Newest First'}</span>
          </button>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-800">
            <span className="text-slate-400 uppercase tracking-wider text-[11px] font-semibold">Total Balance:</span>
            <span className="font-mono text-base font-black text-emerald-400">
              ${(data?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Loading itemized category ledger...</p>
          </div>
        ) : error ? (
          <div className="m-4 p-4 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
            <Layers className="w-10 h-10 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No Transactions Found</p>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              No transactions match this category and date filter.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reference / Source</th>
                <th className="py-2.5 px-3">Payee</th>
                <th className="py-2.5 px-3">Description / Memo</th>
                <th className="py-2.5 px-3">Property</th>
                <th className="py-2.5 px-3">Class / LLC</th>
                <th className="py-2.5 px-3 text-right">Amount ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTransactions.map((txn) => {
                const isIncome = txn.category_type === 'INCOME' || txn.category_type === 'REVENUE';
                return (
                  <tr key={txn.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                      {txn.date}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-sans">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        txn.reference_number?.startsWith('Check') 
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                          : txn.reference_number?.startsWith('JE')
                          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {txn.reference_number || txn.source || 'Ref'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-200 font-sans font-medium">
                      {txn.payee || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-sans max-w-xs truncate" title={txn.description || ''}>
                      {txn.description || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-sans">
                      {txn.property_name || 'Portfolio'}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-sans">
                      {txn.class_name || 'General'}
                    </td>
                    <td className={`py-2 px-3 text-right font-bold font-mono ${
                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isIncome ? '+' : '-'}${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-800 text-xs">
              <tr>
                <td colSpan={6} className="py-2.5 px-3 text-right text-slate-400 uppercase tracking-wider font-sans">
                  Ledger Total:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-400 text-sm">
                  ${(data?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
