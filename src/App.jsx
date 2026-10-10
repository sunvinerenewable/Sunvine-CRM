import React, { Suspense, lazy } from 'react';
import ErrorBoundary from './components/Shared/ErrorBoundary';
import { ToastProvider } from './components/Shared/Toast';
import { LoadingProvider } from './context/LoadingContext';
import GlobalActionLoader from './components/Shared/GlobalActionLoader';
import { PortalSkeleton } from './components/Shared/ViewSkeleton';

// Detect whether current session is requesting the standalone public quotation viewer
function isPublicProposalRoute() {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || '';
  const searchParams = new URLSearchParams(search);
  if (searchParams.get('view') === 'quote' || searchParams.has('quoteId')) {
    return true;
  }
  const hash = window.location.hash || '';
  if (hash.startsWith('#/quote/') || hash.startsWith('#/view-quote/')) {
    return true;
  }
  return false;
}

function getPublicProposalId() {
  if (typeof window === 'undefined') return null;
  const searchParams = new URLSearchParams(window.location.search || '');
  const idFromParam = searchParams.get('id') || searchParams.get('quoteId');
  if (idFromParam) return idFromParam;
  const hash = window.location.hash || '';
  const match = hash.match(/#\/(?:quote|view-quote)\/([^/?#]+)/);
  if (match) return match[1];
  return null;
}

import PortalApp from './components/PortalApp';
import lazyWithRetry from './utils/lazyWithRetry';

// Lazy-load only the isolated public quotation viewer for WhatsApp customers
const PublicQuotationView = lazyWithRetry(() => import('./components/PublicQuotationView'));

export default function App() {
  const isPublic = isPublicProposalRoute();
  const publicQuoteId = isPublic ? getPublicProposalId() : null;

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <ToastProvider>
          {isPublic ? (
            <Suspense fallback={null}>
              <PublicQuotationView publicQuoteId={publicQuoteId} />
            </Suspense>
          ) : (
            <Suspense fallback={<PortalSkeleton />}>
              <PortalApp />
            </Suspense>
          )}
          <GlobalActionLoader />
        </ToastProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}
