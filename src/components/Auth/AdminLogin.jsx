import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function AdminLogin() {
  const { login, setAuthView } = useApp();
  const [email, setEmail] = useState('admin@sunvinerenewable.com');
  const [password, setPassword] = useState('1234567890123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminSubmit = (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please provide an authorized corporate email.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Invalid executive master password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('admin');
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden bg-surface-container-low text-on-surface antialiased">
      {/* LEFT SIDE: Technical Operations Brand Canvas (Desktop only: hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0F1B2E] text-surface-container-lowest relative flex-col justify-between p-8 lg:p-12 border-r border-outline-variant/20 shrink-0">
        {/* Ambient Lighting Radial Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(108,191,61,0.18)_0%,transparent_65%)] pointer-events-none"></div>

        {/* Top Header Segment */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            {/* Corporate Logo */}
            <div className="flex items-center">
              <img
                alt="Sunvine Renewable Energy corporate logo"
                className="h-9 w-auto object-contain brightness-110 drop-shadow-sm cursor-pointer"
                src="/sunvine_logo_white.png"
                onClick={() => setAuthView('dealer_login')}
              />
            </div>
            {/* System Tag Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/10 border border-outline-variant/30 text-primary-container font-label-xs tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
              PORTAL • OPERATIONS CONSOLE v2.0.0
            </span>
          </div>

          {/* Main Pitch & Headline */}
          <div className="mt-8 space-y-4">
            <h1 className="font-headline-xl text-headline-xl text-surface-container-lowest leading-tight">
              National Solar EPC Operations &amp; <span className="text-primary-container">Channel Management</span> Console
            </h1>
            <p className="font-body-md text-body-md text-surface-variant/80 max-w-xl leading-relaxed">
              Centralized telemetry, DISCOM tariff synchronization, and real-time dealer financial governance across 48 national nodes.
            </p>
          </div>

          {/* High-Security Trust Cards Bento Cluster */}
          <div className="mt-10 space-y-3.5">
            {/* Trust Item 1 */}
            <div className="p-4 rounded-xl bg-surface-container-lowest/5 border border-outline-variant/15 backdrop-blur-sm flex items-start gap-4 transition-colors duration-150 hover:bg-surface-container-lowest/10">
              <div className="w-10 h-10 rounded-lg bg-primary-container/15 flex items-center justify-center shrink-0 text-primary-container">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
              <div>
                <div className="font-label-md text-label-md text-surface-container-lowest">ISO 27001 Certified Infrastructure</div>
                <div className="font-body-sm text-body-sm text-surface-variant/70 mt-0.5">End-to-End Enterprise Hardening</div>
              </div>
            </div>

            {/* Trust Item 2 */}
            <div className="p-4 rounded-xl bg-surface-container-lowest/5 border border-outline-variant/15 backdrop-blur-sm flex items-start gap-4 transition-colors duration-150 hover:bg-surface-container-lowest/10">
              <div className="w-10 h-10 rounded-lg bg-tertiary-container/20 flex items-center justify-center shrink-0 text-tertiary-fixed">
                <span className="material-symbols-outlined text-[22px]">lock</span>
              </div>
              <div>
                <div className="font-label-md text-label-md text-surface-container-lowest">Encrypted Dealer Financial Data</div>
                <div className="font-body-sm text-body-sm text-surface-variant/70 mt-0.5">AES-256 Margin &amp; Discom Subsidies Protection</div>
              </div>
            </div>

            {/* Trust Item 3 */}
            <div className="p-4 rounded-xl bg-surface-container-lowest/5 border border-outline-variant/15 backdrop-blur-sm flex items-start gap-4 transition-colors duration-150 hover:bg-surface-container-lowest/10">
              <div className="w-10 h-10 rounded-lg bg-primary-container/15 flex items-center justify-center shrink-0 text-primary-container">
                <span className="material-symbols-outlined text-[22px]">monitoring</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-surface-container-lowest">24x7 Security Monitoring</span>
                  <span className="inline-flex items-center gap-1 font-label-xs text-label-xs text-primary-fixed">
                    <span className="w-2 h-2 rounded-full bg-primary-container animate-ping"></span> Live
                  </span>
                </div>
                <div className="font-body-sm text-body-sm text-surface-variant/70 mt-0.5">Active Threat Mitigation &amp; Session IP Tracking</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status telemetry and Copyright */}
        <div className="relative z-10 pt-8 mt-8 border-t border-outline-variant/15 space-y-4">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface-container-lowest/10 border border-outline-variant/20 text-surface-container-lowest font-label-xs text-label-xs">
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            <span>Connected Nodes: <strong>48 Operational</strong></span>
            <span className="text-surface-variant/50">•</span>
            <span>Latency: <strong>14ms</strong></span>
            <span className="text-surface-variant/50">•</span>
            <span className="text-primary-fixed">All Discom Grids Synced</span>
          </div>
          <div className="font-body-sm text-body-sm text-surface-variant/60">
            © 2025 Sunvine Renewable Energy Private Limited. Internal Executive System.
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication & 2FA Interface (clean & compact on mobile/tablet) */}
      <div className="lg:w-[55%] w-full bg-surface flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 lg:p-16">
        {/* Mobile-only Brand Header (clean and compact like Dealer Login) */}
        <header className="lg:hidden w-full max-w-xl flex items-center justify-between py-2 mb-3">
          <img
            alt="Sunvine Renewable Logo"
            className="h-8 w-auto object-contain cursor-pointer"
            src="/sunvine_logo_transparent.png"
            onClick={() => setAuthView('dealer_login')}
          />
          <div className="flex items-center gap-1.5 bg-secondary-container/60 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-xs text-[11px] text-on-secondary-fixed uppercase tracking-wider font-semibold">
              Admin Console
            </span>
          </div>
        </header>

        <div className="w-full max-w-xl">
          {/* Surface Card Container */}
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-xl shadow-sm p-5 sm:p-8 md:p-10">
            {/* Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-surface-container-highest">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-800 font-label-xs text-label-xs">
                <span className="material-symbols-outlined text-[16px] text-amber-700">lock</span>
                RESTRICTED EXECUTIVE ACCESS
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F1B2E] text-surface-container-lowest font-label-xs text-label-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                ADMIN (Full Access)
              </div>
            </div>

            {/* Form Header Titles */}
            <div className="pt-5 mb-4">
              <h2 className="font-headline-lg text-2xl sm:text-headline-lg text-[#0F1B2E]">Admin Sign In</h2>
              <p className="font-body-md text-xs sm:text-body-md text-secondary mt-1">
                Enter authorized credentials to access national pricing and dealer operations.
              </p>
            </div>

            {/* Dedicated Credentials Info Helper */}
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface">
                <span className="material-symbols-outlined text-primary text-base">verified_user</span>
                <span><strong>ID:</strong> admin@sunvinerenewable.com</span>
                <span className="hidden sm:inline text-secondary">•</span>
                <span><strong>OTP:</strong> 123456</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@sunvinerenewable.com');
                  setPassword('1234567890123456');
                  setOtp(['1', '2', '3', '4', '5', '6']);
                }}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer self-start sm:self-auto"
              >
                Autofill Credentials
              </button>
            </div>

            {/* Sign-in Form */}
            <form className="space-y-4 sm:space-y-5" onSubmit={handleAdminSubmit}>
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block font-label-md text-label-md text-on-surface">Official Executive Email / Admin ID</label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">badge</span>
                  <input
                    className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest border border-surface-container-highest rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdminSubmit(e); }}
                  />
                  <div className="absolute right-3 flex items-center text-primary-container" title="Verified Corporate Identity">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-label-md text-label-md text-on-surface">Master Executive Password</label>
                  <a className="font-label-xs text-label-xs text-tertiary hover:underline cursor-pointer" onClick={() => alert('Security reset protocol triggered.')}>
                    Reset via IT Security
                  </a>
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">key</span>
                  <input
                    className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest border border-surface-container-highest rounded-lg font-body-md text-body-md text-on-surface tracking-widest focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdminSubmit(e); }}
                  />
                  <button
                    aria-label="Toggle password visibility"
                    className="absolute right-3 flex items-center text-secondary hover:text-on-surface transition-colors"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error font-body-sm text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Workstation Checkbox */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input defaultChecked className="w-4 h-4 rounded border-surface-container-highest text-primary-container focus:ring-primary-container accent-[#6CBF3D] cursor-pointer" type="checkbox"/>
                  <span className="font-body-sm text-xs text-on-surface">Remember Me</span>
                </label>
              </div>

              {/* Primary Action Button */}
              <button
                className="w-full h-12 rounded-lg bg-primary-container hover:bg-[#4F9A2C] active:scale-[0.99] text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm transition-all duration-150 cursor-pointer font-semibold"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="inline-flex items-center justify-center -scale-y-100" style={{ transform: 'scaleY(-1)' }}>
                      <span className="material-symbols-outlined animate-spin text-[18px]" style={{ animationDirection: 'reverse' }}>sync</span>
                    </span>
                    <span>Signing in to Operations Console...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Operations Console</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Back to Dealer Portal */}
            <div className="mt-4 text-center">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setAuthView('dealer_login')}
                  className="text-xs font-semibold text-secondary hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Dealer Network Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthView('staff_login')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">badge</span>
                  <span>Staff Workspace Login</span>
                </button>
              </div>
            </div>

            {/* Divider: EMERGENCY PROTOCOL */}
            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-container-highest"></div>
              </div>
              <div className="relative flex justify-center text-center">
                <span className="px-3 bg-surface-container-lowest font-label-xs text-label-xs text-secondary tracking-wider">
                  EMERGENCY PROTOCOL
                </span>
              </div>
            </div>

            {/* Emergency Security Hotline Card */}
            <div className="rounded-lg p-3.5 bg-surface-container-low border border-surface-container-highest flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-surface-container-lowest border border-surface-container-highest flex items-center justify-center shrink-0 text-[#0F1B2E]">
                <span className="material-symbols-outlined text-[18px]">support_agent</span>
              </div>
              <div className="font-body-sm text-body-sm text-secondary">
                Facing login issues? Contact internal IT desk at <strong className="text-on-surface font-semibold">+91 8000050580</strong> (Toll-Free) or email <a className="text-tertiary hover:underline" href="mailto:security@sunvinerenewable.com">security@sunvinerenewable.com</a>.
              </div>
            </div>
          </div>

          {/* Compliance Audit Notice */}
          <div className="text-center mt-6 px-4">
            <p className="font-body-sm text-body-sm text-secondary">
              Authorized Sunvine Personnel Only. All access is logged with IP tracking (Current IP: <span className="font-mono text-on-surface font-semibold">103.24.188.42</span> - Ahmedabad NOC).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
