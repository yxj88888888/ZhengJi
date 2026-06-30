const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[2];
}

const priceChange = ruleFor('.price-change');
if (!/display\s*:\s*grid/.test(priceChange)) {
  throw new Error('price-change should use grid for label/value alignment');
}
if (!/grid-template-columns\s*:\s*max-content\s+minmax\(96px,\s*1fr\)/.test(priceChange)) {
  throw new Error('price-change should define stable label and value columns');
}

const priceMeta = ruleFor('.price-meta');
if (!/position\s*:\s*absolute/.test(priceMeta) ||
    !/top\s*:\s*0/.test(priceMeta) ||
    !/right\s*:\s*0/.test(priceMeta)) {
  throw new Error('price metadata should sit at the top-right corner of the sale card');
}

const fixedPriceNote = ruleFor('.fixed-price-note');
if (!/display\s*:\s*flex/.test(fixedPriceNote) || !/justify-content\s*:\s*center/.test(fixedPriceNote)) {
  throw new Error('fixed-price note should be centered and stable');
}

const metaLabel = ruleFor('.meta-label');
if (!/text-align\s*:\s*left/.test(metaLabel)) {
  throw new Error('meta labels should align as a left text column');
}

const metaValue = ruleFor('.meta-value');
if (!/text-align\s*:\s*right/.test(metaValue)) {
  throw new Error('meta values should align as a right numeric column');
}
if (!/font-variant-numeric\s*:\s*tabular-nums/.test(metaValue)) {
  throw new Error('meta values should use tabular numbers');
}

if (!html.includes('id="price-change-info"') || !html.includes('id="price-range-info"')) {
  throw new Error('price cards should include metadata containers');
}

if (!html.includes('fixed-price-note') || html.includes('chart-gold-main') || html.includes('实时走势')) {
  throw new Error('fixed-price page should replace the chart section with a note');
}

if (!app.includes('更新') || !app.includes('价差')) {
  throw new Error('price metadata should render update time and spread values');
}

console.log('fixed-price meta layout aligns labels and numbers in stable columns');
