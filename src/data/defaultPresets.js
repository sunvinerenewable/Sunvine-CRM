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
    companyName: settingsProfile.name || SUNVINE_OFFICIAL_PROFILE.companyName,
    gstin: settingsProfile.gstin || SUNVINE_OFFICIAL_PROFILE.gstin,
    address: settingsProfile.address || SUNVINE_OFFICIAL_PROFILE.address,
    state: settingsProfile.state || SUNVINE_OFFICIAL_PROFILE.state,
    bankDetails: {
      ...SUNVINE_OFFICIAL_PROFILE.bankDetails,
      ...(settingsProfile.bank || {})
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

// 100% Dynamic - Empty default presets (Fetched real-time from Supabase)
export const PDF_BOS_PRICE_MATRIX = [];
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
    minMarginPerKw: 4000,
    lastSynced: 'Realtime Live Sync',
    updatedBy: 'Operations Team'
  },

  // Default Commission Margins & Protective Caps by Dealer Tier
  tierMargins: {
    diamond: {
      tierName: 'Diamond EPC',
      defaultMarginPerKw: 6500,
      maxMarginCapPerKw: 8000,
      description: 'Premier High-Volume Partners (> 5.0 MW/quarter)'
    },
    platinum: {
      tierName: 'Platinum Tier',
      defaultMarginPerKw: 5500,
      maxMarginCapPerKw: 7000,
      description: 'Tier-1 Large Scale EPC (> 3.0 MW/quarter)'
    },
    gold: {
      tierName: 'Gold EPC',
      defaultMarginPerKw: 4500,
      maxMarginCapPerKw: 6000,
      description: 'Established Standard Installers (1.5 - 3.0 MW/quarter)'
    },
    silver: {
      tierName: 'Silver Installer',
      defaultMarginPerKw: 3500,
      maxMarginCapPerKw: 5000,
      description: 'Entry / Regional Empanelled Installers (< 1.5 MW/quarter)'
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
    gstPercent: 13.8, // Composite solar GST
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
