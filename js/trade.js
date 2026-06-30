/* ===== 在线交易 ===== */

let tradeGoldPrice = null;
let tradeBuybackPrice = null;
let currentCalcPrice = null;

// 监听金价更新，同步到交易页
function updateTradePrice(salePrice, buybackPrice) {
  tradeGoldPrice = salePrice;
  tradeBuybackPrice = buybackPrice;
  if (!currentCalcPrice) currentCalcPrice = salePrice;
  document.getElementById('trade-gold-price').textContent = salePrice ? salePrice.toFixed(2) + ' 元/克' : '--';
  document.getElementById('trade-buyback-price').textContent = buybackPrice ? buybackPrice.toFixed(2) + ' 元/克' : '--';
  // 如果当前选的是回收，更新时间价
  const productType = document.getElementById('order-product').value;
  currentCalcPrice = productType === 'recycle' ? buybackPrice : salePrice;
  calcEstimate();
}

// 计算器
const tradeWeightInput = document.getElementById('trade-weight');
tradeWeightInput.addEventListener('input', calcEstimate);

const orderWeightInput = document.getElementById('order-weight');
orderWeightInput.addEventListener('input', () => {
  tradeWeightInput.value = orderWeightInput.value;
  calcEstimate();
});

function calcEstimate() {
  const weight = parseFloat(document.getElementById('trade-weight').value);
  const estimateEl = document.getElementById('trade-estimate');
  if (isNaN(weight) || weight <= 0 || !currentCalcPrice) {
    estimateEl.textContent = '¥ 0.00';
    return;
  }
  const amount = (currentCalcPrice * weight).toFixed(2);
  estimateEl.textContent = '¥ ' + amount;
}

// 产品类型切换：回收用回购价
document.getElementById('order-product').addEventListener('change', function() {
  const isRecycle = this.value === 'recycle';
  currentCalcPrice = isRecycle ? tradeBuybackPrice : tradeGoldPrice;
  const priceLabel = document.getElementById('trade-gold-price');
  if (isRecycle && tradeBuybackPrice) {
    priceLabel.textContent = tradeBuybackPrice.toFixed(2) + ' 元/克 (回购价)';
  } else if (tradeGoldPrice) {
    priceLabel.textContent = tradeGoldPrice.toFixed(2) + ' 元/克';
  }
  calcEstimate();
});

// 下单
const orderForm = document.getElementById('order-form');
const orderSuccess = document.getElementById('order-success');

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const productType = document.getElementById('order-product').value;
  const weight = document.getElementById('order-weight').value.trim();
  const contactName = document.getElementById('order-name').value.trim();
  const contactPhone = document.getElementById('order-phone').value.trim();
  const note = document.getElementById('order-note').value.trim();

  if (!productType) { showTradeToast('请选择产品类型'); return; }
  if (!contactName) { showTradeToast('请输入联系人姓名'); return; }
  if (!/^1[3-9]\d{9}$/.test(contactPhone)) { showTradeToast('手机号格式不正确'); return; }
  const weightNum = parseFloat(weight);
  if (isNaN(weightNum) || weightNum <= 0) { showTradeToast('请输入有效克重'); return; }

  const btn = orderForm.querySelector('.btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 提交中...';

  try {
    const resp = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productType, weight: weightNum, contactName, contactPhone, note })
    });
    const json = await resp.json();
    if (json.code === 1) {
      const summary = document.getElementById('order-summary');
      const productNames = { gold_bar: '金条', gold_bean: '金豆', silver_bar: '银条', recycle: '黄金回收' };
      summary.innerHTML = `
        <div>订单号：<span>${json.data.id}</span></div>
        <div>产品：<span>${productNames[productType]}</span></div>
        <div>克重：<span>${weightNum} 克</span></div>
        <div>预估金额：<span style="color:#d4a537;">¥${json.data.estimatedAmount}</span></div>
      `;
      orderForm.style.display = 'none';
      orderSuccess.style.display = 'block';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-paper-plane"></i> 提交订单';
      showTradeToast(json.msg || '下单失败');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-paper-plane"></i> 提交订单';
    showTradeToast('网络错误，请稍后重试');
  }
});

function showTradeToast(msg) {
  const existing = document.querySelector('.form-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'form-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:#ff4d4f;color:#fff;padding:10px 24px;border-radius:8px;
    font-size:14px;z-index:999;animation:fadeInOut 2s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// 添加 toast 动画
const toastStyle = document.createElement('style');
toastStyle.textContent = '@keyframes fadeInOut{0%{opacity:0;transform:translateX(-50%) translateY(-10px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}70%{opacity:1}100%{opacity:0}}';
document.head.appendChild(toastStyle);

// 页面切换时重置
document.addEventListener('navChanged', () => {
  const tradeSection = document.getElementById('section-trade');
  if (tradeSection.classList.contains('active')) return;
  setTimeout(() => {
    orderForm.style.display = '';
    orderSuccess.style.display = 'none';
    orderForm.reset();
    tradeWeightInput.value = '';
    document.getElementById('trade-estimate').textContent = '¥ 0.00';
  }, 3000);
});
