// Sunvine Renewable Energy — Master Document Requirements Configuration
// Categorized by customer application type (Residential, Commercial, Common Meter)

export const APPLICATION_CATEGORIES = [
  { id: 'residential', label: 'Residential Rooftop (1 kW - 10 kW)', icon: 'home', desc: 'Individual domestic connections under PM Surya Ghar Muft Bijli Yojana' },
  { id: 'commercial', label: 'Commercial & Industrial (C&I)', icon: 'corporate_fare', desc: 'Offices, factories, warehouses, and non-domestic grid connections' },
  { id: 'common_meter', label: 'Housing Society / Common Meter', icon: 'apartment', desc: 'Residential welfare associations (RWA), high-rises, and common utility meters' }
];

export const DEFAULT_PIPELINE_STAGES = [
  { id: 'LEAD_SOURCED', label: '1. Lead Sourced & Feasibility Check', description: 'Customer inquiry recorded, initial solar feasibility verified', mandatory: true },
  { id: 'SITE_SURVEY', label: '2. Site Feasibility & Roof CAD Survey', description: 'Rooftop measurements, tilt angle, and shadow profiling', mandatory: true },
  { id: 'QUOTATION_ACCEPTED', label: '3. Quotation Accepted & Advance Token', description: 'Customer confirms proposal and pays booking advance', mandatory: true },
  { id: 'DISCOM_APPLICATION', label: '4. DISCOM Net-Meter Application Filed', description: 'Formal submission to PGVCL/UGVCL/DGVCL/MGVCL web portal', mandatory: true },
  { id: 'FEASIBILITY_APPROVAL', label: '5. Technical Feasibility & Sanction Approved', description: 'DISCOM site inspection clearance and technical sanction letter', mandatory: true },
  { id: 'PLANT_INSTALLATION', label: '6. Solar Hardware Installation (Modules & Inverter)', description: 'Module mounting structure, solar PV panels, and inverter commissioning', mandatory: true },
  { id: 'CEI_INSPECTION', label: '7. Safety CEI Drawing Inspection', description: 'Chief Electrical Inspectorate safety approval for systems > 10 kW', mandatory: false },
  { id: 'NET_METER_SYNC', label: '8. Bidirectional Net-Meter Grid Energization', description: 'Installation of bi-directional meter and synchronisation with power grid', mandatory: true },
  { id: 'SUBSIDY_CLAIM', label: '9. PM Surya Ghar DBT Claim Verification', description: 'Uploading commissioning certificate on National Portal for central subsidy', mandatory: true },
  { id: 'HANDOVER_COMPLETED', label: '10. Commissioned & Handed Over with Warranty Pack', description: 'Plant handover to customer with manufacturer warranty documentation', mandatory: true }
];

export const DEFAULT_REQUIRED_DOCUMENTS = [
  {
    id: 'doc-light-bill',
    key: 'lightBill',
    label: 'Electricity / Light Bill',
    description: 'Latest DISCOM electricity bill copy (within past 2 months)',
    icon: 'electric_bolt',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: {
      residential: true,
      commercial: true,
      common_meter: true
    },
    mandatoryCategories: ['residential', 'commercial', 'common_meter'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both' // direct camera image or file
  },
  {
    id: 'doc-aadhaar',
    key: 'aadhaar',
    label: 'Customer Aadhaar Card (KYC)',
    description: 'Front & back copy of consumer UIDAI identity proof',
    icon: 'badge',
    categories: ['residential', 'common_meter'],
    categoryMandatory: {
      residential: true,
      common_meter: true,
      commercial: false
    },
    mandatoryCategories: ['residential', 'common_meter'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  },
  {
    id: 'doc-pan',
    key: 'pan',
    label: 'PAN Card Copy',
    description: 'Required for central subsidy direct DBT transfer and taxation',
    icon: 'credit_card',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: {
      residential: false,
      commercial: true,
      common_meter: false
    },
    mandatoryCategories: ['commercial'],
    mandatory: false,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  },
  {
    id: 'doc-property-tax',
    key: 'propertyTax',
    label: 'Property Tax Bill / Index-2',
    description: 'Proof of premises ownership / municipal municipal tax paid receipt',
    icon: 'home_work',
    categories: ['residential', 'commercial'],
    categoryMandatory: {
      residential: false,
      commercial: false
    },
    mandatoryCategories: [],
    mandatory: false,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-rooftop-survey',
    key: 'rooftopPhoto',
    label: 'Rooftop Site Survey Photo / Video',
    description: 'Clear photograph or walkthrough video of terrace shadow area',
    icon: 'solar_power',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: {
      residential: false,
      commercial: true,
      common_meter: false
    },
    mandatoryCategories: ['commercial'],
    mandatory: false,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.webm'],
    captureMode: 'both' // direct camera photo or video recording
  },
  {
    id: 'doc-meter-photo',
    key: 'meterPhoto',
    label: 'Existing Energy Meter Photo',
    description: 'Front snapshot showing DISCOM meter serial number and reading',
    icon: 'speed',
    categories: ['residential', 'commercial', 'common_meter'],
    categoryMandatory: {
      residential: false,
      commercial: false,
      common_meter: false
    },
    mandatoryCategories: [],
    mandatory: false,
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  },
  {
    id: 'doc-gst-cert',
    key: 'gstCert',
    label: 'GST Registration Certificate',
    description: 'Mandatory commercial establishment GSTIN certificate',
    icon: 'receipt_long',
    categories: ['commercial'],
    categoryMandatory: {
      commercial: true
    },
    mandatoryCategories: ['commercial'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-society-noc',
    key: 'societyNoc',
    label: 'Housing Society NOC / Resolution',
    description: 'Signed Management Committee resolution allowing terrace solar installation',
    icon: 'domain',
    categories: ['common_meter'],
    categoryMandatory: {
      common_meter: true
    },
    mandatoryCategories: ['common_meter'],
    mandatory: true,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    captureMode: 'both'
  },
  {
    id: 'doc-passport-photo',
    key: 'passportPhoto',
    label: 'Passport Size Photograph',
    description: 'Recent portrait photo of the registered electricity bill holder',
    icon: 'person',
    categories: ['residential'],
    categoryMandatory: {
      residential: false
    },
    mandatoryCategories: [],
    mandatory: false,
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  }
];

/**
 * Checks whether a given document is marked as mandatory for a specific application category
 */
export function isDocMandatoryForCategory(doc, categoryId) {
  if (!doc) return false;
  if (!categoryId) return Boolean(doc.mandatory);
  if (doc.categoryMandatory && typeof doc.categoryMandatory[categoryId] === 'boolean') {
    return doc.categoryMandatory[categoryId];
  }
  if (Array.isArray(doc.mandatoryCategories)) {
    return doc.mandatoryCategories.includes(categoryId);
  }
  return Boolean(doc.mandatory && (doc.categories || []).includes(categoryId));
}
