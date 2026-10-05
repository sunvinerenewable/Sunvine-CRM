import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';
import { pushNotificationService } from '../../services/pushNotificationService';

export default function StaffDashboard() {
  const {
    currentStaff,
    customerFiles,
    setActiveTab,
    updateFileStatus,
    dealers,
    getAccessibleDealers,
    updateDealerPricing
  } = useApp();

  const { addToast } = useToast();

  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  React.useEffect(() => {
    if (pushNotificationService.isPushSupported()) {
      pushNotificationService.isSubscribed().then(setIsPushSubscribed);
    }
  }, []);

  const handleTogglePush = async () => {
    setIsPushLoading(true);
    try {
      if (isPushSubscribed) {
        await pushNotificationService.unsubscribeUser();
        setIsPushSubscribed(false);
        addToast('OS Push notifications disabled on this device', 'info');
      } else {
        const res = await pushNotificationService.subscribeUser({
          userId: currentStaff?.id || 'staff',
          role: 'staff'
        });
        if (res.success) {
          setIsPushSubscribed(true);
          addToast('OS Push notifications enabled successfully!', 'success');
        } else {
          addToast(res.error || 'Failed to enable push notifications', 'error');
        }
      }
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsPushLoading(true);
    try {
      const res = await pushNotificationService.sendTestPush({
        targetUserId: currentStaff?.id || 'staff',
        role: 'staff'
      });
      if (res.success) {
        addToast(`Test push alert dispatched! (${res.sentCount || 0} device notified)`, 'success');
      } else {
        addToast(res.error || 'Could not send test push', 'error');
      }
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setIsPushLoading(false);
    }
  };

  // Strictly filter files for THIS staff member only
  const myFiles = (customerFiles || []).filter(
    (f) => f.staffId === currentStaff?.id || f.staffName === currentStaff?.name
  );

  // Strictly filter dealers: Sales officer only sees their assigned dealers
  const myDealers = useMemo(() => {
    const list = getAccessibleDealers ? getAccessibleDealers() : (dealers || []);
    return list.filter(d => d.assignedStaffId === currentStaff?.id);
  }, [getAccessibleDealers, dealers, currentStaff]);

  const [editingDealerId, setEditingDealerId] = useState(null);
  const [pricingEditForm, setPricingEditForm] = useState({
    pricingMode: 'standard',
    customBaseRatePerWp: 18.00,
    customBaseRatePerKw: 58000,
    customMarginPerKw: 4500,
    customDiscountPercent: 0
  });

  const totalFiles = myFiles.length;
  const inProgressFiles = myFiles.filter(
    (f) => f.status === 'Verification' || f.status === 'DISCOM Registered'
  ).length;
  const successfulFiles = myFiles.filter((f) => f.status === 'Subsidized').length;
  const sourcedLeads = myFiles.filter((f) => f.status === 'Sourced').length;
  const totalKw = myFiles.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

  const startEditPricing = (dealer) => {
    setEditingDealerId(dealer.id);
    const cfg = dealer.pricingConfig || {};
    setPricingEditForm({
      pricingMode: cfg.pricingMode || 'standard',
      customBaseRatePerWp: cfg.customBaseRatePerWp || 18.00,
      customBaseRatePerKw: cfg.customBaseRatePerKw || 58000,
      customMarginPerKw: cfg.customMarginPerKw || 4500,
      customDiscountPercent: cfg.customDiscountPercent || 0
    });
  };

  const handleSaveDealerPricing = async (dealerId) => {
    if (updateDealerPricing) {
      updateDealerPricing(dealerId, pricingEditForm);
    }
    setEditingDealerId(null);
    if (addToast) {
      addToast({
        title: 'Dealer Pricing Updated',
        message: 'Custom pricing and margin thresholds saved successfully.',
        type: 'success'
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Welcome Hero Banner (Light Enterprise Theme) */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 md:p-8 text-slate-900 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>Field Executive Workspace</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back, {currentStaff?.name || 'Sales Officer'}!
            </h1>
            <p className="text-xs md:text-sm text-slate-500 max-w-xl">
              Territory: <strong className="text-slate-800">{currentStaff?.zone || 'Gujarat Region'}</strong> | Staff ID: <strong className="text-emerald-700 font-mono font-bold">{currentStaff?.id || 'STF-801'}</strong> | Assigned Dealers: <strong className="text-emerald-700 font-bold">{myDealers.length} Partners</strong>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('create_quote')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0F1B2E] hover:bg-[#1E293B] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#6CBF3D]">request_quote</span>
              <span>New Quotation</span>
            </button>
            <button
              onClick={() => setActiveTab('staff_map')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">radar</span>
              <span>AI Radar</span>
            </button>
            <button
              onClick={() => setActiveTab('staff_new_lead')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>New Customer Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* OS Push Notifications Status Banner */}
      {pushNotificationService.isPushSupported() && (
        <div className={`rounded-xl p-3.5 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPushSubscribed
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            : 'bg-[#0D1527] border-slate-700/60 text-slate-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isPushSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <span className="material-symbols-outlined text-xl">
                {isPushSubscribed ? 'notifications_active' : 'notifications'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {isPushSubscribed ? 'Desktop & Mobile Push Alerts Active' : 'Enable OS-Level Push Notifications'}
                </span>
                {isPushSubscribed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isPushSubscribed
                  ? 'You will receive immediate system notifications whenever your assigned dealers register new applications.'
                  : 'Receive instant Windows, Mac & Android banners when your dealers register customer applications.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPushSubscribed && (
              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isPushLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                Send Test Alert
              </button>
            )}
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={isPushLoading}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isPushSubscribed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              {isPushLoading ? 'Connecting...' : isPushSubscribed ? 'Unsubscribe' : 'Enable Alerts'}
            </button>
          </div>
        </div>
      )}

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Files</span>
            <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-on-surface">{totalFiles}</div>
            <div className="text-[11px] text-secondary mt-1">{totalKw} kW Pipeline Total</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Sourced Leads</span>
            <span className="material-symbols-outlined text-amber-500 text-[20px]">contact_phone</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-amber-600">{sourcedLeads}</div>
            <div className="text-[11px] text-secondary mt-1">Initial Contact &amp; Visits</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <span className="material-symbols-outlined text-blue-500 text-[20px]">hourglass_top</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{inProgressFiles}</div>
            <div className="text-[11px] text-secondary mt-1">Verification / DISCOM</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Successful</span>
            <span className="material-symbols-outlined text-emerald-500 text-[20px]">verified</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-emerald-600">{successfulFiles}</div>
            <div className="text-[11px] text-emerald-600 mt-1">DBT Approved &amp; Paid</div>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">My Territory</span>
            <span className="material-symbols-outlined text-primary text-[20px]">map</span>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-on-surface truncate">{currentStaff?.city || 'Gujarat'}</div>
            <div className="text-[11px] text-primary font-semibold mt-1 flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('staff_map')}>
              <span>View Radar Map</span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Customer Files Table */}
      <div className="bg-surface rounded-xl border border-surface-container-high shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-container-high flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
              <span>My Active Customer Files</span>
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Only your assigned solar files appear here. No interference with other staff.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('staff_files')}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({myFiles.length})</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>

        {myFiles.length > 0 ? (
          <div className="divide-y divide-surface-container-high">
            {myFiles.map((file) => {
              const statusColors = {
                'Sourced': 'bg-amber-100 text-amber-800 border-amber-200',
                'Verification': 'bg-blue-100 text-blue-800 border-blue-200',
                'DISCOM Registered': 'bg-purple-100 text-purple-800 border-purple-200',
                'Subsidized': 'bg-emerald-100 text-emerald-800 border-emerald-200'
              };

              return (
                <div key={file.id} className="p-4 hover:bg-surface-container-low transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-secondary uppercase">{file.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        file.sourceType === 'DEALER' || file.source === 'DEALER'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {file.sourceType === 'DEALER' || file.source === 'DEALER' ? `Dealer (${file.dealerName || file.dealerId || 'Partner'})` : 'Direct Staff'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        file.financeType === 'LOAN' || file.paymentMode === 'LOAN'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {file.financeType === 'LOAN' || file.paymentMode === 'LOAN' ? `Loan (${file.loanBank ? file.loanBank.split(' ')[0] : 'Bank'})` : 'Cash Case'}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[file.status]}`}>
                        {file.status}
                      </span>
                      <span className="text-[11px] text-secondary font-medium">({file.discom})</span>
                    </div>
                    <div className="text-base font-bold text-on-surface">{file.customerName}</div>
                    <div className="text-xs text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        <a href={`tel:${file.phone}`} className="hover:underline text-primary font-medium">{file.phone}</a>
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-on-surface">{file.solarSystemKw} kW Solar</span>
                      <span>•</span>
                      <span className="truncate max-w-xs">{file.address}</span>
                    </div>
                  </div>

                  {/* Actions & Stage Progression */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={file.status}
                      onChange={(e) => updateFileStatus(file.id, e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="Sourced">1. Sourced</option>
                      <option value="Verification">2. Verification</option>
                      <option value="DISCOM Registered">3. DISCOM Registered</option>
                      <option value="Subsidized">4. Subsidized</option>
                    </select>

                    <a
                      href={`https://wa.me/${file.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(file.customerName)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Officer')}%20from%20Sunvine%20Renewable%20regarding%20your%20${file.solarSystemKw}kW%20rooftop%20solar%20file.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-xs flex items-center justify-center transition-colors"
                      title="WhatsApp Customer"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">folder_off</span>
            <p className="text-sm">You haven't registered any customer leads yet.</p>
            <button
              onClick={() => setActiveTab('staff_new_lead')}
              className="mt-3 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create First Customer Lead</span>
            </button>
          </div>
        )}
      </div>

      {/* Assigned Dealers & Custom Pricing Section (Sales Officer Isolation) */}
      <div className="bg-surface rounded-xl border border-surface-container-high shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <span className="material-symbols-outlined text-[20px]">handshake</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">My Assigned Authorized Dealers ({myDealers.length} Partners)</h2>
              <p className="text-xs text-secondary">
                Configure dealer-specific custom base rates (₹/Wp or ₹/kW) and launch quotations on their behalf.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto">
            Strict Territory Isolation
          </span>
        </div>

        {myDealers.length > 0 ? (
          <div className="divide-y divide-surface-container-high">
            {myDealers.map((d) => {
              const cfg = d.pricingConfig || {};
              const isCustom = cfg.pricingMode === 'custom';
              const isEditing = editingDealerId === d.id;

              return (
                <div key={d.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container-low/50 transition-colors">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-on-surface">{d.firmName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-mono font-bold">
                        {d.dealerCode || d.id}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        (d.tier || '').toLowerCase().includes('diamond') ? 'bg-cyan-100 text-cyan-800' :
                        (d.tier || '').toLowerCase().includes('platinum') ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {d.tier || 'Gold'} Tier
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-secondary flex-wrap">
                      <span>Contact: <strong className="text-on-surface">{d.contactPerson}</strong></span>
                      <span>•</span>
                      <span>City: <strong className="text-on-surface">{d.city}</strong></span>
                      <span>•</span>
                      <span className="font-mono">{d.phone}</span>
                    </div>

                    {/* Active Pricing Summary */}
                    {!isEditing && (
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          isCustom ? 'bg-amber-500/15 text-amber-800 border border-amber-300' : 'bg-surface-container text-secondary'
                        }`}>
                          {isCustom ? 'Custom Pricing Active' : 'Company Base Pricing'}
                        </span>
                        {isCustom ? (
                          <span className="text-slate-700 font-medium">
                            Base: <strong className="font-mono text-emerald-700">₹{cfg.customBaseRatePerWp || 18.00}/Wp</strong> (₹{Number(cfg.customBaseRatePerKw || 58000).toLocaleString('en-IN')}/kW) • Margin: <strong className="font-mono">₹{cfg.customMarginPerKw || 4500}/kW</strong>
                          </span>
                        ) : (
                          <span className="text-slate-500">Standard HO procurement benchmark applies.</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inline Pricing Edit Form or Action Buttons */}
                  {isEditing ? (
                    <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high space-y-3 w-full lg:w-auto">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-on-surface">Pricing Mode:</label>
                        <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-surface-container-high text-xs">
                          <button
                            type="button"
                            onClick={() => setPricingEditForm(prev => ({ ...prev, pricingMode: 'standard' }))}
                            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${pricingEditForm.pricingMode === 'standard' ? 'bg-primary text-white' : 'text-secondary'}`}
                          >
                            Standard Base
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricingEditForm(prev => ({ ...prev, pricingMode: 'custom' }))}
                            className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-colors ${pricingEditForm.pricingMode === 'custom' ? 'bg-amber-600 text-white' : 'text-secondary'}`}
                          >
                            Custom
                          </button>
                        </div>
                      </div>

                      {pricingEditForm.pricingMode === 'custom' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Rate / Wp (₹)</label>
                            <input
                              type="number"
                              step="0.05"
                              value={pricingEditForm.customBaseRatePerWp}
                              onChange={(e) => setPricingEditForm(prev => ({ ...prev, customBaseRatePerWp: Number(e.target.value) }))}
                              className="w-full h-8 px-2 rounded bg-surface border border-surface-container-high text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Base / kW (₹)</label>
                            <input
                              type="number"
                              step="500"
                              value={pricingEditForm.customBaseRatePerKw}
                              onChange={(e) => setPricingEditForm(prev => ({ ...prev, customBaseRatePerKw: Number(e.target.value) }))}
                              className="w-full h-8 px-2 rounded bg-surface border border-surface-container-high text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Margin / kW (₹)</label>
                            <input
                              type="number"
                              step="500"
                              value={pricingEditForm.customMarginPerKw}
                              onChange={(e) => setPricingEditForm(prev => ({ ...prev, customMarginPerKw: Number(e.target.value) }))}
                              className="w-full h-8 px-2 rounded bg-surface border border-surface-container-high text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingDealerId(null)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-secondary hover:text-on-surface bg-surface-container cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDealerPricing(d.id)}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-container cursor-pointer shadow-xs"
                        >
                          Save Pricing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditPricing(d)}
                        className="px-3 py-1.5 rounded-lg border border-surface-container-high hover:border-primary text-xs font-bold text-on-surface bg-surface hover:bg-surface-container flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        title="Configure custom rates for this dealer"
                      >
                        <span className="material-symbols-outlined text-[15px] text-primary">tune</span>
                        <span>Custom Price</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('create_quote')}
                        className="px-3 py-1.5 rounded-lg bg-[#6CBF3D] hover:bg-[#4F9A2C] text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        title="Issue quotation for this dealer"
                      >
                        <span className="material-symbols-outlined text-[15px]">request_quote</span>
                        <span>Create Quote</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">group_off</span>
            <p className="text-sm">No authorized dealers currently assigned to your staff profile.</p>
            <p className="text-xs text-secondary mt-1">Please contact your territory admin to assign dealer accounts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
