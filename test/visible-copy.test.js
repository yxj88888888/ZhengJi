const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const edgeFunction = fs.readFileSync(
  path.join(root, 'edge-functions', 'gold-api', '[[default]].js'),
  'utf8'
);
const renderedEdgeFunction = edgeFunction.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
  String.fromCharCode(parseInt(code, 16))
);

const visibleSources = [html, app, renderedEdgeFunction].join('\n');
const mojibakeMarkers = [
  '濞寸姴锕ュΛ',
  '闁搞儳鍋犻崰',
  '閻庡湱鍋炲',
  '閻犙勬緲婵?',
  '鐎殿喒鍋?',
  '婵炴垯鍔忕粚',
  '闂佸弶鍨抽悳',
  '缂侇喓鍊濋幊',
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

const expectedAdminCopy = [
  '西部郑记金价后台',
  '登录后台',
  '保存金价',
  '最高权限账号：18189182920',
  '设置手机号权限',
  '当前账号',
  '职位',
  '权限',
  '店长',
  '管理员',
];

for (const text of expectedAdminCopy) {
  if (!renderedEdgeFunction.includes(text)) {
    throw new Error(`Missing expected admin copy: ${text}`);
  }
}

if (renderedEdgeFunction.includes('data-tab="bind"')) {
  throw new Error('Admin phone setup should not be visible as a pre-login tab');
}

console.log('visible Chinese copy matches the fixed-price gold page');
