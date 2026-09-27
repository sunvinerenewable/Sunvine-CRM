import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function AdminSettings() {
  const {
    governanceSettings,
    updateGovernanceSettings,
    systemSettings,
    updateSystemSettings,
    setActiveTab: setActiveTabGlobal
  } = useApp();
  const [activeTab, setActiveTab] = useState('governance');
  const [saved, setSaved] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  const [settings, setSettings] = useState(() => governanceSettings || {
    enforceAlmm: true,
    pmSuryaGharActive: true,
    maxDealerMarginPerKW: 8000,
    minDealerMarginPerKW: 0,
    quoteExpiryDays: 15,
    autoGedaSync: true,
    requireAdminApprovalAboveKW: 100,
    retentionMonths: 36,
    discomApiStatus: 'Online - 12ms ping',
    gedaSyncStatus: 'Connected (Hourly)',
    lastBackupTimestamp: 'Today, 01:15 AM'
  });

  // Policy editor state
  const [selectedPolicyKey, setSelectedPolicyKey] = useState('dealerAgreement');
  const [editPolicyTitle, setEditPolicyTitle] = useState('');
  const [editPolicyContent, setEditPolicyContent] = useState('');

  useEffect(() => {
    if (governanceSettings) {
      setSettings(governanceSettings);
    }
  }, [governanceSettings]);

  useEffect(() => {
    if (systemSettings?.documentPolicies && selectedPolicyKey) {
      const p = systemSettings.documentPolicies[selectedPolicyKey];
      if (p) {
        setEditPolicyTitle(p.title || '');
        setEditPolicyContent(
          (p.sections || []).map(s => `### ${s.heading}\n${s.content}`).join('\n\n')
        );
      }
    }
  }, [systemSettings, selectedPolicyKey]);

  const handleSave = (e) => {
    e.preventDefault();
    if (updateGovernanceSettings) {
      updateGovernanceSettings(settings);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSavePolicy = (e) => {
    e.preventDefault();
    if (!updateSystemSettings || !selectedPolicyKey) return;

    // Parse sections back from markdown headings
    const sectionBlocks = editPolicyContent.split('### ').filter(Boolean);
    const parsedSections = sectionBlocks.map(block => {
      const lines = block.split('\n');
      const heading = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      return { heading, content };
    });

    const updatedPolicies = {
      ...systemSettings.documentPolicies,
      [selectedPolicyKey]: {
        ...systemSettings.documentPolicies[selectedPolicyKey],
        title: editPolicyTitle.trim(),
        lastUpdated: `Updated ${new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`,
        sections: parsedSections.length > 0 ? parsedSections : [
          { heading: 'Policy Details', content: editPolicyContent }
        ]
      }
    };

    updateSystemSettings('documentPolicies', updatedPolicies);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* 1. BREADCRUMBS, HEADER & SYSTEM INTEGRITY BAR */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-surface-container-lowest p-6 rounded-xl shadow-sm">
        <div className="flex flex-col gap-2 max-w-4xl">
          <div className="flex items-center gap-2 text-secondary font-label-xs text-label-xs uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveTabGlobal && setActiveTabGlobal('admin_dashboard')}
              className="hover:text-primary transition-colors cursor-pointer text-left"
              title="Navigate to Executive Overview"
            >
              Admin Operations
            </button>
            <span className="text-secondary/40 font-bold">/</span>
            <button
              type="button"
              onClick={() => setActiveTab('governance')}
              className="hover:text-primary transition-colors cursor-pointer text-left"
              title="Reset to Governance view"
            >
              Global System Architecture
            </button>
            <span className="text-secondary/40 font-bold">/</span>
            <span className="text-on-surface font-semibold">Master Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">System Master Settings &amp; Enterprise Governance</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary font-label-xs text-label-xs font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
              Cluster 01-PROD
            </span>
          </div>
          <p className="font-body-md text-body-md text-secondary leading-relaxed">
            Centralized administration for national multi-tier dealer quotas, real-time pricing engines, RBAC permission matrix, state DISCOM protocol maps, and regulatory audit compliance logs.
          </p>
        </div>

        {/* Top Action Controls & Maintenance Switch */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Maintenance Mode Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-lg shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
            <span className="font-label-xs text-label-xs text-secondary uppercase font-semibold">Maintenance</span>
            <button
              type="button"
              onClick={() => setMaintenance(!maintenance)}
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${maintenance ? 'bg-error' : 'bg-surface-container-highest'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${maintenance ? 'translate-x-4' : 'translate-x-0'
                  }`}
              />
            </button>
            <span className="font-label-xs text-label-xs font-bold text-secondary">
              {maintenance ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          {/* Deploy CTA */}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saved ? 'verified' : 'lock_reset'}
            </span>
            <span>{saved ? 'Enforced Globally' : 'Save changes'}</span>
          </button>
        </div>
      </div>

      {/* 2. ADMIN HORIZONTAL TABBED WORKSPACE */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 px-4 overflow-x-auto bg-surface-container-low/40">
          <button
            onClick={() => setActiveTab('governance')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors ${activeTab === 'governance'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px] text-primary-container">shield_person</span>
            <span>1. Enterprise Governance &amp; ALMM</span>
            {activeTab === 'governance' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>

          <button
            onClick={() => setActiveTab('margins')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors ${activeTab === 'margins'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px]">pie_chart</span>
            <span>2. Dealer Quota &amp; Margin Caps</span>
            {activeTab === 'margins' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>

          <button
            onClick={() => setActiveTab('infrastructure')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'infrastructure'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px]">hub</span>
            <span>3. DISCOM Grid Node Bridge</span>
            {activeTab === 'infrastructure' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'lifecycle'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px]">alt_route</span>
            <span>4. File Lifecycle Pipeline</span>
            {activeTab === 'lifecycle' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'finance'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px]">payments</span>
            <span>5. Cash vs Loan Rules</span>
            {activeTab === 'finance' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 py-3 px-3.5 font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'policies'
                ? 'font-bold text-on-surface bg-surface-container-lowest rounded-t-lg shadow-sm'
                : 'text-secondary hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[17px]">description</span>
            <span>6. Document Policies</span>
            {activeTab === 'policies' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-container"></span>}
          </button>
        </div>

        {/* Tab Content 1: Governance & Compliance */}
        {activeTab === 'governance' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">policy</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">MNRE Regulatory Governance &amp; Central DBT</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-xs text-label-xs font-bold">
                COMPLIANCE ENFORCED
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div>
                  <span className="font-label-md text-label-md text-on-surface font-bold block">
                    Mandatory ALMM Compliant Module Enforcement
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary block mt-1">
                    Strictly prohibit non-ALMM (Approved List of Models and Manufacturers) listed solar photovoltaic modules from inclusion in grid-interactive customer proposals.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enforceAlmm}
                  onChange={(e) => setSettings({ ...settings, enforceAlmm: e.target.checked })}
                  className="rounded text-primary-container focus:ring-primary-container w-5 h-5 mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div>
                  <span className="font-label-md text-label-md text-on-surface font-bold block">
                    PM Surya Ghar: Muft Bijli Yojana Central DBT Auto-Calculation
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary block mt-1">
                    Automatically inject central residential subsidy slabs (₹30,000 for 1kW, ₹60,000 for 2kW, ₹78,000 for 3kW+) into residential proposals nationwide.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.pmSuryaGharActive}
                  onChange={(e) => setSettings({ ...settings, pmSuryaGharActive: e.target.checked })}
                  className="rounded text-primary-container focus:ring-primary-container w-5 h-5 mt-1"
                />
              </div>

              <div className="flex items-start justify-between p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                <div>
                  <span className="font-label-md text-label-md text-on-surface font-bold block">
                    Automated GEDA State Registration Queue Sync
                  </span>
                  <span className="font-body-sm text-body-sm text-secondary block mt-1">
                    Dispatch approved dealer proposals to GEDA (Gujarat Energy Development Agency) API endpoint for net-metering synchronization.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoGedaSync}
                  onChange={(e) => setSettings({ ...settings, autoGedaSync: e.target.checked })}
                  className="rounded text-primary-container focus:ring-primary-container w-5 h-5 mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Dealer Margin & Pricing */}
        {activeTab === 'margins' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">price_change</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">National Margin Ceilings &amp; Quotas</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-xs text-label-xs font-bold">
                COMMERCIAL CAPS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-surface-container-low">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold">Maximum Dealer Margin (₹ / kW)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-secondary font-bold">₹</span>
                  <input
                    type="number"
                    value={settings.maxDealerMarginPerKW}
                    onChange={(e) => setSettings({ ...settings, maxDealerMarginPerKW: Number(e.target.value) })}
                    className="w-full pl-8 pr-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg font-headline-sm text-on-surface font-bold"
                  />
                </div>
                <span className="text-[11px] font-body-sm text-secondary">Authorized channel partners cannot exceed this margin per kW.</span>
              </div>

              <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-surface-container-low">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold">High-Capacity Executive Approval Trigger</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={settings.requireAdminApprovalAboveKW}
                    onChange={(e) => setSettings({ ...settings, requireAdminApprovalAboveKW: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg font-headline-sm text-on-surface font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-secondary font-bold">kW</span>
                </div>
                <span className="text-[11px] font-body-sm text-secondary">Quotations exceeding this capacity require Headquarters review.</span>
              </div>

              <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-surface-container-low">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold">Quotation Expiry Validity (Days)</label>
                <input
                  type="number"
                  value={settings.quoteExpiryDays}
                  onChange={(e) => setSettings({ ...settings, quoteExpiryDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg font-headline-sm text-on-surface font-bold mt-1"
                />
                <span className="text-[11px] font-body-sm text-secondary">Hardware pricing locks dynamically after validity expires.</span>
              </div>

              <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-surface-container-low">
                <label className="font-label-sm text-label-sm text-on-surface font-semibold">Audit Ledger Retention Window (Months)</label>
                <input
                  type="number"
                  value={settings.retentionMonths}
                  onChange={(e) => setSettings({ ...settings, retentionMonths: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg font-headline-sm text-on-surface font-bold mt-1"
                />
                <span className="text-[11px] font-body-sm text-secondary">Statutory compliance for EPC audits and GST ledgers.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Infrastructure */}
        {activeTab === 'infrastructure' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">dns</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">DISCOM Grid Node Status</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-xs text-label-xs font-bold">
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary">PGVCL Bridge</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-container animate-pulse"></span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface">Live (12ms)</span>
                <span className="text-[11px] text-secondary">Metoda Sub-division link active</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary">GEDA State Portal</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface">Connected</span>
                <span className="text-[11px] text-secondary">Hourly batch sync enabled</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-secondary">Encrypted DB Snapshot</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface">Today, 01:15 AM</span>
                <span className="text-[11px] text-secondary">AES-256 backup verified</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 4: Lifecycle Pipeline */}
        {activeTab === 'lifecycle' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">alt_route</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Customer File Lifecycle Architecture</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-xs text-label-xs font-bold">
                10-STAGE PIPELINE ACTIVE
              </span>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Standard chronological progression for residential and C&amp;I solar rooftop plants across Gujarat DISCOMs (UGVCL, DGVCL, MGVCL, PGVCL). Document verification steps are strictly non-blocking.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {(systemSettings?.fileLifecycle?.stages || [
                { id: 'LEAD_SOURCED', label: '1. Lead Sourced & Feasibility Check' },
                { id: 'SITE_SURVEY', label: '2. Site Feasibility & Roof CAD Survey' },
                { id: 'QUOTATION_ACCEPTED', label: '3. Quotation Accepted & Advance Token' },
                { id: 'DISCOM_APPLICATION', label: '4. DISCOM Net-Meter Application Filed' },
                { id: 'FEASIBILITY_APPROVAL', label: '5. Technical Feasibility & Sanction Approved' },
                { id: 'PLANT_INSTALLATION', label: '6. Solar Hardware Installation (Modules & Inverter)' },
                { id: 'CEI_INSPECTION', label: '7. Safety CEI Drawing Inspection' },
                { id: 'NET_METER_SYNC', label: '8. Bidirectional Net-Meter Grid Energization' },
                { id: 'SUBSIDY_CLAIM', label: '9. PM Surya Ghar DBT Claim Verification' },
                { id: 'HANDOVER_COMPLETED', label: '10. Commissioned & Handed Over with Warranty Pack' }
              ]).map((stg, i) => (
                <div key={stg.id || i} className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-[11px]">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-on-surface">{stg.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-secondary px-2 py-0.5 rounded bg-surface-container-lowest">
                    {stg.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 5: Cash vs Loan Financing Rules */}
        {activeTab === 'finance' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Payment &amp; Financing Governance</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-xs text-label-xs font-bold">
                PM SURYA GHAR LINKED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low space-y-3">
                <h4 className="font-['Space_Grotesk'] font-bold text-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">account_balance</span>
                  Authorized Partner Banks (Gujarat Region)
                </h4>
                <div className="space-y-2 text-xs">
                  {['State Bank of India (Surya Ghar Collateral-Free Loan)', 'Bank of Baroda (Solar Roof Loan)', 'HDFC Bank Green Energy Loan', 'Canara Bank Rooftop Credit', 'ICICI Bank Solar Fin', 'Union Bank of India'].map((b, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest">
                      <span className="font-medium text-on-surface">{b}</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-700">7.00% p.a.</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low space-y-3 text-xs">
                <h4 className="font-['Space_Grotesk'] font-bold text-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">rule</span>
                  Financing Rules &amp; Subsidy Flow
                </h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-surface-container-lowest">
                    <span className="text-secondary block">Upfront Customer Margin / Down Payment</span>
                    <span className="font-bold text-on-surface text-sm mt-0.5 block">Minimum 10% (Zero Down Payment on Eligible Bank Tiers)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-lowest">
                    <span className="text-secondary block">Tenure Range</span>
                    <span className="font-bold text-on-surface text-sm mt-0.5 block">36 to 84 Months (Repayment amortized via solar savings)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-lowest">
                    <span className="text-secondary block">Central Subsidy DBT Handling</span>
                    <span className="font-bold text-on-surface text-sm mt-0.5 block">₹ 78,000 credited directly to customer Aadhaar-linked account</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 6: Document Policies Editor */}
        {activeTab === 'policies' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">description</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Dynamic Document &amp; Policy Editor</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-xs text-label-xs font-bold">
                REFLECTS IN-APP REALTIME
              </span>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-secondary font-medium mb-1">Select Policy to Manage</label>
                  <select
                    value={selectedPolicyKey}
                    onChange={(e) => setSelectedPolicyKey(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer font-medium"
                  >
                    <option value="aboutUs">About Sunvine Renewable Energy</option>
                    <option value="termsAndConditions">Platform Terms &amp; Conditions</option>
                    <option value="privacyPolicy">Privacy Policy &amp; Data Confidentiality</option>
                    <option value="dealerAgreement">Dealer Partner Operations Agreement</option>
                    <option value="staffPolicy">Sales Staff Operational Directives</option>
                    <option value="quotationTerms">Quotation Terms &amp; Conditions</option>
                    <option value="cancellationPolicy">Project Cancellation &amp; Refund Policy</option>
                    <option value="legalDisclaimer">MNRE Subsidy &amp; Statutory Disclaimers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-secondary font-medium mb-1">Policy Document Title</label>
                  <input
                    type="text"
                    value={editPolicyTitle}
                    onChange={(e) => setEditPolicyTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary font-bold text-on-surface"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-secondary font-medium">Policy Markdown Content (Use ### Heading for sections)</label>
                  <span className="text-[11px] text-secondary">Applies globally across all portals</span>
                </div>
                <textarea
                  rows={12}
                  value={editPolicyContent}
                  onChange={(e) => setEditPolicyContent(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-all cursor-pointer shadow-xs min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save &amp; Commit Policy to Audit Ledger</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
