import React, { useState } from 'react';
import { useToast } from './Toast';
import { GROUPED_SOLAR_BANKS } from '../../data/solarBanksData';

export default function EditCustomerFileModal({ file, isOpen, onClose, onSave }) {
  const { addToast } = useToast();

  const [customerName, setCustomerName] = useState(file?.customerName || '');
  const [phone, setPhone] = useState(file?.phone || '');
  const [address, setAddress] = useState(file?.address || '');
  const [city, setCity] = useState(file?.city || 'Ahmedabad');
  const [discom, setDiscom] = useState(file?.discom || file?.discomCircle || 'UGVCL');
  const [consumerNo, setConsumerNo] = useState(file?.consumerNo || file?.consumerNumber || '');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState(file?.sanctionedLoadKw || 5);
  const [solarSystemKw, setSolarSystemKw] = useState(file?.solarSystemKw || 4.4);
  const [roofType, setRoofType] = useState(file?.roofType || 'Flat RCC');
  const [financeType, setFinanceType] = useState(file?.financeType || file?.paymentMode || 'CASH');
  const [loanBank, setLoanBank] = useState(file?.loanBank || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !file) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerName.trim()) {
      addToast('Customer Name is required', 'error');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      addToast('Valid 10-digit phone number is required', 'error');
      return;
    }
    if (!solarSystemKw || Number(solarSystemKw) <= 0) {
      addToast('Valid Solar System capacity (kW) is required', 'error');
      return;
    }

    const updatedFields = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      discom,
      discomCircle: discom,
      consumerNo: consumerNo.trim(),
      consumerNumber: consumerNo.trim(),
      sanctionedLoadKw: Number(sanctionedLoadKw) || 0,
      solarSystemKw: Number(solarSystemKw) || 0,
      roofType,
      financeType,
      paymentMode: financeType,
      loanBank: financeType === 'LOAN' ? loanBank : null
    };

    setIsSubmitting(true);
    try {
      await onSave(file.id, updatedFields);
      addToast('Customer file details updated successfully', 'success');
      onClose();
    } catch (err) {
      addToast(err?.message || 'Failed to update customer file', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">edit_note</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Edit Customer File</h3>
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

        {/* Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Row 1: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Customer Full Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                required
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Ramesh Patel"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Mobile Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                placeholder="+91 9876543210"
              />
            </div>
          </div>

          {/* Row 2: Address & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">Installation Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                placeholder="Plot / Street / Society"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">City / District</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Rajkot"
              />
            </div>
          </div>

          {/* Row 3: DISCOM & Consumer Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">DISCOM Circle</label>
              <select
                value={discom}
                onChange={e => setDiscom(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                <option value="Torrent Power">Torrent Power (Ahmedabad / Surat)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Consumer / Account No.</label>
              <input
                type="text"
                value={consumerNo}
                onChange={e => setConsumerNo(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                placeholder="e.g. 102938475"
              />
            </div>
          </div>

          {/* Row 4: System kW, Load kW & Roof Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Solar System (kW) *</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="500"
                value={solarSystemKw}
                onChange={e => setSolarSystemKw(e.target.value)}
                required
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Sanctioned Load (kW)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={sanctionedLoadKw}
                onChange={e => setSanctionedLoadKw(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Roof Type</label>
              <select
                value={roofType}
                onChange={e => setRoofType(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Flat RCC">Flat RCC Roof</option>
                <option value="Metal / GI Sheet">Metal / GI Sheet</option>
                <option value="Elevated Super Structure">Elevated Super Structure</option>
                <option value="Sloped Mangalore Tile">Sloped Tile Roof</option>
              </select>
            </div>
          </div>

          {/* Row 5: Finance & Loan Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Payment / Finance Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFinanceType('CASH')}
                  className={`h-9 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    financeType === 'CASH'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">payments</span>
                  <span>Cash Case</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFinanceType('LOAN')}
                  className={`h-9 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    financeType === 'LOAN'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">account_balance</span>
                  <span>Bank Loan</span>
                </button>
              </div>
            </div>

            {financeType === 'LOAN' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Solar Bank</label>
                <select
                  value={loanBank}
                  onChange={e => setLoanBank(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Choose Partner Bank --</option>
                  {(GROUPED_SOLAR_BANKS || []).map(b => (
                    <option key={b.id || b.name} value={b.name}>{b.name} ({b.interestRate || 'Govt Rate'})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-semibold rounded-lg text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all duration-150 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
