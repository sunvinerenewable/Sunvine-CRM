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
  DEFAULT_CUSTOMER_FILES
} from '../data/staffData';

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
  profile: '/settings',
  dealer_settings: '/settings',
  admin_dashboard: '/admin',
  dealers_mgmt: '/admin/dealers',
  staff_mgmt: '/admin/staff',
  pricing_master: '/admin/pricing',
  hardware_master: '/admin/hardware',
  all_quotes: '/admin/quotations',
  admin_settings: '/admin/settings',
  staff_dashboard: '/staff',
  staff_files: '/staff/files',
  staff_new_lead: '/staff/new-lead',
  staff_map: '/staff/map'
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

  // Solar Hardware Catalogs (from PDF)
  const [modulesList, setModulesList] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_MODULES;
    return safeJsonParse('sunvine_modules', DEFAULT_MODULES);
  });

  const [invertersList, setInvertersList] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_INVERTERS;
    return safeJsonParse('sunvine_inverters', DEFAULT_INVERTERS);
  });

  // Dealers Directory (550 Gujarat Dealers Only)
  const [dealers, setDealers] = useState(() => {
    if (!isDbUpToDate) return INITIAL_DEALERS;
    const parsed = safeJsonParse('sunvine_dealers', INITIAL_DEALERS);
    return (Array.isArray(parsed) && parsed.length >= 500) ? parsed : INITIAL_DEALERS;
  });

  // Real PDF BOS Reference Data
  const [pdfBosMatrix, setPdfBosMatrix] = useState(() => {
    if (!isDbUpToDate) return PDF_BOS_PRICE_MATRIX;
    const parsed = safeJsonParse('sunvine_bos_price_matrix', PDF_BOS_PRICE_MATRIX);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : PDF_BOS_PRICE_MATRIX;
  });

  // Standard BOM Item Rates (Admin Configurable)
  const defaultBomRates = useMemo(() => {
    return STANDARD_BOM_CATALOG.reduce((acc, item) => {
      acc[item.id] = item.defaultRate;
      return acc;
    }, {});
  }, []);

  const [bomRates, setBomRates] = useState(() => {
    if (!isDbUpToDate) return defaultBomRates;
    return safeJsonParse('sunvine_bom_rates', defaultBomRates);
  });

  // Standard Capacity-Wise BOM Quantities (Admin Configurable)
  const [capacityBomMatrix, setCapacityBomMatrix] = useState(() => {
    if (!isDbUpToDate) return DEFAULT_CAPACITY_BOM;
    return safeJsonParse('sunvine_capacity_bom', DEFAULT_CAPACITY_BOM);
  });

  // Catalog items viewed by dealer (for "NEW" badge management)
  const [seenCatalogItemIds, setSeenCatalogItemIds] = useState(() => {
    return safeJsonParse('sunvine_seen_catalog_items', []);
  });

  // Quotations List (All in Gujarat)
  const [quotations, setQuotations] = useState(() => {
    if (!isDbUpToDate) return INITIAL_QUOTATIONS;
    const parsed = safeJsonParse('sunvine_quotations', INITIAL_QUOTATIONS);
    return (Array.isArray(parsed) && parsed.length >= 3) ? parsed : INITIAL_QUOTATIONS;
  });

  // Active quotation loaded in 4-Page Preview
  const [previewQuotation, setPreviewQuotation] = useState(() => {
    if (!isDbUpToDate) return INITIAL_QUOTATIONS[0];
    return safeJsonParse('sunvine_preview_quotation', INITIAL_QUOTATIONS[0]);
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

  // Customer Files Pipeline (Synchronized between Admin and Sales Staff)
  const [customerFiles, setCustomerFiles] = useState(() => {
    return safeJsonParse('sunvine_customer_files', DEFAULT_CUSTOMER_FILES);
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

  const addNewModule = (newModule) => {
    const brand = newModule.brand?.trim() || 'Custom';
    const model = newModule.model?.trim() || 'Solar Module';
    const id = `mod-${Date.now()}`;
    const moduleEntry = {
      id,
      brand,
      model,
      cellTech: newModule.cellTech || 'N-Type TOPCon',
      wattage: Number(newModule.wattage) || 550,
      efficiency: newModule.efficiency || '22.0%',
      ratePerWp: newModule.ratePerWp ? (typeof newModule.ratePerWp === 'number' ? `₹ ${newModule.ratePerWp.toFixed(2)}/Wp` : newModule.ratePerWp) : '₹ 19.50/Wp',
      warranty: newModule.warranty || '30 Yrs',
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
    return moduleEntry;
  };

  const addNewInverter = (newInverter) => {
    const brand = newInverter.brand?.trim() || 'Custom';
    const model = newInverter.model?.trim() || 'Solar Inverter';
    const id = `inv-${Date.now()}`;
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
    return resolveCapacityBom(capacityKW, capacityBomMatrix, bomRates);
  };

  // Auth Actions
  const login = (userRole, userProfile = null) => {
    setIsAuthenticated(true);
    setRole(userRole);
    if (userRole === 'admin') {
      setActiveTab('admin_dashboard');
    } else if (userRole === 'staff') {
      setActiveTab('staff_dashboard');
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
  };

  // Staff and Customer File Actions
  const addStaff = (newStaff) => {
    setStaffList(prev => [newStaff, ...prev]);
  };

  const updateStaff = (staffId, updatedFields) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, ...updatedFields } : s));
    if (currentStaff?.id === staffId) {
      setCurrentStaff(prev => ({ ...prev, ...updatedFields }));
    }
  };

  const updateStaffPassword = (staffId, newPassword) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, password: newPassword } : s));
  };

  const addCustomerFile = (newFile) => {
    setCustomerFiles(prev => [newFile, ...prev]);
    // Also update staff totalFiles and pipelineKw
    if (newFile.staffId) {
      setStaffList(prev => prev.map(s => s.id === newFile.staffId ? {
        ...s,
        totalFiles: (s.totalFiles || 0) + 1,
        pipelineKw: Number(((s.pipelineKw || 0) + (newFile.solarSystemKw || 0)).toFixed(1))
      } : s));
    }
  };

  const updateCustomerFile = (fileId, updatedFields) => {
    setCustomerFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updatedFields } : f));
  };

  const updateFileStatus = (fileId, nextStatus) => {
    setCustomerFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, status: nextStatus };
    }));
  };

  const updateDealerProfile = (updatedFields) => {
    const updated = { ...currentDealer, ...updatedFields };
    setCurrentDealer(updated);
    setDealers(prev => prev.map(d => d.id === currentDealer.id ? updated : d));
  };

  // Quotation Actions
  const addQuotation = (newQuote) => {
    const updated = [newQuote, ...quotations];
    setQuotations(updated);
    setPreviewQuotation(newQuote);
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
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
  };

  const addDealer = (newDealer) => {
    setDealers(prev => [newDealer, ...prev]);
  };

  const updateDealer = (updatedDealer) => {
    setDealers(prev => prev.map(d => d.id === updatedDealer.id ? { ...d, ...updatedDealer } : d));
    if (currentDealer?.id === updatedDealer.id) {
      setCurrentDealer(prev => ({ ...prev, ...updatedDealer }));
    }
  };

  const toggleDealerStatus = (id) => {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, status: d.status === 'Active' ? 'Suspended' : 'Active' } : d));
  };

  const updateDealerMarginCap = (id, newCap) => {
    const numericCap = Number(newCap);
    setDealers(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, maxMarginCapPerKw: numericCap } : d);
      safeSetItem('sunvine_dealers', updated);
      return updated;
    });
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, maxMarginCapPerKw: numericCap }));
    }
  };

  const updateDealerPassword = (id, newPassword) => {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, password: newPassword } : d));
    if (currentDealer?.id === id) {
      setCurrentDealer(prev => ({ ...prev, password: newPassword }));
    }
  };

  const updatePricingMaster = (newMaster) => {
    setPricingMaster(newMaster);
    safeSetItem('sunvine_pricing_master', newMaster);
  };

  const updatePricingPresets = (newPresets) => {
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
    addNotification({
      title: 'Quotation Presets Updated',
      description: `Base Rate: ₹${Number(updated.baseRatePerKw).toLocaleString('en-IN')}/kW | Min Margin: ₹${Number(updated.minMarginPerKw).toLocaleString('en-IN')}/kW.`,
      category: 'pricing',
      icon: 'tune'
    });
  };

  const updateTierMargins = (newTiers) => {
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
    addNotification({
      title: 'Dealer Tier Margins Updated',
      description: `Default margin thresholds updated for Diamond, Platinum, Gold & Silver dealer tiers.`,
      category: 'pricing',
      icon: 'price_check',
      audience: 'all'
    });
  };

  const updateGovernanceSettings = (newSettings) => {
    const isDifferent = Object.keys(newSettings || {}).some(key => {
      return String(newSettings[key]) !== String(governanceSettings?.[key]);
    });
    if (!isDifferent) return;

    const updated = { ...governanceSettings, ...newSettings };
    setGovernanceSettings(updated);
    safeSetItem('sunvine_governance_settings', updated);

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
        dealers,
        addDealer,
        updateDealer,
        toggleDealerStatus,
        updateDealerMarginCap,
        updateDealerPassword,
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
        pdfBomSpecs: PDF_BOM_SPECIFICATIONS,
        officialProfile: SUNVINE_OFFICIAL_PROFILE,
        // Standard BOM & BoS Engine
        bomCatalog: STANDARD_BOM_CATALOG,
        bomCategories: STANDARD_BOM_CATEGORIES,
        bomRates,
        updateBomItemRate,
        capacityBomMatrix,
        updateCapacityBomItemQty,
        updateCapacityBomPreset,
        getResolvedBom,
        // Dynamic Catalogs & 'NEW' Badge Tracking
        addNewModule,
        addNewInverter,
        seenCatalogItemIds,
        markCatalogItemSeen,
        isCatalogItemNew
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
