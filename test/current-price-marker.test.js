const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'chart.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const sandbox = {
  window: { addEventListener() {} },
  console,
};

vm.runInNewContext(
  source + `
    globalThis.__annotations = buildCurrentPriceAnnotations([[1000, 990.12], [2000, 991.27]]);
    globalThis.__emptyAnnotations = buildCurrentPriceAnnotations([]);
  `,
  sandbox
);

const annotations = sandbox.__annotations;
if (!annotations || !annotations.markPoint || !annotations.markLine) {
  throw new Error('Expected current price annotations to include markPoint and markLine');
}

const point = annotations.markPoint.data[0];
if (!point || point.name !== 'current-price') {
  throw new Error('Expected a named current-price mark point');
}

if (point.coord[0] !== 2000 || point.coord[1] !== 991.27) {
  throw new Error('Expected current-price mark point to use the latest visible price point');
}

if (point.value !== '991.27') {
  throw new Error('Expected current-price mark point label value to be formatted to two decimals');
}

if (annotations.markPoint.label.position !== 'bottom') {
  throw new Error('Expected the only current-price label to appear below the line');
}

const line = annotations.markLine.data[0];
if (!line || line.yAxis !== 991.27) {
  throw new Error('Expected current-price mark line to track the latest price');
}

if (annotations.markLine.label.show !== false) {
  throw new Error('Expected the current-price line label to stay hidden so only one price label is shown');
}

if (sandbox.__emptyAnnotations.markPoint.data.length !== 0 || sandbox.__emptyAnnotations.markLine.data.length !== 0) {
  throw new Error('Expected empty chart data to clear current-price annotations');
}

if (/type:\s*['"]min['"]/.test(source)) {
  throw new Error('The old minimum-price marker should not remain as the primary chart marker');
}

if (!appSource.includes('buildCurrentPriceAnnotations(pricePoints)')) {
  throw new Error('Expected chart updates to refresh current-price annotations with the latest visible data');
}

console.log('current price marker annotations target the latest visible price');
