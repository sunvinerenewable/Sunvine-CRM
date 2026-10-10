import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { GROUPED_SOLAR_BANKS } from '../../data/solarBanksData';
import SolarBankSelectorModal from '../Shared/SolarBankSelectorModal';

export default function StaffNewLead() {
  const { currentStaff, addCustomerFile, setActiveTab, dealers, pricingPresets, showLoader, hideLoader } = useApp();
  const { addToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(currentStaff?.city || 'Ahmedabad');
  const [discom, setDiscom] = useState('UGVCL');
  const [consumerNo, setConsumerNo] = useState('');
  const [category, setCategory] = useState('residential');
  const [solarSystemKw, setSolarSystemKw] = useState('4.4');
  const [roofType, setRoofType] = useState('RCC Flat Roof');
  const [notes, setNotes] = useState('');

  // Attribution: Direct Sales vs Dealer Partner
  const [sourceType, setSourceType] = useState('DIRECT_STAFF'); // 'DIRECT_STAFF' or 'DEALER'
  const [selectedDealerId, setSelectedDealerId] = useState('');

  // Payment / Financing Mode: Cash vs Solar Bank Loan
  const [financeType, setFinanceType] = useState('CASH'); // 'CASH' or 'LOAN'
  const [loanBank, setLoanBank] = useState('State Bank of India (PM Surya Ghar Scheme)');
  const [loanRefNo, setLoanRefNo] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);

  // Sourced Dealers associated with this staff
  const staffDealers = useMemo(() => {
    return (dealers || []).filter(
      d => d && (d.assignedStaffId === currentStaff?.id || d.assignedStaffName === currentStaff?.name)
    );
  }, [dealers, currentStaff]);

  const selectedDealer = useMemo(() => {
    return (dealers || []).find(d => d.id === selectedDealerId);
  }, [dealers, selectedDealerId]);

  const calculatedAmount = useMemo(() => {
    const kw = parseFloat(solarSystemKw) || 0;
    const baseRate = pricingPresets?.baseRatePerKw || 0;
    return Math.round(kw * baseRate);
  }, [solarSystemKw, pricingPresets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim()) {
      addToast('Customer Name and Mobile Number are required', 'error');
      return;
    }

    if (sourceType === 'DEALER' && !selectedDealerId) {
      addToast('Please select the originating Dealer Partner', 'warning');
      return;
    }

    const year = new Date().getFullYear();
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newFileId = `FIL-${year}-${randPart}`;
    const newFile = {
      id: newFileId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim() || `${city}, Gujarat`,
      city: city,
      discom: discom,
      consumerNo: consumerNo.trim() || `${discom}-${Math.floor(100000 + Math.random() * 900000)}`,
      sanctionedLoadKw: parseFloat(solarSystemKw) || 5.0,
      solarSystemKw: parseFloat(solarSystemKw) || 3.3,
      category: category || 'residential',
      roofType: roofType,
      amount: calculatedAmount,
      // Source & Attribution
      sourceType: sourceType,
      dealerId: sourceType === 'DEALER' ? selectedDealerId : null,
      dealerName: sourceType === 'DEALER' ? (selectedDealer?.firmName || 'Authorized Partner') : null,
      staffId: currentStaff?.id || 'STF-801',
      staffName: currentStaff?.name || 'Sunvine Sales Staff',
      // Payment & Financing
      financeType: financeType,
      loanBank: financeType === 'LOAN' ? loanBank : null,
      loanAccountNumber: financeType === 'LOAN' ? (loanRefNo.trim() || `LN-${Math.floor(100000 + Math.random() * 900000)}`) : null,
      // Lifecycle Status
      status: 'Sourced',
      currentStage: 'Documentation',
      isCompleted: false,
      isFailed: false,
      createdDate: new Date().toISOString().split('T')[0],
      applicationNo: 'Draft Pending',
      notes: notes.trim() || 'Lead sourced from field visit.',
      timeline: [
        {
          stage: 'Lead Sourced',
          date: new Date().toISOString().split('T')[0],
          actor: currentStaff?.name || 'Sales Representative',
          notes: `Customer onboarded under ${financeType === 'LOAN' ? `Solar Bank Loan (${loanBank})` : 'Direct Cash/Cheque'} via ${sourceType === 'DEALER' ? selectedDealer?.firmName : 'Direct Sales'}.`
        }
      ],
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };

    try {
      showLoader('Creating customer lead...');
      let savedFile = newFile;
      if (addCustomerFile) {
        const res = await addCustomerFile(newFile);
        if (res) savedFile = res;
      }
      addToast(`Customer Lead "${savedFile.customerName}" created with ${financeType} payment mode!`, 'success');
      setActiveTab('staff_files');
    } catch (err) {
      console.error('[StaffNewLead] Create lead error:', err);
      addToast(err.message || 'Failed to create customer lead', 'error');
    } finally {
      hideLoader();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">person_add</span>
            <span>New Customer Solar Lead</span>
          </h1>
          <p className="text-xs text-secondary mt-1">
            Specify customer details, origin source, and Cash vs Bank Loan payment structure. <strong className="text-primary">Document uploads are NOT mandatory</strong> to create a file!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('staff_dashboard')}
          className="text-xs font-semibold text-secondary hover:text-on-surface flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back</span>
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Customer Contact & Location */}
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2 pb-1.5 border-b border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[18px]">contact_mail</span>
              <span>Customer Identification &amp; Contact</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Bhupendrabhai M. Shah"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Mobile Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98250 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Installation City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Full Installation Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot/Bungalow No, Society, Landmark"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Attribution Source (Direct vs Dealer) */}
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2 pb-1.5 border-b border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[18px]">hub</span>
              <span>Lead Source &amp; Attribution</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Origin Source Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceType('DIRECT_STAFF')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceType === 'DIRECT_STAFF'
                        ? 'bg-primary-container/15 text-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container-high text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">corporate_fare</span>
                    <span>Direct Company</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceType('DEALER')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceType === 'DEALER'
                        ? 'bg-primary-container/15 text-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container-high text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">storefront</span>
                    <span>Dealer Partner</span>
                  </button>
                </div>
              </div>

              {sourceType === 'DEALER' && (
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Select Originating Dealer Partner *
                  </label>
                  <select
                    required
                    value={selectedDealerId}
                    onChange={(e) => setSelectedDealerId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Authorized Dealer --</option>
                    {(staffDealers.length > 0 ? staffDealers : (dealers || []).slice(0, 50)).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.firmName} ({d.city} &bull; {d.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Payment & Financing Structure (Cash vs Loan) */}
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2 pb-1.5 border-b border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[18px]">account_balance</span>
              <span>Payment &amp; Financing Structure (Cash vs Loan)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Payment Mode *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFinanceType('CASH')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      financeType === 'CASH'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container-high text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">payments</span>
                    <span>Direct Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFinanceType('LOAN')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      financeType === 'LOAN'
                        ? 'bg-blue-50 text-blue-800 border-blue-500 font-bold shadow-xs'
                        : 'bg-surface-container-low border-surface-container-high text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">account_balance</span>
                    <span>Solar Loan</span>
                  </button>
                </div>
              </div>

              {financeType === 'LOAN' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-on-surface">Partner Financing Bank / NBFC *</label>
                      <button
                        type="button"
                        onClick={() => setShowBankModal(true)}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">manage_search</span>
                        <span>Browse 40+ Banks &amp; Rates</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={loanBank}
                        onChange={(e) => setLoanBank(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
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
                        className="px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
                        title="Browse All 40+ Banks, Rates & Tenures"
                      >
                        <span className="material-symbols-outlined text-[18px]">search</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Loan Sanction / Ref No <span className="text-secondary font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={loanRefNo}
                      onChange={(e) => setLoanRefNo(e.target.value)}
                      placeholder="e.g. SBI-SOL-2026-9921"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section 4: Utility DISCOM & Solar System Specs */}
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2 pb-1.5 border-b border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-[18px]">solar_power</span>
              <span>DISCOM Connection &amp; Capacity</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">DISCOM Grid Circle *</label>
                <select
                  value={discom}
                  onChange={(e) => setDiscom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
                >
                  <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                  <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                  <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                  <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                  <option value="Torrent Power">Torrent Power</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">
                  Consumer No <span className="text-secondary font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={consumerNo}
                  onChange={(e) => setConsumerNo(e.target.value)}
                  placeholder="e.g. 03901/44321/9"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Proposed Solar (kW) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={solarSystemKw}
                  onChange={(e) => setSolarSystemKw(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Project Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
                >
                  <option value="residential">Residential Rooftop</option>
                  <option value="commercial">Commercial & Industrial (C&I)</option>
                  <option value="common_meter">Housing Society / Common Meter</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Rooftop & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Rooftop Structure Type</label>
              <select
                value={roofType}
                onChange={(e) => setRoofType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
              >
                <option value="RCC Flat Roof">RCC Flat Roof</option>
                <option value="Industrial Tin Shed">Industrial Tin Shed</option>
                <option value="Elevated Gazebo Roof">Elevated Gazebo Roof</option>
                <option value="Pitched / Tiled Roof">Pitched / Tiled Roof</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-on-surface mb-1">
                Field Survey Notes &amp; Observations
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Customer wants 550W bifacial panels. 600 sq.ft shadow free."
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Financial Summary Strip */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-secondary block">Estimated Project Turnover Value:</span>
              <span className="font-mono text-base font-bold text-on-surface">
                ₹ {calculatedAmount.toLocaleString('en-IN')} <span className="text-xs text-secondary font-normal font-sans">(@ ₹58k/kW)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                financeType === 'LOAN' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {financeType === 'LOAN' ? `Bank Loan: ${loanBank}` : 'Direct Cash / Cheque'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-container/20 text-on-primary-fixed-variant">
                {sourceType === 'DEALER' ? (selectedDealer?.firmName || 'Dealer File') : 'Sunvine Direct'}
              </span>
            </div>
          </div>

          {/* Non-blocking Notice */}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">check_circle</span>
            <span>
              <strong>Zero Document Lockout:</strong> Aadhaar, Light Bill &amp; Meter photos can be added later from your files tab anytime or verified by the back-office Verification Desk!
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-container-high">
            <button
              type="button"
              onClick={() => setActiveTab('staff_dashboard')}
              className="px-5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-bold text-secondary cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Create Customer File</span>
            </button>
          </div>
        </form>
      </div>

      {/* MODAL: BROWSE ALL 40+ OFFICIAL SOLAR LOAN BANKS & FINTECHS */}
      <SolarBankSelectorModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        selectedBankName={loanBank}
        onSelectBank={(selectedName) => setLoanBank(selectedName)}
      />
    </div>
  );
}
