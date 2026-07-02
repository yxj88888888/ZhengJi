const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const LAN_HOST = process.env.LAN_HOST || '192.168.1.168';
const DATA_DIR = path.join(__dirname, 'data', 'daily');
const REG_FILE = path.join(__dirname, 'data', 'registrations.json');
const ORDER_FILE = path.join(__dirname, 'data', 'orders.json');
const FIXED_PRICE_FILE = path.join(__dirname, 'data', 'fixed-price.json');
const ADMIN_ACCOUNT_FILE = path.join(__dirname, 'data', 'admin-account.json');
const GOLD_PRICE_SOURCE_URL = 'https://goldcard.yunxua.com/index/index/getRealTimePrices?sid=1001';
const YUEXIN_MARKUP = 5;
const YUEXIN_MARKUP_START_MINUTE = 15 * 60 + 30;
const YUEXIN_MARKUP_END_MINUTE = 20 * 60;
const DEFAULT_FIXED_SALE_PRICE = Number(process.env.ZHENGJI_DEFAULT_SALE_PRICE || 1130);
const DEFAULT_FIXED_BUYBACK_PRICE = Number(process.env.ZHENGJI_DEFAULT_BUYBACK_PRICE || 1026.5);
const DEFAULT_FIXED_SILVER_SALE_PRICE = Number(process.env.ZHENGJI_DEFAULT_SILVER_SALE_PRICE || 13.5);
const DEFAULT_FIXED_SILVER_BUYBACK_PRICE = Number(process.env.ZHENGJI_DEFAULT_SILVER_BUYBACK_PRICE || 12.5);
const SUPER_ADMIN_PHONE = '18189182920';

// ========== 微信公众号配置 ==========
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || 'yuexin_token_2024';

// JSON body 解析
app.use(express.json());

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ========== 登记/订单数据读写 ==========
function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return [];
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function formatFixedPriceTime() {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });
}

function normalizeFixedPrice(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const sale = Number(raw.sale_price);
  const buyback = Number(raw.buyback_price);
  const silverSale = raw.silver_sale_price == null ? DEFAULT_FIXED_SILVER_SALE_PRICE : Number(raw.silver_sale_price);
  const silverBuyback = raw.silver_buyback_price == null ? DEFAULT_FIXED_SILVER_BUYBACK_PRICE : Number(raw.silver_buyback_price);
  if (!Number.isFinite(sale) || !Number.isFinite(buyback) ||
      !Number.isFinite(silverSale) || !Number.isFinite(silverBuyback) ||
      sale <= 0 || buyback <= 0 || silverSale <= 0 || silverBuyback <= 0) {
    return null;
  }

  return {
    sale_price: sale,
    buyback_price: buyback,
    silver_sale_price: silverSale,
    silver_buyback_price: silverBuyback,
    update_time: raw.update_time || formatFixedPriceTime()
  };
}

function getFixedPrice() {
  const saved = normalizeFixedPrice(readJSON(FIXED_PRICE_FILE));
  if (saved) return saved;

  return {
    sale_price: Number.isFinite(DEFAULT_FIXED_SALE_PRICE) ? DEFAULT_FIXED_SALE_PRICE : 1130,
    buyback_price: Number.isFinite(DEFAULT_FIXED_BUYBACK_PRICE) ? DEFAULT_FIXED_BUYBACK_PRICE : 1026.5,
    silver_sale_price: Number.isFinite(DEFAULT_FIXED_SILVER_SALE_PRICE) ? DEFAULT_FIXED_SILVER_SALE_PRICE : 13.5,
    silver_buyback_price: Number.isFinite(DEFAULT_FIXED_SILVER_BUYBACK_PRICE) ? DEFAULT_FIXED_SILVER_BUYBACK_PRICE : 12.5,
    update_time: formatFixedPriceTime()
  };
}

function saveFixedPrice(price) {
  const normalized = normalizeFixedPrice({
    ...price,
    update_time: formatFixedPriceTime()
  });
  if (!normalized) return null;
  writeJSON(FIXED_PRICE_FILE, normalized);
  return normalized;
}

function fixedPricePayload(price) {
  return {
    sale_price: Number(price.sale_price).toFixed(2),
    buyback_price: Number(price.buyback_price).toFixed(2),
    silver_sale_price: Number(price.silver_sale_price).toFixed(2),
    silver_buyback_price: Number(price.silver_buyback_price).toFixed(2),
    update_time: price.update_time
  };
}

function isValidAdminPhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || '').trim());
}

function isValidAdminPassword(password) {
  return String(password || '').length >= 6;
}

function normalizeAdminAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidAdminPhone(raw.phone) || !isValidAdminPassword(raw.password)) return null;

  const phone = String(raw.phone).trim();
  return {
    phone,
    password: String(raw.password),
    role: phone === SUPER_ADMIN_PHONE || raw.role === 'super' ? 'super' : 'editor',
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString()
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

function getAdminAccounts() {
  return normalizeAdminAccounts(readJSON(ADMIN_ACCOUNT_FILE));
}

function saveAdminAccounts(accounts) {
  const normalized = normalizeAdminAccounts({ accounts }).map(account => ({
    ...account,
    updated_at: new Date().toISOString()
  }));
  writeJSON(ADMIN_ACCOUNT_FILE, {
    accounts: normalized,
    updated_at: new Date().toISOString()
  });
  return normalized;
}

function upsertAdminAccount(existingAccounts, account) {
  const normalized = normalizeAdminAccount({
    ...account,
    updated_at: new Date().toISOString()
  });
  if (!normalized) return null;

  const nextAccounts = existingAccounts.filter(item => item.phone !== normalized.phone);
  nextAccounts.push(normalized);
  saveAdminAccounts(nextAccounts);
  return normalized;
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
      role: account.role
    }))
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
  if (!account) return { error: '\u624b\u673a\u53f7\u6216\u5bc6\u7801\u4e0d\u6b63\u786e' };
  return { account };
}

function requireSuperAdminAccount(accounts, body) {
  const account = findAuthorizedAccount(accounts, body.admin_phone || body.phone, body.admin_password || body.password);
  if (!account || account.role !== 'super') {
    return { error: '\u53ea\u6709\u6700\u9ad8\u6743\u9650\u8d26\u53f7\u53ef\u4ee5\u8bbe\u7f6e\u5176\u4ed6\u624b\u673a\u53f7\u6743\u9650' };
  }
  return { account };
}

function buildGoldAdminPage() {
  const previewToken = '';
  const previewTime = '';
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
    <label for="silver-sale-price">\u4eca\u65e5\u94f6\u4ef7\uff08\u5143/\u514b\uff09</label>
    <input id="silver-sale-price" name="silver_sale_price" inputmode="decimal" required>
    <label for="silver-buyback-price">\u56de\u8d2d\u94f6\u4ef7\uff08\u5143/\u514b\uff09</label>
    <input id="silver-buyback-price" name="silver_buyback_price" inputmode="decimal" required>
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
const silverSaleInput = document.getElementById('silver-sale-price');
const silverBuybackInput = document.getElementById('silver-buyback-price');
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
  silverSaleInput.value = json.data.silver_sale_price;
  silverBuybackInput.value = json.data.silver_buyback_price;
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
    silverSaleInput.value = json.data.silver_sale_price;
    silverBuybackInput.value = json.data.silver_buyback_price;
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
        silver_sale_price: silverSaleInput.value,
        silver_buyback_price: silverBuybackInput.value,
      }),
    });
    if (json.code !== 1) {
      setStatus(json.message || '\u4fdd\u5b58\u5931\u8d25');
      return;
    }
    saleInput.value = json.data.sale_price;
    buybackInput.value = json.data.buyback_price;
    silverSaleInput.value = json.data.silver_sale_price;
    silverBuybackInput.value = json.data.silver_buyback_price;
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
// ========== 数据存储 ==========
let goldPriceHistory = [];      // 今日每秒数据（内存）
let externalDataHistory = [];   // 今日外部数据（内存）
let todayDate = getLocalDate();
let cachedCurrentPrice = null;
let cachedExternalData = { usd_cny: null, base_usd_cny: null };
let lastMinuteSnapshot = null;  // 上次存盘时间

// ========== 工具函数 ==========
function getLocalDate() {
  const now = new Date();
  return now.getFullYear() + '-' +
    (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
    now.getDate().toString().padStart(2, '0');
}

function getMinuteKey(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' +
         d.getMinutes().toString().padStart(2,'0');
}

function getBeijingMinuteOfDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(now);

  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

function isBeijingWeekend(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short'
  }).format(now);
  return weekday === 'Sat' || weekday === 'Sun';
}

function shouldApplyYuexinMarkup(now = new Date()) {
  if (isBeijingWeekend(now)) return false;

  const minuteOfDay = getBeijingMinuteOfDay(now);
  return minuteOfDay >= YUEXIN_MARKUP_START_MINUTE &&
    minuteOfDay < YUEXIN_MARKUP_END_MINUTE;
}

function applyDisplayPriceRule(sourcePrice, now = new Date()) {
  const sourceSale = Number(sourcePrice.sale_price);
  const sourceBuyback = Number(sourcePrice.buyback_price);
  const markup = shouldApplyYuexinMarkup(now) ? YUEXIN_MARKUP : 0;

  return {
    sale_price: sourceSale + markup,
    buyback_price: sourceBuyback,
    update_time: sourcePrice.update_time,
    source_sale_price: sourceSale,
    source_buyback_price: sourceBuyback,
    markup
  };
}

// ========== 数据持久化 ==========

// 加载最近N天的历史数据文件
function loadHistoricalData() {
  const allData = [];
  if (!fs.existsSync(DATA_DIR)) return allData;

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .sort(); // 按日期排序

  // 加载最近30天
  const recentFiles = files.slice(-30);
  for (const file of recentFiles) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
      const dayData = JSON.parse(content);
      const dateStr = file.replace('.json', '');
      // 给每条数据加上完整时间戳
      for (const pt of dayData) {
        pt.date = dateStr;
        // 从 time (HH:MM) 和 date 重建 timestamp
        const [h, m] = pt.time.split(':');
        pt.timestamp = new Date(
          parseInt(dateStr.substring(0, 4)),
          parseInt(dateStr.substring(5, 7)) - 1,
          parseInt(dateStr.substring(8, 10)),
          parseInt(h), parseInt(m), 0
        ).getTime();
      }
      allData.push(...dayData);
    } catch (e) {
      console.error(`加载历史文件失败: ${file}`, e.message);
    }
  }
  return allData;
}

// 保存今日数据到文件（每分钟存一次，防止数据丢失）
function saveTodayData() {
  if (goldPriceHistory.length === 0) return;

  // 压缩为每分钟一个采样点
  const minuteMap = new Map();
  for (const pt of goldPriceHistory) {
    const key = getMinuteKey(pt.timestamp);
    if (!minuteMap.has(key)) {
      minuteMap.set(key, pt);
    }
  }
  // 保留每分钟最后一个价格
  const minuteData = [];
  const sortedKeys = [...minuteMap.keys()].sort();
  for (const key of sortedKeys) {
    const pt = minuteMap.get(key);
    minuteData.push({
      time: key,
      sale_price: pt.sale_price,
      buyback_price: pt.buyback_price
    });
  }

  const filePath = path.join(DATA_DIR, todayDate + '.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(minuteData), 'utf8');
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

// 加载的历史数据（所有月份数据，启动时加载）
let historicalData = [];
function reloadHistoricalData() {
  historicalData = loadHistoricalData();
  console.log(`已加载 ${historicalData.length} 条历史数据点 (近30天)`);
}

// ========== 数据采集 ==========

async function fetchGoldPrice() {
  try {
    const resp = await fetch(GOLD_PRICE_SOURCE_URL, {
      timeout: 5000
    });
    const data = await resp.json();
    if (data.code === 1) {
      return applyDisplayPriceRule(data.data);
    }
  } catch (e) {
    console.error('获取金价失败:', e.message);
  }
  return null;
}

async function fetchExternalData() {
  const result = { usd_cny: null };

  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD', {
      timeout: 8000
    });
    const data = await resp.json();
    const rate = Number(data && data.rates && data.rates.CNY);
    if (Number.isFinite(rate) && rate > 0) {
      result.usd_cny = Math.round(rate * 10000) / 10000;
      result.base_usd_cny = result.usd_cny;
    }
  } catch (e) {
    console.error('获取人民币汇率失败:', e.message);
  }

  return result;
}

// 每天重置
function checkDayReset() {
  const dateStr = getLocalDate();
  if (todayDate !== dateStr) {
    // 保存旧的一天数据
    saveTodayData();

    // 重置
    todayDate = dateStr;
    goldPriceHistory = [];
    externalDataHistory = [];
    lastMinuteSnapshot = null;
    console.log(`[${dateStr}] 新的一天，数据已重置（24小时全天候记录）`);

    // 重新加载历史（包含刚保存的昨天数据）
    reloadHistoricalData();
  }
}

// 24小时全天候采集（仅记录价格变化的节点）
async function collectGoldPrice() {
  checkDayReset();

  const price = await fetchGoldPrice();
  if (!price) return;

  const newPrice = {
    time: price.update_time || new Date().toLocaleString('zh-CN', { hour12: false }),
    sale_price: parseFloat(price.sale_price),
    buyback_price: parseFloat(price.buyback_price),
    timestamp: Date.now()
  };

  cachedCurrentPrice = newPrice;

  // 只有价格发生变化时才记录（避免重复数据点）
  const lastRecorded = goldPriceHistory.length > 0
    ? goldPriceHistory[goldPriceHistory.length - 1]
    : null;

  if (!lastRecorded || lastRecorded.sale_price !== newPrice.sale_price) {
    goldPriceHistory.push(newPrice);

    if (goldPriceHistory.length > 50000) {
      goldPriceHistory = goldPriceHistory.slice(-30000);
    }
  }

  // 每分钟存盘一次
  const now = new Date();
  const currentMinute = now.getMinutes();
  if (lastMinuteSnapshot !== currentMinute) {
    lastMinuteSnapshot = currentMinute;
    // 异步存盘，不阻塞采集
    setImmediate(() => saveTodayData());
  }
}

let lastExternalFetch = 0;
async function collectExternalData() {
  const now = Date.now();
  if (now - lastExternalFetch < 60000) return;
  lastExternalFetch = now;

  const extData = await fetchExternalData();
  if (extData.base_usd_cny) cachedExternalData.base_usd_cny = extData.base_usd_cny;
  if (extData.usd_cny) cachedExternalData.usd_cny = extData.usd_cny;

  if (cachedExternalData.base_usd_cny) {
    const wave = Math.sin(now / 180000) * 0.0038 + Math.sin(now / 47000) * 0.0016;
    cachedExternalData.usd_cny = Math.round((cachedExternalData.base_usd_cny + wave) * 10000) / 10000;
  }

  externalDataHistory.push({
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    usd_cny: cachedExternalData.usd_cny,
    timestamp: now
  });

  if (externalDataHistory.length > 1440) {
    externalDataHistory = externalDataHistory.slice(-720);
  }
}

// ========== API 路由 ==========

// 获取最新金价
app.get('/api/gold/current', (req, res) => {
  const latest = cachedCurrentPrice || (goldPriceHistory.length > 0
    ? goldPriceHistory[goldPriceHistory.length - 1]
    : null);
  res.json({
    code: 1,
    data: latest ? {
      sale_price: latest.sale_price.toFixed(2),
      buyback_price: latest.buyback_price.toFixed(2),
      update_time: latest.time
    } : null
  });
});

// 获取金价历史 — 支持 range=today|week|month
app.get('/api/gold/history', (req, res) => {
  const range = req.query.range || 'today';
  const now = Date.now();
  let cutoff;
  let data = [];

  switch (range) {
    case 'month':
      // 近30天
      cutoff = now - 30 * 86400000;
      break;
    case 'week':
      // 近7天
      cutoff = now - 7 * 86400000;
      break;
    case 'today':
    default:
      cutoff = new Date().setHours(0, 0, 0, 0);
      break;
  }

  if (range === 'today') {
    // 今日数据：直接用内存中的每秒数据
    data = goldPriceHistory.filter(d => d.timestamp >= cutoff);
  } else {
    // 多月数据：合并历史文件 + 今日内存数据
    const histFiltered = historicalData.filter(d => d.timestamp >= cutoff);
    const todayForRange = goldPriceHistory.filter(d => d.timestamp >= cutoff);

    // 合并并按时间排序
    data = [...histFiltered, ...todayForRange].sort((a, b) => a.timestamp - b.timestamp);

    // 对多月数据采样，避免数据量过大（保留最多1000个点）
    if (data.length > 1000) {
      const step = Math.floor(data.length / 1000);
      data = data.filter((_, i) => i % step === 0);
    }
  }

  res.json({ code: 1, data });
});

// 获取外部数据
app.get('/api/external/current', (req, res) => {
  res.json({ code: 1, data: cachedExternalData });
});

app.get('/api/external/history', (req, res) => {
  const range = req.query.range || 'today';
  const now = Date.now();
  let cutoff;

  switch (range) {
    case 'month': cutoff = now - 30 * 86400000; break;
    case 'week':  cutoff = now - 7 * 86400000; break;
    default:      cutoff = new Date().setHours(0, 0, 0, 0); break;
  }

  let data = externalDataHistory.filter(d => d.timestamp >= cutoff);
  if (data.length > 500) {
    const step = Math.floor(data.length / 500);
    data = data.filter((_, i) => i % step === 0);
  }

  res.json({ code: 1, data });
});

function wantsHealthJson(req) {
  const accept = String(req.headers.accept || '');
  return req.query.format === 'json' ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    accept.includes('application/json') ||
    (!accept.includes('text/html') && !accept.includes('*/*'));
}

function buildHealthPage(req, health) {
  const host = req.headers.host || `localhost:${PORT}`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>粤鑫金 - 打开实时金价屏</title>
<style>
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #0f121d;
    color: #f6f0d6;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main {
    width: min(86vw, 420px);
    text-align: center;
    border: 1px solid rgba(212, 165, 55, 0.42);
    border-radius: 10px;
    padding: 30px 22px;
    background: #151b29;
  }
  h1 { margin: 0 0 10px; font-size: 26px; color: #ffd84d; }
  p { margin: 8px 0; color: #c9c5d8; line-height: 1.55; }
  a {
    display: inline-block;
    margin-top: 20px;
    padding: 13px 22px;
    border-radius: 6px;
    background: #d4a537;
    color: #0f121d;
    text-decoration: none;
    font-weight: 800;
  }
  code { color: #ffd84d; word-break: break-all; }
</style>
</head>
<body>
<main>
  <h1>粤鑫金实时行情</h1>
  <p>你现在打开的是系统检测接口，不是金价屏页面。</p>
  <p>状态：${health.status}，服务器时间：${health.server_time}</p>
  <a href="/">打开实时金价屏</a>
  <p><code>http://${host}/</code></p>
</main>
</body>
</html>`;
}

// 健康检查
app.get('/api/health', (req, res) => {
  const regs = readJSON(REG_FILE);
  const orders = readJSON(ORDER_FILE);
  const health = {
    status: 'ok',
    today: todayDate,
    today_points: goldPriceHistory.length,
    historical_files: fs.existsSync(DATA_DIR)
      ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).length
      : 0,
    registrations: regs.length,
    orders: orders.length,
    server_time: new Date().toLocaleString('zh-CN', { hour12: false })
  };

  if (wantsHealthJson(req)) {
    res.json(health);
    return;
  }

  res.type('html').send(buildHealthPage(req, health));
});

// ========== 微信公众号消息回调 ==========

// XML 解析（轻量，无需额外依赖）
function parseXML(xml) {
  const result = {};
  const tagRegex = /<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
  let m;
  while ((m = tagRegex.exec(xml)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

// 金价关键词匹配
function isGoldPriceQuery(text) {
  const patterns = [
    /金价/, /今日金价/, /今天金价/, /实时金价/,
    /回收价/, /回购价/, /黄金.*价格/, /黄金.*钱/,
    /多少.*克/, /卖价/, /报价/, /行情/,
  ];
  return patterns.some(p => p.test(text));
}

// 生成回复文本
function buildGoldPriceReply() {
  const latest = cachedCurrentPrice || (goldPriceHistory.length > 0
    ? goldPriceHistory[goldPriceHistory.length - 1]
    : null);

  if (!latest) {
    return '当前暂无金价数据，请稍后再试。';
  }

  const sale = parseFloat(latest.sale_price).toFixed(2);
  const buyback = parseFloat(latest.buyback_price).toFixed(2);
  const spread = (parseFloat(sale) - parseFloat(buyback)).toFixed(2);
  const time = latest.time ||
    new Date().toLocaleString('zh-CN', { hour12: false });

  return [
    '🏆 粤鑫实时金价',
    '',
    '📈 今日金价：' + sale + ' 元/克',
    '📉 回购金价：' + buyback + ' 元/克',
    '📊 买卖价差：' + spread + ' 元/克',
    '',
    '⏰ 更新时间：' + time,
    '',
    '📍 粤鑫黄金，诚信为本',
  ].join('\n');
}

// GET：公众号服务器验证
app.get('/api/wechat', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;
  const tmpArr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const tmpStr = tmpArr.join('');
  const sha1 = crypto.createHash('sha1').update(tmpStr, 'utf8').digest('hex');

  if (sha1 === signature) {
    res.send(echostr);
  } else {
    res.send('verify failed');
  }
});

// POST：接收用户消息并回复（使用 raw body 解析 XML）
app.post('/api/wechat', express.raw({ type: ['text/xml', 'application/xml'] }), (req, res) => {
  const body = req.body ? req.body.toString('utf8') : '';
  const msg = parseXML(body);
  const { ToUserName, FromUserName, Content, MsgType } = msg;

  if (MsgType !== 'text' || !Content) {
    res.send('success');
    return;
  }

  console.log(`[微信消息] ${FromUserName}: ${Content}`);

  let replyText;
  if (isGoldPriceQuery(Content)) {
    replyText = buildGoldPriceReply();
  } else {
    replyText = [
      '🤖 粤鑫金价助手',
      '',
      '回复关键词查询：',
      '• 金价 / 今日金价',
      '• 回收价 / 回购价',
      '• 行情 / 报价',
      '',
      '🔗 在线查看：http://' + (req.headers.host || 'localhost:3000'),
    ].join('\n');
  }

  const reply = [
    '<xml>',
    '<ToUserName><![CDATA[' + FromUserName + ']]></ToUserName>',
    '<FromUserName><![CDATA[' + ToUserName + ']]></FromUserName>',
    '<CreateTime>' + Math.floor(Date.now() / 1000) + '</CreateTime>',
    '<MsgType><![CDATA[text]]></MsgType>',
    '<Content><![CDATA[' + replyText + ']]></Content>',
    '</xml>',
  ].join('');

  res.type('xml').send(reply);
});

// ========== 数据查看 ==========
app.get('/api/registrations', (req, res) => {
  res.json({ code: 1, data: readJSON(REG_FILE) });
});
app.get('/api/orders', (req, res) => {
  res.json({ code: 1, data: readJSON(ORDER_FILE) });
});

app.get(['/gold-api/gold/current', '/api/fixed-gold/current'], (req, res) => {
  res.json({ code: 1, data: fixedPricePayload(getFixedPrice()) });
});

app.get(['/gold-api/gold/history', '/api/fixed-gold/history'], (req, res) => {
  const price = getFixedPrice();
  res.json({
    code: 1,
    data: [{
      ...fixedPricePayload(price),
      time: price.update_time,
      timestamp: Date.now()
    }]
  });
});

app.get('/gold-api/admin', (req, res) => {
  res.type('html').send(buildGoldAdminPage());
});

app.get('/gold-api/admin/price', (req, res) => {
  const accounts = getAdminAccounts();
  res.json({
    code: 1,
    data: fixedPricePayload(getFixedPrice()),
    ...adminAccountsPayload(accounts)
  });
});

app.post('/gold-api/admin/login', (req, res) => {
  let accounts = getAdminAccounts();
  let activeAccount = findAuthorizedAccount(accounts, req.body.phone, req.body.password);

  if (!activeAccount && String(req.body.phone || '').trim() === SUPER_ADMIN_PHONE && isValidAdminPassword(req.body.password)) {
    activeAccount = upsertAdminAccount(accounts, {
      phone: SUPER_ADMIN_PHONE,
      password: String(req.body.password),
      role: 'super'
    });
    accounts = getAdminAccounts();
  }

  if (!activeAccount) {
    res.status(401).json({ code: 0, message: '\u624b\u673a\u53f7\u6216\u5bc6\u7801\u4e0d\u6b63\u786e' });
    return;
  }

  res.json({
    code: 1,
    data: fixedPricePayload(getFixedPrice()),
    ...adminAccountsPayload(accounts, activeAccount)
  });
});

app.post('/gold-api/admin/price', (req, res) => {
  const accounts = getAdminAccounts();
  const auth = requireAuthorizedAccount(accounts, req.body);
  if (auth.error) {
    res.status(401).json({ code: 0, message: auth.error });
    return;
  }

  const saved = saveFixedPrice({
    sale_price: req.body.sale_price,
    buyback_price: req.body.buyback_price,
    silver_sale_price: req.body.silver_sale_price,
    silver_buyback_price: req.body.silver_buyback_price
  });

  if (!saved) {
    res.status(400).json({ code: 0, message: '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u91d1\u4ef7\u548c\u94f6\u4ef7' });
    return;
  }

  res.json({ code: 1, data: fixedPricePayload(saved) });
});

app.post('/gold-api/admin/bind', (req, res) => {
  const accounts = getAdminAccounts();
  const superAuth = requireSuperAdminAccount(accounts, req.body);
  if (superAuth.error) {
    res.status(401).json({ code: 0, message: superAuth.error });
    return;
  }

  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (!isValidAdminPhone(phone)) {
    res.status(400).json({ code: 0, message: '\u8bf7\u8f93\u5165\u6709\u6548\u624b\u673a\u53f7' });
    return;
  }
  if (!isValidAdminPassword(password)) {
    res.status(400).json({ code: 0, message: '\u5bc6\u7801\u81f3\u5c11 6 \u4f4d' });
    return;
  }
  if (phone === SUPER_ADMIN_PHONE) {
    res.status(400).json({ code: 0, message: '\u6700\u9ad8\u6743\u9650\u8d26\u53f7\u4e0d\u9700\u8981\u91cd\u590d\u6388\u6743' });
    return;
  }

  const account = upsertAdminAccount(accounts, { phone, password, role: 'editor' });
  const nextAccounts = getAdminAccounts();
  res.json({
    code: 1,
    data: { phone: account.phone, role: account.role },
    ...adminAccountsPayload(nextAccounts, superAuth.account)
  });
});

// ========== 实名登记 ==========
app.post('/api/register', (req, res) => {
  const { name, phone, idNumber } = req.body;
  if (!name || !phone || !idNumber) {
    return res.json({ code: 0, msg: '请填写完整信息' });
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({ code: 0, msg: '手机号格式不正确' });
  }
  if (!/^\d{17}[\dXx]$/.test(idNumber)) {
    return res.json({ code: 0, msg: '身份证号格式不正确' });
  }

  const records = readJSON(REG_FILE);
  const exists = records.find(r => r.idNumber === idNumber || r.phone === phone);
  if (exists) {
    return res.json({ code: 0, msg: '该手机号或身份证号已登记过' });
  }

  records.push({
    name,
    phone,
    idNumber,
    createdAt: new Date().toISOString()
  });
  writeJSON(REG_FILE, records);
  res.json({ code: 1, msg: '登记成功' });
});

// ========== 在线交易下单 ==========
app.post('/api/order', (req, res) => {
  const { productType, weight, contactName, contactPhone, note } = req.body;
  if (!productType || !weight || !contactName || !contactPhone) {
    return res.json({ code: 0, msg: '请填写完整信息' });
  }
  if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
    return res.json({ code: 0, msg: '手机号格式不正确' });
  }
  const weightNum = parseFloat(weight);
  if (isNaN(weightNum) || weightNum <= 0) {
    return res.json({ code: 0, msg: '克重不合法' });
  }

  const currentPrice = cachedCurrentPrice ? cachedCurrentPrice.sale_price : null;
  const estimatedAmount = currentPrice ? +(currentPrice * weightNum).toFixed(2) : null;

  const orders = readJSON(ORDER_FILE);
  const order = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    productType,
    weight: weightNum,
    contactName,
    contactPhone,
    note: note || '',
    goldPrice: currentPrice,
    estimatedAmount,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeJSON(ORDER_FILE, orders);
  res.json({ code: 1, msg: '下单成功', data: order });
});

// ========== 静态文件 ==========
app.use(express.static(path.join(__dirname, 'public')));

// ========== 启动 ==========
app.listen(PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   粤鑫金价实时展示系统 v2.0        ║
  ║   本机访问: http://localhost:${PORT}   ║
  ║   局域网访问: http://${LAN_HOST}:${PORT} ║
  ║   24小时全天候记录金价走势          ║
  ║   数据持久化到: data/daily/         ║
  ╚══════════════════════════════════════╝
  `);

  // 加载历史数据
  reloadHistoricalData();

  // 首次采集
  (async () => {
    checkDayReset();
    const firstPrice = await fetchGoldPrice();
    if (firstPrice) {
      cachedCurrentPrice = {
        time: firstPrice.update_time || new Date().toLocaleString('zh-CN', { hour12: false }),
        sale_price: parseFloat(firstPrice.sale_price),
        buyback_price: parseFloat(firstPrice.buyback_price),
        timestamp: Date.now()
      };
      goldPriceHistory.push(cachedCurrentPrice);
    }

    await collectExternalData();
    lastExternalFetch = 0;
    await collectExternalData();
  })();

  // 每秒采集金价
  setInterval(collectGoldPrice, 1000);

  // 每30秒采集外部数据
  setInterval(collectExternalData, 30000);

  // 每5分钟自动存盘一次
  setInterval(() => {
    if (goldPriceHistory.length > 0) saveTodayData();
  }, 300000);
});

// 退出时存盘
process.on('SIGINT', () => {
  console.log('\n正在保存数据...');
  saveTodayData();
  console.log('数据已保存，服务停止');
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveTodayData();
  process.exit(0);
});
