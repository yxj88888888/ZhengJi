/* ===== ECharts chart management ===== */

const chartTheme = {
  bg: '#10141c',
  text: '#a7b1c2',
  grid: 'rgba(180, 198, 226, 0.13)',
  red: '#ff525d',
  gold: '#ffd84d',
};

function formatTooltipTime(value) {
  const d = new Date(value);
  return d.getHours().toString().padStart(2, '0') + ':' +
         d.getMinutes().toString().padStart(2, '0');
}

function commonTooltip() {
  return {
    backgroundColor: 'rgba(14, 18, 27, 0.98)',
    borderColor: 'rgba(255, 216, 77, 0.44)',
    textStyle: { color: '#eef3ff', fontSize: 12 },
    extraCssText: 'border-radius:4px;box-shadow:0 8px 26px rgba(0,0,0,0.55);'
  };
}

let chartGoldMain = null;

function terminalPriceSeriesStyle() {
  return {
    smooth: false,
    symbol: 'none',
    lineStyle: { width: 1.9, color: chartTheme.red, opacity: 0.96 },
    emphasis: {
      focus: 'series',
      lineStyle: { width: 2.8, color: '#ff6771' },
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(255, 82, 93, 0.18)' },
          { offset: 0.74, color: 'rgba(255, 82, 93, 0.035)' },
          { offset: 1, color: 'rgba(255, 82, 93, 0)' },
        ],
      },
    },
  };
}

function buildCurrentPriceAnnotations(pricePoints) {
  const empty = {
    markPoint: { data: [] },
    markLine: { data: [] },
  };
  if (!Array.isArray(pricePoints) || pricePoints.length === 0) return empty;

  const latest = pricePoints[pricePoints.length - 1];
  if (!Array.isArray(latest)) return empty;

  const currentTime = Number(latest[0]);
  const currentPrice = Number(latest[1]);
  if (!Number.isFinite(currentTime) || !Number.isFinite(currentPrice)) return empty;

  const currentText = currentPrice.toFixed(2);
  return {
    markPoint: {
      silent: true,
      symbol: 'circle',
      symbolSize: 9,
      itemStyle: {
        color: chartTheme.gold,
        borderColor: '#ffffff',
        borderWidth: 2,
        shadowBlur: 10,
        shadowColor: 'rgba(255, 216, 77, 0.58)',
      },
      label: {
        show: true,
        color: '#11151f',
        backgroundColor: chartTheme.gold,
        borderColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderRadius: 3,
        padding: [4, 7],
        fontSize: 12,
        fontWeight: 'bold',
        distance: 10,
        position: 'bottom',
        formatter: () => `当前价 ${currentText}`,
      },
      data: [{
        name: 'current-price',
        coord: [currentTime, currentPrice],
        value: currentText,
      }],
    },
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: {
        color: 'rgba(255, 216, 77, 0.7)',
        width: 1.25,
        type: 'dashed',
      },
      label: {
        show: false,
      },
      data: [{ name: 'current-price-line', yAxis: currentPrice }],
    },
  };
}

function initGoldMainChart(dom) {
  if (chartGoldMain) chartGoldMain.dispose();
  chartGoldMain = echarts.init(dom);
  chartGoldMain.setOption({
    backgroundColor: chartTheme.bg,
    tooltip: {
      ...commonTooltip(),
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(220, 230, 246, 0.46)',
          width: 1,
          type: 'dashed',
          opacity: 0.42,
        },
      },
      formatter: params => {
        const item = Array.isArray(params) ? params[0] : params;
        const raw = Array.isArray(item.value) ? item.value : [item.axisValue, item.value];
        const price = Number(raw[1]);
        return `${formatTooltipTime(raw[0])}<br>` +
          `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background:${chartTheme.red};"></span>` +
          `金价 <strong>${Number.isFinite(price) ? price.toFixed(2) : '--'}</strong>`;
      },
    },
    legend: { show: false },
    grid: { left: 20, right: 16, top: 34, bottom: 24, containLabel: true },
    xAxis: {
      type: 'time',
      data: [],
      axisLine: { lineStyle: { color: chartTheme.grid } },
      axisLabel: { color: chartTheme.text, fontSize: 10, margin: 9 },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(180, 198, 226, 0.08)', width: 1, type: 'dotted' },
      },
    },
    yAxis: {
      type: 'value',
      name: '金价',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { color: chartTheme.red, fontSize: 11, fontWeight: 700, align: 'left' },
      axisLine: { show: true, lineStyle: { color: chartTheme.red } },
      axisLabel: { color: chartTheme.text, fontSize: 10, margin: 6 },
      splitLine: { lineStyle: { color: chartTheme.grid, width: 1, type: 'dotted' } },
      scale: true,
      position: 'left',
    },
    series: [
      {
        name: '金价',
        type: 'line',
        data: [],
        ...terminalPriceSeriesStyle(),
        ...buildCurrentPriceAnnotations([]),
      }
    ]
  });
  return chartGoldMain;
}

window.addEventListener('resize', () => {
  chartGoldMain?.resize();
});
