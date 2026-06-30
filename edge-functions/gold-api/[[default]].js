const GOLD_PRICE_SOURCE_URL =
  'https://goldcard.yunxua.com/index/index/getRealTimePrices?sid=1001';
const ZHENGJI_MARKUP = 5;
const MARKUP_START_MINUTE = 15 * 60 + 30;
const MARKUP_END_MINUTE = 20 * 60;

let currentPrice = null;
let priceHistory = [];
let historyDate = '';
let stateLoadedDate = '';

function getStateKey(date) {
  return `zhengji_gold_${date.replace(/-/g, '')}`;
}

function getKvStore(dependencies = {}) {
  if (dependencies.kv) return dependencies.kv;
  if (dependencies.env && dependencies.env.ZHENGJI_GOLD_KV) return dependencies.env.ZHENGJI_GOLD_KV;
  if (typeof ZHENGJI_GOLD_KV !== 'undefined') return ZHENGJI_GOLD_KV;
  if (typeof zhengji_gold_prices !== 'undefined') return zhengji_gold_prices;
  if (typeof my_kv !== 'undefined') return my_kv;
  if (globalThis.ZHENGJI_GOLD_KV) return globalThis.ZHENGJI_GOLD_KV;
  if (globalThis.zhengji_gold_prices) return globalThis.zhengji_gold_prices;
  if (globalThis.my_kv) return globalThis.my_kv;
  return null;
}

function getKvDebug(dependencies = {}) {
  const env = dependencies.env || {};
  return {
    env_keys: Object.keys(env).filter(key => /kv|gold|yuexin/i.test(key)),
    env_zhengji_gold_kv: Boolean(env.ZHENGJI_GOLD_KV),
    bare_zhengji_gold_kv: typeof ZHENGJI_GOLD_KV !== 'undefined',
    bare_zhengji_gold_prices: typeof zhengji_gold_prices !== 'undefined',
    bare_my_kv: typeof my_kv !== 'undefined',
    global_zhengji_gold_kv: Boolean(globalThis.ZHENGJI_GOLD_KV),
    global_zhengji_gold_prices: Boolean(globalThis.zhengji_gold_prices),
    global_my_kv: Boolean(globalThis.my_kv),
  };
}

function isValidHistoryPoint(point) {
  return point &&
    Number.isFinite(Number(point.sale_price)) &&
    Number.isFinite(Number(point.buyback_price)) &&
    Number.isFinite(Number(point.timestamp));
}

function getBeijingParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getBeijingDate(now = new Date()) {
  const parts = getBeijingParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getBeijingTimestamp(date, hour, minute = 0) {
  return Date.parse(
    `${date}T${String(hour).padStart(2, '0')}:` +
    `${String(minute).padStart(2, '0')}:00+08:00`
  );
}

function formatBeijingTime(date, hour, minute = 0) {
  return `${date} ${String(hour).padStart(2, '0')}:` +
    `${String(minute).padStart(2, '0')}:00`;
}

function shouldApplyZhengjiMarkup(now = new Date()) {
  const parts = getBeijingParts(now);
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return false;

  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  return minuteOfDay >= MARKUP_START_MINUTE &&
    minuteOfDay < MARKUP_END_MINUTE;
}

export function applyDisplayPriceRule(sourcePrice, now = new Date()) {
  const sourceSale = Number(sourcePrice.sale_price);
  const sourceBuyback = Number(sourcePrice.buyback_price);
  const markup = shouldApplyZhengjiMarkup(now) ? ZHENGJI_MARKUP : 0;

  return {
    sale_price: sourceSale + markup,
    buyback_price: sourceBuyback,
    update_time: sourcePrice.update_time,
    markup,
  };
}

async function fetchSourcePrice() {
  const response = await fetch(GOLD_PRICE_SOURCE_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Gold source returned ${response.status}`);
  }

  const payload = await response.json();
  if (payload.code !== 1 || !payload.data) {
    throw new Error('Gold source returned invalid data');
  }
  return payload.data;
}

function recordPrice(price, now) {
  const date = getBeijingDate(now);
  if (historyDate !== date) {
    historyDate = date;
    priceHistory = [];
  }

  ensureTenOClockStart(price, now);

  const point = {
    time: price.update_time ||
      now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
    sale_price: Number(price.sale_price),
    buyback_price: Number(price.buyback_price),
    timestamp: now.getTime(),
  };
  currentPrice = point;

  const previous = priceHistory[priceHistory.length - 1];
  if (!previous || previous.sale_price !== point.sale_price || previous.synthetic_start) {
    priceHistory.push(point);
  }
  return point;
}

function ensureTenOClockStart(price, now) {
  const date = getBeijingDate(now);
  const startTimestamp = getBeijingTimestamp(date, 10, 0);
  if (!Number.isFinite(startTimestamp) || now.getTime() < startTimestamp) return;

  const existingStart = priceHistory.find(point =>
    Math.abs(Number(point.timestamp) - startTimestamp) < 1000 ||
    (point.synthetic_start === true && Number(point.timestamp) === startTimestamp)
  );
  if (existingStart) return;

  const openingSource = priceHistory.find(point =>
    Number(point.timestamp) >= startTimestamp
  ) || price;

  priceHistory.push({
    time: formatBeijingTime(date, 10, 0),
    sale_price: Number(openingSource.sale_price),
    buyback_price: Number(openingSource.buyback_price),
    timestamp: startTimestamp,
    synthetic_start: true,
  });
  priceHistory.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

async function loadDailyState(kv, date) {
  if (!kv || stateLoadedDate === date) return;

  stateLoadedDate = date;
  const saved = await kv.get(getStateKey(date), { type: 'json' });
  if (!saved || saved.date !== date || !Array.isArray(saved.history)) return;

  const restored = saved.history
    .filter(isValidHistoryPoint)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  if (restored.length === 0) return;

  historyDate = date;
  priceHistory = restored;
  currentPrice = restored[restored.length - 1];
}

async function saveDailyState(kv, date) {
  if (!kv || historyDate !== date || priceHistory.length === 0) return;

  await kv.put(getStateKey(date), JSON.stringify({
    date,
    history: priceHistory,
    updated_at: new Date().toISOString(),
  }));
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

export async function handleApiRequest(request, dependencies = {}) {
  const url = new URL(request.url);
  const now = dependencies.now ? dependencies.now() : new Date();
  const fetchPrice = dependencies.fetchPrice || fetchSourcePrice;
  const date = getBeijingDate(now);
  const kv = getKvStore(dependencies);

  try {
    await loadDailyState(kv, date);

    if (url.pathname === '/gold-api/gold/current' || url.pathname === '/api/gold/current') {
      const sourcePrice = await fetchPrice();
      const displayPrice = applyDisplayPriceRule(sourcePrice, now);
      const point = recordPrice(displayPrice, now);
      await saveDailyState(kv, date);

      return json({
        code: 1,
        data: {
          sale_price: point.sale_price.toFixed(2),
          buyback_price: point.buyback_price.toFixed(2),
          update_time: point.time,
        },
      });
    }

    if (url.pathname === '/gold-api/gold/history' || url.pathname === '/api/gold/history') {
      if (!currentPrice || historyDate !== date) {
        const sourcePrice = await fetchPrice();
        recordPrice(applyDisplayPriceRule(sourcePrice, now), now);
      } else {
        ensureTenOClockStart(currentPrice, now);
      }
      await saveDailyState(kv, date);
      return json({ code: 1, data: priceHistory });
    }

    if (url.pathname === '/gold-api/health' || url.pathname === '/api/health') {
      return json({
        status: 'ok',
        runtime: 'edgeone-edge-functions',
        today: date,
        today_points: priceHistory.length,
        kv: kv ? 'enabled' : 'disabled',
        kv_debug: url.searchParams.get('debug') === 'kv' ? getKvDebug(dependencies) : undefined,
        server_time: now.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          hour12: false,
        }),
      });
    }

    return json({ code: 0, message: 'Not found' }, 404);
  } catch (error) {
    return json({
      code: 0,
      message: '暂时无法获取金价',
      detail: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}

export async function onRequest(context) {
  return handleApiRequest(context.request, { env: context.env });
}

export default onRequest;

