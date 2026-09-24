import React from 'react';
import { Sparkles, Clock, AlertTriangle, Key, ArrowRight } from 'lucide-react';
import { LicenseStatus } from '../types';

interface LicenseBannerProps {
  licenseStatus: LicenseStatus | null;
  onOpenLicenseModal: () => void;
}

export const LicenseBanner: React.FC<LicenseBannerProps> = ({
  licenseStatus,
  onOpenLicenseModal
}) => {
  if (!licenseStatus) return null;

  // If license is active and not expiring soon, no banner needed
  if (licenseStatus.status === 'ACTIVE' && !licenseStatus.is_expiring_soon) {
    return null;
  }

  const isTrial = licenseStatus.is_trial;
  const isExpired = licenseStatus.status === 'EXPIRED';
  const daysLeft = licenseStatus.days_remaining;

  return (
    <div className={`px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b font-medium ${
      isExpired
        ? 'bg-rose-950 text-rose-200 border-rose-800'
        : isTrial
        ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-amber-200 border-amber-800/60'
        : 'bg-amber-900/60 text-amber-100 border-amber-700'
    }`}>
      <div className="flex items-center space-x-2">
        {isExpired ? (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        ) : isTrial ? (
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span>
          {isExpired ? (
            <span><strong>Subscription Expired:</strong> Please activate your monthly ($9.99/mo) or annual ($100/yr) license key to continue full operations.</span>
          ) : isTrial ? (
            <span><strong>21-Day Free Trial:</strong> You have <strong>{daysLeft} days remaining</strong>. New subscribers get <strong className="text-emerald-400">$9.99/mo</strong> or <strong className="text-emerald-400">$100/yr special offer</strong>!</span>
          ) : (
            <span><strong>Subscription Expiring Soon:</strong> {daysLeft} days remaining on your license.</span>
          )}
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenLicenseModal}
          className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-bold rounded-lg shadow-sm transition cursor-pointer text-[11px]"
        >
          <Key className="w-3 h-3" />
          <span>{isExpired ? 'Renew License' : 'Upgrade / Enter Key'}</span>
        </button>
      </div>
    </div>
  );
};
