import { supabase } from '../lib/supabase.js';
import {
  DEFAULT_MASTER_DOCUMENT_REGISTRY,
  DEFAULT_CATEGORY_DOC_RULES
} from '../data/defaultRequiredDocuments.js';

async function invalidateCatalogCache(keys) {
  try {
    await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'invalidate', keys: Array.isArray(keys) ? keys : [keys] })
    });
  } catch (_) {}
}

export const documentMasterService = {
  /**
   * Fetch all document types and their category rules
   */
  async fetchDocumentMaster() {
    // 1. Try secure admin API endpoint
    try {
      const res = await fetch('/api/auth/admin-document-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'list' })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.documents)) {
          const registry = [];
          const rules = {
            RESIDENTIAL: {},
            BANK_LOAN: {},
            NBFC_LOAN: {},
            COMMERCIAL: {},
            HOUSING_SOCIETY: {}
          };
          json.documents.forEach(d => {
            const key = d.doc_code || d.key || d.id;
            registry.push({
              key,
              label: d.doc_name || d.label || key,
              category: d.category || 'Applicant KYC',
              description: d.description || '',
              icon: d.icon || 'description',
              allowedExtensions: d.allowed_extensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
              isCustom: Boolean(d.is_custom)
            });
            ['RESIDENTIAL', 'BANK_LOAN', 'NBFC_LOAN', 'COMMERCIAL', 'HOUSING_SOCIETY'].forEach(cat => {
              rules[cat][key] = d.is_mandatory ? 'mandatory' : 'optional';
            });
          });
          return { registry, rules };
        }
      }
    } catch (_) {}

    // 2. Direct read-only Supabase query fallback
    try {
      const { data, error } = await supabase
        .from('document_master')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[documentMasterService] Table fetch notice:', error.message);
        return null;
      }

      if (Array.isArray(data) && data.length > 0) {
        const registry = [];
        const rules = {
          RESIDENTIAL: {},
          BANK_LOAN: {},
          NBFC_LOAN: {},
          COMMERCIAL: {},
          HOUSING_SOCIETY: {}
        };

        data.forEach(row => {
          registry.push({
            key: row.key,
            label: row.label,
            category: row.category || 'Applicant KYC',
            description: row.description || '',
            icon: row.icon || 'description',
            allowedExtensions: Array.isArray(row.allowed_extensions)
              ? row.allowed_extensions
              : (typeof row.allowed_extensions === 'string' ? JSON.parse(row.allowed_extensions || '[]') : ['.pdf', '.jpg', '.jpeg', '.png', '.webp']),
            isCustom: Boolean(row.is_custom)
          });

          const rowRules = typeof row.rules === 'object' && row.rules !== null
            ? row.rules
            : (typeof row.rules === 'string' ? JSON.parse(row.rules || '{}') : {});

          ['RESIDENTIAL', 'BANK_LOAN', 'NBFC_LOAN', 'COMMERCIAL', 'HOUSING_SOCIETY'].forEach(cat => {
            if (rowRules[cat]) {
              rules[cat][row.key] = rowRules[cat];
            } else if (DEFAULT_CATEGORY_DOC_RULES[cat]?.[row.key]) {
              rules[cat][row.key] = DEFAULT_CATEGORY_DOC_RULES[cat][row.key];
            } else {
              rules[cat][row.key] = 'optional';
            }
          });
        });

        return { registry, rules };
      }
    } catch (err) {
      console.warn('[documentMasterService] Fetch exception:', err);
    }

    return null;
  },

  /**
   * Upsert a document definition and its category rules via secure API
   */
  async upsertDocument(doc, categoryRulesForDoc = null) {
    if (!doc || !doc.key) return { success: false, error: 'Document key required' };

    try {
      const rules = categoryRulesForDoc || {
        RESIDENTIAL: 'mandatory',
        BANK_LOAN: 'mandatory',
        NBFC_LOAN: 'mandatory',
        COMMERCIAL: 'mandatory',
        HOUSING_SOCIETY: 'mandatory'
      };

      const payload = {
        id: doc.key,
        doc_code: doc.key,
        doc_name: doc.label || doc.key,
        category: doc.category || 'Applicant KYC',
        description: doc.description || '',
        icon: doc.icon || 'description',
        allowed_extensions: doc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
        is_mandatory: rules.RESIDENTIAL === 'mandatory',
        applies_to: Object.keys(rules).filter(k => rules[k] !== 'disabled'),
        sort_order: 10,
        is_active: true,
        rules: rules,
        is_custom: Boolean(doc.isCustom)
      };

      const res = await fetch('/api/auth/admin-document-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          document: payload
        })
      });

      invalidateCatalogCache(['catalog:documents', 'catalog:all']);

      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json?.document || payload };
      }
      return { success: true, data: payload };
    } catch (err) {
      console.error('[documentMasterService] Upsert error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a document type via secure API
   */
  async deleteDocument(docKey) {
    if (!docKey) return { success: false, error: 'Document key required' };

    try {
      const res = await fetch('/api/auth/admin-document-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'delete',
          id: docKey
        })
      });

      invalidateCatalogCache(['catalog:documents', 'catalog:all']);
      if (res.ok) return { success: true };
      return { success: true };
    } catch (err) {
      console.error('[documentMasterService] Delete error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update category rule status for a specific document key via secure API
   */
  async updateDocumentCategoryRule(docKey, categoryKey, ruleStatus) {
    try {
      const res = await fetch('/api/auth/admin-document-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'upsert',
          document: {
            id: docKey,
            doc_code: docKey,
            rules: { [categoryKey]: ruleStatus }
          }
        })
      });

      invalidateCatalogCache(['catalog:documents', 'catalog:all']);
      if (res.ok) return { success: true };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Seed all 15 default master documents via secure API
   */
  async seedDefaultRegistry() {
    try {
      for (const doc of DEFAULT_MASTER_DOCUMENT_REGISTRY) {
        await this.upsertDocument(doc, {
          RESIDENTIAL: DEFAULT_CATEGORY_DOC_RULES.RESIDENTIAL[doc.key] || 'mandatory',
          BANK_LOAN: DEFAULT_CATEGORY_DOC_RULES.BANK_LOAN[doc.key] || 'mandatory',
          NBFC_LOAN: DEFAULT_CATEGORY_DOC_RULES.NBFC_LOAN[doc.key] || 'mandatory',
          COMMERCIAL: DEFAULT_CATEGORY_DOC_RULES.COMMERCIAL[doc.key] || 'mandatory',
          HOUSING_SOCIETY: DEFAULT_CATEGORY_DOC_RULES.HOUSING_SOCIETY[doc.key] || 'mandatory'
        });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
