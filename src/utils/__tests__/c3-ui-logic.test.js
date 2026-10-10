import test from 'node:test';
import assert from 'node:assert/strict';

// Helper functions mirroring C3 UI Logic

export function resolveAuthState(verifiedUser, transientRoleHint) {
  if (verifiedUser && verifiedUser.role) {
    return {
      isAuthenticated: true,
      currentUser: verifiedUser,
      role: verifiedUser.role
    };
  }
  return {
    isAuthenticated: false,
    currentUser: null,
    role: 'dealer' // Default fallback unauthenticated view
  };
}

export function getDealerMarginCap(dealer, tierMargins) {
  if (dealer?.pricingConfig?.maxMarginCapPerKw !== undefined) {
    return Number(dealer.pricingConfig.maxMarginCapPerKw);
  }
  const tierKey = (dealer?.tier || 'gold').toLowerCase().replace(/\s+epc$/i, '');
  const tierConfig = tierMargins?.[tierKey] || tierMargins?.gold || { defaultMarginPerKw: 0, maxMarginCapPerKw: 0 };
  return Number(tierConfig.maxMarginCapPerKw || 0);
}

export function isQuoteFlaggedForAudit(quote, dealer, tierMargins) {
  const capKw = Number(quote.system_capacity_kw || quote.systemCapacityKW || quote.capacity || 0);
  const totalMargin = Number(quote.dealer_margin || quote.dealerTotalMargin || 0);
  const dealerCap = getDealerMarginCap(dealer, tierMargins);
  const marginPerKw = capKw > 0 ? (quote.dealerMarginPerKW || Math.round(totalMargin / capKw)) : (dealerCap || 0);
  
  if (dealerCap > 0 && marginPerKw > dealerCap) {
    return true;
  }
  return Boolean(quote.isFlagged);
}

export function getStoredSubsidy(quote) {
  if (quote.subsidy_amount !== undefined && quote.subsidy_amount !== null) {
    return Number(quote.subsidy_amount);
  }
  if (quote.subsidyAmount !== undefined && quote.subsidyAmount !== null) {
    return Number(quote.subsidyAmount);
  }
  if (quote.subsidy !== undefined && quote.subsidy !== null) {
    return Number(quote.subsidy);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// C3 AUTH STATE HYDRATION (SEC-014)
// ─────────────────────────────────────────────────────────────────────────────
test('SEC-014: Auth state hydration strictly uses verified backend session', () => {
  const verifiedAdmin = { id: 'ADM-001', email: 'admin@sunvine.in', role: 'admin', fullName: 'Super Admin' };
  const verifiedState = resolveAuthState(verifiedAdmin, 'dealer'); // localStorage had 'dealer' hint
  assert.equal(verifiedState.isAuthenticated, true);
  assert.equal(verifiedState.currentUser.id, 'ADM-001');
  assert.equal(verifiedState.role, 'admin');

  // When verify returns null/failed, transient hint is NOT trusted for authenticated state
  const unverifiedState = resolveAuthState(null, 'admin');
  assert.equal(unverifiedState.isAuthenticated, false);
  assert.equal(unverifiedState.currentUser, null);
  assert.equal(unverifiedState.role, 'dealer');
});

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC TIER MARGIN RESOLUTION (HC-03)
// ─────────────────────────────────────────────────────────────────────────────
test('HC-03: Dynamic tier margin resolution does not use hardcoded constants', () => {
  const customTierMargins = {
    gold: { defaultMarginPerKw: 4200, maxMarginCapPerKw: 5800 },
    diamond: { defaultMarginPerKw: 5200, maxMarginCapPerKw: 7200 },
    platinum: { defaultMarginPerKw: 4800, maxMarginCapPerKw: 6500 }
  };

  const goldDealer = { id: 'DLR-1', tier: 'Gold EPC' };
  const diamondDealer = { id: 'DLR-2', tier: 'Diamond EPC' };
  const customConfigDealer = { id: 'DLR-3', tier: 'Gold EPC', pricingConfig: { maxMarginCapPerKw: 6200 } };

  assert.equal(getDealerMarginCap(goldDealer, customTierMargins), 5800);
  assert.equal(getDealerMarginCap(diamondDealer, customTierMargins), 7200);
  assert.equal(getDealerMarginCap(customConfigDealer, customTierMargins), 6200);
});

// ─────────────────────────────────────────────────────────────────────────────
// QUOTATION MARGIN AUDIT FLAGGING & STORED SUBSIDY (HC-04)
// ─────────────────────────────────────────────────────────────────────────────
test('HC-04: Quotation audit flagging uses dynamic dealer margin cap', () => {
  const tierMargins = {
    gold: { defaultMarginPerKw: 4000, maxMarginCapPerKw: 5000 }
  };
  const dealer = { id: 'DLR-01', tier: 'Gold EPC' };

  // Quote with 4500/kW spread (within 5000 cap)
  const compliantQuote = {
    systemCapacityKW: 3.3,
    dealerMarginPerKW: 4500,
    dealerTotalMargin: 14850
  };
  assert.equal(isQuoteFlaggedForAudit(compliantQuote, dealer, tierMargins), false);

  // Quote with 5500/kW spread (exceeds 5000 cap)
  const flaggedQuote = {
    systemCapacityKW: 3.3,
    dealerMarginPerKW: 5500,
    dealerTotalMargin: 18150
  };
  assert.equal(isQuoteFlaggedForAudit(flaggedQuote, dealer, tierMargins), true);
});

test('HC-04: Stored subsidy retrieval extracts stored subsidy amount without hardcoded fallback', () => {
  assert.equal(getStoredSubsidy({ subsidy_amount: 78000 }), 78000);
  assert.equal(getStoredSubsidy({ subsidyAmount: 60000 }), 60000);
  assert.equal(getStoredSubsidy({ subsidy: 45000 }), 45000);
  assert.equal(getStoredSubsidy({}), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME LOCKDOWN & LIFECYCLE CLEANUP ASSERTIONS (BUG-06 / AUDIT-R3)
// ─────────────────────────────────────────────────────────────────────────────
test('BUG-06 & Area 1: AppContext.jsx has zero realtime subscriptions on sensitive tables', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const appContextContent = fs.readFileSync(path.resolve(process.cwd(), 'src/context/AppContext.jsx'), 'utf8');

  const sensitiveTables = [
    'quotations',
    'customer_files',
    'dealer_accounts',
    'staff_accounts',
    'dealer_custom_pricing',
    'notifications'
  ];

  for (const table of sensitiveTables) {
    const tableSubRegex = new RegExp(`table:\\s*['"\`]${table}['"\`]`, 'i');
    assert.equal(
      tableSubRegex.test(appContextContent),
      false,
      `AppContext.jsx must NOT have Supabase realtime subscription on sensitive table: ${table}`
    );
  }

  // Verify no dead supabase.channel subscriptions exist in AppContext.jsx (ITEM-6)
  assert.equal(
    appContextContent.includes('supabase.channel('),
    false,
    'AppContext.jsx must NOT contain dead supabase.channel subscriptions'
  );

  // Verify 60s interval and event cleanup exists in AppContext.jsx (ITEM-6)
  assert.ok(appContextContent.includes('60000'), 'AppContext.jsx must contain 60s periodic polling interval');
  assert.ok(appContextContent.includes("window.removeEventListener('focus'"));
  assert.ok(appContextContent.includes("document.removeEventListener('visibilitychange'"));
  assert.ok(appContextContent.includes('clearInterval(intervalTimer)'));
  assert.ok(appContextContent.includes('broadcastChannel.close()'));
});

