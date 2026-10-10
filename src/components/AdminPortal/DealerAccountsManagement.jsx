import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import CustomerFileDetailModal from '../Shared/CustomerFileDetailModal';

export default function DealerAccountsManagement() {
  const { addToast } = useToast();
  const {
    customerFiles,
    quotations,
    dealers,
    refreshCustomerFiles,
    setPreviewQuotation,
    setActiveTab
  } = useApp();

  // Navigation Sub Tab: 'files' (Dealer Project Files) or 'quotations' (Dealer Quotations)
  const [activeSubTab, setActiveSubTab] = useState('files');

  // Filters
  const [selectedDealerFilter, setSelectedDealerFilter] = useState('all');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Custom Dealer Dropdown State
  const [isDealerDropdownOpen, setIsDealerDropdownOpen] = useState(false);
  const [dealerSearchInDropdown, setDealerSearchInDropdown] = useState('');
  const dealerDropdownRef = useRef(null);

  // Modal State for File Details
  const [selectedFileForDetail, setSelectedFileForDetail] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dealerDropdownRef.current && !dealerDropdownRef.current.contains(e.target)) {
        setIsDealerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format dealers list cleanly
  const dealersList = useMemo(() => {
    const list = Array.isArray(dealers) ? dealers : [];
    return list.map(d => ({
      id: d.id,
      dealerCode: d.dealer_code || d.dealerCode || d.id,
      firmName: d.firm_name || d.firmName || 'Gujarat Solar Dealer',
      contactPerson: d.contact_person || d.contactPerson || '',
      mobile: d.mobile_number || d.mobile || '',
      city: d.city || 'Gujarat',
      discom: d.discom || 'PGVCL',
      tier: d.tier || 'Gold EPC',
      category: d.category || d.pricing_config?.category || 'Margin Based'
    })).sort((a, b) => a.firmName.localeCompare(b.firmName));
  }, [dealers]);

  // Currently selected dealer object
  const selectedDealer = useMemo(() => {
    if (selectedDealerFilter === 'all') return null;
    return dealersList.find(
      d => d.id === selectedDealerFilter || d.dealerCode === selectedDealerFilter
    ) || null;
  }, [dealersList, selectedDealerFilter]);

  // Filter dealers inside the custom dropdown
  const filteredDealersForDropdown = useMemo(() => {
    if (!dealerSearchInDropdown.trim()) return dealersList;
    const q = dealerSearchInDropdown.toLowerCase().trim();
    return dealersList.filter(d =>
      d.firmName.toLowerCase().includes(q) ||
      d.contactPerson.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.dealerCode.toLowerCase().includes(q)
    );
  }, [dealersList, dealerSearchInDropdown]);

  // -------------------------------------------------------------
  // ALL FILES CREATED BY DEALERS
  // -------------------------------------------------------------
  const allDealerFiles = useMemo(() => {
    const rawFiles = Array.isArray(customerFiles) ? customerFiles : [];

    const dealerCreatedFiles = rawFiles.filter(f => {
      if (!f) return false;
      const isDealerSource = (f.sourceType || f.source || '').toUpperCase() === 'DEALER';
      const hasDealerRef = Boolean(f.dealerId || f.dealer_id || f.dealerName || f.dealer_name);
      return isDealerSource || hasDealerRef;
    });

    // Match ALL dealer quotations that don't already have an explicit customerFile entry
    const dealerQuotesToFiles = (quotations || []).filter(q => {
      if (!q) return false;
      const isDealer = Boolean(q.dealerId || q.dealer_id || (q.dealerName && !q.dealerName.includes('Head Office')));
      if (!isDealer) return false;
      const alreadyHasFile = dealerCreatedFiles.some(f => 
        f.quotationId === q.id || 
        f.id === q.id || 
        f.id === `FIL-${q.id}` ||
        (f.customerName && q.customerName && f.customerName.trim().toLowerCase() === q.customerName.trim().toLowerCase() && f.dealerName && q.dealerName && f.dealerName.trim().toLowerCase() === q.dealerName.trim().toLowerCase())
      );
      return !alreadyHasFile;
    });

    const synthesizedFromQuotes = dealerQuotesToFiles.map(q => {
      const capKw = Number(q.systemCapacityKW || q.capacity?.replace(/[^\d.]/g, '') || 5);
      const isWon = (q.status || '').toLowerCase().includes('won');
      const isApproved = (q.status || '').toLowerCase().includes('approved');
      const stage = isWon ? 'DISCOM_APPLICATION' : (isApproved ? 'QUOTATION_ACCEPTED' : 'LEAD_SOURCED');
      const status = isWon ? 'Won / Order Booked' : (isApproved ? 'Approved' : 'Active / Sent');

      return {
        id: `FIL-${q.quoteNumber || q.id || Date.now()}`,
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
        stage: stage,
        currentStage: stage,
        status: status,
        financeType: q.financeType || 'CASH',
        loanBank: q.loanBank || '',
        createdAt: q.date || q.created_at || new Date().toISOString(),
        documents: {},
        timeline: [
          {
            stage: 'Quotation Created',
            date: q.date || (q.created_at ? new Date(q.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            actor: q.dealerName || 'Dealer Partner',
            notes: `Project file from quotation for ${q.customerName || 'Consumer'}`
          }
        ]
      };
    });

    return [...dealerCreatedFiles, ...synthesizedFromQuotes];
  }, [customerFiles, quotations]);

  // Filtered Files based on current selection
  const displayedFiles = useMemo(() => {
    return allDealerFiles.filter(file => {
      // 1. Dealer filter
      if (selectedDealerFilter !== 'all') {
        const d = selectedDealer;
        const cleanDId = String(selectedDealerFilter).replace(/^#/, '').toLowerCase();
        const cleanFirm = d ? (d.firmName || '').trim().toLowerCase() : '';
        const fileDId = String(file.dealerId || file.dealer_id || '').replace(/^#/, '').toLowerCase();
        const fileDFirm = (file.dealerName || file.dealer_name || '').trim().toLowerCase();

        const matches = (
          (cleanDId && (fileDId === cleanDId || fileDId.includes(cleanDId) || cleanDId.includes(fileDId))) ||
          (cleanFirm && fileDFirm && (fileDFirm === cleanFirm || fileDFirm.includes(cleanFirm) || cleanFirm.includes(fileDFirm)))
        );
        if (!matches) return false;
      }

      // 2. Customer search
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
  }, [allDealerFiles, selectedDealerFilter, selectedDealer, customerSearchQuery, stageFilter]);

  // -------------------------------------------------------------
  // ALL QUOTATIONS CREATED BY DEALERS
  // -------------------------------------------------------------
  const allDealerQuotations = useMemo(() => {
    const quotes = Array.isArray(quotations) ? quotations : [];
    return quotes.filter(q => {
      if (!q) return false;
      const isDealerName = q.dealerName && !q.dealerName.includes('Head Office');
      const hasDealerId = Boolean(q.dealerId || q.dealer_id);
      return isDealerName || hasDealerId;
    });
  }, [quotations]);

  // Filtered Quotations based on current selection
  const displayedQuotes = useMemo(() => {
    return allDealerQuotations.filter(q => {
      // 1. Dealer filter
      if (selectedDealerFilter !== 'all') {
        const d = selectedDealer;
        const cleanDId = String(selectedDealerFilter).replace(/^#/, '').toLowerCase();
        const cleanFirm = d ? (d.firmName || '').trim().toLowerCase() : '';
        const qDId = String(q.dealerId || q.dealer_id || '').replace(/^#/, '').toLowerCase();
        const qDFirm = (q.dealerName || q.dealer_name || '').trim().toLowerCase();

        const matches = (
          (cleanDId && (qDId === cleanDId || qDId.includes(cleanDId) || cleanDId.includes(qDId))) ||
          (cleanFirm && qDFirm && (qDFirm === cleanFirm || qDFirm.includes(cleanFirm) || cleanFirm.includes(qDFirm)))
        );
        if (!matches) return false;
      }

      // 2. Customer search
      if (customerSearchQuery.trim()) {
        const term = customerSearchQuery.toLowerCase().trim();
        const name = (q.customerName || '').toLowerCase();
        const phone = String(q.customerPhone || q.phone || '');
        const id = String(q.quoteNumber || q.id || '').toLowerCase();
        const city = String(q.city || q.location || '').toLowerCase();
        if (!name.includes(term) && !phone.includes(term) && !id.includes(term) && !city.includes(term)) {
          return false;
        }
      }

      // 3. Quote Status filter
      if (quoteStatusFilter !== 'all') {
        const s = (q.status || '').toLowerCase();
        if (!s.includes(quoteStatusFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [allDealerQuotations, selectedDealerFilter, selectedDealer, customerSearchQuery, quoteStatusFilter]);

  // -------------------------------------------------------------
  // DYNAMIC KPI CALCULATIONS
  // -------------------------------------------------------------
  const totalFilesCapacityKw = useMemo(() => {
    return displayedFiles.reduce((acc, f) => acc + (Number(f.solarSystemKw || f.solar_system_kw) || 0), 0);
  }, [displayedFiles]);

  const totalQuotesValue = useMemo(() => {
    return displayedQuotes.reduce((acc, q) => acc + (Number(q.grandTotalCustomer || q.totalAmount) || 0), 0);
  }, [displayedQuotes]);

  const totalQuotesCapacityKw = useMemo(() => {
    return displayedQuotes.reduce((acc, q) => acc + (Number(q.systemCapacityKW || q.capacity?.replace(/[^\d.]/g, '')) || 0), 0);
  }, [displayedQuotes]);

  const totalCombinedCapacityKw = totalFilesCapacityKw + totalQuotesCapacityKw;

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (typeof refreshCustomerFiles === 'function') await refreshCustomerFiles();
      if (addToast) addToast({ title: 'Data Refreshed', message: 'Dealer files & quotations synced with live database', type: 'success' });
    } catch {
      // silent
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  // Helper for stage styling
  const getStageBadge = (stage = '', status = '') => {
    const s = (stage || status || '').toLowerCase();
    if (s.includes('lead') || s.includes('sourced')) {
      return { label: 'Lead Sourced', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'person_add' };
    }
    if (s.includes('survey') || s.includes('feasibility')) {
      return { label: 'Feasibility Approved', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'verified' };
    }
    if (s.includes('discom')) {
      return { label: 'DISCOM Application', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'electric_meter' };
    }
    if (s.includes('install')) {
      return { label: 'Solar Installation', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'solar_power' };
    }
    if (s.includes('sync') || s.includes('meter')) {
      return { label: 'Net-Meter Synced', bg: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'sync_alt' };
    }
    if (s.includes('subsidy')) {
      return { label: 'Subsidy Claim', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'payments' };
    }
    if (s.includes('complete') || s.includes('commission')) {
      return { label: 'Commissioned', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'check_circle' };
    }
    if (s.includes('cancel')) {
      return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'cancel' };
    }
    return { label: stage || status || 'In Progress', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'pending' };
  };

  const handleViewPdf = (quote) => {
    if (setPreviewQuotation) setPreviewQuotation(quote);
    if (setActiveTab) setActiveTab('preview_quote');
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EB]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#107C41] text-[28px]">handshake</span>
            <h1 className="text-xl sm:text-2xl font-bold font-poppins text-slate-900">
              Dealer Operations &amp; Commercial Pipeline
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Comprehensive console for Gujarat Dealer Partners — view consumer project files, quotations, and commercial pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-10 px-4 bg-white border border-[#E4E7EB] hover:bg-[#F6F8F7] text-slate-800 font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            title="Refresh Files &amp; Quotations from Database"
          >
            <span className={`material-symbols-outlined text-[18px] text-slate-600 ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 KPI CARDS — UNIFORM, MATCHING LIGHT THEME & DYNAMIC RECALCULATION */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL DEALERS (or Selected Dealer) */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              {selectedDealer ? 'Selected Dealer' : 'Total Dealers'}
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-poppins text-slate-900">
              {selectedDealer ? '1' : dealersList.length}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate" title={selectedDealer ? selectedDealer.firmName : 'Gujarat Empanelled Network'}>
              {selectedDealer ? `${selectedDealer.firmName} (${selectedDealer.city || 'Gujarat'})` : '100% Gujarat Empanelled'}
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL CONSUMER FILES ("उस dealer की total कितनी files है") */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              {selectedDealer ? 'Dealer Consumer Files' : 'Total Project Files'}
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[18px]">folder_shared</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-poppins text-slate-900">
              {displayedFiles.length} <span className="text-xs font-normal text-slate-500">Files</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {selectedDealer ? `${selectedDealer.firmName} Projects` : `${totalFilesCapacityKw.toFixed(1)} kW Solar Pipeline`}
            </div>
          </div>
        </div>

        {/* Card 3: TOTAL QUOTATIONS ("उसके कितने quotations हैं") */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              {selectedDealer ? 'Dealer Quotations' : 'Total Quotations'}
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[18px]">request_quote</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-poppins text-slate-900">
              {displayedQuotes.length} <span className="text-xs font-normal text-slate-500">Quotes</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {selectedDealer ? `${selectedDealer.firmName} Issued` : `₹${Math.round(totalQuotesValue).toLocaleString('en-IN')} Total Value`}
            </div>
          </div>
        </div>

        {/* Card 4: COMBINED SOLAR CAPACITY (kW) */}
        <div className="bg-white rounded-xl border border-[#E4E7EB] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              Total Solar Capacity
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[18px]">solar_power</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-poppins text-slate-900">
              {totalCombinedCapacityKw.toFixed(1)} <span className="text-xs font-normal text-slate-500">kW</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {selectedDealer ? `${selectedDealer.category} • ${selectedDealer.tier}` : 'Active Gujarat Capacity'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABS: Project Files vs Quotations (Clean Green Pill Design) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-[#E4E7EB] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeSubTab === 'files'
              ? 'bg-[#107C41] text-white shadow-xs'
              : 'bg-white border border-[#E4E7EB] text-slate-600 hover:text-slate-900 hover:bg-[#F6F8F7]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">folder_shared</span>
          <span>Dealer Project Files</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            activeSubTab === 'files' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {displayedFiles.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('quotations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeSubTab === 'quotations'
              ? 'bg-[#107C41] text-white shadow-xs'
              : 'bg-white border border-[#E4E7EB] text-slate-600 hover:text-slate-900 hover:bg-[#F6F8F7]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">request_quote</span>
          <span>Dealer Quotations</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            activeSubTab === 'quotations' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {displayedQuotes.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & FILTERS TOOLBAR (With Clean White Custom Dealer Dropdown) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Customer Search */}
        <div className="relative flex-1 min-w-[260px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder={
              activeSubTab === 'files'
                ? "Search by customer name, mobile, consumer number, city, or file ID..."
                : "Search by customer name, mobile, city, or quotation ID..."
            }
            value={customerSearchQuery}
            onChange={(e) => setCustomerSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#F6F8F7] border border-[#E4E7EB] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#107C41] transition-all"
          />
          {customerSearchQuery && (
            <button
              onClick={() => setCustomerSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Right Filter Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1. Custom Clean Dealer Dropdown (No Black Native Select!) */}
          <div className="relative" ref={dealerDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDealerDropdownOpen(!isDealerDropdownOpen)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                selectedDealerFilter !== 'all'
                  ? 'bg-emerald-50 border-[#107C41] text-[#107C41]'
                  : 'bg-white border-[#E4E7EB] hover:bg-[#F6F8F7] text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">storefront</span>
              <span className="max-w-[180px] sm:max-w-[220px] truncate">
                {selectedDealer ? `${selectedDealer.firmName}` : `All Dealers (${dealersList.length})`}
              </span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {isDealerDropdownOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isDealerDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-white border border-[#E4E7EB] rounded-xl shadow-xl z-50 p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-[16px]">search</span>
                  <input
                    type="text"
                    placeholder="Search dealer firm name or city..."
                    value={dealerSearchInDropdown}
                    onChange={(e) => setDealerSearchInDropdown(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F6F8F7] border border-[#E4E7EB] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#107C41]"
                    autoFocus
                  />
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F4F9]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDealerFilter('all');
                      setIsDealerDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 text-left text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDealerFilter === 'all'
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'hover:bg-[#F6F8F7] text-slate-700'
                    }`}
                  >
                    <span>All Dealers ({dealersList.length} Registered)</span>
                    {selectedDealerFilter === 'all' && (
                      <span className="material-symbols-outlined text-[16px] text-[#107C41]">check</span>
                    )}
                  </button>

                  {filteredDealersForDropdown.map((d) => (
                    <button
                      key={d.id || d.dealerCode}
                      type="button"
                      onClick={() => {
                        setSelectedDealerFilter(d.id || d.dealerCode);
                        setIsDealerDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 text-left text-xs rounded-lg flex flex-col gap-0.5 transition-colors cursor-pointer ${
                        selectedDealerFilter === (d.id || d.dealerCode)
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'hover:bg-[#F6F8F7] text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold truncate text-slate-900">{d.firmName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{d.dealerCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{d.city}</span>
                        <span>•</span>
                        <span>{d.discom}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">{d.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Stage Filter (Files Tab) or Status Filter (Quotes Tab) */}
          {activeSubTab === 'files' ? (
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-[#E4E7EB] rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#107C41] cursor-pointer shadow-xs"
            >
              <option value="all">All Project Stages</option>
              <option value="lead">Lead Sourced</option>
              <option value="feasibility">Feasibility Approved</option>
              <option value="discom">DISCOM Application</option>
              <option value="install">Solar Installation</option>
              <option value="sync">Net-Meter Sync</option>
              <option value="complete">Commissioned</option>
            </select>
          ) : (
            <select
              value={quoteStatusFilter}
              onChange={(e) => setQuoteStatusFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-[#E4E7EB] rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#107C41] cursor-pointer shadow-xs"
            >
              <option value="all">All Quote Statuses</option>
              <option value="Active">Active / Sent</option>
              <option value="Won">Won / Order Booked</option>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
            </select>
          )}

          {/* Reset Filters */}
          {(selectedDealerFilter !== 'all' || customerSearchQuery || stageFilter !== 'all' || quoteStatusFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedDealerFilter('all');
                setCustomerSearchQuery('');
                setStageFilter('all');
                setQuoteStatusFilter('all');
              }}
              className="h-9 px-3 rounded-lg bg-[#F6F8F7] hover:bg-[#E4E7EB] border border-[#E4E7EB] text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
              title="Reset all filters"
            >
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DEALER PROJECT FILES TABLE */}
      {/* ========================================================================= */}
      {activeSubTab === 'files' && (
        <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          {displayedFiles.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[28px]">folder_off</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No Dealer Project Files Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedDealerFilter !== 'all' || customerSearchQuery || stageFilter !== 'all'
                    ? 'No consumer project files match the selected filter criteria.'
                    : 'Dealers have not submitted any consumer project files yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F8FAFC] text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-[#E4E7EB]">
                  <tr>
                    <th className="py-3 px-4">File ID &amp; Date</th>
                    <th className="py-3 px-4">Consumer / Customer</th>
                    <th className="py-3 px-4">Dealer Partner</th>
                    <th className="py-3 px-4">System Size</th>
                    <th className="py-3 px-4">Finance Mode</th>
                    <th className="py-3 px-4">Project Stage</th>
                    <th className="py-3 px-4 text-center">Docs</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F4F9]">
                  {displayedFiles.map((file) => {
                    const stageInfo = getStageBadge(file.currentStage || file.stage, file.status);
                    const fileDate = file.createdAt
                      ? new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Recent';
                    const docCount = file.documents && typeof file.documents === 'object' ? Object.keys(file.documents).length : 0;
                    const capKw = Number(file.solarSystemKw || file.solar_system_kw) || 4.4;

                    return (
                      <tr
                        key={file.id}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedFileForDetail(file)}
                      >
                        {/* File ID & Date */}
                        <td className="py-3.5 px-4 font-mono font-medium">
                          <div className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">description</span>
                            <span>{file.id}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{fileDate}</div>
                        </td>

                        {/* Customer Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {file.customerName || file.customer_name || 'Solar Consumer'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center gap-0.5 font-mono">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">phone</span>
                              <span>{file.phone || 'N/A'}</span>
                            </span>
                            <span>•</span>
                            <span>{file.city || file.discom || 'Gujarat'}</span>
                          </div>
                          {file.consumerNo && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Consumer: {file.consumerNo}
                            </div>
                          )}
                        </td>

                        {/* Dealer Partner */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-emerald-600 text-[16px]">storefront</span>
                            <span className="font-semibold text-slate-800">
                              {file.dealerName || file.dealer_name || 'Dealer Partner'}
                            </span>
                          </div>
                          {file.dealerId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {String(file.dealerId).slice(0, 16)}
                            </div>
                          )}
                        </td>

                        {/* Solar Capacity */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold font-mono text-emerald-700 text-sm">
                            {capKw} kW
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {file.roofType || 'RCC Flat'}
                          </div>
                        </td>

                        {/* Payment / Finance */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            String(file.financeType).toUpperCase() === 'LOAN'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {String(file.financeType).toUpperCase() === 'LOAN' ? 'account_balance' : 'payments'}
                            </span>
                            <span>{file.financeType || 'CASH'}</span>
                          </span>
                          {file.loanBank && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[130px] mt-0.5" title={file.loanBank}>
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
                            docCount > 0 ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">attach_file</span>
                            <span>{docCount}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedFileForDetail(file)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#107C41] hover:text-white text-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ml-auto shadow-2xs"
                            title="View Full File Timeline &amp; Documents"
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
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEALER QUOTATIONS TABLE */}
      {/* ========================================================================= */}
      {activeSubTab === 'quotations' && (
        <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          {displayedQuotes.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[28px]">request_quote</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No Dealer Quotations Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedDealerFilter !== 'all' || customerSearchQuery || quoteStatusFilter !== 'all'
                    ? 'No quotations match the selected filter criteria.'
                    : 'Dealers have not generated any quotations yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F8FAFC] text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-[#E4E7EB]">
                  <tr>
                    <th className="py-3 px-4">Quote ID &amp; Date</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Dealer Partner</th>
                    <th className="py-3 px-4">System Size</th>
                    <th className="py-3 px-4">Customer Total</th>
                    <th className="py-3 px-4">Quote Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F4F9]">
                  {displayedQuotes.map((q) => {
                    const quoteNumber = q.quoteNumber || q.id;
                    const quoteDate = q.displayDate || q.date || (q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent');
                    const capKw = Number(q.systemCapacityKW || q.capacity?.replace(/[^\d.]/g, '') || 5);
                    const grandTotal = Number(q.grandTotalCustomer || q.totalAmount || 0);
                    const isWon = (q.status || '').toLowerCase().includes('won');
                    const isApproved = (q.status || '').toLowerCase().includes('approved');

                    return (
                      <tr
                        key={q.id || quoteNumber}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => handleViewPdf(q)}
                      >
                        {/* Quote ID & Date */}
                        <td className="py-3.5 px-4 font-mono font-medium">
                          <div className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">tag</span>
                            <span>{quoteNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{quoteDate}</div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {q.customerName || 'Solar Consumer'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center gap-0.5 font-mono">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">phone</span>
                              <span>{q.customerPhone || q.phone || 'N/A'}</span>
                            </span>
                            <span>•</span>
                            <span>{q.city || q.location || q.discom || 'Gujarat'}</span>
                          </div>
                        </td>

                        {/* Dealer Partner */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-emerald-600 text-[16px]">storefront</span>
                            <span className="font-semibold text-slate-800">
                              {q.dealerName || 'Dealer Partner'}
                            </span>
                          </div>
                          {q.dealerId && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {String(q.dealerId).slice(0, 16)}
                            </div>
                          )}
                        </td>

                        {/* Capacity */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold font-mono text-emerald-700 text-sm">
                            {capKw} kW
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[130px]" title={q.solarModule}>
                            {q.solarModule || 'Waaree Bifacial'}
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold font-mono text-slate-900 text-sm">
                            ₹{grandTotal.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Subsidy: ₹{Number(q.subsidyAmount || (capKw <= 2 ? 60000 : 78000)).toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isWon
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isApproved
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            <span className="material-symbols-outlined text-[13px]">
                              {isWon ? 'check_circle' : isApproved ? 'verified' : 'send'}
                            </span>
                            <span>{q.status || 'Active / Sent'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewPdf(q)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#107C41] hover:text-white text-slate-700 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ml-auto shadow-2xs"
                            title="Open Full Quotation PDF Preview"
                          >
                            <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                            <span>View PDF</span>
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
      )}

      {/* FILE DETAIL MODAL */}
      {selectedFileForDetail && (
        <CustomerFileDetailModal
          file={selectedFileForDetail}
          onClose={() => setSelectedFileForDetail(null)}
        />
      )}
    </div>
  );
}
