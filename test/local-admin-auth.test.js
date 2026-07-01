const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const expectedSnippets = [
  'ADMIN_ACCOUNT_FILE',
  'function isValidAdminPhone',
  'function saveAdminAccount',
  "app.post('/gold-api/admin/bind'",
  "app.post('/gold-api/admin/login'",
  "app.post('/gold-api/admin/price'",
  'requireAccountMatch(account, req.body)',
  'id="login-form"',
  'id="login-price-form" hidden',
  '/gold-api/admin/login',
  'loggedInPhone',
  'function apiPath(path)',
  "fetch(apiPath('/gold-api/admin/price'))",
  '绑定手机号',
  '设置密码',
  '手机号或密码不正确',
];

for (const snippet of expectedSnippets) {
  if (!serverSource.includes(snippet)) {
    throw new Error(`Missing local admin auth implementation snippet: ${snippet}`);
  }
}


if (serverSource.includes('???')) {
  throw new Error('Admin page should not contain question-mark mojibake');
}

if (serverSource.includes("app.get('/gold-api/admin', requireGoldAdmin")) {
  throw new Error('Admin page should no longer use Basic Auth middleware');
}

console.log('local server supports phone-bound admin price updates');
