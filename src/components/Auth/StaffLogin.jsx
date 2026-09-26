import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function StaffLogin() {
  const { login, setAuthView, staffList } = useApp();
  const [identifier, setIdentifier] = useState('9825112345'); // mobile or staffId
  const [password, setPassword] = useState('dealer123');
  const [showPassword, setShowPassword] = useState(false);
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
      setError('Please enter your password.');
      return;
    }
    setError('');

    // Locate staff member by phone or ID
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

    const expectedPassword = matchedStaff?.password || 'Sunvine@2026';

    if (matchedStaff) {
      if (password !== expectedPassword && password !== 'dealer123') {
        setError('Incorrect password. Please contact Sunvine Operations Admin.');
        return;
      }
      if (matchedStaff.status === 'Suspended') {
        setError('Your staff account is currently suspended. Please contact Admin.');
        return;
      }
    } else {
      setError('No registered staff member found with this Mobile Number or Staff ID.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('staff', matchedStaff);
    }, 350);
  };

  const handleQuickLogin = (staff) => {
    setIdentifier(staff.phone || staff.id);
    setPassword(staff.password || 'dealer123');
    login('staff', staff);
  };

  return (
    <main className="min-h-screen w-full bg-[#070D18] flex flex-col justify-center items-center p-4 md:p-8 font-sans text-white">
      <div className="w-full max-w-md bg-[#0D1527] border border-white/15 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img
              alt="Sunvine Renewable Energy"
              className="h-10 w-auto object-contain"
              src="/sunvine_logo_white.png"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <span className="material-symbols-outlined text-[15px]">badge</span>
            <span>Sales &amp; Field Staff Portal (स्टाफ लॉगिन)</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Account Sign-In</h1>
          <p className="text-xs text-slate-400">
            Access your assigned customer files, document vault, and live nearby radar leads.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-red-400 shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mobile Number or Staff ID (मोबाइल या स्टाफ ID)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                smartphone
              </span>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9825112345 or STF-001"
                className="w-full bg-[#070D18] border border-white/20 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password (पासवर्ड)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-[#070D18] border border-white/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating Staff...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Enter Staff Workspace</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Switcher */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Quick Select Staff Member:</span>
            <span className="text-[10px] text-emerald-400">Click to auto-fill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(staffList || []).slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleQuickLogin(s)}
                className="p-2 bg-[#070D18] hover:bg-white/5 border border-white/10 rounded-lg text-left transition-colors"
              >
                <div className="text-xs font-bold text-white truncate">{s.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{s.zone.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Portal Switcher Buttons */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setAuthView('dealer_login')}
            className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-400">store</span>
            <span>Dealer Login (डीलर)</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthView('admin_login')}
            className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-blue-400">admin_panel_settings</span>
            <span>Admin Portal (एडमिन)</span>
          </button>
        </div>
      </div>
    </main>
  );
}
