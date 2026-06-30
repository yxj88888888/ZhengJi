const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chartSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'chart.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const setOptions = [];
const elements = new Map();

function getElement(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      textContent: '',
      innerHTML: '',
      dataset: {},
      classList: { remove() {}, add() {} },
      offsetWidth: 0,
    });
  }
  return elements.get(id);
}

const sandbox = {
  window: { addEventListener() {} },
  document: { getElementById: getElement },
  console,
  setInterval() {},
  fetch: async () => ({ json: async () => ({ code: 0, data: [] }) }),
  echarts: {
    init() {
      return {
        setOption(option) {
          setOptions.push(option);
        },
        dispose() {},
        resize() {},
      };
    },
  },
};

vm.runInNewContext(
  chartSource + '\n' + appSource + `
    goldHistory = [
      { timestamp: new Date(2026, 5, 5, 17, 20).getTime(), sale_price: 991.27, buyback_price: 963.1 },
      { timestamp: new Date(2026, 5, 5, 17, 21).getTime(), sale_price: 991.39, buyback_price: 963.2 },
    ];
    currentRange = 'today';
    updateMainChart();
  `,
  sandbox
);

const updateOption = setOptions[setOptions.length - 1];
const updateSeries = updateOption?.series?.[0];
if (!updateSeries) {
  throw new Error('Expected chart update to set a series option');
}

if (updateSeries.smooth !== false) {
  throw new Error('Expected live chart updates to keep the terminal-style unsmoothed line');
}

if (updateSeries.lineStyle?.width < 1.8 || updateSeries.lineStyle?.color !== '#ff525d') {
  throw new Error('Expected live chart updates to keep the high-contrast red line');
}

if (!updateSeries.areaStyle) {
  throw new Error('Expected live chart updates to keep the subtle terminal area fill');
}

if (!updateSeries.emphasis?.lineStyle || updateSeries.emphasis.lineStyle.width < 2.6) {
  throw new Error('Expected live chart updates to keep hover emphasis');
}

if (!updateSeries.markPoint?.data?.[0] || !updateSeries.markLine?.data?.[0]) {
  throw new Error('Expected live chart updates to keep current-price annotations');
}
if (updateSeries.markPoint.label?.position !== 'bottom' || updateSeries.markLine.label?.show !== false) {
  throw new Error('Expected live chart updates to show one current-price label below the line');
}

console.log('live chart updates preserve terminal chart styling');
