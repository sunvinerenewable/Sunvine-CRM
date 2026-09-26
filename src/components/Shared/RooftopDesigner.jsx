import React, { useState, useMemo, useRef, useCallback } from 'react';
import { scanRoofSketch, getGeminiApiKey, saveGeminiApiKey } from '../../utils/aiRoofVisionEngine';
import InteractiveImageRoofTracer from './InteractiveImageRoofTracer';

/**
 * Clean Default Config (Awaiting User Upload)
 * Zero hardcoded presets - geometry is 100% driven by uploaded sketches or direct input
 */
export const DEFAULT_ROOF_CONFIG = {
  type: 'custom_polygon',
  name: 'No Drawing Uploaded Yet',
  widthFt: 30,
  depthFt: 30,
  parapetHeightFt: 3.0,
  parapetThicknessInches: 9,
  southDirection: 'top',
  customVertices: [
    { x: -15, z: -15, label: 'NW Corner' },
    { x: 15, z: -15, label: 'NE Corner' },
    { x: 15, z: 15, label: 'SE Corner' },
    { x: -15, z: 15, label: 'SW Corner' }
  ],
  obstacles: [],
  safeSolarZone: {
    centerXFt: 0,
    centerZFt: 0,
    availableWidthFt: 20,
    availableDepthFt: 20,
    description: 'Awaiting Uploaded Sketch'
  },
  isPendingUpload: true,
  uploadedImage: null
};

// Aliases for backward compatibility
export const SITE_SKETCH_2_CONFIG = DEFAULT_ROOF_CONFIG;
export const SITE_SKETCH_3_CONFIG = DEFAULT_ROOF_CONFIG;
export const SAMPLE_HAND_DRAWN_SKETCH_CONFIG = DEFAULT_ROOF_CONFIG;
export const DEFAULT_L_SHAPE_CONFIG = DEFAULT_ROOF_CONFIG;

/**
 * Builds orthogonal stepped vertices for stepped L shapes if manually chosen
 */
export function buildOrthogonalSteppedVertices(wTop, dUpper, wShelf, dLower) {
  const wTotal = wTop + wShelf;
  const dTotal = dUpper + dLower;
  const halfW = wTotal / 2;
  const halfD = dTotal / 2;

  return [
    { x: -halfW, z: -halfD, label: 'NW Corner' },
    { x: -halfW + wTop, z: -halfD, label: `Top Wall (${wTop}ft)` },
    { x: -halfW + wTop, z: -halfD + dUpper, label: `Drop (${dUpper}ft)` },
    { x: halfW, z: -halfD + dUpper, label: `Shelf (${wShelf}ft)` },
    { x: halfW, z: halfD, label: `Lower (${dLower}ft)` },
    { x: -halfW, z: halfD, label: `Bottom Wall (${wTotal}ft)` }
  ];
}

/**
 * Computes 2D polygon vertices (in feet) for any roof config
 */
export function getRoofPolygonVertices(roof) {
  if (roof.customVertices && roof.customVertices.length >= 3) {
    return roof.customVertices;
  }

  const w = parseFloat(roof.widthFt) || 30;
  const d = parseFloat(roof.depthFt) || 30;
  const halfW = w / 2;
  const halfD = d / 2;

  return [
    { x: -halfW, z: -halfD, label: 'NW Corner' },
    { x: halfW, z: -halfD, label: 'NE Corner' },
    { x: halfW, z: halfD, label: 'SE Corner' },
    { x: -halfW, z: halfD, label: 'SW Corner' }
  ];
}

/**
 * Computes side lengths (walls) for a polygon
 */
export function getRoofWalls(vertices) {
  if (!vertices || vertices.length < 2) return [];
  const walls = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i] || { x: 0, z: 0 };
    const p2 = vertices[(i + 1) % n] || { x: 0, z: 0 };
    const dx = (p2.x ?? 0) - (p1.x ?? 0);
    const dz = (p2.z ?? 0) - (p1.z ?? 0);
    const lengthFt = Number(Math.sqrt(dx * dx + dz * dz).toFixed(1));
    walls.push({
      index: i + 1,
      name: `Side ${i + 1} (${p1.label || `P${i + 1}`} → ${p2.label || `P${((i + 1) % n) + 1}`})`,
      lengthFt,
      p1,
      p2
    });
  }
  return walls;
}

export default function RooftopDesigner({
  roofConfig = null,
  onSaveRoofConfig = null,
  onOpen3D = null,
  onProceedTo2D = null
}) {
  const [config, setConfig] = useState(roofConfig || DEFAULT_ROOF_CONFIG);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'manual', 'analysis'
  const [uploadPreview, setUploadPreview] = useState(config.uploadedImage || null);
  const [blueprintViewMode, setBlueprintViewMode] = useState('cad'); // 'cad' or 'photo' or 'both'
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [selectedWallIndex, setSelectedWallIndex] = useState(null);

  // Gemini API key state
  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey());
  const [tempApiKey, setTempApiKey] = useState('');
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);

  // Mumty location state
  const [mumtyLoc, setMumtyLoc] = useState(config.obstacles?.[0]?.location || 'none');
  const [mumtyW, setMumtyW] = useState(config.obstacles?.[0]?.widthFt || 4);
  const [mumtyD, setMumtyD] = useState(config.obstacles?.[0]?.depthFt || 7);
  const [mumtyH, setMumtyH] = useState(config.obstacles?.[0]?.heightFt || 7);
  const [hasWaterTank, setHasWaterTank] = useState(config.obstacles?.some(o => o.type === 'cylinder') || false);

  const fileInputRef = useRef(null);

  const handleSaveApiKey = () => {
    saveGeminiApiKey(tempApiKey);
    setGeminiKey(tempApiKey.trim());
    setShowApiKeySetting(false);
  };

  const handleClearApiKey = () => {
    saveGeminiApiKey('');
    setGeminiKey('');
    setTempApiKey('');
    setShowApiKeySetting(false);
  };

  // Compute vertices and walls dynamically from whatever is active (synced with traced sides!)
  const vertices = useMemo(() => getRoofPolygonVertices(config), [config]);
  const rawWalls = useMemo(() => getRoofWalls(vertices), [vertices]);
  const walls = useMemo(() => {
    if (config.walls && config.walls.length >= 3) {
      return config.walls.map((w, idx) => {
        const p1 = w.p1 || (vertices && vertices[idx]) || { x: 0, z: 0 };
        const p2 = w.p2 || (vertices && vertices[(idx + 1) % (vertices.length || 1)]) || { x: 0, z: 0 };
        return {
          index: w.index || w.side || idx + 1,
          side: w.side || idx + 1,
          name: w.name || `Side ${idx + 1}`,
          lengthFt: parseFloat(w.lengthFt) || 10,
          direction: w.direction || 'E',
          p1,
          p2
        };
      });
    }
    return rawWalls;
  }, [config.walls, rawWalls, vertices]);

  const handleTracerSidesChange = useCallback(newSides => {
    if (!newSides || newSides.length === 0) return;
    setConfig(prev => ({
      ...prev,
      walls: newSides.map((s, idx) => ({
        index: idx + 1,
        side: idx + 1,
        name: s.name,
        lengthFt: parseFloat(s.lengthFt) || 10,
        direction: s.direction
      }))
    }));
  }, []);
  const totalPerimeterFt = useMemo(() => walls.reduce((acc, w) => acc + w.lengthFt, 0).toFixed(1), [walls]);
  const estimatedAreaSqFt = useMemo(() => {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].z;
      area -= vertices[j].x * vertices[i].z;
    }
    return Math.abs(area / 2).toFixed(0);
  }, [vertices]);

  const obstacles = config.obstacles || [];

  // Update wall length directly by dealer
  const handleUpdateWallLength = (wallIdx, newLen) => {
    const len = parseFloat(newLen);
    if (!len || len <= 0 || !config.customVertices) return;

    const currentVerts = [...config.customVertices];
    const n = currentVerts.length;
    const p1 = currentVerts[wallIdx];
    const p2 = currentVerts[(wallIdx + 1) % n];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const currentLen = Math.sqrt(dx * dx + dz * dz) || 1;
    const factor = len / currentLen;

    const newDx = dx * factor;
    const newDz = dz * factor;
    const shiftX = newDx - dx;
    const shiftZ = newDz - dz;

    // Shift subsequent vertices to maintain 90° angles
    for (let k = wallIdx + 1; k < n; k++) {
      currentVerts[k] = {
        ...currentVerts[k],
        x: Number((currentVerts[k].x + shiftX).toFixed(1)),
        z: Number((currentVerts[k].z + shiftZ).toFixed(1))
      };
    }

    const updated = {
      ...config,
      customVertices: currentVerts
    };
    setConfig(updated);
    if (onSaveRoofConfig) onSaveRoofConfig(updated);
  };

  // Mumty location change handler
  const handleMumtyLocationChange = newLoc => {
    setMumtyLoc(newLoc);
    const halfW = (config.widthFt || 30) / 2;
    const halfD = (config.depthFt || 30) / 2;

    let obsList = (config.obstacles || []).filter(o => o.id !== 'mumty');
    if (newLoc !== 'none') {
      let mx = -halfW + mumtyW / 2;
      let mz = halfD - mumtyD / 2;
      if (newLoc === 'bottom-left') {
        mx = -halfW + mumtyW / 2;
        mz = halfD - mumtyD / 2;
      } else if (newLoc === 'top-left') {
        mx = -halfW + mumtyW / 2;
        mz = -halfD + mumtyD / 2;
      } else if (newLoc === 'top-right') {
        mx = halfW - mumtyW / 2;
        mz = -halfD + mumtyD / 2;
      } else if (newLoc === 'bottom-right') {
        mx = halfW - mumtyW / 2;
        mz = halfD - mumtyD / 2;
      }

      obsList.push({
        id: 'mumty',
        name: 'Staircase Mumty (सीढ़ी)',
        type: 'box',
        location: newLoc,
        widthFt: mumtyW,
        depthFt: mumtyD,
        heightFt: mumtyH,
        xRelFt: Number(mx.toFixed(1)),
        zRelFt: Number(mz.toFixed(1)),
        shadowLengthFt: 9.1
      });
    }

    const updated = { ...config, obstacles: obsList };
    setConfig(updated);
    if (onSaveRoofConfig) onSaveRoofConfig(updated);
  };

  // AI Vision Scan function (Optional on-demand)
  const handleRunAIScan = async (imgData) => {
    const dataUrl = imgData || uploadPreview;
    if (!dataUrl) return;

    setIsScanning(true);
    setScanStatusMessage('Connecting to Google Gemini Vision AI to analyze drawing...');

    try {
      const result = await scanRoofSketch(dataUrl, geminiKey);
      setIsScanning(false);

      if (result && result.success && result.data) {
        const d = result.data;

        const pHeight = parseFloat(d.parapetHeightFt) || 3.0;
        const mLoc = d.mumty?.location || 'none';
        const mW = parseFloat(d.mumty?.widthFt) || 4;
        const mD = parseFloat(d.mumty?.depthFt) || 7;
        const mH = parseFloat(d.mumty?.heightFt) || 7;

        setMumtyLoc(mLoc);
        setMumtyW(mW);
        setMumtyD(mD);
        setMumtyH(mH);
        setHasWaterTank(Boolean(d.waterTank?.detected));

        let newVerts = d.customVertices;
        if (!newVerts || !Array.isArray(newVerts) || newVerts.length < 3) {
          newVerts = [
            { x: -15, z: -15, label: 'NW' },
            { x: 15, z: -15, label: 'NE' },
            { x: 15, z: 15, label: 'SE' },
            { x: -15, z: 15, label: 'SW' }
          ];
        }

        const xs = newVerts.map(v => v.x);
        const zs = newVerts.map(v => v.z);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);
        const wTotal = Math.max(parseFloat(d.widthFt) || 0, Math.round(maxX - minX));
        const dTotal = Math.max(parseFloat(d.depthFt) || 0, Math.round(maxZ - minZ));
        const halfW = wTotal / 2;
        const halfD = dTotal / 2;

        let newObstacles = [];
        if (mLoc && mLoc !== 'none') {
          let mx = -halfW + mW / 2;
          let mz = halfD - mD / 2;
          if (mLoc === 'top-left') {
            mx = -halfW + mW / 2;
            mz = -halfD + mD / 2;
          } else if (mLoc === 'top-right') {
            mx = halfW - mW / 2;
            mz = -halfD + mD / 2;
          }
          newObstacles.push({
            id: 'mumty',
            name: d.mumty?.name || 'Staircase Mumty (सीढ़ी)',
            type: 'box',
            location: mLoc,
            widthFt: mW,
            depthFt: mD,
            heightFt: mH,
            xRelFt: Number(mx.toFixed(1)),
            zRelFt: Number(mz.toFixed(1)),
            shadowLengthFt: 9.1
          });
        }

        if (d.waterTank?.detected) {
          newObstacles.push({
            id: 'tanki',
            name: 'Water Tank (पानी की टंकी)',
            type: 'cylinder',
            radiusFt: d.waterTank.radiusFt || 1.8,
            heightFt: d.waterTank.heightFt || 3,
            xRelFt: -halfW + 4,
            zRelFt: halfD - 4,
            shadowLengthFt: 4.0
          });
        }

        const safeZone = {
          centerXFt: Number(((minX + maxX) / 2).toFixed(1)),
          centerZFt: Number((minZ + (maxZ - minZ) * 0.35).toFixed(1)),
          availableWidthFt: Math.max(16, Math.round(wTotal * 0.75)),
          availableDepthFt: Math.max(16, Math.round(dTotal * 0.45)),
          description: '100% Shadow-Free Open Terrace (South Sunlight)'
        };

        const updated = {
          type: 'custom_polygon',
          name: d.roofName || `Uploaded Sketch (${wTotal}×${dTotal} ft)`,
          widthFt: wTotal,
          depthFt: dTotal,
          parapetHeightFt: pHeight,
          parapetThicknessInches: 9,
          southDirection: 'top',
          customVertices: newVerts,
          walls: d.walls || [],
          corners: d.corners || [],
          obstacles: newObstacles,
          safeSolarZone: safeZone,
          uploadedImage: dataUrl,
          isPendingUpload: false
        };

        setConfig(updated);
        if (onSaveRoofConfig) onSaveRoofConfig(updated);
        setBlueprintViewMode('tracer');

        setScanResult({
          success: true,
          provider: result.modelUsed,
          message: `Sketch Analyzed by ${result.modelUsed}!`,
          explanation: d.explanation,
          wallsCount: d.walls?.length || newVerts.length,
          obstaclesDetected: (d.mumty?.detected ? 1 : 0) + (d.waterTank?.detected ? 1 : 0),
          parapetHeight: `${pHeight} ft`
        });
      } else {
        setScanResult({
          success: false,
          message: result?.error || 'AI scan unavailable. Please trace corners using the Pen Tool directly!'
        });
      }
    } catch (err) {
      setIsScanning(false);
      setScanResult({
        success: false,
        message: 'AI scan error: ' + (err.message || 'Unknown error') + '. Please use the Pen Tool to trace directly!'
      });
    }
  };

  // Real Image Upload handler - Instantly opens Photoshop Pen Tool Tracer (Zero API dependency!)
  const handleImageUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const dataUrl = event.target?.result;
      setUploadPreview(dataUrl);
      setScanResult(null);

      // Instantly open the Pen Tool Tracer over the photo!
      const updated = {
        ...config,
        uploadedImage: dataUrl,
        isPendingUpload: false
      };
      setConfig(updated);
      if (onSaveRoofConfig) onSaveRoofConfig(updated);
      setBlueprintViewMode('tracer');
    };
    reader.readAsDataURL(file);
  };

  // Traced geometry callback from InteractiveImageRoofTracer
  const handleApplyTracedGeometry = tracedData => {
    if (!tracedData || !tracedData.customVertices || tracedData.customVertices.length < 3) return;
    const xs = tracedData.customVertices.map(v => v?.x ?? 0);
    const zs = tracedData.customVertices.map(v => v?.z ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const wTotal = Math.max(10, Math.round(maxX - minX));
    const dTotal = Math.max(10, Math.round(maxZ - minZ));

    const safeZone = {
      centerXFt: Number(((minX + maxX) / 2).toFixed(1)),
      centerZFt: Number((minZ + (maxZ - minZ) * 0.35).toFixed(1)),
      availableWidthFt: Math.max(16, Math.round(wTotal * 0.75)),
      availableDepthFt: Math.max(16, Math.round(dTotal * 0.45)),
      description: '100% Shadow-Free Open Terrace (South Sunlight)'
    };

    const pHeight = parseFloat(tracedData.parapetHeightFt) || config.parapetHeightFt || 3.0;

    const wallsWithPoints = (tracedData.walls || []).map((w, idx) => ({
      ...w,
      p1: w.p1 || tracedData.customVertices[idx] || { x: 0, z: 0 },
      p2: w.p2 || tracedData.customVertices[(idx + 1) % tracedData.customVertices.length] || { x: 0, z: 0 }
    }));

    const updated = {
      ...config,
      type: 'custom_polygon',
      name: `Traced Roof (${wTotal}×${dTotal} ft)`,
      widthFt: wTotal,
      depthFt: dTotal,
      parapetHeightFt: pHeight,
      customVertices: tracedData.customVertices,
      walls: wallsWithPoints,
      corners: tracedData.corners,
      obstacles: tracedData.obstacles || config.obstacles || [],
      safeSolarZone: safeZone,
      isPendingUpload: false
    };

    setConfig(updated);
    if (onSaveRoofConfig) onSaveRoofConfig(updated);
    setBlueprintViewMode('cad');
  };

  // Start fresh on a blank millimeter CAD blueprint grid (No sketch upload needed!)
  const handleStartBlankGridCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dark CAD blueprint background
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Fine grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Major grid (100px)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Compass & instructions
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('📐 SUNVINE CAD MILLIMETER BLANK CANVAS — POINT-TO-POINT PEN TOOL', 30, 35);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Click anywhere to place corners P1, P2, P3... then close loop on P1 to set dimensions & 3D view', 30, 55);
    }
    const dataUrl = canvas.toDataURL('image/png');
    setUploadPreview(dataUrl);
    setScanResult(null);

    const updated = {
      ...DEFAULT_ROOF_CONFIG,
      name: 'Custom CAD Grid Rooftop',
      uploadedImage: dataUrl,
      isPendingUpload: false,
      corners: [],
      walls: [],
      customVertices: null
    };

    setConfig(updated);
    if (onSaveRoofConfig) onSaveRoofConfig(updated);
    setBlueprintViewMode('tracer');
  };

  const handleClearDrawing = () => {
    setConfig(DEFAULT_ROOF_CONFIG);
    setUploadPreview(null);
    setScanResult(null);
    if (onSaveRoofConfig) onSaveRoofConfig(DEFAULT_ROOF_CONFIG);
  };

  return (
    <div className="flex flex-col w-full bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F1B2E] via-[#1E293B] to-[#0F1B2E] border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[26px]">roofing</span>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Roof Sketch Analyzer &amp; Obstacles Studio
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#6CBF3D]/20 text-[#6CBF3D] border border-[#6CBF3D]/40 uppercase">
              100% Dynamic AI CAD
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            हाथ से बनी किसी भी ड्रॉइंग या ब्लू-प्रिंट की फ़ोटो अपलोड करें। Google Gemini Vision AI असली दीवारों के माप निकाल कर 2D ब्लूप्रिंट व 3D मॉडल तैयार करता है।
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          {onOpen3D && (
            <button
              type="button"
              onClick={onOpen3D}
              className="px-4 py-2 rounded-xl bg-[#6CBF3D] hover:bg-[#5ca633] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
              <span>Open in 3D Model</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload' ? 'bg-[#6CBF3D] text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">document_scanner</span>
            <span>1. Upload Sketch / Site Photo (AI Auto-Scan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'manual' ? 'bg-[#6CBF3D] text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">straighten</span>
            <span>2. Wall Measurements ({walls.length} Walls)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'analysis' ? 'bg-[#6CBF3D] text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">wb_sunny</span>
            <span>3. Mumty &amp; Shadow Analysis</span>
          </button>
        </div>

        {/* Live Metrics Badge */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            Terrace Area: <b className="text-white font-mono">{estimatedAreaSqFt} sq.ft</b>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            Perimeter: <b className="text-[#6CBF3D] font-mono">{totalPerimeterFt} ft</b>
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Active Drawing Card / Actions */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[#6CBF3D] text-[20px] shrink-0">
                {uploadPreview ? 'image' : 'pending'}
              </span>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {uploadPreview ? (config.name || 'Uploaded Sketch') : 'No Drawing Uploaded Yet'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {uploadPreview ? `${walls.length} walls detected from drawing` : 'Upload a drawing below to begin'}
                </span>
              </div>
            </div>

            {uploadPreview ? (
              <button
                type="button"
                onClick={handleClearDrawing}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-950/50 rounded-lg border border-rose-500/30 cursor-pointer shrink-0 transition-colors"
              >
                Clear / New
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBlankGridCanvas}
                className="px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-950/50 rounded-lg border border-cyan-500/30 cursor-pointer shrink-0 transition-colors flex items-center gap-1"
                title="Start drawing roof boundaries directly on a blank CAD millimeter grid"
              >
                <span className="material-symbols-outlined text-[14px]">grid_4x4</span>
                <span>Blank Grid</span>
              </button>
            )}
          </div>

          {/* TAB 1: Upload Sketch Photo with Real AI Vision */}
          {activeTab === 'upload' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
              {/* AI Engine Status & Key Setting */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#6CBF3D]">neurology</span>
                    <span className="text-xs font-bold text-white">AI Vision Engine:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✨ Google Gemini Vision AI Active
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowApiKeySetting(!showApiKeySetting)}
                    className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">key</span>
                    <span>{geminiKey ? 'API Key Settings' : '+ Set Key'}</span>
                  </button>
                </div>

                {showApiKeySetting && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                    <p className="text-[10px] text-slate-400">
                      Google AI Studio Gemini key (100% Free). Custom API Key can be entered below:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="Paste Google Gemini API Key"
                        value={tempApiKey}
                        onChange={e => setTempApiKey(e.target.value)}
                        className="flex-1 h-8 px-2.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white outline-none focus:border-[#6CBF3D]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveApiKey}
                        className="h-8 px-3 rounded bg-[#6CBF3D] hover:bg-[#5ca633] text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                      >
                        Save
                      </button>
                      {geminiKey && (
                        <button
                          type="button"
                          onClick={handleClearApiKey}
                          className="h-8 px-2.5 rounded bg-rose-900/50 hover:bg-rose-800 text-rose-300 text-xs cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-[#6CBF3D] rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-950 group"
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {isScanning ? (
                  <div className="flex flex-col items-center gap-2.5 py-4">
                    <div className="w-9 h-9 border-4 border-[#6CBF3D] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-emerald-400 animate-pulse">{scanStatusMessage}</span>
                    <span className="text-[10px] text-slate-400">Extracting walls, orientation &amp; generating CAD boundary...</span>
                  </div>
                ) : uploadPreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={uploadPreview} alt="Uploaded Roof Sketch" className="max-h-40 rounded-lg border border-slate-800 shadow-md object-contain" />
                    <span className="text-[11px] font-bold text-[#6CBF3D] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">change_circle</span>
                      <span>Click to Upload a Different Drawing / Photo</span>
                    </span>
                  </div>
                ) : (
                  <div className="py-4">
                    <span className="material-symbols-outlined text-4xl text-[#6CBF3D] mb-1 group-hover:scale-110 transition-transform">
                      cloud_upload
                    </span>
                    <span className="text-xs font-bold text-white block">
                      Click to Upload Rooftop Sketch / Drawing / Site Photo
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      No API key needed! Trace instantly with Photoshop Pen Tool.
                    </span>
                  </div>
                )}
              </div>

              {/* Draw on Blank CAD Grid (Zero image required) */}
              {!uploadPreview && !isScanning && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-slate-850"></div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">OR</span>
                    <div className="flex-1 h-px bg-slate-850"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartBlankGridCanvas}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-950/80 to-slate-900 hover:from-cyan-900 hover:to-slate-800 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-cyan-500/30 hover:border-cyan-400/50 cursor-pointer shadow-md transition-all group"
                  >
                    <span className="material-symbols-outlined text-[18px] text-cyan-400 group-hover:scale-110 transition-transform">
                      grid_4x4
                    </span>
                    <span>Draw on Blank CAD Grid (बिना फ़ोटो डायरेक्ट नाप खींचें)</span>
                  </button>
                </>
              )}

              {/* Optional AI Auto-Scan Button */}
              {uploadPreview && !isScanning && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunAIScan(uploadPreview)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 cursor-pointer shadow-sm transition-all"
                    title="Optional: Ask Google Gemini AI to auto-read dimensions from sketch"
                  >
                    <span className="material-symbols-outlined text-[16px]">neurology</span>
                    <span>Optional: Try AI Auto-Scan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlueprintViewMode('tracer')}
                    className="py-2 px-3 rounded-xl bg-[#6CBF3D] hover:bg-[#5ca633] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">colorize</span>
                    <span>Open Pen Tool</span>
                  </button>
                </div>
              )}

              {/* AI Extraction Results Summary Card */}
              {scanResult && scanResult.success && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">verified</span>
                      <span>AI Extracted Blueprint Details:</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300">
                      {scanResult.provider}
                    </span>
                  </div>

                  {scanResult.explanation && (
                    <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                      💡 {scanResult.explanation}
                    </p>
                  )}

                  {/* Dynamic Walls Grid */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Extracted Walls ({walls.length}):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {walls.map((w, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedWallIndex(selectedWallIndex === idx ? null : idx)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedWallIndex === idx
                              ? 'bg-[#6CBF3D]/20 border-[#6CBF3D]'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-300">Side {w.index}</span>
                            <span className="font-mono font-bold text-[#6CBF3D]">{w.lengthFt} ft</span>
                          </div>
                          <span className="text-[9px] text-slate-500 block truncate">{w.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {scanResult && !scanResult.success && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-[18px]">error</span>
                  <span>{scanResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Dynamic Wall Measurements Table */}
          {activeTab === 'manual' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="text-xs font-bold text-white block">
                    All Detected Walls ({walls.length} दीवारें):
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Click any side to highlight or adjust length in feet
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#6CBF3D]">{walls.length} Segments</span>
              </div>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {walls.map((w, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border transition-all ${
                      selectedWallIndex === idx
                        ? 'bg-[#6CBF3D]/20 border-[#6CBF3D]'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0" onClick={() => setSelectedWallIndex(selectedWallIndex === idx ? null : idx)}>
                        <span className="text-xs font-bold text-slate-200 block">Side {w.index}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{w.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="200"
                          value={w.lengthFt}
                          onChange={e => handleUpdateWallLength(idx, e.target.value)}
                          className="w-16 h-7 text-center font-mono font-bold text-xs text-[#6CBF3D] rounded bg-slate-900 border border-slate-700 outline-none focus:border-[#6CBF3D]"
                        />
                        <span className="text-xs text-slate-400 font-bold">ft</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Obstacles & Shadow Analysis */}
          {activeTab === 'analysis' && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">Obstacles Setup (सीढ़ी व टंकी):</span>
                <span className="text-[10px] text-slate-400">Shadow casts towards North</span>
              </div>

              {/* Mumty Room */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">stairs</span>
                    Staircase Mumty (सीढ़ी का कमरा)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Position:</label>
                    <select
                      value={mumtyLoc}
                      onChange={e => handleMumtyLocationChange(e.target.value)}
                      className="w-full h-8 px-2 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
                    >
                      <option value="none">❌ No Mumty (कोई सीढ़ी नहीं)</option>
                      <option value="bottom-left">📍 Bottom-Left (नीचे बायाँ)</option>
                      <option value="top-left">📍 Top-Left (ऊपर बायाँ)</option>
                      <option value="top-right">📍 Top-Right (ऊपर दायाँ)</option>
                      <option value="bottom-right">📍 Bottom-Right (नीचे दायाँ)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1">Width</label>
                      <input
                        type="number"
                        value={mumtyW}
                        onChange={e => setMumtyW(parseFloat(e.target.value) || 4)}
                        className="w-full h-8 text-center px-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1">Depth</label>
                      <input
                        type="number"
                        value={mumtyD}
                        onChange={e => setMumtyD(parseFloat(e.target.value) || 7)}
                        className="w-full h-8 text-center px-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-1">Height</label>
                      <input
                        type="number"
                        value={mumtyH}
                        onChange={e => setMumtyH(parseFloat(e.target.value) || 7)}
                        className="w-full h-8 text-center px-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Water Tank */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">water_drop</span>
                  Water Tank (पानी की टंकी)
                </span>
                <button
                  type="button"
                  onClick={() => setHasWaterTank(!hasWaterTank)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    hasWaterTank ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-700'
                  }`}
                >
                  {hasWaterTank ? '✓ Present' : 'None'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column (7 Cols): 2D Blueprint SVG */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">architecture</span>
              <span className="font-bold text-white">2D Blueprint: Real Roof Geometry</span>
            </div>

            {uploadPreview && (
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] gap-1">
                <button
                  type="button"
                  onClick={() => setBlueprintViewMode('cad')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    blueprintViewMode === 'cad' ? 'bg-[#6CBF3D] text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">architecture</span>
                  <span>2D CAD Blueprint</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBlueprintViewMode('tracer')}
                  className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    blueprintViewMode === 'tracer' ? 'bg-[#6CBF3D] text-slate-950 shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">gesture</span>
                  <span>Draw / Trace on Photo (Auto-Straight)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2D Viewport */}
          <div className="w-full flex-1 min-h-[440px] flex items-center justify-center bg-[#070D18] rounded-xl border border-slate-800/80 p-2 relative overflow-hidden">
            {blueprintViewMode === 'tracer' && uploadPreview ? (
              <InteractiveImageRoofTracer
                imageUrl={uploadPreview}
                initialCorners={config.corners || []}
                initialWalls={config.walls || walls}
                initialParapetHeight={config.parapetHeightFt || 3.0}
                onApplyGeometry={handleApplyTracedGeometry}
                onSidesChange={handleTracerSidesChange}
                onClose={() => setBlueprintViewMode('cad')}
              />
            ) : config.isPendingUpload && !uploadPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-800 rounded-2xl cursor-pointer hover:border-[#6CBF3D]/50 transition-colors"
              >
                <span className="material-symbols-outlined text-5xl text-[#6CBF3D]/60">roofing</span>
                <div className="text-center">
                  <span className="text-sm font-bold text-slate-200 block">No Sketch Uploaded Yet</span>
                  <span className="text-xs text-slate-400 block mt-1">
                    Click here to upload your hand-drawn notebook drawing or site photo
                  </span>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-[#6CBF3D] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <span className="material-symbols-outlined text-[16px]">upload</span>
                  <span>Upload Roof Drawing</span>
                </button>
              </div>
            ) : (
              <RenderRoofBlueprintSvg
                vertices={vertices}
                walls={walls}
                obstacles={obstacles}
                safeZone={config.safeSolarZone}
                selectedWallIndex={selectedWallIndex}
                onSelectWall={setSelectedWallIndex}
              />
            )}
          </div>

          {/* Legend Bar */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#334155] border border-[#F59E0B]"></span>
                <span>Mumty Room (सीढ़ी)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#6CBF3D]/25 border border-[#6CBF3D]"></span>
                <span>Safe Solar Zone (धूप)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#1E3E62] border border-blue-400"></span>
                <span>Solar Array (3×2)</span>
              </span>
            </div>

            <span className="text-[#6CBF3D] font-bold">
              🧭 True South: Top Wall (180°)
            </span>
          </div>

          {onProceedTo2D && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-slate-400">
                Next: Select solar modules count and compare 2D grid layouts
              </span>
              <button
                type="button"
                onClick={onProceedTo2D}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <span>Proceed to Step 2: Choose 2D Solar Layout</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 2D Blueprint SVG with Obstacles, North Shadow Projections, and Solar Array Mount
 */
function RenderRoofBlueprintSvg({ vertices, walls, obstacles = [], safeZone = null, selectedWallIndex, onSelectWall }) {
  const svgWidth = 480;
  const svgHeight = 380;
  const padding = 50;

  // Calculate bounding box
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  vertices.forEach(v => {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  });

  const spanX = maxX - minX || 1;
  const spanZ = maxZ - minZ || 1;
  const scale = Math.min((svgWidth - padding * 2) / spanX, (svgHeight - padding * 2) / spanZ);

  const toSvgX = x => svgWidth / 2 + x * scale;
  const toSvgY = z => svgHeight / 2 + z * scale;

  const polyPoints = vertices.map(v => `${toSvgX(v.x)},${toSvgY(v.z)}`).join(' ');

  return (
    <svg
      width="100%"
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="max-w-full drop-shadow-md overflow-visible relative z-10"
    >
      <defs>
        {/* Concrete Terrace Hatch */}
        <pattern id="terracePattern" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#1E293B" strokeWidth="1" />
        </pattern>

        {/* Diagonal Shadow Hatch */}
        <pattern id="shadowHatch" width="6" height="6" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(244,63,94,0.6)" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* 1. Concrete Terrace Slab */}
      <polygon
        points={polyPoints}
        fill="#0F172A"
        stroke="#334155"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon
        points={polyPoints}
        fill="url(#terracePattern)"
        opacity="0.5"
      />
      <polygon
        points={polyPoints}
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 2. Obstacles (Mumty & Water Tank) */}
      {obstacles.map(obs => {
        const ox = toSvgX(obs.xRelFt);
        const oz = toSvgY(obs.zRelFt);
        const shadowLenSvg = (obs.shadowLengthFt || 8) * scale;

        if (obs.type === 'box') {
          const bw = (obs.widthFt || 3) * scale;
          const bd = (obs.depthFt || 6) * scale;

          return (
            <g key={obs.id}>
              {/* Shadow falling towards North (downwards in top-South system) */}
              <rect
                x={ox - bw / 2}
                y={oz + bd / 2}
                width={bw}
                height={shadowLenSvg}
                fill="url(#shadowHatch)"
                stroke="rgba(244,63,94,0.4)"
                strokeDasharray="3 2"
              />

              {/* Mumty Room Box */}
              <rect
                x={ox - bw / 2}
                y={oz - bd / 2}
                width={bw}
                height={bd}
                fill="#334155"
                stroke="#F59E0B"
                strokeWidth="1.5"
                rx="2"
              />
              <text
                x={ox}
                y={oz + 3}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="8"
                fontWeight="bold"
              >
                MUMTY
              </text>
            </g>
          );
        }

        if (obs.type === 'cylinder') {
          const r = (obs.radiusFt || 1.8) * scale;
          return (
            <g key={obs.id}>
              <circle cx={ox} cy={oz} r={r} fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
              <text x={ox} y={oz + 3} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
                TANKI
              </text>
            </g>
          );
        }
        return null;
      })}

      {/* 3. Optimal Shadow-Free Zone & Solar Array Footprint */}
      {safeZone && (
        <g>
          {/* Safe Green Zone Rect */}
          <rect
            x={toSvgX(safeZone.centerXFt) - (safeZone.availableWidthFt * scale) / 2}
            y={toSvgY(safeZone.centerZFt) - (safeZone.availableDepthFt * scale) / 2}
            width={safeZone.availableWidthFt * scale}
            height={safeZone.availableDepthFt * scale}
            fill="rgba(108, 191, 61, 0.12)"
            stroke="#6CBF3D"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            rx="4"
          />

          {/* Centered Solar Array (3x2 Table Footprint) */}
          <rect
            x={toSvgX(safeZone.centerXFt) - (11.2 * scale) / 2}
            y={toSvgY(safeZone.centerZFt) - (15.0 * scale) / 2}
            width={11.2 * scale}
            height={15.0 * scale}
            fill="#1E3E62"
            stroke="#38BDF8"
            strokeWidth="2"
            rx="2"
          />
          <text
            x={toSvgX(safeZone.centerXFt)}
            y={toSvgY(safeZone.centerZFt) - 2}
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="bold"
          >
            SOLAR ARRAY
          </text>
          <text
            x={toSvgX(safeZone.centerXFt)}
            y={toSvgY(safeZone.centerZFt) + 11}
            textAnchor="middle"
            fill="#6CBF3D"
            fontSize="8"
            fontWeight="bold"
          >
            ✓ 100% Shadow Free
          </text>
        </g>
      )}

      {/* 4. Wall Dimensions Overlay */}
      {walls.map((w, idx) => {
        const p1 = w?.p1 || (vertices && vertices[idx]) || { x: 0, z: 0 };
        const p2 = w?.p2 || (vertices && vertices[(idx + 1) % (vertices.length || 1)]) || { x: 0, z: 0 };
        const x1 = toSvgX(p1.x ?? 0);
        const y1 = toSvgY(p1.z ?? 0);
        const x2 = toSvgX(p2.x ?? 0);
        const y2 = toSvgY(p2.z ?? 0);

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const isSelected = selectedWallIndex === idx;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const normalX = -dy / (len || 1);
        const normalY = dx / (len || 1);

        const offsetDist = 18;
        const labelX = midX + normalX * offsetDist;
        const labelY = midY + normalY * offsetDist;

        return (
          <g key={idx} onClick={() => onSelectWall && onSelectWall(isSelected ? null : idx)} className="cursor-pointer">
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isSelected ? '#6CBF3D' : '#38BDF8'}
              strokeWidth={isSelected ? 4 : 2}
            />

            <circle cx={x1} cy={y1} r={3} fill="#38BDF8" />

            <g transform={`translate(${labelX}, ${labelY})`}>
              <rect
                x="-24"
                y="-9"
                width="48"
                height="18"
                fill={isSelected ? '#6CBF3D' : '#0F172A'}
                stroke={isSelected ? '#6CBF3D' : '#38BDF8'}
                strokeWidth="1"
                rx="4"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill={isSelected ? '#020617' : '#38BDF8'}
                fontSize="9"
                fontWeight="900"
                fontFamily="monospace"
              >
                {w.lengthFt}&apos;
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
