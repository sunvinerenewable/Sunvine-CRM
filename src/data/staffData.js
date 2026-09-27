// Sunvine Renewable Energy - Staff, Customer Files & Nearby Radar Dataset

export const GUJARAT_CITIES_COORDS = {
  'Ahmedabad': { lat: 23.0225, lon: 72.5714, discom: 'UGVCL' },
  'Gandhinagar': { lat: 23.2156, lon: 72.6369, discom: 'UGVCL' },
  'Rajkot': { lat: 22.3039, lon: 70.8022, discom: 'PGVCL' },
  'Surat': { lat: 21.1702, lon: 72.8311, discom: 'DGVCL' },
  'Vadodara': { lat: 22.3072, lon: 73.1812, discom: 'MGVCL' },
  'Bhavnagar': { lat: 21.7645, lon: 72.1519, discom: 'PGVCL' },
  'Jamnagar': { lat: 22.4707, lon: 70.0577, discom: 'PGVCL' },
  'Junagadh': { lat: 21.5222, lon: 70.4579, discom: 'PGVCL' },
  'Anand': { lat: 22.5645, lon: 72.9289, discom: 'MGVCL' },
  'Bharuch': { lat: 21.7051, lon: 72.9959, discom: 'DGVCL' },
  'Navsari': { lat: 20.9467, lon: 72.9230, discom: 'DGVCL' },
  'Mehsana': { lat: 23.5880, lon: 72.3693, discom: 'UGVCL' },
  'Morbi': { lat: 22.8120, lon: 70.8378, discom: 'PGVCL' }
};

export const DEFAULT_STAFF = [
  {
    id: 'STF-001',
    name: 'Jayesh Patel',
    role: 'Senior Solar Field Executive',
    phone: '9825112345',
    email: 'jayesh.patel@sunvine.in',
    accessCode: 'dealer123',
    zone: 'Ahmedabad & Gandhinagar (UGVCL)',
    city: 'Ahmedabad',
    lat: 23.0225,
    lon: 72.5714,
    status: 'Active',
    onboardedDate: '2026-01-10',
    dealersCount: 14,
    directFilesCount: 8,
    dealerFilesCount: 24
  },
  {
    id: 'STF-002',
    name: 'Hardik Chauhan',
    role: 'Area Sales Manager',
    phone: '9898267890',
    email: 'hardik.c@sunvine.in',
    accessCode: 'dealer123',
    zone: 'Rajkot & Saurashtra (PGVCL)',
    city: 'Rajkot',
    lat: 22.3039,
    lon: 70.8022,
    status: 'Active',
    onboardedDate: '2026-01-15',
    dealersCount: 18,
    directFilesCount: 12,
    dealerFilesCount: 38
  },
  {
    id: 'STF-003',
    name: 'Nilesh Vaghela',
    role: 'Field Verification Officer',
    phone: '9724055443',
    email: 'nilesh.v@sunvine.in',
    accessCode: 'dealer123',
    zone: 'Surat & South Gujarat (DGVCL)',
    city: 'Surat',
    lat: 21.1702,
    lon: 72.8311,
    status: 'Active',
    onboardedDate: '2026-02-01',
    dealersCount: 11,
    directFilesCount: 7,
    dealerFilesCount: 19
  },
  {
    id: 'STF-004',
    name: 'Bhavin Shah',
    role: 'Central Gujarat Sales Representative',
    phone: '9428099881',
    email: 'bhavin.s@sunvine.in',
    accessCode: 'dealer123',
    zone: 'Vadodara & Anand (MGVCL)',
    city: 'Vadodara',
    lat: 22.3072,
    lon: 73.1812,
    status: 'Active',
    onboardedDate: '2026-02-12',
    dealersCount: 9,
    directFilesCount: 5,
    dealerFilesCount: 14
  }
];

// Helper to reliably assign a staff member to any dealer based on zone or city
export const STAFF_ZONE_MAP = {
  UGVCL: 'STF-001',
  PGVCL: 'STF-002',
  DGVCL: 'STF-003',
  MGVCL: 'STF-004'
};

export function getAssignedStaffForDealer(dealer) {
  if (dealer.assignedStaffId) {
    const s = DEFAULT_STAFF.find(st => st.id === dealer.assignedStaffId);
    return {
      assignedStaffId: dealer.assignedStaffId,
      assignedStaffName: dealer.assignedStaffName || (s ? s.name : 'Jayesh Patel')
    };
  }
  const discom = (dealer.discom || '').toUpperCase();
  const staffId = STAFF_ZONE_MAP[discom] || (dealer.city === 'Rajkot' ? 'STF-002' : 'STF-001');
  const staff = DEFAULT_STAFF.find(s => s.id === staffId) || DEFAULT_STAFF[0];
  return {
    assignedStaffId: staff.id,
    assignedStaffName: staff.name
  };
}

export const DEFAULT_FILE_LIFECYCLE_STAGES = [
  'Lead',
  'Quotation',
  'Customer Confirmed',
  'Documentation',
  'Registration',
  'Processing',
  'Installation',
  'Meter & Subsidy',
  'Completed'
];

export const DEFAULT_FILE_STATUSES = [
  'Sourced',
  'Verification',
  'DISCOM Registered',
  'Installation Pending',
  'Subsidized',
  'Completed',
  'On Hold',
  'Returned',
  'Failed',
  'Cancelled',
  'Rejected'
];

export const DEFAULT_CUSTOMER_FILES = [
  {
    id: 'FIL-2026-081',
    customerName: 'Rameshchandra K. Dave',
    phone: '+91 98250 44123',
    address: 'Plot 42, Shubh Residency, Science City Road, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0784,
    lon: 72.5085,
    discom: 'UGVCL',
    consumerNo: 'UGVCL-AHM-902819',
    sanctionedLoadKw: 6.0,
    solarSystemKw: 5.5,
    roofType: 'RCC Flat Terrace (L-Shape)',
    // Attribution & Source
    sourceType: 'DEALER',
    dealerId: 'SV-DLR-0104',
    dealerName: 'Sunline Solar Solutions',
    staffId: 'STF-001',
    staffName: 'Jayesh Patel',
    financeType: 'LOAN',
    loanBank: 'State Bank of India',
    amount: 295000,
    quotationId: 'SV-2026-Q801',
    // Lifecycle Status
    status: 'DISCOM Registered',
    currentStage: 'Installation',
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-20',
    updatedDate: '2026-09-26',
    applicationNo: 'GEDA-PMSY-2026-90412',
    notes: 'Site visit completed, customer ready for mounting structure install.',
    timeline: [
      { stage: 'Quotation Created', date: '2026-09-20', actor: 'Dealer Rajesh Kumar', notes: '5.5 kW Residential mono PERC quote generated' },
      { stage: 'Customer Confirmed', date: '2026-09-21', actor: 'Staff Jayesh Patel', notes: 'Token advance received via SBI Solar Loan' },
      { stage: 'Documents Submitted', date: '2026-09-22', actor: 'Staff Jayesh Patel', notes: 'Light bill and Aadhaar verified' },
      { stage: 'Registration Completed', date: '2026-09-25', actor: 'Admin Desk', notes: 'GEDA net-meter sanction received' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_ramesh_dave.pdf', date: '2026-09-20' },
      lightBill: { uploaded: true, filename: 'ugvcl_bill_aug2026.pdf', date: '2026-09-20' },
      meterPhoto: { uploaded: true, filename: 'meter_reading_6kw.jpg', date: '2026-09-21' },
      sitePhoto: { uploaded: true, filename: 'rooftop_drone_elevation.jpg', date: '2026-09-21' },
      bankPassbook: { uploaded: true, filename: 'sbi_cheque_subsidy.pdf', date: '2026-09-22' }
    }
  },
  {
    id: 'FIL-2026-082',
    customerName: 'Pravinbhai M. Solanki',
    phone: '+91 94270 33882',
    address: 'B-12, Radhe Krishna Bungalows, Kalawad Road, Rajkot',
    city: 'Rajkot',
    lat: 22.2850,
    lon: 70.7712,
    discom: 'PGVCL',
    consumerNo: 'PGVCL-RJK-781920',
    sanctionedLoadKw: 4.0,
    solarSystemKw: 3.3,
    roofType: 'RCC Flat Roof',
    // Attribution & Source
    sourceType: 'DEALER',
    dealerId: 'SV-DLR-0001',
    dealerName: 'Gujarat Solar Tech',
    staffId: 'STF-002',
    staffName: 'Hardik Chauhan',
    financeType: 'CASH',
    loanBank: null,
    amount: 198000,
    quotationId: 'SV-2026-Q802',
    status: 'Verification',
    currentStage: 'Documentation',
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-22',
    updatedDate: '2026-09-25',
    applicationNo: 'GEDA-PMSY-2026-90488',
    notes: 'Documents under review for load sanity check.',
    timeline: [
      { stage: 'Quotation Created', date: '2026-09-22', actor: 'Dealer Suresh Bhai', notes: '3.3 kW Cash purchase proposal' },
      { stage: 'Customer Confirmed', date: '2026-09-23', actor: 'Dealer Suresh Bhai', notes: '100% Cash payment schedule agreed' },
      { stage: 'Documentation', date: '2026-09-24', actor: 'Staff Hardik Chauhan', notes: 'Aadhaar uploaded, site photo pending' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_solanki.pdf', date: '2026-09-22' },
      lightBill: { uploaded: true, filename: 'pgvcl_bill_sep2026.pdf', date: '2026-09-22' },
      meterPhoto: { uploaded: true, filename: 'meter_closeup.jpg', date: '2026-09-23' },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: true, filename: 'bob_passbook.pdf', date: '2026-09-23' }
    }
  },
  {
    id: 'FIL-2026-083',
    customerName: 'Jagdishbhai H. Patel',
    phone: '+91 98790 12099',
    address: 'Near Ambaji Temple, Adajan, Surat',
    city: 'Surat',
    lat: 21.1959,
    lon: 72.7933,
    discom: 'DGVCL',
    consumerNo: 'DGVCL-SRT-665412',
    sanctionedLoadKw: 10.0,
    solarSystemKw: 10.0,
    roofType: 'Industrial Shed & RCC Terrace',
    // Attribution & Source
    sourceType: 'DIRECT_STAFF',
    dealerId: null,
    dealerName: null,
    staffId: 'STF-003',
    staffName: 'Nilesh Vaghela',
    financeType: 'CASH',
    loanBank: null,
    amount: 485000,
    quotationId: 'SV-2026-Q803',
    status: 'Completed',
    currentStage: 'Completed',
    isCompleted: true,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-18',
    updatedDate: '2026-09-27',
    applicationNo: 'GEDA-PMSY-2026-88719',
    notes: 'DBT subsidy credited to customer bank account. 100% Commissioned.',
    timeline: [
      { stage: 'Quotation Created', date: '2026-09-18', actor: 'Staff Nilesh Vaghela', notes: '10kW Turnkey proposal' },
      { stage: 'Registration', date: '2026-09-20', actor: 'Staff Nilesh Vaghela', notes: 'DGVCL Net-meter applied' },
      { stage: 'Installation', date: '2026-09-23', actor: 'Installation Team', notes: 'Modules & Inverter mounted' },
      { stage: 'Meter & Subsidy', date: '2026-09-26', actor: 'Admin Desk', notes: 'Bi-directional meter synced' },
      { stage: 'Completed', date: '2026-09-27', actor: 'Central Ops', notes: 'Project commissioned & subsidy released' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_jagdish.pdf', date: '2026-09-18' },
      lightBill: { uploaded: true, filename: 'dgvcl_bill_aug.pdf', date: '2026-09-18' },
      meterPhoto: { uploaded: true, filename: 'bidirectional_meter.jpg', date: '2026-09-19' },
      sitePhoto: { uploaded: true, filename: 'installed_site_view.jpg', date: '2026-09-24' },
      bankPassbook: { uploaded: true, filename: 'axis_bank_statement.pdf', date: '2026-09-19' }
    }
  },
  {
    id: 'FIL-2026-084',
    customerName: 'Anilbhai K. Mehta',
    phone: '+91 99099 87654',
    address: '4, Sardar Society, Gotri Road, Vadodara',
    city: 'Vadodara',
    lat: 22.3150,
    lon: 73.1520,
    discom: 'MGVCL',
    consumerNo: 'MGVCL-BRD-551209',
    sanctionedLoadKw: 5.0,
    solarSystemKw: 4.4,
    roofType: 'RCC Flat Terrace',
    // Attribution & Source
    sourceType: 'DIRECT_STAFF',
    dealerId: null,
    dealerName: null,
    staffId: 'STF-004',
    staffName: 'Bhavin Shah',
    financeType: 'LOAN',
    loanBank: 'HDFC Bank Ltd.',
    amount: 245000,
    quotationId: 'SV-2026-Q804',
    status: 'Sourced',
    currentStage: 'Lead',
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-25',
    updatedDate: '2026-09-25',
    applicationNo: 'Draft Pending',
    notes: 'Initial quotation shared via WhatsApp link. Customer comparing loan rates.',
    timeline: [
      { stage: 'Lead', date: '2026-09-25', actor: 'Staff Bhavin Shah', notes: 'Initial customer consultation' },
      { stage: 'Quotation Created', date: '2026-09-25', actor: 'Staff Bhavin Shah', notes: '4.4 kW HDFC loan proposal sent' }
    ],
    documents: {
      aadhaar: { uploaded: false, filename: null, date: null },
      lightBill: { uploaded: false, filename: null, date: null },
      meterPhoto: { uploaded: false, filename: null, date: null },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: false, filename: null, date: null }
    }
  },
  {
    id: 'FIL-2026-085',
    customerName: 'Manish R. Joshi',
    phone: '+91 98241 87612',
    address: '15, Suryam Sky, Bopal, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0338,
    lon: 72.4634,
    discom: 'UGVCL',
    consumerNo: 'UGVCL-BOP-331092',
    sanctionedLoadKw: 4.0,
    solarSystemKw: 3.3,
    roofType: 'RCC Flat Roof',
    // Attribution & Source
    sourceType: 'DEALER',
    dealerId: 'SV-DLR-0104',
    dealerName: 'Sunline Solar Solutions',
    staffId: 'STF-001',
    staffName: 'Jayesh Patel',
    financeType: 'CASH',
    loanBank: null,
    amount: 195000,
    quotationId: 'SV-2026-Q805',
    status: 'On Hold',
    currentStage: 'Documentation',
    isCompleted: false,
    isFailed: false,
    failureReason: 'Customer out of town until next week',
    createdDate: '2026-09-24',
    updatedDate: '2026-09-26',
    applicationNo: 'Draft Pending',
    notes: 'Customer interested in Mono PERC 550W setup. On hold for site access.',
    timeline: [
      { stage: 'Lead', date: '2026-09-24', actor: 'Dealer Rajesh Kumar', notes: 'Inquiry received' },
      { stage: 'Quotation', date: '2026-09-24', actor: 'Dealer Rajesh Kumar', notes: 'Proposal delivered' },
      { stage: 'On Hold', date: '2026-09-26', actor: 'Staff Jayesh Patel', notes: 'Follow-up paused on customer request' }
    ],
    documents: {
      aadhaar: { uploaded: false, filename: null, date: null },
      lightBill: { uploaded: false, filename: null, date: null },
      meterPhoto: { uploaded: false, filename: null, date: null },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: false, filename: null, date: null }
    }
  },
  {
    id: 'FIL-2026-086',
    customerName: 'Kiritbhai D. Patel',
    phone: '+91 97250 11988',
    address: 'Near Madhav Hall, Mavdi Main Road, Rajkot',
    city: 'Rajkot',
    lat: 22.2612,
    lon: 70.7845,
    discom: 'PGVCL',
    consumerNo: 'PGVCL-MVD-889102',
    sanctionedLoadKw: 6.0,
    solarSystemKw: 5.5,
    roofType: 'RCC Open Terrace',
    // Attribution & Source
    sourceType: 'DEALER',
    dealerId: 'SV-DLR-0001',
    dealerName: 'Gujarat Solar Tech',
    staffId: 'STF-002',
    staffName: 'Hardik Chauhan',
    financeType: 'LOAN',
    loanBank: 'Bank of Baroda',
    amount: 305000,
    quotationId: 'SV-2026-Q806',
    status: 'Completed',
    currentStage: 'Completed',
    isCompleted: true,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-23',
    updatedDate: '2026-09-27',
    applicationNo: 'GEDA-PMSY-2026-91102',
    notes: 'Net meter installation completed. Ready for subsidy credit.',
    timeline: [
      { stage: 'Quotation', date: '2026-09-23', actor: 'Dealer Suresh Bhai', notes: 'Quotation created' },
      { stage: 'Documentation', date: '2026-09-24', actor: 'Staff Hardik Chauhan', notes: 'Bank of Baroda loan sanctioned' },
      { stage: 'Installation', date: '2026-09-25', actor: 'Field Tech', notes: 'Rooftop mounting done' },
      { stage: 'Completed', date: '2026-09-27', actor: 'Admin Desk', notes: 'PGVCL inspection cleared' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_kirit.pdf', date: '2026-09-23' },
      lightBill: { uploaded: true, filename: 'pgvcl_bill.pdf', date: '2026-09-23' },
      meterPhoto: { uploaded: true, filename: 'meter.jpg', date: '2026-09-24' },
      sitePhoto: { uploaded: true, filename: 'site.jpg', date: '2026-09-24' },
      bankPassbook: { uploaded: true, filename: 'passbook.pdf', date: '2026-09-24' }
    }
  },
  {
    id: 'FIL-2026-087',
    customerName: 'Shailesh M. Vora',
    phone: '+91 98980 44556',
    address: '88, Royal Heights, Ring Road, Rajkot',
    city: 'Rajkot',
    lat: 22.2910,
    lon: 70.7810,
    discom: 'PGVCL',
    consumerNo: 'PGVCL-RJK-339912',
    sanctionedLoadKw: 5.0,
    solarSystemKw: 4.4,
    roofType: 'RCC Terrace',
    // Attribution & Source
    sourceType: 'DEALER',
    dealerId: 'SV-DLR-0002',
    dealerName: 'Patel Solar Services',
    staffId: 'STF-002',
    staffName: 'Hardik Chauhan',
    financeType: 'LOAN',
    loanBank: 'ICICI Bank',
    amount: 248000,
    quotationId: 'SV-2026-Q807',
    status: 'Failed',
    currentStage: 'Registration',
    isCompleted: false,
    isFailed: true,
    failureReason: 'DISCOM roof structural load inspection failed (unsafe parapet)',
    createdDate: '2026-09-15',
    updatedDate: '2026-09-22',
    applicationNo: 'GEDA-PMSY-2026-77810',
    notes: 'File rejected by PGVCL inspector due to unsafe parapet height.',
    timeline: [
      { stage: 'Quotation', date: '2026-09-15', actor: 'Dealer Patel Solar', notes: '4.4 kW quotation' },
      { stage: 'Documentation', date: '2026-09-17', actor: 'Staff Hardik Chauhan', notes: 'Loan documents uploaded' },
      { stage: 'Failed', date: '2026-09-22', actor: 'PGVCL Inspector', notes: 'Rejected: Unsafe structural parapet load' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_vora.pdf', date: '2026-09-15' },
      lightBill: { uploaded: true, filename: 'bill_pgvcl.pdf', date: '2026-09-15' },
      meterPhoto: { uploaded: false, filename: null, date: null },
      sitePhoto: { uploaded: false, filename: null, date: null },
      bankPassbook: { uploaded: false, filename: null, date: null }
    }
  },
  {
    id: 'FIL-2026-088',
    customerName: 'Bipinbhai S. Gajjar',
    phone: '+91 97140 99881',
    address: 'Near Sona Complex, Satellite, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0290,
    lon: 72.5290,
    discom: 'UGVCL',
    consumerNo: 'UGVCL-AHM-112233',
    sanctionedLoadKw: 8.0,
    solarSystemKw: 6.6,
    roofType: 'RCC Flat Roof',
    // Attribution & Source
    sourceType: 'DIRECT_STAFF',
    dealerId: null,
    dealerName: null,
    staffId: 'STF-001',
    staffName: 'Jayesh Patel',
    financeType: 'CASH',
    loanBank: null,
    amount: 365000,
    quotationId: 'SV-2026-Q808',
    status: 'Completed',
    currentStage: 'Completed',
    isCompleted: true,
    isFailed: false,
    failureReason: null,
    createdDate: '2026-09-10',
    updatedDate: '2026-09-24',
    applicationNo: 'GEDA-PMSY-2026-88190',
    notes: 'Direct field acquisition. 100% commissioned and running.',
    timeline: [
      { stage: 'Lead', date: '2026-09-10', actor: 'Staff Jayesh Patel', notes: 'Door-to-door field acquisition' },
      { stage: 'Customer Confirmed', date: '2026-09-11', actor: 'Staff Jayesh Patel', notes: 'Full cash payment advance' },
      { stage: 'Installation', date: '2026-09-16', actor: 'Installation Team', notes: '6.6 kW Topcon modules erected' },
      { stage: 'Completed', date: '2026-09-24', actor: 'Admin Desk', notes: 'Meter installed and verified' }
    ],
    documents: {
      aadhaar: { uploaded: true, filename: 'aadhaar_bipin.pdf', date: '2026-09-10' },
      lightBill: { uploaded: true, filename: 'bill_ugvcl.pdf', date: '2026-09-10' },
      meterPhoto: { uploaded: true, filename: 'meter_active.jpg', date: '2026-09-17' },
      sitePhoto: { uploaded: true, filename: 'site_complete.jpg', date: '2026-09-17' },
      bankPassbook: { uploaded: true, filename: 'passbook_sbi.pdf', date: '2026-09-11' }
    }
  }
];

export const NEARBY_SOLAR_LEADS = [
  // Ahmedabad Leads
  {
    id: 'LEAD-AHM-01',
    name: 'Dilipbhai S. Shah',
    phone: '+91 98252 77112',
    address: 'Surdhara Circle, Thaltej, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0520,
    lon: 72.5180,
    requiredKw: 5.0,
    discom: 'UGVCL',
    urgency: 'Hot (Ready to Book)',
    estimatedSubsidy: '₹78,000',
    type: 'Residential Bungalow'
  },
  {
    id: 'LEAD-AHM-02',
    name: 'Girishbhai K. Prajapati',
    phone: '+91 98981 44332',
    address: 'Near SP Ring Road, Nikol, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0480,
    lon: 72.6710,
    requiredKw: 3.3,
    discom: 'UGVCL',
    urgency: 'Medium (Survey Required)',
    estimatedSubsidy: '₹78,000',
    type: 'Row House Terrace'
  },
  {
    id: 'LEAD-AHM-03',
    name: 'Sanjay V. Panchal',
    phone: '+91 97129 88441',
    address: 'Shilaj Gam Road, South Bopal, Ahmedabad',
    city: 'Ahmedabad',
    lat: 23.0390,
    lon: 72.4720,
    requiredKw: 6.6,
    discom: 'UGVCL',
    urgency: 'Hot (Ready to Book)',
    estimatedSubsidy: '₹78,000',
    type: 'Duplex Flat Terrace'
  },
  // Rajkot Leads
  {
    id: 'LEAD-RJK-01',
    name: 'Mansukhbhai G. Dabhi',
    phone: '+91 94282 33119',
    address: 'Near Nana Mava Chowk, 150 Feet Ring Road, Rajkot',
    city: 'Rajkot',
    lat: 22.2810,
    lon: 70.7690,
    requiredKw: 3.3,
    discom: 'PGVCL',
    urgency: 'Hot (Looking for Subsidy Guidance)',
    estimatedSubsidy: '₹78,000',
    type: 'Independent House'
  },
  {
    id: 'LEAD-RJK-02',
    name: 'Ashokbhai P. Vora',
    phone: '+91 98242 99001',
    address: 'Kuvadva Road, Near Marketing Yard, Rajkot',
    city: 'Rajkot',
    lat: 22.3210,
    lon: 70.8350,
    requiredKw: 10.0,
    discom: 'PGVCL',
    urgency: 'Commercial Enquiry',
    estimatedSubsidy: '₹78,000 (Commercial Cap)',
    type: 'Commercial Godown Roof'
  },
  // Surat Leads
  {
    id: 'LEAD-SRT-01',
    name: 'Chiragbhai M. Kanani',
    phone: '+91 98241 55667',
    address: 'Mota Varachha, Near VIP Circle, Surat',
    city: 'Surat',
    lat: 21.2380,
    lon: 72.8790,
    requiredKw: 4.4,
    discom: 'DGVCL',
    urgency: 'Hot (Visit Tomorrow)',
    estimatedSubsidy: '₹78,000',
    type: 'Residential Tenement'
  },
  {
    id: 'LEAD-SRT-02',
    name: 'Hareshbhai T. Golakiya',
    phone: '+91 99250 88223',
    address: 'Althan Canal Road, Vesu, Surat',
    city: 'Surat',
    lat: 21.1420,
    lon: 72.7910,
    requiredKw: 5.5,
    discom: 'DGVCL',
    urgency: 'Medium',
    estimatedSubsidy: '₹78,000',
    type: 'Penthouse Terrace'
  },
  // Vadodara Leads
  {
    id: 'LEAD-BRD-01',
    name: 'Mayankbhai J. Bhatt',
    phone: '+91 98255 11990',
    address: 'Vasna Road, Near D-Mart, Vadodara',
    city: 'Vadodara',
    lat: 22.2890,
    lon: 73.1550,
    requiredKw: 3.3,
    discom: 'MGVCL',
    urgency: 'Hot (Quotation Requested)',
    estimatedSubsidy: '₹78,000',
    type: 'Residential Society'
  },
  {
    id: 'LEAD-BRD-02',
    name: 'Vijay R. Sharma',
    phone: '+91 94260 44551',
    address: 'Waghodia Road, Near Parul University, Vadodara',
    city: 'Vadodara',
    lat: 22.3010,
    lon: 73.2380,
    requiredKw: 8.0,
    discom: 'MGVCL',
    urgency: 'Medium',
    estimatedSubsidy: '₹78,000',
    type: 'Hostel RCC Terrace'
  }
];

// Haversine formula to compute great-circle distance between two GPS coordinates in Kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
