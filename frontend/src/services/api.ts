import { 
  Property, 
  Category, 
  AccountItem,
  AccountType,
  CoaImportResult,
  Transaction, 
  StatementRecord, 
  MonthlyPnlResponse, 
  PreviewData, 
  ColumnMapping, 
  Company, 
  ClassEntity, 
  HierarchyCompany,
  CompanyFileItem,
  BackupRecord,
  SystemSession,
  LicenseStatus,
  LicensePricing,
  SampleStatementFile,
  JournalEntry,
  JournalEntryCreatePayload,
  CheckRecord,
  CheckCreatePayload,
  Vendor,
  VendorCreatePayload,
  ConcisePnlResponse,
  DateRangePreset,
  CategoryDrilldownData,
  SystemPrinter,
  EntityInterviewPayload,
  BankRule,
  BankRuleCreatePayload,
  BankRuleUpdatePayload,
  BankStatementRecord,
  BankTransactionItem,
  BankStatementPreviewResponse,
  BankStatementConfirmPayload,
  BankImportConfirmResult,
  SampleBankStatementFile,
  RawCsvPreviewResponse,
  QuickBooksAccountItem,
  QuickBooksCoaPreviewResult,
  QuickBooksImportResult,
  QuickBooksMigrationPreviewResult,
  QuickBooksConvertPayload,
  QuickBooksConvertResult
} from '../types';

const API_BASE = '/api';

export const api = {
  // ==========================================
  // LICENSE & SUBSCRIPTION MONETIZATION API
  // ==========================================
  async getLicenseStatus(): Promise<LicenseStatus> {
    const res = await fetch(`${API_BASE}/license/status`);
    if (!res.ok) throw new Error('Failed to fetch license status');
    return res.json();
  },

  async activateLicense(key: string): Promise<any> {
    const res = await fetch(`${API_BASE}/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to activate license key');
    }
    return res.json();
  },

  async deactivateLicense(): Promise<any> {
    const res = await fetch(`${API_BASE}/license/deactivate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to deactivate license');
    return res.json();
  },

  // ==========================================
  // SYSTEM & MULTI-COMPANY FILE MANAGEMENT
  // ==========================================
  async getSession(): Promise<SystemSession> {
    const res = await fetch(`${API_BASE}/system/session`);
    if (!res.ok) throw new Error('Failed to fetch system session');
    return res.json();
  },

  async getSystemCompanies(): Promise<CompanyFileItem[]> {
    const res = await fetch(`${API_BASE}/system/companies`);
    if (!res.ok) throw new Error('Failed to fetch company files list');
    return res.json();
  },

  async openSystemCompany(company_key: string): Promise<any> {
    const res = await fetch(`${API_BASE}/system/companies/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_key }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to open company file');
    }
    return res.json();
  },

  async createSystemCompanyFile(data: { name: string; ein?: string; notes?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/system/companies/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create company file');
    }
    return res.json();
  },

  async closeSystemCompany(): Promise<any> {
    const res = await fetch(`${API_BASE}/system/companies/close`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to close company');
    return res.json();
  },

  async deleteSystemCompany(company_key: string): Promise<any> {
    const res = await fetch(`${API_BASE}/system/companies/${encodeURIComponent(company_key)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete company file');
    }
    return res.json();
  },

  async pruneRestoredCompanies(keep_count: number = 3): Promise<any> {
    const res = await fetch(`${API_BASE}/system/companies/prune-restored?keep_count=${keep_count}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to prune old files and backups');
    }
    return res.json();
  },

  async pruneBackups(keep_count: number = 3): Promise<any> {
    const res = await fetch(`${API_BASE}/system/backups/prune?keep_count=${keep_count}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to prune backups');
    }
    return res.json();
  },

  async createBackup(custom_name?: string): Promise<BackupRecord> {
    const res = await fetch(`${API_BASE}/system/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create backup');
    }
    return res.json();
  },

  async getSystemBackups(): Promise<BackupRecord[]> {
    const res = await fetch(`${API_BASE}/system/backups`);
    if (!res.ok) throw new Error('Failed to fetch backup history');
    return res.json();
  },

  getBackupDownloadUrl(filename: string): string {
    return `${API_BASE}/system/backups/download/${filename}`;
  },

  async restoreCompanyFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/system/restore`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to restore company from backup');
    }
    return res.json();
  },

  // ==========================================
  // ACTIVE COMPANY DATA
  // ==========================================

  // Companies (Top Tier)
  async getCompanies(): Promise<Company[]> {
    const res = await fetch(`${API_BASE}/companies`);
    if (!res.ok) throw new Error('Failed to fetch companies');
    return res.json();
  },

  async createCompany(data: { name: string; ein?: string; notes?: string }): Promise<Company> {
    const res = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create company');
    }
    return res.json();
  },

  // Classes / LLCs (Middle Tier)
  async getClasses(company_id?: number): Promise<ClassEntity[]> {
    const query = company_id ? `?company_id=${company_id}` : '';
    const res = await fetch(`${API_BASE}/classes${query}`);
    if (!res.ok) throw new Error('Failed to fetch classes');
    return res.json();
  },

  async createClass(data: { 
    name: string; 
    company_id?: number | null; 
    description?: string;
    entity_type?: string;
    tax_classification?: string;
    create_default_property?: boolean;
    default_property_name?: string;
  }): Promise<ClassEntity> {
    const res = await fetch(`${API_BASE}/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create class');
    }
    return res.json();
  },

  async setupEntityInterview(payload: EntityInterviewPayload): Promise<{
    status: string;
    company: Company | null;
    class_entity: ClassEntity;
    property: Property | null;
  }> {
    const res = await fetch(`${API_BASE}/entity-wizard/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to complete entity setup interview');
    }
    return res.json();
  },

  // Properties / Sub-Classes (Bottom Tier with Address Form)
  async getProperties(params?: { class_id?: number; company_id?: number }): Promise<Property[]> {
    const query = new URLSearchParams();
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.company_id) query.append('company_id', params.company_id.toString());

    const res = await fetch(`${API_BASE}/properties?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch properties');
    return res.json();
  },

  async createProperty(data: {
    name: string;
    class_id?: number | null;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    property_type?: string;
    units_count?: number;
    acquisition_cost?: number;
    acquisition_date?: string;
    unit_number?: string;
    parent_property_id?: number;
  }): Promise<Property> {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create sub-class property');
    }
    return res.json();
  },

  // Full Hierarchy Tree
  async getHierarchy(): Promise<HierarchyCompany[]> {
    const res = await fetch(`${API_BASE}/hierarchy`);
    if (!res.ok) throw new Error('Failed to fetch hierarchy');
    return res.json();
  },

  // Categories & Chart of Accounts (COA)
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  async getAccounts(params?: {
    type?: string;
    search?: string;
    active_only?: boolean;
  }): Promise<AccountItem[]> {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.search) query.append('search', params.search);
    if (params?.active_only) query.append('active_only', 'true');

    const res = await fetch(`${API_BASE}/accounts?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch chart of accounts');
    return res.json();
  },

  async getSuggestedAccountNumber(type: string, parent_account_id?: number | null): Promise<{ account_type: string; suggested_number: string }> {
    let url = `${API_BASE}/accounts/suggest-number?type=${encodeURIComponent(type)}`;
    if (parent_account_id) {
      url += `&parent_account_id=${parent_account_id}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch suggested account number');
    return res.json();
  },

  async resetCoaTemplate(template: 'DEFAULT' | 'CUSTOM', overwrite: boolean = true): Promise<any> {
    const res = await fetch(`${API_BASE}/accounts/reset-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, overwrite }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to initialize Chart of Accounts template');
    }
    return res.json();
  },

  async createAccount(data: {
    account_number?: string;
    name: string;
    type: string;
    sub_type?: string;
    description?: string;
    is_repair_category?: boolean;
    is_rental_income?: boolean;
    is_active?: boolean;
    parent_account_id?: number | null;
    opening_balance?: number;
    opening_balance_date?: string | null;
  }): Promise<AccountItem> {
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create account');
    }
    return res.json();
  },

  async updateAccount(id: number, data: Partial<AccountItem>): Promise<AccountItem> {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update account');
    }
    return res.json();
  },

  async deleteAccount(id: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete account');
    }
    return res.json();
  },

  getAccountsExportUrl(): string {
    return `${API_BASE}/accounts/export-csv`;
  },

  getAccountsTemplateUrl(): string {
    return `${API_BASE}/accounts/template-csv`;
  },

  async importAccountsCsv(file: File): Promise<CoaImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/accounts/import-csv`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import Chart of Accounts CSV');
    }
    return res.json();
  },

  async importAccountsRawCsv(rawCsv: string): Promise<CoaImportResult> {
    const formData = new FormData();
    formData.append('raw_csv', rawCsv);

    const res = await fetch(`${API_BASE}/accounts/import-csv`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import CSV');
    }
    return res.json();
  },

  async previewQuickBooksCoa(file: File): Promise<QuickBooksCoaPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/coa/quickbooks/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to parse QuickBooks Chart of Accounts file');
    }
    return res.json();
  },

  async importQuickBooksCoa(
    accounts: QuickBooksAccountItem[],
    overwrite: boolean = false,
    createOpeningBalances: boolean = true
  ): Promise<QuickBooksImportResult> {
    const res = await fetch(`${API_BASE}/coa/quickbooks/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accounts,
        overwrite,
        create_opening_balances: createOpeningBalances
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import QuickBooks accounts');
    }
    return res.json();
  },

  async importQuickBooksCoaFile(
    file: File,
    overwrite: boolean = false,
    createOpeningBalances: boolean = true
  ): Promise<QuickBooksImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('overwrite', String(overwrite));
    formData.append('create_opening_balances', String(createOpeningBalances));
    const res = await fetch(`${API_BASE}/coa/quickbooks/import-file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import QuickBooks export file');
    }
    return res.json();
  },

  // QuickBooks Full Migration Hub API
  async previewQuickBooksMigration(file: File): Promise<QuickBooksMigrationPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/quickbooks/migrate/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to parse QuickBooks migration file');
    }
    return res.json();
  },

  async convertQuickBooksMigration(payload: QuickBooksConvertPayload): Promise<QuickBooksConvertResult> {
    const res = await fetch(`${API_BASE}/quickbooks/migrate/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to convert QuickBooks company file');
    }
    return res.json();
  },

  // Transactions
  async getTransactions(params?: {
    company_id?: number;
    class_id?: number;
    property_id?: number;
    month?: string;
    category_type?: string;
    search?: string;
  }): Promise<Transaction[]> {
    const query = new URLSearchParams();
    if (params?.company_id) query.append('company_id', params.company_id.toString());
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.property_id) query.append('property_id', params.property_id.toString());
    if (params?.month) query.append('month', params.month);
    if (params?.category_type) query.append('category_type', params.category_type);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/transactions?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createTransaction(data: {
    date: string;
    property_id: number;
    class_id?: number | null;
    category_id?: number | null;
    account_name: string;
    category_type: string;
    amount: number;
    description?: string;
    payee?: string;
    source?: string;
  }): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create transaction');
    }
    return res.json();
  },

  async deleteTransaction(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
  },

  // Statements & Uploads
  async uploadStatementPreview(file: File): Promise<PreviewData> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/statements/upload-preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to upload and parse statement');
    }
    return res.json();
  },

  async confirmStatementImport(data: {
    filename: string;
    property_id?: number | null;
    class_id?: number | null;
    column_mapping: ColumnMapping;
    aggregate_rental_income: boolean;
    raw_file_content_id: string;
  }): Promise<{ status: string; message: string; consolidated_rental_rows: number }> {
    const res = await fetch(`${API_BASE}/statements/confirm-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to confirm statement import');
    }
    return res.json();
  },

  async getStatements(): Promise<StatementRecord[]> {
    const res = await fetch(`${API_BASE}/statements`);
    if (!res.ok) throw new Error('Failed to fetch statement history');
    return res.json();
  },

  async getSampleStatements(): Promise<SampleStatementFile[]> {
    const res = await fetch(`${API_BASE}/sample-statements/list`);
    if (!res.ok) throw new Error('Failed to fetch sample statements');
    return res.json();
  },

  getSampleDownloadUrl(filename: string): string {
    return `${API_BASE}/sample-statements/download/${filename}`;
  },

  // Financial Reports
  async getMonthlyPnlReport(params?: {
    company_id?: number;
    class_id?: number;
    property_id?: number;
    year?: number;
    month?: string;
  }): Promise<MonthlyPnlResponse> {
    const query = new URLSearchParams();
    if (params?.company_id) query.append('company_id', params.company_id.toString());
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.property_id) query.append('property_id', params.property_id.toString());
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month);

    const res = await fetch(`${API_BASE}/reports/monthly-pnl?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch monthly P&L report');
    return res.json();
  },

  async getConcisePnlReport(params?: {
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
  }): Promise<ConcisePnlResponse> {
    const query = new URLSearchParams();
    if (params?.company_id) query.append('company_id', params.company_id.toString());
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.property_id) query.append('property_id', params.property_id.toString());
    if (params?.preset) query.append('preset', params.preset);
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month);
    if (params?.quarter) query.append('quarter', params.quarter.toString());
    if (params?.half) query.append('half', params.half.toString());
    if (params?.fiscal_start_month) query.append('fiscal_start_month', params.fiscal_start_month.toString());
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.compare_prior !== undefined) query.append('compare_prior', params.compare_prior.toString());

    const res = await fetch(`${API_BASE}/reports/concise-pnl?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch concise P&L statement');
    return res.json();
  },

  async getCategoryDrilldown(params: {
    category_id?: number | null;
    account_name?: string;
    from_date?: string;
    to_date?: string;
    property_id?: number;
    class_id?: number;
    company_id?: number;
  }): Promise<CategoryDrilldownData> {
    const query = new URLSearchParams();
    if (params.category_id) query.append('category_id', params.category_id.toString());
    if (params.account_name) query.append('account_name', params.account_name);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.property_id) query.append('property_id', params.property_id.toString());
    if (params.class_id) query.append('class_id', params.class_id.toString());
    if (params.company_id) query.append('company_id', params.company_id.toString());

    const res = await fetch(`${API_BASE}/reports/category-drilldown?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch category detail transactions');
    return res.json();
  },

  getConcisePnlExportUrl(params?: {
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
  }): string {
    const query = new URLSearchParams();
    if (params?.company_id) query.append('company_id', params.company_id.toString());
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.property_id) query.append('property_id', params.property_id.toString());
    if (params?.preset) query.append('preset', params.preset);
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month);
    if (params?.quarter) query.append('quarter', params.quarter.toString());
    if (params?.half) query.append('half', params.half.toString());
    if (params?.fiscal_start_month) query.append('fiscal_start_month', params.fiscal_start_month.toString());
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.compare_prior !== undefined) query.append('compare_prior', params.compare_prior.toString());
    return `${API_BASE}/reports/concise-pnl/export-csv?${query.toString()}`;
  },

  getCategoryDrilldownExportUrl(params: {
    category_id?: number | null;
    account_name?: string;
    from_date?: string;
    to_date?: string;
    property_id?: number;
    class_id?: number;
    company_id?: number;
  }): string {
    const query = new URLSearchParams();
    if (params.category_id) query.append('category_id', params.category_id.toString());
    if (params.account_name) query.append('account_name', params.account_name);
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);
    if (params.property_id) query.append('property_id', params.property_id.toString());
    if (params.class_id) query.append('class_id', params.class_id.toString());
    if (params.company_id) query.append('company_id', params.company_id.toString());
    return `${API_BASE}/reports/category-drilldown/export-csv?${query.toString()}`;
  },

  
  // ==========================================
  
  // ==========================================
  // Vendor Management
  // ==========================================
  async getVendors(params?: { search?: string; active_only?: boolean }): Promise<Vendor[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.active_only) query.append('active_only', 'true');

    const res = await fetch(`${API_BASE}/vendors?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch vendors');
    return res.json();
  },

  async getNextVendorAccountNumber(): Promise<{ next_account_number: string }> {
    const res = await fetch(`${API_BASE}/vendors/next-account-number`);
    if (!res.ok) throw new Error('Failed to fetch next vendor account number');
    return res.json();
  },

  async createVendor(data: VendorCreatePayload): Promise<Vendor> {
    const res = await fetch(`${API_BASE}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create vendor');
    }
    return res.json();
  },

  async updateVendor(id: number, data: Partial<VendorCreatePayload>): Promise<Vendor> {
    const res = await fetch(`${API_BASE}/vendors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update vendor');
    }
    return res.json();
  },

  async deleteVendor(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/vendors/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete vendor');
    return res.json();
  },

  getVendorsExportUrl(): string {
    return `${API_BASE}/vendors/export-csv`;
  },

  // General Journal Entries
  // ==========================================
  async getJournalEntries(params?: {
    from_date?: string;
    to_date?: string;
    class_id?: number;
    search?: string;
  }): Promise<JournalEntry[]> {
    const query = new URLSearchParams();
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.class_id) query.append('class_id', params.class_id.toString());
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/journal-entries?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch journal entries');
    return res.json();
  },

  async getNextJournalNumber(): Promise<{ next_number: string }> {
    const res = await fetch(`${API_BASE}/journal-entries/next-number`);
    if (!res.ok) throw new Error('Failed to fetch next journal entry number');
    return res.json();
  },

  async createJournalEntry(data: JournalEntryCreatePayload): Promise<JournalEntry> {
    const res = await fetch(`${API_BASE}/journal-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create journal entry');
    }
    return res.json();
  },

  async getJournalEntry(id: number): Promise<JournalEntry> {
    const res = await fetch(`${API_BASE}/journal-entries/${id}`);
    if (!res.ok) throw new Error('Failed to fetch journal entry details');
    return res.json();
  },

  async deleteJournalEntry(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/journal-entries/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete journal entry');
    return res.json();
  },

  // ==========================================
  // QuickBooks Check Writing
  // ==========================================
  async getChecks(params?: {
    bank_account_id?: number;
    from_date?: string;
    to_date?: string;
    search?: string;
  }): Promise<CheckRecord[]> {
    const query = new URLSearchParams();
    if (params?.bank_account_id) query.append('bank_account_id', params.bank_account_id.toString());
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/checks?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch check records');
    return res.json();
  },

  async getNextCheckNumber(bank_account_id?: number): Promise<{ next_check_number: string }> {
    const query = bank_account_id ? `?bank_account_id=${bank_account_id}` : '';
    const res = await fetch(`${API_BASE}/checks/next-number${query}`);
    if (!res.ok) throw new Error('Failed to fetch next check number');
    return res.json();
  },

  async getWordsPreview(amount: number): Promise<{ amount: number; amount_in_words: string }> {
    const res = await fetch(`${API_BASE}/checks/words-preview?amount=${encodeURIComponent(amount)}`);
    if (!res.ok) throw new Error('Failed to generate words preview');
    return res.json();
  },

  async getBankBalance(bank_account_id: number): Promise<{ bank_account_id: number; balance: number }> {
    const res = await fetch(`${API_BASE}/checks/bank-balance/${bank_account_id}`);
    if (!res.ok) throw new Error('Failed to fetch bank balance');
    return res.json();
  },

  async createCheck(data: CheckCreatePayload): Promise<CheckRecord> {
    const res = await fetch(`${API_BASE}/checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to write check');
    }
    return res.json();
  },

  async getCheck(id: number): Promise<CheckRecord> {
    const res = await fetch(`${API_BASE}/checks/${id}`);
    if (!res.ok) throw new Error('Failed to fetch check');
    return res.json();
  },

  async voidCheck(id: number): Promise<CheckRecord> {
    const res = await fetch(`${API_BASE}/checks/${id}/void`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to void check');
    }
    return res.json();
  },

  getCheckPrintVoucherUrl(id: number): string {
    return `${API_BASE}/checks/${id}/print-voucher`;
  },

  async seedDemoData(): Promise<any> {
    const res = await fetch(`${API_BASE}/seed-demo-data`, { method: 'POST' });
    return res.json();
  },

  // ==========================================
  // WINDOWS PRINTERS & REPORT PRINTING
  // ==========================================
  async getPrinters(): Promise<SystemPrinter[]> {
    const res = await fetch(`${API_BASE}/printers`);
    if (!res.ok) throw new Error('Failed to fetch system printers');
    return res.json();
  },

  getConcisePnlPrintUrl(
    reportParams: {
      company_id?: number;
      class_id?: number;
      property_id?: number;
      preset?: string;
      year?: number;
      month?: string;
      quarter?: number;
      half?: number;
      fiscal_start_month?: number;
      from_date?: string;
      to_date?: string;
      compare_prior?: boolean;
    },
    printConfig: {
      orientation?: string;
      duplex?: string;
      page_fit?: string;
      page_per_property?: boolean;
      include_summary?: boolean;
      target_printer?: string;
      autoprint?: boolean;
    }
  ): string {
    const query = new URLSearchParams();
    if (reportParams.company_id) query.append('company_id', String(reportParams.company_id));
    if (reportParams.class_id) query.append('class_id', String(reportParams.class_id));
    if (reportParams.property_id) query.append('property_id', String(reportParams.property_id));
    if (reportParams.preset) query.append('preset', reportParams.preset);
    if (reportParams.year) query.append('year', String(reportParams.year));
    if (reportParams.month) query.append('month', reportParams.month);
    if (reportParams.quarter) query.append('quarter', String(reportParams.quarter));
    if (reportParams.half) query.append('half', String(reportParams.half));
    if (reportParams.fiscal_start_month) query.append('fiscal_start_month', String(reportParams.fiscal_start_month));
    if (reportParams.from_date) query.append('from_date', reportParams.from_date);
    if (reportParams.to_date) query.append('to_date', reportParams.to_date);
    if (reportParams.compare_prior !== undefined) query.append('compare_prior', String(reportParams.compare_prior));

    if (printConfig.orientation) query.append('orientation', printConfig.orientation);
    if (printConfig.duplex) query.append('duplex', printConfig.duplex);
    if (printConfig.page_fit) query.append('page_fit', printConfig.page_fit);
    if (printConfig.page_per_property !== undefined) query.append('page_per_property', String(printConfig.page_per_property));
    if (printConfig.include_summary !== undefined) query.append('include_summary', String(printConfig.include_summary));
    if (printConfig.target_printer) query.append('target_printer', printConfig.target_printer);
    if (printConfig.autoprint !== undefined) query.append('autoprint', String(printConfig.autoprint));

    return `${API_BASE}/reports/concise-pnl/print-view?${query.toString()}`;
  },

  // =====================================================================
  // BANK STATEMENT IMPORT WIZARD & AUTOMATED RULES API
  // =====================================================================
  async getSampleBankStatements(): Promise<SampleBankStatementFile[]> {
    const res = await fetch(`${API_BASE}/bank-statements/samples`);
    if (!res.ok) throw new Error('Failed to fetch sample bank statements');
    return res.json();
  },

  getSampleBankStatementDownloadUrl(filename: string): string {
    return `${API_BASE}/bank-statements/sample-download/${encodeURIComponent(filename)}`;
  },

  async previewSampleBankStatement(filename: string, bankAccountId: number): Promise<BankStatementPreviewResponse> {
    const res = await fetch(`${API_BASE}/bank-statements/sample-preview/${encodeURIComponent(filename)}?bank_account_id=${bankAccountId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to preview sample statement');
    }
    return res.json();
  },

  async getRawCsvPreview(file: File): Promise<RawCsvPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/bank-statements/csv-raw-preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to inspect CSV file');
    }
    return res.json();
  },

  async uploadBankStatementPreview(
    file: File,
    bankAccountId: number,
    columnMapping?: Record<string, string | null>
  ): Promise<BankStatementPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank_account_id', String(bankAccountId));
    if (columnMapping) {
      formData.append('column_mapping', JSON.stringify(columnMapping));
    }

    const res = await fetch(`${API_BASE}/bank-statements/upload-preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to upload and parse bank statement');
    }
    return res.json();
  },

  async confirmBankStatementImport(payload: BankStatementConfirmPayload): Promise<BankImportConfirmResult> {
    const res = await fetch(`${API_BASE}/bank-statements/confirm-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to import bank statement');
    }
    return res.json();
  },

  async getBankStatements(): Promise<BankStatementRecord[]> {
    const res = await fetch(`${API_BASE}/bank-statements`);
    if (!res.ok) throw new Error('Failed to fetch bank statement history');
    return res.json();
  },

  async getBankRules(): Promise<BankRule[]> {
    const res = await fetch(`${API_BASE}/bank-rules`);
    if (!res.ok) throw new Error('Failed to fetch bank rules');
    return res.json();
  },

  async createBankRule(payload: BankRuleCreatePayload): Promise<BankRule> {
    const res = await fetch(`${API_BASE}/bank-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create bank rule');
    }
    return res.json();
  },

  async updateBankRule(id: number, payload: BankRuleUpdatePayload): Promise<BankRule> {
    const res = await fetch(`${API_BASE}/bank-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update bank rule');
    }
    return res.json();
  },

  async deleteBankRule(id: number): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/bank-rules/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete bank rule');
    }
    return res.json();
  }
};
