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

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'custom' | 'standard'
  const [selectedDealerId, setSelectedDealerId] = useState(() => {
    return accessibleDealers[0]?.id || '';
  });

  // Current selected dealer object
  const selectedDealer = useMemo(() => {
    return accessibleDealers.find(d => d.id === selectedDealerId) || accessibleDealers[0] || null;
  }, [accessibleDealers, selectedDealerId]);

  // Global benchmark fallback values from pricingMaster
  const benchmarkRate1to3 = Number(pricingMaster?.residentialBaseRatePerKW) || 52000;
  const benchmarkRate3to10 = Number(pricingMaster?.residential3to10RatePerKW) || 48000;
  const benchmarkRateCi = Number(pricingMaster?.commercialBaseRatePerKW) || 42000;
  const benchmarkWpRate = 29.5; // Standard benchmark ₹/Wp for Tier-1 Mono PERC / TopCon

  // Pricing configuration state for the selected dealer
  const [pricingMode, setPricingMode] = useState('standard');
  const [customBaseRatePerWp, setCustomBaseRatePerWp] = useState('');
  const [customBaseRatePerKw, setCustomBaseRatePerKw] = useState('');
  const [customMarginPerKw, setCustomMarginPerKw] = useState('');
  const [customDiscountPercent, setCustomDiscountPercent] = useState('');
  const [notes, setNotes] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state whenever selected dealer changes
  React.useEffect(() => {
    if (selectedDealer) {
      const cfg = selectedDealer.pricingConfig || {};
      setPricingMode(cfg.pricingMode || 'standard');
      setCustomBaseRatePerWp(cfg.customBaseRatePerWp !== undefined ? String(cfg.customBaseRatePerWp) : '');
      setCustomBaseRatePerKw(cfg.customBaseRatePerKw !== undefined ? String(cfg.customBaseRatePerKw) : '');
      setCustomMarginPerKw(cfg.customMarginPerKw !== undefined ? String(cfg.customMarginPerKw) : '');
      setCustomDiscountPercent(cfg.customDiscountPercent !== undefined ? String(cfg.customDiscountPercent) : '');
      setNotes(cfg.notes || '');
      setSaveSuccess(false);
    }
  }, [selectedDealerId, selectedDealer]);

  // Filtered dealers list for search/table
  const filteredDealers = useMemo(() => {
    return accessibleDealers.filter(d => {
      const name = getDealerName(d).toLowerCase();
      const firm = getDealerFirm(d).toLowerCase();
      const city = (d.city || d.location || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const code = (d.dealerCode || d.dealerId || d.id || '').toLowerCase();
      const q = searchTerm.toLowerCase();

      const matchesSearch = !searchTerm || name.includes(q) || firm.includes(q) || city.includes(q) || phone.includes(q) || code.includes(q);
      const isCustom = d.pricingConfig?.pricingMode === 'custom';

      if (filterMode === 'custom') return matchesSearch && isCustom;
      if (filterMode === 'standard') return matchesSearch && !isCustom;
      return matchesSearch;
    });
  }, [accessibleDealers, searchTerm, filterMode]);

  // Statistics
  const customPricingCount = useMemo(() => {
    return accessibleDealers.filter(d => d.pricingConfig?.pricingMode === 'custom').length;
  }, [accessibleDealers]);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    if (!selectedDealer) return;

    const payload = {
      pricingMode,
      customBaseRatePerWp: pricingMode === 'custom' && customBaseRatePerWp ? Number(customBaseRatePerWp) : null,
      customBaseRatePerKw: pricingMode === 'custom' && customBaseRatePerKw ? Number(customBaseRatePerKw) : null,
      customMarginPerKw: pricingMode === 'custom' && customMarginPerKw ? Number(customMarginPerKw) : null,
      customDiscountPercent: pricingMode === 'custom' && customDiscountPercent ? Number(customDiscountPercent) : 0,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: role === 'staff' ? (currentStaff?.name || 'Sales Staff') : 'Admin Desk'
    };

    updateDealerPricing(selectedDealer.id, payload);

    const displayName = getDealerName(selectedDealer);

    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'tune',
        title: `Custom Pricing Saved for ${displayName}`,
        description: `Pricing Mode: ${pricingMode.toUpperCase()} | Wp: ₹${payload.customBaseRatePerWp || 'Benchmark'} | Margin: ₹${payload.customMarginPerKw || 'Standard'}`,
        targetTab: 'pricing_master'
      });
    }

    if (logActivity) {
      logActivity({
        action: 'UPDATE_DEALER_PRICING_MATRIX',
        module: 'PRICING_MASTER',
        recordId: selectedDealer.id,
        details: `Updated custom pricing for dealer ${displayName} (${selectedDealer.id}). Mode=${pricingMode}`
      });
    }

    setSaveSuccess(true);
    if (onShowToast) onShowToast(`Pricing matrix updated for ${displayName}`);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetToBenchmark = () => {
    if (!selectedDealer) return;
    const displayName = getDealerName(selectedDealer);
    setPricingMode('standard');
    setCustomBaseRatePerWp('');
    setCustomBaseRatePerKw('');
    setCustomMarginPerKw('');
    setCustomDiscountPercent('');
    setNotes('');

    updateDealerPricing(selectedDealer.id, {
      pricingMode: 'standard',
      customBaseRatePerWp: null,
      customBaseRatePerKw: null,
      customMarginPerKw: null,
      customDiscountPercent: 0,
      notes: 'Reverted to Global Benchmark Base Pricing',
      updatedAt: new Date().toISOString(),
      updatedBy: role === 'staff' ? (currentStaff?.name || 'Sales Staff') : 'Admin Desk'
    });

    if (onShowToast) onShowToast(`Reverted ${displayName} to global benchmark pricing`);
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
                Configure authorized dealer pricing tiers, custom per-watt (₹/Wp) or per-kW rates, special partner discounts, and localized margin caps. When custom rates are unset, proposals automatically fallback to Sunvine Global Benchmark Pricing.
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="px-3.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-left">
              <div className="font-label-xs text-[10px] text-secondary uppercase font-semibold">Custom Priced</div>
              <div className="font-mono text-base font-bold text-primary">{customPricingCount} Dealers</div>
            </div>
            <div className="px-3.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-left">
              <div className="font-label-xs text-[10px] text-secondary uppercase font-semibold">Standard Fallback</div>
              <div className="font-mono text-base font-bold text-on-surface">{accessibleDealers.length - customPricingCount} Dealers</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Workspace: Dealer Selector & Pricing Configuration Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dealer Selector & List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider">
                Select Dealer Partner
              </span>
              <span className="text-xs font-mono text-secondary">
                {filteredDealers.length} matching
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search by name, firm, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary placeholder:text-secondary"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  filterMode === 'all'
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                All ({accessibleDealers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('custom')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  filterMode === 'custom'
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                Custom ({customPricingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('standard')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  filterMode === 'standard'
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                Standard ({accessibleDealers.length - customPricingCount})
              </button>
            </div>

            {/* Scrollable Dealer Partner Selection List */}
            <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredDealers.map(dealer => {
                const isSelected = dealer.id === selectedDealerId;
                const isCustom = dealer.pricingConfig?.pricingMode === 'custom';
                return (
                  <button
                    key={dealer.id}
                    type="button"
                    onClick={() => setSelectedDealerId(dealer.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-surface-container-low border-primary ring-1 ring-primary/40'
                        : 'bg-surface-container-lowest/60 border-surface-container-high/60 hover:bg-surface-container-low/40 hover:border-surface-container-highest'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-on-surface truncate">
                        {getDealerName(dealer)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        isCustom
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-surface-container-high text-secondary'
                      }`}>
                        {isCustom ? 'Custom' : 'Standard'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-secondary">
                      <span className="truncate">{getDealerFirm(dealer)}</span>
                      <span className="font-mono shrink-0">{dealer.city || 'Gujarat'}</span>
                    </div>

                    {isCustom && (
                      <div className="flex items-center gap-2 pt-1 border-t border-surface-container text-[10px] font-mono text-primary">
                        {dealer.pricingConfig?.customBaseRatePerWp && (
                          <span>₹{dealer.pricingConfig.customBaseRatePerWp}/Wp</span>
                        )}
                        {dealer.pricingConfig?.customBaseRatePerKw && (
                          <span>₹{Number(dealer.pricingConfig.customBaseRatePerKw).toLocaleString('en-IN')}/kW</span>
                        )}
                        {dealer.pricingConfig?.customMarginPerKw && (
                          <span>Margin: ₹{dealer.pricingConfig.customMarginPerKw}/kW</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}

              {filteredDealers.length === 0 && (
                <div className="py-8 text-center text-secondary text-xs">
                  No dealers matching "{searchTerm}".
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Engine Configuration for Selected Dealer (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedDealer ? (
            <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-6 shadow-sm flex flex-col gap-6">
              {/* Selected Dealer Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-container gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center font-bold text-base border border-primary/20">
                    {getDealerInitial(selectedDealer)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-md text-base font-bold text-inverse-surface">
                        {getDealerName(selectedDealer)}
                      </h3>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-secondary">
                        {selectedDealer.id || selectedDealer.dealerId || 'SV-DLR'}
                      </span>
                      <span className="font-label-xs text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-secondary uppercase font-semibold">
                        {selectedDealer.tier || 'Gold Partner'}
                      </span>
                    </div>
                    <p className="font-body-sm text-xs text-secondary mt-0.5">
                      {getDealerFirm(selectedDealer)} • {selectedDealer.city || 'Gujarat'} • Phone: {selectedDealer.phone || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    pricingMode === 'custom'
                      ? 'bg-primary-container/20 text-primary border border-primary/30'
                      : 'bg-surface-container-high text-secondary'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {pricingMode === 'custom' ? 'Custom Pricing Active' : 'Benchmark Fallback Active'}
                  </span>
                </div>
              </div>

              {/* Mode Toggle Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPricingMode('standard')}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    pricingMode === 'standard'
                      ? 'bg-surface-container-low border-primary ring-1 ring-primary/40'
                      : 'bg-surface-container-lowest border-surface-container-high hover:border-surface-container-highest'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">account_balance</span>
                      Standard Benchmark Fallback
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      pricingMode === 'standard' ? 'border-primary bg-primary' : 'border-secondary'
                    }`}>
                      {pricingMode === 'standard' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    Uses Sunvine global benchmark pricing (₹{benchmarkRate1to3.toLocaleString('en-IN')}/kW for 1-3 kW, ₹{benchmarkRate3to10.toLocaleString('en-IN')}/kW for 3-10 kW). Dealer tier margins apply automatically.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingMode('custom')}
                  className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    pricingMode === 'custom'
                      ? 'bg-surface-container-low border-primary ring-1 ring-primary/40'
                      : 'bg-surface-container-lowest border-surface-container-high hover:border-surface-container-highest'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                      Custom Negotiated Pricing
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      pricingMode === 'custom' ? 'border-primary bg-primary' : 'border-secondary'
                    }`}>
                      {pricingMode === 'custom' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    Override standard rates with dealer-specific Rate per Watt (₹/Wp), custom Base Rate per kW, customized margin caps, or partner discount % for this dealer.
                  </p>
                </button>
              </div>

              {/* Custom Pricing Inputs (Active when mode === 'custom') */}
              <div className={`space-y-4 p-4 rounded-xl transition-all ${
                pricingMode === 'custom' ? 'bg-surface-container-low/70 border border-primary/30' : 'opacity-60 bg-surface-container-lowest border border-surface-container-high pointer-events-none'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <h4 className="font-bold text-xs text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">price_change</span>
                    Rate Overrides &amp; Margin Rules
                  </h4>
                  <span className="text-[11px] text-secondary font-mono">
                    Fallback active for blank fields
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Custom Rate per Wp */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Custom Rate / Wp (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-secondary">₹</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder={`${benchmarkWpRate}`}
                        value={customBaseRatePerWp}
                        onChange={(e) => setCustomBaseRatePerWp(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <span className="text-[10px] text-secondary mt-1 block">
                      Benchmark: ₹{benchmarkWpRate} / Wp
                    </span>
                  </div>

                  {/* Custom Base Rate per kW */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Custom Base Rate / kW (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-secondary">₹</span>
                      <input
                        type="number"
                        step="500"
                        placeholder={`${benchmarkRate3to10}`}
                        value={customBaseRatePerKw}
                        onChange={(e) => setCustomBaseRatePerKw(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <span className="text-[10px] text-secondary mt-1 block">
                      Benchmark: ₹{benchmarkRate3to10.toLocaleString('en-IN')} / kW
                    </span>
                  </div>

                  {/* Custom Margin per kW */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Dealer Margin Cap / kW (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-secondary">₹</span>
                      <input
                        type="number"
                        step="500"
                        placeholder="6000"
                        value={customMarginPerKw}
                        onChange={(e) => setCustomMarginPerKw(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                    <span className="text-[10px] text-secondary mt-1 block">
                      Standard Cap: ₹8,000 / kW
                    </span>
                  </div>

                  {/* Special Partner Discount % */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Partner Rebate / Discount (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="25"
                        placeholder="0.0"
                        value={customDiscountPercent}
                        onChange={(e) => setCustomDiscountPercent(e.target.value)}
                        className="w-full pl-3 pr-7 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                      <span className="absolute right-3 top-2 text-xs font-mono text-secondary">%</span>
                    </div>
                    <span className="text-[10px] text-secondary mt-1 block">
                      Applied on final EPC total
                    </span>
                  </div>
                </div>

                {/* Justification & Internal Notes */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Internal Agreement Notes &amp; Justification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Approved by Regional Sales Manager for 50 kW monthly commitment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary placeholder:text-secondary"
                  />
                </div>
              </div>

              {/* Side-by-Side Impact Comparison Card */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <span className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">calculate</span>
                    Live Sizing Rate Comparison: Benchmark vs {getDealerName(selectedDealer)}
                  </span>
                  <span className="text-[11px] font-mono text-secondary">
                    Composite GST Included
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  {[3.3, 5.0, 10.0].map((kw) => {
                    const benchRate = kw <= 3.0 ? benchmarkRate1to3 : benchmarkRate3to10;
                    const benchTotal = kw * benchRate;

                    let customRate = benchRate;
                    if (pricingMode === 'custom') {
                      if (customBaseRatePerKw) {
                        customRate = Number(customBaseRatePerKw);
                      } else if (customBaseRatePerWp) {
                        customRate = Number(customBaseRatePerWp) * 1000 * 1.45; // Wp to turnkey EPC multiplier
                      }
                    }

                    let customTotal = kw * customRate;
                    if (pricingMode === 'custom' && customDiscountPercent) {
                      customTotal = customTotal * (1 - Number(customDiscountPercent) / 100);
                    }

                    const diff = customTotal - benchTotal;

                    return (
                      <div key={kw} className="p-3 rounded-lg bg-surface-container-lowest border border-surface-container-high/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                          <span>{kw} kW System</span>
                          <span className="font-mono text-primary">₹{Math.round(customTotal).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-secondary">
                          <span>Global Benchmark:</span>
                          <span className="font-mono">₹{Math.round(benchTotal).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-surface-container">
                          <span>Delta:</span>
                          <span className={`font-mono font-bold ${
                            diff < 0 ? 'text-emerald-400' : diff > 0 ? 'text-amber-400' : 'text-secondary'
                          }`}>
                            {diff === 0 ? 'Exact Match' : `${diff < 0 ? '-' : '+'}₹${Math.abs(Math.round(diff)).toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetToBenchmark}
                  className="px-4 py-2.5 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface hover:bg-surface-container transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  Reset to Global Benchmark
                </button>

                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <span className="text-xs text-primary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      Enforced for {getDealerName(selectedDealer)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-xs font-bold hover:bg-primary transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Save Pricing Preset
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-secondary bg-surface-container-lowest rounded-xl border border-surface-container-highest">
              Please select a dealer from the left column to configure custom pricing.
            </div>
          )}
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
            Showing {filteredDealers.length} records
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
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {filteredDealers.slice(0, 15).map(dealer => {
                const cfg = dealer.pricingConfig || {};
                const isCustom = cfg.pricingMode === 'custom';
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
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDealerId(dealer.id);
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
