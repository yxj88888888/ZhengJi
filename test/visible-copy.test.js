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
  '固定金价展示',
  '价格以门店最新调整为准',
  '粤鑫金',
  '实时贵金属行情',
];

for (const text of expectedHtmlCopy) {
  if (!html.includes(text)) throw new Error(`Missing expected HTML copy: ${text}`);
}

for (const text of ['更新', '价差', '固定金价展示']) {
  if (!app.includes(text) && !html.includes(text)) {
    throw new Error(`Missing expected fixed-price copy: ${text}`);
  }
}

for (const text of ['西部郑记金价修改', '保存金价', '需要账号密码']) {
  if (!edgeFunction.includes(text)) {
    throw new Error(`Missing expected admin copy: ${text}`);
  }
}

console.log('visible Chinese copy matches the fixed-price gold page');
