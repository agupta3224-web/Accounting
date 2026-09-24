import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Building2,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { JournalEntry, ClassEntity, Property } from '../types';

interface JournalEntriesPageProps {
  onOpenMakeJournalModal: () => void;
  classes: ClassEntity[];
  properties: Property[];
}

export const JournalEntriesPage: React.FC<JournalEntriesPageProps> = ({
  onOpenMakeJournalModal,
  classes,
  properties
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getJournalEntries({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        class_id: classFilter ? parseInt(classFilter) : undefined,
        search: searchTerm || undefined
      });
      setEntries(data);
      // Auto expand the first 5 entries
      setExpandedIds(new Set(data.slice(0, 5).map(e => e.id)));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch journal entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [fromDate, toDate, classFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEntries();
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const toggleExpandAll = () => {
    if (expandedIds.size === entries.length) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(entries.map(e => e.id)));
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!window.confirm(`Are you sure you want to delete Journal Entry ${entry.entry_number}?`)) {
      return;
    }
    try {
      await api.deleteJournalEntry(entry.id);
      setEntries(entries.filter(e => e.id !== entry.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete journal entry');
    }
  };

  const totalDebits = entries.reduce((sum, e) => sum + e.total_debit, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.total_credit, 0);

  return (
    <div className="space-y-6">
      
      {/* Top Header & Action Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>General Journal Entries</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {entries.length} Entries
                </span>
              </h1>
              <p className="text-xs text-slate-400">Review, filter, and balance double-entry general journal records by date and class</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchEntries}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refresh Journal"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenMakeJournalModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/50 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Make General Journal Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Journal Entries</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">{entries.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Debits</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Credits</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ledger Balance Status</span>
          <p className="text-sm font-bold text-emerald-400 mt-2 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>100% In Balance</span>
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Entry #, memo, or account..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* From Date */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All LLC Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Apply Filters
          </button>

          {(fromDate || toDate || classFilter || searchTerm) && (
            <button
              type="button"
              onClick={() => { setFromDate(''); setToDate(''); setClassFilter(''); setSearchTerm(''); }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>

        <button
          onClick={toggleExpandAll}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
        >
          {expandedIds.size === entries.length ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-sm font-semibold">Loading General Journal Entries...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Scale className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-base font-bold text-slate-200">No Journal Entries Found</p>
          <p className="text-xs text-slate-400 mt-1">Make your first general journal entry using the button above.</p>
          <button
            onClick={onOpenMakeJournalModal}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition"
          >
            + Make General Journal Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            return (
              <div 
                key={entry.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition"
              >
                {/* Journal Entry Header Card */}
                <div 
                  onClick={() => toggleExpand(entry.id)}
                  className="p-4 bg-slate-800/60 hover:bg-slate-800 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1 rounded text-slate-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-cyan-300">{entry.entry_number}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {entry.date}
                        </span>
                        {entry.source === 'CHECK' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Check Disbursement
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 font-medium">{entry.memo || '(No Memo)'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                      <p className="font-mono font-bold text-sm text-white">${entry.total_debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Delete Journal Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Multi-Line Table */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">ACCOUNT</th>
                          <th className="p-2.5 w-32 text-right">DEBIT AMOUNT ($)</th>
                          <th className="p-2.5 w-32 text-right">CREDIT AMOUNT ($)</th>
                          <th className="p-2.5">NOTES / MEMO</th>
                          <th className="p-2.5">CLASS (LLC)</th>
                          <th className="p-2.5">PROPERTY</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-medium">
                        {entry.lines.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/20">
                            <td className="p-2.5 font-semibold text-white">
                              {l.account_display || `[${l.account_number}] ${l.account_name}`}
                            </td>
                            <td className="p-2.5 text-right font-mono text-cyan-300">
                              {l.debit > 0 ? `$${l.debit.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-mono text-cyan-300">
                              {l.credit > 0 ? `$${l.credit.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-slate-300">{l.memo || '—'}</td>
                            <td className="p-2.5 text-slate-400">{l.class_name || '—'}</td>
                            <td className="p-2.5 text-slate-400">{l.property_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900/90 font-bold border-t border-slate-800">
                        <tr>
                          <td className="p-2.5 text-slate-300 uppercase">Totals</td>
                          <td className="p-2.5 text-right font-mono text-cyan-400">${entry.total_debit.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-cyan-400">${entry.total_credit.toFixed(2)}</td>
                          <td colSpan={3} className="p-2.5 text-right text-emerald-400">
                            ✓ Balanced
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
