const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

if (!html.includes('css/style.css?v=high-low-align-20260619')) {
  throw new Error('Expected stylesheet URL to be versioned so price-meta layout changes refresh in the browser');
}

if (!html.includes('js/chart.js?v=single-price-label-20260610') || !html.includes('js/app.js?v=full-day-chart-20260622')) {
  throw new Error('Expected local scripts to keep cache-busting versions');
}

console.log('local assets use explicit cache-busting versions');
