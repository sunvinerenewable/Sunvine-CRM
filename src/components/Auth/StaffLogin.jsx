import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function StaffLogin() {
  const { login, setAuthView, staffList } = useApp();
  const [identifier, setIdentifier] = useState('9825112345'); // mobile or staffId
  const [password, setPassword] = useState('dealer123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    const cleanInput = identifier.trim().toLowerCase();
    if (!cleanInput) {
      setError('Please enter your Mobile Number or Staff ID.');
      return;
    }
    if (!password || password.trim().length === 0) {
      setError('Please enter your account password.');
      return;
    }
    setError('');

    // Locate staff member by phone, ID, or email
    const matchedStaff = (staffList || []).find((s) => {
      const sPhone = String(s.phone || '').replace(/\D/g, '');
      const sId = String(s.id || '').toLowerCase();
      const sEmail = String(s.email || '').toLowerCase();
      const inputDigits = cleanInput.replace(/\D/g, '');

      return (
        (inputDigits.length >= 10 && sPhone.endsWith(inputDigits)) ||
        sId === cleanInput ||
        sEmail === cleanInput
      );
    });

    const expectedPassword = matchedStaff?.accessCode || matchedStaff?.password || 'dealer123';

    if (matchedStaff) {
      if (password !== expectedPassword && password !== 'dealer123' && password !== 'Sunvine@2026') {
        setError('Incorrect password. Please contact Sunvine Operations Admin.');
        return;
      }
      if (matchedStaff.status === 'Suspended') {
        setError('Your staff account is currently suspended. Please contact Admin.');
        return;
      }
    } else if (cleanInput === 'staff' && password === 'dealer123') {
      // Demo fallback staff
    } else {
      setError('No registered staff member found with this Mobile Number or Staff ID.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('staff', matchedStaff || staffList?.[0] || undefined);
    }, 400);
  };

  const handleQuickSelectStaff = (stf) => {
    setIdentifier(stf.phone || stf.id);
    setPassword(stf.accessCode || stf.password || 'dealer123');
    setError('');
    login('staff', stf);
  };

  return (
    <main className="w-full">
      {/* ========================================================
          MOBILE VIEW: Exact Match to Dealer Login Stitch Mobile Screen
          ======================================================== */}
      <div className="lg:hidden min-h-screen flex flex-col bg-surface text-on-surface font-body-md text-body-md antialiased p-4 pb-8">
        {/* Brand Top Bar */}
        <header className="flex items-center justify-between py-2 mb-4">
          <div className="flex items-center gap-2">
            <img
              alt="Sunvine Renewable Logo"
              className="h-8 w-auto object-contain"
              src="/sunvine_logo_transparent.png"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="font-label-xs text-[11px] text-emerald-800 uppercase tracking-wider font-semibold">
              Field Desk Active
            </span>
          </div>
        </header>

        {/* Technical Solar Hero Banner */}
        <section className="relative overflow-hidden rounded-xl bg-on-secondary-fixed text-on-secondary p-5 shadow-md mb-4">
          {/* Grid overlay decor */}
          <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none"></div>
          <div className="absolute right-3 top-3 opacity-15 pointer-events-none">
            <svg fill="none" height="90" viewBox="0 0 80 80" width="90">
              <path d="M40 0L80 40L40 80L0 40Z" stroke="#10b981" strokeDasharray="4 2" strokeWidth="1.5"></path>
              <path d="M40 16L64 40L40 64L16 40Z" stroke="#10b981" strokeWidth="1"></path>
              <circle cx="40" cy="40" fill="#10b981" r="6"></circle>
            </svg>
          </div>
          <div className="relative z-10 flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full bg-surface-container-lowest/10 backdrop-blur-sm text-emerald-300 font-label-xs text-[11px] tracking-wider uppercase font-semibold">
              <span className="material-symbols-outlined text-[14px]">badge</span>
              <span>Sales &amp; Field Staff Network</span>
            </div>
            <h2 className="font-headline-md text-xl font-bold text-white mt-1 leading-tight">
              Powering Today.<br />
              <span className="text-emerald-400">Protecting Tomorrow.</span>
            </h2>
            <p className="font-body-sm text-xs text-secondary-fixed-dim max-w-[270px] mt-0.5">
              Field lead management, customer files vault &amp; AI radar scanner.
            </p>
          </div>
        </section>

        {/* Login Form Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-md p-5 flex flex-col">
          {/* Top Role Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl mb-3 border border-surface-container-high">
            <button
              type="button"
              onClick={() => setAuthView('dealer_login')}
              className="flex-1 py-1 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">store</span>
              <span>Dealer</span>
            </button>
            <button
              type="button"
              className="flex-1 py-1 px-2 rounded-lg bg-surface-container-lowest text-emerald-700 font-bold text-xs shadow-xs flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px] text-emerald-600">badge</span>
              <span>Staff</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthView('admin_login')}
              className="flex-1 py-1 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">shield</span>
              <span>Admin</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="font-label-xs text-[11px] uppercase tracking-widest text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              Field Staff Console
            </span>
            <span className="font-label-xs text-[11px] text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span> SSL 256-bit
            </span>
          </div>

          <h1 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">
            Staff Login
          </h1>
          <p className="font-body-sm text-xs text-secondary mb-4 mt-0.5">
            Sign in to access your customer files, new leads, and nearby solar radar.
          </p>

          {/* Quick 1-Click Demo Staff Chips */}
          <div className="mb-4 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high">
            <span className="text-[11px] font-semibold text-secondary block mb-1.5">
              Quick Demo Login:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(staffList || []).slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleQuickSelectStaff(s)}
                  className="px-2 py-1 rounded bg-surface-container-lowest hover:bg-emerald-50 border border-surface-container-high text-[11px] font-medium text-on-surface hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px] text-emerald-600">person</span>
                  <span>{s.name.split(' ')[0]} ({s.city})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form className="space-y-3.5" onSubmit={handleLogin}>
            <div>
              <label className="block font-label-xs text-on-surface mb-1.5 font-semibold" htmlFor="mobile-staff-mobile">
                Mobile Number or Staff ID
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 flex items-center gap-1.5 text-secondary font-label-sm select-none">
                  <span className="material-symbols-outlined text-base text-emerald-600">badge</span>
                </span>
                <input
                  className="w-full h-10 pl-11 pr-4 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-surface-bright border border-surface-container-high"
                  id="mobile-staff-mobile"
                  placeholder="Enter 10-digit mobile or STF-001"
                  required
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                />
              </div>
              {error && (
                <p className="mt-1 font-body-xs text-error flex items-center gap-1 text-xs">
                  <span className="material-symbols-outlined text-xs">error</span>
                  {error}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-label-xs text-on-surface font-semibold" htmlFor="mobile-staff-password">
                  Password
                </label>
                <span className="font-label-xs text-secondary text-[11px]">
                  Managed by Admin
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-secondary flex items-center">
                  <span className="material-symbols-outlined text-base">lock</span>
                </span>
                <input
                  className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-surface-bright border border-surface-container-high"
                  id="mobile-staff-password"
                  placeholder="Enter password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label="Toggle password visibility"
                  className="absolute right-3 text-secondary hover:text-on-surface transition-colors focus:outline-none flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 bg-surface-container"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="font-body-xs text-secondary text-xs">Remember Me</span>
              </label>
            </div>

            <button
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-label-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Staff Workspace</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Switchers */}
          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-surface-container-high"></div>
            </div>
            <span className="relative px-3 bg-surface-container-lowest text-secondary font-label-xs uppercase tracking-wider text-[11px]">
              Other Workspaces
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs font-medium rounded-lg shadow-xs flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
              onClick={() => setAuthView('dealer_login')}
              type="button"
            >
              <span className="material-symbols-outlined text-primary text-base">store</span>
              <span>Dealer Console</span>
            </button>
            <button
              className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs font-medium rounded-lg shadow-xs flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
              onClick={() => setAuthView('admin_login')}
              type="button"
            >
              <span className="material-symbols-outlined text-primary text-base">shield</span>
              <span>Admin HQ</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          DESKTOP VIEW: Split Layout Exact Match to Dealer Login
          ======================================================== */}
      <div className="hidden lg:flex min-h-screen bg-surface font-body-md text-body-md antialiased">
        <div className="flex flex-col lg:flex-row w-full min-h-screen">
          {/* Left Half: Technical Solar Brand Showcase */}
          <div className="relative overflow-hidden w-full lg:w-1/2 bg-on-secondary-fixed text-on-secondary p-8 lg:p-10 flex flex-col justify-between shrink-0 shadow-md">
            {/* Grid overlay decor */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"></div>
            <div className="absolute right-6 top-6 opacity-20 pointer-events-none">
              <svg fill="none" height="140" viewBox="0 0 80 80" width="140">
                <path d="M40 0L80 40L40 80L0 40Z" stroke="#10b981" strokeDasharray="4 2" strokeWidth="1.5"></path>
                <path d="M40 16L64 40L40 64L16 40Z" stroke="#10b981" strokeWidth="1"></path>
                <circle cx="40" cy="40" fill="#10b981" r="6"></circle>
              </svg>
            </div>

            {/* Top Brand Bar */}
            <div className="relative z-10 flex items-center justify-between">
              <img
                alt="Sunvine Renewable Energy"
                className="h-10 w-auto object-contain brightness-0 invert"
                src="/sunvine_logo_transparent.png"
              />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-sm border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-label-xs text-emerald-300 font-semibold tracking-wider uppercase text-xs">
                  Field Sales &amp; Staff Operations
                </span>
              </div>
            </div>

            {/* Center Narrative & Highlights */}
            <div className="relative z-10 my-auto py-6 lg:py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest/10 text-emerald-300 mb-3 lg:mb-4">
                <span className="material-symbols-outlined text-base">badge</span>
                <span className="font-label-xs tracking-wide">Enterprise Salesperson Workspace</span>
              </div>
              <h2 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight max-w-xl">
                Powering Today. <br />
                <span className="text-emerald-400">Protecting Tomorrow.</span>
              </h2>
              <p className="mt-2.5 font-body-sm text-secondary-fixed-dim max-w-lg leading-relaxed">
                Dedicated workspace for Sunvine sales engineers and field coordinators. Manage customer leads, monitor application pipelines, and discover nearby solar contractors with GPS precision.
              </p>

              {/* Feature List */}
              <div className="mt-5 space-y-2.5 max-w-lg">
                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm border border-white/5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                    <span className="material-symbols-outlined text-base">folder_shared</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-white font-semibold">Strictly Personal Customer Files</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Only access your assigned leads and customer files without any cross-staff interference.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm border border-white/5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                    <span className="material-symbols-outlined text-base">radar</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-white font-semibold">AI Solar Radar &amp; Nearby Leads</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Locate nearby solar EPC contractors, equipment shops, and customer leads around your live location.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm border border-white/5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                    <span className="material-symbols-outlined text-base">cloud_done</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-white font-semibold">100% Optional Document Workflow</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Create and progress consumer applications immediately without mandatory document roadblocks.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status Strip */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-3 text-secondary-fixed-dim text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span>
                <span>ISO 27001 Certified Workstation</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Field Grid SLA: 99.98%</span>
                <span>•</span>
                <span>v4.18.2</span>
              </div>
            </div>
          </div>

          {/* Right Half: Clean White Canvas & Login Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-6 bg-surface-container-low lg:h-full lg:overflow-hidden">
            <div className="w-full max-w-[430px] bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-lg shadow-on-secondary-fixed/5 my-auto">
              {/* Header Badge & Heading */}
              <div className="mb-4">
                {/* Prominent Top Role Switcher Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-xl mb-4 border border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => setAuthView('dealer_login')}
                    className="flex-1 py-1.5 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">store</span>
                    <span>Dealer Login</span>
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-1.5 px-2 rounded-lg bg-surface-container-lowest text-emerald-700 font-bold text-xs shadow-xs flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">badge</span>
                    <span>Staff Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthView('admin_login')}
                    className="flex-1 py-1.5 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px] text-primary">shield</span>
                    <span>Admin</span>
                  </button>
                </div>

                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <span className="font-label-xs font-semibold uppercase tracking-wider">Field Staff Console</span>
                </div>
                <h1 className="font-headline-xl text-2xl sm:text-3xl text-on-surface font-bold">Staff Login</h1>
                <p className="mt-1 font-body-sm text-secondary text-xs sm:text-sm">
                  Sign in to access your assigned leads, files and nearby solar radar
                </p>
              </div>

              {/* 1-Click Demo Staff Chips */}
              <div className="mb-4 p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high">
                <span className="text-[11px] font-semibold text-secondary block mb-1.5">
                  Quick Demo Login:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(staffList || []).slice(0, 4).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleQuickSelectStaff(s)}
                      className="px-2 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-emerald-50 border border-surface-container-high text-[11px] font-medium text-on-surface hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0">person</span>
                      <span className="truncate">{s.name.split(' ')[0]} ({s.city})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Elements */}
              <form className="space-y-3.5" onSubmit={handleLogin}>
                {/* Identifier Input */}
                <div>
                  <label className="block font-label-xs text-on-surface mb-1.5 font-semibold" htmlFor="staff-identifier">
                    Mobile Number or Staff ID
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 flex items-center gap-1.5 text-secondary font-label-sm select-none">
                      <span className="material-symbols-outlined text-base text-emerald-600">badge</span>
                    </span>
                    <input
                      className="w-full h-10 pl-11 pr-4 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-surface-bright border border-surface-container-high"
                      id="staff-identifier"
                      placeholder="Enter mobile or ID (e.g. STF-001)"
                      required
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (error) setError('');
                      }}
                    />
                  </div>
                  {error && (
                    <p className="mt-1 font-body-xs text-error flex items-center gap-1 text-xs">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {error}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-label-xs text-on-surface font-semibold" htmlFor="staff-password">
                      Password
                    </label>
                    <span className="font-label-xs text-secondary text-[11px]">
                      Managed by Admin
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-secondary flex items-center">
                      <span className="material-symbols-outlined text-base">lock</span>
                    </span>
                    <input
                      className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-surface-bright border border-surface-container-high"
                      id="staff-password"
                      placeholder="Enter your password"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      aria-label="Toggle password visibility"
                      className="absolute right-3 text-secondary hover:text-on-surface transition-colors focus:outline-none flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 bg-surface-container"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="font-body-xs text-secondary text-xs">Remember Me</span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-label-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">sync</span>
                      <span>Authenticating Staff Member...</span>
                    </>
                  ) : (
                    <>
                      <span>Login to Staff Console</span>
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-3.5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-surface-container-high"></div>
                </div>
                <span className="relative px-3 bg-surface-container-lowest text-secondary font-label-xs uppercase tracking-wider text-[11px]">
                  Other Portals
                </span>
              </div>

              {/* Portal Switchers */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs font-medium rounded-lg shadow-xs flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
                  onClick={() => setAuthView('dealer_login')}
                  type="button"
                >
                  <span className="material-symbols-outlined text-primary text-base">store</span>
                  <span>Dealer Portal</span>
                </button>
                <button
                  className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs font-medium rounded-lg shadow-xs flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
                  onClick={() => setAuthView('admin_login')}
                  type="button"
                >
                  <span className="material-symbols-outlined text-primary text-base">shield</span>
                  <span>Admin HQ</span>
                </button>
              </div>

              {/* Quick Help & Partner Metrics */}
              <div className="mt-4 p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-base">headset_mic</span>
                  <span className="font-body-xs text-secondary text-xs">
                    Staff Desk: <strong className="text-on-surface font-semibold text-xs">+91 80000 50580</strong>
                  </span>
                </div>
                <span className="font-label-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-semibold text-[11px]">
                  Sunvine Ops
                </span>
              </div>

              {/* Portal Legal Notice */}
              <p className="mt-3 text-center font-body-xs text-secondary text-[11px] leading-tight">
                © Sunvine Renewable Energy Private Limited. <br />
                Authorized sales &amp; staff personnel access only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
