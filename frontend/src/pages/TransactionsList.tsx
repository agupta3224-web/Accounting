import React, { useState, useEffect } from 'react';
import { 
  ListFilter, Search, Trash2, Download, PlusCircle, Building, 
  Layers, Calendar, Tag, Layers2, Eye, RefreshCw, AlertCircle
} from 'lucide-react';
import { Property, ClassEntity, Transaction } from '../types';
import { api } from '../services/api';
import { AggregatedDetailsModal } from '../components/AggregatedDetailsModal';

interface TransactionsListProps {
  properties: Property[];
  classes: ClassEntity[];
  onOpenManualModal: () => void;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({
  properties,
  classes,
  onOpenManualModal
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [auditTransaction, setAuditTransaction] = useState<Transaction | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTransactions({
        property_id: selectedPropertyId ? Number(selectedPropertyId) : undefined,
        class_id: selectedClassId ? Number(selectedClassId) : undefined,
        month: selectedMonth || undefined,
        category_type: selectedCategoryType || undefined,
        search: searchQuery || undefined
      });
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedPropertyId, selectedClassId, selectedMonth, selectedCategoryType, searchQuery]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      fetchTransactions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    }
  };
  const exportCsv = () => {
    let csv = 'ID,Date,Month,Property,Class,Category Type,Account / Line Item,Amount,Description,Payee,Source,Is Aggregated\n';
    transactions.forEach(t => {
      csv += `${t.id},"${t.date}","${t.month}","${t.property_name}","${t.class_name || 'General'}","${t.category_type}","${t.account_name}",${t.amount},"${t.description || ''}","${t.payee || ''}","${t.source}",${t.is_aggregated}\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI('data:text/csv;charset=utf-8,' + csv);
    link.download = `Transactions_${selectedMonth || 'All'}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Transaction Registry</span>
            <span className="text-xs bg-slate-100 text-slate-800 font-semibold px-2.5 py-1 rounded-full font-mono">
              {transactions.length} Records
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive financial transactions grouped by Property, Class, and Month with manual entry & audit tracking.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportCsv}
            disabled={transactions.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenManualModal}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, payee, account..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Property */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Building className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value ? Number(e.target.value) : '')}
              className="bg-transparent text-xs font-medium text-slate-700 w-full outline-hidden"
            >
              <option value="">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
              className="bg-transparent text-xs font-medium text-slate-700 w-full outline-hidden"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 w-full outline-hidden"
            />
          </div>

          {/* Category Type */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategoryType}
              onChange={e => setSelectedCategoryType(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 w-full outline-hidden"
            >
              <option value="">All Category Groups</option>
              <option value="INCOME">Income</option>
              <option value="OPERATING_EXPENSE">Operating Expense</option>
              <option value="NON_OPERATING_EXPENSE">Non-Operating (Debt)</option>
              <option value="CAPEX">CapEx</option>
            </select>
          </div>
        </div>
      </div>
      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            <span>Loading transactions...</span>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 text-xs">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Property & Class</th>
                  <th className="py-3 px-3">Account / Category</th>
                  <th className="py-3 px-3">Description & Payee</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3 text-right">Amount ($)</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(t => {
                  const isIncome = t.category_type === 'INCOME';
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{t.property_name}</div>
                        <div className="text-[10px] text-slate-400">{t.class_name || 'General'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span>{t.account_name}</span>
                          {t.is_aggregated && (
                            <button
                              onClick={() => setAuditTransaction(t)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold transition cursor-pointer"
                              title="Click to view all units aggregated into this row"
                            >
                              <Layers2 className="w-3 h-3" />
                              <span>Consolidated ({t.raw_aggregated_items?.length || 'Multi'})</span>
                              <Eye className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                          )}
                        </div>
                        <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                          isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {t.category_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        <div>{t.description || '?'}</div>
                        {t.payee && <div className="text-[10px] text-slate-400">Payee: {t.payee}</div>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.source === 'IMPORTED' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {t.source}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        isIncome ? 'text-emerald-700' : 'text-slate-900'
                      }`}>
                        {isIncome ? '+' : '-'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AggregatedDetailsModal
        transaction={auditTransaction}
        onClose={() => setAuditTransaction(null)}
      />
    </div>
  );
};
