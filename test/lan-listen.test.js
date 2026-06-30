const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

if (!/const HOST\s*=\s*process\.env\.HOST\s*\|\|\s*['"]0\.0\.0\.0['"]/.test(server)) {
  throw new Error('Expected server to default to binding on 0.0.0.0 for LAN access');
}

if (!/app\.listen\(PORT,\s*HOST,/.test(server)) {
  throw new Error('Expected app.listen to use the configured HOST');
}

if (!server.includes('局域网访问: http://${LAN_HOST}:${PORT}')) {
  throw new Error('Expected startup message to show the LAN access URL for other devices');
}

console.log('server is configured for LAN access');
