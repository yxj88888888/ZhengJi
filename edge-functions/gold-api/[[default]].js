import { getStore as getBlobSdkStore } from '@edgeone/pages-blob';

const FIXED_PRICE_KEY = 'zhengji_gold_fixed_current';
const ADMIN_ACCOUNT_KEY = 'zhengji_gold_admin_account';
const SUPER_ADMIN_PHONE = '18189182920';
const DEFAULT_SALE_PRICE = 1130;
const DEFAULT_BUYBACK_PRICE = 1026.5;

let memoryPrice = null;
let memoryAdminAccounts = null;

function getKvStore(dependencies = {}) {
  if (dependencies.kv) return dependencies.kv;
  if (dependencies.env && dependencies.env.ZHENGJI_GOLD_KV) return dependencies.env.ZHENGJI_GOLD_KV;
  if (typeof ZHENGJI_GOLD_KV !== 'undefined') return ZHENGJI_GOLD_KV;
  if (globalThis.ZHENGJI_GOLD_KV) return globalThis.ZHENGJI_GOLD_KV;
  return null;
}

function getBlobStore(dependencies = {}) {
  if (dependencies.blob) return dependencies.blob;
  if (typeof globalThis.getStore === 'function') return globalThis.getStore('zhengji_gold_store');
  if (getBlobSdkStore) return getBlobSdkStore({ name: 'zhengji_gold_store', consistency: 'strong' });
  return null;
}

function createStorage(dependencies = {}) {
  const kv = getKvStore(dependencies);
  if (kv) {
    return {
      type: 'kv',
      async get(key) {
        return kv.get(key, { type: 'json' });
      },
      async put(key, value) {
        await kv.put(key, JSON.stringify(value));
      },
    };
  }

  const blob = getBlobStore(dependencies);
  if (blob) {
    return {
      type: 'blob',
      async get(key) {
        const value = await blob.get(key, { type: 'json', consistency: 'strong' });
        if (!value) return null;
        return value;
      },
      async put(key, value) {
        if (typeof blob.setJSON === 'function') {
          await blob.setJSON(key, value);
          return;
        }
        await blob.put(key, JSON.stringify(value));
      },
    };
  }

  return null;
}

function getKvDebug(dependencies = {}) {
  const env = dependencies.env || {};
  return {
    env_keys: Object.keys(env).filter(key => /kv|gold|zhengji/i.test(key)),
    env_zhengji_gold_kv: Boolean(env.ZHENGJI_GOLD_KV),
    bare_zhengji_gold_kv: typeof ZHENGJI_GOLD_KV !== 'undefined',
    global_zhengji_gold_kv: Boolean(globalThis.ZHENGJI_GOLD_KV),
    blob_store: Boolean(dependencies.blob || globalThis.getStore || getBlobSdkStore),
  };
}

function getEnvValue(dependencies, key, fallback) {
  const env = dependencies.env || {};
  return env[key] || dependencies[key] || fallback;
}

function getDefaultPrice(dependencies = {}, now = new Date()) {
  const sale = Number(getEnvValue(dependencies, 'ZHENGJI_DEFAULT_SALE_PRICE', DEFAULT_SALE_PRICE));
  const buyback = Number(getEnvValue(dependencies, 'ZHENGJI_DEFAULT_BUYBACK_PRICE', DEFAULT_BUYBACK_PRICE));
  return {
    sale_price: Number.isFinite(sale) ? sale : DEFAULT_SALE_PRICE,
    buyback_price: Number.isFinite(buyback) ? buyback : DEFAULT_BUYBACK_PRICE,
    update_time: formatBeijingDateTime(now),
    updated_by: 'default',
  };
}

function formatBeijingDateTime(now = new Date()) {
  return now.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}

function normalizePrice(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null;

  const sale = Number(raw.sale_price);
  const buyback = Number(raw.buyback_price);
  if (!Number.isFinite(sale) || !Number.isFinite(buyback) || sale <= 0 || buyback <= 0) {
    return null;
  }

  return {
    sale_price: sale,
    buyback_price: buyback,
    update_time: raw.update_time || formatBeijingDateTime(now),
    updated_by: raw.updated_by || 'admin',
  };
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || '').trim());
}

function isValidPassword(password) {
  return String(password || '').length >= 6;
}

function normalizeAdminAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidPhone(raw.phone) || !isValidPassword(raw.password)) return null;

  const phone = String(raw.phone).trim();
  return {
    phone,
    password: String(raw.password),
    role: phone === SUPER_ADMIN_PHONE || raw.role === 'super' ? 'super' : 'editor',
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

function normalizeAdminAccounts(raw) {
  const sourceAccounts = Array.isArray(raw && raw.accounts) ? raw.accounts : (raw && raw.phone ? [raw] : []);
  const accounts = [];
  const seen = new Set();

  for (const sourceAccount of sourceAccounts) {
    const account = normalizeAdminAccount(sourceAccount);
    if (!account || seen.has(account.phone)) continue;
    seen.add(account.phone);
    accounts.push(account);
  }

  return accounts;
}

async function loadFixedPrice(storage, dependencies, now) {
  if (storage) {
    const saved = await storage.get(FIXED_PRICE_KEY);
    const normalized = normalizePrice(saved, now);
    if (normalized) {
      memoryPrice = normalized;
      return normalized;
    }
  }

  if (memoryPrice) return memoryPrice;

  memoryPrice = getDefaultPrice(dependencies, now);
  return memoryPrice;
}

async function saveFixedPrice(storage, price) {
  memoryPrice = price;
  if (storage) {
    await storage.put(FIXED_PRICE_KEY, {
      ...price,
      saved_at: new Date().toISOString(),
    });
  }
}

async function loadAdminAccounts(storage) {
  if (storage) {
    const saved = await storage.get(ADMIN_ACCOUNT_KEY);
    const normalized = normalizeAdminAccounts(saved);
    if (normalized.length) {
      memoryAdminAccounts = normalized;
      return normalized;
    }
  }

  return memoryAdminAccounts || [];
}

async function saveAdminAccounts(storage, accounts) {
  const normalized = normalizeAdminAccounts({ accounts }).map(account => ({
    ...account,
    updated_at: new Date().toISOString(),
  }));
  memoryAdminAccounts = normalized;
  if (storage) {
    await storage.put(ADMIN_ACCOUNT_KEY, {
      accounts: normalized,
      updated_at: new Date().toISOString(),
    });
  }
  return normalized;
}

async function upsertAdminAccount(storage, existingAccounts, account) {
  const normalized = normalizeAdminAccount({
    ...account,
    updated_at: new Date().toISOString(),
  });
  if (!normalized) return null;

  const nextAccounts = existingAccounts.filter(item => item.phone !== normalized.phone);
  nextAccounts.push(normalized);
  await saveAdminAccounts(storage, nextAccounts);
  return normalized;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json();
  }

  const text = await request.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

function publicPricePayload(price) {
  return {
    sale_price: Number(price.sale_price).toFixed(2),
    buyback_price: Number(price.buyback_price).toFixed(2),
    update_time: price.update_time,
  };
}

function adminPage(requestUrl = '') {
  const url = requestUrl ? new URL(requestUrl) : null;
  const previewToken = url ? url.searchParams.get('eo_token') || '' : '';
  const previewTime = url ? url.searchParams.get('eo_time') || '' : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\u91d1\u4ef7\u540e\u53f0</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #0f1117;
    color: #e8e8ed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  }
  main {
    width: min(92vw, 500px);
    padding: 28px;
    border: 1px solid rgba(212, 165, 55, 0.34);
    border-radius: 12px;
    background: #1a1d2e;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  }
  h1 { margin: 0 0 18px; color: #f0d060; font-size: 24px; }
  .back-home-link {
    position: fixed;
    top: 18px;
    left: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 10px 14px;
    border: 1px solid rgba(212, 165, 55, 0.42);
    border-radius: 999px;
    background: rgba(26, 29, 46, 0.86);
    color: #f0d060;
    font-size: 14px;
    font-weight: 800;
    line-height: 1;
    text-decoration: none;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  }
  .back-home-link:hover {
    background: rgba(212, 165, 55, 0.16);
    border-color: #d4a537;
  }
  form[hidden], .admin-only[hidden], .account-table[hidden] { display: none; }
  label { display: block; margin: 14px 0 6px; color: #b8b8c8; font-size: 14px; }
  input {
    width: 100%;
    padding: 13px 14px;
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    background: #111522;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
  }
  button.submit {
    width: 100%;
    margin-top: 20px;
    padding: 13px 16px;
    border: 0;
    border-radius: 8px;
    background: #d4a537;
    color: #111;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
  }
  .divider { height: 1px; margin: 22px 0 6px; background: rgba(212, 165, 55, 0.18); }
  .account-table { margin-top: 22px; overflow: hidden; border: 1px solid rgba(212, 165, 55, 0.18); border-radius: 10px; }
  .account-table h2 { margin: 0; padding: 12px 14px; color: #f0d060; font-size: 16px; background: rgba(17, 21, 34, 0.72); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 12px; border-top: 1px solid rgba(212, 165, 55, 0.12); text-align: left; vertical-align: top; }
  th { color: #f0d060; font-weight: 800; background: rgba(17, 21, 34, 0.5); }
  td { color: #e8e8ed; }
  .status { min-height: 22px; margin-top: 14px; color: #f0d060; font-size: 14px; }
  .status:empty { display: none; }
  .muted { margin-top: 14px; color: #8f94a8; font-size: 13px; line-height: 1.6; }
</style>
</head>
<body>
<a class="back-home-link" href="/">\u8fd4\u56de\u91d1\u4ef7\u9875\u9762</a>
<main>
  <h1>\u91d1\u4ef7\u540e\u53f0</h1>
  <form id="login-form">
    <label for="login-phone">\u624b\u673a\u53f7</label>
    <input id="login-phone" name="phone" inputmode="numeric" autocomplete="username" required>
    <label for="login-password">\u5bc6\u7801</label>
    <input id="login-password" name="password" type="password" autocomplete="current-password" required>
    <button class="submit" type="submit">\u767b\u5f55\u540e\u53f0</button>
  </form>
  <form id="login-price-form" hidden>
    <div class="muted">\u5df2\u767b\u5f55\uff0c\u53ef\u4fee\u6539\u5f53\u524d\u91d1\u4ef7\u3002</div>
    <label for="sale-price">\u4eca\u65e5\u91d1\u4ef7\uff08\u5143/\u514b\uff09</label>
    <input id="sale-price" name="sale_price" inputmode="decimal" required>
    <label for="buyback-price">\u56de\u8d2d\u91d1\u4ef7\uff08\u5143/\u514b\uff09</label>
    <input id="buyback-price" name="buyback_price" inputmode="decimal" required>
    <button class="submit" type="submit">\u4fdd\u5b58\u91d1\u4ef7</button>
  </form>
  <section class="account-table" id="account-table" hidden>
    <h2>\u5f53\u524d\u8d26\u53f7</h2>
    <table>
      <thead>
        <tr>
          <th>\u8d26\u53f7</th>
          <th>\u804c\u4f4d</th>
          <th>\u6743\u9650</th>
        </tr>
      </thead>
      <tbody id="account-table-body"></tbody>
    </table>
  </section>
  <form class="admin-only" id="grant-form" hidden>
    <div class="divider"></div>
    <div class="muted">\u6700\u9ad8\u6743\u9650\u8d26\u53f7\u53ef\u7ed9\u5176\u4ed6\u624b\u673a\u53f7\u8bbe\u7f6e\u767b\u5f55\u548c\u4fee\u6539\u91d1\u4ef7\u6743\u9650\u3002</div>
    <label for="grant-phone">\u6388\u6743\u624b\u673a\u53f7</label>
    <input id="grant-phone" name="phone" inputmode="numeric" autocomplete="off" required>
    <label for="grant-password">\u8bbe\u7f6e\u5bc6\u7801\uff08\u81f3\u5c11 6 \u4f4d\uff09</label>
    <input id="grant-password" name="password" type="password" autocomplete="new-password" required>
    <button class="submit" type="submit">\u8bbe\u7f6e\u624b\u673a\u53f7\u6743\u9650</button>
  </form>
  <div class="status" id="status"></div>
  <div class="muted" id="account-status"></div>
</main>
<script>
const statusEl = document.getElementById('status');
const accountStatusEl = document.getElementById('account-status');
const loginForm = document.getElementById('login-form');
const priceForm = document.getElementById('login-price-form');
const grantForm = document.getElementById('grant-form');
const accountTable = document.getElementById('account-table');
const accountTableBody = document.getElementById('account-table-body');
const saleInput = document.getElementById('sale-price');
const buybackInput = document.getElementById('buyback-price');
const edgeOnePreviewToken = ${JSON.stringify(previewToken)};
const edgeOnePreviewTime = ${JSON.stringify(previewTime)};
let loggedInPhone = '';
let loggedInPassword = '';

function setStatus(text) {
  statusEl.textContent = text;
}

function apiPath(path) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('eo_token') || edgeOnePreviewToken;
  const time = params.get('eo_time') || edgeOnePreviewTime;
  if (!token || !time) return path;
  return path + '?eo_token=' + encodeURIComponent(token) + '&eo_time=' + encodeURIComponent(time);
}

async function requestJson(path, options) {
  const response = await fetch(apiPath(path), options);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(response.status === 401 ? '\u4e34\u65f6\u94fe\u63a5\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u6700\u65b0\u540e\u53f0\u94fe\u63a5' : '\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38');
  }
}

function showLoggedIn(json) {
  loginForm.hidden = true;
  priceForm.hidden = false;
  grantForm.hidden = !json.can_manage_users;
  renderAccountRows(json);
  accountStatusEl.textContent = json.can_manage_users
    ? '\u5df2\u767b\u5f55\u6700\u9ad8\u6743\u9650\u8d26\u53f7\uff1a' + json.admin_phone
    : '\u5df2\u767b\u5f55\u6388\u6743\u8d26\u53f7\uff1a' + json.admin_phone;
}

function roleText(role) {
  return role === 'super' ? '\u5e97\u957f' : '\u7ba1\u7406\u5458';
}

function permissionText(role) {
  return role === 'super'
    ? '\u4fee\u6539\u91d1\u4ef7\u3001\u7ba1\u7406\u8d26\u53f7'
    : '\u4fee\u6539\u91d1\u4ef7';
}

function renderAccountRows(json) {
  const accounts = Array.isArray(json.authorized_phones) ? json.authorized_phones : [];
  const sortedAccounts = accounts.slice().sort((left, right) => {
    if (left.role === right.role) return left.phone.localeCompare(right.phone);
    return left.role === 'super' ? -1 : 1;
  });
  accountTableBody.innerHTML = sortedAccounts.map(account => (
    '<tr><td>' + account.phone + '</td><td>' + roleText(account.role) + '</td><td>' + permissionText(account.role) + '</td></tr>'
  )).join('');
  accountTable.hidden = sortedAccounts.length === 0;
}

async function loadPrice() {
  const json = await requestJson('/gold-api/admin/price');
  if (json.code !== 1) throw new Error(json.message || '\u8bfb\u53d6\u5931\u8d25');
  saleInput.value = json.data.sale_price;
  buybackInput.value = json.data.buyback_price;
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('\u6b63\u5728\u767b\u5f55...');
  const phone = document.getElementById('login-phone').value;
  const password = document.getElementById('login-password').value;
  try {
    const json = await requestJson('/gold-api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    if (json.code !== 1) {
      setStatus(json.message || '\u767b\u5f55\u5931\u8d25');
      return;
    }
    loggedInPhone = phone;
    loggedInPassword = password;
    saleInput.value = json.data.sale_price;
    buybackInput.value = json.data.buyback_price;
    showLoggedIn(json);
    setStatus('\u767b\u5f55\u6210\u529f\uff0c\u5f53\u524d\u66f4\u65b0\u65f6\u95f4\uff1a' + json.data.update_time);
  } catch (error) {
    setStatus(error.message || '\u767b\u5f55\u5931\u8d25');
  }
});

document.getElementById('login-price-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('\u6b63\u5728\u4fdd\u5b58...');
  try {
    const json = await requestJson('/gold-api/admin/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: loggedInPhone,
        password: loggedInPassword,
        sale_price: saleInput.value,
        buyback_price: buybackInput.value,
      }),
    });
    if (json.code !== 1) {
      setStatus(json.message || '\u4fdd\u5b58\u5931\u8d25');
      return;
    }
    saleInput.value = json.data.sale_price;
    buybackInput.value = json.data.buyback_price;
    setStatus('\u5df2\u4fdd\u5b58\uff1a' + json.data.update_time);
  } catch (error) {
    setStatus(error.message || '\u4fdd\u5b58\u5931\u8d25');
  }
});

document.getElementById('grant-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('\u6b63\u5728\u8bbe\u7f6e\u624b\u673a\u53f7\u6743\u9650...');
  try {
    const json = await requestJson('/gold-api/admin/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_phone: loggedInPhone,
        admin_password: loggedInPassword,
        phone: document.getElementById('grant-phone').value,
        password: document.getElementById('grant-password').value,
      }),
    });
    if (json.code !== 1) {
      setStatus(json.message || '\u8bbe\u7f6e\u5931\u8d25');
      return;
    }
    document.getElementById('grant-phone').value = '';
    document.getElementById('grant-password').value = '';
    renderAccountRows(json);
    setStatus('\u5df2\u6388\u6743\u624b\u673a\u53f7\uff1a' + json.data.phone);
  } catch (error) {
    setStatus(error.message || '\u8bbe\u7f6e\u5931\u8d25');
  }
});

loadPrice().catch(error => setStatus(error.message || '\u8bfb\u53d6\u5931\u8d25'));
</script>
</body>
</html>`;
}
function adminAccountsPayload(accounts, activeAccount = null) {
  const superAccount = accounts.find(account => account.role === 'super' || account.phone === SUPER_ADMIN_PHONE);
  return {
    admin_bound: accounts.length > 0,
    admin_phone: activeAccount ? activeAccount.phone : (superAccount ? superAccount.phone : null),
    role: activeAccount ? activeAccount.role : null,
    can_manage_users: Boolean(activeAccount && activeAccount.role === 'super'),
    authorized_phones: accounts.map(account => ({
      phone: account.phone,
      role: account.role,
    })),
  };
}

function findAuthorizedAccount(accounts, phone, password) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedPassword = String(password || '');
  return accounts.find(account => account.phone === normalizedPhone && account.password === normalizedPassword) || null;
}

function requireAuthorizedAccount(accounts, body) {
  if (!accounts.length) return { error: '\u8bf7\u5148\u7528\u6700\u9ad8\u6743\u9650\u624b\u673a\u53f7\u767b\u5f55\u5e76\u8bbe\u7f6e\u5bc6\u7801' };
  const account = findAuthorizedAccount(accounts, body.phone, body.password);
  if (!account) return { error: '\u8bf7\u5148\u7528\u6700\u9ad8\u6743\u9650\u624b\u673a\u53f7\u767b\u5f55\u5e76\u8bbe\u7f6e\u5bc6\u7801' };
  return { account };
}

function requireSuperAdminAccount(accounts, body) {
  const account = findAuthorizedAccount(accounts, body.admin_phone || body.phone, body.admin_password || body.password);
  if (!account || account.role !== 'super') {
    return { error: '\u624b\u673a\u53f7\u6216\u5bc6\u7801\u4e0d\u6b63\u786e' };
  }
  return { account };
}

export async function handleApiRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const now = dependencies.now ? dependencies.now() : new Date();
  const storage = createStorage(dependencies);

  try {
    if (url.pathname === '/gold-api/health' || url.pathname === '/api/health') {
      const price = await loadFixedPrice(storage, dependencies, now);
      const accounts = await loadAdminAccounts(storage);
      return json({
        status: 'ok',
        runtime: 'edgeone-edge-functions',
        mode: 'fixed-price',
        current_price: publicPricePayload(price),
        ...adminAccountsPayload(accounts),
        kv: storage && storage.type === 'kv' ? 'enabled' : 'disabled',
        storage: storage ? storage.type : 'memory',
        kv_key: FIXED_PRICE_KEY,
        admin_key: ADMIN_ACCOUNT_KEY,
        kv_debug: url.searchParams.get('debug') === 'kv' ? getKvDebug(dependencies) : undefined,
        server_time: formatBeijingDateTime(now),
      });
    }

    if (url.pathname === '/gold-api/gold/current' || url.pathname === '/api/gold/current') {
      const price = await loadFixedPrice(storage, dependencies, now);
      return json({ code: 1, data: publicPricePayload(price) });
    }

    if (url.pathname === '/gold-api/gold/history' || url.pathname === '/api/gold/history') {
      const price = await loadFixedPrice(storage, dependencies, now);
      return json({
        code: 1,
        data: [{
          ...publicPricePayload(price),
          time: price.update_time,
          timestamp: now.getTime(),
        }],
      });
    }

    if (url.pathname === '/gold-api/admin') {
      return html(adminPage(request.url));
    }

    if (url.pathname === '/gold-api/admin/login') {
      if (request.method !== 'POST' && request.method !== 'PUT') {
        return json({ code: 0, message: 'Method not allowed' }, 405);
      }

      const body = await readBody(request);
      let accounts = await loadAdminAccounts(storage);
      let activeAccount = findAuthorizedAccount(accounts, body.phone, body.password);

      if (!activeAccount && String(body.phone || '').trim() === SUPER_ADMIN_PHONE && isValidPassword(body.password)) {
        activeAccount = await upsertAdminAccount(storage, accounts, {
          phone: SUPER_ADMIN_PHONE,
          password: String(body.password),
          role: 'super',
        });
        accounts = await loadAdminAccounts(storage);
      }

      if (!activeAccount) {
        return json({ code: 0, message: '\u624b\u673a\u53f7\u6216\u5bc6\u7801\u4e0d\u6b63\u786e' }, 401);
      }

      const price = await loadFixedPrice(storage, dependencies, now);
      return json({
        code: 1,
        data: publicPricePayload(price),
        ...adminAccountsPayload(accounts, activeAccount),
      });
    }

    if (url.pathname === '/gold-api/admin/price') {
      const accounts = await loadAdminAccounts(storage);

      if (request.method === 'GET') {
        const price = await loadFixedPrice(storage, dependencies, now);
        return json({
          code: 1,
          data: publicPricePayload(price),
          ...adminAccountsPayload(accounts),
        });
      }

      if (request.method === 'POST' || request.method === 'PUT') {
        const body = await readBody(request);
        const auth = requireAuthorizedAccount(accounts, body);
        if (auth.error) return json({ code: 0, message: auth.error }, 401);

        const price = normalizePrice({
          sale_price: body.sale_price,
          buyback_price: body.buyback_price,
          update_time: formatBeijingDateTime(now),
          updated_by: auth.account.phone,
        }, now);

        if (!price) {
          return json({ code: 0, message: '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u4eca\u65e5\u91d1\u4ef7\u548c\u56de\u8d2d\u91d1\u4ef7' }, 400);
        }

        await saveFixedPrice(storage, price);
        return json({ code: 1, data: publicPricePayload(price) });
      }

      return json({ code: 0, message: 'Method not allowed' }, 405);
    }

    if (url.pathname === '/gold-api/admin/bind') {
      if (request.method !== 'POST' && request.method !== 'PUT') {
        return json({ code: 0, message: 'Method not allowed' }, 405);
      }

      const body = await readBody(request);
      const accounts = await loadAdminAccounts(storage);
      const superAuth = requireSuperAdminAccount(accounts, body);
      if (superAuth.error) return json({ code: 0, message: superAuth.error }, 401);

      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');

      if (!isValidPhone(phone)) {
        return json({ code: 0, message: '\u8bf7\u8f93\u5165\u6709\u6548\u624b\u673a\u53f7' }, 400);
      }
      if (!isValidPassword(password)) {
        return json({ code: 0, message: '\u5bc6\u7801\u81f3\u5c11 6 \u4f4d' }, 400);
      }
      if (phone === SUPER_ADMIN_PHONE) {
        return json({ code: 0, message: '\u6700\u9ad8\u6743\u9650\u8d26\u53f7\u4e0d\u9700\u8981\u91cd\u590d\u6388\u6743' }, 400);
      }

      const account = await upsertAdminAccount(storage, accounts, { phone, password, role: 'editor' });
      const nextAccounts = await loadAdminAccounts(storage);
      return json({
        code: 1,
        data: { phone: account.phone, role: account.role },
        ...adminAccountsPayload(nextAccounts, superAuth.account),
      });
    }

    return json({ code: 0, message: 'Not found' }, 404);
  } catch (error) {
    return json({
      code: 0,
      message: '暂时无法处理金价请求',
      detail: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}

export async function onRequest(context) {
  return handleApiRequest(context.request, { env: context.env });
}

export default onRequest;
