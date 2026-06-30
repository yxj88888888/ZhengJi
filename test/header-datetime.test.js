const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'style.css'), 'utf8');

const formatter = app.match(/function formatHeaderDateTime\(\)\s*\{([\s\S]*?)\n\}/);
if (!formatter) throw new Error('Missing header date-time formatter');
if (formatter[1].includes('getFullYear')) {
  throw new Error('Header date-time should not show the year');
}
if (!/now\.getMonth\(\)\s*\+\s*1\)\s*\+\s*'月'/.test(formatter[1])) {
  throw new Error('Header date-time should begin with month and day');
}

const headerTime = css.match(/\.header-time\s*\{([^}]*)\}/);
if (!headerTime || !/font-size\s*:\s*30px/.test(headerTime[1])) {
  throw new Error('Header date-time should use a 1.5x 30px desktop font');
}
if (!/text-align\s*:\s*center/.test(headerTime[1]) ||
    !/align-self\s*:\s*center/.test(headerTime[1])) {
  throw new Error('Header date-time should stay centered below the YueXin logo');
}

console.log('header date-time omits year and stays enlarged below the centered logo');
