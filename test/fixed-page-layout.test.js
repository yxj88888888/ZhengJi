const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[2];
}

const htmlRule = ruleFor('html');
if (!/height\s*:\s*100%/.test(htmlRule) || !/overflow\s*:\s*hidden/.test(htmlRule)) {
  throw new Error('HTML root should lock the page to one viewport');
}

const bodyRule = ruleFor('body');
if (!/height\s*:\s*100vh/.test(bodyRule) ||
    !/overflow\s*:\s*hidden/.test(bodyRule) ||
    !/display\s*:\s*flex/.test(bodyRule) ||
    !/flex-direction\s*:\s*column/.test(bodyRule)) {
  throw new Error('Body should be a fixed one-page vertical flex layout');
}

const mainRule = ruleFor('.main-container');
if (!/flex\s*:\s*1\s+1\s+auto/.test(mainRule) ||
    !/min-height\s*:\s*0/.test(mainRule) ||
    !/overflow\s*:\s*hidden/.test(mainRule)) {
  throw new Error('Main container should fill remaining viewport without scrolling');
}

const sectionRule = ruleFor('.page-section.active');
if (!/display\s*:\s*flex/.test(sectionRule) || !/flex-direction\s*:\s*column/.test(sectionRule)) {
  throw new Error('Active page section should use a vertical flex layout');
}

const carouselRule = ruleFor('.certificate-carousel');
if (!/flex\s*:\s*0\s+1\s+auto/.test(carouselRule) ||
    !/width\s*:\s*100%/.test(carouselRule) ||
    !/aspect-ratio\s*:\s*2\.12/.test(carouselRule) ||
    !/min-height\s*:\s*0/.test(carouselRule)) {
  throw new Error('Certificate carousel should align with the price card while staying compact');
}

const portraitMarker = '@media (orientation: portrait) and (min-width: 600px) and (max-aspect-ratio: 3/4)';
const portraitStart = css.indexOf(portraitMarker);
if (portraitStart === -1) {
  throw new Error('Expected a 9:16 portrait layout media query');
}
const portraitNext = css.indexOf('\n@media', portraitStart + portraitMarker.length);
const portraitBlock = css.slice(portraitStart, portraitNext === -1 ? css.length : portraitNext);
if (!/\.price-combo-card\s*\{[\s\S]*grid-template-columns:\s*1fr/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should stack the two price cards');
}
if (!/\.certificate-carousel\s*\{[\s\S]*flex:\s*1\s+1\s+auto[\s\S]*aspect-ratio:\s*auto[\s\S]*height:\s*clamp\(320px,\s*40vh,\s*820px\)/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should size certificate display from available height');
}
if (!/\.header-address\s*\{[\s\S]*transform:\s*none/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should keep the address in normal flow');
}
if (!/\.admin-entry-link\s*\{[\s\S]*top:\s*clamp\(126px,\s*10\.6vh,\s*180px\)[\s\S]*bottom:\s*auto/.test(portraitBlock)) {
  throw new Error('Portrait signage layout should keep the admin entry clear of market content');
}

const noteRule = ruleFor('.fixed-price-note');
if (/position\s*:\s*fixed/.test(noteRule) || !/flex\s*:\s*0\s+0\s+auto/.test(noteRule)) {
  throw new Error('Bottom note should live inside the fixed one-page layout, not overlay it');
}

console.log('page layout is locked to one viewport without vertical scrolling');
