import React, { useState } from 'react';
import { X, Plus, DollarSign, Calendar, Tag, Layers, Building, Shield, Home } from 'lucide-react';
import { Property, ClassEntity, Company, Category } from '../types';
import { api } from '../services/api';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  properties: Property[];
  classes: ClassEntity[];
  categories: Category[];
  onTransactionCreated: () => void;
}

export const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  companies,
  properties,
  classes,
  categories,
  onTransactionCreated
}) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [accountName, setAccountName] = useState<string>('');
  const [categoryType, setCategoryType] = useState<string>('OPERATING_EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [payee, setPayee] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Available classes for selected company
  const availableClasses = React.useMemo(() => {
    if (!selectedCompanyId) return classes;
    return classes.filter(c => c.company_id === Number(selectedCompanyId));
  }, [classes, selectedCompanyId]);

  // Available properties for selected class or company
  const availableProperties = React.useMemo(() => {
    if (selectedClassId) {
      return properties.filter(p => p.class_id === Number(selectedClassId));
    }
    if (selectedCompanyId) {
      const validClassIds = new Set(availableClasses.map(c => c.id));
      return properties.filter(p => p.class_id && validClassIds.has(p.class_id));
    }
    return properties;
  }, [properties, selectedClassId, selectedCompanyId, availableClasses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !accountName || !amount || !date) {
      setError('Please fill in Date, Property, Account Name, and Amount.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.createTransaction({
        date,
        property_id: Number(propertyId),
        class_id: selectedClassId ? Number(selectedClassId) : undefined,
        account_name: accountName,
        category_type: categoryType,
        amount: parseFloat(amount),
        description,
        payee,
        source: 'MANUAL'
      });

      onTransactionCreated();
      onClose();
      // Reset form
      setAmount('');
      setDescription('');
      setPayee('');
      setAccountName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = (name: string, type: string, defaultPayee: string) => {
    setAccountName(name);
    setCategoryType(type);
    if (!payee) setPayee(defaultPayee);
  };

  const selectedPropObj = properties.find(p => p.id === Number(propertyId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><Plus className="w-4 h-4" /></span>
              <span>Record Manual Transaction</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add off-statement items like Mortgage P&I, Direct Taxes, or CapEx
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Fill Off-Statement Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('Mortgage Principal & Interest', 'NON_OPERATING_EXPENSE', 'Lender Bank')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
              >
                ?? Mortgage P&I
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Property Taxes', 'OPERATING_EXPENSE', 'County Assessor')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
              >
                ?? Property Taxes
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Landlord Property Insurance', 'OPERATING_EXPENSE', 'Insurance Carrier')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
              >
                ?? Insurance
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Capital Improvements (CapEx)', 'CAPEX', 'General Contractor')}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
              >
                ?? CapEx / Major Reno
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Filter</label>
              <select
                value={selectedCompanyId}
                onChange={e => {
                  setSelectedCompanyId(e.target.value ? Number(e.target.value) : '');
                  setSelectedClassId('');
                  setPropertyId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class / LLC</label>
              <select
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value ? Number(e.target.value) : '');
                  setPropertyId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="">All Classes / LLCs</option>
                {availableClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Class / Property *</label>
              <select
                value={propertyId}
                onChange={e => {
                  const pId = Number(e.target.value);
                  setPropertyId(pId);
                  const pObj = properties.find(p => p.id === pId);
                  if (pObj && pObj.class_id) setSelectedClassId(pObj.class_id);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium text-emerald-950"
                required
              >
                <option value="">-- Choose Sub-Class Property --</option>
                {availableProperties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.class_name || 'LLC'})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedPropObj?.address && (
            <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5">
              <Home className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{selectedPropObj.name}: {selectedPropObj.address}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account / Category Name *</label>
              <input
                type="text"
                list="coa-accounts-list"
                placeholder="e.g. [60100] Repairs & Maintenance"
                value={accountName}
                onChange={e => {
                  const val = e.target.value;
                  setAccountName(val);
                  const matched = categories.find(c => 
                    (c.account_number && `[${c.account_number}] ${c.name}` === val) || 
                    c.name.toLowerCase() === val.toLowerCase()
                  );
                  if (matched) {
                    setCategoryType(matched.type || 'OPERATING_EXPENSE');
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
                required
              />
              <datalist id="coa-accounts-list">
                {categories.map(c => (
                  <option key={c.id} value={c.account_number ? `[${c.account_number}] ${c.name}` : c.name}>
                    {c.type} - {c.sub_type || ''}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category Type *</label>
              <select
                value={categoryType}
                onChange={e => setCategoryType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
              >
                <option value="OPERATING_EXPENSE">Operating Expense (6xxxx-8xxxx)</option>
                <option value="INCOME">Income / Revenue (4xxxx)</option>
                <option value="COGS">Cost of Goods Sold (5xxxx)</option>
                <option value="NON_OPERATING_EXPENSE">Non-Operating (Debt Service 9xxxx)</option>
                <option value="CAPEX">CapEx (Capital Improvements 9xxxx)</option>
                <option value="ASSET">Asset (1xxxx)</option>
                <option value="LIABILITY">Liability / Payable (2xxxx)</option>
                <option value="EQUITY">Equity (3xxxx)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($) *</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payee / Vendor</label>
              <input
                type="text"
                placeholder="e.g. Chase Bank, Handyman"
                value={payee}
                onChange={e => setPayee(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Memo</label>
            <input
              type="text"
              placeholder="e.g. Monthly loan payment principal and interest"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Record Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
