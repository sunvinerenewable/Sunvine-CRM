import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { useLoading } from '../../context/LoadingContext';
import { storageService } from '../../services/storageService';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';
import DocumentPreviewModal from '../Shared/DocumentPreviewModal';
import CameraCaptureModal from '../Shared/CameraCaptureModal';
import { compressMedia, formatFileSize } from '../../utils/mediaOptimizer';
import { DEFAULT_REQUIRED_DOCUMENTS, isDocMandatoryForCategory } from '../../data/defaultRequiredDocuments';

export default function MyApplications() {
  const {
    currentDealer,
    customerFiles,
    quotations,
    applicationStages,
    updateCustomerFile,
    addCustomerFileTimelineEvent,
    requiredDocuments,
    setActiveTab
  } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDiscom, setSelectedDiscom] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modal States
  const [activeFileDetail, setActiveFileDetail] = useState(null);
  const [uploadTargetFile, setUploadTargetFile] = useState(null);
  const [cameraTargetDoc, setCameraTargetDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [quickStageFile, setQuickStageFile] = useState(null);
  const [quickStageVal, setQuickStageVal] = useState('');
  const [quickStageNotes, setQuickStageNotes] = useState('');

  // Stages master list
  const stages = useMemo(() => {
    return applicationStages && applicationStages.length > 0 ? applicationStages : [];
  }, [applicationStages]);

  // Aggregate files belonging to this dealer
  const dealerFiles = useMemo(() => {
    const list = Array.isArray(customerFiles) ? customerFiles : [];
    const dealerId = currentDealer?.id;
    const dealerName = currentDealer?.name;

    // Filter by dealer ID or name (or if dealer is not assigned yet, show all files matching dealer source)
    let filtered = list.filter(f => {
      if (!dealerId) return true;
      if (f.dealerId === dealerId) return true;
      if (dealerName && f.dealerName && f.dealerName.toLowerCase() === dealerName.toLowerCase()) return true;
      return false;
    });

    // Also match any converted quotations with 'Won / Order Booked' that might not have fileId
    const wonQuotes = (quotations || []).filter(q => {
      const isWon = q.status === 'Won / Order Booked';
      const isDealer = !dealerId || q.dealerId === dealerId || (dealerName && q.dealerName === dealerName);
      const alreadyHasFile = filtered.some(f => f.quotationId === q.id);
      return isWon && isDealer && !alreadyHasFile;
    });

    const synthesizedFromQuotes = wonQuotes.map(q => {
      const capKw = Number(q.systemCapacityKW || q.capacity?.replace(/[^\d.]/g, '') || 5);
      return {
        id: `FIL-${q.id || Date.now()}`,
        quotationId: q.id,
        customerName: q.customerName || 'Solar Consumer',
        phone: q.customerPhone || q.phone || 'N/A',
        address: q.customerAddress || q.address || q.location || 'Gujarat',
        city: q.city || 'Rajkot',
        discom: q.discom || 'PGVCL',
        consumerNo: q.consumerNo || 'PENDING-REGISTRATION',
        solarSystemKw: capKw,
        amount: q.grandTotalCustomer || q.totalAmount || 0,
        financeType: q.financeType || 'CASH',
        loanBank: q.loanBank || '',
        category: q.category || (q.projectType?.toLowerCase().includes('comm') ? 'commercial' : 'residential'),
        currentStage: 'DISCOM_APPLICATION',
        status: 'Verification',
        createdDate: q.date || new Date().toISOString().split('T')[0],
        documents: {},
        timeline: [
          {
            stage: 'Quotation Approved',
            date: q.date || new Date().toISOString().split('T')[0],
            actor: q.dealerName || currentDealer?.name || 'Dealer Partner',
            notes: 'Converted to project application'
          }
        ]
      };
    });

    return [...filtered, ...synthesizedFromQuotes];
  }, [customerFiles, quotations, currentDealer]);

  // Apply filters
  const displayedFiles = useMemo(() => {
    return dealerFiles.filter(file => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (file.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (file.phone || '').includes(q);
        const matchesId = (file.id || '').toLowerCase().includes(q);
        const matchesAppNo = (file.applicationNo || '').toLowerCase().includes(q);
        const matchesConsumer = (file.consumerNo || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesAppNo && !matchesConsumer) return false;
      }

      // Stage filter
      if (selectedStage !== 'ALL') {
        const fileStage = (file.currentStage || '').toUpperCase();
        if (fileStage !== selectedStage && file.currentStage !== selectedStage) {
          // match label or id
          const matchingStageObj = stages.find(s => s.id === selectedStage || s.label === selectedStage);
          if (!matchingStageObj || (file.currentStage !== matchingStageObj.id && file.currentStage !== matchingStageObj.label)) {
            return false;
          }
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const fileCat = (file.category || 'residential').toLowerCase();
        if (fileCat !== selectedCategory.toLowerCase()) return false;
      }

      // DISCOM filter
      if (selectedDiscom !== 'ALL') {
        if ((file.discom || '').toUpperCase() !== selectedDiscom.toUpperCase()) return false;
      }

      return true;
    });
  }, [dealerFiles, searchQuery, selectedStage, selectedCategory, selectedDiscom, stages]);

  // Metrics
  const metrics = useMemo(() => {
    const total = dealerFiles.length;
    const verificationCount = dealerFiles.filter(f =>
      (f.status || '').toLowerCase().includes('verif') ||
      (f.currentStage || '').toLowerCase().includes('lead') ||
      (f.currentStage || '').toLowerCase().includes('survey')
    ).length;
    const discomFilingCount = dealerFiles.filter(f =>
      (f.currentStage || '').toLowerCase().includes('discom') ||
      (f.currentStage || '').toLowerCase().includes('feasibility')
    ).length;
    const installationCount = dealerFiles.filter(f =>
      (f.currentStage || '').toLowerCase().includes('install') ||
      (f.currentStage || '').toLowerCase().includes('meter')
    ).length;
    const completedCount = dealerFiles.filter(f =>
      f.isCompleted ||
      (f.currentStage || '').toLowerCase().includes('handover') ||
      (f.currentStage || '').toLowerCase().includes('subsidy')
    ).length;

    return { total, verificationCount, discomFilingCount, installationCount, completedCount };
  }, [dealerFiles]);

  const { addToast } = useToast();
  const { showLoader, hideLoader } = useLoading();

  // File upload handler (Cloudflare R2 + Supabase)
  const handleUploadDocument = async (docKey, file) => {
    if (!uploadTargetFile || !file) return;

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const fileExt = file.name?.split('.').pop()?.toLowerCase() || '';
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const isAllowed = allowedExts.includes(fileExt) || allowedMimes.includes(file.type?.toLowerCase());

    if (!isAllowed) {
      addToast('Invalid file format. Only PDF (.pdf) and Images (.jpeg, .jpg, .png, .webp) are allowed.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      addToast(`File size (${sizeMB} MB) exceeds maximum 2 MB limit allowed. Please compress the file.`, 'error');
      return;
    }

    showLoader('Securing document in Cloudflare R2 Vault...');
    try {
      let fileUrl = null;
      let filename = file.name;
      let fileSize = file.size;

      try {
        const uploadRes = await storageService.uploadCustomerDocument(file, uploadTargetFile.id, docKey);
        if (uploadRes?.success) {
          fileUrl = uploadRes.publicUrl || uploadRes.url;
          filename = uploadRes.filename || file.name;
          fileSize = uploadRes.fileSize || file.size;
        }
      } catch (err) {
        console.warn('[MyApplications] Cloudflare R2 upload warning:', err);
        addToast(err.message || 'Upload failed', 'error');
        return;
      }

      const updatedDocs = {
        ...(uploadTargetFile.documents || {}),
        [docKey]: {
          filename,
          url: fileUrl,
          size: formatFileSize(fileSize),
          uploaded: true,
          date: new Date().toISOString().split('T')[0]
        }
      };

      if (updateCustomerFile) {
        await updateCustomerFile(uploadTargetFile.id, { documents: updatedDocs });
      }
      setUploadTargetFile(prev => ({ ...prev, documents: updatedDocs }));
      addToast(`Document uploaded to R2: ${filename}`, 'success');
    } catch (e) {
      console.error('[MyApplications] Upload error:', e);
      addToast(e.message || 'Upload failed', 'error');
    } finally {
      hideLoader();
    }
  };

  // Camera capture handler
  const handleCameraCapture = async (stats) => {
    if (!uploadTargetFile || !cameraTargetDoc || !stats) return;
    const docKey = cameraTargetDoc.key;

    showLoader('Securing camera photo in Cloudflare R2 Vault...');
    try {
      let fileUrl = null;
      let filename = stats.file?.name || `${docKey}_camera.jpg`;
      let fileSize = stats.file?.size || 0;

      if (stats.file) {
        try {
          const uploadRes = await storageService.uploadCustomerDocument(stats.file, uploadTargetFile.id, docKey);
          if (uploadRes?.success) {
            fileUrl = uploadRes.publicUrl || uploadRes.url;
            filename = uploadRes.filename || stats.file.name;
            fileSize = uploadRes.fileSize || stats.file.size;
          }
        } catch (err) {
          console.warn('[MyApplications] Camera upload warning:', err);
        }
      }

      const updatedDocs = {
        ...(uploadTargetFile.documents || {}),
        [docKey]: {
          filename,
          url: fileUrl,
          size: stats.compressedFormatted || formatFileSize(fileSize),
          originalSize: stats.originalFormatted,
          reduction: stats.reduction,
          dataUrl: fileUrl ? undefined : stats.dataUrl,
          uploaded: true,
          date: new Date().toISOString().split('T')[0]
        }
      };

      if (updateCustomerFile) {
        await updateCustomerFile(uploadTargetFile.id, { documents: updatedDocs });
      }
      setUploadTargetFile(prev => ({ ...prev, documents: updatedDocs }));
      setCameraTargetDoc(null);
      addToast(`Photo secured in Cloudflare R2: ${filename}`, 'success');
    } catch (e) {
      console.error('[MyApplications] Camera upload error:', e);
      addToast(e.message || 'Camera upload failed', 'error');
    } finally {
      hideLoader();
    }
  };

  // Quick stage advance
  const handleSaveQuickStage = (e) => {
    e.preventDefault();
    if (!quickStageFile || !quickStageVal) return;
    if (updateCustomerFile) {
      updateCustomerFile(quickStageFile.id, {
        currentStage: quickStageVal,
        updatedDate: new Date().toISOString().split('T')[0]
      });
    }
    if (addCustomerFileTimelineEvent) {
      addCustomerFileTimelineEvent(quickStageFile.id, {
        stage: quickStageVal,
        date: new Date().toISOString().split('T')[0],
        actor: currentDealer?.name || 'Dealer Partner',
        notes: quickStageNotes.trim() || `Stage milestone progressed to ${quickStageVal}.`
      });
    }
    setQuickStageFile(null);
    setQuickStageVal('');
    setQuickStageNotes('');
  };

  // Helper to format currency
  const formatINR = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  // Get stage label
  const getStageLabel = (stageIdOrLabel) => {
    if (!stageIdOrLabel) return '1. Lead Sourced';
    const found = stages.find(s => s.id === stageIdOrLabel || s.label === stageIdOrLabel);
    return found ? found.label : stageIdOrLabel;
  };

  // Category requirement helper
  const getRequiredDocsForFile = (file) => {
    const cat = (file.category || 'residential').toLowerCase();
    const list = requiredDocuments && requiredDocuments.length > 0 ? requiredDocuments : DEFAULT_REQUIRED_DOCUMENTS;
    return list.filter(d => (d.categories || []).includes(cat));
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* 1. HEADER & BREADCRUMBS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-surface-container-high">
        <div className="flex flex-col gap-2 max-w-4xl">
          <div className="flex items-center gap-2 text-secondary font-label-xs text-[11px] uppercase tracking-wider">
            <span>Dealer Operations</span>
            <span className="text-secondary/40 font-bold">/</span>
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('my_quotes')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Quotations
            </button>
            <span className="text-secondary/40 font-bold">/</span>
            <span className="text-on-surface font-semibold">My Applications Tracker</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-xs">
              <span className="material-symbols-outlined text-2xl">assignment</span>
            </div>
            <div>
              <h1 className="font-headline-md text-2xl font-bold tracking-tight text-on-surface font-space">
                My Customer Applications
              </h1>
              <p className="font-body-sm text-xs text-secondary mt-0.5">
                Track converted proposals, Gujarat DISCOM net-metering stages, document completeness, and subsidy disbursements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab && setActiveTab('create_quote')}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-2 hover:bg-primary/90 transition-all shadow-xs cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Total Applications</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-2xl font-bold text-on-surface">{metrics.total}</span>
            <span className="text-[10px] text-secondary">Converted</span>
          </div>
          <div className="mt-2 text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-primary">folder_open</span>
            <span>All booked files</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Verification / Survey</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-2xl font-bold text-amber-400">{metrics.verificationCount}</span>
            <span className="text-[10px] text-secondary">Stage 1-3</span>
          </div>
          <div className="mt-2 text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-amber-400">verified_user</span>
            <span>Document audit</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">DISCOM Net-Meter</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-2xl font-bold text-blue-400">{metrics.discomFilingCount}</span>
            <span className="text-[10px] text-secondary">Stage 4-5</span>
          </div>
          <div className="mt-2 text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-blue-400">grid_on</span>
            <span>Feasibility check</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col justify-between shadow-xs">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Installation &amp; Sync</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-2xl font-bold text-indigo-400">{metrics.installationCount}</span>
            <span className="text-[10px] text-secondary">Stage 6-8</span>
          </div>
          <div className="mt-2 text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-indigo-400">solar_power</span>
            <span>Hardware &amp; Meter</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col justify-between shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Handed Over / Subsidy</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-2xl font-bold text-emerald-400">{metrics.completedCount}</span>
            <span className="text-[10px] text-secondary">Commissioned</span>
          </div>
          <div className="mt-2 text-[10px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-emerald-400">verified</span>
            <span>DBT Released</span>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR: SEARCH, FILTERS & VIEW MODE */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by customer name, phone, file ID, consumer #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary font-medium"
          />
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dynamic Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[210px]"
          >
            <option value="ALL">All Application Stages</option>
            {stages.map(stg => (
              <option key={stg.id} value={stg.id}>
                {stg.label}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="residential">Residential Rooftop</option>
            <option value="commercial">Commercial &amp; Industrial</option>
            <option value="common_meter">Common Meter / Society</option>
          </select>

          {/* DISCOM Filter */}
          <select
            value={selectedDiscom}
            onChange={(e) => setSelectedDiscom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">All DISCOMs</option>
            <option value="PGVCL">PGVCL (Saurashtra/Kutch)</option>
            <option value="UGVCL">UGVCL (North Gujarat)</option>
            <option value="DGVCL">DGVCL (South Gujarat)</option>
            <option value="MGVCL">MGVCL (Central Gujarat)</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-surface-container-high ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-surface-container-highest text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
              title="Card Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-surface-container-highest text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. APPLICATIONS LIST / CARDS */}
      {displayedFiles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-container-lowest border border-surface-container-high flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-2xl">assignment_late</span>
          </div>
          <h3 className="font-bold text-sm text-on-surface">No Applications Match Your Filters</h3>
          <p className="text-xs text-secondary max-w-md">
            Convert an approved quotation from the Quotations tab or adjust your filters above.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedStage('ALL');
              setSelectedCategory('ALL');
              setSelectedDiscom('ALL');
            }}
            className="mt-2 px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-on-surface transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedFiles.map(file => {
            const reqDocs = getRequiredDocsForFile(file);
            const uploadedCount = reqDocs.filter(d => file.documents && file.documents[d.key]?.uploaded).length;
            const mandatoryMissing = reqDocs.some(d => {
              const isMandatory = isDocMandatoryForCategory(d, file.category || 'residential');
              return isMandatory && (!file.documents || !file.documents[d.key]?.uploaded);
            });

            return (
              <div
                key={file.id}
                className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 transition-all flex flex-col justify-between gap-4 shadow-xs"
              >
                {/* Card Top: Header & Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{file.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">
                          {file.discom || 'PGVCL'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-on-surface truncate mt-1">{file.customerName}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-secondary mt-0.5">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        <a href={`tel:${file.phone}`} className="hover:text-primary font-mono">{file.phone}</a>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-on-surface">
                        {file.solarSystemKw || 5} kW
                      </div>
                      <div className="text-[10px] font-mono text-secondary mt-0.5">
                        {formatINR(file.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Stage Milestone Badge */}
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-secondary font-semibold uppercase">Current Stage</span>
                      <span className="font-mono text-secondary">
                        {file.applicationNo || 'GEDA-PMSY-REG'}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-on-surface truncate flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></span>
                      <span className="truncate">{getStageLabel(file.currentStage)}</span>
                    </div>
                  </div>

                  {/* Document & Finance Status Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                      mandatoryMissing
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : 'bg-primary/15 text-primary border border-primary/20'
                    }`}>
                      <span className="material-symbols-outlined text-[13px]">
                        {mandatoryMissing ? 'pending_actions' : 'task_alt'}
                      </span>
                      <span>{uploadedCount}/{reqDocs.length} Docs Uploaded</span>
                    </span>

                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-secondary capitalize font-medium">
                      {file.category === 'common_meter' ? 'Society' : (file.category || 'residential')}
                    </span>

                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      file.financeType === 'LOAN'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {file.financeType === 'LOAN' ? `Loan (${file.loanBank || 'SBI'})` : 'Cash Advance'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-container/60 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickStageFile(file);
                      setQuickStageVal(file.currentStage || 'DISCOM_APPLICATION');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Quick Advance Stage"
                  >
                    <span className="material-symbols-outlined text-[15px]">alt_route</span>
                    <span>Stage</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUploadTargetFile(file)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Manage Uploads"
                    >
                      <span className="material-symbols-outlined text-[15px]">cloud_upload</span>
                      <span>Documents</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveFileDetail(file)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-1"
                      title="Full Lifecycle Detail"
                    >
                      <span>Details</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DENSE TABLE VIEW */
        <div className="overflow-x-auto rounded-2xl border border-surface-container-high bg-surface-container-lowest shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-container text-secondary font-semibold uppercase text-[10px] tracking-wider bg-surface-container-low/70">
                <th className="py-3 px-4">Application &amp; Customer</th>
                <th className="py-3 px-3">System / DISCOM</th>
                <th className="py-3 px-3">Pipeline Stage</th>
                <th className="py-3 px-3">Category &amp; Finance</th>
                <th className="py-3 px-3 text-center">Documents</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/60">
              {displayedFiles.map(file => {
                const reqDocs = getRequiredDocsForFile(file);
                const uploadedCount = reqDocs.filter(d => file.documents && file.documents[d.key]?.uploaded).length;
                const mandatoryMissing = reqDocs.some(d => {
                  const isMandatory = isDocMandatoryForCategory(d, file.category || 'residential');
                  return isMandatory && (!file.documents || !file.documents[d.key]?.uploaded);
                });

                return (
                  <tr key={file.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{file.id}</span>
                        {file.applicationNo && (
                          <span className="text-[10px] font-mono text-secondary px-1.5 py-0.2 rounded bg-surface-container">
                            {file.applicationNo}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-on-surface mt-0.5">{file.customerName}</div>
                      <div className="text-[11px] text-secondary font-mono">{file.phone}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-on-surface">{file.solarSystemKw || 5} kW</div>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary">
                        {file.discom || 'PGVCL'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="max-w-[220px]">
                        <div className="font-semibold text-xs text-on-surface truncate">
                          {getStageLabel(file.currentStage)}
                        </div>
                        <span className="text-[10px] text-secondary">Updated: {file.updatedDate || file.createdDate}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="capitalize text-[11px] font-medium text-on-surface">
                        {file.category === 'common_meter' ? 'Society Meter' : (file.category || 'residential')}
                      </div>
                      <div className="text-[10px] text-secondary font-medium">
                        {file.financeType === 'LOAN' ? `Loan (${file.loanBank || 'SBI'})` : 'Cash Payment'}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        mandatoryMissing
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-primary/15 text-primary border border-primary/20'
                      }`}>
                        <span>{uploadedCount}/{reqDocs.length}</span>
                        <span>{mandatoryMissing ? 'Pending' : 'Done'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setUploadTargetFile(file)}
                          className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                          title="Manage Uploads"
                        >
                          <span className="material-symbols-outlined text-[17px]">cloud_upload</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFileDetail(file)}
                          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
                          title="View Details"
                        >
                          Open
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

      {/* 5. MODAL: FULL FILE LIFECYCLE & TIMELINE */}
      {activeFileDetail && (
        <CustomerFileDetailModal
          file={activeFileDetail}
          onClose={() => setActiveFileDetail(null)}
        />
      )}

      {/* 6. MODAL: QUICK STAGE ADVANCE */}
      {quickStageFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col gap-4 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">alt_route</span>
                <h3 className="font-bold text-sm text-on-surface">Advance Application Stage</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickStageFile(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveQuickStage} className="space-y-4 text-xs">
              <div>
                <span className="text-secondary text-[11px] block">Customer File</span>
                <span className="font-bold text-sm text-on-surface">{quickStageFile.customerName} ({quickStageFile.id})</span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Select Next Application Stage *</label>
                <select
                  required
                  value={quickStageVal}
                  onChange={(e) => setQuickStageVal(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                >
                  {stages.map(stg => (
                    <option key={stg.id} value={stg.id}>
                      {stg.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Milestone Verification Notes</label>
                <textarea
                  rows="3"
                  placeholder="e.g. CEI drawing submitted or bi-directional meter test report received..."
                  value={quickStageNotes}
                  onChange={(e) => setQuickStageNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setQuickStageFile(null)}
                  className="px-3 py-2 rounded-xl border border-surface-container-highest text-secondary hover:text-on-surface cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: QUICK DOCUMENT MANAGEMENT (FULL VISIBILITY, NO CLIPPING) */}
      {uploadTargetFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col gap-4 text-on-surface my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-xl">folder_managed</span>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">
                    Application Documents — {uploadTargetFile.customerName}
                  </h3>
                  <span className="text-[11px] text-secondary font-mono">
                    File ID: {uploadTargetFile.id} • Category: {uploadTargetFile.category || 'residential'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadTargetFile(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="text-xs text-secondary leading-relaxed bg-surface-container-low p-3 rounded-xl border border-surface-container">
              Upload customer electricity bills, identity cards, and site photos. Uploading is non-blocking — you can progress application stages at any time.
            </div>

            {/* Document Upload Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {getRequiredDocsForFile(uploadTargetFile).map(doc => {
                const isMandatory = isDocMandatoryForCategory(doc, uploadTargetFile.category || 'residential');
                const docState = uploadTargetFile.documents && uploadTargetFile.documents[doc.key];
                const isUploaded = Boolean(docState?.uploaded);

                return (
                  <div
                    key={doc.id || doc.key}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                      isUploaded
                        ? 'bg-surface-container-low/90 border-primary/40'
                        : isMandatory
                          ? 'bg-surface-container-lowest border-amber-500/30'
                          : 'bg-surface-container-lowest border-surface-container-high'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-primary text-base">
                            {doc.icon || 'description'}
                          </span>
                          <span className="font-bold text-xs text-on-surface truncate">{doc.label}</span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                          isMandatory
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-surface-container text-secondary'
                        }`}>
                          {isMandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </div>

                      {doc.description && (
                        <p className="text-[11px] text-secondary mt-1 line-clamp-2 leading-relaxed">
                          {doc.description}
                        </p>
                      )}

                      {/* UPLOADED FILE STATUS WITH ZERO CLIPPING */}
                      {isUploaded && (
                        <div className="mt-2.5 p-2 rounded-lg bg-surface-container-lowest border border-surface-container space-y-1">
                          <div className="flex items-center gap-1.5 text-primary text-[11px] font-bold">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>File Uploaded</span>
                          </div>
                          {/* Full filename displayed without truncation */}
                          <div className="break-all text-[11px] font-mono text-on-surface leading-tight select-all">
                            {docState.filename}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-secondary font-mono pt-1">
                            <span>{docState.size || 'Optimized'}</span>
                            <span>{docState.date || 'Today'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Upload & Preview Controls */}
                    <div className="flex items-center gap-2 pt-2 border-t border-surface-container text-[11px]">
                      {isUploaded && (
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({
                            title: doc.label,
                            filename: docState.filename || 'document.pdf',
                            url: docState.url || docState.dataUrl
                          })}
                          className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-center cursor-pointer transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>Preview</span>
                        </button>
                      )}

                      <label className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-center cursor-pointer transition-colors flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">upload_file</span>
                        <span>{isUploaded ? 'Replace' : 'Upload'}</span>
                        <input
                          type="file"
                          accept=".pdf,.jpeg,.jpg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleUploadDocument(doc.key, e.target.files?.[0])}
                        />
                      </label>

                      {doc.captureMode !== 'file' && (
                        <button
                          type="button"
                          onClick={() => setCameraTargetDoc(doc)}
                          className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors cursor-pointer"
                          title="Capture with Camera"
                        >
                          <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-container shrink-0">
              <button
                type="button"
                onClick={() => setUploadTargetFile(null)}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RICH DOCUMENT PREVIEW & INSPECTION MODAL */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* 8. CAMERA CAPTURE MODAL */}
      {cameraTargetDoc && (
        <CameraCaptureModal
          isOpen={Boolean(cameraTargetDoc)}
          docKey={cameraTargetDoc.key}
          docLabel={cameraTargetDoc.label}
          onCapture={handleCameraCapture}
          onClose={() => setCameraTargetDoc(null)}
        />
      )}
    </div>
  );
}
