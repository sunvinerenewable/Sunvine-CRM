import React, { useState, useMemo, useRef } from 'react';
import {
  generateDynamicLayouts,
  parseModuleDimensions,
  calculateLegHeights,
  calculateGiPipeSections,
  checkRoofFit,
  mmToMeters,
  mmToFeet,
  DEFAULT_MODULE_DIMS
} from '../../utils/solarLayoutEngine';
import SolarStructure3DViewer from './SolarStructure3DViewer';
import RooftopDesigner, { DEFAULT_ROOF_CONFIG, SAMPLE_HAND_DRAWN_SKETCH_CONFIG, SITE_SKETCH_2_CONFIG } from './RooftopDesigner';

export default function PanelLayoutVisualizer({
  initialPanelCount = 6,
  moduleSpecs = null,
  selectedLayoutId = null,
  onSelectLayout = null,
  isModal = false,
  onClose = null,
  initialRoofConfig = null,
  onRoofConfigChange = null
}) {
  const [panelCount, setPanelCount] = useState(initialPanelCount || 6);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(selectedLayoutId || 'portrait_2x3');
  const [activeViewTab, setActiveViewTab] = useState('roof'); // Step 1: Rooftop Setup first
  const [roofConfig, setRoofConfigState] = useState(() => {
    if (initialRoofConfig) return initialRoofConfig;
    try {
      const saved = localStorage.getItem('sunvine_saved_roof_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_ROOF_CONFIG;
  });

  const setRoofConfig = newCfg => {
    setRoofConfigState(newCfg);
    if (onRoofConfigChange) onRoofConfigChange(newCfg);
    try {
      localStorage.setItem('sunvine_saved_roof_config', JSON.stringify(newCfg));
    } catch (e) {}
  };
  const [frontLegHeightFt, setFrontLegHeightFt] = useState(2.5);
  const [tiltDegrees, setTiltDegrees] = useState(18);

  // Manual hardware override states (editable by dealer)
  const [manualFrontLegs, setManualFrontLegs] = useState('');
  const [manualRearLegs, setManualRearLegs] = useState('');
  const [manualMidClamps, setManualMidClamps] = useState('');
  const [manualEndClamps, setManualEndClamps] = useState('');
  const [showManualInputs, setShowManualInputs] = useState(false);

  const scrollContainerRef = useRef(null);

  // Derive module dimensions from props or fallback to standard 550W-600W
  const moduleDims = useMemo(() => {
    if (moduleSpecs?.dimensions) {
      return parseModuleDimensions(moduleSpecs.dimensions);
    }
    return DEFAULT_MODULE_DIMS;
  }, [moduleSpecs]);

  // Generate all dynamic layouts based on current panelCount
  const allLayouts = useMemo(() => {
    return generateDynamicLayouts(panelCount, moduleDims);
  }, [panelCount, moduleDims]);

  // Count of layouts that safely fit on the active roof
  const roofSafeCount = useMemo(() => {
    return allLayouts.filter(l => checkRoofFit(l, roofConfig).fits).length;
  }, [allLayouts, roofConfig]);

  // Filter layouts by selected category tab
  const filteredLayouts = useMemo(() => {
    if (activeCategory === 'all') return allLayouts;
    if (activeCategory === 'roof_safe') return allLayouts.filter(l => checkRoofFit(l, roofConfig).fits);
    if (activeCategory === 'recommended') return allLayouts.filter(l => l.isRecommended || l.excelTag);
    if (activeCategory === 'portrait') return allLayouts.filter(l => l.type === 'portrait');
    if (activeCategory === 'landscape') return allLayouts.filter(l => l.type === 'landscape');
    if (activeCategory === 'hybrid') return allLayouts.filter(l => l.type === 'hybrid');
    if (activeCategory === 'split') return allLayouts.filter(l => l.type === 'split');
    return allLayouts;
  }, [allLayouts, activeCategory, roofConfig]);

  // Selected layout object
  const activeSelectedLayout = useMemo(() => {
    return allLayouts.find(l => l.id === selectedId) || allLayouts[0] || null;
  }, [allLayouts, selectedId]);

  const handleSelect = (layout) => {
    setSelectedId(layout.id);
    // Pre-populate manual hardware inputs
    setManualFrontLegs(String(layout.bom.frontLegs));
    setManualRearLegs(String(layout.bom.rearLegs));
    setManualMidClamps(String(layout.bom.midClampsCount));
    setManualEndClamps(String(layout.bom.endClampsCount));

    if (onSelectLayout) {
      onSelectLayout({
        ...layout,
        manualOverrides: {
          frontLegs: layout.bom.frontLegs,
          rearLegs: layout.bom.rearLegs,
          midClamps: layout.bom.midClampsCount,
          endClamps: layout.bom.endClampsCount
        }
      });
    }
  };

  const handleSaveManualHardware = () => {
    if (!activeSelectedLayout || !onSelectLayout) return;
    const fLegs = parseInt(manualFrontLegs, 10) || activeSelectedLayout.bom.frontLegs;
    const rLegs = parseInt(manualRearLegs, 10) || activeSelectedLayout.bom.rearLegs;
    const mClamps = parseInt(manualMidClamps, 10) || activeSelectedLayout.bom.midClampsCount;
    const eClamps = parseInt(manualEndClamps, 10) || activeSelectedLayout.bom.endClampsCount;
    const fHeight = parseFloat(frontLegHeightFt) || 2.5;

    const elevation = calculateLegHeights(activeSelectedLayout, fHeight, tiltDegrees);

    onSelectLayout({
      ...activeSelectedLayout,
      bom: {
        ...activeSelectedLayout.bom,
        frontLegs: fLegs,
        rearLegs: rLegs,
        totalLegs: fLegs + rLegs,
        midClampsCount: mClamps,
        endClampsCount: eClamps,
        totalClamps: mClamps + eClamps,
        frontLegHeightFt: elevation.frontLegHeightFt,
        rearLegHeightFt: elevation.rearLegHeightFt,
        tiltDegrees
      },
      manualOverrides: {
        frontLegs: fLegs,
        rearLegs: rLegs,
        midClamps: mClamps,
        endClamps: eClamps,
        frontLegHeightFt: elevation.frontLegHeightFt,
        rearLegHeightFt: elevation.rearLegHeightFt
      }
    });
  };

  const handlePanelCountChange = (delta) => {
    setPanelCount(prev => Math.max(1, Math.min(36, Number(prev) + delta)));
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -480 : 480;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col w-full bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xl overflow-hidden">
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F1B2E] via-[#1E293B] to-[#0F1B2E] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-highest">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[26px]">grid_view</span>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              2D Solar Structure &amp; Panel Layout Studio
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6CBF3D]/20 text-[#6CBF3D] border border-[#6CBF3D]/40 uppercase">
              Side-by-Side 2D Presets
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Compare side-by-side layouts with fastener counts and roof boundary clearance. Select preferred layout.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="self-end md:self-auto p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Sub-Header Studio Mode Switcher: 2D | 3D WebGL | 20-ft GI Pipe Cutting */}
      <div className="px-4 sm:px-5 py-2.5 bg-[#0B1524] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">View Mode:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => setActiveViewTab('roof')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'roof'
                  ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">roofing</span>
              <span>1. 🏠 Rooftop Setup &amp; AI Scan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('2d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === '2d'
                  ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span>2. 📐 2D Solar Layouts ({filteredLayouts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('3d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === '3d'
                  ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
              <span>3. 🌐 3D Structure Model</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('pipes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeViewTab === 'pipes'
                  ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">content_cut</span>
              <span>4. ✂️ 20-ft GI Pipe Cutting</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
          <span>Active: <b className="text-[#6CBF3D]">{activeSelectedLayout?.name}</b></span>
          <span>•</span>
          <span>J-Bolts: <b className="text-amber-400">{activeSelectedLayout?.bom?.jBoltsCount} Pcs</b></span>
          <span>•</span>
          <span>MC4: <b className="text-blue-400">{activeSelectedLayout?.bom?.mc4ConnectorsCount} Pcs ({activeSelectedLayout?.bom?.mc4Pairs} Pair)</b></span>
        </div>
      </div>

      {/* Active Tab View: 2D Studio Presets */}
      {activeViewTab === '2d' && (
        <>
          {/* 2. Interactive Panel Count & Filter Controller */}
          <div className="p-4 sm:p-5 bg-surface-container-low border-b border-surface-container-high flex flex-col gap-3.5">
        {/* Row 1: Panel Count Stepper & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-surface-container-highest shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
              Total Solar Modules:
            </span>
            <div className="flex items-center border border-surface-container-highest rounded-lg overflow-hidden bg-surface-container-lowest shadow-xs">
              <button
                type="button"
                onClick={() => handlePanelCountChange(-1)}
                disabled={panelCount <= 1}
                className="w-8 h-8 flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-base"
                title="Decrease 1 panel"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max="40"
                value={panelCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 40) {
                    setPanelCount(val);
                  }
                }}
                className="w-12 h-8 text-center text-sm font-extrabold text-on-surface bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => handlePanelCountChange(1)}
                disabled={panelCount >= 40}
                className="w-8 h-8 flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-base"
                title="Increase 1 panel"
              >
                +
              </button>
            </div>
            <span className="text-xs font-bold text-primary hidden sm:inline-block">
              ~{(panelCount * 0.55).toFixed(1)} kW Array
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-secondary mr-1">Quick Presets:</span>
            {[
              { count: 4, kw: '2.2kW' },
              { count: 6, kw: '3.3kW (Excel)' },
              { count: 8, kw: '4.4kW' },
              { count: 10, kw: '5.5kW' },
              { count: 12, kw: '6.6kW' },
              { count: 14, kw: '8.0kW' }
            ].map(item => (
              <button
                key={item.count}
                type="button"
                onClick={() => setPanelCount(item.count)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  panelCount === item.count
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container-high text-secondary hover:text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                {item.count}P ({item.kw})
              </button>
            ))}
          </div>

          <div className="text-[11px] text-secondary flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-md">
            <span className="material-symbols-outlined text-[14px]">straighten</span>
            <span>Module: <b>{moduleDims.lengthMm} × {moduleDims.widthMm} mm</b> (~2:1 Ratio)</span>
          </div>
        </div>

        {/* Row 2: Category Filter Tabs & Horizontal Scroll Arrows */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: `All Layouts (${allLayouts.length})`, icon: 'apps' },
              { id: 'roof_safe', label: `✓ Roof-Safe (${roofSafeCount})`, icon: 'verified' },
              { id: 'recommended', label: 'Recommended / Excel Presets', icon: 'star' },
              { id: 'portrait', label: 'Pure Portrait', icon: 'crop_portrait' },
              { id: 'landscape', label: 'Pure Landscape', icon: 'crop_landscape' },
              { id: 'hybrid', label: 'Hybrid', icon: 'auto_awesome' },
              { id: 'split', label: 'Dual Split Tables', icon: 'splitscreen' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === tab.id
                    ? tab.id === 'roof_safe'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-[#0F1B2E] text-white shadow-sm'
                    : tab.id === 'roof_safe'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-white border border-surface-container-highest text-secondary hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Side-by-Side Scroll Control Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary font-medium mr-1">
              Scroll Layouts:
            </span>
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-8 h-8 rounded-lg bg-white border border-surface-container-highest hover:bg-surface-container-low text-on-surface flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
              title="Scroll left"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-lg bg-white border border-surface-container-highest hover:bg-surface-container-low text-on-surface flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
              title="Scroll right"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Scrollable Cards (Side-by-Side with Generous Width) */}
      <div
        ref={scrollContainerRef}
        className="p-4 sm:p-6 flex flex-row overflow-x-auto gap-6 bg-surface-container-lowest scroll-smooth snap-x pb-6"
      >
        {filteredLayouts.length === 0 ? (
          <div className="w-full py-12 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl opacity-50 mb-2">grid_off</span>
            <p className="text-sm font-semibold">No layout combinations found for this category filter.</p>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="mt-2 text-xs text-primary hover:underline font-bold"
            >
              Reset Category Filter
            </button>
          </div>
        ) : (
          filteredLayouts.map((layout) => {
            const isSelected = selectedId === layout.id;
            const fit = checkRoofFit(layout, roofConfig);
            const widthM = mmToMeters(layout.widthMm);
            const depthM = mmToMeters(layout.depthMm);
            const widthFt = mmToFeet(layout.widthMm);
            const depthFt = mmToFeet(layout.depthMm);
            const areaSqM = ((layout.areaSqM || 0)).toFixed(1);
            const areaSqFt = (((layout.areaSqM || 0)) * 10.7639).toFixed(0);

            return (
              <div
                key={layout.id}
                onClick={() => handleSelect(layout)}
                className={`min-w-[420px] sm:min-w-[460px] max-w-[480px] shrink-0 snap-start rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/40 shadow-lg bg-white'
                    : !fit.fits
                    ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20'
                    : 'border-surface-container-highest hover:border-primary/50 hover:shadow-md bg-white'
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 border-b border-surface-container-high flex items-start justify-between gap-2 ${
                  !fit.fits ? 'bg-rose-50/50' : 'bg-surface-container-lowest'
                }`}>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-on-surface">{layout.name}</span>
                      {layout.excelTag && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                          {layout.excelTag}
                        </span>
                      )}
                      {fit.fits ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Fits Roof
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">error</span>
                          Exceeds Roof
                        </span>
                      )}
                      {layout.isRecommended && !layout.excelTag && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">star</span>
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary mt-1 flex items-center gap-2">
                      <span className="font-semibold text-primary">{layout.category}</span>
                      <span>•</span>
                      <span className="font-bold text-on-surface">{layout.totalPanels} Solar Panels</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-primary text-white shadow-xs' : 'border border-surface-container-highest text-transparent'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </span>
                  </div>
                </div>

                {/* 2D Architectural CAD Drawing Box (Large & High Definition) */}
                <div className="p-4 bg-[#F8FAFC] flex flex-col items-center justify-center min-h-[260px] relative border-b border-surface-container-high">
                  {/* Roof Boundary Validation Alert Banner */}
                  {!fit.fits ? (
                    <div className="w-full bg-rose-50 border border-rose-200 text-rose-800 p-2 rounded-lg text-[11px] mb-2 font-semibold flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-rose-600 text-[16px] shrink-0">cancel</span>
                      <span className="truncate">
                        <b>Boundary Exceeded:</b> {fit.reason}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 p-1.5 rounded-lg text-[11px] mb-2 font-semibold flex items-center gap-1.5 shadow-2xs">
                      <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0">check_circle</span>
                      <span className="truncate">
                        <b>100% Roof Safe:</b> {fit.widthClearanceFt}ft W, {fit.depthClearanceFt}ft D clearance
                      </span>
                    </div>
                  )}

                  {/* Top Bar inside CAD box: Compass + Dimensions */}
                  <div className="w-full flex items-center justify-between gap-2 mb-2 text-xs">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
                      <span className="material-symbols-outlined text-[16px] text-rose-500 animate-pulse">explore</span>
                      <span>🧭 South Tilt (180°)</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-extrabold shadow-2xs">
                      <span>Width: {widthM}m ({widthFt} ft)</span>
                    </div>
                  </div>

                  {/* 2D Solar Array Large SVG Canvas */}
                  <div className="w-full flex items-center justify-center py-2">
                    <Render2DArraySvg layout={layout} />
                  </div>

                  {/* Bottom Bar: Depth & Area Footprint */}
                  <div className="w-full flex items-center justify-between text-xs text-slate-600 font-semibold mt-2 pt-2 border-t border-slate-200/60">
                    <span>Slope / Depth: <b>{depthM}m ({depthFt} ft)</b></span>
                    <span>Array Area: <b>{areaSqM} m² ({areaSqFt} sq.ft)</b></span>
                  </div>
                </div>

                {/* Bottom BOM Area: J-Bolts & MC4 Connectors Only (Dealer fills legs/clamps manually if needed) */}
                <div className="p-4 bg-surface-container-lowest flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* J-Bolts */}
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <span>⚡</span> J-Bolts
                        </span>
                        <span className="text-xl font-black text-amber-950">
                          {layout.bom.jBoltsCount} <span className="text-[10px] font-bold text-amber-800">Pcs</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-900/90 mt-1 font-semibold">
                        4 J-Bolts × {layout.totalPanels} panels
                      </span>
                    </div>

                    {/* MC4 Connectors */}
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-950 flex items-center gap-1">
                          <span>🔌</span> MC4 Connectors
                        </span>
                        <span className="text-xl font-black text-blue-950">
                          {layout.bom.mc4ConnectorsCount} <span className="text-[10px] font-bold text-blue-800">Pcs</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-900/90 mt-1 font-semibold">
                        {layout.bom.mc4Pairs} Pair ({layout.bom.mc4Pairs}M + {layout.bom.mc4Pairs}F) Home-Run
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons: Select Layout + 3D View */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(layout);
                      }}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        isSelected
                          ? 'bg-primary text-white ring-2 ring-primary/30'
                          : !fit.fits
                          ? 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200'
                          : 'bg-surface-container-high text-on-surface hover:bg-primary hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {isSelected ? 'check_circle' : !fit.fits ? 'warning' : 'touch_app'}
                      </span>
                      <span>{isSelected ? 'Selected Active' : !fit.fits ? 'Select (Exceeds Roof)' : 'Select Layout'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(layout);
                        setActiveViewTab('3d');
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold bg-[#0F1B2E] hover:bg-slate-800 text-white transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-xs"
                      title="Inspect this layout in 3D Three.js Structure Viewer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#6CBF3D]">view_in_ar</span>
                      <span>3D Model</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Manual Hardware Customization Bar (Dealer can manually fill legs, clamps etc.) */}
      <div className="p-4 sm:p-5 bg-surface-container-low border-t border-surface-container-high flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">construction</span>
            <span className="text-xs sm:text-sm font-bold text-on-surface">
              Manual Hardware Customization (Optional):
            </span>
            <span className="text-xs text-secondary">
              (Active: <b className="text-on-surface">{activeSelectedLayout?.name || 'Selected Layout'}</b>)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowManualInputs(!showManualInputs)}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{showManualInputs ? 'Hide Custom Inputs' : 'Edit Legs & Clamps Manually'}</span>
            <span className="material-symbols-outlined text-[16px]">
              {showManualInputs ? 'expand_less' : 'tune'}
            </span>
          </button>
        </div>

        {showManualInputs && (
          <div className="p-4 rounded-xl bg-white border border-surface-container-highest shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">Front Legs</label>
              <input
                type="number"
                min="1"
                max="20"
                value={manualFrontLegs}
                onChange={(e) => setManualFrontLegs(e.target.value)}
                placeholder={String(activeSelectedLayout?.bom?.frontLegs || 3)}
                className="h-9 px-3 rounded-lg border border-surface-container-highest text-xs font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">Rear Legs</label>
              <input
                type="number"
                min="1"
                max="20"
                value={manualRearLegs}
                onChange={(e) => setManualRearLegs(e.target.value)}
                placeholder={String(activeSelectedLayout?.bom?.rearLegs || 3)}
                className="h-9 px-3 rounded-lg border border-surface-container-highest text-xs font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">Front Leg Ht (ft)</label>
              <input
                type="number"
                min="1.0"
                max="8.0"
                step="0.1"
                value={frontLegHeightFt}
                onChange={(e) => setFrontLegHeightFt(parseFloat(e.target.value) || 2.5)}
                className="h-9 px-3 rounded-lg border border-surface-container-highest text-xs font-bold text-primary outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">Rear Leg Ht (18° Tilt)</label>
              <div className="h-9 px-3 rounded-lg bg-surface-container-low border border-surface-container-highest text-xs font-black text-amber-700 flex items-center">
                {calculateLegHeights(activeSelectedLayout, frontLegHeightFt, tiltDegrees).rearLegHeightFt} ft
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">Mid Clamps</label>
              <input
                type="number"
                min="0"
                max="50"
                value={manualMidClamps}
                onChange={(e) => setManualMidClamps(e.target.value)}
                placeholder={String(activeSelectedLayout?.bom?.midClampsCount || 8)}
                className="h-9 px-3 rounded-lg border border-surface-container-highest text-xs font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-secondary">End Clamps</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualEndClamps}
                  onChange={(e) => setManualEndClamps(e.target.value)}
                  placeholder={String(activeSelectedLayout?.bom?.endClampsCount || 4)}
                  className="h-9 px-2.5 w-full rounded-lg border border-surface-container-highest text-xs font-bold text-on-surface outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSaveManualHardware}
                  className="h-9 px-3 bg-primary hover:bg-[#4F9A2C] text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 Footer Navigation to 3D */}
        <div className="mt-2 p-4 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">verified</span>
            <span>Selected Layout: <b className="text-white">{activeSelectedLayout?.name}</b></span>
            <span className="text-slate-500">•</span>
            <span>Roof Fit: <b className={checkRoofFit(activeSelectedLayout, roofConfig).fits ? 'text-[#6CBF3D]' : 'text-rose-400'}>
              {checkRoofFit(activeSelectedLayout, roofConfig).fits ? '✓ Fits Roof Safe Zone' : '⚠️ Exceeds Roof Boundary'}
            </b></span>
          </div>
          <button
            type="button"
            onClick={() => setActiveViewTab('3d')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <span>Proceed to Step 3: Mount on 3D Realistic Roof</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
      </>
    )}

      {/* Active Tab View: House & Rooftop Boundary Designer */}
      {activeViewTab === 'roof' && (
        <div className="animate-in fade-in duration-150">
          <RooftopDesigner
            roofConfig={roofConfig}
            onSaveRoofConfig={setRoofConfig}
            onOpen3D={() => setActiveViewTab('3d')}
            onProceedTo2D={() => setActiveViewTab('2d')}
          />
        </div>
      )}

      {/* Active Tab View: 3D Three.js Structure Model */}
      {activeViewTab === '3d' && (
        <div className="p-4 sm:p-6 bg-slate-950 flex flex-col gap-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-white flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#6CBF3D]">view_in_ar</span>
              <span className="text-sm font-bold">Interactive 3D Rooftop Structure View:</span>
              <span className="text-xs text-[#6CBF3D] font-bold">({activeSelectedLayout?.name})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveViewTab('roof')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1 border border-white/10"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-400">roofing</span>
                <span>House Roof Designer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('2d')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back to 2D Presets</span>
              </button>
            </div>
          </div>

          <SolarStructure3DViewer
            layout={activeSelectedLayout}
            moduleDims={moduleDims}
            initialFrontLegHeightFt={frontLegHeightFt}
            tiltDegrees={tiltDegrees}
            roofConfig={roofConfig}
            onOpenRoofDesigner={() => setActiveViewTab('roof')}
          />

          {/* Step 3 Footer Navigation to Pipes */}
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">verified</span>
              <span>Structure safely mounted &amp; clamped inside terrace</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveViewTab('pipes')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <span>Proceed to Step 4: 20-ft GI Pipe Cutting BOM</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Tab View: 20-ft GI Pipe Cutting Optimization */}
      {activeViewTab === 'pipes' && (
        <div className="animate-in fade-in duration-150">
          <GiPipeCuttingSchedule
            layout={activeSelectedLayout}
            frontLegFt={frontLegHeightFt}
            tiltDegrees={tiltDegrees}
            onUpdateFrontLeg={setFrontLegHeightFt}
            onBackTo2D={() => setActiveViewTab('2d')}
          />
        </div>
      )}

      {/* 5. Footer Info */}
      <div className="p-3 bg-surface-container-low border-t border-surface-container-high flex flex-wrap items-center justify-between text-xs text-secondary">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">info</span>
          <span>
            <b>Standard Gujarat Tilt:</b> 15°–22° South Facing. Panels scale automatically to real physical proportions (~2:1).
          </span>
        </div>
        <div className="flex items-center gap-3 font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#1E3E62] border border-[#CBD5E1]"></span>
            <span>Khadi (Portrait)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#0284C7] border border-[#CBD5E1]"></span>
            <span>Aadi (Landscape)</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Large High-Detail 2D SVG Renderer for Solar Array
 * Renders large, crystal-clear photovoltaic cells with busbars and legible panel numbers
 */
function Render2DArraySvg({ layout }) {
  const { widthMm, depthMm, rows } = layout;

  // Large SVG viewport dimensions for big, readable display
  const svgWidth = 440;
  const svgHeight = 220;
  const padding = 16;

  // Scale factors to fit nicely within SVG box
  const availableW = svgWidth - padding * 2;
  const availableH = svgHeight - padding * 2;
  const scale = Math.min(availableW / (widthMm || 2278), availableH / (depthMm || 1134));

  const arraySvgW = (widthMm || 2278) * scale;
  const arraySvgH = (depthMm || 1134) * scale;
  const startX = (svgWidth - arraySvgW) / 2;
  const startY = (svgHeight - arraySvgH) / 2;

  return (
    <svg
      width="100%"
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="max-w-full drop-shadow-sm overflow-visible"
    >
      <defs>
        {/* Photovoltaic Solar Cell Dark Navy Gradient (Portrait) */}
        <linearGradient id={`pvGrad_${layout.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B192C" />
          <stop offset="60%" stopColor="#1E3E62" />
          <stop offset="100%" stopColor="#06121E" />
        </linearGradient>

        {/* Photovoltaic Solar Cell Sky Blue Gradient (Landscape) */}
        <linearGradient id={`pvGradLand_${layout.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0369A1" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
      </defs>

      {/* Structural Purlins / C-Channel Rails behind panels */}
      <line
        x1={startX - 6}
        y1={startY + arraySvgH * 0.25}
        x2={startX + arraySvgW + 6}
        y2={startY + arraySvgH * 0.25}
        stroke="#94A3B8"
        strokeWidth="3.5"
        strokeDasharray="6 3"
      />
      <line
        x1={startX - 6}
        y1={startY + arraySvgH * 0.75}
        x2={startX + arraySvgW + 6}
        y2={startY + arraySvgH * 0.75}
        stroke="#94A3B8"
        strokeWidth="3.5"
        strokeDasharray="6 3"
      />

      {/* Rows and Panels */}
      {(() => {
        let currentY = startY;
        return (rows || []).map((row, rIdx) => {
          const rowPanels = Array.isArray(row) ? row : [];
          if (rowPanels.length === 0) return null;

          const firstPanel = rowPanels[0];
          const rowH = firstPanel.heightMm * scale;
          const totalRowW = rowPanels.reduce((acc, p) => acc + (p.widthMm * scale), 0);
          let currentX = startX + ((arraySvgW - totalRowW) / 2);

          const rowElements = rowPanels.map((panel, pIdx) => {
            const pw = panel.widthMm * scale;
            const ph = panel.heightMm * scale;
            const px = currentX;
            const py = currentY;
            currentX += pw;

            const isLandscape = panel.orientation === 'landscape';

            return (
              <g key={`panel_${panel.id || `${rIdx}_${pIdx}`}`}>
                {/* Silver Anodized Aluminium Frame */}
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill="#E2E8F0"
                  stroke="#475569"
                  strokeWidth="1.5"
                  rx="2"
                />

                {/* Photovoltaic Blue Glass Wafer */}
                <rect
                  x={px + 1.5}
                  y={py + 1.5}
                  width={Math.max(1, pw - 3)}
                  height={Math.max(1, ph - 3)}
                  fill={isLandscape ? `url(#pvGradLand_${layout.id})` : `url(#pvGrad_${layout.id})`}
                  rx="1.5"
                />

                {/* Distinct Solar Busbar Grid Lines */}
                <line
                  x1={px + pw * 0.33}
                  y1={py + 2}
                  x2={px + pw * 0.33}
                  y2={py + ph - 2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="0.8"
                />
                <line
                  x1={px + pw * 0.66}
                  y1={py + 2}
                  x2={px + pw * 0.66}
                  y2={py + ph - 2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="0.8"
                />
                <line
                  x1={px + 2}
                  y1={py + ph * 0.5}
                  x2={px + pw - 2}
                  y2={py + ph * 0.5}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.8"
                />

                {/* Bold, Legible Panel Number Text */}
                {pw >= 14 && ph >= 14 && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2 + 4}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={Math.max(8, Math.min(13, pw / 3.2))}
                    fontWeight="900"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
                  >
                    {panel.label || `P${pIdx + 1}`}
                  </text>
                )}

                {/* J-Bolt Fastener Corner Dots */}
                <circle cx={px + 3} cy={py + 3} r="1.5" fill="#22C55E" stroke="#000" strokeWidth="0.4" />
                <circle cx={px + pw - 3} cy={py + 3} r="1.5" fill="#22C55E" stroke="#000" strokeWidth="0.4" />
                <circle cx={px + 3} cy={py + ph - 3} r="1.5" fill="#22C55E" stroke="#000" strokeWidth="0.4" />
                <circle cx={px + pw - 3} cy={py + ph - 3} r="1.5" fill="#22C55E" stroke="#000" strokeWidth="0.4" />
              </g>
            );
          });

          currentY += rowH;
          return <g key={`row_${rIdx}`}>{rowElements}</g>;
        });
      })()}

      {/* Front & Rear Leg Position Markers */}
      {(() => {
        const legCount = layout?.bom?.frontLegs || 2;
        const legStep = legCount > 1 ? arraySvgW / (legCount - 1) : 0;
        const legs = [];
        for (let i = 0; i < legCount; i++) {
          const lx = startX + (i * legStep);
          legs.push(
            <g key={`leg_${i}`}>
              <circle cx={lx} cy={startY + 3} r="3" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1" />
              <circle cx={lx} cy={startY + arraySvgH - 3} r="3" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1" />
            </g>
          );
        }
        return legs;
      })()}
    </svg>
  );
}

/**
 * 20-Ft Standard Commercial GI Pipe Cutting Schedule
 * Shows 1D bin packing cut list and scrap percentage for 60x40 and 40x40 GI pipes
 */
function GiPipeCuttingSchedule({ layout, frontLegFt = 2.5, tiltDegrees = 18, onUpdateFrontLeg, onBackTo2D }) {
  const pipeSections = useMemo(() => {
    return calculateGiPipeSections(layout, frontLegFt, tiltDegrees);
  }, [layout, frontLegFt, tiltDegrees]);

  const { elevation, legs60x40, raftersPurlins40x40 } = pipeSections;

  return (
    <div className="p-4 sm:p-6 bg-slate-950 text-white flex flex-col gap-6">
      {/* Top Bar with Elevation Specs & Back Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[24px]">content_cut</span>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              20-Ft Standard Commercial GI Pipe Cutting Schedule
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
              1D Bin Packing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cutting schedule and scrap minimization for standard 20ft GI sections (60x40 columns &amp; 40x40 purlins/rafters).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackTo2D && (
            <button
              type="button"
              onClick={onBackTo2D}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to 2D Presets</span>
            </button>
          )}
        </div>
      </div>

      {/* Elevation & Slope Geometry Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-semibold">Front Leg Height</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1.0"
              max="8.0"
              step="0.1"
              value={frontLegFt}
              onChange={(e) => onUpdateFrontLeg && onUpdateFrontLeg(parseFloat(e.target.value) || 2.5)}
              className="w-18 h-8 px-2 rounded bg-slate-800 border border-slate-700 font-black text-xs text-[#6CBF3D] outline-none"
            />
            <span className="text-xs font-bold text-[#6CBF3D]">ft</span>
          </div>
          <span className="text-[10px] text-slate-500">~{elevation.frontLegHeightMm} mm</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-semibold">Rear Leg Height</span>
          <span className="text-sm font-black text-amber-400 leading-8">
            {elevation.rearLegHeightFt} ft
          </span>
          <span className="text-[10px] text-slate-500">~{elevation.rearLegHeightMm} mm (Auto {elevation.tiltDegrees}° Tilt)</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-semibold">Rafter Slope Length</span>
          <span className="text-sm font-black text-white leading-8">
            {elevation.slopeLengthFt} ft
          </span>
          <span className="text-[10px] text-slate-500">Depth / cos({elevation.tiltDegrees}°)</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-semibold">Array Table Width</span>
          <span className="text-sm font-black text-white leading-8">
            {mmToFeet(layout.widthMm)} ft
          </span>
          <span className="text-[10px] text-slate-500">Purlin Span Length</span>
        </div>
      </div>

      {/* Section 1: 60mm x 40mm GI Pipe (Columns / Legs) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <h4 className="text-sm font-bold text-white">
              1. 60mm × 40mm GI Pipe Cuts (Front &amp; Rear Legs / Columns)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Total: {legs60x40.totalPipesCount} Pipes (20 ft each = {legs60x40.totalPipesFeet} ft)
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-slate-300">
              Cut Length: {legs60x40.totalLengthFt} ft
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {legs60x40.pipes.map((pipe) => {
            const usedPct = ((pipe.usedFt / 20) * 100).toFixed(1);
            return (
              <div key={pipe.pipeIndex} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-400">linear_scale</span>
                    Pipe #{pipe.pipeIndex} (Standard 20'-0")
                  </span>
                  <span className="text-slate-300">
                    Used: <b className="text-white">{pipe.usedFt} ft</b> ({usedPct}%) | Scrap: <b className="text-amber-400">{pipe.remainingFt} ft</b>
                  </span>
                </div>

                {/* Visual 1D Pipe Cutting Bar */}
                <div className="w-full h-7 rounded-lg overflow-hidden flex bg-slate-800 border border-slate-700 p-0.5">
                  {pipe.cuts.map((c, cIdx) => {
                    const widthPct = (c.lengthFt / 20) * 100;
                    const isRear = c.type === 'rear_leg';
                    return (
                      <div
                        key={cIdx}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full flex items-center justify-center text-[10px] font-black border-r border-slate-900/60 truncate px-1 transition-all ${
                          isRear ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                        }`}
                        title={`${c.label}: ${c.lengthFt} ft`}
                      >
                        {c.id} ({c.lengthFt}')
                      </div>
                    );
                  })}
                  {pipe.remainingFt > 0 && (
                    <div
                      style={{ width: `${(pipe.remainingFt / 20) * 100}%` }}
                      className="h-full bg-slate-700/60 flex items-center justify-center text-[9px] font-bold text-slate-400 truncate px-1"
                      title={`Scrap / Offcut: ${pipe.remainingFt} ft`}
                    >
                      Scrap {pipe.remainingFt}'
                    </div>
                  )}
                </div>

                {/* Cut details list */}
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  {pipe.cuts.map((c, cIdx) => (
                    <span key={cIdx} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${c.type === 'rear_leg' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                      <span>{c.label}: <b>{c.lengthFt} ft</b></span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: 40mm x 40mm GI Pipe (Rafters & Purlins) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <h4 className="text-sm font-bold text-white">
              2. 40mm × 40mm GI Pipe Cuts (Rafters along slope &amp; Purlins along width)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Total: {raftersPurlins40x40.totalPipesCount} Pipes (20 ft each = {raftersPurlins40x40.totalPipesFeet} ft)
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-slate-300">
              Cut Length: {raftersPurlins40x40.totalLengthFt} ft
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {raftersPurlins40x40.pipes.map((pipe) => {
            const usedPct = ((pipe.usedFt / 20) * 100).toFixed(1);
            return (
              <div key={pipe.pipeIndex} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">linear_scale</span>
                    Pipe #{pipe.pipeIndex} (Standard 20'-0")
                  </span>
                  <span className="text-slate-300">
                    Used: <b className="text-white">{pipe.usedFt} ft</b> ({usedPct}%) | Scrap: <b className="text-amber-400">{pipe.remainingFt} ft</b>
                  </span>
                </div>

                {/* Visual 1D Pipe Cutting Bar */}
                <div className="w-full h-7 rounded-lg overflow-hidden flex bg-slate-800 border border-slate-700 p-0.5">
                  {pipe.cuts.map((c, cIdx) => {
                    const widthPct = (c.lengthFt / 20) * 100;
                    const isRafter = c.type === 'rafter';
                    return (
                      <div
                        key={cIdx}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full flex items-center justify-center text-[10px] font-black border-r border-slate-900/60 truncate px-1 transition-all ${
                          isRafter ? 'bg-indigo-500 text-white' : 'bg-cyan-500 text-slate-950'
                        }`}
                        title={`${c.label}: ${c.lengthFt} ft`}
                      >
                        {c.id} ({c.lengthFt}')
                      </div>
                    );
                  })}
                  {pipe.remainingFt > 0 && (
                    <div
                      style={{ width: `${(pipe.remainingFt / 20) * 100}%` }}
                      className="h-full bg-slate-700/60 flex items-center justify-center text-[9px] font-bold text-slate-400 truncate px-1"
                      title={`Scrap / Offcut: ${pipe.remainingFt} ft`}
                    >
                      Scrap {pipe.remainingFt}'
                    </div>
                  )}
                </div>

                {/* Cut details list */}
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  {pipe.cuts.map((c, cIdx) => (
                    <span key={cIdx} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${c.type === 'rafter' ? 'bg-indigo-400' : 'bg-cyan-400'}`}></span>
                      <span>{c.label}: <b>{c.lengthFt} ft</b></span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

