const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

if (!html.includes('css/style.css?v=admin-entry-20260701')) {
  throw new Error('Expected stylesheet URL to be versioned so price-meta layout changes refresh in the browser');
}

if (!html.includes('js/app.js?v=fixed-price-no-meta-20260630')) {
  throw new Error('Expected local scripts to keep cache-busting versions');
}

if (html.includes('vendor/echarts.min.js') || html.includes('js/chart.js')) {
  throw new Error('Fixed-price page should not load chart assets');
}

console.log('local assets use explicit cache-busting versions');
