import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  CheckSquare, 
  Edit, 
  Trash2, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  RefreshCw,
  Hash,
  Landmark,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { Vendor, Category } from '../types';
import { VendorFormModal } from '../components/VendorFormModal';

interface VendorListPageProps {
  onWriteCheckToVendor: (vendor: Vendor) => void;
  categories: Category[];
}

export const VendorListPage: React.FC<VendorListPageProps> = ({
  onWriteCheckToVendor,
  categories
}) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendorToEdit, setSelectedVendorToEdit] = useState<Vendor | null>(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getVendors({
        search: searchTerm || undefined,
        active_only: activeOnly
      });
      setVendors(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vendor list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [activeOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleOpenCreate = () => {
    setSelectedVendorToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor: Vendor) => {
    setSelectedVendorToEdit(vendor);
    setIsModalOpen(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendor.name}" (${vendor.account_number})?`)) {
      return;
    }
    try {
      await api.deleteVendor(vendor.id);
      setVendors(vendors.filter(v => v.id !== vendor.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete vendor');
    }
  };

  const handleExportCsv = () => {
    window.open(api.getVendorsExportUrl(), '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>Vendor Center</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {vendors.length} Vendors
                </span>
              </h1>
              <p className="text-xs text-slate-400">Manage vendor account numbers, contractor profiles, mailing addresses, and 1099 compliance</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Export Vendor List to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchVendors}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            title="Refresh Vendor List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/50 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Vendor</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Vendors</span>
          <p className="text-2xl font-bold text-white mt-1 font-mono">{vendors.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Vendors</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{vendors.filter(v => v.is_active).length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">1099 Eligible Contractors</span>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{vendors.filter(v => v.is_1099_eligible).length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Full Address Complete</span>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{vendors.filter(v => v.address).length}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Vendor Account #, Name, Address, Contact, Phone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <label className="flex items-center space-x-2 text-xs text-slate-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <span>Active Only</span>
          </label>

          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Search
          </button>

          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); fetchVendors(); }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Vendor Table */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-400" />
          <p className="text-sm font-semibold">Loading Vendors...</p>
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-base font-bold text-slate-200">No Vendors Found</p>
          <p className="text-xs text-slate-400 mt-1">Create your first vendor to streamline check writing and disbursements.</p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
          >
            + Create New Vendor
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800/90 text-slate-300 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-3.5">ACCOUNT #</th>
                  <th className="p-3.5">VENDOR / COMPANY NAME</th>
                  <th className="p-3.5">MAILING ADDRESS</th>
                  <th className="p-3.5">CONTACT & PHONE</th>
                  <th className="p-3.5">DEFAULT EXPENSE ACCOUNT</th>
                  <th className="p-3.5 text-center">1099</th>
                  <th className="p-3.5 text-center">STATUS</th>
                  <th className="p-3.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                      {v.account_number}
                    </td>
                    <td className="p-3.5 font-bold text-white">
                      <div>{v.name}</div>
                      {v.tax_id && (
                        <span className="text-[10px] text-slate-400 font-mono">Tax ID: {v.tax_id}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-300 max-w-xs">
                      {v.address ? (
                        <div className="flex items-start space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate">{v.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No address recorded</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-300 whitespace-nowrap">
                      <div>{v.contact_person || '—'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        {v.phone && <span>{v.phone}</span>}
                        {v.email && <span>&bull; {v.email}</span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {v.default_category_display || (v.default_category_name ? v.default_category_name : '—')}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {v.is_1099_eligible ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          1099 Eligible
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {v.is_active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onWriteCheckToVendor(v)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/40 transition cursor-pointer"
                          title="Write Check to this Vendor"
                        >
                          <CheckSquare className="w-3 h-3" />
                          <span>Check</span>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition cursor-pointer"
                          title="Edit Vendor"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 rounded border border-rose-800/40 transition cursor-pointer"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendor Form Modal */}
      <VendorFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchVendors();
        }}
        vendorToEdit={selectedVendorToEdit}
        categories={categories}
      />

    </div>
  );
};
