import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from './Toast';
import DocumentPreviewModal from './DocumentPreviewModal';
import {
  getDocumentListForFile,
  getDocumentCompletion,
  getDocumentSchemaKey,
  DOCUMENT_SCHEMAS
} from '../../data/defaultRequiredDocuments';
import { normalizeDocList } from '../../utils/documentUtils';

export default function CustomerFileDetailModal({ file, onClose }) {
  const {
    systemSettings,
    addCustomerFileTimelineEvent,
    updateCustomerFile,
    role,
    currentStaff,
    applicationStages,
    masterDocRegistry,
    categoryDocRules,
    getFileDocuments
  } = useApp();
  const { addToast } = useToast();

  const [newStage, setNewStage] = useState(file?.currentStage || 'DISCOM_APPLICATION');
  const [newStatus, setNewStatus] = useState(file?.status || 'In Progress');
  const [timelineNotes, setTimelineNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'financials', 'documents'
  const [previewDoc, setPreviewDoc] = useState(null);

  if (!file) return null;

  const stages = (applicationStages && applicationStages.length > 0)
    ? applicationStages
    : (systemSettings?.fileLifecycle?.stagesDetailed && systemSettings.fileLifecycle.stagesDetailed.length > 0)
      ? systemSettings.fileLifecycle.stagesDetailed
      : [
          { id: 'LEAD_SOURCED', label: 'Lead Sourced' },
          { id: 'SITE_SURVEY', label: 'Site Feasibility & Survey' },
          { id: 'QUOTATION_ACCEPTED', label: 'Quotation Accepted' },
          { id: 'DISCOM_APPLICATION', label: 'DISCOM Net-Meter Application' },
          { id: 'FEASIBILITY_APPROVAL', label: 'Technical Feasibility Approved' },
          { id: 'PLANT_INSTALLATION', label: 'Solar Hardware Installation' },
          { id: 'CEI_INSPECTION', label: 'Safety & CEI Inspection' },
          { id: 'NET_METER_SYNC', label: 'Net-Meter Grid Energization' },
          { id: 'SUBSIDY_CLAIM', label: 'PM Surya Ghar DBT Claim' },
          { id: 'HANDOVER_COMPLETED', label: 'Commissioned & Handed Over' }
        ];

  const statuses = systemSettings?.fileLifecycle?.statuses || [
    'In Progress',
    'Pending Documents',
    'DISCOM Processing',
    'Inspection Scheduled',
    'Grid Synchronized',
    'Subsidized',
    'Completed',
    'Stuck',
    'Cancelled'
  ];

  const handleAddMilestone = (e) => {
    e.preventDefault();
    if (!timelineNotes.trim() && !newStage) {
      addToast('Please enter notes or update stage', 'error');
      return;
    }

    setIsSubmitting(true);
    const actorName = role === 'admin' ? 'Super Admin Desk' : currentStaff?.name || 'Staff Executive';
    const isCompleted = newStatus === 'Completed' || newStatus === 'Subsidized' || newStage === 'HANDOVER_COMPLETED';

    addCustomerFileTimelineEvent(file.id, {
      stage: newStage,
      status: newStatus,
      title: `Stage: ${stages.find(s => s.id === newStage)?.label || newStage}`,
      action: 'STAGE_PROGRESSION',
      actor: actorName,
      notes: timelineNotes.trim() || `File advanced to stage ${newStage}`,
      isCompleted
    });

    setTimelineNotes('');
    setIsSubmitting(false);
    addToast('Timeline milestone recorded successfully', 'success');
  };

  const timeline = file.timeline || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="relative bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-on-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high bg-surface-container-low/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">folder_shared</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-bold text-lg sm:text-xl truncate">
                  {file.customerName || 'Customer File'}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-container-high text-secondary">
                  {file.id}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  file.status === 'Completed' || file.status === 'Subsidized'
                    ? 'bg-emerald-100 text-emerald-800'
                    : file.status === 'Stuck' || file.status === 'Cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {file.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5 truncate">
                {file.city || 'Gujarat'} &bull; {file.discomCircle || 'UGVCL'} &bull; Consumer #{file.consumerNumber || 'N/A'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Cancellation Notice Banner (If Cancelled) */}
        {(file.status === 'Cancelled' || file.stage === 'CANCELLED') && (
          <div className="mx-4 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">cancel</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between font-bold">
                <span className="text-rose-950 text-sm">Customer File Cancelled</span>
                {file.cancelledAt && (
                  <span className="text-[11px] text-rose-600 font-normal">
                    {new Date(file.cancelledAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-1 text-rose-800 break-words">
                <span className="font-semibold">Reason &amp; Remarks:</span> {file.cancellationReason || file.cancellation_reason || (file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED' || t.title?.includes('Cancelled'))?.notes) || 'No reason specified'}
              </div>
              {(file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor) && (
                <div className="mt-0.5 text-[11px] text-rose-600">
                  Action taken by: <span className="font-medium">
                    {typeof (file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor) === 'object'
                      ? (file.cancelledBy?.name || file.cancelledBy?.id || 'Authorized User')
                      : (file.cancelledBy || file.timeline?.slice().reverse().find(t => t.stage === 'CANCELLED')?.actor)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-4 bg-surface-container-low/20 border-b border-surface-container-high text-xs">
          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high">
            <span className="text-secondary block text-[11px]">System Capacity</span>
            <span className="font-mono font-bold text-sm text-primary">
              {file.solarSystemKw || file.capacityKw || 4.4} kW
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high">
            <span className="text-secondary block text-[11px]">Attribution Source</span>
            <span className="font-semibold text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-secondary">
                {file.sourceType === 'DEALER' ? 'storefront' : 'badge'}
              </span>
              {file.sourceType === 'DEALER' ? 'Dealer Partner' : 'Direct Staff'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high">
            <span className="text-secondary block text-[11px]">Finance Mode</span>
            <span className="font-mono font-bold text-on-surface">
              {file.financeType === 'LOAN' ? `LOAN (${file.loanBank || 'SBI'})` : 'CASH'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high">
            <span className="text-secondary block text-[11px]">Contract Value</span>
            <span className="font-mono font-bold text-on-surface">
              ₹ {Number(file.amount || 240000).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 px-4 border-b border-surface-container-high bg-surface-container-low/10">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            Lifecycle Timeline ({timeline.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'attribution'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            Attribution &amp; Finance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'documents'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            Documents Verification
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Add Milestone Form */}
              <form onSubmit={handleAddMilestone} className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container-high space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs uppercase tracking-wider text-secondary">
                    Record New Lifecycle Progress
                  </span>
                  <span className="text-[11px] text-secondary">Actor: {role === 'admin' ? 'Super Admin' : currentStaff?.name || 'Staff'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">Advance Stage</label>
                    <select
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {stages.map((stg) => (
                        <option key={stg.id} value={stg.id}>
                          {stg.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-secondary mb-1">Update Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {statuses.map((stat) => (
                        <option key={stat} value={stat}>
                          {stat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Timeline Notes &bull; Milestone Remarks</label>
                  <input
                    type="text"
                    value={timelineNotes}
                    onChange={(e) => setTimelineNotes(e.target.value)}
                    placeholder="e.g. Net meter physical inspection passed by UGVCL engineer; test report generated."
                    className="w-full text-xs p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    <span>Commit Milestone</span>
                  </button>
                </div>
              </form>

              {/* Chronological Timeline List */}
              <div className="space-y-4">
                <h4 className="font-heading font-bold text-sm text-on-surface">
                  Chronological File History
                </h4>

                {timeline.length === 0 ? (
                  <div className="p-8 text-center bg-surface-container-low/30 rounded-xl border border-dashed border-surface-container-high">
                    <p className="text-secondary text-xs">No timeline events recorded yet. Use the form above to add initial progress.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 border-l-2 border-primary/30">
                    {[...timeline].reverse().map((item, idx) => (
                      <div key={item.id || idx} className="relative group">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface-container-lowest ring-2 ring-primary/20" />

                        <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 transition-colors shadow-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <span className="font-bold text-on-surface font-heading">
                              {item.title || item.stage}
                            </span>
                            <span className="font-mono text-[11px] text-secondary">
                              {item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : item.date}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-secondary mt-1.5 leading-relaxed">
                              {item.notes}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-surface-container-high/50 text-[11px] text-secondary">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">person</span>
                              {typeof item.actor === 'object' ? item.actor?.name || item.actor?.id || 'System' : item.actor || 'System'}
                            </span>
                            {item.status && (
                              <span className="px-1.5 py-0.5 rounded bg-surface-container-low font-semibold">
                                {item.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attribution' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Staff Attribution Card */}
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    Assigned Sales Staff Member
                  </div>
                  <p className="font-heading font-bold text-base text-on-surface">
                    {file.staffName || 'Unassigned Staff'}
                  </p>
                  <p className="text-xs text-secondary font-mono">
                    Staff ID: {file.staffId || (file.sourceType === 'DEALER' ? 'STF-DIRECT' : 'STF-801')}
                  </p>
                  <p className="text-xs text-secondary">
                    Role: Field Solar Executive &bull; Regional Operations
                  </p>
                </div>

                {/* Dealer Attribution Card */}
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-[18px]">storefront</span>
                    Originating Dealer Partner
                  </div>
                  <p className="font-heading font-bold text-base text-on-surface">
                    {file.dealerName || (file.sourceType === 'DIRECT_STAFF' ? 'Direct Staff Sourced (No Dealer)' : 'Unassigned')}
                  </p>
                  <p className="text-xs text-secondary font-mono">
                    Dealer ID: {file.dealerId || (file.sourceType === 'DIRECT_STAFF' ? 'N/A' : 'DLR-GUJ-001')}
                  </p>
                  <p className="text-xs text-secondary">
                    Attribution Lock: Preserved historically in file ledger
                  </p>
                </div>
              </div>

              {/* Finance Profile Deep Dive */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-3">
                <h4 className="font-heading font-bold text-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                  Customer Payment &amp; Financing Arrangement
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-container-low/40">
                    <span className="text-secondary block">Payment Mode</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5 block">
                      {file.financeType || 'CASH'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container-low/40">
                    <span className="text-secondary block">Partner Bank</span>
                    <span className="font-bold text-sm text-on-surface mt-0.5 block">
                      {file.financeType === 'LOAN' ? file.loanBank || 'State Bank of India' : 'Direct Cash / Cheque'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container-low/40">
                    <span className="text-secondary block">Estimated Subsidy DBT</span>
                    <span className="font-bold text-sm text-emerald-600 mt-0.5 block">
                      ₹ 78,000 (Central MNRE DBT)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-secondary">
                  Document uploads are strictly non-blocking. PDF files are securely stored in Cloudflare R2 Vault.
                </p>
                {Object.values(file.documents || {}).some(d => d?.uploaded && d?.url) && (
                  <button
                    type="button"
                    onClick={() => {
                      const docs = file.documents || {};
                      const attached = Object.entries(docs).filter(([_, d]) => d?.uploaded && d?.url);
                      attached.forEach(([key, doc]) => {
                        const link = document.createElement('a');
                        link.href = doc.url;
                        link.target = '_blank';
                        link.download = `${file.id}_${key}_${doc.filename || 'document.pdf'}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      });
                      addToast(`Downloading ${attached.length} government-ready PDF(s)...`, 'success');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Download Government PDF Pack</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(getFileDocuments ? getFileDocuments(file) : getDocumentListForFile(file, masterDocRegistry, categoryDocRules)).map((doc) => {
                  const docInfo = file.documents?.[doc.key] || (doc.alias ? file.documents?.[doc.alias] : null);
                  const filesList = normalizeDocList(docInfo);
                  const isUploaded = filesList.length > 0;

                  return (
                    <div
                      key={doc.key}
                      className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
                            {doc.icon || 'description'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-on-surface truncate">{doc.label}</p>
                            <p className="text-[11px] text-secondary">
                              {isUploaded ? (
                                <span className="font-mono text-primary font-medium">
                                  {filesList.length > 1 ? `${filesList.length} Files Attached` : '1 Document Attached'}
                                </span>
                              ) : (
                                `${doc.category} \u2022 Optional (Max 2 MB)`
                              )}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] shrink-0 ${
                          isUploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container-low text-secondary'
                        }`}>
                          {isUploaded ? 'VERIFIED' : 'OPTIONAL'}
                        </span>
                      </div>

                      {isUploaded && (
                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-surface-container-high/60">
                          {filesList.map((f, fIdx) => (
                            <div key={f.id || fIdx} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-[11px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-xs text-secondary shrink-0">
                                  {f.filename?.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                                </span>
                                <span className="font-mono text-on-surface truncate" title={f.filename}>
                                  {f.filename || `File ${fIdx + 1}`}
                                </span>
                                {f.size && <span className="text-[10px] text-secondary shrink-0 font-mono">({f.size})</span>}
                              </div>
                              {f.url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({
                                    title: `${doc.label} (${f.filename || fIdx + 1})`,
                                    filename: f.filename || 'document.pdf',
                                    url: f.url,
                                    files: filesList,
                                    initialIndex: fIdx
                                  })}
                                  className="p-1 bg-primary-container/20 hover:bg-primary-container/30 text-primary rounded transition-colors flex items-center shrink-0 cursor-pointer"
                                  title="Inspect & Download"
                                >
                                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-surface-container-high bg-surface-container-low/40 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold cursor-pointer min-h-[44px] transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>

      {/* RICH DOCUMENT PREVIEW & INSPECTION MODAL */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
