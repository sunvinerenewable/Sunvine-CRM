import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { quotationService } from '../../services/quotationService';
import { useToast } from '../Shared/Toast';
import PanelLayoutVisualizer from '../Shared/PanelLayoutVisualizer';

const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹\u00A00';
  return '₹\u00A0' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export default function CreateQuotation() {
  const { 
    currentDealer, 
    role,
    dealers,
    addQuotation, 
    updateQuotation, 
    editingQuotation, 
    clearEditingQuotation, 
    activeDraftQuote,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    setActiveTab, 
    setPreviewQuotation,
    addNotification,
    pricingPresets,
    tierMargins,
    modulesList,
    invertersList,
    isCatalogItemNew,
    markCatalogItemSeen
  } = useApp();

  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = role === 'admin';
  const initialSource = editingQuotation || activeDraftQuote;

  // Channel configuration (Direct Company Quote vs Dealer Partner)
  const [quoteChannel, setQuoteChannel] = useState(() => {
    if (initialSource?.isDirectCompanyQuote !== undefined) {
      return initialSource.isDirectCompanyQuote ? 'direct' : 'dealer';
    }
    return isAdmin ? 'direct' : 'dealer';
  });

  const [assignedDealerId, setAssignedDealerId] = useState(() => {
    if (initialSource?.dealerCode && initialSource?.dealerCode !== 'SV-DIRECT') {
      return initialSource.dealerCode;
    }
    return currentDealer?.id || (dealers && dealers[0]?.id) || 'SV-DLR-0104';
  });

  const isDirectCompanyQuote = isAdmin ? (quoteChannel === 'direct') : false;
  const effectiveDealer = isDirectCompanyQuote
    ? null
    : (isAdmin ? (dealers?.find(d => d.id === assignedDealerId) || currentDealer) : currentDealer);

  // Derive dealer tier margin configuration
  const dealerTierKey = isDirectCompanyQuote ? 'gold' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('diamond') ? 'diamond' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('platinum') ? 'platinum' :
                        (effectiveDealer?.tier || '').toLowerCase().includes('silver') ? 'silver' : 'gold';
  const tierConfig = isDirectCompanyQuote
    ? { defaultMarginPerKw: 0, maxMarginCapPerKw: 0 }
    : (tierMargins?.[dealerTierKey] || { defaultMarginPerKw: 4500, maxMarginCapPerKw: 6000 });

  // Step 1.1 Customer Details (Persisted across multi-step navigation)
  const [custName, setCustName] = useState(initialSource?.customerName || '');
  const [custPhone, setCustPhone] = useState(initialSource?.customerPhone || '');
  const [custLocation, setCustLocation] = useState(initialSource?.location || initialSource?.city || '');

  // Step 1.2 System Details (Standard field presets)
  const [systemCapacity, setSystemCapacity] = useState(() => {
    const rawKw = initialSource?.systemCapacityKW || initialSource?.capacity;
    return rawKw ? String(parseFloat(rawKw)) : '3.3';
  });
  const [panelBrand, setPanelBrand] = useState(initialSource?.solarModule || initialSource?.panelType || 'Waaree 585W TOPCon Bifacial (ALMM List-I)');
  const [inverterModel, setInverterModel] = useState(initialSource?.inverterType || 'Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)');
  const [projectType, setProjectType] = useState(() => {
    if (initialSource?.projectType) return initialSource.projectType;
    if (typeof initialSource?.type === 'string' && initialSource.type.includes('Commercial')) return 'Commercial';
    return 'Residential';
  });
  const [showInverterModal, setShowInverterModal] = useState(false);

  // 2D Solar Panel Structure & Mounting Layout Studio
  const [showLayoutStudio, setShowLayoutStudio] = useState(false);
  const [isInlineLayoutOpen, setIsInlineLayoutOpen] = useState(false);
  const [selectedStructureLayout, setSelectedStructureLayout] = useState(() => {
    return initialSource?.structureLayout || null;
  });

  const [quotationRoofConfig, setQuotationRoofConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_roof_config');
      return saved ? JSON.parse(saved) : (initialSource?.roofConfig || null);
    } catch (e) {
      return initialSource?.roofConfig || null;
    }
  });

  const handleUpdateRoofConfig = newCfg => {
    setQuotationRoofConfig(newCfg);
    try {
      localStorage.setItem('sunvine_saved_roof_config', JSON.stringify(newCfg));
    } catch (e) {}
  };

  // Multi-Panel Quotation Toggle
  const [multiBrandComparison, setMultiBrandComparison] = useState(initialSource?.multiBrandComparison || false);

  // Step 1.3 Pricing & Subsidy (Linked to Admin Pricing Presets & Dealer Tier Margins)
  const [ratePerKw, setRatePerKw] = useState(() => Number(initialSource?.baseRatePerKW) || pricingPresets?.baseRatePerKw || 59800);
  const [marginMode, setMarginMode] = useState('amount'); // default to fixed amount matching tier
  const [dealerMarginRate, setDealerMarginRate] = useState(isDirectCompanyQuote ? 0 : 8); // 8%
  const [dealerMarginFixed, setDealerMarginFixed] = useState(() => {
    if (initialSource?.dealerTotalMargin !== undefined) return Number(initialSource.dealerTotalMargin);
    if (isDirectCompanyQuote) return 0;
    return tierConfig.defaultMarginPerKw * 3.3;
  });
  const [saveStatus, setSaveStatus] = useState('');

  // Always reset scroll to the very top (Customer Details) on mount or quotation switch (SR-39)
  useEffect(() => {
    const scrollToTop = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
      }
    };
    scrollToTop();
    const t = setTimeout(scrollToTop, 50);
    return () => clearTimeout(t);
  }, [editingQuotation?.id]);

  useEffect(() => {
    if (!editingQuotation && !activeDraftQuote && pricingPresets?.baseRatePerKw) {
      setRatePerKw(pricingPresets.baseRatePerKw);
    }
    if (!editingQuotation && !activeDraftQuote) {
      if (isDirectCompanyQuote) {
        setDealerMarginFixed(0);
        setDealerMarginRate(0);
      } else if (tierConfig?.defaultMarginPerKw) {
        setDealerMarginFixed(tierConfig.defaultMarginPerKw * (parseFloat(systemCapacity) || 5));
      }
    }
  }, [pricingPresets?.baseRatePerKw, tierConfig?.defaultMarginPerKw, editingQuotation, activeDraftQuote, systemCapacity, isDirectCompanyQuote]);

  // Auto-populate when editing an existing quote or restoring draft (SR-36)
  useEffect(() => {
    const source = editingQuotation || activeDraftQuote;
    if (source) {
      if (source.customerName !== undefined) setCustName(source.customerName);
      if (source.customerPhone !== undefined) setCustPhone(source.customerPhone);
      if (source.location || source.city) {
        setCustLocation(source.location || `${source.city || 'Rajkot'}, Gujarat`);
      }
      const rawKw = parseFloat(source.systemCapacityKW || source.capacity);
      if (!isNaN(rawKw)) setSystemCapacity(String(rawKw));
      if (source.solarModule || source.panelType) {
        setPanelBrand(source.solarModule || source.panelType);
      }
      if (source.inverterType) {
        setInverterModel(source.inverterType);
      }
      if (source.projectType) {
        setProjectType(source.projectType);
      } else if (typeof source.type === 'string' && source.type.includes('Commercial')) {
        setProjectType('Commercial');
      } else {
        setProjectType('Residential');
      }
      if (source.baseRatePerKW) {
        setRatePerKw(Number(source.baseRatePerKW));
      }
      if (source.multiBrandComparison !== undefined) {
        setMultiBrandComparison(source.multiBrandComparison);
      }
      if (source.dealerTotalMargin) {
        setMarginMode('amount');
        setDealerMarginFixed(Number(source.dealerTotalMargin));
      } else if (source.dealerMarginPerKW && rawKw > 0) {
        setMarginMode('amount');
        setDealerMarginFixed(Number(source.dealerMarginPerKW) * rawKw);
      }
    }
  }, [editingQuotation, activeDraftQuote]);

  // Sizing Computations
  const kw = parseFloat(systemCapacity) || 3.3;
  const matchedWatt = panelBrand.match(/(\d{3})\s*W/i);
  const panelWatt = matchedWatt ? Number(matchedWatt[1]) : 585;
  const moduleCount = Math.ceil((kw * 1000) / panelWatt);
  const rooftopAreaSqFt = Math.round(kw * 64);

  // Base EPC & Hardware Project Cost
  const baseProjectCost = Math.round(kw * ratePerKw);

  // Dealer margin computation (dual mode: % or fixed ₹ amount, strictly 0 for direct company quotes)
  const dealerMarginINR = isDirectCompanyQuote ? 0 : (
    marginMode === 'percent'
      ? Math.round(baseProjectCost * (dealerMarginRate / 100))
      : Math.round(dealerMarginFixed)
  );

  // Effective margin percentage
  const effectiveMarginPercent = isDirectCompanyQuote ? '0.0' : (
    baseProjectCost > 0
      ? ((dealerMarginINR / baseProjectCost) * 100).toFixed(1)
      : '0.0'
  );

  // Tier Margin Cap & Audit Validation (SR-24)
  const maxMarginCapPerKw = isDirectCompanyQuote ? 0 : (effectiveDealer?.maxMarginCapPerKw || tierConfig?.maxMarginCapPerKw || 6000);
  const currentMarginPerKw = (isDirectCompanyQuote || kw <= 0) ? 0 : Math.round(dealerMarginINR / kw);
  const isMarginExceeded = isDirectCompanyQuote ? false : (currentMarginPerKw > maxMarginCapPerKw);

  // Total Customer Quoted Project Cost (Base Cost + Dealer Margin)
  const totalCost = baseProjectCost + dealerMarginINR;

  // PM Surya Ghar Central DBT Subsidy Formula (Linked to Admin Presets & Project Type)
  const calculateSubsidy = (capacity, type) => {
    if (type === 'Commercial') return 0;
    const maxSubsidy = pricingPresets?.subsidyCap || 78000;
    if (capacity <= 1) return Math.min(30000, maxSubsidy);
    if (capacity <= 2) return Math.min(60000, maxSubsidy);
    return maxSubsidy; // Cap at subsidyCap (default ₹78,000 for 3kW+)
  };

  const subsidy = calculateSubsidy(kw, projectType);
  const finalPayable = Math.max(0, totalCost - subsidy);
  const annualGenerationUnits = Math.round(kw * 1440);
  const annualSavings = Math.round(annualGenerationUnits * 6.67);
  const paybackYears = annualSavings > 0 ? (finalPayable / annualSavings).toFixed(1) : '3.8';
  const paybackPercent = Math.min(100, Math.round((parseFloat(paybackYears) / 10) * 100));
  const breakEvenYear = new Date().getFullYear() + Math.ceil(parseFloat(paybackYears));

  // Multi-brand comparison package calculator (Waaree vs APS vs Adani)
  const multiBrandPackages = useMemo(() => {
    if (!multiBrandComparison) return null;
    const candidates = [
      { name: 'Waaree 585W TOPCon Bifacial', brand: 'Waaree', wattage: 585, rateOffset: 0 },
      { name: 'APS 600W TOPCon Bifacial', brand: 'APS', wattage: 600, rateOffset: -600 },
      { name: 'Adani 550W Vertex Mono PERC', brand: 'Adani', wattage: 550, rateOffset: +500 }
    ];
    return candidates.map((c) => {
      const pWatt = c.wattage;
      const count = Math.ceil((kw * 1000) / pWatt);
      const pkgRate = ratePerKw + c.rateOffset;
      const bCost = Math.round(kw * pkgRate);
      const tCost = bCost + dealerMarginINR;
      const payable = Math.max(0, tCost - subsidy);
      return {
        brand: c.brand,
        name: c.name,
        wattage: pWatt,
        moduleCount: count,
        ratePerKw: pkgRate,
        baseCost: bCost,
        totalCost: tCost,
        subsidy,
        netPayable: payable
      };
    });
  }, [multiBrandComparison, kw, ratePerKw, dealerMarginINR, subsidy]);

  const availableInverters = [
    { name: 'Sunvine Solar Hybrid Inverter 5kW 3-Phase', efficiency: '98.4%', specs: 'Built-in WiFi Smart Logger • IP65 Protection' },
    { name: 'Sunvine On-Grid String Inverter 5kW Single Phase', efficiency: '98.2%', specs: 'Dual MPPT • Zero Export Device Compatible' },
    { name: 'Sungrow SG5.0RS Residential Inverter', efficiency: '98.5%', specs: 'Ultra-silent convection cooling • 10 Yr Warranty' },
    { name: 'Solis S6 Pro Series 5kW 3-Phase Hybrid', efficiency: '98.6%', specs: 'AFCI Arc Fault Protection • Generator Sync' }
  ];

  const handleReset = () => {
    if (clearEditingQuotation) clearEditingQuotation();
    if (clearActiveDraftQuote) clearActiveDraftQuote();
    setCustName('');
    setCustPhone('');
    setCustLocation('');
    setSystemCapacity('3.3');
    setPanelBrand('Waaree 585W TOPCon Bifacial (ALMM List-I)');
    setInverterModel('Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)');
    setProjectType('Residential');
    setMultiBrandComparison(false);
    setRatePerKw(pricingPresets?.baseRatePerKw || 59800);
    if (isAdmin) {
      setQuoteChannel('direct');
      setDealerMarginFixed(0);
      setDealerMarginRate(0);
    } else {
      setDealerMarginFixed(tierConfig.defaultMarginPerKw * 3.3);
    }
  };

  const handleSaveDraft = async () => {
    if (!custName.trim()) {
      addToast({
        title: 'Customer Name Required',
        message: 'Please enter the customer name before saving the draft.',
        type: 'warning'
      });
      return;
    }

    const isEdit = Boolean(editingQuotation?.id);
    const resolvedDealerCode = isDirectCompanyQuote ? 'SV-DIRECT' : (effectiveDealer?.id || currentDealer?.id || 'SV-DLR-0104');
    const resolvedDealerName = isDirectCompanyQuote ? 'Sunvine Renewable Energy (Head Office)' : (effectiveDealer?.firmName || currentDealer?.firmName || 'Rajesh Solar Solutions');

    const quotePayload = {
      id: isEdit ? editingQuotation.id : `SV-2026-Q${Math.floor(100 + Math.random() * 900)}`,
      date: isEdit ? (editingQuotation.date || new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB'),
      customerName: custName,
      customerPhone: custPhone,
      location: custLocation,
      city: custLocation.split(',')[0]?.trim() || 'Rajkot',
      state: 'Gujarat',
      projectType,
      type: `${panelBrand.split(' ')[0]} • ${projectType}`,
      systemCapacityKW: kw,
      panelType: panelBrand,
      solarModule: panelBrand,
      selectedModuleMake: panelBrand.split(' ')[0],
      selectedInverterMake: inverterModel.split(' ')[0],
      multiBrandComparison,
      multiBrandPackages: multiBrandComparison ? multiBrandPackages : null,
      moduleCount: moduleCount,
      structureLayout: selectedStructureLayout || null,
      inverterType: inverterModel,
      inverterCapacity: `${kw} kW`,
      baseCost: baseProjectCost,
      dealerMargin: dealerMarginINR,
      dealerTotalMargin: dealerMarginINR,
      dealerMarginPerKW: isDirectCompanyQuote ? 0 : (kw > 0 ? Math.round(dealerMarginINR / kw) : 0),
      isDirectCompanyQuote,
      isFlagged: isMarginExceeded,
      requiresAudit: isMarginExceeded,
      auditFlagReason: isMarginExceeded ? `Margin of ₹${currentMarginPerKw}/kW exceeds tier cap of ₹${maxMarginCapPerKw}/kW` : null,
      totalAmount: totalCost,
      grandTotalCustomer: totalCost,
      subsidyAmount: subsidy,
      netPayable: finalPayable,
      status: isEdit ? (editingQuotation.status || (isDirectCompanyQuote ? 'Approved / Direct' : 'Draft')) : (isMarginExceeded ? 'Audit Required' : (isDirectCompanyQuote ? 'Approved / Direct' : 'Draft')),
      statusClass: isEdit ? (editingQuotation.statusClass || 'bg-secondary/15 text-secondary') : (isMarginExceeded ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-primary/15 text-primary'),
      dealerCode: resolvedDealerCode,
      dealerId: resolvedDealerCode,
      dealerName: resolvedDealerName
    };

    setIsSubmitting(true);
    setSaveStatus('Saving quotation...');
    try {
      if (isEdit && updateQuotation) {
        updateQuotation(quotePayload);
      } else if (addQuotation) {
        addQuotation(quotePayload);
      }
      await quotationService.saveQuotation(quotePayload);
      setSaveStatus(isEdit ? 'Quotation updated successfully!' : 'Draft saved successfully to cloud!');
      addToast({
        title: isEdit ? 'Quotation Updated' : 'Draft Saved',
        message: `Quotation #${quotePayload.id} for ${custName} saved successfully.${isMarginExceeded ? ' Note: Margin exceeds tier cap and requires compliance audit.' : ''}`,
        type: isMarginExceeded ? 'warning' : 'success'
      });
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      addToast({
        title: 'Save Failed',
        message: 'Could not save quotation to storage.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!custName.trim()) {
      addToast({
        title: 'Customer Name Required',
        message: 'Please specify the customer name before generating proposal preview.',
        type: 'warning'
      });
      return;
    }

    if (isMarginExceeded) {
      addToast({
        title: 'Margin Audit Alert',
        message: `Configured margin (₹${currentMarginPerKw.toLocaleString('en-IN')}/kW) exceeds your tier cap of ₹${maxMarginCapPerKw.toLocaleString('en-IN')}/kW. Proposal flagged for super admin compliance audit.`,
        type: 'warning'
      });
    }

    const isEdit = Boolean(editingQuotation?.id);
    const resolvedDealerCode = isDirectCompanyQuote ? 'SV-DIRECT' : (effectiveDealer?.id || currentDealer?.id || 'SV-DLR-0104');
    const resolvedDealerName = isDirectCompanyQuote ? 'Sunvine Renewable Energy (Head Office)' : (effectiveDealer?.firmName || currentDealer?.firmName || 'Rajesh Solar Solutions');

    const quotePayload = {
      id: isEdit ? editingQuotation.id : `SV-2026-Q${Math.floor(100 + Math.random() * 900)}`,
      date: isEdit ? (editingQuotation.date || new Date().toLocaleDateString('en-GB')) : new Date().toLocaleDateString('en-GB'),
      customerName: custName,
      customerPhone: custPhone,
      location: custLocation,
      city: custLocation.split(',')[0]?.trim() || 'Rajkot',
      state: 'Gujarat',
      projectType,
      type: `${panelBrand.split(' ')[0]} • ${projectType}`,
      systemCapacityKW: kw,
      solarModule: panelBrand,
      selectedModuleMake: panelBrand.split(' ')[0],
      selectedInverterMake: inverterModel.split(' ')[0],
      multiBrandComparison,
      multiBrandPackages: multiBrandComparison ? multiBrandPackages : null,
      moduleCount: moduleCount,
      structureLayout: selectedStructureLayout || null,
      pvModuleSize: '4 * 8',
      inverterCapacity: `${kw} kW`,
      inverterType: inverterModel,
      inverterCount: '1 NOS',
      baseRatePerKW: ratePerKw,
      dealerMarginPerKW: isDirectCompanyQuote ? 0 : (kw > 0 ? Math.round(dealerMarginINR / kw) : 0),
      dealerTotalMargin: dealerMarginINR,
      dealerMargin: dealerMarginINR,
      isDirectCompanyQuote,
      isFlagged: isMarginExceeded,
      requiresAudit: isMarginExceeded,
      auditFlagReason: isMarginExceeded ? `Margin of ₹${currentMarginPerKw}/kW exceeds tier cap of ₹${maxMarginCapPerKw}/kW` : null,
      totalAmount: totalCost,
      subsidyAmount: subsidy,
      grandTotalCustomer: totalCost,
      netPayable: finalPayable,
      status: isEdit ? (editingQuotation.status || 'Active / Sent') : (isMarginExceeded ? 'Audit Required' : 'Active / Sent'),
      statusClass: isEdit ? (editingQuotation.statusClass || 'bg-primary/15 text-primary') : (isMarginExceeded ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-primary/15 text-primary'),
      dealerId: resolvedDealerCode,
      dealerCode: resolvedDealerCode,
      dealerName: resolvedDealerName
    };

    if (isEdit && updateQuotation) {
      updateQuotation(quotePayload);
    } else if (addQuotation) {
      addQuotation(quotePayload);
    }
    if (setPreviewQuotation) setPreviewQuotation(quotePayload);
    if (setActiveDraftQuote) setActiveDraftQuote(quotePayload);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    setActiveTab('preview_quote');
  };

  return (
    <div className="flex flex-col w-full pb-8 min-w-0 overflow-x-hidden">
      {/* Top Navigation Bar & Progress Track (Exact Stitch Stepper) */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col gap-1 min-w-0">
          <button
            onClick={() => {
              if (clearEditingQuotation) clearEditingQuotation();
              if (clearActiveDraftQuote) clearActiveDraftQuote();
              setActiveTab(isAdmin ? 'admin_dashboard' : 'dashboard');
            }}
            className="inline-flex items-center gap-1.5 text-secondary hover:text-on-surface font-label-sm transition-colors w-fit group"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
            <span>{isAdmin ? 'Back to Overview' : 'Back to Dashboard'}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl text-on-surface tracking-tight font-bold">
              {editingQuotation ? 'Edit Quotation' : (isDirectCompanyQuote ? 'New Direct Company Quotation' : 'New Quotation')}
            </h1>
            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] tracking-wide uppercase font-semibold shrink-0">
              {editingQuotation ? `#${editingQuotation.id}` : (isDirectCompanyQuote ? 'Sunvine HO Direct (Zero Margin)' : 'Ref #SV-2025-Q408')}
            </span>
            {editingQuotation && (
              <button
                onClick={handleReset}
                type="button"
                className="text-xs text-secondary hover:text-error underline font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center bg-surface-container-lowest p-1.5 rounded-xl shadow-sm self-start border border-surface-container-high overflow-x-auto max-w-full">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary font-label-sm shrink-0">
            <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            <span className="text-xs font-semibold whitespace-nowrap">Details &amp; Pricing</span>
            <span className="bg-primary-container/20 text-on-primary-container text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide shrink-0">Active</span>
          </div>
          <div className="w-4 h-0.5 bg-surface-container-high mx-1 shrink-0"></div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-secondary/60 font-label-sm select-none cursor-not-allowed opacity-75 shrink-0"
            title="Complete quotation details and use 'Preview & Send' button below to proceed"
          >
            <span className="w-5 h-5 rounded-full bg-surface-container-high text-secondary/60 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            <span className="text-xs font-medium whitespace-nowrap">Preview &amp; Send</span>
          </div>
        </div>
      </div>

      {/* Admin Channel Selection Bar (Head Office Direct vs Dealer Partner) */}
      {isAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-[#0F1B2E] text-white shadow-md border border-slate-700/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6CBF3D]/20 border border-[#6CBF3D]/40 flex items-center justify-center text-[#6CBF3D] shrink-0">
              <span className="material-symbols-outlined text-[24px]">corporate_fare</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6CBF3D]">Sunvine Operations Console</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/15 text-slate-200 font-semibold">Central EPC Issuance</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isDirectCompanyQuote
                  ? 'Issuing direct company quotation with 0% dealer margin markup for customer.'
                  : `Issuing quotation on behalf of authorized partner: ${effectiveDealer?.firmName || 'Partner'}.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center p-1 bg-slate-800/90 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setQuoteChannel('direct');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quoteChannel === 'direct'
                    ? 'bg-[#6CBF3D] text-[#0F1B2E] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">apartment</span>
                <span>Sunvine Direct (Company Margin)</span>
              </button>
              <button
                type="button"
                onClick={() => setQuoteChannel('dealer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quoteChannel === 'dealer'
                    ? 'bg-white text-[#0F1B2E] shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">handshake</span>
                <span>Dealer Partner</span>
              </button>
            </div>

            {quoteChannel === 'dealer' && (
              <select
                value={assignedDealerId}
                onChange={(e) => setAssignedDealerId(e.target.value)}
                className="h-9 px-3 text-xs bg-slate-800 text-white rounded-xl border border-slate-700 outline-none focus:border-[#6CBF3D]"
              >
                {(dealers || []).slice(0, 100).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firmName} ({d.city}) • {d.tier}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Save Notification Banner */}
      {saveStatus && (
        <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-label-sm flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Form Layout Grid (Stacked on Mobile/Tablet, Asymmetrical Split on Desktop >=1280px: 7 Cols Left / 5 Cols Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full min-w-0">
        {/* Left Column: Specs & Inputs (7 cols on XL) */}
        <div className="xl:col-span-7 flex flex-col gap-6 min-w-0">
          {/* Card 1: Customer Details */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high">
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">person</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">Customer Details</h2>
                  <p className="text-xs text-secondary hidden sm:block">Site contact &amp; regional grid jurisdictional data</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.1</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custName">
                  Customer Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">badge</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                    id="custName"
                    placeholder="Enter customer's full name"
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custPhone">
                  Mobile Number <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">phone</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono"
                    id="custPhone"
                    placeholder="10-digit mobile number"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={custPhone}
                    onChange={(e) => {
                      const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setCustPhone(numericOnly);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="custLocation">
                  Installation City / Pincode <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">location_on</span>
                  <input
                    className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
                    id="custLocation"
                    placeholder="e.g. Rajkot, 360004"
                    type="text"
                    value={custLocation}
                    onChange={(e) => setCustLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: System Details */}
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high">
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">solar_power</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">System Details</h2>
                  <p className="text-xs text-secondary hidden sm:block">Hardware configuration, inverter tier &amp; module capacity</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.2</span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Row 1, Col 1: Capacity Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="systemCapacity">
                  System Capacity (kW)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-primary text-[20px] pointer-events-none">solar_power</span>
                  <select
                    className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer"
                    id="systemCapacity"
                    value={systemCapacity}
                    onChange={(e) => setSystemCapacity(e.target.value)}
                  >
                    <option value="2.2">2.2 kW (4 Panels Rooftop)</option>
                    <option value="3.3">3.3 kW (6 Panels Standard Field Spec)</option>
                    <option value="4.4">4.4 kW (8 Panels Rooftop)</option>
                    <option value="5.5">5.5 kW (10 Panels Rooftop)</option>
                    <option value="6.6">6.6 kW (12 Panels Rooftop)</option>
                    <option value="8">8.0 kW (14 Panels High-Capacity)</option>
                    <option value="10">10.0 kW (Commercial / High Load)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                </div>
              </div>

              {/* Row 1, Col 2: Panel Brand Selector with Dynamic Catalog & NEW badge */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="panelBrand">
                    Solar Panel Brand &amp; Model
                  </label>
                  {(() => {
                    const activeMod = (modulesList || []).find(m => `${m.brand} ${m.model}` === panelBrand);
                    return activeMod && isCatalogItemNew && isCatalogItemNew(activeMod) ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider animate-pulse">
                        NEW
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">grid_view</span>
                  <select
                    className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer"
                    id="panelBrand"
                    value={panelBrand}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPanelBrand(val);
                      const mod = (modulesList || []).find(m => `${m.brand} ${m.model}` === val);
                      if (mod && markCatalogItemSeen) {
                        markCatalogItemSeen(mod.id || `${mod.brand}-${mod.model}`);
                      }
                    }}
                  >
                    {(modulesList || [
                      { brand: 'Waaree', model: '585W TOPCon Bifacial (ALMM List-I)' },
                      { brand: 'APS', model: '600W TOPCon Bifacial (ALMM List-I)' },
                      { brand: 'Adani', model: '550W Vertex Mono PERC' },
                      { brand: 'Rayzone', model: '550W Bifacial TOPCon' }
                    ]).filter(mod => !mod.isArchived).map((mod, idx) => {
                      const fullName = `${mod.brand} ${mod.model}`;
                      const isNew = isCatalogItemNew ? isCatalogItemNew(mod) : false;
                      return (
                        <option key={mod.id || idx} value={fullName}>
                          {fullName} {isNew ? '★ [NEW]' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                </div>
              </div>

              {/* Row 2, Col 1: Inverter Configuration Selector with Dynamic Catalog & NEW badge */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">Selected Inverter Unit</label>
                  {(() => {
                    const activeInv = (invertersList || []).find(i => `${i.brand} ${i.model}` === inverterModel);
                    return activeInv && isCatalogItemNew && isCatalogItemNew(activeInv) ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider animate-pulse">
                        NEW
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">developer_board</span>
                  <select
                    className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer"
                    value={inverterModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInverterModel(val);
                      const inv = (invertersList || []).find(i => `${i.brand} ${i.model}` === val);
                      if (inv && markCatalogItemSeen) {
                        markCatalogItemSeen(inv.id || `${inv.brand}-${inv.model}`);
                      }
                    }}
                  >
                    {(invertersList || [
                      { brand: 'Sunvine', model: 'Solaryaan 5.0G (1-Phase 2 MPPT)' },
                      { brand: 'Solis', model: 'S6-GR1P-5K (1-Phase 2 MPPT)' },
                      { brand: 'Sungrow', model: 'SG5.0RS Residential Grid-Tied' },
                      { brand: 'Growatt', model: 'MIN 5000TL-X Dual MPPT' }
                    ]).filter(inv => !inv.isArchived).map((inv, idx) => {
                      const fullName = `${inv.brand} ${inv.model}`;
                      const isNew = isCatalogItemNew ? isCatalogItemNew(inv) : false;
                      return (
                        <option key={inv.id || idx} value={fullName}>
                          {fullName} {isNew ? '★ [NEW]' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                </div>
              </div>

              {/* Row 2, Col 2: Project Type Dropdown */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="projectType">
                    Project Type / Category
                  </label>
                  <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">
                    {projectType === 'Residential' ? 'Subsidy Slabs' : 'Commercial EPC'}
                  </span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">apartment</span>
                  <select
                    className="w-full h-10 pl-10 pr-9 rounded-lg bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer"
                    id="projectType"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                  >
                    <option value="Residential">Residential (PM Surya Ghar Subsidy)</option>
                    <option value="Commercial">Commercial / Industrial (Non-Subsidy)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[20px] pointer-events-none">arrow_drop_down</span>
                </div>
              </div>
            </div>

              {/* Multi-Panel Comparative Quotation Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high mt-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">view_column</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md font-bold text-on-surface">Multi-Panel Comparative Proposal</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">Single PDF</span>
                    </div>
                    <p className="text-xs text-secondary">Present side-by-side brand pricing comparison (Waaree vs APS vs Adani) in customer quotation</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={multiBrandComparison}
                    onChange={(e) => setMultiBrandComparison(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Multi-Panel Comparison Live Preview Card when active */}
              {multiBrandComparison && multiBrandPackages && (
                <div className="p-3.5 rounded-xl bg-primary-container/5 border border-primary/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">compare_arrows</span>
                      Comparative Brand Breakdown ({kw} kW)
                    </span>
                    <span className="text-[10px] text-secondary">Injected into PDF Page 2</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {multiBrandPackages.map((pkg, pIdx) => (
                      <div key={pIdx} className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs space-y-1">
                        <div className="font-bold text-on-surface">{pkg.brand}</div>
                        <div className="text-[11px] text-secondary">{pkg.moduleCount} modules × {pkg.wattage}W</div>
                        <div className="text-primary font-bold">{formatINR(pkg.totalCost)}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold">Net: {formatINR(pkg.netPayable)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Hardware Configuration Tile */}
              <div className="mt-1 rounded-lg bg-surface border border-surface-container-high p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[28px]">energy_savings_leaf</span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {moduleCount}x {panelWatt}W Half-Cut Array Configured
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Requires ~{rooftopAreaSqFt} sq. ft. shadow-free rooftop area
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1 font-label-xs text-primary bg-primary-fixed/40 px-3 py-1 rounded-full font-semibold">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>MNRE Compliant</span>
                  </span>
                </div>
              </div>

              {/* 2D Solar Structure & Panel Layout Presets Studio (Interactive 2D Presets) */}
              <div className="mt-3 rounded-xl bg-gradient-to-r from-[#0F1B2E] via-[#1E293B] to-[#0F1B2E] text-white p-4 shadow-md border border-slate-700/80 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#6CBF3D]/20 text-[#6CBF3D] flex items-center justify-center shrink-0 border border-[#6CBF3D]/40 shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">grid_view</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-white">2D Structure &amp; Panel Layout Presets</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6CBF3D] text-[#0F1B2E] uppercase">
                          Dynamic 2D
                        </span>
                        {selectedStructureLayout?.excelTag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-400 text-slate-950 uppercase">
                            {selectedStructureLayout.excelTag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Active Layout: <span className="text-[#6CBF3D] font-bold">{selectedStructureLayout?.name || `2 Rows × 3 Columns (3×2 Khadi Grid)`}</span>
                        <span className="text-amber-400 font-bold ml-2">
                          • J-Bolts: {selectedStructureLayout?.bom?.jBoltsCount || moduleCount * 4} Pcs
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsInlineLayoutOpen(!isInlineLayoutOpen)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isInlineLayoutOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>{isInlineLayoutOpen ? 'Collapse 2D Studio' : 'Inline Studio'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLayoutStudio(true)}
                      className="px-3.5 py-1.5 bg-[#6CBF3D] hover:bg-[#5ca633] text-[#0F1B2E] font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                      <span>Full 2D Studio ({moduleCount}P)</span>
                    </button>
                  </div>
                </div>

                {/* Inline Collapsible Studio when active */}
                {isInlineLayoutOpen && (
                  <div className="mt-2 pt-3 border-t border-slate-700/80">
                    <PanelLayoutVisualizer
                      initialPanelCount={moduleCount}
                      moduleSpecs={(modulesList || []).find(m => `${m.brand} ${m.model}` === panelBrand)}
                      selectedLayoutId={selectedStructureLayout?.id}
                      initialRoofConfig={quotationRoofConfig}
                      onRoofConfigChange={handleUpdateRoofConfig}
                      onSelectLayout={(layout) => {
                        setSelectedStructureLayout(layout);
                        if (addToast) {
                          addToast({
                            title: '2D Layout Selected',
                            message: `Selected ${layout.name} with ${layout.bom.jBoltsCount} J-Bolts.`,
                            type: 'success'
                          });
                        }
                      }}
                      onClose={() => setIsInlineLayoutOpen(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Full 2D Layout Studio Modal - Full Window Workspace */}
          {showLayoutStudio && (
            <div className="fixed inset-0 z-50 w-screen h-screen bg-[#070D18] flex flex-col overflow-hidden animate-in fade-in duration-150">
              <div className="relative w-full h-full flex flex-col overflow-y-auto">
                <PanelLayoutVisualizer
                  initialPanelCount={moduleCount}
                  moduleSpecs={(modulesList || []).find(m => `${m.brand} ${m.model}` === panelBrand)}
                  selectedLayoutId={selectedStructureLayout?.id}
                  initialRoofConfig={quotationRoofConfig}
                  onRoofConfigChange={handleUpdateRoofConfig}
                  onSelectLayout={(layout) => {
                    setSelectedStructureLayout(layout);
                    if (addToast) {
                      addToast({
                        title: '2D Layout Selected',
                        message: `Selected ${layout.name} with ${layout.bom.jBoltsCount} J-Bolts.`,
                        type: 'success'
                      });
                    }
                  }}
                  onClose={() => setShowLayoutStudio(false)}
                  isModal={true}
                />
              </div>
            </div>
          )}

          {/* Visual Context Imagery Preview */}
          <div className="relative w-full h-44 rounded-xl overflow-hidden shadow-sm border border-surface-container-high">
            <img
              alt="A clean modern suburban house with sleek black photovoltaic solar panels neatly installed"
              className="w-full h-full object-cover"
              src="/solar_field_cover.jpg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/25 to-transparent flex items-end p-3 sm:p-4">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between w-full text-white gap-1">
                <div className="flex items-center gap-1.5 font-label-sm">
                  <span className="material-symbols-outlined text-primary-container text-[16px] sm:text-[18px] shrink-0">verified</span>
                  <span className="font-semibold text-xs sm:text-sm">Standard Tier-1 Rooftop Assembly</span>
                </div>
                <span className="text-[10px] sm:text-xs opacity-85 shrink-0">25 Yr Performance Warranty</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Subsidy Calculator (5 cols on XL) */}
        <div className="xl:col-span-5 flex flex-col gap-6 min-w-0">
          <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 md:p-6 shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-start justify-between pb-4 border-b border-surface-container-high/60 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">calculate</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-secondary-fixed leading-tight">Pricing &amp; Subsidy</h2>
                  <p className="text-xs text-secondary hidden sm:block">PM Surya Ghar DBT computation</p>
                </div>
              </div>
              <span className="text-[10px] text-secondary-fixed-dim uppercase tracking-wider font-semibold shrink-0">Step 1.3</span>
            </div>

            {/* Input Field for Rate per kW */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold" htmlFor="ratePerKw">
                  Rate per kW (₹)
                </label>
                <span className="text-[11px] text-secondary shrink-0">Benchmark: ₹62k–₹68k</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-headline-sm text-headline-sm text-secondary select-none">₹</span>
                <input
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm outline-none shadow-sm border border-surface-container-high focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-bold"
                  id="ratePerKw"
                  max="120000"
                  min="30000"
                  step="1000"
                  type="number"
                  value={ratePerKw}
                  onChange={(e) => setRatePerKw(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Highlighted Auto-Calculated Summary Box */}
            <div className="mt-1 rounded-xl bg-[#F0FDF4] p-5 shadow-xs flex flex-col gap-3.5 relative overflow-hidden border-2 border-[#6CBF3D]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-label-md font-bold">
                  <span className="material-symbols-outlined text-[20px]">auto_graph</span>
                  <span>Central DBT Subsidy Calculated</span>
                </div>
                <span className="material-symbols-outlined text-primary/20 text-[36px] absolute -top-1 -right-1 pointer-events-none">payments</span>
              </div>

              {/* Line 1: Base System Cost */}
              <div className="flex items-center justify-between pt-1 gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-secondary font-medium">Base Hardware &amp; EPC Cost</span>
                  <span className="text-[10px] text-secondary/70">
                    {kw} kW × {formatINR(ratePerKw)}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums whitespace-nowrap text-on-secondary-fixed shrink-0">
                  {formatINR(baseProjectCost)}
                </span>
              </div>

              {/* Line 2: Dealer Margin Added */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-on-surface font-semibold">Dealer Margin</span>
                    {isDirectCompanyQuote ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0">
                        ₹0 Direct Sale
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                        {marginMode === 'percent' ? `${dealerMarginRate}%` : `${effectiveMarginPercent}%`}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-secondary">
                    {isDirectCompanyQuote ? 'Direct company quotation (zero middleman markup)' : 'Added to proposal'}
                  </span>
                </div>
                <span className={`text-sm font-bold tabular-nums whitespace-nowrap shrink-0 ${isDirectCompanyQuote ? 'text-secondary font-medium' : 'text-emerald-700'}`}>
                  {isDirectCompanyQuote ? '₹\u00A00' : `+ ${formatINR(dealerMarginINR)}`}
                </span>
              </div>

              {/* Line 3: Total Project Cost */}
              <div className="flex items-center justify-between gap-2 py-1 border-t border-dashed border-primary/20">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-bold">Total Project Cost</span>
                  <span className="text-[10px] text-secondary">Customer quote before subsidy</span>
                </div>
                <span className="text-sm text-on-secondary-fixed font-black tabular-nums whitespace-nowrap shrink-0">
                  {formatINR(totalCost)}
                </span>
              </div>

              {/* Line 4: Government Subsidy */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-on-surface font-semibold">Govt. Subsidy</span>
                    <span className="bg-primary-container/20 text-on-primary-container text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0">
                      PM Surya Ghar
                    </span>
                  </div>
                  <span className="text-[10px] text-secondary">Central DBT Reimbursement</span>
                </div>
                <span className="text-sm text-primary font-bold tabular-nums whitespace-nowrap shrink-0">
                  - {formatINR(subsidy)}
                </span>
              </div>

              {/* Line 5: Estimated Annual Savings */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-secondary font-medium">Est. Annual Savings</span>
                  <span className="text-[10px] text-secondary">{annualGenerationUnits.toLocaleString()} units / yr</span>
                </div>
                <span className="text-xs text-on-surface font-bold tabular-nums whitespace-nowrap shrink-0">
                  {formatINR(annualSavings)} <span className="text-[10px] text-secondary font-normal">/ yr</span>
                </span>
              </div>

              {/* Line 6: Final Customer Payable (Guaranteed Single Line) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t-2 border-[#6CBF3D]/40">
                <div className="flex flex-col">
                  <span className="font-label-md text-xs sm:text-sm text-on-secondary-fixed uppercase tracking-wider font-bold">
                    Final Customer Payable
                  </span>
                  <span className="font-body-sm text-[11px] text-secondary">Net cost post-DBT reimbursement</span>
                </div>
                <div className="flex items-baseline gap-2 self-start sm:self-auto whitespace-nowrap shrink-0">
                  <span className="text-2xl sm:text-3xl font-black text-on-secondary-fixed tabular-nums whitespace-nowrap inline-flex items-baseline">
                    {formatINR(finalPayable)}
                  </span>
                  <span className="bg-primary text-on-primary text-label-xs px-2 py-0.5 rounded-full shadow-xs font-bold shrink-0">
                    Net
                  </span>
                </div>
              </div>
            </div>

            {/* ROI & Payback Micro-Telemetry Graphic */}
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3 border border-surface-container-high">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary font-medium">Estimated Payback Period</span>
                <span className="font-label-md text-on-surface font-bold">{paybackYears} Years</span>
              </div>
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-primary-container h-full rounded-full transition-all duration-300" style={{ width: `${paybackPercent}%` }}></div>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-label-xs text-secondary gap-2">
                <span className="shrink-0">Break-even: {breakEvenYear}</span>
                <span className="text-right">{25 - Math.ceil(parseFloat(paybackYears))}+ Yrs Free Power</span>
              </div>
            </div>

            {/* Interactive Commercials Card (Dealer Margin OR Admin Company Margin) */}
            <div className="p-3.5 sm:p-4 bg-surface rounded-xl border border-surface-container-high flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-primary text-[18px] sm:text-[20px] shrink-0">
                    {isDirectCompanyQuote ? 'corporate_fare' : 'account_balance_wallet'}
                  </span>
                  <span className="text-xs sm:text-sm text-on-surface font-bold">
                    {isDirectCompanyQuote ? 'Company Margin (कंपनी मार्जिन)' : 'Custom Dealer Margin'}
                  </span>
                  {isDirectCompanyQuote && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6CBF3D]/20 text-[#6CBF3D] border border-[#6CBF3D]/30">
                      Sunvine HO
                    </span>
                  )}
                </div>
                <span className="text-sm sm:text-base text-primary font-bold whitespace-nowrap shrink-0" id="dealerMarginDisplay">
                  {formatINR(dealerMarginINR)}
                </span>
              </div>

              {/* Mode Toggle: % vs ₹ */}
              <div className="flex items-center p-1 bg-surface-container-low rounded-lg border border-surface-container-high self-start">
                <button
                  type="button"
                  onClick={() => setMarginMode('percent')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    marginMode === 'percent'
                      ? 'bg-primary-container text-on-primary shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span>% Percentage</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMarginMode('amount')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    marginMode === 'amount'
                      ? 'bg-primary-container text-on-primary shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span>₹ Fixed Amount</span>
                </button>
              </div>

                {/* Preset Chips & Custom Input */}
                {marginMode === 'percent' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {isDirectCompanyQuote && (
                        <button
                          type="button"
                          onClick={() => setDealerMarginRate(0)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginRate === 0
                              ? 'bg-[#6CBF3D] text-[#0F1B2E] font-bold shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          0%
                        </button>
                      )}
                      {[5, 8, 10, 12, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDealerMarginRate(pct)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginRate === pct
                              ? 'bg-primary-container text-on-primary shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    {/* Custom % Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary font-medium shrink-0">Custom %:</span>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={dealerMarginRate}
                          onChange={(e) => setDealerMarginRate(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 h-8 text-center text-xs font-bold rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                        />
                        <span className="absolute right-2 text-xs text-secondary font-bold pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {isDirectCompanyQuote && (
                        <button
                          type="button"
                          onClick={() => setDealerMarginFixed(0)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginFixed === 0
                              ? 'bg-[#6CBF3D] text-[#0F1B2E] font-bold shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          ₹0
                        </button>
                      )}
                      {[10000, 20000, 30000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDealerMarginFixed(amt)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            dealerMarginFixed === amt
                              ? 'bg-primary-container text-on-primary shadow-xs'
                              : 'bg-surface-container-lowest border border-surface-container-high text-secondary hover:text-on-surface'
                          }`}
                        >
                          ₹{(amt / 1000)}k
                        </button>
                      ))}
                    </div>
                    {/* Custom ₹ Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary font-medium shrink-0">Custom ₹:</span>
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-xs text-secondary font-bold pointer-events-none">₹</span>
                        <input
                          type="number"
                          min="0"
                          max="500000"
                          step="1000"
                          value={dealerMarginFixed}
                          onChange={(e) => setDealerMarginFixed(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 h-8 pl-5 pr-2 text-xs font-bold rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-container-high">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      Spread: <strong className={isMarginExceeded ? 'text-error font-bold' : 'text-on-surface font-bold'}>{formatINR(currentMarginPerKw)} / kW</strong> ({effectiveMarginPercent}%)
                    </span>
                    <span className="text-secondary/60">•</span>
                    <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded font-medium">
                      Cap: <strong>{formatINR(maxMarginCapPerKw)}/kW</strong> ({effectiveDealer?.tier || currentDealer?.tier || 'Gold'})
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-primary font-medium text-[10px] bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    <span>Confidential (Hidden from Customer PDF)</span>
                  </span>
                </div>

                {isMarginExceeded && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-on-surface text-xs flex items-start gap-2.5 mt-1 animate-in fade-in">
                    <span className="material-symbols-outlined text-[18px] text-error shrink-0">warning</span>
                    <div className="flex-1">
                      <div className="font-bold text-error">
                        Tier Margin Cap Exceeded ({formatINR(currentMarginPerKw)}/kW &gt; {formatINR(maxMarginCapPerKw)}/kW)
                      </div>
                      <p className="text-[11px] text-secondary mt-0.5">
                        Your configured spread exceeds the {effectiveDealer?.tier || currentDealer?.tier || 'Standard'} tier threshold. This quotation will be flagged for Super Admin compliance audit upon submission.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (marginMode === 'amount') {
                            setDealerMarginFixed(Math.round(maxMarginCapPerKw * kw));
                          } else {
                            const capPct = Math.min(50, ((maxMarginCapPerKw * kw) / (baseProjectCost || 1)) * 100);
                            setDealerMarginRate(parseFloat(capPct.toFixed(1)));
                          }
                        }}
                        className="mt-1.5 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">tune</span>
                        <span>Clamp to Tier Cap ({formatINR(Math.round(maxMarginCapPerKw * kw))})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

          {/* Action Submission Card (In-flow Form Card for Mobile & Desktop) */}
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-surface-container-high flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-secondary uppercase tracking-wider font-semibold">Ready to proceed?</span>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-bold text-on-surface">Generate Customer Proposal</span>
                <span className="text-xs text-primary font-bold">({kw} kW • {formatINR(finalPayable)})</span>
              </div>
              <p className="text-xs text-secondary">
                Generate official 4-page branded PDF ready for preview &amp; WhatsApp sharing.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleReset}
                type="button"
                className="h-10 px-2 rounded-lg bg-surface-container-lowest text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors border border-surface-container-high shadow-xs cursor-pointer text-xs font-semibold flex items-center justify-center gap-1"
                title="Reset form"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Reset</span>
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                type="button"
                className="h-10 px-2 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors border border-surface-container-high shadow-xs cursor-pointer text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">bookmark_border</span>
                <span className="truncate">{isSubmitting ? 'Saving...' : 'Save Draft'}</span>
              </button>
              <button
                onClick={handlePreview}
                disabled={isSubmitting}
                type="button"
                className="h-10 px-2 rounded-lg bg-[#6CBF3D] hover:bg-[#4F9A2C] active:scale-[0.99] text-white transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer font-bold text-xs disabled:opacity-50"
              >
                <span className="truncate">Preview</span>
                <span className="material-symbols-outlined text-[16px] shrink-0">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inverter Selection Modal */}
      {showInverterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">Select Inverter Model</h3>
              <button
                onClick={() => setShowInverterModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-3">
              {availableInverters.map((inv, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setInverterModel(inv.name);
                    setShowInverterModal(false);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    inverterModel === inv.name
                      ? 'border-primary-container bg-primary/5 ring-1 ring-primary-container'
                      : 'border-surface-container-high hover:border-primary/50'
                  }`}
                >
                  <div>
                    <h4 className="font-label-md text-sm font-bold text-on-surface">{inv.name}</h4>
                    <p className="text-xs text-secondary mt-0.5">{inv.specs}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-container text-primary shrink-0 ml-2">
                    {inv.efficiency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
