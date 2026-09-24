import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, RefreshCw, FileCheck } from 'lucide-react';
import { api } from '../services/api';
import { CoaImportResult } from '../types';

interface CoaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CoaImportModal: React.FC<CoaImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoaImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setResult(null);
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
      setError('Please upload a valid .csv file.');
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawText(text);
      parsePreview(text);
    };
    reader.readAsText(selectedFile);
  };

  const parsePreview = (text: string) => {
    const lines = text.trim().split(/\r?\n/).slice(0, 8);
    const parsed = lines.map(line => {
      // simple CSV splitter
      const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });
    setCsvPreview(parsed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file && !rawText) {
      setError('Please choose a CSV file to import.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let res: CoaImportResult;

      if (file) {
        res = await api.importAccountsCsv(file);
      } else {
        res = await api.importAccountsRawCsv(rawText);
      }

      setResult(res);
      if (res.success && (!res.errors || res.errors.length === 0)) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Import failed. Please check the file formatting.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open(api.getAccountsTemplateUrl(), '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-white my-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Import Chart of Accounts</h3>
              <p className="text-xs text-slate-400">Upload your existing real estate accounts from CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Template helper banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-200">Need a pre-formatted template?</span>
              <p className="text-slate-400">Download our sample CSV template with 1xxxx–9xxxx standard accounting numbers.</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-emerald-300 rounded-lg font-semibold transition cursor-pointer flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Import Result Feedback */}
          {result && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              result.errors && result.errors.length > 0 
                ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-sm">
                {result.errors && result.errors.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>{result.message}</span>
              </div>
              <div className="flex space-x-4 text-xs font-mono pt-1">
                <span>Created: <strong>{result.imported_count}</strong></span>
                <span>Updated: <strong>{result.updated_count}</strong></span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-800/50">
                  <span className="font-bold text-amber-300 block mb-1">Warnings / Validation notices:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-300/90 max-h-24 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2.5 ${
              isDragOver
                ? 'border-cyan-500 bg-cyan-950/20'
                : file
                ? 'border-emerald-500/60 bg-emerald-950/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="p-3 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {file ? <FileCheck className="w-6 h-6 text-emerald-400" /> : <Upload className="w-6 h-6 text-cyan-400" />}
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                {file ? file.name : 'Click to upload or drag & drop CSV'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports standard accounting headers (Account #, Name, Type, Sub-Type, Description)'}
              </p>
            </div>
          </div>

          {/* CSV Quick Preview */}
          {csvPreview.length > 0 && (
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-2">CSV Data Preview (First few rows):</span>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto max-h-48 text-[11px] font-mono">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                      {csvPreview[0].map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold truncate max-w-36">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 truncate max-w-36 text-slate-300">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || (!file && !rawText)}
              className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-xl shadow-lg shadow-cyan-950/50 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Import Accounts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

