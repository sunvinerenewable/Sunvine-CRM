/**
 * Solar Structure & 2D Panel Layout Engine
 * Generates all dynamic mounting combinations (Pure Portrait, Pure Landscape, Hybrid Khadi+Aadi, Dual Tables)
 * Computes exact array dimensions, J-Bolts, Clamps, Legs, and Foundation Hardware.
 */

export const DEFAULT_MODULE_DIMS = {
  lengthMm: 2278, // ~2.28m standard 550W-600W
  widthMm: 1134,  // ~1.13m standard 550W-600W
  thicknessMm: 30,
  weightKg: 28.5
};

export const mmToMeters = (valMm) => ((valMm || 0) / 1000).toFixed(2);
export const mmToFeet = (valMm) => ((valMm || 0) / 304.8).toFixed(1);
export const sqMmToSqFt = (valSqMm) => ((valSqMm || 0) / 92903.04).toFixed(1);

/**
 * Parses dimensions string like "2278 × 1134 × 30 mm" from hardware master
 */
export function parseModuleDimensions(dimStr) {
  if (!dimStr) return DEFAULT_MODULE_DIMS;
  const numbers = String(dimStr).match(/\d+(\.\d+)?/g);
  if (numbers && numbers.length >= 2) {
    const parsedA = parseFloat(numbers[0]) || DEFAULT_MODULE_DIMS.lengthMm;
    const parsedB = parseFloat(numbers[1]) || DEFAULT_MODULE_DIMS.widthMm;
    const parsedT = numbers.length >= 3 ? (parseFloat(numbers[2]) || 30) : 30;
    return {
      lengthMm: Math.max(parsedA, parsedB), // Length is always longer edge
      widthMm: Math.min(parsedA, parsedB),  // Width is shorter edge
      thicknessMm: parsedT,
      weightKg: 28.5
    };
  }
  return DEFAULT_MODULE_DIMS;
}

/**
 * Calculates Hardware BOM for a given layout
 */
export function calculateHardwareBOM(layout) {
  const totalPanels = layout.totalPanels || 6;
  
  // 1. J-Bolts: 4 per panel in standard C-channel / GI structures
  const jBoltsCount = totalPanels * 4;

  // 2. Aluminium Clamps
  let midClampsCount = 0;
  let endClampsCount = 0;

  if (layout.rows && layout.rows.length > 0) {
    layout.rows.forEach(row => {
      const panelCountInRow = Array.isArray(row) ? row.length : (row.panelsCount || 1);
      // Each row has 4 end clamps (2 on left edge, 2 on right edge)
      endClampsCount += 4;
      // Between each adjacent panel pair in a row, 2 mid-clamps
      if (panelCountInRow > 1) {
        midClampsCount += (panelCountInRow - 1) * 2;
      }
    });
  } else {
    // Fallback estimation
    endClampsCount = 4;
    midClampsCount = Math.max(0, (totalPanels - 1) * 2);
  }

  // 3. Structure Columns / Legs (Front Legs & Rear Legs)
  // Typically 1 leg pair every 2.5m - 3.2m of table width, with min 2 leg pairs (4 legs)
  const arrayWidthMeters = (layout.widthMm || 2278) / 1000;
  const legPairs = Math.max(2, Math.ceil(arrayWidthMeters / 2.8) + 1);
  const totalLegs = legPairs * 2; // Front + Rear

  // 4. Base Plates & Anchor Fasteners
  // 4 wedge anchor fasteners per civil foundation leg
  const basePlatesCount = totalLegs;
  const anchorFastenersCount = totalLegs * 4;
  const lAnglesCount = totalLegs * 2;

  // 5. Hardware fasteners (Hex bolt + nut + plain + spring washers)
  const fastenerSetsCount = (jBoltsCount + midClampsCount + endClampsCount + (totalLegs * 6));

  // 6. MC4 Connectors calculation (Research based)
  // Each module comes with factory pre-attached leads that plug directly in series.
  // External MC4 connectors are needed for:
  // - 1 Pair (1 Male + 1 Female) for Inverter DC Home-Run termination per string
  // - 1 Pair for jumper cables if the array is split into separate tables
  const isMultiString = totalPanels > 12;
  const homeRunPairs = isMultiString ? 2 : 1;
  const jumperPairs = layout.isSplit ? 1 : 0;
  const mc4Pairs = homeRunPairs + jumperPairs;
  const mc4ConnectorsCount = mc4Pairs * 2; // Each pair = 1 Male + 1 Female

  return {
    jBoltsCount,
    midClampsCount,
    endClampsCount,
    totalClamps: midClampsCount + endClampsCount,
    mc4Pairs,
    mc4ConnectorsCount,
    frontLegs: legPairs,
    rearLegs: legPairs,
    totalLegs,
    basePlatesCount,
    anchorFastenersCount,
    lAnglesCount,
    fastenerSetsCount,
    estimatedSteelWeightKg: Math.round(totalPanels * 22.5) // approx 22.5 kg structural steel per panel
  };
}

/**
 * Calculates Leg Heights and Elevation profile
 */
export function calculateLegHeights(layout, frontLegHeightFt = 2.5, tiltDegrees = 18) {
  const depthFt = (layout.depthMm || 2278) / 304.8;
  const tiltRad = (tiltDegrees * Math.PI) / 180;
  const deltaHeightFt = Number((depthFt * Math.sin(tiltRad)).toFixed(2));
  const rearLegHeightFt = Number((frontLegHeightFt + deltaHeightFt).toFixed(2));
  const slopeLengthFt = Number((depthFt / Math.cos(tiltRad)).toFixed(2));

  return {
    tiltDegrees,
    frontLegHeightFt: Number(frontLegHeightFt.toFixed(2)),
    rearLegHeightFt,
    deltaHeightFt,
    slopeLengthFt,
    frontLegHeightMm: Math.round(frontLegHeightFt * 304.8),
    rearLegHeightMm: Math.round(rearLegHeightFt * 304.8)
  };
}

/**
 * 1D Bin Packing Cutting Optimization for Standard 20-ft GI Pipes
 */
function packCutsIntoPipes(cuts, pipeLengthFt = 20) {
  const sorted = [...cuts].sort((a, b) => b.lengthFt - a.lengthFt);
  const pipes = [];

  sorted.forEach(cut => {
    let placed = false;
    for (const p of pipes) {
      if (p.remainingFt >= cut.lengthFt) {
        p.cuts.push(cut);
        p.usedFt = Number((p.usedFt + cut.lengthFt).toFixed(2));
        p.remainingFt = Number((pipeLengthFt - p.usedFt).toFixed(2));
        placed = true;
        break;
      }
    }
    if (!placed) {
      pipes.push({
        pipeIndex: pipes.length + 1,
        totalLengthFt: pipeLengthFt,
        usedFt: Number(cut.lengthFt.toFixed(2)),
        remainingFt: Number((pipeLengthFt - cut.lengthFt).toFixed(2)),
        cuts: [cut]
      });
    }
  });

  return pipes;
}

/**
 * Calculates GI Pipe Cuts and Quantities (60x40 for Columns/Legs & 40x40 for Rafters/Purlins)
 */
export function calculateGiPipeSections(layout, frontLegHeightFt = 2.5, tiltDegrees = 18, customLegPairs = null) {
  const elevation = calculateLegHeights(layout, frontLegHeightFt, tiltDegrees);
  const legPairs = customLegPairs !== null && customLegPairs !== undefined
    ? Number(customLegPairs)
    : (layout.bom?.frontLegs || 2);
  const arrayWidthFt = (layout.widthMm || 2278) / 304.8;
  const rowCount = layout.rows?.length || 1;

  // 1. 60x40 mm Pipe Cuts (Legs / Columns)
  const cuts60x40 = [];
  for (let i = 0; i < legPairs; i++) {
    cuts60x40.push({ id: `R${i + 1}`, label: `Rear Leg #${i + 1}`, lengthFt: elevation.rearLegHeightFt, type: 'rear_leg' });
    cuts60x40.push({ id: `F${i + 1}`, label: `Front Leg #${i + 1}`, lengthFt: elevation.frontLegHeightFt, type: 'front_leg' });
  }

  const pipes60x40 = packCutsIntoPipes(cuts60x40, 20);
  const totalLength60x40Ft = Number(cuts60x40.reduce((acc, c) => acc + c.lengthFt, 0).toFixed(1));

  // 2. 40x40 mm Pipe Cuts (Rafters + Purlins)
  const cuts40x40 = [];
  for (let i = 0; i < legPairs; i++) {
    if (elevation.slopeLengthFt > 20) {
      const half = Number((elevation.slopeLengthFt / 2).toFixed(2));
      cuts40x40.push({ id: `RAF_${i + 1}A`, label: `Rafter #${i + 1} (Sec A)`, lengthFt: half, type: 'rafter' });
      cuts40x40.push({ id: `RAF_${i + 1}B`, label: `Rafter #${i + 1} (Sec B)`, lengthFt: half, type: 'rafter' });
    } else {
      cuts40x40.push({ id: `RAF_${i + 1}`, label: `Rafter #${i + 1} (Slope)`, lengthFt: elevation.slopeLengthFt, type: 'rafter' });
    }
  }

  const totalPurlins = rowCount * 2;
  const purlinLenFt = Number(arrayWidthFt.toFixed(2));
  for (let i = 0; i < totalPurlins; i++) {
    if (purlinLenFt > 20) {
      const half = Number((purlinLenFt / 2).toFixed(2));
      cuts40x40.push({ id: `PUR_${i + 1}A`, label: `Purlin #${i + 1} (Sec A)`, lengthFt: half, type: 'purlin' });
      cuts40x40.push({ id: `PUR_${i + 1}B`, label: `Purlin #${i + 1} (Sec B)`, lengthFt: half, type: 'purlin' });
    } else {
      cuts40x40.push({ id: `PUR_${i + 1}`, label: `Purlin #${i + 1}`, lengthFt: purlinLenFt, type: 'purlin' });
    }
  }

  const pipes40x40 = packCutsIntoPipes(cuts40x40, 20);
  const totalLength40x40Ft = Number(cuts40x40.reduce((acc, c) => acc + c.lengthFt, 0).toFixed(1));

  return {
    elevation,
    pipeLengthStandardFt: 20,
    legs60x40: {
      totalPipesCount: pipes60x40.length,
      totalLengthFt: totalLength60x40Ft,
      totalPipesFeet: pipes60x40.length * 20,
      cuts: cuts60x40,
      pipes: pipes60x40
    },
    raftersPurlins40x40: {
      totalPipesCount: pipes40x40.length,
      totalLengthFt: totalLength40x40Ft,
      totalPipesFeet: pipes40x40.length * 20,
      cuts: cuts40x40,
      pipes: pipes40x40
    }
  };
}

/**
 * Generates all dynamic 2D mounting layout combinations for a given panel count N
 */
export function generateDynamicLayouts(panelCount, customDims = DEFAULT_MODULE_DIMS) {
  const n = parseInt(panelCount, 10);
  if (isNaN(n) || n <= 0) return [];

  const panelL = customDims?.lengthMm || DEFAULT_MODULE_DIMS.lengthMm;
  const panelW = customDims?.widthMm || DEFAULT_MODULE_DIMS.widthMm;
  const layouts = [];

  // ==========================================
  // 1. PURE PORTRAIT COMBINATIONS
  // ==========================================
  for (let r = 1; r <= n; r++) {
    if (n % r === 0) {
      const c = n / r;
      // Skip extreme vertical towers like 1 col x 12 rows unless total panels <= 4
      if (r > 6 && c === 1) continue;

      const calcWidthMm = c * panelW;
      const calcDepthMm = r * panelL;
      
      const rows = [];
      let panelIndex = 1;
      for (let rowIdx = 0; rowIdx < r; rowIdx++) {
        const rowPanels = [];
        for (let colIdx = 0; colIdx < c; colIdx++) {
          rowPanels.push({
            id: panelIndex,
            label: `P${panelIndex}`,
            fullLabel: `Panel ${panelIndex}`,
            orientation: 'portrait',
            widthMm: panelW,
            heightMm: panelL,
            row: rowIdx + 1,
            col: colIdx + 1
          });
          panelIndex++;
        }
        rows.push(rowPanels);
      }

      // Check if matches Excel presets for 6 panels
      let excelTag = null;
      let isRecommended = false;
      if (n === 6) {
        if (r === 2 && c === 3) {
          excelTag = 'Excel Design 1';
          isRecommended = true;
        } else if (r === 1 && c === 6) {
          excelTag = 'Excel Design 2';
          isRecommended = true;
        } else if (r === 3 && c === 2) {
          isRecommended = true;
        }
      } else if (r <= 3 && c <= 6) {
        isRecommended = true;
      }

      const layout = {
        id: `portrait_${r}x${c}`,
        type: 'portrait',
        category: 'Pure Portrait',
        name: r === 1 ? `1 Row × ${c} Panels (Single Line)` : `${r} Rows × ${c} Panels (${r}×${c} Grid)`,
        shortCode: `${r}R × ${c}C Portrait`,
        rowsCount: r,
        colsCount: c,
        totalPanels: n,
        widthMm: calcWidthMm,
        depthMm: calcDepthMm,
        areaSqM: (calcWidthMm * calcDepthMm) / 1000000,
        excelTag,
        isRecommended,
        rows
      };
      layout.bom = calculateHardwareBOM(layout);
      layouts.push(layout);
    }
  }

  // ==========================================
  // 2. PURE LANDSCAPE COMBINATIONS
  // ==========================================
  for (let r = 1; r <= n; r++) {
    if (n % r === 0) {
      const c = n / r;
      if (r > 6 && c === 1) continue;

      const calcWidthMm = c * panelL;
      const calcDepthMm = r * panelW;

      const rows = [];
      let panelIndex = 1;
      for (let rowIdx = 0; rowIdx < r; rowIdx++) {
        const rowPanels = [];
        for (let colIdx = 0; colIdx < c; colIdx++) {
          rowPanels.push({
            id: panelIndex,
            label: `P${panelIndex}`,
            fullLabel: `Panel ${panelIndex}`,
            orientation: 'landscape',
            widthMm: panelL,
            heightMm: panelW,
            row: rowIdx + 1,
            col: colIdx + 1
          });
          panelIndex++;
        }
        rows.push(rowPanels);
      }

      const isRecommended = (r <= 3 && c <= 5) || (r === 2 && c === 3);

      const layout = {
        id: `landscape_${r}x${c}`,
        type: 'landscape',
        category: 'Pure Landscape',
        name: r === 1 ? `1 Row × ${c} Panels Landscape` : `${r} Rows × ${c} Panels Landscape (${r}×${c} Grid)`,
        shortCode: `${r}R × ${c}C Landscape`,
        rowsCount: r,
        colsCount: c,
        totalPanels: n,
        widthMm: calcWidthMm,
        depthMm: calcDepthMm,
        areaSqM: (calcWidthMm * calcDepthMm) / 1000000,
        isRecommended,
        rows
      };
      layout.bom = calculateHardwareBOM(layout);
      layouts.push(layout);
    }
  }

  // ==========================================
  // 3. HYBRID COMBINATIONS (2:1 Symmetry)
  // 2 Portrait panels = 1 Landscape panel in width (2 x 1134mm = 2268mm ~= 2278mm)
  // ==========================================
  for (let k = 1; k < n; k++) {
    const p = n - k;
    if (p % 2 === 0) {
      // Case A: 1 row of p portrait, and 1 row of k landscape, where p = 2 * k
      if (p === 2 * k) {
        const colsP = p;
        const colsL = k;
        const calcWidthMm = Math.max(colsP * panelW, colsL * panelL);
        const calcDepthMm = panelL + panelW;

        // Config 1: Portrait on Top (North), Landscape at Bottom (South)
        let idx1 = 1;
        const row1P = [];
        for (let i = 0; i < colsP; i++) {
          row1P.push({ id: idx1, label: `P${idx1}`, fullLabel: `Panel ${idx1}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
          idx1++;
        }
        const row1L = [];
        for (let i = 0; i < colsL; i++) {
          row1L.push({ id: idx1, label: `P${idx1}`, fullLabel: `Panel ${idx1}`, orientation: 'landscape', widthMm: panelL, heightMm: panelW });
          idx1++;
        }

        const isExcel3 = (n === 6 && p === 4 && k === 2);

        const hybrid1 = {
          id: `hybrid_${p}P_${k}L_top`,
          type: 'hybrid',
          category: 'Hybrid',
          name: `Hybrid: ${p} Portrait (Top) + ${k} Landscape (Bottom)`,
          shortCode: `${p} Portrait + ${k} Landscape`,
          totalPanels: n,
          widthMm: calcWidthMm,
          depthMm: calcDepthMm,
          areaSqM: (calcWidthMm * calcDepthMm) / 1000000,
          excelTag: isExcel3 ? 'Excel Design 3' : null,
          isRecommended: true,
          rows: [row1P, row1L]
        };
        hybrid1.bom = calculateHardwareBOM(hybrid1);
        layouts.push(hybrid1);

        // Config 2: Landscape on Top (North), Portrait at Bottom (South)
        let idx2 = 1;
        const row2L = [];
        for (let i = 0; i < colsL; i++) {
          row2L.push({ id: idx2, label: `P${idx2}`, fullLabel: `Panel ${idx2}`, orientation: 'landscape', widthMm: panelL, heightMm: panelW });
          idx2++;
        }
        const row2P = [];
        for (let i = 0; i < colsP; i++) {
          row2P.push({ id: idx2, label: `P${idx2}`, fullLabel: `Panel ${idx2}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
          idx2++;
        }

        const hybrid2 = {
          id: `hybrid_${k}L_${p}P_bottom`,
          type: 'hybrid',
          category: 'Hybrid',
          name: `Hybrid: ${k} Landscape (Top) + ${p} Portrait (Bottom)`,
          shortCode: `${k} Landscape + ${p} Portrait`,
          totalPanels: n,
          widthMm: calcWidthMm,
          depthMm: calcDepthMm,
          areaSqM: (calcWidthMm * calcDepthMm) / 1000000,
          isRecommended: false,
          rows: [row2L, row2P]
        };
        hybrid2.bom = calculateHardwareBOM(hybrid2);
        layouts.push(hybrid2);
      }

      // Case B: 2 rows of portrait (2 x (p/2)) and 1 row of landscape (k)
      // e.g. p = 8 (2 rows of 4), k = 2 (1 row of 2 landscape) -> width = 4 x 1134 = 4.54m!
      const halfP = p / 2;
      if (halfP > 0 && halfP === 2 * k) {
        const calcWidthMm = Math.max(halfP * panelW, k * panelL);
        const calcDepthMm = (2 * panelL) + panelW;
        let idx3 = 1;
        const r1 = [];
        for (let i = 0; i < halfP; i++) {
          r1.push({ id: idx3, label: `P${idx3}`, fullLabel: `Panel ${idx3}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
          idx3++;
        }
        const r2 = [];
        for (let i = 0; i < halfP; i++) {
          r2.push({ id: idx3, label: `P${idx3}`, fullLabel: `Panel ${idx3}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
          idx3++;
        }
        const r3 = [];
        for (let i = 0; i < k; i++) {
          r3.push({ id: idx3, label: `P${idx3}`, fullLabel: `Panel ${idx3}`, orientation: 'landscape', widthMm: panelL, heightMm: panelW });
          idx3++;
        }

        const hybridMulti = {
          id: `hybrid_2x${halfP}P_${k}L`,
          type: 'hybrid',
          category: 'Hybrid',
          name: `Hybrid: 2 Rows of ${halfP} Portrait + 1 Row of ${k} Landscape`,
          shortCode: `2x${halfP} Portrait + ${k} Landscape`,
          totalPanels: n,
          widthMm: calcWidthMm,
          depthMm: calcDepthMm,
          areaSqM: (calcWidthMm * calcDepthMm) / 1000000,
          isRecommended: true,
          rows: [r1, r2, r3]
        };
        hybridMulti.bom = calculateHardwareBOM(hybridMulti);
        layouts.push(hybridMulti);
      }
    }
  }

  // ==========================================
  // 4. DUAL / SPLIT ARRAYS (2 Separate Tables)
  // For rooftops with obstacles (water tank, mumty, skylight)
  // ==========================================
  if (n >= 4 && n % 2 === 0) {
    const half = n / 2;
    // Table A & B in portrait
    const tableWidthMm = half * panelW;
    const tableDepthMm = panelL;

    let pIdx = 1;
    const tableA = [];
    for (let i = 0; i < half; i++) {
      tableA.push({ id: pIdx, label: `P${pIdx}`, fullLabel: `Panel ${pIdx}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
      pIdx++;
    }
    const tableB = [];
    for (let i = 0; i < half; i++) {
      tableB.push({ id: pIdx, label: `P${pIdx}`, fullLabel: `Panel ${pIdx}`, orientation: 'portrait', widthMm: panelW, heightMm: panelL });
      pIdx++;
    }

    const splitLayout = {
      id: `split_2tables_${half}`,
      type: 'split',
      category: 'Dual Table',
      name: `Dual Split Tables: 2 Separate Tables of ${half} Panels Each`,
      shortCode: `2 Tables × ${half} Panels`,
      totalPanels: n,
      widthMm: (tableWidthMm * 2) + 1200, // including 1.2m walkway clearance
      depthMm: tableDepthMm,
      areaSqM: ((tableWidthMm * tableDepthMm) * 2) / 1000000,
      isSplit: true,
      isRecommended: n >= 8,
      tables: [
        { name: 'Table A (West/North)', panels: tableA, widthMm: tableWidthMm, depthMm: tableDepthMm },
        { name: 'Table B (East/South)', panels: tableB, widthMm: tableWidthMm, depthMm: tableDepthMm }
      ],
      rows: [tableA, tableB]
    };
    splitLayout.bom = calculateHardwareBOM(splitLayout);
    layouts.push(splitLayout);
  }

  return layouts;
}

/**
 * Validates whether a solar layout fits inside the safe terrace boundaries of a given roof
 */
export function checkRoofFit(layout, roofConfig) {
  if (!layout) return { fits: true, reason: 'Valid layout' };

  const arrayWidthFt = Number(((layout.widthMm || 2278) / 304.8).toFixed(1));
  const arrayDepthFt = Number(((layout.depthMm || 1134) / 304.8).toFixed(1));

  // Determine available dimensions from roofConfig
  const safeZone = roofConfig?.safeSolarZone;
  let availWidthFt = 22;
  let availDepthFt = 20;

  if (safeZone?.availableWidthFt && safeZone?.availableDepthFt) {
    availWidthFt = Number(safeZone.availableWidthFt);
    availDepthFt = Number(safeZone.availableDepthFt);
  } else if (roofConfig?.type === 'rectangle') {
    const w = parseFloat(roofConfig.widthFt) || 36;
    const d = parseFloat(roofConfig.depthFt) || 26;
    availWidthFt = Math.max(10, w - 6); // 3ft clearance each side
    availDepthFt = Math.max(10, d - 6);
  }

  const widthClearanceFt = Number((availWidthFt - arrayWidthFt).toFixed(1));
  const depthClearanceFt = Number((availDepthFt - arrayDepthFt).toFixed(1));

  const widthFits = widthClearanceFt >= -0.1; // minor tolerance
  const depthFits = depthClearanceFt >= -0.1;
  const fits = widthFits && depthFits;

  let reason = '';
  if (fits) {
    reason = `Fits safely with ${widthClearanceFt}ft width & ${depthClearanceFt}ft depth safety clearance`;
  } else if (!widthFits && !depthFits) {
    reason = `Exceeds roof by ${Math.abs(widthClearanceFt)}ft width & ${Math.abs(depthClearanceFt)}ft depth`;
  } else if (!widthFits) {
    reason = `Width exceeds available terrace by ${Math.abs(widthClearanceFt)}ft (Req: ${arrayWidthFt}ft vs Avail: ${availWidthFt}ft)`;
  } else {
    reason = `Depth exceeds available terrace by ${Math.abs(depthClearanceFt)}ft (Req: ${arrayDepthFt}ft vs Avail: ${availDepthFt}ft)`;
  }

  return {
    fits,
    arrayWidthFt,
    arrayDepthFt,
    availableWidthFt: availWidthFt,
    availableDepthFt: availDepthFt,
    widthClearanceFt,
    depthClearanceFt,
    reason
  };
}
