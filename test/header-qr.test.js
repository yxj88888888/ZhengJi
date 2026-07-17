const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');
const qrPath = path.join(root, 'public', 'images', 'store-wechat-qr.jpg');

if (!html.includes('</title>') || html.indexOf('</title>') > html.indexOf('<body')) {
  throw new Error('Expected a valid closed page title');
}

if (!fs.existsSync(qrPath)) {
  throw new Error('Expected store WeChat QR image to be copied into public images');
}

if (!html.includes('class="header-qr-card"')) {
  throw new Error('Expected header QR card markup');
}
if (!html.includes('class="header-qr-img"')) {
  throw new Error('Expected header to render the store QR image');
}
if (!html.includes('src="images/store-wechat-qr.jpg"')) {
  throw new Error('Expected header to load the cropped store WeChat QR image');
}
if (html.includes('header-qr-placeholder')) {
  throw new Error('Header should no longer render the reserved QR placeholder');
}
if (!html.includes('欢迎关注店铺微信')) {
  throw new Error('Expected QR card follow text');
}

for (const selector of ['.header-qr-card', '.header-qr-img', '.header-qr-title']) {
  if (!css.includes(selector)) throw new Error(`Missing CSS selector ${selector}`);
}

const qrImageRule = css.match(/\.header-qr-img\s*\{([^}]*)\}/m);
if (!qrImageRule || !/width:\s*clamp\(110px,\s*10\.5vw,\s*180px\)/.test(qrImageRule[1]) ||
    !/height:\s*clamp\(110px,\s*10\.5vw,\s*180px\)/.test(qrImageRule[1]) ||
    !/object-fit:\s*contain/.test(qrImageRule[1])) {
  throw new Error('Expected responsive QR image that preserves scanable proportions');
}

const qrCardRule = css.match(/\.header-qr-card\s*\{([^}]*)\}/m);
if (!qrCardRule || !/width:\s*clamp\(430px,\s*36vw,\s*660px\)/.test(qrCardRule[1])) {
  throw new Error('Expected wider header QR card for enlarged follow text');
}

if (!qrCardRule || !/gap:\s*clamp\(10px,\s*1\.45vw,\s*22px\)/.test(qrCardRule[1])) {
  throw new Error('Expected responsive gap between header QR image and copy');
}

const qrCopyRule = css.match(/\.header-qr-copy\s*\{([^}]*)\}/m);
if (!qrCopyRule || !/flex:\s*1/.test(qrCopyRule[1]) ||
    !/display:\s*flex/.test(qrCopyRule[1]) ||
    !/justify-content:\s*center/.test(qrCopyRule[1]) ||
    !/align-self:\s*stretch/.test(qrCopyRule[1]) ||
    !/line-height:\s*1\.1/.test(qrCopyRule[1])) {
  throw new Error('Expected QR copy to fill and center inside remaining card space');
}

const qrTitleRule = css.match(/\.header-qr-title\s*\{([^}]*)\}/m);
if (!qrTitleRule || !/font-size:\s*clamp\(40px,\s*5\.1vw,\s*66px\)/.test(qrTitleRule[1]) ||
    !/white-space:\s*normal/.test(qrTitleRule[1])) {
  throw new Error('Expected QR title to be doubled and allowed to wrap safely');
}

if (!/@media\s*\(max-width:\s*900px\)[\s\S]*grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"qr time"/.test(css)) {
  throw new Error('Expected medium header to place time on its own grid row');
}

if (!/@media\s*\(max-width:\s*768px\)[\s\S]*\.header-qr-card[\s\S]*display:\s*flex/.test(css)) {
  throw new Error('Expected QR card to remain visible on narrow screens');
}

if (!/@media\s*\(max-width:\s*768px\)[\s\S]*\.header-qr-title\s*\{[\s\S]*font-size:\s*clamp\(36px,\s*10vw,\s*58px\)/.test(css)) {
  throw new Error('Expected doubled QR copy at narrow widths');
}

const portraitMarker = '@media (orientation: portrait) and (min-width: 520px) and (max-aspect-ratio: 3/4)';
const portraitStart = css.indexOf(portraitMarker);
if (portraitStart === -1) {
  throw new Error('Expected portrait QR layout media query to include 566px-wide signage screens');
}
const portraitNext = css.indexOf('\n@media', portraitStart + portraitMarker.length);
const portraitBlock = css.slice(portraitStart, portraitNext === -1 ? css.length : portraitNext);
if (!/\.header-qr-card\s*\{[\s\S]*flex-direction:\s*column[\s\S]*justify-content:\s*flex-start/.test(portraitBlock)) {
  throw new Error('Portrait QR card should place the QR image above the copy');
}
if (!/\.header-qr-img\s*\{[\s\S]*width:\s*clamp\(104px,\s*13vh,\s*156px\)/.test(portraitBlock)) {
  throw new Error('Portrait QR image should scale up to meet the price panel');
}
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*clamp\(176px,\s*26\.5vw,\s*210px\)/.test(portraitBlock)) {
  throw new Error('Portrait QR card should leave room for the enlarged brand mark');
}

const tinyMarker = '@media (max-width: 480px)';
const tinyStart = css.indexOf(tinyMarker);
if (tinyStart === -1) {
  throw new Error('Expected tiny mobile QR media query');
}
const tinyNext = css.indexOf('\n@media', tinyStart + tinyMarker.length);
const tinyBlock = css.slice(tinyStart, tinyNext === -1 ? css.length : tinyNext);
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*clamp\(112px,\s*34vw,\s*152px\)[\s\S]*flex-direction:\s*column/.test(tinyBlock)) {
  throw new Error('Tiny mobile QR prompt should stay inside a narrow vertical card');
}
if (!/\.header-qr-title\s*\{[\s\S]*font-size:\s*clamp\(22px,\s*6\.1vw,\s*26px\)/.test(tinyBlock)) {
  throw new Error('Tiny mobile QR prompt text should remain doubled without overlap');
}

console.log('header QR module renders cropped image, enlarged text, and responsive styling');
