import React, { useState, useEffect } from 'react';
import { X, Hash, Sparkles, CheckCircle2, AlertCircle, Bookmark, Layers, FileText, Info, DollarSign, Calendar } from 'lucide-react';
import { AccountItem } from '../types';
import { api } from '../services/api';

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editAccount?: AccountItem | null;
  parentAccountPreset?: AccountItem | null;
  allAccounts?: AccountItem[];
}

const ACCOUNT_TIERS = [
  { type: 'ASSET', label: '1xxxx - Assets', range: '10000 - 19999', desc: 'Bank Accounts, Cash on Hand, Accounts Receivable, Fixed Assets', color: 'emerald' },
  { type: 'LIABILITY', label: '2xxxx - Payables & Liabilities', range: '20000 - 29999', desc: 'Accounts Payable, Tenant Security Deposits Held, Mortgages', color: 'amber' },
  { type: 'EQUITY', label: '3xxxx - Equities', range: '30000 - 39999', desc: "Owner's Equity, Capital Contributions, Draws, Retained Earnings", color: 'blue' },
  { type: 'INCOME', label: '4xxxx - Revenue & Income', range: '40000 - 49999', desc: 'Rental Income, Late Fees, Laundry & Parking Revenue', color: 'teal' },
  { type: 'COGS', label: '5xxxx - Cost of Goods Sold (COGS)', range: '50000 - 59999', desc: 'Direct Turnover Labor, Cleaning, Unit Turnover Materials', color: 'orange' },
  { type: 'OPERATING_EXPENSE', label: '6xxxx thru 8xxxx - Operating Expenses', range: '60000 - 89999', desc: 'Repairs & Maintenance, Management Fees, Taxes, Insurance, Utilities', color: 'rose' },
  { type: 'OTHER_INCOME_EXPENSE', label: '9xxxx - Other Incomes & Expenses', range: '90000 - 99999', desc: 'Interest Income, Mortgage Debt Service, CapEx, Depreciation', color: 'purple' },
];

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editAccount,
  parentAccountPreset,
  allAccounts = []
}) => {
  const [accountType, setAccountType] = useState<string>('OPERATING_EXPENSE');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [subType, setSubType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isRepairCategory, setIsRepairCategory] = useState<boolean>(false);
  const [isRentalIncome, setIsRentalIncome] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Sub-Account state
  const [isSubAccount, setIsSubAccount] = useState<boolean>(false);
  const [parentAccountId, setParentAccountId] = useState<number | ''>('');

  // Opening Balance state
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (parentAccountPreset) {
      setIsSubAccount(true);
      setParentAccountId(parentAccountPreset.id);
      setAccountType(parentAccountPreset.type || 'OPERATING_EXPENSE');
      setAccountNumber('');
      setName('');
      setSubType(parentAccountPreset.sub_type || '');
      setDescription('');
      setIsRepairCategory(false);
      setIsRentalIncome(false);
      setIsActive(true);
      setOpeningBalance('');
      setOpeningBalanceDate(new Date().toISOString().split('T')[0]);
      handleSuggestNumber(parentAccountPreset.type || 'OPERATING_EXPENSE', parentAccountPreset.id);
    } else if (editAccount) {
      setAccountType(editAccount.type || 'OPERATING_EXPENSE');
      setAccountNumber(editAccount.account_number || '');
      setName(editAccount.name || '');
      setSubType(editAccount.sub_type || '');
      setDescription(editAccount.description || '');
      setIsRepairCategory(Boolean(editAccount.is_repair_category));
      setIsRentalIncome(Boolean(editAccount.is_rental_income));
      setIsActive(editAccount.is_active !== false);
      setOpeningBalance(editAccount.opening_balance ? String(editAccount.opening_balance) : '');
      setOpeningBalanceDate(editAccount.opening_balance_date || '');
      if (editAccount.parent_account_id) {
        setIsSubAccount(true);
        setParentAccountId(editAccount.parent_account_id);
      } else {
        setIsSubAccount(false);
        setParentAccountId('');
      }
    } else {
      resetForm();
      handleSuggestNumber('OPERATING_EXPENSE');
    }
  }, [editAccount, parentAccountPreset, isOpen]);

  const resetForm = () => {
    setAccountType('OPERATING_EXPENSE');
    setAccountNumber('');
    setName('');
    setSubType('');
    setDescription('');
    setIsRepairCategory(false);
    setIsRentalIncome(false);
    setIsActive(true);
    setIsSubAccount(false);
    setParentAccountId('');
    setOpeningBalance('');
    setOpeningBalanceDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  const handleTypeChange = (newType: string) => {
    setAccountType(newType);
    if (newType === 'INCOME') {
      setIsRentalIncome(true);
      setIsRepairCategory(false);
    } else if (newType === 'OPERATING_EXPENSE') {
      setIsRentalIncome(false);
    } else {
      setIsRentalIncome(false);
      setIsRepairCategory(false);
    }

    if (!editAccount) {
      handleSuggestNumber(newType, isSubAccount && parentAccountId ? Number(parentAccountId) : null);
    }
  };

  const handleSuggestNumber = async (type: string, pId?: number | null) => {
    try {
      setSuggesting(true);
      const targetParentId = pId !== undefined ? pId : (isSubAccount && parentAccountId ? Number(parentAccountId) : null);
      const res = await api.getSuggestedAccountNumber(type, targetParentId);
      if (res && res.suggested_number) {
        setAccountNumber(res.suggested_number);
      }
    } catch (err) {
      console.error('Error suggesting account number:', err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleToggleSubAccount = (checked: boolean) => {
    setIsSubAccount(checked);
    if (!checked) {
      setParentAccountId('');
      handleSuggestNumber(accountType, null);
    } else {
      const candidates = allAccounts.filter(a => !editAccount || a.id !== editAccount.id);
      if (candidates.length > 0 && !parentAccountId) {
        const first = candidates[0];
        setParentAccountId(first.id);
        setAccountType(first.type);
        handleSuggestNumber(first.type, first.id);
      }
    }
  };

  const handleSelectParent = (pIdStr: string) => {
    const pId = pIdStr ? Number(pIdStr) : '';
    setParentAccountId(pId);
    if (pId) {
      const parent = allAccounts.find(a => a.id === pId);
      if (parent) {
        setAccountType(parent.type);
        handleSuggestNumber(parent.type, parent.id);
      }
    }
  };

  const getNumberRangeHint = (type: string) => {
    const tier = ACCOUNT_TIERS.find(t => t.type === type);
    return tier ? tier.range : '4 to 7 digits';
  };

  const validateNumberLocally = (num: string, type: string): string | null => {
    const clean = num.replace(/\D/g, '');
    if (!clean) return 'Account number is required.';
    const val = parseInt(clean, 10);

    if (type === 'ASSET' && (val < 10000 || val > 19999)) return 'Asset accounts must be in 1xxxx range (10000 - 19999).';
    if (type === 'LIABILITY' && (val < 20000 || val > 29999)) return 'Payables & Liability accounts must be in 2xxxx range (20000 - 29999).';
    if (type === 'EQUITY' && (val < 30000 || val > 39999)) return 'Equity accounts must be in 3xxxx range (30000 - 39999).';
    if (type === 'INCOME' && (val < 40000 || val > 49999)) return 'Revenue & Income accounts must be in 4xxxx range (40000 - 49999).';
    if (type === 'COGS' && (val < 50000 || val > 59999)) return 'COGS accounts must be in 5xxxx range (50000 - 59999).';
    if (type === 'OPERATING_EXPENSE' && (val < 60000 || val > 89999)) return 'Operating Expense accounts must be in 6xxxx - 8xxxx range (60000 - 89999).';
    if (type === 'OTHER_INCOME_EXPENSE' && (val < 80000 || val > 99999)) return 'Other Income & Expense accounts must be in 8xxxx - 9xxxx range (80000 - 99999).';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    if (isSubAccount && !parentAccountId) {
      setError('Please select a parent account for this sub-account.');
      return;
    }

    const localErr = validateNumberLocally(accountNumber, accountType);
    if (localErr) {
      setError(localErr);
      return;
    }

    try {
      setLoading(true);
      const parentIdVal = isSubAccount && parentAccountId ? Number(parentAccountId) : (editAccount?.parent_account_id ? -1 : undefined);
      const openBalNum = openingBalance !== '' && !isNaN(Number(openingBalance)) ? Number(openingBalance) : 0;
      const openBalDt = openBalNum > 0 && openingBalanceDate ? openingBalanceDate : undefined;

      if (editAccount) {
        await api.updateAccount(editAccount.id, {
          account_number: accountNumber.trim(),
          name: name.trim(),
          type: accountType,
          sub_type: subType.trim() || undefined,
          description: description.trim() || undefined,
          is_repair_category: isRepairCategory,
          is_rental_income: isRentalIncome,
          is_active: isActive,
          parent_account_id: parentIdVal,
          opening_balance: openBalNum,
          opening_balance_date: openBalDt
        });
      } else {
        await api.createAccount({
          account_number: accountNumber.trim(),
          name: name.trim(),
          type: accountType,
          sub_type: subType.trim() || undefined,
          description: description.trim() || undefined,
          is_repair_category: isRepairCategory,
          is_rental_income: isRentalIncome,
          is_active: isActive,
          parent_account_id: isSubAccount && parentAccountId ? Number(parentAccountId) : null,
          opening_balance: openBalNum,
          opening_balance_date: openBalDt
        });
      }

      window.dispatchEvent(new CustomEvent('coa-updated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentTier = ACCOUNT_TIERS.find(t => t.type === accountType);
  const numValidationErr = accountNumber ? validateNumberLocally(accountNumber, accountType) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-white my-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editAccount ? 'Edit Account Entry' : 'Create New Account'}
              </h3>
              <p className="text-xs text-slate-400">Standard Real Estate Accounting Numbering System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sub-Account Option Box */}
          <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-bold text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={isSubAccount}
                  onChange={(e) => handleToggleSubAccount(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Sub-account of another account</span>
              </label>
              <span className="text-[10px] text-slate-400 font-normal">
                E.g. Taxes ➔ County, City, State, Federal
              </span>
            </div>

            {isSubAccount && (
              <div className="space-y-2 pt-2 border-t border-slate-700/60 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Parent Account <span className="text-rose-400">*</span>
                </label>
                <select
                  value={parentAccountId}
                  onChange={(e) => handleSelectParent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Parent Account --</option>
                  {allAccounts.filter(a => !editAccount || a.id !== editAccount.id).map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.account_number}] {a.name} ({a.type})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-300/80 italic flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sub-accounts inherit classification type and group automatically under the parent account.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* 1. Account Classification Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Account Classification &amp; Tier {isSubAccount && '(Inherited from Parent)'}</span>
              <span className="text-[11px] text-slate-400 font-normal">Range: {getNumberRangeHint(accountType)}</span>
            </label>
            <select
              value={accountType}
              disabled={isSubAccount}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={`w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition ${isSubAccount ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {ACCOUNT_TIERS.map((tier) => (
                <option key={tier.type} value={tier.type}>
                  {tier.label} ({tier.range})
                </option>
              ))}
            </select>
            {currentTier && (
              <p className="text-[11px] text-slate-400 mt-1.5 italic">
                Includes: {currentTier.desc}
              </p>
            )}
          </div>

          {/* 2. Account Number with Range & Suggest Button */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Account Number (5-Digit Standard)</span>
              </span>
              <button
                type="button"
                onClick={() => handleSuggestNumber(accountType)}
                disabled={suggesting}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-medium cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>{suggesting ? 'Finding next...' : 'Auto-Suggest Next #'}</span>
              </button>
            </label>
            <div className="relative">
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 10010, 20100, 60100"
                className={`w-full bg-slate-800/90 border rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                  numValidationErr
                    ? 'border-amber-500/70 focus:ring-amber-500'
                    : 'border-slate-700 focus:ring-emerald-500'
                }`}
              />
            </div>
            {numValidationErr ? (
              <p className="text-[11px] text-amber-400 mt-1 flex items-center space-x-1">
                <Info className="w-3 h-3" />
                <span>{numValidationErr}</span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-400/80 mt-1 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Matches standard {currentTier?.label} range.</span>
              </p>
            )}
          </div>

          {/* 3. Account Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Account Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operating Bank Checking, Rental Income, Repairs & Maintenance"
              required
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* 4. Sub-Type / Detail Classification */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Sub-Type / Detail Classification (Optional)
            </label>
            <input
              type="text"
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              placeholder="e.g. Bank Accounts, Accounts Receivable, Rental Revenue, Maintenance, Taxes"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* 5. Description / Memo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description / Notes (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Purpose of this account and guidelines for categorization..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
            />
          </div>

          {/* 6. Opening Balance & Date (Optional - QuickBooks Historical Carryover) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-800/60 to-slate-800/40 border border-emerald-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Opening Balance & Date (Optional)</span>
              </span>
              <span className="text-[10px] text-emerald-400/80 font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60">
                Historical Starting Balance
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              If you are bringing over an existing bank account (checking, savings) or liability balance into PropBooks, enter your starting balance and statement date. PropBooks records the double-entry offset to Opening Balance Equity.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Opening Balance ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  As of Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={openingBalanceDate}
                    onChange={(e) => setOpeningBalanceDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 7. Special Property Accounting Flags */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 block mb-1">Real Estate Accounting Rules</span>
            
            <label className="flex items-center space-x-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isRentalIncome}
                onChange={(e) => setIsRentalIncome(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500 focus:ring-offset-slate-900"
              />
              <span><strong>Rental Income Line Item</strong> (Multi-unit rent aggregation rule applies to this account)</span>
            </label>

            <label className="flex items-center space-x-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isRepairCategory}
                onChange={(e) => setIsRepairCategory(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 bg-slate-800 border-slate-700 focus:ring-rose-500 focus:ring-offset-slate-900"
              />
              <span><strong>Maintenance & Repairs</strong> (Included in property Repair % calculation on Monthly P&L)</span>
            </label>

            <label className="flex items-center space-x-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-800 border-slate-700 focus:ring-cyan-500 focus:ring-offset-slate-900"
              />
              <span><strong>Active Account</strong> (Visible in transaction entries and import mappings)</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer"
            >
              {loading ? 'Saving...' : editAccount ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

