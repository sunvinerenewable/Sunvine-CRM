import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';

export default function StaffNewLead() {
  const { currentStaff, addCustomerFile, setActiveTab } = useApp();
  const { addToast } = useToast();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(currentStaff?.city || 'Ahmedabad');
  const [discom, setDiscom] = useState('UGVCL');
  const [consumerNo, setConsumerNo] = useState('');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState('5.0');
  const [solarSystemKw, setSolarSystemKw] = useState('4.4');
  const [roofType, setRoofType] = useState('RCC Flat Roof (आरसीसी छत)');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim()) {
      addToast('Customer Name and Mobile Number are required', 'error');
      return;
    }

    const newFileId = `FIL-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newFile = {
      id: newFileId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim() || `${city}, Gujarat`,
      city: city,
      discom: discom,
      consumerNo: consumerNo.trim() || `${discom}-${Math.floor(100000 + Math.random() * 900000)}`,
      sanctionedLoadKw: parseFloat(sanctionedLoadKw) || 5.0,
      solarSystemKw: parseFloat(solarSystemKw) || 3.3,
      roofType: roofType,
      staffId: currentStaff?.id || 'STF-001',
      staffName: currentStaff?.name || 'Jayesh Patel',
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      applicationNo: 'Draft Pending',
      notes: notes.trim() || 'Lead sourced from field visit.',
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };

    addCustomerFile(newFile);
    addToast(`New Customer Lead "${newFile.customerName}" created successfully!`, 'success');
    setActiveTab('staff_files');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">person_add</span>
            <span>New Customer Solar Lead (नई ग्राहक लीड)</span>
          </h1>
          <p className="text-xs text-secondary mt-1">
            Fill in the customer basic details. <strong className="text-primary">Document uploads are NOT mandatory</strong> - you can enter documents later anytime!
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

      <div className="bg-surface rounded-2xl border border-surface-container-high p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Customer Full Name (ग्राहक का पूरा नाम) *
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
                Mobile Number (मोबाइल नंबर) *
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
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Installation Address / Landmark (साइट का पता)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 18, Shrinathji Bungalows, Near Bopal Cross Road"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">City / District (शहर)</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
              >
                <option value="Ahmedabad">Ahmedabad</option>
                <option value="Gandhinagar">Gandhinagar</option>
                <option value="Rajkot">Rajkot</option>
                <option value="Surat">Surat</option>
                <option value="Vadodara">Vadodara</option>
                <option value="Bhavnagar">Bhavnagar</option>
                <option value="Jamnagar">Jamnagar</option>
                <option value="Junagadh">Junagadh</option>
                <option value="Anand">Anand</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">DISCOM (बिजली वितरण)</label>
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
                Consumer No (ग्राहक क्रमांक) <span className="text-secondary font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={consumerNo}
                onChange={(e) => setConsumerNo(e.target.value)}
                placeholder="e.g. 03901/44321/9"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="block text-xs font-bold text-on-surface mb-1">Sanctioned Load (kW)</label>
              <input
                type="number"
                step="0.5"
                value={sanctionedLoadKw}
                onChange={(e) => setSanctionedLoadKw(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Rooftop Type (छत का प्रकार)</label>
              <select
                value={roofType}
                onChange={(e) => setRoofType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none cursor-pointer"
              >
                <option value="RCC Flat Roof (आरसीसी छत)">RCC Flat Roof (आरसीसी छत)</option>
                <option value="Industrial Tin Shed (टिन शेड)">Industrial Tin Shed (टिन शेड)</option>
                <option value="Elevated Gazebo Roof">Elevated Gazebo Roof (ऊंचा स्ट्रक्चर)</option>
                <option value="Pitched / Tiled Roof">Pitched / Tiled Roof</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Field Survey Notes &amp; Observations (टिप्पणी / आवश्यकताएं)
            </label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer wants Mono PERC 550W panels with 5-year warranty. Rooftop is 800 sq.ft shadow free."
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:border-primary outline-none"
            ></textarea>
          </div>

          {/* Optional notice */}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">check_circle</span>
            <span>
              <strong>Zero Document Lockout:</strong> Aadhaar, Light Bill &amp; Meter photos can be added later from your files tab anytime.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-container-high">
            <button
              type="button"
              onClick={() => setActiveTab('staff_dashboard')}
              className="px-5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-xs font-bold text-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>Save Customer Lead</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
