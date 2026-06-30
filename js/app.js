/* ===== 粤鑫金价 - 固定金价展示 ===== */

let currentGold = null;
let prevSalePrice = null;
let prevBuybackPrice = null;

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

function triggerPriceTick(elementId, previousPrice, nextPrice) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const directionClass = nextPrice > previousPrice ? 'price-tick-up' : 'price-tick-down';
  el.classList.remove('price-tick-up', 'price-tick-down');
  void el.offsetWidth;
  el.classList.add(directionClass);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updatePriceDisplay() {
  if (!currentGold) return;

  const newSale = Number(currentGold.sale_price);
  const newBuyback = Number(currentGold.buyback_price);
  if (!Number.isFinite(newSale) || !Number.isFinite(newBuyback)) return;

  if (prevSalePrice !== null && prevSalePrice !== newSale) {
    triggerPriceTick('current-price', prevSalePrice, newSale);
  }
  if (prevBuybackPrice !== null && prevBuybackPrice !== newBuyback) {
    triggerPriceTick('buyback-price', prevBuybackPrice, newBuyback);
  }

  prevSalePrice = newSale;
  prevBuybackPrice = newBuyback;

  setText('current-price', newSale.toFixed(2));
  setText('buyback-price', newBuyback.toFixed(2));
  setText('header-datetime', formatHeaderDateTime());

  const updateTime = currentGold.update_time || '--';
  const spread = newSale - newBuyback;

  const changeInfo = document.getElementById('price-change-info');
  if (changeInfo) {
    changeInfo.innerHTML =
      `<span class="meta-line">` +
        `<span class="meta-label">更新</span>` +
        `<strong class="meta-value">${updateTime}</strong>` +
      `</span>`;
  }

  const rangeInfo = document.getElementById('price-range-info');
  if (rangeInfo) {
    rangeInfo.innerHTML =
      `<span class="meta-line">` +
        `<span class="meta-label">价差</span>` +
        `<strong class="meta-value">${spread.toFixed(2)}</strong>` +
      `</span>`;
  }
}

async function fetchGoldCurrent() {
  try {
    const resp = await fetch('/gold-api/gold/current');
    const json = await resp.json();
    if (json.code === 1 && json.data) {
      currentGold = json.data;
      updatePriceDisplay();
    }
  } catch {
    // silent refresh failure
  }
}

function startPolling() {
  setInterval(async () => {
    await fetchGoldCurrent();
    setText('header-datetime', formatHeaderDateTime());
  }, 3000);
}

(async function bootstrap() {
  setText('header-datetime', formatHeaderDateTime());
  await fetchGoldCurrent();
  startPolling();
})();
