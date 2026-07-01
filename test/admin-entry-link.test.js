const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');

if (!html.includes('id="admin-entry-link"') ||
    !html.includes('href="/gold-api/admin"') ||
    !html.includes('后台入口')) {
  throw new Error('Gold price page should include an admin entry button');
}

if (!html.includes('eo_token') ||
    !html.includes('eo_time') ||
    !html.includes('adminEntry.href')) {
  throw new Error('Admin entry should preserve EdgeOne preview parameters when present');
}

if (!css.includes('.admin-entry-link') ||
    !css.includes('position: fixed') ||
    !css.includes('z-index: 180')) {
  throw new Error('Admin entry should be styled as a stable floating button');
}

console.log('gold page includes a floating admin entry link');
