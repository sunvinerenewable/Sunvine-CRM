import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { ledgerService } from '../../services/ledgerService';
import { useToast } from '../Shared/Toast';

const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const VOUCHER_CATEGORIES = [
  { id: 'KIT_DISPATCH', label: 'Kit Dispatch / Hardware Billing', defaultType: 'DEBIT', desc: 'Company billed solar kit to dealer' },
  { id: 'PAYMENT_RECEIVED', label: 'Payment Received from Dealer', defaultType: 'CREDIT', desc: 'Dealer paid money via Bank / UPI / Cash' },
  { id: 'COMMISSION_PAYABLE', label: 'Commission Payable to Dealer', defaultType: 'CREDIT', desc: 'Commission credited to margin dealer per kW' },
  { id: 'COMMISSION_PAID', label: 'Commission Disbursed / Paid', defaultType: 'DEBIT', desc: 'Company paid commission amount to dealer' },
  { id: 'REGISTRATION_FEE', label: 'Subsidy Registration Fee', defaultType: 'DEBIT', desc: 'Fee charged for PM Surya Ghar portal filing' },
  { id: 'ADJUSTMENT', label: 'General Accounting Adjustment', defaultType: 'DEBIT', desc: 'Debit / Credit ledger balance adjustment' },
];

export default function DealerPaymentLedger({ preselectedDealerId = null, isDealerMode = false }) {
  const { dealers, customerFiles, role, currentDealer } = useApp();
  const { addToast } = useToast();

  const [selectedDealerId, setSelectedDealerId] = useState(() => {
    if (isDealerMode && currentDealer?.id) return currentDealer.id;
    return preselectedDealerId || 'all';
  });

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ totalDebit: 0, totalCredit: 0, netBalance: 0, totalEntries: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal State
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    dealer_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'DEBIT',
    category: 'KIT_DISPATCH',
    customer_file_id: '',
    amount: '',
    payment_mode: 'NEFT',
    reference_no: '',
    narration: ''
  });

  // Fetch Ledger Data
  const loadLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const targetId = isDealerMode ? (currentDealer?.id || 'all') : selectedDealerId;
      const res = await ledgerService.getDealerLedger(targetId);
      if (res.success) {
        setEntries(res.entries || []);
        setSummary(res.summary || { totalDebit: 0, totalCredit: 0, netBalance: 0, totalEntries: 0 });
      } else {
        addToast(res.error || 'Failed to load ledger', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDealerId, isDealerMode, currentDealer, addToast]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Selected Dealer Object
  const activeDealer = useMemo(() => {
    if (selectedDealerId === 'all') return null;
    return (dealers || []).find(d => d.id === selectedDealerId) || null;
  }, [dealers, selectedDealerId]);

  // Customer Files for Selected Dealer
  const dealerCustomerFiles = useMemo(() => {
    if (!activeDealer) return customerFiles || [];
    return (customerFiles || []).filter(f => f.dealerId === activeDealer.id || f.dealer_id === activeDealer.id);
  }, [customerFiles, activeDealer]);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = !searchTerm ||
        (e.voucher_no && e.voucher_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.narration && e.narration.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.dealer_name && e.dealer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.reference_no && e.reference_no.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = categoryFilter === 'all' || e.category === categoryFilter;
      const matchesType = typeFilter === 'all' || e.entry_type === typeFilter;
      return matchesSearch && matchesCat && matchesType;
    });
  }, [entries, searchTerm, categoryFilter, typeFilter]);

  // Open Voucher Modal
  const handleOpenNewVoucher = () => {
    const defaultDealer = activeDealer || dealers?.[0] || null;
    setVoucherForm({
      dealer_id: defaultDealer?.id || '',
      entry_date: new Date().toISOString().split('T')[0],
      entry_type: 'DEBIT',
      category: 'KIT_DISPATCH',
      customer_file_id: '',
      amount: '',
      payment_mode: 'NEFT',
      reference_no: '',
      narration: ''
    });
    setIsVoucherModalOpen(true);
  };

  // Submit Voucher
  const handleSaveVoucher = async (e) => {
    e.preventDefault();
    if (!voucherForm.dealer_id || !voucherForm.amount || !voucherForm.narration.trim()) {
      addToast('Please fill all required fields.', 'error');
      return;
    }

    const numAmount = parseFloat(voucherForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast('Please enter a valid positive amount.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const d = (dealers || []).find(deal => deal.id === voucherForm.dealer_id);
      const f = (customerFiles || []).find(file => file.id === voucherForm.customer_file_id);

      const payload = {
        dealer_id: voucherForm.dealer_id,
        dealer_code: d?.dealer_code || d?.dealerCode || '',
        dealer_name: d?.name || d?.firmName || d?.firm_name || 'Dealer Partner',
        customer_file_id: voucherForm.customer_file_id || null,
        customer_name: f?.customerName || f?.customer_name || null,
        entry_date: voucherForm.entry_date,
        entry_type: voucherForm.entry_type,
        category: voucherForm.category,
        amount: numAmount,
        payment_mode: voucherForm.payment_mode,
        reference_no: voucherForm.reference_no.trim(),
        narration: voucherForm.narration.trim()
      };

      const res = await ledgerService.createVoucher(payload);
      if (res.success) {
        addToast('Transaction Voucher recorded successfully!', 'success');
        setIsVoucherModalOpen(false);
        loadLedger();
      } else {
        addToast(res.error || 'Failed to create voucher', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Voucher
  const handleDeleteVoucher = async (voucherId) => {
    if (!window.confirm('Are you sure you want to delete/reverse this voucher? This will update the running balance.')) {
      return;
    }
    try {
      const res = await ledgerService.deleteVoucher(voucherId);
      if (res.success) {
        addToast('Voucher deleted successfully.', 'success');
        loadLedger();
      } else {
        addToast(res.error || 'Failed to delete voucher', 'error');
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white font-headline">
                {isDealerMode ? 'My Financial Statement & Ledger' : 'Dealer Financial Ledger & Accounting'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDealerMode
                  ? 'Dual-entry statement of account, kit dispatches, received payments, and pending dues.'
                  : 'Banking-grade Dual Entry (Debit Dr. / Credit Cr.) ledger for tracking dealer receivables & payables.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {!isDealerMode && (
            <button
              onClick={handleOpenNewVoucher}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>New Transaction Voucher</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition-all cursor-pointer"
            type="button"
            title="Print or Save Ledger Statement as PDF"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Debit (Dr) */}
        <div className="p-4 rounded-2xl bg-[#0D1527] border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Debited (Dr.) • Material / Fees</span>
            <span className="material-symbols-outlined text-rose-400 text-[18px]">trending_up</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {formatINR(summary.totalDebit)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Kit dispatches + registration charges billed</p>
          </div>
        </div>

        {/* Total Credit (Cr) */}
        <div className="p-4 rounded-2xl bg-[#0D1527] border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Credited (Cr.) • Payments / Comm.</span>
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">trending_down</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {formatINR(summary.totalCredit)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Payments received + margin commission credited</p>
          </div>
        </div>

        {/* Net Running Balance */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between ${
          summary.netBalance > 0
            ? 'bg-rose-950/20 border-rose-800/60'
            : summary.netBalance < 0
              ? 'bg-emerald-950/20 border-emerald-800/60'
              : 'bg-[#0D1527] border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={summary.netBalance > 0 ? 'text-rose-300 font-semibold' : 'text-slate-300'}>
              {summary.netBalance > 0
                ? 'Outstanding Due (Lene Baki - Dr.)'
                : summary.netBalance < 0
                  ? 'Advance / Credit Balance (Dene Baki - Cr.)'
                  : 'Account Settled (Nil Balance)'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
              summary.netBalance > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {summary.netBalance > 0 ? 'DEBIT DUE' : summary.netBalance < 0 ? 'CREDIT' : 'SETTLED'}
            </span>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${
              summary.netBalance > 0 ? 'text-rose-400' : summary.netBalance < 0 ? 'text-emerald-400' : 'text-slate-200'
            }`}>
              {formatINR(Math.abs(summary.netBalance))}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary.netBalance > 0
                ? 'Dealer owes this net balance to Sunvine'
                : summary.netBalance < 0
                  ? 'Sunvine holds advance payment for dealer'
                  : 'Zero outstanding liability'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Selector Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0D1527] border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Dealer Selector (Admin Only) */}
          {!isDealerMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Dealer:</label>
              <select
                value={selectedDealerId}
                onChange={(e) => setSelectedDealerId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="all">All Dealer Accounts (Consolidated)</option>
                {(dealers || []).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.firmName || d.firm_name || d.name} ({d.dealer_code || d.dealerCode || d.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {VOUCHER_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              <option value="all">All Types (Dr & Cr)</option>
              <option value="DEBIT">Debit (Dr.) Only</option>
              <option value="CREDIT">Credit (Cr.) Only</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search voucher, UTR, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white pl-9 pr-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Ledger Statement Table */}
      <div className="bg-[#0D1527] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Statement of Transactions</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              {filteredEntries.length} entries
            </span>
          </div>
          <button
            onClick={loadLedger}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Refresh</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <span className="material-symbols-outlined text-[32px] animate-spin text-emerald-500 mb-2">progress_activity</span>
            <p>Loading ledger entries directly from database...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <span className="material-symbols-outlined text-[40px] text-slate-600 mb-2">receipt_long</span>
            <p className="font-semibold text-slate-300">No transaction records found.</p>
            <p className="mt-1">Use the "+ New Transaction Voucher" button to record kit dispatches or received payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Voucher #</th>
                  <th className="px-4 py-3">Dealer</th>
                  <th className="px-4 py-3">Narration / Description</th>
                  <th className="px-4 py-3 text-right">Debit (Dr. ₹)</th>
                  <th className="px-4 py-3 text-right">Credit (Cr. ₹)</th>
                  <th className="px-4 py-3 text-right">Balance (₹)</th>
                  <th className="px-4 py-3">Mode & Ref</th>
                  {!isDealerMode && role === 'admin' && (
                    <th className="px-4 py-3 text-center">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filteredEntries.map((e) => {
                  const isDebit = e.entry_type === 'DEBIT';
                  const bal = Number(e.running_balance) || 0;
                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-400">
                        {e.entry_date}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-semibold text-emerald-400">
                        {e.voucher_no}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-white">{e.dealer_name}</div>
                        {e.customer_name && (
                          <span className="text-[10px] text-slate-400">Ref: {e.customer_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="text-white font-medium">{e.narration}</div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono mt-0.5 bg-slate-800 text-slate-400">
                          {VOUCHER_CATEGORIES.find(c => c.id === e.category)?.label || e.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                        {isDebit ? (
                          <span className="text-rose-400 tabular-nums">{formatINR(e.amount)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                        {!isDebit ? (
                          <span className="text-emerald-400 tabular-nums">{formatINR(e.amount)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span className={`tabular-nums ${bal > 0 ? 'text-rose-300' : bal < 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
                          {formatINR(Math.abs(bal))} {bal > 0 ? 'Dr' : bal < 0 ? 'Cr' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          {e.payment_mode}
                        </span>
                        {e.reference_no && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {e.reference_no}</p>
                        )}
                      </td>
                      {!isDealerMode && role === 'admin' && (
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteVoucher(e.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete / Reverse Voucher"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Voucher Modal */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">add_card</span>
                <h3 className="text-base font-bold text-white">Record Transaction Voucher</h3>
              </div>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-5 space-y-4">
              {/* Dealer Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Dealer Partner <span className="text-rose-400">*</span>
                </label>
                <select
                  value={voucherForm.dealer_id}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, dealer_id: e.target.value }))}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                  <option value="">Select Dealer Account...</option>
                  {(dealers || []).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.firmName || d.firm_name || d.name} ({d.dealer_code || d.dealerCode || d.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type and Category Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Entry Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={voucherForm.entry_type}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, entry_type: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer font-bold"
                  >
                    <option value="DEBIT">Debit (Dr.) — Dealer Liability</option>
                    <option value="CREDIT">Credit (Cr.) — Payment Received</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={voucherForm.entry_date}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, entry_date: e.target.value }))}
                    required
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Accounting Category <span className="text-rose-400">*</span>
                </label>
                <select
                  value={voucherForm.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    const catObj = VOUCHER_CATEGORIES.find(c => c.id === cat);
                    setVoucherForm(prev => ({
                      ...prev,
                      category: cat,
                      entry_type: catObj?.defaultType || prev.entry_type
                    }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                  {VOUCHER_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label} ({c.defaultType})</option>
                  ))}
                </select>
              </div>

              {/* Amount and Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 150000"
                    value={voucherForm.amount}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={voucherForm.payment_mode}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="NEFT">Bank NEFT / RTGS</option>
                    <option value="IMPS">Instant IMPS</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Cheque / DD</option>
                    <option value="CASH">Cash Receipt</option>
                    <option value="SYSTEM_BILL">System Automated Billing</option>
                  </select>
                </div>
              </div>

              {/* Reference & Customer File */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    UTR / Cheque / Bill #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12349876"
                    value={voucherForm.reference_no}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, reference_no: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Linked Customer File
                  </label>
                  <select
                    value={voucherForm.customer_file_id}
                    onChange={(e) => setVoucherForm(prev => ({ ...prev, customer_file_id: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="">None (General Ledger)</option>
                    {dealerCustomerFiles.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.customerName || f.customer_name} ({f.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Narration */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Narration / Remarks <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows="2"
                  placeholder="Enter detailed description (e.g. 5kW Adani kit dispatched for Ramesh Patel)"
                  value={voucherForm.narration}
                  onChange={(e) => setVoucherForm(prev => ({ ...prev, narration: e.target.value }))}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Post Voucher to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
