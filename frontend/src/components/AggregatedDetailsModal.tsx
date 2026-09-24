import React from 'react';
import { X, Layers, CheckCircle2, DollarSign, Calendar } from 'lucide-react';
import { Transaction } from '../types';

interface AggregatedDetailsModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const AggregatedDetailsModal: React.FC<AggregatedDetailsModalProps> = ({
  transaction,
  onClose
}) => {
  if (!transaction || !transaction.is_aggregated || !transaction.raw_aggregated_items) {
    return null;
  }

  const items = transaction.raw_aggregated_items;
  const total = items.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Aggregated Rental Income Breakdown</h3>
              <p className="text-xs text-slate-400">
                {transaction.property_name} &bull; Month: {transaction.month}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-800 font-medium">
              Property Manager Consolidation Rule applied: {items.length} individual rent items merged into 1 top-level row.
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Consolidated Total</span>
            <span className="text-base font-bold font-mono text-emerald-700">
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Sub-items Table */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Line Item / Unit</th>
                <th className="py-2.5 px-3">Description / Tenant</th>
                <th className="py-2.5 px-3 text-right">Amount ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((sub, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                    {sub.date}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800 text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-xs">
                      {sub.account_name}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {sub.description || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 text-xs">
                    +${sub.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold bg-slate-50/50">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-right text-xs uppercase text-slate-600">
                  Total Consolidated Sum:
                </td>
                <td className="py-3 px-3 text-right font-mono text-sm text-emerald-700">
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};
