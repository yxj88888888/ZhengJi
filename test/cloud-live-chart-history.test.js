const fs = require('fs');
const path = require('path');
const vm = require('vm');

const chartSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'chart.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8')
  .replace(/\(async function bootstrap\(\) \{[\s\S]*?\}\)\(\);\s*$/, '');
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

(async () => {
  const RealDate = Date;
  let nowTick = new RealDate(2026, 5, 17, 18, 30, 1).getTime();
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate(FixedDate.now());
      return new RealDate(...args);
    }

    static now() {
      nowTick += 1000;
      return nowTick;
    }
  }
  FixedDate.parse = RealDate.parse;
  FixedDate.UTC = RealDate.UTC;

  const today = new RealDate(2026, 5, 17, 18, 30, 1);
  const historyTimestamp = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    18,
    30,
    1
  ).getTime();

  const context = {
    ...sandbox,
    __setOptions: setOptions,
    __historyTimestamp: historyTimestamp,
    Date: FixedDate,
    setTimeout,
  };
  context.fetch = (...args) => context.__fetchImpl(...args);

  vm.runInNewContext(
    chartSource + '\n' + appSource + `
      globalThis.__runTest = async () => {
        initAllCharts();
        currentRange = 'today';

        let currentCalls = 0;
        globalThis.__fetchImpl = async url => {
          if (String(url).startsWith('/gold-api/gold/current')) {
            currentCalls += 1;
            return {
              json: async () => ({
                code: 1,
                data: {
                  sale_price: '959.77',
                  buyback_price: '928.86',
                  update_time: '2026-06-17 18:30:0' + currentCalls,
                },
              }),
            };
          }

          return {
            json: async () => ({
              code: 1,
              data: [{
                time: '18:30',
                sale_price: 959.77,
                buyback_price: 928.86,
                timestamp: globalThis.__historyTimestamp,
              }],
            }),
          };
        };

        await fetchGoldCurrent();
        await new Promise(resolve => setTimeout(resolve, 5));
        await fetchGoldCurrent();
        const afterCurrent = goldHistory.length;

        await fetchGoldHistory();
        const lastOption = globalThis.__setOptions[globalThis.__setOptions.length - 1];
        globalThis.__result = {
          afterCurrent,
          afterHistory: goldHistory.length,
          seriesPoints: lastOption.series[0].data.length,
          firstTimestamp: lastOption.series[0].data[0][0],
          lastTimestamp: lastOption.series[0].data[lastOption.series[0].data.length - 1][0],
        };
      };
    `,
    context
  );

  await context.__runTest();
  const result = context.__result;
  if (!result || result.afterCurrent < 2) {
    throw new Error('Expected current-price polling to build at least two live chart points');
  }
  if (result.afterHistory < 2 || result.seriesPoints < 2) {
    throw new Error('Expected one-point cloud history responses to merge without erasing live chart points');
  }
  if (!(result.lastTimestamp > result.firstTimestamp)) {
    throw new Error('Expected live chart points to have increasing timestamps for a visible line');
  }

  console.log('cloud live chart keeps client-side price history for line rendering');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
