import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { adminAccountService } from '../../services/adminAccountService';

export default function StaffAccountsManagement() {
  const { addToast } = useToast();
  const { setStaffList } = useApp();

  const [staffListState, setStaffListState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');

  // Modals
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    department: 'Sales',
    role: 'Senior Solar Field Executive',
    city: 'Ahmedabad',
    zone: 'Gujarat Sales Desk',
    status: 'Active',
    password: ''
  });

  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    staff: null,
    newPassword: '',
    confirmPassword: '',
    showPass: false
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    staff: null
  });

  const [submitting, setSubmitting] = useState(false);

  // Load accounts from live DB
  const loadAccounts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminAccountService.fetchAccounts();
      const list = data.staff || [];
      setStaffListState(list);
      if (typeof setStaffList === 'function' && Array.isArray(list)) {
        setStaffList(list);
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: 'Failed to load staff accounts from database', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

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

      const q = searchQuery.toLowerCase().trim();
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || s.mobile_number || '').includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.role || '').toLowerCase().includes(q)
      );
    });
  }, [staffListState, staffFilter, searchQuery]);

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    const existingNums = staffListState.map(s => {
      const m = String(s.id || '').match(/STF-(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 805;
    const nextId = `STF-${String(nextNum).padStart(3, '0')}`;

    setStaffForm({
      id: nextId,
      name: '',
      phone: '',
      email: '',
      department: 'Sales',
      role: 'Senior Solar Field Executive',
      city: 'Ahmedabad',
      zone: 'Gujarat Sales Desk',
      status: 'Active',
      password: 'staff' + Math.floor(100 + Math.random() * 900)
    });
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    setStaffForm({
      id: staff.id,
      name: staff.name || '',
      phone: (staff.phone || staff.mobile_number || '').replace(/\D/g, '').slice(-10),
      email: staff.email || '',
      department: staff.department || 'Sales',
      role: staff.role || 'Senior Solar Field Executive',
      city: staff.city || 'Ahmedabad',
      zone: staff.zone || 'Gujarat Sales Desk',
      status: staff.status || 'Active',
      password: ''
    });
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e) => {
    if (e) e.preventDefault();
    if (!staffForm.name.trim()) {
      if (addToast) addToast({ title: 'Validation', message: 'Staff name is required', type: 'warning' });
      return;
    }
    const cleanPhone = staffForm.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      if (addToast) addToast({ title: 'Validation', message: '10-digit mobile number is required', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingStaff) {
        const res = await adminAccountService.updateStaff({
          id: editingStaff.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email,
          department: staffForm.department,
          role: staffForm.role,
          city: staffForm.city,
          zone: staffForm.zone,
          status: staffForm.status,
          password: staffForm.password || undefined
        });
        if (res.success) {
          if (addToast) addToast({ title: 'Staff Updated', message: `${staffForm.name} profile updated successfully`, type: 'success' });
          setShowStaffModal(false);
          loadAccounts(true);
        } else {
          if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to update staff', type: 'error' });
        }
      } else {
        const res = await adminAccountService.createStaff({
          id: staffForm.id,
          name: staffForm.name,
          phone: cleanPhone,
          email: staffForm.email,
          department: staffForm.department,
          role: staffForm.role,
          city: staffForm.city,
          zone: staffForm.zone,
          status: staffForm.status,
          password: staffForm.password
        });
        if (res.success) {
          if (addToast) addToast({ title: 'Staff Created', message: `${staffForm.name} registered with ID ${staffForm.id}`, type: 'success' });
          setShowStaffModal(false);
          loadAccounts(true);
        } else {
          if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to create staff', type: 'error' });
        }
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPasswordModal = (staff) => {
    setPasswordModal({
      isOpen: true,
      staff,
      newPassword: '',
      confirmPassword: '',
      showPass: false
    });
  };

  const handleSavePassword = async (e) => {
    if (e) e.preventDefault();
    if (!passwordModal.newPassword || passwordModal.newPassword.length < 4) {
      if (addToast) addToast({ title: 'Validation', message: 'Password must be at least 4 characters long', type: 'warning' });
      return;
    }
    if (passwordModal.newPassword !== passwordModal.confirmPassword) {
      if (addToast) addToast({ title: 'Validation', message: 'Passwords do not match', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminAccountService.updatePassword('staff', passwordModal.staff.id, passwordModal.newPassword);
      if (res.success) {
        if (addToast) addToast({ title: 'Password Changed', message: `Password updated for ${passwordModal.staff.name}`, type: 'success' });
        setPasswordModal({ isOpen: false, staff: null, newPassword: '', confirmPassword: '', showPass: false });
        loadAccounts(true);
      } else {
        if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to update password', type: 'error' });
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (staff) => {
    setDeleteModal({ isOpen: true, staff });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.staff) return;
    setSubmitting(true);
    try {
      const res = await adminAccountService.deleteStaff(deleteModal.staff.id);
      if (res.success) {
        if (addToast) addToast({ title: 'Staff Deleted', message: 'Staff member removed from database', type: 'info' });
        setDeleteModal({ isOpen: false, staff: null });
        loadAccounts(true);
      } else {
        if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to delete staff', type: 'error' });
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const salesCount = staffListState.filter(s => !(s.department || '').toLowerCase().includes('verification') && !(s.role || '').toLowerCase().includes('verification')).length;
  const verCount = staffListState.filter(s => (s.department || '').toLowerCase().includes('verification') || (s.role || '').toLowerCase().includes('verification')).length;

  return (
    <div className="flex flex-col w-full pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-container-highest">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[28px]">groups</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Sales Team &amp; Staff Accounts
            </h1>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            Manage authenticated sales representatives, verification desk officers, permissions, and login credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAccounts(true)}
            disabled={refreshing}
            className="h-10 px-3.5 bg-surface-container border border-surface-container-highest text-on-surface font-semibold rounded-lg hover:bg-surface-container-high transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            title="Refresh from PostgreSQL"
          >
            <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenAddStaff}
            className="h-10 px-4 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Total Staff</div>
          <div className="text-2xl font-bold font-mono text-on-surface mt-1">{staffListState.length}</div>
          <div className="text-[11px] text-primary mt-1 font-semibold">Active Empanelled Team</div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Field Sales</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{salesCount}</div>
          <div className="text-[11px] text-secondary mt-1">Territory Field Executives</div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Verification Desk</div>
          <div className="text-2xl font-bold font-mono text-indigo-500 mt-1">{verCount}</div>
          <div className="text-[11px] text-secondary mt-1">KYC &amp; Sanction Officers</div>
        </div>
      </div>

      {/* Search & Department Filters Toolbar */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        {/* Department Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All Staff (${staffListState.length})` },
            { id: 'sales', label: `Field Sales (${salesCount})` },
            { id: 'verification', label: `Verification Desk (${verCount})` }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStaffFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                staffFilter === pill.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-secondary hover:text-on-surface'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-0 sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">search</span>
          <input
            type="text"
            placeholder="Search by name, ID, phone, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface placeholder-secondary focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Staff Accounts Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-secondary flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
            <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">groups</span>
            <p className="text-sm font-medium">No staff members found matching your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-surface-container text-secondary text-xs uppercase tracking-wider font-semibold border-b border-surface-container-highest">
                <tr>
                  <th className="py-3 px-4">Staff Name &amp; ID</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Department &amp; Role</th>
                  <th className="py-3 px-4">City / Zone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredStaff.map((staff) => {
                  const phone = staff.phone || staff.mobile_number || '8000050580';
                  const isVer = (staff.department || '').toLowerCase().includes('verification') || (staff.role || '').toLowerCase().includes('verification');

                  return (
                    <tr key={staff.id} className="hover:bg-surface-container/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm border ${
                            isVer
                              ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {(staff.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface">{staff.name}</div>
                            <div className="text-[11px] text-secondary flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-primary font-semibold">{staff.id}</span>
                              <span>•</span>
                              <span>{staff.role || 'Field Executive'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-sm">phone_iphone</span>
                          <span>{phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isVer
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          <span className="material-symbols-outlined text-xs">{isVer ? 'verified_user' : 'support_agent'}</span>
                          <span>{staff.department || (isVer ? 'Verification' : 'Sales')}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-on-surface font-medium">{staff.city || 'Ahmedabad'}</div>
                        <div className="text-[11px] text-secondary font-mono">{staff.zone || 'Gujarat Sales Desk'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          <span>Active in DB</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPasswordModal(staff)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                            title="Change Staff Password"
                          >
                            <span className="material-symbols-outlined text-sm">key</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditStaff(staff)}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-highest transition-all cursor-pointer"
                            title="Edit Staff Profile"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenDelete(staff)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
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

      {/* Add / Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-2xl border border-surface-container-high flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high bg-surface-container shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">groups</span>
                <h3 className="font-bold text-on-surface text-base">
                  {editingStaff ? 'Edit Staff Profile' : 'Add New Staff Member'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Staff ID</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingStaff)}
                      value={staffForm.id}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Department</label>
                    <select
                      value={staffForm.department}
                      onChange={(e) => setStaffForm(prev => ({
                        ...prev,
                        department: e.target.value,
                        role: e.target.value === 'Verification' ? 'KYC Verification Officer' : 'Senior Solar Field Executive'
                      }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="Sales">Sales &amp; Business Development</option>
                      <option value="Verification">Verification &amp; KYC Desk</option>
                      <option value="Operations">Operations &amp; Dispatch</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Mobile Number (10 Digits)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 font-mono text-xs font-bold text-secondary select-none pointer-events-none flex items-center gap-1 z-10">
                        <span>+91</span>
                        <span className="text-secondary/40 font-normal">|</span>
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="8000050580"
                        value={staffForm.phone}
                        onChange={(e) => setStaffForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        className="w-full pl-12 pr-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Designation / Role Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Field Executive"
                      value={staffForm.role}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">City</label>
                    <input
                      type="text"
                      required
                      placeholder="Ahmedabad"
                      value={staffForm.city}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Zone / Territory Desk</label>
                    <input
                      type="text"
                      placeholder="Gujarat Sales Desk"
                      value={staffForm.zone}
                      onChange={(e) => setStaffForm(prev => ({ ...prev, zone: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    Official Corporate Email <span className="text-xs text-secondary/60 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="staff@sunvine.in"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    {editingStaff ? 'New Password (Optional)' : 'Initial Portal Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingStaff}
                    placeholder={editingStaff ? 'Leave blank to keep unchanged' : 'staff123'}
                    value={staffForm.password}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                  <p className="text-[11px] text-secondary mt-1">Hashed with bcrypt before saving to PostgreSQL.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-surface-container-high bg-surface-container shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                  <span>{editingStaff ? 'Save Changes' : 'Create Staff Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-2xl border border-surface-container-high p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-highest">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">key</span>
                <h3 className="font-bold text-on-surface text-base">Reset Staff Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModal({ isOpen: false, staff: null, newPassword: '', confirmPassword: '', showPass: false })}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-secondary">
              Updating password for <strong className="text-on-surface">{passwordModal.staff?.name}</strong> ({passwordModal.staff?.id}).
            </p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">New Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  required
                  value={passwordModal.newPassword}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Enter new secure password"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Confirm New Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  required
                  value={passwordModal.confirmPassword}
                  onChange={(e) => setPasswordModal(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Re-enter password"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={passwordModal.showPass}
                    onChange={(e) => setPasswordModal(prev => ({ ...prev, showPass: e.target.checked }))}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Show password</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-highest">
                <button
                  type="button"
                  onClick={() => setPasswordModal({ isOpen: false, staff: null, newPassword: '', confirmPassword: '', showPass: false })}
                  className="px-4 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-on-primary text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-2xl border border-surface-container-high p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-bold text-on-surface text-base">Delete Staff Member?</h3>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-on-surface">{deleteModal.staff?.name}</strong> ({deleteModal.staff?.id}) from the live database? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-highest">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, staff: null })}
                className="px-4 py-2 text-xs font-semibold text-secondary hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
