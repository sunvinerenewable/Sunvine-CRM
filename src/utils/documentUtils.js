/**
 * Sunvine Solar EPC - Document Utilities
 * Supports multi-document attachments per category slot (e.g. Aadhaar Front & Back,
 * Bank Passbook & Cheque, multiple Site Photos, etc.) while ensuring 100% backward
 * compatibility with legacy single-file records.
 */

/**
 * Normalizes any document state (legacy single object, array, or multi-doc wrapper)
 * into a standard array of attached file objects:
 * [{ id, filename, url, size, date, uploaded, dataUrl, originalSize, reduction }]
 */
export function normalizeDocList(docState) {
  if (!docState) return [];

  // If already has an explicit files array
  if (Array.isArray(docState.files) && docState.files.length > 0) {
    return docState.files.filter(Boolean).map((f, idx) => ({
      ...f,
      id: f.id || f.url || `doc-${idx}-${Date.now()}`,
      uploaded: f.uploaded !== false
    }));
  }

  // If the docState itself is an array
  if (Array.isArray(docState)) {
    return docState.filter(Boolean).map((f, idx) => ({
      ...f,
      id: f.id || f.url || `doc-${idx}-${Date.now()}`,
      uploaded: f.uploaded !== false
    }));
  }

  // If legacy single-file object with uploaded === true (or having a url/filename)
  if (docState.uploaded || docState.url || docState.filename || docState.dataUrl) {
    return [{
      ...docState,
      id: docState.id || docState.url || docState.filename || 'doc-primary',
      uploaded: true
    }];
  }

  return [];
}

/**
 * Appends one or more new files to the document slot and generates
 * both the multi-file `files` array and top-level backward-compatible fields.
 */
export function appendDocsToFileList(existingDocState, newFiles) {
  const currentList = normalizeDocList(existingDocState);
  const additions = (Array.isArray(newFiles) ? newFiles : [newFiles]).filter(Boolean).map(f => ({
    id: f.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    filename: f.filename || f.name || 'document',
    url: f.url || f.publicUrl || null,
    dataUrl: f.dataUrl || null,
    size: f.size || (f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : 'Uploaded'),
    originalSize: f.originalSize || null,
    reduction: f.reduction || null,
    uploaded: true,
    date: f.date || new Date().toISOString().split('T')[0]
  }));

  const updatedList = [...currentList, ...additions];
  const primaryDoc = updatedList[updatedList.length - 1] || updatedList[0];

  return {
    ...(existingDocState || {}),
    uploaded: true,
    files: updatedList,
    filename: primaryDoc?.filename || 'document',
    url: primaryDoc?.url || null,
    dataUrl: primaryDoc?.dataUrl || null,
    size: updatedList.length > 1 ? `${updatedList.length} Files Attached` : (primaryDoc?.size || 'Uploaded'),
    date: primaryDoc?.date || new Date().toISOString().split('T')[0]
  };
}

/**
 * Removes a specific file from a category slot by its ID, URL, or filename.
 * If no files remain, marks the category slot as unuploaded.
 */
export function removeDocFromFileList(existingDocState, targetIdOrUrl) {
  const currentList = normalizeDocList(existingDocState);
  const updatedList = currentList.filter(f => {
    if (f.id && f.id === targetIdOrUrl) return false;
    if (f.url && f.url === targetIdOrUrl) return false;
    if (f.filename && f.filename === targetIdOrUrl) return false;
    return true;
  });

  if (updatedList.length === 0) {
    return {
      uploaded: false,
      files: [],
      filename: null,
      url: null,
      dataUrl: null,
      size: null,
      date: null
    };
  }

  const primaryDoc = updatedList[updatedList.length - 1] || updatedList[0];

  return {
    ...(existingDocState || {}),
    uploaded: true,
    files: updatedList,
    filename: primaryDoc?.filename || 'document',
    url: primaryDoc?.url || null,
    dataUrl: primaryDoc?.dataUrl || null,
    size: updatedList.length > 1 ? `${updatedList.length} Files Attached` : (primaryDoc?.size || 'Uploaded'),
    date: primaryDoc?.date || new Date().toISOString().split('T')[0]
  };
}

/**
 * Calculates 14-day cancellation retention and restoration eligibility.
 * Files cancelled for > 14 days have their restore action permanently locked
 * and their vault documents purged from Cloudflare R2.
 */
export function getCancellationRetentionStatus(cancelledAt) {
  if (!cancelledAt) {
    return {
      isExpired: false,
      daysRemaining: 14,
      formattedRemaining: '14 days',
      canRestore: true,
      expiryDateFormatted: '14 days from cancellation'
    };
  }

  const cancelTime = new Date(cancelledAt).getTime();
  const now = Date.now();
  const diffMs = now - cancelTime;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(14 - diffDays));
  const isExpired = diffDays >= 14;
  const expiryDate = new Date(cancelTime + 14 * 24 * 60 * 60 * 1000);

  return {
    isExpired,
    daysRemaining,
    formattedRemaining: daysRemaining === 0 ? 'Expired' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    canRestore: !isExpired,
    expiryDateFormatted: expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  };
}

/**
 * Extracts all document URLs/paths across all slots in a customer file.
 */
export function extractAllFileDocUrls(documents) {
  if (!documents || typeof documents !== 'object') return [];
  const urls = [];
  for (const slot of Object.values(documents)) {
    const list = normalizeDocList(slot);
    list.forEach(doc => {
      if (doc.url) urls.push(doc.url);
      if (doc.path) urls.push(doc.path);
    });
  }
  return [...new Set(urls.filter(Boolean))];
}

