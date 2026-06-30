const fs = require('fs');
const path = require('path');

const workflowPath = path.join(
  __dirname,
  '..',
  '.github',
  'workflows',
  'capture-opening-price.yml'
);

if (!fs.existsSync(workflowPath)) {
  throw new Error('Expected a scheduled workflow to capture the 10:00 opening price');
}

const workflow = fs.readFileSync(workflowPath, 'utf8');
if (!workflow.includes("cron: '0 2 * * *'")) {
  throw new Error('Expected opening-price capture to run at 10:00 Beijing time');
}

if (!workflow.includes('https://www.shanxiyuexin.cn/gold-api/gold/current')) {
  throw new Error('Expected opening-price capture to call the cloud current-price API');
}

console.log('opening price capture workflow runs daily at 10:00 Beijing time');
