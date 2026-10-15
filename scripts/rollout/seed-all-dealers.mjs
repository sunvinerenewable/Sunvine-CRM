import bcrypt from 'bcryptjs';
import { withClient } from './db.mjs';

const DEALERS = [
  {
    dealer_code: 'SV-DLR-8080',
    firm_name: 'KITCHEN KING',
    contact_person: 'DINESHBHAI',
    mobile_number: '9825658566',
    email: '9825658566@sunvinedealer.in',
    pass: 'dinesh123',
    city: 'Jamnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8072',
    firm_name: 'JAGRUTI MARKTING',
    contact_person: 'HASHMUKHBHAI',
    mobile_number: '9409016550',
    email: '9409016550@sunvinedealer.in',
    pass: 'hashmukh123',
    city: 'Dhoraji',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8073',
    firm_name: 'HELIUS',
    contact_person: 'KISHANBHAI',
    mobile_number: '8000580092',
    email: '8000580092@sunvinedealer.in',
    pass: 'helious123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8074',
    firm_name: 'HELIUS',
    contact_person: 'KULDEEPBHAI',
    mobile_number: '9023370474',
    email: '9023370474@sunvinedealer.in',
    pass: 'kuldeep123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8075',
    firm_name: 'RAHULBHAI - Rajkot',
    contact_person: 'RAHULBHAI',
    mobile_number: '6356680230',
    email: '6356680230@sunvinedealer.in',
    pass: 'rahul123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8076',
    firm_name: 'HARESHBHAI - Jamnagar',
    contact_person: 'HARESHBHAI',
    mobile_number: '9574473488',
    email: '9574473488@sunvinedealer.in',
    pass: 'haresh123',
    city: 'Jamnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8077',
    firm_name: 'HELIUS',
    contact_person: 'GAUTAM MOLIYA',
    mobile_number: '8980982480',
    email: '8980982480@sunvinedealer.in',
    pass: 'gautam123',
    city: 'Jamnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8078',
    firm_name: 'PATIDAR SOLAR',
    contact_person: 'JATINBHAI',
    mobile_number: '9427379474',
    email: '9427379474@sunvinedealer.in',
    pass: 'jatin123',
    city: 'Dhoraji',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8079',
    firm_name: 'SHIVSHAKTI SOLAR',
    contact_person: 'KARANBHAI',
    mobile_number: '8469767434',
    email: '8469767434@sunvinedealer.in',
    pass: 'karan123',
    city: 'Damnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8081',
    firm_name: 'BHUMIKBHAI - Surendranagar',
    contact_person: 'BHUMIKBHAI',
    mobile_number: '7874752459',
    email: '7874752459@sunvinedealer.in',
    pass: 'bhumik123',
    city: 'Surendranagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8082',
    firm_name: 'JOSHI SOLAR',
    contact_person: 'ANIL JOSHI',
    mobile_number: '9428190394',
    email: '9428190394@sunvinedealer.in',
    pass: 'anil123',
    city: 'Umrala',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8083',
    firm_name: 'SK SOLAR SYSTEM',
    contact_person: 'SAGAR BHAI',
    mobile_number: '9227001192',
    email: '9227001192@sunvinedealer.in',
    pass: 'sagar123',
    city: 'Bhavnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8084',
    firm_name: 'MAHADEV ELECTRIC',
    contact_person: 'DHARMESHBHAI',
    mobile_number: '9316890648',
    email: '9316890648@sunvinedealer.in',
    pass: 'dharmesh123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8085',
    firm_name: 'GANESH ELECTRICS',
    contact_person: 'PRITESHBHAI',
    mobile_number: '8401760830',
    email: '8401760830@sunvinedealer.in',
    pass: 'pritesh123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8086',
    firm_name: 'DHAVALBHAI - Sardhar',
    contact_person: 'DHAVALBHAI',
    mobile_number: '7201899990',
    email: '7201899990@sunvinedealer.in',
    pass: 'dhaval123',
    city: 'Sardhar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8087',
    firm_name: 'XERON ENERGY',
    contact_person: 'DEEPBHAI',
    mobile_number: '8320545680',
    email: '8320545680@sunvinedealer.in',
    pass: 'deep123',
    city: 'Upleta',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8088',
    firm_name: 'KISHORBHAI - Surat',
    contact_person: 'KISHORBHAI',
    mobile_number: '7861859687',
    email: '7861859687@sunvinedealer.in',
    pass: 'kishor123',
    city: 'Surat',
    state: 'Gujarat',
    discom: 'DGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8089',
    firm_name: 'AXITA POWER',
    contact_person: 'PINTUBHAI',
    mobile_number: '9624252200',
    email: '9624252200@sunvinedealer.in',
    pass: 'pintu123',
    city: 'Lakhtar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8090',
    firm_name: 'MANISHBHAI PGVCL',
    contact_person: 'MANISHBHAI',
    mobile_number: '9510489674',
    email: '9510489674@sunvinedealer.in',
    pass: 'manish123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8092',
    firm_name: 'VELANI SALES',
    contact_person: 'ZISHANBHAI',
    mobile_number: '9998524392',
    email: '9998524392@sunvinedealer.in',
    pass: 'zishan123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8093',
    firm_name: 'KUDRAT ELECTRIC',
    contact_person: 'RAMESHBHAI',
    mobile_number: '9875109414',
    email: '9875109414@sunvinedealer.in',
    pass: 'ramesh123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8094',
    firm_name: 'HITESHBHAI GOHIL - Bhavnagar',
    contact_person: 'HITESHBHAI GOHIL',
    mobile_number: '9998121815',
    email: '9998121815@sunvinedealer.in',
    pass: 'hitesh123',
    city: 'Bhavnagar',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8095',
    firm_name: 'PRASHANTBHAI - Rajkot',
    contact_person: 'PRASHANTBHAI',
    mobile_number: '8460153207',
    email: '8460153207@sunvinedealer.in',
    pass: 'prashant123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8096',
    firm_name: 'SIDDHNATH SOLAR & ELECTRICS',
    contact_person: 'ASHOKBHAI',
    mobile_number: '9106422817',
    email: '9106422817@sunvinedealer.in',
    pass: 'ashok123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8070',
    firm_name: 'NEHKAM SUN SOLAR',
    contact_person: 'KAMLESHBHAI THUNGA',
    mobile_number: '7405508182',
    email: '7405508182@sunvinedealer.in',
    pass: 'kamlesh123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  },
  {
    dealer_code: 'SV-DLR-8071',
    firm_name: 'JAY SOLAR ENERGY & WIND',
    contact_person: 'JAYDEEPBHAI',
    mobile_number: '9408081050',
    email: '9408081050@sunvinedealer.in',
    pass: 'jaydeep123',
    city: 'Rajkot',
    state: 'Gujarat',
    discom: 'PGVCL',
    tier: 'Gold EPC',
    max_margin_cap_per_kw: 6000.00,
    status: 'active'
  }
];

async function seedDealers() {
  console.log(`Starting import of ${DEALERS.length} dealer accounts into Staging Database...`);
  
  await withClient(async (client) => {
    for (const d of DEALERS) {
      const hash = await bcrypt.hash(d.pass, 10);
      await client.query(`
        INSERT INTO public.dealer_accounts (
          dealer_code, firm_name, contact_person, mobile_number, email, 
          password_hash, city, state, discom, tier, max_margin_cap_per_kw, 
          assigned_staff_id, assigned_staff_name, status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'STF-DIRECT', 'Direct to Company (HQ Desk)', $12, NOW()
        )
        ON CONFLICT (dealer_code) DO UPDATE SET
          firm_name = EXCLUDED.firm_name,
          contact_person = EXCLUDED.contact_person,
          mobile_number = EXCLUDED.mobile_number,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          discom = EXCLUDED.discom,
          tier = EXCLUDED.tier,
          max_margin_cap_per_kw = EXCLUDED.max_margin_cap_per_kw,
          status = EXCLUDED.status,
          updated_at = NOW();
      `, [
        d.dealer_code, d.firm_name, d.contact_person, d.mobile_number, d.email,
        hash, d.city, d.state, d.discom, d.tier, d.max_margin_cap_per_kw, d.status
      ]);
      console.log(`✅ Seeded dealer: [${d.dealer_code}] ${d.firm_name} (${d.mobile_number})`);
    }
  });

  console.log(`\n🎉 ALL ${DEALERS.length} DEALERS SUCCESSFULLY IMPORTED & HASHED IN DATABASE!`);
}

seedDealers().catch(e => console.error('Error seeding dealers:', e.message));
