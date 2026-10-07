import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { APP_VERSION, RELEASE_DATE, CURRENT_RELEASE_CHANGELOG, VERSION_HISTORY } from '../../config/version';

export const CURRENT_APP_VERSION = `v${APP_VERSION}`;
const RELEASE_NOTIF_ID = `release-${APP_VERSION}`;

export default function AppUpdateModal() {
  const {
    addNotification,
    notifications,
    dismissedNotifIds,
    isChangelogModalOpen,
    setIsChangelogModalOpen,
    selectedChangelogVersion,
    setNotificationsOpen
  } = useApp();

  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'

  useEffect(() => {
    if (!addNotification) return;

    // Check if new version was deployed compared to installed version
    const installed = typeof window !== 'undefined' ? localStorage.getItem('sunvine_installed_version') : null;
    const isNewVersion = installed !== CURRENT_APP_VERSION;

    // If it's a new version, or current release notification is not present and not dismissed
    const alreadySeeded = notifications?.some(n => n.id === RELEASE_NOTIF_ID);
    const isDismissed = dismissedNotifIds?.includes(RELEASE_NOTIF_ID);

    if (typeof window !== 'undefined') {
      localStorage.setItem('sunvine_installed_version', CURRENT_APP_VERSION);
    }

    // Auto-update Service Worker in background
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addNotification, CURRENT_APP_VERSION]);

  if (!isChangelogModalOpen) return null;

  const displayChangelog = selectedChangelogVersion
    ? VERSION_HISTORY.find(v => v.version === selectedChangelogVersion) || CURRENT_RELEASE_CHANGELOG
    : CURRENT_RELEASE_CHANGELOG;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-primary-container/20 to-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">system_update</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="changelog-modal-title" className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Release Notes &amp; System Logs
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold tracking-wider uppercase">
                  {displayChangelog.version || CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5 truncate">
                {displayChangelog.title || 'Official Production Deployment'} • {displayChangelog.date || RELEASE_DATE}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsChangelogModalOpen(false)}
            aria-label="Close release notes"
            className="w-8 h-8 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab navigation */}
        <div className="px-5 pt-3 pb-2 border-b border-surface-container-high/60 bg-surface-container-lowest flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              Latest Deployment ({CURRENT_APP_VERSION})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              Version History
            </button>
          </div>
          <span className="hidden sm:inline text-[11px] text-secondary font-medium">
            Active: Gujarat EPC Engine
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-left font-sans">
          {activeTab === 'current' ? (
            <>
              {/* Highlights Banner */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Key Deployment Highlights
                </span>
                <ul className="space-y-1.5 text-xs text-on-surface">
                  {(CURRENT_RELEASE_CHANGELOG.highlights || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">check_circle</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Categorized Changes Breakdown */}
              {CURRENT_RELEASE_CHANGELOG.categories && (
                <div className="space-y-4">
                  {/* Features */}
                  {CURRENT_RELEASE_CHANGELOG.categories.features?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">new_releases</span>
                        New Features &amp; Capabilities
                      </h4>
                      <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500/30">
                        {CURRENT_RELEASE_CHANGELOG.categories.features.map((feat, idx) => (
                          <div key={idx} className="text-xs text-secondary leading-relaxed pl-2">
                            • {feat}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvements */}
                  {CURRENT_RELEASE_CHANGELOG.categories.improvements?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-sky-600">upgrade</span>
                        Enhancements &amp; UI Polish
                      </h4>
                      <div className="space-y-1.5 pl-2 border-l-2 border-sky-500/30">
                        {CURRENT_RELEASE_CHANGELOG.categories.improvements.map((imp, idx) => (
                          <div key={idx} className="text-xs text-secondary leading-relaxed pl-2">
                            • {imp}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fixes */}
                  {CURRENT_RELEASE_CHANGELOG.categories.fixes?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-600">bug_report</span>
                        Bug Fixes &amp; Stability
                      </h4>
                      <div className="space-y-1.5 pl-2 border-l-2 border-amber-500/30">
                        {CURRENT_RELEASE_CHANGELOG.categories.fixes.map((fix, idx) => (
                          <div key={idx} className="text-xs text-secondary leading-relaxed pl-2">
                            • {fix}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Historical Releases */
            <div className="space-y-4">
              {VERSION_HISTORY.map((hist, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-surface-container-high bg-surface-container-lowest space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-on-surface">{hist.version}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-surface-container text-secondary">
                        {hist.type || 'RELEASE'}
                      </span>
                    </div>
                    <span className="text-[11px] text-secondary font-medium">{hist.date}</span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">{hist.summary}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {hist.highlights?.map((hl, hIdx) => (
                      <span key={hIdx} className="px-2 py-0.5 rounded bg-surface-container-low text-[10px] text-secondary">
                        {hl}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-surface-container-high bg-surface-container-low/50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsChangelogModalOpen(false);
              setNotificationsOpen?.(true);
            }}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">notifications</span>
            <span>View All Notifications</span>
          </button>

          <button
            type="button"
            onClick={() => setIsChangelogModalOpen(false)}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
