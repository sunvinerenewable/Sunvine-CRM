import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

let env = {};
try {
  const content = fs.readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[k] = v;
    }
  }
} catch (e) {}

const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  await client.connect();
  console.log('✅ Connected to PostgreSQL database!');

  // Check current tables
  const currentTablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('📊 Existing public tables:', currentTablesRes.rows.map(r => r.table_name));

  const migrations = [
    {
      name: '001_customer_files_cancellation_columns',
      sql: `
        ALTER TABLE public.customer_files 
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
      `
    },
    {
      name: '002_numeric_prices_migration',
      sql: `
        ALTER TABLE public.solar_modules
          ADD COLUMN IF NOT EXISTS rate_per_wp_inr NUMERIC(8,4);

        UPDATE public.solar_modules
        SET rate_per_wp_inr = (
          regexp_replace(rate_per_wp, '[^0-9.]', '', 'g')::NUMERIC
        )
        WHERE rate_per_wp_inr IS NULL
          AND rate_per_wp ~ '[0-9]+\\.?[0-9]*';

        ALTER TABLE public.solar_inverters
          ADD COLUMN IF NOT EXISTS base_price VARCHAR(50),
          ADD COLUMN IF NOT EXISTS base_price_inr NUMERIC(12,2);

        UPDATE public.solar_inverters i
        SET 
          base_price_inr = bm.benchmark_price,
          base_price = '₹ ' || to_char(bm.benchmark_price, 'FM999,999,999.00')
        FROM public.inverter_benchmark_matrix bm
        WHERE i.capacity_kw = bm.capacity_kw
          AND (i.base_price_inr IS NULL OR i.base_price IS NULL);

        UPDATE public.solar_inverters
        SET base_price_inr = (
          regexp_replace(base_price, '[^0-9.]', '', 'g')::NUMERIC
        )
        WHERE base_price_inr IS NULL
          AND base_price IS NOT NULL
          AND base_price ~ '[0-9]+\\.?[0-9]*';
      `
    },
    {
      name: '003_staff_and_dealer_sync',
      sql: `
        CREATE TABLE IF NOT EXISTS public.staff_accounts (
            id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL,
            department VARCHAR(50) NOT NULL DEFAULT 'sales',
            phone VARCHAR(20),
            mobile_number VARCHAR(15) UNIQUE,
            email VARCHAR(255) UNIQUE,
            password_hash TEXT NOT NULL,
            zone VARCHAR(255) DEFAULT 'Gujarat',
            city VARCHAR(100) DEFAULT 'Ahmedabad',
            status VARCHAR(50) DEFAULT 'active',
            dealers_count INTEGER DEFAULT 0,
            direct_files_count INTEGER DEFAULT 0,
            dealer_files_count INTEGER DEFAULT 0,
            pipeline_kw NUMERIC(10,2) DEFAULT 0,
            rating NUMERIC(3,2) DEFAULT 4.9,
            onboarded_date VARCHAR(30) DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD'),
            created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'phone') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN phone VARCHAR(20);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'mobile_number') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN mobile_number VARCHAR(15);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'department') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT 'sales';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'dealers_count') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN dealers_count INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'direct_files_count') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN direct_files_count INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'dealer_files_count') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN dealer_files_count INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'pipeline_kw') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN pipeline_kw NUMERIC(10,2) DEFAULT 0;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'rating') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN rating NUMERIC(3,2) DEFAULT 4.9;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = 'onboarded_date') THEN
                ALTER TABLE public.staff_accounts ADD COLUMN onboarded_date VARCHAR(30) DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD');
            END IF;
        END $$;

        UPDATE public.staff_accounts
        SET mobile_number = phone
        WHERE mobile_number IS NULL AND phone IS NOT NULL;

        UPDATE public.staff_accounts
        SET phone = mobile_number
        WHERE phone IS NULL AND mobile_number IS NOT NULL;
      `
    },
    {
      name: '004_dealer_salesman_attribution',
      sql: `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dealer_accounts' AND column_name = 'assigned_staff_id') THEN
            ALTER TABLE public.dealer_accounts 
                ALTER COLUMN assigned_staff_id SET DEFAULT 'STF-DIRECT';
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dealer_accounts' AND column_name = 'assigned_staff_name') THEN
            ALTER TABLE public.dealer_accounts 
                ALTER COLUMN assigned_staff_name SET DEFAULT 'Direct to Company (HQ Desk)';
          END IF;
        END $$;

        UPDATE public.dealer_accounts
        SET 
            assigned_staff_id = 'STF-802',
            assigned_staff_name = 'mayank vekariya',
            pricing_config = jsonb_set(
                COALESCE(pricing_config, '{}'::jsonb), 
                '{assignedStaffId}', 
                '"STF-802"'
            ),
            updated_at = NOW()
        WHERE dealer_code = 'SV-DLR-0851';

        UPDATE public.dealer_accounts
        SET 
            assigned_staff_id = 'STF-801',
            assigned_staff_name = 'Sunvine Sales Staff',
            pricing_config = jsonb_build_object(
                'assignedStaffId', 'STF-801',
                'assignedStaffName', 'Sunvine Sales Staff'
            ),
            updated_at = NOW()
        WHERE dealer_code = 'SV-DLR-8000';

        UPDATE public.dealer_accounts
        SET 
            assigned_staff_id = 'STF-DIRECT',
            assigned_staff_name = 'Direct to Company (HQ Desk)',
            updated_at = NOW()
        WHERE assigned_staff_id = 'STF-001' 
           OR assigned_staff_id IS NULL 
           OR assigned_staff_id = '';

        UPDATE public.staff_accounts s
        SET 
            dealers_count = (
                SELECT COUNT(*) 
                FROM public.dealer_accounts d 
                WHERE d.assigned_staff_id = s.id
            ),
            updated_at = NOW();
      `
    },
    {
      name: '005_push_subscriptions_table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(64) NOT NULL,
          role VARCHAR(32) NOT NULL,
          endpoint TEXT UNIQUE NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_push_subs_role ON public.push_subscriptions(role);
        CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
      `
    },
    {
      name: '006_system_settings_and_audit_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS public.system_settings (
            id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
            company_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
            terms_and_warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
            statutory_taxes JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id VARCHAR(100),
            user_email VARCHAR(255),
            user_role VARCHAR(50),
            details JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );

        CREATE TABLE IF NOT EXISTS public.notifications (
            id VARCHAR(100) PRIMARY KEY,
            audience VARCHAR(50) DEFAULT 'all',
            type VARCHAR(50) DEFAULT 'info',
            icon VARCHAR(100) DEFAULT 'notifications',
            title VARCHAR(255) NOT NULL,
            description TEXT,
            is_release BOOLEAN DEFAULT false,
            version VARCHAR(50),
            target_tab VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        );
      `
    },
    {
      name: '007_quotation_enhancements_and_views',
      sql: `
        ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS share_token TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_share_token ON public.quotations(share_token)
          WHERE share_token IS NOT NULL;

        UPDATE public.quotations
        SET share_token = md5(id || clock_timestamp()::text || random()::text)
        WHERE share_token IS NULL;

        CREATE OR REPLACE VIEW public.dealers AS SELECT * FROM public.dealer_accounts;
        CREATE OR REPLACE VIEW public.admin_users AS SELECT * FROM public.admin_accounts;
        CREATE OR REPLACE VIEW public.staff_users AS SELECT * FROM public.staff_accounts;
      `
    },
    {
      name: '008_cancelled_files_14_day_retention',
      sql: `
        ALTER TABLE public.customer_files 
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

        CREATE INDEX IF NOT EXISTS idx_customer_files_cancelled_retention 
        ON public.customer_files (status, cancelled_at) 
        WHERE status = 'Cancelled';

        CREATE OR REPLACE FUNCTION purge_expired_cancelled_file_documents()
        RETURNS INTEGER AS $$
        DECLARE
            purged_count INTEGER;
        BEGIN
            UPDATE public.customer_files
            SET documents = '{}'::jsonb,
                updated_at = NOW()
            WHERE status = 'Cancelled'
              AND cancelled_at IS NOT NULL
              AND cancelled_at < NOW() - INTERVAL '14 days'
              AND documents IS NOT NULL
              AND documents::text != '{}'
              AND documents::text != 'null';
            
            GET DIAGNOSTICS purged_count = ROW_COUNT;
            RETURN purged_count;
        END;
        $$ LANGUAGE plpgsql;
      `
    },
    {
      name: '009_audit_logs_comprehensive_schema_and_rls',
      sql: `
        ALTER TABLE public.audit_logs 
          ADD COLUMN IF NOT EXISTS module VARCHAR(100),
          ADD COLUMN IF NOT EXISTS record_id VARCHAR(100),
          ADD COLUMN IF NOT EXISTS user_id VARCHAR(100),
          ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
          ADD COLUMN IF NOT EXISTS role VARCHAR(100),
          ADD COLUMN IF NOT EXISTS old_value JSONB,
          ADD COLUMN IF NOT EXISTS new_value JSONB,
          ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100),
          ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'VERIFIED',
          ADD COLUMN IF NOT EXISTS table_name VARCHAR(100),
          ADD COLUMN IF NOT EXISTS actor_id VARCHAR(100),
          ADD COLUMN IF NOT EXISTS actor_role VARCHAR(100);

        ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL;
        ALTER TABLE public.audit_logs ALTER COLUMN entity_type SET DEFAULT 'GENERAL';
        ALTER TABLE public.audit_logs ALTER COLUMN action DROP NOT NULL;
        ALTER TABLE public.audit_logs ALTER COLUMN action SET DEFAULT 'SYSTEM_ACTION';
        ALTER TABLE public.audit_logs ALTER COLUMN details SET DEFAULT '{}'::jsonb;
        ALTER TABLE public.audit_logs ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());

        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs (record_id);

        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "service_role_all_audit_logs" ON public.audit_logs;
        CREATE POLICY "service_role_all_audit_logs" ON public.audit_logs
          FOR ALL TO service_role USING (true) WITH CHECK (true);

        DROP POLICY IF EXISTS "allow_insert_audit_logs" ON public.audit_logs;
        CREATE POLICY "allow_insert_audit_logs" ON public.audit_logs
          FOR INSERT TO anon, authenticated WITH CHECK (true);

        DROP POLICY IF EXISTS "allow_select_audit_logs" ON public.audit_logs;
        CREATE POLICY "allow_select_audit_logs" ON public.audit_logs
          FOR SELECT TO anon, authenticated USING (true);

        CREATE OR REPLACE VIEW public.audit_log AS SELECT * FROM public.audit_logs;
      `
    }
  ];

  for (const m of migrations) {
    try {
      console.log(`⏳ Running ${m.name}...`);
      await client.query(m.sql);
      console.log(`✅ Success: ${m.name}`);
    } catch (err) {
      console.error(`❌ Error in ${m.name}:`, err.message);
    }
  }

  // Summary of all public tables after migration
  const finalTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('\n🎉 Final tables in Supabase public schema:');
  console.table(finalTables.rows);

  await client.end();
}

runMigrations().catch(e => console.error(e));
