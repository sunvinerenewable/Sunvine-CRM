import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { openWhatsAppChat } from '../../utils/quotationShare';
import ViewModeToggle, { useTableViewMode } from '../Shared/ViewModeToggle';
import ConvertQuotationModal from './ConvertQuotationModal';

export default function MyQuotations() {
  const { 
    quotations, 
    startEditingQuotation, 
    clearEditingQuotation, 
    clearActiveDraftQuote, 
    setActiveTab, 
    setPreviewQuotation 
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useTableViewMode('dealer_my_quotes');
  const [convertingQuote, setConvertingQuote] = useState(null);

  const handleOpenPDF = (quote) => {
    if (setPreviewQuotation) setPreviewQuotation(quote);
    setActiveTab('preview_quote');
  };

  // Harmonized quotation list matching live database schema
  const quotesList = (quotations && quotations.length > 0 ? quotations : []).map(q => ({
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
    location: q.location || ((q.customer_city || q.city) ? `${q.customer_city || q.city}, ${q.customer_state || q.state || 'Gujarat'}` : 'Gujarat'),
    date: q.date || (q.created_at ? new Date(q.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today')
  }));

  const filteredQuotes = quotesList.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (q.customerName && q.customerName.toLowerCase().includes(term)) ||
                          (q.id && q.id.toLowerCase().includes(term)) ||
                          (q.location && q.location.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || 
                          (q.status && q.status.toLowerCase().includes(statusFilter.toLowerCase()));
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full gap-space-lg pb-16">
      {/* Header & Title Section */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold">My Quotations Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm">
              {filteredQuotes.length} Records
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Browse, search, edit, view PDF, and dispatch client proposals across your territory.
          </p>
        </div>
        <div className="self-start sm:self-auto flex items-center gap-2">
          <button
            onClick={() => setActiveTab('my_applications')}
            className="flex items-center gap-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface px-space-md py-space-sm rounded-lg shadow-xs font-label-md transition-all cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">assignment</span>
            <span>Track Applications</span>
          </button>
          <button
            onClick={() => {
              if (clearEditingQuotation) clearEditingQuotation();
              if (clearActiveDraftQuote) clearActiveDraftQuote();
              setActiveTab('create_quote');
            }}
            className="flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary px-space-md py-space-sm rounded-lg shadow-sm font-label-md transition-all active:scale-95 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Create New Quotation</span>
          </button>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Field */}
        <div className="relative w-full md:w-96 flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[20px]">search</span>
          <input
            className="w-full h-10 pl-11 pr-4 bg-surface-container-lowest border border-surface-container-high rounded-lg text-on-surface font-body-md text-sm placeholder:text-secondary focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
            placeholder="Search by customer name, quote ID, city..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-secondary font-label-sm text-xs">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Status:</span>
          </div>
          <select
            className="h-10 px-3 bg-surface-container-lowest border border-surface-container-high rounded-lg text-on-surface text-xs font-semibold focus:outline-none focus:border-primary-container"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="sent">Active / Sent</option>
            <option value="viewed">Customer Viewed</option>
            <option value="won">Won / Converted</option>
            <option value="pending">Pending Approval</option>
            <option value="draft">Draft</option>
          </select>

          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </section>

      {/* Card View Mode (Default on Mobile, responsive grid) */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredQuotes.map((q, idx) => (
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
                  <span className="font-headline-sm text-sm font-bold text-on-surface block whitespace-nowrap">{q.amount}</span>
                  <span className="font-label-xs text-[10px] text-secondary">{q.subsidy}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-surface-container bg-surface-container-low/50 px-2.5 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1 text-secondary min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-tertiary shrink-0">location_on</span>
                  <span className="font-label-xs text-[11px] truncate max-w-[120px]">{q.location.split(',')[0]}</span>
                  <span className="text-outline-variant shrink-0">•</span>
                  <span className="font-label-xs text-[11px] shrink-0">{q.date}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEditingQuotation(q)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    title="Edit Quotation"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleOpenPDF(q)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    title="View Proposal PDF"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                  </button>
                  <button
                    onClick={() => setConvertingQuote(q)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary-container/20 transition-colors cursor-pointer"
                    title="Book Order / Convert to Customer File"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                  </button>
                  <button
                    onClick={() => openWhatsAppChat(q)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/15 transition-colors cursor-pointer"
                    title="Share via WhatsApp"
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
        /* Table View Mode (Full Data Table with Sticky Header & Scroll) */
        <div className="w-full max-h-[calc(100vh-270px)] min-h-[420px] overflow-y-auto overflow-x-auto rounded-xl shadow-sm bg-surface-container-lowest border border-surface-container-high/60 relative">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-on-secondary-fixed shadow-xs">
              <tr className="bg-on-secondary-fixed text-on-secondary h-12 text-label-sm font-label-sm select-none">
                <th className="px-space-lg py-space-sm font-semibold tracking-wider bg-on-secondary-fixed">Customer Name</th>
                <th className="px-space-lg py-space-sm font-semibold tracking-wider bg-on-secondary-fixed">System Capacity</th>
                <th className="px-space-lg py-space-sm font-semibold tracking-wider bg-on-secondary-fixed">Date</th>
                <th className="px-space-lg py-space-sm font-semibold tracking-wider text-right bg-on-secondary-fixed">Amount</th>
                <th className="px-space-lg py-space-sm font-semibold tracking-wider text-center bg-on-secondary-fixed">Status</th>
                <th className="px-space-lg py-space-sm font-semibold tracking-wider text-center bg-on-secondary-fixed">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md divide-y divide-surface-container">
              {filteredQuotes.map((q, idx) => (
                <tr key={idx} className="bg-surface-container-lowest hover:bg-surface-container-low/80 transition-colors">
                  <td className="px-space-lg py-3.5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface">{q.customerName}</span>
                        {q.id && (
                          <span className="text-[10px] font-mono text-secondary bg-surface-container px-1.5 py-0.5 rounded">
                            {q.id}
                          </span>
                        )}
                      </div>
                      <span className="text-label-xs text-secondary mt-0.5">{q.location}</span>
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
                  <td className="px-space-lg py-3.5 text-right font-bold text-on-surface tabular-nums whitespace-nowrap">
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
                        onClick={() => setConvertingQuote(q)}
                        className="p-1.5 rounded hover:bg-primary-container/20 text-primary transition-colors cursor-pointer"
                        title="Book Order / Convert to Customer File"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
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

      {/* Convert Quotation to Booked Order / Customer File Modal */}
      <ConvertQuotationModal
        quotation={convertingQuote}
        isOpen={Boolean(convertingQuote)}
        onClose={() => setConvertingQuote(null)}
      />
    </div>
  );
}
