/* ===== 粤鑫金价 - 行情页逻辑 ===== */

let goldHistory = [];
let currentGold = null;
let firstPrice = null;
let currentRange = 'today';
let todayHigh = null;
let todayLow = null;
let prevSalePrice = null;
let prevBuybackPrice = null;
const LIVE_HISTORY_LIMIT = 5000;
const LIVE_FLAT_SAMPLE_MS = 60000;

function formatTimeShort(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' +
         d.getMinutes().toString().padStart(2, '0');
}

function formatDate(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function formatHeaderDateTime() {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return (now.getMonth() + 1) + '月' +
    now.getDate() + '日 星期' +
    days[now.getDay()] + ' ' +
    now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0') + ':' +
    now.getSeconds().toString().padStart(2, '0');
}
function formatTimeByRange(ts) {
  if (currentRange === 'month') return formatDate(ts);
  if (currentRange === 'week') return formatDate(ts);
  return formatTimeShort(ts);
}

function formatAxisTime(ts) {
  return formatTimeShort(ts);
}

function getTodayAxisBounds(referenceTs) {
  const start = new Date(referenceTs || Date.now());
  start.setHours(10, 0, 0, 0);

  const end = new Date(start);
  end.setHours(20, 0, 0, 0);

  return { min: start.getTime(), max: end.getTime() };
}

function getPriceAxisBounds(pricePoints) {
  const prices = pricePoints
    .map(point => Number(point[1]))
    .filter(Number.isFinite);
  if (prices.length === 0) return { min: null, max: null, interval: null };

  const latest = prices[prices.length - 1];
  const tick = 5;
  const minimumSpan = 20;
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  let min = Math.floor((dataMin - tick) / tick) * tick;
  let max = Math.ceil((dataMax + tick) / tick) * tick;

  if (max - min < minimumSpan) {
    min = Math.floor((latest - minimumSpan / 2) / tick) * tick;
    max = min + minimumSpan;
  }

  const span = max - min;
  const interval = Math.max(tick, Math.ceil((span / 4) / tick) * tick);
  return { min, max, interval };
}

function parseGoldTimestamp(value) {
  if (!value) return NaN;
  if (typeof value === 'number') return value;

  const text = String(value).trim();
  const normalized = text.replace(/-/g, '/');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeGoldPoint(raw, fallbackTimestamp = Date.now(), options = {}) {
  if (!raw) return null;

  const sale = Number(raw.sale_price);
  const buyback = Number(raw.buyback_price);
  if (!Number.isFinite(sale) || !Number.isFinite(buyback)) return null;

  const timestamp = options.preferFallbackTimestamp
    ? fallbackTimestamp
    : parseGoldTimestamp(raw.timestamp) ||
      parseGoldTimestamp(raw.update_time) ||
      parseGoldTimestamp(raw.time) ||
      fallbackTimestamp;

  return {
    time: raw.time || raw.update_time ||
      new Date(timestamp).toLocaleString('zh-CN', { hour12: false }),
    sale_price: sale,
    buyback_price: buyback,
    timestamp,
    synthetic_start: raw.synthetic_start === true,
  };
}

function sameGoldPoint(a, b) {
  return a &&
    b &&
    a.sale_price === b.sale_price &&
    a.buyback_price === b.buyback_price;
}

function refreshFirstPrice() {
  if (goldHistory.length === 0) return;
  const earliest = goldHistory[0];
  if (!firstPrice || Number(earliest.timestamp) < Number(firstPrice.timestamp || Infinity)) {
    firstPrice = earliest;
  }
}

function trimGoldHistory() {
  if (goldHistory.length <= LIVE_HISTORY_LIMIT) return;

  if (currentRange === 'today') {
    const todayBounds = getTodayAxisBounds(goldHistory[0]?.timestamp || Date.now());
    const visible = [];
    const outside = [];

    for (const point of goldHistory) {
      if (point.timestamp >= todayBounds.min && point.timestamp <= todayBounds.max) {
        visible.push(point);
      } else {
        outside.push(point);
      }
    }

    const outsideLimit = Math.max(0, LIVE_HISTORY_LIMIT - visible.length);
    const retainedOutside = outsideLimit > 0 ? outside.slice(-outsideLimit) : [];
    goldHistory = [...retainedOutside, ...visible].sort((a, b) => a.timestamp - b.timestamp);
    return;
  }

  goldHistory = goldHistory.slice(-LIVE_HISTORY_LIMIT);
}

function mergeGoldHistoryPoints(points) {
  const normalized = (Array.isArray(points) ? points : [])
    .map(point => normalizeGoldPoint(point))
    .filter(Boolean);

  if (normalized.length === 0) return false;

  const sorted = [...goldHistory, ...normalized]
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  const merged = [];
  for (const point of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      sameGoldPoint(last, point) &&
      Math.abs(last.timestamp - point.timestamp) < 1000
    ) {
      merged[merged.length - 1] = point.timestamp >= last.timestamp ? point : last;
    } else {
      merged.push(point);
    }
  }

  goldHistory = merged;
  trimGoldHistory();
  refreshFirstPrice();
  return true;
}

function refreshTodayRange() {
  if (currentRange !== 'today' || goldHistory.length === 0) return;

  const todayBounds = getTodayAxisBounds(goldHistory[0]?.timestamp);
  const prices = goldHistory
    .filter(point => point.timestamp >= todayBounds.min && point.timestamp <= todayBounds.max)
    .map(point => Number(point.sale_price))
    .filter(Number.isFinite);

  if (prices.length === 0) return;
  todayHigh = Math.max(...prices);
  todayLow = Math.min(...prices);
}

function recordLiveGoldPoint(rawPoint) {
  const point = normalizeGoldPoint(rawPoint, Date.now(), { preferFallbackTimestamp: true });
  if (!point) return false;
  point.synthetic_start = false;

  const last = goldHistory[goldHistory.length - 1];
  if (!last) {
    goldHistory.push(point);
    refreshFirstPrice();
    return true;
  }

  if (point.timestamp <= last.timestamp) {
    return false;
  }

  if (sameGoldPoint(last, point)) {
    if (goldHistory.length >= 2 && point.timestamp - last.timestamp < LIVE_FLAT_SAMPLE_MS) {
      goldHistory[goldHistory.length - 1] = point;
    } else {
      goldHistory.push(point);
    }
  } else {
    goldHistory.push(point);
  }

  trimGoldHistory();
  refreshFirstPrice();
  return true;
}

async function fetchGoldCurrent() {
  try {
    const resp = await fetch('/gold-api/gold/current');
    const json = await resp.json();
    if (json.code === 1 && json.data) {
      currentGold = json.data;
      const chartChanged = recordLiveGoldPoint(currentGold);
      refreshTodayRange();
      updatePriceDisplay();
      if (chartChanged && currentRange === 'today') {
        updateMainChart();
      }
    }
  } catch {
    // silent refresh failure
  }
}

async function fetchGoldHistory() {
  try {
    const resp = await fetch('/gold-api/gold/history?range=' + currentRange);
    const json = await resp.json();
    if (json.code === 1 && json.data.length > 0) {
      mergeGoldHistoryPoints(json.data);

      refreshTodayRange();

      updatePriceDisplay();
      updateMainChart();
    }
  } catch (error) {
    console.error('获取金价历史失败:', error);
  }
}

function triggerPriceTick(elementId, previousPrice, nextPrice) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const directionClass = nextPrice > previousPrice ? 'price-tick-up' : 'price-tick-down';
  el.classList.remove('price-tick-up', 'price-tick-down');
  void el.offsetWidth;
  el.classList.add(directionClass);
}

function updatePriceDisplay() {
  const display = currentGold || (goldHistory.length > 0 ? {
    sale_price: goldHistory[goldHistory.length - 1].sale_price,
    buyback_price: goldHistory[goldHistory.length - 1].buyback_price,
    time: goldHistory[goldHistory.length - 1].time
  } : null);

  if (!display) return;

  const newSale = Number(display.sale_price);
  const newBuyback = Number(display.buyback_price);
  if (!Number.isFinite(newSale) || !Number.isFinite(newBuyback)) return;

  if (prevSalePrice !== null && prevSalePrice !== newSale) {
    triggerPriceTick('current-price', prevSalePrice, newSale);
  }
  if (prevBuybackPrice !== null && prevBuybackPrice !== newBuyback) {
    triggerPriceTick('buyback-price', prevBuybackPrice, newBuyback);
  }

  prevSalePrice = newSale;
  prevBuybackPrice = newBuyback;

  document.getElementById('current-price').textContent = newSale.toFixed(2);
  document.getElementById('buyback-price').textContent = newBuyback.toFixed(2);
  document.getElementById('header-datetime').textContent = formatHeaderDateTime();

  if (firstPrice && firstPrice.sale_price) {
    const base = Number(firstPrice.sale_price);
    const change = newSale - base;
    const changePct = base !== 0 ? ((change / base) * 100).toFixed(2) : '0.00';
    const sign = change >= 0 ? '+' : '';
    const cls = change >= 0 ? 'up' : 'down';
    document.getElementById('price-change-info').innerHTML =
      `<span class="meta-line">` +
        `<span class="meta-label">开盘</span>` +
        `<strong class="meta-value">${base.toFixed(2)}</strong>` +
      `</span>` +
      `<span class="meta-line change-line">` +
        `<span class="meta-label">涨跌</span>` +
        `<span class="meta-value change-value">` +
          `<span class="indicator-value ${cls}">${sign}${change.toFixed(2)}</span>` +
          `<span class="indicator-percent ${cls}">(${sign}${changePct}%)</span>` +
        `</span>` +
      `</span>`;
  }

  const rangeInfo = document.getElementById('price-range-info');
  if (rangeInfo && Number.isFinite(todayHigh) && Number.isFinite(todayLow)) {
    rangeInfo.innerHTML =
      `<span class="meta-line">` +
        `<span class="meta-label">最高</span>` +
        `<strong class="meta-value">${todayHigh.toFixed(2)}</strong>` +
      `</span>` +
      `<span class="meta-line">` +
        `<span class="meta-label">最低</span>` +
        `<strong class="meta-value">${todayLow.toFixed(2)}</strong>` +
      `</span>`;
  }
}

function updateMainChart() {
  if (goldHistory.length === 0) return;

  const todayBounds = currentRange === 'today'
    ? getTodayAxisBounds(goldHistory[0]?.timestamp)
    : { min: null, max: null };

  const pricePoints = goldHistory
    .map(d => [Number(d.timestamp), Number(d.sale_price)])
    .filter(point =>
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      (currentRange !== 'today' || (point[0] >= todayBounds.min && point[0] <= todayBounds.max))
    );
  const priceAxisBounds = currentRange === 'today'
    ? getPriceAxisBounds(pricePoints)
    : { min: null, max: null, interval: null };

  const chartDom = document.getElementById('chart-gold-main');
  if (chartDom && chartDom.dataset && currentRange === 'today') {
    chartDom.dataset.xMinTime = formatAxisTime(todayBounds.min);
    chartDom.dataset.xMaxTime = formatAxisTime(todayBounds.max);
    chartDom.dataset.ySpan = String(priceAxisBounds.max - priceAxisBounds.min);
    chartDom.dataset.pointCount = String(pricePoints.length);
  }

  if (!chartGoldMain) initGoldMainChart(chartDom);
  chartGoldMain.setOption({
    xAxis: {
      min: todayBounds.min,
      max: todayBounds.max,
      splitNumber: currentRange === 'today' ? 5 : 6,
      axisLabel: {
        color: chartTheme.text,
        fontSize: 10,
        margin: 8,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: value => currentRange === 'today' ? formatTimeShort(value) : formatTimeByRange(value),
      },
    },
    yAxis: {
      min: priceAxisBounds.min,
      max: priceAxisBounds.max,
      interval: priceAxisBounds.interval,
      scale: true,
    },
    series: [{
      name: '金价',
      data: pricePoints,
      ...terminalPriceSeriesStyle(),
      ...buildCurrentPriceAnnotations(pricePoints),
    }]
  });
}

function initAllCharts() {
  initGoldMainChart(document.getElementById('chart-gold-main'));
}

function startPolling() {
  setInterval(async () => {
    await fetchGoldCurrent();
    document.getElementById('header-datetime').textContent = formatHeaderDateTime();
  }, 1000);

  setInterval(fetchGoldHistory, 2000);
}

(async function bootstrap() {
  initAllCharts();
  await fetchGoldCurrent();
  await fetchGoldHistory();
  updatePriceDisplay();
  if (goldHistory.length > 0) updateMainChart();
  startPolling();
})();


