import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * 8-Point Compass Direction Helper (Supports both 90° and Non-90° / Slanted / Diagonal Walls)
 */
function getCompassDirection(dx, dy) {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180 to 180
  const normalized = (angle + 360) % 360; // 0 to 360 (0 is East, 90 is South, 180 is West, 270 is North)

  if (normalized >= 337.5 || normalized < 22.5) return { code: 'E', label: 'East ➡️' };
  if (normalized >= 22.5 && normalized < 67.5) return { code: 'SE', label: 'South-East ↘️' };
  if (normalized >= 67.5 && normalized < 112.5) return { code: 'S', label: 'South ⬇️' };
  if (normalized >= 112.5 && normalized < 157.5) return { code: 'SW', label: 'South-West ↙️' };
  if (normalized >= 157.5 && normalized < 202.5) return { code: 'W', label: 'West ⬅️' };
  if (normalized >= 202.5 && normalized < 247.5) return { code: 'NW', label: 'North-West ↖️' };
  if (normalized >= 247.5 && normalized < 292.5) return { code: 'N', label: 'North ⬆️' };
  return { code: 'NE', label: 'North-East ↗️' };
}

/**
 * Interactive Image Roof Tracer with Photoshop Pen Tool & Point-to-Point Straight Line
 * 
 * Features:
 * 1. ✒️ Point-to-Point Straight Line (Free Angle CAD):
 *    - Connects directly from corner to corner with a clean, straight line at ANY angle (90°, 45°, slants, skewed plots).
 *    - Optional 90° Ortho Snap toggle (or hold Shift key) if pure 90° lines are desired.
 * 2. 📏 Stage 2: Sides & Measurements + Parapet Height:
 *    - Editing feet measurements does NOT stretch or alter the traced lines on the photo.
 *    - Mathematically constructs closed CAD polygon supporting both 90° and non-90° irregular shapes.
 */
export default function InteractiveImageRoofTracer({
  imageUrl,
  initialCorners = [],
  initialWalls = [],
  initialParapetHeight = 3.0,
  onApplyGeometry,
  onSidesChange,
  onClose
}) {
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Workflow Step: 'draw' (Stage 1: Trace lines) vs 'dimensions' (Stage 2: Enter feet & parapet)
  const [activeStep, setActiveStep] = useState(() => {
    if (initialCorners && initialCorners.length >= 3) return 'dimensions';
    return 'draw';
  });

  // Tool Mode in Stage 1: 'pen' (Photoshop Pen Tool - Point & Click) vs 'freehand' (Drag)
  const [toolMode, setToolMode] = useState('pen');

  // Ortho 90° Snap Toggle (Default: true -> 100% Crisp 90° CAD Lines)
  const [isOrthoSnap, setIsOrthoSnap] = useState(true);
  const [isShiftDown, setIsShiftDown] = useState(false);

  // Corner pins stored as percentages (0 to 100) of image width/height
  const [pins, setPins] = useState(() => {
    if (initialCorners && initialCorners.length >= 3) {
      return initialCorners.map((c, i) => ({
        id: `pin_${i + 1}`,
        xPct: Math.max(2, Math.min(98, c.x_pct || c.xPct || 50)),
        yPct: Math.max(2, Math.min(98, c.y_pct || c.yPct || 50)),
        label: c.label || `P${i + 1}`,
        lengthFt: initialWalls[i]?.lengthFt || initialWalls[i]?.length_ft || 10
      }));
    }
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pins && parsed.pins.length >= 3) return parsed.pins;
      }
    } catch (e) {}
    return [];
  });

  // Sides configuration (initialized once boundary is formed)
  const [sides, setSides] = useState(() => {
    if (initialWalls && initialWalls.length >= 3) {
      return initialWalls.map((w, i) => ({
        side: i + 1,
        name: w.name || `Side ${i + 1}`,
        lengthFt: parseFloat(w.lengthFt || w.length_ft) || 10,
        direction: w.direction || 'E'
      }));
    }
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sides && parsed.sides.length >= 3) return parsed.sides;
      }
    } catch (e) {}
    return [];
  });

  // Parapet Wall Height in feet
  const [parapetHeightFt, setParapetHeightFt] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parapetHeightFt) return parsed.parapetHeightFt;
      }
    } catch (e) {}
    return initialParapetHeight || 3.0;
  });

  // Obstacles & Cutout States (Mumty, Water Tank, Stair opening)
  const [hasMumty, setHasMumty] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) return !!JSON.parse(saved).hasMumty;
    } catch (e) {}
    return false;
  });
  const [mumtyW, setMumtyW] = useState(8);
  const [mumtyD, setMumtyD] = useState(10);
  const [mumtyH, setMumtyH] = useState(8);

  const [hasWaterTank, setHasWaterTank] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) return !!JSON.parse(saved).hasWaterTank;
    } catch (e) {}
    return false;
  });
  const [tankOnMumty, setTankOnMumty] = useState(true);
  const [tankCapacity, setTankCapacity] = useState('1000');
  const [parapetOpeningSide, setParapetOpeningSide] = useState(0);

  // Active / Hovered Side for visual glow highlighting
  const [highlightedSideIndex, setHighlightedSideIndex] = useState(null);

  // Dragging pin in Review mode
  const [draggingPinIndex, setDraggingPinIndex] = useState(null);

  // Drawing state
  const [isDrawingStroke, setIsDrawingStroke] = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoopClosed, setIsLoopClosed] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pins && parsed.pins.length >= 3) return true;
      }
    } catch (e) {}
    return initialCorners && initialCorners.length >= 3;
  });

  // SketchUp Dynamic Inline Dimensioning State
  const [isSketchUpMeasureMode, setIsSketchUpMeasureMode] = useState(true);
  const [pendingSegment, setPendingSegment] = useState(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');
  const [scalePctPerFt, setScalePctPerFt] = useState(() => {
    try {
      const saved = localStorage.getItem('sunvine_saved_tracer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.scalePctPerFt) return parsed.scalePctPerFt;
      }
    } catch (e) {}
    return 0;
  });
  const lengthInputRef = useRef(null);

  // Auto-save tracer state when drawing has valid closed boundary
  useEffect(() => {
    if (pins.length >= 3 && sides.length >= 3) {
      try {
        localStorage.setItem(
          'sunvine_saved_tracer_state',
          JSON.stringify({
            pins,
            sides,
            scalePctPerFt,
            parapetHeightFt,
            hasMumty,
            mumtyW,
            mumtyD,
            mumtyH,
            hasWaterTank,
            tankOnMumty,
            tankCapacity,
            parapetOpeningSide
          })
        );
      } catch (e) {}
    }
  }, [pins, sides, scalePctPerFt, parapetHeightFt, hasMumty, mumtyW, mumtyD, mumtyH, hasWaterTank, tankOnMumty, tankCapacity, parapetOpeningSide]);

  // Auto-focus and select measurement input when pending segment activates
  useEffect(() => {
    if (pendingSegment && lengthInputRef.current) {
      const timer = setTimeout(() => {
        lengthInputRef.current?.focus();
        lengthInputRef.current?.select();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [pendingSegment]);

  // Keyboard listeners (Shift for Ortho, Ctrl+Z for Undo, Enter for dimension confirmation / finish)
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Shift') setIsShiftDown(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Enter') {
        if (pendingSegment) {
          e.preventDefault();
          confirmPendingSegment();
        } else if (activeStep === 'draw' && pins.length >= 3) {
          e.preventDefault();
          finalizeSidesFromPins(pins);
        }
      } else if (e.key === 'Escape' && pendingSegment) {
        e.preventDefault();
        cancelPendingSegment();
      }
    };

    const handleKeyUp = e => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeStep, pins, pendingSegment, segmentLengthInput]);

  // Sync initialCorners if AI finishes in background
  useEffect(() => {
    if (initialCorners && initialCorners.length >= 3) {
      const generatedPins = initialCorners.map((c, i) => ({
        id: `pin_${i + 1}`,
        xPct: Math.max(2, Math.min(98, c.x_pct || c.xPct || 50)),
        yPct: Math.max(2, Math.min(98, c.y_pct || c.yPct || 50)),
        label: c.label || `P${i + 1}`,
        lengthFt: initialWalls[i]?.lengthFt || initialWalls[i]?.length_ft || 10
      }));
      setPins(generatedPins);

      const generatedSides = initialWalls.map((w, i) => ({
        side: i + 1,
        name: w.name || `Side ${i + 1}`,
        lengthFt: parseFloat(w.lengthFt || w.length_ft) || 10,
        direction: w.direction || 'E'
      }));
      setSides(generatedSides);
      setIsLoopClosed(true);
      setActiveStep('dimensions');
    }
  }, [initialCorners, initialWalls]);

  // Convert client (X, Y) to percentage of image
  const getCoordinatesFromEvent = e => {
    const img = imageRef.current;
    if (!img) return null;

    const rect = img.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const posX = clientX - rect.left;
    const posY = clientY - rect.top;

    const xPct = Math.max(1, Math.min(99, (posX / rect.width) * 100));
    const yPct = Math.max(1, Math.min(99, (posY / rect.height) * 100));

    return { xPct, yPct, pixelX: posX, pixelY: posY };
  };

  // Convert pins into sides with accurate 8-point compass directions (handles non-90° angles!)
  // Convert pins into sides with accurate 8-point compass directions (handles non-90° angles!)
  const finalizeSidesFromPins = useCallback(
    pinsList => {
      const n = pinsList.length;
      if (n < 3) return;

      const newSides = [];
      for (let i = 0; i < n; i++) {
        const p1 = pinsList[i];
        const p2 = pinsList[(i + 1) % n];
        const dx = p2.xPct - p1.xPct;
        const dy = p2.yPct - p1.yPct;

        const compass = getCompassDirection(dx, dy);
        let existingLen = sides[i]?.lengthFt || p1.lengthFt;

        // Auto-calculate closing wall length if scale is calibrated
        if (scalePctPerFt > 0 && (!existingLen || i === n - 1)) {
          const pixelDist = Math.hypot(dx, dy);
          existingLen = Math.max(1, Math.round(pixelDist / scalePctPerFt));
        } else if (!existingLen) {
          existingLen = 10;
        }

        newSides.push({
          side: i + 1,
          name: `Side ${i + 1} (${compass.label})`,
          lengthFt: existingLen,
          direction: compass.code
        });
      }

      setSides(newSides);
      if (onSidesChange) onSidesChange(newSides);
      setIsLoopClosed(true);
      setPendingSegment(null);
      setActiveStep('dimensions');
    },
    [sides, onSidesChange, scalePctPerFt]
  );

  // Apply snap logic (if ortho snap active or shift held, snap to 90°; otherwise FREE point-to-point)
  const computeTargetPoint = (lastPoint, targetPoint) => {
    if (!lastPoint) return targetPoint;
    const shouldSnapOrtho = isOrthoSnap || isShiftDown;

    if (!shouldSnapOrtho) {
      // FREE POINT-TO-POINT STRAIGHT LINE (Any Angle!)
      return {
        xPct: targetPoint.xPct,
        yPct: targetPoint.yPct
      };
    }

    // 90° Ortho Snap
    const dx = targetPoint.xPct - lastPoint.xPct;
    const dy = targetPoint.yPct - lastPoint.yPct;
    const isHorizontal = Math.abs(dx) >= Math.abs(dy);

    return {
      xPct: isHorizontal ? targetPoint.xPct : lastPoint.xPct,
      yPct: isHorizontal ? lastPoint.yPct : targetPoint.yPct
    };
  };

  // SketchUp Inline Measurement: Cancel current pending segment
  const cancelPendingSegment = () => {
    setPendingSegment(null);
  };

  // SketchUp Inline Measurement: Confirm pending segment with specific value
  const confirmPendingSegmentWithValue = lenVal => {
    if (!pendingSegment) return;
    const len = Math.max(1, parseFloat(lenVal) || pendingSegment.defaultLengthFt || 10);
    const { fromPin, dx, dy, distPct, compass, wallIndex } = pendingSegment;

    // Unit direction vector
    const lengthPct = distPct || 1;
    const ux = dx / lengthPct;
    const uy = dy / lengthPct;

    // Calibrate or use existing scale (% per foot)
    let currentScale = scalePctPerFt;
    if (!currentScale || currentScale <= 0) {
      currentScale = distPct / len;
      setScalePctPerFt(currentScale);
    }

    // Target distance in percentage according to exact feet entered
    let targetDistPct = len * currentScale;

    // Boundary check so drawing stays nicely in view (2% to 98%)
    let newXPct = fromPin.xPct + ux * targetDistPct;
    let newYPct = fromPin.yPct + uy * targetDistPct;

    if (newXPct < 2 || newXPct > 98 || newYPct < 2 || newYPct > 98) {
      const maxAllowedX = ux > 0 ? (98 - fromPin.xPct) / ux : ux < 0 ? (2 - fromPin.xPct) / ux : Infinity;
      const maxAllowedY = uy > 0 ? (98 - fromPin.yPct) / uy : uy < 0 ? (2 - fromPin.yPct) / uy : Infinity;
      const maxAllowedDist = Math.max(5, Math.min(Math.abs(maxAllowedX), Math.abs(maxAllowedY)));
      if (targetDistPct > maxAllowedDist) {
        targetDistPct = maxAllowedDist;
        currentScale = targetDistPct / len;
        setScalePctPerFt(currentScale);
        newXPct = fromPin.xPct + ux * targetDistPct;
        newYPct = fromPin.yPct + uy * targetDistPct;
      }
    }

    const newPin = {
      id: `pin_${wallIndex + 1}`,
      xPct: Number(Math.max(1, Math.min(99, newXPct)).toFixed(1)),
      yPct: Number(Math.max(1, Math.min(99, newYPct)).toFixed(1)),
      label: `P${wallIndex + 1}`,
      lengthFt: len
    };

    const newSide = {
      side: wallIndex,
      name: `Side ${wallIndex} (${compass.label})`,
      lengthFt: len,
      direction: compass.code
    };

    setPins(prev => [...prev, newPin]);
    setSides(prev => {
      const next = [...prev];
      next[wallIndex - 1] = newSide;
      if (onSidesChange) onSidesChange(next);
      return next;
    });

    setPendingSegment(null);
  };

  // SketchUp Inline Measurement: Confirm using current input box value
  const confirmPendingSegment = () => {
    if (!pendingSegment) return;
    const len = Math.max(1, parseFloat(segmentLengthInput) || pendingSegment.defaultLengthFt || 10);
    confirmPendingSegmentWithValue(len);
  };

  // 1. CLICK OR MOUSE DOWN
  const handleMouseDown = e => {
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;

    if (activeStep !== 'draw') return;

    // Check if clicked near first pin (P1) to close loop
    if (pins.length >= 3) {
      const firstPin = pins[0];
      const distToFirst = Math.hypot(coords.xPct - firstPin.xPct, coords.yPct - firstPin.yPct);
      if (distToFirst < 6.5) {
        if (pendingSegment) {
          confirmPendingSegment();
        }
        finalizeSidesFromPins(pins);
        return;
      }
    }

    // If currently awaiting length confirmation for previous click, auto-confirm it first!
    if (pendingSegment) {
      confirmPendingSegment();
      return;
    }

    if (toolMode === 'pen') {
      // PHOTOSHOP / SKETCHUP PEN TOOL MODE
      if (pins.length === 0) {
        // Place first anchor P1
        setPins([
          {
            id: 'pin_1',
            xPct: Number(coords.xPct.toFixed(1)),
            yPct: Number(coords.yPct.toFixed(1)),
            label: 'P1',
            lengthFt: 30
          }
        ]);
        setPendingSegment(null);
      } else {
        const lastPin = pins[pins.length - 1];
        const snapped = computeTargetPoint(lastPin, coords);
        const dx = snapped.xPct - lastPin.xPct;
        const dy = snapped.yPct - lastPin.yPct;
        const distPct = Math.hypot(dx, dy);

        if (distPct < 2) return; // ignore accidental micro-clicks

        const compass = getCompassDirection(dx, dy);

        let estLen = 25;
        if (scalePctPerFt > 0) {
          estLen = Math.max(1, Math.round(distPct / scalePctPerFt));
        } else {
          estLen = Math.max(5, Math.round(distPct * 0.75));
        }

        if (isSketchUpMeasureMode) {
          // Trigger SketchUp Inline Measurement HUD
          setPendingSegment({
            fromPin: lastPin,
            targetCoords: snapped,
            dx,
            dy,
            distPct,
            compass,
            wallIndex: pins.length,
            defaultLengthFt: estLen
          });
          setSegmentLengthInput(String(estLen));
        } else {
          // Standard instant drop
          const newPin = {
            id: `pin_${pins.length + 1}`,
            xPct: Number(snapped.xPct.toFixed(1)),
            yPct: Number(snapped.yPct.toFixed(1)),
            label: `P${pins.length + 1}`,
            lengthFt: estLen
          };
          setPins(prev => [...prev, newPin]);
        }
      }
    } else {
      // FREEHAND DRAG MODE
      setIsDrawingStroke(true);
      setCurrentStroke([coords]);
    }
  };

  // 2. MOUSE MOVE (Track cursor for live Pen Tool guide line)
  const handleMouseMove = e => {
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;

    setMousePos(coords);

    if (activeStep === 'draw' && toolMode === 'freehand' && isDrawingStroke) {
      setCurrentStroke(prev => [...prev, coords]);
    } else if (activeStep === 'dimensions' && draggingPinIndex !== null) {
      // Draggable fine-tuning in Stage 2
      setPins(prev => {
        const next = [...prev];
        next[draggingPinIndex] = {
          ...next[draggingPinIndex],
          xPct: Number(coords.xPct.toFixed(1)),
          yPct: Number(coords.yPct.toFixed(1))
        };
        return next;
      });
    }
  };

  // 3. MOUSE UP (For freehand drag)
  const handleMouseUp = () => {
    if (draggingPinIndex !== null) {
      setDraggingPinIndex(null);
      return;
    }

    if (activeStep !== 'draw' || toolMode !== 'freehand' || !isDrawingStroke) return;
    setIsDrawingStroke(false);

    if (currentStroke.length < 2) {
      setCurrentStroke([]);
      return;
    }

    const startPt = currentStroke[0];
    const endPt = currentStroke[currentStroke.length - 1];

    let effectiveStart = { xPct: startPt.xPct, yPct: startPt.yPct };
    if (pins.length > 0) {
      const lastPin = pins[pins.length - 1];
      effectiveStart = { xPct: lastPin.xPct, yPct: lastPin.yPct };
    }

    const straightEnd = computeTargetPoint(effectiveStart, endPt);

    if (pins.length >= 3) {
      const firstPin = pins[0];
      const distToFirst = Math.hypot(straightEnd.xPct - firstPin.xPct, straightEnd.yPct - firstPin.yPct);
      if (distToFirst < 7) {
        finalizeSidesFromPins(pins);
        setCurrentStroke([]);
        return;
      }
    }

    if (pins.length === 0) {
      const p1 = {
        id: 'pin_1',
        xPct: Number(effectiveStart.xPct.toFixed(1)),
        yPct: Number(effectiveStart.yPct.toFixed(1)),
        label: 'P1',
        lengthFt: 30
      };
      const p2 = {
        id: 'pin_2',
        xPct: Number(straightEnd.xPct.toFixed(1)),
        yPct: Number(straightEnd.yPct.toFixed(1)),
        label: 'P2',
        lengthFt: 10
      };
      setPins([p1, p2]);
    } else {
      const newPin = {
        id: `pin_${pins.length + 1}`,
        xPct: Number(straightEnd.xPct.toFixed(1)),
        yPct: Number(straightEnd.yPct.toFixed(1)),
        label: `P${pins.length + 1}`,
        lengthFt: 10
      };
      setPins(prev => [...prev, newPin]);
    }

    setCurrentStroke([]);
  };

  // Undo last placed corner or cancel pending segment
  const handleUndo = () => {
    if (pendingSegment) {
      setPendingSegment(null);
      return;
    }
    if (pins.length === 0) return;
    setPins(prev => prev.slice(0, prev.length - 1));
    setSides(prev => prev.slice(0, Math.max(0, prev.length - 1)));
    setIsLoopClosed(false);
    setActiveStep('draw');
  };

  // Reset drawing
  const handleReset = () => {
    setPins([]);
    setSides([]);
    setPendingSegment(null);
    setScalePctPerFt(0);
    setIsLoopClosed(false);
    setActiveStep('draw');
    try {
      localStorage.removeItem('sunvine_saved_tracer_state');
    } catch (e) {}
  };

  // Update a single side measurement in Stage 2 (DOES NOT CHANGE DRAWING LENGTH ON PHOTO!)
  const handleSideLengthChange = (idx, value) => {
    const val = parseFloat(value) || 0;
    setSides(prev => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], lengthFt: val };
      }
      if (onSidesChange) onSidesChange(next);
      return next;
    });
  };

  // Final confirmation: Compute mathematically closed CAD polygon supporting both 90° and Non-90° / Slanted walls!
  const handleGenerateCADAnd3D = () => {
    const n = Math.min(sides.length, pins.length);
    if (pins.length < 3 || n < 3) {
      alert('Please trace at least 3 walls to form a closed roof boundary.');
      return;
    }

    // 1. Calculate raw vector displacements for each side from traced geometry & lengths
    const displacements = [];
    let totalPerimeter = 0;

    for (let i = 0; i < n; i++) {
      const s = sides[i];
      const len = parseFloat(s?.lengthFt) || 10;
      totalPerimeter += len;

      const p1 = pins[i] || pins[0];
      const p2 = pins[(i + 1) % pins.length] || pins[0];
      const dxImage = (p2.xPct ?? 50) - (p1.xPct ?? 50);
      const dyImage = (p2.yPct ?? 50) - (p1.yPct ?? 50);
      let angle = Math.atan2(dyImage, dxImage);

      // If angle is within 4° of cardinal axes (0, 90, 180, 270), snap to exact cardinal
      const deg = ((angle * 180) / Math.PI + 360) % 360;
      if (Math.abs(deg - 0) < 4 || Math.abs(deg - 360) < 4) angle = 0;
      else if (Math.abs(deg - 90) < 4) angle = Math.PI / 2;
      else if (Math.abs(deg - 180) < 4) angle = Math.PI;
      else if (Math.abs(deg - 270) < 4) angle = (3 * Math.PI) / 2;

      displacements.push({
        len,
        dx: len * Math.cos(angle),
        dz: len * Math.sin(angle),
        name: s?.name || `Side ${i + 1}`,
        dirCode: s?.direction || 'E'
      });
    }

    // 2. Closure error (sum of all dx and dz should be 0)
    const errX = displacements.reduce((sum, d) => sum + d.dx, 0);
    const errZ = displacements.reduce((sum, d) => sum + d.dz, 0);

    // 3. Accumulate vertices with Bowditch compass rule correction (guarantees 100% closed loop!)
    let currX = 0;
    let currZ = 0;
    let distSoFar = 0;
    const rawVertices = [{ x: 0, z: 0, label: pins[0]?.label || 'Corner 1' }];

    for (let i = 0; i < n - 1; i++) {
      const d = displacements[i];
      distSoFar += d.len;

      const corrX = totalPerimeter > 0 ? (errX * distSoFar) / totalPerimeter : 0;
      const corrZ = totalPerimeter > 0 ? (errZ * distSoFar) / totalPerimeter : 0;

      currX += d.dx;
      currZ += d.dz;

      rawVertices.push({
        x: Number((currX - corrX).toFixed(1)),
        z: Number((currZ - corrZ).toFixed(1)),
        label: pins[i + 1]?.label || `Corner ${i + 2}`
      });
    }

    // 4. Center coordinates around (0, 0)
    const xs = rawVertices.map(v => v?.x ?? 0);
    const zs = rawVertices.map(v => v?.z ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const customVertices = rawVertices.map(v => ({
      x: Number(((v?.x ?? 0) - midX).toFixed(1)),
      z: Number(((v?.z ?? 0) - midZ).toFixed(1)),
      label: v?.label || 'Corner'
    }));

    const widthFt = Math.max(10, Math.round(maxX - minX));
    const depthFt = Math.max(10, Math.round(maxZ - minZ));

    const enrichedWalls = sides.slice(0, n).map((s, idx) => ({
      side: idx + 1,
      name: s.name,
      lengthFt: parseFloat(s.lengthFt) || 10,
      direction: s.direction,
      p1: customVertices[idx] || { x: 0, z: 0 },
      p2: customVertices[(idx + 1) % customVertices.length] || { x: 0, z: 0 }
    }));

    // Obstacles Generation (Mumty Room & Water Tank)
    const obstacles = [];
    if (hasMumty) {
      obstacles.push({
        id: 'mumty',
        type: 'box',
        label: 'Mumty Room (Staircase)',
        widthFt: mumtyW,
        depthFt: mumtyD,
        heightFt: mumtyH,
        xRelFt: Number((minX + (maxX - minX) * 0.25 - midX).toFixed(1)),
        zRelFt: Number((minZ + (maxZ - minZ) * 0.25 - midZ).toFixed(1)),
        location: 'north_west'
      });
    }

    if (hasWaterTank) {
      const tankH = tankCapacity === '500' ? 4 : tankCapacity === '2000' ? 6 : 5;
      const tankR = tankCapacity === '500' ? 1.5 : tankCapacity === '2000' ? 2.5 : 2.0;
      const tankElevation = tankOnMumty && hasMumty ? mumtyH : 0;
      const tankXRel = hasMumty && tankOnMumty
        ? Number((minX + (maxX - minX) * 0.25 - midX).toFixed(1))
        : Number((minX + (maxX - minX) * 0.35 - midX).toFixed(1));
      const tankZRel = hasMumty && tankOnMumty
        ? Number((minZ + (maxZ - minZ) * 0.25 - midZ).toFixed(1))
        : Number((minZ + (maxZ - minZ) * 0.35 - midZ).toFixed(1));

      obstacles.push({
        id: 'water_tank',
        type: 'cylinder',
        label: `Sintex ${tankCapacity}L Tank`,
        radiusFt: tankR,
        heightFt: tankH,
        elevationFt: tankElevation,
        xRelFt: tankXRel,
        zRelFt: tankZRel,
        location: tankOnMumty ? 'on_mumty' : 'roof_slab'
      });
    }

    const wallsWithOpening = enrichedWalls.map(w => ({
      ...w,
      hasOpening: w.side === parapetOpeningSide,
      openingWidthFt: w.side === parapetOpeningSide ? 3.5 : 0
    }));

    onApplyGeometry({
      customVertices,
      walls: wallsWithOpening,
      corners: pins.slice(0, n).map((p, i) => ({
        corner_number: i + 1,
        x_pct: p.xPct,
        y_pct: p.yPct,
        label: p.label
      })),
      parapetHeightFt: parseFloat(parapetHeightFt) || 3.0,
      obstacles,
      parapetOpeningSide,
      widthFt,
      depthFt
    });
  };

  // Real-time Pen Tool Guide Line from last pin to mouse (or pending confirmed line)
  const getGuideLine = () => {
    if (activeStep !== 'draw') return null;
    if (pendingSegment) {
      return {
        x1: pendingSegment.fromPin.xPct,
        y1: pendingSegment.fromPin.yPct,
        x2: pendingSegment.targetCoords.xPct,
        y2: pendingSegment.targetCoords.yPct,
        isPending: true
      };
    }
    if (pins.length === 0 || !mousePos) return null;
    const lastPin = pins[pins.length - 1];
    const snapped = computeTargetPoint(lastPin, mousePos);

    return {
      x1: lastPin.xPct,
      y1: lastPin.yPct,
      x2: snapped.xPct,
      y2: snapped.yPct,
      isPending: false
    };
  };

  const guideLine = getGuideLine();
  const isNearFirstPin =
    activeStep === 'draw' &&
    pins.length >= 3 &&
    mousePos &&
    Math.hypot(mousePos.xPct - pins[0].xPct, mousePos.yPct - pins[0].yPct) < 7;

  return (
    <div className="flex flex-col w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        {/* Step Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveStep('draw')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeStep === 'draw' ? 'bg-[#6CBF3D] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              <span>1. Draw Boundary</span>
              {pins.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-[#6CBF3D]">
                  {pins.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (pins.length >= 3) {
                  finalizeSidesFromPins(pins);
                } else {
                  alert('Place at least 3 corners to close the roof boundary.');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeStep === 'dimensions'
                  ? 'bg-[#6CBF3D] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">straighten</span>
              <span>2. Sides &amp; Parapet</span>
              {sides.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-[#6CBF3D]">
                  {sides.length} Sides
                </span>
              )}
            </button>
          </div>

          {/* Mode Switchers in Stage 1 */}
          {activeStep === 'draw' && (
            <div className="flex items-center gap-1.5">
              {/* Point-to-Point Angle Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsOrthoSnap(!isOrthoSnap)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  isOrthoSnap
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Toggle between Free Angle (Point-to-Point) and 90° Ortho Lock (or hold Shift key)"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isOrthoSnap ? 'square_foot' : 'timeline'}
                </span>
                <span>{isOrthoSnap ? '📐 90° Ortho Lock' : '⚡ Free Angle (Any Slant)'}</span>
              </button>

              {/* SketchUp Instant Dimension Tool Toggle */}
              <button
                type="button"
                onClick={() => setIsSketchUpMeasureMode(!isSketchUpMeasureMode)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  isSketchUpMeasureMode
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toggle SketchUp-style instant wall measurement on each corner click"
              >
                <span className="material-symbols-outlined text-[16px]">straighten</span>
                <span>{isSketchUpMeasureMode ? '📏 Auto-Measure (SketchUp)' : 'Free Drop'}</span>
              </button>

              {/* Pen Tool vs Freehand Drag */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setToolMode('pen')}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    toolMode === 'pen' ? 'bg-[#6CBF3D] text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Click to place corners"
                >
                  <span className="material-symbols-outlined text-[14px]">colorize</span>
                  <span>Pen Tool</span>
                </button>
                <button
                  type="button"
                  onClick={() => setToolMode('freehand')}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    toolMode === 'freehand' ? 'bg-[#6CBF3D] text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Freehand drag stroke"
                >
                  <span className="material-symbols-outlined text-[14px]">gesture</span>
                  <span>Drag</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeStep === 'draw' && (
            <>
              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={pins.length === 0}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                title="Undo last corner point (Ctrl+Z)"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                <span>Undo</span>
              </button>

              {/* Reset button */}
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                <span>Reset</span>
              </button>

              {/* Done Drawing Button */}
              <button
                type="button"
                onClick={() => {
                  if (pins.length >= 3) {
                    finalizeSidesFromPins(pins);
                  } else {
                    alert('Place at least 3 corners to close the roof boundary.');
                  }
                }}
                disabled={pins.length < 3}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#6CBF3D] hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer ml-1"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Finish Boundary $\rightarrow$ Enter Dimensions</span>
              </button>
            </>
          )}

          {activeStep === 'dimensions' && (
            <>
              {/* Back to Draw button */}
              <button
                type="button"
                onClick={() => setActiveStep('draw')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Redraw Boundary</span>
              </button>

              {/* Generate 2D CAD & 3D Model */}
              <button
                type="button"
                onClick={handleGenerateCADAnd3D}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer ml-auto"
              >
                <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
                <span>Generate 2D CAD &amp; 3D Model</span>
              </button>
            </>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 ml-1">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.15))}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer font-black text-xs"
            >
              -
            </button>
            <span className="text-[10px] font-mono text-slate-300 w-7 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.15))}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer font-black text-xs"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Drawing Viewport & Overlay Canvas */}
      <div className="relative w-full">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className={`w-full relative min-h-[460px] max-h-[620px] overflow-auto flex items-center justify-center bg-[#070D18] p-4 select-none ${
            activeStep === 'draw' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          className="relative inline-block transition-transform duration-100"
        >
          {/* Base Sketch Photo */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Uploaded Rooftop Sketch"
            className="max-h-[520px] max-w-[90vw] object-contain rounded-xl shadow-2xl pointer-events-none border border-slate-700 block"
          />

          {/* Live Freehand Wavy Stroke while dragging mouse */}
          {activeStep === 'draw' && toolMode === 'freehand' && isDrawingStroke && currentStroke.length > 1 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-30">
              <polyline
                points={currentStroke.map(p => `${p.xPct}%,${p.yPct}%`).join(' ')}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
              />
            </svg>
          )}

          {/* SVG Lines Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
            {/* Shaded Closed Polygon (once loop is closed) */}
            {(isLoopClosed || activeStep === 'dimensions') && pins.length >= 3 && (
              <polygon
                points={pins.map(p => `${p.xPct}%,${p.yPct}%`).join(' ')}
                fill="rgba(108, 191, 61, 0.22)"
                stroke="#6CBF3D"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
            )}

            {/* Connecting Wall Lines (Direct Straight Lines from Point to Point) */}
            {pins.map((p1, idx) => {
              const isLast = idx === pins.length - 1;
              if (!isLoopClosed && activeStep === 'draw' && isLast) return null;

              const p2 = pins[(idx + 1) % pins.length];
              const isSideHighlighted = highlightedSideIndex === idx;

              return (
                <line
                  key={`line_${idx}`}
                  x1={`${p1.xPct}%`}
                  y1={`${p1.yPct}%`}
                  x2={`${p2.xPct}%`}
                  y2={`${p2.yPct}%`}
                  stroke={isSideHighlighted ? '#FBBF24' : '#6CBF3D'}
                  strokeWidth={isSideHighlighted ? '5' : '3.5'}
                  strokeLinecap="round"
                  className="transition-all"
                />
              );
            })}

            {/* Photoshop / SketchUp: Live Straight Guide Line from last placed pin to mouse cursor */}
            {activeStep === 'draw' && guideLine && !isLoopClosed && (
              <g>
                <line
                  x1={`${guideLine.x1}%`}
                  y1={`${guideLine.y1}%`}
                  x2={`${guideLine.x2}%`}
                  y2={`${guideLine.y2}%`}
                  stroke={guideLine.isPending ? '#10B981' : '#38BDF8'}
                  strokeWidth={guideLine.isPending ? '4.5' : '3'}
                  strokeDasharray={guideLine.isPending ? '6 3' : '5 3'}
                  strokeLinecap="round"
                />
                <circle
                  cx={`${guideLine.x2}%`}
                  cy={`${guideLine.y2}%`}
                  r={guideLine.isPending ? '7' : '5'}
                  fill={guideLine.isPending ? '#10B981' : '#38BDF8'}
                  stroke="#0F172A"
                  strokeWidth="2"
                />
                {guideLine.isPending && (
                  <circle
                    cx={`${guideLine.x2}%`}
                    cy={`${guideLine.y2}%`}
                    r="11"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                    className="animate-spin"
                  />
                )}
              </g>
            )}
          </svg>

          {/* Real-time Guide Line Dimension Tag */}
          {activeStep === 'draw' && guideLine && !isLoopClosed && (
            <div
              style={{
                left: `${(guideLine.x1 + guideLine.x2) / 2}%`,
                top: `${(guideLine.y1 + guideLine.y2) / 2}%`,
                transform: 'translate(-50%, -140%)'
              }}
              className={`absolute z-30 pointer-events-none px-2.5 py-0.5 rounded-md font-mono text-[11px] font-black shadow-2xl whitespace-nowrap transition-all flex items-center gap-1 ${
                guideLine.isPending
                  ? 'bg-emerald-400 text-slate-950 border border-emerald-300 ring-2 ring-emerald-400/50 animate-pulse'
                  : 'bg-slate-950/90 text-sky-300 border border-sky-400/40'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">straighten</span>
              <span>
                {guideLine.isPending
                  ? `${segmentLengthInput || pendingSegment?.defaultLengthFt} ft`
                  : scalePctPerFt > 0
                  ? `${Math.max(1, Math.round(Math.hypot(guideLine.x2 - guideLine.x1, guideLine.y2 - guideLine.y1) / scalePctPerFt))} ft`
                  : 'Aim & Click'}
              </span>
            </div>
          )}

          {/* Sleek, Tiny CAD Corner Pinpoints (Non-blocking during draw!) */}
          {pins.map((pin, idx) => {
            const isFirst = idx === 0;
            const isStartHovered = isFirst && isNearFirstPin;

            return (
              <div
                key={pin.id}
                onMouseDown={e => {
                  if (activeStep === 'dimensions') {
                    e.stopPropagation();
                    setDraggingPinIndex(idx);
                  }
                }}
                style={{
                  left: `${pin.xPct}%`,
                  top: `${pin.yPct}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute z-20 flex items-center justify-center transition-all ${
                  activeStep === 'dimensions'
                    ? 'cursor-grab active:cursor-grabbing hover:scale-125'
                    : 'pointer-events-none'
                }`}
              >
                {/* Sleek Dot (Photoshop Pen Point Anchor) */}
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                    isStartHovered
                      ? 'w-5 h-5 bg-amber-400 ring-4 ring-amber-400/60 shadow-lg animate-pulse'
                      : 'bg-[#6CBF3D] border-2 border-white shadow-md ring-2 ring-slate-950/80'
                  }`}
                />

                {/* Pin Number Label Tag */}
                <span className="absolute -top-5 text-[9px] font-black bg-slate-950/90 text-[#6CBF3D] px-1 py-0.2 rounded border border-[#6CBF3D]/40 pointer-events-none shadow-sm whitespace-nowrap">
                  P{idx + 1}
                </span>

                {/* Photoshop Close Path Indicator on hover near Point 1 */}
                {isStartHovered && (
                  <span className="absolute -bottom-6 text-[10px] font-extrabold bg-amber-400 text-slate-950 px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none flex items-center gap-1">
                    <span>○</span>
                    <span>Click P1 to Close Path</span>
                  </span>
                )}
              </div>
            );
          })}

          {/* Sleek, Non-Cluttering Side Badges on Photo (Expand on hover or when card is focused) */}
          {activeStep === 'dimensions' &&
            pins.map((p1, idx) => {
              const p2 = pins[(idx + 1) % pins.length];
              const midX = (p1.xPct + p2.xPct) / 2;
              const midY = (p1.yPct + p2.yPct) / 2;
              const sideData = sides[idx];
              const isSideHighlighted = highlightedSideIndex === idx;

              return (
                <div
                  key={`side_badge_${idx}`}
                  style={{
                    left: `${midX}%`,
                    top: `${midY}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseEnter={() => setHighlightedSideIndex(idx)}
                  onMouseLeave={() => setHighlightedSideIndex(null)}
                  className={`absolute z-30 font-mono transition-all cursor-pointer select-none flex items-center justify-center ${
                    isSideHighlighted
                      ? 'scale-110 z-40'
                      : 'scale-90 opacity-85 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  {isSideHighlighted ? (
                    <div className="bg-amber-400 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xl flex items-center gap-1.5 whitespace-nowrap animate-bounce">
                      <span>Side {idx + 1}:</span>
                      <b>{sideData?.lengthFt || 10}&apos;</b>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-950/90 text-[#6CBF3D] border border-[#6CBF3D]/80 text-[10px] font-black flex items-center justify-center shadow-lg hover:border-amber-400 hover:text-amber-400">
                      {idx + 1}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Dynamic SketchUp Inline Dimension HUD */}
        {activeStep === 'draw' && pendingSegment && (
          <div
            onMouseDown={e => e.stopPropagation()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5 max-w-lg w-[94%] sm:w-auto animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  Wall {pendingSegment.wallIndex} ({pendingSegment.compass?.label || pendingSegment.compass?.code})
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                SketchUp Auto-Scale 📐
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700 focus-within:border-emerald-400 transition-colors">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">straighten</span>
                <input
                  ref={lengthInputRef}
                  type="number"
                  min="1"
                  max="500"
                  step="0.5"
                  value={segmentLengthInput}
                  onChange={e => setSegmentLengthInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      confirmPendingSegment();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelPendingSegment();
                    }
                  }}
                  className="w-20 bg-transparent text-white font-mono font-black text-lg outline-none text-center"
                  placeholder={String(pendingSegment.defaultLengthFt)}
                />
                <span className="text-xs font-bold text-slate-400">ft</span>
              </div>

              <button
                type="button"
                onClick={confirmPendingSegment}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-[#6CBF3D] hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Confirm &amp; Next (Enter ↵)</span>
              </button>

              <button
                type="button"
                onClick={cancelPendingSegment}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>Cancel</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">Quick presets:</span>
              {[10, 15, 20, 25, 30, 40, 50].map(val => (
                <button
                  key={`quick_${val}`}
                  type="button"
                  onClick={() => confirmPendingSegmentWithValue(val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-all shrink-0 ${
                    parseFloat(segmentLengthInput) === val
                      ? 'bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-400/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {val}&apos;
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STAGE 1 BOTTOM HELPER BAR */}
      {activeStep === 'draw' && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="material-symbols-outlined text-[18px]">
                {isOrthoSnap ? 'square_foot' : 'timeline'}
              </span>
              <span>{pins.length} Corners Placed</span>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              {pendingSegment ? (
                <span className="text-emerald-400 font-semibold">
                  👉 Enter Side {pendingSegment.wallIndex} length (feet) and press <b>Enter</b> to lock scale.
                </span>
              ) : pins.length === 0 ? (
                <>
                  👉 Click on the first roof corner (Corner 1) to begin tracing. <b>Point-to-point drawing enabled for any angle or 90° corner.</b>
                </>
              ) : pins.length < 3 ? (
                <>
                  👉 Continue clicking next corners and enter dimensions in feet.
                </>
              ) : (
                <>
                  👉 Click <b>P1 to close boundary</b> (or click &quot;Finish Boundary&quot;).
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (pins.length >= 3) {
                finalizeSidesFromPins(pins);
              } else {
                alert('Place at least 3 corners to close the roof boundary.');
              }
            }}
            disabled={pins.length < 3}
            className="px-4 py-1.5 rounded-xl bg-[#6CBF3D] hover:bg-[#5ca633] disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer ml-auto"
          >
            <span>Finish Boundary &amp; Set Dimensions</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      )}

      {/* STAGE 2: SIDES MEASUREMENT TABLE & PARAPET HEIGHT FORM */}
      {activeStep === 'dimensions' && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
            <div>
              <h5 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">straighten</span>
                <span>Wall Lengths &amp; Parapet Height</span>
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enter actual wall lengths in feet. Measurements will scale 2D CAD and 3D models accurately without modifying the blueprint image.
              </p>
            </div>

            {/* Parapet Wall Height Configuration */}
            <div className="flex items-center gap-3 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-400 text-[18px]">fence</span>
                <span className="text-xs font-bold text-white">Parapet Height:</span>
              </div>
              <div className="flex items-center gap-1">
                {[2.5, 3.0, 3.5, 4.0].map(h => (
                  <button
                    key={`p_h_${h}`}
                    type="button"
                    onClick={() => setParapetHeightFt(h)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                      parapetHeightFt === h
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {h} ft
                  </button>
                ))}
                <input
                  type="number"
                  step="0.5"
                  value={parapetHeightFt}
                  onChange={e => setParapetHeightFt(parseFloat(e.target.value) || 0)}
                  className="w-14 h-6 text-center bg-slate-900 text-white font-mono font-bold text-xs rounded border border-blue-500/40 ml-1 outline-none"
                />
                <span className="text-[11px] text-slate-400">ft</span>
              </div>
            </div>
          </div>

          {/* Sides Dimension Cards Grid (Supports 8-point compass directions!) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1">
            {sides.map((side, idx) => {
              const isHighlighted = highlightedSideIndex === idx;

              return (
                <div
                  key={`side_card_${idx}`}
                  onMouseEnter={() => setHighlightedSideIndex(idx)}
                  onMouseLeave={() => setHighlightedSideIndex(null)}
                  className={`p-2 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                    isHighlighted
                      ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-white">Side {side.side}</span>
                    <span className="text-[10px] text-amber-300 font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                      {side.direction}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={side.lengthFt}
                      onChange={e => handleSideLengthChange(idx, e.target.value)}
                      className="w-full h-8 px-2 bg-slate-900 text-white font-mono font-black text-sm rounded-lg border border-slate-700 focus:border-[#6CBF3D] outline-none text-center"
                      placeholder="10"
                    />
                    <span className="text-xs font-bold text-slate-400">ft</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Obstacles & Cutouts Section (Mumty Room, Water Tank, Stair Openings) */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-[18px]">domain_add</span>
                <span className="text-xs font-bold text-white">Rooftop Obstacles &amp; Cutouts (Mumty, Water Tank &amp; Stair Opening):</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Adding obstacles calculates real 3D shadow zones and clearance.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Mumty Room Toggle & Specs */}
              <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                hasMumty ? 'bg-amber-950/20 border-amber-500/50' : 'bg-slate-900/60 border-slate-800'
              }`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasMumty}
                    onChange={e => setHasMumty(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white">🏠 Staircase Mumty</span>
                </label>

                {hasMumty && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Width (W):</span>
                      <input
                        type="number"
                        value={mumtyW}
                        onChange={e => setMumtyW(parseFloat(e.target.value) || 8)}
                        className="w-full h-7 px-1.5 bg-slate-950 text-white rounded border border-slate-700 text-center font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Depth (D):</span>
                      <input
                        type="number"
                        value={mumtyD}
                        onChange={e => setMumtyD(parseFloat(e.target.value) || 10)}
                        className="w-full h-7 px-1.5 bg-slate-950 text-white rounded border border-slate-700 text-center font-mono text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Height (H):</span>
                      <input
                        type="number"
                        value={mumtyH}
                        onChange={e => setMumtyH(parseFloat(e.target.value) || 8)}
                        className="w-full h-7 px-1.5 bg-slate-950 text-white rounded border border-slate-700 text-center font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Water Tank Toggle & Specs */}
              <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                hasWaterTank ? 'bg-sky-950/20 border-sky-500/50' : 'bg-slate-900/60 border-slate-800'
              }`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasWaterTank}
                    onChange={e => setHasWaterTank(e.target.checked)}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white">🚰 Water Tank</span>
                </label>

                {hasWaterTank && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Location:</span>
                      <select
                        value={tankOnMumty ? 'mumty' : 'slab'}
                        onChange={e => setTankOnMumty(e.target.value === 'mumty')}
                        className="w-full h-7 px-1 bg-slate-950 text-white rounded border border-slate-700 text-xs"
                      >
                        <option value="mumty">On Mumty Roof</option>
                        <option value="slab">On Main Slab</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tank Capacity:</span>
                      <select
                        value={tankCapacity}
                        onChange={e => setTankCapacity(e.target.value)}
                        className="w-full h-7 px-1 bg-slate-950 text-white rounded border border-slate-700 text-xs"
                      >
                        <option value="500">500 L (4ft H)</option>
                        <option value="1000">1000 L (5ft H)</option>
                        <option value="2000">2000 L (6ft H)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Parapet Opening / Stair Access */}
              <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                parapetOpeningSide > 0 ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-slate-900/60 border-slate-800'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-[18px]">meeting_room</span>
                  <span className="text-xs font-bold text-white">Parapet Cutout / Stair Access:</span>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  <select
                    value={parapetOpeningSide}
                    onChange={e => setParapetOpeningSide(parseInt(e.target.value) || 0)}
                    className="w-full h-7 px-2 bg-slate-950 text-white rounded border border-slate-700 text-xs"
                  >
                    <option value="0">None (Full Continuous Parapet)</option>
                    {sides.map((s, idx) => (
                      <option key={`op_${idx}`} value={s.side}>
                        Side {s.side} (3.5ft Stair Opening)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Stage 2 Bottom Confirmation Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 flex-wrap gap-2">
            <span className="text-xs text-slate-400">
              ✓ {sides.length} walls configured with {parapetHeightFt}ft parapet. Ready for 2D CAD and 3D modeling.
            </span>

            <button
              type="button"
              onClick={handleGenerateCADAnd3D}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6CBF3D] to-emerald-400 hover:brightness-110 text-slate-950 font-black text-sm flex items-center gap-2 shadow-xl cursor-pointer ml-auto"
            >
              <span className="material-symbols-outlined text-[20px]">view_in_ar</span>
              <span>Generate 2D CAD &amp; 3D Model</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
