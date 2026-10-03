import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// Load .env manually
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
  console.log('NO_DB_URL');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS public.document_master (
  key VARCHAR(100) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Applicant KYC',
  description TEXT,
  icon VARCHAR(50) DEFAULT 'description',
  allowed_extensions JSONB DEFAULT '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb,
  rules JSONB NOT NULL DEFAULT '{"RESIDENTIAL": "mandatory", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.document_master ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_master' AND policyname = 'Allow select on document_master'
  ) THEN
    CREATE POLICY "Allow select on document_master" ON public.document_master FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_master' AND policyname = 'Allow modify on document_master'
  ) THEN
    CREATE POLICY "Allow modify on document_master" ON public.document_master FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.document_master (key, label, category, description, icon, allowed_extensions, rules, is_custom)
VALUES
('aadhaarCard', 'Aadhaar Card', 'Applicant KYC', 'Front & back copy of consumer UIDAI identity proof', 'badge', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "mandatory", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('bankDetails', 'Bank Details / Passbook', 'Subsidy & Financials', 'Bank passbook copy or cancelled cheque for subsidy / disbursement', 'account_balance', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "mandatory", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('lightBill', 'Light / Electricity Bill', 'Premises & Utility', 'Latest DISCOM electricity power bill copy', 'bolt', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "mandatory", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('panCard', 'PAN Card', 'Applicant KYC', 'Income tax PAN card copy of primary applicant / entity', 'credit_card', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "optional", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('veraBill', 'Vera Bill (Property Tax)', 'Ownership Proof', 'Municipal property tax paid receipt / Vera bill / Index-2 copy', 'apartment', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "optional", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('sitePhotos', 'Pre-Installation Site Photo', 'Site Inspection', 'Terrace structure and shadow-free rooftop installation area', 'photo_camera', '["*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "optional", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('coApplicantPan', 'Co-Applicant PAN Card', 'Co-Applicant KYC', 'PAN card copy of loan co-applicant / spouse / co-owner', 'credit_card', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "optional", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "disabled", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('coApplicantAadhaar', 'Co-Applicant Aadhaar Card', 'Co-Applicant KYC', 'Aadhaar card copy of loan co-applicant / spouse', 'badge', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "disabled", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('coApplicantBank', 'Co-Applicant Bank Detail', 'Co-Applicant Financials', 'Co-borrower bank passbook or 6-month statement', 'account_balance', '["*.pdf", "*.jpg", "*.jpeg", "*.png", "*.webp"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "mandatory", "NBFC_LOAN": "mandatory", "COMMERCIAL": "disabled", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('jointPhoto', 'Joint Photo / Undertaking', 'Documentation', 'Signed customer undertaking or joint applicant photo', 'photo_camera', '["*.jpg", "*.jpeg", "*.png", "*.webp", "*.pdf"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "optional", "NBFC_LOAN": "optional", "COMMERCIAL": "disabled", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('gstCertificate', 'GST Registration Certificate', 'Commercial & Legal', 'GST registration certificate (Form GST REG-06) for C&I projects', 'receipt_long', '["*.pdf", "*.jpg", "*.png"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "disabled", "NBFC_LOAN": "disabled", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('factoryLayout', 'Factory Layout & Roof Structural Certificate', 'Engineering', 'Plant blueprint and structural engineer stability certificate', 'factory', '["*.pdf", "*.jpg", "*.png"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "disabled", "NBFC_LOAN": "disabled", "COMMERCIAL": "mandatory", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('ceiApproval', 'CEI Electrical Safety Approval', 'Technical Approvals', 'Chief Electrical Inspectorate clearance for >10kW solar system', 'verified', '["*.pdf", "*.jpg", "*.png"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "disabled", "NBFC_LOAN": "disabled", "COMMERCIAL": "optional", "HOUSING_SOCIETY": "disabled"}'::jsonb, false),
('societyNoc', 'Society NOC & Committee Resolution', 'Society Approvals', 'Housing Society / RWA No-Objection Certificate for common meter', 'domain', '["*.pdf", "*.jpg", "*.png"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "disabled", "NBFC_LOAN": "disabled", "COMMERCIAL": "disabled", "HOUSING_SOCIETY": "mandatory"}'::jsonb, false),
('msmeCertificate', 'MSME / Udyam Registration', 'Commercial Subsidy', 'Udyam registration certificate for MSME solar concession', 'assignment', '["*.pdf", "*.jpg", "*.png"]'::jsonb, '{"RESIDENTIAL": "disabled", "BANK_LOAN": "disabled", "NBFC_LOAN": "disabled", "COMMERCIAL": "optional", "HOUSING_SOCIETY": "disabled"}'::jsonb, false)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  allowed_extensions = EXCLUDED.allowed_extensions,
  rules = EXCLUDED.rules,
  updated_at = NOW();
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');
    await client.query(sql);
    console.log('SUCCESS: Table "document_master" created and 15 document cards seeded successfully!');
    const countRes = await client.query('SELECT COUNT(*) FROM public.document_master;');
    console.log(`Current rows in document_master: ${countRes.rows[0].count}`);
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

run();
