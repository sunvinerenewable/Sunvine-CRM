/**
 * functions/_lib/documentStorage.js
 *
 * Canonical Document Storage Configuration & Helpers for Sunvine R2.
 */

export const DOC_KEY_TO_R2_SLUG = {
  // Aadhaar
  aadhaar: 'aadhar',
  aadhar: 'aadhar',
  aadhaarCard: 'aadhar',
  applicantAadhaar: 'aadhar',

  // PAN
  pan: 'pan',
  panCard: 'pan',
  applicantPan: 'pan',

  // Electricity / Utility
  bill: 'electricity-bill',
  lightBill: 'electricity-bill',
  electricityBill: 'electricity-bill',
  meter: 'meter-photo',
  meterPhoto: 'meter-photo',
  electricityMeter: 'meter-photo',

  // Bank
  bank: 'bank-statement',
  bankDetails: 'bank-statement',
  bankPassbook: 'bank-statement',
  applicantBank: 'bank-statement',
  cheque: 'bank-statement',
  bankStatement: 'bank-statement',

  // Property / Vera
  veraBill: 'property-document',
  propertyTax: 'property-document',
  ownershipDoc: 'property-document',
  propertyDocument: 'property-document',

  // Site Photos
  site: 'site-photo',
  sitePhoto: 'site-photo',
  sitePhotos: 'site-photo',
  rooftopPhoto: 'site-photo',

  // Quotation
  quotation: 'quotation',

  // Co-Applicant
  coApplicantAadhaar: 'co-applicant-aadhar',
  coApplicantPan: 'co-applicant-pan',
  coApplicantBank: 'co-applicant-bank-statement',

  // Commercial / Legal / Identity
  passportPhoto: 'passport-photo',
  msmeCertificate: 'msme-certificate',
  gstCertificate: 'gst-certificate',
  undertaking: 'undertaking',
  rentNoc: 'rent-noc',
  firmPanBank: 'firm-pan-bank',
  partnershipDeed: 'partnership-deed',
  factoryLayout: 'factory-layout',
  ceiApproval: 'cei-approval',
  societyNoc: 'society-noc'
};

export function getDocumentTypeSlug(docKey) {
  if (!docKey || typeof docKey !== 'string') return 'other';
  const cleanKey = docKey.trim();
  if (DOC_KEY_TO_R2_SLUG[cleanKey]) {
    return DOC_KEY_TO_R2_SLUG[cleanKey];
  }
  const lowerKey = cleanKey.toLowerCase();
  for (const [k, v] of Object.entries(DOC_KEY_TO_R2_SLUG)) {
    if (k.toLowerCase() === lowerKey) return v;
  }
  return cleanKey
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

export function getCanonicalR2Key({ fileId, docKey, extension, index = null }) {
  if (!fileId) throw new Error('fileId is required to generate canonical R2 key');
  const cleanFileId = String(fileId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const slug = getDocumentTypeSlug(docKey);
  const cleanExt = (extension || 'pdf').toLowerCase().replace(/^\./, '');
  const fileName = index !== null && index !== undefined && index !== ''
    ? `${slug}-${index}.${cleanExt}`
    : `${slug}.${cleanExt}`;

  return {
    folder: `applications/${cleanFileId}/${slug}`,
    fileName,
    key: `applications/${cleanFileId}/${slug}/${fileName}`,
    slug
  };
}
