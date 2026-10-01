import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  DEFAULT_PRICING_MASTER,
  DEFAULT_MODULES,
  DEFAULT_INVERTERS,
  INITIAL_DEALERS,
  INITIAL_QUOTATIONS,
  DEFAULT_NOTIFICATIONS,
  PDF_BOS_PRICE_MATRIX,
  PDF_BOM_SPECIFICATIONS,
  SUNVINE_OFFICIAL_PROFILE
} from '../data/defaultPresets';
import {
  STANDARD_BOM_CATALOG,
  STANDARD_BOM_CATEGORIES,
  DEFAULT_CAPACITY_BOM,
  resolveCapacityBom
} from '../data/standardBomData';
import {
  DEFAULT_STAFF,
  DEFAULT_CUSTOMER_FILES,
  getAssignedStaffForDealer
} from '../data/staffData';
import {
  DEFAULT_SYSTEM_SETTINGS,
  INITIAL_AUDIT_LOGS
} from '../data/systemSettingsDefaults';
import {
  DEFAULT_REQUIRED_DOCUMENTS,
  APPLICATION_CATEGORIES,
  DEFAULT_PIPELINE_STAGES,
  isDocMandatoryForCategory
} from '../data/defaultRequiredDocuments';
import {
  calculateStaffPerformance,
  calculateDealerPerformance,
  calculateOverallBusinessMetrics
} from '../utils/performanceAnalytics';
import { hardwareService } from '../services/hardwareService';
import { quotationService } from '../services/quotationService';
import { pricingService } from '../services/pricingService';
import { customerFileService } from '../services/customerFileService';
import { staffService } from '../services/staffService';
import { systemSettingsService } from '../services/systemSettingsService';
import { auditLogService } from '../services/auditLogService';
import { dealerService } from '../services/dealerService';
import { bankService } from '../services/bankService';
import { settingsService } from '../services/settingsService';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { generateFieldBOM } from '../data/standardBomData';

const DB_VERSION = 'sunvine_gujarat_ledger_200_v1';

export const DEFAULT_GOVERNANCE_SETTINGS = {
  enforceAlmm: true,
  pmSuryaGharActive: true,
  maxDealerMarginPerKW: 8000,
  minDealerMarginPerKW: 0,
  quoteExpiryDays: 15,
  autoGedaSync: true,
  requireAdminApprovalAboveKW: 100,
  retentionMonths: 36,
  discomApiStatus: 'Online - 12ms ping',
  gedaSyncStatus: 'Connected (Hourly)',
  lastBackupTimestamp: 'Today, 01:15 AM'
};

const AppContext = createContext();

const TAB_TO_PATH = {
  dashboard: '/dashboard',
  create_quote: '/new-quotation',
  admin_create_quote: '/admin/new-quotation',
  preview_quote: '/preview-quotation',
  my_quotes: '/my-quotations',
  my_applications: '/my-applications',
  profile: '/settings',
  dealer_settings: '/settings',
  admin_dashboard: '/admin',
  dealers_mgmt: '/admin/dealers',
  staff_mgmt: '/admin/staff',
  pricing_master: '/admin/pricing',
  hardware_master: '/admin/hardware',
  all_quotes: '/admin/quotations',
  admin_settings: '/admin/settings',
  admin_performance: '/admin/performance',
  admin_reports: '/admin/reports',
  admin_audit: '/admin/audit-logs',
  admin_docs: '/admin/documentation',
  staff_dashboard: '/staff',
  staff_files: '/staff/files',
  staff_performance: '/staff/performance',
  staff_new_lead: '/staff/new-lead',
  staff_map: '/staff/map',
  dealer_performance: '/dealer/performance',
  lead_generation: '/leads',
  docs: '/documentation'
};

const PATH_TO_TAB = Object.entries(TAB_TO_PATH).reduce((acc, [tab, path]) => {
  acc[path] = tab;
  return acc;
}, {
  '/profile': 'dealer_settings',
  '/admin/new-quotation': 'create_quote',
  '/staff': 'staff_dashboard'
});

const getInitialTabFromUrl = () => {
  if (typeof window === 'undefined') return 'dashboard';
  const pathname = window.location.pathname;
  if (pathname === '/profile') {
    window.history.replaceState({ tab: 'dealer_settings' }, '', '/settings');
    return 'dealer_settings';
  }
  if (pathname === '/' || pathname === '') {
    const saved = localStorage.getItem('sunvine_tab');
    return saved === 'profile' ? 'dealer_settings' : saved || 'dashboard';
  }
  const matched = PATH_TO_TAB[pathname];
  if (matched === 'profile') return 'dealer_settings';
  return matched || localStorage.getItem('sunvine_tab') || 'dashboard';
};

export const AppProvider = ({ children }) => {
  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sunvine_auth') === 'true';
  });

  // Auth screen toggle when not authenticated ('dealer_login' or 'admin_login')
  const [authView, setAuthView] = useState('dealer_login');

  // Role: 'dealer' or 'admin'
  const [role, setRole] = useState(() => localStorage.getItem('sunvine_role') || 'dealer');
  const [activeTab, setActiveTabState] = useState(getInitialTabFromUrl);

  const setActiveTab = (newTab, replace = false) => {
    const effectiveTab = newTab === 'profile' ? 'dealer_settings' : newTab;
    setActiveTabState(effectiveTab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const targetPath = (role === 'admin' && (effectiveTab === 'create_quote' || effectiveTab === 'admin_create_quote'))
        ? '/admin/new-quotation'
        : (TAB_TO_PATH[effectiveTab] || '/dashboard');
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({ tab: effectiveTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: effectiveTab }, '', targetPath);
        }
      }
    }
  };

  // Browser back/forward button synchronization
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path === '/profile') {
          window.history.replaceState({ tab: 'dealer_settings' }, '', '/settings');
          setActiveTabState('dealer_settings');
          return;
        }
        const matchedTab = PATH_TO_TAB[path];
        if (matchedTab) {
          setActiveTabState(matchedTab === 'profile' ? 'dealer_settings' : matchedTab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL on initial load if logged in
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('view') === 'quote') {
        // Do not overwrite public quotation proposal view URL
        return;
      }
      if (window.location.pathname === '/profile') {
        window.history.replaceState({ tab: 'dealer_settings' }, '', '/settings');
        setActiveTabState('dealer_settings');
        return;
      }
      const targetPath = TAB_TO_PATH[activeTab] || '/dashboard';
      if (window.location.pathname !== targetPath && window.location.pathname === '/') {
        window.history.replaceState({ tab: activeTab }, '', targetPath);
      }
    }
  }, [isAuthenticated, activeTab]);
  
// Safe storage parser and serializer
const safeJsonParse = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    const parsed = JSON.parse(item);
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`[Sunvine Storage] Resetting corrupted key: ${key}`);
    try {
      localStorage.removeItem(key);
    } catch (_) {}
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (err) {
    console.warn(`[Sunvine Storage] Storage write suppressed for: ${key}`, err);
  }
};

  const isDbUpToDate = typeof window !== 'undefined' && localStorage.getItem('sunvine_db_version') === DB_VERSION;

  // Current Dealer Profile (Gujarat default)
  const [currentDealer, setCurrentDealer] = useState(() => {
    if (!isDbUpToDate) return INITIAL_DEALERS[0];
    const parsed = safeJsonParse('sunvine_current_dealer', INITIAL_DEALERS[0]);
    return parsed || INITIAL_DEALERS[0];
  });

  // Master Pricing Presets (Configurable by Admin & synced with PDF)
  const [pricingMaster, setPricingMaster] = useState(() => {
    return safeJsonParse('sunvine_pricing_master', DEFAULT_PRICING_MASTER);
  });

  // Benchmark Quotation Presets (Admin & Dealer Sync)
  const [pricingPresets, setPricingPresets] = useState(() => {
    return safeJsonParse('sunvine_pricing_presets', DEFAULT_PRICING_MASTER.quotationPresets);
  });

  // Commission Margins & Protective Caps by Dealer Tier
  const [tierMargins, setTierMargins] = useState(() => {
    return safeJsonParse('sunvine_tier_margins', DEFAULT_PRICING_MASTER.tierMargins);
  });

  // Admin Master Governance & Policy Settings
  const [governanceSettings, setGovernanceSettings] = useState(() => {
    return safeJsonParse('sunvine_governance_settings', DEFAULT_GOVERNANCE_SETTINGS);
  });

  useEffect(() => {
    safeSetItem('sunvine_tier_margins', tierMargins);
  }, [tierMargins]);

  useEffect(() => {
    safeSetItem('sunvine_governance_settings', governanceSettings);
  }, [governanceSettings]);

  // Solar Hardware Catalogs (Primary: Supabase DB, with offline cache fallback)
  const [modulesList, setModulesList] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_MODULES;
    return safeJsonParse('sunvine_modules', DEFAULT_MODULES);
  });

  const [invertersList, setInvertersList] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_INVERTERS;
    return safeJsonParse('sunvine_inverters', DEFAULT_INVERTERS);
  });

  const [isHardwareDbSyncing, setIsHardwareDbSyncing] = useState(false);
  const [isHardwareDbConnected, setIsHardwareDbConnected] = useState(false);

  // Determine if running in public proposal viewer mode
  const isPublicProposal = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'quote';

  // Live Universal Database Hydration (Async startup from Supabase PostgreSQL)
  useEffect(() => {
    let isMounted = true;
    const hydrateAllFromSupabase = async () => {
      try {
        setIsHardwareDbSyncing(true);
        const [
          dbModules,
          dbInverters,
          dbPresets,
          dbBos,
          dbBenchmarks,
          dbTiers,
          dbDealers,
          dbQuotations,
          dbFiles,
          dbStaff,
          dbSettings,
          dbLogs,
          dbNotifs
        ] = await Promise.allSettled([
          hardwareService.getAllModules(),
          hardwareService.getAllInverters(),
          pricingService.getPricingPresets(),
          pricingService.getBosMatrix(),
          pricingService.getInverterBenchmarks(),
          pricingService.getTierMargins(),
          dealerService.getAllDealers(),
          quotationService.getAllQuotations(100),
          customerFileService.getAllCustomerFiles(),
          staffService.getAllStaff(),
          systemSettingsService.getSystemSettings(),
          auditLogService.getAuditLogs(100),
          auditLogService.getNotifications()
        ]);

        if (!isMounted) return;

        if (dbModules.status === 'fulfilled' && Array.isArray(dbModules.value) && dbModules.value.length > 0) {
          setModulesList(dbModules.value);
          setIsHardwareDbConnected(true);
        }
        if (dbInverters.status === 'fulfilled' && Array.isArray(dbInverters.value) && dbInverters.value.length > 0) {
          setInvertersList(dbInverters.value);
          setIsHardwareDbConnected(true);
        }
        if (dbPresets.status === 'fulfilled' && dbPresets.value) {
          setPricingPresets(dbPresets.value);
        }
        if (dbBos.status === 'fulfilled' && Array.isArray(dbBos.value) && dbBos.value.length > 0) {
          setPdfBosMatrix(dbBos.value);
        }
        if (dbBenchmarks.status === 'fulfilled' && Array.isArray(dbBenchmarks.value) && dbBenchmarks.value.length > 0) {
          setInverterBenchmarkMatrix(dbBenchmarks.value);
        }
        if (dbTiers.status === 'fulfilled' && dbTiers.value && Object.keys(dbTiers.value).length > 0) {
          setTierMargins(dbTiers.value);
        }
        if (dbDealers.status === 'fulfilled' && Array.isArray(dbDealers.value) && dbDealers.value.length > 0) {
          setDealers(dbDealers.value);
        }
        if (dbQuotations.status === 'fulfilled' && Array.isArray(dbQuotations.value)) {
          setQuotations(dbQuotations.value);
        }
        if (dbFiles.status === 'fulfilled' && Array.isArray(dbFiles.value) && dbFiles.value.length > 0) {
          setCustomerFiles(dbFiles.value);
        }
        if (dbStaff.status === 'fulfilled' && Array.isArray(dbStaff.value) && dbStaff.value.length > 0) {
          setStaffList(dbStaff.value);
        }
        if (dbSettings.status === 'fulfilled' && dbSettings.value) {
          setSystemSettings(prev => ({ ...(prev || {}), ...dbSettings.value }));
        }
        if (dbLogs.status === 'fulfilled' && Array.isArray(dbLogs.value) && dbLogs.value.length > 0) {
          setAuditLogs(dbLogs.value);
        }
        if (dbNotifs.status === 'fulfilled' && Array.isArray(dbNotifs.value) && dbNotifs.value.length > 0) {
          setNotifications(dbNotifs.value);
        }
      } catch (err) {
        console.warn('[AppContext] Supabase live hydration fallback to local cache:', err);
      } finally {
        if (isMounted) setIsHardwareDbSyncing(false);
      }
    };

    hydrateAllFromSupabase();
    return () => { isMounted = false; };
  }, []);

  // Real-time Supabase Database Subscriptions across all major tables
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          const formatted = row.quote_payload && typeof row.quote_payload === 'object' ? { ...row.quote_payload, ...row, id: row.id } : row;
          setQuotations(prev => [formatted, ...prev.filter(q => q.id !== formatted.id)]);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          const formatted = row.quote_payload && typeof row.quote_payload === 'object' ? { ...row.quote_payload, ...row, id: row.id } : row;
          setQuotations(prev => prev.map(q => q.id === formatted.id ? { ...q, ...formatted } : q));
        } else if (payload.eventType === 'DELETE') {
          setQuotations(prev => prev.filter(q => q.id !== payload.old?.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealers' }, (payload) => {
        dealerService.getAllDealers().then(data => { if (data) setDealers(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_files' }, () => {
        customerFileService.getAllCustomerFiles().then(data => { if (data) setCustomerFiles(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_modules' }, () => {
        hardwareService.getAllModules().then(data => { if (data) setModulesList(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solar_inverters' }, () => {
        hardwareService.getAllInverters().then(data => { if (data) setInvertersList(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing_presets' }, () => {
        pricingService.getPricingPresets().then(data => { if (data) setPricingPresets(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bos_pricing_matrix' }, () => {
        pricingService.getBosMatrix().then(data => { if (data) setPdfBosMatrix(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inverter_benchmark_matrix' }, () => {
        pricingService.getInverterBenchmarks().then(data => { if (data) setInverterBenchmarkMatrix(data); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        auditLogService.getNotifications().then(data => { if (data) setNotifications(data); });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Solar Loan Partner Banks (Database Connected)
  const [solarBanks, setSolarBanks] = useState([]);

  // Live Supabase Master Database Hydration on Mount
  useEffect(() => {
    let isMounted = true;
    const hydrateMasterDataFromDatabase = async () => {
      try {
        const [
          dbDealers,
          dbStaff,
          dbFiles,
          dbSettings,
          dbPricing,
          dbBos,
          dbBanks,
          dbLogs,
          dbBomItems
        ] = await Promise.all([
          dealerService.getAllDealers(),
          staffService.getAllStaff(),
          customerFileService.getAllCustomerFiles(),
          settingsService.getSystemSettings(),
          settingsService.getPricingPresets(),
          settingsService.getBosPriceMatrix(),
          bankService.getAllSolarBanks(),
          settingsService.getAuditLogs(),
          hardwareService.getAllBomItems()
        ]);

        if (!isMounted) return;

        if (dbDealers && dbDealers.length > 0) {
          setDealers(ensureDealerAttribution(dbDealers));
        }
        if (dbStaff && dbStaff.length > 0) {
          setStaffList(dbStaff);
        }
        if (dbFiles && dbFiles.length > 0) {
          setCustomerFiles(ensureCustomerFileAttribution(dbFiles));
        }
        if (dbSettings) {
          setSystemSettings(prev => ({ ...prev, ...dbSettings }));
          if (dbSettings.governanceSettings) {
            setGovernanceSettings(dbSettings.governanceSettings);
          }
        }
        if (dbPricing) {
          setPricingPresets(prev => ({
            ...prev,
            baseRatePerKw: dbPricing.baseRatePerKw || prev.baseRatePerKw,
            subsidyCap: dbPricing.subsidyCap || prev.subsidyCap,
            minMarginPerKw: dbPricing.minMarginPerKw || prev.minMarginPerKw,
            lastSynced: dbPricing.lastSynced || prev.lastSynced
          }));
          if (dbPricing.tierMargins) {
            setTierMargins(dbPricing.tierMargins);
          }
          if (dbPricing.bomRates) {
            setBomRates(prev => ({ ...prev, ...dbPricing.bomRates }));
          }
          if (dbPricing.capacityBomMatrix) {
            setCapacityBomMatrix(prev => ({ ...prev, ...dbPricing.capacityBomMatrix }));
          }
          if (dbPricing.baseRates) {
            setPricingMaster(prev => ({ ...prev, baseRates: dbPricing.baseRates }));
          }
        }
        if (dbBos && dbBos.length > 0) {
          setPdfBosMatrix(dbBos);
        }
        if (dbBanks && dbBanks.length > 0) {
          setSolarBanks(dbBanks);
        }
        if (dbLogs && dbLogs.length > 0) {
          setAuditLogs(dbLogs);
        }
        if (dbBomItems && dbBomItems.length > 0) {
          setBomCatalog(prev => {
            const mergedMap = new Map();
            STANDARD_BOM_CATALOG.forEach(it => mergedMap.set(it.id, it));
            dbBomItems.forEach(it => mergedMap.set(it.id, { ...(mergedMap.get(it.id) || {}), ...it }));
            return Array.from(mergedMap.values());
          });
          setBomRates(prev => {
            const next = { ...prev };
            dbBomItems.forEach(it => {
              if (it.defaultRate && !next[it.id]) {
                next[it.id] = it.defaultRate;
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.warn('[AppContext] Supabase master database sync fallback:', err);
      }
    };

    hydrateMasterDataFromDatabase();
    return () => { isMounted = false; };
  }, []);

  const ensureDealerAttribution = (list) => {
    return (list || []).map(d => {
      if (!d) return d;
      const assigned = (d.assignedStaffId && d.assignedStaffName) ? null : getAssignedStaffForDealer(d);
      const tierLower = (d.tier || '').toLowerCase();
      const defaultTierMargin = tierLower.includes('diamond') ? 6500 : tierLower.includes('platinum') ? 5500 : tierLower.includes('silver') ? 3500 : 4500;
      return {
        ...d,
        assignedStaffId: d.assignedStaffId || assigned?.assignedStaffId || assigned?.staffId || 'STF-001',
        assignedStaffName: d.assignedStaffName || assigned?.assignedStaffName || assigned?.staffName || 'Jayesh Patel',
        onboardedDate: d.onboardedDate || '2025-06-15',
        pricingConfig: d.pricingConfig || {
          pricingMode: 'standard', // 'standard' | 'custom'
          customBaseRatePerWp: 18.00,
          customBaseRatePerKw: 58000,
          customMarginPerKw: defaultTierMargin,
          customDiscountPercent: 0,
          customNotes: ''
        }
      };
    });
  };

  // Dealers Directory (550 Gujarat Dealers Only)
  const [dealers, setDealers] = useState(() => {
    const raw = isDbUpToDate ? safeJsonParse('sunvine_dealers', INITIAL_DEALERS) : INITIAL_DEALERS;
    const base = (Array.isArray(raw) && raw.length >= 500) ? raw : INITIAL_DEALERS;
    return ensureDealerAttribution(base);
  });

  // Real PDF BOS Reference Data
  const [pdfBosMatrix, setPdfBosMatrix] = useState(() => {
    if (!isDbUpToDate) return PDF_BOS_PRICE_MATRIX;
    const parsed = safeJsonParse('sunvine_bos_price_matrix', PDF_BOS_PRICE_MATRIX);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : PDF_BOS_PRICE_MATRIX;
  });

  // Dedicated Inverter Sizing & Benchmark Pricing Matrix
  const [inverterBenchmarkMatrix, setInverterBenchmarkMatrix] = useState(() => {
    return safeJsonParse('sunvine_inverter_benchmark_matrix', [
      { id: 'inv-bm-1', capacityKW: 2.2, brand: 'Solis / Solaryaan', series: 'Single Phase Grid-Tied', phase: '1-Phase / Dual MPPT', benchmarkPrice: 24500 },
      { id: 'inv-bm-2', capacityKW: 3.0, brand: 'Sunvine Smart Series', series: '1-Phase Smart MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 29800 },
      { id: 'inv-bm-3', capacityKW: 3.6, brand: 'Solis / Vsole', series: 'Dual MPPT On-Grid', phase: '1-Phase / Dual MPPT', benchmarkPrice: 33500 },
      { id: 'inv-bm-4', capacityKW: 5.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 42000 },
      { id: 'inv-bm-5', capacityKW: 6.0, brand: 'Sunvine Smart Series', series: '3-Phase Smart MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 48500 },
      { id: 'inv-bm-6', capacityKW: 10.0, brand: 'Growatt / Deye', series: '3-Phase Dual MPPT On-Grid', phase: '3-Phase / Multi MPPT', benchmarkPrice: 72000 },
      { id: 'inv-bm-7', capacityKW: 50.0, brand: 'Solis Cloud Series', series: 'Commercial 3-Phase Grid-Tied', phase: '3-Phase / 4-MPPT', benchmarkPrice: 245000 },
      { id: 'inv-bm-8', capacityKW: 125.0, brand: 'Solaryaan / Vsole', series: 'Industrial String Inverter', phase: '3-Phase / 6-MPPT', benchmarkPrice: 580000 },
    ]);
  });

  // Bill of Materials (BOM) Master Catalog (Live Supabase & Reactive Sync)
  const [bomCatalog, setBomCatalog] = useState(() => {
    return safeJsonParse('sunvine_bom_catalog', STANDARD_BOM_CATALOG);
  });

  // Standard BOM Item Rates (Admin Configurable)
  const defaultBomRates = useMemo(() => {
    return (bomCatalog || STANDARD_BOM_CATALOG).reduce((acc, item) => {
      acc[item.id] = item.defaultRate || item.rate || 100;
      return acc;
    }, {});
  }, [bomCatalog]);

  const [bomRates, setBomRates] = useState(() => {
    if (!isDbUpToDate) return defaultBomRates;
    return safeJsonParse('sunvine_bom_rates', defaultBomRates);
  });

  // Standard Capacity-Wise BOM Quantities (Admin Configurable)
  const [capacityBomMatrix, setCapacityBomMatrix] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_CAPACITY_BOM;
    return safeJsonParse('sunvine_capacity_bom', DEFAULT_CAPACITY_BOM);
  });

  // Reusable Solar BOM Kits & Presets (Field-Grade)
  const [kitsPresets, setKitsPresets] = useState(() => {
    return safeJsonParse('sunvine_solar_kits_presets_v2', [
      {
        id: 'kit-standard-3_3kw',
        name: '3.3 kW Standard 6-Panel HDGI Kit (Field Sheet)',
        capacityKw: 3.3,
        createdBy: 'Sunvine HO',
        creatorRole: 'admin',
        items: generateFieldBOM({ kw: 3.3, panelWatt: 540, panelQuantity: 6, ratePerWp: 18.00 })
      },
      {
        id: 'kit-standard-4_4kw',
        name: '4.4 kW Standard 8-Panel HDGI Kit',
        capacityKw: 4.4,
        createdBy: 'Sunvine HO',
        creatorRole: 'admin',
        items: generateFieldBOM({ kw: 4.4, panelWatt: 550, panelQuantity: 8, ratePerWp: 18.00 })
      },
      {
        id: 'kit-standard-5_5kw',
        name: '5.5 kW 10-Panel High-Rise HDGI Kit',
        capacityKw: 5.5,
        createdBy: 'Sunvine HO',
        creatorRole: 'admin',
        items: generateFieldBOM({ kw: 5.5, panelWatt: 550, panelQuantity: 10, ratePerWp: 18.00 })
      }
    ]);
  });

  useEffect(() => {
    safeSetItem('sunvine_solar_kits_presets_v2', kitsPresets);
  }, [kitsPresets]);

  // Load kits & dealer custom prices from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const remoteKits = await pricingService.getKitsPresets();
        if (isMounted && remoteKits && remoteKits.length > 0) {
          setKitsPresets(prev => {
            const merged = [...remoteKits];
            prev.forEach(p => {
              if (!merged.some(m => m.id === p.id)) merged.push(p);
            });
            return merged;
          });
        }
      } catch (_) {}

      try {
        const remotePricings = await pricingService.getAllDealerPricings();
        if (isMounted && remotePricings && Object.keys(remotePricings).length > 0) {
          setDealers(prev => prev.map(d => {
            const remoteCfg = remotePricings[d.id] || remotePricings[d.dealerCode];
            if (remoteCfg) {
              return { ...d, pricingConfig: { ...(d.pricingConfig || {}), ...remoteCfg } };
            }
            return d;
          }));
        }
      } catch (_) {}
    })();
    return () => { isMounted = false; };
  }, []);

  // Catalog items viewed by dealer (for "NEW" badge management)
  const [seenCatalogItemIds, setSeenCatalogItemIds] = useState(() => {
    return safeJsonParse('sunvine_seen_catalog_items', []);
  });

  // Quotations List (Live Supabase Database)
  const [quotations, setQuotations] = useState(() => {
    return safeJsonParse('sunvine_quotations', []);
  });

  // Active quotation loaded in 4-Page Preview
  const [previewQuotation, setPreviewQuotation] = useState(() => {
    return safeJsonParse('sunvine_preview_quotation', null);
  });

  // Active quotation loaded for Editing in CreateQuotation
  const [editingQuotation, setEditingQuotation] = useState(null);

  // Active in-progress draft quotation for multi-step navigation persistence (SR-36)
  const [activeDraftQuote, setActiveDraftQuote] = useState(null);
  const clearActiveDraftQuote = () => {
    setActiveDraftQuote(null);
  };

  // Current Logged-in Staff Member
  const [currentStaff, setCurrentStaff] = useState(() => {
    return safeJsonParse('sunvine_current_staff', DEFAULT_STAFF[0]);
  });

  // Sales Staff Directory (Managed by Admin, logged in by Staff)
  const [staffList, setStaffList] = useState(() => {
    return safeJsonParse('sunvine_staff_list', DEFAULT_STAFF);
  });

  const ensureCustomerFileAttribution = (files) => {
    return (files || []).map((f, idx) => {
      if (!f) return f;
      const hasDealer = Boolean(f.dealerId || f.dealerName);
      const rawSource = (f.sourceType || f.source || '').toUpperCase();
      const sourceType = rawSource.includes('DIRECT') ? 'DIRECT_STAFF' : (rawSource === 'DEALER' || hasDealer ? 'DEALER' : (idx % 2 === 0 ? 'DIRECT_STAFF' : 'DEALER'));
      const rawFinance = (f.financeType || '').toUpperCase();
      const financeType = rawFinance === 'LOAN' || Boolean(f.loanBank) ? 'LOAN' : (rawFinance === 'CASH' ? 'CASH' : (idx % 3 === 0 ? 'LOAN' : 'CASH'));
      const loanBank = financeType === 'LOAN' ? (f.loanBank || 'State Bank of India') : null;
      return {
        ...f,
        sourceType,
        financeType,
        loanBank
      };
    });
  };

  // Customer Files Pipeline (Synchronized between Admin and Sales Staff)
  const [customerFiles, setCustomerFiles] = useState(() => {
    const raw = safeJsonParse('sunvine_customer_files', DEFAULT_CUSTOMER_FILES);
    const base = (Array.isArray(raw) && raw.length > 0) ? raw : DEFAULT_CUSTOMER_FILES;
    return ensureCustomerFileAttribution(base);
  });

  // Master Dynamic System Settings
  const [systemSettings, setSystemSettings] = useState(() => {
    return safeJsonParse('sunvine_system_settings', DEFAULT_SYSTEM_SETTINGS);
  });

  // Dynamic Required Documents Management (Categorized: Residential, Commercial, Common Meter)
  const [requiredDocuments, setRequiredDocuments] = useState(() => {
    const raw = safeJsonParse('sunvine_required_documents', null);
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return systemSettings?.requiredDocuments || DEFAULT_REQUIRED_DOCUMENTS;
  });

  useEffect(() => {
    safeSetItem('sunvine_required_documents', requiredDocuments);
  }, [requiredDocuments]);

  // Master Dynamic Application / Pipeline Stages State
  const [applicationStages, setApplicationStages] = useState(() => {
    const raw = safeJsonParse('sunvine_application_stages', null);
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return systemSettings?.fileLifecycle?.stagesDetailed || DEFAULT_PIPELINE_STAGES;
  });

  useEffect(() => {
    safeSetItem('sunvine_application_stages', applicationStages);
  }, [applicationStages]);

  // Immutable Audit Activity Ledger
  const [auditLogs, setAuditLogs] = useState(() => {
    return safeJsonParse('sunvine_audit_logs', INITIAL_AUDIT_LOGS);
  });

  // 2D and 3D Solar CAD Design Records
  const [designRecords, setDesignRecords] = useState(() => {
    return safeJsonParse('sunvine_design_records', []);
  });

  // System & Compliance Notifications
  const [notifications, setNotifications] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_NOTIFICATIONS;
    const parsed = safeJsonParse('sunvine_notifications', DEFAULT_NOTIFICATIONS);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : DEFAULT_NOTIFICATIONS;
  });

  useEffect(() => {
    safeSetItem('sunvine_db_version', DB_VERSION);
  }, []);

  // Multi-tab real-time storage synchronization (SR-52)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        switch (e.key) {
          case 'sunvine_modules':
            setModulesList(parsed);
            break;
          case 'sunvine_inverters':
            setInvertersList(parsed);
            break;
          case 'sunvine_notifications':
            setNotifications(parsed);
            break;
          case 'sunvine_dealers':
            setDealers(parsed);
            break;
          case 'sunvine_pricing_master':
            setPricingMaster(parsed);
            break;
          case 'sunvine_pricing_presets':
            setPricingPresets(parsed);
            break;
          case 'sunvine_tier_margins':
            setTierMargins(parsed);
            break;
          case 'sunvine_governance_settings':
            setGovernanceSettings(parsed);
            break;
          case 'sunvine_quotations':
            setQuotations(parsed);
            break;
          case 'sunvine_seen_catalog_items':
            setSeenCatalogItemIds(parsed);
            break;
          case 'sunvine_staff_list':
            setStaffList(parsed);
            break;
          case 'sunvine_customer_files':
            setCustomerFiles(parsed);
            break;
          case 'sunvine_system_settings':
            setSystemSettings(parsed);
            break;
          case 'sunvine_audit_logs':
            setAuditLogs(parsed);
            break;
          case 'sunvine_design_records':
            setDesignRecords(parsed);
            break;
          default:
            break;
        }
      } catch (err) {
        // Non-JSON or parse error
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Synchronize state with localStorage
  useEffect(() => {
    safeSetItem('sunvine_auth', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  useEffect(() => {
    safeSetItem('sunvine_role', role);
  }, [role]);

  useEffect(() => {
    safeSetItem('sunvine_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    safeSetItem('sunvine_current_dealer', currentDealer);
  }, [currentDealer]);

  useEffect(() => {
    safeSetItem('sunvine_pricing_master', pricingMaster);
  }, [pricingMaster]);

  useEffect(() => {
    safeSetItem('sunvine_pricing_presets', pricingPresets);
  }, [pricingPresets]);

  useEffect(() => {
    safeSetItem('sunvine_bos_price_matrix', pdfBosMatrix);
  }, [pdfBosMatrix]);

  useEffect(() => {
    safeSetItem('sunvine_modules', modulesList);
  }, [modulesList]);

  useEffect(() => {
    safeSetItem('sunvine_inverters', invertersList);
  }, [invertersList]);

  useEffect(() => {
    safeSetItem('sunvine_dealers', dealers);
  }, [dealers]);

  useEffect(() => {
    safeSetItem('sunvine_quotations', quotations);
  }, [quotations]);

  useEffect(() => {
    if (previewQuotation) {
      safeSetItem('sunvine_preview_quotation', previewQuotation);
    }
  }, [previewQuotation]);

  useEffect(() => {
    safeSetItem('sunvine_notifications', notifications);
  }, [notifications]);

  useEffect(() => {
    safeSetItem('sunvine_bom_rates', bomRates);
  }, [bomRates]);

  useEffect(() => {
    safeSetItem('sunvine_bom_catalog', bomCatalog);
  }, [bomCatalog]);

  useEffect(() => {
    safeSetItem('sunvine_capacity_bom', capacityBomMatrix);
  }, [capacityBomMatrix]);

  useEffect(() => {
    safeSetItem('sunvine_seen_catalog_items', seenCatalogItemIds);
  }, [seenCatalogItemIds]);

  useEffect(() => {
    safeSetItem('sunvine_current_staff', currentStaff);
  }, [currentStaff]);

  useEffect(() => {
    safeSetItem('sunvine_staff_list', staffList);
  }, [staffList]);

  useEffect(() => {
    safeSetItem('sunvine_customer_files', customerFiles);
  }, [customerFiles]);

  useEffect(() => {
    safeSetItem('sunvine_system_settings', systemSettings);
  }, [systemSettings]);

  useEffect(() => {
    safeSetItem('sunvine_audit_logs', auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    safeSetItem('sunvine_design_records', designRecords);
  }, [designRecords]);

  const updateBomItemRate = (itemId, newRate) => {
    setBomRates(prev => ({
      ...prev,
      [itemId]: Number(newRate) || 0
    }));
  };

  const updateCapacityBomItemQty = (capacityKW, itemId, qty) => {
    const kwKey = parseFloat(capacityKW).toFixed(1);
    setCapacityBomMatrix(prev => {
      const existing = prev[kwKey] || prev['3.3'] || { capacityKW: parseFloat(capacityKW), items: {} };
      return {
        ...prev,
        [kwKey]: {
          ...existing,
          capacityKW: parseFloat(capacityKW),
          items: {
            ...existing.items,
            [itemId]: Math.max(0, Number(qty) || 0)
          }
        }
      };
    });
  };

  const updateCapacityBomPreset = (capacityKW, newPreset) => {
    const kwKey = parseFloat(capacityKW).toFixed(1);
    setCapacityBomMatrix(prev => ({
      ...prev,
      [kwKey]: newPreset
    }));
  };

  const addBomItem = async (newItem) => {
    const item = {
      id: newItem.id || `bom_hw_${Date.now()}`,
      category: newItem.category || 'structure',
      name: (newItem.name || 'New Hardware Component').trim(),
      description: newItem.description || '',
      unit: newItem.unit || 'Nos',
      defaultRate: Number(newItem.defaultRate || newItem.rate) || 100,
      make: newItem.make || 'Approved Brand',
      specs: newItem.specs || '',
      gstRate: Number(newItem.gstRate !== undefined ? newItem.gstRate : 18),
      isArchived: false,
      isNew: true,
      createdAt: Date.now()
    };

    setBomCatalog(prev => [item, ...(prev || []).filter(i => i.id !== item.id)]);
    setBomRates(prev => ({ ...prev, [item.id]: item.defaultRate }));

    // Persist directly to Supabase DB
    await hardwareService.saveBomItem(item);

    addNotification({
      type: 'success',
      icon: 'inventory_2',
      title: 'BOM Hardware Item Added',
      description: `Admin introduced ${item.name} (${item.make}) to master bill of materials.`,
      audience: 'all'
    });

    return item;
  };

  const updateBomItem = async (itemId, updatedFields) => {
    setBomCatalog(prev => prev.map(i => i.id === itemId ? { ...i, ...updatedFields } : i));
    if (updatedFields.defaultRate !== undefined || updatedFields.rate !== undefined) {
      const newRate = Number(updatedFields.defaultRate || updatedFields.rate) || 0;
      setBomRates(prev => ({ ...prev, [itemId]: newRate }));
    }
    const current = (bomCatalog || []).find(i => i.id === itemId);
    const merged = { ...current, ...updatedFields, id: itemId };
    await hardwareService.saveBomItem(merged);
  };

  const deleteBomItem = async (itemId) => {
    setBomCatalog(prev => prev.filter(i => i.id !== itemId));
    setBomRates(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    await hardwareService.deleteBomItem(itemId);
  };

  const archiveBomItem = async (itemId, isArchived) => {
    setBomCatalog(prev => prev.map(i => i.id === itemId ? { ...i, isArchived } : i));
    await hardwareService.archiveBomItem(itemId, isArchived);
  };

  const addNewModule = async (newModule) => {
    const brand = newModule.brand?.trim() || 'Custom';
    const model = newModule.model?.trim() || 'Solar Module';
    const id = newModule.id || `mod-${Date.now()}`;
    const moduleEntry = {
      id,
      brand,
      model,
      cellTech: newModule.cellTech || 'N-Type TOPCon',
      wattage: Number(newModule.wattage) || 550,
      efficiency: newModule.efficiency || '22.0%',
      ratePerWp: newModule.ratePerWp ? (typeof newModule.ratePerWp === 'number' ? `₹ ${newModule.ratePerWp.toFixed(2)}/Wp` : newModule.ratePerWp) : '₹ 19.50/Wp',
      warranty: newModule.warranty || '30 Yrs',
      dimensions: newModule.dimensions || '2278 × 1134 × 30 mm | 28 kg',
      isNew: true,
      createdAt: Date.now()
    };
    setModulesList(prev => [moduleEntry, ...prev]);
    addNotification({
      type: 'success',
      icon: 'solar_power',
      title: 'New Solar Module Added',
      description: `Admin introduced ${brand} ${model} (${moduleEntry.wattage}W) to dealer catalogs.`,
      audience: 'all'
    });
    // Sync directly to Supabase DB
    await hardwareService.saveModule(moduleEntry);
    return moduleEntry;
  };

  const addNewInverter = async (newInverter) => {
    const brand = newInverter.brand?.trim() || 'Custom';
    const model = newInverter.model?.trim() || 'Solar Inverter';
    const id = newInverter.id || `inv-${Date.now()}`;
    const capStr = newInverter.capacity ? (String(newInverter.capacity).toLowerCase().includes('kw') ? newInverter.capacity : `${newInverter.capacity} kW`) : '5.0 kW';
    const inverterEntry = {
      id,
      brand,
      model,
      capacity: capStr,
      capacityKW: parseFloat(capStr.replace(/[^0-9.]/g, '')) || 5.0,
      phase: newInverter.phase || '1-Phase 230V / 2 MPPT',
      efficiency: newInverter.efficiency || '98.5%',
      warranty: newInverter.warranty || '8 Years',
      basePrice: newInverter.basePrice || '₹ 54,000',
      cloud: newInverter.cloud || 'Integrated Wi-Fi',
      isNew: true,
      createdAt: Date.now()
    };
    setInvertersList(prev => [inverterEntry, ...prev]);
    addNotification({
      type: 'success',
      icon: 'bolt',
      title: 'New Solar Inverter Added',
      description: `Admin introduced ${brand} ${model} (${inverterEntry.capacity}) to dealer catalogs.`,
      audience: 'all'
    });
    // Sync directly to Supabase DB
    await hardwareService.saveInverter(inverterEntry);
    return inverterEntry;
  };

  const markCatalogItemSeen = (itemId) => {
    if (!itemId) return;
    setSeenCatalogItemIds(prev => {
      if (prev.includes(itemId)) return prev;
      return [...prev, itemId];
    });
  };

  const isCatalogItemNew = (item) => {
    if (!item) return false;
    const itemId = item.id || `${item.brand}-${item.model}`;
    if (seenCatalogItemIds.includes(itemId)) return false;
    if (item.isNew) return true;
    if (item.createdAt && (Date.now() - item.createdAt < 7 * 24 * 3600 * 1000)) return true;
    return false;
  };

  const getResolvedBom = (capacityKW) => {
    return resolveCapacityBom(capacityKW, capacityBomMatrix, bomRates, bomCatalog);
  };

  // Auth Actions
  const login = (userRole, userProfile = null) => {
    setIsAuthenticated(true);
    setRole(userRole);
    if (userRole === 'admin') {
      setActiveTab('admin_dashboard');
    } else if (userRole === 'staff') {
      const isVerification = Boolean(
        userProfile?.role?.toLowerCase().includes('verification') ||
        userProfile?.department === 'verification' ||
        userProfile?.id === 'STF-003'
      );
      setActiveTab(isVerification ? 'verification_desk' : 'staff_dashboard');
      if (userProfile) setCurrentStaff(userProfile);
    } else {
      setActiveTab('dashboard');
      if (userProfile) setCurrentDealer(userProfile);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAuthView('dealer_login');
    localStorage.removeItem('sunvine_auth');
    localStorage.removeItem('sunvine_current_staff');
    authService.logout().catch(() => {});
  };

  // Staff and Customer File Actions
  const addStaff = async (newStaff) => {
    setStaffList(prev => [newStaff, ...prev]);
    try {
      await staffService.createStaff(newStaff);
    } catch (e) {
      console.warn('[AppContext] Failed to sync staff to DB:', e);
    }
  };

  const updateStaff = async (staffId, updatedFields) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, ...updatedFields } : s));
    if (currentStaff?.id === staffId) {
      setCurrentStaff(prev => ({ ...prev, ...updatedFields }));
    }
    try {
      await staffService.updateStaff(staffId, updatedFields);
    } catch (e) {
      console.warn('[AppContext] Failed to update staff in DB:', e);
    }
  };

  const updateStaffPassword = async (staffId, newPassword) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, password: newPassword } : s));
    try {
      await staffService.updateStaffPassword(staffId, newPassword);
    } catch (e) {
      console.warn('[AppContext] Failed to update staff password in DB:', e);
    }
  };

  const deleteStaff = async (staffId) => {
    setStaffList(prev => prev.filter(s => s.id !== staffId));
    try {
      await staffService.deleteStaff(staffId);
    } catch (e) {
      console.warn('[AppContext] Failed to delete staff in DB:', e);
    }
    logActivity({
      action: 'DELETE_STAFF',
      module: 'STAFF_MANAGEMENT',
      recordId: staffId,
      details: `Admin deleted staff member ${staffId} from organization register.`
    });
  };

  const addCustomerFile = async (newFile) => {
    setCustomerFiles(prev => [newFile, ...prev]);
    customerFileService.saveCustomerFile(newFile);
    // Also update staff totalFiles and pipelineKw
    if (newFile.staffId) {
      setStaffList(prev => prev.map(s => s.id === newFile.staffId ? {
        ...s,
        totalFiles: (s.totalFiles || 0) + 1,
        pipelineKw: Number(((s.pipelineKw || 0) + (newFile.solarSystemKw || 0)).toFixed(1))
      } : s));
    }
    try {
      await customerFileService.saveCustomerFile(newFile);
    } catch (e) {
      console.warn('[AppContext] Failed to save customer file to DB:', e);
    }
  };

  const logActivity = (logEntry) => {
    const newLog = {
      id: logEntry.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: logEntry.action || 'SYSTEM_ACTION',
      module: logEntry.module || 'SYSTEM',
      recordId: logEntry.recordId || '-',
      userId: logEntry.userId || (role === 'admin' ? 'ADM-001' : role === 'staff' ? currentStaff?.id : currentDealer?.id),
      userName: logEntry.userName || (role === 'admin' ? 'Super Admin Desk' : role === 'staff' ? currentStaff?.name : currentDealer?.contactPerson),
      role: logEntry.role || (role === 'admin' ? 'System Administrator' : role === 'staff' ? 'Staff Executive' : 'Authorized Dealer'),
      details: logEntry.details || '',
      oldValue: logEntry.oldValue !== undefined ? logEntry.oldValue : null,
      newValue: logEntry.newValue !== undefined ? logEntry.newValue : null,
      ipAddress: '192.168.1.104',
      status: 'VERIFIED'
    };
    setAuditLogs(prev => [newLog, ...(prev || [])]);
    settingsService.logActivity(newLog);
  };

  const updateSystemSettings = async (section, updates) => {
    let updatedSectionData = null;
    setSystemSettings(prev => {
      const currentSection = prev?.[section] || {};
      const updatedSection = { ...currentSection, ...updates };
      updatedSectionData = updatedSection;
      const updated = {
        ...prev,
        [section]: updatedSection
      };
      safeSetItem('sunvine_system_settings', updated);
      return updated;
    });

    if (updatedSectionData) {
      try {
        await settingsService.saveSystemSettings(section, updatedSectionData);
      } catch (e) {
        console.warn('[AppContext] Failed to sync system settings to DB:', e);
      }
    }

    logActivity({
      action: 'UPDATE_SYSTEM_SETTINGS',
      module: 'SETTINGS',
      recordId: section,
      details: `Updated settings configuration for section: ${section}`,
      newValue: updates
    });

    addNotification({
      type: 'info',
      icon: 'tune',
      title: 'System Settings Updated',
      description: `Configuration changes saved for ${section}.`,
      audience: 'admin'
    });
  };

  const saveDesignRecord = (designData) => {
    const recordId = designData.id || `DSGN-${Date.now()}`;
    const newRecord = {
      ...designData,
      id: recordId,
      version: designData.version || 1,
      createdAt: designData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDesignRecords(prev => {
      const existingIdx = (prev || []).findIndex(d => d.id === recordId || (d.quotationId && d.quotationId === designData.quotationId));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...newRecord, version: (copy[existingIdx].version || 1) + 1 };
        return copy;
      }
      return [newRecord, ...(prev || [])];
    });

    logActivity({
      action: 'SAVE_SOLAR_DESIGN',
      module: 'DESIGN_CAD',
      recordId,
      details: `Solar ${designData.type || '2D'} CAD design layout saved for quotation ${designData.quotationId || 'Unlinked'}`
    });

    return newRecord;
  };

  const addCustomerFileTimelineEvent = async (fileId, event) => {
    const timestamp = new Date().toISOString();
    const newMilestone = {
      id: event.id || `TL-${Date.now()}`,
      timestamp,
      date: timestamp.split('T')[0],
      stage: event.stage || 'STAGE_UPDATE',
      title: event.title || event.stage || 'Milestone Reached',
      status: event.status || 'In Progress',
      action: event.action || 'STAGE_PROGRESSION',
      actor: event.actor || (role === 'admin' ? 'Admin Ops' : currentStaff?.name || 'Staff Representative'),
      notes: event.notes || ''
    };

    let targetUpdatedFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [...(f.timeline || []), newMilestone];
      targetUpdatedFile = {
        ...f,
        currentStage: event.stage || f.currentStage,
        stage: event.stage || f.stage,
        status: event.status || f.status,
        isCompleted: event.isCompleted !== undefined ? event.isCompleted : f.isCompleted,
        isFailed: event.isFailed !== undefined ? event.isFailed : f.isFailed,
        failureReason: event.failureReason || f.failureReason,
        timeline: updatedTimeline
      };
      return targetUpdatedFile;
    }));

    if (targetUpdatedFile) {
      try {
        await customerFileService.updateCustomerFile(fileId, targetUpdatedFile);
      } catch (e) {
        console.warn('[AppContext] Failed to update file timeline in DB:', e);
      }
    }

    logActivity({
      action: 'ADD_FILE_TIMELINE_EVENT',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Added timeline milestone [${newMilestone.title}]: ${newMilestone.notes || 'Status updated'}`,
      newValue: event.status || event.stage
    });
  };

  const updateCustomerFile = async (fileId, updatedFields) => {
    setCustomerFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updatedFields } : f));
    try {
      await customerFileService.updateCustomerFile(fileId, updatedFields);
    } catch (e) {
      console.warn('[AppContext] Failed to update customer file in DB:', e);
    }
    logActivity({
      action: 'UPDATE_CUSTOMER_FILE',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Updated customer file attributes`,
      newValue: Object.keys(updatedFields).join(', ')
    });
  };

  const updateFileStatus = async (fileId, nextStatus, notes = '') => {
    let targetUpdatedFile = null;
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedTimeline = [
        ...(f.timeline || []),
        {
          id: `TL-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          stage: f.currentStage,
          title: `Status changed to ${nextStatus}`,
          status: nextStatus,
          action: 'STATUS_CHANGE',
          actor: role === 'admin' ? 'Admin Desk' : currentStaff?.name || 'Staff Representative',
          notes: notes || `Status changed from ${f.status} to ${nextStatus}`
        }
      ];
      targetUpdatedFile = {
        ...f,
        status: nextStatus,
        isCompleted: nextStatus === 'Subsidized' || nextStatus === 'Completed',
        timeline: updatedTimeline
      };
      return targetUpdatedFile;
    }));

    if (targetUpdatedFile) {
      try {
        await customerFileService.updateCustomerFile(fileId, targetUpdatedFile);
      } catch (e) {
        console.warn('[AppContext] Failed to update file status in DB:', e);
      }
    }

    logActivity({
      action: 'UPDATE_FILE_STATUS',
      module: 'CUSTOMER_FILE',
      recordId: fileId,
      details: `Status updated to ${nextStatus}`,
      newValue: nextStatus
    });
  };

  const updateDealerProfile = async (updatedFields) => {
    const updated = { ...currentDealer, ...updatedFields };
    setCurrentDealer(updated);
    setDealers(prev => prev.map(d => d.id === currentDealer.id ? updated : d));
    try {
      await dealerService.updateDealer(currentDealer.id || currentDealer.dealerCode, updatedFields);
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer profile in DB:', e);
    }
  };

  // Quotation Actions
  const addQuotation = (newQuote) => {
    const updated = [newQuote, ...quotations];
    setQuotations(updated);
    setPreviewQuotation(newQuote);
    // Sync directly to Supabase DB
    quotationService.saveQuotation(newQuote);
  };

  const updateQuotation = (updatedQuote) => {
    setQuotations(prev => {
      const exists = prev.some(q => q.id === updatedQuote.id);
      if (exists) {
        return prev.map(q => q.id === updatedQuote.id ? { ...q, ...updatedQuote } : q);
      }
      return [updatedQuote, ...prev];
    });
    setPreviewQuotation(updatedQuote);
    setEditingQuotation(null);
    // Sync directly to Supabase DB
    quotationService.saveQuotation(updatedQuote);
  };

  const startEditingQuotation = (quote) => {
    setEditingQuotation(quote);
    setActiveTab('create_quote');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    }
  };

  const clearEditingQuotation = () => {
    setEditingQuotation(null);
  };

  const updateQuotationStatus = (id, newStatus) => {
    setQuotations(prev => {
      const updated = prev.map(q => q.id === id ? { ...q, status: newStatus } : q);
      const target = updated.find(q => q.id === id);
      if (target) {
        quotationService.saveQuotation(target);
      }
      return updated;
    });
  };

  const addDealer = async (newDealer) => {
    setDealers(prev => [newDealer, ...prev]);
    try {
      await dealerService.createDealer(newDealer);
    } catch (e) {
      console.warn('[AppContext] Failed to create dealer in DB:', e);
    }
  };

  const updateDealer = async (updatedDealer) => {
    setDealers(prev => prev.map(d => d.id === updatedDealer.id ? { ...d, ...updatedDealer } : d));
    if (currentDealer?.id === updatedDealer.id) {
      setCurrentDealer(prev => ({ ...prev, ...updatedDealer }));
    }
    try {
      await dealerService.updateDealer(updatedDealer.id || updatedDealer.dealerCode, updatedDealer);
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer in DB:', e);
    }
  };

  const toggleDealerStatus = async (id) => {
    let nextStatus = 'Active';
    setDealers(prev => prev.map(d => {
      if (d.id === id) {
        nextStatus = d.status === 'Active' ? 'Suspended' : 'Active';
        return { ...d, status: nextStatus };
      }
      return d;
    }));
    try {
      await dealerService.updateDealer(id, { status: nextStatus });
    } catch (e) {
      console.warn('[AppContext] Failed to toggle dealer status in DB:', e);
    }
  };

  const updateDealerMarginCap = async (id, newCap) => {
    const numericCap = Number(newCap);
    setDealers(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, maxMarginCapPerKw: numericCap } : d);
      safeSetItem('sunvine_dealers', updated);
      return updated;
    });
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, maxMarginCapPerKw: numericCap }));
    }
    try {
      await dealerService.updateDealer(id, { maxMarginCapPerKw: numericCap });
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer margin in DB:', e);
    }
  };

  const updateDealerPassword = async (id, newPassword) => {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, password: newPassword } : d));
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, password: newPassword }));
    }
    try {
      await authService.updatePassword('dealer', id, newPassword);
    } catch (e) {
      console.warn('[AppContext] Failed to update dealer password in DB:', e);
    }
  };

  const deleteDealer = async (id) => {
    setDealers(prev => prev.filter(d => d.id !== id && d.dealerCode !== id));
    if (currentDealer?.id === id) {
      setCurrentDealer(INITIAL_DEALERS[0]);
    }
    try {
      await dealerService.deleteDealer(id);
    } catch (e) {
      console.warn('[AppContext] Failed to delete dealer in DB:', e);
    }
    logActivity({
      action: 'DELETE_DEALER',
      module: 'DEALER_MANAGEMENT',
      recordId: id,
      details: `Admin deleted dealer partner ${id} from network register.`
    });
  };

  // Dynamic Required Documents Management Methods
  const addRequiredDocument = async (newDoc) => {
    const docEntry = {
      id: newDoc.id || `doc-${Date.now()}`,
      key: newDoc.key || `doc_${Date.now()}`,
      label: (newDoc.label || 'New Document').trim(),
      description: (newDoc.description || '').trim(),
      icon: newDoc.icon || 'description',
      categories: Array.isArray(newDoc.categories) && newDoc.categories.length > 0 ? newDoc.categories : ['residential'],
      mandatory: Boolean(newDoc.mandatory),
      allowedExtensions: newDoc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png'],
      captureMode: newDoc.captureMode || 'both'
    };
    const nextList = [...requiredDocuments, docEntry];
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
    return docEntry;
  };

  const updateRequiredDocument = async (docId, updates) => {
    const nextList = requiredDocuments.map(d => d.id === docId ? { ...d, ...updates } : d);
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
  };

  const deleteRequiredDocument = async (docId) => {
    const nextList = requiredDocuments.filter(d => d.id !== docId);
    setRequiredDocuments(nextList);
    updateSystemSettings('requiredDocuments', nextList);
  };

  const resetRequiredDocuments = () => {
    setRequiredDocuments(DEFAULT_REQUIRED_DOCUMENTS);
    updateSystemSettings('requiredDocuments', DEFAULT_REQUIRED_DOCUMENTS);
  };

  // Application Stages Management Handlers
  const addApplicationStage = (stageData) => {
    const newStage = {
      id: stageData.id ? stageData.id.trim() : `STAGE_${Date.now().toString().slice(-4)}`,
      label: stageData.label.trim(),
      description: stageData.description?.trim() || '',
      mandatory: stageData.mandatory !== undefined ? stageData.mandatory : true,
      order: stageData.order || (applicationStages.length + 1)
    };
    const nextList = [...applicationStages, newStage];
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
    return newStage;
  };

  const updateApplicationStage = (stageId, updates) => {
    const nextList = applicationStages.map(s => s.id === stageId ? { ...s, ...updates } : s);
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
  };

  const deleteApplicationStage = (stageId) => {
    const nextList = applicationStages.filter(s => s.id !== stageId);
    setApplicationStages(nextList);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: nextList,
      stages: nextList.map(s => s.label)
    });
  };

  const resetApplicationStages = () => {
    setApplicationStages(DEFAULT_PIPELINE_STAGES);
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: DEFAULT_PIPELINE_STAGES,
      stages: DEFAULT_PIPELINE_STAGES.map(s => s.label)
    });
  };

  const updateDealerPricing = (id, pricingConfig) => {
    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== id) return d;
        const mergedConfig = {
          ...(d.pricingConfig || {}),
          ...pricingConfig
        };
        return {
          ...d,
          pricingConfig: mergedConfig
        };
      });
      safeSetItem('sunvine_dealers', updated);
      return updated;
    });

    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({
        ...prev,
        pricingConfig: {
          ...(prev.pricingConfig || {}),
          ...pricingConfig
        }
      }));
    }

    // Persist to Supabase / offline cache
    pricingService.saveDealerPricing(id, pricingConfig).catch(err => {
      console.warn('[AppContext] saveDealerPricing error:', err);
    });

    logActivity({
      action: 'UPDATE_DEALER_PRICING',
      module: 'DEALER_MANAGEMENT',
      recordId: id,
      details: `Custom pricing configured: Mode=${pricingConfig.pricingMode || 'standard'}, Wp=₹${pricingConfig.customBaseRatePerWp || 'N/A'}, kW=₹${pricingConfig.customBaseRatePerKw || 'N/A'}`
    });
  };

  const updateDealerProductRate = (dealerId, productId, customRate, productMeta = {}) => {
    let updatedConfig = null;
    const numRate = Number(customRate);

    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== dealerId && d.dealerCode !== dealerId) return d;
        const currentCfg = d.pricingConfig || {};
        const currentProductRates = { ...(currentCfg.customProductRates || {}) };
        const currentBomRates = { ...(currentCfg.customBomRates || {}) };
        const productDetails = { ...(currentCfg.productDetails || {}) };

        currentProductRates[productId] = numRate;

        if (productMeta.name) {
          currentProductRates[productMeta.name] = numRate;
        }

        if (productMeta.category === 'bom') {
          currentBomRates[productId] = numRate;
        }

        productDetails[productId] = {
          id: productId,
          name: productMeta.name || productId,
          category: productMeta.category || 'general',
          benchmarkPrice: productMeta.benchmarkPrice || 0,
          customPrice: numRate,
          unit: productMeta.unit || '₹',
          updatedAt: new Date().toISOString()
        };

        updatedConfig = {
          ...currentCfg,
          pricingMode: 'custom',
          customProductRates: currentProductRates,
          customBomRates: currentBomRates,
          productDetails
        };

        return {
          ...d,
          pricingConfig: updatedConfig
        };
      });
      safeSetItem('sunvine_dealers', updated);
      return updated;
    });

    if (updatedConfig) {
      if (currentDealer?.id === dealerId) {
        setCurrentDealer(prev => ({
          ...prev,
          pricingConfig: updatedConfig
        }));
      }

      pricingService.saveDealerPricing(dealerId, updatedConfig).catch(err => {
        console.warn('[AppContext] saveDealerPricing error:', err);
      });

      logActivity({
        action: 'UPDATE_DEALER_PRODUCT_RATE',
        module: 'PRICING_MASTER',
        recordId: dealerId,
        details: `Updated custom price for product "${productMeta.name || productId}": ₹${numRate} (${productMeta.unit || ''}) for dealer ${dealerId}`
      });
    }
  };

  const removeDealerProductRate = (dealerId, productId) => {
    let updatedConfig = null;
    setDealers(prev => {
      const updated = prev.map(d => {
        if (d.id !== dealerId && d.dealerCode !== dealerId) return d;
        const currentCfg = d.pricingConfig || {};
        const currentProductRates = { ...(currentCfg.customProductRates || {}) };
        const currentBomRates = { ...(currentCfg.customBomRates || {}) };
        const productDetails = { ...(currentCfg.productDetails || {}) };

        const removedName = productDetails[productId]?.name;
        delete currentProductRates[productId];
        if (removedName) {
          delete currentProductRates[removedName];
        }
        delete currentBomRates[productId];
        delete productDetails[productId];

        updatedConfig = {
          ...currentCfg,
          customProductRates: currentProductRates,
          customBomRates: currentBomRates,
          productDetails
        };

        return {
          ...d,
          pricingConfig: updatedConfig
        };
      });
      safeSetItem('sunvine_dealers', updated);
      return updated;
    });

    if (updatedConfig) {
      if (currentDealer?.id === dealerId) {
        setCurrentDealer(prev => ({
          ...prev,
          pricingConfig: updatedConfig
        }));
      }

      pricingService.saveDealerPricing(dealerId, updatedConfig).catch(err => {
        console.warn('[AppContext] saveDealerPricing error:', err);
      });

      logActivity({
        action: 'REMOVE_DEALER_PRODUCT_RATE',
        module: 'PRICING_MASTER',
        recordId: dealerId,
        details: `Removed custom negotiated price for product ${productId} on dealer ${dealerId}`
      });
    }
  };

  const saveKitPreset = async (kitData) => {
    const newKit = {
      ...kitData,
      id: kitData.id || `kit-${Date.now()}`,
      createdAt: kitData.createdAt || new Date().toISOString()
    };
    setKitsPresets(prev => {
      const idx = prev.findIndex(k => k.id === newKit.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newKit;
        return copy;
      }
      return [newKit, ...prev];
    });
    try {
      await pricingService.saveKitPreset(newKit);
    } catch (e) {
      console.warn('[AppContext] Failed to sync kit to Supabase:', e);
    }
    return newKit;
  };

  const deleteKitPreset = async (kitId) => {
    setKitsPresets(prev => prev.filter(k => k.id !== kitId));
    try {
      await pricingService.deleteKitPreset(kitId);
    } catch (e) {
      console.warn('[AppContext] Failed to delete kit from Supabase:', e);
    }
  };

  const getAccessibleDealers = () => {
    if (role === 'admin') return dealers;
    if (role === 'staff') {
      const staffId = currentStaff?.id || 'STF-001';
      return dealers.filter(d => (d.assignedStaffId === staffId) || (!d.assignedStaffId && staffId === 'STF-001'));
    }
    if (currentDealer) return [currentDealer];
    return dealers;
  };

  const updatePricingMaster = (newMaster) => {
    setPricingMaster(newMaster);
    safeSetItem('sunvine_pricing_master', newMaster);
  };

  const updatePricingPresets = async (newPresets) => {
    const isDifferent = Object.keys(newPresets || {}).some(key => {
      if (key === 'lastSynced') return false;
      return String(newPresets[key]) !== String(pricingPresets[key]);
    });
    if (!isDifferent) return;

    const timeStr = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
    const updated = {
      ...pricingPresets,
      ...newPresets,
      lastSynced: `Today, ${timeStr} by ${role === 'admin' ? 'Super Admin Desk' : 'Ops'}`
    };
    setPricingPresets(updated);
    safeSetItem('sunvine_pricing_presets', updated);
    pricingService.savePricingPresets(updated);
    try {
      await settingsService.savePricingPresets(updated);
    } catch (e) {
      console.warn('[AppContext] Failed to sync pricing presets to DB:', e);
    }
    addNotification({
      title: 'Quotation Presets Updated',
      description: `Base Rate: ₹${Number(updated.baseRatePerKw).toLocaleString('en-IN')}/kW | Min Margin: ₹${Number(updated.minMarginPerKw).toLocaleString('en-IN')}/kW.`,
      category: 'pricing',
      icon: 'tune'
    });
  };

  const updateTierMargins = async (newTiers) => {
    const isDifferent = Object.keys(newTiers || {}).some(tierKey => {
      const existing = tierMargins?.[tierKey];
      const updated = newTiers[tierKey];
      if (!existing || !updated) return true;
      return Number(existing.defaultMarginPerKw) !== Number(updated.defaultMarginPerKw) ||
             Number(existing.maxMarginCapPerKw) !== Number(updated.maxMarginCapPerKw);
    });
    if (!isDifferent) return;

    const updated = { ...tierMargins, ...newTiers };
    setTierMargins(updated);
    safeSetItem('sunvine_tier_margins', updated);
    pricingService.saveTierMargins(updated);
    try {
      await settingsService.savePricingPresets({ tierMargins: updated });
    } catch (e) {
      console.warn('[AppContext] Failed to sync tier margins to DB:', e);
    }
    addNotification({
      title: 'Dealer Tier Margins Updated',
      description: `Default margin thresholds updated for Diamond, Platinum, Gold & Silver dealer tiers.`,
      category: 'pricing',
      icon: 'price_check',
      audience: 'all'
    });
  };

  const updateGovernanceSettings = async (newSettings) => {
    const isDifferent = Object.keys(newSettings || {}).some(key => {
      return String(newSettings[key]) !== String(governanceSettings?.[key]);
    });
    if (!isDifferent) return;

    const updated = { ...governanceSettings, ...newSettings };
    setGovernanceSettings(updated);
    safeSetItem('sunvine_governance_settings', updated);
    try {
      await settingsService.saveSystemSettings('governanceSettings', updated);
    } catch (e) {
      console.warn('[AppContext] Failed to sync governance settings to DB:', e);
    }

    // If maxDealerMarginPerKW was updated, adjust any tier margin caps that exceed this national ceiling
    if (newSettings.maxDealerMarginPerKW) {
      const ceilingCap = Number(newSettings.maxDealerMarginPerKW);
      setTierMargins(prev => {
        const updatedTiers = { ...prev };
        let modified = false;
        Object.keys(updatedTiers).forEach(key => {
          if (updatedTiers[key] && updatedTiers[key].maxMarginCapPerKw > ceilingCap) {
            updatedTiers[key] = { ...updatedTiers[key], maxMarginCapPerKw: ceilingCap };
            modified = true;
          }
        });
        if (modified) {
          safeSetItem('sunvine_tier_margins', updatedTiers);
        }
        return modified ? updatedTiers : prev;
      });
    }

    addNotification({
      type: 'warning',
      icon: 'shield',
      title: 'Margin Governance & Policy Updated',
      description: `Max dealer margin ceiling set to ₹${Number(updated.maxDealerMarginPerKW).toLocaleString('en-IN')}/kW. Quote expiry: ${updated.quoteExpiryDays} days.`,
      targetTab: 'dealer_settings',
      audience: 'all'
    });
  };

  // Persistent read state IDs keyed by role
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_read_notifs_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Keep readNotifIds in sync if role changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_read_notifs_${role}`);
      setReadNotifIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setReadNotifIds([]);
    }
  }, [role]);

  // Persistent dismissed popup IDs keyed by role
  const [dismissedPopupIds, setDismissedPopupIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_popups_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_popups_${role}`);
      setDismissedPopupIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setDismissedPopupIds([]);
    }
  }, [role]);

  // Persistent dismissed notification IDs across sessions (SR-46)
  const [dismissedNotifIds, setDismissedNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_notifs_${role}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sunvine_dismissed_notifs_${role}`);
      setDismissedNotifIds(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setDismissedNotifIds([]);
    }
  }, [role]);

  const persistReadIds = (ids) => {
    setReadNotifIds(ids);
    safeSetItem(`sunvine_read_notifs_${role}`, ids);
  };

  const dismissPopupNotification = (id) => {
    setDismissedPopupIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      safeSetItem(`sunvine_dismissed_popups_${role}`, updated);
      return updated;
    });
  };

  // Role-partitioned visible notifications with real-time persistent read and dismissal status
  const visibleNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        if (dismissedNotifIds.includes(n.id)) return false;
        const aud = n.audience || 'all';
        if (aud === 'all') return true;
        return aud === role;
      })
      .map(n => ({
        ...n,
        read: readNotifIds.includes(n.id)
      }));
  }, [notifications, role, readNotifIds, dismissedNotifIds]);

  const unreadNotificationsCount = useMemo(() => {
    return visibleNotifications.filter(n => !n.read).length;
  }, [visibleNotifications]);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [selectedChangelogVersion, setSelectedChangelogVersion] = useState(null);

  const openChangelogModal = (version = null) => {
    setSelectedChangelogVersion(version);
    setIsChangelogModalOpen(true);
  };

  const markNotificationAsRead = (id) => {
    if (!readNotifIds.includes(id)) {
      persistReadIds([...readNotifIds, id]);
    }
  };

  const markAllNotificationsAsRead = () => {
    const allVisibleIds = visibleNotifications.map(n => n.id);
    const merged = Array.from(new Set([...readNotifIds, ...allVisibleIds]));
    persistReadIds(merged);
  };

  const deleteNotification = (id) => {
    setDismissedNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      safeSetItem(`sunvine_dismissed_notifs_${role}`, updated);
      return updated;
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    const visibleIds = visibleNotifications.map(n => n.id);
    setDismissedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...visibleIds]));
      safeSetItem(`sunvine_dismissed_notifs_${role}`, updated);
      return updated;
    });
    setNotifications(prev => prev.filter(n => !visibleIds.includes(n.id)));
  };

  const addNotification = (notif) => {
    const newNotif = {
      id: notif.id || `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
      audience: notif.audience || (role === 'admin' ? 'admin' : 'dealer'),
      type: notif.type || 'info',
      ...notif
    };
    // If a new or updated notification arrives, remove from dismissed IDs so popup shows
    setDismissedPopupIds(prev => {
      const updated = prev.filter(id => id !== newNotif.id);
      safeSetItem(`sunvine_dismissed_popups_${role}`, updated);
      return updated;
    });
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== newNotif.id);
      return [newNotif, ...filtered];
    });
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        authView,
        setAuthView,
        login,
        logout,
        role,
        setRole,
        activeTab,
        setActiveTab,
        currentDealer,
        setCurrentDealer,
        updateDealerProfile,
        currentStaff,
        setCurrentStaff,
        staffList,
        setStaffList,
        customerFiles,
        setCustomerFiles,
        addStaff,
        updateStaff,
        updateStaffPassword,
        deleteStaff,
        addCustomerFile,
        updateCustomerFile,
        updateFileStatus,
        pricingMaster,
        updatePricingMaster,
        pricingPresets,
        updatePricingPresets,
        tierMargins,
        updateTierMargins,
        governanceSettings,
        updateGovernanceSettings,
        modulesList,
        setModulesList,
        invertersList,
        setInvertersList,
        isHardwareDbSyncing,
        isHardwareDbConnected,
        hardwareService,
        dealers,
        addDealer,
        updateDealer,
        deleteDealer,
        toggleDealerStatus,
        updateDealerMarginCap,
        updateDealerPassword,
        updateDealerPricing,
        updateDealerProductRate,
        removeDealerProductRate,
        getAccessibleDealers,
        kitsPresets,
        saveKitPreset,
        deleteKitPreset,
        quotations,
        addQuotation,
        updateQuotation,
        editingQuotation,
        startEditingQuotation,
        clearEditingQuotation,
        activeDraftQuote,
        setActiveDraftQuote,
        clearActiveDraftQuote,
        updateQuotationStatus,
        previewQuotation,
        setPreviewQuotation,
        notifications: visibleNotifications,
        unreadNotificationsCount,
        notificationsOpen,
        setNotificationsOpen,
        isChangelogModalOpen,
        setIsChangelogModalOpen,
        selectedChangelogVersion,
        openChangelogModal,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        addNotification,
        dismissedPopupIds,
        dismissPopupNotification,
        dismissedNotifIds,
        pdfBosMatrix,
        setPdfBosMatrix,
        inverterBenchmarkMatrix,
        setInverterBenchmarkMatrix,
        pdfBomSpecs: PDF_BOM_SPECIFICATIONS,
        officialProfile: SUNVINE_OFFICIAL_PROFILE,
        // Standard BOM & BoS Engine
        bomCatalog,
        setBomCatalog,
        bomCategories: STANDARD_BOM_CATEGORIES,
        bomRates,
        setBomRates,
        updateBomItemRate,
        capacityBomMatrix,
        updateCapacityBomItemQty,
        updateCapacityBomPreset,
        getResolvedBom,
        addBomItem,
        updateBomItem,
        deleteBomItem,
        archiveBomItem,
        // Dynamic Catalogs & 'NEW' Badge Tracking
        addNewModule,
        addNewInverter,
        seenCatalogItemIds,
        markCatalogItemSeen,
        isCatalogItemNew,
        // Master System Settings & Policies
        systemSettings,
        updateSystemSettings,
        // Dynamic Required Documents Management
        requiredDocuments,
        addRequiredDocument,
        updateRequiredDocument,
        deleteRequiredDocument,
        resetRequiredDocuments,
        applicationCategories: APPLICATION_CATEGORIES,
        isDocMandatoryForCategory,
        // Master Dynamic Application Stages
        applicationStages,
        addApplicationStage,
        updateApplicationStage,
        deleteApplicationStage,
        resetApplicationStages,
        // Immutable Audit Activity Ledger
        auditLogs,
        logActivity,
        // Solar CAD Designs
        designRecords,
        saveDesignRecord,
        // Customer File Timeline Progression
        addCustomerFileTimelineEvent,
        // Solar Loan Partner Banks
        solarBanks
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
