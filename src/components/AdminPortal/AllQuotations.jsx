import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';

export default function AllQuotations() {
  const { quotations, setPreviewQuotation, setActiveTab, dealers, addNotification, updateQuotationStatus, clearEditingQuotation, clearActiveDraftQuote } = useApp();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState('all');
  const [marginProfileFilter, setMarginProfileFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedAuditQuote, setSelectedAuditQuote] = useState(null);
  const [viewMode, setViewMode] = useTableViewMode('admin_all_quotations');

  // Top Filter Controls (SR-18)
  const [datePresetLabel, setDatePresetLabel] = useState('Current Fiscal (2025-26)');
  const [startDate, setStartDate] = useState('2025-04-01');
  const [endDate, setEndDate] = useState('2026-03-31');
  const [customStart, setCustomStart] = useState('2025-04-01');
  const [customEnd, setCustomEnd] = useState('2026-03-31');
  const [dateError, setDateError] = useState('');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const [selectedDealerId, setSelectedDealerId] = useState('all');
  const [selectedDealerName, setSelectedDealerName] = useState('');
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');

  const [selectedDiscom, setSelectedDiscom] = useState('all');
  const [showDiscomDropdown, setShowDiscomDropdown] = useState(false);

  const dateDropdownRef = useRef(null);
  const dealerDropdownRef = useRef(null);
  const discomDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setShowDateDropdown(false);
      }
      if (dealerDropdownRef.current && !dealerDropdownRef.current.contains(e.target)) {
        setShowDealerDropdown(false);
      }
      if (discomDropdownRef.current && !discomDropdownRef.current.contains(e.target)) {
        setShowDiscomDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleApplyPresetDate = (label, start, end) => {
    setDatePresetLabel(label);
    setStartDate(start);
    setEndDate(end);
    setCustomStart(start || '2025-04-01');
    setCustomEnd(end || '2026-03-31');
    setDateError('');
    setCurrentPage(1);
    setShowDateDropdown(false);
  };

  const handleApplyCustomDate = () => {
    if (customStart && customEnd && customStart > customEnd) {
      setDateError('Start date cannot be after end date.');
      return;
    }
    setDateError('');
    setStartDate(customStart);
    setEndDate(customEnd);
    setDatePresetLabel(
      customStart && customEnd
        ? `${customStart} to ${customEnd}`
        : customStart
        ? `From ${customStart}`
        : customEnd
        ? `Until ${customEnd}`
        : 'All Time Records'
    );
    setCurrentPage(1);
    setShowDateDropdown(false);
  };

  const handleSelectDealer = (id, name) => {
    setSelectedDealerId(id);
    setSelectedDealerName(name);
    setCurrentPage(1);
    setShowDealerDropdown(false);
  };

  const handleSelectDiscom = (discom) => {
    setSelectedDiscom(discom);
    setCurrentPage(1);
    setShowDiscomDropdown(false);
  };

  const handleResetAllTopFilters = () => {
    setDatePresetLabel('Current Fiscal (2025-26)');
    setStartDate('2025-04-01');
    setEndDate('2026-03-31');
    setCustomStart('2025-04-01');
    setCustomEnd('2026-03-31');
    setDateError('');
    setSelectedDealerId('all');
    setSelectedDealerName('');
    setSelectedDiscom('all');
    setCurrentPage(1);
  };

  const isAnyTopFilterActive =
    datePresetLabel !== 'Current Fiscal (2025-26)' ||
    selectedDealerId !== 'all' ||
    selectedDiscom !== 'all';

  const handleViewPdf = (quoteData) => {
    if (setPreviewQuotation) {
      setPreviewQuotation(quoteData);
      setActiveTab('preview_quote');
    }
  };

  const allQuotes = quotations && quotations.length > 0 ? quotations : [];
  const totalDealersCount = dealers?.length || 550;

  const filteredDealersList = useMemo(() => {
    const list = dealers || [];
    if (!dealerSearchQuery.trim()) return list.slice(0, 25);
    const q = dealerSearchQuery.toLowerCase().trim();
    return list.filter(d => 
      (d.firmName && d.firmName.toLowerCase().includes(q)) ||
      (d.id && d.id.toLowerCase().includes(q)) ||
      (d.city && d.city.toLowerCase().includes(q))
    ).slice(0, 25);
  }, [dealers, dealerSearchQuery]);

  // Filter quotes
  const filteredQuotes = allQuotes.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (q.quoteNumber && q.quoteNumber.toLowerCase().includes(term)) ||
                        (q.id && q.id.toLowerCase().includes(term)) ||
                        (q.customerName && q.customerName.toLowerCase().includes(term)) ||
                        (q.dealerName && q.dealerName.toLowerCase().includes(term)) ||
                        (q.dealerId && q.dealerId.toLowerCase().includes(term)) ||
                        (q.city && q.city.toLowerCase().includes(term));

    if (!matchSearch) return false;

    const statusLower = (q.status || '').toLowerCase();
    if (activeTabFilter === 'approved' && !statusLower.includes('approved') && !statusLower.includes('active') && !statusLower.includes('sent')) return false;
    if (activeTabFilter === 'discom' && !statusLower.includes('discom') && !statusLower.includes('sanctioned') && !statusLower.includes('review') && !statusLower.includes('pending')) return false;
    if (activeTabFilter === 'draft' && !statusLower.includes('draft') && !statusLower.includes('stale')) return false;

    const marginPerKw = q.dealerMarginPerKW || (q.dealerTotalMargin && q.systemCapacityKW ? Math.round(q.dealerTotalMargin / q.systemCapacityKW) : 0);
    if (marginProfileFilter === 'high' && marginPerKw <= 4500) return false;
    if (marginProfileFilter === 'flagged' && marginPerKw <= 5500) return false;
    if (marginProfileFilter === 'compliant' && marginPerKw > 5500) return false;

    // Date range filter
    if (startDate || endDate) {
      const qDate = q.date;
      if (qDate) {
        if (startDate && qDate < startDate) return false;
        if (endDate && qDate > endDate) return false;
      }
    }

    // Dealer filter
    if (selectedDealerId !== 'all') {
      if (q.dealerId !== selectedDealerId && q.dealerName !== selectedDealerName) return false;
    }

    // DISCOM filter
    if (selectedDiscom !== 'all') {
      const qDiscom = (q.discom || '').toUpperCase();
      if (!qDiscom.includes(selectedDiscom.toUpperCase())) return false;
    }

    return true;
  });

  // Metrics reflect filtered dataset
  const totalProposalsCount = filteredQuotes.length;
  const totalValue = filteredQuotes.reduce((acc, q) => acc + Number(q.total_amount || q.grandTotalCustomer || q.totalAmount || 0), 0);
  const totalCapacityKW = filteredQuotes.reduce((acc, q) => acc + (parseFloat(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 0)), 0);
  const totalCapacityMW = (totalCapacityKW / 1000).toFixed(2);
  const avgValue = totalProposalsCount > 0 ? Math.round(totalValue / totalProposalsCount) : 0;

  // Dynamic Average Dealer Margin calculation (SR-21)
  // Weight-average: total dealer margin rupees / total commissioned kW
  const { avgMarginPerKw, avgMarginComplianceStatus } = (() => {
    const quotesWithMargin = filteredQuotes.filter(q =>
      (q.dealer_margin || q.dealerMarginPerKW || q.dealerTotalMargin) && (q.system_capacity_kw || q.systemCapacityKW || q.capacity)
    );
    if (quotesWithMargin.length === 0) return { avgMarginPerKw: 0, avgMarginComplianceStatus: 'no-data' };

    const totalMarginRupees = quotesWithMargin.reduce((acc, q) => {
      const kw = parseFloat(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 0);
      const totalMargin = Number(q.dealer_margin || q.dealerTotalMargin || (q.dealerMarginPerKW ? q.dealerMarginPerKW * kw : 0));
      return acc + totalMargin;
    }, 0);

    const totalKwWithMargin = quotesWithMargin.reduce((acc, q) =>
      acc + parseFloat(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 0), 0);

    const avg = totalKwWithMargin > 0 ? Math.round(totalMarginRupees / totalKwWithMargin) : 0;

    // Flag any quote with margin > ₹5,500/kW as non-compliant
    const flaggedCount = quotesWithMargin.filter(q => {
      const kw = parseFloat(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 0);
      const totalMargin = Number(q.dealer_margin || q.dealerTotalMargin || (q.dealerMarginPerKW ? q.dealerMarginPerKW * kw : 0));
      const marg = kw > 0 ? Math.round(totalMargin / kw) : 0;
      return marg > 5500;
    }).length;

    const status = flaggedCount > 0 ? 'flagged' : avg > 5000 ? 'review' : 'compliant';
    return { avgMarginPerKw: avg, avgMarginComplianceStatus: status };
  })();

  const totalPages = Math.ceil(filteredQuotes.length / pageSize) || 1;
  const paginatedQuotes = filteredQuotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Structured CSV Gujarat Quotations Ledger Export
  const handleExportProposals = () => {
    const targetQuotes = filteredQuotes && filteredQuotes.length > 0 ? filteredQuotes : allQuotes;
    if (!targetQuotes || targetQuotes.length === 0) {
      if (addToast) {
        addToast({
          title: 'Export Unavailable',
          message: 'No quotation records found matching the current filters.',
          type: 'warning'
        });
      }
      return;
    }

    const headers = [
      'Quotation ID',
      'Date',
      'Dealer ID',
      'Dealer Name',
      'Customer Name',
      'Location / City',
      'DISCOM Circle',
      'System Capacity (kW)',
      'Solar Module Brand',
      'Inverter Model',
      'Base Rate/kW (INR)',
      'Base Amount (INR)',
      'Dealer Margin/kW (INR)',
      'Dealer Total Margin (INR)',
      'Customer Grand Total (INR)',
      'Subsidy Amount (INR)',
      'Net Payable (INR)',
      'Quotation Status'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];
    targetQuotes.forEach((q) => {
      const row = [
        escapeCsv(q.quoteNumber || q.id),
        escapeCsv(q.displayDate || q.date || '2026-09-23'),
        escapeCsv(q.dealerId),
        escapeCsv(q.dealerName),
        escapeCsv(q.customerName),
        escapeCsv(q.location || `${q.city || 'Gujarat'}, Gujarat`),
        escapeCsv(q.discom),
        escapeCsv(q.systemCapacityKW || q.capacity),
        escapeCsv(q.solarModule || 'Waaree / APS Bifacial'),
        escapeCsv(q.inverterType || 'Sunvine Smart Series MPPT Grid-Tied'),
        escapeCsv(q.baseRatePerKW || 59800),
        escapeCsv(q.baseTotalAmount || Math.round((q.systemCapacityKW || 5) * 59800)),
        escapeCsv(q.dealerMarginPerKW || 4500),
        escapeCsv(q.dealerTotalMargin || (q.dealerMarginPerKW ? Math.round(q.dealerMarginPerKW * (q.systemCapacityKW || 5)) : 22500)),
        escapeCsv(q.grandTotalCustomer || q.totalAmount),
        escapeCsv(q.subsidyAmount || (q.systemCapacityKW <= 2 ? 60000 : 78000)),
        escapeCsv(q.netPayable || q.grandTotalCustomer),
        escapeCsv(q.status)
      ];
      csvRows.push(row.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Intl.DateTimeFormat('en-CA').format(new Date());
    const filterTag = activeTabFilter !== 'all' ? `_${activeTabFilter.toUpperCase()}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `Sunvine_Gujarat_Proposals_${dateStr}${filterTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (addToast) {
      addToast({
        title: 'Proposals Exported',
        message: `Successfully exported ${targetQuotes.length} Gujarat quotation records to CSV.`,
        type: 'success'
      });
    }

    if (addNotification) {
      addNotification({
        title: 'Quotations Ledger Exported',
        description: `Exported ${targetQuotes.length} proposals ledger records to CSV.`,
        type: 'info',
        icon: 'download',
        audience: 'admin'
      });
    }
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* 1. Breadcrumbs & Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-surface-container-highest">
        <div>
          <nav className="flex items-center gap-1.5 text-xs font-label-xs text-secondary mb-1">
            <span>Admin Console</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>Gujarat Ledger</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-on-surface font-medium">All Quotations Master</span>
          </nav>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Gujarat Quotation Master Directory
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Centralized oversight of customer quotations issued across all {totalDealersCount} registered Gujarat dealers, margin audits, and conversion stages.
          </p>
        </div>
        {/* Action Controls Row - Functional Top Filters (SR-18) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Date Range Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => {
                setShowDateDropdown(!showDateDropdown);
                setShowDealerDropdown(false);
                setShowDiscomDropdown(false);
              }}
              className={`h-9 px-3.5 rounded-lg border text-xs font-label-md flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                datePresetLabel !== 'Current Fiscal (2025-26)'
                  ? 'bg-primary-container/15 border-primary text-primary font-semibold'
                  : 'bg-white border-[#E4E7EB] hover:bg-[#F6F8F7] text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">calendar_today</span>
              <span>Date: {datePresetLabel}</span>
              <span className="material-symbols-outlined text-[14px] text-secondary">
                {showDateDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showDateDropdown && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 sm:w-80 bg-white border border-[#E4E7EB] rounded-xl shadow-xl z-50 p-3 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Date Presets</span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('Current Fiscal (2025-26)', '2025-04-01', '2026-03-31')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-colors ${
                      datePresetLabel === 'Current Fiscal (2025-26)'
                        ? 'border-primary bg-primary-container/20 text-primary font-semibold'
                        : 'border-[#E4E7EB] bg-[#F6F8F7] hover:bg-[#E4E7EB] text-on-surface'
                    }`}
                  >
                    Fiscal 2025-26
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('October 2025', '2025-10-01', '2025-10-31')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-colors ${
                      datePresetLabel === 'October 2025'
                        ? 'border-primary bg-primary-container/20 text-primary font-semibold'
                        : 'border-[#E4E7EB] bg-[#F6F8F7] hover:bg-[#E4E7EB] text-on-surface'
                    }`}
                  >
                    October 2025
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('Q2 (Jul-Sep 2025)', '2025-07-01', '2025-09-30')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-colors ${
                      datePresetLabel === 'Q2 (Jul-Sep 2025)'
                        ? 'border-primary bg-primary-container/20 text-primary font-semibold'
                        : 'border-[#E4E7EB] bg-[#F6F8F7] hover:bg-[#E4E7EB] text-on-surface'
                    }`}
                  >
                    Q2 Jul-Sep 2025
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('All Time Records', '', '')}
                    className={`px-2.5 py-1.5 rounded-lg border text-left font-medium transition-colors ${
                      datePresetLabel === 'All Time Records'
                        ? 'border-primary bg-primary-container/20 text-primary font-semibold'
                        : 'border-[#E4E7EB] bg-[#F6F8F7] hover:bg-[#E4E7EB] text-on-surface'
                    }`}
                  >
                    All Time Records
                  </button>
                </div>

                <div className="pt-2 border-t border-[#E4E7EB] flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Custom Range</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-secondary block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded border border-[#E4E7EB] bg-white text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-secondary block mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded border border-[#E4E7EB] bg-white text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  {dateError && <span className="text-[11px] text-red-600 font-medium">{dateError}</span>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E4E7EB] text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('Current Fiscal (2025-26)', '2025-04-01', '2026-03-31')}
                    className="text-secondary hover:text-on-surface font-semibold"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomDate}
                    className="px-3 py-1 bg-primary text-white rounded font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Dealers Dropdown */}
          <div className="relative" ref={dealerDropdownRef}>
            <button
              onClick={() => {
                setShowDealerDropdown(!showDealerDropdown);
                setShowDateDropdown(false);
                setShowDiscomDropdown(false);
              }}
              className={`h-9 px-3.5 rounded-lg border text-xs font-label-md flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                selectedDealerId !== 'all'
                  ? 'bg-primary-container/15 border-primary text-primary font-semibold'
                  : 'bg-white border-[#E4E7EB] hover:bg-[#F6F8F7] text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">storefront</span>
              <span className="max-w-[150px] sm:max-w-[180px] truncate">
                {selectedDealerId === 'all'
                  ? `Dealers: ${totalDealersCount} (100% Gujarat)`
                  : selectedDealerName || selectedDealerId}
              </span>
              <span className="material-symbols-outlined text-[14px] text-secondary">
                {showDealerDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showDealerDropdown && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-80 bg-white border border-[#E4E7EB] rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Filter By Dealer</span>
                  {selectedDealerId !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleSelectDealer('all', '')}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-secondary text-[16px]">search</span>
                  <input
                    type="text"
                    value={dealerSearchQuery}
                    onChange={(e) => setDealerSearchQuery(e.target.value)}
                    placeholder="Search dealer name, city, ID..."
                    className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-[#E4E7EB] bg-white text-on-surface outline-none focus:border-primary"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F4F9]">
                  <button
                    type="button"
                    onClick={() => handleSelectDealer('all', '')}
                    className={`w-full px-2.5 py-2 text-left text-xs rounded-lg flex items-center justify-between transition-colors ${
                      selectedDealerId === 'all' ? 'bg-primary-container/20 text-primary font-semibold' : 'hover:bg-[#F6F8F7] text-on-surface'
                    }`}
                  >
                    <span>All Dealers ({totalDealersCount} Registered)</span>
                    {selectedDealerId === 'all' && (
                      <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                    )}
                  </button>

                  {filteredDealersList.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDealer(d.id, d.firmName)}
                      className={`w-full px-2.5 py-2 text-left text-xs rounded-lg flex flex-col gap-0.5 transition-colors ${
                        selectedDealerId === d.id ? 'bg-primary-container/20 text-primary font-semibold' : 'hover:bg-[#F6F8F7] text-on-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{d.firmName}</span>
                        <span className="text-[10px] text-secondary font-mono">{d.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-secondary">
                        <span>{d.city}</span>
                        <span>•</span>
                        <span>{d.discom}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. DISCOMs Dropdown */}
          <div className="relative" ref={discomDropdownRef}>
            <button
              onClick={() => {
                setShowDiscomDropdown(!showDiscomDropdown);
                setShowDateDropdown(false);
                setShowDealerDropdown(false);
              }}
              className={`h-9 px-3.5 rounded-lg border text-xs font-label-md flex items-center gap-2 shadow-xs transition-colors cursor-pointer ${
                selectedDiscom !== 'all'
                  ? 'bg-primary-container/15 border-primary text-primary font-semibold'
                  : 'bg-white border-[#E4E7EB] hover:bg-[#F6F8F7] text-on-surface'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">electric_meter</span>
              <span>
                {selectedDiscom === 'all' ? 'DISCOMs: PGVCL, DGVCL, MGVCL, UGVCL' : `DISCOM: ${selectedDiscom}`}
              </span>
              <span className="material-symbols-outlined text-[14px] text-secondary">
                {showDiscomDropdown ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showDiscomDropdown && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 bg-white border border-[#E4E7EB] rounded-xl shadow-xl z-50 p-2.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider px-2 py-1">
                  Gujarat DISCOM Circles
                </span>
                {[
                  { id: 'all', label: 'All Gujarat DISCOMs' },
                  { id: 'PGVCL', label: 'PGVCL - Paschim Gujarat Vij' },
                  { id: 'DGVCL', label: 'DGVCL - Dakshin Gujarat Vij' },
                  { id: 'MGVCL', label: 'MGVCL - Madhya Gujarat Vij' },
                  { id: 'UGVCL', label: 'UGVCL - Uttar Gujarat Vij' },
                  { id: 'Torrent', label: 'Torrent Power (Ahm/Surat)' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectDiscom(item.id)}
                    className={`px-2.5 py-1.5 text-left text-xs rounded-lg flex items-center justify-between transition-colors ${
                      selectedDiscom === item.id ? 'bg-primary-container/20 text-primary font-semibold' : 'hover:bg-[#F6F8F7] text-on-surface'
                    }`}
                  >
                    <span>{item.label}</span>
                    {selectedDiscom === item.id && (
                      <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset All Top Filters Button */}
          {isAnyTopFilterActive && (
            <button
              onClick={handleResetAllTopFilters}
              type="button"
              className="h-9 px-2.5 rounded-lg text-secondary hover:text-[#0F1B2E] hover:bg-[#F6F8F7] text-xs flex items-center gap-1 transition-colors cursor-pointer border border-[#E4E7EB]"
              title="Reset all top filters to default"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset Filters</span>
            </button>
          )}

          {/* Export proposals button */}
          <button
            onClick={handleExportProposals}
            className="bg-[#0F1B2E] hover:bg-[#182a45] text-white font-label-md py-2 px-3.5 rounded-lg flex items-center gap-2 text-xs shadow-sm transition-colors border border-[#0F1B2E] cursor-pointer"
            type="button"
            title="Export Gujarat proposals ledger as CSV/Excel"
          >
            <span className="material-symbols-outlined text-[#6CBF3D]">file_download</span>
            <span>Export Gujarat Proposals (Excel)</span>
          </button>

          {/* Create Direct Quotation button */}
          <button
            onClick={() => {
              if (clearEditingQuotation) clearEditingQuotation();
              if (clearActiveDraftQuote) clearActiveDraftQuote();
              setActiveTab('create_quote');
            }}
            className="bg-primary hover:bg-primary/90 text-on-primary font-label-md py-2 px-3.5 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
            type="button"
            title="Create Sunvine Direct Company Quotation (Zero Dealer Margin)"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>New Direct Quote</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 my-6">
        {/* Card 1 */}
        <div className="kpi-card bg-white p-5 rounded-xl border border-[#E4E7EB] shadow-sm flex flex-col justify-between group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-xs group-hover:text-primary transition-colors">Total Proposals Issued</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">request_quote</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-xl text-[#0F1B2E] font-bold">{totalProposalsCount}</span>
              <span className="text-xs font-label-xs text-[#2E7D32] bg-[rgba(108,191,61,0.15)] px-2 py-0.5 rounded-full font-semibold">Live Feed</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-[#6CBF3D]">currency_rupee</span>
              <span className="font-semibold text-on-surface">₹ {(totalValue / 10000000).toFixed(2)} Cr</span> total value
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="kpi-card bg-white p-5 rounded-xl border border-[#E4E7EB] shadow-sm flex flex-col justify-between group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-xs group-hover:text-primary transition-colors">Average Quotation Value</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">calculate</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-xl text-[#0F1B2E] font-bold">₹ {(avgValue / 100000).toFixed(2)} Lakhs</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              Across Residential &amp; C&amp;I projects in Gujarat
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="kpi-card bg-white p-5 rounded-xl border border-[#E4E7EB] shadow-sm flex flex-col justify-between group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-xs group-hover:text-primary transition-colors">Total Capacity Quoted</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">solar_power</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-xl text-[#0F1B2E] font-bold">{totalCapacityMW} MW</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-[#6CBF3D] h-full w-[85%]" title="Rooftop"></div>
                <div className="bg-[#256676] h-full w-[15%]" title="C&I"></div>
              </div>
              <span className="text-[11px] font-label-xs text-secondary whitespace-nowrap">Gujarat Territory</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="kpi-card bg-white p-5 rounded-xl border border-[#E4E7EB] shadow-sm flex flex-col justify-between group">
          <div className="flex items-center justify-between text-secondary">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-xs group-hover:text-primary transition-colors">Average Dealer Margin</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <span className="material-symbols-outlined">verified_user</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              {avgMarginPerKw > 0 ? (
                <span className="font-headline-lg text-headline-xl text-[#0F1B2E] font-bold">
                  ₹ {avgMarginPerKw.toLocaleString('en-IN')}
                  <span className="text-sm font-normal text-secondary"> / kW</span>
                </span>
              ) : (
                <span className="font-headline-lg text-xl text-secondary font-bold">— / kW</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {avgMarginComplianceStatus === 'compliant' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-[#2E7D32]">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Audit Compliant
                </span>
              )}
              {avgMarginComplianceStatus === 'review' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  Under Review
                </span>
              )}
              {avgMarginComplianceStatus === 'flagged' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  Flagged – Exceeds Cap
                </span>
              )}
              {avgMarginComplianceStatus === 'no-data' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-secondary">
                  No margin data
                </span>
              )}
              <span className="text-[11px] text-secondary font-label-xs">
                {totalProposalsCount > 0 ? `Across ${totalProposalsCount} proposals` : 'No proposals'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Master Directory Table Section */}
      <div className="bg-white rounded-xl border border-[#E4E7EB] shadow-[0px_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Filter Tabs & Table Controls Bar */}
        <div className="p-4 border-b border-[#E4E7EB] flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F6F8F7] p-1 rounded-lg border border-[#E4E7EB]">
            <button
              onClick={() => { setActiveTabFilter('all'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-md font-label-sm text-xs font-semibold shadow-sm flex items-center gap-2 transition-colors ${
                activeTabFilter === 'all' ? 'bg-[#0F1B2E] text-white' : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span>All Proposals</span>
              <span className="bg-white/20 px-1.5 py-0.2 rounded text-[10px]">{allQuotes.length}</span>
            </button>
            <button
              onClick={() => { setActiveTabFilter('approved'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-label-sm text-xs transition-colors flex items-center gap-2 ${
                activeTabFilter === 'approved' ? 'bg-[#0F1B2E] text-white' : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span>Approved &amp; In-Progress</span>
            </button>
            <button
              onClick={() => { setActiveTabFilter('discom'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-label-sm text-xs transition-colors flex items-center gap-2 ${
                activeTabFilter === 'discom' ? 'bg-[#0F1B2E] text-white' : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span>Under DISCOM Review</span>
            </button>
            <button
              onClick={() => { setActiveTabFilter('draft'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-label-sm text-xs transition-colors flex items-center gap-2 ${
                activeTabFilter === 'draft' ? 'bg-[#0F1B2E] text-white' : 'text-secondary hover:text-on-surface'
              }`}
            >
              <span>Draft / Stale</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-64 sm:w-80 flex items-center">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none select-none">search</span>
              <input
                className="w-full h-9 bg-[#FFFFFF] border border-[#E4E7EB] rounded-lg pl-9 pr-3 text-xs text-[#1B1F23] placeholder-gray-400 focus:outline-none focus:border-[#6CBF3D] focus:ring-2 focus:ring-[#6CBF3D]/20 transition-all font-body-sm"
                placeholder="Search Quote #, Customer, Dealer, City..."
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <select
              value={marginProfileFilter}
              onChange={(e) => { setMarginProfileFilter(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-[#E4E7EB] rounded-lg text-xs py-1.5 px-3 font-label-sm text-on-surface focus:outline-none focus:border-[#6CBF3D]"
            >
              <option value="all">All Margin Profiles</option>
              <option value="high">Margin &gt; ₹4,500/kW</option>
              <option value="flagged">🚨 Flagged for Executive Audit</option>
              <option value="compliant">Compliant Margins (≤ ₹5,500/kW)</option>
            </select>
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>

        {/* 4. Presentation: Cards or Table */}
        {viewMode === 'card' ? (
          <div className="p-4 sm:p-5">
            {paginatedQuotes.length === 0 ? (
              <div className="py-12 text-center text-secondary">
                <span className="material-symbols-outlined text-4xl text-secondary/40 block mb-2">search_off</span>
                No Gujarat quotations match your current filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedQuotes.map((q, idx) => {
                  const quoteRef = q.quoteNumber || q.id || `#SV-2025-Q${idx + 100}`;
                  const kw = Number(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 5.0);
                  const totalAmt = Number(q.total_amount || q.grandTotalCustomer || q.totalAmount || 0);
                  const totalMargin = Number(q.dealer_margin || q.dealerTotalMargin || (q.dealerMarginPerKW ? q.dealerMarginPerKW * kw : 0));
                  const marginPerKw = kw > 0 ? (q.dealerMarginPerKW || Math.round(totalMargin / kw)) : 4000;
                  const isFlagged = marginPerKw > 6000;
                  const baseCost = Number(q.base_cost || q.baseCost || (totalAmt > 0 ? totalAmt - totalMargin : 0));

                  return (
                    <div key={q.id || idx} className="bg-white border border-[#E4E7EB] rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-all">
                      {/* Card Top */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleViewPdf(q)}
                          className="font-mono font-bold text-xs text-[#256676] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {quoteRef}
                        </button>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          (q.status || '').toLowerCase().includes('approved')
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : (q.status || '').toLowerCase().includes('sanction')
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {q.status || 'Active / Sent'}
                        </span>
                      </div>

                      {/* Customer & Dealer */}
                      <div className="flex flex-col gap-1.5 pt-1 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-secondary shrink-0">Customer:</span>
                          <div className="text-right min-w-0">
                            <span className="font-semibold text-on-surface truncate block">{q.customerName}</span>
                            <span className="text-[11px] text-secondary">{q.city || 'Gujarat'} • {q.discom || 'PGVCL'}</span>
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <span className="text-secondary shrink-0">Dealer:</span>
                          <div className="text-right min-w-0">
                            <span className="font-medium text-on-surface truncate block">{q.dealerName || 'Gujarat Solar Tech'}</span>
                            <span className="text-[10px] text-secondary font-mono">{q.dealerId || '#SV-DLR-0842'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Metrics 3-col */}
                      <div className="grid grid-cols-3 gap-1 bg-[#F6F8F7] p-2.5 rounded-lg text-center text-xs">
                        <div>
                          <span className="text-[10px] text-secondary block">Capacity</span>
                          <span className="font-bold text-on-surface font-mono">{q.systemCapacityKW || q.capacity || '5.0'} kW</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-secondary block">Base Price</span>
                          <span className="font-bold text-secondary font-mono text-[11px]">₹{baseCost.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-secondary block">Total Quoted</span>
                          <span className="font-bold text-[#0F1B2E] font-mono text-[11px]">₹{totalAmt.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Margin & Audit Flag */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-secondary">Dealer Margin:</span>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isFlagged
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : 'bg-[rgba(108,191,61,0.15)] text-[#2E7D32]'
                          }`}>
                            <span className="material-symbols-outlined text-xs shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {isFlagged ? 'warning' : 'check_circle'}
                            </span>
                            <span>₹{(q.dealerTotalMargin || (marginPerKw * (q.systemCapacityKW || 5))).toLocaleString('en-IN')}</span>
                            <span className="text-[10px] font-normal opacity-90">(₹{marginPerKw}/kW)</span>
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#F1F4F9]">
                        <span className="text-[11px] text-secondary">{q.date || '24 Oct 2025'}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewPdf(q)}
                            className="px-2.5 py-1 text-xs rounded border border-[#E4E7EB] hover:border-primary text-secondary hover:text-primary flex items-center gap-1 transition-colors cursor-pointer"
                            title="View Customer PDF"
                          >
                            <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => setSelectedAuditQuote(q)}
                            className="px-2.5 py-1 text-xs rounded border border-[#E4E7EB] hover:border-[#256676] text-secondary hover:text-[#256676] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Margin Audit Sheet"
                          >
                            <span className="material-symbols-outlined text-[15px]">shield</span>
                            <span>Audit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <thead>
              <tr className="bg-[#0F1B2E] text-white font-label-sm text-xs">
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px]">Quote Ref</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px]">Date</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px]">Issuing Dealer / Firm</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px]">Customer / Enterprise</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px]">System Size &amp; Type</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px] text-right">Base Price</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px] text-center whitespace-nowrap min-w-[190px]">Dealer Margin</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px] text-right">Total Quoted</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px] text-center">Lifecycle Stage</th>
                <th className="py-3.5 px-4 font-semibold tracking-wider uppercase text-[11px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EB] font-body-sm text-xs">
              {paginatedQuotes.map((q, idx) => {
                const quoteRef = q.quoteNumber || q.id || `#SV-2025-Q${idx + 100}`;
                const kw = Number(q.system_capacity_kw || q.systemCapacityKW || q.capacity || 5.0);
                const totalAmt = Number(q.total_amount || q.grandTotalCustomer || q.totalAmount || 0);
                const totalMargin = Number(q.dealer_margin || q.dealerTotalMargin || (q.dealerMarginPerKW ? q.dealerMarginPerKW * kw : 0));
                const marginPerKw = kw > 0 ? (q.dealerMarginPerKW || Math.round(totalMargin / kw)) : 4000;
                const isFlagged = marginPerKw > 6000;
                const baseCost = Number(q.base_cost || q.baseCost || (totalAmt > 0 ? totalAmt - totalMargin : 0));

                return (
                  <tr key={q.id || idx} className="bg-white hover:bg-[#F0F4F2] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-on-surface">
                      <button
                        onClick={() => handleViewPdf(q)}
                        className="text-[#256676] hover:underline flex items-center gap-1 font-bold"
                      >
                        {quoteRef}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-secondary whitespace-nowrap">
                      {q.date || '24 Oct 2025'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-on-surface">{q.dealerName || 'Gujarat Solar Tech'}</div>
                      <div className="text-[11px] text-secondary font-mono flex items-center gap-1">
                        <span>{q.dealerId || '#SV-DLR-0842'}</span> • <span>{q.city || 'Rajkot'}, GJ</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">{q.customerName}</div>
                      <div className="text-[11px] text-secondary">{q.city || 'Gujarat'} • {q.discom || 'PGVCL'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">{q.systemCapacityKW || q.capacity || '5.0'} kW</div>
                      <div className="text-[11px] text-secondary">{q.projectType || q.type || 'Rooftop Solar'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-secondary">
                      ₹ {baseCost.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap min-w-[190px]">
                      <div className="inline-flex flex-col items-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                          isFlagged
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-[rgba(108,191,61,0.15)] text-[#2E7D32]'
                        }`}>
                          <span className="material-symbols-outlined text-xs shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {isFlagged ? 'warning' : 'check_circle'}
                          </span>
                          <span className="whitespace-nowrap font-mono">₹{(q.dealerTotalMargin || (marginPerKw * (q.systemCapacityKW || 5))).toLocaleString('en-IN')}</span>
                          <span className="font-normal font-mono whitespace-nowrap text-[10px] opacity-90">(₹{marginPerKw.toLocaleString('en-IN')}/kW)</span>
                        </span>
                        {isFlagged && <span className="text-[10px] text-red-600 font-bold mt-0.5 whitespace-nowrap">Flagged for Audit</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0F1B2E] text-sm">
                      ₹ {totalAmt.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        (q.status || '').toLowerCase().includes('approved')
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : (q.status || '').toLowerCase().includes('sanction')
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {q.status || 'Active / Sent'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewPdf(q)}
                          className="p-1.5 hover:bg-surface-container-high rounded text-secondary hover:text-on-surface"
                          title="View Customer PDF"
                        >
                          <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                        </button>
                        <button
                          onClick={() => setSelectedAuditQuote(q)}
                          className="p-1.5 hover:bg-surface-container-high rounded text-secondary hover:text-[#256676] cursor-pointer"
                          title="Margin Audit Sheet"
                        >
                          <span className="material-symbols-outlined text-sm">shield</span>
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

        {/* Footer pagination */}
        <div className="p-4 border-t border-[#E4E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-secondary font-label-sm text-label-sm">
          <span>
            Showing <span className="font-semibold text-on-surface">{filteredQuotes.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredQuotes.length)}</span> of <span className="font-semibold text-on-surface">{filteredQuotes.length}</span> proposals
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-1 rounded font-semibold transition-colors ${
                  currentPage === pageNum ? 'bg-[#0F1B2E] text-white' : 'hover:bg-surface-container text-on-surface'
                }`}
              >
                {pageNum}
              </button>
            ))}
            {totalPages > 5 && <span className="px-1 text-secondary">...</span>}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-[#E4E7EB] text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* MARGIN AUDIT SHEET MODAL (SR-28) */}
      {selectedAuditQuote && (() => {
        const q = selectedAuditQuote;
        const capKw = Number(q.systemCapacityKW || q.capacity || 5);
        const marginPerKw = q.dealerMarginPerKW || (q.dealerTotalMargin && capKw ? Math.round(q.dealerTotalMargin / capKw) : 3200);
        const totalMargin = q.dealerTotalMargin || (marginPerKw * capKw);
        const totalAmt = q.grandTotalCustomer || q.totalAmount || 0;
        const baseCost = q.baseCost || (totalAmt - totalMargin);
        const baseRate = capKw > 0 ? Math.round(baseCost / capKw) : 59800;
        const subsidy = q.subsidyAmount || (capKw <= 2 ? 60000 : 78000);
        const netPayable = q.netPayable || Math.max(0, totalAmt - subsidy);
        const isFlagged = marginPerKw > 6000 || q.isFlagged;
        const quoteRef = q.quoteNumber || q.id || 'QUOTATION';

        const handleApproveMargin = () => {
          if (updateQuotationStatus) {
            updateQuotationStatus(q.id, 'Approved / Sanctioned');
          }
          if (addNotification) {
            addNotification({
              type: 'success',
              icon: 'verified',
              title: `Quotation Approved: ${quoteRef}`,
              description: `Super Admin approved margin spread (₹${marginPerKw.toLocaleString('en-IN')}/kW) for ${q.customerName || 'Customer'}.`,
              audience: 'all'
            });
          }
          addToast({
            title: 'Margin Sanctioned',
            message: `Proposal ${quoteRef} sanctioned with margin of ₹${marginPerKw.toLocaleString('en-IN')}/kW.`,
            type: 'success'
          });
          setSelectedAuditQuote(null);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-4 border-b border-[#E4E7EB]">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFlagged ? 'bg-amber-100 text-amber-800' : 'bg-primary-container/20 text-primary'}`}>
                    <span className="material-symbols-outlined text-[24px]">shield</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-sm text-lg font-bold text-on-surface">Margin Audit &amp; Compliance Sheet</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isFlagged ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isFlagged ? 'Audit Required' : 'Compliant'}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 font-mono">
                      Ref: <strong className="text-on-surface">{quoteRef}</strong> • Partner: {q.dealerName || 'Dealer'} ({q.dealerId || 'N/A'})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAuditQuote(null)}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Status Alert Banner */}
              <div className={`mt-4 p-3.5 rounded-xl border flex items-start gap-3 ${
                isFlagged
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isFlagged ? 'error' : 'check_circle'}
                </span>
                <div className="text-xs">
                  <div className="font-bold">
                    {isFlagged ? 'Regulatory Margin Cap Warning' : 'Policy & Tier Compliant'}
                  </div>
                  <p className="mt-0.5 text-secondary">
                    {isFlagged
                      ? `Dealer spread of ₹${marginPerKw.toLocaleString('en-IN')}/kW exceeds the standard Gujarat solar margin threshold of ₹6,000/kW. Super Admin review is mandatory before DISCOM subsidy filing.`
                      : `Dealer spread of ₹${marginPerKw.toLocaleString('en-IN')}/kW is within standard partner tier guidelines (≤ ₹6,000/kW). Eligible for automated EPC dispatch.`}
                  </p>
                </div>
              </div>

              {/* System Specs Overview */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-surface-container-low text-xs">
                <div>
                  <span className="text-[10px] text-secondary uppercase font-semibold">Customer</span>
                  <div className="font-bold text-on-surface truncate">{q.customerName || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-secondary uppercase font-semibold">Location / DISCOM</span>
                  <div className="font-bold text-on-surface truncate">{q.city || 'Gujarat'} • {q.discom || 'PGVCL'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-secondary uppercase font-semibold">System Capacity</span>
                  <div className="font-bold text-on-surface">{capKw} kW ({q.projectType || 'Rooftop'})</div>
                </div>
                <div>
                  <span className="text-[10px] text-secondary uppercase font-semibold">Hardware Stack</span>
                  <div className="font-bold text-on-surface truncate">{q.solarModule || 'Waaree 585W'}</div>
                </div>
              </div>

              {/* Financial & Spread Breakdown Table */}
              <div className="mt-4 border border-[#E4E7EB] rounded-xl overflow-hidden text-xs">
                <div className="bg-[#0F1B2E] text-white p-2.5 font-bold uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Component / Sizing Metric</span>
                  <span>Amount (INR)</span>
                </div>
                <div className="divide-y divide-[#E4E7EB]">
                  <div className="p-2.5 flex items-center justify-between hover:bg-surface-container-low/50">
                    <div>
                      <div className="font-medium text-on-surface">Base Procurement &amp; EPC Cost</div>
                      <div className="text-[10px] text-secondary font-mono">{capKw} kW @ ₹{baseRate.toLocaleString('en-IN')}/kW</div>
                    </div>
                    <span className="font-bold font-mono">₹ {baseCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className={`p-2.5 flex items-center justify-between ${isFlagged ? 'bg-amber-50/50' : ''}`}>
                    <div>
                      <div className="font-semibold text-on-surface flex items-center gap-1.5">
                        <span>Partner Commercial Margin</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${isFlagged ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          ₹{marginPerKw.toLocaleString('en-IN')}/kW spread
                        </span>
                      </div>
                      <div className="text-[10px] text-secondary">Added on top of base EPC cost</div>
                    </div>
                    <span className={`font-bold font-mono ${isFlagged ? 'text-red-700' : 'text-emerald-700'}`}>
                      + ₹ {totalMargin.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between bg-surface-container-low/30 font-bold">
                    <span className="text-on-surface">Total Quoted to Customer</span>
                    <span className="font-mono text-sm">₹ {totalAmt.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between text-secondary">
                    <div>
                      <div className="font-medium text-primary">PM Surya Ghar Central Subsidy (DBT)</div>
                      <div className="text-[10px] text-secondary">Disbursed directly into consumer bank account</div>
                    </div>
                    <span className="font-bold font-mono text-primary">- ₹ {subsidy.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 flex items-center justify-between bg-[#F0FDF4] border-t-2 border-[#6CBF3D]/50">
                    <div>
                      <div className="font-bold text-on-surface text-sm uppercase">Net Customer Payable</div>
                      <div className="text-[10px] text-secondary">Out-of-pocket investment after subsidy</div>
                    </div>
                    <span className="text-base font-black font-mono text-[#0F1B2E]">₹ {netPayable.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-[#E4E7EB] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleViewPdf(q);
                    setSelectedAuditQuote(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E4E7EB] hover:bg-surface-container text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  <span>View Customer Proposal PDF</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAuditQuote(null)}
                    className="px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveMargin}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-primary-container text-white hover:bg-primary transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Sanction &amp; Approve Proposal</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}



