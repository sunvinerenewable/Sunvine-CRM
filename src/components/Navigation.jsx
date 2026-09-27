import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import NotificationPanel from './Shared/NotificationPanel';

export default function Navigation() {
  const {
    role,
    activeTab,
    setActiveTab,
    currentDealer,
    currentStaff,
    logout,
    unreadNotificationsCount,
    clearEditingQuotation,
    clearActiveDraftQuote,
    notificationsOpen,
    setNotificationsOpen
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const desktopNotificationRef = useRef(null);
  const mobileNotificationRef = useRef(null);

  const handleMenuClick = (tabId) => {
    if (tabId === 'create_quote' || tabId === 'dashboard' || tabId === 'my_quotes') {
      if (clearEditingQuotation) clearEditingQuotation();
      if (tabId === 'create_quote' && clearActiveDraftQuote) clearActiveDraftQuote();
    }
    setActiveTab(tabId);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [dropdownOpen]);

  const dealerMenu = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: 'home' },
    { id: 'create_quote', label: 'New Quotation', mobileLabel: 'New Quote', icon: 'note_add' },
    { id: 'my_quotes', label: 'My Quotations', mobileLabel: 'My Quotes', icon: 'folder_open' },
    { id: 'dealer_performance', label: 'My Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'lead_generation', label: 'Lead Generation', mobileLabel: 'Leads', icon: 'radar' },
    { id: 'docs', label: 'Agreements & Docs', mobileLabel: 'Docs', icon: 'description' },
    { id: 'dealer_settings', label: 'Settings', mobileLabel: 'Settings', icon: 'settings' },
  ];

  const adminMenu = [
    { id: 'admin_dashboard', label: 'Executive Overview', mobileLabel: 'Overview', icon: 'dashboard' },
    { id: 'admin_performance', label: 'Business Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'dealers_mgmt', label: 'Dealer Partners', mobileLabel: 'Dealers', icon: 'group' },
    { id: 'staff_mgmt', label: 'Sales Team & Files', mobileLabel: 'Sales Team', icon: 'badge' },
    { id: 'admin_reports', label: 'Reports & Export', mobileLabel: 'Reports', icon: 'download' },
    { id: 'admin_audit', label: 'Audit Logs Trail', mobileLabel: 'Audit', icon: 'receipt_long' },
    { id: 'lead_generation', label: 'Lead Generation', mobileLabel: 'Leads', icon: 'radar' },
    { id: 'create_quote', label: 'New Direct Quote', mobileLabel: 'New Quote', icon: 'note_add' },
    { id: 'pricing_master', label: 'Pricing & Presets', mobileLabel: 'Pricing', icon: 'tune' },
    { id: 'hardware_master', label: 'Hardware Catalog', mobileLabel: 'Hardware', icon: 'memory' },
    { id: 'all_quotes', label: 'All Quotations', mobileLabel: 'All Quotes', icon: 'inventory_2' },
    { id: 'admin_docs', label: 'Documentation Hub', mobileLabel: 'Docs', icon: 'description' },
    { id: 'admin_settings', label: 'Master Governance', mobileLabel: 'Settings', icon: 'settings' },
  ];

  const isVerificationStaff = Boolean(
    currentStaff?.role?.toLowerCase().includes('verification') ||
    currentStaff?.department === 'verification' ||
    currentStaff?.id === 'STF-003'
  );

  const verificationStaffMenu = [
    { id: 'verification_desk', label: 'Verification Desk', mobileLabel: 'Verification', icon: 'verified_user' },
    { id: 'staff_files', label: 'Customer Files', mobileLabel: 'Files', icon: 'folder' },
    { id: 'docs', label: 'Policies & Docs', mobileLabel: 'Docs', icon: 'description' },
  ];

  const salesStaffMenu = [
    { id: 'staff_dashboard', label: 'My Dashboard', mobileLabel: 'Dashboard', icon: 'dashboard' },
    { id: 'staff_files', label: 'My Customer Files', mobileLabel: 'My Files', icon: 'folder' },
    { id: 'staff_performance', label: 'My Performance', mobileLabel: 'Performance', icon: 'monitoring' },
    { id: 'staff_new_lead', label: 'New Customer Lead', mobileLabel: 'New Lead', icon: 'person_add' },
    { id: 'staff_map', label: 'Nearby Radar (AI)', mobileLabel: 'Radar Map', icon: 'radar' },
    { id: 'lead_generation', label: 'Lead Engine', mobileLabel: 'Leads', icon: 'hub' },
    { id: 'docs', label: 'Policies & Docs', mobileLabel: 'Docs', icon: 'description' },
  ];

  const staffMenu = isVerificationStaff ? verificationStaffMenu : salesStaffMenu;

  const menuItems = role === 'admin' ? adminMenu : role === 'staff' ? staffMenu : dealerMenu;

  return (
    <>
      {/* Desktop Sidebar (Exact Stitch Design) */}
      <aside className="no-print hidden md:flex fixed left-0 top-0 h-screen w-64 bg-on-secondary-fixed z-50 flex-col justify-between select-none">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header */}
          <div className="h-16 px-space-lg flex items-center gap-space-sm border-b border-white/10 shrink-0">
            <img
              alt="Sunvine Renewable Energy Logo"
              className="h-8 w-auto object-contain cursor-pointer"
              src="/sunvine_logo_white.png"
              onClick={() => setActiveTab(role === 'admin' ? 'admin_dashboard' : role === 'staff' ? (isVerificationStaff ? 'verification_desk' : 'staff_dashboard') : 'dashboard')}
            />
            <div className="flex flex-col">
              <span className="font-label-xs text-label-xs text-secondary-fixed-dim tracking-wider uppercase font-semibold">
                {role === 'admin' ? 'Portal' : role === 'staff' ? (isVerificationStaff ? 'Verification Desk' : 'Staff Portal') : 'Dealer Portal'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col mt-space-sm flex-1 overflow-y-auto scrollbar-hide py-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.id)}
                  className={`flex items-center gap-space-sm px-space-lg py-2.5 transition-colors text-left cursor-pointer ${isActive
                    ? 'border-l-4 border-primary-container bg-white/10 text-on-secondary font-label-md'
                    : 'text-secondary-fixed-dim hover:bg-white/5 hover:text-on-secondary font-body-md'
                    }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-xs truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

      </aside>

      {/* Desktop Top Header (Exact Stitch Design) */}
      <header className="no-print hidden md:flex fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-surface-container-high z-40 items-center justify-between px-3 sm:px-4 lg:px-6 xl:px-space-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        {/* Left Status Bar */}
        <div className="flex items-center gap-space-md min-w-0 shrink">
          <div className="flex items-center gap-space-xs text-secondary font-label-sm min-w-0">
            <span className="material-symbols-outlined text-[18px] shrink-0">solar_power</span>
            <span className="hidden xl:inline truncate">Dealer Operations</span>
            <span className="xl:hidden text-xs truncate">Sunvine Network</span>
          </div>
        </div>

        {/* Right Status / Profile Controls */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-space-lg shrink-0">
          {/* Notification Bell with Active Indicator */}
          <div className="relative" ref={desktopNotificationRef}>
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setDropdownOpen(false);
              }}
              className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                notificationsOpen
                  ? 'bg-primary-container/15 text-primary ring-2 ring-primary/20'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
              title="Notifications"
              aria-label="Toggle notifications panel"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-on-error rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs border-2 border-surface-container-lowest animate-in zoom-in duration-200">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-surface-container-high"></div>

          {/* Dealer Avatar & Dropdown Pill */}
          <div className="relative" ref={profileDropdownRef}>
            <div
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotificationsOpen(false);
              }}
              className={`flex items-center gap-2 sm:gap-space-sm cursor-pointer select-none px-2 py-1.5 rounded-xl transition-all duration-200 ${
                dropdownOpen
                  ? 'bg-surface-container-low ring-1 ring-primary/20'
                  : 'hover:bg-surface-container-lowest hover:shadow-xs'
              }`}
            >
              <img
                src={currentDealer?.avatar || '/dealer_avatar.jpg'}
                alt="Dealer Avatar"
                className="w-8 h-8 rounded-full object-cover shadow-xs border border-surface-container-high shrink-0 ring-1 ring-primary/30"
              />
              <div className="hidden sm:flex flex-col text-left max-w-[90px] md:max-w-[120px] lg:max-w-[180px] truncate">
                <span className="font-label-md text-label-md text-on-surface leading-tight truncate">
                  {role === 'admin'
                    ? 'Admin Desk'
                    : role === 'staff'
                    ? currentStaff?.name || 'Field Solar Executive'
                    : currentDealer?.firmName || 'Rajesh Solar Solutions'}
                </span>
                <span className="font-label-xs text-label-xs text-secondary leading-tight truncate">
                  {role === 'admin'
                    ? 'System Administrator'
                    : role === 'staff'
                    ? currentStaff?.role || 'Sales Representative'
                    : 'Authorized Dealer'}
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 transition-transform duration-200 ease-out ${
                  dropdownOpen ? 'rotate-180 text-primary' : 'rotate-0 text-secondary'
                }`}
              >
                keyboard_arrow_down
              </span>
            </div>

            {/* Quick Profile Dropdown with Smooth Animation */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest/95 backdrop-blur-xl rounded-2xl shadow-xl border border-surface-container-high/80 p-1.5 z-50 animate-dropdown-enter ring-1 ring-black/5">
                <div className="px-3.5 py-2.5 mb-1 border-b border-surface-container-high/60 bg-surface-container-low/40 rounded-xl">
                  <p className="font-label-md text-on-surface text-xs font-bold truncate">
                    {role === 'admin' ? 'System Admin' : currentDealer?.contactPerson || 'Authorized Partner'}
                  </p>
                  <p className="font-body-sm text-secondary text-[11px] truncate">
                    {role === 'admin' ? 'admin@sunvine.in' : currentDealer?.email || 'dealer@sunvine.in'}
                  </p>
                </div>

                <div className="space-y-0.5">
                  {/* Account Settings Option for both Dealer & Admin */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(role === 'admin' ? 'admin_settings' : 'dealer_settings');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-on-surface hover:bg-primary/10 hover:text-primary active:scale-[0.98] cursor-pointer transition-all duration-150"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    <span>{role === 'admin' ? 'Governance Settings' : 'Account Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/20 active:scale-[0.98] cursor-pointer transition-all duration-150"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================
          MOBILE TOP BAR: Exact Stitch Design (26_78314a1fb43e40518984de1bee26f24b_3__Dealer_Dashboard__Mobile_.html)
          ======================================================== */}
      <header className="no-print fixed top-0 left-0 right-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high md:hidden h-16 px-3.5 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 min-w-0">
          <img
            alt="Brand logo"
            className="h-7 sm:h-8 w-auto object-contain cursor-pointer shrink-0"
            src="/sunvine_logo_transparent.png"
            onClick={() => setActiveTab(role === 'admin' ? 'admin_dashboard' : 'dashboard')}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-sm font-bold text-on-surface leading-tight tracking-tight truncate">
              Sunvine
            </span>
            <span className="font-label-xs text-[10px] text-secondary leading-tight tracking-wider uppercase font-semibold truncate">
              {role === 'admin' ? 'Admin Console' : 'Dealer Portal'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Notification Bell */}
          <div className="relative" ref={mobileNotificationRef}>
            <button
              aria-label="Notifications"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative cursor-pointer ${
                notificationsOpen
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-secondary hover:bg-surface-container-high'
              }`}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-error text-on-error rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs border border-surface">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              ) : null}
            </button>
          </div>

          <div
            onClick={() => setActiveTab(role === 'admin' ? 'admin_settings' : 'dealer_settings')}
            className="relative flex items-center justify-center p-0.5 rounded-full ring-1 ring-primary/40 cursor-pointer"
          >
            <img
              alt="Profile"
              className="w-7 h-7 rounded-full object-cover"
              src={currentDealer?.avatar || '/dealer_avatar.jpg'}
            />
          </div>
          <button
            aria-label="Logout"
            className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-error transition-colors cursor-pointer"
            onClick={logout}
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </header>

      {/* Unified Single-Instance Notification Panel (Serves both Desktop Dropdown & Mobile Bottom Sheet) */}
      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        desktopTriggerRef={desktopNotificationRef}
        mobileTriggerRef={mobileNotificationRef}
      />

      {/* ========================================================
          MOBILE BOTTOM TAB BAR: Exact Stitch Design (26_78314a1fb43e40518984de1bee26f24b_3__Dealer_Dashboard__Mobile_.html)
          ======================================================== */}
      <nav className="no-print fixed bottom-0 left-0 right-0 w-full z-50 bg-surface/95 backdrop-blur-xl border-t border-surface-container-high shadow-[0_-2px_12px_rgba(0,0,0,0.05)] md:hidden pb-[max(0px,env(safe-area-inset-bottom))]">
        {/* Scrollable tab bar — supports up to 6 admin tabs without clipping (SR-17) */}
        <div className="flex items-center h-16 px-1 w-full overflow-x-auto overflow-y-hidden scrollbar-hide">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`flex flex-col items-center justify-center shrink-0 flex-1 min-w-[52px] max-w-[72px] min-h-[44px] py-1 px-0.5 gap-0.5 rounded-lg transition-colors overflow-hidden ${isActive ? 'text-primary font-semibold' : 'text-secondary hover:text-on-surface'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px] sm:text-[22px] shrink-0" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium leading-none text-center w-full truncate">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
