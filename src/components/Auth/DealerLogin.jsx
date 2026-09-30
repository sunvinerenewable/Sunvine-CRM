import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/authService';

export default function DealerLogin() {
  const { login, setAuthView } = useApp();
  const [mobileNumber, setMobileNumber] = useState('9810000000');
  const [password, setPassword] = useState('dealer123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    const cleanNumber = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!/^[6-9]/.test(cleanNumber)) {
      setError('Mobile number must start with 6, 7, 8, or 9.');
      return;
    }
    if (!password || password.trim().length === 0) {
      setError('Please enter your account password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authService.loginDealer(cleanNumber, password);
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please verify credentials.');
        setLoading(false);
        return;
      }
      login('dealer', res.dealer);
    } catch (err) {
      setError('Server authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full">
      {/* ========================================================
          MOBILE VIEW: Exact Stitch Screen (21_8e1cdf0c51eb423ca1679a96360fbdda_1__Dealer_Login__Mobile_.html)
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
          <div className="flex items-center gap-1.5 bg-secondary-container/60 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-xs text-[11px] text-on-secondary-fixed uppercase tracking-wider font-semibold">
              Grid Online
            </span>
          </div>
        </header>

        {/* Technical Solar Hero Banner */}
        <section className="relative overflow-hidden rounded-xl bg-on-secondary-fixed text-on-secondary p-5 shadow-md mb-4">
          {/* Grid overlay decor */}
          <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-primary-container/15 blur-2xl pointer-events-none"></div>
          <div className="absolute right-3 top-3 opacity-15 pointer-events-none">
            <svg fill="none" height="90" viewBox="0 0 80 80" width="90">
              <path d="M40 0L80 40L40 80L0 40Z" stroke="#6CBF3D" strokeDasharray="4 2" strokeWidth="1.5"></path>
              <path d="M40 16L64 40L40 64L16 40Z" stroke="#6CBF3D" strokeWidth="1"></path>
              <circle cx="40" cy="40" fill="#6CBF3D" r="6"></circle>
            </svg>
          </div>
          <div className="relative z-10 flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full bg-surface-container-lowest/10 backdrop-blur-sm text-primary-fixed font-label-xs text-[11px] tracking-wider uppercase font-semibold">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              <span>Authorised Dealer Network</span>
            </div>
            <h2 className="font-headline-md text-xl font-bold text-white mt-1 leading-tight">
              Powering Today.<br />
              <span className="text-primary-container">Protecting Tomorrow.</span>
            </h2>
            <p className="font-body-sm text-xs text-secondary-fixed-dim max-w-[270px] mt-0.5">
              High-precision solar telemetry &amp; dealer quotation engine.
            </p>
          </div>
        </section>

        {/* Login Form Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-md p-5 flex flex-col">
          {/* Top Role Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl mb-3 border border-surface-container-high">
            <button
              type="button"
              className="flex-1 py-1 px-2 rounded-lg bg-surface-container-lowest text-primary font-bold text-xs shadow-xs flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">store</span>
              <span>Dealer</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthView('staff_login')}
              className="flex-1 py-1 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer"
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
            <span className="font-label-xs text-[11px] uppercase tracking-widest text-primary font-semibold px-2 py-0.5 rounded bg-primary-fixed/30">
              Channel Console
            </span>
            <span className="font-label-xs text-[11px] text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span> SSL 256-bit
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl font-bold text-on-surface mt-1">
            Dealer Login
          </h1>
          <p className="font-body-sm text-xs text-secondary mb-5 mt-0.5">
            Login to create and manage your solar quotations
          </p>

          <form className="flex flex-col gap-4" onSubmit={handleLogin}>
            {/* Phone Field */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-xs font-semibold text-on-surface" htmlFor="mobile-number-mob">
                Mobile Number
              </label>
              <div className="flex rounded-lg bg-surface-container-low shadow-sm transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md border border-surface-container-high">
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-surface-container rounded-l-lg select-none border-r border-surface-container-high">
                  <span className="text-[14px] leading-none">🇮🇳</span>
                  <span className="font-label-md text-xs text-on-surface font-medium">+91</span>
                </div>
                <input
                  className="w-full bg-transparent px-3 py-2.5 font-body-md text-sm text-on-surface placeholder:text-secondary focus:outline-none min-w-0"
                  id="mobile-number-mob"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter registered mobile"
                  required
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => {
                    setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
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

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-xs font-semibold text-on-surface" htmlFor="dealer-password-mob">
                  Password
                </label>
                <span className="font-label-xs text-[11px] text-secondary">
                  Managed by Admin
                </span>
              </div>
              <div className="relative flex items-center rounded-lg bg-surface-container-low shadow-sm transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md border border-surface-container-high">
                <input
                  className="w-full bg-transparent px-3 py-2.5 pr-10 font-body-md text-sm text-on-surface placeholder:text-secondary focus:outline-none min-w-0"
                  id="dealer-password-mob"
                  placeholder="Enter account password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label="Toggle password visibility"
                  className="absolute right-2 p-1.5 text-secondary hover:text-on-surface rounded-full flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me checkbox */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  className="w-4 h-4 rounded text-primary focus:ring-0 cursor-pointer"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="font-body-sm text-xs text-on-surface">Remember Me</span>
              </label>
            </div>

            {/* Submit Primary Button */}
            <button
              className="w-full h-11 mt-1 rounded-lg bg-primary-container hover:bg-primary text-white font-label-md text-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-flex items-center justify-center -scale-y-100" style={{ transform: 'scaleY(-1)' }}>
                    <span className="material-symbols-outlined animate-spin text-[18px]" style={{ animationDirection: 'reverse' }}>sync</span>
                  </span>
                  <span>Authenticating Dealer...</span>
                </>
              ) : (
                <>
                  <span>Login to Console</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full h-px bg-surface-container-high"></div>
            <span className="absolute bg-surface-container-lowest px-3 font-label-xs text-[11px] text-secondary tracking-wider uppercase font-semibold">
              Administrative
            </span>
          </div>

          {/* Portal Switchers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-secondary-fixed font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border border-surface-container-high"
              onClick={() => setAuthView('staff_login')}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">badge</span>
              <span>Staff Login</span>
            </button>
            <button
              className="h-10 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-secondary-fixed font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] border border-surface-container-high"
              onClick={() => setAuthView('admin_login')}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">shield</span>
              <span>Admin Login</span>
            </button>
          </div>
        </div>

        {/* Partner Support Box */}
        <div className="mt-4 p-3 rounded-xl bg-surface-container-low flex items-center gap-3 shadow-sm border border-surface-container-high">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px] text-on-secondary-fixed">headset_mic</span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-label-xs text-[10px] text-secondary uppercase tracking-wider font-semibold">Partner Desk Support</span>
            <a className="font-label-sm text-xs text-on-secondary-fixed font-bold truncate hover:text-primary" href="tel:+918000050580">
              Helpline: +91 80000 50580
            </a>
          </div>
          <div className="shrink-0 flex items-center text-primary">
            <span className="material-symbols-outlined text-[18px]">call</span>
          </div>
        </div>

        {/* Footer Legal/Auth Note */}
        <footer className="mt-6 text-center flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 text-secondary">
            <span className="material-symbols-outlined text-[14px] text-tertiary">shield</span>
            <span className="font-label-xs text-[11px] uppercase tracking-wider font-semibold">Sunvine EPC Ecosystem</span>
          </div>
          <p className="font-body-sm text-[11px] text-secondary">
            © 2025 Sunvine Renewable Energy. Authorized dealer access only.
          </p>
        </footer>
      </div>

      {/* ========================================================
          DESKTOP VIEW: Exact Stitch Desktop Screen (17_ff57d7cfa39f417ab8663f318cbb739e_1__Dealer_Login.html)
          ======================================================== */}
      <div className="hidden lg:flex flex-col w-full">
        <div className="w-full h-screen overflow-hidden flex flex-row bg-surface">
          {/* Left Panel: Deep Navy Visual Showcase */}
          <div className="relative w-full lg:w-1/2 bg-on-secondary-fixed text-on-secondary flex flex-col justify-between p-6 sm:p-10 lg:p-8 xl:p-12 overflow-hidden min-h-[460px] lg:min-h-0 lg:h-full">
            {/* Decorative Solar Grid Background Effect */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg className="w-full h-full" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern height="40" id="solar-grid-pattern" patternUnits="userSpaceOnUse" width="60">
                    <path d="M 60 0 L 0 0 0 40 60 40 Z" fill="none" stroke="#6CBF3D" strokeDasharray="2,2" strokeWidth="0.75"></path>
                    <path d="M 0 20 L 60 20" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="0.5"></path>
                    <path d="M 30 0 L 30 40" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="0.5"></path>
                  </pattern>
                </defs>
                <rect fill="url(#solar-grid-pattern)" height="100%" width="100%"></rect>
              </svg>
            </div>

            {/* Glowing Green Energy Waves & Ambient Light */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header / Logo Zone */}
            <div className="relative z-10 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    alt="Sunvine Renewable Energy Logo"
                    className="h-9 lg:h-10 w-auto object-contain brightness-110 drop-shadow-sm"
                    src="/sunvine_logo_white.png"
                  />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/15 text-primary-fixed font-label-xs tracking-wider uppercase backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                  Authorised Dealer Network
                </span>
              </div>
            </div>

            {/* Center Narrative & Highlights */}
            <div className="relative z-10 my-auto py-6 lg:py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest/10 text-primary-fixed mb-3 lg:mb-4">
                <span className="material-symbols-outlined text-base">solar_power</span>
                <span className="font-label-xs tracking-wide">Enterprise Commercial &amp; Residential Portal</span>
              </div>
              <h2 className="font-headline-xl text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-on-secondary leading-tight max-w-xl">
                Powering Today. <br/>
                <span className="text-primary-container">Protecting Tomorrow.</span>
              </h2>
              <p className="mt-2.5 font-body-sm text-secondary-fixed-dim max-w-lg leading-relaxed">
                High-precision sizing engines, streamlined rooftop schematics, and instantaneous government subsidy workflows built exclusively for certified channel partners.
              </p>

              {/* Feature List */}
              <div className="mt-5 space-y-2.5 max-w-lg">
                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm">
                  <div className="p-1.5 rounded-lg bg-primary-container/20 text-primary-fixed shrink-0">
                    <span className="material-symbols-outlined text-base">bolt</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-on-secondary font-semibold">Instant Quotation Engine</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Generate fully costed commercial CAD-aligned BOQ propositions in under 90 seconds.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm">
                  <div className="p-1.5 rounded-lg bg-primary-container/20 text-primary-fixed shrink-0">
                    <span className="material-symbols-outlined text-base">account_balance</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-on-secondary font-semibold">Verified Government Subsidy Calculator</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Integrated state and central solar tariff grids with live net-metering slabs.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-surface-container-lowest/5 p-2.5 sm:p-3 rounded-xl backdrop-blur-sm">
                  <div className="p-1.5 rounded-lg bg-primary-container/20 text-primary-fixed shrink-0">
                    <span className="material-symbols-outlined text-base">share</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-xs sm:text-sm text-on-secondary font-semibold">Direct WhatsApp &amp; PDF Sharing</h3>
                    <p className="font-body-xs text-xs text-secondary-fixed-dim">Deliver branded estimation decks and system specs directly to customer devices.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status Strip */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-3 text-secondary-fixed-dim text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-container text-sm">verified_user</span>
                <span>ISO 27001 Certified Workstation</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Grid SLA: 99.98%</span>
                <span>•</span>
                <span>v4.18.2</span>
              </div>
            </div>
          </div>

          {/* Right Half: Clean White Canvas & Login Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-6 bg-surface-container-low lg:h-full lg:overflow-hidden">
            <div className="w-full max-w-[430px] bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-lg shadow-on-secondary-fixed/5 my-auto">
              {/* Header Badge & Heading */}
              <div className="mb-5">
                {/* Prominent Top Role Switcher Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-xl mb-4 border border-surface-container-high">
                  <button
                    type="button"
                    className="flex-1 py-1.5 px-2 rounded-lg bg-surface-container-lowest text-primary font-bold text-xs shadow-xs flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">store</span>
                    <span>Dealer Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthView('staff_login')}
                    className="flex-1 py-1.5 px-2 rounded-lg text-secondary hover:text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
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

                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="font-label-xs font-semibold uppercase tracking-wider">Channel Console</span>
                </div>
                <h1 className="font-headline-xl text-2xl sm:text-3xl text-on-surface font-bold">Dealer Login</h1>
                <p className="mt-1 font-body-sm text-secondary text-xs sm:text-sm">Login to create and manage your solar quotations</p>
              </div>

              {/* Form Elements */}
              <form className="space-y-3.5" id="dealer-login-form" onSubmit={handleLogin}>
                {/* Mobile Number Input */}
                <div>
                  <label className="block font-label-xs text-on-surface mb-1.5 font-semibold" htmlFor="mobile-number">
                    Mobile Number
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 flex items-center gap-1.5 text-secondary font-label-sm select-none">
                      <span className="material-symbols-outlined text-base">phone_iphone</span>
                      <span className="font-medium text-on-surface">+91</span>
                    </span>
                    <input
                      className="w-full h-10 pl-20 pr-4 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-bright border border-surface-container-high"
                      id="mobile-number"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      placeholder="Enter registered mobile"
                      required
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                        if (error) setError('');
                      }}
                    />
                  </div>
                  {error && (
                    <p className="mt-1 font-body-xs text-error flex items-center gap-1 text-xs" id="mobile-error">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {error}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-label-xs text-on-surface font-semibold" htmlFor="dealer-password">
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
                      className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest text-on-surface font-body-sm rounded-lg shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-bright border border-surface-container-high"
                      id="dealer-password"
                      placeholder="Enter your password"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      aria-label="Toggle password visibility"
                      className="absolute right-3 text-secondary hover:text-on-surface transition-colors focus:outline-none flex items-center"
                      id="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base" id="password-eye-icon">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container"
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="font-body-xs text-secondary text-xs">Remember Me</span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  className="w-full h-10 bg-primary-container hover:bg-primary text-on-primary font-label-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  id="submit-btn"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="inline-flex items-center justify-center -scale-y-100" style={{ transform: 'scaleY(-1)' }}>
                        <span className="material-symbols-outlined animate-spin text-base" style={{ animationDirection: 'reverse' }}>sync</span>
                      </span>
                      <span>Authenticating Dealer...</span>
                    </>
                  ) : (
                    <>
                      <span>Login to Console</span>
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
                  Administrative Access
                </span>
              </div>

              {/* Portal Switchers */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs sm:font-label-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
                  onClick={() => setAuthView('staff_login')}
                  type="button"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-base">badge</span>
                  <span>Staff Workspace</span>
                </button>
                <button
                  className="h-10 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-xs sm:font-label-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 border border-surface-container-high cursor-pointer"
                  onClick={() => setAuthView('admin_login')}
                  type="button"
                >
                  <span className="material-symbols-outlined text-primary text-base">shield</span>
                  <span>Admin HQ Login</span>
                </button>
              </div>

              {/* Quick Help & Partner Metrics */}
              <div className="mt-4 p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">headset_mic</span>
                  <span className="font-body-xs text-secondary text-xs">
                    Helpline: <strong className="text-on-surface font-semibold text-xs">+91 80000 50580</strong>
                  </span>
                </div>
                <span className="font-label-xs px-2 py-0.5 rounded bg-primary-container/15 text-primary font-semibold text-[11px]">
                  Official Support
                </span>
              </div>

              {/* Portal Legal Notice */}
              <p className="mt-3 text-center font-body-xs text-secondary text-[11px] leading-tight">
                © Sunvine Renewable Energy Private Limited. <br/>
                Authorized dealer access only. Unauthorized entry is logged.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
