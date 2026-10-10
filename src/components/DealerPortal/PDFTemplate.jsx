import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { resolveCapacityBom, getStandardBOSSpecs } from '../../data/standardBomData';
import { calculateSubsidy, DEFAULT_SPECIFIC_YIELD, DEFAULT_TARIFF_PER_UNIT } from '../../shared/pricing/calculations';

// Format Indian Rupee currency with commas
const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(val);
};

// Resolves component manufacturer / brand name (Make)
function resolveItemMake(item, effectiveModuleMake = '', effectiveInverterMake = '') {
  if (item?.make && typeof item.make === 'string' && item.make.trim()) {
    return item.make.trim();
  }
  if (item?.brand && typeof item.brand === 'string' && item.brand.trim()) {
    return item.brand.trim();
  }

  const itemId = String(item?.id || '').toLowerCase();
  const itemName = String(item?.name || item?.item || item?.description || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();

  // 1. Solar PV Modules
  if (itemId.includes('panel') || itemId.includes('module') || category === 'panel' || itemName.includes('solar panel') || itemName.includes('pv module')) {
    return effectiveModuleMake ? `${effectiveModuleMake} / Tier-1` : 'Tier-1 Certified Bifacial';
  }

  // 2. Solar Inverters
  if (itemId.includes('inverter') || category === 'inverter' || itemName.includes('inverter')) {
    return effectiveInverterMake ? `${effectiveInverterMake} / Reputed` : 'MNRE Approved Grid-Tied';
  }

  // 3. Electrical Switchgear (ACDB / DCDB)
  if (itemId.includes('acdb') || itemId.includes('dcdb') || itemName.includes('acdb') || itemName.includes('dcdb') || itemName.includes('combo')) {
    return 'ASG / L&T / Schneider';
  }

  // 4. MC4 Connectors
  if (itemId.includes('mc4') || itemName.includes('mc4')) {
    return 'Staubli / Multi-Contact';
  }

  // 5. DC Solar Cables
  if (itemId.includes('dc_wire') || itemId.includes('dc_cable') || itemName.includes('dc 4') || (itemName.includes('dc') && itemName.includes('cable'))) {
    return 'Polycab / RR Kabel (EN 50618)';
  }

  // 6. AC Grid Cables
  if (itemId.includes('ac_wire') || itemId.includes('ac_cable') || itemName.includes('ac cable') || itemName.includes('grid cable')) {
    return 'Polycab / Havells / RR Kabel';
  }

  // 7. Earthing Cables & LA Cables
  if (itemId.includes('earthing_cable') || itemName.includes('earthing cable')) {
    return 'Polycab / RR Kabel';
  }
  if (itemId.includes('la_cable') || itemName.includes('la cable') || itemName.includes('down conductor')) {
    return 'Polycab / Vasundhara (ISI)';
  }

  // 8. Chemical Earthing Kit
  if (itemId.includes('earthing') || itemName.includes('earthing kit') || itemName.includes('chemical earthing')) {
    return 'Vasundhara / Chemical Gel (IS 3043)';
  }

  // 9. Lightning Arrestor
  if (itemId.includes('lightning') || itemName.includes('lightning arrestor') || itemName.includes('la ')) {
    return 'Vasundhara / Pure Copper';
  }

  // 10. Module Mounting Structure (GI Pipes, Studs, Angles, Purlins)
  if (itemId.includes('gi_pipe') || itemId.includes('purlin') || itemName.includes('pipe') || itemName.includes('purlin') || itemId.includes('stud') || itemId.includes('angels') || itemId.includes('angles') || category === 'structure') {
    if (itemId.includes('fastner') || itemName.includes('fastener') || itemId.includes('j_bolt') || itemId.includes('nut_washer')) {
      return 'Unbrako / Grade 8.8 (HDGI)';
    }
    if (itemId.includes('walkway') || itemName.includes('walkway')) {
      return 'Sunvine / FRP Heavy Duty';
    }
    if (itemId.includes('foundation') || itemName.includes('foundation')) {
      return 'UltraTech / RCC Standard';
    }
    if (itemId.includes('zinc') || itemName.includes('zinc')) {
      return '3M / Rust-Oleum';
    }
    return 'Fortune / Jindal / Tata (HDGI 80μ)';
  }

  // 11. Conduits & Accessories (PVC pipes, elbows, tees, clamps)
  if (category === 'conduits' || itemId.includes('pvc') || itemName.includes('pvc') || itemId.includes('clamp') || itemName.includes('clamp')) {
    return 'Polycab / Precision';
  }

  // 12. Logistics / Transportation
  if (category === 'logistics' || itemId.includes('transport') || itemName.includes('transportation') || itemName.includes('freight')) {
    return 'Doorstep Insured Logistics';
  }

  return 'MNRE / BIS Approved';
}

export default function PDFTemplate({ quotation, activePage = 'all', isPdfExport = false }) {
  const appContext = useApp() || {};
  const systemSettings = quotation?.systemSettings || appContext?.systemSettings || null;

  const {
    id = 'SV-2026-Q801',
    date = new Date().toLocaleDateString('en-GB'),
    customerName = 'Valued Customer',
    customerPhone = '',
    location = 'Rajkot, Gujarat',
    city = 'Rajkot',
    systemCapacityKW,
    capacityKW,
    capacity,
    solarModule = '585W TOPCon Bifacial',
    moduleWattage,
    moduleCount,
    pvModuleSize = '2278 × 1134 × 30 mm',
    inverterCapacity,
    inverterCount = '1 NOS',
    inverterType = 'Sunvine Solaryaan 5.0G (1-Phase 2 MPPT)',
    baseRatePerKW = 0,
    dealerMarginPerKW = 0,
    dealerName,
    isDirectCompanyQuote,
    projectType = 'Residential',
    multiBrandComparison = false,
    multiBrandPackages = null,
    selectedModuleMake = '',
    selectedInverterMake = '',
    coverImage,
    customCoverUrl,
    bomItems,
    companyProfile: initialCompanyProfile = null
  } = quotation || {};

  const fallbackProfile = appContext?.systemSettings?.companyProfile || appContext?.systemSettings?.company_profile || appContext?.officialProfile || {};
  const rawCompanyProfile = initialCompanyProfile || quotation?.companyProfile || quotation?.company_profile || {};
  const companyProfile = {
    ...fallbackProfile,
    ...rawCompanyProfile,
    bank: {
      ...(fallbackProfile?.bank || fallbackProfile?.bankDetails || {}),
      ...(rawCompanyProfile?.bank || rawCompanyProfile?.bankDetails || {})
    }
  };

  // Resolve numerical capacity and dimensions
  const resolvedCapKW = Number(parseFloat(systemCapacityKW || capacityKW || capacity || 3.3).toFixed(3));
  const rawWattMatch = (solarModule || '').match(/(\d{3})\s*W/i);
  const resolvedWatt = Number(moduleWattage || (rawWattMatch ? rawWattMatch[1] : 585));
  const resolvedCount = Number(moduleCount || Math.ceil((resolvedCapKW * 1000) / resolvedWatt) || 6);
  const resolvedArea = Math.round(resolvedCapKW * 64);

  const effectiveModuleMake = selectedModuleMake || (solarModule ? solarModule.split(' ')[0] : 'WAAREE');
  const effectiveInverterMake = selectedInverterMake || (inverterType ? inverterType.split(' ')[0] : 'SOLARYAAN');
  const resolvedInverterCap = inverterCapacity || `${resolvedCapKW} kW`;

  // Standard engineering BOM for this capacity
  const resolvedBom = resolveCapacityBom(resolvedCapKW);
  const bomQtyMap = (resolvedBom?.items || []).reduce((acc, i) => {
    acc[i.id] = i.quantity;
    return acc;
  }, {});

  // Official Engineering BOS Matrix Specifications (Source: BOS PRICE LIST ALL (1).pdf)
  const standardBOSSpecs = useMemo(() => {
    return getStandardBOSSpecs(resolvedCapKW, resolvedCount);
  }, [resolvedCapKW, resolvedCount]);

  const bomDisplayItems = useMemo(() => {
    const s = standardBOSSpecs;
    return [
      {
        sr: 1,
        name: 'MODULES / PANNELS',
        desc: `${resolvedWatt}W High-Efficiency TOPCon Mono Bifacial Dual-Glass`,
        qty: `${resolvedCount} Nos`,
        make: `${effectiveModuleMake} / Tier-1 ALMM`
      },
      {
        sr: 2,
        name: 'INVERTER',
        desc: `High-Efficiency On-Grid String Inverter (${resolvedInverterCap}), Dual MPPT`,
        qty: '1 Unit',
        make: effectiveInverterMake.includes('/') ? effectiveInverterMake : `${effectiveInverterMake} / Any Reputed`
      },
      {
        sr: 3,
        name: 'DC WIRE (RED)',
        desc: '1C × 4 sq.mm UV/Ozone-resistant Dual-Insulated Solar Cable (EN 50618)',
        qty: s.dcWireRed,
        make: 'Polycab / RR Kabel (EN 50618)'
      },
      {
        sr: 4,
        name: 'DC WIRE (BLACK)',
        desc: '1C × 4 sq.mm UV/Ozone-resistant Dual-Insulated Solar Cable (EN 50618)',
        qty: s.dcWireBlack,
        make: 'Polycab / RR Kabel (EN 50618)'
      },
      {
        sr: 5,
        name: 'AC WIRE (RED)',
        desc: 'Multi-Core Copper Cable connecting Inverter AC output to Main Panel (IS 694)',
        qty: s.acWireRed,
        make: 'Polycab / Havells / RR Kabel'
      },
      {
        sr: 6,
        name: 'AC WIRE (BLACK)',
        desc: 'Multi-Core Copper Cable connecting Inverter AC output to Main Panel (IS 694)',
        qty: s.acWireBlack,
        make: 'Polycab / Havells / RR Kabel'
      },
      {
        sr: 7,
        name: 'EARTHING WIRE',
        desc: 'Dedicated Grounding Wire for Solar Array, Inverter & Structure (IS 3043)',
        qty: s.earthingWire,
        make: 'Polycab / RR Kabel (IS 3043)'
      },
      {
        sr: 8,
        name: 'LA WIRE',
        desc: 'Lightning Arrester Down Conductor High-Grade Copper/Al Cable (IS 2309)',
        qty: s.laWire,
        make: 'Polycab / Reputed (1C × 16 sq.mm)'
      },
      {
        sr: 9,
        name: 'ACDB',
        desc: 'IP65 Weatherproof Enclosure with Class-II Surge Protection (SPD) & MCB',
        qty: `1 Unit (${s.acdb})`,
        make: 'L&T / Schneider / ASG'
      },
      {
        sr: 10,
        name: 'DCDB',
        desc: 'IP65 Weatherproof Enclosure with Class-II Surge Protection (SPD) & DC Isolator',
        qty: `1 Unit (${s.dcdb})`,
        make: 'L&T / Schneider / ASG'
      },
      {
        sr: 11,
        name: 'EARTHING KIT',
        desc: 'Maintenance-Free Chemical Gel Earthing Pit with Copper-Bonded Electrode',
        qty: s.earthingKit,
        make: 'Vasundhara / Chemical Gel (IS 3043)'
      },
      {
        sr: 12,
        name: 'PVC PIPE',
        desc: 'Heavy Duty Rigid PVC Conduit Piping (25mm Heavy Gauge ISI)',
        qty: s.pvcPipe,
        make: 'Precision / Reputed (ISI Heavy Duty)'
      },
      {
        sr: 13,
        name: 'PVC ELBOW',
        desc: 'Heavy Duty Rigid PVC Conduit Elbow Bends (25mm)',
        qty: s.pvcElbow,
        make: 'Precision / Standard Heavy Duty'
      },
      {
        sr: 14,
        name: 'PVC TEE',
        desc: 'Heavy Duty Rigid PVC Conduit Three-Way Tee Junctions (25mm)',
        qty: s.pvcTee,
        make: 'Precision / Standard Heavy Duty'
      },
      {
        sr: 15,
        name: 'PVC CLAMP',
        desc: 'Heavy Duty PVC Saddle Mounting Clamps with Screws',
        qty: s.pvcClamp,
        make: 'Standard Heavy Duty Saddle Clips'
      },
      {
        sr: 16,
        name: 'ANGLE',
        desc: 'Structural Galvanized L-Angle & Cleat Brackets (IS 2062)',
        qty: 'As Per Requirement',
        make: 'Hot-Dip Galvanized (HDGI / MS IS 2062)'
      },
      {
        sr: 17,
        name: 'ANCHOR FASTNER',
        desc: 'RCC Heavy-Duty Anchor Mechanical Fasteners (Grade 8.8)',
        qty: 'As Per Requirement',
        make: 'Galvanized Mechanical Wedge Fasteners'
      },
      {
        sr: 18,
        name: 'CABLE TIE',
        desc: 'UV-Resistant Heavy-Duty Black Nylon Cable Ties',
        qty: s.cableTie,
        make: 'Standard Heavy Duty UV Black Pack'
      },
      {
        sr: 19,
        name: 'J BOLT',
        desc: 'Module Rail Fastening & Purline J-Bolts with Flange Nuts',
        qty: s.jBolt,
        make: 'Galvanized High-Tensile J-Bolts'
      },
      {
        sr: 20,
        name: 'MC4 CONNECTOR',
        desc: 'IP68 Weatherproof Dual-Contact Solar MC4 Pairs (Male + Female)',
        qty: s.mc4,
        make: 'Multi-Contact / IP68 Certified Pairs'
      },
      {
        sr: 21,
        name: 'ZINC SPRAY',
        desc: 'Cold Galvanizing Anti-Rust Protective Coating Spray',
        qty: 'As Per Requirement',
        make: 'Anti-Rust Cold Galvanizing Spray'
      },
      {
        sr: 22,
        name: 'STUD',
        desc: '12×2M Structural Galvanized Threaded Studs Grade 8.8',
        qty: 'As Per Requirement',
        make: 'Galvanized High-Tensile Studs Grade 8.8'
      },
      {
        sr: 23,
        name: 'HOTDIP PIPE',
        desc: 'Elevated Hot-Dip Galvanized Structure Pipe (Height 6-8 Ft, 80+ Micron)',
        qty: 'As Per Requirement',
        make: 'Hindustan / Fortune HDGI (80μ Coating)'
      }
    ];
  }, [standardBOSSpecs, resolvedWatt, resolvedCount, effectiveModuleMake, effectiveInverterMake, resolvedInverterCap]);

  // Commercial financial figures
  const customerRatePerKW = baseRatePerKW + (dealerMarginPerKW || 0);
  const extraTransportCharge = Number(quotation.extraTransportAmount || (quotation.hasExtraTransport ? quotation.transportCharge : 0)) || 0;
  const grossTurnkey = quotation.grandTotalCustomer || quotation.totalAmount || (Math.round(customerRatePerKW * resolvedCapKW) + extraTransportCharge);

  const isInterState = quotation.isInterState || (String(quotation.customerState || quotation.state || 'Gujarat').trim().toLowerCase() !== 'gujarat');
  const gstRate = Number(quotation.gstPercentage || quotation.gstPercent || 18);
  const baseBeforeGst = quotation.baseBeforeGst || Math.round(grossTurnkey / (1 + (gstRate / 100)));
  const gstAmount = quotation.gstAmount || (grossTurnkey - baseBeforeGst);
  const cgstAmount = quotation.cgstAmount !== undefined ? quotation.cgstAmount : (isInterState ? 0 : Math.round(gstAmount / 2));
  const sgstAmount = quotation.sgstAmount !== undefined ? quotation.sgstAmount : (isInterState ? 0 : gstAmount - cgstAmount);
  const igstAmount = quotation.igstAmount !== undefined ? quotation.igstAmount : (isInterState ? gstAmount : 0);

  const subsidyAmount = quotation.subsidyAmount !== undefined
    ? quotation.subsidyAmount
    : calculateSubsidy(resolvedCapKW, projectType);
  const netPayable = quotation.netPayable !== undefined ? quotation.netPayable : Math.max(0, grossTurnkey - subsidyAmount);

  const transportCharge = quotation.transportCharge !== undefined ? quotation.transportCharge : (extraTransportCharge || 1000);
  const installationCost = quotation.installationEstimatedCost || (quotation.installationPricingMode === 'fixed' ? Number(quotation.installationFixedAmount || 0) : (Number(quotation.installationRatePerKw) ? Math.round(resolvedCapKW * Number(quotation.installationRatePerKw)) : Math.round(resolvedCapKW * 2000)));
  const moduleCost = quotation.moduleEstimatedCost || Math.round(resolvedWatt * resolvedCount * (Number(quotation.ratePerWp) || 18.00));
  const inverterCost = quotation.inverterEstimatedCost || Math.round(resolvedCapKW <= 3 ? 29800 : resolvedCapKW <= 5.5 ? 42000 : resolvedCapKW <= 7 ? 48500 : 72000);
  const structureCost = quotation.structureEstimatedCost || Math.round(resolvedCount * 3200);
  const bosCost = quotation.bosEstimatedCost || Math.max(0, baseBeforeGst - (moduleCost + inverterCost + structureCost + transportCharge + installationCost));

  // Telemetry metrics
  const specificYield = Number(
    quotation.specificYield ||
    quotation.peakSunHours ||
    systemSettings?.governance_settings?.default_specific_yield
  ) || DEFAULT_SPECIFIC_YIELD;

  const annualYieldMultiplier = specificYield > 100 ? specificYield : (specificYield > 0 ? specificYield * 365 : 1440);

  const annualGenUnits = Number(quotation.annualGenerationUnits) > 0
    ? Number(quotation.annualGenerationUnits)
    : Number(quotation.annual_generation_kwh) > 0
      ? Math.round(Number(quotation.annual_generation_kwh))
      : Math.round(resolvedCapKW * annualYieldMultiplier);

  const tariff = Number(
    quotation.tariff ||
    systemSettings?.governance_settings?.default_tariff
  ) || DEFAULT_TARIFF_PER_UNIT;

  const annualSavings = Number(quotation.annualSavings) > 0
    ? Number(quotation.annualSavings)
    : Math.round(annualGenUnits * tariff);

  const paybackYears = (quotation.paybackYears && quotation.paybackYears !== '0.0' && quotation.paybackYears !== '0' && !isNaN(Number(quotation.paybackYears)))
    ? String(quotation.paybackYears)
    : annualSavings > 0
      ? (netPayable / annualSavings).toFixed(1)
      : '3.6';

  // Multi-brand comparative proposal packages
  const resolvedMultiBrandPackages = useMemo(() => {
    if (!multiBrandComparison) return null;
    if (multiBrandPackages && Array.isArray(multiBrandPackages) && multiBrandPackages.length > 0) {
      return multiBrandPackages;
    }
    const candidates = [
      { name: 'Waaree 585W TOPCon Bifacial', brand: 'Waaree', wattage: 585, rateOffset: 0 },
      { name: 'APS 600W TOPCon Bifacial', brand: 'APS', wattage: 600, rateOffset: -600 },
      { name: 'Adani 550W Vertex Mono PERC', brand: 'Adani', wattage: 550, rateOffset: 500 }
    ];
    return candidates.map((c) => {
      const pWatt = c.wattage;
      const count = Math.ceil((resolvedCapKW * 1000) / pWatt);
      const pkgRate = customerRatePerKW + c.rateOffset;
      const tCost = Math.round(resolvedCapKW * pkgRate);
      const payable = Math.max(0, tCost - subsidyAmount);
      return {
        brand: c.brand,
        name: c.name,
        wattage: pWatt,
        moduleCount: count,
        ratePerKw: pkgRate,
        totalCost: tCost,
        subsidy: subsidyAmount,
        netPayable: payable
      };
    });
  }, [multiBrandComparison, multiBrandPackages, resolvedCapKW, customerRatePerKW, subsidyAmount]);

  if (!quotation) return null;

  // Verify company billing completeness (GSTIN and Bank Account must be non-empty)
  const hasGstin = Boolean(companyProfile?.gstin && String(companyProfile.gstin).trim());
  const bankAcc = companyProfile?.bank?.accountNumber || companyProfile?.bank?.account_number || companyProfile?.bankDetails?.accountNumber || companyProfile?.bankDetails?.account_number;
  const hasBank = Boolean(bankAcc && String(bankAcc).trim());
  const isBillingProfileComplete = hasGstin && hasBank;

  if (!isBillingProfileComplete) {
    return (
      <div data-testid="pdf-blocking-message" className="pdf-document w-full max-w-2xl mx-auto my-12 p-8 bg-red-950/20 border-2 border-red-500/50 rounded-2xl text-center flex flex-col items-center gap-4 text-white">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl">error_outline</span>
        </div>
        <h2 className="text-xl font-bold text-red-200">Quotation PDF Generation Blocked</h2>
        <p className="text-sm text-red-300/90 max-w-md">
          Company GSTIN and Bank Account details are required before generating, previewing, or exporting official quotation documents.
        </p>
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs font-mono text-red-300 text-left w-full max-w-xs">
          <div>GSTIN: {hasGstin ? 'Configured' : 'MISSING (Empty)'}</div>
          <div>Bank Account: {hasBank ? 'Configured' : 'MISSING (Empty)'}</div>
        </div>
        <p className="text-xs text-gray-400">
          Please navigate to Admin Settings &gt; Company Profile to configure the official billing profile.
        </p>
      </div>
    );
  }

  const rawCoverSrc = customCoverUrl || coverImage || '/sunvine_quotation_cover.png';
  const resolvedCoverSrc = rawCoverSrc.includes('?') ? rawCoverSrc : `${rawCoverSrc}?v=20261010`;

  return (
    <div className="pdf-document font-sans text-[#0F1B2E] bg-white print:bg-white select-none">
      {/* ========================================================
          PAGE 1: DYNAMIC SUNVINE PROPOSAL COVER PAGE (SR-34)
          ======================================================== */}
      <div
        className={`pdf-page pdf-page-cover relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto bg-white ${
          isPdfExport ? 'border-none shadow-none m-0 mb-0' : 'border border-gray-300 shadow-xl mb-8'
        } print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!p-0 print:!h-[295mm] print:!max-h-[295mm] overflow-hidden items-center justify-center box-border ${
          activePage === 'all' || activePage === 1 ? 'flex' : 'hidden print:flex'
        }`}
        style={isPdfExport ? { width: '210mm', height: '297mm', maxHeight: '297mm', margin: 0, padding: 0 } : undefined}
      >
        <img
          src={resolvedCoverSrc}
          alt="Sunvine Quotation Cover"
          className="w-full h-full object-fill block select-none"
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
        />
      </div>

      {/* ========================================================
          PAGE 2: EXECUTIVE COMMERCIAL PROPOSAL & SYSTEM SPECIFICATION
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-8 flex flex-col justify-between bg-white ${isPdfExport ? 'border-none shadow-none m-0 mb-0' : 'border border-gray-300 shadow-xl mb-8'} print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] overflow-hidden box-border ${activePage === 'all' || activePage === 2 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header with Corporate Identity */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.webp" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  SUNVINE RENEWABLE ENERGY
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  ISO 9001:2015 &amp; MNRE Registered Solar EPC Channel Partner • Gujarat
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block bg-[#0B2545] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                REF: {id}
              </div>
              <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                Date: <strong className="text-gray-900">{date}</strong> | Validity: <strong>15 Days</strong>
              </p>
            </div>
          </div>

          {/* Color Gradient Accent Bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* Section: Project & Client Intelligence Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3 bg-[#F8FAFC] border border-slate-200 rounded-lg p-3">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Client Information</div>
              <div className="text-xs font-black text-[#0B2545] uppercase mt-0.5">{customerName}</div>
              <div className="text-[11px] text-gray-700 mt-0.5">
                <span>Site: {location || `${city}, Gujarat`}</span>
                {customerPhone && <span className="ml-2 font-mono">| Mo: {customerPhone}</span>}
              </div>
              <div className="text-[10px] text-[#2E7D32] font-bold mt-0.5">
                Scheme: {projectType === 'Commercial' ? 'Commercial / Industrial Captive Solar' : 'PM Surya Ghar: Muft Bijli Yojana (Central Subsidy)'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System Architecture</div>
              <div className="text-xs font-black text-[#0B2545] mt-0.5">
                {resolvedCapKW} kW On-Grid Solar PV Plant
              </div>
              <div className="text-[11px] text-gray-700 mt-0.5">
                {resolvedCount} Pcs × {resolvedWatt}W {effectiveModuleMake} TOPCon ({parseFloat(((resolvedCount * resolvedWatt) / 1000).toFixed(3))} kWp)
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                Inverter: {inverterType.split('(')[0]?.trim() || inverterType} • Roof: ~{resolvedArea} Sq. Ft.
              </div>
            </div>
          </div>

          {/* Heading: Commercial Price Breakdown */}
          <div className="flex items-center justify-between my-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-3.5 bg-[#2E7D32] inline-block rounded-xs"></span>
              <h2 className="text-xs font-black text-[#0B2545] tracking-wide uppercase">
                COMMERCIAL PROPOSAL &amp; STATUTORY TAX BREAKDOWN
              </h2>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold">All figures in Indian Rupees (INR)</span>
          </div>

          {/* SYSTEM CONFIGURATION & SCOPE OVERVIEW */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-2.5">
            <div className="text-[10px] font-black text-[#0B2545] uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>SYSTEM CONFIGURATION &amp; SCOPE INCLUDED</span>
              <span className="text-emerald-700 font-bold">{resolvedCapKW} kW On-Grid System</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-gray-800">
              <div className="flex items-start gap-1.5">
                <span className="text-[#2E7D32] font-bold">✔</span>
                <span><strong>Solar PV Modules:</strong> {resolvedCount} Nos × {resolvedWatt}W {effectiveModuleMake} TOPCon Mono Bifacial</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#2E7D32] font-bold">✔</span>
                <span><strong>Solar Inverter:</strong> 1 Unit ({inverterType.split('(')[0]?.trim() || inverterType}) with WiFi Monitoring</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#2E7D32] font-bold">✔</span>
                <span><strong>Structure:</strong> Elevated HDGI (6 to 8 Ft Height, 150 km/h wind rated)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[#2E7D32] font-bold">✔</span>
                <span><strong>Electrical BOS:</strong> ACDB/DCDB, UV Solar DC &amp; AC Cables, Earthing &amp; LA</span>
              </div>
              <div className="flex items-start gap-1.5 col-span-2">
                <span className="text-[#2E7D32] font-bold">✔</span>
                <span><strong>EPC Services:</strong> Complete Installation, Testing, Commissioning &amp; DISCOM Net-Metering Liaisoning</span>
              </div>
            </div>
          </div>

          {/* TABLE: CLEAN COMMERCIAL SUMMARY & STATUTORY TAX BREAKDOWN */}
          <div className="overflow-hidden border border-slate-300 rounded-md mb-2.5 shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-2 px-3 font-bold uppercase border-r border-slate-700 w-12 text-center">SR</th>
                  <th className="py-2 px-3 font-bold uppercase border-r border-slate-700">PARTICULARS / COMMERCIAL DESCRIPTION</th>
                  <th className="py-2 px-3 font-bold uppercase text-right w-44">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-gray-900 font-medium">
                {/* 1. Base Taxable Value */}
                <tr className="bg-white">
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">1</td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <span className="font-bold text-[#0B2545]">Total System Cost (Excluding GST)</span>
                    <p className="text-[10px] text-gray-500">
                      Taxable base value for complete {resolvedCapKW} kW Solar PV Plant supply, hardware &amp; installation services
                    </p>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-gray-900">
                    {formatINR(baseBeforeGst)}
                  </td>
                </tr>

                {/* 2. Statutory GST Breakdown */}
                {isInterState ? (
                  <tr className="bg-slate-50/60">
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-mono text-gray-500">2</td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <span className="font-bold text-[#0B2545]">Integrated GST (IGST - {gstRate}%)</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">(Statutory Interstate Tax)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-sm text-emerald-800">
                      {formatINR(igstAmount)}
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr className="bg-slate-50/40">
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">2</td>
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="font-semibold text-gray-700">Central GST (CGST - {(gstRate / 2)}%)</span>
                        <span className="text-[10px] text-gray-500 ml-1.5">(Central Share)</span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-xs text-gray-800">
                        {formatINR(cgstAmount)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/40">
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-gray-500">3</td>
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="font-semibold text-gray-700">State GST (SGST - {(gstRate / 2)}% / Gujarat)</span>
                        <span className="text-[10px] text-gray-500 ml-1.5">(State Share)</span>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-xs text-gray-800">
                        {formatINR(sgstAmount)}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/40 border-t border-emerald-200 font-bold">
                      <td className="py-1.5 px-3 text-center border-r border-slate-200 font-mono text-emerald-800">•</td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-emerald-950">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded uppercase font-bold">GST Included</span>
                          <span>Total Statutory GST ({gstRate}%)</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-xs text-emerald-900">
                        {formatINR(gstAmount)}
                      </td>
                    </tr>
                  </>
                )}

                {/* Extra Doorstep Transport & Logistics (if added by dealer) */}
                {extraTransportCharge > 0 && (
                  <tr className="bg-blue-50/40 border-t border-blue-200">
                    <td className="py-2 px-3 text-center border-r border-slate-200 font-mono text-gray-500">•</td>
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded uppercase font-bold">LOGISTICS</span>
                        <span className="font-bold text-[#0B2545]">Doorstep Transport &amp; Freight</span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        Dedicated outstation site delivery, safe transit &amp; insurance
                      </p>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-sm text-blue-900">
                      ₹ {formatINR(extraTransportCharge)}
                    </td>
                  </tr>
                )}

                {/* 3. Total Project Cost */}
                <tr className="bg-[#0B2545] text-white font-black">
                  <td className="py-2.5 px-3 text-center border-r border-slate-700 font-mono">•</td>
                  <td className="py-2.5 px-3 uppercase tracking-wider text-xs border-r border-slate-700">
                    TOTAL PROJECT COST (INCLUSIVE OF ALL TAXES)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-base font-black text-amber-300">
                    ₹ {formatINR(grossTurnkey)}
                  </td>
                </tr>

                {/* 4. PM Surya Ghar Central Subsidy */}
                {subsidyAmount > 0 && (
                  <tr className="bg-emerald-100/90 text-emerald-950 font-bold">
                    <td className="py-2 px-3 text-center border-r border-emerald-300 font-mono">•</td>
                    <td className="py-2 px-3 border-r border-emerald-300">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold">CENTRAL SUBSIDY</span>
                        <span>Less: PM Surya Ghar Muft Bijli Yojana Central Subsidy</span>
                      </div>
                      <p className="text-[10px] text-emerald-800 font-normal">
                        Direct-to-bank account reimbursement by Central Government
                      </p>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-sm text-emerald-900">
                      - ₹ {formatINR(subsidyAmount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Luxury Net Payable Highlight Banner */}
          <div className="bg-gradient-to-r from-[#1B5E20] via-[#2E7D32] to-[#1B5E20] text-white rounded-lg p-2.5 px-4 mb-2.5 flex items-center justify-between shadow-md">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                Final Net Investment Post-Subsidy
              </div>
              <div className="text-xs font-semibold text-white/90">
                Direct bank reimbursement by Ministry of New &amp; Renewable Energy (MNRE)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-mono tracking-tight text-white">
                ₹ {formatINR(netPayable)}
              </span>
              <span className="bg-amber-400 text-slate-950 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded shadow-xs">
                Net Cost
              </span>
            </div>
          </div>

          {/* MULTI-BRAND COMPARATIVE PROPOSAL TABLE */}
          {resolvedMultiBrandPackages && resolvedMultiBrandPackages.length > 0 && (
            <div className="overflow-hidden border border-emerald-400/60 rounded-md mb-2.5 shadow-2xs">
              <div className="bg-gradient-to-r from-[#0B2545] via-[#1B5E20] to-[#0B2545] text-white px-2.5 py-1 flex items-center justify-between">
                <span className="text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-amber-300 text-xs">★</span> TIER-1 MULTI-PANEL BRAND COMPARATIVE PROPOSAL ({resolvedCapKW} kW)
                </span>
                <span className="text-[8.5px] text-emerald-200 font-semibold uppercase tracking-wider">Side-by-Side Options</span>
              </div>
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[9px]">
                  <tr>
                    <th className="py-1 px-2.5 border-r border-slate-200">BRAND / MODULE TECHNOLOGY</th>
                    <th className="py-1 px-2 text-center border-r border-slate-200 w-28">ARRAY CONFIG</th>
                    <th className="py-1 px-2 text-right border-r border-slate-200 w-24">GROSS COST (₹)</th>
                    <th className="py-1 px-2 text-right border-r border-slate-200 w-24">CENTRAL SUBSIDY (₹)</th>
                    <th className="py-1 px-2.5 text-right font-black text-emerald-900 bg-emerald-50/90 w-28">NET PAYABLE (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900 font-medium text-[9.5px]">
                  {resolvedMultiBrandPackages.map((pkg, pIdx) => {
                    const isSelected = (effectiveModuleMake && pkg.brand?.toLowerCase().includes(effectiveModuleMake.toLowerCase())) || pIdx === 0;
                    return (
                      <tr key={pIdx} className={isSelected ? 'bg-emerald-50/80 font-bold' : 'bg-white'}>
                        <td className="py-1 px-2.5 border-r border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#0B2545]">{pkg.name || `${pkg.brand} ${pkg.wattage}W`}</span>
                            {isSelected && (
                              <span className="bg-[#2E7D32] text-white text-[7.5px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider">
                                Proposed
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1 px-2 text-center border-r border-slate-200 font-mono text-[9px] text-slate-700">
                          {pkg.moduleCount} Nos × {pkg.wattage}W
                        </td>
                        <td className="py-1 px-2 text-right font-mono border-r border-slate-200">
                          {formatINR(pkg.totalCost)}
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-emerald-800 border-r border-slate-200">
                          - {formatINR(pkg.subsidy !== undefined ? pkg.subsidy : subsidyAmount)}
                        </td>
                        <td className="py-1 px-2.5 text-right font-mono font-black text-[10.5px] text-emerald-950 bg-emerald-50/90">
                          ₹ {formatINR(pkg.netPayable)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Solar Loan Financing & Monthly EMI (Issue SR-64) */}
          {(quotation.financeType === 'LOAN' || quotation.paymentMode === 'LOAN') && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 px-4 mb-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[20px]">account_balance</span>
                <div>
                  <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                    Solar Bank Loan &bull; {quotation.loanBank || 'Surya Ghar Loan Scheme'}
                  </div>
                  <div className="text-xs text-amber-800">
                    Tenure: {quotation.loanTenureYears || 5} Years ({(quotation.loanTenureYears || 5) * 12} Months) &bull; Standard Concessional Priority Lending
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold text-amber-800">Estimated Monthly EMI</div>
                <div className="text-base font-black text-amber-950 font-mono">
                  {formatINR(quotation.estimatedMonthlyEmi || Math.round((netPayable * 0.085 / 12 * Math.pow(1 + 0.085 / 12, (quotation.loanTenureYears || 5) * 12)) / (Math.pow(1 + 0.085 / 12, (quotation.loanTenureYears || 5) * 12) - 1)))} <span className="text-[10px] font-normal text-amber-800">/ mo</span>
                </div>
              </div>
            </div>
          )}

          {/* Key ROI & Energy Telemetry Badges */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Est. Annual Generation</div>
              <div className="text-sm font-black text-[#0B2545] font-mono mt-0.5">
                ~{annualGenUnits.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-gray-600">Units/Yr</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">4.0–4.2 units / kW / day average</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Est. Annual Savings</div>
              <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                ₹ {formatINR(annualSavings)} <span className="text-[10px] font-normal text-gray-600">/ Year</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">Calculated @ ₹6.67/unit benchmark</div>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-center">
              <div className="text-[10px] font-bold text-gray-500 uppercase">Estimated Payback</div>
              <div className="text-sm font-black text-[#0B2545] font-mono mt-0.5">
                {paybackYears} <span className="text-[10px] font-normal text-gray-600">Years</span>
              </div>
              <div className="text-[9px] text-emerald-700 font-bold mt-0.5">21+ Yrs Free Solar Electricity</div>
            </div>
          </div>

          {/* Official Bank Coordinates & Company Legal Identifiers */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-md p-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 mb-1">
              <span className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider">
                Official Banking Settlement Coordinates
              </span>
              <span className="text-[10px] font-mono text-gray-600">GSTIN: <strong>24AAMCS7145F1ZA</strong></span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-800">
              <div>
                <span className="text-gray-500 font-medium">Beneficiary:</span> <strong>SUNVINE RENEWABLE</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Bank:</span> <strong>HDFC BANK LTD.</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Branch:</span> <strong>METODA GIDC, RAJKOT</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">A/C No.:</span> <strong className="font-mono">99998000050580</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">IFSC:</span> <strong className="font-mono">HDFC0002012</strong>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Email:</span> <strong>sunvinerenewable@gmail.com</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Commercial Proposal • Ref: {id}</span>
          <span>Page 2 of 4</span>
        </div>
      </div>

      {/* ========================================================
          PAGE 3: ENGINEERING BILL OF MATERIALS (BOM) & COMPLIANCE
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-5 sm:p-6 print:!p-5 flex flex-col justify-between bg-white ${isPdfExport ? 'border-none shadow-none m-0 mb-0' : 'border border-gray-300 shadow-xl mb-8'} print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] overflow-hidden box-border ${activePage === 'all' || activePage === 3 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.webp" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  BILL OF MATERIALS &amp; TECHNICAL STANDARDS
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  MNRE Approved • ALMM List-I Tier-1 Components • BIS &amp; IEC Certified
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-[#0B2545] font-mono">{resolvedCapKW} kW System</div>
              <p className="text-[10px] text-gray-600 mt-0.5">Ref: {id}</p>
            </div>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* SIMPLIFIED BILL OF MATERIALS & TECHNICAL STANDARDS (High-Level Scope, No Raw Contractor Breakdown) */}
          <div className="overflow-hidden border border-slate-300 rounded-md mb-2 shadow-2xs">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-[#0B2545] text-white">
                <tr>
                  <th className="py-2 px-2.5 font-bold uppercase w-10 text-center border-r border-slate-700">SR</th>
                  <th className="py-2 px-3 font-bold uppercase border-r border-slate-700">EQUIPMENT / COMPONENT DESCRIPTION</th>
                  <th className="py-2 px-2.5 font-bold uppercase text-center w-28 border-r border-slate-700">QUANTITY</th>
                  <th className="py-2 px-2.5 font-bold uppercase text-center w-48">APPROVED OEM MAKE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-gray-900 font-medium">
                {bomDisplayItems.map((item, idx) => {
                  const isRequirement = item.qty === 'As Per Requirement';
                  return (
                    <tr key={item.sr} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-1 px-2 text-center border-r border-slate-200 font-mono text-gray-500 font-bold text-[9px]">
                        {item.sr}
                      </td>
                      <td className="py-1 px-2.5 border-r border-slate-200">
                        <div className="font-bold text-[#0B2545] text-[9.5px] leading-tight">
                          {item.name}
                        </div>
                        {item.desc && (
                          <div className="text-[8.5px] text-gray-500 leading-tight">
                            {item.desc}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-2 text-center border-r border-slate-200 font-mono font-bold text-[9px] text-[#0B2545]">
                        {isRequirement ? (
                          <span className="text-emerald-800 font-bold text-[8.5px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 inline-block">
                            As Per Requirement
                          </span>
                        ) : (
                          item.qty
                        )}
                      </td>
                      <td className="py-1 px-2 text-center text-gray-800 text-[9px] font-semibold leading-tight">
                        {item.make}
                      </td>
                    </tr>
                  );
                })}

                {/* Compliance Summary Footer */}
                <tr className="bg-[#0B2545] text-white font-bold text-[9.5px] border-t border-slate-700">
                  <td colSpan={3} className="py-1 px-3 uppercase tracking-wide border-r border-slate-700">
                    ALL SYSTEM COMPONENTS 100% MNRE APPROVED &amp; BIS / IEC COMPLIANT
                  </td>
                  <td className="py-1 px-2 text-center font-bold text-amber-300 uppercase text-[9px]">
                    APPROVED OEM QUALITY
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Scope of Work & Statutory Checklist */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-md p-3 mb-2">
            <div className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider mb-1">
              Comprehensive EPC Scope of Work &amp; Statutory Approvals Included
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>DISCOM Net-Metering Application &amp; Sanctioning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>Bi-Directional Meter Testing Coordination</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>Dual Chemical Gel Earthing Pits (&lt; 5 Ohms Certified)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#2E7D32] font-bold text-xs">✔</span>
                <span>WiFi Cloud Telemetry &amp; Mobile App Handover</span>
              </div>
            </div>
          </div>

          {/* Bottom Engineering Notes */}
          <div className="text-[9.5px] text-gray-600 leading-normal border-t border-slate-200 pt-1.5">
            <p><strong>* Note:</strong> Standard BOM quantities are calibrated for standard RCC rooftop layout. Actual site cable routing distance and elevation heights may require minor adjustments during final site survey.</p>
            <p className="mt-0.5 text-gray-500"><strong>Equivalence Clause:</strong> In the event of temporary supply chain constraints for any specific brand, Sunvine guarantees installation of equal or superior Tier-1 MNRE/BIS approved materials without compromising plant performance.</p>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Engineering BOM • Ref: {id}</span>
          <span>Page 3 of 4</span>
        </div>
      </div>

      {/* ========================================================
          PAGE 4: TERMS & CONDITIONS (EXACT UNTOUCHED TEXT)
          ======================================================== */}
      <div className={`pdf-page pdf-page-content relative w-[210mm] h-[297mm] max-h-[297mm] mx-auto p-8 flex flex-col justify-between bg-white ${isPdfExport ? 'border-none shadow-none m-0 mb-0' : 'border border-gray-300 shadow-xl mb-8'} print:!border-none print:!shadow-none print:!m-0 print:!mb-0 print:!h-[295mm] print:!max-h-[295mm] overflow-hidden box-border ${activePage === 'all' || activePage === 4 ? 'flex' : 'hidden print:flex'}`}>
        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/sunvine_logo_transparent.webp" alt="Sunvine" className="h-10 object-contain" />
              <div>
                <h1 className="text-lg font-black text-[#0B2545] tracking-tight uppercase leading-none">
                  TERMS &amp; CONDITIONS
                </h1>
                <p className="text-[10px] text-gray-600 font-medium mt-0.5">
                  Standard Warranty Terms, Payment Schedule &amp; Handover Protocols
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-gray-700">Ref: {id}</span>
              <p className="text-[10px] text-gray-600 mt-0.5">Date: {date}</p>
            </div>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-[#2E7D32] via-[#6CBF3D] to-[#0B2545] my-2 rounded-full"></div>

          {/* EXACT UNTOUCHED TERMS AND CONDITIONS BODY */}
          <div className="space-y-1.5 text-[9.5px] text-gray-900 leading-normal">
            <div>
              <strong className="block font-bold text-gray-950">Guarantee &amp; Warranty of The Plant</strong>
              <strong className="block font-bold mt-0.5 text-gray-900">Module Warranty:</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-800">
                <li>The 30-year limited warranty covers the module as follows:</li>
                <li>10 years against manufacturing defects.</li>
                <li>90% power output for the first 10 years, and 80% for the next 15 years. (Terms subject to the module's manufacturing conditions.)</li>
                <li>From the date of commissioning and handover of the solar power system (Day One), the responsibility for cleaning and maintaining the solar panels shall be solely borne by the customer.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Inverter Warranty:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>The solar inverter comes with a 8-year warranty against manufacturing defects (Terms subject to the inverter's manufacturing conditions and based on inverter make).</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Other Equipment Warranty:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>Up to 5 years from installation.</li>
              </ul>
            </div>

            <div className="pt-0.5">
              <strong className="block font-bold text-gray-900">Warranty Exclusions: (This warranty shall not apply to damages, failures, or defects resulting from) :</strong>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-800">
                <li>Switch Gears (L&amp;T): 12-month manufacturing defect warranty from the invoice date (No burning conditions covered).</li>
                <li>SPD: No coverage for burning or failure.</li>
                <li>DCDB/ACDB (Residential Projects): No warranty.</li>
                <li>No Returns: Goods once sold will not be accepted back.</li>
                <li>Natural disasters including but not limited to flood, cyclone, lightning, earthquake, storm, fire, or other force majeure events.</li>
                <li>Improper use, negligence, misuse, vandalism, theft, accidental damage, or unauthorized modifications.</li>
                <li>Repairs, alterations, relocation, or servicing performed by any person or organization not authorized by the Company.</li>
                <li>Voltage fluctuations, power surges, grid abnormalities, or electrical faults originating from the utility supply.</li>
                <li>Structural defects, water leakage, corrosion, or issues related to the customer's premises.</li>
                <li>Failure to follow recommended operating and maintenance procedures.</li>
              </ul>
            </div>

            <div className="pt-0.5">
              <strong className="block font-bold text-gray-900">Terms of Payment:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>10% advance with purchase order.</li>
                <li>90% before material dispatch.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Delivery:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>Typically, 30 days from the PO date, subject to legal and government approvals.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Insurance:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>After commissioning, the plant will be handed over to the client, who must arrange appropriate asset insurance for the PV system.</li>
              </ul>
            </div>

            <div>
              <strong className="block font-bold text-gray-900">Validity:</strong>
              <ul className="list-disc pl-4 text-gray-800">
                <li>{companyProfile.validityText || 'Our offer is valid for 15 days from the date of this offer'}</li>
              </ul>
            </div>

            <div className="font-bold pt-0.5 text-[#0B2545]">
              Note: Breakage of panels or other equipment is not covered under warranty.
            </div>
          </div>

          {/* Large Centered Banner */}
          <div className="text-center my-2 p-2 bg-[#F0FDF4] border border-[#6CBF3D]/40 rounded-lg">
            <h3 className="text-xs font-black text-[#2E7D32] tracking-wide uppercase">
              THANK YOU FOR CHOOSING {companyProfile.name || 'SUNVINE RENEWABLE'}
            </h3>
            <p className="text-[10px] text-gray-600 mt-0.5">Committed to Green Energy Independence &amp; Sustainable Growth</p>
          </div>

          {/* Formal Sign-off and Corporate Stamp Block */}
          <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t-2 border-slate-200">
            {/* Customer Sign-off Block */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
              <div className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider mb-1">
                Client Acceptance &amp; Order Confirmation
              </div>
              <p className="text-[9px] text-gray-500 leading-tight mb-6">
                I/We hereby accept the technical configuration, prices, and terms outlined in this proposal.
              </p>
              <div className="border-t border-dashed border-gray-400 pt-1 flex items-center justify-between text-[10px] text-gray-700">
                <span>Authorized Signatory</span>
                <span>Date: ____________</span>
              </div>
            </div>

            {/* Sunvine Authorized Signatory Stamp */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#0B2545] uppercase tracking-wider">
                    For {companyProfile.name || 'Sunvine Renewable Energy'}
                  </span>
                  <span className="text-[9px] text-[#2E7D32] font-bold">Authorized Seal</span>
                </div>
                <p className="text-[9.5px] text-gray-700 mt-0.5">
                  {companyProfile.address || 'Gujarat, India'}
                </p>
                <div className="text-[9.5px] text-gray-700 font-mono mt-0.5">
                  {companyProfile.whatsapp || companyProfile.helpdesk || '+91 80000 50580'} • {companyProfile.email || 'support@sunvinerenewable.com'}
                </div>
              </div>
              <div className="border-t border-dashed border-gray-400 pt-1 flex items-center justify-between text-[10px] text-gray-700 mt-4">
                <span>Authorized Executive</span>
                <span className="font-semibold text-emerald-800">Sunvine EPC Operations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="text-[9px] text-gray-500 pt-1 border-t border-gray-200 flex items-center justify-between">
          <span>Sunvine Renewable Energy • Terms &amp; Conditions • Ref: {id}</span>
          <span>Page 4 of 4</span>
        </div>
      </div>
    </div>
  );
}
