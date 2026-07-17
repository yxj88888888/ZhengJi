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
if (!headerTime || !/font-size\s*:\s*clamp\(24px,\s*3\.1vw,\s*40px\)/.test(headerTime[1])) {
  throw new Error('Header date-time should use the responsive desktop type scale');
}
if (!/text-align\s*:\s*center/.test(headerTime[1]) ||
    !/align-self\s*:\s*center/.test(headerTime[1])) {
  throw new Error('Header date-time should stay centered below the YueXin logo');
}

const wideTimeMarker = '@media (orientation: portrait) and (min-width: 620px) and (max-width: 760px) and (max-height: 1039px) and (max-aspect-ratio: 3/4)';
const wideTimeStart = css.indexOf(wideTimeMarker);
if (wideTimeStart === -1) throw new Error('Missing wide portrait date-time rule');
const wideTimeNext = css.indexOf('\n@media', wideTimeStart + wideTimeMarker.length);
const wideTimeBlock = css.slice(wideTimeStart, wideTimeNext === -1 ? css.length : wideTimeNext);
if (!/grid-template-areas:\s*[\s\S]*"qr logo"[\s\S]*"qr time"[\s\S]*"address address"/.test(wideTimeBlock) ||
    !/\.header-time\s*\{[\s\S]*justify-self:\s*center[\s\S]*align-self:\s*start[\s\S]*width:\s*fit-content[\s\S]*max-width:\s*100%[\s\S]*padding:\s*0[\s\S]*border:\s*0[\s\S]*border-radius:\s*1000px[\s\S]*background:\s*transparent[\s\S]*font-size:\s*clamp\(30px,\s*5vw,\s*33\.28px\)/.test(wideTimeBlock)) {
  throw new Error('Wide portrait date-time should sit directly below the logo at its intrinsic width');
}

console.log('header date-time omits year and stays enlarged below the centered logo');
