import React from 'react';
import { useApp } from '../../context/AppContext';

export default function StaffDashboard() {
  const { currentStaff, customerFiles, setActiveTab, updateFileStatus } = useApp();

  // Strictly filter files for THIS staff member only
  const myFiles = (customerFiles || []).filter(
    (f) => f.staffId === currentStaff?.id || f.staffName === currentStaff?.name
  );

  const totalFiles = myFiles.length;
  const inProgressFiles = myFiles.filter(
    (f) => f.status === 'Verification' || f.status === 'DISCOM Registered'
  ).length;
  const successfulFiles = myFiles.filter((f) => f.status === 'Subsidized').length;
  const sourcedLeads = myFiles.filter((f) => f.status === 'Sourced').length;
  const totalKw = myFiles.reduce((acc, f) => acc + (f.solarSystemKw || 0), 0).toFixed(1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#070D18] via-[#0D1527] to-[#121E36] border border-white/10 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Field Executive Workspace (स्टाफ स्पेस)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome back, {currentStaff?.name || 'Sales Officer'}!
            </h1>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl">
              Territory: <strong className="text-slate-200">{currentStaff?.zone || 'Gujarat Region'}</strong> | Staff ID: <strong className="text-emerald-400 font-mono">{currentStaff?.id || 'STF-001'}</strong>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('staff_map')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">radar</span>
              <span>AI Radar (Nearby EPC &amp; Shops)</span>
            </button>
            <button
              onClick={() => setActiveTab('staff_new_lead')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>New Customer Lead (नई लीड)</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
      </div>

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Files (कुल फाइलें)</span>
            <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-on-surface">{totalFiles}</div>
            <div className="text-[11px] text-secondary mt-1">{totalKw} kW Pipeline Total</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Sourced Leads</span>
            <span className="material-symbols-outlined text-amber-500 text-[20px]">contact_phone</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-amber-600">{sourcedLeads}</div>
            <div className="text-[11px] text-secondary mt-1">Initial Contact &amp; Visits</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <span className="material-symbols-outlined text-blue-500 text-[20px]">hourglass_top</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{inProgressFiles}</div>
            <div className="text-[11px] text-secondary mt-1">Verification / DISCOM</div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Successful (सब्सिडी)</span>
            <span className="material-symbols-outlined text-emerald-500 text-[20px]">verified</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-bold text-emerald-600">{successfulFiles}</div>
            <div className="text-[11px] text-emerald-600 mt-1">DBT Approved &amp; Paid</div>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-surface rounded-xl p-4 md:p-5 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">My Territory</span>
            <span className="material-symbols-outlined text-primary text-[20px]">map</span>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-on-surface truncate">{currentStaff?.city || 'Gujarat'}</div>
            <div className="text-[11px] text-primary font-semibold mt-1 flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('staff_map')}>
              <span>View Radar Map</span>
              <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Customer Files Table */}
      <div className="bg-surface rounded-xl border border-surface-container-high shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-container-high flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
              <span>My Active Customer Files (मेरी ग्राहक फाइलें)</span>
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              Only your assigned solar files appear here. No interference with other staff.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('staff_files')}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({myFiles.length})</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>

        {myFiles.length > 0 ? (
          <div className="divide-y divide-surface-container-high">
            {myFiles.map((file) => {
              const statusColors = {
                'Sourced': 'bg-amber-100 text-amber-800 border-amber-200',
                'Verification': 'bg-blue-100 text-blue-800 border-blue-200',
                'DISCOM Registered': 'bg-purple-100 text-purple-800 border-purple-200',
                'Subsidized': 'bg-emerald-100 text-emerald-800 border-emerald-200'
              };

              return (
                <div key={file.id} className="p-4 hover:bg-surface-container-low transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-secondary uppercase">{file.id}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[file.status]}`}>
                        {file.status}
                      </span>
                      <span className="text-[11px] text-secondary font-medium">({file.discom})</span>
                    </div>
                    <div className="text-base font-bold text-on-surface">{file.customerName}</div>
                    <div className="text-xs text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        <a href={`tel:${file.phone}`} className="hover:underline text-primary font-medium">{file.phone}</a>
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-on-surface">{file.solarSystemKw} kW Solar</span>
                      <span>•</span>
                      <span className="truncate max-w-xs">{file.address}</span>
                    </div>
                  </div>

                  {/* Actions & Stage Progression */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={file.status}
                      onChange={(e) => updateFileStatus(file.id, e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-semibold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="Sourced">1. Sourced (लीड)</option>
                      <option value="Verification">2. Verification (सत्यापन)</option>
                      <option value="DISCOM Registered">3. DISCOM Registered (पोर्टल पर दर्ज)</option>
                      <option value="Subsidized">4. Subsidized (सब्सिडी स्वीकृत)</option>
                    </select>

                    <a
                      href={`https://wa.me/${file.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(file.customerName)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Officer')}%20from%20Sunvine%20Renewable%20regarding%20your%20${file.solarSystemKw}kW%20rooftop%20solar%20file.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg text-xs flex items-center justify-center transition-colors"
                      title="WhatsApp Customer"
                    >
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">folder_off</span>
            <p className="text-sm">You haven't registered any customer leads yet.</p>
            <button
              onClick={() => setActiveTab('staff_new_lead')}
              className="mt-3 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create First Customer Lead</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
