import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLoading } from '../../context/LoadingContext';
import CameraCaptureModal from '../Shared/CameraCaptureModal';
import { compressMedia, formatFileSize } from '../../utils/mediaOptimizer';
import { DEFAULT_REQUIRED_DOCUMENTS, isDocMandatoryForCategory } from '../../data/defaultRequiredDocuments';

export default function ConvertQuotationModal({ quotation, isOpen, onClose, onSuccess }) {
  const {
    currentDealer,
    currentStaff,
    role,
    addCustomerFile,
    updateQuotation,
    addNotification,
    logActivity,
    requiredDocuments,
    setActiveTab
  } = useApp();
  const { showLoader, hideLoader } = useLoading();

  if (!isOpen || !quotation) return null;

  // Determine DISCOM from city/location
  const inferDiscom = (loc = '') => {
    const l = loc.toLowerCase();
    if (l.includes('rajkot') || l.includes('jamnagar') || l.includes('bhavnagar') || l.includes('junagadh') || l.includes('amreli') || l.includes('porbandar') || l.includes('kutch') || l.includes('morbi')) return 'PGVCL';
    if (l.includes('surat') || l.includes('navsari') || l.includes('vapi') || l.includes('valsad') || l.includes('bharuch')) return 'DGVCL';
    if (l.includes('vadodara') || l.includes('anand') || l.includes('kheda') || l.includes('panchmahal')) return 'MGVCL';
    return 'UGVCL'; // Ahmedabad / Gandhinagar / Mehsana default
  };

  const capacityKw = Number(quotation.systemCapacityKW || quotation.capacity?.replace(/[^\d.]/g, '') || 5.0);
  const totalAmount = quotation.grandTotalCustomer || quotation.totalAmount || quotation.amount || 0;
  const numAmount = typeof totalAmount === 'number' ? totalAmount : Number(String(totalAmount).replace(/[^\d]/g, '')) || 0;

  // Form states
  const [customerName, setCustomerName] = useState(quotation.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(quotation.customerPhone || quotation.phone || '');
  const [address, setAddress] = useState(quotation.customerAddress || quotation.address || quotation.location || '');
  const [city, setCity] = useState(quotation.city || quotation.location?.split(',')[0] || 'Rajkot');
  const [discom, setDiscom] = useState(() => inferDiscom(quotation.location || quotation.city || ''));
  const [consumerNo, setConsumerNo] = useState(quotation.consumerNo || '');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState(quotation.sanctionedLoadKw || Math.ceil(capacityKw * 1.1));
  const [roofType, setRoofType] = useState('RCC Flat Terrace (Standard)');
  const [internalNotes, setInternalNotes] = useState(quotation.notes || 'Order booked from approved quotation. Ready for DISCOM net-meter verification.');

  // Application category state (Residential, Commercial, Common Meter)
  const [applicationCategory, setApplicationCategory] = useState(
    quotation.category || quotation.projectType?.toLowerCase().includes('comm') ? 'commercial' : 'residential'
  );

  // Documents state with compression metadata
  const [documents, setDocuments] = useState({});
  const [cameraTargetDoc, setCameraTargetDoc] = useState(null);

  // Dynamic document requirements mapped to selected category
  const activeDocRequirements = useMemo(() => {
    const list = requiredDocuments && requiredDocuments.length > 0 ? requiredDocuments : DEFAULT_REQUIRED_DOCUMENTS;
    return list.filter(d => (d.categories || []).includes(applicationCategory));
  }, [requiredDocuments, applicationCategory]);

  const handleFileUpload = async (docKey, file) => {
    if (!file) return;

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

    try {
      const optimized = await compressMedia(file);
      setDocuments(prev => ({
        ...prev,
        [docKey]: {
          filename: optimized.file?.name || file.name,
          size: optimized.compressedFormatted || formatFileSize(file.size),
          originalSize: optimized.originalFormatted || formatFileSize(file.size),
          reduction: optimized.reduction || '0%',
          dataUrl: optimized.dataUrl || optimized.posterDataUrl,
          uploaded: true,
          date: new Date().toISOString().split('T')[0]
        }
      }));
    } catch (e) {
      setDocuments(prev => ({
        ...prev,
        [docKey]: {
          filename: file.name,
          size: formatFileSize(file.size),
          uploaded: true,
          date: new Date().toISOString().split('T')[0]
        }
      }));
    }
  };

  const handleCameraCapture = (stats) => {
    if (!cameraTargetDoc || !stats) return;
    setDocuments(prev => ({
      ...prev,
      [cameraTargetDoc.key]: {
        filename: stats.file?.name || `${cameraTargetDoc.key}_camera.jpg`,
        size: stats.compressedFormatted,
        originalSize: stats.originalFormatted,
        reduction: stats.reduction,
        dataUrl: stats.dataUrl || stats.posterDataUrl,
        uploaded: true,
        date: new Date().toISOString().split('T')[0]
      }
    }));
    setCameraTargetDoc(null);
  };

  const handleRemoveDoc = (docKey) => {
    setDocuments(prev => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    showLoader('Converting Quotation to Operations File...');
    try {
      const fileId = `FIL-2026-${Math.floor(100 + Math.random() * 900)}`;
      const todayStr = new Date().toISOString().split('T')[0];

    // Build timeline
    const timeline = [
      {
        stage: 'Quotation Created',
        date: quotation.date || todayStr,
        actor: quotation.dealerName || currentDealer?.name || 'Channel Partner',
        notes: `Proposal generated for ${capacityKw} kW system (Quote #${quotation.id || 'N/A'})`
      },
      {
        stage: 'Order Booked / Customer File Created',
        date: todayStr,
        actor: role === 'staff' ? (currentStaff?.name || 'Sales Staff') : (currentDealer?.name || 'Authorized Dealer'),
        notes: `Converted to operations customer file. Token advance confirmed.`
      }
    ];

    const newCustomerFile = {
      id: fileId,
      customerName: customerName.trim(),
      phone: customerPhone.trim(),
      address: address.trim(),
      city: city.trim(),
      lat: 22.3039, // Rajkot/Gujarat default
      lon: 70.8022,
      discom,
      consumerNo: consumerNo.trim() || `${discom}-${Math.floor(100000 + Math.random() * 900000)}`,
      sanctionedLoadKw: Number(sanctionedLoadKw) || capacityKw,
      solarSystemKw: capacityKw,
      roofType,
      sourceType: 'DEALER',
      dealerId: quotation.dealerId || currentDealer?.id || 'SV-DLR-0104',
      dealerName: quotation.dealerName || currentDealer?.name || 'Authorized Channel Partner',
      staffId: currentDealer?.assignedStaffId || 'STF-001',
      staffName: currentDealer?.assignedStaffName || 'Territory Sales Officer',
      financeType: quotation.financeType || 'CASH',
      loanBank: quotation.loanBank || (quotation.financeType === 'LOAN' ? 'State Bank of India' : ''),
      loanTenureYears: quotation.loanTenureYears || 5,
      estimatedMonthlyEmi: quotation.estimatedMonthlyEmi || null,
      amount: numAmount,
      quotationId: quotation.id,
      status: 'Verification',
      currentStage: 'Registration',
      isCompleted: false,
      isFailed: false,
      failureReason: null,
      createdDate: todayStr,
      updatedDate: todayStr,
      applicationNo: `GEDA-PMSY-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      notes: internalNotes.trim(),
      timeline,
      documents: {
        lightBill: documents.lightBill || { uploaded: false, filename: null },
        aadhaar: documents.aadhaar || { uploaded: false, filename: null },
        pan: documents.pan || { uploaded: false, filename: null },
        propertyTax: documents.propertyTax || { uploaded: false, filename: null },
        passportPhoto: documents.passportPhoto || { uploaded: false, filename: null }
      }
    };

    if (addCustomerFile) {
      addCustomerFile(newCustomerFile);
    }

    if (updateQuotation && quotation.id) {
      updateQuotation(quotation.id, {
        status: 'Won / Order Booked',
        statusClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold',
        customerFileId: fileId,
        orderBookedDate: todayStr
      });
    }

    if (addNotification) {
      addNotification({
        type: 'success',
        icon: 'how_to_reg',
        title: `Order Booked — Customer File #${fileId} Created`,
        description: `Dispatched ${customerName} (${capacityKw} kW) to operations queue for DISCOM verification.`,
        targetTab: 'my_applications'
      });
    }

    if (logActivity) {
      logActivity({
        action: 'CONVERT_QUOTATION_TO_ORDER',
        module: 'QUOTATION_PORTAL',
        recordId: quotation.id,
        details: `Converted quote ${quotation.id} into Customer File ${fileId} (${customerName}, ${capacityKw} kW, ₹${numAmount.toLocaleString('en-IN')})`
      });
    }

      if (onSuccess) {
        onSuccess(fileId);
      }
      if (setActiveTab) {
        setActiveTab('my_applications');
      }
      onClose();
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 flex flex-col gap-6 text-on-surface">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-container">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-container/20 text-primary">
              <span className="material-symbols-outlined text-2xl">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="font-headline-md text-lg font-bold text-inverse-surface">
                Book Order &amp; Convert to Customer File
              </h3>
              <p className="font-body-sm text-xs text-secondary">
                Transforms Proposal #{quotation.id} into an active Gujarat DISCOM execution file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Pre-filled Proposal Snapshot Card */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-secondary block text-[10px] uppercase font-semibold">Customer</span>
            <span className="font-bold text-on-surface truncate block mt-0.5">{customerName || 'N/A'}</span>
          </div>
          <div>
            <span className="text-secondary block text-[10px] uppercase font-semibold">Plant Sizing</span>
            <span className="font-mono font-bold text-primary block mt-0.5">{capacityKw} kW</span>
          </div>
          <div>
            <span className="text-secondary block text-[10px] uppercase font-semibold">Grand Total</span>
            <span className="font-mono font-bold text-on-surface block mt-0.5">₹{numAmount.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-secondary block text-[10px] uppercase font-semibold">Finance Type</span>
            <span className="font-bold text-on-surface block mt-0.5">
              {quotation.financeType === 'LOAN' ? `Solar Loan (${quotation.loanBank || 'SBI'})` : 'Direct Cash'}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section A: Customer & Site Details */}
          <div>
            <h4 className="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">person_pin</span>
              A. Customer &amp; DISCOM Connection Parameters
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Customer Contact Phone *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface font-mono font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Installation Site Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot / Society / Street address"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">City / District</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Gujarat DISCOM</label>
                  <select
                    value={discom}
                    onChange={(e) => setDiscom(e.target.value)}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="TORRENT">Torrent Power</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Consumer Connection No.</label>
                <input
                  type="text"
                  placeholder="e.g. 02148 / 90281"
                  value={consumerNo}
                  onChange={(e) => setConsumerNo(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sanctionedLoadKw}
                    onChange={(e) => setSanctionedLoadKw(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface font-mono font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-on-surface mb-1">Terrace Type</label>
                  <select
                    value={roofType}
                    onChange={(e) => setRoofType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="RCC Flat Terrace (Standard)">RCC Flat Terrace</option>
                    <option value="Elevated Superstructure (>7ft)">Elevated Structure</option>
                    <option value="Industrial Metal Tin Shed">Metal Tin Shed</option>
                    <option value="Sloped Tile Roof">Sloped Tile Roof</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Dynamic Document Checklist with Direct Camera Capture & Client-Side Compression */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">folder_open</span>
                  B. Document Checklist (Dynamic Category Mapping)
                </h4>
                <p className="text-[11px] text-secondary">
                  Checklist automatically adjusts based on customer category. Direct camera capture and on-device compression enabled.
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-semibold whitespace-nowrap">
                Non-Blocking (Strictly Optional)
              </span>
            </div>

            {/* Application Category Switcher */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-surface-container-low rounded-xl border border-surface-container-high">
              {[
                { id: 'residential', label: 'Residential', icon: 'home' },
                { id: 'commercial', label: 'Commercial (C&I)', icon: 'corporate_fare' },
                { id: 'common_meter', label: 'Common Meter', icon: 'apartment' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setApplicationCategory(cat.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    applicationCategory === cat.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Dynamic Card-Based UI for Document Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeDocRequirements.map((doc) => {
                const uploaded = documents[doc.key];
                const isMandatory = isDocMandatoryForCategory(doc, applicationCategory);
                return (
                  <div
                    key={doc.id || doc.key}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                      uploaded
                        ? 'bg-primary-container/10 border-primary/40'
                        : isMandatory
                        ? 'bg-surface-container-low border-amber-500/30'
                        : 'bg-surface-container-low border-surface-container-high/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-primary text-lg shrink-0">
                          {doc.icon || 'description'}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-on-surface block text-[11px] truncate">{doc.label}</span>
                          <span className="text-[10px] text-secondary block truncate">{doc.description || doc.desc}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          uploaded
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isMandatory
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-surface-container text-secondary'
                        }`}
                      >
                        {uploaded ? 'Ready' : isMandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>

                    {uploaded ? (
                      <div className="pt-2 border-t border-surface-container space-y-1.5">
                        <div className="flex items-start justify-between gap-2 bg-surface-container/60 p-2 rounded-lg border border-primary/25">
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">draft</span>
                            <span className="text-primary font-mono text-[11px] font-semibold break-all leading-tight select-all">
                              {uploaded.filename}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(doc.key)}
                            className="text-error hover:text-error/80 text-[10px] font-bold cursor-pointer shrink-0 px-1.5 py-0.5 rounded hover:bg-error/10 transition-colors"
                            title="Remove uploaded document"
                          >
                            Remove
                          </button>
                        </div>
                        {uploaded.reduction && uploaded.reduction !== '0%' && (
                          <div className="text-[9px] text-emerald-400 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">bolt</span>
                            <span>{uploaded.originalSize} → {uploaded.size} ({uploaded.reduction} saved)</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {/* Direct Camera Capture Button */}
                        <button
                          type="button"
                          onClick={() => setCameraTargetDoc(doc)}
                          className="py-1.5 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary hover:text-primary-container text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-surface-container-highest"
                          title="Open Camera to capture photo or record video"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {doc.captureMode === 'video' ? 'videocam' : 'photo_camera'}
                          </span>
                          <span>Camera</span>
                        </button>

                        {/* File Upload Button */}
                        <label className="py-1.5 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-surface-container-highest">
                          <span className="material-symbols-outlined text-[14px]">upload_file</span>
                          <span>File</span>
                          <input
                            type="file"
                            accept={doc.allowedExtensions?.join(',') || '.pdf,.jpg,.jpeg,.png,.mp4'}
                            className="hidden"
                            onChange={(e) => handleFileUpload(doc.key, e.target.files?.[0])}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section C: Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Internal Booking Notes &amp; Handover Instructions
            </label>
            <textarea
              rows="2"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="e.g. Token advance received via UPI. Site survey scheduled for tomorrow morning."
              className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg text-xs font-body text-on-surface focus:outline-none focus:border-primary placeholder:text-secondary"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Confirm &amp; Book Order</span>
            </button>
          </div>
        </form>
      </div>

      {/* Direct Camera Capture Modal */}
      {cameraTargetDoc && (
        <CameraCaptureModal
          isOpen={Boolean(cameraTargetDoc)}
          onClose={() => setCameraTargetDoc(null)}
          onCapture={handleCameraCapture}
          mode={cameraTargetDoc.captureMode === 'video' ? 'video' : 'photo'}
          documentLabel={cameraTargetDoc.label}
        />
      )}
    </div>
  );
}
