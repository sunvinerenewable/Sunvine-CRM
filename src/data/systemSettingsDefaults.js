// Sunvine Renewable Energy — Master System Settings & Dynamic Business Rules
// Eliminates hardcoded business rules throughout the platform

export const DEFAULT_SYSTEM_SETTINGS = {
  general: {
    companyName: 'Sunvine Renewable Energy',
    tagline: 'Empowering Gujarat with Clean Solar Energy',
    gstin: '',
    email: 'support@sunvinerenewable.com',
    phone: '',
    helpline: '',
    address: '',
    website: 'https://sunvinerenewable.com',
    currency: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY'
  },
  fileLifecycle: {
    stages: [
      'Lead',
      'Quotation',
      'Customer Confirmed',
      'Documentation',
      'Registration',
      'Processing',
      'Installation',
      'Meter & Subsidy',
      'Completed'
    ],
    statuses: [
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
    ],
    financeTypes: ['CASH', 'LOAN'],
    loanBanks: [
      'State Bank of India',
      'Bank of Baroda',
      'HDFC Bank Ltd.',
      'ICICI Bank',
      'Canara Bank',
      'Union Bank of India',
      'Punjab National Bank',
      'Other NBFC'
    ],
    sourceTypes: ['DIRECT_STAFF', 'DEALER', 'DIRECT_ADMIN', 'OTHER'],
    failureReasons: [
      'DISCOM roof structural load inspection failed',
      'Consumer sanctioned load limit exceeded',
      'Incomplete KYC or Aadhaar verification failure',
      'Negative feeder capacity at distribution transformer',
      'Customer financial unviability'
    ],
    cancellationReasons: [
      'Customer opted out / postponed project',
      'Bank solar loan application rejected',
      'Relocating to another premises',
      'Duplicate inquiry'
    ]
  },
  quotationRules: {
    validityDays: 15,
    prefix: 'SV-2026-Q',
    defaultCapacityKw: 3.3,
    maxDealerMarginPerKw: 8000,
    minDealerMarginPerKw: 0,
    requireAdminApprovalAboveKw: 100,
    enforceAlmm: true,
    pmSuryaGharActive: true,
    baseRateResidentialPerKw: 59800,
    baseRateCiPerKw: 24000,
    quoteFooterText: 'Computer-generated proposal by Sunvine Renewable Energy. Subject to DISCOM net-metering sanctions.'
  },
  rolesAndPermissions: {
    admin: {
      canViewAllDealers: true,
      canViewAllStaff: true,
      canViewAllFiles: true,
      canViewAllQuotations: true,
      canEditSettings: true,
      canViewAuditLogs: true,
      canExportReports: true,
      canManageCredentials: true
    },
    staff: {
      canViewAssignedDealers: true,
      canViewOwnFiles: true,
      canCreateCustomerFiles: true,
      canGenerateDirectQuotes: true,
      canViewOwnPerformance: true,
      canExportReports: true
    },
    dealer: {
      canGenerateQuotes: true,
      canViewOwnQuotes: true,
      canViewOwnFiles: true,
      canViewOwnPerformance: true,
      canUpdateDealerProfile: true
    }
  },
  notificationsConfig: {
    emailAlerts: true,
    inAppAlerts: true,
    smsAlerts: false,
    whatsAppReady: true,
    quoteExpiryReminderDays: 3,
    fileStatusChangeAlert: true
  },
  documentPolicies: {
    aboutText: 'Sunvine Renewable Energy is an enterprise solar EPC and business management platform empowering Gujarat with distributed clean energy generation. The platform connects 550+ verified channel partners, field executives, and DISCOMs into one unified digital ecosystem.',
    termsAndConditions: `1. Validity: Quotations generated are valid for 15 days from issuance date.
2. Compliance: All photovoltaic modules supplied conform strictly to MNRE ALMM List-I and IEC 61215/61730 standards.
3. Subsidies: PM Surya Ghar Muft Bijli Yojana Central DBT subsidies are disbursed directly to customer bank accounts post-inspection by DISCOM.
4. Scope: Net meter bi-directional charges are subject to actual DISCOM circulars.
5. Workmanship: Standard 5-year comprehensive on-site installation and balance of system (BOS) workmanship warranty is provided.`,
    privacyPolicy: `Sunvine Renewable Energy is committed to safeguarding customer personal identification data, electricity bills, and bank passbooks.
1. All documents uploaded are securely archived and transmitted with cryptographic hashing.
2. Customer contact information is solely utilized for solar proposal delivery, DISCOM application processing, and subsidy disbursements.
3. Under no circumstances is commercial dealer or customer data shared with third-party advertising brokers.`,
    dataUsagePolicy: `Customer files, GPS location tags, and rooftop blueprint photos collected via the portal are strictly utilized for:
- 2D CAD blueprint layout sizing and 3D shadow obstruction modeling.
- GEDA (Gujarat Energy Development Agency) solar portal net-metering compliance.
- PM Surya Ghar National Portal Direct Benefit Transfer (DBT) verification.`,
    dealerAgreement: `Channel Partner Code of Conduct:
1. Transparency: Dealers must quote within the statutory margin caps established by Sunvine Renewable Energy.
2. Equipment Integrity: No non-ALMM or unapproved inverter models may be substituted without headquarters authorization.
3. Customer Service: Channel partners are responsible for prompt site surveys, accurate consumer number recording, and civil foundation safety.`,
    staffPolicy: `Field Sales Executives & Area Managers:
1. Site Verification: Field executives must verify actual rooftop dimensions and identify obstacles (mumty, water tanks, trees).
2. Dealer Support: Sales officers are responsible for supporting their assigned dealer partners with timely document collection and DISCOM liaison.
3. Accurate Attribution: All customer files must accurately tag the originating dealer partner or direct acquisition source.`,
    quotationTerms: `1. 10% advance with purchase order, 90% prior to dispatch.
2. Inverter warranty: 8 years manufacturer replacement warranty.
3. Module performance warranty: 30 years linear degradation warranty (>80% output at year 30).
4. Statutory taxes: 18% statutory solar GST included.`,
    cancellationPolicy: `1. 100% advance refund is guaranteed if distribution transformer capacity saturation or DISCOM technical unviability occurs prior to equipment procurement.
2. Cancellations initiated after structural material fabrication are subject to a nominal restocking fee.`,
    disclaimer: `Solar electricity generation forecasts are calculated assuming standard Gujarat annual solar insolation (approx. 5.5 peak sun hours per day). Actual generation may vary depending on local weather conditions, dust accumulation, tilt angle, and regular maintenance.`
  }
};

export const INITIAL_AUDIT_LOGS = [
  {
    id: 'LOG-001',
    user: 'Super Admin Desk',
    role: 'admin',
    action: 'SYSTEM_BOOT',
    module: 'System Architecture',
    recordId: 'SYS-GLOBAL',
    timestamp: '2026-09-27T08:00:00Z',
    details: 'Sunvine Business Management Platform 2.5 initialized with 550 Gujarat dealers.'
  },
  {
    id: 'LOG-002',
    user: 'Super Admin Desk',
    role: 'admin',
    action: 'DEALER_STAFF_ASSIGNED',
    module: 'Dealer Management',
    recordId: 'SV-DLR-0104',
    timestamp: '2026-09-27T09:15:00Z',
    details: 'Dealer SV-DLR-0104 assigned to Sales Officer Jayesh Patel (STF-001).'
  },
  {
    id: 'LOG-003',
    user: 'Jayesh Patel',
    role: 'staff',
    action: 'CUSTOMER_FILE_CREATED',
    module: 'Customer Files',
    recordId: 'FIL-2026-081',
    timestamp: '2026-09-27T10:30:00Z',
    details: 'Customer file created for Rameshchandra K. Dave via Dealer SV-DLR-0104.'
  },
  {
    id: 'LOG-004',
    user: 'Rajesh Kumar',
    role: 'dealer',
    action: 'QUOTATION_GENERATED',
    module: 'Quotation Engine',
    recordId: 'SV-2026-Q801',
    timestamp: '2026-09-27T11:45:00Z',
    details: '5.5 kW Residential Solar proposal generated with PM Surya Ghar subsidy.'
  },
  {
    id: 'LOG-005',
    user: 'Super Admin Desk',
    role: 'admin',
    action: 'POLICY_ENFORCED',
    module: 'Master Governance',
    recordId: 'GOV-MARGIN',
    timestamp: '2026-09-27T14:20:00Z',
    details: 'National maximum dealer margin ceiling enforced at ₹8,000 / kW.'
  }
];
