import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  calculateLegHeights,
  calculateGiPipeSections,
  checkRoofFit,
  mmToFeet
} from '../../utils/solarLayoutEngine';
import {
  getRoofPolygonVertices,
  getRoofWalls,
  DEFAULT_ROOF_CONFIG,
  SITE_SKETCH_2_CONFIG,
  SAMPLE_HAND_DRAWN_SKETCH_CONFIG
} from './RooftopDesigner';

export default function SolarStructure3DViewer({
  layout,
  moduleDims,
  initialFrontLegHeightFt = 2.5,
  tiltDegrees = 18,
  roofConfig = null,
  onOpenRoofDesigner = null
}) {
  const mountRef = useRef(null);
  const [frontLegFt, setFrontLegFt] = useState(initialFrontLegHeightFt || 2.5);
  const [viewPreset, setViewPreset] = useState('orbit'); // 'orbit', 'top', 'side', 'front', 'building'
  const [buildingFloors, setBuildingFloors] = useState('G+1'); // 'G' (10ft), 'G+1' (20ft), 'G+2' (30ft), 'G+3' (40ft)
  const [legCountChoice, setLegCountChoice] = useState('6'); // '6' (Suggested/Recommended for 3x2), '4' (Economy)
  const [copySuccess, setCopySuccess] = useState(false);

  // Manual Nudge Sliders (X & Z fine-tuning across entire roof)
  const [nudgeXFt, setNudgeXFt] = useState(0);
  const [nudgeZFt, setNudgeZFt] = useState(0);

  // Parapet Wall Anchoring vs Terrace Floor Ballast Mount
  // 'all_floor': Standard RCC slab anchors (4x M10 bolts)
  // 'rear_wall': Rear legs anchor directly into parapet beam (M12/M16 chemical studs + L-cleats)
  // 'front_wall': Front legs anchor into parapet beam
  const [wallMountMode, setWallMountMode] = useState('all_floor');

  // Cross-Bracing / Knee Support State (auto-recommended for >=6.0ft walkable structures)
  const [crossBracingEnabled, setCrossBracingEnabled] = useState(() => (initialFrontLegHeightFt || 2.5) >= 6.0);

  useEffect(() => {
    if (frontLegFt >= 6.0) {
      setCrossBracingEnabled(true);
    }
  }, [frontLegFt]);

  // Sun Simulation States (Day cycle 8 AM to 5 PM)
  const [sunHour, setSunHour] = useState(12.0);
  const [isSunPlaying, setIsSunPlaying] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const sunLightRef = useRef(null);

  // Animate Sun Position during simulation
  useEffect(() => {
    if (!isSunPlaying) return;
    const interval = setInterval(() => {
      setSunHour(prev => {
        if (prev >= 17.0) return 8.0;
        return Number((prev + 0.25).toFixed(2));
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isSunPlaying]);

  // Dynamically move directional sunlight without re-creating WebGL scene
  useEffect(() => {
    if (sunLightRef.current) {
      const sunAzimuthRad = ((sunHour - 12) * 16 * Math.PI) / 180;
      const sunAltitudeRad = ((72 - Math.abs(sunHour - 12) * 6.5) * Math.PI) / 180;
      const sunDist = 32;
      const sunX = sunDist * Math.cos(sunAltitudeRad) * Math.sin(sunAzimuthRad);
      const sunY = sunDist * Math.sin(sunAltitudeRad);
      const sunZ = -sunDist * Math.cos(sunAltitudeRad) * Math.cos(sunAzimuthRad);
      sunLightRef.current.position.set(sunX, sunY, sunZ);
    }
  }, [sunHour]);

  const getSunHourLabel = hour => {
    const whole = Math.floor(hour);
    const min = Math.round((hour - whole) * 60);
    const minStr = min < 10 ? `0${min}` : `${min}`;
    const period = whole >= 12 ? 'PM' : 'AM';
    const displayH = whole > 12 ? whole - 12 : whole;
    return `${displayH}:${minStr} ${period}`;
  };

  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const savedCameraStateRef = useRef(null);

  const activeRoof = useMemo(() => {
    return roofConfig || DEFAULT_ROOF_CONFIG;
  }, [roofConfig]);

  // Compute Roof Polygon Vertices & Boundary Box
  const polyVerts = useMemo(() => getRoofPolygonVertices(activeRoof), [activeRoof]);
  const polyBounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    polyVerts.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    });
    return { minX, maxX, minZ, maxZ, spanX: maxX - minX, spanZ: maxZ - minZ };
  }, [polyVerts]);

  // Array physical dimensions in feet
  const arrayWFt = (layout?.widthMm || 2278) / 304.8;
  const arrayDFt = (layout?.depthMm || 1134) / 304.8;

  // Base safe zone center from active roof
  const baseCenter = useMemo(() => {
    const sz = activeRoof.safeSolarZone;
    if (sz?.centerXFt !== undefined && sz?.centerZFt !== undefined) {
      return { x: Number(sz.centerXFt), z: Number(sz.centerZFt) };
    }
    return {
      x: (polyBounds.minX + polyBounds.maxX) / 2,
      z: (polyBounds.minZ + polyBounds.maxZ) / 2
    };
  }, [activeRoof, polyBounds]);

  // Helper: test if point (px, pz) is inside polygon verts [{x, z}]
  const isPointInPoly = (px, pz, verts) => {
    let inside = false;
    const n = verts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = verts[i].x, zi = verts[i].z;
      const xj = verts[j].x, zj = verts[j].z;
      const intersect = ((zi > pz) !== (zj > pz)) &&
        (px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Helper: minimum distance from (px, pz) to any polygon segment
  const minDistanceToPolyWalls = (px, pz, verts) => {
    let minDist = Infinity;
    const n = verts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const x1 = verts[j].x, z1 = verts[j].z;
      const x2 = verts[i].x, z2 = verts[i].z;
      const l2 = (x2 - x1) ** 2 + (z2 - z1) ** 2;
      let d;
      if (l2 === 0) {
        d = Math.hypot(px - x1, pz - z1);
      } else {
        let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(px - (x1 + t * (x2 - x1)), pz - (z1 + t * (z2 - z1)));
      }
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  // Helper: check if structure placed at (cx, cz) stays strictly inside polygon
  const doesStructureFitAt = (cx, cz, verts, wFt, dFt, margin = 0.8) => {
    const halfW = wFt / 2;
    const halfD = dFt / 2;
    const testPoints = [
      { x: cx - halfW, z: cz - halfD },
      { x: cx + halfW, z: cz - halfD },
      { x: cx - halfW, z: cz + halfD },
      { x: cx + halfW, z: cz + halfD },
      { x: cx, z: cz - halfD },
      { x: cx, z: cz + halfD },
      { x: cx - halfW, z: cz },
      { x: cx + halfW, z: cz },
      { x: cx, z: cz }
    ];

    for (let p of testPoints) {
      if (!isPointInPoly(p.x, p.z, verts)) return false;
      if (minDistanceToPolyWalls(p.x, p.z, verts) < margin) return false;
    }
    return true;
  };

  // Clamped structure center in feet (STRICT POLYGON-AWARE COLLISION & WALL CLAMPING!)
  const clampedMountCenter = useMemo(() => {
    let startX = baseCenter.x;
    let startZ = baseCenter.z;

    // Check if start fits; if not, fallback to centroid
    if (!doesStructureFitAt(startX, startZ, polyVerts, arrayWFt, arrayDFt, 0.2)) {
      let cx = 0, cz = 0;
      polyVerts.forEach(v => { cx += v.x; cz += v.z; });
      startX = cx / (polyVerts.length || 1);
      startZ = cz / (polyVerts.length || 1);
    }

    // Try shifting along X by nudgeXFt safely
    let currentX = startX;
    const stepX = nudgeXFt >= 0 ? 0.25 : -0.25;
    const targetX = startX + nudgeXFt;
    for (let tx = startX; nudgeXFt >= 0 ? tx <= targetX : tx >= targetX; tx += stepX) {
      if (doesStructureFitAt(tx, startZ, polyVerts, arrayWFt, arrayDFt, 0.6)) {
        currentX = tx;
      } else {
        break; // Stop smoothly before touching wall!
      }
    }

    // Try shifting along Z by nudgeZFt safely
    let currentZ = startZ;
    const stepZ = nudgeZFt >= 0 ? 0.25 : -0.25;
    const targetZ = startZ + nudgeZFt;
    for (let tz = startZ; nudgeZFt >= 0 ? tz <= targetZ : tz >= targetZ; tz += stepZ) {
      if (doesStructureFitAt(currentX, tz, polyVerts, arrayWFt, arrayDFt, 0.6)) {
        currentZ = tz;
      } else {
        break; // Stop smoothly before touching wall!
      }
    }

    // Measure actual distance from structure edges to nearest wall in each cardinal direction
    const southClearance = Number(minDistanceToPolyWalls(currentX, currentZ - arrayDFt / 2, polyVerts).toFixed(1));
    const northClearance = Number(minDistanceToPolyWalls(currentX, currentZ + arrayDFt / 2, polyVerts).toFixed(1));
    const westClearance = Number(minDistanceToPolyWalls(currentX - arrayWFt / 2, currentZ, polyVerts).toFixed(1));
    const eastClearance = Number(minDistanceToPolyWalls(currentX + arrayWFt / 2, currentZ, polyVerts).toFixed(1));

    return {
      x: Number(currentX.toFixed(2)),
      z: Number(currentZ.toFixed(2)),
      southClearance,
      northClearance,
      westClearance,
      eastClearance
    };
  }, [baseCenter, nudgeXFt, nudgeZFt, polyVerts, arrayWFt, arrayDFt]);

  // Check whether active layout physically fits on this rooftop
  const roofFit = useMemo(() => {
    return checkRoofFit(layout, activeRoof);
  }, [layout, activeRoof]);

  // Building height map in feet and meters
  const floorConfig = useMemo(() => {
    const map = {
      'G': { floors: 1, heightFt: 10, heightM: 3.048, label: 'Ground Floor (G - 10 ft)' },
      'G+1': { floors: 2, heightFt: 20, heightM: 6.096, label: 'Ground + 1 Floor (G+1 - 20 ft) [Recommended]' },
      'G+2': { floors: 3, heightFt: 30, heightM: 9.144, label: 'Ground + 2 Floors (G+2 - 30 ft)' },
      'G+3': { floors: 4, heightFt: 40, heightM: 12.192, label: 'Ground + 3 Floors (G+3 - 40 ft)' }
    };
    return map[buildingFloors] || map['G+1'];
  }, [buildingFloors]);

  // Effective leg pairs based on dealer choice
  const legPairs = useMemo(() => {
    if (legCountChoice === '4') return 2;
    if (legCountChoice === '6') return 3;
    return layout?.bom?.frontLegs || 3;
  }, [legCountChoice, layout]);

  // Calculate elevation and pipe cuts based on frontLegFt & legPairs
  const elevation = useMemo(() => {
    return calculateLegHeights(layout, frontLegFt, tiltDegrees);
  }, [layout, frontLegFt, tiltDegrees]);

  const pipeSections = useMemo(() => {
    return calculateGiPipeSections(layout, frontLegFt, tiltDegrees, legPairs);
  }, [layout, frontLegFt, tiltDegrees, legPairs]);

  // Engineering Leg Schedule Data
  const legEngineeringData = useMemo(() => {
    const rows = [];
    const frontH = elevation.frontLegHeightFt;
    const rearH = elevation.rearLegHeightFt;
    const frontHMm = elevation.frontLegHeightMm;
    const rearHMm = elevation.rearLegHeightMm;

    const isRearWall = wallMountMode === 'rear_wall';
    const isFrontWall = wallMountMode === 'front_wall';

    const wallMountSpec = {
      basePlate: '100mm × 100mm × 8mm HDG L-Cleat Angle',
      fasteners: '2× M12 × 150mm High-Tensile Studs + Chemical Capsule (HIT-RE 500) + Spring Washers & Lock Nuts',
      mountType: 'Parapet Wall Anchored (दीवार में केमिकल स्टड)'
    };

    const floorMountSpec = {
      basePlate: '150mm × 150mm × 6mm MS Plate',
      fasteners: '4× M10 × 100mm Anchor Fasteners + Rubber Damping Pad',
      mountType: 'Terrace Floor Ballast / Slab Anchor (छत पर एंकर)'
    };

    if (legPairs === 2) {
      const flSpec = isFrontWall ? wallMountSpec : floorMountSpec;
      const rlSpec = isRearWall ? wallMountSpec : floorMountSpec;

      rows.push(
        {
          tag: 'FL-1',
          name: 'Front-Left Column (आगे बायाँ पैर)',
          pos: 'Front / South (आगे)',
          heightFt: frontH,
          heightMm: frontHMm,
          heightIn: (frontH * 12).toFixed(1),
          spec: '60mm × 40mm × 2.0mm HDG GI Box',
          basePlate: flSpec.basePlate,
          fasteners: flSpec.fasteners,
          mountType: flSpec.mountType,
          status: roofFit.fits ? '✓ Safe & Clear' : '⚠️ Warning: Exceeds Roof'
        },
        {
          tag: 'FR-2',
          name: 'Front-Right Column (आगे दायाँ पैर)',
          pos: 'Front / South (आगे)',
          heightFt: frontH,
          heightMm: frontHMm,
          heightIn: (frontH * 12).toFixed(1),
          spec: '60mm × 40mm × 2.0mm HDG GI Box',
          basePlate: flSpec.basePlate,
          fasteners: flSpec.fasteners,
          mountType: flSpec.mountType,
          status: roofFit.fits ? '✓ Safe & Clear' : '⚠️ Warning: Exceeds Roof'
        },
        {
          tag: 'RL-1',
          name: 'Rear-Left Column (पीछे बायाँ पैर)',
          pos: 'Rear / North (पीछे)',
          heightFt: rearH,
          heightMm: rearHMm,
          heightIn: (rearH * 12).toFixed(1),
          spec: '60mm × 40mm × 2.0mm HDG GI Box',
          basePlate: rlSpec.basePlate,
          fasteners: rlSpec.fasteners,
          mountType: rlSpec.mountType,
          status: roofFit.fits ? '✓ Safe & Clear' : '⚠️ Warning: Exceeds Roof'
        },
        {
          tag: 'RR-2',
          name: 'Rear-Right Column (पीछे दायाँ पैर)',
          pos: 'Rear / North (पीछे)',
          heightFt: rearH,
          heightMm: rearHMm,
          heightIn: (rearH * 12).toFixed(1),
          spec: '60mm × 40mm × 2.0mm HDG GI Box',
          basePlate: rlSpec.basePlate,
          fasteners: rlSpec.fasteners,
          mountType: rlSpec.mountType,
          status: roofFit.fits ? '✓ Safe & Clear' : '⚠️ Warning: Exceeds Roof'
        }
      );
    } else {
      const legNames = [
        { tag: 'FL-1', name: 'Front-Left Column (आगे बायाँ पैर)', pos: 'Front / South (आगे)', isFront: true },
        { tag: 'FC-2', name: 'Front-Center Column (आगे मध्य पैर)', pos: 'Front / South (आगे)', isFront: true },
        { tag: 'FR-3', name: 'Front-Right Column (आगे दायाँ पैर)', pos: 'Front / South (आगे)', isFront: true },
        { tag: 'RL-1', name: 'Rear-Left Column (पीछे बायाँ पैर)', pos: 'Rear / North (पीछे)', isFront: false },
        { tag: 'RC-2', name: 'Rear-Center Column (पीछे मध्य पैर)', pos: 'Rear / North (पीछे)', isFront: false },
        { tag: 'RR-3', name: 'Rear-Right Column (पीछे दायाँ पैर)', pos: 'Rear / North (पीछे)', isFront: false }
      ];

      legNames.forEach((l) => {
        const isFront = l.isFront;
        const h = isFront ? frontH : rearH;
        const hMm = isFront ? frontHMm : rearHMm;
        const spec = (isFront && isFrontWall) || (!isFront && isRearWall) ? wallMountSpec : floorMountSpec;

        rows.push({
          tag: l.tag,
          name: l.name,
          pos: l.pos,
          heightFt: h,
          heightMm: hMm,
          heightIn: (h * 12).toFixed(1),
          spec: '60mm × 40mm × 2.0mm HDG GI Box',
          basePlate: spec.basePlate,
          fasteners: spec.fasteners,
          mountType: spec.mountType,
          status: roofFit.fits ? '✓ Safe & Clear' : '⚠️ Warning: Exceeds Roof'
        });
      });
    }
    return rows;
  }, [legPairs, elevation, roofFit, wallMountMode]);

  const handleCopySchedule = () => {
    const text = legEngineeringData
      .map(
        r =>
          `${r.tag}: ${r.name} | H: ${r.heightFt} ft (${r.heightMm} mm) | ${r.spec} | Base: ${r.basePlate} | Fasteners: ${r.fasteners}`
      )
      .join('\n');
    navigator.clipboard?.writeText(
      `--- SUNVINE SOLAR STRUCTURE ENGINEERING REPORT ---\nHouse: ${floorConfig.label} (Terrace Ht: ${floorConfig.heightFt} ft)\nLayout: ${layout?.name} (${legPairs * 2} Legs)\nTilt: ${elevation.tiltDegrees}° South\n\n${text}`
    );
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF0F4F8); // Bright outdoor sky

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    if (savedCameraStateRef.current) {
      camera.position.copy(savedCameraStateRef.current.position);
    } else {
      camera.position.set(12, 10, 16);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 55;
    if (savedCameraStateRef.current) {
      controls.target.copy(savedCameraStateRef.current.target);
    } else {
      controls.target.set(0, 0, 0);
    }
    controlsRef.current = controls;

    const handleControlsChange = () => {
      savedCameraStateRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
    };
    controls.addEventListener('change', handleControlsChange);

    // 3. Lighting (Sun in South = -Z direction, dynamic with sunHour)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunAzimuthRad = ((sunHour - 12) * 16 * Math.PI) / 180;
    const sunAltitudeRad = ((72 - Math.abs(sunHour - 12) * 6.5) * Math.PI) / 180;
    const sunDist = 32;
    const sunX = sunDist * Math.cos(sunAltitudeRad) * Math.sin(sunAzimuthRad);
    const sunY = sunDist * Math.sin(sunAltitudeRad);
    const sunZ = -sunDist * Math.cos(sunAltitudeRad) * Math.cos(sunAzimuthRad);

    const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.4);
    sunLight.position.set(sunX, sunY, sunZ);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 65;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.4);
    scene.add(hemiLight);

    // 4. Materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.85,
      metalness: 0.05
    });

    const parapetMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      roughness: 0.85,
      metalness: 0.05
    });

    const copingMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      roughness: 0.7,
      metalness: 0.1
    });

    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
      roughness: 0.88,
      metalness: 0.03
    });

    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      roughness: 0.1,
      metalness: 0.85
    });

    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      roughness: 0.5
    });

    const buildingHeightM = floorConfig.heightM;
    const parapetHeightM = (activeRoof.parapetHeightFt !== undefined ? activeRoof.parapetHeightFt : 3.0) * 0.3048;
    const parapetThicknessM = 0.23;

    // Walls
    const polyWalls = getRoofWalls(polyVerts);

    // 5. Construct 2D Shape from Vertices (Shape Y = vz)
    const shape = new THREE.Shape();
    polyVerts.forEach((v, idx) => {
      const vx = v.x * 0.3048;
      const vz = v.z * 0.3048;
      if (idx === 0) shape.moveTo(vx, vz);
      else shape.lineTo(vx, vz);
    });
    shape.closePath();

    // 5a. Concrete Terrace Slab at Y = 0
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    const slab = new THREE.Mesh(slabGeo, floorMat);
    slab.rotation.x = Math.PI / 2;
    slab.position.y = 0;
    slab.receiveShadow = true;
    scene.add(slab);

    // 5b. Full House Building Extrusion (From Y = 0 down to Y = -buildingHeightM)
    const buildingGeo = new THREE.ExtrudeGeometry(shape, { depth: buildingHeightM, bevelEnabled: false });
    const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
    buildingMesh.rotation.x = Math.PI / 2;
    buildingMesh.position.y = 0;
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    scene.add(buildingMesh);

    // 5c. Floor Separation Cornice Bands & Windows
    const totalStories = floorConfig.floors;
    for (let f = 1; f <= totalStories; f++) {
      const bandY = -(f * 3.048);
      const floorCenterY = -((f - 0.5) * 3.048);

      polyWalls.forEach((w, idx) => {
        const p1 = w?.p1 || (polyVerts && polyVerts[idx]) || { x: 0, z: 0 };
        const p2 = w?.p2 || (polyVerts && polyVerts[(idx + 1) % (polyVerts.length || 1)]) || { x: 0, z: 0 };
        const x1 = (p1.x ?? 0) * 0.3048;
        const z1 = (p1.z ?? 0) * 0.3048;
        const x2 = (p2.x ?? 0) * 0.3048;
        const z2 = (p2.z ?? 0) * 0.3048;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.sqrt(dx * dx + dz * dz);
        const segAngle = Math.atan2(dz, dx);
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;

        if (f < totalStories) {
          const bandGeo = new THREE.BoxGeometry(segLen + 0.08, 0.18, parapetThicknessM + 0.06);
          const band = new THREE.Mesh(bandGeo, copingMat);
          band.position.set(midX, bandY, midZ);
          band.rotation.y = -segAngle;
          band.castShadow = true;
          scene.add(band);
        }
      });

      // Windows attached flush to actual building wall faces
      polyWalls.forEach((w, idx) => {
        const p1 = w?.p1 || (polyVerts && polyVerts[idx]) || { x: 0, z: 0 };
        const p2 = w?.p2 || (polyVerts && polyVerts[(idx + 1) % (polyVerts.length || 1)]) || { x: 0, z: 0 };
        const x1 = (p1.x ?? 0) * 0.3048;
        const z1 = (p1.z ?? 0) * 0.3048;
        const x2 = (p2.x ?? 0) * 0.3048;
        const z2 = (p2.z ?? 0) * 0.3048;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.sqrt(dx * dx + dz * dz);
        if (segLen >= 3.2 && idx < 2) {
          const segAngle = Math.atan2(dz, dx);
          const midX = (x1 + x2) / 2;
          const midZ = (z1 + z2) / 2;

          const wGroup = new THREE.Group();
          wGroup.position.set(midX, floorCenterY, midZ);
          wGroup.rotation.y = -segAngle;

          const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.06), windowFrameMat);
          wGroup.add(frame);
          const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.02), windowGlassMat);
          wGroup.add(glass);
          scene.add(wGroup);
        }
      });
    }

    // 5d. Ground Level Foundation Plane & Lawn at Y = -buildingHeightM
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -buildingHeightM;
    ground.receiveShadow = true;
    scene.add(ground);

    const lawnGeo = new THREE.PlaneGeometry(55, 60);
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x86EFAC, roughness: 0.9 });
    const lawn = new THREE.Mesh(lawnGeo, lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(-6, -buildingHeightM + 0.01, 6);
    lawn.receiveShadow = true;
    scene.add(lawn);

    // 5e. Parapet Walls along Rooftop Boundary
    if (parapetHeightM > 0.05) {
      polyWalls.forEach((w, idx) => {
        const p1 = w?.p1 || (polyVerts && polyVerts[idx]) || { x: 0, z: 0 };
        const p2 = w?.p2 || (polyVerts && polyVerts[(idx + 1) % (polyVerts.length || 1)]) || { x: 0, z: 0 };
        const x1 = (p1.x ?? 0) * 0.3048;
        const z1 = (p1.z ?? 0) * 0.3048;
        const x2 = (p2.x ?? 0) * 0.3048;
        const z2 = (p2.z ?? 0) * 0.3048;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.sqrt(dx * dx + dz * dz);
        const segAngle = Math.atan2(dz, dx);

        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;

        if (w?.hasOpening && (w?.openingWidthFt || 3.5) > 0) {
          const openW = Math.min(segLen * 0.8, (w.openingWidthFt || 3.5) * 0.3048);
          const remaining = (segLen - openW) / 2;
          if (remaining > 0.15) {
            // Segment A
            const segAOffset = -segLen / 2 + remaining / 2;
            const midAX = midX + Math.cos(segAngle) * segAOffset;
            const midAZ = midZ + Math.sin(segAngle) * segAOffset;
            const wallGeoA = new THREE.BoxGeometry(remaining, parapetHeightM, parapetThicknessM);
            const wallMeshA = new THREE.Mesh(wallGeoA, parapetMat);
            wallMeshA.position.set(midAX, parapetHeightM / 2, midAZ);
            wallMeshA.rotation.y = -segAngle;
            wallMeshA.castShadow = true;
            wallMeshA.receiveShadow = true;
            scene.add(wallMeshA);

            const copingGeoA = new THREE.BoxGeometry(remaining, 0.04, parapetThicknessM + 0.04);
            const copingMeshA = new THREE.Mesh(copingGeoA, copingMat);
            copingMeshA.position.set(midAX, parapetHeightM + 0.02, midAZ);
            copingMeshA.rotation.y = -segAngle;
            copingMeshA.castShadow = true;
            scene.add(copingMeshA);

            // Segment B
            const segBOffset = segLen / 2 - remaining / 2;
            const midBX = midX + Math.cos(segAngle) * segBOffset;
            const midBZ = midZ + Math.sin(segAngle) * segBOffset;
            const wallGeoB = new THREE.BoxGeometry(remaining, parapetHeightM, parapetThicknessM);
            const wallMeshB = new THREE.Mesh(wallGeoB, parapetMat);
            wallMeshB.position.set(midBX, parapetHeightM / 2, midBZ);
            wallMeshB.rotation.y = -segAngle;
            wallMeshB.castShadow = true;
            wallMeshB.receiveShadow = true;
            scene.add(wallMeshB);

            const copingGeoB = new THREE.BoxGeometry(remaining, 0.04, parapetThicknessM + 0.04);
            const copingMeshB = new THREE.Mesh(copingGeoB, copingMat);
            copingMeshB.position.set(midBX, parapetHeightM + 0.02, midBZ);
            copingMeshB.rotation.y = -segAngle;
            copingMeshB.castShadow = true;
            scene.add(copingMeshB);
          }
        } else {
          const wallGeo = new THREE.BoxGeometry(segLen, parapetHeightM, parapetThicknessM);
          const wallMesh = new THREE.Mesh(wallGeo, parapetMat);
          wallMesh.position.set(midX, parapetHeightM / 2, midZ);
          wallMesh.rotation.y = -segAngle;
          wallMesh.castShadow = true;
          wallMesh.receiveShadow = true;
          scene.add(wallMesh);

          const copingGeo = new THREE.BoxGeometry(segLen, 0.04, parapetThicknessM + 0.04);
          const copingMesh = new THREE.Mesh(copingGeo, copingMat);
          copingMesh.position.set(midX, parapetHeightM + 0.02, midZ);
          copingMesh.rotation.y = -segAngle;
          copingMesh.castShadow = true;
          scene.add(copingMesh);
        }
      });
    }

    // 5f. 3D Obstacles (Mumty Room & Water Tank)
    (activeRoof.obstacles || []).forEach(obs => {
      const ox = (obs.xRelFt || 0) * 0.3048;
      const oz = (obs.zRelFt || 0) * 0.3048;
      const elevationM = (obs.elevationFt || 0) * 0.3048;

      if (obs.type === 'box') {
        const bw = (obs.widthFt || 3) * 0.3048;
        const bd = (obs.depthFt || 6) * 0.3048;
        const bh = (obs.heightFt || 7) * 0.3048;

        const mumtyGroup = new THREE.Group();
        mumtyGroup.position.set(ox, elevationM, oz);

        const roomGeo = new THREE.BoxGeometry(bw, bh, bd);
        const roomMesh = new THREE.Mesh(roomGeo, parapetMat);
        roomMesh.position.y = bh / 2;
        roomMesh.castShadow = true;
        roomMesh.receiveShadow = true;
        mumtyGroup.add(roomMesh);

        const mumtyRoofGeo = new THREE.BoxGeometry(bw + 0.15, 0.08, bd + 0.15);
        const mumtyRoof = new THREE.Mesh(mumtyRoofGeo, copingMat);
        mumtyRoof.position.y = bh + 0.04;
        mumtyRoof.castShadow = true;
        mumtyRoof.receiveShadow = true;
        mumtyGroup.add(mumtyRoof);

        // Door
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
        const doorGeo = new THREE.BoxGeometry(Math.min(bw * 0.7, 0.8), Math.min(bh * 0.8, 1.8), 0.02);
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(0, 0.9, -bd / 2 - 0.01);
        mumtyGroup.add(doorMesh);

        scene.add(mumtyGroup);
      }

      if (obs.type === 'cylinder') {
        const r = (obs.radiusFt || 1.8) * 0.3048;
        const h = (obs.heightFt || 3) * 0.3048;

        const tankGroup = new THREE.Group();
        tankGroup.position.set(ox, elevationM, oz);

        // Stand / staging for tank if elevated
        if (elevationM > 0.05) {
          const standMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.4 });
          const standGeo = new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.08, 16);
          const standMesh = new THREE.Mesh(standGeo, standMat);
          standMesh.position.y = 0.04;
          standMesh.castShadow = true;
          tankGroup.add(standMesh);
        }

        const tankMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.3, metalness: 0.2 });
        const tankGeo = new THREE.CylinderGeometry(r, r, h, 24);
        const tankMesh = new THREE.Mesh(tankGeo, tankMat);
        tankMesh.position.y = (elevationM > 0.05 ? 0.08 : 0) + h / 2;
        tankMesh.castShadow = true;
        tankMesh.receiveShadow = true;
        tankGroup.add(tankMesh);

        // Tank lid
        const lidGeo = new THREE.CylinderGeometry(r * 0.65, r * 0.65, 0.06, 16);
        const lidMesh = new THREE.Mesh(lidGeo, tankMat);
        lidMesh.position.y = (elevationM > 0.05 ? 0.08 : 0) + h + 0.03;
        lidMesh.castShadow = true;
        tankGroup.add(lidMesh);

        scene.add(tankGroup);
      }
    });

    // 6. Solar Structure & PV Array Assembly
    const giMat = new THREE.MeshStandardMaterial({ color: 0xD1D5DB, metalness: 0.85, roughness: 0.3 });
    const clampMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.95, roughness: 0.2 });
    const basePlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.35 });
    const boltMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.9, roughness: 0.3 });
    const pvFrameMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.85, roughness: 0.25 });
    const pvCellMat = new THREE.MeshStandardMaterial({ color: 0x0B192C, roughness: 0.18, metalness: 0.85 });

    // Array dimensions in meters
    const arrayWM = (layout?.widthMm || 2278) / 1000;
    const arrayDM = (layout?.depthMm || 1134) / 1000;
    const frontHM = elevation.frontLegHeightMm / 1000;
    const rearHM = elevation.rearLegHeightMm / 1000;
    const legSpacing = arrayWM / Math.max(1, legPairs - 1);

    const structureGroup = new THREE.Group();

    // South is -Z (Top wall), North is +Z
    const frontZ = -arrayDM * 0.45; // South front leg (-Z)
    const rearZ = arrayDM * 0.45;   // North rear leg (+Z)
    const deltaZ = rearZ - frontZ;  // positive
    const deltaY = rearHM - frontHM; // positive
    const tiltAngle = Math.atan2(deltaY, deltaZ);
    const slopeLength = Math.sqrt(deltaZ * deltaZ + deltaY * deltaY);

    // Columns / Legs
    const colWidth = 0.06;
    const colDepth = 0.04;
    const basePlateGeo = new THREE.BoxGeometry(0.18, 0.015, 0.18);

    for (let i = 0; i < legPairs; i++) {
      const x = -arrayWM / 2 + (i * legSpacing);

      // Front Leg Column
      const fLegGeo = new THREE.BoxGeometry(colWidth, frontHM, colDepth);
      const fLeg = new THREE.Mesh(fLegGeo, giMat);
      fLeg.position.set(x, frontHM / 2, frontZ);
      fLeg.castShadow = true;
      structureGroup.add(fLeg);

      // Front Base Plate or Wall Cleat
      if (wallMountMode === 'front_wall') {
        const cleatGeo = new THREE.BoxGeometry(0.12, 0.12, 0.08);
        const cleatMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
        const cleat = new THREE.Mesh(cleatGeo, cleatMat);
        cleat.position.set(x, 0.08, frontZ - 0.03);
        structureGroup.add(cleat);

        const studGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8);
        const studMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.15 });
        const stud1 = new THREE.Mesh(studGeo, studMat);
        stud1.rotation.x = Math.PI / 2;
        stud1.position.set(x - 0.03, 0.08, frontZ - 0.08);
        structureGroup.add(stud1);
        const stud2 = new THREE.Mesh(studGeo, studMat);
        stud2.rotation.x = Math.PI / 2;
        stud2.position.set(x + 0.03, 0.08, frontZ - 0.08);
        structureGroup.add(stud2);
      } else {
        const fPlate = new THREE.Mesh(basePlateGeo, basePlateMat);
        fPlate.position.set(x, 0.008, frontZ);
        fPlate.receiveShadow = true;
        structureGroup.add(fPlate);
      }

      // Rear Leg Column
      const rLegGeo = new THREE.BoxGeometry(colWidth, rearHM, colDepth);
      const rLeg = new THREE.Mesh(rLegGeo, giMat);
      rLeg.position.set(x, rearHM / 2, rearZ);
      rLeg.castShadow = true;
      structureGroup.add(rLeg);

      // Rear Base Plate or Wall Cleat
      if (wallMountMode === 'rear_wall') {
        const cleatGeo = new THREE.BoxGeometry(0.12, 0.12, 0.08);
        const cleatMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
        const cleat = new THREE.Mesh(cleatGeo, cleatMat);
        cleat.position.set(x, 0.08, rearZ + 0.03);
        structureGroup.add(cleat);

        const studGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8);
        const studMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.15 });
        const stud1 = new THREE.Mesh(studGeo, studMat);
        stud1.rotation.x = Math.PI / 2;
        stud1.position.set(x - 0.03, 0.08, rearZ + 0.08);
        structureGroup.add(stud1);
        const stud2 = new THREE.Mesh(studGeo, studMat);
        stud2.rotation.x = Math.PI / 2;
        stud2.position.set(x + 0.03, 0.08, rearZ + 0.08);
        structureGroup.add(stud2);
      } else {
        const rPlate = new THREE.Mesh(basePlateGeo, basePlateMat);
        rPlate.position.set(x, 0.008, rearZ);
        rPlate.receiveShadow = true;
        structureGroup.add(rPlate);
      }
    }

    // 7. Tilted Plane Group Facing South
    const tableCenterY = (frontHM + rearHM) / 2;
    const tableCenterZ = (frontZ + rearZ) / 2;

    // Cross-Bracing / Diagonal Knee Supports
    if (crossBracingEnabled) {
      const braceMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.85, roughness: 0.25 });
      for (let i = 0; i < legPairs; i++) {
        const x = -arrayWM / 2 + (i * legSpacing);
        // Diagonal knee brace from rear leg to table
        const p1 = new THREE.Vector3(x, rearHM * 0.55, rearZ);
        const p2 = new THREE.Vector3(x, tableCenterY, tableCenterZ - 0.15);
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        const kGeo = new THREE.CylinderGeometry(0.018, 0.018, len, 8);
        const kBrace = new THREE.Mesh(kGeo, braceMat);
        kBrace.position.copy(p1).add(dir.clone().multiplyScalar(0.5));
        kBrace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        kBrace.castShadow = true;
        structureGroup.add(kBrace);
      }

      // X-Cross Bracing between bays along the X axis
      for (let i = 0; i < legPairs - 1; i++) {
        const x1 = -arrayWM / 2 + (i * legSpacing);
        const x2 = -arrayWM / 2 + ((i + 1) * legSpacing);
        const bayZ = rearZ;

        // Diagonal 1: (x1, 0.2) -> (x2, rearHM * 0.85)
        const v1 = new THREE.Vector3(x1, 0.2, bayZ);
        const v2 = new THREE.Vector3(x2, rearHM * 0.85, bayZ);
        const d1 = new THREE.Vector3().subVectors(v2, v1);
        const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, d1.length(), 8), braceMat);
        b1.position.copy(v1).add(d1.clone().multiplyScalar(0.5));
        b1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d1.clone().normalize());
        b1.castShadow = true;
        structureGroup.add(b1);

        // Diagonal 2: (x2, 0.2) -> (x1, rearHM * 0.85)
        const v3 = new THREE.Vector3(x2, 0.2, bayZ);
        const v4 = new THREE.Vector3(x1, rearHM * 0.85, bayZ);
        const d2 = new THREE.Vector3().subVectors(v4, v3);
        const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, d2.length(), 8), braceMat);
        b2.position.copy(v3).add(d2.clone().multiplyScalar(0.5));
        b2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d2.clone().normalize());
        b2.castShadow = true;
        structureGroup.add(b2);
      }
    }

    const tiltedPlaneGroup = new THREE.Group();
    tiltedPlaneGroup.position.set(0, tableCenterY, tableCenterZ);
    tiltedPlaneGroup.rotation.x = -tiltAngle; // Face South

    // Rafters
    const rafterGeo = new THREE.BoxGeometry(0.04, 0.04, slopeLength);
    for (let i = 0; i < legPairs; i++) {
      const x = -arrayWM / 2 + (i * legSpacing);
      const rafter = new THREE.Mesh(rafterGeo, giMat);
      rafter.position.set(x, 0.02, 0);
      rafter.castShadow = true;
      tiltedPlaneGroup.add(rafter);
    }

    // Purlins
    const rowCount = layout?.rows?.length || 1;
    const purlinGeo = new THREE.BoxGeometry(arrayWM + 0.15, 0.04, 0.04);
    for (let r = 0; r < rowCount; r++) {
      const rowLen = slopeLength / rowCount;
      const rowCenterZ = -slopeLength / 2 + (r + 0.5) * rowLen;
      const pz1 = rowCenterZ - rowLen * 0.25;
      const pz2 = rowCenterZ + rowLen * 0.25;

      [pz1, pz2].forEach(pz => {
        const purlin = new THREE.Mesh(purlinGeo, giMat);
        purlin.position.set(0, 0.06, pz);
        purlin.castShadow = true;
        tiltedPlaneGroup.add(purlin);
      });
    }

    // Modules
    const midClampGeo = new THREE.BoxGeometry(0.025, 0.04, 0.05);
    const endClampGeo = new THREE.BoxGeometry(0.025, 0.04, 0.05);
    const jBoltGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8);

    let startLocalZ = -slopeLength / 2;
    (layout?.rows || []).forEach(row => {
      const rowPanels = Array.isArray(row) ? row : [];
      if (rowPanels.length === 0) return;

      const firstPanel = rowPanels[0];
      const panelH = firstPanel.heightMm / 1000;
      const totalRowW = rowPanels.reduce((acc, p) => acc + p.widthMm / 1000, 0);
      let currentX = -totalRowW / 2;

      rowPanels.forEach((panel, pIdx) => {
        const pw = panel.widthMm / 1000 - 0.015;
        const ph = panel.heightMm / 1000 - 0.015;

        const pCenterX = currentX + panel.widthMm / 1000 / 2;
        const pCenterZ = startLocalZ + panelH / 2;

        const panelGroup = new THREE.Group();
        panelGroup.position.set(pCenterX, 0.0975, pCenterZ);

        const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.035, ph), pvFrameMat);
        frameMesh.castShadow = true;
        panelGroup.add(frameMesh);

        const waferMesh = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.015, 0.006, ph - 0.015), pvCellMat);
        waferMesh.position.set(0, 0.016, 0);
        waferMesh.castShadow = true;
        panelGroup.add(waferMesh);

        // J-Bolts
        [
          [-pw / 2 + 0.03, -ph / 2 + 0.03],
          [pw / 2 - 0.03, -ph / 2 + 0.03],
          [-pw / 2 + 0.03, ph / 2 - 0.03],
          [pw / 2 - 0.03, ph / 2 - 0.03]
        ].forEach(([bx, bz]) => {
          const bolt = new THREE.Mesh(jBoltGeo, boltMat);
          bolt.position.set(bx, -0.015, bz);
          panelGroup.add(bolt);
        });

        // Clamps
        if (pIdx === 0) {
          const endClampL = new THREE.Mesh(endClampGeo, clampMat);
          endClampL.position.set(-pw / 2 - 0.01, 0.01, 0);
          panelGroup.add(endClampL);
        }
        if (pIdx === rowPanels.length - 1) {
          const endClampR = new THREE.Mesh(endClampGeo, clampMat);
          endClampR.position.set(pw / 2 + 0.01, 0.01, 0);
          panelGroup.add(endClampR);
        } else {
          const midClamp = new THREE.Mesh(midClampGeo, clampMat);
          midClamp.position.set(pw / 2 + 0.008, 0.01, 0);
          panelGroup.add(midClamp);
        }

        tiltedPlaneGroup.add(panelGroup);
        currentX += panel.widthMm / 1000;
      });

      startLocalZ += panelH;
    });

    structureGroup.add(tiltedPlaneGroup);

    // Apply CLAMPED position (GUARANTEED INSIDE PARAPET BOUNDARIES!)
    const mountOffsetX = clampedMountCenter.x * 0.3048;
    const mountOffsetZ = clampedMountCenter.z * 0.3048;
    structureGroup.position.set(mountOffsetX, 0, mountOffsetZ);
    scene.add(structureGroup);

    // 8. 3D Visual Markings (100% Shadow-Free Zone & Wall Clearance Dimension Lines)
    if (showOverlays) {
      const overlayGroup = new THREE.Group();

      // 100% Polygon-Accurate Safe Solar Zone on Roof Floor
      // Dynamic setback based on parapet vs leg height:
      // If front leg is high (>= parapet), parapet cannot cast shadow on panels!
      const parapetFt = activeRoof.parapetHeightFt !== undefined ? activeRoof.parapetHeightFt : 3.0;
      const effectiveParapetOverhang = Math.max(0, parapetFt - frontLegFt);
      // Base setback is 1.0 ft for walking / maintenance clearance plus shadow extension
      const safeSetbackFt = Math.max(1.0, 1.0 + effectiveParapetOverhang * 0.5);
      const safeSetbackM = safeSetbackFt * 0.3048;

      // Calculate centroid of polyVerts
      let centroidX = 0, centroidZ = 0;
      const nVerts = polyVerts.length || 1;
      polyVerts.forEach(v => {
        centroidX += (v.x ?? 0) * 0.3048;
        centroidZ += (v.z ?? 0) * 0.3048;
      });
      centroidX /= nVerts;
      centroidZ /= nVerts;

      // Inset each vertex inward toward the centroid (100% inside polygon!)
      const safeVerts = polyVerts.map(v => {
        const vx = (v.x ?? 0) * 0.3048;
        const vz = (v.z ?? 0) * 0.3048;
        const dx = centroidX - vx;
        const dz = centroidZ - vz;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-4) return { x: vx, z: vz };
        const factor = Math.max(0.05, (dist - safeSetbackM) / dist);
        return {
          x: vx + dx * (1 - factor),
          z: vz + dz * (1 - factor)
        };
      });

      // Construct 2D Shape on Roof Floor (rotated to Y=0)
      if (safeVerts.length >= 3) {
        const safeShape = new THREE.Shape();
        safeVerts.forEach((pt, idx) => {
          if (idx === 0) safeShape.moveTo(pt.x, pt.z);
          else safeShape.lineTo(pt.x, pt.z);
        });
        safeShape.closePath();

        const safeGeo = new THREE.ShapeGeometry(safeShape);
        const szMat = new THREE.MeshBasicMaterial({
          color: 0x10B981,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide
        });
        const safeMesh = new THREE.Mesh(safeGeo, szMat);
        safeMesh.rotation.x = Math.PI / 2;
        safeMesh.position.y = 0.015;
        overlayGroup.add(safeMesh);

        // Border line outline
        const szLineMat = new THREE.LineBasicMaterial({ color: 0x10B981, linewidth: 2.5 });
        const outlinePoints = safeVerts.map(pt => new THREE.Vector3(pt.x, 0.02, pt.z));
        outlinePoints.push(new THREE.Vector3(safeVerts[0].x, 0.02, safeVerts[0].z));
        const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const szOutline = new THREE.Line(outlineGeo, szLineMat);
        overlayGroup.add(szOutline);
      }

      // Dimension Clearance Lines: raycast to actual polyWalls
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x0284C7,
        dashSize: 0.25,
        gapSize: 0.12,
        linewidth: 2
      });

      const findRayWallHit = (ox, oz, dx, dz) => {
        let bestDist = 15;
        for (let w of polyWalls) {
          const p1 = w?.p1 || { x: 0, z: 0 };
          const p2 = w?.p2 || { x: 0, z: 0 };
          const x1 = (p1.x ?? 0) * 0.3048, z1 = (p1.z ?? 0) * 0.3048;
          const x2 = (p2.x ?? 0) * 0.3048, z2 = (p2.z ?? 0) * 0.3048;
          const wx = x2 - x1, wz = z2 - z1;
          const denom = dx * wz - dz * wx;
          if (Math.abs(denom) < 1e-5) continue;
          const t = ((x1 - ox) * wz - (z1 - oz) * wx) / denom;
          const u = ((x1 - ox) * dz - (z1 - oz) * dx) / denom;
          if (t > 0 && u >= 0 && u <= 1 && t < bestDist) {
            bestDist = t;
          }
        }
        return {
          x: ox + dx * bestDist,
          z: oz + dz * bestDist
        };
      };

      // Line to South wall (-Z)
      const southArrayZ = mountOffsetZ + frontZ;
      const southHit = findRayWallHit(mountOffsetX, southArrayZ, 0, -1);
      const sGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(mountOffsetX, 0.03, southArrayZ),
        new THREE.Vector3(mountOffsetX, 0.03, southHit.z)
      ]);
      const sLine = new THREE.Line(sGeo, lineMat);
      sLine.computeLineDistances();
      overlayGroup.add(sLine);

      // Line to North wall (+Z)
      const northArrayZ = mountOffsetZ + rearZ;
      const northHit = findRayWallHit(mountOffsetX, northArrayZ, 0, 1);
      const nGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(mountOffsetX, 0.03, northArrayZ),
        new THREE.Vector3(mountOffsetX, 0.03, northHit.z)
      ]);
      const nLine = new THREE.Line(nGeo, lineMat);
      nLine.computeLineDistances();
      overlayGroup.add(nLine);

      // Line to West wall (-X)
      const westArrayX = mountOffsetX - arrayWM / 2;
      const westHit = findRayWallHit(westArrayX, mountOffsetZ, -1, 0);
      const wGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(westArrayX, 0.03, mountOffsetZ),
        new THREE.Vector3(westHit.x, 0.03, mountOffsetZ)
      ]);
      const wLine = new THREE.Line(wGeo, lineMat);
      wLine.computeLineDistances();
      overlayGroup.add(wLine);

      // Line to East wall (+X)
      const eastArrayX = mountOffsetX + arrayWM / 2;
      const eastHit = findRayWallHit(eastArrayX, mountOffsetZ, 1, 0);
      const eGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(eastArrayX, 0.03, mountOffsetZ),
        new THREE.Vector3(eastHit.x, 0.03, mountOffsetZ)
      ]);
      const eLine = new THREE.Line(eGeo, lineMat);
      eLine.computeLineDistances();
      overlayGroup.add(eLine);

      scene.add(overlayGroup);
    }

    // 9. True South Compass Arrow
    const compassGroup = new THREE.Group();
    const arrowDir = new THREE.Vector3(0, 0, -1);
    const arrowOrigin = new THREE.Vector3(mountOffsetX, 0.02, mountOffsetZ + frontZ - 1.2);
    const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowOrigin, 1.4, 0xEF4444, 0.4, 0.25);
    compassGroup.add(arrowHelper);
    scene.add(compassGroup);

    // 9. Animation Loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 10. Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', handleControlsChange);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [layout, elevation, activeRoof, floorConfig, legPairs, clampedMountCenter, wallMountMode, crossBracingEnabled]);

  // Handle Camera Presets
  const setCameraPreset = preset => {
    setViewPreset(preset);
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    if (preset === 'top') {
      camera.position.set(0, 16, 0.1);
      controls.target.set(0, 0, 0);
    } else if (preset === 'side') {
      camera.position.set(14, 4, clampedMountCenter.z * 0.3048);
      controls.target.set(clampedMountCenter.x * 0.3048, 1.5, clampedMountCenter.z * 0.3048);
    } else if (preset === 'front') {
      camera.position.set(clampedMountCenter.x * 0.3048, 4, (clampedMountCenter.z * 0.3048) - 9);
      controls.target.set(clampedMountCenter.x * 0.3048, 1.5, clampedMountCenter.z * 0.3048);
    } else if (preset === 'building') {
      camera.position.set(16, -floorConfig.heightM / 2, 22);
      controls.target.set(0, -floorConfig.heightM / 2, 0);
    } else {
      camera.position.set(12, 10, 16);
      controls.target.set(0, 0, 0);
    }
    controls.update();
    savedCameraStateRef.current = {
      position: camera.position.clone(),
      target: controls.target.clone()
    };
  };

  return (
    <div className="flex flex-col w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
      {/* 1. Top Header Bar */}
      <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="material-symbols-outlined text-[#6CBF3D] text-[22px]">view_in_ar</span>
          <span className="font-bold text-sm">3D Building &amp; Solar Structure Studio</span>

          {/* Roof Fit Badge */}
          {roofFit.fits ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              <span>100% Roof Safe (छत पर सुरक्षित)</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1 animate-pulse">
              <span className="material-symbols-outlined text-[13px]">warning</span>
              <span>❌ Exceeds Roof Space</span>
            </span>
          )}

          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/40 uppercase">
            Active: {activeRoof.name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenRoofDesigner && (
            <button
              type="button"
              onClick={onOpenRoofDesigner}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-400">roofing</span>
              <span>Edit Roof Shape &amp; Obstacles</span>
            </button>
          )}

          {/* Camera View Presets */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            {[
              { id: 'orbit', label: '3D Orbit', icon: '3d_rotation' },
              { id: 'building', label: 'Full House', icon: 'domain' },
              { id: 'top', label: 'Top View', icon: 'vertical_align_top' },
              { id: 'side', label: 'Side Slope', icon: 'straighten' },
              { id: 'front', label: 'Front (South)', icon: 'crop_landscape' }
            ].map(btn => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setCameraPreset(btn.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewPreset === btn.id
                    ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Interactive Pre-Config Control Bar: Floors & Leg Count */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
        {/* Floors */}
        <div className="flex items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[20px]">apartment</span>
            <div>
              <span className="text-xs font-bold block text-white">Building Height / Floors (मकान की मंज़िल):</span>
              <span className="text-[10px] text-slate-400">10 ft per story standard height</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'G', label: 'G (10 ft)' },
              { id: 'G+1', label: 'G+1 (20 ft) ★' },
              { id: 'G+2', label: 'G+2 (30 ft)' },
              { id: 'G+3', label: 'G+3 (40 ft)' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBuildingFloors(f.id)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  buildingFloors === f.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leg Count */}
        <div className="flex items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[20px]">hardware</span>
            <div>
              <span className="text-xs font-bold block text-white">Leg Count (लेग संख्या):</span>
              <span className="text-[10px] text-slate-400">Software recommended vs economy</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setLegCountChoice('6')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                legCountChoice === '6'
                  ? 'bg-[#6CBF3D] text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>⚡ 6 Legs (Suggested)</span>
            </button>
            <button
              type="button"
              onClick={() => setLegCountChoice('4')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                legCountChoice === '4'
                  ? 'bg-blue-500 text-white font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>4 Legs (Economy)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2b. Wall Anchoring & Wind Load Cross-Bracing Controls */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-white text-xs">
        {/* Foundation & Wall Anchoring Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[18px]">foundation</span>
            <div>
              <span className="font-bold text-white block">Leg Foundation Mode (फाउंडेशन / दीवार):</span>
              <span className="text-[10px] text-slate-400">
                {wallMountMode === 'all_floor'
                  ? 'Standard RCC slab fasteners (छत पर एंकर)'
                  : 'Parapet beam chemical anchor studs (दीवार में केमिकल स्टड)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'all_floor', label: 'All Floor (छत)', icon: 'crop_square' },
              { id: 'rear_wall', label: 'Rear Wall (दीवार)', icon: 'vertical_align_top' },
              { id: 'front_wall', label: 'Front Wall', icon: 'vertical_align_bottom' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setWallMountMode(m.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  wallMountMode === m.id
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Knee Support & Cross-Bracing */}
        <div className="flex items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">cyclone</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white">Cross-Bracing (150 km/h सपोर्ट):</span>
                {frontLegFt >= 6.0 && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 uppercase">
                    Recommended
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                {crossBracingEnabled
                  ? '✓ 40×40mm HDG Diagonal Knee & X-Bay Braces Included'
                  : 'Basic standard structure without diagonal supports'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCrossBracingEnabled(!crossBracingEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              crossBracingEnabled
                ? 'bg-[#6CBF3D] text-slate-950 shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {crossBracingEnabled ? 'check_circle' : 'add_circle'}
            </span>
            <span>{crossBracingEnabled ? 'Bracing Active' : 'Add Bracing'}</span>
          </button>
        </div>
      </div>

      {/* 2c. Interactive Structure Positioning Toolbar (छत पर स्ट्रक्चर की सटीक जगह सेट करें) */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-[#6CBF3D] text-[18px]">open_with</span>
            <span>Move Structure Across Roof:</span>
          </span>

          {/* Left/Right Nudge across full roof */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Left/Right:</span>
            <input
              type="range"
              min={-Math.max(15, Math.round(polyBounds.spanX * 0.45))}
              max={Math.max(15, Math.round(polyBounds.spanX * 0.45))}
              step="0.5"
              value={nudgeXFt}
              onChange={e => setNudgeXFt(parseFloat(e.target.value))}
              className="w-28 accent-[#6CBF3D] cursor-pointer"
            />
            <span className="font-mono text-slate-300 w-10 text-right">{nudgeXFt > 0 ? `+${nudgeXFt}` : nudgeXFt}&apos;</span>
          </div>

          {/* Front/Back Nudge across full roof */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Front/Back:</span>
            <input
              type="range"
              min={-Math.max(15, Math.round(polyBounds.spanZ * 0.45))}
              max={Math.max(15, Math.round(polyBounds.spanZ * 0.45))}
              step="0.5"
              value={nudgeZFt}
              onChange={e => setNudgeZFt(parseFloat(e.target.value))}
              className="w-28 accent-[#6CBF3D] cursor-pointer"
            />
            <span className="font-mono text-slate-300 w-10 text-right">{nudgeZFt > 0 ? `+${nudgeZFt}` : nudgeZFt}&apos;</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setNudgeXFt(0);
              setNudgeZFt(0);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
          >
            🎯 Auto-Center Inside Safe Zone
          </button>
        </div>

        {/* Live Wall Clearance Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold">Clearances to Walls:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            clampedMountCenter.southClearance < 1.5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            South: {clampedMountCenter.southClearance}ft
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            clampedMountCenter.northClearance < 1.5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            North: {clampedMountCenter.northClearance}ft
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            clampedMountCenter.westClearance < 1.5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            West: {clampedMountCenter.westClearance}ft
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            clampedMountCenter.eastClearance < 1.5 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            East: {clampedMountCenter.eastClearance}ft
          </span>
        </div>
      </div>

      {/* 2c. Sun Position & Shadow Simulation Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <span className="material-symbols-outlined text-amber-400 text-[18px]">wb_sunny</span>
            <span>Sun &amp; Shadow Simulation:</span>
          </div>

          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={() => setIsSunPlaying(!isSunPlaying)}
            className={`px-2.5 py-1 rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer transition-all ${
              isSunPlaying
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-amber-400 text-slate-950 hover:brightness-110'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {isSunPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isSunPlaying ? 'Pause Simulation' : 'Simulate Sun Cycle'}</span>
          </button>

          {/* Time Slider */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
            <input
              type="range"
              min="8.0"
              max="17.0"
              step="0.5"
              value={sunHour}
              onChange={e => {
                setIsSunPlaying(false);
                setSunHour(parseFloat(e.target.value));
              }}
              className="w-24 accent-amber-400 cursor-pointer"
            />
            <span className="font-mono font-bold text-amber-300 w-16 text-center text-[11px]">
              {getSunHourLabel(sunHour)}
            </span>
          </div>

          <span className="text-[10px] text-slate-400">
            {sunHour < 11
              ? '🌅 पूर्व की धूप (सुबह)'
              : sunHour <= 13.5
              ? '☀️ दोपहर 12 बजे (साउथ सूर्य - न्यूनतम छाया)'
              : '🌇 शाम का सूर्य (पश्चिम धूप)'}
          </span>
        </div>

        {/* 3D Clearance & Shadow Overlays Toggle */}
        <button
          type="button"
          onClick={() => setShowOverlays(!showOverlays)}
          className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
            showOverlays
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          <span>{showOverlays ? '✓ 3D Markings & Shadow-Free Zone ON' : 'Show 3D Markings'}</span>
        </button>
      </div>

      {/* 3. 3D WebGL Canvas Container */}
      <div className="relative w-full h-[430px] sm:h-[500px] bg-slate-900 cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full" />

        {/* Overhang Warning */}
        {!roofFit.fits && (
          <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-rose-950/95 backdrop-blur-md p-3.5 rounded-xl border-2 border-rose-500 text-white shadow-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-rose-400 text-[26px] shrink-0">error</span>
            <div className="text-xs flex flex-col gap-1">
              <span className="font-black text-rose-200 uppercase tracking-wide">
                ⚠️ Rooftop Boundary Warning:
              </span>
              <p className="text-rose-100">
                यह डिज़ाइन छत के शैडो-फ्री स्पेस में फिट नहीं बैठता!
              </p>
              <div className="mt-1 bg-black/40 p-2 rounded text-[11px] text-rose-200">
                <div>• Required: <b>{roofFit.arrayWidthFt} ft × {roofFit.arrayDepthFt} ft</b></div>
                <div>• Available: <b>{roofFit.availableWidthFt} ft × {roofFit.availableDepthFt} ft</b></div>
                <div className="font-bold text-amber-300 mt-0.5">• {roofFit.reason}</div>
              </div>
            </div>
          </div>
        )}

        {/* South Orientation Badge */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-rose-500/40 text-xs font-bold text-white flex items-center gap-1.5 shadow-md">
          <span className="material-symbols-outlined text-rose-500 text-[16px] animate-pulse">explore</span>
          <span>🧭 South Facing (Top 30ft Wall)</span>
        </div>

        {/* Live Elevation Info Overlay */}
        <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-xs text-white flex flex-col gap-1 shadow-md text-right">
          <div className="text-[11px] text-slate-400 font-semibold">House &amp; Slope Profile:</div>
          <div>House Height: <b className="text-amber-400">{floorConfig.heightFt} ft</b> ({floorConfig.floors} Floors)</div>
          <div>Front Leg Height: <b className="text-[#6CBF3D]">{elevation.frontLegHeightFt} ft</b> ({elevation.frontLegHeightMm} mm)</div>
          <div>Rear Leg Height: <b className="text-amber-400">{elevation.rearLegHeightFt} ft</b> ({elevation.rearLegHeightMm} mm)</div>
          <div>Total Leg Columns: <b className="text-white">{legPairs * 2} Legs</b></div>
        </div>
      </div>

      {/* 4. Front Leg Height Slider & Elevated Controls (Up to 12ft Walkable / Gazebo) */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#6CBF3D] text-[22px]">height</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">
                Front Leg / Clear Height (आगे के पैर की ऊंचाई):
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-[#6CBF3D]/20 text-[#6CBF3D]">
                {frontLegFt >= 7 ? '🚶 Walkable / Elevated Structure' : '⚡ Standard Ballast Structure'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              पीछे के पैर (Rear legs) 18° साउथ टिल्ट के अनुसार अपने-आप सेट होते हैं।
            </span>
          </div>
        </div>

        {/* Quick Height Presets & Direct Number Input */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { val: 2.5, label: '2.5 ft' },
              { val: 4.5, label: '4.5 ft' },
              { val: 7.0, label: '7 ft (Walkable)' },
              { val: 8.5, label: '8.5 ft (Gazebo)' },
              { val: 10.0, label: '10 ft (High)' }
            ].map(preset => (
              <button
                key={`leg_preset_${preset.val}`}
                type="button"
                onClick={() => setFrontLegFt(preset.val)}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  frontLegFt === preset.val
                    ? 'bg-[#6CBF3D] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
            <input
              type="range"
              min="1.5"
              max="12.0"
              step="0.25"
              value={frontLegFt}
              onChange={e => setFrontLegFt(parseFloat(e.target.value))}
              className="w-28 accent-[#6CBF3D] cursor-pointer"
            />
            <input
              type="number"
              step="0.5"
              min="1.5"
              max="14.0"
              value={frontLegFt}
              onChange={e => setFrontLegFt(parseFloat(e.target.value) || 2.5)}
              className="w-14 h-6 text-center font-mono font-bold text-xs bg-slate-950 text-[#6CBF3D] border border-slate-700 rounded outline-none focus:border-[#6CBF3D]"
            />
            <span className="text-xs text-slate-400 font-bold">ft</span>
          </div>
        </div>
      </div>

      {/* 5. Detailed Leg Height Engineering Report Table */}
      <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col gap-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#6CBF3D] text-[22px]">assignment</span>
              <h4 className="text-sm font-bold text-white tracking-wide">
                Solar Structure Leg Height &amp; Foundation Engineering Report (सटीक लेग ऊंचाई रिपोर्ट)
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              प्रत्येक लेग की कटिंग ऊंचाई, बेस प्लेट व एंकर फास्टनर विवरण (Site Installation Sheet)
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySchedule}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-400">
              {copySuccess ? 'check' : 'content_copy'}
            </span>
            <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy Leg Specs'}</span>
          </button>
        </div>

        {/* Engineering Specs Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700/80 font-bold">
                <th className="p-3">Leg Mark</th>
                <th className="p-3">Leg Description</th>
                <th className="p-3">Position</th>
                <th className="p-3 text-right">Height (Feet)</th>
                <th className="p-3 text-right">Height (mm)</th>
                <th className="p-3">GI Pipe Section</th>
                <th className="p-3">Base Plate</th>
                <th className="p-3">Anchor Fasteners</th>
                <th className="p-3">Roof Safety</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {legEngineeringData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                  <td className="p-3 font-black text-amber-400">{row.tag}</td>
                  <td className="p-3 font-semibold text-white">{row.name}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.pos.includes('Front')
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {row.pos}
                    </span>
                  </td>
                  <td className="p-3 text-right font-black text-white">{row.heightFt} ft</td>
                  <td className="p-3 text-right font-bold text-slate-300">{row.heightMm} mm</td>
                  <td className="p-3 text-slate-300">{row.spec}</td>
                  <td className="p-3 text-slate-300">{row.basePlate}</td>
                  <td className="p-3 text-slate-300">{row.fasteners}</td>
                  <td className="p-3 font-semibold">
                    <span className={row.status.includes('Safe') ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Civil & Mechanical Key Figures Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">Total Columns (Legs):</span>
            <span className="text-xl font-black text-white mt-1">
              {legPairs * 2} <span className="text-xs font-normal text-slate-400">Pcs</span>
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {legPairs} Front ({elevation.frontLegHeightFt}ft) + {legPairs} Rear ({elevation.rearLegHeightFt}ft)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">Base Plates:</span>
            <span className="text-xl font-black text-blue-400 mt-1">
              {legPairs * 2} <span className="text-xs font-normal text-slate-400">Pcs</span>
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">150×150×6mm MS Galvanized</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">Fasteners &amp; Studs:</span>
            <span className="text-xl font-black text-amber-400 mt-1">
              {wallMountMode === 'all_floor'
                ? `${(legPairs * 2) * 4} Pcs`
                : `${(legPairs * 4)} M10 + ${legPairs * 2} M12`}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {wallMountMode === 'all_floor'
                ? '4 per leg (M10×100mm Anchor Bolts)'
                : `${legPairs} Wall Cleats + M12 Chemical Studs`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">Wind Load Rating:</span>
            <span className="text-xl font-black text-emerald-400 mt-1">
              {crossBracingEnabled ? '150 km/h ★' : '130 km/h'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {crossBracingEnabled ? 'Knee & X-Bay Bracing Certified' : 'IS 875 Part 3 Standard'}
            </span>
          </div>
        </div>

        {/* 6. 20-Ft Standard GI Pipe Cutting Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* 60x40 Pipe (Columns/Legs) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                60mm × 40mm GI Pipe (Legs / Columns)
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {pipeSections.legs60x40.totalPipesCount} Pipes (20-ft Standard)
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Total Required: <b>{pipeSections.legs60x40.totalLengthFt} ft</b> (From {pipeSections.legs60x40.totalPipesFeet} ft stock)
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {pipeSections.legs60x40.pipes.map(p => (
                <div key={p.pipeIndex} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold text-white">Pipe #{p.pipeIndex} (20 ft):</span>
                    <span>Used: <b className="text-white">{p.usedFt} ft</b> | Scrap: <b className="text-amber-400">{p.remainingFt} ft</b></span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cuts: {p.cuts.map(c => `${c.label} (${c.lengthFt} ft)`).join(' + ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 40x40 Pipe (Rafters & Purlins) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                40mm × 40mm GI Pipe (Rafters &amp; Purlins)
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {pipeSections.raftersPurlins40x40.totalPipesCount} Pipes (20-ft Standard)
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Total Required: <b>{pipeSections.raftersPurlins40x40.totalLengthFt} ft</b> (From {pipeSections.raftersPurlins40x40.totalPipesFeet} ft stock)
            </div>
            <div className="flex flex-col gap-1.5 mt-1 max-h-[160px] overflow-y-auto pr-1">
              {pipeSections.raftersPurlins40x40.pipes.map(p => (
                <div key={p.pipeIndex} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold text-white">Pipe #{p.pipeIndex} (20 ft):</span>
                    <span>Used: <b className="text-white">{p.usedFt} ft</b> | Scrap: <b className="text-amber-400">{p.remainingFt} ft</b></span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Cuts: {p.cuts.map(c => `${c.label} (${c.lengthFt} ft)`).join(' + ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
