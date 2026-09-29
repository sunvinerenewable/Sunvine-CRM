import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

const DEFAULT_BANKS = [
  { id: 'bnk-1', name: 'State Bank of India', scheme: 'PM Surya Ghar Collateral-Free Loan', interestRate: 7.00, minTenureYears: 3, maxTenureYears: 10, status: 'Active', collateralFree: true },
  { id: 'bnk-2', name: 'Bank of Baroda', scheme: 'Baroda Solar Rooftop Scheme', interestRate: 7.00, minTenureYears: 3, maxTenureYears: 7, status: 'Active', collateralFree: true },
  { id: 'bnk-3', name: 'HDFC Bank Ltd.', scheme: 'Green Energy Rooftop Finance', interestRate: 8.50, minTenureYears: 3, maxTenureYears: 7, status: 'Active', collateralFree: false },
  { id: 'bnk-4', name: 'Canara Bank', scheme: 'Canara Solar Credit Support', interestRate: 7.00, minTenureYears: 3, maxTenureYears: 7, status: 'Active', collateralFree: true },
  { id: 'bnk-5', name: 'ICICI Bank', scheme: 'Solar Fin Term Facility', interestRate: 8.75, minTenureYears: 3, maxTenureYears: 5, status: 'Active', collateralFree: false },
  { id: 'bnk-6', name: 'Union Bank of India', scheme: 'Union Solar Green Loan', interestRate: 7.15, minTenureYears: 3, maxTenureYears: 10, status: 'Active', collateralFree: true }
];

const DEFAULT_PIPELINE_STAGES = [
  { id: 'LEAD_SOURCED', label: '1. Lead Sourced & Feasibility Check', description: 'Customer inquiry recorded, initial solar feasibility verified', mandatory: true },
  { id: 'SITE_SURVEY', label: '2. Site Feasibility & Roof CAD Survey', description: 'Rooftop measurements, tilt angle, and shadow profiling', mandatory: true },
  { id: 'QUOTATION_ACCEPTED', label: '3. Quotation Accepted & Advance Token', description: 'Customer confirms proposal and pays booking advance', mandatory: true },
  { id: 'DISCOM_APPLICATION', label: '4. DISCOM Net-Meter Application Filed', description: 'Formal submission to PGVCL/UGVCL/DGVCL/MGVCL web portal', mandatory: true },
  { id: 'FEASIBILITY_APPROVAL', label: '5. Technical Feasibility & Sanction Approved', description: 'DISCOM site inspection clearance and technical sanction letter', mandatory: true },
  { id: 'PLANT_INSTALLATION', label: '6. Solar Hardware Installation (Modules & Inverter)', description: 'Module mounting structure, solar PV panels, and inverter commissioning', mandatory: true },
  { id: 'CEI_INSPECTION', label: '7. Safety CEI Drawing Inspection', description: 'Chief Electrical Inspectorate safety approval for systems > 10 kW', mandatory: false },
  { id: 'NET_METER_SYNC', label: '8. Bidirectional Net-Meter Grid Energization', description: 'Installation of bi-directional meter and synchronisation with power grid', mandatory: true },
  { id: 'SUBSIDY_CLAIM', label: '9. PM Surya Ghar DBT Claim Verification', description: 'Uploading commissioning certificate on National Portal for central subsidy', mandatory: true },
  { id: 'HANDOVER_COMPLETED', label: '10. Commissioned & Handed Over with Warranty Pack', description: 'Plant handover to customer with manufacturer warranty documentation', mandatory: true }
];

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

  // Bank Master State (SR-64)
  const [banksList, setBanksList] = useState(() => {
    return systemSettings?.fileLifecycle?.loanBanksDetailed || DEFAULT_BANKS;
  });
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [bankForm, setBankForm] = useState({
    name: '',
    scheme: '',
    interestRate: 7.0,
    minTenureYears: 3,
    maxTenureYears: 7,
    status: 'Active',
    collateralFree: true
  });

  // Pipeline Stages Master State (SR-64)
  const [stagesList, setStagesList] = useState(() => {
    return systemSettings?.fileLifecycle?.stagesDetailed || DEFAULT_PIPELINE_STAGES;
  });
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [stageForm, setStageForm] = useState({
    id: '',
    label: '',
    description: '',
    mandatory: true
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

  // Bank Master Handlers (SR-64)
  const handleSaveBankMaster = () => {
    if (!updateSystemSettings) return;
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      loanBanksDetailed: banksList,
      loanBanks: banksList.filter(b => b.status === 'Active').map(b => b.name)
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggleBankStatus = (bankId) => {
    setBanksList(prev => prev.map(b => b.id === bankId ? { ...b, status: b.status === 'Active' ? 'Disabled' : 'Active' } : b));
  };

  const handleDeleteBank = (bankId) => {
    setBanksList(prev => prev.filter(b => b.id !== bankId));
  };

  const handleOpenAddBank = () => {
    setEditingBank(null);
    setBankForm({
      name: '',
      scheme: '',
      interestRate: 7.0,
      minTenureYears: 3,
      maxTenureYears: 7,
      status: 'Active',
      collateralFree: true
    });
    setShowBankModal(true);
  };

  const handleOpenEditBank = (bank) => {
    setEditingBank(bank);
    setBankForm({
      name: bank.name || '',
      scheme: bank.scheme || '',
      interestRate: bank.interestRate || 7.0,
      minTenureYears: bank.minTenureYears || 3,
      maxTenureYears: bank.maxTenureYears || 7,
      status: bank.status || 'Active',
      collateralFree: bank.collateralFree !== undefined ? bank.collateralFree : true
    });
    setShowBankModal(true);
  };

  const handleSaveBankForm = (e) => {
    e.preventDefault();
    if (editingBank) {
      setBanksList(prev => prev.map(b => b.id === editingBank.id ? { ...b, ...bankForm } : b));
    } else {
      const newBank = {
        ...bankForm,
        id: `bnk-${Date.now().toString().slice(-4)}`
      };
      setBanksList(prev => [...prev, newBank]);
    }
    setShowBankModal(false);
    setEditingBank(null);
  };

  // Pipeline Stages Master Handlers (SR-64)
  const handleSavePipelineStages = () => {
    if (!updateSystemSettings) return;
    updateSystemSettings('fileLifecycle', {
      ...systemSettings?.fileLifecycle,
      stagesDetailed: stagesList,
      stages: stagesList.map(s => s.label)
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggleStageMandatory = (stageId) => {
    setStagesList(prev => prev.map(s => s.id === stageId ? { ...s, mandatory: !s.mandatory } : s));
  };

  const handleDeleteStage = (stageId) => {
    setStagesList(prev => prev.filter(s => s.id !== stageId));
  };

  const handleOpenAddStage = () => {
    setEditingStage(null);
    setStageForm({
      id: `STAGE_${Date.now().toString().slice(-4)}`,
      label: '',
      description: '',
      mandatory: true
    });
    setShowStageModal(true);
  };

  const handleOpenEditStage = (stage) => {
    setEditingStage(stage);
    setStageForm({
      id: stage.id,
      label: stage.label || '',
      description: stage.description || '',
      mandatory: stage.mandatory !== undefined ? stage.mandatory : true
    });
    setShowStageModal(true);
  };

  const handleSaveStageForm = (e) => {
    e.preventDefault();
    if (editingStage) {
      setStagesList(prev => prev.map(s => s.id === editingStage.id ? { ...s, ...stageForm } : s));
    } else {
      const newStage = {
        ...stageForm,
        id: stageForm.id || `STAGE_${Date.now().toString().slice(-4)}`
      };
      setStagesList(prev => [...prev, newStage]);
    }
    setShowStageModal(false);
    setEditingStage(null);
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

        {/* Tab Content 4: Lifecycle Pipeline Master (SR-64) */}
        {activeTab === 'lifecycle' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-container-high gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">alt_route</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Customer File Lifecycle Pipeline Master
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Configure official Gujarat DISCOM milestones, mandatory checklist gates, and stage descriptions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddStage}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Add Stage</span>
                </button>
                <button
                  type="button"
                  onClick={handleSavePipelineStages}
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Save Pipeline</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {stagesList.map((stg, i) => (
                <div key={stg.id || i} className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-on-surface text-xs">{stg.label}</div>
                        {stg.description && (
                          <div className="text-[11px] text-secondary mt-0.5 leading-relaxed">{stg.description}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-secondary px-2 py-0.5 rounded bg-surface-container-lowest shrink-0">
                      {stg.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container/60 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleToggleStageMandatory(stg.id)}
                      className={`px-2 py-0.5 rounded-full font-semibold transition-colors cursor-pointer text-[10px] flex items-center gap-1 ${
                        stg.mandatory
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-surface-container text-secondary'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {stg.mandatory ? 'Mandatory Gate' : 'Optional Stage'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditStage(stg)}
                        className="p-1 rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
                        title="Edit Stage Details"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {i >= 10 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(stg.id)}
                          className="p-1 rounded hover:bg-error/10 text-secondary hover:text-error transition-colors cursor-pointer"
                          title="Delete Custom Stage"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 5: Cash vs Loan Financing & Bank Master CRUD (SR-64) */}
        {activeTab === 'finance' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-container-high gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">account_balance</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Partner Bank Master &amp; Solar Loan Financing Rules
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Centralized bank interest rates, maximum loan tenures, and collateral-free flags for PM Surya Ghar rooftop credit.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddBank}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Add Bank</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveBankMaster}
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Save Bank Master</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1">
                <span className="text-[10px] text-secondary font-semibold uppercase">Active Partner Banks</span>
                <span className="font-mono text-xl font-bold text-primary">
                  {banksList.filter(b => b.status === 'Active').length} Banks
                </span>
                <span className="text-[11px] text-secondary">Authorized for Gujarat Rooftops</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1">
                <span className="text-[10px] text-secondary font-semibold uppercase">Collateral-Free Schemes</span>
                <span className="font-mono text-xl font-bold text-emerald-400">
                  {banksList.filter(b => b.collateralFree && b.status === 'Active').length} Schemes
                </span>
                <span className="text-[11px] text-secondary">Zero mortgage required</span>
              </div>
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1">
                <span className="text-[10px] text-secondary font-semibold uppercase">Lowest Interest Benchmark</span>
                <span className="font-mono text-xl font-bold text-on-surface">
                  {Math.min(...banksList.filter(b => b.status === 'Active').map(b => b.interestRate || 7.0)).toFixed(2)}% p.a.
                </span>
                <span className="text-[11px] text-secondary">Concessional green credit</span>
              </div>
            </div>

            {/* Banks Master Table */}
            <div className="overflow-x-auto rounded-xl border border-surface-container-high bg-surface-container-low">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-container text-secondary font-semibold uppercase text-[10px] tracking-wider bg-surface-container-low/80">
                    <th className="py-2.5 px-3">Bank &amp; Financing Scheme</th>
                    <th className="py-2.5 px-3 text-right">Interest Rate (% p.a.)</th>
                    <th className="py-2.5 px-3 text-center">Tenure Range</th>
                    <th className="py-2.5 px-3 text-center">Security</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {banksList.map((bank) => (
                    <tr key={bank.id} className="hover:bg-surface-container transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">{bank.name}</div>
                        <div className="text-[11px] text-secondary">{bank.scheme || 'Solar Rooftop Term Loan'}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary">
                        {Number(bank.interestRate).toFixed(2)}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {bank.minTenureYears} to {bank.maxTenureYears} Years
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          bank.collateralFree ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-container text-secondary'
                        }`}>
                          {bank.collateralFree ? 'Collateral-Free' : 'Secured'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          bank.status === 'Active' ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-secondary'
                        }`}>
                          {bank.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleBankStatus(bank.id)}
                            className="p-1 rounded hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors cursor-pointer"
                            title={bank.status === 'Active' ? 'Disable Bank' : 'Activate Bank'}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {bank.status === 'Active' ? 'block' : 'check_circle'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditBank(bank)}
                            className="p-1 rounded hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors cursor-pointer"
                            title="Edit Bank"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBank(bank.id)}
                            className="p-1 rounded hover:bg-error/10 text-secondary hover:text-error transition-colors cursor-pointer"
                            title="Delete Bank"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Modal: Add / Edit Partner Bank (SR-64) */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-xl">account_balance</span>
                <h3 className="font-headline-md text-base font-bold text-inverse-surface">
                  {editingBank ? 'Edit Partner Bank' : 'Add New Partner Bank'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBankForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. State Bank of India"
                  value={bankForm.name}
                  onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Scheme / Product Title</label>
                <input
                  type="text"
                  placeholder="e.g. PM Surya Ghar Collateral-Free Solar Loan"
                  value={bankForm.scheme}
                  onChange={(e) => setBankForm({ ...bankForm, scheme: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Interest (% p.a.) *</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={bankForm.interestRate}
                    onChange={(e) => setBankForm({ ...bankForm, interestRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min Tenure (Yrs)</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={bankForm.minTenureYears}
                    onChange={(e) => setBankForm({ ...bankForm, minTenureYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Max Tenure (Yrs)</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={bankForm.maxTenureYears}
                    onChange={(e) => setBankForm({ ...bankForm, maxTenureYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankForm.collateralFree}
                    onChange={(e) => setBankForm({ ...bankForm, collateralFree: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-on-surface">Collateral-Free Rooftop Loan</span>
                </label>

                <select
                  value={bankForm.status}
                  onChange={(e) => setBankForm({ ...bankForm, status: e.target.value })}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container border border-surface-container-highest font-semibold cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary transition-all cursor-pointer"
                >
                  {editingBank ? 'Update Bank' : 'Add Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Pipeline Stage (SR-64) */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4 text-on-surface">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-xl">alt_route</span>
                <h3 className="font-headline-md text-base font-bold text-inverse-surface">
                  {editingStage ? 'Edit Pipeline Stage' : 'Add Custom Pipeline Stage'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStageModal(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStageForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Stage Code / ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. METER_BOX_INSTALL"
                  value={stageForm.id}
                  disabled={Boolean(editingStage)}
                  onChange={(e) => setStageForm({ ...stageForm, id: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Stage Name / Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DISCOM Meter Box Installation"
                  value={stageForm.label}
                  onChange={(e) => setStageForm({ ...stageForm, label: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Operational Description</label>
                <textarea
                  rows="2"
                  placeholder="Scope of work and verification tasks in this stage..."
                  value={stageForm.description}
                  onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-highest rounded-lg focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stageForm.mandatory}
                    onChange={(e) => setStageForm({ ...stageForm, mandatory: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-on-surface">Mandatory Compliance Gate</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-surface-container-highest text-secondary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary font-bold hover:bg-primary transition-all cursor-pointer"
                >
                  {editingStage ? 'Update Stage' : 'Add Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
