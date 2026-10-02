import { supabase } from '../lib/supabase';

export const auditLogService = {
  async getAuditLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch audit logs fallback:', err);
    }

    return [];
  },

  async logEvent(action, entityType, entityId, details = {}, userEmail = 'ops@sunvine.in', userRole = 'admin') {
    const payload = {
      action,
      entity_type: entityType,
      entity_id: String(entityId || ''),
      user_email: userEmail,
      user_role: userRole,
      details,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('audit_logs').insert([payload]);
    } catch (_) {}
  },

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

  async saveNotification(notif) {
    if (!notif || !notif.id) return { success: false };
    try {
      const payload = {
        id: notif.id,
        audience: notif.audience || 'all',
        type: notif.type || 'info',
        icon: notif.icon || 'notifications',
        title: notif.title,
        description: notif.description || '',
        is_release: Boolean(notif.isRelease),
        version: notif.version || null,
        target_tab: notif.targetTab || null,
        created_at: notif.createdAt || new Date().toISOString()
      };
      await supabase.from('notifications').upsert([payload], { onConflict: 'id' });
      return { success: true };
    } catch (err) {
      return { success: true };
    }
  }
};
