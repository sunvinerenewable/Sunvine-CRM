import { query } from './db.js';
import { redisDel } from './redis.js';

const fields = ['adani_price', 'waaree_price', 'central_subsidy', 'general_subsidy', 'sc_st_subsidy'];
const limits = { customer_name: 255, phone: 20, address: 500, city: 100 };
const brands = { Adani: 'adani_price', Waaree: 'waaree_price' };

export async function handleResidentialPackage(req, res, user) {
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

  const action = req.method === 'GET' ? req.query?.action : req.body?.action;
  const body = req.body || {};

  try {
    if (req.method === 'GET' && action === 'package-list') {
      const [settings, quotes] = await Promise.all([
        query("select * from residential_package_settings where id = 'residential-218'"),
        query('select q.*, f.id as application_id, f.residential_package_brand as brand from residential_package_quotes q left join customer_files f on f.residential_package_quote_id = q.id order by q.created_at desc')
      ]);
      if (!settings.rowCount) return res.status(503).json({ error: 'Package settings unavailable.' });
      return res.json({ settings: settings.rows[0], quotes: quotes.rows });
    }

    if (req.method === 'POST' && action === 'package-settings') {
      const amounts = fields.map(field => body[field]);
      if (amounts.some(value => !Number.isSafeInteger(value) || value < 0 || value > 100000000)
        || amounts[0] <= 0 || amounts[1] <= 0
        || amounts[2] + Math.max(amounts[3], amounts[4]) > Math.min(amounts[0], amounts[1])) {
        return res.status(400).json({ error: 'Enter valid whole-rupee prices and subsidies. Combined subsidy must fit both prices.' });
      }
      const result = await query(
        "update residential_package_settings set adani_price=$1, waaree_price=$2, central_subsidy=$3, general_subsidy=$4, sc_st_subsidy=$5 where id='residential-218' returning *",
        amounts
      );
      if (!result.rowCount) return res.status(503).json({ error: 'Package settings unavailable.' });
      return res.json({ settings: result.rows[0] });
    }

    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.id || '')) {
      return res.status(400).json({ error: 'Invalid package quote ID.' });
    }

    if (req.method === 'POST' && action === 'package-create') {
      const values = Object.keys(limits).map(field => typeof body[field] === 'string' ? body[field].trim() : '');
      const [customer_name, phone, address, city] = values;
      if (!customer_name || customer_name.length > limits.customer_name
        || !phone || phone.length > limits.phone || !/^[+\d][\d ()-]{6,19}$/.test(phone)
        || address.length > limits.address
        || !city || city.length > limits.city
        || !['General / OBC', 'SC / ST'].includes(body.category)) {
        return res.status(400).json({ error: 'Valid customer details and a subsidy category are required.' });
      }
      const discount = body.discount ?? 0;
      if (!Number.isSafeInteger(discount) || discount < 0 || discount > 100000000) {
        return res.status(400).json({ error: 'Enter a non-negative whole-rupee discount.' });
      }
      // Capture the complete approved offer in the same statement as quote creation.
      const result = await query(
        `insert into residential_package_quotes (id, created_by, customer_name, phone, address, city, category, snapshot)
          select $1, $2, $3, $4, $5, $6, $7, to_jsonb(s) || jsonb_build_object('discount', $8::integer)
          from residential_package_settings s where id='residential-218'
            and $8::integer <= least(adani_price, waaree_price) - central_subsidy
              - case when $7 = 'SC / ST' then sc_st_subsidy else general_subsidy end
          on conflict (id) do nothing returning *`,
        [body.id, user.id, ...values, body.category, discount]
      );
      const quote = result.rows[0] || (await query(
        'select * from residential_package_quotes where id=$1 and created_by=$2',
        [body.id, user.id]
      )).rows[0];
      if (!quote) return res.status(409).json({ error: 'Could not save the package quote. Check that the discount keeps both net prices at or above zero.' });
      return res.json({ quote });
    }

    if (req.method === 'POST' && action === 'package-convert' && Object.hasOwn(brands, body.brand)) {
      const result = await query(
        `insert into customer_files (
          id, customer_name, phone, address, city, solar_system_kw, system_kw, source_type, stage,
          status, documents, residential_package_quote_id, residential_package_brand, residential_package_price
        )
        select 'FIL-' || to_char(now(), 'YYYY') || '-' || upper(replace(id::text, '-', '')),
          customer_name, phone, address, city, 2.18, 2.18, 'DIRECT_STAFF', 'LEAD_SOURCED',
          'Sourced', '{}'::jsonb, id, $2, (snapshot->>$3)::integer - coalesce((snapshot->>'discount')::integer, 0)
        from residential_package_quotes where id=$1
        on conflict (residential_package_quote_id) do nothing returning id, residential_package_brand`,
        [body.id, body.brand, brands[body.brand]]
      );
      const application = result.rows[0] || (await query(
        'select id, residential_package_brand from customer_files where residential_package_quote_id=$1',
        [body.id]
      )).rows[0];
      if (!application) return res.status(404).json({ error: 'Package quotation not found.' });
      if (application.residential_package_brand !== body.brand) {
        return res.status(409).json({ error: 'This quote already has an application for the other brand.' });
      }
      await redisDel('customer_files:all');
      return res.json({ application });
    }

    return res.status(400).json({ error: 'Invalid package action or brand.' });
  } catch (error) {
    console.error('[residential-package]', error.code);
    return res.status(503).json({ error: 'Package data unavailable. Check that the package migration has been applied.' });
  }
}
