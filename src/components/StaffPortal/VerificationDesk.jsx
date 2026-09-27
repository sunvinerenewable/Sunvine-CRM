import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';

export default function VerificationDesk() {
  const {
    customerFiles,
    staffList,
    dealers,
    updateCustomerFile,
    updateFileStatus,
    addCustomerFileTimelineEvent,
    currentStaff,
    role
  } = useApp();
  const { addToast } = useToast();

  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'DIRECT_STAFF', 'DEALER'
  const [financeFilter, setFinanceFilter] = useState('all'); // 'all', 'CASH', 'LOAN'
  const [staffFilter, setStaffFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileForTimeline, setSelectedFileForTimeline] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // All files in system accessible to Verification Desk
  const allFiles = customerFiles || [];

  const filteredFiles = allFiles.filter((f) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      f.customerName.toLowerCase().includes(term) ||
      (f.consumerNo || '').toLowerCase().includes(term) ||
      (f.phone || '').includes(term) ||
      f.id.toLowerCase().includes(term) ||
      (f.staffName || '').toLowerCase().includes(term) ||
      (f.dealerName || '').toLowerCase().includes(term);

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

    const matchStaff = staffFilter === 'all' || f.staffId === staffFilter;

    const matchStage = stageFilter === 'all' || f.status === stageFilter;

    return matchSearch && matchSource && matchFinance && matchStaff && matchStage;
  });

  // Verification Counts
  const pendingVerificationCount = allFiles.filter(
    (f) => f.status === 'Sourced' || f.status === 'Verification'
  ).length;
  const discomRegisteredCount = allFiles.filter((f) => f.status === 'DISCOM Registered').length;
  const directFilesCount = allFiles.filter(
    (f) => f.sourceType !== 'DEALER' && f.source !== 'DEALER'
  ).length;
  const dealerFilesCount = allFiles.filter(
    (f) => f.sourceType === 'DEALER' || f.source === 'DEALER'
  ).length;

  const handleVerifyDocument = (fileId, docKey) => {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file) return;

    const currentDoc = file.documents?.[docKey] || {};
    const updatedDocs = {
      ...file.documents,
      [docKey]: {
        ...currentDoc,
        uploaded: true,
        verified: true,
        verifiedBy: currentStaff?.name || 'Verification Desk',
        verifiedAt: new Date().toISOString().split('T')[0]
      }
    };

    updateCustomerFile(fileId, { documents: updatedDocs });
    addCustomerFileTimelineEvent(fileId, {
      stage: file.currentStage || file.status,
      status: file.status,
      title: `Doc Verified: ${docKey.toUpperCase()}`,
      action: 'DOC_VERIFICATION',
      actor: currentStaff?.name || 'Verification Manager',
      notes: `Office verification desk confirmed authentic copy of ${docKey}.`,
      isCompleted: false
    });

    addToast(`Document "${docKey}" verified for ${file.customerName}`, 'success');
  };

  const handleAdvanceStage = (fileId, nextStage, nextStatus) => {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file) return;

    updateCustomerFile(fileId, {
      currentStage: nextStage,
      status: nextStatus
    });

    addCustomerFileTimelineEvent(fileId, {
      stage: nextStage,
      status: nextStatus,
      title: `Pipeline Advanced to ${nextStatus}`,
      action: 'STAGE_PROGRESSION',
      actor: currentStaff?.name || 'Verification Manager',
      notes: `Office verification desk moved file from ${file.status} to ${nextStatus}.`,
      isCompleted: nextStatus === 'Subsidized'
    });

    addToast(`File ${file.id} advanced to "${nextStatus}"!`, 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-secondary mb-1">
            <span>Operations</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-on-surface font-semibold">Verification Manager Desk</span>
          </nav>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">verified_user</span>
            <span>Customer File Verification &amp; Office Desk</span>
          </h1>
          <p className="text-xs text-secondary mt-1">
            Centralized document scrutiny queue, DISCOM sync, and stage advancement. Real-time updates automatically broadcast to sales executives and dealers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-secondary font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Office Queue: <strong>{filteredFiles.length}</strong> Files</span>
          </span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface rounded-xl p-4 border border-surface-container-high shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-secondary">Pending Scrutiny</div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">{pendingVerificationCount}</div>
          <div className="text-[11px] text-secondary mt-0.5">Awaiting Doc Review</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-container-high shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-secondary">DISCOM Registered</div>
          <div className="text-2xl font-black text-purple-600 font-mono mt-1">{discomRegisteredCount}</div>
          <div className="text-[11px] text-secondary mt-0.5">Grid Registration Done</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-container-high shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-secondary">Direct Staff Files</div>
          <div className="text-2xl font-black text-blue-600 font-mono mt-1">{directFilesCount}</div>
          <div className="text-[11px] text-secondary mt-0.5">In-House Sales Team</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-container-high shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-secondary">Dealer Partner Files</div>
          <div className="text-2xl font-black text-purple-700 font-mono mt-1">{dealerFilesCount}</div>
          <div className="text-[11px] text-secondary mt-0.5">Channel Submissions</div>
        </div>
      </div>

      {/* Verification Filter Controls */}
      <div className="space-y-3 bg-surface p-4 rounded-xl border border-surface-container-high shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Stage Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { key: 'all', label: 'All Files' },
              { key: 'Sourced', label: '1. Sourced' },
              { key: 'Verification', label: '2. Under Review' },
              { key: 'DISCOM Registered', label: '3. DISCOM Reg.' },
              { key: 'Subsidized', label: '4. Subsidized' }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setStageFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  stageFilter === t.key
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
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

        {/* Source, Finance, and Staff Multi-Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container-high/60 text-xs">
          {/* Source Filter */}
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5 bg-surface-container-low">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                sourceFilter === 'all' ? 'bg-white shadow-2xs text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('DIRECT_STAFF')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                sourceFilter === 'DIRECT_STAFF' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              Direct Staff ({directFilesCount})
            </button>
            <button
              onClick={() => setSourceFilter('DEALER')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                sourceFilter === 'DEALER' ? 'bg-purple-600 text-white shadow-2xs' : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              Dealer Files ({dealerFilesCount})
            </button>
          </div>

          {/* Finance Filter */}
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5 bg-surface-container-low">
            <button
              onClick={() => setFinanceFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                financeFilter === 'all' ? 'bg-white shadow-2xs text-on-surface' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setFinanceFilter('CASH')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                financeFilter === 'CASH' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Cash Cases
            </button>
            <button
              onClick={() => setFinanceFilter('LOAN')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                financeFilter === 'LOAN' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              Solar Loan Cases
            </button>
          </div>

          {/* Sales Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs text-on-surface outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Sales Executives</option>
            {(staffList || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.zone?.split(' ')[0]})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Verification Queue Cards */}
      <div className="space-y-4">
        {filteredFiles.map((file) => {
          const isDealer = file.sourceType === 'DEALER' || file.source === 'DEALER';
          const isLoan = file.financeType === 'LOAN' || file.paymentMode === 'LOAN';
          const docs = file.documents || {};

          return (
            <div
              key={file.id}
              className="bg-surface rounded-xl p-5 border border-surface-container-high shadow-xs hover:shadow-md transition-all space-y-4"
            >
              {/* Row 1: File Header & Badges */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs font-bold text-secondary uppercase">{file.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isDealer
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {isDealer ? `Dealer: ${file.dealerName || file.dealerId || 'Channel'}` : 'Direct Staff'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      isLoan
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {isLoan ? `Solar Loan (${file.loanBank ? file.loanBank.split(' ')[0] : 'Bank'})` : 'Cash Case'}
                    </span>
                    <span className="text-[11px] font-mono text-secondary">
                      Assigned: <strong className="text-on-surface">{file.staffName}</strong>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">{file.customerName}</h3>
                  <div className="flex items-center gap-3 text-xs text-secondary mt-0.5 flex-wrap">
                    <span>{file.phone}</span>
                    <span>&bull;</span>
                    <span>{file.discom} &bull; Consumer #{file.consumerNo || 'Pending'}</span>
                    <span>&bull;</span>
                    <span className="font-bold text-emerald-700">{file.solarSystemKw} kW Solar</span>
                  </div>
                </div>

                {/* Quick Stage Controls */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedFileForTimeline(file)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">timeline</span>
                    <span>Audit Trail</span>
                  </button>

                  {file.status === 'Sourced' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStage(file.id, 'DOCUMENT_VERIFICATION', 'Verification')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      <span>Accept for Verification</span>
                    </button>
                  )}

                  {file.status === 'Verification' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStage(file.id, 'DISCOM_APPLICATION', 'DISCOM Registered')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">domain</span>
                      <span>Mark DISCOM Registered</span>
                    </button>
                  )}

                  {file.status === 'DISCOM Registered' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStage(file.id, 'SUBSIDY_CLAIM', 'Subsidized')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      <span>Clear DBT Subsidy</span>
                    </button>
                  )}

                  <select
                    value={file.status}
                    onChange={(e) => updateFileStatus(file.id, e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface outline-none cursor-pointer"
                  >
                    <option value="Sourced">Sourced</option>
                    <option value="Verification">Verification</option>
                    <option value="DISCOM Registered">DISCOM Registered</option>
                    <option value="Subsidized">Subsidized</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Document Scrutiny Checklist */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-primary">fact_check</span>
                    <span>Document Scrutiny (Review incoming client uploads)</span>
                  </span>
                  <span className="text-[11px] text-secondary">
                    Documents are <strong>non-blocking</strong> &bull; Review as received
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'aadhaar', label: 'Aadhaar Card' },
                    { key: 'lightBill', label: 'Electricity Bill' },
                    { key: 'meterPhoto', label: 'Meter Photo' },
                    { key: 'sitePhoto', label: 'Site / Roof Photo' },
                    { key: 'bankPassbook', label: 'Bank Passbook' }
                  ].map((doc) => {
                    const docInfo = docs[doc.key];
                    const isUploaded = Boolean(docInfo?.uploaded);
                    const isVerified = Boolean(docInfo?.verified);

                    return (
                      <div
                        key={doc.key}
                        className={`p-2.5 rounded-lg border flex flex-col justify-between text-xs ${
                          isVerified
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : isUploaded
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-surface-container-low border-surface-container-high'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-on-surface truncate">{doc.label}</span>
                            {isVerified && (
                              <span className="material-symbols-outlined text-emerald-600 text-[15px]" title="Office Verified">
                                verified
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-secondary mt-0.5 truncate">
                            {isUploaded ? docInfo?.filename || 'Document attached' : 'Not attached (Opt)'}
                          </p>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-surface-container-high/40 flex items-center justify-between">
                          {isUploaded ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({ title: doc.label, filename: docInfo.filename || 'document.pdf' })}
                                className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                              >
                                View
                              </button>
                              {!isVerified && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyDocument(file.id, doc.key)}
                                  className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer"
                                >
                                  Verify
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-secondary/60">Optional</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFiles.length === 0 && (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-container-high text-secondary">
          <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">folder_off</span>
          <p className="text-sm font-semibold">No customer files matched your scrutiny filters.</p>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full space-y-4 text-on-surface">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <h4 className="font-bold text-sm text-on-surface">{previewDoc.title}</h4>
              <button onClick={() => setPreviewDoc(null)} className="text-secondary hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 bg-surface-container-low rounded-xl text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-emerald-600">verified</span>
              <p className="text-xs font-bold text-on-surface">{previewDoc.filename}</p>
              <p className="text-[11px] text-secondary">Secured &amp; Verified in Sunvine Document Vault</p>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* TIMELINE AUDIT TRAIL MODAL */}
      {selectedFileForTimeline && (
        <CustomerFileDetailModal
          file={selectedFileForTimeline}
          onClose={() => setSelectedFileForTimeline(null)}
        />
      )}
    </div>
  );
}
