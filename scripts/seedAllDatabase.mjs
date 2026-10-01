import pg from 'pg';
import { GUJARAT_DEALERS, PDF_BOS_PRICE_MATRIX, GUJARAT_MODULES, GUJARAT_INVERTERS, SUNVINE_OFFICIAL_PROFILE } from '../src/data/gujaratDatabase.js';
import { DEFAULT_STAFF, DEFAULT_CUSTOMER_FILES } from '../src/data/staffData.js';
import { SOLAR_LOAN_PROVIDERS } from '../src/data/solarBanksData.js';
import { STANDARD_BOM_CATALOG } from '../src/data/standardBomData.js';
import { DEFAULT_SYSTEM_SETTINGS } from '../src/data/systemSettingsDefaults.js';
import { DEFAULT_PRICING_MASTER, INITIAL_QUOTATIONS, DEFAULT_NOTIFICATIONS } from '../src/data/defaultPresets.js';
const DEFAULT_GOVERNANCE_SETTINGS = {
  enforceAlmm: true,
  pmSuryaGharActive: true,
  maxDealerMarginPerKW: 8000,
  minDealerMarginPerKW: 0,
  quoteExpiryDays: 15,
  autoGedaSync: true,
  requireAdminApprovalAboveKW: 100,
  retentionMonths: 36,
  discomApiStatus: 'Online - 12ms ping',
  gedaSyncStatus: 'Connected (Hourly)',
  lastBackupTimestamp: 'Today, 01:15 AM'
};

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.wyberzvcyrjipjqpotwe:' + encodeURIComponent('Ge@286296sumit') + '@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL for full database sync...');

  // 1. Sync System Settings & Official Bank Details
  console.log('1. Syncing System Settings & Official Bank Details...');
  const systemSettingsPayload = {
    company_profile: {
      companyName: SUNVINE_OFFICIAL_PROFILE.companyName,
      gstin: SUNVINE_OFFICIAL_PROFILE.gstin,
      address: SUNVINE_OFFICIAL_PROFILE.address,
      tagline: SUNVINE_OFFICIAL_PROFILE.tagline,
      state: SUNVINE_OFFICIAL_PROFILE.state
    },
    bank_details: SUNVINE_OFFICIAL_PROFILE.bankDetails,
    terms_and_warranties: {
      ...SUNVINE_OFFICIAL_PROFILE.terms,
      deliveryDays: 15,
      validityDays: 15
    },
    statutory_taxes: DEFAULT_SYSTEM_SETTINGS.statutoryTaxes || {
      gstPercent: 13.8,
      testingCharge: 'Customer Scope',
      discomMeterCharge: 'Extra as actual',
      gedaRegistrationCharge: 'Including'
    },
    governance_settings: DEFAULT_GOVERNANCE_SETTINGS
  };

  await client.query(`
    INSERT INTO public.system_settings (id, company_profile, bank_details, terms_and_warranties, statutory_taxes, governance_settings, updated_at)
    VALUES ('global_settings', $1, $2, $3, $4, $5, NOW())
    ON CONFLICT (id) DO UPDATE SET
      company_profile = EXCLUDED.company_profile,
      bank_details = EXCLUDED.bank_details,
      terms_and_warranties = EXCLUDED.terms_and_warranties,
      statutory_taxes = EXCLUDED.statutory_taxes,
      governance_settings = EXCLUDED.governance_settings,
      updated_at = NOW();
  `, [
    JSON.stringify(systemSettingsPayload.company_profile),
    JSON.stringify(systemSettingsPayload.bank_details),
    JSON.stringify(systemSettingsPayload.terms_and_warranties),
    JSON.stringify(systemSettingsPayload.statutory_taxes),
    JSON.stringify(systemSettingsPayload.governance_settings)
  ]);
  console.log('   ✓ System Settings & Bank Details synced to database.');

  // 2. Sync Pricing Presets & Tier Margins
  console.log('2. Syncing Pricing Presets & Tier Margins...');
  await client.query(`
    INSERT INTO public.pricing_presets (id, base_rate_per_kw, subsidy_cap, min_margin_per_kw, enforce_min_margin, tier_margins, last_synced_by, updated_at)
    VALUES ('global_default', $1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (id) DO UPDATE SET
      base_rate_per_kw = EXCLUDED.base_rate_per_kw,
      subsidy_cap = EXCLUDED.subsidy_cap,
      min_margin_per_kw = EXCLUDED.min_margin_per_kw,
      enforce_min_margin = EXCLUDED.enforce_min_margin,
      tier_margins = EXCLUDED.tier_margins,
      last_synced_by = EXCLUDED.last_synced_by,
      updated_at = NOW();
  `, [
    DEFAULT_PRICING_MASTER.quotationPresets.baseRatePerKw,
    DEFAULT_PRICING_MASTER.quotationPresets.subsidyCap,
    DEFAULT_PRICING_MASTER.quotationPresets.minMarginPerKw,
    true,
    JSON.stringify(DEFAULT_PRICING_MASTER.tierMargins),
    'Super Admin Desk'
  ]);
  console.log('   ✓ Pricing Presets & Tier Margins synced to database.');

  // 3. Sync Staff Users (with bcrypt password hashes)
  console.log('3. Syncing Staff Users with Bcrypt Hashing...');
  for (const stf of DEFAULT_STAFF) {
    const rawPass = stf.accessCode || stf.password || 'dealer123';
    await client.query(`
      INSERT INTO public.staff_users (
        id, name, role, phone, email, password_hash, zone, city, department,
        status, onboarded_date, dealers_count, direct_files_count, dealer_files_count, pipeline_kw, rating
      ) VALUES (
        $1, $2, $3, $4, $5, extensions.crypt($6, extensions.gen_salt('bf', 10)), $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        zone = EXCLUDED.zone,
        city = EXCLUDED.city,
        department = EXCLUDED.department,
        status = EXCLUDED.status,
        dealers_count = EXCLUDED.dealers_count,
        direct_files_count = EXCLUDED.direct_files_count,
        dealer_files_count = EXCLUDED.dealer_files_count,
        pipeline_kw = EXCLUDED.pipeline_kw,
        rating = EXCLUDED.rating,
        updated_at = NOW();
    `, [
      stf.id,
      stf.name,
      stf.role,
      stf.phone.replace(/\D/g, ''),
      stf.email,
      rawPass,
      stf.zone || 'Gujarat',
      stf.city || 'Ahmedabad',
      stf.department || 'Sales',
      stf.status || 'Active',
      stf.onboardedDate || '2026-01-10',
      stf.dealersCount || 10,
      stf.directFilesCount || 5,
      stf.dealerFilesCount || 20,
      stf.pipelineKw || 45.0,
      stf.rating || 4.9
    ]);
  }
  console.log('   ✓ Staff Users synced to database.');

  // 4. Sync Dealers (Seed 550 Gujarat Dealers in batches)
  console.log(`4. Syncing ${GUJARAT_DEALERS.length} Gujarat Dealers to database with Bcrypt Hashing...`);
  // Ensure default demo dealer 9810000000 and 9876543210 are included
  const sampleDealers = GUJARAT_DEALERS;
  const batchSize = 50;
  for (let i = 0; i < sampleDealers.length; i += batchSize) {
    const chunk = sampleDealers.slice(i, i + batchSize);
    for (const d of chunk) {
      const cleanPhone = String(d.mobile || d.mobileNumber || '').replace(/\D/g, '').slice(-10);
      if (!cleanPhone || cleanPhone.length !== 10) continue;
      const dealerCode = d.dealerCode || d.id || `SV-DLR-${String(i).padStart(4, '0')}`;
      const rawPass = d.password || 'dealer123';
      const tier = d.tier || 'Gold EPC';
      const maxMargin = Number(d.maxMarginCapPerKw || (tier.toLowerCase().includes('diamond') ? 8000 : tier.toLowerCase().includes('platinum') ? 7000 : 6000));

      const existing = await client.query(
        'SELECT id FROM public.dealers WHERE dealer_code = $1 OR mobile_number = $2 LIMIT 1',
        [dealerCode, cleanPhone]
      );

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE public.dealers SET
            dealer_code = $1,
            firm_name = $2,
            contact_person = $3,
            mobile_number = $4,
            email = $5,
            state = $6,
            city = $7,
            discom = $8,
            status = $9,
            tier = $10,
            max_margin_cap_per_kw = $11,
            bank_name = $12,
            account_number = $13,
            ifsc_code = $14,
            branch = $15,
            pricing_config = $16,
            updated_at = NOW()
          WHERE id = $17;
        `, [
          dealerCode,
          d.firmName || 'Gujarat Solar EPC',
          d.contactPerson || 'Authorized Partner',
          cleanPhone,
          d.email || `${cleanPhone}@sunvinedealer.in`,
          d.state || 'Gujarat',
          d.city || 'Ahmedabad',
          d.discom || 'UGVCL',
          d.status ? d.status.toLowerCase() : 'active',
          tier,
          maxMargin,
          d.bankName || 'State Bank of India',
          d.accountNumber || '394857201948',
          d.ifscCode || 'SBIN0001234',
          d.branch || `${d.city || 'Ahmedabad'} Main Branch`,
          JSON.stringify(d.pricingConfig || {}),
          existing.rows[0].id
        ]);
      } else {
        await client.query(`
          INSERT INTO public.dealers (
            dealer_code, firm_name, contact_person, mobile_number, email,
            password_hash, state, city, discom, status, rating, tier, max_margin_cap_per_kw,
            assigned_staff_id, assigned_staff_name, bank_name, account_number, ifsc_code, branch, pricing_config
          ) VALUES (
            $1, $2, $3, $4, $5,
            extensions.crypt($6, extensions.gen_salt('bf', 10)),
            $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20
          );
        `, [
          dealerCode,
          d.firmName || 'Gujarat Solar EPC',
          d.contactPerson || 'Authorized Partner',
          cleanPhone,
          d.email || `${cleanPhone}@sunvinedealer.in`,
          rawPass,
          d.state || 'Gujarat',
          d.city || 'Ahmedabad',
          d.discom || 'UGVCL',
          d.status ? d.status.toLowerCase() : 'active',
          Number(d.rating) || 4.9,
          tier,
          maxMargin,
          d.assignedStaffId || 'STF-001',
          d.assignedStaffName || 'Jayesh Patel',
          d.bankName || 'State Bank of India',
          d.accountNumber || '394857201948',
          d.ifscCode || 'SBIN0001234',
          d.branch || `${d.city || 'Ahmedabad'} Main Branch`,
          JSON.stringify(d.pricingConfig || {})
        ]);
      }
    }
  }
  console.log('   ✓ All Dealers synced to database.');

  // 5. Sync Solar Loan Partner Banks (47 Banks)
  console.log(`5. Syncing ${SOLAR_LOAN_PROVIDERS.length} Solar Financing Partner Banks...`);
  for (const b of SOLAR_LOAN_PROVIDERS) {
    await client.query(`
      INSERT INTO public.solar_banks (
        id, name, short_name, category, category_label, interest_rate,
        max_tenure, max_loan_amount, collateral_free, processing_type,
        subsidy_adjustment, portal, featured, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        category = EXCLUDED.category,
        category_label = EXCLUDED.category_label,
        interest_rate = EXCLUDED.interest_rate,
        max_tenure = EXCLUDED.max_tenure,
        max_loan_amount = EXCLUDED.max_loan_amount,
        collateral_free = EXCLUDED.collateral_free,
        processing_type = EXCLUDED.processing_type,
        subsidy_adjustment = EXCLUDED.subsidy_adjustment,
        portal = EXCLUDED.portal,
        featured = EXCLUDED.featured,
        active = EXCLUDED.active;
    `, [
      b.id,
      b.name,
      b.shortName || b.name,
      b.category,
      b.categoryLabel,
      b.interestRate,
      b.maxTenure,
      b.maxLoanAmount,
      b.collateralFree !== false,
      b.processingType,
      b.subsidyAdjustment,
      b.portal,
      Boolean(b.featured),
      true
    ]);
  }
  console.log('   ✓ Solar Loan Banks synced to database.');

  // 6. Sync Customer Files
  console.log(`6. Syncing ${DEFAULT_CUSTOMER_FILES.length} Customer Files / Leads...`);
  for (const f of DEFAULT_CUSTOMER_FILES) {
    await client.query(`
      INSERT INTO public.customer_files (
        id, customer_name, phone, address, city, discom, consumer_no,
        sanctioned_load_kw, solar_system_kw, roof_type, source_type,
        dealer_id, dealer_name, staff_id, staff_name, finance_type,
        loan_bank, loan_account_no, stage, status, documents, timeline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        discom = EXCLUDED.discom,
        sanctioned_load_kw = EXCLUDED.sanctioned_load_kw,
        solar_system_kw = EXCLUDED.solar_system_kw,
        roof_type = EXCLUDED.roof_type,
        stage = EXCLUDED.stage,
        status = EXCLUDED.status,
        timeline = EXCLUDED.timeline,
        updated_at = NOW();
    `, [
      f.id,
      f.customerName,
      f.phone,
      f.address || '',
      f.city || 'Ahmedabad',
      f.discom || 'UGVCL',
      f.consumerNo || '',
      Number(f.sanctionedLoadKw) || 6.0,
      Number(f.solarSystemKw) || 5.0,
      f.roofType || 'Flat RCC',
      f.sourceType || 'DIRECT_STAFF',
      f.dealerId || null,
      f.dealerName || null,
      f.staffId || 'STF-001',
      f.staffName || 'Jayesh Patel',
      f.financeType || 'CASH',
      f.loanBank || null,
      f.loanAccountNo || null,
      f.stage || f.currentStage || 'Registration',
      f.status || 'Active',
      JSON.stringify(f.documents || []),
      JSON.stringify(f.timeline || [])
    ]);
  }
  console.log('   ✓ Customer Files synced to database.');

  // 7. Sync Quotations (Batch of Initial Quotations)
  console.log(`7. Syncing Quotations to database...`);
  const initialBatch = INITIAL_QUOTATIONS.slice(0, 100);
  for (const q of initialBatch) {
    await client.query(`
      INSERT INTO public.quotations (
        id, dealer_code, dealer_name, customer_name, customer_phone,
        customer_city, customer_state, system_capacity_kw, panel_type, inverter_type,
        structure_type, base_cost, dealer_margin, total_amount, subsidy_amount,
        net_payable, status, quote_payload, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        system_capacity_kw = EXCLUDED.system_capacity_kw,
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        quote_payload = EXCLUDED.quote_payload,
        updated_at = NOW();
    `, [
      q.id,
      q.dealerCode || 'SV-DLR-0104',
      q.dealerName || 'Sunline Solar Solutions',
      q.customerName || 'Customer',
      q.customerPhone || '9876543210',
      q.city || 'Ahmedabad',
      q.state || 'Gujarat',
      Number(q.systemCapacityKW || q.capacityKW || 5.0),
      q.panelType || 'Mono PERC Bi-facial (550W)',
      q.inverterType || 'Sungrow 5kW Grid-Tie',
      q.structureType || 'High-Rise Galvanized HDG 2.5m',
      Number(q.baseCost || 250000),
      Number(q.dealerMargin || q.dealerTotalMargin || 20000),
      Number(q.totalAmount || q.grandTotalCustomer || 270000),
      Number(q.subsidyAmount || 78000),
      Number(q.netPayable || 192000),
      q.status || 'Draft',
      JSON.stringify(q)
    ]);
  }
  console.log(`   ✓ Quotations (${initialBatch.length} initial quotes) synced to database.`);

  // 8. Sync BOS Pricing Matrix
  console.log('8. Syncing BOS Pricing Matrix...');
  for (const row of PDF_BOS_PRICE_MATRIX) {
    const id = `bos-${String(row.capacityKW).replace('.', '_')}`;
    await client.query(`
      INSERT INTO public.bos_pricing_matrix (
        id, capacity_kw, no_of_modules, inverter_capacity_kw,
        adani_bifi_price, aps_bifi_price, rayzone_price,
        topcon585_capacity_kw, waaree_585_price, topcon600_capacity_kw, aps_topcon_600_price, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        no_of_modules = EXCLUDED.no_of_modules,
        adani_bifi_price = EXCLUDED.adani_bifi_price,
        aps_bifi_price = EXCLUDED.aps_bifi_price,
        rayzone_price = EXCLUDED.rayzone_price,
        waaree_585_price = EXCLUDED.waaree_585_price,
        aps_topcon_600_price = EXCLUDED.aps_topcon_600_price,
        updated_at = NOW();
    `, [
      id,
      Number(row.capacityKW),
      Number(row.noOfModules),
      String(row.inverterCapacityKW),
      Number(row.adaniBiFiPrice),
      Number(row.apsBiFiPrice),
      Number(row.rayzonePrice),
      Number(row.topcon585CapacityKW),
      Number(row.waaree585Price),
      Number(row.topcon600CapacityKW),
      Number(row.apsTopcon600Price)
    ]);
  }
  console.log('   ✓ BOS Pricing Matrix synced to database.');

  // 9. Sync BOM Catalog Items
  console.log('9. Syncing BOM Catalog...');
  for (const item of STANDARD_BOM_CATALOG) {
    await client.query(`
      INSERT INTO public.bom_catalog (
        id, capacity_kw, modules_spec, inverter_spec, dc_wire, ac_wire, earthing_wire,
        la_wire, acdb, dcdb, earthing_kit, pvc_pipes, hardware, mc4_pairs, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        modules_spec = EXCLUDED.modules_spec,
        inverter_spec = EXCLUDED.inverter_spec,
        dc_wire = EXCLUDED.dc_wire,
        ac_wire = EXCLUDED.ac_wire,
        earthing_wire = EXCLUDED.earthing_wire,
        la_wire = EXCLUDED.la_wire,
        acdb = EXCLUDED.acdb,
        dcdb = EXCLUDED.dcdb,
        earthing_kit = EXCLUDED.earthing_kit,
        pvc_pipes = EXCLUDED.pvc_pipes,
        hardware = EXCLUDED.hardware,
        mc4_pairs = EXCLUDED.mc4_pairs,
        updated_at = NOW();
    `, [
      item.id,
      Number(item.capacityKW) || 3.3,
      item.name || item.modulesSpec || 'Standard Component',
      item.category || item.inverterSpec || 'Standard Spec',
      '30 Mtr', '15 Mtr', '25 Mtr', '15 Mtr', 'Standard ACDB', 'Standard DCDB', '1 Set', '30 Mtr', 'Included', '2 Pairs'
    ]);
  }
  console.log('   ✓ BOM Catalog synced to database.');

  // 10. Sync Notifications
  console.log('10. Syncing Notifications...');
  for (const n of DEFAULT_NOTIFICATIONS) {
    await client.query(`
      INSERT INTO public.notifications (
        id, audience, type, icon, title, description, is_release, version, target_tab, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        icon = EXCLUDED.icon;
    `, [
      n.id,
      n.audience || 'all',
      n.type || 'info',
      n.icon || 'notifications',
      n.title,
      n.description,
      Boolean(n.isRelease),
      n.version || null,
      n.targetTab || 'dashboard'
    ]);
  }
  console.log('   ✓ Notifications synced to database.');

  console.log('\n=== ALL PROJECT MASTER DATA SUCCESSFULLY CONNECTED AND SYNCHRONIZED TO DATABASE! ===');
  await client.end();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
