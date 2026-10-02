// Sunvine Renewable Energy — Master Document Requirements Configuration
// Categorized by customer application type (Residential, Bank Loan, Finance / NBFC Loan)

export const APPLICATION_CATEGORIES = [
  { id: 'residential', label: 'Residential Rooftop (Cash / Self)', icon: 'home', desc: 'Individual domestic connections under PM Surya Ghar Muft Bijli Yojana' },
  { id: 'bank_loan', label: 'Nationalized Bank Solar Loan (SBI, BoB, etc.)', icon: 'account_balance', desc: 'Bank loan with pre-inspection, property tax, and co-applicant docs' },
  { id: 'finance_loan', label: 'Finance / NBFC Solar Loan (Ecofy, Credit Fair, etc.)', icon: 'payments', desc: 'FinTech loan with separate applicant and co-applicant KYC vaults' },
  { id: 'commercial', label: 'Commercial & Industrial (C&I)', icon: 'corporate_fare', desc: 'Offices, factories, warehouses, and non-domestic grid connections' },
  { id: 'common_meter', label: 'Housing Society / Common Meter', icon: 'apartment', desc: 'Residential welfare associations (RWA), high-rises, and common utility meters' }
];

export const DEFAULT_PIPELINE_STAGES = [
  { id: 'LEAD_SOURCED', label: '1. Lead Sourced & Feasibility Check', description: 'Customer inquiry recorded, initial solar feasibility verified', mandatory: true },
  { id: 'SITE_SURVEY', label: '2. Site Feasibility & Roof CAD Survey', description: 'Rooftop measurements, tilt angle, and shadow profiling', mandatory: true },
  { id: 'QUOTATION_ACCEPTED', label: '3. Quotation Accepted & Advance Token', description: 'Customer confirms proposal and pays booking advance', mandatory: true },
  { id: 'DISCOM_APPLICATION', label: '4. DISCOM Net-Meter Application Filed', description: 'Formal submission to PGVCL/UGVCL/DGVCL/MGVCL web portal', mandatory: true },
  { id: 'FEASIBILITY_APPROVAL', label: '5. Technical Feasibility & Sanction Approved', description: 'DISCOM site inspection clearance and technical sanction letter', mandatory: true },
  { id: 'PLANT_INSTALLATION', label: '6. Solar Hardware Installation (Modules & Inverter)', description: 'Module mounting structure, solar PV panels, and inverter commissioning', mandatory: true },
  { id: 'CEI_INSPECTION', label: '7. Safety CEI Drawing Inspection', description: 'Chief Electrical Inspectorate safety approval for systems > 10 kW', mandatory: false },
  { id: 'NET_METER_SYNC', label: '8. Bidirectional Net-Meter Grid Energization', description: 'Installation of bi-directional meter and synchronisation with power grid', mandatory: true },
  { id: 'SUBSIDY_CLAIM', label: '9. PM Surya Ghar DBT Claim Verification', description: 'Uploading commissioning certificate on National Portal for central subsidy', mandatory: true },
  { id: 'HANDOVER_COMPLETED', label: '10. Commissioned & Handed Over with Warranty Pack', description: 'Plant handover to customer with manufacturer warranty documentation', mandatory: true }
];

/**
 * Master Document Schemas by Customer Application Mode
 */
export const DOCUMENT_SCHEMAS = {
  // 1. RESIDENTIAL DOCUMENT LIST
  RESIDENTIAL: {
    id: 'RESIDENTIAL',
    label: 'Residential (100% Cash / Self Payment)',
    shortLabel: 'Residential Cash',
    badge: 'Cash / Self',
    description: 'Standard domestic solar rooftop application for direct subsidy',
    documents: [
      { key: 'aadhaar', label: 'Aadhaar Card', category: 'Applicant KYC', description: 'Front & back copy of consumer UIDAI identity proof', icon: 'badge', mandatory: true, alias: 'applicantAadhaar' },
      { key: 'bankDetails', label: 'Bank Details', category: 'Subsidy DBT', description: 'Bank passbook copy or cancelled cheque for central subsidy transfer', icon: 'account_balance', mandatory: true, alias: 'bankPassbook' },
      { key: 'lightBill', label: 'Light Bill', category: 'Premises', description: 'Latest DISCOM electricity power bill copy', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' },
      { key: 'panCard', label: 'PAN Card', category: 'Applicant KYC', description: 'Income tax PAN card copy of primary applicant', icon: 'credit_card', mandatory: false, alias: 'pan' },
      { key: 'veraBill', label: 'Vera Bill (Property Tax)', category: 'Ownership Proof', description: 'Municipal property tax paid receipt / Vera bill / Index-2 copy', icon: 'home_work', mandatory: false, alias: 'propertyTax' },
      { key: 'sitePhoto', label: 'Pre-Installation Site Photo', category: 'Site Inspection', description: 'Terrace structure and shadow-free rooftop installation area', icon: 'photo_camera', mandatory: false, alias: 'rooftopPhoto' },
      { key: 'coApplicantPan', label: 'Co-Applicant PAN Card', category: 'Co-Applicant KYC', description: 'PAN card copy of loan co-applicant / spouse / co-owner', icon: 'credit_card', mandatory: false }
    ],
    metadataFields: [
      { key: 'phone', label: 'Mobile Number', required: true, icon: 'phone' }
    ]
  },

  // 2. BANK LOAN DOC LIST
  BANK_LOAN: {
    id: 'BANK_LOAN',
    label: 'Bank Loan (Nationalized / Commercial Banks)',
    shortLabel: 'Bank Loan',
    badge: 'Bank Loan',
    description: 'Nationalized bank solar loan (SBI, BoB, PNB, Canara, HDFC, ICICI, etc.)',
    documents: [
      { key: 'sitePhoto', label: 'Pre-Installation Site Photo', category: 'Site Inspection', description: 'Clear rooftop shadow-free space and structure elevation photograph', icon: 'photo_camera', mandatory: true, alias: 'rooftopPhoto' },
      { key: 'veraBill', label: 'Vera Bill (House / Property Tax)', category: 'Ownership Proof', description: 'Municipal property tax paid receipt / Vera bill / Index-2 copy', icon: 'home_work', mandatory: true, alias: 'propertyTax' },
      { key: 'aadhaar', label: 'Applicant Aadhaar Card', category: 'Applicant KYC', description: 'UIDAI Aadhaar front and back copy of primary applicant', icon: 'badge', mandatory: true, alias: 'applicantAadhaar' },
      { key: 'panCard', label: 'Applicant PAN Card', category: 'Applicant KYC', description: 'Income tax PAN card copy of primary applicant', icon: 'credit_card', mandatory: true, alias: 'pan' },
      { key: 'coApplicantPan', label: 'Co-Applicant PAN Card', category: 'Co-Applicant KYC', description: 'PAN card copy of loan co-applicant / spouse / co-owner', icon: 'credit_card', mandatory: true },
      { key: 'coApplicantAadhaar', label: 'Co-Applicant Aadhaar Card', category: 'Co-Applicant KYC', description: 'Aadhaar card copy of loan co-applicant / spouse', icon: 'badge', mandatory: false },
      { key: 'bankDetails', label: 'Bank Details / Statement', category: 'Applicant Financials', description: 'Bank passbook or 6-month statement for loan disbursement', icon: 'account_balance', mandatory: true, alias: 'bankPassbook' },
      { key: 'lightBill', label: 'Light Bill', category: 'Premises', description: 'Latest DISCOM electricity bill matching premises address', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' }
    ],
    metadataFields: [
      { key: 'phone', label: 'Mobile Number', required: true, icon: 'phone' },
      { key: 'email', label: 'Email ID', required: true, icon: 'mail' }
    ]
  },

  // 3. FINANCE LOAN DOC LIST
  FINANCE_LOAN: {
    id: 'FINANCE_LOAN',
    label: 'Finance Loan (NBFC / FinTech Partner)',
    shortLabel: 'Finance Loan',
    badge: 'NBFC Loan',
    description: 'NBFC Solar loans (Credit Fair, Ecofy, Metafin, SolarSquare, etc.)',
    documents: [
      // APPLICANT DOCS
      { key: 'applicantAadhaar', label: 'Applicant Aadhaar Card', category: 'Applicant Documents', description: 'Primary borrower Aadhaar card copy', icon: 'badge', mandatory: true, alias: 'aadhaar' },
      { key: 'applicantPan', label: 'Applicant PAN Card', category: 'Applicant Documents', description: 'Primary borrower PAN card copy', icon: 'credit_card', mandatory: true, alias: 'panCard' },
      { key: 'applicantBank', label: 'Applicant Bank Detail', category: 'Applicant Documents', description: 'Applicant bank statement or passbook', icon: 'account_balance', mandatory: true, alias: 'bankDetails' },
      
      // CO-APPLICANT DOCS
      { key: 'coApplicantAadhaar', label: 'Co-Applicant Aadhaar Card', category: 'Co-Applicant Documents', description: 'Co-borrower Aadhaar card copy', icon: 'badge', mandatory: true },
      { key: 'coApplicantPan', label: 'Co-Applicant PAN Card', category: 'Co-Applicant Documents', description: 'Co-borrower PAN card copy', icon: 'credit_card', mandatory: true },
      { key: 'coApplicantBank', label: 'Co-Applicant Bank Detail', category: 'Co-Applicant Documents', description: 'Co-borrower bank passbook or statement', icon: 'account_balance', mandatory: true },
      
      // PREMISES DOC
      { key: 'lightBill', label: 'Light Bill', category: 'Premises Documents', description: 'Latest electricity connection bill', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' }
    ],
    metadataFields: [
      { key: 'phone', label: 'Applicant Mobile Number', required: true, icon: 'phone' },
      { key: 'email', label: 'Applicant Email ID', required: true, icon: 'mail' },
      { key: 'coApplicantPhone', label: 'Co-Applicant Mobile Number', required: false, icon: 'phone' }
    ]
  }
};

/**
 * Returns the document schema key based on customer file properties
 */
export function getDocumentSchemaKey(file) {
  if (!file) return 'RESIDENTIAL';

  const financeType = String(file.financeType || file.finance_type || '').toUpperCase();
  const loanBank = String(file.loanBank || file.loan_bank || '').toUpperCase();
  const loanType = String(file.loanType || file.loan_type || '').toUpperCase();

  // Explicit NBFC / Finance Loan check
  if (
    financeType === 'FINANCE_LOAN' ||
    financeType === 'NBFC' ||
    loanType === 'FINANCE_LOAN' ||
    loanType === 'NBFC' ||
    loanBank.includes('ECOFY') ||
    loanBank.includes('CREDIT FAIR') ||
    loanBank.includes('METAFIN') ||
    loanBank.includes('FINANCE')
  ) {
    return 'FINANCE_LOAN';
  }

  // Bank Loan check
  if (
    financeType === 'LOAN' ||
    financeType === 'BANK_LOAN' ||
    loanType === 'BANK_LOAN' ||
    Boolean(file.loanBank)
  ) {
    return 'BANK_LOAN';
  }

  return 'RESIDENTIAL';
}

/**
 * Returns the active document checklist for a customer file
 */
export function getDocumentListForFile(file) {
  const schemaKey = getDocumentSchemaKey(file);
  return DOCUMENT_SCHEMAS[schemaKey]?.documents || DOCUMENT_SCHEMAS.RESIDENTIAL.documents;
}

/**
 * Calculates document completion for a file based on its required documents
 */
export function getDocumentCompletion(file) {
  if (!file) return { total: 3, uploaded: 0, percent: 0, isComplete: false };
  const docList = getDocumentListForFile(file);
  const docs = file.documents || {};

  let uploadedCount = 0;
  docList.forEach(item => {
    const doc = docs[item.key] || (item.alias ? docs[item.alias] : null);
    if (doc?.uploaded) {
      uploadedCount++;
    }
  });

  return {
    total: docList.length,
    uploaded: uploadedCount,
    percent: docList.length > 0 ? Math.round((uploadedCount / docList.length) * 100) : 0,
    isComplete: uploadedCount === docList.length && docList.length > 0
  };
}

/**
 * Legacy export for backward compatibility with settings and governance modals
 */
export const DEFAULT_REQUIRED_DOCUMENTS = [
  {
    id: 'doc-light-bill',
    key: 'lightBill',
    label: 'Electricity / Light Bill',
    description: 'Latest DISCOM electricity bill copy (within past 2 months)',
    icon: 'electric_bolt',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: { residential: true, commercial: true, common_meter: true },
    mandatoryCategories: ['residential', 'commercial', 'common_meter'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-aadhaar',
    key: 'aadhaar',
    label: 'Customer Aadhaar Card (KYC)',
    description: 'Front & back copy of consumer UIDAI identity proof',
    icon: 'badge',
    categories: ['residential', 'common_meter'],
    categoryMandatory: { residential: true, common_meter: true, commercial: false },
    mandatoryCategories: ['residential', 'common_meter'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  },
  {
    id: 'doc-bank-passbook',
    key: 'bankDetails',
    label: 'Bank Passbook / Cheque',
    description: 'Bank details for PM Surya Ghar direct DBT subsidy transfer',
    icon: 'account_balance',
    categories: ['residential', 'commercial'],
    categoryMandatory: { residential: true, commercial: false },
    mandatoryCategories: ['residential'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-pan',
    key: 'panCard',
    label: 'PAN Card Copy',
    description: 'Required for bank loan verification and direct DBT transfer',
    icon: 'credit_card',
    categories: ['residential', 'commercial'],
    categoryMandatory: { residential: false, commercial: true },
    mandatoryCategories: ['commercial'],
    mandatory: false,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  },
  {
    id: 'doc-property-tax',
    key: 'veraBill',
    label: 'Vera Bill (Property Tax / Index-2)',
    description: 'Proof of premises ownership / municipal house tax paid receipt',
    icon: 'home_work',
    categories: ['residential', 'commercial'],
    categoryMandatory: { residential: false, commercial: false },
    mandatoryCategories: [],
    mandatory: false,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-rooftop-survey',
    key: 'sitePhoto',
    label: 'Pre-Installation Rooftop Site Photo',
    description: 'Clear photograph of terrace shadow area and mounting location',
    icon: 'photo_camera',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: { residential: false, commercial: true, common_meter: false },
    mandatoryCategories: ['commercial'],
    mandatory: false,
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  }
];

export function isDocMandatoryForCategory(doc, categoryId) {
  if (!doc) return false;
  if (!categoryId) return Boolean(doc.mandatory);
  if (doc.categoryMandatory && typeof doc.categoryMandatory[categoryId] === 'boolean') {
    return doc.categoryMandatory[categoryId];
  }
  if (Array.isArray(doc.mandatoryCategories)) {
    return doc.mandatoryCategories.includes(categoryId);
  }
  return Boolean(doc.mandatory && (doc.categories || []).includes(categoryId));
}
