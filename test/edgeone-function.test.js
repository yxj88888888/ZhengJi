const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.join(__dirname, '..');
const functionPath = path.join(
  projectRoot,
  'edge-functions',
  'gold-api',
  '[[default]].js'
);
const configPath = path.join(projectRoot, 'edgeone.json');

if (!fs.existsSync(functionPath)) {
  throw new Error('Expected an EdgeOne catch-all Edge Function');
}

if (!fs.existsSync(configPath)) {
  throw new Error('Expected an EdgeOne deployment configuration');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.outputDirectory !== 'public') {
  throw new Error('Expected EdgeOne to publish the public directory');
}

(async () => {
  const moduleUrl = pathToFileURL(functionPath).href + `?t=${Date.now()}`;
  const edgeFunction = await import(moduleUrl);

  const source = {
    sale_price: '950.00',
    buyback_price: '930.00',
    update_time: '2026-06-15 16:00:00',
  };

  const weekday = edgeFunction.applyDisplayPriceRule(
    source,
    new Date('2026-06-15T16:00:00+08:00')
  );
  const weekend = edgeFunction.applyDisplayPriceRule(
    source,
    new Date('2026-06-14T16:00:00+08:00')
  );

  if (weekday.sale_price !== 955 || weekday.buyback_price !== 930) {
    throw new Error('Expected EdgeOne weekday pricing to apply the +5 markup');
  }
  if (weekend.sale_price !== 950 || weekend.buyback_price !== 930) {
    throw new Error('Expected EdgeOne weekend pricing to use source values');
  }

  const response = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/gold/current'),
    {
      now: () => new Date('2026-06-15T16:00:00+08:00'),
      fetchPrice: async () => source,
    }
  );
  const payload = await response.json();

  if (response.status !== 200 || payload.code !== 1) {
    throw new Error('Expected the EdgeOne current price API to succeed');
  }
  if (payload.data.sale_price !== '955.00') {
    throw new Error('Expected the EdgeOne API to return the display price');
  }

  const historyResponse = await edgeFunction.handleApiRequest(
    new Request('https://example.com/gold-api/gold/history?range=today'),
    {
      now: () => new Date('2026-06-15T16:00:10+08:00'),
      fetchPrice: async () => source,
    }
  );
  const historyPayload = await historyResponse.json();
  const points = historyPayload.data;

  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('Expected cloud history to include a 10:00 baseline and current point');
  }
  if (points[0].time !== '2026-06-15 10:00:00' || points[0].synthetic_start !== true) {
    throw new Error('Expected cloud history to start from the 10:00 baseline');
  }
  if (new Date(points[0].timestamp).getHours() !== 10) {
    throw new Error('Expected the first cloud history point timestamp to be 10:00 local time');
  }
  if (Number(points[0].sale_price) !== 955) {
    throw new Error('Expected the cloud opening price to use the 10:00 display price');
  }

  const sharedKv = {
    values: new Map(),
    async get(key, options) {
      const value = this.values.get(key) || null;
      return options && options.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) {
      this.values.set(key, value);
    },
  };
  const openingModule = await import(pathToFileURL(functionPath).href + `?opening=${Date.now()}`);
  await openingModule.handleApiRequest(
    new Request('https://example.com/gold-api/gold/current'),
    {
      now: () => new Date('2026-06-15T10:00:00+08:00'),
      fetchPrice: async () => ({
        sale_price: '950.00',
        buyback_price: '930.00',
        update_time: '2026-06-15 10:00:00',
      }),
      kv: sharedKv,
    }
  );

  const laterModule = await import(pathToFileURL(functionPath).href + `?later=${Date.now()}`);
  await laterModule.handleApiRequest(
    new Request('https://example.com/gold-api/gold/current'),
    {
      now: () => new Date('2026-06-15T16:10:00+08:00'),
      fetchPrice: async () => ({
        sale_price: '960.00',
        buyback_price: '935.00',
        update_time: '2026-06-15 16:10:00',
      }),
      kv: sharedKv,
    }
  );
  const laterHistoryResponse = await laterModule.handleApiRequest(
    new Request('https://example.com/gold-api/gold/history?range=today'),
    {
      now: () => new Date('2026-06-15T16:10:00+08:00'),
      fetchPrice: async () => ({
        sale_price: '960.00',
        buyback_price: '935.00',
        update_time: '2026-06-15 16:10:00',
      }),
      kv: sharedKv,
    }
  );
  const laterHistoryPayload = await laterHistoryResponse.json();
  const laterPoints = laterHistoryPayload.data;
  if (Number(laterPoints[0].sale_price) !== 950) {
    throw new Error('Expected the cloud opening price to stay fixed across cold starts and visitors');
  }
  if (Number(laterPoints[laterPoints.length - 1].sale_price) !== 965) {
    throw new Error('Expected the later cloud visitor to still see the current display price');
  }

  const preOpenKv = {
    values: new Map([
      ['zhengji_gold_20260615', JSON.stringify({
        date: '2026-06-15',
        history: [
          {
            time: '2026-06-15 09:30:00',
            sale_price: 949,
            buyback_price: 929,
            timestamp: Date.parse('2026-06-15T09:30:00+08:00'),
          },
          {
            time: '2026-06-15 10:05:00',
            sale_price: 951,
            buyback_price: 931,
            timestamp: Date.parse('2026-06-15T10:05:00+08:00'),
          },
        ],
      })],
    ]),
    async get(key, options) {
      const value = this.values.get(key) || null;
      return options && options.type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) {
      this.values.set(key, value);
    },
  };
  const preOpenModule = await import(pathToFileURL(functionPath).href + `?preopen=${Date.now()}`);
  const preOpenHistoryResponse = await preOpenModule.handleApiRequest(
    new Request('https://example.com/gold-api/gold/history?range=today'),
    {
      now: () => new Date('2026-06-15T16:20:00+08:00'),
      fetchPrice: async () => ({
        sale_price: '960.00',
        buyback_price: '935.00',
        update_time: '2026-06-15 16:20:00',
      }),
      kv: preOpenKv,
    }
  );
  const preOpenHistoryPayload = await preOpenHistoryResponse.json();
  const preOpenPoints = preOpenHistoryPayload.data;
  const tenOClockPoint = preOpenPoints.find(point => point.time === '2026-06-15 10:00:00');
  if (!tenOClockPoint || tenOClockPoint.synthetic_start !== true) {
    throw new Error('Expected cloud history to backfill 10:00 even when older pre-open points exist');
  }
  if (Number(tenOClockPoint.sale_price) !== 951) {
    throw new Error('Expected backfilled 10:00 opening price to use the first price after 10:00');
  }

  console.log('EdgeOne function preserves pricing rules and API shape');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

