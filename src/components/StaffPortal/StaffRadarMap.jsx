import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { useHighAccuracyLocation } from '../../hooks/useHighAccuracyLocation';
import {
  fetchGooglePlacesNearby,
  getSavedGooglePlacesApiKey,
  saveGooglePlacesApiKey,
  DEFAULT_ACTIVE_QUERIES,
  PRODUCTION_SOLAR_KEYWORD_MATRIX
} from '../../services/googlePlacesNearbyService';
import { geocodeAreaOrLandmark } from '../../services/n8nSolarRadarService';
import { GUJARAT_CITIES_COORDS } from '../../data/staffData';

export default function StaffRadarMap() {
  const { currentStaff, addCustomerFile } = useApp();
  const { addToast } = useToast();

  // 1. Live GPS High-Accuracy Location Hook (Phase 2 & 3: watchPosition with movement threshold)
  const initialCenter = GUJARAT_CITIES_COORDS[currentStaff?.city || 'Ahmedabad'] || { lat: 23.0225, lon: 72.5714 };
  const {
    coords,
    accuracy,
    isLowAccuracy,
    streetAddress,
    city: detectedCity,
    loading: gpsLoading,
    error: gpsError,
    isGpsActive,
    source: locationSource,
    lastUpdated: locationLastUpdated,
    movementDistance,
    acquireLocation,
    setManualLocation,
    setOnSignificantMove
  } = useHighAccuracyLocation({
    initialCoords: initialCenter,
    movementThresholdMeters: 35, // Auto-refresh when moved > 35 meters
    autoStartWatch: true
  });

  // 2. Configurable Radius (Phase 6: 1km, 2km, 5km default, 10km, 25km)
  const [radiusMeters, setRadiusMeters] = useState(5000); // 5 km default

  // 3. Configurable Query Matrix (Phase 4)
  const [activeQueries, setActiveQueries] = useState(() => DEFAULT_ACTIVE_QUERIES);
  const [customKeywordInput, setCustomKeywordInput] = useState('');

  // 4. Filter & Search State
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'epc', 'dealer', 'installer', 'shop'
  const [searchTerm, setSearchTerm] = useState('');

  // 5. Results & Diagnostics State (Phase 7 & 24)
  const [leads, setLeads] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [lastSearchTime, setLastSearchTime] = useState(null);

  // 6. View Mode: 'table' | 'radar' | 'cards'
  const [viewMode, setViewMode] = useState('table');

  // 7. Modals State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showManualSpotModal, setShowManualSpotModal] = useState(false);
  const [manualQueryInput, setManualQueryInput] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);
  const [gcpKeyInput, setGcpKeyInput] = useState(() => getSavedGooglePlacesApiKey());

  // Core Search Execution (Phase 5, 8, 9, 10)
  const executeLeadSearch = useCallback(
    async (targetLat = coords.lat, targetLon = coords.lon, targetRadius = radiusMeters, force = false) => {
      setIsSearching(true);
      try {
        const res = await fetchGooglePlacesNearby({
          latitude: targetLat,
          longitude: targetLon,
          radiusMeters: targetRadius,
          keywords: activeQueries,
          accuracy: accuracy || 10,
          forceRefresh: force
        });

        if (res.superseded) {
          // A newer request has been dispatched; ignore superseded response (Phase 28)
          return;
        }

        setIsSearching(false);
        setLastSearchTime(new Date().toLocaleTimeString());

        if (res.success && Array.isArray(res.leads)) {
          setLeads(res.leads);
          setDiagnostics(res.diagnostics);

          if (res.leads.length > 0) {
            addToast(`Discovered ${res.leads.length} nearby solar businesses!`, 'success');
          } else {
            addToast(`Zero solar entities found within ${(targetRadius / 1000)} km. Expand radius or adjust keywords.`, 'info');
          }
        } else {
          setDiagnostics(res.diagnostics);
          if (res.error) {
            addToast(res.error, 'error');
          }
        }
      } catch (err) {
        setIsSearching(false);
        addToast('Search failed: Network error', 'error');
      }
    },
    [coords.lat, coords.lon, radiusMeters, activeQueries, accuracy, addToast]
  );

  // Initial search on mount
  useEffect(() => {
    executeLeadSearch(coords.lat, coords.lon, radiusMeters);
  }, [coords.lat, coords.lon, radiusMeters, activeQueries]);

  // Phase 3: Auto-refresh when salesperson moves > 35m
  useEffect(() => {
    setOnSignificantMove(({ lat, lon, distanceMoved }) => {
      addToast(`📍 Location moved ${distanceMoved}m. Updating nearby solar leads...`, 'info');
      executeLeadSearch(lat, lon, radiusMeters);
    });
  }, [setOnSignificantMove, executeLeadSearch, radiusMeters, addToast]);

  // Handle Manual Pin Spot
  const handleApplyManualSpot = async (e) => {
    if (e) e.preventDefault();
    if (!manualQueryInput.trim()) return;

    setIsGeocodingManual(true);
    const geo = await geocodeAreaOrLandmark(manualQueryInput.trim());
    setIsGeocodingManual(false);

    if (geo.success) {
      setManualLocation({
        lat: geo.lat,
        lon: geo.lon,
        customAddress: geo.displayName,
        customCity: geo.city
      });
      setShowManualSpotModal(false);
      addToast(`Spot Locked: ${geo.displayName}`, 'success');
      executeLeadSearch(geo.lat, geo.lon, radiusMeters, true);
    } else {
      addToast(`Could not pinpoint "${manualQueryInput}". Try specifying city/state.`, 'error');
    }
  };

  // Handle GCP Key Save
  const handleSaveGcpKey = () => {
    saveGooglePlacesApiKey(gcpKeyInput);
    addToast('Google Places API (New) key updated!', 'success');
    executeLeadSearch(coords.lat, coords.lon, radiusMeters, true);
  };

  // Toggle Query in Matrix
  const handleToggleQuery = (queryText) => {
    setActiveQueries((prev) => {
      if (prev.includes(queryText)) {
        if (prev.length === 1) {
          addToast('At least one search query must remain active', 'error');
          return prev;
        }
        return prev.filter((q) => q !== queryText);
      } else {
        return [...prev, queryText];
      }
    });
  };

  // Add Custom Query
  const handleAddCustomQuery = (e) => {
    e.preventDefault();
    const clean = customKeywordInput.trim();
    if (!clean) return;
    if (activeQueries.includes(clean)) {
      addToast('Query already in active search matrix', 'info');
      return;
    }
    setActiveQueries((prev) => [...prev, clean]);
    setCustomKeywordInput('');
    addToast(`Added "${clean}" to search matrix`, 'success');
  };

  // Convert Lead to Customer File
  const handleClaimLeadAsFile = (lead) => {
    const newFile = {
      id: `FIL-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: lead.name,
      phone: lead.phone || '',
      address: lead.address || '',
      city: lead.city || detectedCity,
      discom: 'UGVCL',
      consumerNo: '',
      sanctionedLoadKw: 5.0,
      solarSystemKw: 3.3,
      roofType: 'RCC Flat Roof',
      staffId: currentStaff?.id || 'STF-001',
      staffName: currentStaff?.name || 'Solar Field Executive',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      applicationNo: 'Draft Pending',
      notes: `Discovered via Live Location Lead Discovery (${lead.distanceKm} km away). Relevance: ${lead.relevanceTier || 'High'}. Google Place ID: ${lead.google_place_id || 'N/A'}`,
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };
    addCustomerFile(newFile);
    addToast(`Lead "${lead.name}" added to your Customer Files!`, 'success');
  };

  // Filter leads
  const filteredLeads = leads.filter((item) => {
    const matchCat =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'dealer'
        ? item.type === 'dealer'
        : selectedCategory === 'epc'
        ? item.type === 'epc'
        : selectedCategory === 'shop'
        ? item.type === 'shop'
        : selectedCategory === 'installer'
        ? item.type === 'installer' || item.category.toLowerCase().includes('installer')
        : true;

    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.address || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term) ||
      (item.phone || '').includes(term);

    return matchCat && matchTerm;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-on-surface">
      {/* ========================================================
          1. LIVE GPS STATUS & ACTION HEADER (Phase 2 & 15 UX)
          ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0D1527] border border-white/15 p-5 sm:p-7 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <span className="material-symbols-outlined text-[22px]">radar</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Live Location Solar Lead Discovery
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Continuously searches Google Maps and Places around your exact GPS coordinates. Detects solar EPCs, dealers, shops, and rooftop installers in real-time.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Refresh Leads Button */}
            <button
              onClick={() => executeLeadSearch(coords.lat, coords.lon, radiusMeters, true)}
              disabled={isSearching}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSearching ? 'animate-spin' : ''}`}>
                {isSearching ? 'sync' : 'refresh'}
              </span>
              <span>{isSearching ? 'Finding Nearby Solar Businesses...' : 'Refresh Leads from Current Location'}</span>
            </button>

            {/* Developer Diagnostics Button (Phase 7 & 24) */}
            <button
              onClick={() => setShowDiagnostics(true)}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Lead Discovery Diagnostics"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-400">bug_report</span>
              <span>Diagnostics</span>
            </button>
          </div>
        </div>

        {/* Live Location Telemetry Bar (Phase 2 & 15) */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live GPS State Indicator */}
            <div
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-bold ${
                isGpsActive && !isLowAccuracy
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : isLowAccuracy
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-red-500/20 border-red-500/40 text-red-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isGpsActive && !isLowAccuracy ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isGpsActive && !isLowAccuracy ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span>
                {isGpsActive
                  ? locationSource === 'manual_pin'
                    ? '📍 Manual Pin Active (Calibrated)'
                    : `🟢 Live Location Active (Accuracy: ±${accuracy || 15}m)`
                  : 'Location Inactive'}
              </span>
            </div>

            {/* Coordinates */}
            <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-400 font-sans">Coordinates:</span>
              <span className="font-bold text-emerald-300">{coords.lat.toFixed(6)}° N, {coords.lon.toFixed(6)}° E</span>
            </div>

            {/* Street Address */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-slate-300 max-w-sm truncate"
              title={streetAddress}
            >
              <span className="material-symbols-outlined text-[15px] text-emerald-400 shrink-0">pin_drop</span>
              <span className="font-medium truncate">{streetAddress}</span>
            </div>
          </div>

          {/* Location Actions & Timestamp */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Last updated: {lastSearchTime || locationLastUpdated?.toLocaleTimeString() || 'Just now'}
            </span>

            <button
              onClick={() => {
                setManualQueryInput(streetAddress || detectedCity);
                setShowManualSpotModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px] text-amber-400">edit_location</span>
              <span>Pick Manual Spot</span>
            </button>
          </div>
        </div>

        {/* Low Accuracy Warning (Phase 2 & 15) */}
        {isLowAccuracy && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-400">warning</span>
              <span>
                Location accuracy is currently ±{accuracy}m. Move outdoors or wait a few seconds for a better GPS fix, or click "Pick Manual Spot" to pinpoint your exact address.
              </span>
            </div>
            <button
              onClick={() => setShowManualSpotModal(true)}
              className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-md text-[11px] cursor-pointer shrink-0"
            >
              Pick Exact Spot
            </button>
          </div>
        )}

        {/* GPS Error Prompt (Phase 16) */}
        {gpsError && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
              <div>
                <strong>Unable to access live location:</strong> {gpsError.message}
                <div className="text-[11px] text-red-300 mt-0.5">
                  Please enable browser location permissions, enable device GPS, or manually pick your spot.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={acquireLocation}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Retry GPS
              </button>
              <button
                onClick={() => setShowManualSpotModal(true)}
                className="px-3 py-1 bg-red-500 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Pick Spot
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          2. RADIUS & SEARCH MATRIX BAR (Phase 4 & 6)
          ======================================================== */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Radius Filter Chips (Phase 6: 1km, 2km, 5km default, 10km, 25km) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider text-[11px] mr-1">Radius:</span>
          {[
            { label: '1 km', value: 1000 },
            { label: '2 km', value: 2000 },
            { label: '5 km (Default)', value: 5000 },
            { label: '10 km', value: 10000 },
            { label: '25 km', value: 25000 }
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => setRadiusMeters(r.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                radiusMeters === r.value
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Business Category Filter Chips (Phase 8: Non-destructive filtering) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider text-[11px] mr-1">Category:</span>
          {[
            { id: 'all', label: 'All Businesses' },
            { id: 'epc', label: 'EPCs' },
            { id: 'dealer', label: 'Dealers & Distributors' },
            { id: 'installer', label: 'Rooftop Installers' },
            { id: 'shop', label: 'Shops & Suppliers' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-surface-container-lowest text-primary border border-primary shadow-xs'
                  : 'bg-surface-container-low text-secondary hover:text-on-surface'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, address..."
              className="h-8 pl-8 pr-3 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none w-36 sm:w-44"
            />
          </div>

          <div className="flex items-center p-0.5 bg-surface-container-low rounded-xl border border-surface-container-high">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[15px]">table_chart</span>
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('radar')}
              className={`p-1.5 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'radar' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Radar Visualizer"
            >
              <span className="material-symbols-outlined text-[15px]">radar</span>
              <span className="hidden sm:inline">Radar</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Card Grid"
            >
              <span className="material-symbols-outlined text-[15px]">view_agenda</span>
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. PRIMARY UNIFIED DATA TABLE (Phase 9 & 10: place_id unique, sorted strictly by distance)
          ======================================================== */}
      {viewMode === 'table' && (
        <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
          {/* Header Strip */}
          <div className="p-3.5 bg-surface-container-low border-b border-surface-container-high flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-on-surface">
                {filteredLeads.length} Nearby Solar Leads Found within {(radiusMeters / 1000)} km
              </span>
              <span className="text-secondary font-mono">
                • {activeQueries.length} Parallel Queries
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">bolt</span>
                <span>100% Free Solar Engine Active</span>
              </span>
            </div>
            <div className="text-secondary font-medium">
              Sorted strictly by actual GPS distance: <strong>Closest business right next to you is #1</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="bg-surface-container-lowest border-b border-surface-container-high text-secondary uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-4 min-w-[210px]">Business Name &amp; Place ID</th>
                  <th className="py-3 px-3 min-w-[130px]">Category &amp; Relevance</th>
                  <th className="py-3 px-3 text-center min-w-[120px]">Proximity (from GPS)</th>
                  <th className="py-3 px-4 min-w-[220px]">Address</th>
                  <th className="py-3 px-3 min-w-[140px]">Phone &amp; Website</th>
                  <th className="py-3 px-4 text-right min-w-[200px]">Ground Action Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-secondary">
                      <div className="space-y-2 max-w-md mx-auto">
                        <span className="material-symbols-outlined text-4xl text-secondary/40">near_me_disabled</span>
                        <h4 className="font-bold text-sm text-on-surface">No Solar Businesses Discovered Within {(radiusMeters / 1000)} km</h4>
                        <p className="text-xs">
                          Expand your search radius or inspect the Diagnostics panel to see raw Google Places query logs.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setRadiusMeters(10000)}
                            className="px-3 py-1.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                          >
                            Expand to 10 km
                          </button>
                          <button
                            onClick={() => setShowDiagnostics(true)}
                            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-lg text-xs cursor-pointer"
                          >
                            Open Diagnostics
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((item, idx) => {
                    const badgeClass =
                      item.type === 'epc'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : item.type === 'shop'
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : item.type === 'dealer'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                    const cleanPhone = (item.phone || '').replace(/\D/g, '');

                    return (
                      <tr
                        key={item.id || item.google_place_id || idx}
                        className={`hover:bg-surface-container-low transition-colors ${
                          idx === 0 ? 'bg-emerald-500/5 font-semibold' : ''
                        }`}
                      >
                        {/* 1. Proximity Rank */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-mono font-bold ${
                              idx === 0
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-surface-container text-secondary'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* 2. Business Name & Place ID */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface text-[13px]">{item.name}</span>
                              {item.verified && (
                                <span className="material-symbols-outlined text-[15px] text-primary" title="Verified Place">
                                  verified
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-secondary mt-0.5">
                              {item.rating && (
                                <span className="flex items-center text-amber-600 font-bold">★ {item.rating}</span>
                              )}
                              {item.reviewsCount > 0 && <span>({item.reviewsCount} reviews)</span>}
                              {item.isOpen !== undefined && (
                                <span className={item.isOpen ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                                  • {item.isOpen ? 'Open Now' : 'Closed'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={item.google_place_id}>
                              ID: {item.google_place_id}
                            </span>
                          </div>
                        </td>

                        {/* 3. Category & Relevance Tier (Phase 8) */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass}`}>
                              {item.category}
                            </span>
                            {item.relevanceTier && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  item.relevanceTier === 'HIGH RELEVANCE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.relevanceTier === 'MEDIUM RELEVANCE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {item.relevanceTier}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Proximity from GPS (Phase 9) */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                                item.distanceMeters <= 500
                                  ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                                  : item.distanceMeters <= 2000
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-surface-container text-secondary'
                              }`}
                            >
                              {item.distanceMeters < 1000
                                ? `${item.distanceMeters} m away`
                                : `${item.distanceKm} km away`}
                            </span>
                            {idx === 0 && item.distanceMeters <= 300 && (
                              <span className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                Right Next to You 📍
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Address */}
                        <td className="py-3 px-4">
                          <span className="text-on-surface line-clamp-2" title={item.address}>
                            {item.address}
                          </span>
                        </td>

                        {/* 6. Phone & Website */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            {item.phone ? (
                              <a
                                href={`tel:${item.phone}`}
                                className="text-primary font-bold hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">phone</span>
                                <span>{item.phone}</span>
                              </a>
                            ) : (
                              <span className="text-secondary text-[11px]">Phone unlisted</span>
                            )}
                            {item.website && (
                              <a
                                href={item.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-secondary hover:text-primary flex items-center gap-1 text-[11px] truncate max-w-[130px]"
                                title={item.website}
                              >
                                <span className="material-symbols-outlined text-[12px]">link</span>
                                <span className="truncate">{item.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* 7. Ground Actions (Phase 13 Google Maps Link + Call + WhatsApp) */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Call Now */}
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                                title="Call Business"
                              >
                                <span className="material-symbols-outlined text-[15px]">call</span>
                                <span>Call</span>
                              </a>
                            )}

                            {/* Navigate (Phase 13: Genuine Google Maps place_id URL) */}
                            <a
                              href={item.googleMapsUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                              title="Open Exact Google Maps Place"
                            >
                              <span className="material-symbols-outlined text-[15px]">directions</span>
                              <span>Navigate</span>
                            </a>

                            {/* WhatsApp */}
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(item.name)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Representative')}%20from%20Sunvine%20Renewable%20regarding%20solar%20collaboration.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 rounded-lg transition-colors"
                                title="Chat on WhatsApp"
                              >
                                <span className="material-symbols-outlined text-[16px]">chat</span>
                              </a>
                            )}

                            {/* Create Lead File */}
                            <button
                              onClick={() => handleClaimLeadAsFile(item)}
                              className="p-1.5 bg-surface-container-low hover:bg-surface-container border border-surface-container-high rounded-lg text-on-surface transition-colors cursor-pointer"
                              title="Add to Customer Files"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">person_add</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          4. VIEW: RADAR CONCENTRIC CIRCLE VIEW (Phase 14 Sync)
          ======================================================== */}
      {viewMode === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative bg-[#070D18] border border-white/15 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[460px] overflow-hidden shadow-2xl">
            <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-emerald-500/20"></div>
              <div className="absolute inset-10 rounded-full border border-emerald-500/20"></div>
              <div className="absolute inset-24 rounded-full border border-emerald-500/25"></div>
              <div className="absolute inset-36 rounded-full border border-emerald-500/30"></div>
              <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-500/20"></div>
              <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500/20"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 via-transparent to-transparent animate-spin duration-7000 pointer-events-none origin-center"></div>

              {/* Center User Pin */}
              <div className="absolute z-20 flex flex-col items-center justify-center pointer-events-none">
                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 text-[10px] font-bold shadow-lg shadow-emerald-400/50">
                  <span className="material-symbols-outlined text-[14px]">person_pin_circle</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-300 mt-1 bg-black/80 px-1.5 py-0.5 rounded">
                  You Are Here
                </span>
              </div>

              {/* Mapped Dots */}
              {filteredLeads.map((ent, idx) => {
                const maxMeters = radiusMeters;
                const ratio = Math.min(0.95, (ent.distanceMeters || 100) / maxMeters);
                const angle = (idx * (360 / Math.max(1, filteredLeads.length))) * (Math.PI / 180);
                const posX = Math.cos(angle) * (180 * ratio);
                const posY = Math.sin(angle) * (180 * ratio);

                const isSelected = selectedEntity?.id === ent.id;

                return (
                  <button
                    key={ent.id || idx}
                    onClick={() => setSelectedEntity(ent)}
                    style={{ transform: `translate(${posX}px, ${posY}px)` }}
                    className={`absolute z-30 p-1.5 rounded-full shadow-lg transition-transform hover:scale-125 cursor-pointer ${
                      isSelected
                        ? 'ring-4 ring-white scale-125 bg-amber-400 text-slate-950'
                        : idx === 0
                        ? 'bg-rose-500 text-white ring-2 ring-white scale-110'
                        : ent.type === 'epc'
                        ? 'bg-blue-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                    title={`${ent.name} (${ent.distanceMeters} m)`}
                  >
                    <span className="material-symbols-outlined text-[13px] block">
                      {ent.type === 'epc' ? 'engineering' : 'store'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="w-full mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Center: {streetAddress}</span>
              <span className="text-emerald-400 font-mono">Radius: {(radiusMeters / 1000)} km</span>
            </div>
          </div>

          {/* Selected Entity Inspector */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
            {selectedEntity ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-blue-100 text-blue-800 border-blue-200">
                    {selectedEntity.category}
                  </span>
                  <h3 className="text-base font-bold text-on-surface mt-2">{selectedEntity.name}</h3>
                  <p className="text-xs text-emerald-700 font-mono font-bold mt-0.5">
                    {selectedEntity.distanceMeters} meters from your live GPS
                  </p>
                </div>

                <div className="space-y-2 text-xs text-secondary border-t border-surface-container-high pt-3">
                  <div className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">location_on</span>
                    <span className="text-on-surface">{selectedEntity.address}</span>
                  </div>
                  {selectedEntity.phone && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0">call</span>
                      <a href={`tel:${selectedEntity.phone}`} className="text-primary font-bold hover:underline">
                        {selectedEntity.phone}
                      </a>
                    </div>
                  )}
                  {selectedEntity.website && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0">link</span>
                      <a href={selectedEntity.website} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline truncate">
                        {selectedEntity.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-surface-container-high space-y-2">
                  <a
                    href={selectedEntity.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Start Turn-by-Turn GPS Navigation</span>
                  </a>

                  {selectedEntity.phone && (
                    <a
                      href={`tel:${selectedEntity.phone}`}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      <span>Call Now ({selectedEntity.phone})</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleClaimLeadAsFile(selectedEntity)}
                    className="w-full py-2 px-3 bg-surface-container-low hover:bg-surface-container text-on-surface border border-surface-container-high rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>Add to Customer Files</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-secondary space-y-2 my-auto">
                <span className="material-symbols-outlined text-4xl text-secondary/40">near_me</span>
                <h4 className="text-sm font-bold text-on-surface">Select Any Radar Entity</h4>
                <p className="text-xs">Click on any radar dot to inspect contact details, relevance tier, and navigation directions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          5. VIEW: CARDS DIRECTORY VIEW
          ======================================================== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((item, idx) => (
            <div
              key={item.id || item.google_place_id || idx}
              className="bg-surface rounded-xl p-5 border border-surface-container-high shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-blue-100 text-blue-800 border-blue-200">
                    {item.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    {item.distanceMeters < 1000 ? `${item.distanceMeters} m` : `${item.distanceKm} km`}
                  </span>
                </div>

                <h3 className="text-base font-bold text-on-surface mt-2 flex items-center gap-1.5">
                  <span>{item.name}</span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-bold">
                      #1 Nearest
                    </span>
                  )}
                </h3>

                <div className="mt-3 space-y-1.5 text-xs text-secondary">
                  <div className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">location_on</span>
                    <span className="text-on-surface line-clamp-2">{item.address}</span>
                  </div>
                  {item.phone && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0">call</span>
                      <a href={`tel:${item.phone}`} className="text-primary font-bold hover:underline">
                        {item.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-surface-container-high grid grid-cols-2 gap-2">
                {item.phone ? (
                  <a
                    href={`tel:${item.phone}`}
                    className="py-1.5 px-2 bg-emerald-600 text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    <span>Call</span>
                  </a>
                ) : (
                  <div></div>
                )}
                <a
                  href={item.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 bg-blue-600 text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">directions</span>
                  <span>Navigate</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          6. DEVELOPER / DEBUG DIAGNOSTICS MODAL (Phase 7 & 24)
          ======================================================== */}
      {showDiagnostics && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-surface-container-high shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                  <span className="material-symbols-outlined text-[22px]">developer_mode</span>
                </span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Lead Discovery Diagnostics</h3>
                  <p className="text-xs text-secondary">Real-time inspection of GPS coordinates, Google Places API telemetry, and query logs</p>
                </div>
              </div>
              <button onClick={() => setShowDiagnostics(false)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* GPS Telemetry */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
              <div className="font-bold text-on-surface flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">my_location</span>
                <span>Live GPS Sensor Telemetry:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Latitude</span>
                  <span className="font-bold text-on-surface">{coords.lat.toFixed(6)}</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Longitude</span>
                  <span className="font-bold text-on-surface">{coords.lon.toFixed(6)}</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Accuracy</span>
                  <span className="font-bold text-on-surface">±{accuracy || 10} meters</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Location Source</span>
                  <span className="font-bold text-on-surface">{locationSource}</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Movement from Center</span>
                  <span className="font-bold text-on-surface">{movementDistance} m</span>
                </div>
                <div className="p-2 rounded bg-surface-container">
                  <span className="text-secondary block font-sans">Last Update</span>
                  <span className="font-bold text-on-surface">{locationLastUpdated?.toLocaleTimeString() || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Google Places API Telemetry */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3 text-xs">
              <div className="font-bold text-on-surface flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-[16px]">cloud_sync</span>
                  <span>Google Places API Connection:</span>
                </div>
                <span className="font-mono text-[11px] text-secondary">
                  Latency: {diagnostics?.apiLatencyMs || 0} ms
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-secondary">Status: </span>
                  <strong className={diagnostics?.googleApiStatus?.startsWith('CONNECTED') ? 'text-emerald-700' : 'text-amber-700'}>
                    {diagnostics?.googleApiStatus || 'Checking...'}
                  </strong>
                </div>
                <div>
                  <span className="text-secondary">Active Endpoint: </span>
                  <span>{diagnostics?.googleApiType || 'Places API (New) v1/places:searchText'}</span>
                </div>
                <div>
                  <span className="text-secondary">Search Radius: </span>
                  <span>{radiusMeters} meters ({(radiusMeters / 1000)} km circle)</span>
                </div>
              </div>

              {/* GCP API Key input */}
              <div className="pt-2 border-t border-surface-container-high space-y-1.5">
                <label className="block text-[11px] font-semibold text-secondary">
                  Configure / Override Google Cloud Places API Key:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={gcpKeyInput}
                    onChange={(e) => setGcpKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container border border-surface-container-high text-xs font-mono text-on-surface outline-none"
                  />
                  <button
                    onClick={handleSaveGcpKey}
                    className="h-8 px-3 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Save &amp; Test
                  </button>
                </div>
              </div>
            </div>

            {/* Results Funnel & Deduplication Stats (Phase 7) */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
              <div className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-600 text-[16px]">filter_alt</span>
                <span>Results Funnel &amp; Deduplication Breakdown:</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-lg bg-surface-container">
                  <span className="text-[10px] text-secondary font-sans block">Raw Results</span>
                  <strong className="text-base text-on-surface">{diagnostics?.rawPlacesReceived || 0}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container">
                  <span className="text-[10px] text-secondary font-sans block">Unique place_id</span>
                  <strong className="text-base text-on-surface">{diagnostics?.resultsAfterDeduplication || 0}</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container">
                  <span className="text-[10px] text-secondary font-sans block">Final Inside Circle</span>
                  <strong className="text-base text-emerald-700">{diagnostics?.resultsAfterFiltering || 0}</strong>
                </div>
              </div>
            </div>

            {/* Discarded Audit Log (Phase 7: Exact reason why a company did not appear) */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
              <div className="font-bold text-on-surface flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[16px]">visibility_off</span>
                  <span>Discarded / Excluded Places Log ({diagnostics?.discardedList?.length || 0}):</span>
                </div>
                <span className="text-[10px] text-secondary">Explains why a business didn't show</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {diagnostics?.discardedList?.length === 0 ? (
                  <span className="text-secondary italic">No places were discarded. All fetched places were valid and within radius.</span>
                ) : (
                  (diagnostics?.discardedList || []).map((d, i) => (
                    <div key={i} className="p-2 rounded bg-surface-container flex items-start justify-between gap-2">
                      <span className="font-bold text-on-surface">{d.name}</span>
                      <span className="text-rose-700 shrink-0">{d.reason}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Search Query Matrix Configurator (Phase 4) */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2.5 text-xs">
              <div className="font-bold text-on-surface flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">checklist</span>
                  <span>Active Multi-Query Matrix ({activeQueries.length} Queries):</span>
                </div>
                <button
                  onClick={() => setActiveQueries(DEFAULT_ACTIVE_QUERIES)}
                  className="text-primary text-[11px] hover:underline cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {activeQueries.map((q) => (
                  <span
                    key={q}
                    className="px-2 py-1 rounded-md bg-surface-container border border-surface-container-high text-[11px] font-medium flex items-center gap-1 text-on-surface"
                  >
                    <span>{q}</span>
                    <button
                      onClick={() => handleToggleQuery(q)}
                      className="text-secondary hover:text-rose-600 cursor-pointer"
                      title="Remove Query"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                ))}
              </div>

              {/* Add custom query */}
              <form onSubmit={handleAddCustomQuery} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={customKeywordInput}
                  onChange={(e) => setCustomKeywordInput(e.target.value)}
                  placeholder="Add custom keyword (e.g. solar water pump, Waaree dealer)..."
                  className="flex-1 h-8 px-2.5 rounded-lg bg-surface-container border border-surface-container-high text-xs text-on-surface outline-none"
                />
                <button
                  type="submit"
                  className="h-8 px-3 bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-on-surface font-bold rounded-lg text-xs cursor-pointer"
                >
                  Add Query
                </button>
              </form>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-surface-container-high">
              <button
                onClick={() => setShowDiagnostics(false)}
                className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. MANUAL PIN / SPOT MODAL (Phase 2 & 16 Fallback)
          ======================================================== */}
      {showManualSpotModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-surface-container-high shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-on-surface">Pick Exact Spot / Area</h3>
              <button onClick={() => setShowManualSpotModal(false)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              If your device's browser GPS gave inaccurate coordinates or you are testing a specific physical spot, enter the exact area, colony, or landmark name to lock 100% accurate coordinates.
            </p>

            <form onSubmit={handleApplyManualSpot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Area / Street / Colony / Landmark
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prahlad Nagar, SG Highway, Katargam, GIDC Makarpura..."
                  value={manualQueryInput}
                  onChange={(e) => setManualQueryInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualSpotModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeocodingManual}
                  className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${isGeocodingManual ? 'animate-spin' : ''}`}>
                    {isGeocodingManual ? 'sync' : 'pin_drop'}
                  </span>
                  <span>{isGeocodingManual ? 'Locking Spot...' : 'Lock Exact Spot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
