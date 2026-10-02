import React from 'react';
import { useApp } from '../../context/AppContext';

export default function ComingSoonPlaceholder({
  title = 'Feature Under Construction',
  subtitle = 'Coming Soon in Version 2.3',
  icon = 'construction',
  description = 'We are actively developing this next-generation module to empower Sunvine dealers and sales executives with automated intelligence. This feature will be unlocked in the upcoming release.',
  backTab
}) {
  const { role, setActiveTab, currentStaff } = useApp();

  const handleBack = () => {
    if (backTab) {
      setActiveTab(backTab);
    } else if (role === 'admin') {
      setActiveTab('admin_dashboard');
    } else if (role === 'staff') {
      const isVerificationStaff = Boolean(
        currentStaff?.role?.toLowerCase().includes('verification') ||
        currentStaff?.department === 'verification' ||
        currentStaff?.id === 'STF-003'
      );
      setActiveTab(isVerificationStaff ? 'verification_desk' : 'staff_dashboard');
    } else {
      setActiveTab('dashboard');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-16 px-4 flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="w-full bg-surface rounded-2xl border border-surface-container-high shadow-lg p-8 sm:p-12 text-center flex flex-col items-center relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
          <span className="material-symbols-outlined text-[44px]">{icon}</span>
        </div>

        {/* Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{subtitle}</span>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
          {title}
        </h1>

        {/* Description */}
        <p className="text-secondary text-sm sm:text-base max-w-lg mt-3 leading-relaxed">
          {description}
        </p>

        {/* Expected Highlights Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-8 text-left">
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">check_circle</span>
            <span className="text-xs font-semibold text-on-surface">Integrated Telemetry Engine</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">check_circle</span>
            <span className="text-xs font-semibold text-on-surface">Gujarat DISCOM Geo-Fencing</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">check_circle</span>
            <span className="text-xs font-semibold text-on-surface">Direct Document Submissions</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">check_circle</span>
            <span className="text-xs font-semibold text-on-surface">Enterprise Lead Auto-Dispatch</span>
          </div>
        </div>

        {/* Navigation Action */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
