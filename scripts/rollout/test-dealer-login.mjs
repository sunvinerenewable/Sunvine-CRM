import { withClient } from './db.mjs';
import bcrypt from 'bcryptjs';

async function testLogin() {
  await withClient(async (client) => {
    const res = await client.query(`
      SELECT dealer_code, firm_name, contact_person, mobile_number, status, password_hash 
      FROM dealer_accounts 
      WHERE mobile_number = $1
    `, ['9825658566']);

    if (res.rows.length === 0) {
      console.error('❌ Dealer not found in database!');
      return;
    }

    const dealer = res.rows[0];
    console.log('✅ Dealer found in DB:', dealer.dealer_code, dealer.firm_name, dealer.contact_person, dealer.mobile_number);

    const isMatch = await bcrypt.compare('dinesh123', dealer.password_hash);
    console.log('🔑 Password verification for "dinesh123":', isMatch ? '✅ MATCHES (SUCCESS)' : '❌ FAILED');
  });
}

testLogin().catch(e => console.error(e.message));
