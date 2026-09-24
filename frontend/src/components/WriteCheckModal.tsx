import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckSquare, 
  Printer, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Sparkles, 
  DollarSign, 
  Building2, 
  Calendar,
  Landmark
} from 'lucide-react';
import { api } from '../services/api';
import { Category, Property, ClassEntity, CheckCreatePayload, CheckRecord, Vendor } from '../types';

interface WriteCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (check: CheckRecord) => void;
  onPrintCheck?: (check: CheckRecord) => void;
  categories: Category[];
  properties: Property[];
  classes: ClassEntity[];
  initialVendor?: Vendor | null;
}

interface SplitRow {
  category_id: number;
  amount: string;
  memo: string;
  class_id: string;
  property_id: string;
}

export const WriteCheckModal: React.FC<WriteCheckModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onPrintCheck,
  categories,
  properties,
  classes,
  initialVendor
}) => {
  const [bankAccountId, setBankAccountId] = useState<number>(0);
  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [amountWords, setAmountWords] = useState<string>('Zero and 00/100 Dollars');
  const [address, setAddress] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [splits, setSplits] = useState<SplitRow[]>([
    { category_id: 0, amount: '', memo: '', class_id: '', property_id: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');

  const fetchVendorsList = async () => {
    try {
      const data = await api.getVendors({ active_only: true });
      setVendors(data);
    } catch (e) {
      console.error('Failed to load vendors for check', e);
    }
  };

  // Auto-refresh categories when modal opens or COA is modified
  const [allCategories, setAllCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setAllCategories(categories);
  }, [categories]);

  const refreshCategories = async () => {
    try {
      const cats = await api.getCategories();
      setAllCategories(cats);
    } catch (e) {
      console.error('Failed to load categories for check modal', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshCategories();
    }
    const handleCoaUpdate = () => refreshCategories();
    window.addEventListener('coa-updated', handleCoaUpdate);
    return () => window.removeEventListener('coa-updated', handleCoaUpdate);
  }, [isOpen]);

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

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      const defaultBank = bankAccounts.find(c => c.account.account_number === '10100' || c.account.account_number === '10010') || bankAccounts[0];
      if (defaultBank) {
        setBankAccountId(defaultBank.account.id);
        fetchBankBalance(defaultBank.account.id);
        fetchNextCheckNumber(defaultBank.account.id);
      }
      const defaultExp = allCategories.find(c => c.account_number === '60100') || allCategories.find(c => c.type === 'OPERATING_EXPENSE');
      const defaultProp = properties[0];
      setSplits([
        { 
          category_id: defaultExp ? defaultExp.id : (categories[0]?.id || 0), 
          amount: '', 
          memo: '', 
          class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '', 
          property_id: defaultProp ? defaultProp.id.toString() : '' 
        }
      ]);
      setAmount('');
      setAmountWords('Zero and 00/100 Dollars');
      setPayee('');
      setAddress('');
      setMemo('');
      setError(null);
      fetchVendorsList();
      if (initialVendor) {
        setSelectedVendorId(initialVendor.id);
        setPayee(initialVendor.name);
        setAddress(initialVendor.address || '');
        if (initialVendor.default_category_id) {
          const defaultProp = properties[0];
          setSplits([
            {
              category_id: initialVendor.default_category_id,
              amount: '',
              memo: '',
              class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '',
              property_id: defaultProp ? defaultProp.id.toString() : ''
            }
          ]);
        }
      } else {
        setSelectedVendorId('');
      }
    }
  }, [isOpen, categories, properties, initialVendor]);

  const fetchBankBalance = async (bankId: number) => {
    try {
      const res = await api.getBankBalance(bankId);
      setBankBalance(res.balance);
    } catch {
      setBankBalance(null);
    }
  };

  const fetchNextCheckNumber = async (bankId: number) => {
    try {
      const res = await api.getNextCheckNumber(bankId);
      setCheckNumber(res.next_check_number);
    } catch {
      setCheckNumber('1001');
    }
  };


  const handleVendorSelect = (vId: number | '') => {
    setSelectedVendorId(vId);
    if (vId) {
      const v = vendors.find(item => item.id === vId);
      if (v) {
        setPayee(v.name);
        setAddress(v.address || '');
        if (v.default_category_id) {
          const updated = [...splits];
          if (updated.length > 0) {
            updated[0].category_id = v.default_category_id;
            setSplits(updated);
          }
        }
      }
    }
  };

  const handleBankChange = (bankId: number) => {
    setBankAccountId(bankId);
    fetchBankBalance(bankId);
    fetchNextCheckNumber(bankId);
  };

  // Convert amount to words on amount change
  const handleAmountChange = async (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    if (num > 0) {
      try {
        const res = await api.getWordsPreview(num);
        setAmountWords(res.amount_in_words);
      } catch {
        setAmountWords(`${num.toFixed(2)} Dollars`);
      }
    } else {
      setAmountWords('Zero and 00/100 Dollars');
    }

    // Auto update first split line if only 1 split exists
    if (splits.length === 1) {
      setSplits([{ ...splits[0], amount: val }]);
    }
  };

  const handleAddSplitRow = () => {
    const defaultExp = categories.find(c => c.account_number === '60100') || categories.find(c => c.type === 'OPERATING_EXPENSE');
    const defaultProp = properties[0];
    
    // Calculate remaining unallocated amount
    const totalCheck = parseFloat(amount) || 0;
    const currentAlloc = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const remaining = Math.max(0, totalCheck - currentAlloc);
    
    setSplits([
      ...splits,
      {
        category_id: defaultExp ? defaultExp.id : (categories[0]?.id || 0),
        amount: remaining > 0 ? remaining.toFixed(2) : '',
        memo: memo || '',
        class_id: defaultProp?.class_id ? defaultProp.class_id.toString() : '',
        property_id: defaultProp ? defaultProp.id.toString() : ''
      }
    ]);
  };

  const handleRemoveSplitRow = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, idx) => idx !== index));
    }
  };

  const handleSplitChange = (index: number, field: keyof SplitRow, value: any) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    
    // If property changed, auto-fill class
    if (field === 'property_id' && value) {
      const prop = properties.find(p => p.id.toString() === value.toString());
      if (prop && prop.class_id) {
        updated[index].class_id = prop.class_id.toString();
      }
    }
    setSplits(updated);
  };

  const totalSplits = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const totalCheckAmount = parseFloat(amount) || 0;
  const isSplitBalanced = Math.abs(totalSplits - totalCheckAmount) < 0.01;

  const handleSubmit = async (saveAndNew = false, printAfter = false) => {
    setError(null);
    if (!bankAccountId) {
      setError('Please select a Bank Account.');
      return;
    }
    if (!payee.trim()) {
      setError('Please enter Pay to the Order of (Payee).');
      return;
    }
    if (totalCheckAmount <= 0) {
      setError('Check amount must be greater than zero.');
      return;
    }
    if (!isSplitBalanced) {
      setError(`Expense splits ($${totalSplits.toFixed(2)}) do not match the total check amount ($${totalCheckAmount.toFixed(2)}).`);
      return;
    }

    try {
      setLoading(true);
      const payload: CheckCreatePayload = {
        bank_account_id: bankAccountId,
        check_number: checkNumber,
        date,
        payee,
        amount: totalCheckAmount,
        address,
        memo,
        splits: splits.map(s => ({
          category_id: s.category_id,
          amount: parseFloat(s.amount) || 0,
          memo: s.memo,
          class_id: s.class_id ? parseInt(s.class_id) : null,
          property_id: s.property_id ? parseInt(s.property_id) : null
        }))
      };

      const check = await api.createCheck(payload);
      onSuccess(check);

      if (printAfter && onPrintCheck) {
        onPrintCheck(check);
      }

      if (saveAndNew) {
        fetchNextCheckNumber(bankAccountId);
        fetchBankBalance(bankAccountId);
        setPayee('');
        setAmount('');
        setAmountWords('Zero and 00/100 Dollars');
        setAddress('');
        setMemo('');
        const defaultExp = categories.find(c => c.account_number === '60100') || categories[0];
        setSplits([{ category_id: defaultExp?.id || 0, amount: '', memo: '', class_id: '', property_id: '' }]);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create check');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Write Checks</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  QuickBooks Desktop Format
                </span>
              </h2>
              <p className="text-xs text-slate-400">Issue disbursements, print check vouchers, and split property expenses</p>
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

          {/* Top Controls: Bank Account & Ending Balance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bank Account</span>
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => handleBankChange(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {bankAccounts.map(({ account, isSub, parentName }) => (
                  <option key={account.id} value={account.id}>
                    {isSub 
                      ? `\u00A0\u00A0\u00A0\u00A0└─ [${account.account_number || ''}] ${account.name} (Sub-acct of ${parentName || 'Parent'})`
                      : `[${account.account_number || ''}] ${account.name}${account.sub_accounts_count ? ' (Parent Account)' : ''}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ending Balance</label>
              <div className="bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-bold text-emerald-400 flex items-center justify-between">
                <span>Current Operating Balance:</span>
                <span>{bankBalance !== null ? `$${bankBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Check Number</label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g. 1001"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* THE AUTHENTIC QUICKBOOKS CHECK FORM */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-2 border-emerald-600/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-2 right-4 text-[10px] font-bold text-emerald-500/30 uppercase tracking-widest pointer-events-none">
              PROPBOOKS VOUCHER CHECK
            </div>

            {/* Top Row: Date & Check # */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">PROPBOOKS REAL ESTATE DISBURSEMENT</span>
                <p className="text-[11px] text-slate-400">Direct Vendor Payment & Trust Checking</p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="text-xs font-bold text-slate-300">DATE</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-emerald-300">
                  NO. {checkNumber}
                </div>
              </div>
            </div>

            {/* Pay to the Order of & Amount with Vendor Auto-Populate */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center mb-4 bg-slate-900/70 p-3 rounded-xl border border-slate-700/60">
              <div className="md:col-span-3">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wide block">
                  PAY TO THE ORDER OF
                </label>
                {vendors.length > 0 && (
                  <span className="text-[10px] text-slate-400">or pick from Vendor list</span>
                )}
              </div>
              <div className="md:col-span-6 space-y-1.5">
                {vendors.length > 0 && (
                  <select
                    value={selectedVendorId}
                    onChange={(e) => handleVendorSelect(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">(Select Existing Vendor to Auto-Fill...)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        [{v.account_number}] {v.name} {v.city ? `(${v.city}, ${v.state})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={payee}
                  onChange={(e) => {
                    setPayee(e.target.value);
                    setSelectedVendorId('');
                  }}
                  placeholder="Vendor / Contractor / Utility Name (e.g. Austin HVAC Pros)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-3 flex items-center">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400 font-bold">
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border-2 border-emerald-500/80 rounded-lg pl-7 pr-3 py-2 text-base font-bold text-emerald-300 text-right focus:outline-none focus:border-emerald-400 font-mono shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Amount in English Words */}
            <div className="bg-slate-950/80 border-b border-emerald-500/40 px-4 py-2.5 rounded-lg mb-5 flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DOLLARS:</span>
              <span className="text-xs font-bold text-emerald-200 italic tracking-wide flex-1 truncate">
                {amountWords}
              </span>
            </div>

            {/* Address, Memo, and Signature Line */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              {/* Payee Address Block */}
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">ADDRESS</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Payee Mailing Address Line 1&#10;City, State, Zip"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                />
              </div>

              {/* Memo & Signature */}
              <div className="md:col-span-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase w-12">MEMO</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="e.g. Unit 204 HVAC replacement"
                    className="flex-1 bg-slate-950 border-b border-slate-700 px-3 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-700 text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">AUTHORIZED SIGNATURE</span>
                </div>
              </div>
            </div>
          </div>

          {/* EXPENSES / SPLIT ALLOCATION TABLE (QuickBooks Desktop Style) */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="bg-slate-800/80 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Expenses & Property Allocation</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {splits.length} {splits.length === 1 ? 'line' : 'lines'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddSplitRow}
                className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Split Line</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="p-3">ACCOUNT (CHART OF ACCOUNTS)</th>
                    <th className="p-3 w-32 text-right">AMOUNT ($)</th>
                    <th className="p-3">MEMO / NOTES</th>
                    <th className="p-3">CLASS (LLC)</th>
                    <th className="p-3">PROPERTY (SUB-CLASS)</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {splits.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="p-2">
                        <select
                          value={row.category_id}
                          onChange={(e) => handleSplitChange(idx, 'category_id', parseInt(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.account_number ? `[${c.account_number}] ` : ''}{c.name} ({c.type})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => handleSplitChange(idx, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono text-right focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          value={row.memo}
                          onChange={(e) => handleSplitChange(idx, 'memo', e.target.value)}
                          placeholder="Line description"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="p-2">
                        <select
                          value={row.class_id}
                          onChange={(e) => handleSplitChange(idx, 'class_id', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">(No LLC Class)</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <select
                          value={row.property_id}
                          onChange={(e) => handleSplitChange(idx, 'property_id', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">(Portfolio General)</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 text-center">
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplitRow(idx)}
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

            {/* Split Balance Summary Footer */}
            <div className="bg-slate-800/80 px-4 py-3 border-t border-slate-700 flex flex-wrap items-center justify-between text-xs gap-3">
              <div className="flex items-center space-x-4">
                <span>
                  Check Amount: <strong className="text-white font-mono">${totalCheckAmount.toFixed(2)}</strong>
                </span>
                <span>
                  Total Split: <strong className="text-white font-mono">${totalSplits.toFixed(2)}</strong>
                </span>
              </div>

              <div>
                {isSplitBalanced && totalCheckAmount > 0 ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center space-x-1">
                    <span>✓ Split Fully Balanced</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                    Difference: ${Math.abs(totalCheckAmount - totalSplits).toFixed(2)}
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
              disabled={loading || totalCheckAmount <= 0 || !isSplitBalanced}
              onClick={() => handleSubmit(false, true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/50 rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Check Voucher</span>
            </button>

            <button
              type="button"
              disabled={loading || totalCheckAmount <= 0 || !isSplitBalanced}
              onClick={() => handleSubmit(true, false)}
              className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-600/50 rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              Save & New
            </button>

            <button
              type="button"
              disabled={loading || totalCheckAmount <= 0 || !isSplitBalanced}
              onClick={() => handleSubmit(false, false)}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save & Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
