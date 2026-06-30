const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

function extractKeyframes(name) {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start === -1) throw new Error(`Missing @keyframes ${name}`);

  const rest = css.slice(start);
  const nextKeyframes = rest.indexOf('@keyframes', 1);
  const nextClass = rest.indexOf('.price-tick', 1);
  const endCandidates = [nextKeyframes, nextClass].filter(index => index > 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : rest.length;
  return rest.slice(0, end);
}

function assertTickerAnimation(name, direction) {
  const block = extractKeyframes(name);

  if (/brightness\s*\(/.test(block)) {
    throw new Error(`${name} should not change brightness`);
  }
  if (/text-shadow\s*:/.test(block)) {
    throw new Error(`${name} should not add glow`);
  }
  if (/scale\s*\(/.test(block)) {
    throw new Error(`${name} should not enlarge the number`);
  }
  if (!new RegExp(`translateY\\(${direction === 'up' ? '' : '-'}[0-9]+px\\)`).test(block)) {
    throw new Error(`${name} should slide from the ${direction === 'up' ? 'bottom' : 'top'}`);
  }
  if (!/opacity\s*:\s*0/.test(block) || !/opacity\s*:\s*1/.test(block)) {
    throw new Error(`${name} should use a subtle fade-in`);
  }
}

assertTickerAnimation('priceTickUp', 'up');
assertTickerAnimation('priceTickDown', 'down');

if (!css.includes('.price-tick-up') || !css.includes('.price-tick-down')) {
  throw new Error('Expected directional ticker classes');
}
if (css.includes('borderGlow') || app.includes('borderGlow')) {
  throw new Error('Ticker animation should not flash the card border');
}
if (!app.includes('price-tick-up') || !app.includes('price-tick-down')) {
  throw new Error('Expected price updates to choose a ticker direction');
}

console.log('price changes use directional ticker animation without glow or scale');
