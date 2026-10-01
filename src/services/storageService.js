import { supabase } from '../lib/supabase';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const storageService = {
  /**
   * Request a presigned URL from the serverless API endpoint
   */
  async getPresignedUploadUrl(file, options = {}) {
    const { bucket = 'sunvine-documents', folder = 'customer-files' } = options;

    if (!file) throw new Error('File is required for upload');

    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      throw new Error(`File format ${file.type || 'unknown'} is not supported. Please upload PDF, JPG, PNG, or WEBP.`);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 15MB.`);
    }

    try {
      const response = await fetch('/api/storage-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          bucket,
          folder
        })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (apiErr) {
      console.warn('[Storage] Presign API unreachable, falling back to direct client client:', apiErr);
    }

    // Direct Supabase Client Fallback
    const cleanFolder = folder.replace(/^\/|\/$/g, '');
    const ext = file.name.split('.').pop().toLowerCase();
    const filePath = `${cleanFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error) {
      // Return standard path if signed upload URL is not permitted by bucket
      return {
        success: true,
        path: filePath,
        bucket,
        fallbackDirect: true
      };
    }

    return {
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || filePath,
      bucket
    };
  },

  /**
   * Upload file directly to Supabase storage using the Presigned URL
   * Avoids proxying heavy multipart/form-data through Vercel serverless function limits.
   */
  async uploadWithPresignedUrl(file, options = {}) {
    const presignData = await this.getPresignedUploadUrl(file, options);
    const { bucket = 'sunvine-documents' } = options;

    if (presignData.signedUrl) {
      // 1. Lightning-fast direct upload via Presigned URL
      const uploadRes = await fetch(presignData.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct upload to Supabase storage failed with status ${uploadRes.status}`);
      }
    } else {
      // 2. Direct client fallback via Supabase SDK
      const { error: directErr } = await supabase.storage
        .from(bucket)
        .upload(presignData.path, file, {
          contentType: file.type,
          upsert: true
        });

      if (directErr) {
        throw new Error(`Supabase storage upload error: ${directErr.message}`);
      }
    }

    // Resolve public or authorized access URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(presignData.path);

    return {
      success: true,
      url: presignData.publicUrl || publicData?.publicUrl,
      path: presignData.path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString()
    };
  },

  /**
   * High-level helper for customer document uploads (Electricity Bill, Aadhaar, Rooftop CAD, Tax Receipt)
   */
  async uploadCustomerDocument(file, customerId = 'general', docType = 'bill') {
    const folder = `customers/${customerId}/${docType}`;
    return await this.uploadWithPresignedUrl(file, {
      bucket: 'sunvine-documents',
      folder
    });
  }
};
