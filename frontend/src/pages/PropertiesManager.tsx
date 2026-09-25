import React, { useState, useEffect } from 'react';
import { 
  Building, Plus, Layers, MapPin, CheckCircle2, AlertCircle, 
  ChevronRight, ChevronDown, Landmark, Sparkles, Home, Shield
} from 'lucide-react';
import { Company, ClassEntity, Property, HierarchyCompany, US_STATES, AppTheme } from '../types';
import { api } from '../services/api';
import { EntitySetupWizardModal } from '../components/entities/EntitySetupWizardModal';

interface PropertiesManagerProps {
  properties: Property[];
  classes: ClassEntity[];
  companies: Company[];
  onRefresh: () => void;
  theme?: AppTheme;
}

export const PropertiesManager: React.FC<PropertiesManagerProps> = ({
  properties,
  classes,
  companies,
  onRefresh,
  theme = 'dark'
}) => {
  const [hierarchy, setHierarchy] = useState<HierarchyCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<number, boolean>>({});
  const [expandedClasses, setExpandedClasses] = useState<Record<number, boolean>>({});
  const [isEntityWizardOpen, setIsEntityWizardOpen] = useState(false);

  const isLight = theme === 'light';
  const isNavy = theme === 'navy';
  const isEmerald = theme === 'emerald';

  // Modal / Form modes: 'NONE' | 'COMPANY' | 'CLASS' | 'SUBCLASS'
  const [activeForm, setActiveForm] = useState<'NONE' | 'COMPANY' | 'CLASS' | 'SUBCLASS'>('NONE');

  // Form states: Company
  const [compName, setCompName] = useState('');
  const [compEin, setCompEin] = useState('');
  const [compNotes, setCompNotes] = useState('');

  // Form states: Class / LLC
  const [selectedCompId, setSelectedCompId] = useState<number | ''>('');
  const [llcName, setLlcName] = useState('');
  const [llcDesc, setLlcDesc] = useState('');
  const [isCommonClass, setIsCommonClass] = useState(false);

  // Form states: Sub Class / Property (with Address Form)
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [subclassName, setSubclassName] = useState(''); // e.g. 2908 Depot
  const [addr1, setAddr1] = useState(''); // Address Line 1
  const [addr2, setAddr2] = useState(''); // Address Line 2
  const [city, setCity] = useState('');
  const [state, setState] = useState('CO');
  const [zipCode, setZipCode] = useState('');
  const [acqCost, setAcqCost] = useState('');
  const [acqDate, setAcqDate] = useState('');
  const [propType, setPropType] = useState('Commercial / Multi-Unit');
  const [propUnits, setPropUnits] = useState(1);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const data = await api.getHierarchy();
      setHierarchy(data);
      // Auto-expand all by default for visibility
      const compExp: Record<number, boolean> = {};
      const clsExp: Record<number, boolean> = {};
      data.forEach(c => {
        compExp[c.id] = true;
        c.classes.forEach(cls => {
          clsExp[cls.id] = true;
        });
      });
      setExpandedCompanies(compExp);
      setExpandedClasses(clsExp);
    } catch (err) {
      console.error('Failed to load hierarchy', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, [properties, classes, companies]);
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    try {
      setFormLoading(true);
      setFormError(null);
      await api.createCompany({
        name: compName.trim(),
        ein: compEin.trim(),
        notes: compNotes.trim()
      });
      setFormSuccess(`Company "${compName}" created successfully!`);
      setCompName('');
      setCompEin('');
      setCompNotes('');
      setTimeout(() => { setFormSuccess(null); setActiveForm('NONE'); }, 1200);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create company');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!llcName.trim() || !selectedCompId) {
      setFormError('Please select a Company and provide a Class or LLC Name.');
      return;
    }
    try {
      setFormLoading(true);
      setFormError(null);
      await api.createClass({
        name: llcName.trim(),
        company_id: Number(selectedCompId),
        description: llcDesc.trim() || (isCommonClass ? 'Shared portfolio/company expenses not classified to any single LLC or property' : undefined),
        entity_type: isCommonClass ? 'COMMON' : 'LLC',
        tax_classification: isCommonClass ? 'PORTFOLIO_OVERHEAD' : undefined,
        create_default_property: isCommonClass,
        default_property_name: isCommonClass ? 'Portfolio / Company Overhead' : undefined
      });
      setFormSuccess(`Class "${llcName}" created successfully!`);
      setLlcName('');
      setLlcDesc('');
      setIsCommonClass(false);
      setTimeout(() => { setFormSuccess(null); setActiveForm('NONE'); }, 1200);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create class / LLC');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateSubclass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subclassName.trim() || !selectedClassId) {
      setFormError('Please select a Class / LLC and provide a Sub-Class / Property Name.');
      return;
    }
    try {
      setFormLoading(true);
      setFormError(null);
      await api.createProperty({
        name: subclassName.trim(),
        class_id: Number(selectedClassId),
        address_line1: addr1.trim(),
        address_line2: addr2.trim(),
        city: city.trim(),
        state: state.trim() || 'CO',
        zip_code: zipCode.trim(),
        property_type: propType,
        units_count: Number(propUnits) || 1,
        acquisition_cost: acqCost ? parseFloat(acqCost) : undefined,
        acquisition_date: acqDate.trim() || undefined
      });
      setFormSuccess(`Sub-Class Property "${subclassName}" created with address!`);
      setSubclassName('');
      setAddr1('');
      setAddr2('');
      setCity('');
      setState('CO');
      setZipCode('');
      setAcqCost('');
      setAcqDate('');
      setTimeout(() => { setFormSuccess(null); setActiveForm('NONE'); }, 1200);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create Sub-Class property');
    } finally {
      setFormLoading(false);
    }
  };

  const totalUnits = properties.reduce((acc, p) => acc + p.units_count, 0);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Portfolio Hierarchy & Structure</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full">
              3-Tier Entity Organization
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            <strong>Company</strong> &rarr; <strong>Class (LLC)</strong> &rarr; <strong>Sub-Class (Property with Address Form)</strong>
          </p>
        </div>

        {/* Main Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEntityWizardOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
            title="Launch Guided Entity & Portfolio Setup Interview Wizard"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>+ Guided Entity Setup Interview</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEntityWizardOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            title="Launch Entity Setup Interview"
          >
            <Landmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>&lt;Create New Company&gt;</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveForm('CLASS'); setFormError(null); setFormSuccess(null); if (companies[0]) setSelectedCompId(companies[0].id); }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-200" />
            <span>&lt;Create a New Class&gt; (LLC)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveForm('SUBCLASS'); setFormError(null); setFormSuccess(null); if (classes[0]) setSelectedClassId(classes[0].id); }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-emerald-200" />
            <span>&lt;Create new Sub Class&gt; (Property)</span>
          </button>
        </div>
      </div>

      {/* Class Structure Architecture Display Banner */}
      {isLight ? (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/80 to-purple-50 text-slate-900 p-4 rounded-xl shadow-xs border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-indigo-950">
                Class Structure Architecture
              </div>
              <div className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-slate-950 font-black">{companies[0]?.name || 'Rental Portfolio'}</span>
                <span className="text-indigo-500 font-black">&gt;</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-950 font-black text-xs border border-indigo-300 shadow-2xs">
                  {classes.length} LLC{classes.length === 1 ? '' : 's'}
                </span>
                <span className="text-indigo-500 font-black">&gt;</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-300 shadow-2xs">
                  {properties.length} Sub-Class Holding{properties.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white border-2 border-indigo-200/90 px-3.5 py-2 rounded-xl shadow-2xs text-xs font-semibold text-slate-800 shrink-0 flex flex-wrap items-center gap-1.5">
            <span className="font-black text-indigo-950 uppercase tracking-wide text-[11px] mr-1">Example:</span>
            <span className="font-mono text-emerald-800 font-black">Rental Portfolio</span>
            <span className="text-indigo-500 font-bold">&gt;</span>
            <span className="font-mono text-indigo-900 font-black">2 LLCs</span>
            <span className="text-indigo-500 font-bold">&gt;</span>
            <span className="font-mono text-emerald-800 font-black">Holdings under each LLC</span>
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-xl shadow-md border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white ${
          isNavy
            ? 'bg-gradient-to-r from-[#0d1629] via-[#16203a] to-[#0d1629] border-indigo-500/40'
            : isEmerald
            ? 'bg-gradient-to-r from-[#062117] via-[#0b3324] to-[#062117] border-emerald-500/40'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/40'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-indigo-200">
                Class Structure Architecture
              </div>
              <div className="text-sm font-black text-white flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-white font-black">{companies[0]?.name || 'Rental Portfolio'}</span>
                <span className="text-indigo-300 font-bold">&gt;</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-900/90 text-indigo-100 font-black text-xs border border-indigo-400/60 shadow-xs">
                  {classes.length} LLC{classes.length === 1 ? '' : 's'}
                </span>
                <span className="text-indigo-300 font-bold">&gt;</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-900/90 text-emerald-100 font-black text-xs border border-emerald-400/60 shadow-xs">
                  {properties.length} Sub-Class Holding{properties.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/95 border-2 border-indigo-500/50 px-3.5 py-2 rounded-xl shadow-xs text-xs font-semibold text-slate-100 shrink-0 flex flex-wrap items-center gap-1.5">
            <span className="font-black text-amber-300 uppercase tracking-wide text-[11px] mr-1">Example:</span>
            <span className="font-mono text-emerald-300 font-black">Rental Portfolio</span>
            <span className="text-indigo-300 font-bold">&gt;</span>
            <span className="font-mono text-indigo-200 font-black">2 LLCs</span>
            <span className="text-indigo-300 font-bold">&gt;</span>
            <span className="font-mono text-emerald-300 font-black">Holdings under each LLC</span>
          </div>
        </div>
      )}

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Companies</span>
              <h4 className="text-lg font-bold font-mono text-slate-900">{companies.length}</h4>
            </div>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">Top Tier</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Classes / LLCs</span>
              <h4 className="text-lg font-bold font-mono text-indigo-900">{classes.length}</h4>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Mid Tier</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Sub-Classes (Properties)</span>
              <h4 className="text-lg font-bold font-mono text-emerald-900">{properties.length} ({totalUnits} Units)</h4>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Asset Tier</span>
        </div>
      </div>
      {/* Dynamic Creation Form Panel */}
      {activeForm !== 'NONE' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-500/50 shadow-md animate-in fade-in zoom-in-98 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              {activeForm === 'COMPANY' && (
                <>
                  <Landmark className="w-5 h-5 text-slate-800" />
                  <span>&lt;Create New Company&gt;</span>
                </>
              )}
              {activeForm === 'CLASS' && (
                <>
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <span>&lt;Create a New Class&gt; (LLC)</span>
                </>
              )}
              {activeForm === 'SUBCLASS' && (
                <>
                  <Home className="w-5 h-5 text-emerald-600" />
                  <span>&lt;Create new Sub Class&gt; (Property with Address Form)</span>
                </>
              )}
            </h2>
            <button
              onClick={() => setActiveForm('NONE')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md"
            >
              Close
            </button>
          </div>

          {formError && (
            <div className="p-3 mb-4 bg-red-50 text-red-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 mb-4 bg-emerald-50 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Form 1: Company */}
          {/* Form 1: Company */}
          {activeForm === 'COMPANY' && (
            <form onSubmit={handleCreateCompany} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Apex Real Estate Holdings Inc."
                  value={compName}
                  onChange={e => setCompName(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">EIN / Tax ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., 84-2938102"
                    value={compEin}
                    onChange={e => setCompEin(e.target.value)}
                    className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Entity Type</label>
                  <input
                    type="text"
                    placeholder="e.g., Parent holding company"
                    value={compNotes}
                    onChange={e => setCompNotes(e.target.value)}
                    className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveForm('NONE')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer"
                >
                  {formLoading ? 'Creating Company...' : 'Save Company'}
                </button>
              </div>
            </form>
          )}

          {/* Form 2: Class / LLC */}
          {activeForm === 'CLASS' && (
            <form onSubmit={handleCreateClass} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Parent Company *</label>
                <select
                  value={selectedCompId}
                  onChange={e => setSelectedCompId(Number(e.target.value))}
                  className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  required
                >
                  <option value="" className="text-slate-900 bg-white">-- Choose Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} className="text-slate-900 bg-white">{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Class / LLC Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Sunset Holdings LLC, Depot Investments LLC"
                  value={llcName}
                  onChange={e => setLlcName(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g., Special purpose entity or shared overhead bucket"
                  value={llcDesc}
                  onChange={e => setLlcDesc(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1.5">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCommonClass}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCommonClass(checked);
                      if (checked && (!llcName.trim() || llcName === 'Sunset Holdings LLC')) {
                        setLlcName('Portfolio / Company Expense');
                        setLlcDesc('Shared portfolio/company expenses (e.g. telephone, software, legal, corporate overhead)');
                      }
                    }}
                    className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">Common Class (Shared Portfolio / Company Expenses)</span>
                    <span className="block text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      Check this for unallocated overhead expenses (e.g. telephone bill, corporate tax filing, software tools) that cannot be classified to any one LLC. Automatically attaches <strong>"Portfolio / Company Overhead"</strong> subclass.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveForm('NONE')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer"
                >
                  {formLoading ? 'Creating Class...' : 'Save Class (LLC)'}
                </button>
              </div>
            </form>
          )}

          {/* Form 3: Sub-Class (Property with Address Form as requested) */}
          {activeForm === 'SUBCLASS' && (
            <form onSubmit={handleCreateSubclass} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Parent Class / LLC *</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(Number(e.target.value))}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    required
                  >
                    <option value="" className="text-slate-900 bg-white">-- Choose Class (LLC) --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="text-slate-900 bg-white">{c.name} ({c.company_name})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Class Name * (e.g. 2908 Depot)</label>
                  <input
                    type="text"
                    placeholder="e.g., 2908 Depot, Sunset Palms Apartments"
                    value={subclassName}
                    onChange={e => setSubclassName(e.target.value)}
                    className="w-full text-xs font-bold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* ATTACHED ADDRESS FORM */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Attached Property Address Form</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Address Line 1 *</label>
                    <input
                      type="text"
                      placeholder="e.g., 2908 Depot Rd"
                      value={addr1}
                      onChange={e => setAddr1(e.target.value)}
                      className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Address Line 2 (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Suite 100 / Apt 4B"
                      value={addr2}
                      onChange={e => setAddr2(e.target.value)}
                      className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">City *</label>
                    <input
                      type="text"
                      placeholder="Austin"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">State *</label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 outline-hidden shadow-2xs"
                      required
                    >
                      {US_STATES.map(st => (
                        <option key={st.code} value={st.code} className="text-slate-900 bg-white">{st.name} ({st.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Zip Code *</label>
                    <input
                      type="text"
                      placeholder="78704"
                      value={zipCode}
                      onChange={e => setZipCode(e.target.value)}
                      className="w-full text-xs font-mono font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Acquisition Cost (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 500000"
                      value={acqCost}
                      onChange={e => setAcqCost(e.target.value)}
                      className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Acquisition Date (Optional)</label>
                    <input
                      type="date"
                      value={acqDate}
                      onChange={e => setAcqDate(e.target.value)}
                      className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 outline-hidden shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Property Asset Type</label>
                  <select
                    value={propType}
                    onChange={e => setPropType(e.target.value)}
                    className="w-full text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 outline-hidden shadow-2xs"
                  >
                    <option value="Commercial / Multi-Unit" className="text-slate-900 bg-white">Commercial / Multi-Unit</option>
                    <option value="Multi-Family" className="text-slate-900 bg-white">Multi-Family</option>
                    <option value="Single-Family" className="text-slate-900 bg-white">Single-Family</option>
                    <option value="Duplex" className="text-slate-900 bg-white">Duplex</option>
                    <option value="Short-Term Rental" className="text-slate-900 bg-white">Short-Term Rental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units Count</label>
                  <input
                    type="number"
                    min="1"
                    value={propUnits}
                    onChange={e => setPropUnits(Number(e.target.value))}
                    className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 outline-hidden shadow-2xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveForm('NONE')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {formLoading ? 'Creating Sub-Class...' : 'Save Sub-Class Property'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Visual Organizational Hierarchy Tree */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Hierarchical Portfolio Tree</span>
            </h3>
            <p className="text-xs text-slate-500">
              Interactive breakdown of Companies &rarr; LLC Classes &rarr; Sub-Class Properties with full addresses
            </p>
          </div>
          <button
            onClick={fetchHierarchy}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            Refresh Tree
          </button>
        </div>

        {hierarchy.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No company hierarchy recorded yet. Use the buttons above to create a Company, Class, and Sub-Class!
          </div>
        ) : (
          <div className="space-y-4">
            {hierarchy.map(comp => (
              <div key={comp.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                {/* Level 1: Company Header */}
                <div 
                  onClick={() => setExpandedCompanies({ ...expandedCompanies, [comp.id]: !expandedCompanies[comp.id] })}
                  className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition"
                >
                  <div className="flex items-center space-x-3">
                    {expandedCompanies[comp.id] ? (
                      <ChevronDown className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <Landmark className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-bold text-sm tracking-tight">{comp.name}</span>
                      {comp.ein && <span className="ml-2 text-slate-400 text-xs font-mono">(EIN: {comp.ein})</span>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                      {comp.classes.length} LLC(s)
                    </span>
                  </div>
                </div>

                {/* Level 2: Classes / LLCs */}
                {expandedCompanies[comp.id] && (
                  <div className="p-4 space-y-3">
                    {comp.classes.length === 0 ? (
                      <div className="text-xs text-slate-400 pl-6 italic">
                        No Classes / LLCs in this company yet. Click "&lt;Create a New Class&gt;" above.
                      </div>
                    ) : (
                      comp.classes.map(cls => (
                        <div key={cls.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                          <div 
                            onClick={() => setExpandedClasses({ ...expandedClasses, [cls.id]: !expandedClasses[cls.id] })}
                            className="px-4 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between cursor-pointer hover:bg-indigo-50 transition"
                          >
                            <div className="flex items-center space-x-2.5">
                              {expandedClasses[cls.id] ? (
                                <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <Shield className="w-4 h-4 text-indigo-600" />
                              <span className="font-bold text-xs text-indigo-950">{cls.name}</span>
                              {cls.description && <span className="text-[11px] text-slate-500">&bull; {cls.description}</span>}
                            </div>
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                              {cls.properties.length} Sub-Class Properties
                            </span>
                          </div>

                          {/* Level 3: Sub-Classes (Properties with Address Details) */}
                          {expandedClasses[cls.id] && (
                            <div className="p-3 divide-y divide-slate-100">
                              {cls.properties.length === 0 ? (
                                <div className="text-xs text-slate-400 pl-6 py-2 italic">
                                  No Sub-Class Properties under this LLC yet. Click "&lt;Create new Sub Class&gt;" above.
                                </div>
                              ) : (
                                cls.properties.map(prop => (
                                  <div key={prop.id} className="py-2.5 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50/80 rounded-lg transition">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center space-x-2">
                                        <Home className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="font-bold text-xs text-slate-900">{prop.name}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
                                          {prop.property_type}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 flex items-center space-x-1 pl-5">
                                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>{prop.address || `${prop.address_line1 || ''} ${prop.city || ''}, ${prop.state || ''} ${prop.zip_code || ''}`}</span>
                                      </div>
                                      {(prop.acquisition_cost || prop.acquisition_date) && (
                                        <div className="text-[10px] text-slate-500 flex items-center space-x-3 pl-5 pt-0.5">
                                          {prop.acquisition_cost && <span>Cost: <strong className="text-slate-700">${prop.acquisition_cost.toLocaleString()}</strong></span>}
                                          {prop.acquisition_date && <span>Acquired: <strong className="text-slate-700">{prop.acquisition_date}</strong></span>}
                                        </div>
                                      )}
                                    </div>

                                    <div className="text-right pl-5 sm:pl-0">
                                      <span className="text-xs font-mono font-bold text-slate-800">
                                        {prop.units_count} Unit(s)
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entity Setup Interview Wizard */}
      <EntitySetupWizardModal
        isOpen={isEntityWizardOpen}
        onClose={() => setIsEntityWizardOpen(false)}
        existingCompanies={companies}
        onSuccess={() => {
          fetchHierarchy();
          onRefresh();
        }}
      />
    </div>
  );
};
