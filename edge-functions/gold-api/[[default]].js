import { getStore as getBlobSdkStore } from '@edgeone/pages-blob';

const FIXED_PRICE_KEY = 'zhengji_gold_fixed_current';
const ADMIN_ACCOUNT_KEY = 'zhengji_gold_admin_account';
const DEFAULT_SALE_PRICE = 1130;
const DEFAULT_BUYBACK_PRICE = 1026.5;

let memoryPrice = null;
let memoryAdminAccount = null;

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

  return {
    phone: String(raw.phone).trim(),
    password: String(raw.password),
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
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

async function loadAdminAccount(storage) {
  if (storage) {
    const saved = await storage.get(ADMIN_ACCOUNT_KEY);
    const normalized = normalizeAdminAccount(saved);
    if (normalized) {
      memoryAdminAccount = normalized;
      return normalized;
    }
  }

  return memoryAdminAccount;
}

async function saveAdminAccount(storage, account) {
  const normalized = normalizeAdminAccount({
    ...account,
    updated_at: new Date().toISOString(),
  });
  if (!normalized) return null;

  memoryAdminAccount = normalized;
  if (storage) await storage.put(ADMIN_ACCOUNT_KEY, normalized);
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

function adminPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>西部郑记金价后台</title>
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
    width: min(92vw, 480px);
    padding: 28px;
    border: 1px solid rgba(212, 165, 55, 0.34);
    border-radius: 12px;
    background: #1a1d2e;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  }
  h1 { margin: 0 0 18px; color: #f0d060; font-size: 24px; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
  .tab {
    border: 1px solid #2a2d3e;
    border-radius: 8px;
    background: #111522;
    color: #b8b8c8;
    padding: 10px;
    font-weight: 800;
    cursor: pointer;
  }
  .tab.active { background: #d4a537; color: #111; border-color: #d4a537; }
  section { display: none; }
  section.active { display: block; }
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
  .status { min-height: 22px; margin-top: 14px; color: #f0d060; font-size: 14px; }
  .muted { margin-top: 14px; color: #8f94a8; font-size: 13px; line-height: 1.6; }
</style>
</head>
<body>
<main>
  <h1>西部郑记金价后台</h1>
  <div class="tabs">
    <button class="tab active" type="button" data-tab="login">登录修改</button>
    <button class="tab" type="button" data-tab="bind">绑定手机</button>
  </div>

  <section class="active" id="panel-login">
    <form id="login-form">
      <label for="login-phone">???</label>
      <input id="login-phone" name="phone" inputmode="numeric" autocomplete="username" required>
      <label for="login-password">??</label>
      <input id="login-password" name="password" type="password" autocomplete="current-password" required>
      <button class="submit" type="submit">????</button>
    </form>
    <form id="login-price-form" hidden>
      <div class="muted">????????????</div>
      <label for="sale-price">??????/??</label>
      <input id="sale-price" name="sale_price" inputmode="decimal" required>
      <label for="buyback-price">??????/??</label>
      <input id="buyback-price" name="buyback_price" inputmode="decimal" required>
      <button class="submit" type="submit">????</button>
    </form>
  </section>

  <section id="panel-bind">
    <form id="bind-form">
      <label for="bind-phone">绑定手机号</label>
      <input id="bind-phone" name="phone" inputmode="numeric" autocomplete="username" required>
      <label for="bind-password">设置密码（至少 6 位）</label>
      <input id="bind-password" name="password" type="password" autocomplete="new-password" required>
      <button class="submit" type="submit">绑定并设置密码</button>
    </form>
    <div class="muted">首次使用请先绑定手机号。以后修改金价需要输入手机号和密码。</div>
  </section>

  <div class="status" id="status">正在读取当前金价...</div>
  <div class="muted" id="account-status"></div>
</main>
<script>
const statusEl = document.getElementById('status');
const accountStatusEl = document.getElementById('account-status');
const loginForm = document.getElementById('login-form');
const priceForm = document.getElementById('login-price-form');
const saleInput = document.getElementById('sale-price');
const buybackInput = document.getElementById('buyback-price');
let loggedInPhone = '';
let loggedInPassword = '';

function setStatus(text) { statusEl.textContent = text; }
function showPriceForm() {
  loginForm.hidden = true;
  priceForm.hidden = false;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('section').forEach(panel => panel.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

async function loadPrice() {
  const response = await fetch('/gold-api/admin/price');
  const json = await response.json();
  if (json.code !== 1) throw new Error(json.message || '????');
  saleInput.value = json.data.sale_price;
  buybackInput.value = json.data.buyback_price;
  accountStatusEl.textContent = json.admin_bound ? '???????' + json.admin_phone : '????????????';
  setStatus(json.admin_bound ? '?????????????' : '???????????');
}

document.getElementById('bind-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('正在绑定...');
  const response = await fetch('/gold-api/admin/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: document.getElementById('bind-phone').value,
      password: document.getElementById('bind-password').value,
    }),
  });
  const json = await response.json();
  if (json.code !== 1) {
    setStatus(json.message || '绑定失败');
    return;
  }
  document.getElementById('login-phone').value = json.data.phone;
  accountStatusEl.textContent = '已绑定手机号：' + json.data.phone;
  setStatus('绑定成功，请用手机号和密码保存金价');
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('????...');
  const phone = document.getElementById('login-phone').value;
  const password = document.getElementById('login-password').value;
  const response = await fetch('/gold-api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const json = await response.json();
  if (json.code !== 1) {
    setStatus(json.message || '????');
    return;
  }
  loggedInPhone = phone;
  loggedInPassword = password;
  saleInput.value = json.data.sale_price;
  buybackInput.value = json.data.buyback_price;
  showPriceForm();
  accountStatusEl.textContent = '???????' + json.admin_phone;
  setStatus('????????????' + json.data.update_time);
});

document.getElementById('login-price-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('????...');
  const response = await fetch('/gold-api/admin/price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: loggedInPhone,
      password: loggedInPassword,
      sale_price: saleInput.value,
      buyback_price: buybackInput.value,
    }),
  });
loadPrice().catch(error => setStatus(error.message || '读取失败'));
</script>
</body>
</html>`;
}

function accountStatusPayload(account) {
  return {
    admin_bound: Boolean(account),
    admin_phone: account ? account.phone : null,
  };
}

function requireAccountMatch(account, body) {
  if (!account) {
    return '请先绑定手机号并设置密码';
  }
  if (String(body.phone || '').trim() !== account.phone || String(body.password || '') !== account.password) {
    return '手机号或密码不正确';
  }
  return '';
}

export async function handleApiRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const now = dependencies.now ? dependencies.now() : new Date();
  const storage = createStorage(dependencies);

  try {
    if (url.pathname === '/gold-api/health' || url.pathname === '/api/health') {
      const price = await loadFixedPrice(storage, dependencies, now);
      const account = await loadAdminAccount(storage);
      return json({
        status: 'ok',
        runtime: 'edgeone-edge-functions',
        mode: 'fixed-price',
        current_price: publicPricePayload(price),
        ...accountStatusPayload(account),
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
      return html(adminPage());
    }

    if (url.pathname === '/gold-api/admin/login') {
      if (request.method !== 'POST' && request.method !== 'PUT') {
        return json({ code: 0, message: 'Method not allowed' }, 405);
      }

      const account = await loadAdminAccount(storage);
      const body = await readBody(request);
      const authError = requireAccountMatch(account, body);
      if (authError) return json({ code: 0, message: authError }, 401);

      const price = await loadFixedPrice(storage, dependencies, now);
      return json({
        code: 1,
        data: publicPricePayload(price),
        ...accountStatusPayload(account),
      });
    }

    if (url.pathname === '/gold-api/admin/price') {
      const account = await loadAdminAccount(storage);

      if (request.method === 'GET') {
        const price = await loadFixedPrice(storage, dependencies, now);
        return json({
          code: 1,
          data: publicPricePayload(price),
          ...accountStatusPayload(account),
        });
      }

      if (request.method === 'POST' || request.method === 'PUT') {
        const body = await readBody(request);
        const authError = requireAccountMatch(account, body);
        if (authError) return json({ code: 0, message: authError }, 401);

        const price = normalizePrice({
          sale_price: body.sale_price,
          buyback_price: body.buyback_price,
          update_time: formatBeijingDateTime(now),
          updated_by: account.phone,
        }, now);

        if (!price) {
          return json({ code: 0, message: '请输入有效的今日金价和回购金价' }, 400);
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
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '');

      if (!isValidPhone(phone)) {
        return json({ code: 0, message: '请输入有效手机号' }, 400);
      }
      if (!isValidPassword(password)) {
        return json({ code: 0, message: '密码至少 6 位' }, 400);
      }

      const account = await saveAdminAccount(storage, { phone, password });
      return json({ code: 1, data: { phone: account.phone } });
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
