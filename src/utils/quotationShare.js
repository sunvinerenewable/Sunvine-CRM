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
    const id = quoteOrId.id || '';
    const shareToken = quoteOrId.shareToken || quoteOrId.share_token;
    if (shareToken) {
      return `${origin}/?view=quote&token=${encodeURIComponent(shareToken)}`;
    }
    return `${origin}/?view=quote&id=${encodeURIComponent(id)}`;
  }
  return `${origin}/?view=quote&id=${encodeURIComponent(quoteOrId || '')}`;
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
  if (quote && quote.id) {
    quotationService.saveQuotation(quote).catch(() => {});
  }
  const phone = customPhone 
    ? cleanCustomerPhone(customPhone) 
    : cleanCustomerPhone(quote.customerPhone || quote.mobile || quote.phone);
  const text = buildProposalWhatsAppMessage(quote);
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Generate actual PDF Blob from element using html2pdf (lazy loaded on demand)
export async function generateQuotationPdfBlob(element, quoteId = 'SV-2026-Q801') {
  if (!element) return null;

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;

    const opt = {
      margin: 0,
      filename: `Sunvine_Proposal_${quoteId}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    const worker = html2pdf().set(opt).from(element);
    const blob = await worker.output('blob');
    return blob;
  } catch (err) {
    console.warn('PDF generation notice:', err);
    return null;
  }
}

// Share actual PDF file to WhatsApp (Web Share API on mobile, auto-download + chat on desktop)
export async function shareQuotationPdfViaWhatsApp(quote, exportElement, customPhone = null) {
  if (quote && quote.id) {
    quotationService.saveQuotation(quote).catch(() => {});
  }
  const phone = customPhone 
    ? cleanCustomerPhone(customPhone) 
    : cleanCustomerPhone(quote.customerPhone || quote.mobile || quote.phone);
  const text = buildProposalWhatsAppMessage(quote);
  const quoteId = (quote.id || 'SV-2026-Q801').replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `Sunvine_Proposal_${quoteId}.pdf`;
  const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

  // On desktop browser, pre-open window synchronously to prevent Chrome popup blocker
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  let preOpenedTab = null;
  if (!isMobile) {
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

  // 1. If Mobile device supports native File Sharing via Web Share API
  if (isMobile && pdfBlob && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Sunvine Proposal - ${quote.customerName}`,
          text: text,
          files: [pdfFile]
        });
        return { success: true, method: 'native_file_share' };
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      console.warn('Native share failed, falling back:', shareErr);
    }
  }

  // 2. Fallback / Desktop: Download actual PDF directly to user's device
  if (pdfBlob) {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }

  // 3. Navigate pre-opened tab to WhatsApp (bypassing popup blocker)
  if (preOpenedTab && !preOpenedTab.closed) {
    preOpenedTab.location.href = waUrl;
  } else {
    // Fallback if tab was not pre-opened
    window.open(waUrl, '_blank') || (window.location.href = waUrl);
  }

  return { success: true, method: 'download_and_chat', fileName, waUrl };
}

