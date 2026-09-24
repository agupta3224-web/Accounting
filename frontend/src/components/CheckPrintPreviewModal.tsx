import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { api } from '../services/api';
import { CheckRecord } from '../types';

interface CheckPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  check: CheckRecord | null;
}

export const CheckPrintPreviewModal: React.FC<CheckPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  check
}) => {
  if (!isOpen || !check) return null;

  const printUrl = api.getCheckPrintVoucherUrl(check.id);

  const handlePrint = () => {
    const printWindow = window.open(printUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Print Check Voucher #{check.check_number}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embedded Iframe Preview */}
        <div className="p-4 flex-1 bg-slate-950/60 overflow-hidden min-h-[500px]">
          <iframe
            src={printUrl}
            title={`Check Voucher #${check.check_number}`}
            className="w-full h-full min-h-[500px] rounded-xl border border-slate-700 bg-white"
          />
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Formatted to QuickBooks Desktop 3-part check voucher specifications</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
