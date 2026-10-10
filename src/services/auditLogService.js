import { supabase } from '../lib/supabase.js';

export const auditLogService = {
  /**
   * Fetch audit logs from secure backend API or read-only database query
   */
  async getAuditLogs(limit = 100) {
    // 1. Try secure admin audit log endpoint
    try {
      const res = await fetch('/api/auth/admin-audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list', limit, offset: 0 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.logs)) {
          return json.logs.map(row => {
            let detailsText = '';
            if (typeof row.details === 'string') {
              detailsText = row.details;
            } else if (row.details && typeof row.details === 'object') {
              detailsText = row.details.message || row.details.reason || row.details.description || JSON.stringify(row.details);
            } else if (row.details != null) {
              detailsText = String(row.details);
            }
            return {
              id: row.id,
              timestamp: row.created_at || new Date().toISOString(),
              action: row.action || 'SYSTEM_ACTION',
              module: row.entity_type || 'SYSTEM',
              recordId: row.entity_id || '-',
              userName: row.actor_email || 'System',
              user: row.actor_email || 'System',
              role: row.actor_role || 'admin',
              ipAddress: row.ip_address || '192.168.1.1',
              details: detailsText,
              status: 'VERIFIED'
            };
          });
        }
      }
    } catch (_) {}

    // 2. Direct read-only database query
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data.map(row => {
          let detailsText = '';
          if (typeof row.details === 'string') {
            detailsText = row.details;
          } else if (row.details && typeof row.details === 'object') {
            detailsText = row.details.message || row.details.reason || row.details.description || JSON.stringify(row.details);
          } else if (row.details != null) {
            detailsText = String(row.details);
          }
          return {
            id: row.id,
            timestamp: row.created_at || row.timestamp || new Date().toISOString(),
            action: row.action || 'SYSTEM_ACTION',
            module: row.module || row.entity_type || 'SYSTEM',
            recordId: row.record_id || row.entity_id || '-',
            userName: row.user_name || row.user_email || row.user || 'System',
            user: row.user_name || row.user_email || row.user || 'System',
            role: row.role || row.user_role || 'admin',
            ipAddress: row.ip_address || '192.168.1.1',
            details: detailsText,
            oldValue: row.old_value || (row.details && typeof row.details === 'object' && row.details.oldValue) || null,
            newValue: row.new_value || (row.details && typeof row.details === 'object' && row.details.newValue) || null,
            status: row.status || 'VERIFIED'
          };
        });
      }
    } catch (err) {
      console.warn('Supabase fetch audit logs fallback:', err);
    }

    return [];
  },

  /**
   * Log activity event via secure server API
   */
  async logEvent(action, entityType, entityId, details = {}, userEmail = 'ops@sunvine.in', userRole = 'admin') {
    let detailsObj = {};
    if (typeof details === 'object' && details !== null) {
      detailsObj = details;
    } else if (typeof details === 'string' && details.trim()) {
      detailsObj = { message: details.trim() };
    }

    try {
      await fetch('/api/auth/admin-audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'log',
          action: action || 'SYSTEM_ACTION',
          entity: entityType || 'SYSTEM',
          entityId: entityId ? String(entityId) : null,
          details: detailsObj,
          userEmail,
          userRole
        })
      });
    } catch (err) {
      console.warn('[auditLogService] Audit log dispatch notice:', err.message);
    }
  },

  /**
   * Fetch notifications (read-only query)
   */
  async getNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          audience: row.audience,
          type: row.type,
          icon: row.icon,
          title: row.title,
          description: row.description,
          isRelease: row.is_release,
          version: row.version,
          targetTab: row.target_tab,
          createdAt: row.created_at
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch notifications fallback:', err);
    }

    return [];
  },

  /**
   * Save / dispatch notification via push/alert API
   */
  async saveNotification(notif) {
    if (!notif || !notif.id) return { success: false };
    try {
      await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'notify',
          notification: notif
        })
      }).catch(() => {});
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};
