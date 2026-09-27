import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from './Toast';

export default function DocumentationHub() {
  const { systemSettings, role } = useApp();
  const { addToast } = useToast();

  const [activePolicyKey, setActivePolicyKey] = useState('aboutUs');
  const [searchTerm, setSearchTerm] = useState('');

  const policies = systemSettings?.documentPolicies || {};

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

  const currentPolicy = policies[activePolicyKey] || {
    title: 'Sunvine Renewable Energy System Policy',
    lastUpdated: 'March 2026',
    sections: [
      {
        heading: 'Policy Overview',
        content: 'Official enterprise documentation for Sunvine Renewable Energy Gujarat Operations.'
      }
    ]
  };

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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs hover:bg-primary transition-colors cursor-pointer min-h-[44px]"
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
                        ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold'
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
            <span className="font-bold text-on-surface block font-['Space_Grotesk']">Need Legal Assistance?</span>
            <p className="leading-relaxed">
              For custom commercial agreements, tender submissions, or institutional subsidy queries, contact{' '}
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
                Last Reviewed: {currentPolicy.lastUpdated || 'March 2026'}
              </span>
            </div>
            <h2 className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-on-surface mt-2">
              {currentPolicy.title}
            </h2>
          </div>

          {/* Policy Sections */}
          <div className="space-y-6 text-xs sm:text-sm">
            {(currentPolicy.sections || []).map((sec, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="font-['Space_Grotesk'] font-bold text-base text-on-surface">
                  {sec.heading}
                </h3>
                <p className="text-secondary leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>

          {/* Compliance Footer Note */}
          <div className="pt-6 border-t border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-secondary">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
              <span>Enforced across all 550+ Gujarat Authorized Dealers</span>
            </div>
            <span className="font-mono text-[11px]">Sunvine Renewable Energy &bull; Reg. No. GUJ/SOL/2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
