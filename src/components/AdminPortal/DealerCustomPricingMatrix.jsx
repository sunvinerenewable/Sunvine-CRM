import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

// Helper to safely resolve dealer display name, firm name and avatar initial
const getDealerName = (d) => {
  if (!d) return 'Dealer Partner';
  return d.name || d.dealerName || d.firmName || d.businessName || d.contactPerson || d.id || 'Dealer Partner';
};

const getDealerFirm = (d) => {
  if (!d) return 'Channel Partner';
  return d.firmName || d.businessName || d.dealerName || 'Solar Partner';
};

const getDealerInitial = (d) => {
  const str = getDealerName(d);
  return (str && typeof str === 'string' && str.length > 0) ? str.charAt(0).toUpperCase() : 'D';
};

export default function DealerCustomPricingMatrix({ onShowToast }) {
  const {
    dealers,
    pricingMaster,
    role,
    currentStaff,
    getAccessibleDealers,
    updateDealerPricing,
    updateDealerProductRate,
    removeDealerProductRate,
    modulesList,
    invertersList,
    bomCatalog,
    addNotification,
    logActivity
  } = useApp();

  // Determine accessible dealers based on active persona (Admin vs Sales Staff)
  const accessibleDealers = useMemo(() => {
    if (getAccessibleDealers) return getAccessibleDealers();
    if (role === 'staff') {
      const staffId = currentStaff?.id || 'STF-001';
      return (dealers || []).filter(d => (d.assignedStaffId === staffId) || (!d.assignedStaffId && staffId === 'STF-001'));
    }
    return dealers || [];
  }, [dealers, role, currentStaff, getAccessibleDealers]);

  // -------------------------------------------------------------
  // Product-Wise Custom Pricing Engine & Overrides Ledger
  // -------------------------------------------------------------
  const [productTargetDealerId, setProductTargetDealerId] = useState(() => {
    return accessibleDealers[0]?.id || '';
  });
  const [productCategory, setProductCategory] = useState('module'); // 'module' | 'inverter' | 'bom'
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customProductRateInput, setCustomProductRateInput] = useState('');
  const [productLedgerFilter, setProductLedgerFilter] = useState('current'); // 'current' | 'all'
  const [productLedgerCategory, setProductLedgerCategory] = useState('all'); // 'all' | 'module' | 'inverter' | 'bom'
  const [productLedgerSearch, setProductLedgerSearch] = useState('');

  // Current target dealer object
  const targetDealer = useMemo(() => {
    return accessibleDealers.find(d => d.id === productTargetDealerId) || accessibleDealers[0] || null;
  }, [accessibleDealers, productTargetDealerId]);

  // Master available hardware products catalog
  const availableProducts = useMemo(() => {
    const list = [];

    // 1. Solar Modules (Panels)
    const mods = (modulesList && modulesList.length > 0) ? modulesList : [
      { id: 'mod-waaree-585', brand: 'Waaree Energies', model: '585WP TOPCon Bifacial Dual Glass', wattage: 585, ratePerWp: 18.25 },
      { id: 'mod-aps-600', brand: 'APS / Sunvine Premier', model: '600WP TOPCON MONO BIFACIAL Panel', wattage: 600, ratePerWp: 18.00 },
      { id: 'mod-adani-550', brand: 'Adani Solar', model: 'Elan Bi-550W Mono PERC Half-Cut', wattage: 550, ratePerWp: 17.80 },
      { id: 'mod-rayzone-550', brand: 'Rayzone Solar', model: '550W Bi-Fi Mono PERC Half-Cut', wattage: 550, ratePerWp: 17.50 },
      { id: 'mod-aps-550', brand: 'APS Bi-Fi', model: '550W Bifacial Dual Glass', wattage: 550, ratePerWp: 17.50 }
    ];

    mods.forEach(m => {
      const rawRate = typeof m.ratePerWp === 'string' ? parseFloat(m.ratePerWp.replace(/[^0-9.]/g, '')) : Number(m.ratePerWp);
      const benchmarkPrice = rawRate || 18.25;
      list.push({
        id: m.id || `mod-${m.brand}-${m.wattage}`,
        name: `${m.brand} ${m.wattage ? `${m.wattage}W` : ''} ${m.model || ''}`.trim(),
        category: 'module',
        categoryLabel: 'Solar Module (Panel)',
        benchmarkPrice,
        unit: '₹/Wp',
        keyIdentifier: m.brand
      });
    });

    // 2. Solar Inverters
    const invs = (invertersList && invertersList.length > 0) ? invertersList : [
      { id: 'inv-solis-2_2', brand: 'Solis / Solaryaan', model: '2.2 KW Single Phase Grid-Tied Inverter', capacityKW: 2.2, benchmarkPrice: 24500 },
      { id: 'inv-sunvine-3', brand: 'Sunvine Smart Series', model: '3.0 KW 1-Phase Smart MPPT On-Grid', capacityKW: 3.0, benchmarkPrice: 29800 },
      { id: 'inv-solis-3_6', brand: 'Solis / Vsole', model: '3.6 KW Single Phase Dual MPPT On-Grid', capacityKW: 3.6, benchmarkPrice: 33500 },
      { id: 'inv-sunvine-5', brand: 'Sunvine Smart Series', model: '5.0 KW 3-Phase Smart MPPT On-Grid', capacityKW: 5.0, benchmarkPrice: 42000 },
      { id: 'inv-sunvine-6', brand: 'Sunvine Smart Series', model: '6.0 KW 3-Phase Smart MPPT On-Grid', capacityKW: 6.0, benchmarkPrice: 48500 },
      { id: 'inv-growatt-10', brand: 'Growatt / Deye', model: '10.0 KW 3-Phase Multi-MPPT On-Grid', capacityKW: 10.0, benchmarkPrice: 72000 }
    ];

    invs.forEach(inv => {
      const benchmarkPrice = inv.benchmarkPrice || (inv.capacityKW <= 3 ? 28000 : inv.capacityKW <= 5 ? 42000 : 70000);
      list.push({
        id: inv.id || `inv-${inv.brand}-${inv.capacityKW || inv.capacity}`,
        name: `${inv.brand} ${inv.capacityKW ? `${inv.capacityKW} kW` : (inv.capacity || '')} ${inv.model || ''}`.trim(),
        category: 'inverter',
        categoryLabel: 'Solar Inverter',
        benchmarkPrice,
        unit: '₹/unit',
        keyIdentifier: inv.brand
      });
    });

    // 3. BOM & BoS Components
    const standardBomItems = [
      { id: 'bom-gi-pipe-40x40', name: 'Mounting Structure: 40x40 GI Pipe (2mm HDG)', category: 'bom', benchmarkPrice: 750, unit: '₹/pipe' },
      { id: 'bom-gi-pipe-60x40', name: 'Mounting Structure: 60x40 GI Pipe (2mm HDG)', category: 'bom', benchmarkPrice: 980, unit: '₹/pipe' },
      { id: 'bom-mid-clamp', name: 'Structure Hardware: Aluminium Mid Clamps with SS Bolt', category: 'bom', benchmarkPrice: 45, unit: '₹/pc' },
      { id: 'bom-end-clamp', name: 'Structure Hardware: Aluminium End Clamps with SS Bolt', category: 'bom', benchmarkPrice: 45, unit: '₹/pc' },
      { id: 'bom-anchor-fastener', name: 'Structure Hardware: M10 Anchor Fasteners (SS304)', category: 'bom', benchmarkPrice: 55, unit: '₹/pc' },
      { id: 'bom-acdb-dcdb', name: 'Electrical: ACDB + DCDB Dual Protection Box with SPD', category: 'bom', benchmarkPrice: 4800, unit: '₹/set' },
      { id: 'bom-dc-cable-4mm', name: 'Cables: 4 sq mm TUV Solar DC Cable (Copper)', category: 'bom', benchmarkPrice: 48, unit: '₹/m' },
      { id: 'bom-ac-cable', name: 'Cables: 3-Core Flexible Copper AC Armoured Cable', category: 'bom', benchmarkPrice: 165, unit: '₹/m' },
      { id: 'bom-earthing-kit', name: 'Earthing: Chemical Earthing Electrode + Bentonite Compound', category: 'bom', benchmarkPrice: 2400, unit: '₹/set' },
      { id: 'bom-lightning-arrester', name: 'Protection: Copper Lightning Arrester (107kA Spike Safe)', category: 'bom', benchmarkPrice: 1800, unit: '₹/set' },
      { id: 'bom-pvc-conduit', name: 'Conduits: 25mm Heavy Duty UV Protected PVC Conduit Pipe', category: 'bom', benchmarkPrice: 120, unit: '₹/pipe' }
    ];

    standardBomItems.forEach(b => {
      list.push({
        id: b.id,
        name: b.name,
        category: 'bom',
        categoryLabel: 'BOM / BoS Hardware',
        benchmarkPrice: b.benchmarkPrice,
        unit: b.unit,
        keyIdentifier: b.id
      });
    });

    return list;
  }, [modulesList, invertersList]);

  // Current category filtered products
  const categoryProducts = useMemo(() => {
    return availableProducts.filter(p => p.category === productCategory);
  }, [availableProducts, productCategory]);

  // Selected product object
  const currentChosenProduct = useMemo(() => {
    return categoryProducts.find(p => p.id === selectedProductId) || categoryProducts[0] || null;
  }, [categoryProducts, selectedProductId]);

  // Auto-sync product selection
  React.useEffect(() => {
    if (categoryProducts.length > 0) {
      const match = categoryProducts.find(p => p.id === selectedProductId);
      if (!match) {
        setSelectedProductId(categoryProducts[0].id);
      }
    }
  }, [categoryProducts, selectedProductId]);

  // Pre-fill input if targeted dealer already has an override for this product
  React.useEffect(() => {
    if (currentChosenProduct && productTargetDealerId) {
      const targetDealer = accessibleDealers.find(d => d.id === productTargetDealerId);
      const customRates = targetDealer?.pricingConfig?.customProductRates || {};
      const existing = customRates[currentChosenProduct.id] ?? customRates[currentChosenProduct.keyIdentifier] ?? customRates[currentChosenProduct.name];
      if (existing !== undefined && existing !== null) {
        setCustomProductRateInput(String(existing));
      } else {
        setCustomProductRateInput(String(currentChosenProduct.benchmarkPrice || ''));
      }
    }
  }, [currentChosenProduct, productTargetDealerId, accessibleDealers]);

  // Aggregate all product-specific overrides across accessible dealers
  const allProductOverrides = useMemo(() => {
    const records = [];
    (accessibleDealers || []).forEach(dealer => {
      const cfg = dealer.pricingConfig || {};
      const productDetails = cfg.productDetails || {};
      const customProductRates = cfg.customProductRates || {};

      Object.keys(customProductRates).forEach(prodKey => {
        const detail = productDetails[prodKey] || {};
        const matchedProd = availableProducts.find(p => p.id === prodKey || p.name === prodKey || p.keyIdentifier === prodKey);

        const prodName = detail.name || matchedProd?.name || prodKey;
        const category = detail.category || matchedProd?.category || 'general';
        const benchmarkPrice = detail.benchmarkPrice || matchedProd?.benchmarkPrice || 0;
        const rate = Number(customProductRates[prodKey]);
        const unit = detail.unit || matchedProd?.unit || '₹';

        records.push({
          dealerId: dealer.id,
          dealerName: getDealerName(dealer),
          dealerFirm: getDealerFirm(dealer),
          dealerCity: dealer.city || 'Gujarat',
          productId: prodKey,
          productName: prodName,
          category,
          categoryLabel: category === 'module' ? 'Solar Module' : category === 'inverter' ? 'Solar Inverter' : 'BOM Hardware',
          benchmarkPrice,
          customPrice: rate,
          unit,
          delta: benchmarkPrice ? (rate - benchmarkPrice) : 0,
          updatedAt: detail.updatedAt || cfg.updatedAt || 'Active'
        });
      });
    });
    return records;
  }, [accessibleDealers, availableProducts]);

  // Filtered product overrides for ledger table
  const filteredProductOverrides = useMemo(() => {
    return allProductOverrides.filter(rec => {
      if (productLedgerFilter === 'current' && rec.dealerId !== productTargetDealerId) {
        return false;
      }
      if (productLedgerCategory !== 'all' && rec.category !== productLedgerCategory) {
        return false;
      }
      if (productLedgerSearch) {
        const q = productLedgerSearch.toLowerCase();
        return (
          rec.dealerName.toLowerCase().includes(q) ||
          rec.dealerFirm.toLowerCase().includes(q) ||
          rec.productName.toLowerCase().includes(q) ||
          rec.dealerCity.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allProductOverrides, productLedgerFilter, productLedgerCategory, productLedgerSearch, productTargetDealerId]);

  const handleUpdateProductPrice = (e) => {
    if (e) e.preventDefault();
    if (!productTargetDealerId) {
      if (onShowToast) onShowToast('Please select a dealer partner');
      return;
    }
    if (!currentChosenProduct) {
      if (onShowToast) onShowToast('Please select a product');
      return;
    }
    const num = parseFloat(customProductRateInput);
    if (isNaN(num) || num < 0) {
      if (onShowToast) onShowToast('Please enter a valid price');
      return;
    }

    if (updateDealerProductRate) {
      updateDealerProductRate(productTargetDealerId, currentChosenProduct.id, num, {
        name: currentChosenProduct.name,
        category: currentChosenProduct.category,
        benchmarkPrice: currentChosenProduct.benchmarkPrice,
        unit: currentChosenProduct.unit
      });
    }

    const targetD = accessibleDealers.find(d => d.id === productTargetDealerId);
    const dName = getDealerName(targetD);
    if (onShowToast) {
      onShowToast(`Negotiated rate set for ${currentChosenProduct.name}: ₹${num} ${currentChosenProduct.unit} (${dName})`);
    }
  };

  const handleRemoveProductOverride = (dealerId, productId, prodName) => {
    if (window.confirm(`Reset "${prodName}" to default benchmark rate for this dealer?`)) {
      if (removeDealerProductRate) {
        removeDealerProductRate(dealerId, productId);
      }
      if (onShowToast) onShowToast(`Reset ${prodName} to benchmark`);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-on-surface">
      {/* 1. Header Banner & Scoped Role Notice */}
      <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary-container/15 text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">tune</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-headline-md text-headline-md font-bold text-inverse-surface tracking-tight">
                  Dealer-Wise Custom Pricing Matrix &amp; Base Price Overrides
                </h2>
                {role === 'staff' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full font-label-xs text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Sales Staff Scoped View ({accessibleDealers.length} Dealers Assigned)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full font-label-xs text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    Admin Master Governance ({dealers?.length || 550} Total Network Dealers)
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-1 max-w-3xl">
                Configure authorized dealer pricing tiers, custom product rates, special partner discounts, and localized margin caps. Proposals automatically apply negotiated product rates and fallback to Sunvine Global Benchmark Pricing for standard items.
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="px-3.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-left">
              <div className="font-label-xs text-[10px] text-secondary uppercase font-semibold">Total Network</div>
              <div className="font-mono text-base font-bold text-primary">{accessibleDealers.length} Dealers</div>
            </div>
            <div className="px-3.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-left">
              <div className="font-label-xs text-[10px] text-secondary uppercase font-semibold">Active Overrides</div>
              <div className="font-mono text-base font-bold text-on-surface">{allProductOverrides.length} Products</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 Product & Material-Wise Dealer Negotiated Rates Engine (Panels, Inverters & BOM) */}
      <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-container gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">category</span>
            </div>
            <div>
              <h3 className="font-headline-md text-base font-bold text-inverse-surface flex items-center gap-2">
                Product &amp; Material-Wise Dealer Negotiated Rates
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold">
                  {allProductOverrides.length} Active Overrides
                </span>
              </h3>
              <p className="font-body-sm text-xs text-secondary mt-0.5">
                Configure dealer-specific prices for solar modules, string inverters, and individual BOM components. Select any dealer from the dropdown to set customized prices.
              </p>
            </div>
          </div>
          <span className="text-xs text-secondary font-mono self-start sm:self-center">
            Auto-applied in Quotation Engine
          </span>
        </div>

        {/* Interactive Update Bar: Dealer Dropdown + Category + Product + Custom Price + Update */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/80 flex flex-col gap-3">
          <div className="text-xs font-bold text-on-surface flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-base">add_circle</span>
            Assign / Update Negotiated Price for Dealer
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            {/* 1. Target Dealer Dropdown */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-secondary mb-1">
                1. Select Dealer Partner
              </label>
              <select
                value={productTargetDealerId}
                onChange={(e) => setProductTargetDealerId(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary truncate"
              >
                {accessibleDealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {getDealerName(d)} ({d.city || 'Gujarat'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Category Selector */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-secondary mb-1">
                2. Category
              </label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="module">Solar Modules</option>
                <option value="inverter">Solar Inverters</option>
                <option value="bom">BOM Hardware</option>
              </select>
            </div>

            {/* 3. Product Dropdown */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-semibold text-secondary mb-1">
                3. Select Product / Hardware Item
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-primary truncate"
              >
                {categoryProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Std: ₹{p.benchmarkPrice.toLocaleString('en-IN')} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Negotiated Custom Rate Input */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-secondary mb-1">
                4. Negotiated Rate ({currentChosenProduct?.unit || '₹'})
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-secondary font-mono text-xs">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={currentChosenProduct ? String(currentChosenProduct.benchmarkPrice) : '0'}
                  value={customProductRateInput}
                  onChange={(e) => setCustomProductRateInput(e.target.value)}
                  className="w-full h-9 pl-6 pr-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* 5. Update Button */}
            <div className="lg:col-span-1">
              <button
                type="button"
                onClick={handleUpdateProductPrice}
                className="w-full h-9 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                title="Save negotiated price for selected dealer"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>Update</span>
              </button>
            </div>
          </div>

          {currentChosenProduct && (
            <div className="flex items-center justify-between text-[11px] text-secondary px-1 pt-1 border-t border-surface-container/60">
              <span>
                Standard Benchmark Rate: <strong className="font-mono text-on-surface">₹{currentChosenProduct.benchmarkPrice.toLocaleString('en-IN')} {currentChosenProduct.unit}</strong>
              </span>
              {customProductRateInput && !isNaN(parseFloat(customProductRateInput)) && (
                <span className="font-mono font-semibold">
                  Delta vs Benchmark:{' '}
                  <span className={parseFloat(customProductRateInput) < currentChosenProduct.benchmarkPrice ? 'text-emerald-400' : parseFloat(customProductRateInput) > currentChosenProduct.benchmarkPrice ? 'text-amber-400' : 'text-secondary'}>
                    {parseFloat(customProductRateInput) === currentChosenProduct.benchmarkPrice
                      ? 'Equal to Benchmark'
                      : `${parseFloat(customProductRateInput) < currentChosenProduct.benchmarkPrice ? '-' : '+'}₹${Math.abs(Math.round((parseFloat(customProductRateInput) - currentChosenProduct.benchmarkPrice) * 100) / 100).toLocaleString('en-IN')} ${currentChosenProduct.unit}`}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Negotiated Prices Ledger Table */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface">
                Active Negotiated Product Prices:
              </span>
              <div className="inline-flex rounded-lg border border-surface-container-highest p-0.5 bg-surface-container-lowest text-xs">
                <button
                  type="button"
                  onClick={() => setProductLedgerFilter('current')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer transition-colors ${
                    productLedgerFilter === 'current'
                      ? 'bg-primary-container text-on-primary'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  {targetDealer ? getDealerName(targetDealer) : 'Current'} ({allProductOverrides.filter(r => r.dealerId === productTargetDealerId).length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductLedgerFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold text-[11px] cursor-pointer transition-colors ${
                    productLedgerFilter === 'all'
                      ? 'bg-primary-container text-on-primary'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  All Dealers ({allProductOverrides.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <select
                value={productLedgerCategory}
                onChange={(e) => setProductLedgerCategory(e.target.value)}
                className="h-8 px-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-[11px] font-medium text-secondary focus:outline-none focus:border-primary"
              >
                <option value="all">All Categories</option>
                <option value="module">Modules Only</option>
                <option value="inverter">Inverters Only</option>
                <option value="bom">BOM Hardware Only</option>
              </select>

              {/* Quick Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-secondary text-[16px]">search</span>
                <input
                  type="text"
                  placeholder="Filter product or dealer..."
                  value={productLedgerSearch}
                  onChange={(e) => setProductLedgerSearch(e.target.value)}
                  className="w-44 h-8 pl-7 pr-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-[11px] text-on-surface focus:outline-none focus:border-primary placeholder:text-secondary"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-surface-container rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low text-secondary font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Dealer Partner</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Product / Material Specification</th>
                  <th className="py-2.5 px-3 text-right">Standard Benchmark</th>
                  <th className="py-2.5 px-3 text-right">Negotiated Dealer Rate</th>
                  <th className="py-2.5 px-3 text-right">Delta (Savings)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filteredProductOverrides.length > 0 ? (
                  filteredProductOverrides.map((row, idx) => (
                    <tr key={`${row.dealerId}-${row.productId}-${idx}`} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-on-surface">{row.dealerName}</div>
                        <div className="text-[10px] text-secondary">{row.dealerFirm} • {row.dealerCity}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          row.category === 'module'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : row.category === 'inverter'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {row.categoryLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-on-surface">
                        {row.productName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-secondary">
                        ₹{row.benchmarkPrice.toLocaleString('en-IN')} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                        ₹{row.customPrice.toLocaleString('en-IN')} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={row.delta < 0 ? 'text-emerald-400' : row.delta > 0 ? 'text-amber-400' : 'text-secondary'}>
                          {row.delta === 0
                            ? 'Match'
                            : `${row.delta < 0 ? '-' : '+'}₹${Math.abs(Math.round(row.delta * 100) / 100).toLocaleString('en-IN')} ${row.unit}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Enforced
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProductOverride(row.dealerId, row.productId, row.productName)}
                          className="px-2 py-1 rounded text-[11px] text-secondary hover:text-error hover:bg-error/10 transition-colors font-medium cursor-pointer"
                          title="Reset to benchmark rate"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-secondary text-xs">
                      {productLedgerFilter === 'current'
                        ? `No product overrides assigned specifically for ${targetDealer ? getDealerName(targetDealer) : 'this dealer'}. Uses global benchmark rates.`
                        : 'No custom product rates configured. Select a dealer above to assign custom product prices.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Accessible Dealers Pricing Status Directory Table */}
      <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">table_chart</span>
              Territory Dealer Pricing Status Ledger
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              Overview of all {accessibleDealers.length} authorized channel partners in your territory and their active pricing formulas.
            </p>
          </div>
          <span className="font-mono text-xs text-secondary">
            Showing {accessibleDealers.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-container text-secondary font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Dealer Partner</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3 text-center">Pricing Mode</th>
                <th className="py-2.5 px-3 text-right">Custom / Wp</th>
                <th className="py-2.5 px-3 text-right">Custom / kW</th>
                <th className="py-2.5 px-3 text-right">Margin Cap</th>
                <th className="py-2.5 px-3 text-right">Rebate %</th>
                <th className="py-2.5 px-3 text-center">Product Overrides</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {accessibleDealers.slice(0, 15).map(dealer => {
                const cfg = dealer.pricingConfig || {};
                const isCustom = cfg.pricingMode === 'custom';
                const customItemsCount = Object.keys(cfg.customProductRates || {}).length;
                return (
                  <tr key={dealer.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-on-surface">{getDealerName(dealer)}</div>
                      <div className="text-[11px] text-secondary">{getDealerFirm(dealer)}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-secondary">
                      {dealer.city || 'Gujarat'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isCustom
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-surface-container text-secondary'
                      }`}>
                        {isCustom ? 'Custom' : 'Benchmark'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {isCustom && cfg.customBaseRatePerWp ? `₹${cfg.customBaseRatePerWp}` : <span className="text-secondary/50">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {isCustom && cfg.customBaseRatePerKw ? `₹${Number(cfg.customBaseRatePerKw).toLocaleString('en-IN')}` : <span className="text-secondary/50">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {isCustom && cfg.customMarginPerKw ? `₹${Number(cfg.customMarginPerKw).toLocaleString('en-IN')}` : <span className="text-secondary/50">Std (₹8k)</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {isCustom && cfg.customDiscountPercent ? `${cfg.customDiscountPercent}%` : <span className="text-secondary/50">0%</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {customItemsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 font-mono">
                          {customItemsCount} Items
                        </span>
                      ) : (
                        <span className="text-secondary/50 font-mono text-[10px]">Std</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setProductTargetDealerId(dealer.id);
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-primary-container hover:text-on-primary text-secondary transition-colors font-semibold text-[11px] cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
