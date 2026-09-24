import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Edit2, 
  AlertCircle, 
  Building2, 
  Landmark, 
  Search,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { BankRule, Category, Property, ClassEntity } from '../../types';

interface BankRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  properties: Property[];
  classes: ClassEntity[];
}

export const BankRulesModal: React.FC<BankRulesModalProps> = ({
  isOpen,
  onClose,
  categories,
  properties,
  classes
}) => {
  const [rules, setRules] = useState<BankRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // New rule form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number | ''>('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newPropertyId, setNewPropertyId] = useState<number | ''>('');
  const [isCheckRule, setIsCheckRule] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<number | ''>('');
  const [editPropertyId, setEditPropertyId] = useState<number | ''>('');

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getBankRules();
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bank rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) {
      alert('Please enter a match keyword (e.g. Joe\'s Plumbing, Xcel Energy)');
      return;
    }
    try {
      setSaving(true);
      await api.createBankRule({
        name: newRuleName.trim() || `Rule: ${newKeyword.trim()}`,
        match_keyword: newKeyword.trim(),
        match_field: 'payee_or_desc',
        target_category_id: newCategoryId ? Number(newCategoryId) : undefined,
        target_vendor_name: newVendorName.trim() || undefined,
        target_property_id: newPropertyId ? Number(newPropertyId) : undefined,
        is_check: isCheckRule,
        is_active: true
      });
      setNewKeyword('');
      setNewRuleName('');
      setNewCategoryId('');
      setNewVendorName('');
      setNewPropertyId('');
      setShowAddForm(false);
      await fetchRules();
    } catch (err: any) {
      alert(err.message || 'Failed to create bank rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete rule "${name}"?`)) return;
    try {
      await api.deleteBankRule(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const handleToggleActive = async (rule: BankRule) => {
    try {
      const updated = await api.updateBankRule(rule.id, { is_active: !rule.is_active });
      setRules(rules.map(r => r.id === rule.id ? updated : r));
    } catch (err: any) {
      alert(err.message || 'Failed to update rule status');
    }
  };

  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.match_keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.target_vendor_name && r.target_vendor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.target_category_name && r.target_category_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Automated Bank Transaction Rules</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {rules.length} Rules
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automatically classify recurring vendor checks, utilities, taxes, and deposits when importing bank statements.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search rules by keyword, vendor, category..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-lg shadow-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Cancel' : 'Create Custom Rule'}</span>
          </button>
        </div>

        {/* New Rule Inline Form */}
        {showAddForm && (
          <form onSubmit={handleCreateRule} className="p-4 bg-purple-950/20 border-b border-purple-900/30 animate-in slide-in-from-top-2">
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">
              Add New Transaction Recognition Rule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Match Keyword <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => {
                    setNewKeyword(e.target.value);
                    if (!newVendorName) setNewVendorName(e.target.value);
                  }}
                  placeholder="e.g. Joe's Plumbing"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Vendor / Payee Name
                </label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Joe's Plumbing"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Target Account / Category
                </label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.account_number ? `[${c.account_number}] ` : ''}{c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">
                  Default Property / Sub-Class
                </label>
                <select
                  value={newPropertyId}
                  onChange={(e) => setNewPropertyId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Any Property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCheckRule}
                  onChange={(e) => setIsCheckRule(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                />
                <span>Classify as physical check disbursement by default</span>
              </label>

              <button
                type="submit"
                disabled={saving || !newKeyword.trim()}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </form>
        )}

        {/* Rules Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
              <Sparkles className="w-4 h-4 animate-spin mr-2 text-purple-400" />
              Loading automated bank rules...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <Sparkles className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No bank rules created yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                When importing bank statements, check the "Remember rule" box on recurring transactions or create custom rules here.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Rule Name & Match Keyword</th>
                    <th className="py-2.5 px-3">Target Payee / Vendor</th>
                    <th className="py-2.5 px-3">Assigned Category (COA)</th>
                    <th className="py-2.5 px-3">Assigned Property</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleActive(r)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                            r.is_active 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {r.is_active ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{r.name}</div>
                        <div className="text-[11px] text-purple-300 font-mono">
                          keyword: <span className="bg-purple-950/60 px-1 py-0.5 rounded border border-purple-800/40">"{r.match_keyword}"</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-200 font-medium">{r.target_vendor_name || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-400 font-mono font-medium">
                          {r.target_category_display || r.target_category_name || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-slate-300">{r.target_property_name || 'All Properties'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(r.id, r.name)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Rules apply automatically during CSV and PDF bank statement imports.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
