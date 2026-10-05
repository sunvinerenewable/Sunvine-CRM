import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[match[1]] = val;
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const documents = [
  {
    key: 'aadhaarCard',
    label: 'Aadhaar Card',
    category: 'Applicant KYC',
    description: 'Front & back copy of consumer UIDAI identity proof',
    icon: 'badge',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'bankDetails',
    label: 'Bank Details / Passbook',
    category: 'Bank & Financial',
    description: 'Bank passbook copy or cancelled cheque for subsidy / disbursement',
    icon: 'account_balance',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'lightBill',
    label: 'Light / Electricity Bill',
    category: 'Utility & Property',
    description: 'Latest DISCOM electricity power bill copy',
    icon: 'bolt',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'panCard',
    label: 'PAN Card (Owner / Entity)',
    category: 'Applicant KYC',
    description: 'Income tax PAN card copy of primary applicant / entity owner',
    icon: 'credit_card',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'veraBill',
    label: 'Vera Bill (Property Tax)',
    category: 'Utility & Property',
    description: 'Municipal property tax paid receipt / Vera bill / Index-2 copy',
    icon: 'apartment',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'sitePhotos',
    label: 'Pre-Installation Site Photo',
    category: 'Technical & Approvals',
    description: 'Terrace structure and shadow-free rooftop installation area',
    icon: 'photo_camera',
    allowed_extensions: ['image/*'],
    rules: {
      RESIDENTIAL: 'mandatory',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'optional'
    }
  },
  {
    key: 'passportPhoto',
    label: 'Passport Size Photo',
    category: 'Applicant KYC',
    description: 'Recent passport size photo of applicant / authorized signatory',
    icon: 'photo_camera',
    allowed_extensions: ['image/*'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'optional',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'coApplicantAadhaar',
    label: 'Co-Applicant Aadhaar Card',
    category: 'Co-Applicant KYC',
    description: 'Aadhaar card copy of loan co-applicant / spouse',
    icon: 'badge',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'disabled'
    }
  },
  {
    key: 'coApplicantPan',
    label: 'Co-Applicant PAN Card',
    category: 'Co-Applicant KYC',
    description: 'PAN card copy of loan co-applicant / spouse / co-owner',
    icon: 'credit_card',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'mandatory',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'disabled'
    }
  },
  {
    key: 'coApplicantBank',
    label: 'Co-Applicant Bank Detail',
    category: 'Co-Applicant KYC',
    description: 'Co-borrower bank passbook or 6-month statement',
    icon: 'account_balance',
    allowed_extensions: ['image/*', '.pdf'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'optional',
      NBFC_LOAN: 'mandatory',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'disabled'
    }
  },
  {
    key: 'undertaking',
    label: 'Customer Undertaking / Declaration',
    category: 'Commercial & Legal',
    description: 'Signed customer undertaking / declaration document',
    icon: 'contract',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'optional',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'societyNoc',
    label: 'Society NOC & Committee Resolution',
    category: 'Commercial & Legal',
    description: 'Housing Society / RWA No-Objection Certificate for common meter',
    icon: 'domain',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'optional',
      NBFC_LOAN: 'optional',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'msmeCertificate',
    label: 'MSME / Udyam Registration',
    category: 'Commercial & Legal',
    description: 'Udyam registration certificate for MSME solar concession',
    icon: 'assignment',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'gstCertificate',
    label: 'GST Registration Certificate',
    category: 'Commercial & Legal',
    description: 'GST registration certificate (Form GST REG-06) for C&I projects',
    icon: 'receipt_long',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'rentNoc',
    label: 'NOC Required (If on Rent)',
    category: 'Commercial & Legal',
    description: 'Landlord / Society No-Objection Certificate for rented premises',
    icon: 'domain',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'firmPanBank',
    label: 'Firm PAN Card / Bank Details',
    category: 'Commercial & Legal',
    description: 'Commercial firm PAN card and current account bank statement',
    icon: 'account_balance',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'ownershipDoc',
    label: 'Ownership Document (Registry / Index-2)',
    category: 'Utility & Property',
    description: 'Registered sale deed / property index-2 / title clearance',
    icon: 'apartment',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'optional',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'partnershipDeed',
    label: 'Partnership Deed / MOA-AOA',
    category: 'Commercial & Legal',
    description: 'Partnership deed, LLP agreement, or Memorandum of Association',
    icon: 'description',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'disabled',
      HOUSING_SOCIETY: 'mandatory'
    }
  },
  {
    key: 'factoryLayout',
    label: 'Factory Layout & Roof Structural Certificate',
    category: 'Technical & Approvals',
    description: 'Plant blueprint and structural engineer stability certificate',
    icon: 'factory',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'mandatory',
      HOUSING_SOCIETY: 'disabled'
    }
  },
  {
    key: 'ceiApproval',
    label: 'CEI Electrical Safety Approval',
    category: 'Technical & Approvals',
    description: 'Chief Electrical Inspectorate clearance for >10kW solar system',
    icon: 'verified',
    allowed_extensions: ['.pdf', 'image/*'],
    rules: {
      RESIDENTIAL: 'disabled',
      BANK_LOAN: 'disabled',
      NBFC_LOAN: 'disabled',
      COMMERCIAL: 'optional',
      HOUSING_SOCIETY: 'disabled'
    }
  }
];

async function updateAll() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    for (const doc of documents) {
      const query = `
        INSERT INTO public.document_master (key, label, category, description, icon, allowed_extensions, rules, is_custom, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, false, NOW())
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          allowed_extensions = EXCLUDED.allowed_extensions,
          rules = EXCLUDED.rules,
          updated_at = NOW();
      `;
      await client.query(query, [
        doc.key,
        doc.label,
        doc.category,
        doc.description,
        doc.icon,
        JSON.stringify(doc.allowed_extensions),
        JSON.stringify(doc.rules)
      ]);
    }

    console.log(`Successfully updated ${documents.length} document definitions & category rules in Supabase!`);
  } catch (err) {
    console.error('Error updating document master:', err.message);
  } finally {
    await client.end();
  }
}

updateAll();
