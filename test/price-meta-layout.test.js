const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

if (html.includes('id="price-change-info"') || html.includes('id="price-range-info"')) {
  throw new Error('price cards should not include right-side metadata containers');
}

if (html.includes('price-meta') || css.includes('.price-meta') || css.includes('.price-change')) {
  throw new Error('fixed-price page should not render update/spread metadata styles');
}

if (app.includes('更新') || app.includes('价差') || app.includes('price-change-info') || app.includes('price-range-info')) {
  throw new Error('fixed-price script should not render update time or spread copy');
}

if (!html.includes('fixed-price-note') || html.includes('chart-gold-main') || html.includes('实时走势')) {
  throw new Error('fixed-price page should replace the chart section with a note');
}

console.log('fixed-price page hides update and spread metadata');
