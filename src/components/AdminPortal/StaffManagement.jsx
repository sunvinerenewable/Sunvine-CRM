import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';

export default function StaffManagement() {
  const {
    staffList,
    customerFiles,
    addStaff,
    updateStaff,
    updateStaffPassword,
    addCustomerFile,
    updateCustomerFile,
    updateFileStatus
  } = useApp();

  const { addToast } = useToast();

  // Main UI section: 'files' (Customer Files) or 'staff' (Sales Team Directory)
  const [activeView, setActiveView] = useState('files');

  // Files pipeline filter: 'all', 'Sourced', 'Verification', 'DISCOM Registered', 'Subsidized'
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [selectedFileForDocs, setSelectedFileForDocs] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Staff Credentials Modal
  const [selectedStaffForCreds, setSelectedStaffForCreds] = useState(null);
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // New Staff Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Field Sales Executive');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffZone, setNewStaffZone] = useState('Ahmedabad & Gandhinagar (UGVCL)');
  const [newStaffPassword, setNewStaffPassword] = useState('Sunvine@2026');

  // New File Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustDiscom, setNewCustDiscom] = useState('UGVCL');
  const [newCustConsumerNo, setNewCustConsumerNo] = useState('');
  const [newCustLoad, setNewCustLoad] = useState('5.0');
  const [newCustSolarKw, setNewCustSolarKw] = useState('4.4');
  const [newCustStaffId, setNewCustStaffId] = useState(staffList?.[0]?.id || 'STF-001');

  // Document Upload Handlers (Optional)
  const handleUploadDoc = (fileId, docKey, filename = 'document.pdf') => {
    const file = customerFiles.find(f => f.id === fileId);
    if (!file) return;

    const updatedDocs = {
      ...file.documents,
      [docKey]: {
        uploaded: true,
        filename: filename || `${docKey}_uploaded.pdf`,
        date: new Date().toISOString().split('T')[0]
      }
    };

    updateCustomerFile(fileId, { documents: updatedDocs });

    if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
      setSelectedFileForDocs(prev => ({
        ...prev,
        documents: updatedDocs
      }));
    }

    addToast(`Document uploaded: ${docKey} (Optional)`, 'success');
  };

  const handleCreateStaff = (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPhone.trim()) {
      addToast('Please provide Name and Mobile Number', 'error');
      return;
    }
    const newId = `STF-${String((staffList || []).length + 1).padStart(3, '0')}`;
    const newStaff = {
      id: newId,
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone.trim(),
      email: newStaffEmail.trim() || `${newStaffName.toLowerCase().replace(/\s+/g, '.')}@sunvine.in`,
      password: newStaffPassword.trim() || 'Sunvine@2026',
      zone: newStaffZone,
      totalFiles: 0,
      registeredFiles: 0,
      subsidizedFiles: 0,
      pipelineKw: 0,
      status: 'Active'
    };
    addStaff(newStaff);
    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setNewStaffPassword('Sunvine@2026');
    addToast(`Staff member "${newStaff.name}" added with ID: ${newId}!`, 'success');
  };

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      addToast('Please provide Customer Name and Mobile', 'error');
      return;
    }
    const assignedStaff = staffList.find(s => s.id === newCustStaffId) || staffList[0];
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
      staffId: assignedStaff.id,
      staffName: assignedStaff.name,
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Sourced',
      applicationNo: 'Draft Pending',
      documents: {
        aadhaar: { uploaded: false, filename: null, date: null },
        lightBill: { uploaded: false, filename: null, date: null },
        meterPhoto: { uploaded: false, filename: null, date: null },
        sitePhoto: { uploaded: false, filename: null, date: null },
        bankPassbook: { uploaded: false, filename: null, date: null }
      }
    };

    addCustomerFile(newFile);
    setShowAddFileModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustConsumerNo('');
    addToast(`New file ${newFileId} created for ${newFile.customerName}!`, 'success');
  };

  const handleSaveStaffPassword = () => {
    if (!selectedStaffForCreds) return;
    if (!editStaffPassword.trim()) {
      addToast('Password cannot be empty', 'error');
      return;
    }
    updateStaffPassword(selectedStaffForCreds.id, editStaffPassword.trim());
    addToast(`Password updated for ${selectedStaffForCreds.name}`, 'success');
    setSelectedStaffForCreds(null);
  };

  const handleCopyCredentials = (member) => {
    const text = `Sunvine Solar Portal - Staff Login:\nURL: ${window.location.origin}\nStaff ID: ${member.id}\nMobile: ${member.phone}\nPassword: ${member.password || 'Sunvine@2026'}`;
    navigator.clipboard.writeText(text);
    addToast(`Login credentials copied for ${member.name}! Send to staff via WhatsApp.`, 'success');
  };

  // Filtered files
  const filteredFiles = (customerFiles || []).filter(f => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      f.customerName.toLowerCase().includes(term) ||
      (f.consumerNo || '').toLowerCase().includes(term) ||
      f.phone.includes(term) ||
      f.id.toLowerCase().includes(term) ||
      (f.staffName || '').toLowerCase().includes(term);

    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    const matchStaff = staffFilter === 'all' || f.staffId === staffFilter;

    return matchSearch && matchStatus && matchStaff;
  });

  // Pipeline stats
  const totalFilesCount = (customerFiles || []).length;
  const sourcedCount = (customerFiles || []).filter(f => f.status === 'Sourced').length;
  const inProgressTotal = (customerFiles || []).filter(f => f.status === 'Verification' || f.status === 'DISCOM Registered').length;
  const subsidizedCount = (customerFiles || []).filter(f => f.status === 'Subsidized').length;
  const totalKwSum = (customerFiles || []).reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

  return (
    <div className="flex flex-col w-full pb-16 font-sans text-slate-800">
      <div className="max-w-[1520px] mx-auto w-full space-y-6">
        {/* Top Header matching DealerManagement */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E4E7EB] pb-5">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-secondary mb-1">
              <span>Admin Console</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Partner Directory</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-on-surface font-semibold">Sales Team &amp; Customer Files</span>
            </nav>
            <h1 className="font-poppins font-bold text-headline-xl text-[#0F1B2E] tracking-tight">
              Sales Team &amp; Customer Files
            </h1>
            <p className="text-body-md text-secondary mt-1">
              Live salesperson performance tracking, portal credentials, customer pipeline, and optional document vault.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="h-10 px-3.5 sm:px-4 bg-white border border-[#E4E7EB] hover:border-primary text-on-surface font-label-md rounded-lg hover:bg-surface-container-low transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer text-xs sm:text-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">person_add</span>
              <span>Register New Staff</span>
            </button>
            <button
              onClick={() => setShowAddFileModal(true)}
              className="h-10 px-3.5 sm:px-4 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-label-md font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              <span>+ New Customer File</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Staff</div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1 font-mono">{(staffList || []).length}</div>
            <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              Active Accounts
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Files</div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 mt-1 font-mono">{totalFilesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">{totalKwSum} kW Pipeline</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sourced / Leads</div>
            <div className="text-2xl md:text-3xl font-black text-amber-600 mt-1 font-mono">{sourcedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-semibold">Initial Contact</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Progress</div>
            <div className="text-2xl md:text-3xl font-black text-blue-600 mt-1 font-mono">{inProgressTotal}</div>
            <div className="text-[11px] text-blue-600 mt-1 font-semibold">Verification / DISCOM</div>
          </div>
          <div className="bg-white rounded-xl border border-[#E4E7EB] p-5 shadow-xs flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Successful</div>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1 font-mono">{subsidizedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-1 font-semibold">DBT Approved &amp; Paid</div>
          </div>
        </div>

        {/* View Switcher: Files vs Staff Directory */}
        <div className="flex border-b border-[#E4E7EB] gap-6">
          <button
            onClick={() => setActiveView('files')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeView === 'files'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span>
            <span>Customer Files &amp; Subsidies</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{(customerFiles || []).length}</span>
          </button>
          <button
            onClick={() => setActiveView('staff')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeView === 'staff'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span>Sales Team Directory &amp; Logins</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{(staffList || []).length}</span>
          </button>
        </div>

        {/* VIEW 1: CUSTOMER FILES & PIPELINE */}
        {activeView === 'files' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-[#E4E7EB] shadow-xs">
              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {[
                  { key: 'all', label: 'All Files' },
                  { key: 'Sourced', label: 'Sourced' },
                  { key: 'Verification', label: 'Verification' },
                  { key: 'DISCOM Registered', label: 'DISCOM Reg.' },
                  { key: 'Subsidized', label: 'Subsidized' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      statusFilter === t.key
                        ? 'bg-[#0F1B2E] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Staff and Search filters */}
              <div className="flex items-center gap-2.5">
                <select
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                  className="bg-white border border-[#E4E7EB] rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Sales Staff</option>
                  {(staffList || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.zone?.split(' ')[0]})</option>
                  ))}
                </select>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search name, consumer no, mobile..."
                    className="bg-white border border-[#E4E7EB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-48 md:w-60"
                  />
                </div>
              </div>
            </div>

            {/* Files Grid / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map(file => {
                const docsCount = Object.values(file.documents || {}).filter(d => d.uploaded).length;
                const statusColors = {
                  'Sourced': 'bg-amber-50 text-amber-800 border-amber-200',
                  'Verification': 'bg-blue-50 text-blue-800 border-blue-200',
                  'DISCOM Registered': 'bg-purple-50 text-purple-800 border-purple-200',
                  'Subsidized': 'bg-emerald-50 text-emerald-800 border-emerald-200'
                };

                return (
                  <div
                    key={file.id}
                    className="bg-white border border-[#E4E7EB] hover:border-slate-300 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-all"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">{file.id}</span>
                          <h3 className="text-base font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                            {file.customerName}
                          </h3>
                        </div>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${statusColors[file.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {file.status}
                        </span>
                      </div>

                      {/* Info Pills */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <span className="text-slate-500 block text-[10px] font-medium">DISCOM / Consumer No</span>
                          <span className="font-bold text-slate-800">{file.discom}</span>
                          <span className="text-[11px] text-slate-500 block truncate">{file.consumerNo || 'Pending'}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <span className="text-slate-500 block text-[10px] font-medium">System &amp; Load</span>
                          <span className="font-bold text-emerald-700">{file.solarSystemKw} kW Solar</span>
                          <span className="text-[11px] text-slate-500 block">{file.sanctionedLoadKw} kW Load</span>
                        </div>
                      </div>

                      {/* Contact & Sales Executive */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">call</span>
                          <a href={`tel:${file.phone}`} className="hover:underline text-slate-800 font-semibold">{file.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">person</span>
                          <span>Assigned: <strong className="text-slate-800">{file.staffName}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 truncate">
                          <span className="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
                          <span className="truncate">{file.address}</span>
                        </div>
                      </div>

                      {/* Document Badges (Clearly Optional) */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-500 font-medium">Documents (Optional)</span>
                          <span className="font-bold text-emerald-700">{docsCount} / 5 Attached</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 text-center">
                          {[
                            { key: 'aadhaar', label: 'Aadhaar' },
                            { key: 'lightBill', label: 'Bill' },
                            { key: 'meterPhoto', label: 'Meter' },
                            { key: 'sitePhoto', label: 'Site' },
                            { key: 'bankPassbook', label: 'Bank' }
                          ].map(doc => {
                            const isUp = file.documents?.[doc.key]?.uploaded;
                            return (
                              <div
                                key={doc.key}
                                title={`${doc.label}: ${isUp ? 'Uploaded' : 'Optional'}`}
                                className={`py-1 rounded flex flex-col items-center justify-center text-[10px] border transition-all ${
                                  isUp
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}
                              >
                                <span>{doc.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedFileForDocs(file)}
                        className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">upload_file</span>
                        <span>Docs (Optional)</span>
                      </button>

                      {/* Quick Status Advance */}
                      <select
                        value={file.status}
                        onChange={e => {
                          updateFileStatus(file.id, e.target.value);
                          addToast(`Updated status to "${e.target.value}"`, 'success');
                        }}
                        className="bg-white border border-[#E4E7EB] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                      >
                        <option value="Sourced">Sourced</option>
                        <option value="Verification">Verification</option>
                        <option value="DISCOM Registered">DISCOM Reg.</option>
                        <option value="Subsidized">Subsidized</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredFiles.length === 0 && (
              <div className="bg-white border border-[#E4E7EB] rounded-xl p-12 text-center text-slate-500 shadow-xs">
                <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">folder_off</span>
                <p>No customer files match your search criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SALES TEAM DIRECTORY & LOGINS */}
        {activeView === 'staff' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(staffList || []).map(member => {
                // Compute live individual salesperson metrics
                const sFiles = (customerFiles || []).filter(f => f.staffId === member.id || f.staffName === member.name);
                const totalBrought = sFiles.length;
                const inProg = sFiles.filter(f => f.status === 'Verification' || f.status === 'DISCOM Registered').length;
                const successDone = sFiles.filter(f => f.status === 'Subsidized').length;
                const sKw = sFiles.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

                return (
                  <div
                    key={member.id}
                    className="bg-white border border-[#E4E7EB] rounded-xl p-5 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-base">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{member.name}</h3>
                            <p className="text-[11px] text-slate-500 font-mono font-semibold">{member.id}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedStaffForCreds(member);
                            setEditStaffPassword(member.password || 'Sunvine@2026');
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Manage Password & Credentials"
                        >
                          <span className="material-symbols-outlined text-[16px] text-amber-500">key</span>
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        <div className="text-[11px] text-emerald-700 font-semibold">{member.role}</div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <a href={`tel:${member.phone}`} className="hover:underline text-slate-800">{member.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 truncate">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="truncate">{member.zone}</span>
                        </div>
                      </div>

                      {/* Live 3-Column Salesperson Metrics */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <div className="text-slate-500 text-[10px] font-medium">Total Files</div>
                          <div className="font-bold text-slate-900 text-sm mt-0.5">{totalBrought}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <div className="text-blue-600 text-[10px] font-medium">In Progress</div>
                          <div className="font-bold text-blue-700 text-sm mt-0.5">{inProg}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                          <div className="text-emerald-700 text-[10px] font-medium">Success</div>
                          <div className="font-bold text-emerald-700 text-sm mt-0.5">{successDone}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-center text-[11px] text-slate-500">
                        Pipeline Capacity: <strong className="text-slate-900">{sKw} kW</strong>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => handleCopyCredentials(member)}
                        className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Copy WhatsApp Login Message"
                      >
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">share</span>
                        <span>Credentials</span>
                      </button>

                      <button
                        onClick={() => {
                          setStaffFilter(member.id);
                          setActiveView('files');
                        }}
                        className="text-emerald-600 hover:underline text-xs flex items-center gap-0.5 font-semibold cursor-pointer"
                      >
                        <span>View Files</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E4E7EB] pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                <span>Register Sales Executive</span>
              </h2>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="e.g. Suresh V. Solanki"
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={e => setNewStaffPhone(e.target.value)}
                  placeholder="9825012345"
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="text"
                  required
                  value={newStaffPassword}
                  onChange={e => setNewStaffPassword(e.target.value)}
                  placeholder="Sunvine@2026"
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Field Sales Executive">Field Sales Executive</option>
                  <option value="Area Sales Manager">Area Sales Manager</option>
                  <option value="Verification Officer">Verification Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Zone / Territory</label>
                <select
                  value={newStaffZone}
                  onChange={e => setNewStaffZone(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Ahmedabad & Gandhinagar (UGVCL)">Ahmedabad &amp; Gandhinagar (UGVCL)</option>
                  <option value="Rajkot & Saurashtra (PGVCL)">Rajkot &amp; Saurashtra (PGVCL)</option>
                  <option value="Surat & South Gujarat (DGVCL)">Surat &amp; South Gujarat (DGVCL)</option>
                  <option value="Vadodara & Anand (MGVCL)">Vadodara &amp; Anand (MGVCL)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E4E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STAFF CREDENTIALS & PASSWORD MANAGEMENT */}
      {selectedStaffForCreds && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E4E7EB] pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">key</span>
                <span>Manage Staff Credentials - {selectedStaffForCreds.name}</span>
              </h3>
              <button onClick={() => setSelectedStaffForCreds(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500">Staff ID: <strong className="text-slate-900 font-mono">{selectedStaffForCreds.id}</strong></div>
                <div className="text-slate-500">Login Mobile: <strong className="text-emerald-700 font-bold">{selectedStaffForCreds.phone}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Change Account Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={editStaffPassword}
                    onChange={e => setEditStaffPassword(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 pr-10 text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {showStaffPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditStaffPassword('Sunvine@2026')}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-[11px] text-slate-700 font-medium"
                >
                  Reset to Sunvine@2026
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(selectedStaffForCreds)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded text-[11px] font-semibold flex items-center gap-1 ml-auto"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E7EB]">
              <button
                type="button"
                onClick={() => setSelectedStaffForCreds(null)}
                className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveStaffPassword}
                className="px-5 py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg cursor-pointer shadow-sm"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW CUSTOMER FILE */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E4E7EB] pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">note_add</span>
                <span>Create Customer Solar File</span>
              </h2>
              <button onClick={() => setShowAddFileModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="e.g. Bharatbhai M. Patel"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="+91 98250 99881"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Site Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Plot 10, Suryam Residency, Near Ring Road, Ahmedabad"
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">DISCOM</label>
                  <select
                    value={newCustDiscom}
                    onChange={e => setNewCustDiscom(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Consumer No (Optional)</label>
                  <input
                    type="text"
                    value={newCustConsumerNo}
                    onChange={e => setNewCustConsumerNo(e.target.value)}
                    placeholder="e.g. 03901/12345/6"
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCustLoad}
                    onChange={e => setNewCustLoad(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposed Solar (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCustSolarKw}
                    onChange={e => setNewCustSolarKw(e.target.value)}
                    className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Sales Staff</label>
                <select
                  value={newCustStaffId}
                  onChange={e => setNewCustStaffId(e.target.value)}
                  className="w-full bg-white border border-[#E4E7EB] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {(staffList || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.zone}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E4E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                >
                  Create Customer File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: OPTIONAL DOCUMENT VAULT */}
      {selectedFileForDocs && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-slate-900">
            <div className="flex items-start justify-between border-b border-[#E4E7EB] pb-4">
              <div>
                <span className="text-xs font-mono text-emerald-700 uppercase font-semibold">{selectedFileForDocs.id}</span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedFileForDocs.customerName} - Document Vault (Optional)
                </h2>
                <p className="text-xs text-slate-500">
                  Consumer No: <strong className="text-slate-800">{selectedFileForDocs.consumerNo}</strong> | System: <strong className="text-emerald-700 font-bold">{selectedFileForDocs.solarSystemKw} kW</strong>
                </p>
              </div>
              <button onClick={() => setSelectedFileForDocs(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'aadhaar', title: 'Aadhaar Card' },
                { key: 'lightBill', title: 'Electricity / Light Bill' },
                { key: 'meterPhoto', title: 'Electricity Meter Photo' },
                { key: 'sitePhoto', title: 'Rooftop / Site Photo' },
                { key: 'bankPassbook', title: 'Bank Passbook / Cheque' }
              ].map(item => {
                const doc = selectedFileForDocs.documents?.[item.key];
                const isUploaded = doc?.uploaded;

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      isUploaded ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200 border-dashed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isUploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-600'
                        }`}>
                          {isUploaded ? 'Uploaded' : 'Optional'}
                        </span>
                      </div>
                      {isUploaded && (
                        <p className="text-xs text-slate-600 mt-2 truncate font-medium">{doc.filename}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                      {isUploaded ? (
                        <button
                          onClick={() => setPreviewDoc({ ...item, ...doc })}
                          className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
                        >
                          View Preview
                        </button>
                      ) : (
                        <label className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">upload</span>
                          <span>Upload (Optional)</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadDoc(selectedFileForDocs.id, item.key, f.name);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E4E7EB]">
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="px-4 py-2 bg-white border border-[#E4E7EB] text-slate-700 text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E4E7EB] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center text-slate-900">
            <h3 className="font-bold text-slate-900 text-base">{previewDoc.title}</h3>
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="material-symbols-outlined text-4xl text-emerald-600">verified</span>
              <p className="text-slate-900 text-sm font-semibold mt-2">{previewDoc.filename}</p>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full py-2 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white font-bold text-xs rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
