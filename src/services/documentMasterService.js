import { supabase } from '../lib/supabase';
import {
  DEFAULT_MASTER_DOCUMENT_REGISTRY,
  DEFAULT_CATEGORY_DOC_RULES
} from '../data/defaultRequiredDocuments';

export const documentMasterService = {
  /**
   * Fetch all document types and their category rules from the dedicated 'document_master' table
   */
  async fetchDocumentMaster() {
    try {
      const { data, error } = await supabase
        .from('document_master')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        // Table might not be created yet, fallback gracefully
        console.warn('[documentMasterService] Table fetch notice:', error.message);
        return null;
      }

      if (Array.isArray(data) && data.length > 0) {
        // Parse rows into registry array and rules matrix
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
   * Upsert a document definition and its category rules in 'document_master' table
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
        key: doc.key,
        label: doc.label || doc.key,
        category: doc.category || 'Applicant KYC',
        description: doc.description || '',
        icon: doc.icon || 'description',
        allowed_extensions: doc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
        rules: rules,
        is_custom: Boolean(doc.isCustom),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('document_master')
        .upsert([payload], { onConflict: 'key' })
        .select();

      if (error) {
        console.warn('[documentMasterService] Direct upsert notice:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('[documentMasterService] Upsert error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a document type from 'document_master'
   */
  async deleteDocument(docKey) {
    if (!docKey) return { success: false, error: 'Document key required' };

    try {
      const { error } = await supabase
        .from('document_master')
        .delete()
        .eq('key', docKey);

      if (error) {
        console.warn('[documentMasterService] Delete notice:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('[documentMasterService] Delete error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update category rule status for a specific document key
   */
  async updateDocumentCategoryRule(docKey, categoryKey, ruleStatus) {
    try {
      const { data: curr } = await supabase
        .from('document_master')
        .select('rules')
        .eq('key', docKey)
        .maybeSingle();

      const existingRules = curr?.rules || {};
      const updatedRules = {
        ...existingRules,
        [categoryKey]: ruleStatus // 'mandatory' | 'optional' | 'disabled'
      };

      const { error } = await supabase
        .from('document_master')
        .update({
          rules: updatedRules,
          updated_at: new Date().toISOString()
        })
        .eq('key', docKey);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Seed all 15 default master documents into the 'document_master' table
   */
  async seedDefaultRegistry() {
    try {
      const payloads = DEFAULT_MASTER_DOCUMENT_REGISTRY.map(doc => {
        const rules = {
          RESIDENTIAL: DEFAULT_CATEGORY_DOC_RULES.RESIDENTIAL[doc.key] || 'mandatory',
          BANK_LOAN: DEFAULT_CATEGORY_DOC_RULES.BANK_LOAN[doc.key] || 'mandatory',
          NBFC_LOAN: DEFAULT_CATEGORY_DOC_RULES.NBFC_LOAN[doc.key] || 'mandatory',
          COMMERCIAL: DEFAULT_CATEGORY_DOC_RULES.COMMERCIAL[doc.key] || 'mandatory',
          HOUSING_SOCIETY: DEFAULT_CATEGORY_DOC_RULES.HOUSING_SOCIETY[doc.key] || 'mandatory'
        };

        return {
          key: doc.key,
          label: doc.label,
          category: doc.category,
          description: doc.description || '',
          icon: doc.icon || 'description',
          allowed_extensions: doc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
          rules: rules,
          is_custom: false,
          updated_at: new Date().toISOString()
        };
      });

      const { data, error } = await supabase
        .from('document_master')
        .upsert(payloads, { onConflict: 'key' });

      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
