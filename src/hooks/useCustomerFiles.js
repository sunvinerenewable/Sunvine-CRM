import { useApp } from '../context/AppContext';

/**
 * useCustomerFiles Hook
 * Encapsulates customer applications and lifecycle stage transitions.
 */
export function useCustomerFiles() {
  const {
    customerFiles,
    addCustomerFileTimelineEvent,
    refreshDatabase
  } = useApp();

  return {
    customerFiles,
    addCustomerFileTimelineEvent,
    refreshCustomerFiles: refreshDatabase
  };
}

export default useCustomerFiles;
