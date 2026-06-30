/* ===== 门店展示 ===== */

const storeImages = [
  { src: 'images/store/门店正面.jpg', cat: 'store', label: '门店正面' },
  { src: 'images/store/门店全景.jpg', cat: 'store', label: '门店全景' },
  { src: 'images/store/店内照片.jpg', cat: 'store', label: '店内环境' },
  { src: 'images/store/门店背景.jpg', cat: 'store', label: '门店背景' },
  { src: 'images/store/客户招待处.jpg', cat: 'store', label: '客户招待处' },
  { src: 'images/store/资质墙、实时金价.jpg', cat: 'store', label: '资质墙·实时金价' },
  { src: 'images/store/金条.jpg', cat: 'gold', label: '金条' },
  { src: 'images/store/金条展示.jpg', cat: 'gold', label: '金条展示' },
  { src: 'images/store/金条展示2.jpg', cat: 'gold', label: '金条展示' },
  { src: 'images/store/金条展示3.jpg', cat: 'gold', label: '金条展示' },
  { src: 'images/store/金条展示4.jpg', cat: 'gold', label: '金条展示' },
  { src: 'images/store/金条展示5.jpg', cat: 'gold', label: '金条展示' },
  { src: 'images/store/金豆.jpg', cat: 'gold', label: '金豆' },
  { src: 'images/store/广角测金黄金.jpg', cat: 'gold', label: '广角测金' },
  { src: 'images/store/银条展示.jpg', cat: 'silver', label: '银条展示' },
  { src: 'images/store/银条展示2.jpg', cat: 'silver', label: '银条展示' },
  { src: 'images/store/粤鑫银条.jpg', cat: 'silver', label: '粤鑫银条' },
  { src: 'images/store/测金仪.jpg', cat: 'equipment', label: '测金仪' },
  { src: 'images/store/熔炼房.jpg', cat: 'equipment', label: '熔炼房' },
  { src: 'images/store/电熔机器.jpg', cat: 'equipment', label: '电熔机器' },
  { src: 'images/store/上金所单位展示灯箱.jpg', cat: 'equipment', label: '上金所灯箱' }
];

let currentCat = 'all';
let lightboxIndex = -1;
let lightboxImages = [];

function renderStore() {
  const grid = document.getElementById('store-grid');
  const filtered = currentCat === 'all'
    ? storeImages
    : storeImages.filter(img => img.cat === currentCat);

  grid.innerHTML = filtered.map((img, i) => `
    <div class="store-item" data-index="${i}" data-src="${img.src}">
      <img src="${img.src}" alt="${img.label}" loading="lazy" onerror="this.parentElement.style.display='none'">
      <div class="store-item-label">${img.label}</div>
    </div>
  `).join('');

  // 点击打开 lightbox
  grid.querySelectorAll('.store-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      openLightbox(filtered, idx);
    });
  });
}

// Lightbox
function openLightbox(images, index) {
  lightboxImages = images;
  lightboxIndex = index;
  showLightbox();
}

function showLightbox() {
  const img = lightboxImages[lightboxIndex];
  let overlay = document.getElementById('lightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightbox';
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button class="lightbox-close">&times;</button>
      <button class="lightbox-prev"><i class="fa fa-chevron-left"></i></button>
      <button class="lightbox-next"><i class="fa fa-chevron-right"></i></button>
      <img src="" alt="">
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.lightbox-close').addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('.lightbox-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
      showLightbox();
    });
    overlay.querySelector('.lightbox-next').addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
      showLightbox();
    });
    document.addEventListener('keydown', handleLightboxKey);
  }
  overlay.querySelector('img').src = img.src;
  overlay.querySelector('img').alt = img.label;
}

function handleLightboxKey(e) {
  const overlay = document.getElementById('lightbox');
  if (!overlay) return;
  if (e.key === 'Escape') overlay.remove();
  if (e.key === 'ArrowLeft') {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    showLightbox();
  }
  if (e.key === 'ArrowRight') {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    showLightbox();
  }
}

// 分类切换
document.getElementById('store-categories').addEventListener('click', (e) => {
  if (e.target.classList.contains('cat-btn')) {
    document.querySelectorAll('#store-categories .cat-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCat = e.target.dataset.cat;
    renderStore();
  }
});

// 初始化
renderStore();
