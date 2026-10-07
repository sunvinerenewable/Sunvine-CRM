import { query, getSupabaseServiceClient, ensureEnvLoaded } from './db.js';
import { hashBcrypt, validatePasswordComplexity } from './security.js';
import { applyCors } from './cors.js';
import { requireAdmin } from './requireAuth.js';
import { generateCollisionFreeDealerCode, generateCollisionFreeStaffCode, isUuid } from './adminHandlers.js';

ensureEnvLoaded();

/**
 * POST /api/auth/manage-credentials
 *
 * Centralized server-side credential and account management endpoint.
 * Ensures consistent Bcrypt password hashing ($2a$10$...) for PostgreSQL
 * across Dealer Onboarding, Staff Creation, and Verification Desk management.
 * Provides automatic fallback to Supabase Service Client (HTTPS REST)
 * when direct TCP database pooler encounters connection limits.
 */
export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // --- Admin authentication guard (SEC-001) ---
  const adminPayload = await requireAdmin(req, res);
  if (!adminPayload) return; // requireAdmin already sent 401/403

  const { action, payload } = req.body || {};

  if (!action || !payload) {
    return res.status(400).json({ error: 'action and payload are required.' });
  }

  try {
    switch (action) {
      case 'create-dealer': {
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
          discomLicense
        } = payload;

        const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        }
        if (!firmName || !contactPerson) {
          return res.status(400).json({ error: 'Firm name and contact person are required.' });
        }

        const passCheck = validatePasswordComplexity(password);
        if (!passCheck.valid) {
          return res.status(422).json({ error: passCheck.error });
        }

        // Check duplicate collision
        let collisionFound = false;
        try {
          if (dealerCode) {
            const collision = await query('SELECT id FROM dealer_accounts WHERE dealer_code = $1 OR mobile_number = $2', [dealerCode, cleanMobile]);
            if (collision?.rows?.length > 0) collisionFound = true;
          } else {
            const collision = await query('SELECT id FROM dealer_accounts WHERE mobile_number = $1', [cleanMobile]);
            if (collision?.rows?.length > 0) collisionFound = true;
          }
        } catch (_) {
          try {
            const supabase = getSupabaseServiceClient();
            let q = supabase.from('dealer_accounts').select('id');
            if (dealerCode) {
              q = q.or(`dealer_code.eq.${dealerCode},mobile_number.eq.${cleanMobile}`);
            } else {
              q = q.eq('mobile_number', cleanMobile);
            }
            const { data } = await q.limit(1);
            if (data && data.length > 0) collisionFound = true;
          } catch (e) {
            console.warn('[manage-credentials:create-dealer] Duplicate check fallback failed:', e.message);
          }
        }

        if (collisionFound) {
          return res.status(409).json({ error: `Dealer with code "${dealerCode || ''}" or mobile "${cleanMobile}" already exists.` });
        }

        const plainPassword = String(password).trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const code = dealerCode || (await generateCollisionFreeDealerCode());
        const cleanTier = tier || 'Gold EPC Partner';
        const cleanCap = maxMarginCapPerKw !== undefined && maxMarginCapPerKw !== null && maxMarginCapPerKw !== ''
          ? Number(maxMarginCapPerKw)
          : null;
        const cleanStatus = (status || 'Active').toLowerCase();
        const cleanEmail = email || `${cleanMobile}@sunvinedealer.in`;
        const cleanCity = city || 'Ahmedabad';
        const cleanState = state || 'Gujarat';
        const cleanDiscom = discom || 'UGVCL';
        const assignedStaffId = payload.assignedStaffId || 'STF-DIRECT';
        const assignedStaffName = assignedStaffId === 'STF-DIRECT' 
          ? 'Direct to Company (HQ Desk)' 
          : (payload.assignedStaffName || 'Sunvine Sales Staff');
        
        // Note: 'address', 'gstin', 'pan', 'discomLicense' are safely bundled in pricing_config
        const pricingConfig = {
          ...(payload.pricingConfig || {}),
          address: address || payload.address || '',
          gstin: gstin || payload.gstin || '',
          pan: pan || payload.pan || '',
          discomLicense: discomLicense || payload.discomLicense || '',
          assignedStaffId,
          assignedStaffName
        };

        let newDealer = null;
        try {
          const sql = `
            INSERT INTO dealer_accounts (
              dealer_code, firm_name, contact_person, mobile_number, email,
              password_hash, city, state, discom, tier, max_margin_cap_per_kw,
              status, gst_number, pan_number, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW(), NOW())
            RETURNING id, dealer_code, firm_name, contact_person, mobile_number, email, status, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name;
          `;

          const qRes = await query(sql, [
            code,
            firmName,
            contactPerson,
            cleanMobile,
            cleanEmail,
            passwordHash,
            cleanCity,
            cleanState,
            cleanDiscom,
            cleanTier,
            cleanCap,
            cleanStatus,
            gstin || null,
            pan || null,
            assignedStaffId,
            assignedStaffName,
            JSON.stringify(pricingConfig)
          ]);
          newDealer = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct query failed, using Supabase Service client:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const { data: inserted, error: insertErr } = await supabase
            .from('dealer_accounts')
            .insert({
              dealer_code: code,
              firm_name: firmName,
              contact_person: contactPerson,
              mobile_number: cleanMobile,
              email: cleanEmail,
              password_hash: passwordHash,
              city: cleanCity,
              state: cleanState,
              discom: cleanDiscom,
              tier: cleanTier,
              max_margin_cap_per_kw: cleanCap,
              status: cleanStatus,
              gst_number: gstin || null,
              pan_number: pan || null,
              assigned_staff_id: assignedStaffId,
              assigned_staff_name: assignedStaffName,
              pricing_config: pricingConfig
            })
            .select('id, dealer_code, firm_name, contact_person, mobile_number, email, status, tier, max_margin_cap_per_kw, assigned_staff_id, assigned_staff_name')
            .single();

          if (insertErr) throw insertErr;
          newDealer = inserted;
        }

        return res.status(200).json({
          success: true,
          message: `Dealer ${firmName} onboarded successfully with secure credentials.`,
          dealer: newDealer
        });
      }

      case 'update-dealer-credentials': {
        const { id, dealerCode, mobile, password, email, firmName, contactPerson, status, address, gstin, pan } = payload;
        const targetId = dealerCode || id;

        if (!targetId && !mobile) {
          return res.status(400).json({ error: 'Dealer ID, dealerCode or mobile is required.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;
        let passwordHash = null;

        if (mobile) {
          const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanMobile);
        }

        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passCheck = validatePasswordComplexity(password);
          if (!passCheck.valid) {
            return res.status(422).json({ error: passCheck.error });
          }
          passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        if (email !== undefined) {
          const cleanEmailVal = (email && String(email).trim()) ? String(email).trim() : null;
          updates.push(`email = $${idx++}`);
          params.push(cleanEmailVal);
        }

        if (firmName) {
          updates.push(`firm_name = $${idx++}`);
          params.push(firmName.trim());
        }

        if (contactPerson) {
          updates.push(`contact_person = $${idx++}`);
          params.push(contactPerson.trim());
        }

        if (status) {
          updates.push(`status = $${idx++}`);
          params.push(status.toLowerCase());
        }

        if (payload.assignedStaffId) {
          updates.push(`assigned_staff_id = $${idx++}`);
          params.push(payload.assignedStaffId);
          const staffName = payload.assignedStaffId === 'STF-DIRECT'
            ? 'Direct to Company (HQ Desk)'
            : (payload.assignedStaffName || 'Sunvine Sales Staff');
          updates.push(`assigned_staff_name = $${idx++}`);
          params.push(staffName);
        } else if (payload.assignedStaffName) {
          updates.push(`assigned_staff_name = $${idx++}`);
          params.push(payload.assignedStaffName);
        }

        if (payload.pricingConfig || address || gstin || pan) {
          const mergedConfig = {
            ...(payload.pricingConfig || {}),
            ...(address ? { address } : {}),
            ...(gstin ? { gstin } : {}),
            ...(pan ? { pan } : {})
          };
          updates.push(`pricing_config = $${idx++}::jsonb`);
          params.push(JSON.stringify(mergedConfig));
        }

        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
          return res.status(400).json({ error: 'No fields provided to update.' });
        }

        let whereClause = '';
        if (targetId) {
          whereClause = `dealer_code = $${idx} OR id::text = $${idx}`;
          params.push(targetId);
        } else {
          const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
          whereClause = `mobile_number = $${idx}`;
          params.push(cleanMobile);
        }

        let updatedDealer = null;
        try {
          const sql = `UPDATE dealer_accounts SET ${updates.join(', ')} WHERE ${whereClause} RETURNING id, dealer_code, firm_name, mobile_number, email, status, assigned_staff_id, assigned_staff_name;`;
          const qRes = await query(sql, params);
          updatedDealer = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct update failed, fallback to Supabase:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const sbUpdates = {};
          if (mobile) sbUpdates.mobile_number = String(mobile).replace(/\D/g, '').slice(-10);
          if (passwordHash) sbUpdates.password_hash = passwordHash;
          if (email !== undefined) sbUpdates.email = (email && String(email).trim()) ? String(email).trim() : null;
          if (firmName) sbUpdates.firm_name = firmName.trim();
          if (contactPerson) sbUpdates.contact_person = contactPerson.trim();
          if (status) sbUpdates.status = status.toLowerCase();
          if (payload.assignedStaffId) {
            sbUpdates.assigned_staff_id = payload.assignedStaffId;
            sbUpdates.assigned_staff_name = payload.assignedStaffId === 'STF-DIRECT' ? 'Direct to Company (HQ Desk)' : (payload.assignedStaffName || 'Sunvine Sales Staff');
          }
          if (payload.pricingConfig || address || gstin || pan) {
            sbUpdates.pricing_config = {
              ...(payload.pricingConfig || {}),
              ...(address ? { address } : {}),
              ...(gstin ? { gstin } : {}),
              ...(pan ? { pan } : {})
            };
          }
          sbUpdates.updated_at = new Date().toISOString();

          let q = supabase.from('dealer_accounts').update(sbUpdates);
          if (targetId) {
            if (isUuid(targetId)) {
              q = q.or(`dealer_code.eq.${targetId},id.eq.${targetId}`);
            } else {
              q = q.eq('dealer_code', targetId);
            }
          } else {
            const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
            q = q.eq('mobile_number', cleanMobile);
          }
          const { data, error: sbErr } = await q.select('id, dealer_code, firm_name, contact_person, mobile_number, email, status, assigned_staff_id, assigned_staff_name').single();
          if (sbErr) throw sbErr;
          updatedDealer = data;
        }

        return res.status(200).json({
          success: true,
          message: 'Dealer credentials updated successfully.',
          dealer: updatedDealer
        });
      }

      case 'create-staff': {
        const { id, name, phone, email, role, zone, city, password, department, status } = payload;
        const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

        if (cleanPhone.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number required for staff.' });
        }
        if (!name) {
          return res.status(400).json({ error: 'Staff name is required.' });
        }

        const passCheck = validatePasswordComplexity(password);
        if (!passCheck.valid) {
          return res.status(422).json({ error: passCheck.error });
        }

        // Duplicate check
        let collisionFound = false;
        try {
          if (id) {
            const collision = await query('SELECT id FROM staff_accounts WHERE id = $1 OR phone = $2 OR mobile_number = $2', [id, cleanPhone]);
            if (collision?.rows?.length > 0) collisionFound = true;
          } else {
            const collision = await query('SELECT id FROM staff_accounts WHERE phone = $1 OR mobile_number = $1', [cleanPhone]);
            if (collision?.rows?.length > 0) collisionFound = true;
          }
        } catch (_) {
          try {
            const supabase = getSupabaseServiceClient();
            let q = supabase.from('staff_accounts').select('id');
            if (id) {
              q = q.or(`id.eq.${id},phone.eq.${cleanPhone},mobile_number.eq.${cleanPhone}`);
            } else {
              q = q.or(`phone.eq.${cleanPhone},mobile_number.eq.${cleanPhone}`);
            }
            const { data } = await q.limit(1);
            if (data && data.length > 0) collisionFound = true;
          } catch (e) {
            console.warn('[manage-credentials:create-staff] Duplicate check fallback failed:', e.message);
          }
        }

        if (collisionFound) {
          return res.status(409).json({ error: `Staff with ID "${id || ''}" or phone "${cleanPhone}" already exists.` });
        }

        const plainPassword = String(password).trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const staffId = id || (await generateCollisionFreeStaffCode());
        const staffRole = role || 'Field Sales Executive';
        const isVerification = staffRole.toLowerCase().includes('verification') || String(department || '').toLowerCase().includes('verification');
        const finalDepartment = isVerification ? 'verification' : (String(department || 'sales').toLowerCase());
        const cleanEmail = email || `${cleanPhone}@sunvine.in`;
        const cleanStatus = (status || 'active').toLowerCase();

        let newStaff = null;
        try {
          const insertSql = `
            INSERT INTO staff_accounts (
              id, name, phone, mobile_number, email, role, department, zone, city,
              status, password_hash, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING id, name, phone, mobile_number, email, role, department, zone, city, status;
          `;
          const qRes = await query(insertSql, [
            staffId,
            name.trim(),
            cleanPhone,
            cleanPhone,
            cleanEmail,
            staffRole,
            finalDepartment,
            zone || 'Gujarat',
            city || 'Ahmedabad',
            cleanStatus,
            passwordHash
          ]);
          newStaff = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct staff insert failed, fallback to Supabase:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const { data: inserted, error: insertErr } = await supabase
            .from('staff_accounts')
            .insert({
              id: staffId,
              name: name.trim(),
              phone: cleanPhone,
              mobile_number: cleanPhone,
              email: cleanEmail,
              role: staffRole,
              department: finalDepartment,
              zone: zone || 'Gujarat',
              city: city || 'Ahmedabad',
              status: cleanStatus,
              password_hash: passwordHash
            })
            .select('id, name, phone, mobile_number, email, role, department, zone, city, status')
            .single();

          if (insertErr) throw insertErr;
          newStaff = inserted;
        }

        return res.status(200).json({
          success: true,
          message: `${isVerification ? 'Verification Desk' : 'Staff'} account created successfully.`,
          staff: newStaff || { id: staffId, name: name.trim(), phone: cleanPhone, email: cleanEmail, role: staffRole }
        });
      }

      case 'update-staff-credentials': {
        const { id, staffId, name, phone, email, role, zone, city, password, department, status } = payload;
        const targetStaffId = id || staffId;

        if (!targetStaffId && !phone) {
          return res.status(400).json({ error: 'Staff ID or phone is required.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;
        let passwordHash = null;

        if (name) {
          updates.push(`name = $${idx++}`);
          params.push(name.trim());
        }

        if (phone) {
          const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
          updates.push(`phone = $${idx++}`);
          params.push(cleanPhone);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanPhone);
        }

        if (email !== undefined) {
          const cleanStaffEmail = (email && String(email).trim()) ? String(email).trim() : null;
          updates.push(`email = $${idx++}`);
          params.push(cleanStaffEmail);
        }

        if (role) {
          updates.push(`role = $${idx++}`);
          params.push(role);
          const isVerification = role.toLowerCase().includes('verification');
          updates.push(`department = $${idx++}`);
          params.push(isVerification ? 'verification' : (String(department || 'sales').toLowerCase()));
        } else if (department) {
          updates.push(`department = $${idx++}`);
          params.push(String(department).toLowerCase());
        }

        if (zone) {
          updates.push(`zone = $${idx++}`);
          params.push(zone);
        }

        if (city) {
          updates.push(`city = $${idx++}`);
          params.push(city);
        }

        if (status) {
          updates.push(`status = $${idx++}`);
          params.push(String(status).toLowerCase());
        }

        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passCheck = validatePasswordComplexity(password);
          if (!passCheck.valid) {
            return res.status(422).json({ error: passCheck.error });
          }
          passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        updates.push(`updated_at = NOW()`);

        let whereClause = '';
        if (targetStaffId) {
          whereClause = `id = $${idx}`;
          params.push(targetStaffId);
        } else {
          const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
          whereClause = `phone = $${idx} OR mobile_number = $${idx}`;
          params.push(cleanPhone);
        }

        let updatedStaff = null;
        try {
          const sql = `UPDATE staff_accounts SET ${updates.join(', ')} WHERE ${whereClause} RETURNING id, name, phone, mobile_number, email, role, department, status;`;
          const qRes = await query(sql, params);
          updatedStaff = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct staff update failed, fallback to Supabase:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const sbUpdates = {};
          if (name) sbUpdates.name = name.trim();
          if (phone) {
            const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
            sbUpdates.phone = cleanPhone;
            sbUpdates.mobile_number = cleanPhone;
          }
          if (email !== undefined) sbUpdates.email = (email && String(email).trim()) ? String(email).trim() : null;
          if (role) {
            sbUpdates.role = role;
            sbUpdates.department = role.toLowerCase().includes('verification') ? 'verification' : (String(department || 'sales').toLowerCase());
          } else if (department) {
            sbUpdates.department = String(department).toLowerCase();
          }
          if (zone) sbUpdates.zone = zone;
          if (city) sbUpdates.city = city;
          if (status) sbUpdates.status = String(status).toLowerCase();
          if (passwordHash) sbUpdates.password_hash = passwordHash;
          sbUpdates.updated_at = new Date().toISOString();

          let q = supabase.from('staff_accounts').update(sbUpdates);
          if (targetStaffId) {
            q = q.eq('id', targetStaffId);
          } else {
            const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
            q = q.or(`phone.eq.${cleanPhone},mobile_number.eq.${cleanPhone}`);
          }
          const { data, error: sbErr } = await q.select('id, name, phone, mobile_number, email, role, department, status').single();
          if (sbErr) throw sbErr;
          updatedStaff = data;
        }

        return res.status(200).json({
          success: true,
          message: 'Staff profile and credentials updated successfully.',
          staff: updatedStaff
        });
      }

      case 'delete-dealer': {
        const { id, dealerCode } = payload;
        const rawTarget = dealerCode || id;
        const target = String(rawTarget || '').replace(/^#/, '').trim();
        if (!target) return res.status(400).json({ error: 'Dealer identifier required.' });
        try {
          await query('DELETE FROM dealer_accounts WHERE dealer_code = $1 OR id::text = $1', [target]);
        } catch (_) {
          const supabase = getSupabaseServiceClient();
          let q = supabase.from('dealer_accounts').delete();
          if (isUuid(target)) {
            q = q.or(`dealer_code.eq.${target},id.eq.${target}`);
          } else {
            q = q.eq('dealer_code', target);
          }
          await q;
        }
        return res.status(200).json({ success: true, message: `Dealer ${target} removed.` });
      }

      case 'delete-staff': {
        const { id, staffId } = payload;
        const target = id || staffId;
        if (!target) return res.status(400).json({ error: 'Staff ID required.' });
        try {
          await query('DELETE FROM staff_accounts WHERE id = $1', [target]);
        } catch (_) {
          const supabase = getSupabaseServiceClient();
          await supabase.from('staff_accounts').delete().eq('id', target);
        }
        return res.status(200).json({ success: true, message: `Staff ${target} removed.` });
      }

      case 'get-accounts': {
        let admins = [];
        let dealers = [];
        let staff = [];

        try {
          const adminsRes = await query('SELECT id, email, full_name, role, mobile_number, two_factor_enabled, last_login, created_at FROM admin_accounts ORDER BY created_at ASC');
          admins = adminsRes?.rows || [];
        } catch (e) {
          console.warn('[manage-credentials] Fallback get admins via Supabase:', e.message);
          const supabase = getSupabaseServiceClient();
          const { data } = await supabase.from('admin_accounts').select('id, email, full_name, role, mobile_number, two_factor_enabled, last_login, created_at').order('created_at', { ascending: true });
          admins = data || [];
        }

        try {
          const dealersRes = await query('SELECT id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at FROM dealer_accounts ORDER BY updated_at DESC');
          dealers = dealersRes?.rows || [];
        } catch (e) {
          console.warn('[manage-credentials] Fallback get dealers via Supabase:', e.message);
          const supabase = getSupabaseServiceClient();
          const { data } = await supabase.from('dealer_accounts').select('id, dealer_code, firm_name, contact_person, mobile_number, email, city, state, discom, tier, max_margin_cap_per_kw, status, assigned_staff_id, assigned_staff_name, pricing_config, created_at, updated_at').order('updated_at', { ascending: false });
          dealers = data || [];
        }

        try {
          const staffRes = await query('SELECT id, name, role, department, phone, email, status, onboarded_date, zone, city, created_at, updated_at FROM staff_accounts ORDER BY created_at ASC');
          staff = staffRes?.rows || [];
        } catch (e) {
          console.warn('[manage-credentials] Fallback get staff via Supabase:', e.message);
          const supabase = getSupabaseServiceClient();
          const { data } = await supabase.from('staff_accounts').select('id, name, role, department, phone, email, status, onboarded_date, zone, city, created_at, updated_at').order('created_at', { ascending: true });
          staff = data || [];
        }

        return res.status(200).json({
          success: true,
          admins,
          dealers,
          staff
        });
      }

      case 'create-admin': {
        const { fullName, email, mobileNumber, role, password } = payload;
        if (!fullName || !email) {
          return res.status(400).json({ error: 'Full name and email are required.' });
        }
        const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
          return res.status(400).json({ error: 'Valid 10-digit mobile number is required.' });
        }
        // Require a valid password (min 6 chars + 1 special char)
        const passCheck = validatePasswordComplexity(password);
        if (!passCheck.valid) {
          return res.status(422).json({ error: passCheck.error });
        }
        const plainPassword = String(password).trim();
        const passwordHash = hashBcrypt(plainPassword, 10);
        const adminRole = role || 'admin';

        let newAdmin = null;
        try {
          const sql = `
            INSERT INTO admin_accounts (
              email, full_name, mobile_number, role, password_hash, two_factor_enabled, created_at
            ) VALUES ($1, $2, $3, $4, $5, false, NOW())
            RETURNING id, email, full_name, mobile_number, role, created_at;
          `;
          const qRes = await query(sql, [email.trim().toLowerCase(), fullName.trim(), cleanMobile, adminRole, passwordHash]);
          newAdmin = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct admin insert failed, fallback to Supabase:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const { data: inserted, error: insertErr } = await supabase
            .from('admin_accounts')
            .insert({
              email: email.trim().toLowerCase(),
              full_name: fullName.trim(),
              mobile_number: cleanMobile,
              role: adminRole,
              password_hash: passwordHash,
              two_factor_enabled: false
            })
            .select('id, email, full_name, mobile_number, role, created_at')
            .single();

          if (insertErr) throw insertErr;
          newAdmin = inserted;
        }

        return res.status(200).json({
          success: true,
          message: `Admin ${fullName} created successfully.`,
          admin: newAdmin
        });
      }

      case 'update-admin': {
        const { id, fullName, email, mobileNumber, role, password } = payload;
        if (!id) return res.status(400).json({ error: 'Admin ID is required.' });

        const updates = [];
        const params = [];
        let idx = 1;
        let passwordHash = null;

        if (fullName) {
          updates.push(`full_name = $${idx++}`);
          params.push(fullName.trim());
        }
        if (email) {
          updates.push(`email = $${idx++}`);
          params.push(email.trim().toLowerCase());
        }
        if (mobileNumber) {
          const cleanMobile = String(mobileNumber).replace(/\D/g, '').slice(-10);
          updates.push(`mobile_number = $${idx++}`);
          params.push(cleanMobile);
        }
        if (role) {
          updates.push(`role = $${idx++}`);
          params.push(role);
        }
        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passCheck = validatePasswordComplexity(password);
          if (!passCheck.valid) {
            return res.status(422).json({ error: passCheck.error });
          }
          passwordHash = hashBcrypt(String(password).trim(), 10);
          updates.push(`password_hash = $${idx++}`);
          params.push(passwordHash);
        }

        if (updates.length === 0) {
          return res.status(400).json({ error: 'No fields provided to update.' });
        }

        let updatedAdmin = null;
        try {
          params.push(id);
          const sql = `UPDATE admin_accounts SET ${updates.join(', ')} WHERE id::text = $${idx} RETURNING id, email, full_name, mobile_number, role;`;
          const qRes = await query(sql, params);
          updatedAdmin = qRes.rows?.[0];
        } catch (dbErr) {
          console.warn('[manage-credentials] Direct admin update failed, fallback to Supabase:', dbErr.message);
          const supabase = getSupabaseServiceClient();
          const sbUpdates = {};
          if (fullName) sbUpdates.full_name = fullName.trim();
          if (email) sbUpdates.email = email.trim().toLowerCase();
          if (mobileNumber) sbUpdates.mobile_number = String(mobileNumber).replace(/\D/g, '').slice(-10);
          if (role) sbUpdates.role = role;
          if (passwordHash) sbUpdates.password_hash = passwordHash;
          sbUpdates.updated_at = new Date().toISOString();

          const { data, error: sbErr } = await supabase.from('admin_accounts').update(sbUpdates).eq('id', id).select('id, email, full_name, mobile_number, role').single();
          if (sbErr) throw sbErr;
          updatedAdmin = data;
        }

        return res.status(200).json({
          success: true,
          message: 'Admin updated successfully.',
          admin: updatedAdmin
        });
      }

      case 'delete-admin': {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'Admin ID required.' });
        let count = 0;
        try {
          const countRes = await query('SELECT count(*) FROM admin_accounts');
          count = parseInt(countRes.rows[0].count, 10);
        } catch (_) {
          const supabase = getSupabaseServiceClient();
          const { count: sbCount } = await supabase.from('admin_accounts').select('*', { count: 'exact', head: true });
          count = sbCount || 0;
        }

        if (count <= 1) {
          return res.status(400).json({ error: 'Cannot delete the only remaining admin account.' });
        }

        try {
          await query('DELETE FROM admin_accounts WHERE id::text = $1', [id]);
        } catch (_) {
          const supabase = getSupabaseServiceClient();
          await supabase.from('admin_accounts').delete().eq('id', id);
        }

        return res.status(200).json({ success: true, message: 'Admin account deleted.' });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[manage-credentials] Error:', err);
    return res.status(500).json({ error: err.message || 'Server error managing credentials.' });
  }
}
