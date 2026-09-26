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
  N8N_WORKFLOW_TEMPLATE,
  saveCustomSolarVendor,
  getCustomSolarVendors,
  reverseGeocodeCoordinates
} from '../../services/n8nSolarRadarService';

export default function StaffRadarMap() {
  const { currentStaff, addCustomerFile } = useApp();
  const { addToast } = useToast();

  // Location State
  const [selectedCity, setSelectedCity] = useState(currentStaff?.city || 'Ahmedabad');
  const [coords, setCoords] = useState(() => {
    return GUJARAT_CITIES_COORDS[currentStaff?.city || 'Ahmedabad'] || { lat: 23.0225, lon: 72.5714 };
  });
  const [detectedAddress, setDetectedAddress] = useState('Ahmedabad, Gujarat');
  const [isGpsLive, setIsGpsLive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Radar Filters
  const [radiusKm, setRadiusKm] = useState(25);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'epc', 'shop', 'dealer', 'lead', 'custom'
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

  // View Mode: 'table' (default) | 'radar' | 'cards'
  const [viewMode, setViewMode] = useState('table');

  // Register Current Company Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    category: 'Solar EPC Contractor & Installer',
    type: 'epc',
    phone: '',
    email: '',
    contactPerson: '',
    address: '',
    city: currentStaff?.city || 'Ahmedabad',
    speciality: 'Rooftop Solar EPC & PM Surya Ghar Partner'
  });

  // Fetch Reverse Geocoded Address
  const updateAddressForCoords = async (lat, lon) => {
    const geo = await reverseGeocodeCoordinates(lat, lon);
    if (geo.success) {
      setDetectedAddress(geo.displayName);
      if (geo.city && GUJARAT_CITIES_COORDS[geo.city]) {
        setSelectedCity(geo.city);
      }
    }
  };

  // Trigger GPS Geolocation
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsLoading(false);
        setIsGpsLive(true);
        const newCoords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lon: Number(pos.coords.longitude.toFixed(4))
        };
        setCoords(newCoords);
        addToast(`GPS Locked: ${newCoords.lat}, ${newCoords.lon}`, 'success');
        
        await updateAddressForCoords(newCoords.lat, newCoords.lon);
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

      // Enrich customer solar leads with exact distance
      const enrichedLeads = NEARBY_SOLAR_LEADS.map((lead) => ({
        ...lead,
        type: 'lead',
        category: 'Customer Solar Lead (ग्राहक)',
        distanceKm: Number(calculateDistanceKm(lat, lon, lead.lat, lead.lon).toFixed(1))
      })).filter((l) => (radiusKm ? l.distanceKm <= radiusKm || (l.city && l.city.toLowerCase() === city.toLowerCase()) : true));

      const combined = [...res.vendors, ...enrichedLeads].sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

      setScanResult({
        provider: res.provider,
        entities: combined,
        scannedAt: new Date().toLocaleTimeString()
      });
      setIsScanning(false);
      addToast(`Solar Directory: ${combined.length} solar companies & leads located!`, 'success');
    } catch (e) {
      setIsScanning(false);
      addToast('Error running solar radar scanner', 'error');
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
    setDetectedAddress(`${cityName}, Gujarat`);
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

  // Handle Register Current Solar Company
  const handleOpenRegisterModal = () => {
    setNewCompanyForm({
      name: '',
      category: 'Solar EPC Contractor & Installer',
      type: 'epc',
      phone: '',
      email: '',
      contactPerson: '',
      address: detectedAddress || `${coords.lat}, ${coords.lon}`,
      city: selectedCity,
      speciality: 'Rooftop Solar EPC & PM Surya Ghar Partner'
    });
    setShowRegisterModal(true);
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    if (!newCompanyForm.name.trim()) {
      addToast('Please enter company name', 'error');
      return;
    }
    const newVendor = saveCustomSolarVendor({
      name: newCompanyForm.name.trim(),
      category: newCompanyForm.category,
      type: newCompanyForm.type,
      phone: newCompanyForm.phone || '+91 98000 00000',
      email: newCompanyForm.email || 'info@solarcompany.in',
      contactPerson: newCompanyForm.contactPerson,
      address: newCompanyForm.address || detectedAddress,
      city: newCompanyForm.city || selectedCity,
      lat: coords.lat,
      lon: coords.lon,
      distanceKm: 0.0,
      speciality: newCompanyForm.speciality,
      registeredByStaff: currentStaff?.name || 'Sales Rep',
      rating: 5.0,
      reviewsCount: 1
    });

    if (newVendor) {
      setShowRegisterModal(false);
      addToast(`Company "${newVendor.name}" successfully registered at your location!`, 'success');
      runRadarScan(coords.lat, coords.lon, selectedCity);
    }
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
      notes: `Claimed via AI Radar (${lead.distanceKm} km from rep). Urgency: ${lead.urgency || 'Normal'}`,
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

  // Export Table Data to CSV
  const handleExportCSV = () => {
    if (!filteredEntities || filteredEntities.length === 0) {
      addToast('No data available to export', 'info');
      return;
    }
    const headers = ['Name', 'Category', 'Distance (km)', 'City', 'Phone', 'Email', 'Address', 'Speciality', 'Latitude', 'Longitude'];
    const rows = filteredEntities.map(item => [
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      item.distanceKm || 0,
      `"${(item.city || '').replace(/"/g, '""')}"`,
      `"${(item.phone || '').replace(/"/g, '""')}"`,
      `"${(item.email || '').replace(/"/g, '""')}"`,
      `"${(item.address || '').replace(/"/g, '""')}"`,
      `"${(item.speciality || '').replace(/"/g, '""')}"`,
      item.lat || coords.lat,
      item.lon || coords.lon
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sunvine_solar_radar_${selectedCity}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Solar Data Table downloaded as CSV!', 'success');
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
        : activeCategory === 'dealer'
        ? item.type === 'dealer'
        : activeCategory === 'custom'
        ? item.isCustom
        : item.type === activeCategory;

    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      (item.address || '').toLowerCase().includes(term) ||
      (item.city || '').toLowerCase().includes(term) ||
      (item.phone || '').toLowerCase().includes(term) ||
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
                <span className="material-symbols-outlined text-[22px]">radar</span>
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                AI Solar Radar &amp; Nearby Directory (n8n + AI Agent Pipeline)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time intelligence discovering Solar EPC contractors, inverter equipment shops, DCR module dealers, and rooftop leads around your exact live location.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Register Current Company Button */}
            <button
              onClick={handleOpenRegisterModal}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              title="Add the solar company or shop where you are currently standing"
            >
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              <span>Add Current Company (यहाँ कंपनी जोड़ें)</span>
            </button>

            {/* Refresh / Scan */}
            <button
              onClick={() => runRadarScan()}
              disabled={isScanning}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isScanning ? 'animate-spin' : ''}`}>
                {isScanning ? 'refresh' : 'satellite_alt'}
              </span>
              <span>{isScanning ? 'Scanning...' : 'Scan Radius'}</span>
            </button>

            {/* n8n Settings */}
            <button
              onClick={() => setShowN8nSettings(true)}
              className="p-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configure n8n Webhook & AI Pipeline"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-400">tune</span>
              <span>n8n</span>
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
              <span className={`material-symbols-outlined text-[16px] text-emerald-400 ${gpsLoading ? 'animate-spin' : ''}`}>
                {gpsLoading ? 'sync' : isGpsLive ? 'my_location' : 'location_searching'}
              </span>
              <span>{gpsLoading ? 'Acquiring GPS...' : isGpsLive ? 'GPS Locked (Live)' : 'Detect My Live Location'}</span>
            </button>

            {/* City Selector */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1">
              <span className="text-slate-400 font-medium">City:</span>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
              >
                {Object.keys(GUJARAT_CITIES_COORDS).map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Address Display */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-slate-300">
              <span className="material-symbols-outlined text-[15px] text-emerald-400">pin_drop</span>
              <span className="font-medium truncate max-w-[280px] sm:max-w-md" title={detectedAddress}>
                {detectedAddress}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({coords.lat}, {coords.lon})
              </span>
            </div>
          </div>

          {/* Direct Google Maps Live Search Link */}
          <a
            href={`https://www.google.com/maps/search/solar+companies/@${coords.lat},${coords.lon},14z`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-300 font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] text-blue-400">travel_explore</span>
            <span>Search Live on Google Maps</span>
          </a>
        </div>
      </div>

      {/* Filter Toolbar & View Selector */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Companies & Leads', icon: 'grid_view' },
            { id: 'epc', label: 'Solar EPCs', icon: 'engineering' },
            { id: 'shop', label: 'Equipment & Inverters', icon: 'store' },
            { id: 'dealer', label: 'Panel Dealers', icon: 'solar_power' },
            { id: 'lead', label: 'Customer Leads', icon: 'person' },
            { id: 'custom', label: '📍 Registered by Staff', icon: 'add_location' }
          ].map((cat) => {
            const count = allEntities.filter(e => {
              if (cat.id === 'all') return true;
              if (cat.id === 'lead') return e.type === 'lead';
              if (cat.id === 'epc') return e.type === 'epc';
              if (cat.id === 'shop') return e.type === 'shop' || e.type === 'hardware';
              if (cat.id === 'dealer') return e.type === 'dealer';
              if (cat.id === 'custom') return e.isCustom;
              return false;
            }).length;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeCategory === cat.id ? 'bg-white/25 text-white' : 'bg-surface-container-high text-secondary'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Switcher & Radius */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Radius selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-secondary font-semibold">Radius:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-surface-container-low border border-surface-container-high text-on-surface rounded-lg px-2 py-1 font-bold outline-none cursor-pointer"
            >
              <option value="5">5 km</option>
              <option value="15">15 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
              <option value="0">All Distances</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary material-symbols-outlined text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, address, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-surface-container-low border border-surface-container-high rounded-xl text-xs text-on-surface placeholder:text-secondary outline-none focus:ring-1 focus:ring-primary w-48 sm:w-60"
            />
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className="p-1.5 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-semibold text-secondary hover:text-on-surface flex items-center gap-1 cursor-pointer transition-colors"
            title="Download table data as CSV"
          >
            <span className="material-symbols-outlined text-[16px] text-emerald-600">download</span>
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-surface-container-low rounded-xl border border-surface-container-high">
            <button
              onClick={() => setViewMode('table')}
              className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Full Data Table View"
            >
              <span className="material-symbols-outlined text-[16px]">table_chart</span>
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('radar')}
              className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'radar' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Radar Visualizer View"
            >
              <span className="material-symbols-outlined text-[16px]">radar</span>
              <span>Radar</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-primary text-on-primary shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
              title="Card Grid View"
            >
              <span className="material-symbols-outlined text-[16px]">view_agenda</span>
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          VIEW 1: COMPLETE DATA TABLE (PRIMARY STRUCTURED VIEW)
          ======================================================== */}
      {viewMode === 'table' && (
        <div className="bg-surface rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 bg-surface-container-low border-b border-surface-container-high flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">
                Solar Network &amp; Leads Directory ({filteredEntities.length} Results)
              </span>
              <span className="text-xs text-secondary">
                • Sorted nearest to you first
              </span>
            </div>
            <div className="text-xs text-secondary flex items-center gap-2">
              <span>Center: <strong>{detectedAddress}</strong></span>
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface">
              <thead className="bg-surface-container-lowest border-b border-surface-container-high text-secondary uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Company / Customer</th>
                  <th className="py-3 px-4 min-w-[150px]">Category &amp; Speciality</th>
                  <th className="py-3 px-4 min-w-[100px] text-center">Distance</th>
                  <th className="py-3 px-4 min-w-[220px]">Address &amp; City</th>
                  <th className="py-3 px-4 min-w-[140px]">Contact Info</th>
                  <th className="py-3 px-4 min-w-[200px] text-right">Direct Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredEntities.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-secondary">
                      <div className="space-y-2">
                        <span className="material-symbols-outlined text-4xl text-secondary/40">search_off</span>
                        <p className="text-sm font-semibold text-on-surface">No solar entities found in this range.</p>
                        <p className="text-xs">Try increasing the radius to 50 km or click "Add Current Company" to register your current location.</p>
                        <button
                          onClick={handleOpenRegisterModal}
                          className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">add_location_alt</span>
                          <span>Add My Current Solar Company</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntities.map((ent, idx) => {
                    const badgeClass =
                      ent.isCustom
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : ent.type === 'epc'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : ent.type === 'shop' || ent.type === 'hardware'
                        ? 'bg-teal-100 text-teal-800 border-teal-200'
                        : ent.type === 'dealer'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200';

                    const cleanPhone = (ent.phone || '').replace(/\D/g, '');

                    return (
                      <tr
                        key={ent.id || idx}
                        className={`hover:bg-surface-container-low transition-colors ${
                          ent.isCustom ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3 px-4 text-center font-mono text-secondary text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Name & Badge */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface text-[13px]">
                                {ent.name}
                              </span>
                              {ent.verified && (
                                <span className="material-symbols-outlined text-[15px] text-primary" title="Verified Solar Partner">
                                  verified
                                </span>
                              )}
                              {ent.isCustom && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-bold">
                                  Staff Check-In 📍
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-secondary">
                              {ent.rating && (
                                <span className="flex items-center text-amber-600 font-bold">
                                  ★ {ent.rating}
                                </span>
                              )}
                              {ent.contactPerson && (
                                <span>• Contact: {ent.contactPerson}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category & Speciality */}
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeClass} mb-1`}>
                            {ent.category}
                          </span>
                          <p className="text-[11px] text-secondary line-clamp-1" title={ent.speciality}>
                            {ent.speciality || 'Solar Solutions'}
                          </p>
                        </td>

                        {/* Distance */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                              ent.distanceKm <= 5
                                ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                : ent.distanceKm <= 20
                                ? 'bg-teal-50 text-teal-800'
                                : 'bg-surface-container text-secondary'
                            }`}
                          >
                            {ent.distanceKm === 0 ? '0.0 km (Here)' : `${ent.distanceKm} km`}
                          </span>
                        </td>

                        {/* Address & City */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-on-surface font-medium line-clamp-2" title={ent.address}>
                              {ent.address}
                            </span>
                            <span className="text-secondary text-[11px] font-semibold mt-0.5">
                              {ent.city}
                            </span>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`tel:${ent.phone}`}
                              className="text-primary font-bold hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[13px]">phone</span>
                              <span>{ent.phone}</span>
                            </a>
                            {ent.email && (
                              <span className="text-secondary text-[11px] truncate max-w-[140px]" title={ent.email}>
                                {ent.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Direct Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Call */}
                            <a
                              href={`tel:${ent.phone}`}
                              className="p-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg text-on-surface border border-surface-container-high transition-colors"
                              title="Call Now"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                            </a>

                            {/* WhatsApp */}
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(ent.name)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Sales Rep')}%20from%20Sunvine%20Renewable%20regarding%20solar%20collaboration.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-emerald-700 border border-emerald-500/30 transition-colors"
                                title="Chat on WhatsApp"
                              >
                                <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                              </a>
                            )}

                            {/* Google Maps Turn-by-Turn */}
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${ent.lat || coords.lat},${ent.lon || coords.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-700 border border-blue-500/30 transition-colors"
                              title="Google Maps Navigation Directions"
                            >
                              <span className="material-symbols-outlined text-[16px] text-blue-600">directions</span>
                            </a>

                            {/* Search Business on Google */}
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ent.name} ${ent.city} solar`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-surface-container-low hover:bg-surface-container rounded-lg text-secondary border border-surface-container-high transition-colors"
                              title="Search on Google Maps"
                            >
                              <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                            </a>

                            {/* Claim Lead Button */}
                            {ent.type === 'lead' && (
                              <button
                                onClick={() => handleClaimLeadAsFile(ent)}
                                className="px-2.5 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                                title="Add to My Customer Files"
                              >
                                <span className="material-symbols-outlined text-[14px]">person_add</span>
                                <span>Create File</span>
                              </button>
                            )}
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
          VIEW 2: CIRCULAR RADAR MAP VISUALIZER
          ======================================================== */}
      {viewMode === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Circular Interactive Radar Screen */}
          <div className="lg:col-span-2 relative bg-[#070D18] border border-white/15 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[460px] overflow-hidden shadow-2xl">
            {/* Radar Circular Grid */}
            <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
              {/* Concentric rings */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/20"></div>
              <div className="absolute inset-8 sm:inset-10 rounded-full border border-emerald-500/20"></div>
              <div className="absolute inset-20 sm:inset-24 rounded-full border border-emerald-500/25"></div>
              <div className="absolute inset-32 sm:inset-38 rounded-full border border-emerald-500/30"></div>

              {/* Crosshairs */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-500/20"></div>
              <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500/20"></div>

              {/* Animated Sweep */}
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
                const maxR = radiusKm || 25;
                const distRatio = Math.min(0.95, (ent.distanceKm || 2) / maxR);
                const dLat = (ent.lat - coords.lat) * 111;
                const dLon = (ent.lon - coords.lon) * 102;
                const angle = Math.atan2(dLat, dLon);

                const centerOffset = (360 / 2) * distRatio;
                const posX = Math.cos(angle) * centerOffset;
                const posY = -Math.sin(angle) * centerOffset;

                const colorClass =
                  ent.isCustom
                    ? 'bg-rose-500 border-rose-300 text-white'
                    : ent.type === 'epc'
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
                      {ent.isCustom
                        ? 'add_location'
                        : ent.type === 'epc'
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

            {/* Radar Legend */}
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
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span>My Check-In</span>
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
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                      selectedEntity.type === 'epc'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : selectedEntity.type === 'shop' || selectedEntity.type === 'hardware'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : selectedEntity.type === 'dealer'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {selectedEntity.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {selectedEntity.distanceKm} km away
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-on-surface">{selectedEntity.name}</h3>
                  {selectedEntity.speciality && (
                    <p className="text-xs text-secondary mt-0.5">{selectedEntity.speciality}</p>
                  )}
                </div>

                <div className="space-y-2 text-xs text-secondary pt-2 border-t border-surface-container-high">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">location_on</span>
                    <span className="text-on-surface">{selectedEntity.address}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">call</span>
                    <a href={`tel:${selectedEntity.phone}`} className="text-on-surface font-semibold hover:underline">
                      {selectedEntity.phone}
                    </a>
                  </div>

                  {selectedEntity.email && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-primary shrink-0">mail</span>
                      <a href={`mailto:${selectedEntity.email}`} className="text-secondary hover:underline">
                        {selectedEntity.email}
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-surface-container-high space-y-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEntity.lat || coords.lat},${selectedEntity.lon || coords.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-[17px]">directions</span>
                    <span>Start Google Maps Navigation</span>
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

      {/* ========================================================
          VIEW 3: CARDS DIRECTORY VIEW
          ======================================================== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((ent, idx) => {
            const badgeColor =
              ent.isCustom
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : ent.type === 'epc'
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

                  <h3 className="text-base font-bold text-on-surface mt-2 flex items-center gap-1.5">
                    <span>{ent.name}</span>
                    {ent.isCustom && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px] font-bold">
                        Staff 📍
                      </span>
                    )}
                  </h3>

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
                      <div className="p-2 rounded-lg bg-surface-container-low text-[11px] text-secondary mt-2">
                        {ent.speciality}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-surface-container-high flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <a
                      href={`tel:${ent.phone}`}
                      className="py-1.5 px-2 bg-surface-container-low hover:bg-surface-container rounded-lg text-xs font-bold text-center text-on-surface border border-surface-container-high"
                    >
                      Call
                    </a>
                    <a
                      href={`https://wa.me/${ent.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(ent.name)},%20I%20am%20from%20Sunvine%20Renewable.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-lg text-xs font-bold text-center border border-emerald-500/30"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${ent.lat || coords.lat},${ent.lon || coords.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 rounded-lg text-xs font-bold text-center border border-blue-500/30"
                    >
                      Map
                    </a>
                  </div>

                  {ent.type === 'lead' && (
                    <button
                      onClick={() => handleClaimLeadAsFile(ent)}
                      className="w-full py-2 bg-primary text-on-primary rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">person_add</span>
                      <span>Convert to Customer File</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          MODAL: REGISTER CURRENT SOLAR COMPANY (STAFF CHECK-IN)
          ======================================================== */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 border border-surface-container-high shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700">
                  <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
                </span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Add Current Solar Company</h3>
                  <p className="text-xs text-secondary">
                    Register the company/shop you are currently visiting at your live GPS pin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Company / Shop Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Green Solar Energy Solutions"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Category
                  </label>
                  <select
                    value={newCompanyForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      let type = 'epc';
                      if (cat.includes('Shop') || cat.includes('Hardware')) type = 'shop';
                      if (cat.includes('Distributor') || cat.includes('Dealer')) type = 'dealer';
                      setNewCompanyForm({ ...newCompanyForm, category: cat, type });
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none cursor-pointer"
                  >
                    <option value="Solar EPC Contractor & Installer">Solar EPC Contractor</option>
                    <option value="Solar Inverter & Battery Shop">Inverter & Battery Shop</option>
                    <option value="Authorized Solar Module Distributor">Module Distributor</option>
                    <option value="Mounting Structure & GI Hardware">Mounting Structure & Hardware</option>
                    <option value="Electrical Contractor & Equipment">Electrical Contractor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newCompanyForm.city}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, city: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newCompanyForm.phone}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="Owner / Manager Name"
                    value={newCompanyForm.contactPerson}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, contactPerson: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Address (Auto-populated with your live GPS location)
                </label>
                <textarea
                  rows="2"
                  value={newCompanyForm.address}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                />
                <span className="text-[10px] text-secondary">
                  Coordinates: {coords.lat}, {coords.lon} (Distance: 0.0 km)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Speciality / Products Handled
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3kW-10kW Residential, Waaree Modules, Polycab Inverters"
                  value={newCompanyForm.speciality}
                  onChange={(e) => setNewCompanyForm({ ...newCompanyForm, speciality: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Company at this Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: n8n WEBHOOK & AI PIPELINE SETTINGS
          ======================================================== */}
      {showN8nSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-xl w-full p-6 border border-surface-container-high shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
                  <span className="material-symbols-outlined text-[22px]">hub</span>
                </span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">n8n Solar Radar Pipeline</h3>
                  <p className="text-xs text-secondary">Configure n8n Webhook Endpoint &amp; AI Agent Orchestration</p>
                </div>
              </div>
              <button
                onClick={() => setShowN8nSettings(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Active n8n Webhook URL (Production / Local Test):
                </label>
                <input
                  type="url"
                  value={n8nUrl}
                  onChange={(e) => setN8nUrl(e.target.value)}
                  placeholder="https://your-n8n-instance.com/webhook/solar-radar-scanner"
                  className="w-full h-10 px-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-xs text-secondary">
                <div className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">psychology</span>
                  <span>How the n8n + AI Agent Pipeline Works:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Portal sends staff GPS coordinates, city, and radius via HTTP POST.</li>
                  <li>n8n executes OpenStreetMap Overpass &amp; Google Places queries for registered solar nodes.</li>
                  <li>AI Agent (Gemini / OpenAI) formats and enriches company names, contacts &amp; services.</li>
                  <li>Portal displays the live response directly in the structured Table &amp; Radar Map.</li>
                </ol>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleCopyWorkflowJson}
                  className="px-3 py-2 bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-bold text-on-surface rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-500">
                    {copiedWorkflow ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedWorkflow ? 'Workflow JSON Copied!' : 'Copy Ready n8n Template JSON'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowN8nSettings(false)}
                    className="px-3 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveN8nUrl}
                    className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    Save &amp; Scan Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
