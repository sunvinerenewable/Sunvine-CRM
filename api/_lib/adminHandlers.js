import { query, getSupabaseServiceClient, ensureEnvLoaded } from './db.js';
import { hashBcrypt, validatePasswordComplexity } from './security.js';
import { redisDel, redisFlushPattern } from './redis.js';
import { checkDistributedRateLimit, getClientIp } from './rateLimiter.js';

ensureEnvLoaded();

/**
 * Invalidate Redis cache keys helper
 */
async function invalidateCaches(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) return;
  await Promise.all(
    keys.map(async (key) => {
      try {
        if (key.includes('*')) {
          await redisFlushPattern(key);
        } else {
          await redisDel(key);
        }
      } catch (_) {}
    })
  );
}

export const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || '').replace(/^#/, '').trim());

// ── Database Fallback Helpers ────────────────────────────────────────────────

let lastDirectWarn = 0;
async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (err) {
    const now = Date.now();
    if (now - lastDirectWarn > 30000 && !err.message?.includes('Direct PostgreSQL pooler is paused')) {
      console.warn('[adminHandlers] Direct SQL pooler notice (falling back to Supabase REST):', err.message);
      lastDirectWarn = now;
    }
    throw err;
  }
}

export async function generateCollisionFreeDealerCode() {
  let seq = 1001;
  try {
    const res = await safeQuery(`
      SELECT dealer_code FROM dealer_accounts 
      WHERE dealer_code ~ '^SV-DLR-[0-9]+$' 
      ORDER BY NULLIF(regexp_replace(dealer_code, '\\D', '', 'g'), '')::bigint DESC 
      LIMIT 1
    `);
    if (res?.rows?.[0]?.dealer_code) {
      const match = res.rows[0].dealer_code.match(/\d+/);
      if (match) seq = parseInt(match[0], 10) + 1;
    }
  } catch (_) {
    try {
      const db = getSupabaseServiceClient();
      const { data } = await db
        .from('dealer_accounts')
        .select('dealer_code')
        .order('dealer_code', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        const nums = data.map(d => {
          const m = String(d.dealer_code || '').match(/(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        }).filter(n => n !== null && !isNaN(n));
        if (nums.length > 0) {
          seq = Math.max(...nums) + 1;
        }
      }
    } catch (__) {}
  }

  while (true) {
    const candidate = `SV-DLR-${String(seq).padStart(4, '0')}`;
    try {
      const check = await safeQuery('SELECT id FROM dealer_accounts WHERE dealer_code = $1', [candidate]);
      if (!check?.rows?.length) return candidate;
    } catch (_) {
      try {
        const db = getSupabaseServiceClient();
        const { data } = await db.from('dealer_accounts').select('id').eq('dealer_code', candidate).limit(1);
        if (!data || data.length === 0) return candidate;
      } catch (__) {
        return candidate;
      }
    }
    seq++;
  }
}

export async function generateCollisionFreeStaffCode() {
  let seq = 101;
  try {
    const res = await safeQuery(`
      SELECT id FROM staff_accounts 
      WHERE id ~ '^STF-[0-9]+$' 
      ORDER BY NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::bigint DESC 
      LIMIT 1
    `);
    if (res?.rows?.[0]?.id) {
      const match = res.rows[0].id.match(/\d+/);
      if (match) seq = parseInt(match[0], 10) + 1;
    }
  } catch (_) {
    try {
      const db = getSupabaseServiceClient();
      const { data } = await db
        .from('staff_accounts')
        .select('id')
        .order('id', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        const nums = data.map(s => {
          const m = String(s.id || '').match(/(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        }).filter(n => n !== null && !isNaN(n));
        if (nums.length > 0) {
          seq = Math.max(...nums) + 1;
        }
      }
    } catch (__) {}
  }

  while (true) {
    const candidate = `STF-${String(seq).padStart(3, '0')}`;
    try {
      const check = await safeQuery('SELECT id FROM staff_accounts WHERE id = $1', [candidate]);
      if (!check?.rows?.length) return candidate;
    } catch (_) {
      try {
        const db = getSupabaseServiceClient();
        const { data } = await db.from('staff_accounts').select('id').eq('id', candidate).limit(1);
        if (!data || data.length === 0) return candidate;
      } catch (__) {
        return candidate;
      }
    }
    seq++;
  }
}

// ── 1. Admin Dealers Handlers ────────────────────────────────────────────────

export async function handleAdminDealers(req, res) {
  const { op, limit, offset, id, dealer } = req.body || {};

  try {
    switch (op) {
      case 'list': {
        const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

        try {
          const sql = `
            SELECT id, dealer_code, firm_name, contact_person, mobile_number, email,
                   city, state, discom, tier, max_margin_cap_per_kw, status,
                   assigned_staff_id, assigned_staff_name, pricing_config,
                   created_at, updated_at
            FROM dealer_accounts
            ORDER BY updated_at DESC
            LIMIT $1 OFFSET $2;
          `;
          const qRes = await safeQuery(sql, [pageLimit, pageOffset]);
          return res.status(200).json({ success: true, dealers: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data, error } = await db
            .from('dealer_accounts')
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .range(pageOffset, pageOffset + pageLimit - 1);

          if (error) throw error;
          return res.status(200).json({ success: true, dealers: data || [] });
        }
      }

      case 'get': {
        const targetId = id || dealer?.id || dealer?.dealerCode;
        if (!targetId) {
          return res.status(400).json({ error: 'Dealer ID or dealerCode is required.' });
        }

        try {
          const sql = `
            SELECT id, dealer_code, firm_name, contact_person, mobile_number, email,
                   city, state, discom, tier, max_margin_cap_per_kw, status,
                   assigned_staff_id, assigned_staff_name, pricing_config,
                   created_at, updated_at
            FROM dealer_accounts
            WHERE dealer_code = $1 OR id::text = $1
            LIMIT 1;
          `;
          const qRes = await safeQuery(sql, [String(targetId)]);
          if (!qRes.rows || qRes.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer not found.' });
          }
          return res.status(200).json({ success: true, dealer: qRes.rows[0] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          let q = db
            .from('dealer_accounts')
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at');
          if (isUuid(targetId)) {
            q = q.or(`dealer_code.eq.${targetId},id.eq.${targetId}`);
          } else {
            q = q.eq('dealer_code', targetId);
          }
          const { data, error } = await q.maybeSingle();

          if (error) throw error;
          if (!data) return res.status(404).json({ error: 'Dealer not found.' });
          return res.status(200).json({ success: true, dealer: data });
        }
      }

      case 'create':
      case 'update':
      case 'upsert': {
        if (!dealer) {
          return res.status(400).json({ error: 'Dealer payload is required.' });
        }

        if (dealer.password !== undefined && dealer.password !== null && String(dealer.password).trim() !== '') {
          const passCheck = validatePasswordComplexity(dealer.password);
          if (!passCheck.valid) return res.status(422).json({ error: passCheck.error });
        }

        const targetId = id || dealer.id || dealer.dealerCode;
        let existing = null;
        if (targetId) {
          try {
            const existingRes = await safeQuery('SELECT id, dealer_code, password_hash FROM dealer_accounts WHERE id::text = $1 OR dealer_code = $1', [String(targetId)]);
            if (existingRes?.rows?.length) {
              existing = existingRes.rows[0];
            }
          } catch (_) {
            const db = getSupabaseServiceClient();
            let q = db.from('dealer_accounts').select('id, dealer_code, password_hash');
            if (isUuid(targetId)) {
              q = q.or(`dealer_code.eq.${targetId},id.eq.${targetId}`);
            } else {
              q = q.eq('dealer_code', targetId);
            }
            const { data } = await q.maybeSingle();
            if (data) existing = data;
          }
        }

        if (op === 'update' && !existing) {
          return res.status(404).json({ error: `Dealer "${targetId}" not found for update.` });
        }

        const isUpdate = (op === 'update' || op === 'upsert') && Boolean(existing);

        if (isUpdate) {
          let passwordHash = existing.password_hash;
          if (dealer.password !== undefined && dealer.password !== null && String(dealer.password).trim() !== '') {
            passwordHash = hashBcrypt(String(dealer.password).trim(), 10);
          }

          const staffId = dealer.assignedStaffId || 'STF-DIRECT';
          const staffName = staffId === 'STF-DIRECT' ? 'Direct to Company (HQ Desk)' : (dealer.assignedStaffName || 'Sunvine Sales Staff');
          const dealerCategory = dealer.category || dealer.pricingConfig?.category || existing?.pricing_config?.category || 'Margin Based';
          const finalPricingConfig = {
            ...(typeof dealer.pricingConfig === 'object' && dealer.pricingConfig !== null ? dealer.pricingConfig : {}),
            category: dealerCategory,
            ...(dealer.address ? { address: dealer.address.trim() } : {}),
            assignedStaffId: staffId,
            assignedStaffName: staffName
          };

          let updated = null;
          try {
            const updateSql = `
              UPDATE dealer_accounts SET
                firm_name = COALESCE($2, firm_name),
                contact_person = COALESCE($3, contact_person),
                mobile_number = COALESCE($4, mobile_number),
                email = COALESCE($5, email),
                city = COALESCE($6, city),
                state = COALESCE($7, state),
                discom = COALESCE($8, discom),
                tier = COALESCE($9, tier),
                max_margin_cap_per_kw = COALESCE($10, max_margin_cap_per_kw),
                status = COALESCE($11, status),
                gst_number = COALESCE($12, gst_number),
                pan_number = COALESCE($13, pan_number),
                assigned_staff_id = $14,
                assigned_staff_name = $15,
                pricing_config = $16::jsonb,
                password_hash = $17,
                updated_at = NOW()
              WHERE id::text = $1 OR dealer_code = $1
              RETURNING id, dealer_code, firm_name, contact_person, mobile_number, email,
                        city, state, discom, tier, max_margin_cap_per_kw, status,
                        assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at;
            `;

            const qRes = await safeQuery(updateSql, [
              String(targetId),
              dealer.firmName ? dealer.firmName.trim() : null,
              dealer.contactPerson ? dealer.contactPerson.trim() : null,
              cleanMobile,
              dealer.email ? dealer.email.trim() : null,
              dealer.city || null,
              dealer.state || null,
              dealer.discom || null,
              dealer.tier || null,
              dealer.maxMarginCapPerKw !== undefined && dealer.maxMarginCapPerKw !== null ? Number(dealer.maxMarginCapPerKw) : null,
              dealer.status ? dealer.status.toLowerCase() : null,
              dealer.gstin || null,
              dealer.pan || null,
              staffId,
              staffName,
              JSON.stringify(finalPricingConfig),
              passwordHash
            ]);

            updated = qRes.rows?.[0];
          } catch (_) {
            const db = getSupabaseServiceClient();
            const updateObj = { updated_at: new Date().toISOString() };
            if (dealer.firmName) updateObj.firm_name = dealer.firmName.trim();
            if (dealer.contactPerson) updateObj.contact_person = dealer.contactPerson.trim();
            if (cleanMobile) updateObj.mobile_number = cleanMobile;
            if (dealer.email) updateObj.email = dealer.email.trim();
            if (dealer.city) updateObj.city = dealer.city;
            if (dealer.state) updateObj.state = dealer.state;
            if (dealer.discom) updateObj.discom = dealer.discom;
            if (dealer.tier) updateObj.tier = dealer.tier;
            if (dealer.maxMarginCapPerKw !== undefined && dealer.maxMarginCapPerKw !== null) updateObj.max_margin_cap_per_kw = Number(dealer.maxMarginCapPerKw);
            if (dealer.status) updateObj.status = dealer.status.toLowerCase();
            if (dealer.gstin) updateObj.gst_number = dealer.gstin;
            if (dealer.pan) updateObj.pan_number = dealer.pan;
            updateObj.assigned_staff_id = staffId;
            updateObj.assigned_staff_name = staffName;
            updateObj.pricing_config = finalPricingConfig;
            if (passwordHash) updateObj.password_hash = passwordHash;

            let q = db.from('dealer_accounts').update(updateObj);
            if (isUuid(targetId)) {
              q = q.or(`dealer_code.eq.${targetId},id.eq.${targetId}`);
            } else {
              q = q.eq('dealer_code', targetId);
            }
            const { data, error } = await q
              .select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at')
              .maybeSingle();
            if (error) throw error;
            updated = data;
          }

          await invalidateCaches([
            `dealer:rates:${existing.dealer_code}`,
            `dealer:rates:${existing.id}`,
            'catalog:all'
          ]);
          return res.status(200).json({ success: true, dealer: updated });
        }

        // CREATE PATH: Plain INSERT with collision check & 409 Conflict
        const {
          dealerCode,
          firmName,
          contactPerson,
          mobile,
          email,
          city,
          state,
          discom,
          tier,
          maxMarginCapPerKw,
          password,
          status,
          address,
          gstin,
          pan,
          assignedStaffId,
          assignedStaffName,
          pricingConfig
        } = dealer;

        const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        }
        if (!firmName || !contactPerson) {
          return res.status(400).json({ error: 'Firm name and contact person are required.' });
        }

        // Check for collision on code or mobile
        let collisionFound = false;
        try {
          if (dealerCode) {
            const collision = await safeQuery('SELECT id, dealer_code FROM dealer_accounts WHERE dealer_code = $1 OR mobile_number = $2', [dealerCode, cleanMobile]);
            if (collision?.rows?.length > 0) collisionFound = true;
          } else {
            const collision = await safeQuery('SELECT id FROM dealer_accounts WHERE mobile_number = $1', [cleanMobile]);
            if (collision?.rows?.length > 0) collisionFound = true;
          }
        } catch (_) {
          const db = getSupabaseServiceClient();
          const queryBuilder = dealerCode
            ? db.from('dealer_accounts').select('id, dealer_code').or(`dealer_code.eq.${dealerCode},mobile_number.eq.${cleanMobile}`)
            : db.from('dealer_accounts').select('id').eq('mobile_number', cleanMobile);
          const { data } = await queryBuilder;
          if (data && data.length > 0) collisionFound = true;
        }

        if (collisionFound) {
          return res.status(409).json({ error: `Dealer with code "${dealerCode || ''}" or mobile "${cleanMobile}" already exists.` });
        }

        let passwordHash = null;
        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passCheck = validatePasswordComplexity(password);
          if (!passCheck.valid) return res.status(422).json({ error: passCheck.error });
          passwordHash = hashBcrypt(String(password).trim(), 10);
        } else {
          return res.status(422).json({ error: 'Password is required to create a dealer account.' });
        }

        const code = dealerCode || (await generateCollisionFreeDealerCode());
        const cleanTier = tier || 'Gold EPC Partner';
        const cleanCap = maxMarginCapPerKw !== undefined && maxMarginCapPerKw !== null && maxMarginCapPerKw !== ''
          ? Number(maxMarginCapPerKw)
          : null;
        const cleanStatus = (status || 'active').toLowerCase();
        const cleanEmail = email || `${cleanMobile}@sunvinedealer.in`;
        const cleanCity = city || 'Ahmedabad';
        const cleanState = state || 'Gujarat';
        const cleanDiscom = discom || 'UGVCL';
        const staffId = assignedStaffId || 'STF-DIRECT';
        const staffName = staffId === 'STF-DIRECT'
          ? 'Direct to Company (HQ Desk)'
          : (assignedStaffName || 'Sunvine Sales Staff');
        const dealerCategory = dealer.category || pricingConfig?.category || 'Margin Based';
        const finalPricingConfig = {
          ...(typeof pricingConfig === 'object' && pricingConfig !== null ? pricingConfig : {}),
          category: dealerCategory,
          ...(address ? { address: address.trim() } : {}),
          assignedStaffId: staffId,
          assignedStaffName: staffName
        };

        let saved = null;
        try {
          const insertSql = `
            INSERT INTO dealer_accounts (
              dealer_code, firm_name, contact_person, mobile_number, email,
              city, state, discom, tier, max_margin_cap_per_kw,
              status, gst_number, pan_number, assigned_staff_id, assigned_staff_name,
              pricing_config, password_hash, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15,
              $16::jsonb, $17, NOW(), NOW()
            )
            RETURNING id, dealer_code, firm_name, contact_person, mobile_number, email,
                      city, state, discom, tier, max_margin_cap_per_kw, status,
                      assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at;
          `;

          const qRes = await safeQuery(insertSql, [
            code,
            firmName.trim(),
            contactPerson.trim(),
            cleanMobile,
            cleanEmail.trim(),
            cleanCity,
            cleanState,
            cleanDiscom,
            cleanTier,
            cleanCap,
            cleanStatus,
            gstin || null,
            pan || null,
            staffId,
            staffName,
            JSON.stringify(finalPricingConfig),
            passwordHash
          ]);
          saved = qRes.rows?.[0];
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data, error } = await db
            .from('dealer_accounts')
            .insert({
              dealer_code: code,
              firm_name: firmName.trim(),
              contact_person: contactPerson.trim(),
              mobile_number: cleanMobile,
              email: cleanEmail.trim(),
              city: cleanCity,
              state: cleanState,
              discom: cleanDiscom,
              tier: cleanTier,
              max_margin_cap_per_kw: cleanCap,
              status: cleanStatus,
              gst_number: gstin || null,
              pan_number: pan || null,
              assigned_staff_id: staffId,
              assigned_staff_name: staffName,
              pricing_config: finalPricingConfig,
              password_hash: passwordHash
            })
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at')
            .single();
          if (error) throw error;
          saved = data;
        }

        await invalidateCaches([
          `dealer:rates:${code}`,
          `dealer:rates:${saved?.id || code}`,
          'catalog:all'
        ]);

        return res.status(200).json({ success: true, dealer: saved });
      }

      case 'delete': {
        const cleanTargetId = String(id || dealer?.id || dealer?.dealerCode || '').replace(/^#/, '').trim();
        if (!cleanTargetId) {
          return res.status(400).json({ error: 'Dealer identifier required.' });
        }

        try {
          await safeQuery('DELETE FROM dealer_accounts WHERE dealer_code = $1 OR id::text = $1', [cleanTargetId]);
        } catch (_) {
          const db = getSupabaseServiceClient();
          let q = db.from('dealer_accounts').delete();
          if (isUuid(cleanTargetId)) {
            q = q.or(`dealer_code.eq.${cleanTargetId},id.eq.${cleanTargetId}`);
          } else {
            q = q.eq('dealer_code', cleanTargetId);
          }
          const { error } = await q;
          if (error) throw error;
        }

        await invalidateCaches([
          `dealer:rates:${cleanTargetId}`,
          'catalog:all'
        ]);

        return res.status(200).json({ success: true, message: `Dealer ${cleanTargetId} deleted.` });
      }

      default:
        return res.status(400).json({ error: `Unsupported operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-dealers] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing dealer request.' });
  }
}

// ── 2. Admin Staff Handlers ──────────────────────────────────────────────────

export async function handleAdminStaff(req, res) {
  const { op, limit, offset, id, staff } = req.body || {};

  try {
    switch (op) {
      case 'list': {
        const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

        try {
          const sql = `
            SELECT id, name, phone, mobile_number, email, role, department,
                   (role ILIKE '%verification%' OR department ILIKE '%verification%') as is_verification,
                   zone, city, status, onboarded_date, created_at, updated_at
            FROM staff_accounts
            ORDER BY created_at ASC
            LIMIT $1 OFFSET $2;
          `;
          const qRes = await safeQuery(sql, [pageLimit, pageOffset]);
          return res.status(200).json({ success: true, staff: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data, error } = await db
            .from('staff_accounts')
            .select('id, name, phone, mobile_number, email, role, department, zone, city, status, onboarded_date, created_at, updated_at')
            .order('created_at', { ascending: true })
            .range(pageOffset, pageOffset + pageLimit - 1);

          if (error) throw error;
          const mapped = (data || []).map((s) => ({
            ...s,
            is_verification: String(s.role || '').toLowerCase().includes('verification') || String(s.department || '').toLowerCase().includes('verification')
          }));
          return res.status(200).json({ success: true, staff: mapped });
        }
      }

      case 'get': {
        const targetId = id || staff?.id;
        if (!targetId) {
          return res.status(400).json({ error: 'Staff ID is required.' });
        }

        try {
          const sql = `
            SELECT id, name, phone, mobile_number, email, role, department,
                   (role ILIKE '%verification%' OR department ILIKE '%verification%') as is_verification,
                   zone, city, status, onboarded_date, created_at, updated_at
            FROM staff_accounts
            WHERE id = $1 OR phone = $1 OR mobile_number = $1
            LIMIT 1;
          `;
          const qRes = await safeQuery(sql, [String(targetId)]);
          if (!qRes.rows || qRes.rows.length === 0) {
            return res.status(404).json({ error: 'Staff member not found.' });
          }
          return res.status(200).json({ success: true, staff: qRes.rows[0] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data, error } = await db
            .from('staff_accounts')
            .select('id, name, phone, mobile_number, email, role, department, zone, city, status, onboarded_date, created_at, updated_at')
            .or(`id.eq.${targetId},phone.eq.${targetId},mobile_number.eq.${targetId}`)
            .maybeSingle();

          if (error) throw error;
          if (!data) return res.status(404).json({ error: 'Staff member not found.' });
          return res.status(200).json({
            success: true,
            staff: {
              ...data,
              is_verification: String(data.role || '').toLowerCase().includes('verification') || String(data.department || '').toLowerCase().includes('verification')
            }
          });
        }
      }

      case 'create':
      case 'update':
      case 'upsert': {
        if (!staff) {
          return res.status(400).json({ error: 'Staff payload is required.' });
        }

        if (staff.password !== undefined && staff.password !== null && String(staff.password).trim() !== '') {
          const passCheck = validatePasswordComplexity(staff.password);
          if (!passCheck.valid) return res.status(422).json({ error: passCheck.error });
        }

        const targetId = id || staff.id;
        let existing = null;
        if (targetId) {
          try {
            const existingRes = await safeQuery('SELECT id, password_hash FROM staff_accounts WHERE id = $1', [String(targetId)]);
            if (existingRes?.rows?.length) {
              existing = existingRes.rows[0];
            }
          } catch (_) {
            const db = getSupabaseServiceClient();
            const { data } = await db.from('staff_accounts').select('id, password_hash').eq('id', targetId).maybeSingle();
            if (data) existing = data;
          }
        }

        if (op === 'update' && !existing) {
          return res.status(404).json({ error: `Staff member "${targetId}" not found for update.` });
        }

        const isUpdate = (op === 'update' || op === 'upsert') && Boolean(existing);

        if (isUpdate) {
          let passwordHash = existing.password_hash;
          if (staff.password !== undefined && staff.password !== null && String(staff.password).trim() !== '') {
            passwordHash = hashBcrypt(String(staff.password).trim(), 10);
          }

          const cleanPhone = staff.phone ? String(staff.phone).replace(/\D/g, '').slice(-10) : null;
          const staffRole = staff.role || null;
          const isVerif = staff.is_verification === true || (staffRole && staffRole.toLowerCase().includes('verification')) || String(staff.department || '').toLowerCase().includes('verification');
          const finalDepartment = isVerif ? 'verification' : (staff.department ? String(staff.department).toLowerCase() : null);

          let updated = null;
          try {
            const updateSql = `
              UPDATE staff_accounts SET
                name = COALESCE($2, name),
                phone = COALESCE($3, phone),
                mobile_number = COALESCE($3, mobile_number),
                email = COALESCE($4, email),
                role = COALESCE($5, role),
                department = COALESCE($6, department),
                zone = COALESCE($7, zone),
                city = COALESCE($8, city),
                status = COALESCE($9, status),
                password_hash = $10,
                updated_at = NOW()
              WHERE id = $1
              RETURNING id, name, phone, mobile_number, email, role, department, zone, city, status, created_at, updated_at;
            `;

            const qRes = await safeQuery(updateSql, [
              String(targetId),
              staff.name ? staff.name.trim() : null,
              cleanPhone,
              staff.email ? staff.email.trim() : null,
              staffRole,
              finalDepartment,
              staff.zone || null,
              staff.city || null,
              staff.status ? staff.status.toLowerCase() : null,
              passwordHash
            ]);

            updated = qRes.rows?.[0];
          } catch (_) {
            const db = getSupabaseServiceClient();
            const updateObj = { updated_at: new Date().toISOString() };
            if (staff.name) updateObj.name = staff.name.trim();
            if (cleanPhone) {
              updateObj.phone = cleanPhone;
              updateObj.mobile_number = cleanPhone;
            }
            if (staff.email) updateObj.email = staff.email.trim();
            if (staffRole) updateObj.role = staffRole;
            if (finalDepartment) updateObj.department = finalDepartment;
            if (staff.zone) updateObj.zone = staff.zone;
            if (staff.city) updateObj.city = staff.city;
            if (staff.status) updateObj.status = staff.status.toLowerCase();
            if (passwordHash) updateObj.password_hash = passwordHash;

            const { data, error } = await db.from('staff_accounts').update(updateObj).eq('id', targetId).select().single();
            if (error) throw error;
            updated = data;
          }

          return res.status(200).json({
            success: true,
            staff: {
              ...updated,
              is_verification: isVerif
            }
          });
        }

        // CREATE PATH: Plain INSERT with collision check & 409 Conflict
        const { id: staffId, name, phone, email, role, department, zone, city, password, status, is_verification } = staff;
        const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

        if (cleanPhone.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number required for staff.' });
        }
        if (!name) {
          return res.status(400).json({ error: 'Staff name is required.' });
        }

        // Collision check
        let collisionFound = false;
        try {
          if (staffId) {
            const collision = await safeQuery('SELECT id FROM staff_accounts WHERE id = $1 OR phone = $2 OR mobile_number = $2', [staffId, cleanPhone]);
            if (collision?.rows?.length > 0) collisionFound = true;
          } else {
            const collision = await safeQuery('SELECT id FROM staff_accounts WHERE phone = $1 OR mobile_number = $1', [cleanPhone]);
            if (collision?.rows?.length > 0) collisionFound = true;
          }
        } catch (_) {
          const db = getSupabaseServiceClient();
          const queryBuilder = staffId
            ? db.from('staff_accounts').select('id').or(`id.eq.${staffId},phone.eq.${cleanPhone},mobile_number.eq.${cleanPhone}`)
            : db.from('staff_accounts').select('id').or(`phone.eq.${cleanPhone},mobile_number.eq.${cleanPhone}`);
          const { data } = await queryBuilder;
          if (data && data.length > 0) collisionFound = true;
        }

        if (collisionFound) {
          return res.status(409).json({ error: `Staff with ID "${staffId || ''}" or phone "${cleanPhone}" already exists.` });
        }

        let passwordHash = null;
        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passCheck = validatePasswordComplexity(password);
          if (!passCheck.valid) return res.status(422).json({ error: passCheck.error });
          passwordHash = hashBcrypt(String(password).trim(), 10);
        } else {
          return res.status(422).json({ error: 'Password is required to create a staff account.' });
        }

        const finalId = staffId || (await generateCollisionFreeStaffCode());
        const staffRole = role || 'Field Sales Executive';
        const isVerif = is_verification === true || staffRole.toLowerCase().includes('verification') || String(department || '').toLowerCase().includes('verification');
        const finalDepartment = isVerif ? 'verification' : (String(department || 'sales').toLowerCase());
        const cleanEmail = email || `${cleanPhone}@sunvine.in`;
        const cleanStatus = (status || 'active').toLowerCase();

        let savedStaff = null;
        try {
          const insertSql = `
            INSERT INTO staff_accounts (
              id, name, phone, mobile_number, email, role, department, zone, city,
              status, password_hash, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING id, name, phone, mobile_number, email, role, department, zone, city, status, created_at, updated_at;
          `;

          const qRes = await safeQuery(insertSql, [
            finalId,
            name.trim(),
            cleanPhone,
            cleanPhone,
            cleanEmail.trim(),
            staffRole,
            finalDepartment,
            zone || 'Gujarat',
            city || 'Ahmedabad',
            cleanStatus,
            passwordHash
          ]);
          savedStaff = qRes.rows?.[0];
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data, error } = await db
            .from('staff_accounts')
            .insert({
              id: finalId,
              name: name.trim(),
              phone: cleanPhone,
              mobile_number: cleanPhone,
              email: cleanEmail.trim(),
              role: staffRole,
              department: finalDepartment,
              zone: zone || 'Gujarat',
              city: city || 'Ahmedabad',
              status: cleanStatus,
              password_hash: passwordHash
            })
            .select('id, name, phone, mobile_number, email, role, department, zone, city, status, created_at, updated_at')
            .single();
          if (error) throw error;
          savedStaff = data;
        }

        return res.status(200).json({
          success: true,
          staff: {
            ...savedStaff,
            is_verification: isVerif
          }
        });
      }

      case 'delete': {
        const targetId = id || staff?.id;
        if (!targetId) {
          return res.status(400).json({ error: 'Staff ID is required.' });
        }
        await safeQuery('DELETE FROM staff_accounts WHERE id = $1', [String(targetId)]);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unsupported operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-staff] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing staff request.' });
  }
}

// ── 3. Admin Pricing Handlers ────────────────────────────────────────────────

export async function handleAdminPricing(req, res) {
  const { op, presets, items, item, tier, id } = req.body || {};

  try {
    switch (op) {
      // 3.1 Global presets
      case 'get-presets': {
        const sql = `SELECT * FROM pricing_presets WHERE id = 'global_default' LIMIT 1;`;
        try {
          const qRes = await safeQuery(sql);
          const row = qRes.rows?.[0];
          if (!row) {
            return res.status(200).json({
              success: true,
              presets: {
                baseRatePerKw: 0,
                subsidyCap: 0,
                minMarginPerKw: 0,
                enforceMinMargin: true,
                lastSynced: 'Active',
                updatedBy: 'Operations Desk'
              }
            });
          }
          return res.status(200).json({
            success: true,
            presets: {
              baseRatePerKw: Number(row.base_rate_per_kw) || 0,
              subsidyCap: Number(row.subsidy_cap) || 0,
              minMarginPerKw: Number(row.min_margin_per_kw) || 0,
              enforceMinMargin: row.enforce_min_margin !== false,
              lastSynced: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Active',
              updatedBy: row.last_synced_by || 'Operations Desk'
            }
          });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data: row } = await db.from('pricing_presets').select('*').eq('id', 'global_default').maybeSingle();
          return res.status(200).json({
            success: true,
            presets: row ? {
              baseRatePerKw: Number(row.base_rate_per_kw) || 0,
              subsidyCap: Number(row.subsidy_cap) || 0,
              minMarginPerKw: Number(row.min_margin_per_kw) || 0,
              enforceMinMargin: row.enforce_min_margin !== false,
              lastSynced: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Active',
              updatedBy: row.last_synced_by || 'Operations Desk'
            } : {
              baseRatePerKw: 0,
              subsidyCap: 0,
              minMarginPerKw: 0,
              enforceMinMargin: true,
              lastSynced: 'Active',
              updatedBy: 'Operations Desk'
            }
          });
        }
      }

      case 'upsert-presets': {
        if (!presets) return res.status(400).json({ error: 'Presets data required.' });

        const sql = `
          INSERT INTO pricing_presets (
            id, base_rate_per_kw, subsidy_cap, min_margin_per_kw, enforce_min_margin, last_synced_by, updated_at
          ) VALUES ('global_default', $1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO UPDATE SET
            base_rate_per_kw = EXCLUDED.base_rate_per_kw,
            subsidy_cap = EXCLUDED.subsidy_cap,
            min_margin_per_kw = EXCLUDED.min_margin_per_kw,
            enforce_min_margin = EXCLUDED.enforce_min_margin,
            last_synced_by = EXCLUDED.last_synced_by,
            updated_at = NOW();
        `;
        await safeQuery(sql, [
          Number(presets.baseRatePerKw) || 0,
          Number(presets.subsidyCap) || 0,
          Number(presets.minMarginPerKw) || 0,
          presets.enforceMinMargin !== false,
          presets.updatedBy || 'Operations Desk'
        ]);

        await invalidateCaches(['catalog:presets', 'pricing:global_presets', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      // 3.2 BOS matrix
      case 'get-bos': {
        const sql = `SELECT * FROM bos_pricing_matrix ORDER BY capacity_kw ASC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, bosMatrix: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('bos_pricing_matrix').select('*').order('capacity_kw', { ascending: true });
          return res.status(200).json({ success: true, bosMatrix: data || [] });
        }
      }

      case 'upsert-bos': {
        const list = Array.isArray(items) ? items : [items].filter(Boolean);
        if (list.length === 0) return res.status(400).json({ error: 'BOS items required.' });

        for (const it of list) {
          const idVal = it.id || `bos-${String(it.capacityKW || it.capacity_kw).replace('.', '_')}`;
          const capKw = Number(it.capacityKW || it.capacity_kw) || 1;
          const noMod = Number(it.noOfModules || it.no_of_modules) || 2;
          const invCap = String(it.inverterCapacityKW || it.inverter_capacity_kw || capKw);
          const adani = Number(it.adaniBiFiPrice || it.adani_bifi_price) || 0;
          const aps = Number(it.apsBiFiPrice || it.aps_bifi_price) || 0;
          const rayzone = Number(it.rayzonePrice || it.rayzone_price) || 0;
          const top585Cap = Number(it.topcon585CapacityKW || it.topcon585_capacity_kw) || capKw;
          const waaree585 = Number(it.waaree585Price || it.waaree_585_price) || 0;
          const top600Cap = Number(it.topcon600CapacityKW || it.topcon600_capacity_kw) || capKw;
          const aps600 = Number(it.apsTopcon600Price || it.aps_topcon_600_price) || 0;

          const sql = `
            INSERT INTO bos_pricing_matrix (
              id, capacity_kw, no_of_modules, inverter_capacity_kw,
              adani_bifi_price, aps_bifi_price, rayzone_price,
              topcon585_capacity_kw, waaree_585_price,
              topcon600_capacity_kw, aps_topcon_600_price, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (id) DO UPDATE SET
              capacity_kw = EXCLUDED.capacity_kw,
              no_of_modules = EXCLUDED.no_of_modules,
              inverter_capacity_kw = EXCLUDED.inverter_capacity_kw,
              adani_bifi_price = EXCLUDED.adani_bifi_price,
              aps_bifi_price = EXCLUDED.aps_bifi_price,
              rayzone_price = EXCLUDED.rayzone_price,
              topcon585_capacity_kw = EXCLUDED.topcon585_capacity_kw,
              waaree_585_price = EXCLUDED.waaree_585_price,
              topcon600_capacity_kw = EXCLUDED.topcon600_capacity_kw,
              aps_topcon_600_price = EXCLUDED.aps_topcon_600_price,
              updated_at = NOW();
          `;
          await safeQuery(sql, [idVal, capKw, noMod, invCap, adani, aps, rayzone, top585Cap, waaree585, top600Cap, aps600]);
        }

        await invalidateCaches(['catalog:bos', 'catalog:bos_matrix', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      // 3.3 BOM catalog
      case 'get-bom': {
        const sql = `SELECT * FROM bom_catalog ORDER BY capacity_kw ASC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, bomItems: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('bom_catalog').select('*').order('capacity_kw', { ascending: true });
          return res.status(200).json({ success: true, bomItems: data || [] });
        }
      }

      case 'upsert-bom': {
        if (!item) return res.status(400).json({ error: 'BOM item required.' });

        const idVal = item.id || `bom-${String(item.capacityKW || item.capacity_kw || Date.now()).replace('.', '_')}`;
        const capKw = Number(item.capacityKW || item.capacity_kw) || 3.0;

        const sql = `
          INSERT INTO bom_catalog (
            id, capacity_kw, modules_spec, inverter_spec, dc_wire, ac_wire,
            earthing_wire, la_wire, acdb, dcdb, earthing_kit, pvc_pipes,
            hardware, mc4_pairs, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (id) DO UPDATE SET
            capacity_kw = EXCLUDED.capacity_kw,
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
            updated_at = NOW()
          RETURNING *;
        `;

        const qRes = await safeQuery(sql, [
          idVal,
          capKw,
          item.modules_spec || item.modules || '',
          item.inverter_spec || item.inverter || '',
          item.dc_wire || item.dcWire || '',
          item.ac_wire || item.acWire || '',
          item.earthing_wire || item.earthingWire || '',
          item.la_wire || item.laWire || '',
          item.acdb || '',
          item.dcdb || '',
          item.earthing_kit || item.earthingKit || '',
          item.pvc_pipes || item.pvcPipes || '',
          item.hardware || 'Including',
          item.mc4_pairs || item.mc4 || ''
        ]);

        await invalidateCaches(['catalog:bom', 'catalog:all']);
        return res.status(200).json({ success: true, item: qRes.rows?.[0] || item });
      }

      case 'delete-bom': {
        const targetId = id || item?.id;
        if (!targetId) return res.status(400).json({ error: 'BOM item ID required.' });
        await safeQuery('DELETE FROM bom_catalog WHERE id = $1', [String(targetId)]);
        await invalidateCaches(['catalog:bom', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      // 3.4 Tier margins
      case 'get-tier-margins': {
        const sql = `SELECT * FROM dealer_custom_pricing ORDER BY tier_id ASC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, tierMargins: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('dealer_custom_pricing').select('*').order('tier_id', { ascending: true });
          return res.status(200).json({ success: true, tierMargins: data || [] });
        }
      }

      case 'upsert-tier-margins': {
        if (!tier) return res.status(400).json({ error: 'Tier margin data required.' });

        const tierId = tier.tier_id || tier.tierId;
        if (!tierId) return res.status(400).json({ error: 'tier_id is required.' });

        const sql = `
          INSERT INTO dealer_custom_pricing (
            tier_id, tier_name, default_margin_per_kw, max_margin_cap_per_kw, description, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (tier_id) DO UPDATE SET
            tier_name = EXCLUDED.tier_name,
            default_margin_per_kw = EXCLUDED.default_margin_per_kw,
            max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw,
            description = EXCLUDED.description,
            updated_at = NOW();
        `;
        await safeQuery(sql, [
          tierId,
          tier.tier_name || tier.tierName || tierId,
          Number(tier.default_margin_per_kw ?? tier.defaultMarginPerKw ?? 0),
          Number(tier.max_margin_cap_per_kw ?? tier.maxMarginCapPerKw ?? 0),
          tier.description || ''
        ]);

        await invalidateCaches([
          'catalog:tier-margins',
          'pricing:tier_margins',
          'dealer:rates:*',
          'catalog:all'
        ]);

        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unsupported pricing operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-pricing] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing pricing request.' });
  }
}

// ── 4. Admin Hardware Handlers ───────────────────────────────────────────────

export async function handleAdminHardware(req, res) {
  const { op, module: modData, inverter: invData, id } = req.body || {};

  try {
    switch (op) {
      // 4.1 Solar Modules
      case 'list-modules': {
        const sql = `SELECT * FROM solar_modules ORDER BY created_at DESC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, modules: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('solar_modules').select('*').order('created_at', { ascending: false });
          return res.status(200).json({ success: true, modules: data || [] });
        }
      }

      case 'upsert-module': {
        if (!modData || !modData.brand || !modData.model) {
          return res.status(400).json({ error: 'Brand and Model are required for module.' });
        }

        const idVal = modData.id || `mod-${Date.now()}`;
        const sql = `
          INSERT INTO solar_modules (
            id, brand, model, wattage, cell_tech, efficiency, rate_per_wp,
            warranty, dimensions, is_archived, is_default, is_new, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (id) DO UPDATE SET
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            wattage = EXCLUDED.wattage,
            cell_tech = EXCLUDED.cell_tech,
            efficiency = EXCLUDED.efficiency,
            rate_per_wp = EXCLUDED.rate_per_wp,
            warranty = EXCLUDED.warranty,
            dimensions = EXCLUDED.dimensions,
            is_archived = EXCLUDED.is_archived,
            is_default = EXCLUDED.is_default,
            is_new = EXCLUDED.is_new,
            updated_at = NOW()
          RETURNING *;
        `;

        const qRes = await safeQuery(sql, [
          idVal,
          modData.brand.trim(),
          modData.model.trim(),
          Number(modData.wattage) || 550,
          modData.technology || modData.cell_tech || modData.cellTech || 'TOPCon Mono Bifacial',
          modData.efficiency || '22.6%',
          modData.rate_per_wp_inr || modData.rate_per_wp || modData.ratePerWp || '₹ 19.20/Wp',
          modData.warranty_years ? `${modData.warranty_years} Years` : (modData.warranty || '30 Years Performance'),
          modData.dimensions || '2278 × 1134 × 30 mm | 28 kg',
          modData.is_active === false || !!modData.is_archived || !!modData.isArchived,
          !!modData.is_default || !!modData.isDefault,
          modData.is_new !== undefined ? !!modData.is_new : (modData.isNew !== undefined ? !!modData.isNew : false)
        ]);

        await invalidateCaches(['catalog:modules', 'catalog:hardware', 'catalog:all']);
        return res.status(200).json({ success: true, module: qRes.rows?.[0] || modData });
      }

      case 'delete-module': {
        const targetId = id || modData?.id;
        if (!targetId) return res.status(400).json({ error: 'Module ID is required.' });
        await safeQuery('DELETE FROM solar_modules WHERE id = $1', [String(targetId)]);
        await invalidateCaches(['catalog:modules', 'catalog:hardware', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      // 4.2 Solar Inverters
      case 'list-inverters': {
        const sql = `SELECT * FROM solar_inverters ORDER BY created_at DESC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, inverters: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('solar_inverters').select('*').order('created_at', { ascending: false });
          return res.status(200).json({ success: true, inverters: data || [] });
        }
      }

      case 'upsert-inverter': {
        if (!invData || !invData.brand || !invData.model) {
          return res.status(400).json({ error: 'Brand and Model are required for inverter.' });
        }

        const idVal = invData.id || `inv-${Date.now()}`;
        const sql = `
          INSERT INTO solar_inverters (
            id, brand, model, capacity_kw, phase, base_price,
            type, efficiency, warranty, is_archived, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (id) DO UPDATE SET
            brand = EXCLUDED.brand,
            model = EXCLUDED.model,
            capacity_kw = EXCLUDED.capacity_kw,
            phase = EXCLUDED.phase,
            base_price = EXCLUDED.base_price,
            type = EXCLUDED.type,
            efficiency = EXCLUDED.efficiency,
            warranty = EXCLUDED.warranty,
            is_archived = EXCLUDED.is_archived,
            updated_at = NOW()
          RETURNING *;
        `;

        const qRes = await safeQuery(sql, [
          idVal,
          invData.brand.trim(),
          invData.model.trim(),
          Number(invData.capacity_kw || invData.capacityKW) || 5,
          invData.phase || 'Single Phase',
          Number(invData.base_price_inr || invData.base_price || invData.basePrice) || 35000,
          invData.type || 'On-Grid String Inverter',
          invData.efficiency || '98.4%',
          invData.warranty_years ? `${invData.warranty_years} Years` : (invData.warranty || '10 Years Warranty'),
          invData.is_active === false || !!invData.is_archived || !!invData.isArchived
        ]);

        await invalidateCaches(['catalog:inverters', 'catalog:hardware', 'catalog:inverter_benchmarks', 'catalog:all']);
        return res.status(200).json({ success: true, inverter: qRes.rows?.[0] || invData });
      }

      case 'delete-inverter': {
        const targetId = id || invData?.id;
        if (!targetId) return res.status(400).json({ error: 'Inverter ID is required.' });
        await safeQuery('DELETE FROM solar_inverters WHERE id = $1', [String(targetId)]);
        await invalidateCaches(['catalog:inverters', 'catalog:hardware', 'catalog:inverter_benchmarks', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unsupported hardware operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-hardware] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing hardware request.' });
  }
}

// ── 5. Admin Settings Handlers ───────────────────────────────────────────────

export async function handleAdminSettings(req, res) {
  const { op, section, values } = req.body || {};

  try {
    switch (op) {
      case 'get': {
        const sql = `SELECT * FROM system_settings WHERE id = 'global_settings' LIMIT 1;`;
        try {
          const qRes = await safeQuery(sql);
          const row = qRes.rows?.[0] || {};
          return res.status(200).json({
            success: true,
            settings: {
              governance_settings: row.governance_settings || {},
              statutory_taxes: row.statutory_taxes || {},
              company_profile: row.company_profile || {},
              bank_details: row.bank_details || {},
              terms_and_warranties: row.terms_and_warranties || {}
            }
          });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data: row } = await db.from('system_settings').select('*').eq('id', 'global_settings').maybeSingle();
          return res.status(200).json({
            success: true,
            settings: row ? {
              governance_settings: row.governance_settings || {},
              statutory_taxes: row.statutory_taxes || {},
              company_profile: row.company_profile || {},
              bank_details: row.bank_details || {},
              terms_and_warranties: row.terms_and_warranties || {}
            } : {}
          });
        }
      }

      case 'upsert': {
        const allowedSections = ['governance_settings', 'statutory_taxes', 'company_profile', 'bank_details', 'terms_and_warranties'];
        if (!section || !allowedSections.includes(section)) {
          return res.status(400).json({ error: `Valid section required: ${allowedSections.join(', ')}` });
        }
        if (!values || typeof values !== 'object') {
          return res.status(400).json({ error: 'Section values object is required.' });
        }

        const sql = `
          INSERT INTO system_settings (id, ${section}, updated_at)
          VALUES ('global_settings', $1::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE SET
            ${section} = EXCLUDED.${section},
            updated_at = NOW()
          RETURNING *;
        `;
        const qRes = await safeQuery(sql, [JSON.stringify(values)]);

        await invalidateCaches(['catalog:settings', 'catalog:all']);
        const row = qRes.rows?.[0] || {};
        return res.status(200).json({
          success: true,
          settings: {
            governance_settings: row.governance_settings || {},
            statutory_taxes: row.statutory_taxes || {},
            company_profile: row.company_profile || {},
            bank_details: row.bank_details || {},
            terms_and_warranties: row.terms_and_warranties || {}
          }
        });
      }

      default:
        return res.status(400).json({ error: `Unsupported settings operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-settings] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing settings request.' });
  }
}

// ── 6. Admin Document Master Handlers ────────────────────────────────────────

export async function handleAdminDocumentMaster(req, res) {
  const { op, id, document: doc } = req.body || {};

  try {
    switch (op) {
      case 'list': {
        const sql = `SELECT * FROM document_master ORDER BY created_at ASC;`;
        try {
          const qRes = await safeQuery(sql);
          return res.status(200).json({ success: true, documents: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          const { data } = await db.from('document_master').select('*').order('created_at', { ascending: true });
          return res.status(200).json({ success: true, documents: data || [] });
        }
      }

      case 'upsert': {
        if (!doc || (!doc.key && !doc.doc_code)) {
          return res.status(400).json({ error: 'Document key/code required.' });
        }

        const docKey = doc.key || doc.doc_code;
        const docLabel = doc.label || doc.doc_name || docKey;
        const docCategory = doc.category || doc.applies_to || 'Applicant KYC';
        const docDesc = doc.description || '';
        const docIcon = doc.icon || 'description';
        const docExts = JSON.stringify(doc.allowed_extensions || doc.allowedExtensions || ['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
        const docRules = JSON.stringify(doc.rules || {
          RESIDENTIAL: doc.is_mandatory ? 'mandatory' : 'optional',
          BANK_LOAN: doc.is_mandatory ? 'mandatory' : 'optional',
          NBFC_LOAN: doc.is_mandatory ? 'mandatory' : 'optional',
          COMMERCIAL: doc.is_mandatory ? 'mandatory' : 'optional',
          HOUSING_SOCIETY: doc.is_mandatory ? 'mandatory' : 'optional'
        });
        const isCustom = doc.is_custom !== undefined ? Boolean(doc.is_custom) : false;

        const sql = `
          INSERT INTO document_master (
            key, label, category, description, icon, allowed_extensions, rules, is_custom, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NOW())
          ON CONFLICT (key) DO UPDATE SET
            label = EXCLUDED.label,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            allowed_extensions = EXCLUDED.allowed_extensions,
            rules = EXCLUDED.rules,
            is_custom = EXCLUDED.is_custom,
            updated_at = NOW()
          RETURNING *;
        `;
        const qRes = await safeQuery(sql, [docKey, docLabel, docCategory, docDesc, docIcon, docExts, docRules, isCustom]);

        await invalidateCaches(['catalog:documents', 'catalog:all']);
        return res.status(200).json({ success: true, document: qRes.rows?.[0] || doc });
      }

      case 'delete': {
        const targetId = id || doc?.id || doc?.key;
        if (!targetId) return res.status(400).json({ error: 'Document ID or key required.' });
        await safeQuery('DELETE FROM document_master WHERE key = $1 OR id::text = $1', [String(targetId)]);
        await invalidateCaches(['catalog:documents', 'catalog:all']);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unsupported document master operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-document-master] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing document master request.' });
  }
}

// ── 7. Admin Audit Logs Handlers ─────────────────────────────────────────────

export async function handleAdminAuditLogs(req, res) {
  const { op, limit, offset, action, entity } = req.body || {};

  try {
    switch (op || 'list') {
      case 'list': {
        const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const whereClauses = [];
        const params = [];
        let idx = 1;

        if (action) {
          whereClauses.push(`action ILIKE $${idx++}`);
          params.push(`%${action}%`);
        }

        if (entity) {
          whereClauses.push(`(entity_type ILIKE $${idx} OR module ILIKE $${idx})`);
          params.push(`%${entity}%`);
          idx++;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        params.push(pageLimit, pageOffset);

        const sql = `
          SELECT id,
                 COALESCE(actor_id, record_id, entity_id) as actor_id,
                 COALESCE(actor_role, user_role, role, 'admin') as actor_role,
                 COALESCE(actor_email, user_email, user_name, 'system@sunvine.in') as actor_email,
                 action,
                 COALESCE(entity_type, module, 'SYSTEM') as entity_type,
                 COALESCE(entity_id, record_id) as entity_id,
                 details,
                 COALESCE(ip_address, '127.0.0.1') as ip_address,
                 COALESCE(user_agent, '') as user_agent,
                 created_at
          FROM audit_logs
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT $${idx++} OFFSET $${idx++};
        `;

        try {
          const qRes = await safeQuery(sql, params);
          return res.status(200).json({ success: true, logs: qRes.rows || [] });
        } catch (_) {
          const db = getSupabaseServiceClient();
          let queryBuilder = db
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(pageOffset, pageOffset + pageLimit - 1);

          if (action) queryBuilder = queryBuilder.ilike('action', `%${action}%`);
          if (entity) queryBuilder = queryBuilder.ilike('entity_type', `%${entity}%`);

          const { data, error } = await queryBuilder;
          if (error) throw error;
          return res.status(200).json({ success: true, logs: data || [] });
        }
      }

      default:
        return res.status(400).json({ error: `Unsupported audit logs operation: ${op}` });
    }
  } catch (err) {
    console.error('[admin-audit-logs] Error:', err);
    return res.status(500).json({ error: err.message || 'Error processing audit logs request.' });
  }
}

// Helper to escape mrkdwn special characters in Slack webhook payload
function escapeSlackMrkdwn(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── 8. Report Error Handler (Slack Webhook Rate-Limited & Sanitized) ────────

export async function reportErrorHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);
  // Stricter rate limit: 5 error reports per minute per IP
  const rateLimitResult = await checkDistributedRateLimit(`report-error:${clientIp}`, {
    maxAttempts: 5,
    windowMs: 60 * 1000
  });

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 error reports per minute.' });
  }

  const { errorCode, message, context } = req.body || {};

  // Sanitize text inputs and escape Slack mrkdwn
  const cleanCode = escapeSlackMrkdwn(String(errorCode || 'CLIENT_ERROR').slice(0, 80));
  const cleanMessage = escapeSlackMrkdwn(String(message || 'Unspecified runtime exception').slice(0, 500));
  
  // Cap context object size to max 512 bytes
  let safeContextStr = '{}';
  try {
    const rawContext = typeof context === 'object' && context !== null ? context : {};
    const stringified = JSON.stringify(rawContext).slice(0, 512);
    safeContextStr = stringified;
  } catch (_) {}

  const webhookUrl =
    process.env.SLACK_CRASH_WEBHOOK_URL ||
    process.env.SLACK_FILES_UPDATE ||
    process.env.SLACK_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      const payload = {
        text: `⚠️ *[Sunvine Client Error]*: ${cleanCode} — ${cleanMessage}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🚨 Client Diagnostic Alert: ${cleanCode.slice(0, 50)}` }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Code:*\n\`${cleanCode}\`` },
              { type: 'mrkdwn', text: `*IP:*\n\`${clientIp}\`` },
              { type: 'mrkdwn', text: `*Timestamp:*\n${new Date().toISOString()}` },
              { type: 'mrkdwn', text: `*Context:*\n\`${safeContextStr.slice(0, 100)}\`` }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error Message:*\n\`\`\`${cleanMessage}\`\`\``
            }
          }
        ]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (_) {}
  }

  return res.status(200).json({ success: true });
}

// ── Main Admin Dispatcher ───────────────────────────────────────────────────

export default async function adminDispatcher(req, res, action, adminPayload) {
  switch (action) {
    case 'admin-dealers':
      return handleAdminDealers(req, res);
    case 'admin-staff':
      return handleAdminStaff(req, res);
    case 'admin-pricing':
      return handleAdminPricing(req, res);
    case 'admin-hardware':
      return handleAdminHardware(req, res);
    case 'admin-settings':
      return handleAdminSettings(req, res);
    case 'admin-document-master':
      return handleAdminDocumentMaster(req, res);
    case 'admin-audit-logs':
      return handleAdminAuditLogs(req, res);
    default:
      return res.status(404).json({ error: `Not found: ${action}` });
  }
}
