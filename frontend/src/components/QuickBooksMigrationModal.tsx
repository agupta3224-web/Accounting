import React, { useState, useRef } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  FileText, 
  Users, 
  Layers, 
  ShieldCheck, 
  Scale, 
  DollarSign, 
  Landmark, 
  ArrowRight, 
  X, 
  Search, 
  HelpCircle,
  FileCheck,
  Sparkles,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { 
  QuickBooksMigrationPreviewResult, 
  QuickBooksConvertPayload, 
  QuickBooksConvertResult,
  CompanyFile
} from '../types';
import { api } from '../services/api';

interface QuickBooksMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: (company: CompanyFile) => void;
}

export const QuickBooksMigrationModal: React.FC<QuickBooksMigrationModalProps> = ({
  isOpen,
  onClose,
  onCompanyCreated
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuickBooksMigrationPreviewResult | null>(null);

  // Form State for Target Company
  const [targetCompanyName, setTargetCompanyName] = useState('');
  const [targetEin, setTargetEin] = useState('');
  const [targetNotes, setTargetNotes] = useState('');
  const [createOpeningBalances, setCreateOpeningBalances] = useState(true);
  const [importTransactions, setImportTransactions] = useState(true);

  // Active Preview Tab
  const [activeTab, setActiveTab] = useState<'classes' | 'accounts' | 'vendors' | 'transactions'>('classes');
  const [searchQuery, setSearchQuery] = useState('');

  // Conversion Success State
  const [conversionResult, setConversionResult] = useState<QuickBooksConvertResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setConversionResult(null);
    setLoading(true);

    try {
      const res = await api.previewQuickBooksMigration(selectedFile);
      setPreview(res);
      setTargetCompanyName(res.company_name || 'Migrated QuickBooks Company');
      setTargetEin('');
      setTargetNotes(`Migrated from QuickBooks file: ${selectedFile.name}`);
      setActiveTab('classes');
    } catch (err: any) {
      setError(err.message || 'Failed to parse QuickBooks migration file');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSampleIIF = async () => {
    // Built-in synthetic sample IIF file for 1-click testing
    const sampleIifContent = `!CLASS\tNAME
CLASS\tHighland Portfolio Holdings LLC
CLASS\tHighland Portfolio Holdings LLC:2908 Depot Road, Austin, TX 78701
CLASS\tHighland Portfolio Holdings LLC:415 Main St Unit 2, Austin, TX 78704
CLASS\tWestfield Commercial Partners LP
CLASS\tWestfield Commercial Partners LP:Westfield Retail Plaza Ste 100

!ACCNT\tNAME\tACCNTTYPE\tDESC\tACCNUM\tOBAL
ACCNT\tOperating Checking Account\tBANK\tPrimary Chase Operating Checking\t10010\t45000.00
ACCNT\tTenant Security Deposits\tBANK\tEscrow Security Account\t10020\t8500.00
ACCNT\tAccounts Receivable\tAR\tUncollected Rent\t12000\t2400.00
ACCNT\tAccounts Payable\tAP\tVendor Payables\t20100\t1850.00
ACCNT\tMortgage Payable - 2908 Depot\tLTLIAB\tLong-term note payable\t27010\t320000.00
ACCNT\tPartner Capital Contribution\tEQUITY\tInitial Equity\t30100\t150000.00
ACCNT\tRental Income\tINC\tGross Tenant Rent Receipts\t40100\t0.00
ACCNT\tLate Fees & Utility Reimbursements\tINC\tOther Operating Income\t40200\t0.00
ACCNT\tRepairs and Maintenance\tEXP\tProperty Repairs\t60100\t0.00
ACCNT\tRepairs and Maintenance:Plumbing Repairs\tEXP\tPlumbing Services\t60110\t0.00
ACCNT\tRepairs and Maintenance:HVAC & AC Service\tEXP\tAir Conditioning Maintenance\t60120\t0.00
ACCNT\tProperty Insurance\tEXP\tHazard and Liability Insurance\t60200\t0.00
ACCNT\tProperty Management Fees\tEXP\tMonthly management fees\t60300\t0.00
ACCNT\tReal Estate Taxes\tEXP\tCounty property taxes\t60400\t0.00

!VEND\tNAME\tPRINTAS\tADDR1\tADDR2\tCITY\tSTATE\tZIP\tPHONE1\tEMAIL\tCONT1\tTAXID\tNOTEPAD
VEND\tApex Master Plumbing LLC\tApex Master Plumbing\t1400 Industrial Blvd\tSte 200\tAustin\tTX\t78702\t(512) 555-0199\tbilling@apexmasterplumbing.com\tRobert Vance\t74-3298112\tMaster plumber, 1099 contractor
VEND\tAustin Energy Utility\tAustin Energy\t721 Barton Springs Rd\t\tAustin\tTX\t78704\t(512) 494-9400\tsupport@austinenergy.com\tCustomer Care\t\tElectric and water utility
VEND\tLone Star HVAC Specialists\tLone Star HVAC\t850 Airway Blvd\t\tAustin\tTX\t78744\t(512) 555-0344\tservice@lonestarhvac.com\tSarah Jenkins\t82-1928374\tHVAC maintenance agreement 1099
VEND\tCapital County Tax Assessor\tTravis County Tax Office\t5501 Airport Blvd\t\tAustin\tTX\t78751\t(512) 854-9473\tproperty@traviscountytax.org\tTax Collector\t\tReal estate property tax authority

!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO
!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tCLASS
!ENDTRNS
TRNS\t\tCHECK\t02/05/2026\tOperating Checking Account\tApex Master Plumbing LLC\t-680.00\t1045\tEmergency drain line clearing
SPL\t\tCHECK\t02/05/2026\tRepairs and Maintenance:Plumbing Repairs\tApex Master Plumbing LLC\t680.00\t1045\tEmergency drain line clearing\tHighland Portfolio Holdings LLC:2908 Depot Road, Austin, TX 78701
ENDTRNS
TRNS\t\tCHECK\t02/12/2026\tOperating Checking Account\tLone Star HVAC Specialists\t-425.00\t1046\tSeasonal AC inspection and filter replace
SPL\t\tCHECK\t02/12/2026\tRepairs and Maintenance:HVAC & AC Service\tLone Star HVAC Specialists\t425.00\t1046\tSeasonal AC inspection and filter replace\tHighland Portfolio Holdings LLC:415 Main St Unit 2, Austin, TX 78704
ENDTRNS`;

    const blob = new Blob([sampleIifContent], { type: 'text/plain' });
    const sampleFile = new File([blob], 'QuickBooks_Highland_Portfolio_Export.iif', { type: 'text/plain' });
    handleFileSelect(sampleFile);
  };

  const handleConvert = async () => {
    if (!preview || !targetCompanyName.trim()) return;

    setConverting(true);
    setError(null);

    const payload: QuickBooksConvertPayload = {
      company_name: targetCompanyName.trim(),
      ein: targetEin.trim() || undefined,
      notes: targetNotes.trim() || undefined,
      classes: preview.classes,
      properties: preview.properties,
      accounts: preview.accounts,
      vendors: preview.vendors,
      transactions: importTransactions ? preview.transactions : [],
      create_opening_balances: createOpeningBalances,
      import_transactions: importTransactions
    };

    try {
      const res = await api.convertQuickBooksMigration(payload);
      setConversionResult(res);
      setTimeout(() => {
        onCompanyCreated(res.active_company);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to convert QuickBooks company file');
    } finally {
      setConverting(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setConversionResult(null);
  };

  // Filtered Tab Lists
  const q = searchQuery.toLowerCase().trim();

  const filteredClasses = preview?.classes.filter(c => 
    !q || c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
  ) || [];

  const filteredAccounts = preview?.accounts.filter(a => 
    !q || 
    a.name.toLowerCase().includes(q) || 
    (a.account_number && a.account_number.includes(q)) || 
    a.type.toLowerCase().includes(q)
  ) || [];

  const filteredVendors = preview?.vendors.filter(v => 
    !q || 
    v.name.toLowerCase().includes(q) || 
    (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
    (v.tax_id && v.tax_id.includes(q))
  ) || [];

  const filteredTransactions = preview?.transactions.filter(t => 
    !q || 
    t.payee.toLowerCase().includes(q) || 
    t.account_name.toLowerCase().includes(q) || 
    (t.memo && t.memo.toLowerCase().includes(q)) ||
    (t.check_number && t.check_number.includes(q))
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md shadow-indigo-950/50">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  QuickBooks Company Converter
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  .QBW &bull; .IIF &bull; Excel &bull; Zip
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transform QuickBooks Desktop company files, IIF lists, and multi-sheet Excel reports into a native PropBooks company database.
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/60">
          
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Migration Issue Detected</div>
                <div className="leading-relaxed">{error}</div>
              </div>
            </div>
          )}

          {/* Success Result Banner */}
          {conversionResult && (
            <div className="p-5 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl space-y-3 animate-fade-in text-emerald-200">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">Company Converted Successfully!</h3>
                  <p className="text-xs text-emerald-300">
                    PropBooks has provisioned company <strong className="text-white font-mono">{conversionResult.company_name}</strong> and initialized all entities and ledgers.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-white">{conversionResult.classes_imported}</div>
                  <div className="text-[11px] text-emerald-300/80 font-semibold">LLC Entities</div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-white">{conversionResult.properties_imported}</div>
                  <div className="text-[11px] text-emerald-300/80 font-semibold">Property Assets</div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-white">{conversionResult.accounts_imported}</div>
                  <div className="text-[11px] text-emerald-300/80 font-semibold">Accounts in COA</div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-white">{conversionResult.vendors_imported}</div>
                  <div className="text-[11px] text-emerald-300/80 font-semibold">Vendors & Payees</div>
                </div>
              </div>
              <div className="text-center pt-2 text-xs font-semibold text-emerald-400 animate-pulse">
                Switching active company and loading workspace...
              </div>
            </div>
          )}

          {/* STEP 1: Upload / Drop Zone (When no valid preview is loaded) */}
          {!preview && !conversionResult && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-8 sm:p-10 text-center transition cursor-pointer group flex flex-col items-center justify-center space-y-4 shadow-lg shadow-black/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files && e.target.files[0] && handleFileSelect(e.target.files[0])}
                  accept=".qbw, .iif, .xlsx, .xls, .zip, .csv"
                  className="hidden"
                />

                <div className="p-4 bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-105 rounded-2xl border border-indigo-500/20 transition">
                  {loading ? (
                    <RefreshCw className="w-10 h-10 animate-spin text-indigo-400" />
                  ) : (
                    <Upload className="w-10 h-10 text-indigo-400" />
                  )}
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                    {loading ? 'Analyzing QuickBooks File...' : 'Drop QuickBooks Company File Here'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Supports native QuickBooks Desktop <span className="text-indigo-300 font-mono font-bold">.qbw</span> files, universal Intuit Interchange <span className="text-purple-300 font-mono font-bold">.iif</span> files, and multi-sheet Excel <span className="text-emerald-300 font-mono font-bold">.xlsx / .zip</span> packs.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    .QBW Company
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    .IIF Universal
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    .XLSX Reports
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    .ZIP Archives
                  </span>
                </div>
              </div>

              {/* 1-Click Demo / Sample Loader Button */}
              <div className="p-4 bg-slate-850 border border-slate-750 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3 text-left">
                  <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Want to test the migration engine first?</div>
                    <div className="text-[11px] text-slate-400">Load our multi-property real estate QuickBooks sample file with 2 LLCs, 3 Properties, 14 Accounts, and Vendors.</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLoadSampleIIF}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-950/40 transition shrink-0 flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample QuickBooks File</span>
                </button>
              </div>

              {/* Information / Instructions Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                    <Layers className="w-4 h-4" />
                    <span>LLCs & Properties</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    QuickBooks Classes become your legal LLC entities. Colon-separated sub-classes (e.g. <span className="text-slate-300 font-mono">LLC:2908 Depot</span>) automatically map to Property Assets with parsed addresses.
                  </p>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <Scale className="w-4 h-4" />
                    <span>Chart of Accounts</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Extracts standard 5-digit account numbers, sub-account parent hierarchies, and sets up double-entry opening balances offsetting into Opening Balance Equity.
                  </p>
                </div>

                <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                    <Users className="w-4 h-4" />
                    <span>Vendors & 1099 Info</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Captures contractor company names, Tax IDs (EIN/SSN), 1099 compliance tags, contact persons, phones, emails, and full street addresses.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* If QBW is Encrypted or Needs IIF export guidance */}
          {preview && preview.status === 'ENCRYPTED_OR_RESTRICTED' && (
            <div className="p-6 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl space-y-4 animate-fade-in text-amber-200">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">
                    QuickBooks File Protected by Enterprise Database Encryption
                  </h3>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {preview.guidance || 'This file format requires a plain export from QuickBooks Desktop.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>How to export in 30 seconds from QuickBooks Desktop:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                  <li>Open your QuickBooks Desktop file.</li>
                  <li>Go to menu bar: <strong className="text-amber-300">File &gt; Utilities &gt; Export &gt; Lists to IIF Files</strong>.</li>
                  <li>Check <em>Chart of Accounts</em>, <em>Class List</em>, and <em>Vendor List</em> (or check All).</li>
                  <li>Click <strong className="text-amber-300">OK</strong>, save the <span className="font-mono text-amber-300">.iif</span> file, and drop it here!</li>
                </ol>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={resetUpload}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Upload Exported .IIF or Excel File
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleIIF}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Try With Sample File Instead
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Interactive Preview & Conversion Configuration */}
          {preview && preview.status === 'SUCCESS' && !conversionResult && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Target Company Setup Form Card */}
              <div className="p-5 bg-slate-800/80 border border-indigo-500/30 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-indigo-400" />
                      <span>Target PropBooks Company Configuration</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure the new company file name and conversion options
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Format: {preview.format}
                    </span>
                    <button
                      type="button"
                      onClick={resetUpload}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Company File Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={targetCompanyName}
                      onChange={(e) => setTargetCompanyName(e.target.value)}
                      placeholder="e.g. Sunset Real Estate Holdings LLC"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Federal Employer ID (EIN) / Tax ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={targetEin}
                      onChange={(e) => setTargetEin(e.target.value)}
                      placeholder="XX-XXXXXXX"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Conversion Toggles */}
                <div className="flex flex-wrap items-center gap-6 pt-1 text-xs border-t border-slate-700/40">
                  <label className="flex items-center space-x-2.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={createOpeningBalances}
                      onChange={(e) => setCreateOpeningBalances(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span className="font-semibold">Create Double-Entry Starting Balances</span>
                  </label>

                  {preview.transactions.length > 0 && (
                    <label className="flex items-center space-x-2.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={importTransactions}
                        onChange={(e) => setImportTransactions(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span className="font-semibold">Import Historical Transactions ({preview.transactions.length} entries)</span>
                    </label>
                  )}
                </div>
              </div>

              {/* KPI Metrics Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
                  <div className="text-lg font-black text-indigo-400">{preview.summary.total_classes}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">LLC Entities</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
                  <div className="text-lg font-black text-purple-400">{preview.summary.total_properties}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Property Assets</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
                  <div className="text-lg font-black text-emerald-400">{preview.summary.total_accounts}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Accounts in COA</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-center">
                  <div className="text-lg font-black text-cyan-400">{preview.summary.total_vendors}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Vendors / Payees</div>
                </div>
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-center col-span-2 sm:col-span-1">
                  <div className="text-lg font-black text-amber-400">{preview.summary.total_transactions}</div>
                  <div className="text-[11px] text-slate-400 font-semibold">Transactions</div>
                </div>
              </div>

              {/* Tab Navigation and Search Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700">
                  <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setActiveTab('classes')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                        activeTab === 'classes'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Entities & Properties ({preview.classes.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('accounts')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                        activeTab === 'accounts'
                          ? 'border-emerald-500 text-emerald-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Scale className="w-4 h-4" />
                      <span>Chart of Accounts ({preview.accounts.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('vendors')}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                        activeTab === 'vendors'
                          ? 'border-cyan-500 text-cyan-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Vendors & 1099 ({preview.vendors.length})</span>
                    </button>

                    {preview.transactions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('transactions')}
                        className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center space-x-2 ${
                          activeTab === 'transactions'
                            ? 'border-amber-500 text-amber-400'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Ledger Entries ({preview.transactions.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="relative pb-2 sm:pb-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search preview data..."
                      className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-56"
                    />
                  </div>
                </div>

                {/* Tab 1 Content: Entities & Properties */}
                {activeTab === 'classes' && (
                  <div className="space-y-4">
                    {filteredClasses.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No classes or entities matched your search query.
                      </div>
                    ) : (
                      filteredClasses.map((cls, idx) => {
                        const classProps = preview.properties.filter(p => p.class_name === cls.name);
                        return (
                          <div 
                            key={idx}
                            className="p-4 bg-slate-800/50 border border-slate-700/80 rounded-xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white">{cls.name}</h4>
                                  <span className="text-[10px] text-slate-400">Class Type: {cls.entity_type || 'LLC'}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                {classProps.length} Sub-Class Properties
                              </span>
                            </div>

                            {/* Nested Properties Under This Class */}
                            {classProps.length > 0 && (
                              <div className="pl-4 border-l-2 border-indigo-500/30 space-y-2 pt-1">
                                {classProps.map((prop, pIdx) => (
                                  <div 
                                    key={pIdx}
                                    className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <div className="font-semibold text-slate-200">{prop.name}</div>
                                      <div className="text-[11px] text-slate-400">
                                        {[prop.address_line1, prop.city, prop.state, prop.zip_code].filter(Boolean).join(', ') || 'Address extracted from sub-class'}
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                      {prop.property_type || 'Residential'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab 2 Content: Chart of Accounts */}
                {activeTab === 'accounts' && (
                  <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl overflow-hidden text-xs">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-700">
                          <tr>
                            <th className="py-2.5 px-4 font-bold">Account #</th>
                            <th className="py-2.5 px-4 font-bold">Account Name</th>
                            <th className="py-2.5 px-4 font-bold">Account Type</th>
                            <th className="py-2.5 px-4 font-bold">Sub-Type</th>
                            <th className="py-2.5 px-4 font-bold text-right">Starting Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredAccounts.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                No accounts found matching search.
                              </td>
                            </tr>
                          ) : (
                            filteredAccounts.map((acct, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40 transition">
                                <td className="py-2 px-4 font-mono font-bold text-indigo-400">
                                  {acct.account_number || <span className="text-slate-500 italic">Auto</span>}
                                </td>
                                <td className="py-2 px-4 font-medium text-slate-200">
                                  {acct.level > 0 && (
                                    <span className="text-slate-500 mr-1.5">{'—'.repeat(acct.level)}</span>
                                  )}
                                  {acct.name}
                                  {acct.is_repair_category && (
                                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                      Repair
                                    </span>
                                  )}
                                  {acct.is_rental_income && (
                                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                      Rent
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-4">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                    {acct.type}
                                  </span>
                                </td>
                                <td className="py-2 px-4 text-slate-400">{acct.sub_type || '—'}</td>
                                <td className="py-2 px-4 text-right font-mono font-bold text-slate-200">
                                  {Math.abs(acct.balance_total || 0) > 0 ? (
                                    <span className={acct.balance_total! > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      ${Number(acct.balance_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">$0.00</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 3 Content: Vendors & 1099 Payees */}
                {activeTab === 'vendors' && (
                  <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl overflow-hidden text-xs">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-700">
                          <tr>
                            <th className="py-2.5 px-4 font-bold">Vendor ID</th>
                            <th className="py-2.5 px-4 font-bold">Company / Contractor</th>
                            <th className="py-2.5 px-4 font-bold">Tax ID (1099)</th>
                            <th className="py-2.5 px-4 font-bold">Contact / Phone</th>
                            <th className="py-2.5 px-4 font-bold">Address</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredVendors.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                No vendors found matching search.
                              </td>
                            </tr>
                          ) : (
                            filteredVendors.map((vend, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40 transition">
                                <td className="py-2 px-4 font-mono font-bold text-cyan-400">
                                  {vend.account_number}
                                </td>
                                <td className="py-2 px-4 font-medium text-slate-200">
                                  <div>{vend.name}</div>
                                  {vend.notes && <div className="text-[10px] text-slate-400 italic">{vend.notes}</div>}
                                </td>
                                <td className="py-2 px-4 font-mono">
                                  {vend.tax_id ? (
                                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/20 font-bold">
                                      {vend.tax_id}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-slate-300">
                                  <div>{vend.contact_person || '—'}</div>
                                  {vend.phone && <div className="text-[10px] text-slate-400">{vend.phone}</div>}
                                </td>
                                <td className="py-2 px-4 text-slate-400">
                                  {[vend.address_line1, vend.city, vend.state, vend.zip_code].filter(Boolean).join(', ') || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 4 Content: Transactions */}
                {activeTab === 'transactions' && (
                  <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl overflow-hidden text-xs">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left">
                        <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-700">
                          <tr>
                            <th className="py-2.5 px-4 font-bold">Date</th>
                            <th className="py-2.5 px-4 font-bold">Doc #</th>
                            <th className="py-2.5 px-4 font-bold">Payee</th>
                            <th className="py-2.5 px-4 font-bold">Account</th>
                            <th className="py-2.5 px-4 font-bold">Class / Property</th>
                            <th className="py-2.5 px-4 font-bold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                No transactions found matching search.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((txn, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40 transition">
                                <td className="py-2 px-4 font-mono text-slate-400">{txn.date}</td>
                                <td className="py-2 px-4 font-mono font-semibold text-slate-300">
                                  {txn.check_number || '—'}
                                </td>
                                <td className="py-2 px-4 font-medium text-slate-200">{txn.payee || '—'}</td>
                                <td className="py-2 px-4 text-indigo-300">{txn.account_name}</td>
                                <td className="py-2 px-4 text-slate-400">
                                  {[txn.class_name, txn.property_name].filter(Boolean).join(': ') || 'General'}
                                </td>
                                <td className="py-2 px-4 text-right font-mono font-bold text-slate-200">
                                  ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {preview && preview.status === 'SUCCESS' ? (
              <span>Ready to provision <strong className="text-white">{targetCompanyName}</strong></span>
            ) : (
              <span>QuickBooks Migration Hub &bull; 100% Offline Desktop Processing</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            {preview && preview.status === 'SUCCESS' && !conversionResult && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={converting || !targetCompanyName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {converting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Provisioning Company Database...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Convert & Open Company File</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
