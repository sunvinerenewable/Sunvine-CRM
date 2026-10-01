import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { quotationService } from '../../services/quotationService';
import PDFTemplate from './PDFTemplate';
import { 
  openWhatsAppChat, 
  shareQuotationPdfViaWhatsApp, 
  buildProposalWhatsAppMessage, 
  cleanCustomerPhone,
  getPublicProposalUrl
} from '../../utils/quotationShare';
import { useToast } from '../Shared/Toast';

export default function QuotationPreview({
  isPublicView = false,
  publicQuoteId = null,
  quotation: propQuotation = null,
  isLoadingProp = false
}) {
  const appContext = useApp() || {};
  const previewQuotation = propQuotation || appContext.previewQuotation;
  const quotations = appContext.quotations || [];
  const pricingMaster = appContext.pricingMaster;
  const setActiveTab = appContext.setActiveTab || (() => {});
  const role = appContext.role;
  const { addToast } = useToast();
  const [activePage, setActivePage] = useState('all'); // 'all' | 1 | 2 | 3 | 4
  const [baseScale, setBaseScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [copiedLinkFeedback, setCopiedLinkFeedback] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [remoteFetchedQuote, setRemoteFetchedQuote] = useState(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const baseWidth = 794;
  const pageCount = activePage === 'all' ? 4 : 1;
  const baseHeight = pageCount === 4 ? (1123 * 4 + 32 * 3) : 1123;

  const previewWrapperRef = useRef(null);
  const pdfScrollContainerRef = useRef(null);
  const sizerRef = useRef(null);
  const contentRef = useRef(null);
  const pdfExportRef = useRef(null);
  const userZoomRef = useRef(userZoom);
  const baseScaleRef = useRef(baseScale);
  const isPinchingRef = useRef(false);
  const pinchStateRef = useRef({ startDist: 0, startZoom: 1, docX: 0, docY: 0, lastMidX: 0, lastMidY: 0 });

  // Asynchronously hydrate quotation from Supabase only in portal view without props
  useEffect(() => {
    if (propQuotation || isLoadingProp !== undefined) return;
    if (isPublicView && publicQuoteId && !remoteFetchedQuote) {
      const cleanId = String(publicQuoteId).trim().toLowerCase();
      const foundInLocal = (quotations || []).some(
        q => String(q.id || '').trim().toLowerCase() === cleanId ||
             String(q.quoteId || '').trim().toLowerCase() === cleanId
      );

      if (!foundInLocal) {
        let isMounted = true;
        setIsLoadingRemote(true);
        quotationService.getQuotationById(publicQuoteId).then(quote => {
          if (isMounted && quote) {
            setRemoteFetchedQuote(quote);
          }
        }).catch(err => {
          console.warn('Failed to fetch remote quote:', err);
        }).finally(() => {
          if (isMounted) setIsLoadingRemote(false);
        });
        return () => { isMounted = false; };
      }
    }
  }, [isPublicView, publicQuoteId, quotations, remoteFetchedQuote, propQuotation, isLoadingProp]);

  // Resolve active quotation: priority to prop, remote fetched, publicQuoteId, then state
  const activeQuotation = useMemo(() => {
    if (propQuotation) return propQuotation;
    if (isPublicView) {
      if (remoteFetchedQuote) return remoteFetchedQuote;

      if (publicQuoteId) {
        const cleanId = String(publicQuoteId).trim().toLowerCase();
        // 1. Search in current state / localStorage quotations
        const foundInState = quotations?.find(
          q => String(q.id || '').trim().toLowerCase() === cleanId ||
               String(q.quoteId || '').trim().toLowerCase() === cleanId ||
               String(q.quotationNo || '').trim().toLowerCase() === cleanId
        );
        if (foundInState) return foundInState;

        // 2. Fallback to URL encoded data payload if provided
        if (typeof window !== 'undefined') {
          try {
            const dataParam = new URLSearchParams(window.location.search).get('data');
            if (dataParam) {
              const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
              if (decoded) return decoded;
            }
          } catch (_) {}
        }
        return null; // Explicit ID provided, waiting or not found
      }
      return previewQuotation || null;
    }
    return previewQuotation;
  }, [propQuotation, isPublicView, publicQuoteId, quotations, previewQuotation, remoteFetchedQuote]);

  // Initialize phone when quotation changes
  useEffect(() => {
    if (activeQuotation) {
      setTargetPhone(activeQuotation.customerPhone || activeQuotation.mobile || '+91 98250 12345');
    }
  }, [activeQuotation]);

  // Guarantee view always starts at the absolute top of the proposal on all devices (mobile, tablet, desktop)
  useEffect(() => {
    const scrollToTop = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
        if (previewWrapperRef.current) previewWrapperRef.current.scrollTop = 0;
        if (pdfScrollContainerRef.current) pdfScrollContainerRef.current.scrollTop = 0;
      }
    };

    scrollToTop();

    // Re-verify after layout scale calculation and image stabilization
    const t1 = setTimeout(scrollToTop, 20);
    const t2 = setTimeout(scrollToTop, 100);
    const t3 = setTimeout(scrollToTop, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeQuotation?.id, activeQuotation]);

  // Sync refs with state
  useEffect(() => {
    userZoomRef.current = userZoom;
  }, [userZoom]);

  useEffect(() => {
    baseScaleRef.current = baseScale;
  }, [baseScale]);

  // Reset zoom level whenever active quotation changes
  useEffect(() => {
    setUserZoom(1);
    userZoomRef.current = 1;
  }, [activeQuotation?.id]);

  // Compute responsive base scale for screens narrower than standard A4 (794px)
  useEffect(() => {
    const calculateScale = () => {
      if (!previewWrapperRef.current) return;
      const clientW = previewWrapperRef.current.clientWidth || window.innerWidth;
      const paddingAllowance = window.innerWidth < 640 ? 16 : 32;
      const available = Math.min(clientW, window.innerWidth - paddingAllowance);
      if (available < 794) {
        setBaseScale(available / 794);
      } else {
        setBaseScale(1);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Focal-point zoom helper: zooms into an exact screen coordinate rather than top-left
  const zoomAroundPoint = (targetZoom, screenX, screenY) => {
    const clampedZoom = Math.min(Math.max(Number(targetZoom.toFixed(2)), 0.65), 3.5);
    const prevZoom = userZoomRef.current;
    if (clampedZoom === prevZoom) return;

    const sizer = sizerRef.current;
    if (sizer) {
      const sizerRect = sizer.getBoundingClientRect();
      const currentScale = baseScaleRef.current * prevZoom;
      const docX = (screenX - sizerRect.left) / currentScale;
      const docY = (screenY - sizerRect.top) / currentScale;
      const newScale = baseScaleRef.current * clampedZoom;

      const newWidth = Math.round(baseWidth * newScale);
      const newHeight = Math.round(baseHeight * newScale);
      sizer.style.width = `${newWidth}px`;
      sizer.style.height = `${newHeight}px`;
      if (contentRef.current) {
        contentRef.current.style.transform = `scale(${newScale})`;
      }

      const sizerRectAfter = sizer.getBoundingClientRect();
      const targetScreenX = sizerRectAfter.left + docX * newScale;
      const targetScreenY = sizerRectAfter.top + docY * newScale;
      const shiftX = targetScreenX - screenX;
      const shiftY = targetScreenY - screenY;

      if (pdfScrollContainerRef.current && shiftX !== 0) {
        pdfScrollContainerRef.current.scrollLeft += shiftX;
      }
      if (shiftY !== 0) {
        window.scrollBy({ top: shiftY, left: 0, behavior: 'instant' });
      }

      userZoomRef.current = clampedZoom;
      setUserZoom(clampedZoom);
    } else {
      userZoomRef.current = clampedZoom;
      setUserZoom(clampedZoom);
    }
  };

  const handleResetZoom = () => {
    setUserZoom(1);
    userZoomRef.current = 1;
    if (sizerRef.current) {
      const resetWidth = Math.round(baseWidth * baseScaleRef.current);
      const resetHeight = Math.round(baseHeight * baseScaleRef.current);
      sizerRef.current.style.width = `${resetWidth}px`;
      sizerRef.current.style.height = `${resetHeight}px`;
    }
    if (contentRef.current) {
      contentRef.current.style.transform = `scale(${baseScaleRef.current})`;
    }
    if (pdfScrollContainerRef.current) {
      pdfScrollContainerRef.current.scrollLeft = 0;
    }
  };

  // 2-Finger Focal-Point Pinch Zoom (Pure GPU Accelerated, iOS Safari Flutter-Free), Trackpad Pinch, and Double-Tap
  useEffect(() => {
    const el = pdfScrollContainerRef.current;
    if (!el) return;

    let lastTapTime = 0;

    // Prevent iOS Safari native page-zoom fighting with our custom PDF pinch zoom
    const preventSafariGesture = (e) => {
      e.preventDefault();
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const sizer = sizerRef.current;
        if (!sizer) return;
        const sizerRect = sizer.getBoundingClientRect();
        const startScale = baseScaleRef.current * userZoomRef.current;

        // Position of touch midpoint on unscaled document
        const docX = (midX - sizerRect.left) / startScale;
        const docY = (midY - sizerRect.top) / startScale;

        pinchStateRef.current = {
          startDist: dist,
          startZoom: userZoomRef.current,
          startScale,
          sizerLeft: sizerRect.left,
          sizerTop: sizerRect.top,
          startMidX: midX,
          startMidY: midY,
          docX,
          docY,
          currentScale: startScale,
          currentTx: 0,
          currentTy: 0,
          currentZoom: userZoomRef.current,
        };

        if (contentRef.current) {
          contentRef.current.style.willChange = 'transform';
          contentRef.current.style.transition = 'none';
        }
        if (sizerRef.current) {
          sizerRef.current.style.transition = 'none';
        }

        setIsPinching(true);
        isPinchingRef.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchStateRef.current.startDist > 0) {
        if (e.cancelable) e.preventDefault();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;

        const { startDist, startZoom, sizerLeft, sizerTop, docX, docY } = pinchStateRef.current;
        const factor = dist / startDist;
        const newZoom = Math.min(Math.max(startZoom * factor, 0.65), 3.5);
        const newScale = baseScaleRef.current * newZoom;

        // Calculate translation offset to keep focal point anchored directly under fingers
        const tx = (midX - sizerLeft) - (docX * newScale);
        const ty = (midY - sizerTop) - (docY * newScale);

        pinchStateRef.current.currentScale = newScale;
        pinchStateRef.current.currentTx = tx;
        pinchStateRef.current.currentTy = ty;
        pinchStateRef.current.currentZoom = newZoom;

        // Hardware-accelerated GPU transform without layout reflow (zero fluctuation on iOS)
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${newScale})`;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        if (isPinchingRef.current) {
          setIsPinching(false);
          isPinchingRef.current = false;
          pinchStateRef.current.startDist = 0;

          const { currentScale, currentTx, currentTy, currentZoom } = pinchStateRef.current;
          const finalScale = currentScale || (baseScaleRef.current * userZoomRef.current);
          const finalZoom = Number((currentZoom || userZoomRef.current).toFixed(2));
          const tx = currentTx || 0;
          const ty = currentTy || 0;

          // Absorb temporary GPU translate into natural scroll offsets
          if (pdfScrollContainerRef.current && tx !== 0) {
            pdfScrollContainerRef.current.scrollLeft = Math.max(0, pdfScrollContainerRef.current.scrollLeft - tx);
          }
          if (ty !== 0) {
            window.scrollBy({ top: -ty, left: 0, behavior: 'instant' });
          }

          // Reset GPU transform back to pure scale with top-left origin
          if (contentRef.current) {
            contentRef.current.style.willChange = 'auto';
            contentRef.current.style.transform = `scale(${finalScale})`;
          }
          if (sizerRef.current) {
            sizerRef.current.style.width = `${Math.round(baseWidth * finalScale)}px`;
            sizerRef.current.style.height = `${Math.round(baseHeight * finalScale)}px`;
          }

          userZoomRef.current = finalZoom;
          setUserZoom(finalZoom);
        }
      }

      // Handle double-tap to toggle zoom at tap coordinates
      if (e.changedTouches.length === 1 && e.touches.length === 0) {
        const now = Date.now();
        if (now - lastTapTime < 320) {
          const tapX = e.changedTouches[0].clientX;
          const tapY = e.changedTouches[0].clientY;
          if (userZoomRef.current > 1.25) {
            handleResetZoom();
          } else {
            zoomAroundPoint(1.8, tapX, tapY);
          }
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      }
    };

    const onTouchCancel = () => {
      if (isPinchingRef.current) {
        setIsPinching(false);
        isPinchingRef.current = false;
        pinchStateRef.current.startDist = 0;
        if (contentRef.current) {
          contentRef.current.style.willChange = 'auto';
          contentRef.current.style.transform = `scale(${baseScaleRef.current * userZoomRef.current})`;
        }
      }
    };

    // Trackpad 2-finger pinch (wheel with ctrlKey)
    const onWheel = (e) => {
      if (e.ctrlKey) {
        if (e.cancelable) e.preventDefault();
        const cursorX = e.clientX;
        const cursorY = e.clientY;
        const delta = -e.deltaY * 0.005;
        const newZoom = userZoomRef.current + delta;
        zoomAroundPoint(newZoom, cursorX, cursorY);
      }
      // Standard mouse wheel scrolling is completely unblocked for smooth native page scrolling
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    el.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    el.addEventListener('gestureend', preventSafariGesture, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', preventSafariGesture);
      el.removeEventListener('gesturechange', preventSafariGesture);
      el.removeEventListener('gestureend', preventSafariGesture);
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDirectWhatsAppFast = () => {
    if (!activeQuotation) return;
    openWhatsAppChat(activeQuotation, targetPhone);
  };

  const handleShareWhatsAppWithPDF = async () => {
    if (!activeQuotation) return;
    setIsGeneratingPdf(true);
    setStatusNotice('Generating official 4-Page PDF proposal...');
    try {
      const res = await shareQuotationPdfViaWhatsApp(
        activeQuotation,
        pdfExportRef.current,
        targetPhone
      );
      if (res?.method === 'native_file_share') {
        setStatusNotice('Official PDF shared to WhatsApp!');
      } else if (res?.method === 'download_and_chat') {
        setStatusNotice(`Official PDF downloaded (${res.fileName})! WhatsApp Web opened. Attach using the 📎 paperclip or drag-and-drop into chat.`);
      }
    } catch (err) {
      console.error(err);
      openWhatsAppChat(activeQuotation, targetPhone);
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setStatusNotice(''), 6000);
    }
  };

  const handleCopyMessage = () => {
    if (!activeQuotation) return;
    const msg = buildProposalWhatsAppMessage(activeQuotation);
    navigator.clipboard.writeText(msg);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  const handleCopyOnlineLink = async () => {
    if (!activeQuotation) return;
    quotationService.saveQuotation(activeQuotation).catch(() => {});
    const url = getPublicProposalUrl(activeQuotation.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkFeedback(true);
      setTimeout(() => setCopiedLinkFeedback(false), 2500);
      if (addToast) {
        addToast({
          title: 'Online Link Copied!',
          message: `Customer online proposal URL copied to clipboard: ${url}`,
          type: 'success'
        });
      }
    } catch (e) {}
  };

  const handleOpenOnlineView = () => {
    if (!activeQuotation) return;
    quotationService.saveQuotation(activeQuotation).catch(() => {});
    const url = getPublicProposalUrl(activeQuotation.id);
    window.open(url, '_blank');
  };

  if (isLoadingRemote || isLoadingProp) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container-high">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[28px] animate-spin">sync</span>
        </div>
        <h3 className="text-base font-bold text-on-surface mb-1">Loading Solar Proposal...</h3>
        <p className="text-xs text-secondary">
          Retrieving verified proposal <span className="font-mono font-semibold text-on-surface">{publicQuoteId || ''}</span>
        </p>
      </div>
    );
  }

  if (!activeQuotation) {
    if (isPublicView) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-8 text-center bg-surface-container-lowest rounded-2xl shadow-md border border-surface-container-high">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[36px]">description</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">Proposal Not Found or Expired</h3>
          <p className="text-sm text-secondary mb-6 max-w-md mx-auto leading-relaxed">
            We could not locate quotation reference <span className="font-mono font-bold text-on-surface">{publicQuoteId || 'N/A'}</span>. The proposal link may have expired or is unavailable.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:+918000050580"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow-sm hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              <span>Call Helpline: +91 80000 50580</span>
            </a>
            <a
              href={`https://api.whatsapp.com/send?phone=918000050580&text=${encodeURIComponent(`Hello Sunvine Team, I was trying to open proposal link ${publicQuoteId || ''} but it is showing not found.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] text-white font-semibold text-xs shadow-sm hover:bg-[#1EBE5B] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high">
        <span className="material-symbols-outlined text-[48px] text-amber-500 mx-auto mb-3 block">warning</span>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-1">No Quotation Selected</h3>
        <p className="font-body-md text-secondary mb-4">Please generate a quotation or pick one from your quotation directory.</p>
        <button
          onClick={() => setActiveTab('create_quote')}
          className="px-4 py-2 bg-primary-container text-on-primary font-label-md rounded-lg shadow-sm hover:bg-primary"
        >
          Create New Quotation
        </button>
      </div>
    );
  }

  // Total effective scale combining screen fit and user 2-finger pinch zoom
  const totalScale = baseScale * userZoom;
  const sizerWidth = Math.round(baseWidth * totalScale);
  const sizerHeight = Math.round(baseHeight * totalScale);

  return (
    <div className="quotation-preview-container pb-20 print:p-0 print:m-0 print:pb-0 w-full" ref={previewWrapperRef}>
      {/* Unified Edge-to-Edge Sticky Header: Pinned directly beneath global navbar with zero left/right empty space */}
      <div className={`no-print sticky ${isPublicView ? 'top-0' : 'top-16'} z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-all`}>
        {/* Main Header Bar: Back/Brand, Customer Info, Stepper Pipeline, Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Top/Left: Back / Brand Badge + Customer Info */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 w-full sm:w-auto">
            {!isPublicView ? (
              <button
                onClick={() => setActiveTab('create_quote')}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs hover:border-slate-300 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Return to Details & Pricing"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold shrink-0">
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-emerald-600">solar_power</span>
                <span className="hidden sm:inline">Sunvine Solar Proposal</span>
                <span className="sm:hidden">Sunvine Solar</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h2 className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate">
                  {activeQuotation.customerName}
                </h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-emerald-100/80 text-emerald-800 border border-emerald-300/60 shrink-0">
                  {activeQuotation.systemCapacityKW || activeQuotation.capacity || '5'} KW
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium font-mono mt-0.5 truncate">
                Ref: <span className="font-bold text-slate-700">{activeQuotation.id}</span> • {activeQuotation.date}
              </p>
            </div>
          </div>

          {/* Center: Stepper Stage Pipeline (Only in Dealer Mode on Desktop) */}
          {!isPublicView && (
            <div className="hidden lg:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('create_quote')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/80 font-semibold text-xs transition-all cursor-pointer"
                title="Go back to Step 1: Details & Pricing"
              >
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span>Details &amp; Pricing</span>
              </button>
              <div className="w-4 h-0.5 bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-slate-900 font-bold text-xs shadow-xs border border-slate-200/60">
                <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </span>
                <span>Preview &amp; Send</span>
                <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* Right/Bottom: Primary Action Buttons (Grid on Mobile, Flex on Desktop) */}
          <div className={`${isPublicView ? 'grid grid-cols-2' : 'grid grid-cols-3'} sm:flex sm:items-center gap-1.5 sm:gap-2.5 w-full sm:w-auto shrink-0`}>
            {!isPublicView ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyOnlineLink}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer min-w-0"
                  title="Copy direct online proposal link to share with customer"
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[17px] shrink-0">
                    {copiedLinkFeedback ? 'check' : 'link'}
                  </span>
                  <span className="truncate">{copiedLinkFeedback ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenOnlineView}
                  className="hidden md:inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  title="View Proposal online as customer in a new tab"
                >
                  <span className="material-symbols-outlined text-[17px]">open_in_new</span>
                  <span>View Online</span>
                </button>

                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5B] text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer min-w-0"
                  title="Share proposal on WhatsApp (sends actual PDF file + online link)"
                >
                  <span className={`material-symbols-outlined text-[16px] sm:text-[18px] shrink-0 ${isGeneratingPdf ? 'animate-spin' : ''}`}>
                    {isGeneratingPdf ? 'sync' : 'chat'}
                  </span>
                  <span className="truncate">
                    {isGeneratingPdf ? 'PDF...' : (
                      <>
                        <span className="sm:hidden">WhatsApp</span>
                        <span className="hidden sm:inline">Share WhatsApp</span>
                      </>
                    )}
                  </span>
                </button>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl bg-[#0F1B2E] hover:bg-[#1A2C47] text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer min-w-0"
                  title="Print or Save as 4-Page PDF"
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] shrink-0">print</span>
                  <span className="truncate">
                    <span className="sm:hidden">PDF</span>
                    <span className="hidden sm:inline">Print / Save PDF</span>
                  </span>
                </button>
              </>
            ) : (
              <>
                <a
                  href={`https://api.whatsapp.com/send?phone=918000050580&text=${encodeURIComponent(`Hello Sunvine Team, I am inquiring about Proposal Reference ${activeQuotation.id} for ${activeQuotation.customerName}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5B] text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer min-w-0"
                  title="Inquire via WhatsApp"
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] shrink-0">chat</span>
                  <span className="truncate">WhatsApp Advisor</span>
                </a>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#0F1B2E] hover:bg-[#1A2C47] text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer min-w-0"
                  title="Print or Save as 4-Page PDF"
                >
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] shrink-0">print</span>
                  <span className="truncate">
                    <span className="sm:hidden">Download PDF</span>
                    <span className="hidden sm:inline">Download Official PDF</span>
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PDF Container with Responsive Scaling, 2-Finger Pinch Zoom & Pan Viewport */}
      <div
        ref={pdfScrollContainerRef}
        className={`w-full max-w-full ${userZoom > 1.05 ? 'overflow-x-auto' : 'overflow-x-visible'} overflow-y-visible py-3 sm:py-4 px-2 sm:px-4 print:p-0 print:m-0`}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: isPinching ? 'none' : 'auto',
          overscrollBehavior: 'auto'
        }}
      >
        <div
          ref={sizerRef}
          className="pdf-scalable-viewport mx-auto print:!w-auto print:!h-auto print:!m-0"
          style={{
            width: `${sizerWidth}px`,
            height: `${sizerHeight}px`,
            marginLeft: 'auto',
            marginRight: 'auto',
            position: 'relative',
          }}
        >
          <div
            ref={contentRef}
            style={{
              width: `${baseWidth}px`,
              transform: `scale(${totalScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            className="print:!w-auto print:!transform-none print:!static"
          >
            <PDFTemplate quotation={activeQuotation} pricingMaster={pricingMaster} activePage={activePage} />
          </div>
        </div>
      </div>

      {/* Off-Screen Full 4-Page Template for PDF file generation (Hidden on print) */}
      <div
        className="no-print"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '794px',
          background: '#ffffff',
          pointerEvents: 'none'
        }}
      >
        <div ref={pdfExportRef}>
          <PDFTemplate quotation={activeQuotation} pricingMaster={pricingMaster} activePage="all" />
        </div>
      </div>

      {/* WhatsApp Share Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-surface-container-high relative">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2 text-[#25D366]">
                <span className="material-symbols-outlined text-[26px]">chat</span>
                <h3 className="font-headline-sm text-base font-bold text-on-surface">Share Proposal with PDF on WhatsApp</h3>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Direct Customer Proposal URL Box */}
              <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    Online Proposal Link (Portable)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyOnlineLink}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copiedLinkFeedback ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedLinkFeedback ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenOnlineView}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>Open</span>
                    </button>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-blue-800 bg-white/90 p-2 rounded-lg border border-blue-200 truncate select-all">
                  {getPublicProposalUrl(activeQuotation.id)}
                </div>
              </div>

              {/* Customer Phone Input */}
              <div>
                <label className="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1.5">
                  Customer WhatsApp Mobile Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-semibold text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    +91
                  </span>
                  <input
                    type="text"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full h-11 pl-14 pr-4 bg-surface-container-low border border-surface-container-high rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                  />
                </div>
                <p className="text-[11px] text-secondary mt-1">
                  On mobile: WhatsApp will open with the official PDF file attached! On desktop: PDF is downloaded automatically and chat opens with message pre-filled.
                </p>
              </div>

              {/* Message Preview Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    Message Preview
                  </label>
                  <button
                    onClick={handleCopyMessage}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedFeedback ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedFeedback ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="bg-[#EFEAE2] p-3 rounded-xl border border-[#D1D7DB] text-xs font-sans text-[#111B21] max-h-48 overflow-y-auto whitespace-pre-line leading-relaxed shadow-inner">
                  {buildProposalWhatsAppMessage(activeQuotation)}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-surface-container flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                onClick={() => {
                  handleDirectWhatsAppFast();
                  setShowWhatsAppModal(false);
                }}
                className="text-xs font-semibold text-secondary hover:text-on-surface px-2 py-1 text-left sm:text-center"
              >
                Fast Link (Text Only)
              </button>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleShareWhatsAppWithPDF();
                    setShowWhatsAppModal(false);
                  }}
                  disabled={isGeneratingPdf}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5B] text-white font-label-md text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isGeneratingPdf ? 'animate-spin' : ''}`}>
                    {isGeneratingPdf ? 'sync' : 'send'}
                  </span>
                  <span>{isGeneratingPdf ? 'Generating PDF...' : 'Share PDF & Message'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating 2-Finger Pinch Zoom Indicator & Controller */}
      <div className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-white shadow-2xl backdrop-blur-md border border-white/15 text-xs font-semibold select-none transition-all">
        <button
          type="button"
          onClick={() => zoomAroundPoint(userZoom - 0.2, window.innerWidth / 2, window.innerHeight / 2)}
          disabled={userZoom <= 0.7}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          title="Zoom Out"
        >
          <span className="material-symbols-outlined text-[17px]">remove</span>
        </button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="px-2.5 py-0.5 rounded-md hover:bg-white/15 transition-all text-center min-w-[52px] cursor-pointer"
          title="Click to reset zoom to 100%"
        >
          <span className="font-mono font-bold text-[12px]">{Math.round(userZoom * 100)}%</span>
        </button>

        <button
          type="button"
          onClick={() => zoomAroundPoint(userZoom + 0.2, window.innerWidth / 2, window.innerHeight / 2)}
          disabled={userZoom >= 3.4}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          title="Zoom In"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>
        </button>

        {Math.abs(userZoom - 1) > 0.05 && (
          <>
            <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
            <button
              type="button"
              onClick={handleResetZoom}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-[11px] font-bold text-white transition-all cursor-pointer shadow-xs"
              title="Reset to Screen Fit"
            >
              <span className="material-symbols-outlined text-[14px]">fit_screen</span>
              <span>Fit</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

