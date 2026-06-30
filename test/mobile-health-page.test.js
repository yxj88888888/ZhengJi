const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

if (!server.includes('function wantsHealthJson(req)')) {
  throw new Error('Expected a helper that distinguishes API clients from browser visits');
}

if (!server.includes('function buildHealthPage(req, health)')) {
  throw new Error('Expected a browser-friendly health page helper');
}

if (!server.includes('res.type(\'html\').send(buildHealthPage(req, health));')) {
  throw new Error('Expected /api/health to show an HTML page to browser visits');
}

if (!server.includes('打开实时金价屏') || !server.includes('href="/"')) {
  throw new Error('Expected health page to include a clear link back to the gold dashboard');
}

if (!server.includes('res.json(health);')) {
  throw new Error('Expected API health checks to keep returning JSON');
}

console.log('mobile browser visits to health route can get back to the dashboard');
