/* ===== 粤鑫金价 - 固定金价展示 ===== */

let currentGold = null;
let prevSalePrice = null;
let prevBuybackPrice = null;

const fallbackGold = {
  sale_price: '1130.00',
  buyback_price: '1026.50',
  update_time: '静态预览',
};

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
    if (!currentGold) {
      currentGold = fallbackGold;
      updatePriceDisplay();
    }
  }
}

function startPolling() {
  setInterval(async () => {
    await fetchGoldCurrent();
    setText('header-datetime', formatHeaderDateTime());
  }, 3000);
}

function startCertificateCarousel() {
  const track = document.getElementById('certificate-track');
  if (!track) return;

  const slides = Array.from(track.querySelectorAll('.certificate-slide'));
  if (slides.length <= 1) return;

  slides.forEach((slide) => {
    const clone = slide.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  let currentIndex = 0;
  let isResetting = false;

  setInterval(() => {
    if (isResetting) return;
    currentIndex += 1;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
  }, 3000);

  track.addEventListener('transitionend', () => {
    if (currentIndex < slides.length) return;

    isResetting = true;
    track.style.transition = 'none';
    currentIndex = 0;
    track.style.transform = 'translateX(0)';
    void track.offsetWidth;
    track.style.transition = '';
    isResetting = false;
  });
}

(async function bootstrap() {
  setText('header-datetime', formatHeaderDateTime());
  await fetchGoldCurrent();
  startCertificateCarousel();
  startPolling();
})();
