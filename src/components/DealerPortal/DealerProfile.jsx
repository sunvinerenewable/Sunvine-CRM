import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { APP_VERSION } from '../../config/version';

export default function DealerProfile() {
  const { currentDealer, updateDealerProfile } = useApp();
  const fileInputRef = useRef(null);

  const [dealerName, setDealerName] = useState(currentDealer?.contactPerson || 'Rajesh Kumar');
  const [companyName, setCompanyName] = useState(currentDealer?.firmName || 'Surya Solar Tech Private Limited');
  const [email, setEmail] = useState(currentDealer?.email || 'rajesh@suryasolartech.in');
  const [gstin, setGstin] = useState(currentDealer?.gstin || '24AFPFS7402A1Z7');
  const [address, setAddress] = useState(currentDealer?.address || 'Shop No. 12, GIDC Industrial Estate, Metoda, Rajkot, Gujarat - 360021');

  const [toast, setToast] = useState({ message: '', type: 'success' });

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: 'success' });
    }, 3500);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (updateDealerProfile) {
      updateDealerProfile({
        contactPerson: dealerName,
        firmName: companyName,
        email: email,
        gstin: gstin,
        address: address,
      });
    }
    triggerToast('Profile details updated successfully', 'success');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerToast('Please select a valid image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      triggerToast('Image size should be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (updateDealerProfile) {
        updateDealerProfile({ avatar: base64 });
      }
      triggerToast('Profile photo updated successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* Toast Notification */}
      <div
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 left-4 sm:left-auto max-w-sm z-50 transition-all duration-300 pointer-events-none flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl font-label-sm ${
          toast.type === 'error'
            ? 'bg-neutral-900 border border-red-500/50 text-white'
            : 'bg-on-secondary-fixed text-on-secondary'
        } ${
          toast.message ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            toast.type === 'error' ? 'text-red-400' : 'text-primary-fixed'
          }`}
        >
          {toast.type === 'error' ? 'cancel' : 'check_circle'}
        </span>
        <span className="break-words">{toast.message}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-secondary font-label-xs uppercase tracking-wider mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">verified_user</span>
            <span className="truncate">Account • Partner Credentials</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">My Profile</h1>
          <p className="text-xs sm:text-sm text-secondary mt-1 leading-relaxed">
            Manage your dealer credentials, business information, and account security.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0 mt-1 lg:mt-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-container/15 text-primary text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></span>
            <span className="whitespace-nowrap">Active Node • MH-WEST-04</span>
          </span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('sunvine_trigger_update_modal'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/15 text-secondary hover:text-primary text-xs font-semibold transition-colors cursor-pointer border border-surface-container-high min-h-[36px]"
            title="Check for PWA updates & changelog"
          >
            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">system_update</span>
            <span className="whitespace-nowrap">App v{APP_VERSION} • Check Updates</span>
          </button>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="relative w-full rounded-xl bg-surface-container-lowest shadow-sm p-4 sm:p-6 mb-6 overflow-hidden border border-surface-container-high">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-container/10 blur-3xl pointer-events-none"></div>
        <div className="absolute right-32 -bottom-20 w-64 h-64 rounded-full bg-tertiary-container/15 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full xl:w-auto min-w-0 flex-1">
            <div className="relative group shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                id="profile-avatar-upload"
              />
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-container-high shadow-md border-2 border-surface-container-lowest shrink-0">
                <img
                  alt={`${dealerName} Profile`}
                  className="w-full h-full object-cover"
                  src={currentDealer?.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPrXHZs-qW_IfxFB32q6OMBxh9-Q8lbGsGBMHtdkNUgY_4yuNIKjzl9IouO3S3aNB09wnjzip9MP60dQxzL4kQPmGopeAc3FhmzSe-rn5i-NJoa8LROkq6xtArBvBH1gOf32o8gNlXRFqVCbs_ran3kYrMxI68PMiaTNELo-PNmGam_oiuZjvHaBAalOT1KVsAA0nMIY8TkaF5V5g5bstz4lf60C_guBjH_ZJgQWwByqwwd7bZd8y'}
                />
              </div>
              <button
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-on-secondary-fixed text-on-secondary flex items-center justify-center shadow-md hover:bg-primary transition-all cursor-pointer group-hover:scale-105 active:scale-95 z-20 touch-manipulation"
                title="Change Avatar (Upload Photo)"
                type="button"
                onClick={handleAvatarClick}
                aria-label="Upload profile avatar"
              >
                <span className="material-symbols-outlined text-[15px]">photo_camera</span>
              </button>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-bold text-on-surface">{dealerName}</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary text-xs font-semibold whitespace-nowrap">
                  <span className="material-symbols-outlined text-[14px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span>Authorized Tier-1 EPC Dealer</span>
                </span>
              </div>
              <div className="text-sm sm:text-base text-secondary font-medium">{companyName}</div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-secondary text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">badge</span>
                  <span className="text-on-surface font-semibold truncate">SV-DLR-GJ-0842</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">pin_drop</span>
                  <span>Territory: <strong className="text-on-surface font-semibold">Rajkot &amp; Saurashtra Circle (PGVCL)</strong></span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0">bolt</span>
                  <span>Allocated Quota: <strong className="text-on-surface font-semibold">1,200 kW / Qtr</strong></span>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full xl:w-auto flex flex-row xl:flex-col items-center xl:items-end justify-between xl:justify-center border-t xl:border-t-0 border-surface-container-high/60 pt-3 xl:pt-0 mt-2 xl:mt-0 gap-3 shrink-0">
            <div className="text-left xl:text-right">
              <span className="text-[11px] text-secondary uppercase tracking-wider block font-semibold">Channel Standing</span>
              <span className="text-base sm:text-lg text-primary font-bold">Top 5% Partner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-surface-container-low text-secondary text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">military_tech</span>
                <span>Gold Tier EPC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form and Side Info Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-7 flex flex-col gap-6 min-w-0">
          {/* Personal & Business Details */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 sm:p-6 border border-surface-container-high">
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-[22px] shrink-0">corporate_fare</span>
                <h2 className="text-lg sm:text-xl font-bold text-on-surface">Personal &amp; Business Details</h2>
              </div>
            </div>
            <form className="flex flex-col gap-space-md" onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="font-label-sm text-on-surface" htmlFor="dealer-name">Dealer / Contact Name</label>
                  <div className="relative">
                    <input
                      className="w-full h-11 sm:h-10 px-3 bg-surface-container-low rounded-lg font-body-md text-base sm:text-body-md text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                      id="dealer-name"
                      type="text"
                      value={dealerName}
                      onChange={(e) => setDealerName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="font-label-sm text-on-surface flex items-center justify-between" htmlFor="mobile-number">
                    <span>Mobile Number</span>
                    <span className="text-secondary font-label-xs flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px] shrink-0">lock</span>
                      Locked
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 sm:h-10 px-3 pl-8 bg-surface-container-high/60 rounded-lg font-body-md text-base sm:text-body-md text-secondary cursor-not-allowed outline-none"
                      id="mobile-number"
                      readOnly
                      type="text"
                      value={currentDealer?.mobile || "+91 98765 43210"}
                    />
                    <span className="material-symbols-outlined text-[16px] text-secondary absolute left-2.5 top-3.5 sm:top-3">lock</span>
                  </div>
                  <span className="font-label-xs text-secondary text-[11px] leading-tight block break-words mt-0.5">(Registered login number – contact Admin to update)</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="font-label-sm text-on-surface" htmlFor="company-name">Company / Shop Name</label>
                  <input
                    className="w-full h-11 sm:h-10 px-3 bg-surface-container-low rounded-lg font-body-md text-base sm:text-body-md text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label className="font-label-sm text-on-surface" htmlFor="gstin">GSTIN / Business Registration</label>
                  <div className="relative">
                    <input
                      className="w-full h-11 sm:h-10 px-3 pr-10 uppercase bg-surface-container-low rounded-lg font-body-md text-base sm:text-body-md text-on-surface font-mono focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                      id="gstin"
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    />
                    <span className="material-symbols-outlined text-primary text-[18px] absolute right-3 top-3 sm:top-2.5 shrink-0" title="GST Verified">check_circle</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="font-label-sm text-on-surface" htmlFor="email-address">Email Address</label>
                <div className="relative">
                  <input
                    className="w-full h-11 sm:h-10 px-3 pl-9 bg-surface-container-low rounded-lg font-body-md text-base sm:text-body-md text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all"
                    id="email-address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <span className="material-symbols-outlined text-[18px] text-secondary absolute left-2.5 top-3 sm:top-2.5 shrink-0">mail</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="font-label-sm text-on-surface" htmlFor="office-address">Registered Shop / Office Address</label>
                <textarea
                  className="w-full p-3 bg-surface-container-low rounded-lg font-body-md text-base sm:text-body-md text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container outline-none transition-all resize-none min-h-[80px]"
                  id="office-address"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-space-sm mt-space-xs">
                <div className="flex items-center gap-2 text-secondary font-label-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0">info</span>
                  <span className="break-words">Appears on generated PDF proposals</span>
                </div>
                <button
                  className="h-11 sm:h-10 px-space-lg bg-primary-container hover:bg-primary text-on-primary rounded-lg font-label-md transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0"
                  type="submit"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Certifications & Licenses */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 sm:p-6 border border-surface-container-high">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">verified</span>
                <h3 className="text-base sm:text-lg font-bold text-on-secondary-fixed">Dealer Certifications &amp; Licenses</h3>
              </div>
              <span className="text-primary text-xs font-semibold whitespace-nowrap">All Active</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col justify-between min-w-0">
                <div className="min-w-0">
                  <span className="font-label-xs text-secondary block truncate">MNRE Channel Registration</span>
                  <span className="font-label-sm text-on-surface block mt-1 break-words font-semibold">MNRE/2023/MH/4412</span>
                </div>
                <span className="font-label-xs text-primary mt-2 flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-[14px] shrink-0">check</span>
                  <span className="truncate">Valid till Dec 2026</span>
                </span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col justify-between min-w-0">
                <div className="min-w-0">
                  <span className="font-label-xs text-secondary block truncate">GEDA / PGVCL Grid-Tie Empanelment</span>
                  <span className="font-label-sm text-on-surface block mt-1 break-words font-semibold">Class-A Rooftop</span>
                </div>
                <span className="font-label-xs text-primary mt-2 flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-[14px] shrink-0">check</span>
                  <span className="truncate">Active</span>
                </span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col justify-between min-w-0">
                <div className="min-w-0">
                  <span className="font-label-xs text-secondary block truncate">Sunvine Master Installer</span>
                  <span className="font-label-sm text-on-surface block mt-1 break-words font-semibold">Inverter &amp; Microgrid</span>
                </div>
                <span className="font-label-xs text-primary mt-2 flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-[14px] shrink-0">verified</span>
                  <span className="truncate">Certified</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-5 flex flex-col gap-6 min-w-0">
          {/* Partner Support */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 sm:p-6 border border-surface-container-high relative overflow-hidden">
            <div className="w-1.5 h-full bg-primary absolute left-0 top-0"></div>
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-tertiary-container/30 text-on-tertiary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">contact_support</span>
              </div>
              <div className="flex flex-col w-full min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-on-surface">Sunvine Official Dealer Support</h3>
                <p className="text-xs sm:text-sm text-secondary mt-1">Direct priority channel for equipment dispatch, regional DISCOM approvals &amp; warranty assistance.</p>
                <div className="mt-space-md flex flex-col gap-2.5 font-body-sm min-w-0">
                  <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-x-2 gap-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-secondary shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">support_agent</span>
                      <span>Official Helpline:</span>
                    </div>
                    <a className="text-on-surface font-bold hover:text-primary transition-colors tracking-wide break-all" href="tel:+918000050580">
                      +91 80000 50580
                    </a>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-x-2 gap-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-secondary shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">mail</span>
                      <span>Support Email:</span>
                    </div>
                    <a className="text-on-surface font-semibold hover:text-primary transition-colors break-all" href="mailto:info@sunvinerenewable.com">
                      info@sunvinerenewable.com
                    </a>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-x-2 gap-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-secondary shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">mark_email_read</span>
                      <span>Alternate Email:</span>
                    </div>
                    <a className="text-on-surface font-semibold hover:text-primary transition-colors break-all" href="mailto:sunvinerenewable@gmail.com">
                      sunvinerenewable@gmail.com
                    </a>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-surface-container-high/60 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">apartment</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-secondary text-xs block">Corporate Office &amp; Works:</span>
                      <div className="text-on-surface text-xs font-semibold mt-0.5 leading-snug break-words">
                        Plot No. G-705, Lodhika GIDC, Metoda, Rajkot, Gujarat - 360021
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-space-md pt-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 text-secondary font-label-xs border-t border-surface-container-high/60 min-w-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-primary-container shrink-0"></span>
                    <span className="break-words">Central Operations: Sunvine HQ, Rajkot, Gujarat</span>
                  </span>
                  <span className="font-semibold text-primary whitespace-nowrap shrink-0">Mon–Sat • 9 AM – 7 PM IST</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
