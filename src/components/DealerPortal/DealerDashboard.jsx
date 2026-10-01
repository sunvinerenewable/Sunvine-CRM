import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { openWhatsAppChat } from '../../utils/quotationShare';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';

export default function DealerDashboard() {
  const { 
    currentDealer, 
    quotations, 
    startEditingQuotation, 
    clearEditingQuotation, 
    clearActiveDraftQuote, 
    setActiveTab, 
    setPreviewQuotation 
  } = useApp();
  const [selectedTimeRange, setSelectedTimeRange] = useState('Last 30 Days');
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useTableViewMode('dealer_recent_quotes');
  const timeDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
        setTimeDropdownOpen(false);
      }
    }
    if (timeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [timeDropdownOpen]);

  const timeRanges = [
    { label: 'Today', subtext: 'Past 24 hours' },
    { label: 'Last 7 Days', subtext: 'Past week' },
    { label: 'Last 30 Days', subtext: 'Default 1 month' },
    { label: 'This Quarter (Q4)', subtext: 'Current fiscal quarter' },
    { label: 'Financial Year 2024-25', subtext: 'Apr 2024 - Mar 2025' },
    { label: 'All Time', subtext: 'Complete lifetime history' }
  ];

  const kpiData = {
    'Today': {
      totalQuotes: 2,
      totalQuotesDelta: '+2 today (Active)',
      periodQuotes: 2,
      periodLabel: 'today',
      periodTitle: "Today's Quotations",
      periodValueText: '₹ 5.55 Lakhs quoted',
      targetKW: '8 kW / 15 kW',
      targetPercent: '53%',
      totalValue: '₹ 5.55 L',
      approvedValue: '₹ 3.45L',
      pipelineValue: '₹ 2.10L',
      approvedCount: '1 Approved • 1 Pending',
      sparkHeights: ['h-1', 'h-1', 'h-2', 'h-2', 'h-3', 'h-5', 'h-8']
    },
    'Last 7 Days': {
      totalQuotes: 9,
      totalQuotesDelta: '+9 this week (↑ 18%)',
      periodQuotes: 9,
      periodLabel: 'this week',
      periodTitle: 'Weekly Quotations',
      periodValueText: '₹ 14.8 Lakhs quoted',
      targetKW: '28 kW / 40 kW',
      targetPercent: '70%',
      totalValue: '₹ 19.30 L',
      approvedValue: '₹ 11.4L',
      pipelineValue: '₹ 7.9L',
      approvedCount: '3 Approved • 2 In Progress',
      sparkHeights: ['h-2', 'h-3', 'h-4', 'h-2', 'h-5', 'h-7', 'h-8']
    },
    'Last 30 Days': {
      totalQuotes: 42,
      totalQuotesDelta: '+8 this month (↑ 24%)',
      periodQuotes: 14,
      periodLabel: 'in October',
      periodTitle: 'This Month Quotations',
      periodValueText: '₹ 18.4 Lakhs quoted',
      targetKW: '70 kW / 100 kW',
      targetPercent: '70%',
      totalValue: '₹ 58.20 L',
      approvedValue: '₹ 34.8L',
      pipelineValue: '₹ 23.4L',
      approvedCount: '8 Approved • 4 Commissioned',
      sparkHeights: ['h-2', 'h-3', 'h-3', 'h-5', 'h-4', 'h-6', 'h-8']
    },
    'This Quarter (Q4)': {
      totalQuotes: 98,
      totalQuotesDelta: '+34 this quarter (↑ 38%)',
      periodQuotes: 42,
      periodLabel: 'this quarter',
      periodTitle: 'Quarterly Quotations',
      periodValueText: '₹ 64.2 Lakhs quoted',
      targetKW: '185 kW / 250 kW',
      targetPercent: '74%',
      totalValue: '₹ 1.48 Cr',
      approvedValue: '₹ 92.4L',
      pipelineValue: '₹ 55.6L',
      approvedCount: '24 Approved • 12 Commissioned',
      sparkHeights: ['h-3', 'h-4', 'h-5', 'h-6', 'h-7', 'h-7', 'h-8']
    },
    'Financial Year 2024-25': {
      totalQuotes: 284,
      totalQuotesDelta: '+112 this fiscal (↑ 45%)',
      periodQuotes: 142,
      periodLabel: 'FY 24-25',
      periodTitle: 'Annual Quotations',
      periodValueText: '₹ 2.15 Cr quoted',
      targetKW: '620 kW / 800 kW',
      targetPercent: '77.5%',
      totalValue: '₹ 4.12 Cr',
      approvedValue: '₹ 2.65 Cr',
      pipelineValue: '₹ 1.47 Cr',
      approvedCount: '78 Approved • 52 Commissioned',
      sparkHeights: ['h-4', 'h-5', 'h-6', 'h-7', 'h-7', 'h-8', 'h-8']
    },
    'All Time': {
      totalQuotes: 412,
      totalQuotesDelta: 'Lifetime Record',
      periodQuotes: 412,
      periodLabel: 'all time',
      periodTitle: 'Cumulative Quotations',
      periodValueText: '₹ 3.80 Cr quoted',
      targetKW: '940 kW / 1.2 MW',
      targetPercent: '78.3%',
      totalValue: '₹ 6.45 Cr',
      approvedValue: '₹ 4.20 Cr',
      pipelineValue: '₹ 2.25 Cr',
      approvedCount: '124 Approved • 98 Commissioned',
      sparkHeights: ['h-4', 'h-5', 'h-6', 'h-7', 'h-8', 'h-8', 'h-8']
    }
  };

  const activeKpi = kpiData[selectedTimeRange] || kpiData['Last 30 Days'];

  const handleOpenPDF = (quote) => {
    if (setPreviewQuotation) setPreviewQuotation(quote);
    setActiveTab('preview_quote');
  };

  const handleDownloadRateMatrix = () => {
    const link = document.createElement('a');
    link.href = '/mirana.pdf';
    link.download = 'Sunvine_Official_Rate_Matrix_2026.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const recentQuotes = (quotations && quotations.length > 0)
    ? quotations.slice(0, 5).map(q => ({
        ...q,
        customerName: q.customer_name || q.customerName || 'Customer',
        capacity: (q.system_capacity_kw || q.systemCapacityKW) ? `${q.system_capacity_kw || q.systemCapacityKW} kW` : (q.capacity || '5.0 kW'),
        type: q.panel_type || q.projectType || q.type || 'Mono Perc • Residential',
        amount: typeof q.amount === 'string' 
          ? q.amount 
          : '₹\u00A0' + Number(q.total_amount || q.grandTotalCustomer || q.totalAmount || 0).toLocaleString('en-IN'),
        subsidy: (q.subsidy_amount || q.subsidyAmount) ? `₹\u00A0${Number(q.subsidy_amount || q.subsidyAmount).toLocaleString('en-IN')} Subsidy` : 'Subsidy Eligible',
        status: q.status || 'Active / Sent',
        statusClass: q.statusClass || 'bg-primary/15 text-primary',
        location: q.location || ((q.customer_city || q.city) ? `${q.customer_city || q.city}, ${q.customer_state || q.state || 'Gujarat'}` : 'Gujarat')
      }))
    : [];

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-x-hidden gap-space-lg">
      {/* Top Operational Control & Profile Header */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
        <div className="flex items-start md:items-center gap-3 sm:gap-space-md min-w-0">
          <div className="relative shrink-0">
            <img
              alt="Dealer Profile"
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover shadow-md shadow-secondary/10"
              src={currentDealer?.avatar || '/dealer_avatar.jpg'}
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-primary-container rounded-full ring-2 ring-surface"></span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 text-secondary text-[10px] sm:text-label-xs font-semibold tracking-wider uppercase truncate">
              <span className="inline-block w-2 h-2 rounded-full bg-primary-container shrink-0"></span>
              <span className="truncate">{currentDealer?.firmName || 'Rajkot Solar Tech'} • {currentDealer?.city || 'Rajkot Hub'}</span>
            </div>
            <h1 className="font-headline-xl text-xl sm:text-2xl lg:text-headline-xl text-on-secondary-fixed tracking-tight font-bold truncate">
              Welcome back, {currentDealer?.contactPerson || 'Rajesh Patel'}
            </h1>
            <p className="text-xs sm:text-body-md text-secondary mt-0.5">
              Here's an overview of your quotation activity and solar installations pipeline.
            </p>
          </div>
        </div>

        {/* Quick Actions Toolbar with Live Time Range Dropdown */}
        <div className="relative self-start lg:self-center" ref={timeDropdownRef}>
          <button
            type="button"
            onClick={() => setTimeDropdownOpen(!timeDropdownOpen)}
            className="flex items-center gap-space-xs bg-surface-container-lowest px-space-md py-space-sm rounded-lg shadow-sm border border-surface-container-high/60 text-on-surface hover:border-primary font-label-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
            <span className="font-semibold">{selectedTimeRange}</span>
            <span className={`material-symbols-outlined text-[18px] text-secondary transition-transform duration-200 ${timeDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
              expand_more
            </span>
          </button>

          {/* Time Range Dropdown Menu */}
          {timeDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high py-2 z-30 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1.5 border-b border-surface-container-high text-[11px] font-bold text-secondary uppercase tracking-wider">
                Select Time Window
              </div>
              <div className="py-1">
                {timeRanges.map((range) => {
                  const isSelected = selectedTimeRange === range.label;
                  return (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => {
                        setSelectedTimeRange(range.label);
                        setTimeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary-container/15 text-primary font-bold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className={isSelected ? 'text-primary' : 'text-on-surface'}>{range.label}</span>
                        <span className="text-[10px] text-secondary font-normal">{range.subtext}</span>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Telemetry & Performance KPI Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {/* Card 1: Total Quotations */}
        <div className="kpi-card relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between group border border-surface-container-high/60">
          <div className="flex items-center justify-between mb-space-md">
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <span className="px-space-sm py-0.5 rounded-full text-label-xs font-label-xs bg-primary-container/15 text-primary">
              {activeKpi.totalQuotesDelta}
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">{activeKpi.totalQuotes}</span>
              <span className="font-label-sm text-label-sm text-secondary">proposals</span>
            </div>
            <div className="font-label-sm text-label-sm text-secondary mt-1 group-hover:text-primary transition-colors">Total Quotations</div>
          </div>
          {/* Mini Sparkline Representation */}
          <div className="mt-space-md pt-space-xs flex items-end gap-1.5 h-8">
            {activeKpi.sparkHeights.map((hClass, idx) => (
              <div
                key={idx}
                className={`w-full rounded-t transition-all duration-300 ${
                  idx >= 5 ? 'bg-primary-container' : 'bg-surface-container'
                } ${hClass}`}
              ></div>
            ))}
          </div>
        </div>

        {/* Card 2: Period Quotations */}
        <div className="kpi-card relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between group border border-surface-container-high/60">
          <div className="flex items-center justify-between mb-space-md">
            <div className="w-12 h-12 rounded-full bg-tertiary-fixed/40 flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined text-[24px]">wb_sunny</span>
            </div>
            <span className="px-space-sm py-0.5 rounded-full text-label-xs font-label-xs bg-tertiary/10 text-tertiary">
              {activeKpi.periodValueText}
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">{activeKpi.periodQuotes}</span>
              <span className="font-label-sm text-label-sm text-secondary">{activeKpi.periodLabel}</span>
            </div>
            <div className="font-label-sm text-label-sm text-secondary mt-1 group-hover:text-primary transition-colors">{activeKpi.periodTitle}</div>
          </div>
          {/* Capacity Yield Bar Visual */}
          <div className="mt-space-md flex flex-col gap-1">
            <div className="flex justify-between text-label-xs font-label-xs text-secondary">
              <span>Target Progress</span>
              <span className="text-on-surface font-semibold">{activeKpi.targetKW}</span>
            </div>
            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-tertiary rounded-full transition-all duration-500"
                style={{ width: activeKpi.targetPercent }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Business Value */}
        <div className="kpi-card relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between group border border-surface-container-high/60">
          <div className="flex items-center justify-between mb-space-md">
            <div className="w-12 h-12 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-on-secondary-fixed group-hover:scale-105 transition-transform duration-200">
              <span className="material-symbols-outlined text-[24px]">currency_rupee</span>
            </div>
            <span className="px-space-sm py-0.5 rounded-full text-label-xs font-label-xs bg-secondary-fixed text-on-secondary-fixed-variant">
              {activeKpi.approvedCount}
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface font-bold">{activeKpi.totalValue}</span>
            </div>
            <div className="font-label-sm text-label-sm text-secondary mt-1 group-hover:text-primary transition-colors">Total Business Value</div>
          </div>
          {/* Conversion Split */}
          <div className="mt-space-md flex items-center justify-between text-label-xs font-label-xs text-secondary pt-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-container"></span>
              <span>{activeKpi.approvedValue} Approved</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim"></span>
              <span>{activeKpi.pipelineValue} In Pipeline</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Solar Estimator Banner Action Card (SR-26) */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-container to-primary text-on-primary p-4 sm:p-space-lg md:p-space-xl shadow-md w-full max-w-full box-border">
        {/* Subtle Geometric SVG Watermark Pattern (Clipped in absolute container to prevent horizontal overflow) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <svg className="absolute right-0 top-0 bottom-0 h-full opacity-10 pointer-events-none transform translate-x-12" fill="none" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
            <polygon fill="currentColor" points="40,20 180,20 140,180 0,180"></polygon>
            <polygon fill="currentColor" points="190,20 330,20 290,180 150,180"></polygon>
            <polygon fill="currentColor" points="340,20 480,20 440,180 300,180"></polygon>
            <line stroke="currentColor" strokeWidth="6" x1="20" x2="460" y1="100" y2="100"></line>
            <line stroke="currentColor" strokeWidth="4" x1="10" x2="450" y1="60" y2="60"></line>
            <line stroke="currentColor" strokeWidth="4" x1="0" x2="440" y1="140" y2="140"></line>
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-space-lg w-full max-w-full">
          <div className="max-w-2xl min-w-0">
            <div className="flex items-center gap-space-xs text-primary-fixed font-label-sm uppercase tracking-wider mb-space-xs">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              <span>Fast EPC Engine • Instant DISCOM Rates</span>
            </div>
            <h2 className="font-headline-lg text-lg sm:text-headline-lg text-on-primary font-bold">
              Need a quick quotation for a customer?
            </h2>
            <p className="font-body-md text-xs sm:text-body-md text-on-primary/90 mt-1 max-w-xl">
              Generate customized solar EPC quotations with instant subsidy calculations in under 2 minutes.
            </p>
          </div>
          <button
            onClick={() => {
              if (clearEditingQuotation) clearEditingQuotation();
              if (clearActiveDraftQuote) clearActiveDraftQuote();
              setActiveTab('create_quote');
            }}
            className="shrink-0 flex items-center justify-center gap-space-sm bg-surface-container-lowest text-primary hover:bg-surface-container hover:text-on-primary-container px-4 sm:px-space-lg py-2.5 sm:py-3 rounded-lg font-label-md transition-all shadow-sm active:scale-95 w-full sm:w-auto"
            type="button"
          >
            <span>+ Create New Quotation</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Recent Quotations Data Section */}
      <section className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-md text-headline-md text-on-surface">Recent Quotations</h2>
            <span className="px-space-xs py-0.5 rounded text-label-xs font-label-xs bg-surface-container-high text-secondary">
              5 Recent
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <button
              onClick={() => setActiveTab('my_quotes')}
              className="flex items-center gap-space-xs font-label-sm text-label-sm text-primary hover:text-on-primary-container font-semibold transition-colors cursor-pointer"
            >
              <span>View All ({quotations?.length || 0})</span>
              <span className="material-symbols-outlined text-[16px]">east</span>
            </button>
          </div>
        </div>

        {/* Card View Mode (Default on Mobile, responsive grid) */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {recentQuotes.map((q, idx) => (
              <div key={idx} className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between gap-3 border border-surface-container-high/60 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-sm text-on-surface font-bold truncate">{q.customerName}</span>
                      <span className={`px-2 py-0.5 rounded-full font-label-xs text-[10px] shrink-0 font-semibold ${q.statusClass}`}>
                        {q.status}
                      </span>
                    </div>
                    <p className="font-body-sm text-xs text-secondary mt-0.5">{q.capacity} • {q.type}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-headline-sm text-sm font-bold text-on-surface block">{q.amount}</span>
                    <span className="font-label-xs text-[10px] text-secondary">{q.subsidy}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-surface-container bg-surface-container-low/50 px-2.5 py-1.5 rounded-lg text-xs">
                  <div className="flex items-center gap-1 text-secondary min-w-0">
                    <span className="material-symbols-outlined text-[15px] text-tertiary shrink-0">location_on</span>
                    <span className="font-label-xs text-[11px] truncate max-w-[110px]">{q.location.split(',')[0]}</span>
                    <span className="text-outline-variant shrink-0">•</span>
                    <span className="font-label-xs text-[11px] shrink-0">{q.date}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditingQuotation(q)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit Quotation"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleOpenPDF(q)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
                      title="View Proposal PDF"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">description</span>
                    </button>
                    <button
                      onClick={() => openWhatsAppChat(q)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
                      title="WhatsApp Customer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">chat</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View Mode (Traditional full-width / scrollable table) */
          <div className="w-full overflow-x-auto rounded-xl shadow-sm bg-surface-container-lowest border border-surface-container-high/60">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-on-secondary-fixed text-on-secondary h-12 text-label-sm font-label-sm select-none">
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider">Customer Name</th>
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider">System Capacity</th>
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider">Date</th>
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider text-right">Amount</th>
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider text-center">Status</th>
                  <th className="px-space-lg py-space-sm font-semibold tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md divide-y divide-surface-container">
                {recentQuotes.map((q, idx) => (
                  <tr key={idx} className="bg-surface-container-lowest hover:bg-surface-container-low/80 transition-colors">
                    <td className="px-space-lg py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{q.customerName}</span>
                        <span className="text-label-xs text-secondary">{q.location}</span>
                      </div>
                    </td>
                    <td className="px-space-lg py-3.5">
                      <div className="flex items-center gap-2.5 font-semibold text-on-surface whitespace-nowrap">
                        <div className="w-7 h-7 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="material-symbols-outlined text-[16px] leading-none select-none">solar_power</span>
                        </div>
                        <span className="font-mono font-bold text-inverse-surface">{q.capacity}</span>
                      </div>
                    </td>
                    <td className="px-space-lg py-3.5 text-secondary font-label-xs whitespace-nowrap">
                      {q.date}
                    </td>
                    <td className="px-space-lg py-3.5 text-right font-bold text-on-surface tabular-nums">
                      {q.amount}
                    </td>
                    <td className="px-space-lg py-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-xs font-label-xs ${q.statusClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-space-lg py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEditingQuotation(q)}
                          className="p-1.5 rounded hover:bg-primary/10 text-secondary hover:text-primary transition-colors cursor-pointer"
                          title="Edit Quotation"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleOpenPDF(q)}
                          className="p-1.5 rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
                          title="View Proposal PDF"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">description</span>
                        </button>
                        <button
                          onClick={() => openWhatsAppChat(q)}
                          className="p-1.5 rounded hover:bg-surface-container text-[#25D366] hover:bg-[#25D366]/15 transition-colors cursor-pointer"
                          title="Share via WhatsApp"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">chat</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
