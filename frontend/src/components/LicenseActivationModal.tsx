import React, { useState } from 'react';
import { 
  ShieldCheck, Key, Sparkles, CheckCircle2, AlertCircle, 
  X, Lock, Calendar, CreditCard, ArrowRight, ShieldAlert, Zap
} from 'lucide-react';
import { LicenseStatus } from '../types';
import { api } from '../services/api';

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseStatus: LicenseStatus | null;
  onLicenseUpdated: () => void;
}

export const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({
  isOpen,
  onClose,
  licenseStatus,
  onLicenseUpdated
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await api.activateLicense(keyInput.trim());
      setSuccess('License activated successfully! Full features unlocked.');
      setKeyInput('');
      onLicenseUpdated();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to activate license key');
    } finally {
      setLoading(false);
    }
  };

  const pricing = licenseStatus?.pricing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 animate-in fade-in zoom-in-95 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-emerald-500 rounded-2xl text-slate-950 font-bold shadow-lg shadow-emerald-950/50">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <span>PropBooks Desktop Pro Licensing</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Investor Edition
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage your subscription or activate an installation key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current License Status Card */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Status</span>
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                licenseStatus?.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : licenseStatus?.is_trial ? 'bg-amber-400' : 'bg-rose-500'
              }`} />
              <span className="font-bold text-sm text-white">{licenseStatus?.plan_display || '21-Day Free Trial'}</span>
            </div>
            {licenseStatus?.expires_at && (
              <p className="text-xs text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Expires: <strong className="text-slate-300">{licenseStatus.expires_at}</strong> ({licenseStatus.days_remaining} days remaining)</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold ${
              licenseStatus?.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              {licenseStatus?.status === 'ACTIVE' ? 'Verified License' : '21-Day Trial Active'}
            </span>
          </div>
        </div>

        {/* Promotional Subscription Pricing Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Special Introductory Pricing (New Subscribers)</span>
            </span>
            <span className="text-[11px] text-amber-300 font-semibold bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
              Limited Time Launch Offer
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly Promo Card */}
            <div className="bg-gradient-to-b from-slate-800 to-slate-800/80 border border-slate-700 hover:border-emerald-500/60 rounded-2xl p-4 space-y-3 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Monthly Pro Plan</span>
                <span className="text-[10px] line-through text-slate-500 font-mono">${pricing?.monthly_standard_price || 19.99}/mo</span>
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-white font-mono">${pricing?.monthly_promo_price || 9.99}</span>
                  <span className="text-xs text-slate-400 font-medium">/ month</span>
                </div>
                <p className="text-[11px] text-emerald-400 font-medium mt-0.5">Special for new subscribers</p>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-700/60">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Full unlimited property & LLC tracking</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>AI statement parser & auto-mapper</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Auto-backup on exit</span>
                </li>
              </ul>
            </div>

            {/* Annual Promo Card */}
            <div className="bg-gradient-to-b from-slate-800 to-slate-800/80 border-2 border-emerald-500/80 hover:border-emerald-400 rounded-2xl p-4 space-y-3 relative shadow-lg shadow-emerald-950/40">
              <div className="absolute -top-2.5 right-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full shadow-md">
                Best Value &bull; Save 55%
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Annual Pro Plan (1st Year)</span>
                <span className="text-[10px] line-through text-slate-500 font-mono">${pricing?.annual_standard_price || 190.00}/yr</span>
              </div>
              <div>
                <div className="flex items-baseline space-x-1">
                  <span className="text-3xl font-black text-emerald-400 font-mono">${pricing?.annual_promo_price || 100.00}</span>
                  <span className="text-xs text-slate-400 font-medium">/ 1st year</span>
                </div>
                <p className="text-[11px] text-teal-300 font-medium mt-0.5">$8.33 / mo equivalent</p>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-700/60">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>All Monthly Pro features included</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>365-day offline installation key</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Priority investor support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Enter License Key Form */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
            <Key className="w-4 h-4 text-emerald-400" />
            <span>Activate License Installation Key</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Paste the signed installation key sent to your email after subscription purchase (e.g. <span className="font-mono text-emerald-300">PBKS-ANN-XXXX-XXXX</span>):
          </p>

          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleActivate} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Paste License Key (PBKS-...)"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              className="flex-1 text-xs font-mono rounded-xl border border-slate-700 bg-slate-950 text-emerald-300 px-3.5 py-2.5 outline-hidden focus:ring-2 focus:ring-emerald-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Activate License'}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
