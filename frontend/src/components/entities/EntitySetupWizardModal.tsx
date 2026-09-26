import React, { useState } from 'react';
import { 
  Building, 
  Layers, 
  Briefcase, 
  User, 
  Users, 
  Home, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Landmark, 
  HelpCircle, 
  FileText, 
  Phone, 
  MapPin, 
  Check, 
  FolderPlus,
  ShieldCheck,
  Sparkles,
  Plus,
  Trash2,
  ListPlus,
  DollarSign,
  FileSpreadsheet,
  Upload,
  Search,
  RefreshCw
} from 'lucide-react';
import { 
  Company, 
  EntityInterviewPayload, 
  EntityItemPayload, 
  PropertyItemPayload, 
  ApartmentUnitItem, 
  US_STATES,
  QuickBooksCoaPreviewResult,
  QuickBooksAccountItem
} from '../../types';
import { api } from '../../services/api';

interface EntitySetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (created: { company: Company | null; class_entity: any; property: any; created_new_company_file?: boolean }) => void;
  existingCompanies?: Company[];
  isCreatingNewCompany?: boolean;
}

export const EntitySetupWizardModal: React.FC<EntitySetupWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingCompanies = [],
  isCreatingNewCompany = false
}) => {
  // Wizard Step: 1 = Portfolio Question, 2 = Entity Type, 3 = Entity Detailed Fields, 4 = Optional Property, 5 = Review
  const [step, setStep] = useState<number>(1);

  // STEP 1: Portfolio Structure State
  const [hasMultipleLLCs, setHasMultipleLLCs] = useState<boolean | null>(null);
  const [portfolioName, setPortfolioName] = useState<string>('');
  const [portfolioEin, setPortfolioEin] = useState<string>('');
  const [portfolioNotes, setPortfolioNotes] = useState<string>('');
  const [selectedExistingCompId, setSelectedExistingCompId] = useState<number | ''>('');
  const [coaMode, setCoaMode] = useState<'DEFAULT' | 'CUSTOM' | 'QUICKBOOKS'>('DEFAULT');
  const [qbFile, setQbFile] = useState<File | null>(null);
  const [qbLoading, setQbLoading] = useState<boolean>(false);
  const [qbError, setQbError] = useState<string | null>(null);
  const [qbPreview, setQbPreview] = useState<QuickBooksCoaPreviewResult | null>(null);
  const [qbSearchQuery, setQbSearchQuery] = useState<string>('');
  const [qbIsDragOver, setQbIsDragOver] = useState<boolean>(false);

  const handleQbFileSelect = async (selectedFile: File) => {
    setQbError(null);
    const fname = selectedFile.name.toLowerCase();
    if (!fname.endsWith('.xlsx') && !fname.endsWith('.xls') && !fname.endsWith('.csv') && !fname.endsWith('.txt') && !fname.endsWith('.iif')) {
      setQbError('Please upload a valid Excel file (.xlsx, .xls), CSV export (.csv), or IIF list (.iif) from QuickBooks.');
      return;
    }
    setQbFile(selectedFile);
    setQbLoading(true);
    try {
      const res = await api.previewQuickBooksCoa(selectedFile);
      setQbPreview(res);
      setCoaMode('QUICKBOOKS');
    } catch (err: any) {
      setQbError(err.message || 'Failed to read QuickBooks export file. Please check file format.');
      setQbPreview(null);
    } finally {
      setQbLoading(false);
    }
  };

  // Common Portfolio / Company Expense Class (Common to all)
  const [includeCommonClass, setIncludeCommonClass] = useState<boolean>(true);
  const [commonClassName, setCommonClassName] = useState<string>('Portfolio / Company Expense');
  const [commonPropertyName, setCommonPropertyName] = useState<string>('Portfolio / Company Overhead');

  // Multi-Entity Staging State
  const [stagedEntities, setStagedEntities] = useState<EntityItemPayload[]>([]);

  // STEP 2: Business Type
  const [entityType, setEntityType] = useState<'CORP' | 'LLC' | 'SELF_EMPLOYED' | 'COMMON'>('LLC');

  // STEP 3: Detailed Fields
  // Corp specific
  const [corpType, setCorpType] = useState<'S_CORP' | 'C_CORP'>('S_CORP');

  // LLC specific
  const [llcStructure, setLlcStructure] = useState<'SINGLE_MEMBER' | 'MULTI_MEMBER'>('SINGLE_MEMBER');
  const [multiMemberTaxElection, setMultiMemberTaxElection] = useState<'FORM_1065' | 'FORM_1120S' | 'FORM_1120'>('FORM_1065');

  // Common Entity Info
  const [entityName, setEntityName] = useState<string>('');
  const [tradeNameDba, setTradeNameDba] = useState<string>('');
  const [taxForm, setTaxForm] = useState<string>('Form 1065');
  const [ein, setEin] = useState<string>('');

  // Office Address
  const [officeAddr1, setOfficeAddr1] = useState<string>('');
  const [officeAddr2, setOfficeAddr2] = useState<string>('');
  const [officeCity, setOfficeCity] = useState<string>('');
  const [officeState, setOfficeState] = useState<string>('CO');
  const [officeZip, setOfficeZip] = useState<string>('');

  // Mailing Address
  const [sameAsOffice, setSameAsOffice] = useState<boolean>(true);
  const [mailAddr1, setMailAddr1] = useState<string>('');
  const [mailAddr2, setMailAddr2] = useState<string>('');
  const [mailCity, setMailCity] = useState<string>('');
  const [mailState, setMailState] = useState<string>('CO');
  const [mailZip, setMailZip] = useState<string>('');

  // Contact Info
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');

  // STEP 4: Sub Class Properties Setup State
  const [propertiesList, setPropertiesList] = useState<PropertyItemPayload[]>([]);
  const [isAddingProperty, setIsAddingProperty] = useState<boolean>(true);

  // Property Form Draft State
  const [propSubclassName, setPropSubclassName] = useState<string>('');
  const [propAddr1, setPropAddr1] = useState<string>('');
  const [propAddr2, setPropAddr2] = useState<string>('');
  const [propCity, setPropCity] = useState<string>('');
  const [propState, setPropState] = useState<string>('CO');
  const [propZip, setPropZip] = useState<string>('');
  const [propAcqCost, setPropAcqCost] = useState<string>('');
  const [propAcqDate, setPropAcqDate] = useState<string>('');
  const [isMultifamily, setIsMultifamily] = useState<boolean>(false);
  const [multifamilyMode, setMultifamilyMode] = useState<'WHOLE' | 'INDIVIDUAL_UNITS'>('INDIVIDUAL_UNITS');
  const [apartmentCount, setApartmentCount] = useState<number>(2);
  const [apartmentUnits, setApartmentUnits] = useState<ApartmentUnitItem[]>([
    { unit_number: 'Apt 1', sub_class_name: '' },
    { unit_number: 'Apt 2', sub_class_name: '' }
  ]);

  // Initial Bank Opening Balance State
  const [initialBankOpeningBalance, setInitialBankOpeningBalance] = useState<string>('');
  const [initialBankOpeningDate, setInitialBankOpeningDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-populate default Tax Form when legal structure changes
  const handleEntityTypeChange = (type: 'CORP' | 'LLC' | 'SELF_EMPLOYED' | 'COMMON') => {
    setEntityType(type);
    if (type === 'CORP') {
      setTaxForm(corpType === 'S_CORP' ? 'Form 1120-S' : 'Form 1120');
    } else if (type === 'LLC') {
      if (llcStructure === 'SINGLE_MEMBER') {
        setTaxForm('Schedule E / Disregarded');
      } else {
        setTaxForm(multiMemberTaxElection === 'FORM_1065' ? 'Form 1065' : 'Form 1120-S');
      }
    } else if (type === 'SELF_EMPLOYED') {
      setTaxForm('Schedule C');
    } else if (type === 'COMMON') {
      setEntityName('Portfolio / Company Expense');
      setTradeNameDba('Common Portfolio Overhead');
      setTaxForm('N/A (Common Overhead)');
      setContactName('Portfolio Admin');
      setContactPhone('(555) 000-0000');
    }
  };

  const handleNextFromStep1 = () => {
    if (hasMultipleLLCs === null) {
      setErrorMsg('Please answer whether you have multiple LLCs/Organizations to setup.');
      return;
    }
    if (hasMultipleLLCs && !portfolioName.trim() && !selectedExistingCompId) {
      setErrorMsg('Please specify your Portfolio File name.');
      return;
    }
    if (coaMode === 'QUICKBOOKS' && !qbPreview) {
      setErrorMsg('Please upload your QuickBooks Excel or CSV file to import, or choose another Chart of Accounts option.');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleNextFromStep2 = () => {
    setErrorMsg(null);
    // Update tax form default for step 3
    if (entityType === 'CORP') {
      setTaxForm(corpType === 'S_CORP' ? 'Form 1120-S' : 'Form 1120');
    } else if (entityType === 'LLC') {
      if (llcStructure === 'SINGLE_MEMBER') {
        setTaxForm('Schedule E (Rental Real Estate)');
      } else {
        setTaxForm(multiMemberTaxElection === 'FORM_1065' ? 'Form 1065 (Partnership)' : 'Form 1120-S (S-Corp Election)');
      }
    } else if (entityType === 'COMMON') {
      setTaxForm('N/A (Common Overhead)');
    } else {
      setTaxForm('Schedule C (Sole Proprietor)');
    }
    setStep(3);
  };

  const handleNextFromStep3 = () => {
    if (!entityName.trim()) {
      setErrorMsg(
        entityType === 'SELF_EMPLOYED'
          ? 'Please enter the Business or Owner Legal Name.'
          : entityType === 'CORP'
          ? 'Please enter the Corporate Legal Name.'
          : entityType === 'COMMON'
          ? 'Please enter the Common Class Name.'
          : 'Please enter the LLC Legal Name.'
      );
      return;
    }

    if (!contactName.trim()) {
      if (entityType === 'COMMON') {
        setContactName('Portfolio Admin');
      } else {
        setErrorMsg(
          entityType === 'CORP'
            ? 'Please enter the Contact Person (Officer / Controller).'
            : entityType === 'LLC'
            ? 'Please enter the Managing Member or Primary Contact.'
            : 'Please enter the Business Owner Name.'
        );
        return;
      }
    }

    if (!contactPhone.trim()) {
      if (entityType === 'COMMON') {
        setContactPhone('(555) 000-0000');
      } else {
        setErrorMsg('Please provide a Contact Phone Number.');
        return;
      }
    }

    // For COMMON class, automatically prepare default overhead sub-class property if list is empty
    if (entityType === 'COMMON' && propertiesList.length === 0) {
      setPropertiesList([{
        name: commonPropertyName.trim() || 'Portfolio / Company Overhead',
        address_line1: 'Portfolio-Wide Overhead',
        city: 'Corporate',
        state: 'CO',
        zip_code: '00000',
        property_type: 'Common Overhead',
        units_count: 0
      }]);
      setIsAddingProperty(false);
    }

    setErrorMsg(null);
    setStep(4);
  };

  const resetPropertyForm = () => {
    setPropSubclassName('');
    setPropAddr1('');
    setPropAddr2('');
    setPropCity('');
    setPropState('CO');
    setPropZip('');
    setPropAcqCost('');
    setPropAcqDate('');
    setIsMultifamily(false);
    setMultifamilyMode('INDIVIDUAL_UNITS');
    setApartmentCount(2);
    setApartmentUnits([
      { unit_number: 'Apt 1', sub_class_name: '' },
      { unit_number: 'Apt 2', sub_class_name: '' }
    ]);
  };

  const handleApartmentCountChange = (count: number) => {
    const num = Math.max(1, Math.min(100, count));
    setApartmentCount(num);
    setApartmentUnits(prev => {
      const updated: ApartmentUnitItem[] = [];
      for (let i = 0; i < num; i++) {
        if (i < prev.length) {
          updated.push(prev[i]);
        } else {
          const unitNum = `Apt ${i + 1}`;
          updated.push({
            unit_number: unitNum,
            sub_class_name: propAddr1.trim() ? `${propAddr1.trim()} - ${unitNum}` : unitNum
          });
        }
      }
      return updated;
    });
  };

  const handleUpdateUnit = (index: number, field: keyof ApartmentUnitItem, value: any) => {
    setApartmentUnits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSavePropertyToList = (): boolean => {
    const name = propSubclassName.trim() || propAddr1.trim();
    if (!name) {
      setErrorMsg('Please enter a Sub Class name (street number or property name).');
      return false;
    }
    if (!propAddr1.trim()) {
      setErrorMsg('Please enter Street Address Line 1.');
      return false;
    }
    if (!propCity.trim()) {
      setErrorMsg('Please enter City.');
      return false;
    }
    if (!propZip.trim()) {
      setErrorMsg('Please enter ZIP Code.');
      return false;
    }

    if (isMultifamily && multifamilyMode === 'INDIVIDUAL_UNITS') {
      const hasEmptyUnit = apartmentUnits.some(u => !u.unit_number.trim());
      if (hasEmptyUnit) {
        setErrorMsg('Please specify a unit/apartment number for every apartment space.');
        return false;
      }
    }

    setErrorMsg(null);

    const newProp: PropertyItemPayload = {
      name: name,
      address_line1: propAddr1.trim(),
      address_line2: propAddr2.trim() || undefined,
      city: propCity.trim(),
      state: propState || 'CO',
      zip_code: propZip.trim(),
      property_type: isMultifamily ? 'Multi-Family' : 'Residential',
      units_count: isMultifamily && multifamilyMode === 'INDIVIDUAL_UNITS' ? apartmentUnits.length : 1,
      acquisition_cost: propAcqCost ? parseFloat(propAcqCost) : undefined,
      acquisition_date: propAcqDate.trim() || undefined,
      is_multifamily: isMultifamily,
      multifamily_mode: isMultifamily ? multifamilyMode : undefined,
      apartment_units: isMultifamily && multifamilyMode === 'INDIVIDUAL_UNITS'
        ? apartmentUnits.map(u => ({
            unit_number: u.unit_number.trim(),
            sub_class_name: u.sub_class_name?.trim() || `${propAddr1.trim()} - ${u.unit_number.trim()}`,
            acquisition_cost: u.acquisition_cost,
            acquisition_date: u.acquisition_date
          }))
        : undefined
    };

    setPropertiesList(prev => [...prev, newProp]);
    resetPropertyForm();
    setIsAddingProperty(false);
    return true;
  };

  const resetEntityForm = () => {
    setEntityName('');
    setTradeNameDba('');
    setEin('');
    setTaxForm('Form 1065');
    setOfficeAddr1('');
    setOfficeAddr2('');
    setOfficeCity('');
    setOfficeState('CO');
    setOfficeZip('');
    setSameAsOffice(true);
    setMailAddr1('');
    setMailAddr2('');
    setMailCity('');
    setMailState('CO');
    setMailZip('');
    setContactName('');
    setContactPhone('');
    setPropertiesList([]);
    resetPropertyForm();
  };

  const handleStageCurrentEntityAndAddAnother = (): boolean => {
    // If user has begun typing a property draft, save it first
    if (isAddingProperty && (propSubclassName.trim() || propAddr1.trim())) {
      const ok = handleSavePropertyToList();
      if (!ok) return false;
    }

    if (!entityName.trim()) {
      setErrorMsg('Please enter an Entity / LLC Name before adding another entity.');
      return false;
    }

    let taxClassification = 'LLC';
    if (entityType === 'CORP') {
      taxClassification = corpType;
    } else if (entityType === 'LLC') {
      taxClassification = llcStructure === 'SINGLE_MEMBER' ? 'SINGLE_MEMBER_DISREGARDED' : 'MULTI_MEMBER';
    } else if (entityType === 'SELF_EMPLOYED') {
      taxClassification = 'SOLE_PROPRIETOR';
    } else if (entityType === 'COMMON') {
      taxClassification = 'PORTFOLIO_OVERHEAD';
    }

    const newEnt: EntityItemPayload = {
      entity_name: entityName.trim(),
      entity_type: entityType,
      tax_classification: taxClassification,
      tax_form: taxForm.trim() || undefined,
      ein: ein.trim() || undefined,
      description: tradeNameDba ? `DBA: ${tradeNameDba}` : undefined,
      office_address_line1: officeAddr1.trim() || undefined,
      office_address_line2: officeAddr2.trim() || undefined,
      office_city: officeCity.trim() || undefined,
      office_state: officeState.trim() || undefined,
      office_zip: officeZip.trim() || undefined,
      mailing_same_as_office: sameAsOffice,
      mailing_address_line1: sameAsOffice ? (officeAddr1.trim() || undefined) : (mailAddr1.trim() || undefined),
      mailing_address_line2: sameAsOffice ? (officeAddr2.trim() || undefined) : (mailAddr2.trim() || undefined),
      mailing_city: sameAsOffice ? (officeCity.trim() || undefined) : (mailCity.trim() || undefined),
      mailing_state: sameAsOffice ? (officeState.trim() || undefined) : (mailState.trim() || undefined),
      mailing_zip: sameAsOffice ? (officeZip.trim() || undefined) : (mailZip.trim() || undefined),
      contact_name: contactName.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      properties: propertiesList
    };

    setStagedEntities(prev => [...prev, newEnt]);
    resetEntityForm();
    setErrorMsg(null);
    setStep(2); // Jump back to Step 2 to configure next entity in portfolio
    return true;
  };

  const handleDeletePropertyFromList = (index: number) => {
    setPropertiesList(prev => prev.filter((_, i) => i !== index));
  };

  const handleNextFromStep4 = () => {
    // If user has begun typing a property in draft, attempt to save it
    if (isAddingProperty && (propSubclassName.trim() || propAddr1.trim())) {
      const ok = handleSavePropertyToList();
      if (!ok) return;
    }
    setErrorMsg(null);
    setStep(5);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      // Build final entities list
      let finalEntities: EntityItemPayload[] = [...stagedEntities];

      // If user has an entity currently active in form fields, stage it
      if (entityName.trim()) {
        let taxClassification = 'LLC';
        if (entityType === 'CORP') {
          taxClassification = corpType;
        } else if (entityType === 'LLC') {
          taxClassification = llcStructure === 'SINGLE_MEMBER' ? 'SINGLE_MEMBER_DISREGARDED' : 'MULTI_MEMBER';
        } else if (entityType === 'SELF_EMPLOYED') {
          taxClassification = 'SOLE_PROPRIETOR';
        } else if (entityType === 'COMMON') {
          taxClassification = 'PORTFOLIO_OVERHEAD';
        }

        finalEntities.push({
          entity_name: entityName.trim(),
          entity_type: entityType,
          tax_classification: taxClassification,
          tax_form: taxForm.trim() || undefined,
          ein: ein.trim() || undefined,
          description: tradeNameDba ? `DBA: ${tradeNameDba}` : undefined,
          office_address_line1: officeAddr1.trim() || undefined,
          office_address_line2: officeAddr2.trim() || undefined,
          office_city: officeCity.trim() || undefined,
          office_state: officeState.trim() || undefined,
          office_zip: officeZip.trim() || undefined,
          mailing_same_as_office: sameAsOffice,
          mailing_address_line1: sameAsOffice ? (officeAddr1.trim() || undefined) : (mailAddr1.trim() || undefined),
          mailing_address_line2: sameAsOffice ? (officeAddr2.trim() || undefined) : (mailAddr2.trim() || undefined),
          mailing_city: sameAsOffice ? (officeCity.trim() || undefined) : (mailCity.trim() || undefined),
          mailing_state: sameAsOffice ? (officeState.trim() || undefined) : (mailState.trim() || undefined),
          mailing_zip: sameAsOffice ? (officeZip.trim() || undefined) : (mailZip.trim() || undefined),
          contact_name: contactName.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          properties: propertiesList
        });
      }

      const primaryEntity = finalEntities.length > 0 ? finalEntities[0] : null;

      const payload: EntityInterviewPayload = {
        is_portfolio: Boolean(hasMultipleLLCs),
        portfolio_name: hasMultipleLLCs ? portfolioName.trim() : undefined,
        portfolio_ein: portfolioEin.trim() || undefined,
        portfolio_notes: portfolioNotes.trim() || undefined,
        company_id: isCreatingNewCompany ? undefined : (selectedExistingCompId ? Number(selectedExistingCompId) : undefined),
        create_new_company_file: Boolean(isCreatingNewCompany),
        include_common_class: includeCommonClass,
        common_class_name: includeCommonClass ? (commonClassName.trim() || 'Portfolio / Company Expense') : undefined,
        common_property_name: includeCommonClass ? (commonPropertyName.trim() || 'Portfolio / Company Overhead') : undefined,
        coa_mode: coaMode,
        quickbooks_accounts: coaMode === 'QUICKBOOKS' && qbPreview ? qbPreview.accounts : undefined,
        entities: finalEntities,

        entity_name: primaryEntity ? primaryEntity.entity_name : entityName.trim(),
        entity_type: primaryEntity ? primaryEntity.entity_type : entityType,
        tax_classification: primaryEntity ? primaryEntity.tax_classification : undefined,
        tax_form: primaryEntity ? primaryEntity.tax_form : taxForm.trim() || undefined,
        ein: primaryEntity ? primaryEntity.ein : ein.trim() || undefined,
        description: primaryEntity ? primaryEntity.description : (tradeNameDba ? `DBA: ${tradeNameDba}` : undefined),

        office_address_line1: primaryEntity ? primaryEntity.office_address_line1 : (officeAddr1.trim() || undefined),
        office_address_line2: primaryEntity ? primaryEntity.office_address_line2 : (officeAddr2.trim() || undefined),
        office_city: primaryEntity ? primaryEntity.office_city : (officeCity.trim() || undefined),
        office_state: primaryEntity ? primaryEntity.office_state : (officeState.trim() || undefined),
        office_zip: primaryEntity ? primaryEntity.office_zip : (officeZip.trim() || undefined),

        mailing_same_as_office: primaryEntity ? primaryEntity.mailing_same_as_office : sameAsOffice,
        mailing_address_line1: primaryEntity ? primaryEntity.mailing_address_line1 : (sameAsOffice ? (officeAddr1.trim() || undefined) : (mailAddr1.trim() || undefined)),
        mailing_address_line2: primaryEntity ? primaryEntity.mailing_address_line2 : (sameAsOffice ? (officeAddr2.trim() || undefined) : (mailAddr2.trim() || undefined)),
        mailing_city: primaryEntity ? primaryEntity.mailing_city : (sameAsOffice ? (officeCity.trim() || undefined) : (mailCity.trim() || undefined)),
        mailing_state: primaryEntity ? primaryEntity.mailing_state : (sameAsOffice ? (officeState.trim() || undefined) : (mailState.trim() || undefined)),
        mailing_zip: primaryEntity ? primaryEntity.mailing_zip : (sameAsOffice ? (officeZip.trim() || undefined) : (mailZip.trim() || undefined)),

        contact_name: primaryEntity ? primaryEntity.contact_name : (contactName.trim() || undefined),
        contact_phone: primaryEntity ? primaryEntity.contact_phone : (contactPhone.trim() || undefined),

        properties: primaryEntity ? (primaryEntity.properties || []) : propertiesList,

        // Initial Bank Opening Balance
        initial_bank_opening_balance: initialBankOpeningBalance.trim() ? parseFloat(initialBankOpeningBalance) : undefined,
        initial_bank_opening_date: initialBankOpeningBalance.trim() ? (initialBankOpeningDate.trim() || undefined) : undefined,

        // Backwards compatibility for single property fields
        initial_property_name: (primaryEntity?.properties && primaryEntity.properties.length > 0) ? primaryEntity.properties[0].name : (propertiesList.length > 0 ? propertiesList[0].name : undefined),
        initial_property_address: (primaryEntity?.properties && primaryEntity.properties.length > 0)
          ? `${primaryEntity.properties[0].address_line1}${primaryEntity.properties[0].address_line2 ? ' ' + primaryEntity.properties[0].address_line2 : ''}, ${primaryEntity.properties[0].city}, ${primaryEntity.properties[0].state} ${primaryEntity.properties[0].zip_code}`
          : (propertiesList.length > 0 
              ? `${propertiesList[0].address_line1}${propertiesList[0].address_line2 ? ' ' + propertiesList[0].address_line2 : ''}, ${propertiesList[0].city}, ${propertiesList[0].state} ${propertiesList[0].zip_code}`
              : undefined),
        initial_property_type: (primaryEntity?.properties && primaryEntity.properties.length > 0) ? primaryEntity.properties[0].property_type : (propertiesList.length > 0 ? propertiesList[0].property_type : undefined),
        initial_property_units: (primaryEntity?.properties && primaryEntity.properties.length > 0) ? primaryEntity.properties[0].units_count : (propertiesList.length > 0 ? propertiesList[0].units_count : undefined),
      };

      const result = await api.setupEntityInterview(payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete entity interview setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center space-x-2">
                <span>{isCreatingNewCompany ? 'Create New Company & Entity Setup' : 'Entity Setup Interview'}</span>
                <span className="text-xs font-normal text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
                  Step {step} of 5
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCreatingNewCompany 
                  ? 'QuickBooks EasyStep guided interview to establish your new company file, legal structure, and entities.'
                  : 'Guided setup for Portfolios, LLCs, Corporations, and Self-Employed real estate entities.'}
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

        {/* Progress Tracker Bar */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500">
          <div className={`flex items-center space-x-1.5 ${step === 1 ? 'text-emerald-700' : step > 1 ? 'text-slate-800' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-emerald-600 text-white' : step > 1 ? 'bg-slate-700 text-white' : 'bg-slate-200'}`}>1</span>
            <span>Portfolio</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-300" />
          <div className={`flex items-center space-x-1.5 ${step === 2 ? 'text-emerald-700' : step > 2 ? 'text-slate-800' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-emerald-600 text-white' : step > 2 ? 'bg-slate-700 text-white' : 'bg-slate-200'}`}>2</span>
            <span>Structure</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-300" />
          <div className={`flex items-center space-x-1.5 ${step === 3 ? 'text-emerald-700' : step > 3 ? 'text-slate-800' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-emerald-600 text-white' : step > 3 ? 'bg-slate-700 text-white' : 'bg-slate-200'}`}>3</span>
            <span>Details &amp; Tax</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-300" />
          <div className={`flex items-center space-x-1.5 ${step === 4 ? 'text-emerald-700' : step > 4 ? 'text-slate-800' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 4 ? 'bg-emerald-600 text-white' : step > 4 ? 'bg-slate-700 text-white' : 'bg-slate-200'}`}>4</span>
            <span>Sub-Classes</span>
          </div>
          <div className="w-6 h-0.5 bg-slate-300" />
          <div className={`flex items-center space-x-1.5 ${step === 5 ? 'text-emerald-700' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 5 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>5</span>
            <span>Review</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* STEP 1: PORTFOLIO STRUCTURE QUESTION                */}
          {/* ==================================================== */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Question 1: Portfolio Structure
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Do you have multiple LLCs or Organizations you want to set up as one unified Portfolio?
                </h3>
                <p className="text-xs text-slate-600">
                  A Portfolio file groups multiple distinct legal entities (e.g. separate LLCs for different properties) under one consolidated umbrella for portfolio-wide P&amp;L reporting and centralized check registers.
                </p>
              </div>

              {/* Two Option Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* YES: Multiple LLCs as one Portfolio */}
                <div
                  onClick={() => setHasMultipleLLCs(true)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    hasMultipleLLCs === true
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                      <FolderPlus className="w-6 h-6" />
                    </div>
                    <input
                      type="radio"
                      name="portfolio_choice"
                      checked={hasMultipleLLCs === true}
                      onChange={() => setHasMultipleLLCs(true)}
                      className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">Yes, create a Portfolio File</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      I manage multiple LLCs, partnerships, or holding companies. Create a Portfolio file that will include LLC/Organization setups underneath it.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center text-[11px] font-bold text-emerald-700">
                    <span>Includes Portfolio-wide Rollup P&amp;L</span>
                  </div>
                </div>

                {/* NO: Standalone Single Entity */}
                <div
                  onClick={() => setHasMultipleLLCs(false)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    hasMultipleLLCs === false
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                      <Building className="w-6 h-6" />
                    </div>
                    <input
                      type="radio"
                      name="portfolio_choice"
                      checked={hasMultipleLLCs === false}
                      onChange={() => setHasMultipleLLCs(false)}
                      className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">No, single entity setup</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      I am setting up an independent, single operating entity (LLC, Corporation, or Self-Employed business). Go straight to LLC/Organization setup.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center text-[11px] font-bold text-blue-700">
                    <span>Direct Single Entity Structure</span>
                  </div>
                </div>
              </div>

              {/* Conditional Portfolio Fields when YES is selected */}
              {hasMultipleLLCs === true && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Portfolio File Configuration:
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="font-bold text-slate-800">Portfolio File Name: *</label>
                      <input
                        type="text"
                        value={portfolioName}
                        onChange={(e) => setPortfolioName(e.target.value)}
                        placeholder="e.g. Apex Real Estate Portfolio Holdings"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      <p className="text-[11px] text-slate-500">This will be the parent file name that contains your LLCs.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800">Portfolio Tax ID / EIN (Optional):</label>
                      <input
                        type="text"
                        value={portfolioEin}
                        onChange={(e) => setPortfolioEin(e.target.value)}
                        placeholder="XX-XXXXXXX"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800">Portfolio Notes / Memo (Optional):</label>
                      <input
                        type="text"
                        value={portfolioNotes}
                        onChange={(e) => setPortfolioNotes(e.target.value)}
                        placeholder="e.g. Commercial &amp; Residential multi-property umbrella"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Chart of Accounts Preference */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Chart of Accounts Preference:
                  </h4>
                </div>
                <p className="text-xs text-slate-600">
                  Select whether you want to use our default real estate chart of accounts, or start with your own custom base structure:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div
                    onClick={() => setCoaMode('DEFAULT')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      coaMode === 'DEFAULT'
                        ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-slate-900 text-xs">Standard Real Estate COA</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Recommended</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Pre-loaded with comprehensive accounts: Operating Checking, Security Deposits Escrow, Rental Income, Repairs, Mortgages, HOA, and Utilities.
                    </p>
                  </div>

                  <div
                    onClick={() => setCoaMode('CUSTOM')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      coaMode === 'CUSTOM'
                        ? 'border-purple-600 bg-white ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-slate-900 text-xs">Create Custom Base COA</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">8-Base Accounts</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Starts with your 8 clean foundational accounts: 10000 Assets, 20000 Liabilities, 30000 Equity, 40000 Revenue, 50000 Flips, 60000/70000 OpEx, 80000 Other.
                    </p>
                  </div>

                  <div
                    onClick={() => setCoaMode('QUICKBOOKS')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between space-y-2 ${
                      coaMode === 'QUICKBOOKS'
                        ? 'border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-slate-900 text-xs">Import from QuickBooks</div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Excel / CSV</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Upload your QuickBooks Desktop or Online Chart of Accounts export. We detect sub-accounts, categories, and opening balances.
                    </p>
                  </div>
                </div>

                {/* QuickBooks Import Dropzone & Live Preview */}
                {coaMode === 'QUICKBOOKS' && (
                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                    {!qbPreview ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setQbIsDragOver(true); }}
                        onDragLeave={() => setQbIsDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setQbIsDragOver(false);
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            handleQbFileSelect(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center space-y-3 ${
                          qbIsDragOver
                            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
                            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-xs">
                          {qbLoading ? (
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                          ) : (
                            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <h5 className="text-sm font-bold text-slate-900">
                            {qbLoading ? 'Analyzing QuickBooks Export...' : 'Upload QuickBooks Chart of Accounts File'}
                          </h5>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Drag and drop your exported Excel file (<strong>.xlsx</strong>, <strong>.xls</strong>) or <strong>.csv</strong> here, or browse files on your computer.
                          </p>
                        </div>

                        {qbError && (
                          <div className="w-full max-w-md p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2 text-left">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{qbError}</span>
                          </div>
                        )}

                        <div className="pt-1">
                          <label className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition">
                            <Upload className="w-4 h-4" />
                            <span>Select QuickBooks File</span>
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv,.tsv,.txt,.iif"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleQbFileSelect(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <div className="text-[11px] text-slate-400 pt-1">
                          Tip: In QuickBooks Desktop, open <em>Lists &gt; Chart of Accounts</em>, right-click and choose <em>Export to Excel</em> or <em>Print &gt; File</em>.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4 p-4">
                        {/* Preview Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                              <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h5 className="font-extrabold text-sm text-slate-900">{qbPreview.filename}</h5>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                  {qbPreview.sheet_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                QuickBooks Chart of Accounts parsed successfully
                              </p>
                            </div>
                          </div>

                          <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Replace File</span>
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv,.tsv,.txt"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleQbFileSelect(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Summary Badges Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Total Accounts</div>
                            <div className="text-base font-black text-slate-900">{qbPreview.summary.total_accounts}</div>
                          </div>
                          <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                            <div className="text-[10px] font-bold text-indigo-500 uppercase">Sub-Accounts</div>
                            <div className="text-base font-black text-indigo-900">{qbPreview.summary.sub_accounts_count}</div>
                          </div>
                          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                            <div className="text-[10px] font-bold text-emerald-600 uppercase">Assets Total</div>
                            <div className="text-sm font-black text-emerald-900">
                              ${qbPreview.summary.total_assets_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                            <div className="text-[10px] font-bold text-amber-600 uppercase">Liabilities Total</div>
                            <div className="text-sm font-black text-amber-900">
                              ${qbPreview.summary.total_liabilities_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-100">
                            <div className="text-[10px] font-bold text-purple-600 uppercase">Equity Total</div>
                            <div className="text-sm font-black text-purple-900">
                              ${qbPreview.summary.total_equity_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        {/* Search and Table */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              value={qbSearchQuery}
                              onChange={(e) => setQbSearchQuery(e.target.value)}
                              placeholder="Search imported accounts by number, name, or parent..."
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 text-slate-600 sticky top-0 font-bold border-b border-slate-200 z-10">
                                <tr>
                                  <th className="py-2 px-3">Account #</th>
                                  <th className="py-2 px-3">Account Name &amp; Hierarchy</th>
                                  <th className="py-2 px-3">Category Type</th>
                                  <th className="py-2 px-3">Detail Sub-Type</th>
                                  <th className="py-2 px-3 text-right">Balance Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {qbPreview.accounts
                                  .filter(a => {
                                    if (!qbSearchQuery.trim()) return true;
                                    const q = qbSearchQuery.toLowerCase();
                                    return (
                                      (a.account_number && a.account_number.toLowerCase().includes(q)) ||
                                      a.name.toLowerCase().includes(q) ||
                                      (a.parent_account_name && a.parent_account_name.toLowerCase().includes(q)) ||
                                      a.type.toLowerCase().includes(q) ||
                                      (a.sub_type && a.sub_type.toLowerCase().includes(q))
                                    );
                                  })
                                  .map((a, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                                      <td className="py-1.5 px-3 font-mono text-[11px] font-bold text-slate-700">
                                        {a.account_number || <span className="text-slate-400 italic">Auto</span>}
                                      </td>
                                      <td className="py-1.5 px-3">
                                        <div
                                          style={{ paddingLeft: `${Math.min(a.level * 16, 48)}px` }}
                                          className="flex items-center space-x-1.5"
                                        >
                                          {a.level > 0 && (
                                            <span className="text-indigo-400 font-bold text-xs select-none">↳</span>
                                          )}
                                          <span className={`font-semibold text-slate-900 ${a.level > 0 ? 'text-indigo-950' : ''}`}>
                                            {a.name}
                                          </span>
                                          {a.level > 0 && a.parent_account_name && (
                                            <span className="text-[10px] text-slate-400">
                                              (sub-account of {a.parent_account_name})
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          a.type === 'ASSET'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : a.type === 'LIABILITY'
                                            ? 'bg-amber-100 text-amber-800'
                                            : a.type === 'EQUITY'
                                            ? 'bg-purple-100 text-purple-800'
                                            : a.type === 'INCOME'
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          {a.type}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 text-[11px] text-slate-600">
                                        {a.sub_type || a.qb_type || 'General'}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono text-[11px] font-semibold">
                                        {a.balance_total !== 0 ? (
                                          <span className={a.balance_total < 0 ? 'text-rose-600' : 'text-slate-900'}>
                                            ${a.balance_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">$0.00</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>{qbPreview.summary.valid_accounts} accounts mapped</strong> ({qbPreview.summary.sub_accounts_count} hierarchical sub-accounts). These will be created when setup finishes.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Common Portfolio / Company Expense Class (Common to all) */}
              <div className="p-5 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-black text-slate-900">
                          Shared Portfolio / Company Expense Class
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Common to All
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Create a dedicated shared class for expenses that cannot be classified to any single LLC or property (e.g., <strong>telephone bills</strong>, corporate legal/tax fees, accounting software subscriptions, portfolio-wide insurance).
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={includeCommonClass}
                      onChange={(e) => setIncludeCommonClass(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {includeCommonClass && (
                  <div className="p-4 bg-white rounded-xl border border-indigo-100 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-800 flex items-center justify-between">
                          <span>Common Class Name: *</span>
                          <span className="text-[10px] text-indigo-600 font-medium">Shared Parent Class</span>
                        </label>
                        <input
                          type="text"
                          value={commonClassName}
                          onChange={(e) => setCommonClassName(e.target.value)}
                          placeholder="e.g. Portfolio / Company Expense"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-800 flex items-center justify-between">
                          <span>Sub-Class / Overhead Property: *</span>
                          <span className="text-[10px] text-indigo-600 font-medium">Attached Sub-Class</span>
                        </label>
                        <input
                          type="text"
                          value={commonPropertyName}
                          onChange={(e) => setCommonPropertyName(e.target.value)}
                          placeholder="e.g. Portfolio / Company Overhead"
                          className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        In Check Register and Bank Import, transactions like telephone bills can be directly classified to <strong>"{commonClassName}"</strong> without associating with any individual LLC.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* STEP 2: BUSINESS LEGAL STRUCTURE (CORP/LLC/SELF)    */}
          {/* ==================================================== */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {stagedEntities.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Configured {stagedEntities.length} LLC{stagedEntities.length === 1 ? '' : 's'} so far:</span>
                    <span className="font-normal text-emerald-700">
                      {stagedEntities.map(e => e.entity_name).join(', ')}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase">
                    Configuring Entity #{stagedEntities.length + 1}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Question 2: LLC / Organization Structure
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {stagedEntities.length > 0 ? `Select Structure for Entity #${stagedEntities.length + 1}:` : 'Are you doing business as a Corporation, LLC, or Self-Employed?'}
                </h3>
                <p className="text-xs text-slate-600">
                  Select your legal entity registration. This configures standard IRS tax forms, address requirements, and officer/managing member disclosures.
                </p>
              </div>

              {/* Entity Type Cards: Corporation vs LLC vs Self-Employed vs Common Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. CORPORATION */}
                <div
                  onClick={() => handleEntityTypeChange('CORP')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    entityType === 'CORP'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <input
                      type="radio"
                      name="entity_type"
                      checked={entityType === 'CORP'}
                      onChange={() => handleEntityTypeChange('CORP')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Corporation</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Setup as a formal Corporation (S-Corp or C-Corp). Requires corporate officers and corporate tax forms.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 w-fit">
                    S-Corp / C-Corp
                  </span>
                </div>

                {/* 2. LLC */}
                <div
                  onClick={() => handleEntityTypeChange('LLC')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    entityType === 'LLC'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <input
                      type="radio"
                      name="entity_type"
                      checked={entityType === 'LLC'}
                      onChange={() => handleEntityTypeChange('LLC')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Limited Liability Co (LLC)</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Standard real estate holding vehicle. Choice between Single-Member (Disregarded) or Multi-Member.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                    Most Popular for Real Estate
                  </span>
                </div>

                {/* 3. SELF EMPLOYED */}
                <div
                  onClick={() => handleEntityTypeChange('SELF_EMPLOYED')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    entityType === 'SELF_EMPLOYED'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                      <User className="w-5 h-5" />
                    </div>
                    <input
                      type="radio"
                      name="entity_type"
                      checked={entityType === 'SELF_EMPLOYED'}
                      onChange={() => handleEntityTypeChange('SELF_EMPLOYED')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Self-Employed / Sole Prop</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Individual landlord, direct property owner, independent contractor or consultant (Schedule C/E).
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                    Individual / Sole Prop
                  </span>
                </div>

                {/* 4. COMMON EXPENSE CLASS */}
                <div
                  onClick={() => handleEntityTypeChange('COMMON')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    entityType === 'COMMON'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <input
                      type="radio"
                      name="entity_type"
                      checked={entityType === 'COMMON'}
                      onChange={() => handleEntityTypeChange('COMMON')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Common / Portfolio Class</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Dedicated class common to all LLCs &amp; properties for shared overhead (e.g. telephone, software, legal).
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 w-fit">
                    Common to All
                  </span>
                </div>
              </div>

              {/* Sub-Classification Choices */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                {entityType === 'CORP' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-800 block">
                      Is this Corporation an S-Corporation or C-Corporation?
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label className={`p-3 rounded-lg border-2 cursor-pointer flex items-center space-x-2 bg-white ${corpType === 'S_CORP' ? 'border-emerald-600 text-emerald-950 font-bold' : 'border-slate-200'}`}>
                        <input
                          type="radio"
                          name="corp_sub_type"
                          checked={corpType === 'S_CORP'}
                          onChange={() => { setCorpType('S_CORP'); setTaxForm('Form 1120-S'); }}
                          className="text-emerald-600"
                        />
                        <div>
                          <div>S-Corporation (Form 1120-S)</div>
                          <span className="text-[10px] font-normal text-slate-500">Pass-through tax election</span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-lg border-2 cursor-pointer flex items-center space-x-2 bg-white ${corpType === 'C_CORP' ? 'border-emerald-600 text-emerald-950 font-bold' : 'border-slate-200'}`}>
                        <input
                          type="radio"
                          name="corp_sub_type"
                          checked={corpType === 'C_CORP'}
                          onChange={() => { setCorpType('C_CORP'); setTaxForm('Form 1120'); }}
                          className="text-emerald-600"
                        />
                        <div>
                          <div>C-Corporation (Form 1120)</div>
                          <span className="text-[10px] font-normal text-slate-500">Standard corporate tax</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {entityType === 'LLC' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-800 block">
                      Is this a Single-Member (Disregarded Entity) or Multi-Member LLC?
                    </label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label className={`p-3 rounded-lg border-2 cursor-pointer flex items-center space-x-2 bg-white ${llcStructure === 'SINGLE_MEMBER' ? 'border-emerald-600 text-emerald-950 font-bold' : 'border-slate-200'}`}>
                        <input
                          type="radio"
                          name="llc_sub_structure"
                          checked={llcStructure === 'SINGLE_MEMBER'}
                          onChange={() => {
                            setLlcStructure('SINGLE_MEMBER');
                            setTaxForm('Schedule E / Disregarded');
                          }}
                          className="text-emerald-600"
                        />
                        <div>
                          <div>Single-Member (Disregarded)</div>
                          <span className="text-[10px] font-normal text-slate-500">Reported on owner's individual return</span>
                        </div>
                      </label>

                      <label className={`p-3 rounded-lg border-2 cursor-pointer flex items-center space-x-2 bg-white ${llcStructure === 'MULTI_MEMBER' ? 'border-emerald-600 text-emerald-950 font-bold' : 'border-slate-200'}`}>
                        <input
                          type="radio"
                          name="llc_sub_structure"
                          checked={llcStructure === 'MULTI_MEMBER'}
                          onChange={() => {
                            setLlcStructure('MULTI_MEMBER');
                            setTaxForm('Form 1065 (Partnership)');
                          }}
                          className="text-emerald-600"
                        />
                        <div>
                          <div>Multi-Member LLC</div>
                          <span className="text-[10px] font-normal text-slate-500">Setup with Corp/Partnership structure</span>
                        </div>
                      </label>
                    </div>

                    {llcStructure === 'MULTI_MEMBER' && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200 mt-2 text-xs space-y-1.5">
                        <span className="font-bold text-slate-700">Multi-Member LLC Tax Treatment:</span>
                        <div className="flex gap-4">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="multi_member_tax"
                              checked={multiMemberTaxElection === 'FORM_1065'}
                              onChange={() => { setMultiMemberTaxElection('FORM_1065'); setTaxForm('Form 1065 (Partnership)'); }}
                              className="text-emerald-600"
                            />
                            <span>Form 1065 (Partnership - Standard)</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="multi_member_tax"
                              checked={multiMemberTaxElection === 'FORM_1120S'}
                              onChange={() => { setMultiMemberTaxElection('FORM_1120S'); setTaxForm('Form 1120-S (S-Corp Election)'); }}
                              className="text-emerald-600"
                            />
                            <span>Form 1120-S (S-Corp Election)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {entityType === 'SELF_EMPLOYED' && (
                  <p className="text-xs text-slate-600">
                    Self-Employed real estate accounts report rental activities on IRS Schedule E or brokerage commissions / management on Schedule C.
                  </p>
                )}

                {entityType === 'COMMON' && (
                  <div className="p-3 bg-white rounded-lg border border-indigo-200 text-xs space-y-2">
                    <div className="flex items-center space-x-2 text-indigo-900 font-bold">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Shared Portfolio / Company Expense Classification</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      This class functions as the master shared overhead expense bucket for transactions that apply across the entire portfolio (e.g., <strong>telephone bills</strong>, central accounting fees, registered agent fees, website/software tools).
                    </p>
                    <div className="text-[11px] text-indigo-700 font-medium">
                      &bull; Tax Form: <strong>N/A (Common Overhead / Rollup)</strong>
                      <br />
                      &bull; Default Sub-Class: <strong>{commonPropertyName || 'Portfolio / Company Overhead'}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* STEP 3: DETAILED FIELDS (ADDRESSES, CONTACT, EIN)    */}
          {/* ==================================================== */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  {entityType === 'CORP'
                    ? 'Corporation Setup Details'
                    : entityType === 'LLC'
                    ? `${llcStructure === 'SINGLE_MEMBER' ? 'Single-Member (Disregarded)' : 'Multi-Member'} LLC Details`
                    : entityType === 'COMMON'
                    ? 'Common / Portfolio Expense Class Details'
                    : 'Self-Employed Entity Details'}
                </h3>
                <p className="text-xs text-slate-500">
                  Please provide legal registration names, physical office address, mailing address, contact information, and EIN.
                </p>
              </div>

              {/* General Names & Identification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 md:col-span-2">
                  <label className="font-bold text-slate-800">
                    {entityType === 'CORP'
                      ? 'Corporation Legal Name: *'
                      : entityType === 'LLC'
                      ? 'LLC Legal Name: *'
                      : entityType === 'COMMON'
                      ? 'Common Class Name: *'
                      : 'Owner / Business Legal Name: *'}
                  </label>
                  <input
                    type="text"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    placeholder={
                      entityType === 'CORP' 
                        ? 'e.g. Paramount Asset Management Corp' 
                        : entityType === 'LLC' 
                        ? 'e.g. 2908 Depot LLC' 
                        : entityType === 'COMMON'
                        ? 'e.g. Portfolio / Company Expense'
                        : 'e.g. Jane Doe Property Management'
                    }
                    className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {entityType === 'SELF_EMPLOYED' && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">Trade Name / DBA (Optional):</label>
                    <input
                      type="text"
                      value={tradeNameDba}
                      onChange={(e) => setTradeNameDba(e.target.value)}
                      placeholder="e.g. Doe Real Estate Holdings"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Federal Tax ID (EIN) {entityType === 'CORP' || (entityType === 'LLC' && llcStructure === 'MULTI_MEMBER') ? '(Recommended):' : '(Optional):'}</label>
                  <input
                    type="text"
                    value={ein}
                    onChange={(e) => setEin(e.target.value)}
                    placeholder="XX-XXXXXXX"
                    className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">IRS Tax Form Used (Optional):</label>
                  <input
                    type="text"
                    value={taxForm}
                    onChange={(e) => setTaxForm(e.target.value)}
                    placeholder="e.g. Form 1120-S, Form 1065, Schedule E"
                    className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono font-medium"
                  />
                </div>
              </div>

              {/* Physical Office Address */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Physical Office Address:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="font-medium text-slate-700">Street Address (Line 1):</label>
                    <input
                      type="text"
                      value={officeAddr1}
                      onChange={(e) => setOfficeAddr1(e.target.value)}
                      placeholder="e.g. 100 Main Street"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Suite / Unit / Line 2:</label>
                    <input
                      type="text"
                      value={officeAddr2}
                      onChange={(e) => setOfficeAddr2(e.target.value)}
                      placeholder="e.g. Suite 400"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">City:</label>
                    <input
                      type="text"
                      value={officeCity}
                      onChange={(e) => setOfficeCity(e.target.value)}
                      placeholder="e.g. Denver"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">State (Dropdown):</label>
                    <select
                      value={officeState}
                      onChange={(e) => setOfficeState(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    >
                      {US_STATES.map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.name} ({st.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">ZIP Code:</label>
                    <input
                      type="text"
                      value={officeZip}
                      onChange={(e) => setOfficeZip(e.target.value)}
                      placeholder="e.g. 80202"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Mailing Address */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mailing Address:</span>
                  </div>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-800 font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={sameAsOffice}
                      onChange={(e) => setSameAsOffice(e.target.checked)}
                      className="text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>Same as Office Address</span>
                  </label>
                </div>

                {!sameAsOffice && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-medium text-slate-700">Mailing Address (Line 1 or PO Box):</label>
                      <input
                        type="text"
                        value={mailAddr1}
                        onChange={(e) => setMailAddr1(e.target.value)}
                        placeholder="e.g. PO Box 1234"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Line 2:</label>
                      <input
                        type="text"
                        value={mailAddr2}
                        onChange={(e) => setMailAddr2(e.target.value)}
                        placeholder="Suite / Box"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">City:</label>
                      <input
                        type="text"
                        value={mailCity}
                        onChange={(e) => setMailCity(e.target.value)}
                        placeholder="City"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">State (Dropdown):</label>
                      <select
                        value={mailState}
                        onChange={(e) => setMailState(e.target.value)}
                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      >
                        {US_STATES.map((st) => (
                          <option key={st.code} value={st.code}>
                            {st.name} ({st.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">ZIP Code:</label>
                      <input
                        type="text"
                        value={mailZip}
                        onChange={(e) => setMailZip(e.target.value)}
                        placeholder="ZIP"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Person Details */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {entityType === 'CORP'
                      ? 'Corporate Officer / Contact Person: *'
                      : entityType === 'LLC'
                      ? 'Managing Member / Contact Person: *'
                      : 'Business Owner Contact: *'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Full Name: *</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Ashish Patel"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Phone Number: *</label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. (303) 555-0145"
                      className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* STEP 4: SUB CLASS MENU & PROPERTIES SETUP           */}
          {/* ==================================================== */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Mandatory Prompt Banner */}
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-xl shadow-xs">
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-emerald-950">
                      "We will setup multiple properties, you wil be give a choice to stop entering properties after each entry."
                    </h4>
                    <p className="text-xs text-emerald-800">
                      <strong>Sub Class Menu:</strong> In QuickBooks / PropBooks architecture, each real estate property and apartment is configured as a <strong>Sub-Class</strong> attached to your legal entity (<strong>{entityName || 'your entity'}</strong>).
                    </p>
                  </div>
                </div>
              </div>

              {/* LIST OF ENTERED PROPERTIES (IF ANY) */}
              {propertiesList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Entered Properties &amp; Sub-Classes ({propertiesList.length})</span>
                    </h4>
                    {!isAddingProperty && (
                      <button
                        type="button"
                        onClick={() => { resetPropertyForm(); setIsAddingProperty(true); }}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Another Property</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {propertiesList.map((p, idx) => (
                      <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-900 text-sm">{p.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {p.is_multifamily
                                ? (p.multifamily_mode === 'INDIVIDUAL_UNITS' ? `Multifamily (${p.apartment_units?.length || 0} Units)` : 'Multifamily (Building as Whole)')
                                : 'Single Property'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.address_line1}{p.address_line2 ? `, ${p.address_line2}` : ''}, {p.city}, {p.state} {p.zip_code}</span>
                          </div>
                          {(p.acquisition_cost || p.acquisition_date) && (
                            <div className="text-[11px] text-slate-500 flex items-center space-x-3 pt-0.5">
                              {p.acquisition_cost && (
                                <span>Acquisition Cost: <strong className="text-slate-800">${p.acquisition_cost.toLocaleString()}</strong></span>
                              )}
                              {p.acquisition_date && (
                                <span>Acquisition Date: <strong className="text-slate-800">{p.acquisition_date}</strong></span>
                              )}
                            </div>
                          )}
                          {p.apartment_units && p.apartment_units.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1.5">
                              {p.apartment_units.map((u, uIdx) => (
                                <span key={uIdx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold border border-slate-200">
                                  {u.unit_number}: {u.sub_class_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePropertyFromList(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remove property"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Choice banner after entering property */}
                  {!isAddingProperty && (
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-emerald-950 font-medium">
                        You have entered <strong>{propertiesList.length}</strong> {propertiesList.length === 1 ? 'property' : 'properties'}. You can stop entering properties now or add another.
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { resetPropertyForm(); setIsAddingProperty(true); }}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>+ Add Another Property</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(5)}
                          className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <span>Proceed to Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PROPERTY ENTRY FORM */}
              {(isAddingProperty || propertiesList.length === 0) && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                        <Home className="w-4 h-4 text-emerald-600" />
                        <span>{propertiesList.length === 0 ? 'Set Up Property / Sub-Class' : `Add Property #${propertiesList.length + 1}`}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">The subclass will be the property address.</p>
                    </div>
                    {propertiesList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAddingProperty(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* MULTIFAMILY QUESTION */}
                  <div className="space-y-2">
                    <label className="font-bold text-slate-800 block text-xs">
                      Do you want to set up a multifamily property (apartment building)?
                      <span className="block font-normal text-slate-500 text-[11px]">
                        Specifically one street address with different apartments number.
                      </span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div
                        onClick={() => setIsMultifamily(true)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center space-x-3 ${
                          isMultifamily
                            ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-xs'
                            : 'border-slate-200 bg-white/70 hover:border-slate-300'
                        }`}
                      >
                        <Building className={`w-5 h-5 ${isMultifamily ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-black text-slate-900 text-xs">Yes, Multifamily (Apartment Building)</div>
                          <div className="text-[10px] text-slate-500">One street address with multiple units / apt numbers</div>
                        </div>
                      </div>

                      <div
                        onClick={() => setIsMultifamily(false)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center space-x-3 ${
                          !isMultifamily
                            ? 'border-emerald-600 bg-white ring-2 ring-emerald-500/20 shadow-xs'
                            : 'border-slate-200 bg-white/70 hover:border-slate-300'
                        }`}
                      >
                        <Home className={`w-5 h-5 ${!isMultifamily ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="font-black text-slate-900 text-xs">No, Single Property / Building</div>
                          <div className="text-[10px] text-slate-500">Single family, commercial, or standalone asset</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* IF MULTIFAMILY: WHOLE VS INDIVIDUAL APARTMENTS */}
                  {isMultifamily && (
                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-4 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-800 block text-xs">
                          Do you want to set up as individual apartments or building as a whole?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <label className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-2.5 bg-white ${multifamilyMode === 'INDIVIDUAL_UNITS' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
                            <input
                              type="radio"
                              name="multifamilyMode"
                              checked={multifamilyMode === 'INDIVIDUAL_UNITS'}
                              onChange={() => setMultifamilyMode('INDIVIDUAL_UNITS')}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-xs">Individual Apartments</div>
                              <div className="text-[10px] text-slate-500">Creates a Sub-Class space for each apartment</div>
                            </div>
                          </label>

                          <label className={`p-3 rounded-lg border cursor-pointer flex items-center space-x-2.5 bg-white ${multifamilyMode === 'WHOLE' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}>
                            <input
                              type="radio"
                              name="multifamilyMode"
                              checked={multifamilyMode === 'WHOLE'}
                              onChange={() => setMultifamilyMode('WHOLE')}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-xs">Building as a Whole</div>
                              <div className="text-[10px] text-slate-500">Single Sub-Class for the entire apartment property</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* SPACES FOR EACH APARTMENT IF INDIVIDUAL */}
                      {multifamilyMode === 'INDIVIDUAL_UNITS' && (
                        <div className="space-y-3 pt-2 border-t border-emerald-200/60">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                              <ListPlus className="w-3.5 h-3.5 text-emerald-600" />
                              <span>How many apartments?</span>
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={apartmentCount}
                                onChange={(e) => handleApartmentCountChange(parseInt(e.target.value) || 1)}
                                className="w-20 bg-white text-slate-900 font-bold border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                              />
                              <span className="text-[11px] text-slate-500">apartments</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                              Spaces for each apartment:
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                              {apartmentUnits.map((unit, uIdx) => (
                                <div key={uIdx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {uIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={unit.unit_number}
                                      onChange={(e) => handleUpdateUnit(uIdx, 'unit_number', e.target.value)}
                                      placeholder={`e.g. Apt ${uIdx + 1}`}
                                      className="w-28 bg-white text-slate-900 font-bold border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                    />
                                    <input
                                      type="text"
                                      value={unit.sub_class_name || ''}
                                      onChange={(e) => handleUpdateUnit(uIdx, 'sub_class_name', e.target.value)}
                                      placeholder={propAddr1 ? `${propAddr1} - ${unit.unit_number}` : `Sub-Class: ${unit.unit_number}`}
                                      className="flex-1 bg-white text-slate-900 font-medium border border-slate-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB CLASS ADDRESS FIELDS */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Sub-Class Name &amp; Property Address:
                    </span>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-800">
                        Sub Class Name (perhaps the street number or apartment number) *
                      </label>
                      <input
                        type="text"
                        value={propSubclassName}
                        onChange={(e) => {
                          setPropSubclassName(e.target.value);
                          if (!propAddr1) setPropAddr1(e.target.value);
                        }}
                        placeholder="e.g. 2908 Depot or Sunset Palms Apartments"
                        className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-800">Full Street Address (Line 1) *</label>
                        <input
                          type="text"
                          value={propAddr1}
                          onChange={(e) => setPropAddr1(e.target.value)}
                          placeholder="e.g. 2908 Depot Road"
                          className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Street Address Line 2 (Optional):</label>
                        <input
                          type="text"
                          value={propAddr2}
                          onChange={(e) => setPropAddr2(e.target.value)}
                          placeholder="e.g. Suite 100, Building B, etc."
                          className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-800">City *</label>
                        <input
                          type="text"
                          value={propCity}
                          onChange={(e) => setPropCity(e.target.value)}
                          placeholder="e.g. Hayward or Austin"
                          className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-800">State (drop down menu) *</label>
                          <select
                            value={propState}
                            onChange={(e) => setPropState(e.target.value)}
                            className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                          >
                            {US_STATES.map((st) => (
                              <option key={st.code} value={st.code}>
                                {st.name} ({st.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-800">Zip Code *</label>
                          <input
                            type="text"
                            value={propZip}
                            onChange={(e) => setPropZip(e.target.value)}
                            placeholder="e.g. 94545"
                            className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Acquisition Cost (Optional):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={propAcqCost}
                          onChange={(e) => setPropAcqCost(e.target.value)}
                          placeholder="e.g. 750000"
                          className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Acquisition Date (Optional):</label>
                        <input
                          type="date"
                          value={propAcqDate}
                          onChange={(e) => setPropAcqDate(e.target.value)}
                          className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                    <div>
                      {propertiesList.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setStep(5)}
                          className="text-xs text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
                        >
                          Skip property setup for now (I will enter properties later)
                        </button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {propertiesList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsAddingProperty(false)}
                          className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSavePropertyToList}
                        className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save Property &amp; Add to List</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MULTI-LLC PORTFOLIO QUESTION & CHOICE */}
              {hasMultipleLLCs && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3 mt-4 shadow-sm animate-in fade-in duration-150">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                      <FolderPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs">
                        Would you like to add another entity / LLC to this portfolio?
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        {stagedEntities.length === 0
                          ? `Currently configuring 1st entity (${entityName || 'Draft Entity'}). If you have multiple LLCs in this portfolio, click below to stage each one with its properties.`
                          : `You have staged ${stagedEntities.length} LLC${stagedEntities.length === 1 ? '' : 's'} so far (${stagedEntities.map(e => e.entity_name).join(', ')}). Add another entity or proceed to review.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleStageCurrentEntityAndAddAnother}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Another LLC to Portfolio</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextFromStep4}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      <span>Done Adding Entities - Proceed to Review &amp; Structure</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* STEP 5: REVIEW & CLASS STRUCTURE CONFIRMATION        */}
          {/* ==================================================== */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Final Step: Review Setup &amp; Class Structure
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Review &amp; Confirm Entity Registration
                </h3>
                <p className="text-xs text-slate-600">
                  Please review your portfolio architecture, class hierarchy, chart of accounts, and sub-class holdings below.
                </p>
              </div>

              {/* Class Structure Architecture Card */}
              {(() => {
                const allReviewEntities: EntityItemPayload[] = [...stagedEntities];
                if (entityName.trim()) {
                  allReviewEntities.push({
                    entity_name: entityName.trim(),
                    entity_type: entityType,
                    tax_classification: entityType === 'CORP' ? corpType : (entityType === 'LLC' ? (llcStructure === 'SINGLE_MEMBER' ? 'SINGLE_MEMBER_DISREGARDED' : 'MULTI_MEMBER') : (entityType === 'COMMON' ? 'PORTFOLIO_OVERHEAD' : 'SOLE_PROPRIETOR')),
                    tax_form: taxForm.trim() || undefined,
                    ein: ein.trim() || undefined,
                    description: tradeNameDba ? `DBA: ${tradeNameDba}` : undefined,
                    office_address_line1: officeAddr1.trim() || undefined,
                    office_address_line2: officeAddr2.trim() || undefined,
                    office_city: officeCity.trim() || undefined,
                    office_state: officeState.trim() || undefined,
                    office_zip: officeZip.trim() || undefined,
                    mailing_same_as_office: sameAsOffice,
                    mailing_address_line1: sameAsOffice ? (officeAddr1.trim() || undefined) : (mailAddr1.trim() || undefined),
                    mailing_address_line2: sameAsOffice ? (officeAddr2.trim() || undefined) : (mailAddr2.trim() || undefined),
                    mailing_city: sameAsOffice ? (officeCity.trim() || undefined) : (mailCity.trim() || undefined),
                    mailing_state: sameAsOffice ? (officeState.trim() || undefined) : (mailState.trim() || undefined),
                    mailing_zip: sameAsOffice ? (officeZip.trim() || undefined) : (mailZip.trim() || undefined),
                    contact_name: contactName.trim() || undefined,
                    contact_phone: contactPhone.trim() || undefined,
                    properties: propertiesList
                  });
                }
                const totalLLCs = allReviewEntities.length || 1;
                const totalHoldings = allReviewEntities.reduce((sum, e) => sum + (e.properties?.length || 0), 0) || propertiesList.length;

                return (
                  <div className="space-y-4">
                    {/* Class Structure Notation Display */}
                    <div className="bg-slate-900 text-white rounded-2xl p-5 border-2 border-indigo-500/50 shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                            <Layers className="w-4 h-4" />
                          </div>
                          <h4 className="font-black text-sm text-white">Class Structure Architecture</h4>
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded bg-indigo-950 text-indigo-200 border border-indigo-500/60 font-mono uppercase tracking-wider">
                          Hierarchy View
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-950/90 rounded-xl border border-indigo-500/40 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-amber-300 font-black uppercase text-[11px] tracking-wide">Structure Notation:</span>
                        <span className="font-black text-white">{hasMultipleLLCs ? (portfolioName || 'Rental Portfolio') : (entityName || 'Rental Entity')}</span>
                        <span className="text-indigo-300 font-bold">&gt;</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-900/90 text-indigo-100 font-black text-xs border border-indigo-400/60">
                          {totalLLCs} LLC{totalLLCs === 1 ? '' : 's'}
                        </span>
                        <span className="text-indigo-300 font-bold">&gt;</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-900/90 text-emerald-100 font-black text-xs border border-emerald-400/60">
                          {totalHoldings} Sub-Class Holding{totalHoldings === 1 ? '' : 's'} under each LLC
                        </span>
                        {(includeCommonClass || allReviewEntities.some(e => e.entity_type === 'COMMON')) && (
                          <>
                            <span className="text-indigo-300 font-bold">+</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-900/90 text-purple-100 font-black text-xs border border-purple-400/60">
                              1 Common Expense Class (Common to all)
                            </span>
                          </>
                        )}
                      </div>

                      {/* Interactive Visual Tree Hierarchy */}
                      <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="flex items-center space-x-2 text-indigo-300 font-bold">
                          <Landmark className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{hasMultipleLLCs ? (portfolioName || 'Portfolio File') : (entityName || 'Entity File')}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({hasMultipleLLCs ? 'Portfolio Umbrella' : 'Single Entity'})</span>
                        </div>

                        {allReviewEntities.map((ent, eIdx) => (
                          <div key={eIdx} className="pl-5 space-y-2 border-l-2 border-indigo-800/60 ml-2">
                            <div className="flex items-center space-x-2 text-emerald-300 font-bold">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Class: {ent.entity_name}</span>
                              <span className="text-[10px] text-emerald-400 font-normal bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                                {ent.entity_type} {ent.tax_classification ? `(${ent.tax_classification})` : ''}
                              </span>
                              {ent.entity_type === 'COMMON' && (
                                <span className="text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 font-semibold">
                                  Common to All
                                </span>
                              )}
                              {ent.ein && <span className="text-[10px] text-slate-400 font-normal">EIN: {ent.ein}</span>}
                            </div>

                            <div className="pl-5 space-y-1 border-l-2 border-emerald-800/60 ml-1.5">
                              {(!ent.properties || ent.properties.length === 0) ? (
                                <span className="text-slate-500 italic text-[11px]">No sub-class holdings attached yet</span>
                              ) : (
                                ent.properties.map((p, pIdx) => (
                                  <div key={pIdx} className="text-amber-200 text-[11px] flex items-center space-x-2">
                                    <Home className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-slate-400">({p.address_line1}, {p.city} {p.state})</span>
                                    {p.is_multifamily && p.apartment_units && p.apartment_units.length > 0 && (
                                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                        {p.apartment_units.length} Units
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Dedicated Common Expense Class Visual Node (when configured in Step 1) */}
                        {includeCommonClass && !allReviewEntities.some(e => e.entity_type === 'COMMON' || e.entity_name.toLowerCase() === commonClassName.trim().toLowerCase()) && (
                          <div className="pl-5 space-y-2 border-l-2 border-indigo-800/60 ml-2">
                            <div className="flex items-center space-x-2 text-indigo-300 font-bold">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>Class: {commonClassName.trim() || 'Portfolio / Company Expense'}</span>
                              <span className="text-[10px] text-indigo-300 font-normal bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/60">
                                COMMON (PORTFOLIO_OVERHEAD)
                              </span>
                              <span className="text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 font-semibold">
                                Common to All (Shared Overhead)
                              </span>
                            </div>

                            <div className="pl-5 space-y-1 border-l-2 border-indigo-800/60 ml-1.5">
                              <div className="text-amber-200 text-[11px] flex items-center space-x-2">
                                <Home className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="font-bold">{commonPropertyName.trim() || 'Portfolio / Company Overhead'}</span>
                                <span className="text-slate-400">(Shared Overhead Sub-Class)</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chart of Accounts & Portfolio Info Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chart of Accounts Mode</span>
                          <span className="font-black text-sm text-slate-900">
                            {coaMode === 'QUICKBOOKS'
                              ? `Import from QuickBooks (${qbPreview?.summary.total_accounts || 0} accounts)`
                              : coaMode === 'CUSTOM'
                              ? 'Custom 8-Base Account System (10000 - 80000)'
                              : 'Standard Real Estate Chart of Accounts'}
                          </span>
                          {coaMode === 'QUICKBOOKS' && qbPreview && (
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              File: <strong>{qbPreview.filename}</strong> &bull; {qbPreview.summary.sub_accounts_count} sub-accounts &bull; {qbPreview.summary.valid_accounts} accounts mapped
                            </span>
                          )}
                        </div>
                        <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${
                          coaMode === 'QUICKBOOKS'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : coaMode === 'CUSTOM'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {coaMode === 'QUICKBOOKS'
                            ? `${qbPreview?.summary.total_accounts || 0} Accounts`
                            : coaMode === 'CUSTOM'
                            ? '8 Foundation Accounts'
                            : 'Full 35+ Preset'}
                        </span>
                      </div>

                      {hasMultipleLLCs && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-600">
                            Configured <strong>{allReviewEntities.length}</strong> operating LLC{allReviewEntities.length === 1 ? '' : 's'} under this portfolio.
                          </span>
                          <button
                            type="button"
                            onClick={() => { resetEntityForm(); setStep(2); }}
                            className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Another Entity to Portfolio</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Operating Bank Account Opening Balance Card */}
                    <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-5 space-y-4 text-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">
                            Operating Bank Account Opening Balance (Optional)
                          </h4>
                          <span className="text-[11px] text-slate-600 block">
                            If you are starting with this software and want to bring your checking account info over, specify your starting balance below.
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-800 flex items-center justify-between">
                            <span>Opening Balance ($):</span>
                            <span className="text-[10px] font-normal text-slate-500 font-mono">Optional</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={initialBankOpeningBalance}
                              onChange={(e) => setInitialBankOpeningBalance(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono font-medium"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Auto-creates a balanced opening entry for account [10010] Operating Checking offset to [39000] Opening Balance Equity.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-bold text-slate-800 flex items-center justify-between">
                            <span>Date of Opening Balance:</span>
                            <span className="text-[10px] font-normal text-slate-500 font-mono">Cutoff Date</span>
                          </label>
                          <input
                            type="date"
                            value={initialBankOpeningDate}
                            onChange={(e) => setInitialBankOpeningDate(e.target.value)}
                            className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                          />
                          <p className="text-[10px] text-slate-500">
                            Statement cutoff or conversion date for your prior checking records.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setErrorMsg(null); setStep(step - 1); }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {step === 1 && (
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer"
              >
                <span>Continue to Structure</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleNextFromStep2}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer"
              >
                <span>Continue to Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleNextFromStep3}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer"
              >
                <span>Continue to Sub-Classes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleNextFromStep4}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer"
              >
                <span>Review &amp; Confirm</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 5 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? (isCreatingNewCompany ? 'Creating Company & Entity...' : 'Creating Entity...') : (isCreatingNewCompany ? 'Create Company & Initialize Entity' : 'Complete Setup & Initialize')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
