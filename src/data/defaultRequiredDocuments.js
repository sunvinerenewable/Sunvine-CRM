// Sunvine Renewable Energy — Master Document Requirements Configuration
// Categorized by customer application type (Residential, Commercial, Common Meter)

export const APPLICATION_CATEGORIES = [
  { id: 'residential', label: 'Residential Rooftop (1 kW - 10 kW)', icon: 'home', desc: 'Individual domestic connections under PM Surya Ghar Muft Bijli Yojana' },
  { id: 'commercial', label: 'Commercial & Industrial (C&I)', icon: 'corporate_fare', desc: 'Offices, factories, warehouses, and non-domestic grid connections' },
  { id: 'common_meter', label: 'Housing Society / Common Meter', icon: 'apartment', desc: 'Residential welfare associations (RWA), high-rises, and common utility meters' }
];

export const DEFAULT_REQUIRED_DOCUMENTS = [
  {
    id: 'doc-light-bill',
    key: 'lightBill',
    label: 'Electricity / Light Bill',
    description: 'Latest DISCOM electricity bill copy (within past 2 months)',
    icon: 'electric_bolt',
    categories: ['residential', 'commercial', 'common_meter'],
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
    mandatory: false,
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    captureMode: 'image'
  }
];
