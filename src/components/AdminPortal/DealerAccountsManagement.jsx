import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { adminAccountService } from '../../services/adminAccountService';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';

export default function DealerAccountsManagement() {
  const { addToast } = useToast();
  const { customerFiles, quotations, staffList, setDealers, refreshCustomerFiles } = useApp();

  // Navigation tab: 'files' (Dealer Project Files - default) or 'accounts' (Dealer Accounts & Access)
  const [activeTab, setActiveTab] = useState('files');

  // Live Dealer Accounts from DB
  const [dealersList, setDealersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters for Files View
  const [selectedDealerFilter, setSelectedDealerFilter] = useState('all');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  // Filters for Accounts View
  const [accountsSearchQuery, setAccountsSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // File Detail Modal
  const [selectedFileForDetail, setSelectedFileForDetail] = useState(null);

  // Dealer Account Modals
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

  // -------------------------------------------------------------
  // ALL FILES CREATED BY DEALERS
  // -------------------------------------------------------------
  const allDealerFiles = useMemo(() => {
    const rawFiles = Array.isArray(customerFiles) ? customerFiles : [];

    // Filter files that belong to dealers or have sourceType === 'DEALER'
    const dealerCreatedFiles = rawFiles.filter(f => {
      if (!f) return false;
      const isDealerSource = (f.sourceType || f.source || '').toUpperCase() === 'DEALER';
      const hasDealerRef = Boolean(f.dealerId || f.dealer_id || f.dealerName || f.dealer_name);
      return isDealerSource || hasDealerRef;
    });

    // Also match any converted quotations with 'Won / Order Booked' by dealers that don't already exist in customerFiles
    const wonQuotes = (quotations || []).filter(q => {
      const isWon = q.status === 'Won / Order Booked';
      const isDealer = Boolean(q.dealerId || q.dealer_id || (q.dealerName && !q.dealerName.includes('Head Office')));
      const alreadyHasFile = dealerCreatedFiles.some(f => f.quotationId === q.id || f.id === `FIL-${q.id}`);
      return isWon && isDealer && !alreadyHasFile;
    });

    const synthesizedFromQuotes = wonQuotes.map(q => {
      const capKw = Number(q.systemCapacityKW || q.capacity?.replace(/[^\d.]/g, '') || 5);
      return {
        id: `FIL-${q.id || Date.now()}`,
        quotationId: q.id,
        customerName: q.customerName || 'Solar Consumer',
        phone: q.customerPhone || q.phone || 'N/A',
        address: q.customerAddress || q.address || q.location || 'Gujarat',
        city: q.city || 'Rajkot',
        discom: q.discom || 'PGVCL',
        consumerNo: q.consumerNo || 'PENDING',
        solarSystemKw: capKw,
        roofType: 'RCC Flat',
        sourceType: 'DEALER',
        source: 'DEALER',
        dealerId: q.dealerId || null,
        dealerName: q.dealerName || 'Dealer Partner',
        stage: 'DISCOM_APPLICATION',
        currentStage: 'DISCOM_APPLICATION',
        status: 'Verification',
        financeType: q.financeType || 'CASH',
        loanBank: q.loanBank || '',
        createdAt: q.date || q.created_at || new Date().toISOString(),
        documents: {},
        timeline: [
          {
            stage: 'Quotation Approved',
            date: q.date || new Date().toISOString().split('T')[0],
            actor: q.dealerName || 'Dealer Partner',
            notes: 'Converted to project application'
          }
        ]
      };
    });

    return [...dealerCreatedFiles, ...synthesizedFromQuotes];
  }, [customerFiles, quotations]);

  // -------------------------------------------------------------
  // FILTERED DEALER FILES (Based on Dealer selector, Customer search & Stage)
  // -------------------------------------------------------------
  const filteredDealerFiles = useMemo(() => {
    return allDealerFiles.filter(file => {
      // 1. Filter by specific Dealer
      if (selectedDealerFilter !== 'all') {
        const d = dealersList.find(item => item.id === selectedDealerFilter || item.dealer_code === selectedDealerFilter || item.dealerCode === selectedDealerFilter);
        const cleanDId = String(selectedDealerFilter).replace(/^#/, '').toLowerCase();
        const cleanFirm = d ? (d.firm_name || d.firmName || '').trim().toLowerCase() : '';
        const fileDId = String(file.dealerId || file.dealer_id || '').replace(/^#/, '').toLowerCase();
        const fileDFirm = (file.dealerName || file.dealer_name || '').trim().toLowerCase();

        const matches = (
          (cleanDId && (fileDId === cleanDId || fileDId.includes(cleanDId) || cleanDId.includes(fileDId))) ||
          (cleanFirm && fileDFirm && (fileDFirm === cleanFirm || fileDFirm.includes(cleanFirm) || cleanFirm.includes(fileDFirm)))
        );

        if (!matches) return false;
      }

      // 2. Customer search query (Name, Phone, Consumer No, File ID, City)
      if (customerSearchQuery.trim()) {
        const q = customerSearchQuery.toLowerCase().trim();
        const name = (file.customerName || file.customer_name || '').toLowerCase();
        const phone = String(file.phone || '');
        const consumer = String(file.consumerNo || file.consumer_no || '').toLowerCase();
        const id = String(file.id || '').toLowerCase();
        const city = String(file.city || '').toLowerCase();

        if (!name.includes(q) && !phone.includes(q) && !consumer.includes(q) && !id.includes(q) && !city.includes(q)) {
          return false;
        }
      }

      // 3. Stage filter
      if (stageFilter !== 'all') {
        const currentStage = String(file.currentStage || file.stage || file.status || '').toLowerCase();
        if (!currentStage.includes(stageFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [allDealerFiles, selectedDealerFilter, dealersList, customerSearchQuery, stageFilter]);

  // -------------------------------------------------------------
  // DYNAMIC KPI CARDS CALCULATION
  // Replaces "Active DB State" with TOTAL FILES of that dealer/selection
  // Dynamically updates as filters change
  // -------------------------------------------------------------
  const kpiStats = useMemo(() => {
    const isSpecificDealer = selectedDealerFilter !== 'all';
    const targetDealer = isSpecificDealer
      ? dealersList.find(d => d.id === selectedDealerFilter || d.dealer_code === selectedDealerFilter || d.dealerCode === selectedDealerFilter)
      : null;

    // Card 1: Total Dealers
    const totalDealersCount = isSpecificDealer ? 1 : dealersList.length;
    const totalDealersSub = isSpecificDealer
      ? (targetDealer ? `${targetDealer.firm_name || targetDealer.firmName} (${targetDealer.city || 'Gujarat'})` : 'Selected Partner')
      : '100% Gujarat Empanelled';

    // Card 2: Margin Based
    let marginBasedCount = 0;
    let marginSub = '₹/kW Profit Model';
    if (isSpecificDealer) {
      const cat = targetDealer?.category || targetDealer?.pricing_config?.category || 'Margin Based';
      marginBasedCount = cat === 'Margin Based' ? 1 : 0;
      marginSub = targetDealer?.tier || 'Gold EPC Tier';
    } else {
      marginBasedCount = dealersList.filter(d => (d.category || d.pricing_config?.category || 'Margin Based') === 'Margin Based').length;
    }

    // Card 3: Kit Based
    let kitBasedCount = 0;
    let kitSub = 'Standard Package';
    if (isSpecificDealer) {
      const cat = targetDealer?.category || targetDealer?.pricing_config?.category;
      kitBasedCount = cat === 'Kit Based' ? 1 : 0;
      kitSub = cat === 'Kit Based' ? 'Standard Kit Package' : '0 Package Kit';
    } else {
      kitBasedCount = dealersList.filter(d => (d.category || d.pricing_config?.category) === 'Kit Based').length;
    }

    // Card 4: TOTAL FILES ("उस dealer की total कितनी files है?")
    // Dynamic count of files belonging to that dealer (or across all dealers if 'all')
    const totalFilesCount = filteredDealerFiles.length;
    const totalCapacityKw = filteredDealerFiles.reduce((acc, f) => acc + (Number(f.solarSystemKw || f.solar_system_kw) || 0), 0);
    const filesSub = isSpecificDealer
      ? (targetDealer ? `${targetDealer.firm_name || targetDealer.firmName} Projects` : 'Dealer Files')
      : `${totalCapacityKw.toFixed(1)} kW Solar Pipeline`;

    return {
      totalDealersCount,
      totalDealersSub,
      marginBasedCount,
      marginSub,
      kitBasedCount,
      kitSub,
      totalFilesCount,
      filesSub,
      isSpecificDealer,
      targetDealer
    };
  }, [dealersList, selectedDealerFilter, filteredDealerFiles]);

  // -------------------------------------------------------------
  // FILTERED DEALER ACCOUNTS (For Accounts Tab)
  // -------------------------------------------------------------
  const filteredDealers = useMemo(() => {
    return dealersList.filter(d => {
      const firm = (d.firm_name || d.firmName || '').toLowerCase();
      const contact = (d.contact_person || d.contactPerson || '').toLowerCase();
      const mobile = (d.mobile_number || d.mobile || '');
      const code = (d.dealer_code || d.dealerCode || d.id || '').toLowerCase();
      const q = accountsSearchQuery.toLowerCase().trim();

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
  }, [dealersList, accountsSearchQuery, categoryFilter, statusFilter]);

  // -------------------------------------------------------------
  // DEALER ACCOUNT ACTIONS
  // -------------------------------------------------------------
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

  // Helper for stage styling
  const getStageBadge = (stage = '', status = '') => {
    const s = (stage || status || '').toLowerCase();
    if (s.includes('lead') || s.includes('sourced')) {
      return { label: 'Lead Sourced', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: 'person_add' };
    }
    if (s.includes('survey') || s.includes('feasibility')) {
      return { label: 'Feasibility Approved', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'verified' };
    }
    if (s.includes('discom')) {
      return { label: 'DISCOM Application', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'electric_meter' };
    }
    if (s.includes('install')) {
      return { label: 'Solar Installation', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: 'solar_power' };
    }
    if (s.includes('sync') || s.includes('meter')) {
      return { label: 'Net-Meter Synced', bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: 'sync_alt' };
    }
    if (s.includes('subsidy')) {
      return { label: 'Subsidy Claim', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'payments' };
    }
    if (s.includes('complete') || s.includes('commission')) {
      return { label: 'Commissioned', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: 'check_circle' };
    }
    if (s.includes('cancel')) {
      return { label: 'Cancelled', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: 'cancel' };
    }
    return { label: stage || status || 'In Progress', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: 'pending' };
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-container-highest">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[28px]">handshake</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Dealer Operations &amp; Consumer Files
            </h1>
          </div>
          <p className="font-body-md text-body-md text-secondary">
            Universal pipeline for all project files created by Authorized Gujarat Dealers, real-time stage tracking, and account management.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Refresh Button */}
          <button
            onClick={() => {
              loadAccounts(true);
              if (typeof refreshCustomerFiles === 'function') refreshCustomerFiles();
            }}
            disabled={refreshing}
            className="h-10 px-3.5 bg-surface-container border border-surface-container-highest text-on-surface font-semibold rounded-lg hover:bg-surface-container-high transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            title="Refresh from PostgreSQL Database"
          >
            <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>

          {/* Onboard Dealer Button */}
          <button
            onClick={handleOpenAddDealer}
            className="h-10 px-4 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-hover transition-all flex items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Onboard New Dealer</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC KPI STATS CARDS */}
      {/* 4th card replaces 'Active DB State' with TOTAL FILES of that dealer/selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Dealers / Selected Dealer */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 transition-all">
          <div className="text-secondary text-xs font-semibold uppercase">
            {kpiStats.isSpecificDealer ? 'Selected Dealer' : 'Total Dealers'}
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface mt-1">
            {kpiStats.totalDealersCount}
          </div>
          <div className="text-[11px] text-primary mt-1 font-semibold truncate" title={kpiStats.totalDealersSub}>
            {kpiStats.totalDealersSub}
          </div>
        </div>

        {/* Card 2: Margin Based Model */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 transition-all">
          <div className="text-secondary text-xs font-semibold uppercase">Margin Based</div>
          <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">
            {kpiStats.marginBasedCount}
          </div>
          <div className="text-[11px] text-secondary mt-1 truncate" title={kpiStats.marginSub}>
            {kpiStats.marginSub}
          </div>
        </div>

        {/* Card 3: Kit Based Model */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 transition-all">
          <div className="text-secondary text-xs font-semibold uppercase">Kit Based</div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
            {kpiStats.kitBasedCount}
          </div>
          <div className="text-[11px] text-secondary mt-1 truncate" title={kpiStats.kitSub}>
            {kpiStats.kitSub}
          </div>
        </div>

        {/* Card 4: TOTAL FILES OF THAT DEALER (Replaces Active DB State) */}
        <div className="bg-surface-container-lowest border border-primary/40 rounded-xl p-4 bg-gradient-to-br from-surface-container-lowest to-emerald-950/20 transition-all">
          <div className="text-emerald-400 text-xs font-semibold uppercase flex items-center justify-between">
            <span>{kpiStats.isSpecificDealer ? 'Dealer Total Files' : 'Total Dealer Files'}</span>
            <span className="material-symbols-outlined text-[16px] text-emerald-400">folder_open</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 flex items-baseline gap-1.5">
            <span>{kpiStats.totalFilesCount}</span>
            <span className="text-xs font-sans font-normal text-secondary">Files</span>
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-1 font-semibold flex items-center gap-1 truncate" title={kpiStats.filesSub}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{kpiStats.filesSub}</span>
          </div>
        </div>
      </div>

      {/* VIEW TABS: Dealer Consumer Files (Default) vs Dealer Accounts */}
      <div className="flex items-center gap-2 border-b border-surface-container-high pb-2">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'files'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-secondary hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">folder_shared</span>
          <span>Dealer Project Files</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            activeTab === 'files' ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-secondary'
          }`}>
            {filteredDealerFiles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-secondary hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Dealer Accounts &amp; Access</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            activeTab === 'accounts' ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-secondary'
          }`}>
            {dealersList.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ALL FILES CREATED BY DEALERS (With Customer Search & Dealer Filter) */}
      {/* ========================================================================= */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
            {/* Search by Customer Name / Phone / Consumer No */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">search</span>
              <input
                type="text"
                placeholder="Search by customer name, mobile, consumer number, city, or file ID..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface placeholder-secondary focus:outline-none focus:border-primary transition-all"
              />
              {customerSearchQuery && (
                <button
                  onClick={() => setCustomerSearchQuery('')}
                  className="absolute right-2.5 top-2 text-secondary hover:text-on-surface cursor-pointer"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Dealer Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-surface-container border border-surface-container-highest rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-secondary text-[16px]">storefront</span>
                <select
                  value={selectedDealerFilter}
                  onChange={(e) => setSelectedDealerFilter(e.target.value)}
                  className="bg-transparent text-xs text-on-surface font-semibold focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  <option value="all" className="bg-[#070D18] text-white">All Dealers ({dealersList.length})</option>
                  {dealersList.map((d) => {
                    const dCode = d.dealer_code || d.dealerCode || d.id;
                    const dFirm = d.firm_name || d.firmName || dCode;
                    return (
                      <option key={d.id || dCode} value={d.id || dCode} className="bg-[#070D18] text-white">
                        {dFirm} ({d.city || 'Gujarat'})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Stage Filter Dropdown */}
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all" className="bg-[#070D18] text-white">All Project Stages</option>
                <option value="lead" className="bg-[#070D18] text-white">Lead Sourced</option>
                <option value="feasibility" className="bg-[#070D18] text-white">Feasibility Approved</option>
                <option value="discom" className="bg-[#070D18] text-white">DISCOM Application</option>
                <option value="install" className="bg-[#070D18] text-white">Installation</option>
                <option value="sync" className="bg-[#070D18] text-white">Net-Meter Sync</option>
                <option value="complete" className="bg-[#070D18] text-white">Completed</option>
              </select>

              {/* Reset Filters Button */}
              {(selectedDealerFilter !== 'all' || customerSearchQuery || stageFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedDealerFilter('all');
                    setCustomerSearchQuery('');
                    setStageFilter('all');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary hover:text-on-surface text-xs font-medium cursor-pointer transition-all flex items-center gap-1"
                  title="Reset all filters"
                >
                  <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* DEALER FILES TABLE */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl overflow-hidden shadow-xs">
            {filteredDealerFiles.length === 0 ? (
              <div className="py-16 text-center text-secondary flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[32px]">folder_off</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">No Dealer Consumer Files Found</h3>
                  <p className="text-xs text-secondary mt-1">
                    {selectedDealerFilter !== 'all' || customerSearchQuery || stageFilter !== 'all'
                      ? 'No files match the selected dealer or search criteria.'
                      : 'Dealers have not created any customer project files yet.'}
                  </p>
                </div>
                {(selectedDealerFilter !== 'all' || customerSearchQuery || stageFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedDealerFilter('all');
                      setCustomerSearchQuery('');
                      setStageFilter('all');
                    }}
                    className="mt-2 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-surface-container text-secondary text-xs uppercase tracking-wider font-semibold border-b border-surface-container-highest">
                    <tr>
                      <th className="py-3 px-4">File ID &amp; Date</th>
                      <th className="py-3 px-4">Consumer / Customer</th>
                      <th className="py-3 px-4">Dealer Partner</th>
                      <th className="py-3 px-4">Solar Capacity</th>
                      <th className="py-3 px-4">Payment &amp; Finance</th>
                      <th className="py-3 px-4">Project Stage</th>
                      <th className="py-3 px-4 text-center">Docs</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {filteredDealerFiles.map((file) => {
                      const stageInfo = getStageBadge(file.currentStage || file.stage, file.status);
                      const fileDate = file.createdAt ? new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent';
                      const docCount = file.documents && typeof file.documents === 'object' ? Object.keys(file.documents).length : 0;
                      const capKw = Number(file.solarSystemKw || file.solar_system_kw) || 4.4;

                      return (
                        <tr
                          key={file.id}
                          className="hover:bg-surface-container-high/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedFileForDetail(file)}
                        >
                          {/* File ID & Date */}
                          <td className="py-3.5 px-4 font-mono font-medium">
                            <div className="text-primary font-bold text-xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">description</span>
                              <span>{file.id}</span>
                            </div>
                            <div className="text-[11px] text-secondary mt-0.5">{fileDate}</div>
                          </td>

                          {/* Customer Details */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-on-surface text-sm">
                              {file.customerName || file.customer_name || 'Solar Consumer'}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-secondary mt-0.5">
                              <span className="flex items-center gap-0.5 font-mono">
                                <span className="material-symbols-outlined text-[13px]">phone</span>
                                <span>{file.phone || 'N/A'}</span>
                              </span>
                              <span>•</span>
                              <span>{file.city || file.discom || 'Gujarat'}</span>
                            </div>
                            {file.consumerNo && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Consumer No: {file.consumerNo}
                              </div>
                            )}
                          </td>

                          {/* Dealer Partner */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-emerald-400 text-[16px]">storefront</span>
                              <span className="font-semibold text-on-surface">
                                {file.dealerName || file.dealer_name || 'Dealer Partner'}
                              </span>
                            </div>
                            {file.dealerId && (
                              <div className="text-[10px] text-secondary font-mono mt-0.5">
                                ID: {String(file.dealerId).slice(0, 16)}
                              </div>
                            )}
                          </td>

                          {/* Solar System Capacity */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold font-mono text-emerald-400 text-sm">
                              {capKw} kW
                            </div>
                            <div className="text-[11px] text-secondary mt-0.5">
                              {file.roofType || 'RCC Flat'}
                            </div>
                          </td>

                          {/* Finance */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              String(file.financeType).toUpperCase() === 'LOAN'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              <span className="material-symbols-outlined text-[12px]">
                                {String(file.financeType).toUpperCase() === 'LOAN' ? 'account_balance' : 'payments'}
                              </span>
                              <span>{file.financeType || 'CASH'}</span>
                            </span>
                            {file.loanBank && (
                              <div className="text-[10px] text-secondary truncate max-w-[130px] mt-0.5" title={file.loanBank}>
                                {file.loanBank}
                              </div>
                            )}
                          </td>

                          {/* Project Stage */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${stageInfo.bg}`}>
                              <span className="material-symbols-outlined text-[13px]">{stageInfo.icon}</span>
                              <span>{stageInfo.label}</span>
                            </span>
                          </td>

                          {/* Documents */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              docCount > 0 ? 'bg-teal-500/10 text-teal-400' : 'bg-surface-container-high text-secondary'
                            }`}>
                              <span className="material-symbols-outlined text-[12px]">attach_file</span>
                              <span>{docCount}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedFileForDetail(file)}
                              className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-secondary text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                              title="Open File Timeline &amp; Documents"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                              <span>Details</span>
                            </button>
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

      {/* ========================================================================= */}
      {/* TAB 2: DEALER ACCOUNTS & CREDENTIALS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-sm">search</span>
              <input
                type="text"
                placeholder="Search by firm name, contact person, mobile, dealer code..."
                value={accountsSearchQuery}
                onChange={(e) => setAccountsSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface placeholder-secondary focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all" className="bg-[#070D18] text-white">All Models</option>
                <option value="Margin Based" className="bg-[#070D18] text-white">Margin Based</option>
                <option value="Kit Based" className="bg-[#070D18] text-white">Kit Based</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all" className="bg-[#070D18] text-white">All Statuses</option>
                <option value="active" className="bg-[#070D18] text-white">Active</option>
                <option value="suspended" className="bg-[#070D18] text-white">Suspended</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-secondary flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
                <p className="text-xs font-medium">Connecting to live PostgreSQL database...</p>
              </div>
            ) : filteredDealers.length === 0 ? (
              <div className="p-12 text-center text-secondary">
                <span className="material-symbols-outlined text-4xl text-secondary mb-2">person_off</span>
                <p className="text-sm font-medium">No dealer accounts found matching filter.</p>
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
                      const code = dealer.dealer_code || dealer.dealerCode || dealer.id;
                      const firm = dealer.firm_name || dealer.firmName || 'Gujarat Solar Dealer';
                      const contact = dealer.contact_person || dealer.contactPerson || 'Authorized Partner';
                      const mobile = dealer.mobile_number || dealer.mobile || '9876543210';
                      const category = dealer.category || dealer.pricing_config?.category || 'Margin Based';
                      const isMargin = category === 'Margin Based';
                      const assignedStaff = dealer.assigned_staff_name || dealer.assignedStaffName || 'Sales Team';

                      return (
                        <tr key={dealer.id || code} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20">
                                {firm.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-on-surface">{firm}</div>
                                <div className="flex items-center gap-2 text-[11px] text-secondary mt-0.5">
                                  <span>{contact}</span>
                                  <span>•</span>
                                  <span className="font-mono text-primary font-bold">{code}</span>
                                  <span>•</span>
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                                    isMargin
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  }`}>
                                    <span className="material-symbols-outlined text-[10px]">{isMargin ? 'percent' : 'inventory_2'}</span>
                                    <span>{category}</span>
                                  </span>
                                </div>
                                <div className="text-[10px] text-secondary mt-1">
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container border border-surface-container-highest text-secondary">
                                    {assignedStaff.includes('Direct') ? assignedStaff : `Sales: ${assignedStaff}`}
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
                            <div className="font-medium text-on-surface">{dealer.city || 'Gujarat'}</div>
                            <div className="text-xs text-secondary mt-0.5 font-mono">
                              {(dealer.discom || 'PGVCL').includes('Circle') ? dealer.discom : `${dealer.discom || 'PGVCL'} Circle`}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="material-symbols-outlined text-xs">workspace_premium</span>
                              <span>{dealer.tier || 'Gold EPC'}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Active in DB</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenPasswordModal(dealer)}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
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
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                                title="Delete Dealer Account"
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

      {/* DETAIL MODAL FOR CUSTOMER FILE */}
      {selectedFileForDetail && (
        <CustomerFileDetailModal
          file={selectedFileForDetail}
          onClose={() => setSelectedFileForDetail(null)}
        />
      )}

      {/* MODAL: ADD / EDIT DEALER ACCOUNT */}
      {showDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">
                  {editingDealer ? 'manage_accounts' : 'person_add'}
                </span>
                <h3 className="font-bold text-on-surface text-base">
                  {editingDealer ? 'Edit Dealer Profile' : 'Onboard New Dealer Partner'}
                </h3>
              </div>
              <button
                onClick={() => setShowDealerModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveDealer} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Dealer Code / ID</label>
                  <input
                    type="text"
                    value={dealerForm.dealerCode}
                    onChange={(e) => setDealerForm({ ...dealerForm, dealerCode: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Pricing Model / Category</label>
                  <select
                    value={dealerForm.category}
                    onChange={(e) => setDealerForm({ ...dealerForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-semibold text-on-surface cursor-pointer"
                  >
                    <option value="Margin Based" className="bg-[#070D18]">Margin Based (₹/kW profit)</option>
                    <option value="Kit Based" className="bg-[#070D18]">Kit Based (Fixed Package)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-secondary mb-1">Dealer Firm Name *</label>
                  <input
                    type="text"
                    value={dealerForm.firmName}
                    onChange={(e) => setDealerForm({ ...dealerForm, firmName: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface font-semibold"
                    placeholder="e.g. Somnath Solar Enterprises"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Contact Person *</label>
                  <input
                    type="text"
                    value={dealerForm.contactPerson}
                    onChange={(e) => setDealerForm({ ...dealerForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface"
                    placeholder="e.g. Ramesh Patel"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Mobile Number (10 digits) *</label>
                  <input
                    type="tel"
                    value={dealerForm.mobile}
                    onChange={(e) => setDealerForm({ ...dealerForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface"
                    placeholder="9876543210"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={dealerForm.email}
                    onChange={(e) => setDealerForm({ ...dealerForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface"
                    placeholder="dealer@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">City / Region (Gujarat)</label>
                  <input
                    type="text"
                    value={dealerForm.city}
                    onChange={(e) => setDealerForm({ ...dealerForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface"
                    placeholder="e.g. Rajkot"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">DISCOM Circle</label>
                  <select
                    value={dealerForm.discom}
                    onChange={(e) => setDealerForm({ ...dealerForm, discom: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface cursor-pointer"
                  >
                    <option value="PGVCL" className="bg-[#070D18]">PGVCL Circle</option>
                    <option value="UGVCL" className="bg-[#070D18]">UGVCL Circle</option>
                    <option value="DGVCL" className="bg-[#070D18]">DGVCL Circle</option>
                    <option value="MGVCL" className="bg-[#070D18]">MGVCL Circle</option>
                    <option value="Torrent Power" className="bg-[#070D18]">Torrent Power</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Partner Tier</label>
                  <select
                    value={dealerForm.tier}
                    onChange={(e) => setDealerForm({ ...dealerForm, tier: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface cursor-pointer"
                  >
                    <option value="Gold EPC" className="bg-[#070D18]">Gold EPC Partner</option>
                    <option value="Diamond" className="bg-[#070D18]">Diamond Partner</option>
                    <option value="Platinum" className="bg-[#070D18]">Platinum Partner</option>
                    <option value="Silver Installer" className="bg-[#070D18]">Silver Installer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">Assigned Sales Executive</label>
                  <select
                    value={dealerForm.assignedStaffId}
                    onChange={(e) => {
                      const staff = (staffList || []).find(s => s.id === e.target.value);
                      setDealerForm({
                        ...dealerForm,
                        assignedStaffId: e.target.value,
                        assignedStaffName: staff ? staff.name : 'Direct to Company (HQ Desk)'
                      });
                    }}
                    className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs text-on-surface cursor-pointer"
                  >
                    <option value="STF-DIRECT" className="bg-[#070D18]">Direct to Company (HQ Desk)</option>
                    {(staffList || []).map(s => (
                      <option key={s.id} value={s.id} className="bg-[#070D18]">
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>

                {!editingDealer && (
                  <div>
                    <label className="block text-xs font-semibold text-secondary mb-1">Login Password *</label>
                    <input
                      type="text"
                      value={dealerForm.password}
                      onChange={(e) => setDealerForm({ ...dealerForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface"
                      placeholder="Minimum 4 characters"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-surface-container-high flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDealerModal(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-secondary rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                  <span>{editingDealer ? 'Save Changes' : 'Complete Onboarding'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="material-symbols-outlined text-lg">key</span>
                <h3 className="font-bold text-on-surface text-sm">Change Dealer Password</h3>
              </div>
              <button
                onClick={() => setPasswordModal({ isOpen: false, dealer: null, newPassword: '', confirmPassword: '', showPass: false })}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-4 space-y-3">
              <div className="text-xs text-secondary">
                Changing password for <span className="font-bold text-on-surface">{passwordModal.dealer?.firm_name || passwordModal.dealer?.firmName}</span>.
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">New Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  value={passwordModal.newPassword}
                  onChange={(e) => setPasswordModal({ ...passwordModal, newPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface"
                  placeholder="Min 4 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Confirm New Password</label>
                <input
                  type={passwordModal.showPass ? 'text' : 'password'}
                  value={passwordModal.confirmPassword}
                  onChange={(e) => setPasswordModal({ ...passwordModal, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container border border-surface-container-highest rounded-lg text-xs font-mono text-on-surface"
                  placeholder="Re-enter password"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dealerShowPass"
                  checked={passwordModal.showPass}
                  onChange={(e) => setPasswordModal({ ...passwordModal, showPass: e.target.checked })}
                  className="rounded text-primary focus:ring-0 cursor-pointer"
                />
                <label htmlFor="dealerShowPass" className="text-xs text-secondary cursor-pointer">
                  Show password
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModal({ isOpen: false, dealer: null, newPassword: '', confirmPassword: '', showPass: false })}
                  className="px-3 py-1.5 bg-surface-container text-secondary rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {submitting && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-rose-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-container-high flex items-center gap-2 text-rose-400">
              <span className="material-symbols-outlined text-xl">warning</span>
              <h3 className="font-bold text-on-surface text-sm">Delete Dealer Account</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-secondary">
                Are you sure you want to delete dealer <span className="font-bold text-on-surface">{deleteModal.dealer?.firm_name || deleteModal.dealer?.firmName}</span>? This action is permanent in the database.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeleteModal({ isOpen: false, dealer: null })}
                  className="px-3 py-1.5 bg-surface-container text-secondary rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
