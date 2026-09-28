import React, { useState } from 'react';
import { useToast } from './Toast';

export default function SolarStructure3DComingSoon({
  layout = null,
  frontLegFt = 2.5,
  tiltDegrees = 18,
  onProceedToPipes = null,
  onBackTo2D = null,
  onBackToRoof = null,
  onToggleLive3D = null
}) {
  const { addToast } = useToast();
  const [reserved, setReserved] = useState(false);
  const [activePreviewAngle, setActivePreviewAngle] = useState('iso'); // 'iso', 'elevation', 'azimuth'

  const handleReserve = () => {
    setReserved(true);
    if (addToast) {
      addToast({
        title: 'Priority Beta Access Reserved!',
        message: 'You have been enrolled for the Sunvine 3D Realistic Rooftop Engine v2.5 release.',
        type: 'success'
      });
    }
  };

  const panelCount = layout?.totalPanels || 6;
  const layoutName = layout?.name || `${panelCount} Panels Grid`;
  const jBolts = layout?.bom?.jBoltsCount || panelCount * 4;

  const features = [
    {
      icon: 'view_in_ar',
      badge: 'Interactive WebGL',
      title: '360° Photorealistic Structure Twin',
      desc: 'Interactive 3D orbit and walk-through view displaying high-tensile hot-dip GI purlins, rafters, and realistic mono PERC solar modules.'
    },
    {
      icon: 'wb_sunny',
      badge: 'Gujarat Irradiance',
      title: 'Hourly Sun Path & Shadow Simulation',
      desc: 'Accurate shadow projection across all 365 days using Gujarat geographical coordinates (Ahmedabad, Surat, Rajkot, Vadodara) to prevent shading losses.'
    },
    {
      icon: 'anchor',
      badge: 'Civil Engineering',
      title: 'Parapet Beam & RCC Slab Anchoring',
      desc: 'Visual simulation of M12/M16 chemical anchoring studs into parapet wall beams vs ballast concrete footings with 150 km/h wind-load compliance.'
    },
    {
      icon: 'architecture',
      badge: 'Slope Optimization',
      title: 'Dynamic Leg Elevation Engine',
      desc: 'Automated millimeter-precise front and rear column height calculation adjusting for terrace water drainage slopes and south-facing tilt angles.'
    },
    {
      icon: 'share',
      badge: 'Customer Delight',
      title: 'One-Click WhatsApp 3D Walkthrough',
      desc: 'Generate a mobile-friendly 3D link directly in the customer quotation so clients can inspect their rooftop solar plant in realistic 3D on their phone.'
    },
    {
      icon: 'content_cut',
      badge: 'Zero Scrap Wastage',
      title: 'Integrated 20-ft GI Pipe Cutting',
      desc: 'Direct synchronization between 3D leg heights and optimal 20-ft pipe cutting stock to minimize on-site steel wastage below 3%.'
    }
  ];

  return (
    <div className="flex flex-col gap-6 text-white animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1528] via-[#0E1E38] to-[#122A4F] p-6 sm:p-8 border border-slate-700/80 shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#6CBF3D]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6CBF3D]/15 text-[#7EDE45] border border-[#6CBF3D]/30 text-xs font-semibold tracking-wider font-mono uppercase">
              <span className="w-2 h-2 rounded-full bg-[#7EDE45] animate-ping" />
              <span>Upcoming Feature &bull; Version 2.5 Roadmap</span>
            </div>

            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              3D Realistic Rooftop &amp; Structure Twin Engine
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              We are developing an ultra-high performance Three.js 3D WebGL digital twin for Sunvine Dealers.
              Experience real-world terrace modeling, parapet anchoring, and dynamic shadow simulation before on-site installation.
            </p>

            {/* Current Proposal Context Ribbon */}
            <div className="pt-2 flex items-center gap-3 flex-wrap text-xs font-mono text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-[#6CBF3D]">grid_view</span>
                <span>Active Layout: <b className="text-white">{layoutName}</b></span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-amber-400">explore</span>
                <span>Tilt: <b className="text-white">{tiltDegrees}° South</b></span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-blue-400">bolt</span>
                <span>J-Bolts: <b className="text-white">{jBolts} Pcs</b></span>
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReserve}
              disabled={reserved}
              className={`px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                reserved
                  ? 'bg-emerald-700 text-white cursor-default'
                  : 'bg-[#6CBF3D] hover:bg-[#5ca633] text-slate-950 font-black hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {reserved ? 'check_circle' : 'notifications_active'}
              </span>
              <span>{reserved ? 'Priority Access Reserved' : 'Notify Me When 3D Launches'}</span>
            </button>

            {onProceedToPipes && (
              <button
                type="button"
                onClick={onProceedToPipes}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span>Proceed to Step 4: 20-ft GI Pipe Cutting</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}

            {onToggleLive3D && (
              <button
                type="button"
                onClick={onToggleLive3D}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 font-mono text-[11px] flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                title="Internal Developer Preview: Inspect Three.js WebGL canvas"
              >
                <span className="material-symbols-outlined text-[14px]">science</span>
                <span>Developer Preview: Launch Experimental 3D</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Isometric Blueprint Preview Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[22px]">model_training</span>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Digital Twin Interactive Blueprint Preview
              </h2>
              <p className="text-xs text-slate-400">
                Architectural solar structure layout rendered to 1:50 millimeter scale
              </p>
            </div>
          </div>

          {/* Perspective Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActivePreviewAngle('iso')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePreviewAngle === 'iso'
                  ? 'bg-[#6CBF3D] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">perspective</span>
              <span>Isometric 3D</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewAngle('elevation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePreviewAngle === 'elevation'
                  ? 'bg-[#6CBF3D] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">straighten</span>
              <span>Side Elevation</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewAngle('azimuth')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activePreviewAngle === 'azimuth'
                  ? 'bg-[#6CBF3D] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">compass_calibration</span>
              <span>Solar Azimuth</span>
            </button>
          </div>
        </div>

        {/* Blueprint Graphic Showcase */}
        <div className="mt-5 relative w-full h-80 sm:h-96 rounded-xl bg-[#060D18] border border-slate-800/90 flex items-center justify-center overflow-hidden">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />

          {/* Radial glow */}
          <div className="absolute w-96 h-96 bg-[#6CBF3D]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Dynamic SVG Visuals based on active preview angle */}
          {activePreviewAngle === 'iso' && (
            <svg viewBox="0 0 600 320" className="w-full h-full max-h-80 text-white select-none">
              <defs>
                <linearGradient id="pvPanelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1E3E62" />
                  <stop offset="100%" stopColor="#0A1628" />
                </linearGradient>
                <linearGradient id="giPipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#94A3B8" />
                  <stop offset="100%" stopColor="#64748B" />
                </linearGradient>
              </defs>

              {/* Terrace Slab Outline (Isometric) */}
              <polygon points="100,220 300,270 500,220 300,170" fill="#0F172A" stroke="#334155" strokeWidth="2" />
              <polygon points="100,220 300,270 300,285 100,235" fill="#090D16" stroke="#334155" strokeWidth="1.5" />
              <polygon points="300,270 500,220 500,235 300,285" fill="#0B111D" stroke="#334155" strokeWidth="1.5" />

              {/* Parapet Wall Accent */}
              <polyline points="100,220 300,170 500,220" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeDasharray="4 4" />
              <text x="300" y="162" fill="#38BDF8" fontSize="10" textAnchor="middle" fontFamily="monospace">Parapet Beam Anchoring Zone (North)</text>

              {/* GI Columns (Legs) */}
              {/* Front Leg Left */}
              <line x1="200" y1="230" x2="200" y2="175" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              {/* Front Leg Right */}
              <line x1="400" y1="230" x2="400" y2="175" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              {/* Rear Leg Left */}
              <line x1="200" y1="195" x2="200" y2="115" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
              {/* Rear Leg Right */}
              <line x1="400" y1="195" x2="400" y2="115" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />

              {/* Anchor Bolt Plates */}
              <circle cx="200" cy="230" r="5" fill="#F59E0B" />
              <circle cx="400" cy="230" r="5" fill="#F59E0B" />
              <circle cx="200" cy="195" r="5" fill="#F59E0B" />
              <circle cx="400" cy="195" r="5" fill="#F59E0B" />

              {/* Solar Array Tilted Table (3D angled polygon) */}
              <polygon points="160,165 440,165 440,110 160,110" fill="url(#pvPanelGrad)" stroke="#6CBF3D" strokeWidth="2.5" />

              {/* Panel Grid Lines (2x3 Grid) */}
              <line x1="253" y1="165" x2="253" y2="110" stroke="#38BDF8" strokeWidth="1.2" opacity="0.8" />
              <line x1="347" y1="165" x2="347" y2="110" stroke="#38BDF8" strokeWidth="1.2" opacity="0.8" />
              <line x1="160" y1="137" x2="440" y2="137" stroke="#38BDF8" strokeWidth="1.2" opacity="0.8" />

              {/* Busbars / Cell Texture */}
              <line x1="180" y1="165" x2="180" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />
              <line x1="220" y1="165" x2="220" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />
              <line x1="280" y1="165" x2="280" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />
              <line x1="320" y1="165" x2="320" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />
              <line x1="380" y1="165" x2="380" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />
              <line x1="420" y1="165" x2="420" y2="110" stroke="#CBD5E1" strokeWidth="0.5" opacity="0.4" />

              {/* Dimension Annotations */}
              <line x1="140" y1="165" x2="140" y2="110" stroke="#6CBF3D" strokeWidth="1" strokeDasharray="3 3" />
              <text x="130" y="140" fill="#6CBF3D" fontSize="10" textAnchor="end" fontFamily="monospace">Tilt {tiltDegrees}°</text>

              <line x1="455" y1="230" x2="455" y2="175" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />
              <text x="465" y="205" fill="#F59E0B" fontSize="10" fontFamily="monospace">Front {frontLegFt} ft</text>

              {/* Sun Ray Path Arc */}
              <path d="M 120 70 Q 300 20 480 70" fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
              <circle cx="480" cy="70" r="14" fill="#FBBF24" opacity="0.2" />
              <circle cx="480" cy="70" r="8" fill="#F59E0B" />
              <text x="480" y="50" fill="#FDE047" fontSize="10" textAnchor="middle" fontWeight="bold">Sun (Azimuth 180° S)</text>
            </svg>
          )}

          {activePreviewAngle === 'elevation' && (
            <svg viewBox="0 0 600 320" className="w-full h-full max-h-80 text-white select-none">
              {/* Terrace Ground Floor */}
              <line x1="60" y1="260" x2="540" y2="260" stroke="#475569" strokeWidth="4" />
              <text x="300" y="280" fill="#64748B" fontSize="11" textAnchor="middle" fontFamily="monospace">Terrace RCC Floor Slab (Gujarat Residential Code)</text>

              {/* Front Leg (Left) */}
              <line x1="200" y1="260" x2="200" y2="190" stroke="#38BDF8" strokeWidth="6" strokeLinecap="round" />
              <circle cx="200" cy="260" r="6" fill="#F59E0B" />
              <text x="185" y="230" fill="#38BDF8" fontSize="11" textAnchor="end" fontFamily="monospace">Front Leg: {frontLegFt} ft</text>

              {/* Rear Leg (Right) */}
              <line x1="400" y1="260" x2="400" y2="120" stroke="#38BDF8" strokeWidth="6" strokeLinecap="round" />
              <circle cx="400" cy="260" r="6" fill="#F59E0B" />
              <text x="420" y="190" fill="#38BDF8" fontSize="11" fontFamily="monospace">Rear Leg: {(parseFloat(frontLegFt) + 2.2).toFixed(1)} ft</text>

              {/* Cross Bracing */}
              <line x1="200" y1="260" x2="400" y2="120" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
              <line x1="200" y1="190" x2="400" y2="260" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
              <text x="300" y="200" fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">Diagonal GI Stiffener</text>

              {/* Solar Rafter & Modules */}
              <line x1="170" y1="200" x2="430" y2="110" stroke="#6CBF3D" strokeWidth="8" strokeLinecap="round" />
              <text x="310" y="140" fill="#6CBF3D" fontSize="12" fontWeight="bold" textAnchor="middle">
                PV Module Plane &bull; {tiltDegrees}° Angle
              </text>
            </svg>
          )}

          {activePreviewAngle === 'azimuth' && (
            <svg viewBox="0 0 600 320" className="w-full h-full max-h-80 text-white select-none">
              {/* Compass Compass Rose */}
              <circle cx="300" cy="160" r="100" fill="#0A1424" stroke="#334155" strokeWidth="2" />
              <circle cx="300" cy="160" r="70" fill="none" stroke="#1E293B" strokeWidth="1" strokeDasharray="2 2" />

              {/* Cardinal Directions */}
              <text x="300" y="45" fill="#EF4444" fontSize="14" fontWeight="bold" textAnchor="middle">N (North 0°)</text>
              <text x="300" y="285" fill="#6CBF3D" fontSize="14" fontWeight="bold" textAnchor="middle">S (South 180° - True Solar Facing)</text>
              <text x="430" y="165" fill="#94A3B8" fontSize="12" fontWeight="bold">E</text>
              <text x="170" y="165" fill="#94A3B8" fontSize="12" fontWeight="bold" textAnchor="end">W</text>

              {/* Solar Array Orientation Box */}
              <rect x="230" y="140" width="140" height="40" rx="4" fill="#1E3E62" stroke="#6CBF3D" strokeWidth="2" />
              <text x="300" y="165" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">
                {panelCount} Panels Facing South
              </text>

              {/* Solar Irradiance Vector */}
              <line x1="300" y1="250" x2="300" y2="190" stroke="#FBBF24" strokeWidth="3" markerEnd="url(#arrow)" />
              <text x="300" y="215" fill="#FDE047" fontSize="10" textAnchor="middle" fontFamily="monospace">
                Peak Gujarat Irradiance: 5.4 kWh/m²/day
              </text>
            </svg>
          )}

          {/* Watermark Ribbon */}
          <div className="absolute bottom-3 left-4 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-700/80 text-[11px] font-mono text-slate-300 flex items-center gap-2 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>WebGL Three.js Shader Architecture &bull; GPU Acceleration Ready</span>
          </div>

          <div className="absolute top-3 right-4 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[14px]">lock_clock</span>
            <span>Coming in v2.5 Update</span>
          </div>
        </div>

        {/* Dynamic Spec Badges */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Array Dimension</div>
            <div className="font-bold text-white mt-0.5">{layout?.totalWidthFt || '19.8'} ft × {layout?.totalDepthFt || '7.5'} ft</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Recommended Clearance</div>
            <div className="font-bold text-[#6CBF3D] mt-0.5">2.5 ft Front &bull; Clean RCC Drain</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Wind Survival Index</div>
            <div className="font-bold text-cyan-400 mt-0.5">150 km/h (Class B/C Terrain)</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-slate-400 text-[11px]">Hardware Count</div>
            <div className="font-bold text-amber-400 mt-0.5">{jBolts} J-Bolts + {panelCount * 2} Clamps</div>
          </div>
        </div>
      </div>

      {/* 3. Upcoming Capabilities Matrix */}
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">verified</span>
          <span>Engineered specifically for Gujarat Rooftop Deployments</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#6CBF3D]/10 text-[#6CBF3D] flex items-center justify-center border border-[#6CBF3D]/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">{feat.icon}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {feat.badge}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-[#6CBF3D] transition-colors">
                  {feat.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Bottom Navigation & Workflow Continuity */}
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">check_circle</span>
          <span>2D Blueprint &amp; Bill of Materials are fully active and validated.</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackTo2D && (
            <button
              type="button"
              onClick={onBackTo2D}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to 2D Presets</span>
            </button>
          )}

          {onProceedToPipes && (
            <button
              type="button"
              onClick={onProceedToPipes}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <span>Proceed to Step 4: 20-ft GI Pipe Cutting BOM</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
