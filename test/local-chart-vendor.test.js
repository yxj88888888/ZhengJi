const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const vendorPath = path.join(__dirname, '..', 'public', 'vendor', 'echarts.min.js');

if (!html.includes('vendor/echarts.min.js?v=5.4.3')) {
  throw new Error('Expected the dashboard to load ECharts from a local vendor file');
}

if (html.includes('cdn.jsdelivr.net/npm/echarts')) {
  throw new Error('Expected the dashboard not to depend on the jsDelivr ECharts CDN');
}

if (!fs.existsSync(vendorPath)) {
  throw new Error('Expected local ECharts vendor file to exist');
}

const vendorSource = fs.readFileSync(vendorPath, 'utf8');
if (!vendorSource.includes('Apache License') && vendorSource.length < 500000) {
  throw new Error('Expected local ECharts vendor file to contain the bundled library');
}

console.log('dashboard loads ECharts from a local vendor file');
