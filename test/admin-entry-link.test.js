const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');

if (!html.includes('id="admin-entry-link"') ||
    !html.includes('href="/gold-api/admin"') ||
    !html.includes('class="admin-entry-arrow"') ||
    !html.includes('class="admin-entry-logo"') ||
    !html.includes('images/store/logo.jpg')) {
  throw new Error('Gold price page should include a logo admin entry button');
}

if (!html.includes('eo_token') ||
    !html.includes('eo_time') ||
    !html.includes('adminEntry.href')) {
  throw new Error('Admin entry should preserve EdgeOne preview parameters when present');
}

if (!html.includes('admin-entry-open') ||
    !html.includes("matchMedia('(hover: none)'") ||
    !html.includes('event.preventDefault()') ||
    !html.includes("adminArrow.addEventListener('pointerenter'") ||
    !html.includes("document.addEventListener('pointermove'") ||
    !html.includes("addEventListener('pointerenter'") ||
    !html.includes("addEventListener('pointerdown'") ||
    !html.includes("addEventListener('pointermove'") ||
    !html.includes("addEventListener('pointerup'") ||
    !html.includes("addEventListener('mouseup'") ||
    !html.includes('isPointerInsideIcon(event)') ||
    !html.includes('if (!isPointerInsideIcon(event)) return') ||
    !html.includes('isPointerInsideArrow(event)') ||
    !html.includes('window.location.href = adminEntry.href') ||
    !html.includes('if (!didDrag)') ||
    !html.includes('adminEntry.dataset.visibleLeft') ||
    !html.includes('renderedLeft = window.innerWidth') ||
    !html.includes('-width - 24') ||
    !html.includes('zhengji-admin-entry-position')) {
  throw new Error('Admin entry should reveal from the arrow and only drag from the visible icon');
}

if (!css.includes('.admin-entry-link') ||
    !css.includes('position: fixed') ||
    !css.includes('z-index: 180') ||
    !css.includes('border-radius: 50%') ||
    !css.includes('.admin-entry-logo') ||
    !css.includes('.admin-entry-arrow') ||
    !css.includes('.admin-entry-arrow::before') ||
    !css.includes('.admin-entry-link:has(.admin-entry-arrow:hover)') ||
    !css.includes('touch-action: none') ||
    !css.includes('.admin-entry-link.admin-entry-docked-right') ||
    !css.includes('.admin-entry-link.admin-entry-docked-left') ||
    !css.includes('.admin-entry-link.admin-entry-dragging') ||
    !css.includes('.admin-entry-link.admin-entry-open') ||
    !css.includes('.admin-entry-link.admin-entry-dragging .admin-entry-logo') ||
    !css.includes('pointer-events: none') ||
    !css.includes('cursor: pointer') ||
    !css.includes('cursor: grabbing')) {
  throw new Error('Admin entry should be styled as a draggable fully-hidden edge drawer with a pull arrow');
}

const logoRule = css.match(/\.admin-entry-logo\s*\{([^}]*)\}/m);
if (!logoRule || /cursor:\s*grab/.test(logoRule[1])) {
  throw new Error('Admin entry logo hover cursor should not look draggable before pressing');
}

console.log('gold page includes a draggable fully-hidden drawer admin entry link');
