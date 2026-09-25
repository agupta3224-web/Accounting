export interface LicensePricing {
  trial_days: number;
  monthly_promo_price: number;
  monthly_standard_price: number;
  annual_promo_price: number;
  annual_standard_price: number;
  special_offer_text: string;
}

export interface LicenseStatus {
  status: 'ACTIVE' | 'TRIAL_ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNLICENSED';
  plan: string;
  plan_display: string;
  customer_name?: string | null;
  customer_email?: string | null;
  expires_at?: string;
  days_remaining: number;
  is_trial: boolean;
  is_expiring_soon: boolean;
  error?: string;
  pricing?: LicensePricing;
}

export interface SystemSession {
  active_company_key: string | null;
  active_company_name: string | null;
  is_sample: boolean;
  has_active_company: boolean;
}

export interface CompanyFileItem {
  key: string;
  name: string;
  file_name: string;
  is_sample: boolean;
  is_restored?: boolean;
  size_kb: number;
  last_modified: string;
  is_active: boolean;
}

export interface BackupRecord {
  filename: string;
  filepath: string;
  size_kb: number;
  is_auto: boolean;
  created_at: string;
  company_name?: string;
}

export interface Company {
  id: number;
  name: string;
  ein?: string;
  notes?: string;
  classes_count?: number;
  created_at?: string;
}

export interface ClassEntity {
  id: number;
  company_id?: number | null;
  company_name?: string;
  name: string; // LLC / Corp Name
  description?: string;
  entity_type?: 'CORP' | 'LLC' | 'SELF_EMPLOYED';
  tax_classification?: string;
  tax_form?: string;
  ein?: string;
  office_address_line1?: string;
  office_address_line2?: string;
  office_city?: string;
  office_state?: string;
  office_zip?: string;
  office_address?: string;
  mailing_address_line1?: string;
  mailing_address_line2?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  mailing_address?: string;
  contact_name?: string;
  contact_phone?: string;
  properties_count?: number;
}

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

export interface ApartmentUnitItem {
  unit_number: string; // e.g. "Apt 101"
  sub_class_name?: string; // e.g. "1204 Oak St - Apt 101"
  acquisition_cost?: number;
  acquisition_date?: string;
}

export interface PropertyItemPayload {
  name: string; // Sub Class name (street number or apartment number)
  address_line1: string; // Full street address line 1 (Required)
  address_line2?: string; // Street address line 2 (Optional)
  city: string;
  state: string;
  zip_code: string;
  property_type?: string;
  units_count?: number;
  acquisition_cost?: number; // Acquisition Cost (Optional)
  acquisition_date?: string; // Acquisition Date (Optional)
  unit_number?: string;
  is_multifamily?: boolean;
  multifamily_mode?: 'WHOLE' | 'INDIVIDUAL_UNITS';
  apartment_units?: ApartmentUnitItem[];
}

export interface EntityItemPayload {
  entity_name: string;
  entity_type: 'CORP' | 'LLC' | 'SELF_EMPLOYED' | 'COMMON';
  tax_classification?: string;
  tax_form?: string;
  ein?: string;
  description?: string;
  office_address_line1?: string;
  office_address_line2?: string;
  office_city?: string;
  office_state?: string;
  office_zip?: string;
  mailing_same_as_office: boolean;
  mailing_address_line1?: string;
  mailing_address_line2?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  contact_name?: string;
  contact_phone?: string;
  properties?: PropertyItemPayload[];
}

export interface EntityInterviewPayload {
  is_portfolio: boolean;
  portfolio_name?: string;
  portfolio_ein?: string;
  portfolio_notes?: string;
  company_id?: number;
  create_new_company_file?: boolean;
  include_common_class?: boolean;
  common_class_name?: string;
  common_property_name?: string;
  coa_mode?: 'DEFAULT' | 'CUSTOM';
  entities?: EntityItemPayload[];

  entity_name?: string;
  entity_type: 'CORP' | 'LLC' | 'SELF_EMPLOYED' | 'COMMON';
  tax_classification?: string;
  tax_form?: string;
  ein?: string;
  description?: string;

  office_address_line1?: string;
  office_address_line2?: string;
  office_city?: string;
  office_state?: string;
  office_zip?: string;

  mailing_same_as_office: boolean;
  mailing_address_line1?: string;
  mailing_address_line2?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;

  contact_name?: string;
  contact_phone?: string;

  // Initial Bank Opening Balance (for users bringing info over to new file)
  initial_bank_opening_balance?: number;
  initial_bank_opening_date?: string;

  // Step 4: Sub-Class Properties List (Multi-Property & Multifamily)
  properties?: PropertyItemPayload[];

  // Backwards compatibility fields
  initial_property_name?: string;
  initial_property_address?: string;
  initial_property_type?: string;
  initial_property_units?: number;
}

export interface Property {
  id: number;
  class_id?: number | null;
  class_name?: string; // LLC Name
  company_id?: number | null;
  company_name?: string;
  name: string; // Sub-Class Name (e.g. 2908 Depot)
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  address?: string; // Full cached address
  property_type: string;
  units_count: number;
  acquisition_cost?: number;
  acquisition_date?: string;
  unit_number?: string;
  parent_property_id?: number;
  created_at?: string;
}

export interface HierarchyClass extends ClassEntity {
  properties: Property[];
}

export interface HierarchyCompany extends Company {
  classes: HierarchyClass[];
}

export type AccountType = 
  | 'ASSET'                 // 1xxxx (10000 - 19999)
  | 'LIABILITY'             // 2xxxx (20000 - 29999)
  | 'EQUITY'                // 3xxxx (30000 - 39999)
  | 'INCOME'                // 4xxxx (40000 - 49999)
  | 'REVENUE'               // 4xxxx (40000 - 49999)
  | 'COGS'                  // 5xxxx (50000 - 59999)
  | 'OPERATING_EXPENSE'     // 6xxxx - 8xxxx (60000 - 89999)
  | 'OTHER_INCOME_EXPENSE'  // 9xxxx (90000 - 99999)
  | 'NON_OPERATING_EXPENSE'
  | 'CAPEX';

export interface AccountItem {
  id: number;
  account_number: string;
  name: string;
  display_name: string;
  type: string;
  sub_type?: string;
  description?: string;
  is_active: boolean;
  is_repair_category: boolean;
  is_rental_income: boolean;
  parent_account_id?: number | null;
  parent_account_name?: string | null;
  parent_account_number?: string | null;
  sub_accounts_count?: number;
  is_sub_account?: boolean;
  transactions_count?: number;
  opening_balance?: number;
  opening_balance_date?: string | null;
  current_balance?: number;
  created_at?: string;
}

export interface CoaImportResult {
  success: boolean;
  imported_count: number;
  updated_count: number;
  errors: string[];
  message: string;
}

export interface Category {
  id: number;
  account_number?: string;
  name: string;
  display_name?: string;
  type: string;
  sub_type?: string;
  description?: string;
  is_active?: boolean;
  is_repair_category: boolean;
  is_rental_income: boolean;
  parent_account_id?: number | null;
  parent_account_name?: string | null;
  parent_account_number?: string | null;
  sub_accounts_count?: number;
  is_sub_account?: boolean;
  opening_balance?: number;
  opening_balance_date?: string | null;
  transactions_count?: number;
}

export interface AggregatedSubItem {
  date: string;
  account_name: string;
  description?: string;
  amount: number;
  class_hint?: string;
}

export interface Transaction {
  id: number;
  date: string;
  month: string;
  property_id: number;
  property_name: string;
  class_id?: number | null;
  class_name?: string;
  company_name?: string;
  category_id?: number | null;
  category_account_number?: string;
  category_name: string;
  category_display_name?: string;
  category_type: string;
  account_name: string;
  amount: number;
  description: string;
  payee: string;
  source: 'IMPORTED' | 'MANUAL';
  statement_id?: number | null;
  is_aggregated: boolean;
  raw_aggregated_items?: AggregatedSubItem[] | null;
  created_at?: string;
}

export interface StatementRecord {
  id: number;
  filename: string;
  file_type: string;
  upload_date: string;
  property_id?: number | null;
  property_name?: string;
  month?: string;
  status: string;
  row_count: number;
  consolidated_count: number;
  notes?: string;
}

export interface MonthReport {
  month: string;
  rental_income_items: Transaction[];
  other_income_items: Transaction[];
  total_rental_income: number;
  total_other_income: number;
  total_gross_income: number;
  operating_expense_items: Transaction[];
  total_operating_expenses: number;
  is_operating_expenses_bold: boolean;
  total_repairs: number;
  repair_percentage: number;
  repair_health: 'GOOD' | 'MODERATE' | 'HIGH';
  net_operating_income: number;
  non_operating_expense_items: Transaction[];
  total_non_operating: number;
  net_cash_flow: number;
}

export interface PropertyReport {
  property_id: number;
  property_name: string;
  class_name?: string;
  company_name?: string;
  address?: string;
  property_type?: string;
  units_count: number;
  months: MonthReport[];
}

export interface PortfolioSummary {
  total_properties: number;
  portfolio_total_rental_income: number;
  portfolio_total_operating_expenses: number;
  portfolio_total_repairs: number;
  portfolio_total_noi: number;
  portfolio_repair_percentage: number;
}

export interface MonthlyPnlResponse {
  properties_reports: PropertyReport[];
  summary: PortfolioSummary;
}

export type DateRangePreset = 
  | 'MONTHLY' 
  | 'QUARTERLY' 
  | 'SIX_MONTH' 
  | 'ANNUAL' 
  | 'YTD' 
  | 'FISCAL_YEAR' 
  | 'CUSTOM';

export interface ConsolidatedCategoryLineItem {
  category_id: number | null;
  account_number: string;
  account_name: string;
  display_name: string;
  category_type: string;
  is_repair: boolean;
  is_rental_income: boolean;
  current_amount: number;
  prior_amount: number;
  change_amount: number;
  change_percent: number;
  transaction_count: number;
}

export interface ConcisePnlSection {
  items: ConsolidatedCategoryLineItem[];
  total_current: number;
  total_prior: number;
  total_change: number;
  total_change_percent: number;
}

export interface ConcisePropertyReport {
  property_id: number;
  property_name: string;
  class_name?: string;
  company_name?: string;
  address?: string;
  property_type?: string;
  units_count: number;
  period_label: string;
  prior_period_label: string;
  rental_income_section: ConcisePnlSection;
  other_income_section: ConcisePnlSection;
  total_gross_income_current: number;
  total_gross_income_prior: number;
  total_gross_income_change: number;
  total_gross_income_change_percent: number;
  operating_expenses_section: ConcisePnlSection;
  total_operating_expenses_current: number;
  total_operating_expenses_prior: number;
  total_operating_expenses_change: number;
  total_operating_expenses_change_percent: number;
  is_operating_expenses_bold: boolean;
  total_repairs_current: number;
  total_repairs_prior: number;
  repair_percentage_current: number;
  repair_percentage_prior: number;
  repair_health: 'GOOD' | 'MODERATE' | 'HIGH';
  net_operating_income_current: number;
  net_operating_income_prior: number;
  net_operating_income_change: number;
  net_operating_income_change_percent: number;
  non_operating_section: ConcisePnlSection;
  net_cash_flow_current: number;
  net_cash_flow_prior: number;
  net_cash_flow_change: number;
  net_cash_flow_change_percent: number;
}

export interface PeriodInfo {
  preset: string;
  start_date: string;
  end_date: string;
  prior_start_date: string;
  prior_end_date: string;
  period_label: string;
  prior_period_label: string;
  compare_prior: boolean;
}

export interface ConcisePnlSummary {
  total_properties: number;
  portfolio_rental_income_current: number;
  portfolio_rental_income_prior: number;
  portfolio_rental_income_change: number;
  portfolio_gross_income_current: number;
  portfolio_gross_income_prior: number;
  portfolio_operating_expenses_current: number;
  portfolio_operating_expenses_prior: number;
  portfolio_operating_expenses_change: number;
  portfolio_repairs_current: number;
  portfolio_repairs_prior: number;
  portfolio_repair_percentage_current: number;
  portfolio_repair_percentage_prior: number;
  portfolio_noi_current: number;
  portfolio_noi_prior: number;
  portfolio_noi_change: number;
  portfolio_net_cash_flow_current: number;
  portfolio_net_cash_flow_prior: number;
}

export interface ConcisePnlResponse {
  period_info: PeriodInfo;
  properties_reports: ConcisePropertyReport[];
  portfolio_consolidated_report?: ConcisePropertyReport;
  summary: ConcisePnlSummary;
}

export interface CategoryDrilldownData {
  category: {
    id: number | null;
    account_number: string;
    name: string;
    display_name: string;
    type: string;
    is_repair_category: boolean;
    is_rental_income: boolean;
  };
  period_info: {
    from_date: string;
    to_date: string;
    date_label: string;
  };
  total_amount: number;
  transaction_count: number;
  transactions: (Transaction & {
    reference_number?: string;
    check_number?: string;
    journal_entry_number?: string;
  })[];
}

export interface ColumnMapping {
  date_col?: string | null;
  account_col?: string | null;
  description_col?: string | null;
  amount_col?: string | null;
  debit_col?: string | null;
  credit_col?: string | null;
  property_col?: string | null;
  class_col?: string | null;
}

export interface PreviewData {
  filename: string;
  cache_id: string;
  total_rows_detected: number;
  available_columns: string[];
  suggested_mapping: ColumnMapping;
  preview_rows: Record<string, any>[];
}

export interface SampleStatementFile {
  filename: string;
  size_bytes: number;
  ext: string;
}


export interface JournalEntryLine {
  id?: number;
  journal_entry_id?: number;
  line_number?: number;
  category_id: number;
  account_number?: string;
  account_name?: string;
  account_display?: string;
  account_type?: string;
  debit: number;
  credit: number;
  memo?: string;
  class_id?: number | null;
  class_name?: string;
  property_id?: number | null;
  property_name?: string;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  date: string;
  month: string;
  memo: string;
  source: string;
  reference_id?: number | null;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  lines: JournalEntryLine[];
  created_at?: string;
}

export interface JournalEntryCreatePayload {
  date: string;
  entry_number?: string;
  memo?: string;
  lines: {
    category_id: number;
    debit: number;
    credit: number;
    memo?: string;
    class_id?: number | null;
    property_id?: number | null;
  }[];
}

export interface CheckSplit {
  id?: number;
  check_id?: number;
  line_number?: number;
  category_id: number;
  account_number?: string;
  account_name?: string;
  account_display?: string;
  account_type?: string;
  amount: number;
  memo?: string;
  class_id?: number | null;
  class_name?: string;
  property_id?: number | null;
  property_name?: string;
}

export interface CheckRecord {
  id: number;
  bank_account_id: number;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_account_display?: string;
  check_number: string;
  date: string;
  month: string;
  payee: string;
  amount: number;
  amount_in_words?: string;
  address?: string;
  memo?: string;
  is_printed: boolean;
  is_void: boolean;
  transaction_type?: 'CHECK' | 'ACH' | 'DEBIT' | 'DEPOSIT';
  source?: 'MANUAL' | 'BANK_IMPORT';
  journal_entry_id?: number | null;
  splits: CheckSplit[];
  created_at?: string;
}

export interface CheckCreatePayload {
  bank_account_id: number;
  check_number?: string;
  date: string;
  payee: string;
  amount: number;
  address?: string;
  memo?: string;
  splits?: {
    category_id: number;
    amount: number;
    memo?: string;
    class_id?: number | null;
    property_id?: number | null;
  }[];
}


export interface Vendor {
  id: number;
  account_number: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  is_1099_eligible: boolean;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  address?: string;
  default_category_id?: number | null;
  default_category_name?: string;
  default_category_display?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
}

export interface VendorCreatePayload {
  name: string;
  account_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  is_1099_eligible?: boolean;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  default_category_id?: number | null;
  notes?: string;
  is_active?: boolean;
}

export type WindowType = 
  | 'dashboard'
  | 'accounts'
  | 'journal'
  | 'checks'
  | 'vendors'
  | 'import'
  | 'transactions'
  | 'properties'
  | 'write_check'
  | 'make_journal'
  | 'category_drilldown';

export interface WorkspaceWindow {
  id: string;
  type: WindowType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  data?: any;
}

export interface SystemPrinter {
  name: string;
  is_default: boolean;
  supports_duplex: boolean;
  supports_color: boolean;
  capabilities: string[];
  port_name: string;
  status: string;
}

export type PrintOrientation = 'portrait' | 'landscape';
export type PrintDuplexMode = 'none' | 'long_edge' | 'short_edge';
export type PrintPageFit = 'fit_one_page_wide' | 'multi_page_readable';

export interface PrintReportConfig {
  printerName: string;
  orientation: PrintOrientation;
  duplex: PrintDuplexMode;
  pageFit: PrintPageFit;
  pagePerProperty: boolean;
  includeSummary: boolean;
  includeComparison: boolean;
}

// --- Bank Statement & Bank Rules Interfaces ---

export interface BankRule {
  id: number;
  company_id?: number | null;
  name: string;
  match_keyword: string;
  match_field?: string;
  target_category_id?: number | null;
  target_category_name?: string;
  target_category_display?: string;
  target_category_type?: string;
  target_vendor_id?: number | null;
  target_vendor_name?: string;
  target_property_id?: number | null;
  target_property_name?: string;
  target_class_id?: number | null;
  target_class_name?: string;
  is_check: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface BankRuleCreatePayload {
  name: string;
  match_keyword: string;
  match_field?: string;
  target_category_id?: number | null;
  target_vendor_id?: number | null;
  target_vendor_name?: string;
  target_property_id?: number | null;
  target_class_id?: number | null;
  is_check?: boolean;
  is_active?: boolean;
}

export interface BankRuleUpdatePayload {
  name?: string;
  match_keyword?: string;
  match_field?: string;
  target_category_id?: number | null;
  target_vendor_id?: number | null;
  target_vendor_name?: string;
  target_property_id?: number | null;
  target_class_id?: number | null;
  is_check?: boolean;
  is_active?: boolean;
}

export interface BankStatementRecord {
  id: number;
  bank_account_id: number;
  bank_account_name?: string;
  bank_account_display?: string;
  filename: string;
  file_type: string;
  upload_date?: string;
  statement_period?: string;
  row_count: number;
  checks_count: number;
  deposits_count: number;
  notes?: string;
}

export interface BankTransactionItem {
  date: string;
  check_number?: string | null;
  payee: string;
  raw_description?: string;
  amount: number;
  is_outflow: boolean;
  transaction_type?: 'CHECK' | 'ACH' | 'DEBIT' | 'DEPOSIT' | 'TRANSFER';
  category_id?: number | null;
  category_name?: string;
  category_display?: string;
  category_account_number?: string;
  vendor_id?: number | null;
  vendor_name?: string;
  property_id?: number | null;
  property_name?: string;
  class_id?: number | null;
  class_name?: string;
  memo?: string;
  match_status: 'RULE_MATCH' | 'AUTO_CLASSIFIED' | 'NEEDS_REVIEW';
  match_reason?: string;
  confidence?: number;
  save_rule?: boolean;
  rule_keyword?: string;
  suggest_create_account?: boolean;
}

export interface RawCsvPreviewResponse {
  filename: string;
  file_type: string;
  total_rows: number;
  raw_headers: string[];
  sample_values_by_column: Record<string, string[]>;
  suggested_mapping: {
    date_col?: string | null;
    check_col?: string | null;
    description_col?: string | null;
    amount_col?: string | null;
    debit_col?: string | null;
    credit_col?: string | null;
  };
  raw_rows: Record<string, string>[];
  parsed_preview_transactions?: BankTransactionItem[];
}

export interface BankStatementPreviewResponse {
  filename: string;
  file_type: 'CSV' | 'PDF' | 'XLSX';
  total_rows_detected: number;
  available_columns: string[];
  suggested_mapping: Record<string, string | null>;
  transactions: BankTransactionItem[];
  preview_rows: any[];
}

export interface BankStatementConfirmPayload {
  bank_account_id: number;
  filename: string;
  statement_period?: string;
  transactions: BankTransactionItem[];
}

export interface BankImportConfirmResult {
  status: string;
  statement_id: number;
  filename: string;
  checks_created: number;
  deposits_created: number;
  vendors_created: number;
  rules_saved: number;
  message: string;
}

export interface SampleBankStatementFile {
  filename: string;
  bank_name: string;
  format: 'CSV' | 'PDF';
  account_title: string;
  description: string;
  recommended_account_number: string;
}

