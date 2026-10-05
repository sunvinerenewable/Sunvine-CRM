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
  onHardDelete
}) {
  const { addToast } = useToast();

  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0]);
  const [customRemarks, setCustomRemarks] = useState('');
  const [deleteMode, setDeleteMode] = useState(() => {
    if (initialDeleteMode) return initialDeleteMode;
    if (file?.status === 'Cancelled') return 'hard_delete';
    return 'soft_cancel';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !file) return null;

  const handleConfirm = async (e) => {
    e.preventDefault();

    const remarksClean = customRemarks.trim();
    let finalReason = selectedReason;
    if (selectedReason === 'Other (Specify in remarks)') {
      finalReason = remarksClean || 'Other reasons';
    } else if (remarksClean) {
      finalReason = `${selectedReason} — Remarks: ${remarksClean}`;
    }

    setIsSubmitting(true);
    try {
      if (isAdmin && deleteMode === 'hard_delete') {
        await onHardDelete(file.id);
        addToast(`Customer file ${file.id} permanently deleted`, 'info');
      } else {
        await onCancelFile(file.id, finalReason);
        addToast(`Customer file ${file.id} moved to Cancelled archive`, 'success');
      }
      onClose();
    } catch (err) {
      addToast(err?.message || 'Failed to cancel file', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-red-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {deleteMode === 'hard_delete' ? 'Delete Customer File' : 'Cancel Customer File'}
              </h3>
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
              <h4 className="font-bold text-slate-900 text-sm">{file.customerName}</h4>
              <p className="text-[11px] text-slate-500">{file.solarSystemKw} kW Solar &bull; {file.discom}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
              {file.status}
            </span>
          </div>

          {/* Admin Delete Mode Toggle */}
          {isAdmin && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-slate-700 font-bold">Action Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteMode('soft_cancel')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'soft_cancel'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span className="material-symbols-outlined text-base text-amber-600">cancel</span>
                    <span>Soft Cancel (Recommended)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Moves file to 'Cancelled' tab with reason. Can be restored anytime.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteMode('hard_delete')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'hard_delete'
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-400/20 text-red-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <span className="material-symbols-outlined text-base text-red-600">delete_forever</span>
                    <span>Permanent Delete</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Completely purges record from database. Irreversible action.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Cancellation Reason Dropdown (Shown for Soft Cancel) */}
          {deleteMode === 'soft_cancel' && (
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Cancellation Reason *</label>
                <select
                  value={selectedReason}
                  onChange={e => setSelectedReason(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Additional Notes / Remarks {selectedReason.includes('Other') && '*'}
                </label>
                <textarea
                  rows={2}
                  value={customRemarks}
                  onChange={e => setCustomRemarks(e.target.value)}
                  placeholder="Provide context or explanation for cancelling this file..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 resize-none"
                  required={selectedReason.includes('Other')}
                />
              </div>
            </div>
          )}

          {deleteMode === 'hard_delete' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
              <strong className="block font-bold mb-0.5">⚠️ Warning: Irreversible Action</strong>
              This will permanently delete customer <strong>{file.customerName}</strong> and all linked documents and timeline history from the live PostgreSQL database.
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
                deleteMode === 'hard_delete'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-600 hover:bg-amber-700'
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
                    {deleteMode === 'hard_delete' ? 'delete_forever' : 'cancel'}
                  </span>
                  <span>{deleteMode === 'hard_delete' ? 'Delete Permanently' : 'Confirm Cancellation'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
