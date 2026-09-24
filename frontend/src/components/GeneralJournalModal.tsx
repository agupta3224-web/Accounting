import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Calendar,
  Layers,
  Scale
} from 'lucide-react';
import { api } from '../services/api';
import { Category, Property, ClassEntity, JournalEntry, JournalEntryCreatePayload } from '../types';

interface GeneralJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (entry: JournalEntry) => void;
  categories: Category[];
  properties: Property[];
  classes: ClassEntity[];
}

interface JournalLineRow {
  category_id: number;
  debit: string;
  credit: string;
  notes: string;
  class_id: string;
  property_id: string;
}

export const GeneralJournalModal: React.FC<GeneralJournalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  properties,
  classes
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryNumber, setEntryNumber] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [lines, setLines] = useState<JournalLineRow[]>([
    { category_id: 0, debit: '', credit: '', notes: '', class_id: '', property_id: '' },
    { category_id: 0, debit: '', credit: '', notes: '', class_id: '', property_id: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchNextNumber();
      const defaultExp = categories.find(c => c.account_number === '60500') || categories.find(c => c.type === 'OPERATING_EXPENSE') || categories[0];
      const defaultBank = categories.find(c => c.account_number === '10010') || categories.find(c => c.type === 'ASSET') || categories[1];
      const defaultProp = properties[0];

      setLines([
        { 
          category_id: defaultExp?.id || 0, 
          debit: '', 
          credit: '', 
          notes: 'Telephone / Utility expense', 
          class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '', 
          property_id: defaultProp ? defaultProp.id.toString() : '' 
        },
        { 
          category_id: defaultBank?.id || 0, 
          debit: '', 
          credit: '', 
          notes: 'Payment from Checking', 
          class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '', 
          property_id: defaultProp ? defaultProp.id.toString() : '' 
        }
      ]);
      setMemo('');
      setError(null);
    }
  }, [isOpen, categories, properties]);

  const fetchNextNumber = async () => {
    try {
      const res = await api.getNextJournalNumber();
      setEntryNumber(res.next_number);
    } catch {
      setEntryNumber('JE-1001');
    }
  };

  const handleAddLine = () => {
    const defaultCat = categories[0];
    const defaultProp = properties[0];
    
    // Suggest balancing debit/credit if possible
    const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const diff = totalDebits - totalCredits;

    setLines([
      ...lines,
      {
        category_id: defaultCat?.id || 0,
        debit: diff < 0 ? Math.abs(diff).toFixed(2) : '',
        credit: diff > 0 ? diff.toFixed(2) : '',
        notes: '',
        class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '',
        property_id: defaultProp ? defaultProp.id.toString() : ''
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, idx) => idx !== index));
    }
  };

  const handleLineChange = (index: number, field: keyof JournalLineRow, value: any) => {
    const updated = [...lines];
    
    // Mutual exclusivity: if entering Debit, clear Credit, and vice versa
    if (field === 'debit' && value) {
      updated[index].debit = value;
      updated[index].credit = '';
    } else if (field === 'credit' && value) {
      updated[index].credit = value;
      updated[index].debit = '';
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    // Auto-fill class if property changed
    if (field === 'property_id' && value) {
      const prop = properties.find(p => p.id.toString() === value.toString());
      if (prop && prop.class_id) {
        updated[index].class_id = prop.class_id.toString();
      }
    }

    setLines(updated);
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebits - totalCredits);
  const isBalanced = totalDebits > 0 && totalCredits > 0 && diff < 0.005;

  const handleSubmit = async (saveAndNew = false) => {
    setError(null);
    if (!date) {
      setError('Date is required.');
      return;
    }
    if (lines.length < 2) {
      setError('At least 2 lines are required for a General Journal Entry.');
      return;
    }
    if (!isBalanced) {
      setError(`Journal entry is out of balance. Total Debits ($${totalDebits.toFixed(2)}) must equal Total Credits ($${totalCredits.toFixed(2)}). Difference: $${diff.toFixed(2)}.`);
      return;
    }

    try {
      setLoading(true);
      const payload: JournalEntryCreatePayload = {
        date,
        entry_number: entryNumber,
        memo,
        lines: lines.map(l => ({
          category_id: l.category_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          memo: l.notes,
          class_id: l.class_id ? parseInt(l.class_id) : null,
          property_id: l.property_id ? parseInt(l.property_id) : null
        }))
      };

      const entry = await api.createJournalEntry(payload);
      onSuccess(entry);

      if (saveAndNew) {
        fetchNextNumber();
        setMemo('');
        const defaultExp = categories.find(c => c.type === 'OPERATING_EXPENSE') || categories[0];
        const defaultBank = categories.find(c => c.type === 'ASSET') || categories[1];
        const defaultProp = properties[0];
        setLines([
          { category_id: defaultExp?.id || 0, debit: '', credit: '', notes: '', class_id: defaultProp?.class_id?.toString() || '', property_id: defaultProp?.id?.toString() || '' },
          { category_id: defaultBank?.id || 0, debit: '', credit: '', notes: '', class_id: defaultProp?.class_id?.toString() || '', property_id: defaultProp?.id?.toString() || '' }
        ]);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create journal entry');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Make General Journal Entries</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Double-Entry System
                </span>
              </h2>
              <p className="text-xs text-slate-400">Record adjusting, reclassification, and multi-entity journal entries</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/50">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Journal Entry Header: Date, Entry #, Memo */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Entry Number</label>
              <input
                type="text"
                value={entryNumber}
                onChange={(e) => setEntryNumber(e.target.value)}
                placeholder="e.g. JE-1001"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Memo / Overall Notes</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Reclassify monthly telephone expense to 2908 Depot LLC"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* JOURNAL ENTRY TABLE GRID (EXACT COLUMNS AS SPECIFIED) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden shadow-inner">
            <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Journal Lines</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {lines.length} lines
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center space-x-1 px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                  <tr>
                    <th className="p-3">ACCOUNT</th>
                    <th className="p-3 w-32 text-right">DEBIT AMOUNT ($)</th>
                    <th className="p-3 w-32 text-right">CREDIT AMOUNT ($)</th>
                    <th className="p-3">NOTES / MEMO</th>
                    <th className="p-3">CLASS (LLC)</th>
                    <th className="p-3">PROPERTY (SUB-CLASS)</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {lines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      {/* Account */}
                      <td className="p-2">
                        <select
                          value={row.category_id}
                          onChange={(e) => handleLineChange(idx, 'category_id', parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.account_number ? `[${c.account_number}] ` : ''}{c.name} ({c.type})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Debit */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.debit}
                          onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono text-right focus:outline-none focus:border-cyan-500"
                        />
                      </td>

                      {/* Credit */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.credit}
                          onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono text-right focus:outline-none focus:border-cyan-500"
                        />
                      </td>

                      {/* Notes */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleLineChange(idx, 'notes', e.target.value)}
                          placeholder="Line notes"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </td>

                      {/* Class */}
                      <td className="p-2">
                        <select
                          value={row.class_id}
                          onChange={(e) => handleLineChange(idx, 'class_id', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">(No LLC Class)</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Property */}
                      <td className="p-2">
                        <select
                          value={row.property_id}
                          onChange={(e) => handleLineChange(idx, 'property_id', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">(Portfolio General)</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Remove Button */}
                      <td className="p-2 text-center">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LIVE DOUBLE-ENTRY BALANCING STATUS FOOTER */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-700 flex flex-wrap items-center justify-between text-xs gap-4">
              <div className="flex items-center space-x-6">
                <div>
                  <span className="text-slate-400 mr-2">Total Debits:</span>
                  <strong className="text-cyan-400 font-mono text-sm">${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span className="text-slate-400 mr-2">Total Credits:</span>
                  <strong className="text-cyan-400 font-mono text-sm">${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div>
                {isBalanced ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>In Balance (${totalDebits.toFixed(2)})</span>
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Out of Balance by ${diff.toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={loading || !isBalanced}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-600/50 rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              Save & New
            </button>

            <button
              type="button"
              disabled={loading || !isBalanced}
              onClick={() => handleSubmit(false)}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-950/50 transition cursor-pointer disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save & Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
