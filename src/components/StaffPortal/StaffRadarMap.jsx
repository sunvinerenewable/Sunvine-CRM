import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import {
  GUJARAT_CITIES_COORDS,
  NEARBY_SOLAR_LEADS,
  calculateDistanceKm
} from '../../data/staffData';
import {
  queryN8nSolarRadar,
  REAL_GUJARAT_SOLAR_VENDORS,
  N8N_WORKFLOW_TEMPLATE
} from '../../services/n8nSolarRadarService';

export default function StaffRadarMap() {
  const { currentStaff, addCustomerFile } = useApp();
  const { addToast } = useToast();

  // Location State
  const [selectedCity, setSelectedCity] = useState(currentStaff?.city || 'Ahmedabad');
  const [coords, setCoords] = useState(() => {
    return GUJARAT_CITIES_COORDS[currentStaff?.city || 'Ahmedabad'] || { lat: 23.0225, lon: 72.5714 };
  });
  const [isGpsLive, setIsGpsLive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Radar Filters
  const [radiusKm, setRadiusKm] = useState(25);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'epc', 'shop', 'dealer', 'lead'
  const [searchTerm, setSearchTerm] = useState('');

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);

  // n8n Webhook Settings Modal
  const [showN8nSettings, setShowN8nSettings] = useState(false);
  const [n8nUrl, setN8nUrl] = useState(() => {
    return localStorage.getItem('sunvine_n8n_webhook_url') || 'https://n8n.sunvine.in/webhook/solar-radar-scanner';
  });
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  // View Mode: 'radar' or 'list'
  const [viewMode, setViewMode] = useState('radar');

  // Trigger GPS Geolocation
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setIsGpsLive(true);
        const newCoords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4))
        };
        setCoords(newCoords);
        addToast(`GPS Location Locked: ${newCoords.lat}, ${newCoords.lon}`, 'success');
        // Auto trigger radar scan with new GPS coordinates
        runRadarScan(newCoords.lat, newCoords.lon, selectedCity);
      },
      (err) => {
        setGpsLoading(false);
        setIsGpsLive(false);
        addToast('GPS Access Denied. Using City coordinates instead.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Run AI Agent Radar Scan
  const runRadarScan = async (lat = coords.lat, lon = coords.lon, city = selectedCity) => {
    setIsScanning(true);
    try {
      const res = await queryN8nSolarRadar({
        latitude: lat,
        longitude: lon,
        city: city,
        radiusKm: radiusKm,
        webhookUrl: n8nUrl
      });

      // Also enrich customer solar leads with distance
      const enrichedLeads = NEARBY_SOLAR_LEADS.map((lead) => ({
        ...lead,
        type: 'lead',
        category: 'Customer Solar Lead (ग्राहक)',
        distanceKm: calculateDistanceKm(lat, lon, lead.lat, lead.lon)
      })).filter((l) => (radiusKm ? l.distanceKm <= radiusKm || l.city.toLowerCase() === city.toLowerCase() : true));

      const combined = [...res.vendors, ...enrichedLeads].sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

      setScanResult({
        provider: res.provider,
        entities: combined,
        scannedAt: new Date().toLocaleTimeString()
      });
      setIsScanning(false);
      addToast(`AI Agent found ${combined.length} nearby solar entities!`, 'success');
    } catch (e) {
      setIsScanning(false);
      addToast('Error running AI Radar scanner', 'error');
    }
  };

  // Initial Scan on load
  useEffect(() => {
    runRadarScan(coords.lat, coords.lon, selectedCity);
  }, [selectedCity, radiusKm]);

  // Handle City Change
  const handleCityChange = (cityName) => {
    setSelectedCity(cityName);
    setIsGpsLive(false);
    const c = GUJARAT_CITIES_COORDS[cityName] || { lat: 23.0225, lon: 72.5714 };
    setCoords(c);
  };

  // Save n8n URL
  const handleSaveN8nUrl = () => {
    localStorage.setItem('sunvine_n8n_webhook_url', n8nUrl.trim());
    setShowN8nSettings(false);
    addToast('n8n Webhook Endpoint Saved!', 'success');
    runRadarScan();
  };

  const handleCopyWorkflowJson = () => {
    navigator.clipboard.writeText(JSON.stringify(N8N_WORKFLOW_TEMPLATE, null, 2));
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2500);
    addToast('n8n Workflow JSON copied to clipboard!', 'success');
  };

  // Convert Nearby Lead to Customer File
  const handleClaimLeadAsFile = (lead) => {
    const newFile = {
      id: `FIL-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: lead.name,
      phone: lead.phone,
      address: lead.address,
      city: lead.city,
      discom: lead.discom || 'UGVCL',
      consumerNo: '',
      sanctionedLoadKw: lead.requiredKw || 5.0,
      solarSystemKw: lead.requiredKw || 3.3,
      roofType: lead.type || 'RCC Flat Roof',
      staffId: currentStaff?.id || 'STF-001',
      staffName: currentStaff?.name || 'Jayesh Patel',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      applicationNo: 'Draft Pending',
      notes: `Claimed via AI Radar (${lead.distanceKm} km from sales rep). Urgency: ${lead.urgency || 'Normal'}`,
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };
    addCustomerFile(newFile);
    addToast(`Lead "${lead.name}" added to your customer files!`, 'success');
  };

  // Filter entities
  const allEntities = scanResult?.entities || [];
  const filteredEntities = allEntities.filter((item) => {
    const matchCat =
      activeCategory === 'all'
        ? true
        : activeCategory === 'lead'
        ? item.type === 'lead'
        : activeCategory === 'epc'
        ? item.type === 'epc'
        : activeCategory === 'shop'
        ? item.type === 'shop' || item.type === 'hardware'
        : item.type === activeCategory;

    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.address || '').toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term) ||
      (item.speciality || '').toLowerCase().includes(term);

    return matchCat && matchTerm;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-on-surface">
      {/* Top Banner & Location Controls */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0D1527] border border-white/15 p-5 sm:p-7 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <span className="material-symbols-outlined text-[20px]">radar</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                AI Solar Radar &amp; Nearby Leads (n8n + AI Agent Pipeline)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Automatic intelligence agent searching Google Places, OpenStreetMap &amp; Solar Networks around your location. Discovers solar EPCs, equipment shops, inverters dealers, and rooftop leads in real-time.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => runRadarScan()}
              disabled={isScanning}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isScanning ? 'animate-spin' : ''}`}>
                {isScanning ? 'refresh' : 'satellite_alt'}
              </span>
              <span>{isScanning ? 'Scanning Radius...' : 'Trigger AI Radar Scan'}</span>
            </button>

            <button
              onClick={() => setShowN8nSettings(true)}
              className="p-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configure n8n Webhook & AI Pipeline"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-400">tune</span>
              <span>n8n Pipeline</span>
            </button>
          </div>
        </div>

        {/* Location & GPS Ribbon */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Live GPS Button */}
            <button
              onClick={handleDetectGps}
              disabled={gpsLoading}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                isGpsLive
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${gpsLoading ? 'animate-spin' : isGpsLive ? 'text-emerald-400' : 'text-slate-400'}`}>
                {gpsLoading ? 'sync' : 'my_location'}
              </span>
              <span>{isGpsLive ? 'Live GPS Active' : 'Use My Live GPS (लाइव लोकेशन)'}</span>
            </button>

            {/* City Selector */}
            <div className="flex items-center gap-1.5 bg-[#070D18] px-3 py-1 rounded-lg border border-white/15">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">location_city</span>
              <span className="text-slate-400">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                {Object.keys(GUJARAT_CITIES_COORDS).map((c) => (
                  <option key={c} value={c} className="bg-[#0D1527] text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Radius Selector */}
            <div className="flex items-center gap-1.5 bg-[#070D18] px-3 py-1 rounded-lg border border-white/15">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">adjust</span>
              <span className="text-slate-400">Radius:</span>
              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value={5} className="bg-[#0D1527] text-white">5 km</option>
                <option value={15} className="bg-[#0D1527] text-white">15 km</option>
                <option value={25} className="bg-[#0D1527] text-white">25 km (Standard)</option>
                <option value={50} className="bg-[#0D1527] text-white">50 km (Zone)</option>
              </select>
            </div>
          </div>

          {/* Coordinates readout */}
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>LAT: <strong>{coords.lat}</strong></span>
            <span>LON: <strong>{coords.lon}</strong></span>
            <span className="text-emerald-400 ml-1">● Synced</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-xl border border-surface-container-high shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All Entities', icon: 'grid_view' },
            { key: 'epc', label: 'Solar EPCs & Installers', icon: 'engineering' },
            { key: 'shop', label: 'Inverter & Cable Shops', icon: 'store' },
            { key: 'dealer', label: 'Panel Distributors', icon: 'solar_power' },
            { key: 'lead', label: 'Hot Customer Leads', icon: 'person_search' }
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                activeCategory === cat.key
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-secondary hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* View Toggle & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-secondary">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entity, shop, area..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary outline-none"
            />
          </div>

          <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-surface-container-high">
            <button
              onClick={() => setViewMode('radar')}
              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'radar' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Interactive Radar View"
            >
              <span className="material-symbols-outlined text-[17px]">radar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Card Directory View"
            >
              <span className="material-symbols-outlined text-[17px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* RADAR VISUALIZER VIEW */}
      {viewMode === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Circular Interactive Radar Screen */}
          <div className="lg:col-span-2 relative bg-[#070D18] border border-white/15 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[460px] overflow-hidden shadow-2xl">
            {/* Radar Circular Grid (Concentric Circles) */}
            <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
              {/* Outer circle (Max Radius) */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/20"></div>
              {/* 2/3 circle */}
              <div className="absolute inset-8 sm:inset-10 rounded-full border border-emerald-500/20"></div>
              {/* 1/3 circle */}
              <div className="absolute inset-20 sm:inset-24 rounded-full border border-emerald-500/25"></div>
              {/* Inner core */}
              <div className="absolute inset-32 sm:inset-38 rounded-full border border-emerald-500/30"></div>

              {/* Crosshair axes */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-500/20"></div>
              <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500/20"></div>

              {/* Animated Radar Sweep */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 via-transparent to-transparent animate-spin duration-7000 pointer-events-none origin-center"></div>

              {/* CENTER: Salesperson Location */}
              <div className="absolute z-20 flex flex-col items-center justify-center pointer-events-none">
                <div className="relative">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 text-[10px] font-bold shadow-lg shadow-emerald-400/50">
                    <span className="material-symbols-outlined text-[14px]">person_pin_circle</span>
                  </span>
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping"></span>
                </div>
                <span className="text-[10px] font-bold text-emerald-300 mt-1 bg-black/70 px-1.5 py-0.5 rounded">
                  You ({selectedCity})
                </span>
              </div>

              {/* Mapped Entity Dots */}
              {filteredEntities.map((ent, idx) => {
                // Calculate position relative to center
                const maxR = radiusKm || 25;
                const distRatio = Math.min(0.95, (ent.distanceKm || 5) / maxR);
                // Spread points in an angle based on coordinates delta
                const dLat = (ent.lat - coords.lat) * 111;
                const dLon = (ent.lon - coords.lon) * 102;
                const angle = Math.atan2(dLat, dLon);

                const centerOffset = (360 / 2) * distRatio;
                const posX = Math.cos(angle) * centerOffset;
                const posY = -Math.sin(angle) * centerOffset;

                const colorClass =
                  ent.type === 'epc'
                    ? 'bg-blue-500 border-blue-300 text-white'
                    : ent.type === 'shop' || ent.type === 'hardware'
                    ? 'bg-emerald-500 border-emerald-300 text-white'
                    : ent.type === 'dealer'
                    ? 'bg-purple-500 border-purple-300 text-white'
                    : 'bg-amber-500 border-amber-300 text-slate-950';

                const isSelected = selectedEntity?.id === ent.id;

                return (
                  <button
                    key={ent.id || idx}
                    type="button"
                    onClick={() => setSelectedEntity(ent)}
                    style={{
                      transform: `translate(${posX}px, ${posY}px)`
                    }}
                    className={`absolute z-30 p-1.5 rounded-full border shadow-lg transition-transform hover:scale-125 cursor-pointer ${colorClass} ${
                      isSelected ? 'ring-4 ring-white scale-125' : ''
                    }`}
                    title={`${ent.name} (${ent.distanceKm} km)`}
                  >
                    <span className="material-symbols-outlined text-[14px] block">
                      {ent.type === 'epc'
                        ? 'engineering'
                        : ent.type === 'shop' || ent.type === 'hardware'
                        ? 'store'
                        : ent.type === 'dealer'
                        ? 'solar_power'
                        : 'person'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Radar Legend & Status Footer */}
            <div className="w-full mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Solar EPC</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Equipment / Inverter Shop</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <span>Panel Distributor</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Customer Lead</span>
                </span>
              </div>
              <span className="text-emerald-400 font-mono">
                {scanResult?.provider || 'AI Radar Active'}
              </span>
            </div>
          </div>

          {/* Inspector Panel for Selected Entity */}
          <div className="bg-surface rounded-2xl p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
            {selectedEntity ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-surface-container-high pb-3">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {selectedEntity.category || 'Solar Business'}
                    </span>
                    <h3 className="text-base font-bold text-on-surface mt-1">
                      {selectedEntity.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-emerald-600 font-mono">
                      {selectedEntity.distanceKm} km
                    </span>
                    <span className="block text-[10px] text-secondary">from you</span>
                  </div>
                </div>

                {/* Entity Details */}
                <div className="space-y-2.5 text-xs text-secondary">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">location_on</span>
                    <span className="text-on-surface">{selectedEntity.address}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">call</span>
                    <a href={`tel:${selectedEntity.phone}`} className="text-primary font-bold hover:underline">
                      {selectedEntity.phone}
                    </a>
                  </div>

                  {selectedEntity.email && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">mail</span>
                      <a href={`mailto:${selectedEntity.email}`} className="text-secondary hover:text-on-surface truncate">
                        {selectedEntity.email}
                      </a>
                    </div>
                  )}

                  {selectedEntity.speciality && (
                    <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-[11px] text-on-surface">
                      <strong className="text-secondary block text-[10px] uppercase">Speciality &amp; Products:</strong>
                      {selectedEntity.speciality}
                    </div>
                  )}

                  {selectedEntity.openingHours && (
                    <div className="text-[11px] text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      <span>Hours: {selectedEntity.openingHours}</span>
                    </div>
                  )}

                  {selectedEntity.requiredKw && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      <strong>Customer Solar Enquiry:</strong> Requires ~{selectedEntity.requiredKw} kW Rooftop Solar.
                      <div className="font-semibold mt-0.5">Estimated Subsidy: {selectedEntity.estimatedSubsidy}</div>
                    </div>
                  )}
                </div>

                {/* Interactive Action Hub */}
                <div className="space-y-2 pt-3 border-t border-surface-container-high">
                  {/* Google Maps Turn-By-Turn Navigation Link */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEntity.lat},${selectedEntity.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">navigation</span>
                    <span>Navigate in Google Maps (दिशा-निर्देश)</span>
                  </a>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${selectedEntity.phone}`}
                      className="py-2 px-3 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                      <span>Call Now</span>
                    </a>

                    <a
                      href={`https://wa.me/${selectedEntity.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(selectedEntity.name)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Representative')}%20from%20Sunvine%20Renewable%20regarding%20solar%20collaboration.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                      <span>WhatsApp</span>
                    </a>
                  </div>

                  {selectedEntity.type === 'lead' && (
                    <button
                      onClick={() => handleClaimLeadAsFile(selectedEntity)}
                      className="w-full py-2.5 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      <span>Add to My Customer Files (फाइल बनाएं)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-secondary space-y-2 my-auto">
                <span className="material-symbols-outlined text-4xl text-secondary/40">touch_app</span>
                <h4 className="text-sm font-bold text-on-surface">Click on Any Radar Dot</h4>
                <p className="text-xs">
                  Select any vendor, EPC contractor, or customer lead on the radar to inspect full contact info, address, and Google Maps directions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CARD DIRECTORY LIST VIEW */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((ent, idx) => {
            const badgeColor =
              ent.type === 'epc'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : ent.type === 'shop' || ent.type === 'hardware'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : ent.type === 'dealer'
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : 'bg-amber-100 text-amber-800 border-amber-200';

            return (
              <div
                key={ent.id || idx}
                className="bg-surface rounded-xl p-5 border border-surface-container-high shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeColor}`}>
                      {ent.category}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      {ent.distanceKm} km away
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-on-surface mt-2">{ent.name}</h3>

                  <div className="mt-3 space-y-1.5 text-xs text-secondary">
                    <div className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">location_on</span>
                      <span className="text-on-surface line-clamp-2">{ent.address}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary shrink-0">call</span>
                      <a href={`tel:${ent.phone}`} className="text-on-surface font-semibold hover:underline">
                        {ent.phone}
                      </a>
                    </div>

                    {ent.speciality && (
                      <p className="text-[11px] text-secondary line-clamp-2 mt-1">
                        <strong>Products:</strong> {ent.speciality}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-container-high flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${ent.phone}`}
                      className="flex-1 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold rounded-lg flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">call</span>
                      <span>Call</span>
                    </a>

                    <a
                      href={`https://wa.me/${ent.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(ent.name)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Representative')}%20from%20Sunvine%20Renewable.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-lg text-xs"
                      title="WhatsApp"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                    </a>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${ent.lat},${ent.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 rounded-lg text-xs"
                      title="Google Maps Directions"
                    >
                      <span className="material-symbols-outlined text-[18px]">navigation</span>
                    </a>
                  </div>

                  {ent.type === 'lead' && (
                    <button
                      onClick={() => handleClaimLeadAsFile(ent)}
                      className="w-full py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">person_add</span>
                      <span>Claim Lead</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* n8n PIPELINE SETTINGS MODAL */}
      {showN8nSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-container-high pb-3">
              <div>
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">hub</span>
                  <span>n8n Webhook &amp; AI Agent Pipeline Config</span>
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Connect your self-hosted or cloud n8n instance to trigger Google Places &amp; Gemini AI scraping workflows.
                </p>
              </div>
              <button onClick={() => setShowN8nSettings(false)} className="text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  n8n Webhook Endpoint URL (वेबहूक URL)
                </label>
                <input
                  type="url"
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                  placeholder="https://n8n.yourdomain.com/webhook/solar-radar-scanner"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary outline-none"
                />
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl text-xs space-y-2">
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">integration_instructions</span>
                  <span>Ready-To-Import n8n Workflow JSON:</span>
                </div>
                <p className="text-[11px] text-secondary">
                  Contains Webhook trigger, Overpass / Places query node, and LangChain Gemini AI agent node to enrich phone, email, and address.
                </p>
                <button
                  type="button"
                  onClick={handleCopyWorkflowJson}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedWorkflow ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedWorkflow ? 'Copied to Clipboard!' : 'Copy Workflow JSON Template'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setShowN8nSettings(false)}
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveN8nUrl}
                className="px-5 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                Save &amp; Connect Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
