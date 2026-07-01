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
  '绑定手机号',
  '设置密码',
  '登录后台',
  '手机号或密码不正确',
  '/gold-api/admin/login',
  'loggedInPhone',
  'function apiPath(path)',
  "requestJson('/gold-api/admin/price'",
  'edgeOnePreviewToken',
  "setStatus('已保存：'",
  'loadPrice().catch',
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
