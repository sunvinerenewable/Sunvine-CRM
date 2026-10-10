import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { adminAccountService } from '../../services/adminAccountService';

export default function DealerAccountsManagement() {
  const { addToast } = useToast();
  const { staffList, setDealers } = useApp();

  const [dealersList, setDealersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [showDealerModal, setShowDealerModal] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [dealerForm, setDealerForm] = useState({
    id: '',
    dealerCode: '',
    category: 'Margin Based',
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
    password: '',
    assignedStaffId: 'STF-DIRECT',
    assignedStaffName: 'Direct to Company (HQ Desk)'
  });

  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    dealer: null,
    newPassword: '',
    confirmPassword: '',
    showPass: false
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    dealer: null
  });

  const [submitting, setSubmitting] = useState(false);

  // Load accounts from live DB
  const loadAccounts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await adminAccountService.fetchAccounts();
      const list = data.dealers || [];
      setDealersList(list);
      if (typeof setDealers === 'function' && Array.isArray(list)) {
        setDealers(list.map(d => ({
          ...d,
          mobile: d.mobile_number || d.mobile,
          firmName: d.firm_name || d.firmName,
          contactPerson: d.contact_person || d.contactPerson
        })));
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: 'Failed to load dealer accounts from database', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredDealers = useMemo(() => {
    return dealersList.filter(d => {
      const firm = (d.firm_name || d.firmName || '').toLowerCase();
      const contact = (d.contact_person || d.contactPerson || '').toLowerCase();
      const mobile = (d.mobile_number || d.mobile || '');
      const code = (d.dealer_code || d.dealerCode || d.id || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      if (q && !firm.includes(q) && !contact.includes(q) && !mobile.includes(q) && !code.includes(q)) {
        return false;
      }

      const cat = d.category || d.pricing_config?.category || 'Margin Based';
      if (categoryFilter !== 'all' && cat !== categoryFilter) {
        return false;
      }

      const status = (d.status || 'active').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [dealersList, searchQuery, categoryFilter, statusFilter]);

  const handleOpenAddDealer = () => {
    setEditingDealer(null);
    const rndCode = `SV-DLR-0${Math.floor(800 + Math.random() * 100)}`;
    setDealerForm({
      id: '',
      dealerCode: rndCode,
      category: 'Margin Based',
      firmName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      city: 'Rajkot',
      state: 'Gujarat',
      discom: 'PGVCL',
      tier: 'Gold EPC',
      maxMarginCapPerKw: 6000,
      status: 'Active',
      password: 'dealer' + Math.floor(100 + Math.random() * 900),
      assignedStaffId: 'STF-DIRECT',
      assignedStaffName: 'Direct to Company (HQ Desk)'
    });
    setShowDealerModal(true);
  };

  const handleOpenEditDealer = (dealer) => {
    setEditingDealer(dealer);
    const code = dealer.dealer_code || dealer.dealerCode || dealer.id;
    const cat = dealer.category || dealer.pricing_config?.category || 'Margin Based';
    setDealerForm({
      id: dealer.id || code,
      dealerCode: code,
      category: cat,
      firmName: dealer.firm_name || dealer.firmName || '',
      contactPerson: dealer.contact_person || dealer.contactPerson || '',
      mobile: (dealer.mobile_number || dealer.mobile || '').replace(/\D/g, '').slice(-10),
      email: dealer.email || '',
      city: dealer.city || 'Rajkot',
      state: dealer.state || 'Gujarat',
      discom: dealer.discom || 'PGVCL',
      tier: dealer.tier || 'Gold EPC',
      maxMarginCapPerKw: dealer.max_margin_cap_per_kw || dealer.maxMarginCapPerKw || 6000,
      status: dealer.status || 'Active',
      password: '',
      assignedStaffId: dealer.assigned_staff_id || dealer.assignedStaffId || 'STF-DIRECT',
      assignedStaffName: dealer.assigned_staff_name || dealer.assignedStaffName || 'Direct to Company (HQ Desk)'
    });
    setShowDealerModal(true);
  };

  const handleSaveDealer = async (e) => {
    if (e) e.preventDefault();
    if (!dealerForm.firmName.trim() || !dealerForm.contactPerson.trim()) {
      if (addToast) addToast({ title: 'Validation', message: 'Firm name and contact person are required', type: 'warning' });
      return;
    }
    const cleanMobile = dealerForm.mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      if (addToast) addToast({ title: 'Validation', message: '10-digit mobile number is required', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingDealer) {
        const res = await adminAccountService.updateDealer({
          id: editingDealer.id || editingDealer.dealer_code,
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          category: dealerForm.category,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password || undefined,
          assignedStaffId: dealerForm.assignedStaffId,
          assignedStaffName: dealerForm.assignedStaffName
        });
        if (res.success) {
          if (addToast) addToast({ title: 'Dealer Updated', message: `${dealerForm.firmName} profile updated successfully`, type: 'success' });
          setShowDealerModal(false);
          loadAccounts(true);
        } else {
          if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to update dealer', type: 'error' });
        }
      } else {
        const res = await adminAccountService.createDealer({
          dealerCode: dealerForm.dealerCode,
          firmName: dealerForm.firmName,
          contactPerson: dealerForm.contactPerson,
          mobile: cleanMobile,
          email: dealerForm.email,
          city: dealerForm.city,
          state: dealerForm.state,
          discom: dealerForm.discom,
          tier: dealerForm.tier,
          category: dealerForm.category,
          maxMarginCapPerKw: Number(dealerForm.maxMarginCapPerKw) || 6000,
          status: dealerForm.status,
          password: dealerForm.password,
          assignedStaffId: dealerForm.assignedStaffId,
          assignedStaffName: dealerForm.assignedStaffName
        });
        if (res.success) {
          if (addToast) addToast({ title: 'Dealer Onboarded', message: `Dealer ${dealerForm.firmName} registered with code ${dealerForm.dealerCode}`, type: 'success' });
          setShowDealerModal(false);
          loadAccounts(true);
        } else {
          if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to onboard dealer', type: 'error' });
        }
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPasswordModal = (dealer) => {
    setPasswordModal({
      isOpen: true,
      dealer,
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
      const targetId = passwordModal.dealer.id || passwordModal.dealer.dealer_code || passwordModal.dealer.dealerCode;
      const res = await adminAccountService.updatePassword('dealer', targetId, passwordModal.newPassword);
      if (res.success) {
        if (addToast) addToast({ title: 'Password Changed', message: `Password updated for ${passwordModal.dealer.firm_name || passwordModal.dealer.firmName}`, type: 'success' });
        setPasswordModal({ isOpen: false, dealer: null, newPassword: '', confirmPassword: '', showPass: false });
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

  const handleOpenDelete = (dealer) => {
    setDeleteModal({ isOpen: true, dealer });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.dealer) return;
    setSubmitting(true);
    try {
      const targetId = deleteModal.dealer.id || deleteModal.dealer.dealer_code || deleteModal.dealer.dealerCode;
      const res = await adminAccountService.deleteDealer(targetId);
      if (res.success) {
        if (addToast) addToast({ title: 'Dealer Deleted', message: 'Dealer partner removed from database', type: 'info' });
        setDeleteModal({ isOpen: false, dealer: null });
        loadAccounts(true);
      } else {
        if (addToast) addToast({ title: 'Error', message: res.error || 'Failed to delete dealer', type: 'error' });
      }
    } catch (err) {
      if (addToast) addToast({ title: 'Error', message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-container-highest">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[28px]">handshake</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Dealer Partner Accounts
            </h1>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            Manage authenticated dealer accounts, credentials, login access, commercial categories, and territory assignments.
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
            onClick={handleOpenAddDealer}
            className="h-10 px-4 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Onboard New Dealer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Total Dealers</div>
          <div className="text-2xl font-bold font-mono text-on-surface mt-1">{dealersList.length}</div>
          <div className="text-[11px] text-primary mt-1 font-semibold">100% Gujarat Empanelled</div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Margin Based</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
            {dealersList.filter(d => (d.category || d.pricing_config?.category || 'Margin Based') === 'Margin Based').length}
          </div>
          <div className="text-[11px] text-secondary mt-1">₹/kW Profit Model</div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Kit Based</div>
          <div className="text-2xl font-bold font-mono text-purple-600 mt-1">
            {dealersList.filter(d => (d.category || d.pricing_config?.category) === 'Kit Based').length}
          </div>
          <div className="text-[11px] text-secondary mt-1">Standard Package</div>
        </div>
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4">
          <div className="text-secondary text-xs font-semibold uppercase">Active DB State</div>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {dealersList.filter(d => (d.status || 'active').toLowerCase() === 'active').length}
          </div>
          <div className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Credentials
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">search</span>
          <input
            type="text"
            placeholder="Search by firm name, contact person, mobile, dealer code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface placeholder-secondary focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Models</option>
            <option value="Margin Based">Margin Based</option>
            <option value="Kit Based">Kit Based</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Dealers Accounts Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-secondary flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
            <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
          </div>
        ) : filteredDealers.length === 0 ? (
          <div className="p-12 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">storefront</span>
            <p className="text-sm font-medium">No dealer partners found matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-surface-container text-secondary text-xs uppercase tracking-wider font-semibold border-b border-surface-container-highest">
                <tr>
                  <th className="py-3 px-4">Dealer Partner / Firm</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">City / DISCOM</th>
                  <th className="py-3 px-4">Partner Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredDealers.map((dealer) => {
                  const firm = dealer.firm_name || dealer.firmName || 'Dealer Firm';
                  const contact = dealer.contact_person || dealer.contactPerson || 'Authorized Person';
                  const code = dealer.dealer_code || dealer.dealerCode || dealer.id;
                  const mobile = dealer.mobile_number || dealer.mobile || '8000050580';
                  const cat = dealer.category || dealer.pricing_config?.category || 'Margin Based';
                  const isDirect = !dealer.assigned_staff_id || dealer.assigned_staff_id === 'STF-DIRECT' || dealer.assignedStaffId === 'STF-DIRECT';

                  return (
                    <tr key={dealer.id || code} className="hover:bg-surface-container/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 font-bold flex items-center justify-center text-sm border border-amber-500/30">
                            {firm.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface">{firm}</div>
                            <div className="text-[11px] text-secondary flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>{contact}</span>
                              <span>•</span>
                              <span className="font-mono text-primary font-semibold">{code}</span>
                              <span>•</span>
                              {/* Category Pill */}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold border shrink-0 ${
                                cat === 'Kit Based'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              }`}>
                                <span className="material-symbols-outlined text-[11px]">
                                  {cat === 'Kit Based' ? 'inventory_2' : 'percent'}
                                </span>
                                {cat}
                              </span>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isDirect
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {isDirect
                                  ? 'Direct to Company'
                                  : `Sales: ${dealer.assigned_staff_name || dealer.assignedStaffName || 'Sales Staff'}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-secondary text-sm">phone_iphone</span>
                          <span>{mobile}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-on-surface font-medium">{dealer.city || 'Rajkot'}</div>
                        <div className="text-[11px] text-secondary font-mono">{dealer.discom || 'PGVCL'} Circle</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <span className="material-symbols-outlined text-xs">workspace_premium</span>
                          <span>{dealer.tier || 'Gold EPC'}</span>
                        </span>
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
                            onClick={() => handleOpenPasswordModal(dealer)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                            title="Change Dealer Password"
                          >
                            <span className="material-symbols-outlined text-sm">key</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditDealer(dealer)}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-highest transition-all cursor-pointer"
                            title="Edit Dealer Profile"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenDelete(dealer)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
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

      {/* Onboard / Edit Dealer Modal */}
      {showDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-2xl border border-surface-container-high flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleIn">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-container-high bg-surface-container shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">apartment</span>
                <h3 className="font-bold text-on-surface text-base">
                  {editingDealer ? 'Edit Dealer Partner Profile' : 'Onboard New Dealer Partner'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDealerModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer p-1 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDealer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Dealer Code</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingDealer)}
                      value={dealerForm.dealerCode}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, dealerCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface focus:outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Partner Tier</label>
                    <select
                      value={dealerForm.tier}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, tier: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="Diamond EPC">Diamond EPC</option>
                      <option value="Platinum EPC">Platinum EPC</option>
                      <option value="Gold EPC">Gold EPC</option>
                      <option value="Silver Installer">Silver Installer</option>
                    </select>
                  </div>
                </div>

                {/* Operating Model / Category */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-secondary flex items-center justify-between">
                    <span>Operating Model / Category <span className="text-rose-500">*</span></span>
                    <span className="text-[11px] font-semibold text-secondary">
                      Selected: <strong className={dealerForm.category === 'Kit Based' ? 'text-purple-400 font-bold' : 'text-emerald-400 font-bold'}>{dealerForm.category || 'Margin Based'}</strong>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDealerForm(prev => ({ ...prev, category: 'Margin Based' }))}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        (dealerForm.category || 'Margin Based') === 'Margin Based'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-surface-container-highest bg-surface-container text-secondary hover:border-surface-container-high'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        (dealerForm.category || 'Margin Based') === 'Margin Based'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-surface-container-highest text-secondary'
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">percent</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight">Margin Based</div>
                        <div className="text-[10px] text-secondary mt-0.5 font-normal">Custom ₹/kW margin</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealerForm(prev => ({ ...prev, category: 'Kit Based' }))}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        dealerForm.category === 'Kit Based'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-400 font-semibold shadow-xs ring-1 ring-purple-500/30'
                          : 'border-surface-container-highest bg-surface-container text-secondary hover:border-surface-container-high'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        dealerForm.category === 'Kit Based'
                          ? 'bg-purple-600 text-white'
                          : 'bg-surface-container-highest text-secondary'
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight">Kit Based</div>
                        <div className="text-[10px] text-secondary mt-0.5 font-normal">Fixed package kit</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Firm / Agency Trade Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saur Urja Solutions"
                    value={dealerForm.firmName}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, firmName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Contact Person</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nilesh Shah"
                      value={dealerForm.contactPerson}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                    />
                  </div>

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
                        value={dealerForm.mobile}
                        onChange={(e) => setDealerForm(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        className="w-full pl-12 pr-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">City</label>
                    <input
                      type="text"
                      required
                      placeholder="Rajkot"
                      value={dealerForm.city}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">DISCOM</label>
                    <select
                      value={dealerForm.discom}
                      onChange={(e) => setDealerForm(prev => ({ ...prev, discom: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="PGVCL">PGVCL (Paschim Gujarat)</option>
                      <option value="UGVCL">UGVCL (Uttar Gujarat)</option>
                      <option value="DGVCL">DGVCL (Dakshin Gujarat)</option>
                      <option value="MGVCL">MGVCL (Madhya Gujarat)</option>
                      <option value="Torrent Power">Torrent Power</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    Official Business Email <span className="text-xs text-secondary/60 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="partner@sunvinedealer.in"
                    value={dealerForm.email}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Sales Alignment */}
                <div className="space-y-2 pt-2 border-t border-surface-container-highest">
                  <label className="block text-xs font-semibold text-secondary">Sales Channel Alignment</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDealerForm(prev => ({
                        ...prev,
                        assignedStaffId: 'STF-DIRECT',
                        assignedStaffName: 'Direct to Company (HQ Desk)'
                      }))}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        dealerForm.assignedStaffId === 'STF-DIRECT'
                          ? 'bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-400'
                          : 'bg-surface-container border-surface-container-highest hover:border-surface-container-high text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg text-indigo-400 mt-0.5">bolt</span>
                      <div>
                        <div className="text-xs font-bold">Direct to Company</div>
                        <div className="text-[10px] text-secondary mt-0.5">Deals with Sunvine HQ directly</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const firstStaff = (staffList || []).find(s => s.department === 'Sales') || (staffList || [])[0];
                        setDealerForm(prev => ({
                          ...prev,
                          assignedStaffId: firstStaff?.id || 'STF-801',
                          assignedStaffName: firstStaff?.name || 'Sunvine Sales Staff'
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                        dealerForm.assignedStaffId !== 'STF-DIRECT'
                          ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-400'
                          : 'bg-surface-container border-surface-container-highest hover:border-surface-container-high text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg text-emerald-400 mt-0.5">person</span>
                      <div>
                        <div className="text-xs font-bold">Field Sales Representative</div>
                        <div className="text-[10px] text-secondary mt-0.5">Managed by field team</div>
                      </div>
                    </button>
                  </div>

                  {dealerForm.assignedStaffId !== 'STF-DIRECT' && (
                    <div className="pt-1.5">
                      <select
                        value={dealerForm.assignedStaffId}
                        onChange={(e) => {
                          const sId = e.target.value;
                          const match = (staffList || []).find(s => s.id === sId);
                          setDealerForm(prev => ({
                            ...prev,
                            assignedStaffId: sId,
                            assignedStaffName: match?.name || 'Sunvine Sales Staff'
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                      >
                        {(staffList || []).map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.id}) • {s.role || s.department || 'Sales'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    {editingDealer ? 'New Password (Optional)' : 'Initial Portal Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingDealer}
                    placeholder={editingDealer ? 'Leave blank to keep unchanged' : 'dealer123'}
                    value={dealerForm.password}
                    onChange={(e) => setDealerForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-surface-container border border-surface-container-highest rounded-xl text-sm font-mono text-on-surface placeholder-secondary focus:outline-none focus:border-primary"
                  />
                  <p className="text-[11px] text-secondary mt-1">Hashed with bcrypt before saving to PostgreSQL.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-surface-container-high bg-surface-container shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDealerModal(false)}
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
                  <span>{editingDealer ? 'Save Changes' : 'Onboard Dealer'}</span>
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
                <h3 className="font-bold text-on-surface text-base">Reset Dealer Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModal({ isOpen: false, dealer: null, newPassword: '', confirmPassword: '', showPass: false })}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-secondary">
              Updating password for <strong className="text-on-surface">{passwordModal.dealer?.firm_name || passwordModal.dealer?.firmName}</strong> ({passwordModal.dealer?.dealer_code || passwordModal.dealer?.dealerCode || passwordModal.dealer?.id}).
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
                  onClick={() => setPasswordModal({ isOpen: false, dealer: null, newPassword: '', confirmPassword: '', showPass: false })}
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
              <h3 className="font-bold text-on-surface text-base">Delete Dealer Partner?</h3>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-on-surface">{deleteModal.dealer?.firm_name || deleteModal.dealer?.firmName}</strong> ({deleteModal.dealer?.dealer_code || deleteModal.dealer?.dealerCode}) from the live database? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-highest">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, dealer: null })}
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
