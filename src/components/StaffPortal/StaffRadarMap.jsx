import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { useHighAccuracyLocation } from '../../hooks/useHighAccuracyLocation';
import {
  fetchGooglePlacesNearby,
  getSavedGooglePlacesApiKey,
  saveGooglePlacesApiKey,
  DEFAULT_SOLAR_KEYWORDS
} from '../../services/googlePlacesNearbyService';
import {
  geocodeAreaOrLandmark,
  saveCustomSolarVendor,
  getCustomSolarVendors
} from '../../services/n8nSolarRadarService';
import { GUJARAT_CITIES_COORDS } from '../../data/staffData';

export default function StaffRadarMap() {
  const { currentStaff, addCustomerFile } = useApp();
  const { addToast } = useToast();

  // 1. Device-Level High-Accuracy Geolocation Hook
  const initialCenter = GUJARAT_CITIES_COORDS[currentStaff?.city || 'Ahmedabad'] || { lat: 23.0225, lon: 72.5714 };
  const {
    coords,
    accuracy,
    streetAddress,
    city: detectedCity,
    loading: gpsLoading,
    error: gpsError,
    isGpsActive,
    source: locationSource,
    acquireLocation,
    setManualLocation
  } = useHighAccuracyLocation(initialCenter);

  // 2. Strict Circular Radius & Filter State
  const [radiusMeters, setRadiusMeters] = useState(3000); // Default: 3 km
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'dealer', 'epc', 'installer', 'shop'
  const [searchTerm, setSearchTerm] = useState('');

  // 3. Leads & Generation State
  const [leads, setLeads] = useState([]);
  const [isFetchingLeads, setIsFetchingLeads] = useState(false);
  const [activeProvider, setActiveProvider] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);

  // 4. View Mode: 'table' (default) | 'radar' | 'cards'
  const [viewMode, setViewMode] = useState('table');

  // 5. Manual Location Adjust Modal
  const [showManualLocModal, setShowManualLocModal] = useState(false);
  const [manualInputQuery, setManualInputQuery] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);

  // 6. GCP Places API Key Settings Modal
  const [showGcpSettings, setShowGcpSettings] = useState(false);
  const [gcpKeyInput, setGcpKeyInput] = useState(() => getSavedGooglePlacesApiKey());

  // 7. Manual Add / Check-In Modal
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInForm, setCheckInForm] = useState({
    name: '',
    category: 'Solar EPC Contractor & Installer',
    type: 'epc',
    phone: '',
    email: '',
    address: '',
    speciality: 'Rooftop Solar EPC'
  });

  // Fetch Leads function with strict distance sorting
  const fetchNearbySolarLeads = useCallback(async (targetLat = coords.lat, targetLon = coords.lon, targetRadius = radiusMeters) => {
    setIsFetchingLeads(true);
    try {
      const res = await fetchGooglePlacesNearby({
        latitude: targetLat,
        longitude: targetLon,
        radiusMeters: targetRadius,
        keywords: DEFAULT_SOLAR_KEYWORDS
      });

      // Merge any user registered custom check-ins
      const customVendors = getCustomSolarVendors();
      const customWithDist = customVendors.map(c => {
        const R = 6371000;
        const dLat = ((c.lat - targetLat) * Math.PI) / 180;
        const dLon = ((c.lon - targetLon) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((targetLat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return {
          ...c,
          distanceMeters: Math.round(distM),
          distanceKm: Number((distM / 1000).toFixed(2))
        };
      }).filter(c => c.distanceMeters <= targetRadius);

      const allMerged = [...customWithDist, ...(res.leads || [])];

      // Deduplicate by place ID / name
      const uniqueMap = new Map();
      for (const item of allMerged) {
        const key = item.id || item.name.toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());

      // STRICT SORTING BY DISTANCE: Nearest first (#1 is right next to the user)
      deduplicated.sort((a, b) => a.distanceMeters - b.distanceMeters);

      setLeads(deduplicated);
      setActiveProvider(res.provider || 'Live Intelligence Network');
      setIsFetchingLeads(false);

      if (deduplicated.length > 0) {
        addToast(`Discovered ${deduplicated.length} solar businesses within ${(targetRadius / 1000)} km!`, 'success');
      } else {
        addToast(`No solar entities found within ${(targetRadius / 1000)} km. Try expanding radius.`, 'info');
      }
    } catch (err) {
      setIsFetchingLeads(false);
      addToast('Error fetching solar leads', 'error');
    }
  }, [coords.lat, coords.lon, radiusMeters, addToast]);

  // Initial fetch on mount & coordinates change
  useEffect(() => {
    fetchNearbySolarLeads(coords.lat, coords.lon, radiusMeters);
  }, [coords.lat, coords.lon, radiusMeters]);

  // Initial GPS detection on load
  useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);

  // Handle Manual Pin / Spot Selection
  const handleApplyManualSpot = async (e) => {
    if (e) e.preventDefault();
    if (!manualInputQuery.trim()) return;

    setIsGeocodingManual(true);
    const geo = await geocodeAreaOrLandmark(manualInputQuery.trim());
    setIsGeocodingManual(false);

    if (geo.success) {
      setManualLocation({
        lat: geo.lat,
        lon: geo.lon,
        customAddress: geo.displayName,
        customCity: geo.city
      });
      setShowManualLocModal(false);
      addToast(`Spot Locked: ${geo.displayName}`, 'success');
    } else {
      addToast(`Could not locate "${manualInputQuery}". Please enter city or landmark name.`, 'error');
    }
  };

  // Save GCP Places API Key
  const handleSaveGcpKey = () => {
    saveGooglePlacesApiKey(gcpKeyInput);
    setShowGcpSettings(false);
    addToast('Google Places API (New) Key saved!', 'success');
    fetchNearbySolarLeads();
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
      staffName: currentStaff?.name || 'Solar Executive',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      applicationNo: 'Draft Pending',
      notes: `Generated via Google Places Nearby Radar (${lead.distanceKm} km away). Website: ${lead.website || 'N/A'}`,
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };
    addCustomerFile(newFile);
    addToast(`Lead "${lead.name}" added to Customer Files!`, 'success');
  };

  // Save Manual Check-In
  const handleSaveCheckIn = (e) => {
    e.preventDefault();
    if (!checkInForm.name.trim()) return;

    saveCustomSolarVendor({
      name: checkInForm.name.trim(),
      category: checkInForm.category,
      type: checkInForm.type,
      phone: checkInForm.phone || '+91 98000 00000',
      email: checkInForm.email,
      address: checkInForm.address || streetAddress,
      city: detectedCity,
      lat: coords.lat,
      lon: coords.lon,
      distanceMeters: 0,
      distanceKm: 0.0,
      speciality: checkInForm.speciality,
      rating: 5.0,
      reviewsCount: 1,
      isCustom: true
    });

    setShowCheckInModal(false);
    addToast(`Company "${checkInForm.name}" registered right at your spot!`, 'success');
    fetchNearbySolarLeads();
  };

  // Filter leads by search term & category
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
        ? item.type === 'epc' || item.category.toLowerCase().includes('installer')
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
          1. TOP RADAR HEADER & DEVICE GPS VERIFICATION
          ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0D1527] border border-white/15 p-5 sm:p-7 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <span className="material-symbols-outlined text-[22px]">near_me</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Nearby Solar Leads (Google Places API New Engine)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time circular search strictly centered on your live coordinates. Discovers solar EPC contractors, dealers, and equipment suppliers with meters-level proximity.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Refresh Button */}
            <button
              onClick={() => fetchNearbySolarLeads()}
              disabled={isFetchingLeads}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isFetchingLeads ? 'animate-spin' : ''}`}>
                {isFetchingLeads ? 'sync' : 'refresh'}
              </span>
              <span>{isFetchingLeads ? 'Locating Nearby Solar...' : 'Refresh Leads from Current Location'}</span>
            </button>

            {/* Check-In / Register Spot */}
            <button
              onClick={() => {
                setCheckInForm({
                  name: '',
                  category: 'Solar EPC Contractor & Installer',
                  type: 'epc',
                  phone: '',
                  email: '',
                  address: streetAddress,
                  speciality: 'Rooftop Solar EPC'
                });
                setShowCheckInModal(true);
              }}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-400">add_location_alt</span>
              <span>Check-In Spot</span>
            </button>

            {/* GCP API Key Config */}
            <button
              onClick={() => setShowGcpSettings(true)}
              className="p-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Google Places API Key Settings"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-400">key</span>
              <span>GCP Key</span>
            </button>
          </div>
        </div>

        {/* Device GPS Live Verification Bar */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* GPS Signal Status Badge */}
            <button
              onClick={acquireLocation}
              disabled={gpsLoading}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                isGpsActive
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${gpsLoading ? 'animate-spin' : isGpsActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {gpsLoading ? 'sync' : isGpsActive ? 'my_location' : 'location_disabled'}
              </span>
              <span>
                {gpsLoading
                  ? 'Acquiring High-Accuracy GPS...'
                  : isGpsActive
                  ? `Live GPS Locked (${locationSource === 'manual_pin' ? 'Manual Pin' : `±${accuracy || 5}m accuracy`})`
                  : 'Acquire Live GPS'}
              </span>
            </button>

            {/* Exact Lat / Lon Coordinate Display */}
            <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 font-mono text-[11px] text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-400 font-sans">Spot:</span>
              <span className="font-bold text-emerald-300">{coords.lat.toFixed(6)}° N, {coords.lon.toFixed(6)}° E</span>
            </div>

            {/* Detected Street Address */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-slate-300 max-w-md truncate" title={streetAddress}>
              <span className="material-symbols-outlined text-[15px] text-emerald-400 shrink-0">pin_drop</span>
              <span className="font-medium truncate">{streetAddress}</span>
            </div>
          </div>

          {/* Adjust / Manual Spot Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setManualInputQuery(streetAddress || detectedCity);
                setShowManualLocModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-amber-400">tune</span>
              <span>Adjust / Pick Manual Spot</span>
            </button>

            {/* Direct Google Maps View */}
            <a
              href={`https://www.google.com/maps/search/solar+companies/@${coords.lat},${coords.lon},14z`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 px-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              title="Verify Coordinates on Google Maps"
            >
              <span className="material-symbols-outlined text-[15px]">travel_explore</span>
            </a>
          </div>
        </div>

        {/* GPS Error Prompt */}
        {gpsError && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-400">warning</span>
              <span>{gpsError.message}</span>
            </div>
            <button
              onClick={() => setShowManualLocModal(true)}
              className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-md text-[11px] cursor-pointer"
            >
              Pick Exact Spot
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          2. FILTER CHIPS & RADIUS BAR (STRICT RADIUS CONTROLS)
          ======================================================== */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Radius Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider text-[11px]">Radius:</span>
          {[
            { label: '1 km', value: 1000 },
            { label: '3 km (Default)', value: 3000 },
            { label: '5 km', value: 5000 },
            { label: 'All (15 km)', value: 15000 }
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

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider text-[11px] mr-1">Type:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'epc', label: 'EPCs' },
            { id: 'dealer', label: 'Dealers' },
            { id: 'installer', label: 'Installers' },
            { id: 'shop', label: 'Shops' }
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

        {/* Search & View Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in results..."
              className="h-8 pl-8 pr-3 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none w-40 sm:w-48"
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
              title="Cards Directory"
            >
              <span className="material-symbols-outlined text-[15px]">view_agenda</span>
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. PRIMARY DATA TABLE (SORTED STRICTLY BY DISTANCE #1 NEAREST)
          ======================================================== */}
      {viewMode === 'table' && (
        <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
          {/* Table Header Strip */}
          <div className="p-3.5 bg-surface-container-low border-b border-surface-container-high flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-on-surface">
                {filteredLeads.length} Solar Businesses within {(radiusMeters / 1000)} km
              </span>
              <span className="text-secondary font-mono">
                • {activeProvider}
              </span>
            </div>
            <div className="text-secondary font-medium">
              Sorted strictly by proximity: <strong>Closest to you (#1) at top</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="bg-surface-container-lowest border-b border-surface-container-high text-secondary uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Business Name</th>
                  <th className="py-3 px-3 min-w-[130px]">Category</th>
                  <th className="py-3 px-3 text-center min-w-[110px]">Proximity</th>
                  <th className="py-3 px-4 min-w-[220px]">Address</th>
                  <th className="py-3 px-3 min-w-[140px]">Phone &amp; Website</th>
                  <th className="py-3 px-4 text-right min-w-[190px]">Direct Action Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-secondary">
                      <div className="space-y-2 max-w-md mx-auto">
                        <span className="material-symbols-outlined text-4xl text-secondary/40">location_off</span>
                        <h4 className="font-bold text-sm text-on-surface">No Solar Businesses Detected in this Circle</h4>
                        <p className="text-xs">
                          Try increasing the search radius to 5 km or click "Check-In Spot" to register the solar company where you are currently standing.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setRadiusMeters(5000)}
                            className="px-3 py-1.5 bg-primary text-on-primary font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                          >
                            Expand to 5 km
                          </button>
                          <button
                            onClick={() => setShowCheckInModal(true)}
                            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-lg text-xs cursor-pointer"
                          >
                            Add This Company
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((item, idx) => {
                    const badgeClass =
                      item.isCustom
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : item.type === 'epc'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : item.type === 'shop'
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : item.type === 'dealer'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                    const cleanPhone = (item.phone || '').replace(/\D/g, '');

                    return (
                      <tr
                        key={item.id || idx}
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

                        {/* 2. Business Name & Rating */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface text-[13px]">
                                {item.name}
                              </span>
                              {item.verified && (
                                <span className="material-symbols-outlined text-[15px] text-primary" title="Verified Solar Business">
                                  verified
                                </span>
                              )}
                              {item.isCustom && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-bold">
                                  Check-In 📍
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-secondary mt-0.5">
                              {item.rating && (
                                <span className="flex items-center text-amber-600 font-bold">
                                  ★ {item.rating}
                                </span>
                              )}
                              {item.reviewsCount > 0 && (
                                <span>({item.reviewsCount} reviews)</span>
                              )}
                              {item.isOpen !== undefined && (
                                <span className={item.isOpen ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                                  • {item.isOpen ? 'Open Now' : 'Closed'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Category */}
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass}`}>
                            {item.category}
                          </span>
                        </td>

                        {/* 4. Distance / Proximity */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                                item.distanceMeters <= 500
                                  ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                                  : item.distanceMeters <= 1500
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
                              <span className="text-secondary text-[11px]">Phone not listed</span>
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

                        {/* 7. Direct Action Links for Reps on the Ground */}
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

                            {/* Navigate */}
                            <a
                              href={
                                item.googleMapsUri ||
                                `https://www.google.com/maps/dir/?api=1&destination=${item.lat || coords.lat},${item.lon || coords.lon}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                              title="Turn-by-Turn GPS Navigation"
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

                            {/* Claim / Convert to Customer Lead File */}
                            <button
                              onClick={() => handleClaimLeadAsFile(item)}
                              className="p-1.5 bg-surface-container-low hover:bg-surface-container border border-surface-container-high rounded-lg text-on-surface transition-colors cursor-pointer"
                              title="Create Customer File from Lead"
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
          4. VIEW: RADAR CONCENTRIC CIRCULAR VIEW
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

                return (
                  <button
                    key={ent.id || idx}
                    onClick={() => setSelectedEntity(ent)}
                    style={{ transform: `translate(${posX}px, ${posY}px)` }}
                    className={`absolute z-30 p-1.5 rounded-full shadow-lg transition-transform hover:scale-125 cursor-pointer ${
                      idx === 0
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
              <span className="text-emerald-400 font-mono">{activeProvider}</span>
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
                    {selectedEntity.distanceMeters} meters away
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
                </div>

                <div className="pt-3 border-t border-surface-container-high space-y-2">
                  <a
                    href={selectedEntity.googleMapsUri || `https://www.google.com/maps/dir/?api=1&destination=${selectedEntity.lat || coords.lat},${selectedEntity.lon || coords.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">directions</span>
                    <span>Navigate (Directions)</span>
                  </a>
                  {selectedEntity.phone && (
                    <a
                      href={`tel:${selectedEntity.phone}`}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      <span>Call Now</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-secondary space-y-2 my-auto">
                <span className="material-symbols-outlined text-4xl text-secondary/40">near_me</span>
                <h4 className="text-sm font-bold text-on-surface">Select Any Radar Entity</h4>
                <p className="text-xs">Click on any dot to inspect contact details and turn-by-turn navigation.</p>
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
              key={item.id || idx}
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
                  href={item.googleMapsUri || `https://www.google.com/maps/dir/?api=1&destination=${item.lat || coords.lat},${item.lon || coords.lon}`}
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
          MODAL: MANUAL PIN / ADJUST SPOT
          ======================================================== */}
      {showManualLocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-surface-container-high shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-on-surface">Pick Exact Spot / Area</h3>
              <button onClick={() => setShowManualLocModal(false)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              If your desktop browser IP location was inaccurate, enter your exact area, road, or landmark name to lock 100% accurate coordinates.
            </p>

            <form onSubmit={handleApplyManualSpot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Area / Street / Colony / Landmark
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prahlad Nagar, SG Highway, Katargam, GIDC Makarpura"
                  value={manualInputQuery}
                  onChange={(e) => setManualInputQuery(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualLocModal(false)}
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

      {/* ========================================================
          MODAL: GCP PLACES API (NEW) KEY CONFIGURATION
          ======================================================== */}
      {showGcpSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 border border-surface-container-high shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                </span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Google Places API (New) Setup</h3>
                  <p className="text-xs text-secondary">Configure Google Cloud Places API Key for live enterprise queries</p>
                </div>
              </div>
              <button onClick={() => setShowGcpSettings(false)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Google Maps / Places API Key (Server or Client Override):
                </label>
                <input
                  type="password"
                  value={gcpKeyInput}
                  onChange={(e) => setGcpKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full h-10 px-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1.5 text-xs text-secondary">
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                  <span>Google Cloud Platform (GCP) Configuration Checklist:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Enable <strong>Places API (New)</strong> in your GCP Console.</li>
                  <li>Enable <strong>Geocoding API</strong> for high-accuracy street lookups.</li>
                  <li>Set environment variable: <code>GOOGLE_PLACES_API_KEY=AIzaSy...</code> in Vercel.</li>
                  <li>Or enter the key above to test instantly in your browser!</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGcpSettings(false)}
                  className="px-3 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGcpKey}
                  className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Save &amp; Scan Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CHECK-IN SPOT / ADD CURRENT COMPANY
          ======================================================== */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 border border-surface-container-high shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-on-surface">Register Company at Live Spot</h3>
              <button onClick={() => setShowCheckInModal(false)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCheckIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Power Solar Partner"
                  value={checkInForm.name}
                  onChange={(e) => setCheckInForm({ ...checkInForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Category</label>
                  <select
                    value={checkInForm.category}
                    onChange={(e) => setCheckInForm({ ...checkInForm, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                  >
                    <option value="Solar EPC Contractor & Installer">Solar EPC Contractor</option>
                    <option value="Solar Inverter & Equipment Shop">Inverter Shop</option>
                    <option value="Authorized Solar Module Distributor">Module Dealer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={checkInForm.phone}
                    onChange={(e) => setCheckInForm({ ...checkInForm, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Address</label>
                <input
                  type="text"
                  value={checkInForm.address}
                  onChange={(e) => setCheckInForm({ ...checkInForm, address: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                />
                <span className="text-[10px] text-secondary">
                  Locked Coordinates: {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)} (0.0 km)
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Save at this Spot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
