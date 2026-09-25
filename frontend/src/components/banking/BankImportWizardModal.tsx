import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckSquare, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Download, 
  Landmark, 
  HelpCircle,
  Building2,
  DollarSign,
  Plus,
  RefreshCw,
  Sliders,
  Check,
  Search,
  Filter,
  CornerDownRight
} from 'lucide-react';
import { api } from '../../services/api';
import { 
  Category, 
  Property, 
  ClassEntity, 
  BankTransactionItem, 
  BankStatementPreviewResponse, 
  SampleBankStatementFile,
  BankImportConfirmResult,
  RawCsvPreviewResponse
} from '../../types';

interface BankImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  properties: Property[];
  classes: ClassEntity[];
  initialBankAccountId?: number;
}

export const BankImportWizardModal: React.FC<BankImportWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  properties,
  classes,
  initialBankAccountId
}) => {
  // Wizard steps: 1 = File & Bank Selection, 2 = CSV Column Mapping, 3 = Review & Classify, 4 = Success Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Auto-refresh categories when modal opens or COA is modified
  const [allCategories, setAllCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setAllCategories(categories);
  }, [categories]);

  const refreshCategories = async () => {
    try {
      const cats = await api.getCategories();
      setAllCategories(cats);
    } catch (err) {
      console.error('Failed to refresh categories for bank wizard:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCoaUpdate = () => refreshCategories();
    window.addEventListener('coa-updated', handleCoaUpdate);
    return () => window.removeEventListener('coa-updated', handleCoaUpdate);
  }, []);

  // Helper to determine if an account is a bank/checking account or sub-account
  const isBankOrSubAccount = (c: Category, allCats: Category[]): boolean => {
    if (c.type === 'BANK' || (c.sub_type && c.sub_type.toLowerCase().includes('bank'))) return true;
    if (c.parent_account_id) {
      const parent = allCats.find(p => p.id === c.parent_account_id);
      if (parent && isBankOrSubAccount(parent, allCats)) return true;
    }
    const num = parseInt(c.account_number?.replace(/\D/g, '') || '0', 10);
    // Include 10000 - 10499 range (Checking, Escrow, Savings, Petty Cash)
    if (c.type === 'ASSET' && num >= 10000 && num < 10500) return true;
    return false;
  };

  // Build hierarchical list of bank accounts
  const bankAccounts = React.useMemo(() => {
    const rawBankCats = allCategories.filter(c => isBankOrSubAccount(c, allCategories));
    
    // Separate into parents and sub-accounts
    const parents = rawBankCats.filter(c => !c.parent_account_id);
    const subMap = new Map<number, Category[]>();
    rawBankCats.forEach(c => {
      if (c.parent_account_id) {
        const list = subMap.get(c.parent_account_id) || [];
        list.push(c);
        subMap.set(c.parent_account_id, list);
      }
    });

    const ordered: { account: Category; isSub: boolean; parentName?: string; depth: number }[] = [];
    const addedIds = new Set<number>();

    // First add parents and their children
    parents.forEach(p => {
      ordered.push({ account: p, isSub: false, depth: 0 });
      addedIds.add(p.id);
      const subs = subMap.get(p.id) || [];
      subs.sort((a, b) => (a.account_number || '').localeCompare(b.account_number || ''));
      subs.forEach(s => {
        ordered.push({ account: s, isSub: true, parentName: p.name, depth: 1 });
        addedIds.add(s.id);
      });
    });

    // Any remaining sub-accounts whose parent wasn't in parents
    rawBankCats.forEach(c => {
      if (!addedIds.has(c.id)) {
        const parent = allCategories.find(p => p.id === c.parent_account_id);
        ordered.push({ 
          account: c, 
          isSub: Boolean(c.parent_account_id), 
          parentName: parent?.name,
          depth: c.parent_account_id ? 1 : 0 
        });
        addedIds.add(c.id);
      }
    });

    return ordered;
  }, [allCategories]);

  // Memoized numerical ordering of all categories (sorted by 5-digit account number ascending)
  const numericalCategories = React.useMemo(() => {
    return [...allCategories].sort((a, b) => {
      const numA = parseInt(a.account_number?.replace(/\D/g, '') || '999999', 10);
      const numB = parseInt(b.account_number?.replace(/\D/g, '') || '999999', 10);
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  }, [allCategories]);

  const [bankAccountId, setBankAccountId] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Samples
  const [samples, setSamples] = useState<SampleBankStatementFile[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  // Preview & Processing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<BankStatementPreviewResponse | null>(null);

  // Raw CSV Preview Data & Inspection
  const [rawCsvData, setRawCsvData] = useState<RawCsvPreviewResponse | null>(null);
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [amountSignConvention, setAmountSignConvention] = useState<'negative_outflow' | 'positive_outflow'>('negative_outflow');

  // Column Mapping (for CSV)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    date_col: '',
    check_col: '',
    description_col: '',
    amount_col: '',
    debit_col: '',
    credit_col: ''
  });

  // Transactions in Step 3 Review
  const [transactions, setTransactions] = useState<BankTransactionItem[]>([]);
  const [selectedTxnIndices, setSelectedTxnIndices] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RULE_MATCH' | 'AUTO_CLASSIFIED' | 'NEEDS_REVIEW'>('ALL');
  const [searchReviewTerm, setSearchReviewTerm] = useState('');

  // Bulk actions
  const [bulkCategory, setBulkCategory] = useState<number | ''>('');
  const [bulkProperty, setBulkProperty] = useState<number | ''>('');

  // In-Wizard Quick Add Account Modal State
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [targetTxnIndexForNewAccount, setTargetTxnIndexForNewAccount] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountType, setNewAccountType] = useState('OPERATING_EXPENSE');
  const [newAccountSubType, setNewAccountSubType] = useState('Utilities');
  const [newAccountDesc, setNewAccountDesc] = useState('');
  const [newAccountSaveRule, setNewAccountSaveRule] = useState(true);
  const [newAccountRuleKeyword, setNewAccountRuleKeyword] = useState('');
  const [newAccountIsSubAccount, setNewAccountIsSubAccount] = useState(false);
  const [newAccountParentId, setNewAccountParentId] = useState<number | ''>('');
  const [isSavingNewAccount, setIsSavingNewAccount] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);

  // Step 2 Row-by-Row Parser Modal State
  const [showRowParserModal, setShowRowParserModal] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [parsedDate, setParsedDate] = useState('');
  const [parsedType, setParsedType] = useState<'DEBIT' | 'CHECK' | 'DEPOSIT' | 'TRANSFER'>('DEBIT');
  const [parsedCheckNum, setParsedCheckNum] = useState('');
  const [parsedPayee, setParsedPayee] = useState('');
  const [parsedRawDesc, setParsedRawDesc] = useState('');
  const [parsedCategoryId, setParsedCategoryId] = useState<number | ''>('');
  const [parsedCategoryDisplay, setParsedCategoryDisplay] = useState('');
  const [parsedPropertyId, setParsedPropertyId] = useState<number | ''>('');
  const [parsedAmount, setParsedAmount] = useState<number>(0);
  const [parsedIsOutflow, setParsedIsOutflow] = useState<boolean>(true);
  const [parsedSaveRule, setParsedSaveRule] = useState<boolean>(true);
  const [parsedRuleKeyword, setParsedRuleKeyword] = useState<string>('');

  // Step 4 result
  const [importResult, setImportResult] = useState<BankImportConfirmResult | null>(null);

  // Initialize Bank Account & Load Samples
  useEffect(() => {
    if (isOpen) {
      if (initialBankAccountId && initialBankAccountId > 0) {
        setBankAccountId(initialBankAccountId);
      } else if (!bankAccountId || bankAccountId === 0) {
        const defaultBank = bankAccounts.find(b => b.account.account_number === '10100' || b.account.account_number === '10010') || bankAccounts[0];
        if (defaultBank) {
          setBankAccountId(defaultBank.account.id);
        }
      }

      // Fetch samples
      api.getSampleBankStatements()
        .then(setSamples)
        .catch(err => console.error('Failed to load sample bank statements:', err));
    } else {
      // Reset state on close
      setStep(1);
      setSelectedFile(null);
      setPreviewData(null);
      setRawCsvData(null);
      setTransactions([]);
      setSelectedTxnIndices(new Set());
      setError(null);
      setImportResult(null);
      setShowAddAccountModal(false);
      setShowRowParserModal(false);
      setActiveRowIndex(null);
    }
  }, [isOpen, initialBankAccountId, bankAccounts]);

  // Handle File Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'pdf', 'xlsx', 'xls'].includes(ext || '')) {
      setError('Please upload a valid bank statement file (.csv, .xlsx, or .pdf)');
      return;
    }
    setSelectedFile(file);
    setError(null);

    // If it's a CSV, immediately inspect and open the visual CSV table in Step 2!
    if (ext === 'csv') {
      try {
        setLoading(true);
        const rawRes = await api.getRawCsvPreview(file);
        setRawCsvData(rawRes);

        const initialMap = {
          date_col: rawRes.suggested_mapping?.date_col || rawRes.raw_headers[0] || '',
          check_col: rawRes.suggested_mapping?.check_col || '',
          description_col: rawRes.suggested_mapping?.description_col || rawRes.raw_headers[1] || '',
          amount_col: rawRes.suggested_mapping?.amount_col || '',
          debit_col: rawRes.suggested_mapping?.debit_col || '',
          credit_col: rawRes.suggested_mapping?.credit_col || '',
        };
        setColumnMapping(initialMap);

        if (initialMap.debit_col && initialMap.credit_col) {
          setAmountMode('split');
        } else {
          setAmountMode('single');
        }

        // Initialize transactions array with parsed preview rows
        if (rawRes.parsed_preview_transactions && rawRes.parsed_preview_transactions.length > 0) {
          const enriched: BankTransactionItem[] = rawRes.parsed_preview_transactions.map(t => {
            let catId: number | undefined;
            let catDisplay = t.category_display;
            if (t.category_account_number) {
              const found = allCategories.find(c => c.account_number === t.category_account_number);
              if (found) {
                catId = found.id;
                catDisplay = `[${found.account_number}] ${found.name}`;
              } else {
                catDisplay = `[${t.category_account_number}] ${t.category_name}`;
              }
            }
            return {
              ...t,
              category_id: catId,
              category_display: catDisplay
            };
          });
          setTransactions(enriched);
          setSelectedTxnIndices(new Set(enriched.map((_, i) => i)));
        }

        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Failed to inspect CSV file');
      } finally {
        setLoading(false);
      }
    }
  };

  // 1-Click Load Sample Bank Statement
  const handleLoadSample = async (sample: SampleBankStatementFile) => {
    if (!bankAccountId) {
      setError('Please select a bank account first');
      return;
    }
    try {
      setLoadingSample(sample.filename);
      setError(null);
      if (sample.filename.toLowerCase().endsWith('.csv')) {
        // Fetch raw sample file blob and pass to preview
        const response = await fetch(api.getSampleBankStatementDownloadUrl(sample.filename));
        const blob = await response.blob();
        const file = new File([blob], sample.filename, { type: 'text/csv' });
        setSelectedFile(file);
        const rawRes = await api.getRawCsvPreview(file);
        setRawCsvData(rawRes);
        const initialMap = {
          date_col: rawRes.suggested_mapping?.date_col || rawRes.raw_headers[0] || '',
          check_col: rawRes.suggested_mapping?.check_col || '',
          description_col: rawRes.suggested_mapping?.description_col || rawRes.raw_headers[1] || '',
          amount_col: rawRes.suggested_mapping?.amount_col || '',
          debit_col: rawRes.suggested_mapping?.debit_col || '',
          credit_col: rawRes.suggested_mapping?.credit_col || '',
        };
        setColumnMapping(initialMap);
        if (initialMap.debit_col && initialMap.credit_col) {
          setAmountMode('split');
        } else {
          setAmountMode('single');
        }

        if (rawRes.parsed_preview_transactions && rawRes.parsed_preview_transactions.length > 0) {
          const enriched: BankTransactionItem[] = rawRes.parsed_preview_transactions.map(t => {
            let catId: number | undefined;
            let catDisplay = t.category_display;
            if (t.category_account_number) {
              const found = allCategories.find(c => c.account_number === t.category_account_number);
              if (found) {
                catId = found.id;
                catDisplay = `[${found.account_number}] ${found.name}`;
              } else {
                catDisplay = `[${t.category_account_number}] ${t.category_name}`;
              }
            }
            return {
              ...t,
              category_id: catId,
              category_display: catDisplay
            };
          });
          setTransactions(enriched);
          setSelectedTxnIndices(new Set(enriched.map((_, i) => i)));
        }

        setStep(2);
      } else {
        const res = await api.previewSampleBankStatement(sample.filename, bankAccountId);
        processPreviewResult(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sample statement');
    } finally {
      setLoadingSample(null);
    }
  };

  // Step 2 -> Parse with User's explicit Column Mapping and Proceed to Step 3
  const handleParseAndProceed = async () => {
    if (!selectedFile) {
      setError('Please select a CSV statement file');
      return;
    }
    if (!bankAccountId) {
      setError('Please choose a bank account to import into');
      return;
    }
    if (!columnMapping.date_col) {
      setError('Please select which column contains the Transaction Date');
      return;
    }
    if (!columnMapping.description_col) {
      setError('Please select which column contains the Payee / Description');
      return;
    }
    if (amountMode === 'single' && !columnMapping.amount_col) {
      setError('Please select the unified Amount column');
      return;
    }
    if (amountMode === 'split' && (!columnMapping.debit_col || !columnMapping.credit_col)) {
      setError('Please select both Debit and Credit columns, or switch to Single Amount column');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const effectiveMapping = {
        ...columnMapping,
        amount_mode: amountSignConvention
      };
      const res = await api.uploadBankStatementPreview(
        selectedFile,
        bankAccountId,
        effectiveMapping
      );
      setPreviewData(res);
      // Preserve any custom category/payee adjustments made in Step 2 row-by-row parser
      setTransactions(prev => {
        if (prev && prev.length === res.transactions.length) {
          return res.transactions.map((t, i) => {
            const existing = prev[i];
            if (existing && existing.category_id) {
              return { ...t, ...existing };
            }
            return t;
          });
        }
        return res.transactions;
      });
      setSelectedTxnIndices(new Set(res.transactions.map((_, i) => i)));
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to parse bank statement file');
    } finally {
      setLoading(false);
    }
  };

  // Upload and parse statement file (general fallback)
  const handleProcessUploadedFile = async () => {
    if (!selectedFile) {
      setError('Please select or drag a statement file');
      return;
    }
    if (!bankAccountId) {
      setError('Please choose a bank account to import into');
      return;
    }

    if (selectedFile.name.toLowerCase().endsWith('.csv') && !rawCsvData) {
      await handleFileSelected(selectedFile);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.uploadBankStatementPreview(
        selectedFile,
        bankAccountId,
        step === 2 ? columnMapping : undefined
      );
      processPreviewResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to parse bank statement file');
    } finally {
      setLoading(false);
    }
  };

  const processPreviewResult = (res: BankStatementPreviewResponse) => {
    setPreviewData(res);

    if (res.file_type === 'CSV' && res.available_columns.length > 0 && step !== 2) {
      setColumnMapping({
        date_col: res.suggested_mapping.date_col || res.available_columns[0] || '',
        check_col: res.suggested_mapping.check_col || '',
        description_col: res.suggested_mapping.description_col || res.available_columns[1] || '',
        amount_col: res.suggested_mapping.amount_col || '',
        debit_col: res.suggested_mapping.debit_col || '',
        credit_col: res.suggested_mapping.credit_col || ''
      });
      setStep(2);
    } else {
      // Ready for review
      setTransactions(res.transactions);
      setSelectedTxnIndices(new Set(res.transactions.map((_, i) => i)));
      setStep(3);
    }
  };

  // Step 2 Row-by-Row Parser Handlers
  const openRowParser = (rowIndex: number) => {
    setActiveRowIndex(rowIndex);

    // Prefer existing item in transactions state
    const txn = transactions[rowIndex];
    const rawRow = rawCsvData?.raw_rows?.[rowIndex];
    const previewTxn = rawCsvData?.parsed_preview_transactions?.[rowIndex];

    const dateVal = txn?.date || previewTxn?.date || (rawRow && columnMapping.date_col ? rawRow[columnMapping.date_col] : '') || '';
    const descVal = txn?.raw_description || previewTxn?.raw_description || (rawRow && columnMapping.description_col ? rawRow[columnMapping.description_col] : '') || '';
    const payeeVal = txn?.payee || previewTxn?.payee || (descVal ? descVal.slice(0, 50) : '');
    const chkVal = txn?.check_number || previewTxn?.check_number || (rawRow && columnMapping.check_col ? rawRow[columnMapping.check_col] : '') || '';
    const amtVal = txn?.amount !== undefined ? txn.amount : (previewTxn?.amount !== undefined ? previewTxn.amount : 0);
    const outflowVal = txn?.is_outflow !== undefined ? txn.is_outflow : (previewTxn?.is_outflow !== undefined ? previewTxn.is_outflow : true);

    setParsedDate(dateVal);
    setParsedRawDesc(descVal);
    setParsedPayee(payeeVal);
    setParsedCheckNum(chkVal);
    setParsedAmount(amtVal);
    setParsedIsOutflow(outflowVal);

    let tType: 'DEBIT' | 'CHECK' | 'DEPOSIT' | 'TRANSFER' = 'DEBIT';
    if (chkVal) {
      tType = 'CHECK';
    } else if (!outflowVal) {
      tType = 'DEPOSIT';
    } else if (payeeVal.toLowerCase().includes('transfer') || descVal.toLowerCase().includes('transfer')) {
      tType = 'TRANSFER';
    }
    setParsedType(tType);

    // Category resolution
    let catId: number | '' = txn?.category_id || '';
    let catDisp = txn?.category_display || '';
    if (!catId && previewTxn?.category_account_number) {
      const match = allCategories.find(c => c.account_number === previewTxn.category_account_number);
      if (match) {
        catId = match.id;
        catDisp = `[${match.account_number}] ${match.name}`;
      } else {
        catDisp = `[${previewTxn.category_account_number}] ${previewTxn.category_name}`;
      }
    }
    setParsedCategoryId(catId);
    setParsedCategoryDisplay(catDisp);

    setParsedPropertyId(txn?.property_id || '');

    // Rule keyword: use payee or raw description keyword
    const kw = payeeVal || descVal || '';
    setParsedRuleKeyword(kw);
    setParsedSaveRule(Boolean(kw));

    setShowRowParserModal(true);
  };

  const handleSaveRowAndNext = async (goNext: boolean) => {
    if (activeRowIndex === null) return;

    const selectedCat = allCategories.find(c => c.id === Number(parsedCategoryId));
    const selectedProp = properties.find(p => p.id === Number(parsedPropertyId));

    const updatedItem: BankTransactionItem = {
      date: parsedDate,
      payee: parsedPayee,
      raw_description: parsedRawDesc || parsedPayee,
      check_number: parsedType === 'CHECK' ? parsedCheckNum : undefined,
      amount: Math.abs(parsedAmount),
      is_outflow: parsedType === 'DEPOSIT' ? false : parsedIsOutflow,
      transaction_type: parsedType,
      category_id: selectedCat ? selectedCat.id : (parsedCategoryId ? Number(parsedCategoryId) : undefined),
      category_account_number: selectedCat?.account_number,
      category_name: selectedCat?.name,
      category_display: selectedCat ? `[${selectedCat.account_number}] ${selectedCat.name}` : parsedCategoryDisplay,
      property_id: selectedProp ? selectedProp.id : (parsedPropertyId ? Number(parsedPropertyId) : undefined),
      property_name: selectedProp?.name,
      class_id: selectedProp?.class_id,
      match_status: 'AUTO_CLASSIFIED'
    };

    setTransactions(prev => {
      const copy = [...prev];
      while (copy.length <= activeRowIndex) {
        const dummy: BankTransactionItem = {
          date: '',
          payee: '',
          amount: 0,
          is_outflow: true,
          match_status: 'NEEDS_REVIEW'
        };
        copy.push(dummy);
      }
      copy[activeRowIndex] = updatedItem;

      // If user enabled rule, cascade to any matching rows in current transaction list
      if (parsedSaveRule && parsedRuleKeyword.trim() && selectedCat) {
        const kwLower = parsedRuleKeyword.trim().toLowerCase();
        return copy.map((t, idx) => {
          if (idx === activeRowIndex) return updatedItem;
          const combined = `${t.payee || ''} ${t.raw_description || ''}`.toLowerCase();
          if (combined.includes(kwLower)) {
            return {
              ...t,
              category_id: selectedCat.id,
              category_account_number: selectedCat.account_number,
              category_name: selectedCat.name,
              category_display: `[${selectedCat.account_number}] ${selectedCat.name}`,
              match_status: 'AUTO_CLASSIFIED'
            };
          }
          return t;
        });
      }

      return copy;
    });

    // Save rule to database if requested
    if (parsedSaveRule && parsedRuleKeyword.trim() && selectedCat) {
      try {
        await api.createBankRule({
          name: `Rule: ${parsedRuleKeyword.trim()}`,
          match_keyword: parsedRuleKeyword.trim(),
          target_category_id: selectedCat.id,
          target_vendor_name: parsedPayee.trim() || parsedRuleKeyword.trim(),
          is_active: true
        });
      } catch (ruleErr) {
        console.warn('Could not save bank rule:', ruleErr);
      }
    }

    const totalCount = rawCsvData?.raw_rows?.length || transactions.length || 0;
    if (goNext && activeRowIndex + 1 < totalCount) {
      openRowParser(activeRowIndex + 1);
    } else {
      setShowRowParserModal(false);
      setActiveRowIndex(null);
    }
  };

  const handlePrevRow = () => {
    if (activeRowIndex !== null && activeRowIndex > 0) {
      openRowParser(activeRowIndex - 1);
    }
  };

  // In-Wizard Quick Add Account Handlers
  const openAddAccountModalForTxn = async (txnIndex: number | null) => {
    setTargetTxnIndexForNewAccount(txnIndex);
    setAddAccountError(null);

    let defaultName = '';
    let defaultKeyword = '';
    let defaultType = 'OPERATING_EXPENSE';
    let defaultSubType = 'Utilities';
    let defaultNum = '';
    let defaultIsSub = false;
    let defaultParentId: number | '' = '';

    const effectivePayee = (showRowParserModal && parsedPayee)
      ? parsedPayee
      : (txnIndex !== null && transactions[txnIndex] ? transactions[txnIndex].payee : '');
    const effectiveDesc = (showRowParserModal && parsedRawDesc)
      ? parsedRawDesc
      : (txnIndex !== null && transactions[txnIndex] ? transactions[txnIndex].raw_description || '' : '');
    const lower = `${effectivePayee} ${effectiveDesc}`.toLowerCase();

    if (txnIndex !== null && transactions[txnIndex]?.suggest_create_account && transactions[txnIndex]?.category_name) {
      defaultName = transactions[txnIndex].category_name!;
      defaultNum = transactions[txnIndex].category_account_number || '';
      defaultKeyword = effectivePayee;
    } else if (lower.includes('capital one') || lower.includes('credit card') || lower.includes('chase card') || lower.includes('amex') || lower.includes('mastercard') || lower.includes('visa') || lower.includes('discover')) {
      defaultName = (effectivePayee.toLowerCase().includes('card') || effectivePayee.toLowerCase().includes('capital one'))
        ? (effectivePayee.trim() || 'Capital One')
        : `${effectivePayee} Credit Card`;
      defaultType = 'LIABILITY';
      defaultSubType = 'Credit Card';
      const creditCardParent = allCategories.find(c => 
        c.account_number === '20300' || 
        (c.type === 'LIABILITY' && c.name.toLowerCase().includes('credit card'))
      );
      if (creditCardParent) {
        defaultIsSub = true;
        defaultParentId = creditCardParent.id;
      }
      defaultKeyword = effectivePayee || 'Capital One';
    } else if (lower.includes('t-mobile') || lower.includes('tmobile') || lower.includes('verizon') || lower.includes('phone') || lower.includes('cellular')) {
      defaultName = 'Telephone Expense';
      defaultSubType = 'Utilities';
      defaultNum = '61200';
      defaultKeyword = effectivePayee || 'T-Mobile';
    } else if (lower.includes('internet') || lower.includes('spectrum') || lower.includes('comcast') || lower.includes('frontier')) {
      defaultName = 'Internet & Wi-Fi Expense';
      defaultSubType = 'Utilities';
      defaultNum = '61200';
      defaultKeyword = effectivePayee || 'Internet';
    } else if (lower.includes('service fee') || lower.includes('fee')) {
      defaultName = 'Bank & Merchant Service Fees';
      defaultSubType = 'Bank Fees';
      defaultNum = '61300';
      defaultKeyword = effectivePayee || 'Monthly Service Fee';
    } else if (lower.includes('transamerica') || lower.includes('insurance')) {
      defaultName = 'Property Insurance';
      defaultSubType = 'Insurance';
      defaultNum = '60400';
      defaultKeyword = effectivePayee || 'Insurance';
    } else if (effectivePayee) {
      defaultName = `${effectivePayee} Expense`;
      defaultSubType = 'Other Expense';
      defaultKeyword = effectivePayee;
    } else {
      defaultName = 'New Expense Category';
      defaultKeyword = '';
    }

    setNewAccountName(defaultName);
    setNewAccountRuleKeyword(defaultKeyword);
    setNewAccountType(defaultType);
    setNewAccountSubType(defaultSubType);
    setNewAccountIsSubAccount(defaultIsSub);
    setNewAccountParentId(defaultParentId);
    setNewAccountDesc(defaultKeyword ? `Created during bank import for ${defaultKeyword}` : 'Created from bank import wizard');
    setNewAccountSaveRule(Boolean(defaultKeyword));

    if (!defaultNum) {
      try {
        const targetParent = defaultIsSub && defaultParentId ? Number(defaultParentId) : null;
        const sug = await api.getSuggestedAccountNumber(defaultType, targetParent);
        if (sug && (sug.suggested_number || (sug as any).suggested_account_number)) {
          setNewAccountNumber(sug.suggested_number || (sug as any).suggested_account_number);
        } else {
          setNewAccountNumber(defaultIsSub ? (defaultType === 'LIABILITY' ? '20310' : '10110') : '61400');
        }
      } catch {
        setNewAccountNumber(defaultIsSub ? (defaultType === 'LIABILITY' ? '20310' : '10110') : '61400');
      }
    } else {
      setNewAccountNumber(defaultNum);
    }

    setShowAddAccountModal(true);
  };

  const handleSaveNewAccount = async () => {
    if (!newAccountName.trim()) {
      setAddAccountError('Account Name is required');
      return;
    }
    if (!newAccountNumber.trim()) {
      setAddAccountError('Account Number is required');
      return;
    }
    if (newAccountIsSubAccount && !newAccountParentId) {
      setAddAccountError('Please select a Parent Account for this sub-account');
      return;
    }

    try {
      setIsSavingNewAccount(true);
      setAddAccountError(null);
      const created = await api.createAccount({
        account_number: newAccountNumber.trim(),
        name: newAccountName.trim(),
        type: newAccountType,
        sub_type: newAccountSubType || undefined,
        description: newAccountDesc || undefined,
        parent_account_id: (newAccountIsSubAccount && newAccountParentId) ? Number(newAccountParentId) : undefined,
      });

      // Refresh categories list
      await refreshCategories();
      window.dispatchEvent(new CustomEvent('coa-updated'));

      // If rule requested, save rule
      if (newAccountSaveRule && newAccountRuleKeyword.trim()) {
        try {
          await api.createBankRule({
            name: `Rule: ${newAccountRuleKeyword.trim()}`,
            match_keyword: newAccountRuleKeyword.trim(),
            target_category_id: created.id,
            target_vendor_name: newAccountRuleKeyword.trim(),
            is_active: true
          });
        } catch (ruleErr) {
          console.warn('Could not save rule:', ruleErr);
        }
      }

      // Assign to current transaction row
      if (targetTxnIndexForNewAccount !== null) {
        updateTransactionRow(targetTxnIndexForNewAccount, {
          category_id: created.id,
          category_name: created.name,
          category_display: `[${created.account_number}] ${created.name}`,
          match_status: 'AUTO_CLASSIFIED'
        });
      }
      if (showRowParserModal) {
        setParsedCategoryId(created.id);
        setParsedCategoryDisplay(`[${created.account_number}] ${created.name}`);
      }

      // Also assign to any transactions matching the keyword!
      if (newAccountRuleKeyword.trim()) {
        const kwLower = newAccountRuleKeyword.trim().toLowerCase();
        setTransactions(prev => prev.map(t => {
          const combined = `${t.payee} ${t.raw_description || ''}`.toLowerCase();
          if (combined.includes(kwLower)) {
            return {
              ...t,
              category_id: created.id,
              category_name: created.name,
              category_display: `[${created.account_number}] ${created.name}`,
              match_status: 'AUTO_CLASSIFIED'
            };
          }
          return t;
        }));
      }

      setShowAddAccountModal(false);
    } catch (err: any) {
      setAddAccountError(err.message || 'Failed to create account');
    } finally {
      setIsSavingNewAccount(false);
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!bankAccountId) {
      alert('Bank account is required');
      return;
    }
    const toImport = transactions.filter((_, idx) => selectedTxnIndices.has(idx));
    if (toImport.length === 0) {
      alert('Please select at least one transaction to import');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.confirmBankStatementImport({
        bank_account_id: bankAccountId,
        filename: previewData?.filename || selectedFile?.name || 'Bank_Statement.csv',
        transactions: toImport
      });
      setImportResult(result);
      setStep(4);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to commit bank transactions');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Apply
  const applyBulkCategory = () => {
    if (!bulkCategory) return;
    const cat = categories.find(c => c.id === bulkCategory);
    setTransactions(prev => prev.map((t, idx) => {
      if (selectedTxnIndices.has(idx)) {
        return {
          ...t,
          category_id: Number(bulkCategory),
          category_name: cat?.name,
          category_display: cat ? `[${cat.account_number}] ${cat.name}` : undefined,
          match_status: 'AUTO_CLASSIFIED'
        };
      }
      return t;
    }));
  };

  const applyBulkProperty = () => {
    if (!bulkProperty) return;
    const prop = properties.find(p => p.id === bulkProperty);
    setTransactions(prev => prev.map((t, idx) => {
      if (selectedTxnIndices.has(idx)) {
        return {
          ...t,
          property_id: Number(bulkProperty),
          property_name: prop?.name,
          class_id: prop?.class_id || t.class_id
        };
      }
      return t;
    }));
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedTxnIndices.size === filteredTransactions.length) {
      setSelectedTxnIndices(new Set());
    } else {
      setSelectedTxnIndices(new Set(transactions.map((_, i) => i)));
    }
  };

  const toggleSelectRow = (idx: number) => {
    const updated = new Set(selectedTxnIndices);
    if (updated.has(idx)) {
      updated.delete(idx);
    } else {
      updated.add(idx);
    }
    setSelectedTxnIndices(updated);
  };

  // Edit single transaction row
  const updateTransactionRow = (idx: number, updates: Partial<BankTransactionItem>) => {
    setTransactions(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  // Filtered transactions for Step 3
  const filteredTransactions = transactions.filter((t, idx) => {
    if (statusFilter !== 'ALL' && t.match_status !== statusFilter) return false;
    if (searchReviewTerm) {
      const q = searchReviewTerm.toLowerCase();
      const match = 
        t.payee.toLowerCase().includes(q) ||
        (t.check_number && t.check_number.toLowerCase().includes(q)) ||
        (t.category_display && t.category_display.toLowerCase().includes(q)) ||
        (t.raw_description && t.raw_description.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const ruleMatchesCount = transactions.filter(t => t.match_status === 'RULE_MATCH').length;
  const autoClassifiedCount = transactions.filter(t => t.match_status === 'AUTO_CLASSIFIED').length;
  const needsReviewCount = transactions.filter(t => t.match_status === 'NEEDS_REVIEW').length;

  const totalDisbursementAmount = transactions
    .filter((t, idx) => selectedTxnIndices.has(idx) && t.is_outflow)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDepositAmount = transactions
    .filter((t, idx) => selectedTxnIndices.has(idx) && !t.is_outflow)
    .reduce((sum, t) => sum + t.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Banner */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">Bank Transaction Import Wizard</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CSV & PDF Statement Parser
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Parse bank transactions, extract check numbers and vendor expenses, and post directly to the Check Register.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Step Indicator */}
            <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold">
              <span className={`px-2.5 py-1 rounded-md transition ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                1. Select File
              </span>
              <span className="text-slate-600">→</span>
              {previewData?.file_type === 'CSV' && (
                <>
                  <span className={`px-2.5 py-1 rounded-md transition ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    2. Column Map
                  </span>
                  <span className="text-slate-600">→</span>
                </>
              )}
              <span className={`px-2.5 py-1 rounded-md transition ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                3. Review & Rules
              </span>
              <span className="text-slate-600">→</span>
              <span className={`px-2.5 py-1 rounded-md transition ${step === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                4. Complete
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-300 text-xs animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ========================================================= */}
          {/* STEP 1: Select Bank Account, Upload File, or 1-Click Samples */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              
              {/* Bank Account Selection */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <label className="text-xs font-bold text-white uppercase tracking-wider block mb-2 flex items-center space-x-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  <span>Target Bank Account</span>
                  <span className="text-rose-400">*</span>
                </label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value={0}>-- Select Bank Account to Reconcile --</option>
                  {bankAccounts.map(({ account, isSub, parentName }) => (
                    <option key={account.id} value={account.id}>
                      {isSub 
                        ? `\u00A0\u00A0\u00A0\u00A0└─ [${account.account_number || ''}] ${account.name} (Sub-account of ${parentName || 'Parent'})`
                        : `[${account.account_number || ''}] ${account.name}${account.sub_accounts_count ? ' (Parent Account)' : ''}`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Transactions and check disbursements will be posted against this bank asset account in your check register.
                </p>
              </div>

              {/* Drag and Drop Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
                  isDragOver 
                    ? 'border-emerald-400 bg-emerald-950/20' 
                    : selectedFile 
                      ? 'border-emerald-500/50 bg-emerald-950/10' 
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                  accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition ${
                    selectedFile ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {selectedFile ? <FileText className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
                  </div>

                  <div>
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-bold text-white flex items-center justify-center space-x-2">
                          <span>{selectedFile.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </span>
                        </p>
                        <p className="text-xs text-emerald-400 mt-1">Ready for parsing. Click "Parse & Preview Statement" below.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Drag and drop your bank statement here, or <span className="text-emerald-400 underline">browse files</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Supports bank statements from Chase, Wells Fargo, BofA & generic banks (.csv, .xlsx, .pdf)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* One-Click Sample Statements for Instant Testing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Instant 1-Click Sample Bank Statements</span>
                  </h3>
                  <span className="text-[11px] text-slate-500">Test parsing without searching for personal files</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {samples.map((s) => (
                    <div 
                      key={s.filename}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            s.format === 'PDF' 
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {s.format}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{s.bank_name}</span>
                        </div>

                        <h4 className="text-xs font-bold text-white mt-2 leading-tight">
                          {s.account_title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {s.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleLoadSample(s)}
                          disabled={loadingSample === s.filename}
                          className="flex-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>{loadingSample === s.filename ? 'Loading...' : '1-Click Preview'}</span>
                        </button>

                        <a
                          href={api.getSampleBankStatementDownloadUrl(s.filename)}
                          download={s.filename}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                          title="Download sample file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: Visual CSV Display & Guided Column Parsing Setup  */}
          {/* ========================================================= */}
          {step === 2 && (rawCsvData || previewData) && (
            <div className="space-y-5 max-w-6xl mx-auto">
              
              {/* Guidance & Role Notice */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                      Step 2: CSV Inspection & Parsing Setup
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      File: <strong className="text-white font-mono">{rawCsvData?.filename || selectedFile?.name || previewData?.filename}</strong>
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    <strong className="text-emerald-400 font-mono">{rawCsvData?.total_rows || previewData?.total_rows_detected || 0}</strong> rows detected in file
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-300 block font-semibold">1. Transaction Date Strict Parsing:</strong>
                      <span className="text-slate-300">
                        The chosen Date column will strictly parse to the transaction date and will <strong>never</strong> be mistaken for a vendor or payee.
                      </span>
                    </div>
                  </div>

                  <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-3 flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-sky-300 block font-semibold">2. Smart Expense Auto-Classification:</strong>
                      <span className="text-slate-300">
                        The Description column identifies payees and auto-suggests categories (e.g. <em>T-Mobile</em> &rarr; <em>Telephone Expense</em>). Missing accounts can be added with 1 click.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column Mapping Setup Panel */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>Assign Column Roles for Parsing</span>
                  </h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-medium">Amounts Format:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountMode('single');
                        setColumnMapping(prev => ({ ...prev, debit_col: '', credit_col: '' }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        amountMode === 'single' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Single Amount Column
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAmountMode('split');
                        setColumnMapping(prev => ({ ...prev, amount_col: '' }));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        amountMode === 'split' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Separate Debit & Credit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Transaction Date */}
                  <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                    <label className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      <span>Transaction Date Column *</span>
                    </label>
                    <select
                      value={columnMapping.date_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, date_col: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="">-- Choose Date Column --</option>
                      {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                        const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                        return (
                          <option key={col} value={col}>
                            {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Parses strictly into transaction date (never confused with vendor).
                    </p>
                  </div>

                  {/* 2. Payee / Description */}
                  <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                    <label className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                      <span>Payee / Description Column *</span>
                    </label>
                    <select
                      value={columnMapping.description_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, description_col: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                    >
                      <option value="">-- Choose Description Column --</option>
                      {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                        const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                        return (
                          <option key={col} value={col}>
                            {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Used to identify vendor and auto-suggest expense category.
                    </p>
                  </div>

                  {/* 3. Check Number */}
                  <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                    <label className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                      <span>Check Number (Optional)</span>
                    </label>
                    <select
                      value={columnMapping.check_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, check_col: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                    >
                      <option value="">-- None (Extract from Description) --</option>
                      {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                        const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                        return (
                          <option key={col} value={col}>
                            {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      If omitted, check numbers will be detected from description text.
                    </p>
                  </div>
                </div>

                {/* Amount Configuration */}
                {amountMode === 'single' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-purple-400 flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                        <span>Amount Column *</span>
                      </label>
                      <select
                        value={columnMapping.amount_col}
                        onChange={(e) => setColumnMapping({ ...columnMapping, amount_col: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                      >
                        <option value="">-- Choose Amount Column --</option>
                        {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                          const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                          return (
                            <option key={col} value={col}>
                              {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-slate-300">
                        Sign Convention (Outflows vs Inflows)
                      </label>
                      <select
                        value={amountSignConvention}
                        onChange={(e) => setAmountSignConvention(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-slate-500 font-medium"
                      >
                        <option value="negative_outflow">
                          Standard: Negative amounts (-$85.50) are Outflows / Checks; Positive are Deposits
                        </option>
                        <option value="positive_outflow">
                          Inverted: Positive amounts ($85.50) are Outflows / Checks; Negative are Deposits
                        </option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-rose-400 flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                        <span>Debit / Withdrawal Column (Outflow) *</span>
                      </label>
                      <select
                        value={columnMapping.debit_col}
                        onChange={(e) => setColumnMapping({ ...columnMapping, debit_col: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                      >
                        <option value="">-- Choose Debit Column --</option>
                        {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                          const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                          return (
                            <option key={col} value={col}>
                              {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-teal-400 flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-400"></span>
                        <span>Credit / Deposit Column (Inflow) *</span>
                      </label>
                      <select
                        value={columnMapping.credit_col}
                        onChange={(e) => setColumnMapping({ ...columnMapping, credit_col: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                      >
                        <option value="">-- Choose Credit Column --</option>
                        {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                          const samples = rawCsvData?.sample_values_by_column?.[col]?.join(', ') || '';
                          return (
                            <option key={col} value={col}>
                              {col} {samples ? `(e.g. ${samples.slice(0, 28)})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Step-by-Step Row Parsing Guide Banner */}
              <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base border border-emerald-500/30 shadow-inner">
                    1
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-white">Click Any Row to Configure Register Posting</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        Interactive Row-by-Row
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Row 1 is <strong className="text-emerald-300 font-semibold">MONTHLY SERVICE FEE</strong> (-$15.00). Click it to configure how it posts to the Check Register and set future rules, then step to Row 2 and so on.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openRowParser(0)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <span>▶ Start Step-by-Step Parse (Row 1)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Visual CSV Data Table */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      CSV File Data Table (Click Any Row to Parse & Post to Register)
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Click any row to configure register options & future rules
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="sticky top-0 bg-slate-950 text-slate-300 font-semibold border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-2.5 w-10 text-center font-mono text-slate-500">#</th>
                        {(rawCsvData?.raw_headers || previewData?.available_columns || []).map(col => {
                          let badgeText = 'IGNORED';
                          let badgeClass = 'bg-slate-800 text-slate-500 border-slate-700';

                          if (col === columnMapping.date_col) {
                            badgeText = 'DATE';
                            badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
                          } else if (col === columnMapping.description_col) {
                            badgeText = 'PAYEE / DESC';
                            badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold';
                          } else if (col === columnMapping.amount_col) {
                            badgeText = 'AMOUNT';
                            badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold';
                          } else if (col === columnMapping.debit_col) {
                            badgeText = 'DEBIT';
                            badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
                          } else if (col === columnMapping.credit_col) {
                            badgeText = 'CREDIT';
                            badgeClass = 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold';
                          } else if (col === columnMapping.check_col) {
                            badgeText = 'CHECK #';
                            badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
                          }

                          return (
                            <th key={col} className="p-2.5 whitespace-nowrap">
                              <div className="flex flex-col space-y-1">
                                <span className="font-bold text-white text-xs">{col}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border inline-block w-fit ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                        <th className="p-2.5 text-right font-bold text-emerald-400 whitespace-nowrap min-w-[220px]">
                          ACTION / REGISTER STATUS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {(rawCsvData?.raw_rows || []).map((row, rIdx) => (
                        <tr 
                          key={rIdx} 
                          onClick={() => openRowParser(rIdx)}
                          className="hover:bg-emerald-950/20 cursor-pointer transition group border-b border-slate-800/40"
                          title={`Click to configure Row ${rIdx + 1} for Check Register`}
                        >
                          <td className="p-2.5 text-center text-slate-500 font-bold group-hover:text-emerald-400">{rIdx + 1}</td>
                          {(rawCsvData?.raw_headers || []).map(col => {
                            const val = row[col] || '';
                            const isDate = col === columnMapping.date_col;
                            const isDesc = col === columnMapping.description_col;
                            const isAmt = col === columnMapping.amount_col || col === columnMapping.debit_col || col === columnMapping.credit_col;

                            return (
                              <td 
                                key={col} 
                                className={`p-2.5 whitespace-nowrap ${
                                  isDate ? 'text-emerald-300 font-semibold' :
                                  isDesc ? 'text-sky-300 font-medium' :
                                  isAmt ? 'text-purple-300 font-bold' :
                                  'text-slate-400'
                                }`}
                              >
                                {val || <span className="text-slate-600 italic">(empty)</span>}
                              </td>
                            );
                          })}
                          <td className="p-2.5 whitespace-nowrap text-right">
                            {transactions[rIdx]?.category_display ? (
                              <div className="flex items-center justify-end space-x-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-medium truncate max-w-[190px]" title={transactions[rIdx].category_display}>
                                  ✓ {transactions[rIdx].category_display}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openRowParser(rIdx); }}
                                  className="px-2 py-0.5 bg-slate-800 group-hover:bg-slate-700 text-slate-300 group-hover:text-white rounded border border-slate-700 text-[10px] font-medium transition cursor-pointer"
                                >
                                  Configure
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openRowParser(rIdx); }}
                                className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-[10px] font-semibold transition cursor-pointer flex items-center space-x-1 ml-auto"
                              >
                                <span>⚙ Parse Row</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Bar for Step 2 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Choose Different File</span>
                </button>

                <button
                  type="button"
                  onClick={handleParseAndProceed}
                  disabled={loading || !columnMapping.date_col || !columnMapping.description_col}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{loading ? 'Parsing with Your Column Rules...' : 'Parse & Proceed to Classification Grid (Step 3) →'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: Interactive Intelligent Review & Rule Creation */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-4">
              
              {/* Summary KPIs & Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Transactions</span>
                    <p className="text-lg font-bold text-white mt-0.5">{transactions.length} rows</p>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {selectedTxnIndices.size} selected
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Disbursements / Checks</span>
                    <p className="text-lg font-bold text-rose-300 mt-0.5">
                      ${totalDisbursementAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    Register Outflows
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Deposits / Income</span>
                    <p className="text-lg font-bold text-emerald-300 mt-0.5">
                      ${totalDepositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    GL Inflows
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Recognition Breakdown</span>
                    <div className="flex items-center space-x-1.5 mt-1 text-[10px]">
                      <span className="text-emerald-400 font-bold">{ruleMatchesCount} rules</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-sky-400 font-bold">{autoClassifiedCount} auto</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-amber-400 font-bold">{needsReviewCount} review</span>
                    </div>
                  </div>
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
              </div>

              {/* Action & Filter Toolbar */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                
                {/* Search & Filter pills */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchReviewTerm}
                      onChange={(e) => setSearchReviewTerm(e.target.value)}
                      placeholder="Search Payee, Check #, Category..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                        statusFilter === 'ALL' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({transactions.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('RULE_MATCH')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center space-x-1 ${
                        statusFilter === 'RULE_MATCH' ? 'bg-emerald-600/30 text-emerald-300 shadow' : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <span>Rule Match ({ruleMatchesCount})</span>
                    </button>
                    <button
                      onClick={() => setStatusFilter('AUTO_CLASSIFIED')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center space-x-1 ${
                        statusFilter === 'AUTO_CLASSIFIED' ? 'bg-sky-600/30 text-sky-300 shadow' : 'text-sky-400 hover:text-sky-300'
                      }`}
                    >
                      <span>Auto ({autoClassifiedCount})</span>
                    </button>
                    <button
                      onClick={() => setStatusFilter('NEEDS_REVIEW')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center space-x-1 ${
                        statusFilter === 'NEEDS_REVIEW' ? 'bg-amber-600/30 text-amber-300 shadow' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>Needs Review ({needsReviewCount})</span>
                    </button>
                  </div>

                  {/* Destination Bank Account Switcher */}
                  <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs">
                    <Landmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-slate-400 font-medium">Post To:</span>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(Number(e.target.value))}
                      className="bg-transparent text-emerald-300 font-semibold text-xs border-none focus:outline-none cursor-pointer pr-1"
                    >
                      {bankAccounts.map(({ account, isSub, parentName }) => (
                        <option key={account.id} value={account.id} className="bg-slate-900 text-white font-mono">
                          {isSub 
                            ? `\u00A0\u00A0└─ [${account.account_number || ''}] ${account.name} (Sub of ${parentName || 'Parent'})`
                            : `[${account.account_number || ''}] ${account.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bulk Assigner */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-semibold text-slate-400">Bulk Assign Selected:</span>
                  
                  <select
                    value={bulkProperty}
                    onChange={(e) => setBulkProperty(e.target.value ? Number(e.target.value) : '')}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value="">Property...</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={applyBulkProperty}
                    disabled={!bulkProperty}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg transition disabled:opacity-50"
                  >
                    Apply
                  </button>

                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value ? Number(e.target.value) : '')}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[170px]"
                  >
                    <option value="">Category (Numerical)...</option>
                    {numericalCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.parent_account_id ? `\u00A0\u00A0↳ [${c.account_number}] ${c.name}` : `[${c.account_number}] ${c.name}`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={applyBulkCategory}
                    disabled={!bulkCategory}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg transition disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddAccountModalForTxn(null)}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition"
                    title="Add a new Chart of Accounts category"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Account</span>
                  </button>
                </div>

              </div>

              {/* Transactions Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-[48vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px] z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTxnIndices.size > 0 && selectedTxnIndices.size === filteredTransactions.length}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3 w-24">Date</th>
                        <th className="py-2.5 px-3 w-20">Type</th>
                        <th className="py-2.5 px-3 w-24">Check #</th>
                        <th className="py-2.5 px-3 w-44">Payee / Vendor</th>
                        <th className="py-2.5 px-3 w-52">Account / Category</th>
                        <th className="py-2.5 px-3 w-40">Sub-Class (Property)</th>
                        <th className="py-2.5 px-3 w-24 text-right">Amount</th>
                        <th className="py-2.5 px-3 w-28">Status</th>
                        <th className="py-2.5 px-3 w-36">Automated Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredTransactions.map((t, idx) => {
                        const originalIndex = transactions.indexOf(t);
                        const isSelected = selectedTxnIndices.has(originalIndex);

                        return (
                          <tr 
                            key={originalIndex} 
                            className={`transition ${isSelected ? 'hover:bg-slate-800/50' : 'opacity-40 bg-slate-950/40'}`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(originalIndex)}
                                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                              />
                            </td>

                            {/* Date */}
                            <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">
                              {t.date}
                            </td>

                            {/* Txn Type */}
                            <td className="py-2 px-3">
                              <select
                                value={t.transaction_type || (t.is_outflow ? 'CHECK' : 'DEPOSIT')}
                                onChange={(e) => {
                                  const val = e.target.value as 'CHECK' | 'ACH' | 'DEBIT' | 'DEPOSIT';
                                  updateTransactionRow(originalIndex, {
                                    transaction_type: val,
                                    is_outflow: val !== 'DEPOSIT'
                                  });
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] font-semibold text-white focus:outline-none focus:border-emerald-500"
                              >
                                <option value="CHECK">Check</option>
                                <option value="ACH">ACH</option>
                                <option value="DEBIT">Debit</option>
                                <option value="DEPOSIT">Deposit</option>
                              </select>
                            </td>

                            {/* Check # */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={t.check_number || ''}
                                onChange={(e) => updateTransactionRow(originalIndex, { 
                                  check_number: e.target.value,
                                  transaction_type: e.target.value ? 'CHECK' : t.transaction_type 
                                })}
                                placeholder="Auto"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </td>

                            {/* Payee / Vendor */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={t.payee}
                                onChange={(e) => updateTransactionRow(originalIndex, { 
                                  payee: e.target.value,
                                  vendor_name: e.target.value 
                                })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                              />
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={t.raw_description}>
                                {t.raw_description}
                              </div>
                            </td>

                            {/* Category Dropdown & Quick Add */}
                            <td className="py-2 px-3">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1">
                                  <select
                                    value={t.category_id || ''}
                                    onChange={(e) => {
                                      const catId = Number(e.target.value);
                                      const cat = allCategories.find(c => c.id === catId);
                                      updateTransactionRow(originalIndex, {
                                        category_id: catId || undefined,
                                        category_name: cat?.name,
                                        category_display: cat ? `[${cat.account_number}] ${cat.name}` : undefined,
                                        match_status: catId ? 'AUTO_CLASSIFIED' : 'NEEDS_REVIEW'
                                      });
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-medium focus:outline-none focus:border-emerald-500"
                                  >
                                    <option value="">-- Choose Account (Numerical) --</option>
                                    {numericalCategories.map(c => (
                                      <option key={c.id} value={c.id}>
                                        {c.parent_account_id ? `\u00A0\u00A0↳ [${c.account_number}] ${c.name}` : `[${c.account_number}] ${c.name}`}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => openAddAccountModalForTxn(originalIndex)}
                                    className="p-1 bg-slate-800 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 rounded border border-slate-700 transition shrink-0"
                                    title="Add new category for this transaction"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Suggestion prompt if account does not exist or suggested */}
                                {(!t.category_id && t.category_display) && (
                                  <div className="flex items-center justify-between text-[10px] bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 text-amber-300">
                                    <span className="truncate max-w-[130px]" title={t.category_display}>
                                      💡 {t.category_display}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openAddAccountModalForTxn(originalIndex)}
                                      className="underline hover:text-white font-semibold ml-1 shrink-0"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Property / Sub-Class */}
                            <td className="py-2 px-3">
                              <select
                                value={t.property_id || ''}
                                onChange={(e) => {
                                  const propId = Number(e.target.value);
                                  const prop = properties.find(p => p.id === propId);
                                  updateTransactionRow(originalIndex, {
                                    property_id: propId || undefined,
                                    property_name: prop?.name,
                                    class_id: prop?.class_id || t.class_id
                                  });
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="">-- Property Address --</option>
                                {properties.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Amount */}
                            <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              t.is_outflow ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {t.is_outflow ? '-' : '+'}${t.amount.toFixed(2)}
                            </td>

                            {/* Match Status Badge */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              {t.match_status === 'RULE_MATCH' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <Sparkles className="w-3 h-3 text-emerald-400" />
                                  <span>Rule Match</span>
                                </span>
                              )}
                              {t.match_status === 'AUTO_CLASSIFIED' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  <Check className="w-3 h-3 text-sky-400" />
                                  <span>Auto</span>
                                </span>
                              )}
                              {t.match_status === 'NEEDS_REVIEW' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <AlertCircle className="w-3 h-3 text-amber-400" />
                                  <span>Review</span>
                                </span>
                              )}
                            </td>

                            {/* Save Rule Checkbox */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <label className="flex items-center space-x-1.5 text-[11px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(t.save_rule)}
                                  onChange={(e) => updateTransactionRow(originalIndex, {
                                    save_rule: e.target.checked,
                                    rule_keyword: t.payee
                                  })}
                                  className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <span>Remember rule</span>
                              </label>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: Success & Summary */}
          {/* ========================================================= */}
          {step === 4 && importResult && (
            <div className="py-8 max-w-xl mx-auto text-center space-y-6 animate-in zoom-in-95">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Bank Statement Successfully Imported!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {importResult.message}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checks Posted</span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{importResult.checks_created}</p>
                  <p className="text-[10px] text-slate-500">In Check Register</p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deposits Recorded</span>
                  <p className="text-xl font-bold text-sky-400 mt-1">{importResult.deposits_created}</p>
                  <p className="text-[10px] text-slate-500">Income GL entries</p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendors Created</span>
                  <p className="text-xl font-bold text-amber-400 mt-1">{importResult.vendors_created}</p>
                  <p className="text-[10px] text-slate-500">Auto-created in COA</p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rules Saved</span>
                  <p className="text-xl font-bold text-purple-400 mt-1">{importResult.rules_saved}</p>
                  <p className="text-[10px] text-slate-500">For future imports</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                >
                  View Check Register
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedFile(null);
                    setPreviewData(null);
                    setTransactions([]);
                    setImportResult(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Import Another Statement
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to File Selection</span>
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => setStep(previewData?.file_type === 'CSV' ? 2 : 1)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {step === 1 && (
              <button
                onClick={handleProcessUploadedFile}
                disabled={loading || !selectedFile || !bankAccountId}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{loading ? 'Parsing Statement...' : 'Parse & Preview Statement'}</span>
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleParseAndProceed}
                disabled={loading || !columnMapping.date_col || !columnMapping.description_col}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Proceed to Transaction Review</span>
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleConfirmImport}
                disabled={loading || selectedTxnIndices.size === 0}
                className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Confirm & Import to Check Register ({selectedTxnIndices.size})</span>
              </button>
            )}

            {step !== 4 && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* ROW-BY-ROW PARSER & REGISTER ADD MODAL                   */}
        {/* ========================================================= */}
        {showRowParserModal && activeRowIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">How to Add to Check Register</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                        Row {activeRowIndex + 1} of {rawCsvData?.raw_rows?.length || transactions.length || 0}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Configure register entry, category classification, and future automated rules.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowRowParserModal(false); setActiveRowIndex(null); }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">

                {/* Raw Bank Statement Line Card */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      <span>Original Bank Statement Line</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      CSV Row #{activeRowIndex + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Statement Date:</span>
                      <span className="text-emerald-300 font-semibold">{parsedDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Statement Amount:</span>
                      <span className={parsedIsOutflow ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {parsedIsOutflow ? '-' : '+'}${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-slate-500 block">Raw Description:</span>
                      <span className="text-white font-medium break-words">{parsedRawDesc || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Form Controls */}
                <div className="space-y-3.5">
                  
                  {/* Row 1: Date & Register Entry Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Transaction Date <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={parsedDate}
                        onChange={(e) => setParsedDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Strictly parsed to Transaction Date (not vendor).
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Register Entry Type <span className="text-rose-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setParsedType('DEBIT'); setParsedIsOutflow(true); }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1 ${
                            parsedType === 'DEBIT' 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Debit / ACH</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setParsedType('CHECK'); setParsedIsOutflow(true); }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1 ${
                            parsedType === 'CHECK' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Check</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setParsedType('DEPOSIT'); setParsedIsOutflow(false); }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1 ${
                            parsedType === 'DEPOSIT' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Deposit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setParsedType('TRANSFER'); }}
                          className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1 ${
                            parsedType === 'TRANSFER' 
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>Transfer</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* If Check, show Check Number input */}
                  {parsedType === 'CHECK' && (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3">
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Check Number #
                      </label>
                      <input
                        type="text"
                        value={parsedCheckNum}
                        onChange={(e) => setParsedCheckNum(e.target.value)}
                        placeholder="e.g. 1042"
                        className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {/* Row 2: Payee / Vendor Name & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Payee / Vendor Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={parsedPayee}
                        onChange={(e) => setParsedPayee(e.target.value)}
                        placeholder="Vendor or payee name"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Clean payee name extracted from description.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Amount ($) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={parsedAmount || ''}
                          onChange={(e) => setParsedAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setParsedIsOutflow(true)}
                          className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                            parsedIsOutflow ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-500'
                          }`}
                        >
                          Outflow (Expense / Payment)
                        </button>
                        <button
                          type="button"
                          onClick={() => setParsedIsOutflow(false)}
                          className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                            !parsedIsOutflow ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-500'
                          }`}
                        >
                          Inflow (Deposit / Income)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Category / Account Selection with Inline + Add Account */}
                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                        <span>Category / Chart of Accounts *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => openAddAccountModalForTxn(activeRowIndex)}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Add Account</span>
                      </button>
                    </div>

                    <select
                      value={parsedCategoryId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setParsedCategoryId(val);
                        const match = allCategories.find(c => c.id === val);
                        if (match) {
                          setParsedCategoryDisplay(`[${match.account_number}] ${match.name}`);
                        } else {
                          setParsedCategoryDisplay('');
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="">-- Select Register Category (Numerical Order) --</option>
                      {numericalCategories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.parent_account_id 
                            ? `\u00A0\u00A0\u00A0\u00A0↳ [${c.account_number}] ${c.name}` 
                            : `[${c.account_number}] ${c.name}`} ({c.type})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      e.g. <em>[61300] Bank & Merchant Service Fees</em> for Service Fees, or <em>[61200] Telephone Expense</em> for T-Mobile. If not listed, click <strong>+ Add Account</strong>.
                    </p>
                  </div>

                  {/* Row 4: Property Allocation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Property Allocation (Optional)
                    </label>
                    <select
                      value={parsedPropertyId}
                      onChange={(e) => setParsedPropertyId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- General / No Property Allocation --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row 5: Choice how to handle similar transactions in the future */}
                  <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3.5 space-y-2.5">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-purple-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={parsedSaveRule}
                        onChange={(e) => setParsedSaveRule(e.target.checked)}
                        className="rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Always handle similar transactions like this in the future (Remember Rule)</span>
                      </div>
                    </label>

                    {parsedSaveRule && (
                      <div className="pl-6 space-y-1.5">
                        <label className="block text-[11px] text-slate-300">
                          When bank description or payee contains this keyword:
                        </label>
                        <input
                          type="text"
                          value={parsedRuleKeyword}
                          onChange={(e) => setParsedRuleKeyword(e.target.value)}
                          placeholder="e.g. MONTHLY SERVICE FEE or Transamerica"
                          className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
                        />
                        <p className="text-[10px] text-slate-400">
                          Future statement uploads and other matching rows in this statement will automatically be categorized to the selected account.
                        </p>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Modal Footer with Stepping Controls */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevRow}
                  disabled={activeRowIndex === 0}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Previous Row</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSaveRowAndNext(false)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Save & Close
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveRowAndNext(true)}
                    className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
                  >
                    <span>
                      {activeRowIndex + 1 < (rawCsvData?.raw_rows?.length || transactions.length || 0)
                        ? `Save & Next Row (Row ${activeRowIndex + 2} →)`
                        : 'Save & Finish Parsing →'}
                    </span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Quick Add Account Modal Overlay (Layers above both Wizard and Row Parser) */}
        {showAddAccountModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Add Chart of Accounts Category</h3>
                    <p className="text-xs text-slate-400">Create a new GL account in your Chart of Accounts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {addAccountError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addAccountError}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Account # <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      placeholder="e.g. 61200"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Category Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="e.g. Telephone Expense or Internet & Wi-Fi"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Sub-Account Selector Card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAccountIsSubAccount}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setNewAccountIsSubAccount(checked);
                        if (!checked) {
                          setNewAccountParentId('');
                          try {
                            const sug = await api.getSuggestedAccountNumber(newAccountType);
                            if (sug && (sug.suggested_number || (sug as any).suggested_account_number)) {
                              setNewAccountNumber(sug.suggested_number || (sug as any).suggested_account_number);
                            }
                          } catch {}
                        } else {
                          // Find default parent: Credit Cards Payable (20300) for LIABILITY, Operating Checking (10100) for ASSET, etc.
                          const candidate = numericalCategories.find(c =>
                            !c.parent_account_id && (
                              (newAccountType === 'LIABILITY' && (c.account_number === '20300' || c.name.toLowerCase().includes('credit card'))) ||
                              c.type === newAccountType
                            )
                          ) || numericalCategories.find(c => !c.parent_account_id) || numericalCategories[0];

                          if (candidate) {
                            setNewAccountParentId(candidate.id);
                            setNewAccountType(candidate.type);
                            if (candidate.sub_type) {
                              setNewAccountSubType(candidate.sub_type);
                            } else if (candidate.type === 'LIABILITY') {
                              setNewAccountSubType('Credit Card');
                            }
                            try {
                              const sug = await api.getSuggestedAccountNumber(candidate.type, candidate.id);
                              if (sug && (sug.suggested_number || (sug as any).suggested_account_number)) {
                                setNewAccountNumber(sug.suggested_number || (sug as any).suggested_account_number);
                              }
                            } catch {}
                          }
                        }
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex items-center space-x-1.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Make this a sub-account of an existing category</span>
                    </div>
                  </label>

                  {newAccountIsSubAccount && (
                    <div className="pl-6 space-y-1.5 pt-1">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        Parent Account <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={newAccountParentId}
                        onChange={async (e) => {
                          const pId = e.target.value ? Number(e.target.value) : '';
                          setNewAccountParentId(pId);
                          if (pId) {
                            const parent = allCategories.find(c => c.id === pId);
                            if (parent) {
                              setNewAccountType(parent.type);
                              if (parent.sub_type) {
                                setNewAccountSubType(parent.sub_type);
                              } else if (parent.type === 'LIABILITY') {
                                setNewAccountSubType('Credit Card');
                              }
                              try {
                                const sug = await api.getSuggestedAccountNumber(parent.type, parent.id);
                                if (sug && (sug.suggested_number || (sug as any).suggested_account_number)) {
                                  setNewAccountNumber(sug.suggested_number || (sug as any).suggested_account_number);
                                }
                              } catch {}
                            }
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      >
                        <option value="">-- Select Parent Account (Numerical Order) --</option>
                        {numericalCategories
                          .filter(c => !c.parent_account_id)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              [{c.account_number}] {c.name} ({c.type})
                            </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">
                        e.g. Choose <strong>[20300] Credit Cards Payable</strong> to make Capital One a sub-account of Credit Cards.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Account Type {newAccountIsSubAccount && <span className="text-emerald-400 text-[10px]">(Inherited)</span>}
                    </label>
                    <select
                      value={newAccountType}
                      disabled={newAccountIsSubAccount}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setNewAccountType(val);
                        // Default sub-types
                        if (val === 'LIABILITY') setNewAccountSubType('Credit Card');
                        else if (val === 'ASSET') setNewAccountSubType('Checking');
                        else if (val === 'OPERATING_EXPENSE') setNewAccountSubType('Utilities');
                        else if (val === 'INCOME') setNewAccountSubType('Rental Income');
                        try {
                          const sug = await api.getSuggestedAccountNumber(val);
                          if (sug && (sug.suggested_number || (sug as any).suggested_account_number)) {
                            setNewAccountNumber(sug.suggested_number || (sug as any).suggested_account_number);
                          }
                        } catch {}
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                    >
                      <option value="OPERATING_EXPENSE">Operating Expense (60000s)</option>
                      <option value="COST_OF_GOODS_SOLD">Cost of Goods Sold (50000s)</option>
                      <option value="INCOME">Operating Income (40000s)</option>
                      <option value="OTHER_INCOME_EXPENSE">Other Income / Expense (90000s)</option>
                      <option value="ASSET">Asset (10000s - 19000s)</option>
                      <option value="LIABILITY">Liability (20000s - 29000s)</option>
                      <option value="EQUITY">Equity (30000s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Sub-Type</label>
                    <select
                      value={newAccountSubType}
                      onChange={(e) => setNewAccountSubType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {newAccountType === 'LIABILITY' && (
                        <>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Accounts Payable">Accounts Payable</option>
                          <option value="Line of Credit">Line of Credit</option>
                          <option value="Mortgage / Long-Term Debt">Mortgage / Long-Term Debt</option>
                          <option value="Current Liability">Current Liability</option>
                          <option value="Security Deposits Held">Security Deposits Held</option>
                          <option value="Other Liability">Other Liability</option>
                        </>
                      )}
                      {newAccountType === 'ASSET' && (
                        <>
                          <option value="Checking">Checking</option>
                          <option value="Savings">Savings</option>
                          <option value="Money Market">Money Market</option>
                          <option value="Escrow">Escrow</option>
                          <option value="Accounts Receivable">Accounts Receivable</option>
                          <option value="Fixed Asset">Fixed Asset</option>
                          <option value="Other Current Asset">Other Current Asset</option>
                        </>
                      )}
                      {newAccountType === 'OPERATING_EXPENSE' && (
                        <>
                          <option value="Utilities">Utilities</option>
                          <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                          <option value="Insurance">Insurance</option>
                          <option value="Property Taxes">Property Taxes</option>
                          <option value="Professional Fees">Professional Fees</option>
                          <option value="Advertising">Advertising</option>
                          <option value="Management Fees">Management Fees</option>
                          <option value="General & Administrative">General & Administrative</option>
                          <option value="Bank Fees">Bank Fees</option>
                          <option value="Other Expense">Other Expense</option>
                        </>
                      )}
                      {newAccountType === 'INCOME' && (
                        <>
                          <option value="Rental Income">Rental Income</option>
                          <option value="Late Fees">Late Fees</option>
                          <option value="Laundry & Parking">Laundry & Parking</option>
                          <option value="Pet Fees">Pet Fees</option>
                          <option value="Other Income">Other Income</option>
                        </>
                      )}
                      {newAccountType === 'COGS' && (
                        <>
                          <option value="Property Supplies">Property Supplies</option>
                          <option value="Contract Labor">Contract Labor</option>
                          <option value="Turnover Costs">Turnover Costs</option>
                          <option value="Other Direct Costs">Other Direct Costs</option>
                        </>
                      )}
                      {newAccountType === 'EQUITY' && (
                        <>
                          <option value="Owner's Equity">Owner's Equity</option>
                          <option value="Owner's Draw">Owner's Draw</option>
                          <option value="Retained Earnings">Retained Earnings</option>
                        </>
                      )}
                      {newAccountType === 'OTHER_INCOME_EXPENSE' && (
                        <>
                          <option value="Interest Expense">Interest Expense</option>
                          <option value="Depreciation & Amortization">Depreciation & Amortization</option>
                          <option value="Tax Penalty">Tax Penalty</option>
                          <option value="Other Miscellaneous">Other Miscellaneous</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={newAccountDesc}
                    onChange={(e) => setNewAccountDesc(e.target.value)}
                    placeholder="Brief description of this expense account"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Save Rule Card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAccountSaveRule}
                      onChange={(e) => setNewAccountSaveRule(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Remember this categorization rule for future imports</span>
                    </div>
                  </label>

                  {newAccountSaveRule && (
                    <div className="pl-6">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        When bank statement description or payee contains:
                      </label>
                      <input
                        type="text"
                        value={newAccountRuleKeyword}
                        onChange={(e) => setNewAccountRuleKeyword(e.target.value)}
                        placeholder="e.g. t-mobile or verizon"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Any matching transactions in this file and future uploads will automatically be mapped to this category.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewAccount}
                  disabled={isSavingNewAccount || !newAccountName.trim() || !newAccountNumber.trim()}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingNewAccount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingNewAccount ? 'Creating Account...' : 'Save & Assign Account'}</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
