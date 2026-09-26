import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, PlusCircle, FolderOpen, Archive, RotateCcw, 
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, Shield, 
  Clock, Download, FileSpreadsheet, ArrowRight, HardDrive, Check,
  Trash2, AlertTriangle, Search
} from 'lucide-react';
import { CompanyFileItem, BackupRecord } from '../types';
import { api } from '../services/api';
import { EntitySetupWizardModal } from '../components/entities/EntitySetupWizardModal';

interface CompanyWelcomeScreenProps {
  onCompanyOpened: () => void;
}

export const CompanyWelcomeScreen: React.FC<CompanyWelcomeScreenProps> = ({ onCompanyOpened }) => {
  const [companies, setCompanies] = useState<CompanyFileItem[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Company Guided Entity Setup State
  const [showEntityWizard, setShowEntityWizard] = useState(false);

  // Delete Company Modal & Retention Pruning State
  const [companyToDelete, setCompanyToDelete] = useState<CompanyFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Restore State
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const [comps, bkps] = await Promise.all([
        api.getSystemCompanies(),
        api.getSystemBackups()
      ]);
      setCompanies(comps);
      setBackups(bkps);
    } catch (err: any) {
      setError(err.message || 'Failed to load company files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleOpenCompany = async (key: string) => {
    try {
      setLoading(true);
      setError(null);
      await api.openSystemCompany(key);
      onCompanyOpened();
    } catch (err: any) {
      setError(err.message || 'Failed to open company file');
      setLoading(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    try {
      setRestoring(true);
      setError(null);
      const res = await api.restoreCompanyFile(file);
      setSuccessMsg(res.message || 'Company restored successfully!');
      setTimeout(() => {
        onCompanyOpened();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
      setRestoring(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      setDeleting(true);
      setError(null);
      await api.deleteSystemCompany(companyToDelete.key);
      setSuccessMsg(`Company file "${companyToDelete.name}" was permanently deleted.`);
      setCompanyToDelete(null);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete company file');
    } finally {
      setDeleting(false);
    }
  };

  const handlePruneRestoredFiles = async () => {
    try {
      setPruning(true);
      setError(null);
      const res = await api.pruneRestoredCompanies(3);
      setSuccessMsg(res.message || 'Files and backups pruned: retaining the 3 most recent backups and company files.');
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Failed to prune old company files and backups');
    } finally {
      setPruning(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.file_name.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Top Product Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 rounded-2xl shadow-xl shadow-emerald-950/60 mb-2">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            PropBooks <span className="text-emerald-400 font-bold text-2xl sm:text-3xl">Desktop Pro</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Real Estate Accounting & Statement Intelligence for Commercial & Residential Investors.
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center space-x-2 max-w-2xl mx-auto">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 max-w-2xl mx-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 3 Main Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Sample Company */}
          <div 
            onClick={() => handleOpenCompany('sample_company')}
            className="bg-slate-800/80 hover:bg-slate-800 border-2 border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-emerald-950/40 transition cursor-pointer group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Instant Demo
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
                Open Sample Company
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Explore a pre-configured multi-property portfolio (Sunset Palms, 2908 Depot, Oakridge Duplex) with sample statements & monthly P&L.
              </p>
            </div>
            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition">
              <span>Launch Sample File</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Create New Company */}
          <div 
            onClick={() => setShowEntityWizard(true)}
            className="bg-slate-800/80 hover:bg-slate-800 border-2 border-indigo-500/40 hover:border-indigo-400 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-indigo-950/40 transition cursor-pointer group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  New Workspace
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">
                &lt;Create a New Company&gt;
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Initialize a brand-new clean investor database file with a standard chart of accounts, custom LLC classes, and property assets.
              </p>
            </div>
            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition">
              <span>Start New Company Wizard</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Restore Backup */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-800/80 hover:bg-slate-800 border-2 border-slate-700 hover:border-cyan-400 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-cyan-950/40 transition cursor-pointer group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && e.target.files[0] && handleRestoreFile(e.target.files[0])}
              accept=".propbackup, .zip"
              className="hidden"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl">
                  {restoring ? <RefreshCw className="w-6 h-6 animate-spin" /> : <RotateCcw className="w-6 h-6" />}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  Disaster Recovery
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
                Restore from Backup
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Restore your accounting file from a previously saved <span className="font-mono text-cyan-300">.propbackup</span> snapshot archive.
              </p>
            </div>
            <div className="pt-6 flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition">
              <span>{restoring ? 'Restoring Archive...' : 'Select Backup File'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
        {/* Existing Company Files Table */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  <span>Existing Company Files on this Machine</span>
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Retention: Last 3 Kept
                </span>
              </div>
              <p className="text-xs text-slate-400">Select a company database to open, delete unwanted files, or manage backups</p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handlePruneRestoredFiles}
                disabled={pruning}
                title="Only keep the last 3 backups and company file versions and delete the rest"
                className="text-xs font-semibold px-2.5 py-1.5 bg-purple-950/50 hover:bg-purple-900/70 text-purple-300 border border-purple-700/50 rounded-lg transition cursor-pointer flex items-center space-x-1"
              >
                <RotateCcw className={`w-3 h-3 ${pruning ? 'animate-spin' : ''}`} />
                <span>{pruning ? 'Pruning...' : 'Prune (Keep 3)'}</span>
              </button>
              <button
                onClick={loadFiles}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Search / Filter bar if more than 3 companies */}
          {companies.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter company files by name or filename..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-white placeholder-slate-500 outline-hidden focus:border-emerald-500"
              />
            </div>
          )}

          <div className="divide-y divide-slate-700/50">
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No company files match your search criteria.
              </div>
            ) : (
              filteredCompanies.map(comp => (
                <div 
                  key={comp.key}
                  className="py-3 px-3 flex items-center justify-between hover:bg-slate-700/30 rounded-xl transition gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-sm text-white truncate">{comp.name}</span>
                      {comp.is_sample && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          Sample File
                        </span>
                      )}
                      {comp.is_restored && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Restored Backup</span>
                        </span>
                      )}
                      {comp.is_active && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center space-x-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Currently Loaded</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {comp.file_name} &bull; {comp.size_kb} KB &bull; Modified: {new Date(comp.last_modified).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleOpenCompany(comp.key)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center space-x-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                    {!comp.is_sample ? (
                      <button
                        onClick={() => setCompanyToDelete(comp)}
                        className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-800/40 hover:border-red-600/60 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1"
                        title={`Delete ${comp.name} file`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    ) : (
                      <span 
                        title="The demo sample file is protected from deletion" 
                        className="text-[10px] text-slate-500 italic px-2 py-1 select-none"
                      >
                        Protected
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Backups History */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <Archive className="w-4 h-4 text-cyan-400" />
                <span>Automatic & Manual Safety Backups</span>
              </h2>
              <p className="text-xs text-slate-400">Backups are created automatically on close/exit. System automatically retains the last 3 backups per company and deletes older ones.</p>
            </div>
          </div>

          {backups.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              No backups created yet. An automatic backup will be saved whenever you close a company or exit. System automatically keeps the last 3 backups.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700 uppercase text-[10px]">
                    <th className="py-2 px-3">Backup File</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {backups.slice(0, 5).map(b => (
                    <tr key={b.filename} className="hover:bg-slate-700/20 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-300 font-semibold">{b.filename}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.is_auto ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {b.is_auto ? 'Auto (On Close)' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{b.size_kb} KB</td>
                      <td className="py-2.5 px-3 text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <a
                          href={api.getBackupDownloadUrl(b.filename)}
                          download={b.filename}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-md transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create New Company Entity Setup Wizard Modal */}
      <EntitySetupWizardModal
        isOpen={showEntityWizard}
        onClose={() => setShowEntityWizard(false)}
        onSuccess={() => {
          setShowEntityWizard(false);
          setSuccessMsg('New company and entity created successfully!');
          setTimeout(() => {
            onCompanyOpened();
          }, 300);
        }}
        isCreatingNewCompany={true}
      />

      {/* Delete Company Confirmation Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-slate-800 border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-400 border-b border-slate-700 pb-3">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Company File</h3>
                <p className="text-xs text-red-300/80">Permanent database deletion</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to permanently delete this company file?
              </p>
              <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-xl space-y-1">
                <div className="font-bold text-white text-sm">{companyToDelete.name}</div>
                <div className="text-slate-400 font-mono text-[11px]">{companyToDelete.file_name} &bull; {companyToDelete.size_kb} KB</div>
              </div>

              {companyToDelete.is_active && (
                <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-200 text-[11px] flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Notice: This company is currently active. Deleting it will safely close your active session.</span>
                </div>
              )}

              <p className="text-slate-400 leading-relaxed">
                This action <strong className="text-red-300">cannot be undone</strong>. The database file will be permanently removed from disk.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-700">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-700 rounded-xl hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteCompany}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting File...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pt-8">
        PropBooks Investor Edition &bull; Windows Desktop Pro &bull; Local Offline Secure Storage
      </footer>
    </div>
  );
};
