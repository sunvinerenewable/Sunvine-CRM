import { supabase } from '../lib/supabase';

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

export const MAX_DOC_SIZE_BYTES = 2 * 1024 * 1024; // Strict 2 MB limit for Government PM Surya Ghar / DISCOM portals

export const storageService = {
  /**
   * Request a presigned URL from the serverless API endpoint (Cloudflare R2 / Supabase)
   */
  async getPresignedUploadUrl(file, options = {}) {
    const { bucket = 'sunvine-documents', folder = 'customer-files', customFileName, oldPath, oldDoc } = options;

    if (!file) throw new Error('File is required for upload');

    // Extension check
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Invalid file type (.${ext}). Only PDF (.pdf) and Image (.jpeg, .jpg, .png, .webp) files are permitted.`);
    }

    // MIME check
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      throw new Error(`Invalid format (${file.type}). Only PDF and Image files (JPEG, PNG, WEBP) are allowed.`);
    }

    // Size check
    if (file.size > MAX_DOC_SIZE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      throw new Error(`File size (${sizeMB} MB) exceeds the maximum 2 MB limit allowed by the government portal. Please compress the file.`);
    }

    const previousFilePath = oldPath || oldDoc?.path || oldDoc?.url;

    try {
      const response = await fetch('/api/storage-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          customFileName,
          fileType: file.type || 'application/pdf',
          fileSize: file.size,
          bucket,
          folder,
          oldPath: previousFilePath
        })
      });

      if (response.ok) {
        return await response.json();
      }
      const errJson = await response.json().catch(() => ({}));
      if (errJson.error) {
        throw new Error(errJson.error);
      }
    } catch (apiErr) {
      if (apiErr.message && !apiErr.message.includes('fetch')) {
        throw apiErr;
      }
      console.warn('[Storage] Presign API unreachable, falling back to direct client:', apiErr);
    }

    // Direct Supabase Client Fallback
    const cleanFolder = folder.replace(/^\/|\/$/g, '');
    const fallbackExt = ext || 'pdf';
    const filePath = `${cleanFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fallbackExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error) {
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
   * Upload file directly to Cloudflare R2 / Supabase storage using the Presigned URL
   * Avoids proxying heavy multipart/form-data through Vercel serverless function limits.
   */
  async uploadWithPresignedUrl(file, options = {}) {
    const presignData = await this.getPresignedUploadUrl(file, options);
    const { bucket = 'sunvine-documents' } = options;

    if (presignData.signedUrl) {
      // 1. Direct upload via Presigned URL (Cloudflare R2 / S3)
      const uploadRes = await fetch(presignData.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/pdf'
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload to storage failed with status ${uploadRes.status}`);
      }
    } else {
      // 2. Direct client fallback via Supabase SDK
      const { error: directErr } = await supabase.storage
        .from(bucket)
        .upload(presignData.path, file, {
          contentType: file.type || 'application/pdf',
          upsert: true
        });

      if (directErr) {
        throw new Error(`Storage upload error: ${directErr.message}`);
      }
    }

    // Resolve public URL
    let publicUrl = presignData.publicUrl;
    if (!publicUrl) {
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(presignData.path);
      publicUrl = publicData?.publicUrl;
    }

    return {
      success: true,
      url: publicUrl,
      publicUrl: publicUrl,
      path: presignData.path,
      filename: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/pdf',
      uploadedAt: new Date().toISOString()
    };
  },

  /**
   * High-level helper for customer document uploads
   * Places all documents directly under `customers/${customerId}/` with clear standard names (e.g. Aadhaar_Card.pdf).
   * Automatically cleans up previous files with other extensions (e.g. .png when uploading .pdf).
   */
  async uploadCustomerDocument(file, customerId = 'general', docKey = 'bill', options = {}) {
    const DOC_KEY_TO_NAME = {
      aadhaar: 'Aadhaar_Card',
      aadhar: 'Aadhaar_Card',
      applicantAadhaar: 'Aadhaar_Card',
      pan: 'Applicant_PAN_Card',
      panCard: 'Applicant_PAN_Card',
      applicantPan: 'Applicant_PAN_Card',
      coApplicantPan: 'Co_Applicant_PAN_Card',
      coApplicantAadhaar: 'Co_Applicant_Aadhaar_Card',
      coApplicantBank: 'Co_Applicant_Bank_Detail',
      bank: 'Bank_Passbook_Cheque',
      bankPassbook: 'Bank_Passbook_Cheque',
      bankDetails: 'Bank_Passbook_Cheque',
      applicantBank: 'Bank_Passbook_Cheque',
      cheque: 'Bank_Passbook_Cheque',
      bill: 'Electricity_Light_Bill',
      lightBill: 'Electricity_Light_Bill',
      electricityBill: 'Electricity_Light_Bill',
      meter: 'Electricity_Meter_Photo',
      meterPhoto: 'Electricity_Meter_Photo',
      electricityMeter: 'Electricity_Meter_Photo',
      site: 'Rooftop_Site_Photo',
      sitePhoto: 'Rooftop_Site_Photo',
      rooftopPhoto: 'Rooftop_Site_Photo',
      veraBill: 'Vera_Property_Tax_Bill',
      propertyTax: 'Vera_Property_Tax_Bill'
    };

    const cleanCustomerId = (customerId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = `customers/${cleanCustomerId}`;
    const customFileName = DOC_KEY_TO_NAME[docKey] || docKey.replace(/([A-Z])/g, '_$1').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_/, '');

    return await this.uploadWithPresignedUrl(file, {
      bucket: 'sunvine-documents',
      folder,
      customFileName,
      ...options
    });
  },

  /**
   * Delete a file or list of files from Cloudflare R2 and Supabase Storage
   */
  async deleteDocument(filePathOrUrl, bucket = 'sunvine-documents') {
    if (!filePathOrUrl) return { success: true };
    const paths = Array.isArray(filePathOrUrl) ? filePathOrUrl : [filePathOrUrl];

    try {
      const response = await fetch('/api/storage-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paths, bucket })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('[Storage] /api/storage-delete error, trying Supabase fallback:', e);
    }

    // Direct Supabase fallback
    try {
      const cleanPaths = paths.map(p => p.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/+/, ''));
      const { error } = await supabase.storage.from(bucket).remove(cleanPaths);
      return { success: !error };
    } catch {
      return { success: false };
    }
  },

  /**
   * Delete a customer document and all its potential extension variants
   */
  async deleteCustomerDocument(docKey, customerId = 'general', bucket = 'sunvine-documents', oldDoc = null) {
    const DOC_KEY_TO_NAME = {
      aadhaar: 'Aadhaar_Card',
      aadhar: 'Aadhaar_Card',
      applicantAadhaar: 'Aadhaar_Card',
      pan: 'Applicant_PAN_Card',
      panCard: 'Applicant_PAN_Card',
      applicantPan: 'Applicant_PAN_Card',
      coApplicantPan: 'Co_Applicant_PAN_Card',
      coApplicantAadhaar: 'Co_Applicant_Aadhaar_Card',
      coApplicantBank: 'Co_Applicant_Bank_Detail',
      bank: 'Bank_Passbook_Cheque',
      bankPassbook: 'Bank_Passbook_Cheque',
      bankDetails: 'Bank_Passbook_Cheque',
      applicantBank: 'Bank_Passbook_Cheque',
      cheque: 'Bank_Passbook_Cheque',
      bill: 'Electricity_Light_Bill',
      lightBill: 'Electricity_Light_Bill',
      electricityBill: 'Electricity_Light_Bill',
      meter: 'Electricity_Meter_Photo',
      meterPhoto: 'Electricity_Meter_Photo',
      electricityMeter: 'Electricity_Meter_Photo',
      site: 'Rooftop_Site_Photo',
      sitePhoto: 'Rooftop_Site_Photo',
      rooftopPhoto: 'Rooftop_Site_Photo',
      veraBill: 'Vera_Property_Tax_Bill',
      propertyTax: 'Vera_Property_Tax_Bill'
    };

    const cleanCustomerId = (customerId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = `customers/${cleanCustomerId}`;
    const baseCustomName = DOC_KEY_TO_NAME[docKey] || docKey.replace(/([A-Z])/g, '_$1').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_/, '');

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const paths = allowedExts.map(ext => `${folder}/${baseCustomName}.${ext}`);

    if (oldDoc?.path) paths.push(oldDoc.path);
    if (oldDoc?.url) paths.push(oldDoc.url);

    return await this.deleteDocument(paths, bucket);
  }
};
