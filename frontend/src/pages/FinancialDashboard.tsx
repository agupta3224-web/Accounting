import React, { useState, useEffect } from 'react';
import { 
  Building, Calendar, DollarSign, TrendingUp, Wrench, Download, 
  ArrowUpRight, ArrowDownRight, Layers, PieChart as PieIcon, BarChart3, Eye,
  Landmark, Shield, Home, MapPin, ExternalLink, Filter, RotateCcw, CheckSquare,
  HelpCircle, ChevronDown, Printer
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Company, ClassEntity, Property, ConcisePnlResponse, ConcisePropertyReport, DateRangePreset, ConsolidatedCategoryLineItem 
} from '../types';
import { api } from '../services/api';
import { CategoryDrilldownModal } from '../components/CategoryDrilldownModal';
import { PrintReportModal } from '../components/reports/PrintReportModal';
import { EntitySetupWizardModal } from '../components/entities/EntitySetupWizardModal';

interface FinancialDashboardProps {
  companies: Company[];
  classes: ClassEntity[];
  properties: Property[];
  onOpenManualModal: () => void;
  onNavigateToImport: () => void;
  onNavigateToHierarchy: () => void;
  onOpenCategoryDrilldown?: (drillData: {
    categoryId?: number | null;
    accountName?: string;
    fromDate?: string;
    toDate?: string;
    propertyId?: number;
    classId?: number;
    companyId?: number;
    title?: string;
  }) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  companies,
  classes,
  properties,
  onOpenManualModal,
  onNavigateToImport,
  onNavigateToHierarchy,
  onOpenCategoryDrilldown
}) => {
  // Entity Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');

  // Date Range Presets: MONTHLY, QUARTERLY, SIX_MONTH, ANNUAL, YTD, FISCAL_YEAR, CUSTOM
  const [preset, setPreset] = useState<DateRangePreset>('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-03');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedHalf, setSelectedHalf] = useState<number>(1);
  const [fiscalStartMonth, setFiscalStartMonth] = useState<number>(7); // July standard
  const [ytdThroughDate, setYtdThroughDate] = useState<string>('');
  const [customFromDate, setCustomFromDate] = useState<string>('2026-01-01');
  const [customToDate, setCustomToDate] = useState<string>('2026-03-31');
  const [comparePrior, setComparePrior] = useState<boolean>(true);
  const [statementViewMode, setStatementViewMode] = useState<'consolidated' | 'by_property'>('consolidated');

  // Data & State
  const [reportData, setReportData] = useState<ConcisePnlResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal drilldown for single-tab view
  const [activeDrillModal, setActiveDrillModal] = useState<{
    categoryId?: number | null;
    accountName?: string;
    fromDate?: string;
    toDate?: string;
    propertyId?: number;
    classId?: number;
    companyId?: number;
    title?: string;
  } | null>(null);

  // Print Configuration Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Entity Setup Interview Wizard state
  const [isEntityWizardOpen, setIsEntityWizardOpen] = useState<boolean>(false);

  // Filter available classes when company changes
  const availableClasses = React.useMemo(() => {
    if (!selectedCompanyId) return classes;
    return classes.filter(c => c.company_id === Number(selectedCompanyId));
  }, [classes, selectedCompanyId]);

  // Filter available properties when class or company changes
  const availableProperties = React.useMemo(() => {
    if (selectedClassId) {
      return properties.filter(p => p.class_id === Number(selectedClassId));
    }
    if (selectedCompanyId) {
      const validClassIds = new Set(availableClasses.map(c => c.id));
      return properties.filter(p => p.class_id && validClassIds.has(p.class_id));
    }
    return properties;
  }, [properties, selectedClassId, selectedCompanyId, availableClasses]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getConcisePnlReport({
        company_id: selectedCompanyId ? Number(selectedCompanyId) : undefined,
        class_id: selectedClassId ? Number(selectedClassId) : undefined,
        property_id: selectedPropertyId ? Number(selectedPropertyId) : undefined,
        preset,
        year: selectedYear,
        month: preset === 'MONTHLY' ? selectedMonth : undefined,
        quarter: preset === 'QUARTERLY' ? selectedQuarter : undefined,
        half: preset === 'SIX_MONTH' ? selectedHalf : undefined,
        fiscal_start_month: preset === 'FISCAL_YEAR' ? fiscalStartMonth : undefined,
        from_date: preset === 'CUSTOM' ? customFromDate : (preset === 'YTD' ? undefined : undefined),
        to_date: preset === 'CUSTOM' ? customToDate : (preset === 'YTD' ? ytdThroughDate : undefined),
        compare_prior: comparePrior
      });
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load financial report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [
    selectedCompanyId, selectedClassId, selectedPropertyId,
    preset, selectedMonth, selectedYear, selectedQuarter, selectedHalf,
    fiscalStartMonth, ytdThroughDate, customFromDate, customToDate, comparePrior
  ]);

  // Handle drilldown click
  const handleCategoryClick = (
    catItem: ConsolidatedCategoryLineItem,
    propertyId?: number,
    classId?: number
  ) => {
    const fromDate = reportData?.period_info.start_date;
    const toDate = reportData?.period_info.end_date;
    const resolvedPropId = (propertyId && propertyId > 0)
      ? propertyId
      : (selectedPropertyId ? Number(selectedPropertyId) : undefined);

    const drillPayload = {
      categoryId: catItem.category_id,
      accountName: catItem.account_name,
      fromDate,
      toDate,
      propertyId: resolvedPropId,
      classId: classId || (selectedClassId ? Number(selectedClassId) : undefined),
      companyId: selectedCompanyId ? Number(selectedCompanyId) : undefined,
      title: `Ledger: ${catItem.display_name} (${fromDate} to ${toDate})`
    };

    if (onOpenCategoryDrilldown) {
      onOpenCategoryDrilldown(drillPayload);
    } else {
      setActiveDrillModal(drillPayload);
    }
  };

  // Comparison Bar Chart Data (Current vs Prior)
  const comparisonChartData = React.useMemo(() => {
    if (!reportData || !reportData.summary) return [];
    const s = reportData.summary;
    return [
      {
        metric: 'Rental Income',
        Current: s.portfolio_rental_income_current,
        Prior: comparePrior ? s.portfolio_rental_income_prior : 0
      },
      {
        metric: 'Gross Income',
        Current: s.portfolio_gross_income_current,
        Prior: comparePrior ? s.portfolio_gross_income_prior : 0
      },
      {
        metric: 'Operating Expenses',
        Current: s.portfolio_operating_expenses_current,
        Prior: comparePrior ? s.portfolio_operating_expenses_prior : 0
      },
      {
        metric: 'Net Operating Income',
        Current: s.portfolio_noi_current,
        Prior: comparePrior ? s.portfolio_noi_prior : 0
      }
    ];
  }, [reportData, comparePrior]);

  // Expense Pie Data (Consolidated categories)
  const expensePieData = React.useMemo(() => {
    if (!reportData || !reportData.properties_reports) return [];
    const catMap: Record<string, number> = {};

    reportData.properties_reports.forEach(prop => {
      prop.operating_expenses_section.items.forEach(item => {
        catMap[item.account_name] = (catMap[item.account_name] || 0) + item.current_amount;
      });
    });

    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  }, [reportData]);

  const summary = reportData?.summary;
  const periodInfo = reportData?.period_info;

  const exportUrl = api.getConcisePnlExportUrl({
    company_id: selectedCompanyId ? Number(selectedCompanyId) : undefined,
    class_id: selectedClassId ? Number(selectedClassId) : undefined,
    property_id: selectedPropertyId ? Number(selectedPropertyId) : undefined,
    preset,
    year: selectedYear,
    month: preset === 'MONTHLY' ? selectedMonth : undefined,
    quarter: preset === 'QUARTERLY' ? selectedQuarter : undefined,
    half: preset === 'SIX_MONTH' ? selectedHalf : undefined,
    fiscal_start_month: preset === 'FISCAL_YEAR' ? fiscalStartMonth : undefined,
    from_date: preset === 'CUSTOM' ? customFromDate : undefined,
    to_date: preset === 'CUSTOM' ? customToDate : undefined,
    compare_prior: comparePrior
  });

  const renderStatementCard = (propReport: ConcisePropertyReport, isConsolidated: boolean = false) => (
    <div 
      key={isConsolidated ? 'consolidated-portfolio' : propReport.property_id} 
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Property or Consolidated Header Bar */}
      <div className={`text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 ${
        isConsolidated
          ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-b-2 border-emerald-500'
          : 'bg-gradient-to-r from-slate-900 to-slate-800'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className={`p-1.5 rounded-lg border ${
              isConsolidated
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/50'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {isConsolidated ? <Layers className="w-4 h-4" /> : <Home className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-base text-white">{propReport.property_name}</h3>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
              isConsolidated
                ? 'bg-emerald-500/30 text-emerald-200 border-emerald-500/40'
                : 'bg-indigo-500/30 text-indigo-200 border-indigo-500/40'
            }`}>
              {isConsolidated ? 'Master Rollup' : (propReport.class_name || 'LLC Entity')}
            </span>
            <span className="text-slate-400 text-xs">
              &bull; {propReport.company_name || 'Company'}
            </span>
          </div>
          {propReport.address && (
            <p className="text-xs text-slate-400 flex items-center space-x-1 pl-7">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{propReport.address} &bull; {propReport.units_count} Units ({propReport.property_type || 'Residential'})</span>
            </p>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
            <span className="text-slate-400 mr-2">{isConsolidated ? 'Portfolio NOI:' : 'Property NOI:'}</span>
            <span className="font-mono font-bold text-emerald-400">
              ${propReport.net_operating_income_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Period Context Bar */}
      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded-lg font-mono">
            {propReport.period_label}
          </span>
          {comparePrior && propReport.prior_period_label && (
            <span className="text-slate-500 font-medium">
              Compared to Prior: <strong className="text-slate-700">{propReport.prior_period_label}</strong>
            </span>
          )}
        </div>

        {/* Repair Percentage Column/Metric */}
        <div className="flex items-center space-x-2.5">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Repair Percentage
            </span>
            <span className="text-[11px] text-slate-600">
              (${propReport.total_repairs_current.toLocaleString()} repairs / rent)
            </span>
          </div>
          <div className={`px-2.5 py-1 rounded-xl font-mono font-black text-xs border flex items-center space-x-1 ${
            propReport.repair_percentage_current > 25
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : propReport.repair_percentage_current >= 10
              ? 'bg-blue-100 text-blue-900 border-blue-200'
              : 'bg-emerald-100 text-emerald-900 border-emerald-200'
          }`}>
            <Wrench className="w-3 h-3" />
            <span>{propReport.repair_percentage_current}%</span>
          </div>
        </div>
      </div>

      {/* CONCISE CATEGORY TABLE */}
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 uppercase font-semibold text-slate-500 text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Chart of Accounts Category</th>
                <th className="py-2.5 px-3 text-center">Txns</th>
                <th className="py-2.5 px-3 text-right">Selected Period ($)</th>
                {comparePrior && (
                  <>
                    <th className="py-2.5 px-3 text-right">Prior Period ($)</th>
                    <th className="py-2.5 px-3 text-right">Change ($)</th>
                    <th className="py-2.5 px-3 text-right">Change (%)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              
              {/* 1. RENTAL INCOME (EXPLICIT TOP SECTION) */}
              <tr className="bg-emerald-50/50 font-sans font-bold text-emerald-950 border-t border-emerald-200">
                <td colSpan={comparePrior ? 6 : 3} className="py-2 px-3 uppercase tracking-wider text-emerald-800 text-[11px]">
                  1. Rental Revenue (Explicit Top Section)
                </td>
              </tr>

              {propReport.rental_income_section.items.length === 0 ? (
                <tr>
                  <td colSpan={comparePrior ? 6 : 3} className="py-2 px-3 text-xs italic text-slate-400 pl-8 font-sans">
                    No rental income recorded for this period.
                  </td>
                </tr>
              ) : (
                propReport.rental_income_section.items.map((item, idx) => (
                  <tr 
                    key={idx} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(item, isConsolidated ? undefined : propReport.property_id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="hover:bg-emerald-50/30 transition cursor-pointer group"
                    title="Click to open detail ledger transactions in another window"
                  >
                    <td className="py-2.5 px-3 pl-8 font-sans font-semibold text-slate-900 group-hover:text-emerald-700 flex items-center space-x-2">
                      <span>{item.display_name}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {item.transaction_count} txn{item.transaction_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      +${item.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {comparePrior && (
                      <>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          ${item.prior_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${item.change_amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.change_amount >= 0 ? '+' : ''}${item.change_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${item.change_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.change_percent >= 0 ? '+' : ''}{item.change_percent}%
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}

              {/* Subtotal Rental Income */}
              <tr className="bg-emerald-50/70 font-sans font-bold border-t border-b border-emerald-200">
                <td className="py-2 px-3 pl-8 text-emerald-950">Subtotal: Total Rental Income</td>
                <td className="text-center font-sans text-[10px] text-emerald-800">
                  {propReport.rental_income_section.items.reduce((acc, i) => acc + i.transaction_count, 0)} txns
                </td>
                <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                  ${propReport.rental_income_section.total_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {comparePrior && (
                  <>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-600">
                      ${propReport.rental_income_section.total_prior.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${propReport.rental_income_section.total_change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.rental_income_section.total_change >= 0 ? '+' : ''}${propReport.rental_income_section.total_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${propReport.rental_income_section.total_change_percent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.rental_income_section.total_change_percent >= 0 ? '+' : ''}{propReport.rental_income_section.total_change_percent}%
                    </td>
                  </>
                )}
              </tr>

              {/* 2. OTHER OPERATING INCOME */}
              {propReport.other_income_section.items.length > 0 && (
                <>
                  <tr className="bg-slate-50 font-sans font-bold text-slate-800 text-[11px]">
                    <td colSpan={comparePrior ? 6 : 3} className="py-1.5 px-3 pl-6">
                      Other Operating Revenue
                    </td>
                  </tr>
                  {propReport.other_income_section.items.map((item, idx) => (
                    <tr 
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryClick(item, isConsolidated ? undefined : propReport.property_id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <td className="py-2 px-3 pl-8 font-sans text-slate-800 group-hover:text-emerald-700 flex items-center space-x-2">
                        <span>{item.display_name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                      </td>
                      <td className="py-2 px-3 text-center font-sans text-slate-500 text-[10px]">
                        {item.transaction_count} txn{item.transaction_count === 1 ? '' : 's'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600 font-bold">
                        +${item.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {comparePrior && (
                        <>
                          <td className="py-2 px-3 text-right text-slate-500">
                            ${item.prior_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${item.change_amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.change_amount >= 0 ? '+' : ''}${item.change_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${item.change_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.change_percent >= 0 ? '+' : ''}{item.change_percent}%
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </>
              )}

              {/* TOTAL GROSS INCOME */}
              <tr className="bg-slate-100 font-sans font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2.5 px-3 uppercase tracking-wider">TOTAL GROSS INCOME</td>
                <td className="text-center font-sans text-[10px] text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-bold text-sm">
                  ${propReport.total_gross_income_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {comparePrior && (
                  <>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-bold text-sm">
                      ${propReport.total_gross_income_prior.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold text-sm ${propReport.total_gross_income_change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.total_gross_income_change >= 0 ? '+' : ''}${propReport.total_gross_income_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold text-sm ${propReport.total_gross_income_change_percent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.total_gross_income_change_percent >= 0 ? '+' : ''}{propReport.total_gross_income_change_percent}%
                    </td>
                  </>
                )}
              </tr>

              {/* 3. OPERATING EXPENSES BREAKDOWN (CONSOLIDATED CATEGORY ROWS) */}
              <tr className="bg-rose-50/50 font-sans font-bold text-rose-950 border-t border-rose-200">
                <td colSpan={comparePrior ? 6 : 3} className="py-2 px-3 uppercase tracking-wider text-rose-900 text-[11px]">
                  2. Operating Expenses Breakdown (Consolidated Categories)
                </td>
              </tr>

              {propReport.operating_expenses_section.items.length === 0 ? (
                <tr>
                  <td colSpan={comparePrior ? 6 : 3} className="py-2 px-3 text-xs italic text-slate-400 pl-8 font-sans">
                    No operating expenses recorded for this period.
                  </td>
                </tr>
              ) : (
                propReport.operating_expenses_section.items.map((item, idx) => (
                  <tr 
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(item, isConsolidated ? undefined : propReport.property_id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="hover:bg-slate-50 transition cursor-pointer group"
                    title="Click to view detailed itemized ledger transactions in a new window"
                  >
                    <td className="py-2 px-3 pl-8 font-sans font-medium text-slate-800 group-hover:text-emerald-700 flex items-center space-x-2">
                      <span>{item.display_name}</span>
                      {item.is_repair && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Wrench className="w-2.5 h-2.5 mr-0.5" />
                          Repair
                        </span>
                      )}
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {item.transaction_count} txn{item.transaction_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-700">
                      -${item.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {comparePrior && (
                      <>
                        <td className="py-2 px-3 text-right text-slate-500">
                          ${item.prior_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${item.change_amount <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.change_amount >= 0 ? '+' : ''}${item.change_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${item.change_percent <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.change_percent >= 0 ? '+' : ''}{item.change_percent}%
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}

              {/* TOTAL OPERATING EXPENSES (DISPLAYED IN BOLD AS REQUIRED) */}
              <tr className="bg-slate-900 text-white font-sans font-black text-sm border-t-2 border-slate-900">
                <td className="py-3 px-3 uppercase tracking-wider font-extrabold flex items-center space-x-2">
                  <span>TOTAL OPERATING EXPENSES</span>
                  <span className="text-[10px] font-normal text-slate-400">(BOLD Standard)</span>
                </td>
                <td className="py-3 px-3 text-center text-slate-300 font-sans text-xs">
                  {propReport.operating_expenses_section.items.reduce((acc, i) => acc + i.transaction_count, 0)} txns
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-rose-300 text-base">
                  -${propReport.total_operating_expenses_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {comparePrior && (
                  <>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-300 text-sm">
                      -${propReport.total_operating_expenses_prior.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${propReport.total_operating_expenses_change <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
                      {propReport.total_operating_expenses_change >= 0 ? '+' : ''}${propReport.total_operating_expenses_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold text-sm ${propReport.total_operating_expenses_change_percent <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
                      {propReport.total_operating_expenses_change_percent >= 0 ? '+' : ''}{propReport.total_operating_expenses_change_percent}%
                    </td>
                  </>
                )}
              </tr>

              {/* NET OPERATING INCOME (NOI) */}
              <tr className="bg-emerald-100/80 text-slate-950 font-sans font-extrabold border-t-2 border-emerald-400 text-sm">
                <td className="py-2.5 px-3 text-emerald-950 uppercase">NET OPERATING INCOME (NOI)</td>
                <td className="text-center font-sans text-slate-500">—</td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-900 font-black text-base">
                  ${propReport.net_operating_income_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {comparePrior && (
                  <>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-bold">
                      ${propReport.net_operating_income_prior.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${propReport.net_operating_income_change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.net_operating_income_change >= 0 ? '+' : ''}${propReport.net_operating_income_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${propReport.net_operating_income_change_percent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {propReport.net_operating_income_change_percent >= 0 ? '+' : ''}{propReport.net_operating_income_change_percent}%
                    </td>
                  </>
                )}
              </tr>

              {/* NON-OPERATING ITEMS */}
              {propReport.non_operating_section.items.length > 0 && (
                <>
                  <tr className="bg-slate-50 font-sans font-bold text-slate-700 text-[11px]">
                    <td colSpan={comparePrior ? 6 : 3} className="py-1.5 px-3 pl-6">
                      Non-Operating Items (Mortgage Debt Service & Capital Expenditures)
                    </td>
                  </tr>
                  {propReport.non_operating_section.items.map((item, idx) => (
                    <tr 
                      key={idx} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategoryClick(item, isConsolidated ? undefined : propReport.property_id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <td className="py-2 px-3 pl-8 font-sans text-slate-700 group-hover:text-emerald-700 flex items-center space-x-2">
                        <span>{item.display_name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition" />
                      </td>
                      <td className="py-2 px-3 text-center font-sans text-slate-500 text-[10px]">
                        {item.transaction_count} txn{item.transaction_count === 1 ? '' : 's'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-800 font-bold">
                        -${item.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {comparePrior && (
                        <>
                          <td className="py-2 px-3 text-right text-slate-500">
                            ${item.prior_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 font-bold">
                            {item.change_amount >= 0 ? '+' : ''}${item.change_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 font-bold">
                            {item.change_percent >= 0 ? '+' : ''}{item.change_percent}%
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {/* NET CASH FLOW */}
                  <tr className="bg-slate-200 font-sans font-bold text-slate-900 border-t border-slate-300">
                    <td className="py-2 px-3 uppercase tracking-wider">NET CASH FLOW (After Debt & CapEx)</td>
                    <td className="text-center font-sans text-slate-500">—</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                      ${propReport.net_cash_flow_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {comparePrior && (
                      <>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          ${propReport.net_cash_flow_prior.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {propReport.net_cash_flow_change >= 0 ? '+' : ''}${propReport.net_cash_flow_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {propReport.net_cash_flow_change_percent >= 0 ? '+' : ''}{propReport.net_cash_flow_change_percent}%
                        </td>
                      </>
                    )}
                  </tr>
                </>
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Financial Reporting (P&L Statements)
              </h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200">
                Concise Format
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Executive Profit & Loss statements with consolidated category line items, multi-period date presets, prior period comparisons, and click-to-drilldown detail ledger windows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEntityWizardOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              title="Launch Guided Entity & Portfolio Setup Interview"
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Entity Setup</span>
            </button>

            <a
              href={exportUrl}
              download
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer"
              title="Export Concise P&L Report to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </a>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              title="Print Financial Report to Windows Printer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* DATE PRESETS TOOLBAR */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Reporting Period:
              </span>
            </div>

            {/* Compare to Prior Period Toggle */}
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-slate-300 hover:border-emerald-500 transition shadow-2xs">
              <input
                type="checkbox"
                checked={comparePrior}
                onChange={(e) => setComparePrior(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span>Compare to Prior Period</span>
              {periodInfo?.prior_period_label && comparePrior && (
                <span className="text-[11px] font-normal text-slate-500">
                  ({periodInfo.prior_period_label})
                </span>
              )}
            </label>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'MONTHLY', label: 'Monthly' },
              { id: 'QUARTERLY', label: 'Quarterly' },
              { id: 'SIX_MONTH', label: '6 Months' },
              { id: 'ANNUAL', label: 'Annual / Year' },
              { id: 'YTD', label: 'Year-to-Date (YTD)' },
              { id: 'FISCAL_YEAR', label: 'Fiscal Year' },
              { id: 'CUSTOM', label: 'Specific Dates' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPreset(tab.id as DateRangePreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  preset === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contextual Secondary Pickers based on Preset */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/80 text-xs">
            {preset === 'MONTHLY' && (
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-600">Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                />
                <button
                  onClick={() => setSelectedMonth('2026-03')}
                  className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  This Month (Mar)
                </button>
                <button
                  onClick={() => setSelectedMonth('2026-02')}
                  className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  Last Month (Feb)
                </button>
              </div>
            )}

            {preset === 'QUARTERLY' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <span className="font-semibold text-slate-600 ml-2">Quarter:</span>
                {[
                  { q: 1, label: 'Q1 (Jan - Mar)' },
                  { q: 2, label: 'Q2 (Apr - Jun)' },
                  { q: 3, label: 'Q3 (Jul - Sep)' },
                  { q: 4, label: 'Q4 (Oct - Dec)' }
                ].map(item => (
                  <button
                    key={item.q}
                    onClick={() => setSelectedQuarter(item.q)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                      selectedQuarter === item.q
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {preset === 'SIX_MONTH' && (
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-600">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <span className="font-semibold text-slate-600 ml-2">Half:</span>
                {[
                  { h: 1, label: 'H1 (Jan 1 - Jun 30)' },
                  { h: 2, label: 'H2 (Jul 1 - Dec 31)' }
                ].map(item => (
                  <button
                    key={item.h}
                    onClick={() => setSelectedHalf(item.h)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                      selectedHalf === item.h
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {preset === 'ANNUAL' && (
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-600">Calendar Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-semibold text-slate-800"
                >
                  {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button
                  onClick={() => setSelectedYear(2026)}
                  className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  This Year (2026)
                </button>
                <button
                  onClick={() => setSelectedYear(2025)}
                  className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  Last Year (2025)
                </button>
              </div>
            )}

            {preset === 'YTD' && (
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-600">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="font-semibold text-slate-600 ml-2">Through Date:</span>
                <input
                  type="date"
                  value={ytdThroughDate}
                  onChange={(e) => setYtdThroughDate(e.target.value)}
                  placeholder="Defaults to Today / Month End"
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                />
                {ytdThroughDate && (
                  <button
                    onClick={() => setYtdThroughDate('')}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {preset === 'FISCAL_YEAR' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600">Fiscal Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  {[2026, 2025, 2024].map(y => <option key={y} value={y}>FY {y}</option>)}
                </select>
                <span className="font-semibold text-slate-600 ml-2">Starts On:</span>
                <select
                  value={fiscalStartMonth}
                  onChange={(e) => setFiscalStartMonth(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value={7}>July 1 (Standard Real Estate)</option>
                  <option value={10}>October 1 (Federal Standard)</option>
                  <option value={1}>January 1 (Calendar FY)</option>
                  <option value={4}>April 1</option>
                </select>
              </div>
            )}

            {preset === 'CUSTOM' && (
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-600">From:</span>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                />
                <span className="font-semibold text-slate-600">To:</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tiered Filter Selectors: Company -> Class/LLC -> Property */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Company Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCompanyId}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : '';
                setSelectedCompanyId(val);
                setSelectedClassId('');
                setSelectedPropertyId('');
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 w-full outline-hidden cursor-pointer"
            >
              <option value="">All Companies (Portfolio Rollup)</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Class / LLC Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
            <select
              value={selectedClassId}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : '';
                setSelectedClassId(val);
                setSelectedPropertyId('');
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 w-full outline-hidden cursor-pointer"
            >
              <option value="">All Classes / LLCs</option>
              {availableClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sub-Class / Property Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Home className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedPropertyId}
              onChange={e => setSelectedPropertyId(e.target.value ? Number(e.target.value) : '')}
              className="bg-transparent text-xs font-semibold text-slate-700 w-full outline-hidden cursor-pointer"
            >
              <option value="">All Properties (Sub-Class)</option>
              {availableProperties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards (Current vs Prior Comparison) */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Total Rental Income */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Rental Income
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900">
                ${summary.portfolio_rental_income_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {comparePrior && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prior: ${summary.portfolio_rental_income_prior.toLocaleString()}</span>
                  <span className={`font-mono font-bold flex items-center ${
                    summary.portfolio_rental_income_change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {summary.portfolio_rental_income_change >= 0 ? '+' : ''}${summary.portfolio_rental_income_change.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Total Operating Expenses (BOLD Emphasis) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center space-x-1">
                <span>Total Operating Expenses</span>
                <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-black">BOLD</span>
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                ${summary.portfolio_operating_expenses_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {comparePrior && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prior: ${summary.portfolio_operating_expenses_prior.toLocaleString()}</span>
                  <span className={`font-mono font-bold flex items-center ${
                    summary.portfolio_operating_expenses_change <= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {summary.portfolio_operating_expenses_change >= 0 ? '+' : ''}${summary.portfolio_operating_expenses_change.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Net Operating Income (NOI) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Net Operating Income (NOI)
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900">
                ${summary.portfolio_noi_current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {comparePrior && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prior: ${summary.portfolio_noi_prior.toLocaleString()}</span>
                  <span className={`font-mono font-bold flex items-center ${
                    summary.portfolio_noi_change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {summary.portfolio_noi_change >= 0 ? '+' : ''}${summary.portfolio_noi_change.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Dedicated Repair Percentage Metric */}
          <div className={`p-5 rounded-2xl border shadow-xs relative overflow-hidden ${
            summary.portfolio_repair_percentage_current > 25 
              ? 'bg-amber-50/50 border-amber-300' 
              : summary.portfolio_repair_percentage_current >= 10 
              ? 'bg-blue-50/40 border-blue-200' 
              : 'bg-emerald-50/40 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1">
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
                <span>Repair Percentage</span>
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                summary.portfolio_repair_percentage_current > 25 
                  ? 'bg-amber-200 text-amber-900' 
                  : summary.portfolio_repair_percentage_current >= 10 
                  ? 'bg-blue-200 text-blue-900' 
                  : 'bg-emerald-200 text-emerald-900'
              }`}>
                {summary.portfolio_repair_percentage_current > 25 ? 'Alert (>25%)' : summary.portfolio_repair_percentage_current >= 10 ? 'Normal (10-25%)' : 'Healthy (<10%)'}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black font-mono text-slate-900">
                {summary.portfolio_repair_percentage_current}%
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  ${summary.portfolio_repairs_current.toLocaleString()} Repairs / Rent
                </span>
                {comparePrior && (
                  <span className="font-mono text-slate-500">
                    Prior: {summary.portfolio_repair_percentage_prior}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Period Financial Comparison</span>
              </h3>
              <p className="text-xs text-slate-500">
                Current Period vs Prior Period across key metrics
              </p>
            </div>
          </div>
          <div className="h-64">
            {comparisonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="Current" fill="#10b981" radius={[4, 4, 0, 0]} />
                  {comparePrior && (
                    <Bar dataKey="Prior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No financial comparison data available.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-rose-500" />
              <span>Consolidated Operating Expenses</span>
            </h3>
            <p className="text-xs text-slate-500">Breakdown by combined category</p>
          </div>
          
          <div className="h-52 my-2">
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expensePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No operating expenses recorded.
              </div>
            )}
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {expensePieData.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="flex items-center space-x-1.5 truncate text-slate-600">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono font-semibold text-slate-800">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONCISE FINANCIAL STATEMENT TABLES */}
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {!selectedPropertyId && statementViewMode === 'consolidated'
                  ? 'Master Consolidated Portfolio Statement (P&L)'
                  : 'Concise Property Financial Statements (P&L)'}
              </h2>
              {!selectedPropertyId && (
                <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatementViewMode('consolidated')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      statementViewMode === 'consolidated'
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Consolidated Portfolio View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementViewMode('by_property')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      statementViewMode === 'by_property'
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5 text-indigo-400" />
                    <span>By Property Breakdown ({reportData?.properties_reports.length || 0})</span>
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {!selectedPropertyId && statementViewMode === 'consolidated'
                ? 'All properties combined into 1 master statement. Every category combined into 1 single line item. Click any category to drill down across all properties.'
                : 'Combined 1-line item per category for each individual property. Click any line item to open the detailed transaction ledger.'}
            </p>
          </div>
          <button
            onClick={onOpenManualModal}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            + Add Off-Statement Item
          </button>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600">Generating concise financial report...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-rose-800 text-sm">
            {error}
          </div>
        ) : reportData?.properties_reports.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
            <Building className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <h3 className="font-bold text-slate-800">No Transactions Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No financial transactions have been recorded for the selected period and entity filter.
              </p>
            </div>
            <div className="flex justify-center space-x-3">
              <button
                onClick={onNavigateToImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
              >
                Upload Statement
              </button>
              <button
                onClick={onOpenManualModal}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Manual Entry
              </button>
            </div>
          </div>
        ) : (
          <>
            {!selectedPropertyId && statementViewMode === 'consolidated' && reportData?.portfolio_consolidated_report
              ? renderStatementCard(reportData.portfolio_consolidated_report, true)
              : reportData?.properties_reports.map((propReport) => renderStatementCard(propReport, false))}
          </>
        )}
      </div>

      {/* Drilldown Modal (for Tabbed mode or standalone) */}
      <CategoryDrilldownModal
        isOpen={Boolean(activeDrillModal)}
        onClose={() => setActiveDrillModal(null)}
        categoryId={activeDrillModal?.categoryId}
        accountName={activeDrillModal?.accountName}
        fromDate={activeDrillModal?.fromDate}
        toDate={activeDrillModal?.toDate}
        propertyId={activeDrillModal?.propertyId}
        classId={activeDrillModal?.classId}
        companyId={activeDrillModal?.companyId}
        title={activeDrillModal?.title}
      />

      {/* Print Configuration Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        reportParams={{
          company_id: selectedCompanyId ? Number(selectedCompanyId) : undefined,
          class_id: selectedClassId ? Number(selectedClassId) : undefined,
          property_id: selectedPropertyId ? Number(selectedPropertyId) : undefined,
          preset,
          year: selectedYear,
          month: preset === 'MONTHLY' ? selectedMonth : undefined,
          quarter: preset === 'QUARTERLY' ? selectedQuarter : undefined,
          half: preset === 'SIX_MONTH' ? selectedHalf : undefined,
          fiscal_start_month: preset === 'FISCAL_YEAR' ? fiscalStartMonth : undefined,
          from_date: preset === 'CUSTOM' ? customFromDate : undefined,
          to_date: preset === 'CUSTOM' ? customToDate : (preset === 'YTD' ? ytdThroughDate : undefined),
          compare_prior: comparePrior
        }}
        periodLabel={reportData?.period_info.period_label || 'P&L Statement'}
      />

      {/* Entity Setup Interview Wizard */}
      <EntitySetupWizardModal
        isOpen={isEntityWizardOpen}
        onClose={() => setIsEntityWizardOpen(false)}
        existingCompanies={companies}
        onSuccess={() => {
          fetchReport();
          if (onNavigateToHierarchy) {
            onNavigateToHierarchy();
          }
        }}
      />
    </div>
  );
};
