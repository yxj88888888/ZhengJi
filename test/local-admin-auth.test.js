const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const expectedSnippets = [
  'SUPER_ADMIN_PHONE',
  "const SUPER_ADMIN_PHONE = '18189182920'",
  'function normalizeAdminAccounts',
  'function getAdminAccounts',
  'function upsertAdminAccount',
  'function requireSuperAdminAccount',
  'function requireAuthorizedAccount',
  'id="login-form"',
  'id="login-price-form" hidden',
  'id="grant-form" hidden',
  'can_manage_users',
  'authorized_phones',
  'admin_phone: loggedInPhone',
  'admin_password: loggedInPassword',
  "requestJson('/gold-api/admin/bind'",
  "requestJson('/gold-api/admin/price'",
  'loadPrice().catch',
];

for (const snippet of expectedSnippets) {
  if (!serverSource.includes(snippet)) {
    throw new Error(`Missing local admin permission implementation snippet: ${snippet}`);
  }
}

if (serverSource.includes('???')) {
  throw new Error('Admin page should not contain question-mark mojibake');
}

if (serverSource.includes('data-tab="bind"')) {
  throw new Error('Phone permission setup should not appear as a pre-login tab');
}

if (serverSource.includes("app.get('/gold-api/admin', requireGoldAdmin")) {
  throw new Error('Admin page should no longer use Basic Auth middleware');
}

console.log('local server supports super-admin authorized price editors');
