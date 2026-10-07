// Master Configuration for Sunvine Renewable Energy
// All modules, inverters, dealers, BOM, and pricing are strictly fetched in real-time from Supabase database.

import { APP_VERSION, CURRENT_RELEASE_CHANGELOG } from '../config/version';

export const SUNVINE_OFFICIAL_PROFILE = {
  companyName: 'SUNVINE RENEWABLE',
  gstin: '24AFPFS7402A1Z7',
  address: 'G-705, near swaminarayan restaurant, Rajkot, Gujarat - 360021',
  tagline: 'Empowering Gujarat with Clean Solar Energy',
  state: 'Gujarat',
  notes: [
    'ALL PRICES ARE INCLUDING GST',
    'TRANSPORTATION AND INSTALLATION - DEALER SCOPE',
    'LIST OF COMPULSORY REQUIRED DOCUMENTS: LIGHT BILL, BANK DETAIL, AADHAR CARD, MOBILE NO.'
  ],
  bankDetails: {
    firmName: 'SUNVINE RENEWABLE',
    bankName: 'HDFC BANK LTD.',
    accountNumber: '99998000050580',
    ifscCode: 'HDFC0002012',
    branch: 'METODA BRANCH, RAJKOT',
    email: 'sunvinerenewable@gmail.com'
  },
  terms: {
    modulePerformanceWarrantyYears: 30,
    moduleDefectWarrantyYears: 12,
    inverterWarrantyYears: 8,
    workmanshipWarrantyYears: 5,
    paymentTerms: '10% advance with purchase order, 90% before material dispatch.',
    deliveryDays: 15,
    validityDays: 15,
    supportPhone: '+91 95865 33750',
    helpline: '8000050580',
    website: 'www.sunvinerenewable.com'
  }
};

// Official Sunvine National Portal Rooftop Price List (Dated 27-08-2026 / 05-08-2026)
export const PDF_BOS_PRICE_MATRIX = [
  { capacityKW: 2.2, noOfModules: 4, inverterCapacityKW: '2.2KW', adaniBiFiPrice: 117882, apsBiFiPrice: 104500, rayzonePrice: 104500, waaree540Price: 114696, topcon585CapacityKW: 2.34, waaree585Price: 126360, topcon600CapacityKW: 2.40, apsTopcon600Price: 117600 },
  { capacityKW: 2.75, noOfModules: 5, inverterCapacityKW: '3KW', adaniBiFiPrice: 138195, apsBiFiPrice: 123750, rayzonePrice: 123750, waaree540Price: 134460, topcon585CapacityKW: 2.925, waaree585Price: 149175, topcon600CapacityKW: 3.00, apsTopcon600Price: 141600 },
  { capacityKW: 3.3, noOfModules: 6, inverterCapacityKW: '3.6KW', adaniBiFiPrice: 160173, apsBiFiPrice: 148500, rayzonePrice: 148500, waaree540Price: 155844, topcon585CapacityKW: 3.51, waaree585Price: 173043, topcon600CapacityKW: 3.60, apsTopcon600Price: 164520 },
  { capacityKW: 3.85, noOfModules: 7, inverterCapacityKW: '3.6KW', adaniBiFiPrice: 186131, apsBiFiPrice: 173250, rayzonePrice: 173250, waaree540Price: 181100, topcon585CapacityKW: 4.095, waaree585Price: 204750, topcon600CapacityKW: 4.20, apsTopcon600Price: 196140 },
  { capacityKW: 4.4, noOfModules: 8, inverterCapacityKW: '4/4.2KW', adaniBiFiPrice: 208680, apsBiFiPrice: 194480, rayzonePrice: 194480, waaree540Price: 203040, topcon585CapacityKW: 4.68, waaree585Price: 229320, topcon600CapacityKW: 4.80, apsTopcon600Price: 224160 },
  { capacityKW: 4.95, noOfModules: 9, inverterCapacityKW: '5/5.2KW', adaniBiFiPrice: 238761, apsBiFiPrice: 218790, rayzonePrice: 218790, waaree540Price: 232308, topcon585CapacityKW: 5.265, waaree585Price: 256932, topcon600CapacityKW: 5.40, apsTopcon600Price: 248400 },
  { capacityKW: 5.5, noOfModules: 10, inverterCapacityKW: '6KW', adaniBiFiPrice: 263070, apsBiFiPrice: 243100, rayzonePrice: 243100, waaree540Price: 255960, topcon585CapacityKW: 5.85, waaree585Price: 280800, topcon600CapacityKW: 6.00, apsTopcon600Price: 276000 },
  { capacityKW: 6.05, noOfModules: 11, inverterCapacityKW: '6KW', adaniBiFiPrice: 286935, apsBiFiPrice: 266200, rayzonePrice: 266200, waaree540Price: 279180, topcon585CapacityKW: 6.435, waaree585Price: 308880, topcon600CapacityKW: 6.60, apsTopcon600Price: 303600 },
  { capacityKW: 6.6, noOfModules: 12, inverterCapacityKW: '6KW', adaniBiFiPrice: 312000, apsBiFiPrice: 290400, rayzonePrice: 290400, waaree540Price: 304560, topcon585CapacityKW: 7.02, waaree585Price: 336960, topcon600CapacityKW: 7.20, apsTopcon600Price: 331200 },
  { capacityKW: 7.7, noOfModules: 14, inverterCapacityKW: '8KW', adaniBiFiPrice: 364000, apsBiFiPrice: 338800, rayzonePrice: 338800, waaree540Price: 355320, topcon585CapacityKW: 8.19, waaree585Price: 393120, topcon600CapacityKW: 8.40, apsTopcon600Price: 386400 },
  { capacityKW: 8.25, noOfModules: 15, inverterCapacityKW: '8KW', adaniBiFiPrice: 390000, apsBiFiPrice: 363000, rayzonePrice: 363000, waaree540Price: 380700, topcon585CapacityKW: 8.775, waaree585Price: 421200, topcon600CapacityKW: 9.00, apsTopcon600Price: 414000 },
  { capacityKW: 8.8, noOfModules: 16, inverterCapacityKW: '8KW', adaniBiFiPrice: 416000, apsBiFiPrice: 387200, rayzonePrice: 387200, waaree540Price: 406080, topcon585CapacityKW: 9.36, waaree585Price: 449280, topcon600CapacityKW: 9.60, apsTopcon600Price: 441600 },
  { capacityKW: 9.35, noOfModules: 17, inverterCapacityKW: '10KW', adaniBiFiPrice: 442000, apsBiFiPrice: 411400, rayzonePrice: 411400, waaree540Price: 431460, topcon585CapacityKW: 9.945, waaree585Price: 477360, topcon600CapacityKW: 10.20, apsTopcon600Price: 469200 },
  { capacityKW: 9.9, noOfModules: 18, inverterCapacityKW: '10KW', adaniBiFiPrice: 468000, apsBiFiPrice: 435600, rayzonePrice: 435600, waaree540Price: 456840, topcon585CapacityKW: 10.53, waaree585Price: 505440, topcon600CapacityKW: 10.80, apsTopcon600Price: 496800 },
  { capacityKW: 10.45, noOfModules: 19, inverterCapacityKW: '10KW', adaniBiFiPrice: 494000, apsBiFiPrice: 459800, rayzonePrice: 459800, waaree540Price: 482220, topcon585CapacityKW: 11.115, waaree585Price: 533520, topcon600CapacityKW: 11.40, apsTopcon600Price: 524400 }
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
