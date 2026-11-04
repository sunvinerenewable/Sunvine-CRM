// Master Configuration for Sunvine Renewable Energy
// All modules, inverters, dealers, BOM, and pricing are strictly fetched in real-time from Supabase database.

import { APP_VERSION, CURRENT_RELEASE_CHANGELOG } from '../config/version.js';

export const SUNVINE_OFFICIAL_PROFILE = {
  companyName: 'Sunvine Renewable Energy',
  gstin: '24AAAAA0000A1Z5',
  address: 'Gujarat, India',
  tagline: 'Empowering Solar Energy Solutions',
  state: 'Gujarat',
  notes: [
    'ALL PRICES ARE INCLUDING GST',
    'TRANSPORTATION AND INSTALLATION - DEALER SCOPE',
    'LIST OF COMPULSORY REQUIRED DOCUMENTS: LIGHT BILL, BANK DETAIL, AADHAR CARD, MOBILE NO.'
  ],
  bankDetails: {
    firmName: 'Sunvine Renewable Energy',
    bankName: 'Nationalized Bank',
    accountNumber: '000000000000',
    ifscCode: 'BANK0000000',
    branch: 'Main Branch',
    email: 'contact@sunvinerenewable.com'
  },
  terms: {
    modulePerformanceWarrantyYears: 30,
    moduleDefectWarrantyYears: 12,
    inverterWarrantyYears: 8,
    workmanshipWarrantyYears: 5,
    paymentTerms: '10% advance with purchase order, 90% before material dispatch.',
    deliveryDays: 15,
    validityDays: 15,
    supportPhone: '+91 80000 50580',
    helpline: '8000050580',
    website: 'https://sunvinerenewable.com'
  }
};

/**
 * Resolves active company profile merging dynamic system_settings with default structure.
 */
export function resolveCompanyProfile(settingsProfile = {}) {
  if (!settingsProfile || Object.keys(settingsProfile).length === 0) {
    return SUNVINE_OFFICIAL_PROFILE;
  }
  return {
    ...SUNVINE_OFFICIAL_PROFILE,
    companyName: settingsProfile.name || settingsProfile.companyName || settingsProfile.company_name || SUNVINE_OFFICIAL_PROFILE.companyName,
    gstin: settingsProfile.gstin || settingsProfile.company_gstin || settingsProfile.companyGstin || SUNVINE_OFFICIAL_PROFILE.gstin,
    address: settingsProfile.address || SUNVINE_OFFICIAL_PROFILE.address,
    state: settingsProfile.state || SUNVINE_OFFICIAL_PROFILE.state,
    bankDetails: {
      ...SUNVINE_OFFICIAL_PROFILE.bankDetails,
      ...(settingsProfile.bank || settingsProfile.bankDetails || settingsProfile.bank_details || {})
    },
    terms: {
      ...SUNVINE_OFFICIAL_PROFILE.terms,
      supportPhone: settingsProfile.whatsapp || SUNVINE_OFFICIAL_PROFILE.terms.supportPhone,
      helpline: settingsProfile.helpdesk || SUNVINE_OFFICIAL_PROFILE.terms.helpline,
      website: settingsProfile.website || SUNVINE_OFFICIAL_PROFILE.terms.website,
      validityText: settingsProfile.validityText
    }
  };
}

/**
 * Normalizes company profile across snake_case and camelCase formats.
 * Preserves legitimate GSTIN and Bank account details from the authoritative
 * saved company profile without silently fabricating placeholder details.
 */
export function normalizeCompanyProfile(profile = null, fallback = null) {
  if (!profile && !fallback) return null;
  const p = profile || {};
  const f = fallback || {};

  const pickFirstValid = (...candidates) => {
    for (const c of candidates) {
      if (c !== undefined && c !== null) {
        const str = String(c).trim();
        if (str.length > 0) return str;
      }
    }
    return '';
  };

  const gstin = pickFirstValid(
    p.gstin,
    p.GSTIN,
    p.company_gstin,
    p.companyGstin,
    p.gst_number,
    p.gstNumber,
    p.gst,
    f.gstin,
    f.GSTIN,
    f.company_gstin,
    f.companyGstin,
    f.gst_number,
    f.gstNumber,
    f.gst
  ).toUpperCase();

  const rawBank = p.bank || p.bankDetails || p.bank_details || {};
  const fbBank = f.bank || f.bankDetails || f.bank_details || {};

  const accountNumber = pickFirstValid(
    rawBank.accountNumber,
    rawBank.account_number,
    rawBank.bank_account_no,
    rawBank.bankAccountNo,
    rawBank.accNo,
    p.accountNumber,
    p.account_number,
    p.bank_account_no,
    fbBank.accountNumber,
    fbBank.account_number,
    fbBank.bank_account_no,
    fbBank.bankAccountNo,
    fbBank.accNo,
    f.accountNumber,
    f.account_number,
    f.bank_account_no
  );

  const ifsc = pickFirstValid(
    rawBank.ifsc,
    rawBank.ifscCode,
    rawBank.ifsc_code,
    rawBank.bank_ifsc,
    p.ifsc,
    p.ifsc_code,
    fbBank.ifsc,
    fbBank.ifscCode,
    fbBank.ifsc_code,
    fbBank.bank_ifsc,
    f.ifsc,
    f.ifsc_code
  ).toUpperCase();

  const bankName = pickFirstValid(
    rawBank.bankName,
    rawBank.bank_name,
    p.bankName,
    p.bank_name,
    fbBank.bankName,
    fbBank.bank_name,
    f.bankName,
    f.bank_name
  );

  const branch = pickFirstValid(
    rawBank.branch,
    rawBank.branch_name,
    rawBank.branchName,
    rawBank.bank_branch,
    p.branch,
    fbBank.branch,
    fbBank.branch_name,
    fbBank.branchName,
    fbBank.bank_branch,
    f.branch
  );

  const accountHolder = pickFirstValid(
    rawBank.accountHolder,
    rawBank.account_holder,
    rawBank.bank_account_holder,
    rawBank.firmName,
    rawBank.firm_name,
    p.accountHolder,
    fbBank.accountHolder,
    fbBank.account_holder,
    fbBank.bank_account_holder,
    fbBank.firmName,
    fbBank.firm_name,
    f.accountHolder
  );

  const name = pickFirstValid(
    p.name,
    p.companyName,
    p.company_name,
    p.firmName,
    p.firm_name,
    f.name,
    f.companyName,
    f.company_name,
    f.firmName,
    f.firm_name
  );

  const address = pickFirstValid(p.address, f.address);
  const state = pickFirstValid(p.state, f.state) || 'Gujarat';
  const email = pickFirstValid(p.email, rawBank.email, fbBank.email, f.email);
  const website = pickFirstValid(p.website, f.website);
  const whatsapp = pickFirstValid(p.whatsapp, f.whatsapp);
  const helpdesk = pickFirstValid(p.helpdesk, f.helpdesk);
  const terms = pickFirstValid(p.terms, f.terms);
  const validityText = pickFirstValid(p.validityText, f.validityText);
  const whatsappTemplate = pickFirstValid(p.whatsappTemplate, p.whatsapp_template, f.whatsappTemplate, f.whatsapp_template);
  const pan = pickFirstValid(p.pan, p.panNumber, p.pan_number, f.pan, f.panNumber, f.pan_number);

  const bank = {
    bankName,
    bank_name: bankName,
    accountNumber,
    account_number: accountNumber,
    ifsc,
    ifscCode: ifsc,
    ifsc_code: ifsc,
    branch,
    branch_name: branch,
    branchName: branch,
    accountHolder,
    account_holder: accountHolder,
    email
  };

  return {
    name,
    companyName: name,
    company_name: name,
    gstin,
    company_gstin: gstin,
    pan,
    pan_number: pan,
    address,
    state,
    email,
    website,
    whatsapp,
    helpdesk,
    terms,
    validityText,
    whatsappTemplate,
    whatsapp_template: whatsappTemplate,
    bank,
    bankDetails: bank,
    bank_details: bank
  };
}

// Official Sunvine National Portal Rooftop Price List (Dated 27-08-2026 / 05-08-2026)
export const PDF_BOS_PRICE_MATRIX = [
  { capacityKW: 2.2, noOfModules: 4, inverterCapacityKW: '2.2KW', adaniBiFiPrice: 89540, apsBiFiPrice: 81400, rayzonePrice: 81400, waaree540Price: 110296, topcon585CapacityKW: 2.34, waaree585Price: 97227, topcon600CapacityKW: 2.40, apsTopcon600Price: 92640 },
  { capacityKW: 2.75, noOfModules: 5, inverterCapacityKW: '3KW', adaniBiFiPrice: 106150, apsBiFiPrice: 95860, rayzonePrice: 95860, waaree540Price: 128960, topcon585CapacityKW: 2.925, waaree585Price: 115245, topcon600CapacityKW: 3.00, apsTopcon600Price: 109800 },
  { capacityKW: 3.3, noOfModules: 6, inverterCapacityKW: '3.6KW', adaniBiFiPrice: 122100, apsBiFiPrice: 110174, rayzonePrice: 110174, waaree540Price: 149244, topcon585CapacityKW: 3.51, waaree585Price: 133738, topcon600CapacityKW: 3.60, apsTopcon600Price: 126414 },
  { capacityKW: 3.85, noOfModules: 7, inverterCapacityKW: '3.6KW', adaniBiFiPrice: 140140, apsBiFiPrice: 125510, rayzonePrice: 125510, waaree540Price: 173400, topcon585CapacityKW: 4.095, waaree585Price: 159705, topcon600CapacityKW: 4.20, apsTopcon600Price: 151200 },
  { capacityKW: 4.4, noOfModules: 8, inverterCapacityKW: '4/4.2KW', adaniBiFiPrice: 160160, apsBiFiPrice: 147101, rayzonePrice: 147100, waaree540Price: 194240, topcon585CapacityKW: 4.68, waaree585Price: 180096, topcon600CapacityKW: 4.80, apsTopcon600Price: 171840 },
  { capacityKW: 4.95, noOfModules: 9, inverterCapacityKW: '5/5.2KW', adaniBiFiPrice: 182655, apsBiFiPrice: 169785, rayzonePrice: 169785, waaree540Price: 222408, topcon585CapacityKW: 5.265, waaree585Price: 202608, topcon600CapacityKW: 5.40, apsTopcon600Price: 194400 },
  { capacityKW: 5.5, noOfModules: 10, inverterCapacityKW: '6KW', adaniBiFiPrice: 202950, apsBiFiPrice: 183150, rayzonePrice: 183150, waaree540Price: 244960, topcon585CapacityKW: 5.85, waaree585Price: 225120, topcon600CapacityKW: 6.00, apsTopcon600Price: 216000 },
  { capacityKW: 6.05, noOfModules: 11, inverterCapacityKW: '6KW', adaniBiFiPrice: 225060, apsBiFiPrice: 199650, rayzonePrice: 199650, waaree540Price: 267080, topcon585CapacityKW: 6.435, waaree585Price: 268983, topcon600CapacityKW: 6.60, apsTopcon600Price: 275880 },
  { capacityKW: 6.6, noOfModules: 12, inverterCapacityKW: '6KW', adaniBiFiPrice: 298800, apsBiFiPrice: 277200, rayzonePrice: 277200, waaree540Price: 291360, topcon585CapacityKW: 7.02, waaree585Price: 322920, topcon600CapacityKW: 7.20, apsTopcon600Price: 316800 },
  { capacityKW: 7.7, noOfModules: 14, inverterCapacityKW: '8KW', adaniBiFiPrice: 348600, apsBiFiPrice: 323400, rayzonePrice: 323400, waaree540Price: 339920, topcon585CapacityKW: 8.19, waaree585Price: 376740, topcon600CapacityKW: 8.40, apsTopcon600Price: 369600 },
  { capacityKW: 8.25, noOfModules: 15, inverterCapacityKW: '8KW', adaniBiFiPrice: 373500, apsBiFiPrice: 346500, rayzonePrice: 346500, waaree540Price: 364200, topcon585CapacityKW: 8.775, waaree585Price: 403650, topcon600CapacityKW: 9.00, apsTopcon600Price: 396000 },
  { capacityKW: 8.8, noOfModules: 16, inverterCapacityKW: '8KW', adaniBiFiPrice: 398400, apsBiFiPrice: 369600, rayzonePrice: 369600, waaree540Price: 388480, topcon585CapacityKW: 9.36, waaree585Price: 430560, topcon600CapacityKW: 9.60, apsTopcon600Price: 422400 },
  { capacityKW: 9.35, noOfModules: 17, inverterCapacityKW: '10KW', adaniBiFiPrice: 423300, apsBiFiPrice: 392700, rayzonePrice: 392700, waaree540Price: 412760, topcon585CapacityKW: 9.945, waaree585Price: 457470, topcon600CapacityKW: 10.20, apsTopcon600Price: 448800 },
  { capacityKW: 9.9, noOfModules: 18, inverterCapacityKW: '10KW', adaniBiFiPrice: 448200, apsBiFiPrice: 415800, rayzonePrice: 415800, waaree540Price: 437040, topcon585CapacityKW: 10.53, waaree585Price: 484380, topcon600CapacityKW: 10.80, apsTopcon600Price: 475200 },
  { capacityKW: 10.45, noOfModules: 19, inverterCapacityKW: '10KW', adaniBiFiPrice: 473100, apsBiFiPrice: 438900, rayzonePrice: 438900, waaree540Price: 461320, topcon585CapacityKW: 11.115, waaree585Price: 511290, topcon600CapacityKW: 11.40, apsTopcon600Price: 501600 }
];
export const PDF_BOM_SPECIFICATIONS = [];
export const GUJARAT_MODULES = [];
export const GUJARAT_INVERTERS = [];
export const INITIAL_DEALERS = [];
export const INITIAL_QUOTATIONS = [];
export const DEFAULT_MODULES = [];
export const DEFAULT_INVERTERS = [];
export const DEFAULT_NOTIFICATIONS = [];

export const DEFAULT_PRICING_MASTER = {
  // Benchmark Quotation Presets for Admin & Dealer synchronization
  quotationPresets: {
    baseRatePerKw: 59800,
    subsidyCap: 78000,
    minMarginPerKw: 2000,
    lastSynced: 'Realtime Live Sync',
    updatedBy: 'Operations Team'
  },

  // Default Commission Margins & Protective Caps by Dealer Tier
  tierMargins: {
    diamond: {
      tierName: 'Diamond EPC',
      defaultMarginPerKw: 6500,
      maxMarginCapPerKw: 8000,
      description: 'Premier High-Volume Partners (> 5,000 kW/quarter)'
    },
    platinum: {
      tierName: 'Platinum Tier',
      defaultMarginPerKw: 5500,
      maxMarginCapPerKw: 7000,
      description: 'Tier-1 Large Scale EPC (> 3,000 kW/quarter)'
    },
    gold: {
      tierName: 'Gold EPC',
      defaultMarginPerKw: 2000,
      maxMarginCapPerKw: 6000,
      description: 'Established Standard Installers (1,500 - 3,000 kW/quarter)'
    },
    silver: {
      tierName: 'Silver Installer',
      defaultMarginPerKw: 3500,
      maxMarginCapPerKw: 5000,
      description: 'Entry / Regional Empanelled Installers (< 1,500 kW/quarter)'
    }
  },

  // Base EPC turnkey rates per kW
  baseRates: {
    residential_1_to_3: 62000,   // ₹62,000 / kW
    residential_3_to_10: 58000,  // ₹58,000 / kW
    commercial_industrial: 24000 // ₹24,000 / kW (C&I > 10 kW)
  },

  // Central PM Surya Ghar Muft Bijli Yojana DBT Subsidy Slabs
  subsidySlabs: [
    { capacityKW: 1, amount: 30000, label: '1.0 kW' },
    { capacityKW: 2, amount: 60000, label: '2.0 kW' },
    { capacityKW: 3, amount: 78000, label: '3.0 kW & Above' }
  ],

  // Statutory Fees & Taxes
  taxes: {
    gstPercent: 18, // Standard statutory GST (18% for Solar EPC works contract)
    gedaRegistrationCharge: 'Including',
    discomMeterCharge: 'Extra as actual',
    testingCharge: 'Customer Scope'
  },

  // Official Sunvine Bank Details
  bankDetails: SUNVINE_OFFICIAL_PROFILE.bankDetails,

  // Terms & Warranties
  termsAndWarranties: {
    modulePerformanceWarrantyYears: 30,
    moduleDefectWarrantyYears: 12,
    inverterWarrantyYears: 8,
    workmanshipWarrantyYears: 5,
    paymentTerms: '10% advance with purchase order, 90% before material dispatch.',
    deliveryDays: 15,
    validityDays: 15,
    officeAddress: SUNVINE_OFFICIAL_PROFILE.address,
    supportPhone: SUNVINE_OFFICIAL_PROFILE.terms.supportPhone,
    helpline: SUNVINE_OFFICIAL_PROFILE.terms.helpline,
    website: SUNVINE_OFFICIAL_PROFILE.terms.website,
    gstin: SUNVINE_OFFICIAL_PROFILE.gstin
  },

  bosPriceMatrix: [],
  bomSpecifications: []
};
