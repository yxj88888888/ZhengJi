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

const headerInner = css.match(/\.header-inner\s*\{([^}]*)\}/m);
if (!headerInner || !/grid-template-columns:\s*minmax\(260px,\s*1fr\)\s+auto\s+minmax\(260px,\s*1fr\)/.test(headerInner[1])) {
  throw new Error('Desktop header should use balanced flexible columns');
}

const mediumBlock = mediaBlock(900);
if (!/grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"qr time"/.test(mediumBlock)) {
  throw new Error('Medium header should move time below the logo instead of squeezing one row');
}
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*min\(46vw,\s*390px\)/.test(mediumBlock)) {
  throw new Error('Medium QR card should scale with viewport width');
}

const mobileBlock = mediaBlock(768);
if (!/grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"time time"/.test(mobileBlock)) {
  throw new Error('Mobile header should give the time a full row');
}
if (!/\.logo-title\s*\{[\s\S]*white-space:\s*nowrap/.test(css)) {
  throw new Error('Mobile logo title should stay on one line');
}
if (/\.logo-title\s*\{[\s\S]*max-width:\s*2\.4em/.test(mobileBlock)) {
  throw new Error('Mobile logo title should not be constrained to wrap');
}

const tinyBlock = mediaBlock(480);
if (!/\.header-qr-card\s*\{[\s\S]*width:\s*clamp\(112px,\s*34vw,\s*152px\)[\s\S]*flex-direction:\s*column/.test(tinyBlock)) {
  throw new Error('Tiny QR card should stay narrow and vertical to avoid overlapping the logo');
}
if (!/\.header-time\s*\{[\s\S]*font-size:\s*clamp\(18px,\s*5\.2vw,\s*27px\)/.test(tinyBlock)) {
  throw new Error('Tiny header time should shrink with viewport width');
}

console.log('responsive header avoids overlap across window sizes');
