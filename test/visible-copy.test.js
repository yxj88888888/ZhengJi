const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const chart = fs.readFileSync(path.join(root, 'public', 'js', 'chart.js'), 'utf8');

const visibleSources = [html, app, chart].join('\n');
const mojibakeMarkers = [
  '浠婃棩',
  '鍥炶喘',
  '瀹炴椂',
  '璧板娍',
  '鍏?',
  '寮€',
  '娑ㄨ穼',
  '閲戜环',
  '鏃?',
  '骞?',
  '鏈?',
  '鏄熸湡',
  '绮ら懌',
];

for (const marker of mojibakeMarkers) {
  if (visibleSources.includes(marker)) {
    throw new Error(`Visible source still contains mojibake marker: ${marker}`);
  }
}

const expectedHtmlCopy = [
  '今日金价',
  '回购金价',
  '元/克',
  '实时走势',
  '粤鑫金',
  '实时贵金属行情',
];

for (const text of expectedHtmlCopy) {
  if (!html.includes(text)) throw new Error(`Missing expected HTML copy: ${text}`);
}

for (const text of ['开盘', '涨跌', '获取金价历史失败']) {
  if (!app.includes(text)) throw new Error(`Missing expected app copy: ${text}`);
}

if (!chart.includes("name: '金价'")) {
  throw new Error('Expected chart series name to be readable Chinese');
}

console.log('visible Chinese copy is readable and mojibake-free');
