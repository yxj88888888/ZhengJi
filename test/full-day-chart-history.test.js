const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chartSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'chart.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const setOptions = [];
const elements = new Map();

function elementFor(id) {
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
  document: {
    getElementById: elementFor,
  },
  console,
  setInterval() {},
  fetch: async () => ({ json: async () => ({ code: 0, data: [] }) }),
  echarts: {
    init() {
      return {
        setOption(option) { setOptions.push(option); },
        dispose() {},
        resize() {},
      };
    },
  },
};

const testScript = `
  const start = new Date(2026, 5, 22, 10, 0, 0, 0).getTime();
  const end = new Date(2026, 5, 22, 20, 0, 0, 0).getTime();
  const step = Math.floor((end - start) / 7200);
  const points = Array.from({ length: 7201 }, (_, index) => {
    const timestamp = start + index * step;
    return {
      timestamp,
      time: new Date(timestamp).toLocaleString('zh-CN', { hour12: false }),
      sale_price: 930 + Math.sin(index / 90),
      buyback_price: 900,
    };
  });

  currentRange = 'today';
  mergeGoldHistoryPoints(points);
  updateMainChart();

  globalThis.__historyLength = goldHistory.length;
  globalThis.__firstVisibleTime = goldHistory[0].timestamp;
  globalThis.__chartDataset = document.getElementById('chart-gold-main').dataset;
`;

vm.runInNewContext(chartSource + '\n' + appSource + testScript, sandbox);

if (sandbox.__historyLength < 7201) {
  throw new Error(`Expected full 10:00-20:00 history to be retained, got ${sandbox.__historyLength} points`);
}

const firstVisible = new Date(sandbox.__firstVisibleTime);
if (firstVisible.getHours() !== 10 || firstVisible.getMinutes() !== 0) {
  throw new Error('Expected retained history to start at 10:00, not a later truncated segment');
}

if (sandbox.__chartDataset.xMinTime !== '10:00' || sandbox.__chartDataset.xMaxTime !== '20:00') {
  throw new Error(`Expected chart axis diagnostics to stay 10:00-20:00, got ${sandbox.__chartDataset.xMinTime}-${sandbox.__chartDataset.xMaxTime}`);
}

if (Number(sandbox.__chartDataset.pointCount) < 7201) {
  throw new Error(`Expected chart to render the full visible history, got ${sandbox.__chartDataset.pointCount} points`);
}

console.log('full-day chart history keeps the complete 10:00-20:00 line');
