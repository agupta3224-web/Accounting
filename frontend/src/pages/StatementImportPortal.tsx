import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, 
  ArrowRight, RefreshCw, Layers, Check, HelpCircle, Download, FileCheck, 
  Sliders, Eye, Sparkles, Building, ChevronRight, Landmark, CheckSquare
} from 'lucide-react';
import { 
  Property, 
  ClassEntity, 
  Category,
  PreviewData, 
  ColumnMapping, 
  StatementRecord, 
  SampleStatementFile,
  BankStatementRecord,
  SampleBankStatementFile
} from '../types';
import { api } from '../services/api';
import { BankImportWizardModal } from '../components/banking/BankImportWizardModal';
import { BankRulesModal } from '../components/banking/BankRulesModal';

interface StatementImportPortalProps {
  properties: Property[];
  classes: ClassEntity[];
  categories?: Category[];
  onImportSuccess: () => void;
}

export const StatementImportPortal: React.FC<StatementImportPortalProps> = ({
  properties,
  classes,
  categories = [],
  onImportSuccess
}) => {
  const [activePortalTab, setActivePortalTab] = useState<'PM' | 'BANK'>('PM');
  const [isBankWizardOpen, setIsBankWizardOpen] = useState(false);
  const [isBankRulesOpen, setIsBankRulesOpen] = useState(false);
  const [bankStatementsHistory, setBankStatementsHistory] = useState<BankStatementRecord[]>([]);
  const [bankSamples, setBankSamples] = useState<SampleBankStatementFile[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [targetPropertyId, setTargetPropertyId] = useState<number | ''>(properties[0]?.id || '');
  const [targetClassId, setTargetClassId] = useState<number | ''>('');
  const [aggregateRentalIncome, setAggregateRentalIncome] = useState<boolean>(true);

  const [uploading, setUploading] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statementsHistory, setStatementsHistory] = useState<StatementRecord[]>([]);
  const [sampleFiles, setSampleFiles] = useState<SampleStatementFile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistoryAndSamples = async () => {
    try {
      setLoadingHistory(true);
      const [history, samples, bHistory, bSamples] = await Promise.all([
        api.getStatements(),
        api.getSampleStatements(),
        api.getBankStatements().catch(() => []),
        api.getSampleBankStatements().catch(() => [])
      ]);
      setStatementsHistory(history);
      setSampleFiles(samples);
      setBankStatementsHistory(bHistory);
      setBankSamples(bSamples);
    } catch (err) {
      console.error('Failed to load history/samples:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndSamples();
  }, []);
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setSuccessMessage(null);
    setUploading(true);

    try {
      const data = await api.uploadStatementPreview(file);
      setPreviewData(data);
      setColumnMapping(data.suggested_mapping || {});
    } catch (err: any) {
      setError(err.message || 'Failed to upload and parse statement');
      setPreviewData(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleTestSample = async (sampleFileName: string) => {
    try {
      setUploading(true);
      setError(null);
      const res = await fetch(api.getSampleDownloadUrl(sampleFileName));
      const blob = await res.blob();
      const file = new File([blob], sampleFileName, { type: blob.type || 'text/csv' });
      await handleFileChange(file);
    } catch (err: any) {
      setError(`Failed to load sample ${sampleFileName}: ${err.message}`);
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !selectedFile) return;

    if (!targetPropertyId) {
      setError('Please choose a target property for this statement.');
      return;
    }

    try {
      setConfirming(true);
      setError(null);

      const res = await api.confirmStatementImport({
        filename: selectedFile.name,
        property_id: Number(targetPropertyId),
        class_id: targetClassId ? Number(targetClassId) : null,
        column_mapping: columnMapping,
        aggregate_rental_income: aggregateRentalIncome,
        raw_file_content_id: previewData.cache_id,
      });

      setSuccessMessage(res.message);
      setPreviewData(null);
      setSelectedFile(null);
      fetchHistoryAndSamples();
      onImportSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm statement import');
    } finally {
      setConfirming(false);
    }
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Statement Importing Portal</span>
              <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-1 rounded-full flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Dynamic Auto-Mapper</span>
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload property manager statements (PDF, Excel, CSV). Columns are dynamically mapped and multi-unit rents automatically aggregated into a single top-level row.
            </p>
          </div>

          {/* 1-Click Sample Testing Preset Buttons */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Click Test:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleTestSample('AppFolio_SunsetPalms_April2026.csv')}
                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-slate-700 shadow-2xs transition cursor-pointer"
              >
                AppFolio Multi-Unit (CSV)
              </button>
              <button
                type="button"
                onClick={() => handleTestSample('Buildium_Oakridge_April2026.xlsx')}
                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-slate-700 shadow-2xs transition cursor-pointer"
              >
                Buildium Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => handleTestSample('HighlandHeights_April2026.csv')}
                className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-slate-700 shadow-2xs transition cursor-pointer"
              >
                Highland Heights (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActivePortalTab('PM')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
            activePortalTab === 'PM'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Property Management Statements (AppFolio, Buildium)</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePortalTab('BANK')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
            activePortalTab === 'BANK'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Statements & Check Register (Chase, Wells Fargo, BofA)</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* PM Statements Section */}
      {activePortalTab === 'PM' && (
        <>
          {/* Main Upload Dropzone */}
          {!previewData && (
            <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-2xl p-12 text-center cursor-pointer transition duration-150 flex flex-col items-center justify-center space-y-4 shadow-2xs group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
            accept=".csv, .xlsx, .xls, .pdf"
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition">
            {uploading ? (
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-800">
              {uploading ? 'Analyzing and mapping statement columns...' : 'Drop your Property Manager statement here'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports <span className="font-semibold text-slate-700">PDF, Excel (.xlsx, .xls)</span>, and <span className="font-semibold text-slate-700">CSV</span> statements
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span className="flex items-center space-x-1"><FileSpreadsheet className="w-3.5 h-3.5" /> <span>Auto Column Matching</span></span>
            <span>&bull;</span>
            <span className="flex items-center space-x-1"><Layers className="w-3.5 h-3.5" /> <span>Rental Consolidation Rules</span></span>
          </div>
        </div>
      )}
      {/* Dynamic Column Mapping & Preview View */}
      {previewData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-mono text-xs font-bold rounded-lg">
                  {previewData.filename}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({previewData.total_rows_detected} rows detected)
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Dynamic Column Mapping & Consolidation Preview
              </h2>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel / Choose Another
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={confirming}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-md shadow-emerald-900/20 transition flex items-center space-x-2 cursor-pointer"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Rules & Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Import Transactions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
            {/* Target Property */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Target Property *</span>
              </label>
              <select
                value={targetPropertyId}
                onChange={e => setTargetPropertyId(Number(e.target.value))}
                className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="">Select Property</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.units_count} units)</option>
                ))}
              </select>
            </div>

            {/* Target Class */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Default Class / Segment</span>
              </label>
              <select
                value={targetClassId}
                onChange={e => setTargetClassId(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="">General Property Level</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* PROPERTY MANAGER CONSOLIDATION RULE TOGGLE */}
            <div className="flex flex-col justify-between">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rental Income Consolidation Rule</span>
              </label>
              <label className="flex items-center space-x-2.5 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                <input
                  type="checkbox"
                  checked={aggregateRentalIncome}
                  onChange={e => setAggregateRentalIncome(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700 font-medium leading-tight">
                  Auto-aggregate multi-row rental income into a single <span className="font-bold text-emerald-800">"Rental Income"</span> line item
                </span>
              </label>
            </div>
          </div>

          {/* Dynamic Column Mappers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Dynamic Field Mappings (Auto-Detected & Editable)</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Matches columns even if statement layouts change
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Date */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Date Column</span>
                <select
                  value={columnMapping.date_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, date_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Account / Category */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Account / Category</span>
                <select
                  value={columnMapping.account_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, account_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Description / Payee */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Description / Memo</span>
                <select
                  value={columnMapping.description_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, description_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Amount (Net) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Single Amount Col</span>
                <select
                  value={columnMapping.amount_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, amount_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Debit Col */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Debit / Expense Col</span>
                <select
                  value={columnMapping.debit_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, debit_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Credit Col */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Credit / Income Col</span>
                <select
                  value={columnMapping.credit_col || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, credit_col: e.target.value || null })}
                  className="w-full text-xs font-mono font-medium rounded border border-slate-300 p-1.5 bg-white text-slate-800"
                >
                  <option value="">-- None --</option>
                  {previewData.available_columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Raw Parsed Rows Preview */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center space-x-1">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Sample Parsed Rows Preview (First 10 Rows)</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {previewData.available_columns.map((h, idx) => (
                      <th key={idx} className="py-2 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewData.preview_rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition">
                      {previewData.available_columns.map((colKey, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {String(row[colKey] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Statement Upload & Consolidation History</span>
            </h3>
            <p className="text-xs text-slate-500">Log of imported statements and aggregated rental line items</p>
          </div>
          <button
            onClick={fetchHistoryAndSamples}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {statementsHistory.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No statements imported yet. Upload a statement or run a 1-Click test above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Filename</th>
                  <th className="py-2.5 px-3">Format</th>
                  <th className="py-2.5 px-3">Property</th>
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Transactions</th>
                  <th className="py-2.5 px-3">Rental Rows Consolidated</th>
                  <th className="py-2.5 px-3">Import Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statementsHistory.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center space-x-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{st.filename}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                        {st.file_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{st.property_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{st.month || '?'}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{st.row_count}</td>
                    <td className="py-2.5 px-3">
                      {st.consolidated_count > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {st.consolidated_count} rent rows aggregated
                        </span>
                      ) : (
                        <span className="text-slate-400">?</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{st.upload_date ? new Date(st.upload_date).toLocaleDateString() : '?'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Bank Statements Section */}
      {activePortalTab === 'BANK' && (
        <div className="space-y-6">
          {/* Hero Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2">
                  <span className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </span>
                  <h2 className="text-xl font-bold">Bank Statement & Transaction Import Wizard</h2>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Import bank statements directly in CSV or PDF format. The intelligent parser extracts check numbers, vendor details (e.g. <span className="text-emerald-400 font-mono">"Check 1042 Joe's plumbing 500"</span>), matches expense accounts, auto-creates new vendors, and downloads disbursements directly into your check register.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBankRulesOpen(true)}
                  className="px-4 py-2.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Automated Rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBankWizardOpen(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition flex items-center space-x-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Launch Import Wizard (CSV / PDF)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sample Bank Statements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Sample Bank Statements (1-Click Test & Download)</span>
              </h3>
              <span className="text-xs text-slate-500">Test parser directly with pre-configured sample bank files</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bankSamples.map((s) => (
                <div key={s.filename} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        s.format === 'PDF' 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {s.format}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{s.bank_name}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{s.account_title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBankWizardOpen(true)}
                      className="flex-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer border border-emerald-200"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Open in Wizard</span>
                    </button>

                    <a
                      href={api.getSampleBankStatementDownloadUrl(s.filename)}
                      download={s.filename}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition"
                      title="Download sample file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Past Bank Statements History Table */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Imported Bank Statements History</h3>
                <p className="text-xs text-slate-500">History of statements parsed into the check register and GL</p>
              </div>
              <button
                type="button"
                onClick={fetchHistoryAndSamples}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {bankStatementsHistory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No bank statements imported yet. Click "Launch Import Wizard" above to import your first CSV or PDF statement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Filename</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3">Bank Account</th>
                      <th className="py-2.5 px-3">Checks / Debits</th>
                      <th className="py-2.5 px-3">Deposits</th>
                      <th className="py-2.5 px-3">Total Rows</th>
                      <th className="py-2.5 px-3">Import Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bankStatementsHistory.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center space-x-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.filename}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                            {b.file_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{b.bank_account_display || b.bank_account_name}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-rose-600">{b.checks_count}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-600">{b.deposits_count}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{b.row_count}</td>
                        <td className="py-2.5 px-3 text-slate-500">{b.upload_date ? new Date(b.upload_date).toLocaleDateString() : '?'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bank Statement Import Wizard Modal */}
      <BankImportWizardModal
        isOpen={isBankWizardOpen}
        onClose={() => setIsBankWizardOpen(false)}
        onSuccess={() => {
          setIsBankWizardOpen(false);
          fetchHistoryAndSamples();
          onImportSuccess();
        }}
        categories={categories}
        properties={properties}
        classes={classes}
      />

      {/* Automated Bank Rules Modal */}
      <BankRulesModal
        isOpen={isBankRulesOpen}
        onClose={() => setIsBankRulesOpen(false)}
        categories={categories}
        properties={properties}
        classes={classes}
      />

    </div>
  );
};
