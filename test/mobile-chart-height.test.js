const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

const mobileBlock = css.match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}/)?.[1] || '';
if (!/#chart-gold-main\s*\{\s*height:\s*300px\s*;?\s*\}/.test(mobileBlock)) {
  throw new Error('Expected mobile main chart height to shorten to 300px');
}

const tinyBlock = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1] || '';
if (!/#chart-gold-main\s*\{\s*height:\s*280px\s*;?\s*\}/.test(tinyBlock)) {
  throw new Error('Expected narrow phone main chart height to shorten to 280px');
}

console.log('mobile chart height keeps the y-axis visually compact');
