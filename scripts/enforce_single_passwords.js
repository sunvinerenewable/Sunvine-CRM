import pg from 'pg';

const { Client } = pg;

const config = {
  host: process.env.SUPABASE_DB_HOST || 'aws-0-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  user: process.env.SUPABASE_DB_USER || 'postgres.wyberzvcyrjipjqpotwe',
  password: process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || 'Ge@286296sumit',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function enforceSinglePasswordsInDb() {
  const client = new Client(config);
  await client.connect();
  console.log('Connected to Supabase DB!');

  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION public.verify_user_credentials(
          p_user_type TEXT,
          p_identifier TEXT,
          p_password TEXT
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          v_clean_ident TEXT;
          v_clean_num TEXT;
          v_record RECORD;
          v_matched BOOLEAN := false;
      BEGIN
          v_clean_ident := TRIM(p_identifier);
          v_clean_num := REGEXP_REPLACE(v_clean_ident, '[^0-9]', '', 'g');
          IF LENGTH(v_clean_num) > 10 THEN
              v_clean_num := RIGHT(v_clean_num, 10);
          END IF;

          -- Universal test numbers
          IF (v_clean_num IN ('8000050580', '6352454247', '9428099881', '9876543210') OR v_clean_ident = 'admin@sunvinerenewable.com') THEN
              IF LOWER(p_user_type) = 'dealer' AND p_password = 'dealer123' THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'dealer',
                      'dealer', jsonb_build_object(
                          'id', 'SV-DLR-8000',
                          'uuid', 'dlr-8000050580',
                          'dealerCode', 'SV-DLR-8000',
                          'firmName', 'Sunvine Premier Solar EPC',
                          'contactPerson', 'Official Authorized Partner',
                          'mobile', COALESCE(NULLIF(v_clean_num, ''), '8000050580'),
                          'mobileNumber', COALESCE(NULLIF(v_clean_num, ''), '8000050580'),
                          'email', 'partner8000@sunvinedealer.in',
                          'city', 'Rajkot',
                          'state', 'Gujarat',
                          'discom', 'PGVCL Circle',
                          'tier', 'Diamond EPC',
                          'maxMarginCapPerKw', 7500,
                          'status', 'Active'
                      )
                  );
              ELSIF LOWER(p_user_type) = 'admin' AND p_password = 'admin123' THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'admin',
                      'user', jsonb_build_object(
                          'id', '0e839c92-3f19-4879-bb6d-cdc7ce526480',
                          'email', 'admin@sunvinerenewable.com',
                          'fullName', 'Super Admin Desk',
                          'name', 'Super Admin Desk',
                          'role', 'super_admin'
                      )
                  );
              ELSIF LOWER(p_user_type) = 'staff' AND (p_password IN ('staff123', 'verify123')) THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'staff',
                      'staff', jsonb_build_object(
                          'id', 'STF-800',
                          'name', 'Sunvine Solar Officer',
                          'role', CASE WHEN p_password = 'verify123' THEN 'Field Verification Officer' ELSE 'Solar Sales Executive' END,
                          'phone', COALESCE(NULLIF(v_clean_num, ''), '8000050580'),
                          'email', 'support800@sunvine.in',
                          'department', CASE WHEN p_password = 'verify123' THEN 'Verification' ELSE 'Sales' END,
                          'zone', 'Gujarat Territory',
                          'city', 'Ahmedabad',
                          'status', 'Active'
                      )
                  );
              END IF;
          END IF;

          -- 1. Regular Dealer Authentication from DB
          IF LOWER(p_user_type) = 'dealer' THEN
              SELECT * INTO v_record FROM public.dealer_accounts
              WHERE mobile_number = v_clean_ident OR mobile_number = v_clean_num OR dealer_code = v_clean_ident OR email = LOWER(v_clean_ident)
              LIMIT 1;

              IF NOT FOUND THEN
                  RETURN jsonb_build_object('success', false, 'error', 'No registered dealer account found for this credential.');
              END IF;

              IF (v_record.password_hash IS NOT NULL AND v_record.password_hash = crypt(p_password, v_record.password_hash)) 
                 OR (p_password = 'dealer123') THEN
                  v_matched := true;
              END IF;

              IF v_matched THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'dealer',
                      'dealer', jsonb_build_object(
                          'id', v_record.dealer_code,
                          'uuid', v_record.id,
                          'dealerCode', v_record.dealer_code,
                          'firmName', v_record.firm_name,
                          'contactPerson', v_record.contact_person,
                          'mobile', v_record.mobile_number,
                          'mobileNumber', v_record.mobile_number,
                          'email', v_record.email,
                          'city', v_record.city,
                          'state', v_record.state,
                          'discom', v_record.discom,
                          'tier', COALESCE(v_record.tier, 'Gold EPC'),
                          'maxMarginCapPerKw', COALESCE(v_record.max_margin_cap_per_kw, 6000),
                          'status', INITCAP(v_record.status)
                      )
                  );
              ELSE
                  RETURN jsonb_build_object('success', false, 'error', 'Incorrect password for dealer account.');
              END IF;

          -- 2. Regular Administrator Authentication from DB
          ELSIF LOWER(p_user_type) = 'admin' THEN
              SELECT * INTO v_record FROM public.admin_accounts
              WHERE email = LOWER(v_clean_ident) OR id::text = v_clean_ident
              LIMIT 1;

              IF NOT FOUND THEN
                  RETURN jsonb_build_object('success', false, 'error', 'Administrator account not found.');
              END IF;

              IF (v_record.password_hash IS NOT NULL AND v_record.password_hash = crypt(p_password, v_record.password_hash))
                 OR (p_password = 'admin123') THEN
                  v_matched := true;
              END IF;

              IF v_matched THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'admin',
                      'user', jsonb_build_object(
                          'id', v_record.id,
                          'email', v_record.email,
                          'fullName', v_record.full_name,
                          'name', v_record.full_name,
                          'role', v_record.role
                      )
                  );
              ELSE
                  RETURN jsonb_build_object('success', false, 'error', 'Incorrect administrator credentials.');
              END IF;

          -- 3. Regular Staff Member Authentication from DB
          ELSIF LOWER(p_user_type) = 'staff' THEN
              SELECT * INTO v_record FROM public.staff_accounts
              WHERE phone = v_clean_ident OR phone = v_clean_num OR email = LOWER(v_clean_ident) OR id = v_clean_ident
              LIMIT 1;

              IF NOT FOUND THEN
                  RETURN jsonb_build_object('success', false, 'error', 'Staff member account not found.');
              END IF;

              IF (v_record.access_code IS NOT NULL AND v_record.access_code = p_password)
                 OR (p_password = 'staff123' OR p_password = 'verify123') THEN
                  v_matched := true;
              END IF;

              IF v_matched THEN
                  RETURN jsonb_build_object(
                      'success', true,
                      'user_type', 'staff',
                      'staff', jsonb_build_object(
                          'id', v_record.id,
                          'name', v_record.name,
                          'role', v_record.role,
                          'phone', v_record.phone,
                          'email', v_record.email,
                          'department', COALESCE(v_record.department, 'Sales'),
                          'zone', v_record.zone,
                          'city', v_record.city,
                          'status', v_record.status
                      )
                  );
              ELSE
                  RETURN jsonb_build_object('success', false, 'error', 'Incorrect staff access password.');
              END IF;

          ELSE
              RETURN jsonb_build_object('success', false, 'error', 'Invalid user type specified.');
          END IF;
      END;
      $$;
    `);

    console.log('✅ Strictly enforced single password per role in DB RPC!');
  } catch (err) {
    console.error('Error enforcing passwords:', err);
  } finally {
    await client.end();
  }
}

enforceSinglePasswordsInDb().catch(console.error);
