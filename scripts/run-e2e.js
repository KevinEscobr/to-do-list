const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

process.env.NO_PROXY = 'localhost,127.0.0.1';

const WWW_DIR = path.resolve(__dirname, '..', 'www');
const PORT = 4200;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(WWW_DIR, reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WWW_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[E2E Runner] Static server listening on http://127.0.0.1:${PORT}`);

  const pw = spawn('npx', ['playwright', 'test'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NO_PROXY: 'localhost,127.0.0.1' },
  });

  pw.on('close', (code) => {
    console.log(`[E2E Runner] Playwright finished with exit code ${code}`);
    server.close(() => {
      process.exit(code || 0);
    });
  });
});
