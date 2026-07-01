const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const edgeFunction = fs.readFileSync(
  path.join(root, 'edge-functions', 'gold-api', '[[default]].js'),
  'utf8'
);

const visibleSources = [html, app, edgeFunction].join('\n');
const mojibakeMarkers = [
  '娴犲﹥妫',
  '閸ョ偠鍠',
  '鐎圭偞妞',
  '鐠ф澘濞',
  '瀵偓',
  '濞戙劏绌',
  '闁叉垳鐜',
  '缁倝鎳',
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
  '交易时间 10:00 至 20:00',
  '价格以门店最新调整为准',
  '粤鑫金',
];

for (const text of expectedHtmlCopy) {
  if (!html.includes(text)) throw new Error(`Missing expected HTML copy: ${text}`);
}

if (html.includes('class="logo-subtitle"')) {
  throw new Error('Logo subtitle should be removed from the header');
}

for (const text of ['更新', '价差']) {
  if (app.includes(text) || html.includes(text)) {
    throw new Error(`Removed metadata copy should not be visible: ${text}`);
  }
}

if (!html.includes('交易时间 10:00 至 20:00')) {
  throw new Error('Missing expected trading-hours note copy');
}

for (const text of ['西部郑记金价后台', '绑定手机号', '设置密码', '保存金价']) {
  if (!edgeFunction.includes(text)) {
    throw new Error(`Missing expected admin copy: ${text}`);
  }
}

console.log('visible Chinese copy matches the fixed-price gold page');
