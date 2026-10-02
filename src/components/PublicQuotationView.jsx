import React, { useState, useEffect } from 'react';
import { quotationService } from '../services/quotationService';
import QuotationPreview from './DealerPortal/QuotationPreview';

function decodeQuotationData(dataParam) {
  if (!dataParam) return null;
  try {
    const raw = dataParam.replace(/ /g, '+');
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {
    try {
      const parsed = JSON.parse(decodeURIComponent(dataParam));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }
  return null;
}

export default function PublicQuotationView({ publicQuoteId }) {
  // Synchronously initialize from local storage / URL payload for instant 0ms first render
  const [quotation, setQuotation] = useState(() => {
    if (typeof window === 'undefined') return null;

    // 1. Fast check: URL encoded data payload
    try {
      const dataParam = new URLSearchParams(window.location.search).get('data');
      const decoded = decodeQuotationData(dataParam);
      if (decoded) return decoded;
    } catch (_) {}

    // 2. Fast check: local storage cache
    if (publicQuoteId) {
      const local = quotationService.getLocalQuotationById(publicQuoteId);
      if (local) return local;
    }

    return null;
  });

  const [loading, setLoading] = useState(() => !quotation && Boolean(publicQuoteId));

  useEffect(() => {
    if (!publicQuoteId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // If not already in cache, show loading spinner while fetching
    if (!quotation) {
      setLoading(true);
    }

    // Fetch quotation from Supabase
    quotationService.getQuotationById(publicQuoteId)
      .then((data) => {
        if (isMounted && data) {
          setQuotation(data);
        }
      })
      .catch((err) => {
        console.warn('[PublicQuotationView] Supabase fetch notice:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [publicQuoteId]);

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased py-0">
      <main className="max-w-5xl mx-auto">
        <QuotationPreview
          isPublicView={true}
          publicQuoteId={publicQuoteId}
          quotation={quotation}
          isLoadingProp={loading}
        />
      </main>
    </div>
  );
}
