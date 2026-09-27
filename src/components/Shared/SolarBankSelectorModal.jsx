import React, { useState } from 'react';
import {
  SOLAR_BANK_CATEGORIES,
  SOLAR_LOAN_PROVIDERS,
} from '../../data/solarBanksData';

export default function SolarBankSelectorModal({ isOpen, onClose, onSelectBank, selectedBankName }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredBanks = SOLAR_LOAN_PROVIDERS.filter((bank) => {
    const matchCat = activeCategory === 'all' || bank.category === activeCategory;
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      bank.name.toLowerCase().includes(term) ||
      bank.shortName.toLowerCase().includes(term) ||
      bank.categoryLabel.toLowerCase().includes(term) ||
      bank.processingType.toLowerCase().includes(term) ||
      (bank.maxLoanAmount || '').toLowerCase().includes(term);

    return matchCat && matchSearch;
  });

  const categoryBadges = {
    psu: 'bg-blue-50 text-blue-800 border-blue-200',
    nbfc: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    private: 'bg-purple-50 text-purple-800 border-purple-200',
    gramin: 'bg-amber-50 text-amber-800 border-amber-200',
    cooperative: 'bg-teal-50 text-teal-800 border-teal-200',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-on-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-surface-container-high bg-surface-container-low/40 flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[22px]">account_balance</span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Official Solar Financing Registry
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-on-surface">
              Select Solar Loan Provider &amp; Financing Partner
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Empanelled Nationalised Banks (Jan Samarth / PM Surya Ghar), RBI Green FinTechs, Private Banks, Regional Gramin &amp; Co-operative Banks.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="p-4 border-b border-surface-container-high space-y-3 bg-surface shrink-0">
          {/* Search Box */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by bank name (e.g. SBI, BOB, Ecofy, Solfin, Bajaj, Saurashtra Gramin, Kalupur)..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-surface-container-lowest border border-surface-container-high rounded-xl outline-none focus:border-primary text-on-surface"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-secondary hover:text-on-surface text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {SOLAR_BANK_CATEGORIES.map((cat) => {
              const count = cat.id === 'all'
                ? SOLAR_LOAN_PROVIDERS.length
                : SOLAR_LOAN_PROVIDERS.filter((b) => b.category === cat.id).length;

              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Banks Grid Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-surface-container-lowest">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredBanks.map((bank) => {
              const isCurrentlySelected = selectedBankName === bank.name || selectedBankName === bank.shortName;

              return (
                <div
                  key={bank.id}
                  onClick={() => {
                    onSelectBank(bank.name);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                    isCurrentlySelected
                      ? 'bg-primary-container/10 border-primary ring-1 ring-primary'
                      : 'bg-surface border-surface-container-high hover:border-primary/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${categoryBadges[bank.category] || 'bg-slate-100'}`}>
                          {bank.categoryLabel}
                        </span>
                        <h4 className="font-bold text-sm text-on-surface mt-1.5 leading-snug">
                          {bank.name}
                        </h4>
                      </div>
                      {isCurrentlySelected && (
                        <span className="material-symbols-outlined text-primary text-[20px] shrink-0" title="Selected">
                          check_circle
                        </span>
                      )}
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-surface-container-low">
                        <span className="text-[10px] text-secondary block font-medium">Interest Rate</span>
                        <span className="font-bold text-emerald-700 font-mono text-[11px] truncate block">
                          {bank.interestRate}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-low">
                        <span className="text-[10px] text-secondary block font-medium">Max Repayment Tenure</span>
                        <span className="font-semibold text-on-surface text-[11px] truncate block">
                          {bank.maxTenure}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="text-[11px] space-y-1 text-secondary pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
                        <span>{bank.collateralFree ? 'Collateral-Free Solar Loan' : 'Asset-Backed'}</span>
                        <span className="text-secondary/60">&bull;</span>
                        <span className="truncate">{bank.maxLoanAmount}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-primary">bolt</span>
                        <span className="truncate">{bank.processingType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="mt-3 pt-2.5 border-t border-surface-container-high/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-secondary">Portal: {bank.portal}</span>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isCurrentlySelected
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-low hover:bg-primary hover:text-white text-on-surface'
                      }`}
                    >
                      {isCurrentlySelected ? 'Selected' : 'Select Provider'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBanks.length === 0 && (
            <div className="py-12 text-center text-secondary">
              <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">account_balance</span>
              <p className="text-sm font-semibold">No solar loan providers matched your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('all');
                }}
                className="mt-2 text-xs text-primary font-bold hover:underline"
              >
                Reset Search &amp; Filters
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-surface-container-high bg-surface-container-low/40 flex items-center justify-between text-xs text-secondary shrink-0">
          <span>
            Total Empanelled Lenders: <strong>{SOLAR_LOAN_PROVIDERS.length}</strong> official institutions
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
