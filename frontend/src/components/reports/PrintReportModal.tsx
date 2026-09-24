import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Layout, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Sliders,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { 
  SystemPrinter, 
  PrintOrientation, 
  PrintDuplexMode, 
  PrintPageFit, 
  PrintReportConfig, 
  DateRangePreset 
} from '../../types';
import { api } from '../../services/api';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportParams: {
    company_id?: number;
    class_id?: number;
    property_id?: number;
    preset?: DateRangePreset;
    year?: number;
    month?: string;
    quarter?: number;
    half?: number;
    fiscal_start_month?: number;
    from_date?: string;
    to_date?: string;
    compare_prior?: boolean;
  };
  periodLabel?: string;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  reportParams,
  periodLabel = 'Selected Period'
}) => {
  const [printers, setPrinters] = useState<SystemPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState<boolean>(true);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  
  // Print configuration state
  const [orientation, setOrientation] = useState<PrintOrientation>(
    reportParams.compare_prior ? 'landscape' : 'portrait'
  );
  const [duplex, setDuplex] = useState<PrintDuplexMode>('none');
  const [pageFit, setPageFit] = useState<PrintPageFit>('fit_one_page_wide');
  const [pagePerProperty, setPagePerProperty] = useState<boolean>(false);
  const [includeSummary, setIncludeSummary] = useState<boolean>(true);
  const [includeComparison, setIncludeComparison] = useState<boolean>(
    reportParams.compare_prior ?? true
  );

  // Active printer object
  const activePrinter = printers.find(p => p.name === selectedPrinter);

  // Fetch installed Windows printers on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrinters = async () => {
      try {
        setLoadingPrinters(true);
        const list = await api.getPrinters();
        setPrinters(list);
        if (list.length > 0) {
          const defaultPrn = list.find(p => p.is_default) || list[0];
          setSelectedPrinter(defaultPrn.name);
          if (defaultPrn.supports_duplex) {
            setDuplex('long_edge');
          }
        }
      } catch (err) {
        console.error('Failed to load system printers:', err);
      } finally {
        setLoadingPrinters(false);
      }
    };

    fetchPrinters();
  }, [isOpen]);

  if (!isOpen) return null;

  // Build print URL
  const printConfig = {
    orientation,
    duplex,
    page_fit: pageFit,
    page_per_property: pagePerProperty,
    include_summary: includeSummary,
    target_printer: selectedPrinter
  };

  const previewUrl = api.getConcisePnlPrintUrl(
    { ...reportParams, compare_prior: includeComparison },
    { ...printConfig, autoprint: false }
  );

  const directPrintUrl = api.getConcisePnlPrintUrl(
    { ...reportParams, compare_prior: includeComparison },
    { ...printConfig, autoprint: true }
  );

  const handlePrintNow = () => {
    // Open print view in new window which will trigger window.print()
    const printWindow = window.open(directPrintUrl, '_blank', 'width=1100,height=850');
    if (printWindow) {
      printWindow.focus();
    }
    onClose();
  };

  const handleOpenFullPreview = () => {
    window.open(previewUrl, '_blank', 'width=1200,height=900');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center space-x-2">
                <span>Print Financial Report</span>
                <span className="text-xs font-normal text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
                  {periodLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure destination printer, orientation, double-sided printing, and layout parsing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SECTION 1: WINDOWS PRINTER SELECTION */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Destination Printer (Setup on this Machine):</span>
              </label>
              {loadingPrinters && (
                <span className="text-xs text-slate-500 animate-pulse">Detecting Windows printers...</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <select
                  value={selectedPrinter}
                  onChange={(e) => {
                    const prn = printers.find(p => p.name === e.target.value);
                    setSelectedPrinter(e.target.value);
                    if (prn?.supports_duplex && duplex === 'none') {
                      setDuplex('long_edge');
                    }
                  }}
                  className="w-full bg-white border border-slate-300 text-slate-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.is_default ? '★ (Windows Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Printer Capability Badges */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-center space-y-1 text-xs">
                {activePrinter ? (
                  <>
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{activePrinter.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {activePrinter.supports_duplex ? (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                          ✓ Duplex Ready
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                          Simplex
                        </span>
                      )}
                      {activePrinter.supports_color && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                          Color
                        </span>
                      )}
                      {activePrinter.is_default && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400 italic">No printer selected</span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: ORIENTATION (PORTRAIT VS LANDSCAPE) */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Layout className="w-4 h-4 text-emerald-600" />
              <span>Page Orientation:</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              {/* Portrait Card */}
              <div
                onClick={() => setOrientation('portrait')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center space-x-3.5 ${
                  orientation === 'portrait'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-9 h-12 border-2 border-slate-700 rounded bg-white flex flex-col justify-between p-1 shrink-0">
                  <div className="w-full h-1 bg-slate-400 rounded-xs" />
                  <div className="space-y-0.5">
                    <div className="w-full h-0.5 bg-slate-300 rounded-xs" />
                    <div className="w-3/4 h-0.5 bg-slate-300 rounded-xs" />
                  </div>
                  <div className="w-1/2 h-1 bg-emerald-500 rounded-xs" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">Portrait (Vertical)</div>
                  <div className="text-xs text-slate-500">Standard 8.5" × 11" document format</div>
                </div>
              </div>

              {/* Landscape Card */}
              <div
                onClick={() => setOrientation('landscape')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center space-x-3.5 ${
                  orientation === 'landscape'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-12 h-9 border-2 border-slate-700 rounded bg-white flex flex-col justify-between p-1 shrink-0">
                  <div className="w-full h-1 bg-slate-400 rounded-xs" />
                  <div className="space-y-0.5">
                    <div className="w-full h-0.5 bg-slate-300 rounded-xs" />
                    <div className="w-3/4 h-0.5 bg-slate-300 rounded-xs" />
                  </div>
                  <div className="w-1/2 h-1 bg-emerald-500 rounded-xs" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <span>Landscape (Horizontal)</span>
                    {reportParams.compare_prior && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">11" × 8.5" wide view • Best for Prior Period comparisons</div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DOUBLE-SIDED (DUPLEX) PRINTING */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Copy className="w-4 h-4 text-emerald-600" />
              <span>Double-Sided (Duplex) Printing:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { 
                  id: 'none', 
                  title: '1-Sided (Simplex)', 
                  desc: 'Prints only on front side of each page' 
                },
                { 
                  id: 'long_edge', 
                  title: '2-Sided (Long Edge)', 
                  desc: 'Standard booklet flip (Portrait long side)' 
                },
                { 
                  id: 'short_edge', 
                  title: '2-Sided (Short Edge)', 
                  desc: 'Tablet flip (Landscape or top-bound)' 
                }
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setDuplex(opt.id as PrintDuplexMode)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition ${
                    duplex === opt.id
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                    <input
                      type="radio"
                      name="duplex_mode"
                      checked={duplex === opt.id}
                      onChange={() => setDuplex(opt.id as PrintDuplexMode)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: DATA PARSING & PAGE FITTING */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Data Layout Across Report (Page Fitting & Readability):</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Fit 1 Page Wide */}
              <div
                onClick={() => setPageFit('fit_one_page_wide')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  pageFit === 'fit_one_page_wide'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <span>Fit Report 1 Page Wide</span>
                    <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded">
                      Compact
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="page_fit"
                    checked={pageFit === 'fit_one_page_wide'}
                    onChange={() => setPageFit('fit_one_page_wide')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically scales table columns so all financial categories and comparison amounts fit horizontally without side clipping or awkward column wrapping.
                </p>
              </div>

              {/* Option B: Multi-Page High Readability */}
              <div
                onClick={() => setPageFit('multi_page_readable')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  pageFit === 'multi_page_readable'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                    <span>Multi-Page High Readability</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Standard Spacing
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="page_fit"
                    checked={pageFit === 'multi_page_readable'}
                    onChange={() => setPageFit('multi_page_readable')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Larger high-contrast font size (11-12pt) and comfortable row padding. Table column headers repeat automatically on every page. Ideal for investor presentations.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 5: PAGINATION & CONTENT TOGGLES */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-700">
              Additional Page & Content Options:
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer select-none bg-white p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition">
                <input
                  type="checkbox"
                  checked={pagePerProperty}
                  onChange={(e) => setPagePerProperty(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Print each property on its own page</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none bg-white p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Include KPI Executive Summary Cards</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none bg-white p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition">
                <input
                  type="checkbox"
                  checked={includeComparison}
                  onChange={(e) => setIncludeComparison(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">Include Prior Period Variance</span>
              </label>
            </div>
          </div>

          {/* Live Preview Frame Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Report Print Preview:</span>
              </span>
              <button
                onClick={handleOpenFullPreview}
                className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Open Full Window Preview</span>
              </button>
            </div>
            
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-100 h-64 relative shadow-inner">
              <iframe
                src={previewUrl}
                title="Print Preview Frame"
                className="w-full h-full border-none bg-white"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Clicking <strong>Print Report</strong> will open the print preview and invoke your system printer dialog.
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleOpenFullPreview}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center space-x-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Screen View</span>
            </button>

            <button
              onClick={handlePrintNow}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
