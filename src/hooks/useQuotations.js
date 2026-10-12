import { useApp } from '../context/AppContext';

/**
 * useQuotations Hook
 * Encapsulates quotation management, drafting, and status workflows.
 */
export function useQuotations() {
  const {
    quotations,
    activeDraftQuote,
    editingQuotation,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    updateQuotationStatus,
    startEditingQuotation,
    clearEditingQuotation,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    refreshDatabase
  } = useApp();

  return {
    quotations,
    activeDraftQuote,
    editingQuotation,
    addQuotation,
    updateQuotation,
    deleteQuotation,
    updateQuotationStatus,
    startEditingQuotation,
    clearEditingQuotation,
    setActiveDraftQuote,
    clearActiveDraftQuote,
    refreshQuotations: refreshDatabase
  };
}

export default useQuotations;
