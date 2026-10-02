import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { adminAccountService } from '../../services/adminAccountService';

export default function AdminSettings() {
  const { currentAdmin, setStaffList, setDealers } = useApp();

  // Primary Settings Page Tabs: 'account_center' | 'security' | 'system'
  const [settingsTab, setSettingsTab] = useState('account_center');

  // Account Center Sub-Tabs: 'admins' | 'dealers' | 'staff'
  const [accountSubTab, setAccountSubTab] = useState('admins');

  // Live Accounts State from PostgreSQL
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [adminsList, setAdminsList] = useState([]);
  const [dealersList, setDealersList] = useState([]);
  const [staffListState, setStaffListState] = useState([]);

  // Filters & Search
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | 'sales' | 'verification'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    role: 'admin',
    password: ''
  });

  const [showDealerModal, setShowDealerModal] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [dealerForm, setDealerForm] = useState({
    id: '',
    dealerCode: '',
    firmName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    discom: 'UGVCL',
    tier: 'Gold EPC',
    maxMarginCapPerKw: 6000,
    status: 'Active',
    password: ''
  });

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    department: 'Sales',
    role: 'Senior Solar Field Executive',
    status: 'Active',
    password: ''
  });

  // Password Update Modal
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    accountType: '', // 'admin' | 'dealer' | 'staff'
    account: null,
    newPassword: '',
    confirmPassword: '',
    showPass: false
  });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    accountType: '', // 'admin' | 'dealer' | 'staff'
    account: null
  });

  const [submitting, setSubmitting] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(''), 4500);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  // Fetch live accounts from PostgreSQL
  const loadAccounts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await adminAccountService.fetchAccounts();
      setAdminsList(data.admins || []);
      setDealersList(data.dealers || []);
      setStaffListState(data.staff || []);

      if (typeof setStaffList === 'function' && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
      if (typeof setDealers === 'function' && Array.isArray(data.dealers)) {
        setDealers(data.dealers.map(d => ({
          ...d,
          mobile: d.mobile_number || d.mobile,
          firmName: d.firm_name || d.firmName,
          contactPerson: d.contact_person || d.contactPerson
        })));
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to PostgreSQL database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Filtered lists
  const filteredAdmins = useMemo(() => {
    if (!searchQuery.trim()) return adminsList;
    const q = searchQuery.toLowerCase();
    return adminsList.filter(a =>
      (a.full_name || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.mobile_number || '').includes(q)
    );
  }, [adminsList, searchQuery]);

  const filteredDealers = useMemo(() => {
    if (!searchQuery.trim()) return dealersList;
    const q = searchQuery.toLowerCase();
    return dealersList.filter(d =>
      (d.firm_name || d.firmName || '').toLowerCase().includes(q) ||
      (d.contact_person || d.contactPerson || '').toLowerCase().includes(q) ||
      (d.mobile_number || d.mobile || '').includes(q) ||
      (d.dealer_code || d.dealerCode || '').toLowerCase().includes(q)
    );
  }, [dealersList, searchQuery]);

  const filteredStaff = useMemo(() => {
    return staffListState.filter(s => {
      const isVer = (s.department || '').toLowerCase().includes('verification') || (s.role || '').toLowerCase().includes('verification');
      const matchesFilter =
        staffFilter === 'all'
          ? true
          : staffFilter === 'verification'
          ? isVer
          : !isVer;

      if (!matchesFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q)
      );
    });
  }, [staffListState, staffFilter, searchQuery]);

  // Admin Modal Handlers
  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      role: 'admin',
      password: ''
    });
    setError('');
    setShowAdminModal(true);
  };

  const handleOpenEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setAdminForm({
      fullName: admin.full_name || '',
      email: admin.email || '',
      mobileNumber: admin.mobile_number || '',
      role: admin.role || 'admin',
      password: ''
    });
    setError('');
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.fullName.trim() || !adminForm.email.trim()) {
      setError('Full Name and Email are required.');
      return;
    }
    const cleanMobile = adminForm.mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    if (!editingAdmin && !adminForm.password.trim()) {
      setError('Password is required for new admin account.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingAdmin) {
        const res = await adminAccountService.updateAdmin({
          id: editingAdmin.id,
          fullName: adminForm.fullName,
          email: adminForm.email,
          mobileNumber: cleanMobile,
          role: adminForm.role,
          password: adminForm.password ? adminForm.password.trim() : undefined
        });
        if (!res.success) throw new Error(res.error || 'Failed to update admin');
        setSuccessToast(`Admin ${adminForm.fullName} updated in live database.`);
      } else {
        const res = await adminAccountService.createAdmin({
          fullName: adminForm.fullName,
          email: adminForm.email,
          mobileNumber: cleanMobile,
          role: adminForm.role,
          password: adminForm.password.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to create admin');
        setSuccessToast(`Admin ${adminForm.fullName} created in live database.`);
      }

      setShowAdminModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dealer Modal Handlers
  const handleOpenAddDealer = () => {
    setEditingDealer(null);
    const nextCode = `SV-DLR-${String(Math.floor(8000 + Math.random() * 900))}`;
    setDealerForm({
      id: nextCode,
      dealerCode: nextCode,
      firmName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      city: 'Ahmedabad',
      state: 'Gujarat',
      discom: 'UGVCL',
      tier: 'Gold EPC',
      maxMarginCapPerKw: 6000,
      status: 'Active',
      password: ''
    });
    setError('');
    setShowDealerModal(true);
  };

  const handleOpenEditDealer = (dealer) => {
    setEditingDealer(dealer);
    setDealerForm({
      id: dealer.id || dealer.dealer_code,
      dealerCode: dealer.dealer_code || dealer.dealerCode || dealer.id,
      firmName: dealer.firm_name || dealer.firmName || '',
      contactPerson: dealer.contact_person || dealer.contactPerson || '',
      mobile: dealer.mobile_number || dealer.mobile || '',
      email: dealer.email || '',
      city: dealer.city || 'Ahmedabad',
      state: dealer.state || 'Gujarat',
      discom: dealer.discom || 'UGVCL',
      tier: dealer.tier || 'Gold EPC',
      maxMarginCapPerKw: dealer.max_margin_cap_per_kw || dealer.maxMarginCapPerKw || 6000,
      status: dealer.status || 'Active',
      password: ''
    });
    setError('');
    setShowDealerModal(true);
  };

  const handleSaveDealer = async (e) => {
    e.preventDefault();
    if (!dealerForm.firmName.trim() || !dealerForm.contactPerson.trim()) {
      setError('Firm Name and Contact Person are required.');
      return;
    }
    const cleanMobile = dealerForm.mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    if (!editingDealer && !dealerForm.password.trim()) {
      setError('Initial password is required for new dealer.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingDealer) {
        const res = await adminAccountService.updateDealer({
          id: editingDealer.id,
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email || `${cleanMobile}@sunvinedealer.in`,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password ? dealerForm.password.trim() : undefined
        });
        if (!res.success) throw new Error(res.error || 'Failed to update dealer');
        setSuccessToast(`Dealer ${dealerForm.firmName} updated in live database.`);
      } else {
        const res = await adminAccountService.createDealer({
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email || `${cleanMobile}@sunvinedealer.in`,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to create dealer');
        setSuccessToast(`Dealer ${dealerForm.firmName} created in live database.`);
      }

      setShowDealerModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Staff Modal Handlers
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    const nextCode = `STF-${String(staffListState.length + 802).padStart(3, '0')}`;
    setStaffForm({
      id: nextCode,
      name: '',
      phone: '',
      email: '',
      department: 'Sales',
      role: 'Senior Solar Field Executive',
      status: 'Active',
      password: ''
    });
    setError('');
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    const isVer = (staff.department || '').toLowerCase().includes('verification') || (staff.role || '').toLowerCase().includes('verification');
    setStaffForm({
      id: staff.id,
      name: staff.name || '',
      phone: staff.phone || '',
      email: staff.email || '',
      department: isVer ? 'Verification' : 'Sales',
      role: staff.role || (isVer ? 'Field Verification Officer' : 'Senior Solar Field Executive'),
      status: staff.status || 'Active',
      password: ''
    });
    setError('');
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) {
      setError('Staff Name is required.');
      return;
    }
    const cleanPhone = staffForm.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError('Valid 10-digit mobile number is required.');
      return;
    }
    if (!editingStaff && !staffForm.password.trim()) {
      setError('Password is required for new staff account.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (editingStaff) {
        const res = await adminAccountService.updateStaff({
          id: editingStaff.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email || `${cleanPhone}@sunvine.in`,
          department: staffForm.department,
          role: staffForm.role,
          status: staffForm.status,
          password: staffForm.password ? staffForm.password.trim() : undefined
        });
        if (!res.success) throw new Error(res.error || 'Failed to update staff');
        setSuccessToast(`Staff ${staffForm.name} updated in live database.`);
      } else {
        const res = await adminAccountService.createStaff({
          id: staffForm.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email || `${cleanPhone}@sunvine.in`,
          department: staffForm.department,
          role: staffForm.role,
          status: staffForm.status,
          password: staffForm.password.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to create staff');
        setSuccessToast(`Staff ${staffForm.name} created in live database.`);
      }

      setShowStaffModal(false);
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Password Reset Handlers
  const handleOpenPasswordModal = (type, account) => {
    setPasswordModal({
      isOpen: true,
      accountType: type,
      account,
      newPassword: '',
      confirmPassword: '',
      showPass: false
    });
    setError('');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!passwordModal.newPassword.trim()) {
      setError('Password cannot be empty.');
      return;
    }
    if (passwordModal.newPassword !== passwordModal.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (passwordModal.accountType === 'admin') {
        const res = await adminAccountService.updateAdmin({
          id: passwordModal.account.id,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update admin password.');
        setSuccessToast(`Password updated for Admin ${passwordModal.account.full_name} in live database.`);
      } else if (passwordModal.accountType === 'dealer') {
        const res = await adminAccountService.updateDealer({
          id: passwordModal.account.id,
          dealerCode: passwordModal.account.dealer_code || passwordModal.account.dealerCode,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update dealer password.');
        setSuccessToast(`Password updated for Dealer ${passwordModal.account.firm_name || passwordModal.account.firmName} in live database.`);
      } else {
        const res = await adminAccountService.updateStaff({
          id: passwordModal.account.id,
          password: passwordModal.newPassword.trim()
        });
        if (!res.success) throw new Error(res.error || 'Failed to update staff password.');
        setSuccessToast(`Password updated for Staff ${passwordModal.account.name} in live database.`);
      }

      setPasswordModal({ isOpen: false, accountType: '', account: null, newPassword: '', confirmPassword: '', showPass: false });
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Password update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (type, account) => {
    if (type === 'admin' && adminsList.length <= 1) {
      setError('Cannot delete the only remaining admin account.');
      return;
    }
    setDeleteModal({
      isOpen: true,
      accountType: type,
      account
    });
    setError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.account) return;
    setSubmitting(true);
    setError('');

    try {
      if (deleteModal.accountType === 'admin') {
        const res = await adminAccountService.deleteAdmin(deleteModal.account.id);
        if (!res.success) throw new Error(res.error || 'Failed to delete admin');
        setSuccessToast(`Admin ${deleteModal.account.full_name} removed from live database.`);
      } else if (deleteModal.accountType === 'dealer') {
        const targetId = deleteModal.account.dealer_code || deleteModal.account.dealerCode || deleteModal.account.id;
        const res = await adminAccountService.deleteDealer(targetId);
        if (!res.success) throw new Error(res.error || 'Failed to delete dealer');
        setSuccessToast(`Dealer ${deleteModal.account.firm_name || deleteModal.account.firmName} removed from live database.`);
      } else {
        const res = await adminAccountService.deleteStaff(deleteModal.account.id);
        if (!res.success) throw new Error(res.error || 'Failed to delete staff');
        setSuccessToast(`Staff ${deleteModal.account.name} removed from live database.`);
      }

      setDeleteModal({ isOpen: false, accountType: '', account: null });
      await loadAccounts(true);
    } catch (err) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl transition-all animate-bounce">
          <span className="material-symbols-outlined text-white text-xl">check_circle</span>
          <p className="text-sm font-semibold">{successToast}</p>
          <button
            onClick={() => setSuccessToast('')}
            className="text-emerald-100 hover:text-white cursor-pointer ml-2"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span>Admin Console</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure system settings, security, and live database account credentials.
          </p>
        </div>

        {/* Status Chip & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>PostgreSQL Live Sync</span>
          </div>

          <button
            onClick={() => loadAccounts(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Reload live records from database"
          >
            <span className={`material-symbols-outlined text-sm text-slate-500 ${refreshing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{refreshing ? 'Syncing...' : 'Sync Live DB'}</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 cursor-pointer">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ========================================================
          PRIMARY SETTINGS TABS (Extensible for Future Settings)
          ======================================================== */}
      <div className="border-b border-slate-200 flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => setSettingsTab('account_center')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'account_center'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">manage_accounts</span>
          <span>Account Center</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold ml-1">
            {adminsList.length + dealersList.length + staffListState.length}
          </span>
        </button>

        <button
          onClick={() => setSettingsTab('security')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'security'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">security</span>
          <span>Security &amp; Policies</span>
        </button>

        <button
          onClick={() => setSettingsTab('system')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            settingsTab === 'system'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-sm rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-lg">tune</span>
          <span>System &amp; Presets</span>
        </button>
      </div>

      {/* ========================================================
          TAB CONTENT: 1. ACCOUNT CENTER (Live Database Management)
          ======================================================== */}
      {settingsTab === 'account_center' && (
        <div className="space-y-6">
          {/* Key Metric Highlights in Clean Enterprise Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setAccountSubTab('admins')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'admins'
                  ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Super Admins</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{adminsList.length}</div>
                  <div className="text-xs text-purple-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    HO System Authority
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setAccountSubTab('dealers')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'dealers'
                  ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">EPC Dealers</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{dealersList.length}</div>
                  <div className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">handshake</span>
                    Authorized Partners
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">apartment</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setAccountSubTab('staff')}
              className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                accountSubTab === 'staff'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff &amp; Desk</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{staffListState.length}</div>
                  <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    Sales &amp; Verification Team
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">badge</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Sub-Tabs Header (Admins / Dealers / Staff) + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setAccountSubTab('admins')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'admins'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                <span>Admins ({adminsList.length})</span>
              </button>

              <button
                onClick={() => setAccountSubTab('dealers')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'dealers'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">apartment</span>
                <span>Dealers ({dealersList.length})</span>
              </button>

              <button
                onClick={() => setAccountSubTab('staff')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  accountSubTab === 'staff'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">groups</span>
                <span>Staff ({staffListState.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative min-w-0 sm:w-60">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder={`Search ${accountSubTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Add Action Button */}
              {accountSubTab === 'admins' && (
                <button
                  onClick={handleOpenAddAdmin}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  <span>New Admin</span>
                </button>
              )}

              {accountSubTab === 'dealers' && (
                <button
                  onClick={handleOpenAddDealer}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">add_business</span>
                  <span>New Dealer</span>
                </button>
              )}

              {accountSubTab === 'staff' && (
                <button
                  onClick={handleOpenAddStaff}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm">group_add</span>
                  <span>New Staff</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================
              SUB-TAB 1: ADMIN ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'admins' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                  <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">no_accounts</span>
                  <p className="text-sm font-medium">No admin accounts found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Administrator</th>
                        <th className="py-3 px-4">Mobile Number</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Database State</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAdmins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                                {(admin.full_name || 'A').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{admin.full_name}</span>
                                  {admin.email === currentAdmin?.email && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                      Current Session
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">ID: {admin.id.slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                              <span>{admin.mobile_number || '8000050580'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                            {admin.email}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              admin.role === 'super_admin'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              <span className="material-symbols-outlined text-xs">
                                {admin.role === 'super_admin' ? 'stars' : 'shield_person'}
                              </span>
                              <span>{admin.role === 'super_admin' ? 'Super Admin' : 'Admin Officer'}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Bcrypt Verified
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Password Button */}
                              <button
                                onClick={() => handleOpenPasswordModal('admin', admin)}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                title="Change Password"
                              >
                                <span className="material-symbols-outlined text-sm">key</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditAdmin(admin)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                title="Edit Admin"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleOpenDelete('admin', admin)}
                                disabled={adminsList.length <= 1}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={adminsList.length <= 1 ? 'Cannot delete the only admin' : 'Delete Admin'}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              SUB-TAB 2: DEALER ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'dealers' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                  <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                </div>
              ) : filteredDealers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">storefront</span>
                  <p className="text-sm font-medium">No dealer partners found in database.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Dealer Partner / Firm</th>
                        <th className="py-3 px-4">Mobile Number</th>
                        <th className="py-3 px-4">City / DISCOM</th>
                        <th className="py-3 px-4">Partner Tier</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDealers.map((dealer) => {
                        const firm = dealer.firm_name || dealer.firmName || 'Dealer Firm';
                        const contact = dealer.contact_person || dealer.contactPerson || 'Authorized Person';
                        const code = dealer.dealer_code || dealer.dealerCode || dealer.id;
                        const mobile = dealer.mobile_number || dealer.mobile || '8000050580';
                        return (
                          <tr key={dealer.id || code} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
                                  {firm.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{firm}</div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span>{contact}</span>
                                    <span>•</span>
                                    <span className="font-mono text-emerald-700 font-semibold">{code}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                                <span>{mobile}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-slate-900 font-medium">{dealer.city || 'Ahmedabad'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{dealer.discom || 'UGVCL'} Circle</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="material-symbols-outlined text-xs">workspace_premium</span>
                                <span>{dealer.tier || 'Gold EPC'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>Active in DB</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Password Button */}
                                <button
                                  onClick={() => handleOpenPasswordModal('dealer', dealer)}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                  title="Change Dealer Password"
                                >
                                  <span className="material-symbols-outlined text-sm">key</span>
                                </button>

                                {/* Edit Button */}
                                <button
                                  onClick={() => handleOpenEditDealer(dealer)}
                                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                  title="Edit Dealer Profile"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleOpenDelete('dealer', dealer)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                                  title="Delete Dealer"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              SUB-TAB 3: STAFF ACCOUNTS TABLE
              ======================================================== */}
          {accountSubTab === 'staff' && (
            <div className="space-y-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: `All Staff (${staffListState.length})` },
                  { id: 'sales', label: `Field Sales (${staffListState.filter(s => !(s.department || '').toLowerCase().includes('verification') && !(s.role || '').toLowerCase().includes('verification')).length})` },
                  { id: 'verification', label: `Verification Desk (${staffListState.filter(s => (s.department || '').toLowerCase().includes('verification') || (s.role || '').toLowerCase().includes('verification')).length})` }
                ].map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => setStaffFilter(pill.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                      staffFilter === pill.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl animate-spin text-emerald-600">sync</span>
                    <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">person_off</span>
                    <p className="text-sm font-medium">No staff members found matching filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Staff Member</th>
                          <th className="py-3 px-4">Mobile Number</th>
                          <th className="py-3 px-4">Department &amp; Role</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStaff.map((staff) => {
                          const isVer = (staff.department || '').toLowerCase().includes('verification') || (staff.role || '').toLowerCase().includes('verification');
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm ${
                                    isVer ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {(staff.name || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{staff.name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono">ID: {staff.id}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-slate-400 text-sm">phone_iphone</span>
                                  <span>{staff.phone || '8000050580'}</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div>
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    isVer
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    <span className="material-symbols-outlined text-xs">
                                      {isVer ? 'fact_check' : 'campaign'}
                                    </span>
                                    <span>{isVer ? 'Verification Desk' : 'Field Sales'}</span>
                                  </span>
                                  <div className="text-xs text-slate-500 mt-1">{staff.role}</div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                                {staff.email}
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>Active in DB</span>
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Password Button */}
                                  <button
                                    onClick={() => handleOpenPasswordModal('staff', staff)}
                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all cursor-pointer"
                                    title="Change Password"
                                  >
                                    <span className="material-symbols-outlined text-sm">key</span>
                                  </button>

                                  {/* Edit Button */}
                                  <button
                                    onClick={() => handleOpenEditStaff(staff)}
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                                    title="Edit Staff Profile"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    onClick={() => handleOpenDelete('staff', staff)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                                    title="Delete Staff"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB CONTENT: 2. SECURITY & POLICIES (Future Tab Placeholder)
          ======================================================== */}
      {settingsTab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">shield</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base">Security &amp; Policy Governance</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Two-factor authentication, distributed rate limiting, session TTL policies, and audit trails are active via server security middleware.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <span className="material-symbols-outlined text-sm">lock</span>
            Bcrypt Hashing &amp; JWT HTTP-Only Cookies Active
          </div>
        </div>
      )}

      {/* ========================================================
          TAB CONTENT: 3. SYSTEM & PRESETS (Future Tab Placeholder)
          ======================================================== */}
      {settingsTab === 'system' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">settings_system_daydream</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base">System Settings &amp; Presets</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hardware matrix, BOS benchmark pricing, and DISCOM presets are dynamically configured via Hardware &amp; Pricing Master consoles.
          </p>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT ADMIN
          ======================================================== */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">admin_panel_settings</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingAdmin ? 'Edit Administrator Profile' : 'Add New Administrator'}
                </h3>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="8000050580"
                    value={adminForm.mobileNumber}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, mobileNumber: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={adminForm.role}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                  >
                    <option value="super_admin">Super Admin Desk</option>
                    <option value="admin">Operations Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@sunvinerenewable.com"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingAdmin ? 'New Password (optional)' : 'Initial Password'}
                </label>
                <input
                  type="text"
                  required={!editingAdmin}
                  placeholder={editingAdmin ? 'Leave blank to keep unchanged' : 'e.g. admin123'}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
                <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingAdmin ? 'Save Changes' : 'Create Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT DEALER
          ======================================================== */}
      {showDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">apartment</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingDealer ? 'Edit Dealer Partner Profile' : 'Onboard New Dealer Partner'}
                </h3>
              </div>
              <button
                onClick={() => setShowDealerModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDealer} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dealer Code</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingDealer)}
                    value={dealerForm.dealerCode}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, dealerCode: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Partner Tier</label>
                  <select
                    value={dealerForm.tier}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, tier: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Diamond EPC">Diamond EPC</option>
                    <option value="Platinum EPC">Platinum EPC</option>
                    <option value="Gold EPC">Gold EPC</option>
                    <option value="Silver Installer">Silver Installer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Firm / Agency Trade Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saur Urja Solutions"
                  value={dealerForm.firmName}
                  onChange={(e) => setDealerForm(prev => ({ ...prev, firmName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nilesh Shah"
                    value={dealerForm.contactPerson}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="8000050580"
                    value={dealerForm.mobile}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Ahmedabad"
                    value={dealerForm.city}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">DISCOM</label>
                  <select
                    value={dealerForm.discom}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, discom: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                    <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                    <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                    <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                    <option value="Torrent Power">Torrent Power</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingDealer ? 'New Password (optional)' : 'Initial Password'}
                </label>
                <input
                  type="text"
                  required={!editingDealer}
                  placeholder={editingDealer ? 'Leave blank to keep unchanged' : 'dealer123'}
                  value={dealerForm.password}
                  onChange={(e) => setDealerForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDealerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingDealer ? 'Save Changes' : 'Onboard Dealer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD / EDIT STAFF
          ======================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">group_add</span>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingStaff ? 'Edit Staff Profile' : 'Add New Staff Member'}
                </h3>
              </div>
              <button
                onClick={() => setShowStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Staff ID</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingStaff)}
                    placeholder="STF-802"
                    value={staffForm.id}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={staffForm.department}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setStaffForm(prev => ({
                        ...prev,
                        department: dept,
                        role: dept === 'Verification' ? 'Field Verification Officer' : 'Senior Solar Field Executive'
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Sales">Field Sales</option>
                    <option value="Verification">Verification Desk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nilesh Vaghela"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits)</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="8000050580"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    required
                    value={staffForm.role}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="staff@sunvine.in"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingStaff ? 'New Password (optional)' : 'Initial Password'}
                </label>
                <input
                  type="text"
                  required={!editingStaff}
                  placeholder={editingStaff ? 'Leave blank to keep unchanged' : (staffForm.department === 'Verification' ? 'desk123' : 'staff123')}
                  value={staffForm.password}
                  onChange={(e) => setStaffForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Saved directly to live PostgreSQL with Bcrypt encryption.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingStaff ? 'Save Changes' : 'Create Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CHANGE PASSWORD (Bcrypt Live)
          ======================================================== */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">key</span>
                <h3 className="font-bold text-slate-900 text-base">
                  Change Password
                </h3>
              </div>
              <button
                onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Updating credentials for{' '}
                <strong className="font-semibold text-slate-900">
                  {passwordModal.account?.full_name || passwordModal.account?.firm_name || passwordModal.account?.firmName || passwordModal.account?.name}
                </strong>
                . Changes are encrypted via Bcrypt and written directly to PostgreSQL.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={passwordModal.showPass ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={passwordModal.newPassword}
                    onChange={(e) => setPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordModal(prev => ({ ...prev, showPass: !prev.showPass }))}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {passwordModal.showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={passwordModal.confirmPassword}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE CONFIRMATION
          ======================================================== */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Delete Account</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">
                  {deleteModal.account?.full_name || deleteModal.account?.firm_name || deleteModal.account?.firmName || deleteModal.account?.name}
                </strong>{' '}
                from the live PostgreSQL database? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, accountType: '', account: null })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
