const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');

if (!html.includes('id="silver-sale-price"') ||
    !html.includes('id="silver-buyback-price"') ||
    !html.includes('今日银价') ||
    !html.includes('回购银价')) {
  throw new Error('Price panel should include right-side silver price cells');
}

const comboRule = css.match(/\.price-combo-card\s*\{([^}]*)\}/m);
if (!comboRule ||
    !/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/.test(comboRule[1]) ||
    !/grid-template-rows:\s*repeat\(2,\s*minmax\(132px,\s*auto\)\)/.test(comboRule[1]) ||
    !/position:\s*relative/.test(comboRule[1])) {
  throw new Error('Price panel should be a two-by-two grid');
}

if (!/\.price-combo-card::before[\s\S]*top:\s*50%[\s\S]*height:\s*3px/.test(css) ||
    !/\.price-combo-card::after[\s\S]*left:\s*50%[\s\S]*width:\s*3px/.test(css) ||
    !/rgba\(240,\s*208,\s*96,\s*0\.98\)/.test(css)) {
  throw new Error('Price panel should use prominent gold center dividers');
}

if (!/\.sale-card\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*1/.test(css) ||
    !/\.buyback-card\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*2/.test(css) ||
    !/\.silver-sale-card\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1/.test(css) ||
    !/\.silver-buyback-card\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*2/.test(css)) {
  throw new Error('Gold and silver cells should occupy the expected four-grid positions');
}

if (!/\.price-value\s*\{[\s\S]*font-size:\s*clamp\(56px,\s*5\.4vw,\s*76px\)/.test(css) ||
    !/\.price-unit\s*\{[\s\S]*font-size:\s*clamp\(18px,\s*1\.8vw,\s*24px\)/.test(css) ||
    !/\.price-value-wrap\s*\{[\s\S]*gap:\s*5px/.test(css)) {
  throw new Error('Price text should be compact enough for the left cells');
}

if (!/\.sale-card\s*\{[\s\S]*padding-right:\s*clamp\(18px,\s*2\.2vw,\s*34px\)/.test(css) ||
    !/\.buyback-card\s*\{[\s\S]*padding-right:\s*clamp\(18px,\s*2\.2vw,\s*34px\)/.test(css)) {
  throw new Error('Left price cells should reserve space before the gold center divider');
}

if (!/\.silver-sale-card \.price-label\s*\{[\s\S]*color:\s*#ffe1e1/.test(css) ||
    !/\.silver-sale-card \.price-label::before\s*\{[\s\S]*background:\s*var\(--red-price\)/.test(css) ||
    !/\.silver-sale-card \.price-value\s*\{[\s\S]*color:\s*var\(--red-price\)/.test(css) ||
    !/\.silver-buyback-card \.price-label\s*\{[\s\S]*color:\s*#d8ffed/.test(css) ||
    !/\.silver-buyback-card \.price-label::before\s*\{[\s\S]*background:\s*var\(--green-down\)/.test(css) ||
    !/\.silver-buyback-card \.price-value\s*\{[\s\S]*color:\s*var\(--green-down\)/.test(css)) {
  throw new Error('Silver price cells should use the same colors as matching gold price cells');
}

const portraitMarker = '@media (orientation: portrait) and (min-width: 520px) and (max-aspect-ratio: 3/4)';
const portraitStart = css.indexOf(portraitMarker);
const portraitNext = css.indexOf('\n@media', portraitStart + portraitMarker.length);
const portraitBlock = css.slice(portraitStart, portraitNext === -1 ? css.length : portraitNext);
if (!/\.price-value\s*\{[\s\S]*font-size:\s*clamp\(42px,\s*8\.4vw,\s*68px\)/.test(portraitBlock) ||
    !/\.price-unit\s*\{[\s\S]*font-size:\s*clamp\(14px,\s*2\.55vw,\s*20px\)/.test(portraitBlock) ||
    !/\.price-label\s*\{[\s\S]*font-size:\s*clamp\(23px,\s*3\.85vw,\s*34px\)/.test(portraitBlock)) {
  throw new Error('Portrait price text and units should fit fully inside the left grid cells');
}
if (!/grid-template-rows:\s*repeat\(2,\s*minmax\(151px,\s*auto\)\)/.test(portraitBlock)) {
  throw new Error('Portrait price grid should be enlarged by about 30 percent');
}

console.log('price panel uses a gold-divided four-grid layout with silver prices');
