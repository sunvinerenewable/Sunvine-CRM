import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';
import DocumentPreviewModal from '../Shared/DocumentPreviewModal';
import { GROUPED_SOLAR_BANKS } from '../../data/solarBanksData';
import SolarBankSelectorModal from '../Shared/SolarBankSelectorModal';
import { storageService } from '../../services/storageService';
import { useLoading } from '../../context/LoadingContext';

export default function StaffFiles() {
  const { currentStaff, customerFiles, dealers, updateFileStatus, updateCustomerFile, addCustomerFile } = useApp();
  const { addToast } = useToast();
  const { showLoader, hideLoader } = useLoading();

  const [statusFilter, setStatusFilter] = useState('all');
  const [financeFilter, setFinanceFilter] = useState('all'); // 'all', 'CASH', 'LOAN'
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'DIRECT_STAFF', 'DEALER'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileForDocs, setSelectedFileForDocs] = useState(null);
  const [selectedFileForTimeline, setSelectedFileForTimeline] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showAddFileModal, setShowAddFileModal] = useState(false);

  // New File Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustDiscom, setNewCustDiscom] = useState('UGVCL');
  const [newCustConsumerNo, setNewCustConsumerNo] = useState('');
  const [newCustLoad, setNewCustLoad] = useState('5.0');
  const [newCustSolarKw, setNewCustSolarKw] = useState('4.4');
  const [newCustSourceType, setNewCustSourceType] = useState('DIRECT_STAFF');
  const [newCustDealerId, setNewCustDealerId] = useState('');
  const [newCustFinanceType, setNewCustFinanceType] = useState('CASH');
  const [newCustLoanBank, setNewCustLoanBank] = useState('State Bank of India (PM Surya Ghar Scheme)');
  const [newCustLoanRef, setNewCustLoanRef] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);

  const isVerificationStaff = Boolean(
    currentStaff?.role?.toLowerCase().includes('verification') ||
    currentStaff?.department === 'verification' ||
    currentStaff?.id === 'STF-003'
  );

  // If verification staff, oversee all office files; if salesperson, strictly their assigned files
  const myFiles = isVerificationStaff
    ? (customerFiles || [])
    : (customerFiles || []).filter(
        (f) => f.staffId === currentStaff?.id || f.staffName === currentStaff?.name
      );

  const filteredFiles = myFiles.filter((f) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      f.customerName.toLowerCase().includes(term) ||
      (f.consumerNo || '').toLowerCase().includes(term) ||
      f.phone.includes(term) ||
      f.id.toLowerCase().includes(term);

    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    
    const isDealer = f.sourceType === 'DEALER' || f.source === 'DEALER';
    const matchSource =
      sourceFilter === 'all' ||
      (sourceFilter === 'DEALER' && isDealer) ||
      (sourceFilter === 'DIRECT_STAFF' && !isDealer);

    const isLoan = f.financeType === 'LOAN' || f.paymentMode === 'LOAN';
    const matchFinance =
      financeFilter === 'all' ||
      (financeFilter === 'LOAN' && isLoan) ||
      (financeFilter === 'CASH' && !isLoan);

    return matchSearch && matchStatus && matchSource && matchFinance;
  });

  const handleCreateCustomerFile = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      addToast('Please enter customer name and phone', 'error');
      return;
    }

    showLoader('Registering new customer file...');
    try {
      const matchedDealer = newCustSourceType === 'DEALER' ? (dealers || []).find(d => d.id === newCustDealerId) : null;
      const newFileId = `FIL-2026-${String((customerFiles || []).length + 85).padStart(3, '0')}`;
      const newFile = {
        id: newFileId,
        customerName: newCustName.trim(),
        phone: newCustPhone.trim(),
        address: newCustAddress.trim() || 'Gujarat, India',
        discom: newCustDiscom,
        consumerNo: newCustConsumerNo.trim() || `${newCustDiscom}-${Math.floor(100000 + Math.random() * 900000)}`,
        sanctionedLoadKw: parseFloat(newCustLoad) || 5.0,
        solarSystemKw: parseFloat(newCustSolarKw) || 3.3,
        roofType: 'RCC Terrace',
        staffId: currentStaff?.id || 'STF-001',
        staffName: currentStaff?.name || 'Sales Officer',
        sourceType: newCustSourceType,
        source: newCustSourceType === 'DEALER' ? 'DEALER' : 'DIRECT_STAFF',
        dealerId: matchedDealer ? matchedDealer.id : null,
        dealerName: matchedDealer ? (matchedDealer.firmName || matchedDealer.name) : null,
        financeType: newCustFinanceType,
        paymentMode: newCustFinanceType,
        loanBank: newCustFinanceType === 'LOAN' ? newCustLoanBank : null,
        loanRefNo: newCustFinanceType === 'LOAN' ? newCustLoanRef.trim() : null,
        createdDate: new Date().toISOString().split('T')[0],
        status: 'Sourced',
        currentStage: 'LEAD_SOURCED',
        applicationNo: 'Draft Pending',
        documents: {
          aadhaar: { uploaded: false, filename: null, date: null },
          lightBill: { uploaded: false, filename: null, date: null },
          meterPhoto: { uploaded: false, filename: null, date: null },
          sitePhoto: { uploaded: false, filename: null, date: null },
          bankPassbook: { uploaded: false, filename: null, date: null }
        }
      };

      await addCustomerFile(newFile);
      setShowAddFileModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustConsumerNo('');
      setNewCustLoanRef('');
      addToast(`New file ${newFileId} created for ${newFile.customerName}!`, 'success');
    } finally {
      hideLoader();
    }
  };

  const handleDownloadGovtPack = (customerFile) => {
    if (!customerFile) return;
    const docs = customerFile.documents || {};
    const attached = Object.entries(docs).filter(([_, d]) => d?.uploaded && d?.url);

    if (attached.length === 0) {
      addToast('No PDF documents have been uploaded for this customer yet.', 'error');
      return;
    }

    attached.forEach(([key, doc]) => {
      const link = document.createElement('a');
      link.href = doc.url;
      link.target = '_blank';
      link.download = `${customerFile.id}_${key}_${doc.filename || 'document.pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    addToast(`Downloading ${attached.length} government-ready PDF(s)...`, 'success');
  };

  const handleUploadDoc = async (fileId, docKey, fileOrName = 'document.pdf') => {
    const file = myFiles.find(f => f.id === fileId);
    if (!file) return;

    if (!fileOrName) return;

    // Strict PDF & Image (JPG, PNG, WEBP) & 2 MB Validation
    if (typeof fileOrName === 'object') {
      const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      const fileExt = fileOrName.name?.split('.').pop()?.toLowerCase() || '';
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const isAllowed = allowedExts.includes(fileExt) || allowedMimes.includes(fileOrName.type?.toLowerCase());

      if (!isAllowed) {
        addToast('Invalid file format. Only PDF (.pdf) and Images (.jpeg, .jpg, .png, .webp) are allowed.', 'error');
        return;
      }
      if (fileOrName.size > 2 * 1024 * 1024) {
        const sizeMB = (fileOrName.size / 1024 / 1024).toFixed(2);
        addToast(`File size (${sizeMB} MB) exceeds maximum 2 MB limit allowed. Please compress the file.`, 'error');
        return;
      }
    }

    let filename = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
    let fileUrl = null;
    let fileSize = typeof fileOrName === 'object' ? fileOrName.size : null;

    showLoader('Securing document in Cloudflare R2 Vault...');
    try {
      if (fileOrName && typeof fileOrName === 'object' && fileOrName.name) {
        try {
          const uploadRes = await storageService.uploadCustomerDocument(fileOrName, fileId, docKey);
          if (uploadRes?.success) {
            filename = uploadRes.filename || fileOrName.name;
            fileUrl = uploadRes.publicUrl || uploadRes.url;
            fileSize = uploadRes.fileSize || fileOrName.size;
          }
        } catch (err) {
          console.warn('[StaffFiles] Cloudflare R2 upload error:', err);
          addToast(err.message || 'Upload failed', 'error');
          return;
        }
      }

      const updatedDocs = {
        ...file.documents,
        [docKey]: {
          uploaded: true,
          filename: filename || `${docKey}_document.pdf`,
          url: fileUrl,
          sizeBytes: fileSize,
          date: new Date().toISOString().split('T')[0]
        }
      };

      updateCustomerFile(fileId, { documents: updatedDocs });

      if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
        setSelectedFileForDocs(prev => ({ ...prev, documents: updatedDocs }));
      }

      addToast(`Document attached: ${filename}`, 'success');
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header with Quick "+ New Customer File" Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">folder_shared</span>
            <span>My Customer Files &amp; Subsidies</span>
          </h1>
          <p className="text-xs text-secondary mt-1">
            Live Office Pipeline tracking: Follow each file from sourcing to document verification, DISCOM filing, and DBT subsidy clearance.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-secondary">
            <span className="font-semibold text-primary">{filteredFiles.length}</span> of {myFiles.length} Files
          </div>
          <button
            onClick={() => setShowAddFileModal(true)}
            className="h-9 px-3.5 bg-primary-container hover:bg-primary text-on-primary-container hover:text-white font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 shadow-sm text-xs cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">note_add</span>
            <span>+ New Customer File</span>
          </button>
        </div>
      </div>

      {/* Filters Bar: Status, Source Type, and Finance Type */}
      <div className="space-y-3 bg-surface p-3 sm:p-4 rounded-xl border border-surface-container-high shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Stage Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { key: 'all', label: 'All Stages' },
              { key: 'Sourced', label: '1. Sourced' },
              { key: 'Verification', label: '2. Verification' },
              { key: 'DISCOM Registered', label: '3. DISCOM Reg.' },
              { key: 'Subsidized', label: '4. Subsidized' }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === t.key
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-secondary">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, phone, consumer no..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary outline-none"
            />
          </div>
        </div>

        {/* Secondary Sub-filters: Source (Direct vs Dealer) & Finance (Cash vs Loan) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container-high/60 text-xs">
          <span className="text-secondary font-semibold text-[11px] uppercase tracking-wider mr-1">Filter by:</span>

          {/* Source Filter Chips */}
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5 bg-surface-container-low">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                sourceFilter === 'all' ? 'bg-white shadow-2xs text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('DIRECT_STAFF')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                sourceFilter === 'DIRECT_STAFF' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              Direct Staff
            </button>
            <button
              onClick={() => setSourceFilter('DEALER')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                sourceFilter === 'DEALER' ? 'bg-purple-600 text-white shadow-2xs' : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              Dealer Files
            </button>
          </div>

          {/* Finance Filter Chips */}
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5 bg-surface-container-low">
            <button
              onClick={() => setFinanceFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                financeFilter === 'all' ? 'bg-white shadow-2xs text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setFinanceFilter('CASH')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                financeFilter === 'CASH' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Cash Case
            </button>
            <button
              onClick={() => setFinanceFilter('LOAN')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                financeFilter === 'LOAN' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              Solar Loan
            </button>
          </div>
        </div>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map((file) => {
          const docsCount = Object.values(file.documents || {}).filter((d) => d.uploaded).length;
          const statusColors = {
            'Sourced': 'bg-amber-100 text-amber-800 border-amber-200',
            'Verification': 'bg-blue-100 text-blue-800 border-blue-200',
            'DISCOM Registered': 'bg-purple-100 text-purple-800 border-purple-200',
            'Subsidized': 'bg-emerald-100 text-emerald-800 border-emerald-200'
          };

          return (
            <div
              key={file.id}
              className="bg-surface rounded-xl p-5 border border-surface-container-high shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[11px] font-mono font-bold text-secondary">{file.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        file.sourceType === 'DEALER' || file.source === 'DEALER'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {file.sourceType === 'DEALER' || file.source === 'DEALER' ? `Dealer (${file.dealerName || file.dealerId || 'Partner'})` : 'Direct Staff'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        file.financeType === 'LOAN' || file.paymentMode === 'LOAN'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {file.financeType === 'LOAN' || file.paymentMode === 'LOAN' ? `Loan (${file.loanBank ? file.loanBank.split(' ')[0] : 'Bank'})` : 'Cash Case'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-on-surface hover:text-primary transition-colors">
                      {file.customerName}
                    </h3>
                  </div>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold shrink-0 ${statusColors[file.status]}`}>
                    {file.status}
                  </span>
                </div>

                {/* Office Pipeline Stage Tracker */}
                <div className="mt-3 p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary">account_tree</span>
                      <span>Office Stage Tracking:</span>
                    </span>
                    <span className="font-bold text-primary font-mono text-[10px] uppercase truncate max-w-[140px]" title={file.currentStage || file.status}>
                      {file.currentStage ? file.currentStage.replace(/_/g, ' ') : file.status}
                    </span>
                  </div>
                  {/* Progress Step Bar */}
                  <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-center">
                    {[
                      { step: 1, label: 'Sourced', key: 'Sourced' },
                      { step: 2, label: 'Verify', key: 'Verification' },
                      { step: 3, label: 'DISCOM', key: 'DISCOM Registered' },
                      { step: 4, label: 'Subsidy', key: 'Subsidized' }
                    ].map((st) => {
                      const stageOrder = ['Sourced', 'Verification', 'DISCOM Registered', 'Subsidized'];
                      const currentIdx = stageOrder.indexOf(file.status);
                      const stepIdx = stageOrder.indexOf(st.key);
                      const isCompleted = stepIdx < currentIdx;
                      const isCurrent = stepIdx === currentIdx;

                      return (
                        <div
                          key={st.key}
                          className={`py-1 px-1 rounded flex items-center justify-center gap-0.5 border ${
                            isCompleted
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : isCurrent
                              ? 'bg-primary text-white border-primary shadow-2xs font-extrabold'
                              : 'bg-white/80 border-surface-container-high text-secondary/70'
                          }`}
                        >
                          {isCompleted ? (
                            <span className="material-symbols-outlined text-[11px] leading-none">check</span>
                          ) : (
                            <span>{st.step}.</span>
                          )}
                          <span className="truncate">{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Specs */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-[10px] text-secondary block">Connection / DISCOM</span>
                    <span className="font-bold text-on-surface">{file.discom}</span>
                    <span className="text-[11px] text-secondary block truncate">{file.consumerNo || 'No Consumer No'}</span>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-[10px] text-secondary block">System Capacity</span>
                    <span className="font-bold text-emerald-600">{file.solarSystemKw} kW Solar</span>
                    <span className="text-[11px] text-secondary block">{file.sanctionedLoadKw} kW Load</span>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="mt-3 space-y-1.5 text-xs text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">call</span>
                    <a href={`tel:${file.phone}`} className="hover:underline text-on-surface font-semibold">
                      {file.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-[15px] text-secondary">location_on</span>
                    <span className="truncate">{file.address}</span>
                  </div>
                  {file.notes && (
                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200/50 text-amber-900 text-[11px] mt-2">
                      <strong>Note:</strong> {file.notes}
                    </div>
                  )}
                </div>

                {/* Document Status - Explicitly marked Optional */}
                <div className="mt-4 pt-3 border-t border-surface-container-high">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-secondary font-medium">Documents (Optional)</span>
                    <span className="text-emerald-700 font-bold text-[11px]">{docsCount} / 5 Attached</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { key: 'aadhaar', label: 'Aadhaar' },
                      { key: 'lightBill', label: 'Bill' },
                      { key: 'meterPhoto', label: 'Meter' },
                      { key: 'sitePhoto', label: 'Site' },
                      { key: 'bankPassbook', label: 'Bank' }
                    ].map((doc) => {
                      const isUp = file.documents?.[doc.key]?.uploaded;
                      return (
                        <div
                          key={doc.key}
                          title={`${doc.label}: ${isUp ? 'Uploaded' : 'Optional / Not uploaded'}`}
                          className={`py-1 rounded text-[10px] font-semibold border ${
                            isUp
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-surface-container-low border-surface-container-high text-secondary/60'
                          }`}
                        >
                          {doc.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedFileForTimeline(file)}
                  className="py-1.5 px-2 bg-primary-container/15 hover:bg-primary-container/25 text-primary text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="View Timeline & Advance Stage"
                >
                  <span className="material-symbols-outlined text-[15px]">timeline</span>
                  <span>Timeline</span>
                </button>

                <button
                  onClick={() => setSelectedFileForDocs(file)}
                  className="py-1.5 px-2 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">upload_file</span>
                  <span>Docs (Optional)</span>
                </button>

                <select
                  value={file.status}
                  onChange={(e) => {
                    updateFileStatus(file.id, e.target.value);
                    addToast(`Updated ${file.customerName} status to "${e.target.value}"`, 'success');
                  }}
                  className="px-2 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Sourced">Sourced</option>
                  <option value="Verification">Verification</option>
                  <option value="DISCOM Registered">DISCOM Reg.</option>
                  <option value="Subsidized">Subsidized</option>
                </select>

                <a
                  href={`https://wa.me/${file.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(file.customerName)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Officer')}%20from%20Sunvine%20Renewable%20regarding%20your%20${file.solarSystemKw}kW%20rooftop%20solar%20file.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg transition-colors"
                  title="WhatsApp"
                >
                  <span className="material-symbols-outlined text-[17px]">chat</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFiles.length === 0 && (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-container-high text-secondary">
          <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">folder_off</span>
          <p className="text-sm">No customer files match your search criteria.</p>
        </div>
      )}

      {/* MODAL: CREATE NEW CUSTOMER FILE */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-on-surface">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">note_add</span>
                <span>Create New Customer File</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddFileModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCustomerFile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Bharatbhai M. Patel"
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+91 98250 99881"
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Site Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Plot 10, Suryam Residency, Ring Road, Ahmedabad"
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">DISCOM</label>
                  <select
                    value={newCustDiscom}
                    onChange={(e) => setNewCustDiscom(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Consumer No (Optional)</label>
                  <input
                    type="text"
                    value={newCustConsumerNo}
                    onChange={(e) => setNewCustConsumerNo(e.target.value)}
                    placeholder="e.g. 03901/12345/6"
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCustLoad}
                    onChange={(e) => setNewCustLoad(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Proposed Solar (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCustSolarKw}
                    onChange={(e) => setNewCustSolarKw(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Source Type & Finance Type (Cash vs Loan) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Source Type</label>
                  <select
                    value={newCustSourceType}
                    onChange={(e) => setNewCustSourceType(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="DIRECT_STAFF">Direct Sales Lead</option>
                    <option value="DEALER">Dealer Network Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Payment / Case Type</label>
                  <select
                    value={newCustFinanceType}
                    onChange={(e) => setNewCustFinanceType(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="CASH">100% Cash / Self Paid</option>
                    <option value="LOAN">Solar Bank Loan / EMI</option>
                  </select>
                </div>
              </div>

              {newCustSourceType === 'DEALER' && (
                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Associated Dealer</label>
                  <select
                    value={newCustDealerId}
                    onChange={(e) => setNewCustDealerId(e.target.value)}
                    className="w-full bg-purple-50/40 border border-purple-200 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Select Dealer Partner --</option>
                    {(dealers || []).map((d) => (
                      <option key={d.id} value={d.id}>{d.firmName || d.name} ({d.id})</option>
                    ))}
                  </select>
                </div>
              )}

              {newCustFinanceType === 'LOAN' && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-amber-900">Financing Bank / NBFC</label>
                      <button
                        type="button"
                        onClick={() => setShowBankModal(true)}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">manage_search</span>
                        <span>Browse 40+ Official Banks</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={newCustLoanBank}
                        onChange={(e) => setNewCustLoanBank(e.target.value)}
                        className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {GROUPED_SOLAR_BANKS.map((group) => (
                          <optgroup key={group.category} label={group.label}>
                            {group.banks.map((b) => (
                              <option key={b.id} value={b.name}>
                                {b.name} ({b.interestRate.split(' ')[0]})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowBankModal(true)}
                        className="px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer"
                        title="Browse All 40+ Banks"
                      >
                        <span className="material-symbols-outlined text-[17px]">search</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">Loan Ref / App # (Opt)</label>
                    <input
                      type="text"
                      value={newCustLoanRef}
                      onChange={(e) => setNewCustLoanRef(e.target.value)}
                      placeholder="e.g. SBI-2026-9812"
                      className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-4 py-2 bg-surface-container-low text-secondary hover:text-on-surface text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Create Customer File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OPTIONAL DOCUMENT VAULT MODAL (PM Surya Ghar / DISCOM Compliant) */}
      {selectedFileForDocs && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-container-high pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-primary">{selectedFileForDocs.id}</span>
                <h3 className="text-lg font-bold text-on-surface">
                  {selectedFileForDocs.customerName} - Document Vault
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-semibold border border-primary/30">
                    PDF &amp; Images &bull; Max 2 MB per document
                  </span>
                  <span className="text-[11px] text-secondary">
                    PM Surya Ghar / DISCOM Portal Ready
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="text-secondary hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'aadhaar', label: 'Aadhaar Card' },
                { key: 'lightBill', label: 'Electricity / Light Bill' },
                { key: 'meterPhoto', label: 'Electricity Meter Photo' },
                { key: 'sitePhoto', label: 'Rooftop / Site Photo' },
                { key: 'bankPassbook', label: 'Bank Passbook / Cheque' }
              ].map((doc) => {
                const isUp = selectedFileForDocs.documents?.[doc.key]?.uploaded;
                const dData = selectedFileForDocs.documents?.[doc.key];
                const sizeLabel = dData?.sizeBytes ? ` (${(dData.sizeBytes / 1024).toFixed(0)} KB)` : '';
                const isPdf = dData?.filename?.toLowerCase().endsWith('.pdf');

                return (
                  <div
                    key={doc.key}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      isUp ? 'bg-emerald-50/50 border-emerald-300' : 'bg-surface-container-low border-surface-container-high'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface">{doc.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isUp ? 'bg-emerald-200 text-emerald-800' : 'bg-surface-container text-secondary'
                        }`}>
                          {isUp ? `${isPdf ? 'PDF' : 'Photo'} Attached${sizeLabel}` : 'PDF / Photo (Optional)'}
                        </span>
                      </div>
                      {isUp && (
                        <p className="text-[11px] font-mono text-primary mt-1 break-all leading-tight select-all bg-surface-container/60 p-1.5 rounded border border-primary/20">
                          {dData?.filename}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-surface-container-high/60 flex items-center justify-between gap-2">
                      {isUp ? (
                        <div className="flex items-center gap-3 w-full justify-between">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ title: doc.label, ...dData })}
                            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            <span>View Preview</span>
                          </button>

                          <label className="text-[11px] text-secondary hover:text-primary font-medium cursor-pointer flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">sync</span>
                            <span>Replace</span>
                            <input
                              type="file"
                              accept=".pdf,.jpeg,.jpg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) await handleUploadDoc(selectedFileForDocs.id, doc.key, f);
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="text-xs text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">upload_file</span>
                          <span>Upload (Max 2 MB)</span>
                          <input
                            type="file"
                            accept=".pdf,.jpeg,.jpg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) await handleUploadDoc(selectedFileForDocs.id, doc.key, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-surface-container-high gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleDownloadGovtPack(selectedFileForDocs)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Download Government PDF Pack</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFileForDocs(null)}
                className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close Vault
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

      {/* TIMELINE & ATTRIBUTION MODAL */}
      {selectedFileForTimeline && (
        <CustomerFileDetailModal
          file={selectedFileForTimeline}
          onClose={() => setSelectedFileForTimeline(null)}
        />
      )}

      {/* MODAL: BROWSE ALL 40+ OFFICIAL SOLAR LOAN BANKS & FINTECHS */}
      <SolarBankSelectorModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        selectedBankName={newCustLoanBank}
        onSelectBank={(selectedName) => setNewCustLoanBank(selectedName)}
      />
    </div>
  );
}
