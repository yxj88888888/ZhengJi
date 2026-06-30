const FIXED_PRICE_KEY = 'zhengji_gold_fixed_current';
const DEFAULT_SALE_PRICE = 1130;
const DEFAULT_BUYBACK_PRICE = 1026.5;
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'zhengji2026';

let memoryPrice = null;

function getKvStore(dependencies = {}) {
  if (dependencies.kv) return dependencies.kv;
  if (dependencies.env && dependencies.env.ZHENGJI_GOLD_KV) return dependencies.env.ZHENGJI_GOLD_KV;
  if (typeof ZHENGJI_GOLD_KV !== 'undefined') return ZHENGJI_GOLD_KV;
  if (globalThis.ZHENGJI_GOLD_KV) return globalThis.ZHENGJI_GOLD_KV;
  return null;
}

function getKvDebug(dependencies = {}) {
  const env = dependencies.env || {};
  return {
    env_keys: Object.keys(env).filter(key => /kv|gold|zhengji/i.test(key)),
    env_zhengji_gold_kv: Boolean(env.ZHENGJI_GOLD_KV),
    bare_zhengji_gold_kv: typeof ZHENGJI_GOLD_KV !== 'undefined',
    global_zhengji_gold_kv: Boolean(globalThis.ZHENGJI_GOLD_KV),
  };
}

function getEnvValue(dependencies, key, fallback) {
  const env = dependencies.env || {};
  return env[key] || dependencies[key] || fallback;
}

function getAdminCredentials(dependencies = {}) {
  return {
    user: String(getEnvValue(dependencies, 'ZHENGJI_ADMIN_USER', DEFAULT_ADMIN_USER)),
    password: String(getEnvValue(dependencies, 'ZHENGJI_ADMIN_PASSWORD', DEFAULT_ADMIN_PASSWORD)),
  };
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

async function loadFixedPrice(kv, dependencies, now) {
  if (kv) {
    const saved = await kv.get(FIXED_PRICE_KEY, { type: 'json' });
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

async function saveFixedPrice(kv, price) {
  memoryPrice = price;
  if (kv) {
    await kv.put(FIXED_PRICE_KEY, JSON.stringify({
      ...price,
      saved_at: new Date().toISOString(),
    }));
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function unauthorized() {
  return html('需要账号密码', 401, {
    'WWW-Authenticate': 'Basic realm="ZhengJi Gold Admin", charset="UTF-8"',
  });
}

function decodeBase64(value) {
  if (typeof atob === 'function') return atob(value);
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf8');
  return '';
}

function isAuthorized(request, dependencies = {}) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = decodeBase64(header.slice(6));
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  const expected = getAdminCredentials(dependencies);

  return user === expected.user && password === expected.password;
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
<title>西部郑记金价修改</title>
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
    width: min(92vw, 460px);
    padding: 28px;
    border: 1px solid rgba(212, 165, 55, 0.34);
    border-radius: 12px;
    background: #1a1d2e;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
  }
  h1 { margin: 0 0 18px; color: #f0d060; font-size: 24px; }
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
  button {
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
  <h1>西部郑记金价修改</h1>
  <form id="price-form">
    <label for="sale-price">今日金价（元/克）</label>
    <input id="sale-price" name="sale_price" inputmode="decimal" required>
    <label for="buyback-price">回购金价（元/克）</label>
    <input id="buyback-price" name="buyback_price" inputmode="decimal" required>
    <button type="submit">保存金价</button>
  </form>
  <div class="status" id="status">正在读取当前金价...</div>
  <div class="muted">保存后，首页固定金价会在几秒内刷新。</div>
</main>
<script>
const saleInput = document.getElementById('sale-price');
const buybackInput = document.getElementById('buyback-price');
const statusEl = document.getElementById('status');

function setStatus(text) {
  statusEl.textContent = text;
}

async function loadPrice() {
  const response = await fetch('/gold-api/admin/price', { credentials: 'same-origin' });
  const json = await response.json();
  if (json.code !== 1) throw new Error(json.message || '读取失败');
  saleInput.value = json.data.sale_price;
  buybackInput.value = json.data.buyback_price;
  setStatus('当前更新时间：' + json.data.update_time);
}

document.getElementById('price-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('正在保存...');
  const response = await fetch('/gold-api/admin/price', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sale_price: saleInput.value,
      buyback_price: buybackInput.value,
    }),
  });
  const json = await response.json();
  if (json.code !== 1) {
    setStatus(json.message || '保存失败');
    return;
  }
  saleInput.value = json.data.sale_price;
  buybackInput.value = json.data.buyback_price;
  setStatus('已保存：' + json.data.update_time);
});

loadPrice().catch(error => setStatus(error.message || '读取失败'));
</script>
</body>
</html>`;
}

export async function handleApiRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const now = dependencies.now ? dependencies.now() : new Date();
  const kv = getKvStore(dependencies);

  try {
    if (url.pathname === '/gold-api/health' || url.pathname === '/api/health') {
      const price = await loadFixedPrice(kv, dependencies, now);
      return json({
        status: 'ok',
        runtime: 'edgeone-edge-functions',
        mode: 'fixed-price',
        current_price: publicPricePayload(price),
        kv: kv ? 'enabled' : 'disabled',
        kv_key: FIXED_PRICE_KEY,
        kv_debug: url.searchParams.get('debug') === 'kv' ? getKvDebug(dependencies) : undefined,
        server_time: formatBeijingDateTime(now),
      });
    }

    if (url.pathname === '/gold-api/gold/current' || url.pathname === '/api/gold/current') {
      const price = await loadFixedPrice(kv, dependencies, now);
      return json({ code: 1, data: publicPricePayload(price) });
    }

    if (url.pathname === '/gold-api/gold/history' || url.pathname === '/api/gold/history') {
      const price = await loadFixedPrice(kv, dependencies, now);
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
      if (!isAuthorized(request, dependencies)) return unauthorized();
      return html(adminPage());
    }

    if (url.pathname === '/gold-api/admin/price') {
      if (!isAuthorized(request, dependencies)) return unauthorized();

      if (request.method === 'GET') {
        const price = await loadFixedPrice(kv, dependencies, now);
        return json({ code: 1, data: publicPricePayload(price) });
      }

      if (request.method === 'POST' || request.method === 'PUT') {
        const body = await readBody(request);
        const price = normalizePrice({
          sale_price: body.sale_price,
          buyback_price: body.buyback_price,
          update_time: formatBeijingDateTime(now),
          updated_by: 'admin',
        }, now);

        if (!price) {
          return json({ code: 0, message: '请输入有效的今日金价和回购金价' }, 400);
        }

        await saveFixedPrice(kv, price);
        return json({ code: 1, data: publicPricePayload(price) });
      }

      return json({ code: 0, message: 'Method not allowed' }, 405);
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
