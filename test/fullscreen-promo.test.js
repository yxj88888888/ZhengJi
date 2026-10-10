const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'promo.js'), 'utf8');

function setupImage(complete, naturalWidth) {
  const attributes = { 'aria-hidden': 'true' };
  const pricePage = [{ inert: false }, { inert: false }, { inert: false }];
  const image = { complete, naturalWidth, addEventListener: (event, callback) => { image.onLoad = callback; } };
  const intervals = [];
  let visible = false;
  vm.runInNewContext(script, {
    document: {
      getElementById: (id) => id === 'fullscreen-promo-image' ? image : {
        setAttribute: (name, value) => { attributes[name] = value; },
      },
      querySelectorAll: () => pricePage,
      body: { classList: { toggle: () => { visible = !visible; return visible; } } },
    },
    window: { setInterval: (callback, delay) => { intervals.push({ callback, delay }); } },
  });
  return { attributes, pricePage, image, intervals };
}

const loaded = setupImage(true, 1280);
assert.equal(loaded.intervals.length, 1);
assert.equal(loaded.intervals[0].delay, 5000);
assert.equal(loaded.attributes['aria-hidden'], 'true');
for (let cycle = 0; cycle < 3; cycle += 1) {
  loaded.intervals[0].callback();
  assert.equal(loaded.attributes['aria-hidden'], 'false');
  assert.ok(loaded.pricePage.every((element) => element.inert));
  loaded.intervals[0].callback();
  assert.equal(loaded.attributes['aria-hidden'], 'true');
  assert.ok(loaded.pricePage.every((element) => !element.inert));
}

const pending = setupImage(false, 0);
assert.equal(pending.intervals.length, 0);
pending.image.naturalWidth = 1280;
pending.image.onLoad();
pending.image.onLoad();
assert.equal(pending.intervals.length, 1);
assert.equal(setupImage(true, 0).intervals.length, 0);

console.log('fullscreen promotion waits for the image and alternates every five seconds without blocking the restored page');
