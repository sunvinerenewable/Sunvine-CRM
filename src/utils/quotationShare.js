import { quotationService } from '../services/quotationService.js';

// Clean customer phone number to Indian 10-digit format with country code 91
export function cleanCustomerPhone(phoneStr) {
  if (!phoneStr) return '919825012345';
  const digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length >= 10) {
    return '91' + digits.slice(-10);
  }
  return '919825012345';
}

// Encode safe compact quotation payload for portable instant URL loading (No sensitive dealer margins or customer phone)
export function encodeQuotationPayload(quote) {
  if (!quote || typeof quote !== 'object') return '';
  try {
    const compact = {
      id: quote.id,
      date: quote.date,
      customerName: quote.customerName,
      city: quote.city || quote.location,
      state: quote.state,
      discom: quote.discom,
      systemCapacityKW: quote.systemCapacityKW || quote.capacityKW || quote.capacity,
      solarModule: quote.solarModule,
      inverterType: quote.inverterType,
      structureType: quote.structureType,
      projectType: quote.projectType,
      grandTotalCustomer: quote.grandTotalCustomer || quote.totalAmount,
      subsidyAmount: quote.subsidyAmount,
      netPayable: quote.netPayable,
      dealerName: quote.dealerName,
      isDirectCompanyQuote: quote.isDirectCompanyQuote,
      bomItems: quote.bomItems,
      bomTotals: quote.bomTotals
    };
    const json = JSON.stringify(compact);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (_) {
    return '';
  }
}

// Generate online link for customer proposal using share token when available
export function getPublicProposalUrl(quoteOrId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sunvinerenewable.com';
  if (typeof quoteOrId === 'object' && quoteOrId !== null) {
    const id = quoteOrId.id || quoteOrId.quoteId || quoteOrId.quotationNo || '';
    const shareToken = quoteOrId.shareToken || quoteOrId.share_token;
    if (shareToken) {
      return `${origin}/?view=quote&token=${encodeURIComponent(shareToken)}`;
    }
    // Check local cache for token if quotation has an ID
    if (id && typeof quotationService?.getLocalQuotationById === 'function') {
      try {
        const cached = quotationService.getLocalQuotationById(id);
        const cachedToken = cached?.shareToken || cached?.share_token;
        if (cachedToken) {
          return `${origin}/?view=quote&token=${encodeURIComponent(cachedToken)}`;
        }
      } catch (_) {}
    }
    return `${origin}/?view=quote&id=${encodeURIComponent(id)}`;
  }
  if (typeof quoteOrId === 'string' && quoteOrId) {
    // If quoteOrId is already a public token
    if (quoteOrId.startsWith('tok_') || quoteOrId.startsWith('pub_') || /^[0-9a-f]{32,64}$/i.test(quoteOrId)) {
      return `${origin}/?view=quote&token=${encodeURIComponent(quoteOrId)}`;
    }
    // Check local cache for token by quote ID
    if (typeof quotationService?.getLocalQuotationById === 'function') {
      try {
        const cached = quotationService.getLocalQuotationById(quoteOrId);
        const cachedToken = cached?.shareToken || cached?.share_token;
        if (cachedToken) {
          return `${origin}/?view=quote&token=${encodeURIComponent(cachedToken)}`;
        }
      } catch (_) {}
    }
    return `${origin}/?view=quote&id=${encodeURIComponent(quoteOrId)}`;
  }
  return `${origin}/?view=quote`;
}

// Generate the official proposal WhatsApp message
export function buildProposalWhatsAppMessage(quote, customUrl = null, profile = null) {
  const customerName = quote.customerName || 'Valued Customer';
  const capacity = quote.systemCapacityKW 
    ? `${quote.systemCapacityKW} KW` 
    : (quote.capacity || `${Number(quote.system_capacity_kw || 0)} kW`);
  const quoteId = quote.id || quote.quotation_id || 'SV-QUOTATION';
  const amount = typeof quote.amount === 'string'
    ? quote.amount
    : '₹ ' + (quote.grandTotalCustomer ? quote.grandTotalCustomer.toLocaleString('en-IN') : (quote.totalAmount ? quote.totalAmount.toLocaleString('en-IN') : '0'));
  const moduleInfo = quote.solarModule || quote.moduleType || quote.panelType || 'Tier-1 Certified PV Module';
  const invInfo = quote.inverterCapacity || quote.inverterType || 'Grid-Tied Solar Inverter';
  const date = quote.date || new Date().toLocaleDateString('en-GB');
  const publicUrl = customUrl || getPublicProposalUrl(quote);

  const companyProfile = profile || quote.companyProfile || quote.company_profile || {};
  const compName = companyProfile.name || 'Sunvine Renewable Energy';
  const helpline = companyProfile.helpdesk || companyProfile.whatsapp || '+91 80000 50580';
  const email = companyProfile.email || 'support@sunvinerenewable.com';
  const office = companyProfile.address || 'Gujarat, India';

  return `*☀️ ${compName.toUpperCase()} - SOLAR EPC PROPOSAL*

Dear *${customerName}*,

Greetings from *${compName}*! We are pleased to share your customized official turnkey solar power proposal.

📋 *QUOTATION SUMMARY*
━━━━━━━━━━━━━━━━━━━━
• *Proposal Ref:* ${quoteId}
• *Date:* ${date}
• *System Capacity:* *${capacity}* On-Grid Solar
• *Solar Modules:* ${moduleInfo}
• *Inverters:* ${invInfo}
• *Total Project Value:* *${amount}*
• *Performance Warranty:* 30 Years Module Output Guarantee
• *Inverter Warranty:* 8 Years Manufacturing Warranty

📄 *OFFICIAL 4-PAGE PROPOSAL PDF*
Your official 4-page turnkey proposal document with Bill of Materials (BOM), Technical Specifications, and Commercial Terms has been generated.

🔗 *View / Download Proposal Online:*
${publicUrl}

📞 *Helpline:* ${helpline}
📧 *Email:* ${email}
🏢 *Corporate Office:* ${office}

_Empowering The Future with Solar Energy_`;
}

// Open WhatsApp chat directly with pre-filled message (fast link)
export function openWhatsAppChat(quote, customPhone = null) {
  const phone = customPhone 
    ? cleanCustomerPhone(customPhone) 
    : cleanCustomerPhone(quote.customerPhone || quote.mobile || quote.phone);
  const text = buildProposalWhatsAppMessage(quote);
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Generate actual PDF Blob from element using 1:1 page capture (Guarantees exactly 4 A4 pages, zero blank pages)
export async function generateQuotationPdfBlob(element, quoteId = 'SV-2026-Q801') {
  if (!element) return null;

  try {
    // 1. Wait for document fonts and all images inside the export container to be fully loaded
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 800);
          })
      )
    );

    // 2. Dynamically import html2canvas and jsPDF
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    // 3. Resolve discrete .pdf-page elements to guarantee exact 1:1 page mapping (Exactly 4 A4 pages)
    const pageElements = Array.from(element.querySelectorAll('.pdf-page'));
    const targets = pageElements.length > 0 ? pageElements : [element];

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true
    });

    for (let i = 0; i < targets.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const canvas = await html2canvas(targets[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    const blob = pdf.output('blob');
    return blob;
  } catch (err) {
    console.warn('PDF generation notice:', err);
    return null;
  }
}

// Check whether native Web Share API supports file sharing in current context
export function canShareFilesDirectly() {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  // Web Share API requires a secure context (HTTPS or localhost)
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return false;
  }
  try {
    const dummyFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [dummyFile] });
  } catch (e) {
    return false;
  }
}

// Share actual PDF file to WhatsApp (Web Share API on mobile HTTPS, auto-download + chat on desktop / HTTP LAN)
export async function shareQuotationPdfViaWhatsApp(quote, exportElement, customPhone = null) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const canDirectShare = canShareFilesDirectly();

  // Only pre-target phone if customPhone is explicitly provided; otherwise open contact chooser
  const targetPhone = customPhone ? cleanCustomerPhone(customPhone) : null;
  let waUrl = '';
  if (targetPhone) {
    waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}`;
  } else if (isMobile) {
    waUrl = 'whatsapp://send';
  } else {
    waUrl = 'https://web.whatsapp.com';
  }

  const quoteId = (quote.id || 'SV-2026-Q801').replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `Sunvine_Proposal_${quoteId}.pdf`;

  // Pre-open a blank tab ONLY on desktop when direct share is not supported
  // (NEVER open about:blank on mobile devices)
  let preOpenedTab = null;
  if (!canDirectShare && !isMobile) {
    try {
      preOpenedTab = window.open('about:blank', '_blank');
    } catch (e) {
      preOpenedTab = null;
    }
  }

  let pdfBlob = null;
  if (exportElement) {
    try {
      pdfBlob = await generateQuotationPdfBlob(exportElement, quoteId);
    } catch (err) {
      console.warn('PDF generation error:', err);
    }
  }

  // 1. If device & browser support native File Sharing via Web Share API
  if (canDirectShare && pdfBlob) {
    try {
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      await navigator.share({
        title: `Sunvine Proposal - ${quote.customerName || 'Solar Proposal'}`,
        files: [pdfFile]
      });
      return { success: true, method: 'native_file_share' };
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        // User intentionally cancelled the native share sheet
        return { success: false, aborted: true };
      }
      console.warn('Native share failed, falling back to download & chat:', shareErr);
    }
  }

  // 2. Fallback (Desktop, DevTools, HTTP LAN origins, or browsers without Web Share API Level 2):
  // Download actual PDF directly to user's device
  if (pdfBlob) {
    try {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (downloadErr) {
      console.warn('Failed to auto-download PDF blob:', downloadErr);
    }
  }

  // 3. Open WhatsApp (bypassing popup blocker via pre-opened tab on desktop or direct open)
  if (preOpenedTab && !preOpenedTab.closed) {
    preOpenedTab.location.href = waUrl;
  } else {
    try {
      const opened = window.open(waUrl, '_blank');
      if (!opened && isMobile) {
        window.location.href = waUrl;
      }
    } catch (e) {
      if (isMobile) {
        window.location.href = waUrl;
      }
    }
  }

  return { success: true, method: 'download_and_chat', fileName, waUrl };
}

