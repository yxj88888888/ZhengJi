const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'chart.js'), 'utf8');
const sandbox = {
  window: { addEventListener() {} },
  console,
  echarts: {
    init() {
      return {
        setOption(option) {
          sandbox.__option = option;
        },
        dispose() {},
        resize() {},
      };
    },
  },
};

vm.runInNewContext(
  source + `
    const dom = {};
    initGoldMainChart(dom);
    globalThis.__annotations = buildCurrentPriceAnnotations([[1000, 990.12], [2000, 991.27]]);
  `,
  sandbox
);

const option = sandbox.__option;
if (!option) {
  throw new Error('Expected chart initialization to set an ECharts option');
}

if (option.backgroundColor !== '#10141c') {
  throw new Error('Expected a darker terminal-style chart background');
}

const tooltipPointer = option.tooltip.axisPointer || {};
if (tooltipPointer.type !== 'line' || tooltipPointer.lineStyle?.opacity > 0.45) {
  throw new Error('Expected a subtle terminal-style vertical guide instead of a strong crosshair');
}

const xSplitLine = option.xAxis.splitLine;
if (!xSplitLine?.show || xSplitLine.lineStyle?.type !== 'dotted') {
  throw new Error('Expected subtle dotted vertical grid lines');
}

const ySplitLine = option.yAxis.splitLine;
if (ySplitLine.lineStyle?.type !== 'dotted') {
  throw new Error('Expected subtle dotted horizontal grid lines');
}

const series = option.series[0];
if (series.smooth !== false) {
  throw new Error('Expected Bloomberg/Reuters-style unsmoothed price movement');
}

if (series.lineStyle.width < 1.8 || series.lineStyle.color !== '#ff525d') {
  throw new Error('Expected a high-contrast terminal red price line');
}

if (!series.emphasis?.lineStyle || series.emphasis.lineStyle.width < 2.6) {
  throw new Error('Expected hover emphasis to keep the price line legible');
}

const annotations = sandbox.__annotations;
if (annotations.markPoint.label.backgroundColor !== '#ffd84d') {
  throw new Error('Expected current price label to use Bloomberg-like yellow emphasis');
}

if (annotations.markLine.lineStyle.width < 1.2 || annotations.markLine.label.show !== false) {
  throw new Error('Expected current price line emphasis without a duplicate label');
}

console.log('terminal chart style uses high-contrast market-screen styling');
