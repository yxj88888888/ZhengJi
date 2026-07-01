const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.join(__dirname, '..');
const functionPath = path.join(
  projectRoot,
  'edge-functions',
  'gold-api',
  '[[default]].js'
);
const configPath = path.join(projectRoot, 'edgeone.json');

if (!fs.existsSync(functionPath)) {
  throw new Error('Expected an EdgeOne catch-all Edge Function');
}

if (!fs.existsSync(configPath)) {
  throw new Error('Expected an EdgeOne deployment configuration');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.outputDirectory !== 'public') {
  throw new Error('Expected EdgeOne to publish the public directory');
}

function createKv(initial = new Map()) {
  return {
    values: initial,
    async get(key, options) {
      const value = this.values.get(key) || null;
      return options && options.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) {
      this.values.set(key, value);
    },
  };
}

function createBlob(initial = new Map()) {
  return {
    values: initial,
    async get(key, options) {
      const value = this.values.get(key) || null;
      return options && options.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) {
      this.values.set(key, value);
    },
    async setJSON(key, value) {
      this.values.set(key, JSON.stringify(value));
    },
  };
}

function createLegacyBlob(initial = new Map()) {
  return {
    values: initial,
    async get(key) {
      return this.values.get(key) || null;
    },
    async put(key, value) {
      this.values.set(key, value);
    },
  };
}

(async () => {
  const moduleUrl = pathToFileURL(functionPath).href + `?t=${Date.now()}`;
  const edgeFunction = await import(moduleUrl);
  const kv = createKv();
  const dependencies = {
    kv,
    now: () => new Date('2026-07-01T16:00:00+08:00'),
  };

  const currentResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/gold/current'),
    dependencies
  );
  const currentPayload = await currentResponse.json();
  if (currentResponse.status !== 200 || currentPayload.code !== 1) {
    throw new Error('Expected the public current price API to succeed');
  }
  if (currentPayload.data.sale_price !== '1130.00' || currentPayload.data.buyback_price !== '1026.50') {
    throw new Error('Expected current price API to return the default fixed price');
  }

  const adminPageResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin'),
    dependencies
  );
  const adminHtml = await adminPageResponse.text();
  if (adminPageResponse.status !== 200 || adminHtml.includes('data-tab="bind"') || !adminHtml.includes('id="grant-form" hidden')) {
    throw new Error('Expected admin page to hide phone permission setup until login');
  }
  if (!adminHtml.includes('id="login-form"') ||
      !adminHtml.includes('id="login-price-form" hidden') ||
      !adminHtml.includes('/gold-api/admin/login')) {
    throw new Error('Expected admin page to hide price editor until login succeeds');
  }
  if (adminHtml.includes('???') || !adminHtml.includes('手机号') || !adminHtml.includes('登录后台')) {
    throw new Error('Expected admin page Chinese copy to render without question marks');
  }
  if (!adminHtml.includes('function apiPath(path)') ||
      !adminHtml.includes("requestJson('/gold-api/admin/price'") ||
      !adminHtml.includes("requestJson('/gold-api/admin/bind'")) {
    throw new Error('Expected admin page API calls to preserve EdgeOne preview token');
  }
  if (!adminHtml.includes("requestJson('/gold-api/admin/price'") ||
      !adminHtml.includes("setStatus('已保存：'") ||
      !adminHtml.includes('loadPrice().catch')) {
    throw new Error('Expected admin page script to include complete price loading and saving handlers');
  }
  if (!adminHtml.includes('id="account-table" hidden') ||
      !adminHtml.includes('function renderAccountRows') ||
      !adminHtml.includes('function roleText') ||
      !adminHtml.includes('function permissionText')) {
    throw new Error('Expected admin page to render an account table after login');
  }

  const previewAdminResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin?eo_token=test-token&eo_time=123456'),
    dependencies
  );
  const previewAdminHtml = await previewAdminResponse.text();
  if (!previewAdminHtml.includes('const edgeOnePreviewToken = "test-token";') ||
      !previewAdminHtml.includes('const edgeOnePreviewTime = "123456";')) {
    throw new Error('Expected admin page to embed EdgeOne preview credentials for API calls');
  }

  const unboundSaveResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'abc123',
        sale_price: '1168.88',
        buyback_price: '1055.66',
      }),
    }),
    dependencies
  );
  if (unboundSaveResponse.status !== 401) {
    throw new Error('Expected price save to require a bound phone account first');
  }

  const unauthorizedBindResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13800138000', password: 'abc123' }),
    }),
    dependencies
  );
  if (unauthorizedBindResponse.status !== 401) {
    throw new Error('Expected account authorization to require a logged-in super admin');
  }

  const superLoginResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '18189182920', password: 'owner123' }),
    }),
    dependencies
  );
  const superLoginPayload = await superLoginResponse.json();
  if (superLoginResponse.status !== 200 || superLoginPayload.role !== 'super' || !superLoginPayload.can_manage_users) {
    throw new Error('Expected 18189182920 to log in as the super admin');
  }

  const bindResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_phone: '18189182920',
        admin_password: 'owner123',
        phone: '13800138000',
        password: 'abc123',
      }),
    }),
    dependencies
  );
  const bindPayload = await bindResponse.json();
  if (bindResponse.status !== 200 || bindPayload.code !== 1 || bindPayload.data.phone !== '13800138000') {
    throw new Error('Expected super admin to authorize another phone account');
  }
  if (!kv.values.has('zhengji_gold_admin_account')) {
    throw new Error('Expected admin accounts to be saved under the ZhengJi admin KV key');
  }

  const loginResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'abc123',
      }),
    }),
    dependencies
  );
  const loginPayload = await loginResponse.json();
  if (loginResponse.status !== 200 ||
      loginPayload.code !== 1 ||
      loginPayload.admin_phone !== '13800138000' ||
      loginPayload.role !== 'editor' ||
      loginPayload.data.sale_price !== '1130.00') {
    throw new Error('Expected authorized editor login to return current editable prices');
  }

  const wrongPasswordResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'wrong-password',
        sale_price: '1168.88',
        buyback_price: '1055.66',
      }),
    }),
    dependencies
  );
  if (wrongPasswordResponse.status !== 401) {
    throw new Error('Expected wrong password to be rejected');
  }

  const saveResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'abc123',
        sale_price: '1168.88',
        buyback_price: '1055.66',
      }),
    }),
    dependencies
  );
  const savePayload = await saveResponse.json();
  if (saveResponse.status !== 200 || savePayload.code !== 1) {
    throw new Error('Expected authorized admin price save to succeed');
  }
  if (savePayload.data.sale_price !== '1168.88' || savePayload.data.buyback_price !== '1055.66') {
    throw new Error('Expected admin save to return normalized fixed prices');
  }

  const adminPriceResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price'),
    dependencies
  );
  const adminPricePayload = await adminPriceResponse.json();
  if (!adminPricePayload.admin_bound ||
      adminPricePayload.admin_phone !== '18189182920' ||
      !adminPricePayload.authorized_phones.some(account => account.phone === '13800138000' && account.role === 'editor')) {
    throw new Error('Expected admin price status to expose super admin and authorized editor metadata');
  }

  const afterSaveResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/gold/current'),
    dependencies
  );
  const afterSavePayload = await afterSaveResponse.json();
  if (afterSavePayload.data.sale_price !== '1168.88' || afterSavePayload.data.buyback_price !== '1055.66') {
    throw new Error('Expected public current price to use the saved admin value');
  }

  if (!kv.values.has('zhengji_gold_fixed_current')) {
    throw new Error('Expected fixed price to be saved under the ZhengJi KV key');
  }

  const historyResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/gold/history?range=today'),
    dependencies
  );
  const historyPayload = await historyResponse.json();
  if (!Array.isArray(historyPayload.data) || historyPayload.data.length !== 1) {
    throw new Error('Expected fixed-price history endpoint to return one compatibility point');
  }
  if (historyPayload.data[0].sale_price !== '1168.88') {
    throw new Error('Expected fixed-price history point to match the current fixed price');
  }

  const invalidBindResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_phone: '18189182920',
        admin_password: 'owner123',
        phone: '12345',
        password: 'abc123',
      }),
    }),
    dependencies
  );
  if (invalidBindResponse.status !== 400) {
    throw new Error('Expected invalid phone binding to be rejected');
  }

  const invalidSaveResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13800138000',
        password: 'abc123',
        sale_price: 'abc',
        buyback_price: '1055.66',
      }),
    }),
    dependencies
  );
  if (invalidSaveResponse.status !== 400) {
    throw new Error('Expected invalid admin prices to be rejected');
  }

  const healthResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/health?debug=kv'),
    dependencies
  );
  const healthPayload = await healthResponse.json();
  if (healthPayload.mode !== 'fixed-price' ||
      healthPayload.kv_key !== 'zhengji_gold_fixed_current' ||
      healthPayload.admin_key !== 'zhengji_gold_admin_account' ||
      !healthPayload.admin_bound) {
    throw new Error('Expected health endpoint to describe fixed-price mode and admin binding');
  }

  const blob = createBlob();
  const blobDependencies = {
    blob,
    now: () => new Date('2026-07-01T17:00:00+08:00'),
  };
  await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '18189182920', password: 'owner123' }),
    }),
    blobDependencies
  );
  const blobBindResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_phone: '18189182920',
        admin_password: 'owner123',
        phone: '13900139000',
        password: 'blob123',
      }),
    }),
    blobDependencies
  );
  if (blobBindResponse.status !== 200 || !blob.values.has('zhengji_gold_admin_account')) {
    throw new Error('Expected Blob fallback to persist the admin account');
  }

  const blobSaveResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '13900139000',
        password: 'blob123',
        sale_price: '1177.00',
        buyback_price: '1066.00',
      }),
    }),
    blobDependencies
  );
  if (blobSaveResponse.status !== 200 || !blob.values.has('zhengji_gold_fixed_current')) {
    throw new Error('Expected Blob fallback to persist the fixed price');
  }

  const blobHealthResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/health'),
    blobDependencies
  );
  const blobHealthPayload = await blobHealthResponse.json();
  if (blobHealthPayload.storage !== 'blob' || blobHealthPayload.kv !== 'disabled') {
    throw new Error('Expected health endpoint to report Blob fallback storage');
  }

  const legacyBlob = createLegacyBlob();
  const legacyDependencies = {
    blob: legacyBlob,
    now: () => new Date('2026-07-01T17:30:00+08:00'),
  };
  await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '18189182920', password: 'owner123' }),
    }),
    legacyDependencies
  );
  const legacyBindResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_phone: '18189182920',
        admin_password: 'owner123',
        phone: '13700137000',
        password: 'legacy123',
      }),
    }),
    legacyDependencies
  );
  if (legacyBindResponse.status !== 200 || !legacyBlob.values.has('zhengji_gold_admin_account')) {
    throw new Error('Expected legacy Blob fallback to persist the admin account');
  }

  console.log('EdgeOne function supports phone-bound admin price updates');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
