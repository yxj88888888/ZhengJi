const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');

const certificates = [
  'lppm-platinum.jpg',
  'sge-membership.jpg',
  'sge-gold-ingot.jpg',
  'sge-silver-ingot.jpg',
  'lbma-silver.jpg',
  'lbma-gold.jpg',
  'lppm-palladium.jpg',
  'yuexin-precious-metals.png',
  'yuexin-gold-investment.png',
];

if (!html.includes('class="certificate-carousel"') || !html.includes('aria-label="资质证书播放"')) {
  throw new Error('Expected certificate carousel markup below the price cards');
}

for (const filename of certificates) {
  const assetPath = path.join(root, 'public', 'images', 'certificates', filename);
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Missing certificate image asset: ${filename}`);
  }
  if (!html.includes(`images/certificates/${filename}`)) {
    throw new Error(`Missing certificate image reference: ${filename}`);
  }
}

if (!css.includes('.certificate-carousel') || !css.includes('transition: transform')) {
  throw new Error('Expected horizontal rolling certificate carousel styles');
}

if (!app.includes('function startCertificateCarousel()') ||
    !app.includes('track.style.transform') ||
    !app.includes('translateX')) {
  throw new Error('Expected automatic horizontal rolling certificate carousel script');
}

if (!app.includes('cloneNode(true)') ||
    !app.includes("track.addEventListener('transitionend'") ||
    !app.includes("track.style.transition = 'none'")) {
  throw new Error('Expected certificate carousel to loop seamlessly by appending cloned slides');
}

console.log('certificate carousel includes all qualification images and rolls horizontally');
