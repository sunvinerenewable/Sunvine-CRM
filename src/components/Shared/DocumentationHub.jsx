import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from './Toast';

export const MASTER_DOCUMENTATION_POLICIES = {
  aboutUs: {
    title: 'About Sunvine Renewable Energy',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: 'Company Overview & Mission',
        content: `Sunvine Renewable Energy is an enterprise-grade solar engineering, procurement, and construction (EPC) and channel management platform operating extensively across Gujarat, India. Our mission is to accelerate the transition to decentralized rooftop solar by seamlessly uniting consumers, certified field sales representatives, authorized dealer partners, and state electricity distribution companies (DISCOMs) through verifiable digital workflows.`
      },
      {
        heading: 'Operational Footprint in Gujarat',
        content: `Headquartered in Ahmedabad, Sunvine supports clean energy deployment across all four Gujarat DISCOM jurisdictions:
• Uttar Gujarat Vij Company Limited (UGVCL) — Ahmedabad, Gandhinagar, Sabarkantha, Mehsana
• Paschim Gujarat Vij Company Limited (PGVCL) — Rajkot, Jamnagar, Bhavnagar, Junagadh, Kutch
• Dakshin Gujarat Vij Company Limited (DGVCL) — Surat, Navsari, Valsad, Bharuch
• Madhya Gujarat Vij Company Limited (MGVCL) — Vadodara, Anand, Kheda, Godhra

Our authorized network encompasses 550+ registered solar channel partners, ensuring rooftop surveys, engineering verification, and installation support in urban centers and rural talukas alike.`
      },
      {
        heading: 'PM Surya Ghar Muft Bijli Yojana Alignment',
        content: `Sunvine operates in strict accordance with the Ministry of New and Renewable Energy (MNRE) guidelines under the PM Surya Ghar Muft Bijli Yojana. Our system facilitates automatic capacity computation, central financial assistance (DBT) eligibility checks, and expedited net-meter documentation for 1 kW to 10 kW residential installations.`
      }
    ]
  },
  termsAndConditions: {
    title: 'Platform Terms & Standard Operating Conditions',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Authorization & Permitted Access',
        content: `Access to this enterprise portal is granted solely to registered channel partners, verified sales executives, operations verification officers, and corporate administrators. Credentials are non-transferable. Any unauthorized dissemination of system pricing, channel margins, or consumer PII is strictly prohibited.`
      },
      {
        heading: '2. Quotation Validity & Price Lock',
        content: `• Standard Quotations: System proposals generated via the quotation engine are valid for fifteen (15) calendar days from the timestamp of generation.
• Commodity Fluctuations: Quotations exceeding the 15-day validity window must be re-evaluated to reflect prevailing aluminum extrusion, copper wire, and international silicon wafer market benchmarks.
• Inclusions: Quoted turnkey project amounts include photovoltaic modules, grid-tie inverter, hot-dip galvanized mounting structures, AC/DC distribution boxes, Class-A bi-directional meter liaison, and composite taxes.`
      },
      {
        heading: '3. Technical & Regulatory Compliance',
        content: `All solar installations commissioned through Sunvine must satisfy:
1. MNRE Approved List of Models and Manufacturers (ALMM) List-I for bifacial/monofacial PV modules.
2. Bureau of Indian Standards (BIS) IS 14286 and IS/IEC 61730 certifications.
3. Central Electricity Authority (CEA) Technical Standards for Connectivity of the Distributed Generation Resources Regulations.
4. GERC (Gujarat Electricity Regulatory Commission) Net Metering Regulations.`
      },
      {
        heading: '4. Balance of System (BOS) Guarantee',
        content: `Sunvine provides a mandatory five (5) year comprehensive on-site installation and balance of system (BOS) workmanship guarantee covering all cabling, switchgear, surge protection devices, and earthing chemical pits.`
      }
    ]
  },
  privacyPolicy: {
    title: 'Consumer Data Protection & Privacy Policy',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Categories of Data Collected',
        content: `To facilitate grid-connected solar commissioning, the portal collects and processes:
• Consumer Identification: Full customer name, Aadhaar card number (masked for storage), PAN, and primary contact phone number.
• Utility Records: DISCOM monthly electricity bills, consumer connection number, sanctioned load (kW), and meter photographic proof.
• Premise Records: Site GPS coordinates, terrace elevation photos, and municipal property tax bill copies.
• Financial Information: Bank passbook copies or cancelled cheques utilized exclusively for MNRE DBT subsidy crediting.`
      },
      {
        heading: '2. Storage Security & Zero Third-Party Monetization',
        content: `• Storage & Encryption: Consumer data is encrypted both in transit (TLS 1.3) and at rest.
• Zero Advertising Sharing: Sunvine strictly prohibits selling, leasing, or brokering consumer contact details or power consumption profiles to third-party telemarketers or advertisers.
• Confidentiality: Financial documents are restricted strictly to authorized Verification Desk officers and state nodal agency submission portals.`
      }
    ]
  },
  dealerAgreement: {
    title: 'Authorized Dealer & Channel Partner Agreement',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Channel Margin Compliance & Cap Enforcement',
        content: `To protect consumers from unprincipled price markups, all authorized dealers agree to operate strictly within Sunvine margin ceilings:
• Standard Residential Ceiling: Maximum allowable dealer margin markup is capped at ₹8,000 per kW.
• Direct Company Quotations: Retain ₹0 dealer margin for corporate direct clients.
• Flagged Proposals: Any proposal exceeding the established tier margin triggers an automatic audit flag requiring Super Admin review prior to release.`
      },
      {
        heading: '2. Site Survey & Foundation Integrity',
        content: `Channel partners are directly responsible for physical rooftop inspections, structural load-bearing verification, and identifying critical obstacles (overhead water tanks, parapet shade, elevator mumty structures). All structural mountings must withstand wind velocities up to 150 km/h in coastal Gujarat zones.`
      },
      {
        heading: '3. Timely Commission Disbursals',
        content: `Dealer commissions and margins are settled in verified batches following customer order confirmation and material dispatch milestone verification. Transparent payout status is trackable in the Dealer Console.`
      }
    ]
  },
  staffPolicy: {
    title: 'Staff Operations, Sales & Verification Desk Code',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Dual Staff Department Structure',
        content: `The Sunvine Staff Portal operates under two specialized operational divisions:
• Field Sales Team (Area Sales Executives): Responsible for dealer recruitment, territory lead generation, rooftop measurements, and initial document acquisition from clients.
• Operations & Verification Desk (Verification Managers): Responsible for back-office intake of documents, utility consumer verification, cross-checking technical load sanctions, advancing official file stages, and filing GEDA net-metering applications.`
      },
      {
        heading: '2. Systematic In-App Document Intake',
        content: `Operations staff and field officers must replace informal, unorganized WhatsApp document sharing with in-app Document Vault submissions. Documents uploaded through the platform are time-stamped and catalogued for permanent audit compliance.`
      },
      {
        heading: '3. Attribution Integrity',
        content: `Sales representatives must accurately tag customer files as either 'Direct Company Sales' or 'Dealer Partner Sourced'. Falsification of file attribution is grounds for immediate credential revocation.`
      }
    ]
  },
  quotationTerms: {
    title: 'Quotation Commercial Terms, Pricing & Warranties',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Standard Turnkey Commercial Terms',
        content: `• Cash Purchase Milestone Schedule:
  - 10% Advance Token Amount with booking confirmation.
  - 80% Prior to material dispatch from Central Sunvine Warehouse.
  - 10% Upon physical rooftop installation & joint meter test submission.
• Bank Solar Loan Milestone Schedule:
  - 10% - 15% Customer down payment (or zero down payment under specific DBT bank schemes).
  - Balance loan sanctioned and disbursed in tranches directly by partner bank (SBI, BoB, HDFC, Canara).`
      },
      {
        heading: '2. Manufacturer Warranties',
        content: `• Solar PV Modules: 12-year comprehensive product workmanship warranty + 30-year linear performance warranty guaranteeing ≥ 80% power output at Year 30.
• Solar On-Grid Inverter: 8-year manufacturer replacement guarantee with IP65 / IP66 outdoor weatherproofing.
• Galvanized Iron (GI) Structure: 15-year structural corrosion protection against coastal salt fog and rust.`
      },
      {
        heading: '3. Statutory Tax Structure',
        content: `All quoted proposals incorporate composite solar GST (70% material goods assessed at 12% GST + 30% EPC commissioning services assessed at 18% GST), resulting in an effective statutory composite GST rate of 13.8%.`
      }
    ]
  },
  cancellationPolicy: {
    title: 'Cancellation, Rescheduling & Refund Protocol',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. 100% Refundable Feasibility Guarantee',
        content: `If a rooftop solar application is formally rejected by the DISCOM due to distribution transformer (DT) technical capacity saturation (100% limit reached) prior to equipment procurement, the customer is entitled to a full 100% refund of the advance token booking deposit within seven (7) banking days.`
      },
      {
        heading: '2. Voluntary Consumer Cancellation',
        content: `• Before Material Dispatch: 100% refund less nominal administrative documentation charges of ₹2,500.
• Post Material Dispatch: Material restocking fee of 10% of total project value applies to cover return logistics and warehousing.
• Post Mechanical Installation: Non-cancellable once rooftop structural drilling, anchoring, and panel mounting have occurred.`
      }
    ]
  },
  legalDisclaimer: {
    title: 'Legal, Subsidy & Environmental Disclaimers',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. PM Surya Ghar Muft Bijli Subsidy Disclaimer',
        content: `Central Financial Assistance (CFA / DBT Subsidy) of up to ₹78,000 is sanctioned and disbursed directly by the Ministry of New and Renewable Energy (MNRE), Government of India, to the customer bank account post-inspection by DISCOM. Sunvine acts solely as the facilitating EPC and does not hold or deduct subsidy funds.`
      },
      {
        heading: '2. Solar Yield & Generation Forecasts',
        content: `Solar electricity generation forecasts provided in proposals assume standard Gujarat average insolation of ~5.2 to 5.5 peak sun hours per day with an optimum south-facing tilt angle of 20° to 24°. Actual annual yield may fluctuate due to atmospheric particulate accumulation, cloud cover, and seasonal variations.`
      },
      {
        heading: '3. Grid Synchronization Requirements',
        content: `Grid-tied solar inverters automatically de-energize (anti-islanding protection) during grid outages for line worker safety. Continued generation requires an active DISCOM electrical grid reference signal.`
      }
    ]
  },
  versionInfo: {
    title: 'System Architecture & Technical Release Notes',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: 'System Engine Specifications',
        content: `• Platform: Sunvine Renewable Business Management Platform v4.18.2
• Framework: React 18 + Vite 6 + Tailwind CSS Material Design 3 Tokens
• PWA Offline Engine: Service Worker Precache v0.21.2 with local storage ledger resilience
• Compliance: Zero hardcoded secrets, RFC-4180 CSV export compliance, and WCAG AA accessibility standards.`
      },
      {
        heading: 'DISCOM & Regulatory Compatibility',
        content: `Fully synchronized with Gujarat GEDA net-metering protocols, MNRE National Portal DBT specifications, and PM Surya Ghar application schemas.`
      }
    ]
  }
};

export default function DocumentationHub() {
  const { systemSettings } = useApp();
  const { addToast } = useToast();

  const [activePolicyKey, setActivePolicyKey] = useState('aboutUs');
  const [searchTerm, setSearchTerm] = useState('');

  const policyMenu = [
    { key: 'aboutUs', label: '1. About Sunvine Renewable', icon: 'solar_power' },
    { key: 'termsAndConditions', label: '2. Platform Terms & Conditions', icon: 'gavel' },
    { key: 'privacyPolicy', label: '3. Privacy & Data Usage', icon: 'security' },
    { key: 'dealerAgreement', label: '4. Dealer Partner Agreement', icon: 'handshake' },
    { key: 'staffPolicy', label: '5. Staff Operations Code', icon: 'badge' },
    { key: 'quotationTerms', label: '6. Quotation & Pricing Terms', icon: 'receipt_long' },
    { key: 'cancellationPolicy', label: '7. Cancellation & Refunds', icon: 'event_busy' },
    { key: 'legalDisclaimer', label: '8. Legal & Subsidy Disclaimers', icon: 'warning' },
    { key: 'versionInfo', label: '9. System Architecture & Versions', icon: 'terminal' }
  ];

  // Resolve policy: prefer rich MASTER_DOCUMENTATION_POLICIES, fallback to dynamic settings if populated
  const currentPolicy = useMemo(() => {
    const defaultData = MASTER_DOCUMENTATION_POLICIES[activePolicyKey];
    const customData = systemSettings?.documentPolicies?.[activePolicyKey];

    if (customData && customData.sections && customData.sections.length > 0) {
      return customData;
    }
    return defaultData || MASTER_DOCUMENTATION_POLICIES.aboutUs;
  }, [activePolicyKey, systemSettings]);

  const handleCopy = () => {
    const text = `${currentPolicy.title}\nLast Updated: ${currentPolicy.lastUpdated}\n\n` +
      (currentPolicy.sections || []).map(s => `${s.heading}\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    addToast('Policy text copied to clipboard', 'success');
  };

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto text-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            <span>Corporate Governance &bull; Legal Compliance</span>
            <span>&bull;</span>
            <span className="text-primary font-bold">Standard Operations Hub</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight text-on-surface mt-1">
            Documentation &amp; Policy Center
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Authoritative operating guidelines, partner agreements, customer quotation policies, and regulatory disclaimers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface font-bold text-xs border border-surface-container-high transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">content_copy</span>
            <span>Copy Section</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-white font-bold text-xs hover:bg-primary transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Documentation Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Policy Directory Nav */}
        <div className="lg:col-span-4 space-y-2">
          <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high mb-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search policies..."
              className="w-full text-xs p-2 rounded-lg bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1 bg-surface-container-lowest p-2 rounded-2xl border border-surface-container-high shadow-xs">
            {policyMenu
              .filter(item => !searchTerm.trim() || item.label.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(item => {
                const isActive = activePolicyKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActivePolicyKey(item.key)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                      isActive
                        ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold shadow-xs'
                        : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
          </div>

          {/* Quick Notice */}
          <div className="p-4 rounded-xl bg-surface-container-low/60 border border-surface-container-high text-xs text-secondary space-y-1">
            <span className="font-bold text-on-surface block font-['Space_Grotesk']">Need Regulatory Liaison?</span>
            <p className="leading-relaxed">
              For corporate agreements, bank solar loan tie-ups, or institutional tender queries, contact{' '}
              <a href="mailto:legal@sunvine.in" className="text-primary font-medium hover:underline">
                legal@sunvine.in
              </a>.
            </p>
          </div>
        </div>

        {/* Right Side: Active Policy Reader */}
        <div className="lg:col-span-8 p-6 sm:p-8 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-6">
          {/* Policy Title Banner */}
          <div className="pb-4 border-b border-surface-container-high">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-semibold text-secondary uppercase">
                Section Ref: {activePolicyKey.toUpperCase()}
              </span>
              <span className="text-[11px] font-mono text-secondary">
                Last Reviewed: {currentPolicy.lastUpdated || 'September 2026'}
              </span>
            </div>
            <h2 className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-on-surface mt-2">
              {currentPolicy.title}
            </h2>
          </div>

          {/* Policy Sections */}
          <div className="space-y-6 text-xs sm:text-sm">
            {(currentPolicy.sections || []).map((sec, idx) => (
              <div key={idx} className="space-y-2 p-4 rounded-xl bg-surface-container-low/40 border border-surface-container-high/60">
                <h3 className="font-['Space_Grotesk'] font-bold text-base text-on-surface flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                  <span>{sec.heading}</span>
                </h3>
                <p className="text-secondary leading-relaxed whitespace-pre-line pl-3.5">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>

          {/* Compliance Footer Note */}
          <div className="pt-6 border-t border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-secondary">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
              <span>Enforced across all 550+ Gujarat Authorized Dealers &bull; DISCOM Aligned</span>
            </div>
            <span className="font-mono text-[11px]">Sunvine Renewable Energy &bull; Reg. No. GUJ/SOL/2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
