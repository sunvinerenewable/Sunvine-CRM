import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { hardwareService } from '../../services/hardwareService';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';

export default function HardwareMaster() {
  const {
    modulesList,
    setModulesList,
    invertersList,
    setInvertersList,
    addNotification,
    pdfBomSpecs,
    dealers,
    isHardwareDbConnected,
    isHardwareDbSyncing
  } = useApp();
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'inverters' | 'bos'
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [inverterSearch, setInverterSearch] = useState('');
  const [inverterFilter, setInverterFilter] = useState('all');
  const [bosCapacityFilter, setBosCapacityFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddInverterModal, setShowAddInverterModal] = useState(false);
  const [modulesViewMode, setModulesViewMode] = useTableViewMode('admin_hw_modules');
  const [invertersViewMode, setInvertersViewMode] = useTableViewMode('admin_hw_inverters');

  // Import Specs Modal state (SR-22)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedPreviewItems, setImportedPreviewItems] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  // Bulk Price Update Modal state (SR-22)
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkRates, setBulkRates] = useState({});
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState('percent'); // 'percent' | 'flat'
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState('');

  const DEFAULT_CELL_TECHS = [
    'TOPCon Mono Bifacial',
    'N-Type TOPCon',
    'Mono PERC',
    'Mono PERC Half-Cut',
    'HJT Ultra-Efficiency',
    'Polycrystalline DCR',
    'Bifacial Dual-Glass TOPCon'
  ];

  const [editingModule, setEditingModule] = useState(null);
  const [editingInverter, setEditingInverter] = useState(null);
  const [isCustomCellTech, setIsCustomCellTech] = useState(false);
  const [customCellTechInput, setCustomCellTechInput] = useState('');

  // Dynamically derived from DB catalog and defaults — no local storage fragmentation
  const availableCellTechs = Array.from(new Set([
    ...DEFAULT_CELL_TECHS,
    ...(modulesList || []).map(m => m.cellTech).filter(Boolean)
  ]));

  const [moduleForm, setModuleForm] = useState({
    brand: '',
    model: '',
    cellTech: 'TOPCon Mono Bifacial',
    wattage: '550',
    efficiency: '22.6%',
    ratePerWp: '19.20',
    warranty: '30 Years Performance',
    dimensions: '2278 × 1134 × 30 mm | 28 kg'
  });

  const [inverterForm, setInverterForm] = useState({
    brand: '',
    model: '',
    capacity: '5 kW',
    phase: '3-Phase 415V',
    efficiency: '98.4%',
    warranty: '10 Years'
  });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleForm({
      brand: '',
      model: '',
      cellTech: 'TOPCon Mono Bifacial',
      wattage: '550',
      efficiency: '22.6%',
      ratePerWp: '19.20',
      warranty: '30 Years Performance',
      dimensions: '2278 × 1134 × 30 mm | 28 kg'
    });
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
    setShowAddModuleModal(true);
  };

  const handleEditModule = (mod) => {
    setEditingModule(mod);
    setModuleForm({
      brand: mod.brand || '',
      model: mod.model || '',
      cellTech: mod.cellTech || 'TOPCon Mono Bifacial',
      wattage: String(mod.wattage || 550),
      efficiency: mod.efficiency || '22.6%',
      ratePerWp: mod.ratePerWp ? String(mod.ratePerWp).replace(/[^0-9.]/g, '') : '19.20',
      warranty: mod.warranty || '30 Years Performance',
      dimensions: mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'
    });
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
    setShowAddModuleModal(true);
  };

  const handleToggleArchiveModule = async (mod) => {
    const isCurrentlyArchived = !!mod.isArchived;
    const confirmMsg = isCurrentlyArchived
      ? `Restore and unarchive ${mod.brand} ${mod.model} to active dealer catalog?`
      : `Archive ${mod.brand} ${mod.model}? It will be hidden from dealer quotation selection.`;

    if (window.confirm(confirmMsg)) {
      const updated = { ...mod, isArchived: !isCurrentlyArchived };
      if (setModulesList) {
        setModulesList(prev => prev.map(m => m.id === mod.id ? updated : m));
      }
      await hardwareService.archiveModule(mod.id, !isCurrentlyArchived);

      if (addNotification) {
        addNotification({
          type: isCurrentlyArchived ? 'success' : 'warning',
          icon: isCurrentlyArchived ? 'unarchive' : 'archive',
          title: isCurrentlyArchived ? `Solar Module Restored: ${mod.brand} ${mod.model}` : `Solar Module Archived: ${mod.brand} ${mod.model}`,
          description: isCurrentlyArchived
            ? `${mod.brand} ${mod.model} re-enabled for all dealer proposals.`
            : `${mod.brand} ${mod.model} archived and disabled from dealer quotation selection.`,
          audience: 'all'
        });
      }
      triggerToast(isCurrentlyArchived ? `Restored ${mod.brand} ${mod.model} in database!` : `Archived ${mod.brand} ${mod.model} in database!`);
    }
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleForm.brand.trim() || !moduleForm.model.trim()) return;

    let finalCellTech = moduleForm.cellTech;
    if (isCustomCellTech && customCellTechInput.trim()) {
      finalCellTech = customCellTechInput.trim();
    }

    const wattageNum = Number(moduleForm.wattage) || 550;
    const rateClean = String(moduleForm.ratePerWp).replace(/[^0-9.]/g, '') || '19.20';
    const rateFormatted = `₹ ${rateClean}/Wp`;

    if (editingModule) {
      const updatedMod = {
        ...editingModule,
        brand: moduleForm.brand.trim(),
        model: moduleForm.model.trim(),
        cellTech: finalCellTech,
        wattage: wattageNum,
        efficiency: moduleForm.efficiency.trim() || '22.6%',
        ratePerWp: rateFormatted,
        warranty: moduleForm.warranty.trim() || '30 Years Performance',
        dimensions: moduleForm.dimensions?.trim() || editingModule.dimensions || '2278 × 1134 × 30 mm | 28 kg'
      };

      const isUnchanged =
        editingModule.brand === updatedMod.brand &&
        editingModule.model === updatedMod.model &&
        editingModule.cellTech === updatedMod.cellTech &&
        Number(editingModule.wattage) === Number(updatedMod.wattage) &&
        (editingModule.efficiency || '') === (updatedMod.efficiency || '') &&
        (editingModule.ratePerWp || '') === (updatedMod.ratePerWp || '') &&
        (editingModule.warranty || '') === (updatedMod.warranty || '') &&
        (editingModule.dimensions || '') === (updatedMod.dimensions || '');

      if (isUnchanged) {
        setShowAddModuleModal(false);
        setEditingModule(null);
        triggerToast('No changes detected in module specifications.');
        return;
      }

      if (setModulesList) {
        setModulesList(prev => prev.map(m => m.id === editingModule.id ? updatedMod : m));
      }
      await hardwareService.saveModule(updatedMod);

      if (addNotification) {
        addNotification({
          type: 'success',
          icon: 'solar_power',
          title: `Updated Solar Module: ${updatedMod.brand} ${updatedMod.model}`,
          description: `${updatedMod.wattage}W (${updatedMod.cellTech}) specifications updated in database.`,
          audience: 'all',
          targetTab: 'create_quote'
        });
      }
      triggerToast(`Saved ${updatedMod.brand} ${updatedMod.model} to Supabase database!`);
    } else {
      const newMod = {
        id: `mod-${Date.now()}`,
        brand: moduleForm.brand.trim(),
        model: moduleForm.model.trim(),
        cellTech: finalCellTech,
        wattage: wattageNum,
        efficiency: moduleForm.efficiency.trim() || '22.6%',
        ratePerWp: rateFormatted,
        warranty: moduleForm.warranty.trim() || '30 Years Performance',
        dimensions: moduleForm.dimensions?.trim() || '2278 × 1134 × 30 mm | 28 kg',
        isNew: true,
        createdAt: Date.now()
      };

      if (setModulesList) {
        setModulesList(prev => [newMod, ...(prev || [])]);
      }
      await hardwareService.saveModule(newMod);

      if (addNotification) {
        addNotification({
          type: 'success',
          icon: 'solar_power',
          title: `New Solar Module Added: ${newMod.brand} ${newMod.model}`,
          description: `High-efficiency ${newMod.wattage}W (${newMod.cellTech}) published to Supabase database.`,
          audience: 'all',
          targetTab: 'create_quote'
        });
      }
      triggerToast(`Added ${newMod.brand} ${newMod.model} to Supabase database!`);
    }

    setShowAddModuleModal(false);
    setEditingModule(null);
    setIsCustomCellTech(false);
    setCustomCellTechInput('');
  };

  const getInverterCapacityText = (inv) => {
    if (inv?.capacity) {
      return String(inv.capacity).toLowerCase().includes('kw') ? inv.capacity : `${inv.capacity} kW`;
    }
    if (inv?.capacityKW !== undefined && inv?.capacityKW !== null) {
      return `${inv.capacityKW} kW`;
    }
    const match = inv?.model?.match(/(\d+(?:\.\d+)?)\s*KW/i);
    if (match) {
      return `${match[1]} kW`;
    }
    return '-';
  };

  const handleOpenAddInverter = () => {
    setEditingInverter(null);
    setInverterForm({
      brand: '',
      model: '',
      capacity: '5 kW',
      phase: '3-Phase 415V',
      efficiency: '98.4%',
      warranty: '10 Years',
      basePrice: '₹ 54,000'
    });
    setShowAddInverterModal(true);
  };

  const handleEditInverter = (inv) => {
    setEditingInverter(inv);
    setInverterForm({
      brand: inv.brand || '',
      model: inv.model || '',
      capacity: inv.capacity || `${inv.capacityKW || 5.0} kW`,
      phase: inv.phase || '3-Phase 415V',
      efficiency: inv.efficiency || '98.4%',
      warranty: inv.warranty || '10 Years',
      basePrice: inv.basePrice || '₹ 54,000'
    });
    setShowAddInverterModal(true);
  };

  const handleToggleArchiveInverter = async (inv) => {
    const isCurrentlyArchived = !!inv.isArchived;
    const confirmMsg = isCurrentlyArchived
      ? `Restore and unarchive ${inv.brand} ${inv.model} to active catalog?`
      : `Archive ${inv.brand} ${inv.model}? It will be hidden from dealer quotations.`;

    if (window.confirm(confirmMsg)) {
      const updated = { ...inv, isArchived: !isCurrentlyArchived };
      if (setInvertersList) {
        setInvertersList(prev => (prev || []).map(i => i.id === inv.id ? updated : i));
      }
      await hardwareService.archiveInverter(inv.id, !isCurrentlyArchived);
      triggerToast(isCurrentlyArchived ? `Restored ${inv.brand} ${inv.model} in database!` : `Archived ${inv.brand} ${inv.model} in database!`);
    }
  };

  const handleSaveInverter = async (e) => {
    e.preventDefault();
    if (!inverterForm.brand.trim() || !inverterForm.model.trim()) return;
    const rawCap = inverterForm.capacity?.trim() || '5.0 kW';
    const formattedCap = rawCap.toLowerCase().includes('kw') ? rawCap : `${rawCap} kW`;
    const numCap = parseFloat(rawCap.replace(/[^0-9.]/g, '')) || 5.0;

    if (editingInverter) {
      const updatedInv = {
        ...editingInverter,
        brand: inverterForm.brand.trim(),
        model: inverterForm.model.trim(),
        capacity: formattedCap,
        capacityKW: numCap,
        phase: inverterForm.phase,
        efficiency: inverterForm.efficiency,
        warranty: inverterForm.warranty,
        basePrice: inverterForm.basePrice || editingInverter.basePrice || '₹ 54,000'
      };
      if (setInvertersList) {
        setInvertersList(prev => (prev || []).map(i => i.id === editingInverter.id ? updatedInv : i));
      }
      await hardwareService.saveInverter(updatedInv);
      triggerToast(`Saved ${updatedInv.brand} ${updatedInv.model} to Supabase database!`);
      setEditingInverter(null);
    } else {
      const newInv = {
        id: `inv-${Date.now()}`,
        brand: inverterForm.brand.trim(),
        model: inverterForm.model.trim(),
        capacity: formattedCap,
        capacityKW: numCap,
        phase: inverterForm.phase,
        efficiency: inverterForm.efficiency,
        warranty: inverterForm.warranty,
        basePrice: inverterForm.basePrice || '₹ 54,000',
        createdAt: Date.now()
      };
      if (setInvertersList) {
        setInvertersList(prev => [...(prev || []), newInv]);
      }
      await hardwareService.saveInverter(newInv);
      triggerToast(`Added ${newInv.brand} ${newInv.model} to Supabase database!`);
    }

    setShowAddInverterModal(false);
    setInverterForm({
      brand: '',
      model: '',
      capacity: '5 kW',
      phase: '3-Phase 415V',
      efficiency: '98.4%',
      warranty: '10 Years',
      basePrice: '₹ 54,000'
    });
  };

  // ==========================================
  // HARDWARE CATALOG CONTROLS (SR-22)
  // ==========================================

  // 1. Export Ledger to CSV
  const handleExportLedger = () => {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      let csv = '=== SUNVINE RENEWABLE ENERGY - SOLAR HARDWARE CATALOG ===\n';
      csv += `Export Date: ${new Date().toLocaleString('en-IN')}\n\n`;

      // 1. Solar Modules
      csv += '--- APPROVED SOLAR PHOTOVOLTAIC MODULES ---\n';
      csv += 'Brand,Model,Cell Technology,Rated Wattage (Wp),Efficiency,Benchmark Rate (₹/Wp),Product & Power Warranty,Physical Dimensions,Status\n';
      (modulesList || []).forEach(m => {
        const row = [
          `"${(m.brand || '').replace(/"/g, '""')}"`,
          `"${(m.model || '').replace(/"/g, '""')}"`,
          `"${(m.cellTech || '').replace(/"/g, '""')}"`,
          m.wattage || '',
          `"${(m.efficiency || '').replace(/"/g, '""')}"`,
          `"${(m.ratePerWp || '').replace(/"/g, '""')}"`,
          `"${(m.warranty || '').replace(/"/g, '""')}"`,
          `"${(m.dimensions || '').replace(/"/g, '""')}"`,
          m.isArchived ? 'Archived' : 'Active'
        ];
        csv += row.join(',') + '\n';
      });

      // 2. Solar Inverters
      csv += '\n--- APPROVED SOLAR STRING INVERTERS ---\n';
      csv += 'Brand,Model / Series,Rated Capacity (kW),Phase Topology,Peak Efficiency,Manufacturer Warranty,Status\n';
      (invertersList || []).forEach(inv => {
        const row = [
          `"${(inv.brand || '').replace(/"/g, '""')}"`,
          `"${(inv.model || '').replace(/"/g, '""')}"`,
          `"${getInverterCapacityText(inv).replace(/"/g, '""')}"`,
          `"${(inv.phase || '').replace(/"/g, '""')}"`,
          `"${(inv.efficiency || '').replace(/"/g, '""')}"`,
          `"${(inv.warranty || '').replace(/"/g, '""')}"`,
          inv.isArchived ? 'Archived' : 'Active'
        ];
        csv += row.join(',') + '\n';
      });

      // 3. BOM Specs
      if (pdfBomSpecs && pdfBomSpecs.length > 0) {
        csv += '\n--- BILL OF MATERIALS (BOM) BENCHMARK SPECIFICATIONS ---\n';
        csv += 'Component Category,Item Description & Make,Specification & Standard,Benchmark Scope\n';
        pdfBomSpecs.forEach(b => {
          const row = [
            `"${(b.category || '').replace(/"/g, '""')}"`,
            `"${(b.item || '').replace(/"/g, '""')}"`,
            `"${(b.spec || '').replace(/"/g, '""')}"`,
            `"${(b.scope || 'Turnkey EPC Scope').replace(/"/g, '""')}"`
          ];
          csv += row.join(',') + '\n';
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Sunvine_Solar_Hardware_Catalog_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast('Hardware catalog inventory spreadsheet exported successfully!');
    } catch (err) {
      console.error(err);
      triggerToast('Failed to export catalog spreadsheet');
    }
  };

  // 2. Download Sample CSV Template for Import
  const handleDownloadSampleCsvTemplate = () => {
    const csv = `Brand,Model,Cell Technology,Rated Wattage,Efficiency,Rate Per Wp,Warranty,Dimensions
Waaree,585W TOPCon Bifacial,N-Type TOPCon,585,22.6%,19.50,30 Years Performance,2278 × 1134 × 30 mm | 28 kg
Rayzone,600W Bi-Fi Elite,TOPCon Mono Bifacial,600,22.8%,19.80,30 Years Performance,2278 × 1134 × 30 mm | 28 kg
Adani Solar,550W Vertex Dual Glass,Mono PERC,550,21.5%,18.90,25 Years Performance,2278 × 1134 × 30 mm | 28 kg`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sunvine_hardware_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Sample CSV template downloaded!');
  };

  // 3. File upload and parse handler for Import
  const handleFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportedPreviewItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (!text || typeof text !== 'string') {
          setImportError('File is empty or unreadable.');
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('===') && !l.startsWith('---'));
        if (lines.length < 2) {
          setImportError('No valid data rows found in file.');
          return;
        }

        const headerLine = lines[0];
        const delimiter = headerLine.includes('\t') ? '\t' : ',';
        const headers = headerLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

        const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('oem') || h.includes('make'));
        const modelIdx = headers.findIndex(h => h.includes('model') || h.includes('series'));
        const cellTechIdx = headers.findIndex(h => h.includes('cell') || h.includes('tech'));
        const wattIdx = headers.findIndex(h => h.includes('watt') || h.includes('capacity') || h.includes('power'));
        const effIdx = headers.findIndex(h => h.includes('eff'));
        const rateIdx = headers.findIndex(h => h.includes('rate') || h.includes('price') || h.includes('wp'));
        const warIdx = headers.findIndex(h => h.includes('war'));
        const dimIdx = headers.findIndex(h => h.includes('dim'));

        if (brandIdx === -1 || modelIdx === -1) {
          setImportError('Could not find required "Brand" and "Model" header columns in CSV.');
          return;
        }

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i];
          const cols = rawRow.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
          if (cols.length < 2 || !cols[brandIdx] || !cols[modelIdx]) continue;

          const brand = cols[brandIdx];
          const model = cols[modelIdx];
          const cellTech = cellTechIdx >= 0 && cols[cellTechIdx] ? cols[cellTechIdx] : 'N-Type TOPCon';
          const wattage = wattIdx >= 0 && cols[wattIdx] ? parseFloat(cols[wattIdx].replace(/[^0-9.]/g, '')) || 585 : 585;
          const efficiency = effIdx >= 0 && cols[effIdx] ? cols[effIdx] : '22.6%';
          const rawRate = rateIdx >= 0 && cols[rateIdx] ? parseFloat(cols[rateIdx].replace(/[^0-9.]/g, '')) || 19.50 : 19.50;
          const warranty = warIdx >= 0 && cols[warIdx] ? cols[warIdx] : '30 Years Performance';
          const dimensions = dimIdx >= 0 && cols[dimIdx] ? cols[dimIdx] : '2278 × 1134 × 30 mm | 28 kg';

          parsed.push({
            id: `mod-imp-${Date.now()}-${i}`,
            brand,
            model,
            cellTech,
            wattage,
            efficiency,
            ratePerWp: `₹ ${rawRate.toFixed(2)}`,
            warranty,
            dimensions,
            isNew: true,
            createdAt: Date.now()
          });
        }

        if (parsed.length === 0) {
          setImportError('No valid module specifications could be parsed from this file.');
          return;
        }

        setImportedPreviewItems(parsed);
      } catch (err) {
        console.error(err);
        setImportError('Error parsing file: ' + err.message);
      }
    };
    reader.onerror = () => setImportError('Failed to read selected file.');
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importedPreviewItems.length === 0) return;

    if (setModulesList) {
      setModulesList(prev => [...importedPreviewItems, ...(prev || [])]);
    }
    // Sync directly to Supabase DB
    await hardwareService.bulkImportModules(importedPreviewItems);

    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'upload_file',
        title: `Imported ${importedPreviewItems.length} Module Specifications`,
        description: `Catalog bulk imported from ${importFileName || 'file'}. Synced to Supabase database.`,
        audience: 'all',
        targetTab: 'create_quote'
      });
    }

    triggerToast(`Successfully imported and synced ${importedPreviewItems.length} module specifications to database!`);
    setShowImportModal(false);
    setImportedPreviewItems([]);
    setImportFileName('');
    setImportError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Bulk Price Update Handlers
  const handleOpenBulkPriceModal = () => {
    const initialRates = {};
    (modulesList || []).forEach(m => {
      const cleanRate = parseFloat(String(m.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) || 19.20;
      initialRates[m.id] = cleanRate;
    });
    setBulkRates(initialRates);
    setBulkAdjustmentValue('');
    setShowBulkPriceModal(true);
  };

  const handleApplyBulkAdjustment = () => {
    const val = parseFloat(bulkAdjustmentValue);
    if (isNaN(val) || val === 0) return;

    setBulkRates(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        const current = next[id];
        if (bulkAdjustmentType === 'percent') {
          next[id] = Math.round((current * (1 + val / 100)) * 100) / 100;
        } else {
          next[id] = Math.max(1, Math.round((current + val) * 100) / 100);
        }
      });
      return next;
    });
    triggerToast(`Applied ${val > 0 ? '+' : ''}${val}${bulkAdjustmentType === 'percent' ? '%' : ' ₹/Wp'} across all modules!`);
  };

  const handleSaveBulkPrices = async () => {
    let hasChanges = false;
    (modulesList || []).forEach(m => {
      if (bulkRates[m.id] !== undefined) {
        const currentRate = parseFloat(String(m.ratePerWp).replace(/[^0-9.]/g, '')) || 0;
        const newRate = Number(bulkRates[m.id]);
        if (Math.abs(currentRate - newRate) > 0.001) {
          hasChanges = true;
        }
      }
    });

    if (!hasChanges) {
      setShowBulkPriceModal(false);
      triggerToast('No changes detected in bulk module pricing.');
      return;
    }

    if (setModulesList) {
      setModulesList(prev => (prev || []).map(m => {
        if (bulkRates[m.id] !== undefined) {
          return {
            ...m,
            ratePerWp: `₹ ${Number(bulkRates[m.id]).toFixed(2)}`
          };
        }
        return m;
      }));
    }

    // Sync directly to Supabase DB
    await hardwareService.bulkUpdateModulePrices(bulkRates);

    if (addNotification) {
      addNotification({
        type: 'info',
        icon: 'price_change',
        title: 'Bulk Module Pricing Updated',
        description: `Admin updated benchmark rates for ${(modulesList || []).length} modules. Synced to Supabase database.`,
        audience: 'all',
        targetTab: 'create_quote'
      });
    }
    setShowBulkPriceModal(false);
    triggerToast(`Bulk pricing saved to Supabase database across ${(modulesList || []).length} modules!`);
  };

  // Filtered lists
  const filteredModules = (modulesList || []).filter(mod => {
    const term = moduleSearch.toLowerCase();
    const matchText = (mod.brand && mod.brand.toLowerCase().includes(term)) ||
                      (mod.model && mod.model.toLowerCase().includes(term)) ||
                      (mod.cellTech && mod.cellTech.toLowerCase().includes(term)) ||
                      String(mod.wattage).includes(term);
    if (!matchText) return false;
    if (moduleFilter === 'archived') return !!mod.isArchived;
    if (moduleFilter !== 'all' && mod.isArchived) return false;
    if (moduleFilter === 'topcon' && !(mod.cellTech || '').toLowerCase().includes('topcon')) return false;
    if (moduleFilter === 'perc' && !(mod.cellTech || '').toLowerCase().includes('perc')) return false;
    if (moduleFilter === 'commercial' && Number(mod.wattage) < 585) return false;
    return true;
  });

  const filteredInverters = (invertersList || []).filter(inv => {
    const term = inverterSearch.toLowerCase();
    const capText = getInverterCapacityText(inv).toLowerCase();
    const matchText = (inv.brand && inv.brand.toLowerCase().includes(term)) ||
                      (inv.model && inv.model.toLowerCase().includes(term)) ||
                      capText.includes(term);
    if (!matchText) return false;
    if (inverterFilter === 'single' && !(inv.phase || '').toLowerCase().includes('1-phase')) return false;
    if (inverterFilter === 'three' && !(inv.phase || '').toLowerCase().includes('3-phase')) return false;
    return true;
  });

  const filteredBomSpecs = (pdfBomSpecs || []).filter(spec => {
    if (bosCapacityFilter === 'all') return true;
    return spec.capacityKW.includes(bosCapacityFilter);
  });

  const totalDealersCount = dealers?.length || 550;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 pointer-events-none flex items-center gap-2 px-4 py-3 rounded-lg bg-on-secondary-fixed text-on-secondary shadow-xl font-label-sm ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">check_circle</span>
        <span>{toastMessage}</span>
      </div>

      {/* PAGE HEADER BLOCK */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-6 border-b border-surface-container-highest">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-inverse-surface tracking-tight">
              Solar Equipment &amp; Hardware Master Catalog
            </h1>
            <span className="bg-primary-container/15 text-primary text-label-xs font-semibold px-2.5 py-0.5 rounded-full border border-primary-container/30">
              ALMM Compliant 2025 • Gujarat DISCOMs
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 text-label-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Supabase Database Synced
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Manage approved solar modules, string inverters, and BOS specifications persisted directly to Supabase cloud database.
          </p>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Hidden file input for CSV/Excel import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => {
              setImportedPreviewItems([]);
              setImportFileName('');
              setImportError('');
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-container-highest bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-secondary">upload_file</span>
            <span>Import Specs (CSV)</span>
          </button>
          <button
            type="button"
            onClick={handleOpenBulkPriceModal}
            className="flex items-center gap-1.5 px-3 py-2 border border-surface-container-highest bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-secondary">price_change</span>
            <span>Bulk Price Update</span>
          </button>
          <button
            onClick={handleOpenAddInverter}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-inverse-surface bg-surface-container-lowest text-inverse-surface font-label-md rounded-lg hover:bg-surface-container-low transition-colors shadow-sm cursor-pointer text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined">add</span>
            <span>+ Add Inverter Model</span>
          </button>
          <button
            onClick={handleOpenAddModule}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-primary text-on-primary font-label-md font-bold rounded-lg shadow-sm transition-colors cursor-pointer text-xs sm:text-sm"
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span>+ Add Solar Module</span>
          </button>
        </div>
      </div>

      {/* TOP TELEMETRY KPI QUICK STATS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 my-6">
        {/* Card 1: Active PV Modules */}
        <div className="kpi-card bg-surface-container-lowest rounded-xl p-5 border border-surface-container-highest shadow-sm group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase group-hover:text-primary transition-colors">Active PV Modules</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-primary group-hover:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined">grid_view</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-headline-xl text-headline-xl text-inverse-surface font-bold">{modulesList?.length || 8}</span>
            <span className="font-label-sm text-label-sm text-secondary font-medium">ALMM Models</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-primary text-sm">verified</span>
            <span className="font-label-xs text-label-xs text-primary font-semibold">Waaree, APS, Adani, Rayzone</span>
          </div>
        </div>

        {/* Card 2: Active Inverters */}
        <div className="kpi-card bg-surface-container-lowest rounded-xl p-5 border border-surface-container-highest shadow-sm group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase group-hover:text-primary transition-colors">Active Inverters</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-primary group-hover:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined">power</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-headline-xl text-headline-xl text-inverse-surface font-bold">{invertersList?.length || 9}</span>
            <span className="font-label-sm text-label-sm text-secondary font-medium">2.2kW to 125kW</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-primary text-sm">bolt</span>
            <span className="font-label-xs text-label-xs text-secondary font-semibold">Solaryaan, Solis, Sungrow</span>
          </div>
        </div>

        {/* Card 3: Avg. Module Efficiency */}
        <div className="kpi-card bg-surface-container-lowest rounded-xl p-5 border border-surface-container-highest shadow-sm group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase group-hover:text-primary transition-colors">BOS BOM Profiles</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-primary group-hover:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined">table_view</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-headline-xl text-headline-xl text-inverse-surface font-bold">{pdfBomSpecs?.length || 9}</span>
            <span className="font-label-xs text-label-xs text-primary font-semibold">2.16kW - 8.10kW</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="material-symbols-outlined text-secondary text-sm">tune</span>
            <span className="font-label-xs text-label-xs text-secondary font-semibold">Exact PDF Specifications</span>
          </div>
        </div>

        {/* Card 4: Catalog Synchronization */}
        <div className="kpi-card bg-surface-container-lowest rounded-xl p-5 border border-surface-container-highest shadow-sm group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase group-hover:text-primary transition-colors">Catalog Synchronization</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-primary group-hover:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined">sync</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-headline-sm text-headline-sm text-inverse-surface font-bold">Today, 09:30 AM</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            <span className="font-label-xs text-label-xs text-secondary font-semibold">Synced across {totalDealersCount} Gujarat Dealers</span>
          </div>
        </div>
      </section>

      {/* SEGMENTED TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-container-highest pb-3 gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-label-md font-bold flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'modules'
                ? 'bg-inverse-surface text-surface-container-lowest'
                : 'bg-surface-container-low text-secondary hover:text-inverse-surface'
            }`}
          >
            <span className="material-symbols-outlined text-primary-container">solar_power</span>
            <span>Solar PV Modules (ALMM Approved)</span>
            <span className="bg-surface-container-lowest/20 text-surface-container-lowest text-label-xs px-2 py-0.5 rounded-full">{modulesList?.length || 8} Models</span>
          </button>
          <button
            onClick={() => setActiveTab('inverters')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-label-md font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'inverters'
                ? 'bg-inverse-surface text-surface-container-lowest font-bold shadow-sm'
                : 'bg-surface-container-low text-secondary hover:text-inverse-surface'
            }`}
          >
            <span className="material-symbols-outlined">settings_input_component</span>
            <span>Solar Inverters (Grid-Tied &amp; Hybrid)</span>
            <span className="bg-surface-container-highest text-secondary text-label-xs px-2 py-0.5 rounded-full">{invertersList?.length || 9} Models</span>
          </button>
          <button
            onClick={() => setActiveTab('bos')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-label-md font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bos'
                ? 'bg-inverse-surface text-surface-container-lowest font-bold shadow-sm'
                : 'bg-surface-container-low text-secondary hover:text-inverse-surface'
            }`}
          >
            <span className="material-symbols-outlined">cable</span>
            <span>Bill of Materials (BOM Specs Table)</span>
            <span className="bg-surface-container-highest text-secondary text-label-xs px-2 py-0.5 rounded-full">PDF Specs</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleExportLedger}
          className="flex items-center gap-1.5 text-primary font-label-md hover:underline self-end sm:self-center shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined">download</span>
          <span>Export Ledger</span>
        </button>
      </div>

      {/* SECTION 1: SOLAR MODULES CATALOG TABLE */}
      {activeTab === 'modules' && (
        <div className="mt-6 bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden">
          <div className="p-4 bg-surface-container-lowest border-b border-surface-container-highest flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary">search</span>
                <input
                  className="w-full pl-9 pr-3 py-1.5 text-body-md rounded-lg border border-surface-container-highest focus:ring-1 focus:ring-primary-container focus:border-primary-container placeholder-secondary/60"
                  placeholder="Filter by OEM make, wattage, or cell tech..."
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-xs text-secondary font-semibold uppercase mr-1">Filter:</span>
              <button
                onClick={() => setModuleFilter('all')}
                className={`px-3 py-1 rounded-full text-label-xs font-semibold ${moduleFilter === 'all' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border border-surface-container-highest'}`}
              >
                All ({modulesList?.length || 0})
              </button>
              <button
                onClick={() => setModuleFilter('topcon')}
                className={`px-3 py-1 rounded-full text-label-xs font-medium border ${moduleFilter === 'topcon' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                TOPCon Bifacial
              </button>
              <button
                onClick={() => setModuleFilter('perc')}
                className={`px-3 py-1 rounded-full text-label-xs font-medium border ${moduleFilter === 'perc' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                Mono PERC
              </button>
              <button
                onClick={() => setModuleFilter('commercial')}
                className={`px-3 py-1 rounded-full text-label-xs font-medium border ${moduleFilter === 'commercial' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                High Wattage (≥ 585W)
              </button>
              <button
                onClick={() => setModuleFilter('archived')}
                className={`px-3 py-1 rounded-full text-label-xs font-medium border ${moduleFilter === 'archived' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                Archived ({(modulesList || []).filter(m => m.isArchived).length})
              </button>
              <ViewModeToggle viewMode={modulesViewMode} onViewModeChange={setModulesViewMode} />
            </div>
          </div>

          {modulesViewMode === 'card' ? (
            <div className="p-4 sm:p-5">
              {filteredModules.length === 0 ? (
                <div className="py-12 text-center text-secondary">
                  <span className="material-symbols-outlined text-4xl text-secondary/40 block mb-2">search_off</span>
                  No solar modules match your current filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredModules.map((mod, idx) => {
                    const initial = mod.brand ? mod.brand.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PV';
                    return (
                      <div key={mod.id || idx} className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-all">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-surface-container-low text-inverse-surface font-bold text-xs flex items-center justify-center border border-surface-container-highest">
                              {initial}
                            </span>
                            <div>
                              <span className="font-bold text-inverse-surface text-sm block">{mod.brand}</span>
                              <span className="text-[11px] text-secondary font-mono">{mod.model}</span>
                            </div>
                          </div>
                          {mod.isArchived ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary px-2 py-0.5 rounded-full bg-surface-container">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary/60"></span> Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-container/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span> Active
                            </span>
                          )}
                        </div>

                        {/* Cell Tech & Specs */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container-highest text-xs">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold ${
                            (mod.cellTech || '').includes('TOPCon')
                              ? 'bg-tertiary-container/20 text-tertiary'
                              : 'bg-secondary-container text-on-secondary-fixed'
                          }`}>
                            {mod.cellTech || 'TOPCon Mono Bifacial'}
                          </span>
                          <span className="font-bold text-inverse-surface font-mono text-sm">{mod.wattage} WP</span>
                        </div>

                        {/* 3-Col Stats */}
                        <div className="grid grid-cols-3 gap-1 bg-surface-container-low/40 p-2 rounded-lg text-center text-xs">
                          <div>
                            <span className="text-[10px] text-secondary block">Efficiency</span>
                            <span className="font-bold text-primary font-mono">{mod.efficiency || '22.4%'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-secondary block">Rate / Wp</span>
                            <span className="font-bold text-inverse-surface font-mono">{mod.ratePerWp || '₹ 18.50 / Wp'}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-secondary font-mono">
                          {mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-highest text-xs">
                          <span className="text-secondary text-[11px]">{mod.warranty || '30 Yrs Warranty'}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditModule(mod)}
                              className="px-2 py-1 rounded border border-surface-container-highest hover:border-inverse-surface text-secondary hover:text-inverse-surface flex items-center gap-1 transition-colors cursor-pointer"
                              title="Edit Spec"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleArchiveModule(mod)}
                              className={`p-1 rounded border border-surface-container-highest transition-colors cursor-pointer ${
                                mod.isArchived ? 'hover:text-primary text-secondary' : 'hover:text-error text-secondary'
                              }`}
                              title={mod.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                            >
                              <span className="material-symbols-outlined text-[16px]">{mod.isArchived ? 'unarchive' : 'archive'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-11 border-b border-surface-container-lowest/10">
                  <th className="px-4 py-2 font-label-sm">OEM Brand / Make</th>
                  <th className="px-4 py-2 font-label-sm">Model Name &amp; Series</th>
                  <th className="px-4 py-2 font-label-sm">Cell Tech</th>
                  <th className="px-4 py-2 font-label-sm text-right">Wattage</th>
                  <th className="px-4 py-2 font-label-sm">Dimensions &amp; Weight</th>
                  <th className="px-4 py-2 font-label-sm text-right">Efficiency %</th>
                  <th className="px-4 py-2 font-label-sm text-right">Base Procurement Rate</th>
                  <th className="px-4 py-2 font-label-sm">Performance Warranty</th>
                  <th className="px-4 py-2 font-label-sm text-center">Dealer Catalog</th>
                  <th className="px-4 py-2 font-label-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-highest font-body-md text-on-surface">
                {filteredModules.map((mod, idx) => {
                  const initial = mod.brand ? mod.brand.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'PV';
                  return (
                    <tr key={mod.id || idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded bg-surface-container-low text-inverse-surface font-bold text-xs flex items-center justify-center border border-surface-container-highest">
                            {initial}
                          </span>
                          <span className="font-semibold text-inverse-surface">{mod.brand}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-inverse-surface">{mod.model}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold ${
                          (mod.cellTech || '').includes('TOPCon')
                            ? 'bg-tertiary-container/20 text-tertiary'
                            : 'bg-secondary-container text-on-secondary-fixed'
                        }`}>
                          {mod.cellTech || 'TOPCon Mono Bifacial'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-inverse-surface font-mono">{mod.wattage} WP</td>
                      <td className="px-4 py-3 text-body-sm text-secondary font-mono">{mod.dimensions || '2278 × 1134 × 30 mm | 28 kg'}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary font-mono">{mod.efficiency || '22.4%'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-inverse-surface font-mono">{mod.ratePerWp || '₹ 18.50 / Wp'}</div>
                        <div className="text-label-xs text-secondary font-mono">₹ {Math.round(Number(mod.wattage || 550) * 18.5).toLocaleString()} / Panel</div>
                      </td>
                      <td className="px-4 py-3 text-body-sm text-secondary">{mod.warranty || '30 Years Performance'}</td>
                      <td className="px-4 py-3 text-center">
                        {mod.isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary">
                            <span className="w-2 h-2 rounded-full bg-secondary/60"></span> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <span className="w-2 h-2 rounded-full bg-primary-container"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-secondary">
                          <button
                            onClick={() => handleEditModule(mod)}
                            className="p-1 hover:text-inverse-surface transition-colors cursor-pointer"
                            title="Edit Spec"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleArchiveModule(mod)}
                            className={`p-1 transition-colors cursor-pointer ${mod.isArchived ? 'hover:text-primary text-secondary' : 'hover:text-error'}`}
                            title={mod.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                          >
                            <span className="material-symbols-outlined">{mod.isArchived ? 'unarchive' : 'archive'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* SECTION 2: SOLAR INVERTERS CATALOG TABLE */}
      {activeTab === 'inverters' && (
        <div className="mt-6 bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden">
          <div className="p-4 bg-surface-container-lowest border-b border-surface-container-highest flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-inverse-surface font-bold">
                Approved String &amp; Central Inverters Master (Single &amp; Three Phase)
              </h2>
              <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                Preset efficiencies, phase configurations, and base distributor rates for Gujarat quotations.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-secondary text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search inverters..."
                  value={inverterSearch}
                  onChange={(e) => setInverterSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-container-highest"
                />
              </div>
              <button
                onClick={() => setInverterFilter('all')}
                className={`px-3 py-1.5 text-label-xs font-semibold rounded-lg border cursor-pointer ${inverterFilter === 'all' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                All ({invertersList?.length || 0})
              </button>
              <button
                onClick={() => setInverterFilter('single')}
                className={`px-3 py-1.5 text-label-xs font-semibold rounded-lg border cursor-pointer ${inverterFilter === 'single' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                1-Phase
              </button>
              <button
                onClick={() => setInverterFilter('three')}
                className={`px-3 py-1.5 text-label-xs font-semibold rounded-lg border cursor-pointer ${inverterFilter === 'three' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                3-Phase
              </button>
              <button
                onClick={() => setInverterFilter('archived')}
                className={`px-3 py-1.5 text-label-xs font-semibold rounded-lg border cursor-pointer ${inverterFilter === 'archived' ? 'bg-inverse-surface text-surface-container-lowest' : 'bg-surface-container-low text-secondary border-surface-container-highest'}`}
              >
                Archived ({(invertersList || []).filter(i => i.isArchived).length})
              </button>
              <ViewModeToggle viewMode={invertersViewMode} onViewModeChange={setInvertersViewMode} />
            </div>
          </div>

          {invertersViewMode === 'card' ? (
            <div className="p-4 sm:p-5">
              {filteredInverters.length === 0 ? (
                <div className="py-12 text-center text-secondary">
                  <span className="material-symbols-outlined text-4xl text-secondary/40 block mb-2">search_off</span>
                  No solar inverters match your current filter criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredInverters.map((inv, idx) => {
                    const initial = inv.brand ? inv.brand.slice(0, 2).toUpperCase() : 'IN';
                    return (
                      <div key={inv.id || idx} className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-all">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-primary-container/20 text-primary font-bold text-xs flex items-center justify-center border border-primary-container/40">
                              {initial}
                            </span>
                            <div>
                              <span className="font-bold text-inverse-surface text-sm block">{inv.brand}</span>
                              <span className="text-[11px] text-secondary font-mono">{inv.model}</span>
                            </div>
                          </div>
                          {inv.isArchived ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary px-2 py-0.5 rounded-full bg-surface-container-high">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary/60"></span> Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary-container/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span> Active
                            </span>
                          )}
                        </div>

                        {/* Specs & Phase */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container-highest text-xs">
                          <span className="inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold bg-surface-container-high text-on-surface">
                            {inv.phase || '3-Phase'}
                          </span>
                          <span className="font-bold text-inverse-surface font-mono text-sm">{getInverterCapacityText(inv)}</span>
                        </div>

                        {/* 3-Col Stats */}
                        <div className="grid grid-cols-2 gap-2 bg-surface-container-low/40 p-2.5 rounded-lg text-center text-xs">
                          <div>
                            <span className="text-[10px] text-secondary block">Euro Efficiency</span>
                            <span className="font-bold text-primary font-mono">{inv.efficiency || '98.6%'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-secondary block">Base Price</span>
                            <span className="font-bold text-inverse-surface font-mono">{inv.basePrice || '₹ 54,000'}</span>
                          </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-surface-container-highest text-xs">
                          <span className="text-secondary text-[11px]">{inv.warranty || '8 Yrs Warranty'}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditInverter(inv)}
                              className="px-2 py-1 rounded border border-surface-container-highest hover:border-inverse-surface text-secondary hover:text-inverse-surface flex items-center gap-1 transition-colors cursor-pointer"
                              title="Edit Spec"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleToggleArchiveInverter(inv)}
                              className={`p-1 rounded border border-surface-container-highest transition-colors cursor-pointer ${
                                inv.isArchived ? 'hover:text-primary text-secondary' : 'hover:text-error text-secondary'
                              }`}
                              title={inv.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                            >
                              <span className="material-symbols-outlined text-[16px]">{inv.isArchived ? 'unarchive' : 'archive'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-11 border-b border-surface-container-lowest/10">
                  <th className="px-4 py-2 font-label-sm">Brand / OEM</th>
                  <th className="px-4 py-2 font-label-sm">Model</th>
                  <th className="px-4 py-2 font-label-sm text-right">Rated Capacity</th>
                  <th className="px-4 py-2 font-label-sm">Grid Phase &amp; MPPT</th>
                  <th className="px-4 py-2 font-label-sm text-right">Euro Efficiency</th>
                  <th className="px-4 py-2 font-label-sm text-right">Inverter Base Price (₹)</th>
                  <th className="px-4 py-2 font-label-sm">Replacement Warranty</th>
                  <th className="px-4 py-2 font-label-sm text-center">Dealer Quoting</th>
                  <th className="px-4 py-2 font-label-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-highest font-body-md text-on-surface">
                {filteredInverters.map((inv, idx) => {
                  const initial = inv.brand ? inv.brand.slice(0, 2).toUpperCase() : 'IN';
                  return (
                    <tr key={inv.id || idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded bg-primary-container/20 text-primary font-bold text-xs flex items-center justify-center border border-primary-container/40">
                            {initial}
                          </span>
                          <span className="font-semibold text-inverse-surface">{inv.brand}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-inverse-surface">{inv.model}</td>
                      <td className="px-4 py-3 text-right font-bold text-inverse-surface font-mono">{getInverterCapacityText(inv)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold bg-surface-container-high text-on-surface">
                          {inv.phase || '3-Phase'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary font-mono">{inv.efficiency || '98.6%'}</td>
                      <td className="px-4 py-3 text-right font-bold text-inverse-surface font-mono">{inv.basePrice || '₹ 54,000'}</td>
                      <td className="px-4 py-3 text-body-sm text-secondary">{inv.warranty || '8 Years Comprehensive'}</td>
                      <td className="px-4 py-3 text-center">
                        {inv.isArchived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary">
                            <span className="w-2 h-2 rounded-full bg-secondary/60"></span> Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <span className="w-2 h-2 rounded-full bg-primary-container"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-secondary">
                          <button
                            onClick={() => handleEditInverter(inv)}
                            className="p-1 hover:text-inverse-surface transition-colors cursor-pointer"
                            title="Edit Spec"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleArchiveInverter(inv)}
                            className={`p-1 transition-colors cursor-pointer ${inv.isArchived ? 'hover:text-primary text-secondary' : 'hover:text-error text-secondary'}`}
                            title={inv.isArchived ? 'Restore to Catalog' : 'Archive Spec'}
                          >
                            <span className="material-symbols-outlined">{inv.isArchived ? 'unarchive' : 'archive'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      {/* SECTION 3: REAL PDF BOS SPECIFICATIONS TABLE */}
      {activeTab === 'bos' && (
        <div className="mt-6 bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-surface-container-highest gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-inverse-surface font-bold">
                  BOS (Balance of System) Master Specification Table
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary text-label-xs font-bold">
                  From Official Price List PDF
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-1">
                Standard component bill of materials (Wires, ACDB, DCDB, Earthing, PVC, MC4) across system capacities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary">Capacity:</span>
              <select
                value={bosCapacityFilter}
                onChange={(e) => setBosCapacityFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-container-highest bg-surface-container-lowest"
              >
                <option value="all">All Capacities (2.16kW to 8.10kW)</option>
                <option value="2.16">2.16 kW</option>
                <option value="2.70">2.70 kW</option>
                <option value="3.24">3.24 kW</option>
                <option value="3.78">3.78 kW</option>
                <option value="4.32">4.32 kW</option>
                <option value="4.86">4.86 kW</option>
                <option value="5.40">5.40 kW</option>
                <option value="5.94">5.94 kW</option>
                <option value="8.10">8.10 kW</option>
              </select>
            </div>
          </div>

          {/* BOS Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-inverse-surface text-surface-container-lowest text-label-sm font-semibold h-11 border-b border-surface-container-lowest/10">
                  <th className="px-3 py-2 font-label-sm">Capacity</th>
                  <th className="px-3 py-2 font-label-sm">Modules</th>
                  <th className="px-3 py-2 font-label-sm">Inverter</th>
                  <th className="px-3 py-2 font-label-sm">DC Wire (1C×4)</th>
                  <th className="px-3 py-2 font-label-sm">AC Wire</th>
                  <th className="px-3 py-2 font-label-sm">Earthing Wire</th>
                  <th className="px-3 py-2 font-label-sm">LA Wire</th>
                  <th className="px-3 py-2 font-label-sm">ACDB / DCDB</th>
                  <th className="px-3 py-2 font-label-sm">Earthing Kit</th>
                  <th className="px-3 py-2 font-label-sm">PVC &amp; Hardware</th>
                  <th className="px-3 py-2 font-label-sm">MC4</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-highest font-body-sm text-xs text-on-surface">
                {filteredBomSpecs.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-surface-container-low/60 transition-colors ${idx % 2 === 1 ? 'bg-surface-container-low/20' : ''}`}>
                    <td className="px-3 py-3 font-bold text-inverse-surface font-mono">{row.capacityKW}</td>
                    <td className="px-3 py-3 font-semibold text-primary">{row.modulesQty}</td>
                    <td className="px-3 py-3">{row.inverterQty}</td>
                    <td className="px-3 py-3 font-mono">{row.dcWire}</td>
                    <td className="px-3 py-3 font-mono">{row.acWire}</td>
                    <td className="px-3 py-3 font-mono">{row.earthingWire}</td>
                    <td className="px-3 py-3 font-mono">{row.laWire}</td>
                    <td className="px-3 py-3">{row.acdbDcdb}</td>
                    <td className="px-3 py-3">{row.earthingKit}</td>
                    <td className="px-3 py-3">{row.pvcHardware}</td>
                    <td className="px-3 py-3 font-mono">{row.mc4Connectors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Standard compliance tags */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-surface-container-highest">
            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
              <div className="font-label-md font-bold text-on-surface">Galvanized Structure (IS 2062)</div>
              <p className="text-xs text-secondary mt-1">80 Micron minimum zinc coating, withstands 150 km/h wind load.</p>
            </div>
            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
              <div className="font-label-md font-bold text-on-surface">Solar DC Cables (EN 50618)</div>
              <p className="text-xs text-secondary mt-1">XLPO insulated, UV resistant, electron-beam cross-linked copper.</p>
            </div>
            <div className="p-3.5 rounded-lg bg-surface-container-low border border-surface-container-highest">
              <div className="font-label-md font-bold text-on-surface">SPD Type II ACDB / DCDB (IP65)</div>
              <p className="text-xs text-secondary mt-1">Polycarbonate distribution enclosures with surge protection.</p>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER & AUDIT TRAIL ADVISORY */}
      <div className="mt-8 mb-4 p-4 rounded-xl bg-surface-container-lowest border border-surface-container-highest flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-secondary-container text-on-secondary-fixed">
            <span className="material-symbols-outlined">info</span>
          </span>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md font-semibold text-inverse-surface">Global Catalog Engine Advisory</span>
            <span className="font-body-sm text-body-sm text-secondary">Hardware additions immediately reflect inside the dealer quotation calculation engine for all active DISCOM regions.</span>
          </div>
        </div>
      </div>

      {/* ADD SOLAR MODULE MODAL */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">solar_power</span>
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {editingModule ? 'Edit Solar PV Module' : 'Add Solar PV Module'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModuleModal(false);
                  setEditingModule(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">OEM Brand / Make *</label>
                  <input
                    required
                    type="text"
                    value={moduleForm.brand}
                    onChange={(e) => setModuleForm({ ...moduleForm, brand: e.target.value })}
                    placeholder="e.g. Adani Solar / Waaree"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Model Name &amp; Series *</label>
                  <input
                    required
                    type="text"
                    value={moduleForm.model}
                    onChange={(e) => setModuleForm({ ...moduleForm, model: e.target.value })}
                    placeholder="e.g. Shine 600WP TOPCon"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Wattage (W) *</label>
                  <input
                    required
                    type="number"
                    value={moduleForm.wattage}
                    onChange={(e) => setModuleForm({ ...moduleForm, wattage: e.target.value })}
                    placeholder="550"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Efficiency %</label>
                  <input
                    type="text"
                    value={moduleForm.efficiency}
                    onChange={(e) => setModuleForm({ ...moduleForm, efficiency: e.target.value })}
                    placeholder="22.6%"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Rate (₹/Wp)</label>
                  <input
                    type="text"
                    value={moduleForm.ratePerWp}
                    onChange={(e) => setModuleForm({ ...moduleForm, ratePerWp: e.target.value })}
                    placeholder="19.20"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Dimensions &amp; Weight</label>
                  <input
                    type="text"
                    value={moduleForm.dimensions}
                    onChange={(e) => setModuleForm({ ...moduleForm, dimensions: e.target.value })}
                    placeholder="e.g. 2278 × 1134 × 30 mm | 28 kg"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Performance Warranty</label>
                  <input
                    type="text"
                    value={moduleForm.warranty}
                    onChange={(e) => setModuleForm({ ...moduleForm, warranty: e.target.value })}
                    placeholder="e.g. 30 Years Performance"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-secondary">Cell Technology *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCellTech(!isCustomCellTech);
                      if (!isCustomCellTech) setCustomCellTechInput('');
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {isCustomCellTech ? '← Choose from standard' : '+ Custom Technology'}
                  </button>
                </div>
                {isCustomCellTech ? (
                  <input
                    type="text"
                    required
                    value={customCellTechInput}
                    onChange={(e) => setCustomCellTechInput(e.target.value)}
                    placeholder="e.g. Perovskite Tandem / BC IBC"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                ) : (
                  <select
                    value={moduleForm.cellTech}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCellTech(true);
                        setCustomCellTechInput('');
                      } else {
                        setModuleForm({ ...moduleForm, cellTech: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  >
                    <option value="TOPCon Mono Bifacial">TOPCon Mono Bifacial (Recommended)</option>
                    <option value="Mono PERC">Mono PERC Half-Cut</option>
                    <option value="HJT Ultra-Efficiency">HJT Ultra-Efficiency</option>
                    <option value="Polycrystalline DCR">Polycrystalline DCR</option>
                    {customCellTechs.filter(t => !['TOPCon Mono Bifacial', 'Mono PERC', 'HJT Ultra-Efficiency', 'Polycrystalline DCR'].includes(t)).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__custom__">+ Enter Custom Cell Tech...</option>
                  </select>
                )}
              </div>

              <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModuleModal(false);
                    setEditingModule(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-primary-container text-surface-container-lowest hover:bg-primary rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {editingModule ? 'Save Changes' : 'Publish to Catalog & Notify Dealers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD INVERTER MODEL MODAL */}
      {showAddInverterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {editingInverter ? 'Edit Inverter Model' : 'Add Inverter Model'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddInverterModal(false);
                  setEditingInverter(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveInverter} className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Brand / OEM Make *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.brand}
                    onChange={(e) => setInverterForm({ ...inverterForm, brand: e.target.value })}
                    placeholder="e.g. Sungrow / Solis / Sunvine"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Model Name *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.model}
                    onChange={(e) => setInverterForm({ ...inverterForm, model: e.target.value })}
                    placeholder="e.g. SG10RT 3-Phase Multi-MPPT"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Rated Capacity *</label>
                  <input
                    required
                    type="text"
                    value={inverterForm.capacity}
                    onChange={(e) => setInverterForm({ ...inverterForm, capacity: e.target.value })}
                    placeholder="10 kW"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Phase</label>
                  <select
                    value={inverterForm.phase}
                    onChange={(e) => setInverterForm({ ...inverterForm, phase: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  >
                    <option value="3-Phase 415V">3-Phase 415V</option>
                    <option value="1-Phase 230V">1-Phase 230V</option>
                    <option value="Hybrid Battery-Ready">Hybrid Battery-Ready</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Efficiency</label>
                  <input
                    type="text"
                    value={inverterForm.efficiency}
                    onChange={(e) => setInverterForm({ ...inverterForm, efficiency: e.target.value })}
                    placeholder="98.5%"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Base Distributor Price (₹)</label>
                  <input
                    type="text"
                    value={inverterForm.basePrice}
                    onChange={(e) => setInverterForm({ ...inverterForm, basePrice: e.target.value })}
                    placeholder="₹ 54,000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Replacement Warranty</label>
                  <input
                    type="text"
                    value={inverterForm.warranty}
                    onChange={(e) => setInverterForm({ ...inverterForm, warranty: e.target.value })}
                    placeholder="10 Years Comprehensive"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInverterModal(false);
                    setEditingInverter(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-primary-container text-surface-container-lowest hover:bg-primary rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {editingInverter ? 'Save Changes to Database' : 'Publish to Catalog & Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* IMPORT SPECS MODAL (SR-22)                                     */}
      {/* ============================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Import Module Specifications
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Upload a CSV file with Brand, Model, Cell Tech, Wattage, Rate per Wp, and Warranty columns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Upload Zone */}
              <div
                className="border-2 border-dashed border-surface-container-highest rounded-xl p-6 text-center flex flex-col items-center gap-3 hover:border-primary/50 transition-colors cursor-pointer bg-surface-container-low/40"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-4xl text-secondary">cloud_upload</span>
                <div>
                  <p className="font-bold text-on-surface text-sm">
                    {importFileName ? importFileName : 'Click to Select CSV / Excel File'}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Supports .csv, .xlsx, .xls, .txt · Max 5 MB
                  </p>
                </div>
                {importFileName && !importError && importedPreviewItems.length === 0 && (
                  <span className="text-xs text-amber-600 font-semibold">Parsing file…</span>
                )}
              </div>

              {/* Error Banner */}
              {importError && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2 text-error text-xs">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview Table */}
              {importedPreviewItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-on-surface">
                      Preview: {importedPreviewItems.length} module{importedPreviewItems.length > 1 ? 's' : ''} parsed
                    </p>
                    <span className="text-[11px] text-secondary">Confirm below to add to catalog</span>
                  </div>
                  <div className="overflow-x-auto border border-surface-container-highest rounded-xl">
                    <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                      <thead>
                        <tr className="bg-surface-container-low text-secondary font-semibold uppercase tracking-wide text-[11px]">
                          <th className="px-3 py-2">Brand</th>
                          <th className="px-3 py-2">Model</th>
                          <th className="px-3 py-2">Cell Tech</th>
                          <th className="px-3 py-2 text-right">Wp</th>
                          <th className="px-3 py-2 text-right">₹/Wp</th>
                          <th className="px-3 py-2">Warranty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-highest text-on-surface">
                        {importedPreviewItems.slice(0, 8).map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-3 py-2 font-semibold">{item.brand}</td>
                            <td className="px-3 py-2">{item.model}</td>
                            <td className="px-3 py-2 text-secondary">{item.cellTech}</td>
                            <td className="px-3 py-2 text-right font-mono">{item.wattage}W</td>
                            <td className="px-3 py-2 text-right font-mono text-primary">{item.ratePerWp}</td>
                            <td className="px-3 py-2 text-secondary">{item.warranty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importedPreviewItems.length > 8 && (
                      <div className="px-3 py-2 text-xs text-secondary bg-surface-container-low border-t border-surface-container-highest">
                        +{importedPreviewItems.length - 8} more modules not shown in preview
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-secondary">
                <span>Need the correct format?</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsvTemplate}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Download Sample CSV Template</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-surface-container-highest bg-surface-container-low text-on-surface text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">folder_open</span>
                <span>Browse File</span>
              </button>
              <button
                type="button"
                disabled={importedPreviewItems.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Import {importedPreviewItems.length > 0 ? `${importedPreviewItems.length} Modules` : 'Modules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* BULK PRICE UPDATE MODAL (SR-22)                                */}
      {/* ============================================================= */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-surface-container-highest animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">price_change</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                    Bulk Price Update
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Adjust benchmark ₹/Wp rates across all {(modulesList || []).length} solar modules at once.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkPriceModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Global Adjustment Controls */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-highest flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface">Adjustment Type</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkAdjustmentType('percent')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        bulkAdjustmentType === 'percent'
                          ? 'bg-primary-container text-surface-container-lowest border-primary-container'
                          : 'bg-surface-container-lowest border-surface-container-highest text-secondary'
                      }`}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkAdjustmentType('flat')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        bulkAdjustmentType === 'flat'
                          ? 'bg-primary-container text-surface-container-lowest border-primary-container'
                          : 'bg-surface-container-lowest border-surface-container-highest text-secondary'
                      }`}
                    >
                      ₹/Wp Flat Amount
                    </button>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-secondary">
                      {bulkAdjustmentType === 'percent' ? 'Change (%)' : 'Change (₹/Wp)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={bulkAdjustmentType === 'percent' ? '0.5' : '0.10'}
                        placeholder={bulkAdjustmentType === 'percent' ? '+5 or -3' : '+0.50'}
                        value={bulkAdjustmentValue}
                        onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                        className="w-36 h-9 px-3 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!bulkAdjustmentValue || isNaN(parseFloat(bulkAdjustmentValue))}
                    onClick={handleApplyBulkAdjustment}
                    className="h-9 px-4 bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Apply to All
                  </button>
                </div>
              </div>

              {/* Per-Module Rate Editor */}
              <div className="border border-surface-container-highest rounded-xl overflow-hidden">
                <div className="bg-surface-container-low px-4 py-2.5 border-b border-surface-container-highest flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Module-by-Module Rate Editor</span>
                  <span className="text-[11px] text-secondary">{(modulesList || []).length} modules</span>
                </div>
                <div className="overflow-y-auto max-h-64 divide-y divide-surface-container-highest">
                  {(modulesList || []).filter(m => !m.isArchived).map((mod) => {
                    const currentRate = bulkRates[mod.id] ?? parseFloat(String(mod.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) ?? 19.20;
                    const originalRate = parseFloat(String(mod.ratePerWp || '19.20').replace(/[^0-9.]/g, '')) || 19.20;
                    const changed = Math.abs(currentRate - originalRate) > 0.001;
                    return (
                      <div key={mod.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low/50 transition-colors">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="font-semibold text-on-surface text-xs truncate">
                            {mod.brand} {mod.model}
                          </div>
                          <div className="text-[11px] text-secondary mt-0.5">
                            {mod.wattage}W · {mod.cellTech}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {changed && (
                            <span className="text-[10px] text-secondary line-through font-mono">₹{originalRate.toFixed(2)}</span>
                          )}
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs text-secondary font-mono pointer-events-none">₹</span>
                            <input
                              type="number"
                              step="0.10"
                              min="1"
                              value={currentRate}
                              onChange={(e) => setBulkRates(prev => ({
                                ...prev,
                                [mod.id]: parseFloat(e.target.value) || 0
                              }))}
                              className={`w-24 h-8 pl-6 pr-2 text-xs font-bold font-mono rounded-lg border focus:outline-none focus:border-primary transition-colors ${
                                changed
                                  ? 'border-primary-container bg-primary/5 text-primary'
                                  : 'border-surface-container-highest bg-surface-container-lowest text-on-surface'
                              }`}
                            />
                          </div>
                          <span className="text-[11px] text-secondary font-mono w-10">/Wp</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-container-low flex items-center justify-between shrink-0">
              <span className="text-[11px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-amber-500">info</span>
                Changes apply to all active dealer quotations immediately.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkPriceModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBulkPrices}
                  className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-surface-container-lowest text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Save & Publish Prices</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
