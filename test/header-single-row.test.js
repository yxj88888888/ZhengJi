const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

function mediaBlock(maxWidth) {
  const marker = `@media (max-width: ${maxWidth}px)`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Missing max-width ${maxWidth}px media block`);
  const next = css.indexOf('\n@media', start + marker.length);
  return css.slice(start, next === -1 ? css.length : next);
}

const mobileBlock = mediaBlock(768);
if (!/\.header-inner\s*\{[\s\S]*display:\s*grid/.test(mobileBlock)) {
  throw new Error('Header should stay in a grid row on narrow screens');
}
if (!/\.header-inner\s*\{[\s\S]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/.test(mobileBlock)) {
  throw new Error('Narrow header should keep QR and logo center in one row');
}
if (/\.header-inner\s*\{[\s\S]*flex-direction:\s*column/.test(mobileBlock)) {
  throw new Error('Header must not stack QR and logo vertically on narrow screens');
}
if (!/\.header-center\s*\{[\s\S]*align-items:\s*center/.test(mobileBlock)) {
  throw new Error('Narrow header should center the logo block in its right-side area');
}
if (!/\.header-center\s*\{[\s\S]*transform:\s*translateX\(15px\)/.test(mobileBlock)) {
  throw new Error('Narrow header should sit slightly to the right within its area');
}
if (!/\.logo-section\s*\{[\s\S]*justify-content:\s*center/.test(mobileBlock)) {
  throw new Error('Narrow logo row should be centered');
}
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*285px/.test(mobileBlock)) {
  throw new Error('Narrow header should shrink QR card width to preserve one row');
}

const tinyBlock = mediaBlock(480);
if (/\.header-inner\s*\{[\s\S]*flex-direction:\s*column/.test(tinyBlock)) {
  throw new Error('Tiny header must not stack QR and logo vertically');
}
if (!/\.header-inner\s*\{[\s\S]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/.test(tinyBlock)) {
  throw new Error('Tiny header should still use a two-column row');
}
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*225px/.test(tinyBlock)) {
  throw new Error('Tiny header should shrink QR card further to preserve one row');
}
if (!/\.header-center\s*\{[\s\S]*transform:\s*translateX\(9px\)/.test(tinyBlock)) {
  throw new Error('Tiny header should stay gently right-shifted without overflowing');
}

console.log('header keeps QR card and logo in one row at narrow widths');
