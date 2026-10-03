// Sunvine Renewable Energy — Master Document Requirements Configuration & Schema Engine
// Dynamic rules for Residential, Bank Loan, Finance / NBFC Loan, Commercial & Industrial, and Housing Society

export const APPLICATION_CATEGORIES = [
  { id: 'residential', key: 'RESIDENTIAL', label: 'Residential Rooftop (Cash / Self)', shortLabel: 'Residential Cash', icon: 'home', desc: 'Individual domestic connections under PM Surya Ghar Muft Bijli Yojana' },
  { id: 'bank_loan', key: 'BANK_LOAN', label: 'Nationalized Bank Solar Loan (SBI, BoB, etc.)', shortLabel: 'Bank Loan', icon: 'account_balance', desc: 'Bank loan with pre-inspection, property tax, and co-applicant docs' },
  { id: 'finance_loan', key: 'FINANCE_LOAN', label: 'Finance / NBFC Solar Loan (Ecofy, Credit Fair, etc.)', shortLabel: 'Finance Loan', icon: 'payments', desc: 'FinTech loan with separate applicant and co-applicant KYC vaults' },
  { id: 'commercial', key: 'COMMERCIAL', label: 'Commercial & Industrial (C&I)', shortLabel: 'Commercial & C&I', icon: 'corporate_fare', desc: 'Offices, factories, warehouses, and non-domestic grid connections' },
  { id: 'common_meter', key: 'COMMON_METER', label: 'Housing Society / Common Meter', shortLabel: 'Housing Society', icon: 'apartment', desc: 'Residential welfare associations (RWA), high-rises, and common utility meters' }
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
 * Master Registry of All Document Types across the Enterprise Portal
 */
export const DEFAULT_MASTER_DOCUMENT_REGISTRY = [
  { key: 'aadhaarCard', label: 'Aadhaar Card', category: 'Applicant KYC', description: 'Front & back copy of consumer UIDAI identity proof', icon: 'badge', alias: 'applicantAadhaar' },
  { key: 'bankDetails', label: 'Bank Details / Passbook', category: 'Bank & Financial', description: 'Bank passbook copy or cancelled cheque for subsidy / disbursement', icon: 'account_balance', alias: 'bankPassbook' },
  { key: 'lightBill', label: 'Light / Electricity Bill', category: 'Utility & Property', description: 'Latest DISCOM electricity power bill copy', icon: 'bolt', alias: 'electricityBill' },
  { key: 'panCard', label: 'PAN Card (Owner / Entity)', category: 'Applicant KYC', description: 'Income tax PAN card copy of primary applicant / entity owner', icon: 'credit_card', alias: 'pan' },
  { key: 'veraBill', label: 'Vera Bill (Property Tax)', category: 'Utility & Property', description: 'Municipal property tax paid receipt / Vera bill / Index-2 copy', icon: 'apartment', alias: 'propertyTax' },
  { key: 'sitePhotos', label: 'Pre-Installation Site Photo', category: 'Technical & Approvals', description: 'Terrace structure and shadow-free rooftop installation area', icon: 'photo_camera', alias: 'rooftopPhoto' },
  { key: 'coApplicantAadhaar', label: 'Co-Applicant Aadhaar Card', category: 'Co-Applicant KYC', description: 'Aadhaar card copy of loan co-applicant / spouse', icon: 'badge' },
  { key: 'coApplicantPan', label: 'Co-Applicant PAN Card', category: 'Co-Applicant KYC', description: 'PAN card copy of loan co-applicant / spouse / co-owner', icon: 'credit_card' },
  { key: 'coApplicantBank', label: 'Co-Applicant Bank Detail', category: 'Co-Applicant KYC', description: 'Co-borrower bank passbook or 6-month statement', icon: 'account_balance' },
  { key: 'passportPhoto', label: 'Passport Size Photo', category: 'Applicant KYC', description: 'Recent passport size photo of applicant / authorized signatory', icon: 'photo_camera' },
  { key: 'msmeCertificate', label: 'MSME / Udyam Registration', category: 'Commercial & Legal', description: 'Udyam registration certificate for MSME solar concession', icon: 'assignment' },
  { key: 'gstCertificate', label: 'GST Registration Certificate', category: 'Commercial & Legal', description: 'GST registration certificate (Form GST REG-06) for C&I projects', icon: 'receipt_long' },
  { key: 'undertaking', label: 'Customer Undertaking / Declaration', category: 'Commercial & Legal', description: 'Signed customer undertaking / declaration document', icon: 'contract' },
  { key: 'rentNoc', label: 'NOC Required (If on Rent)', category: 'Commercial & Legal', description: 'Landlord / Society No-Objection Certificate for rented premises', icon: 'domain' },
  { key: 'firmPanBank', label: 'Firm PAN Card / Bank Details', category: 'Commercial & Legal', description: 'Commercial firm PAN card and current account bank statement', icon: 'account_balance' },
  { key: 'ownershipDoc', label: 'Ownership Document (Registry / Index-2)', category: 'Utility & Property', description: 'Registered sale deed / property index-2 / title clearance', icon: 'apartment' },
  { key: 'partnershipDeed', label: 'Partnership Deed / MOA-AOA', category: 'Commercial & Legal', description: 'Partnership deed, LLP agreement, or Memorandum of Association', icon: 'description' },
  { key: 'factoryLayout', label: 'Factory Layout & Roof Structural Certificate', category: 'Technical & Approvals', description: 'Plant blueprint and structural engineer stability certificate', icon: 'factory' },
  { key: 'ceiApproval', label: 'CEI Electrical Safety Approval', category: 'Technical & Approvals', description: 'Chief Electrical Inspectorate clearance for >10kW solar system', icon: 'verified' },
  { key: 'societyNoc', label: 'Society NOC & Committee Resolution', category: 'Commercial & Legal', description: 'Housing Society / RWA No-Objection Certificate for common meter', icon: 'domain' }
];

/**
 * Default Category Document Rules Matrix:
 * 'mandatory' -> Required (Red/Amber pill)
 * 'optional'  -> Optional (Sky/Slate pill)
 * 'disabled'  -> Not applicable / Hidden for this category
 */
export const DEFAULT_CATEGORY_DOC_RULES = {
  RESIDENTIAL: {
    aadhaarCard: 'mandatory',
    bankDetails: 'mandatory',
    lightBill: 'mandatory',
    panCard: 'mandatory',
    veraBill: 'mandatory',
    sitePhotos: 'mandatory',
    passportPhoto: 'optional',
    coApplicantAadhaar: 'optional',
    coApplicantPan: 'optional',
    coApplicantBank: 'disabled',
    undertaking: 'optional',
    societyNoc: 'optional',
    rentNoc: 'optional',
    ownershipDoc: 'optional',
    msmeCertificate: 'disabled',
    gstCertificate: 'disabled',
    firmPanBank: 'disabled',
    partnershipDeed: 'disabled',
    factoryLayout: 'disabled',
    ceiApproval: 'disabled'
  },
  BANK_LOAN: {
    sitePhotos: 'mandatory',
    veraBill: 'mandatory',
    aadhaarCard: 'mandatory',
    panCard: 'mandatory',
    coApplicantAadhaar: 'mandatory',
    coApplicantPan: 'mandatory',
    bankDetails: 'mandatory',
    lightBill: 'mandatory',
    coApplicantBank: 'optional',
    passportPhoto: 'optional',
    undertaking: 'optional',
    societyNoc: 'optional',
    msmeCertificate: 'disabled',
    gstCertificate: 'disabled',
    rentNoc: 'disabled',
    firmPanBank: 'disabled',
    ownershipDoc: 'disabled',
    partnershipDeed: 'disabled',
    factoryLayout: 'disabled',
    ceiApproval: 'disabled'
  },
  NBFC_LOAN: {
    aadhaarCard: 'mandatory',
    panCard: 'mandatory',
    bankDetails: 'mandatory',
    coApplicantAadhaar: 'mandatory',
    coApplicantPan: 'mandatory',
    coApplicantBank: 'mandatory',
    lightBill: 'mandatory',
    sitePhotos: 'optional',
    veraBill: 'optional',
    passportPhoto: 'optional',
    undertaking: 'optional',
    societyNoc: 'optional',
    msmeCertificate: 'disabled',
    gstCertificate: 'disabled',
    rentNoc: 'disabled',
    firmPanBank: 'disabled',
    ownershipDoc: 'disabled',
    partnershipDeed: 'disabled',
    factoryLayout: 'disabled',
    ceiApproval: 'disabled'
  },
  COMMERCIAL: {
    aadhaarCard: 'mandatory',
    bankDetails: 'mandatory',
    lightBill: 'mandatory',
    panCard: 'mandatory',
    passportPhoto: 'mandatory',
    veraBill: 'mandatory',
    undertaking: 'mandatory',
    rentNoc: 'mandatory',
    msmeCertificate: 'optional',
    gstCertificate: 'optional',
    sitePhotos: 'optional',
    factoryLayout: 'mandatory',
    ceiApproval: 'optional',
    societyNoc: 'optional',
    coApplicantAadhaar: 'disabled',
    coApplicantPan: 'disabled',
    coApplicantBank: 'disabled',
    firmPanBank: 'disabled',
    ownershipDoc: 'disabled',
    partnershipDeed: 'disabled'
  },
  HOUSING_SOCIETY: {
    aadhaarCard: 'mandatory',
    bankDetails: 'mandatory',
    lightBill: 'mandatory',
    panCard: 'mandatory',
    firmPanBank: 'mandatory',
    passportPhoto: 'mandatory',
    veraBill: 'mandatory',
    msmeCertificate: 'mandatory',
    gstCertificate: 'mandatory',
    ownershipDoc: 'mandatory',
    partnershipDeed: 'mandatory',
    undertaking: 'mandatory',
    rentNoc: 'mandatory',
    societyNoc: 'mandatory',
    sitePhotos: 'optional',
    factoryLayout: 'disabled',
    ceiApproval: 'disabled',
    coApplicantAadhaar: 'disabled',
    coApplicantPan: 'disabled',
    coApplicantBank: 'disabled'
  }
};

/**
 * Master Document Schemas by Customer Application Mode
 */
export const DOCUMENT_SCHEMAS = {
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
  FINANCE_LOAN: {
    id: 'FINANCE_LOAN',
    label: 'Finance Loan (NBFC / FinTech Partner)',
    shortLabel: 'Finance Loan',
    badge: 'NBFC Loan',
    description: 'NBFC Solar loans (Credit Fair, Ecofy, Metafin, SolarSquare, etc.)',
    documents: [
      { key: 'aadhaar', label: 'Applicant Aadhaar Card', category: 'Applicant Documents', description: 'Primary borrower Aadhaar card copy', icon: 'badge', mandatory: true, alias: 'applicantAadhaar' },
      { key: 'panCard', label: 'Applicant PAN Card', category: 'Applicant Documents', description: 'Primary borrower PAN card copy', icon: 'credit_card', mandatory: true, alias: 'applicantPan' },
      { key: 'bankDetails', label: 'Applicant Bank Detail', category: 'Applicant Documents', description: 'Applicant bank statement or passbook', icon: 'account_balance', mandatory: true, alias: 'applicantBank' },
      { key: 'coApplicantAadhaar', label: 'Co-Applicant Aadhaar Card', category: 'Co-Applicant Documents', description: 'Co-borrower Aadhaar card copy', icon: 'badge', mandatory: true },
      { key: 'coApplicantPan', label: 'Co-Applicant PAN Card', category: 'Co-Applicant Documents', description: 'Co-borrower PAN card copy', icon: 'credit_card', mandatory: true },
      { key: 'coApplicantBank', label: 'Co-Applicant Bank Detail', category: 'Co-Applicant Documents', description: 'Co-borrower bank passbook or statement', icon: 'account_balance', mandatory: true },
      { key: 'lightBill', label: 'Light Bill', category: 'Premises Documents', description: 'Latest electricity connection bill', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' }
    ],
    metadataFields: [
      { key: 'phone', label: 'Applicant Mobile Number', required: true, icon: 'phone' },
      { key: 'email', label: 'Applicant Email ID', required: true, icon: 'mail' },
      { key: 'coApplicantPhone', label: 'Co-Applicant Mobile Number', required: false, icon: 'phone' }
    ]
  },
  COMMERCIAL: {
    id: 'COMMERCIAL',
    label: 'Commercial & Industrial (C&I)',
    shortLabel: 'Commercial & C&I',
    badge: 'C&I Project',
    description: 'Commercial solar installations for MSMEs, corporate offices, and factories',
    documents: [
      { key: 'gstCertificate', label: 'GST Certificate', category: 'Legal & Entity', description: 'Entity GST registration certificate', icon: 'receipt_long', mandatory: true },
      { key: 'lightBill', label: 'HT / LT Electricity Bill', category: 'Premises', description: 'Latest DISCOM industrial/commercial power bill', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' },
      { key: 'panCard', label: 'Company / Firm PAN', category: 'Legal & Entity', description: 'PAN card copy of company / director / proprietor', icon: 'credit_card', mandatory: true, alias: 'pan' },
      { key: 'sitePhoto', label: 'Rooftop Site Survey Photos', category: 'Site Inspection', description: 'Terrace structure and shadow-free industrial shed roof', icon: 'photo_camera', mandatory: true, alias: 'rooftopPhoto' },
      { key: 'factoryLayout', label: 'Factory / Plant Layout', category: 'Technical CAD', description: 'Architectural structural drawing and electrical layout', icon: 'architecture', mandatory: true },
      { key: 'bankDetails', label: 'Current Bank Account Details', category: 'Financials', description: 'Bank passbook or cancelled cheque for billing', icon: 'account_balance', mandatory: true, alias: 'bankPassbook' },
      { key: 'msmeCertificate', label: 'MSME / Udyam Certificate', category: 'Legal & Entity', description: 'Udyam registration certificate for priority tariff', icon: 'domain', mandatory: false },
      { key: 'ceiApproval', label: 'CEI Drawing / Safety Approval', category: 'Statutory Approvals', description: 'Chief Electrical Inspectorate safety approval', icon: 'verified', mandatory: false }
    ],
    metadataFields: [
      { key: 'phone', label: 'Authorized Person Mobile', required: true, icon: 'phone' },
      { key: 'email', label: 'Official Email ID', required: true, icon: 'mail' }
    ]
  },
  COMMON_METER: {
    id: 'COMMON_METER',
    label: 'Housing Society / Common Meter',
    shortLabel: 'Housing Society',
    badge: 'Society Solar',
    description: 'Rooftop solar for apartment common utilities (pumps, lifts, common lights)',
    documents: [
      { key: 'societyNoc', label: 'Society NOC / Resolution', category: 'Legal & Society', description: 'Managing committee resolution approving solar plant', icon: 'corporate_fare', mandatory: true },
      { key: 'lightBill', label: 'Common Meter Electricity Bill', category: 'Premises', description: 'Latest DISCOM common utility meter power bill', icon: 'electric_bolt', mandatory: true, alias: 'electricityBill' },
      { key: 'panCard', label: 'Society / RWA PAN Card', category: 'Legal & Society', description: 'PAN card copy of registered cooperative housing society', icon: 'credit_card', mandatory: true, alias: 'pan' },
      { key: 'sitePhoto', label: 'Common Terrace Site Photos', category: 'Site Inspection', description: 'Apartment building terrace inspection photographs', icon: 'photo_camera', mandatory: true, alias: 'rooftopPhoto' },
      { key: 'bankDetails', label: 'Society Bank Account Details', category: 'Financials', description: 'Society bank passbook or cancelled cheque', icon: 'account_balance', mandatory: true, alias: 'bankPassbook' },
      { key: 'veraBill', label: 'Society Property Tax Bill', category: 'Ownership Proof', description: 'Municipal property tax paid receipt for society premises', icon: 'home_work', mandatory: false, alias: 'propertyTax' }
    ],
    metadataFields: [
      { key: 'phone', label: 'Society Chairman/Secretary Mobile', required: true, icon: 'phone' }
    ]
  }
};

/**
 * Returns the document schema key based on customer file properties
 */
export function getDocumentSchemaKey(file) {
  if (!file) return 'RESIDENTIAL';

  const category = String(file.category || file.projectCategory || '').toUpperCase();
  if (category === 'COMMERCIAL' || category === 'C&I' || category === 'INDUSTRIAL') return 'COMMERCIAL';
  if (category === 'COMMON_METER' || category === 'HOUSING_SOCIETY' || category === 'SOCIETY') return 'COMMON_METER';

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

  if (category === 'RESIDENTIAL') return 'RESIDENTIAL';

  return 'RESIDENTIAL';
}

/**
 * Returns the active document checklist for a customer file, dynamically resolved
 * using admin registry and category rules matrix.
 */
export function getDocumentListForFile(file, dynamicRegistry = null, dynamicRules = null) {
  const schemaKey = getDocumentSchemaKey(file);
  const normalizedKey = schemaKey === 'FINANCE_LOAN' ? 'NBFC_LOAN' : (schemaKey === 'COMMON_METER' ? 'HOUSING_SOCIETY' : schemaKey);

  // If custom dynamic rules and registry are present, resolve dynamically
  if (Array.isArray(dynamicRegistry) && dynamicRegistry.length > 0 && dynamicRules) {
    const rulesForCat = dynamicRules[schemaKey] || dynamicRules[normalizedKey];
    if (rulesForCat && typeof rulesForCat === 'object') {
      const resolved = [];

      dynamicRegistry.forEach(doc => {
        const rule = rulesForCat[doc.key];
        if (rule && rule !== 'disabled') {
          resolved.push({
            ...doc,
            mandatory: rule === 'mandatory'
          });
        }
      });

      if (resolved.length > 0) {
        resolved.sort((a, b) => {
          if (a.mandatory && !b.mandatory) return -1;
          if (!a.mandatory && b.mandatory) return 1;
          return 0;
        });
        return resolved;
      }
    }
  }

  return DOCUMENT_SCHEMAS[schemaKey]?.documents || DOCUMENT_SCHEMAS.RESIDENTIAL.documents;
}

/**
 * Calculates document completion for a file based on its required documents
 */
export function getDocumentCompletion(file, dynamicRegistry = null, dynamicRules = null) {
  if (!file) return { total: 3, uploaded: 0, percent: 0, isComplete: false };
  const docList = getDocumentListForFile(file, dynamicRegistry, dynamicRules);
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
 * Legacy export for backward compatibility
 */
export const DEFAULT_REQUIRED_DOCUMENTS = DEFAULT_MASTER_DOCUMENT_REGISTRY.map(d => ({
  id: `doc-${d.key}`,
  key: d.key,
  label: d.label,
  description: d.description,
  icon: d.icon,
  mandatory: true
}));

export function isDocMandatoryForCategory(doc, categoryId, dynamicRules = null) {
  if (!doc) return false;
  if (dynamicRules && categoryId) {
    const catKey = categoryId.toUpperCase();
    const normalizedKey = catKey === 'FINANCE_LOAN' ? 'NBFC_LOAN' : (catKey === 'COMMON_METER' ? 'HOUSING_SOCIETY' : catKey);
    const rule = dynamicRules[catKey]?.[doc.key] || dynamicRules[normalizedKey]?.[doc.key];
    if (rule) return rule === 'mandatory';
  }
  return Boolean(doc.mandatory);
}
