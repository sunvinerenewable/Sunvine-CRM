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
    <div className="min-h-screen bg-[#070D18] text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-primary-container">badge</span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Sales Team &amp; Customer Files (सेल्स टीम और फाइल प्रबंधन)
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Live salesperson performance tracking, ID-Password credentials, customer pipeline, and optional document vault.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Register New Staff (स्टाफ जोड़ें)</span>
            </button>
            <button
              onClick={() => setShowAddFileModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              <span>New Customer File (नई फाइल)</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#0D1527] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-400">Total Staff (टीम)</div>
            <div className="text-2xl font-bold text-white mt-1">{(staffList || []).length}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              All Active Login Accounts
            </div>
          </div>
          <div className="bg-[#0D1527] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-400">Total Files Brought (कुल फाइलें)</div>
            <div className="text-2xl font-bold text-white mt-1">{totalFilesCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">{totalKwSum} kW Pipeline</div>
          </div>
          <div className="bg-[#0D1527] border border-amber-500/20 rounded-xl p-4 bg-amber-500/5">
            <div className="text-xs text-amber-300">Sourced / Leads (लीड)</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{sourcedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Initial Contact</div>
          </div>
          <div className="bg-[#0D1527] border border-blue-500/20 rounded-xl p-4 bg-blue-500/5">
            <div className="text-xs text-blue-300">In Progress (प्रगति पर)</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{inProgressTotal}</div>
            <div className="text-[11px] text-blue-300 mt-1">Verification / DISCOM</div>
          </div>
          <div className="bg-[#0D1527] border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/5">
            <div className="text-xs text-emerald-300">Successful (सब्सिडी स्वीकृत)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{subsidizedCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1">DBT Approved &amp; Paid</div>
          </div>
        </div>

        {/* View Switcher: Files vs Staff Directory */}
        <div className="flex border-b border-white/10 gap-8">
          <button
            onClick={() => setActiveView('files')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeView === 'files'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span>
            <span>Customer Files &amp; Subsidies (ग्राहक फाइलें)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{(customerFiles || []).length}</span>
          </button>
          <button
            onClick={() => setActiveView('staff')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeView === 'staff'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span>Sales Team Directory &amp; Logins (सेल्स टीम डायरेक्टरी)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{(staffList || []).length}</span>
          </button>
        </div>

        {/* VIEW 1: CUSTOMER FILES & PIPELINE */}
        {activeView === 'files' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0D1527] p-4 rounded-xl border border-white/10">
              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
                {[
                  { key: 'all', label: 'All Files' },
                  { key: 'Sourced', label: 'Sourced (लीड)' },
                  { key: 'Verification', label: 'Verification (सत्यापन)' },
                  { key: 'DISCOM Registered', label: 'DISCOM Reg. (पंजीकृत)' },
                  { key: 'Subsidized', label: 'Subsidized (स्वीकृत)' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      statusFilter === t.key
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Staff and Search filters */}
              <div className="flex items-center gap-3">
                <select
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                  className="bg-[#070D18] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="all">All Sales Staff (सभी स्टाफ)</option>
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
                    className="bg-[#070D18] border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400 w-48 md:w-60"
                  />
                </div>
              </div>
            </div>

            {/* Files Grid / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map(file => {
                const docsCount = Object.values(file.documents || {}).filter(d => d.uploaded).length;
                const statusColors = {
                  'Sourced': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                  'Verification': 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                  'DISCOM Registered': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
                  'Subsidized': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                };

                return (
                  <div
                    key={file.id}
                    className="bg-[#0D1527] border border-white/10 hover:border-white/20 rounded-xl p-5 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{file.id}</span>
                          <h3 className="text-base font-bold text-white hover:text-emerald-400 transition-colors">
                            {file.customerName}
                          </h3>
                        </div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[file.status] || 'bg-slate-800 text-slate-300'}`}>
                          {file.status}
                        </span>
                      </div>

                      {/* Info Pills */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">DISCOM / Consumer No</span>
                          <span className="font-semibold text-slate-200">{file.discom}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{file.consumerNo || 'Pending'}</span>
                        </div>
                        <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                          <span className="text-slate-400 block text-[10px]">System &amp; Load</span>
                          <span className="font-bold text-emerald-400">{file.solarSystemKw} kW Solar</span>
                          <span className="text-[11px] text-slate-400 block">{file.sanctionedLoadKw} kW Load</span>
                        </div>
                      </div>

                      {/* Contact & Sales Executive */}
                      <div className="mt-3 space-y-1 text-xs text-slate-300">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <a href={`tel:${file.phone}`} className="hover:underline text-slate-200 font-semibold">{file.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="material-symbols-outlined text-[14px]">person</span>
                          <span>Assigned: <strong className="text-slate-200">{file.staffName}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 truncate">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="truncate">{file.address}</span>
                        </div>
                      </div>

                      {/* Document Badges (Clearly Optional) */}
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-400">Documents (Optional)</span>
                          <span className="font-semibold text-emerald-400">{docsCount} / 5 Attached</span>
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
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-slate-500'
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
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedFileForDocs(file)}
                        className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px] text-emerald-400">upload_file</span>
                        <span>Docs (Optional)</span>
                      </button>

                      {/* Quick Status Advance */}
                      <select
                        value={file.status}
                        onChange={e => {
                          updateFileStatus(file.id, e.target.value);
                          addToast(`Updated status to "${e.target.value}"`, 'success');
                        }}
                        className="bg-[#070D18] border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-400 cursor-pointer"
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
              <div className="bg-[#0D1527] border border-white/10 rounded-xl p-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">folder_off</span>
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
                    className="bg-[#0D1527] border border-white/10 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-base">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base">{member.name}</h3>
                            <p className="text-[11px] text-slate-400 font-mono">{member.id}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedStaffForCreds(member);
                            setEditStaffPassword(member.password || 'Sunvine@2026');
                          }}
                          className="p-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Manage Password & Credentials"
                        >
                          <span className="material-symbols-outlined text-[16px] text-amber-400">key</span>
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                        <div className="text-[11px] text-emerald-300 font-medium">{member.role}</div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <a href={`tel:${member.phone}`} className="hover:underline text-slate-200">{member.phone}</a>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 truncate">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span className="truncate">{member.zone}</span>
                        </div>
                      </div>

                      {/* Live 3-Column Salesperson Metrics */}
                      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-1.5 text-center text-xs">
                        <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                          <div className="text-slate-400 text-[10px]">Total Files</div>
                          <div className="font-bold text-white text-sm mt-0.5">{totalBrought}</div>
                          <div className="text-[9px] text-slate-500">लाईं गईं</div>
                        </div>
                        <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                          <div className="text-blue-300 text-[10px]">In Progress</div>
                          <div className="font-bold text-blue-400 text-sm mt-0.5">{inProg}</div>
                          <div className="text-[9px] text-slate-500">प्रगति पर</div>
                        </div>
                        <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                          <div className="text-emerald-300 text-[10px]">Success</div>
                          <div className="font-bold text-emerald-400 text-sm mt-0.5">{successDone}</div>
                          <div className="text-[9px] text-emerald-400/70">स्वीकृत</div>
                        </div>
                      </div>

                      <div className="mt-2 text-center text-[11px] text-slate-400">
                        Pipeline Capacity: <strong className="text-white">{sKw} kW</strong>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                      <button
                        onClick={() => handleCopyCredentials(member)}
                        className="py-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy WhatsApp Login Message"
                      >
                        <span className="material-symbols-outlined text-[14px] text-emerald-400">share</span>
                        <span>Credentials</span>
                      </button>

                      <button
                        onClick={() => {
                          setStaffFilter(member.id);
                          setActiveView('files');
                        }}
                        className="text-primary-container hover:underline text-xs flex items-center gap-0.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">person_add</span>
                <span>Register Sales Executive (नया स्टाफ आईडी)</span>
              </h2>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name (पूरा नाम) *</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="e.g. Suresh V. Solanki"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number (लॉगिन मोबाइल) *</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={e => setNewStaffPhone(e.target.value)}
                  placeholder="9825012345"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password (पासवर्ड सेट करें) *</label>
                <input
                  type="text"
                  required
                  value={newStaffPassword}
                  onChange={e => setNewStaffPassword(e.target.value)}
                  placeholder="Sunvine@2026"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Designation / Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Field Sales Executive">Field Sales Executive (फील्ड सेल्स)</option>
                  <option value="Area Sales Manager">Area Sales Manager (एरिया मैनेजर)</option>
                  <option value="Verification Officer">Verification Officer (सत्यापन अधिकारी)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Zone / Territory</label>
                <select
                  value={newStaffZone}
                  onChange={e => setNewStaffZone(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Ahmedabad & Gandhinagar (UGVCL)">Ahmedabad &amp; Gandhinagar (UGVCL)</option>
                  <option value="Rajkot & Saurashtra (PGVCL)">Rajkot &amp; Saurashtra (PGVCL)</option>
                  <option value="Surat & South Gujarat (DGVCL)">Surat &amp; South Gujarat (DGVCL)</option>
                  <option value="Vadodara & Anand (MGVCL)">Vadodara &amp; Anand (MGVCL)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">key</span>
                <span>Manage Staff Credentials - {selectedStaffForCreds.name}</span>
              </h3>
              <button onClick={() => setSelectedStaffForCreds(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#070D18] p-3 rounded-xl border border-white/10 space-y-1">
                <div className="text-slate-400">Staff ID: <strong className="text-white font-mono">{selectedStaffForCreds.id}</strong></div>
                <div className="text-slate-400">Login Mobile: <strong className="text-emerald-400">{selectedStaffForCreds.phone}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Change Account Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    value={editStaffPassword}
                    onChange={e => setEditStaffPassword(e.target.value)}
                    className="w-full bg-[#070D18] border border-white/20 rounded-lg px-3 py-2 pr-10 text-white font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
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
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[11px] text-slate-300"
                >
                  Reset to Sunvine@2026
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(selectedStaffForCreds)}
                  className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded text-[11px] font-semibold flex items-center gap-1 ml-auto"
                >
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedStaffForCreds(null)}
                className="px-4 py-2 bg-white/10 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveStaffPassword}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                Save New Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW CUSTOMER FILE */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">note_add</span>
                <span>Create Customer Solar File (नई फाइल)</span>
              </h2>
              <button onClick={() => setShowAddFileModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="e.g. Bharatbhai M. Patel"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="+91 98250 99881"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Site Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Plot 10, Suryam Residency, Near Ring Road, Ahmedabad"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">DISCOM</label>
                  <select
                    value={newCustDiscom}
                    onChange={e => setNewCustDiscom(e.target.value)}
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Consumer No (Optional)</label>
                  <input
                    type="text"
                    value={newCustConsumerNo}
                    onChange={e => setNewCustConsumerNo(e.target.value)}
                    placeholder="e.g. 03901/12345/6"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sanctioned Load (kW)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCustLoad}
                    onChange={e => setNewCustLoad(e.target.value)}
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Proposed Solar (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCustSolarKw}
                    onChange={e => setNewCustSolarKw(e.target.value)}
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assign Sales Staff</label>
                <select
                  value={newCustStaffId}
                  onChange={e => setNewCustStaffId(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {(staffList || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.zone}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-4 py-2 bg-white/10 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">{selectedFileForDocs.id}</span>
                <h2 className="text-xl font-bold text-white mt-1">
                  {selectedFileForDocs.customerName} - Document Vault (Optional)
                </h2>
                <p className="text-xs text-slate-400">
                  Consumer No: <strong className="text-slate-200">{selectedFileForDocs.consumerNo}</strong> | System: <strong className="text-emerald-400">{selectedFileForDocs.solarSystemKw} kW</strong>
                </p>
              </div>
              <button onClick={() => setSelectedFileForDocs(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'aadhaar', title: 'Aadhaar Card (आधार कार्ड)' },
                { key: 'lightBill', title: 'Electricity / Light Bill (बिजली बिल)' },
                { key: 'meterPhoto', title: 'Electricity Meter Photo (मीटर फोटो)' },
                { key: 'sitePhoto', title: 'Rooftop / Site Photo (छत की फोटो)' },
                { key: 'bankPassbook', title: 'Bank Passbook / Cheque (पासबुक)' }
              ].map(item => {
                const doc = selectedFileForDocs.documents?.[item.key];
                const isUploaded = doc?.uploaded;

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      isUploaded ? 'bg-[#070D18] border-emerald-500/30' : 'bg-[#070D18]/50 border-white/10 border-dashed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isUploaded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                        }`}>
                          {isUploaded ? 'Uploaded' : 'Optional'}
                        </span>
                      </div>
                      {isUploaded && (
                        <p className="text-xs text-slate-300 mt-2 truncate">{doc.filename}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      {isUploaded ? (
                        <button
                          onClick={() => setPreviewDoc({ ...item, ...doc })}
                          className="text-xs text-emerald-400 hover:underline cursor-pointer"
                        >
                          View Preview
                        </button>
                      ) : (
                        <label className="text-xs text-emerald-400 hover:underline cursor-pointer flex items-center gap-1">
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

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="px-4 py-2 bg-white/10 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <h3 className="font-bold text-white text-base">{previewDoc.title}</h3>
            <div className="p-6 bg-[#070D18] rounded-xl">
              <span className="material-symbols-outlined text-4xl text-emerald-400">verified</span>
              <p className="text-white text-sm font-semibold mt-2">{previewDoc.filename}</p>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
