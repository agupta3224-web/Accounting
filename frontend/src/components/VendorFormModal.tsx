import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  Landmark
} from 'lucide-react';
import { api } from '../services/api';
import { Vendor, VendorCreatePayload, Category, US_STATES } from '../types';

interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vendor: Vendor) => void;
  vendorToEdit?: Vendor | null;
  categories: Category[];
}

export const VendorFormModal: React.FC<VendorFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendorToEdit,
  categories
}) => {
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [is1099Eligible, setIs1099Eligible] = useState(false);
  
  // Address form fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (vendorToEdit) {
        setName(vendorToEdit.name || '');
        setAccountNumber(vendorToEdit.account_number || '');
        setContactPerson(vendorToEdit.contact_person || '');
        setEmail(vendorToEdit.email || '');
        setPhone(vendorToEdit.phone || '');
        setTaxId(vendorToEdit.tax_id || '');
        setIs1099Eligible(Boolean(vendorToEdit.is_1099_eligible));
        setAddressLine1(vendorToEdit.address_line1 || '');
        setAddressLine2(vendorToEdit.address_line2 || '');
        setCity(vendorToEdit.city || '');
        setState(vendorToEdit.state || '');
        setZipCode(vendorToEdit.zip_code || '');
        setDefaultCategoryId(vendorToEdit.default_category_id || '');
        setNotes(vendorToEdit.notes || '');
        setIsActive(vendorToEdit.is_active !== false);
      } else {
        setName('');
        fetchNextAccountNumber();
        setContactPerson('');
        setEmail('');
        setPhone('');
        setTaxId('');
        setIs1099Eligible(false);
        setAddressLine1('');
        setAddressLine2('');
        setCity('');
        setState('');
        setZipCode('');
        const defaultExp = categories.find(c => c.account_number === '60100') || categories.find(c => c.type === 'OPERATING_EXPENSE');
        setDefaultCategoryId(defaultExp ? defaultExp.id : '');
        setNotes('');
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, vendorToEdit, categories]);

  const fetchNextAccountNumber = async () => {
    try {
      const res = await api.getNextVendorAccountNumber();
      setAccountNumber(res.next_account_number);
    } catch {
      setAccountNumber('VEND-1001');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Vendor Name is required.');
      return;
    }

    try {
      setLoading(true);
      const payload: VendorCreatePayload = {
        name: name.trim(),
        account_number: accountNumber.trim(),
        contact_person: contactPerson.trim(),
        email: email.trim(),
        phone: phone.trim(),
        tax_id: taxId.trim(),
        is_1099_eligible: is1099Eligible,
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim(),
        zip_code: zipCode.trim(),
        default_category_id: defaultCategoryId ? Number(defaultCategoryId) : null,
        notes: notes.trim(),
        is_active: isActive
      };

      let res: Vendor;
      if (vendorToEdit) {
        res = await api.updateVendor(vendorToEdit.id, payload);
      } else {
        res = await api.createVendor(payload);
      }
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {vendorToEdit ? 'Edit Vendor Information' : 'New Vendor / Contractor'}
              </h2>
              <p className="text-xs text-slate-400">Manage vendor contact, mailing address, tax ID, and default account</p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Number & Vendor Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                <span>Account Number</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. VEND-1001"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vendor / Company Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Austin HVAC Pros & Mechanical"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Complete Address Form Block */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              <span>Vendor Mailing Address (Window Envelope Format)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Street Address or P.O. Box"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite, Bldg, Unit #"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Austin"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">State (Dropdown)</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 uppercase"
                >
                  <option value="">Select State...</option>
                  {US_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="78704"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact Person</span>
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Robert Vance"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Phone</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(512) 555-0192"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="service@vendor.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Tax ID & 1099 & Default Expense Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tax ID (SSN / EIN for 1099)
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="XX-XXXXXXX"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <div className="mt-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is1099"
                  checked={is1099Eligible}
                  onChange={(e) => setIs1099Eligible(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="is1099" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Vendor eligible for 1099-MISC / 1099-NEC reporting
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Expense Account (Chart of Accounts)
              </label>
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">(None - Select on transaction)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.account_number ? `[${c.account_number}] ` : ''}{c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes & Active Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Net 30 payment terms, specialty HVAC contractor"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isActiveVendor"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="isActiveVendor" className="text-xs text-slate-300 font-semibold cursor-pointer">
              Active Vendor
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl shadow-lg shadow-amber-950/50 transition cursor-pointer disabled:opacity-40"
            >
              {loading ? 'Saving...' : (vendorToEdit ? 'Update Vendor' : 'Create Vendor')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
