import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function LeadGenerationComingSoon() {
  const { role, setActiveTab } = useApp();
  const [subscribed, setSubscribed] = useState(false);
  const [selectedDiscom, setSelectedDiscom] = useState('ALL');

  const upcomingFeatures = [
    {
      icon: 'satellite_alt',
      title: 'Satellite Solar AI Prospecting',
      desc: 'Automatic detection of high-potential Gujarat residential rooftops and commercial shed footprints with high irradiance.',
      tag: 'AI Vision Engine'
    },
    {
      icon: 'alt_route',
      title: 'DISCOM Circle Smart Routing',
      desc: 'Instant lead assignment based on customer electricity bill circle (UGVCL, DGVCL, MGVCL, PGVCL) directly to local staff & dealers.',
      tag: 'Auto-Dispatch'
    },
    {
      icon: 'filter_alt',
      title: 'Credit & Feasibility Pre-Screening',
      desc: 'Automatic sanctioned load vs required kW checking and pre-qualification for PM Surya Ghar subsidy eligibility.',
      tag: 'Pre-Qualified'
    },
    {
      icon: 'send_to_mobile',
      title: 'Direct Quotation Fast-Track',
      desc: 'Single-click generation of branded 4-page Sunvine proposal dispatched directly to customer WhatsApp.',
      tag: 'Instant Proposal'
    }
  ];

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1528] via-[#0F1F38] to-[#122A4D] rounded-2xl p-6 sm:p-8 text-white shadow-md border border-white/10">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#6CBF3D]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6CBF3D]/20 text-[#7EDE45] border border-[#6CBF3D]/30 text-xs font-semibold uppercase tracking-wider font-mono">
              <span className="w-2 h-2 rounded-full bg-[#7EDE45] animate-ping" />
              Next-Gen Module &bull; Version 2.4 Preview
            </div>
            <h1 className="font-['Space_Grotesk'] text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              Sunvine Solar Lead Generation &amp; Distribution Engine
            </h1>
            <p className="text-white/75 text-sm sm:text-base leading-relaxed">
              An automated customer acquisition engine connecting Gujarat homeowners and C&amp;I factory owners directly with verified Sunvine Authorized Dealers and Regional Staff Executives.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {role === 'staff' && (
              <button
                type="button"
                onClick={() => setActiveTab('staff_map')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all border border-white/20 cursor-pointer min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[20px] text-[#7EDE45]">radar</span>
                <span>Open Live Radar Map</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSubscribed(true)}
              disabled={subscribed}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-md cursor-pointer min-h-[44px] ${
                subscribed
                  ? 'bg-emerald-700 text-white cursor-default'
                  : 'bg-[#6CBF3D] hover:bg-[#5EAA34] text-[#071302]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {subscribed ? 'check_circle' : 'notifications_active'}
              </span>
              <span>{subscribed ? 'Priority Access Reserved' : 'Reserve Priority Access'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Role Specific Experience Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-5 rounded-xl border transition-all ${
          role === 'admin'
            ? 'bg-primary-container/10 border-primary shadow-sm'
            : 'bg-surface-container-lowest border-surface-container-high'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[24px]">admin_panel_settings</span>
            <h3 className="font-['Space_Grotesk'] font-bold text-on-surface text-base">Super Admin Console</h3>
          </div>
          <p className="text-secondary text-xs leading-relaxed">
            Configure C&amp;I and residential lead distribution rules, manage lead cost allocations, cap weekly quotas per dealer tier, and monitor real-time conversion velocity.
          </p>
        </div>

        <div className={`p-5 rounded-xl border transition-all ${
          role === 'staff'
            ? 'bg-primary-container/10 border-primary shadow-sm'
            : 'bg-surface-container-lowest border-surface-container-high'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[24px]">badge</span>
            <h3 className="font-['Space_Grotesk'] font-bold text-on-surface text-base">Staff Zone Routing</h3>
          </div>
          <p className="text-secondary text-xs leading-relaxed">
            Field executives receive pre-qualified customer leads mapped to their specific DISCOM jurisdiction with geocoded roof coordinates and monthly consumption data.
          </p>
        </div>

        <div className={`p-5 rounded-xl border transition-all ${
          role === 'dealer'
            ? 'bg-primary-container/10 border-primary shadow-sm'
            : 'bg-surface-container-lowest border-surface-container-high'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[24px]">storefront</span>
            <h3 className="font-['Space_Grotesk'] font-bold text-on-surface text-base">Dealer Partner Inquiries</h3>
          </div>
          <p className="text-secondary text-xs leading-relaxed">
            Receive exclusive customer inquiries in your registered pin code. Convert inquiries to Sunvine quotations with 1-click customer file onboarding.
          </p>
        </div>
      </div>

      {/* 3. Feature Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {upcomingFeatures.map((feat, idx) => (
          <div
            key={idx}
            className="flex items-start gap-4 p-5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 transition-colors shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-[26px]">{feat.icon}</span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-['Space_Grotesk'] font-bold text-on-surface text-sm sm:text-base">
                  {feat.title}
                </h4>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-container-low text-secondary">
                  {feat.tag}
                </span>
              </div>
              <p className="text-secondary text-xs sm:text-sm leading-relaxed">
                {feat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Timeline & Pilot Program Info */}
      <div className="p-6 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[22px]">rocket_launch</span>
            <h3 className="font-['Space_Grotesk'] font-bold text-on-surface text-base">
              Rollout Roadmap &amp; Regional Beta Schedule
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-secondary">
            Gujarat Target: Q3 2026
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-surface-container-high">
            <span className="text-[11px] font-mono text-secondary font-semibold uppercase">Phase 1 &bull; Active</span>
            <p className="font-['Space_Grotesk'] font-bold text-on-surface text-sm mt-1">Satellite Roof Feasibility</p>
            <p className="text-secondary text-xs mt-0.5">2D/3D Roof Canvas and Sun Hours simulation live.</p>
          </div>
          <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-surface-container-high">
            <span className="text-[11px] font-mono text-secondary font-semibold uppercase">Phase 2 &bull; Active</span>
            <p className="font-['Space_Grotesk'] font-bold text-on-surface text-sm mt-1">Field Radar AI</p>
            <p className="text-secondary text-xs mt-0.5">Field Executive nearby rooftop prospecting tool live.</p>
          </div>
          <div className="p-3.5 rounded-lg bg-primary-container/10 border border-primary/30">
            <span className="text-[11px] font-mono text-primary font-semibold uppercase">Phase 3 &bull; In Dev</span>
            <p className="font-['Space_Grotesk'] font-bold text-on-surface text-sm mt-1">Inquiry Auto-Dispatch</p>
            <p className="text-secondary text-xs mt-0.5">Connecting website consumer inquiries directly to dealers.</p>
          </div>
          <div className="p-3.5 rounded-lg bg-surface-container-low/60 border border-surface-container-high">
            <span className="text-[11px] font-mono text-secondary font-semibold uppercase">Phase 4 &bull; Upcoming</span>
            <p className="font-['Space_Grotesk'] font-bold text-on-surface text-sm mt-1">DISCOM Bridge</p>
            <p className="text-secondary text-xs mt-0.5">Automatic consumer number verification and load sync.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
