import { getSupabaseServiceClient } from '../../api/_lib/db.js';
import bcrypt from 'bcryptjs';

async function testDealer() {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('dealer_accounts').select('*').eq('mobile_number', '9825658566');

  if (error || !data || data.length === 0) {
    console.error('❌ Dealer lookup failed:', error?.message);
    return;
  }

  const dealer = data[0];
  console.log('✅ Dealer found in Production DB:');
  console.log({
    id: dealer.id,
    dealer_code: dealer.dealer_code,
    firm_name: dealer.firm_name,
    contact_person: dealer.contact_person,
    mobile: dealer.mobile_number,
    status: dealer.status,
    has_hash: Boolean(dealer.password_hash)
  });

  const isMatch = await bcrypt.compare('dinesh123', dealer.password_hash);
  console.log('Password check for "dinesh123":', isMatch ? '✅ MATCHES (SUCCESS)' : '❌ No match');
}

testDealer().catch(e => console.error(e.message));
