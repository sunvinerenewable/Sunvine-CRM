import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';

const DEFAULT_STAFF = [
  {
    id: 'STF-001',
    name: 'Jayesh Patel',
    role: 'Senior Solar Field Executive',
    phone: '+91 98251 12345',
    email: 'jayesh.patel@sunvine.in',
    zone: 'Ahmedabad & Gandhinagar (UGVCL)',
    totalFiles: 24,
    registeredFiles: 18,
    subsidizedFiles: 14,
    pipelineKw: 112.5,
    status: 'Active'
  },
  {
    id: 'STF-002',
    name: 'Hardik Chauhan',
    role: 'Area Sales Manager',
    phone: '+91 98982 67890',
    email: 'hardik.c@sunvine.in',
    zone: 'Rajkot & Saurashtra (PGVCL)',
    totalFiles: 31,
    registeredFiles: 25,
    subsidizedFiles: 20,
    pipelineKw: 158.0,
    status: 'Active'
  },
  {
    id: 'STF-003',
    name: 'Nilesh Vaghela',
    role: 'Field Verification Officer',
    phone: '+91 97240 55443',
    email: 'nilesh.v@sunvine.in',
    zone: 'Surat & South Gujarat (DGVCL)',
    totalFiles: 19,
    registeredFiles: 14,
    subsidizedFiles: 11,
    pipelineKw: 88.5,
    status: 'Active'
  },
  {
    id: 'STF-004',
    name: 'Bhavin Shah',
    role: 'Central Gujarat Sales Representative',
    phone: '+91 94280 99881',
    email: 'bhavin.s@sunvine.in',
    zone: 'Vadodara & Anand (MGVCL)',
    totalFiles: 15,
    registeredFiles: 10,
    subsidizedFiles: 8,
    pipelineKw: 72.0,
    status: 'Active'
  }
];

const DEFAULT_FILES = [
  {
    id: 'FIL-2026-081',
    customerName: 'Rameshchandra K. Dave',
    phone: '+91 98250 44123',
    address: 'Plot 42, Shubh Residency, Science City Road, Ahmedabad',
    discom: 'UGVCL',
    consumerNo: 'UGVCL-AHM-902819',
    sanctionedLoadKw: 6.0,
    solarSystemKw: 5.5,
    roofType: 'RCC Flat Terrace (L-Shape)',
    staffId: 'STF-001',
    staffName: 'Jayesh Patel',
    createdDate: '2026-09-20',
    status: 'DISCOM Registered', // Sourced, Verification, DISCOM Registered, Subsidized
    applicationNo: 'GEDA-PMSY-2026-90412',
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_ramesh_dave.pdf', date: '2026-09-20' },
      lightBill: { uploaded: true, filename: 'ugvcl_bill_aug2026.pdf', date: '2026-09-20' },
      meterPhoto: { uploaded: true, filename: 'meter_reading_6kw.jpg', date: '2026-09-21' },
      sitePhoto: { uploaded: true, filename: 'rooftop_drone_elevation.jpg', date: '2026-09-21' },
      bankPassbook: { uploaded: true, filename: 'sbi_cheque_subsidy.pdf', date: '2026-09-22' }
    }
  },
  {
    id: 'FIL-2026-082',
    customerName: 'Pravinbhai M. Solanki',
    phone: '+91 94270 33882',
    address: 'B-12, Radhe Krishna Bungalows, Kalawad Road, Rajkot',
    discom: 'PGVCL',
    consumerNo: 'PGVCL-RJK-781920',
    sanctionedLoadKw: 4.0,
    solarSystemKw: 3.3,
    roofType: 'RCC Flat Roof',
    staffId: 'STF-002',
    staffName: 'Hardik Chauhan',
    createdDate: '2026-09-22',
    status: 'Verification',
    applicationNo: 'GEDA-PMSY-2026-90488',
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_solanki.pdf', date: '2026-09-22' },
      lightBill: { uploaded: true, filename: 'pgvcl_bill_sep2026.pdf', date: '2026-09-22' },
      meterPhoto: { uploaded: true, filename: 'meter_closeup.jpg', date: '2026-09-23' },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: true, filename: 'bob_passbook.pdf', date: '2026-09-23' }
    }
  },
  {
    id: 'FIL-2026-083',
    customerName: 'Jagdishbhai H. Patel',
    phone: '+91 98790 12099',
    address: 'Near Ambaji Temple, Adajan, Surat',
    discom: 'DGVCL',
    consumerNo: 'DGVCL-SRT-665412',
    sanctionedLoadKw: 10.0,
    solarSystemKw: 10.0,
    roofType: 'Industrial Shed & RCC Terrace',
    staffId: 'STF-003',
    staffName: 'Nilesh Vaghela',
    createdDate: '2026-09-18',
    status: 'Subsidized',
    applicationNo: 'GEDA-PMSY-2026-88719',
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_jagdish.pdf', date: '2026-09-18' },
      lightBill: { uploaded: true, filename: 'dgvcl_bill_aug.pdf', date: '2026-09-18' },
      meterPhoto: { uploaded: true, filename: 'bidirectional_meter.jpg', date: '2026-09-19' },
      sitePhoto: { uploaded: true, filename: 'installed_site_view.jpg', date: '2026-09-24' },
      bankPassbook: { uploaded: true, filename: 'axis_bank_statement.pdf', date: '2026-09-19' }
    }
  },
  {
    id: 'FIL-2026-084',
    customerName: 'Anilbhai K. Mehta',
    phone: '+91 99099 87654',
    address: '4, Sardar Society, Gotri Road, Vadodara',
    discom: 'MGVCL',
    consumerNo: 'MGVCL-BRD-551209',
    sanctionedLoadKw: 5.0,
    solarSystemKw: 4.4,
    roofType: 'RCC Flat Terrace',
    staffId: 'STF-004',
    staffName: 'Bhavin Shah',
    createdDate: '2026-09-25',
    status: 'Sourced',
    applicationNo: 'Draft Pending',
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_anil_mehta.pdf', date: '2026-09-25' },
      lightBill: { uploaded: true, filename: 'mgvcl_bill_aug.pdf', date: '2026-09-25' },
      meterPhoto: { uploaded: false, filename: null, date: null },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: false, filename: null, date: null }
    }
  }
];

export default function StaffManagement() {
  const { addToast } = useToast();

  const [staffList, setStaffList] = useState(() => {
    const saved = localStorage.getItem('sunvine_staff_list');
    return saved ? JSON.parse(saved) : DEFAULT_STAFF;
  });

  const [filesList, setFilesList] = useState(() => {
    const saved = localStorage.getItem('sunvine_customer_files');
    return saved ? JSON.parse(saved) : DEFAULT_FILES;
  });

  useEffect(() => {
    localStorage.setItem('sunvine_staff_list', JSON.stringify(staffList));
  }, [staffList]);

  useEffect(() => {
    localStorage.setItem('sunvine_customer_files', JSON.stringify(filesList));
  }, [filesList]);

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

  // New Staff Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Field Sales Executive');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffZone, setNewStaffZone] = useState('Ahmedabad & Gandhinagar (UGVCL)');

  // New File Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustDiscom, setNewCustDiscom] = useState('UGVCL');
  const [newCustConsumerNo, setNewCustConsumerNo] = useState('');
  const [newCustLoad, setNewCustLoad] = useState('5.0');
  const [newCustSolarKw, setNewCustSolarKw] = useState('4.4');
  const [newCustStaffId, setNewCustStaffId] = useState(staffList[0]?.id || 'STF-001');

  // Document Upload Handlers
  const handleUploadDoc = (fileId, docKey, filename = 'document.pdf') => {
    setFilesList(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const updatedDocs = {
        ...f.documents,
        [docKey]: {
          uploaded: true,
          filename: filename || `${docKey}_uploaded.pdf`,
          date: new Date().toISOString().split('T')[0]
        }
      };
      return { ...f, documents: updatedDocs };
    }));

    if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
      setSelectedFileForDocs(prev => ({
        ...prev,
        documents: {
          ...prev.documents,
          [docKey]: {
            uploaded: true,
            filename: filename || `${docKey}_uploaded.pdf`,
            date: new Date().toISOString().split('T')[0]
          }
        }
      }));
    }

    addToast(`Document uploaded successfully: ${docKey}`, 'success');
  };

  const handleUpdateFileStatus = (fileId, nextStatus) => {
    setFilesList(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, status: nextStatus };
    }));
    if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
      setSelectedFileForDocs(prev => ({ ...prev, status: nextStatus }));
    }
    addToast(`File ${fileId} moved to "${nextStatus}"`, 'success');
  };

  const handleCreateStaff = (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPhone.trim()) {
      addToast('Please provide Name and Mobile Number', 'error');
      return;
    }
    const newId = `STF-${String(staffList.length + 1).padStart(3, '0')}`;
    const newStaff = {
      id: newId,
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone.trim(),
      email: newStaffEmail.trim() || `${newStaffName.toLowerCase().replace(/\s+/g, '.')}@sunvine.in`,
      zone: newStaffZone,
      totalFiles: 0,
      registeredFiles: 0,
      subsidizedFiles: 0,
      pipelineKw: 0,
      status: 'Active'
    };
    setStaffList(prev => [newStaff, ...prev]);
    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    addToast(`Staff member "${newStaff.name}" added successfully!`, 'success');
  };

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      addToast('Please provide Customer Name and Mobile', 'error');
      return;
    }
    const assignedStaff = staffList.find(s => s.id === newCustStaffId) || staffList[0];
    const newFileId = `FIL-2026-${String(filesList.length + 85).padStart(3, '0')}`;
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

    setFilesList(prev => [newFile, ...prev]);
    // Increment staff total
    setStaffList(prev => prev.map(s => s.id === assignedStaff.id ? { ...s, totalFiles: s.totalFiles + 1, pipelineKw: s.pipelineKw + newFile.solarSystemKw } : s));

    setShowAddFileModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustConsumerNo('');
    addToast(`New file ${newFileId} created for ${newFile.customerName}!`, 'success');
  };

  // Filtered files
  const filteredFiles = filesList.filter(f => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      f.customerName.toLowerCase().includes(term) ||
      f.consumerNo.toLowerCase().includes(term) ||
      f.phone.includes(term) ||
      f.id.toLowerCase().includes(term) ||
      f.staffName.toLowerCase().includes(term);

    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    const matchStaff = staffFilter === 'all' || f.staffId === staffFilter;

    return matchSearch && matchStatus && matchStaff;
  });

  // Pipeline stats
  const totalFilesCount = filesList.length;
  const sourcedCount = filesList.filter(f => f.status === 'Sourced').length;
  const verificationCount = filesList.filter(f => f.status === 'Verification').length;
  const registeredCount = filesList.filter(f => f.status === 'DISCOM Registered').length;
  const subsidizedCount = filesList.filter(f => f.status === 'Subsidized').length;
  const totalKwSum = filesList.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

  return (
    <div className="min-h-screen bg-[#070D18] text-white p-4 md:p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-primary-container">badge</span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Sales Team &amp; Customer Files (सेल्स टीम और फाइल प्रबंधन)
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Field sales tracking, customer document vault (Aadhaar, Light Bill, Meter &amp; Site Photos) and DISCOM registration pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Add Staff (स्टाफ जोड़ें)</span>
            </button>
            <button
              onClick={() => setShowAddFileModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">note_add</span>
              <span>New Customer File (नई फाइल)</span>
            </button>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#0D1527] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-400">Total Staff (टीम)</div>
            <div className="text-2xl font-bold text-white mt-1">{staffList.length}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              All Active
            </div>
          </div>
          <div className="bg-[#0D1527] border border-white/10 rounded-xl p-4">
            <div className="text-xs text-slate-400">Total Files (कुल फाइलें)</div>
            <div className="text-2xl font-bold text-white mt-1">{totalFilesCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">{totalKwSum} kW Pipeline</div>
          </div>
          <div className="bg-[#0D1527] border border-amber-500/20 rounded-xl p-4 bg-amber-500/5">
            <div className="text-xs text-amber-300">Sourced / Leads</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{sourcedCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Initial Contact</div>
          </div>
          <div className="bg-[#0D1527] border border-blue-500/20 rounded-xl p-4 bg-blue-500/5">
            <div className="text-xs text-blue-300">Verification</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">{verificationCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Docs In-Progress</div>
          </div>
          <div className="bg-[#0D1527] border border-purple-500/20 rounded-xl p-4 bg-purple-500/5">
            <div className="text-xs text-purple-300">DISCOM Registered</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">{registeredCount}</div>
            <div className="text-[11px] text-purple-300 mt-1">Application Logged</div>
          </div>
          <div className="bg-[#0D1527] border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/5">
            <div className="text-xs text-emerald-300">Subsidized / Done</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{subsidizedCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1">DBT Approved</div>
          </div>
        </div>

        {/* View Switcher: Files vs Staff Directory */}
        <div className="flex border-b border-white/10 gap-8">
          <button
            onClick={() => setActiveView('files')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeView === 'files'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder</span>
            <span>Customer Files &amp; Document Vault (ग्राहक फाइलें)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{filesList.length}</span>
          </button>
          <button
            onClick={() => setActiveView('staff')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeView === 'staff'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span>Sales Team Directory (सेल्स टीम डायरेक्टरी)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{staffList.length}</span>
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
                  { key: 'DISCOM Registered', label: 'DISCOM Registered (पंजीकृत)' },
                  { key: 'Subsidized', label: 'Subsidized (सब्सिडी स्वीकृत)' }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
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
                  className="bg-[#070D18] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                >
                  <option value="all">All Sales Staff (सभी स्टाफ)</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.zone.split(' ')[0]})</option>
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
                          <span className="text-[11px] text-slate-400 block truncate">{file.consumerNo}</span>
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
                          <span>{file.phone}</span>
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

                      {/* Document Badges */}
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-400">Uploaded Documents</span>
                          <span className="font-semibold text-emerald-400">{docsCount} / 5 Complete</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 text-center">
                          {[
                            { key: 'aadhaar', label: 'Aadhaar', icon: 'badge' },
                            { key: 'lightBill', label: 'Bill', icon: 'receipt' },
                            { key: 'meterPhoto', label: 'Meter', icon: 'speed' },
                            { key: 'sitePhoto', label: 'Site', icon: 'photo_camera' },
                            { key: 'bankPassbook', label: 'Bank', icon: 'account_balance' }
                          ].map(doc => {
                            const isUp = file.documents?.[doc.key]?.uploaded;
                            return (
                              <div
                                key={doc.key}
                                title={`${doc.label}: ${isUp ? 'Uploaded' : 'Missing'}`}
                                className={`py-1.5 rounded flex flex-col items-center justify-center text-[10px] border transition-all ${
                                  isUp
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-slate-500'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">{doc.icon}</span>
                                <span className="text-[9px] mt-0.5">{doc.label}</span>
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
                        className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-[15px] text-emerald-400">upload_file</span>
                        <span>Manage Documents</span>
                      </button>

                      {/* Quick Status Advance */}
                      <select
                        value={file.status}
                        onChange={e => handleUpdateFileStatus(file.id, e.target.value)}
                        className="bg-[#070D18] border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-emerald-400"
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

        {/* VIEW 2: SALES TEAM DIRECTORY */}
        {activeView === 'staff' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {staffList.map(member => (
                <div
                  key={member.id}
                  className="bg-[#0D1527] border border-white/10 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-lg">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{member.name}</h3>
                        <p className="text-xs text-slate-400">{member.role}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-[15px]">call</span>
                        <span>{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-[15px]">mail</span>
                        <span>{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-[15px]">location_on</span>
                        <span>{member.zone}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                        <div className="text-slate-400 text-[10px]">Active Files</div>
                        <div className="font-bold text-emerald-400 text-sm mt-0.5">{member.totalFiles} Files</div>
                      </div>
                      <div className="bg-[#070D18] p-2 rounded-lg border border-white/5">
                        <div className="text-slate-400 text-[10px]">Pipeline Capacity</div>
                        <div className="font-bold text-blue-400 text-sm mt-0.5">{member.pipelineKw} kW</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold">{member.subsidizedFiles} Subsidies Released</span>
                    <button
                      onClick={() => {
                        setStaffFilter(member.id);
                        setActiveView('files');
                      }}
                      className="text-primary-container hover:underline text-xs flex items-center gap-0.5"
                    >
                      <span>View Files</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              ))}
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
                <span>Add Sales Executive (नया सेल्स स्टाफ)</span>
              </h2>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-white"
              >
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Designation / Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Field Sales Executive">Field Sales Executive (फील्ड सेल्स)</option>
                  <option value="Area Sales Manager">Area Sales Manager (एरिया सेल्स मैनेजर)</option>
                  <option value="Verification Officer">Verification Officer (सत्यापन अधिकारी)</option>
                  <option value="Senior Solar Consultant">Senior Solar Consultant (सीनियर सोलर कंसलटेंट)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number (मोबाइल नंबर) *</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={e => setNewStaffPhone(e.target.value)}
                  placeholder="+91 98250 12345"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email ID</label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={e => setNewStaffEmail(e.target.value)}
                  placeholder="suresh@sunvine.in"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Zone / Territory (क्षेत्र)</label>
                <select
                  value={newStaffZone}
                  onChange={e => setNewStaffZone(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Ahmedabad & Gandhinagar (UGVCL)">Ahmedabad &amp; Gandhinagar (UGVCL)</option>
                  <option value="Rajkot & Saurashtra (PGVCL)">Rajkot &amp; Saurashtra (PGVCL)</option>
                  <option value="Surat & South Gujarat (DGVCL)">Surat &amp; South Gujarat (DGVCL)</option>
                  <option value="Vadodara & Anand (MGVCL)">Vadodara &amp; Anand (MGVCL)</option>
                  <option value="Torrent Power Zone (Ahmedabad/Surat)">Torrent Power Zone (Ahmedabad/Surat)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20"
                >
                  Save &amp; Onboard Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW CUSTOMER FILE */}
      {showAddFileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">note_add</span>
                <span>Create Customer Solar File (नई ग्राहक फाइल)</span>
              </h2>
              <button
                onClick={() => setShowAddFileModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name (ग्राहक का नाम) *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="e.g. Bharatbhai M. Patel"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number (मोबाइल) *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="+91 98250 99881"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Site Address (साइट का पता)</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Plot 10, Suryam Residency, Near Ring Road, Ahmedabad"
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">DISCOM (बिजली वितरण कंपनी)</label>
                  <select
                    value={newCustDiscom}
                    onChange={e => setNewCustDiscom(e.target.value)}
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Consumer / Service No</label>
                  <input
                    type="text"
                    value={newCustConsumerNo}
                    onChange={e => setNewCustConsumerNo(e.target.value)}
                    placeholder="e.g. 03901/12345/6"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
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
                    placeholder="5.0"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Proposed Solar (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCustSolarKw}
                    onChange={e => setNewCustSolarKw(e.target.value)}
                    placeholder="4.4"
                    className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assign Sales Representative (स्टाफ चुनें)</label>
                <select
                  value={newCustStaffId}
                  onChange={e => setNewCustStaffId(e.target.value)}
                  className="w-full bg-[#070D18] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.zone}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddFileModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20"
                >
                  Create &amp; Open Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DOCUMENT VAULT & PHOTO INSPECTOR */}
      {selectedFileForDocs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">{selectedFileForDocs.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    {selectedFileForDocs.discom}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {selectedFileForDocs.customerName} - Document Vault (दस्तावेज़ तिजोरी)
                </h2>
                <p className="text-xs text-slate-400">
                  Consumer No: <strong className="text-slate-200">{selectedFileForDocs.consumerNo}</strong> | System: <strong className="text-emerald-400">{selectedFileForDocs.solarSystemKw} kW</strong> | Staff: <strong className="text-slate-200">{selectedFileForDocs.staffName}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Document Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: 'aadhaar',
                  title: 'Aadhaar Card (आधार कार्ड)',
                  desc: 'Government ID of applicant for PM Surya Ghar portal verification',
                  icon: 'badge',
                  badge: 'Identity Proof'
                },
                {
                  key: 'lightBill',
                  title: 'Electricity / Light Bill (बिजली बिल)',
                  desc: 'Latest monthly electricity bill verifying Consumer No & Sanctioned Load',
                  icon: 'receipt',
                  badge: 'DISCOM Proof'
                },
                {
                  key: 'meterPhoto',
                  title: 'Electricity Meter Photo (मीटर फोटो)',
                  desc: 'Clear photograph of existing DISCOM meter showing serial & reading',
                  icon: 'speed',
                  badge: 'Physical Inspection'
                },
                {
                  key: 'sitePhoto',
                  title: 'Rooftop / Site Photo (छत की फोटो)',
                  desc: 'Wide-angle clear photo showing parapet, open shadow-free terrace area',
                  icon: 'photo_camera',
                  badge: 'Feasibility'
                },
                {
                  key: 'bankPassbook',
                  title: 'Bank Passbook / Cheque (पासबुक)',
                  desc: 'Bank account details with IFSC code for Direct Benefit Transfer (DBT) subsidy',
                  icon: 'account_balance',
                  badge: 'Subsidy DBT'
                }
              ].map(item => {
                const doc = selectedFileForDocs.documents?.[item.key];
                const isUploaded = doc?.uploaded;

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isUploaded
                        ? 'bg-[#070D18] border-emerald-500/30'
                        : 'bg-[#070D18]/50 border-white/10 border-dashed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-lg ${isUploaded ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {item.icon}
                          </span>
                          <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isUploaded
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isUploaded ? 'Verified / Uploaded' : 'Pending Upload'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{item.desc}</p>

                      {isUploaded && (
                        <div className="mt-3 bg-white/5 p-2 rounded-lg text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                            <span className="truncate text-slate-300">{doc.filename}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">{doc.date}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      {isUploaded ? (
                        <>
                          <button
                            onClick={() => setPreviewDoc({ ...item, ...doc })}
                            className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                          >
                            <span className="material-symbols-outlined text-[15px]">visibility</span>
                            <span>View Preview</span>
                          </button>
                          <label className="cursor-pointer text-xs text-slate-400 hover:text-white flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">refresh</span>
                            <span>Replace</span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadDoc(selectedFileForDocs.id, item.key, f.name);
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="w-full py-2 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all">
                          <span className="material-symbols-outlined text-[16px]">file_upload</span>
                          <span>Upload File or Photo</span>
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

            {/* Quick Status Bar */}
            <div className="bg-[#070D18] p-4 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-400">Current Pipeline Stage:</span>
                <div className="text-sm font-bold text-white mt-0.5">{selectedFileForDocs.status}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateFileStatus(selectedFileForDocs.id, 'Verification')}
                  className="px-3 py-1.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-semibold rounded-lg border border-blue-500/30"
                >
                  Verify Documents
                </button>
                <button
                  onClick={() => handleUpdateFileStatus(selectedFileForDocs.id, 'DISCOM Registered')}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs font-semibold rounded-lg border border-purple-500/30"
                >
                  Register on DISCOM
                </button>
                <button
                  onClick={() => handleUpdateFileStatus(selectedFileForDocs.id, 'Subsidized')}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold rounded-lg border border-emerald-500/30"
                >
                  Approve Subsidy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-white/20 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">description</span>
                <span>{previewDoc.title}</span>
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-[#070D18] border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">verified</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{previewDoc.filename}</p>
                <p className="text-xs text-slate-400 mt-1">Uploaded Date: {previewDoc.date}</p>
                <p className="text-xs text-emerald-400 mt-0.5">Digitally verified for GEDA &amp; PM Surya Ghar DISCOM submission</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
