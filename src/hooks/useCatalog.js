import { useApp } from '../context/AppContext';

/**
 * useCatalog Hook
 * Encapsulates pricing presets, hardware catalogs, tier margins, and system settings.
 */
export function useCatalog() {
  const {
    modulesList,
    invertersList,
    pricingPresets,
    tierMargins,
    systemSettings,
    governanceSettings,
    addNewModule,
    addNewInverter,
    updateSystemSettings,
    refreshDatabase
  } = useApp();

  return {
    modulesList,
    invertersList,
    pricingPresets,
    tierMargins,
    systemSettings,
    governanceSettings,
    addNewModule,
    addNewInverter,
    updateSystemSettings,
    refreshCatalog: refreshDatabase
  };
}

export default useCatalog;
