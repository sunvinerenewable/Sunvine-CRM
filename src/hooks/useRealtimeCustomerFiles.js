import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useRealtimeCustomerFiles
 * Subscribes to Supabase postgres_changes for customer_files.
 * Isolated from AppContext.jsx to preserve test integrity and separation of concerns.
 *
 * @param {Object} options
 * @param {string} options.role - 'admin' | 'staff' | 'dealer'
 * @param {string} options.dealerId - dealer identifier for scoped updates
 * @param {Function} options.onRefresh - callback invoked when customer_files changes
 */
export function useRealtimeCustomerFiles({ role, dealerId, onRefresh }) {
  useEffect(() => {
    if (!onRefresh) return;

    let isMounted = true;
    const channelName = role === 'dealer' && dealerId
      ? `realtime_customer_files_dealer_${dealerId}`
      : `realtime_customer_files_admin_${Date.now()}`;

    const channelConfig = {
      event: '*',
      schema: 'public',
      table: 'customer_files'
    };

    if (role === 'dealer' && dealerId) {
      channelConfig.filter = `dealer_id=eq.${dealerId}`;
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, () => {
        if (isMounted) {
          onRefresh({ force: true });
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [role, dealerId, onRefresh]);
}
