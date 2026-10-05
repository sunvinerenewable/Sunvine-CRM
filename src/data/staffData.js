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
    id: 'STF-800',
    name: 'Sunvine Verification Officer',
    role: 'Field Verification Officer',
    phone: '8000050580',
    email: 'desk800@sunvine.in',
    zone: 'Gujarat Verification Desk',
    city: 'Ahmedabad',
    department: 'Verification',
    status: 'Active',
    onboardedDate: '2026-10-02',
    dealersCount: 1,
    directFilesCount: 0,
    dealerFilesCount: 0
  },
  {
    id: 'STF-801',
    name: 'Sunvine Sales Staff',
    role: 'Senior Solar Field Executive',
    phone: '8000050580',
    email: 'sales800@sunvine.in',
    zone: 'Gujarat Sales Desk',
    city: 'Ahmedabad',
    department: 'Sales',
    status: 'Active',
    onboardedDate: '2026-10-02',
    dealersCount: 1,
    directFilesCount: 0,
    dealerFilesCount: 0
  }
];

// Helper to reliably assign a staff member to any dealer based on zone or city
export const STAFF_ZONE_MAP = {
  UGVCL: 'STF-801',
  PGVCL: 'STF-801',
  DGVCL: 'STF-801',
  MGVCL: 'STF-801'
};

export function getAssignedStaffForDealer(dealer) {
  if (!dealer) {
    return {
      assignedStaffId: 'STF-DIRECT',
      assignedStaffName: 'Direct to Company (HQ Desk)'
    };
  }
  const targetId = dealer.assignedStaffId || dealer.pricingConfig?.assignedStaffId;
  if (targetId === 'STF-DIRECT') {
    return {
      assignedStaffId: 'STF-DIRECT',
      assignedStaffName: 'Direct to Company (HQ Desk)'
    };
  }
  if (targetId && targetId !== 'STF-001') {
    const s = DEFAULT_STAFF.find(st => st.id === targetId);
    return {
      assignedStaffId: targetId,
      assignedStaffName: dealer.assignedStaffName || (s ? s.name : 'Sunvine Sales Staff')
    };
  }
  return {
    assignedStaffId: 'STF-DIRECT',
    assignedStaffName: 'Direct to Company (HQ Desk)'
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

export const DEFAULT_CUSTOMER_FILES = [];

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
