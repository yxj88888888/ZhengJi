const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');
const qrPath = path.join(root, 'public', 'images', 'store-wechat-qr.jpg');

if (!html.includes('<title>粤鑫金 - 实时贵金属行情</title>')) {
  throw new Error('Expected a valid closed page title');
}
if (html.indexOf('</title>') > html.indexOf('<body')) {
  throw new Error('Title tag should not swallow body markup');
}

if (!fs.existsSync(qrPath)) {
  throw new Error('Expected store WeChat QR image to be copied into public images');
}

if (!html.includes('class="header-qr-card"')) {
  throw new Error('Expected header QR card markup');
}
if (!html.includes('class="header-qr-placeholder"')) {
  throw new Error('Expected reserved QR placeholder markup');
}
if (html.includes('images/store-wechat-qr.jpg')) {
  throw new Error('Header should reserve the QR position without loading the old QR image');
}
if (!html.includes('欢迎关注店铺微信')) {
  throw new Error('Expected updated QR card follow text');
}
if (html.includes('关注粤鑫金') || html.includes('了解实时行情')) {
  throw new Error('Old QR card follow text should be removed');
}

for (const selector of ['.header-qr-card', '.header-qr-placeholder', '.header-qr-title', '.header-qr-subtitle']) {
  if (!css.includes(selector)) throw new Error(`Missing CSS selector ${selector}`);
}

const qrPlaceholderRule = css.match(/\.header-qr-placeholder\s*\{([^}]*)\}/m);
if (!qrPlaceholderRule || !/width:\s*clamp\(74px,\s*10vw,\s*132px\)/.test(qrPlaceholderRule[1]) ||
    !/height:\s*clamp\(74px,\s*10vw,\s*132px\)/.test(qrPlaceholderRule[1])) {
  throw new Error('Expected responsive clamped desktop QR placeholder');
}

const qrCardRule = css.match(/\.header-qr-card\s*\{([^}]*)\}/m);
if (!qrCardRule || !/width:\s*clamp\(220px,\s*28vw,\s*363px\)/.test(qrCardRule[1])) {
  throw new Error('Expected responsive clamped header QR card width');
}

if (!qrCardRule || !/gap:\s*clamp\(8px,\s*1\.2vw,\s*15px\)/.test(qrCardRule[1])) {
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
const qrSubtitleRule = css.match(/\.header-qr-subtitle\s*\{([^}]*)\}/m);
if (!qrTitleRule || !/font-size:\s*clamp\(20px,\s*2\.55vw,\s*33px\)/.test(qrTitleRule[1])) {
  throw new Error('Expected responsive desktop QR title');
}
if (!qrSubtitleRule || !/font-size:\s*clamp\(15px,\s*2vw,\s*26px\)/.test(qrSubtitleRule[1])) {
  throw new Error('Expected responsive desktop QR subtitle');
}

if (!/@media\s*\(max-width:\s*900px\)[\s\S]*grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"qr time"/.test(css)) {
  throw new Error('Expected medium header to place time on its own grid row');
}

if (!/@media\s*\(max-width:\s*768px\)[\s\S]*\.header-qr-card[\s\S]*display:\s*flex/.test(css)) {
  throw new Error('Expected QR card to remain visible on narrow screens');
}

if (!/@media\s*\(max-width:\s*768px\)[\s\S]*\.header-qr-title\s*\{[\s\S]*font-size:\s*clamp\(18px,\s*5vw,\s*29px\)/.test(css) ||
    !/@media\s*\(max-width:\s*768px\)[\s\S]*\.header-qr-subtitle\s*\{[\s\S]*font-size:\s*clamp\(14px,\s*4vw,\s*23px\)/.test(css)) {
  throw new Error('Expected responsive QR copy at narrow widths');
}

const portraitMarker = '@media (orientation: portrait) and (min-width: 520px) and (max-aspect-ratio: 3/4)';
const portraitStart = css.indexOf(portraitMarker);
if (portraitStart === -1) {
  throw new Error('Expected portrait QR layout media query to include 566px-wide signage screens');
}
const portraitNext = css.indexOf('\n@media', portraitStart + portraitMarker.length);
const portraitBlock = css.slice(portraitStart, portraitNext === -1 ? css.length : portraitNext);
if (!/\.header-qr-card\s*\{[\s\S]*flex-direction:\s*column[\s\S]*justify-content:\s*flex-start/.test(portraitBlock)) {
  throw new Error('Portrait QR card should place the reserved QR box above the copy');
}
if (!/\.header-qr-subtitle\s*\{[\s\S]*display:\s*none/.test(portraitBlock)) {
  throw new Error('Portrait QR card should show the updated single-line copy only');
}

const tinyMarker = '@media (max-width: 480px)';
const tinyStart = css.indexOf(tinyMarker);
if (tinyStart === -1) {
  throw new Error('Expected tiny mobile QR media query');
}
const tinyNext = css.indexOf('\n@media', tinyStart + tinyMarker.length);
const tinyBlock = css.slice(tinyStart, tinyNext === -1 ? css.length : tinyNext);
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*clamp\(106px,\s*30vw,\s*126px\)[\s\S]*flex-direction:\s*column/.test(tinyBlock)) {
  throw new Error('Tiny mobile QR prompt should stay inside a narrow vertical card');
}
if (!/\.header-qr-title\s*\{[\s\S]*font-size:\s*clamp\(11px,\s*3\.05vw,\s*13px\)/.test(tinyBlock)) {
  throw new Error('Tiny mobile QR prompt text should shrink to avoid overlap');
}
if (!/\.header-qr-subtitle\s*\{[\s\S]*display:\s*none/.test(tinyBlock)) {
  throw new Error('Tiny mobile QR card should not reserve subtitle space');
}

console.log('header QR module includes asset, text, and responsive styling');
