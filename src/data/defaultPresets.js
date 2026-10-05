// Default Presets & Master Configuration for Sunvine Renewable Energy
// 100% Gujarat State Solar EPC Network & BOS Price List from Official Specifications

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

// Exact BOS Price List from PDF (Page 1 Top)
export const PDF_BOS_PRICE_MATRIX = [
  {
    "capacityKW": 2.2,
    "noOfModules": 4,
    "inverterCapacityKW": 2.2,
    "adaniBiFiPrice": 100397,
    "apsBiFiPrice": 92950,
    "rayzonePrice": 93412,
    "topcon585CapacityKW": 2.34,
    "waaree585Price": 106823,
    "topcon600CapacityKW": 2.4,
    "apsTopcon600Price": 101455
  },
  {
    "capacityKW": 2.75,
    "noOfModules": 5,
    "inverterCapacityKW": 3,
    "adaniBiFiPrice": 119721,
    "apsBiFiPrice": 110298,
    "rayzonePrice": 110875,
    "topcon585CapacityKW": 2.925,
    "waaree585Price": 127639,
    "topcon600CapacityKW": 3,
    "apsTopcon600Price": 120929
  },
  {
    "capacityKW": 3.3,
    "noOfModules": 6,
    "inverterCapacityKW": 3.6,
    "adaniBiFiPrice": 138385,
    "apsBiFiPrice": 127500,
    "rayzonePrice": 128193,
    "topcon585CapacityKW": 3.51,
    "waaree585Price": 148308,
    "topcon600CapacityKW": 3.6,
    "apsTopcon600Price": 140257
  },
  {
    "capacityKW": 3.85,
    "noOfModules": 7,
    "inverterCapacityKW": 3.6,
    "adaniBiFiPrice": 159140,
    "apsBiFiPrice": 145722,
    "rayzonePrice": 146531,
    "topcon585CapacityKW": 4.095,
    "waaree585Price": 169999,
    "topcon600CapacityKW": 4.2,
    "apsTopcon600Price": 160606
  },
  {
    "capacityKW": 4.4,
    "noOfModules": 8,
    "inverterCapacityKW": "4.2/4.4",
    "adaniBiFiPrice": 181874,
    "apsBiFiPrice": 170200,
    "rayzonePrice": 171124,
    "topcon585CapacityKW": 4.68,
    "waaree585Price": 197945,
    "topcon600CapacityKW": 4.8,
    "apsTopcon600Price": 187210
  },
  {
    "capacityKW": 4.95,
    "noOfModules": 9,
    "inverterCapacityKW": 5,
    "adaniBiFiPrice": 199878,
    "apsBiFiPrice": 186698,
    "rayzonePrice": 187737,
    "topcon585CapacityKW": 5.265,
    "waaree585Price": 217911,
    "topcon600CapacityKW": 5.4,
    "apsTopcon600Price": 205834
  },
  {
    "capacityKW": 5.5,
    "noOfModules": 10,
    "inverterCapacityKW": 5,
    "adaniBiFiPrice": 218542,
    "apsBiFiPrice": 203926,
    "rayzonePrice": 205081,
    "topcon585CapacityKW": 5.85,
    "waaree585Price": 238607,
    "topcon600CapacityKW": 6,
    "apsTopcon600Price": 225188
  },
  {
    "capacityKW": 6.6,
    "noOfModules": 12,
    "inverterCapacityKW": 6,
    "adaniBiFiPrice": 262251,
    "apsBiFiPrice": 244530,
    "rayzonePrice": 245916,
    "topcon585CapacityKW": 7.02,
    "waaree585Price": 286148,
    "topcon600CapacityKW": 7.2,
    "apsTopcon600Price": 270045
  },
  {
    "capacityKW": 7.7,
    "noOfModules": 14,
    "inverterCapacityKW": 8,
    "adaniBiFiPrice": 315969,
    "apsBiFiPrice": 296066,
    "rayzonePrice": 297683,
    "topcon585CapacityKW": 8.19,
    "waaree585Price": 344620,
    "topcon600CapacityKW": 8.4,
    "apsTopcon600Price": 325833
  },
  {
    "capacityKW": 8.25,
    "noOfModules": 15,
    "inverterCapacityKW": 8,
    "adaniBiFiPrice": 334964,
    "apsBiFiPrice": 313582,
    "rayzonePrice": 315315,
    "topcon585CapacityKW": 8.775,
    "waaree585Price": 365605,
    "topcon600CapacityKW": 9,
    "apsTopcon600Price": 345476
  },
  {
    "capacityKW": 8.8,
    "noOfModules": 16,
    "inverterCapacityKW": 8,
    "adaniBiFiPrice": 353628,
    "apsBiFiPrice": 330770,
    "rayzonePrice": 332618,
    "topcon585CapacityKW": 9.36,
    "waaree585Price": 386260,
    "topcon600CapacityKW": 9.6,
    "apsTopcon600Price": 364790
  },
  {
    "capacityKW": 9.35,
    "noOfModules": 17,
    "inverterCapacityKW": 10,
    "adaniBiFiPrice": 381212,
    "apsBiFiPrice": 357638,
    "rayzonePrice": 359601,
    "topcon585CapacityKW": 9.945,
    "waaree585Price": 416596,
    "topcon600CapacityKW": 10.2,
    "apsTopcon600Price": 393784
  },
  {
    "capacityKW": 9.9,
    "noOfModules": 18,
    "inverterCapacityKW": 10,
    "adaniBiFiPrice": 398326,
    "apsBiFiPrice": 373330,
    "rayzonePrice": 375409,
    "topcon585CapacityKW": 10.53,
    "waaree585Price": 435756,
    "topcon600CapacityKW": 10.8,
    "apsTopcon600Price": 411602
  },
  {
    "capacityKW": 10.45,
    "noOfModules": 19,
    "inverterCapacityKW": 10,
    "adaniBiFiPrice": 416276,
    "apsBiFiPrice": 390307,
    "rayzonePrice": 392502,
    "topcon585CapacityKW": 11.115,
    "waaree585Price": 456202,
    "topcon600CapacityKW": 11.4,
    "apsTopcon600Price": 430706
  }
];

// Exact BOS BOM Specifications from PDF
export const PDF_BOM_SPECIFICATIONS = [
  {
    "capacityKW": 2.16,
    "modules": "4 (540W)",
    "inverter": "2.2 KW",
    "dcWire": "30 Mtr",
    "acWire": "15 Mtr (4 Sqmm)",
    "earthingWire": "25 Mtr (4 Sqmm)",
    "laWire": "15 Mtr (10 Sqmm)",
    "acdb": "1 Phase",
    "dcdb": "1 IN 1 OUT",
    "earthingKit": "2 Set",
    "pvcPipes": "30 Mtr",
    "hardware": "Including",
    "mc4": "2 Pairs"
  },
  {
    "capacityKW": 3.24,
    "modules": "6 (540W)",
    "inverter": "3.3 KW",
    "dcWire": "30 Mtr",
    "acWire": "15 Mtr (4 Sqmm)",
    "earthingWire": "25 Mtr (4 Sqmm)",
    "laWire": "15 Mtr (10 Sqmm)",
    "acdb": "1 Phase",
    "dcdb": "1 IN 1 OUT",
    "earthingKit": "2 Set",
    "pvcPipes": "30 Mtr",
    "hardware": "Including",
    "mc4": "2 Pairs"
  },
  {
    "capacityKW": 5.4,
    "modules": "10 (540W)",
    "inverter": "5.0 KW",
    "dcWire": "50 Mtr",
    "acWire": "25 Mtr (6 Sqmm)",
    "earthingWire": "30 Mtr (6 Sqmm)",
    "laWire": "20 Mtr (10 Sqmm)",
    "acdb": "3 Phase",
    "dcdb": "2 IN 2 OUT",
    "earthingKit": "3 Set",
    "pvcPipes": "50 Mtr",
    "hardware": "Including",
    "mc4": "4 Pairs"
  }
];

// Approved Solar Modules Catalog
export const GUJARAT_MODULES = [
  {
    id: 'mod-aps-600',
    brand: 'APS / Sunvine Premier',
    model: '600WP TOPCON MONO BIFACIAL Panel',
    wattage: 600,
    cellTech: 'TOPCon Mono Bifacial',
    efficiency: '22.8%',
    ratePerWp: '₹ 24.00/Wp',
    warrantyYears: 30,
    isDefault: true
  },
  {
    id: 'mod-waaree-585',
    brand: 'Waaree Energies',
    model: '585WP TOPCon Bifacial Dual Glass (HyperIon)',
    wattage: 585,
    cellTech: 'TOPCon Mono Bifacial',
    efficiency: '22.4%',
    ratePerWp: '₹ 26.80/Wp',
    warrantyYears: 30,
    isDefault: false
  },
  {
    id: 'mod-waaree-540',
    brand: 'Waaree Energies',
    model: '540W Mono PERC Half-Cut Module',
    wattage: 540,
    cellTech: 'Mono PERC Bifacial',
    efficiency: '21.5%',
    ratePerWp: '₹ 22.50/Wp',
    warrantyYears: 25,
    isDefault: false
  },
  {
    id: 'mod-waaree-610',
    brand: 'Waaree Energies',
    model: '610W/620W TOPCon Bifacial Dual Glass',
    wattage: 610,
    cellTech: 'TOPCon Mono Bifacial',
    efficiency: '23.0%',
    ratePerWp: '₹ 27.50/Wp',
    warrantyYears: 30,
    isDefault: false
  },
  {
    id: 'mod-adani-550',
    brand: 'Adani Solar',
    model: 'Elan Bi-550W Mono PERC Half-Cut',
    wattage: 550,
    cellTech: 'Mono PERC Bifacial',
    efficiency: '21.8%',
    ratePerWp: '₹ 22.50/Wp',
    warrantyYears: 25,
    isDefault: false
  },
  {
    id: 'mod-adani-600',
    brand: 'Adani Solar',
    model: '600W Vertex TOPCon Bifacial',
    wattage: 600,
    cellTech: 'TOPCon Mono Bifacial',
    efficiency: '22.6%',
    ratePerWp: '₹ 24.00/Wp',
    warrantyYears: 30,
    isDefault: false
  },
  {
    id: 'mod-aps-550',
    brand: 'APS Bi-Fi',
    model: '550W Bifacial Dual Glass',
    wattage: 550,
    cellTech: 'TOPCon Mono Bifacial',
    efficiency: '21.6%',
    ratePerWp: '₹ 22.50/Wp',
    warrantyYears: 25,
    isDefault: false
  },
  {
    id: 'mod-rayzone-550',
    brand: 'Rayzone Solar',
    model: '550W Bi-Fi Mono PERC Half-Cut',
    wattage: 550,
    cellTech: 'Mono PERC Bifacial',
    efficiency: '21.6%',
    ratePerWp: '₹ 22.70/Wp',
    warrantyYears: 25,
    isDefault: false
  }
];

// Approved Solar Inverters Catalog
export const GUJARAT_INVERTERS = [
  {
    id: 'inv-solis-2_2',
    brand: 'Solis / Solaryaan',
    model: '2.2 KW Single Phase Grid-Tied Inverter',
    capacityKW: 2.2,
    phase: 'Single Phase',
    efficiency: '97.8%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-sunvine-3',
    brand: 'Sunvine Smart Series',
    model: '3.0 KW 1-Phase Smart MPPT On-Grid',
    capacityKW: 3.0,
    phase: 'Single Phase',
    efficiency: '98.0%',
    warrantyYears: 8,
    isDefault: true
  },
  {
    id: 'inv-solis-3_6',
    brand: 'Solis / Vsole',
    model: '3.6 KW Single Phase Dual MPPT On-Grid',
    capacityKW: 3.6,
    phase: 'Single Phase',
    efficiency: '98.2%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-sunvine-5',
    brand: 'Sunvine Smart Series',
    model: '5.0 KW 3-Phase Smart MPPT On-Grid',
    capacityKW: 5.0,
    phase: 'Three Phase',
    efficiency: '98.4%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-sunvine-6',
    brand: 'Sunvine Smart Series',
    model: '6.0 KW 3-Phase Smart MPPT On-Grid',
    capacityKW: 6.0,
    phase: 'Three Phase',
    efficiency: '98.4%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-growatt-10',
    brand: 'Growatt / Deye',
    model: '10.0 KW 3-Phase Dual MPPT On-Grid',
    capacityKW: 10.0,
    phase: 'Three Phase',
    efficiency: '98.6%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-solis-50',
    brand: 'Solis Cloud Series',
    model: '50.0 KW 3-Phase Grid-Tied Inverter with Wi-Fi Logger',
    capacityKW: 50.0,
    phase: 'Three Phase',
    efficiency: '98.7%',
    warrantyYears: 8,
    isDefault: false
  },
  {
    id: 'inv-solaryaan-125',
    brand: 'Solaryaan / Solis / Vsole',
    model: '125.0 KW String type Three-Phase Grid Tied Inverter',
    capacityKW: 125.0,
    phase: 'Three Phase',
    efficiency: '99.0%',
    warrantyYears: 8,
    isDefault: false
  }
];

// Starter Verified Gujarat Solar EPC Dealers (Snappy boot dataset)
export const INITIAL_DEALERS = [
  {
    id: "SV-DLR-8000",
    dealerCode: "SV-DLR-8000",
    firmName: "Sunvine Solar Partner",
    contactPerson: "Authorized Partner",
    mobile: "8000050580",
    email: "partner@sunvinedealer.in",
    city: "Ahmedabad",
    state: "Gujarat",
    discom: "UGVCL",
    tier: "Gold EPC",
    maxMarginCapPerKw: 6000,
    totalQuotes: 0,
    totalCapacityKw: 0,
    assignedStaffId: "STF-801",
    assignedStaffName: "Sunvine Sales Staff",
    status: "Active",
    joinedDate: "2026-10-02"
  }
];

// Starter Verified Gujarat Quotations (Clean state)
export const INITIAL_QUOTATIONS = [];

export const DEFAULT_PRICING_MASTER = {
  // Benchmark Quotation Presets for Admin & Dealer synchronization
  quotationPresets: {
    baseRatePerKw: 59800,
    subsidyCap: 78000,
    minMarginPerKw: 4000,
    lastSynced: 'Today, 09:30 AM by Ops',
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

  // Official Sunvine Bank Details from PDF
  bankDetails: SUNVINE_OFFICIAL_PROFILE.bankDetails,

  // Terms & Warranties from PDF & Master Configuration
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

  // Real PDF BOS Reference Data
  bosPriceMatrix: PDF_BOS_PRICE_MATRIX,
  bomSpecifications: PDF_BOM_SPECIFICATIONS
};

export const DEFAULT_MODULES = GUJARAT_MODULES;
export const DEFAULT_INVERTERS = GUJARAT_INVERTERS;

// Gujarat System & Compliance Notifications
export const DEFAULT_NOTIFICATIONS = [
  {
    id: 'release-2.2.1',
    audience: 'all',
    type: 'success',
    icon: 'system_update',
    title: 'System Updated to v2.2.1',
    description: 'v2.2.1 Hotfix. Resolved partner tier margin hook synchronization in Dealer Management console and verified system stability.',
    createdAt: '2026-09-24T23:15:00.000Z',
    isRelease: true,
    version: 'v2.2.1'
  },
  {
    id: 'release-2.2.0',
    audience: 'all',
    type: 'success',
    icon: 'system_update',
    title: 'System Updated to v2.2.0',
    description: 'v2.2.0 Production Release. Admin Master Ledger top filters, CSV proposals export, dynamic average margin metrics, hardware specs import, bulk price editor, and WhatsApp price broadcast.',
    createdAt: '2026-09-24T22:30:00.000Z',
    isRelease: true,
    version: 'v2.2.0'
  },
  {
    id: 'notif-adm-001',
    audience: 'admin',
    type: 'success',
    icon: 'check_circle',
    title: 'DISCOM Clearance: MIRANA TECHNOCAST (PGVCL)',
    description: 'Grid-tie synchronization approved for 120.0 kW HT industrial system at Metoda GIDC, Rajkot.',
    createdAt: '2026-09-22T08:30:00.000Z',
    targetTab: 'all_quotes'
  },
  {
    id: 'notif-dlr-001',
    audience: 'dealer',
    type: 'success',
    icon: 'verified',
    title: 'Quotation #SV-2026-Q801 Approved',
    description: 'Your proposal for 5.0 kW residential rooftop solar has been approved by Sunvine Operations.',
    createdAt: '2026-09-22T08:45:00.000Z',
    targetTab: 'my_quotes'
  },
  {
    id: 'notif-dlr-002',
    audience: 'dealer',
    type: 'info',
    icon: 'bolt',
    title: 'New Hardware Added: Waaree TOPCon Bifacial',
    description: 'Waaree 585WP TOPCon Bifacial panels are now available in your quotation component picker.',
    createdAt: '2026-09-22T06:30:00.000Z',
    targetTab: 'create_quote'
  },
  {
    id: `notif-sys-${APP_VERSION}`,
    audience: 'all',
    type: 'info',
    icon: 'system_update',
    title: `Platform v${APP_VERSION} Online`,
    description: `${CURRENT_RELEASE_CHANGELOG?.title || 'System Update'}: ${(CURRENT_RELEASE_CHANGELOG?.highlights?.slice(0, 2) || []).join(' | ')}.`,
    createdAt: '2026-09-24T00:00:00.000Z',
    targetTab: 'dashboard'
  }
];
