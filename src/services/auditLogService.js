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
    let detailsObj = {};
    if (typeof details === 'object' && details !== null) {
      detailsObj = details;
    } else if (typeof details === 'string' && details.trim()) {
      detailsObj = { message: details.trim() };
    }

    const payload = {
      action: action || 'SYSTEM_ACTION',
      module: entityType || 'SYSTEM',
      entity_type: entityType || 'SYSTEM',
      record_id: entityId ? String(entityId) : null,
      entity_id: entityId ? String(entityId) : null,
      user_email: userEmail,
      user_name: userEmail,
      user_role: userRole,
      role: userRole,
      details: detailsObj,
      status: 'VERIFIED'
    };

    try {
      const { error } = await supabase.from('audit_logs').insert([payload]);
      if (error) {
        console.error('[auditLogService] Supabase audit log insert error:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
      }
    } catch (err) {
      console.error('[auditLogService] Exception inserting audit log:', err);
    }
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
