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

const priceRow = ruleFor('.price-row');
if (!/position\s*:\s*relative/.test(priceRow)) {
  throw new Error('price row should provide the positioning context for top-right metadata');
}

const priceMeta = ruleFor('.price-meta');
if (!/position\s*:\s*absolute/.test(priceMeta) ||
    !/top\s*:\s*0/.test(priceMeta) ||
    !/right\s*:\s*0/.test(priceMeta)) {
  throw new Error('price metadata should sit at the top-right corner of the sale card');
}

const priceRangeMeta = ruleFor('.price-range-meta');
if (!/top\s*:\s*0/.test(priceRangeMeta) || !/font-size\s*:\s*inherit/.test(priceRangeMeta)) {
  throw new Error('high/low metadata should align with the top metadata and inherit the same font size');
}

const priceRangeChange = ruleFor('.price-range-meta .price-change');
if (!/font-size\s*:\s*inherit/.test(priceRangeChange) || !/row-gap\s*:\s*4px/.test(priceRangeChange)) {
  throw new Error('high/low rows should keep the same compact rhythm as open/change rows');
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

const changeValue = ruleFor('.change-value');
if (!/display\s*:\s*flex/.test(changeValue) || !/flex-direction\s*:\s*column/.test(changeValue)) {
  throw new Error('change value and percent should stack in the numeric column');
}
if (!/align-items\s*:\s*flex-end/.test(changeValue)) {
  throw new Error('change value should align to the right edge of the numeric column');
}

const indicatorValue = ruleFor('.indicator-value');
if (!/font-size\s*:\s*1\.18em/.test(indicatorValue)) {
  throw new Error('change amount should be enlarged independently from the percent');
}
if (!/line-height\s*:\s*1/.test(indicatorValue)) {
  throw new Error('change amount should use a tight line-height for visual alignment');
}

if (!html.includes('id="price-range-info"')) {
  throw new Error('buyback card should include a right-aligned high/low metadata container');
}

if (!app.includes('最高') || !app.includes('最低')) {
  throw new Error('price metadata should render today high and low values');
}

if (!app.includes('class="meta-label"') || !app.includes('class="meta-value"') || !app.includes('class="meta-value change-value"')) {
  throw new Error('price-change markup should separate labels and numeric values');
}

console.log('price meta layout aligns labels and numbers in stable columns');
