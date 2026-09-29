import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function ConvertQuotationModal({ quotation, isOpen, onClose, onSuccess }) {
  const {
    currentDealer,
    currentStaff,
    role,
    addCustomerFile,
    updateQuotation,
    addNotification,
    logActivity
  } = useApp();

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

  // Documents state (strictly non-blocking/optional)
  const [documents, setDocuments] = useState({
    lightBill: null,
    aadhaar: null,
    pan: null,
    propertyTax: null,
    passportPhoto: null
  });

  const handleFileUpload = (docKey, file) => {
    if (!file) return;
    setDocuments(prev => ({
      ...prev,
      [docKey]: {
        filename: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploaded: true,
        date: new Date().toISOString().split('T')[0]
      }
    }));
  };

  const handleRemoveDoc = (docKey) => {
    setDocuments(prev => ({
      ...prev,
      [docKey]: null
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

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
        targetTab: 'dealer_files'
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
    onClose();
  };

  const docItems = [
    { key: 'lightBill', label: 'Electricity / Light Bill', desc: 'Latest bill copy (within 2 months)', icon: 'electric_bolt' },
    { key: 'aadhaar', label: 'Aadhaar Card (KYC)', desc: 'Front & Back UIDAI copy', icon: 'badge' },
    { key: 'pan', label: 'Customer PAN Card', desc: 'Required for DBT & DISCOM', icon: 'credit_card' },
    { key: 'propertyTax', label: 'Property Tax / Index-2', desc: 'Proof of premises ownership', icon: 'home' },
    { key: 'passportPhoto', label: 'Passport Size Photo', desc: 'Customer applicant photograph', icon: 'person' },
  ];

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

          {/* Section B: Non-Blocking Document Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-label-sm text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">folder_open</span>
                B. Document Attachments
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-semibold">
                Strictly Optional (Can be uploaded later)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {docItems.map((doc) => {
                const uploaded = documents[doc.key];
                return (
                  <div
                    key={doc.key}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                      uploaded
                        ? 'bg-primary-container/10 border-primary/40'
                        : 'bg-surface-container-low border-surface-container-high/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">{doc.icon}</span>
                        <div>
                          <span className="font-bold text-on-surface block text-[11px]">{doc.label}</span>
                          <span className="text-[10px] text-secondary block">{doc.desc}</span>
                        </div>
                      </div>
                      {uploaded ? (
                        <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                      ) : (
                        <span className="text-[10px] text-secondary shrink-0">Optional</span>
                      )}
                    </div>

                    {uploaded ? (
                      <div className="flex items-center justify-between pt-1 border-t border-surface-container text-[11px]">
                        <span className="text-primary truncate font-mono text-[10px]">{uploaded.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.key)}
                          className="text-error hover:underline text-[10px] font-semibold cursor-pointer shrink-0 ml-1"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="w-full mt-1 py-1.5 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface text-[11px] font-semibold text-center cursor-pointer transition-colors block border border-surface-container-highest">
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(doc.key, e.target.files?.[0])}
                        />
                      </label>
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
    </div>
  );
}
