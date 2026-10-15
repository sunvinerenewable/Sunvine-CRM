import React, { useState } from 'react';
import { useToast } from './Toast';

const CANCELLATION_REASONS = [
  'Customer Backed Out / Not Interested',
  'Duplicate Entry',
  'Wrong Information / Typo in Registration',
  'Loan / Bank Financing Rejected',
  'Load Feasibility / DISCOM Rejection',
  'System Capacity Changed (Re-creating file)',
  'Other (Specify in remarks)'
];

export default function CancelCustomerFileModal({
  file,
  isOpen,
  isAdmin = false,
  initialDeleteMode = null,
  onClose,
  onCancelFile,
  onSoftDelete,
  onHardDelete
}) {
  const { addToast } = useToast();

  const isVerified = Boolean(
    file?.isVerified ||
    file?.is_verified ||
    file?.status === 'Verified' ||
    file?.status === 'DISCOM Registered' ||
    (file?.stage && file.stage !== 'LEAD_SOURCED' && file.stage !== 'SITE_SURVEY')
  );

  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0]);
  const [customRemarks, setCustomRemarks] = useState('');
  const [deleteMode, setDeleteMode] = useState(() => {
    if (isVerified) return 'soft_cancel';
    if (initialDeleteMode) return initialDeleteMode;
    if (file?.status === 'Cancelled') return isAdmin ? 'hard_delete' : 'soft_cancel';
    return 'soft_delete';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !file) return null;

  const handleConfirm = async (e) => {
    e.preventDefault();

    if (isVerified && (deleteMode === 'soft_delete' || deleteMode === 'hard_delete')) {
      addToast('Verified applications cannot be deleted. You can only cancel with a reason.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (deleteMode === 'hard_delete') {
        if (!isAdmin) {
          throw new Error('Only administrators can permanently delete customer files');
        }
        if (onHardDelete) {
          await onHardDelete(file.id);
        }
        addToast(`Customer file ${file.id} permanently deleted`, 'info');
      } else if (deleteMode === 'soft_delete') {
        if (onSoftDelete) {
          await onSoftDelete(file.id);
        }
        addToast(`Customer file ${file.id} moved to Trash (14-day retention)`, 'info');
      } else {
        // Cancellation
        const remarksClean = customRemarks.trim();
        let finalReason = selectedReason;
        if (selectedReason === 'Other (Specify in remarks)') {
          finalReason = remarksClean;
        } else if (remarksClean) {
          finalReason = `${selectedReason} — Remarks: ${remarksClean}`;
        }

        if (!finalReason || finalReason.length < 5) {
          addToast('Please provide a specific cancellation reason (minimum 5 characters)', 'error');
          setIsSubmitting(false);
          return;
        }

        if (onCancelFile) {
          await onCancelFile(file.id, finalReason);
        }
        addToast(`Customer file ${file.id} moved to Cancelled archive`, 'success');
      }
      onClose();
    } catch (err) {
      addToast(err?.message || 'Failed to process request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHeaderTitle = () => {
    if (isVerified) return 'Cancel Customer Application (Verified File)';
    if (deleteMode === 'hard_delete') return 'Permanently Delete File';
    if (deleteMode === 'soft_delete') return 'Move Application to Trash';
    return 'Cancel Customer Application';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${
          isVerified
            ? 'border-amber-100 bg-amber-50/60'
            : deleteMode === 'hard_delete'
            ? 'border-red-100 bg-red-50/60'
            : deleteMode === 'soft_delete'
            ? 'border-slate-100 bg-slate-50'
            : 'border-amber-100 bg-amber-50/50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isVerified
                ? 'bg-amber-100 border-amber-200 text-amber-700'
                : deleteMode === 'hard_delete'
                ? 'bg-red-100 border-red-200 text-red-600'
                : deleteMode === 'soft_delete'
                ? 'bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-amber-100 border-amber-200 text-amber-600'
            }`}>
              <span className="material-symbols-outlined text-xl">
                {isVerified ? 'verified_user' : deleteMode === 'hard_delete' ? 'delete_forever' : deleteMode === 'soft_delete' ? 'delete' : 'cancel'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{getHeaderTitle()}</h3>
              <p className="text-[11px] text-slate-500 font-mono font-semibold">{file.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4 text-xs">
          {/* Target File Overview Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-slate-900 text-sm">{file.customerName}</h4>
                {isVerified && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    Verified
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">{file.solarSystemKw || file.capacityKw || 4.4} kW Solar &bull; {file.discom || file.discomCircle || 'UGVCL'}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
              {file.status || 'Active'}
            </span>
          </div>

          {/* If Verified Warning Banner */}
          {isVerified ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">lock</span>
              <div className="leading-relaxed">
                <strong className="block font-bold mb-0.5 text-amber-950">Verified Application (Locked from Deletion)</strong>
                This application has been verified by the desk or registered with DISCOM. Per solar regulatory compliance, verified applications cannot be deleted. If this project cannot proceed, you must record a cancellation reason below.
              </div>
            </div>
          ) : (
            /* Mode Selector for Non-Verified Files */
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-slate-700 font-bold">Select Action</label>
              <div className={`grid gap-2 ${isAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setDeleteMode('soft_delete')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'soft_delete'
                      ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 text-slate-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span className="material-symbols-outlined text-base text-slate-700">delete</span>
                    <span>Move to Trash</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal leading-tight">
                    14-day retention. Admin can restore. Auto-purged after 14 days.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteMode('soft_cancel')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'soft_cancel'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span className="material-symbols-outlined text-base text-amber-600">cancel</span>
                    <span>Cancel File</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal leading-tight">
                    Retains project in Cancelled tab with audit remarks.
                  </p>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeleteMode('hard_delete')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      deleteMode === 'hard_delete'
                        ? 'bg-red-50 border-red-300 ring-2 ring-red-400/20 text-red-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-0.5">
                      <span className="material-symbols-outlined text-base text-red-600">delete_forever</span>
                      <span>Permanent Delete</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal leading-tight">
                      Admin only. Wipes row &amp; R2 documents immediately.
                    </p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cancellation Reason Inputs (Shown for Cancel) */}
          {(isVerified || deleteMode === 'soft_cancel') && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Cancellation Reason *</label>
                <select
                  value={selectedReason}
                  onChange={e => setSelectedReason(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Additional Notes / Remarks {selectedReason.includes('Other') ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={customRemarks}
                  onChange={e => setCustomRemarks(e.target.value)}
                  placeholder="Provide context or explanation for cancelling this file..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-amber-500 resize-none"
                  required={selectedReason.includes('Other')}
                />
              </div>
            </div>
          )}

          {/* Soft Delete Notice (Shown for Soft Delete) */}
          {!isVerified && deleteMode === 'soft_delete' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-slate-600 text-[18px] shrink-0 mt-0.5">timer</span>
              <div className="leading-relaxed">
                <strong className="block font-bold mb-0.5 text-slate-900">14-Day Trash Retention Policy</strong>
                This application will be moved to the Trash bin and hidden from your active list. If deleted by mistake, an Administrator can restore it within <strong>14 days</strong>. After 14 days, the application and all uploaded files will be permanently deleted from the database and storage.
              </div>
            </div>
          )}

          {/* Hard Delete Notice (Shown for Hard Delete) */}
          {!isVerified && deleteMode === 'hard_delete' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">delete_forever</span>
              <div className="leading-relaxed">
                <strong className="block font-bold mb-0.5 text-red-950">⚠️ Irreversible Permanent Wipe</strong>
                This will immediately and permanently delete customer <strong>{file.customerName}</strong> ({file.id}), all timeline milestones, and all associated documents from Cloudflare R2 storage.
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`h-10 px-5 text-white font-semibold rounded-lg text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all duration-150 disabled:opacity-50 ${
                isVerified || deleteMode === 'soft_cancel'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : deleteMode === 'hard_delete'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">
                    {isVerified || deleteMode === 'soft_cancel' ? 'cancel' : deleteMode === 'hard_delete' ? 'delete_forever' : 'delete'}
                  </span>
                  <span>
                    {isVerified || deleteMode === 'soft_cancel'
                      ? 'Confirm Cancellation'
                      : deleteMode === 'hard_delete'
                      ? 'Delete Permanently'
                      : 'Move to Trash'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
