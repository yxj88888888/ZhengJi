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
if (!/flex\s*:\s*1\s+1\s+auto/.test(carouselRule) || !/min-height\s*:\s*0/.test(carouselRule)) {
  throw new Error('Certificate carousel should consume remaining middle space');
}

const noteRule = ruleFor('.fixed-price-note');
if (/position\s*:\s*fixed/.test(noteRule) || !/flex\s*:\s*0\s+0\s+auto/.test(noteRule)) {
  throw new Error('Bottom note should live inside the fixed one-page layout, not overlay it');
}

console.log('page layout is locked to one viewport without vertical scrolling');
