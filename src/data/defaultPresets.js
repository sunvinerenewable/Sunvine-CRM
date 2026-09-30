// Default Presets & Master Configuration for Sunvine Renewable Energy
// 100% Gujarat State Solar EPC Network & BOS Price List from PDF

import {
  SUNVINE_OFFICIAL_PROFILE,
  PDF_BOS_PRICE_MATRIX,
  PDF_BOM_SPECIFICATIONS,
  GUJARAT_MODULES,
  GUJARAT_INVERTERS,
  GUJARAT_DEALERS,
  GUJARAT_QUOTATIONS
} from './gujaratDatabase.js';
import { APP_VERSION, CURRENT_RELEASE_CHANGELOG } from '../config/version.js';

export {
  SUNVINE_OFFICIAL_PROFILE,
  PDF_BOS_PRICE_MATRIX,
  PDF_BOM_SPECIFICATIONS,
  GUJARAT_MODULES,
  GUJARAT_INVERTERS,
  GUJARAT_DEALERS,
  GUJARAT_QUOTATIONS
};

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

// Approved Solar Modules Master Catalog (from PDF)
export const DEFAULT_MODULES = GUJARAT_MODULES;

// Approved Solar Inverters Master Catalog (from PDF & Master)
export const DEFAULT_INVERTERS = GUJARAT_INVERTERS;

// 550 Verified Gujarat Solar EPC Dealers (100% Gujarat Only)
export const INITIAL_DEALERS = GUJARAT_DEALERS;

// Gujarat Quotations Master Dataset
export const INITIAL_QUOTATIONS = GUJARAT_QUOTATIONS;

// Gujarat System & Compliance Notifications (Role-partitioned: 'admin' | 'dealer' | 'all')
export const DEFAULT_NOTIFICATIONS = [
  // Latest System Release Notification (Available to All)
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
    id: 'release-2.1.1',
    audience: 'all',
    type: 'success',
    icon: 'system_update',
    title: 'System Updated to v2.1.1',
    description: 'v2.1.1 Production Deployment. Interactive Release Notes, real-time changelog viewer, persistent notification panel, and unified Gujarat solar calculation workflows.',
    createdAt: '2026-09-24T00:00:00.000Z',
    isRelease: true,
    version: 'v2.1.1'
  },
  // Super Admin Alerts
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
    id: 'notif-adm-002',
    audience: 'admin',
    type: 'warning',
    icon: 'shield',
    title: 'Gujarat Margin Benchmark Cap Enforced',
    description: 'Central operations policy enforced: Max margin ceiling of ₹6,000/kW for Gold and ₹7,500/kW for Platinum partners.',
    createdAt: '2026-09-22T07:15:00.000Z',
    targetTab: 'dealers_mgmt'
  },
  {
    id: 'notif-adm-003',
    audience: 'admin',
    type: 'info',
    icon: 'tune',
    title: 'Central PM Surya Ghar DBT Cap Synced',
    description: 'Direct Benefit Transfer cap of ₹78,000 (>=3kW) validated against MNRE National Portal ledger.',
    createdAt: '2026-09-21T18:00:00.000Z',
    targetTab: 'pricing_master'
  },

  // Dealer Alerts
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
    id: 'notif-dlr-003',
    audience: 'dealer',
    type: 'info',
    icon: 'phone_in_talk',
    title: 'Sunvine EPC Gujarat Helpline Active',
    description: 'Toll-free dealer dispatch and DISCOM meter tracking available via +91 80000 50580.',
    createdAt: '2026-09-21T14:00:00.000Z',
    targetTab: 'dashboard'
  },

  // General System Broadcast
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
