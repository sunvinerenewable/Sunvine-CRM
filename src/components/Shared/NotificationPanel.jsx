import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { APP_VERSION } from '../../config/version';

export default function NotificationPanel({
  isOpen,
  onClose,
  desktopTriggerRef,
  mobileTriggerRef
}) {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    setActiveTab,
    setIsChangelogModalOpen,
    openChangelogModal
  } = useApp();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const panelRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Robust Outside-Click Detection (Prevents false closes on internal clicks/scrolls)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      // 1. Ignore if clicked inside desktop or mobile trigger buttons
      if (
        desktopTriggerRef?.current?.contains(event.target) ||
        mobileTriggerRef?.current?.contains(event.target)
      ) {
        return;
      }

      // 2. Check if event path or panelRef contains the click target
      const path = event.composedPath ? event.composedPath() : [];
      if (
        (panelRef.current && panelRef.current.contains(event.target)) ||
        (panelRef.current && path.includes(panelRef.current))
      ) {
        return; // Click happened inside panel, keep open!
      }

      // 3. Click was truly outside panel and triggers
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose, desktopTriggerRef, mobileTriggerRef]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'unread') return !item.read;
    return true;
  });

  const isReleaseNotif = (notif) => {
    return Boolean(
      notif.isRelease ||
      notif.id?.startsWith('release-') ||
      notif.icon === 'system_update' ||
      notif.title?.toLowerCase().includes('version') ||
      notif.title?.toLowerCase().includes('updated to')
    );
  };

  const handleOpenReleaseLogs = (e, notif) => {
    e?.stopPropagation?.();
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (openChangelogModal) {
      openChangelogModal(notif.version || null);
    } else if (setIsChangelogModalOpen) {
      setIsChangelogModalOpen(true);
    }
  };

  // Clicking card marks as read; for release notifications, opens release logs
  const handleCardClick = (notif) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (isReleaseNotif(notif)) {
      if (openChangelogModal) {
        openChangelogModal(notif.version || null);
      } else if (setIsChangelogModalOpen) {
        setIsChangelogModalOpen(true);
      }
    }
  };

  // Clicking explicit "View details" button navigates and closes
  const handleNavigate = (e, notif) => {
    e.stopPropagation();
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (notif.targetTab) {
      setActiveTab(notif.targetTab);
      onClose();
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-600',
          icon: 'check_circle'
        };
      case 'warning':
        return {
          badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
          icon: 'warning'
        };
      case 'alert':
        return {
          badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
          dot: 'bg-rose-600',
          icon: 'cancel'
        };
      case 'info':
      default:
        return {
          badge: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
          dot: 'bg-sky-500',
          icon: 'info'
        };
    }
  };

  const formatTime = (notif) => {
    if (notif.timestamp) return notif.timestamp;
    if (!notif.createdAt) return 'Recently';
    try {
      const diffMs = Date.now() - new Date(notif.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return 'Recently';
    }
  };

  const getTargetTabLabel = (targetTab) => {
    switch (targetTab) {
      case 'my_quotes':
        return 'View Quotations';
      case 'all_quotes':
        return 'View All Proposals';
      case 'pricing_master':
        return 'View Tariff & Presets';
      case 'dealers_mgmt':
        return 'View Partner Network';
      case 'dealer_settings':
        return 'View Margin Settings';
      case 'profile':
        return 'View Profile & KYC';
      case 'hardware_master':
        return 'View Hardware Catalog';
      case 'dashboard':
      default:
        return 'Open Details';
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (Dimmed background for native bottom sheet) */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[80] md:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Notification Container:
          - Mobile: Bottom sheet sliding up from bottom
          - Desktop: Anchored dropdown sitting cleanly below the bell icon */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications panel"
        className="
          fixed inset-x-0 bottom-0 z-[90] max-h-[85vh] sm:max-h-[88vh] rounded-t-3xl bg-surface-container-lowest shadow-2xl border-t border-surface-container-high flex flex-col animate-in slide-in-from-bottom duration-300 select-none text-left
          md:fixed md:inset-auto md:top-16 md:right-6 md:bottom-auto md:w-[420px] md:max-h-[600px] md:rounded-2xl md:border md:shadow-[0_16px_48px_rgba(0,0,0,0.14)] md:animate-in md:fade-in md:slide-in-from-top-2 md:duration-200
        "
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-surface-container-high mx-auto mt-2.5 mb-1 shrink-0 md:hidden" />

        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-surface-container-high/80 bg-surface/80 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[19px]">notifications</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface tracking-tight truncate">
                Notifications
              </h3>
              {unreadNotificationsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold whitespace-nowrap">
                  {unreadNotificationsCount} new
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (openChangelogModal) openChangelogModal();
                  else if (setIsChangelogModalOpen) setIsChangelogModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6CBF3D]/15 hover:bg-[#6CBF3D]/25 text-[#4F9A2C] dark:text-[#8AE256] text-[10px] font-bold tracking-tight transition-colors cursor-pointer border border-[#6CBF3D]/30"
                title="View latest deployment release notes and system changelog"
              >
                <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                <span className="hidden sm:inline">v{APP_VERSION} Logs</span>
                <span className="sm:hidden">v{APP_VERSION}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container hover:bg-primary/10 transition-colors px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                title="Mark all notifications as read"
              >
                <span className="material-symbols-outlined text-[15px]">done_all</span>
                <span className="hidden xs:inline">Mark all read</span>
                <span className="xs:hidden">Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close notifications panel"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Quick Actions Bar */}
        <div className="px-4 py-2 border-b border-surface-container-high/60 bg-surface-container-low/40 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center bg-surface-container-high/50 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                activeFilter === 'all'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-bold'
                  : 'text-secondary hover:text-on-surface font-medium'
              }`}
            >
              <span>All</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  activeFilter === 'all'
                    ? 'bg-surface-container text-on-surface'
                    : 'bg-surface-container-high/70 text-secondary'
                }`}
              >
                {notifications.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                activeFilter === 'unread'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                  : 'text-secondary hover:text-on-surface font-medium'
              }`}
            >
              <span>Unread</span>
              {unreadNotificationsCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeFilter === 'unread'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAllNotifications}
              className="text-[11px] text-secondary hover:text-error font-medium transition-colors px-2 py-1 rounded-md hover:bg-error-container/20 cursor-pointer whitespace-nowrap flex items-center gap-1"
              title="Clear all notifications"
            >
              <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
              <span>Clear all</span>
            </button>
          )}
        </div>

        {/* Scrollable Notifications Card List */}
        <div
          className="flex-1 max-h-[calc(85vh-175px)] md:max-h-[430px] overflow-y-auto p-3 sm:p-3.5 space-y-2.5"
          style={{ scrollbarGutter: 'stable' }}
        >
          {filteredNotifications.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high text-secondary flex items-center justify-center mb-3 shadow-xs">
                <span className="material-symbols-outlined text-[26px]">
                  {activeFilter === 'unread' ? 'mark_email_read' : 'notifications_off'}
                </span>
              </div>
              <p className="font-headline-sm text-sm font-semibold text-on-surface">
                {activeFilter === 'unread' ? "You're all caught up" : 'No notifications yet'}
              </p>
              <p className="font-body-sm text-xs text-secondary mt-1 max-w-[260px] leading-relaxed">
                {activeFilter === 'unread'
                  ? 'No unread notifications right now. All alerts and proposals are up to date.'
                  : 'Quotation approvals, DISCOM regulatory updates, and team alerts will appear here.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const typeStyle = getTypeStyles(notif.type);
              return (
                <div
                  key={notif.id}
                  onClick={() => handleCardClick(notif)}
                  className={`group relative rounded-xl p-3 sm:p-3.5 border transition-all duration-150 cursor-pointer flex items-start gap-3 ${
                    !notif.read
                      ? 'bg-primary/4 border-primary/25 hover:bg-primary/8 hover:border-primary/40 shadow-xs'
                      : 'bg-surface-container-lowest border-surface-container-high/60 hover:bg-surface-container-low hover:border-surface-container-high shadow-xs'
                  }`}
                >
                  {/* Left Accent Bar for Unread */}
                  {!notif.read && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-primary rounded-r-full"></span>
                  )}

                  {/* Type Icon Badge */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${typeStyle.badge} mt-0.5 shadow-xs`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {notif.icon || typeStyle.icon}
                    </span>
                  </div>

                  {/* Notification Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-xs sm:text-sm leading-snug break-words ${
                          !notif.read ? 'font-bold text-on-surface' : 'font-semibold text-on-surface/85'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] sm:text-[11px] text-secondary font-medium whitespace-nowrap shrink-0 mt-0.5">
                        {formatTime(notif)}
                      </span>
                    </div>

                    <p className="text-xs text-secondary leading-relaxed break-words mt-1">
                      {notif.description}
                    </p>

                    {/* Bottom Action Footer Row inside Card */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-surface-container-high/40">
                      {isReleaseNotif(notif) ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenReleaseLogs(e, notif)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#6CBF3D]/15 hover:bg-[#6CBF3D]/25 text-[#4F9A2C] dark:text-[#8AE256] text-[11px] font-bold transition-all cursor-pointer truncate min-w-0 border border-[#6CBF3D]/30 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[14px] shrink-0">receipt_long</span>
                          <span className="truncate">View Release Logs</span>
                        </button>
                      ) : notif.targetTab ? (
                        <button
                          type="button"
                          onClick={(e) => handleNavigate(e, notif)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-container transition-colors cursor-pointer group-hover:underline truncate min-w-0"
                        >
                          <span className="truncate">{getTargetTabLabel(notif.targetTab)}</span>
                          <span className="material-symbols-outlined text-[13px] shrink-0">arrow_forward</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-secondary/60 font-medium">System Alert</span>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.read && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            title="Unread notification"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            <span>New</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            deleteNotification(notif.id);
                          }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-secondary hover:text-error hover:bg-error-container/20 transition-all cursor-pointer z-10"
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-4 py-2.5 border-t border-surface-container-high/80 bg-surface-container-low/60 flex items-center justify-between text-secondary font-label-xs text-[11px] shrink-0 rounded-b-2xl pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></span>
            <span className="font-semibold text-on-surface">DISCOM &amp; Partner Rates Active</span>
          </div>
          <span className="text-secondary opacity-75 hidden md:inline">Press Esc to close</span>
        </div>
      </div>
    </>
  );
}
